import * as THREE from 'three';
import { FogOfWar } from './FogOfWar';

/**
 * Ember particles that float around in corrupted fog areas
 */
export class EmberParticles {
  private particles: THREE.Points;
  private positions: Float32Array;
  private velocities: Float32Array;
  private lifetimes: Float32Array;
  private particleCount: number;
  private fogOfWar: FogOfWar;
  private citySize: number;
  private time = 0;

  constructor(scene: THREE.Scene, fogOfWar: FogOfWar, citySize: number, particleCount = 100) {
    this.particleCount = particleCount;
    this.fogOfWar = fogOfWar;
    this.citySize = citySize;

    // Create geometry
    const geometry = new THREE.BufferGeometry();
    this.positions = new Float32Array(particleCount * 3);
    this.velocities = new Float32Array(particleCount * 3);
    this.lifetimes = new Float32Array(particleCount);

    // Initialize particles
    for (let i = 0; i < particleCount; i++) {
      this.resetParticle(i);
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));

    // Create shader material for ember particles
    const material = new THREE.ShaderMaterial({
      uniforms: {
        pointSize: { value: 15.0 },
        time: { value: 0.0 },
      },
      vertexShader: `
        uniform float pointSize;
        uniform float time;
        varying float vAlpha;

        void main() {
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);

          // Flicker effect based on position and time
          float flicker = 0.7 + 0.3 * sin(time * 10.0 + position.x * 5.0 + position.z * 3.0);
          vAlpha = flicker;

          gl_PointSize = pointSize / -mvPosition.z;
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying float vAlpha;

        void main() {
          // Circular ember shape with soft edges
          vec2 uv = gl_PointCoord - vec2(0.5);
          float dist = length(uv);
          float alpha = smoothstep(0.5, 0.1, dist) * vAlpha;

          // Ember colors - orange to red gradient from center
          vec3 coreColor = vec3(1.0, 0.8, 0.3); // Yellow-orange core
          vec3 edgeColor = vec3(0.9, 0.3, 0.1); // Red-orange edge
          vec3 color = mix(edgeColor, coreColor, 1.0 - dist * 2.0);

          gl_FragColor = vec4(color, alpha * 0.7);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.particles = new THREE.Points(geometry, material);
    scene.add(this.particles);
  }

  private getRandomCorruptedPosition(): { x: number; y: number; z: number } | null {
    // Try to find a corrupted area
    const maxAttempts = 20;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const x = (Math.random() - 0.5) * this.citySize;
      const z = (Math.random() - 0.5) * this.citySize;
      const corruption = this.fogOfWar.getCorruptionAt(x, z);

      if (corruption > 0.3) {
        return {
          x,
          y: Math.random() * 5 + 1, // 1-6 units high
          z,
        };
      }
    }

    // No corrupted area found, return null
    return null;
  }

  private resetParticle(index: number): void {
    const i3 = index * 3;

    // Find a corrupted position
    const pos = this.getRandomCorruptedPosition();
    if (pos) {
      this.positions[i3] = pos.x;
      this.positions[i3 + 1] = pos.y;
      this.positions[i3 + 2] = pos.z;
    } else {
      // Hide particle far away if no corruption
      this.positions[i3] = 10000;
      this.positions[i3 + 1] = -100;
      this.positions[i3 + 2] = 10000;
    }

    // Slow upward drift with slight horizontal movement
    this.velocities[i3] = (Math.random() - 0.5) * 2;
    this.velocities[i3 + 1] = 1 + Math.random() * 2; // Upward
    this.velocities[i3 + 2] = (Math.random() - 0.5) * 2;

    // Lifetime
    this.lifetimes[index] = 2 + Math.random() * 3;
  }

  update(delta: number, _playerPos: THREE.Vector3): void {
    this.time += delta;
    const positionAttr = this.particles.geometry.getAttribute('position') as THREE.BufferAttribute;

    // Update shader time
    (this.particles.material as THREE.ShaderMaterial).uniforms.time.value = this.time;

    for (let i = 0; i < this.particleCount; i++) {
      const i3 = i * 3;

      // Update lifetime
      this.lifetimes[i] -= delta;
      if (this.lifetimes[i] <= 0 || this.positions[i3 + 1] > 15) {
        this.resetParticle(i);
        continue;
      }

      // Add swirling motion
      const swirl = Math.sin(this.time * 3 + i) * 0.5;
      const drift = Math.cos(this.time * 2 + i * 0.3) * 0.3;

      // Update position
      this.positions[i3] += (this.velocities[i3] + swirl) * delta;
      this.positions[i3 + 1] += this.velocities[i3 + 1] * delta;
      this.positions[i3 + 2] += (this.velocities[i3 + 2] + drift) * delta;

      // Check if still in corrupted area - if not, fade faster
      const corruption = this.fogOfWar.getCorruptionAt(this.positions[i3], this.positions[i3 + 2]);
      if (corruption < 0.2) {
        this.lifetimes[i] -= delta * 2; // Fade faster when leaving corruption
      }

      // Add random turbulence
      this.velocities[i3] += (Math.random() - 0.5) * delta * 3;
      this.velocities[i3 + 2] += (Math.random() - 0.5) * delta * 3;
    }

    positionAttr.needsUpdate = true;
  }

  dispose(scene: THREE.Scene): void {
    scene.remove(this.particles);
    this.particles.geometry.dispose();
    (this.particles.material as THREE.Material).dispose();
  }
}
