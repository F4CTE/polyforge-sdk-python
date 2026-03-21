import { Component, Input, ElementRef, AfterViewInit, OnChanges, ViewChild, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-sparkline',
  standalone: true,
  template: '<canvas #canvas [width]="width" [height]="height" style="display:block"></canvas>',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SparklineComponent implements AfterViewInit, OnChanges {
  @ViewChild('canvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  @Input() data: number[] = [];
  @Input() width = 80;
  @Input() height = 24;
  @Input() color = '';
  @Input() fillColor = '';

  ngAfterViewInit(): void { this.draw(); }
  ngOnChanges(): void { if (this.canvasRef) this.draw(); }

  private resolveColor(value: string, fallback: string): string {
    if (!value) return fallback;
    if (value.startsWith('var(')) {
      const varName = value.replace(/^var\(/, '').replace(/\)$/, '').trim();
      const resolved = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
      return resolved || fallback;
    }
    return value;
  }

  private draw(): void {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas || this.data.length < 2) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const d = this.data;
    const min = Math.min(...d);
    const max = Math.max(...d);
    const range = max - min || 1;
    const pad = 2;

    ctx.clearRect(0, 0, w, h);

    const style = getComputedStyle(document.documentElement);
    const defaultColor = style.getPropertyValue('--pf-cyan-500').trim() || '#06B6D4';
    const dangerColor = style.getPropertyValue('--pf-danger').trim() || '#EF4444';

    // Determine color based on trend
    const trending = d[d.length - 1] >= d[0];
    const resolvedColor = this.resolveColor(this.color, defaultColor);
    const lineColor = trending ? resolvedColor : dangerColor;
    const toFill = (hex: string) => {
      // Convert hex to rgba with 0.1 alpha for fill
      const match = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
      if (match) return `rgba(${parseInt(match[1], 16)},${parseInt(match[2], 16)},${parseInt(match[3], 16)},0.1)`;
      return hex + '1A';
    };
    const fill = this.fillColor || toFill(lineColor);

    // Draw filled area
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let i = 0; i < d.length; i++) {
      const x = (i / (d.length - 1)) * w;
      const y = h - pad - ((d[i] - min) / range) * (h - pad * 2);
      if (i === 0) ctx.lineTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();

    // Draw line
    ctx.beginPath();
    for (let i = 0; i < d.length; i++) {
      const x = (i / (d.length - 1)) * w;
      const y = h - pad - ((d[i] - min) / range) * (h - pad * 2);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}
