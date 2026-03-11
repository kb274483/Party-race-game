/**
 * 邊界與障礙物放置驗證工具
 * 確保障礙物與加速帶僅在跑道內（playableBounds）生成
 */

import type { BoundingBox, Vector3, Obstacle, SpeedBoost } from "../types/game";

/**
 * 檢查點是否在 BoundingBox 內
 */
export function isPointInBounds(point: Vector3, bounds: BoundingBox): boolean {
  return (
    point.x >= bounds.min.x &&
    point.x <= bounds.max.x &&
    point.y >= bounds.min.y &&
    point.y <= bounds.max.y &&
    point.z >= bounds.min.z &&
    point.z <= bounds.max.z
  );
}

/**
 * 檢查障礙物的 AABB 是否完全包含於 playableBounds 內
 * 障礙物 position 為中心，size 為半徑或半尺寸
 */
export function isObstacleWithinBounds(
  obstacle: Pick<Obstacle, "position" | "size" | "boundingBox">,
  playableBounds: BoundingBox,
): boolean {
  const { min, max } = obstacle.boundingBox;
  return (
    min.x >= playableBounds.min.x &&
    max.x <= playableBounds.max.x &&
    min.y >= playableBounds.min.y &&
    max.y <= playableBounds.max.y &&
    min.z >= playableBounds.min.z &&
    max.z <= playableBounds.max.z
  );
}

/**
 * 檢查加速帶是否完全在 playableBounds 內
 * 加速帶為圓形，檢查圓心 + radius 不超出邊界
 */
export function isSpeedBoostWithinBounds(
  boost: Pick<SpeedBoost, "position" | "radius">,
  playableBounds: BoundingBox,
): boolean {
  const { position, radius } = boost;
  return (
    position.x - radius >= playableBounds.min.x &&
    position.x + radius <= playableBounds.max.x &&
    position.y - radius >= playableBounds.min.y &&
    position.y + radius <= playableBounds.max.y &&
    position.z - radius >= playableBounds.min.z &&
    position.z + radius <= playableBounds.max.z
  );
}

/**
 * 在 playableBounds 內隨機取樣一個點（用於障礙物/加速帶放置）
 * @param margin 與邊界的最小距離，確保障礙物不貼邊或超出跑道
 */
export function randomPointInBounds(
  bounds: BoundingBox,
  margin: number = 0,
  random: () => number = Math.random,
): Vector3 {
  const safeMargin = Math.max(0, margin);
  const rangeX = bounds.max.x - bounds.min.x - 2 * safeMargin;
  const rangeY = bounds.max.y - bounds.min.y - 2 * safeMargin;
  const rangeZ = bounds.max.z - bounds.min.z - 2 * safeMargin;
  if (rangeX <= 0 || rangeY <= 0 || rangeZ <= 0) {
    return { x: bounds.min.x, y: bounds.min.y, z: bounds.min.z };
  }
  return {
    x: bounds.min.x + safeMargin + random() * rangeX,
    y: bounds.min.y + safeMargin + random() * rangeY,
    z: bounds.min.z + safeMargin + random() * rangeZ,
  };
}

/**
 * 從 position 和 size 計算障礙物的 BoundingBox（用於驗證是否在跑道內）
 */
export function obstacleBoundingBox(
  position: Vector3,
  size: Vector3,
): BoundingBox {
  const half = { x: size.x / 2, y: size.y / 2, z: size.z / 2 };
  return {
    min: {
      x: position.x - half.x,
      y: position.y - half.y,
      z: position.z - half.z,
    },
    max: {
      x: position.x + half.x,
      y: position.y + half.y,
      z: position.z + half.z,
    },
  };
}
