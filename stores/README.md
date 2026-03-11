# Pinia Stores

此目錄包含應用程式的 Pinia 狀態管理 stores。

## Room Store (房間管理)

`room.ts` 實作了房間管理功能，負責處理房間的建立、加入、離開和玩家列表管理。

### 功能特性

- ✅ 建立房間（支援密碼保護）
- ✅ 加入房間（支援密碼驗證）
- ✅ 離開房間
- ✅ 玩家列表管理（新增/移除玩家）
- ✅ 房間狀態查詢（是否在房間中、是否為房主、玩家數量等）
- ✅ 錯誤處理

### 狀態 (State)

```typescript
interface RoomState {
  currentRoom: RoomInfo | null        // 當前房間資訊
  currentPlayerId: string | null      // 當前玩家 ID
  currentPlayerName: string | null    // 當前玩家名稱
  isLoading: boolean                  // 載入狀態
  error: string | null                // 錯誤訊息
}
```

### Getters

- `isInRoom`: 是否在房間中
- `isHost`: 是否為房主
- `currentPlayer`: 當前玩家資訊
- `players`: 玩家列表
- `playerCount`: 玩家數量
- `isRoomFull`: 房間是否已滿

### Actions

#### 建立房間
```typescript
async createRoom(playerName: string, password?: string): Promise<RoomInfo>
```

#### 加入房間
```typescript
async joinRoom(roomId: string, playerName: string, password?: string): Promise<void>
```

#### 離開房間
```typescript
async leaveRoom(): Promise<void>
```

#### 更新房間資訊
```typescript
updateRoomInfo(roomInfo: RoomInfo): void
```

#### 新增玩家
```typescript
addPlayer(player: PlayerInfo): void
```

#### 移除玩家
```typescript
removePlayer(playerId: string): void
```

#### 清除房間狀態
```typescript
clearRoom(): void
```

### 使用範例

請參考 `room.example.ts` 檔案，其中包含完整的使用範例。

### API 整合

Room Store 與後端 API 整合，使用以下端點：

- `POST /api/rooms` - 建立房間
- `POST /api/rooms/:roomId/join` - 加入房間
- `DELETE /api/rooms/:roomId/leave` - 離開房間
- `GET /api/rooms/:roomId` - 取得房間資訊

### 需求對應

此實作滿足以下需求：

- **需求 1.1**: 提供建立房間功能
- **需求 1.2**: 生成唯一的 Room ID（由後端處理）
- **需求 1.4**: 提供加入房間功能
- **需求 1.6**: 要求玩家輸入玩家名稱
- **需求 1.8**: 將第一個建立房間的玩家設定為 Host

### 與 WebRTC 整合

Room Store 提供了 `addPlayer`、`removePlayer` 和 `updateRoomInfo` 方法，用於處理透過 WebRTC 接收到的房間狀態更新。當其他玩家加入或離開房間時，WebRTC Manager 應該呼叫這些方法來同步房間狀態。

### 測試

單元測試位於 `room.test.ts`，涵蓋：

- 初始狀態驗證
- Getters 功能測試
- Actions 功能測試
- 錯誤處理測試

執行測試（需要先設定 Vitest）：
```bash
npm test -- stores/room.test.ts
```

### 注意事項

1. **玩家 ID 生成**: Store 會自動生成唯一的玩家 ID，格式為 `player_{timestamp}_{random}`
2. **房主離開**: 當房主離開房間時，房間會被關閉，所有狀態會被清除
3. **錯誤處理**: 所有 API 呼叫都包含錯誤處理，錯誤訊息會儲存在 `error` 狀態中
4. **載入狀態**: `isLoading` 狀態可用於顯示載入指示器

### 未來改進

- [ ] 新增房間列表功能
- [ ] 新增房間搜尋功能
- [ ] 新增玩家踢出功能（僅房主）
- [ ] 新增房間設定更新功能
- [ ] 新增離線重連邏輯
