/**
 * GameRenderer - Three.js 渲染器（主協調類別）
 * 組合 TrackLoader / CarModelManager / ExplosionEffect / SpeedEffect
 * 對外暴露與原本完全相同的公開 API，呼叫端無需任何變更
 */

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { RaceCar, Obstacle, SpeedBoost, BoundingBox } from "../../types/game";
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
  private cameraSmoothness = 0.15;

  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000,
    );
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.loader = new GLTFLoader();
  }

  initialize(container: HTMLElement): void {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
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
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
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

    window.addEventListener("resize", this.onWindowResize.bind(this));
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
    const carPosition = new THREE.Vector3(
      targetCar.position.x,
      targetCar.position.y,
      targetCar.position.z,
    );
    const carQuaternion = new THREE.Quaternion(
      targetCar.rotation.x,
      targetCar.rotation.y,
      targetCar.rotation.z,
      targetCar.rotation.w,
    );

    const offset = this.cameraOffset.clone().applyQuaternion(carQuaternion);
    this.camera.position.lerp(carPosition.clone().add(offset), this.cameraSmoothness);

    const lookAt = this.cameraLookAtOffset.clone().applyQuaternion(carQuaternion);
    this.camera.lookAt(carPosition.clone().add(lookAt));
  }

  // ── Render ─────────────────────────────────────────────────────

  render(speedRatio: number = 0): void {
    this.renderer.render(this.scene, this.camera);
    this.speedEffect.renderFrame(speedRatio);
  }

  // ── Lifecycle ──────────────────────────────────────────────────

  private onWindowResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.speedEffect.resize();
  }

  dispose(): void {
    window.removeEventListener("resize", this.onWindowResize.bind(this));
    this.renderer.dispose();
    this.trackLoader.dispose();
    this.carManager.dispose();
    this.speedEffect.dispose();
  }
}
