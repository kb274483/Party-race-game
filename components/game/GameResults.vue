<template>
  <div class="absolute inset-0 bg-black/75 pointer-events-auto overflow-y-auto">
    <div class="min-h-full flex items-start justify-center p-3 pt-6">
      <div class="neo-card p-4 sm:p-8 -rotate-1 w-full max-w-md">
        <h2 class="font-black text-xl sm:text-2xl uppercase tracking-widest mb-4 text-center">
          比賽結束
        </h2>

        <!-- 獲勝公告 -->
        <div
          class="border-4 border-black p-3 rotate-1 shadow-neo-sm mb-4 text-center"
          :class="winnerTeamId !== null ? 'bg-neo-accent' : 'bg-neo-secondary'"
        >
          <p class="font-black text-2xl sm:text-3xl uppercase">
            {{ winnerTeamId !== null ? `${teamName(winnerTeamId)} 獲勝！` : '平局！' }}
          </p>
        </div>

        <!-- 各隊成員與分數 -->
        <div class="flex flex-col gap-2">
          <div
            v-for="team in teamsInfo"
            :key="team.teamId"
            class="border-4 border-black shadow-neo-sm"
            :class="team.teamId === winnerTeamId ? 'bg-neo-accent' : 'bg-white'"
          >
            <div class="px-3 py-1.5 border-b-4 border-black bg-black flex justify-between items-center">
              <span class="text-white font-black uppercase tracking-widest text-sm">
                {{ teamName(team.teamId) }}
              </span>
              <span class="text-white font-black text-base tabular-nums">{{ team.score }} 分</span>
            </div>
            <div
              v-for="member in team.members"
              :key="member.id"
              class="flex items-center justify-between px-3 py-1.5 border-b-2 border-black/10 last:border-0"
            >
              <span
                class="font-bold text-sm"
                :class="member.isMe ? 'underline underline-offset-2' : ''"
              >
                {{ member.name }}
                <span v-if="member.isMe" class="text-xs font-normal ml-1">（你）</span>
              </span>
              <span class="text-xs font-black border-2 border-black px-2 py-0.5">
                {{ member.controlLabel }}
              </span>
            </div>
          </div>
        </div>

        <!-- 房主控制按鈕 -->
        <div v-if="isHost" class="flex flex-col sm:flex-row gap-3 justify-center mt-5">
          <button type="button" class="neo-btn-primary h-11 px-6" @click="emit('playAgain')">
            再玩一次
          </button>
          <button type="button" class="neo-btn-outline h-11 px-6" @click="emit('backToRoom')">
            回到房間
          </button>
        </div>
        <!-- 成員等待房主決定 -->
        <p
          v-else
          class="mt-5 font-bold text-black/50 text-center border-4 border-dashed border-black/20 p-3"
        >
          等待房主決定下一步...
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface TeamMember {
  id: string
  name: string
  isMe: boolean
  controlLabel: string
}

interface TeamInfo {
  teamId: number
  score: number
  members: TeamMember[]
}

const props = defineProps<{
  teamsInfo: TeamInfo[]
  winnerTeamId: number | null
  isHost: boolean
}>()

const emit = defineEmits<{
  playAgain: []
  backToRoom: []
}>()

const TEAM_NAMES: Record<number, string> = {
  1: '肢體障礙隊',
  2: '大腦當機隊',
}

function teamName(id: number): string {
  return TEAM_NAMES[id] ?? `隊伍 ${id}`
}
</script>
