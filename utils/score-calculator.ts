/**
 * LapTracker - 圈數計分系統（角度追蹤法）
 *
 * 原理：追蹤車輛位置相對跑道中心的角度變化
 * - 原地迴轉：位置不動，角度不累積 → 不計圈
 * - 真實繞圈：位置繞中心移動，角度累積到 2π → 計 1 圈
 */

export class LapTracker {
  private centerX: number;
  private centerZ: number;
  private lastAngle: number | null = null;
  private cumulativeAngle = 0; // 累積角度（弧度）

  /** 行進方向：+1 = 正向，-1 = 逆向，null = 尚未注入 */
  private forwardDirection: 1 | -1 | null = null;

  /** 近期 delta 滑動窗口，用於逆向偵測 */
  private recentDeltas: number[] = [];
  private recentDeltaSum = 0;
  private readonly WRONG_WAY_WINDOW = 60; // 1 秒窗口
  private readonly WRONG_WAY_THRESHOLD = 0.001; // 需有顯著移動才判定

  constructor(centerX: number, centerZ: number) {
    this.centerX = centerX;
    this.centerZ = centerZ;
  }

  /**
   * 每幀呼叫，更新車輛位置
   */
  update(carX: number, carZ: number): void {
    const angle = Math.atan2(carZ - this.centerZ, carX - this.centerX);

    if (this.lastAngle !== null) {
      let delta = angle - this.lastAngle;
      // 處理 ±180° 換行：將 delta 正規化到 [-π, π]
      if (delta > Math.PI) delta -= 2 * Math.PI;
      if (delta < -Math.PI) delta += 2 * Math.PI;
      this.cumulativeAngle += delta;

      // 維護滑動窗口（避免 shift 改用手動 sum 管理）
      this.recentDeltas.push(delta);
      this.recentDeltaSum += delta;
      if (this.recentDeltas.length > this.WRONG_WAY_WINDOW) {
        this.recentDeltaSum -= this.recentDeltas.shift()!;
      }
    }

    this.lastAngle = angle;
  }

  /**
   * 是否正在逆向
   * 需先確立正向方向，且近期平均移動方向與正向相反
   */
  isWrongWay(): boolean {
    if (this.forwardDirection === null) return false;
    if (this.recentDeltas.length < this.WRONG_WAY_WINDOW) return false;
    const avg = this.recentDeltaSum / this.recentDeltas.length;
    return (
      Math.sign(avg) === -this.forwardDirection &&
      Math.abs(avg) > this.WRONG_WAY_THRESHOLD
    );
  }

  /**
   * 直接注入正向（起跑時由外部以叉積計算後呼叫）
   * 避免玩家起跑就倒退導致正向被錯誤學習
   */
  setForwardDirection(direction: 1 | -1): void {
    this.forwardDirection = direction;
  }

  /** 完成的圈數 */
  getLaps(): number {
    return Math.floor(Math.abs(this.cumulativeAngle) / (2 * Math.PI));
  }

  /** 當前圈的進度 0~1 */
  getLapProgress(): number {
    return (Math.abs(this.cumulativeAngle) % (2 * Math.PI)) / (2 * Math.PI);
  }

  /**
   * 當前分數
   * 完成 1 圈 = 100 分，未完成的圈依進度給 0~99 分
   */
  getScore(): number {
    return this.getLaps() * 100 + Math.floor(this.getLapProgress() * 100);
  }

  reset(): void {
    this.lastAngle = null;
    this.cumulativeAngle = 0;
  }
}
