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
  const lastTime = ref(0);
  const targetFPS = 60;
  const targetFrameTime = 1000 / targetFPS;

  let animationFrameId: number | null = null;
  let networkSendFn: ((car: RaceCar) => void) | null = null;
  let networkInputSendFn: ((input: InputState) => void) | null = null;

  /** 遠端車輛最新快照，用於 dead reckoning */
  const remoteSnapshots = new Map<string, RemoteSnapshot>();

  // 是否為本隊車輛的物理權威（有 accelerate 控制的玩家）
  const isPhysicsAuthority = ref(true);
  // 所有隊友的輸入狀態（key = playerId），由物理權威合併使用
  const teammateInputs = ref<Map<string, Omit<InputState, "sequenceNumber">>>(
    new Map(),
  );

  /**
   * 初始化遊戲
   */
  let itemSeed: number | undefined;

  const initialize = async (
    container: HTMLElement,
    playerControls: ControlType[],
    carId: string,
    seed?: number,
  ) => {
    itemSeed = seed;
    // 初始化渲染器
    renderer = new GameRenderer();
    renderer.initialize(container);

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

    const trackData = await renderer.loadTrack("/blender/raceTrack.glb");

    track.value = trackGenerator.generateTrack(
      undefined,
      trackData.bounds,
      trackData.startPosition ?? undefined,
    );

    physics.setGroundLevel(track.value.bounds.min.y);

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
    );
    track.value!.obstacles = mines;
    track.value!.speedBoosts = boosts;

    const yOffset = 2.9;
    renderer.renderObstacles(track.value!.obstacles, yOffset);
    renderer.renderSpeedBoosts(track.value!.speedBoosts, yOffset);

    const centerX = (track.value!.bounds.min.x + track.value!.bounds.max.x) / 2;
    const centerZ = (track.value!.bounds.min.z + track.value!.bounds.max.z) / 2;
    lapTracker = new LapTracker(centerX, centerZ);

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

    // 為自己的車設定碰撞安全位置
    const ownCar = cars.value.get(playerCarId.value);
    if (ownCar && trackCollision) {
      trackCollision.setInitialSafePosition(ownCar.position);
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
      // 合併所有隊友輸入（支援多人共控，如 6 人每隊 3 人）
      const mergedInput: InputState = { ...ownInput };
      teammateInputs.value.forEach((input) => {
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

      // 賽道圍牆碰撞偵測
      trackCollision?.applyWallCollision(playerCar);

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
      laps.value = lapTracker?.getLaps() ?? 0;
      lapProgress.value = lapTracker?.getLapProgress() ?? 0;
      score.value = lapTracker?.getScore() ?? 0;
      playerCar.currentScore = score.value;

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

      // 本玩家車輛與所有遠端車輛都套用 dead reckoning
      applyDeadReckoning(deltaTime, "");

      // 根據從網路接收到的車輛位置更新圈數追蹤
      lapTracker?.update(playerCar.position.x, playerCar.position.z);
      laps.value = lapTracker?.getLaps() ?? 0;
      lapProgress.value = lapTracker?.getLapProgress() ?? 0;
      score.value = lapTracker?.getScore() ?? 0;
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
    const next = new Map(teammateInputs.value);
    next.set(playerId, input);
    teammateInputs.value = next;
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
    teammateInputs.value.clear();
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
    track,
    cars,
    playerCarId,
    laps,
    lapProgress,
    score,
  };
}
