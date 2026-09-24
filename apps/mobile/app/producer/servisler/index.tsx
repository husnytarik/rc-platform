import {
  SERVICE_REQUEST_STATUSES,
  SERVICE_REQUEST_STATUS_LABELS_TR,
  type ServiceRequestStatus,
} from '@rc/shared';
import { Link } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { trpc } from '@/lib/trpc';
import { colors, radius, spacing } from '@/theme';

const STATUS_COLOR: Record<ServiceRequestStatus, string> = {
  new: colors.accent,
  in_review: '#b8860b',
  scheduled: '#3a7d5c',
  done: '#3a7d5c',
  rejected: colors.danger,
};

export default function ProducerServislerScreen() {
  const utils = trpc.useUtils();
  const [statusFilter, setStatusFilter] = useState<ServiceRequestStatus | undefined>(undefined);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [pendingStatus, setPendingStatus] = useState<ServiceRequestStatus | null>(null);

  const { data, isLoading, isFetching, fetchNextPage, hasNextPage, isFetchingNextPage, refetch } =
    trpc.service.listRequests.useInfiniteQuery(
      { limit: 30, status: statusFilter },
      { getNextPageParam: (last) => last.nextCursor ?? undefined },
    );
  const items = data?.pages.flatMap((p) => p.items) ?? [];

  const updateStatus = trpc.service.updateRequestStatus.useMutation({
    onSettled: () => {
      setPendingId(null);
      setPendingStatus(null);
      void utils.service.listRequests.invalidate();
    },
  });

  return (
    <FlatList
      style={styles.flex}
      contentContainerStyle={styles.listContent}
      data={items}
      keyExtractor={(r) => r.id}
      refreshing={isFetching && !isFetchingNextPage}
      onRefresh={() => void refetch()}
      onEndReachedThreshold={0.4}
      onEndReached={() => {
        if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
      }}
      ListHeaderComponent={
        <View style={styles.header}>
          <Link href="/producer/servisler/yeni" asChild>
            <TouchableOpacity style={styles.newButton}>
              <Text style={styles.newButtonText}>+ Yeni servis</Text>
            </TouchableOpacity>
          </Link>
          <View style={styles.filterRow}>
            <TouchableOpacity
              style={[styles.filterChip, statusFilter === undefined && styles.filterChipActive]}
              onPress={() => setStatusFilter(undefined)}
            >
              <Text style={[styles.filterChipText, statusFilter === undefined && styles.filterChipTextActive]}>
                Tümü
              </Text>
            </TouchableOpacity>
            {SERVICE_REQUEST_STATUSES.map((s) => (
              <TouchableOpacity
                key={s}
                style={[styles.filterChip, statusFilter === s && styles.filterChipActive]}
                onPress={() => setStatusFilter(s)}
              >
                <Text style={[styles.filterChipText, statusFilter === s && styles.filterChipTextActive]}>
                  {SERVICE_REQUEST_STATUS_LABELS_TR[s]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      }
      ListEmptyComponent={
        isLoading ? (
          <ActivityIndicator style={{ marginTop: 24 }} color={colors.accent} />
        ) : (
          <Text style={styles.empty}>Servis talebi yok.</Text>
        )
      }
      ListFooterComponent={
        isFetchingNextPage ? <ActivityIndicator style={{ marginVertical: 16 }} color={colors.accent} /> : null
      }
      renderItem={({ item }) => (
        <View style={styles.card}>
          <View style={styles.cardTop}>
            <Text style={styles.cardTitle}>{item.service.name}</Text>
            <Text style={[styles.statusLabel, { color: STATUS_COLOR[item.status] }]}>
              {SERVICE_REQUEST_STATUS_LABELS_TR[item.status]}
            </Text>
          </View>
          <Text style={styles.cardMeta}>{item.org.name}</Text>
          {item.note && <Text style={styles.cardNote}>{item.note}</Text>}
          <Text style={styles.cardDate}>{new Date(item.createdAt).toLocaleDateString('tr-TR')}</Text>

          <View style={styles.statusRow}>
            {SERVICE_REQUEST_STATUSES.filter((s) => s !== item.status).map((s) => (
              <TouchableOpacity
                key={s}
                style={styles.statusButton}
                disabled={pendingId === item.id}
                onPress={() => {
                  setPendingId(item.id);
                  setPendingStatus(s);
                  updateStatus.mutate({ id: item.id, status: s });
                }}
              >
                {pendingId === item.id && pendingStatus === s ? (
                  <ActivityIndicator size="small" color={STATUS_COLOR[s]} />
                ) : (
                  <Text style={[styles.statusButtonText, { color: STATUS_COLOR[s] }]}>
                    {SERVICE_REQUEST_STATUS_LABELS_TR[s]}
                  </Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  listContent: { padding: spacing(5), gap: spacing(2.5) },
  header: { gap: spacing(2.5), marginBottom: spacing(1) },
  newButton: { backgroundColor: colors.accent, borderRadius: radius.sm, paddingVertical: spacing(3), alignItems: 'center' },
  newButtonText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(1.5) },
  filterChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1.5),
  },
  filterChipActive: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  filterChipText: { fontSize: 12, color: colors.inkMuted, fontWeight: '600' },
  filterChipTextActive: { color: colors.accent },
  empty: { textAlign: 'center', color: colors.inkMuted, marginTop: spacing(6) },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing(3.5),
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing(1),
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing(2) },
  cardTitle: { fontSize: 15, fontWeight: '700', color: colors.ink, flexShrink: 1 },
  statusLabel: { fontSize: 12, fontWeight: '700' },
  cardMeta: { fontSize: 12, color: colors.inkMuted },
  cardNote: { fontSize: 13, color: colors.ink },
  cardDate: { fontSize: 11, color: colors.inkFaint },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(1.5), marginTop: spacing(1.5) },
  statusButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing(2.5),
    paddingVertical: spacing(1.5),
  },
  statusButtonText: { fontSize: 11, fontWeight: '700' },
});
