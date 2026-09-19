import { BadRequestException, Injectable } from '@nestjs/common';
import { toE164TR } from '@rc/shared';
import type { AuthProvider } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OauthService } from './oauth.service';
import { TokenService } from './token.service';

interface Ctx {
  ip?: string;
  userAgent?: string;
  deviceId?: string;
}

export interface MembershipRequestInfo {
  phone: string;
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
  user: { id: string; phone: string | null; fullName: string | null };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly oauth: OauthService,
    private readonly tokens: TokenService,
  ) {}

  async oauthLogin(
    provider: AuthProvider,
    idToken: string,
    ctx: Ctx,
    fullName?: string,
  ): Promise<SessionResult> {
    const profile = await this.oauth.verify(provider, idToken);

    let user = await this.prisma.user.findUnique({
      where: { provider_providerUserId: { provider, providerUserId: profile.providerUserId } },
      include: { memberships: { where: { status: 'active' } } },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          provider,
          providerUserId: profile.providerUserId,
          email: profile.email,
          fullName: fullName ?? profile.fullName,
        },
        include: { memberships: true },
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

  /** Google/Apple ile ilk girişten sonra, üyelik bekleyen kullanıcının doldurduğu kayıt formu. */
  async submitMembershipRequest(
    userId: string,
    register: MembershipRequestInfo,
    ctx: Ctx,
  ): Promise<{ ok: true }> {
    const e164 = toE164TR(register.phone);
    if (!e164) throw new BadRequestException('Geçerli bir Türkiye cep telefonu girin.');

    const existing = await this.prisma.membershipRequest.findFirst({
      where: { userId, status: 'pending' },
    });
    if (existing) throw new BadRequestException('Zaten bekleyen bir başvurunuz var.');

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { phone: e164 } });
      await tx.membershipRequest.create({
        data: {
          userId,
          phone: e164,
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
          actorId: userId,
          action: 'membership_request.create',
          entityType: 'membership_request',
          after: { orgName: register.orgName },
          ip: ctx.ip,
          userAgent: ctx.userAgent,
        },
      });
    });

    return { ok: true };
  }

  /** Onay bekleyen kullanıcı için: kayıt formu zaten dolduruldu mu? */
  async hasPendingMembershipRequest(userId: string): Promise<boolean> {
    const req = await this.prisma.membershipRequest.findFirst({
      where: { userId, status: 'pending' },
      select: { id: true },
    });
    return req !== null;
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
