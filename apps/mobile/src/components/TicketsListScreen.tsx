import { useRouter, type Href } from 'expo-router';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { trpc } from '@/lib/trpc';
import { colors, radius, spacing } from '@/theme';
import { TICKET_STATUS_COLOR, ticketStatusLabel } from './ticket-ui';

/** Destek talepleri listesi — müşteri kendi firmasını, personel hepsini görür. */
export function TicketsListScreen({ basePath, staff }: { basePath: string; staff: boolean }) {
  const router = useRouter();
  const { data, isLoading, isFetching, refetch } = trpc.ticket.list.useQuery({});

  return (
    <FlatList
      style={styles.flex}
      contentContainerStyle={styles.content}
      data={data ?? []}
      keyExtractor={(t) => t.id}
      refreshing={isFetching}
      onRefresh={() => void refetch()}
      ListHeaderComponent={
        staff ? null : (
          <TouchableOpacity style={styles.newBtn} onPress={() => router.push(`${basePath}/yeni` as Href)}>
            <Text style={styles.newBtnText}>+ Yeni destek talebi</Text>
          </TouchableOpacity>
        )
      }
      ListEmptyComponent={
        isLoading ? (
          <ActivityIndicator style={{ marginTop: 24 }} color={colors.accent} />
        ) : (
          <Text style={styles.empty}>Destek talebi yok.</Text>
        )
      }
      renderItem={({ item }) => (
        <TouchableOpacity style={styles.card} onPress={() => router.push(`${basePath}/${item.id}` as Href)}>
          <View style={styles.top}>
            <Text style={styles.title} numberOfLines={1}>
              {item.subject}
            </Text>
            <Text style={[styles.status, { color: TICKET_STATUS_COLOR[item.status] }]}>
              {ticketStatusLabel(item.status, staff)}
            </Text>
          </View>
          <Text style={styles.meta}>
            {item.keyCode}
            {staff ? ` · ${item.orgName}` : ''}
            {item.orderKeyCode ? ` · Sipariş ${item.orderKeyCode}` : ''} · {item.messageCount} mesaj
          </Text>
          <Text style={styles.date}>{new Date(item.updatedAt).toLocaleString('tr-TR')}</Text>
        </TouchableOpacity>
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
    marginBottom: spacing(1),
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
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing(2) },
  title: { fontSize: 15, fontWeight: '700', color: colors.ink, flexShrink: 1 },
  status: { fontSize: 11, fontWeight: '700' },
  meta: { fontSize: 12, color: colors.inkMuted },
  date: { fontSize: 11, color: colors.inkFaint },
});
