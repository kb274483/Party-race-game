/**
 * Signaling Client
 * 管理 WebSocket 連線到信令伺服器，處理 WebRTC 信令交換
 */

import type { SignalMessage } from "../types/network";

interface SignalingClientConfig {
  serverUrl: string;
  playerId: string;
  roomId?: string;
}

type SignalReceivedCallback = (signal: SignalMessage) => void;
type ConnectionStateCallback = (connected: boolean) => void;

/**
 * Signaling Client 類別
 * 負責 WebSocket 連線和信令訊息交換
 */
export class SignalingClient {
  private ws: WebSocket | null = null;
  private config: SignalingClientConfig;
  private signalReceivedCallbacks: SignalReceivedCallback[] = [];
  private connectionStateCallbacks: ConnectionStateCallback[] = [];
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 1000;
  private isIntentionallyClosed: boolean = false;

  constructor(config: SignalingClientConfig) {
    this.config = config;
  }

  /**
   * 連線到信令伺服器
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // 建立 WebSocket URL
        const url = new URL(this.config.serverUrl);
        url.searchParams.set("playerId", this.config.playerId);
        if (this.config.roomId) {
          url.searchParams.set("roomId", this.config.roomId);
        }

        // 建立 WebSocket 連線
        this.ws = new WebSocket(url.toString());
        this.isIntentionallyClosed = false;

        // 監聽連線開啟事件
        this.ws.onopen = () => {
          this.reconnectAttempts = 0;
          this.notifyConnectionState(true);
          resolve();
        };

        // 監聽訊息接收事件
        this.ws.onmessage = (event) => {
          try {
            const signal: SignalMessage = JSON.parse(event.data);
            this.handleSignal(signal);
          } catch (error) {
            console.error("Error parsing signaling message:", error);
          }
        };

        // 監聽錯誤事件
        this.ws.onerror = (error) => {
          console.error("Signaling WebSocket error:", error);
          reject(error);
        };

        // 監聽連線關閉事件
        this.ws.onclose = () => {
          this.notifyConnectionState(false);

          // 如果不是主動關閉，嘗試重連
          if (!this.isIntentionallyClosed) {
            this.attemptReconnect();
          }
        };
      } catch (error) {
        console.error("Error creating WebSocket connection:", error);
        reject(error);
      }
    });
  }

  /**
   * 斷開連線
   */
  disconnect(): void {
    this.isIntentionallyClosed = true;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * 發送信令訊息
   * @param signal 信令訊息
   */
  sendSignal(signal: Omit<SignalMessage, "senderId">): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error("WebSocket is not connected");
      return;
    }

    const fullSignal: SignalMessage = {
      ...signal,
      senderId: this.config.playerId,
    };

    try {
      this.ws.send(JSON.stringify(fullSignal));
    } catch (error) {
      console.error("Error sending signal:", error);
    }
  }

  /**
   * 發送 ICE candidate
   * @param targetId 目標玩家 ID
   * @param candidate ICE candidate
   */
  sendIceCandidate(targetId: string, candidate: RTCIceCandidate): void {
    this.sendSignal({
      type: "ice_candidate",
      roomId: this.config.roomId || "",
      targetId,
      payload: {
        candidate: candidate.candidate,
        sdpMid: candidate.sdpMid,
        sdpMLineIndex: candidate.sdpMLineIndex,
      },
    });
  }

  /**
   * 發送 SDP offer
   * @param targetId 目標玩家 ID
   * @param offer SDP offer
   */
  sendOffer(targetId: string, offer: RTCSessionDescriptionInit): void {
    this.sendSignal({
      type: "offer",
      roomId: this.config.roomId || "",
      targetId,
      payload: {
        sdp: offer.sdp,
        type: offer.type,
      },
    });
  }

  /**
   * 發送 SDP answer
   * @param targetId 目標玩家 ID
   * @param answer SDP answer
   */
  sendAnswer(targetId: string, answer: RTCSessionDescriptionInit): void {
    this.sendSignal({
      type: "answer",
      roomId: this.config.roomId || "",
      targetId,
      payload: {
        sdp: answer.sdp,
        type: answer.type,
      },
    });
  }

  /**
   * 註冊信令接收回調
   * @param callback 回調函數
   */
  onSignalReceived(callback: SignalReceivedCallback): void {
    this.signalReceivedCallbacks.push(callback);
  }

  /**
   * 註冊連線狀態變更回調
   * @param callback 回調函數
   */
  onConnectionStateChange(callback: ConnectionStateCallback): void {
    this.connectionStateCallbacks.push(callback);
  }

  /**
   * 檢查是否已連線
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * 處理接收到的信令
   */
  private handleSignal(signal: SignalMessage): void {
    // 通知所有回調
    this.signalReceivedCallbacks.forEach((callback) => {
      try {
        callback(signal);
      } catch (error) {
        console.error("Error in signal received callback:", error);
      }
    });
  }

  /**
   * 通知連線狀態變更
   */
  private notifyConnectionState(connected: boolean): void {
    this.connectionStateCallbacks.forEach((callback) => {
      try {
        callback(connected);
      } catch (error) {
        console.error("Error in connection state callback:", error);
      }
    });
  }

  /**
   * 嘗試重新連線
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error("Max reconnect attempts reached");
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * this.reconnectAttempts;

    setTimeout(() => {
      if (!this.isIntentionallyClosed) {
        this.connect().catch((error) => {
          console.error("Reconnection failed:", error);
        });
      }
    }, delay);
  }
}
