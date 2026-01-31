import * as THREE from 'three';

/**
 * Leaf particles that blow around in park areas
 */
export class LeafParticles {
  private particles: THREE.Points;
  private positions: Float32Array;
  private velocities: Float32Array;
  private rotations: Float32Array;
  private lifetimes: Float32Array;
  private colors: Float32Array;
  private particleCount: number;
  private parkCenters: THREE.Vector2[];
  private parkRadius: number;
  private time = 0;

  constructor(scene: THREE.Scene, parkCenters: THREE.Vector2[], parkRadius = 40, particleCount = 150) {
    this.particleCount = particleCount;
    this.parkCenters = parkCenters;
    this.parkRadius = parkRadius;

    // Create geometry
    const geometry = new THREE.BufferGeometry();
    this.positions = new Float32Array(particleCount * 3);
    this.velocities = new Float32Array(particleCount * 3);
    this.rotations = new Float32Array(particleCount);
    this.lifetimes = new Float32Array(particleCount);
    this.colors = new Float32Array(particleCount * 3);

    // Initialize particles
    for (let i = 0; i < particleCount; i++) {
      this.resetParticle(i);
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));

    // Create shader material for leaf particles
    const material = new THREE.ShaderMaterial({
      uniforms: {
        pointSize: { value: 25.0 },
        time: { value: 0.0 },
      },
      vertexShader: `
        attribute vec3 color;
        varying vec3 vColor;
        uniform float pointSize;
        uniform float time;

        void main() {
          vColor = color;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = pointSize / -mvPosition.z;
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;

        void main() {
          // Leaf-like shape (oval with pointed ends)
          vec2 uv = gl_PointCoord - vec2(0.5);
          float angle = 0.3; // Slight rotation
          float c = cos(angle);
          float s = sin(angle);
          uv = vec2(uv.x * c - uv.y * s, uv.x * s + uv.y * c);

          // Elongated ellipse
          float leafShape = length(uv * vec2(1.0, 2.0));
          float alpha = smoothstep(0.5, 0.3, leafShape);

          // Add center vein
          float vein = 1.0 - smoothstep(0.0, 0.05, abs(uv.x));
          vec3 finalColor = mix(vColor, vColor * 0.7, vein * 0.3);

          gl_FragColor = vec4(finalColor, alpha * 0.8);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });

    this.particles = new THREE.Points(geometry, material);
    scene.add(this.particles);
  }

  private getRandomParkPosition(): { x: number; z: number } {
    if (this.parkCenters.length === 0) {
      return { x: 0, z: 0 };
    }

    // Pick a random park
    const park = this.parkCenters[Math.floor(Math.random() * this.parkCenters.length)];

    // Random position within park radius
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * this.parkRadius;

    return {
      x: park.x + Math.cos(angle) * dist,
      z: park.y + Math.sin(angle) * dist,
    };
  }

  private resetParticle(index: number): void {
    const i3 = index * 3;

    // Random position in a park
    const pos = this.getRandomParkPosition();
    this.positions[i3] = pos.x;
    this.positions[i3 + 1] = Math.random() * 3 + 0.5; // Low height (0.5 to 3.5)
    this.positions[i3 + 2] = pos.z;

    // Wind-driven velocity with swirling motion
    const windAngle = Math.random() * Math.PI * 2;
    const windSpeed = 2 + Math.random() * 3;
    this.velocities[i3] = Math.cos(windAngle) * windSpeed;
    this.velocities[i3 + 1] = (Math.random() - 0.3) * 2; // Mostly falling
    this.velocities[i3 + 2] = Math.sin(windAngle) * windSpeed;

    // Random rotation speed
    this.rotations[index] = (Math.random() - 0.5) * 5;

    // Lifetime for respawn
    this.lifetimes[index] = 3 + Math.random() * 5;

    // Autumn leaf colors (orange, yellow, red, brown, green)
    const colorChoice = Math.random();
    if (colorChoice < 0.25) {
      // Orange
      this.colors[i3] = 0.9 + Math.random() * 0.1;
      this.colors[i3 + 1] = 0.4 + Math.random() * 0.2;
      this.colors[i3 + 2] = 0.1;
    } else if (colorChoice < 0.5) {
      // Yellow
      this.colors[i3] = 0.9 + Math.random() * 0.1;
      this.colors[i3 + 1] = 0.7 + Math.random() * 0.2;
      this.colors[i3 + 2] = 0.1;
    } else if (colorChoice < 0.7) {
      // Red
      this.colors[i3] = 0.7 + Math.random() * 0.2;
      this.colors[i3 + 1] = 0.2 + Math.random() * 0.1;
      this.colors[i3 + 2] = 0.1;
    } else if (colorChoice < 0.85) {
      // Brown
      this.colors[i3] = 0.4 + Math.random() * 0.2;
      this.colors[i3 + 1] = 0.25 + Math.random() * 0.1;
      this.colors[i3 + 2] = 0.1;
    } else {
      // Green (some leaves still green)
      this.colors[i3] = 0.2 + Math.random() * 0.1;
      this.colors[i3 + 1] = 0.4 + Math.random() * 0.2;
      this.colors[i3 + 2] = 0.15;
    }
  }

  update(delta: number): void {
    this.time += delta;
    const positionAttr = this.particles.geometry.getAttribute('position') as THREE.BufferAttribute;
    const colorAttr = this.particles.geometry.getAttribute('color') as THREE.BufferAttribute;

    // Update shader time
    (this.particles.material as THREE.ShaderMaterial).uniforms.time.value = this.time;

    for (let i = 0; i < this.particleCount; i++) {
      const i3 = i * 3;

      // Update lifetime
      this.lifetimes[i] -= delta;
      if (this.lifetimes[i] <= 0 || this.positions[i3 + 1] < -1) {
        this.resetParticle(i);
        continue;
      }

      // Add swirling motion
      const swirl = Math.sin(this.time * 2 + i) * 0.5;
      const turbulence = Math.cos(this.time * 1.5 + i * 0.5) * 0.3;

      // Update position with wind and gravity
      this.positions[i3] += (this.velocities[i3] + swirl) * delta;
      this.positions[i3 + 1] += this.velocities[i3 + 1] * delta;
      this.positions[i3 + 2] += (this.velocities[i3 + 2] + turbulence) * delta;

      // Gravity pulling down, but wind can lift
      this.velocities[i3 + 1] -= 1.5 * delta;

      // Add some randomness to horizontal velocity (wind gusts)
      this.velocities[i3] += (Math.random() - 0.5) * delta * 2;
      this.velocities[i3 + 2] += (Math.random() - 0.5) * delta * 2;

      // Clamp falling speed
      this.velocities[i3 + 1] = Math.max(this.velocities[i3 + 1], -3);

      // Ground bounce (leaves settle on ground)
      if (this.positions[i3 + 1] < 0.1) {
        this.positions[i3 + 1] = 0.1;
        this.velocities[i3 + 1] *= -0.3; // Weak bounce
        this.velocities[i3] *= 0.8; // Friction
        this.velocities[i3 + 2] *= 0.8;
      }
    }

    positionAttr.needsUpdate = true;
    colorAttr.needsUpdate = true;
  }

  dispose(scene: THREE.Scene): void {
    scene.remove(this.particles);
    this.particles.geometry.dispose();
    (this.particles.material as THREE.Material).dispose();
  }
}
