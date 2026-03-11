<template>
  <Transition
    enter-active-class="transition-all duration-300 ease-out"
    enter-from-class="opacity-0 -translate-y-4"
    enter-to-class="opacity-100 translate-y-0"
    leave-active-class="transition-all duration-200 ease-in"
    leave-from-class="opacity-100 translate-y-0"
    leave-to-class="opacity-0 -translate-y-4"
  >
    <div
      v-if="roomStore.error"
      class="fixed top-6 left-1/2 -translate-x-1/2 z-[9999] w-full max-w-md px-4"
      role="alert"
    >
      <div class="neo-card bg-neo-accent border-4 border-black flex items-start gap-4 p-5">
        <!-- 警示圖示 -->
        <div class="shrink-0 w-8 h-8 bg-black text-white font-black text-lg flex items-center justify-center select-none">
          !
        </div>

        <!-- 訊息 -->
        <p class="font-bold text-sm sm:text-base leading-snug flex-1 pt-0.5">
          {{ roomStore.error }}
        </p>

        <!-- 關閉按鈕 -->
        <button
          type="button"
          class="shrink-0 w-8 h-8 font-black text-xl leading-none hover:bg-black/10 flex items-center justify-center transition-colors"
          aria-label="關閉"
          @click="roomStore.clearError()"
        >
          ×
        </button>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { watch } from 'vue'
import { useRoomStore } from '../stores/room'

const roomStore = useRoomStore()

// 5 秒後自動關閉
let autoCloseTimer: ReturnType<typeof setTimeout> | null = null

watch(
  () => roomStore.error,
  (err) => {
    if (autoCloseTimer) clearTimeout(autoCloseTimer)
    if (err) {
      autoCloseTimer = setTimeout(() => roomStore.clearError(), 5000)
    }
  },
)
</script>
