import { z } from 'zod';
import type { AnnouncementService } from '../../engage/announcement.service';
import { capabilityProcedure, protectedProcedure, router } from '../trpc';

const createInput = z.object({
  title: z.string().trim().min(2).max(120),
  body: z.string().trim().min(2).max(4000),
  audience: z.enum(['all', 'organization', 'customer_group']),
  orgIds: z.array(z.string().uuid()).max(500).optional(),
  groupIds: z.array(z.string().uuid()).max(100).optional(),
  expiresAt: z.coerce.date().optional(),
});

export function makeAnnouncementRouter(announcements: AnnouncementService) {
  return router({
    /** Müşteri ana ekranı — kullanıcıya hedeflenmiş yayındaki duyurular. */
    feed: protectedProcedure.query(({ ctx }) => announcements.listForUser(ctx.user)),

    list: capabilityProcedure('announcement.manage').query(() => announcements.listAll()),

    create: capabilityProcedure('announcement.manage')
      .input(createInput)
      .mutation(({ input, ctx }) => announcements.create(input, ctx.user)),

    remove: capabilityProcedure('announcement.manage')
      .input(z.object({ id: z.string().uuid() }))
      .mutation(({ input }) => announcements.remove(input.id)),
  });
}
