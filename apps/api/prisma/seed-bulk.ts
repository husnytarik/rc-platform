import { PrismaClient, type OrderStatus, type Role, type Uom } from '@prisma/client';
import { trSlug } from '@rc/shared';

const prisma = new PrismaClient();

/**
 * Yoğun kullanım verisi: geniş katalog (görselli), müşteri grupları + iskontolu fiyat listeleri,
 * ~30 müşteri firma, ~75 günlük sipariş trafiği (olay geçmişi + stok hareketleri), destek, duyuru, reçeteler.
 * Önce seed.ts (+ isteğe bağlı seed-demo.ts) çalışmış olmalı. Idempotent: ürünler/fiyatlar/reçeteler upsert,
 * sipariş trafiği yalnızca `seed:bulk-orders` sayacı yoksa üretilir. Deterministik (sabit tohumlu rastgele).
 */

// ── yardımcılar ──────────────────────────────────────────────────────────────
let seedState = 20261116;
const rnd = (): number => {
  seedState = (seedState + 0x6d2b79f5) | 0;
  let t = Math.imul(seedState ^ (seedState >>> 15), 1 | seedState);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const ri = (a: number, b: number): number => a + Math.floor(rnd() * (b - a + 1));
const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rnd() * arr.length)]!;
const chance = (p: number): boolean => rnd() < p;
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const img = (id: string): string => `https://images.unsplash.com/photo-${id}?w=800&q=80&auto=format&fit=crop`;
const r2 = (n: number): number => Math.round(n * 100) / 100;

const IMG = {
  beans: ['1447933601403-0c6688de566e', '1512568400610-62da28bc8a13', '1511537190424-bbbab87ac5eb', '1559056199-641a0ac8b55e'],
  ground: ['1497935586351-b67a49e012bf', '1511920170033-f8396924c348'],
  turkish: ['1504630083234-14187a9df0f5', '1514432324607-a09d9b4aefdd'],
  cold: ['1461023058943-07fcbe16d735', '1517701604599-bb29b565090c'],
  equip: ['1442512595331-e89e73853f31', '1498804103079-a6351b050096', '1495474472287-4d71bcdd2085'],
  milk: ['1534778101976-62847782c213', '1541167760496-1628856ab772', '1485808191679-5f86510681a2'],
  syrup: ['1551024506-0bccd828d307', '1530373239216-42518e6b4063'],
};

// ── Katalog ──────────────────────────────────────────────────────────────────
interface V {
  code: string; name: string; uom: Uom; price: number; min?: number; step?: number;
  content?: number; contentUom?: Uom; low?: number; tiers?: [number, number][]; attrs?: Record<string, string>;
}
interface P { code: string; name: string; cat: string; brand?: string; desc: string; image: string; preorder?: boolean; variants: V[] }

function bean(code: string, name: string, origin: string, notes: string, kg: number, image: string, cat = 'cekirdek-kahve', preorder = false): P {
  return {
    code, name, cat, brand: 'RoasteryClub', image, preorder,
    desc: `${origin}. Tadım notları: ${notes}. Siparişe göre taze kavrulur.`,
    variants: [
      { code: `${code}-250G-CEK`, name: '250 g paket / Çekirdek', uom: 'paket', price: r2(kg * 0.27), min: 6, step: 1, content: 250, contentUom: 'g', low: 24, attrs: { size: '250g', grind: 'bean' } },
      { code: `${code}-250G-OGT`, name: '250 g paket / Öğütülmüş (Filtre)', uom: 'paket', price: r2(kg * 0.27), min: 6, step: 1, content: 250, contentUom: 'g', low: 24, attrs: { size: '250g', grind: 'filter' } },
      { code: `${code}-1KG-CEK`, name: '1 kg / Çekirdek', uom: 'kg', price: kg, min: 1, step: 1, content: 1, contentUom: 'kg', low: 10, tiers: [[10, r2(kg * 0.96)], [25, r2(kg * 0.92)]], attrs: { size: '1kg', grind: 'bean' } },
      { code: `${code}-1KG-OGT`, name: '1 kg / Öğütülmüş (Espresso)', uom: 'kg', price: kg, min: 1, step: 1, content: 1, contentUom: 'kg', low: 10, attrs: { size: '1kg', grind: 'espresso' } },
      { code: `${code}-5KG-KOLI`, name: '5 kg koli / Çekirdek', uom: 'koli', price: r2(kg * 4.8), min: 1, step: 1, content: 5, contentUom: 'kg', low: 2, attrs: { size: '5kg', grind: 'bean' } },
    ],
  };
}

