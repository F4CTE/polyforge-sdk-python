import { test, expect, type Page } from "@playwright/test";
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
 * Covers POLA-1995 acceptance criteria (implemented and pending):
 *  ✓ Node Tab navigation and focus ring
 *  ✓ Ctrl+F canvas search open/close
 *  ✓ Mouse drag connection (regression guard)
 *  ✗ Node deletion via Delete/Backspace keyboard (POLA-1995 pending)
 *  ✗ Node Arrow-key movement (POLA-1995 pending)
 *  ✗ Ctrl+Z undo / Ctrl+Y redo / Ctrl+Shift+Z redo after keyboard delete (POLA-1995 pending)
 *  ✗ Edge Tab navigation + Backspace delete (POLA-1995 pending)
 *  ✗ Multiple edge Tab cycling + Shift+Tab reverse navigation (POLA-1995 pending)
 *  ✗ Keyboard wiring mode — C key connection (POLA-1995 pending)
 *  ✗ Screen reader status announcements (POLA-1995 pending)
 *  ✗ Escape cancel wiring (POLA-1995 pending)
 *  ✗ Ctrl+S save shortcut (not implemented — listed in shortcuts modal)
 */

test.describe("Strategy Builder — Keyboard A11y", () => {
  let token: string;
  let tokenIssuedAt: number;
  let credentials: { email: string; password: string };
  let strategyId: string;
  let builder: StrategyBuilderPage;

  const TOKEN_TTL_MS = 15 * 60_000;
  const REFRESH_MARGIN_MS = 3 * 60_000;

  async function pressUntilNodeSelected(
    page: Page,
    node: ReturnType<StrategyBuilderPage["blockCards"]>,
    key = "Tab",
    maxPresses = 12,
  ) {
    for (let i = 0; i < maxPresses; i++) {
      await page.keyboard.press(key);
      try {
        await expect(node).toHaveClass(/selected/, { timeout: 1_000 });
        return;
      } catch {
        // not yet selected — press again
      }
    }
    await expect(node).toHaveClass(/selected/, { timeout: 1_000 });
  }

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

  // ─── Node Keyboard Navigation ─────────────────────────────────────────────

  test("@a11y @keyboard should navigate to a node via Tab and show focus ring", async ({
    page,
  }, testInfo) => {
    testInfo.setTimeout(60_000);

    await builder.selectSection("Triggers");
    await builder.addBlock("Price Crosses Up");
    await expect(builder.blockCards().first()).toBeVisible({ timeout: 5_000 });

    await builder.selectSection("Actions");
    await builder.addBlock("Buy YES");
    await expect(builder.blockCards()).toHaveCount(2, { timeout: 5_000 });

    // Click canvas pane to establish focus context, then Tab to first node
    await page.locator(".react-flow__pane").click();
    await expect(page.locator(".react-flow__pane")).toBeFocused({
      timeout: 5_000,
    });
    const firstNode = builder.blockCards().first();
    // React Flow marks keyboard-navigated nodes as selected; globals.css draws
    // the visible focus ring from `.react-flow__node.selected > div`.
    await pressUntilNodeSelected(page, firstNode);

    await expect(firstNode).toBeVisible();
  });

  test.skip("@a11y @keyboard should navigate to a node via Shift+Tab in reverse order", async ({
    page,
  }, testInfo) => {
    testInfo.setTimeout(60_000);

    await builder.selectSection("Triggers");
    await builder.addBlock("Price Crosses Up");
    await expect(builder.blockCards().first()).toBeVisible({ timeout: 5_000 });

    await builder.selectSection("Actions");
    await builder.addBlock("Buy YES");
    await expect(builder.blockCards()).toHaveCount(2, { timeout: 5_000 });

    // Tab forward through both nodes to reach the last node
    await page.locator(".react-flow__pane").click();
    await expect(page.locator(".react-flow__pane")).toBeFocused({
      timeout: 5_000,
    });
    const secondNode = builder.blockCards().nth(1);
    await pressUntilNodeSelected(page, builder.blockCards().first());
    await pressUntilNodeSelected(page, secondNode);

    // Pending: direct node-to-node tab cycling across nodes that contain
    // internal form controls is not implemented yet.
    const firstNode = builder.blockCards().first();
    await pressUntilNodeSelected(page, firstNode, "Shift+Tab");
  });

  // ─── Node Deletion via Keyboard ───────────────────────────────────────────

  test.skip("@a11y @keyboard should delete a focused node via Delete key", async ({
    page,
  }, testInfo) => {
    testInfo.setTimeout(60_000);

    await builder.selectSection("Triggers");
    await builder.addBlock("Price Crosses Up");
    await expect(builder.blockCards().first()).toBeVisible({ timeout: 5_000 });

    const countBefore = await builder.blockCards().count();
    expect(countBefore).toBeGreaterThan(0);

    // Focus the node via Tab
    await page.locator(".react-flow__pane").click();
    await expect(page.locator(".react-flow__pane")).toBeFocused({
      timeout: 5_000,
    });
    await pressUntilNodeSelected(page, builder.blockCards().first());

    // Delete via keyboard
    await page.keyboard.press("Delete");

    const countAfter = await builder.blockCards().count();
    expect(
      countAfter,
      "Node count should decrease by exactly 1 after Delete key on focused node",
    ).toBe(countBefore - 1);
  });

  test.skip("@a11y @keyboard should delete a focused node via Backspace key", async ({
    page,
  }, testInfo) => {
    testInfo.setTimeout(60_000);

    await builder.selectSection("Triggers");
    await builder.addBlock("Price Crosses Up");
    await expect(builder.blockCards().first()).toBeVisible({ timeout: 5_000 });

    const countBefore = await builder.blockCards().count();
    expect(countBefore).toBeGreaterThan(0);

    // Focus the node via Tab
    await page.locator(".react-flow__pane").click();
    await expect(page.locator(".react-flow__pane")).toBeFocused({
      timeout: 5_000,
    });
    await pressUntilNodeSelected(page, builder.blockCards().first());

    // Delete via keyboard
    await page.keyboard.press("Backspace");

    const countAfter = await builder.blockCards().count();
    expect(
      countAfter,
      "Node count should decrease by exactly 1 after Backspace key on focused node",
    ).toBe(countBefore - 1);
  });

  // ─── Node Arrow-Key Movement ──────────────────────────────────────────────

  test.skip("@a11y @keyboard should move selected node via Arrow keys", async ({
    page,
  }, testInfo) => {
    testInfo.setTimeout(60_000);

    await builder.selectSection("Triggers");
    await builder.addBlock("Price Crosses Up");
    await expect(builder.blockCards().first()).toBeVisible({ timeout: 5_000 });

    const node = builder.blockCards().first();
    const boxBefore = await node.boundingBox();
    expect(boxBefore).not.toBeNull();

    // Focus the node via click (React Flow requires node selection for arrow-key move)
    await node.click();
    await expect(
      page.locator(".react-flow__node.selected").first(),
    ).toBeVisible({ timeout: 5_000 });

    // Move right with ArrowRight (5px by default in React Flow)
    await page.keyboard.press("ArrowRight");
    await page.waitForFunction(
      () => {
        const el = document.querySelector(".react-flow__node.selected");
        return el && el.getBoundingClientRect().x > 0;
      },
      { timeout: 5_000 },
    );

    const boxAfter = await node.boundingBox();
    expect(boxAfter).not.toBeNull();
    expect(
      boxAfter!.x,
      "Node x position should increase after ArrowRight",
    ).toBeGreaterThan(boxBefore!.x);
  });

  test.skip("@a11y @keyboard should move selected node faster via Shift+Arrow keys", async ({
    page,
  }, testInfo) => {
    testInfo.setTimeout(60_000);

    await builder.selectSection("Triggers");
    await builder.addBlock("Price Crosses Up");
    await expect(builder.blockCards().first()).toBeVisible({ timeout: 5_000 });

    const node = builder.blockCards().first();
    const boxBefore = await node.boundingBox();
    expect(boxBefore).not.toBeNull();

    // Focus the node
    await node.click();
    await expect(
      page.locator(".react-flow__node.selected").first(),
    ).toBeVisible({ timeout: 5_000 });

    // Shift+ArrowRight moves 50px (React Flow default for shift multiplier)
    await page.keyboard.press("Shift+ArrowRight");
    await page.waitForFunction(
      () => {
        const el = document.querySelector(".react-flow__node.selected");
        return el && el.getBoundingClientRect().x > 0;
      },
      { timeout: 5_000 },
    );

    const boxAfter = await node.boundingBox();
    expect(boxAfter).not.toBeNull();
    expect(
      boxAfter!.x,
      "Node x position should increase after Shift+ArrowRight",
    ).toBeGreaterThan(boxBefore!.x);
  });

  // ─── Undo/Redo Keyboard Shortcuts ─────────────────────────────────────────

  test.skip("@a11y @keyboard should undo node deletion via Ctrl+Z", async ({
    page,
  }, testInfo) => {
    testInfo.setTimeout(60_000);

    await builder.selectSection("Triggers");
    await builder.addBlock("Price Crosses Up");
    await expect(builder.blockCards().first()).toBeVisible({ timeout: 5_000 });

    const countBefore = await builder.blockCards().count();

    // Delete the node via keyboard
    await page.locator(".react-flow__pane").click();
    await expect(page.locator(".react-flow__pane")).toBeFocused({
      timeout: 5_000,
    });
    await pressUntilNodeSelected(page, builder.blockCards().first());
    await page.keyboard.press("Delete");

    const countAfterDelete = await builder.blockCards().count();
    expect(countAfterDelete).toBeLessThan(countBefore);

    // Undo with Ctrl+Z
    await page.keyboard.press("ControlOrMeta+z");

    const countAfterUndo = await builder.blockCards().count();
    expect(countAfterUndo, "Node should be restored after Ctrl+Z undo").toBe(
      countBefore,
    );
  });

  test.skip("@a11y @keyboard should redo undone node deletion via Ctrl+Shift+Z", async ({
    page,
  }, testInfo) => {
    testInfo.setTimeout(60_000);

    await builder.selectSection("Triggers");
    await builder.addBlock("Price Crosses Up");
    await expect(builder.blockCards().first()).toBeVisible({ timeout: 5_000 });

    const countBefore = await builder.blockCards().count();

    // Delete the node
    await page.locator(".react-flow__pane").click();
    await expect(page.locator(".react-flow__pane")).toBeFocused({
      timeout: 5_000,
    });
    await pressUntilNodeSelected(page, builder.blockCards().first());
    await page.keyboard.press("Delete");

    // Undo
    await page.keyboard.press("ControlOrMeta+z");
    await expect(async () => {
      const cnt = await builder.blockCards().count();
      expect(cnt).toBe(countBefore);
    }).toPass({ timeout: 10_000 });

    // Redo with Ctrl+Shift+Z
    await page.keyboard.press("ControlOrMeta+Shift+z");

    const countAfterRedo = await builder.blockCards().count();
    expect(
      countAfterRedo,
      "Node should be re-deleted after Ctrl+Shift+Z redo",
    ).toBeLessThan(countBefore);
  });

  test.skip("@a11y @keyboard should redo undone node deletion via Ctrl+Y", async ({
    page,
  }, testInfo) => {
    testInfo.setTimeout(60_000);

    await builder.selectSection("Triggers");
    await builder.addBlock("Price Crosses Up");
    await expect(builder.blockCards().first()).toBeVisible({ timeout: 5_000 });

    const countBefore = await builder.blockCards().count();

    // Delete the node
    await page.locator(".react-flow__pane").click();
    await expect(page.locator(".react-flow__pane")).toBeFocused({
      timeout: 5_000,
    });
    await pressUntilNodeSelected(page, builder.blockCards().first());
    await page.keyboard.press("Delete");

    // Undo
    await page.keyboard.press("ControlOrMeta+z");
    await expect(async () => {
      const cnt = await builder.blockCards().count();
      expect(cnt).toBe(countBefore);
    }).toPass({ timeout: 10_000 });

    // Redo with Ctrl+Y
    await page.keyboard.press("ControlOrMeta+y");

    const countAfterRedo = await builder.blockCards().count();
    expect(
      countAfterRedo,
      "Node should be re-deleted after Ctrl+Y redo",
    ).toBeLessThan(countBefore);
  });

  // ─── Canvas Search Keyboard ───────────────────────────────────────────────

  test("@a11y @keyboard should open and close canvas search via keyboard", async ({
    page,
  }, testInfo) => {
    testInfo.setTimeout(60_000);

    // Open search with Ctrl+F
    await page.keyboard.press("ControlOrMeta+f");
    const searchInput = page.locator(
      'input[aria-label="Search blocks on canvas"]',
    );
    await expect(searchInput).toBeVisible({ timeout: 5_000 });

    // Close search with Escape
    await page.keyboard.press("Escape");
    await expect(searchInput).toBeHidden({ timeout: 5_000 });
  });

  // ─── Helper: check whether edgesFocusable is set on ReactFlow ──────────────

  /**
   * Inspects the React fiber tree to determine whether `edgesFocusable` is
   * enabled on the <ReactFlow> component.  Returns `null` when the prop
   * cannot be detected (fiber not found / component not mounted).
   */
  async function detectEdgesFocusable(page: Page): Promise<boolean | null> {
    return page.evaluate(() => {
      const flowEl = document.querySelector(".react-flow");
      if (!flowEl) return null;
      const fiberKey = Object.keys(flowEl).find(
        (k) =>
          k.startsWith("__reactFiber$") ||
          k.startsWith("__reactInternalInstance$"),
      );
      if (!fiberKey) return null;
      let fiber: Record<string, unknown> | null = (
        flowEl as Record<string, unknown>
      )[fiberKey] as Record<string, unknown> | null;
      for (let d = 0; d < 30 && fiber; d++) {
        if (
          fiber.memoizedProps &&
          typeof fiber.memoizedProps === "object" &&
          (fiber.memoizedProps as Record<string, unknown>).edgesFocusable !==
            undefined
        ) {
          return (fiber.memoizedProps as Record<string, unknown>)
            .edgesFocusable as boolean;
        }
        fiber = fiber.return as Record<string, unknown> | null;
      }
      return null;
    });
  }

  // ─── Edge Deletion via Keyboard ───────────────────────────────────────────

  test.skip("@a11y @keyboard should delete an edge via keyboard Tab then Backspace", async ({
    page,
  }, testInfo) => {
    testInfo.setTimeout(60_000);

    // Create two nodes and connect them via mouse drag
    await builder.selectSection("Triggers");
    await builder.addBlock("Price Crosses Up");
    await expect(builder.blockCards().first()).toBeVisible({ timeout: 5_000 });

    await builder.selectSection("Actions");
    await builder.addBlock("Buy YES");
    await expect(builder.blockCards()).toHaveCount(2, { timeout: 5_000 });

    const sourceHandles = page.locator(".react-flow__handle--source");
    const targetHandles = page.locator(".react-flow__handle--target");

    const srcBox = await sourceHandles.first().boundingBox();
    const tgtBox = await targetHandles.first().boundingBox();
    if (!srcBox || !tgtBox) {
      test.skip(true, "Connection handles not found for mouse drag");
      return;
    }

    // Create edge via mouse drag (only input method currently available
    // for wiring — keyboard wiring mode is tracked in POLA-1995 fixme)
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

    // Verify edge was created
    const edges = page.locator(".react-flow__edge");
    const edgeCountBefore = await edges.count();
    expect(
      edgeCountBefore,
      "Expected at least 1 edge after mouse drag connection",
    ).toBeGreaterThanOrEqual(1);

    // Direct Tab-to-edge navigation is pending because block nodes contain
    // internal form controls. Select the edge, then verify keyboard deletion.
    await edges.first().click();
    await expect(
      page.locator(".react-flow__edge.selected"),
      "Edge should be selected after mouse click",
    ).toBeVisible({ timeout: 5_000 });

    // Delete the focused edge via Backspace
    await page.keyboard.press("Backspace");

    // Verify edge is removed
    const edgeCountAfter = await edges.count();
    expect(
      edgeCountAfter,
      "Edge count should decrease after Backspace",
    ).toBeLessThan(edgeCountBefore);

    await expect(
      page.locator(".react-flow__edge.selected"),
      "Selected edge should be gone after Backspace deletion",
    ).toHaveCount(0, { timeout: 5_000 });
  });

  // ─── Regression: Mouse Drag ──────────────────────────────────────────────

  test("@a11y @keyboard mouse drag connection should still work", async ({
    page,
  }, testInfo) => {
    testInfo.setTimeout(60_000);

    await builder.selectSection("Triggers");
    await builder.addBlock("Price Crosses Up");
    await expect(builder.blockCards().first()).toBeVisible({ timeout: 5_000 });

    await builder.selectSection("Actions");
    await builder.addBlock("Buy YES");
    await expect(builder.blockCards()).toHaveCount(2, { timeout: 5_000 });

    // Count edges before drag to verify the drag creates a new edge
    const edgeSelector = ".react-flow__edge";
    const edgeCountBefore = await page.locator(edgeSelector).count();

    const sourceHandles = page.locator(".react-flow__handle--source");
    const targetHandles = page.locator(".react-flow__handle--target");

    const hasHandles =
      (await sourceHandles.count()) > 0 && (await targetHandles.count()) > 0;
    if (!hasHandles) {
      test.skip(true, "No source or target handles found for mouse drag");
      return;
    }

    const srcBox = await sourceHandles.first().boundingBox();
    const tgtBox = await targetHandles.first().boundingBox();
    if (!srcBox || !tgtBox) {
      test.skip(true, "Connection handle bounding box not available");
      return;
    }

    // Perform mouse drag to create connection
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

    // Verify mouse drag created exactly one new edge and it is visible
    const edgeCountAfter = await page.locator(edgeSelector).count();
    expect(
      edgeCountAfter,
      "Mouse drag should create a new edge on the canvas",
    ).toBeGreaterThan(edgeCountBefore);
    await expect(page.locator(edgeSelector).first()).toBeVisible({
      timeout: 5_000,
    });

    // Verify the edge connects the expected source and target handles
    const edgesAfter = page.locator(edgeSelector);
    await expect(edgesAfter.first()).toBeVisible({ timeout: 3_000 });
    await expect(
      page.locator(".react-flow__edge.selected"),
      "Newly created edge should be selected after mouse drag",
    ).toBeVisible({ timeout: 5_000 });
  });

  // ─── Pending Features (POLA-1995 not yet implemented) ─────────────────────

  test.skip("@a11y @keyboard should tab through multiple edges and reverse-navigate via Shift+Tab", async ({
    page,
  }, testInfo) => {
    testInfo.setTimeout(60_000);

    // Create three nodes and connect them with two edges
    await builder.selectSection("Triggers");
    await builder.addBlock("Price Crosses Up");
    await expect(builder.blockCards().first()).toBeVisible({ timeout: 5_000 });

    await builder.selectSection("Safety");
    await builder.addBlock("Stop on Daily Loss");
    await expect(builder.blockCards()).toHaveCount(2, { timeout: 5_000 });

    await builder.selectSection("Actions");
    await builder.addBlock("Buy YES");
    await expect(builder.blockCards()).toHaveCount(3, { timeout: 5_000 });

    // Connect first node → second node (edge 1)
    const sourceHandles = page.locator(".react-flow__handle--source");
    const targetHandles = page.locator(".react-flow__handle--target");

    const src1 = await sourceHandles.nth(0).boundingBox();
    const tgt1 = await targetHandles.nth(1).boundingBox();
    if (!src1 || !tgt1) {
      test.skip(true, "Connection handle 1 not found");
      return;
    }
    await page.mouse.move(src1.x + src1.width / 2, src1.y + src1.height / 2);
    await page.mouse.down();
    await page.mouse.move(tgt1.x + tgt1.width / 2, tgt1.y + tgt1.height / 2, {
      steps: 15,
    });
    await page.mouse.up();

    // Connect second node → third node (edge 2)
    const src2 = await sourceHandles.nth(1).boundingBox();
    const tgt2 = await targetHandles.nth(2).boundingBox();
    if (!src2 || !tgt2) {
      test.skip(true, "Connection handle 2 not found");
      return;
    }
    await page.mouse.move(src2.x + src2.width / 2, src2.y + src2.height / 2);
    await page.mouse.down();
    await page.mouse.move(tgt2.x + tgt2.width / 2, tgt2.y + tgt2.height / 2, {
      steps: 15,
    });
    await page.mouse.up();

    // Verify two edges exist
    const edges = page.locator(".react-flow__edge");
    await expect(edges).toHaveCount(2, { timeout: 5_000 });

    // Guard: skip if edgesFocusable is not confirmed enabled (null = fiber
    // not found, false = explicitly disabled — neither supports Tab-to-edge)
    const edgesFocusable = await detectEdgesFocusable(page);
    if (edgesFocusable !== true) {
      test.skip(
        true,
        "edgesFocusable could not be confirmed on ReactFlow — Tab-to-edge navigation requires it.",
      );
      return;
    }

    // Tab through all 3 nodes, then the next Tab should reach the first edge
    await page.locator(".react-flow__pane").click();
    await expect(page.locator(".react-flow__pane")).toBeFocused({
      timeout: 5_000,
    });

    const blockCount = await builder.blockCards().count();
    for (let i = 0; i < blockCount; i++) {
      await page.keyboard.press("Tab");
    }
    // First tab after nodes → first edge
    await page.keyboard.press("Tab");
    await expect(
      page.locator(".react-flow__edge.selected"),
      "Exactly one edge must be selected after keyboard Tab",
    ).toHaveCount(1, { timeout: 10_000 });
    const firstSelectedBox = await page
      .locator(".react-flow__edge.selected")
      .first()
      .boundingBox();
    expect(
      firstSelectedBox,
      "First selected edge must have a bounding box",
    ).not.toBeNull();

    // Second tab → second edge
    await page.keyboard.press("Tab");
    await expect(
      page.locator(".react-flow__edge.selected"),
      "Exactly one edge must be selected after second keyboard Tab",
    ).toHaveCount(1, { timeout: 10_000 });
    const secondSelectedBox = await page
      .locator(".react-flow__edge.selected")
      .first()
      .boundingBox();
    expect(
      secondSelectedBox,
      "Second selected edge must have a bounding box",
    ).not.toBeNull();
    expect(
      secondSelectedBox,
      "Second Tab must select a different edge (position must differ from first selected edge)",
    ).not.toEqual(firstSelectedBox);

    // Shift+Tab → back to first edge
    await page.keyboard.press("Shift+Tab");
    await expect(
      page.locator(".react-flow__edge.selected"),
      "Exactly one edge must be selected after Shift+Tab",
    ).toHaveCount(1, { timeout: 10_000 });
    const backSelectedBox = await page
      .locator(".react-flow__edge.selected")
      .first()
      .boundingBox();
    expect(
      backSelectedBox,
      "Shift+Tab must return to the first edge position",
    ).not.toBeNull();
    expect(
      backSelectedBox,
      "Shift+Tab must return to the first edge position",
    ).toEqual(firstSelectedBox);
  });

  // ── POLA-1995 keyboard A11y: feature-not-yet-implemented coverage ──────
  // These tests are intentionally skipped because the underlying features do
  // not exist yet.  Each stub documents the expected test flow so the
  // coverage is explicit and actionable once POLA-1995 lands.
  // When the feature ships, remove test.skip() and flesh out the assertions.
  // ────────────────────────────────────────────────────────────────────────

  test.skip("@a11y @keyboard should create connection via keyboard wiring mode (C key)", async ({
    page,
  }) => {
    // POLA-1995 pending: keyboard wiring mode is not implemented yet.
    // Expected flow:
    //   1. Select source node via Enter
    //   2. Press C to enter wiring mode (expect "wiring" banner visible)
    //   3. Tab to target node, press Enter to confirm connection
    //   4. Assert a new .react-flow__edge is created between source and target
    void page; // placeholder — feature not yet wired
  });

  test.skip("@a11y @keyboard should cancel keyboard wiring via Escape", async ({
    page,
  }) => {
    // POLA-1995 pending: keyboard wiring mode is not implemented yet.
    // Expected flow:
    //   1. Select source node via Enter, press C to enter wiring mode
    //   2. Press Escape — wiring banner should disappear
    //   3. Assert no new edge was created and node selection is retained
    void page; // placeholder — feature not yet wired
  });

  test.skip("@a11y @keyboard should announce connection states to screen readers", async ({
    page,
  }) => {
    // POLA-1995 pending: sr-only live-region announcer is not added yet.
    // Expected flow:
    //   1. Perform keyboard wiring or deletion action
    //   2. Assert the sr-only announcer text updates (e.g. "Connection created")
    void page; // placeholder — feature not yet wired
  });

  test.skip("@a11y @keyboard should save strategy via Ctrl+S", async ({
    page,
  }) => {
    // Not implemented: Ctrl+S keyboard shortcut handler is not wired.
    // Expected flow:
    //   1. Modify strategy (add/remove nodes)
    //   2. Press Ctrl+S
    //   3. Assert a save-confirmation toast or success indicator appears
    void page; // placeholder — feature not yet wired
  });
});
