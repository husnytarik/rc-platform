import { Injectable } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { TokenService } from '../auth/token.service';
import { CatalogSheetService } from '../catalog/catalog-sheet.service';
import { CatalogService } from '../catalog/catalog.service';
import { StockService } from '../catalog/stock.service';
import { CustomerService } from '../customer/customer.service';
import { AnnouncementService } from '../engage/announcement.service';
import { NotificationService } from '../engage/notification.service';
import { TicketService } from '../engage/ticket.service';
import { MembershipService } from '../membership/membership.service';
import { OrderService } from '../orders/order.service';
import { ReportService } from '../report/report.service';
import { PrismaService } from '../prisma/prisma.service';
import { ServicesService } from '../services/services.service';
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
    services: ServicesService,
    stock: StockService,
    announcements: AnnouncementService,
    tickets: TicketService,
    notifications: NotificationService,
    reports: ReportService,
    sheet: CatalogSheetService,
  ) {
    this.appRouter = makeAppRouter({
      auth,
      catalog,
      customer,
      membership,
      orders,
      services,
      stock,
      announcements,
      tickets,
      notifications,
      reports,
      sheet,
    });
    this.createContext = makeCreateContext({ tokens, prisma });
  }
}
