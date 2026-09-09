/**
 * Oturum jetonlarının tarayıcı tarafında saklanması. React dışından da
 * (authProvider, tRPC link) erişilir; bu yüzden basit modül seviyesi durum +
 * localStorage yansıması. SSR'de `window` yok — hepsi guard'lı.
 */

const ACCESS_KEY = 'rc.admin.access';
const REFRESH_KEY = 'rc.admin.refresh';

export interface StoredSession {
  accessToken: string;
  refreshToken: string;
}

let memo: StoredSession | null = null;

function readStorage(): StoredSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const accessToken = window.localStorage.getItem(ACCESS_KEY);
    const refreshToken = window.localStorage.getItem(REFRESH_KEY);
    if (!accessToken || !refreshToken) return null;
    return { accessToken, refreshToken };
  } catch {
    return null;
  }
}

export const authStore = {
  get(): StoredSession | null {
    if (memo) return memo;
    memo = readStorage();
    return memo;
  },
  set(session: StoredSession): void {
    memo = session;
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(ACCESS_KEY, session.accessToken);
      window.localStorage.setItem(REFRESH_KEY, session.refreshToken);
    } catch {
      /* kota / gizli sekme — bellek kopyası yeterli */
    }
  },
  clear(): void {
    memo = null;
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.removeItem(ACCESS_KEY);
      window.localStorage.removeItem(REFRESH_KEY);
    } catch {
      /* yoksay */
    }
  },
};
