import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { trpc } from '@/lib/trpc';
import { colors, radius, spacing } from '@/theme';

/** Kategori seçicinin sonunda "+ Yeni kategori": ad yaz, ekle, otomatik seçilir. */
export function NewCategoryChip({ onCreated }: { onCreated: (id: string) => void }) {
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const create = trpc.catalog.createCategory.useMutation({
    onSuccess: (c) => {
      void utils.catalog.categories.invalidate();
      onCreated(c.id);
      setName('');
      setOpen(false);
    },
    onError: () => setError('Eklenemedi.'),
  });

  if (!open) {
    return (
      <TouchableOpacity style={styles.chip} onPress={() => setOpen(true)}>
        <Text style={styles.chipText}>+ Yeni kategori</Text>
      </TouchableOpacity>
    );
  }
  const ok = name.trim().length >= 2 && !create.isPending;
  return (
    <View style={styles.box}>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={(v) => {
          setName(v);
          setError(null);
        }}
        placeholder="Kategori adı"
        placeholderTextColor={colors.inkFaint}
        autoFocus
      />
      <TouchableOpacity disabled={!ok} onPress={() => create.mutate({ name: name.trim() })}>
        {create.isPending ? <ActivityIndicator color={colors.accent} /> : <Text style={[styles.add, !ok && styles.off]}>Ekle</Text>}
      </TouchableOpacity>
      <TouchableOpacity onPress={() => setOpen(false)}>
        <Text style={styles.cancel}>Vazgeç</Text>
      </TouchableOpacity>
      {error && <Text style={styles.err}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { borderWidth: 1, borderStyle: 'dashed', borderColor: colors.accent, borderRadius: radius.pill, paddingHorizontal: spacing(3), paddingVertical: spacing(1.5) },
  chipText: { fontSize: 12, fontWeight: '700', color: colors.accent },
  box: { flexDirection: 'row', alignItems: 'center', gap: spacing(3), flexBasis: '100%', flexWrap: 'wrap' },
  input: { flex: 1, minWidth: 140, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: spacing(3), paddingVertical: spacing(2), fontSize: 14, color: colors.ink },
  add: { color: colors.accent, fontWeight: '800', fontSize: 14 },
  off: { opacity: 0.4 },
  cancel: { color: colors.inkMuted, fontSize: 13 },
  err: { color: colors.danger, fontSize: 12 },
});
