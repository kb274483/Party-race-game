<template>
  <!-- 直向：頂部緊湊橫條；橫向：右側面板 -->
  <div class="hud-portrait absolute top-0 left-0 right-0 pointer-events-auto
              flex flex-col bg-black/75
              sm:hidden">
    <!-- 第一行：時間、分數、圈數 -->
    <div class="flex items-center justify-between gap-2 px-3 py-2">
      <!-- 時間 -->
      <span class="text-white font-black text-base tabular-nums">{{ raceTime }}s</span>
      <!-- 各隊分數 -->
      <div class="flex items-center gap-1">
        <template v-for="(team, idx) in teamsInfo" :key="team.teamId">
          <span
            class="px-2 py-0.5 text-xs font-black rounded tabular-nums"
            :class="team.teamId === 1 ? 'bg-white/30 text-white' : 'bg-yellow-400/70 text-black'"
          >{{ team.score }}</span>
          <span v-if="idx < teamsInfo.length - 1" class="text-white/60 text-xs font-bold">:</span>
        </template>
      </div>
      <!-- 圈數進度 -->
      <div class="flex items-center gap-1">
        <span class="text-white/70 text-xs">{{ laps }}圈</span>
        <div class="w-16 bg-white/20 rounded-full h-1.5">
          <div
            class="bg-yellow-400 h-1.5 rounded-full transition-all"
            :style="{ width: `${Math.round(lapProgress * 100)}%` }"
          />
        </div>
      </div>
    </div>
    <!-- 第二行：各隊成員（超過一隊才顯示） -->
    <div v-if="teamsInfo.length > 1" class="flex gap-3 px-3 pb-2 border-t border-white/10 pt-1">
      <div
        v-for="team in teamsInfo"
        :key="team.teamId"
        class="flex items-center gap-1 flex-wrap"
      >
        <span
          class="text-xs font-black px-1.5 py-0.5 rounded whitespace-nowrap"
          :class="team.teamId === 1 ? 'bg-white/30 text-white' : 'bg-yellow-400/70 text-black'"
        >{{ teamName(team.teamId) }}</span>
        <span
          v-for="member in team.members"
          :key="member.id"
          class="text-xs truncate max-w-[80px]"
          :class="member.isMe ? 'text-yellow-300 font-bold' : 'text-white/80'"
        >{{ member.name }}</span>
      </div>
    </div>
  </div>

  <!-- 橫向（≥sm）：右側完整面板 -->
  <div class="hud-landscape absolute top-4 right-4 pointer-events-auto flex-col gap-2 min-w-[200px] hidden sm:flex">
    <!-- 剩餘時間 -->
    <div class="bg-black/75 px-4 py-2 rounded-lg text-white text-center">
      <span class="text-sm font-bold uppercase tracking-widest opacity-70">剩餘時間</span>
      <div class="text-2xl font-black">{{ raceTime }}s</div>
    </div>

    <!-- 隊伍計分板 -->
    <div
      v-for="team in teamsInfo"
      :key="team.teamId"
      class="bg-black/75 rounded-lg overflow-hidden"
    >
      <div
        class="px-3 py-1 flex items-center justify-between"
        :class="team.teamId === 1 ? 'bg-white/30' : 'bg-yellow-400/50'"
      >
        <span
          class="text-xs font-black uppercase tracking-widest"
          :class="team.teamId === 1 ? 'text-white' : 'text-black'"
        >
          {{ teamName(team.teamId) }}
        </span>
        <span class="text-white font-black text-sm tabular-nums">{{ team.score }}</span>
      </div>
      <div
        v-for="member in team.members"
        :key="member.id"
        class="flex items-center gap-2 px-3 py-2 border-b border-white/10 last:border-0"
        :class="member.isMe ? 'bg-yellow-400/20' : ''"
      >
        <span
          class="flex-1 font-bold truncate text-sm"
          :class="member.isMe ? 'text-yellow-300' : 'text-white'"
        >
          {{ member.name }}
          <span v-if="member.isMe" class="text-xs opacity-70 ml-1">（你）</span>
        </span>
        <span class="text-white/60 text-xs">{{ member.controlLabel }}</span>
      </div>
    </div>

    <!-- 自己的圈數進度 -->
    <div class="bg-black/75 px-4 py-2 rounded-lg text-white">
      <div class="flex justify-between text-xs opacity-70 mb-1">
        <span>圈數 {{ laps }}</span>
        <span>{{ Math.round(lapProgress * 100) }}%</span>
      </div>
      <div class="w-full bg-white/20 rounded-full h-1.5">
        <div
          class="bg-yellow-400 h-1.5 rounded-full transition-all"
          :style="{ width: `${Math.round(lapProgress * 100)}%` }"
        />
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
  raceTime: number
  teamsInfo: TeamInfo[]
  laps: number
  lapProgress: number
}>()

const TEAM_NAMES: Record<number, string> = {
  1: '腦袋快轉隊',
  2: '大腦當機隊',
}

function teamName(id: number): string {
  return TEAM_NAMES[id] ?? `隊伍 ${id}`
}
</script>
