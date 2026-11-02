import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { TRPCError } from '@trpc/server';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from './notification.service';

export type AnnouncementAudienceInput = 'all' | 'organization' | 'customer_group';

export interface CreateAnnouncementInput {
  title: string;
  body: string;
  audience: AnnouncementAudienceInput;
  orgIds?: string[];
  groupIds?: string[];
  expiresAt?: Date;
}

interface Actor {
  id: string;
  memberships: { orgId: string }[];
}

@Injectable()
export class AnnouncementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
  ) {}

  /** Müşterinin ana ekranı: yayında, süresi dolmamış ve kendisine hedeflenmiş duyurular. */
  async listForUser(actor: Actor) {
    const orgIds = [...new Set(actor.memberships.map((m) => m.orgId))];
    const groups = await this.prisma.customerGroupMember.findMany({
      where: { orgId: { in: orgIds } },
      select: { groupId: true },
    });
    const groupIds = groups.map((g) => g.groupId);
    const now = new Date();

    const rows = await this.prisma.announcement.findMany({
      where: {
        publishedAt: { lte: now },
        AND: [
          { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
          {
            OR: [
              { audience: 'all' },
              { audience: 'organization', targets: { some: { orgId: { in: orgIds } } } },
              { audience: 'customer_group', targets: { some: { groupId: { in: groupIds } } } },
            ],
          },
        ],
      },
      orderBy: { publishedAt: 'desc' },
      take: 30,
    });
    return rows.map((a) => ({
      id: a.id,
      title: a.title,
      body: a.body,
      publishedAt: a.publishedAt,
      expiresAt: a.expiresAt,
    }));
  }

  /** Yönetim listesi: yayındaki ve süresi dolmuş tüm duyurular. */
  async listAll() {
    const rows = await this.prisma.announcement.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { _count: { select: { targets: true } } },
    });
    return rows.map((a) => ({
      id: a.id,
      title: a.title,
      body: a.body,
      audience: a.audience,
      targetCount: a._count.targets,
      publishedAt: a.publishedAt,
      expiresAt: a.expiresAt,
      expired: a.expiresAt != null && a.expiresAt <= new Date(),
    }));
  }

  async create(input: CreateAnnouncementInput, actor: { id: string }) {
    const orgIds = input.orgIds ?? [];
    const groupIds = input.groupIds ?? [];
    if (input.audience === 'organization' && orgIds.length === 0) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'En az bir müşteri seçin.' });
    }
    if (input.audience === 'customer_group' && groupIds.length === 0) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'En az bir müşteri grubu seçin.' });
    }

    const targets: Prisma.AnnouncementTargetCreateWithoutAnnouncementInput[] = [
      ...(input.audience === 'organization' ? orgIds.map((id) => ({ org: { connect: { id } } })) : []),
      ...(input.audience === 'customer_group' ? groupIds.map((groupId) => ({ groupId })) : []),
    ];

    const created = await this.prisma.announcement.create({
      data: {
        title: input.title,
        body: input.body,
        audience: input.audience,
        publishedAt: new Date(),
        expiresAt: input.expiresAt,
        createdBy: actor.id,
        targets: { create: targets },
      },
    });

    const recipients = await this.recipients(input.audience, orgIds, groupIds);
    await this.notifications.notifyUsers(recipients, {
      type: 'announcement',
      title: input.title,
      body: input.body.length > 140 ? `${input.body.slice(0, 137)}...` : input.body,
      data: { announcementId: created.id },
    });

    return { id: created.id };
  }

  async remove(id: string): Promise<{ ok: true }> {
    await this.prisma.announcement.deleteMany({ where: { id } });
    return { ok: true };
  }

  private async recipients(
    audience: AnnouncementAudienceInput,
    orgIds: string[],
    groupIds: string[],
  ): Promise<string[]> {
    if (audience === 'organization') return this.notifications.orgUsers(orgIds);
    if (audience === 'customer_group') {
      const members = await this.prisma.customerGroupMember.findMany({
        where: { groupId: { in: groupIds } },
        select: { orgId: true },
      });
      return this.notifications.orgUsers([...new Set(members.map((m) => m.orgId))]);
    }
    const customers = await this.prisma.membership.findMany({
      where: {
        status: 'active',
        role: { in: ['customer_admin', 'branch_manager', 'customer_user'] },
      },
      select: { userId: true },
    });
    return [...new Set(customers.map((c) => c.userId))];
  }
}
