import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** Müşteriye gösterilen stok rozeti — gerçek adet asla sızmaz. */
export type StockBadge = 'in' | 'low' | 'out' | 'preorder' | 'incoming' | 'closed';

export interface VariantStock {
  badge: StockBadge;
  /** Yalnızca üretici görünümünde dolar: gerçek bakiye (orderUom cinsinden). */
  available: number | null;
}

const OVERRIDE_BADGE: Record<string, StockBadge> = {
  limited: 'low',
  preorder: 'preorder',
  incoming: 'incoming',
  closed: 'closed',
  in_stock: 'in',
};

@Injectable()
export class StockService {
  constructor(private readonly prisma: PrismaService) {}

  /** Bakiye = SUM(delta). Defter append-only. */
  async balances(variantIds: string[]): Promise<Map<string, number>> {
    const out = new Map<string, number>();
    if (variantIds.length === 0) return out;
    const rows = await this.prisma.stockMovement.groupBy({
      by: ['variantId'],
      where: { variantId: { in: variantIds } },
      _sum: { delta: true },
    });
    for (const r of rows) out.set(r.variantId, Number(r._sum.delta ?? 0));
    for (const id of variantIds) if (!out.has(id)) out.set(id, 0);
    return out;
  }

  /**
   * Varyant rozetleri. `producerView` true ise `available` gerçek bakiyeyle dolar.
   * Ürün bazlı `StockDisplayOverride` (in_stock dışı) her zaman rozeti ezer.
   */
  async badges(
    variantIds: string[],
    producerView: boolean,
  ): Promise<Map<string, VariantStock>> {
    const out = new Map<string, VariantStock>();
    if (variantIds.length === 0) return out;

    const [balances, variants] = await Promise.all([
      this.balances(variantIds),
      this.prisma.productVariant.findMany({
        where: { id: { in: variantIds } },
        select: {
          id: true,
          lowStockThreshold: true,
          product: {
            select: { allowPreorder: true, displayOverride: { select: { state: true } } },
          },
        },
      }),
    ]);

    for (const v of variants) {
      const balance = balances.get(v.id) ?? 0;
      const override = v.product.displayOverride?.state;
      let badge: StockBadge;

      if (override && override !== 'in_stock') {
        badge = OVERRIDE_BADGE[override] ?? 'in';
      } else if (balance <= 0) {
        badge = v.product.allowPreorder ? 'preorder' : 'out';
      } else if (v.lowStockThreshold != null && balance <= Number(v.lowStockThreshold)) {
        badge = 'low';
      } else {
        badge = 'in';
      }

      out.set(v.id, { badge, available: producerView ? balance : null });
    }
    return out;
  }
}
