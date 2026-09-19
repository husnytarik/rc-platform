import {
  GoogleSignin,
  GoogleSigninButton,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/providers/auth-context';
import { trpc } from '@/lib/trpc';
import { colors, radius, spacing } from '@/theme';

GoogleSignin.configure({
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
});

function errText(e: unknown, fallback: string): string {
  const m = (e as { message?: string } | undefined)?.message;
  return m && m.length < 200 ? m : fallback;
}

export default function LoginScreen() {
  const { status, login } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const oauthLogin = trpc.auth.oauthLogin.useMutation();

  useEffect(() => {
    if (Platform.OS === 'ios') {
      void AppleAuthentication.isAvailableAsync().then(setAppleAvailable);
    }
  }, []);

  if (status === 'authenticated') return <Redirect href="/" />;

  const finish = (idToken: string, provider: 'google' | 'apple', fullName?: string): void => {
    setError(null);
    oauthLogin.mutate(
      { provider, idToken, fullName },
      {
        onSuccess: (session) => {
          void login({ accessToken: session.accessToken, refreshToken: session.refreshToken });
        },
        onError: (e: unknown) => setError(errText(e, 'Giriş yapılamadı. Tekrar dener misin?')),
      },
    );
  };

  const signInWithGoogle = async (): Promise<void> => {
    setError(null);
    try {
      await GoogleSignin.hasPlayServices();
      const res = await GoogleSignin.signIn();
      if (res.type !== 'success' || !res.data.idToken) return;
      finish(res.data.idToken, 'google');
    } catch (e) {
      const code = (e as { code?: string } | undefined)?.code;
      if (code === statusCodes.SIGN_IN_CANCELLED || code === statusCodes.IN_PROGRESS) return;
      setError(errText(e, 'Google ile giriş başarısız oldu.'));
    }
  };

  const signInWithApple = async (): Promise<void> => {
    setError(null);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) return;
      const fullName = credential.fullName
        ? AppleAuthentication.formatFullName(credential.fullName)
        : undefined;
      finish(credential.identityToken, 'apple', fullName && fullName.length > 0 ? fullName : undefined);
    } catch (e) {
      const code = (e as { code?: string } | undefined)?.code;
      if (code === 'ERR_REQUEST_CANCELED') return;
      setError(errText(e, 'Apple ile giriş başarısız oldu.'));
    }
  };

  const busy = oauthLogin.isPending;

  return (
    <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
      <View style={styles.hero}>
        <View style={styles.mark}>
          <Text style={styles.markText}>RC</Text>
        </View>
        <Text style={styles.brand}>RoasteryClub</Text>
        <Text style={styles.tagline}>Üreticiden işletmene, tek platformda</Text>
      </View>

      <View style={styles.sheet}>
        <Text style={styles.sheetTitle}>Devam etmek için giriş yap</Text>
        <Text style={styles.sheetSubtitle}>
          Telefon numaranı ilk başvuruda alıp ekibimiz seni arayarak doğrulayacak.
        </Text>

        <View style={styles.buttons}>
          <GoogleSigninButton
            style={styles.googleButton}
            size={GoogleSigninButton.Size.Wide}
            color={GoogleSigninButton.Color.Dark}
            disabled={busy}
            onPress={() => void signInWithGoogle()}
          />

          {Platform.OS === 'ios' && appleAvailable && (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={radius.sm}
              style={styles.appleButton}
              onPress={() => void signInWithApple()}
            />
          )}
        </View>

        {busy && (
          <View style={styles.busyRow}>
            <ActivityIndicator color={colors.accent} />
            <Text style={styles.busyText}>Giriş yapılıyor…</Text>
          </View>
        )}

        {error && <Text style={styles.error}>{error}</Text>}
      </View>
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
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg + 8,
    borderTopRightRadius: radius.lg + 8,
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
  buttons: { gap: spacing(3), alignItems: 'center' },
  googleButton: { width: '100%', height: 52 },
  appleButton: { width: '100%', height: 52 },
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
