import { z } from 'zod';
import type { RecipeService } from '../../engage/recipe.service';
import { capabilityProcedure, protectedProcedure, router } from '../trpc';

const recipeInput = z.object({
  title: z.string().min(2).max(200),
  subtitle: z.string().max(300).nullable().optional(),
  description: z.string().max(3000).nullable().optional(),
  imageUrl: z.string().max(500).nullable().optional(),
  category: z.string().min(1).max(60),
  prepMinutes: z.number().int().min(1).max(600),
  servings: z.number().int().min(1).max(100),
  difficulty: z.enum(['kolay', 'orta', 'zor']),
  ingredients: z.array(z.string().max(300)).max(60),
  steps: z.array(z.string().max(1000)).max(60),
  tip: z.string().max(1000).nullable().optional(),
  isActive: z.boolean().optional(),
});

export function makeRecipeRouter(recipes: RecipeService) {
  return router({
    /** Günün reçetesi — her gün sıradaki reçete. */
    today: protectedProcedure.query(() => recipes.today()),
    list: protectedProcedure.query(() => recipes.list()),
    get: protectedProcedure.input(z.object({ id: z.string().uuid() })).query(({ input }) => recipes.get(input.id)),

    adminList: capabilityProcedure('content.manage').query(() => recipes.adminList()),
    adminGet: capabilityProcedure('content.manage')
      .input(z.object({ id: z.string().uuid() }))
      .query(({ input }) => recipes.adminGet(input.id)),
    create: capabilityProcedure('content.manage')
      .input(recipeInput)
      .mutation(({ input }) => recipes.create(input)),
    update: capabilityProcedure('content.manage')
      .input(recipeInput.extend({ id: z.string().uuid() }))
      .mutation(({ input: { id, ...rest } }) => recipes.update(id, rest)),
    remove: capabilityProcedure('content.manage')
      .input(z.object({ id: z.string().uuid() }))
      .mutation(({ input }) => recipes.remove(input.id)),

    tipToday: protectedProcedure.query(() => recipes.tipToday()),
    tipList: capabilityProcedure('content.manage').query(() => recipes.tipList()),
    tipCreate: capabilityProcedure('content.manage')
      .input(z.object({ title: z.string().max(120).nullable().optional(), body: z.string().min(3).max(600) }))
      .mutation(({ input }) => recipes.tipCreate(input)),
    tipSetActive: capabilityProcedure('content.manage')
      .input(z.object({ id: z.string().uuid(), isActive: z.boolean() }))
      .mutation(({ input }) => recipes.tipSetActive(input.id, input.isActive)),
    tipRemove: capabilityProcedure('content.manage')
      .input(z.object({ id: z.string().uuid() }))
      .mutation(({ input }) => recipes.tipRemove(input.id)),
  });
}
