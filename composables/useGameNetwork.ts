/**
 * useGameNetwork
 * 遊戲進行期間的網路同步
 * 透過 WebSocket 信令伺服器廣播/接收車輛狀態，20Hz 更新頻率
 */

import { SignalingClient } from "../utils/signaling-client";
import type { SignalMessage } from "../types/network";
import type { RaceCar } from "../types/game";

type RemoteCarStateCallback = (
  playerId: string,
  state: {
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number; w: number };
    speed: number;
    currentScore?: number;
  },
) => void;

type PlayerInputPayload = {
  accelerate: boolean;
  brake: boolean;
  turnLeft: boolean;
  turnRight: boolean;
};
type PlayerInputCallback = (
  playerId: string,
  input: PlayerInputPayload,
) => void;

type GameAction = "play_again" | "back_to_room";
type GameActionCallback = (action: GameAction) => void;

type CarConfirmCallback = (teamId: number, carId: string) => void;
type PlayerDisconnectCallback = (playerId: string) => void;

type GameTimePhase = "countdown" | "race";
type GameTimeCallback = (phase: GameTimePhase, time: number) => void;

function getWsUrl(): string {
  const url = import.meta.env.NUXT_PUBLIC_WS_URL as string | undefined;
  if (url) return url;
  if (typeof window === "undefined") return "ws://localhost:8080/ws";
  const host = window.location.hostname;
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  return `${protocol}://${host}:8080/ws`;
}

