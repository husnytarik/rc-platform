import { z } from 'zod';
import type { CatalogSheetService } from '../../catalog/catalog-sheet.service';
import { capabilityProcedure, router } from '../trpc';

const rowSchema = z.object({
  productCode: z.string().max(60),
  productName: z.string().max(200),
  category: z.string().max(120).optional(),
  brand: z.string().max(120).optional(),
  description: z.string().max(2000).optional(),
  variantCode: z.string().max(60),
  variantName: z.string().max(200),
  uom: z.string().max(10),
  price: z.number(),
  stock: z.number().optional(),
  minQty: z.number().optional(),
  qtyStep: z.number().optional(),
  active: z.boolean().optional(),
});

/** Excel aktarımı: dışa aktarım tüm varyantları düz satır olarak verir; içe aktarım önce önizler. */
export function makeSheetRouter(sheet: CatalogSheetService) {
  return router({
    export: capabilityProcedure('catalog.manage').query(() => sheet.exportRows()),

    import: capabilityProcedure('catalog.manage')
      .input(z.object({ rows: z.array(rowSchema).min(1).max(500), apply: z.boolean() }))
      .mutation(({ input, ctx }) => sheet.importRows(input.rows, input.apply, ctx.user)),
  });
}
