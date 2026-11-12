import { PrismaClient, type OrderStatus, type Role, type TicketStatus } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Demo verisi: birkaç müşteri firma + kullanıcı, farklı durumlarda siparişler (olay geçmişiyle),
 * destek talepleri, hizmetler/talepler/randevular, duyurular ve bekleyen üyelik başvuruları.
 * Önce `seed.ts` (katalog, kategori, fiyat) çalışmış olmalı. Idempotent: sabit anahtarlarla upsert;
 * siparişler `RC-DEMO-xxxx`, destekler `DST-DEMO-xxxx` anahtarlarını kullanır.
 * Demo müşteri telefonları +90555 111 00 0x; giriş TC + telefon (SMS_MOCK modunda kod otomatik gelir).
 */

const DAY = 24 * 60 * 60 * 1000;
const ago = (days: number, hours = 0): Date => new Date(Date.now() - days * DAY - hours * 3_600_000);

interface Cust {
  slug: string;
  name: string;
  taxId: string;
  phone: string;
  person: string;
  address: string;
  branches: { name: string; address: string }[];
}

const CUSTOMERS: Cust[] = [
  {
    slug: 'moda-kahve-evi',
    name: 'Moda Kahve Evi',
    taxId: '4510236789',
    phone: '+905551110001',
    person: 'Elif Demir',
    address: 'Moda Cd. 12, Kadıköy / İstanbul',
    branches: [
      { name: 'Moda Şube', address: 'Moda Cd. 12, Kadıköy / İstanbul' },
      { name: 'Bağdat Caddesi Şube', address: 'Bağdat Cd. 301, Kadıköy / İstanbul' },
    ],
  },
  {
    slug: 'cekirdek-bar',
    name: 'Çekirdek Bar',
    taxId: '7821450912',
    phone: '+905551110002',
    person: 'Mert Yıldız',
    address: 'Alsancak, İzmir',
    branches: [{ name: 'Alsancak', address: 'Kıbrıs Şehitleri Cd. 45, İzmir' }],
  },
  {
    slug: 'otel-lale',
    name: 'Lale Otel & Spa',
    taxId: '3369001245',
    phone: '+905551110003',
    person: 'Ayşe Korkmaz',
    address: 'Beşiktaş, İstanbul',
    branches: [
      { name: 'Ana Bina', address: 'Barbaros Blv. 88, Beşiktaş / İstanbul' },
      { name: 'Spa Merkezi', address: 'Barbaros Blv. 90, Beşiktaş / İstanbul' },
    ],
  },
  {
    slug: 'bahce-cafe',
    name: 'Bahçe Cafe',
    taxId: '9904412376',
    phone: '+905551110004',
    person: 'Can Aksoy',
    address: 'Çankaya, Ankara',
    branches: [{ name: 'Çankaya', address: 'Tunalı Hilmi Cd. 20, Ankara' }],
  },
];

interface OrderSeed {
  key: string;
  cust: string; // slug
  status: OrderStatus;
  daysAgo: number;
  note?: string;
  lines: [variantCode: string, qty: number][];
  /** durum zinciri (placed'den sonra) */
  path: OrderStatus[];
}

