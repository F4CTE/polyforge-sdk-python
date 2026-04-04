import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useBuilderStore } from './builder-store';
import { isValidVariableName } from '../components/builder/nodes/variable-node';
import { BLOCK_DEFS } from '../components/builder/block-definitions';

// Reset the store between tests
beforeEach(() => {
  useBuilderStore.getState().reset();
});

// ─── Variable name validation ───────────────────────────────────────────────

describe('isValidVariableName', () => {
  it('accepts alphanumeric names with underscores', () => {
    expect(isValidVariableName('var1')).toBe(true);
    expect(isValidVariableName('my_var')).toBe(true);
    expect(isValidVariableName('_private')).toBe(true);
    expect(isValidVariableName('camelCase')).toBe(true);
    expect(isValidVariableName('ABC_123')).toBe(true);
  });

  it('rejects names starting with a digit', () => {
    expect(isValidVariableName('1var')).toBe(false);
    expect(isValidVariableName('123')).toBe(false);
  });

  it('rejects names with special characters', () => {
    expect(isValidVariableName('my-var')).toBe(false);
    expect(isValidVariableName('my var')).toBe(false);
    expect(isValidVariableName('var!')).toBe(false);
    expect(isValidVariableName('a.b')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isValidVariableName('')).toBe(false);
  });
});

// ─── addVariable ────────────────────────────────────────────────────────────

describe('addVariable', () => {
  it('creates a variable node with correct type and default name', () => {
    useBuilderStore.getState().addVariable();
    const nodes = useBuilderStore.getState().nodes;

    expect(nodes).toHaveLength(1);
    expect(nodes[0].type).toBe('variableNode');
    expect(nodes[0].data.variableName).toBe('var1');
    expect(nodes[0].data.expression).toBe('');
  });

  it('increments default name for subsequent variables', () => {
    const { addVariable } = useBuilderStore.getState();
    addVariable();
    addVariable();
    addVariable();

    const nodes = useBuilderStore.getState().nodes;
    expect(nodes).toHaveLength(3);
    expect(nodes[0].data.variableName).toBe('var1');
    expect(nodes[1].data.variableName).toBe('var2');
    expect(nodes[2].data.variableName).toBe('var3');
  });

  it('positions variable nodes in the variable column (x=0)', () => {
    useBuilderStore.getState().addVariable();
    const node = useBuilderStore.getState().nodes[0];
    expect(node.position.x).toBe(0);
  });

  it('sets dirty flag', () => {
    expect(useBuilderStore.getState().dirty).toBe(false);
    useBuilderStore.getState().addVariable();
    expect(useBuilderStore.getState().dirty).toBe(true);
  });
});

// ─── updateVariable ─────────────────────────────────────────────────────────

describe('updateVariable', () => {
  it('updates the variable name on the correct node', () => {
    useBuilderStore.getState().addVariable();
    const nodeId = useBuilderStore.getState().nodes[0].id;

    useBuilderStore.getState().updateVariable(nodeId, 'variableName', 'myPrice');

    const updated = useBuilderStore.getState().nodes.find((n) => n.id === nodeId);
    expect(updated?.data.variableName).toBe('myPrice');
  });

  it('updates the expression on the correct node', () => {
    useBuilderStore.getState().addVariable();
    const nodeId = useBuilderStore.getState().nodes[0].id;

    useBuilderStore.getState().updateVariable(nodeId, 'expression', 'price * 0.95');

    const updated = useBuilderStore.getState().nodes.find((n) => n.id === nodeId);
    expect(updated?.data.expression).toBe('price * 0.95');
  });

  it('does not affect other nodes', () => {
    const store = useBuilderStore.getState();
    store.addVariable();
    store.addVariable();
    const nodes = useBuilderStore.getState().nodes;
    const firstId = nodes[0].id;
    const secondId = nodes[1].id;

    useBuilderStore.getState().updateVariable(firstId, 'variableName', 'alpha');

    const result = useBuilderStore.getState().nodes;
    expect(result.find((n) => n.id === firstId)?.data.variableName).toBe('alpha');
    expect(result.find((n) => n.id === secondId)?.data.variableName).toBe('var2');
  });
});

// ─── removeVariable ─────────────────────────────────────────────────────────

describe('removeVariable', () => {
  it('removes the variable node', () => {
    useBuilderStore.getState().addVariable();
    const nodeId = useBuilderStore.getState().nodes[0].id;

    useBuilderStore.getState().removeVariable(nodeId);

    expect(useBuilderStore.getState().nodes).toHaveLength(0);
  });

  it('removes edges connected to the variable node', () => {
    useBuilderStore.getState().addVariable();
    const varNodeId = useBuilderStore.getState().nodes[0].id;

    // Manually add an edge from the variable node
    useBuilderStore.setState({
      edges: [
        {
          id: 'e1',
          source: varNodeId,
          target: 'some-block',
          type: 'smoothstep',
          animated: true,
        },
        {
          id: 'e2',
          source: 'other-source',
          target: 'other-target',
          type: 'smoothstep',
          animated: true,
        },
      ],
    });

    useBuilderStore.getState().removeVariable(varNodeId);

    const edges = useBuilderStore.getState().edges;
    expect(edges).toHaveLength(1);
    expect(edges[0].id).toBe('e2');
  });
});

