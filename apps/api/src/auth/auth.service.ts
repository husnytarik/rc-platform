import { BadRequestException, Injectable } from '@nestjs/common';
import { toE164TR } from '@rc/shared';
import type { OtpPurpose } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OtpService } from './otp.service';
import { TokenService } from './token.service';

interface Ctx {
  ip?: string;
  userAgent?: string;
  deviceId?: string;
}

export interface RegisterInfo {
  fullName: string;
  orgName: string;
  taxId?: string;
  address?: string;
  branches?: { name: string; address?: string; phone?: string }[];
  note?: string;
}

export interface SessionResult {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: string;
  /** active = tam erişim; pending = başvuru onay bekliyor (kısıtlı ekran) */
  state: 'active' | 'pending';
  user: { id: string; phone: string; fullName: string | null };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly otp: OtpService,
    private readonly tokens: TokenService,
  ) {}

  private normPhone(input: string): string {
    const e164 = toE164TR(input);
    if (!e164) throw new BadRequestException('Geçerli bir Türkiye cep telefonu girin.');
    return e164;
  }

  async requestOtp(rawPhone: string, purpose: OtpPurpose, ctx: Ctx) {
    const phone = this.normPhone(rawPhone);
    return this.otp.request(phone, purpose, ctx);
  }

  async verifyOtp(
    rawPhone: string,
    code: string,
    ctx: Ctx,
    register?: RegisterInfo,
  ): Promise<SessionResult> {
    const phone = this.normPhone(rawPhone);
    await this.otp.verify(phone, code);

    let user = await this.prisma.user.findUnique({
      where: { phone },
      include: { memberships: { where: { status: 'active' } } },
    });

    if (!user) {
      if (!register) {
        // Kayıt bilgisi olmadan yeni numara — istemci kayıt formunu göstermeli
        throw new BadRequestException('KAYIT_GEREKLI');
      }
      user = await this.prisma.$transaction(async (tx) => {
        const u = await tx.user.create({
          data: { phone, fullName: register.fullName },
          include: { memberships: true },
        });
        await tx.membershipRequest.create({
          data: {
            userId: u.id,
            phone,
            requestedOrgName: register.orgName,
            requestedRole: 'customer_admin',
            note: register.note,
            payload: {
              taxId: register.taxId,
              address: register.address,
              branches: register.branches ?? [],
            },
          },
        });
        await tx.activityLog.create({
          data: {
            actorId: u.id,
            action: 'membership_request.create',
            entityType: 'membership_request',
            after: { orgName: register.orgName },
            ip: ctx.ip,
            userAgent: ctx.userAgent,
          },
        });
        return u;
      });
    }

    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    const pair = await this.tokens.issuePair(user.id, ctx);
    const state: 'active' | 'pending' = user.memberships.length > 0 ? 'active' : 'pending';

    return {
      accessToken: pair.accessToken,
      refreshToken: pair.refreshToken,
      refreshExpiresAt: pair.refreshExpiresAt.toISOString(),
      state,
      user: { id: user.id, phone: user.phone, fullName: user.fullName },
    };
  }

  async refresh(rawRefresh: string, ctx: Ctx) {
    const pair = await this.tokens.rotate(rawRefresh, ctx);
    return {
      accessToken: pair.accessToken,
      refreshToken: pair.refreshToken,
      refreshExpiresAt: pair.refreshExpiresAt.toISOString(),
    };
  }

  async logout(rawRefresh: string): Promise<void> {
    await this.tokens.revoke(rawRefresh);
  }
}
