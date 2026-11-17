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
          <Link href="/producer/katalog/yeni" asChild>
            <TouchableOpacity style={styles.newButton}>
              <Text style={styles.newButtonText}>+ Yeni ürün</Text>
            </TouchableOpacity>
          </Link>
          <TextInput
            style={styles.search}
            value={search}
            onChangeText={setSearch}
            placeholder="Ad, kod veya marka ara…"
            placeholderTextColor={colors.inkFaint}
            autoCapitalize="none"
            autoCorrect={false}
          />
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
          <TouchableOpacity style={styles.card}>
            {item.imageUrl && <Image source={{ uri: item.imageUrl }} style={styles.cardImg} resizeMode="cover" />}
            <View style={styles.cardTop}>
              <Text style={styles.cardTitle}>{item.name}</Text>
              <View style={styles.badgeRow}>
                {item.isService && (
                  <View style={styles.serviceBadge}>
                    <Text style={styles.serviceBadgeText}>Servis</Text>
                  </View>
                )}
                {!item.isActive && (
                  <View style={styles.inactiveBadge}>
                    <Text style={styles.inactiveBadgeText}>Pasif</Text>
                  </View>
                )}
              </View>
            </View>
            <Text style={styles.cardMeta}>
              {item.code} · {item.categoryName ?? '—'} · {item.activeVariantCount}/{item.variantCount} varyant aktif
            </Text>
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
  listContent: { padding: spacing(5), gap: spacing(2.5) },
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
    padding: spacing(3.5),
    gap: spacing(1.5), ...shadow.card },
  cardImg: { width: '100%', height: 120, borderRadius: radius.sm, backgroundColor: colors.surfaceMuted },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 15, fontWeight: '700', color: colors.ink, flexShrink: 1 },
  cardMeta: { fontSize: 12, color: colors.inkMuted },
  badgeRow: { flexDirection: 'row', gap: spacing(1.5) },
  inactiveBadge: { backgroundColor: colors.dangerSoft, borderRadius: radius.pill, paddingHorizontal: spacing(2.5), paddingVertical: spacing(1) },
  inactiveBadgeText: { color: colors.danger, fontSize: 11, fontWeight: '700' },
  serviceBadge: { backgroundColor: colors.accentSoft, borderRadius: radius.pill, paddingHorizontal: spacing(2.5), paddingVertical: spacing(1) },
  serviceBadgeText: { color: colors.accent, fontSize: 11, fontWeight: '700' },
});
