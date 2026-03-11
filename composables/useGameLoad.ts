/**
 * 遊戲資源載入 Composable
 * 載入 raceTrack.glb、sportCar.glb
 */

import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { Group } from "three";

const TRACK_PATH = "/blender/raceTrack.glb";
// const TRACK_PATH = "/blender/track_wall_collider.glb";
const CAR_PATH = "/blender/sportCar.glb";

export interface GameLoadResult {
  track: Group | null;
  car: Group | null;
  error: string | null;
}

/**
 * 載入賽道與車輛模型
 * @returns Promise<GameLoadResult>
 */
export function useGameLoad(): () => Promise<GameLoadResult> {
  return () => {
    return new Promise<GameLoadResult>((resolve) => {
      const loader = new GLTFLoader();
      let trackLoaded = false;
      let carLoaded = false;
      let track: Group | null = null;
      let car: Group | null = null;
      let resolved = false;

      const tryResolve = () => {
        if (resolved) return;
        if (trackLoaded && carLoaded) {
          resolved = true;
          resolve({ track, car, error: null });
        }
      };

      loader.load(
        TRACK_PATH,
        (gltf) => {
          track = gltf.scene;
          trackLoaded = true;
          tryResolve();
        },
        undefined,
        (err) => {
          if (!resolved) {
            resolved = true;
            resolve({
              track: null,
              car: null,
              error: `賽道載入失敗: ${err instanceof Error ? err.message : "未知錯誤"}`,
            });
          }
        },
      );

      loader.load(
        CAR_PATH,
        (gltf) => {
          car = gltf.scene;
          carLoaded = true;
          tryResolve();
        },
        undefined,
        (err) => {
          if (!resolved) {
            resolved = true;
            resolve({
              track: null,
              car: null,
              error: `車輛載入失敗: ${err instanceof Error ? err.message : "未知錯誤"}`,
            });
          }
        },
      );
    });
  };
}
