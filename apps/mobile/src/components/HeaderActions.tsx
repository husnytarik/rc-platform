import { router, type Href } from 'expo-router';
import { Text, TouchableOpacity, View } from 'react-native';
import { trpc } from '@/lib/trpc';
import { colors } from '@/theme';

/** Üst çubuk sağ tarafı: okunmamış sayacı olan "Bildirim" ve "Hesap". */
export function HeaderActions({ base }: { base: '/customer' | '/producer' }) {
  const unread = trpc.notification.unreadCount.useQuery(undefined, {
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
  const count = unread.data ?? 0;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 16, gap: 16 }}>
      <TouchableOpacity onPress={() => router.push(`${base}/bildirimler` as Href)}>
        <Text style={{ color: colors.accent, fontWeight: '600', fontSize: 14 }}>
          Bildirim
          {count > 0 && (
            <Text style={{ color: colors.danger }}> ({count > 99 ? '99+' : count})</Text>
          )}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => router.push(`${base}/hesap` as Href)}>
        <Text style={{ color: colors.accent, fontWeight: '600', fontSize: 14 }}>Hesap</Text>
      </TouchableOpacity>
    </View>
  );
}
