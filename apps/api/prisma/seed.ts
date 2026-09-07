import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Asgari tohum: üretici organizasyonu + varsayılan fiyat listesi + bir yönetici.
 * SEED_ADMIN_PHONE ile yönetici telefonunu ver (E.164, +90...).
 */
async function main() {
  const adminPhone = process.env.SEED_ADMIN_PHONE ?? '+905000000000';

  const producer = await prisma.organization.upsert({
    where: { slug: 'roasteryclub' },
    update: {},
    create: { type: 'producer', name: 'RoasteryClub', slug: 'roasteryclub' },
  });

  const defaultList = await prisma.priceList.findFirst({ where: { scope: 'default' } });
  if (!defaultList) {
    await prisma.priceList.create({ data: { name: 'Varsayılan Liste', scope: 'default' } });
  }

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

  console.log(`Tohum tamam. Yönetici telefonu: ${adminPhone}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
