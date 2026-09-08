import { PrismaClient, type Prisma, type Uom } from '@prisma/client';
import { trSlug } from '@rc/shared';

const prisma = new PrismaClient();

/**
 * Tohum: üretici org + yönetici + örnek katalog (farklı ölçü birimleri:
 * kg / adet / paket / koli / L) + fiyat listeleri (default / grup / müşteriye özel)
 * + görünürlük kuralı + bir örnek müşteri firma. Idempotent (kod/slug ile upsert).
 * Stok hareketleri yalnızca defter boşsa eklenir (append-only).
 */

interface VariantSeed {
  code: string;
  name: string;
  orderUom: Uom;
  basePrice: number;
  minOrderQty?: number;
  qtyStep?: number;
  contentAmount?: number;
  contentUom?: Uom;
  lowStockThreshold?: number;
  /** default listede kademeli fiyat: [minQty, fiyat][] */
  tiers?: [number, number][];
  /** başlangıç stoğu (orderUom cinsinden); yoksa stok hareketi eklenmez */
  openingStock?: number;
}

interface ProductSeed {
  code: string;
  name: string;
  categorySlug: string;
  brand?: string;
  description?: string;
  allowPreorder?: boolean;
  variants: VariantSeed[];
}

const CATEGORIES: { slug: string; name: string; sortOrder: number }[] = [
  { slug: 'cekirdek-kahve', name: 'Çekirdek Kahve', sortOrder: 10 },
  { slug: 'ogutulmus-kahve', name: 'Öğütülmüş Kahve', sortOrder: 20 },
  { slug: 'turk-kahvesi', name: 'Türk Kahvesi', sortOrder: 30 },
  { slug: 'soguk-demleme', name: 'Soğuk Demleme', sortOrder: 40 },
  { slug: 'ekipman', name: 'Ekipman & Sarf', sortOrder: 50 },
];

