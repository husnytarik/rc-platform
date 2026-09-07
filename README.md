# rc-platform

RoasteryClub yeniden yapımı — B2B kahve sipariş, operasyon ve müşteri yönetimi.

Mimari referans: [`docs/MIMARI.md`](docs/MIMARI.md) · Ürün spec: [`docs/SPEC.md`](docs/SPEC.md)
(bu iki belge eski repodan buraya taşınacak).

## Yapı

```
apps/
  api/      NestJS (Fastify) + tRPC + Prisma  — tüm iş kuralları burada
  admin/    Next.js + Refine                  — yönetim paneli (sonra)
  mobile/   Expo / React Native               — mevcut app buraya taşınır (Faz 4)
packages/
  shared/   Zod şemaları · sipariş durum makinesi · RBAC matrisi · ortak tipler
```

## Kurulum

```bash
corepack use pnpm@9.15.0     # ya da: npm i -g pnpm
pnpm install
cp .env.example .env         # Neon DATABASE_URL + JWT secret'ları doldur
pnpm db:migrate              # şemayı Neon'a uygula
pnpm dev                     # api + admin
```

## İlkeler

- İstemciye asla güvenme: fiyat, yetki, durum geçişi yalnızca API'de.
- Append-only defterler: `stock_movements`, `order_events`, `activity_log`, `outbox`.
- Sır yok: her şey `.env` (commit edilmez) veya deploy platformunun secret store'unda.
- Her mutasyon `activity_log`'a; her domain olayı `outbox`'a.
