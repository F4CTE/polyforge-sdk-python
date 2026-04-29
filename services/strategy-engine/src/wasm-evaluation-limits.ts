export const MAX_WASM_BLOCKS_PER_TICK = 1_000;
export const MAX_WASM_EVALUATION_MS = 150;

function countBlocks(blocks: unknown[]): number {
  let total = 0;
  const stack = [...blocks];
  while (stack.length > 0) {
    total += 1;
    if (total > MAX_WASM_BLOCKS_PER_TICK) return total;
    const item = stack.pop();
    if (item && typeof item === "object") {
      const maybeChildren =
        (item as { children?: unknown; blocks?: unknown }).children ??
        (item as { blocks?: unknown }).blocks;
      if (Array.isArray(maybeChildren)) {
        for (const child of maybeChildren) {
          stack.push(child);
        }
      }
    }
  }
  return total;
}

export function assertWasmEvaluationBudget(blockGroups: unknown[][]): void {
  const totalBlocks = blockGroups.reduce(
    (sum, blocks) => sum + countBlocks(blocks),
    0,
  );
  if (totalBlocks > MAX_WASM_BLOCKS_PER_TICK) {
    throw new Error(
      `WASM tick block budget exceeded: ${totalBlocks}/${MAX_WASM_BLOCKS_PER_TICK}`,
    );
  }
}