const PRODUCTS: ProductSeed[] = [
  {
    code: 'GTM-ANTIGUA',
    name: 'Guatemala Antigua',
    categorySlug: 'cekirdek-kahve',
    brand: 'RoasteryClub',
    description: 'Yıkanmış işlem, çikolata ve turunçgil notaları.',
    variants: [
      {
        code: 'GTM-ANTIGUA-1KG',
        name: '1 kg / Çekirdek',
        orderUom: 'kg',
        basePrice: 480,
        minOrderQty: 1,
        qtyStep: 1,
        tiers: [
          [10, 455],
          [25, 430],
        ],
        openingStock: 60,
      },
      {
        code: 'GTM-ANTIGUA-250G',
        name: '250 g paket / Çekirdek',
        orderUom: 'adet',
        basePrice: 145,
        minOrderQty: 4,
        qtyStep: 1,
        contentAmount: 250,
        contentUom: 'g',
        openingStock: 120,
      },
    ],
  },
  {
    code: 'BRZ-SANTOS',
    name: 'Brezilya Santos',
    categorySlug: 'cekirdek-kahve',
    brand: 'RoasteryClub',
    description: 'Fındık ve kakao, düşük asidite. Espresso harmanlarına taban.',
    variants: [
      {
        code: 'BRZ-SANTOS-1KG',
        name: '1 kg / Çekirdek',
        orderUom: 'kg',
        basePrice: 390,
        minOrderQty: 2,
        qtyStep: 1,
        openingStock: 40,
      },
      {
        code: 'BRZ-SANTOS-5KG-KOLI',
        name: '5 kg koli / Çekirdek',
        orderUom: 'koli',
        basePrice: 1850,
        minOrderQty: 1,
        qtyStep: 1,
        contentAmount: 5,
        contentUom: 'kg',
        openingStock: 8,
      },
    ],
  },
  {
    code: 'KPD-ESPRESSO',
    name: 'Kapadokya Espresso Blend',
    categorySlug: 'ogutulmus-kahve',
    brand: 'RoasteryClub',
    description: 'İşletmeye özel harman — yalnızca üretici tarafında görünür.',
    variants: [
      {
        code: 'KPD-ESPRESSO-1KG',
        name: '1 kg / Öğütülmüş',
        orderUom: 'kg',
        basePrice: 420,
        minOrderQty: 1,
        qtyStep: 0.5,
        openingStock: 25,
      },
    ],
  },
  {
    code: 'TRK-ORTA',
    name: 'Türk Kahvesi Orta Kavrulmuş',
    categorySlug: 'turk-kahvesi',
    brand: 'RoasteryClub',
    variants: [
      {
        code: 'TRK-ORTA-100G',
        name: '100 g kutu',
        orderUom: 'adet',
        basePrice: 68,
        minOrderQty: 10,
        qtyStep: 1,
        contentAmount: 100,
        contentUom: 'g',
        lowStockThreshold: 30,
        openingStock: 18,
      },
      {
        code: 'TRK-ORTA-500G',
        name: '500 g paket',
        orderUom: 'adet',
        basePrice: 300,
        minOrderQty: 2,
        qtyStep: 1,
        contentAmount: 500,
        contentUom: 'g',
        openingStock: 50,
      },
    ],
  },
  {
    code: 'CB-KONSANTRE',
    name: 'Cold Brew Konsantre',
    categorySlug: 'soguk-demleme',
    brand: 'RoasteryClub',
    description: '1:3 seyreltme. Soğuk zincir önerilir.',
    variants: [
      {
        code: 'CB-KONSANTRE-1L',
        name: '1 L şişe',
        orderUom: 'l',
        basePrice: 220,
        minOrderQty: 6,
        qtyStep: 1,
        contentAmount: 1,
        contentUom: 'l',
        openingStock: 90,
      },
      {
        code: 'CB-KONSANTRE-5L',
        name: '5 L bidon',
        orderUom: 'adet',
        basePrice: 980,
        minOrderQty: 1,
        qtyStep: 1,
        contentAmount: 5,
        contentUom: 'l',
        openingStock: 0,
      },
    ],
  },
  {
    code: 'YENI-HASAT',
    name: 'Etiyopya Yirgacheffe (Yeni Hasat)',
    categorySlug: 'cekirdek-kahve',
    brand: 'RoasteryClub',
    description: 'Ön sipariş — hasat yolda.',
    allowPreorder: true,
    variants: [
      {
        code: 'YENI-HASAT-1KG',
        name: '1 kg / Çekirdek',
        orderUom: 'kg',
        basePrice: 560,
        minOrderQty: 1,
        qtyStep: 1,
        openingStock: 0,
      },
    ],
  },
  {
    code: 'EKP-BARDAK-8OZ',
    name: 'Karton Bardak 8oz',
    categorySlug: 'ekipman',
    variants: [
      {
        code: 'EKP-BARDAK-8OZ-50',
        name: "50'li paket",
        orderUom: 'paket',
        basePrice: 95,
        minOrderQty: 5,
        qtyStep: 1,
        contentAmount: 50,
        contentUom: 'adet',
        openingStock: 200,
      },
    ],
  },
  {
    code: 'EKP-FILTRE-V60',
    name: 'Filtre Kağıdı V60 02',
    categorySlug: 'ekipman',
    variants: [
      {
        code: 'EKP-FILTRE-V60-1',
        name: 'Tek kağıt',
        orderUom: 'adet',
        basePrice: 4.5,
        minOrderQty: 100,
        qtyStep: 100,
        lowStockThreshold: 200,
        openingStock: 150,
      },
    ],
  },
];

async function ensurePriceList(
  data: Pick<Prisma.PriceListUncheckedCreateInput, 'name' | 'scope' | 'orgId' | 'groupId'>,
): Promise<string> {
  const found = await prisma.priceList.findFirst({
    where: { scope: data.scope, orgId: data.orgId ?? null, groupId: data.groupId ?? null },
  });
  if (found) return found.id;
  const created = await prisma.priceList.create({ data });
  return created.id;
}

