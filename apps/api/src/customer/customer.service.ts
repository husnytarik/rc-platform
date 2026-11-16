import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TRPCError } from '@trpc/server';
import { isProducerRole, ORDER_STATUS_LABELS_TR, ROLE_LABELS_TR, toE164TR, trSlug, type Role } from '@rc/shared';
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

  // ───────────── Yönetici: firma / şube / üye ekleme-düzenleme (yalnız üretici) ─────────────

  private requireProducer(actor: ReviewActor): void {
    if (!actor.roles.some(isProducerRole)) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    }
  }

  private async log(
    actor: ReviewActor,
    orgId: string,
    action: string,
    entityType: string,
    entityId: string,
    before: Prisma.InputJsonValue | undefined,
    after: Prisma.InputJsonValue,
  ) {
    await this.prisma.activityLog.create({
      data: { actorId: actor.id, actorRole: actor.roles[0], orgId, action, entityType, entityId, before, after },
    });
  }

  private async uniqueSlug(base: string): Promise<string> {
    const root = base || 'firma';
    for (let n = 0; n < 50; n++) {
      const candidate = n === 0 ? root : `${root}-${n + 1}`;
      const clash = await this.prisma.organization.findUnique({ where: { slug: candidate } });
      if (!clash) return candidate;
    }
    return `${root}-${Date.now()}`;
  }

  private async upsertPhoneUser(phoneRaw: string, fullName: string) {
    const phone = toE164TR(phoneRaw);
    if (!phone) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Geçerli bir cep telefonu girin (05XX...).' });
    const existing = await this.prisma.user.findUnique({ where: { phone } });
    if (existing) {
      if (!existing.fullName && fullName) {
        return this.prisma.user.update({ where: { id: existing.id }, data: { fullName } });
      }
      return existing;
    }
    return this.prisma.user.create({
      data: { provider: 'phone', providerUserId: phone, phone, fullName },
    });
  }

  private async scopeFor(orgId: string, role: string, branchIds?: string[]): Promise<string[] | null> {
    if (role !== 'branch_manager' || !branchIds || branchIds.length === 0) return null;
    const ok = await this.prisma.branch.findMany({ where: { orgId, id: { in: branchIds } }, select: { id: true } });
    return ok.map((b) => b.id);
  }

  async createCustomer(input: CreateCustomerInput, actor: ReviewActor) {
    this.requireProducer(actor);
    const slug = await this.uniqueSlug(trSlug(input.name));
    const org = await this.prisma.organization.create({
      data: {
        type: 'customer',
        name: input.name,
        slug,
        taxId: input.taxId ?? null,
        phone: input.phone ?? null,
        email: input.email ?? null,
        address: input.address ?? null,
        branches: { create: [{ name: input.branchName?.trim() || 'Merkez Şube' }] },
      },
    });
    await this.log(actor, org.id, 'customer.create', 'organization', org.id, undefined, { name: org.name });
    if (input.adminPhone) {
      await this.addMember(
        { orgId: org.id, phone: input.adminPhone, fullName: input.adminName?.trim() || 'Yönetici', role: 'customer_admin' },
        actor,
      );
    }
    return { id: org.id };
  }

  async createBranch(input: { orgId: string; name: string; address?: string | null; phone?: string | null }, actor: ReviewActor) {
    this.requireProducer(actor);
    const org = await this.prisma.organization.findFirst({ where: { id: input.orgId, type: 'customer' } });
    if (!org) throw new TRPCError({ code: 'NOT_FOUND', message: 'Müşteri bulunamadı.' });
    const b = await this.prisma.branch.create({
      data: { orgId: org.id, name: input.name, address: input.address ?? null, phone: input.phone ?? null },
    });
    await this.log(actor, org.id, 'customer.branch_create', 'branch', b.id, undefined, { name: b.name });
    return { id: b.id };
  }

  async addMember(input: AddMemberInput, actor: ReviewActor) {
    this.requireProducer(actor);
    const org = await this.prisma.organization.findFirst({ where: { id: input.orgId, type: 'customer' } });
    if (!org) throw new TRPCError({ code: 'NOT_FOUND', message: 'Müşteri bulunamadı.' });
    const user = await this.upsertPhoneUser(input.phone, input.fullName);
    const branchScope = await this.scopeFor(org.id, input.role, input.branchIds);
    const dup = await this.prisma.membership.findFirst({ where: { userId: user.id, orgId: org.id, role: input.role } });
    if (dup) throw new TRPCError({ code: 'CONFLICT', message: 'Bu kişi bu firmada zaten bu rolde.' });
    const m = await this.prisma.membership.create({
      data: {
        userId: user.id,
        orgId: org.id,
        role: input.role,
        status: 'active',
        branchScope: branchScope ?? Prisma.JsonNull,
      },
    });
    await this.log(actor, org.id, 'customer.member_add', 'membership', m.id, undefined, {
      userId: user.id,
      role: input.role,
    });
    return { membershipId: m.id };
  }

  async updateMember(input: UpdateMemberInput, actor: ReviewActor) {
    this.requireProducer(actor);
    const m = await this.prisma.membership.findUnique({ where: { id: input.membershipId }, include: { user: true, org: true } });
    if (!m || m.org.type !== 'customer') throw new TRPCError({ code: 'NOT_FOUND', message: 'Üye bulunamadı.' });

    if (input.fullName !== undefined || input.phone !== undefined) {
      const data: Prisma.UserUpdateInput = {};
      if (input.fullName !== undefined) data.fullName = input.fullName;
      if (input.phone !== undefined) {
        const phone = toE164TR(input.phone);
        if (!phone) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Geçerli bir cep telefonu girin (05XX...).' });
        if (phone !== m.user.phone) {
          const clash = await this.prisma.user.findUnique({ where: { phone } });
          if (clash) throw new TRPCError({ code: 'CONFLICT', message: 'Bu telefon başka bir kullanıcıya ait.' });
          data.phone = phone;
          data.providerUserId = phone;
          data.tcHash = null; // numara değişti: TC ilk girişte yeniden bağlanır
        }
      }
      await this.prisma.user.update({ where: { id: m.userId }, data });
    }

    const role = input.role ?? m.role;
    const mdata: Prisma.MembershipUpdateInput = {};
    if (input.role && input.role !== m.role) {
      const dup = await this.prisma.membership.findFirst({ where: { userId: m.userId, orgId: m.orgId, role: input.role } });
      if (dup) throw new TRPCError({ code: 'CONFLICT', message: 'Kişi bu firmada zaten bu rolde.' });
      mdata.role = input.role;
    }
    if (input.status) mdata.status = input.status;
    if (input.branchIds !== undefined || input.role) {
      const scope = await this.scopeFor(m.orgId, role, input.branchIds);
      mdata.branchScope = scope ?? Prisma.JsonNull;
    }
    if (Object.keys(mdata).length > 0) {
      await this.prisma.membership.update({ where: { id: m.id }, data: mdata });
    }
    await this.log(actor, m.orgId, 'customer.member_update', 'membership', m.id, { role: m.role, status: m.status }, {
      role,
      status: input.status ?? m.status,
    });
    return { ok: true };
  }

  async removeMember(membershipId: string, actor: ReviewActor) {
    this.requireProducer(actor);
    const m = await this.prisma.membership.findUnique({ where: { id: membershipId }, include: { org: true } });
    if (!m || m.org.type !== 'customer') throw new TRPCError({ code: 'NOT_FOUND', message: 'Üye bulunamadı.' });
    await this.prisma.membership.delete({ where: { id: m.id } });
    await this.log(actor, m.orgId, 'customer.member_remove', 'membership', m.id, { role: m.role, userId: m.userId }, {});
    return { ok: true };
  }
}

export interface CreateCustomerInput {
  name: string;
  taxId?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  branchName?: string;
  adminName?: string;
  adminPhone?: string;
}
export type CustomerRole = 'customer_admin' | 'branch_manager' | 'customer_user';
export interface AddMemberInput {
  orgId: string;
  fullName: string;
  phone: string;
  role: CustomerRole;
  branchIds?: string[];
}
export interface UpdateMemberInput {
  membershipId: string;
  fullName?: string;
  phone?: string;
  role?: CustomerRole;
  status?: 'active' | 'suspended';
  branchIds?: string[];
}
