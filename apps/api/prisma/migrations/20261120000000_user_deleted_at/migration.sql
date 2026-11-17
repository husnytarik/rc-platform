-- Hesap soft-delete zamanı. Eklemelidir.
ALTER TABLE "users" ADD COLUMN "deletedAt" TIMESTAMP(3);
