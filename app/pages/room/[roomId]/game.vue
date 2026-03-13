<template>
  <div class="game-container fixed inset-0 overflow-hidden bg-black">
    <!-- 3D 遊戲畫布 -->
    <div ref="canvasContainer" class="w-full h-full"></div>

    <!-- 虛擬控制按鈕（行動裝置橫向） -->
    <VirtualControls
      v-if="gameStore.isRacing && playerControls.length > 0"
      :controls="playerControls"
      @press="gameLoop.pressControl($event, true)"
      @release="gameLoop.pressControl($event, false)"
    />

    <!-- 直式模式提示已移除：行動裝置支援直向遊玩 -->

    <!-- 選車畫面 -->
    <CarSelector
      v-if="gameStore.isCarSelection"
      :team-id="myTeamId"
      :is-selector="isCarSelector"
      :confirmed-car-id="gameStore.selectedCars[myTeamId] ?? null"
      :cars="carRegistry"
      :team-status="carTeamStatus"
      @confirm="onCarConfirmLocal"
    />

    <!-- 遊戲 UI 覆蓋層 -->
    <div class="absolute inset-0 pointer-events-none">
      <!-- 載入中 -->
      <GameLoading
        v-if="gameStore.phase === 'waiting' && !gameStore.isLoaded && !gameStore.error"
      />

      <!-- 倒數 -->
      <GameCountdown
        v-else-if="gameStore.isCountdown"
        :countdown-time="gameStore.countdownTime"
      />

      <!-- 比賽中 HUD -->
      <GameHUD
        v-else-if="gameStore.isRacing"
        :race-time="gameStore.raceTime"
        :teams-info="teamsInfo"
        :laps="laps"
        :lap-progress="lapProgress"
      />

      <!-- 結算 -->
      <GameResults
        v-else-if="gameStore.isFinished"
        :teams-info="teamsInfo"
        :winner-team-id="winnerTeamId"
        :is-host="isHost"
        @play-again="handlePlayAgain"
        @back-to-room="handleBackToRoom"
      />

      <!-- 斷線通知 -->
      <GameDisconnect :names="disconnectedPlayerNames" />

      <!-- 錯誤 -->
      <GameError
        v-if="gameStore.error"
        :error="gameStore.error"
        :is-dev="isDev"
        @skip-load="handleSkipLoad"
        @back-to-room="handleBackToRoom"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed, onMounted, onBeforeUnmount } from 'vue'
import { useGameStore } from "~~/stores/game"
import { useRoomStore } from "~~/stores/room"
import { useGameLoop } from "~~/composables/useGameLoop"
import { useGameNetwork } from "~~/composables/useGameNetwork"
import { useWakeLock } from "~~/composables/useWakeLock"
import { GamePhase, ControlType } from "~~/types/game"
import { CAR_REGISTRY, DEFAULT_CAR_STATS } from "~~/app/data/car-registry"
import type { CarStats } from "~~/app/data/car-registry"

const carRegistry = CAR_REGISTRY
const DEFAULT_CAR_FILE = "/blender/sportCar.glb"

const route = useRoute()
const router = useRouter()
const gameStore = useGameStore()
const roomStore = useRoomStore()
const gameLoop = useGameLoop()
const gameNetwork = useGameNetwork()

const roomId = computed(() => route.params.roomId as string)
const isDev = import.meta.env?.DEV ?? false

useWakeLock()

const canvasContainer = ref<HTMLDivElement | null>(null)
const playerControls = ref<ControlType[]>([])

// 本玩家的 player ID（用於查找控制分配）
const myPlayerId = computed(() => roomStore.currentPlayerId ?? 'player1')

// ── 行動裝置方向偵測 ──────────────────────────────────────────
const isPortrait = ref(false)

const isTouchDevice = typeof window !== 'undefined'
  && window.matchMedia('(pointer: coarse)').matches

const isMobilePortrait = computed(() => isTouchDevice && isPortrait.value)

