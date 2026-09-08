import { Body, Controller, Post, Req } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { AuthService } from './auth.service';
import { refreshSchema, requestOtpSchema, verifyOtpSchema } from './auth.schemas';

function ctxOf(req: FastifyRequest) {
  return {
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    deviceId: (req.headers['x-device-id'] as string | undefined) ?? undefined,
  };
}

/**
 * Geçici REST yüzeyi. tRPC router bağlandığında bu uçlar tRPC procedure'larına taşınır;
 * sözleşme (zod şemaları) aynı kalır.
 */
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('otp/request')
  async requestOtp(@Body() body: unknown, @Req() req: FastifyRequest) {
    const { phone, purpose } = requestOtpSchema.parse(body);
    return this.auth.requestOtp(phone, purpose, ctxOf(req));
  }

  @Post('otp/verify')
  async verifyOtp(@Body() body: unknown, @Req() req: FastifyRequest) {
    const { phone, code, register } = verifyOtpSchema.parse(body);
    return this.auth.verifyOtp(phone, code, ctxOf(req), register);
  }

  @Post('refresh')
  async refresh(@Body() body: unknown, @Req() req: FastifyRequest) {
    const { refreshToken } = refreshSchema.parse(body);
    return this.auth.refresh(refreshToken, ctxOf(req));
  }

  @Post('logout')
  async logout(@Body() body: unknown) {
    const { refreshToken } = refreshSchema.parse(body);
    await this.auth.logout(refreshToken);
    return { ok: true };
  }
}
