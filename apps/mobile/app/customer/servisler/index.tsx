import { SERVICE_REQUEST_STATUS_LABELS_TR, type ServiceRequestStatus } from '@rc/shared';
import { useRouter } from 'expo-router';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { trpc } from '@/lib/trpc';
import { colors, radius, spacing } from '@/theme';

const STATUS_COLOR: Record<ServiceRequestStatus, string> = {
  new: colors.accent,
  in_review: '#b8860b',
  scheduled: '#3a7d5c',
  done: '#3a7d5c',
  rejected: colors.danger,
};

export default function ServislerScreen() {
  const router = useRouter();
  const services = trpc.service.listActive.useQuery();
  const requests = trpc.service.listRequests.useQuery({});

  const refreshing = services.isFetching || requests.isFetching;
  const onRefresh = (): void => {
    void services.refetch();
    void requests.refetch();
  };

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.sectionTitle}>Servis talebi oluştur</Text>
      {services.isLoading ? (
        <ActivityIndicator color={colors.accent} />
      ) : services.data && services.data.length > 0 ? (
        services.data.map((s) => (
          <TouchableOpacity
            key={s.id}
            style={styles.card}
            onPress={() => router.push({ pathname: '/customer/servisler/[id]', params: { id: s.id } })}
          >
            <Text style={styles.cardTitle}>{s.name}</Text>
            {s.description && <Text style={styles.cardMeta}>{s.description}</Text>}
            {s.basePrice != null && (
              <Text style={styles.cardMeta}>{s.basePrice.toFixed(2)} ₺&apos;den başlayan</Text>
            )}
            <Text style={styles.cardCta}>Talep oluştur →</Text>
          </TouchableOpacity>
        ))
      ) : (
        <Text style={styles.empty}>Şu an talep açılabilecek bir servis yok.</Text>
      )}

      <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>Taleplerim</Text>
      {requests.isLoading ? (
        <ActivityIndicator color={colors.accent} />
      ) : requests.data && requests.data.items.length > 0 ? (
        requests.data.items.map((r) => (
          <View key={r.id} style={styles.card}>
            <View style={styles.requestTop}>
              <Text style={styles.cardTitle}>{r.service.name}</Text>
              <View style={styles.badge}>
                <Text style={[styles.badgeText, { color: STATUS_COLOR[r.status] }]}>
                  {SERVICE_REQUEST_STATUS_LABELS_TR[r.status]}
                </Text>
              </View>
            </View>
            {r.note && <Text style={styles.cardMeta}>{r.note}</Text>}
            <Text style={styles.cardDate}>{new Date(r.createdAt).toLocaleDateString('tr-TR')}</Text>
          </View>
        ))
      ) : (
        <Text style={styles.empty}>Henüz servis talebiniz yok.</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing(5), gap: spacing(2.5) },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.ink, marginBottom: spacing(1) },
  sectionTitleSpaced: { marginTop: spacing(4) },
  empty: { fontSize: 13, color: colors.inkMuted },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing(3.5),
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing(1),
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: colors.ink, flexShrink: 1 },
  cardMeta: { fontSize: 12, color: colors.inkMuted },
  cardCta: { fontSize: 12, fontWeight: '700', color: colors.accent, marginTop: spacing(1) },
  cardDate: { fontSize: 11, color: colors.inkFaint },
  requestTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing(2) },
  badge: { backgroundColor: colors.surfaceMuted, borderRadius: radius.pill, paddingHorizontal: spacing(2.5), paddingVertical: spacing(1) },
  badgeText: { fontSize: 11, fontWeight: '700' },
});
