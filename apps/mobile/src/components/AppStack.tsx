import { Stack } from 'expo-router';
import { HeaderActions } from '@/components/HeaderActions';
import { colors } from '@/theme';

/**
 * Sekmeli bölümlerin iç yığını: liste sayfası başlık + bildirim/hesap ikonlarını, detay sayfaları
 * ise geri okunu gösterir. (Üstteki sekme başlığı bu rotalarda kapalıdır — çift başlık olmasın.)
 */
export function AppStack({
  base,
  title,
  screens = {},
}: {
  base: '/customer' | '/producer';
  title: string;
  screens?: Record<string, string>;
}) {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTitleStyle: { fontWeight: '800' },
        headerShadowVisible: false,
        headerTintColor: colors.accent,
        headerBackButtonDisplayMode: 'minimal',
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="index" options={{ title, headerRight: () => <HeaderActions base={base} /> }} />
      {Object.entries(screens).map(([name, t]) => (
        <Stack.Screen key={name} name={name} options={{ title: t }} />
      ))}
    </Stack>
  );
}
