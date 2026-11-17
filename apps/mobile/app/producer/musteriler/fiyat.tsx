import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { CategoryChips } from '@/components/CategoryChips';
import { trpc } from '@/lib/trpc';
import { colors, radius, spacing, shadow } from '@/theme';

const PCTS = [5, 10, 15, 20];

/** Yönetici: seçili firmaya özel fiyatlar. Kategoriye toplu % indirim veya ürün bazında elle fiyat. */
export default function FirmaFiyatScreen() {
  const { orgId, name } = useLocalSearchParams<{ orgId: string; name?: string }>();
  const utils = trpc.useUtils();
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);

  const q = trpc.catalog.customerPrices.useQuery({
    orgId,
    search: search.trim() || undefined,
    categoryId: categoryId ?? undefined,
  });
  const refresh = (): void => void utils.catalog.customerPrices.invalidate();
  const setPrice = trpc.catalog.setCustomerPrice.useMutation({ onSuccess: refresh, onError: () => setMsg('Kaydedilemedi.') });
  const bulk = trpc.catalog.setCustomerCategoryDiscount.useMutation({
    onSuccess: (r) => {
      setMsg(`${r.count} ürüne uygulandı.`);
      refresh();
    },
    onError: () => setMsg('Uygulanamadı.'),
  });

  return (
    <FlatList
      style={styles.flex}
      contentContainerStyle={styles.content}
      data={q.data ?? []}
      keyExtractor={(v) => v.variantId}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        <View style={styles.head}>
          <Text style={styles.h1}>{name ?? 'Firma'} · özel fiyatlar</Text>
          <TextInput style={styles.input} value={search} onChangeText={setSearch} placeholder="Ürün ara…" placeholderTextColor={colors.inkFaint} autoCapitalize="none" />
          <CategoryChips value={categoryId} onChange={setCategoryId} mode="id" />
          {categoryId && (
            <View style={styles.bulk}>
              <Text style={styles.label}>Bu kategoriye liste fiyatından indirim:</Text>
              <View style={styles.row}>
                {PCTS.map((p) => (
                  <TouchableOpacity key={p} style={styles.chip} disabled={bulk.isPending} onPress={() => bulk.mutate({ orgId, categoryId, pct: p })}>
                    <Text style={styles.chipText}>%{p}</Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity style={styles.chip} disabled={bulk.isPending} onPress={() => bulk.mutate({ orgId, categoryId, pct: 0 })}>
                  <Text style={[styles.chipText, { color: colors.danger }]}>Kaldır</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          {msg && <Text style={styles.msg}>{msg}</Text>}
          {q.isLoading && <ActivityIndicator color={colors.accent} />}
        </View>
      }
      renderItem={({ item: v }) => {
        const val = edits[v.variantId] ?? v.customPrice ?? '';
        const dirty = (edits[v.variantId] ?? v.customPrice ?? '') !== (v.customPrice ?? '');
        return (
          <View style={styles.card}>
            <View style={styles.flex}>
              <Text style={styles.title}>{v.productName}</Text>
              <Text style={styles.meta}>
                {v.variantName} · liste {v.basePrice} ₺
              </Text>
            </View>
            <TextInput
              style={[styles.price, v.customPrice && styles.priceOn]}
              value={val}
              onChangeText={(t) => setEdits((e) => ({ ...e, [v.variantId]: t.replace(',', '.') }))}
              placeholder="özel ₺"
              placeholderTextColor={colors.inkFaint}
              keyboardType="decimal-pad"
            />
            {dirty && (
              <TouchableOpacity
                onPress={() => {
                  const t = (edits[v.variantId] ?? '').trim();
                  const n = t === '' ? null : Number(t);
                  if (n !== null && Number.isNaN(n)) return;
                  setMsg(null);
                  setPrice.mutate({ orgId, variantId: v.variantId, price: n }, { onSuccess: () => setEdits((e) => { const { [v.variantId]: _x, ...rest } = e; return rest; }) });
                }}
              >
                <Text style={styles.save}>Kaydet</Text>
              </TouchableOpacity>
            )}
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing(5), gap: spacing(2), paddingBottom: spacing(10) },
  head: { gap: spacing(2.5), marginBottom: spacing(2) },
  h1: { fontSize: 18, fontWeight: '800', color: colors.ink },
  input: { backgroundColor: colors.surface, borderRadius: radius.sm, paddingHorizontal: spacing(3), paddingVertical: spacing(2.5), fontSize: 15, color: colors.ink, ...shadow.card },
  bulk: { gap: spacing(1.5) },
  label: { fontSize: 12, color: colors.inkMuted, fontWeight: '600' },
  row: { flexDirection: 'row', gap: spacing(2), flexWrap: 'wrap' },
  chip: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: spacing(3.5), paddingVertical: spacing(2) },
  chipText: { fontSize: 13, fontWeight: '700', color: colors.accent },
  msg: { color: colors.accent, fontSize: 13 },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing(2), backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing(3), ...shadow.card },
  title: { fontSize: 14, fontWeight: '700', color: colors.ink },
  meta: { fontSize: 12, color: colors.inkMuted, marginTop: 2 },
  price: { width: 84, backgroundColor: colors.bg, borderRadius: radius.sm, paddingHorizontal: spacing(2), paddingVertical: spacing(2), fontSize: 14, color: colors.ink, textAlign: 'right' },
  priceOn: { backgroundColor: colors.accentSoft, color: colors.accent, fontWeight: '800' },
  save: { color: colors.accent, fontWeight: '800', fontSize: 13 },
});
