import * as THREE from 'three';

interface VentParticle {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  size: number;
}

interface Vent {
  position: THREE.Vector3;
  particles: VentParticle[];
}

/**
 * Steam vents on building rooftops
 */
export class SteamVents {
  private scene: THREE.Scene;
  private vents: Vent[] = [];
  private particleMesh: THREE.Points | null = null;
  private positions: Float32Array;
  private sizes: Float32Array;
  private alphas: Float32Array;
  private readonly PARTICLES_PER_VENT = 15;
  private readonly MAX_VENTS = 20;
  private time = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.positions = new Float32Array(this.MAX_VENTS * this.PARTICLES_PER_VENT * 3);
    this.sizes = new Float32Array(this.MAX_VENTS * this.PARTICLES_PER_VENT);
    this.alphas = new Float32Array(this.MAX_VENTS * this.PARTICLES_PER_VENT);
    this.createParticleSystem();
  }

  private createParticleSystem(): void {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(this.sizes, 1));
    geometry.setAttribute('alpha', new THREE.BufferAttribute(this.alphas, 1));

    const material = new THREE.ShaderMaterial({
      uniforms: {
        color: { value: new THREE.Color(0xcccccc) },
      },
      vertexShader: `
        attribute float size;
        attribute float alpha;
        varying float vAlpha;

        void main() {
          vAlpha = alpha;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (200.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 color;
        varying float vAlpha;

        void main() {
          vec2 uv = gl_PointCoord - vec2(0.5);
          float dist = length(uv);
          float alpha = smoothstep(0.5, 0.0, dist) * vAlpha;
          gl_FragColor = vec4(color, alpha * 0.4);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });

    this.particleMesh = new THREE.Points(geometry, material);
    this.scene.add(this.particleMesh);
  }

  addVent(position: THREE.Vector3): void {
    if (this.vents.length >= this.MAX_VENTS) return;

    const vent: Vent = {
      position: position.clone(),
      particles: [],
    };

    // Initialize particles for this vent
    for (let i = 0; i < this.PARTICLES_PER_VENT; i++) {
      vent.particles.push(this.createParticle(position));
    }

    this.vents.push(vent);
  }

  private createParticle(ventPos: THREE.Vector3): VentParticle {
    const angle = Math.random() * Math.PI * 2;
    const spread = 0.5;

    return {
      position: ventPos.clone().add(new THREE.Vector3(
        Math.cos(angle) * Math.random() * spread,
        Math.random() * 0.5,
        Math.sin(angle) * Math.random() * spread
      )),
      velocity: new THREE.Vector3(
        (Math.random() - 0.5) * 1,
        2 + Math.random() * 3, // Upward
        (Math.random() - 0.5) * 1
      ),
      life: Math.random() * 2,
      maxLife: 1.5 + Math.random() * 1,
      size: 2 + Math.random() * 2,
    };
  }

  update(delta: number): void {
    this.time += delta;

    let particleIndex = 0;

    for (const vent of this.vents) {
      // Pulsing emission rate
      const emitPulse = Math.sin(this.time * 2 + vent.position.x) > 0.3;

      for (let i = 0; i < vent.particles.length; i++) {
        const particle = vent.particles[i];

        // Update particle
        particle.life -= delta;

        if (particle.life <= 0) {
          // Reset particle
          if (emitPulse) {
            vent.particles[i] = this.createParticle(vent.position);
          } else {
            // Hide particle when not emitting
            particle.position.y = -1000;
          }
        } else {
          // Move particle
          particle.position.add(particle.velocity.clone().multiplyScalar(delta));

          // Add turbulence
          particle.velocity.x += (Math.random() - 0.5) * delta * 2;
          particle.velocity.z += (Math.random() - 0.5) * delta * 2;

          // Slow down vertical velocity
          particle.velocity.y *= 0.98;

          // Expand size over time
          particle.size += delta * 2;
        }

        // Update buffers
        const i3 = particleIndex * 3;
        this.positions[i3] = particle.position.x;
        this.positions[i3 + 1] = particle.position.y;
        this.positions[i3 + 2] = particle.position.z;
        this.sizes[particleIndex] = particle.size;
        this.alphas[particleIndex] = particle.life / particle.maxLife;

        particleIndex++;
      }
    }

    // Fill remaining slots with hidden particles
    while (particleIndex < this.MAX_VENTS * this.PARTICLES_PER_VENT) {
      const i3 = particleIndex * 3;
      this.positions[i3 + 1] = -1000; // Hide
      this.sizes[particleIndex] = 0;
      this.alphas[particleIndex] = 0;
      particleIndex++;
    }

    // Update geometry
    if (this.particleMesh) {
      const posAttr = this.particleMesh.geometry.getAttribute('position') as THREE.BufferAttribute;
      const sizeAttr = this.particleMesh.geometry.getAttribute('size') as THREE.BufferAttribute;
      const alphaAttr = this.particleMesh.geometry.getAttribute('alpha') as THREE.BufferAttribute;
      posAttr.needsUpdate = true;
      sizeAttr.needsUpdate = true;
      alphaAttr.needsUpdate = true;
    }
  }

  dispose(): void {
    if (this.particleMesh) {
      this.scene.remove(this.particleMesh);
      this.particleMesh.geometry.dispose();
      (this.particleMesh.material as THREE.Material).dispose();
    }
  }
}
