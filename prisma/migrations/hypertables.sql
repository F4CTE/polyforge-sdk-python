-- TimescaleDB hypertable creation
-- Run after Prisma migrations to convert time-series tables into hypertables.
-- Safe to re-run: if_not_exists => TRUE prevents errors on existing hypertables.

SELECT create_hypertable('price_snapshots', 'time', if_not_exists => TRUE, migrate_data => TRUE);
SELECT create_hypertable('pnl_snapshots', 'time', if_not_exists => TRUE, migrate_data => TRUE);
