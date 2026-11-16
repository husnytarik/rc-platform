import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { trpc } from '@/lib/trpc';
import { colors, radius, spacing } from '@/theme';

export type PriceEditTarget =
  | { kind: 'line'; lineId: string; name: string; unitPrice: string }
  | { kind: 'discount'; type: string | null; value: string };

function errText(e: unknown, fallback: string): string {
  const m = (e as { message?: string } | undefined)?.message;
  return m && m.length < 200 ? m : fallback;
}

const num = (v: string): number => Number(v.replace(',', '.'));

/** Yönetici: kalem birim fiyatı veya sipariş indirimi (yüzde / tutar) düzenleme penceresi. */
export function PriceEditModal({
  orderRef,
  target,
  currency,
  onClose,
  onSaved,
}: {
  orderRef: string;
  target: PriceEditTarget | null;
  currency: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [value, setValue] = useState('');
  const [mode, setMode] = useState<'percent' | 'amount'>('percent');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!target) return;
    setError(null);
    setNote('');
    if (target.kind === 'line') setValue(target.unitPrice);
    else {
      setMode(target.type === 'amount' ? 'amount' : 'percent');
      setValue(target.type ? target.value : '');
    }
  }, [target]);

  const linePrice = trpc.orders.setLinePrice.useMutation();
  const discount = trpc.orders.setDiscount.useMutation();
  const busy = linePrice.isPending || discount.isPending;

  const v = num(value);
  const valid = value.trim() !== '' && Number.isFinite(v) && v >= 0 && !(mode === 'percent' && target?.kind === 'discount' && v > 100);

  const save = (clear = false): void => {
    if (!target) return;
    setError(null);
    const done = { onSuccess: onSaved, onError: (e: unknown) => setError(errText(e, 'Kaydedilemedi.')) };
    if (target.kind === 'line') {
      linePrice.mutate({ order: orderRef, lineId: target.lineId, unitPrice: v, note: note.trim() || undefined }, done);
    } else {
      discount.mutate(
        { order: orderRef, mode, value: clear ? 0 : v, note: note.trim() || undefined },
        done,
      );
    }
  };

  return (
    <Modal visible={target !== null} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.sheet}>
          <Text style={styles.title}>
            {target?.kind === 'line' ? `Birim fiyat: ${target.name}` : 'İskonto / indirim'}
          </Text>

          {target?.kind === 'discount' && (
            <View style={styles.modeRow}>
              {(['percent', 'amount'] as const).map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[styles.modeChip, mode === m && styles.modeChipActive]}
                  onPress={() => setMode(m)}
                >
                  <Text style={[styles.modeText, mode === m && styles.modeTextActive]}>
                    {m === 'percent' ? 'Yüzde (%)' : `Tutar (${currency})`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <Text style={styles.label}>
            {target?.kind === 'line' ? `Yeni birim fiyat (${currency})` : mode === 'percent' ? 'İndirim yüzdesi' : 'İndirim tutarı'}
          </Text>
          <TextInput
            style={styles.input}
            value={value}
            onChangeText={setValue}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor={colors.inkFaint}
            autoFocus
          />
          <Text style={styles.label}>Not (opsiyonel)</Text>
          <TextInput
            style={styles.input}
            value={note}
            onChangeText={setNote}
            placeholder="Örn. toplu alım iskontosu"
            placeholderTextColor={colors.inkFaint}
          />

          {error && <Text style={styles.error}>{error}</Text>}

          <TouchableOpacity
            style={[styles.save, (!valid || busy) && styles.disabled]}
            disabled={!valid || busy}
            onPress={() => save()}
          >
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Kaydet</Text>}
          </TouchableOpacity>
          {target?.kind === 'discount' && target.type && (
            <TouchableOpacity disabled={busy} onPress={() => save(true)}>
              <Text style={styles.clear}>İndirimi kaldır</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.cancel}>Vazgeç</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: spacing(5) },
  sheet: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing(5), gap: spacing(2.5) },
  title: { fontSize: 16, fontWeight: '800', color: colors.ink },
  modeRow: { flexDirection: 'row', gap: spacing(2) },
  modeChip: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: spacing(2.5),
    alignItems: 'center',
  },
  modeChipActive: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  modeText: { fontSize: 13, color: colors.inkMuted, fontWeight: '600' },
  modeTextActive: { color: colors.accent },
  label: { fontSize: 12, color: colors.inkMuted, fontWeight: '600' },
  input: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2.5),
    fontSize: 15,
    color: colors.ink,
  },
  error: { color: colors.danger, fontSize: 13 },
  save: { backgroundColor: colors.accent, borderRadius: radius.sm, paddingVertical: spacing(3.5), alignItems: 'center' },
  saveText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  disabled: { opacity: 0.5 },
  clear: { color: colors.danger, fontWeight: '700', textAlign: 'center', fontSize: 13 },
  cancel: { color: colors.inkMuted, textAlign: 'center', fontSize: 13 },
});
