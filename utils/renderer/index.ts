/**
 * GameRenderer - Three.js 渲染器（主協調類別）
 * 組合 TrackLoader / CarModelManager / ExplosionEffect / SpeedEffect
 * 對外暴露與原本完全相同的公開 API，呼叫端無需任何變更
 */

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type {
  RaceCar,
  Obstacle,
  SpeedBoost,
  BoundingBox,
} from "../../types/game";
import { TrackLoader } from "./track-loader";
import { CarModelManager } from "./car-model-manager";
import { ExplosionEffect } from "./explosion-effect";
import { SpeedEffect } from "./speed-effect";

const CAMERA_DISTANCE = 4;
const CAMERA_HEIGHT = 5;

export class GameRenderer {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private loader: GLTFLoader;

  private trackLoader!: TrackLoader;
  private carManager!: CarModelManager;
  private explosionEffect!: ExplosionEffect;
  private speedEffect!: SpeedEffect;

  private cameraOffset = new THREE.Vector3(0, CAMERA_HEIGHT, -CAMERA_DISTANCE);
  private cameraLookAtOffset = new THREE.Vector3(0, 1, 15);
  private cameraSmoothness = 0.3;

  // 預先建立的快取物件，避免每幀 GC 壓力
  private _camCarPos = new THREE.Vector3();
  private _camCarQuat = new THREE.Quaternion();
  private _camOffset = new THREE.Vector3();
  private _camTargetPos = new THREE.Vector3();
  private _camLookAt = new THREE.Vector3();

  private container: HTMLElement | null = null;
  private resizeObserver: ResizeObserver | null = null;
  // 儲存 bound 參考以正確移除 listener
  private boundWindowResize: (() => void) | null = null;

  private readonly isMobile: boolean;

  constructor() {
    this.isMobile =
      typeof window !== "undefined" &&
      window.matchMedia("(pointer: coarse)").matches;

    this.scene = new THREE.Scene();
    // 初始 aspect 先用 1，initialize() 時會依容器尺寸修正
    this.camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    // 行動裝置關閉 antialias，GPU 負擔顯著降低，視覺差異極小
    this.renderer = new THREE.WebGLRenderer({ antialias: !this.isMobile });
    this.loader = new GLTFLoader();
  }

  initialize(container: HTMLElement): void {
    this.container = container;
    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;

    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    // 行動裝置限制 pixelRatio 1.5，桌面維持 2
    this.renderer.setPixelRatio(
      Math.min(window.devicePixelRatio, this.isMobile ? 1.5 : 2),
    );
    this.renderer.shadowMap.enabled = true;
    // 行動裝置用 BasicShadowMap（效能優先），桌面用 PCFSoftShadowMap（品質優先）
    this.renderer.shadowMap.type = this.isMobile
      ? THREE.BasicShadowMap
      : THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.scene.background = new THREE.Color(0x5badec);
    this.scene.fog = new THREE.Fog(0x5badec, 300, 750);

    const ambientLight = new THREE.AmbientLight(0xfff4e0, 1.0);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffd93d, 1.2);
    directionalLight.position.set(100, 200, 100);
    directionalLight.castShadow = true;
    directionalLight.shadow.camera.left = -500;
    directionalLight.shadow.camera.right = 500;
    directionalLight.shadow.camera.top = 500;
    directionalLight.shadow.camera.bottom = -500;
    // 行動裝置 shadow map 512，桌面 1024（原本 2048）
    const shadowMapSize = this.isMobile ? 512 : 1024;
    directionalLight.shadow.mapSize.width = shadowMapSize;
    directionalLight.shadow.mapSize.height = shadowMapSize;
    directionalLight.shadow.bias = -0.0005;
    this.scene.add(directionalLight);

    const fillLight = new THREE.DirectionalLight(0xc4b5fd, 0.4);
    fillLight.position.set(-100, 50, -100);
    this.scene.add(fillLight);

    this.trackLoader = new TrackLoader(this.scene, this.loader);
    this.carManager = new CarModelManager(this.scene, this.loader);
    this.explosionEffect = new ExplosionEffect(
      this.scene,
      () => this.carManager.trackYOffset,
    );
    this.speedEffect = new SpeedEffect();
    this.speedEffect.init(container);

