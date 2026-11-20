import { ORDER_STATUS_LABELS_TR, ORDER_STATUS_META, type OrderStatus } from '@rc/shared';
import { useRouter, type Href } from 'expo-router';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { DraftOrderCard } from '@/components/DraftOrderCard';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/providers/auth-context';
import { colors, radius, spacing, shadow } from '@/theme';

function formatDateTime(d: string | Date): string {
  return new Date(d).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatDate(d: string | Date): string {
  return new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** Sipariş listesi — kapsam (kendi siparişleri / tümü) sunucuda role göre belirlenir. */
export function OrdersListScreen({ basePath }: { basePath: string }) {
  const router = useRouter();
  const { can } = useAuth();
  const producerView = can('order.view.all');
  const { data, isLoading, isFetching, fetchNextPage, hasNextPage, isFetchingNextPage, refetch } =
    trpc.orders.list.useInfiniteQuery(
      { limit: 20 },
      { getNextPageParam: (last) => last.nextCursor ?? undefined },
    );
  const items = data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <FlatList
      style={styles.flex}
      contentContainerStyle={styles.listContent}
      data={items}
      ListHeaderComponent={basePath === '/customer/siparislerim' ? <DraftOrderCard /> : null}
      keyExtractor={(o) => o.id}
      refreshing={isFetching && !isFetchingNextPage}
      onRefresh={() => void refetch()}
      onEndReachedThreshold={0.4}
      onEndReached={() => {
        if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
      }}
      ListEmptyComponent={
        isLoading ? (
          <ActivityIndicator style={{ marginTop: 24 }} color={colors.accent} />
        ) : (
          <Text style={styles.empty}>Sipariş yok.</Text>
        )
      }
      ListFooterComponent={
        isFetchingNextPage ? <ActivityIndicator style={{ marginVertical: 16 }} color={colors.accent} /> : null
      }
      renderItem={({ item }) => {
        const meta = ORDER_STATUS_META[item.status as OrderStatus];
        return (
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push(`${basePath}/${item.id}` as Href)}
          >
            <View style={styles.cardTop}>
              {producerView ? (
                <View style={styles.cardHead}>
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {item.customerName}
                  </Text>
                  <Text style={styles.cardCode}>{item.keyCode}</Text>
                </View>
              ) : (
                <View style={styles.cardHead}>
                  <Text style={styles.cardTitle}>{formatDateTime(item.createdAt)}</Text>
                  <Text style={styles.cardCode}>{item.keyCode}</Text>
                </View>
              )}
              <View style={[styles.badge, { borderColor: meta.color }]}>
                <View style={[styles.badgeDot, { backgroundColor: meta.color }]} />
                <Text style={[styles.badgeText, { color: meta.color }]}>
                  {ORDER_STATUS_LABELS_TR[item.status as OrderStatus]}
                </Text>
              </View>
            </View>
            <Text style={styles.cardMeta}>
              {item.branchName}{item.placedByName ? ` · ${item.placedByName}` : ''} · {item.lineCount} kalem{item.salesRepName ? ` · ${item.salesRepName}` : ''}
            </Text>
            <View style={styles.cardBottom}>
              <Text style={styles.cardTotal}>
                {item.total ? `${item.total} ${item.currency}` : ''}
              </Text>
              {producerView && <Text style={styles.cardDate}>{formatDate(item.createdAt)}</Text>}
            </View>
          </TouchableOpacity>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  listContent: { padding: spacing(5), gap: spacing(2.5) },
  empty: { textAlign: 'center', color: colors.inkMuted, marginTop: spacing(6) },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing(3.5),
    gap: spacing(1.5), ...shadow.card },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 15, fontWeight: '700', color: colors.ink },
  cardHead: { flex: 1, marginRight: spacing(2) },
  cardCode: { fontSize: 12, color: colors.inkMuted, fontWeight: '600', marginTop: 1 },
  cardMeta: { fontSize: 12, color: colors.inkMuted },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTotal: { fontSize: 14, color: colors.ink, fontWeight: '700' },
  cardDate: { fontSize: 12, color: colors.inkFaint },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1),
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing(2.5),
    paddingVertical: spacing(1),
  },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 11, fontWeight: '700' },
});
