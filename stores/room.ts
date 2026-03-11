/**
 * 房間管理 Store
 * 負責管理房間狀態、建立房間、加入房間、離開房間和玩家列表管理
 */

import { defineStore } from "pinia";
import type { RoomInfo } from "../types/room";
import type { PlayerInfo } from "../types/game";

function getApiBase(): string {
  if (typeof window === "undefined") return "http://localhost:8080";
  const host = window.location.hostname;
  return `http://${host}:8080`;
}

/** 後端 API 回傳的房間格式（players 為 object） */
export interface RoomApiResponse {
  id: string;
  hostId: string;
  players: Record<
    string,
    { id: string; name: string; isHost: boolean; joinedAt: string }
  >;
  maxPlayers: number;
  password?: string;
}

/** 將後端 API 回傳格式轉換為 RoomInfo（匯出供其他模組使用） */
export function normalizeRoomResponse(res: RoomApiResponse): RoomInfo {
  const players: PlayerInfo[] = Object.values(res.players).map((p) => ({
    id: p.id,
    name: p.name,
    isHost: p.isHost,
  }));
  return {
    roomId: res.id,
    hostId: res.hostId,
    players,
    isPasswordProtected: !!(res.password && res.password.length > 0),
    maxPlayers: res.maxPlayers,
  };
}

interface RoomState {
  currentRoom: RoomInfo | null;
  currentPlayerId: string | null;
  currentPlayerName: string | null;
  isLoading: boolean;
  error: string | null;
}

