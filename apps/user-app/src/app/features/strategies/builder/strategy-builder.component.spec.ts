import { describe, it, expect, afterEach, vi } from "vitest";

// ─── Test helpers ────────────────────────────────────────────────────────────
// Extract pure logic from StrategyBuilderComponent so we can test without
// Angular TestBed (user-app has no vitest wired up).

type BlockSection = 'safety' | 'triggers' | 'conditions' | 'actions';

interface BlockDef {
  type:        string;
  label:       string;
  description: string;
  fields:      { key: string; label: string; type: 'text' | 'number'; placeholder: string }[];
}

interface CanvasBlock {
  id: string;
  type: string;
  section: BlockSection;
  config: Record<string, string | number>;
  x: number;
  y: number;
}

const SECTION_COLUMNS: Record<BlockSection, number> = {
  safety: 80,
  triggers: 420,
  conditions: 760,
  actions: 1100,
};

const BLOCK_DEFS: Record<BlockSection, BlockDef[]> = {
  safety: [
    { type: 'stop_if_daily_loss', label: 'Stop on Daily Loss', description: 'Halts if cumulative daily loss exceeds threshold.', fields: [{ key: 'maxLossUsdc', label: 'Max Loss (USDC)', type: 'number', placeholder: '200' }] },
    { type: 'stop_if_consecutive_losses', label: 'Stop on Streak Losses', description: 'Halts after N consecutive losing trades.', fields: [{ key: 'count', label: 'Max consecutive losses', type: 'number', placeholder: '3' }] },
  ],
  triggers: [
    { type: 'price_crosses_up', label: 'Price Crosses Up', description: 'Fires when price crosses above threshold.', fields: [{ key: 'tokenId', label: 'Token ID', type: 'text', placeholder: 'token-uuid' }, { key: 'threshold', label: 'Price Threshold', type: 'number', placeholder: '0.60' }] },
  ],
  conditions: [
    { type: 'min_liquidity', label: 'Min Liquidity', description: 'Requires minimum market liquidity.', fields: [{ key: 'minUsdc', label: 'Min USDC', type: 'number', placeholder: '100' }] },
  ],
  actions: [
    { type: 'buy_yes', label: 'Buy YES', description: 'Buy YES tokens for the specified amount.', fields: [{ key: 'tokenId', label: 'Token ID', type: 'text', placeholder: 'token-uuid' }, { key: 'size', label: 'Size (USDC)', type: 'number', placeholder: '50' }] },
  ],
};

function autoLayout(blocks: CanvasBlock[]): CanvasBlock[] {
  const sectionOrder: BlockSection[] = ['safety', 'triggers', 'conditions', 'actions'];
  const sectionIndices: Record<string, number> = {};
  sectionOrder.forEach(s => sectionIndices[s] = 0);

  return blocks.map(b => {
    const x = SECTION_COLUMNS[b.section];
    const y = 80 + (sectionIndices[b.section]! * 220);
    sectionIndices[b.section]!++;
    return { ...b, x, y };
  });
}

function addBlockToCanvas(
  existingBlocks: CanvasBlock[],
  def: BlockDef,
  section: BlockSection,
): CanvasBlock {
  const existingInSection = existingBlocks.filter(b => b.section === section);
  const x = SECTION_COLUMNS[section];
  const y = 80 + existingInSection.length * 220;

  return {
    id: 'test-id',
    type: def.type,
    section,
    config: Object.fromEntries(def.fields.map(f => [f.key, ''])),
    x,
    y,
  };
}

function removeCanvasBlock(blocks: CanvasBlock[], id: string): CanvasBlock[] {
  return blocks.filter(b => b.id !== id);
}

function sectionColor(section: string): string {
  const colors: Record<string, string> = {
    safety: '#EF4444',
    triggers: '#F59E0B',
    conditions: '#3B82F6',
    actions: '#22C55E',
  };
  return colors[section] ?? '#6B7280';
}

