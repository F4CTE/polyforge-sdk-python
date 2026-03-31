-- AlterTable: add optional marketId foreign key to strategies
ALTER TABLE "strategies" ADD COLUMN "marketId" VARCHAR(255);

-- AddForeignKey
ALTER TABLE "strategies" ADD CONSTRAINT "strategies_marketId_fkey"
  FOREIGN KEY ("marketId") REFERENCES "markets"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "strategies_marketId_idx" ON "strategies"("marketId");
