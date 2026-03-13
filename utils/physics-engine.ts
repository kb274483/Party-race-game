/**
 * Physics Engine - 輕量級物理引擎
 * 負責 AABB 碰撞檢測、賽車移動邏輯和碰撞反應
 */

import type {
  RaceCar,
  Obstacle,
  SpeedBoost,
  Collision,
  InputState,
  Vector3,
  BoundingBox,
} from "../types/game";

export class PhysicsEngine {
  private readonly gravity = -9.8;
  private readonly friction = 0.95;
  private groundY = 0; // 地面高度（可依賽道模型設定）

  /**
   * 地雷碰撞冷卻計時（key: `${carId}_${mineId}`, value: 冷卻結束時間 ms）
   * 防止車輛在地雷 AABB 內連續觸發碰撞造成卡住
   */
  private mineCollisionCooldowns = new Map<string, number>();

  /** 地雷命中回呼（由 useGameLoop 注入，用於觸發爆炸特效） */
  private mineHitCallback: ((position: Vector3) => void) | null = null;

  /** 地雷邊界檢查輪詢索引：每幀只查 1 個地雷，把射線開銷攤平到每幀 */
  private mineCheckIndex = 0;

  /** 設定地雷命中回呼 */
  onMineHit(cb: (position: Vector3) => void): void {
    this.mineHitCallback = cb;
  }

  /**
   * 設定地面高度（賽道表面 Y 座標）
   */
  setGroundLevel(y: number): void {
    this.groundY = y;
  }

