import { UOMS, UOM_LABELS_TR, trSlug, type Uom } from '@rc/shared';
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
}

const emptyVariant = (): NewVariant => ({ name: '', orderUom: 'adet', basePrice: '' });

function num(s: string): number | undefined {
  const n = Number(s.replace(',', '.'));
  return s.trim() !== '' && Number.isFinite(n) ? n : undefined;
}

function errText(e: unknown, fallback: string): string {
  const m = (e as { message?: string } | undefined)?.message;
  return m && m.length < 200 ? m : fallback;
}

/** Kod girilmediyse addan üretir: "Etiyopya Yirgacheffe" → "ETIYOPYA-YIRG-4821". */
function autoCode(name: string): string {
  const base = trSlug(name).toUpperCase().slice(0, 14).replace(/-+$/, '') || 'URUN';
  return `${base}-${Math.floor(1000 + Math.random() * 9000)}`;
}

export default function YeniUrunScreen() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const categories = trpc.catalog.categories.useQuery();

  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [variants, setVariants] = useState<NewVariant[]>([emptyVariant()]);
  const [more, setMore] = useState(false);
  const [code, setCode] = useState('');
  const [brand, setBrand] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [allowPreorder, setAllowPreorder] = useState(false);
  const [isService, setIsService] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = trpc.catalog.createProduct.useMutation();
  const createVariant = trpc.catalog.createVariant.useMutation();
  const patch = (i: number, p: Partial<NewVariant>) => setVariants((vs) => vs.map((v, k) => (k === i ? { ...v, ...p } : v)));

  const canSubmit = name.trim().length > 0;

  async function submit() {
    setError(null);
    setSaving(true);
    const productCode = code.trim() || autoCode(name);
    try {
      const { id } = await create.mutateAsync({
        code: productCode,
        name: name.trim(),
        brand: brand.trim() || undefined,
        description: description.trim() || undefined,
        imageUrl: imageUrl.trim() || undefined,
        categoryId: categoryId ?? undefined,
        allowPreorder,
        isService,
      });
      const filled = variants.filter((v) => v.name.trim());
      let failed = 0;
      for (let i = 0; i < filled.length; i++) {
        const v = filled[i]!;
        try {
          await createVariant.mutateAsync({
            productId: id,
            code: `${productCode}-${i + 1}`,
            name: v.name.trim(),
            orderUom: v.orderUom,
            basePrice: num(v.basePrice) ?? 0,
          });
        } catch {
          failed++;
        }
      }
      void utils.catalog.adminList.invalidate();
      router.replace({ pathname: '/producer/katalog/[id]', params: { id } });
      if (failed > 0) setError(`${failed} varyant eklenemedi.`);
    } catch (e) {
      setError(errText(e, 'Ürün oluşturulamadı.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <TextInput style={styles.nameInput} value={name} onChangeText={setName} placeholder="Ürün adı" placeholderTextColor={colors.inkFaint} autoFocus />

      <Text style={styles.section}>Kategori</Text>
      <View style={styles.chipRow}>
        {categories.data?.map((c) => (
          <TouchableOpacity key={c.id} style={[styles.chip, categoryId === c.id && styles.chipActive]} onPress={() => setCategoryId(categoryId === c.id ? null : c.id)}>
            <Text style={[styles.chipText, categoryId === c.id && styles.chipTextActive]}>{c.name}</Text>
          </TouchableOpacity>
        ))}
        <NewCategoryChip onCreated={setCategoryId} />
      </View>

      <Text style={styles.section}>Varyantlar</Text>
      {variants.map((v, i) => (
        <View key={i} style={styles.variantCard}>
          <View style={styles.rowFields}>
            <TextInput style={[styles.input, styles.flex2]} value={v.name} onChangeText={(t) => patch(i, { name: t })} placeholder="ör. 1 kg" placeholderTextColor={colors.inkFaint} />
            <TextInput style={[styles.input, styles.flex1]} value={v.basePrice} onChangeText={(t) => patch(i, { basePrice: t })} keyboardType="decimal-pad" placeholder="Fiyat" placeholderTextColor={colors.inkFaint} />
            {variants.length > 1 && (
              <TouchableOpacity style={styles.removeBtn} onPress={() => setVariants((vs) => vs.filter((_, k) => k !== i))}>
                <Text style={styles.removeText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.chipRow}>
            {UOMS.map((u) => (
              <TouchableOpacity key={u} style={[styles.chip, v.orderUom === u && styles.chipActive]} onPress={() => patch(i, { orderUom: u })}>
                <Text style={[styles.chipText, v.orderUom === u && styles.chipTextActive]}>{UOM_LABELS_TR[u]}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ))}
      <TouchableOpacity onPress={() => setVariants((vs) => [...vs, emptyVariant()])}>
        <Text style={styles.addText}>+ Varyant ekle</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => setMore((m) => !m)}>
        <Text style={styles.moreText}>{more ? '▾ Ek ayarları gizle' : '▸ Ek ayarlar (görsel, marka, açıklama…)'}</Text>
      </TouchableOpacity>
      {more && (
        <View style={styles.moreBox}>
          <ImageField value={imageUrl} onChange={setImageUrl} />
          <TextInput style={styles.input} value={brand} onChangeText={setBrand} placeholder="Marka" placeholderTextColor={colors.inkFaint} />
          <TextInput style={[styles.input, styles.multiline]} value={description} onChangeText={setDescription} placeholder="Açıklama" placeholderTextColor={colors.inkFaint} multiline />
          <TextInput style={styles.input} value={code} onChangeText={setCode} placeholder="Ürün kodu (boşsa otomatik)" placeholderTextColor={colors.inkFaint} autoCapitalize="characters" />
          <TouchableOpacity style={styles.toggleRow} onPress={() => setAllowPreorder((v) => !v)}>
            <View style={[styles.checkbox, allowPreorder && styles.checkboxActive]} />
            <Text style={styles.toggleLabel}>Ön siparişe izin ver</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.toggleRow} onPress={() => setIsService((v) => !v)}>
            <View style={[styles.checkbox, isService && styles.checkboxActive]} />
            <Text style={styles.toggleLabel}>Servis (katalogda satılmaz)</Text>
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity style={[styles.submitButton, (!canSubmit || saving) && styles.submitButtonDisabled]} disabled={!canSubmit || saving} onPress={() => void submit()}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitButtonText}>Ürünü oluştur</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing(5), gap: spacing(3) },
  errorBox: { backgroundColor: colors.dangerSoft, borderRadius: radius.sm, padding: spacing(3) },
  errorText: { color: colors.danger, fontSize: 13 },
  nameInput: { backgroundColor: colors.surface, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing(3.5), paddingVertical: spacing(3.5), fontSize: 17, fontWeight: '700', color: colors.ink },
  section: { fontSize: 12, color: colors.inkMuted, fontWeight: '700', marginTop: spacing(1) },
  input: { backgroundColor: colors.surface, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing(3), paddingVertical: spacing(2.5), fontSize: 14, color: colors.ink },
  multiline: { minHeight: 70, textAlignVertical: 'top' },
  rowFields: { flexDirection: 'row', gap: spacing(2), alignItems: 'center' },
  flex1: { flex: 1 },
  flex2: { flex: 2 },
  variantCard: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing(3), gap: spacing(2) },
  removeBtn: { paddingHorizontal: spacing(2) },
  removeText: { color: colors.danger, fontSize: 16, fontWeight: '700' },
  addText: { color: colors.accent, fontSize: 13, fontWeight: '700' },
  moreText: { color: colors.inkMuted, fontSize: 13, fontWeight: '600', marginTop: spacing(1) },
  moreBox: { gap: spacing(2.5) },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(1.5) },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: spacing(3), paddingVertical: spacing(1.5) },
  chipActive: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  chipText: { fontSize: 12, color: colors.inkMuted, fontWeight: '600' },
  chipTextActive: { color: colors.accent },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(2.5) },
  checkbox: { width: 20, height: 20, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border },
  checkboxActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  toggleLabel: { fontSize: 13, color: colors.ink, fontWeight: '600' },
  submitButton: { backgroundColor: colors.accent, borderRadius: radius.sm, paddingVertical: spacing(3.5), alignItems: 'center', marginTop: spacing(2) },
  submitButtonDisabled: { backgroundColor: colors.border },
  submitButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
