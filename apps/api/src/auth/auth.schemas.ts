import { z } from 'zod';

/** Ham telefon — normalizasyon (E.164) sunucuda `toE164TR` ile yapılır. */
export const phoneField = z.string().min(7).max(20);

export const otpPurposeSchema = z.enum(['login', 'register', 'add_device']).default('login');

export const registerSchema = z.object({
  fullName: z.string().min(2),
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

export const requestOtpSchema = z.object({
  phone: phoneField,
  purpose: otpPurposeSchema,
});

export const verifyOtpSchema = z.object({
  phone: phoneField,
  code: z.string().length(6),
  register: registerSchema.optional(),
});

export const refreshSchema = z.object({ refreshToken: z.string().min(20) });

export type RequestOtpInput = z.infer<typeof requestOtpSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
