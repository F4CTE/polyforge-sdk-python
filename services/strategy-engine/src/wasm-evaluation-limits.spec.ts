import { describe, expect, it } from "vitest";
import {
  assertWasmEvaluationBudget,
  MAX_WASM_BLOCKS_PER_TICK,
} from "./wasm-evaluation-limits";

describe("WASM evaluation limits", () => {
  it("allows strategies within the block budget", () => {
    expect(() =>
      assertWasmEvaluationBudget([
        [{ type: "trigger" }],
        [{ type: "condition", children: [{ type: "child" }] }],
      ]),
    ).not.toThrow();
  });

  it("rejects strategies over the block budget, including nested blocks", () => {
    const children = Array.from(
      { length: MAX_WASM_BLOCKS_PER_TICK + 1 },
      (_, index) => ({ id: `child-${index}` }),
    );

    expect(() =>
      assertWasmEvaluationBudget([[{ type: "condition", children }]]),
    ).toThrow("WASM tick block budget exceeded");
  });
});
