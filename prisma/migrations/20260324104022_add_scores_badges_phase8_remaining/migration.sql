-- CreateTable
CREATE TABLE "trader_scores" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "winRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "sharpeRatio" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "avgReturn" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "totalTrades" INTEGER NOT NULL DEFAULT 0,
    "profitFactor" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "maxDrawdown" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "consistency" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trader_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trader_badges" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trader_badges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "trader_scores_userId_key" ON "trader_scores"("userId");

-- CreateIndex
CREATE INDEX "trader_scores_score_idx" ON "trader_scores"("score" DESC);

-- CreateIndex
CREATE INDEX "trader_badges_userId_idx" ON "trader_badges"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "trader_badges_userId_type_key" ON "trader_badges"("userId", "type");

-- AddForeignKey
ALTER TABLE "trader_scores" ADD CONSTRAINT "trader_scores_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trader_badges" ADD CONSTRAINT "trader_badges_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