async function setPrice(
  priceListId: string,
  variantId: string,
  price: number,
  minQty = 1,
): Promise<void> {
  const existing = await prisma.priceListItem.findFirst({
    where: { priceListId, variantId, minQty },
  });
  if (existing) {
    await prisma.priceListItem.update({ where: { id: existing.id }, data: { price } });
  } else {
    await prisma.priceListItem.create({ data: { priceListId, variantId, price, minQty } });
  }
}

async function main() {
  const adminPhone = process.env.SEED_ADMIN_PHONE ?? '+905000000000';

  const producer = await prisma.organization.upsert({
    where: { slug: 'roasteryclub' },
    update: {},
    create: { type: 'producer', name: 'RoasteryClub', slug: 'roasteryclub' },
  });

  const admin = await prisma.user.upsert({
    where: { phone: adminPhone },
    update: {},
    create: { phone: adminPhone, fullName: 'Sistem Yöneticisi' },
  });
  await prisma.membership.upsert({
    where: { userId_orgId_role: { userId: admin.id, orgId: producer.id, role: 'producer_admin' } },
    update: { status: 'active' },
    create: { userId: admin.id, orgId: producer.id, role: 'producer_admin', status: 'active' },
  });

  // ── Kategoriler ──
  const categoryId = new Map<string, string>();
  for (const c of CATEGORIES) {
    const row = await prisma.category.upsert({
      where: { slug: c.slug },
      update: { name: c.name, sortOrder: c.sortOrder },
      create: { slug: c.slug, name: c.name, sortOrder: c.sortOrder },
    });
    categoryId.set(c.slug, row.id);
  }

  // ── Ürünler + varyantlar ──
  const defaultListId = await ensurePriceList({ name: 'Varsayılan Liste', scope: 'default' });
  const variantIdByCode = new Map<string, string>();
  const variantsNeedingStock: { id: string; qty: number }[] = [];

  for (const p of PRODUCTS) {
    const product = await prisma.product.upsert({
      where: { code: p.code },
      update: {
        name: p.name,
        categoryId: categoryId.get(p.categorySlug),
        brand: p.brand,
        description: p.description,
        allowPreorder: p.allowPreorder ?? false,
      },
      create: {
        code: p.code,
        name: p.name,
        slug: trSlug(p.name),
        categoryId: categoryId.get(p.categorySlug),
        brand: p.brand,
        description: p.description,
        allowPreorder: p.allowPreorder ?? false,
      },
    });

    for (const v of p.variants) {
      const variant = await prisma.productVariant.upsert({
        where: { code: v.code },
        update: {
          name: v.name,
          orderUom: v.orderUom,
          basePrice: v.basePrice,
          minOrderQty: v.minOrderQty ?? 1,
          qtyStep: v.qtyStep ?? 1,
          contentAmount: v.contentAmount ?? null,
          contentUom: v.contentUom ?? null,
          lowStockThreshold: v.lowStockThreshold ?? null,
        },
        create: {
          productId: product.id,
          code: v.code,
          name: v.name,
          orderUom: v.orderUom,
          basePrice: v.basePrice,
          minOrderQty: v.minOrderQty ?? 1,
          qtyStep: v.qtyStep ?? 1,
          contentAmount: v.contentAmount ?? null,
          contentUom: v.contentUom ?? null,
          lowStockThreshold: v.lowStockThreshold ?? null,
        },
      });
      variantIdByCode.set(v.code, variant.id);

      await setPrice(defaultListId, variant.id, v.basePrice, 1);
      for (const [minQty, price] of v.tiers ?? []) {
        await setPrice(defaultListId, variant.id, price, minQty);
      }
      if (typeof v.openingStock === 'number' && v.openingStock > 0) {
        variantsNeedingStock.push({ id: variant.id, qty: v.openingStock });
      }
    }
  }

  // ── Stok açılış hareketleri (yalnızca defter boşsa) ──
  const stockCount = await prisma.stockMovement.count();
  if (stockCount === 0 && variantsNeedingStock.length > 0) {
    await prisma.stockMovement.createMany({
      data: variantsNeedingStock.map((s) => ({
        variantId: s.id,
        delta: s.qty,
        reason: 'purchase' as const,
        note: 'Tohum açılış stoğu',
        actorId: admin.id,
      })),
    });
  }

  // ── Örnek müşteri firma + şube + kullanıcı ──
  const customerPhone = '+905321112233';
  const customer = await prisma.organization.upsert({
    where: { slug: 'kadikoy-kahve-evi' },
    update: {},
    create: {
      type: 'customer',
      name: 'Kadıköy Kahve Evi',
      slug: 'kadikoy-kahve-evi',
      taxId: '1234567890',
    },
  });
  const branch =
    (await prisma.branch.findFirst({ where: { orgId: customer.id } })) ??
    (await prisma.branch.create({
      data: { orgId: customer.id, name: 'Merkez Şube', address: 'Kadıköy, İstanbul' },
    }));
  const customerUser = await prisma.user.upsert({
    where: { phone: customerPhone },
    update: {},
    create: { phone: customerPhone, fullName: 'Kadıköy Kahve Evi — Yetkili' },
  });
  await prisma.membership.upsert({
    where: {
      userId_orgId_role: { userId: customerUser.id, orgId: customer.id, role: 'customer_admin' },
    },
    update: { status: 'active' },
    create: {
      userId: customerUser.id,
      orgId: customer.id,
      role: 'customer_admin',
      status: 'active',
    },
  });

  // ── Müşteri grubu + grup üyeliği ──
  const group = await prisma.customerGroup.upsert({
    where: { slug: 'zincir-musteriler' },
    update: {},
    create: { name: 'Zincir Müşteriler', slug: 'zincir-musteriler' },
  });
  await prisma.customerGroupMember.upsert({
    where: { groupId_orgId: { groupId: group.id, orgId: customer.id } },
    update: {},
    create: { groupId: group.id, orgId: customer.id },
  });

  // ── Grup fiyat listesi: Guatemala 1kg indirimli ──
  const groupListId = await ensurePriceList({
    name: 'Zincir Müşteriler Listesi',
    scope: 'customer_group',
    groupId: group.id,
  });
  const gtm1kg = variantIdByCode.get('GTM-ANTIGUA-1KG');
  if (gtm1kg) await setPrice(groupListId, gtm1kg, 445, 1);

  // ── Müşteriye özel liste: Cold Brew 1L özel fiyat ──
  const custListId = await ensurePriceList({
    name: 'Kadıköy Kahve Evi — Özel',
    scope: 'customer',
    orgId: customer.id,
  });
  const cb1l = variantIdByCode.get('CB-KONSANTRE-1L');
  if (cb1l) await setPrice(custListId, cb1l, 199, 1);

  // ── Görünürlük: Kapadokya Espresso Blend yalnızca üreticide ──
  const kpd = await prisma.product.findUnique({ where: { code: 'KPD-ESPRESSO' } });
  if (kpd) {
    const has = await prisma.visibilityRule.findFirst({
      where: { productId: kpd.id, subjectType: 'all', effect: 'deny' },
    });
    if (!has) {
      await prisma.visibilityRule.create({
        data: { productId: kpd.id, subjectType: 'all', subjectId: null, effect: 'deny' },
      });
    }
  }

  console.log('Tohum tamam.');
  console.log(`  Yönetici (üretici): ${adminPhone}`);
  console.log(`  Müşteri yetkilisi:  ${customerPhone} — ${customer.name} / ${branch.name}`);
  console.log(`  ${PRODUCTS.length} ürün, ${variantIdByCode.size} varyant.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
