import * as SecureStore from 'expo-secure-store';

/**
 * Oturum jetonlarının cihazda saklanması (Keychain/Keystore, expo-secure-store
 * üzerinden). Admin panelindeki `auth-store.ts` ile aynı arayüz — React
 * dışından da (tRPC link, session helper) erişilir; bu yüzden modül seviyesi
 * bellek önbelleği + senkron `get()` gerekiyor. SecureStore async olduğu için
 * uygulama açılışında bir kez `hydrate()` ile önbellek doldurulur.
 */

const ACCESS_KEY = 'rc.mobile.access';
const REFRESH_KEY = 'rc.mobile.refresh';

export interface StoredSession {
  accessToken: string;
  refreshToken: string;
}

let memo: StoredSession | null | undefined; // undefined = henüz hydrate edilmedi

export const authStore = {
  /** Açılışta bir kez çağrılır — SecureStore'dan belleğe okur. */
  async hydrate(): Promise<StoredSession | null> {
    try {
      const [accessToken, refreshToken] = await Promise.all([
        SecureStore.getItemAsync(ACCESS_KEY),
        SecureStore.getItemAsync(REFRESH_KEY),
      ]);
      memo = accessToken && refreshToken ? { accessToken, refreshToken } : null;
    } catch {
      memo = null;
    }
    return memo;
  },
  /** Senkron okuma — yalnızca hydrate() sonrası güvenilir. */
  get(): StoredSession | null {
    return memo ?? null;
  },
  async set(session: StoredSession): Promise<void> {
    memo = session;
    await Promise.all([
      SecureStore.setItemAsync(ACCESS_KEY, session.accessToken),
      SecureStore.setItemAsync(REFRESH_KEY, session.refreshToken),
    ]);
  },
  async clear(): Promise<void> {
    memo = null;
    await Promise.all([
      SecureStore.deleteItemAsync(ACCESS_KEY),
      SecureStore.deleteItemAsync(REFRESH_KEY),
    ]);
  },
};
