import { Component, OnInit, inject, signal, computed, DestroyRef, ViewChild, ElementRef, HostListener } from '@angular/core';
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

export interface Connection {
  id: string;
  fromBlockId: string;
  toBlockId: string;
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

  activeSection   = signal<BlockSection>('safety');
  panelOpen       = signal(true);
  isDraggingOver  = signal(false);

  private draggingDef: BlockDef | null = null;
  private draggingSection: BlockSection | null = null;

  @ViewChild('canvasSvg', { static: false }) canvasSvgRef!: ElementRef<SVGSVGElement>;

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
  connections = signal<Connection[]>([]);
  drawingWire = signal<{ fromBlockId: string; fromX: number; fromY: number; mouseX: number; mouseY: number } | null>(null);
  selectedConnectionId = signal<string | null>(null);

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

  readonly renderConnections = computed(() => {
    const blocks = this.canvasBlocks();
    const conns = this.connections();
    const blockMap = new Map(blocks.map(b => [b.id, b]));

    if (conns.length > 0) {
      // Explicit connections
      return conns.map(conn => {
        const from = blockMap.get(conn.fromBlockId);
        const to = blockMap.get(conn.toBlockId);
        if (!from || !to) return { id: conn.id, path: '' };
        const x1 = from.x + 280, y1 = from.y + 100;
        const x2 = to.x, y2 = to.y + 100;
        const cx = (x1 + x2) / 2;
        return { id: conn.id, path: `M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}` };
      }).filter(c => c.path);
    }

    // Auto-wire fallback (existing logic)
    if (blocks.length === 0) return [];
    const sectionOrder = ['safety', 'triggers', 'conditions', 'actions'] as const;
    const results: { id: string; path: string }[] = [];
    for (let i = 0; i < sectionOrder.length - 1; i++) {
      const fromBlocks = blocks.filter(b => b.section === sectionOrder[i]);
      const toBlocks = blocks.filter(b => b.section === sectionOrder[i + 1]);
      for (const fb of fromBlocks) {
        for (const tb of toBlocks) {
          const x1 = fb.x + 280, y1 = fb.y + 100;
          const x2 = tb.x, y2 = tb.y + 100;
          const cx = (x1 + x2) / 2;
          results.push({ id: `auto-${fb.id}-${tb.id}`, path: `M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}` });
        }
      }
    }
    return results;
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
    if (this.drawingWire()) {
      const svg = this.canvasSvgRef?.nativeElement;
      if (!svg) return;
      const pt = this.svgPoint(svg, event);
      this.drawingWire.update(w => w ? { ...w, mouseX: pt.x, mouseY: pt.y } : null);
    }

    if (this.draggingBlock) {
      const svg = this.canvasSvgRef?.nativeElement;
      if (!svg) return;
      const pt = this.svgPoint(svg, event);
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

  @HostListener('document:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    if ((event.key === 'Delete' || event.key === 'Backspace') && this.selectedConnectionId()) {
      // Don't delete connections when typing in an input
      const tag = (event.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;
      this.connections.update(conns => conns.filter(c => c.id !== this.selectedConnectionId()));
      this.selectedConnectionId.set(null);
    }
  }

  @HostListener('document:mousemove', ['$event'])
  onDocumentMouseMove(event: MouseEvent): void {
    if (this.draggingBlock) {
      this.onCanvasMouseMove(event);
    }
  }

  @HostListener('document:mouseup')
  onDocumentMouseUp(): void {
    if (this.draggingBlock || this.isPanning) {
      this.endDrag();
    }
  }

  endDrag(): void {
    this.draggingBlock = null;
    this.isPanning = false;
    if (this.drawingWire()) this.cancelWire();
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

  addBlockToCanvas(def: BlockDef, section: BlockSection, atX?: number, atY?: number): void {
    const existingInSection = this.canvasBlocks().filter(b => b.section === section);
    const x = atX ?? SECTION_COLUMNS[section];
    const y = atY ?? (80 + existingInSection.length * 220);

    const block: CanvasBlock = {
      id: crypto.randomUUID(),
      type: def.type,
      section,
      config: Object.fromEntries(def.fields.map(f => [f.key, ''])),
      x,
      y,
    };
    this.canvasBlocks.update(blocks => [...blocks, block]);
  }

  // ─── Wire drawing methods ───────────────────────────────────────────

  startWire(event: MouseEvent, block: CanvasBlock): void {
    event.preventDefault();
    event.stopPropagation();
    this.drawingWire.set({
      fromBlockId: block.id,
      fromX: block.x + 280,
      fromY: block.y + 100,
      mouseX: block.x + 280,
      mouseY: block.y + 100,
    });
  }

  finishWire(event: MouseEvent, targetBlock: CanvasBlock): void {
    event.preventDefault();
    event.stopPropagation();
    const wire = this.drawingWire();
    if (!wire) return;

    // No self-connections
    if (wire.fromBlockId === targetBlock.id) { this.drawingWire.set(null); return; }
    // No duplicate connections
    const exists = this.connections().some(c =>
      c.fromBlockId === wire.fromBlockId && c.toBlockId === targetBlock.id
    );
    if (exists) { this.drawingWire.set(null); return; }

    // Create connection
    this.connections.update(conns => [...conns, {
      id: crypto.randomUUID(),
      fromBlockId: wire.fromBlockId,
      toBlockId: targetBlock.id,
    }]);
    this.drawingWire.set(null);
  }

  cancelWire(): void {
    this.drawingWire.set(null);
  }

  selectConnection(event: MouseEvent, id: string): void {
    event.stopPropagation();
    this.selectedConnectionId.set(this.selectedConnectionId() === id ? null : id);
  }

  tempWirePath(): string {
    const w = this.drawingWire();
    if (!w) return '';
    const cx = (w.fromX + w.mouseX) / 2;
    return `M ${w.fromX} ${w.fromY} C ${cx} ${w.fromY}, ${cx} ${w.mouseY}, ${w.mouseX} ${w.mouseY}`;
  }

  removeCanvasBlock(id: string): void {
    this.canvasBlocks.update(blocks => blocks.filter(b => b.id !== id));
    this.connections.update(conns => conns.filter(c => c.fromBlockId !== id && c.toBlockId !== id));
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
  }

  addBlock(def: BlockDef): void {
    this.addBlockToCanvas(def, this.activeSection());
  }

  // ─── Drag & drop from panel to canvas ─────────────────────────────────

  onBlockDragStart(event: DragEvent, def: BlockDef): void {
    this.draggingDef = def;
    this.draggingSection = this.activeSection();
    event.dataTransfer?.setData('text/plain', def.type);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'copy';
    }
  }

  onBlockDragEnd(): void {
    this.draggingDef = null;
    this.draggingSection = null;
    this.isDraggingOver.set(false);
  }

  onCanvasDragOver(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
    this.isDraggingOver.set(true);
  }

  onCanvasDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDraggingOver.set(false);

    if (!this.draggingDef || !this.draggingSection) return;

    // Convert screen coords to SVG coords
    const svg = this.canvasSvgRef?.nativeElement;
    if (svg) {
      const pt = this.svgPoint(svg, event as unknown as MouseEvent);
      this.addBlockToCanvas(this.draggingDef, this.draggingSection, pt.x - 140, pt.y - 100);
    } else {
      this.addBlockToCanvas(this.draggingDef, this.draggingSection);
    }

    this.draggingDef = null;
    this.draggingSection = null;
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

    const canvasLayout = s.canvas as any;
    const storedPositions = canvasLayout?.positions || {};

    for (const section of sectionOrder) {
      const items = s[section] as { id?: string; type: string; config: Record<string, any> }[];
      items.forEach((b, i) => {
        const blockId = b.id || crypto.randomUUID();
        const storedPos = storedPositions[blockId];
        blocks.push({
          id: blockId,
          type: b.type,
          section,
          config: { ...b.config },
          x: storedPos?.x ?? SECTION_COLUMNS[section],
          y: storedPos?.y ?? (80 + i * 220),
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
    const safety     = blocks.filter(b => b.section === 'safety').map(b => ({ id: b.id, type: b.type, config: b.config }));
    const triggers   = blocks.filter(b => b.section === 'triggers').map(b => ({ id: b.id, type: b.type, config: b.config }));
    const conditions = blocks.filter(b => b.section === 'conditions').map(b => ({ id: b.id, type: b.type, config: b.config }));
    const actions    = blocks.filter(b => b.section === 'actions').map(b => ({ id: b.id, type: b.type, config: b.config }));

    // Build canvas layout from current block positions
    const positions: Record<string, { x: number; y: number }> = {};
    for (const b of blocks) {
      positions[b.id] = { x: b.x, y: b.y };
    }
    const canvas = { positions };

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
      canvas,
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
