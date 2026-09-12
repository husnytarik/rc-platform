import { Redirect } from 'expo-router';
import { useState } from 'react';
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
import { useAuth } from '@/providers/auth-context';
import { trpc } from '@/lib/trpc';

type Step = 'phone' | 'code' | 'register';

function errText(e: unknown, fallback: string): string {
  const m = (e as { message?: string } | undefined)?.message;
  return m && m.length < 200 ? m : fallback;
}

export default function LoginScreen() {
  const { status, login } = useAuth();
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [fullName, setFullName] = useState('');
  const [orgName, setOrgName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const requestOtp = trpc.auth.requestOtp.useMutation();
  const verifyOtp = trpc.auth.verifyOtp.useMutation();

  if (status === 'authenticated') return <Redirect href="/" />;

  const sendCode = (): void => {
    setError(null);
    requestOtp.mutate(
      { phone, purpose: 'login' },
      {
        onSuccess: () => setStep('code'),
        onError: (e: unknown) => setError(errText(e, 'Kod gönderilemedi. Numarayı kontrol et.')),
      },
    );
  };

  const verify = (register?: { fullName: string; orgName: string }): void => {
    setError(null);
    verifyOtp.mutate(
      { phone, code, register },
      {
        onSuccess: (session: { accessToken: string; refreshToken: string }) => {
          void login({ accessToken: session.accessToken, refreshToken: session.refreshToken });
        },
        onError: (e: unknown) => {
          const msg = errText(e, 'Kod doğrulanamadı.');
          if (msg.includes('KAYIT_GEREKLI')) {
            setStep('register');
            setError(null);
          } else {
            setError(msg);
          }
        },
      },
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>RoasteryClub</Text>
        <Text style={styles.subtitle}>
          {step === 'phone' && 'Cep telefon numaranla giriş yap'}
          {step === 'code' && `${phone} numarasına gönderilen kodu gir`}
          {step === 'register' && 'Firma bilgilerini gir — başvurun incelenecek'}
        </Text>

        {step === 'phone' && (
          <>
            <TextInput
              style={styles.input}
              placeholder="+90 5xx xxx xx xx"
              placeholderTextColor="#9c9284"
              keyboardType="phone-pad"
              autoFocus
              value={phone}
              onChangeText={setPhone}
            />
            <TouchableOpacity
              style={[styles.button, requestOtp.isPending && styles.buttonDisabled]}
              disabled={requestOtp.isPending || phone.trim().length < 7}
              onPress={sendCode}
            >
              {requestOtp.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Kod gönder</Text>
              )}
            </TouchableOpacity>
          </>
        )}

        {step === 'code' && (
          <>
            <TextInput
              style={styles.input}
              placeholder="6 haneli kod"
              placeholderTextColor="#9c9284"
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
              value={code}
              onChangeText={setCode}
            />
            <TouchableOpacity
              style={[styles.button, verifyOtp.isPending && styles.buttonDisabled]}
              disabled={verifyOtp.isPending || code.length !== 6}
              onPress={() => verify()}
            >
              {verifyOtp.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Giriş yap</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.linkButton}
              onPress={() => {
                setStep('phone');
                setCode('');
                setError(null);
              }}
            >
              <Text style={styles.linkText}>Numarayı değiştir</Text>
            </TouchableOpacity>
          </>
        )}

        {step === 'register' && (
          <>
            <TextInput
              style={styles.input}
              placeholder="Ad Soyad"
              placeholderTextColor="#9c9284"
              autoFocus
              value={fullName}
              onChangeText={setFullName}
            />
            <TextInput
              style={styles.input}
              placeholder="Firma adı"
              placeholderTextColor="#9c9284"
              value={orgName}
              onChangeText={setOrgName}
            />
            <TouchableOpacity
              style={[styles.button, verifyOtp.isPending && styles.buttonDisabled]}
              disabled={verifyOtp.isPending || fullName.trim().length < 2 || orgName.trim().length < 2}
              onPress={() => verify({ fullName, orgName })}
            >
              {verifyOtp.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Başvuruyu gönder</Text>
              )}
            </TouchableOpacity>
          </>
        )}

        {error && <Text style={styles.error}>{error}</Text>}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#fffaf5',
    gap: 12,
  },
  title: { fontSize: 28, fontWeight: '700', color: '#3a2418', textAlign: 'center' },
  subtitle: { fontSize: 15, color: '#7a6a5c', textAlign: 'center', marginBottom: 16 },
  input: {
    borderWidth: 1,
    borderColor: '#e3d5c5',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fff',
    color: '#3a2418',
  },
  button: {
    backgroundColor: '#c2410c',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  linkButton: { alignItems: 'center', paddingVertical: 8 },
  linkText: { color: '#c2410c', fontSize: 14 },
  error: { color: '#b91c1c', textAlign: 'center', marginTop: 8 },
});
