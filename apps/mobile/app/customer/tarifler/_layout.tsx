import { Stack } from 'expo-router';

export default function TariflerStackLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[id]" options={{ headerShown: true, title: 'Reçete' }} />
    </Stack>
  );
}
