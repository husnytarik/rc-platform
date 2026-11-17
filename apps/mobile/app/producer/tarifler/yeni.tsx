import { EMPTY_RECIPE, RecipeForm } from '@/components/RecipeForm';

export default function Page() {
  return <RecipeForm initial={EMPTY_RECIPE} />;
}