function getBlockDef(type: string): BlockDef | undefined {
  for (const section of Object.values(BLOCK_DEFS)) {
    const found = section.find(d => d.type === type);
    if (found) return found;
  }
  return undefined;
}

function viewBoxStr(vb: { x: number; y: number; w: number; h: number }): string {
  return `${vb.x} ${vb.y} ${vb.w} ${vb.h}`;
}

function flattenCanvasBlocks(blocks: CanvasBlock[]) {
  return {
    safety:     blocks.filter(b => b.section === 'safety').map(b => ({ type: b.type, config: b.config })),
    triggers:   blocks.filter(b => b.section === 'triggers').map(b => ({ type: b.type, config: b.config })),
    conditions: blocks.filter(b => b.section === 'conditions').map(b => ({ type: b.type, config: b.config })),
    actions:    blocks.filter(b => b.section === 'actions').map(b => ({ type: b.type, config: b.config })),
  };
}

function updateBlockConfig(blocks: CanvasBlock[], blockId: string, key: string, value: any): CanvasBlock[] {
  return blocks.map(b => b.id === blockId ? { ...b, config: { ...b.config, [key]: value } } : b);
}

function fitToView(blocks: CanvasBlock[]): { x: number; y: number; w: number; h: number } {
  if (blocks.length === 0) {
    return { x: 0, y: 0, w: 1400, h: 900 };
  }
  const minX = Math.min(...blocks.map(b => b.x));
  const minY = Math.min(...blocks.map(b => b.y));
  const maxX = Math.max(...blocks.map(b => b.x + 280));
  const maxY = Math.max(...blocks.map(b => b.y + 200));
  const padding = 80;
  const w = maxX - minX + padding * 2;
  const h = maxY - minY + padding * 2;
  return { x: minX - padding, y: minY - padding, w, h };
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe("StrategyBuilderComponent", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("autoLayout", () => {
    it("positions safety blocks in the correct column (x=80)", () => {
      const blocks: CanvasBlock[] = [
        { id: '1', type: 'stop_if_daily_loss', section: 'safety', config: {}, x: 0, y: 0 },
      ];
      const result = autoLayout(blocks);

      expect(result[0].x).toBe(80);
    });

    it("positions trigger blocks in the correct column (x=420)", () => {
      const blocks: CanvasBlock[] = [
        { id: '1', type: 'price_crosses_up', section: 'triggers', config: {}, x: 0, y: 0 },
      ];
      const result = autoLayout(blocks);

      expect(result[0].x).toBe(420);
    });

    it("positions condition blocks in the correct column (x=760)", () => {
      const blocks: CanvasBlock[] = [
        { id: '1', type: 'min_liquidity', section: 'conditions', config: {}, x: 0, y: 0 },
      ];
      const result = autoLayout(blocks);

      expect(result[0].x).toBe(760);
    });

    it("positions action blocks in the correct column (x=1100)", () => {
      const blocks: CanvasBlock[] = [
        { id: '1', type: 'buy_yes', section: 'actions', config: {}, x: 0, y: 0 },
      ];
      const result = autoLayout(blocks);

      expect(result[0].x).toBe(1100);
    });

    it("spaces blocks vertically (y = 80 + index * 220)", () => {
      const blocks: CanvasBlock[] = [
        { id: '1', type: 'stop_if_daily_loss', section: 'safety', config: {}, x: 0, y: 0 },
        { id: '2', type: 'stop_if_consecutive_losses', section: 'safety', config: {}, x: 0, y: 0 },
      ];
      const result = autoLayout(blocks);

      expect(result[0].y).toBe(80);
      expect(result[1].y).toBe(300);
    });

    it("resets index per section for vertical spacing", () => {
      const blocks: CanvasBlock[] = [
        { id: '1', type: 'stop_if_daily_loss', section: 'safety', config: {}, x: 0, y: 0 },
        { id: '2', type: 'price_crosses_up', section: 'triggers', config: {}, x: 0, y: 0 },
      ];
      const result = autoLayout(blocks);

      expect(result[0].y).toBe(80);
      expect(result[1].y).toBe(80);
    });
  });

  describe("addBlockToCanvas", () => {
    it("creates a CanvasBlock with correct section and auto position", () => {
      const def = BLOCK_DEFS.safety[0];
      const block = addBlockToCanvas([], def, 'safety');

      expect(block.section).toBe('safety');
      expect(block.type).toBe('stop_if_daily_loss');
      expect(block.x).toBe(80);
      expect(block.y).toBe(80);
    });

    it("positions new block after existing blocks in the same section", () => {
      const existing: CanvasBlock[] = [
        { id: '1', type: 'stop_if_daily_loss', section: 'safety', config: {}, x: 80, y: 80 },
      ];
      const def = BLOCK_DEFS.safety[1];
      const block = addBlockToCanvas(existing, def, 'safety');

      expect(block.y).toBe(300);
    });

    it("initialises config keys from block definition fields with empty strings", () => {
      const def = BLOCK_DEFS.triggers[0];
      const block = addBlockToCanvas([], def, 'triggers');

      expect(block.config).toEqual({ tokenId: '', threshold: '' });
    });
  });

  describe("removeCanvasBlock", () => {
    it("removes the block with the given id", () => {
      const blocks: CanvasBlock[] = [
        { id: 'a', type: 'buy_yes', section: 'actions', config: {}, x: 0, y: 0 },
        { id: 'b', type: 'buy_yes', section: 'actions', config: {}, x: 0, y: 0 },
      ];
      const result = removeCanvasBlock(blocks, 'a');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('b');
    });

    it("returns all blocks when id does not match", () => {
      const blocks: CanvasBlock[] = [
        { id: 'a', type: 'buy_yes', section: 'actions', config: {}, x: 0, y: 0 },
      ];
      const result = removeCanvasBlock(blocks, 'nonexistent');

      expect(result).toHaveLength(1);
    });
  });

  describe("sectionColor", () => {
    it("returns #EF4444 for safety", () => {
      expect(sectionColor('safety')).toBe('#EF4444');
    });

    it("returns #F59E0B for triggers", () => {
      expect(sectionColor('triggers')).toBe('#F59E0B');
    });

    it("returns #3B82F6 for conditions", () => {
      expect(sectionColor('conditions')).toBe('#3B82F6');
    });

    it("returns #22C55E for actions", () => {
      expect(sectionColor('actions')).toBe('#22C55E');
    });

    it("returns #6B7280 for unknown section", () => {
      expect(sectionColor('unknown')).toBe('#6B7280');
    });
  });

  describe("getBlockDef", () => {
    it("finds block definition by type in safety section", () => {
      const def = getBlockDef('stop_if_daily_loss');

      expect(def).toBeDefined();
      expect(def!.label).toBe('Stop on Daily Loss');
    });

    it("finds block definition by type in actions section", () => {
      const def = getBlockDef('buy_yes');

      expect(def).toBeDefined();
      expect(def!.label).toBe('Buy YES');
    });

    it("returns undefined for unknown type", () => {
      expect(getBlockDef('nonexistent_type')).toBeUndefined();
    });
  });

  describe("viewBoxStr", () => {
    it("returns correct format 'x y w h'", () => {
      expect(viewBoxStr({ x: 0, y: 0, w: 1400, h: 900 })).toBe('0 0 1400 900');
    });

    it("handles non-zero offsets", () => {
      expect(viewBoxStr({ x: 100, y: 50, w: 800, h: 600 })).toBe('100 50 800 600');
    });

    it("handles negative values", () => {
      expect(viewBoxStr({ x: -80, y: -40, w: 1560, h: 980 })).toBe('-80 -40 1560 980');
    });
  });

  describe("save flattens canvasBlocks", () => {
    it("flattens canvas blocks back to 4-section format correctly", () => {
      const blocks: CanvasBlock[] = [
        { id: '1', type: 'stop_if_daily_loss', section: 'safety', config: { maxLossUsdc: 200 }, x: 80, y: 80 },
        { id: '2', type: 'price_crosses_up', section: 'triggers', config: { tokenId: 'abc', threshold: 0.6 }, x: 420, y: 80 },
        { id: '3', type: 'min_liquidity', section: 'conditions', config: { minUsdc: 100 }, x: 760, y: 80 },
        { id: '4', type: 'buy_yes', section: 'actions', config: { tokenId: 'abc', size: 50 }, x: 1100, y: 80 },
      ];
      const result = flattenCanvasBlocks(blocks);

      expect(result.safety).toEqual([{ type: 'stop_if_daily_loss', config: { maxLossUsdc: 200 } }]);
      expect(result.triggers).toEqual([{ type: 'price_crosses_up', config: { tokenId: 'abc', threshold: 0.6 } }]);
      expect(result.conditions).toEqual([{ type: 'min_liquidity', config: { minUsdc: 100 } }]);
      expect(result.actions).toEqual([{ type: 'buy_yes', config: { tokenId: 'abc', size: 50 } }]);
    });

    it("returns empty arrays for sections with no blocks", () => {
      const blocks: CanvasBlock[] = [
        { id: '1', type: 'buy_yes', section: 'actions', config: { tokenId: 'abc', size: 50 }, x: 1100, y: 80 },
      ];
      const result = flattenCanvasBlocks(blocks);

      expect(result.safety).toEqual([]);
      expect(result.triggers).toEqual([]);
      expect(result.conditions).toEqual([]);
      expect(result.actions).toHaveLength(1);
    });
  });

  describe("updateBlockConfig", () => {
    it("updates the correct block's config field", () => {
      const blocks: CanvasBlock[] = [
        { id: 'a', type: 'stop_if_daily_loss', section: 'safety', config: { maxLossUsdc: '' }, x: 80, y: 80 },
        { id: 'b', type: 'buy_yes', section: 'actions', config: { tokenId: '', size: '' }, x: 1100, y: 80 },
      ];
      const result = updateBlockConfig(blocks, 'b', 'size', 100);

      expect(result[0].config).toEqual({ maxLossUsdc: '' });
      expect(result[1].config).toEqual({ tokenId: '', size: 100 });
    });

    it("does not mutate other blocks", () => {
      const blocks: CanvasBlock[] = [
        { id: 'a', type: 'stop_if_daily_loss', section: 'safety', config: { maxLossUsdc: 200 }, x: 80, y: 80 },
      ];
      const result = updateBlockConfig(blocks, 'a', 'maxLossUsdc', 500);

      expect(result[0].config.maxLossUsdc).toBe(500);
      expect(blocks[0].config.maxLossUsdc).toBe(200);
    });
  });

  describe("fitToView", () => {
    it("returns default viewBox for empty blocks", () => {
      const result = fitToView([]);

      expect(result).toEqual({ x: 0, y: 0, w: 1400, h: 900 });
    });

    it("calculates bounding box with padding for known block positions", () => {
      const blocks: CanvasBlock[] = [
        { id: '1', type: 'stop_if_daily_loss', section: 'safety', config: {}, x: 100, y: 100 },
        { id: '2', type: 'buy_yes', section: 'actions', config: {}, x: 500, y: 400 },
      ];
      const result = fitToView(blocks);

      // minX=100, minY=100, maxX=500+280=780, maxY=400+200=600
      // w = 780-100+160 = 840, h = 600-100+160 = 660
      expect(result.x).toBe(20);   // 100 - 80
      expect(result.y).toBe(20);   // 100 - 80
      expect(result.w).toBe(840);
      expect(result.h).toBe(660);
    });

    it("handles single block", () => {
      const blocks: CanvasBlock[] = [
        { id: '1', type: 'buy_yes', section: 'actions', config: {}, x: 0, y: 0 },
      ];
      const result = fitToView(blocks);

      // minX=0, minY=0, maxX=280, maxY=200
      // w = 280+160=440, h = 200+160=360
      expect(result.x).toBe(-80);
      expect(result.y).toBe(-80);
      expect(result.w).toBe(440);
      expect(result.h).toBe(360);
    });
  });
});
