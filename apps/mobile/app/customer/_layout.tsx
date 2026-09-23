import { isCustomerRole } from '@rc/shared';
import { Redirect, Tabs, router } from 'expo-router';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '@/providers/auth-context';
import { useCart } from '@/providers/cart-context';
import { colors } from '@/theme';

function AccountHeaderButton() {
  return (
    <TouchableOpacity onPress={() => router.push('/customer/hesap')} style={{ marginRight: 16 }}>
      <Text style={{ color: colors.accent, fontWeight: '600', fontSize: 14 }}>Hesap</Text>
    </TouchableOpacity>
  );
}

export default function CustomerLayout() {
  const { status, identity } = useAuth();
  const cart = useCart();

  if (status === 'loading') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }
  if (status !== 'authenticated' || !identity || identity.pending) return <Redirect href="/" />;
  if (!identity.roles.some(isCustomerRole)) return <Redirect href="/" />;

  return (
    <Tabs
      screenOptions={{
        headerRight: () => <AccountHeaderButton />,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.inkFaint,
      }}
    >
      <Tabs.Screen name="katalog" options={{ title: 'Katalog' }} />
      <Tabs.Screen
        name="sepet"
        options={{
          title: 'Sepet',
          tabBarBadge: cart.totalQty > 0 ? cart.totalQty : undefined,
        }}
      />
      <Tabs.Screen name="siparislerim" options={{ title: 'Siparişlerim' }} />
      <Tabs.Screen name="hesap" options={{ href: null, title: 'Hesap' }} />
    </Tabs>
  );
}
