import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TRPCError } from '@trpc/server';
import { isProducerRole, ORDER_STATUS_LABELS_TR, ROLE_LABELS_TR, type Role } from '@rc/shared';
import { PrismaService } from '../prisma/prisma.service';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ReviewActor {
  id: string;
  roles: Role[];
}

/**
 * `customer.manage` hem üretici personeline (tüm firmalar) hem de
 * `customer_admin`'e (yalnızca kendi firması) verilir — kapsamı burada zorlarız.
 */
export interface CallerScope {
  roles: Role[];
  orgIds: string[];
}

export interface ListCustomersInput {
  search?: string;
  status?: 'active' | 'inactive';
  limit?: number;
  cursor?: string;
}

export interface UpdateActor extends CallerScope {
  id: string;
}

export interface UpdateCustomerInput {
  id: string;
  name?: string;
  taxId?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
}

export interface UpdateBranchInput {
  id: string;
  name?: string;
  address?: string | null;
  phone?: string | null;
}

@Injectable()
export class CustomerService {
  constructor(private readonly prisma: PrismaService) {}

  async list(input: ListCustomersInput, caller: CallerScope) {
    const limit = Math.min(Math.max(input.limit ?? 20, 1), 100);
    const search = input.search?.trim();
    const producer = caller.roles.some(isProducerRole);

    // customer_admin sadece kendi firmasını görür — üye olduğu org yoksa boş liste.
    if (!producer && caller.orgIds.length === 0) {
      return { items: [], nextCursor: null };
    }

    const where: Prisma.OrganizationWhereInput = {
      type: 'customer',
      ...(producer ? {} : { id: { in: caller.orgIds } }),
      ...(input.status ? { isActive: input.status === 'active' } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { taxId: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const rows = await this.prisma.organization.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      include: {
        _count: {
          select: { branches: true, memberships: true, ordersAsCustomer: true },
        },
      },
    });

    const hasMore = rows.length > limit;
    const items = (hasMore ? rows.slice(0, limit) : rows).map((o) => ({
      id: o.id,
      name: o.name,
      slug: o.slug,
      taxId: o.taxId,
      phone: o.phone,
      isActive: o.isActive,
      branchCount: o._count.branches,
      memberCount: o._count.memberships,
      orderCount: o._count.ordersAsCustomer,
      createdAt: o.createdAt,
    }));

    return { items, nextCursor: hasMore ? (items[items.length - 1]?.id ?? null) : null };
  }

  async get(id: string, caller: CallerScope) {
    if (!UUID_RE.test(id)) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Geçersiz müşteri kimliği.' });
    }
    const producer = caller.roles.some(isProducerRole);
    if (!producer && !caller.orgIds.includes(id)) {
      // Varlığı bile sızdırmamak için FORBIDDEN değil NOT_FOUND.
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Müşteri bulunamadı.' });
    }
    const o = await this.prisma.organization.findFirst({
      where: { id, type: 'customer' },
      include: {
        branches: {
          orderBy: { createdAt: 'asc' },
          select: { id: true, name: true, address: true, phone: true, isActive: true },
        },
        memberships: {
          orderBy: { createdAt: 'asc' },
          include: { user: { select: { id: true, fullName: true, phone: true } } },
        },
        ordersAsCustomer: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: { id: true, keyCode: true, status: true, total: true, createdAt: true },
        },
      },
    });
    if (!o) throw new TRPCError({ code: 'NOT_FOUND', message: 'Müşteri bulunamadı.' });

