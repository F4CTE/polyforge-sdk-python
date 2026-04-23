-- Add smart money scoring fields to whale_profiles
ALTER TABLE "whale_profiles" ADD COLUMN "win_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "whale_profiles" ADD COLUMN "sharpe_ratio" DECIMAL(8, 4) NOT NULL DEFAULT 0;
ALTER TABLE "whale_profiles" ADD COLUMN "smart_money_score" DECIMAL(8, 2) NOT NULL DEFAULT 0;

-- Index for leaderboard queries sorted by score
CREATE INDEX "whale_profiles_smart_money_score_idx" ON "whale_profiles" ("smart_money_score" DESC);
