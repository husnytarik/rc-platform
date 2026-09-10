import { z } from 'zod';
import type { MembershipService } from '../../membership/membership.service';
import { capabilityProcedure, router } from '../trpc';

const CUSTOMER_ROLES = ['customer_admin', 'branch_manager', 'customer_user'] as const;

const listInput = z
  .object({
    status: z.enum(['pending', 'approved', 'rejected']).optional(),
    limit: z.number().int().min(1).max(100).optional(),
    cursor: z.string().uuid().optional(),
  })
  .default({});

const idInput = z.object({ id: z.string().uuid() });

const approveInput = z.object({
  id: z.string().uuid(),
  role: z.enum(CUSTOMER_ROLES).optional(),
  reviewNote: z.string().max(2000).optional(),
});

const rejectInput = z.object({
  id: z.string().uuid(),
  reviewNote: z.string().min(3).max(2000),
});

/**
 * Üyelik başvurusu inceleme uçları. `membership.review` yetkisi şart
 * (producer_admin, sales_staff). Onay yeni müşteri org + şube + üyelik yaratır.
 */
export function makeMembershipRouter(membership: MembershipService) {
  return router({
    requests: capabilityProcedure('membership.review')
      .input(listInput)
      .query(({ input }) => membership.listRequests(input)),

    request: capabilityProcedure('membership.review')
      .input(idInput)
      .query(({ input }) => membership.getRequest(input.id)),

    approve: capabilityProcedure('membership.review')
      .input(approveInput)
      .mutation(({ input, ctx }) =>
        membership.approve(input.id, ctx.user, {
          role: input.role,
          reviewNote: input.reviewNote,
        }),
      ),

    reject: capabilityProcedure('membership.review')
      .input(rejectInput)
      .mutation(({ input, ctx }) => membership.reject(input.id, ctx.user, input.reviewNote)),
  });
}
