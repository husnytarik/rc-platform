import { Link } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { CategoryChips } from '@/components/CategoryChips';
import { trpc } from '@/lib/trpc';
import { colors, radius, spacing, shadow } from '@/theme';

type StockBadge = 'in' | 'low' | 'out' | 'preorder' | 'incoming' | 'closed';

const STOCK_META: Record<StockBadge, { label: string; color: string }> = {
  in: { label: 'Stokta', color: '#3a7d5c' },
  low: { label: 'Az kaldı', color: '#b8860b' },
  out: { label: 'Tükendi', color: colors.danger },
  preorder: { label: 'Ön sipariş', color: colors.accent },
  incoming: { label: 'Yolda', color: colors.accent },
  closed: { label: 'Kapalı', color: colors.inkMuted },
};
const BADGE_PRIORITY: StockBadge[] = ['out', 'low', 'closed', 'incoming', 'preorder', 'in'];

interface Variant {
  stock: { badge: StockBadge; available: number | null };
}

function worstBadge(variants: Variant[]): StockBadge {
  const badges = new Set(variants.map((v) => v.stock.badge));
  return BADGE_PRIORITY.find((b) => badges.has(b)) ?? 'in';
}

function totalBalance(variants: Variant[]): number | null {
  if (variants.some((v) => v.stock.available == null)) return null;
  return variants.reduce((sum, v) => sum + (v.stock.available ?? 0), 0);
}

export default function StokScreen() {
  const [search, setSearch] = useState('');
  const [categorySlug, setCategorySlug] = useState<string | null>(null);
  const { data, isLoading, isFetching, fetchNextPage, hasNextPage, isFetchingNextPage, refetch } =
    trpc.catalog.list.useInfiniteQuery(
      { limit: 30, search: search.trim() || undefined, categorySlug: categorySlug ?? undefined },
      { getNextPageParam: (last) => last.nextCursor ?? undefined },
    );
  const items = data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <FlatList
      style={styles.flex}
      contentContainerStyle={styles.listContent}
      data={items}
      keyExtractor={(p) => p.id}
      refreshing={isFetching && !isFetchingNextPage}
      onRefresh={() => void refetch()}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        <View style={styles.headerBox}>
          <TextInput
            style={styles.search}
            value={search}
            onChangeText={setSearch}
            placeholder="Ad, kod veya marka ara…"
            placeholderTextColor={colors.inkFaint}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <CategoryChips value={categorySlug} onChange={setCategorySlug} mode="slug" />
        </View>
      }
      onEndReachedThreshold={0.4}
      onEndReached={() => {
        if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
      }}
      ListEmptyComponent={
        isLoading ? (
          <ActivityIndicator style={{ marginTop: 24 }} color={colors.accent} />
        ) : (
          <Text style={styles.empty}>Ürün yok.</Text>
        )
      }
      ListFooterComponent={
        isFetchingNextPage ? <ActivityIndicator style={{ marginVertical: 16 }} color={colors.accent} /> : null
      }
      renderItem={({ item }) => {
        const badge = STOCK_META[worstBadge(item.variants)];
        const total = totalBalance(item.variants);
        return (
          <Link href={{ pathname: '/producer/stok/[id]', params: { id: item.id } }} asChild>
            <TouchableOpacity style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.cardTitle}>{item.name}</Text>
                <View style={[styles.badge, { borderColor: badge.color }]}>
                  <View style={[styles.badgeDot, { backgroundColor: badge.color }]} />
                  <Text style={[styles.badgeText, { color: badge.color }]}>{badge.label}</Text>
                </View>
              </View>
              <Text style={styles.cardMeta}>
                {item.variants.length} varyant · toplam bakiye {total ?? '—'}
              </Text>
            </TouchableOpacity>
          </Link>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  headerBox: { gap: spacing(2.5), marginBottom: spacing(1) },
  search: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2.5),
    fontSize: 15,
    color: colors.ink,
    ...shadow.card,
  },
  flex: { flex: 1, backgroundColor: colors.bg },
  listContent: { padding: spacing(5), gap: spacing(2.5) },
  empty: { textAlign: 'center', color: colors.inkMuted, marginTop: spacing(6) },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing(3.5),
    gap: spacing(1.5), ...shadow.card },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 15, fontWeight: '700', color: colors.ink, flexShrink: 1 },
  cardMeta: { fontSize: 12, color: colors.inkMuted },
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
