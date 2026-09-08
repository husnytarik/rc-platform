import { z } from 'zod';
import type { CatalogService } from '../../catalog/catalog.service';
import { capabilityProcedure, router } from '../trpc';

const listInput = z
  .object({
    categorySlug: z.string().min(1).max(120).optional(),
    search: z.string().min(1).max(120).optional(),
    limit: z.number().int().min(1).max(100).optional(),
    cursor: z.string().uuid().optional(),
  })
  .default({});

const productInput = z
  .object({
    id: z.string().uuid().optional(),
    slug: z.string().min(1).max(160).optional(),
  })
  .refine((v) => Boolean(v.id) || Boolean(v.slug), {
    message: 'id veya slug gerekli.',
  });

/**
 * Katalog uçları. `catalog.view` yetkisi şart. Görünüm bağlamı (üretici mi,
 * hangi firma, hangi gruplar) `ctx.user`'dan türetilir — istemci gönderemez.
 */
export function makeCatalogRouter(catalog: CatalogService) {
  return router({
    categories: capabilityProcedure('catalog.view').query(() => catalog.categories()),

    list: capabilityProcedure('catalog.view')
      .input(listInput)
      .query(async ({ input, ctx }) => {
        const view = await catalog.viewContext(ctx.user.memberships, ctx.user.roles);
        return catalog.list(input, view);
      }),

    product: capabilityProcedure('catalog.view')
      .input(productInput)
      .query(async ({ input, ctx }) => {
        const view = await catalog.viewContext(ctx.user.memberships, ctx.user.roles);
        return catalog.product({ id: input.id, slug: input.slug }, view);
      }),
  });
}
