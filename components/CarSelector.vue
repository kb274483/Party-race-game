<template>
  <div class="absolute inset-0 flex items-center justify-center bg-black/80 pointer-events-auto overflow-y-auto py-8 z-20">
    <div class="neo-card p-8 w-full max-w-lg mx-4" :class="isSelector ? '-rotate-1' : 'rotate-1'">
      <!-- 標題 -->
      <h2 class="font-black text-2xl uppercase tracking-widest mb-2 text-center">
        選擇車輛
      </h2>
      <p class="text-center font-bold text-black/60 mb-6 text-sm uppercase tracking-wider">
        隊伍 {{ teamId }} ─
        <span :class="isSelector ? 'text-black' : 'text-black/50'">
          {{ isSelector ? '輪到你選車' : '等待隊友選車...' }}
        </span>
      </p>

      <!-- Carousel -->
      <div class="relative flex items-center justify-center mb-4 select-none">
        <!-- 左箭頭 -->
        <button
          v-if="isSelector"
          type="button"
          class="neo-btn-outline w-12 h-12 flex items-center justify-center text-xl font-black mr-4 shrink-0"
          :disabled="currentIndex === 0 || isLoadingPreview"
          :class="(currentIndex === 0 || isLoadingPreview) ? 'opacity-30 cursor-not-allowed' : ''"
          @click="prev"
        >
          ‹
        </button>

        <!-- 預覽卡 -->
        <div class="flex-1 border-4 border-black shadow-neo-sm overflow-hidden bg-[#f5f5f0]">
          <!-- 車名 bar -->
          <div class="bg-black px-4 py-2 flex items-center justify-between">
            <span class="text-white font-black uppercase tracking-widest text-sm">
              {{ currentCar?.name ?? '─' }}
            </span>
            <span class="text-white/50 text-xs font-mono">
              {{ currentIndex + 1 }} / {{ cars.length }}
            </span>
          </div>

          <!-- 3D 預覽 canvas -->
          <div class="relative w-full" style="height: 220px;">
            <canvas
              ref="previewCanvas"
              class="w-full h-full block"
              width="400"
              height="220"
            />
            <!-- 載入中遮罩 -->
            <div
              v-if="isLoadingPreview"
              class="absolute inset-0 flex items-center justify-center bg-[#f5f5f0]/80"
            >
              <div class="w-8 h-8 border-4 border-black border-t-transparent rounded-full animate-spin" />
            </div>
          </div>
        </div>

        <!-- 右箭頭 -->
        <button
          v-if="isSelector"
          type="button"
          class="neo-btn-outline w-12 h-12 flex items-center justify-center text-xl font-black ml-4 shrink-0"
          :disabled="currentIndex === cars.length - 1 || isLoadingPreview"
          :class="(currentIndex === cars.length - 1 || isLoadingPreview) ? 'opacity-30 cursor-not-allowed' : ''"
          @click="next"
        >
          ›
        </button>

        <!-- 觀看者佔位 -->
        <div v-if="!isSelector" class="w-16 shrink-0" />
      </div>

      <!-- 性能條 -->
      <div v-if="currentCar" class="flex flex-col gap-2 mb-4 px-1">
        <div
          v-for="stat in statBars"
          :key="stat.label"
          class="flex items-center gap-3"
        >
          <span class="text-xs font-black uppercase tracking-wider w-14 shrink-0">{{ stat.label }}</span>
          <div class="flex-1 h-3 border-2 border-black bg-white overflow-hidden">
            <div
              class="h-full bg-black transition-all duration-300"
              :style="{ width: `${stat.pct}%` }"
            />
          </div>
          <span class="text-xs font-black w-8 text-right tabular-nums">{{ stat.raw }}</span>
        </div>
      </div>

      <!-- 進度點 -->
      <div class="flex justify-center gap-2 mb-6 flex-wrap">
        <button
          v-for="(_, i) in cars"
          :key="i"
          type="button"
          class="w-3 h-3 border-2 border-black rounded-full transition-all"
          :class="i === currentIndex ? 'bg-black' : 'bg-white'"
          :disabled="!isSelector || isLoadingPreview"
          @click="isSelector && !isLoadingPreview && goTo(i)"
        />
      </div>

      <!-- 確認 / 等待 -->
      <div v-if="isSelector && !confirmedCarId" class="flex justify-center">
        <button
          type="button"
          class="neo-btn-primary h-12 px-10 uppercase tracking-widest font-black"
          :disabled="isLoadingPreview"
          :class="isLoadingPreview ? 'opacity-50 cursor-not-allowed' : ''"
          @click="confirm"
        >
          確認選擇
        </button>
      </div>
      <div v-else-if="confirmedCarId" class="border-4 border-black bg-neo-accent p-3 text-center">
        <p class="font-black uppercase tracking-widest">
          {{ isSelector ? '已確認！等待對方選車...' : '隊友已選好車！等待對方...' }}
        </p>
      </div>
      <div v-else class="border-4 border-dashed border-black/30 p-3 text-center">
        <p class="font-bold text-black/50">等待選車代表確認...</p>
      </div>

      <!-- 各隊確認狀態 -->
      <div class="mt-6 flex gap-3 justify-center">
        <div
          v-for="(confirmed, tid) in teamStatus"
          :key="tid"
          class="border-2 border-black px-3 py-1 text-xs font-black uppercase"
          :class="confirmed ? 'bg-neo-accent' : 'bg-white'"
        >
          隊伍 {{ tid }} {{ confirmed ? '✓' : '…' }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import type { CarDefinition } from '~~/app/data/car-registry'

// 各屬性的量尺範圍（對應 registry 裡的實際極值）
const STAT_RANGES = {
  maxSpeed:     { min: 24, max: 38 },
  acceleration: { min: 10, max: 19 },
  turnSpeed:    { min: 1.6, max: 2.6 },
} as const
import { useCarPreview } from '~~/composables/useCarPreview'

const props = defineProps<{
  teamId: number
  isSelector: boolean
  confirmedCarId: string | null
  cars: CarDefinition[]
  teamStatus: Record<number, boolean>
}>()

const emit = defineEmits<{
  confirm: [carId: string]
}>()

const currentIndex = ref(0)
const currentCar = computed(() => props.cars[currentIndex.value] ?? null)

const statBars = computed(() => {
  const s = currentCar.value?.stats
  if (!s) return []
  const pct = (v: number, key: keyof typeof STAT_RANGES) => {
    const { min, max } = STAT_RANGES[key]
    return Math.round(((v - min) / (max - min)) * 100)
  }
  return [
    { label: '極速',   raw: s.maxSpeed,     pct: pct(s.maxSpeed,     'maxSpeed') },
    { label: '加速',   raw: s.acceleration, pct: pct(s.acceleration, 'acceleration') },
    { label: '操控',   raw: s.turnSpeed,    pct: pct(s.turnSpeed,    'turnSpeed') },
  ]
})
const isLoadingPreview = ref(false)

const previewCanvas = ref<HTMLCanvasElement | null>(null)
const preview = useCarPreview()

// 初始化預覽場景，並載入第一台車
onMounted(async () => {
  if (!previewCanvas.value || props.cars.length === 0) return
  preview.initialize(previewCanvas.value)
  await loadPreview()
})

onUnmounted(() => {
  preview.dispose()
})

// 當選擇的車輛變更時更新預覽
watch(currentIndex, async () => {
  await loadPreview()
})

const loadPreview = async () => {
  if (!currentCar.value) return
  isLoadingPreview.value = true
  await preview.loadCar(currentCar.value.file)
  isLoadingPreview.value = false
}

const prev = () => {
  if (currentIndex.value > 0) currentIndex.value--
}

const next = () => {
  if (currentIndex.value < props.cars.length - 1) currentIndex.value++
}

const goTo = (i: number) => {
  currentIndex.value = i
}

const confirm = () => {
  if (!currentCar.value) return
  emit('confirm', currentCar.value.id)
}
</script>
