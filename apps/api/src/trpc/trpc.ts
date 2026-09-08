import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import { ZodError } from 'zod';
import { canAny, type Capability } from '@rc/shared';
import type { AuthedUser, TrpcContext } from './trpc-context';

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    // Stack trace'i yanıttan çıkar — sunucu yolları sızmasın (log'da kalır).
    const { stack: _stack, ...data } = shape.data;
    return {
      ...shape,
      data: {
        ...data,
        // Girdi doğrulama hatası → alan bazlı ayrıntı (tRPC'nin ortak sözleşmesi)
        zod: error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const router = t.router;
export const middleware = t.middleware;

/** Oturum gerektirmez (OTP iste/doğrula, refresh). */
export const publicProcedure = t.procedure;

const requireAuth = t.middleware(({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Oturum gerekli.' });
  return next({ ctx: { ...ctx, user: ctx.user } });
});

/** Geçerli access token şart. `ctx.user` non-null olarak daraltılır. */
export const protectedProcedure = t.procedure.use(requireAuth);

/**
 * Oturum + aktif üyelik + RBAC matrisinde yeterli rol şart. Satır bazlı kapsam
 * (hangi firma / hangi şube) ilgili resolver içinde ayrıca uygulanır.
 */
export function capabilityProcedure(cap: Capability) {
  return protectedProcedure.use(({ ctx, next }) => {
    const user = ctx.user as AuthedUser;
    if (user.memberships.length === 0) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Hesabınız henüz onaylanmadı.' });
    }
    if (!canAny(user.roles, cap)) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    }
    return next();
  });
}

/** Verilen yeteneklerden en az biri yetiyorsa geçer (ör. `view.own` VEYA `view.all`). */
export function capabilityAnyProcedure(caps: readonly Capability[]) {
  return protectedProcedure.use(({ ctx, next }) => {
    const user = ctx.user as AuthedUser;
    if (user.memberships.length === 0) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Hesabınız henüz onaylanmadı.' });
    }
    if (!caps.some((c) => canAny(user.roles, c))) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    }
    return next();
  });
}
