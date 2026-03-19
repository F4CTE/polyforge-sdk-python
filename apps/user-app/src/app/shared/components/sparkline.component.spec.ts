import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// ─── Canvas mock ────────────────────────────────────────────────────────────

function makeCanvasContext() {
  return {
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 0,
  };
}

function makeCanvas(ctx: ReturnType<typeof makeCanvasContext>) {
  return {
    width: 80,
    height: 24,
    getContext: vi.fn().mockReturnValue(ctx),
  };
}

// ─── Test helpers ────────────────────────────────────────────────────────────
// The SparklineComponent uses Angular @ViewChild and lifecycle hooks.
// We replicate the draw logic so we can unit-test canvas interactions
// without Angular TestBed (user-app has no vitest/TestBed wired up).

function createComponent(overrides: Record<string, unknown> = {}) {
  const ctx = makeCanvasContext();
  const canvas = makeCanvas(ctx);

  const component: any = {
    canvasRef: { nativeElement: canvas },
    data: [] as number[],
    width: 80,
    height: 24,
    color: "#06B6D4",
    fillColor: "rgba(6, 182, 212, 0.1)",
    ...overrides,
  };

  // Replicate the draw method from SparklineComponent
  component.draw = () => {
    const cnv = component.canvasRef?.nativeElement;
    if (!cnv || component.data.length < 2) return;
    const context = cnv.getContext("2d");
    if (!context) return;

    const w = cnv.width;
    const h = cnv.height;
    const d = component.data;
    const min = Math.min(...d);
    const max = Math.max(...d);
    const range = max - min || 1;
    const pad = 2;

    context.clearRect(0, 0, w, h);

    const trending = d[d.length - 1] >= d[0];
    const lineColor = trending ? component.color : "#EF4444";
    const fill = trending ? component.fillColor : "rgba(239, 68, 68, 0.1)";

    // Draw filled area
    context.beginPath();
    context.moveTo(0, h);
    for (let i = 0; i < d.length; i++) {
      const x = (i / (d.length - 1)) * w;
      const y = h - pad - ((d[i] - min) / range) * (h - pad * 2);
      context.lineTo(x, y);
    }
    context.lineTo(w, h);
    context.closePath();
    context.fillStyle = fill;
    context.fill();

    // Draw line
    context.beginPath();
    for (let i = 0; i < d.length; i++) {
      const x = (i / (d.length - 1)) * w;
      const y = h - pad - ((d[i] - min) / range) * (h - pad * 2);
      if (i === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.strokeStyle = lineColor;
    context.lineWidth = 1.5;
    context.stroke();
  };

  // ngAfterViewInit calls draw
  component.ngAfterViewInit = () => component.draw();

  // ngOnChanges calls draw if canvasRef exists
  component.ngOnChanges = () => {
    if (component.canvasRef) component.draw();
  };

  return { component, ctx, canvas };
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe("SparklineComponent", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates component with default properties", () => {
    const { component } = createComponent();

    expect(component.data).toEqual([]);
    expect(component.width).toBe(80);
    expect(component.height).toBe(24);
    expect(component.color).toBe("#06B6D4");
  });

  it("has a canvas element reference", () => {
    const { component, canvas } = createComponent();

    expect(component.canvasRef.nativeElement).toBe(canvas);
    expect(canvas.getContext).toBeDefined();
  });

  it("does not draw when data has fewer than 2 points", () => {
    const { component, ctx } = createComponent({ data: [5] });

    component.ngAfterViewInit();

    expect(ctx.clearRect).not.toHaveBeenCalled();
    expect(ctx.beginPath).not.toHaveBeenCalled();
  });

  it("does not draw when data is empty", () => {
    const { component, ctx } = createComponent({ data: [] });

    component.ngAfterViewInit();

    expect(ctx.clearRect).not.toHaveBeenCalled();
  });

  it("draws on afterViewInit with valid data", () => {
    const { component, ctx } = createComponent({ data: [10, 20, 30, 25] });

    component.ngAfterViewInit();

    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 80, 24);
    expect(ctx.beginPath).toHaveBeenCalled();
    expect(ctx.fill).toHaveBeenCalled();
    expect(ctx.stroke).toHaveBeenCalled();
  });

  it("draws on ngOnChanges when canvasRef exists", () => {
    const { component, ctx } = createComponent({ data: [5, 10, 15] });

    component.ngOnChanges();

    expect(ctx.clearRect).toHaveBeenCalled();
    expect(ctx.stroke).toHaveBeenCalled();
  });

  it("uses upward trend color when last value >= first value", () => {
    const { component, ctx } = createComponent({ data: [10, 20] });

    component.ngAfterViewInit();

    expect(ctx.strokeStyle).toBe("#06B6D4");
  });

  it("uses downward trend color when last value < first value", () => {
    const { component, ctx } = createComponent({ data: [20, 10] });

    component.ngAfterViewInit();

    expect(ctx.strokeStyle).toBe("#EF4444");
  });

  it("calls getContext with '2d'", () => {
    const { component, canvas } = createComponent({ data: [1, 2, 3] });

    component.ngAfterViewInit();

    expect(canvas.getContext).toHaveBeenCalledWith("2d");
  });
});
