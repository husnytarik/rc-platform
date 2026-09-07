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
- **Güvenlik/gözlem tabanı** — env açılışta zod ile doğrulanır (eksikse başlamaz), helmet, global rate-limit, `activity_log`, `ValidationPipe` (whitelist + forbidNonWhitelisted), `/health` DB kontrolü.
- Kök `.env` üretildi; JWT secret'ları hazır. Sırlar `.gitignore`'da; commit edilmez.

## Senin yapman gerekenler (kurulumu tamamlamak için)

1. **Neon hesabı + proje**: <https://neon.tech> → yeni proje (region: `eu-central-1` / Frankfurt önerilir), veritabanı adı `rc`.
2. Neon panelinden iki bağlantı dizesini al ve kök `.env` içine yapıştır:
   - **Pooled** connection string → `DATABASE_URL`
   - **Direct** (pooling kapalı) connection string → `DIRECT_URL`
3. Bana "Neon hazır" de — ben şunları çalıştırırım:
   ```
   pnpm db:migrate      # şemayı Neon'a uygular (ilk migration)
   pnpm --filter @rc/api db:seed   # üretici org + varsayılan fiyat listesi + yönetici
   pnpm --filter @rc/api dev       # API'yi ayağa kaldırır, /health yeşil olmalı
   ```
4. Yeni GitHub repo (`rc-platform`, private) açıp bağlamak istersen: repo URL'ini ver, remote ekleyip push ederim. (Zorunlu değil, yerelde ilerleyebiliriz.)

## Sıradaki iş (Neon bağlandıktan sonra)

- tRPC router iskeleti + access-token guard + `ctx` (kullanıcı + membership'ler + capability kontrolü)
- Katalog + fiyat çözümü servisi (müşteriye özel → grup → default)
- Sipariş oluşturma + durum geçişi endpoint'leri (durum makinesi + `order_events` + stok düşümü aynı transaction)
- `apps/admin` (Next.js + Refine) kabuğu
- Worker (pg-boss): `outbox` → bildirim
