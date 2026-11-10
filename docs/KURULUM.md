# Kurulum, çalıştırma ve durum

Bu belge "sistem şu an nasıl çalışıyor ve nasıl ayağa kaldırılır"ı tutar. Mimari kararlar için `MIMARI.md`, ürün kapsamı için `SPEC.md`.

> Son güncelleme: 2026-11-10. Uygulama daha önce Firebase üzerinde çalışıyordu; bu repo onun yeniden yazımıdır (Postgres + NestJS/tRPC + tek Expo uygulaması).

## Canlı bileşenler

| Parça | Nerede | Not |
|---|---|---|
| API (NestJS + Fastify + tRPC) | Render — `https://rc-api-tird.onrender.com` | `render.yaml` ile tanımlı; ücretsiz planda boşta uyur, ilk istek ~30-60 sn sürebilir |
| Veritabanı | Neon Postgres (Frankfurt) | Prisma migration'ları `prisma migrate deploy` ile uygulanır |
| Mobil uygulama | TestFlight (iOS) · `apps/mobile` | Bundle ID `com.roasteryclub.app`, ASC Apple ID `6752270952` |
| OTA güncelleme | EAS Update, kanal `production` | `runtimeVersion` politikası `sdkVersion`; yalnızca JS değişiklikleri |
| Web paneli | GitHub Pages — `https://husnytarik.github.io/rc-platform/` | Aynı Expo uygulamasının web derlemesi; girişi yalnızca demo kodu |
| `apps/admin` (Next.js) | — | **Donduruldu.** Tüm yeni iş `apps/mobile`'da, role göre ekranlarla |

## Kimlik doğrulama (güncel)

- **Yalnızca Google ve Apple ile giriş.** Telefon/OTP/SMS yok.
- Kullanıcı kimliği `(provider, providerUserId)` çiftidir; aynı kişi Google ve Apple ile ayrı iki kullanıcı olur (e-posta ile birleştirme henüz yok).
- Yeni kullanıcı `pending` durumundadır ve kayıt formunu gönderir (`auth.submitMembershipRequest`; telefon E.164, SMS ile doğrulanmaz). Üretici tarafı **Başvurular** sekmesinden onaylar (`membership.review`) → firma + şube + üyelik açılır.
- **Demo girişi:** `auth.demoLogin`, yalnızca Render'da `DEMO_ADMIN_CODE` / `DEMO_CUSTOMER_CODE` tanımlıysa açıktır. Hız sınırlı, sabit zamanlı karşılaştırma. Admin kodu gerçek `producer_admin` verisine erişir; müşteri kodu "Demo Kafe" firmasına girer. Apple incelemesine **yalnızca müşteri kodu** verilir.
- Bilinen eksik: ilk üretici yöneticisi üyeliği elle (seed/DB) açılıyor; `ADMIN_EMAILS` ile otomatik yönetici ve Google↔Apple hesap birleştirme önerildi, yapılmadı.

## Ortam değişkenleri

Şablon: kökteki `.env.example` (API) ve `apps/mobile/.env.example`. API açılışta zod ile doğrular; eksik/yanlışsa başlamaz.

API (Render panelinde `sync: false` olanlar elle girilir):

| Değişken | Açıklama |
|---|---|
| `DATABASE_URL` / `DIRECT_URL` | Neon pooled / direct bağlantı |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | ≥16 karakter |
| `GOOGLE_MOBILE_CLIENT_ID` / `GOOGLE_ADMIN_CLIENT_ID` | Google token `aud` doğrulaması |
| `APPLE_BUNDLE_ID` | `com.roasteryclub.app` |
| `ADMIN_URL` | CORS için tek URL |
| `WEB_URL` | İsteğe bağlı; web derlemesinin origin'i (`https://husnytarik.github.io`) |
| `DEMO_ADMIN_CODE` / `DEMO_CUSTOMER_CODE` | İsteğe bağlı; demo girişi. Boşsa demo kapalıdır |
| `EXPO_ACCESS_TOKEN` | İsteğe bağlı; Expo Push |
| `SENTRY_DSN` | İsteğe bağlı |

Mobil: `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`, `GOOGLE_IOS_URL_SCHEME`.

## Yerelde çalıştırma

