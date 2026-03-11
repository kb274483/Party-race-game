/**
 * Track Collision System - 賽道圍牆碰撞偵測
 *
 * 策略：對 Mesh006 家族所有 mesh 同時發射垂直射線（上下各一）
 * 判斷車輛是否在可行駛跑道面上方。
 *
 * - 暖機期（前180幀）：不觸發碰撞，讓車輛移動至有幾何體覆蓋的區域
 * - 在跑道上 → 更新最後安全位置
 * - 離開跑道 → 退回最後安全位置 + 速度懲罰
 *
 * 防止假碰撞（空氣牆）：
 * 1. 多點射線：車輛中心 + 4 個偏移點，任一命中即視為在跑道上
 * 2. 連續幀確認：需連續 3 幀偵測到出界才觸發懲罰，避免接縫瞬間誤判
 */

import type { RaceCar, Vector3 } from "../types/game";
import * as THREE from "three";

export class TrackCollisionSystem {
  private trackMeshes: THREE.Mesh[] = [];
  private raycaster = new THREE.Raycaster();

  private lastSafePosition: Vector3 = { x: 0, y: 0, z: 0 };
  private hasSafePosition = false;

  /** 暖機幀數：讓車輛先移動進入有幾何體的區域再啟動碰撞 */
  private warmupFrames = 180;

  /** 連續出界幀數計數 */
  private offTrackFrames = 0;
  /** 觸發懲罰所需的連續出界幀數（防止接縫誤判） */
  private readonly OFF_TRACK_THRESHOLD = 3;

  /** 多點射線偏移量（約車身半寬），任一點在跑道上即視為在跑道上 */
  private readonly SPREAD = 0.1;

  constructor(trackMeshes: THREE.Mesh[]) {
    this.trackMeshes = trackMeshes;
  }

  setInitialSafePosition(position: Vector3): void {
    this.lastSafePosition = { ...position };
    this.hasSafePosition = true;
  }

  /**
   * 對單一 XZ 點發射雙向垂直射線
   */
  private raycastPoint(x: number, y: number, z: number): boolean {
    this.raycaster.near = 0;
    this.raycaster.far = 2000;

    // 從上方往下射
    this.raycaster.set(
      new THREE.Vector3(x, y + 1000, z),
      new THREE.Vector3(0, -1, 0),
    );
    if (this.raycaster.intersectObjects(this.trackMeshes, false).length > 0) {
      return true;
    }

    // 從下方往上射（雙保險，處理法線方向問題）
    this.raycaster.set(
      new THREE.Vector3(x, y - 1000, z),
      new THREE.Vector3(0, 1, 0),
    );
    return this.raycaster.intersectObjects(this.trackMeshes, false).length > 0;
  }

  /**
   * 多點射線判斷：車輛中心 + 4 個偏移點，任一命中即視為在跑道上
   * 有效消除 mesh 接縫、邊緣導致的假陽性（空氣牆）
   */
  isOnTrack(position: Vector3): boolean {
    if (this.trackMeshes.length === 0) return true;

    // 先測中心點（最常見情況，快速返回）
    if (this.raycastPoint(position.x, position.y, position.z)) return true;

    // 中心點未命中，再測 4 個偏移點（覆蓋車身寬度範圍）
    const s = this.SPREAD;
    return (
      this.raycastPoint(position.x + s, position.y, position.z) ||
      this.raycastPoint(position.x - s, position.y, position.z) ||
      this.raycastPoint(position.x, position.y, position.z + s) ||
      this.raycastPoint(position.x, position.y, position.z - s)
    );
  }

  /**
   * 每幀呼叫：偵測車輛是否衝出跑道
   * 暖機期內不觸發碰撞，但持續更新安全位置
   */
  applyWallCollision(car: RaceCar): boolean {
    if (this.trackMeshes.length === 0) return false;

    // 暖機期：讓車輛先移動到有 mesh 覆蓋的位置
    if (this.warmupFrames > 0) {
      this.warmupFrames--;
      if (this.raycastPoint(car.position.x, car.position.y, car.position.z)) {
        this.lastSafePosition = { ...car.position };
        this.hasSafePosition = true;
      }
      return false;
    }

    const onTrack = this.isOnTrack(car.position);

    if (onTrack) {
      // 只在中心點也在跑道上時才更新安全位置
      // 偏移探測點僅用於防止接縫假碰撞，不應記錄已靠牆的位置
      if (this.raycastPoint(car.position.x, car.position.y, car.position.z)) {
        this.lastSafePosition = { ...car.position };
        this.hasSafePosition = true;
      }
      this.offTrackFrames = 0;
      return false;
    }

    // 累積出界幀數，未達閾值前不觸發懲罰（避免接縫瞬間誤判）
    this.offTrackFrames++;
    if (this.offTrackFrames < this.OFF_TRACK_THRESHOLD) {
      return false;
    }

    // 連續出界確認 → 退回最後安全位置並懲罰速度
    if (this.hasSafePosition) {
      car.position.x = this.lastSafePosition.x;
      car.position.y = this.lastSafePosition.y;
      car.position.z = this.lastSafePosition.z;
    }

    car.speed *= 0.2;
    car.velocity.x *= 0.2;
    car.velocity.z *= 0.2;
    this.offTrackFrames = 0;

    return true;
  }
}
