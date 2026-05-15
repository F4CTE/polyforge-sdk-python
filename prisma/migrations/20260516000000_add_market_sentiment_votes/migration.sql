-- Add market_sentiment_votes table for user-driven market sentiment voting.
-- Refs: POLA-1447, POLA-4850

CREATE TABLE "market_sentiment_votes" (
    "id"         TEXT NOT NULL,
    "userId"     TEXT NOT NULL,
    "marketId"   VARCHAR(255) NOT NULL,
    "direction"  VARCHAR(10) NOT NULL,
    "confidence" INTEGER NOT NULL,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMP(3) NOT NULL,

    CONSTRAINT "market_sentiment_votes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "market_sentiment_votes_userId_marketId_key" ON "market_sentiment_votes"("userId", "marketId");
CREATE INDEX "market_sentiment_votes_marketId_idx" ON "market_sentiment_votes"("marketId");

ALTER TABLE "market_sentiment_votes"
  ADD CONSTRAINT "market_sentiment_votes_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "market_sentiment_votes"
  ADD CONSTRAINT "market_sentiment_votes_marketId_fkey"
  FOREIGN KEY ("marketId") REFERENCES "markets"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
