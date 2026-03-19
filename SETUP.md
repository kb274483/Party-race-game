# 前端開發環境設置

## 前置需求

- Node.js 18+
- npm 9+
- 後端服務已啟動（預設 `http://localhost:8080`）

## 快速啟動

```bash
# 安裝依賴
npm install

# 啟動開發伺服器（http://localhost:3000）
npm run dev
```

## 環境變數

在 `frontend/` 根目錄建立 `.env` 檔案：

```env
NUXT_PUBLIC_API_BASE=http://localhost:8080
NUXT_PUBLIC_WS_URL=ws://localhost:8080/ws
```

若不設定，預設會根據當前 `window.location.hostname` 自動推導 WebSocket URL。

## 指令說明

| 指令 | 說明 |
|------|------|
| `npm run dev` | 啟動開發伺服器（含 HMR） |
| `npm run build` | 建置生產版本 |
| `npm run preview` | 預覽生產建置結果 |
| `npm run generate` | 產生靜態檔案 |
| `npx vitest` | 執行單元測試 |
| `npx vitest --ui` | 開啟測試 UI 介面 |

## 已安裝套件

**生產依賴：**

| 套件 | 版本 | 用途 |
|------|------|------|
| `nuxt` | ^4.3.1 | 應用框架 |
| `vue` | ^3.5 | UI 框架 |
| `three` | ^0.183 | 3D 渲染引擎 |
| `@types/three` | ^0.183 | Three.js 型別 |
| `pinia` | ^3.0 | 狀態管理 |
| `@pinia/nuxt` | ^0.11 | Pinia Nuxt 模組 |

**開發依賴：**

| 套件 | 版本 | 用途 |
|------|------|------|
| `tailwindcss` | ^3.4 | CSS 框架 |
| `@nuxtjs/tailwindcss` | ^6.14 | Tailwind Nuxt 模組 |
| `vitest` | ^3.2 | 單元測試框架 |
| `vue-tsc` | ^3.2 | Vue TypeScript 編譯器 |
| `typescript` | ^5.9 | TypeScript |

## 注意事項

- 專案為純客戶端渲染（`ssr: false`），不支援 SSR
- 多人模式需要後端 WebSocket 服務（`/ws`）同時運行
- 3D 模型資源（`.glb`）放置於 `public/blender/`（賽道）與 `public/cars/`（車輛）
