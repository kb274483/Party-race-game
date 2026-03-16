/**
 * 網路通訊相關型別定義
 */

export interface SignalMessage {
  type: string
  roomId: string
  senderId: string
  targetId: string
  payload: any
}
