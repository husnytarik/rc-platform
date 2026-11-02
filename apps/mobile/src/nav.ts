import type { Capability } from '@rc/shared';

/**
 * Üretici tarafı ekran listesi. `cap` görünürlüğü kontrol eder — satır bazlı
 * kapsamı sunucu ayrıca zorlar. `primary` olanlar alt sekme çubuğunda, diğerleri
 * "Daha fazla" menüsünde listelenir (çubuk 5 sekmeyi aşmasın diye).
 */
export interface ProducerNavItem {
  key: string;
  label: string;
  hint: string;
  href: string;
  cap: Capability;
  primary: boolean;
}

export const PRODUCER_NAV: ProducerNavItem[] = [
  { key: 'siparisler', label: 'Siparişler', hint: 'Sipariş akışı ve durum geçişleri', href: '/producer/siparisler', cap: 'order.view.all', primary: true },
  { key: 'basvurular', label: 'Başvurular', hint: 'Yeni müşteri başvuruları', href: '/producer/basvurular', cap: 'membership.review', primary: true },
  { key: 'katalog', label: 'Katalog', hint: 'Ürün ve varyant yönetimi', href: '/producer/katalog', cap: 'catalog.view', primary: true },
  { key: 'destek', label: 'Destek', hint: 'Müşteri destek talepleri', href: '/producer/destek', cap: 'ticket.handle', primary: true },
  { key: 'stok', label: 'Stok', hint: 'Stok ve rezervasyonlar', href: '/producer/stok', cap: 'catalog.view', primary: false },
  { key: 'musteriler', label: 'Müşteriler', hint: 'Firmalar, şubeler, kullanıcılar', href: '/producer/musteriler', cap: 'customer.manage', primary: false },
  { key: 'servisler', label: 'Servisler', hint: 'Servis kataloğu ve talepler', href: '/producer/servisler', cap: 'service.manage', primary: false },
  { key: 'duyurular', label: 'Duyurular', hint: 'Müşterilere duyuru ve bildirim gönder', href: '/producer/duyurular', cap: 'announcement.manage', primary: false },
];
