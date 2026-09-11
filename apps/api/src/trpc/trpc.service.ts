import { Injectable } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { TokenService } from '../auth/token.service';
import { CatalogService } from '../catalog/catalog.service';
import { CustomerService } from '../customer/customer.service';
import { MembershipService } from '../membership/membership.service';
import { OrderService } from '../orders/order.service';
import { PrismaService } from '../prisma/prisma.service';
import { makeAppRouter, type AppRouter } from './app-router';
import { makeCreateContext } from './trpc-context';

/**
 * tRPC router + context fabrikasını Nest DI ile bağlar. `main.ts` bunu alıp
 * Fastify eklentisine verir.
 */
@Injectable()
export class TrpcService {
  readonly appRouter: AppRouter;
  readonly createContext: ReturnType<typeof makeCreateContext>;

  constructor(
    auth: AuthService,
    tokens: TokenService,
    prisma: PrismaService,
    catalog: CatalogService,
    customer: CustomerService,
    membership: MembershipService,
    orders: OrderService,
  ) {
    this.appRouter = makeAppRouter({ auth, catalog, customer, membership, orders });
    this.createContext = makeCreateContext({ tokens, prisma });
  }
}
