-- CreateEnum
CREATE TYPE "StrategyVisibility" AS ENUM ('PRIVATE', 'PUBLIC', 'UNLISTED');

-- CreateEnum
CREATE TYPE "ExecMode" AS ENUM ('EVENT', 'TICK', 'HYBRID');

-- CreateEnum
CREATE TYPE "StrategyStatus" AS ENUM ('IDLE', 'RUNNING', 'PAUSED', 'ERROR', 'PAPER', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "OrderSide" AS ENUM ('BUY', 'SELL');

-- CreateEnum
CREATE TYPE "OrderOutcome" AS ENUM ('YES', 'NO');

-- CreateEnum
CREATE TYPE "OrderType" AS ENUM ('GTC', 'GTD', 'FOK', 'FAK');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'SUBMITTED', 'LIVE', 'MATCHED', 'DELAYED', 'MINED', 'CONFIRMED', 'PARTIAL', 'CANCELLED', 'UNMATCHED', 'FAILED', 'ERROR');

-- CreateEnum
CREATE TYPE "ResolutionStatus" AS ENUM ('UNRESOLVED', 'RESOLVING', 'RESOLVED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "ResolutionOutcome" AS ENUM ('YES_WIN', 'NO_WIN', 'FIFTY_FIFTY', 'CANCELLED');

-- CreateEnum
CREATE TYPE "NotificationFrequency" AS ENUM ('IMMEDIATE', 'HOURLY', 'DAILY');

-- CreateEnum
CREATE TYPE "ReportReason" AS ENUM ('SPAM', 'INAPPROPRIATE', 'MISLEADING', 'OTHER');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('PENDING', 'REVIEWED_REMOVED', 'REVIEWED_KEPT');

-- CreateEnum
CREATE TYPE "BotChannel" AS ENUM ('TELEGRAM', 'DISCORD');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "passwordHash" VARCHAR(255) NOT NULL,
    "username" VARCHAR(30) NOT NULL,
    "displayName" VARCHAR(50),
    "bio" VARCHAR(500),
    "avatarUrl" TEXT,
    "twitterHandle" VARCHAR(50),
    "showPnl" BOOLEAN NOT NULL DEFAULT false,
    "showWinrate" BOOLEAN NOT NULL DEFAULT false,
    "totpSecret" VARCHAR(255),
    "totpEnabled" BOOLEAN NOT NULL DEFAULT false,
    "totpBackupCodes" TEXT[],
    "totpEnabledAt" TIMESTAMP(3),
    "polymarketConnected" BOOLEAN NOT NULL DEFAULT false,
    "polymarketSigType" SMALLINT,
    "polymarketAddress" VARCHAR(42),
    "tosAcceptedAt" TIMESTAMP(3),
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "emailVerifiedAt" TIMESTAMP(3),
    "suspended" BOOLEAN NOT NULL DEFAULT false,
    "suspendedReason" TEXT,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_credentials" (
    "userId" TEXT NOT NULL,
    "encryptedDek" BYTEA NOT NULL,
    "dekIv" BYTEA NOT NULL,
    "privateKeyCt" BYTEA NOT NULL,
    "privateKeyIv" BYTEA NOT NULL,
    "privateKeyTag" BYTEA NOT NULL,
    "apiKeyCt" BYTEA NOT NULL,
    "apiKeyIv" BYTEA NOT NULL,
    "apiKeyTag" BYTEA NOT NULL,
    "apiSecretCt" BYTEA NOT NULL,
    "apiSecretIv" BYTEA NOT NULL,
    "apiSecretTag" BYTEA NOT NULL,
    "apiPassphraseCt" BYTEA NOT NULL,
    "apiPassphraseIv" BYTEA NOT NULL,
    "apiPassphraseTag" BYTEA NOT NULL,
    "safeAddress" VARCHAR(42),
    "sigType" SMALLINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_credentials_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "user_login_history" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ip" VARCHAR(45) NOT NULL,
    "userAgent" TEXT NOT NULL,
    "country" VARCHAR(2),
    "success" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_login_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "userId" TEXT NOT NULL,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT false,
    "telegramEnabled" BOOLEAN NOT NULL DEFAULT false,
    "discordEnabled" BOOLEAN NOT NULL DEFAULT false,
    "onStrategyError" BOOLEAN NOT NULL DEFAULT true,
    "onOrderFilled" BOOLEAN NOT NULL DEFAULT true,
    "onDailyLossLimit" BOOLEAN NOT NULL DEFAULT true,
    "onBacktestComplete" BOOLEAN NOT NULL DEFAULT true,
    "onMarketResolved" BOOLEAN NOT NULL DEFAULT true,
    "onSomeoneFelked" BOOLEAN NOT NULL DEFAULT false,
    "onSomeoneFollowed" BOOLEAN NOT NULL DEFAULT false,
    "onSomeoneLiked" BOOLEAN NOT NULL DEFAULT false,
    "onSomeoneCommented" BOOLEAN NOT NULL DEFAULT false,
    "minFillNotifyUsdc" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "notificationFreq" "NotificationFrequency" NOT NULL DEFAULT 'IMMEDIATE',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "bot_connections" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channel" "BotChannel" NOT NULL,
    "chatId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "bot_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "follows" (
    "followerId" TEXT NOT NULL,
    "followingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "follows_pkey" PRIMARY KEY ("followerId","followingId")
);

-- CreateTable
CREATE TABLE "user_limits" (
    "userId" TEXT NOT NULL,
    "maxRunningStrategies" INTEGER NOT NULL DEFAULT 5,
    "maxOrdersPerDay" INTEGER NOT NULL DEFAULT 500,
    "maxOrderSizeUsdc" DECIMAL(20,6) NOT NULL DEFAULT 1000,
    "maxBacktestRunsPerDay" INTEGER NOT NULL DEFAULT 10,
    "circuitBreakerErrors" INTEGER NOT NULL DEFAULT 5,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_limits_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_verifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_history" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channel" VARCHAR(20) NOT NULL,
    "eventType" VARCHAR(50) NOT NULL,
    "payload" JSONB NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "success" BOOLEAN NOT NULL,
    "error" TEXT,

    CONSTRAINT "notification_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "strategies" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "visibility" "StrategyVisibility" NOT NULL DEFAULT 'PRIVATE',
    "execMode" "ExecMode" NOT NULL DEFAULT 'TICK',
    "tickMs" INTEGER,
    "triggers" JSONB NOT NULL,
    "conditions" JSONB NOT NULL,
    "actions" JSONB NOT NULL,
    "safety" JSONB NOT NULL DEFAULT '[]',
    "status" "StrategyStatus" NOT NULL DEFAULT 'IDLE',
    "errorMessage" TEXT,
    "forkedFromId" TEXT,
    "forkedFromUserId" TEXT,
    "forkCount" INTEGER NOT NULL DEFAULT 0,
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "template" BOOLEAN NOT NULL DEFAULT false,
    "tags" TEXT[],
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "strategies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "strategy_versions" (
    "id" TEXT NOT NULL,
    "strategyId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "triggers" JSONB NOT NULL,
    "conditions" JSONB NOT NULL,
    "actions" JSONB NOT NULL,
    "safety" JSONB NOT NULL,
    "changedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "strategy_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "strategy_likes" (
    "userId" TEXT NOT NULL,
    "strategyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "strategy_likes_pkey" PRIMARY KEY ("userId","strategyId")
);

-- CreateTable
CREATE TABLE "strategy_comments" (
    "id" TEXT NOT NULL,
    "strategyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "parentId" TEXT,
    "content" TEXT NOT NULL,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "strategy_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "strategy_forks" (
    "id" TEXT NOT NULL,
    "originalId" TEXT NOT NULL,
    "forkId" TEXT NOT NULL,
    "forkedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "strategy_forks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "strategy_status_history" (
    "id" TEXT NOT NULL,
    "strategyId" TEXT NOT NULL,
    "fromStatus" "StrategyStatus" NOT NULL,
    "toStatus" "StrategyStatus" NOT NULL,
    "reason" TEXT,
    "triggeredBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "strategy_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "strategy_events" (
    "id" TEXT NOT NULL,
    "strategyId" TEXT NOT NULL,
    "eventType" VARCHAR(50) NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "strategy_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "intentId" TEXT NOT NULL,
    "clobOrderId" VARCHAR(255),
    "clobStatus" VARCHAR(20),
    "userId" TEXT NOT NULL,
    "strategyId" TEXT,
    "marketId" VARCHAR(255) NOT NULL,
    "tokenId" VARCHAR(255) NOT NULL,
    "side" "OrderSide" NOT NULL,
    "outcome" "OrderOutcome" NOT NULL,
    "size" DECIMAL(20,6) NOT NULL,
    "price" DECIMAL(10,6) NOT NULL,
    "orderType" "OrderType" NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "fillSize" DECIMAL(20,6),
    "fillPrice" DECIMAL(10,6),
    "fee" DECIMAL(20,6),
    "errorMessage" TEXT,
    "placedAt" TIMESTAMP(3),
    "filledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "positions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "marketId" VARCHAR(255) NOT NULL,
    "tokenId" VARCHAR(255) NOT NULL,
    "outcome" "OrderOutcome" NOT NULL,
    "size" DECIMAL(20,6) NOT NULL,
    "avgPrice" DECIMAL(10,6) NOT NULL,
    "currentPrice" DECIMAL(10,6) NOT NULL,
    "unrealizedPnl" DECIMAL(20,6) NOT NULL,
    "realizedPnl" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "resolutionStatus" "ResolutionStatus" NOT NULL DEFAULT 'UNRESOLVED',
    "resolutionOutcome" "ResolutionOutcome",
    "redemptionValue" DECIMAL(10,6),
    "redeemed" BOOLEAN NOT NULL DEFAULT false,
    "redeemedAt" TIMESTAMP(3),
    "redemptionTxHash" VARCHAR(66),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paper_orders" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "strategyId" TEXT,
    "marketId" VARCHAR(255) NOT NULL,
    "tokenId" VARCHAR(255) NOT NULL,
    "side" "OrderSide" NOT NULL,
    "outcome" "OrderOutcome" NOT NULL,
    "size" DECIMAL(20,6) NOT NULL,
    "price" DECIMAL(10,6) NOT NULL,
    "orderType" "OrderType" NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'CONFIRMED',
    "fillSize" DECIMAL(20,6),
    "fillPrice" DECIMAL(10,6),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "paper_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paper_positions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "marketId" VARCHAR(255) NOT NULL,
    "tokenId" VARCHAR(255) NOT NULL,
    "outcome" "OrderOutcome" NOT NULL,
    "size" DECIMAL(20,6) NOT NULL,
    "avgPrice" DECIMAL(10,6) NOT NULL,
    "currentPrice" DECIMAL(10,6) NOT NULL,
    "unrealizedPnl" DECIMAL(20,6) NOT NULL,
    "realizedPnl" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "paper_positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "backtest_runs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "strategyId" TEXT NOT NULL,
    "dateRangeStart" TIMESTAMP(3) NOT NULL,
    "dateRangeEnd" TIMESTAMP(3) NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "totalOrders" INTEGER,
    "filledOrders" INTEGER,
    "totalPnl" DECIMAL(20,6),
    "winRate" DECIMAL(6,4),
    "maxDrawdown" DECIMAL(20,6),
    "sharpeRatio" DECIMAL(10,4),
    "hasDataGaps" BOOLEAN NOT NULL DEFAULT false,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "backtest_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "targetType" VARCHAR(20) NOT NULL,
    "targetId" TEXT NOT NULL,
    "strategyId" TEXT,
    "reason" "ReportReason" NOT NULL,
    "description" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_alerts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenId" VARCHAR(255) NOT NULL,
    "direction" VARCHAR(5) NOT NULL,
    "price" DECIMAL(10,6) NOT NULL,
    "persistent" BOOLEAN NOT NULL DEFAULT false,
    "triggered" BOOLEAN NOT NULL DEFAULT false,
    "triggeredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_gaps" (
    "id" TEXT NOT NULL,
    "tokenId" VARCHAR(255) NOT NULL,
    "gapStart" TIMESTAMP(3) NOT NULL,
    "gapEnd" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "data_gaps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "bot_connections_channel_chatId_key" ON "bot_connections"("channel", "chatId");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_tokenHash_key" ON "password_reset_tokens"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "email_verifications_tokenHash_key" ON "email_verifications"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "orders_intentId_key" ON "orders"("intentId");

-- CreateIndex
CREATE UNIQUE INDEX "positions_userId_tokenId_key" ON "positions"("userId", "tokenId");

-- CreateIndex
CREATE UNIQUE INDEX "paper_positions_userId_tokenId_key" ON "paper_positions"("userId", "tokenId");

-- AddForeignKey
ALTER TABLE "user_login_history" ADD CONSTRAINT "user_login_history_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bot_connections" ADD CONSTRAINT "bot_connections_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follows" ADD CONSTRAINT "follows_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follows" ADD CONSTRAINT "follows_followingId_fkey" FOREIGN KEY ("followingId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_limits" ADD CONSTRAINT "user_limits_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_verifications" ADD CONSTRAINT "email_verifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_history" ADD CONSTRAINT "notification_history_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "strategies" ADD CONSTRAINT "strategies_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "strategies" ADD CONSTRAINT "strategies_forkedFromId_fkey" FOREIGN KEY ("forkedFromId") REFERENCES "strategies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "strategy_versions" ADD CONSTRAINT "strategy_versions_strategyId_fkey" FOREIGN KEY ("strategyId") REFERENCES "strategies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "strategy_likes" ADD CONSTRAINT "strategy_likes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "strategy_likes" ADD CONSTRAINT "strategy_likes_strategyId_fkey" FOREIGN KEY ("strategyId") REFERENCES "strategies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "strategy_comments" ADD CONSTRAINT "strategy_comments_strategyId_fkey" FOREIGN KEY ("strategyId") REFERENCES "strategies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "strategy_comments" ADD CONSTRAINT "strategy_comments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "strategy_comments" ADD CONSTRAINT "strategy_comments_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "strategy_comments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "strategy_forks" ADD CONSTRAINT "strategy_forks_forkedById_fkey" FOREIGN KEY ("forkedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "strategy_status_history" ADD CONSTRAINT "strategy_status_history_strategyId_fkey" FOREIGN KEY ("strategyId") REFERENCES "strategies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "strategy_events" ADD CONSTRAINT "strategy_events_strategyId_fkey" FOREIGN KEY ("strategyId") REFERENCES "strategies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_strategyId_fkey" FOREIGN KEY ("strategyId") REFERENCES "strategies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "positions" ADD CONSTRAINT "positions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paper_orders" ADD CONSTRAINT "paper_orders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paper_orders" ADD CONSTRAINT "paper_orders_strategyId_fkey" FOREIGN KEY ("strategyId") REFERENCES "strategies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paper_positions" ADD CONSTRAINT "paper_positions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "backtest_runs" ADD CONSTRAINT "backtest_runs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "backtest_runs" ADD CONSTRAINT "backtest_runs_strategyId_fkey" FOREIGN KEY ("strategyId") REFERENCES "strategies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_strategyId_fkey" FOREIGN KEY ("strategyId") REFERENCES "strategies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_alerts" ADD CONSTRAINT "price_alerts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
