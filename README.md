# 多人派對賽車遊戲 - 前端

這是一款支援 2-6 人同時遊玩的多人派對賽車遊戲前端專案。玩家以雙數分隊，每隊兩人分別控制「油門/煞車」與「轉向」，共同操控同一輛車競速。

## 技術棧

- **Vue 3 + Nuxt 4**：應用框架（CSR 模式）
- **Three.js**：3D 渲染引擎（車輛、賽道、特效）
- **Tailwind CSS**：樣式框架
- **Pinia**：狀態管理
- **WebSocket**：即時多人通訊（車輛狀態同步、選車、計時同步）
- **TypeScript**：型別安全
- **Vitest**：單元測試

## 專案結構

```
frontend/
├── app/
│   ├── assets/css/        # 全域樣式
│   ├── data/              # 靜態資料（車輛清單 car-registry.ts）
│   ├── layouts/           # Nuxt 佈局
│   └── pages/
│       ├── index.vue      # 首頁（建立 / 加入房間）
│       └── room/[roomId]/
│           ├── index.vue  # 房間等待室
│           └── game.vue   # 遊戲主頁面
├── components/
│   ├── game/              # 遊戲 UI 元件（HUD、倒數、結算、斷線通知等）
│   ├── CarSelector.vue    # 選車介面
│   ├── VirtualControls.vue # 行動裝置虛擬搖桿
│   ├── RoomCreateForm.vue
│   └── RoomJoinForm.vue
├── composables/
│   ├── useGameLoop.ts     # 遊戲主循環（物理 + 渲染整合）
│   ├── useGameNetwork.ts  # 遊戲期間 WebSocket 車輛狀態同步
│   ├── useRoomSignaling.ts # 房間等待室 WebSocket 信令
│   ├── useCarPreview.ts   # 選車預覽 3D 渲染
│   └── useWakeLock.ts     # 防止行動裝置螢幕休眠
├── stores/
│   ├── game.ts            # 遊戲狀態（phase、玩家分配、難度、計時）
│   └── room.ts            # 房間狀態（玩家清單、房主）
├── types/
│   ├── game.ts            # 遊戲相關型別（RaceCar、Obstacle、GameDifficulty 等）
│   ├── network.ts         # 網路通訊型別（SignalMessage）
│   └── room.ts            # 房間管理型別
├── utils/
│   ├── renderer/          # Three.js 渲染器（分模組）
│   │   ├── index.ts       # GameRenderer 主協調類別
│   │   ├── car-model-manager.ts  # 車輛模型、障礙物、加速帶、車燈
│   │   ├── track-loader.ts       # 賽道 GLB 載入
│   │   ├── explosion-effect.ts   # 撞到地雷爆炸特效
│   │   └── speed-effect.ts       # 高速視覺特效
│   ├── physics-engine.ts  # 車輛物理模擬
│   ├── race-track-generator.ts   # 賽道生成（含難度參數）
│   ├── control-allocator.ts      # 控制按鍵分配邏輯
│   ├── input-handler.ts   # 鍵盤 / 觸控輸入處理
│   ├── track-collision.ts # 賽道邊界碰撞偵測
│   ├── score-calculator.ts # 得分計算
│   ├── signaling-client.ts # WebSocket 信令客戶端封裝
│   └── game-renderer.ts   # 渲染器向下相容包裝（legacy）
├── public/
│   ├── blender/           # 賽道 GLB 模型
│   └── cars/              # 車輛 GLB 模型
├── nuxt.config.ts
└── vitest.config.ts
```

## 遊戲難度

| 等級 | 說明 |
|------|------|
| 1 | 靜止地雷 |
| 2 | 地雷慢速移動 |
| 3 | 地雷快速移動 |
| 4 | 夜間模式 + 快速地雷（車頭燈開啟） |

## 開發指令

```bash
# 安裝依賴
npm install

# 啟動開發伺服器
npm run dev

# 建置生產版本
npm run build

# 預覽生產版本
npm run preview

# 執行單元測試
npm run test
```

## 配置說明

### 環境變數

| 變數 | 說明 |
|------|------|
| `NUXT_PUBLIC_API_BASE` | 後端 HTTP API 基礎 URL |
| `NUXT_PUBLIC_WS_URL` | WebSocket 伺服器 URL（預設自動根據 hostname 推導） |

### SSR

由於遊戲需要客戶端渲染（Three.js、WebSocket、瀏覽器 API），SSR 已在 `nuxt.config.ts` 中禁用（`ssr: false`）。
