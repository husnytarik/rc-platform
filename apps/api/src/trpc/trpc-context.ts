import type { CreateFastifyContextOptions } from '@trpc/server/adapters/fastify';
import type { Role } from '@rc/shared';
import type { PrismaService } from '../prisma/prisma.service';
import type { TokenService } from '../auth/token.service';

export interface AuthedMembership {
  orgId: string;
  role: Role;
  branchScope: unknown;
}

export interface AuthedUser {
  id: string;
  phone: string | null;
  fullName: string | null;
  /** Yalnızca aktif üyelikler. Boşsa hesap onay bekliyor. */
  memberships: AuthedMembership[];
  /** Aktif üyeliklerdeki benzersiz roller. */
  roles: Role[];
}

export interface TrpcContext {
  reqInfo: { ip?: string; userAgent?: string; deviceId?: string };
  /** Geçerli access token yoksa null — publicProcedure yine çalışır. */
  user: AuthedUser | null;
}

interface ContextDeps {
  tokens: TokenService;
  prisma: PrismaService;
}

/**
 * Her istekte context'i kurar: Bearer token'ı doğrula, kullanıcıyı + aktif
 * üyeliklerini yükle. Token yoksa/geçersizse `user: null` — protectedProcedure
 * reddeder, publicProcedure geçer.
 */
export function makeCreateContext(deps: ContextDeps) {
  return async function createContext({ req }: CreateFastifyContextOptions): Promise<TrpcContext> {
    const reqInfo = {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      deviceId: (req.headers['x-device-id'] as string | undefined) ?? undefined,
    };

    const header = req.headers['authorization'];
    const token =
      typeof header === 'string' && header.startsWith('Bearer ') ? header.slice(7).trim() : null;
    if (!token) return { reqInfo, user: null };

    let userId: string;
    try {
      userId = (await deps.tokens.verifyAccess(token)).sub;
    } catch {
      return { reqInfo, user: null };
    }

    const user = await deps.prisma.user.findUnique({
      where: { id: userId },
      include: { memberships: { where: { status: 'active' } } },
    });
    if (!user) return { reqInfo, user: null };

    const memberships: AuthedMembership[] = user.memberships.map((m) => ({
      orgId: m.orgId,
      role: m.role as Role,
      branchScope: m.branchScope,
    }));

    return {
      reqInfo,
      user: {
        id: user.id,
        phone: user.phone,
        fullName: user.fullName,
        memberships,
        roles: [...new Set(memberships.map((m) => m.role))],
      },
    };
  };
}
