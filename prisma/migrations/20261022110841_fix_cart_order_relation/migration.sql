/*
  Warnings:

  - The primary key for the `Coupon` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `milestoneOrderNumber` on the `Coupon` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `Coupon` table. All the data in the column will be lost.
  - You are about to drop the column `cartId` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `discountAmountCents` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `grossAmountCents` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `idempotencyKey` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `netAmountCents` on the `Order` table. All the data in the column will be lost.
  - Added the required column `totalCents` to the `Order` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Coupon" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "discountPercent" INTEGER NOT NULL,
    "usesRemaining" INTEGER NOT NULL DEFAULT 1,
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Coupon" ("code", "createdAt", "discountPercent", "id") SELECT "code", "createdAt", "discountPercent", "id" FROM "Coupon";
DROP TABLE "Coupon";
ALTER TABLE "new_Coupon" RENAME TO "Coupon";
CREATE UNIQUE INDEX "Coupon_code_key" ON "Coupon"("code");
CREATE TABLE "new_Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "totalCents" INTEGER NOT NULL,
    "subtotalCents" INTEGER NOT NULL DEFAULT 0,
    "discountCents" INTEGER NOT NULL DEFAULT 0,
    "couponCodeUsed" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Order" ("createdAt", "id") SELECT "createdAt", "id" FROM "Order";
DROP TABLE "Order";
ALTER TABLE "new_Order" RENAME TO "Order";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
