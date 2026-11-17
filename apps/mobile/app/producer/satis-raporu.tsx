import { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { trpc } from '@/lib/trpc';
import { colors, radius, spacing, shadow } from '@/theme';

const p2 = (n: number): string => String(n).padStart(2, '0');
const fmtDate = (d: Date): string => `${p2(d.getDate())}.${p2(d.getMonth() + 1)}.${d.getFullYear()}`;
const fmtTime = (d: Date): string => `${p2(d.getHours())}:${p2(d.getMinutes())}`;

/** "GG.AA.YYYY" + "SS:DD" → Date (yerel saat); geçersizse null. */
function parseWhen(date: string, time: string): Date | null {
  const d = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec(date.trim());
  const t = /^(\d{1,2})[:.](\d{2})$/.exec(time.trim());
  if (!d || !t) return null;
  const out = new Date(Number(d[3]), Number(d[2]) - 1, Number(d[1]), Number(t[1]), Number(t[2]));
  return Number.isNaN(out.getTime()) ? null : out;
}

/** Satış personeli: başlık + kısa açıklama + tarih/saat ile elle rapor girişi. Yönetici hepsini görür. */
export default function SatisRaporuScreen() {
  const utils = trpc.useUtils();
  const list = trpc.report.entries.useQuery({});
  const now = new Date();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [date, setDate] = useState(fmtDate(now));
  const [time, setTime] = useState(fmtTime(now));
  const [error, setError] = useState<string | null>(null);

  const add = trpc.report.addEntry.useMutation({
    onSuccess: () => {
      const n = new Date();
      setTitle('');
      setBody('');
      setDate(fmtDate(n));
      setTime(fmtTime(n));
      void utils.report.entries.invalidate();
    },
    onError: (e) => setError(e.message.length < 200 ? e.message : 'Kaydedilemedi.'),
  });
  const remove = trpc.report.removeEntry.useMutation({ onSuccess: () => void utils.report.entries.invalidate() });

  const when = parseWhen(date, time);
  const canSave = title.trim().length >= 2 && when !== null && !add.isPending;

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.card}>
        <Text style={styles.heading}>Yeni rapor girişi</Text>
        {error && <Text style={styles.error}>{error}</Text>}
        <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Başlık" placeholderTextColor={colors.inkFaint} />
        <TextInput
          style={[styles.input, styles.multi]}
          value={body}
          onChangeText={setBody}
          placeholder="Kısa açıklama"
          placeholderTextColor={colors.inkFaint}
          multiline
        />
        <View style={styles.row}>
          <View style={styles.flexInner}>
            <Text style={styles.label}>Tarih (GG.AA.YYYY)</Text>
            <TextInput style={styles.input} value={date} onChangeText={setDate} placeholder="17.11.2026" placeholderTextColor={colors.inkFaint} />
          </View>
          <View style={styles.timeCol}>
            <Text style={styles.label}>Saat</Text>
            <TextInput style={styles.input} value={time} onChangeText={setTime} placeholder="14:30" placeholderTextColor={colors.inkFaint} />
          </View>
        </View>
        {when === null && <Text style={styles.error}>Tarih/saat biçimi geçersiz.</Text>}
        <TouchableOpacity
          style={[styles.btn, !canSave && styles.btnOff]}
          disabled={!canSave}
          onPress={() => {
            setError(null);
            if (when) add.mutate({ title, body: body || null, occurredAt: when });
          }}
        >
          <Text style={styles.btnText}>{add.isPending ? 'Kaydediliyor…' : 'Rapora ekle'}</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.heading}>Girişler</Text>
      {list.isLoading && <ActivityIndicator color={colors.accent} />}
      {list.data?.items.length === 0 && <Text style={styles.muted}>Henüz giriş yok.</Text>}
      {list.data?.items.map((e) => {
        const d = new Date(e.occurredAt);
        return (
          <View key={e.id} style={styles.card}>
            <View style={styles.row}>
              <Text style={[styles.entryTitle, styles.flexInner]}>{e.title}</Text>
              <Text style={styles.when}>
                {fmtDate(d)} {fmtTime(d)}
              </Text>
            </View>
            {e.body ? <Text style={styles.body}>{e.body}</Text> : null}
            <View style={styles.row}>
              <Text style={styles.muted}>{e.authorName}</Text>
              <TouchableOpacity
                onPress={() =>
                  Alert.alert('Giriş silinsin mi?', e.title, [
                    { text: 'Vazgeç', style: 'cancel' },
                    { text: 'Sil', style: 'destructive', onPress: () => remove.mutate({ id: e.id }) },
                  ])
                }
              >
                <Text style={styles.del}>Sil</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  flexInner: { flex: 1 },
  timeCol: { width: 90 },
  content: { padding: spacing(5), gap: spacing(3), paddingBottom: spacing(12) },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing(4), gap: spacing(2.5), ...shadow.card },
  heading: { fontSize: 15, fontWeight: '800', color: colors.ink },
  label: { fontSize: 12, color: colors.inkMuted, fontWeight: '600', marginBottom: spacing(1) },
  input: {
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2.5),
    fontSize: 14,
    color: colors.ink,
  },
  multi: { minHeight: 80, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: spacing(3), alignItems: 'center', justifyContent: 'space-between' },
  btn: { backgroundColor: colors.accent, borderRadius: radius.sm, paddingVertical: spacing(3), alignItems: 'center' },
  btnOff: { backgroundColor: colors.border },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  error: { color: colors.danger, fontSize: 13 },
  muted: { fontSize: 12, color: colors.inkMuted },
  entryTitle: { fontSize: 14, fontWeight: '800', color: colors.ink },
  when: { fontSize: 12, color: colors.inkMuted, fontWeight: '600' },
  body: { fontSize: 14, color: colors.ink, lineHeight: 20 },
  del: { color: colors.danger, fontWeight: '700', fontSize: 13 },
});
