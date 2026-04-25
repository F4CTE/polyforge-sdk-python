-- AlterTable: add journal fields to orders
ALTER TABLE "orders" ADD COLUMN "mood" VARCHAR(12);
ALTER TABLE "orders" ADD COLUMN "note" TEXT;

-- CreateIndex
CREATE INDEX "orders_userId_mood_idx" ON "orders"("userId", "mood");
