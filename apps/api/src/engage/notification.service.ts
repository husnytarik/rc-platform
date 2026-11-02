import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Prisma, Role } from '@prisma/client';
import type { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';

export interface NotifyPayload {
  type: string;
  title: string;
  body: string;
  /** Uygulama içi yönlendirme: { orderId, ticketId, ... } */
  data?: Record<string, string>;
}

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/**
 * Bildirim kutusu (in_app) + Expo push. Önce veritabanına yazar, sonra cihazlara
 * iter; push hatası bildirimi düşürmez (kutuda kalır).
 */
@Injectable()
export class NotificationService {
  private readonly log = new Logger(NotificationService.name);
  private readonly expoToken?: string;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService<Env, true>,
  ) {
    this.expoToken = config.get('EXPO_ACCESS_TOKEN', { infer: true }) || undefined;
  }

  // ── Alıcı çözümleme ────────────────────────────────────────────────────────

  /** Üretici firmasındaki verilen rollerdeki aktif kullanıcılar. */
  async producerUsersByRole(roles: Role[]): Promise<string[]> {
    const rows = await this.prisma.membership.findMany({
      where: { role: { in: roles }, status: 'active', org: { type: 'producer' } },
      select: { userId: true },
    });
    return [...new Set(rows.map((r) => r.userId))];
  }

  /** Bir müşteri firmasının tüm aktif kullanıcıları. */
  async orgUsers(orgIds: string[]): Promise<string[]> {
    if (orgIds.length === 0) return [];
    const rows = await this.prisma.membership.findMany({
      where: { orgId: { in: orgIds }, status: 'active' },
      select: { userId: true },
    });
    return [...new Set(rows.map((r) => r.userId))];
  }

  // ── Gönderim ───────────────────────────────────────────────────────────────

  async notifyUsers(userIds: string[], payload: NotifyPayload): Promise<void> {
    const unique = [...new Set(userIds)];
    if (unique.length === 0) return;

    await this.prisma.$transaction(async (tx) => {
      for (const userId of unique) {
        await tx.notification.create({
          data: {
            userId,
            type: payload.type,
            title: payload.title,
            body: payload.body,
            data: (payload.data ?? {}) as Prisma.InputJsonValue,
            deliveries: { create: { channel: 'in_app', status: 'sent', attemptedAt: new Date() } },
          },
        });
      }
    });

    await this.push(unique, payload).catch((e: unknown) => {
      this.log.warn(`Push gönderilemedi: ${(e as Error).message}`);
    });
  }

  private async push(userIds: string[], payload: NotifyPayload): Promise<void> {
    const devices = await this.prisma.deviceToken.findMany({
      where: { userId: { in: userIds }, isActive: true },
      select: { id: true, token: true },
    });
    if (devices.length === 0) return;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (this.expoToken) headers['Authorization'] = `Bearer ${this.expoToken}`;

    // Expo tek istekte en fazla 100 mesaj kabul eder.
    for (let i = 0; i < devices.length; i += 100) {
      const chunk = devices.slice(i, i + 100);
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify(
          chunk.map((d) => ({
            to: d.token,
            title: payload.title,
            body: payload.body,
            data: { type: payload.type, ...(payload.data ?? {}) },
            sound: 'default',
          })),
        ),
      });
      if (!res.ok) {
        this.log.warn(`Expo push HTTP ${res.status}`);
        continue;
      }
      const json = (await res.json()) as { data?: { status: string; details?: { error?: string } }[] };
      const dead: string[] = [];
      (json.data ?? []).forEach((t, idx) => {
        if (t.status === 'error' && t.details?.error === 'DeviceNotRegistered') {
          const d = chunk[idx];
          if (d) dead.push(d.id);
        }
      });
      if (dead.length > 0) {
        await this.prisma.deviceToken.updateMany({
          where: { id: { in: dead } },
          data: { isActive: false },
        });
      }
    }
  }

  // ── Bildirim kutusu ────────────────────────────────────────────────────────

  async inbox(userId: string, input: { limit?: number; cursor?: string }) {
    const limit = Math.min(Math.max(input.limit ?? 30, 1), 100);
    const rows = await this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > limit;
    const items = (hasMore ? rows.slice(0, limit) : rows).map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      data: (n.data ?? {}) as Record<string, string>,
      read: n.readAt != null,
      createdAt: n.createdAt,
    }));
    return { items, nextCursor: hasMore ? (items[items.length - 1]?.id ?? null) : null };
  }

  unreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({ where: { userId, readAt: null } });
  }

  async markRead(userId: string, ids?: string[]): Promise<{ updated: number }> {
    const r = await this.prisma.notification.updateMany({
      where: { userId, readAt: null, ...(ids ? { id: { in: ids } } : {}) },
      data: { readAt: new Date() },
    });
    return { updated: r.count };
  }

  // ── Cihaz kaydı ────────────────────────────────────────────────────────────

  async registerDevice(
    userId: string,
    input: { token: string; platform: 'ios' | 'android' | 'web'; deviceName?: string },
  ): Promise<{ ok: true }> {
    await this.prisma.deviceToken.upsert({
      where: { token: input.token },
      create: {
        userId,
        token: input.token,
        platform: input.platform,
        deviceName: input.deviceName,
      },
      // Aynı cihaza başka hesap girdiyse jeton yeni kullanıcıya geçer.
      update: { userId, isActive: true, lastSeenAt: new Date(), deviceName: input.deviceName },
    });
    return { ok: true };
  }

  async unregisterDevice(userId: string, token: string): Promise<{ ok: true }> {
    await this.prisma.deviceToken.updateMany({ where: { userId, token }, data: { isActive: false } });
    return { ok: true };
  }
}
