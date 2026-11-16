import { z } from 'zod';
import type { RecipeService } from '../../engage/recipe.service';
import { protectedProcedure, router } from '../trpc';

export function makeRecipeRouter(recipes: RecipeService) {
  return router({
    /** Günün reçetesi — her gün sıradaki reçete. */
    today: protectedProcedure.query(() => recipes.today()),
    list: protectedProcedure.query(() => recipes.list()),
    get: protectedProcedure.input(z.object({ id: z.string().uuid() })).query(({ input }) => recipes.get(input.id)),
  });
}
