/**
 * TrackLoader - 負責賽道與碰撞器模型的載入與管理
 */

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { BoundingBox } from "../../types/game";

const TRACK_TARGET_SIZE = 700;

export class TrackLoader {
  private trackModel: THREE.Group | null = null;
  private colliderModel: THREE.Group | null = null;
  private trackBounds: BoundingBox | null = null;
  private trackScale: number = 1;
  private trackCenterOffset: THREE.Vector3 = new THREE.Vector3();

  constructor(
    private readonly scene: THREE.Scene,
    private readonly loader: GLTFLoader,
  ) {}

  private computeBoundingBox(group: THREE.Group): THREE.Box3 {
    return new THREE.Box3().setFromObject(group);
  }

  async loadTrack(
    trackPath: string,
    skyMode = false,
  ): Promise<{
    bounds: BoundingBox;
    startPosition: { x: number; y: number; z: number } | null;
    startRotation: { x: number; y: number; z: number; w: number } | null;
  }> {
    return new Promise((resolve, reject) => {
      this.loader.load(
        trackPath,
        (gltf) => {
          this.trackModel = gltf.scene;

          // 空中跑道模式：隱藏所有非跑道面的 mesh，跑道面換上特殊材質
          const skyTrackMaterial = skyMode
            ? new THREE.MeshStandardMaterial({
                color: 0x9e9e9e,
                emissive: 0x000000,
                emissiveIntensity: 0,
                roughness: 0.7,
                metalness: 0.1,
                side: THREE.DoubleSide,
              })
            : null;

          this.trackModel.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              const isSurface = child.name.startsWith("Mesh006");
              if (skyMode) {
                if (isSurface) {
                  child.material = skyTrackMaterial!;
                  child.castShadow = false;
                  child.receiveShadow = true;
                } else {
                  child.visible = false;
                }
              } else {
                child.castShadow = true;
                child.receiveShadow = true;
              }
            }
          });

          const box = this.computeBoundingBox(this.trackModel);
          const size = new THREE.Vector3();
          box.getSize(size);
          const maxDim = Math.max(size.x, size.y, size.z, 0.001);
          const scale = TRACK_TARGET_SIZE / maxDim;
          this.trackModel.scale.setScalar(scale);
          this.trackScale = scale;

          const boxAfter = this.computeBoundingBox(this.trackModel);
          const center = new THREE.Vector3();
          boxAfter.getCenter(center);
          this.trackModel.position.sub(center);
          this.trackCenterOffset.copy(center);

          const finalBox = this.computeBoundingBox(this.trackModel);
          this.trackBounds = {
            min: { x: finalBox.min.x, y: finalBox.min.y, z: finalBox.min.z },
            max: { x: finalBox.max.x, y: finalBox.max.y, z: finalBox.max.z },
          };

          // 尋找門架物件以取得起點位置
          const gateObjects: THREE.Object3D[] = [];
          this.trackModel.traverse((child) => {
            if (
              (child.name === "pCylinder4" ||
                child.name === "pCylinder5" ||
                child.name === "pPlane124") &&
              child instanceof THREE.Object3D
            ) {
              gateObjects.push(child);
            }
          });

          let startPosition: { x: number; y: number; z: number } | null = null;
          const startRotation = { x: 0, y: -0.6088, z: 0, w: 0.7934 };

          if (gateObjects.length > 0) {
            const gateCenter = new THREE.Vector3();
            gateObjects.forEach((obj) => {
              const pos = new THREE.Vector3();
              obj.getWorldPosition(pos);
              gateCenter.add(pos);
            });
            gateCenter.divideScalar(gateObjects.length);
            startPosition = {
              x: gateCenter.x + 2,
              y: gateCenter.y,
              z: gateCenter.z,
            };
          }

          this.scene.add(this.trackModel);
          this.trackModel.updateMatrixWorld(true);
          resolve({ bounds: this.trackBounds, startPosition, startRotation });
        },
        undefined,
        (error) => {
          console.error("載入賽道模型失敗:", error);
          reject(error);
        },
      );
    });
  }

  async loadColliderMesh(colliderPath: string): Promise<THREE.Mesh | null> {
    return new Promise((resolve) => {
      this.loader.load(
        colliderPath,
        (gltf) => {
          this.colliderModel = gltf.scene;
          this.colliderModel.scale.setScalar(this.trackScale);
          this.colliderModel.position.sub(this.trackCenterOffset);
          this.scene.add(this.colliderModel);
          this.colliderModel.updateMatrixWorld(true);

          let colliderMesh: THREE.Mesh | null = null;
          this.colliderModel.traverse((child) => {
            if (child instanceof THREE.Mesh && !colliderMesh) {
              colliderMesh = child;
              child.material = new THREE.MeshBasicMaterial({
                transparent: true,
                opacity: 0,
                side: THREE.DoubleSide,
                depthWrite: false,
              });
            } else {
              child.visible = false;
            }
          });

          if (!colliderMesh) console.warn("碰撞器模型中找不到 Mesh");
          resolve(colliderMesh);
        },
        undefined,
        (error) => {
          console.error("載入碰撞器模型失敗:", error);
          resolve(null);
        },
      );
    });
  }

  getTrackBounds(): BoundingBox | null {
    return this.trackBounds;
  }

  getTrackModel(): THREE.Group | null {
    return this.trackModel;
  }

  getTrackSurfaceMeshes(): THREE.Mesh[] {
    if (!this.trackModel) return [];
    const meshes: THREE.Mesh[] = [];
    this.trackModel.traverse((child) => {
      if (child instanceof THREE.Mesh && child.name.startsWith("Mesh006")) {
        const mats = Array.isArray(child.material)
          ? child.material
          : [child.material];
        mats.forEach((m) => {
          (m as THREE.Material).side = THREE.DoubleSide;
        });
        child.updateMatrixWorld(true);
        meshes.push(child);
      }
    });
    return meshes;
  }

  dispose(): void {
    if (this.trackModel) this.scene.remove(this.trackModel);
    if (this.colliderModel) this.scene.remove(this.colliderModel);
  }
}
