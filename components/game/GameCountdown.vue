<template>
  <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
    <div class="neo-card p-8 sm:p-16 text-center rotate-1 pointer-events-auto max-w-[90vw]">
      <p class="font-bold text-xl uppercase tracking-widest mb-2">準備開始</p>
      <p class="font-black text-8xl sm:text-9xl">{{ countdownTime }}</p>

      <!-- 隊伍資訊（有多隊時才顯示） -->
      <div v-if="teamsInfo && teamsInfo.length > 0" class="mt-6 flex flex-col gap-2 text-left">
        <div
          v-for="team in teamsInfo"
          :key="team.teamId"
          class="rounded-lg overflow-hidden border border-white/20"
        >
          <div
            class="px-3 py-1 text-xs font-black uppercase tracking-widest"
            :class="team.teamId === 1 ? 'bg-blue-400/70 text-black' : 'bg-yellow-400/70 text-black'"
          >
            {{ teamName(team.teamId) }}
          </div>
          <div class="bg-black/40">
            <div
              v-for="member in team.members"
              :key="member.id"
              class="flex items-center gap-2 px-3 py-1.5 border-b border-white/10 last:border-0"
              :class="member.isMe ? 'bg-yellow-400/20' : ''"
            >
              <span
                class="flex-1 font-bold text-sm"
                :class="member.isMe ? 'text-yellow-300' : 'text-white'"
              >
                {{ member.name }}
                <span v-if="member.isMe" class="text-xs opacity-70 ml-1">（你）</span>
              </span>
              <span class="text-white/60 text-xs">{{ member.controlLabel }}</span>
            </div>
          </div>
        </div>
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

defineProps<{
  countdownTime: number
  teamsInfo?: TeamInfo[]
}>()

const TEAM_NAMES: Record<number, string> = {
  1: '腦袋快轉隊',
  2: '大腦當機隊',
}

function teamName(id: number): string {
  return TEAM_NAMES[id] ?? `隊伍 ${id}`
}
</script>
