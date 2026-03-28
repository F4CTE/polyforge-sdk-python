-- ============================================================================
-- PolyForge — Seed: News Articles, Signals, Whale Profiles & Alerts
-- Run:  docker compose -f docker-compose.infra.yml exec -T postgres \
--         psql -U polyforge -d polyforge < prisma/seed-news-whales.sql
-- ============================================================================

BEGIN;

-- ─── 0. APPROVE ALL SEED USERS ─────────────────────────────────────────────
UPDATE users
SET approved     = TRUE,
    "approvedAt" = NOW()
WHERE approved = FALSE;

-- ─── 1. GRAB 10 REAL MARKET IDs ────────────────────────────────────────────
-- We'll store them in a temp table so we can reference them below.
CREATE TEMP TABLE _markets AS
SELECT id, title, category
FROM markets
WHERE closed = FALSE
ORDER BY volume24h DESC NULLS LAST
LIMIT 10;

-- ─── 2. NEWS ARTICLES ──────────────────────────────────────────────────────
-- We need deterministic UUIDs so we can reference them in signals.

INSERT INTO news_articles (id, source, title, summary, url, sentiment, "publishedAt", "ingestedAt")
VALUES
  -- Article 1: Politics
  ('a0000000-0000-0000-0000-000000000001', 'Reuters',
   'Netanyahu faces mounting pressure as ceasefire deadline looms',
   'Israeli Prime Minister Benjamin Netanyahu is under increasing domestic and international pressure to finalize a ceasefire agreement before the March 31 deadline. Analysts say the outcome could shift prediction market odds significantly, with current YES prices hovering around 65 cents.',
   'https://reuters.com/world/middle-east/netanyahu-ceasefire-2026-03-27',
   'NEGATIVE', NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 hour'),

  -- Article 2: Crypto
  ('a0000000-0000-0000-0000-000000000002', 'CoinDesk',
   'Bitcoin surges past $92K as institutional inflows hit record',
   'Bitcoin climbed above $92,000 for the first time in three weeks, driven by record-breaking institutional ETF inflows of $1.2 billion in a single day. Polymarket traders are repricing crypto-related contracts as momentum builds toward the $100K psychological barrier.',
   'https://coindesk.com/markets/bitcoin-92k-surge-2026-03-27',
   'POSITIVE', NOW() - INTERVAL '4 hours', NOW() - INTERVAL '3 hours'),

  -- Article 3: Sports
  ('a0000000-0000-0000-0000-000000000003', 'ESPN',
   'March Madness upsets reshape bracket odds heading into Elite Eight',
   'A string of upsets in the Sweet Sixteen has dramatically shifted the NCAA tournament landscape. No. 11 seed VCU stunned top-seeded Duke, while No. 7 Clemson knocked off No. 2 Arizona. Prediction markets are repricing championship futures across the board.',
   'https://espn.com/ncb/story/march-madness-elite-eight-2026',
   'NEUTRAL', NOW() - INTERVAL '6 hours', NOW() - INTERVAL '5 hours'),

  -- Article 4: Economics
  ('a0000000-0000-0000-0000-000000000004', 'Bloomberg',
   'Fed signals potential rate cut as PCE inflation undershoots forecast',
   'The Federal Reserve''s preferred inflation gauge, core PCE, came in at 2.1% year-over-year — below the 2.3% consensus. Multiple Fed governors have signaled openness to a June rate cut. Bond markets rallied immediately on the news.',
   'https://bloomberg.com/news/fed-pce-rate-cut-signal-2026-03',
   'POSITIVE', NOW() - INTERVAL '8 hours', NOW() - INTERVAL '7 hours'),

  -- Article 5: Technology
  ('a0000000-0000-0000-0000-000000000005', 'TechCrunch',
   'OpenAI launches GPT-5 with real-time reasoning capabilities',
   'OpenAI unveiled GPT-5 today, featuring what the company calls "continuous reasoning" — the ability to think through multi-step problems in real-time. The launch sent prediction market contracts on AI milestones surging, with "AGI by 2027" jumping 12 percentage points.',
   'https://techcrunch.com/2026/03/27/openai-gpt-5-launch',
   'POSITIVE', NOW() - INTERVAL '10 hours', NOW() - INTERVAL '9 hours'),

  -- Article 6: Politics
  ('a0000000-0000-0000-0000-000000000006', 'AP News',
   'US forces positioning near Iranian border raises tension',
   'US military assets have been repositioned in the Persian Gulf region amid heightened tensions with Iran. The Pentagon described the move as "routine readiness adjustments" but prediction market odds on military action have ticked upward by 8 points since the news broke.',
   'https://apnews.com/article/us-forces-iran-2026-03-27',
   'NEGATIVE', NOW() - INTERVAL '12 hours', NOW() - INTERVAL '11 hours'),

  -- Article 7: Finance
  ('a0000000-0000-0000-0000-000000000007', 'CNBC',
   'S&P 500 hits all-time high as tech earnings beat expectations',
   'The S&P 500 closed at a record 5,847, boosted by better-than-expected earnings from Nvidia, Microsoft, and Amazon. The rally has pushed prediction market contracts on "S&P above 6000 by June" to 72 cents.',
   'https://cnbc.com/2026/03/27/sp500-record-tech-earnings.html',
   'POSITIVE', NOW() - INTERVAL '14 hours', NOW() - INTERVAL '13 hours'),

  -- Article 8: Crypto
  ('a0000000-0000-0000-0000-000000000008', 'The Block',
   'Ethereum layer-2 transactions surpass mainnet for the first time',
   'Combined transaction volume across Ethereum L2 networks (Arbitrum, Optimism, Base, zkSync) has officially exceeded Ethereum mainnet daily throughput. This milestone reignites the debate around ETH''s value accrual and has moved Ethereum-related prediction markets.',
   'https://theblock.co/post/eth-l2-surpass-mainnet-2026',
   'NEUTRAL', NOW() - INTERVAL '18 hours', NOW() - INTERVAL '17 hours'),

  -- Article 9: Sports
  ('a0000000-0000-0000-0000-000000000009', 'ESPN',
   'Clippers acquire key piece at trade deadline, odds shift',
   'The LA Clippers completed a blockbuster deal acquiring a top defensive wing, reshaping their championship odds. Sportsbooks and prediction markets alike have adjusted — Clippers championship futures moved from +2200 to +1400 overnight.',
   'https://espn.com/nba/story/clippers-trade-deadline-2026',
   'POSITIVE', NOW() - INTERVAL '22 hours', NOW() - INTERVAL '21 hours'),

  -- Article 10: Politics
  ('a0000000-0000-0000-0000-000000000010', 'CNN',
   'Senate passes bipartisan crypto regulation bill',
   'The US Senate voted 68-32 to pass the Digital Asset Market Structure Act, providing the first comprehensive regulatory framework for cryptocurrencies. The bill now heads to the House, where it is expected to pass within weeks. Crypto markets rallied on the news.',
   'https://cnn.com/2026/03/27/politics/senate-crypto-regulation-bill',
   'POSITIVE', NOW() - INTERVAL '26 hours', NOW() - INTERVAL '25 hours')

ON CONFLICT (url) DO NOTHING;


-- ─── 3. NEWS SIGNALS (reference real markets) ──────────────────────────────
-- We'll attach signals to articles using the first few markets from our temp table.

DO $$
DECLARE
  m1 TEXT; m2 TEXT; m3 TEXT; m4 TEXT; m5 TEXT;
  m6 TEXT; m7 TEXT; m8 TEXT;
BEGIN
  SELECT id INTO m1 FROM _markets OFFSET 0 LIMIT 1;
  SELECT id INTO m2 FROM _markets OFFSET 1 LIMIT 1;
  SELECT id INTO m3 FROM _markets OFFSET 2 LIMIT 1;
  SELECT id INTO m4 FROM _markets OFFSET 3 LIMIT 1;
  SELECT id INTO m5 FROM _markets OFFSET 4 LIMIT 1;
  SELECT id INTO m6 FROM _markets OFFSET 5 LIMIT 1;
  SELECT id INTO m7 FROM _markets OFFSET 6 LIMIT 1;
  SELECT id INTO m8 FROM _markets OFFSET 7 LIMIT 1;

  -- Only insert signals if we found markets
  IF m1 IS NOT NULL THEN
    INSERT INTO news_signals (id, "articleId", "marketId", direction, outcome, confidence, reasoning, "createdAt")
    VALUES
      -- Signals for Article 1 (Netanyahu ceasefire)
      (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', m1, 'BUY', 'YES', 82,
       'Ceasefire deadline pressure increases likelihood of resolution. Market underpricing the probability based on diplomatic sources.',
       NOW() - INTERVAL '1 hour'),
      (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', m2, 'SELL', 'NO', 65,
       'Geopolitical uncertainty typically causes correlated moves across political markets. Hedging recommended.',
       NOW() - INTERVAL '1 hour'),

      -- Signals for Article 2 (Bitcoin surge)
      (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000002', m3, 'BUY', 'YES', 88,
       'Record ETF inflows are a strong leading indicator. Institutional momentum typically sustains for 2-3 weeks.',
       NOW() - INTERVAL '3 hours'),

      -- Signals for Article 3 (March Madness)
      (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000003', m4, 'SELL', 'YES', 71,
       'Bracket chaos creates mispricing opportunities. Historical upset patterns suggest further volatility.',
       NOW() - INTERVAL '5 hours'),
      (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000003', m5, 'BUY', 'YES', 76,
       'Underdog momentum in the tournament historically correlates with specific matchup dynamics.',
       NOW() - INTERVAL '5 hours'),

      -- Signals for Article 4 (Fed rate cut)
      (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000004', m1, 'BUY', 'YES', 91,
       'PCE undershoot + Fed commentary strongly suggest June cut. Market is lagging behind the signal.',
       NOW() - INTERVAL '7 hours'),

      -- Signals for Article 5 (GPT-5)
      (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000005', m6, 'BUY', 'YES', 78,
       'GPT-5 capabilities exceed expectations. AI milestone contracts are repricing but still behind the curve.',
       NOW() - INTERVAL '9 hours'),

      -- Signals for Article 6 (US-Iran)
      (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000006', m2, 'SELL', 'YES', 73,
       'Military positioning increases tail risk. Geopolitical markets should price in higher uncertainty.',
       NOW() - INTERVAL '11 hours'),

      -- Signals for Article 7 (S&P record)
      (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000007', m7, 'BUY', 'YES', 85,
       'Tech earnings momentum and rate cut expectations create strong bullish confluence for equity index targets.',
       NOW() - INTERVAL '13 hours'),

      -- Signals for Article 9 (Clippers trade)
      (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000009', m8, 'BUY', 'YES', 69,
       'Roster upgrade shifts championship probability. Current market odds haven''t fully adjusted to the new lineup strength.',
       NOW() - INTERVAL '21 hours'),

      -- Signals for Article 10 (Crypto regulation)
      (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000010', m3, 'BUY', 'YES', 93,
       'Regulatory clarity is the single biggest catalyst for institutional crypto adoption. This bill passing the Senate is a landmark event.',
       NOW() - INTERVAL '25 hours')

    ON CONFLICT DO NOTHING;
  END IF;
END $$;


-- ─── 4. WHALE PROFILES ─────────────────────────────────────────────────────

INSERT INTO whale_profiles ("walletAddress", "totalVolume", "totalPnl", "tradeCount", "winRate", "lastTradeAt", "updatedAt")
VALUES
  ('0x1234567890abcdef1234567890abcdef12345678',  2850000.00, 342000.00, 847, 67.30, NOW() - INTERVAL '30 minutes', NOW()),
  ('0xdeadbeef00000000000000000000000000000001',  1420000.00, -89000.00, 523, 48.20, NOW() - INTERVAL '2 hours', NOW()),
  ('0xWhaleAlpha000000000000000000000000000001',   980000.00, 215000.00, 312, 72.10, NOW() - INTERVAL '1 hour', NOW()),
  ('0xBigFish00000000000000000000000000000001',    750000.00, 167000.00, 198, 63.50, NOW() - INTERVAL '4 hours', NOW()),
  ('0xMobyDick0000000000000000000000000000001',    3200000.00, 890000.00, 1204, 71.80, NOW() - INTERVAL '15 minutes', NOW()),
  ('0xKrakenWallet000000000000000000000000001',    560000.00,  45000.00, 156, 55.80, NOW() - INTERVAL '6 hours', NOW()),
  ('0xDeepBlue0000000000000000000000000000001',   1100000.00, 298000.00, 445, 68.90, NOW() - INTERVAL '3 hours', NOW()),
  ('0xLeviathan000000000000000000000000000001',    480000.00, -23000.00, 134, 44.70, NOW() - INTERVAL '8 hours', NOW())
ON CONFLICT ("walletAddress") DO NOTHING;


-- ─── 5. WHALE ALERTS (reference real markets) ──────────────────────────────

DO $$
DECLARE
  m1 TEXT; m2 TEXT; m3 TEXT; m4 TEXT; m5 TEXT;
  m6 TEXT; m7 TEXT; m8 TEXT;
  t1 TEXT; t2 TEXT; t3 TEXT; t4 TEXT; t5 TEXT;
BEGIN
  -- Get market IDs
  SELECT id INTO m1 FROM _markets OFFSET 0 LIMIT 1;
  SELECT id INTO m2 FROM _markets OFFSET 1 LIMIT 1;
  SELECT id INTO m3 FROM _markets OFFSET 2 LIMIT 1;
  SELECT id INTO m4 FROM _markets OFFSET 3 LIMIT 1;
  SELECT id INTO m5 FROM _markets OFFSET 4 LIMIT 1;
  SELECT id INTO m6 FROM _markets OFFSET 5 LIMIT 1;
  SELECT id INTO m7 FROM _markets OFFSET 6 LIMIT 1;
  SELECT id INTO m8 FROM _markets OFFSET 7 LIMIT 1;

  -- Get some token IDs for those markets
  SELECT id INTO t1 FROM tokens WHERE "marketId" = m1 AND outcome = 'YES' LIMIT 1;
  SELECT id INTO t2 FROM tokens WHERE "marketId" = m2 AND outcome = 'YES' LIMIT 1;
  SELECT id INTO t3 FROM tokens WHERE "marketId" = m3 AND outcome = 'NO'  LIMIT 1;
  SELECT id INTO t4 FROM tokens WHERE "marketId" = m4 AND outcome = 'YES' LIMIT 1;
  SELECT id INTO t5 FROM tokens WHERE "marketId" = m5 AND outcome = 'YES' LIMIT 1;

  IF m1 IS NOT NULL AND t1 IS NOT NULL THEN
    INSERT INTO whale_alerts (id, "walletAddress", "marketId", "tokenId", side, outcome, size, price, notional, "txHash", "detectedAt")
    VALUES
      -- Whale 1: Big BUY trades
      (gen_random_uuid(), '0x1234567890abcdef1234567890abcdef12345678', m1, COALESCE(t1, 'token_unknown'), 'BUY', 'YES',
       85000.000000, 0.650000, 55250.000000,
       '0xabc001' || encode(gen_random_bytes(28), 'hex'), NOW() - INTERVAL '30 minutes'),

      (gen_random_uuid(), '0x1234567890abcdef1234567890abcdef12345678', m2, COALESCE(t2, 'token_unknown'), 'BUY', 'YES',
       120000.000000, 0.420000, 50400.000000,
       '0xabc002' || encode(gen_random_bytes(28), 'hex'), NOW() - INTERVAL '2 hours'),

      -- Whale 2: Mixed trades
      (gen_random_uuid(), '0xdeadbeef00000000000000000000000000000001', m3, COALESCE(t3, 'token_unknown'), 'SELL', 'NO',
       200000.000000, 0.350000, 70000.000000,
       '0xdef001' || encode(gen_random_bytes(28), 'hex'), NOW() - INTERVAL '1 hour'),

      (gen_random_uuid(), '0xdeadbeef00000000000000000000000000000001', m1, COALESCE(t1, 'token_unknown'), 'BUY', 'YES',
       50000.000000, 0.670000, 33500.000000,
       '0xdef002' || encode(gen_random_bytes(28), 'hex'), NOW() - INTERVAL '4 hours'),

      -- Whale 3: Alpha whale
      (gen_random_uuid(), '0xWhaleAlpha000000000000000000000000000001', m4, COALESCE(t4, 'token_unknown'), 'BUY', 'YES',
       75000.000000, 0.550000, 41250.000000,
       '0xalpha01' || encode(gen_random_bytes(28), 'hex'), NOW() - INTERVAL '45 minutes'),

      (gen_random_uuid(), '0xWhaleAlpha000000000000000000000000000001', m5, COALESCE(t5, 'token_unknown'), 'BUY', 'YES',
       60000.000000, 0.720000, 43200.000000,
       '0xalpha02' || encode(gen_random_bytes(28), 'hex'), NOW() - INTERVAL '3 hours'),

      -- Moby Dick: Largest whale
      (gen_random_uuid(), '0xMobyDick0000000000000000000000000000001', m1, COALESCE(t1, 'token_unknown'), 'BUY', 'YES',
       300000.000000, 0.650000, 195000.000000,
       '0xmoby01' || encode(gen_random_bytes(28), 'hex'), NOW() - INTERVAL '15 minutes'),

      (gen_random_uuid(), '0xMobyDick0000000000000000000000000000001', m2, COALESCE(t2, 'token_unknown'), 'SELL', 'YES',
       150000.000000, 0.780000, 117000.000000,
       '0xmoby02' || encode(gen_random_bytes(28), 'hex'), NOW() - INTERVAL '1 hour'),

      (gen_random_uuid(), '0xMobyDick0000000000000000000000000000001', m3, COALESCE(t3, 'token_unknown'), 'BUY', 'NO',
       180000.000000, 0.310000, 55800.000000,
       '0xmoby03' || encode(gen_random_bytes(28), 'hex'), NOW() - INTERVAL '5 hours'),

      -- Big Fish
      (gen_random_uuid(), '0xBigFish00000000000000000000000000000001', m4, COALESCE(t4, 'token_unknown'), 'BUY', 'YES',
       45000.000000, 0.600000, 27000.000000,
       '0xfish01' || encode(gen_random_bytes(28), 'hex'), NOW() - INTERVAL '4 hours'),

      -- Deep Blue
      (gen_random_uuid(), '0xDeepBlue0000000000000000000000000000001', m5, COALESCE(t5, 'token_unknown'), 'SELL', 'YES',
       95000.000000, 0.480000, 45600.000000,
       '0xdeep01' || encode(gen_random_bytes(28), 'hex'), NOW() - INTERVAL '3 hours'),

      (gen_random_uuid(), '0xDeepBlue0000000000000000000000000000001', m1, COALESCE(t1, 'token_unknown'), 'BUY', 'YES',
       110000.000000, 0.660000, 72600.000000,
       '0xdeep02' || encode(gen_random_bytes(28), 'hex'), NOW() - INTERVAL '6 hours'),

      -- Kraken
      (gen_random_uuid(), '0xKrakenWallet000000000000000000000000001', m2, COALESCE(t2, 'token_unknown'), 'BUY', 'YES',
       38000.000000, 0.430000, 16340.000000,
       '0xkrak01' || encode(gen_random_bytes(28), 'hex'), NOW() - INTERVAL '6 hours'),

      -- Leviathan (losing whale)
      (gen_random_uuid(), '0xLeviathan000000000000000000000000000001', m3, COALESCE(t3, 'token_unknown'), 'BUY', 'NO',
       65000.000000, 0.280000, 18200.000000,
       '0xlevi01' || encode(gen_random_bytes(28), 'hex'), NOW() - INTERVAL '8 hours'),

      (gen_random_uuid(), '0xLeviathan000000000000000000000000000001', m4, COALESCE(t4, 'token_unknown'), 'SELL', 'YES',
       42000.000000, 0.710000, 29820.000000,
       '0xlevi02' || encode(gen_random_bytes(28), 'hex'), NOW() - INTERVAL '10 hours')

    ON CONFLICT DO NOTHING;
  END IF;
END $$;


-- ─── 6. CLEANUP ────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS _markets;

COMMIT;

-- Done! Verify counts:
SELECT 'Users approved'  AS what, COUNT(*) AS n FROM users WHERE approved = TRUE
UNION ALL
SELECT 'News articles',  COUNT(*) FROM news_articles
UNION ALL
SELECT 'News signals',   COUNT(*) FROM news_signals
UNION ALL
SELECT 'Whale profiles', COUNT(*) FROM whale_profiles
UNION ALL
SELECT 'Whale alerts',   COUNT(*) FROM whale_alerts;
