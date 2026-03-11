# 車輛模型目錄

將 GLB 格式的車輛模型放在此目錄。

每新增一個車輛模型後，請同步更新 `app/data/car-registry.ts`，加入一筆記錄：

```ts
{
  id: "my_car",          // 唯一 ID（英數字、底線）
  name: "我的賽車",       // 顯示名稱
  file: "/cars/my_car.glb",  // 對應此目錄的路徑
  previewColor: 0xff0000,    // 預覽顏色（十六進位）
}
```

車輛即可自動出現在選車畫面。
