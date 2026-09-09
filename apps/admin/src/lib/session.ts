import { authStore } from './auth-store';
import { vanillaTrpc } from './trpc-vanilla';

/**
 * Tek uçuşta bir refresh: eşzamanlı 401'ler aynı sözü paylaşır, jeton döngüsü
 * bir kez döner. Başarısızsa oturum silinir (çağıran girişe yönlendirir).
 */
let inFlight: Promise<boolean> | null = null;

export function refreshSession(): Promise<boolean> {
  if (inFlight) return inFlight;
  const current = authStore.get();
  if (!current) return Promise.resolve(false);

  inFlight = vanillaTrpc.auth.refresh
    .mutate({ refreshToken: current.refreshToken })
    .then((pair) => {
      authStore.set({ accessToken: pair.accessToken, refreshToken: pair.refreshToken });
      return true;
    })
    .catch(() => {
      authStore.clear();
      return false;
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}

export async function endSession(): Promise<void> {
  const current = authStore.get();
  authStore.clear();
  if (!current) return;
  try {
    await vanillaTrpc.auth.logout.mutate({ refreshToken: current.refreshToken });
  } catch {
    /* jeton zaten geçersiz olabilir — sorun değil */
  }
}
