<template>
  <div class="absolute inset-0 flex items-center justify-center bg-black/75 pointer-events-auto">
    <div class="neo-card p-6 border-neo-accent bg-neo-accent/20">
      <p class="font-bold text-center">{{ error }}</p>
      <p class="text-sm text-black/60 mt-2 text-center">
        .glb 模型檔案載入失敗，請檢查相關檔案是否存在
      </p>
      <div class="flex flex-col gap-3 mt-4">
        <button
          v-if="isDev"
          type="button"
          class="neo-btn-secondary h-12"
          @click="emit('skipLoad')"
        >
          開發模式：跳過載入
        </button>
        <button
          type="button"
          class="neo-btn-outline h-12"
          @click="emit('backToRoom')"
        >
          返回房間
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  error: string
  isDev: boolean
}>()

const emit = defineEmits<{
  skipLoad: []
  backToRoom: []
}>()
</script>
