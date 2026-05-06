import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(__dirname, "../../../..");

function readRepoFile(path: string): string {
  return readFileSync(resolve(repoRoot, path), "utf8");
}

function userMigrations(): string[] {
  return readdirSync(resolve(repoRoot, "prisma/migrations"), {
    withFileTypes: true,
  })
    .filter((entry) => entry.isDirectory())
    .map((entry) =>
      readRepoFile(`prisma/migrations/${entry.name}/migration.sql`),
    );
}

describe("orders monetary database hardening", () => {
  it("stores JournalEntry monetary values as Decimal(20,6), never Float", () => {
    const schema = readRepoFile("prisma/schema.prisma");
    const journalModel = schema.match(/model JournalEntry \{[\s\S]*?\n\}/)?.[0];

    expect(journalModel).toBeDefined();
    expect(journalModel).toContain("price       Decimal  @db.Decimal(20, 6)");
    expect(journalModel).toContain("size        Decimal  @db.Decimal(20, 6)");
    expect(journalModel).toContain("pnl         Decimal? @db.Decimal(20, 6)");
    expect(journalModel).not.toMatch(/\b(price|size|pnl)\s+Float\??/);
  });

  it("migrates existing journal_entries float columns to DECIMAL(20,6)", () => {
    const combinedMigrations = userMigrations().join("\n");

    expect(combinedMigrations).toContain('ALTER TABLE "journal_entries"');
    expect(combinedMigrations).toContain(
      'ALTER COLUMN "price" TYPE DECIMAL(20,6)',
    );
    expect(combinedMigrations).toContain(
      'ALTER COLUMN "size" TYPE DECIMAL(20,6)',
    );
    expect(combinedMigrations).toContain(
      'ALTER COLUMN "pnl" TYPE DECIMAL(20,6)',
    );
  });

  it("adds database checks for valid order size and price ranges", () => {
    const combinedMigrations = userMigrations().join("\n");

    expect(combinedMigrations).toContain(
      'CONSTRAINT "orders_size_positive" CHECK ("size" > 0)',
    );
    expect(combinedMigrations).toContain(
      'CONSTRAINT "orders_price_range" CHECK ("price" > 0 AND "price" <= 1)',
    );
  });
});
