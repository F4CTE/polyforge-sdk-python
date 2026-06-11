import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function read(filePath) {
  return readFileSync(filePath, "utf8");
}

function locationBlocks(source) {
  const blocks = [];
  const locationPattern = /location\s+(?:=|~\*|~|\^~)?\s*[^{]+{/g;
  let match;

  while ((match = locationPattern.exec(source)) !== null) {
    const open = source.indexOf("{", match.index);
    let depth = 0;

    for (let i = open; i < source.length; i += 1) {
      if (source[i] === "{") depth += 1;
      if (source[i] === "}") depth -= 1;

      if (depth === 0) {
        blocks.push(source.slice(match.index, i + 1));
        locationPattern.lastIndex = i + 1;
        break;
      }
    }
  }

  return blocks;
}

function assertHasAll(block, headers, label) {
  for (const header of headers) {
    assert.ok(block.includes(header), `${label} must re-emit ${header}`);
  }
}

const COMMON_SECURITY_HEADERS = [
  "X-Content-Type-Options",
  "X-Frame-Options",
  "X-XSS-Protection",
  "Referrer-Policy",
  "Content-Security-Policy",
];

const TLS_SECURITY_HEADERS = [
  "Strict-Transport-Security",
  ...COMMON_SECURITY_HEADERS,
];

test("production gateway copies reusable security header snippets", () => {
  const dockerfile = read("services/gateway/Dockerfile");

  for (const snippet of [
    "landing-security-headers.conf",
    "user-app-security-headers.conf",
    "admin-app-security-headers.conf",
  ]) {
    assert.ok(
      dockerfile.includes(`/etc/nginx/conf.d/${snippet}`),
      `services/gateway/Dockerfile must copy ${snippet}`,
    );
  }
});

test("production gateway cached SPA locations include app security headers", () => {
  const source = read("services/gateway/nginx.prod.conf");
  const cacheLocations = locationBlocks(source).filter((block) =>
    block.includes("add_header") &&
    block.includes("Cache-Control") &&
    !block.includes("landing-security-headers.conf"),
  );

  assert.equal(
    cacheLocations.length,
    4,
    "Expected user/admin static asset and index.html cache locations",
  );

  assert.equal(
    cacheLocations.filter((block) =>
      block.includes("user-app-security-headers.conf"),
    ).length,
    2,
    "User SPA static assets and index.html must include user headers",
  );
  assert.equal(
    cacheLocations.filter((block) =>
      block.includes("admin-app-security-headers.conf"),
    ).length,
    2,
    "Admin SPA static assets and index.html must include admin headers",
  );
});

test("production security header snippets define the full header set", () => {
  for (const filePath of [
    "services/gateway/landing-security-headers.conf",
    "services/gateway/user-app-security-headers.conf",
    "services/gateway/admin-app-security-headers.conf",
  ]) {
    const snippet = read(filePath);
    assertHasAll(snippet, TLS_SECURITY_HEADERS, filePath);
    assertHasAll(snippet, ["Permissions-Policy"], filePath);
  }
});

test("mounted SSL gateway cache/status locations re-emit security headers", () => {
  const source = read("apps/gateway/nginx.ssl.conf");
  const affectedLocations = locationBlocks(source).filter(
    (block) =>
      block.includes("add_header") &&
      (block.includes("X-Cache-Status") || block.includes("Cache-Control")),
  );

  assert.equal(
    affectedLocations.length,
    6,
    "Expected four micro-cache locations and two static asset cache locations",
  );

  for (const [index, block] of affectedLocations.entries()) {
    assertHasAll(
      block,
      TLS_SECURITY_HEADERS,
      `apps/gateway cache block ${index}`,
    );
  }
});

test("HTTP dev gateway micro-cache locations re-emit non-HSTS security headers", () => {
  const source = read("services/gateway/nginx.dev.conf");
  const cacheLocations = locationBlocks(source).filter((block) =>
    block.includes("X-Cache-Status"),
  );

  assert.equal(
    cacheLocations.length,
    4,
    "Expected four dev micro-cache locations",
  );

  for (const [index, block] of cacheLocations.entries()) {
    assertHasAll(
      block,
      COMMON_SECURITY_HEADERS,
      `services/gateway/nginx.dev.conf micro-cache block ${index}`,
    );
  }
});
