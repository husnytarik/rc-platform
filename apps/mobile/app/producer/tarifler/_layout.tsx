import { Stack } from 'expo-router';

export default function TariflerStackLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="yeni" options={{ headerShown: true, title: 'Yeni reçete' }} />
      <Stack.Screen name="duzenle" options={{ headerShown: true, title: 'Reçeteyi düzenle' }} />
      <Stack.Screen name="[id]" options={{ headerShown: true, title: 'Reçete' }} />
    </Stack>
  );
}
