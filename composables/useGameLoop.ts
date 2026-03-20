/**
 * Game Loop Composable - 遊戲循環
 * 負責 60 FPS 渲染循環、整合遊戲狀態與渲染
 */

import { ref, onMounted, onUnmounted } from "vue";
import { GameRenderer } from "../utils/game-renderer";
import { PhysicsEngine } from "../utils/physics-engine";
import { InputHandler } from "../utils/input-handler";
import { RaceTrackGenerator } from "../utils/race-track-generator";
import { TrackCollisionSystem } from "../utils/track-collision";
import { LapTracker } from "../utils/score-calculator";
import type {
  RaceCar,
  RaceTrack,
  ControlType,
  InputState,
  GameDifficulty,
} from "../types/game";
import type { CarStats } from "../app/data/car-registry";

// ── 輔助函式 ──────────────────────────────────────────────────────

/** 從四元數取得前進向量（與 PhysicsEngine.getForwardVector 一致） */
function getForwardVector(q: { x: number; y: number; z: number; w: number }) {
  return {
    x: 2 * (q.x * q.z + q.w * q.y),
    y: 2 * (q.y * q.z - q.w * q.x),
    z: 1 - 2 * (q.x * q.x + q.y * q.y),
  };
}

/**
 * 以起跑位置和車頭四元數計算應繞行正向
 * 叉積 y 分量 = (startPos − center) × forward
 * > 0 → 逆時針(+1)，< 0 → 順時針(−1)
 */
function computeForwardDirection(
  startPos: { x: number; z: number },
  centerX: number,
  centerZ: number,
  rotation: { x: number; y: number; z: number; w: number },
): 1 | -1 {
  const rx = startPos.x - centerX;
  const rz = startPos.z - centerZ;
  const fwd = getForwardVector(rotation);
  const crossY = rx * fwd.z - rz * fwd.x;
  return crossY >= 0 ? 1 : -1;
}

/** 四元數球面插值（SLERP），t 為 [0,1] */
function quatSlerp(
  a: { x: number; y: number; z: number; w: number },
  b: { x: number; y: number; z: number; w: number },
  t: number,
) {
  let dot = a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w;
  // 確保最短路徑
  const bx = dot < 0 ? -b.x : b.x;
  const by = dot < 0 ? -b.y : b.y;
  const bz = dot < 0 ? -b.z : b.z;
  const bw = dot < 0 ? -b.w : b.w;
  dot = Math.abs(dot);

  if (dot > 0.9995) {
    // 幾乎相同，用線性插值避免除以零
    return {
      x: a.x + (bx - a.x) * t,
      y: a.y + (by - a.y) * t,
      z: a.z + (bz - a.z) * t,
      w: a.w + (bw - a.w) * t,
    };
  }
  const theta = Math.acos(dot);
  const sinTheta = Math.sin(theta);
  const wa = Math.sin((1 - t) * theta) / sinTheta;
  const wb = Math.sin(t * theta) / sinTheta;
  return {
    x: a.x * wa + bx * wb,
    y: a.y * wa + by * wb,
    z: a.z * wa + bz * wb,
    w: a.w * wa + bw * wb,
  };
}

/** 遠端車輛快照（用於 dead reckoning） */
type RemoteSnapshot = {
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number; w: number };
  speed: number;
  timestamp: number;
};

// ──────────────────────────────────────────────────────────────────

