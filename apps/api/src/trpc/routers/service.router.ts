import { SERVICE_REQUEST_STATUSES, type ServiceRequestStatus } from '@rc/shared';
import { z } from 'zod';
import type { ServicesService } from '../../services/services.service';
import { capabilityAnyProcedure, capabilityProcedure, router } from '../trpc';

const statusEnum = z.enum(
  [...SERVICE_REQUEST_STATUSES] as [ServiceRequestStatus, ...ServiceRequestStatus[]],
);

const createInput = z.object({
  code: z.string().min(1).max(60),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  basePrice: z.number().finite().nonnegative().optional(),
});

const updateInput = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  basePrice: z.number().finite().nonnegative().nullable().optional(),
  isActive: z.boolean().optional(),
});

const createRequestInput = z.object({
  serviceId: z.string().uuid(),
  note: z.string().max(2000).optional(),
});

const listRequestsInput = z
  .object({
    status: statusEnum.optional(),
    limit: z.number().int().min(1).max(100).optional(),
    cursor: z.string().uuid().optional(),
  })
  .default({});

const updateRequestStatusInput = z.object({
  id: z.string().uuid(),
  status: statusEnum,
});

/**
 * Servis kataloğu + talep formu uçları. Katalog yönetimi ve talep durumu
 * `service.manage` şart (producer_admin, sales_staff). Talep oluşturma
 * `order.create` ile aynı roller (müşteri tarafı); listeleme sipariş
 * görünürlüğüyle aynı desende: kendi firması (view.own) ya da tümü (view.all).
 */
export function makeServiceRouter(services: ServicesService) {
  const viewCaps = ['order.view.own', 'order.view.all'] as const;

  return router({
    listActive: capabilityProcedure('catalog.view').query(() => services.listActive()),

    adminList: capabilityProcedure('service.manage').query(() => services.adminList()),

    create: capabilityProcedure('service.manage')
      .input(createInput)
      .mutation(({ input }) => services.create(input)),

    update: capabilityProcedure('service.manage')
      .input(updateInput)
      .mutation(({ input }) => services.update(input)),

    createRequest: capabilityProcedure('order.create')
      .input(createRequestInput)
      .mutation(({ input, ctx }) =>
        services.createRequest(input, {
          id: ctx.user.id,
          roles: ctx.user.roles,
          orgIds: ctx.user.memberships.map((m) => m.orgId),
        }),
      ),

    listRequests: capabilityAnyProcedure(viewCaps)
      .input(listRequestsInput)
      .query(({ input, ctx }) =>
        services.listRequests(input, {
          roles: ctx.user.roles,
          orgIds: ctx.user.memberships.map((m) => m.orgId),
        }),
      ),

    updateRequestStatus: capabilityProcedure('service.manage')
      .input(updateRequestStatusInput)
      .mutation(({ input, ctx }) =>
        services.updateRequestStatus(input, {
          id: ctx.user.id,
          roles: ctx.user.roles,
          orgIds: ctx.user.memberships.map((m) => m.orgId),
        }),
      ),
  });
}
