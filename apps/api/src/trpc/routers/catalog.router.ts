import { UOMS } from '@rc/shared';
import { z } from 'zod';
import type { CatalogService } from '../../catalog/catalog.service';
import { capabilityProcedure, protectedProcedure, router } from '../trpc';

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

const adminListInput = z
  .object({
    search: z.string().min(1).max(120).optional(),
    categoryId: z.string().uuid().optional(),
    limit: z.number().int().min(1).max(100).optional(),
    cursor: z.string().uuid().optional(),
  })
  .default({});

const idInput = z.object({ id: z.string().uuid() });

const createProductInput = z.object({
  code: z.string().min(1).max(60),
  name: z.string().min(1).max(200),
  categoryId: z.string().uuid().optional(),
  brand: z.string().max(120).optional(),
  description: z.string().max(2000).optional(),
  imageUrl: z.string().url().max(500).optional(),
  allowPreorder: z.boolean().optional(),
  isService: z.boolean().optional(),
});

const updateProductInput = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200).optional(),
  categoryId: z.string().uuid().nullable().optional(),
  brand: z.string().max(120).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  imageUrl: z.string().url().max(500).nullable().optional(),
  allowPreorder: z.boolean().optional(),
  isActive: z.boolean().optional(),
  isService: z.boolean().optional(),
});

const createVariantInput = z.object({
  productId: z.string().uuid(),
  code: z.string().min(1).max(60),
  name: z.string().min(1).max(200),
  orderUom: z.enum(UOMS),
  basePrice: z.number().finite().nonnegative(),
  minOrderQty: z.number().finite().positive().optional(),
  qtyStep: z.number().finite().positive().optional(),
  contentAmount: z.number().finite().positive().optional(),
  contentUom: z.enum(UOMS).optional(),
  lowStockThreshold: z.number().finite().nonnegative().optional(),
});

const updateVariantInput = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200).optional(),
  orderUom: z.enum(UOMS).optional(),
  basePrice: z.number().finite().nonnegative().optional(),
  minOrderQty: z.number().finite().positive().optional(),
  qtyStep: z.number().finite().positive().optional(),
  contentAmount: z.number().finite().positive().nullable().optional(),
  contentUom: z.enum(UOMS).nullable().optional(),
  lowStockThreshold: z.number().finite().nonnegative().nullable().optional(),
  isActive: z.boolean().optional(),
});

/**
 * Katalog uçları. `catalog.view` yetkisi şart. Görünüm bağlamı (üretici mi,
 * hangi firma, hangi gruplar) `ctx.user`'dan türetilir — istemci gönderemez.
 */
export function makeCatalogRouter(catalog: CatalogService) {
  return router({
    newest: protectedProcedure.query(() => catalog.newest()),

    categories: capabilityProcedure('catalog.view').query(() => catalog.categories()),

    createCategory: capabilityProcedure('catalog.manage')
      .input(z.object({ name: z.string().trim().min(2).max(60) }))
      .mutation(({ input }) => catalog.createCategory(input.name)),

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

    adminList: capabilityProcedure('catalog.manage')
      .input(adminListInput)
      .query(({ input }) => catalog.adminList(input)),

    adminProduct: capabilityProcedure('catalog.manage')
      .input(idInput)
      .query(({ input }) => catalog.adminProduct(input.id)),

    customerPrices: capabilityProcedure('price.manage')
      .input(
        z.object({
          orgId: z.string().uuid(),
          search: z.string().min(1).max(120).optional(),
          categoryId: z.string().uuid().optional(),
        }),
      )
      .query(({ input }) => catalog.customerPrices(input)),

    setCustomerPrice: capabilityProcedure('price.manage')
      .input(z.object({ orgId: z.string().uuid(), variantId: z.string().uuid(), price: z.number().min(0).max(1_000_000).nullable() }))
      .mutation(({ input }) => catalog.setCustomerPrice(input)),

    setCustomerCategoryDiscount: capabilityProcedure('price.manage')
      .input(z.object({ orgId: z.string().uuid(), categoryId: z.string().uuid(), pct: z.number().min(0).max(90) }))
      .mutation(({ input }) => catalog.setCustomerCategoryDiscount(input)),

    uploadImage: capabilityProcedure('catalog.manage')
      .input(z.object({ base64: z.string().min(100).max(900_000) }))
      .mutation(async ({ input }) => ({ path: await catalog.saveImage(input.base64) })),

    createProduct: capabilityProcedure('catalog.manage')
      .input(createProductInput)
      .mutation(({ input, ctx }) => catalog.createProduct(input, ctx.user)),

    updateProduct: capabilityProcedure('catalog.manage')
      .input(updateProductInput)
      .mutation(({ input, ctx }) => catalog.updateProduct(input, ctx.user)),

    createVariant: capabilityProcedure('catalog.manage')
      .input(createVariantInput)
      .mutation(({ input, ctx }) => catalog.createVariant(input, ctx.user)),

    updateVariant: capabilityProcedure('catalog.manage')
      .input(updateVariantInput)
      .mutation(({ input, ctx }) => catalog.updateVariant(input, ctx.user)),
  });
}
