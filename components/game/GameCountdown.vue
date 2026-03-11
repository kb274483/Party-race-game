<template>
  <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
    <div class="neo-card p-16 text-center rotate-1 pointer-events-auto">
      <p class="font-bold text-xl uppercase tracking-widest mb-2">準備開始</p>
      <p class="font-black text-8xl sm:text-9xl">{{ countdownTime }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ countdownTime: number }>()
</script>
