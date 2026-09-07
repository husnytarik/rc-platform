import type { Role } from './roles';

/**
 * Kaba yetki yetenekleri. Satır bazlı kapsam (hangi şube, hangi firma) ayrıca
 * sunucuda `branch_scope` + org eşleşmesiyle uygulanır — bu matris "bu rol bu
 * işi hiç yapabilir mi" sorusunu yanıtlar.
 */
export const CAPABILITIES = [
  'catalog.view',
  'catalog.manage',
  'price.view',
  'price.manage',
  'order.create',
  'order.view.own', // kendi firmasının / şubesinin siparişleri
  'order.view.all', // üretici tarafı: tüm siparişler
  'order.confirm',
  'order.add_line',
  'order.cancel',
  'production.advance',
  'shipping.advance',
  'membership.review', // başvuru onay/red
  'customer.manage', // firma + şube + kullanıcı yönetimi
  'ticket.handle', // destek taleplerini yanıtla
  'announcement.manage',
  'report.view',
  'import.run',
] as const;

export type Capability = (typeof CAPABILITIES)[number];

const ALL: Capability[] = [...CAPABILITIES];

export const ROLE_CAPABILITIES: Record<Role, readonly Capability[]> = {
  producer_admin: ALL,

  sales_staff: [
    'catalog.view',
    'price.view',
    'order.view.all',
    'order.confirm',
    'order.add_line',
    'order.cancel',
    'membership.review',
    'customer.manage',
    'ticket.handle',
    'report.view',
  ],

  production_staff: [
    'catalog.view',
    'price.view',
    'order.view.all',
    'order.add_line',
    'order.cancel',
    'production.advance',
  ],

  shipping_staff: ['order.view.all', 'order.add_line', 'shipping.advance'],

  customer_admin: [
    'catalog.view',
    'price.view',
    'order.create',
    'order.view.own',
    'customer.manage', // yalnızca kendi firması — sunucu kapsamı zorlar
    'ticket.handle',
  ],

  branch_manager: ['catalog.view', 'price.view', 'order.create', 'order.view.own', 'ticket.handle'],

  customer_user: ['catalog.view', 'price.view', 'order.create', 'order.view.own'],
};

export function can(role: Role, cap: Capability): boolean {
  return ROLE_CAPABILITIES[role].includes(cap);
}

/** Birden çok membership'i olan kullanıcı için: rollerden herhangi biri yetiyorsa true. */
export function canAny(roles: readonly Role[], cap: Capability): boolean {
  return roles.some((r) => can(r, cap));
}
