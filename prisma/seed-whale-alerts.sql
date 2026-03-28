-- Fix: Seed whale alerts using correct Market column names
-- Run: docker compose -f docker-compose.infra.yml exec -T postgres \
--   psql -U poly -d polyforge < prisma/seed-whale-alerts.sql

BEGIN;

CREATE TEMP TABLE _markets AS
SELECT id, title, category
FROM markets
WHERE closed = FALSE
ORDER BY volume24h DESC NULLS LAST
LIMIT 8;

DO $$
DECLARE
  m1 TEXT; m2 TEXT; m3 TEXT; m4 TEXT; m5 TEXT;
  m6 TEXT; m7 TEXT; m8 TEXT;
  t1 TEXT; t2 TEXT; t3 TEXT; t4 TEXT; t5 TEXT;
BEGIN
  SELECT id INTO m1 FROM _markets OFFSET 0 LIMIT 1;
  SELECT id INTO m2 FROM _markets OFFSET 1 LIMIT 1;
  SELECT id INTO m3 FROM _markets OFFSET 2 LIMIT 1;
  SELECT id INTO m4 FROM _markets OFFSET 3 LIMIT 1;
  SELECT id INTO m5 FROM _markets OFFSET 4 LIMIT 1;
  SELECT id INTO m6 FROM _markets OFFSET 5 LIMIT 1;
  SELECT id INTO m7 FROM _markets OFFSET 6 LIMIT 1;
  SELECT id INTO m8 FROM _markets OFFSET 7 LIMIT 1;

  -- Get token IDs
  SELECT id INTO t1 FROM tokens WHERE "marketId" = m1 AND outcome = 'YES' LIMIT 1;
  SELECT id INTO t2 FROM tokens WHERE "marketId" = m2 AND outcome = 'YES' LIMIT 1;
  SELECT id INTO t3 FROM tokens WHERE "marketId" = m3 AND outcome = 'NO'  LIMIT 1;
  SELECT id INTO t4 FROM tokens WHERE "marketId" = m4 AND outcome = 'YES' LIMIT 1;
  SELECT id INTO t5 FROM tokens WHERE "marketId" = m5 AND outcome = 'YES' LIMIT 1;

  IF m1 IS NULL THEN
    RAISE NOTICE 'No open markets found — skipping whale alerts';
    RETURN;
  END IF;

  RAISE NOTICE 'Found markets: %, %, %, %', m1, m2, m3, m4;

  INSERT INTO whale_alerts (id, "walletAddress", "marketId", "tokenId", side, outcome, size, price, notional, "txHash", "detectedAt")
  VALUES
    (gen_random_uuid(), '0x1234567890abcdef1234567890abcdef12345678', m1, COALESCE(t1, 'token_unknown'), 'BUY', 'YES',
     85000.000000, 0.650000, 55250.000000, '0xseed' || substr(md5(random()::text), 1, 20), NOW() - INTERVAL '30 minutes'),

    (gen_random_uuid(), '0x1234567890abcdef1234567890abcdef12345678', m2, COALESCE(t2, 'token_unknown'), 'BUY', 'YES',
     120000.000000, 0.420000, 50400.000000, '0xseed' || substr(md5(random()::text), 1, 20), NOW() - INTERVAL '2 hours'),

    (gen_random_uuid(), '0xdeadbeef00000000000000000000000000000001', m3, COALESCE(t3, 'token_unknown'), 'SELL', 'NO',
     200000.000000, 0.350000, 70000.000000, '0xseed' || substr(md5(random()::text), 1, 20), NOW() - INTERVAL '1 hour'),

    (gen_random_uuid(), '0xdeadbeef00000000000000000000000000000001', m1, COALESCE(t1, 'token_unknown'), 'BUY', 'YES',
     50000.000000, 0.670000, 33500.000000, '0xseed' || substr(md5(random()::text), 1, 20), NOW() - INTERVAL '4 hours'),

    (gen_random_uuid(), '0xWhaleAlpha000000000000000000000000000001', m4, COALESCE(t4, 'token_unknown'), 'BUY', 'YES',
     75000.000000, 0.550000, 41250.000000, '0xseed' || substr(md5(random()::text), 1, 20), NOW() - INTERVAL '45 minutes'),

    (gen_random_uuid(), '0xWhaleAlpha000000000000000000000000000001', COALESCE(m5, m1), COALESCE(t5, t1, 'token_unknown'), 'BUY', 'YES',
     60000.000000, 0.720000, 43200.000000, '0xseed' || substr(md5(random()::text), 1, 20), NOW() - INTERVAL '3 hours'),

    (gen_random_uuid(), '0xMobyDick0000000000000000000000000000001', m1, COALESCE(t1, 'token_unknown'), 'BUY', 'YES',
     300000.000000, 0.650000, 195000.000000, '0xseed' || substr(md5(random()::text), 1, 20), NOW() - INTERVAL '15 minutes'),

    (gen_random_uuid(), '0xMobyDick0000000000000000000000000000001', m2, COALESCE(t2, 'token_unknown'), 'SELL', 'YES',
     150000.000000, 0.780000, 117000.000000, '0xseed' || substr(md5(random()::text), 1, 20), NOW() - INTERVAL '1 hour'),

    (gen_random_uuid(), '0xMobyDick0000000000000000000000000000001', m3, COALESCE(t3, 'token_unknown'), 'BUY', 'NO',
     180000.000000, 0.310000, 55800.000000, '0xseed' || substr(md5(random()::text), 1, 20), NOW() - INTERVAL '5 hours'),

    (gen_random_uuid(), '0xBigFish00000000000000000000000000000001', m4, COALESCE(t4, 'token_unknown'), 'BUY', 'YES',
     45000.000000, 0.600000, 27000.000000, '0xseed' || substr(md5(random()::text), 1, 20), NOW() - INTERVAL '4 hours'),

    (gen_random_uuid(), '0xDeepBlue0000000000000000000000000000001', COALESCE(m5, m1), COALESCE(t5, t1, 'token_unknown'), 'SELL', 'YES',
     95000.000000, 0.480000, 45600.000000, '0xseed' || substr(md5(random()::text), 1, 20), NOW() - INTERVAL '3 hours'),

    (gen_random_uuid(), '0xDeepBlue0000000000000000000000000000001', m1, COALESCE(t1, 'token_unknown'), 'BUY', 'YES',
     110000.000000, 0.660000, 72600.000000, '0xseed' || substr(md5(random()::text), 1, 20), NOW() - INTERVAL '6 hours'),

    (gen_random_uuid(), '0xKrakenWallet000000000000000000000000001', m2, COALESCE(t2, 'token_unknown'), 'BUY', 'YES',
     38000.000000, 0.430000, 16340.000000, '0xseed' || substr(md5(random()::text), 1, 20), NOW() - INTERVAL '6 hours'),

    (gen_random_uuid(), '0xLeviathan000000000000000000000000000001', m3, COALESCE(t3, 'token_unknown'), 'BUY', 'NO',
     65000.000000, 0.280000, 18200.000000, '0xseed' || substr(md5(random()::text), 1, 20), NOW() - INTERVAL '8 hours'),

    (gen_random_uuid(), '0xLeviathan000000000000000000000000000001', m4, COALESCE(t4, 'token_unknown'), 'SELL', 'YES',
     42000.000000, 0.710000, 29820.000000, '0xseed' || substr(md5(random()::text), 1, 20), NOW() - INTERVAL '10 hours')

  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Inserted 15 whale alerts';
END $$;

DROP TABLE IF EXISTS _markets;
COMMIT;

SELECT 'Whale alerts' AS what, COUNT(*) AS n FROM whale_alerts;
