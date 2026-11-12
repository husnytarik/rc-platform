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
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Ana Sayfa', tabBarIcon: tabIcon('🏠') }} />
      <Tabs.Screen name="katalog" options={{ title: 'Katalog', tabBarIcon: tabIcon('☕') }} />
      <Tabs.Screen
        name="siparislerim"
        options={{
          title: 'Siparişlerim',
          tabBarIcon: tabIcon('📦'),
          // Gönderilmemiş (taslak) siparişte bekleyen kalem sayısı.
          tabBarBadge: cart.totalQty > 0 ? cart.totalQty : undefined,
        }}
      />
      <Tabs.Screen name="daha-fazla" options={{ title: 'Daha fazla', tabBarIcon: tabIcon('☰') }} />
      <Tabs.Screen name="servisler" options={{ href: null, title: 'Servisler' }} />
      <Tabs.Screen name="destek" options={{ href: null, title: 'Destek' }} />
      <Tabs.Screen name="bildirimler" options={{ href: null, title: 'Bildirimler' }} />
      <Tabs.Screen name="hesap" options={{ href: null, title: 'Hesap' }} />
    </Tabs>
  );
}
