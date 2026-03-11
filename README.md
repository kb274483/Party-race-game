# 多人派對賽車遊戲 - 前端

這是一款支援 2-6 人同時遊玩的多人派對賽車遊戲前端專案。

## 技術棧

- **Vue3 + Nuxt4**: 應用框架
- **Three.js**: 3D 渲染引擎
- **Tailwind CSS**: 樣式框架
- **Pinia**: 狀態管理
- **WebRTC**: P2P 通訊
- **TypeScript**: 型別安全

## 專案結構

```
frontend/
├── components/       # Vue 組件
├── composables/      # Vue 組合式函數
├── stores/          # Pinia 狀態管理
├── types/           # TypeScript 型別定義
│   ├── game.ts      # 遊戲相關型別
│   ├── network.ts   # 網路通訊型別
│   ├── room.ts      # 房間管理型別
│   └── index.ts     # 型別統一匯出
├── utils/           # 工具函數和輔助類別
├── pages/           # Nuxt 頁面
├── layouts/         # Nuxt 佈局
├── public/          # 靜態資源
└── nuxt.config.ts   # Nuxt 配置
```

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
```

## 配置說明

### TypeScript

專案使用嚴格的 TypeScript 配置，啟用了型別檢查。所有型別定義位於 `types/` 目錄。

### Tailwind CSS

Tailwind CSS 已配置並整合到 Nuxt 中，可直接在組件中使用 Tailwind 類別。

### Pinia

Pinia 已配置為 Nuxt 模組，stores 將放置在 `stores/` 目錄中。

### SSR

由於遊戲需要客戶端渲染（Three.js、WebRTC），SSR 已在配置中禁用。

## 下一步

1. 實作房間管理系統
2. 實作 WebRTC 連線管理
3. 實作遊戲邏輯和物理引擎
4. 實作 3D 渲染系統
5. 實作 UI 組件

## 需求參考

詳細需求請參考：`.kiro/specs/multiplayer-party-racing-game/requirements.md`
