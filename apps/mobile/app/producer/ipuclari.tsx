import { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { trpc } from '@/lib/trpc';
import { colors, radius, spacing, shadow } from '@/theme';

/** Günün ipuçları: yönetici/satış girer, müşteri ana sayfasında her gün sıradaki ipucu görünür. */
export default function IpuclariScreen() {
  const utils = trpc.useUtils();
  const list = trpc.recipe.tipList.useQuery();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);

  const refresh = (): void => {
    void utils.recipe.tipList.invalidate();
    void utils.recipe.tipToday.invalidate();
  };
  const create = trpc.recipe.tipCreate.useMutation({
    onSuccess: () => {
      setTitle('');
      setBody('');
      refresh();
    },
    onError: (e) => setError(e.message.length < 200 ? e.message : 'Kaydedilemedi.'),
  });
  const setActive = trpc.recipe.tipSetActive.useMutation({ onSuccess: refresh });
  const remove = trpc.recipe.tipRemove.useMutation({ onSuccess: refresh });

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.card}>
        <Text style={styles.heading}>Yeni ipucu</Text>
        {error && <Text style={styles.error}>{error}</Text>}
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="Başlık (opsiyonel)"
          placeholderTextColor={colors.inkFaint}
        />
        <TextInput
          style={[styles.input, styles.multi]}
          value={body}
          onChangeText={setBody}
          placeholder="İpucu metni — ör. Espresso için su sıcaklığı 92–94°C olmalı."
          placeholderTextColor={colors.inkFaint}
          multiline
        />
        <TouchableOpacity
          style={[styles.btn, (body.trim().length < 3 || create.isPending) && styles.btnOff]}
          disabled={body.trim().length < 3 || create.isPending}
          onPress={() => {
            setError(null);
            create.mutate({ title: title || null, body });
          }}
        >
          <Text style={styles.btnText}>{create.isPending ? 'Ekleniyor…' : 'İpucu ekle'}</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.heading}>Tüm ipuçları</Text>
      {list.isLoading && <ActivityIndicator color={colors.accent} />}
      {list.data?.length === 0 && <Text style={styles.muted}>Henüz ipucu yok.</Text>}
      {list.data?.map((t) => (
        <View key={t.id} style={styles.card}>
          {t.title ? <Text style={styles.tipTitle}>{t.title}</Text> : null}
          <Text style={styles.body}>{t.body}</Text>
          <View style={styles.row}>
            <View style={styles.switchRow}>
              <Switch value={t.isActive} onValueChange={(v) => setActive.mutate({ id: t.id, isActive: v })} />
              <Text style={styles.muted}>{t.isActive ? 'Yayında' : 'Gizli'}</Text>
            </View>
            <TouchableOpacity
              onPress={() =>
                Alert.alert('İpucu silinsin mi?', t.body.slice(0, 80), [
                  { text: 'Vazgeç', style: 'cancel' },
                  { text: 'Sil', style: 'destructive', onPress: () => remove.mutate({ id: t.id }) },
                ])
              }
            >
              <Text style={styles.del}>Sil</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing(5), gap: spacing(3), paddingBottom: spacing(12) },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing(4), gap: spacing(2.5), ...shadow.card },
  heading: { fontSize: 15, fontWeight: '800', color: colors.ink },
  input: {
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2.5),
    fontSize: 14,
    color: colors.ink,
  },
  multi: { minHeight: 80, textAlignVertical: 'top' },
  btn: { backgroundColor: colors.accent, borderRadius: radius.sm, paddingVertical: spacing(3), alignItems: 'center' },
  btnOff: { backgroundColor: colors.border },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  error: { color: colors.danger, fontSize: 13 },
  muted: { fontSize: 12, color: colors.inkMuted },
  tipTitle: { fontSize: 14, fontWeight: '800', color: colors.ink },
  body: { fontSize: 14, color: colors.ink, lineHeight: 20 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(2) },
  del: { color: colors.danger, fontWeight: '700', fontSize: 13 },
});
