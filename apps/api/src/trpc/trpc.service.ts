import { Injectable } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { TokenService } from '../auth/token.service';
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

  constructor(auth: AuthService, tokens: TokenService, prisma: PrismaService) {
    this.appRouter = makeAppRouter({ auth });
    this.createContext = makeCreateContext({ tokens, prisma });
  }
}
