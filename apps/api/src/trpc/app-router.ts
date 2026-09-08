import type { AuthService } from '../auth/auth.service';
import { makeAuthRouter } from './routers/auth.router';
import { router } from './trpc';

interface RouterDeps {
  auth: AuthService;
}

/**
 * Kök router. Alt router'lar Nest servislerini fabrika üzerinden alır
 * (DI ile `TrpcService` içinde bağlanır).
 */
export function makeAppRouter(deps: RouterDeps) {
  return router({
    auth: makeAuthRouter(deps.auth),
  });
}

/** İstemci (admin paneli, mobil) bu tipi import eder — uçtan uca tip güvenliği. */
export type AppRouter = ReturnType<typeof makeAppRouter>;
