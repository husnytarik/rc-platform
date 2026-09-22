import type { Capability } from '@rc/shared';

/**
 * Üretici tarafı sekme listesi. `cap` görünürlüğü kontrol eder — satır bazlı
 * kapsamı sunucu ayrıca zorlar. Yalnızca gerçek bir tRPC router'ı olan
 * ekranlar burada — arka ucu olmayanlar (Destek, Duyurular, Raporlar,
 * Fiyat Listeleri) henüz eklenmedi.
 */
export interface ProducerNavItem {
  key: string;
  label: string;
  href: '/producer/siparisler' | '/producer/basvurular' | '/producer/katalog' | '/producer/stok' | '/producer/musteriler';
  cap: Capability;
}

export const PRODUCER_NAV: ProducerNavItem[] = [
  { key: 'siparisler', label: 'Siparişler', href: '/producer/siparisler', cap: 'order.view.all' },
  { key: 'basvurular', label: 'Başvurular', href: '/producer/basvurular', cap: 'membership.review' },
  { key: 'katalog', label: 'Katalog', href: '/producer/katalog', cap: 'catalog.view' },
  { key: 'stok', label: 'Stok', href: '/producer/stok', cap: 'catalog.view' },
  { key: 'musteriler', label: 'Müşteriler', href: '/producer/musteriler', cap: 'customer.manage' },
];
