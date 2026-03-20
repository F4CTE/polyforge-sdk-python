import { Component, OnInit, inject, signal, computed, DestroyRef } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { SelectModule } from 'primeng/select';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService } from 'primeng/api';

import { StrategiesApiService, Strategy, CreateStrategyDto, ExecMode, StrategyVisibility } from '../../../core/services/strategies-api.service';

// ─── Block definitions ──────────────────────────────────────────────────────

export interface BlockField {
  key:         string;
  label:       string;
  type:        'text' | 'number';
  placeholder: string;
}

export interface BlockDef {
  type:        string;
  label:       string;
  description: string;
  fields:      BlockField[];
}

export type BlockSection = 'safety' | 'triggers' | 'conditions' | 'actions';

export interface BlockInstance {
  id:      string;
  type:    string;
  config:  Record<string, string | number>;
}

export interface CanvasBlock {
  id: string;
  type: string;
  section: 'safety' | 'triggers' | 'conditions' | 'actions';
  config: Record<string, string | number>;
  x: number;
  y: number;
}

export const BLOCK_DEFS: Record<BlockSection, BlockDef[]> = {
  safety: [
    { type: 'stop_if_daily_loss',         label: 'Stop on Daily Loss',      description: 'Halts if cumulative daily loss exceeds threshold.',   fields: [{ key: 'maxLossUsdc',    label: 'Max Loss (USDC)',       type: 'number', placeholder: '200' }] },
    { type: 'stop_if_consecutive_losses', label: 'Stop on Streak Losses',   description: 'Halts after N consecutive losing trades.',            fields: [{ key: 'count',          label: 'Max consecutive losses', type: 'number', placeholder: '3' }] },
    { type: 'stop_if_position_size',      label: 'Max Position Size',       description: 'Prevents positions larger than limit.',              fields: [{ key: 'maxPositionUsdc', label: 'Max Position (USDC)',  type: 'number', placeholder: '500' }] },
    { type: 'stop_if_drawdown',           label: 'Max Drawdown',            description: 'Halts if drawdown exceeds percentage.',              fields: [{ key: 'maxDrawdownPct', label: 'Max Drawdown (%)',      type: 'number', placeholder: '10' }] },
    { type: 'max_daily_bets',             label: 'Max Daily Bets',          description: 'Limits the number of bets placed per day.',          fields: [{ key: 'count',          label: 'Max bets per day',       type: 'number', placeholder: '10' }] },
    { type: 'time_window',                label: 'Time Window',             description: 'Only trades within the specified hours (UTC).',      fields: [{ key: 'startHour', label: 'Start Hour (0-23)', type: 'number', placeholder: '9' }, { key: 'endHour', label: 'End Hour (0-23)', type: 'number', placeholder: '17' }] },
  ],
  triggers: [
    { type: 'price_crosses_up',   label: 'Price Crosses Up',    description: 'Fires when price crosses above threshold.',          fields: [{ key: 'tokenId', label: 'Token ID', type: 'text', placeholder: 'token-uuid' }, { key: 'threshold', label: 'Price Threshold', type: 'number', placeholder: '0.60' }] },
    { type: 'price_crosses_down', label: 'Price Crosses Down',  description: 'Fires when price crosses below threshold.',         fields: [{ key: 'tokenId', label: 'Token ID', type: 'text', placeholder: 'token-uuid' }, { key: 'threshold', label: 'Price Threshold', type: 'number', placeholder: '0.40' }] },
    { type: 'price_change_pct',   label: 'Price Change %',      description: 'Fires on price change over time window.',           fields: [{ key: 'tokenId', label: 'Token ID', type: 'text', placeholder: 'token-uuid' }, { key: 'pct', label: 'Change %', type: 'number', placeholder: '5' }, { key: 'windowMs', label: 'Window (ms)', type: 'number', placeholder: '60000' }] },
    { type: 'volume_spike',       label: 'Volume Spike',        description: 'Fires when volume multiplier exceeds threshold.',   fields: [{ key: 'tokenId', label: 'Token ID', type: 'text', placeholder: 'token-uuid' }, { key: 'multiplier', label: 'Multiplier', type: 'number', placeholder: '3' }] },
    { type: 'market_resolving',   label: 'Market Resolving',    description: 'Fires when market enters resolution window.',       fields: [] },
    { type: 'market_resolved',    label: 'Market Resolved',     description: 'Fires when market resolves.',                      fields: [] },
    { type: 'price_above',        label: 'Price Above',         description: 'True each tick when price is above threshold.',    fields: [{ key: 'tokenId', label: 'Token ID', type: 'text', placeholder: 'token-uuid' }, { key: 'threshold', label: 'Threshold', type: 'number', placeholder: '0.60' }] },
    { type: 'price_below',        label: 'Price Below',         description: 'True each tick when price is below threshold.',   fields: [{ key: 'tokenId', label: 'Token ID', type: 'text', placeholder: 'token-uuid' }, { key: 'threshold', label: 'Threshold', type: 'number', placeholder: '0.40' }] },
    { type: 'spread_below',       label: 'Spread Below',        description: 'True when spread is tight enough.',               fields: [{ key: 'tokenId', label: 'Token ID', type: 'text', placeholder: 'token-uuid' }, { key: 'maxSpread', label: 'Max Spread', type: 'number', placeholder: '0.05' }] },
    { type: 'liquidity_above',    label: 'Liquidity Above',     description: 'True when liquidity meets minimum.',              fields: [{ key: 'tokenId', label: 'Token ID', type: 'text', placeholder: 'token-uuid' }, { key: 'minLiquidity', label: 'Min Liquidity (USDC)', type: 'number', placeholder: '1000' }] },
    { type: 'position_open',      label: 'Position Open',       description: 'True when an open position exists.',             fields: [{ key: 'tokenId', label: 'Token ID', type: 'text', placeholder: 'token-uuid' }] },
    { type: 'no_position',        label: 'No Position',         description: 'True when no position is open.',                 fields: [{ key: 'tokenId', label: 'Token ID', type: 'text', placeholder: 'token-uuid' }] },
    { type: 'time_between',       label: 'Time Between',        description: 'True during specified hours (UTC).',             fields: [{ key: 'startHour', label: 'Start Hour', type: 'number', placeholder: '9' }, { key: 'endHour', label: 'End Hour', type: 'number', placeholder: '17' }] },
  ],
  conditions: [
    { type: 'min_liquidity',     label: 'Min Liquidity',     description: 'Requires minimum market liquidity.',            fields: [{ key: 'minUsdc',        label: 'Min USDC',        type: 'number', placeholder: '100' }] },
    { type: 'max_spread',        label: 'Max Spread',        description: 'Requires spread below maximum.',               fields: [{ key: 'maxSpread',       label: 'Max Spread',      type: 'number', placeholder: '0.04' }] },
    { type: 'min_price',         label: 'Min Price',         description: 'Token price must be above minimum.',           fields: [{ key: 'tokenId', label: 'Token ID', type: 'text', placeholder: 'token-uuid' }, { key: 'minPrice', label: 'Min Price', type: 'number', placeholder: '0.10' }] },
    { type: 'max_price',         label: 'Max Price',         description: 'Token price must be below maximum.',           fields: [{ key: 'tokenId', label: 'Token ID', type: 'text', placeholder: 'token-uuid' }, { key: 'maxPrice', label: 'Max Price', type: 'number', placeholder: '0.90' }] },
    { type: 'no_recent_bet',     label: 'No Recent Bet',     description: 'No bet placed in the last N ms.',              fields: [{ key: 'windowMs',       label: 'Window (ms)',     type: 'number', placeholder: '300000' }] },
    { type: 'daily_loss_below',  label: 'Daily Loss Below',  description: 'Daily loss must not exceed threshold.',        fields: [{ key: 'maxLossUsdc',    label: 'Max Loss (USDC)', type: 'number', placeholder: '100' }] },
    { type: 'position_size_below', label: 'Position Size Below', description: 'Open position must be below limit.',      fields: [{ key: 'maxUsdc',        label: 'Max USDC',        type: 'number', placeholder: '500' }] },
    { type: 'market_open',       label: 'Market Open',       description: 'Market must be accepting orders.',            fields: [] },
    { type: 'time_in_window',    label: 'Time in Window',    description: 'Current time must be within hours (UTC).',   fields: [{ key: 'startHour', label: 'Start Hour', type: 'number', placeholder: '9' }, { key: 'endHour', label: 'End Hour', type: 'number', placeholder: '17' }] },
  ],
  actions: [
    { type: 'buy_yes',         label: 'Buy YES',         description: 'Buy YES tokens for the specified amount.',    fields: [{ key: 'tokenId', label: 'Token ID', type: 'text', placeholder: 'token-uuid' }, { key: 'size', label: 'Size (USDC)', type: 'number', placeholder: '50' }] },
    { type: 'buy_no',          label: 'Buy NO',          description: 'Buy NO tokens for the specified amount.',     fields: [{ key: 'tokenId', label: 'Token ID', type: 'text', placeholder: 'token-uuid' }, { key: 'size', label: 'Size (USDC)', type: 'number', placeholder: '50' }] },
    { type: 'sell_yes',        label: 'Sell YES',        description: 'Sell YES tokens for the specified amount.',   fields: [{ key: 'tokenId', label: 'Token ID', type: 'text', placeholder: 'token-uuid' }, { key: 'size', label: 'Size (USDC)', type: 'number', placeholder: '50' }] },
    { type: 'sell_no',         label: 'Sell NO',         description: 'Sell NO tokens for the specified amount.',    fields: [{ key: 'tokenId', label: 'Token ID', type: 'text', placeholder: 'token-uuid' }, { key: 'size', label: 'Size (USDC)', type: 'number', placeholder: '50' }] },
    { type: 'close_position',  label: 'Close Position',  description: 'Fully close the position (FOK SELL).',       fields: [{ key: 'tokenId', label: 'Token ID', type: 'text', placeholder: 'token-uuid' }] },
    { type: 'set_stop_loss',   label: 'Set Stop Loss',   description: 'Close position if loss exceeds percentage.', fields: [{ key: 'pct', label: 'Stop Loss (%)', type: 'number', placeholder: '10' }] },
    { type: 'set_take_profit', label: 'Set Take Profit', description: 'Close position if profit reaches percentage.', fields: [{ key: 'pct', label: 'Take Profit (%)', type: 'number', placeholder: '20' }] },
    { type: 'notify',          label: 'Notify',          description: 'Send a notification when this action fires.', fields: [{ key: 'message', label: 'Message', type: 'text', placeholder: 'Alert triggered' }] },
  ],
};