  /**
   * 更新移動地雷的位置（等級 2/3 每幀呼叫）
   * isOnTrack raycasting 每幀只查 1 個地雷（輪流），消除週期性 CPU 尖峰
   */
  updateMines(
    deltaTime: number,
    obstacles: Obstacle[],
    isOnTrack?: (pos: Vector3) => boolean,
  ): void {
    const movingMines = obstacles.filter(
      (o) => o.type === "mine" && o.velocity && o.origin,
    );
    if (movingMines.length === 0) return;

    // 本幀負責 raycasting 的地雷索引（輪流，每幀只查 1 個）
    const checkIdx =
      isOnTrack != null ? this.mineCheckIndex % movingMines.length : -1;
    this.mineCheckIndex++;

    for (let i = 0; i < movingMines.length; i++) {
      const mine = movingMines[i]!;

      const prevX = mine.position.x;
      const prevZ = mine.position.z;

      mine.position.x += mine.velocity!.x * deltaTime;
      mine.position.z += mine.velocity!.z * deltaTime;

      let bounced = false;

      // 本幀輪到這個地雷：做 raycasting 跑道邊界檢查
      if (i === checkIdx && !isOnTrack!(mine.position)) {
        mine.velocity!.x = -mine.velocity!.x;
        mine.velocity!.z = -mine.velocity!.z;
        mine.position.x = prevX;
        mine.position.z = prevZ;
        bounced = true;
      }

      // moveRange 圓形備用邊界（純數學，每幀都跑無負擔）
      if (!bounced) {
        const dx = mine.position.x - mine.origin!.x;
        const dz = mine.position.z - mine.origin!.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist > (mine.moveRange ?? 25)) {
          mine.velocity!.x = -mine.velocity!.x;
          mine.velocity!.z = -mine.velocity!.z;
          const ratio = (mine.moveRange ?? 25) / dist;
          mine.position.x = mine.origin!.x + dx * ratio;
          mine.position.z = mine.origin!.z + dz * ratio;
        }
      }

      // 同步更新 AABB
      mine.boundingBox.min.x = mine.position.x - 1.25;
      mine.boundingBox.max.x = mine.position.x + 1.25;
      mine.boundingBox.min.z = mine.position.z - 1.25;
      mine.boundingBox.max.z = mine.position.z + 1.25;
    }
  }

  /**
   * 更新物理狀態
   * @param trackBounds 賽道可放置邊界（可選），用於限制車輛不超出賽道
   */
  update(
    deltaTime: number,
    car: RaceCar,
    input: InputState,
    obstacles: Obstacle[],
    trackBounds?: BoundingBox,
  ): void {
    this.applyInput(car, input, deltaTime);
    this.updateVelocity(car, deltaTime);

    // 碰撞偵測與反應在 updatePosition 之前執行：
    // 確保本幀設定的 velocity/speed 能立即影響位置更新，不需要硬移位
    const collisions = this.detectCollisions(car, obstacles);
    for (const collision of collisions) {
      this.resolveCollision(car, collision);
    }

    this.updatePosition(car, deltaTime);

    if (car.position.y < this.groundY) {
      car.position.y = this.groundY;
      car.velocity.y = 0;
    }

    if (trackBounds) {
      car.position.x = Math.max(
        trackBounds.min.x,
        Math.min(trackBounds.max.x, car.position.x),
      );
      car.position.z = Math.max(
        trackBounds.min.z,
        Math.min(trackBounds.max.z, car.position.z),
      );
    }

    // 檢查速度提升是否過期
    if (car.hasSpeedBoost && Date.now() > car.boostEndTime) {
      car.hasSpeedBoost = false;
      car.maxSpeed = car.maxSpeed / 1.5; // 恢復正常速度
    }
  }

  private readonly maxReverseSpeed = 8;

  /**
   * 應用玩家輸入
   */
  private applyInput(car: RaceCar, input: InputState, deltaTime: number): void {
    if (input.accelerate) {
      if (car.speed >= 0) {
        car.speed = Math.min(
          car.speed + car.acceleration * deltaTime,
          car.maxSpeed,
        );
      } else {
        car.speed = Math.min(car.speed + car.acceleration * 1.5 * deltaTime, 0);
      }
    }

    if (input.brake) {
      if (car.speed > 0) {
        car.speed = Math.max(car.speed - car.acceleration * 1.5 * deltaTime, 0);
      } else {
        car.speed = Math.max(
          car.speed - car.acceleration * deltaTime,
          -this.maxReverseSpeed,
        );
      }
    }

    if (!input.accelerate && !input.brake) {
      car.speed *= this.friction;
      if (Math.abs(car.speed) < 0.01) car.speed = 0;
    }

    const absSpeed = Math.abs(car.speed);
    if (absSpeed > 0.1) {
      if (input.turnLeft) {
        this.rotateCar(car, car.turnSpeed * deltaTime * Math.sign(car.speed));
      }
      if (input.turnRight) {
        this.rotateCar(car, -car.turnSpeed * deltaTime * Math.sign(car.speed));
      }
    }
  }

  /**
   * 旋轉賽車
   */
  private rotateCar(car: RaceCar, angle: number): void {
    // 使用四元數旋轉
    const halfAngle = angle / 2;
    const sinHalf = Math.sin(halfAngle);
    const cosHalf = Math.cos(halfAngle);

    // 繞 Y 軸旋轉
    const rotationQuat = {
      x: 0,
      y: sinHalf,
      z: 0,
      w: cosHalf,
    };

    // 四元數乘法
    const result = this.multiplyQuaternions(car.rotation, rotationQuat);
    car.rotation = result;
  }

  /**
   * 四元數乘法
   */
  private multiplyQuaternions(
    q1: { x: number; y: number; z: number; w: number },
    q2: { x: number; y: number; z: number; w: number },
  ) {
    return {
      x: q1.w * q2.x + q1.x * q2.w + q1.y * q2.z - q1.z * q2.y,
      y: q1.w * q2.y - q1.x * q2.z + q1.y * q2.w + q1.z * q2.x,
      z: q1.w * q2.z + q1.x * q2.y - q1.y * q2.x + q1.z * q2.w,
      w: q1.w * q2.w - q1.x * q2.x - q1.y * q2.y - q1.z * q2.z,
    };
  }

  /**
   * 更新速度
   */
  private updateVelocity(car: RaceCar, deltaTime: number): void {
    // 計算前進方向（基於四元數旋轉）
    const forward = this.getForwardVector(car.rotation);

    // 更新速度向量
    car.velocity.x = forward.x * car.speed;
    car.velocity.z = forward.z * car.speed;

    // 應用重力
    car.velocity.y += this.gravity * deltaTime;
  }

  /**
   * 從四元數獲取前進向量
   */
  private getForwardVector(rotation: {
    x: number;
    y: number;
    z: number;
    w: number;
  }): Vector3 {
    // 四元數旋轉向量 (0, 0, 1)
    const x = 2 * (rotation.x * rotation.z + rotation.w * rotation.y);
    const y = 2 * (rotation.y * rotation.z - rotation.w * rotation.x);
    const z = 1 - 2 * (rotation.x * rotation.x + rotation.y * rotation.y);

    return { x, y, z };
  }

  /**
   * 更新位置
   */
  private updatePosition(car: RaceCar, deltaTime: number): void {
    car.position.x += car.velocity.x * deltaTime;
    car.position.y += car.velocity.y * deltaTime;
    car.position.z += car.velocity.z * deltaTime;
  }

  /**
   * 檢測碰撞（AABB）
   */
  detectCollisions(car: RaceCar, obstacles: Obstacle[]): Collision[] {
    const collisions: Collision[] = [];
    const carBox = this.getCarBoundingBox(car);

    for (const obstacle of obstacles) {
      if (this.checkAABBCollision(carBox, obstacle.boundingBox)) {
        const normal = this.calculateCollisionNormal(
          car.position,
          obstacle.position,
        );
        collisions.push({
          type: obstacle.type,
          position: obstacle.position,
          normal,
          object: obstacle,
        });
      }
    }

    return collisions;
  }

  /**
   * 獲取賽車的 AABB 邊界框
   */
  private getCarBoundingBox(car: RaceCar): BoundingBox {
    const halfSize = { x: 1, y: 0.5, z: 2 }; // 賽車的半尺寸

    return {
      min: {
        x: car.position.x - halfSize.x,
        y: car.position.y - halfSize.y,
        z: car.position.z - halfSize.z,
      },
      max: {
        x: car.position.x + halfSize.x,
        y: car.position.y + halfSize.y,
        z: car.position.z + halfSize.z,
      },
    };
  }

  /**
   * AABB 碰撞檢測
   */
  private checkAABBCollision(box1: BoundingBox, box2: BoundingBox): boolean {
    return (
      box1.min.x <= box2.max.x &&
      box1.max.x >= box2.min.x &&
      box1.min.y <= box2.max.y &&
      box1.max.y >= box2.min.y &&
      box1.min.z <= box2.max.z &&
      box1.max.z >= box2.min.z
    );
  }

  /**
   * 計算碰撞法線
   */
  private calculateCollisionNormal(
    carPos: Vector3,
    obstaclePos: Vector3,
  ): Vector3 {
    const dx = carPos.x - obstaclePos.x;
    const dz = carPos.z - obstaclePos.z;
    const length = Math.sqrt(dx * dx + dz * dz);

    if (length === 0) {
      return { x: 0, y: 0, z: 1 };
    }

    return {
      x: dx / length,
      y: 0,
      z: dz / length,
    };
  }

  /**
   * 處理碰撞反應
   */
  resolveCollision(car: RaceCar, collision: Collision): void {
    if (collision.type === "wall") {
      // 牆壁碰撞：阻擋
      this.resolveWallCollision(car, collision);
    } else if (collision.type === "mine") {
      // 地雷碰撞：彈開
      this.resolveMineCollision(car, collision);
    }
  }

  /**
   * 處理牆壁碰撞（阻擋）
   */
  private resolveWallCollision(car: RaceCar, collision: Collision): void {
    // 將車輛推出碰撞區域
    const pushDistance = 0.5;
    car.position.x += collision.normal.x * pushDistance;
    car.position.z += collision.normal.z * pushDistance;

    // 減速
    car.speed *= 0.5;

    // 反彈速度
    const dotProduct =
      car.velocity.x * collision.normal.x + car.velocity.z * collision.normal.z;
    car.velocity.x -= 2 * dotProduct * collision.normal.x;
    car.velocity.z -= 2 * dotProduct * collision.normal.z;
  }

  /**
   * 處理地雷碰撞（彈開）
   */
  private resolveMineCollision(car: RaceCar, collision: Collision): void {
    // 冷卻檢查：防止車輛仍在 AABB 內時連續觸發（不需要硬位移，讓速度自然帶離）
    const obstacle = collision.object as { id?: string };
    const cooldownKey = `${car.id}_${obstacle?.id ?? "mine"}`;
    const now = Date.now();
    if ((this.mineCollisionCooldowns.get(cooldownKey) ?? 0) > now) return;
    this.mineCollisionCooldowns.set(cooldownKey, now + 1800);

    // 通知爆炸特效（回呼地雷的物理座標）
    this.mineHitCallback?.(collision.position);

    // 彈開速度
    const bounceSpeed = Math.max(Math.abs(car.speed) * 1.2, 9);
    car.velocity.x = collision.normal.x * bounceSpeed;
    car.velocity.z = collision.normal.z * bounceSpeed;
    car.velocity.y = 2;

    // 同步調整 car.speed（以車輛前進方向的投影量，讓後續幀的物理過渡自然）
    const forward = this.getForwardVector(car.rotation);
    const dot = forward.x * collision.normal.x + forward.z * collision.normal.z;
    car.speed = bounceSpeed * dot;
  }

  /**
   * 檢測加速帶碰撞
   */
  checkSpeedBoostCollision(
    car: RaceCar,
    boosts: SpeedBoost[],
  ): SpeedBoost | null {
    for (const boost of boosts) {
      if (!boost.active) continue;

      const dx = car.position.x - boost.position.x;
      const dz = car.position.z - boost.position.z;
      const distance = Math.sqrt(dx * dx + dz * dz);

      if (distance < boost.radius + 1) {
        // 1 是賽車的半徑
        return boost;
      }
    }
    return null;
  }

  /**
   * 應用速度提升
   */
  applySpeedBoost(car: RaceCar, duration: number = 3000): void {
    if (!car.hasSpeedBoost) {
      car.maxSpeed *= 1.8; // 速度提升 1.5 倍，持續 3 秒
      car.hasSpeedBoost = true;
    }
    car.boostEndTime = Date.now() + duration;
  }

  /**
   * 檢測賽車間碰撞
   */
  checkCarCollision(car1: RaceCar, car2: RaceCar): boolean {
    const box1 = this.getCarBoundingBox(car1);
    const box2 = this.getCarBoundingBox(car2);
    return this.checkAABBCollision(box1, box2);
  }

  /**
   * 處理賽車間碰撞（持續推擠 + 質量比衝量）
   *
   * 位置分離：每幀執行，防止視覺穿透
   * 衝量：帶冷卻（350ms），防止連續施加讓重車被打停
   * 最低速度保護：重車碰輕車後維持一定推擠速度，體現車重優勢
   *
   * 重車撞輕車 → 輕車被大幅推開，重車幾乎不減速（維持前進）
   * 輕車撞重車 → 輕車直接彈開，重車幾乎不動
   * 同重 → 雙方對稱彈開
   */
  resolveCarCollision(car1: RaceCar, car2: RaceCar): void {
    const w1 = car1.weight ?? 1.0;
    const w2 = car2.weight ?? 1.0;

    // ── 1. SAT 位置分離（每幀，防止穿透）────────────────────────
    const carHalfX = 1.0;
    const carHalfZ = 2.0;
    const dx = Math.abs(car1.position.x - car2.position.x);
    const dz = Math.abs(car1.position.z - car2.position.z);
    const overlapX = carHalfX * 2 - dx;
    const overlapZ = carHalfZ * 2 - dz;

    if (overlapX > 0 && overlapZ > 0) {
      // car2 越重 → car1 被推開越多；car1 越重 → 只需被推開一小部分
      const pushShare = w2 / (w1 + w2); // 重車 ~0.33、輕車 ~0.67
      if (overlapX < overlapZ) {
        car1.position.x +=
          Math.sign(car1.position.x - car2.position.x) * overlapX * pushShare;
      } else {
        car1.position.z +=
          Math.sign(car1.position.z - car2.position.z) * overlapZ * pushShare;
      }
    }

    // ── 2. 衝量（350ms 冷卻，防止重車每幀被打停）────────────────
    const cooldownKey = `car_${[car1.id, car2.id].sort().join("_")}`;
    const now = Date.now();
    if ((this.mineCollisionCooldowns.get(cooldownKey) ?? 0) > now) return;
    this.mineCollisionCooldowns.set(cooldownKey, now + 350);

    const normal = this.calculateCollisionNormal(car1.position, car2.position);
    const relVelX = car1.velocity.x - car2.velocity.x;
    const relVelZ = car1.velocity.z - car2.velocity.z;
    const relVelAlongNormal = relVelX * normal.x + relVelZ * normal.z;

    if (relVelAlongNormal >= 0) return;

    // 彈性係數依車重比決定：
    //   輕車撞重車 → weightRatio 大 → 高彈性（強力彈開）
    //   重車撞輕車 → weightRatio 小 → 低彈性（推擠感，不反彈）
    const weightRatio = w2 / w1;
    const restitution = Math.min(0.2 + weightRatio * 0.22, 0.78);

    const impulse =
      (-(1 + restitution) * relVelAlongNormal) / (1 / w1 + 1 / w2);
    const impulseFactor = impulse / w1;
    car1.velocity.x += impulseFactor * normal.x;
    car1.velocity.z += impulseFactor * normal.z;

    const forward = this.getForwardVector(car1.rotation);
    car1.speed = car1.velocity.x * forward.x + car1.velocity.z * forward.z;

    // ── 3. 重車最低推擠速度（讓車重優勢在單人測試中也能感受到）──
    // 重車 car1 碰輕車後，依質量差比例保留最低前進速度
    // 輕車 car1 無此保護（直接彈開或停止）
    const minRetainFraction = Math.max(0, (w1 - w2) / (w1 + w2));
    if (minRetainFraction > 0) {
      const minSpeed = car1.maxSpeed * minRetainFraction * 0.6;
      if (car1.speed < minSpeed) {
        car1.speed = minSpeed;
        car1.velocity.x = forward.x * car1.speed;
        car1.velocity.z = forward.z * car1.speed;
      }
    }
  }
}
