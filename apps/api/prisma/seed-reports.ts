import { PrismaClient } from '@prisma/client';
import { trSlug } from '@rc/shared';

const prisma = new PrismaClient();

/**
 * Örnek satış/görüşme raporu: ilk satış personeli 10 dükkanla görüşmüş, 5'i anlaşmayla müşteri olmuş.
 * Anlaşanlar için müşteri firma + şube açılır. Idempotent (başlık / slug ile).
 */
const VISITS: { name: string; district: string; won: boolean; note: string }[] = [
  { name: 'Moda Kahve Evi', district: 'Kadıköy', won: true, note: 'Aylık 40 kg çekirdek kahve için anlaşıldı; ilk sipariş gelecek hafta.' },
  { name: 'Çınar Kafe', district: 'Beşiktaş', won: true, note: 'Espresso harmanı tadımı beğenildi, haftalık düzenli sipariş verecekler.' },
  { name: 'Bahçe Pastanesi', district: 'Üsküdar', won: false, note: 'Mevcut tedarikçisiyle sözleşmesi ay sonunda bitiyor; tekrar aranacak.' },
  { name: 'Lale Coffee', district: 'Şişli', won: true, note: 'İki şube için filtre kahve ve süt ürünleri; fiyat listesi kabul edildi.' },
  { name: 'Köşe Büfe', district: 'Bakırköy', won: false, note: 'Hacim düşük, şimdilik ilgilenmedi.' },
  { name: 'Mavi Kapı Cafe', district: 'Beyoğlu', won: true, note: 'Soğuk demleme ürünleri ilgisini çekti; deneme siparişi ardından anlaşma.' },
  { name: 'Sahil Çay Bahçesi', district: 'Maltepe', won: false, note: 'Çay ağırlıklı çalışıyor, kahve ihtiyacı sınırlı.' },
  { name: 'Atölye Roastery Bar', district: 'Kadıköy', won: true, note: 'Barista eğitimi talep etti; aylık düzenli alım için sözleşme imzalandı.' },
  { name: 'Yeşil Vadi Otel Kafesi', district: 'Sarıyer', won: false, note: 'Karar yönetimde; teklif iletildi, dönüş bekleniyor.' },
  { name: 'Tarihi Çarşı Kahvecisi', district: 'Fatih', won: false, note: 'Fiyatı yüksek buldu; ürün numunesi bırakıldı.' },
];

async function main(): Promise<void> {
  const rep = await prisma.membership.findFirst({
    where: { role: 'sales_staff', status: 'active' },
    select: { userId: true, user: { select: { fullName: true } } },
  });
  if (!rep) throw new Error('Aktif satış personeli bulunamadı.');

  let reports = 0;
  let customers = 0;
  for (const [i, v] of VISITS.entries()) {
    const title = `${v.name} (${v.district}) ile görüşme`;
    const exists = await prisma.salesReportEntry.findFirst({ where: { authorId: rep.userId, title } });
    if (!exists) {
      const when = new Date(Date.now() - (VISITS.length - i) * 86_400_000);
      when.setHours(10 + (i % 6), (i * 17) % 60, 0, 0);
      await prisma.salesReportEntry.create({
        data: {
          authorId: rep.userId,
          title,
          body: `${v.won ? 'Anlaşma sağlandı — müşteri olarak eklendi. ' : 'Henüz anlaşma yok. '}${v.note}`,
          occurredAt: when,
        },
      });
      reports++;
    }
    if (v.won) {
      const slug = trSlug(v.name);
      const org = await prisma.organization.findUnique({ where: { slug } });
      if (!org) {
        await prisma.organization.create({
          data: {
            type: 'customer',
            name: v.name,
            slug,
            address: `${v.district}, İstanbul`,
            branches: { create: { name: 'Merkez', address: `${v.district}, İstanbul` } },
          },
        });
        customers++;
      }
    }
  }
  console.log(`${rep.user.fullName ?? 'Satış personeli'}: ${reports} rapor girişi, ${customers} yeni müşteri firma eklendi.`);
}

main().finally(() => prisma.$disconnect());
