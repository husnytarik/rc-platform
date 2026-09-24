import { Stack } from 'expo-router';

export default function KatalogStackLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="yeni" options={{ headerShown: true, title: 'Yeni Ürün' }} />
      <Stack.Screen name="[id]" options={{ headerShown: true, title: 'Ürün Düzenle' }} />
    </Stack>
  );
}
