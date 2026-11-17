import { ROLES } from '@rc/shared';
import { z } from 'zod';
import type { MembershipService } from '../../membership/membership.service';
import { capabilityProcedure, router } from '../trpc';

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
  role: z.enum(ROLES).optional(),
  reviewNote: z.string().max(2000).optional(),
});

const peopleInput = z
  .object({
    search: z.string().max(120).optional(),
    kind: z.enum(['staff', 'customer']).optional(),
    limit: z.number().int().min(1).max(100).optional(),
    cursor: z.string().uuid().optional(),
  })
  .default({});

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

    people: capabilityProcedure('staff.manage')
      .input(peopleInput)
      .query(({ input }) => membership.people(input)),

    setMembership: capabilityProcedure('staff.manage')
      .input(
        z.object({
          membershipId: z.string().uuid(),
          role: z.enum(ROLES).optional(),
          status: z.enum(['active', 'suspended']).optional(),
          maxDiscountPct: z.number().min(0).max(100).optional(),
        }),
      )
      .mutation(({ input, ctx }) => membership.setMembership(input, ctx.user)),

    setUserActive: capabilityProcedure('staff.manage')
      .input(z.object({ userId: z.string().uuid(), active: z.boolean() }))
      .mutation(({ input, ctx }) => membership.setUserActive(input, ctx.user)),

    removeMembership: capabilityProcedure('staff.manage')
      .input(z.object({ membershipId: z.string().uuid() }))
      .mutation(({ input, ctx }) => membership.removeMembership(input.membershipId, ctx.user)),

    addStaff: capabilityProcedure('staff.manage')
      .input(
        z.object({
          phone: z.string().min(7).max(30),
          fullName: z.string().max(200).optional(),
          role: z.enum(ROLES),
        }),
      )
      .mutation(({ input, ctx }) => membership.addStaff(input, ctx.user)),

    reject: capabilityProcedure('membership.review')
      .input(rejectInput)
      .mutation(({ input, ctx }) => membership.reject(input.id, ctx.user, input.reviewNote)),
  });
}
