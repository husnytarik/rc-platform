import {
  SERVICE_REQUEST_STATUSES,
  SERVICE_REQUEST_STATUS_LABELS_TR,
  type ServiceRequestStatus,
} from '@rc/shared';
import { Link } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { trpc } from '@/lib/trpc';
import { colors, radius, spacing } from '@/theme';

const STATUS_COLOR: Record<ServiceRequestStatus, string> = {
  new: colors.accent,
  in_review: '#b8860b',
  scheduled: '#3a7d5c',
  done: '#3a7d5c',
  rejected: colors.danger,
};

function errText(e: unknown, fallback: string): string {
  const m = (e as { message?: string } | undefined)?.message;
  return m && m.length < 200 ? m : fallback;
}

interface AdminService {
  id: string;
  code: string;
  name: string;
  description: string | null;
  basePrice: number | null;
  isActive: boolean;
}

function ServiceEditor({ service }: { service: AdminService }) {
  const utils = trpc.useUtils();
  const [name, setName] = useState(service.name);
  const [description, setDescription] = useState(service.description ?? '');
  const [basePrice, setBasePrice] = useState(service.basePrice != null ? String(service.basePrice) : '');
  const [isActive, setIsActive] = useState(service.isActive);
  const [error, setError] = useState<string | null>(null);

  const update = trpc.service.update.useMutation({
    onSuccess: () => {
      void utils.service.adminList.invalidate();
      void utils.service.listActive.invalidate();
    },
    onError: (e) => setError(errText(e, 'Kaydedilemedi.')),
  });

  return (
    <View style={styles.editor}>
      <View style={styles.field}>
        <Text style={styles.label}>Ad</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} />
      </View>
      <View style={styles.field}>
        <Text style={styles.label}>Açıklama</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={description}
          onChangeText={setDescription}
          multiline
          placeholder="opsiyonel"
          placeholderTextColor={colors.inkFaint}
        />
      </View>
      <View style={styles.field}>
        <Text style={styles.label}>Başlangıç fiyatı</Text>
        <TextInput
          style={styles.input}
          value={basePrice}
          onChangeText={setBasePrice}
          keyboardType="decimal-pad"
          placeholder="opsiyonel"
          placeholderTextColor={colors.inkFaint}
        />
      </View>
      <TouchableOpacity style={styles.toggleRow} onPress={() => setIsActive((v) => !v)}>
        <View style={[styles.checkbox, isActive && styles.checkboxActive]} />
        <Text style={styles.toggleLabel}>Aktif (talep formunda görünür)</Text>
      </TouchableOpacity>
      {error && <Text style={styles.errorText}>{error}</Text>}
      <TouchableOpacity
        style={[styles.saveButton, update.isPending && styles.saveButtonDisabled]}
        disabled={update.isPending}
        onPress={() => {
          setError(null);
          const price = basePrice.trim() ? Number(basePrice.replace(',', '.')) : null;
          update.mutate({
            id: service.id,
            name: name.trim(),
            description: description.trim() || null,
            basePrice: price !== null && Number.isFinite(price) ? price : null,
            isActive,
          });
        }}
      >
        {update.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Kaydet</Text>}
      </TouchableOpacity>
    </View>
  );
}

function ServiceCatalogSection() {
  const { data } = trpc.service.adminList.useQuery();
  const [openId, setOpenId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(true);

  if (!data || data.length === 0) return null;

  return (
    <View style={styles.catalogCard}>
      <TouchableOpacity style={styles.catalogHeader} onPress={() => setCollapsed((c) => !c)}>
        <Text style={styles.sectionLabel}>Servis kataloğu ({data.length})</Text>
        <Text style={styles.chevron}>{collapsed ? '+' : '−'}</Text>
      </TouchableOpacity>
      {!collapsed &&
        data.map((s) => {
          const isOpen = openId === s.id;
          return (
            <View key={s.id} style={styles.catalogRow}>
              <TouchableOpacity style={styles.catalogRowTop} onPress={() => setOpenId(isOpen ? null : s.id)}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{s.name}</Text>
                  <Text style={styles.cardMeta}>
                    {s.code}
                    {s.basePrice != null ? ` · ${s.basePrice.toFixed(2)}` : ''}
                    {!s.isActive ? ' · pasif' : ''}
                  </Text>
                </View>
                <Text style={styles.chevron}>{isOpen ? '−' : '+'}</Text>
              </TouchableOpacity>
              {isOpen && <ServiceEditor service={s} />}
            </View>
          );
        })}
    </View>
  );
}

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
          <ServiceCatalogSection />
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
  catalogCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(3.5),
    gap: spacing(2),
  },
  catalogHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionLabel: { fontSize: 13, color: colors.inkMuted, fontWeight: '700' },
  chevron: { fontSize: 18, color: colors.inkMuted, fontWeight: '700' },
  catalogRow: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing(2), gap: spacing(2) },
  catalogRowTop: { flexDirection: 'row', alignItems: 'center', gap: spacing(2) },
  rowTitle: { fontSize: 14, fontWeight: '600', color: colors.ink },
  editor: { gap: spacing(2.5), paddingLeft: spacing(1) },
  field: { gap: spacing(1.5) },
  label: { fontSize: 12, color: colors.inkMuted, fontWeight: '600' },
  input: {
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2.5),
    fontSize: 13,
    color: colors.ink,
  },
  multiline: { minHeight: 70, textAlignVertical: 'top' },
  errorText: { color: colors.danger, fontSize: 12 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(2.5) },
  checkbox: { width: 20, height: 20, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border },
  checkboxActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  toggleLabel: { fontSize: 13, color: colors.ink, fontWeight: '600' },
  saveButton: { backgroundColor: colors.accent, borderRadius: radius.sm, paddingVertical: spacing(3), alignItems: 'center' },
  saveButtonDisabled: { backgroundColor: colors.border },
  saveButtonText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});