const NEW_PRODUCTS: P[] = [
  bean('ETH-GUJI', 'Etiyopya Guji Natural', 'Etiyopya, Guji Bölgesi, 2100 m, natural işlem', 'yaban mersini, yasemin, bal', 620, IMG.beans[0]!, 'cekirdek-kahve', true),
  bean('COL-HUILA', 'Kolombiya Huila', 'Kolombiya, Huila, 1800 m, yıkanmış', 'karamel, kırmızı elma, kakao', 470, IMG.beans[1]!),
  bean('KEN-AA', 'Kenya AA Kiambu', 'Kenya, Kiambu, 1750 m, yıkanmış', 'frenk üzümü, greyfurt, siyah çay', 590, IMG.beans[2]!),
  bean('CRI-TARRAZU', 'Kosta Rika Tarrazú', 'Kosta Rika, Tarrazú, 1700 m, honey işlem', 'bal, şeftali, fındık', 520, IMG.beans[3]!),
  bean('HND-MARCALA', 'Honduras Marcala', 'Honduras, Marcala, 1500 m', 'çikolata, badem, kuru meyve', 430, IMG.beans[0]!),
  bean('SUM-MANDHELING', 'Sumatra Mandheling', 'Endonezya, Sumatra, 1400 m, ıslak kabuk soyma', 'baharat, tütün, bitter çikolata', 480, IMG.beans[2]!),
  bean('IND-MONSOON', 'Hindistan Monsoon Malabar', 'Hindistan, Malabar, muson rüzgârı işlemi', 'topraksı, baharat, düşük asidite', 410, IMG.beans[1]!),
  bean('PER-ORGANIK', 'Peru Organik', 'Peru, Cajamarca, 1650 m, organik sertifikalı', 'süt çikolatası, portakal kabuğu', 450, IMG.beans[3]!),
  bean('RWA-BOURBON', 'Ruanda Bourbon', 'Ruanda, Nyamasheke, 1900 m', 'kırmızı meyve, şeker kamışı, çiçeksi', 540, IMG.beans[0]!),
  bean('PAN-GEISHA', 'Panama Geisha (Premium)', 'Panama, Boquete, 1900 m, sınırlı üretim', 'yasemin, bergamot, şeftali', 1650, IMG.beans[2]!, 'cekirdek-kahve', true),
  bean('BRZ-CERRADO', 'Brezilya Cerrado Mineiro', 'Brezilya, Cerrado, 1100 m, natural', 'fındık, süt çikolatası, düşük asidite', 400, IMG.beans[1]!),
  bean('BLD-SIGNATURE', 'Signature Espresso Blend', 'Brezilya %50 · Kolombiya %30 · Etiyopya %20', 'bitter çikolata, karamel, kuruyemiş', 440, IMG.ground[0]!, 'espresso-blend'),
  bean('BLD-HOUSE', 'House Filtre Blend', 'Kolombiya %60 · Kosta Rika %40', 'tatlı, dengeli, hafif meyvemsi', 400, IMG.ground[1]!, 'espresso-blend'),
  bean('BLD-DECAF', 'Kafeinsiz Swiss Water', 'Kolombiya, Swiss Water yöntemiyle kafeinsizleştirilmiş', 'kakao, karamel, yumuşak gövde', 520, IMG.ground[0]!, 'espresso-blend'),
  bean('BLD-EVHARMAN', 'Ev Harmanı Klasik', 'Brezilya %70 · Hindistan %30', 'fındık, bitter çikolata, düşük asidite', 380, IMG.ground[1]!, 'espresso-blend'),
  // Türk kahvesi
  ...[
    { code: 'TRK-DIBEK', name: 'Dibek Kahvesi', desc: 'Geleneksel dibek usulü, hafif kavrulmuş; bol köpüklü.', kg: 900, image: IMG.turkish[0]! },
    { code: 'TRK-FINDIK', name: 'Fındıklı Türk Kahvesi', desc: 'Türk kahvesine Giresun fındığı eklenmiş, tatlı ve yuvarlak.', kg: 960, image: IMG.turkish[1]! },
    { code: 'TRK-SAKIZ', name: 'Damla Sakızlı Türk Kahvesi', desc: 'Ege damla sakızıyla aromalandırılmış Türk kahvesi.', kg: 1020, image: IMG.turkish[0]! },
    { code: 'TRK-SADE', name: 'Sade Türk Kahvesi Koyu Kavrum', desc: 'Koyu kavrum, yoğun gövdeli klasik Türk kahvesi.', kg: 840, image: IMG.turkish[1]! },
  ].map<P>((t) => ({
    code: t.code, name: t.name, cat: 'turk-kahvesi', brand: 'RoasteryClub', image: t.image, desc: t.desc,
    variants: [
      { code: `${t.code}-100G`, name: '100 g kutu', uom: 'kutu', price: r2(t.kg * 0.11), min: 6, step: 1, content: 100, contentUom: 'g', low: 24 },
      { code: `${t.code}-250G`, name: '250 g paket', uom: 'paket', price: r2(t.kg * 0.26), min: 4, step: 1, content: 250, contentUom: 'g', low: 12 },
      { code: `${t.code}-500G`, name: '500 g paket', uom: 'paket', price: r2(t.kg * 0.5), min: 2, step: 1, content: 500, contentUom: 'g', low: 8 },
      { code: `${t.code}-1KG`, name: '1 kg', uom: 'kg', price: t.kg, min: 1, step: 1, content: 1, contentUom: 'kg', low: 6, tiers: [[10, r2(t.kg * 0.95)]] },
    ],
  })),
  // Soğuk demleme
  {
    code: 'CB-VANILYA', name: 'Cold Brew Vanilya', cat: 'soguk-demleme', brand: 'RoasteryClub', image: IMG.cold[1]!,
    desc: 'Vanilya aromalı, içime hazır cold brew.',
    variants: [
      { code: 'CB-VANILYA-1L', name: '1 L şişe', uom: 'adet', price: 215, min: 6, step: 1, content: 1, contentUom: 'l', low: 24 },
      { code: 'CB-VANILYA-KOLI6', name: '6\'lı koli', uom: 'koli', price: 1180, min: 1, step: 1, low: 3 },
    ],
  },
  {
    code: 'CB-NITRO', name: 'Nitro Cold Brew Kutu', cat: 'soguk-demleme', brand: 'RoasteryClub', image: IMG.cold[0]!,
    desc: 'Azot gazlı, kremamsı dokulu 330 ml kutu cold brew.',
    variants: [
      { code: 'CB-NITRO-330', name: '330 ml kutu', uom: 'adet', price: 68, min: 24, step: 6, content: 330, contentUom: 'ml', low: 48 },
      { code: 'CB-NITRO-KOLI24', name: '24\'lü koli', uom: 'koli', price: 1550, min: 1, step: 1, low: 3 },
    ],
  },
  {
    code: 'CB-SADE-5L', name: 'Cold Brew Konsantre Bag-in-Box', cat: 'soguk-demleme', brand: 'RoasteryClub', image: IMG.cold[0]!,
    desc: 'Barlar için 10 L bag-in-box konsantre; 1:3 seyreltilir.',
    variants: [{ code: 'CB-SADE-10L', name: '10 L bag-in-box', uom: 'adet', price: 1480, min: 1, step: 1, content: 10, contentUom: 'l', low: 3 }],
  },
  // Süt & şurup
  ...[
    { code: 'MLK-YULAF', name: 'Barista Yulaf Sütü', desc: 'Köpürtmeye uygun barista yulaf içeceği, 1 L.', unit: 78, box: 12 },
    { code: 'MLK-BADEM', name: 'Barista Badem Sütü', desc: 'Köpürtmeye uygun barista badem içeceği, 1 L.', unit: 92, box: 12 },
    { code: 'MLK-LAKTOZSUZ', name: 'Laktozsuz Süt', desc: 'Laktozsuz tam yağlı süt, 1 L.', unit: 46, box: 12 },
  ].map<P>((m) => ({
    code: m.code, name: m.name, cat: 'sut-surup', brand: 'Barista Line', image: IMG.milk[ri(0, 2)]!, desc: m.desc,
    variants: [
      { code: `${m.code}-1L`, name: '1 L', uom: 'adet', price: m.unit, min: 6, step: 1, content: 1, contentUom: 'l', low: 24 },
      { code: `${m.code}-KOLI`, name: `${m.box}'li koli`, uom: 'koli', price: r2(m.unit * m.box * 0.95), min: 1, step: 1, low: 3 },
    ],
  })),
  ...[
    { code: 'SRP-VANILYA', name: 'Vanilya Şurubu', desc: 'Doğal vanilya özlü kahve şurubu.', unit: 215 },
    { code: 'SRP-KARAMEL', name: 'Karamel Şurubu', desc: 'Yoğun tereyağlı karamel aroması.', unit: 215 },
    { code: 'SRP-FINDIK', name: 'Fındık Şurubu', desc: 'Kavrulmuş fındık aromalı şurup.', unit: 215 },
    { code: 'SRP-TARCIN', name: 'Tarçın Şurubu', desc: 'Sıcak içecekler için tarçın şurubu.', unit: 225 },
  ].map<P>((s) => ({
    code: s.code, name: s.name, cat: 'sut-surup', brand: 'Barista Line', image: IMG.syrup[ri(0, 1)]!, desc: s.desc,
    variants: [
      { code: `${s.code}-700`, name: '700 ml şişe', uom: 'adet', price: s.unit, min: 2, step: 1, content: 700, contentUom: 'ml', low: 6 },
      { code: `${s.code}-KOLI6`, name: '6\'lı koli', uom: 'koli', price: r2(s.unit * 6 * 0.94), min: 1, step: 1, low: 2 },
    ],
  })),
  {
    code: 'SOS-CIKOLATA', name: 'Çikolata Sosu', cat: 'sut-surup', brand: 'Barista Line', image: IMG.syrup[1]!,
    desc: 'Mocha ve frappe için yoğun bitter çikolata sosu.',
    variants: [{ code: 'SOS-CIKOLATA-2KG', name: '2 kg pompalı', uom: 'adet', price: 390, min: 1, step: 1, content: 2, contentUom: 'kg', low: 4 }],
  },
  {
    code: 'TOZ-CHAI', name: 'Chai Latte Tozu', cat: 'sut-surup', brand: 'Barista Line', image: IMG.milk[1]!,
    desc: 'Baharatlı chai latte karışımı.',
    variants: [{ code: 'TOZ-CHAI-1KG', name: '1 kg', uom: 'kg', price: 360, min: 1, step: 1, content: 1, contentUom: 'kg', low: 5 }],
  },
  {
    code: 'TOZ-KAKAO', name: 'Barista Kakao Tozu', cat: 'sut-surup', brand: 'Barista Line', image: IMG.milk[1]!,
    desc: 'Sıcak çikolata ve mocha için %22 yağlı kakao tozu.',
    variants: [{ code: 'TOZ-KAKAO-1KG', name: '1 kg', uom: 'kg', price: 320, min: 1, step: 1, content: 1, contentUom: 'kg', low: 5 }],
  },
  // Ekipman & sarf
  ...[
    { code: 'EKP-BARDAK-12OZ', name: 'Karton Bardak 12oz', pack: "50'li paket", price: 215, box: "20'li koli (1000 adet)", boxPrice: 3900 },
    { code: 'EKP-BARDAK-16OZ', name: 'Karton Bardak 16oz', pack: "50'li paket", price: 265, box: "20'li koli (1000 adet)", boxPrice: 4800 },
    { code: 'EKP-KAPAK', name: 'Bardak Kapağı 8-12oz', pack: "100'lü paket", price: 120, box: "10'lu koli (1000 adet)", boxPrice: 1050 },
    { code: 'EKP-CIFT-CIDAR', name: 'Çift Cidarlı Bardak 12oz', pack: "25'li paket", price: 190, box: "40'lı koli (1000 adet)", boxPrice: 6900 },
    { code: 'EKP-KARISTIRICI', name: 'Ahşap Karıştırıcı', pack: "500'lü paket", price: 95, box: "10'lu koli", boxPrice: 880 },
  ].map<P>((e) => ({
    code: e.code, name: e.name, cat: 'ekipman', brand: 'CupLine', image: IMG.equip[2]!, desc: `${e.name} — kafeler için sarf malzemesi.`,
    variants: [
      { code: `${e.code}-PAKET`, name: e.pack, uom: 'paket', price: e.price, min: 2, step: 1, low: 10 },
      { code: `${e.code}-KOLI`, name: e.box, uom: 'koli', price: e.boxPrice, min: 1, step: 1, low: 2 },
    ],
  })),
  ...[
    { code: 'EKP-CHEMEX-FILTRE', name: 'Chemex Filtre Kağıdı', price: 8.5, unit: 'Tek kağıt (100\'lük kutu)', box: 100, img: IMG.equip[0]! },
    { code: 'EKP-TEMIZLIK-TABLET', name: 'Espresso Makinesi Temizlik Tableti', price: 6.2, unit: 'Tablet (100\'lük kutu)', box: 100, img: IMG.equip[1]! },
  ].map<P>((e) => ({
    code: e.code, name: e.name, cat: 'ekipman', brand: 'CupLine', image: e.img, desc: `${e.name}.`,
    variants: [
      { code: `${e.code}-TEK`, name: 'Tek adet', uom: 'adet', price: e.price, min: 50, step: 10, low: 100 },
      { code: `${e.code}-KUTU`, name: e.unit, uom: 'kutu', price: r2(e.price * e.box * 0.92), min: 1, step: 1, low: 3 },
    ],
  })),
  ...[
    { code: 'EKP-TAMPER-58', name: 'Tamper 58 mm Paslanmaz', price: 650 },
    { code: 'EKP-SUT-POTU-600', name: 'Süt Potu 600 ml', price: 420 },
    { code: 'EKP-TERAZI', name: 'Barista Terazisi (zamanlayıcılı)', price: 1450 },
    { code: 'EKP-KNOCKBOX', name: 'Knock Box Silikon', price: 780 },
    { code: 'EKP-V60-SERAMIK', name: 'V60 Seramik Dripper 02', price: 590 },
  ].map<P>((e) => ({
    code: e.code, name: e.name, cat: 'ekipman', brand: 'BaristaPro', image: IMG.equip[ri(0, 1)]!, desc: `${e.name}. Profesyonel bar ekipmanı.`,
    variants: [{ code: `${e.code}-1`, name: 'Tek adet', uom: 'adet', price: e.price, min: 1, step: 1, low: 3 }],
  })),
];

