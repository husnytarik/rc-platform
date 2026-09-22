import type { Capability } from '@rc/shared';

/**
 * Sol menü + erişim eşlemesi. Kabuk aşamasında yalnız "Siparişler" işlevsel;
 * diğerleri route'u hazır "yakında" ekranı. `cap` görünürlüğü kontrol eder —
 * satır bazlı kapsamı sunucu ayrıca zorlar.
 */
export interface NavItem {
  key: string;
  label: string;
  href: string;
  cap: Capability;
  ready?: boolean;
  /** Kısa "yakında" açıklaması (placeholder ekranında gösterilir). */
  planned?: string;
}

export const NAV: NavItem[] = [
  {
    key: 'siparisler',
    label: 'Siparişler',
    href: '/siparisler',
    cap: 'order.view.all',
    ready: true,
  },
  {
    key: 'basvurular',
    label: 'Başvurular',
    href: '/basvurular',
    cap: 'membership.review',
    ready: true,
  },
  {
    key: 'katalog',
    label: 'Katalog',
    href: '/katalog',
    cap: 'catalog.view',
    ready: true,
  },
  {
    key: 'fiyatlar',
    label: 'Fiyat Listeleri',
    href: '/fiyatlar',
    cap: 'price.view',
    planned: 'Varsayılan / grup / müşteriye özel fiyat listeleri ve kademeler.',
  },
  {
    key: 'stok',
    label: 'Stok',
    href: '/stok',
    cap: 'catalog.view',
    ready: true,
  },
  {
    key: 'musteriler',
    label: 'Müşteriler',
    href: '/musteriler',
    cap: 'customer.manage',
    ready: true,
  },
  {
    key: 'destek',
    label: 'Destek',
    href: '/destek',
    cap: 'ticket.handle',
    planned: 'Siparişe bağlı destek talepleri, thread görünümü.',
  },
  {
    key: 'duyurular',
    label: 'Duyurular',
    href: '/duyurular',
    cap: 'announcement.manage',
    planned: 'Hedefli duyuru yayını, okunma takibi.',
  },
  {
    key: 'raporlar',
    label: 'Raporlar',
    href: '/raporlar',
    cap: 'report.view',
    planned: 'Satış / üretim / stok raporları (Metabase gömülü).',
  },
  {
    key: 'ayarlar',
    label: 'Ayarlar',
    href: '/ayarlar',
    cap: 'import.run',
    planned: 'Sistem ayarları, entegrasyonlar, içe aktarma işleri.',
  },
];

export const NAV_BY_KEY: Record<string, NavItem> = Object.fromEntries(
  NAV.map((item) => [item.key, item]),
);
