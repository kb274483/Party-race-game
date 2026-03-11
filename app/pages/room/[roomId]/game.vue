<template>
  <div class="game-container w-full h-screen overflow-hidden bg-black relative">
    <!-- 3D 遊戲畫布 -->
    <div ref="canvasContainer" class="w-full h-full"></div>

    <!-- 虛擬控制按鈕（行動裝置橫向） -->
    <VirtualControls
      v-if="gameStore.isRacing && playerControls.length > 0"
      :controls="playerControls"
      @press="gameLoop.pressControl($event, true)"
      @release="gameLoop.pressControl($event, false)"
    />

    <!-- 直式模式：請旋轉裝置提示 -->
    <GameRotatePrompt v-if="isMobilePortrait" />

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

const canvasContainer = ref<HTMLDivElement | null>(null)
const playerControls = ref<ControlType[]>([])
const playerCarId = computed(() => roomStore.currentPlayerId ?? 'player1')

// ── 行動裝置方向偵測 ──────────────────────────────────────────
const isPortrait = ref(false)

const isTouchDevice = typeof window !== 'undefined'
  && window.matchMedia('(pointer: coarse)').matches

const isMobilePortrait = computed(() => isTouchDevice && isPortrait.value)

const updateOrientation = () => {
  isPortrait.value = window.innerHeight > window.innerWidth
}

const tryLockLandscape = async () => {
  await document.documentElement.requestFullscreen?.().catch(() => {})
  ;(screen.orientation as any)?.lock?.('landscape')?.catch?.(() => {})
}

// ── 玩家資訊 ──────────────────────────────────────────────────
const isHost = computed(() =>
  gameStore.gamePlayers.find(p => p.id === playerCarId.value)?.isHost ?? false
)

const myTeamId = computed(() => {
  const a = gameStore.controlAssignments.find(a => a.playerId === playerCarId.value)
  return a?.teamId ?? 1
})

const isCarSelector = computed(() =>
  gameStore.selectorPlayerIds[myTeamId.value] === playerCarId.value
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
  const unique = new Set<string>()
  for (const c of controls) {
    if (c === 'turn_left' || c === 'turn_right') unique.add('轉向')
    else unique.add(labels[c] ?? c)
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
    const isMe = assignment.playerId === playerCarId.value
    const memberScore = isMe
      ? score.value
      : (gameLoop.cars.value.get(assignment.playerId)?.currentScore ?? 0)

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

const getCarFileForPlayer = (playerId: string): string => {
  const assignment = gameStore.controlAssignments.find(a => a.playerId === playerId)
  if (!assignment) return DEFAULT_CAR_FILE
  const carId = gameStore.selectedCars[assignment.teamId]
  if (!carId || carId === "__default__") return DEFAULT_CAR_FILE
  return carRegistry.find(c => c.id === carId)?.file ?? DEFAULT_CAR_FILE
}

const getCarStatsForPlayer = (playerId: string): CarStats => {
  const assignment = gameStore.controlAssignments.find(a => a.playerId === playerId)
  if (!assignment) return DEFAULT_CAR_STATS
  const carId = gameStore.selectedCars[assignment.teamId]
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

  const actualPlayerId = playerCarId.value
  const allPlayers = gameStore.gamePlayers.length > 0
    ? gameStore.gamePlayers
    : roomStore.players.map(p => ({ id: p.id, name: p.name, isHost: p.isHost }))
  const remotePlayers = allPlayers.filter(p => p.id !== actualPlayerId)
  const isMultiplayer = remotePlayers.length > 0

  try {
    playerControls.value = [
      ControlType.ACCELERATE,
      ControlType.BRAKE,
      ControlType.TURN_LEFT,
      ControlType.TURN_RIGHT,
    ]

    await gameLoop.initialize(
      canvasContainer.value as HTMLElement,
      playerControls.value,
      actualPlayerId,
      roomIdToSeed(roomId.value),
    )

    if (isMultiplayer) {
      await gameNetwork.connect(actualPlayerId, roomId.value)
      gameNetwork.onRemoteCarState((senderId, state) => {
        gameLoop.updateCarState(senderId, state)
      })
      gameNetwork.onCarConfirm((teamId, carId) => {
        gameStore.confirmCar(teamId, carId)
      })
      gameNetwork.onGameAction((action) => {
        if (action === 'play_again') doPlayAgain()
        else if (action === 'back_to_room') doBackToRoom()
      })
      gameNetwork.onPlayerDisconnect((playerId) => {
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

    await gameLoop.loadCarsForTeams(allPlayers, getCarFileForPlayer, getCarStatsForPlayer)

    if (isMultiplayer) {
      gameLoop.setNetworkSend((car) => {
        gameNetwork.sendCarState(car)
      })
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
  window.addEventListener('resize', updateOrientation)
  window.addEventListener('orientationchange', updateOrientation)
  if (isTouchDevice) tryLockLandscape()

  if (gameStore.phase === GamePhase.WAITING && !gameStore.isLoaded) {
    await loadAndStart()
  }
})

onBeforeUnmount(() => {
  clearTimers()
  gameLoop.setNetworkSend(null)
  gameNetwork.disconnect()
  gameLoop.dispose()
  window.removeEventListener('resize', updateOrientation)
  window.removeEventListener('orientationchange', updateOrientation)
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => {})
  }
})
</script>

<style scoped>
.game-container {
  position: relative;
}
</style>
