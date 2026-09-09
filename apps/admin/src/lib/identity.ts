import type { Role } from '@rc/shared';

export interface Identity {
  id: string;
  phone: string;
  fullName: string | null;
  roles: Role[];
  memberships: { orgId: string; role: Role; branchScope: unknown }[];
  /** En az bir aktif üyelik yoksa başvuru onay bekliyor demektir. */
  pending: boolean;
}

/**
 * Kimlik, oturum boyunca birkaç sağlayıcı tarafından (auth, accessControl,
 * layout) okunur. `auth.me` çağrısını tekrarlamamak için hafif önbellek.
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
