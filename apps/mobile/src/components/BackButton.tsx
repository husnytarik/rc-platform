import { useRouter, type Href } from 'expo-router';
import { TouchableOpacity } from 'react-native';
import { Icon } from '@/components/Icon';
import { colors } from '@/theme';

/** Sekme başlığındaki geri düğmesi (gizli sekme sayfaları için). Geçmiş yoksa `fallback`e gider. */
export function BackButton({ fallback }: { fallback: Href }) {
  const router = useRouter();
  return (
    <TouchableOpacity
      accessibilityLabel="Geri"
      hitSlop={10}
      style={{ marginLeft: 10, width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}
      onPress={() => (router.canGoBack() ? router.back() : router.replace(fallback))}
    >
      <Icon name="chevron-back" size={26} color={colors.accent} />
    </TouchableOpacity>
  );
}