// 使用 visualViewport（行動裝置更即時）或 fallback 到 window
const updateOrientation = () => {
  const vv = window.visualViewport
  const w = vv ? vv.width : window.innerWidth
  const h = vv ? vv.height : window.innerHeight
  isPortrait.value = h > w
}

// orientationchange 會在 viewport 尺寸更新前觸發，稍等一幀再讀取
const onOrientationChange = () => {
  requestAnimationFrame(() => {
    setTimeout(updateOrientation, 50)
  })
}

// 防止下拉重整（passive:false 才能 preventDefault）
let preventScrollFn: ((e: TouchEvent) => void) | null = null

const tryLockLandscape = async () => {
  await document.documentElement.requestFullscreen?.().catch(() => {})
  ;(screen.orientation as any)?.lock?.('landscape')?.catch?.(() => {})
}

// ── 玩家資訊 ──────────────────────────────────────────────────
const isHost = computed(() =>
  gameStore.gamePlayers.find(p => p.id === myPlayerId.value)?.isHost ?? false
)

const myTeamId = computed(() => {
  const a = gameStore.controlAssignments.find(a => a.playerId === myPlayerId.value)
  return a?.teamId ?? 1
})

// 本玩家隊伍的車輛 ID（以隊伍為單位，非個人 ID）
const teamCarId = computed(() => `team-${myTeamId.value}`)

// 是否為本隊物理權威（有 accelerate 控制 = 油門/煞車玩家）
const isAuthority = computed(() => {
  const assignment = gameStore.controlAssignments.find(a => a.playerId === myPlayerId.value)
  if (!assignment) return true
  return assignment.controls.includes(ControlType.ACCELERATE)
})

const isCarSelector = computed(() =>
  gameStore.selectorPlayerIds[myTeamId.value] === myPlayerId.value
)

const carTeamStatus = computed(() => {
  const result: Record<number, boolean> = {}
  for (const a of gameStore.controlAssignments) {
    if (!(a.teamId in result)) {
      result[a.teamId] = gameStore.carConfirmed[a.teamId] ?? false
    }
  }
  return result
})

