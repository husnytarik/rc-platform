import { z } from 'zod';

/** Ham telefon — normalizasyon (E.164) sunucuda `toE164TR` ile yapılır. */
export const phoneField = z.string().min(7).max(20);

export const authProviderSchema = z.enum(['google', 'apple']);

export const oauthLoginSchema = z.object({
  provider: authProviderSchema,
  idToken: z.string().min(10),
  /** Apple yalnızca ilk yetkilendirmede ad-soyad döner — o an istemciden gelir. */
  fullName: z.string().min(2).optional(),
});

export const membershipRequestSchema = z.object({
  phone: phoneField,
  orgName: z.string().min(2),
  taxId: z.string().optional(),
  address: z.string().optional(),
  branches: z
    .array(
      z.object({
        name: z.string().min(1),
        address: z.string().optional(),
        phone: z.string().optional(),
      }),
    )
    .optional(),
  note: z.string().optional(),
});

export const refreshSchema = z.object({ refreshToken: z.string().min(20) });

export type OauthLoginInput = z.infer<typeof oauthLoginSchema>;
export type MembershipRequestInput = z.infer<typeof membershipRequestSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
