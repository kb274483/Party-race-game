<template>
  <div class="min-h-screen bg-neo-bg font-sans">
    <NuxtRouteAnnouncer />
    <!-- 定時休眠告示 -->
    <div v-if="isServerSleeping" class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div class="mx-4 rounded-2xl border-4 border-yellow-400 bg-gray-900 px-8 py-10 text-center shadow-2xl">
        <div class="mb-4 text-5xl">😴</div>
        <h1 class="mb-3 text-2xl font-bold text-yellow-400">網站定時休眠中</h1>
        <p class="text-lg text-gray-200">目前是網站定時休眠時間</p>
        <p class="mt-2 text-lg text-gray-200">請在 <span class="font-bold text-yellow-300">AM 10:00 ~ PM 11:00</span> 間來訪</p>
      </div>
    </div>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
    <!-- 全域錯誤 Toast，懸浮於所有頁面頂部 -->
    <ErrorToast />
  </div>
</template>

<script setup lang="ts">
  const isServerSleeping = computed(() => {
    // 台灣時間 UTC+8，開機時間 10:00~23:00
    const now = new Date()
    const taiwanHour = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Taipei' })).getHours()
    return taiwanHour < 10 || taiwanHour >= 23
  })
</script>
