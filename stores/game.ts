/**
 * 遊戲狀態 Store
 * 管理遊戲階段：載入、倒數、比賽中、結束
 */

import { defineStore } from "pinia";
import { GamePhase } from "../types/game";
import { ControlAllocator } from "../utils/control-allocator";
import type {
  ControlAssignment,
  PlayerInfo,
  GameDifficulty,
} from "../types/game";

interface GameState {
  phase: GamePhase;
  countdownTime: number;
  raceTime: number;
  controlAssignments: ControlAssignment[];
  gamePlayers: PlayerInfo[];
  trackLoaded: boolean;
  carLoaded: boolean;
  error: string | null;
  /** 各隊選擇的車輛 ID，key 為 teamId */
  selectedCars: Record<number, string>;
  /** 各隊是否已確認選車，key 為 teamId */
  carConfirmed: Record<number, boolean>;
  /** 各隊選車代表的 playerId（每隊第一個人負責選）*/
  selectorPlayerIds: Record<number, string>;
  /** 遊戲難度等級（1=靜止地雷、2=慢速移動、3=快速移動） */
  difficulty: GameDifficulty;
}
const GAME_TIME = 120;
export const useGameStore = defineStore("game", {
  state: (): GameState => ({
    phase: GamePhase.WAITING,
    countdownTime: 10,
    raceTime: GAME_TIME,
    controlAssignments: [],
    gamePlayers: [],
    trackLoaded: false,
    carLoaded: false,
    error: null,
    selectedCars: {},
    carConfirmed: {},
    selectorPlayerIds: {},
    difficulty: 1,
  }),

  getters: {
    isLoaded: (state): boolean => state.trackLoaded && state.carLoaded,
    isCarSelection: (state): boolean => state.phase === GamePhase.CAR_SELECTION,
    isCountdown: (state): boolean => state.phase === GamePhase.COUNTDOWN,
    isRacing: (state): boolean => state.phase === GamePhase.RACING,
    isFinished: (state): boolean => state.phase === GamePhase.FINISHED,
    /** 所有隊伍都已確認選車 */
    allTeamsConfirmed(): boolean {
      const teamIds = [
        ...new Set(
          this.controlAssignments.map((a: ControlAssignment) => a.teamId),
        ),
      ];
      if (teamIds.length === 0) return false;
      return teamIds.every((id) => this.carConfirmed[id] === true);
    },
  },

  actions: {
    /** 開始遊戲：分配控制、進入載入階段 */
    startGame(players: PlayerInfo[]): void {
      const allocator = new ControlAllocator();
      // 房主永遠排第一，確保兩端 allocateControls 結果完全一致
      const sorted = [...players].sort((a, b) =>
        a.isHost ? -1 : b.isHost ? 1 : 0,
      );
      this.gamePlayers = sorted;
      this.controlAssignments = allocator.allocateControls(
        sorted.map((p) => p.id),
      );
      this.phase = GamePhase.WAITING;
      this.trackLoaded = false;
      this.carLoaded = false;
      this.countdownTime = 10;
      this.raceTime = GAME_TIME;
      this.error = null;
    },

    /** 進入選車階段：計算各隊選車代表，重置選車狀態 */
    enterCarSelection(): void {
      const teamIds = [
        ...new Set(this.controlAssignments.map((a) => a.teamId)),
      ];
      const selectors: Record<number, string> = {};
      for (const teamId of teamIds) {
        // 每隊第一個 assignment 的玩家為選車代表
        const first = this.controlAssignments.find((a) => a.teamId === teamId);
        if (first) selectors[teamId] = first.playerId;
      }
      this.selectorPlayerIds = selectors;
      this.selectedCars = {};
      this.carConfirmed = {};
      this.phase = GamePhase.CAR_SELECTION;
    },

    /** 設定某隊的選車結果並標記已確認 */
    confirmCar(teamId: number, carId: string): void {
      this.selectedCars = { ...this.selectedCars, [teamId]: carId };
      this.carConfirmed = { ...this.carConfirmed, [teamId]: true };
    },

    /** 賽道載入完成 */
    setTrackLoaded(): void {
      this.trackLoaded = true;
    },

    /** 車輛載入完成 */
    setCarLoaded(): void {
      this.carLoaded = true;
    },

    /** 載入完成，進入倒數階段 */
    startCountdown(): void {
      this.phase = GamePhase.COUNTDOWN;
      this.countdownTime = 10;
    },

    /** 更新倒數秒數 */
    setCountdownTime(seconds: number): void {
      this.countdownTime = seconds;
    },

    /** 倒數結束，開始比賽 */
    startRacing(): void {
      this.phase = GamePhase.RACING;
      this.raceTime = GAME_TIME;
    },

    /** 更新比賽剩餘時間 */
    setRaceTime(seconds: number): void {
      this.raceTime = seconds;
    },

    /** 比賽結束 */
    finishGame(): void {
      this.phase = GamePhase.FINISHED;
    },

    /** 設定難度 */
    setDifficulty(level: GameDifficulty): void {
      this.difficulty = level;
    },

    /** 設定錯誤 */
    setError(message: string | null): void {
      this.error = message;
    },

    /** 重置遊戲狀態（返回房間用） */
    reset(): void {
      this.phase = GamePhase.WAITING;
      this.countdownTime = 10;
      this.raceTime = GAME_TIME;
      this.controlAssignments = [];
      this.gamePlayers = [];
      this.trackLoaded = false;
      this.carLoaded = false;
      this.error = null;
      this.selectedCars = {};
      this.carConfirmed = {};
      this.selectorPlayerIds = {};
      // difficulty 保留上次設定，不重置
    },
  },
});
