/**
 * ExplosionEffect - 負責地雷爆炸粒子特效
 */

import * as THREE from "three";

export class ExplosionEffect {
  private explosions: Array<{
    group: THREE.Group;
    elapsed: number;
    duration: number;
    particles: Array<{ mesh: THREE.Mesh; velocity: THREE.Vector3 }>;
    ring: THREE.Mesh;
  }> = [];

  constructor(
    private readonly scene: THREE.Scene,
    private readonly getTrackYOffset: () => number,
  ) {}

  spawnExplosion(physicsPos: { x: number; y: number; z: number }): void {
    const DURATION = 0.65;
    const group = new THREE.Group();
    group.position.set(
      physicsPos.x,
      physicsPos.y + this.getTrackYOffset() + 1.0,
      physicsPos.z,
    );
    this.scene.add(group);

    // 衝擊環
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.1, 0.6, 32),
      new THREE.MeshBasicMaterial({
        color: 0xffd93d,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 1,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    group.add(ring);

    // 8 個粒子
    const colors = [
      0xff6b35, 0x111111, 0xff6b35, 0xffd93d,
      0xff6b35, 0x111111, 0xff6b35, 0xffd93d,
    ];
    const boxGeo = new THREE.BoxGeometry(0.55, 0.55, 0.55);
    const particles: Array<{ mesh: THREE.Mesh; velocity: THREE.Vector3 }> = [];

    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const speed = 8 + Math.random() * 6;
      const mesh = new THREE.Mesh(
        boxGeo,
        new THREE.MeshBasicMaterial({ color: colors[i] }),
      );
      group.add(mesh);
      particles.push({
        mesh,
        velocity: new THREE.Vector3(
          Math.cos(angle) * speed,
          4 + Math.random() * 5,
          Math.sin(angle) * speed,
        ),
      });
    }

    this.explosions.push({ group, elapsed: 0, duration: DURATION, particles, ring });
  }

  updateExplosions(deltaTime: number): void {
    const toRemove: typeof this.explosions = [];

    for (const ex of this.explosions) {
      ex.elapsed += deltaTime;
      const t = Math.min(ex.elapsed / ex.duration, 1);
      const easeOut = 1 - t * t;

      const ringScale = 1 + t * 14;
      ex.ring.scale.set(ringScale, ringScale, ringScale);
      (ex.ring.material as THREE.MeshBasicMaterial).opacity = easeOut * 0.9;

      for (const p of ex.particles) {
        p.velocity.y -= 12 * deltaTime;
        p.mesh.position.x += p.velocity.x * deltaTime;
        p.mesh.position.y += p.velocity.y * deltaTime;
        p.mesh.position.z += p.velocity.z * deltaTime;
        p.mesh.rotation.x += 4 * deltaTime;
        p.mesh.rotation.z += 3 * deltaTime;
        (p.mesh.material as THREE.MeshBasicMaterial).opacity = easeOut;
        (p.mesh.material as THREE.MeshBasicMaterial).transparent = true;
      }

      if (t >= 1) toRemove.push(ex);
    }

    for (const ex of toRemove) {
      this.scene.remove(ex.group);
      this.explosions = this.explosions.filter((e) => e !== ex);
    }
  }
}
