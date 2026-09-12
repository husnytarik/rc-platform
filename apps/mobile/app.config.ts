import type { ExpoConfig } from 'expo/config';

/**
 * RoasteryClub mobil — tek uygulama, tüm roller (müşteri/admin/personel),
 * telefon+OTP girişi. Aynı Apple/EAS kimliği (bundle id, projectId) eski
 * Firebase tabanlı uygulamayla paylaşılır — bu onun yeniden yazımı, App Store
 * Connect'teki kayıt aynı kalır.
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
    bundleIdentifier: 'com.husnytarik.roasteryclub',
    supportsTablet: true,
    buildNumber: '1',
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
  },

  android: {
    package: 'com.husnytarik.roasteryclub',
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

  plugins: ['expo-router'],

  experiments: { typedRoutes: true },

  extra: {
    // Eski uygulamayla aynı EAS projesi — TestFlight kaydı bu yüzden değişmiyor.
    eas: { projectId: '713b0b59-4130-4d31-9674-52eb86e2a04f' },
  },
};

export default config;
