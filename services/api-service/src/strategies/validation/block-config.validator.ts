import { BadRequestException } from "@nestjs/common";
import { validateStopLossTakeProfitPct } from "@polyforge/shared-types";

const PCT_VALIDATED_TYPES = new Set([
  "set_stop_loss",
  "take_profit",
  "SET_STOP_LOSS",
  "SET_TAKE_PROFIT",
  "TAKE_PROFIT",
]);

export interface BlockLike {
  type: string;
  config?: Record<string, unknown>;
}

export function validateBlockConfigs(blocks: BlockLike[]): void {
  for (const block of blocks) {
    if (!block.type || !PCT_VALIDATED_TYPES.has(block.type)) continue;

    const pct = block.config?.pct;
    if (pct !== undefined) {
      try {
        validateStopLossTakeProfitPct(pct, block.type);
      } catch (err: any) {
        throw new BadRequestException({
          code: "INVALID_BLOCK_CONFIG",
          message: err.message ?? "Invalid block config",
          blockType: block.type,
        });
      }
    }
  }
}
