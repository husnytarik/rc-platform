import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TRPCError } from '@trpc/server';
import { trSlug, type Role } from '@rc/shared';
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

/** Yeni müşteri org'una atanabilecek roller — üretici rolleri buradan verilmez. */
const ASSIGNABLE_ROLES: Role[] = ['customer_admin', 'branch_manager', 'customer_user'];

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
        message: 'Bu başvuruya yalnızca müşteri rolleri atanabilir.',
      });
    }
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
