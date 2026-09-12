import type { AppRouter } from '@rc/api/app-router';
import { createTRPCClient, httpLink } from '@trpc/client';
import superjson from 'superjson';
import { authStore } from './auth-store';
import { trpcUrl } from './trpc';

/**
 * React dışı çağrılar için sade istemci (login / refresh / logout).
 * Batch yok — tek uç, tek istek; yeniden-deneme mantığı taşımaz.
 */
export const vanillaTrpc = createTRPCClient<AppRouter>({
  links: [
    httpLink({
      url: trpcUrl(),
      transformer: superjson,
      headers() {
        const s = authStore.get();
        return s ? { authorization: `Bearer ${s.accessToken}` } : {};
      },
    }),
  ],
});
