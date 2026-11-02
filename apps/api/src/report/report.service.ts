import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const NON_REVENUE = ['cancelled', 'on_hold'] as const;

@Injectable()
export class ReportService {
  constructor(private readonly prisma: PrismaService) {}

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
}
