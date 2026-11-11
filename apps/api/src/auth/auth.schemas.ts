import { z } from 'zod';

/** Ham telefon — normalizasyon (E.164) sunucuda `toE164TR` ile yapılır. */
export const phoneField = z.string().min(7).max(20);
export const tcField = z.string().min(11).max(14);

export const requestOtpSchema = z.object({ tc: tcField, phone: phoneField });

export const verifyOtpSchema = z.object({
  tc: tcField,
  phone: phoneField,
  // Müşteri: 6 haneli SMS kodu. Yönetici (SMS_MOCK modunda): ADMIN_PASSWORD.
  code: z.string().min(6).max(64),
});

/** Telefon artık SMS ile doğrulanmış oturumdan gelir; eski istemciler için isteğe bağlı kalır. */
export const membershipRequestSchema = z.object({
  phone: phoneField.optional(),
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

export type RequestOtpInput = z.infer<typeof requestOtpSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
export type MembershipRequestInput = z.infer<typeof membershipRequestSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
