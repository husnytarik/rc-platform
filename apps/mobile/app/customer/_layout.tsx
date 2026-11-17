import { isCustomerRole } from '@rc/shared';
import { Redirect, Tabs } from 'expo-router';
import { useAuth } from '@/providers/auth-context';
import { useCart } from '@/providers/cart-context';
import { colors } from '@/theme';
import { HeaderActions } from '@/components/HeaderActions';
import { tabIcon } from '@/components/TabIcon';
import { StartupLoading } from '@/components/StartupLoading';

export default function CustomerLayout() {
  const { status, identity } = useAuth();
  const cart = useCart();

  if (status === 'loading') return <StartupLoading />;
  if (status !== 'authenticated' || !identity || identity.pending) return <Redirect href="/" />;
  if (!identity.roles.some(isCustomerRole)) return <Redirect href="/" />;

  return (
    <Tabs
      screenOptions={{
        headerRight: () => <HeaderActions base="/customer" />,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.inkFaint,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        headerTitleStyle: { fontWeight: '800' },
        headerShadowVisible: false,
        tabBarStyle: { backgroundColor: colors.surface, borderTopWidth: 0, elevation: 12, shadowColor: '#2A1B10', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: -3 } },
        headerStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Ana Sayfa', tabBarIcon: tabIcon('home') }} />
      <Tabs.Screen name="katalog" options={{ title: 'Katalog', tabBarIcon: tabIcon('cafe') }} />
      <Tabs.Screen
        name="siparislerim"
        options={{
          title: 'Siparişlerim',
          tabBarIcon: tabIcon('cube'),
          // Gönderilmemiş (taslak) siparişte bekleyen kalem sayısı.
          tabBarBadge: cart.totalQty > 0 ? cart.totalQty : undefined,
        }}
      />
      <Tabs.Screen name="daha-fazla" options={{ title: 'Daha fazla', tabBarIcon: tabIcon('menu') }} />
      <Tabs.Screen name="tarifler" options={{ href: null, title: 'Reçeteler' }} />
      <Tabs.Screen name="servisler" options={{ href: null, title: 'Servisler' }} />
      <Tabs.Screen name="destek" options={{ href: null, title: 'Destek' }} />
      <Tabs.Screen name="bildirimler" options={{ href: null, title: 'Bildirimler' }} />
      <Tabs.Screen name="hesap" options={{ href: null, title: 'Hesap' }} />
    </Tabs>
  );
}
