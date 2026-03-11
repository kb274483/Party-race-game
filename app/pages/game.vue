<template>
  <div class="game-container w-full h-screen overflow-hidden bg-black">
    <!-- 遊戲畫布 -->
    <div ref="canvasContainer" class="w-full h-full"></div>
    
    <!-- 虛擬控制按鈕（行動裝置） -->
    <VirtualControls v-if="playerControls.length > 0" :controls="playerControls" />
    
    <!-- 遊戲 UI -->
    <div class="game-ui absolute top-4 right-4 text-white">
      <div class="bg-black bg-opacity-50 p-4 rounded-lg">
        <div class="text-xl font-bold mb-2">剩餘時間: {{ remainingTime }}s</div>
        <div class="text-lg">分數: {{ score }}</div>
      </div>
    </div>
    
    <!-- 載入中 -->
    <div v-if="loading" class="absolute inset-0 flex items-center justify-center bg-black bg-opacity-75">
      <div class="text-white text-2xl">載入中...</div>
    </div>
    
    <!-- 錯誤訊息 -->
    <div v-if="error" class="absolute inset-0 flex items-center justify-center bg-black bg-opacity-75">
      <div class="text-red-500 text-2xl">{{ error }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useGameLoop } from '../../composables/useGameLoop';
import { useGameStore } from '../../stores/game';
import { ControlType } from '../../types/game';

const gameStore = useGameStore();
const gameLoop = useGameLoop();

const canvasContainer = ref<HTMLDivElement | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);
const remainingTime = ref(60);
const score = ref(0);
const playerControls = ref<ControlType[]>([]);

// 示例：玩家控制項目（實際應從 gameStore 獲取）
const playerCarId = 'player1';

onMounted(async () => {
  try {
    if (!canvasContainer.value) {
      throw new Error('Canvas container not found');
    }
    
    // 獲取玩家控制項目（示例）
    // 實際應該從 control allocator 或 game store 獲取
    playerControls.value = [
      ControlType.ACCELERATE,
      ControlType.BRAKE,
      ControlType.TURN_LEFT,
      ControlType.TURN_RIGHT
    ];
    
    // 初始化遊戲
    await gameLoop.initialize(
      canvasContainer.value as HTMLElement,
      playerControls.value,
      playerCarId
    );
    
    // 註冊虛擬按鈕事件（如果有輸入處理器）
    registerVirtualButtons();
    
    loading.value = false;
    
    // 開始遊戲循環
    gameLoop.start();
    
    // 開始計時器
    startTimer();
    
  } catch (err) {
    console.error('初始化遊戲失敗:', err);
    error.value = '初始化遊戲失敗';
    loading.value = false;
  }
});

onUnmounted(() => {
  gameLoop.dispose();
});

/**
 * 註冊虛擬按鈕事件
 */
const registerVirtualButtons = () => {
  // 這裡需要從 gameLoop 獲取 inputHandler 並註冊按鈕
  // 由於架構限制，這部分可能需要調整
  // 暫時留空，實際使用時需要實現
};

/**
 * 開始計時器
 */
const startTimer = () => {
  const interval = setInterval(() => {
    remainingTime.value--;
    
    if (remainingTime.value <= 0) {
      clearInterval(interval);
      gameLoop.stop();
      // 顯示結算畫面
    }
  }, 1000);
};
</script>

<style scoped>
.game-container {
  position: relative;
}
</style>
