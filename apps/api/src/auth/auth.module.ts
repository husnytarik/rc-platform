import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SmsService } from './sms.service';
import { TokenService } from './token.service';

@Module({
  providers: [AuthService, SmsService, TokenService],
  exports: [AuthService, TokenService],
})
export class AuthModule {}
