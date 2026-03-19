import { Component, OnInit, inject, signal, computed, DestroyRef } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { SelectModule } from 'primeng/select';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
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

// ─── Component ──────────────────────────────────────────────────────────────

interface FormState {
  name:        string;
  description: string;
  visibility:  StrategyVisibility;
  execMode:    ExecMode;
  tickMs:      number;
  tagsInput:   string;
}

interface BlocksState {
  safety:     BlockInstance[];
  triggers:   BlockInstance[];
  conditions: BlockInstance[];
  actions:    BlockInstance[];
}

@Component({
  selector: 'app-strategy-builder',
  standalone: true,
  imports: [RouterLink, FormsModule, ButtonModule, InputTextModule, TextareaModule, SelectModule, ToastModule, TooltipModule, DragDropModule],
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

  blocks = signal<BlocksState>({ safety: [], triggers: [], conditions: [], actions: [] });

  // Palette: all block defs for the active section
  readonly paletteDefs = computed(() => BLOCK_DEFS[this.activeSection()]);

  readonly sections: { key: BlockSection; label: string; icon: string }[] = [
    { key: 'safety',     label: 'Safety',     icon: 'pi-shield' },
    { key: 'triggers',   label: 'Triggers',   icon: 'pi-bolt' },
    { key: 'conditions', label: 'Conditions', icon: 'pi-filter' },
    { key: 'actions',    label: 'Actions',    icon: 'pi-play-circle' },
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

  private populateFromStrategy(s: Strategy): void {
    this.form.set({
      name:        s.name,
      description: s.description,
      visibility:  s.visibility,
      execMode:    s.execMode,
      tickMs:      s.tickMs,
      tagsInput:   s.tags.join(', '),
    });
    this.blocks.set({
      safety:     s.safety.map(b     => ({ id: crypto.randomUUID(), type: b.type, config: { ...b.config } })),
      triggers:   s.triggers.map(b   => ({ id: crypto.randomUUID(), type: b.type, config: { ...b.config } })),
      conditions: s.conditions.map(b => ({ id: crypto.randomUUID(), type: b.type, config: { ...b.config } })),
      actions:    s.actions.map(b    => ({ id: crypto.randomUUID(), type: b.type, config: { ...b.config } })),
    });
  }

  setSection(s: BlockSection): void {
    this.activeSection.set(s);
    this.paletteOpen.set(false);
  }

  togglePalette(): void {
    this.paletteOpen.update(v => !v);
  }

  addBlock(def: BlockDef): void {
    const instance: BlockInstance = {
      id:     crypto.randomUUID(),
      type:   def.type,
      config: Object.fromEntries(def.fields.map(f => [f.key, ''])),
    };
    const section = this.activeSection();
    this.blocks.update(b => ({ ...b, [section]: [...b[section], instance] }));
    this.paletteOpen.set(false);
  }

  removeBlock(section: BlockSection, id: string): void {
    this.blocks.update(b => ({ ...b, [section]: b[section].filter(bl => bl.id !== id) }));
  }

  moveBlock(section: BlockSection, id: string, dir: -1 | 1): void {
    this.blocks.update(b => {
      const list = [...b[section]];
      const idx  = list.findIndex(bl => bl.id === id);
      if (idx === -1) return b;
      const to = idx + dir;
      if (to < 0 || to >= list.length) return b;
      [list[idx], list[to]] = [list[to], list[idx]];
      return { ...b, [section]: list };
    });
  }

  dropBlock(event: CdkDragDrop<BlockInstance[]>): void {
    const section = this.activeSection();
    this.blocks.update(b => {
      const list = [...b[section]];
      moveItemInArray(list, event.previousIndex, event.currentIndex);
      return { ...b, [section]: list };
    });
  }

  updateBlockConfig(section: BlockSection, id: string, key: string, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.blocks.update(b => ({
      ...b,
      [section]: b[section].map(bl => bl.id === id ? { ...bl, config: { ...bl.config, [key]: value } } : bl),
    }));
  }

  updateForm(key: keyof FormState, value: string | number): void {
    this.form.update(f => ({ ...f, [key]: value }));
  }

  getBlockDef(type: string): BlockDef | undefined {
    for (const section of Object.values(BLOCK_DEFS)) {
      const found = section.find(d => d.type === type);
      if (found) return found;
    }
    return undefined;
  }

  sectionCount(section: BlockSection): number {
    return this.blocks()[section].length;
  }

  save(): void {
    const f = this.form();
    if (!f.name.trim()) {
      this.toast.add({ severity: 'warn', summary: 'Name required', life: 3000 });
      return;
    }
    const b = this.blocks();
    const dto: CreateStrategyDto = {
      name:        f.name.trim(),
      description: f.description.trim(),
      visibility:  f.visibility,
      execMode:    f.execMode,
      tickMs:      Number(f.tickMs),
      safety:     b.safety.map(bl     => ({ type: bl.type, config: bl.config })),
      triggers:   b.triggers.map(bl   => ({ type: bl.type, config: bl.config })),
      conditions: b.conditions.map(bl => ({ type: bl.type, config: bl.config })),
      actions:    b.actions.map(bl    => ({ type: bl.type, config: bl.config })),
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
}
