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

  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().min(1).optional(),

  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(75),

  GOOGLE_MOBILE_CLIENT_ID: z.string().min(1),
  GOOGLE_ADMIN_CLIENT_ID: z.string().min(1),
  APPLE_BUNDLE_ID: z.string().min(1),

  SENTRY_DSN: z.string().optional(),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  EXPO_ACCESS_TOKEN: z.string().optional(),
});

export type Env = z.infer<typeof schema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Ortam değişkenleri geçersiz:\n${issues}`);
  }
  return parsed.data;
}
