/**
 * 房間管理相關型別定義
 */

import type { PlayerInfo } from "./game";

export interface RoomInfo {
  roomId: string;
  hostId: string;
  players: PlayerInfo[];
  isPasswordProtected: boolean;
  maxPlayers: number;
}
