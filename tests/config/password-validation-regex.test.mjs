import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const DTO_FILES = [
  "services/auth-service/src/auth/dto/register.dto.ts",
  "services/auth-service/src/auth/dto/reset-password.dto.ts",
  "services/api-service/src/settings/dto/update-password.dto.ts",
  "services/admin-api-service/src/admins/dto/create-admin.dto.ts",
  "services/admin-api-service/src/admins/dto/update-admin.dto.ts",
];

test("password validation regexes include an inline 8..100 character bound", () => {
  for (const filePath of DTO_FILES) {
    const source = readFileSync(filePath, "utf8");
    const matches = [...source.matchAll(/@Matches\((\/[^\n]+\/)/g)];
    const passwordMatches = matches.filter(([decorator]) =>
      /(?=.*\\d)|(?=.*\[A-Z\])|(?=.*\^A-Za-z\\d\])/.test(decorator),
    );

    assert.notEqual(
      passwordMatches.length,
      0,
      `${filePath} should contain a password @Matches decorator`,
    );

    for (const [decorator, regexLiteral] of passwordMatches) {
      assert.ok(
        regexLiteral.includes("(?=.{8,100}$)"),
        `${filePath} password regex must bound total length inline: ${decorator}`,
      );
      assert.ok(
        !regexLiteral.includes(".+$"),
        `${filePath} password regex must not use an unbounded .+$ suffix`,
      );
    }
  }
});
