import { Stack } from 'expo-router';

export default function MusterilerStackLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="yeni" options={{ headerShown: true, title: 'Yeni Firma' }} />
      <Stack.Screen name="fiyat" options={{ headerShown: true, title: 'Özel Fiyatlar' }} />
      <Stack.Screen name="[id]"options={{ headerShown: true, title: 'Firma' }} />
    </Stack>
  );
}
