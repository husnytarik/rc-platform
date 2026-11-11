# Kurulum, çalıştırma ve durum

Bu belge "sistem şu an nasıl çalışıyor ve nasıl ayağa kaldırılır"ı tutar. Mimari kararlar için `MIMARI.md`, ürün kapsamı için `SPEC.md`.

> Son güncelleme: 2026-11-11. Uygulama daha önce Firebase üzerinde çalışıyordu; bu repo onun yeniden yazımıdır (Postgres + NestJS/tRPC + tek Expo uygulaması).

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

- **T.C. kimlik no + telefon + SMS kodu.** Google/Apple girişi kaldırıldı (2026-11-11).
- Akış: kullanıcı TC ve telefonunu girer → `auth.requestOtp` telefona 6 haneli kod yollar (5 dk geçerli, 5 yanlış denemede kod yanar, tek kullanımlık) → `auth.verifyOtp` oturum verir. Kod oturumun "şifresidir"; ayrı şifre yok.
- TC yalnızca **biçim** olarak doğrulanır (11 hane + sağlama); NVİ ile sorgulanmaz. Düz TC saklanmaz, HMAC özeti (`users.tcHash`) tutulur. Numara kayıtlıyken farklı TC ile istek gelirse SMS gönderilmez.
- Yeni numara `pending` kullanıcı olur, firma formunu doldurur (`auth.submitMembershipRequest`; telefon zaten SMS ile doğrulanmıştır), üretici tarafı **Başvurular** sekmesinden onaylar (`membership.review`).
- **İlk yönetici:** `ADMIN_PHONES` içindeki numara SMS ile girince `roasteryclub` org'unda `producer_admin` olur (elle DB işi yok).
- Eski Google/Apple kullanıcıları telefon numarası kayıtlıysa aynı numarayla girebilir; TC ilk girişte bağlanır.
- **Geçici SMS-siz mod (`SMS_MOCK=true`, Netgsm tanımlı değilken):** SMS gitmez; müşteri için kod sunucudan döner ve uygulama alanı otomatik doldurur (yani TC + telefon bilen kişi o hesaba girebilir — kabul edilmiş geçici risk). `ADMIN_PHONES` numarası ise kod yerine `ADMIN_PASSWORD` ister (Render'da, ≥8 karakter; tanımsızsa yönetici girişi kapalı). Netgsm tanımlanınca mock otomatik kapanır.
- **SMS maliyet koruması:** numara başına 60 sn aralık ve saatte 5 kod, IP başına saatte 20 istek, günlük toplam tavan (`OTP_DAILY_CAP`, varsayılan 200). Netgsm ön ödemeli kontörle çalışır; bakiye bitince gönderim durur, borçlanma olmaz.
- **SMS sağlayıcısı:** Netgsm (`NETGSM_USERCODE`, `NETGSM_PASSWORD`, `NETGSM_HEADER` — onaylı mesaj başlığı gerekir). Tanımlı değilse üretimde kod gönderilemez; demo girişi çalışmaya devam eder. Netgsm istemcisi gerçek hesapla henüz denenmedi.
- **Demo girişi:** `auth.demoLogin`, yalnızca Render'da `DEMO_ADMIN_CODE` / `DEMO_CUSTOMER_CODE` tanımlıysa açıktır. Web derlemesinde tek giriş yoludur. Apple incelemesine **yalnızca müşteri kodu** verilir.

## Ortam değişkenleri

Şablon: kökteki `.env.example` (API) ve `apps/mobile/.env.example`. API açılışta zod ile doğrular; eksik/yanlışsa başlamaz.

API (Render panelinde `sync: false` olanlar elle girilir):

| Değişken | Açıklama |
|---|---|
| `DATABASE_URL` / `DIRECT_URL` | Neon pooled / direct bağlantı |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | ≥16 karakter |
| `NETGSM_USERCODE` / `NETGSM_PASSWORD` / `NETGSM_HEADER` | SMS sağlayıcısı; üçü birlikte |
| `ADMIN_PHONES` | İlk yönetici telefon(lar)ı, virgülle (`+905...`) |
| `TC_HASH_SECRET` | İsteğe bağlı (≥16 karakter); boşsa `JWT_REFRESH_SECRET`. Sonradan değiştirilirse kayıtlı TC özetleri eşleşmez |
| `SMS_MOCK` / `ADMIN_PASSWORD` | Netgsm yokken geçici mod (`true`) ve yönetici şifresi (≥8) |
| `OTP_DAILY_CAP` | Günlük toplam SMS tavanı (varsayılan 200) |
| `ADMIN_URL` | CORS için tek URL |
| `WEB_URL` | İsteğe bağlı; web derlemesinin origin'i (`https://husnytarik.github.io`) |
| `DEMO_ADMIN_CODE` / `DEMO_CUSTOMER_CODE` | İsteğe bağlı; demo girişi. Boşsa demo kapalıdır |
| `EXPO_ACCESS_TOKEN` | İsteğe bağlı; Expo Push |
| `SENTRY_DSN` | İsteğe bağlı |

Mobil: yalnızca `EXPO_PUBLIC_API_URL`.

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
- **API:** `main`'e push → Render otomatik deploy; build komutu `prisma migrate deploy` çalıştırır.
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

- Netgsm hesabı + onaylı başlık, Render'a `NETGSM_*` ve `ADMIN_PHONES` girilmesi; SMS istemcisinin gerçek hesapla denenmesi
- Şube yönetimi arayüzü
- Duyurularda müşteri grubu seçici
- App Store yayın hazırlığı (ekran görüntüleri, gizlilik bilgisi, inceleme notları)
- Android build ve Play Console
- Render ücretsiz plan uykusu için keep-alive (`/health`'e UptimeRobot, ücretsiz)

## Eski repo

`D:\rc\RoasteryClub` (Firebase) beklemede; salt-okunur referans. Gizli anahtarlar içerdiği için **asla public yapılmaz.** `rc-platform` public olduğundan buraya sır konmaz.
