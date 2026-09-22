import { Injectable } from '@nestjs/common';
import { TRPCError } from '@trpc/server';
import { Prisma, type StockDisplayState, type StockReason } from '@prisma/client';
import type { Role } from '@rc/shared';
import { PrismaService } from '../prisma/prisma.service';

/** Müşteriye gösterilen stok rozeti — gerçek adet asla sızmaz. */
export type StockBadge = 'in' | 'low' | 'out' | 'preorder' | 'incoming' | 'closed';

export interface VariantStock {
  badge: StockBadge;
  /** Yalnızca üretici görünümünde dolar: gerçek bakiye (orderUom cinsinden). */
  available: number | null;
}

/** Elle girilebilen defter nedenleri — `order_reserve`/`order_release` yalnız sipariş akışında yazılır. */
const MANUAL_REASONS: StockReason[] = ['purchase', 'production_in', 'adjustment', 'correction'];

export interface StockActor {
  id: string;
  roles: Role[];
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

  /** Varyant defteri, en yeni önce. Sayfalama `id` cursor'ı ile. */
  async ledger(variantId: string, opts: { limit?: number; cursor?: string }) {
    const limit = Math.min(Math.max(opts.limit ?? 30, 1), 100);
    const rows = await this.prisma.stockMovement.findMany({
      where: { variantId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    return {
      items: items.map((r) => ({
        id: r.id,
        delta: Number(r.delta),
        reason: r.reason,
        note: r.note,
        refOrderId: r.refOrderId,
        actorId: r.actorId,
        createdAt: r.createdAt,
      })),
      nextCursor: hasMore ? (items[items.length - 1]?.id ?? null) : null,
    };
  }

  /** Ürünün aktif override kaydı, yoksa null. */
  async getOverride(productId: string) {
    const row = await this.prisma.stockDisplayOverride.findUnique({ where: { productId } });
    if (!row) return null;
    return { state: row.state, note: row.note, updatedAt: row.updatedAt, updatedBy: row.updatedBy };
  }

  /** Elle stok hareketi girer (giriş/çıkış/düzeltme). Sipariş akışı bu yolu kullanmaz. */
  async adjust(
    input: { variantId: string; delta: number; reason: StockReason; note?: string },
    actor: StockActor,
  ) {
    if (!MANUAL_REASONS.includes(input.reason)) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Bu neden elle girilemez.' });
    }
    if (input.delta === 0) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Miktar sıfır olamaz.' });
    }
    const variant = await this.prisma.productVariant.findUnique({ where: { id: input.variantId } });
    if (!variant) throw new TRPCError({ code: 'NOT_FOUND', message: 'Varyant bulunamadı.' });

    return this.prisma.$transaction(async (tx) => {
      const movement = await tx.stockMovement.create({
        data: {
          variantId: input.variantId,
          delta: input.delta,
          reason: input.reason,
          note: input.note,
          actorId: actor.id,
        },
      });
      await tx.activityLog.create({
        data: {
          actorId: actor.id,
          actorRole: actor.roles[0],
          action: 'stock.adjust',
          entityType: 'stock_movement',
          entityId: movement.id,
          after: { variantId: input.variantId, delta: input.delta, reason: input.reason },
        },
      });
      return { id: movement.id, delta: Number(movement.delta), createdAt: movement.createdAt };
    });
  }

  /** Ürünün müşteriye görünen durumunu elle ezer (gerçek bakiyeden bağımsız). */
  async setOverride(
    input: { productId: string; state: StockDisplayState; note?: string },
    actor: StockActor,
  ) {
    const product = await this.prisma.product.findUnique({ where: { id: input.productId } });
    if (!product) throw new TRPCError({ code: 'NOT_FOUND', message: 'Ürün bulunamadı.' });

    return this.prisma.$transaction(async (tx) => {
      const before = await tx.stockDisplayOverride.findUnique({ where: { productId: input.productId } });
      const override = await tx.stockDisplayOverride.upsert({
        where: { productId: input.productId },
        create: {
          productId: input.productId,
          state: input.state,
          note: input.note,
          updatedBy: actor.id,
        },
        update: { state: input.state, note: input.note, updatedBy: actor.id },
      });
      await tx.activityLog.create({
        data: {
          actorId: actor.id,
          actorRole: actor.roles[0],
          action: 'stock.override_set',
          entityType: 'stock_display_override',
          entityId: input.productId,
          before: before ? { state: before.state } : Prisma.JsonNull,
          after: { state: override.state },
        },
      });
      return { productId: override.productId, state: override.state, note: override.note };
    });
  }

  /** Override'ı kaldırır — görünüm yeniden tamamen gerçek bakiyeden hesaplanır. */
  async clearOverride(productId: string, actor: StockActor) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.stockDisplayOverride.findUnique({ where: { productId } });
      if (!before) return { productId, cleared: false };
      await tx.stockDisplayOverride.delete({ where: { productId } });
      await tx.activityLog.create({
        data: {
          actorId: actor.id,
          actorRole: actor.roles[0],
          action: 'stock.override_clear',
          entityType: 'stock_display_override',
          entityId: productId,
          before: { state: before.state },
          after: Prisma.JsonNull,
        },
      });
      return { productId, cleared: true };
    });
  }
}
