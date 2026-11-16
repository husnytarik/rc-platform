import { useLocalSearchParams } from 'expo-router';
import { RecipeDetailScreen } from '@/components/RecipeScreens';

export default function Page() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <RecipeDetailScreen id={id} />;
}
