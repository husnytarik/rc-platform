import { isProducerRole } from '@rc/shared';
import { Redirect, Tabs, router } from 'expo-router';
import { Text, TouchableOpacity } from 'react-native';
import { PRODUCER_NAV } from '@/nav';
import { useAuth } from '@/providers/auth-context';
import { colors } from '@/theme';
import { StartupLoading } from '@/components/StartupLoading';

function AccountHeaderButton() {
  return (
    <TouchableOpacity onPress={() => router.push('/producer/hesap')} style={{ marginRight: 16 }}>
      <Text style={{ color: colors.accent, fontWeight: '600', fontSize: 14 }}>Hesap</Text>
    </TouchableOpacity>
  );
}

export default function ProducerLayout() {
  const { status, identity, can } = useAuth();

  if (status === 'loading') return <StartupLoading />;
  if (status !== 'authenticated' || !identity || identity.pending) return <Redirect href="/" />;
  if (!identity.roles.some(isProducerRole)) return <Redirect href="/" />;

  const visible = PRODUCER_NAV.filter((item) => can(item.cap));

  return (
    <Tabs
      screenOptions={{
        headerRight: () => <AccountHeaderButton />,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.inkFaint,
      }}
    >
      {visible.map((item) => (
        <Tabs.Screen key={item.key} name={item.key} options={{ title: item.label }} />
      ))}
      <Tabs.Screen name="hesap" options={{ href: null, title: 'Hesap' }} />
    </Tabs>
  );
}
