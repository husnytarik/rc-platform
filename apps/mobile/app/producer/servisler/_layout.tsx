import { Stack } from 'expo-router';

export default function ServislerStackLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="yeni" options={{ headerShown: true, title: 'Yeni Servis' }} />
    </Stack>
  );
}
