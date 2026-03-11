/**
 * 房間管理相關型別定義
 */

import type { PlayerInfo } from './game'

export interface RoomInfo {
  roomId: string
  hostId: string
  players: PlayerInfo[]
  isPasswordProtected: boolean
  maxPlayers: number
}

export interface CreateRoomRequest {
  password?: string
}

export interface JoinRoomRequest {
  roomId: string
  playerName: string
  password?: string
}

export interface RoomManagerFrontend {
  createRoom(password?: string): Promise<RoomInfo>
  joinRoom(roomId: string, playerName: string, password?: string): Promise<void>
  leaveRoom(): Promise<void>
  getRoomInfo(): RoomInfo | null
}