const NEW_CATEGORIES = [
  { slug: 'espresso-blend', name: 'Espresso & Filtre Blend', sortOrder: 15 },
  { slug: 'sut-surup', name: 'Süt, Şurup & Soslar', sortOrder: 45 },
];

// Mevcut 8 ürüne görsel
const EXISTING_IMAGES: Record<string, string> = {
  'GTM-ANTIGUA': IMG.beans[1]!, 'BRZ-SANTOS': IMG.beans[2]!, 'KPD-ESPRESSO': IMG.ground[0]!, 'TRK-ORTA': IMG.turkish[0]!,
  'CB-KONSANTRE': IMG.cold[0]!, 'YENI-HASAT': IMG.beans[0]!, 'EKP-BARDAK-8OZ': IMG.equip[2]!, 'EKP-FILTRE-V60': IMG.equip[0]!,
};

// ── Reçeteler ────────────────────────────────────────────────────────────────
interface R {
  slug: string; title: string; subtitle: string; description: string; image: string; category: string;
  prep: number; servings: number; difficulty: string; ingredients: string[]; steps: string[]; tip: string; product?: string;
}
const RECIPES: R[] = [
  { slug: 'flat-white', title: 'Flat White', subtitle: 'Yoğun espresso, ipek gibi süt', description: 'Çift shot espresso ile mikro köpüklü sütün dengesi; latteden daha güçlü kahve tadı.', image: '1485808191679-5f86510681a2', category: 'Sütlü', prep: 5, servings: 1, difficulty: 'orta', ingredients: ['18 g Signature Espresso Blend (öğütülmüş)', '36 g espresso (çift shot)', '120 ml soğuk tam yağlı süt'], steps: ['Portafiltreye 18 g kahveyi doldurun, tamperlayın.', '25-28 saniyede 36 g espresso çekin.', 'Sütü 60-65°C\'ye kadar ince mikro köpükle buharlayın.', 'Espressonun üzerine sütü ince bir akışla dökün, 160-180 ml\'lik seramik fincanda servis edin.'], tip: 'Süt köpüğü parlak ve akışkan olmalı; kabarık köpük flat white\'ı latteye çevirir.', product: 'BLD-SIGNATURE' },
  { slug: 'caffe-latte', title: 'Caffè Latte', subtitle: 'Klasik, yumuşak içimli', description: 'Tek shot espresso ve bol buharlanmış süt; üstünde ince köpük.', image: '1541167760496-1628856ab772', category: 'Sütlü', prep: 5, servings: 1, difficulty: 'kolay', ingredients: ['18 g Ev Harmanı Klasik', '36 g espresso', '200 ml süt'], steps: ['Espressoyu çekip büyük bir fincana alın.', 'Sütü 60-65°C\'ye buharlayın.', 'Sütü ortadan başlayıp dökün, sonunda kalp veya yaprak çizin.'], tip: 'Süt kaynamasın; 70°C üstünde tatlılığını kaybeder.', product: 'BLD-EVHARMAN' },
  { slug: 'cappuccino', title: 'Cappuccino', subtitle: 'Eşit parça espresso, süt ve köpük', description: 'Kalın ve kadifemsi köpüğüyle klasik İtalyan sabah kahvesi.', image: '1509042239860-f550ce710b93', category: 'Sütlü', prep: 5, servings: 1, difficulty: 'orta', ingredients: ['18 g Signature Espresso Blend', '36 g espresso', '100 ml süt', 'Tozlamak için kakao (isteğe bağlı)'], steps: ['Espressoyu 150 ml\'lik fincana çekin.', 'Sütü daha uzun havalandırarak kalın köpük hazırlayın.', 'Sütü dökün, köpüğü kaşıkla üste yönlendirin; üstüne kakao serpin.'], tip: 'Köpük kalınlığı fincanın üçte biri kadar olmalı.', product: 'BLD-SIGNATURE' },
  { slug: 'iced-latte', title: 'Iced Latte', subtitle: 'Yaz günleri için buzlu latte', description: 'Soğuk süt ve buzun üzerine çift espresso; isteğe göre şuruplanır.', image: '1517701604599-bb29b565090c', category: 'Soğuk', prep: 4, servings: 1, difficulty: 'kolay', ingredients: ['36 g espresso (çift shot)', '150 ml soğuk süt', 'Bardak dolusu buz', '15 ml vanilya şurubu (isteğe bağlı)'], steps: ['Bardağı buzla doldurun, şurubu ekleyin.', 'Soğuk sütü üzerine ekleyin.', 'Espressoyu yavaşça dökün ve karıştırmadan servis edin.'], tip: 'Espressoyu önce 1 dk soğutmak buzun hızla erimesini önler.', product: 'SRP-VANILYA' },
  { slug: 'cold-brew-evde', title: 'Cold Brew (12 saat)', subtitle: 'Düşük asiditeli, tatlı soğuk demleme', description: 'Kaba öğütülmüş kahveyi soğuk suda yavaşça demleyerek elde edilen yumuşak kahve konsantresi.', image: '1461023058943-07fcbe16d735', category: 'Soğuk', prep: 15, servings: 6, difficulty: 'kolay', ingredients: ['100 g kaba öğütülmüş Kolombiya Huila', '1 L soğuk filtre su', 'Buz ve süt (servis için)'], steps: ['Kahve ve suyu bir kavanozda karıştırın.', 'Buzdolabında 12-16 saat bekletin.', 'İnce süzgeç ve filtre kağıdıyla süzün.', 'Buz üzerinde 1:1 su veya sütle seyrelterek servis edin.'], tip: 'Konsantre buzdolabında 7 güne kadar saklanır.', product: 'COL-HUILA' },
  { slug: 'mocha-frappe', title: 'Mocha Frappe', subtitle: 'Çikolatalı, kremalı buzlu içecek', description: 'Espresso, çikolata sosu ve buzun blenderda buluştuğu tatlı içecek.', image: '1530373239216-42518e6b4063', category: 'Soğuk', prep: 6, servings: 1, difficulty: 'kolay', ingredients: ['36 g espresso', '30 g çikolata sosu', '150 ml süt', '200 g buz', 'Krem şanti ve sos (süsleme)'], steps: ['Espresso, sos, süt ve buzu blenderda 20-30 sn çekin.', 'Bardağın kenarına sos çizin, frappeyi dökün.', 'Üzerine krem şanti ve çikolata sosu ekleyin.'], tip: 'Buzu az kullanıp dondurulmuş süt küpleri eklemek tadı sulandırmaz.', product: 'SOS-CIKOLATA' },
  { slug: 'affogato', title: 'Affogato', subtitle: 'Dondurma üzerine sıcak espresso', description: 'Tatlı ile kahvenin en sade buluşması; dakikalar içinde hazır.', image: '1551024506-0bccd828d307', category: 'Tatlı', prep: 3, servings: 1, difficulty: 'kolay', ingredients: ['1 top vanilyalı dondurma', '36 g sıcak espresso', 'Kıyılmış fındık veya bitter çikolata'], steps: ['Dondurmayı soğutulmuş bir bardağa alın.', 'Espressoyu hemen üzerine dökün.', 'Fındık veya rendelenmiş çikolata ile servis edin.'], tip: 'Espresso dondurmayı tamamen eritmesin; servis anında dökün.', product: 'BLD-SIGNATURE' },
  { slug: 'turk-kahvesi', title: 'Geleneksel Türk Kahvesi', subtitle: 'Cezvede, bol köpüklü', description: 'Soğuk su ve ince öğütülmüş kahveyle kısık ateşte pişen, UNESCO listesindeki geleneksel içecek.', image: '1514432324607-a09d9b4aefdd', category: 'Geleneksel', prep: 8, servings: 1, difficulty: 'orta', ingredients: ['1 kahve fincanı soğuk su (~70 ml)', '2 tatlı kaşığı Türk kahvesi', 'İsteğe göre şeker'], steps: ['Cezveye su, kahve ve şekeri koyup karıştırmadan kısık ateşe alın.', 'Kenarlardan kabarmaya başlayınca ocaktan alın, köpüğü fincana paylaştırın.', 'Cezveyi tekrar ateşe alıp ikinci kabarmada fincana dökün.', 'Lokum ve bir bardak su ile servis edin.'], tip: 'Karıştırmayın ve kaynatmayın; köpük kaybolur.', product: 'TRK-DIBEK' },
  { slug: 'v60-filtre', title: 'V60 Filtre Kahve', subtitle: 'Temiz, parlak, meyvemsi', description: 'Tek mense kahvelerin notalarını öne çıkaran pour-over yöntemi.', image: '1442512595331-e89e73853f31', category: 'Filtre', prep: 6, servings: 1, difficulty: 'zor', ingredients: ['15 g orta-ince öğütülmüş Etiyopya Guji', '250 ml su (93°C)', 'V60 02 dripper ve filtre kağıdı'], steps: ['Filtre kağıdını ısıtın, suyu boşaltın.', 'Kahveyi koyup 45 ml suyla 30-40 sn çiçeklendirin (bloom).', 'Kalan suyu dairesel hareketlerle 3 aşamada ekleyin; toplam süre 2:45-3:15.', 'Karıştırıp servis edin.'], tip: 'Öğütme çok incelirse akış yavaşlar ve acılık artar; bir adım kabalaştırın.', product: 'ETH-GUJI' },
  { slug: 'kahveli-panna-cotta', title: 'Kahveli Panna Cotta', subtitle: 'Pastaneler için kahveli tatlı', description: 'Espresso aromalı, kadifemsi İtalyan sütlü tatlısı; çilek veya karamel sosla servis edilir.', image: '1488477181946-6428a0291777', category: 'Tatlı', prep: 20, servings: 6, difficulty: 'orta', ingredients: ['400 ml krema', '200 ml süt', '60 g şeker', '60 ml demlenmiş sıcak espresso', '2 yaprak jelatin', 'Çilek veya karamel sos'], steps: ['Jelatini soğuk suda yumuşatın.', 'Krema, süt ve şekeri ısıtıp espressoyu ekleyin; kaynamasın.', 'Süzülmüş jelatini ekleyip eriyene dek karıştırın.', 'Kaselere paylaştırın, 4 saat buzdolabında dinlendirin.', 'Çilek veya karamel sosla servis edin.'], tip: 'Kaseleri bir gün önceden hazırlamak kıvamı oturtur.', product: 'BLD-DECAF' },
  { slug: 'cortado', title: 'Cortado', subtitle: 'Espresso + eşit miktarda süt', description: 'Asiditeyi sütle kıran, küçük hacimli ve yoğun İspanyol kahvesi.', image: '1572442388796-11668a67e53d', category: 'Sütlü', prep: 4, servings: 1, difficulty: 'kolay', ingredients: ['36 g espresso', '40 ml sıcak süt (az köpüklü)'], steps: ['Espressoyu küçük bir cam bardağa çekin.', 'Sütü az köpükle buharlayın.', 'Eşit miktarda sütü dökerek servis edin.'], tip: 'Süt köpüksüze yakın olmalı; cortado "kesilmiş" anlamına gelir.', product: 'BLD-SIGNATURE' },
  { slug: 'karamelli-macchiato', title: 'Karamelli Macchiato', subtitle: 'Vanilya, süt, espresso ve karamel', description: 'Kafelerin en çok satan şuruplu sıcak içeceklerinden.', image: '1534778101976-62847782c213', category: 'Sütlü', prep: 6, servings: 1, difficulty: 'kolay', ingredients: ['15 ml vanilya şurubu', '200 ml buharlanmış süt', '36 g espresso', 'Karamel sos'], steps: ['Bardağa şurubu ve buharlanmış sütü ekleyin.', 'Köpüğün ortasına espressoyu yavaşça dökün.', 'Üzerine karamel sosu ızgara şeklinde çizin.'], tip: 'Espresso en son eklenir; böylece üstte kahve halkası oluşur.', product: 'SRP-KARAMEL' },
];

