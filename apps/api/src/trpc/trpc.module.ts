import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CatalogModule } from '../catalog/catalog.module';
import { TrpcService } from './trpc.service';

/**
 * PrismaModule global; AuthModule `AuthService` + `TokenService`, CatalogModule
 * `CatalogService` export eder.
 */
@Module({
  imports: [AuthModule, CatalogModule],
  providers: [TrpcService],
  exports: [TrpcService],
})
export class TrpcModule {}