export const useRoomStore = defineStore("room", {
  state: (): RoomState => ({
    currentRoom: null,
    currentPlayerId: null,
    currentPlayerName: null,
    isLoading: false,
    error: null,
  }),

  getters: {
    /**
     * 是否在房間中
     */
    isInRoom: (state): boolean => state.currentRoom !== null,

    /**
     * 是否為房主
     */
    isHost: (state): boolean => {
      if (!state.currentRoom || !state.currentPlayerId) return false;
      return state.currentRoom.hostId === state.currentPlayerId;
    },

    /**
     * 當前玩家資訊
     */
    currentPlayer: (state): PlayerInfo | null => {
      if (!state.currentRoom || !state.currentPlayerId) return null;
      return (
        state.currentRoom.players.find(
          (p: PlayerInfo) => p.id === state.currentPlayerId,
        ) || null
      );
    },

    /**
     * 玩家列表
     */
    players: (state): PlayerInfo[] => {
      return state.currentRoom?.players || [];
    },

    /**
     * 玩家數量
     */
    playerCount: (state): number => {
      return state.currentRoom?.players.length || 0;
    },

    /**
     * 房間是否已滿
     */
    isRoomFull: (state): boolean => {
      if (!state.currentRoom) return false;
      return state.currentRoom.players.length >= state.currentRoom.maxPlayers;
    },
  },

  actions: {
    /**
     * 建立房間
     * @param password 可選的房間密碼
     * @param playerName 玩家名稱
     * @returns 房間資訊
     */
    async createRoom(playerName: string, password?: string): Promise<RoomInfo> {
      this.isLoading = true;
      this.error = null;

      try {
        // 生成玩家 ID
        const playerId = this.generatePlayerId();

        // 準備請求資料
        const requestData = {
          hostId: playerId,
          hostName: playerName,
          password: password || "",
        };

        // 呼叫後端 API
        const response = await $fetch<RoomApiResponse>(
          `${getApiBase()}/api/rooms`,
          {
            method: "POST",
            body: requestData,
          },
        );

        // 更新狀態（轉換 API 格式）
        this.currentRoom = normalizeRoomResponse(response);
        this.currentPlayerId = playerId;
        this.currentPlayerName = playerName;

        return this.currentRoom!;
      } catch (err: any) {
        this.error = err?.data?.error || err.message || "建立房間失敗";
        throw err;
      } finally {
        this.isLoading = false;
      }
    },

    /**
     * 加入房間
     * @param roomId 房間 ID
     * @param playerName 玩家名稱
     * @param password 可選的房間密碼
     */
    async joinRoom(
      roomId: string,
      playerName: string,
      password?: string,
    ): Promise<void> {
      this.isLoading = true;
      this.error = null;

      try {
        // 生成玩家 ID
        const playerId = this.generatePlayerId();

        // 準備請求資料
        const requestData = {
          playerId,
          playerName,
          password: password || "",
        };

        // 呼叫後端 API 加入房間
        await $fetch(`${getApiBase()}/api/rooms/${roomId}/join`, {
          method: "POST",
          body: requestData,
        });

        // 獲取房間資訊
        const response = await $fetch<RoomApiResponse>(
          `${getApiBase()}/api/rooms/${roomId}`,
          {
            method: "GET",
          },
        );

        // 更新狀態（轉換 API 格式）
        this.currentRoom = normalizeRoomResponse(response);
        this.currentPlayerId = playerId;
        this.currentPlayerName = playerName;
      } catch (err: any) {
        this.error = err?.data?.error || err.message || "加入房間失敗";
        throw err;
      } finally {
        this.isLoading = false;
      }
    },

    /**
     * 離開房間
     */
    async leaveRoom(): Promise<void> {
      if (!this.currentRoom || !this.currentPlayerId) {
        throw new Error("未在房間中");
      }

      this.isLoading = true;
      this.error = null;

      try {
        const roomId = this.currentRoom.roomId;
        const playerId = this.currentPlayerId;

        // 呼叫後端 API
        await $fetch(`${getApiBase()}/api/rooms/${roomId}/leave`, {
          method: "DELETE",
          body: {
            playerId,
          },
        });

        // 清除狀態
        this.clearRoom();
      } catch (err: any) {
        this.error = err?.data?.error || err.message || "離開房間失敗";
        throw err;
      } finally {
        this.isLoading = false;
      }
    },

    /**
     * 更新房間資訊（用於接收 WebRTC 同步的房間狀態）
     * @param roomInfo 房間資訊
     */
    updateRoomInfo(roomInfo: RoomInfo): void {
      this.currentRoom = roomInfo;
    },

    /**
     * 從後端 API 格式更新房間（用於 WebSocket player_joined 等）
     */
    updateRoomFromApiResponse(
      res: RoomApiResponse | Record<string, unknown>,
    ): void {
      const r = res as RoomApiResponse;
      if (r?.id && r?.hostId && r?.players) {
        this.currentRoom = normalizeRoomResponse(r);
      }
    },

    /**
     * 新增玩家到房間
     * @param player 玩家資訊
     */
    addPlayer(player: PlayerInfo): void {
      if (!this.currentRoom) return;

      // 檢查玩家是否已存在
      const existingIndex = this.currentRoom.players.findIndex(
        (p: PlayerInfo) => p.id === player.id,
      );
      if (existingIndex === -1) {
        this.currentRoom.players.push(player);
      }
    },

    /**
     * 從房間移除玩家
     * @param playerId 玩家 ID
     */
    removePlayer(playerId: string): void {
      if (!this.currentRoom) return;

      const index = this.currentRoom.players.findIndex(
        (p: PlayerInfo) => p.id === playerId,
      );
      if (index !== -1) {
        this.currentRoom.players.splice(index, 1);
      }

      // 如果移除的是房主，清除房間
      if (playerId === this.currentRoom.hostId) {
        this.clearRoom();
      }
    },

    /**
     * 清除房間狀態
     */
    clearRoom(): void {
      this.currentRoom = null;
      this.currentPlayerId = null;
      this.currentPlayerName = null;
      this.error = null;
    },

    /**
     * 生成唯一的玩家 ID
     * @returns 玩家 ID
     */
    generatePlayerId(): string {
      return `player_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    },

    /**
     * 設定錯誤訊息
     * @param error 錯誤訊息
     */
    setError(error: string): void {
      this.error = error;
    },

    /**
     * 清除錯誤訊息
     */
    clearError(): void {
      this.error = null;
    },
  },
});
