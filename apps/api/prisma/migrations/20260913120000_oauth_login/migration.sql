-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('google', 'apple');

-- DropForeignKey
ALTER TABLE "otp_challenges" DROP CONSTRAINT "otp_challenges_userId_fkey";

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "provider" "AuthProvider" NOT NULL,
ADD COLUMN     "providerUserId" TEXT NOT NULL,
ALTER COLUMN "phone" DROP NOT NULL;

-- DropTable
DROP TABLE "otp_challenges";

-- DropEnum
DROP TYPE "OtpPurpose";

-- DropEnum
DROP TYPE "OtpStatus";

-- CreateIndex
CREATE UNIQUE INDEX "users_provider_providerUserId_key" ON "users"("provider", "providerUserId");
