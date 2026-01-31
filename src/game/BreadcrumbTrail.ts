import * as THREE from 'three';

/**
 * Breadcrumb trail showing the player's path through the city
 * Rendered as a glowing tube with subtle particle effects
 */
export class BreadcrumbTrail {
  private scene: THREE.Scene;
  private points: THREE.Vector3[] = [];
  private trail: THREE.Mesh | null = null;
  private glowTrail: THREE.Mesh | null = null;
  private particles: THREE.Points | null = null;
  private material: THREE.MeshBasicMaterial;
  private glowMaterial: THREE.MeshBasicMaterial;
  private particleMaterial: THREE.PointsMaterial;
  private readonly MAX_POINTS = 500;
  private readonly MIN_DISTANCE = 3; // Minimum distance between points
  private lastPosition: THREE.Vector3 | null = null;
  private fadeTimer = 0;
  private particleTimer = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // Main trail material (solid core)
    this.material = new THREE.MeshBasicMaterial({
      color: 0x4ade80,
      transparent: true,
      opacity: 0.4,
    });

    // Glow trail material (outer glow)
    this.glowMaterial = new THREE.MeshBasicMaterial({
      color: 0x4ade80,
      transparent: true,
      opacity: 0.15,
      side: THREE.DoubleSide,
    });

    // Particle material for trail sparkles
    this.particleMaterial = new THREE.PointsMaterial({
      color: 0x4ade80,
      size: 0.2,
      transparent: true,
      opacity: 0.3,
      blending: THREE.AdditiveBlending,
    });
  }

  update(playerPos: THREE.Vector3, delta: number): void {
    // Check if we should add a new point
    const pos2D = new THREE.Vector3(playerPos.x, 0.2, playerPos.z);

    if (this.lastPosition === null) {
      this.lastPosition = pos2D.clone();
      this.addPoint(pos2D);
      return;
    }

    const dist = pos2D.distanceTo(this.lastPosition);
    if (dist >= this.MIN_DISTANCE) {
      this.addPoint(pos2D);
      this.lastPosition = pos2D.clone();
    }

    // Fade out old points over time
    this.fadeTimer += delta;
    if (this.fadeTimer > 0.5 && this.points.length > 50) {
      this.fadeTimer = 0;
      // Remove oldest point
      this.points.shift();
      this.updateTrail();
    }

    // Update particle sparkle effect (slow, subtle updates)
    this.particleTimer += delta;
    if (this.particleTimer > 1.0) {
      this.particleTimer = 0;
      this.updateParticles();
    }
  }

  private addPoint(position: THREE.Vector3): void {
    this.points.push(position.clone());

    // Limit points
    if (this.points.length > this.MAX_POINTS) {
      this.points.shift();
    }

    this.updateTrail();
  }

  private updateTrail(): void {
    if (this.points.length < 2) return;

    // Remove old trails
    if (this.trail) {
      this.scene.remove(this.trail);
      this.trail.geometry.dispose();
    }
    if (this.glowTrail) {
      this.scene.remove(this.glowTrail);
      this.glowTrail.geometry.dispose();
    }

    // Create tube path from points
    const curve = new THREE.CatmullRomCurve3(this.points);

    // Main trail (thin tube)
    const tubeGeometry = new THREE.TubeGeometry(curve, this.points.length * 2, 0.15, 4, false);
    this.trail = new THREE.Mesh(tubeGeometry, this.material);
    this.scene.add(this.trail);

    // Glow trail (wider, more transparent)
    const glowTubeGeometry = new THREE.TubeGeometry(curve, this.points.length * 2, 0.4, 4, false);
    this.glowTrail = new THREE.Mesh(glowTubeGeometry, this.glowMaterial);
    this.scene.add(this.glowTrail);
  }

  private updateParticles(): void {
    if (this.points.length < 10) return;

    // Remove old particles
    if (this.particles) {
      this.scene.remove(this.particles);
      this.particles.geometry.dispose();
    }

    // Create particles along the trail (sample sparingly for subtle effect)
    const particlePositions: THREE.Vector3[] = [];
    for (let i = 0; i < this.points.length; i += 8) {
      const point = this.points[i];
      // Very small random offset for gentle sparkle
      const offset = new THREE.Vector3(
        (Math.random() - 0.5) * 0.3,
        Math.random() * 0.3,
        (Math.random() - 0.5) * 0.3
      );
      particlePositions.push(point.clone().add(offset));
    }

    if (particlePositions.length > 0) {
      const particleGeometry = new THREE.BufferGeometry().setFromPoints(particlePositions);
      this.particles = new THREE.Points(particleGeometry, this.particleMaterial);
      this.scene.add(this.particles);
    }
  }

  reset(): void {
    this.points = [];
    this.lastPosition = null;
    if (this.trail) {
      this.scene.remove(this.trail);
      this.trail.geometry.dispose();
      this.trail = null;
    }
    if (this.glowTrail) {
      this.scene.remove(this.glowTrail);
      this.glowTrail.geometry.dispose();
      this.glowTrail = null;
    }
    if (this.particles) {
      this.scene.remove(this.particles);
      this.particles.geometry.dispose();
      this.particles = null;
    }
  }

  dispose(): void {
    if (this.trail) {
      this.scene.remove(this.trail);
      this.trail.geometry.dispose();
    }
    if (this.glowTrail) {
      this.scene.remove(this.glowTrail);
      this.glowTrail.geometry.dispose();
    }
    if (this.particles) {
      this.scene.remove(this.particles);
      this.particles.geometry.dispose();
    }
    this.material.dispose();
    this.glowMaterial.dispose();
    this.particleMaterial.dispose();
  }
}
