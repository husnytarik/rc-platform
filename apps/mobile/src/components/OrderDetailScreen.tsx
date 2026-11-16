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
import { PriceEditModal, type PriceEditTarget } from './PriceEditModal';
import { colors, radius, spacing } from '@/theme';

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

const DESTRUCTIVE: readonly OrderStatus[] = ['cancelled', 'delivery_issue'];

/** Sipariş detayı: durum çizelgesi, kalemler, teslimat bilgisi ve role göre sıradaki adımlar. */
export function OrderDetailScreen({ orderRef }: { orderRef: string }) {
  const utils = trpc.useUtils();
  const { can } = useAuth();
  const [adding, setAdding] = useState(false);
  const [priceTarget, setPriceTarget] = useState<PriceEditTarget | null>(null);
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
  const isProducerView = can('order.view.all');
  const canPrice = can('price.manage') && !isTerminal(o.status as OrderStatus);
  const status = o.status as OrderStatus;
  const meta = ORDER_STATUS_META[status];
  const reachedIdx = MAIN_LINE.indexOf(status);

  // Yan durumdaysa (iptal, beklemede...) ana hattı son ulaşılan adıma göre işaretle.
  const lastMainFromEvents = o.events
    .map((e) => (e.toStatus ? MAIN_LINE.indexOf(e.toStatus as OrderStatus) : -1))
    .reduce((a, b) => Math.max(a, b), -1);
  const progressIdx = reachedIdx >= 0 ? reachedIdx : lastMainFromEvents;

  // Her aşamanın gerçekleştiği tarih-saat (aynı aşamaya birden çok kez geçildiyse sonuncusu).
  const stepTime = new Map<OrderStatus, string | Date>();
  for (const e of o.events) if (e.toStatus) stepTime.set(e.toStatus as OrderStatus, e.createdAt);
  if (!stepTime.has('placed')) stepTime.set('placed', o.createdAt);
  const deliveredAt = stepTime.get('delivered');
  const totalMin =
    status === 'delivered' && deliveredAt
      ? Math.max(0, Math.round((new Date(deliveredAt).getTime() - new Date(o.createdAt).getTime()) / 60000))
      : null;
  const durationLabel =
    totalMin == null
      ? null
      : totalMin >= 1440
        ? `${Math.floor(totalMin / 1440)} gün ${Math.floor((totalMin % 1440) / 60)} sa`
        : `${Math.floor(totalMin / 60)} sa ${totalMin % 60} dk`;

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
          {isProducerView ? (
            <View style={styles.flex}>
              <Text style={styles.code}>{o.customerName}</Text>
              <Text style={styles.codeSmall}>{o.keyCode}</Text>
            </View>
          ) : (
            <Text style={styles.code}>{o.keyCode}</Text>
          )}
          <View style={[styles.badge, { borderColor: meta.color }]}>
            <View style={[styles.dot, { backgroundColor: meta.color }]} />
            <Text style={[styles.badgeText, { color: meta.color }]}>
              {ORDER_STATUS_LABELS_TR[status]}
            </Text>
          </View>
        </View>
        <Text style={styles.muted}>{isProducerView ? o.branchName : `${o.customerName} · ${o.branchName}`}</Text>
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
            <View style={styles.lineRight}>
              <Text style={styles.value}>{l.lineTotal}</Text>
              {canPrice && (
                <TouchableOpacity
                  onPress={() =>
                    setPriceTarget({ kind: 'line', lineId: l.id, name: l.name, unitPrice: l.unitPrice })
                  }
                >
                  <Text style={styles.linkSmall}>Fiyatı düzenle</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))}
        {can('order.add_line') && !isTerminal(status) && (
          <TouchableOpacity onPress={() => setAdding(true)}>
            <Text style={styles.link}>+ Kalem ekle</Text>
          </TouchableOpacity>
        )}
        {Number(o.discountAmount) > 0 && (
          <>
            <View style={[styles.lineRow, styles.totalRow]}>
              <Text style={styles.muted}>Ara toplam</Text>
              <Text style={styles.muted}>
                {o.subtotal} {o.currency}
              </Text>
            </View>
            <View style={styles.lineRow}>
              <Text style={styles.discountText}>
                {o.discountType === 'percent' ? `İskonto (%${Number(o.discountValue)})` : 'İndirim'}
              </Text>
              <Text style={styles.discountText}>
                −{o.discountAmount} {o.currency}
              </Text>
            </View>
          </>
        )}
        {canPrice && (
          <TouchableOpacity
            onPress={() => setPriceTarget({ kind: 'discount', type: o.discountType, value: o.discountValue })}
          >
            <Text style={styles.link}>{Number(o.discountAmount) > 0 ? 'İndirimi düzenle' : '+ İskonto / indirim ekle'}</Text>
          </TouchableOpacity>
        )}
        <View style={[styles.lineRow, Number(o.discountAmount) > 0 ? null : styles.totalRow]}>
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
              <Text style={[styles.stepLabel, styles.stepLabelFlex, done && styles.stepLabelDone, current && styles.bold]}>
                {ORDER_STATUS_LABELS_TR[s]}
              </Text>
              {done && stepTime.has(s) && <Text style={styles.stepTime}>{formatDateTime(stepTime.get(s)!)}</Text>}
            </View>
          );
        })}
        {(status === 'cancelled' || status === 'on_hold' || status === 'delivery_issue') && (
          <View style={styles.stepRow}>
            <View style={[styles.stepDot, { backgroundColor: meta.color, borderColor: meta.color }]} />
            <Text style={[styles.stepLabel, styles.stepLabelFlex, { color: meta.color }, styles.bold]}>
              {ORDER_STATUS_LABELS_TR[status]}
            </Text>
            {stepTime.has(status) && <Text style={styles.stepTime}>{formatDateTime(stepTime.get(status)!)}</Text>}
          </View>
        )}
        {durationLabel && (
          <Text style={styles.totalDuration}>Sipariş → teslim toplam süre: {durationLabel}</Text>
        )}
      </View>

      <Text style={styles.section}>Geçmiş</Text>
      <View style={styles.card}>
        {o.events.map((e, i) => (
          <View key={`${e.createdAt}-${i}`} style={styles.eventRow}>
            <Text style={styles.value}>
              {e.type === 'line_added'
                ? 'Kalem eklendi'
                : e.type === 'price_change'
                  ? 'Fiyat değişti'
                  : e.type === 'discount'
                    ? 'İndirim / iskonto'
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
      <PriceEditModal
        orderRef={o.id}
        target={priceTarget}
        currency={o.currency}
        onClose={() => setPriceTarget(null)}
        onSaved={() => {
          setPriceTarget(null);
          void utils.orders.get.invalidate({ order: orderRef });
          void utils.orders.list.invalidate();
        }}
      />
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
  codeSmall: { fontSize: 12, color: colors.inkMuted, fontWeight: '600', marginTop: 2 },
  lineRight: { alignItems: 'flex-end', gap: 2 },
  linkSmall: { color: colors.accent, fontSize: 11, fontWeight: '700' },
  discountText: { color: colors.danger, fontSize: 13, fontWeight: '700' },
  stepLabelFlex: { flex: 1 },
  stepTime: { fontSize: 12, color: colors.inkMuted, fontWeight: '600' },
  totalDuration: { marginTop: spacing(2), fontSize: 12, color: colors.accent, fontWeight: '700' },
  stepLabelDone: { color: colors.ink },
  bold: { fontWeight: '700' },
  eventRow: { gap: 2 },
});
