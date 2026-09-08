import type { Role } from './roles';

/**
 * Sipariş durum makinesi. Tek gerçek kaynak — API bu tabloya karşı doğrular,
 * mobil/admin sadece "sıradaki adımlar"ı buradan hesaplar.
 */
export const ORDER_STATUSES = [
  'placed', // Sipariş Verildi
  'confirmed', // Onaylandı
  'in_production', // Üretimde
  'production_done', // Üretim Tamamlandı
  'ready_to_ship', // Sevkiyata Hazır
  'in_transit', // Yolda
  'delivered', // Teslim Edildi
  'cancelled', // İptal
  'delivery_issue', // Teslimat Sorunu
  'on_hold', // Beklemede
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABELS_TR: Record<OrderStatus, string> = {
  placed: 'Sipariş Verildi',
  confirmed: 'Onaylandı',
  in_production: 'Üretimde',
  production_done: 'Üretim Tamamlandı',
  ready_to_ship: 'Sevkiyata Hazır',
  in_transit: 'Yolda',
  delivered: 'Teslim Edildi',
  cancelled: 'İptal',
  delivery_issue: 'Teslimat Sorunu',
  on_hold: 'Beklemede',
};

/** Ana hat (mutlu yol) — müşteri takip ekranında zaman çizelgesi olarak gösterilir. */
export const MAIN_LINE: readonly OrderStatus[] = [
  'placed',
  'confirmed',
  'in_production',
  'production_done',
  'ready_to_ship',
  'in_transit',
  'delivered',
];

export const TERMINAL_STATUSES: readonly OrderStatus[] = ['delivered', 'cancelled'];

export interface Transition {
  from: OrderStatus;
  to: OrderStatus;
  /** Bu geçişi tetikleyebilen roller. producer_admin her zaman ek olarak yetkilidir. */
  roles: readonly Role[];
  labelTr: string;
  /** Onaylandı anında aynı transaction içinde stok düşülür. */
  decrementsStock?: boolean;
}

export const TRANSITIONS: readonly Transition[] = [
  { from: 'placed', to: 'confirmed', roles: ['sales_staff'], labelTr: 'Onayla', decrementsStock: true },
  { from: 'confirmed', to: 'in_production', roles: ['production_staff'], labelTr: 'Üretime al' },
  { from: 'in_production', to: 'production_done', roles: ['production_staff'], labelTr: 'Üretimi tamamla' },
  { from: 'production_done', to: 'ready_to_ship', roles: ['production_staff'], labelTr: 'Sevkiyata hazırla' },
  { from: 'ready_to_ship', to: 'in_transit', roles: ['shipping_staff'], labelTr: 'Yola çıkar' },
  { from: 'in_transit', to: 'delivered', roles: ['shipping_staff'], labelTr: 'Teslim edildi' },

  // Yan durumlar
  { from: 'placed', to: 'cancelled', roles: ['sales_staff'], labelTr: 'İptal et' },
  { from: 'confirmed', to: 'cancelled', roles: ['sales_staff'], labelTr: 'İptal et' },
  { from: 'in_production', to: 'cancelled', roles: ['production_staff'], labelTr: 'İptal et' },
  { from: 'in_transit', to: 'delivery_issue', roles: ['shipping_staff'], labelTr: 'Teslimat sorunu bildir' },
  { from: 'delivery_issue', to: 'in_transit', roles: ['shipping_staff'], labelTr: 'Tekrar yola çıkar' },
  { from: 'delivery_issue', to: 'delivered', roles: ['shipping_staff'], labelTr: 'Teslim edildi' },

  // Beklemede: yönetici duraklatır / devam ettirir
  { from: 'confirmed', to: 'on_hold', roles: [], labelTr: 'Beklemeye al' },
  { from: 'in_production', to: 'on_hold', roles: [], labelTr: 'Beklemeye al' },
  { from: 'on_hold', to: 'confirmed', roles: [], labelTr: 'Devam ettir' },
  { from: 'on_hold', to: 'cancelled', roles: [], labelTr: 'İptal et' },
];

/** producer_admin her tanımlı geçişi yapabilir. */
export function canTransition(from: OrderStatus, to: OrderStatus, role: Role): boolean {
  const t = TRANSITIONS.find((x) => x.from === from && x.to === to);
  if (!t) return false;
  if (role === 'producer_admin') return true;
  return t.roles.includes(role);
}

/** Belirli bir durumdan, bu rolün yapabileceği geçişler (UI'da buton üretmek için). */
export function nextTransitions(from: OrderStatus, role: Role): Transition[] {
  return TRANSITIONS.filter(
    (t) => t.from === from && (role === 'producer_admin' || t.roles.includes(role)),
  );
}

export function isTerminal(s: OrderStatus): boolean {
  return TERMINAL_STATUSES.includes(s);
}

/**
 * Bu durumdayken sipariş için stok zaten rezerve edilmiştir (onay anında düşülür).
 * Sipariş bu durumlardan iptal edilirse stok defterine geri ekleme (`order_release`)
 * yazılmalıdır.
 */
const RESERVED_STATUSES: readonly OrderStatus[] = [
  'confirmed',
  'in_production',
  'production_done',
  'ready_to_ship',
  'in_transit',
  'delivered',
  'delivery_issue',
  'on_hold',
];

export function stockIsReserved(s: OrderStatus): boolean {
  return RESERVED_STATUSES.includes(s);
}
