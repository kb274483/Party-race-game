<template>
  <div class="min-h-screen bg-neo-bg relative overflow-hidden">
    <!-- Background texture -->
    <div
      class="absolute inset-0 opacity-[0.03] pointer-events-none"
      style="background-image: radial-gradient(#000 1.5px, transparent 1.5px); background-size: 20px 20px;"
    />

    <div class="relative container mx-auto max-w-4xl px-6 py-12">
      <!-- Room header -->
      <div class="neo-card p-6 mb-8 -rotate-1">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 class="font-black text-2xl sm:text-3xl uppercase tracking-tight">
              房間
            </h1>
            <div class="flex items-center gap-2 mt-1">
              <p class="font-mono font-black text-xl sm:text-2xl tracking-widest">
                {{ roomStore.currentRoom?.roomId }}
              </p>
              <button
                type="button"
                class="border-2 border-black px-2 py-0.5 text-xs font-black hover:bg-black hover:text-white transition-colors active:scale-95"
                :class="copied ? 'bg-black text-white' : 'bg-white text-black'"
                @click="copyRoomId"
              >
                {{ copied ? '已複製！' : '複製' }}
              </button>
            </div>
          </div>
          <div class="flex gap-4">
            <button
              v-if="roomStore.isHost"
              type="button"
              class="neo-btn-primary h-12 px-6 flex items-center gap-2"
              :disabled="!canStart || roomStore.isLoading"
              @click="handleStartGame"
            >
              開始遊戲
            </button>
            <button
              type="button"
              class="neo-btn-outline h-12 px-6"
              :disabled="roomStore.isLoading"
              @click="handleLeave"
            >
              離開房間
            </button>
          </div>
        </div>

        <!-- Start game validation message -->
        <div
          v-if="roomStore.isHost && !canStart && roomStore.playerCount > 0"
          class="mt-4 p-3 bg-neo-secondary/50 border-4 border-black font-bold text-sm"
        >
          {{ startGameMessage }}
        </div>
      </div>

      <!-- Difficulty selector（房主專屬） -->
      <div v-if="roomStore.isHost" class="neo-card p-6 mb-8 rotate-1">
        <h2 class="font-black text-xl uppercase tracking-widest mb-4 border-b-4 border-black pb-2">
          遊戲難度
        </h2>
        <div class="flex gap-3 flex-wrap">
          <button
            v-for="opt in difficultyOptions"
            :key="opt.level"
            type="button"
            class="flex-1 min-w-[100px] p-3 border-4 border-black font-black transition-all active:scale-95"
            :class="gameStore.difficulty === opt.level
              ? 'bg-black text-white shadow-neo-md'
              : 'bg-white text-black hover:bg-gray-100'"
            @click="gameStore.setDifficulty(opt.level)"
          >
            <div class="text-sm">{{ opt.label }}</div>
            <div class="text-xs font-bold mt-0.5 opacity-70">{{ opt.desc }}</div>
          </button>
        </div>
      </div>

      <!-- Difficulty display（非房主，顯示房主選擇的難度） -->
      <div v-else class="neo-card p-6 mb-8 rotate-1">
        <h2 class="font-black text-xl uppercase tracking-widest mb-4 border-b-4 border-black pb-2">
          遊戲難度
        </h2>
        <div class="flex gap-3 flex-wrap">
          <div
            v-for="opt in difficultyOptions"
            :key="opt.level"
            class="flex-1 min-w-[100px] p-3 border-4 border-black font-black"
            :class="gameStore.difficulty === opt.level
              ? 'bg-black text-white shadow-neo-md'
              : 'bg-white text-black opacity-40'"
          >
            <div class="text-sm">{{ opt.label }}</div>
            <div class="text-xs font-bold mt-0.5 opacity-70">{{ opt.desc }}</div>
          </div>
        </div>
        <p class="text-xs font-bold text-black/40 mt-3">由房主決定難度</p>
      </div>

      <!-- Players list -->
      <div class="neo-card p-6 rotate-1">
        <h2 class="font-black text-xl uppercase tracking-widest mb-4 border-b-4 border-black pb-2">
          玩家 ({{ roomStore.playerCount }}/{{ roomStore.currentRoom?.maxPlayers ?? 6 }})
        </h2>
        <ul class="space-y-3">
          <li
            v-for="player in roomStore.players"
            :key="player.id"
            class="flex items-center justify-between p-4 border-4 border-black bg-white shadow-neo-sm hover:shadow-neo-md transition-shadow"
          >
            <div class="flex items-center gap-3">
              <span
                v-if="player.isHost"
                class="px-2 py-0.5 bg-neo-accent border-2 border-black text-xs font-black uppercase"
              >
                房主
              </span>
              <span class="font-bold text-lg">{{ player.name }}</span>
            </div>
            <span v-if="player.id === roomStore.currentPlayerId" class="text-sm font-bold text-black/60">
              你
            </span>
          </li>
        </ul>
      </div>

      <!-- Error -->
      <div
        v-if="roomStore.error"
        class="mt-6 p-4 bg-neo-accent border-4 border-black shadow-neo-md font-bold text-center"
      >
        {{ roomStore.error }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoomStore } from "~~/stores/room"
