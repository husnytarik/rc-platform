import { ScrollView, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { trpc } from '@/lib/trpc';
import { colors, radius, spacing } from '@/theme';

/** Yatay kategori filtresi. mode: seçim değeri slug mı id mi. "Tümü" = null. */
export function CategoryChips({
  value,
  onChange,
  mode,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  mode: 'slug' | 'id';
}) {
  const cats = trpc.catalog.categories.useQuery();
  if (!cats.data || cats.data.length === 0) return null;
  const items = [{ key: null as string | null, label: 'Tümü' }, ...cats.data.map((c) => ({ key: mode === 'slug' ? c.slug : c.id, label: c.name }))];
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} keyboardShouldPersistTaps="handled">
      {items.map((c) => {
        const on = c.key === value;
        return (
          <TouchableOpacity key={c.key ?? 'all'} style={[styles.chip, on && styles.chipOn]} onPress={() => onChange(c.key)}>
            <Text style={[styles.text, on && styles.textOn]}>{c.label}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing(2), paddingRight: spacing(4) },
  chip: {
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: spacing(3.5),
    paddingVertical: spacing(1.75),
  },
  chipOn: { backgroundColor: colors.accent },
  text: { fontSize: 13, fontWeight: '700', color: colors.inkMuted },
  textOn: { color: '#fff' },
});
