/*
  Warnings:

  - You are about to alter the column `qty` on the `order_lines` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `Decimal(12,3)`.
  - You are about to drop the column `unit` on the `product_variants` table. All the data in the column will be lost.
  - You are about to alter the column `delta` on the `stock_movements` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `Decimal(12,3)`.

*/
-- CreateEnum
CREATE TYPE "Uom" AS ENUM ('g', 'kg', 'ml', 'cl', 'l', 'adet', 'paket', 'kutu', 'koli', 'cuval');

-- AlterTable
ALTER TABLE "order_lines" ADD COLUMN     "uomSnapshot" "Uom" NOT NULL DEFAULT 'adet',
ALTER COLUMN "qty" SET DATA TYPE DECIMAL(12,3);

-- AlterTable
ALTER TABLE "product_variants" DROP COLUMN "unit",
ADD COLUMN     "contentAmount" DECIMAL(12,3),
ADD COLUMN     "contentUom" "Uom",
ADD COLUMN     "lowStockThreshold" DECIMAL(12,3),
ADD COLUMN     "minOrderQty" DECIMAL(12,3) NOT NULL DEFAULT 1,
ADD COLUMN     "orderUom" "Uom" NOT NULL DEFAULT 'adet',
ADD COLUMN     "qtyStep" DECIMAL(12,3) NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "stock_movements" ALTER COLUMN "delta" SET DATA TYPE DECIMAL(12,3);
