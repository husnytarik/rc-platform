import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type PriceSource = 'customer' | 'customer_group' | 'default' | 'base';

export interface ResolvedPrice {
  variantId: string;
  /** Uygulanan birim fiyat (variant.orderUom başına), 2 hane string. */
  unitPrice: string;
  currency: string;
  source: PriceSource;
  priceListId: string | null;
  /** Bu fiyatın geçerli olduğu asgari miktar kademesi. */
  minQty: number;
  /** Varsa bir üst kademe — istemci "N alırsan birim fiyat X" gösterebilir. */
  nextTier: { minQty: number; unitPrice: string } | null;
}

interface CandidateList {
  id: string;
  source: Exclude<PriceSource, 'base'>;
  currency: string;
}

interface Tier {
  minQty: number;
  price: Prisma.Decimal;
  validFrom: Date | null;
  validTo: Date | null;
}

const money = (d: Prisma.Decimal): string => d.toFixed(2);

/**
 * Fiyat yalnızca sunucuda çözülür. Öncelik: müşteriye özel liste → müşteri grubu
 * listesi → varsayılan liste → variant.basePrice. İlk kademe eşleşen liste kazanır
 * (bir liste yalnız birkaç SKU'yu ezebilir). Kademe = en büyük `minQty <= qty`.
 */
@Injectable()
export class PriceService {
  constructor(private readonly prisma: PrismaService) {}

  /** Org için aktif aday listeleri öncelik sırasında döndürür. */
  async candidateLists(orgId: string | null, groupIds: string[]): Promise<CandidateList[]> {
    if (!orgId) {
      const def = await this.prisma.priceList.findFirst({
        where: { scope: 'default', isActive: true },
      });
      return def ? [{ id: def.id, source: 'default', currency: def.currency }] : [];
    }

    const [customer, group, def] = await Promise.all([
      this.prisma.priceList.findFirst({ where: { scope: 'customer', orgId, isActive: true } }),
      groupIds.length
        ? this.prisma.priceList.findFirst({
            where: { scope: 'customer_group', groupId: { in: groupIds }, isActive: true },
          })
        : Promise.resolve(null),
      this.prisma.priceList.findFirst({ where: { scope: 'default', isActive: true } }),
    ]);

    const out: CandidateList[] = [];
    if (customer) out.push({ id: customer.id, source: 'customer', currency: customer.currency });
    if (group) out.push({ id: group.id, source: 'customer_group', currency: group.currency });
    if (def) out.push({ id: def.id, source: 'default', currency: def.currency });
    return out;
  }

  /**
   * Birden çok varyant için fiyat çözer (katalog listesi). `qtyByVariant` verilmezse
   * her varyant kendi `minOrderQty`'si ile değerlendirilir.
   */
  async resolveForOrg(
    variantIds: string[],
    orgId: string | null,
    groupIds: string[],
    qtyByVariant?: Map<string, number>,
  ): Promise<Map<string, ResolvedPrice>> {
    const result = new Map<string, ResolvedPrice>();
    if (variantIds.length === 0) return result;

    const variants = await this.prisma.productVariant.findMany({
      where: { id: { in: variantIds } },
      select: { id: true, basePrice: true, minOrderQty: true },
    });
    const lists = await this.candidateLists(orgId, groupIds);

    const items = lists.length
      ? await this.prisma.priceListItem.findMany({
          where: { priceListId: { in: lists.map((l) => l.id) }, variantId: { in: variantIds } },
          select: {
            priceListId: true,
            variantId: true,
            price: true,
            minQty: true,
            validFrom: true,
            validTo: true,
          },
        })
      : [];

    // priceListId → variantId → Tier[]
    const byList = new Map<string, Map<string, Tier[]>>();
    for (const it of items) {
      const perVar = byList.get(it.priceListId) ?? new Map<string, Tier[]>();
      const tiers = perVar.get(it.variantId) ?? [];
      tiers.push({
        minQty: it.minQty,
        price: it.price,
        validFrom: it.validFrom,
        validTo: it.validTo,
      });
      perVar.set(it.variantId, tiers);
      byList.set(it.priceListId, perVar);
    }

    const now = Date.now();
    const inWindow = (t: Tier): boolean =>
      (!t.validFrom || t.validFrom.getTime() <= now) && (!t.validTo || t.validTo.getTime() >= now);

    for (const v of variants) {
      const qty = qtyByVariant?.get(v.id) ?? Number(v.minOrderQty);
      let picked: ResolvedPrice | null = null;

      for (const list of lists) {
        const tiers = (byList.get(list.id)?.get(v.id) ?? []).filter(inWindow);
        if (tiers.length === 0) continue;

        const applicable = tiers
          .filter((t) => t.minQty <= qty)
          .sort((a, b) => b.minQty - a.minQty);
        const chosen = applicable[0] ?? [...tiers].sort((a, b) => a.minQty - b.minQty)[0];
        if (!chosen) continue;

        const higher = tiers
          .filter((t) => t.minQty > chosen.minQty)
          .sort((a, b) => a.minQty - b.minQty)[0];

        picked = {
          variantId: v.id,
          unitPrice: money(chosen.price),
          currency: list.currency,
          source: list.source,
          priceListId: list.id,
          minQty: chosen.minQty,
          nextTier: higher ? { minQty: higher.minQty, unitPrice: money(higher.price) } : null,
        };
        break;
      }

      result.set(
        v.id,
        picked ?? {
          variantId: v.id,
          unitPrice: money(v.basePrice),
          currency: 'TRY',
          source: 'base',
          priceListId: null,
          minQty: 1,
          nextTier: null,
        },
      );
    }

    return result;
  }

  /** Tek varyant + belirli miktar için fiyat (sipariş/sepet). */
  async resolveOne(
    variantId: string,
    orgId: string | null,
    groupIds: string[],
    qty: number,
  ): Promise<ResolvedPrice> {
    const map = await this.resolveForOrg(
      [variantId],
      orgId,
      groupIds,
      new Map([[variantId, qty]]),
    );
    const found = map.get(variantId);
    if (found) return found;
    // resolveForOrg her zaman doldurur; teorik güvenlik
    const v = await this.prisma.productVariant.findUniqueOrThrow({
      where: { id: variantId },
      select: { basePrice: true },
    });
    return {
      variantId,
      unitPrice: money(v.basePrice),
      currency: 'TRY',
      source: 'base',
      priceListId: null,
      minQty: 1,
      nextTier: null,
    };
  }
}
