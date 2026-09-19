import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { OauthService } from './oauth.service';
import { TokenService } from './token.service';

@Module({
  providers: [AuthService, OauthService, TokenService],
  exports: [AuthService, TokenService],
})
export class AuthModule {}