const ORDERS: OrderSeed[] = [
  { key: 'RC-DEMO-0001', cust: 'moda-kahve-evi', status: 'placed', daysAgo: 0, note: 'Hafta sonuna yetişirse süper olur.', lines: [['GTM-ANTIGUA-1KG', 10], ['EKP-BARDAK-8OZ-50', 10]], path: [] },
  { key: 'RC-DEMO-0002', cust: 'cekirdek-bar', status: 'placed', daysAgo: 1, lines: [['BRZ-SANTOS-1KG', 5], ['TRK-ORTA-500G', 4]], path: [] },
  { key: 'RC-DEMO-0003', cust: 'otel-lale', status: 'confirmed', daysAgo: 2, lines: [['BRZ-SANTOS-5KG-KOLI', 2], ['CB-KONSANTRE-1L', 12]], path: ['confirmed'] },
  { key: 'RC-DEMO-0004', cust: 'moda-kahve-evi', status: 'in_production', daysAgo: 3, lines: [['GTM-ANTIGUA-250G', 24]], path: ['confirmed', 'in_production'] },
  { key: 'RC-DEMO-0005', cust: 'bahce-cafe', status: 'ready_to_ship', daysAgo: 4, note: 'Teslimat sabah 10 dan önce.', lines: [['TRK-ORTA-100G', 30], ['EKP-FILTRE-V60-1', 500]], path: ['confirmed', 'in_production', 'production_done', 'ready_to_ship'] },
  { key: 'RC-DEMO-0006', cust: 'otel-lale', status: 'in_transit', daysAgo: 5, lines: [['GTM-ANTIGUA-1KG', 25], ['CB-KONSANTRE-1L', 24]], path: ['confirmed', 'in_production', 'production_done', 'ready_to_ship', 'in_transit'] },
  { key: 'RC-DEMO-0007', cust: 'cekirdek-bar', status: 'delivered', daysAgo: 12, lines: [['BRZ-SANTOS-1KG', 10], ['GTM-ANTIGUA-1KG', 10]], path: ['confirmed', 'in_production', 'production_done', 'ready_to_ship', 'in_transit', 'delivered'] },
  { key: 'RC-DEMO-0008', cust: 'moda-kahve-evi', status: 'delivered', daysAgo: 20, lines: [['GTM-ANTIGUA-1KG', 12], ['EKP-BARDAK-8OZ-50', 20]], path: ['confirmed', 'in_production', 'production_done', 'ready_to_ship', 'in_transit', 'delivered'] },
  { key: 'RC-DEMO-0009', cust: 'bahce-cafe', status: 'delivered', daysAgo: 33, lines: [['TRK-ORTA-500G', 10]], path: ['confirmed', 'in_production', 'production_done', 'ready_to_ship', 'in_transit', 'delivered'] },
  { key: 'RC-DEMO-0010', cust: 'otel-lale', status: 'delivered', daysAgo: 41, lines: [['BRZ-SANTOS-5KG-KOLI', 4], ['CB-KONSANTRE-1L', 18]], path: ['confirmed', 'in_production', 'production_done', 'ready_to_ship', 'in_transit', 'delivered'] },
  { key: 'RC-DEMO-0011', cust: 'cekirdek-bar', status: 'cancelled', daysAgo: 8, note: 'Müşteri vazgeçti.', lines: [['EKP-FILTRE-V60-1', 300]], path: ['cancelled'] },
  { key: 'RC-DEMO-0012', cust: 'moda-kahve-evi', status: 'on_hold', daysAgo: 6, note: 'Adres teyidi bekleniyor.', lines: [['TRK-ORTA-100G', 20]], path: ['confirmed', 'on_hold'] },
];

const SERVICES = [
  { code: 'SRV-EGITIM', name: 'Barista Eğitimi', description: 'Ekibiniz için yerinde, 4 saatlik uygulamalı barista eğitimi.', basePrice: 4500 },
  { code: 'SRV-MAKINE-BAKIM', name: 'Espresso Makinesi Bakımı', description: 'Periyodik bakım, kireç temizliği ve basınç ayarı.', basePrice: 1800 },
  { code: 'SRV-KURULUM', name: 'Bar Kurulum Danışmanlığı', description: 'Yeni açılacak işletmeler için ekipman ve akış planı.', basePrice: 6500 },
  { code: 'SRV-KAVURMA-OZEL', name: 'Özel Harman Çalışması', description: 'İşletmenize özel harman geliştirme ve tadım seansı.', basePrice: null },
];

const dec = (n: number): string => n.toFixed(2);

