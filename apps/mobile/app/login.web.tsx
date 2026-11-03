import { Redirect } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAuth } from '@/providers/auth-context';
import { trpc } from '@/lib/trpc';
import { colors, radius, spacing } from '@/theme';

/**
 * Web sürümü: Google/Apple yerel giriş modülleri tarayıcıda çalışmaz, bu yüzden web'de
 * yalnızca demo kodu ile giriş vardır (üretici/müşteri ekranlarını bilgisayardan görmek için).
 */
export default function LoginWeb() {
  const { status, login } = useAuth();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const demo = trpc.auth.demoLogin.useMutation();

  if (status === 'authenticated') return <Redirect href="/" />;

  const submit = (): void => {
    setError(null);
    demo.mutate(
      { code: code.trim() },
      {
        onSuccess: (s) => void login({ accessToken: s.accessToken, refreshToken: s.refreshToken }),
        onError: (e: unknown) => {
          const m = (e as { message?: string }).message;
          setError(m && m.length < 200 ? m : 'Giriş yapılamadı.');
        },
      },
    );
  };

  const disabled = demo.isPending || code.trim().length < 4;

  return (
    <View style={styles.page}>
      <View style={styles.card}>
        <Text style={styles.brand}>RoasteryClub</Text>
        <Text style={styles.sub}>Web paneli · demo girişi</Text>
        <TextInput
          style={styles.input}
          value={code}
          onChangeText={setCode}
          placeholder="Demo kodu"
          placeholderTextColor={colors.inkFaint}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
          onSubmitEditing={() => !disabled && submit()}
        />
        <TouchableOpacity style={[styles.button, disabled && styles.disabled]} disabled={disabled} onPress={submit}>
          {demo.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Giriş yap</Text>}
        </TouchableOpacity>
        {error && <Text style={styles.error}>{error}</Text>}
        <Text style={styles.note}>Gerçek hesapla giriş (Google/Apple) mobil uygulamadadır.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', padding: spacing(5) },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing(6),
    gap: spacing(3),
  },
  brand: { fontSize: 26, fontWeight: '800', color: colors.ink, textAlign: 'center' },
  sub: { fontSize: 13, color: colors.inkMuted, textAlign: 'center', marginBottom: spacing(2) },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(3),
    fontSize: 15,
    color: colors.ink,
  },
  button: { backgroundColor: colors.accent, borderRadius: radius.sm, paddingVertical: spacing(3.5), alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  disabled: { opacity: 0.5 },
  error: {
    color: colors.danger,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.sm,
    padding: spacing(3),
    fontSize: 13,
    textAlign: 'center',
  },
  note: { fontSize: 12, color: colors.inkFaint, textAlign: 'center' },
});
