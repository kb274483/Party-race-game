/**
 * useCarPreview
 * 在指定 canvas 上渲染單台車輛的旋轉預覽場景（選車用）
 */

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const CAR_TARGET_LENGTH = 3;

/** GLB 快取，避免切換車輛時重複網路請求 */
const modelCache = new Map<string, THREE.Group>();

export function useCarPreview() {
  let scene: THREE.Scene | null = null;
  let camera: THREE.PerspectiveCamera | null = null;
  let renderer: THREE.WebGLRenderer | null = null;
  let currentModel: THREE.Group | null = null;
  let animFrameId: number | null = null;
  let resizeObserver: ResizeObserver | null = null;
  const loader = new GLTFLoader();

  /** 依照 canvas 的實際 CSS 尺寸更新 renderer 與 camera */
  const syncSize = (canvas: HTMLCanvasElement) => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!renderer || !camera || w <= 0 || h <= 0) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };

  /** 初始化預覽場景，掛載到指定 canvas */
  const initialize = (canvas: HTMLCanvasElement) => {
    // 等一幀讓瀏覽器完成 layout，再讀取真實尺寸
    const w = canvas.clientWidth || 400;
    const h = canvas.clientHeight || 220;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf5f5f0); // 米白，與 neo-brutalism 一致

    camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
    camera.position.set(0, 2.5, 6);
    camera.lookAt(0, 0.5, 0);

    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(w, h, false); // false = 不設定 CSS 尺寸
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // 監聽 canvas 尺寸變化（裝置旋轉、視窗縮放）
    resizeObserver = new ResizeObserver(() => syncSize(canvas));
    resizeObserver.observe(canvas);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // 環境光：讓模型整體明亮
    const ambient = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(ambient);

    // 主光源：偏右上方，製造立體感
    const sun = new THREE.DirectionalLight(0xffd93d, 1.8);
    sun.position.set(5, 8, 5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(512, 512);
    scene.add(sun);

    // 補光：左後方柔和填補暗面
    const fill = new THREE.DirectionalLight(0xc4b5fd, 0.6);
    fill.position.set(-4, 3, -4);
    scene.add(fill);

    // 地板（接收陰影）
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(4, 64),
      new THREE.MeshStandardMaterial({ color: 0xe8e8e0, roughness: 0.9 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    startLoop();
  };

  /** 載入並顯示指定 GLB 車輛（有快取則直接使用） */
  const loadCar = async (file: string): Promise<void> => {
    if (!scene) return;

    // 移除舊模型
    if (currentModel) {
      scene.remove(currentModel);
      currentModel = null;
    }

    // 快取命中
    if (modelCache.has(file)) {
      const cached = modelCache.get(file)!;
      currentModel = cached.clone();
      scene.add(currentModel);
      return;
    }

    return new Promise((resolve) => {
      loader.load(
        file,
        (gltf) => {
          const model = gltf.scene;

          // 開啟陰影
          model.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });

          // 縮放至統一尺寸
          const box = new THREE.Box3().setFromObject(model);
          const size = new THREE.Vector3();
          box.getSize(size);
          const length = Math.max(size.x, size.z, 0.001);
          model.scale.setScalar(CAR_TARGET_LENGTH / length);

          // 貼地
          const boxAfter = new THREE.Box3().setFromObject(model);
          model.position.y = -boxAfter.min.y;

          // 置中（X/Z）
          const center = new THREE.Vector3();
          boxAfter.getCenter(center);
          model.position.x = -center.x;
          model.position.z = -center.z;

          modelCache.set(file, model);

          if (!scene) {
            resolve();
            return;
          }
          currentModel = model.clone();
          scene.add(currentModel);
          resolve();
        },
        undefined,
        () => resolve(), // 載入失敗時靜默，讓畫面顯示空場景
      );
    });
  };

  /** 渲染循環（含自動旋轉） */
  const startLoop = () => {
    const tick = () => {
      animFrameId = requestAnimationFrame(tick);
      if (currentModel) {
        currentModel.rotation.y += 0.008;
      }
      renderer?.render(scene!, camera!);
    };
    tick();
  };

  /** 釋放資源 */
  const dispose = () => {
    if (animFrameId !== null) {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }
    resizeObserver?.disconnect();
    resizeObserver = null;
    renderer?.dispose();
    renderer = null;
    scene = null;
    camera = null;
    currentModel = null;
  };

  return { initialize, loadCar, dispose };
}
