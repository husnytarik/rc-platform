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

const updateInput = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200).optional(),
  taxId: z.string().max(40).nullable().optional(),
  phone: z.string().max(30).nullable().optional(),
  email: z.string().email().max(200).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
});

const updateBranchInput = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200).optional(),
  address: z.string().max(500).nullable().optional(),
  phone: z.string().max(30).nullable().optional(),
});

const customerRole = z.enum(['customer_admin', 'branch_manager', 'customer_user']);
const createCustomerInput = z.object({
  name: z.string().min(2).max(200),
  taxId: z.string().max(40).nullable().optional(),
  phone: z.string().max(30).nullable().optional(),
  email: z.string().email().max(200).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  branchName: z.string().max(200).optional(),
  adminName: z.string().max(200).optional(),
  adminPhone: z.string().max(30).optional(),
});
const createBranchInput = z.object({
  orgId: z.string().uuid(),
  name: z.string().min(1).max(200),
  address: z.string().max(500).nullable().optional(),
  phone: z.string().max(30).nullable().optional(),
});
const addMemberInput = z.object({
  orgId: z.string().uuid(),
  fullName: z.string().min(2).max(200),
  phone: z.string().min(7).max(30),
  role: customerRole,
  branchIds: z.array(z.string().uuid()).optional(),
});
const updateMemberInput = z.object({
  membershipId: z.string().uuid(),
  fullName: z.string().min(2).max(200).optional(),
  phone: z.string().min(7).max(30).optional(),
  role: customerRole.optional(),
  status: z.enum(['active', 'suspended']).optional(),
  branchIds: z.array(z.string().uuid()).optional(),
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

    update: capabilityProcedure('customer.manage')
      .input(updateInput)
      .mutation(({ input, ctx }) =>
        customer.update(input, {
          id: ctx.user.id,
          roles: ctx.user.roles,
          orgIds: ctx.user.memberships.map((m) => m.orgId),
        }),
      ),

    updateBranch: capabilityProcedure('customer.manage')
      .input(updateBranchInput)
      .mutation(({ input, ctx }) =>
        customer.updateBranch(input, {
          id: ctx.user.id,
          roles: ctx.user.roles,
          orgIds: ctx.user.memberships.map((m) => m.orgId),
        }),
      ),

    create: capabilityProcedure('customer.manage')
      .input(createCustomerInput)
      .mutation(({ input, ctx }) => customer.createCustomer(input, ctx.user)),

    createBranch: capabilityProcedure('customer.manage')
      .input(createBranchInput)
      .mutation(({ input, ctx }) => customer.createBranch(input, ctx.user)),

    addMember: capabilityProcedure('customer.manage')
      .input(addMemberInput)
      .mutation(({ input, ctx }) => customer.addMember(input, ctx.user)),

    updateMember: capabilityProcedure('customer.manage')
      .input(updateMemberInput)
      .mutation(({ input, ctx }) => customer.updateMember(input, ctx.user)),

    removeMember: capabilityProcedure('customer.manage')
      .input(z.object({ membershipId: z.string().uuid() }))
      .mutation(({ input, ctx }) => customer.removeMember(input.membershipId, ctx.user)),
  });
}
