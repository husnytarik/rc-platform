/**
 * Ölçü birimleri. Ürünler farklı birimlerde satılır: ağırlık (g/kg),
 * hacim (ml/cl/L), sayı/ambalaj (adet/paket/kutu/koli/çuval).
 *
 * `çuval` gibi Türkçe karakterli değerler Prisma enum'unda geçersiz olduğu için
 * kod `cuval`; görünen etiket `UOM_LABELS_TR` üzerinden.
 */
export const UOMS = ['g', 'kg', 'ml', 'cl', 'l', 'adet', 'paket', 'kutu', 'koli', 'cuval'] as const;
export type Uom = (typeof UOMS)[number];

export type UomKind = 'weight' | 'volume' | 'count';

export const UOM_KIND: Record<Uom, UomKind> = {
  g: 'weight',
  kg: 'weight',
  ml: 'volume',
  cl: 'volume',
  l: 'volume',
  adet: 'count',
  paket: 'count',
  kutu: 'count',
  koli: 'count',
  cuval: 'count',
};

export const UOM_LABELS_TR: Record<Uom, string> = {
  g: 'g',
  kg: 'kg',
  ml: 'ml',
  cl: 'cl',
  l: 'L',
  adet: 'adet',
  paket: 'paket',
  kutu: 'kutu',
  koli: 'koli',
  cuval: 'çuval',
};

/** Tür başına kanonik taban: ağırlık→g, hacim→ml, sayı→adet. */
const TO_BASE: Record<Uom, number> = {
  g: 1,
  kg: 1000,
  ml: 1,
  cl: 10,
  l: 1000,
  adet: 1,
  paket: 1,
  kutu: 1,
  koli: 1,
  cuval: 1,
};

export function isWholeUnitUom(uom: Uom): boolean {
  return UOM_KIND[uom] === 'count';
}

/**
 * Aynı tür içinde birim dönüşümü (kg→g, L→ml). Farklı türde ya da
 * sayı birimleri arası (adet↔paket, içerik tanımı olmadan) `null`.
 */
export function convertUom(qty: number, from: Uom, to: Uom): number | null {
  if (from === to) return qty;
  if (UOM_KIND[from] !== UOM_KIND[to]) return null;
  if (UOM_KIND[from] === 'count') return null;
  return (qty * TO_BASE[from]) / TO_BASE[to];
}

/** Miktarı türün kanonik tabanına çevirir (raporlama toplamları için). */
export function uomToBase(qty: number, uom: Uom): number {
  return qty * TO_BASE[uom];
}

export interface QtyRule {
  orderUom: Uom;
  /** En az sipariş miktarı (orderUom cinsinden). */
  minOrderQty: number;
  /** İzin verilen artış adımı (orderUom cinsinden). */
  qtyStep: number;
}

export type QtyCheck = { ok: true; qty: number } | { ok: false; reason: string };

const EPS = 1e-9;

/** Sipariş satırı miktarını birim kurallarına göre doğrular. */
export function validateQty(qty: number, rule: QtyRule): QtyCheck {
  const label = UOM_LABELS_TR[rule.orderUom];
  if (!Number.isFinite(qty) || qty <= 0) {
    return { ok: false, reason: 'Miktar sıfırdan büyük olmalı.' };
  }
  if (isWholeUnitUom(rule.orderUom) && Math.abs(qty - Math.round(qty)) > EPS) {
    return { ok: false, reason: `${label} için tam sayı girin.` };
  }
  if (qty + EPS < rule.minOrderQty) {
    return { ok: false, reason: `En az ${rule.minOrderQty} ${label} sipariş edilebilir.` };
  }
  if (rule.qtyStep > 0) {
    const steps = (qty - rule.minOrderQty) / rule.qtyStep;
    if (Math.abs(steps - Math.round(steps)) > EPS) {
      return { ok: false, reason: `Miktar ${rule.qtyStep} ${label} katları halinde artmalı.` };
    }
  }
  return { ok: true, qty };
}
