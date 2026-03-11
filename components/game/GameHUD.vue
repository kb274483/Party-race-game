<template>
  <div class="absolute top-4 right-4 pointer-events-auto flex flex-col gap-2 min-w-[200px]">
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
          隊伍 {{ team.teamId }}
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
</script>
