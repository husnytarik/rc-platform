import { PrismaClient, type OrderStatus, type Role } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Demo müşteri firma yöneticisinin (Moda Kahve Evi) görebileceği örnek veri: ek şubeler, şube müdürleri,
 * çalışanlar ve çeşitli durumlarda ~40 sipariş (teslim edilmiş, yolda, iptal, beklemede, teslimat sorunu,
 * sonradan kalem eklenen, iskontolu). Birkaç başka müşteri firmaya da birkaç sipariş eklenir.
 * Idempotent: Moda'da bu seed'in kullanıcıları zaten sipariş vermişse hiçbir şey yapmaz.
 */
let st = 20261118;
const rnd = (): number => {
  st = (st + 0x6d2b79f5) | 0;
  let t = Math.imul(st ^ (st >>> 15), 1 | st);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const ri = (a: number, b: number): number => a + Math.floor(rnd() * (b - a + 1));
const pick = <T,>(a: readonly T[]): T => a[Math.floor(rnd() * a.length)]!;
const chance = (p: number): boolean => rnd() < p;
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const r2 = (n: number): number => Math.round(n * 100) / 100;

const CHAIN: OrderStatus[] = ['placed', 'confirmed', 'in_production', 'production_done', 'ready_to_ship', 'in_transit', 'delivered'];
const GAP: Record<string, [number, number]> = {
  confirmed: [1, 8], in_production: [3, 18], production_done: [6, 24], ready_to_ship: [1, 6], in_transit: [2, 12], delivered: [6, 30],
};
const NOTES = ['Sabah teslim lütfen.', 'Arka kapıdan teslim.', 'Teslimattan önce arayın.', 'Çekirdekler taze kavrum olsun.', 'Faturaya şube adı yazılsın.'];

const MODA_BRANCHES = ['Moda Şube', 'Bostancı Şube', 'Caddebostan Şube', 'Fenerbahçe Şube'];
const PEOPLE: { name: string; role: Role; branch: string | null }[] = [
  { name: 'Selin Aydoğan', role: 'branch_manager', branch: 'Bostancı Şube' },
  { name: 'Emre Kaplan', role: 'branch_manager', branch: 'Caddebostan Şube' },
  { name: 'Derya Yücel', role: 'branch_manager', branch: 'Fenerbahçe Şube' },
  { name: 'Burak Tunç', role: 'customer_user', branch: null },
  { name: 'Ayşe Karataş', role: 'customer_user', branch: null },
];

function statusFor(ageDays: number): OrderStatus {
  const x = rnd();
  if (ageDays > 14) return x < 0.82 ? 'delivered' : x < 0.92 ? 'cancelled' : x < 0.97 ? 'delivery_issue' : 'on_hold';
  if (ageDays > 7) return x < 0.55 ? 'delivered' : x < 0.7 ? 'in_transit' : x < 0.8 ? 'ready_to_ship' : x < 0.88 ? 'cancelled' : x < 0.94 ? 'on_hold' : 'delivery_issue';
  if (ageDays > 3) return x < 0.25 ? 'delivered' : x < 0.45 ? 'in_transit' : x < 0.6 ? 'ready_to_ship' : x < 0.75 ? 'in_production' : x < 0.85 ? 'confirmed' : x < 0.92 ? 'on_hold' : 'cancelled';
  if (ageDays > 1) return x < 0.2 ? 'in_transit' : x < 0.4 ? 'in_production' : x < 0.65 ? 'confirmed' : x < 0.9 ? 'placed' : 'production_done';
  return x < 0.55 ? 'placed' : x < 0.85 ? 'confirmed' : 'in_production';
}

async function main(): Promise<void> {
  const now = Date.now();
  const year = new Date().getFullYear();
  const admin = await prisma.membership.findFirst({ where: { role: 'producer_admin', status: 'active' }, select: { userId: true } });
  const adminId = admin?.userId ?? null;
  const moda = await prisma.organization.findUnique({ where: { slug: 'moda-kahve-evi' } });
  if (!moda) throw new Error('moda-kahve-evi bulunamadı');

  const variants = await prisma.productVariant.findMany({
    where: { isActive: true, product: { isActive: true, isService: false, code: { not: 'KPD-ESPRESSO' } } },
    include: { product: { select: { name: true } } },
  });
  if (variants.length === 0) throw new Error('Katalogda varyant yok');

  // Şubeler
  const branchId = new Map<string, string>();
  for (const name of MODA_BRANCHES) {
    const row =
      (await prisma.branch.findFirst({ where: { orgId: moda.id, name } })) ??
      (await prisma.branch.create({ data: { orgId: moda.id, name, address: `${name}, İstanbul` } }));
    branchId.set(name, row.id);
  }

  // Kişiler
  const people: { id: string; role: Role; branch: string | null }[] = [];
  let n = 1;
  for (const p of PEOPLE) {
    const phone = `+9055532${String(n++).padStart(5, '0')}`;
    const user = await prisma.user.upsert({
      where: { provider_providerUserId: { provider: 'phone', providerUserId: phone } },
      update: {},
      create: { provider: 'phone', providerUserId: phone, phone, fullName: p.name, lastLoginAt: new Date(now - ri(0, 5) * DAY) },
    });
    await prisma.membership.upsert({
      where: { userId_orgId_role: { userId: user.id, orgId: moda.id, role: p.role } },
      update: { status: 'active' },
      create: {
        userId: user.id, orgId: moda.id, role: p.role, status: 'active',
        branchScope: p.branch ? [branchId.get(p.branch)!] : undefined,
      },
    });
    people.push({ id: user.id, role: p.role, branch: p.branch });
  }

  const done = await prisma.order.count({ where: { customerOrgId: moda.id, placedBy: { in: people.map((x) => x.id) } } });
  if (done > 0) {
    console.log(`Zaten ${done} sipariş var, atlandı.`);
    return;
  }

  const ctr = await prisma.counter.findUnique({ where: { key: `order:${year}` } });
  let seq = Number(ctr?.value ?? 0);

  const modaAdmin = await prisma.membership.findFirst({ where: { orgId: moda.id, role: 'customer_admin', status: 'active' }, select: { userId: true } });
  const targets: { orgId: string; branches: string[]; placers: { id: string; role: Role; branchName?: string | null }[]; count: number }[] = [
    {
      orgId: moda.id,
      branches: [...branchId.values()],
      placers: [
        ...(modaAdmin ? [{ id: modaAdmin.userId, role: 'customer_admin' as Role, branchName: null }] : []),
        ...people.map((x) => ({ id: x.id, role: x.role, branchName: x.branch })),
      ],
      count: 40,
    },
  ];
  for (const slug of ['cekirdek-bar', 'otel-lale', 'bahce-cafe']) {
    const org = await prisma.organization.findUnique({ where: { slug } });
    if (!org) continue;
    const bs = await prisma.branch.findMany({ where: { orgId: org.id }, select: { id: true } });
    const mem = await prisma.membership.findFirst({ where: { orgId: org.id, status: 'active' }, select: { userId: true, role: true } });
    if (bs.length === 0) continue;
    targets.push({
      orgId: org.id, branches: bs.map((b) => b.id),
      placers: mem ? [{ id: mem.userId, role: mem.role, branchName: null }] : [], count: 8,
    });
  }

  let made = 0;
  for (const t of targets) {
    const plans = Array.from({ length: t.count }, () => ({ ageH: ri(3, 60 * 24) }));
    plans.sort((a, b) => b.ageH - a.ageH);
    for (const plan of plans) {
      const created = new Date(now - plan.ageH * HOUR);
      const status = statusFor(plan.ageH / 24);
      const placer = t.placers.length ? pick(t.placers) : null;
      const bId =
        placer?.branchName && branchId.has(placer.branchName) && t.orgId === moda.id
          ? branchId.get(placer.branchName)!
          : pick(t.branches);

      const chosen = new Map<string, (typeof variants)[number]>();
      for (let i = ri(1, 5); i > 0; i--) { const v = pick(variants); chosen.set(v.id, v); }
      const lines = [...chosen.values()].map((v) => {
        const min = Number(v.minOrderQty);
        const step = Number(v.qtyStep);
        const qty = min + step * (ri(1, 6) - 1);
        const unit = Number(v.basePrice);
        return { v, qty, unit, total: r2(unit * qty), name: `${v.product.name} — ${v.name}` };
      });
      const extra = status !== 'cancelled' && chance(0.22) ? pick(variants) : null;
      const extraLine = extra
        ? { v: extra, qty: Number(extra.minOrderQty), unit: Number(extra.basePrice), total: r2(Number(extra.basePrice) * Number(extra.minOrderQty)), name: `${extra.product.name} — ${extra.name}` }
        : null;
      const all = extraLine && !chosen.has(extra!.id) ? [...lines, extraLine] : lines;
      const subtotal = r2(all.reduce((s, l) => s + l.total, 0));
      const hasDiscount = chance(0.18);
      const pct = hasDiscount ? pick([3, 5, 10]) : 0;
      const discountAmount = r2((subtotal * pct) / 100);

      seq++;
      const order = await prisma.order.create({
        data: {
          keyCode: `RC-${created.getFullYear()}-${String(seq).padStart(6, '0')}`,
          customerOrgId: t.orgId, branchId: bId, status,
          subtotal, total: r2(subtotal - discountAmount),
          discountType: hasDiscount ? 'percent' : null, discountValue: pct, discountAmount,
          note: chance(0.2) ? pick(NOTES) : null,
          placedBy: placer?.id ?? null, createdAt: created, expectedAt: new Date(created.getTime() + ri(2, 6) * DAY),
          lines: {
            create: all.map((l) => ({
              itemType: 'product' as const, variantId: l.v.id, nameSnapshot: l.name, qty: l.qty,
              uomSnapshot: l.v.orderUom, unitPrice: l.unit, lineTotal: l.total,
              source: extraLine && l === extraLine && !chosen.has(extra!.id) ? ('sales' as const) : ('customer' as const),
              addedBy: placer?.id ?? null, createdAt: created,
            })),
          },
        },
      });
      made++;

      const ev: { from: OrderStatus | null; to: OrderStatus | null; type: string; at: number; role: Role | null; actor: string | null; note?: string }[] = [
        { from: null, to: 'placed', type: 'transition', at: created.getTime(), role: placer?.role ?? 'customer_admin', actor: placer?.id ?? null },
      ];
      let tm = created.getTime();
      if (status === 'cancelled') {
        tm += ri(1, 20) * HOUR;
        const byCustomer = chance(0.6);
        ev.push({ from: 'placed', to: 'cancelled', type: 'transition', at: tm, role: byCustomer ? placer?.role ?? 'customer_admin' : 'producer_admin', actor: byCustomer ? placer?.id ?? null : adminId, note: byCustomer ? 'Müşteri vazgeçti.' : 'Stok yetersizliği nedeniyle iptal.' });
      } else {
        const target = status === 'on_hold' ? 'confirmed' : status === 'delivery_issue' ? 'in_transit' : status;
        const upto = CHAIN.indexOf(target);
        let prev: OrderStatus = 'placed';
        for (let i = 1; i <= upto; i++) {
          const s = CHAIN[i]!;
          const [a, b] = GAP[s]!;
          tm += ri(a, b) * HOUR;
          const role: Role = s === 'in_production' || s === 'production_done' ? 'production_staff' : s === 'ready_to_ship' || s === 'in_transit' || s === 'delivered' ? 'shipping_staff' : 'sales_staff';
          ev.push({ from: prev, to: s, type: 'transition', at: tm, role, actor: adminId });
          prev = s;
        }
        if (status === 'on_hold' || status === 'delivery_issue') {
          tm += ri(1, 10) * HOUR;
          ev.push({ from: prev, to: status, type: 'transition', at: tm, role: 'sales_staff', actor: adminId, note: status === 'on_hold' ? 'Müşteri adres teyidi bekleniyor.' : 'Teslimatta adreste kimse bulunamadı.' });
        }
      }
      if (extraLine && !chosen.has(extra!.id)) {
        ev.push({ from: null, to: null, type: 'line_added', at: created.getTime() + 2 * HOUR, role: 'sales_staff', actor: adminId, note: `${extraLine.name} eklendi` });
      }
      if (hasDiscount) {
        ev.push({ from: null, to: null, type: 'discount', at: created.getTime() + 30 * 60_000, role: 'producer_admin', actor: adminId, note: `%${pct} iskonto uygulandı` });
      }
      for (const e of ev) {
        await prisma.orderEvent.create({
          data: { orderId: order.id, fromStatus: e.from, toStatus: e.to, type: e.type, actorId: e.actor, actorRole: e.role, note: e.note ?? null, createdAt: new Date(Math.min(e.at, now)) },
        });
      }
    }
  }
  await prisma.counter.upsert({ where: { key: `order:${year}` }, update: { value: seq }, create: { key: `order:${year}`, value: seq } });
  console.log(`${people.length} kişi, ${MODA_BRANCHES.length} şube, ${made} sipariş eklendi.`);
}

main().finally(() => prisma.$disconnect());
