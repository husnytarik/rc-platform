import { Stack } from 'expo-router';

export default function Layout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="yeni" options={{ headerShown: true, title: 'Yeni talep' }} />
      <Stack.Screen name="[id]" options={{ headerShown: true, title: 'Destek talebi' }} />
    </Stack>
  );
}
