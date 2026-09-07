import { BadRequestException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { randomInt } from 'node:crypto';
import type { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { SmsService } from './sms.service';
import type { OtpPurpose } from '@prisma/client';

interface RequestCtx {
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class OtpService {
  private tooMany(msg: string): never {
    throw new HttpException(msg, HttpStatus.TOO_MANY_REQUESTS);
  }

  constructor(
    private readonly prisma: PrismaService,
    private readonly sms: SmsService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  private genCode(): string {
    return randomInt(0, 1_000_000).toString().padStart(6, '0');
  }

  /** OTP üret + SMS gönder. Rate limit ve cooldown burada uygulanır. */
  async request(phone: string, purpose: OtpPurpose, ctx: RequestCtx): Promise<{ expiresInSec: number }> {
    const ttl = this.config.get('OTP_TTL_SECONDS', { infer: true });
    const cooldown = this.config.get('OTP_RESEND_COOLDOWN_SECONDS', { infer: true });
    const perHour = this.config.get('OTP_RATE_LIMIT_PER_HOUR', { infer: true });
    const maxAttempts = this.config.get('OTP_MAX_ATTEMPTS', { infer: true });

    const now = Date.now();
    const hourAgo = new Date(now - 3_600_000);

    const recent = await this.prisma.otpChallenge.findMany({
      where: { phone, createdAt: { gte: hourAgo } },
      orderBy: { createdAt: 'desc' },
    });

    if (recent.length >= perHour) {
      this.tooMany('Çok fazla kod isteği. Bir süre sonra tekrar deneyin.');
    }
    if (recent[0] && now - recent[0].createdAt.getTime() < cooldown * 1000) {
      this.tooMany('Yeni kod istemek için biraz bekleyin.');
    }

    const code = this.genCode();
    const codeHash = await argon2.hash(code);

    const user = await this.prisma.user.findUnique({ where: { phone }, select: { id: true } });

    await this.prisma.otpChallenge.create({
      data: {
        phone,
        userId: user?.id ?? null,
        purpose,
        codeHash,
        maxAttempts,
        expiresAt: new Date(now + ttl * 1000),
        requestIp: ctx.ip,
        userAgent: ctx.userAgent,
      },
    });

    await this.sms.sendOtp(phone, code);
    return { expiresInSec: ttl };
  }

  /**
   * Kod doğrula. Başarılıysa challenge "verified" olur ve userId (varsa) döner.
   * Yanlış kod attempts++ ; limit dolunca challenge "failed".
   */
  async verify(phone: string, code: string): Promise<{ userId: string | null }> {
    const challenge = await this.prisma.otpChallenge.findFirst({
      where: { phone, status: 'pending' },
      orderBy: { createdAt: 'desc' },
    });

    if (!challenge) throw new BadRequestException('Geçerli bir kod bulunamadı, yeni kod isteyin.');

    if (challenge.expiresAt.getTime() < Date.now()) {
      await this.prisma.otpChallenge.update({
        where: { id: challenge.id },
        data: { status: 'expired' },
      });
      throw new BadRequestException('Kodun süresi doldu, yeni kod isteyin.');
    }

    const ok = await argon2.verify(challenge.codeHash, code);
    if (!ok) {
      const attempts = challenge.attempts + 1;
      const failed = attempts >= challenge.maxAttempts;
      await this.prisma.otpChallenge.update({
        where: { id: challenge.id },
        data: { attempts, status: failed ? 'failed' : 'pending' },
      });
      throw new BadRequestException(
        failed ? 'Çok fazla yanlış deneme, yeni kod isteyin.' : 'Kod hatalı.',
      );
    }

    await this.prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { status: 'verified', consumedAt: new Date() },
    });

    return { userId: challenge.userId };
  }
}
