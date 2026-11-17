import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator } from 'react-native';
import { RecipeForm } from '@/components/RecipeForm';
import { trpc } from '@/lib/trpc';

export default function Page() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = trpc.recipe.adminGet.useQuery({ id });
  const r = q.data;
  if (!r) return <ActivityIndicator style={{ marginTop: 40 }} />;
  return (
    <RecipeForm
      id={id}
      initial={{
        title: r.title,
        subtitle: r.subtitle ?? '',
        description: r.description ?? '',
        imageUrl: r.imageUrl ?? '',
        category: r.category,
        prepMinutes: String(r.prepMinutes),
        servings: String(r.servings),
        difficulty: r.difficulty as 'kolay' | 'orta' | 'zor',
        ingredients: r.ingredients.join('\n'),
        steps: r.steps.join('\n'),
        tip: r.tip ?? '',
        isActive: r.isActive,
      }}
    />
  );
}
