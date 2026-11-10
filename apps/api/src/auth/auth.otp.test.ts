import { describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service';

const TC = '10000000146';
const PHONE = '0532 111 22 33';
const E164 = '+905321112233';

/** Prisma'nın bu akışta kullanılan yüzeyini bellekte taklit eder. */
function setup(opts: { users?: Record<string, unknown>[] } = {}) {
  const users = [...(opts.users ?? [])] as { id: string; phone: string; tcHash: string | null; isActive: boolean }[];
  const otps: Record<string, any>[] = [];
  let sent = '';
  const prisma: any = {
    user: {
      findUnique: async ({ where }: any) => users.find((u) => u.phone === where.phone) ?? null,
      create: async ({ data }: any) => {
        const u = { id: `u${users.length + 1}`, fullName: null, isActive: true, ...data };
        users.push(u);
        return u;
      },
      update: async ({ where, data }: any) => Object.assign(users.find((u) => u.id === where.id)!, data),
    },
    otpCode: {
      findMany: async ({ where }: any) =>
        otps.filter((o) => o.phone === where.phone && o.createdAt >= where.createdAt.gte).reverse(),
      count: async () => otps.length,
      create: async ({ data }: any) => {
        const o = { id: `o${otps.length + 1}`, attempts: 0, consumedAt: null, createdAt: new Date(), ...data };
        otps.push(o);
        return o;
      },
      delete: async ({ where }: any) => otps.splice(otps.findIndex((o) => o.id === where.id), 1),
      findFirst: async ({ where }: any) =>
        [...otps].reverse().find((o) => o.phone === where.phone && !o.consumedAt && o.expiresAt > new Date()) ?? null,
      update: async ({ where, data }: any) => {
        const o = otps.find((x) => x.id === where.id)!;
        o.attempts += data.attempts.increment;
        return o;
      },
      updateMany: async ({ where, data }: any) => {
        const o = otps.find((x) => x.id === where.id && !x.consumedAt);
        if (!o) return { count: 0 };
        Object.assign(o, data);
        return { count: 1 };
      },
    },
    membership: { count: async () => 0, upsert: async () => ({}) },
    organization: { findUnique: async () => null },
  };
  const tokens: any = {
    issuePair: async () => ({ accessToken: 'a', refreshToken: 'r', refreshExpiresAt: new Date() }),
  };
  const sms: any = { send: vi.fn(async (_p: string, m: string) => void (sent = m)) };
  const config: any = { get: (k: string) => (k === 'JWT_REFRESH_SECRET' ? 'x'.repeat(32) : undefined) };
  const svc = new AuthService(prisma, tokens, sms, config);
  const lastCode = (): string => /(\d{6})/.exec(sent)![1]!;
  return { svc, users, otps, sms, lastCode };
}

describe('SMS ile giriş', () => {
  it('geçersiz TC veya telefonu SMS göndermeden reddeder', async () => {
    const { svc, sms } = setup();
    await expect(svc.requestOtp('12345678901', PHONE, {})).rejects.toThrow(/kimlik/);
    await expect(svc.requestOtp(TC, '123', {})).rejects.toThrow(/telefon/);
    expect(sms.send).not.toHaveBeenCalled();
  });

  it('yeni numara: kod gönderir, doğrulayınca pending kullanıcı açar', async () => {
    const { svc, users, lastCode } = setup();
    await svc.requestOtp(TC, PHONE, {});
    const s = await svc.verifyOtp(TC, PHONE, lastCode(), {});
    expect(s.state).toBe('pending');
    expect(users).toHaveLength(1);
    expect(users[0]!.phone).toBe(E164);
    expect(users[0]!.tcHash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(users)).not.toContain(TC);
  });

  it('yanlış kod 5 denemede kodu yakar; doğru kod da artık geçmez', async () => {
    const { svc, lastCode } = setup();
    await svc.requestOtp(TC, PHONE, {});
    const good = lastCode();
    const bad = good === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++) await expect(svc.verifyOtp(TC, PHONE, bad, {})).rejects.toThrow(/hatalı/);
    await expect(svc.verifyOtp(TC, PHONE, good, {})).rejects.toThrow(/hatalı/);
  });

  it('kod tek kullanımlık', async () => {
    const { svc, lastCode } = setup();
    await svc.requestOtp(TC, PHONE, {});
    const c = lastCode();
    await svc.verifyOtp(TC, PHONE, c, {});
    await expect(svc.verifyOtp(TC, PHONE, c, {})).rejects.toThrow(/hatalı/);
  });

  it('kayıtlı numara başka TC ile denenirse SMS gitmez', async () => {
    const { svc, sms, lastCode } = setup();
    await svc.requestOtp(TC, PHONE, {});
    await svc.verifyOtp(TC, PHONE, lastCode(), {});
    sms.send.mockClear();
    await expect(svc.requestOtp("11111111110", PHONE, {})).rejects.toThrow(/eşleşmiyor/);
    expect(sms.send).not.toHaveBeenCalled();
  });

  it('60 sn içinde ikinci kod isteği reddedilir', async () => {
    const { svc } = setup();
    await svc.requestOtp(TC, PHONE, {});
    await expect(svc.requestOtp(TC, PHONE, {})).rejects.toThrow(/saniye/);
  });

  it('SMS gönderilemezse kod kaydı silinir', async () => {
    const { svc, sms, otps } = setup();
    sms.send.mockRejectedValueOnce(new Error('sms down'));
    await expect(svc.requestOtp(TC, PHONE, {})).rejects.toThrow('sms down');
    expect(otps).toHaveLength(0);
  });
});
