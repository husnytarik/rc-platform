import {
  MAIN_LINE,
  isTerminal,
  ORDER_STATUS_LABELS_TR,
  ORDER_STATUS_META,
  ROLE_LABELS_TR,
  type OrderStatus,
  type Role,
} from '@rc/shared';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/providers/auth-context';
import { AddLineModal } from './AddLineModal';
import { colors, radius, spacing } from '@/theme';

function errText(e: unknown, fallback: string): string {
  const m = (e as { message?: string } | undefined)?.message;
  return m && m.length < 200 ? m : fallback;
}

function formatDateTime(d: string | Date): string {
  return new Date(d).toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const DESTRUCTIVE: readonly OrderStatus[] = ['cancelled', 'delivery_issue'];

/** Sipariş detayı: durum çizelgesi, kalemler, teslimat bilgisi ve role göre sıradaki adımlar. */
export function OrderDetailScreen({ orderRef }: { orderRef: string }) {
  const utils = trpc.useUtils();
  const { can } = useAuth();
  const [adding, setAdding] = useState(false);
  const q = trpc.orders.get.useQuery({ order: orderRef });

  const transition = trpc.orders.transition.useMutation({
    onSuccess: () => {
      void utils.orders.get.invalidate({ order: orderRef });
      void utils.orders.list.invalidate();
    },
    onError: (e) => Alert.alert('İşlem yapılamadı', errText(e, 'Tekrar dener misin?')),
  });

  if (q.isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }
  if (q.isError || !q.data) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>Sipariş bulunamadı.</Text>
      </View>
    );
  }

  const o = q.data;
  const status = o.status as OrderStatus;
  const meta = ORDER_STATUS_META[status];
  const reachedIdx = MAIN_LINE.indexOf(status);

  // Yan durumdaysa (iptal, beklemede...) ana hattı son ulaşılan adıma göre işaretle.
  const lastMainFromEvents = o.events
    .map((e) => (e.toStatus ? MAIN_LINE.indexOf(e.toStatus as OrderStatus) : -1))
    .reduce((a, b) => Math.max(a, b), -1);
  const progressIdx = reachedIdx >= 0 ? reachedIdx : lastMainFromEvents;

  const runStep = (to: OrderStatus, label: string): void => {
    const go = (): void => transition.mutate({ order: o.id, to });
    if (DESTRUCTIVE.includes(to)) {
      Alert.alert(label, `${o.keyCode} siparişi için "${label}" işlemi yapılsın mı?`, [
        { text: 'Vazgeç', style: 'cancel' },
        { text: 'Evet', style: 'destructive', onPress: go },
      ]);
    } else {
      go();
    }
  };

  const callPhone = (phone: string): void => void Linking.openURL(`tel:${phone}`);

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={q.isFetching && !q.isLoading} onRefresh={() => void q.refetch()} />
      }
    >
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.code}>{o.keyCode}</Text>
          <View style={[styles.badge, { borderColor: meta.color }]}>
            <View style={[styles.dot, { backgroundColor: meta.color }]} />
            <Text style={[styles.badgeText, { color: meta.color }]}>
              {ORDER_STATUS_LABELS_TR[status]}
            </Text>
          </View>
        </View>
        <Text style={styles.muted}>
          {o.customerName} · {o.branchName}
        </Text>
        <Text style={styles.muted}>{formatDateTime(o.createdAt)}</Text>
      </View>

      {o.nextSteps.length > 0 && (
        <View style={styles.actions}>
          {o.nextSteps.map((s) => {
            const danger = DESTRUCTIVE.includes(s.to as OrderStatus);
            return (
              <TouchableOpacity
                key={s.to}
                disabled={transition.isPending}
                style={[
                  styles.actionButton,
                  danger && styles.actionDanger,
                  transition.isPending && styles.disabled,
                ]}
                onPress={() => runStep(s.to as OrderStatus, s.labelTr)}
              >
                <Text style={[styles.actionText, danger && styles.actionDangerText]}>{s.labelTr}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      <Text style={styles.section}>Teslimat</Text>
      <View style={styles.card}>
        <Text style={styles.value}>{o.branchName}</Text>
        {o.branchAddress ? <Text style={styles.muted}>{o.branchAddress}</Text> : null}
        {(o.branchPhone ?? o.customerPhone) ? (
          <TouchableOpacity onPress={() => callPhone((o.branchPhone ?? o.customerPhone) as string)}>
            <Text style={styles.link}>{o.branchPhone ?? o.customerPhone}</Text>
          </TouchableOpacity>
        ) : null}
        {o.note ? <Text style={styles.note}>Not: {o.note}</Text> : null}
      </View>

      <Text style={styles.section}>Kalemler</Text>
      <View style={styles.card}>
        {o.lines.map((l) => (
          <View key={l.id} style={styles.lineRow}>
            <View style={styles.flex}>
              <Text style={styles.value}>{l.name}</Text>
              <Text style={styles.muted}>
                {l.qty} {l.uom} × {l.unitPrice}
                {l.source !== 'customer' ? ' · sonradan eklendi' : ''}
              </Text>
            </View>
            <Text style={styles.value}>{l.lineTotal}</Text>
          </View>
        ))}
        {can('order.add_line') && !isTerminal(status) && (
          <TouchableOpacity onPress={() => setAdding(true)}>
            <Text style={styles.link}>+ Kalem ekle</Text>
          </TouchableOpacity>
        )}
        <View style={[styles.lineRow, styles.totalRow]}>
          <Text style={styles.value}>Toplam</Text>
          <Text style={styles.total}>
            {o.total} {o.currency}
          </Text>
        </View>
      </View>

      <Text style={styles.section}>Süreç</Text>
      <View style={styles.card}>
        {MAIN_LINE.map((s, i) => {
          const done = i <= progressIdx && status !== 'cancelled';
          const current = i === reachedIdx;
          return (
            <View key={s} style={styles.stepRow}>
              <View
                style={[
                  styles.stepDot,
                  done && { backgroundColor: colors.accent, borderColor: colors.accent },
                  current && styles.stepDotCurrent,
                ]}
              />
              <Text style={[styles.stepLabel, done && styles.stepLabelDone, current && styles.bold]}>
                {ORDER_STATUS_LABELS_TR[s]}
              </Text>
            </View>
          );
        })}
        {(status === 'cancelled' || status === 'on_hold' || status === 'delivery_issue') && (
          <View style={styles.stepRow}>
            <View style={[styles.stepDot, { backgroundColor: meta.color, borderColor: meta.color }]} />
            <Text style={[styles.stepLabel, { color: meta.color }, styles.bold]}>
              {ORDER_STATUS_LABELS_TR[status]}
            </Text>
          </View>
        )}
      </View>

      <Text style={styles.section}>Geçmiş</Text>
      <View style={styles.card}>
        {o.events.map((e, i) => (
          <View key={`${e.createdAt}-${i}`} style={styles.eventRow}>
            <Text style={styles.value}>
              {e.type === 'line_added'
                ? 'Kalem eklendi'
                : e.toStatus
                  ? ORDER_STATUS_LABELS_TR[e.toStatus as OrderStatus]
                  : e.type}
            </Text>
            <Text style={styles.muted}>
              {formatDateTime(e.createdAt)}
              {e.actorRole ? ` · ${ROLE_LABELS_TR[e.actorRole as Role] ?? e.actorRole}` : ''}
            </Text>
            {e.note ? <Text style={styles.muted}>{e.note}</Text> : null}
          </View>
        ))}
      </View>
      <AddLineModal
        orderRef={o.id}
        visible={adding}
        onClose={() => setAdding(false)}
        onAdded={() => {
          setAdding(false);
          void utils.orders.get.invalidate({ order: orderRef });
          void utils.orders.list.invalidate();
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing(5), gap: spacing(2.5), paddingBottom: spacing(10) },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  muted: { fontSize: 12, color: colors.inkMuted },
  section: { fontSize: 14, fontWeight: '700', color: colors.ink, marginTop: spacing(2) },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing(3.5),
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing(1.5),
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  code: { fontSize: 17, fontWeight: '700', color: colors.ink },
  value: { fontSize: 14, color: colors.ink, fontWeight: '600' },
  link: { fontSize: 14, color: colors.accent, fontWeight: '600' },
  note: { fontSize: 13, color: colors.ink, marginTop: spacing(1) },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1),
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing(2.5),
    paddingVertical: spacing(1),
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  actions: { gap: spacing(2) },
  actionButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    paddingVertical: spacing(3.5),
    alignItems: 'center',
  },
  actionText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  actionDanger: { backgroundColor: colors.dangerSoft },
  actionDangerText: { color: colors.danger },
  disabled: { opacity: 0.5 },
  lineRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing(3) },
  totalRow: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing(2) },
  total: { fontSize: 15, fontWeight: '700', color: colors.ink },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(2.5) },
  stepDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  stepDotCurrent: { width: 16, height: 16, borderRadius: 8 },
  stepLabel: { fontSize: 13, color: colors.inkFaint },
  stepLabelDone: { color: colors.ink },
  bold: { fontWeight: '700' },
  eventRow: { gap: 2 },
});