    return {
      id: o.id,
      name: o.name,
      slug: o.slug,
      taxId: o.taxId,
      phone: o.phone,
      email: o.email,
      address: o.address,
      isActive: o.isActive,
      createdAt: o.createdAt,
      branches: o.branches,
      members: o.memberships.map((m) => ({
        membershipId: m.id,
        userId: m.user.id,
        fullName: m.user.fullName,
        phone: m.user.phone,
        role: m.role as Role,
        roleLabel: ROLE_LABELS_TR[m.role as Role],
        status: m.status,
      })),
      recentOrders: o.ordersAsCustomer.map((ord) => ({
        id: ord.id,
        keyCode: ord.keyCode,
        status: ord.status,
        statusLabel: ORDER_STATUS_LABELS_TR[ord.status],
        total: Number(ord.total),
        createdAt: ord.createdAt,
      })),
    };
  }

  async setActive(id: string, isActive: boolean, actor: ReviewActor) {
    if (!UUID_RE.test(id)) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Geçersiz müşteri kimliği.' });
    }
    // Firma aktif/pasif kararı yalnızca üretici personelinde — kendi firmasını
    // pasife alabilen bir customer_admin kendini kilitleyebilir.
    if (!actor.roles.some(isProducerRole)) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    }
    const o = await this.prisma.organization.findFirst({ where: { id, type: 'customer' } });
    if (!o) throw new TRPCError({ code: 'NOT_FOUND', message: 'Müşteri bulunamadı.' });
    if (o.isActive === isActive) return { id: o.id, isActive };

    const updated = await this.prisma.$transaction(
      async (tx) => {
        const u = await tx.organization.update({ where: { id }, data: { isActive } });
        await tx.activityLog.create({
          data: {
            actorId: actor.id,
            actorRole: actor.roles[0],
            orgId: id,
            action: isActive ? 'customer.activate' : 'customer.deactivate',
            entityType: 'organization',
            entityId: id,
            before: { isActive: o.isActive },
            after: { isActive },
          },
        });
        await tx.outboxEvent.create({
          data: {
            topic: isActive ? 'customer.activated' : 'customer.deactivated',
            payload: { orgId: id },
          },
        });
        return u;
      },
      { timeout: 15_000, maxWait: 8_000 },
    );

    return { id: updated.id, isActive: updated.isActive };
  }

  async update(input: UpdateCustomerInput, actor: UpdateActor) {
    if (!UUID_RE.test(input.id)) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Geçersiz müşteri kimliği.' });
    }
    const producer = actor.roles.some(isProducerRole);
    if (!producer && !actor.orgIds.includes(input.id)) {
      // Varlığı bile sızdırmamak için FORBIDDEN değil NOT_FOUND.
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Müşteri bulunamadı.' });
    }
    const o = await this.prisma.organization.findFirst({ where: { id: input.id, type: 'customer' } });
    if (!o) throw new TRPCError({ code: 'NOT_FOUND', message: 'Müşteri bulunamadı.' });

    const { id, ...fields } = input;
    const updated = await this.prisma.$transaction(async (tx) => {
      const u = await tx.organization.update({ where: { id }, data: fields });
      await tx.activityLog.create({
        data: {
          actorId: actor.id,
          actorRole: actor.roles[0],
          orgId: id,
          action: 'customer.update',
          entityType: 'organization',
          entityId: id,
          before: { name: o.name, taxId: o.taxId, phone: o.phone, email: o.email, address: o.address },
          after: fields,
        },
      });
      return u;
    });

    return {
      id: updated.id,
      name: updated.name,
      taxId: updated.taxId,
      phone: updated.phone,
      email: updated.email,
      address: updated.address,
    };
  }

  async updateBranch(input: UpdateBranchInput, actor: UpdateActor) {
    if (!UUID_RE.test(input.id)) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Geçersiz şube kimliği.' });
    }
    const branch = await this.prisma.branch.findUnique({ where: { id: input.id } });
    if (!branch) throw new TRPCError({ code: 'NOT_FOUND', message: 'Şube bulunamadı.' });

    const producer = actor.roles.some(isProducerRole);
    if (!producer && !actor.orgIds.includes(branch.orgId)) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Şube bulunamadı.' });
    }

    const { id, ...fields } = input;
    const updated = await this.prisma.$transaction(async (tx) => {
      const u = await tx.branch.update({ where: { id }, data: fields });
      await tx.activityLog.create({
        data: {
          actorId: actor.id,
          actorRole: actor.roles[0],
          orgId: branch.orgId,
          action: 'customer.branch_update',
          entityType: 'branch',
          entityId: id,
          before: { name: branch.name, address: branch.address, phone: branch.phone },
          after: fields,
        },
      });
      return u;
    });

    return { id: updated.id, name: updated.name, address: updated.address, phone: updated.phone };
  }
}
