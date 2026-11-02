import { Injectable } from '@nestjs/common';
import type { Prisma, TicketStatus } from '@prisma/client';
import { TRPCError } from '@trpc/server';
import { PRODUCER_ROLES, type Role } from '@rc/shared';
import { PrismaService } from '../prisma/prisma.service';

export interface TicketActor {
  id: string;
  roles: Role[];
  memberships: { orgId: string; role: Role }[];
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class TicketService {
  constructor(private readonly prisma: PrismaService) {}

  private isStaff(actor: TicketActor): boolean {
    return actor.roles.some((r) => PRODUCER_ROLES.includes(r));
  }

  private customerOrgIds(actor: TicketActor): string[] {
    return [
      ...new Set(
        actor.memberships.filter((m) => !PRODUCER_ROLES.includes(m.role)).map((m) => m.orgId),
      ),
    ];
  }

  /** Müşteri yalnızca kendi firmasının talebini, personel hepsini görür. */
  private scopeWhere(actor: TicketActor): Prisma.TicketWhereInput {
    if (this.isStaff(actor)) return {};
    const orgIds = this.customerOrgIds(actor);
    return { orgId: { in: orgIds.length ? orgIds : ['00000000-0000-0000-0000-000000000000'] } };
  }

  // ── Oluşturma ──────────────────────────────────────────────────────────────

  async create(
    input: { subject: string; body: string; orderRef?: string },
    actor: TicketActor,
  ) {
    const orgId = this.customerOrgIds(actor)[0];
    if (!orgId) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Destek talebi yalnızca müşteri hesabından açılır.',
      });
    }

    let orderId: string | undefined;
    if (input.orderRef) {
      const ref = input.orderRef.trim();
      const order = await this.prisma.order.findFirst({
        where: UUID_RE.test(ref) ? { id: ref, customerOrgId: orgId } : { keyCode: ref, customerOrgId: orgId },
        select: { id: true },
      });
      if (!order) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Bu sipariş kodu hesabınızda bulunamadı.' });
      }
      orderId = order.id;
    }

    const ticket = await this.prisma.$transaction(async (tx) => {
      const year = new Date().getFullYear();
      const counter = await tx.counter.upsert({
        where: { key: `ticket:${year}` },
        create: { key: `ticket:${year}`, value: 1n },
        update: { value: { increment: 1n } },
      });
      const keyCode = `DST-${year}-${String(counter.value).padStart(6, '0')}`;
      const t = await tx.ticket.create({
        data: {
          keyCode,
          orgId,
          orderId,
          subject: input.subject,
          status: 'pending_staff',
          openedBy: actor.id,
          messages: { create: { authorId: actor.id, body: input.body } },
        },
      });
      await tx.outboxEvent.create({
        data: {
          topic: 'ticket.created',
          payload: { ticketId: t.id, keyCode, orgId, subject: input.subject },
        },
      });
      return t;
    });

    return { id: ticket.id, keyCode: ticket.keyCode };
  }

  // ── Okuma ──────────────────────────────────────────────────────────────────

  async list(input: { status?: TicketStatus; limit?: number }, actor: TicketActor) {
    const rows = await this.prisma.ticket.findMany({
      where: { ...this.scopeWhere(actor), ...(input.status ? { status: input.status } : {}) },
      orderBy: { updatedAt: 'desc' },
      take: Math.min(Math.max(input.limit ?? 50, 1), 100),
      include: { order: { select: { keyCode: true } }, _count: { select: { messages: true } } },
    });
    const orgs = await this.prisma.organization.findMany({
      where: { id: { in: [...new Set(rows.map((r) => r.orgId))] } },
      select: { id: true, name: true },
    });
    const orgName = new Map(orgs.map((o) => [o.id, o.name]));
    return rows.map((t) => ({
      id: t.id,
      keyCode: t.keyCode,
      subject: t.subject,
      status: t.status,
      orgName: orgName.get(t.orgId) ?? '',
      orderKeyCode: t.order?.keyCode ?? null,
      messageCount: t._count.messages,
      updatedAt: t.updatedAt,
    }));
  }

  async get(ref: string, actor: TicketActor) {
    const staff = this.isStaff(actor);
    const ticket = await this.prisma.ticket.findFirst({
      where: { ...(UUID_RE.test(ref) ? { id: ref } : { keyCode: ref }), ...this.scopeWhere(actor) },
      include: {
        order: { select: { keyCode: true } },
        messages: {
          where: staff ? {} : { isInternal: false },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!ticket) throw new TRPCError({ code: 'NOT_FOUND', message: 'Talep bulunamadı.' });

    const authorIds = [...new Set(ticket.messages.map((m) => m.authorId).filter((x): x is string => !!x))];
    const authors = await this.prisma.user.findMany({
      where: { id: { in: authorIds } },
      select: {
        id: true,
        fullName: true,
        memberships: { where: { status: 'active' }, select: { role: true } },
      },
    });
    const authorInfo = new Map(
      authors.map((a) => [
        a.id,
        {
          name: a.fullName ?? 'Kullanıcı',
          staff: a.memberships.some((m) => PRODUCER_ROLES.includes(m.role as Role)),
        },
      ]),
    );
    const org = await this.prisma.organization.findUnique({
      where: { id: ticket.orgId },
      select: { name: true },
    });

    return {
      id: ticket.id,
      keyCode: ticket.keyCode,
      subject: ticket.subject,
      status: ticket.status,
      orgName: org?.name ?? '',
      orderKeyCode: ticket.order?.keyCode ?? null,
      createdAt: ticket.createdAt,
      messages: ticket.messages.map((m) => {
        const a = m.authorId ? authorInfo.get(m.authorId) : undefined;
        return {
          id: m.id,
          body: m.body,
          internal: m.isInternal,
          authorName: a?.name ?? 'Kullanıcı',
          fromStaff: a?.staff ?? false,
          createdAt: m.createdAt,
        };
      }),
    };
  }

  // ── Yanıt / durum ──────────────────────────────────────────────────────────

  async reply(ref: string, input: { body: string; internal?: boolean }, actor: TicketActor) {
    const staff = this.isStaff(actor);
    const ticket = await this.prisma.ticket.findFirst({
      where: { ...(UUID_RE.test(ref) ? { id: ref } : { keyCode: ref }), ...this.scopeWhere(actor) },
      select: { id: true, keyCode: true, orgId: true, status: true },
    });
    if (!ticket) throw new TRPCError({ code: 'NOT_FOUND', message: 'Talep bulunamadı.' });
    if (ticket.status === 'closed') {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Kapatılmış talebe yanıt verilemez.' });
    }
    const internal = staff && input.internal === true;

    await this.prisma.$transaction(async (tx) => {
      await tx.ticketMessage.create({
        data: { ticketId: ticket.id, authorId: actor.id, body: input.body, isInternal: internal },
      });
      // Dahili not durumu değiştirmez ve müşteriye bildirim gitmez.
      if (internal) return;
      await tx.ticket.update({
        where: { id: ticket.id },
        data: { status: staff ? 'pending_customer' : 'pending_staff' },
      });
      await tx.outboxEvent.create({
        data: {
          topic: 'ticket.replied',
          payload: {
            ticketId: ticket.id,
            keyCode: ticket.keyCode,
            orgId: ticket.orgId,
            byStaff: staff,
          },
        },
      });
    });
    return { ok: true as const };
  }

  async setStatus(ref: string, status: TicketStatus, actor: TicketActor) {
    if (!this.isStaff(actor)) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Durumu yalnızca personel değiştirebilir.' });
    }
    const ticket = await this.prisma.ticket.findFirst({
      where: UUID_RE.test(ref) ? { id: ref } : { keyCode: ref },
      select: { id: true, keyCode: true, orgId: true },
    });
    if (!ticket) throw new TRPCError({ code: 'NOT_FOUND', message: 'Talep bulunamadı.' });
    await this.prisma.$transaction(async (tx) => {
      await tx.ticket.update({ where: { id: ticket.id }, data: { status, assignedTo: actor.id } });
      if (status === 'resolved' || status === 'closed') {
        await tx.outboxEvent.create({
          data: {
            topic: 'ticket.resolved',
            payload: { ticketId: ticket.id, keyCode: ticket.keyCode, orgId: ticket.orgId },
          },
        });
      }
    });
    return { ok: true as const };
  }
}
