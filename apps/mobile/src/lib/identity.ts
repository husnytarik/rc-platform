import type { Role } from '@rc/shared';

export interface Identity {
  id: string;
  /** Google/Apple ile giriş kimliği telefon taşımaz — kayıt formunda toplanana kadar null. */
  phone: string | null;
  fullName: string | null;
  roles: Role[];
  memberships: { orgId: string; role: Role; branchScope: unknown }[];
  /** En az bir aktif üyelik yoksa başvuru onay bekliyor demektir. */
  pending: boolean;
  /** pending iken: kayıt formu zaten dolduruldu mu (true) yoksa önce form mu gösterilmeli. */
  hasPendingRequest: boolean;
}

/**
 * Kimlik, oturum boyunca birkaç yerden okunur. `auth.me` çağrısını
 * tekrarlamamak için hafif önbellek.
 */
let cache: Identity | null = null;

export const identityCache = {
  get: (): Identity | null => cache,
  set: (value: Identity | null): void => {
    cache = value;
  },
  clear: (): void => {
    cache = null;
  },
};
