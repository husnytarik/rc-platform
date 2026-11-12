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
  icon: string;
}

export const PRODUCER_NAV: ProducerNavItem[] = [
  { key: 'siparisler', label: 'Siparişler', hint: 'Sipariş akışı ve durum geçişleri', href: '/producer/siparisler', cap: 'order.view.all', primary: true, icon: '📦' },
  { key: 'basvurular', label: 'Başvurular', hint: 'Yeni müşteri başvuruları', href: '/producer/basvurular', cap: 'membership.review', primary: true, icon: '📝' },
  { key: 'katalog', label: 'Katalog', hint: 'Ürün ve varyant yönetimi', href: '/producer/katalog', cap: 'catalog.view', primary: true, icon: '☕' },
  { key: 'destek', label: 'Destek', hint: 'Müşteri destek talepleri', href: '/producer/destek', cap: 'ticket.handle', primary: true, icon: '💬' },
  { key: 'stok', label: 'Stok', hint: 'Stok ve rezervasyonlar', href: '/producer/stok', cap: 'catalog.view', primary: false, icon: '📊' },
  { key: 'musteriler', label: 'Müşteriler', hint: 'Firmalar, şubeler, kullanıcılar', href: '/producer/musteriler', cap: 'customer.manage', primary: false, icon: '🏢' },
  { key: 'servisler', label: 'Servisler', hint: 'Servis kataloğu ve talepler', href: '/producer/servisler', cap: 'service.manage', primary: false, icon: '🛠️' },
  { key: 'duyurular', label: 'Duyurular', hint: 'Müşterilere duyuru ve bildirim gönder', href: '/producer/duyurular', cap: 'announcement.manage', primary: false, icon: '📣' },
  { key: 'excel', label: 'Excel', hint: 'Kataloğu Excel ile içe/dışa aktar', href: '/producer/excel', cap: 'catalog.manage', primary: false, icon: '📑' },
  { key: 'raporlar', label: 'Raporlar', hint: 'Ciro, sipariş ve müşteri özetleri', href: '/producer/raporlar', cap: 'report.view', primary: false, icon: '📈' },
];
