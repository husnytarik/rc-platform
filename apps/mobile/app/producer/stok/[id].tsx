import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { trpc } from '@/lib/trpc';
import { colors, radius, spacing } from '@/theme';

type StockBadge = 'in' | 'low' | 'out' | 'preorder' | 'incoming' | 'closed';
type ManualReason = 'purchase' | 'production_in' | 'adjustment' | 'correction';
type DisplayState = 'in_stock' | 'limited' | 'preorder' | 'incoming' | 'closed';
type StockReason = ManualReason | 'order_reserve' | 'order_release';

const STOCK_META: Record<StockBadge, { label: string; color: string }> = {
  in: { label: 'Stokta', color: '#3a7d5c' },
  low: { label: 'Az kaldı', color: '#b8860b' },
  out: { label: 'Tükendi', color: colors.danger },
  preorder: { label: 'Ön sipariş', color: colors.accent },
  incoming: { label: 'Yolda', color: colors.accent },
  closed: { label: 'Kapalı', color: colors.inkMuted },
};

const MANUAL_REASONS: { value: ManualReason; label: string }[] = [
  { value: 'purchase', label: 'Satın alma girişi' },
  { value: 'production_in', label: 'Üretimden giriş' },
  { value: 'adjustment', label: 'Elle düzeltme' },
  { value: 'correction', label: 'Hata düzeltme' },
];

const REASON_LABEL: Record<StockReason, string> = {
  purchase: 'Satın alma girişi',
  production_in: 'Üretimden giriş',
  order_reserve: 'Sipariş rezervi',
  order_release: 'Sipariş iptali/iadesi',
  adjustment: 'Elle düzeltme',
  correction: 'Hata düzeltme',
};

const DISPLAY_STATE_META: Record<DisplayState, { label: string }> = {
  in_stock: { label: 'Stokta (elle sabitle)' },
  limited: { label: 'Az kaldı' },
  preorder: { label: 'Ön sipariş' },
  incoming: { label: 'Yolda' },
  closed: { label: 'Kapalı' },
};
const DISPLAY_STATES = Object.keys(DISPLAY_STATE_META) as DisplayState[];

function errText(e: unknown, fallback: string): string {
  const m = (e as { message?: string } | undefined)?.message;
  return m && m.length < 200 ? m : fallback;
}

