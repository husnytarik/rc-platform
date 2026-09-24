import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { trpc } from '@/lib/trpc';
import { colors, radius, spacing } from '@/theme';

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
  const [error, setError] = useState<string | null>(null);

  const create = trpc.catalog.createProduct.useMutation({
    onSuccess: ({ id }) => {
      void utils.catalog.adminList.invalidate();
      router.replace({ pathname: '/producer/katalog/[id]', params: { id } });
    },
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
        <Text style={styles.label}>Görsel URL</Text>
        <TextInput
          style={styles.input}
          value={imageUrl}
          onChangeText={setImageUrl}
          placeholder="https://…"
          placeholderTextColor={colors.inkFaint}
          autoCapitalize="none"
          keyboardType="url"
        />
      </View>

      {categories.data && categories.data.length > 0 && (
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
          </View>
        </View>
      )}

      <TouchableOpacity style={styles.toggleRow} onPress={() => setAllowPreorder((v) => !v)}>
        <View style={[styles.checkbox, allowPreorder && styles.checkboxActive]} />
        <Text style={styles.toggleLabel}>Ön siparişe izin ver</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.submitButton, (!canSubmit || create.isPending) && styles.submitButtonDisabled]}
        disabled={!canSubmit || create.isPending}
        onPress={() => {
          setError(null);
          create.mutate({
            code: code.trim(),
            name: name.trim(),
            brand: brand.trim() || undefined,
            description: description.trim() || undefined,
            imageUrl: imageUrl.trim() || undefined,
            categoryId: categoryId ?? undefined,
            allowPreorder,
          });
        }}
      >
        {create.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitButtonText}>Ürünü oluştur</Text>}
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
