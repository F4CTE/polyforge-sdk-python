-- Add approval fields to users table for beta access gating
ALTER TABLE "users" ADD COLUMN "approved" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "approvedAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "approvedBy" VARCHAR(255);
