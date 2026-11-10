import { z } from 'zod';

/**
 * Ortam değişkenleri tek yerde, açılışta doğrulanır. Eksik/yanlış değişkenle
 * uygulama hiç ayağa kalkmaz — sessiz hata yok.
 */
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(3001),
  API_URL: z.string().url().default('http://localhost:3001'),
  ADMIN_URL: z.string().url().default('http://localhost:3000'),
  WEB_URL: z.string().url().optional(),

  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().min(1).optional(),

  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(75),


  SENTRY_DSN: z.string().optional(),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  EXPO_ACCESS_TOKEN: z.string().optional(),

  // SMS ile giriş (Netgsm). NETGSM_* üçü birden tanımlı olmalı; yoksa üretimde kod gönderilemez.
  TC_HASH_SECRET: z.string().min(16).optional(),
  NETGSM_USERCODE: z.string().optional(),
  NETGSM_PASSWORD: z.string().optional(),
  NETGSM_HEADER: z.string().optional(),
  OTP_DAILY_CAP: z.coerce.number().int().positive().optional(),
  ADMIN_PHONES: z.string().optional(),
});

export type Env = z.infer<typeof schema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Ortam değişkenleri geçersiz:\n${issues}`);
  }
  return parsed.data;
}
