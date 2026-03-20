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

  /** 深入跑道內部的安全位置（供空中跑道重生使用，避免重生在邊緣）*/
  private lastInteriorPosition: Vector3 = { x: 0, y: 0, z: 0 };
  private hasInteriorPosition = false;
  /** 內部安全檢查半徑：周圍 8 個方向都在跑道上才算「安全內部」*/
  private readonly INTERIOR_SPREAD = 5;
  /** 內部位置更新節流計數器（每 30 幀才做一次 8 條 raycast）*/
  private interiorCheckCounter = 0;

  /** 最後安全位置對應的車頭旋轉（重生時恢復方向）*/
  private lastSafeRotation = { x: 0, y: 0, z: 0, w: 1 };
  private lastInteriorRotation = { x: 0, y: 0, z: 0, w: 1 };

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
    // 不預設 lastInteriorPosition：讓它在實際行駛後才被驗證設定
    // 避免起跑點永遠被當成重生點
  }

  /**
   * 確認位置周圍 8 方向都在跑道內（半徑 INTERIOR_SPREAD），
   * 確保重生點不會太靠近邊緣
   */
  private isInteriorPosition(pos: Vector3): boolean {
    const r = this.INTERIOR_SPREAD;
    return (
      this.raycastPoint(pos.x + r, pos.y, pos.z) &&
      this.raycastPoint(pos.x - r, pos.y, pos.z) &&
      this.raycastPoint(pos.x, pos.y, pos.z + r) &&
      this.raycastPoint(pos.x, pos.y, pos.z - r) &&
      this.raycastPoint(pos.x + r, pos.y, pos.z + r) &&
      this.raycastPoint(pos.x - r, pos.y, pos.z - r) &&
      this.raycastPoint(pos.x + r, pos.y, pos.z - r) &&
      this.raycastPoint(pos.x - r, pos.y, pos.z + r)
    );
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
   * 空中跑道模式：偵測車輛是否離開跑道面
   * 離開跑道時不推回，回傳狀態讓外部決定是否觸發掉落與重生
   *
   * 回傳值：
   *   'safe'   — 在跑道上，持續更新安全位置
   *   'falling' — 已離開跑道面，車子應開始下墜
   *   'fallen'  — Y 低於 fallThresholdY，觸發重生
   */
  applyFallDetection(
    car: RaceCar,
    fallThresholdY: number,
    trackSurfaceY: number,
  ): "safe" | "falling" | "fallen" {
    if (this.trackMeshes.length === 0) return "safe";

    // 暖機期：持續更新安全位置但不觸發掉落
    if (this.warmupFrames > 0) {
      this.warmupFrames--;
      if (this.raycastPoint(car.position.x, car.position.y, car.position.z)) {
        this.lastSafePosition = { ...car.position };
        this.hasSafePosition = true;
      }
      return "safe";
    }

    // Y 已低於閾值 → 直接觸發重生
    if (car.position.y < fallThresholdY) {
      this.offTrackFrames = 0;
      return "fallen";
    }

    // 車輛 Y 已明顯低於跑道面 → 確認為掉落
    // 防止 XZ 仍在跑道 mesh 上方時 isOnTrack 誤判 safe，造成 Y 軸鎖回震盪
    if (car.position.y < trackSurfaceY - 3) {
      return "falling";
    }

    const onTrack = this.isOnTrack(car.position);

    if (onTrack) {
      if (this.raycastPoint(car.position.x, car.position.y, car.position.z)) {
        this.lastSafePosition = { ...car.position };
        this.lastSafeRotation = { ...car.rotation };
        this.hasSafePosition = true;
        // 每 30 幀才做內部位置檢查（8 條 raycast），避免每幀開銷過重
        this.interiorCheckCounter = (this.interiorCheckCounter + 1) % 30;
        if (
          this.interiorCheckCounter === 0 &&
          this.isInteriorPosition(car.position)
        ) {
          this.lastInteriorPosition = { ...car.position };
          this.lastInteriorRotation = { ...car.rotation };
          this.hasInteriorPosition = true;
        }
      }
      this.offTrackFrames = 0;
      return "safe";
    }

    // 離開跑道：累積幀數（防止接縫誤判），未達閾值前還是 safe
    this.offTrackFrames++;
    if (this.offTrackFrames < this.OFF_TRACK_THRESHOLD) return "safe";

    return "falling";
  }

  /** 取得重生安全位置：優先回傳深入跑道內部的點，避免重生在邊緣造成二次掉落 */
  getLastSafePosition(): Vector3 | null {
    if (this.hasInteriorPosition) return { ...this.lastInteriorPosition };
    if (this.hasSafePosition) return { ...this.lastSafePosition };
    return null;
  }

  /** 取得重生時應恢復的車頭旋轉（掉落前在跑道上的方向）*/
  getLastSafeRotation(): { x: number; y: number; z: number; w: number } | null {
    if (this.hasInteriorPosition) return { ...this.lastInteriorRotation };
    if (this.hasSafePosition) return { ...this.lastSafeRotation };
    return null;
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
