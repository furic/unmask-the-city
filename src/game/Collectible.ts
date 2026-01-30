import * as THREE from 'three';

export type FragmentType = 'common' | 'rare' | 'hidden';

export interface FragmentConfig {
  color: number;
  emissive: number;
  emissiveIntensity: number;
  points: number;
  visibilityRadius: number; // 0 = always visible
  size: number;
}

export const FRAGMENT_CONFIGS: Record<FragmentType, FragmentConfig> = {
  common: {
    color: 0x00ffaa,
    emissive: 0x00ff88,
    emissiveIntensity: 0.5,
    points: 1000,
    visibilityRadius: 0,
    size: 1,
  },
  rare: {
    color: 0xffaa00,
    emissive: 0xff8800,
    emissiveIntensity: 0.8,
    points: 2000,
    visibilityRadius: 0,
    size: 1.3,
  },
  hidden: {
    color: 0xaa00ff,
    emissive: 0x8800ff,
    emissiveIntensity: 0.3,
    points: 1500,
    visibilityRadius: 20,
    size: 0.9,
  },
};

interface Particle {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
}

export class Collectible {
  private mesh: THREE.Mesh;
  private glowMesh: THREE.Mesh;
  private position: THREE.Vector3;
  private initialY: number;
  private time = 0;
  private scene: THREE.Scene | null = null;

  // Particle system
  private particles: Particle[] = [];
  private particleMeshes: THREE.Mesh[] = [];
  private particleGeometry: THREE.SphereGeometry;
  private particleMaterial: THREE.MeshBasicMaterial;

  isCollected = false;
  readonly fragmentType: FragmentType;
  readonly points: number;
  private config: FragmentConfig;

  // Settings
  private readonly COLLECTION_RADIUS = 4;
  private readonly BOB_SPEED = 2;
  private readonly BOB_AMOUNT = 0.5;
  private readonly ROTATE_SPEED = 1.5;
  private readonly PARTICLE_COUNT = 20;
  private readonly PARTICLE_SPEED = 8;