function formatDateTime(d: string | Date): string {
  return new Date(d).toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function OverrideCard({ productId }: { productId: string }) {
  const utils = trpc.useUtils();
  const { data: override, isLoading } = trpc.stock.override.useQuery({ productId });
  const [state, setState] = useState<DisplayState>('in_stock');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const invalidate = (): void => {
    void utils.stock.override.invalidate({ productId });
    void utils.catalog.product.invalidate({ id: productId });
    void utils.catalog.list.invalidate();
  };
  const setOverride = trpc.stock.setOverride.useMutation({
    onSuccess: () => {
      setNote('');
      invalidate();
    },
    onError: (e) => setError(errText(e, 'İşlem tamamlanamadı.')),
  });
  const clearOverride = trpc.stock.clearOverride.useMutation({
    onSuccess: invalidate,
    onError: (e) => setError(errText(e, 'İşlem tamamlanamadı.')),
  });

  if (isLoading) return <ActivityIndicator color={colors.accent} style={{ marginVertical: 12 }} />;

  return (
    <View style={styles.card}>
      <Text style={styles.sectionLabel}>Gösterim override</Text>

      {override ? (
        <View style={styles.overrideRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.overrideState}>{DISPLAY_STATE_META[override.state as DisplayState].label}</Text>
            {override.note && <Text style={styles.cardMeta}>{override.note}</Text>}
            <Text style={styles.cardDate}>{formatDateTime(override.updatedAt)} itibarıyla</Text>
          </View>
          <TouchableOpacity
            style={styles.ghostButton}
            disabled={clearOverride.isPending}
            onPress={() => clearOverride.mutate({ productId })}
          >
            <Text style={styles.ghostButtonText}>Kaldır</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <Text style={styles.cardMeta}>Şu an override yok — gerçek bakiyeden hesaplanıyor.</Text>
      )}

      <View style={styles.chipRow}>
        {DISPLAY_STATES.map((s) => (
          <TouchableOpacity
            key={s}
            style={[styles.chip, state === s && styles.chipActive]}
            onPress={() => setState(s)}
          >
            <Text style={[styles.chipText, state === s && styles.chipTextActive]}>
              {DISPLAY_STATE_META[s].label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <TextInput
        style={styles.input}
        value={note}
        onChangeText={setNote}
        placeholder="Not (opsiyonel)"
        placeholderTextColor={colors.inkFaint}
      />
      <TouchableOpacity
        style={styles.primaryButton}
        disabled={setOverride.isPending}
        onPress={() => setOverride.mutate({ productId, state, note: note.trim() || undefined })}
      >
        {setOverride.isPending ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.primaryButtonText}>Uygula</Text>
        )}
      </TouchableOpacity>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

function LedgerPanel({ variantId, productId }: { variantId: string; productId: string }) {
  const utils = trpc.useUtils();
  const [delta, setDelta] = useState('');
  const [reason, setReason] = useState<ManualReason>('purchase');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    trpc.stock.ledger.useInfiniteQuery(
      { variantId, limit: 20 },
      { getNextPageParam: (last) => last.nextCursor ?? undefined },
    );
  const rows = data?.pages.flatMap((p) => p.items) ?? [];

  const adjust = trpc.stock.adjust.useMutation({
    onSuccess: () => {
      setDelta('');
      setNote('');
      void utils.stock.ledger.invalidate({ variantId });
      void utils.catalog.product.invalidate({ id: productId });
      void utils.catalog.list.invalidate();
    },
    onError: (e) => setError(errText(e, 'Hareket eklenemedi.')),
  });

  const parsedDelta = Number(delta.replace(',', '.'));
  const canSubmit = delta.trim() !== '' && Number.isFinite(parsedDelta) && parsedDelta !== 0;

  return (
    <View style={styles.ledger}>
      <View style={styles.chipRow}>
        {MANUAL_REASONS.map((r) => (
          <TouchableOpacity
            key={r.value}
            style={[styles.chip, reason === r.value && styles.chipActive]}
            onPress={() => setReason(r.value)}
          >
            <Text style={[styles.chipText, reason === r.value && styles.chipTextActive]}>{r.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.ledgerInputRow}>
        <TextInput
          style={[styles.input, styles.deltaInput]}
          value={delta}
          onChangeText={setDelta}
          placeholder="+10 / -5"
          placeholderTextColor={colors.inkFaint}
          keyboardType="numbers-and-punctuation"
        />
        <TextInput
          style={[styles.input, { flex: 1 }]}
          value={note}
          onChangeText={setNote}
          placeholder="Not (opsiyonel)"
          placeholderTextColor={colors.inkFaint}
        />
      </View>
      <TouchableOpacity
        style={[styles.primaryButton, !canSubmit && styles.primaryButtonDisabled]}
        disabled={!canSubmit || adjust.isPending}
        onPress={() => adjust.mutate({ variantId, delta: parsedDelta, reason, note: note.trim() || undefined })}
      >
        {adjust.isPending ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.primaryButtonText}>Hareket ekle</Text>
        )}
      </TouchableOpacity>
      {error && <Text style={styles.errorText}>{error}</Text>}

      {isLoading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: spacing(2) }} />
      ) : rows.length === 0 ? (
        <Text style={styles.cardMeta}>Hareket yok.</Text>
      ) : (
        <View style={styles.ledgerRows}>
          {rows.map((r) => (
            <View key={r.id} style={styles.ledgerRowItem}>
              <Text style={styles.cardDate}>{formatDateTime(r.createdAt)}</Text>
              <Text style={styles.cardMeta}>{REASON_LABEL[r.reason as StockReason]}</Text>
              <Text style={[styles.ledgerDelta, { color: r.delta > 0 ? '#3a7d5c' : colors.danger }]}>
                {r.delta > 0 ? `+${r.delta}` : r.delta}
              </Text>
              {r.note && <Text style={styles.cardMeta}>{r.note}</Text>}
            </View>
          ))}
        </View>
      )}
      {hasNextPage && (
        <TouchableOpacity
          style={styles.ghostButton}
          disabled={isFetchingNextPage}
          onPress={() => void fetchNextPage()}
        >
          <Text style={styles.ghostButtonText}>{isFetchingNextPage ? 'Yükleniyor…' : 'Daha fazla'}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function StokDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: p, isLoading } = trpc.catalog.product.useQuery({ id });
  const [openVariant, setOpenVariant] = useState<string | null>(null);

  if (isLoading) {
    return (
      <View style={styles.flexCenter}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }
  if (!p) {
    return (
      <View style={styles.flexCenter}>
        <Text style={styles.cardMeta}>Ürün bulunamadı.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{p.name}</Text>

      <OverrideCard productId={p.id} />

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>Varyantlar ({p.variants.length})</Text>
        {p.variants.length === 0 ? (
          <Text style={styles.cardMeta}>Aktif varyant yok.</Text>
        ) : (
          p.variants.map((v) => {
            const badge = STOCK_META[v.stock.badge as StockBadge];
            const isOpen = openVariant === v.id;
            return (
              <View key={v.id} style={styles.variantBlock}>
                <TouchableOpacity
                  style={styles.variantRow}
                  onPress={() => setOpenVariant(isOpen ? null : v.id)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>{v.name}</Text>
                    <Text style={styles.cardMeta}>
                      {v.code} · {v.orderUomLabel} · bakiye {v.stock.available ?? '—'}
                    </Text>
                  </View>
                  <View style={[styles.badge, { borderColor: badge.color }]}>
                    <View style={[styles.badgeDot, { backgroundColor: badge.color }]} />
                    <Text style={[styles.badgeText, { color: badge.color }]}>{badge.label}</Text>
                  </View>
                </TouchableOpacity>
                {isOpen && <LedgerPanel variantId={v.id} productId={p.id} />}
              </View>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  flexCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  content: { padding: spacing(5), gap: spacing(4) },
  title: { fontSize: 18, fontWeight: '700', color: colors.ink },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing(3.5),
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing(2.5),
  },
  sectionLabel: { fontSize: 13, color: colors.inkMuted, fontWeight: '700' },
  cardMeta: { fontSize: 12, color: colors.inkMuted },
  cardDate: { fontSize: 11, color: colors.inkFaint },
  overrideRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(2) },
  overrideState: { fontSize: 14, fontWeight: '700', color: colors.ink },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(1.5) },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1.5),
  },
  chipActive: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  chipText: { fontSize: 12, color: colors.inkMuted, fontWeight: '600' },
  chipTextActive: { color: colors.accent },
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
  ledgerInputRow: { flexDirection: 'row', gap: spacing(2) },
  deltaInput: { width: 110 },
  primaryButton: { backgroundColor: colors.accent, borderRadius: radius.sm, paddingVertical: spacing(3), alignItems: 'center' },
  primaryButtonDisabled: { backgroundColor: colors.border },
  primaryButtonText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  ghostButton: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: spacing(3), paddingVertical: spacing(2), alignItems: 'center' },
  ghostButtonText: { color: colors.inkMuted, fontWeight: '600', fontSize: 12 },
  errorText: { color: colors.danger, fontSize: 12 },
  variantBlock: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing(2.5) },
  variantRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(2) },
  rowTitle: { fontSize: 14, fontWeight: '600', color: colors.ink },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1),
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing(2.5),
    paddingVertical: spacing(1),
  },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  ledger: { marginTop: spacing(3), gap: spacing(2.5), paddingLeft: spacing(1) },
  ledgerRows: { gap: spacing(1.5) },
  ledgerRowItem: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing(1.5), gap: 2 },
  ledgerDelta: { fontSize: 13, fontWeight: '700' },
});
