ALTER TABLE "journal_entries"
  ALTER COLUMN "price" TYPE DECIMAL(20,6) USING ROUND("price"::numeric, 6),
  ALTER COLUMN "size" TYPE DECIMAL(20,6) USING ROUND("size"::numeric, 6),
  ALTER COLUMN "pnl" TYPE DECIMAL(20,6) USING ROUND("pnl"::numeric, 6);

ALTER TABLE "orders"
  ADD CONSTRAINT "orders_size_positive" CHECK ("size" > 0),
  ADD CONSTRAINT "orders_price_range" CHECK ("price" > 0 AND "price" <= 1);
