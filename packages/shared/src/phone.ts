/**
 * Türkiye cep telefonu normalizasyonu. Eski app'te 4 ayrı yerde kopyalanmış
 * olan mantığın tek yeri. OTP kimliği her zaman E.164 saklanır: +90XXXXXXXXXX
 */

const TR_MOBILE = /^\+90(5\d{9})$/;

/** Girdi ne olursa olsun +90XXXXXXXXXX döndürür; geçersizse null. */
export function toE164TR(input: string): string | null {
  const digits = (input ?? '').replace(/[^\d+]/g, '');
  let d = digits.replace(/^\+/, '');

  if (d.startsWith('0090')) d = d.slice(4);
  else if (d.startsWith('90') && d.length === 12) d = d.slice(2);
  else if (d.startsWith('0') && d.length === 11) d = d.slice(1);

  if (d.length === 10 && d.startsWith('5')) {
    const e164 = `+90${d}`;
    return TR_MOBILE.test(e164) ? e164 : null;
  }
  return null;
}

export function isValidTRMobile(input: string): boolean {
  return toE164TR(input) !== null;
}

/** Görüntüleme: +90 5XX XXX XX XX */
export function formatTRMobile(e164: string): string {
  const m = TR_MOBILE.exec(e164);
  if (!m) return e164;
  const n = m[1]!; // 5XXXXXXXXX
  return `+90 ${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6, 8)} ${n.slice(8, 10)}`;
}

/**
 * Türkçe metin → arama/eşleştirme anahtarı (firma adı vb.).
 * Eski app'teki companyKey() yerine geçer.
 */
export function trSlug(s: string): string {
  const map: Record<string, string> = {
    ç: 'c', Ç: 'c', ğ: 'g', Ğ: 'g', ı: 'i', İ: 'i',
    ö: 'o', Ö: 'o', ş: 's', Ş: 's', ü: 'u', Ü: 'u',
  };
  return (s ?? '')
    .replace(/[çÇğĞıİöÖşŞüÜ]/g, (c) => map[c] ?? c)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
