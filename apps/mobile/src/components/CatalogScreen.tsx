import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { trpc } from '@/lib/trpc';
import { colors, radius, spacing } from '@/theme';

/** Ürün listesi — üretici ve müşteri tarafında aynı görünüm, fiyat/stok görünürlüğü sunucu tarafından belirlenir. */
export function CatalogScreen() {
  const products = trpc.catalog.list.useQuery({ limit: 30 });

  return (
    <FlatList
      style={styles.flex}
      contentContainerStyle={styles.listContent}
      data={products.data?.items ?? []}
      keyExtractor={(p) => p.id}
      refreshing={products.isFetching}
      onRefresh={() => void products.refetch()}
      ListEmptyComponent={
        products.isLoading ? (
          <ActivityIndicator style={{ marginTop: 24 }} color={colors.accent} />
        ) : (
          <Text style={styles.empty}>Katalogda ürün yok.</Text>
        )
      }
      renderItem={({ item }) => {
        const price = item.variants[0]?.price;
        return (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{item.name}</Text>
            <Text style={styles.cardMeta}>{item.categoryName ?? '—'}</Text>
            <Text style={styles.cardPrice}>
              {price ? `${price.unitPrice} ${price.currency}` : 'Fiyat yok'}
            </Text>
          </View>
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
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: { fontSize: 15, fontWeight: '600', color: colors.ink },
  cardMeta: { fontSize: 12, color: colors.inkMuted, marginTop: 2 },
  cardPrice: { fontSize: 14, color: colors.accent, fontWeight: '700', marginTop: spacing(1.5) },
});
