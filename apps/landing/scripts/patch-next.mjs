#!/usr/bin/env node

/**
 * Patch Next.js 16.2.x build to fix global-error/not-found prerender crash.
 *
 * Root cause: isPageStatic() in next/dist/build/utils.js returns appConfig: {}
 * for internal routes (_global-error, _not-found), causing Next.js to
 * incorrectly add them to staticPaths and attempt SSR prerendering. React's
 * context dispatcher is null during prerender, causing:
 *   TypeError: Cannot read properties of null (reading 'useContext')
 *
 * Fixed upstream in next@16.3.0-canary.2. Remove this script when upgrading.
 *
 * @see https://github.com/vercel/next.js/issues/87719
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const UTILS_PATH = join(
  import.meta.dirname,
  "..",
  "node_modules",
  "next",
  "dist",
  "build",
  "utils.js",
);

const PATCH_1_APPLIED = "page === _constants1.UNDERSCORE_GLOBAL_ERROR_ROUTE || page === _constants1.UNDERSCORE_NOT_FOUND_ROUTE";
const PATCH_2_APPLIED = "appConfig: { revalidate: 0 }";
const PATCH_3_APPLIED = "originalAppPath === _constants1.UNDERSCORE_GLOBAL_ERROR_ROUTE_ENTRY ? { revalidate: 0 } :";

try {
  let content = readFileSync(UTILS_PATH, "utf8");
  let patched = false;

  // Patch 1: Include _not-found in the early-return alongside _global-error
  // Guard against the already-patched result, not the raw _not-found token
  // (which may appear elsewhere in unpatched Next.js 16.2.x).
  if (!content.includes(PATCH_1_APPLIED)) {
    if (content.includes("if (page === _constants1.UNDERSCORE_GLOBAL_ERROR_ROUTE) {")) {
      content = content.replace(
        "if (page === _constants1.UNDERSCORE_GLOBAL_ERROR_ROUTE) {",
        "if (page === _constants1.UNDERSCORE_GLOBAL_ERROR_ROUTE || page === _constants1.UNDERSCORE_NOT_FOUND_ROUTE) {",
      );
      patched = true;
    }
  }

  // Patch 2: Return revalidate: 0 instead of empty appConfig
  if (content.includes("appConfig: {}")) {
    content = content.replaceAll("appConfig: {}", PATCH_2_APPLIED);
    patched = true;
  }

  // Patch 3: Fix the ternary on the fallback path
  if (
    !content.includes(PATCH_3_APPLIED) &&
    content.includes(
      "originalAppPath === _constants1.UNDERSCORE_GLOBAL_ERROR_ROUTE_ENTRY ? {} :",
    )
  ) {
    content = content.replace(
      "originalAppPath === _constants1.UNDERSCORE_GLOBAL_ERROR_ROUTE_ENTRY ? {} :",
      PATCH_3_APPLIED,
    );
    patched = true;
  }

  if (patched) {
    writeFileSync(UTILS_PATH, content, "utf8");

    // Verify all three patches were applied after the write.
    // `patched` is true when at least one source pattern matched, but a
    // partial Next.js shape change could leave some markers absent.
    const verificationContent = readFileSync(UTILS_PATH, "utf8");
    const allMarkersPresent =
      verificationContent.includes(PATCH_1_APPLIED) &&
      verificationContent.includes(PATCH_2_APPLIED) &&
      verificationContent.includes(PATCH_3_APPLIED);

    if (!allMarkersPresent) {
      console.error(
        "[patch-next] ERROR: Patch was applied but post-write verification failed. " +
          "Some expected markers are missing from next/dist/build/utils.js. " +
          "If upgrading to next@>=16.3.0, remove this patch script entirely. " +
          "Otherwise, update the patterns to match the current Next.js build output."
      );
      process.exit(1);
    }

    console.log("[patch-next] Patched isPageStatic() for _global-error and _not-found routes.");
  } else {
    // Check whether all three patches are already applied.
    const patchesAlreadyApplied =
      content.includes(PATCH_1_APPLIED) &&
      content.includes(PATCH_2_APPLIED) &&
      content.includes(PATCH_3_APPLIED);

    if (patchesAlreadyApplied) {
      console.log("[patch-next] Already patched, skipping.");
    } else {
      // The target file exists but none of the expected source patterns matched
      // and the patches are not already applied. This means the upstream Next.js
      // shape changed and the workaround may no longer apply — fail loudly so
      // this is visible in CI rather than silently shipping without the fix.
      console.error(
        "[patch-next] ERROR: next/dist/build/utils.js has an unexpected shape. " +
          "The patch patterns no longer match. If upgrading to next@>=16.3.0, " +
          "remove this patch script entirely. Otherwise, update the patterns to " +
          "match the current Next.js build output."
      );
      process.exit(1);
    }
  }
} catch (err) {
  if (err.code === "ENOENT") {
    console.error(
      "[patch-next] ERROR: next/dist/build/utils.js not found. " +
        "This patch is required for Next.js 16.2.x to prevent the _global-error " +
        "prerender crash. If upgrading to next@>=16.3.0, remove this patch script " +
        "entirely. Otherwise, ensure next is installed and its build output is accessible."
    );
    process.exit(1);
  } else {
    console.error("[patch-next] Failed to patch Next.js:", err.message);
    process.exit(1);
  }
}
