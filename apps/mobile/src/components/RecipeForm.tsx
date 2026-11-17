import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { ImageField } from '@/components/ImageField';
import { trpc } from '@/lib/trpc';
import { colors, radius, spacing } from '@/theme';

const CATEGORIES = ['Espresso', 'Sütlü', 'Soğuk', 'Filtre', 'Tatlı', 'Geleneksel'];
const DIFFS = [
  { k: 'kolay', l: 'Kolay' },
  { k: 'orta', l: 'Orta' },
  { k: 'zor', l: 'Zor' },
] as const;

export interface RecipeValues {
  title: string;
  subtitle: string;
  description: string;
  imageUrl: string;
  category: string;
  prepMinutes: string;
  servings: string;
  difficulty: 'kolay' | 'orta' | 'zor';
  ingredients: string;
  steps: string;
  tip: string;
  isActive: boolean;
}

export const EMPTY_RECIPE: RecipeValues = {
  title: '',
  subtitle: '',
  description: '',
  imageUrl: '',
  category: 'Espresso',
  prepMinutes: '5',
  servings: '1',
  difficulty: 'kolay',
  ingredients: '',
  steps: '',
  tip: '',
  isActive: true,
};

const lines = (s: string): string[] =>
  s
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean);

/** Yönetici: yeni reçete ekle / düzenle. Malzeme ve adımlar satır satır yazılır. */
export function RecipeForm({ id, initial }: { id?: string; initial: RecipeValues }) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const [v, setV] = useState<RecipeValues>(initial);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof RecipeValues>(k: K, val: RecipeValues[K]): void => setV((p) => ({ ...p, [k]: val }));

  const done = (): void => {
    void utils.recipe.invalidate();
    router.back();
  };
  const onError = (e: { message?: string }): void =>
    setError(e.message && e.message.length < 200 ? e.message : 'Kaydedilemedi.');
  const create = trpc.recipe.create.useMutation({ onSuccess: done, onError });
  const update = trpc.recipe.update.useMutation({ onSuccess: done, onError });
  const remove = trpc.recipe.remove.useMutation({ onSuccess: done, onError });

  const ing = lines(v.ingredients);
  const stp = lines(v.steps);
  const canSave = v.title.trim().length >= 2 && ing.length > 0 && stp.length > 0;
  const busy = create.isPending || update.isPending;

  const save = (): void => {
    setError(null);
    const body = {
      title: v.title,
      subtitle: v.subtitle || null,
      description: v.description || null,
      imageUrl: v.imageUrl || null,
      category: v.category,
      prepMinutes: Math.max(1, parseInt(v.prepMinutes, 10) || 5),
      servings: Math.max(1, parseInt(v.servings, 10) || 1),
      difficulty: v.difficulty,
      ingredients: ing,
      steps: stp,
      tip: v.tip || null,
      isActive: v.isActive,
    };
    if (id) update.mutate({ id, ...body });
    else create.mutate(body);
  };

  const textField = (
    label: string,
    key: 'title' | 'subtitle' | 'description' | 'ingredients' | 'steps' | 'tip' | 'prepMinutes' | 'servings',
    opts: { multi?: boolean; ph?: string; num?: boolean } = {},
  ) => (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, opts.multi && styles.multi]}
        value={v[key]}
        onChangeText={(t) => set(key, t)}
        placeholder={opts.ph}
        placeholderTextColor={colors.inkFaint}
        multiline={opts.multi}
        keyboardType={opts.num ? 'number-pad' : 'default'}
      />
    </View>
  );

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
      {textField('Başlık *', 'title', { ph: 'ör. Flat White' })}
      {textField('Alt başlık', 'subtitle', { ph: 'Kısa tanım' })}
      <View style={styles.field}>
        <Text style={styles.label}>Görsel</Text>
        <ImageField value={v.imageUrl} onChange={(x) => set('imageUrl', x)} />
      </View>
      <View style={styles.field}>
        <Text style={styles.label}>Kategori</Text>
        <View style={styles.chipRow}>
          {CATEGORIES.map((c) => (
            <TouchableOpacity
              key={c}
              style={[styles.chip, v.category === c && styles.chipActive]}
              onPress={() => set('category', c)}
            >
              <Text style={[styles.chipText, v.category === c && styles.chipTextActive]}>{c}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      <View style={styles.field}>
        <Text style={styles.label}>Zorluk</Text>
        <View style={styles.chipRow}>
          {DIFFS.map((d) => (
            <TouchableOpacity
              key={d.k}
              style={[styles.chip, v.difficulty === d.k && styles.chipActive]}
              onPress={() => set('difficulty', d.k)}
            >
              <Text style={[styles.chipText, v.difficulty === d.k && styles.chipTextActive]}>{d.l}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      <View style={styles.twoCol}>
        <View style={styles.half}>{textField('Süre (dk)', 'prepMinutes', { num: true })}</View>
        <View style={styles.half}>{textField('Kaç kişilik', 'servings', { num: true })}</View>
      </View>
      {textField('Açıklama', 'description', { multi: true })}
      {textField('Malzemeler * (her satıra bir tane)', 'ingredients', { multi: true, ph: '18 g espresso\n150 ml süt' })}
      {textField('Hazırlanışı * (her satıra bir adım)', 'steps', { multi: true, ph: 'Espressoyu çek\nSütü buharla' })}
      {textField('İpucu', 'tip', { multi: true })}

      <TouchableOpacity style={styles.toggle} onPress={() => set('isActive', !v.isActive)}>
        <View style={[styles.box, v.isActive && styles.boxOn]} />
        <Text style={styles.toggleText}>Müşterilere göster (yayında)</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.save, (!canSave || busy) && styles.saveOff]}
        disabled={!canSave || busy}
        onPress={save}
      >
        <Text style={styles.saveText}>{busy ? 'Kaydediliyor…' : id ? 'Kaydet' : 'Reçeteyi ekle'}</Text>
      </TouchableOpacity>

      {id && (
        <TouchableOpacity
          onPress={() =>
            Alert.alert('Reçete silinsin mi?', v.title, [
              { text: 'Vazgeç', style: 'cancel' },
              { text: 'Sil', style: 'destructive', onPress: () => remove.mutate({ id }) },
            ])
          }
        >
          <Text style={styles.del}>Reçeteyi sil</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing(5), gap: spacing(4), paddingBottom: spacing(12) },
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
  multi: { minHeight: 90, textAlignVertical: 'top' },
  twoCol: { flexDirection: 'row', gap: spacing(3) },
  half: { flex: 1 },
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
  toggle: { flexDirection: 'row', alignItems: 'center', gap: spacing(2.5) },
  box: { width: 20, height: 20, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border },
  boxOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  toggleText: { fontSize: 13, color: colors.ink, fontWeight: '600' },
  save: { backgroundColor: colors.accent, borderRadius: radius.sm, paddingVertical: spacing(3.5), alignItems: 'center' },
  saveOff: { backgroundColor: colors.border },
  saveText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  del: { color: colors.danger, textAlign: 'center', fontWeight: '700', paddingVertical: spacing(2) },
});
