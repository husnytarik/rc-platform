import type { ExpoConfig } from 'expo/config';

/**
 * RoasteryClub mobil — tek uygulama, tüm roller (müşteri/admin/personel),
 * Google/Apple ile giriş (telefon numarası kayıt formunda toplanır, admin
 * telefonla doğrular). Bundle id, App Store Connect'teki yayınlı "RoasteryClub"
 * kaydıyla (Apple ID 6752270952) eşleşecek şekilde ayarlandı — bu build oraya
 * güncelleme olarak gidiyor, yeni bir uygulama kaydı değil.
 *
 * GOOGLE_IOS_URL_SCHEME: Google Cloud Console'daki iOS OAuth client'ının
 * "reversed client ID"si (örn. com.googleusercontent.apps.XXXX) — .env'e
 * eklenip burada okunmalı. Boşken plugin'i hiç eklemiyoruz; google-signin'in
 * kendi plugin'i bu değer boş string bile olsa hard-fail veriyor, bu da
 * Google Cloud client'ları oluşturulana kadar `expo config`/prebuild'i kırardı.
 */
const googleSigninPlugin: [string, { iosUrlScheme: string }] | null = process.env
  .GOOGLE_IOS_URL_SCHEME
  ? [
      '@react-native-google-signin/google-signin',
      { iosUrlScheme: process.env.GOOGLE_IOS_URL_SCHEME },
    ]
  : null;

const config: ExpoConfig = {
  name: 'RoasteryClub',
  slug: 'roasteryclub',
  scheme: 'roasteryclub',
  version: '3.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  newArchEnabled: true,

  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#ffffff',
  },

  ios: {
    bundleIdentifier: 'com.roasteryclub.app',
    supportsTablet: true,
    buildNumber: '2',
    usesAppleSignIn: true,
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
  },

  android: {
    package: 'com.roasteryclub.app',
    versionCode: 1,
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#ffffff',
    },
    edgeToEdgeEnabled: true,
  },

  web: {
    favicon: './assets/favicon.png',
  },

  updates: { enabled: true },
  runtimeVersion: { policy: 'sdkVersion' },

  plugins: [
    'expo-router',
    'expo-apple-authentication',
    ...(googleSigninPlugin ? [googleSigninPlugin] : []),
  ],

  experiments: { typedRoutes: true },

  extra: {
    eas: { projectId: '713b0b59-4130-4d31-9674-52eb86e2a04f' },
  },
};

export default config;
