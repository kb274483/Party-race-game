/**
 * 車輛清單
 * 只需在此新增一筆記錄，車輛即可出現在選車畫面。
 * file 欄位對應 public/cars/ 目錄下的 GLB 檔案。
 */

export interface CarStats {
  /** 最高速度（基準 30） */
  maxSpeed: number;
  /** 加速度（基準 14） */
  acceleration: number;
  /** 轉向速度（基準 2.0，越高越靈活） */
  turnSpeed: number;
  /** 車重（輕量 ~0.75、標準 1.0、重型 ~1.4）影響車對車碰撞結果 */
  weight: number;
  /** 模型縮放倍率（預設 1.0，用於修正個別車型的視覺大小） */
  scaleMultiplier?: number;
}

export interface CarDefinition {
  /** 唯一識別 ID */
  id: string;
  /** 顯示名稱 */
  name: string;
  /** GLB 檔案路徑（public/ 目錄為根） */
  file: string;
  /** 車輛性能數值 */
  stats: CarStats;
}

/** 各車種找不到時的預設值 */
export const DEFAULT_CAR_STATS: CarStats = {
  maxSpeed: 30,
  acceleration: 14,
  turnSpeed: 2.0,
  weight: 1.0,
};

export const CAR_REGISTRY: CarDefinition[] = [
  // ── 速度型：極速最高，轉彎較遲鈍，車身輕量 ──────────────────
  {
    id: "sport_car",
    name: "跑車",
    file: "/cars/sport_car.glb",
    stats: { maxSpeed: 36, acceleration: 15, turnSpeed: 1.8, weight: 0.75 },
  },
  {
    id: "roadster",
    name: "敞篷跑車",
    file: "/cars/roadster.glb",
    stats: { maxSpeed: 35, acceleration: 15, turnSpeed: 1.9, weight: 0.75 },
  },
  {
    id: "police_sport",
    name: "跑車＿警用塗裝",
    file: "/cars/police_sport.glb",
    stats: { maxSpeed: 36, acceleration: 16, turnSpeed: 1.8, weight: 0.75 },
  },

  // ── 衝刺型：加速爆發強，轉彎最遲鈍，中重型 ──────────────────
  {
    id: "muscle",
    name: "美式肌肉車",
    file: "/cars/muscle.glb",
    stats: { maxSpeed: 33, acceleration: 20, turnSpeed: 1.7, weight: 1.15 },
  },
  {
    id: "muscle_two",
    name: "美式肌肉車 II",
    file: "/cars/muscle_two.glb",
    stats: { maxSpeed: 34, acceleration: 19, turnSpeed: 1.6, weight: 1.2 },
  },
  {
    id: "police_muscle",
    name: "美式肌肉車＿警用塗裝",
    file: "/cars/police_muscle.glb",
    stats: { maxSpeed: 32, acceleration: 20, turnSpeed: 1.7, weight: 1.15 },
  },

  // ── 均衡型：各項平衡，容易上手，標準車重 ────────────────────
  {
    id: "sedan",
    name: "小轎車",
    file: "/cars/sedan.glb",
    stats: { maxSpeed: 30, acceleration: 14, turnSpeed: 2.1, weight: 1.0 },
  },
  {
    id: "hatchback",
    name: "掀背車",
    file: "/cars/hatchback.glb",
    stats: { maxSpeed: 30, acceleration: 14, turnSpeed: 2.2, weight: 0.9 },
  },
  {
    id: "limousine",
    name: "豪華轎車",
    file: "/cars/limousine.glb",
    stats: { maxSpeed: 28, acceleration: 13, turnSpeed: 1.8, weight: 1.2, scaleMultiplier: 1.5 },
  },
  {
    id: "pickup",
    name: "皮卡",
    file: "/cars/pickup.glb",
    stats: { maxSpeed: 29, acceleration: 14, turnSpeed: 2.0, weight: 1.0 },
  },
  {
    id: "suv",
    name: "休旅車",
    file: "/cars/suv.glb",
    stats: { maxSpeed: 28, acceleration: 13, turnSpeed: 2.1, weight: 1.0 },
  },
  {
    id: "van",
    name: "廂型車",
    file: "/cars/van.glb",
    stats: { maxSpeed: 27, acceleration: 12, turnSpeed: 2.0, weight: 1.0 },
  },

  // ── 操控型：極速最低，轉彎最靈活，重型車身 ──────────────────
  {
    id: "monster",
    name: "怪獸越野車",
    file: "/cars/monster.glb",
    stats: { maxSpeed: 26, acceleration: 12, turnSpeed: 2.4, weight: 1.3 },
  },
  {
    id: "truck",
    name: "卡車",
    file: "/cars/truck.glb",
    stats: { maxSpeed: 25, acceleration: 10, turnSpeed: 2.4, weight: 1.5 },
  },
  {
    id: "truck_full",
    name: "聯結卡車",
    file: "/cars/truck_full.glb",
    stats: {
      maxSpeed: 23,
      acceleration: 9,
      turnSpeed: 2.2,
      weight: 1.7,
      scaleMultiplier: 2.5,
    },
  },
];
