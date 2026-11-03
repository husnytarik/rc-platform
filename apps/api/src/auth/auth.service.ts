import { createHash, timingSafeEqual } from 'node:crypto';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
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

const sha = (s: string): Buffer => createHash('sha256').update(s).digest();

/** Demo girişi deneme sınırı: IP başına 15 dakikada 8 yanlış deneme. */
const DEMO_WINDOW_MS = 15 * 60 * 1000;
const DEMO_MAX_FAILS = 8;

@Injectable()
export class AuthService {
  private readonly demoFails = new Map<string, { n: number; since: number }>();

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

  /**
   * Gizli kodla demo girişi (App Store incelemesi ve test için). Yalnızca Render'da
   * DEMO_ADMIN_CODE / DEMO_CUSTOMER_CODE tanımlıysa açıktır; tanımsızsa uç nokta yok sayılır.
   * Kod ortam değişkenindedir, repoda değil.
   */
  async demoLogin(code: string, ctx: Ctx): Promise<SessionResult> {
    const adminCode = process.env.DEMO_ADMIN_CODE;
    const customerCode = process.env.DEMO_CUSTOMER_CODE;
    if (!adminCode && !customerCode) throw new NotFoundException('Demo giriş kapalı.');

    const key = ctx.ip ?? 'unknown';
    const now = Date.now();
    const f = this.demoFails.get(key);
    if (f && now - f.since < DEMO_WINDOW_MS && f.n >= DEMO_MAX_FAILS) {
      throw new BadRequestException('Çok fazla deneme. Biraz sonra tekrar deneyin.');
    }

    const matches = (expected?: string): boolean =>
      !!expected && timingSafeEqual(sha(code), sha(expected));
    const kind = matches(adminCode) ? 'admin' : matches(customerCode) ? 'customer' : null;
    if (!kind) {
      const fresh = !f || now - f.since >= DEMO_WINDOW_MS;
      this.demoFails.set(key, { n: fresh ? 1 : f.n + 1, since: fresh ? now : f.since });
      throw new BadRequestException('Demo kodu hatalı.');
    }
    this.demoFails.delete(key);

    const user = await this.prisma.user.upsert({
      where: {
        provider_providerUserId: { provider: 'google', providerUserId: `demo-${kind}` },
      },
      update: { lastLoginAt: new Date() },
      create: {
        provider: 'google',
        providerUserId: `demo-${kind}`,
        fullName: kind === 'admin' ? 'Demo Yönetici' : 'Demo Müşteri',
        lastLoginAt: new Date(),
      },
    });

    const org =
      kind === 'admin'
        ? await this.prisma.organization.findUnique({ where: { slug: 'roasteryclub' } })
        : await this.prisma.organization.upsert({
            where: { slug: 'demo-kafe' },
            update: {},
            create: { type: 'customer', name: 'Demo Kafe', slug: 'demo-kafe' },
          });
    if (!org) throw new BadRequestException('Demo hesabı için kurum bulunamadı.');

    const role = kind === 'admin' ? 'producer_admin' : 'customer_admin';
    await this.prisma.membership.upsert({
      where: { userId_orgId_role: { userId: user.id, orgId: org.id, role } },
      update: { status: 'active' },
      create: { userId: user.id, orgId: org.id, role, status: 'active' },
    });

    const pair = await this.tokens.issuePair(user.id, ctx);
    return {
      accessToken: pair.accessToken,
      refreshToken: pair.refreshToken,
      refreshExpiresAt: pair.refreshExpiresAt.toISOString(),
      state: 'active',
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
      // users.phone benzersiz. Numara başka bir hesapta kayıtlıysa (örn. aynı kişinin
      // farklı bir girişi) başvuruyu yine kabul ederiz: numara başvuruda duruyor ve
      // yönetici telefonla doğrularken çakışmayı görür.
      const owner = await tx.user.findUnique({ where: { phone: e164 }, select: { id: true } });
      if (!owner || owner.id === userId) {
        await tx.user.update({ where: { id: userId }, data: { phone: e164 } });
      }
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
      await tx.outboxEvent.create({
        data: {
          topic: 'membership.requested',
          payload: { userId, orgName: register.orgName },
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