export function useGameNetwork() {
  let signalingClient: SignalingClient | null = null;
  let remoteCarStateCallback: RemoteCarStateCallback | null = null;
  let playerInputCallback: PlayerInputCallback | null = null;
  let gameActionCallback: GameActionCallback | null = null;
  let carConfirmCallback: CarConfirmCallback | null = null;
  let playerDisconnectCallback: PlayerDisconnectCallback | null = null;
  let gameTimeCallback: GameTimeCallback | null = null;
  let currentPlayerId = "";
  let currentRoomId = "";
  let lastSendTime = 0;
  let lastInputSendTime = 0;
  const SEND_INTERVAL_MS = 50; // 20Hz

  /**
   * 連線到信令伺服器（遊戲開始時呼叫）
   */
  const connect = async (playerId: string, roomId: string): Promise<void> => {
    // 如果已有連線先斷開
    if (signalingClient) {
      signalingClient.disconnect();
      signalingClient = null;
    }
    currentPlayerId = playerId;
    currentRoomId = roomId;
    lastSendTime = 0;

    signalingClient = new SignalingClient({
      serverUrl: getWsUrl(),
      playerId,
      roomId,
    });
    signalingClient.onSignalReceived(handleSignal);
    await signalingClient.connect();
  };

  /**
   * 處理接收到的信令訊息
   */
  const handleSignal = (signal: SignalMessage): void => {
    if (signal.senderId === currentPlayerId) return;

    if (signal.type === "car_state") {
      const payload = signal.payload as {
        position: { x: number; y: number; z: number };
        rotation: { x: number; y: number; z: number; w: number };
        speed: number;
      };
      remoteCarStateCallback?.(signal.senderId, payload);
    } else if (signal.type === "game_action") {
      const { action } = signal.payload as { action: GameAction };
      gameActionCallback?.(action);
    } else if (signal.type === "player_input") {
      const input = signal.payload as PlayerInputPayload;
      playerInputCallback?.(signal.senderId, input);
    } else if (signal.type === "car_confirm") {
      const { teamId, carId } = signal.payload as {
        teamId: number;
        carId: string;
      };
      carConfirmCallback?.(teamId, carId);
    } else if (signal.type === "game_time") {
      const { phase, time } = signal.payload as {
        phase: GameTimePhase;
        time: number;
      };
      gameTimeCallback?.(phase, time);
    } else if (
      signal.type === "player_left" ||
      signal.type === "player_disconnect"
    ) {
      const playerId = (signal.payload as any)?.playerId ?? signal.senderId;
      if (playerId && playerId !== currentPlayerId) {
        playerDisconnectCallback?.(playerId);
      }
    }
  };

  /**
   * 發送自己的車輛狀態（每幀呼叫，內部做頻率限制）
   */
  const sendCarState = (car: RaceCar): void => {
    if (!signalingClient?.isConnected()) return;
    const now = performance.now();
    if (now - lastSendTime < SEND_INTERVAL_MS) return;
    lastSendTime = now;

    signalingClient.sendSignal({
      type: "car_state",
      roomId: currentRoomId,
      targetId: "",
      payload: {
        position: { x: car.position.x, y: car.position.y, z: car.position.z },
        rotation: {
          x: car.rotation.x,
          y: car.rotation.y,
          z: car.rotation.z,
          w: car.rotation.w,
        },
        speed: car.speed,
        currentScore: car.currentScore,
      },
    });
  };

  /**
   * 註冊收到遠端車輛狀態的 callback
   */
  const onRemoteCarState = (cb: RemoteCarStateCallback): void => {
    remoteCarStateCallback = cb;
  };

  /**
   * 發送玩家輸入狀態（非物理權威玩家呼叫，供隊友合併使用）
   */
  const sendPlayerInput = (input: PlayerInputPayload): void => {
    if (!signalingClient?.isConnected()) return;
    const now = performance.now();
    if (now - lastInputSendTime < SEND_INTERVAL_MS) return;
    lastInputSendTime = now;

    signalingClient.sendSignal({
      type: "player_input",
      roomId: currentRoomId,
      targetId: "",
      payload: input,
    });
  };

  /**
   * 註冊收到遠端玩家輸入的 callback
   */
  const onRemotePlayerInput = (cb: PlayerInputCallback): void => {
    playerInputCallback = cb;
  };

  /**
   * 發送遊戲結束動作（僅房主呼叫）
   */
  const sendGameAction = (action: GameAction): void => {
    if (!signalingClient?.isConnected()) return;
    signalingClient.sendSignal({
      type: "game_action",
      roomId: currentRoomId,
      targetId: "",
      payload: { action },
    });
  };

  /**
   * 註冊收到遊戲結束動作的 callback（成員使用）
   */
  const onGameAction = (cb: GameActionCallback): void => {
    gameActionCallback = cb;
  };

  /**
   * Host 廣播目前計時（每秒呼叫，讓所有玩家時間保持一致）
   */
  const sendGameTime = (phase: GameTimePhase, time: number): void => {
    if (!signalingClient?.isConnected()) return;
    signalingClient.sendSignal({
      type: "game_time",
      roomId: currentRoomId,
      targetId: "",
      payload: { phase, time },
    });
  };

  /**
   * 非 Host 玩家註冊接收計時同步的 callback
   */
  const onGameTime = (cb: GameTimeCallback): void => {
    gameTimeCallback = cb;
  };

  /**
   * 廣播選車確認（選車代表呼叫）
   */
  const sendCarConfirm = (teamId: number, carId: string): void => {
    if (!signalingClient?.isConnected()) return;
    signalingClient.sendSignal({
      type: "car_confirm",
      roomId: currentRoomId,
      targetId: "",
      payload: { teamId, carId },
    });
  };

  /**
   * 註冊收到其他隊選車確認的 callback
   */
  const onCarConfirm = (cb: CarConfirmCallback): void => {
    carConfirmCallback = cb;
  };

  /**
   * 註冊收到玩家斷線通知的 callback
   */
  const onPlayerDisconnect = (cb: PlayerDisconnectCallback): void => {
    playerDisconnectCallback = cb;
  };

  /**
   * 斷開連線
   */
  const disconnect = (): void => {
    signalingClient?.disconnect();
    signalingClient = null;
    remoteCarStateCallback = null;
    playerInputCallback = null;
    gameActionCallback = null;
    carConfirmCallback = null;
    playerDisconnectCallback = null;
    gameTimeCallback = null;
  };

  return {
    connect,
    sendCarState,
    onRemoteCarState,
    sendPlayerInput,
    onRemotePlayerInput,
    sendGameAction,
    onGameAction,
    sendGameTime,
    onGameTime,
    sendCarConfirm,
    onCarConfirm,
    onPlayerDisconnect,
    disconnect,
  };
}
