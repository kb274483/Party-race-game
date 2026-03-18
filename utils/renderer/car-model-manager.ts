/**
 * CarModelManager - 負責車輛模型載入、障礙物、加速帶、車色、位置更新
 */

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { RaceCar, Obstacle, SpeedBoost } from "../../types/game";

const CAR_TARGET_LENGTH = 3;

export class CarModelManager {
  private carModels: Map<string, THREE.Group> = new Map();
  private carGroundOffsets: Map<string, number> = new Map();
  private carShadows: Map<string, THREE.Mesh> = new Map();
  private carHeadlights: Map<string, THREE.Light[]> = new Map();
  private mineGroups: THREE.Group[] = [];
  private boostGroups: THREE.Group[] = [];
  private checkpointMarkers: THREE.Mesh[] = [];
  /** renderObstacles 的 yOffset，供 ExplosionEffect 定位使用 */
  trackYOffset: number = 0;
  private nightMode: boolean = false;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly loader: GLTFLoader,
  ) {}

  /** 啟用夜間模式（需在 loadCar / renderObstacles 之前呼叫） */
  setNightMode(enabled: boolean): void {
    this.nightMode = enabled;
  }

  async loadCar(carId: string, carPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.loader.load(
        carPath,
        (gltf) => {
          const carModel = gltf.scene;
          carModel.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });

          const box = new THREE.Box3().setFromObject(carModel);
          const size = new THREE.Vector3();
          box.getSize(size);
          const length = Math.max(size.x, size.z, 0.001);
          carModel.scale.setScalar(CAR_TARGET_LENGTH / length);

          const boxAfter = new THREE.Box3().setFromObject(carModel);
          this.carGroundOffsets.set(carId, -boxAfter.min.y + 2.8);
          this.carModels.set(carId, carModel);
          this.scene.add(carModel);

          if (this.nightMode) {
            this.addHeadlights(carId, carModel);
          }

          // blob shadow
          const shadowMesh = new THREE.Mesh(
            new THREE.CircleGeometry(1.8, 24),
            new THREE.MeshBasicMaterial({
              color: 0x000000,
              transparent: true,
              opacity: 0.5,
              depthWrite: false,
            }),
          );
          shadowMesh.rotation.x = -Math.PI / 2;
          shadowMesh.renderOrder = -1;
          this.scene.add(shadowMesh);
          this.carShadows.set(carId, shadowMesh);

          resolve();
        },
        undefined,
        (error) => {
          console.error("載入車輛模型失敗:", error);
          reject(error);
        },
      );
    });
  }

  renderObstacles(obstacles: Obstacle[], yOffset: number = 0): void {
    this.trackYOffset = yOffset;
    this.mineGroups.forEach((g) => this.scene.remove(g));
    this.mineGroups = [];

    const mines = obstacles.filter((o) => o.type === "mine");
    if (mines.length === 0) return;

    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x111111,
      roughness: 0.2,
      metalness: 0.9,
    });
    const spikeMat = new THREE.MeshStandardMaterial({ color: 0xff6b6b });
    const warningMat = this.nightMode
      ? null
      : new THREE.MeshBasicMaterial({
          color: 0xff6b6b,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.85,
        });
    const fromAxis = new THREE.Vector3(0, 1, 0);

    for (const mine of mines) {
      const group = new THREE.Group();
      group.position.set(
        mine.position.x,
        mine.position.y + yOffset,
        mine.position.z,
      );

      const body = new THREE.Mesh(
        new THREE.SphereGeometry(1.1, 16, 16),
        bodyMat,
      );
      body.position.y = 0.9;
      body.castShadow = true;
      group.add(body);

      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2;
        const spike = new THREE.Mesh(
          new THREE.CylinderGeometry(0.1, 0.22, 1.0, 6),
          spikeMat,
        );
        spike.position.set(Math.cos(angle) * 1.25, 0.9, Math.sin(angle) * 1.25);
        spike.quaternion.setFromUnitVectors(
          fromAxis,
          new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle)),
        );
        group.add(spike);
      }

      if (warningMat) {
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(2.0, 2.7, 32),
          warningMat,
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.08;
        group.add(ring);
      }

      this.scene.add(group);
      this.mineGroups.push(group);
    }
  }

  renderSpeedBoosts(boosts: SpeedBoost[], yOffset: number = 0): void {
    this.boostGroups.forEach((g) => this.scene.remove(g));
    this.boostGroups = [];

    if (boosts.length === 0) return;

    const diskMat = new THREE.MeshStandardMaterial({
      color: 0xffd93d,
      emissive: 0xffd93d,
      emissiveIntensity: 0.3,
      roughness: 0.4,
    });
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0xffd93d,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.4,
    });

    for (const boost of boosts) {
      const group = new THREE.Group();
      group.position.set(
        boost.position.x,
        boost.position.y + yOffset,
        boost.position.z,
      );

      const disk = new THREE.Mesh(
        new THREE.CylinderGeometry(boost.radius, boost.radius, 0.18, 32),
        diskMat,
      );
      disk.position.y = 0.09;
      disk.receiveShadow = true;
      group.add(disk);

      const glow = new THREE.Mesh(
        new THREE.RingGeometry(boost.radius, boost.radius + 0.8, 32),
        glowMat,
      );
      glow.rotation.x = -Math.PI / 2;
      glow.position.y = 0.06;
      group.add(glow);

      this.scene.add(group);
      this.boostGroups.push(group);
    }
  }

  setCarColor(carId: string, color: number): void {
    const carModel = this.carModels.get(carId);
    if (!carModel) return;

    const targetColor = new THREE.Color(color);
    carModel.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      const mats = Array.isArray(child.material)
        ? child.material
        : [child.material];
      const cloned = mats.map((m) => {
        const mat = (m as THREE.MeshStandardMaterial).clone();
        mat.color.set(targetColor);
        return mat;
      });
      child.material = Array.isArray(child.material) ? cloned : cloned[0];
    });
  }

  updateCar(carId: string, car: RaceCar): void {
    const carModel = this.carModels.get(carId);
    if (!carModel) return;

    const groundOffset = this.carGroundOffsets.get(carId) ?? 0;
    carModel.position.set(
      car.position.x,
      car.position.y + groundOffset,
      car.position.z,
    );
    carModel.quaternion.set(
      car.rotation.x,
      car.rotation.y,
      car.rotation.z,
      car.rotation.w,
    );

    const shadow = this.carShadows.get(carId);
    if (shadow) {
      shadow.position.set(car.position.x, car.position.y + 0.1, car.position.z);
    }
  }

  /** 每幀更新移動地雷的 3D 位置（與 physics 位置保持同步） */
  updateObstacleMeshes(obstacles: Obstacle[]): void {
    const mines = obstacles.filter((o) => o.type === "mine");
    for (let i = 0; i < mines.length && i < this.mineGroups.length; i++) {
      const mine = mines[i]!;
      const group = this.mineGroups[i]!;
      group.position.set(
        mine.position.x,
        mine.position.y + this.trackYOffset,
        mine.position.z,
      );
    }
  }

  renderCheckpoints(
    checkpoints: Array<{
      position: { x: number; y: number; z: number };
      radius: number;
      id: number;
    }>,
    _showNumbers: boolean = true,
  ): void {
    this.checkpointMarkers.forEach((m) => this.scene.remove(m));
    this.checkpointMarkers = [];

    checkpoints.forEach((cp) => {
      const marker = new THREE.Mesh(
        new THREE.TorusGeometry(cp.radius, 0.5, 8, 32),
        new THREE.MeshBasicMaterial({
          color: 0x00ff00,
          transparent: true,
          opacity: 0.5,
          wireframe: true,
        }),
      );
      marker.position.set(cp.position.x, cp.position.y, cp.position.z + 1);
      marker.rotation.x = Math.PI / 2;
      this.scene.add(marker);
      this.checkpointMarkers.push(marker);
    });
  }

  /**
   * 在車頭位置加入兩盞 SpotLight 作為車頭燈
   * 車輛 local 座標系：+Z = 車頭方向，±X = 左右，+Y = 上
   * SpotLight 與 target 同為 carModel 子物件，隨車旋轉後方向保持一致
   */
  /**
   * 在車頭加兩盞 SpotLight（車頭燈）、車尾加兩盞 PointLight（尾燈）
   * 車輛 local 座標系：+Z = 車頭，-Z = 車尾，±X = 左右，+Y = 上
   * 所有燈光皆為 carModel 子物件，隨車旋轉自動更新世界座標
   */
  private addHeadlights(carId: string, carModel: THREE.Group): void {
    const lights: THREE.Light[] = [];

    // ── 車頭燈（SpotLight，朝前照射）────────────────────────────
    for (const xOffset of [-0.4, 0.4]) {
      const headlight = new THREE.SpotLight(
        0xffffff, // 暖白色
        10, // intensity
        80, // 照射距離
        Math.PI * 0.16 ,
        0.3, // penumbra 柔化邊緣
        2, // decay
      );
      headlight.position.set(xOffset, 0.8, 0.9);

      const target = new THREE.Object3D();
      target.position.set(xOffset, -0.5, 15);

      carModel.add(headlight);
      carModel.add(target);
      headlight.target = target;
      lights.push(headlight);
    }

    for (const xOffset of [-0.3, 0.3]) {
      const taillight = new THREE.PointLight(
        0xff2200, // 紅色
        0.5, // 淡淡的強度
        6, // 短範圍，只在車尾附近發光
        2, // decay
      );
      taillight.position.set(xOffset, 1 , -2.3); 
      carModel.add(taillight);
      lights.push(taillight);
    }

    this.carHeadlights.set(carId, lights);
  }

  dispose(): void {
    this.carHeadlights.forEach((lights) => lights.forEach((l) => l.dispose()));
    this.carHeadlights.clear();

    this.carModels.forEach((model) => this.scene.remove(model));
    this.carModels.clear();
    this.carGroundOffsets.clear();

    this.carShadows.forEach((shadow) => {
      shadow.geometry.dispose();
      (shadow.material as THREE.Material).dispose();
      this.scene.remove(shadow);
    });
    this.carShadows.clear();

    this.mineGroups.forEach((g) => {
      this.scene.remove(g);
      g.traverse((child) => {
        if (child instanceof THREE.Mesh) child.geometry.dispose();
      });
    });
    this.mineGroups = [];

    this.boostGroups.forEach((g) => {
      this.scene.remove(g);
      g.traverse((child) => {
        if (child instanceof THREE.Mesh) child.geometry.dispose();
      });
    });
    this.boostGroups = [];
  }
}
