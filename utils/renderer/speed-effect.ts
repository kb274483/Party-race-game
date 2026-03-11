/**
 * SpeedEffect - 漫畫風格速度線 overlay（2D canvas）
 */

export class SpeedEffect {
  private overlayCanvas: HTMLCanvasElement | null = null;
  private overlayCtx: CanvasRenderingContext2D | null = null;
  private smoothedSpeedRatio: number = 0;
  private speedLines: Array<{
    angle: number;
    pulseSpeed: number;
    pulseOffset: number;
    alpha: number;
    width: number;
    innerFraction: number;
  }> = [];

  init(container: HTMLElement): void {
    this.overlayCanvas = document.createElement("canvas");
    this.overlayCanvas.style.cssText =
      "position:absolute;top:0;left:0;pointer-events:none;";
    this.overlayCanvas.width = window.innerWidth;
    this.overlayCanvas.height = window.innerHeight;
    container.appendChild(this.overlayCanvas);
    this.overlayCtx = this.overlayCanvas.getContext("2d");

    const rng = (seed: number) => {
      const x = Math.sin(seed) * 10000;
      return x - Math.floor(x);
    };
    const COUNT = 120;
    this.speedLines = Array.from({ length: COUNT }, (_, i) => ({
      angle:
        (i / COUNT) * Math.PI * 2 +
        rng(i * 0.71) * ((Math.PI * 2) / COUNT) * 0.6,
      pulseSpeed: 2.5 + rng(i * 1.3) * 3.0,
      pulseOffset: rng(i * 2.1) * Math.PI * 2,
      alpha: 0.45 + rng(i * 2.5) * 0.45,
      width: 0.8 + rng(i * 3.1) * 1.6,
      innerFraction: 0.3 + rng(i * 4.3) * 0.25,
    }));
  }

  /** 每幀呼叫：更新平滑速度比並繪製 */
  renderFrame(speedRatio: number): void {
    if (speedRatio > this.smoothedSpeedRatio) {
      this.smoothedSpeedRatio = speedRatio;
    } else {
      this.smoothedSpeedRatio = Math.max(
        this.smoothedSpeedRatio - 0.018,
        speedRatio,
      );
    }
    this.draw(this.smoothedSpeedRatio);
  }

  private draw(speedRatio: number): void {
    if (!this.overlayCtx || !this.overlayCanvas) return;

    const ctx = this.overlayCtx;
    const W = this.overlayCanvas.width;
    const H = this.overlayCanvas.height;
    ctx.clearRect(0, 0, W, H);

    const THRESHOLD = 0.55;
    if (speedRatio < THRESHOLD) return;

    const intensity = Math.pow((speedRatio - THRESHOLD) / (1 - THRESHOLD), 1.6);
    const now = performance.now() / 1000;
    const cx = W / 2;
    const cy = H / 2;
    const shortSide = Math.min(W, H);
    const maxR = Math.sqrt(cx * cx + cy * cy) * 1.15;

    // 外圍暗角 vignette
    const vg = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(0.5, "rgba(0,0,0,0)");
    vg.addColorStop(0.75, `rgba(0,0,0,${intensity * 0.1})`);
    vg.addColorStop(1, `rgba(0,0,0,${intensity * 0.3})`);
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);

    // 漫畫速度線
    for (let i = 0; i < this.speedLines.length; i++) {
      const line = this.speedLines[i]!;
      const pulse = 0.65 + 0.5 * Math.sin(now * line.pulseSpeed + line.pulseOffset);
      const lineAlpha = intensity * line.alpha * pulse;
      if (lineAlpha < 0.02) continue;

      const lineInnerR = shortSide * line.innerFraction;
      const cos = Math.cos(line.angle);
      const sin = Math.sin(line.angle);
      const sx = cx + cos * lineInnerR;
      const sy = cy + sin * lineInnerR;
      const ex = cx + cos * maxR;
      const ey = cy + sin * maxR;

      const lineGrad = ctx.createLinearGradient(sx, sy, ex, ey);
      lineGrad.addColorStop(0, "rgba(255,255,255,0)");
      lineGrad.addColorStop(0.12, `rgba(255,255,255,${lineAlpha})`);
      lineGrad.addColorStop(0.5, `rgba(255,255,255,${lineAlpha * 0.55})`);
      lineGrad.addColorStop(1, "rgba(255,255,255,0)");

      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.strokeStyle = lineGrad;
      ctx.lineWidth = line.width * (0.4 + intensity * 0.6);
      ctx.stroke();
    }
  }

  resize(): void {
    if (this.overlayCanvas) {
      this.overlayCanvas.width = window.innerWidth;
      this.overlayCanvas.height = window.innerHeight;
    }
  }

  dispose(): void {
    if (this.overlayCanvas?.parentElement) {
      this.overlayCanvas.parentElement.removeChild(this.overlayCanvas);
    }
    this.overlayCanvas = null;
    this.overlayCtx = null;
  }
}
