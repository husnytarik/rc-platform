import { Injectable } from '@nestjs/common';
import { TRPCError } from '@trpc/server';
import { PrismaService } from '../prisma/prisma.service';

const NON_REVENUE = ['cancelled', 'on_hold'] as const;

@Injectable()
export class ReportService {
  constructor(private readonly prisma: PrismaService) {}

  /** Satış personeli performansı: sipariş sayısı, net ciro, verilen iskonto. */
  async byRep(days: number) {
    const since = new Date(Date.now() - days * 86_400_000);
    const rows = await this.prisma.order.groupBy({
      by: ['salesRepId'],
      where: { createdAt: { gte: since }, status: { notIn: [...NON_REVENUE] } },
      _sum: { total: true, subtotal: true, discountAmount: true },
      _count: { _all: true },
      orderBy: { _sum: { total: 'desc' } },
    });
    const ids = rows.map((r) => r.salesRepId).filter((x): x is string => !!x);
    const users = await this.prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, fullName: true } });
    const name = new Map(users.map((u) => [u.id, u.fullName ?? 'Satış personeli']));
    return {
      days,
      reps: rows.map((r) => ({
        id: r.salesRepId,
        name: r.salesRepId ? (name.get(r.salesRepId) ?? '—') : 'Muhatap seçilmemiş',
        orders: r._count._all,
        revenue: Number(r._sum.total ?? 0),
        discount: Number(r._sum.discountAmount ?? 0),
      })),
    };
  }

  /** Seçili gün aralığındaki sipariş/ciro özeti + en iyi müşteri ve ürünler. */
  async summary(days: number) {
    const since = new Date(Date.now() - days * 86_400_000);
    const inRange = { createdAt: { gte: since } };

    const [byStatus, revenue, topCustomers, topLines, openTickets, outOfStock] = await Promise.all([
      this.prisma.order.groupBy({ by: ['status'], where: inRange, _count: { _all: true } }),
      this.prisma.order.aggregate({
        where: { ...inRange, status: { notIn: [...NON_REVENUE] } },
        _sum: { total: true },
        _count: { _all: true },
      }),
      this.prisma.order.groupBy({
        by: ['customerOrgId'],
        where: { ...inRange, status: { notIn: [...NON_REVENUE] } },
        _sum: { total: true },
        _count: { _all: true },
        orderBy: { _sum: { total: 'desc' } },
        take: 5,
      }),
      this.prisma.orderLine.groupBy({
        by: ['nameSnapshot'],
        where: { order: { ...inRange, status: { notIn: [...NON_REVENUE] } } },
        _sum: { lineTotal: true, qty: true },
        orderBy: { _sum: { lineTotal: 'desc' } },
        take: 5,
      }),
      this.prisma.ticket.count({ where: { status: { in: ['open', 'pending_staff'] } } }),
      this.prisma.stockMovement
        .groupBy({ by: ['variantId'], _sum: { delta: true } })
        .then((rows) => rows.filter((r) => Number(r._sum.delta ?? 0) <= 0).length),
    ]);

    const orgs = await this.prisma.organization.findMany({
      where: { id: { in: topCustomers.map((c) => c.customerOrgId) } },
      select: { id: true, name: true },
    });
    const orgName = new Map(orgs.map((o) => [o.id, o.name]));

    return {
      days,
      orderCount: revenue._count._all,
      revenue: Number(revenue._sum.total ?? 0),
      byStatus: byStatus.map((s) => ({ status: s.status, count: s._count._all })),
      topCustomers: topCustomers.map((c) => ({
        name: orgName.get(c.customerOrgId) ?? '—',
        orders: c._count._all,
        total: Number(c._sum.total ?? 0),
      })),
      topProducts: topLines.map((l) => ({
        name: l.nameSnapshot,
        qty: Number(l._sum.qty ?? 0),
        total: Number(l._sum.lineTotal ?? 0),
      })),
      openTickets,
      outOfStockVariants: outOfStock,
    };
  }

  // ── Satış personeli elle rapor girdileri ──

  /** Yönetici hepsini, diğerleri yalnız kendi girdilerini görür. */
  async entries(actor: { id: string; roles: string[] }, input: { limit?: number; cursor?: string }) {
    const limit = Math.min(Math.max(input.limit ?? 30, 1), 100);
    const all = actor.roles.includes('producer_admin');
    const rows = await this.prisma.salesReportEntry.findMany({
      where: all ? {} : { authorId: actor.id },
      orderBy: [{ occurredAt: 'desc' }, { id: 'asc' }],
      take: limit + 1,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const users = await this.prisma.user.findMany({
      where: { id: { in: [...new Set(page.map((r) => r.authorId))] } },
      select: { id: true, fullName: true },
    });
    const name = new Map(users.map((u) => [u.id, u.fullName ?? '—']));
    return {
      items: page.map((r) => ({
        id: r.id,
        title: r.title,
        body: r.body,
        occurredAt: r.occurredAt,
        authorName: name.get(r.authorId) ?? '—',
        mine: r.authorId === actor.id,
      })),
      nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
    };
  }

  async addEntry(actor: { id: string }, input: { title: string; body?: string | null; occurredAt: Date }) {
    const r = await this.prisma.salesReportEntry.create({
      data: { authorId: actor.id, title: input.title.trim(), body: input.body?.trim() || null, occurredAt: input.occurredAt },
    });
    return { id: r.id };
  }

  async removeEntry(actor: { id: string; roles: string[] }, id: string) {
    const r = await this.prisma.salesReportEntry.findUnique({ where: { id } });
    if (!r || (r.authorId !== actor.id && !actor.roles.includes('producer_admin'))) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Girdi bulunamadı.' });
    }
    await this.prisma.salesReportEntry.delete({ where: { id } });
    return { ok: true };
  }
}
