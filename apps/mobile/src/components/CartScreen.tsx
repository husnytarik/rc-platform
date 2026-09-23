import type { AppRouter } from '@rc/api/app-router';
import type { inferRouterOutputs } from '@trpc/server';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { trpc } from '@/lib/trpc';
import { useCart, type CartLine } from '@/providers/cart-context';
import { colors, radius, spacing } from '@/theme';

type Branch = inferRouterOutputs<AppRouter>['orders']['myBranches'][number];

function errText(e: unknown, fallback: string): string {
  const m = (e as { message?: string } | undefined)?.message;
  return m && m.length < 200 ? m : fallback;
}

function CartRow({ line }: { line: CartLine }) {
  const cart = useCart();
  const lineTotal = line.unitPrice != null ? (Number(line.unitPrice) * line.qty).toFixed(2) : null;

  return (
    <View style={styles.row}>
      <View style={styles.rowInfo}>
        <Text style={styles.rowTitle}>{line.productName}</Text>
        <Text style={styles.rowMeta}>{line.variantName}</Text>
        {lineTotal && (
          <Text style={styles.rowPrice}>
            {line.unitPrice} {line.currency} × {line.qty} {line.orderUomLabel} = {lineTotal} {line.currency}
          </Text>
        )}
      </View>
      <View style={styles.rowActions}>
        <View style={styles.stepper}>
          <TouchableOpacity
            style={styles.stepperButton}
            onPress={() => cart.setQty(line.variantId, Number((line.qty - line.qtyStep).toFixed(3)))}
          >
            <Text style={styles.stepperButtonText}>−</Text>
          </TouchableOpacity>
          <Text style={styles.stepperValue}>{line.qty}</Text>
          <TouchableOpacity
            style={styles.stepperButton}
            onPress={() => cart.setQty(line.variantId, Number((line.qty + line.qtyStep).toFixed(3)))}
          >
            <Text style={styles.stepperButtonText}>+</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity onPress={() => cart.removeLine(line.variantId)}>
          <Text style={styles.removeText}>Kaldır</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export function CartScreen() {
  const cart = useCart();
  const router = useRouter();
  const branches = trpc.orders.myBranches.useQuery();
  const [branchId, setBranchId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const activeBranchId = branchId ?? branches.data?.[0]?.id ?? null;

  const create = trpc.orders.create.useMutation({
    onSuccess: () => {
      cart.clear();
      router.replace('/customer/siparislerim');
    },
    onError: (e) => setError(errText(e, 'Sipariş gönderilemedi. Tekrar dener misin?')),
  });

  const total = cart.lines.reduce((sum, l) => sum + Number(l.unitPrice ?? 0) * l.qty, 0);
  const currency = cart.lines.find((l) => l.currency)?.currency ?? '';

  const onSubmit = (): void => {
    if (!activeBranchId || cart.lines.length === 0) return;
    setError(null);
    create.mutate({
      branchId: activeBranchId,
      note: note.trim() || undefined,
      lines: cart.lines.map((l) => ({ variantId: l.variantId, qty: l.qty })),
    });
  };

  if (cart.lines.length === 0) {
    return (
      <View style={styles.flex}>
        <Text style={styles.empty}>Sepetiniz boş.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <View style={styles.section}>
        {cart.lines.map((line) => (
          <CartRow key={line.variantId} line={line} />
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Şube</Text>
        {branches.isLoading ? (
          <ActivityIndicator color={colors.accent} />
        ) : branches.data && branches.data.length > 0 ? (
          <View style={styles.branchRow}>
            {branches.data.map((b: Branch) => (
              <TouchableOpacity
                key={b.id}
                style={[styles.branchChip, b.id === activeBranchId && styles.branchChipActive]}
                onPress={() => setBranchId(b.id)}
              >
                <Text style={[styles.branchChipText, b.id === activeBranchId && styles.branchChipTextActive]}>
                  {b.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <Text style={styles.empty}>Şube bulunamadı.</Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Not (opsiyonel)</Text>
        <TextInput
          style={styles.noteInput}
          value={note}
          onChangeText={setNote}
          placeholder="Sipariş notu"
          placeholderTextColor={colors.inkFaint}
          multiline
        />
      </View>

      <View style={styles.footer}>
        {total > 0 && (
          <Text style={styles.totalText}>
            Toplam: {total.toFixed(2)} {currency}
          </Text>
        )}
        <TouchableOpacity
          style={[styles.submitButton, (!activeBranchId || create.isPending) && styles.submitButtonDisabled]}
          disabled={!activeBranchId || create.isPending}
          onPress={onSubmit}
        >
          {create.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitButtonText}>Siparişi gönder</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing(5), gap: spacing(5) },
  empty: { textAlign: 'center', color: colors.inkMuted, marginTop: spacing(6) },
  errorBox: { backgroundColor: colors.dangerSoft, borderRadius: radius.sm, padding: spacing(3) },
  errorText: { color: colors.danger, fontSize: 13 },
  section: { gap: spacing(2.5) },
  sectionLabel: { fontSize: 13, color: colors.inkMuted, fontWeight: '600' },
  row: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing(3.5),
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing(2),
  },
  rowInfo: { gap: 2 },
  rowTitle: { fontSize: 14, fontWeight: '700', color: colors.ink },
  rowMeta: { fontSize: 12, color: colors.inkMuted },
  rowPrice: { fontSize: 12, color: colors.accent, fontWeight: '600', marginTop: 2 },
  rowActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing(2) },
  stepperButton: {
    width: 30,
    height: 30,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperButtonText: { fontSize: 16, color: colors.ink, fontWeight: '700' },
  stepperValue: { fontSize: 13, color: colors.ink, fontWeight: '600', minWidth: 40, textAlign: 'center' },
  removeText: { color: colors.danger, fontSize: 12, fontWeight: '600' },
  branchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(1.5) },
  branchChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1.5),
  },
  branchChipActive: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  branchChipText: { fontSize: 13, color: colors.inkMuted, fontWeight: '600' },
  branchChipTextActive: { color: colors.accent },
  noteInput: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(3),
    minHeight: 60,
    fontSize: 13,
    color: colors.ink,
    textAlignVertical: 'top',
  },
  footer: { gap: spacing(3) },
  totalText: { fontSize: 16, fontWeight: '700', color: colors.ink, textAlign: 'right' },
  submitButton: { backgroundColor: colors.accent, borderRadius: radius.sm, paddingVertical: spacing(3.5), alignItems: 'center' },
  submitButtonDisabled: { backgroundColor: colors.border },
  submitButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