// ─── save() includes variables ──────────────────────────────────────────────

describe('save', () => {
  it('includes variables in the payload', async () => {
    // Set required name
    useBuilderStore.setState({ name: 'Test Strategy' });

    // Add variables
    useBuilderStore.getState().addVariable();
    const nodeId = useBuilderStore.getState().nodes[0].id;
    useBuilderStore.getState().updateVariable(nodeId, 'variableName', 'threshold');
    useBuilderStore.getState().updateVariable(nodeId, 'expression', '0.65');

    // Mock fetch
    let capturedBody: any;
    globalThis.fetch = vi.fn().mockImplementation(async (_url: string, opts: any) => {
      capturedBody = JSON.parse(opts.body);
      return {
        ok: true,
        json: async () => ({ id: 'new-id' }),
      };
    });

    await useBuilderStore.getState().save();

    expect(capturedBody.variables).toBeDefined();
    expect(capturedBody.variables).toHaveLength(1);
    expect(capturedBody.variables[0].name).toBe('threshold');
    expect(capturedBody.variables[0].expression).toBe('0.65');
    expect(capturedBody.variables[0].id).toBe(nodeId);
  });
});

// ─── loadStrategy() creates variable nodes ──────────────────────────────────

describe('loadStrategy', () => {
  it('creates variable nodes from strategy data', async () => {
    const strategyData = {
      name: 'My Strategy',
      description: '',
      execMode: 'TICK',
      tickMs: 1000,
      visibility: 'PRIVATE',
      tags: [],
      safety: [],
      triggers: [],
      conditions: [],
      actions: [],
      variables: [
        { id: 'v1', name: 'alpha', expression: 'price * 2' },
        { id: 'v2', name: 'beta', expression: '100 - alpha' },
      ],
      canvas: {
        positions: {
          v1: { x: 0, y: 100 },
          v2: { x: 0, y: 260 },
        },
        connections: [],
      },
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => strategyData,
    });

    await useBuilderStore.getState().loadStrategy('test-id');

    const nodes = useBuilderStore.getState().nodes;
    const varNodes = nodes.filter((n) => n.type === 'variableNode');

    expect(varNodes).toHaveLength(2);
    expect(varNodes[0].id).toBe('v1');
    expect(varNodes[0].data.variableName).toBe('alpha');
    expect(varNodes[0].data.expression).toBe('price * 2');
    expect(varNodes[0].position).toEqual({ x: 0, y: 100 });

    expect(varNodes[1].id).toBe('v2');
    expect(varNodes[1].data.variableName).toBe('beta');
    expect(varNodes[1].data.expression).toBe('100 - alpha');
  });

  it('falls back to canvas.variables if top-level variables is missing', async () => {
    const strategyData = {
      name: 'My Strategy',
      description: '',
      execMode: 'TICK',
      tickMs: 1000,
      visibility: 'PRIVATE',
      tags: [],
      safety: [],
      triggers: [],
      conditions: [],
      actions: [],
      canvas: {
        positions: {},
        connections: [],
        variables: [
          { id: 'cv1', name: 'gamma', expression: '42' },
        ],
      },
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => strategyData,
    });

    await useBuilderStore.getState().loadStrategy('test-id-2');

    const varNodes = useBuilderStore.getState().nodes.filter((n) => n.type === 'variableNode');
    expect(varNodes).toHaveLength(1);
    expect(varNodes[0].data.variableName).toBe('gamma');
  });
});

// ─── Logic blocks ──────────────────────────────────────────────────────────

