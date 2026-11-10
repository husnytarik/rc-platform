import { describe, expect, it } from 'vitest';
import { isValidTcKimlik, normalizeTc } from './tc';

describe('isValidTcKimlik', () => {
  it('geçerli sağlama basamaklı numarayı kabul eder', () => {
    expect(isValidTcKimlik('10000000146')).toBe(true);
  });
  it('boşluk/tire temizler', () => {
    expect(normalizeTc('100 000 001-46')).toBe('10000000146');
    expect(isValidTcKimlik('100 000 001 46')).toBe(true);
  });
  it('yanlış sağlama, kısa ve 0 ile başlayanı reddeder', () => {
    expect(isValidTcKimlik('10000000147')).toBe(false);
    expect(isValidTcKimlik('1234567890')).toBe(false);
    expect(isValidTcKimlik('01234567890')).toBe(false);
    expect(isValidTcKimlik('')).toBe(false);
  });
});
