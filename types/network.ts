/**
 * 網路通訊相關型別定義
 */

import type { GameState, InputState, RaceTrack, ControlAssignment, WinnerInfo } from './game'

export enum MessageType {
  INPUT = 'input',
  STATE_UPDATE = 'state_update',
  GAME_START = 'game_start',
  GAME_END = 'game_end',
  PLAYER_DISCONNECT = 'player_disconnect'
}

export interface NetworkMessage {
  type: MessageType
  timestamp: number
  senderId: string
  payload: any
}

export interface InputMessage {
  type: 'input'
  playerId: string
  input: InputState
  timestamp: number
}

export interface StateUpdateMessage {
  type: 'state_update'
  gameState: GameState
  timestamp: number
}

export interface GameStartMessage {
  type: 'game_start'
  track: RaceTrack
  controlAssignments: ControlAssignment[]
  timestamp: number
}

export interface GameEndMessage {
  type: 'game_end'
  winner: WinnerInfo
  finalScores: Map<number, number>
  timestamp: number
}

export interface PlayerDisconnectMessage {
  type: 'player_disconnect'
  playerId: string
  playerName: string
  timestamp: number
}

export interface SignalMessage {
  type: string
  roomId: string
  senderId: string
  targetId: string
  payload: any
}
