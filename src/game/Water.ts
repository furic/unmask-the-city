import * as THREE from 'three';

interface WaterBody {
  position: THREE.Vector3;
  radius: number;
  type: 'lake' | 'river';
  riverLength?: number;
  riverAngle?: number;
}

export class Water {
  private scene: THREE.Scene;
  private waterBodies: WaterBody[] = [];
  private waterMeshes: THREE.Mesh[] = [];
  private time = 0;
  private uniforms: { [key: string]: { value: number } }[] = [];

  constructor(scene: THREE.Scene, worldSize: number) {
    this.scene = scene;
    this.generateWaterBodies(worldSize);
    this.createMeshes();
  }

  private generateWaterBodies(worldSize: number): void {
    const halfSize = worldSize / 2;

    // Generate 2-3 lakes
    const numLakes = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < numLakes; i++) {
      // Place lakes in different quadrants, avoiding spawn area
      const angle = (i / numLakes) * Math.PI * 2 + Math.random() * 0.8;
      const distance = 100 + Math.random() * (halfSize - 150);
      const x = Math.cos(angle) * distance;
      const z = Math.sin(angle) * distance;
      const radius = 20 + Math.random() * 25;

      this.waterBodies.push({
        position: new THREE.Vector3(x, 0, z),
        radius,
        type: 'lake',
      });
    }

    // Generate 1-2 rivers (elongated water bodies)
    const numRivers = 1 + Math.floor(Math.random() * 2);
    for (let i = 0; i < numRivers; i++) {
      const x = (Math.random() - 0.5) * worldSize * 0.6;
      const z = (Math.random() - 0.5) * worldSize * 0.6;

      // Avoid spawn area
      if (Math.abs(x) < 50 && Math.abs(z) < 50) continue;

      this.waterBodies.push({
        position: new THREE.Vector3(x, 0, z),
        radius: 8 + Math.random() * 6,
        type: 'river',
        riverLength: 60 + Math.random() * 80,
        riverAngle: Math.random() * Math.PI,
      });
    }
  }

  private createMeshes(): void {
    // Water shader material
    const waterVertexShader = `
      varying vec2 vUv;
      varying vec3 vWorldPos;

      void main() {
        vUv = uv;
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPos = worldPos.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `;

    const waterFragmentShader = `
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vWorldPos;

      void main() {
        // Animated ripples
        vec2 uv = vUv;
        float ripple1 = sin(uv.x * 20.0 + uTime * 2.0) * 0.02;
        float ripple2 = sin(uv.y * 15.0 + uTime * 1.5) * 0.02;
        float ripple3 = sin((uv.x + uv.y) * 25.0 + uTime * 3.0) * 0.01;

        // Base water color with depth variation
        vec3 shallowColor = vec3(0.2, 0.5, 0.7);
        vec3 deepColor = vec3(0.05, 0.2, 0.4);
        float depth = 0.5 + (ripple1 + ripple2 + ripple3);
        vec3 waterColor = mix(deepColor, shallowColor, depth);

        // Specular highlights
        float spec = pow(max(0.0, sin(uv.x * 30.0 + uTime * 4.0) * sin(uv.y * 30.0 + uTime * 3.0)), 8.0);
        waterColor += vec3(spec * 0.3);

        // Foam at edges (distance from center)
        float distFromCenter = length(vUv - vec2(0.5)) * 2.0;
        float foam = smoothstep(0.85, 0.95, distFromCenter);
        foam *= sin(distFromCenter * 50.0 + uTime * 5.0) * 0.5 + 0.5;
        waterColor = mix(waterColor, vec3(0.8, 0.9, 1.0), foam * 0.6);

        gl_FragColor = vec4(waterColor, 0.85);
      }
    `;

    this.waterBodies.forEach((body) => {
      let geometry: THREE.BufferGeometry;

      if (body.type === 'lake') {
        geometry = new THREE.CircleGeometry(body.radius, 32);
      } else {
        // River: elongated shape
        geometry = new THREE.PlaneGeometry(body.radius * 2, body.riverLength || 80);
      }

      const uniforms = { uTime: { value: 0 } };
      this.uniforms.push(uniforms);

      const material = new THREE.ShaderMaterial({
        uniforms,
        vertexShader: waterVertexShader,
        fragmentShader: waterFragmentShader,
        transparent: true,
        side: THREE.DoubleSide,
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.copy(body.position);
      mesh.position.y = 0.1; // Slightly above ground

      if (body.type === 'river' && body.riverAngle !== undefined) {
        mesh.rotation.z = body.riverAngle;
      }

      this.waterMeshes.push(mesh);
      this.scene.add(mesh);
    });
  }

  update(delta: number): void {
    this.time += delta;
    this.uniforms.forEach((u) => {
      u.uTime.value = this.time;
    });
  }

  // Check if a position is in water
  isInWater(position: THREE.Vector3): boolean {
    for (const body of this.waterBodies) {
      if (body.type === 'lake') {
        const dist = Math.sqrt(
          Math.pow(position.x - body.position.x, 2) +
          Math.pow(position.z - body.position.z, 2)
        );
        if (dist < body.radius) return true;
      } else {
        // River: check elongated bounds
        const angle = body.riverAngle || 0;
        const dx = position.x - body.position.x;
        const dz = position.z - body.position.z;
        // Rotate to river's local space
        const localX = dx * Math.cos(-angle) - dz * Math.sin(-angle);
        const localZ = dx * Math.sin(-angle) + dz * Math.cos(-angle);

        if (Math.abs(localX) < body.radius && Math.abs(localZ) < (body.riverLength || 80) / 2) {
          return true;
        }
      }
    }
    return false;
  }

  // Get water bodies for collision/spawn checking
  getWaterBodies(): WaterBody[] {
    return this.waterBodies;
  }

  // Check if position is too close to water (for building spawning)
  isNearWater(position: THREE.Vector3, padding = 10): boolean {
    for (const body of this.waterBodies) {
      const dist = Math.sqrt(
        Math.pow(position.x - body.position.x, 2) +
        Math.pow(position.z - body.position.z, 2)
      );
      const effectiveRadius = body.type === 'lake'
        ? body.radius + padding
        : Math.max(body.radius, (body.riverLength || 80) / 2) + padding;

      if (dist < effectiveRadius) return true;
    }
    return false;
  }

  dispose(): void {
    this.waterMeshes.forEach((mesh) => {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    });
    this.waterMeshes = [];
    this.waterBodies = [];
    this.uniforms = [];
  }
}