  constructor(position: THREE.Vector3, fragmentType: FragmentType = 'common') {
    this.position = position.clone();
    this.initialY = position.y;
    this.fragmentType = fragmentType;
    this.config = FRAGMENT_CONFIGS[fragmentType];
    this.points = this.config.points;

    // Create main mesh (glowing octahedron)
    const geometry = new THREE.OctahedronGeometry(this.config.size, 0);
    const material = new THREE.MeshStandardMaterial({
      color: this.config.color,
      emissive: this.config.emissive,
      emissiveIntensity: this.config.emissiveIntensity,
      roughness: 0.2,
      metalness: 0.8,
    });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.copy(position);
    this.mesh.castShadow = true;

    // Hidden fragments start invisible
    if (fragmentType === 'hidden') {
      this.mesh.visible = false;
    }

    // Create outer glow
    const glowGeometry = new THREE.OctahedronGeometry(this.config.size * 1.5, 0);
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: this.config.color,
      transparent: true,
      opacity: fragmentType === 'hidden' ? 0 : 0.2,
      side: THREE.BackSide,
    });
    this.glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
    this.glowMesh.position.copy(position);

    // Note: Removed PointLight for performance - emissive material + bloom provides glow effect

    // Particle system setup
    this.particleGeometry = new THREE.SphereGeometry(0.15, 8, 8);
    this.particleMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ffaa,
      transparent: true,
      opacity: 1,
    });
  }

  addToScene(scene: THREE.Scene): void {
    this.scene = scene;
    scene.add(this.mesh);
    scene.add(this.glowMesh);
  }

  remove(scene: THREE.Scene): void {
    scene.remove(this.mesh);
    scene.remove(this.glowMesh);
    this.mesh.geometry.dispose();
    this.glowMesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
    (this.glowMesh.material as THREE.Material).dispose();

    // Clean up particles
    this.particleMeshes.forEach((mesh) => {
      scene.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    });
    this.particleMeshes = [];
    this.particles = [];
    this.particleGeometry.dispose();
    this.particleMaterial.dispose();
  }

  update(delta: number): void {
    this.time += delta;

    // Update particles (even after collection)
    this.updateParticles(delta);

    if (this.isCollected) return;

    // Floating animation
    const bobOffset = Math.sin(this.time * this.BOB_SPEED) * this.BOB_AMOUNT;
    this.mesh.position.y = this.initialY + bobOffset;
    this.glowMesh.position.y = this.initialY + bobOffset;

    // Rotation
    this.mesh.rotation.y += this.ROTATE_SPEED * delta;
    this.mesh.rotation.x = Math.sin(this.time * 0.5) * 0.2;
    this.glowMesh.rotation.copy(this.mesh.rotation);

    // Pulse glow
    const pulse = 0.15 + Math.sin(this.time * 3) * 0.1;
    (this.glowMesh.material as THREE.MeshBasicMaterial).opacity = pulse;
  }

  private updateParticles(delta: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const particle = this.particles[i];
      const mesh = this.particleMeshes[i];

      // Update position
      particle.position.add(particle.velocity.clone().multiplyScalar(delta));
      particle.velocity.y -= 15 * delta; // Gravity
      particle.life -= delta;

      // Update mesh
      mesh.position.copy(particle.position);
      const lifeRatio = particle.life / particle.maxLife;
      mesh.scale.setScalar(lifeRatio);
      (mesh.material as THREE.MeshBasicMaterial).opacity = lifeRatio;

      // Remove dead particles
      if (particle.life <= 0) {
        if (this.scene) {
          this.scene.remove(mesh);
        }
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
        this.particles.splice(i, 1);
        this.particleMeshes.splice(i, 1);
      }
    }
  }

  private spawnParticles(): void {
    if (!this.scene) return;

    for (let i = 0; i < this.PARTICLE_COUNT; i++) {
      // Random direction
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      const speed = this.PARTICLE_SPEED * (0.5 + Math.random() * 0.5);

      const velocity = new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta) * speed,
        Math.abs(Math.cos(phi)) * speed + 3,
        Math.sin(phi) * Math.sin(theta) * speed
      );

      const particle: Particle = {
        position: this.mesh.position.clone(),
        velocity,
        life: 0.8 + Math.random() * 0.4,
        maxLife: 0.8 + Math.random() * 0.4,
      };

      // Create mesh for particle
      const mesh = new THREE.Mesh(
        this.particleGeometry.clone(),
        this.particleMaterial.clone()
      );
      mesh.position.copy(particle.position);

      this.particles.push(particle);
      this.particleMeshes.push(mesh);
      this.scene.add(mesh);
    }
  }

  checkCollection(playerPosition: THREE.Vector3): boolean {
    if (this.isCollected) return false;

    const distance = this.position.distanceTo(
      new THREE.Vector3(playerPosition.x, this.position.y, playerPosition.z)
    );

    // Update hidden fragment visibility
    if (this.fragmentType === 'hidden') {
      this.updateHiddenVisibility(distance);
    }

    if (distance < this.COLLECTION_RADIUS) {
      this.collect();
      return true;
    }

    return false;
  }

  private updateHiddenVisibility(distanceToPlayer: number): void {
    const visRadius = this.config.visibilityRadius;
    if (visRadius <= 0) return;

    if (distanceToPlayer < visRadius) {
      // Fade in based on proximity
      const fadeAmount = 1 - distanceToPlayer / visRadius;
      this.mesh.visible = true;
      this.glowMesh.visible = true;

      // Update material opacity/emissive
      const material = this.mesh.material as THREE.MeshStandardMaterial;
      material.emissiveIntensity = this.config.emissiveIntensity * fadeAmount + 0.1;

      const glowMaterial = this.glowMesh.material as THREE.MeshBasicMaterial;
      glowMaterial.opacity = 0.3 * fadeAmount;
    } else {
      this.mesh.visible = false;
      this.glowMesh.visible = false;
    }
  }

  private collect(): void {
    this.isCollected = true;

    // Spawn particle explosion
    this.spawnParticles();

    // Hide meshes
    this.mesh.visible = false;
    this.glowMesh.visible = false;
  }

  getPosition(): THREE.Vector3 {
    return this.position.clone();
  }
}