    // ResizeObserver：容器尺寸改變（含裝置旋轉）時立即 resize
    this.resizeObserver = new ResizeObserver(() => this.onContainerResize());
    this.resizeObserver.observe(container);

    // window resize 作為 fallback（舊版瀏覽器）
    this.boundWindowResize = this.onWindowResize.bind(this);
    window.addEventListener("resize", this.boundWindowResize);
  }

  // ── Track ──────────────────────────────────────────────────────

  async loadTrack(trackPath: string) {
    return this.trackLoader.loadTrack(trackPath);
  }

  async loadColliderMesh(colliderPath: string) {
    return this.trackLoader.loadColliderMesh(colliderPath);
  }

  getTrackBounds(): BoundingBox | null {
    return this.trackLoader.getTrackBounds();
  }

  getTrackModel(): THREE.Group | null {
    return this.trackLoader.getTrackModel();
  }

  getTrackSurfaceMeshes(): THREE.Mesh[] {
    return this.trackLoader.getTrackSurfaceMeshes();
  }

  // ── Cars ───────────────────────────────────────────────────────

  async loadCar(carId: string, carPath: string) {
    return this.carManager.loadCar(carId, carPath);
  }

  renderObstacles(obstacles: Obstacle[], yOffset?: number) {
    this.carManager.renderObstacles(obstacles, yOffset);
  }

  renderSpeedBoosts(boosts: SpeedBoost[], yOffset?: number) {
    this.carManager.renderSpeedBoosts(boosts, yOffset);
  }

  setCarColor(carId: string, color: number) {
    this.carManager.setCarColor(carId, color);
  }

  updateCar(carId: string, car: RaceCar) {
    this.carManager.updateCar(carId, car);
  }

  updateObstacleMeshes(obstacles: Obstacle[]) {
    this.carManager.updateObstacleMeshes(obstacles);
  }

  renderCheckpoints(
    checkpoints: Array<{
      position: { x: number; y: number; z: number };
      radius: number;
      id: number;
    }>,
    showNumbers?: boolean,
  ) {
    this.carManager.renderCheckpoints(checkpoints, showNumbers);
  }

  // ── Effects ────────────────────────────────────────────────────

  spawnExplosion(physicsPos: { x: number; y: number; z: number }) {
    this.explosionEffect.spawnExplosion(physicsPos);
  }

  updateExplosions(deltaTime: number) {
    this.explosionEffect.updateExplosions(deltaTime);
  }

  // ── Camera ─────────────────────────────────────────────────────

  updateCamera(targetCar: RaceCar): void {
    this._camCarPos.set(
      targetCar.position.x,
      targetCar.position.y,
      targetCar.position.z,
    );
    this._camCarQuat.set(
      targetCar.rotation.x,
      targetCar.rotation.y,
      targetCar.rotation.z,
      targetCar.rotation.w,
    );

    this._camOffset.copy(this.cameraOffset).applyQuaternion(this._camCarQuat);
    this._camTargetPos.copy(this._camCarPos).add(this._camOffset);
    this.camera.position.lerp(this._camTargetPos, this.cameraSmoothness);

    this._camLookAt
      .copy(this.cameraLookAtOffset)
      .applyQuaternion(this._camCarQuat);
    this._camLookAt.add(this._camCarPos);
    this.camera.lookAt(this._camLookAt);
  }

  // ── Render ─────────────────────────────────────────────────────

  render(speedRatio: number = 0): void {
    this.renderer.render(this.scene, this.camera);
    this.speedEffect.renderFrame(speedRatio);
  }

  // ── Lifecycle ──────────────────────────────────────────────────

  private onContainerResize(): void {
    if (!this.container) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (w <= 0 || h <= 0) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.speedEffect.resize();
  }

  private onWindowResize(): void {
    // ResizeObserver 存在時由 onContainerResize 處理，此處僅作 fallback
    if (!this.resizeObserver) {
      this.onContainerResize();
    }
  }

  dispose(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    if (this.boundWindowResize) {
      window.removeEventListener("resize", this.boundWindowResize);
      this.boundWindowResize = null;
    }
    this.renderer.dispose();
    this.trackLoader.dispose();
    this.carManager.dispose();
    this.speedEffect.dispose();
  }
}
