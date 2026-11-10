-- Telefon + TC + SMS kodu ile giriş. Tüm değişiklikler eklemelidir (eski kod bozulmaz).

-- AlterEnum
ALTER TYPE "AuthProvider" ADD VALUE 'phone';

-- AlterTable
ALTER TABLE "users" ADD COLUMN "tcHash" TEXT;

-- CreateTable
CREATE TABLE "otp_codes" (
    "id" UUID NOT NULL,
    "phone" TEXT NOT NULL,
    "tcHash" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "ip" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "otp_codes_phone_createdAt_idx" ON "otp_codes"("phone", "createdAt");

-- CreateIndex
CREATE INDEX "otp_codes_createdAt_idx" ON "otp_codes"("createdAt");
