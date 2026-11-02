import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import { useState, type ReactNode } from 'react';
import superjson from 'superjson';
import { PushBootstrap } from '@/components/PushBootstrap';
import { authStore } from '@/lib/auth-store';
import { refreshSession } from '@/lib/session';
import { trpc, trpcUrl } from '@/lib/trpc';
import { AuthContextProvider } from './auth-context';
import { CartProvider } from './cart-context';

/** Bearer başlığı ekler; 401'de bir kez refresh dener ve isteği tekrarlar. */
const authedFetch: typeof fetch = async (input, init) => {
  const build = (): RequestInit => {
    const headers = new Headers(init?.headers);
    const session = authStore.get();
    if (session) headers.set('authorization', `Bearer ${session.accessToken}`);
    return { ...init, headers };
  };
  let res = await fetch(input, build());
  if (res.status === 401 && (await refreshSession())) {
    res = await fetch(input, build());
  }
  return res;
};

export function Providers({ children }: { children: ReactNode }): ReactNode {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 15_000, retry: 1 } },
      }),
  );
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [httpBatchLink({ url: trpcUrl(), transformer: superjson, fetch: authedFetch })],
    }),
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <AuthContextProvider>
          <CartProvider>
            <PushBootstrap />
            {children}
          </CartProvider>
        </AuthContextProvider>
      </QueryClientProvider>
    </trpc.Provider>
  );
}
