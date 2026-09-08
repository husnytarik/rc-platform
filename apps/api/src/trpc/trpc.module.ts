import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TrpcService } from './trpc.service';

/** PrismaModule global; AuthModule `AuthService` + `TokenService` export eder. */
@Module({
  imports: [AuthModule],
  providers: [TrpcService],
  exports: [TrpcService],
})
export class TrpcModule {}
