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
  private readonly COLLECTION_RADIUS = 6; // Increased to collect through walls
  private readonly BOB_SPEED = 2;
  private readonly BOB_AMOUNT = 0.5;
  private readonly ROTATE_SPEED = 1.5;
  private readonly PARTICLE_COUNT = 40; // Enhanced particle count
  private readonly PARTICLE_SPEED = 12; // Faster particles

  // Light beam on collection
  private lightBeam: THREE.Mesh | null = null;
  private beamLife = 0;

  // Spiral trail particles
  private spiralParticles: THREE.Mesh[] = [];
  private readonly SPIRAL_PARTICLE_COUNT = 8;
  private readonly SPIRAL_RADIUS = 2.5;
  private readonly SPIRAL_SPEED = 2;

  // Beacon beam (visible from distance)
  private beaconBeam: THREE.Mesh | null = null;
  private readonly BEACON_HEIGHT = 100;

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

    // Particle system setup - use fragment color
    this.particleGeometry = new THREE.SphereGeometry(0.2, 8, 8);
    this.particleMaterial = new THREE.MeshBasicMaterial({
      color: this.config.color,
      transparent: true,
      opacity: 1,
    });
  }

  addToScene(scene: THREE.Scene): void {
    this.scene = scene;
    scene.add(this.mesh);
    scene.add(this.glowMesh);

    // Create spiral trail particles
    this.createSpiralParticles();

    // Create beacon beam (visible from distance)
    this.createBeaconBeam();
  }

  private createBeaconBeam(): void {
    if (!this.scene) return;

    // Hidden fragments don't have beacons (they need to be discovered)
    if (this.fragmentType === 'hidden') return;

    // Create a tall, thin cylinder beam
    const beamGeometry = new THREE.CylinderGeometry(0.15, 0.4, this.BEACON_HEIGHT, 6);
    const beamMaterial = new THREE.MeshBasicMaterial({
      color: this.config.color,
      transparent: true,
      opacity: 0.15,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });

    this.beaconBeam = new THREE.Mesh(beamGeometry, beamMaterial);
    this.beaconBeam.position.copy(this.position);
    this.beaconBeam.position.y += this.BEACON_HEIGHT / 2; // Center beam above fragment

    this.scene.add(this.beaconBeam);
  }

  private createSpiralParticles(): void {
    if (!this.scene) return;

    // Don't create spiral for hidden fragments (they're invisible until close)
    if (this.fragmentType === 'hidden') return;

    for (let i = 0; i < this.SPIRAL_PARTICLE_COUNT; i++) {
      const geometry = new THREE.SphereGeometry(0.1, 6, 6);
      const material = new THREE.MeshBasicMaterial({
        color: this.config.color,
        transparent: true,
        opacity: 0.6,
      });

      const particle = new THREE.Mesh(geometry, material);
      particle.position.copy(this.position);

      this.spiralParticles.push(particle);
      this.scene.add(particle);
    }
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

    // Clean up spiral particles
    this.spiralParticles.forEach((particle) => {
      scene.remove(particle);
      particle.geometry.dispose();
      (particle.material as THREE.Material).dispose();
    });
    this.spiralParticles = [];

    // Clean up beacon beam
    if (this.beaconBeam) {
      scene.remove(this.beaconBeam);
      this.beaconBeam.geometry.dispose();
      (this.beaconBeam.material as THREE.Material).dispose();
      this.beaconBeam = null;
    }
  }

  update(delta: number): void {
    this.time += delta;

    // Update particles (even after collection)
    this.updateParticles(delta);

    // Update light beam
    this.updateLightBeam(delta);

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

    // Update spiral trail particles
    this.updateSpiralParticles();

    // Update beacon beam (pulsing opacity)
    if (this.beaconBeam) {
      const pulse = 0.1 + Math.sin(this.time * 2) * 0.05;
      (this.beaconBeam.material as THREE.MeshBasicMaterial).opacity = pulse;
    }
  }

  private updateSpiralParticles(): void {
    if (this.spiralParticles.length === 0) return;

    const centerY = this.mesh.position.y;

    for (let i = 0; i < this.spiralParticles.length; i++) {
      const particle = this.spiralParticles[i];

      // Each particle is offset in phase
      const phase = (i / this.SPIRAL_PARTICLE_COUNT) * Math.PI * 2;
      const angle = this.time * this.SPIRAL_SPEED + phase;

      // Spiral motion with vertical oscillation
      const verticalOffset = Math.sin(this.time * 3 + phase) * 0.8;
      const radius = this.SPIRAL_RADIUS + Math.sin(this.time * 2 + phase) * 0.3;

      particle.position.x = this.position.x + Math.cos(angle) * radius;
      particle.position.y = centerY + verticalOffset;
      particle.position.z = this.position.z + Math.sin(angle) * radius;

      // Pulse opacity
      const opacity = 0.4 + Math.sin(this.time * 4 + phase) * 0.2;
      (particle.material as THREE.MeshBasicMaterial).opacity = opacity;

      // Scale based on position in spiral
      const scale = 0.8 + Math.sin(this.time * 2 + phase) * 0.3;
      particle.scale.setScalar(scale);
    }
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

    // Create light beam shooting upward
    this.createLightBeam();

    // Hide meshes
    this.mesh.visible = false;
    this.glowMesh.visible = false;

    // Hide spiral particles
    this.spiralParticles.forEach((particle) => {
      particle.visible = false;
    });

    // Hide beacon beam
    if (this.beaconBeam) {
      this.beaconBeam.visible = false;
    }
  }

  private createLightBeam(): void {
    if (!this.scene) return;

    // Create a tall cylinder beam
    const beamGeometry = new THREE.CylinderGeometry(0.3, 1.5, 50, 8);
    const beamMaterial = new THREE.MeshBasicMaterial({
      color: this.config.color,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });

    this.lightBeam = new THREE.Mesh(beamGeometry, beamMaterial);
    this.lightBeam.position.copy(this.position);
    this.lightBeam.position.y += 25; // Center beam above collection point

    this.beamLife = 1.0; // 1 second duration
    this.scene.add(this.lightBeam);
  }

  private updateLightBeam(delta: number): void {
    if (!this.lightBeam || !this.scene) return;

    this.beamLife -= delta * 2; // Fade over 0.5 seconds

    if (this.beamLife <= 0) {
      this.scene.remove(this.lightBeam);
      this.lightBeam.geometry.dispose();
      (this.lightBeam.material as THREE.Material).dispose();
      this.lightBeam = null;
    } else {
      // Fade out and scale up
      (this.lightBeam.material as THREE.MeshBasicMaterial).opacity = this.beamLife * 0.6;
      this.lightBeam.scale.x = 1 + (1 - this.beamLife) * 2;
      this.lightBeam.scale.z = 1 + (1 - this.beamLife) * 2;
      this.lightBeam.position.y += delta * 20; // Move upward
    }
  }

  getPosition(): THREE.Vector3 {
    return this.position.clone();
  }

  /**
   * Update fragment glow based on night mode (fragments glow brighter at night)
   * @param nightAmount 0 = day, 1 = full night
   */
  setNightMode(nightAmount: number): void {
    if (this.isCollected) return;

    const material = this.mesh.material as THREE.MeshStandardMaterial;
    const glowMaterial = this.glowMesh.material as THREE.MeshBasicMaterial;

    // Increase emissive intensity at night (up to 2x brighter)
    const nightBoost = 1 + nightAmount * 1.5;
    material.emissiveIntensity = this.config.emissiveIntensity * nightBoost;

    // Increase glow opacity at night
    const baseOpacity = this.fragmentType === 'hidden' ? 0 : 0.2;
    glowMaterial.opacity = baseOpacity * (1 + nightAmount * 0.5);

    // Scale up glow mesh slightly at night
    const glowScale = 1.5 * (1 + nightAmount * 0.2);
    this.glowMesh.scale.setScalar(glowScale / 1.5);
  }
}
