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
    <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 14, gap: 6 }}>
      <TouchableOpacity style={btn} onPress={() => router.push(`${base}/bildirimler` as Href)}>
        <Text style={{ fontSize: 20 }}>🔔</Text>
        {count > 0 && (
          <View style={badge}>
            <Text style={badgeText}>{count > 99 ? '99+' : count}</Text>
          </View>
        )}
      </TouchableOpacity>
      <TouchableOpacity style={btn} onPress={() => router.push(`${base}/hesap` as Href)}>
        <Text style={{ fontSize: 20 }}>👤</Text>
      </TouchableOpacity>
    </View>
  );
}

const btn = { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' } as const;
const badge = {
  position: 'absolute',
  top: 2,
  right: 0,
  minWidth: 17,
  height: 17,
  borderRadius: 9,
  backgroundColor: colors.danger,
  alignItems: 'center',
  justifyContent: 'center',
  paddingHorizontal: 4,
} as const;
const badgeText = { color: '#fff', fontSize: 10, fontWeight: '800' } as const;
