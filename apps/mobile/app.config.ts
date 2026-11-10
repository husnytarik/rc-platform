import type { ExpoConfig } from 'expo/config';

/**
 * RoasteryClub mobil — tek uygulama, tüm roller (müşteri/admin/personel).
 * Giriş: T.C. kimlik no + telefon + SMS kodu; yeni kullanıcılar firma bilgisiyle
 * başvurur, yönetici onaylar. Bundle id, App Store Connect'teki yayınlı "RoasteryClub"
 * kaydıyla (Apple ID 6752270952) eşleşecek şekilde ayarlandı — bu build oraya
 * güncelleme olarak gidiyor, yeni bir uygulama kaydı değil.
 */

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
    // CI'da GitHub çalıştırma numarası verilir (her build'de artar → "duplicate build" olmaz)
    buildNumber: process.env.IOS_BUILD_NUMBER ?? '3',
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
    bundler: 'metro',
    output: 'single',
  },

  updates: {
    enabled: true,
    url: 'https://u.expo.dev/713b0b59-4130-4d31-9674-52eb86e2a04f',
    fallbackToCacheTimeout: 0,
  },
  runtimeVersion: { policy: 'sdkVersion' },

  plugins: [
    'expo-router',
    'expo-notifications',
  ],

  // WEB_BASE_URL: GitHub Pages alt yolu (örn. /rc-platform). Yalnız web derlemesini etkiler.
  experiments: {
    typedRoutes: true,
    ...(process.env.WEB_BASE_URL ? { baseUrl: process.env.WEB_BASE_URL } : {}),
  },

  extra: {
    eas: { projectId: '713b0b59-4130-4d31-9674-52eb86e2a04f' },
  },
};

export default config;
