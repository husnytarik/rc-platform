import type { AuthService } from '../auth/auth.service';
import type { CatalogService } from '../catalog/catalog.service';
import type { CustomerService } from '../customer/customer.service';
import type { MembershipService } from '../membership/membership.service';
import type { OrderService } from '../orders/order.service';
import { makeAuthRouter } from './routers/auth.router';
import { makeCatalogRouter } from './routers/catalog.router';
import { makeCustomerRouter } from './routers/customer.router';
import { makeMembershipRouter } from './routers/membership.router';
import { makeOrderRouter } from './routers/order.router';
import { router } from './trpc';

interface RouterDeps {
  auth: AuthService;
  catalog: CatalogService;
  customer: CustomerService;
  membership: MembershipService;
  orders: OrderService;
}

/**
 * Kök router. Alt router'lar Nest servislerini fabrika üzerinden alır
 * (DI ile `TrpcService` içinde bağlanır).
 */
export function makeAppRouter(deps: RouterDeps) {
  return router({
    auth: makeAuthRouter(deps.auth),
    catalog: makeCatalogRouter(deps.catalog),
    customer: makeCustomerRouter(deps.customer),
    membership: makeMembershipRouter(deps.membership),
    orders: makeOrderRouter(deps.orders),
  });
}

/** İstemci (admin paneli, mobil) bu tipi import eder — uçtan uca tip güvenliği. */
export type AppRouter = ReturnType<typeof makeAppRouter>;
