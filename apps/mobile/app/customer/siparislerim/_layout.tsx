import { Stack } from 'expo-router';

export default function SiparislerimStackLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[id]" options={{ headerShown: true, title: 'Sipariş' }} />
    </Stack>
  );
}
