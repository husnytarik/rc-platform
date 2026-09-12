import { isProducerRole, ROLE_LABELS_TR, type Role } from '@rc/shared';
import { Redirect } from 'expo-router';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '@/providers/auth-context';
import { trpc } from '@/lib/trpc';

export default function HomeScreen() {
  const { status, identity, logout } = useAuth();
  // Hook sayısı render'lar arası sabit kalmalı — erken return'lerden önce çağır,
  // gerçek veri yalnız aktif/onaylı kullanıcıda gerekiyor (enabled ile geciktir).
  const ready = status === 'authenticated' && identity !== null && !identity.pending;
  const categories = trpc.catalog.categories.useQuery(undefined, { enabled: ready });
  const products = trpc.catalog.list.useQuery({ limit: 10 }, { enabled: ready });

  if (status === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#c2410c" size="large" />
      </View>
    );
  }
  if (status === 'anonymous' || !identity) return <Redirect href="/login" />;

  if (identity.pending) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Merhaba, {identity.fullName ?? identity.phone}</Text>
        <Text style={styles.pending}>
          Başvurun inceleniyor. Onaylandığında bu ekrandan katalog ve siparişlerine
          erişebileceksin.
        </Text>
        <TouchableOpacity style={styles.logoutButton} onPress={logout}>
          <Text style={styles.logoutText}>Çıkış yap</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const producer = identity.roles.some((r) => isProducerRole(r));
  const roleLabels = identity.roles.map((r) => ROLE_LABELS_TR[r as Role]).join(', ');

  return (
    <View style={styles.flex}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Merhaba, {identity.fullName ?? identity.phone}</Text>
          <Text style={styles.role}>{roleLabels}</Text>
        </View>
        <TouchableOpacity onPress={logout}>
          <Text style={styles.logoutLink}>Çıkış</Text>
        </TouchableOpacity>
      </View>

      {producer && categories.data && (
        <Text style={styles.sectionNote}>
          {categories.data.length} kategori · üretici görünümü (gerçek stok görünür)
        </Text>
      )}

      <FlatList
        style={styles.flex}
        contentContainerStyle={styles.listContent}
        data={products.data?.items ?? []}
        keyExtractor={(p) => p.id}
        refreshing={products.isFetching}
        onRefresh={() => void products.refetch()}
        ListEmptyComponent={
          products.isLoading ? (
            <ActivityIndicator style={{ marginTop: 24 }} color="#c2410c" />
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
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#fffaf5' },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
    backgroundColor: '#fffaf5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
  },
  greeting: { fontSize: 18, fontWeight: '700', color: '#3a2418' },
  role: { fontSize: 13, color: '#8a7a6c', marginTop: 2 },
  logoutLink: { color: '#c2410c', fontSize: 14, fontWeight: '600' },
  logoutButton: {
    backgroundColor: '#c2410c',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  logoutText: { color: '#fff', fontWeight: '600' },
  title: { fontSize: 20, fontWeight: '700', color: '#3a2418', textAlign: 'center' },
  pending: { fontSize: 15, color: '#7a6a5c', textAlign: 'center' },
  sectionNote: { paddingHorizontal: 20, color: '#8a7a6c', fontSize: 12, marginBottom: 8 },
  listContent: { paddingHorizontal: 20, paddingBottom: 32, gap: 10 },
  empty: { textAlign: 'center', color: '#8a7a6c', marginTop: 24 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#f0e4d8',
  },
  cardTitle: { fontSize: 15, fontWeight: '600', color: '#3a2418' },
  cardMeta: { fontSize: 12, color: '#8a7a6c', marginTop: 2 },
  cardPrice: { fontSize: 14, color: '#c2410c', fontWeight: '700', marginTop: 6 },
});