describe('addNode with logic blocks', () => {
  it('creates a logicNode for IF_THEN_ELSE', () => {
    const ifDef = BLOCK_DEFS.logic.find((d) => d.type === 'IF_THEN_ELSE')!;
    useBuilderStore.getState().addNode(ifDef, 'logic');

    const nodes = useBuilderStore.getState().nodes;
    expect(nodes).toHaveLength(1);
    expect(nodes[0].type).toBe('logicNode');
    expect(nodes[0].data.type).toBe('IF_THEN_ELSE');
    expect(nodes[0].data.section).toBe('logic');
    expect(nodes[0].data.outputs).toEqual(['true', 'false']);
  });

  it('creates a logicNode for AND_GATE', () => {
    const andDef = BLOCK_DEFS.logic.find((d) => d.type === 'AND_GATE')!;
    useBuilderStore.getState().addNode(andDef, 'logic');

    const nodes = useBuilderStore.getState().nodes;
    expect(nodes).toHaveLength(1);
    expect(nodes[0].type).toBe('logicNode');
    expect(nodes[0].data.type).toBe('AND_GATE');
  });

  it('creates a logicNode for OR_GATE', () => {
    const orDef = BLOCK_DEFS.logic.find((d) => d.type === 'OR_GATE')!;
    useBuilderStore.getState().addNode(orDef, 'logic');

    const nodes = useBuilderStore.getState().nodes;
    expect(nodes[0].type).toBe('logicNode');
    expect(nodes[0].data.type).toBe('OR_GATE');
  });

  it('creates a logicNode for NOT_GATE', () => {
    const notDef = BLOCK_DEFS.logic.find((d) => d.type === 'NOT_GATE')!;
    useBuilderStore.getState().addNode(notDef, 'logic');

    const nodes = useBuilderStore.getState().nodes;
    expect(nodes[0].type).toBe('logicNode');
    expect(nodes[0].data.type).toBe('NOT_GATE');
  });

  it('creates a logicNode for DELAY', () => {
    const delayDef = BLOCK_DEFS.logic.find((d) => d.type === 'DELAY')!;
    useBuilderStore.getState().addNode(delayDef, 'logic');

    const nodes = useBuilderStore.getState().nodes;
    expect(nodes[0].type).toBe('logicNode');
    expect(nodes[0].data.type).toBe('DELAY');
    expect(nodes[0].data.fields).toHaveLength(1);
    expect(nodes[0].data.fields[0].key).toBe('seconds');
  });

  it('uses amber color for IF_THEN_ELSE', () => {
    const ifDef = BLOCK_DEFS.logic.find((d) => d.type === 'IF_THEN_ELSE')!;
    useBuilderStore.getState().addNode(ifDef, 'logic');

    const node = useBuilderStore.getState().nodes[0];
    expect(node.data.color).toBe('var(--color-pf-warning)');
  });

  it('uses blue color for AND_GATE', () => {
    const andDef = BLOCK_DEFS.logic.find((d) => d.type === 'AND_GATE')!;
    useBuilderStore.getState().addNode(andDef, 'logic');

    const node = useBuilderStore.getState().nodes[0];
    expect(node.data.color).toBe('var(--color-pf-info)');
  });

  it('uses gray color for DELAY', () => {
    const delayDef = BLOCK_DEFS.logic.find((d) => d.type === 'DELAY')!;
    useBuilderStore.getState().addNode(delayDef, 'logic');

    const node = useBuilderStore.getState().nodes[0];
    expect(node.data.color).toBe('var(--color-pf-text-muted)');
  });
});

describe('save includes logic blocks', () => {
  it('includes logicBlocks in the save payload', async () => {
    useBuilderStore.setState({ name: 'Test Strategy' });

    const ifDef = BLOCK_DEFS.logic.find((d) => d.type === 'IF_THEN_ELSE')!;
    useBuilderStore.getState().addNode(ifDef, 'logic');
    const nodeId = useBuilderStore.getState().nodes[0].id;
    useBuilderStore.getState().updateNodeConfig(nodeId, 'condition', '$price > 0.5');

    let capturedBody: any;
    globalThis.fetch = vi.fn().mockImplementation(async (_url: string, opts: any) => {
      capturedBody = JSON.parse(opts.body);
      return {
        ok: true,
        json: async () => ({ id: 'new-id' }),
      };
    });

    await useBuilderStore.getState().save();

    expect(capturedBody.logicBlocks).toBeDefined();
    expect(capturedBody.logicBlocks).toHaveLength(1);
    expect(capturedBody.logicBlocks[0].type).toBe('IF_THEN_ELSE');
    expect(capturedBody.logicBlocks[0].config.condition).toBe('$price > 0.5');
    expect(capturedBody.logicBlocks[0].outputs).toEqual(['true', 'false']);
  });
});

describe('loadStrategy restores logic blocks', () => {
  it('creates logicNode nodes from strategy data', async () => {
    const strategyData = {
      name: 'My Strategy',
      description: '',
      execMode: 'TICK',
      tickMs: 1000,
      visibility: 'PRIVATE',
      tags: [],
      safety: [],
      triggers: [],
      conditions: [],
      actions: [],
      logicBlocks: [
        { id: 'lb1', type: 'IF_THEN_ELSE', config: { condition: 'price > 0.5' }, outputs: ['true', 'false'] },
        { id: 'lb2', type: 'AND_GATE', config: {} },
      ],
      variables: [],
      canvas: {
        positions: {
          lb1: { x: 1050, y: 100 },
          lb2: { x: 1050, y: 260 },
        },
        connections: [],
      },
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => strategyData,
    });

    await useBuilderStore.getState().loadStrategy('test-id-logic');

    const nodes = useBuilderStore.getState().nodes;
    const logicNodes = nodes.filter((n) => n.type === 'logicNode');

    expect(logicNodes).toHaveLength(2);
    expect(logicNodes[0].id).toBe('lb1');
    expect(logicNodes[0].data.type).toBe('IF_THEN_ELSE');
    expect(logicNodes[0].data.config.condition).toBe('price > 0.5');
    expect(logicNodes[0].position).toEqual({ x: 1050, y: 100 });

    expect(logicNodes[1].id).toBe('lb2');
    expect(logicNodes[1].data.type).toBe('AND_GATE');
  });
});
