import { describe, expect, it } from 'vitest';
import { convertUom, isWholeUnitUom, uomToBase, validateQty } from './uom';

describe('convertUom', () => {
  it('aynı tür içinde dönüştürür', () => {
    expect(convertUom(2, 'kg', 'g')).toBe(2000);
    expect(convertUom(500, 'g', 'kg')).toBe(0.5);
    expect(convertUom(1, 'l', 'ml')).toBe(1000);
    expect(convertUom(5, 'cl', 'ml')).toBe(50);
  });

  it('aynı birimde miktarı aynen döndürür', () => {
    expect(convertUom(3, 'kg', 'kg')).toBe(3);
  });

  it('farklı türler arası null', () => {
    expect(convertUom(1, 'kg', 'l')).toBeNull();
    expect(convertUom(1, 'adet', 'g')).toBeNull();
  });

  it('sayı birimleri arası null (içerik tanımı gerekir)', () => {
    expect(convertUom(1, 'koli', 'adet')).toBeNull();
    expect(convertUom(2, 'paket', 'kutu')).toBeNull();
  });
});

describe('uomToBase', () => {
  it('türün kanonik tabanına çevirir', () => {
    expect(uomToBase(1.5, 'kg')).toBe(1500);
    expect(uomToBase(2, 'l')).toBe(2000);
    expect(uomToBase(3, 'adet')).toBe(3);
  });
});

describe('isWholeUnitUom', () => {
  it('sayı birimleri tam sayı ister', () => {
    expect(isWholeUnitUom('adet')).toBe(true);
    expect(isWholeUnitUom('koli')).toBe(true);
  });
  it('ağırlık/hacim kesirli olabilir', () => {
    expect(isWholeUnitUom('kg')).toBe(false);
    expect(isWholeUnitUom('l')).toBe(false);
  });
});

describe('validateQty', () => {
  it('sıfır ve negatifi reddeder', () => {
    const rule = { orderUom: 'kg' as const, minOrderQty: 1, qtyStep: 0 };
    expect(validateQty(0, rule).ok).toBe(false);
    expect(validateQty(-2, rule).ok).toBe(false);
    expect(validateQty(Number.NaN, rule).ok).toBe(false);
  });

  it('sayı biriminde kesirli miktarı reddeder', () => {
    const rule = { orderUom: 'adet' as const, minOrderQty: 1, qtyStep: 1 };
    const res = validateQty(2.5, rule);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toContain('tam sayı');
  });

  it('asgari miktarın altını reddeder', () => {
    const rule = { orderUom: 'adet' as const, minOrderQty: 100, qtyStep: 100 };
    expect(validateQty(50, rule).ok).toBe(false);
    expect(validateQty(100, rule).ok).toBe(true);
  });

  it('adım katı olmayan miktarı reddeder', () => {
    const rule = { orderUom: 'kg' as const, minOrderQty: 1, qtyStep: 0.5 };
    expect(validateQty(1.5, rule).ok).toBe(true);
    expect(validateQty(1.7, rule).ok).toBe(false);
  });

  it('adım katı miktarı (kayan nokta toleransı ile) kabul eder', () => {
    const rule = { orderUom: 'kg' as const, minOrderQty: 1, qtyStep: 0.1 };
    expect(validateQty(1.3, rule).ok).toBe(true);
  });

  it('geçerli miktarda normalize edilmiş qty döndürür', () => {
    const rule = { orderUom: 'adet' as const, minOrderQty: 1, qtyStep: 1 };
    const res = validateQty(5, rule);
    expect(res).toEqual({ ok: true, qty: 5 });
  });

  it('qtyStep 0 iken asgari üstü her miktarı kabul eder', () => {
    const rule = { orderUom: 'kg' as const, minOrderQty: 1, qtyStep: 0 };
    expect(validateQty(3.7, rule).ok).toBe(true);
  });
});
