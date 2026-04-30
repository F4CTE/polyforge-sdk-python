import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const APP_GLOBAL_FILES = [
  "apps/admin-app/src/globals.css",
  "apps/user-app/src/globals.css",
];

const AUDITED_BARE_ROUNDED_FILES = [
  "apps/admin-app/src/pages/revenue/revenue.tsx",
  "apps/user-app/src/pages/orders/orders.tsx",
  "apps/user-app/src/pages/portfolio/portfolio.tsx",
  "apps/user-app/src/pages/analytics/correlation.tsx",
];

const AUDITED_ARBITRARY_UTILITY_FILES = [
  "apps/landing/app/components/backtest-section.tsx",
  "apps/landing/app/components/developer-section.tsx",
  "apps/landing/app/components/hero.tsx",
  "apps/user-app/src/pages/analytics/correlation.tsx",
  "apps/user-app/src/pages/orders/orders.tsx",
  "apps/user-app/src/pages/portfolio/portfolio.tsx",
];

const DOCUMENTED_ARBITRARY_UTILITIES = new Set([
  "lg:gap-[72px]",
  "py-[72px]",
  "aspect-[8/5]",
]);

function linesWith(filePath, predicate) {
  return readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .flatMap((line, index) => (predicate(line) ? [`${filePath}:${index + 1}: ${line.trim()}`] : []));
}

test("app global CSS uses keyboard-only focus selectors", () => {
  const offenders = APP_GLOBAL_FILES.flatMap((filePath) =>
    linesWith(filePath, (line) => /:focus(?!-visible|-within)/.test(line)),
  );

  assert.deepEqual(offenders, [], `Use :focus-visible instead of bare :focus:\n${offenders.join("\n")}`);
});

test("app global CSS border radii use design tokens", () => {
  const rawRadius = /border-radius:\s*(?!var\()[^;]*(?:px|rem)\b/;
  const offenders = APP_GLOBAL_FILES.flatMap((filePath) =>
    linesWith(filePath, (line) => rawRadius.test(line)),
  );

  assert.deepEqual(offenders, [], `Use radius tokens instead of raw CSS radius values:\n${offenders.join("\n")}`);
});

test("audited app UI does not use bare rounded utilities", () => {
  const bareRounded = /(?:^|\s|["'`{])rounded(?:\s|["'`}])/;
  const offenders = AUDITED_BARE_ROUNDED_FILES.flatMap((filePath) =>
    linesWith(filePath, (line) => bareRounded.test(line)),
  );

  assert.deepEqual(offenders, [], `Use explicit radius utilities such as rounded-sm, rounded-pf, or rounded-full:\n${offenders.join("\n")}`);
});

test("audited frontend class strings do not use undocumented arbitrary Tailwind utilities", () => {
  const arbitraryUtility = /(?:[A-Za-z0-9_:/!.-]+-\[[^\]\s"'`]+(?:\][^\s"'`]*)?|min-\[[^\]\s"'`]+\]:)/g;
  const offenders = AUDITED_ARBITRARY_UTILITY_FILES.flatMap((filePath) =>
    linesWith(filePath, (line) => {
      const utilities = line.match(arbitraryUtility) ?? [];
      return utilities.some((utility) => !DOCUMENTED_ARBITRARY_UTILITIES.has(utility));
    }),
  );

  assert.deepEqual(offenders, [], `Document the exception or replace the arbitrary utility with a tokenized class/helper:\n${offenders.join("\n")}`);
});
