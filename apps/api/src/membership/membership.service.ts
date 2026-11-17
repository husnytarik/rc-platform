import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TRPCError } from '@trpc/server';
import { isProducerRole, ROLE_LABELS_TR, toE164TR, trSlug, type Role } from '@rc/shared';
import { PrismaService } from '../prisma/prisma.service';

export interface ReviewActor {
  id: string;
  roles: Role[];
}

export interface ListRequestsInput {
  status?: 'pending' | 'approved' | 'rejected';
  limit?: number;
  cursor?: string;
}

export interface ApproveInput {
  /** Atanacak rol — verilmezse başvurudaki `requestedRole`, o da yoksa customer_admin. */
  role?: Role;
  reviewNote?: string;
}

interface RequestPayload {
  taxId?: string | null;
  address?: string | null;
  branches?: { name: string; address?: string | null; phone?: string | null }[];
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Başvuruda atanabilecek roller: müşteri rolleri (yeni firma) veya personel rolleri (üretici org'u). */
const ASSIGNABLE_ROLES: Role[] = [
  'customer_admin',
  'branch_manager',
  'customer_user',
  'producer_admin',
  'sales_staff',
  'production_staff',
  'shipping_staff',
];

@Injectable()
export class MembershipService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Okuma ──────────────────────────────────────────────────────────────────

  async listRequests(input: ListRequestsInput) {
    const limit = input.limit ?? 20;
    const where: Prisma.MembershipRequestWhereInput = {
      ...(input.status ? { status: input.status } : {}),
    };

    const rows = await this.prisma.membershipRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      include: { user: { select: { fullName: true, phone: true } } },
    });

