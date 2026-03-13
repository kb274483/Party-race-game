/**
 * Race Track Generator - 賽道生成器
 * 負責生成障礙物和加速帶
 *
 * 障礙物與加速帶採用「先建立碰撞系統，再驗證候選點是否在跑道上」的兩階段策略，
 * 確保所有物件都落在實際可行駛的跑道面上。
 */

import type {
  RaceTrack,
  Obstacle,
  SpeedBoost,
  Vector3,
  BoundingBox,
  GameDifficulty,
} from "../types/game";

export class RaceTrackGenerator {
  /**
   * 生成賽道基礎資料（不含障礙物/加速帶，待碰撞系統建立後另行生成）
   */
  generateTrack(
    seed?: number,
    trackBounds?: BoundingBox,
    customStartPosition?: { x: number; y: number; z: number },
  ): RaceTrack {
    const bounds: BoundingBox = trackBounds ?? {
      min: { x: -50, y: 0, z: -50 },
      max: { x: 50, y: 10, z: 50 },
    };

    const margin = 0.1;
    const groundY = bounds.min.y;
    const playableBounds: BoundingBox = {
      min: {
        x: bounds.min.x + margin,
        y: groundY,
        z: bounds.min.z + margin,
      },
      max: {
        x: bounds.max.x - margin,
        y: groundY + Math.max(5, (bounds.max.y - bounds.min.y) * 0.5),
        z: bounds.max.z - margin,
      },
    };

    const startPosition: Vector3 = customStartPosition ?? {
      x: (bounds.min.x + bounds.max.x) / 2,
      y: bounds.min.y,
      z: bounds.min.z + (bounds.max.z - bounds.min.z) * 0.1,
    };

    return {
      id: `track_${Date.now()}`,
      startPosition,
      bounds,
      playableBounds,
      obstacles: [], // 由 generateOnTrackItems() 填入
      speedBoosts: [], // 由 generateOnTrackItems() 填入
    };
  }

