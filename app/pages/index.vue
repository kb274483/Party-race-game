<template>
  <div class="min-h-screen bg-neo-bg relative overflow-hidden">
    <!-- Background texture -->
    <div
      class="absolute inset-0 opacity-[0.03] pointer-events-none"
      style="background-image: radial-gradient(#000 1.5px, transparent 1.5px); background-size: 20px 20px;"
    />

    <div class="relative container mx-auto max-w-6xl px-6 py-12 sm:py-20">
      <!-- Hero section -->
      <header class="text-center mb-8 sm:mb-12">
        <div class="flex justify-center items-center gap-4">
          <h1
            class="font-black text-5xl sm:text-7xl md:text-8xl uppercase tracking-tighter mb-4 -rotate-1"
            style="-webkit-text-stroke: 2px black; color: transparent;"
          >
            PARTY
          </h1>
          <h1
            class="font-black text-5xl sm:text-7xl md:text-8xl uppercase tracking-tighter text-neo-accent border-4 border-black inline-block px-6 py-2 shadow-neo-lg rotate-1"
          >
            RACE
          </h1>
        </div>
        <p class="font-bold text-xl sm:text-2xl mt-8 text-black/80 max-w-2xl mx-auto">
          2–6 人協作賽車 · 即時對戰
        </p>
      </header>

      <!-- Forms section - asymmetric 60/40 split -->
      <div class="grid grid-cols-1 lg:grid-cols-5 gap-8 lg:gap-12">
        <!-- Create room card -->
        <div class="lg:col-span-3 w-full min-w-0">
          <RoomCreateForm />
        </div>

        <!-- Join room card -->
        <div class="lg:col-span-2 w-full min-w-0">
          <RoomJoinForm />
        </div>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import RoomCreateForm from "~~/components/RoomCreateForm.vue"
import RoomJoinForm from "~~/components/RoomJoinForm.vue"
import { useRoomStore } from "~~/stores/room"

const roomStore = useRoomStore()
</script>
