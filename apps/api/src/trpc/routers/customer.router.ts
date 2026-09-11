import { z } from 'zod';
import type { CustomerService } from '../../customer/customer.service';
import { capabilityProcedure, router } from '../trpc';

const listInput = z
  .object({
    search: z.string().max(120).optional(),
    status: z.enum(['active', 'inactive']).optional(),
    limit: z.number().int().min(1).max(100).optional(),
    cursor: z.string().uuid().optional(),
  })
  .default({});

const idInput = z.object({ id: z.string().uuid() });

const setActiveInput = z.object({
  id: z.string().uuid(),
  isActive: z.boolean(),
});

/**
 * Müşteri firma yönetimi uçları. `customer.manage` yetkisi şart
 * (producer_admin, sales_staff). Firmalar üyelik onayında yaratılır;
 * burada listelenip görüntülenir, aktif/pasif alınır.
 */
export function makeCustomerRouter(customer: CustomerService) {
  return router({
    list: capabilityProcedure('customer.manage')
      .input(listInput)
      .query(({ input, ctx }) =>
        customer.list(input, {
          roles: ctx.user.roles,
          orgIds: ctx.user.memberships.map((m) => m.orgId),
        }),
      ),

    get: capabilityProcedure('customer.manage')
      .input(idInput)
      .query(({ input, ctx }) =>
        customer.get(input.id, {
          roles: ctx.user.roles,
          orgIds: ctx.user.memberships.map((m) => m.orgId),
        }),
      ),

    setActive: capabilityProcedure('customer.manage')
      .input(setActiveInput)
      .mutation(({ input, ctx }) => customer.setActive(input.id, input.isActive, ctx.user)),
  });
}
