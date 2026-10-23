-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Coupon" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "discountPercent" INTEGER NOT NULL,
    "usesRemaining" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "milestoneOrderNumber" INTEGER,
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Coupon" ("code", "createdAt", "discountPercent", "expiresAt", "id", "usesRemaining") SELECT "code", "createdAt", "discountPercent", "expiresAt", "id", "usesRemaining" FROM "Coupon";
DROP TABLE "Coupon";
ALTER TABLE "new_Coupon" RENAME TO "Coupon";
CREATE UNIQUE INDEX "Coupon_code_key" ON "Coupon"("code");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
