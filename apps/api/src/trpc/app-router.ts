import type { AuthService } from '../auth/auth.service';
import type { CatalogService } from '../catalog/catalog.service';
import { makeAuthRouter } from './routers/auth.router';
import { makeCatalogRouter } from './routers/catalog.router';
import { router } from './trpc';

interface RouterDeps {
  auth: AuthService;
  catalog: CatalogService;
}

/**
 * Kök router. Alt router'lar Nest servislerini fabrika üzerinden alır
 * (DI ile `TrpcService` içinde bağlanır).
 */
export function makeAppRouter(deps: RouterDeps) {
  return router({
    auth: makeAuthRouter(deps.auth),
    catalog: makeCatalogRouter(deps.catalog),
  });
}

/** İstemci (admin paneli, mobil) bu tipi import eder — uçtan uca tip güvenliği. */
export type AppRouter = ReturnType<typeof makeAppRouter>;
