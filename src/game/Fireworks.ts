import * as THREE from 'three';

interface FireworkParticle {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  color: THREE.Color;
}

interface Firework {
  rocket: THREE.Mesh | null;
  rocketVelocity: THREE.Vector3;
  state: 'launching' | 'exploding' | 'done';
  particles: FireworkParticle[];
  explosionPos: THREE.Vector3;
  color: THREE.Color;
}

export class FireworksSystem {
  private scene: THREE.Scene;
  private fireworks: Firework[] = [];
  private particleMeshes: THREE.Points[] = [];
  private isActive = false;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  start(launchPositions: THREE.Vector3[]): void {
    this.isActive = true;

    // Firework colors
    const colors = [
      new THREE.Color(0x00ff88), // Green
      new THREE.Color(0xffaa00), // Gold
      new THREE.Color(0xff00ff), // Magenta
      new THREE.Color(0x00aaff), // Cyan
      new THREE.Color(0xff4444), // Red
      new THREE.Color(0xffff00), // Yellow
    ];

    // Stagger firework launches
    launchPositions.forEach((pos, i) => {
      setTimeout(() => {
        if (!this.isActive) return;
        this.launchFirework(pos, colors[i % colors.length]);
      }, i * 400);
    });
  }

  private launchFirework(launchPos: THREE.Vector3, color: THREE.Color): void {
    // Create rocket mesh
    const rocketGeometry = new THREE.SphereGeometry(0.5, 8, 8);
    const rocketMaterial = new THREE.MeshBasicMaterial({ color });
    const rocket = new THREE.Mesh(rocketGeometry, rocketMaterial);
    rocket.position.copy(launchPos);
    this.scene.add(rocket);

    const firework: Firework = {
      rocket,
      rocketVelocity: new THREE.Vector3(
        (Math.random() - 0.5) * 8,
        60 + Math.random() * 20,
        (Math.random() - 0.5) * 8
      ),
      state: 'launching',
      particles: [],
      explosionPos: new THREE.Vector3(),
      color,
    };

    this.fireworks.push(firework);
  }

  private explodeFirework(firework: Firework): void {
    firework.state = 'exploding';

    if (firework.rocket) {
      firework.explosionPos.copy(firework.rocket.position);
      this.scene.remove(firework.rocket);
      firework.rocket.geometry.dispose();
      (firework.rocket.material as THREE.Material).dispose();
      firework.rocket = null;
    }

    // Create explosion particles
    const particleCount = 80 + Math.floor(Math.random() * 40);

    for (let i = 0; i < particleCount; i++) {
      // Spherical distribution
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const speed = 15 + Math.random() * 15;

      const velocity = new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta) * speed,
        Math.sin(phi) * Math.sin(theta) * speed * 0.5 + 5, // Bias upward
        Math.cos(phi) * speed
      );

      const life = 1.5 + Math.random() * 1.0;

      firework.particles.push({
        position: firework.explosionPos.clone(),
        velocity,
        life,
        maxLife: life,
        color: firework.color.clone(),
      });
    }

    // Create particle system for this explosion
    this.createParticleSystem(firework);
  }

  private createParticleSystem(firework: Firework): void {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(firework.particles.length * 3);
    const colors = new Float32Array(firework.particles.length * 3);

    firework.particles.forEach((p, i) => {
      positions[i * 3] = p.position.x;
      positions[i * 3 + 1] = p.position.y;
      positions[i * 3 + 2] = p.position.z;
      colors[i * 3] = p.color.r;
      colors[i * 3 + 1] = p.color.g;
      colors[i * 3 + 2] = p.color.b;
    });

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 2,
      vertexColors: true,
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const points = new THREE.Points(geometry, material);
    this.particleMeshes.push(points);
    this.scene.add(points);
  }

  update(delta: number): void {
    if (!this.isActive) return;

    // Update each firework
    this.fireworks.forEach((firework) => {
      if (firework.state === 'launching' && firework.rocket) {
        // Apply gravity
        firework.rocketVelocity.y -= 40 * delta;

        // Move rocket
        firework.rocket.position.add(
          firework.rocketVelocity.clone().multiplyScalar(delta)
        );

        // Explode when velocity becomes downward
        if (firework.rocketVelocity.y < 0) {
          this.explodeFirework(firework);
        }
      } else if (firework.state === 'exploding') {
        let allDead = true;

        firework.particles.forEach((p) => {
          if (p.life > 0) {
            allDead = false;
            p.life -= delta;

            // Apply gravity and drag
            p.velocity.y -= 20 * delta;
            p.velocity.multiplyScalar(0.98);

            // Move particle
            p.position.add(p.velocity.clone().multiplyScalar(delta));
          }
        });

        if (allDead) {
          firework.state = 'done';
        }
      }
    });

    // Update particle meshes
    this.fireworks.forEach((firework, fwIndex) => {
      if (firework.state === 'exploding') {
        const meshIndex = this.fireworks.slice(0, fwIndex + 1)
          .filter(f => f.state === 'exploding' || f.state === 'done').length - 1;

        if (meshIndex >= 0 && meshIndex < this.particleMeshes.length) {
          const points = this.particleMeshes[meshIndex];
          const positions = points.geometry.attributes.position.array as Float32Array;

          firework.particles.forEach((p, i) => {
            positions[i * 3] = p.position.x;
            positions[i * 3 + 1] = p.position.y;
            positions[i * 3 + 2] = p.position.z;
          });

          points.geometry.attributes.position.needsUpdate = true;

          // Fade out
          const avgLife = firework.particles.reduce((sum, p) => sum + p.life, 0) / firework.particles.length;
          const avgMaxLife = firework.particles.reduce((sum, p) => sum + p.maxLife, 0) / firework.particles.length;
          (points.material as THREE.PointsMaterial).opacity = Math.max(0, avgLife / avgMaxLife);
        }
      }
    });

    // Clean up finished fireworks
    this.fireworks = this.fireworks.filter(f => f.state !== 'done');
  }

  stop(): void {
    this.isActive = false;

    // Clean up all rockets
    this.fireworks.forEach((f) => {
      if (f.rocket) {
        this.scene.remove(f.rocket);
        f.rocket.geometry.dispose();
        (f.rocket.material as THREE.Material).dispose();
      }
    });

    // Clean up all particle systems
    this.particleMeshes.forEach((p) => {
      this.scene.remove(p);
      p.geometry.dispose();
      (p.material as THREE.Material).dispose();
    });

    this.fireworks = [];
    this.particleMeshes = [];
  }

  isFinished(): boolean {
    return this.fireworks.length === 0 && !this.isActive;
  }
}
