-- Son SMS doğrulama zamanı; mevcut kullanıcılar için şimdi sayılır. Eklemelidir.
ALTER TABLE "users" ADD COLUMN "smsVerifiedAt" TIMESTAMP(3);
UPDATE "users" SET "smsVerifiedAt" = NOW();
