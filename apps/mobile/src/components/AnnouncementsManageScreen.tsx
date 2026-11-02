import { useRouter } from 'expo-router';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { trpc } from '@/lib/trpc';
import { colors, radius, spacing } from '@/theme';

const AUDIENCE_LABEL: Record<string, string> = {
  all: 'Tüm müşteriler',
  organization: 'Seçili müşteriler',
  customer_group: 'Müşteri grubu',
};

export function AnnouncementsManageScreen() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const { data, isLoading, isFetching, refetch } = trpc.announcement.list.useQuery();
  const remove = trpc.announcement.remove.useMutation({
    onSuccess: () => void utils.announcement.list.invalidate(),
    onError: (e) => Alert.alert('Silinemedi', e.message),
  });

  return (
    <FlatList
      style={styles.flex}
      contentContainerStyle={styles.content}
      data={data ?? []}
      keyExtractor={(a) => a.id}
      refreshing={isFetching}
      onRefresh={() => void refetch()}
      ListHeaderComponent={
        <TouchableOpacity style={styles.newBtn} onPress={() => router.push('/producer/duyurular/yeni')}>
          <Text style={styles.newBtnText}>+ Yeni duyuru</Text>
        </TouchableOpacity>
      }
      ListEmptyComponent={
        isLoading ? (
          <ActivityIndicator style={{ marginTop: 24 }} color={colors.accent} />
        ) : (
          <Text style={styles.empty}>Duyuru yok.</Text>
        )
      }
      renderItem={({ item }) => (
        <View style={[styles.card, item.expired && styles.expired]}>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.body} numberOfLines={3}>
            {item.body}
          </Text>
          <Text style={styles.meta}>
            {AUDIENCE_LABEL[item.audience] ?? item.audience}
            {item.audience !== 'all' ? ` (${item.targetCount})` : ''}
            {item.expired ? ' · süresi doldu' : ''}
          </Text>
          <TouchableOpacity
            onPress={() =>
              Alert.alert('Duyuru silinsin mi?', item.title, [
                { text: 'Vazgeç', style: 'cancel' },
                { text: 'Sil', style: 'destructive', onPress: () => remove.mutate({ id: item.id }) },
              ])
            }
          >
            <Text style={styles.delete}>Sil</Text>
          </TouchableOpacity>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing(5), gap: spacing(2.5) },
  empty: { textAlign: 'center', color: colors.inkMuted, marginTop: spacing(6) },
  newBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing(3),
    alignItems: 'center',
  },
  newBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing(3.5),
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing(1),
  },
  expired: { opacity: 0.55 },
  title: { fontSize: 15, fontWeight: '700', color: colors.ink },
  body: { fontSize: 13, color: colors.ink },
  meta: { fontSize: 11, color: colors.inkMuted },
  delete: { color: colors.danger, fontWeight: '700', fontSize: 12, marginTop: spacing(1) },
});
