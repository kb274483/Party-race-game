/**
 * useRoomWebRTC
 * 房間頁面的信令整合，透過 WebSocket 處理房間事件
 */

import { ref, onUnmounted } from "vue";
import { SignalingClient } from "../utils/signaling-client";
import type { PlayerInfo } from "../types/game";

function getSignalingWsUrl(): string {
  if (typeof window === "undefined") return "ws://localhost:8080/ws";
  const host = window.location.hostname;
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  return `${protocol}://${host}:8080/ws`;
}

export function useRoomWebRTC() {
  const client = ref<SignalingClient | null>(null);
  const isInitialized = ref(false);
  let currentRoomId = "";

  /**
   * 連線到信令伺服器並監聽房間事件
   */
  const initialize = async (
    playerId: string,
    roomId: string,
    _isHost: boolean,
    _hostId: string,
    callbacks?: {
      onRoomClosed?: () => void;
      onPlayerLeft?: (playerId: string) => void;
      onPlayerJoined?: (payload: {
        playerId: string;
        playerName: string;
        room?: any;
      }) => void;
      onGameStarted?: (payload: { players: PlayerInfo[] }) => void;
    },
  ): Promise<void> => {
    if (client.value) {
      client.value.disconnect();
      client.value = null;
    }

    currentRoomId = roomId;
    const sc = new SignalingClient({
      serverUrl: getSignalingWsUrl(),
      playerId,
      roomId,
    });

    sc.onSignalReceived((signal) => {
      switch (signal.type) {
        case "player_joined":
          callbacks?.onPlayerJoined?.(signal.payload as any);
          break;
        case "player_left":
        case "player_disconnect":
          callbacks?.onPlayerLeft?.(
            (signal.payload as any)?.playerId ?? signal.senderId,
          );
          break;
        case "room_closed":
          callbacks?.onRoomClosed?.();
          break;
        case "game_started": {
          const players = (signal.payload as any)?.players ?? [];
          callbacks?.onGameStarted?.({ players });
          break;
        }
      }
    });

    client.value = sc;
    await sc.connect();
    isInitialized.value = true;
  };

  /**
   * 斷開連線（離開房間時呼叫）
   */
  const cleanup = (): void => {
    client.value?.disconnect();
    client.value = null;
    isInitialized.value = false;
  };

  /**
   * 廣播遊戲開始訊號（僅 Host 呼叫）
   */
  const broadcastGameStarted = (players: PlayerInfo[]): void => {
    client.value?.sendSignal({
      type: "game_started",
      roomId: currentRoomId,
      targetId: "",
      payload: { players },
    });
  };

  onUnmounted(cleanup);

  return { isInitialized, initialize, cleanup, broadcastGameStarted };
}
