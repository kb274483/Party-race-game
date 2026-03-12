<template>
  <!-- 只在行動裝置橫向模式顯示 -->
  <div class="virtual-controls fixed inset-0 pointer-events-none z-50 select-none"
    :style="safeAreaStyle"
  >
    <!-- 左側：轉向 D-pad -->
    <div class="absolute bottom-6 left-6 flex flex-row gap-3 pointer-events-auto">
      <!-- 左轉 -->
      <button
        v-if="hasControl(ControlType.TURN_LEFT)"
        class="ctrl-btn ctrl-turn"
        @touchstart.prevent="press(ControlType.TURN_LEFT)"
        @touchend.prevent="release(ControlType.TURN_LEFT)"
        @touchcancel.prevent="release(ControlType.TURN_LEFT)"
        @mousedown.prevent="press(ControlType.TURN_LEFT)"
        @mouseup.prevent="release(ControlType.TURN_LEFT)"
        @mouseleave="release(ControlType.TURN_LEFT)"
      >
        <span class="arrow arrow-left" />
      </button>
      <!-- 右轉 -->
      <button
        v-if="hasControl(ControlType.TURN_RIGHT)"
        class="ctrl-btn ctrl-turn"
        @touchstart.prevent="press(ControlType.TURN_RIGHT)"
        @touchend.prevent="release(ControlType.TURN_RIGHT)"
        @touchcancel.prevent="release(ControlType.TURN_RIGHT)"
        @mousedown.prevent="press(ControlType.TURN_RIGHT)"
        @mouseup.prevent="release(ControlType.TURN_RIGHT)"
        @mouseleave="release(ControlType.TURN_RIGHT)"
      >
        <span class="arrow arrow-right" />
      </button>
    </div>

    <!-- 右側：油門 + 煞車 -->
    <div class="absolute bottom-6 right-6 flex flex-row gap-3 pointer-events-auto">
      <!-- 煞車 -->
      <button
        v-if="hasControl(ControlType.BRAKE)"
        class="ctrl-btn ctrl-brake"
        @touchstart.prevent="press(ControlType.BRAKE)"
        @touchend.prevent="release(ControlType.BRAKE)"
        @touchcancel.prevent="release(ControlType.BRAKE)"
        @mousedown.prevent="press(ControlType.BRAKE)"
        @mouseup.prevent="release(ControlType.BRAKE)"
        @mouseleave="release(ControlType.BRAKE)"
      >
        煞車
      </button>
      <!-- 油門 -->
      <button
        v-if="hasControl(ControlType.ACCELERATE)"
        class="ctrl-btn ctrl-accelerate"
        @touchstart.prevent="press(ControlType.ACCELERATE)"
        @touchend.prevent="release(ControlType.ACCELERATE)"
        @touchcancel.prevent="release(ControlType.ACCELERATE)"
        @mousedown.prevent="press(ControlType.ACCELERATE)"
        @mouseup.prevent="release(ControlType.ACCELERATE)"
        @mouseleave="release(ControlType.ACCELERATE)"
      >
        油門
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { ControlType } from '~~/types/game'

const props = defineProps<{
  controls: ControlType[]
}>()

const emit = defineEmits<{
  press: [control: ControlType]
  release: [control: ControlType]
}>()

const hasControl = (control: ControlType) => props.controls.includes(control)

const press = (control: ControlType) => emit('press', control)
const release = (control: ControlType) => emit('release', control)

// 針對瀏海（notch）機型補充 safe area padding
const safeAreaStyle = computed(() => ({
  paddingLeft: 'env(safe-area-inset-left)',
  paddingRight: 'env(safe-area-inset-right)',
  paddingBottom: 'env(safe-area-inset-bottom)',
}))
</script>

<style scoped>
/* 只在行動裝置（pointer: coarse = 觸控螢幕）顯示，直向橫向均支援 */
.virtual-controls {
  display: none;
}

@media (pointer: coarse) {
  .virtual-controls {
    display: block;
  }
}

.ctrl-btn {
  /* 直向時用較小尺寸（64px），橫向時稍大（80px） */
  width: 80px;
  height: 80px;
  border-radius: 50%;
  border: 4px solid rgba(0, 0, 0, 0.8);
  font-size: 0.9rem;
  font-weight: 900;
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  -webkit-tap-highlight-color: transparent;
  user-select: none;
  -webkit-user-select: none;
  touch-action: none;
  transition: transform 0.08s, opacity 0.08s;
  box-shadow: 4px 4px 0 rgba(0, 0, 0, 0.6);
}

@media (orientation: landscape) {
  .ctrl-btn {
    width: 80px;
    height: 80px;
    font-size: 1.1rem;
  }
}

.ctrl-btn:active {
  transform: scale(0.9);
  opacity: 0.85;
  box-shadow: 2px 2px 0 rgba(0, 0, 0, 0.6);
}

.ctrl-turn {
  background: rgba(59, 130, 246, 0.75); /* blue */
}

/* CSS 三角形箭頭，完全避免 iOS emoji 替換問題 */
.arrow {
  display: block;
  width: 0;
  height: 0;
}

.arrow-left {
  border-top: 10px solid transparent;
  border-bottom: 10px solid transparent;
  border-right: 16px solid rgba(255, 255, 255, 0.95);
  margin-right: 3px; /* 視覺置中補正 */
}

.arrow-right {
  border-top: 10px solid transparent;
  border-bottom: 10px solid transparent;
  border-left: 16px solid rgba(255, 255, 255, 0.95);
  margin-left: 3px;
}

.ctrl-accelerate {
  background: rgba(34, 197, 94, 0.85); /* green */
  width: 76px;
  height: 76px;
  font-size: 0.85rem;
}

@media (orientation: landscape) {
  .ctrl-accelerate {
    width: 96px;
    height: 96px;
    font-size: 0.95rem;
  }
}

.ctrl-brake {
  background: rgba(239, 68, 68, 0.75); /* red */
  font-size: 0.8rem;
}
</style>