import { useGameStore } from "~~/stores/game"
import { useRoomSignaling } from "~~/composables/useRoomSignaling"
import { useWakeLock } from "~~/composables/useWakeLock"
import type { GameDifficulty } from "~~/types/game"

const route = useRoute()
const router = useRouter()
const roomStore = useRoomStore()
const { initialize, cleanup, broadcastGameStarted, broadcastDifficultyChanged } = useRoomSignaling()

useWakeLock()

const gameStore = useGameStore()
const copied = ref(false)

const difficultyOptions: { level: GameDifficulty; label: string; desc: string }[] = [
  { level: 1, label: '等級一', desc: '靜止地雷' },
  { level: 2, label: '等級二', desc: '地雷慢速移動' },
  { level: 3, label: '等級三', desc: '地雷快速移動' },
  { level: 4, label: '等級四', desc: '夜間模式 + 快速地雷' },
  { level: 5, label: '等級五', desc: '空中跑道 + 跑道掉落' },
]

// 房主變更難度時廣播給所有玩家
watch(() => gameStore.difficulty, (newDifficulty) => {
  if (roomStore.isHost) {
    broadcastDifficultyChanged(newDifficulty)
  }
})
const copyRoomId = async () => {
  const id = roomStore.currentRoom?.roomId
  if (!id) return
  try {
    await navigator.clipboard.writeText(id)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  } catch {
    // fallback for older browsers
    const el = document.createElement('textarea')
    el.value = id
    document.body.appendChild(el)
    el.select()
    document.execCommand('copy')
    document.body.removeChild(el)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  }
}

const roomId = computed(() => route.params.roomId as string)

/** 是否可開始遊戲：1 人或雙數人 */
const canStart = computed(() => {
  const n = roomStore.playerCount
  return n === 1 || (n > 1 && n % 2 === 0)
})

const startGameMessage = computed(() => {
  const n = roomStore.playerCount
  if (n === 0) return '等待玩家加入...'
  if (n === 1) return '可以開始單人練習，或等待更多人加入'
  if (n % 2 !== 0) return '需要雙數玩家才能開始（目前 ' + n + ' 人）'
  return '人數已就緒，點擊開始遊戲'
})

const handleStartGame = async () => {
  if (!canStart.value) return
  const players = roomStore.players.map((p) => ({ id: p.id, name: p.name, isHost: p.isHost }))
  gameStore.startGame(players)
  // 廣播給所有成員（含玩家清單與難度），讓他們也跳轉到遊戲頁面
  broadcastGameStarted(players, gameStore.difficulty)
  // 稍等讓成員收到訊號後跳轉，再由 host 導航（觸發 cleanup）
  await new Promise((resolve) => setTimeout(resolve, 150))
  router.push(`/room/${roomId.value}/game`)
}

const handleLeave = async () => {
  roomStore.clearError()
  try {
    await roomStore.leaveRoom()
    await router.push('/')
  } catch {
    // Error shown by store
  }
}

// 初始化 WebRTC 信令並處理房間事件
onMounted(async () => {
  if (!roomStore.isInRoom || roomStore.currentRoom?.roomId !== roomId.value) {
    router.replace('/')
    return
  }

  const playerId = roomStore.currentPlayerId!
  const hostId = roomStore.currentRoom!.hostId
  const isHost = roomStore.isHost

  await initialize(playerId, roomId.value, isHost, hostId, {
    onRoomClosed: () => {
      // 遊戲已開始時忽略房間關閉事件
      if (useGameStore().controlAssignments.length > 0) return
      roomStore.clearRoom()
      router.replace('/')
    },
    onPlayerLeft: (pid: string) => {
      // 遊戲已開始時忽略玩家離開事件
      if (useGameStore().controlAssignments.length > 0) return
      roomStore.removePlayer(pid)
    },
    onPlayerJoined: (payload: { playerId: string; playerName: string; room?: any }) => {
      if (payload.room) roomStore.updateRoomFromApiResponse(payload.room)
      // 房主立即廣播目前難度，讓新加入的玩家同步
      if (roomStore.isHost) broadcastDifficultyChanged(gameStore.difficulty)
    },
    onDifficultyChanged: (difficulty: GameDifficulty) => {
      gameStore.setDifficulty(difficulty)
    },
    onGameStarted: ({ players, difficulty }: { players: any[]; difficulty?: GameDifficulty }) => {
      // 成員收到房主的開始遊戲訊號，初始化遊戲狀態後跳轉
      // 優先使用 payload 中的 players，fallback 到 roomStore
      const allPlayers = players.length > 0
        ? players
        : roomStore.players.map((p) => ({ id: p.id, name: p.name, isHost: p.isHost }))
      if (difficulty) gameStore.setDifficulty(difficulty)
      gameStore.startGame(allPlayers)
      router.push(`/room/${roomId.value}/game`)
    },
  })
})

onBeforeUnmount(() => {
  cleanup()
})
</script>
