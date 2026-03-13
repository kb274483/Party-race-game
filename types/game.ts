/**
 * 遊戲相關型別定義
 */

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface Quaternion {
  x: number;
  y: number;
  z: number;
  w: number;
}

export interface BoundingBox {
  min: Vector3;
  max: Vector3;
}

export enum GamePhase {
  WAITING = "waiting",
  CAR_SELECTION = "car_selection",
  COUNTDOWN = "countdown",
  RACING = "racing",
  FINISHED = "finished",
}

export enum ControlType {
  ACCELERATE = "accelerate",
  BRAKE = "brake",
  TURN_LEFT = "turn_left",
  TURN_RIGHT = "turn_right",
}

export interface RaceCar {
  id: string;
  position: Vector3;
  rotation: Quaternion;
  velocity: Vector3;
  speed: number;
  maxSpeed: number;
  acceleration: number;
  turnSpeed: number;
  weight: number; // 車重，影響車對車碰撞（輕量 ~0.75、標準 1.0、重型 ~1.5）
  hasSpeedBoost: boolean;
  boostEndTime: number;
  // 計分相關
  maxForwardDistance: number; // 歷史最遠前進距離
  currentScore: number; // 當前分數
}

export type GameDifficulty = 1 | 2 | 3;

export interface Obstacle {
  id: string;
  type: "wall" | "mine";
  position: Vector3;
  size: Vector3;
  boundingBox: BoundingBox;
  /** 地雷移動速度向量（等級 2/3 才有值） */
  velocity?: Vector3;
  /** 地雷移動範圍半徑（以初始位置為中心） */
  moveRange?: number;
  /** 初始位置（供移動範圍限制使用） */
  origin?: Vector3;
}

export interface SpeedBoost {
  id: string;
  position: Vector3;
  radius: number;
  active: boolean;
}

export interface RaceTrack {
  id: string;
  startPosition: Vector3;
  /** 賽道模型整體邊界 */
  bounds: BoundingBox;
  /**
   * 跑道可放置區域（障礙物、加速帶僅能在此範圍內生成）
   * 必須為 bounds 的子集，代表賽車可行駛的跑道表面
   */
  playableBounds: BoundingBox;
  obstacles: Obstacle[];
  speedBoosts: SpeedBoost[];
}

export interface Team {
  id: number;
  playerIds: string[];
  carId: string;
  score: number;
}

export interface ControlAssignment {
  playerId: string;
  teamId: number;
  controls: ControlType[];
}

export interface GameState {
  gameId: string;
  roomId: string;
  timestamp: number;
  sequenceNumber: number;
  phase: GamePhase;
  countdownTime: number;
  raceTime: number;
  track: RaceTrack;
  cars: Map<string, RaceCar>;
  teams: Map<number, Team>;
  controlAssignments: Map<string, ControlAssignment>;
  scores: Map<number, number>;
}

export interface InputState {
  accelerate: boolean;
  brake: boolean;
  turnLeft: boolean;
  turnRight: boolean;
  sequenceNumber: number;
}

export interface InputEvent {
  type: ControlType;
  pressed: boolean;
  timestamp: number;
}

export interface Collision {
  type: "wall" | "mine" | "car" | "boost";
  position: Vector3;
  normal: Vector3;
  object: any;
}

export interface WinnerInfo {
  winnerTeamId: number | null;
  scores: Map<number, number>;
  isSinglePlayer: boolean;
}

export interface UIState {
  remainingTime: number;
  teamScores: Map<number, number>;
  playerControls: Map<string, ControlType[]>;
  teamRoster: Map<number, PlayerInfo[]>;
}

export interface PlayerInfo {
  id: string;
  name: string;
  isHost: boolean;
}
