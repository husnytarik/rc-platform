import { ORDER_STATUS_LABELS_TR, type OrderStatus } from '@rc/shared';
import { useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { trpc } from '@/lib/trpc';
import { colors, radius, spacing } from '@/theme';

const RANGES = [7, 30, 90];

const money = (n: number): string =>
  `${n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺`;

export default function RaporlarScreen() {
  const [days, setDays] = useState(30);
  const q = trpc.report.summary.useQuery({ days });
  const d = q.data;

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => void q.refetch()} />}
    >
      <View style={styles.row}>
        {RANGES.map((r) => (
          <TouchableOpacity key={r} style={[styles.chip, r === days && styles.chipActive]} onPress={() => setDays(r)}>
            <Text style={[styles.chipText, r === days && styles.chipTextActive]}>Son {r} gün</Text>
          </TouchableOpacity>
        ))}
      </View>

      {q.isLoading || !d ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />
      ) : (
        <>
          <View style={styles.row}>
            <Stat label="Ciro" value={money(d.revenue)} />
            <Stat label="Sipariş" value={String(d.orderCount)} />
          </View>
          <View style={styles.row}>
            <Stat label="Açık destek talebi" value={String(d.openTickets)} />
            <Stat label="Stoğu biten varyant" value={String(d.outOfStockVariants)} />
          </View>

          <Text style={styles.section}>Duruma göre siparişler</Text>
          <View style={styles.card}>
            {d.byStatus.length === 0 && <Text style={styles.muted}>Bu aralıkta sipariş yok.</Text>}
            {d.byStatus.map((s) => (
              <View key={s.status} style={styles.line}>
                <Text style={styles.value}>{ORDER_STATUS_LABELS_TR[s.status as OrderStatus] ?? s.status}</Text>
                <Text style={styles.value}>{s.count}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.section}>En çok alan müşteriler</Text>
          <View style={styles.card}>
            {d.topCustomers.length === 0 && <Text style={styles.muted}>Veri yok.</Text>}
            {d.topCustomers.map((c) => (
              <View key={c.name} style={styles.line}>
                <View style={styles.flexInner}>
                  <Text style={styles.value}>{c.name}</Text>
                  <Text style={styles.muted}>{c.orders} sipariş</Text>
                </View>
                <Text style={styles.value}>{money(c.total)}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.section}>En çok satan ürünler</Text>
          <View style={styles.card}>
            {d.topProducts.length === 0 && <Text style={styles.muted}>Veri yok.</Text>}
            {d.topProducts.map((p) => (
              <View key={p.name} style={styles.line}>
                <View style={styles.flexInner}>
                  <Text style={styles.value}>{p.name}</Text>
                  <Text style={styles.muted}>{p.qty} adet/birim</Text>
                </View>
                <Text style={styles.value}>{money(p.total)}</Text>
              </View>
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.muted}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  flexInner: { flex: 1 },
  content: { padding: spacing(5), gap: spacing(2.5) },
  row: { flexDirection: 'row', gap: spacing(2) },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1.5),
    backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { fontSize: 12, fontWeight: '600', color: colors.ink },
  chipTextActive: { color: '#fff' },
  stat: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing(3.5),
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing(0.5),
  },
  statValue: { fontSize: 18, fontWeight: '800', color: colors.ink },
  section: { fontSize: 14, fontWeight: '700', color: colors.ink, marginTop: spacing(2) },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing(3.5),
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing(2),
  },
  line: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing(3) },
  value: { fontSize: 14, color: colors.ink, fontWeight: '600' },
  muted: { fontSize: 12, color: colors.inkMuted },
});
