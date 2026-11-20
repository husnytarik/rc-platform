import { UOMS, UOM_LABELS_TR, type Uom } from '@rc/shared';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { ImageField } from '@/components/ImageField';
import { NewCategoryChip } from '@/components/NewCategoryChip';
import { trpc } from '@/lib/trpc';
import { colors, radius, spacing } from '@/theme';

interface NewVariant {
  name: string;
  orderUom: Uom;
  basePrice: string;
  minOrderQty: string;
  qtyStep: string;
}

const emptyVariant = (): NewVariant => ({ name: '', orderUom: 'adet', basePrice: '', minOrderQty: '1', qtyStep: '1' });

function num(s: string): number | undefined {
  const n = Number(s.replace(',', '.'));
  return s.trim() !== '' && Number.isFinite(n) ? n : undefined;
}

function errText(e: unknown, fallback: string): string {
  const m = (e as { message?: string } | undefined)?.message;
  return m && m.length < 200 ? m : fallback;
}

export default function YeniUrunScreen() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const categories = trpc.catalog.categories.useQuery();

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [allowPreorder, setAllowPreorder] = useState(false);
  const [isService, setIsService] = useState(false);
  const [variants, setVariants] = useState<NewVariant[]>([emptyVariant()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const createVariant = trpc.catalog.createVariant.useMutation();
  const patchVariant = (i: number, p: Partial<NewVariant>) =>
    setVariants((vs) => vs.map((v, k) => (k === i ? { ...v, ...p } : v)));

  const create = trpc.catalog.createProduct.useMutation({
    onError: (e) => setError(errText(e, 'Ürün oluşturulamadı.')),
  });

  const canSubmit = code.trim().length > 0 && name.trim().length > 0;

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <View style={styles.field}>
        <Text style={styles.label}>Ürün kodu *</Text>
        <TextInput style={styles.input} value={code} onChangeText={setCode} placeholder="ör. KAH-001" placeholderTextColor={colors.inkFaint} autoCapitalize="none" />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Ad *</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Ürün adı" placeholderTextColor={colors.inkFaint} />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Marka</Text>
        <TextInput style={styles.input} value={brand} onChangeText={setBrand} placeholder="Marka (opsiyonel)" placeholderTextColor={colors.inkFaint} />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Açıklama</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={description}
          onChangeText={setDescription}
          placeholder="Açıklama (opsiyonel)"
          placeholderTextColor={colors.inkFaint}
          multiline
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Görsel</Text>
        <ImageField value={imageUrl} onChange={setImageUrl} />
      </View>

      {categories.data && (
        <View style={styles.field}>
          <Text style={styles.label}>Kategori</Text>
          <View style={styles.chipRow}>
            {categories.data.map((c) => (
              <TouchableOpacity
                key={c.id}
                style={[styles.chip, categoryId === c.id && styles.chipActive]}
                onPress={() => setCategoryId(categoryId === c.id ? null : c.id)}
              >
                <Text style={[styles.chipText, categoryId === c.id && styles.chipTextActive]}>{c.name}</Text>
              </TouchableOpacity>
            ))}
            <NewCategoryChip onCreated={setCategoryId} />
          </View>
        </View>
      )}

      <View style={styles.field}>
        <Text style={styles.label}>Varyantlar (ör. 250 g, 1 kg)</Text>
        {variants.map((v, i) => (
          <View key={i} style={styles.variantCard}>
            <TextInput style={styles.input} value={v.name} onChangeText={(t) => patchVariant(i, { name: t })} placeholder="Varyant adı (ör. 1 kg)" placeholderTextColor={colors.inkFaint} />
            <View style={styles.chipRow}>
              {UOMS.map((u) => (
                <TouchableOpacity key={u} style={[styles.chip, v.orderUom === u && styles.chipActive]} onPress={() => patchVariant(i, { orderUom: u })}>
                  <Text style={[styles.chipText, v.orderUom === u && styles.chipTextActive]}>{UOM_LABELS_TR[u]}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.rowFields}>
              <TextInput style={[styles.input, styles.flex1]} value={v.basePrice} onChangeText={(t) => patchVariant(i, { basePrice: t })} keyboardType="decimal-pad" placeholder="Fiyat (opsiyonel)" placeholderTextColor={colors.inkFaint} />
              <TextInput style={[styles.input, styles.flex1]} value={v.minOrderQty} onChangeText={(t) => patchVariant(i, { minOrderQty: t })} keyboardType="decimal-pad" placeholder="Min." placeholderTextColor={colors.inkFaint} />
              <TextInput style={[styles.input, styles.flex1]} value={v.qtyStep} onChangeText={(t) => patchVariant(i, { qtyStep: t })} keyboardType="decimal-pad" placeholder="Adım" placeholderTextColor={colors.inkFaint} />
            </View>
            {variants.length > 1 && (
              <TouchableOpacity onPress={() => setVariants((vs) => vs.filter((_, k) => k !== i))}>
                <Text style={styles.removeText}>Bu varyantı çıkar</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
        <TouchableOpacity onPress={() => setVariants((vs) => [...vs, emptyVariant()])}>
          <Text style={styles.addText}>+ Varyant ekle</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.toggleRow} onPress={() => setAllowPreorder((v) => !v)}>
        <View style={[styles.checkbox, allowPreorder && styles.checkboxActive]} />
        <Text style={styles.toggleLabel}>Ön siparişe izin ver</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.toggleRow} onPress={() => setIsService((v) => !v)}>
        <View style={[styles.checkbox, isService && styles.checkboxActive]} />
        <Text style={styles.toggleLabel}>Bu bir servis (katalog listesinde satılmaz)</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.submitButton, (!canSubmit || saving) && styles.submitButtonDisabled]}
        disabled={!canSubmit || saving}
        onPress={async () => {
          setError(null);
          setSaving(true);
          try {
            const { id } = await create.mutateAsync({
              code: code.trim(),
              name: name.trim(),
              brand: brand.trim() || undefined,
              description: description.trim() || undefined,
              imageUrl: imageUrl.trim() || undefined,
              categoryId: categoryId ?? undefined,
              allowPreorder,
              isService,
            });
            let failed = 0;
            const filled = variants.filter((v) => v.name.trim());
            for (let i = 0; i < filled.length; i++) {
              const v = filled[i]!;
              try {
                await createVariant.mutateAsync({
                  productId: id,
                  code: `${code.trim()}-${i + 1}`,
                  name: v.name.trim(),
                  orderUom: v.orderUom,
                  basePrice: num(v.basePrice) ?? 0,
                  minOrderQty: num(v.minOrderQty),
                  qtyStep: num(v.qtyStep),
                });
              } catch {
                failed++;
              }
            }
            void utils.catalog.adminList.invalidate();
            if (failed > 0) setError(`${failed} varyant eklenemedi; ürün sayfasından ekleyebilirsiniz.`);
            router.replace({ pathname: '/producer/katalog/[id]', params: { id } });
          } catch {
            /* create.onError hata mesajını gösterir */
          } finally {
            setSaving(false);
          }
        }}
      >
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitButtonText}>Ürünü oluştur</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing(5), gap: spacing(4) },
  errorBox: { backgroundColor: colors.dangerSoft, borderRadius: radius.sm, padding: spacing(3) },
  errorText: { color: colors.danger, fontSize: 13 },
  field: { gap: spacing(1.5) },
  label: { fontSize: 13, color: colors.inkMuted, fontWeight: '600' },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2.5),
    fontSize: 14,
    color: colors.ink,
  },
  variantCard: { backgroundColor: colors.surface, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, padding: spacing(3), gap: spacing(2) },
  rowFields: { flexDirection: 'row', gap: spacing(2) },
  flex1: { flex: 1 },
  removeText: { color: colors.danger, fontSize: 12, fontWeight: '600' },
  addText: { color: colors.accent, fontSize: 13, fontWeight: '700' },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
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
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(2.5) },
  checkbox: { width: 20, height: 20, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border },
  checkboxActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  toggleLabel: { fontSize: 13, color: colors.ink, fontWeight: '600' },
  submitButton: { backgroundColor: colors.accent, borderRadius: radius.sm, paddingVertical: spacing(3.5), alignItems: 'center' },
  submitButtonDisabled: { backgroundColor: colors.border },
  submitButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
