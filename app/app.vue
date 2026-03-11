<template>
  <div class="min-h-screen bg-neo-bg font-sans">
    <NuxtRouteAnnouncer />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
    <!-- 全域錯誤 Toast，懸浮於所有頁面頂部 -->
    <ErrorToast />
  </div>
</template>