async function main(): Promise<void> {
  const producer = await prisma.organization.findUnique({ where: { slug: 'roasteryclub' } });
  if (!producer) throw new Error('Önce seed.ts çalıştırılmalı (üretici org yok).');
  const admin = await prisma.membership.findFirst({
    where: { orgId: producer.id, role: 'producer_admin' },
    select: { userId: true },
  });
  const adminId = admin?.userId ?? null;

  // ── Müşteri firmalar + şubeler + yetkili kullanıcı ──
  const orgId = new Map<string, string>();
  const branchId = new Map<string, string[]>();
  const userId = new Map<string, string>();
  for (const c of CUSTOMERS) {
    const org = await prisma.organization.upsert({
      where: { slug: c.slug },
      update: { name: c.name, taxId: c.taxId, phone: c.phone, address: c.address },
      create: { type: 'customer', name: c.name, slug: c.slug, taxId: c.taxId, phone: c.phone, address: c.address },
    });
    orgId.set(c.slug, org.id);
    const ids: string[] = [];
    for (const b of c.branches) {
      const row =
        (await prisma.branch.findFirst({ where: { orgId: org.id, name: b.name } })) ??
        (await prisma.branch.create({ data: { orgId: org.id, name: b.name, address: b.address } }));
      ids.push(row.id);
    }
    branchId.set(c.slug, ids);
    const user = await prisma.user.upsert({
      where: { provider_providerUserId: { provider: 'phone', providerUserId: c.phone } },
      update: { fullName: c.person },
      create: { provider: 'phone', providerUserId: c.phone, phone: c.phone, fullName: c.person },
    });
    userId.set(c.slug, user.id);
    const role: Role = 'customer_admin';
    await prisma.membership.upsert({
      where: { userId_orgId_role: { userId: user.id, orgId: org.id, role } },
      update: { status: 'active' },
      create: { userId: user.id, orgId: org.id, role, status: 'active' },
    });
  }

  // Zincir müşteriler grubuna otel ekle
  const group = await prisma.customerGroup.findUnique({ where: { slug: 'zincir-musteriler' } });
  if (group) {
    await prisma.customerGroupMember.upsert({
      where: { groupId_orgId: { groupId: group.id, orgId: orgId.get('otel-lale')! } },
      update: {},
      create: { groupId: group.id, orgId: orgId.get('otel-lale')! },
    });
  }

  // ── Siparişler ──
  for (const o of ORDERS) {
    if (await prisma.order.findUnique({ where: { keyCode: o.key } })) continue;
    const customerOrgId = orgId.get(o.cust)!;
    const bId = branchId.get(o.cust)![0]!;
    const uId = userId.get(o.cust)!;

    const lines: {
      variantId: string;
      name: string;
      uom: any;
      qty: number;
      price: number;
    }[] = [];
    for (const [code, qty] of o.lines) {
      const v = await prisma.productVariant.findUnique({ where: { code }, include: { product: true } });
      if (!v) throw new Error(`Varyant yok: ${code} (önce seed.ts çalıştırın)`);
      lines.push({
        variantId: v.id,
        name: `${v.product.name} — ${v.name}`,
        uom: v.orderUom,
        qty,
        price: Number(v.basePrice),
      });
    }
    const subtotal = lines.reduce((s, l) => s + l.qty * l.price, 0);

    const created = ago(o.daysAgo);
    const order = await prisma.order.create({
      data: {
        keyCode: o.key,
        customerOrgId,
        branchId: bId,
        status: o.status,
        subtotal: dec(subtotal),
        total: dec(subtotal),
        note: o.note,
        placedBy: uId,
        createdAt: created,
        expectedAt: new Date(created.getTime() + 5 * DAY),
        lines: {
          create: lines.map((l) => ({
            itemType: 'product' as const,
            variantId: l.variantId,
            nameSnapshot: l.name,
            qty: l.qty,
            uomSnapshot: l.uom,
            unitPrice: dec(l.price),
            lineTotal: dec(l.qty * l.price),
            source: 'customer' as const,
            addedBy: uId,
            createdAt: created,
          })),
        },
      },
    });

    const chain: (OrderStatus | null)[] = [null, 'placed', ...o.path];
    let t = created.getTime();
    for (let i = 1; i < chain.length; i++) {
      t += 6 * 3_600_000;
      await prisma.orderEvent.create({
        data: {
          orderId: order.id,
          fromStatus: chain[i - 1],
          toStatus: chain[i],
          type: 'transition',
          actorId: i === 1 ? uId : adminId,
          actorRole: i === 1 ? 'customer_admin' : 'producer_admin',
          note: i === 1 ? o.note : null,
          createdAt: new Date(Math.min(t, Date.now())),
        },
      });
    }
  }

  // ── Destek talepleri ──
  const tickets: {
    key: string;
    cust: string;
    subject: string;
    status: TicketStatus;
    order?: string;
    msgs: [fromCustomer: boolean, body: string, internal?: boolean][];
    daysAgo: number;
  }[] = [
    {
      key: 'DST-DEMO-0001', cust: 'moda-kahve-evi', subject: 'Teslim edilen kahvede kavrum farkı', status: 'pending_staff', order: 'RC-DEMO-0008', daysAgo: 2,
      msgs: [[true, 'Merhaba, son gelen Guatemala partisi bir öncekine göre daha koyu geldi. Kontrol edebilir misiniz?']],
    },
    {
      key: 'DST-DEMO-0002', cust: 'otel-lale', subject: 'Fatura bilgisi güncelleme', status: 'pending_customer', daysAgo: 5,
      msgs: [
        [true, 'Fatura ünvanımız değişti, yeni bilgileri nereye iletebiliriz?'],
        [false, 'Merhaba, yeni ünvan ve vergi dairesi bilgisini bu talebe yazabilirsiniz.'],
        [false, 'Not: muhasebeye ilettik, bilgi gelince güncellenecek.', true],
      ],
    },
    {
      key: 'DST-DEMO-0003', cust: 'cekirdek-bar', subject: 'Cold brew teslimat saati', status: 'resolved', order: 'RC-DEMO-0007', daysAgo: 14,
      msgs: [
        [true, 'Teslimatı sabah 9 a alabilir miyiz?'],
        [false, 'Evet, bir sonraki siparişten itibaren 09:00 a çektik.'],
        [true, 'Harika, teşekkürler.'],
      ],
    },
  ];
  for (const tk of tickets) {
    if (await prisma.ticket.findUnique({ where: { keyCode: tk.key } })) continue;
    const order = tk.order ? await prisma.order.findUnique({ where: { keyCode: tk.order } }) : null;
    const uId = userId.get(tk.cust)!;
    let t = ago(tk.daysAgo).getTime();
    await prisma.ticket.create({
      data: {
        keyCode: tk.key,
        orgId: orgId.get(tk.cust)!,
        orderId: order?.id,
        subject: tk.subject,
        status: tk.status,
        openedBy: uId,
        createdAt: new Date(t),
        messages: {
          create: tk.msgs.map(([fromCustomer, body, internal]) => {
            t += 2 * 3_600_000;
            return {
              authorId: fromCustomer ? uId : adminId,
              body,
              isInternal: internal ?? false,
              createdAt: new Date(Math.min(t, Date.now())),
            };
          }),
        },
      },
    });
  }

  // ── Hizmetler, talepler, randevular ──
  const serviceId = new Map<string, string>();
  for (const s of SERVICES) {
    const row = await prisma.service.upsert({
      where: { code: s.code },
      update: { name: s.name, description: s.description, basePrice: s.basePrice },
      create: { code: s.code, name: s.name, description: s.description, basePrice: s.basePrice },
    });
    serviceId.set(s.code, row.id);
  }
  if ((await prisma.serviceRequest.count()) === 0) {
    const r1 = await prisma.serviceRequest.create({
      data: { serviceId: serviceId.get('SRV-EGITIM')!, orgId: orgId.get('moda-kahve-evi')!, status: 'scheduled', note: 'Yeni başlayan 3 barista için.', createdBy: userId.get('moda-kahve-evi'), createdAt: ago(6) },
    });
    await prisma.appointment.create({
      data: { serviceRequestId: r1.id, scheduledAt: new Date(Date.now() + 4 * DAY), durationMin: 240, location: 'Moda Şube', note: 'Sabah 10:00' },
    });
    await prisma.serviceRequest.create({
      data: { serviceId: serviceId.get('SRV-MAKINE-BAKIM')!, orgId: orgId.get('otel-lale')!, status: 'new', note: 'Lobi barındaki makine gürültülü çalışıyor.', createdBy: userId.get('otel-lale'), createdAt: ago(1) },
    });
    await prisma.serviceRequest.create({
      data: { serviceId: serviceId.get('SRV-KAVURMA-OZEL')!, orgId: orgId.get('cekirdek-bar')!, status: 'in_review', note: 'Çikolata ağırlıklı, düşük asiditeli bir harman istiyoruz.', createdBy: userId.get('cekirdek-bar'), createdAt: ago(3) },
    });
  }

  // ── Duyurular ──
  const announcements = [
    { title: 'Yeni hasat Etiyopya Yirgacheffe ön siparişte', body: 'Çiçeksi ve narenciye notalarıyla Yirgacheffe lotu ön sipariş listesinde. Teslimat ayın ikinci haftası.', daysAgo: 1 },
    { title: 'Bayram haftası teslimat takvimi', body: 'Resmi tatil nedeniyle sevkiyatlar bir gün erken kapanacak. Siparişlerinizi lütfen önceden verin.', daysAgo: 7 },
    { title: 'Cold Brew Konsantre fiyatları güncellendi', body: 'Yeni dönem fiyatları katalogda yayında. Özel liste fiyatlarınız değişmedi.', daysAgo: 15 },
  ];
  for (const a of announcements) {
    const has = await prisma.announcement.findFirst({ where: { title: a.title } });
    if (has) continue;
    await prisma.announcement.create({
      data: { title: a.title, body: a.body, audience: 'all', publishedAt: ago(a.daysAgo), createdBy: adminId, createdAt: ago(a.daysAgo) },
    });
  }

  // ── Bekleyen üyelik başvuruları ──
  const pending = [
    { phone: '+905551110101', name: 'Deniz Arslan', org: 'Sahil Kahve Kulübü', taxId: '5502318874', address: 'Karşıyaka, İzmir', note: 'Aylık yaklaşık 40 kg alırız.' },
    { phone: '+905551110102', name: 'Selin Çetin', org: 'Kitap & Kahve', taxId: '', address: 'Nilüfer, Bursa', note: '' },
  ];
  for (const p of pending) {
    const u = await prisma.user.upsert({
      where: { provider_providerUserId: { provider: 'phone', providerUserId: p.phone } },
      update: {},
      create: { provider: 'phone', providerUserId: p.phone, phone: p.phone, fullName: p.name },
    });
    const has = await prisma.membershipRequest.findFirst({ where: { userId: u.id } });
    if (has) continue;
    await prisma.membershipRequest.create({
      data: {
        userId: u.id,
        requestedOrgName: p.org,
        requestedRole: 'customer_admin',
        phone: p.phone,
        note: p.note || null,
        payload: { orgName: p.org, taxId: p.taxId || undefined, address: p.address },
        status: 'pending',
        createdAt: ago(1),
      },
    });
  }

  console.log('Demo verisi tamam.');
  console.log(`  ${CUSTOMERS.length} müşteri firma, ${ORDERS.length} sipariş, ${tickets.length} destek talebi,`);
  console.log(`  ${SERVICES.length} hizmet, ${announcements.length} duyuru, ${pending.length} bekleyen başvuru.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