// ─── Section column layout constants ────────────────────────────────────────

const SECTION_COLUMNS: Record<BlockSection, number> = {
  safety: 80,
  triggers: 420,
  conditions: 760,
  actions: 1100,
};

// ─── Component ──────────────────────────────────────────────────────────────

interface FormState {
  name:        string;
  description: string;
  visibility:  StrategyVisibility;
  execMode:    ExecMode;
  tickMs:      number;
  tagsInput:   string;
}

@Component({
  selector: 'app-strategy-builder',
  standalone: true,
  imports: [RouterLink, FormsModule, DecimalPipe, ButtonModule, InputTextModule, TextareaModule, SelectModule, ToastModule, TooltipModule],
  providers: [MessageService],
  templateUrl: './strategy-builder.component.html',
})
export class StrategyBuilderComponent implements OnInit {
  private readonly route      = inject(ActivatedRoute);
  private readonly router     = inject(Router);
  private readonly api        = inject(StrategiesApiService);
  private readonly toast      = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);

  isEdit      = signal(false);
  editId      = signal<string | null>(null);
  loading     = signal(false);
  saving      = signal(false);

  activeSection = signal<BlockSection>('safety');
  paletteOpen   = signal(false);

  form = signal<FormState>({
    name:        '',
    description: '',
    visibility:  'PRIVATE',
    execMode:    'TICK',
    tickMs:      1000,
    tagsInput:   '',
  });

  // ─── Canvas state ───────────────────────────────────────────────────────

  canvasBlocks = signal<CanvasBlock[]>([]);

  viewBox = signal({ x: 0, y: 0, w: 1400, h: 900 });
  scale = signal(1);
  draggingBlock: CanvasBlock | null = null;
  dragOffset = { x: 0, y: 0 };
  isPanning = false;
  panStart = { x: 0, y: 0 };

  // ─── Computed ───────────────────────────────────────────────────────────

  readonly viewBoxStr = computed(() => {
    const vb = this.viewBox();
    return `${vb.x} ${vb.y} ${vb.w} ${vb.h}`;
  });

  readonly connectionPaths = computed(() => {
    const blocks = this.canvasBlocks();
    if (blocks.length === 0) return [];

    const sectionOrder: BlockSection[] = ['safety', 'triggers', 'conditions', 'actions'];
    const paths: string[] = [];

    for (let i = 0; i < sectionOrder.length - 1; i++) {
      const fromSection = sectionOrder[i];
      const toSection = sectionOrder[i + 1];
      const fromBlocks = blocks.filter(b => b.section === fromSection);
      const toBlocks = blocks.filter(b => b.section === toSection);

      if (fromBlocks.length === 0 || toBlocks.length === 0) continue;

      for (const fb of fromBlocks) {
        for (const tb of toBlocks) {
          const x1 = fb.x + 280; // right edge of from block
          const y1 = fb.y + 100; // vertical center
          const x2 = tb.x;       // left edge of to block
          const y2 = tb.y + 100; // vertical center
          const cx = (x1 + x2) / 2;
          paths.push(`M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`);
        }
      }
    }
    return paths;
  });

  // Palette: all block defs for the active section
  readonly paletteDefs = computed(() => BLOCK_DEFS[this.activeSection()]);

  readonly sections: { key: BlockSection; label: string; icon: string; color: string }[] = [
    { key: 'safety',     label: 'Safety',     icon: 'pi-shield',      color: '#EF4444' },
    { key: 'triggers',   label: 'Triggers',   icon: 'pi-bolt',        color: '#F59E0B' },
    { key: 'conditions', label: 'Conditions', icon: 'pi-filter',      color: '#3B82F6' },
    { key: 'actions',    label: 'Actions',    icon: 'pi-play-circle', color: '#22C55E' },
  ];

  readonly execModeOptions = [
    { label: 'Tick — evaluate on timer',  value: 'TICK' },
    { label: 'Event — evaluate on price change', value: 'EVENT' },
    { label: 'Hybrid — both timer and price change', value: 'HYBRID' },
  ];

  readonly visibilityOptions = [
    { label: 'Private',  value: 'PRIVATE' },
    { label: 'Unlisted', value: 'UNLISTED' },
    { label: 'Public',   value: 'PUBLIC' },
  ];

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEdit.set(true);
      this.editId.set(id);
      this.loading.set(true);
      this.api.get(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: s => { this.populateFromStrategy(s); this.loading.set(false); },
        error: () => { this.loading.set(false); this.router.navigate(['/strategies']); },
      });
    }
  }

  // ─── Canvas methods ─────────────────────────────────────────────────────

  startBlockDrag(event: MouseEvent, block: CanvasBlock): void {
    event.preventDefault();
    event.stopPropagation();
    this.draggingBlock = block;
    const svg = (event.target as Element).closest('svg');
    if (!svg) return;
    const pt = this.svgPoint(svg as SVGSVGElement, event);
    this.dragOffset = { x: pt.x - block.x, y: pt.y - block.y };
  }

  onCanvasMouseMove(event: MouseEvent): void {
    if (this.draggingBlock) {
      const svg = (event.target as Element).closest('.strategy-canvas-container')?.querySelector('svg');
      if (!svg) return;
      const pt = this.svgPoint(svg as SVGSVGElement, event);
      const block = this.draggingBlock;
      const newX = pt.x - this.dragOffset.x;
      const newY = pt.y - this.dragOffset.y;
      this.canvasBlocks.update(blocks =>
        blocks.map(b => b.id === block.id ? { ...b, x: newX, y: newY } : b)
      );
    } else if (this.isPanning) {
      const vb = this.viewBox();
      const dx = (event.movementX * -1) * (vb.w / window.innerWidth);
      const dy = (event.movementY * -1) * (vb.h / window.innerHeight);
      this.viewBox.set({ ...vb, x: vb.x + dx, y: vb.y + dy });
    }
  }

  endDrag(): void {
    this.draggingBlock = null;
    this.isPanning = false;
  }

  startPan(event: MouseEvent): void {
    // Only pan when clicking on empty SVG area (not on a block)
    if ((event.target as Element).closest('.canvas-block')) return;
    event.preventDefault();
    this.isPanning = true;
    this.panStart = { x: event.clientX, y: event.clientY };
  }

  zoomIn(): void {
    const vb = this.viewBox();
    const newW = vb.w * 0.9;
    const newH = vb.h * 0.9;
    const dx = (newW - vb.w) / 2;
    const dy = (newH - vb.h) / 2;
    this.viewBox.set({ x: vb.x - dx, y: vb.y - dy, w: newW, h: newH });
    this.scale.set(1400 / newW);
  }

  zoomOut(): void {
    const vb = this.viewBox();
    const newW = vb.w * 1.1;
    const newH = vb.h * 1.1;
    const dx = (newW - vb.w) / 2;
    const dy = (newH - vb.h) / 2;
    this.viewBox.set({ x: vb.x - dx, y: vb.y - dy, w: newW, h: newH });
    this.scale.set(1400 / newW);
  }

  onWheel(event: WheelEvent): void {
    event.preventDefault?.();
    const vb = this.viewBox();
    const zoomFactor = event.deltaY > 0 ? 1.1 : 0.9;
    const newW = vb.w * zoomFactor;
    const newH = vb.h * zoomFactor;
    // Zoom towards center
    const dx = (newW - vb.w) / 2;
    const dy = (newH - vb.h) / 2;
    this.viewBox.set({ x: vb.x - dx, y: vb.y - dy, w: newW, h: newH });
    this.scale.set(1400 / newW);
  }

  fitToView(): void {
    const blocks = this.canvasBlocks();
    if (blocks.length === 0) {
      this.viewBox.set({ x: 0, y: 0, w: 1400, h: 900 });
      this.scale.set(1);
      return;
    }
    const minX = Math.min(...blocks.map(b => b.x));
    const minY = Math.min(...blocks.map(b => b.y));
    const maxX = Math.max(...blocks.map(b => b.x + 280));
    const maxY = Math.max(...blocks.map(b => b.y + 200));
    const padding = 80;
    const w = maxX - minX + padding * 2;
    const h = maxY - minY + padding * 2;
    this.viewBox.set({ x: minX - padding, y: minY - padding, w, h });
    this.scale.set(1400 / w);
  }

  autoLayout(): void {
    const sectionOrder: BlockSection[] = ['safety', 'triggers', 'conditions', 'actions'];
    const sectionIndices: Record<string, number> = {};
    sectionOrder.forEach(s => sectionIndices[s] = 0);

    this.canvasBlocks.update(blocks =>
      blocks.map(b => {
        const x = SECTION_COLUMNS[b.section];
        const y = 80 + (sectionIndices[b.section]! * 220);
        sectionIndices[b.section]!++;
        return { ...b, x, y };
      })
    );
  }

  addBlockToCanvas(def: BlockDef, section: BlockSection): void {
    const existingInSection = this.canvasBlocks().filter(b => b.section === section);
    const x = SECTION_COLUMNS[section];
    const y = 80 + existingInSection.length * 220;

    const block: CanvasBlock = {
      id: crypto.randomUUID(),
      type: def.type,
      section,
      config: Object.fromEntries(def.fields.map(f => [f.key, ''])),
      x,
      y,
    };
    this.canvasBlocks.update(blocks => [...blocks, block]);
    this.paletteOpen.set(false);
  }

  removeCanvasBlock(id: string): void {
    this.canvasBlocks.update(blocks => blocks.filter(b => b.id !== id));
  }

  updateBlockConfig(blockId: string, key: string, value: any): void {
    this.canvasBlocks.update(blocks =>
      blocks.map(b => b.id === blockId ? { ...b, config: { ...b.config, [key]: value } } : b)
    );
  }

  getBlockDef(type: string): BlockDef | undefined {
    for (const section of Object.values(BLOCK_DEFS)) {
      const found = section.find(d => d.type === type);
      if (found) return found;
    }
    return undefined;
  }

  sectionColor(section: string): string {
    const colors: Record<string, string> = {
      safety: '#EF4444',
      triggers: '#F59E0B',
      conditions: '#3B82F6',
      actions: '#22C55E',
    };
    return colors[section] ?? '#6B7280';
  }

  sectionCount(section: BlockSection): number {
    return this.canvasBlocks().filter(b => b.section === section).length;
  }

  // ─── Palette / section helpers ──────────────────────────────────────────

  setSection(s: BlockSection): void {
    this.activeSection.set(s);
    this.paletteOpen.set(false);
  }

  togglePalette(): void {
    this.paletteOpen.update(v => !v);
  }

  addBlock(def: BlockDef): void {
    this.addBlockToCanvas(def, this.activeSection());
  }

  // ─── Form helpers ───────────────────────────────────────────────────────

  updateForm(key: keyof FormState, value: string | number): void {
    this.form.update(f => ({ ...f, [key]: value }));
  }

  // ─── Populate from strategy (edit mode) ─────────────────────────────────

  private populateFromStrategy(s: Strategy): void {
    this.form.set({
      name:        s.name,
      description: s.description,
      visibility:  s.visibility,
      execMode:    s.execMode,
      tickMs:      s.tickMs,
      tagsInput:   s.tags.join(', '),
    });

    const blocks: CanvasBlock[] = [];
    const sectionOrder: BlockSection[] = ['safety', 'triggers', 'conditions', 'actions'];

    for (const section of sectionOrder) {
      const items = s[section] as { type: string; config: Record<string, any> }[];
      items.forEach((b, i) => {
        blocks.push({
          id: crypto.randomUUID(),
          type: b.type,
          section,
          config: { ...b.config },
          x: SECTION_COLUMNS[section],
          y: 80 + i * 220,
        });
      });
    }

    this.canvasBlocks.set(blocks);
  }

  // ─── Save ───────────────────────────────────────────────────────────────

  save(): void {
    const f = this.form();
    if (!f.name.trim()) {
      this.toast.add({ severity: 'warn', summary: 'Name required', life: 3000 });
      return;
    }

    const blocks = this.canvasBlocks();
    const safety     = blocks.filter(b => b.section === 'safety').map(b => ({ type: b.type, config: b.config }));
    const triggers   = blocks.filter(b => b.section === 'triggers').map(b => ({ type: b.type, config: b.config }));
    const conditions = blocks.filter(b => b.section === 'conditions').map(b => ({ type: b.type, config: b.config }));
    const actions    = blocks.filter(b => b.section === 'actions').map(b => ({ type: b.type, config: b.config }));

    const dto: CreateStrategyDto = {
      name:        f.name.trim(),
      description: f.description.trim(),
      visibility:  f.visibility,
      execMode:    f.execMode,
      tickMs:      Number(f.tickMs),
      safety,
      triggers,
      conditions,
      actions,
      tags:        f.tagsInput.split(',').map(t => t.trim()).filter(Boolean),
    };

    this.saving.set(true);
    const req = this.isEdit()
      ? this.api.update(this.editId()!, dto)
      : this.api.create(dto);

    req.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next:  s  => { this.saving.set(false); this.router.navigate(['/strategies', s.id]); },
      error: err => {
        this.saving.set(false);
        this.toast.add({ severity: 'error', summary: 'Save failed', detail: err?.error?.message ?? 'Unknown error', life: 4000 });
      },
    });
  }

  // ─── SVG coordinate helper ──────────────────────────────────────────────

  private svgPoint(svg: SVGSVGElement, event: MouseEvent): { x: number; y: number } {
    const pt = svg.createSVGPoint();
    pt.x = event.clientX;
    pt.y = event.clientY;
    const ctm = svg.getScreenCTM();
    if (ctm) {
      const transformed = pt.matrixTransform(ctm.inverse());
      return { x: transformed.x, y: transformed.y };
    }
    // Fallback: manual calculation
    const rect = svg.getBoundingClientRect();
    const vb = this.viewBox();
    return {
      x: vb.x + (event.clientX - rect.left) / rect.width * vb.w,
      y: vb.y + (event.clientY - rect.top) / rect.height * vb.h,
    };
  }
}
