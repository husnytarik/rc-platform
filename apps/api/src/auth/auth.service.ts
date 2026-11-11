import { createHash, createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isValidTcKimlik, normalizeTc, toE164TR } from '@rc/shared';
import type { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { SmsService } from './sms.service';
import { TokenService } from './token.service';

interface Ctx {
  ip?: string;
  userAgent?: string;
  deviceId?: string;
}

export interface MembershipRequestInfo {
  phone?: string;
  orgName: string;
  taxId?: string;
  address?: string;
  branches?: { name: string; address?: string; phone?: string }[];
  note?: string;
}

export interface RequestOtpResult {
  expiresInSec: number;
  /** SMS_MOCK modu: gerçek SMS gitmedi. */
  mock?: boolean;
  /** Mock modunda müşteri için kod (uygulama alana otomatik doldurur). Yönetici için yok. */
  devCode?: string;
  /** Mock modunda yönetici numarası: kod yerine yönetici şifresi istenir. */
  needsPassword?: boolean;
}

export interface SessionResult {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: string;
  /** active = tam erişim; pending = başvuru onay bekliyor (kısıtlı ekran) */
  state: 'active' | 'pending';
  user: { id: string; phone: string | null; fullName: string | null };
}

const tooMany = (msg: string): HttpException => new HttpException(msg, HttpStatus.TOO_MANY_REQUESTS);

const sha = (s: string): Buffer => createHash('sha256').update(s).digest();

/** Demo girişi deneme sınırı: IP başına 15 dakikada 8 yanlış deneme. */
const DEMO_WINDOW_MS = 15 * 60 * 1000;
const DEMO_MAX_FAILS = 8;

/** SMS kodu: 6 hane, 5 dk geçerli, kod başına en çok 5 yanlış deneme. */
const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
/** Aynı numaraya iki kod arası en az 60 sn; saatte en çok 5 kod. */
const OTP_COOLDOWN_MS = 60 * 1000;
const OTP_PER_PHONE_HOURLY = 5;
/** Aynı IP'den saatte en çok 20 kod isteği. */
const OTP_PER_IP_HOURLY = 20;
const HOUR_MS = 60 * 60 * 1000;
/** Günlük toplam SMS tavanı (kötüye kullanım/fatura koruması). Varsayılan 200. */
const DEFAULT_DAILY_CAP = 200;

@Injectable()
export class AuthService {
  private readonly demoFails = new Map<string, { n: number; since: number }>();
  private readonly ipRequests = new Map<string, { n: number; since: number }>();
  private readonly hmacKey: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly sms: SmsService,
    config: ConfigService<Env, true>,
  ) {
    // TC ve kod özetleri bu anahtarla HMAC'lenir. TC_HASH_SECRET tanımlıysa o, değilse refresh sırrı.
    // Dikkat: anahtar değişirse kayıtlı TC özetleri eşleşmez — rotasyondan önce planlayın.
    this.hmacKey =
      config.get('TC_HASH_SECRET', { infer: true }) ?? config.get('JWT_REFRESH_SECRET', { infer: true });
  }

  private h(scope: string, value: string): string {
    return createHmac('sha256', this.hmacKey).update(`${scope}:${value}`).digest('hex');
  }

  private safeEq(a: string, b: string): boolean {
    const ba = Buffer.from(a);
    const bb = Buffer.from(b);
    return ba.length === bb.length && timingSafeEqual(ba, bb);
  }

  private adminPhones(): string[] {
    return (process.env.ADMIN_PHONES ?? '')
      .split(',')
      .map((p) => toE164TR(p.trim()))
      .filter((p): p is string => p !== null);
  }

  private parseIdentity(tcRaw: string, phoneRaw: string): { tc: string; phone: string } {
    const tc = normalizeTc(tcRaw);
    if (!isValidTcKimlik(tc)) throw new BadRequestException('Geçerli bir T.C. kimlik numarası girin.');
    const phone = toE164TR(phoneRaw);
    if (!phone) throw new BadRequestException('Geçerli bir Türkiye cep telefonu girin.');
    return { tc, phone };
  }

  /**
   * 1. adım: TC + telefon girilir, telefona 6 haneli SMS kodu gider. Kod, oturumun "şifresidir".
   * SMS maliyeti ve kötüye kullanım için: IP/numara limitleri ve günlük toplam tavan uygulanır;
   * kayıtlı bir numara farklı bir TC ile denenirse SMS gönderilmez.
   */
  async requestOtp(tcRaw: string, phoneRaw: string, ctx: Ctx): Promise<RequestOtpResult> {
    const { tc, phone } = this.parseIdentity(tcRaw, phoneRaw);
    const tcHash = this.h('tc', tc);
    const now = Date.now();

    const ipKey = ctx.ip ?? 'unknown';
    const ipRec = this.ipRequests.get(ipKey);
    const freshIp = !ipRec || now - ipRec.since >= HOUR_MS;
    if (!freshIp && ipRec.n >= OTP_PER_IP_HOURLY) {
      throw tooMany('Çok fazla deneme. Biraz sonra tekrar deneyin.');
    }
    this.ipRequests.set(ipKey, { n: freshIp ? 1 : ipRec.n + 1, since: freshIp ? now : ipRec.since });

    const existing = await this.prisma.user.findUnique({
      where: { phone },
      select: { isActive: true, tcHash: true },
    });
    if (existing) {
      if (!existing.isActive) throw new ForbiddenException('Bu hesap devre dışı.');
      if (existing.tcHash && !this.safeEq(existing.tcHash, tcHash)) {
        throw new BadRequestException('Telefon ve T.C. kimlik numarası eşleşmiyor.');
      }
    }

    const hourAgo = new Date(now - HOUR_MS);
    const dayAgo = new Date(now - 24 * HOUR_MS);
    const recent = await this.prisma.otpCode.findMany({
      where: { phone, createdAt: { gte: hourAgo } },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    const last = recent[0];
    if (last && now - last.createdAt.getTime() < OTP_COOLDOWN_MS) {
      const wait = Math.ceil((OTP_COOLDOWN_MS - (now - last.createdAt.getTime())) / 1000);
      throw tooMany(`Yeni kod için ${wait} saniye bekleyin.`);
    }
    if (recent.length >= OTP_PER_PHONE_HOURLY) {
      throw tooMany('Bu numara için çok fazla kod istendi. Bir saat sonra deneyin.');
    }
    const cap = Number(process.env.OTP_DAILY_CAP) || DEFAULT_DAILY_CAP;
    if ((await this.prisma.otpCode.count({ where: { createdAt: { gte: dayAgo } } })) >= cap) {
      throw tooMany('Şu an kod gönderilemiyor. Lütfen daha sonra tekrar deneyin.');
    }

    // SMS sağlayıcısı yokken geçici mod (SMS_MOCK=true): SMS gitmez, müşteri kodu uygulamaya döner.
    // Yönetici numarası için kod yerine ADMIN_PASSWORD gerekir. Netgsm tanımlanınca otomatik kapanır.
    const mock = !this.sms.configured && process.env.SMS_MOCK === 'true';
    const isAdminPhone = this.adminPhones().includes(phone);
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (mock && isAdminPhone && !adminPassword) {
      throw new ForbiddenException('Yönetici girişi henüz yapılandırılmadı.');
    }
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const secret = mock && isAdminPhone ? adminPassword! : code;
    const row = await this.prisma.otpCode.create({
      data: {
        phone,
        tcHash,
        codeHash: this.h(`otp:${phone}`, secret),
        ip: ctx.ip,
        expiresAt: new Date(now + OTP_TTL_MS),
      },
      select: { id: true },
    });

    if (mock) {
      return isAdminPhone
        ? { expiresInSec: OTP_TTL_MS / 1000, mock: true, needsPassword: true }
        : { expiresInSec: OTP_TTL_MS / 1000, mock: true, devCode: code };
    }

    try {
      await this.sms.send(phone, `RoasteryClub giriş kodunuz: ${code}. Kimseyle paylaşmayın.`);
    } catch (e) {
      await this.prisma.otpCode.delete({ where: { id: row.id } }).catch(() => undefined);
      throw e;
    }
    return { expiresInSec: OTP_TTL_MS / 1000 };
  }

  /** 2. adım: SMS kodu doğrulanır; yeni numara ise kullanıcı oluşturulur (üyelik onayı bekler). */
  async verifyOtp(tcRaw: string, phoneRaw: string, code: string, ctx: Ctx): Promise<SessionResult> {
    const { tc, phone } = this.parseIdentity(tcRaw, phoneRaw);
    const tcHash = this.h('tc', tc);
    const invalid = new BadRequestException('Kod hatalı veya süresi dolmuş.');

    const otp = await this.prisma.otpCode.findFirst({
      where: { phone, consumedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!otp || otp.attempts >= OTP_MAX_ATTEMPTS) throw invalid;

    const ok =
      this.safeEq(otp.codeHash, this.h(`otp:${phone}`, code)) && this.safeEq(otp.tcHash, tcHash);
    if (!ok) {
      await this.prisma.otpCode.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
      throw invalid;
    }
    // Tek kullanımlık: eşzamanlı iki doğrulamadan yalnızca biri geçer.
    const claimed = await this.prisma.otpCode.updateMany({
      where: { id: otp.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    if (claimed.count !== 1) throw invalid;

    let user = await this.prisma.user.findUnique({ where: { phone } });
    if (user && !user.isActive) throw new ForbiddenException('Bu hesap devre dışı.');
    if (!user) {
      user = await this.prisma.user.create({
        data: { provider: 'phone', providerUserId: phone, phone, tcHash },
      });
    } else if (!user.tcHash) {
      // Eski (Google/Apple) hesap: numara SMS ile kanıtlandı, TC ilk girişte bağlanır.
      user = await this.prisma.user.update({ where: { id: user.id }, data: { tcHash } });
    }

    if (this.adminPhones().includes(phone)) await this.ensureProducerAdmin(user.id);

    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    const activeCount = await this.prisma.membership.count({
      where: { userId: user.id, status: 'active' },
    });

    const pair = await this.tokens.issuePair(user.id, ctx);
    return {
      accessToken: pair.accessToken,
      refreshToken: pair.refreshToken,
      refreshExpiresAt: pair.refreshExpiresAt.toISOString(),
      state: activeCount > 0 ? 'active' : 'pending',
      user: { id: user.id, phone: user.phone, fullName: user.fullName },
    };
  }

  /** ADMIN_PHONES'taki numara üretici org'unda yönetici olur (ilk yönetici için elle DB işi gerekmez). */
  private async ensureProducerAdmin(userId: string): Promise<void> {
    const org = await this.prisma.organization.findUnique({ where: { slug: 'roasteryclub' } });
    if (!org) return;
    await this.prisma.membership.upsert({
      where: { userId_orgId_role: { userId, orgId: org.id, role: 'producer_admin' } },
      update: { status: 'active' },
      create: { userId, orgId: org.id, role: 'producer_admin', status: 'active' },
    });
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

  /** İlk girişten sonra, üyelik bekleyen kullanıcının doldurduğu kayıt formu. Telefon SMS ile doğrulanmıştır. */
  async submitMembershipRequest(
    userId: string,
    register: MembershipRequestInfo,
    ctx: Ctx,
  ): Promise<{ ok: true }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { phone: true } });
    const phone = user?.phone ?? (register.phone ? toE164TR(register.phone) : null);
    if (!phone) throw new BadRequestException('Geçerli bir Türkiye cep telefonu girin.');

    const existing = await this.prisma.membershipRequest.findFirst({
      where: { userId, status: 'pending' },
    });
    if (existing) throw new BadRequestException('Zaten bekleyen bir başvurunuz var.');

    await this.prisma.$transaction(async (tx) => {
      if (!user?.phone) {
        const owner = await tx.user.findUnique({ where: { phone }, select: { id: true } });
        if (!owner) await tx.user.update({ where: { id: userId }, data: { phone } });
      }
      await tx.membershipRequest.create({
        data: {
          userId,
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
