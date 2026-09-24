import { Injectable } from '@nestjs/common';
import { Prisma, type ServiceRequestStatus } from '@prisma/client';
import { TRPCError } from '@trpc/server';
import { isProducerRole, type Role } from '@rc/shared';
import { PrismaService } from '../prisma/prisma.service';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface CallerScope {
  roles: Role[];
  orgIds: string[];
}

export interface RequestActor extends CallerScope {
  id: string;
}

export interface CreateServiceInput {
  code: string;
  name: string;
  description?: string;
  basePrice?: number;
}

export interface UpdateServiceInput {
  id: string;
  name?: string;
  description?: string | null;
  basePrice?: number | null;
  isActive?: boolean;
}

export interface CreateRequestInput {
  serviceId: string;
  note?: string;
}

export interface ListRequestsInput {
  status?: ServiceRequestStatus;
  limit?: number;
  cursor?: string;
}

@Injectable()
export class ServicesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Müşterinin talep formunda seçebileceği aktif servisler. */
  async listActive() {
    const rows = await this.prisma.service.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
    return rows.map((s) => ({
      id: s.id,
      code: s.code,
      name: s.name,
      description: s.description,
      basePrice: s.basePrice ? Number(s.basePrice) : null,
    }));
  }

  async adminList() {
    const rows = await this.prisma.service.findMany({ orderBy: { createdAt: 'desc' } });
    return rows.map((s) => ({
      id: s.id,
      code: s.code,
      name: s.name,
      description: s.description,
      basePrice: s.basePrice ? Number(s.basePrice) : null,
      isActive: s.isActive,
    }));
  }

  async create(input: CreateServiceInput) {
    const s = await this.prisma.service.create({
      data: {
        code: input.code,
        name: input.name,
        description: input.description,
        basePrice: input.basePrice,
      },
    });
    return { id: s.id };
  }

  async update(input: UpdateServiceInput) {
    if (!UUID_RE.test(input.id)) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Geçersiz servis kimliği.' });
    }
    const { id, ...fields } = input;
    const s = await this.prisma.service.update({ where: { id }, data: fields });
    return { id: s.id };
  }

  /** Müşteri, kendi firması adına bir servis talebi (talep formu) oluşturur. */
  async createRequest(input: CreateRequestInput, actor: RequestActor) {
    if (!UUID_RE.test(input.serviceId)) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Geçersiz servis kimliği.' });
    }
    const orgId = actor.orgIds[0];
    if (!orgId) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Bir firmaya bağlı değilsiniz.' });
    }
    const service = await this.prisma.service.findFirst({
      where: { id: input.serviceId, isActive: true },
    });
    if (!service) throw new TRPCError({ code: 'NOT_FOUND', message: 'Servis bulunamadı.' });

    const req = await this.prisma.serviceRequest.create({
      data: {
        serviceId: input.serviceId,
        orgId,
        note: input.note,
        createdBy: actor.id,
      },
    });
    return { id: req.id };
  }

  async listRequests(input: ListRequestsInput, caller: CallerScope) {
    const producer = caller.roles.some(isProducerRole);
    if (!producer && caller.orgIds.length === 0) {
      return { items: [], nextCursor: null };
    }
    const limit = Math.min(Math.max(input.limit ?? 30, 1), 100);

    const where: Prisma.ServiceRequestWhereInput = {
      ...(producer ? {} : { orgId: { in: caller.orgIds } }),
      ...(input.status ? { status: input.status } : {}),
    };

    const rows = await this.prisma.serviceRequest.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      include: {
        service: { select: { id: true, name: true, code: true } },
        org: { select: { id: true, name: true } },
      },
    });

    const hasMore = rows.length > limit;
    const items = (hasMore ? rows.slice(0, limit) : rows).map((r) => ({
      id: r.id,
      status: r.status,
      note: r.note,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      service: r.service,
      org: r.org,
    }));

    return { items, nextCursor: hasMore ? (items[items.length - 1]?.id ?? null) : null };
  }

  async updateRequestStatus(input: { id: string; status: ServiceRequestStatus }, actor: RequestActor) {
    if (!UUID_RE.test(input.id)) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Geçersiz talep kimliği.' });
    }
    const existing = await this.prisma.serviceRequest.findUnique({ where: { id: input.id } });
    if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Talep bulunamadı.' });
    if (existing.status === input.status) return { id: existing.id, status: existing.status };

    const updated = await this.prisma.$transaction(async (tx) => {
      const u = await tx.serviceRequest.update({
        where: { id: input.id },
        data: { status: input.status },
      });
      await tx.activityLog.create({
        data: {
          actorId: actor.id,
          actorRole: actor.roles[0],
          orgId: existing.orgId,
          action: 'service_request.status_change',
          entityType: 'service_request',
          entityId: input.id,
          before: { status: existing.status },
          after: { status: input.status },
        },
      });
      return u;
    });

    return { id: updated.id, status: updated.status };
  }
}
