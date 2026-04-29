ALTER TABLE "User"
  ADD COLUMN "us_rail_terms_accepted_at" TIMESTAMP(3),
  ADD COLUMN "us_rail_terms_version" VARCHAR(64),
  ADD COLUMN "us_rail_terms_accepted_ip" VARCHAR(45),
  ADD COLUMN "us_rail_terms_accepted_user_agent" VARCHAR(512);
