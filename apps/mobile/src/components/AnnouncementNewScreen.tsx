import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { trpc } from '@/lib/trpc';
import { colors, radius, spacing } from '@/theme';

type Audience = 'all' | 'organization';

const EXPIRY_OPTIONS: { label: string; days: number | null }[] = [
  { label: 'Süresiz', days: null },
  { label: '1 hafta', days: 7 },
  { label: '1 ay', days: 30 },
];

export function AnnouncementNewScreen() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<Audience>('all');
  const [picked, setPicked] = useState<string[]>([]);
  const [days, setDays] = useState<number | null>(null);

  const customers = trpc.customer.list.useQuery({ limit: 100, status: 'active' }, { enabled: audience === 'organization' });

  const create = trpc.announcement.create.useMutation({
    onSuccess: () => {
      void utils.announcement.list.invalidate();
      router.back();
    },
    onError: (e) => Alert.alert('Yayınlanamadı', e.message),
  });

  const valid =
    title.trim().length >= 2 && body.trim().length >= 2 && (audience === 'all' || picked.length > 0);

  const toggle = (id: string): void =>
    setPicked((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Başlık</Text>
        <TextInput style={styles.input} value={title} onChangeText={setTitle} maxLength={120} />
        <Text style={styles.label}>Mesaj</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={body}
          onChangeText={setBody}
          multiline
          maxLength={4000}
        />

        <Text style={styles.label}>Kime</Text>
        <View style={styles.row}>
          <Chip label="Tüm müşteriler" active={audience === 'all'} onPress={() => setAudience('all')} />
          <Chip label="Seçili müşteriler" active={audience === 'organization'} onPress={() => setAudience('organization')} />
        </View>
        {audience === 'organization' &&
          (customers.isLoading ? (
            <ActivityIndicator color={colors.accent} />
          ) : (
            <View style={styles.row}>
              {(customers.data?.items ?? []).map((c) => (
                <Chip key={c.id} label={c.name} active={picked.includes(c.id)} onPress={() => toggle(c.id)} />
              ))}
            </View>
          ))}

        <Text style={styles.label}>Süre</Text>
        <View style={styles.row}>
          {EXPIRY_OPTIONS.map((o) => (
            <Chip key={o.label} label={o.label} active={days === o.days} onPress={() => setDays(o.days)} />
          ))}
        </View>

        <TouchableOpacity
          style={[styles.submit, (!valid || create.isPending) && styles.disabled]}
          disabled={!valid || create.isPending}
          onPress={() =>
            create.mutate({
              title: title.trim(),
              body: body.trim(),
              audience,
              orgIds: audience === 'organization' ? picked : undefined,
              expiresAt: days ? new Date(Date.now() + days * 86_400_000) : undefined,
            })
          }
        >
          {create.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitText}>Yayınla ve bildir</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.chip, active && styles.chipActive]} onPress={onPress}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing(5), gap: spacing(2) },
  label: { fontSize: 12, fontWeight: '600', color: colors.inkMuted, marginTop: spacing(1.5) },
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
  multiline: { minHeight: 120, textAlignVertical: 'top' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(1.5) },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1.5),
    backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { fontSize: 12, color: colors.ink, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  submit: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing(3.5),
    alignItems: 'center',
    marginTop: spacing(3),
  },
  disabled: { opacity: 0.5 },
  submitText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
