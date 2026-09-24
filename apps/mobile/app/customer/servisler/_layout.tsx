import { Stack } from 'expo-router';

export default function ServislerStackLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[id]" options={{ headerShown: true, title: 'Servis talebi' }} />
    </Stack>
  );
}
