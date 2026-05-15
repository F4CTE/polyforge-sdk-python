import { test, expect } from "@playwright/test";
import { StrategyBuilderPage } from "../pages/strategy-builder.page";
import {
  apiRegisterAndVerify,
  apiLogin,
  uniqueEmail,
  uniqueUsername,
  apiDeleteStrategy,
  apiCreateStrategy,
} from "../helpers/api";

/**
 * Strategy Builder — WCAG 2.1.1 Keyboard Accessibility (@a11y @keyboard)
 *
 * Validates that the strategy builder canvas supports keyboard-only graph
 * authoring without a mouse or pointer device.
 *
 * Covers POLA-1995 acceptance criteria:
 *  - Edge creation via keyboard (source select → C → target → Enter)
 *  - Connection cancellation via Escape
 *  - Edge deletion via keyboard (Backspace/Delete)
 *  - Screen reader status announcements
 *  - No regression to existing mouse drag flow
 */

test.describe("Strategy Builder — Keyboard A11y", () => {
  let token: string;
  let tokenIssuedAt: number;
  let credentials: { email: string; password: string };
  let strategyId: string;
  let builder: StrategyBuilderPage;

  const TOKEN_TTL_MS = 15 * 60_000;
  const REFRESH_MARGIN_MS = 3 * 60_000;

  test.beforeAll(async () => {
    test.setTimeout(120_000);
    const email = uniqueEmail("kb-a11y");
    const username = uniqueUsername("kba11y");
    const password = "TestPass123!";
    const res = await apiRegisterAndVerify(email, username, password);
    token = res.token;
    tokenIssuedAt = Date.now();
    credentials = { email, password };

    const strategy = await apiCreateStrategy(token, "KB A11y Test Strategy");
    strategyId = strategy.id;
  });

  test.beforeEach(async ({ page }) => {
    if (Date.now() - tokenIssuedAt > TOKEN_TTL_MS - REFRESH_MARGIN_MS) {
      const res = await apiLogin(credentials.email, credentials.password);
      token = res.token;
      tokenIssuedAt = Date.now();
    }

    await page.context().addCookies([
      {
        name: "pf_token",
        value: token,
        domain: "localhost",
        path: "/",
      },
    ]);

    builder = new StrategyBuilderPage(page);
    await builder.gotoEdit(strategyId);
  });

  test.afterAll(async () => {
    try {
      await apiDeleteStrategy(token, strategyId);
    } catch {
      /* ignore */
    }
  });

  test("@a11y @keyboard should create a connection between two nodes using keyboard only", async ({
    page,
  }, testInfo) => {
    testInfo.setTimeout(60_000);

    // Place nodes on the canvas via palette click (pre-existing mouse operation
    // that provides the starting layout — the connection flow is keyboard-only).
    await builder.selectSection("Triggers");
    await builder.addBlock("Price Crosses Up");
    await expect(builder.blockCards().first()).toBeVisible({ timeout: 5_000 });

    await builder.selectSection("Actions");
    await builder.addBlock("Buy YES");
    await expect(builder.blockCards()).toHaveCount(2, { timeout: 5_000 });

    // Verify no edges exist before keyboard connection
    const edgesBefore = page.locator(".react-flow__edge");
    await expect(edgesBefore).toHaveCount(0);

    // ── Keyboard connection flow ──────────────────────────────────────────
    // Step 1: Click canvas to establish focus context, then focus first node
    await page.locator(".react-flow__viewport").click();
    await page.waitForTimeout(200);

    // Step 2: Tab to focus the trigger node (source), press Enter to select
    await page.keyboard.press("Tab");
    await page.waitForTimeout(200);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(200);

    // Step 3: Verify source_selected banner is visible
    const sourceBanner = page.locator("text=/Source:.*Price Crosses Up/");
    await expect(sourceBanner).toBeVisible({ timeout: 3_000 });

    // Step 4: Press C to start wiring
    await page.keyboard.press("c");
    await page.waitForTimeout(200);

    // Step 5: Verify connecting banner is visible
    const wiringBanner = page.locator("text=/Wiring from.*Price Crosses Up/");
    await expect(wiringBanner).toBeVisible({ timeout: 3_000 });

    // Step 6: Tab to the target node (action block)
    await page.keyboard.press("Tab");
    await page.waitForTimeout(300);

    // Step 7: Press Enter to commit the connection
    await page.keyboard.press("Enter");
    await page.waitForTimeout(500);

    // Step 8: Verify an edge was created with correct source/target handles
    const edgesAfter = page.locator(".react-flow__edge");
    const edgeCount = await edgesAfter.count();
    expect(
      edgeCount,
      "Expected at least 1 edge after keyboard connection",
    ).toBeGreaterThanOrEqual(1);

    // Verify handle-level correctness: read edge data from the stable
    // window helper exposed by StrategyCanvas.
    const edgeHandles = await page.evaluate(
      () =>
        (
          window as unknown as {
            __polyforgeGetEdges?: () => Array<{
              id: string;
              source: string;
              target: string;
              sourceHandle: string | null;
              targetHandle: string | null;
            }>;
          }
        ).__polyforgeGetEdges?.() ?? null,
    );

    if (edgeHandles && edgeHandles.length > 0) {
      const first = edgeHandles[0];
      // Block trigger node (Price Crosses Up) has no named source handle → null
      expect(
        first.sourceHandle,
        "Trigger block source handle should be null (default)",
      ).toBeNull();
      // Block action node (Buy YES) has no named target handle → null
      expect(
        first.targetHandle,
        "Action block target handle should be null (default)",
      ).toBeNull();
    } else {
      // Fallback: verify the edge path has sensible geometry, indicating the
      // edge connects source → target nodes rather than being a detached stub.
      const firstEdge = edgesAfter.first();
      const edgePath = await firstEdge
        .locator(".react-flow__edge-path")
        .getAttribute("d");
      expect(edgePath, "Edge should have a path definition").toBeTruthy();
      expect(
        edgePath!.length,
        "Edge path should be non-trivial",
      ).toBeGreaterThan(10);
    }
  });

  test("@a11y @keyboard should announce connection states to screen readers", async ({
    page,
  }, testInfo) => {
    testInfo.setTimeout(60_000);

    await builder.selectSection("Triggers");
    await builder.addBlock("Price Crosses Up");
    await expect(builder.blockCards().first()).toBeVisible({ timeout: 5_000 });

    await builder.selectSection("Actions");
    await builder.addBlock("Buy YES");
    await expect(builder.blockCards()).toHaveCount(2, { timeout: 5_000 });

    await page.locator(".react-flow__viewport").click();
    await page.waitForTimeout(200);

    // Verify the status announcer element exists and is sr-only
    const announcer = page.locator(
      '[role="status"][aria-live="polite"].sr-only',
    );
    await expect(announcer).toBeVisible();

    // Select source node
    await page.keyboard.press("Tab");
    await page.waitForTimeout(200);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(200);

    // Verify source_selected announcement
    const sourceMsg = await announcer.textContent();
    expect(sourceMsg).toContain("Source selected");
    expect(sourceMsg).toContain("Price Crosses Up");

    // Start wiring
    await page.keyboard.press("c");
    await page.waitForTimeout(200);

    // Verify connecting announcement
    const wiringMsg = await announcer.textContent();
    expect(wiringMsg).toContain("Wiring from");
    expect(wiringMsg).toContain("handle");

    // Complete connection
    await page.keyboard.press("Tab");
    await page.waitForTimeout(300);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(500);

    // Verify connected announcement
    const connectedMsg = await announcer.textContent();
    expect(connectedMsg).toContain("Connected");
    expect(connectedMsg).toContain("Buy YES");
  });

  test("@a11y @keyboard should cancel connection with Escape key", async ({
    page,
  }, testInfo) => {
    testInfo.setTimeout(60_000);

    await builder.selectSection("Triggers");
    await builder.addBlock("Price Crosses Up");
    await expect(builder.blockCards().first()).toBeVisible({ timeout: 5_000 });

    await builder.selectSection("Actions");
    await builder.addBlock("Buy YES");
    await expect(builder.blockCards()).toHaveCount(2, { timeout: 5_000 });

    // Select source node
    await page.locator(".react-flow__viewport").click();
    await page.waitForTimeout(200);
    await page.keyboard.press("Tab");
    await page.waitForTimeout(200);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(200);

    // Verify source_selected banner
    await expect(page.locator("text=/Source:.*Price Crosses Up/")).toBeVisible({
      timeout: 3_000,
    });

    // Cancel with Escape
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);

    // Verify banner is gone (back to idle — no connection banner visible)
    await expect(
      page.locator("text=/Source:.*Price Crosses Up/"),
    ).not.toBeVisible({ timeout: 3_000 });

    // Verify screen reader announcement reset
    const announcer = page.locator(
      '[role="status"][aria-live="polite"].sr-only',
    );
    const idleMsg = await announcer.textContent();
    expect(idleMsg).toContain("Canvas ready");
  });

  test("@a11y @keyboard should delete an edge using keyboard", async ({
    page,
  }, testInfo) => {
    testInfo.setTimeout(60_000);

    // Create two nodes and connect them via keyboard
    await builder.selectSection("Triggers");
    await builder.addBlock("Price Crosses Up");
    await expect(builder.blockCards().first()).toBeVisible({ timeout: 5_000 });

    await builder.selectSection("Actions");
    await builder.addBlock("Buy YES");
    await expect(builder.blockCards()).toHaveCount(2, { timeout: 5_000 });

    // Keyboard connection: select source → wire → target → commit
    await page.locator(".react-flow__viewport").click();
    await page.waitForTimeout(200);
    await page.keyboard.press("Tab");
    await page.waitForTimeout(200);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(200);
    await page.keyboard.press("c");
    await page.waitForTimeout(200);
    await page.keyboard.press("Tab");
    await page.waitForTimeout(200);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(500);

    // Verify edge exists
    const edges = page.locator(".react-flow__edge");
    const edgeCountBefore = await edges.count();
    expect(edgeCountBefore).toBeGreaterThanOrEqual(1);

    // Focus the edge with Tab (edges are focusable via edgesFocusable)
    // After the connection completes, focus may be on the canvas.
    // Tab through nodes to reach the edge, then delete.
    await page.locator(".react-flow__viewport").click();
    await page.waitForTimeout(200);

    // Tab through nodes to reach the edge (React Flow tab order: nodes → edges → canvas controls)
    const blockCount = await builder.blockCards().count();
    for (let i = 0; i < blockCount; i++) {
      await page.keyboard.press("Tab");
      await page.waitForTimeout(150);
    }
    // One more Tab to reach the first edge
    await page.keyboard.press("Tab");
    await page.waitForTimeout(200);

    // Delete the focused edge
    await page.keyboard.press("Backspace");
    await page.waitForTimeout(500);

    // Verify edge is removed
    const edgeCountAfter = await edges.count();
    expect(edgeCountAfter).toBeLessThan(edgeCountBefore);
  });

  test("@a11y @keyboard should delete a node using keyboard", async ({
    page,
  }, testInfo) => {
    testInfo.setTimeout(60_000);

    await builder.selectSection("Triggers");
    await builder.addBlock("Price Crosses Up");
    await expect(builder.blockCards().first()).toBeVisible({ timeout: 5_000 });

    const blocksBefore = builder.blockCards();
    const countBefore = await blocksBefore.count();

    // Focus and delete the node via keyboard
    await page.locator(".react-flow__viewport").click();
    await page.waitForTimeout(200);
    await page.keyboard.press("Tab");
    await page.waitForTimeout(200);
    await page.keyboard.press("Delete");
    await page.waitForTimeout(500);

    const countAfter = await builder.blockCards().count();
    expect(countAfter).toBeLessThan(countBefore);
  });

  test("@a11y @keyboard should wire multi-source-handle logic node cycling to false-out", async ({
    page,
  }, testInfo) => {
    testInfo.setTimeout(60_000);

    // IF_THEN_ELSE (Logic section) has two source handles: true-out, false-out.
    // Verify H cycling to false-out and assert the created edge has the correct sourceHandle.
    // Add source first so forward Tab goes IF_THEN_ELSE → Buy YES.
    await builder.selectSection("Logic");
    await builder.addBlock("If / Then / Else");
    await expect(builder.blockCards().first()).toBeVisible({ timeout: 5_000 });

    await builder.selectSection("Actions");
    await builder.addBlock("Buy YES");
    await expect(builder.blockCards()).toHaveCount(2, { timeout: 5_000 });

    await page.locator(".react-flow__viewport").click();
    await page.waitForTimeout(200);

    // Tab to IF_THEN_ELSE (1st in DOM order)
    await page.keyboard.press("Tab");
    await page.waitForTimeout(200);

    // Select IF_THEN_ELSE as source (default handle: true-out)
    await page.keyboard.press("Enter");
    await page.waitForTimeout(200);
    await expect(
      page.locator("text=/Source:.*If \\/ Then \\/ Else.*true-out/"),
    ).toBeVisible({ timeout: 3_000 });

    // Cycle source handle from true-out → false-out
    await page.keyboard.press("h");
    await page.waitForTimeout(200);
    await expect(
      page.locator("text=/Source:.*If \\/ Then \\/ Else.*false-out/"),
    ).toBeVisible({ timeout: 3_000 });

    // Start wiring with C
    await page.keyboard.press("c");
    await page.waitForTimeout(200);
    await expect(
      page.locator("text=/Wiring from.*If \\/ Then \\/ Else.*false-out/"),
    ).toBeVisible({ timeout: 3_000 });

    // Tab forward to Buy YES (2nd in DOM order)
    await page.keyboard.press("Tab");
    await page.waitForTimeout(300);

    // Connect
    await page.keyboard.press("Enter");
    await page.waitForTimeout(500);

    // Verify edge was created with false-out as sourceHandle
    const edgesAfter = page.locator(".react-flow__edge");
    await expect(edgesAfter.first()).toBeVisible({ timeout: 5_000 });

    const edgeHandles = await page.evaluate(
      () =>
        (
          window as unknown as {
            __polyforgeGetEdges?: () => Array<{
              id: string;
              source: string;
              target: string;
              sourceHandle: string | null;
              targetHandle: string | null;
            }>;
          }
        ).__polyforgeGetEdges?.() ?? null,
    );

    expect(
      edgeHandles,
      "Edge extraction should return handle data",
    ).toBeTruthy();
    expect(edgeHandles!.length, "Expected 1 edge").toBeGreaterThanOrEqual(1);
    const first = edgeHandles![0];
    expect(
      first.sourceHandle,
      "Source handle should be false-out after H cycling",
    ).toBe("false-out");
    expect(
      first.targetHandle,
      "Target handle for action block should be null (default)",
    ).toBeNull();
  });

  test("@a11y @keyboard should cycle two-input target handle on AND gate and verify targetHandle", async ({
    page,
  }, testInfo) => {
    testInfo.setTimeout(60_000);

    // AND_GATE (Logic section) has two target handles: input-a, input-b.
    // Verify H cycling in connecting mode and assert the created edge has the correct targetHandle.
    await builder.selectSection("Triggers");
    await builder.addBlock("Price Crosses Up");
    await expect(builder.blockCards().first()).toBeVisible({ timeout: 5_000 });

    await builder.selectSection("Logic");
    await builder.addBlock("AND");
    await expect(builder.blockCards()).toHaveCount(2, { timeout: 5_000 });

    await page.locator(".react-flow__viewport").click();
    await page.waitForTimeout(200);

    // Tab to Price Crosses Up (1st in DOM, triggers added first)
    await page.keyboard.press("Tab");
    await page.waitForTimeout(200);

    // Select as source
    await page.keyboard.press("Enter");
    await page.waitForTimeout(200);
    await expect(
      page.locator("text=/Source:.*Price Crosses Up.*default/"),
    ).toBeVisible({ timeout: 3_000 });

    // Start wiring
    await page.keyboard.press("c");
    await page.waitForTimeout(200);
    await expect(
      page.locator("text=/Wiring from.*Price Crosses Up.*default/"),
    ).toBeVisible({ timeout: 3_000 });

    // Tab to AND gate (2nd in DOM, logic added second — default target handle: input-a)
    await page.keyboard.press("Tab");
    await page.waitForTimeout(300);

    // Verify the banner shows the default target handle (input-a)
    await expect(
      page.locator("text=/Wiring from.*Price Crosses Up/"),
    ).toBeVisible({ timeout: 3_000 });

    // Cycle target handle from input-a → input-b
    await page.keyboard.press("h");
    await page.waitForTimeout(200);

    // Connect
    await page.keyboard.press("Enter");
    await page.waitForTimeout(500);

    // Verify edge was created with input-b as targetHandle
    const edgesAfter = page.locator(".react-flow__edge");
    await expect(edgesAfter.first()).toBeVisible({ timeout: 5_000 });

    const edgeHandles = await page.evaluate(
      () =>
        (
          window as unknown as {
            __polyforgeGetEdges?: () => Array<{
              id: string;
              source: string;
              target: string;
              sourceHandle: string | null;
              targetHandle: string | null;
            }>;
          }
        ).__polyforgeGetEdges?.() ?? null,
    );

    expect(
      edgeHandles,
      "Edge extraction should return handle data",
    ).toBeTruthy();
    expect(edgeHandles!.length, "Expected 1 edge").toBeGreaterThanOrEqual(1);
    const first = edgeHandles![0];
    expect(
      first.sourceHandle,
      "Trigger block source handle should be null (default)",
    ).toBeNull();
    expect(
      first.targetHandle,
      "Target handle should be input-b after H cycling",
    ).toBe("input-b");
  });

  test("@a11y @keyboard should wire to safety block wireable field handle", async ({
    page,
  }, testInfo) => {
    testInfo.setTimeout(60_000);

    // Stop on Daily Loss (Safety section) has one wireable field: maxLossUsdc.
    // Verify keyboard wiring connects to the correct field-level target handle.
    await builder.selectSection("Triggers");
    await builder.addBlock("Price Crosses Up");
    await expect(builder.blockCards().first()).toBeVisible({ timeout: 5_000 });

    await builder.selectSection("Safety");
    await builder.addBlock("Stop on Daily Loss");
    await expect(builder.blockCards()).toHaveCount(2, { timeout: 5_000 });

    await page.locator(".react-flow__viewport").click();
    await page.waitForTimeout(200);

    // Tab to Price Crosses Up (1st in DOM, triggers added first)
    await page.keyboard.press("Tab");
    await page.waitForTimeout(200);

    // Select as source
    await page.keyboard.press("Enter");
    await page.waitForTimeout(200);
    await expect(
      page.locator("text=/Source:.*Price Crosses Up.*default/"),
    ).toBeVisible({ timeout: 3_000 });

    // Start wiring
    await page.keyboard.press("c");
    await page.waitForTimeout(200);

    // Tab to Stop on Daily Loss (2nd in DOM, safety added second)
    await page.keyboard.press("Tab");
    await page.waitForTimeout(300);

    // Verify the banner shows connecting to the wireable field
    await expect(
      page.locator("text=/Wiring from.*Price Crosses Up/"),
    ).toBeVisible({ timeout: 3_000 });

    // Connect
    await page.keyboard.press("Enter");
    await page.waitForTimeout(500);

    // Verify edge was created with the wireable field as targetHandle
    const edgesAfter = page.locator(".react-flow__edge");
    await expect(edgesAfter.first()).toBeVisible({ timeout: 5_000 });

    const edgeHandles = await page.evaluate(
      () =>
        (
          window as unknown as {
            __polyforgeGetEdges?: () => Array<{
              id: string;
              source: string;
              target: string;
              sourceHandle: string | null;
              targetHandle: string | null;
            }>;
          }
        ).__polyforgeGetEdges?.() ?? null,
    );

    expect(
      edgeHandles,
      "Edge extraction should return handle data",
    ).toBeTruthy();
    expect(edgeHandles!.length, "Expected 1 edge").toBeGreaterThanOrEqual(1);
    const first = edgeHandles![0];
    expect(
      first.sourceHandle,
      "Trigger block source handle should be null (default)",
    ).toBeNull();
    expect(
      first.targetHandle,
      "Target handle should be the wireable field key",
    ).toBe("maxLossUsdc");
  });

  test("@a11y @keyboard mouse drag connection should still work", async ({
    page,
  }, testInfo) => {
    testInfo.setTimeout(60_000);

    // This test verifies the charter compliance: existing mouse drag flow is not broken
    await builder.selectSection("Triggers");
    await builder.addBlock("Price Crosses Up");
    await expect(builder.blockCards().first()).toBeVisible({ timeout: 5_000 });

    await builder.selectSection("Actions");
    await builder.addBlock("Buy YES");
    await expect(builder.blockCards()).toHaveCount(2, { timeout: 5_000 });

    // Count edges before drag to verify the drag creates a new edge
    const edgesBefore = page.locator(".react-flow__edge");
    const edgeCountBefore = await edgesBefore.count();

    // Mouse drag connection (pre-existing flow)
    const sourceHandles = page.locator(".react-flow__handle--source");
    const targetHandles = page.locator(".react-flow__handle--target");

    if (
      (await sourceHandles.count()) > 0 &&
      (await targetHandles.count()) > 0
    ) {
      const srcBox = await sourceHandles.first().boundingBox();
      const tgtBox = await targetHandles.first().boundingBox();
      if (srcBox && tgtBox) {
        await page.mouse.move(
          srcBox.x + srcBox.width / 2,
          srcBox.y + srcBox.height / 2,
        );
        await page.mouse.down();
        await page.mouse.move(
          tgtBox.x + tgtBox.width / 2,
          tgtBox.y + tgtBox.height / 2,
          { steps: 15 },
        );
        await page.mouse.up();
      }
    }

    // Verify mouse drag created at least one new edge (regression guard)
    const edgesAfter = page.locator(".react-flow__edge");
    const edgeCountAfter = await edgesAfter.count();
    expect(
      edgeCountAfter,
      "Mouse drag should create a new edge on the canvas",
    ).toBeGreaterThan(edgeCountBefore);
    await expect(edgesAfter.first()).toBeVisible({ timeout: 5_000 });
  });
});
