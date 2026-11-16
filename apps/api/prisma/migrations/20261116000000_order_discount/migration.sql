-- Sipariş indirimi (yalnız yönetici). Eklemelidir; eski kayıtlar 0 indirimle kalır.
ALTER TABLE "orders" ADD COLUMN "discountType" TEXT;
ALTER TABLE "orders" ADD COLUMN "discountValue" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "orders" ADD COLUMN "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;
