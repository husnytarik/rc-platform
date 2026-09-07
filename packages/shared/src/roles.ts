/**
 * Sistem rolleri. Bir kullanıcının bir veya daha çok "membership" kaydı olur:
 * (user, org, role, branch_scope?). Rol kaba yetkiyi, branch_scope sunucuda
 * satır bazlı kapsamı belirler.
 */
export const ROLES = [
  'producer_admin', // Üretici Yöneticisi
  'sales_staff', // Satış Personeli
  'production_staff', // Üretim Personeli
  'shipping_staff', // Sevkiyat Personeli
  'customer_admin', // Müşteri Firma Yöneticisi
  'branch_manager', // Şube Müdürü
  'customer_user', // Müşteri Kullanıcısı
] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_LABELS_TR: Record<Role, string> = {
  producer_admin: 'Üretici Yöneticisi',
  sales_staff: 'Satış Personeli',
  production_staff: 'Üretim Personeli',
  shipping_staff: 'Sevkiyat Personeli',
  customer_admin: 'Müşteri Firma Yöneticisi',
  branch_manager: 'Şube Müdürü',
  customer_user: 'Müşteri Kullanıcısı',
};

/** Üretici tarafı personeli (producer org'una bağlı). */
export const PRODUCER_ROLES: readonly Role[] = [
  'producer_admin',
  'sales_staff',
  'production_staff',
  'shipping_staff',
];

/** Müşteri firması tarafı kullanıcıları. */
export const CUSTOMER_ROLES: readonly Role[] = ['customer_admin', 'branch_manager', 'customer_user'];

export const isProducerRole = (r: Role): boolean => PRODUCER_ROLES.includes(r);
export const isCustomerRole = (r: Role): boolean => CUSTOMER_ROLES.includes(r);
