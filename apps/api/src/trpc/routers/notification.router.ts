import { z } from 'zod';
import type { NotificationService } from '../../engage/notification.service';
import { protectedProcedure, router } from '../trpc';

export function makeNotificationRouter(notifications: NotificationService) {
  return router({
    inbox: protectedProcedure
      .input(
        z
          .object({
            limit: z.number().int().min(1).max(100).optional(),
            cursor: z.string().uuid().optional(),
          })
          .default({}),
      )
      .query(({ input, ctx }) => notifications.inbox(ctx.user.id, input)),

    unreadCount: protectedProcedure.query(({ ctx }) => notifications.unreadCount(ctx.user.id)),

    markRead: protectedProcedure
      .input(z.object({ ids: z.array(z.string().uuid()).max(200).optional() }).default({}))
      .mutation(({ input, ctx }) => notifications.markRead(ctx.user.id, input.ids)),

    registerDevice: protectedProcedure
      .input(
        z.object({
          token: z.string().min(10).max(200),
          platform: z.enum(['ios', 'android', 'web']),
          deviceName: z.string().max(100).optional(),
        }),
      )
      .mutation(({ input, ctx }) => notifications.registerDevice(ctx.user.id, input)),

    unregisterDevice: protectedProcedure
      .input(z.object({ token: z.string().min(10).max(200) }))
      .mutation(({ input, ctx }) => notifications.unregisterDevice(ctx.user.id, input.token)),
  });
}
