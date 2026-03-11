/**
 * 房間管理 Store 使用範例
 * 
 * 此檔案展示如何使用 room store 進行房間管理操作
 */

import { useRoomStore } from './room'

/**
 * 範例 1: 建立房間
 */
export async function exampleCreateRoom() {
  const roomStore = useRoomStore()
  
  try {
    // 建立公開房間
    const room = await roomStore.createRoom('玩家名稱')
    console.log('房間已建立:', room.roomId)
    
    // 或建立有密碼的房間
    const privateRoom = await roomStore.createRoom('玩家名稱', 'my-password')
    console.log('私人房間已建立:', privateRoom.roomId)
  } catch (error) {
    console.error('建立房間失敗:', roomStore.error)
  }
}

/**
 * 範例 2: 加入房間
 */
export async function exampleJoinRoom() {
  const roomStore = useRoomStore()
  
  try {
    // 加入公開房間
    await roomStore.joinRoom('ROOM123', '玩家名稱')
    console.log('已加入房間')
    
    // 或加入有密碼的房間
    await roomStore.joinRoom('ROOM456', '玩家名稱', 'password')
    console.log('已加入私人房間')
  } catch (error) {
    console.error('加入房間失敗:', roomStore.error)
  }
}

/**
 * 範例 3: 離開房間
 */
export async function exampleLeaveRoom() {
  const roomStore = useRoomStore()
  
  try {
    await roomStore.leaveRoom()
    console.log('已離開房間')
  } catch (error) {
    console.error('離開房間失敗:', roomStore.error)
  }
}

/**
 * 範例 4: 檢查房間狀態
 */
export function exampleCheckRoomStatus() {
  const roomStore = useRoomStore()
  
  // 檢查是否在房間中
  if (roomStore.isInRoom) {
    console.log('目前在房間中:', roomStore.currentRoom?.roomId)
  }
  
  // 檢查是否為房主
  if (roomStore.isHost) {
    console.log('你是房主')
  }
  
  // 取得玩家列表
  console.log('玩家列表:', roomStore.players)
  
  // 取得玩家數量
  console.log('玩家數量:', roomStore.playerCount)
  
  // 檢查房間是否已滿
  if (roomStore.isRoomFull) {
    console.log('房間已滿')
  }
}

/**
 * 範例 5: 在 Vue 組件中使用
 */
export const exampleVueComponent = `
<script setup lang="ts">
import { useRoomStore } from '~/stores/room'

const roomStore = useRoomStore()

// 建立房間
async function createRoom() {
  try {
    const room = await roomStore.createRoom('我的名字')
    // 導航到房間等待頁面
    navigateTo(\`/room/\${room.roomId}\`)
  } catch (error) {
    alert('建立房間失敗')
  }
}

// 加入房間
async function joinRoom(roomId: string) {
  try {
    await roomStore.joinRoom(roomId, '我的名字')
    // 導航到房間等待頁面
    navigateTo(\`/room/\${roomId}\`)
  } catch (error) {
    alert('加入房間失敗')
  }
}

// 離開房間
async function leaveRoom() {
  try {
    await roomStore.leaveRoom()
    // 導航回首頁
    navigateTo('/')
  } catch (error) {
    alert('離開房間失敗')
  }
}
</script>

<template>
  <div>
    <!-- 顯示房間資訊 -->
    <div v-if="roomStore.isInRoom">
      <h2>房間 ID: {{ roomStore.currentRoom?.roomId }}</h2>
      <p>玩家數量: {{ roomStore.playerCount }} / {{ roomStore.currentRoom?.maxPlayers }}</p>
      
      <!-- 玩家列表 -->
      <ul>
        <li v-for="player in roomStore.players" :key="player.id">
          {{ player.name }}
          <span v-if="player.isHost">(房主)</span>
        </li>
      </ul>
      
      <!-- 房主才能看到開始遊戲按鈕 -->
      <button v-if="roomStore.isHost">開始遊戲</button>
      
      <!-- 離開房間按鈕 -->
      <button @click="leaveRoom">離開房間</button>
    </div>
  </div>
</template>
`

/**
 * 範例 6: 處理 WebRTC 同步的玩家加入/離開
 */
export function exampleHandlePlayerEvents() {
  const roomStore = useRoomStore()
  
  // 當收到新玩家加入的 WebRTC 訊息時
  function onPlayerJoined(player: { id: string; name: string; isHost: boolean }) {
    roomStore.addPlayer(player)
    console.log('玩家加入:', player.name)
  }
  
  // 當收到玩家離開的 WebRTC 訊息時
  function onPlayerLeft(playerId: string) {
    roomStore.removePlayer(playerId)
    console.log('玩家離開:', playerId)
  }
  
  // 當收到完整房間狀態更新時
  function onRoomUpdate(roomInfo: any) {
    roomStore.updateRoomInfo(roomInfo)
    console.log('房間狀態已更新')
  }
}

/**
 * 範例 7: 錯誤處理
 */
export async function exampleErrorHandling() {
  const roomStore = useRoomStore()
  
  try {
    await roomStore.joinRoom('INVALID_ROOM', '玩家名稱')
  } catch (error) {
    // 顯示錯誤訊息
    if (roomStore.error) {
      console.error('錯誤:', roomStore.error)
      
      // 根據錯誤類型顯示不同訊息
      if (roomStore.error.includes('not found')) {
        alert('房間不存在')
      } else if (roomStore.error.includes('password')) {
        alert('密碼錯誤')
      } else if (roomStore.error.includes('full')) {
        alert('房間已滿')
      }
      
      // 清除錯誤
      roomStore.clearError()
    }
  }
}
