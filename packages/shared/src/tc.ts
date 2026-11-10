/**
 * T.C. Kimlik No biçim doğrulaması (11 hane + sağlama basamakları).
 * Bu yalnızca BİÇİM kontrolüdür; numaranın gerçek bir kişiye ait olduğunu NVİ'ye sormaz.
 */
export function normalizeTc(input: string): string {
  return (input ?? '').replace(/\D/g, '');
}

export function isValidTcKimlik(input: string): boolean {
  const s = normalizeTc(input);
  if (!/^[1-9]\d{10}$/.test(s)) return false;
  const d = s.split('').map(Number) as number[];
  const odd = d[0]! + d[2]! + d[4]! + d[6]! + d[8]!;
  const even = d[1]! + d[3]! + d[5]! + d[7]!;
  const d10 = (((odd * 7 - even) % 10) + 10) % 10;
  if (d10 !== d[9]) return false;
  const d11 = d.slice(0, 10).reduce((a, b) => a + b, 0) % 10;
  return d11 === d[10];
}
