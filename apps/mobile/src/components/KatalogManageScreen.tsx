import { Link } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { CategoryChips } from '@/components/CategoryChips';
import { trpc } from '@/lib/trpc';
import { colors, radius, spacing, shadow } from '@/theme';

export function KatalogManageScreen() {
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const { data, isLoading, isFetching, fetchNextPage, hasNextPage, isFetchingNextPage, refetch } =
    trpc.catalog.adminList.useInfiniteQuery(
      { limit: 30, search: search.trim() || undefined, categoryId: categoryId ?? undefined },
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
      onEndReachedThreshold={0.4}
      onEndReached={() => {
        if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
      }}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        <View style={styles.headerBox}>
          <View style={styles.searchRow}>
            <TextInput
              style={[styles.search, styles.fill]}
              value={search}
              onChangeText={setSearch}
              placeholder="Ürün ara…"
              placeholderTextColor={colors.inkFaint}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Link href="/producer/katalog/yeni" asChild>
              <TouchableOpacity style={styles.plusBtn}>
                <Text style={styles.plusText}>+ Ürün</Text>
              </TouchableOpacity>
            </Link>
          </View>
          <CategoryChips value={categoryId} onChange={setCategoryId} mode="id" />
        </View>
      }
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
      renderItem={({ item }) => (
        <Link href={{ pathname: '/producer/katalog/[id]', params: { id: item.id } }} asChild>
          <TouchableOpacity style={[styles.card, !item.isActive && styles.cardOff]}>
            {item.imageUrl ? (
              <Image source={{ uri: item.imageUrl }} style={styles.thumb} resizeMode="cover" />
            ) : (
              <View style={styles.thumb} />
            )}
            <View style={styles.fill}>
              <Text style={styles.cardTitle} numberOfLines={1}>{item.name}</Text>
              <Text style={styles.cardMeta} numberOfLines={1}>
                {item.categoryName ?? 'Kategorisiz'} · {item.activeVariantCount} varyant
                {item.isService ? ' · servis' : ''}
                {!item.isActive ? ' · pasif' : ''}
              </Text>
            </View>
            <Text style={styles.chev}>›</Text>
          </TouchableOpacity>
        </Link>
      )}
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
  listContent: { padding: spacing(4), gap: spacing(2) },
  empty: { textAlign: 'center', color: colors.inkMuted, marginTop: spacing(6) },
  newButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    paddingVertical: spacing(3),
    alignItems: 'center',
    marginBottom: spacing(2.5),
  },
  newButtonText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing(2.5),
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3), ...shadow.card },
  thumb: { width: 44, height: 44, borderRadius: radius.sm, backgroundColor: colors.surfaceMuted },
  fill: { flex: 1 },
  cardOff: { opacity: 0.55 },
  chev: { fontSize: 22, color: colors.inkFaint },
  searchRow: { flexDirection: 'row', gap: spacing(2), alignItems: 'center' },
  plusBtn: { backgroundColor: colors.accent, borderRadius: radius.sm, paddingHorizontal: spacing(3.5), paddingVertical: spacing(2.75) },
  plusText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 15, fontWeight: '700', color: colors.ink, flexShrink: 1 },
  cardMeta: { fontSize: 12, color: colors.inkMuted },
  badgeRow: { flexDirection: 'row', gap: spacing(1.5) },
  inactiveBadge: { backgroundColor: colors.dangerSoft, borderRadius: radius.pill, paddingHorizontal: spacing(2.5), paddingVertical: spacing(1) },
  inactiveBadgeText: { color: colors.danger, fontSize: 11, fontWeight: '700' },
  serviceBadge: { backgroundColor: colors.accentSoft, borderRadius: radius.pill, paddingHorizontal: spacing(2.5), paddingVertical: spacing(1) },
  serviceBadgeText: { color: colors.accent, fontSize: 11, fontWeight: '700' },
});
