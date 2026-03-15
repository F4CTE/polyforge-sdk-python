-- CreateTable
CREATE TABLE "markets" (
    "id" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" VARCHAR(100),
    "seriesSlug" VARCHAR(255),
    "endDate" TIMESTAMP(3),
    "closed" BOOLEAN NOT NULL DEFAULT false,
    "negRisk" BOOLEAN NOT NULL DEFAULT false,
    "volume24h" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUpdatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "markets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tokens" (
    "id" VARCHAR(255) NOT NULL,
    "marketId" VARCHAR(255) NOT NULL,
    "outcome" VARCHAR(10) NOT NULL,
    "price" DECIMAL(10,6) NOT NULL DEFAULT 0,
    "liquidity" DECIMAL(20,6) NOT NULL DEFAULT 0,

    CONSTRAINT "tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_snapshots" (
    "time" TIMESTAMPTZ NOT NULL,
    "tokenId" VARCHAR(255) NOT NULL,
    "open" DECIMAL(10,6) NOT NULL,
    "high" DECIMAL(10,6) NOT NULL,
    "low" DECIMAL(10,6) NOT NULL,
    "close" DECIMAL(10,6) NOT NULL,
    "volume" DECIMAL(20,6) NOT NULL,

    CONSTRAINT "price_snapshots_pkey" PRIMARY KEY ("time","tokenId")
);

-- CreateTable
CREATE TABLE "pnl_snapshots" (
    "time" TIMESTAMPTZ NOT NULL,
    "userId" TEXT NOT NULL,
    "strategyId" TEXT,
    "pnl" DECIMAL(20,6) NOT NULL,
    "realizedPnl" DECIMAL(20,6) NOT NULL,
    "positionCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "pnl_snapshots_pkey" PRIMARY KEY ("time","userId")
);

-- CreateTable
CREATE TABLE "backtest_orders" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "tokenId" VARCHAR(255) NOT NULL,
    "side" "OrderSide" NOT NULL,
    "outcome" "OrderOutcome" NOT NULL,
    "size" DECIMAL(20,6) NOT NULL,
    "price" DECIMAL(10,6) NOT NULL,
    "fillPrice" DECIMAL(10,6),
    "pnl" DECIMAL(20,6),
    "equityCurve" DECIMAL(20,6) NOT NULL,
    "simulatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "backtest_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_log" (
    "id" BIGSERIAL NOT NULL,
    "eventType" VARCHAR(50) NOT NULL,
    "userId" TEXT,
    "payload" JSONB NOT NULL,
    "source" VARCHAR(50) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "markets_slug_key" ON "markets"("slug");

-- AddForeignKey
ALTER TABLE "tokens" ADD CONSTRAINT "tokens_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "markets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "backtest_orders" ADD CONSTRAINT "backtest_orders_runId_fkey" FOREIGN KEY ("runId") REFERENCES "backtest_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
