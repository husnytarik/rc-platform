import { isProducerRole } from '@rc/shared';
import { Redirect, Tabs } from 'expo-router';
import { PRODUCER_NAV } from '@/nav';
import { useAuth } from '@/providers/auth-context';
import { colors } from '@/theme';
import { HeaderActions } from '@/components/HeaderActions';
import { tabIcon } from '@/components/TabIcon';
import { StartupLoading } from '@/components/StartupLoading';

export default function ProducerLayout() {
  const { status, identity, can } = useAuth();

  if (status === 'loading') return <StartupLoading />;
  if (status !== 'authenticated' || !identity || identity.pending) return <Redirect href="/" />;
  if (!identity.roles.some(isProducerRole)) return <Redirect href="/" />;

  const allowed = PRODUCER_NAV.filter((item) => can(item.cap));
  const primary = allowed.filter((i) => i.primary);
  const secondary = PRODUCER_NAV.filter((i) => !i.primary);

  return (
    <Tabs
      screenOptions={{
        headerRight: () => <HeaderActions base="/producer" />,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.inkFaint,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        headerTitleStyle: { fontWeight: '800' },
        headerShadowVisible: false,
        tabBarStyle: { backgroundColor: colors.surface, borderTopWidth: 0, elevation: 12, shadowColor: '#2A1B10', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: -3 } },
        headerStyle: { backgroundColor: colors.bg },
      }}
    >
      {/* Sekme sırası bildirim sırasıdır: önce birincil sekmeler, sonra "Daha fazla" */}
      {PRODUCER_NAV.filter((i) => i.primary).map((item) => (
        <Tabs.Screen
          key={item.key}
          name={item.key}
          options={primary.includes(item) ? { title: item.label, tabBarIcon: tabIcon(item.icon) } : { href: null, title: item.label }}
        />
      ))}
      <Tabs.Screen name="daha-fazla" options={{ title: 'Daha fazla', tabBarIcon: tabIcon('menu') }} />
      {secondary.map((item) => (
        <Tabs.Screen key={item.key} name={item.key} options={{ href: null, title: item.label }} />
      ))}
      <Tabs.Screen name="tarifler" options={{ href: null, title: 'Reçeteler' }} />
      <Tabs.Screen name="bildirimler" options={{ href: null, title: 'Bildirimler' }} />
      <Tabs.Screen name="hesap" options={{ href: null, title: 'Hesap' }} />
    </Tabs>
  );
}
