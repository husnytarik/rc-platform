import { isCustomerRole } from '@rc/shared';
import { Redirect, Tabs } from 'expo-router';
import { useAuth } from '@/providers/auth-context';
import { useCart } from '@/providers/cart-context';
import { colors } from '@/theme';
import { HeaderActions } from '@/components/HeaderActions';
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
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Ana Sayfa' }} />
      <Tabs.Screen name="katalog" options={{ title: 'Katalog' }} />
      <Tabs.Screen
        name="sepet"
        options={{
          title: 'Sepet',
          tabBarBadge: cart.totalQty > 0 ? cart.totalQty : undefined,
        }}
      />
      <Tabs.Screen name="siparislerim" options={{ title: 'Siparişlerim' }} />
      <Tabs.Screen name="daha-fazla" options={{ title: 'Daha fazla' }} />
      <Tabs.Screen name="servisler" options={{ href: null, title: 'Servisler' }} />
      <Tabs.Screen name="destek" options={{ href: null, title: 'Destek' }} />
      <Tabs.Screen name="bildirimler" options={{ href: null, title: 'Bildirimler' }} />
      <Tabs.Screen name="hesap" options={{ href: null, title: 'Hesap' }} />
    </Tabs>
  );
}