// ── Müşteriler ───────────────────────────────────────────────────────────────
type Seg = 'kafe' | 'otel' | 'restoran' | 'ofis' | 'zincir';
interface C { slug: string; name: string; seg: Seg; city: string; branches: string[]; weight: number; discount?: number }
const C_LIST: C[] = [
  { slug: 'kuzey-roast-cafe', name: 'Kuzey Roast Cafe', seg: 'kafe', city: 'Ankara', branches: ['Kızılay'], weight: 3 },
  { slug: 'bogaz-manzara-cafe', name: 'Boğaz Manzara Cafe', seg: 'kafe', city: 'İstanbul', branches: ['Bebek'], weight: 4, discount: 7 },
  { slug: 'antik-han-kahvecisi', name: 'Antik Han Kahvecisi', seg: 'kafe', city: 'İstanbul', branches: ['Sultanahmet'], weight: 2 },
  { slug: 'mavi-fincan', name: 'Mavi Fincan', seg: 'kafe', city: 'Bodrum', branches: ['Merkez'], weight: 2 },
  { slug: 'zeytin-dali-kafe', name: 'Zeytin Dalı Kafe', seg: 'kafe', city: 'Ayvalık', branches: ['Çarşı'], weight: 2 },
  { slug: 'pera-coffee-lab', name: 'Pera Coffee Lab', seg: 'kafe', city: 'İstanbul', branches: ['Beyoğlu', 'Cihangir'], weight: 5, discount: 9 },
  { slug: 'tarcin-pastane-kafe', name: 'Tarçın Pastane & Kafe', seg: 'kafe', city: 'Eskişehir', branches: ['Odunpazarı'], weight: 2 },
  { slug: 'kavrum-atolyesi', name: 'Kavrum Atölyesi', seg: 'kafe', city: 'Bursa', branches: ['Nilüfer'], weight: 3, discount: 6 },
  { slug: 'liman-kahve', name: 'Liman Kahve', seg: 'kafe', city: 'İzmir', branches: ['Konak', 'Karşıyaka'], weight: 4 },
  { slug: 'kalem-kitap-kafe', name: 'Kalem Kitap Kafe', seg: 'kafe', city: 'Ankara', branches: ['Tunalı'], weight: 1 },
  { slug: 'cumba-kahve', name: 'Cumba Kahve', seg: 'kafe', city: 'Safranbolu', branches: ['Çarşı'], weight: 1 },
  { slug: 'teras-brunch', name: 'Teras Brunch', seg: 'restoran', city: 'İstanbul', branches: ['Nişantaşı'], weight: 3 },
  { slug: 'dag-evi-kafe', name: 'Dağ Evi Kafe', seg: 'kafe', city: 'Bolu', branches: ['Abant'], weight: 1 },
  { slug: 'gokada-coworking', name: 'Gökada Coworking', seg: 'ofis', city: 'İstanbul', branches: ['Levent'], weight: 2 },
  { slug: 'mozaik-otel', name: 'Mozaik Otel', seg: 'otel', city: 'Antalya', branches: ['Ana Bina', 'Plaj Bar'], weight: 5, discount: 8 },
  { slug: 'sultan-termal-otel', name: 'Sultan Termal Otel', seg: 'otel', city: 'Bursa', branches: ['Ana Bina'], weight: 4 },
  { slug: 'ege-butik-otel', name: 'Ege Butik Otel', seg: 'otel', city: 'Çeşme', branches: ['Alaçatı'], weight: 3 },
  { slug: 'kapadokya-magara-otel', name: 'Kapadokya Mağara Otel', seg: 'otel', city: 'Nevşehir', branches: ['Göreme'], weight: 3, discount: 5 },
  { slug: 'anadolu-lokantasi', name: 'Anadolu Lokantası', seg: 'restoran', city: 'Konya', branches: ['Merkez'], weight: 2 },
  { slug: 'deniz-yildizi-restoran', name: 'Deniz Yıldızı Restoran', seg: 'restoran', city: 'Mersin', branches: ['Marina'], weight: 2 },
  { slug: 'orman-kosku-restoran', name: 'Orman Köşkü Restoran', seg: 'restoran', city: 'Sapanca', branches: ['Göl Kenarı'], weight: 2 },
  { slug: 'yesil-vadi-kantin', name: 'Yeşil Vadi Kampüs Kantini', seg: 'ofis', city: 'Ankara', branches: ['Kampüs'], weight: 3 },
  { slug: 'atlas-holding-ofis', name: 'Atlas Holding Ofis', seg: 'ofis', city: 'İstanbul', branches: ['Maslak', 'Ataşehir'], weight: 3, discount: 10 },
  { slug: 'nova-teknoloji-ofis', name: 'Nova Teknoloji Ofis', seg: 'ofis', city: 'İzmir', branches: ['Teknopark'], weight: 2 },
  { slug: 'bulvar-zincir-kafe', name: 'Bulvar Zincir Kafe A.Ş.', seg: 'zincir', city: 'İstanbul', branches: ['Kadıköy', 'Şişli', 'Üsküdar'], weight: 8 },
  { slug: 'kahve-duragi-zincir', name: 'Kahve Durağı Zincir', seg: 'zincir', city: 'Ankara', branches: ['Çankaya', 'Bahçelievler', 'Ulus', 'Etimesgut'], weight: 9, discount: 6 },
  { slug: 'mola-express', name: 'Mola Express', seg: 'zincir', city: 'İstanbul', branches: ['Havalimanı', 'Metrocity', 'Kozyatağı'], weight: 7 },
  { slug: 'rihtim-cafe-bar', name: 'Rıhtım Cafe & Bar', seg: 'kafe', city: 'İzmir', branches: ['Alsancak'], weight: 3 },
  { slug: 'firin-sokagi-pastanesi', name: 'Fırın Sokağı Pastanesi', seg: 'kafe', city: 'Adana', branches: ['Seyhan'], weight: 2 },
  { slug: 'tas-mektep-kafe', name: 'Taş Mektep Kafe', seg: 'kafe', city: 'Kayseri', branches: ['Merkez'], weight: 1 },
];
const FIRST = ['Ahmet', 'Elif', 'Mehmet', 'Zeynep', 'Mustafa', 'Ayşe', 'Emre', 'Selin', 'Burak', 'Deniz', 'Ece', 'Kerem', 'Gamze', 'Onur', 'Pınar', 'Cem', 'Seda', 'Tolga', 'Melis', 'Barış'];
const LAST = ['Yılmaz', 'Kaya', 'Demir', 'Şahin', 'Çelik', 'Yıldız', 'Aydın', 'Özdemir', 'Arslan', 'Doğan', 'Kılıç', 'Aslan', 'Çetin', 'Koç', 'Kurt', 'Özkan', 'Şimşek', 'Polat', 'Erdem', 'Güneş'];

