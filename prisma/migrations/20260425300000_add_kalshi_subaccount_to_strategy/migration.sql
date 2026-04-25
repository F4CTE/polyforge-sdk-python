-- Add optional Kalshi subaccount number to strategies for P&L attribution
ALTER TABLE "strategies" ADD COLUMN "kalshiSubaccount" SMALLINT;
