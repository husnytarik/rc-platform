-- Satış personeli iskonto limiti. Eklemelidir.
ALTER TABLE "memberships" ADD COLUMN "maxDiscountPct" DECIMAL(5,2) NOT NULL DEFAULT 0;
