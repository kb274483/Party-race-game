<template>
  <div
    v-if="names.length > 0"
    class="absolute top-4 left-1/2 -translate-x-1/2 flex flex-col gap-2 pointer-events-none z-30"
  >
    <div
      v-for="name in names"
      :key="name"
      class="border-4 border-black bg-neo-accent px-5 py-2 font-black text-sm uppercase tracking-widest shadow-neo-sm text-center"
    >
      {{ name }} 已離線
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ names: string[] }>()
</script>
