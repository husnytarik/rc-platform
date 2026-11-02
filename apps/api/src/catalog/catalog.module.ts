import { Module } from '@nestjs/common';
import { CatalogSheetService } from './catalog-sheet.service';
import { CatalogService } from './catalog.service';
import { PriceService } from './price.service';
import { StockService } from './stock.service';
import { VisibilityService } from './visibility.service';

/** PrismaModule global; katalog servisleri fiyat + görünürlük + stoğu birleştirir. */
@Module({
  providers: [CatalogService, CatalogSheetService, PriceService, StockService, VisibilityService],
  exports: [CatalogService, CatalogSheetService, PriceService, StockService, VisibilityService],
})
export class CatalogModule {}
