import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { OrderService } from './order.service';

/** PrismaModule global; CatalogModule PriceService + VisibilityService verir. */
@Module({
  imports: [CatalogModule],
  providers: [OrderService],
  exports: [OrderService],
})
export class OrderModule {}
