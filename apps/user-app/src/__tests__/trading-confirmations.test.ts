/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

function source(path: string): string {
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
  return readFileSync(join(repoRoot, path), 'utf8');
}

function expectConfirmDialogImport(src: string, file: string): void {
  expect(
    src,
    `${file} should use the shared ConfirmDialog primitive`,
  ).toContain("import { ConfirmDialog } from '@/components/ui/confirm-dialog';");
}

describe('trading safety confirmations', () => {
  it('gates live order placement behind the shared delayed danger confirmation', () => {
    const file = 'apps/user-app/src/pages/markets/market-detail.tsx';
    const src = source(file);

    expectConfirmDialogImport(src, file);
    expect(src).toContain('openPlaceOrderConfirmation');
    expect(src).toContain('setPendingPlaceOrderConfirm(true)');
    expect(src).toContain('delayMs={2000}');
    expect(src).toContain('tone="danger"');
    expect(src).toContain('confirmLabel="Place live order"');
    expect(src).toContain('onClick={openPlaceOrderConfirmation}');
    expect(src).not.toContain('onClick={placeOrder}');
  });

  it('requires confirmation before cancelling market-detail open orders', () => {
    const file = 'apps/user-app/src/pages/markets/market-detail.tsx';
    const src = source(file);

    expect(src).toContain('openCancelOrderConfirmation');
    expect(src).toContain('confirmLabel="Cancel order"');
    expect(src).toContain('onClick={() => openCancelOrderConfirmation(order.id)}');
    expect(src).not.toContain('onClick={() => cancelMyOrder(order.id)}');
  });

  it('requires confirmation before cancelling orders-page regular and conditional orders', () => {
    const file = 'apps/user-app/src/pages/orders/orders.tsx';
    const src = source(file);

    expectConfirmDialogImport(src, file);
    expect(src).toContain('openCancelOrderConfirmation');
    expect(src).toContain('openCancelConditionalConfirmation');
    expect(src).toContain('onClick={() => openCancelOrderConfirmation(order.id)}');
    expect(src).toContain('onClick={() => openCancelConditionalConfirmation(co.id)}');
    expect(src).not.toContain('onClick={() => cancelOrder(order.id)}');
    expect(src).not.toContain('onClick={() => cancelConditional(co.id)}');
  });

  it('gates live strategy execution behind the shared delayed danger confirmation', () => {
    const file = 'apps/user-app/src/components/builder/execution-panel.tsx';
    const src = source(file);

    expect(src).toContain("import { ConfirmDialog } from '../ui/confirm-dialog';");
    expect(src).toContain('openStartLiveConfirmation');
    expect(src).toContain("setPendingStartLiveMode('LIVE')");
    expect(src).toContain('onStart={openStartLiveConfirmation}');
    expect(src).toContain('title="Start live strategy?"');
    expect(src).toContain('confirmLabel="Start live strategy"');
    expect(src).toContain('delayMs={2000}');
    expect(src).toContain('tone="danger"');
    expect(src).not.toContain('onStart={startLive}');
  });
});
