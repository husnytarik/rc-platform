import { z } from 'zod';
import type { TicketService } from '../../engage/ticket.service';
import { capabilityProcedure, router } from '../trpc';

const ref = z.string().min(1).max(40).describe('Talep id (uuid) veya anahtar kod (DST-2026-000045)');
const statusEnum = z.enum(['open', 'pending_staff', 'pending_customer', 'resolved', 'closed']);

export function makeTicketRouter(tickets: TicketService) {
  return router({
    create: capabilityProcedure('ticket.handle')
      .input(
        z.object({
          subject: z.string().trim().min(3).max(150),
          body: z.string().trim().min(3).max(4000),
          orderRef: z.string().trim().max(40).optional(),
        }),
      )
      .mutation(({ input, ctx }) => tickets.create(input, ctx.user)),

    list: capabilityProcedure('ticket.handle')
      .input(z.object({ status: statusEnum.optional(), limit: z.number().int().min(1).max(100).optional() }).default({}))
      .query(({ input, ctx }) => tickets.list(input, ctx.user)),

    get: capabilityProcedure('ticket.handle')
      .input(z.object({ ticket: ref }))
      .query(({ input, ctx }) => tickets.get(input.ticket, ctx.user)),

    reply: capabilityProcedure('ticket.handle')
      .input(
        z.object({
          ticket: ref,
          body: z.string().trim().min(1).max(4000),
          internal: z.boolean().optional(),
        }),
      )
      .mutation(({ input, ctx }) =>
        tickets.reply(input.ticket, { body: input.body, internal: input.internal }, ctx.user),
      ),

    setStatus: capabilityProcedure('ticket.handle')
      .input(z.object({ ticket: ref, status: statusEnum }))
      .mutation(({ input, ctx }) => tickets.setStatus(input.ticket, input.status, ctx.user)),
  });
}
