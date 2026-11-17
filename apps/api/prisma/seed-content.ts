import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** Müşteri ana sayfası için günün ipuçları (idempotent: aynı metin varsa eklenmez). */
const TIPS: { title: string; body: string }[] = [
  { title: 'Espresso suyu', body: 'Espresso için ideal su sıcaklığı 92–94°C. Daha sıcak su acılık, daha soğuk su ekşilik getirir.' },
  { title: 'Taze öğütün', body: 'Kahveyi demlemeden hemen önce öğütün. Öğütülmüş kahve 15 dakika içinde aromasının büyük kısmını kaybeder.' },
  { title: 'Süt köpürtme', body: 'Sütü 60–65°C’de bırakın. 70°C üzerinde süt tatlılığını kaybeder ve yanık tat verir.' },
  { title: 'Kahveyi saklama', body: 'Çekirdekleri hava almayan, ışıktan uzak bir kapta oda sıcaklığında saklayın; buzdolabı nem ve koku çeker.' },
  { title: 'Tartı kullanın', body: 'Gram bazlı tartım, her fincanda aynı lezzeti yakalamanın en kolay yoludur. Filtre için 1:16 oranıyla başlayın.' },
  { title: 'Makineyi temizleyin', body: 'Grup başlıklarını her gün geri yıkamayla temizleyin; kahve yağı birikmesi acılığın en yaygın nedenidir.' },
  { title: 'Fincanı ısıtın', body: 'Espresso fincanını servis öncesi ısıtın; soğuk fincan kremayı ve aromayı hızla düşürür.' },
  { title: 'Öğütüm ayarı', body: 'Espresso çok hızlı akıyorsa öğütümü inceltin, çok yavaşsa kalınlaştırın. Hedef 25–30 saniyede çift shot.' },
  { title: 'Filtre kâğıdı', body: 'Filtre kâğıdını demlemeden önce sıcak suyla ıslatın; kâğıt tadı kalmaz ve demlik ısınır.' },
  { title: 'Türk kahvesi', body: 'Türk kahvesini kaynamaya bırakmayın; köpük yükselince ocaktan alın, böylece kremalı bir köpük elde edersiniz.' },
  { title: 'Soğuk demleme', body: 'Cold brew için kaba öğütüm ve 1:8 oranı kullanın, buzdolabında 12–16 saat demleyin.' },
  { title: 'Su kalitesi', body: 'Fincanınızın %98’i sudur. Aşırı sert veya klorlu suyu filtreleyin; makineniz ve lezzetiniz teşekkür eder.' },
  { title: 'Latte art', body: 'Latte art için sütü ince, parlak mikro köpükle hazırlayın; büyük kabarcıklar varsa sütü sert bir zemine vurup döndürün.' },
  { title: 'Çekirdek tazeliği', body: 'Kavrum tarihinden sonra 7–21 gün arası çekirdekler en iyi lezzeti verir; taze kavrulmuş kahve gaz çıkarır.' },
];

async function main(): Promise<void> {
  let added = 0;
  for (const t of TIPS) {
    const exists = await prisma.tip.findFirst({ where: { body: t.body } });
    if (!exists) {
      await prisma.tip.create({ data: t });
      added++;
    }
  }
  // Satış personeli iskonto limiti: henüz hiç tanımlanmamışsa varsayılan %5.
  const lim = await prisma.membership.updateMany({
    where: { role: 'sales_staff', maxDiscountPct: 0 },
    data: { maxDiscountPct: 5 },
  });
  console.log(
    `İpucu: ${added} yeni (toplam ${await prisma.tip.count()}), iskonto limiti güncellenen satış personeli: ${lim.count}, reçete: ${await prisma.recipe.count()}`,
  );
}

main().finally(() => prisma.$disconnect());
