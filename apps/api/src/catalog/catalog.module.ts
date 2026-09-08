import { Module } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { PriceService } from './price.service';
import { StockService } from './stock.service';
import { VisibilityService } from './visibility.service';

/** PrismaModule global; katalog servisleri fiyat + görünürlük + stoğu birleştirir. */
@Module({
  providers: [CatalogService, PriceService, StockService, VisibilityService],
  exports: [CatalogService, PriceService, StockService, VisibilityService],
})
export class CatalogModule {}
