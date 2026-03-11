<template>
  <div
    class="neo-card w-full min-h-[320px] p-6 sm:p-8 transition-all duration-200 rotate-1 hover:rotate-0"
  >
    <div class="border-b-4 border-black pb-4 mb-6 bg-neo-secondary/50 -m-6 sm:-m-8 p-6 sm:p-8">
      <h2 class="font-black text-2xl sm:text-3xl uppercase tracking-tight">
        加入房間
      </h2>
      <p class="font-bold text-sm mt-2 text-black/80">
        輸入房間代碼加入遊戲
      </p>
    </div>

    <form @submit.prevent="handleSubmit" class="space-y-6">
      <div>
        <label for="join-room-id" class="block font-bold text-sm uppercase tracking-widest mb-2">
          房間代碼
        </label>
        <input
          id="join-room-id"
          v-model="roomId"
          type="text"
          required
          placeholder="例如：ABC123"
          class="neo-input font-mono uppercase"
          :disabled="roomStore.isLoading"
        />
      </div>

      <div>
        <label for="join-player-name" class="block font-bold text-sm uppercase tracking-widest mb-2">
          你的名稱
        </label>
        <input
          id="join-player-name"
          v-model="playerName"
          type="text"
          required
          maxlength="20"
          placeholder="輸入暱稱"
          class="neo-input"
          :disabled="roomStore.isLoading"
        />
      </div>

      <div>
        <label for="join-password" class="block font-bold text-sm uppercase tracking-widest mb-2">
          房間密碼
          <span class="font-medium text-black/60 normal-case">（若房間有設定）</span>
        </label>
        <input
          id="join-password"
          v-model="password"
          type="password"
          placeholder="選填"
          class="neo-input"
          :disabled="roomStore.isLoading"
        />
      </div>

      <button
        type="submit"
        class="neo-btn-secondary w-full h-14 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        :disabled="roomStore.isLoading || !roomId.trim() || !playerName.trim()"
      >
        <span v-if="roomStore.isLoading">加入中...</span>
        <span v-else>加入房間</span>
      </button>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRoomStore } from '../stores/room'
import { useRouter } from 'vue-router'
const roomStore = useRoomStore()
const router = useRouter()

const roomId = ref('')
const playerName = ref('')
const password = ref('')

const handleSubmit = async () => {
  const name = playerName.value.trim()
  const rid = roomId.value.trim().toUpperCase()
  if (!rid || !name) return

  roomStore.clearError()
  try {
    await roomStore.joinRoom(rid, name, password.value || undefined)
    const actualRoomId = roomStore.currentRoom?.roomId
    if (actualRoomId) await router.push(`/room/${actualRoomId}`)
  } catch {
    // Error shown by store
  }
}
</script>