  /**
   * 在賽道面上生成障礙物與加速帶
   * 必須在 TrackCollisionSystem 建立後呼叫，使用 isOnTrack 驗證位置確實在跑道上
   *
   * @param playableBounds 賽道可放置邊界（整個 bounding box）
   * @param isOnTrack 碰撞系統的跑道驗證函數
   * @param options 地雷與加速帶數量
   */
  /**
   * 簡易 LCG 偽亂數（確保相同 seed 產生相同序列）
   */
  private makeSeededRandom(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
      s = (Math.imul(1664525, s) + 1013904223) >>> 0;
      return s / 0x100000000;
    };
  }

  generateOnTrackItems(
    playableBounds: BoundingBox,
    isOnTrack: (pos: Vector3) => boolean,
    options: { mineCount: number; boostCount: number },
    seed?: number,
    startPosition?: Vector3,
    difficulty: GameDifficulty = 1,
  ): { mines: Obstacle[]; boosts: SpeedBoost[] } {
    const random =
      seed !== undefined ? this.makeSeededRandom(seed) : Math.random.bind(Math);
    /** 所有已放置物件，用於最小間距檢查 */
    const allPlaced: Array<{ position: Vector3 }> = [];
    const mines: Obstacle[] = [];
    const boosts: SpeedBoost[] = [];

    // 物件之間最小間距（跑道寬約 60-80 單位，35 約半條跑道寬）
    const MIN_DISTANCE = 30;
    // 起點安全距離（足夠讓多台並排的車輛離開起跑區）
    const START_SAFE_RADIUS = 50;
    const MAX_CANDIDATES = 600;

    // 依難度決定地雷速度範圍（等級 1 無速度）
    const mineSpeed = difficulty === 3 ? 4.5 : difficulty === 2 ? 2.0 : 0;
    const MOVE_RANGE = 25;

    // --- 生成地雷 ---
    let candidates = 0;
    while (mines.length < options.mineCount && candidates < MAX_CANDIDATES) {
      candidates++;
      const pos = this.randomPosition(playableBounds, random);
      if (!this.isWellInsideTrack(pos, isOnTrack)) continue;
      if (!this.isPositionValid(pos, allPlaced, MIN_DISTANCE)) continue;
      if (
        startPosition &&
        this.distanceXZ(pos, startPosition) < START_SAFE_RADIUS
      )
        continue;

      const size = { x: 2.5, y: 2, z: 2.5 };

      // 用 seed 決定隨機方向角，確保所有客戶端完全一致
      const angle = random() * Math.PI * 2;
      const velocity: Vector3 | undefined =
        mineSpeed > 0
          ? {
              x: Math.cos(angle) * mineSpeed,
              y: 0,
              z: Math.sin(angle) * mineSpeed,
            }
          : undefined;

      mines.push({
        id: `mine_${mines.length}`,
        type: "mine",
        position: { ...pos },
        size,
        boundingBox: {
          // y 範圍從 pos.y - 1 到 pos.y + 1，確保與車輛 AABB 重疊
          min: { x: pos.x - 1.25, y: pos.y - 1, z: pos.z - 1.25 },
          max: { x: pos.x + 1.25, y: pos.y + 1, z: pos.z + 1.25 },
        },
        ...(velocity
          ? { velocity, origin: { ...pos }, moveRange: MOVE_RANGE }
          : {}),
      });
      allPlaced.push({ position: pos });
    }

    // --- 生成加速帶 ---
    candidates = 0;
    while (boosts.length < options.boostCount && candidates < MAX_CANDIDATES) {
      candidates++;
      const pos = this.randomPosition(playableBounds, random);
      if (!this.isWellInsideTrack(pos, isOnTrack)) continue;
      if (!this.isPositionValid(pos, allPlaced, MIN_DISTANCE)) continue;
      if (
        startPosition &&
        this.distanceXZ(pos, startPosition) < START_SAFE_RADIUS
      )
        continue;

      boosts.push({
        id: `boost_${boosts.length}`,
        position: pos,
        radius: 3.5,
        active: true,
      });
      allPlaced.push({ position: pos });
    }

    return { mines, boosts };
  }

  /**
   * 確認候選點周圍 8 個方向都在跑道上（避免放在邊界薄條或邊緣）
   * checkRadius 設為跑道寬度的約 1/4（~15 單位），確保物件在跑道中心帶
   */
  private isWellInsideTrack(
    pos: Vector3,
    isOnTrack: (p: Vector3) => boolean,
  ): boolean {
    if (!isOnTrack(pos)) return false;
    const r = 4;
    return (
      isOnTrack({ x: pos.x + r, y: pos.y, z: pos.z }) &&
      isOnTrack({ x: pos.x - r, y: pos.y, z: pos.z }) &&
      isOnTrack({ x: pos.x, y: pos.y, z: pos.z + r }) &&
      isOnTrack({ x: pos.x, y: pos.y, z: pos.z - r }) &&
      isOnTrack({ x: pos.x + r, y: pos.y, z: pos.z + r }) &&
      isOnTrack({ x: pos.x - r, y: pos.y, z: pos.z - r }) &&
      isOnTrack({ x: pos.x + r, y: pos.y, z: pos.z - r }) &&
      isOnTrack({ x: pos.x - r, y: pos.y, z: pos.z + r })
    );
  }

  private randomPosition(bounds: BoundingBox, random: () => number): Vector3 {
    return {
      x: bounds.min.x + random() * (bounds.max.x - bounds.min.x),
      y: bounds.min.y, // 物理 y（與車輛 physics y 一致，確保 AABB 碰撞正確）
      z: bounds.min.z + random() * (bounds.max.z - bounds.min.z),
    };
  }

  private isPositionValid(
    position: Vector3,
    existingObjects: Array<{ position: Vector3 }>,
    minDistance: number,
  ): boolean {
    for (const obj of existingObjects) {
      if (this.distanceXZ(position, obj.position) < minDistance) return false;
    }
    return true;
  }

  private distanceXZ(a: Vector3, b: Vector3): number {
    const dx = a.x - b.x;
    const dz = a.z - b.z;
    return Math.sqrt(dx * dx + dz * dz);
  }
}
