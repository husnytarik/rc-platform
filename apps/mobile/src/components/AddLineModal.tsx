import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
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

interface Picked {
  variantId: string;
  label: string;
  uom: string;
  min: number;
  step: number;
}

/** Personelin siparişe sonradan kalem eklemesi: ürün ara → varyant seç → adet gir. */
export function AddLineModal({
  orderRef,
  visible,
  onClose,
  onAdded,
}: {
  orderRef: string;
  visible: boolean;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState<Picked | null>(null);
  const [qty, setQty] = useState('');
  const [note, setNote] = useState('');

  const products = trpc.catalog.list.useQuery(
    { limit: 30, search: search.trim() || undefined },
    { enabled: visible && !picked },
  );

  const reset = (): void => {
    setPicked(null);
    setQty('');
    setNote('');
    setSearch('');
  };
  const close = (): void => {
    reset();
    onClose();
  };

  const add = trpc.orders.addLine.useMutation({
    onSuccess: () => {
      reset();
      onAdded();
    },
    onError: (e) => Alert.alert('Kalem eklenemedi', e.message),
  });

  const qtyNum = Number(qty.replace(',', '.'));
  const qtyOk = picked != null && Number.isFinite(qtyNum) && qtyNum >= picked.min;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Text style={styles.title}>{picked ? 'Adet' : 'Kalem ekle'}</Text>
          <TouchableOpacity onPress={close}>
            <Text style={styles.close}>Kapat</Text>
          </TouchableOpacity>
        </View>

        {picked ? (
          <View style={styles.form}>
            <Text style={styles.picked}>{picked.label}</Text>
            <Text style={styles.hint}>
              En az {picked.min} {picked.uom}
              {picked.step !== 1 ? ` · ${picked.step} katları` : ''}
            </Text>
            <TextInput
              style={styles.input}
              value={qty}
              onChangeText={setQty}
              keyboardType="decimal-pad"
              placeholder="Adet"
              placeholderTextColor={colors.inkFaint}
              autoFocus
            />
            <TextInput
              style={styles.input}
              value={note}
              onChangeText={setNote}
              placeholder="Not (isteğe bağlı)"
              placeholderTextColor={colors.inkFaint}
              maxLength={300}
            />
            <TouchableOpacity
              style={[styles.primary, (!qtyOk || add.isPending) && styles.disabled]}
              disabled={!qtyOk || add.isPending}
              onPress={() =>
                add.mutate({
                  order: orderRef,
                  variantId: picked.variantId,
                  qty: qtyNum,
                  note: note.trim() || undefined,
                })
              }
            >
              {add.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Siparişe ekle</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setPicked(null)}>
              <Text style={styles.back}>← Başka ürün seç</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <TextInput
              style={[styles.input, styles.search]}
              value={search}
              onChangeText={setSearch}
              placeholder="Ürün ara…"
              placeholderTextColor={colors.inkFaint}
              autoCapitalize="none"
            />
            <FlatList
              contentContainerStyle={styles.list}
              data={products.data?.items ?? []}
              keyExtractor={(p) => p.id}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                products.isLoading ? (
                  <ActivityIndicator color={colors.accent} />
                ) : (
                  <Text style={styles.hint}>Ürün bulunamadı.</Text>
                )
              }
              renderItem={({ item }) => (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>{item.name}</Text>
                  {item.variants.map((v) => (
                    <TouchableOpacity
                      key={v.id}
                      style={styles.variant}
                      onPress={() => {
                        setPicked({
                          variantId: v.id,
                          label: `${item.name} — ${v.name}`,
                          uom: v.orderUomLabel,
                          min: v.minOrderQty,
                          step: v.qtyStep,
                        });
                        setQty(String(v.minOrderQty));
                      }}
                    >
                      <Text style={styles.variantText}>{v.name}</Text>
                      <Text style={styles.hint}>{v.orderUomLabel}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            />
          </>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg, paddingTop: spacing(12) },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing(5),
    paddingBottom: spacing(3),
  },
  title: { fontSize: 18, fontWeight: '700', color: colors.ink },
  close: { color: colors.accent, fontWeight: '600', fontSize: 15 },
  form: { padding: spacing(5), gap: spacing(3) },
  picked: { fontSize: 16, fontWeight: '700', color: colors.ink },
  hint: { fontSize: 12, color: colors.inkMuted },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2.5),
    fontSize: 15,
    color: colors.ink,
  },
  search: { marginHorizontal: spacing(5) },
  list: { padding: spacing(5), gap: spacing(2.5) },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing(3.5),
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing(1.5),
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: colors.ink },
  variant: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.accentSoft,
    borderRadius: radius.sm,
    padding: spacing(2.5),
  },
  variantText: { fontSize: 13, fontWeight: '600', color: colors.accent },
  primary: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing(3.5),
    alignItems: 'center',
  },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  disabled: { opacity: 0.5 },
  back: { color: colors.accent, textAlign: 'center', fontWeight: '600' },
});
