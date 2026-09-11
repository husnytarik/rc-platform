import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CatalogModule } from '../catalog/catalog.module';
import { CustomerModule } from '../customer/customer.module';
import { MembershipModule } from '../membership/membership.module';
import { OrderModule } from '../orders/order.module';
import { TrpcService } from './trpc.service';

/**
 * PrismaModule global; AuthModule `AuthService` + `TokenService`, CatalogModule
 * `CatalogService`, OrderModule `OrderService` export eder.
 */
@Module({
  imports: [AuthModule, CatalogModule, CustomerModule, MembershipModule, OrderModule],
  providers: [TrpcService],
  exports: [TrpcService],
})
export class TrpcModule {}
