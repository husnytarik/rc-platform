import type { AuthService } from '../../auth/auth.service';
import { refreshSchema, requestOtpSchema, verifyOtpSchema } from '../../auth/auth.schemas';
import { protectedProcedure, publicProcedure, router } from '../trpc';

/**
 * Kimlik uçları. REST `AuthController` ile aynı zod sözleşmesini paylaşır
 * (`auth.schemas.ts`) — REST yüzeyi istemciler tRPC'ye geçince kaldırılacak.
 */
export function makeAuthRouter(auth: AuthService) {
  return router({
    requestOtp: publicProcedure
      .input(requestOtpSchema)
      .mutation(({ input, ctx }) => auth.requestOtp(input.phone, input.purpose, ctx.reqInfo)),

    verifyOtp: publicProcedure
      .input(verifyOtpSchema)
      .mutation(({ input, ctx }) =>
        auth.verifyOtp(input.phone, input.code, ctx.reqInfo, input.register),
      ),

    refresh: publicProcedure
      .input(refreshSchema)
      .mutation(({ input, ctx }) => auth.refresh(input.refreshToken, ctx.reqInfo)),

    logout: publicProcedure.input(refreshSchema).mutation(async ({ input }) => {
      await auth.logout(input.refreshToken);
      return { ok: true };
    }),

    /** Oturum sahibinin kendi profili + rolleri (istemci açılışta çağırır). */
    me: protectedProcedure.query(({ ctx }) => ({
      id: ctx.user.id,
      phone: ctx.user.phone,
      fullName: ctx.user.fullName,
      memberships: ctx.user.memberships,
      roles: ctx.user.roles,
    })),
  });
}
