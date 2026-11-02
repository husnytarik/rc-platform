import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import type { Role } from '@prisma/client';
import { ORDER_STATUS_LABELS_TR, type OrderStatus } from '@rc/shared';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService, type NotifyPayload } from './notification.service';

const POLL_MS = 5_000;
const MAX_ATTEMPTS = 5;
/** Bundan eski olaylar için bildirim üretilmez (yeniden dağıtım sonrası eski test olayları). */
const STALE_MS = 60 * 60 * 1000;

type Payload = Record<string, unknown>;

interface Target {
  userIds: string[];
  notice: NotifyPayload;
}

/**
 * Transactional outbox tüketicisi: sipariş/destek/üyelik olaylarını role göre
 * bildirime çevirir. Tek örnek (Render free) için basit bir yoklama döngüsü yeterli.
 */
@Injectable()
export class OutboxProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(OutboxProcessor.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (process.env['NODE_ENV'] === 'test') return;
    // Çöken önceki süreçten kalan "processing" olayları tekrar kuyruğa al.
    await this.prisma.outboxEvent.updateMany({
      where: { status: 'processing' },
      data: { status: 'pending' },
    });
    this.timer = setInterval(() => void this.tick(), POLL_MS);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const events = await this.prisma.outboxEvent.findMany({
        where: { status: 'pending', availableAt: { lte: new Date() } },
        orderBy: { createdAt: 'asc' },
        take: 25,
      });
      for (const ev of events) {
        const claimed = await this.prisma.outboxEvent.updateMany({
          where: { id: ev.id, status: 'pending' },
          data: { status: 'processing' },
        });
        if (claimed.count === 0) continue;
        try {
          if (Date.now() - ev.createdAt.getTime() <= STALE_MS) {
            const target = await this.resolve(ev.topic, ev.payload as Payload);
            if (target) await this.notifications.notifyUsers(target.userIds, target.notice);
          }
          await this.prisma.outboxEvent.update({
            where: { id: ev.id },
            data: { status: 'done', processedAt: new Date() },
          });
        } catch (e) {
          const attempts = ev.attempts + 1;
          this.log.warn(`Outbox ${ev.topic} başarısız (${attempts}): ${(e as Error).message}`);
          await this.prisma.outboxEvent.update({
            where: { id: ev.id },
            data: {
              attempts,
              lastError: (e as Error).message.slice(0, 500),
              status: attempts >= MAX_ATTEMPTS ? 'failed' : 'pending',
              availableAt: new Date(Date.now() + 60_000 * attempts),
            },
          });
        }
      }
    } catch (e) {
      this.log.error(`Outbox döngüsü hatası: ${(e as Error).message}`);
    } finally {
      this.running = false;
    }
  }

  private staff(roles: Role[]): Promise<string[]> {
    return this.notifications.producerUsersByRole(roles);
  }

  private async resolve(topic: string, p: Payload): Promise<Target | null> {
    const str = (k: string): string => String(p[k] ?? '');

    switch (topic) {
      case 'order.placed': {
        const userIds = await this.staff(['producer_admin', 'sales_staff']);
        return {
          userIds,
          notice: {
            type: 'order.placed',
            title: 'Yeni sipariş',
            body: `${str('keyCode')} onay bekliyor.`,
            data: { orderId: str('orderId') },
          },
        };
      }

      case 'order.status_changed': {
        const to = str('to') as OrderStatus;
        const label = ORDER_STATUS_LABELS_TR[to] ?? to;
        const order = await this.prisma.order.findUnique({
          where: { id: str('orderId') },
          select: { customerOrgId: true },
        });
        const customers = order ? await this.notifications.orgUsers([order.customerOrgId]) : [];
        // Bir sonraki aşamanın sorumlusuna da haber ver.
        const next: Partial<Record<OrderStatus, Role[]>> = {
          confirmed: ['production_staff'],
          ready_to_ship: ['shipping_staff'],
          delivery_issue: ['producer_admin', 'sales_staff'],
          cancelled: ['producer_admin'],
        };
        const nextRoles = next[to] ?? [];
        const staffIds = nextRoles.length ? await this.staff(nextRoles) : [];
        const data = { orderId: str('orderId') };

        if (staffIds.length) {
          await this.notifications.notifyUsers(staffIds, {
            type: 'order.status',
            title: `${str('keyCode')} · ${label}`,
            body:
              to === 'confirmed'
                ? 'Üretime alınmayı bekliyor.'
                : to === 'ready_to_ship'
                  ? 'Sevkiyata hazır.'
                  : 'Sipariş dikkat bekliyor.',
            data,
          });
        }
        return {
          userIds: customers,
          notice: {
            type: 'order.status',
            title: `Siparişiniz: ${label}`,
            body: `${str('keyCode')} numaralı siparişinizin durumu güncellendi.`,
            data,
          },
        };
      }

      case 'order.line_added': {
        const order = await this.prisma.order.findUnique({
          where: { id: str('orderId') },
          select: { customerOrgId: true },
        });
        if (!order) return null;
        return {
          userIds: await this.notifications.orgUsers([order.customerOrgId]),
          notice: {
            type: 'order.line_added',
            title: 'Siparişinize kalem eklendi',
            body: `${str('keyCode')}: ${str('name')}`,
            data: { orderId: str('orderId') },
          },
        };
      }

      case 'membership.approved':
        return {
          userIds: [str('userId')],
          notice: {
            type: 'membership',
            title: 'Başvurun onaylandı',
            body: 'Artık katalogu görüp sipariş verebilirsin.',
          },
        };

      case 'membership.rejected':
        return {
          userIds: [str('userId')],
          notice: {
            type: 'membership',
            title: 'Başvurun sonuçlandı',
            body: 'Başvurun onaylanamadı. Detay için bizimle iletişime geç.',
          },
        };

      case 'membership.requested':
        return {
          userIds: await this.staff(['producer_admin', 'sales_staff']),
          notice: {
            type: 'membership.requested',
            title: 'Yeni üyelik başvurusu',
            body: `${str('orgName')} başvuru yaptı.`,
          },
        };

      case 'ticket.created':
        return {
          userIds: await this.staff(['producer_admin', 'sales_staff']),
          notice: {
            type: 'ticket',
            title: 'Yeni destek talebi',
            body: `${str('keyCode')} · ${str('subject')}`,
            data: { ticketId: str('ticketId') },
          },
        };

      case 'ticket.replied': {
        const byStaff = p['byStaff'] === true;
        return {
          userIds: byStaff
            ? await this.notifications.orgUsers([str('orgId')])
            : await this.staff(['producer_admin', 'sales_staff']),
          notice: {
            type: 'ticket',
            title: byStaff ? 'Destek talebinize yanıt geldi' : 'Müşteriden yeni mesaj',
            body: str('keyCode'),
            data: { ticketId: str('ticketId') },
          },
        };
      }

      case 'ticket.resolved':
        return {
          userIds: await this.notifications.orgUsers([str('orgId')]),
          notice: {
            type: 'ticket',
            title: 'Destek talebiniz çözüldü',
            body: str('keyCode'),
            data: { ticketId: str('ticketId') },
          },
        };

      default:
        return null;
    }
  }
}