function roomIdToSeed(id: string): number {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

const score = gameLoop.score
const laps = gameLoop.laps
const lapProgress = gameLoop.lapProgress

function controlLabel(controls: string[]): string {
  const labels: Record<string, string> = {
    accelerate: '油門',
    brake: '煞車',
    turn_left: '左轉',
    turn_right: '右轉',
  }
  const hasLeft = controls.includes('turn_left')
  const hasRight = controls.includes('turn_right')
  const unique = new Set<string>()
  for (const c of controls) {
    if (c === 'turn_left' || c === 'turn_right') {
      // 左右都有 → 顯示「轉向」；只有其中一個 → 顯示「左轉」或「右轉」
      if (hasLeft && hasRight) unique.add('轉向')
      else unique.add(labels[c] ?? c)
    } else {
      unique.add(labels[c] ?? c)
    }
  }
  return [...unique].join('/')
}

const teamsInfo = computed(() => {
  const assignments = gameStore.controlAssignments
  const players = gameStore.gamePlayers

  const teamMap = new Map<number, {
    teamId: number
    score: number
    members: { id: string; name: string; isMe: boolean; controlLabel: string }[]
  }>()

  for (const assignment of assignments) {
    if (!teamMap.has(assignment.teamId)) {
      teamMap.set(assignment.teamId, { teamId: assignment.teamId, score: 0, members: [] })
    }
    const team = teamMap.get(assignment.teamId)!
    const player = players.find(p => p.id === assignment.playerId)
    const isMe = assignment.playerId === myPlayerId.value
    const memberScore = assignment.teamId === myTeamId.value
      ? score.value
      : (gameLoop.cars.value.get(`team-${assignment.teamId}`)?.currentScore ?? 0)

    team.members.push({
      id: assignment.playerId,
      name: player?.name ?? assignment.playerId,
      isMe,
      controlLabel: controlLabel(assignment.controls),
    })

    if (memberScore > team.score) team.score = memberScore
  }

  return [...teamMap.values()].sort((a, b) => a.teamId - b.teamId)
})

const winnerTeamId = computed(() => {
  const teams = teamsInfo.value
  if (teams.length === 0) return null
  const winner = teams.reduce((best, t) => t.score > best.score ? t : best)
  const isTie = teams.filter(t => t.score === winner.score).length > 1
  return isTie ? null : winner.teamId
})

const disconnectedPlayerNames = ref<string[]>([])

const onCarConfirmLocal = (carId: string) => {
  const teamId = myTeamId.value
  gameStore.confirmCar(teamId, carId)
  if (gameStore.gamePlayers.length > 1) {
    gameNetwork.sendCarConfirm(teamId, carId)
  }
}

const CAR_SELECTION_TIMEOUT_MS = 60_000

const waitForAllTeamsConfirmed = (): Promise<void> => {
  return new Promise((resolve) => {
    if (gameStore.allTeamsConfirmed) {
      resolve()
      return
    }

    const rebroadcastInterval = setInterval(() => {
      const myConfirmed = gameStore.carConfirmed[myTeamId.value]
      const myCarId = gameStore.selectedCars[myTeamId.value]
      if (myConfirmed && myCarId && gameStore.gamePlayers.length > 1) {
        gameNetwork.sendCarConfirm(myTeamId.value, myCarId)
      }
    }, 2000)

    const timeoutId = setTimeout(() => {
      stopWatch()
      clearInterval(rebroadcastInterval)
      const fallbackCarId = carRegistry[0]?.id ?? '__default__'
      for (const a of gameStore.controlAssignments) {
        if (!gameStore.carConfirmed[a.teamId]) {
          gameStore.confirmCar(a.teamId, fallbackCarId)
        }
      }
      resolve()
    }, CAR_SELECTION_TIMEOUT_MS)

    const stopWatch = watch(
      () => gameStore.allTeamsConfirmed,
      (confirmed) => {
        if (confirmed) {
          stopWatch()
          clearTimeout(timeoutId)
          clearInterval(rebroadcastInterval)
          resolve()
        }
      },
    )
  })
}

// 根據 teamCarId（格式 "team-N"）取得車輛 GLB 路徑
const getCarFileForTeam = (teamCarId: string): string => {
  const teamId = parseInt(teamCarId.replace('team-', ''), 10)
  const carId = gameStore.selectedCars[teamId]
  if (!carId || carId === "__default__") return DEFAULT_CAR_FILE
  return carRegistry.find(c => c.id === carId)?.file ?? DEFAULT_CAR_FILE
}

// 根據 teamCarId（格式 "team-N"）取得車輛 stats
const getCarStatsForTeam = (teamCarId: string): CarStats => {
  const teamId = parseInt(teamCarId.replace('team-', ''), 10)
  const carId = gameStore.selectedCars[teamId]
  if (!carId || carId === "__default__") return DEFAULT_CAR_STATS
  return carRegistry.find(c => c.id === carId)?.stats ?? DEFAULT_CAR_STATS
}

let countdownTimerId: ReturnType<typeof setInterval> | null = null
let raceTimerId: ReturnType<typeof setInterval> | null = null

const clearTimers = () => {
  if (countdownTimerId) { clearInterval(countdownTimerId); countdownTimerId = null }
  if (raceTimerId) { clearInterval(raceTimerId); raceTimerId = null }
}

const startCountdownLoop = () => {
  gameStore.startCountdown()
  gameLoop.start()

  countdownTimerId = setInterval(() => {
    const next = gameStore.countdownTime - 1
    gameStore.setCountdownTime(next)
    if (next <= 0) {
      clearTimers()
      gameStore.startRacing()
      startRaceLoop()
      gameLoop.unlockInput()
    }
  }, 1000)
}

const startRaceLoop = () => {
  raceTimerId = setInterval(() => {
    const next = gameStore.raceTime - 1
    gameStore.setRaceTime(next)
    if (next <= 0) {
      clearTimers()
      gameStore.finishGame()
      gameLoop.stop()
    }
  }, 1000)
}

const doPlayAgain = () => {
  clearTimers()
  disconnectedPlayerNames.value = []
  gameLoop.setNetworkSend(null)
  gameNetwork.disconnect()
  gameLoop.dispose()
  if (canvasContainer.value) canvasContainer.value.innerHTML = ''
  const prevPlayers = gameStore.gamePlayers.length > 0
    ? gameStore.gamePlayers
    : roomStore.players.map(p => ({ id: p.id, name: p.name, isHost: p.isHost }))
  gameStore.reset()
  gameStore.startGame(prevPlayers)
  setTimeout(loadAndStart, 1000)
}

const doBackToRoom = () => {
  clearTimers()
  gameLoop.setNetworkSend(null)
  gameNetwork.disconnect()
  gameLoop.dispose()
  gameStore.reset()
  router.push(`/room/${roomId.value}`)
}

const handlePlayAgain = () => {
  if (gameStore.gamePlayers.length > 1) gameNetwork.sendGameAction('play_again')
  doPlayAgain()
}

const handleBackToRoom = () => {
  if (gameStore.gamePlayers.length > 1) gameNetwork.sendGameAction('back_to_room')
  doBackToRoom()
}

const handleSkipLoad = () => {
  gameStore.setError(null)
  gameStore.setTrackLoaded()
  gameStore.setCarLoaded()
  startCountdownLoop()
}

const loadAndStart = async () => {
  if (!canvasContainer.value) {
    gameStore.setError('Canvas container not found')
    return
  }

  const actualPlayerId = myPlayerId.value
  const allPlayers = gameStore.gamePlayers.length > 0
    ? gameStore.gamePlayers
    : roomStore.players.map(p => ({ id: p.id, name: p.name, isHost: p.isHost }))
  const remotePlayers = allPlayers.filter(p => p.id !== actualPlayerId)
  const isMultiplayer = remotePlayers.length > 0

  try {
    // 根據控制分配設定本玩家的控制按鍵
    const myAssignment = gameStore.controlAssignments.find(a => a.playerId === actualPlayerId)
    playerControls.value = myAssignment?.controls ?? [
      ControlType.ACCELERATE,
      ControlType.BRAKE,
      ControlType.TURN_LEFT,
      ControlType.TURN_RIGHT,
    ]

    // 設定物理權威（有 accelerate 控制的玩家）
    gameLoop.setPhysicsAuthority(isAuthority.value)

    // 使用隊伍 car ID（team-N）作為本玩家的車輛識別
    await gameLoop.initialize(
      canvasContainer.value as HTMLElement,
      playerControls.value,
      teamCarId.value,
      roomIdToSeed(roomId.value),
    )

    if (isMultiplayer) {
      await gameNetwork.connect(actualPlayerId, roomId.value)

      // 接收遠端車輛狀態：將 senderId 對應到隊伍 car ID
      gameNetwork.onRemoteCarState((senderId, state) => {
        const senderAssignment = gameStore.controlAssignments.find(a => a.playerId === senderId)
        if (!senderAssignment) return
        const senderTeamCarId = `team-${senderAssignment.teamId}`
        // 若我是物理權威且是自己隊伍的車，不覆蓋本地物理計算結果
        const isOurCar = senderAssignment.teamId === myTeamId.value
        if (!isOurCar || !isAuthority.value) {
          gameLoop.updateCarState(senderTeamCarId, state)
        }
      })

      // 物理權威：接收隊友輸入並合併
      if (isAuthority.value) {
        gameNetwork.onRemotePlayerInput((senderId, input) => {
          const senderAssignment = gameStore.controlAssignments.find(a => a.playerId === senderId)
          if (senderAssignment?.teamId === myTeamId.value) {
            gameLoop.setTeammateInput(senderId, input)
          }
        })
      }

      gameNetwork.onCarConfirm((teamId, carId) => {
        gameStore.confirmCar(teamId, carId)
      })
      gameNetwork.onGameAction((action) => {
        if (action === 'play_again') doPlayAgain()
        else if (action === 'back_to_room') doBackToRoom()
      })
      gameNetwork.onPlayerDisconnect((playerId) => {
        // 選車與載入階段忽略斷線通知：
        // 此時玩家正從房間頁切換到遊戲頁，舊連線關閉是正常過渡，並非真正離線
        if (gameStore.phase === GamePhase.WAITING || gameStore.isCarSelection) return
        const player = gameStore.gamePlayers.find(p => p.id === playerId)
        const name = player?.name ?? playerId
        disconnectedPlayerNames.value = [...disconnectedPlayerNames.value, name]
        setTimeout(() => {
          disconnectedPlayerNames.value = disconnectedPlayerNames.value.filter(n => n !== name)
        }, 5000)
      })
    }

    gameStore.setTrackLoaded()
    await gameLoop.loadTrackAssets()

    if (carRegistry.length > 0) {
      gameStore.enterCarSelection()
      if (!isMultiplayer) {
        for (const teamId of Object.keys(gameStore.selectorPlayerIds).map(Number)) {
          gameStore.confirmCar(teamId, carRegistry[0]!.id)
        }
      }
      await waitForAllTeamsConfirmed()
    }

    // 每隊只載入一輛車（以 team-N 為 ID）
    const teamCarObjects = [
      ...new Map(
        gameStore.controlAssignments.map(a => [a.teamId, { id: `team-${a.teamId}` }])
      ).values()
    ]
    await gameLoop.loadCarsForTeams(teamCarObjects, getCarFileForTeam, getCarStatsForTeam)

    if (isMultiplayer) {
      if (isAuthority.value) {
        // 物理權威：發送車輛狀態給所有人
        gameLoop.setNetworkSend((car) => {
          gameNetwork.sendCarState(car)
        })
      } else {
        // 非物理權威：發送輸入給隊友（物理在隊友端執行）
        gameLoop.setNetworkInputSend((input) => {
          gameNetwork.sendPlayerInput(input)
        })
      }
    }

    gameStore.setCarLoaded()
    startCountdownLoop()
  } catch (error) {
    console.error('載入遊戲失敗:', error)
    gameStore.setError(error instanceof Error ? error.message : '載入遊戲失敗')
  }
}

onMounted(async () => {
  if (!roomStore.isInRoom || roomStore.currentRoom?.roomId !== roomId.value) {
    router.replace("/")
    return
  }

  if (gameStore.controlAssignments.length === 0) {
    router.replace(`/room/${roomId.value}`)
    return
  }

  updateOrientation()
  window.visualViewport?.addEventListener('resize', updateOrientation)
  window.addEventListener('resize', updateOrientation)
  window.addEventListener('orientationchange', onOrientationChange)
  if (isTouchDevice) {
    // 不強制鎖定橫向，讓玩家用直向也能遊玩
    // 禁止下拉重整
    preventScrollFn = (e: TouchEvent) => e.preventDefault()
    document.addEventListener('touchmove', preventScrollFn, { passive: false })
    // 禁止 overscroll
    document.body.style.overscrollBehavior = 'none'
  }

  if (gameStore.phase === GamePhase.WAITING && !gameStore.isLoaded) {
    await loadAndStart()
  }
})

onBeforeUnmount(() => {
  clearTimers()
  gameLoop.setNetworkSend(null)
  gameNetwork.disconnect()
  gameLoop.dispose()
  window.visualViewport?.removeEventListener('resize', updateOrientation)
  window.removeEventListener('resize', updateOrientation)
  window.removeEventListener('orientationchange', onOrientationChange)
  if (preventScrollFn) {
    document.removeEventListener('touchmove', preventScrollFn)
    preventScrollFn = null
  }
  document.body.style.overscrollBehavior = ''
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => {})
  }
})
</script>

<style scoped>
.game-container {
  /* fixed inset-0 透過 Tailwind class 設定，此處補強 touch 行為 */
  touch-action: none;
  -webkit-overflow-scrolling: touch;
}
</style>
