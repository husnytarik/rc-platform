import { canAny, type Capability, type Role } from '@rc/shared';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { authStore, type StoredSession } from '@/lib/auth-store';
import { identityCache, type Identity } from '@/lib/identity';
import { endSession } from '@/lib/session';
import { trpc } from '@/lib/trpc';

type Status = 'loading' | 'authenticated' | 'anonymous';

interface AuthContextValue {
  status: Status;
  identity: Identity | null;
  can: (cap: Capability) => boolean;
  login: (session: StoredSession) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthContextProvider({ children }: { children: ReactNode }): ReactNode {
  // SecureStore async'tir — açılışta bir kez hydrate edilmeden jeton var/yok bilinmez.
  const [hydrated, setHydrated] = useState(false);
  const [hasToken, setHasToken] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void authStore.hydrate().then((session) => {
      if (cancelled) return;
      setHasToken(session !== null);
      setHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const meQuery = trpc.auth.me.useQuery(undefined, {
    enabled: hydrated && hasToken,
    retry: false,
    staleTime: 60_000,
  });

  const identity: Identity | null = useMemo(() => {
    if (!meQuery.data) return null;
    const value: Identity = {
      id: meQuery.data.id,
      phone: meQuery.data.phone,
      fullName: meQuery.data.fullName,
      roles: meQuery.data.roles as Role[],
      memberships: meQuery.data.memberships as Identity['memberships'],
      pending: meQuery.data.memberships.length === 0,
    };
    identityCache.set(value);
    return value;
  }, [meQuery.data]);

  const status: Status = !hydrated
    ? 'loading'
    : !hasToken
      ? 'anonymous'
      : meQuery.isLoading
        ? 'loading'
        : identity
          ? 'authenticated'
          : 'anonymous';

  // Jeton var ama /me başarısız (refresh de tükendi) → oturumu bırak.
  useEffect(() => {
    if (hydrated && hasToken && meQuery.isError && !meQuery.isLoading) {
      void authStore.clear();
      identityCache.clear();
      setHasToken(false);
    }
  }, [hydrated, hasToken, meQuery.isError, meQuery.isLoading]);

  const utils = trpc.useUtils();

  const login = useCallback(
    async (session: StoredSession) => {
      await authStore.set(session);
      identityCache.clear();
      setHasToken(true);
      await utils.auth.me.invalidate();
    },
    [utils],
  );

  const logout = useCallback(() => {
    void endSession();
    identityCache.clear();
    setHasToken(false);
    utils.auth.me.reset();
  }, [utils]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      identity,
      can: (cap) => canAny(identity?.roles ?? [], cap),
      login,
      logout,
    }),
    [status, identity, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth <AuthContextProvider> içinde kullanılmalı');
  return ctx;
}
