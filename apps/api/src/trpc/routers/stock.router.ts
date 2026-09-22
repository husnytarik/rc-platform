import { z } from 'zod';
import type { StockService } from '../../catalog/stock.service';
import { capabilityProcedure, router } from '../trpc';

const MANUAL_REASONS = ['purchase', 'production_in', 'adjustment', 'correction'] as const;
const DISPLAY_STATES = ['in_stock', 'limited', 'preorder', 'incoming', 'closed'] as const;

const ledgerInput = z.object({
  variantId: z.string().uuid(),
  limit: z.number().int().min(1).max(100).optional(),
  cursor: z.string().uuid().optional(),
});

const overrideQueryInput = z.object({ productId: z.string().uuid() });

const adjustInput = z.object({
  variantId: z.string().uuid(),
  delta: z.number().finite().refine((n) => n !== 0, 'Miktar sıfır olamaz.'),
  reason: z.enum(MANUAL_REASONS),
  note: z.string().max(500).optional(),
});

const setOverrideInput = z.object({
  productId: z.string().uuid(),
  state: z.enum(DISPLAY_STATES),
  note: z.string().max(500).optional(),
});

const clearOverrideInput = z.object({ productId: z.string().uuid() });

/**
 * Stok defteri + gösterim override uçları. Okuma `catalog.view`, yazma
 * `catalog.manage` yetkisi ister (yalnız producer_admin).
 */
export function makeStockRouter(stock: StockService) {
  return router({
    ledger: capabilityProcedure('catalog.view')
      .input(ledgerInput)
      .query(({ input }) =>
        stock.ledger(input.variantId, { limit: input.limit, cursor: input.cursor }),
      ),

    override: capabilityProcedure('catalog.view')
      .input(overrideQueryInput)
      .query(({ input }) => stock.getOverride(input.productId)),

    adjust: capabilityProcedure('catalog.manage')
      .input(adjustInput)
      .mutation(({ input, ctx }) => stock.adjust(input, ctx.user)),

    setOverride: capabilityProcedure('catalog.manage')
      .input(setOverrideInput)
      .mutation(({ input, ctx }) => stock.setOverride(input, ctx.user)),

    clearOverride: capabilityProcedure('catalog.manage')
      .input(clearOverrideInput)
      .mutation(({ input, ctx }) => stock.clearOverride(input.productId, ctx.user)),
  });
}
