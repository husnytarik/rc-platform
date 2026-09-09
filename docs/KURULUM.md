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
2. SMS/WhatsApp sağlayıcı — sonra seçilecek. Şimdilik `OTP_DEV_ECHO=true` ve OTP kodu log'a yazılıyor; sağlayıcı seçilince `SmsService` arkasına takılır, `.env`'e kimlik bilgileri eklenip `OTP_DEV_ECHO=false` yapılır.
3. Eski repo `rc_controlcenter` için Apple `.p8` anahtarını iptal/yenile (sızıntı temizliği; acil değil).

## tRPC katmanı — bağlandı ✅

- `apps/api/src/trpc/`: `initTRPC` + superjson, `/trpc` prefix'inde Fastify eklentisi.
- `trpc-context.ts` — her istekte `Authorization: Bearer` → access token doğrula → kullanıcı + aktif üyelikler + rol seti. Token yoksa `user: null`.
- `trpc.ts` — `publicProcedure` / `protectedProcedure` (oturum şart) / `capabilityProcedure(cap)` (aktif üyelik + RBAC matrisi `canAny`).
- `routers/auth.router.ts` — `auth.requestOtp` · `auth.verifyOtp` · `auth.refresh` · `auth.logout` · `auth.me` (oturum sahibinin profili + rolleri). REST `AuthController` aynı zod sözleşmesini (`auth.schemas.ts`) paylaşarak duruyor; istemciler tRPC'ye geçince kaldırılacak.
- `AppRouter` tipi export ediliyor — admin paneli + mobil uçtan uca tip güvenliği için import eder.
- Hata biçimi: stack trace yanıttan çıkarılır (log'da kalır); girdi hatası `data.zod.fieldErrors` ile döner.
- Doğrulandı: OTP akışı tRPC üzerinden çalışıyor, `auth.me` token'lı → `roles:["producer_admin"]`, token'sız → 401.

## Katalog + fiyat + ölçü birimi — bağlandı ✅

- **Ölçü birimi** (`@rc/shared/uom.ts` + `Uom` enum): ürünler farklı birimlerde satılır — ağırlık (g/kg), hacim (ml/cl/L), sayı/ambalaj (adet/paket/kutu/koli/çuval). Her varyantta `orderUom` (müşteri bu birimde miktar girer, fiyat bu birim başına), `minOrderQty`, `qtyStep`, opsiyonel `contentAmount`/`contentUom` (250 g paket → gösterim/raporlama), `lowStockThreshold`. `validateQty` sayı birimlerinde tam sayı + asgari + adım katı kuralını uygular; `convertUom` yalnız aynı tür içinde çevirir. `OrderLine.qty`/`StockMovement.delta` artık `Decimal(12,3)`, `OrderLine.uomSnapshot` eklenme anını dondurur.
- `apps/api/src/catalog/`:
  - `price.service.ts` — fiyat **yalnız sunucuda** çözülür. Öncelik: müşteriye özel liste → müşteri grubu → varsayılan → `variant.basePrice`. İlk kademe eşleşen liste kazanır; kademe = en büyük `minQty ≤ qty`; bir üst kademe `nextTier` olarak döner.
  - `visibility.service.ts` — `deny` kuralı gizler; özgüllük organization > customer_group > all. Üretici tarafı her şeyi görür.
  - `stock.service.ts` — bakiye = `SUM(delta)`; müşteriye **gerçek adet sızmaz**, yalnız rozet (`in`/`low`/`out`/`preorder`/`incoming`/`closed`). `StockDisplayOverride` rozeti ezer.
  - `catalog.service.ts` — `ctx.user`'dan görünüm bağlamı (üretici mi / hangi org / hangi gruplar) türetir, üçünü birleştirir.
- `routers/catalog.router.ts` — `catalog.categories` · `catalog.list` (kategori/arama + cursor) · `catalog.product` (id|slug). Hepsi `capabilityProcedure('catalog.view')`.
- Neon tohum verisiyle doğrulandı: üretici KPD-ESPRESSO'yu görür, `+905321112233` müşterisi görmez; müşteri GTM-ANTIGUA-1KG'de grup fiyatı 445, CB-KONSANTRE-1L'de özel fiyat 199 alır; rozetler out/preorder/low doğru; `available` müşteri yanıtında hep `null`; gizli ürün slug ile de çekilemiyor (`NOT_FOUND`).
- `@rc/shared` birim testleri: `pnpm --filter @rc/shared test` → 14 test (uom).

## Sipariş oluşturma + durum geçişi — bağlandı ✅

- **Anahtar kod** — `model Counter` (yıl bazlı sayaç, `counters` tablosu; migration `20260908140209_orders_counter`). Sipariş oluşturma transaction'ı içinde `upsert` + `increment` ile atomik artar → `RC-2026-000001` biçiminde insan-okunur `keyCode`.
- `apps/api/src/orders/`:
  - `order.service.ts` — `createOrder` / `transition` / `getOrder` / `listOrders`.
    - **createOrder** (yalnız müşteri rolleri): şube müşteriye ait + aktif mi, üyelik `branchScope` şubeyi kapsıyor mu; aynı varyant satırları birleştirilir; varyant aktif + ürün görünür (gizli değil) mi; `validateQty` (birim/asgari/adım); fiyat **sunucuda** `PriceService.resolveOne` ile çözülür; satır/ara toplam `Decimal(12,3/2)`. Tek `$transaction`: `order` + `order_line`'lar + `order_event` (`placed`) + `activity_log` + `outbox` (`order.placed`). **Stok bu aşamada düşmez.**
    - **transition** — `TRANSITIONS` tablosunda tanımlı mı, `canTransition(from,to,role)` (producer_admin baypas) yetki verir mi. Tek `$transaction`: `decrementsStock` geçişinde (`placed→confirmed`) her ürün satırı için negatif `stock_movement` (`order_reserve`); `cancelled`'a `stockIsReserved(from)` durumundan geçişte pozitif `stock_movement` (`order_release`); `order.status` güncelle + `order_event` (`transition`) + `activity_log` + `outbox` (`order.status_changed`).
    - **getOrder / listOrders** — `keyCode` veya uuid ile; müşteri yalnız kendi org'unun siparişlerini görür, üretici tarafı hepsini; cursor sayfalama.
- `routers/order.router.ts` — `orders.create` (`capabilityProcedure('order.create')`) · `orders.list` · `orders.get` (`order.view.own` VEYA `order.view.all`) · `orders.transition` (`order.confirm`/`order.cancel`/`production.advance`/`shipping.advance` — herhangi biri). `trpc.ts`'e `capabilityAnyProcedure(caps)` eklendi.
- Neon tohum verisiyle uçtan uca doğrulandı (**31/31**): `RC-2026-000001` fiyatları 445.00/199.00, toplam 6534.00; `placed`'de stok sabit; `placed→confirmed` tam sipariş miktarı kadar 2 `order_reserve` hareketi; `delivered`'a kadar zincir 7 olay, çift düşüm yok; `confirmed→cancelled` `order_release` ile bakiye geri; 6 negatif senaryo (`FORBIDDEN`/`BAD_REQUEST`) beklendiği gibi.
- `@rc/shared` birim testleri: `pnpm --filter @rc/shared test` → 23 test (14 uom + 9 order-state).

## Tasarım token'ları (`@rc/shared/theme`) — bağlandı ✅

- `packages/shared/src/theme.ts` — framework'süz tek kaynak. `BRAND` (yeşil 50–900, 500=`#2f7d49`), `NEUTRAL` (yeşile çalan griler), `SEMANTIC` (`success/warning/danger/info`), `SPACE` · `RADIUS` · `FONT_SIZE` · `ELEVATION` · `MOTION`.
- `brandRamp(intensity=1)` — HSL doygunluğunu 0.7–1.4 arasında ölçekler ("yoğunlaştırılabilir" yeşil). `ORDER_STATUS_META` — her `OrderStatus` için `{ tone, color, icon }` (lucide ikon adları).
- `apps/admin/src/app/globals.css` bu token'ları CSS değişkeni olarak birebir yansıtır; açık/koyu tema `prefers-color-scheme` ile.

## `apps/admin` (Next.js) kabuğu — bağlandı ✅

- **Yığın:** Next 15 App Router + React 19 + tRPC v11 (`@trpc/react-query`) + React Query v5. Refine **kullanılmadı** — v4 peer'ları React 19 / RQ v5 ile uyumsuz; yerine ince "plain Next + tRPC + context" yaklaşımı.
- **Tip köprüsü:** `apps/api` `nest build` ile `.d.ts` üretir; `apps/api/package.json` `exports` → `@rc/api/app-router`. Admin `import type { AppRouter }` ile uçtan uca tip alır (turbo `typecheck` `^build`'e bağlı).
- `src/lib/` — `trpc.ts` (React client) · `trpc-vanilla.ts` (React dışı çağrılar) · `auth-store.ts` (localStorage aynası, `rc.admin.access`/`rc.admin.refresh`) · `session.ts` (`refreshSession` tek uçuş + `endSession`) · `identity.ts` · `format.ts` (₺ / tarih / yaş) · `nav.ts` (10 bölüm, `cap` görünürlük eşlemesi).
- `src/providers/auth-context.tsx` — `AuthContextProvider` + `useAuth()`: `status` (`loading|authenticated|anonymous`), `identity`, `can(cap)` (`canAny` üzerinden), `login` / `logout`. `providers.tsx` içinde `authedFetch` 401'de bir kez `refreshSession()` deneyip isteği tekrarlar.
- **Rotalar:** `/giris` (telefon + OTP iki adım) · `(panel)/` grubu `AuthGate` + `AppShell` sarmalı → `/` (genel bakış: açık sipariş sayaçları + tutar) · `/siparisler` (durum çipli sonsuz liste) · `/siparisler/[key]` (detay + `nextSteps`'ten durum geçişi butonları + olay zaman çizelgesi) · `[section]` (yetki kontrollü "yakında" ekranı) · `not-found.tsx`.
- Portlar: admin `:3000`, API `:3001` (`ADMIN_URL` CORS). `pnpm -C apps/admin run typecheck` temiz; `/giris`, `/`, `/siparisler`, `/katalog` derleniyor; canlı API ile `verifyOtp → auth.me → orders.list` uçtan uca doğrulandı (`producer_admin`, `RC-2026-000001..3`).

## Sıradaki iş

- Admin: gerçek tarayıcı ile giriş → pano → detay → durum geçişi tık-turu; sonra katalog / müşteri ekranları
- Worker (pg-boss): `outbox` → bildirim
