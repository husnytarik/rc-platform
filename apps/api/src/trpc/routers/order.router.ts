import { ORDER_STATUSES, type OrderStatus } from '@rc/shared';
import { z } from 'zod';
import type { OrderService } from '../../orders/order.service';
import { capabilityAnyProcedure, capabilityProcedure, router } from '../trpc';

const statusEnum = z.enum([...ORDER_STATUSES] as [OrderStatus, ...OrderStatus[]]);

const createInput = z.object({
  branchId: z.string().uuid(),
  note: z.string().max(2000).optional(),
  lines: z
    .array(
      z.object({
        variantId: z.string().uuid(),
        qty: z.number().positive().max(1_000_000),
      }),
    )
    .min(1)
    .max(200),
});

const orderRef = z
  .string()
  .min(1)
  .max(40)
  .describe('Sipariş id (uuid) veya anahtar kod (RC-2026-000123)');

const listInput = z
  .object({
    status: statusEnum.optional(),
    limit: z.number().int().min(1).max(100).optional(),
    cursor: z.string().uuid().optional(),
  })
  .default({});

const transitionInput = z.object({
  order: orderRef,
  to: statusEnum,
  note: z.string().max(2000).optional(),
});

/** Sipariş uçları. Görünüm/kapsam `ctx.user`'dan; istemci org/rol gönderemez. */
export function makeOrderRouter(orders: OrderService) {
  const viewCaps = ['order.view.own', 'order.view.all'] as const;
  const transitionCaps = [
    'order.confirm',
    'order.cancel',
    'production.advance',
    'shipping.advance',
  ] as const;

  return router({
    create: capabilityProcedure('order.create')
      .input(createInput)
      .mutation(({ input, ctx }) => orders.createOrder(input, ctx.user)),

    myBranches: capabilityProcedure('order.create').query(({ ctx }) => orders.myBranches(ctx.user)),

    list: capabilityAnyProcedure(viewCaps)
      .input(listInput)
      .query(({ input, ctx }) => orders.listOrders(input, ctx.user)),

    get: capabilityAnyProcedure(viewCaps)
      .input(z.object({ order: orderRef }))
      .query(({ input, ctx }) => orders.getOrder(input.order, ctx.user)),

    addLine: capabilityProcedure('order.add_line')
      .input(
        z.object({
          order: orderRef,
          variantId: z.string().uuid(),
          qty: z.number().positive().max(1_000_000),
          note: z.string().max(500).optional(),
        }),
      )
      .mutation(({ input, ctx }) =>
        orders.addLine(
          input.order,
          { variantId: input.variantId, qty: input.qty, note: input.note },
          ctx.user,
        ),
      ),

    transition: capabilityAnyProcedure(transitionCaps)
      .input(transitionInput)
      .mutation(({ input, ctx }) =>
        orders.transition(input.order, input.to, ctx.user, input.note),
      ),
  });
}
