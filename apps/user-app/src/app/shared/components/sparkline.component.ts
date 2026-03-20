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
  @Input() color = '#06B6D4';
  @Input() fillColor = 'rgba(6, 182, 212, 0.1)';

  ngAfterViewInit(): void { this.draw(); }
  ngOnChanges(): void { if (this.canvasRef) this.draw(); }

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

    // Determine color based on trend
    const trending = d[d.length - 1] >= d[0];
    const lineColor = trending ? this.color : '#EF4444';
    const fill = trending ? this.fillColor : 'rgba(239, 68, 68, 0.1)';

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
