import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { trpc } from '@/lib/trpc';
import { colors, radius, spacing } from '@/theme';

export default function MusterilerScreen() {
  const { data, isLoading, isFetching, fetchNextPage, hasNextPage, isFetchingNextPage, refetch } =
    trpc.customer.list.useInfiniteQuery(
      { limit: 30 },
      { getNextPageParam: (last) => last.nextCursor ?? undefined },
    );
  const items = data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <FlatList
      style={styles.flex}
      contentContainerStyle={styles.listContent}
      data={items}
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
          <Text style={styles.empty}>Müşteri yok.</Text>
        )
      }
      ListFooterComponent={
        isFetchingNextPage ? <ActivityIndicator style={{ marginVertical: 16 }} color={colors.accent} /> : null
      }
      renderItem={({ item }) => (
        <View style={styles.card}>
          <View style={styles.cardTop}>
            <Text style={styles.cardTitle}>{item.name}</Text>
            {!item.isActive && (
              <View style={styles.inactiveBadge}>
                <Text style={styles.inactiveBadgeText}>Pasif</Text>
              </View>
            )}
          </View>
          <Text style={styles.cardMeta}>
            {item.branchCount} şube · {item.memberCount} kullanıcı · {item.orderCount} sipariş
          </Text>
        </View>
      )}
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
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing(1),
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 15, fontWeight: '700', color: colors.ink },
  cardMeta: { fontSize: 12, color: colors.inkMuted },
  inactiveBadge: { backgroundColor: colors.dangerSoft, borderRadius: radius.pill, paddingHorizontal: spacing(2.5), paddingVertical: spacing(1) },
  inactiveBadgeText: { color: colors.danger, fontSize: 11, fontWeight: '700' },
});