```bash
pnpm install
cp .env.example .env            # değerleri doldur
pnpm db:generate && pnpm db:migrate
pnpm db:seed                    # üretici org + varsayılan fiyat listesi
pnpm --filter @rc/api dev       # API :3001
cd apps/api && npx nest build   # mobil, API tiplerini dist'ten okur
cd ../mobile && npx tsc --noEmit
cd ../mobile && npx expo start  # (web için: npx expo start --web)
```

Mobil, `@rc/api/app-router` tiplerini derlenmiş `dist`'ten okur; API şemasını değiştirdikten sonra `nest build` çalıştırmadan mobil typecheck eskir.

## Yayın akışı

- **JS değişikliği → OTA:** `eas update --branch production`. Uygulamayı kapatıp iki kez açmak gerekir (indir → uygula).
- **Native değişiklik / yeni binary → iOS:** GitHub Actions "Mobil iOS build" (macOS, `eas build --local`, build numarası = run numarası) TestFlight'a gönderir. Submit adımı sık sık "Scheduled iOS submission" sonrası ~10 dk takılıp zaman aşımına uğrar; build yine de TestFlight'a ulaşır.
- **API:** `main`'e push → Render otomatik deploy. Migration'lar `prisma migrate deploy`.
- **Web:** GitHub Actions "web-deploy" (yalnızca elle tetiklenir) → `expo export --platform web` → Pages. Web'de Excel içe/dışa aktarım ve push çalışmaz.
- Android: imza ve build hazırlığı sürüyor (release imza sırları izlenen dosyalardan çıkarıldı).

## Tamamlanan özellikler

- **Veri modeli** (`apps/api/prisma/schema.prisma`): organizasyon/şube/kullanıcı/üyelik, katalog + varyant, fiyat listeleri (varsayılan/grup/müşteri), görünürlük kuralları, append-only stok defteri + gösterim override, sipariş + kalem + olay defteri, destek, hizmet/randevu, duyuru, bildirim, `activity_log`, `outbox`.
- **Katalog, fiyat, ölçü birimi:** fiyat yalnızca sunucuda çözülür; müşteriye gerçek stok adedi sızmaz (rozet). Ölçü birimleri g/kg/ml/cl/l/adet/paket/kutu/koli/çuval, asgari miktar ve adım kuralı.
- **Siparişler:** oluşturma, durum makinesi ve role kilitli geçişler, stok rezervasyon/serbest bırakma, siparişe sonradan kalem ekleme, olay zaman çizelgesi.
- **Üyelik başvuruları** ve **müşteri yönetimi** (kapsam sunucuda zorlanır).
- **Destek talepleri, duyurular, servis kataloğu/randevu.**
- **Raporlar:** ciro, sipariş sayısı, duruma göre dağılım, en çok alan müşteri/ürün.
- **Bildirimler:** `outbox` → `OutboxProcessor` → `NotificationService` (uygulama içi + Expo push).
- **Excel içe/dışa aktarım** (`catalog.manage`): tek satır = bir varyant; önizleme (dry-run) sonra uygula, en fazla 500 satır, kategoriler adla oluşturulur, stok hedef bakiye olarak `adjustment` hareketiyle işlenir.
- **Tek mobil uygulama, role göre ekranlar:** müşteri sekmeleri ve üretici sekmeleri (Siparişler, Başvurular, Katalog, Destek; "Daha fazla": Stok, Müşteriler, Servisler, Duyurular, Excel, Raporlar).
- Test: `pnpm --filter @rc/shared test`.

## Sıradaki iş

- Şube yönetimi arayüzü
- Duyurularda müşteri grubu seçici
- `ADMIN_EMAILS` ile yönetici bootstrap'i + Google/Apple hesap birleştirme
- App Store yayın hazırlığı (ekran görüntüleri, gizlilik bilgisi, inceleme notları)
- Android build ve Play Console
- Render ücretsiz plan uykusu için keep-alive (`/health`'e UptimeRobot, ücretsiz)

## Eski repo

`D:\rc\RoasteryClub` (Firebase) beklemede; salt-okunur referans. Gizli anahtarlar içerdiği için **asla public yapılmaz.** `rc-platform` public olduğundan buraya sır konmaz.
