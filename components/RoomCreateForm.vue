<template>
  <div
    class="neo-card w-full min-h-[320px] p-6 sm:p-8 transition-all duration-200 -rotate-1 hover:rotate-0"
  >
    <div class="border-b-4 border-black pb-4 mb-6 bg-neo-muted/30 -m-6 sm:-m-8 p-6 sm:p-8">
      <h2 class="font-black text-2xl sm:text-3xl uppercase tracking-tight">
        建立房間
      </h2>
      <p class="font-bold text-sm mt-2 text-black/80">
        成為房主，邀請好友一起玩
      </p>
    </div>

    <form @submit.prevent="handleSubmit" class="space-y-6">
      <div>
        <label for="create-player-name" class="block font-bold text-sm uppercase tracking-widest mb-2">
          你的名稱
        </label>
        <input
          id="create-player-name"
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
        <label class="flex items-center gap-3 cursor-pointer">
          <input
            v-model="usePassword"
            type="checkbox"
            class="w-5 h-5 border-4 border-black accent-neo-accent"
          />
          <span class="font-bold text-sm uppercase">設定房間密碼</span>
        </label>
      </div>

      <div v-if="usePassword">
        <label for="create-password" class="block font-bold text-sm uppercase tracking-widest mb-2">
          房間密碼
        </label>
        <input
          id="create-password"
          v-model="password"
          type="password"
          :required="usePassword"
          placeholder="選填"
          class="neo-input"
          :disabled="roomStore.isLoading"
        />
      </div>

      <button
        type="submit"
        class="neo-btn-primary w-full h-14 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        :disabled="roomStore.isLoading || !playerName.trim()"
      >
        <span v-if="roomStore.isLoading">建立中...</span>
        <span v-else>建立房間</span>
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

const playerName = ref('')
const usePassword = ref(false)
const password = ref('')

const handleSubmit = async () => {
  const name = playerName.value.trim()
  if (!name) return

  roomStore.clearError()
  try {
    await roomStore.createRoom(name, usePassword.value ? password.value : undefined)
    const roomId = roomStore.currentRoom?.roomId
    if (roomId) {
      await router.push(`/room/${roomId}`)
    }
  } catch {
    // Error shown by store
  }
}
</script>
