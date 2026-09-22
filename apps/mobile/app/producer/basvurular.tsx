import { useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { trpc } from '@/lib/trpc';
import { colors, radius, spacing } from '@/theme';

function errText(e: unknown, fallback: string): string {
  const m = (e as { message?: string } | undefined)?.message;
  return m && m.length < 200 ? m : fallback;
}

function formatDate(d: string | Date): string {
  return new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function BasvurularScreen() {
  const utils = trpc.useUtils();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading, isFetching, fetchNextPage, hasNextPage, isFetchingNextPage, refetch } =
    trpc.membership.requests.useInfiniteQuery(
      { status: 'pending' },
      { getNextPageParam: (last) => last.nextCursor ?? undefined },
    );
  const items = data?.pages.flatMap((p) => p.items) ?? [];

  const invalidate = (): void => void utils.membership.requests.invalidate();
  const approve = trpc.membership.approve.useMutation({ onSuccess: invalidate });
  const reject = trpc.membership.reject.useMutation({ onSuccess: invalidate });

  const onApprove = (id: string): void => {
    setError(null);
    setBusyId(id);
    approve.mutate(
      { id },
      {
        onError: (e: unknown) => setError(errText(e, 'Onaylanamadı.')),
        onSettled: () => setBusyId(null),
      },
    );
  };

  const onReject = (id: string): void => {
    setError(null);
    setBusyId(id);
    reject.mutate(
      { id, reviewNote: 'Mobil üzerinden reddedildi.' },
      {
        onError: (e: unknown) => setError(errText(e, 'Reddedilemedi.')),
        onSettled: () => setBusyId(null),
      },
    );
  };

  return (
    <View style={styles.flex}>
      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
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
        ListEmptyComponent={
          isLoading ? (
            <ActivityIndicator style={{ marginTop: 24 }} color={colors.accent} />
          ) : (
            <Text style={styles.empty}>Bekleyen başvuru yok.</Text>
          )
        }
        ListFooterComponent={
          isFetchingNextPage ? <ActivityIndicator style={{ marginVertical: 16 }} color={colors.accent} /> : null
        }
        renderItem={({ item }) => {
          const busy = busyId === item.id;
          return (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{item.requestedOrgName}</Text>
              <Text style={styles.cardMeta}>{item.fullName ?? '—'} · {item.phone}</Text>
              {item.note && <Text style={styles.cardNote}>{item.note}</Text>}
              <Text style={styles.cardDate}>{formatDate(item.createdAt)}</Text>
              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.rejectButton]}
                  disabled={busy}
                  onPress={() => onReject(item.id)}
                >
                  {busy ? <ActivityIndicator color={colors.danger} /> : <Text style={styles.rejectText}>Reddet</Text>}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.approveButton]}
                  disabled={busy}
                  onPress={() => onApprove(item.id)}
                >
                  {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.approveText}>Onayla</Text>}
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  listContent: { padding: spacing(5), gap: spacing(2.5) },
  empty: { textAlign: 'center', color: colors.inkMuted, marginTop: spacing(6) },
  errorBox: { margin: spacing(5), marginBottom: 0, backgroundColor: colors.dangerSoft, borderRadius: radius.sm, padding: spacing(3) },
  errorText: { color: colors.danger, fontSize: 13 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing(3.5),
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing(1),
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: colors.ink },
  cardMeta: { fontSize: 12, color: colors.inkMuted },
  cardNote: { fontSize: 12, color: colors.inkMuted, fontStyle: 'italic' },
  cardDate: { fontSize: 11, color: colors.inkFaint },
  actions: { flexDirection: 'row', gap: spacing(2), marginTop: spacing(2) },
  actionButton: {
    flex: 1,
    borderRadius: radius.sm,
    paddingVertical: spacing(2.5),
    alignItems: 'center',
  },
  rejectButton: { borderWidth: 1, borderColor: colors.danger, backgroundColor: colors.surface },
  rejectText: { color: colors.danger, fontWeight: '700', fontSize: 13 },
  approveButton: { backgroundColor: colors.accent },
  approveText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});
