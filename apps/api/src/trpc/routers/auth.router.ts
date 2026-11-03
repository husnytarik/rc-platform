import { z } from 'zod';
import type { AuthService } from '../../auth/auth.service';
import { membershipRequestSchema, oauthLoginSchema, refreshSchema } from '../../auth/auth.schemas';
import { protectedProcedure, publicProcedure, router } from '../trpc';

export function makeAuthRouter(auth: AuthService) {
  return router({
    oauthLogin: publicProcedure
      .input(oauthLoginSchema)
      .mutation(({ input, ctx }) =>
        auth.oauthLogin(input.provider, input.idToken, ctx.reqInfo, input.fullName),
      ),

    /** Gizli kodla demo girişi; sunucuda kod tanımlı değilse kapalıdır. */
    demoLogin: publicProcedure
      .input(z.object({ code: z.string().min(4).max(100) }))
      .mutation(({ input, ctx }) => auth.demoLogin(input.code, ctx.reqInfo)),

    /** Google/Apple ile ilk giriş sonrası, üyeliği bekleyen kullanıcının kayıt formu. */
    submitMembershipRequest: protectedProcedure
      .input(membershipRequestSchema)
      .mutation(({ input, ctx }) => auth.submitMembershipRequest(ctx.user.id, input, ctx.reqInfo)),

    refresh: publicProcedure
      .input(refreshSchema)
      .mutation(({ input, ctx }) => auth.refresh(input.refreshToken, ctx.reqInfo)),

    logout: publicProcedure.input(refreshSchema).mutation(async ({ input }) => {
      await auth.logout(input.refreshToken);
      return { ok: true };
    }),

    /** Oturum sahibinin kendi profili + rolleri (istemci açılışta çağırır). */
    me: protectedProcedure.query(async ({ ctx }) => ({
      id: ctx.user.id,
      phone: ctx.user.phone,
      fullName: ctx.user.fullName,
      memberships: ctx.user.memberships,
      roles: ctx.user.roles,
      hasPendingRequest:
        ctx.user.memberships.length === 0
          ? await auth.hasPendingMembershipRequest(ctx.user.id)
          : false,
    })),
  });
}
