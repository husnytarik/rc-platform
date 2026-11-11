import { isValidTcKimlik, normalizeTc, toE164TR } from '@rc/shared';
import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/providers/auth-context';
import { trpc } from '@/lib/trpc';
import { colors, radius, spacing } from '@/theme';

function errText(e: unknown, fallback: string): string {
  const m = (e as { message?: string } | undefined)?.message;
  return m && m.length < 200 ? m : fallback;
}

const RESEND_SECONDS = 60;

export default function LoginScreen() {
  const { status, login } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [tc, setTc] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [wait, setWait] = useState(0);
  const requestOtp = trpc.auth.requestOtp.useMutation();
  const verifyOtp = trpc.auth.verifyOtp.useMutation();
  const demoLogin = trpc.auth.demoLogin.useMutation();
  const [demoOpen, setDemoOpen] = useState(false);
  const [demoCode, setDemoCode] = useState('');

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  if (status === 'authenticated') return <Redirect href="/" />;

  const tcOk = isValidTcKimlik(tc);
  const phoneOk = toE164TR(phone) !== null;
  const codeReady = needsPassword ? code.length >= 6 : code.length === 6;
  const busy = requestOtp.isPending || verifyOtp.isPending || demoLogin.isPending;

  const sendCode = (): void => {
    setError(null);
    requestOtp.mutate(
      { tc: normalizeTc(tc), phone: phone.trim() },
      {
        onSuccess: (r) => {
          setCodeSent(true);
          // SMS sağlayıcısı yokken (mock): müşteri kodu sunucudan gelir ve alan otomatik dolar;
          // yönetici numarası için kod yerine yönetici şifresi girilir.
          setNeedsPassword(r.needsPassword === true);
          setCode(r.devCode ?? '');
          setWait(RESEND_SECONDS);
        },
        onError: (e: unknown) => setError(errText(e, 'Kod gönderilemedi. Tekrar dener misin?')),
      },
    );
  };

  const submitCode = (): void => {
    setError(null);
    verifyOtp.mutate(
      { tc: normalizeTc(tc), phone: phone.trim(), code },
      {
        onSuccess: (session) => {
          void login({ accessToken: session.accessToken, refreshToken: session.refreshToken });
        },
        onError: (e: unknown) => setError(errText(e, 'Giriş yapılamadı. Tekrar dener misin?')),
      },
    );
  };

  const submitDemo = (): void => {
    setError(null);
    demoLogin.mutate(
      { code: demoCode.trim() },
      {
        onSuccess: (session) => {
          void login({ accessToken: session.accessToken, refreshToken: session.refreshToken });
        },
        onError: (e: unknown) => setError(errText(e, 'Demo girişi yapılamadı.')),
      },
    );
  };

  return (
    <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.hero}>
          <View style={styles.mark}>
            <Text style={styles.markText}>RC</Text>
          </View>
          <Text style={styles.brand}>RoasteryClub</Text>
          <Text style={styles.tagline}>Üreticiden işletmene, tek platformda</Text>
        </View>

        <ScrollView
          style={styles.sheetScroll}
          contentContainerStyle={styles.sheet}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.sheetTitle}>Giriş yap</Text>
          <Text style={styles.sheetSubtitle}>
            {codeSent
              ? needsPassword
                ? 'Yönetici şifreni gir.'
                : 'Telefonuna gelen 6 haneli kodu gir.'
              : 'T.C. kimlik numaranı ve telefonunu gir, sana SMS ile bir kod gönderelim.'}
          </Text>

          <View style={styles.fields}>
            <TextInput
              style={[styles.input, codeSent && styles.inputLocked]}
              value={tc}
              onChangeText={setTc}
              placeholder="T.C. kimlik no"
              placeholderTextColor={colors.inkFaint}
              keyboardType="number-pad"
              maxLength={11}
              editable={!codeSent && !busy}
            />
            <TextInput
              style={[styles.input, codeSent && styles.inputLocked]}
              value={phone}
              onChangeText={setPhone}
              placeholder="Telefon (05xx xxx xx xx)"
              placeholderTextColor={colors.inkFaint}
              keyboardType="phone-pad"
              editable={!codeSent && !busy}
            />
            {codeSent && (
              <TextInput
                style={[styles.input, styles.codeInput]}
                value={code}
                onChangeText={(v) => setCode(needsPassword ? v.slice(0, 64) : v.replace(/\D/g, '').slice(0, 6))}
                placeholder={needsPassword ? 'Yönetici şifresi' : '______'}
                placeholderTextColor={colors.inkFaint}
                keyboardType={needsPassword ? 'default' : 'number-pad'}
                maxLength={needsPassword ? 64 : 6}
                autoFocus
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry={needsPassword}
                textContentType={needsPassword ? 'password' : 'oneTimeCode'}
                autoComplete={needsPassword ? 'current-password' : 'sms-otp'}
                editable={!busy}
                onSubmitEditing={() => codeReady && !busy && submitCode()}
              />
            )}
          </View>

          {!codeSent ? (
            <TouchableOpacity
              style={[styles.primary, (!tcOk || !phoneOk || busy) && styles.disabled]}
              disabled={!tcOk || !phoneOk || busy}
              onPress={sendCode}
            >
              <Text style={styles.primaryText}>Kod gönder</Text>
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity
                style={[styles.primary, (!codeReady || busy) && styles.disabled]}
                disabled={!codeReady || busy}
                onPress={submitCode}
              >
                <Text style={styles.primaryText}>Giriş yap</Text>
              </TouchableOpacity>
              <View style={styles.linkRow}>
                <TouchableOpacity disabled={wait > 0 || busy} onPress={sendCode}>
                  <Text style={[styles.link, (wait > 0 || busy) && styles.linkDisabled]}>
                    {wait > 0 ? `Kodu tekrar gönder (${wait})` : 'Kodu tekrar gönder'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  disabled={busy}
                  onPress={() => {
                    setCodeSent(false);
                    setNeedsPassword(false);
                    setCode('');
                    setError(null);
                  }}
                >
                  <Text style={styles.link}>Bilgileri değiştir</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {demoOpen ? (
            <View style={styles.demoBox}>
              <TextInput
                style={styles.demoInput}
                value={demoCode}
                onChangeText={setDemoCode}
                placeholder="Demo kodu"
                placeholderTextColor={colors.inkFaint}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
              />
              <TouchableOpacity
                style={[styles.demoButton, (busy || demoCode.trim().length < 4) && styles.disabled]}
                disabled={busy || demoCode.trim().length < 4}
                onPress={submitDemo}
              >
                <Text style={styles.demoButtonText}>Demo ile gir</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity onPress={() => setDemoOpen(true)}>
              <Text style={styles.demoLink}>Demo girişi</Text>
            </TouchableOpacity>
          )}

          {busy && (
            <View style={styles.busyRow}>
              <ActivityIndicator color={colors.accent} />
              <Text style={styles.busyText}>Lütfen bekle…</Text>
            </View>
          )}

          {error && <Text style={styles.error}>{error}</Text>}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.accent },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing(3),
    paddingHorizontal: spacing(6),
  },
  mark: {
    width: 64,
    height: 64,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing(1),
  },
  markText: { color: '#fff', fontSize: 22, fontWeight: '800', letterSpacing: 0.5 },
  brand: { color: '#fff', fontSize: 30, fontWeight: '800', letterSpacing: 0.3 },
  tagline: { color: 'rgba(255,255,255,0.85)', fontSize: 14, textAlign: 'center' },
  sheetScroll: {
    flexGrow: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg + 8,
    borderTopRightRadius: radius.lg + 8,
  },
  sheet: {
    paddingHorizontal: spacing(6),
    paddingTop: spacing(8),
    paddingBottom: spacing(9),
    gap: spacing(1),
  },
  sheetTitle: { fontSize: 19, fontWeight: '700', color: colors.ink, textAlign: 'center' },
  sheetSubtitle: {
    fontSize: 13,
    color: colors.inkMuted,
    textAlign: 'center',
    marginTop: spacing(1),
    marginBottom: spacing(5),
    lineHeight: 19,
  },
  fields: { gap: spacing(3) },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing(3.5),
    paddingVertical: spacing(3.5),
    fontSize: 16,
    color: colors.ink,
    backgroundColor: colors.surface,
  },
  inputLocked: { backgroundColor: colors.bg, color: colors.inkMuted },
  codeInput: { textAlign: 'center', fontSize: 24, letterSpacing: 8, fontWeight: '700' },
  primary: {
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    paddingVertical: spacing(3.5),
    alignItems: 'center',
    marginTop: spacing(4),
  },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  disabled: { opacity: 0.5 },
  linkRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing(4) },
  link: { color: colors.accent, fontSize: 13, fontWeight: '600' },
  linkDisabled: { color: colors.inkFaint },
  demoLink: {
    color: colors.inkMuted,
    fontSize: 13,
    textAlign: 'center',
    marginTop: spacing(5),
    textDecorationLine: 'underline',
  },
  demoBox: { gap: spacing(2), marginTop: spacing(5) },
  demoInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2.5),
    fontSize: 15,
    color: colors.ink,
  },
  demoButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    paddingVertical: spacing(3),
    alignItems: 'center',
  },
  demoButtonText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  busyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing(2),
    marginTop: spacing(5),
  },
  busyText: { color: colors.inkMuted, fontSize: 13 },
  error: {
    color: colors.danger,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.sm,
    padding: spacing(3),
    fontSize: 13,
    textAlign: 'center',
    marginTop: spacing(5),
  },
});
