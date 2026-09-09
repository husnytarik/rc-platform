const money = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dateTime = new Intl.DateTimeFormat('tr-TR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});
const dateOnly = new Intl.DateTimeFormat('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });

const CURRENCY_SUFFIX: Record<string, string> = { TRY: '₺', USD: '$', EUR: '€' };

/** "5.340,00 ₺" — string tutarı olduğu gibi (sunucudan 2 hane) biçimler. */
export function formatMoney(amount: string | number, currency = 'TRY'): string {
  const n = typeof amount === 'string' ? Number(amount) : amount;
  const suffix = CURRENCY_SUFFIX[currency] ?? currency;
  return `${money.format(Number.isFinite(n) ? n : 0)} ${suffix}`;
}

export function formatDateTime(value: string | Date): string {
  return dateTime.format(typeof value === 'string' ? new Date(value) : value);
}

export function formatDate(value: string | Date): string {
  return dateOnly.format(typeof value === 'string' ? new Date(value) : value);
}

/** Sipariş "yaşı": panoda satır başına hızlı bakış. */
export function relativeAge(value: string | Date): string {
  const then = (typeof value === 'string' ? new Date(value) : value).getTime();
  const diffMin = Math.round((Date.now() - then) / 60000);
  if (diffMin < 1) return 'az önce';
  if (diffMin < 60) return `${diffMin} dk`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `${diffH} sa`;
  const diffD = Math.round(diffH / 24);
  return `${diffD} gün`;
}
