import * as THREE from 'three';

export class Rain {
  private particles: THREE.Points;
  private positions: Float32Array;
  private velocities: Float32Array;
  private particleCount: number;
  private isActive = false;
  private intensity = 0; // 0-1, controls opacity and density

  constructor(scene: THREE.Scene, _worldSize: number, particleCount = 3000) {
    this.particleCount = particleCount;

    // Create geometry
    const geometry = new THREE.BufferGeometry();
    this.positions = new Float32Array(particleCount * 3);
    this.velocities = new Float32Array(particleCount);

    // Initialize particles
    for (let i = 0; i < particleCount; i++) {
      this.resetParticle(i);
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));

    // Create shader material for rain
    const material = new THREE.ShaderMaterial({
      uniforms: {
        color: { value: new THREE.Color(0xaaccff) },
        intensity: { value: 0.0 },
      },
      vertexShader: `
        uniform float intensity;
        varying float vAlpha;

        void main() {
          vAlpha = intensity;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          // Rain drops are elongated based on fall speed
          gl_PointSize = 3.0 + (30.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying float vAlpha;
        uniform vec3 color;

        void main() {
          // Elongated raindrop shape
          vec2 center = gl_PointCoord - vec2(0.5);
          float dist = length(center * vec2(1.0, 0.3)); // Stretch vertically
          float alpha = smoothstep(0.5, 0.1, dist) * vAlpha * 0.4;

          gl_FragColor = vec4(color, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.particles = new THREE.Points(geometry, material);
    this.particles.visible = false;
    scene.add(this.particles);
  }

  private resetParticle(index: number): void {
    const i3 = index * 3;

    // Random position around player (will be offset in update)
    this.positions[i3] = (Math.random() - 0.5) * 100;
    this.positions[i3 + 1] = Math.random() * 80 + 20; // Height 20-100
    this.positions[i3 + 2] = (Math.random() - 0.5) * 100;

    // Fall speed
    this.velocities[index] = 40 + Math.random() * 30; // 40-70 units/sec
  }

  setActive(active: boolean): void {
    this.isActive = active;
    this.particles.visible = active;
  }

  setIntensity(intensity: number): void {
    this.intensity = Math.max(0, Math.min(1, intensity));
    (this.particles.material as THREE.ShaderMaterial).uniforms.intensity.value = this.intensity;
  }

  update(delta: number, playerPos: THREE.Vector3): void {
    if (!this.isActive) return;

    const positionAttr = this.particles.geometry.getAttribute('position') as THREE.BufferAttribute;

    for (let i = 0; i < this.particleCount; i++) {
      const i3 = i * 3;

      // Fall down
      this.positions[i3 + 1] -= this.velocities[i] * delta;

      // Slight wind drift
      this.positions[i3] += delta * 5;

      // Reset if below ground or too far from player
      if (this.positions[i3 + 1] < 0) {
        this.resetParticle(i);
        // Reposition around player
        this.positions[i3] += playerPos.x;
        this.positions[i3 + 2] += playerPos.z;
      }

      // Keep particles near player
      const dx = this.positions[i3] - playerPos.x;
      const dz = this.positions[i3 + 2] - playerPos.z;
      if (Math.abs(dx) > 60) {
        this.positions[i3] = playerPos.x + (Math.random() - 0.5) * 100;
      }
      if (Math.abs(dz) > 60) {
        this.positions[i3 + 2] = playerPos.z + (Math.random() - 0.5) * 100;
      }
    }

    positionAttr.needsUpdate = true;
  }

  dispose(scene: THREE.Scene): void {
    scene.remove(this.particles);
    this.particles.geometry.dispose();
    (this.particles.material as THREE.Material).dispose();
  }
}
