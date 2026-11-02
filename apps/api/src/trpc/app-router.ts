import type { AuthService } from '../auth/auth.service';
import type { CatalogSheetService } from '../catalog/catalog-sheet.service';
import type { CatalogService } from '../catalog/catalog.service';
import type { StockService } from '../catalog/stock.service';
import type { AnnouncementService } from '../engage/announcement.service';
import type { NotificationService } from '../engage/notification.service';
import type { ReportService } from '../report/report.service';
import type { TicketService } from '../engage/ticket.service';
import type { CustomerService } from '../customer/customer.service';
import type { MembershipService } from '../membership/membership.service';
import type { OrderService } from '../orders/order.service';
import type { ServicesService } from '../services/services.service';
import { makeAuthRouter } from './routers/auth.router';
import { makeAnnouncementRouter } from './routers/announcement.router';
import { makeNotificationRouter } from './routers/notification.router';
import { makeReportRouter } from './routers/report.router';
import { makeSheetRouter } from './routers/sheet.router';
import { makeTicketRouter } from './routers/ticket.router';
import { makeCatalogRouter } from './routers/catalog.router';
import { makeCustomerRouter } from './routers/customer.router';
import { makeMembershipRouter } from './routers/membership.router';
import { makeOrderRouter } from './routers/order.router';
import { makeServiceRouter } from './routers/service.router';
import { makeStockRouter } from './routers/stock.router';
import { router } from './trpc';

interface RouterDeps {
  auth: AuthService;
  catalog: CatalogService;
  customer: CustomerService;
  membership: MembershipService;
  orders: OrderService;
  services: ServicesService;
  stock: StockService;
  announcements: AnnouncementService;
  tickets: TicketService;
  notifications: NotificationService;
  reports: ReportService;
  sheet: CatalogSheetService;
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
    service: makeServiceRouter(deps.services),
    stock: makeStockRouter(deps.stock),
    announcement: makeAnnouncementRouter(deps.announcements),
    ticket: makeTicketRouter(deps.tickets),
    notification: makeNotificationRouter(deps.notifications),
    report: makeReportRouter(deps.reports),
    sheet: makeSheetRouter(deps.sheet),
  });
}

/** İstemci (admin paneli, mobil) bu tipi import eder — uçtan uca tip güvenliği. */
export type AppRouter = ReturnType<typeof makeAppRouter>;