export function useGameLoop() {
  let renderer: GameRenderer | null = null;
  let physics: PhysicsEngine | null = null;
  let inputHandler: InputHandler | null = null;
  let trackGenerator: RaceTrackGenerator | null = null;
  let trackCollision: TrackCollisionSystem | null = null;
  let lapTracker: LapTracker | null = null;

  // 分數相關 reactive 資料（供 UI 使用）
  const laps = ref(0);
  const lapProgress = ref(0);
  const score = ref(0);

  const track = ref<RaceTrack | null>(null);
  const cars = ref<Map<string, RaceCar>>(new Map());
  const playerCarId = ref<string>("");

  const isRunning = ref(false);
  const inputLocked = ref(true); // 初始鎖定輸入
  const isRespawning = ref(false); // 空中跑道：重生動畫中
  const isWrongWay = ref(false); // 逆向警告
  const lastTime = ref(0);

  let animationFrameId: number | null = null;
  let networkSendFn: ((car: RaceCar) => void) | null = null;
  let networkInputSendFn: ((input: InputState) => void) | null = null;

  /** 遠端車輛最新快照，用於 dead reckoning */
  const remoteSnapshots = new Map<string, RemoteSnapshot>();

  // 是否為本隊車輛的物理權威（有 accelerate 控制的玩家）
  const isPhysicsAuthority = ref(true);
  // 所有隊友的輸入狀態（key = playerId），由物理權威合併使用
  // 純 Map，不需要 Vue 響應式，遊戲迴圈直接讀取即可
  const teammateInputs = new Map<string, Omit<InputState, "sequenceNumber">>();

  /**
   * 初始化遊戲
   */
  let itemSeed: number | undefined;
  let gameDifficulty: GameDifficulty = 1;
  let trackCenterX = 0;
  let trackCenterZ = 0;

  const initialize = async (
    container: HTMLElement,
    playerControls: ControlType[],
    carId: string,
    seed?: number,
    difficulty: GameDifficulty = 1,
  ) => {
    itemSeed = seed;
    gameDifficulty = difficulty;
    // 初始化渲染器
    renderer = new GameRenderer();
    renderer.initialize(container);
    renderer.applyEnvironment(difficulty);

    // 初始化物理引擎
    physics = new PhysicsEngine();

    // 初始化輸入處理器
    inputHandler = new InputHandler(playerControls);
    inputHandler.registerInputListeners();

    // 初始化賽道生成器
    trackGenerator = new RaceTrackGenerator();

    // 設定玩家車輛 ID
    playerCarId.value = carId;

    // 注意：不在此載入資源，由呼叫方依需求呼叫 loadTrackAssets() + loadCarsForTeams()
  };

  /**
   * 初始化爆炸特效回呼（載入賽道後呼叫）
   */
  const setupExplosionCallback = () => {
    if (!physics || !renderer) return;
    physics.onMineHit((pos) => {
      renderer!.spawnExplosion(pos);
    });
  };

  /**
   * 載入賽道（選車前呼叫）
   */
  const loadTrackAssets = async () => {
    if (!renderer || !trackGenerator || !physics) return;

    const skyMode = gameDifficulty === 5;
    const trackData = await renderer.loadTrack(
      "/blender/raceTrack.glb",
      skyMode,
    );

    track.value = trackGenerator.generateTrack(
      undefined,
      trackData.bounds,
      trackData.startPosition ?? undefined,
    );

    physics.setGroundLevel(track.value.bounds.min.y);
    if (skyMode) physics.enableSkyMode();

    // 取得碰撞 mesh
    const collisionMeshes = renderer.getTrackSurfaceMeshes();
    trackCollision = new TrackCollisionSystem(collisionMeshes);

    // 生成障礙物與加速帶（startPosition 用於排除起點附近的生成位置）
    const { mines, boosts } = trackGenerator.generateOnTrackItems(
      track.value!.playableBounds,
      (pos) => trackCollision!.isOnTrack(pos),
      { mineCount: 20, boostCount: 10 },
      itemSeed,
      track.value!.startPosition,
      gameDifficulty,
    );
    track.value!.obstacles = mines;
    track.value!.speedBoosts = boosts;

    const yOffset = 2.9;
    renderer.renderObstacles(track.value!.obstacles, yOffset);
    renderer.renderSpeedBoosts(track.value!.speedBoosts, yOffset);

    trackCenterX = (track.value!.bounds.min.x + track.value!.bounds.max.x) / 2;
    trackCenterZ = (track.value!.bounds.min.z + track.value!.bounds.max.z) / 2;
    lapTracker = new LapTracker(trackCenterX, trackCenterZ);

    // 爆炸特效回呼
    setupExplosionCallback();
  };

  /**
   * 載入所有玩家的車輛（選車完成後呼叫）
   * @param allPlayers 所有玩家列表（含自己與遠端）
   * @param getCarFile 根據 playerId 取得 GLB 路徑的函式（沒有選車時傳預設路徑）
   */
  const loadCarsForTeams = async (
    allPlayers: { id: string }[],
    getCarFile: (playerId: string) => string,
    getCarStats: (playerId: string) => CarStats,
  ) => {
    if (!renderer || !track.value) return;

    const defaultRotation = { x: 0, y: -0.6428, z: 0, w: 0.766 };

    for (let i = 0; i < allPlayers.length; i++) {
      const player = allPlayers[i]!;
      const carFile = getCarFile(player.id);
      const stats = getCarStats(player.id);
      await renderer.loadCar(player.id, carFile);

      const startPos = {
        x: track.value.startPosition.x + i * 4,
        y: track.value.startPosition.y,
        z: track.value.startPosition.z,
      };

      const car: RaceCar = {
        id: player.id,
        position: startPos,
        rotation: defaultRotation,
        velocity: { x: 0, y: 0, z: 0 },
        speed: 0,
        maxSpeed: stats.maxSpeed,
        acceleration: stats.acceleration,
        turnSpeed: stats.turnSpeed,
        weight: stats.weight,
        hasSpeedBoost: false,
        boostEndTime: 0,
        maxForwardDistance: 0,
        currentScore: 0,
      };
      cars.value.set(player.id, car);
    }

    // 為自己的車設定碰撞安全位置，並注入正向方向
    const ownCar = cars.value.get(playerCarId.value);
    if (ownCar && trackCollision) {
      trackCollision.setInitialSafePosition(ownCar.position);
    }
    if (ownCar && lapTracker) {
      const dir = computeForwardDirection(
        ownCar.position,
        trackCenterX,
        trackCenterZ,
        ownCar.rotation,
      );
      lapTracker.setForwardDirection(dir);
    }
  };

  /**
   * 載入遊戲資源（單人或不需要選車時呼叫）
   */
  const loadAssets = async () => {
    if (!renderer || !trackGenerator || !physics) return;

    try {
      await loadTrackAssets();

      // 載入自己的車（預設模型）
      await renderer.loadCar(playerCarId.value, "/blender/sportCar.glb");

      const defaultRotation = { x: 0, y: -0.6428, z: 0, w: 0.766 };
      const playerCar: RaceCar = {
        id: playerCarId.value,
        position: { ...track.value!.startPosition },
        rotation: defaultRotation,
        velocity: { x: 0, y: 0, z: 0 },
        speed: 0,
        maxSpeed: 30,
        acceleration: 14,
        turnSpeed: 2,
        weight: 1.0,
        hasSpeedBoost: false,
        boostEndTime: 0,
        maxForwardDistance: 0,
        currentScore: 0,
      };
      cars.value.set(playerCarId.value, playerCar);

      if (trackCollision) {
        trackCollision.setInitialSafePosition(playerCar.position);
      }
      if (lapTracker) {
        const dir = computeForwardDirection(
          playerCar.position,
          trackCenterX,
          trackCenterZ,
          playerCar.rotation,
        );
        lapTracker.setForwardDirection(dir);
      }
    } catch (error) {
      console.error("載入遊戲資源失敗:", error);
      throw error;
    }
  };

  /**
   * 解鎖輸入控制（倒數結束後呼叫）
   */
  const unlockInput = () => {
    inputLocked.value = false;
  };

  /**
   * 開始遊戲循環
   */
  const start = () => {
    if (isRunning.value) return;

    isRunning.value = true;
    lastTime.value = performance.now();
    gameLoop(lastTime.value);
  };

  /**
   * 停止遊戲循環
   */
  const stop = () => {
    isRunning.value = false;
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
  };

  /**
   * 遊戲主循環（60 FPS）
   */
  const gameLoop = (currentTime: number) => {
    if (!isRunning.value) return;

    const deltaTime = (currentTime - lastTime.value) / 1000; // 轉換為秒
    lastTime.value = currentTime;

    // 限制 delta time 避免大幅跳躍
    const clampedDelta = Math.min(deltaTime, 0.1);

    // 更新遊戲狀態
    update(clampedDelta);

    // 渲染（傳入 deltaTime 供爆炸特效更新）
    render(clampedDelta);

    // 請求下一幀
    animationFrameId = requestAnimationFrame(gameLoop);
  };

  /**
   * Dead reckoning：對所有非本地物理控制的車輛進行位置外推 + 平滑插值
   * 讓遠端車輛在兩次網路更新之間繼續平滑移動，而非原地等待
   */
  const applyDeadReckoning = (deltaTime: number, excludeCarId: string) => {
    const now = performance.now();
    // 使用 delta-time 基礎的 lerp，與 framerate 無關
    // k=8 代表約 125ms 收斂到目標位置
    const posLerp = 1 - Math.exp(-8 * deltaTime);
    const rotLerp = 1 - Math.exp(-12 * deltaTime);

    cars.value.forEach((car, carId) => {
      if (carId === excludeCarId) return;
      const snap = remoteSnapshots.get(carId);
      if (!snap) return;

      // 根據上次快照的速度和方向推算預測位置
      const age = (now - snap.timestamp) / 1000; // 秒
      const fwd = getForwardVector(snap.rotation);
      const predictedPos = {
        x: snap.position.x + fwd.x * snap.speed * age,
        y: snap.position.y,
        z: snap.position.z + fwd.z * snap.speed * age,
      };

      // 以預測位置為目標做插值（平滑，無跳格）
      car.position.x += (predictedPos.x - car.position.x) * posLerp;
      car.position.y += (predictedPos.y - car.position.y) * posLerp;
      car.position.z += (predictedPos.z - car.position.z) * posLerp;

      // 旋轉使用正確的 Quaternion SLERP
      const newRot = quatSlerp(car.rotation, snap.rotation, rotLerp);
      car.rotation.x = newRot.x;
      car.rotation.y = newRot.y;
      car.rotation.z = newRot.z;
      car.rotation.w = newRot.w;
    });
  };

  /**
   * 空中跑道：觸發重生
   * 鎖定輸入 → 傳送至最後安全位置 → 短暫無敵 → 解鎖
   */
  const triggerRespawn = (car: RaceCar, groundY: number) => {
    if (isRespawning.value) return;
    isRespawning.value = true;
    inputLocked.value = true;

    const safePos = trackCollision?.getLastSafePosition();
    if (safePos) {
      car.position.x = safePos.x;
      car.position.z = safePos.z;
    }
    // Y 直接用跑道表面高度，不用 safePos.y（避免偏差導致再次掉落）
    car.position.y = groundY;

    // 恢復掉落前在跑道上的車頭方向，不要保留掉落時轉向的方向
    const safeRot = trackCollision?.getLastSafeRotation();
    if (safeRot) {
      car.rotation.x = safeRot.x;
      car.rotation.y = safeRot.y;
      car.rotation.z = safeRot.z;
      car.rotation.w = safeRot.w;
    }

    car.velocity.x = 0;
    car.velocity.y = 0;
    car.velocity.z = 0;
    car.speed = 0;

    // 1.5 秒後解鎖（無敵時間）
    setTimeout(() => {
      isRespawning.value = false;
      inputLocked.value = false;
    }, 1500);
  };

  /**
   * 更新遊戲狀態
   */
  const update = (deltaTime: number) => {
    if (!physics || !inputHandler || !track.value) return;

    const playerCar = cars.value.get(playerCarId.value);
    if (!playerCar) return;

    const ownInput = inputLocked.value
      ? {
          accelerate: false,
          brake: false,
          turnLeft: false,
          turnRight: false,
          sequenceNumber: 0,
        }
      : inputHandler.getCurrentInputState();

    if (isPhysicsAuthority.value) {
      // 更新移動地雷（等級 2/3 才有速度，等級 1 無操作）
      if (gameDifficulty > 1) {
        physics.updateMines(
          deltaTime,
          track.value.obstacles,
          (pos) => trackCollision?.isOnTrack(pos) ?? true,
        );
        renderer?.updateObstacleMeshes(track.value.obstacles);
      }

      // 合併所有隊友輸入（支援多人共控，如 6 人每隊 3 人）
      const mergedInput: InputState = { ...ownInput };
      teammateInputs.forEach((input) => {
        mergedInput.accelerate = mergedInput.accelerate || input.accelerate;
        mergedInput.brake = mergedInput.brake || input.brake;
        mergedInput.turnLeft = mergedInput.turnLeft || input.turnLeft;
        mergedInput.turnRight = mergedInput.turnRight || input.turnRight;
      });

      physics.update(
        deltaTime,
        playerCar,
        mergedInput,
        track.value.obstacles,
        track.value.playableBounds,
      );

      // 賽道圍牆碰撞偵測（難度 5 改為掉落偵測）
      if (gameDifficulty === 5 && track.value) {
        const groundY = track.value.bounds.min.y;
        const fallThresholdY = groundY - 80;

        if (isRespawning.value) {
          // 重生中：強制鎖住 Y 軸，防止重生後立刻再次下墜
          playerCar.position.y = groundY;
          playerCar.velocity.y = 0;
        } else {
          const fallState = trackCollision?.applyFallDetection(
            playerCar,
            fallThresholdY,
            groundY,
          );
          if (fallState === "fallen") {
            triggerRespawn(playerCar, groundY);
          } else if (fallState === "safe") {
            // 在跑道上：每幀把 Y 鎖回跑道表面，防止重力慢慢把車拉下去
            playerCar.position.y = groundY;
            playerCar.velocity.y = 0;
          }
          // fallState === 'falling'：車已離開邊緣，讓重力自然累積直到 fallen
        }
      } else {
        trackCollision?.applyWallCollision(playerCar);
      }

      // 車輛間碰撞偵測
      cars.value.forEach((remoteCar, remoteId) => {
        if (
          remoteId !== playerCarId.value &&
          physics!.checkCarCollision(playerCar, remoteCar)
        ) {
          physics!.resolveCarCollision(playerCar, remoteCar);
        }
      });

      // 對手車輛 dead reckoning（物理權威也要平滑顯示對手）
      applyDeadReckoning(deltaTime, playerCarId.value);

      // 更新圈數追蹤
      lapTracker?.update(playerCar.position.x, playerCar.position.z);
      const newLaps = lapTracker?.getLaps() ?? 0;
      const newProgress = lapTracker?.getLapProgress() ?? 0;
      const newScore = lapTracker?.getScore() ?? 0;
      if (newLaps !== laps.value) laps.value = newLaps;
      if (newProgress !== lapProgress.value) lapProgress.value = newProgress;
      if (newScore !== score.value) score.value = newScore;
      playerCar.currentScore = newScore;

      // 逆向偵測
      const wrongWay = lapTracker?.isWrongWay() ?? false;
      if (wrongWay !== isWrongWay.value) isWrongWay.value = wrongWay;

      // 檢查加速帶碰撞
      const boost = physics.checkSpeedBoostCollision(
        playerCar,
        track.value.speedBoosts,
      );
      if (boost && boost.active) {
        physics.applySpeedBoost(playerCar);
        boost.active = false;
        setTimeout(() => {
          boost.active = true;
        }, 3000);
      }

      // 發送車輛狀態到網路
      networkSendFn?.(playerCar);
    } else {
      // 非物理權威：發送輸入給隊友（隊友合併後執行物理）
      networkInputSendFn?.(ownInput);

      // 非物理權威也本地計算地雷移動（確定性，seed 相同結果一致）
      if (gameDifficulty > 1) {
        physics.updateMines(
          deltaTime,
          track.value.obstacles,
          (pos) => trackCollision?.isOnTrack(pos) ?? true,
        );
        renderer?.updateObstacleMeshes(track.value.obstacles);
      }

      // 本玩家車輛與所有遠端車輛都套用 dead reckoning
      applyDeadReckoning(deltaTime, "");

      // 根據從網路接收到的車輛位置更新圈數追蹤
      lapTracker?.update(playerCar.position.x, playerCar.position.z);
      const newLapsB = lapTracker?.getLaps() ?? 0;
      const newProgressB = lapTracker?.getLapProgress() ?? 0;
      const newScoreB = lapTracker?.getScore() ?? 0;
      if (newLapsB !== laps.value) laps.value = newLapsB;
      if (newProgressB !== lapProgress.value) lapProgress.value = newProgressB;
      if (newScoreB !== score.value) score.value = newScoreB;

      // 逆向偵測（非物理權威玩家同樣需要）
      const wrongWayB = lapTracker?.isWrongWay() ?? false;
      if (wrongWayB !== isWrongWay.value) isWrongWay.value = wrongWayB;
    }
  };

  /**
   * 渲染遊戲畫面
   */
  const render = (deltaTime: number = 0) => {
    if (!renderer) return;

    const playerCar = cars.value.get(playerCarId.value);
    if (!playerCar) return;

    // 更新所有車輛渲染（本地 + 遠端）
    cars.value.forEach((car, carId) => {
      renderer!.updateCar(carId, car);
    });

    // 更新爆炸特效
    renderer.updateExplosions(deltaTime);

    // 更新相機跟隨
    renderer.updateCamera(playerCar);

    // 渲染場景（傳入速度比例以驅動風切特效）
    const speedRatio = Math.min(
      Math.abs(playerCar.speed) / playerCar.maxSpeed,
      1,
    );
    renderer.render(speedRatio);
  };

  /**
   * 添加其他車輛
   */
  const addCar = async (
    carId: string,
    initialPosition: { x: number; y: number; z: number },
  ) => {
    if (!renderer) return;

    // 載入車輛模型
    await renderer.loadCar(carId, "/blender/sportCar.glb");

    // 初始化車輛數據
    const car: RaceCar = {
      id: carId,
      position: initialPosition,
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      velocity: { x: 0, y: 0, z: 0 },
      speed: 0,
      maxSpeed: 20,
      acceleration: 10,
      turnSpeed: 2,
      weight: 1.0,
      hasSpeedBoost: false,
      boostEndTime: 0,
      maxForwardDistance: 0,
      currentScore: 0,
    };

    cars.value.set(carId, car);
  };

  /**
   * 更新其他車輛狀態（來自網路同步）
   * 改為儲存快照，實際插值在 update() 的 dead reckoning 步驟中完成
   */
  const updateCarState = (carId: string, carState: Partial<RaceCar>) => {
    const car = cars.value.get(carId);
    if (!car) return;

    // 儲存帶時間戳的快照供 dead reckoning 使用
    if (carState.position && carState.rotation) {
      remoteSnapshots.set(carId, {
        position: { ...carState.position },
        rotation: { ...carState.rotation },
        speed: carState.speed ?? car.speed,
        timestamp: performance.now(),
      });
    }

    if (carState.speed !== undefined) car.speed = carState.speed;
    if (carState.currentScore !== undefined)
      car.currentScore = carState.currentScore;
  };

  /**
   * 設定網路狀態發送 callback（遊戲開始後由 game.vue 注入）
   */
  const setNetworkSend = (fn: ((car: RaceCar) => void) | null): void => {
    networkSendFn = fn;
  };

  /**
   * 設定網路輸入發送 callback（非物理權威玩家使用）
   */
  const setNetworkInputSend = (
    fn: ((input: InputState) => void) | null,
  ): void => {
    networkInputSendFn = fn;
  };

  /**
   * 設定是否為本隊物理權威
   */
  const setPhysicsAuthority = (auth: boolean): void => {
    isPhysicsAuthority.value = auth;
  };

  /**
   * 更新指定隊友的輸入狀態（由物理權威接收後合併使用）
   * @param playerId 發送輸入的隊友 playerId
   */
  const setTeammateInput = (
    playerId: string,
    input: Omit<InputState, "sequenceNumber">,
  ): void => {
    teammateInputs.set(playerId, input);
  };

  /**
   * 虛擬按鈕觸發輸入（行動裝置用）
   */
  const pressControl = (type: ControlType, pressed: boolean): void => {
    inputHandler?.handleInput({ type, pressed, timestamp: Date.now() });
  };

  /**
   * 設定車輛顏色（載入後呼叫）
   */
  const setCarColor = (carId: string, color: number): void => {
    renderer?.setCarColor(carId, color);
  };

  /**
   * 清理資源
   */
  const dispose = () => {
    stop();

    if (renderer) {
      renderer.dispose();
      renderer = null;
    }

    if (inputHandler) {
      inputHandler.dispose();
      inputHandler = null;
    }

    cars.value.clear();
    teammateInputs.clear();
    remoteSnapshots.clear();
  };

  onUnmounted(() => {
    dispose();
  });

  return {
    initialize,
    loadTrackAssets,
    loadCarsForTeams,
    start,
    stop,
    unlockInput,
    addCar,
    updateCarState,
    setNetworkSend,
    setNetworkInputSend,
    setPhysicsAuthority,
    setTeammateInput,
    pressControl,
    setCarColor,
    dispose,
    isRunning,
    isRespawning,
    isWrongWay,
    track,
    cars,
    playerCarId,
    laps,
    lapProgress,
    score,
  };
}