const GROUPS: { slug: string; name: string; pct: number; segs: Seg[] }[] = [
  { slug: 'horeca-otel-restoran', name: 'HoReCa (Otel & Restoran)', pct: 10, segs: ['otel', 'restoran'] },
  { slug: 'kafe-bar', name: 'Kafe & Bar', pct: 5, segs: ['kafe'] },
  { slug: 'kurumsal-ofis', name: 'Kurumsal & Ofis', pct: 8, segs: ['ofis'] },
  { slug: 'zincir-musteriler', name: 'Zincir Müşteriler', pct: 12, segs: ['zincir'] },
];

const DISCOUNTABLE = new Set(['cekirdek-kahve', 'espresso-blend', 'turk-kahvesi', 'soguk-demleme', 'sut-surup']);

async function main(): Promise<void> {
  const producer = await prisma.organization.findUnique({ where: { slug: 'roasteryclub' } });
  if (!producer) throw new Error('Önce seed.ts çalıştırılmalı.');
  const adminM = await prisma.membership.findFirst({ where: { orgId: producer.id, role: 'producer_admin' }, select: { userId: true } });
  const adminId = adminM?.userId ?? null;

  // ── Kategoriler ──
  for (const c of NEW_CATEGORIES) {
    await prisma.category.upsert({ where: { slug: c.slug }, update: { name: c.name, sortOrder: c.sortOrder }, create: c });
  }
  const cats = new Map((await prisma.category.findMany()).map((c) => [c.slug, c.id]));

  // ── Mevcut ürünlere görsel ──
  for (const [code, id] of Object.entries(EXISTING_IMAGES)) {
    await prisma.product.updateMany({ where: { code }, data: { imageUrl: img(id) } });
  }

  // ── Yeni ürünler + varyantlar + varsayılan fiyat ──
  const defaultList = (await prisma.priceList.findFirst({ where: { scope: 'default' } })) ?? (await prisma.priceList.create({ data: { name: 'Varsayılan Liste', scope: 'default' } }));
  const variantMeta = new Map<string, { id: string; code: string; price: number; cat: string; uom: Uom; min: number; step: number }>();
  let pCount = 0;
  for (const p of NEW_PRODUCTS) {
    const product = await prisma.product.upsert({
      where: { code: p.code },
      update: { name: p.name, categoryId: cats.get(p.cat), brand: p.brand, description: p.desc, imageUrl: img(p.image), allowPreorder: p.preorder ?? false },
      create: { code: p.code, name: p.name, slug: trSlug(p.name), categoryId: cats.get(p.cat), brand: p.brand, description: p.desc, imageUrl: img(p.image), allowPreorder: p.preorder ?? false },
    });
    pCount++;
    for (const v of p.variants) {
      const data = {
        name: v.name, orderUom: v.uom, basePrice: v.price, minOrderQty: v.min ?? 1, qtyStep: v.step ?? 1,
        contentAmount: v.content ?? null, contentUom: v.contentUom ?? null, lowStockThreshold: v.low ?? null, attributes: v.attrs ?? undefined,
      };
      const row = await prisma.productVariant.upsert({
        where: { code: v.code }, update: data, create: { productId: product.id, code: v.code, ...data },
      });
      variantMeta.set(v.code, { id: row.id, code: v.code, price: v.price, cat: p.cat, uom: v.uom, min: v.min ?? 1, step: v.step ?? 1 });
      const items: [number, number][] = [[1, v.price], ...(v.tiers ?? [])];
      for (const [minQty, price] of items) {
        const ex = await prisma.priceListItem.findFirst({ where: { priceListId: defaultList.id, variantId: row.id, minQty } });
        if (ex) await prisma.priceListItem.update({ where: { id: ex.id }, data: { price } });
        else await prisma.priceListItem.create({ data: { priceListId: defaultList.id, variantId: row.id, minQty, price } });
      }
    }
  }
  // mevcut varyantları da sipariş havuzuna ekle
  const existingVariants = await prisma.productVariant.findMany({ where: { code: { notIn: [...variantMeta.keys()] }, isActive: true }, include: { product: { include: { category: true } } } });
  for (const v of existingVariants) {
    if (v.product.code === 'KPD-ESPRESSO') continue; // görünürlükte gizli
    variantMeta.set(v.code, { id: v.id, code: v.code, price: Number(v.basePrice), cat: v.product.category?.slug ?? 'ekipman', uom: v.orderUom, min: Number(v.minOrderQty), step: Number(v.qtyStep) });
  }

  // ── Müşteri firmalar + şubeler + kullanıcılar ──
  const orgBySlug = new Map<string, { id: string; branches: string[]; users: string[]; seg: Seg; weight: number }>();
  let phoneN = 1;
  for (const c of C_LIST) {
    const org = await prisma.organization.upsert({
      where: { slug: c.slug },
      update: { name: c.name },
      create: { type: 'customer', name: c.name, slug: c.slug, taxId: String(ri(1000000000, 9999999999)), phone: `+90216${ri(1000000, 9999999)}`, address: `${c.city} / ${c.branches[0]}` },
    });
    const branchIds: string[] = [];
    for (const b of c.branches) {
      const row = (await prisma.branch.findFirst({ where: { orgId: org.id, name: b } })) ?? (await prisma.branch.create({ data: { orgId: org.id, name: b, address: `${b}, ${c.city}` } }));
      branchIds.push(row.id);
    }
    const users: string[] = [];
    const memberDefs: { role: Role; scope: boolean }[] = [{ role: 'customer_admin', scope: false }];
    if (c.branches.length > 1) memberDefs.push({ role: 'branch_manager', scope: true });
    if (chance(0.4)) memberDefs.push({ role: 'customer_user', scope: false });
    for (const m of memberDefs) {
      const phone = `+9055531${String(phoneN++).padStart(5, '0')}`;
      const user = await prisma.user.upsert({
        where: { provider_providerUserId: { provider: 'phone', providerUserId: phone } },
        update: {},
        create: { provider: 'phone', providerUserId: phone, phone, fullName: `${pick(FIRST)} ${pick(LAST)}`, lastLoginAt: new Date(Date.now() - ri(0, 6) * DAY) },
      });
      await prisma.membership.upsert({
        where: { userId_orgId_role: { userId: user.id, orgId: org.id, role: m.role } },
        update: { status: 'active' },
        create: { userId: user.id, orgId: org.id, role: m.role, status: 'active', branchScope: m.scope ? [branchIds[0]!] : undefined },
      });
      users.push(user.id);
    }
    orgBySlug.set(c.slug, { id: org.id, branches: branchIds, users, seg: c.seg, weight: c.weight });
  }

  // ── Müşteri grupları + iskontolu fiyat listeleri ──
  const discountVariants = [...variantMeta.values()].filter((v) => DISCOUNTABLE.has(v.cat));
  const groupPct = new Map<string, number>(); // orgId -> grup iskonto %
  const groupMeta = new Map<string, number>();
  for (const g of GROUPS) {
    const group = await prisma.customerGroup.upsert({ where: { slug: g.slug }, update: { name: g.name }, create: { slug: g.slug, name: g.name } });
    const list = (await prisma.priceList.findFirst({ where: { scope: 'customer_group', groupId: group.id } })) ?? (await prisma.priceList.create({ data: { name: `${g.name} Listesi`, scope: 'customer_group', groupId: group.id } }));
    await prisma.priceListItem.deleteMany({ where: { priceListId: list.id } });
    await prisma.priceListItem.createMany({ data: discountVariants.map((v) => ({ priceListId: list.id, variantId: v.id, minQty: 1, price: r2(v.price * (1 - g.pct / 100)) })) });
    groupMeta.set(g.slug, g.pct);
    for (const c of C_LIST.filter((x) => g.segs.includes(x.seg))) {
      const o = orgBySlug.get(c.slug)!;
      await prisma.customerGroupMember.upsert({ where: { groupId_orgId: { groupId: group.id, orgId: o.id } }, update: {}, create: { groupId: group.id, orgId: o.id } });
      groupPct.set(o.id, g.pct);
    }
  }
  // Müşteriye özel (ek iskontolu) listeler
  const customerPct = new Map<string, number>();
  for (const c of C_LIST.filter((x) => x.discount)) {
    const o = orgBySlug.get(c.slug)!;
    const list = (await prisma.priceList.findFirst({ where: { scope: 'customer', orgId: o.id } })) ?? (await prisma.priceList.create({ data: { name: `${c.name} — Özel`, scope: 'customer', orgId: o.id } }));
    await prisma.priceListItem.deleteMany({ where: { priceListId: list.id } });
    const total = c.discount! + (groupPct.get(o.id) ?? 0); // özel liste gruptan daha derin
    await prisma.priceListItem.createMany({ data: discountVariants.map((v) => ({ priceListId: list.id, variantId: v.id, minQty: 1, price: r2(v.price * (1 - total / 100)) })) });
    customerPct.set(o.id, total);
  }
  const effectivePct = (orgId: string, cat: string): number => (DISCOUNTABLE.has(cat) ? (customerPct.get(orgId) ?? groupPct.get(orgId) ?? 0) : 0);

  // ── Reçeteler ──
  for (const [i, r] of RECIPES.entries()) {
    const data = { title: r.title, subtitle: r.subtitle, description: r.description, imageUrl: img(r.image), category: r.category, prepMinutes: r.prep, servings: r.servings, difficulty: r.difficulty, ingredients: r.ingredients, steps: r.steps, tip: r.tip, productCode: r.product ?? null, sortOrder: i };
    await prisma.recipe.upsert({ where: { slug: r.slug }, update: data, create: { slug: r.slug, ...data } });
  }

  // ── Sipariş trafiği (yalnız bir kez) ──
  const marker = await prisma.counter.findUnique({ where: { key: 'seed:bulk-orders' } });
  let orderCount = 0;
  if (!marker) {
    const now = Date.now();
    const customers = C_LIST.map((c) => ({ c, o: orgBySlug.get(c.slug)! }));
    const pool: typeof customers = [];
    for (const x of customers) for (let i = 0; i < x.c.weight; i++) pool.push(x);
    const byCat = (cats_: string[]) => [...variantMeta.values()].filter((v) => cats_.includes(v.cat));
    const coffeeV = byCat(['cekirdek-kahve', 'espresso-blend']);
    const turkV = byCat(['turk-kahvesi']);
    const coldV = byCat(['soguk-demleme']);
    const milkV = byCat(['sut-surup']);
    const equipV = byCat(['ekipman']);

    interface Plan { at: number; cust: (typeof customers)[number]; status: OrderStatus }
    const plans: Plan[] = [];
    for (let d = 75; d >= 0; d--) {
      const dt = new Date(now - d * DAY);
      const dow = dt.getDay();
      const n = dow === 0 ? ri(0, 1) : dow === 6 ? ri(1, 3) : ri(3, 6);
      for (let k = 0; k < n; k++) {
        const at = now - d * DAY - ri(0, 11) * HOUR - ri(0, 59) * 60_000;
        const age = (now - at) / DAY;
        let status: OrderStatus;
        const x = rnd();
        if (age > 14) status = x < 0.9 ? 'delivered' : x < 0.96 ? 'cancelled' : 'delivery_issue';
        else if (age > 7) status = x < 0.62 ? 'delivered' : x < 0.78 ? 'in_transit' : x < 0.9 ? 'ready_to_ship' : x < 0.96 ? 'cancelled' : 'on_hold';
        else if (age > 3) status = x < 0.3 ? 'delivered' : x < 0.5 ? 'in_transit' : x < 0.66 ? 'ready_to_ship' : x < 0.8 ? 'in_production' : x < 0.9 ? 'confirmed' : x < 0.95 ? 'on_hold' : 'cancelled';
        else if (age > 1) status = x < 0.2 ? 'in_transit' : x < 0.4 ? 'in_production' : x < 0.65 ? 'confirmed' : x < 0.85 ? 'placed' : 'production_done';
        else status = x < 0.5 ? 'placed' : x < 0.8 ? 'confirmed' : 'in_production';
        plans.push({ at, cust: pick(pool), status });
      }
    }
    plans.sort((a, b) => a.at - b.at);

    const year = new Date().getFullYear();
    const ctr = await prisma.counter.findUnique({ where: { key: `order:${year}` } });
    let seq = Number(ctr?.value ?? 0);
    const reserved = new Map<string, number>(); // variantId -> toplam rezerve
    const reserveMoves: { variantId: string; delta: number; refOrderId: string; at: Date }[] = [];

    const CHAIN: OrderStatus[] = ['placed', 'confirmed', 'in_production', 'production_done', 'ready_to_ship', 'in_transit', 'delivered'];
    const GAP: Record<string, [number, number]> = { confirmed: [1, 8], in_production: [3, 18], production_done: [6, 24], ready_to_ship: [1, 6], in_transit: [2, 12], delivered: [6, 30] };

    for (const plan of plans) {
      const { c, o } = plan.cust;
      const placer = pick(o.users);
      const branchId = pick(o.branches);
      // sepet
      const nLines = ri(1, c.seg === 'zincir' ? 7 : 5);
      const chosen = new Map<string, (typeof coffeeV)[number]>();
      const add = (arr: typeof coffeeV, n: number): void => { for (let i = 0; i < n; i++) { const v = pick(arr); chosen.set(v.id, v); } };
      add(c.seg === 'ofis' ? [...coffeeV, ...equipV] : coffeeV, Math.max(1, Math.ceil(nLines / 2)));
      if (nLines > 2 && chance(0.4)) add(turkV, 1);
      if (nLines > 2 && chance(0.35)) add(coldV, 1);
      if (nLines > 3 && chance(0.6)) add(milkV, 1 + ri(0, 1));
      if (nLines > 3 && chance(0.5)) add(equipV, 1);
      const lines = [...chosen.values()].slice(0, 8).map((v) => {
        const top = v.uom === 'koli' ? ri(1, 5) : v.uom === 'kg' ? ri(2, 25) : v.uom === 'paket' || v.uom === 'kutu' ? ri(1, 8) : ri(1, 10);
        const qty = v.min + v.step * (top - 1);
        const disc = effectivePct(o.id, v.cat);
        const unit = r2(v.price * (1 - disc / 100));
        return { v, qty, unit, total: r2(unit * qty) };
      });
      const subtotal = r2(lines.reduce((s, l) => s + l.total, 0));
      const hasDiscount = chance(0.18);
      const discPct = hasDiscount ? pick([3, 5, 10]) : 0;
      const discountAmount = r2((subtotal * discPct) / 100);
      const total = r2(subtotal - discountAmount);

      const created = new Date(plan.at);
      seq++;
      const keyCode = `RC-${created.getFullYear()}-${String(seq).padStart(6, '0')}`;
      const order = await prisma.order.create({
        data: {
          keyCode, customerOrgId: o.id, branchId, status: plan.status,
          subtotal, total, discountType: hasDiscount ? 'percent' : null, discountValue: discPct, discountAmount,
          note: chance(0.15) ? pick(['Sabah teslim lütfen.', 'Arka kapıdan teslim.', 'Faturaya ek not: ihale no 4471.', 'Teslimattan önce arayın.', 'Çekirdekler taze kavrum olsun.']) : null,
          placedBy: placer, createdAt: created, expectedAt: new Date(created.getTime() + ri(2, 6) * DAY),
          lines: {
            create: lines.map((l) => ({
              itemType: 'product' as const, variantId: l.v.id, nameSnapshot: '', qty: l.qty, uomSnapshot: l.v.uom,
              unitPrice: l.unit, lineTotal: l.total, source: 'customer' as const, addedBy: placer, createdAt: created,
            })),
          },
        },
        include: { lines: true },
      });
      orderCount++;

      // ad snapshot (ürün adı — varyant adı)
      for (const l of order.lines) {
        const vv = await prisma.productVariant.findUnique({ where: { id: l.variantId! }, include: { product: { select: { name: true } } } });
        await prisma.orderLine.update({ where: { id: l.id }, data: { nameSnapshot: `${vv!.product.name} — ${vv!.name}` } });
      }

      // olay zinciri
      let t = created.getTime();
      const events: { from: OrderStatus | null; to: OrderStatus; at: number; role: Role | null; actor: string | null }[] = [{ from: null, to: 'placed', at: t, role: 'customer_admin', actor: placer }];
      if (plan.status === 'cancelled') {
        t += ri(1, 20) * HOUR;
        events.push({ from: 'placed', to: 'cancelled', at: t, role: chance(0.5) ? 'producer_admin' : 'customer_admin', actor: adminId });
      } else {
        const target = ['on_hold', 'delivery_issue'].includes(plan.status) ? (plan.status === 'on_hold' ? 'confirmed' : 'in_transit') : plan.status;
        const upto = CHAIN.indexOf(target as OrderStatus);
        let prev: OrderStatus = 'placed';
        for (let i = 1; i <= upto; i++) {
          const st = CHAIN[i]!;
          const [a, b] = GAP[st]!;
          t += ri(a, b) * HOUR;
          const role: Role = st === 'in_production' || st === 'production_done' ? 'production_staff' : st === 'ready_to_ship' || st === 'in_transit' || st === 'delivered' ? 'shipping_staff' : 'sales_staff';
          events.push({ from: prev, to: st, at: t, role, actor: adminId });
          prev = st;
        }
        if (plan.status === 'on_hold' || plan.status === 'delivery_issue') {
          t += ri(1, 10) * HOUR;
          events.push({ from: prev, to: plan.status, at: t, role: 'sales_staff', actor: adminId });
        }
      }
      for (const e of events) {
        await prisma.orderEvent.create({
          data: { orderId: order.id, fromStatus: e.from, toStatus: e.to, type: 'transition', actorId: e.actor, actorRole: e.role, createdAt: new Date(Math.min(e.at, now)) },
        });
      }
      if (hasDiscount) {
        await prisma.orderEvent.create({
          data: { orderId: order.id, type: 'discount', actorId: adminId, actorRole: 'producer_admin', note: `%${discPct}.00 iskonto uygulandı`, meta: { mode: 'percent', value: String(discPct) }, createdAt: new Date(Math.min(created.getTime() + 30 * 60_000, now)) },
        });
      }
      // stok rezervi (onaylanmış ve iptal olmayan)
      if (plan.status !== 'placed' && plan.status !== 'cancelled') {
        for (const l of lines) {
          reserved.set(l.v.id, (reserved.get(l.v.id) ?? 0) + l.qty);
          reserveMoves.push({ variantId: l.v.id, delta: -l.qty, refOrderId: order.id, at: new Date(Math.min(created.getTime() + 3 * HOUR, now)) });
        }
      }
    }

    // ── Stok: başlangıç girişleri + rezerve düşümleri ──
    const lowSet = new Set<string>();
    const all = [...variantMeta.values()];
    for (let i = 0; i < 9; i++) lowSet.add(pick(all.filter((v) => DISCOUNTABLE.has(v.cat))).id);
    const entries: { variantId: string; delta: number; reason: 'purchase' | 'order_reserve'; note: string | null; refOrderId: string | null; createdAt: Date }[] = [];
    for (const v of all) {
      const R = reserved.get(v.id) ?? 0;
      const base = lowSet.has(v.id) ? R + ri(1, 4) * v.step : Math.ceil(R * ri(14, 22) / 10) + ri(20, 120) * v.step;
      const half = Math.ceil(base / 2);
      entries.push({ variantId: v.id, delta: half, reason: 'purchase', note: 'Başlangıç alımı', refOrderId: null, createdAt: new Date(now - 80 * DAY) });
      entries.push({ variantId: v.id, delta: base - half, reason: 'purchase', note: 'Tedarik girişi', refOrderId: null, createdAt: new Date(now - 40 * DAY) });
    }
    for (const m of reserveMoves) entries.push({ variantId: m.variantId, delta: m.delta, reason: 'order_reserve', note: null, refOrderId: m.refOrderId, createdAt: m.at });
    for (let i = 0; i < entries.length; i += 500) {
      await prisma.stockMovement.createMany({ data: entries.slice(i, i + 500).map((e) => ({ ...e, actorId: adminId })) });
    }

    // sayaç: gerçek siparişler çakışmasın
    await prisma.counter.upsert({ where: { key: `order:${year}` }, update: { value: BigInt(seq) }, create: { key: `order:${year}`, value: BigInt(seq) } });
    await prisma.counter.create({ data: { key: 'seed:bulk-orders', value: BigInt(orderCount) } });

    // ── Destek talepleri ──
    const subjects = ['Teslimat gecikti', 'Eksik ürün geldi', 'Fatura düzeltme talebi', 'Çekirdek kavrum tonu farklı', 'Makine bakım randevusu', 'Fiyat listesi güncelleme', 'Ek sipariş eklenebilir mi?', 'Koli hasarlı geldi', 'Yeni şube için hesap açılışı', 'İskonto oranı sorusu'];
    const bodies = ['Merhaba, konuyla ilgili yardımınıza ihtiyacımız var.', 'Detayları sipariş notunda belirttim, kontrol eder misiniz?', 'Bir önceki sipariş ile farklılık gözlemledik.'];
    const statuses = ['open', 'pending_staff', 'pending_customer', 'resolved', 'closed'] as const;
    const tCtr = await prisma.counter.findUnique({ where: { key: `ticket:${year}` } });
    let tSeq = Number(tCtr?.value ?? 0);
    for (let i = 0; i < 14; i++) {
      const x = pick(customers);
      tSeq++;
      const status = pick(statuses);
      const start = now - ri(0, 30) * DAY - ri(0, 20) * HOUR;
      const uId = pick(x.o.users);
      await prisma.ticket.create({
        data: {
          keyCode: `DST-${year}-${String(tSeq).padStart(6, '0')}`, orgId: x.o.id, subject: pick(subjects), status, openedBy: uId, createdAt: new Date(start),
          messages: { create: [
            { authorId: uId, body: pick(bodies), isInternal: false, createdAt: new Date(start) },
            ...(status === 'open' ? [] : [{ authorId: adminId, body: 'Merhaba, talebinizi aldık; ilgili ekibimiz inceliyor.', isInternal: false, createdAt: new Date(Math.min(start + 3 * HOUR, now)) }]),
          ] },
        },
      });
    }
    await prisma.counter.upsert({ where: { key: `ticket:${year}` }, update: { value: BigInt(tSeq) }, create: { key: `ticket:${year}`, value: BigInt(tSeq) } });
  }

  // ── Duyurular ──
  const ann = [
    { title: 'Günün reçetesi yayında', body: 'Ana sayfada her gün yeni bir reçete öneriyoruz. Menünüze ilham olsun!', d: 0 },
    { title: 'Yeni ürünler kataloğa eklendi', body: 'Panama Geisha, Kenya AA, bitkisel sütler ve şuruplar artık sipariş verilebilir.', d: 2 },
    { title: 'Kurumsal & zincir iskonto listeleri güncellendi', body: 'Grubunuza tanımlı fiyatlar otomatik uygulanır; siparişte birim fiyatınızı görürsünüz.', d: 5 },
    { title: 'Hafta sonu sevkiyat takvimi', body: 'Cumartesi sevkiyatları 14:00\'a kadar yapılacaktır.', d: 9 },
  ];
  for (const a of ann) {
    if (await prisma.announcement.findFirst({ where: { title: a.title } })) continue;
    const at = new Date(Date.now() - a.d * DAY);
    await prisma.announcement.create({ data: { title: a.title, body: a.body, audience: 'all', publishedAt: at, createdBy: adminId, createdAt: at } });
  }

  console.log(`Tamam: ${pCount} yeni ürün, ${variantMeta.size} varyant (toplam), ${C_LIST.length} müşteri, ${RECIPES.length} reçete, ${orderCount} yeni sipariş.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
