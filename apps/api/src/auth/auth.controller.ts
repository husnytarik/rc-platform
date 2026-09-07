import { Body, Controller, Post, Req } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { z } from 'zod';
import { AuthService } from './auth.service';

const phoneField = z.string().min(7).max(20);

const requestSchema = z.object({
  phone: phoneField,
  purpose: z.enum(['login', 'register', 'add_device']).default('login'),
});

const registerSchema = z.object({
  fullName: z.string().min(2),
  orgName: z.string().min(2),
  taxId: z.string().optional(),
  address: z.string().optional(),
  branches: z
    .array(
      z.object({
        name: z.string().min(1),
        address: z.string().optional(),
        phone: z.string().optional(),
      }),
    )
    .optional(),
  note: z.string().optional(),
});

const verifySchema = z.object({
  phone: phoneField,
  code: z.string().length(6),
  register: registerSchema.optional(),
});

const refreshSchema = z.object({ refreshToken: z.string().min(20) });

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
    const { phone, purpose } = requestSchema.parse(body);
    return this.auth.requestOtp(phone, purpose, ctxOf(req));
  }

  @Post('otp/verify')
  async verifyOtp(@Body() body: unknown, @Req() req: FastifyRequest) {
    const { phone, code, register } = verifySchema.parse(body);
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
