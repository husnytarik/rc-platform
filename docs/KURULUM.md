# Kurulum durumu ve sonraki adımlar

Bu belge "nerede kaldık"ı tutar. Mimari kararlar için `MIMARI.md`.

## Tamamlanan — Faz 0/1 iskeleti

- **Monorepo** (`rc-platform`): pnpm workspace + Turborepo.
  - `packages/shared` — roller, RBAC yetenek matrisi, sipariş durum makinesi, TR telefon normalizasyonu. Derleniyor ✅
  - `apps/api` — NestJS 11 (Fastify 5) + Prisma 6. Derleniyor + typecheck temiz ✅
- **Veri modeli** — `apps/api/prisma/schema.prisma`: organizasyon/şube/kullanıcı/üyelik, OTP + rotating refresh token, katalog + varyant, fiyat listeleri (default/grup/müşteri), görünürlük kuralları, stok defteri (append-only) + gösterim override, sipariş + kalem + olay defteri, destek, hizmet/randevu, duyuru, bildirim + teslim, import job, `activity_log`, `outbox`.
- **Kimlik / OTP** — `apps/api/src/auth/`:
  - `POST /auth/otp/request` — kod üret + SMS (dev'de log'a yazılır), saatlik limit + cooldown
  - `POST /auth/otp/verify` — kod doğrula (argon2 hash, deneme limiti); yeni numara → kullanıcı + `membership_request` (yönetici onayına düşer); sonuç `state: active | pending`
  - `POST /auth/refresh` — rotating refresh, aile bazlı; yeniden-kullanım tespitinde aile iptali
  - `POST /auth/logout` — refresh iptal
- **Güvenlik/gözlem tabanı** — env açılışta zod ile doğrulanır (eksikse başlamaz), helmet, global rate-limit, `activity_log`, girdi doğrulama zod + `ZodExceptionFilter` (400 + alan bazlı `issues`), `/health` DB kontrolü.
- Kök `.env` üretildi; JWT secret'ları hazır. Sırlar `.gitignore`'da; commit edilmez.

## Neon bağlandı — çalışan sistem ✅

- Neon projesi `neondb` (Frankfurt / eu-central-1), pooled → `DATABASE_URL`, direct → `DIRECT_URL`.
- İlk migration (`20260908054435_init`) Neon'a uygulandı.
- Seed çalıştı: üretici org `roasteryclub` + varsayılan fiyat listesi + yönetici (`+905000000000`).
- API ayakta: `GET /health` → `{"ok":true,"db":true}`.
- Uçtan uca doğrulandı:
  - `POST /auth/otp/request` → `{expiresInSec:300}`, kod dev'de log'a yazılıyor
  - `POST /auth/otp/verify` → `accessToken` + `refreshToken` + `state:active`
  - `POST /auth/refresh` → rotasyon; eski token tekrar kullanılınca **aile iptali** (401)
  - Hatalı kod → 400; geçersiz girdi → 400 `ValidationError`
- Komutlar: `pnpm --filter @rc/api dev` (API), `pnpm db:studio` (veri tarayıcı).

## Senin yapman gerekenler

1. Yeni GitHub repo (`rc-platform`, private) açıp bağlamak istersen: repo URL'ini ver, remote ekleyip push ederim. (Zorunlu değil, yerelde ilerliyoruz.)
2. Netgsm bilgileri (usercode / password / sender) hazır olunca `.env`'e ekle — `OTP_DEV_ECHO=false` yapınca gerçek SMS gider.
3. Eski repo `rc_controlcenter` için Apple `.p8` anahtarını iptal/yenile (sızıntı temizliği; acil değil).

## Sıradaki iş (Neon bağlandıktan sonra)

- tRPC router iskeleti + access-token guard + `ctx` (kullanıcı + membership'ler + capability kontrolü)
- Katalog + fiyat çözümü servisi (müşteriye özel → grup → default)
- Sipariş oluşturma + durum geçişi endpoint'leri (durum makinesi + `order_events` + stok düşümü aynı transaction)
- `apps/admin` (Next.js + Refine) kabuğu
- Worker (pg-boss): `outbox` → bildirim
