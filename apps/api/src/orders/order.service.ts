import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TRPCError } from '@trpc/server';
import {
  canTransition,
  nextTransitions,
  ORDER_STATUSES,
  stockIsReserved,
  TRANSITIONS,
  validateQty,
  type OrderStatus,
  type Role,
} from '@rc/shared';
import { PriceService } from '../catalog/price.service';
import { VisibilityService } from '../catalog/visibility.service';
import { PrismaService } from '../prisma/prisma.service';

export interface OrderActor {
  id: string;
  memberships: { orgId: string; role: Role; branchScope: unknown }[];
  roles: Role[];
}

export interface CreateOrderLineInput {
  variantId: string;
  qty: number;
}

export interface CreateOrderInput {
  branchId: string;
  note?: string;
  lines: CreateOrderLineInput[];
}

export interface ListOrdersInput {
  status?: OrderStatus;
  limit?: number;
  cursor?: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const D = (v: Prisma.Decimal.Value): Prisma.Decimal => new Prisma.Decimal(v);

@Injectable()
export class OrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly prices: PriceService,
    private readonly visibility: VisibilityService,
  ) {}

  // ── Görünüm bağlamı ────────────────────────────────────────────────────────

  private isProducer(roles: Role[]): boolean {
    return roles.some((r) =>
      (['producer_admin', 'sales_staff', 'production_staff', 'shipping_staff'] as Role[]).includes(r),
    );
  }

  private async customerContext(actor: OrderActor): Promise<{ orgId: string; groupIds: string[] }> {
    const membership = actor.memberships.find((m) =>
      (['customer_admin', 'branch_manager', 'customer_user'] as Role[]).includes(m.role),
    );
    if (!membership) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Sipariş yalnızca müşteri hesabından oluşturulur.',
      });
    }
    const groups = await this.prisma.customerGroupMember.findMany({
      where: { orgId: membership.orgId },
      select: { groupId: true },
    });
    return { orgId: membership.orgId, groupIds: groups.map((g) => g.groupId) };
  }

  /** Bu org'a bağlı üyeliklerde şube kısıtı varsa izinli şube id kümesi; yoksa null (tümü). */
  private branchScopeFor(actor: OrderActor, orgId: string): Set<string> | null {
    const scopes = actor.memberships
      .filter((m) => m.orgId === orgId)
      .map((m) => m.branchScope)
      .filter((s): s is string[] => Array.isArray(s) && s.length > 0);
    if (scopes.length === 0) return null;
    return new Set(scopes.flat());
  }

  /** Müşteri kendi firmasının (kapsamı varsa yalnız izinli) şubelerini görür — checkout şube seçimi için. */
  async myBranches(actor: OrderActor) {
    const { orgId } = await this.customerContext(actor);
    const allowed = this.branchScopeFor(actor, orgId);
    return this.prisma.branch.findMany({
      where: { orgId, isActive: true, ...(allowed ? { id: { in: [...allowed] } } : {}) },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, address: true },
    });
  }

  // ── Oluşturma ──────────────────────────────────────────────────────────────

  async createOrder(input: CreateOrderInput, actor: OrderActor) {
    if (input.lines.length === 0) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'En az bir sipariş satırı gerekli.' });
    }
    const { orgId, groupIds } = await this.customerContext(actor);

    const branch = await this.prisma.branch.findFirst({
      where: { id: input.branchId, orgId, isActive: true },
      select: { id: true, name: true },
    });
    if (!branch) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Şube bulunamadı.' });
    }
    const allowed = this.branchScopeFor(actor, orgId);
    if (allowed && !allowed.has(branch.id)) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Bu şube için sipariş oluşturamazsınız.' });
    }

    // Aynı varyant birden çok satırda geldiyse birleştir.
    const merged = new Map<string, number>();
    for (const l of input.lines) merged.set(l.variantId, (merged.get(l.variantId) ?? 0) + l.qty);
    const variantIds = [...merged.keys()];

    const variants = await this.prisma.productVariant.findMany({
      where: { id: { in: variantIds }, isActive: true },
      select: {
        id: true,
        name: true,
        orderUom: true,
        minOrderQty: true,
        qtyStep: true,
        product: { select: { id: true, name: true, isActive: true } },
      },
    });
    if (variants.length !== variantIds.length) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Bazı ürünler bulunamadı veya pasif.',
      });
    }

    const hidden = new Set(await this.visibility.hiddenProductIds(orgId, groupIds));

    const prepared = await Promise.all(
      variants.map(async (v) => {
        if (!v.product.isActive || hidden.has(v.product.id)) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `${v.product.name} şu anda sipariş edilemez.`,
          });
        }
        const qty = merged.get(v.id) as number;
        const check = validateQty(qty, {
          orderUom: v.orderUom,
          minOrderQty: Number(v.minOrderQty),
          qtyStep: Number(v.qtyStep),
        });
        if (!check.ok) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: `${v.name}: ${check.reason}` });
        }
        const price = await this.prices.resolveOne(v.id, orgId, groupIds, qty);
        const unit = D(price.unitPrice);
        return {
          variantId: v.id,
          name: v.name,
          uom: v.orderUom,
          qty,
          unit,
          lineTotal: unit.mul(qty).toDecimalPlaces(2),
          currency: price.currency,
        };
      }),
    );

    const currency = prepared[0]?.currency ?? 'TRY';
    const subtotal = prepared
      .reduce((s, p) => s.add(p.lineTotal), D(0))
      .toDecimalPlaces(2);
    const primaryRole = actor.roles[0] ?? null;

    const order = await this.prisma.$transaction(async (tx) => {
      const year = new Date().getFullYear();
      const counter = await tx.counter.upsert({
        where: { key: `order:${year}` },
        create: { key: `order:${year}`, value: 1n },
        update: { value: { increment: 1n } },
      });
      const keyCode = `RC-${year}-${String(counter.value).padStart(6, '0')}`;

      const created = await tx.order.create({
        data: {
          keyCode,
          customerOrgId: orgId,
          branchId: branch.id,
          status: 'placed',
          currency,
          subtotal,
          total: subtotal,
          note: input.note,
          placedBy: actor.id,
          lines: {
            create: prepared.map((p) => ({
              itemType: 'product',
              variantId: p.variantId,
              nameSnapshot: p.name,
              qty: p.qty,
              uomSnapshot: p.uom,
              unitPrice: p.unit,
              lineTotal: p.lineTotal,
              source: 'customer',
              addedBy: actor.id,
            })),
          },
        },
        include: { lines: true, branch: { select: { name: true } } },
      });

      await tx.orderEvent.create({
        data: {
          orderId: created.id,
          toStatus: 'placed',
          type: 'placed',
          actorId: actor.id,
          actorRole: primaryRole,
        },
      });
      await tx.activityLog.create({
        data: {
          actorId: actor.id,
          actorRole: primaryRole,
          orgId,
          action: 'order.create',
          entityType: 'order',
          entityId: created.id,
          after: { keyCode, total: subtotal.toFixed(2), lines: prepared.length },
        },
      });
      await tx.outboxEvent.create({
        data: {
          topic: 'order.placed',
          payload: { orderId: created.id, keyCode, customerOrgId: orgId },
        },
      });

      return created;
    });

    return this.shape(order, actor.roles);
  }

  // ── Durum geçişi ───────────────────────────────────────────────────────────

  async transition(orderRef: string, to: OrderStatus, actor: OrderActor, note?: string) {
    const order = await this.loadForWrite(orderRef, actor);
    const from = order.status as OrderStatus;

    if (from === to) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Sipariş zaten bu durumda.' });
    }
    const defined = TRANSITIONS.find((t) => t.from === from && t.to === to);
    if (!defined) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `"${from}" durumundan "${to}" durumuna geçilemez.`,
      });
    }
    const actingRole = actor.roles.find((r) => canTransition(from, to, r));
    if (!actingRole) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Bu geçiş için yetkiniz yok.' });
    }

    const productLines = order.lines.filter(
      (l): l is typeof l & { variantId: string } =>
        l.itemType === 'product' && l.variantId != null,
    );

    const updated = await this.prisma.$transaction(async (tx) => {
      if (defined.decrementsStock) {
        await tx.stockMovement.createMany({
          data: productLines.map((l) => ({
            variantId: l.variantId,
            delta: D(l.qty).negated(),
            reason: 'order_reserve' as const,
            refOrderId: order.id,
            actorId: actor.id,
          })),
        });
      }
      if (to === 'cancelled' && stockIsReserved(from)) {
        await tx.stockMovement.createMany({
          data: productLines.map((l) => ({
            variantId: l.variantId,
            delta: D(l.qty),
            reason: 'order_release' as const,
            refOrderId: order.id,
            actorId: actor.id,
          })),
        });
      }

      const o = await tx.order.update({
        where: { id: order.id },
        data: { status: to },
        include: { lines: true, branch: { select: { name: true } } },
      });
      await tx.orderEvent.create({
        data: {
          orderId: order.id,
          fromStatus: from,
          toStatus: to,
          type: 'transition',
          actorId: actor.id,
          actorRole: actingRole,
          note,
        },
      });
      await tx.activityLog.create({
        data: {
          actorId: actor.id,
          actorRole: actingRole,
          orgId: order.customerOrgId,
          action: `order.transition.${to}`,
          entityType: 'order',
          entityId: order.id,
          before: { status: from },
          after: { status: to },
        },
      });
      await tx.outboxEvent.create({
        data: {
          topic: 'order.status_changed',
          payload: { orderId: order.id, keyCode: order.keyCode, from, to },
        },
      });
      return o;
    });

    return this.shape(updated, actor.roles);
  }

  // ── Okuma ──────────────────────────────────────────────────────────────────

  async getOrder(orderRef: string, actor: OrderActor) {
    const where = UUID_RE.test(orderRef) ? { id: orderRef } : { keyCode: orderRef };
    const order = await this.prisma.order.findUnique({
      where,
      include: {
        lines: true,
        branch: { select: { name: true } },
        events: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!order || !this.canSee(order.customerOrgId, actor)) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Sipariş bulunamadı.' });
    }
    return {
      ...this.shape(order, actor.roles),
      events: order.events.map((e) => ({
        type: e.type,
        fromStatus: e.fromStatus,
        toStatus: e.toStatus,
        note: e.note,
        actorRole: e.actorRole,
        createdAt: e.createdAt,
      })),
    };
  }

  async listOrders(input: ListOrdersInput, actor: OrderActor) {
    const limit = Math.min(Math.max(input.limit ?? 20, 1), 100);
    const producer = this.isProducer(actor.roles);

    const where: Prisma.OrderWhereInput = {
      ...(input.status ? { status: input.status } : {}),
    };
    if (!producer) {
      const orgIds = actor.memberships
        .filter((m) =>
          (['customer_admin', 'branch_manager', 'customer_user'] as Role[]).includes(m.role),
        )
        .map((m) => m.orgId);
      where.customerOrgId = { in: orgIds.length ? orgIds : ['00000000-0000-0000-0000-000000000000'] };
    }

    const rows = await this.prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      include: {
        branch: { select: { name: true } },
        _count: { select: { lines: true } },
      },
    });
    const hasMore = rows.length > limit;
    const items = (hasMore ? rows.slice(0, limit) : rows).map((o) => ({
      id: o.id,
      keyCode: o.keyCode,
      status: o.status,
      branchName: o.branch.name,
      lineCount: o._count.lines,
      total: o.total.toFixed(2),
      currency: o.currency,
      createdAt: o.createdAt,
    }));
    return { items, nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null };
  }

  // ── Yardımcılar ────────────────────────────────────────────────────────────

  private canSee(customerOrgId: string, actor: OrderActor): boolean {
    if (this.isProducer(actor.roles)) return true;
    return actor.memberships.some((m) => m.orgId === customerOrgId);
  }

  private async loadForWrite(orderRef: string, actor: OrderActor) {
    const where = UUID_RE.test(orderRef) ? { id: orderRef } : { keyCode: orderRef };
    const order = await this.prisma.order.findUnique({
      where,
      include: { lines: true },
    });
    if (!order || !this.canSee(order.customerOrgId, actor)) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Sipariş bulunamadı.' });
    }
    return order;
  }

  private shape(
    order: Prisma.OrderGetPayload<{
      include: { lines: true; branch: { select: { name: true } } };
    }>,
    roles: Role[],
  ) {
    const steps = new Map<string, { to: OrderStatus; labelTr: string }>();
    for (const r of roles) {
      for (const t of nextTransitions(order.status as OrderStatus, r)) {
        steps.set(t.to, { to: t.to, labelTr: t.labelTr });
      }
    }
    return {
      id: order.id,
      keyCode: order.keyCode,
      status: order.status,
      branchName: order.branch.name,
      currency: order.currency,
      subtotal: order.subtotal.toFixed(2),
      total: order.total.toFixed(2),
      note: order.note,
      createdAt: order.createdAt,
      lines: order.lines.map((l) => ({
        id: l.id,
        variantId: l.variantId,
        name: l.nameSnapshot,
        qty: Number(l.qty),
        uom: l.uomSnapshot,
        unitPrice: l.unitPrice.toFixed(2),
        lineTotal: l.lineTotal.toFixed(2),
        source: l.source,
      })),
      nextSteps: [...steps.values()],
    };
  }
}

/** Router girişini doğrularken kullanılan geçerli hedef durum listesi. */
export const TRANSITION_TARGETS = ORDER_STATUSES;
