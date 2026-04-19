-- Add POST_ONLY to OrderType enum
-- POST_ONLY orders are rejected if they would immediately match (market-making strategy)
ALTER TYPE "OrderType" ADD VALUE 'POST_ONLY';