    const hasMore = rows.length > limit;
    const items = (hasMore ? rows.slice(0, limit) : rows).map((r) => this.shapeRow(r));
    return { items, nextCursor: hasMore ? (items[items.length - 1]?.id ?? null) : null };
  }

  async getRequest(id: string) {
    if (!UUID_RE.test(id)) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Geçersiz başvuru kimliği.' });
    }
    const r = await this.prisma.membershipRequest.findUnique({
      where: { id },
      include: { user: { select: { fullName: true, phone: true } } },
    });
    if (!r) throw new TRPCError({ code: 'NOT_FOUND', message: 'Başvuru bulunamadı.' });

    const payload = (r.payload ?? {}) as RequestPayload;
    return {
      ...this.shapeRow(r),
      address: payload.address ?? null,
      branches: (payload.branches ?? []).map((b) => ({
        name: b.name,
        address: b.address ?? null,
        phone: b.phone ?? null,
      })),
    };
  }

  // ── Karar ──────────────────────────────────────────────────────────────────

  async approve(id: string, actor: ReviewActor, opts: ApproveInput) {
    const req = await this.loadPending(id);
    const payload = (req.payload ?? {}) as RequestPayload;

    const role = opts.role ?? (req.requestedRole as Role | null) ?? 'customer_admin';
    if (!ASSIGNABLE_ROLES.includes(role)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Geçersiz rol.',
      });
    }
    if (isProducerRole(role)) return this.approveAsStaff(req, role, actor, opts);
    const orgName = (req.requestedOrgName ?? '').trim();
    if (!orgName) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Başvuruda firma adı yok.' });
    }

    const slug = await this.uniqueSlug(trSlug(orgName));
    const branchSeed =
      payload.branches && payload.branches.length > 0
        ? payload.branches
        : [{ name: 'Merkez Şube' }];

    const result = await this.prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          type: 'customer',
          name: orgName,
          slug,
          taxId: payload.taxId ?? null,
          address: payload.address ?? null,
          phone: req.phone,
          branches: {
            create: branchSeed.map((b) => ({
              name: b.name,
              address: b.address ?? null,
              phone: b.phone ?? null,
            })),
          },
        },
        include: { branches: { select: { id: true, name: true } } },
      });

      await tx.membership.create({
        data: { userId: req.userId, orgId: org.id, role, status: 'active' },
      });

      const updated = await tx.membershipRequest.update({
        where: { id: req.id },
        data: {
          status: 'approved',
          orgId: org.id,
          reviewedBy: actor.id,
          reviewedAt: new Date(),
          reviewNote: opts.reviewNote ?? null,
        },
        include: { user: { select: { fullName: true, phone: true } } },
      });

      await tx.activityLog.create({
        data: {
          actorId: actor.id,
          actorRole: actor.roles[0],
          orgId: org.id,
          action: 'membership_request.approve',
          entityType: 'membership_request',
          entityId: req.id,
          before: { status: 'pending' },
          after: { status: 'approved', orgId: org.id, role },
        },
      });
      await tx.outboxEvent.create({
        data: {
          topic: 'membership.approved',
          payload: { requestId: req.id, userId: req.userId, orgId: org.id, role },
        },
      });

      return { updated, org };
    }, { timeout: 20_000, maxWait: 10_000 });

    return {
      ...this.shapeRow(result.updated),
      orgId: result.org.id,
      branches: result.org.branches,
    };
  }

  /** Personel rolü: firma açılmaz, kişi üretici org'una üye yapılır. Yalnız producer_admin. */
  private async approveAsStaff(
    req: { id: string; userId: string },
    role: Role,
    actor: ReviewActor,
    opts: ApproveInput,
  ) {
    if (!actor.roles.includes('producer_admin')) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Personel rolü yalnızca yönetici verebilir.' });
    }
    const org = await this.producerOrg();
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.membership.upsert({
        where: { userId_orgId_role: { userId: req.userId, orgId: org.id, role } },
        update: { status: 'active' },
        create: { userId: req.userId, orgId: org.id, role, status: 'active' },
      });
      const u = await tx.membershipRequest.update({
        where: { id: req.id },
        data: { status: 'approved', orgId: org.id, reviewedBy: actor.id, reviewedAt: new Date(), reviewNote: opts.reviewNote ?? null },
        include: { user: { select: { fullName: true, phone: true } } },
      });
      await tx.activityLog.create({
        data: {
          actorId: actor.id,
          actorRole: actor.roles[0],
          orgId: org.id,
          action: 'membership_request.approve_staff',
          entityType: 'membership_request',
          entityId: req.id,
          before: { status: 'pending' },
          after: { status: 'approved', role },
        },
      });
      return u;
    });
    return { ...this.shapeRow(updated), orgId: org.id, branches: [] as { id: string; name: string }[] };
  }

  // ── Kullanıcılar (personel + müşteriler) ───────────────────────────────────

  private async producerOrg() {
    const org = await this.prisma.organization.findFirst({ where: { type: 'producer' } });
    if (!org) throw new TRPCError({ code: 'NOT_FOUND', message: 'Üretici organizasyonu bulunamadı.' });
    return org;
  }

  async people(input: { search?: string; kind?: 'staff' | 'customer'; limit?: number; cursor?: string }) {
    const limit = Math.min(Math.max(input.limit ?? 30, 1), 100);
    const q = input.search?.trim();
    const where: Prisma.UserWhereInput = {
      memberships: {
        some: input.kind ? { org: { type: input.kind === 'staff' ? 'producer' : 'customer' } } : {},
      },
      ...(q
        ? { OR: [{ fullName: { contains: q, mode: 'insensitive' } }, { phone: { contains: q.replace(/\s/g, '') } }] }
        : {}),
    };
    const rows = await this.prisma.user.findMany({
      where,
      orderBy: [{ fullName: 'asc' }, { id: 'asc' }],
      take: limit + 1,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      include: { memberships: { include: { org: { select: { id: true, name: true, type: true } } }, orderBy: { createdAt: 'asc' } } },
    });
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    return {
      items: page.map((u) => ({
        id: u.id,
        fullName: u.fullName,
        phone: u.phone,
        isStaff: u.memberships.some((m) => m.org.type === 'producer'),
        isActive: u.isActive,
        deletedAt: u.deletedAt,
        email: u.email,
        memberships: u.memberships.map((m) => ({
          id: m.id,
          role: m.role as Role,
          roleLabel: ROLE_LABELS_TR[m.role as Role],
          status: m.status,
          maxDiscountPct: Number(m.maxDiscountPct),
          orgId: m.org.id,
          orgName: m.org.name,
          orgType: m.org.type,
        })),
      })),
      nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
    };
  }

  /** Yönetici: kişinin hesabını dondurur / açar (silinmiş hesabı da geri açar). Veri silinmez. */
  async setUserActive(input: { userId: string; active: boolean }, actor: ReviewActor): Promise<{ ok: true }> {
    if (input.userId === actor.id) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Kendi hesabınızı dondurmazsınız.' });
    const u = await this.prisma.user.findUnique({ where: { id: input.userId }, select: { id: true, isActive: true } });
    if (!u) throw new TRPCError({ code: 'NOT_FOUND', message: 'Kullanıcı bulunamadı.' });
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: u.id }, data: { isActive: input.active, ...(input.active ? { deletedAt: null } : {}) } }),
      ...(input.active ? [] : [this.prisma.refreshToken.deleteMany({ where: { userId: u.id } }), this.prisma.deviceToken.deleteMany({ where: { userId: u.id } })]),
      this.prisma.activityLog.create({
        data: {
          actorId: actor.id,
          actorRole: actor.roles[0],
          action: input.active ? 'people.user_unfreeze' : 'people.user_freeze',
          entityType: 'user',
          entityId: u.id,
          before: { isActive: u.isActive },
          after: { isActive: input.active },
        },
      }),
    ]);
    return { ok: true };
  }

  private async guardSelf(m: { userId: string; role: string; org: { type: string } }, actor: ReviewActor & { id: string }) {
    if (m.userId === actor.id && m.org.type === 'producer') {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Kendi personel üyeliğinizi değiştiremezsiniz.' });
    }
  }

  async setMembership(
    input: { membershipId: string; role?: Role; status?: 'active' | 'suspended'; maxDiscountPct?: number },
    actor: ReviewActor,
  ) {
    const m = await this.prisma.membership.findUnique({ where: { id: input.membershipId }, include: { org: true } });
    if (!m) throw new TRPCError({ code: 'NOT_FOUND', message: 'Üyelik bulunamadı.' });
    await this.guardSelf(m, actor);
    const staffOrg = m.org.type === 'producer';
    if (input.role && isProducerRole(input.role) !== staffOrg) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: staffOrg ? 'Personel üyeliğine müşteri rolü verilemez.' : 'Müşteri üyeliğine personel rolü verilemez; "Personel yap" kullanın.',
      });
    }
    if (input.role && input.role !== m.role) {
      const dup = await this.prisma.membership.findFirst({ where: { userId: m.userId, orgId: m.orgId, role: input.role } });
      if (dup) throw new TRPCError({ code: 'CONFLICT', message: 'Kişi bu organizasyonda zaten bu rolde.' });
    }
    await this.prisma.$transaction([
      this.prisma.membership.update({
        where: { id: m.id },
        data: {
          ...(input.role ? { role: input.role } : {}),
          ...(input.status ? { status: input.status } : {}),
          ...(input.maxDiscountPct !== undefined ? { maxDiscountPct: input.maxDiscountPct } : {}),
        },
      }),
      this.prisma.activityLog.create({
        data: {
          actorId: actor.id,
          actorRole: actor.roles[0],
          orgId: m.orgId,
          action: 'people.membership_update',
          entityType: 'membership',
          entityId: m.id,
          before: { role: m.role, status: m.status },
          after: { role: input.role ?? m.role, status: input.status ?? m.status },
        },
      }),
    ]);
    return { ok: true };
  }

  async removeMembership(membershipId: string, actor: ReviewActor) {
    const m = await this.prisma.membership.findUnique({ where: { id: membershipId }, include: { org: true } });
    if (!m) throw new TRPCError({ code: 'NOT_FOUND', message: 'Üyelik bulunamadı.' });
    await this.guardSelf(m, actor);
    await this.prisma.$transaction([
      this.prisma.membership.delete({ where: { id: m.id } }),
      this.prisma.activityLog.create({
        data: {
          actorId: actor.id,
          actorRole: actor.roles[0],
          orgId: m.orgId,
          action: 'people.membership_remove',
          entityType: 'membership',
          entityId: m.id,
          before: { role: m.role, userId: m.userId },
          after: {},
        },
      }),
    ]);
    return { ok: true };
  }

  /** Kişiyi (mevcut müşteri de olabilir) üretici personeli yapar; yoksa telefonla kullanıcı açar. */
  async addStaff(input: { phone: string; fullName?: string; role: Role }, actor: ReviewActor) {
    if (!isProducerRole(input.role)) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Personel rolü seçin.' });
    }
    const phone = toE164TR(input.phone);
    if (!phone) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Geçerli bir cep telefonu girin (05XX...).' });
    const org = await this.producerOrg();
    let user = await this.prisma.user.findUnique({ where: { phone } });
    if (!user) {
      if (!input.fullName?.trim()) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Yeni kişi için ad soyad girin.' });
      user = await this.prisma.user.create({
        data: { provider: 'phone', providerUserId: phone, phone, fullName: input.fullName.trim() },
      });
    }
    const m = await this.prisma.membership.upsert({
      where: { userId_orgId_role: { userId: user.id, orgId: org.id, role: input.role } },
      update: { status: 'active' },
      create: { userId: user.id, orgId: org.id, role: input.role, status: 'active' },
    });
    await this.prisma.activityLog.create({
      data: {
        actorId: actor.id,
        actorRole: actor.roles[0],
        orgId: org.id,
        action: 'people.staff_add',
        entityType: 'membership',
        entityId: m.id,
        after: { userId: user.id, role: input.role },
      },
    });
    return { userId: user.id, membershipId: m.id };
  }

  async reject(id: string, actor: ReviewActor, reviewNote: string) {
    const req = await this.loadPending(id);

    const updated = await this.prisma.$transaction(async (tx) => {
      const u = await tx.membershipRequest.update({
        where: { id: req.id },
        data: {
          status: 'rejected',
          reviewedBy: actor.id,
          reviewedAt: new Date(),
          reviewNote,
        },
        include: { user: { select: { fullName: true, phone: true } } },
      });
      await tx.activityLog.create({
        data: {
          actorId: actor.id,
          actorRole: actor.roles[0],
          action: 'membership_request.reject',
          entityType: 'membership_request',
          entityId: req.id,
          before: { status: 'pending' },
          after: { status: 'rejected' },
        },
      });
      await tx.outboxEvent.create({
        data: {
          topic: 'membership.rejected',
          payload: { requestId: req.id, userId: req.userId },
        },
      });
      return u;
    }, { timeout: 20_000, maxWait: 10_000 });

    return this.shapeRow(updated);
  }

  // ── Yardımcılar ────────────────────────────────────────────────────────────

  private async loadPending(id: string) {
    if (!UUID_RE.test(id)) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Geçersiz başvuru kimliği.' });
    }
    const req = await this.prisma.membershipRequest.findUnique({ where: { id } });
    if (!req) throw new TRPCError({ code: 'NOT_FOUND', message: 'Başvuru bulunamadı.' });
    if (req.status !== 'pending') {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Bu başvuru zaten sonuçlanmış.' });
    }
    return req;
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

  private shapeRow(
    r: Prisma.MembershipRequestGetPayload<{
      include: { user: { select: { fullName: true; phone: true } } };
    }>,
  ) {
    const payload = (r.payload ?? {}) as RequestPayload;
    return {
      id: r.id,
      status: r.status,
      requestedOrgName: r.requestedOrgName,
      requestedRole: r.requestedRole,
      phone: r.phone,
      fullName: r.user.fullName,
      note: r.note,
      taxId: payload.taxId ?? null,
      branchCount: payload.branches?.length ?? 0,
      reviewNote: r.reviewNote,
      reviewedAt: r.reviewedAt,
      createdAt: r.createdAt,
    };
  }
}
