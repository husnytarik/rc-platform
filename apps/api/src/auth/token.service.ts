import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import type { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';

export interface AccessClaims {
  sub: string; // userId
  jti: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
}

interface DeviceCtx {
  deviceId?: string;
  userAgent?: string;
  ip?: string;
}

const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');

@Injectable()
export class TokenService {
  private readonly accessSecret: Uint8Array;
  private readonly refreshTtlMs: number;
  private readonly accessTtl: string;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService<Env, true>,
  ) {
    this.accessSecret = new TextEncoder().encode(config.get('JWT_ACCESS_SECRET', { infer: true }));
    this.accessTtl = config.get('JWT_ACCESS_TTL', { infer: true });
    this.refreshTtlMs =
      config.get('JWT_REFRESH_TTL_DAYS', { infer: true }) * 24 * 60 * 60 * 1000;
  }

  private async signAccess(userId: string): Promise<string> {
    return new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(userId)
      .setJti(randomUUID())
      .setIssuedAt()
      .setExpirationTime(this.accessTtl)
      .sign(this.accessSecret);
  }

  async verifyAccess(token: string): Promise<AccessClaims> {
    try {
      const { payload } = await jwtVerify(token, this.accessSecret);
      return { sub: payload.sub as string, jti: payload.jti as string };
    } catch {
      throw new UnauthorizedException('Oturum geçersiz veya süresi dolmuş.');
    }
  }

  /** Yeni oturum: access + refresh (yeni rotation ailesi). */
  async issuePair(userId: string, ctx: DeviceCtx): Promise<TokenPair> {
    const familyId = randomUUID();
    return this.mintRefresh(userId, familyId, ctx);
  }

  /** Refresh rotation: eski token iptal, aynı aileden yenisi. Yeniden kullanım = aile iptali. */
  async rotate(rawRefresh: string, ctx: DeviceCtx): Promise<TokenPair> {
    const tokenHash = sha256(rawRefresh);
    const existing = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });

    if (!existing || existing.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Oturum süresi dolmuş, tekrar giriş yapın.');
    }
    if (existing.revokedAt) {
      // Çalınmış olabilir — tüm aileyi iptal et
      await this.prisma.refreshToken.updateMany({
        where: { familyId: existing.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Oturum güvenliği nedeniyle sonlandırıldı, tekrar giriş yapın.');
    }

    const next = await this.mintRefresh(existing.userId, existing.familyId, ctx);
    await this.prisma.refreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date() },
    });
    return next;
  }

  async revoke(rawRefresh: string): Promise<void> {
    const tokenHash = sha256(rawRefresh);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async mintRefresh(userId: string, familyId: string, ctx: DeviceCtx): Promise<TokenPair> {
    const raw = randomBytes(48).toString('base64url');
    const expiresAt = new Date(Date.now() + this.refreshTtlMs);
    await this.prisma.refreshToken.create({
      data: {
        userId,
        familyId,
        tokenHash: sha256(raw),
        deviceId: ctx.deviceId,
        userAgent: ctx.userAgent,
        ip: ctx.ip,
        expiresAt,
      },
    });
    return {
      accessToken: await this.signAccess(userId),
      refreshToken: raw,
      refreshExpiresAt: expiresAt,
    };
  }
}
