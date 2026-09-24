import { UOM_LABELS_TR, UOMS, type Uom } from '@rc/shared';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
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

function errText(e: unknown, fallback: string): string {
  const m = (e as { message?: string } | undefined)?.message;
  return m && m.length < 200 ? m : fallback;
}

function toNumber(s: string): number | undefined {
  const n = Number(s.replace(',', '.'));
  return s.trim() !== '' && Number.isFinite(n) ? n : undefined;
}

interface VariantForm {
  code: string;
  name: string;
  orderUom: Uom;
  basePrice: string;
  minOrderQty: string;
  qtyStep: string;
  contentAmount: string;
  contentUom: Uom | null;
  lowStockThreshold: string;
  isActive: boolean;
}

function UomPicker({ value, onChange }: { value: Uom; onChange: (u: Uom) => void }) {
  return (
    <View style={styles.chipRow}>
      {UOMS.map((u) => (
        <TouchableOpacity key={u} style={[styles.chip, value === u && styles.chipActive]} onPress={() => onChange(u)}>
          <Text style={[styles.chipText, value === u && styles.chipTextActive]}>{UOM_LABELS_TR[u]}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function VariantEditor({ productId, variant }: { productId: string; variant: VariantForm & { id: string } }) {
  const utils = trpc.useUtils();
  const [form, setForm] = useState<VariantForm>(variant);
  const [error, setError] = useState<string | null>(null);

  const update = trpc.catalog.updateVariant.useMutation({
    onSuccess: () => {
      void utils.catalog.adminProduct.invalidate({ id: productId });
      void utils.catalog.list.invalidate();
    },
    onError: (e) => setError(errText(e, 'Kaydedilemedi.')),
  });

  return (
    <View style={styles.variantEditor}>
      <View style={styles.field}>
        <Text style={styles.label}>Ad</Text>
        <TextInput style={styles.input} value={form.name} onChangeText={(v) => setForm((f) => ({ ...f, name: v }))} />
      </View>
      <View style={styles.field}>
        <Text style={styles.label}>Sipariş birimi</Text>
        <UomPicker value={form.orderUom} onChange={(u) => setForm((f) => ({ ...f, orderUom: u }))} />
      </View>
      <View style={styles.rowFields}>
        <View style={[styles.field, styles.flex1]}>
          <Text style={styles.label}>Fiyat</Text>
          <TextInput style={styles.input} value={form.basePrice} onChangeText={(v) => setForm((f) => ({ ...f, basePrice: v }))} keyboardType="decimal-pad" />
        </View>
        <View style={[styles.field, styles.flex1]}>
          <Text style={styles.label}>Min. sipariş</Text>
          <TextInput style={styles.input} value={form.minOrderQty} onChangeText={(v) => setForm((f) => ({ ...f, minOrderQty: v }))} keyboardType="decimal-pad" />
        </View>
        <View style={[styles.field, styles.flex1]}>
          <Text style={styles.label}>Adım</Text>
          <TextInput style={styles.input} value={form.qtyStep} onChangeText={(v) => setForm((f) => ({ ...f, qtyStep: v }))} keyboardType="decimal-pad" />
        </View>
      </View>
      <View style={styles.rowFields}>
        <View style={[styles.field, styles.flex1]}>
          <Text style={styles.label}>İçerik miktarı</Text>
          <TextInput style={styles.input} value={form.contentAmount} onChangeText={(v) => setForm((f) => ({ ...f, contentAmount: v }))} keyboardType="decimal-pad" placeholder="opsiyonel" placeholderTextColor={colors.inkFaint} />
        </View>
        <View style={[styles.field, styles.flex1]}>
          <Text style={styles.label}>Az kaldı eşiği</Text>
          <TextInput style={styles.input} value={form.lowStockThreshold} onChangeText={(v) => setForm((f) => ({ ...f, lowStockThreshold: v }))} keyboardType="decimal-pad" placeholder="opsiyonel" placeholderTextColor={colors.inkFaint} />
        </View>
      </View>
      <View style={styles.field}>
        <Text style={styles.label}>İçerik birimi</Text>
        <View style={styles.chipRow}>
          <TouchableOpacity style={[styles.chip, form.contentUom === null && styles.chipActive]} onPress={() => setForm((f) => ({ ...f, contentUom: null }))}>
            <Text style={[styles.chipText, form.contentUom === null && styles.chipTextActive]}>Yok</Text>
          </TouchableOpacity>
          {UOMS.map((u) => (
            <TouchableOpacity key={u} style={[styles.chip, form.contentUom === u && styles.chipActive]} onPress={() => setForm((f) => ({ ...f, contentUom: u }))}>
              <Text style={[styles.chipText, form.contentUom === u && styles.chipTextActive]}>{UOM_LABELS_TR[u]}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      <TouchableOpacity style={styles.toggleRow} onPress={() => setForm((f) => ({ ...f, isActive: !f.isActive }))}>
        <View style={[styles.checkbox, form.isActive && styles.checkboxActive]} />
        <Text style={styles.toggleLabel}>Aktif</Text>
      </TouchableOpacity>
      {error && <Text style={styles.errorText}>{error}</Text>}
      <TouchableOpacity
        style={[styles.saveButton, update.isPending && styles.submitButtonDisabled]}
        disabled={update.isPending}
        onPress={() => {
          setError(null);
          update.mutate({
            id: variant.id,
            name: form.name.trim(),
            orderUom: form.orderUom,
            basePrice: toNumber(form.basePrice),
            minOrderQty: toNumber(form.minOrderQty),
            qtyStep: toNumber(form.qtyStep),
            contentAmount: toNumber(form.contentAmount) ?? null,
            contentUom: form.contentUom,
            lowStockThreshold: toNumber(form.lowStockThreshold) ?? null,
            isActive: form.isActive,
          });
        }}
      >
        {update.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Kaydet</Text>}
      </TouchableOpacity>
    </View>
  );
}

const EMPTY_NEW_VARIANT: VariantForm = {
  code: '',
  name: '',
  orderUom: 'adet',
  basePrice: '',
  minOrderQty: '1',
  qtyStep: '1',
  contentAmount: '',
  contentUom: null,
  lowStockThreshold: '',
  isActive: true,
};

function NewVariantForm({ productId }: { productId: string }) {
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<VariantForm>(EMPTY_NEW_VARIANT);
  const [error, setError] = useState<string | null>(null);

  const create = trpc.catalog.createVariant.useMutation({
    onSuccess: () => {
      setForm(EMPTY_NEW_VARIANT);
      setOpen(false);
      void utils.catalog.adminProduct.invalidate({ id: productId });
      void utils.catalog.list.invalidate();
    },
    onError: (e) => setError(errText(e, 'Varyant eklenemedi.')),
  });

  if (!open) {
    return (
      <TouchableOpacity style={styles.newButton} onPress={() => setOpen(true)}>
        <Text style={styles.newButtonText}>+ Yeni varyant</Text>
      </TouchableOpacity>
    );
  }

  const canSubmit = form.code.trim() && form.name.trim() && toNumber(form.basePrice) != null;

  return (
    <View style={styles.variantEditor}>
      <View style={styles.field}>
        <Text style={styles.label}>Varyant kodu</Text>
        <TextInput style={styles.input} value={form.code} onChangeText={(v) => setForm((f) => ({ ...f, code: v }))} autoCapitalize="none" />
      </View>
      <View style={styles.field}>
        <Text style={styles.label}>Ad</Text>
        <TextInput style={styles.input} value={form.name} onChangeText={(v) => setForm((f) => ({ ...f, name: v }))} placeholder="ör. 1kg / Çekirdek" placeholderTextColor={colors.inkFaint} />
      </View>
      <View style={styles.field}>
        <Text style={styles.label}>Sipariş birimi</Text>
        <UomPicker value={form.orderUom} onChange={(u) => setForm((f) => ({ ...f, orderUom: u }))} />
      </View>
      <View style={styles.rowFields}>
        <View style={[styles.field, styles.flex1]}>
          <Text style={styles.label}>Fiyat</Text>
          <TextInput style={styles.input} value={form.basePrice} onChangeText={(v) => setForm((f) => ({ ...f, basePrice: v }))} keyboardType="decimal-pad" />
        </View>
        <View style={[styles.field, styles.flex1]}>
          <Text style={styles.label}>Min. sipariş</Text>
          <TextInput style={styles.input} value={form.minOrderQty} onChangeText={(v) => setForm((f) => ({ ...f, minOrderQty: v }))} keyboardType="decimal-pad" />
        </View>
        <View style={[styles.field, styles.flex1]}>
          <Text style={styles.label}>Adım</Text>
          <TextInput style={styles.input} value={form.qtyStep} onChangeText={(v) => setForm((f) => ({ ...f, qtyStep: v }))} keyboardType="decimal-pad" />
        </View>
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
      <View style={styles.rowFields}>
        <TouchableOpacity style={styles.ghostButton} onPress={() => setOpen(false)}>
          <Text style={styles.ghostButtonText}>Vazgeç</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.saveButton, styles.flex1, (!canSubmit || create.isPending) && styles.submitButtonDisabled]}
          disabled={!canSubmit || create.isPending}
          onPress={() => {
            setError(null);
            create.mutate({
              productId,
              code: form.code.trim(),
              name: form.name.trim(),
              orderUom: form.orderUom,
              basePrice: toNumber(form.basePrice) ?? 0,
              minOrderQty: toNumber(form.minOrderQty),
              qtyStep: toNumber(form.qtyStep),
              contentAmount: toNumber(form.contentAmount),
              contentUom: form.contentUom ?? undefined,
              lowStockThreshold: toNumber(form.lowStockThreshold),
            });
          }}
        >
          {create.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Ekle</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function UrunDuzenleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const utils = trpc.useUtils();
  const { data: p, isLoading } = trpc.catalog.adminProduct.useQuery({ id });
  const categories = trpc.catalog.categories.useQuery();

  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [allowPreorder, setAllowPreorder] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openVariant, setOpenVariant] = useState<string | null>(null);

  useEffect(() => {
    if (!p) return;
    setName(p.name);
    setBrand(p.brand ?? '');
    setDescription(p.description ?? '');
    setImageUrl(p.imageUrl ?? '');
    setCategoryId(p.categoryId);
    setAllowPreorder(p.allowPreorder);
    setIsActive(p.isActive);
  }, [p]);

  const update = trpc.catalog.updateProduct.useMutation({
    onSuccess: () => {
      void utils.catalog.adminProduct.invalidate({ id });
      void utils.catalog.adminList.invalidate();
      void utils.catalog.list.invalidate();
    },
    onError: (e) => setError(errText(e, 'Kaydedilemedi.')),
  });

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
      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>Ürün · {p.code}</Text>
        <View style={styles.field}>
          <Text style={styles.label}>Ad</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Marka</Text>
          <TextInput style={styles.input} value={brand} onChangeText={setBrand} placeholder="opsiyonel" placeholderTextColor={colors.inkFaint} />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Açıklama</Text>
          <TextInput style={[styles.input, styles.multiline]} value={description} onChangeText={setDescription} multiline placeholder="opsiyonel" placeholderTextColor={colors.inkFaint} />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Görsel URL</Text>
          <TextInput style={styles.input} value={imageUrl} onChangeText={setImageUrl} autoCapitalize="none" keyboardType="url" placeholder="https://…" placeholderTextColor={colors.inkFaint} />
        </View>
        {categories.data && categories.data.length > 0 && (
          <View style={styles.field}>
            <Text style={styles.label}>Kategori</Text>
            <View style={styles.chipRow}>
              {categories.data.map((c) => (
                <TouchableOpacity key={c.id} style={[styles.chip, categoryId === c.id && styles.chipActive]} onPress={() => setCategoryId(categoryId === c.id ? null : c.id)}>
                  <Text style={[styles.chipText, categoryId === c.id && styles.chipTextActive]}>{c.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
        <TouchableOpacity style={styles.toggleRow} onPress={() => setAllowPreorder((v) => !v)}>
          <View style={[styles.checkbox, allowPreorder && styles.checkboxActive]} />
          <Text style={styles.toggleLabel}>Ön siparişe izin ver</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.toggleRow} onPress={() => setIsActive((v) => !v)}>
          <View style={[styles.checkbox, isActive && styles.checkboxActive]} />
          <Text style={styles.toggleLabel}>Aktif (katalogda görünür)</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.saveButton, update.isPending && styles.submitButtonDisabled]}
          disabled={update.isPending}
          onPress={() => {
            setError(null);
            update.mutate({
              id,
              name: name.trim(),
              brand: brand.trim() || null,
              description: description.trim() || null,
              imageUrl: imageUrl.trim() || null,
              categoryId,
              allowPreorder,
              isActive,
            });
          }}
        >
          {update.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Ürünü kaydet</Text>}
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>Varyantlar ({p.variants.length})</Text>
        {p.variants.map((v) => {
          const isOpen = openVariant === v.id;
          return (
            <View key={v.id} style={styles.variantBlock}>
              <TouchableOpacity style={styles.variantRow} onPress={() => setOpenVariant(isOpen ? null : v.id)}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{v.name}</Text>
                  <Text style={styles.cardMeta}>
                    {v.code} · {v.basePrice.toFixed(2)} · {UOM_LABELS_TR[v.orderUom as Uom]}
                    {!v.isActive ? ' · pasif' : ''}
                  </Text>
                </View>
                <Text style={styles.chevron}>{isOpen ? '−' : '+'}</Text>
              </TouchableOpacity>
              {isOpen && (
                <VariantEditor
                  productId={p.id}
                  variant={{
                    id: v.id,
                    code: v.code,
                    name: v.name,
                    orderUom: v.orderUom as Uom,
                    basePrice: String(v.basePrice),
                    minOrderQty: String(v.minOrderQty),
                    qtyStep: String(v.qtyStep),
                    contentAmount: v.contentAmount != null ? String(v.contentAmount) : '',
                    contentUom: v.contentUom as Uom | null,
                    lowStockThreshold: v.lowStockThreshold != null ? String(v.lowStockThreshold) : '',
                    isActive: v.isActive,
                  }}
                />
              )}
            </View>
          );
        })}
        <NewVariantForm productId={p.id} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  flexCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  content: { padding: spacing(5), gap: spacing(4) },
  errorBox: { backgroundColor: colors.dangerSoft, borderRadius: radius.sm, padding: spacing(3) },
  errorText: { color: colors.danger, fontSize: 12 },
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
  field: { gap: spacing(1.5) },
  rowFields: { flexDirection: 'row', gap: spacing(2) },
  flex1: { flex: 1 },
  label: { fontSize: 12, color: colors.inkMuted, fontWeight: '600' },
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
  multiline: { minHeight: 70, textAlignVertical: 'top' },
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
  saveButton: { backgroundColor: colors.accent, borderRadius: radius.sm, paddingVertical: spacing(3), alignItems: 'center' },
  saveButtonText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  submitButtonDisabled: { backgroundColor: colors.border },
  ghostButton: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: spacing(3), paddingVertical: spacing(3), alignItems: 'center', justifyContent: 'center' },
  ghostButtonText: { color: colors.inkMuted, fontWeight: '600', fontSize: 12 },
  newButton: { borderWidth: 1, borderColor: colors.accent, borderRadius: radius.sm, paddingVertical: spacing(3), alignItems: 'center' },
  newButtonText: { color: colors.accent, fontWeight: '700', fontSize: 13 },
  variantBlock: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing(2.5), gap: spacing(2) },
  variantRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(2) },
  rowTitle: { fontSize: 14, fontWeight: '600', color: colors.ink },
  chevron: { fontSize: 18, color: colors.inkMuted, fontWeight: '700' },
  variantEditor: { gap: spacing(2.5), paddingLeft: spacing(1) },
});
