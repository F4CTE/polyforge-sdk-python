-- CreateEnum
CREATE TYPE "conditional_order_type" AS ENUM ('TAKE_PROFIT', 'STOP_LOSS', 'TRAILING_STOP', 'LIMIT', 'PEGGED');

-- CreateEnum
CREATE TYPE "conditional_order_status" AS ENUM ('PENDING', 'TRIGGERED', 'CANCELLED', 'EXPIRED', 'FAILED');

-- CreateEnum
CREATE TYPE "copy_mode" AS ENUM ('PERCENTAGE', 'FIXED', 'MIRROR');

-- CreateEnum
CREATE TYPE "copy_status" AS ENUM ('ACTIVE', 'PAUSED', 'STOPPED', 'ERROR');

-- CreateEnum
CREATE TYPE "news_sentiment" AS ENUM ('POSITIVE', 'NEGATIVE', 'NEUTRAL');

-- AlterTable
ALTER TABLE "strategies" ADD COLUMN     "parentStrategyId" TEXT;

-- CreateTable
CREATE TABLE "whale_alerts" (
    "id" TEXT NOT NULL,
    "walletAddress" VARCHAR(255) NOT NULL,
    "marketId" TEXT NOT NULL,
    "tokenId" VARCHAR(255) NOT NULL,
    "side" "OrderSide" NOT NULL,
    "outcome" "OrderOutcome" NOT NULL,
    "size" DECIMAL(20,6) NOT NULL,
    "price" DECIMAL(10,6) NOT NULL,
    "notional" DECIMAL(20,6) NOT NULL,
    "txHash" VARCHAR(255),
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whale_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whale_follows" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "walletAddress" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whale_follows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whale_profiles" (
    "walletAddress" VARCHAR(255) NOT NULL,
    "totalVolume" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "totalPnl" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "tradeCount" INTEGER NOT NULL DEFAULT 0,
    "winRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "lastTradeAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whale_profiles_pkey" PRIMARY KEY ("walletAddress")
);

-- CreateTable
CREATE TABLE "copy_configs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "targetWallet" VARCHAR(255) NOT NULL,
    "mode" "copy_mode" NOT NULL DEFAULT 'PERCENTAGE',
    "sizeValue" DECIMAL(20,6) NOT NULL DEFAULT 10,
    "maxExposure" DECIMAL(20,6) NOT NULL DEFAULT 500,
    "maxDailyLoss" DECIMAL(20,6) NOT NULL DEFAULT 100,
    "priceOffset" DECIMAL(10,6) NOT NULL DEFAULT 0,
    "status" "copy_status" NOT NULL DEFAULT 'ACTIVE',
    "totalPnl" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "totalCopied" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "stoppedAt" TIMESTAMP(3),

    CONSTRAINT "copy_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "copy_trades" (
    "id" TEXT NOT NULL,
    "configId" TEXT NOT NULL,
    "sourceWallet" VARCHAR(255) NOT NULL,
    "sourceTxHash" VARCHAR(255),
    "marketId" TEXT NOT NULL,
    "tokenId" VARCHAR(255) NOT NULL,
    "side" "OrderSide" NOT NULL,
    "outcome" "OrderOutcome" NOT NULL,
    "sourceSize" DECIMAL(20,6) NOT NULL,
    "sourcePrice" DECIMAL(10,6) NOT NULL,
    "copiedSize" DECIMAL(20,6) NOT NULL,
    "copiedPrice" DECIMAL(10,6),
    "status" VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    "orderId" TEXT,
    "pnl" DECIMAL(20,6),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "copy_trades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conditional_orders" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "tokenId" VARCHAR(255) NOT NULL,
    "type" "conditional_order_type" NOT NULL,
    "side" "OrderSide" NOT NULL,
    "outcome" "OrderOutcome" NOT NULL,
    "size" DECIMAL(20,6) NOT NULL,
    "triggerPrice" DECIMAL(10,6) NOT NULL,
    "limitPrice" DECIMAL(10,6),
    "trailingPct" DECIMAL(5,2),
    "peakPrice" DECIMAL(10,6),
    "status" "conditional_order_status" NOT NULL DEFAULT 'PENDING',
    "triggeredAt" TIMESTAMP(3),
    "orderId" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conditional_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "news_articles" (
    "id" TEXT NOT NULL,
    "source" VARCHAR(100) NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "summary" TEXT,
    "url" VARCHAR(1000) NOT NULL,
    "imageUrl" VARCHAR(1000),
    "sentiment" "news_sentiment" NOT NULL DEFAULT 'NEUTRAL',
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "news_articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "news_signals" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "direction" VARCHAR(10) NOT NULL,
    "outcome" VARCHAR(10) NOT NULL,
    "confidence" INTEGER NOT NULL,
    "reasoning" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "news_signals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "whale_alerts_walletAddress_idx" ON "whale_alerts"("walletAddress");

-- CreateIndex
CREATE INDEX "whale_alerts_marketId_idx" ON "whale_alerts"("marketId");

-- CreateIndex
CREATE INDEX "whale_alerts_detectedAt_idx" ON "whale_alerts"("detectedAt" DESC);

-- CreateIndex
CREATE INDEX "whale_follows_walletAddress_idx" ON "whale_follows"("walletAddress");

-- CreateIndex
CREATE UNIQUE INDEX "whale_follows_userId_walletAddress_key" ON "whale_follows"("userId", "walletAddress");

-- CreateIndex
CREATE INDEX "copy_configs_userId_idx" ON "copy_configs"("userId");

-- CreateIndex
CREATE INDEX "copy_configs_targetWallet_idx" ON "copy_configs"("targetWallet");

-- CreateIndex
CREATE INDEX "copy_configs_status_idx" ON "copy_configs"("status");

-- CreateIndex
CREATE UNIQUE INDEX "copy_configs_userId_targetWallet_key" ON "copy_configs"("userId", "targetWallet");

-- CreateIndex
CREATE INDEX "copy_trades_configId_idx" ON "copy_trades"("configId");

-- CreateIndex
CREATE INDEX "copy_trades_createdAt_idx" ON "copy_trades"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "conditional_orders_userId_status_idx" ON "conditional_orders"("userId", "status");

-- CreateIndex
CREATE INDEX "conditional_orders_tokenId_status_idx" ON "conditional_orders"("tokenId", "status");

-- CreateIndex
CREATE INDEX "conditional_orders_expiresAt_idx" ON "conditional_orders"("expiresAt");

-- CreateIndex
CREATE INDEX "news_articles_publishedAt_idx" ON "news_articles"("publishedAt" DESC);

-- CreateIndex
CREATE INDEX "news_articles_source_idx" ON "news_articles"("source");

-- CreateIndex
CREATE UNIQUE INDEX "news_articles_url_key" ON "news_articles"("url");

-- CreateIndex
CREATE INDEX "news_signals_marketId_idx" ON "news_signals"("marketId");

-- CreateIndex
CREATE INDEX "news_signals_confidence_idx" ON "news_signals"("confidence" DESC);

-- CreateIndex
CREATE INDEX "news_signals_createdAt_idx" ON "news_signals"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "strategies_parentStrategyId_idx" ON "strategies"("parentStrategyId");

-- CreateIndex
CREATE INDEX "strategy_comments_strategyId_createdAt_idx" ON "strategy_comments"("strategyId", "createdAt");

-- AddForeignKey
ALTER TABLE "strategies" ADD CONSTRAINT "strategies_parentStrategyId_fkey" FOREIGN KEY ("parentStrategyId") REFERENCES "strategies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whale_alerts" ADD CONSTRAINT "whale_alerts_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "markets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whale_follows" ADD CONSTRAINT "whale_follows_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "copy_configs" ADD CONSTRAINT "copy_configs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "copy_trades" ADD CONSTRAINT "copy_trades_configId_fkey" FOREIGN KEY ("configId") REFERENCES "copy_configs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conditional_orders" ADD CONSTRAINT "conditional_orders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conditional_orders" ADD CONSTRAINT "conditional_orders_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "markets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_signals" ADD CONSTRAINT "news_signals_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "news_articles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_signals" ADD CONSTRAINT "news_signals_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "markets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
