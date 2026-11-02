import { isProducerRole } from '@rc/shared';
import { useRouter, type Href } from 'expo-router';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '@/providers/auth-context';
import { trpc } from '@/lib/trpc';
import { colors, radius, spacing } from '@/theme';

function formatDateTime(d: string | Date): string {
  return new Date(d).toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Bildirim kutusu — dokununca ilgili sipariş/talebe gider ve okundu işaretler. */
export function NotificationsScreen() {
  const router = useRouter();
  const { identity } = useAuth();
  const utils = trpc.useUtils();
  const producer = identity?.roles.some(isProducerRole) ?? false;
  const base = producer ? '/producer' : '/customer';

  const { data, isLoading, isFetching, fetchNextPage, hasNextPage, isFetchingNextPage, refetch } =
    trpc.notification.inbox.useInfiniteQuery(
      { limit: 30 },
      { getNextPageParam: (last) => last.nextCursor ?? undefined },
    );
  const items = data?.pages.flatMap((p) => p.items) ?? [];

  const refresh = (): void => {
    void utils.notification.inbox.invalidate();
    void utils.notification.unreadCount.invalidate();
  };
  const markRead = trpc.notification.markRead.useMutation({ onSuccess: refresh });

  const open = (n: (typeof items)[number]): void => {
    if (!n.read) markRead.mutate({ ids: [n.id] });
    const orderId = n.data['orderId'];
    const ticketId = n.data['ticketId'];
    if (orderId) router.push(`${base}/${producer ? 'siparisler' : 'siparislerim'}/${orderId}` as Href);
    else if (ticketId) router.push(`${base}/destek/${ticketId}` as Href);
  };

  return (
    <FlatList
      style={styles.flex}
      contentContainerStyle={styles.content}
      data={items}
      keyExtractor={(n) => n.id}
      refreshing={isFetching && !isFetchingNextPage}
      onRefresh={() => void refetch()}
      onEndReachedThreshold={0.4}
      onEndReached={() => {
        if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
      }}
      ListHeaderComponent={
        items.some((n) => !n.read) ? (
          <TouchableOpacity style={styles.markAll} onPress={() => markRead.mutate({})}>
            <Text style={styles.markAllText}>Tümünü okundu işaretle</Text>
          </TouchableOpacity>
        ) : null
      }
      ListEmptyComponent={
        isLoading ? (
          <ActivityIndicator style={{ marginTop: 24 }} color={colors.accent} />
        ) : (
          <Text style={styles.empty}>Henüz bildirim yok.</Text>
        )
      }
      renderItem={({ item }) => (
        <TouchableOpacity style={[styles.card, !item.read && styles.unread]} onPress={() => open(item)}>
          <View style={styles.row}>
            <Text style={styles.title}>{item.title}</Text>
            {!item.read && <View style={styles.dot} />}
          </View>
          <Text style={styles.body}>{item.body}</Text>
          <Text style={styles.date}>{formatDateTime(item.createdAt)}</Text>
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing(5), gap: spacing(2.5) },
  empty: { textAlign: 'center', color: colors.inkMuted, marginTop: spacing(6) },
  markAll: { alignSelf: 'flex-end', paddingVertical: spacing(1) },
  markAllText: { color: colors.accent, fontWeight: '600', fontSize: 13 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing(3.5),
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing(1),
  },
  unread: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 14, fontWeight: '700', color: colors.ink, flexShrink: 1 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
  body: { fontSize: 13, color: colors.ink },
  date: { fontSize: 11, color: colors.inkFaint },
});
