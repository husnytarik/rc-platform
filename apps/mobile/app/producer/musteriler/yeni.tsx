import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity } from 'react-native';
import { trpc } from '@/lib/trpc';
import { colors, radius, spacing } from '@/theme';

function errText(e: unknown, fallback: string): string {
  const m = (e as { message?: string } | undefined)?.message;
  return m && m.length < 200 ? m : fallback;
}

export default function YeniFirmaScreen() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const [f, setF] = useState({ name: '', taxId: '', phone: '', email: '', address: '', branchName: '', adminName: '', adminPhone: '' });
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v }));

  const create = trpc.customer.create.useMutation({
    onSuccess: ({ id }) => {
      void utils.customer.list.invalidate();
      router.replace({ pathname: '/producer/musteriler/[id]', params: { id } });
    },
    onError: (e) => setError(errText(e, 'Firma oluşturulamadı.')),
  });

  const submit = (): void => {
    setError(null);
    const o = (v: string) => (v.trim() ? v.trim() : undefined);
    create.mutate({
      name: f.name.trim(),
      taxId: o(f.taxId),
      phone: o(f.phone),
      email: o(f.email),
      address: o(f.address),
      branchName: o(f.branchName),
      adminName: o(f.adminName),
      adminPhone: o(f.adminPhone),
    });
  };

  const field = (label: string, k: keyof typeof f, kb?: 'phone-pad' | 'email-address') => (
    <>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={f[k]}
        onChangeText={set(k)}
        keyboardType={kb}
        autoCapitalize={kb === 'email-address' ? 'none' : 'sentences'}
        placeholderTextColor={colors.inkFaint}
      />
    </>
  );

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {field('Firma adı *', 'name')}
      {field('Vergi no', 'taxId')}
      {field('Telefon', 'phone', 'phone-pad')}
      {field('E-posta', 'email', 'email-address')}
      {field('Adres', 'address')}
      {field('İlk şube adı (boşsa Merkez Şube)', 'branchName')}
      <Text style={styles.section}>Firma yöneticisi (opsiyonel)</Text>
      {field('Ad soyad', 'adminName')}
      {field('Cep telefonu (05XX...)', 'adminPhone', 'phone-pad')}
      {error && <Text style={styles.error}>{error}</Text>}
      <TouchableOpacity
        style={[styles.save, (f.name.trim().length < 2 || create.isPending) && styles.disabled]}
        disabled={f.name.trim().length < 2 || create.isPending}
        onPress={submit}
      >
        {create.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Firmayı oluştur</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing(5), gap: spacing(2), paddingBottom: spacing(10) },
  label: { fontSize: 12, color: colors.inkMuted, fontWeight: '600', marginTop: spacing(1) },
  section: { fontSize: 15, fontWeight: '800', color: colors.ink, marginTop: spacing(4) },
  input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: spacing(3), paddingVertical: spacing(2.5), fontSize: 15, color: colors.ink },
  error: { color: colors.danger, fontSize: 13 },
  save: { backgroundColor: colors.accent, borderRadius: radius.sm, paddingVertical: spacing(3.5), alignItems: 'center', marginTop: spacing(3) },
  saveText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  disabled: { opacity: 0.5 },
});
