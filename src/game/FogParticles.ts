import * as THREE from 'three';

export class FogParticles {
  private particles: THREE.Points;
  private positions: Float32Array;
  private velocities: Float32Array;
  private opacities: Float32Array;
  private particleCount: number;
  private worldSize: number;

  constructor(scene: THREE.Scene, worldSize: number, particleCount = 500) {
    this.particleCount = particleCount;
    this.worldSize = worldSize;

    // Create geometry
    const geometry = new THREE.BufferGeometry();
    this.positions = new Float32Array(particleCount * 3);
    this.velocities = new Float32Array(particleCount * 3);
    this.opacities = new Float32Array(particleCount);

    // Initialize particles
    for (let i = 0; i < particleCount; i++) {
      this.resetParticle(i);
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geometry.setAttribute('opacity', new THREE.BufferAttribute(this.opacities, 1));

    // Create shader material for fog particles
    const material = new THREE.ShaderMaterial({
      uniforms: {
        color: { value: new THREE.Color(0xd4d4d8) },
        pointSize: { value: 80.0 },
      },
      vertexShader: `
        attribute float opacity;
        varying float vOpacity;

        uniform float pointSize;

        void main() {
          vOpacity = opacity;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = pointSize / -mvPosition.z;
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying float vOpacity;
        uniform vec3 color;

        void main() {
          // Soft circular particle
          vec2 center = gl_PointCoord - vec2(0.5);
          float dist = length(center);
          float alpha = smoothstep(0.5, 0.2, dist) * vOpacity;

          gl_FragColor = vec4(color, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.particles = new THREE.Points(geometry, material);
    scene.add(this.particles);
  }

  private resetParticle(index: number): void {
    const i3 = index * 3;

    // Random position within world bounds
    this.positions[i3] = (Math.random() - 0.5) * this.worldSize;
    this.positions[i3 + 1] = Math.random() * 30 + 2; // Height between 2 and 32
    this.positions[i3 + 2] = (Math.random() - 0.5) * this.worldSize;

    // Slow random velocity (mostly horizontal drift)
    this.velocities[i3] = (Math.random() - 0.5) * 2;
    this.velocities[i3 + 1] = (Math.random() - 0.5) * 0.5;
    this.velocities[i3 + 2] = (Math.random() - 0.5) * 2;

    // Random opacity
    this.opacities[index] = Math.random() * 0.15 + 0.05;
  }

  update(delta: number, playerPos: THREE.Vector3): void {
    const halfWorld = this.worldSize / 2;
    const positionAttr = this.particles.geometry.getAttribute('position') as THREE.BufferAttribute;
    const opacityAttr = this.particles.geometry.getAttribute('opacity') as THREE.BufferAttribute;

    for (let i = 0; i < this.particleCount; i++) {
      const i3 = i * 3;

      // Update position
      this.positions[i3] += this.velocities[i3] * delta;
      this.positions[i3 + 1] += this.velocities[i3 + 1] * delta;
      this.positions[i3 + 2] += this.velocities[i3 + 2] * delta;

      // Wrap around world bounds
      if (this.positions[i3] < -halfWorld) this.positions[i3] = halfWorld;
      if (this.positions[i3] > halfWorld) this.positions[i3] = -halfWorld;
      if (this.positions[i3 + 2] < -halfWorld) this.positions[i3 + 2] = halfWorld;
      if (this.positions[i3 + 2] > halfWorld) this.positions[i3 + 2] = -halfWorld;

      // Keep height in bounds
      if (this.positions[i3 + 1] < 2 || this.positions[i3 + 1] > 50) {
        this.velocities[i3 + 1] *= -1;
      }

      // Fade particles near player (they're clearing the fog)
      const dx = this.positions[i3] - playerPos.x;
      const dz = this.positions[i3 + 2] - playerPos.z;
      const distToPlayer = Math.sqrt(dx * dx + dz * dz);
      const fadeDistance = 30;

      if (distToPlayer < fadeDistance) {
        this.opacities[i] = Math.max(0, this.opacities[i] - delta * 0.5);
        if (this.opacities[i] <= 0) {
          // Respawn particle far from player
          this.resetParticle(i);
          // Make sure it's far from player
          const angle = Math.random() * Math.PI * 2;
          const dist = fadeDistance + Math.random() * 50;
          this.positions[i3] = playerPos.x + Math.cos(angle) * dist;
          this.positions[i3 + 2] = playerPos.z + Math.sin(angle) * dist;
        }
      } else {
        // Slowly restore opacity
        const targetOpacity = 0.1 + Math.random() * 0.1;
        this.opacities[i] = Math.min(targetOpacity, this.opacities[i] + delta * 0.1);
      }
    }

    positionAttr.needsUpdate = true;
    opacityAttr.needsUpdate = true;
  }

  dispose(scene: THREE.Scene): void {
    scene.remove(this.particles);
    this.particles.geometry.dispose();
    (this.particles.material as THREE.Material).dispose();
  }
}
