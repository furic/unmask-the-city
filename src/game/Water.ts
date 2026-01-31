import * as THREE from 'three';
import { Water as ThreeWater } from 'three/addons/objects/Water.js';

interface WaterBody {
  position: THREE.Vector3;
  radius: number;
  type: 'lake' | 'river';
  riverLength?: number;
  riverAngle?: number;
  shorelineShape?: number[]; // Random offsets for organic shoreline
}

export class Water {
  private scene: THREE.Scene;
  private waterBodies: WaterBody[] = [];
  private waterMeshes: ThreeWater[] = [];
  private shorelineMeshes: THREE.Mesh[] = [];
  private rockMeshes: THREE.Mesh[] = [];
  private sunLight: THREE.DirectionalLight;

  constructor(scene: THREE.Scene, worldSize: number, sunLight: THREE.DirectionalLight) {
    this.scene = scene;
    this.sunLight = sunLight;
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
      const radius = 25 + Math.random() * 30;

      // Generate random shoreline shape (12-16 control points)
      const numPoints = 12 + Math.floor(Math.random() * 5);
      const shorelineShape: number[] = [];
      for (let j = 0; j < numPoints; j++) {
        // Random variation between 0.7 and 1.0 of radius
        shorelineShape.push(0.7 + Math.random() * 0.3);
      }

      this.waterBodies.push({
        position: new THREE.Vector3(x, 0, z),
        radius,
        type: 'lake',
        shorelineShape,
      });
    }

    // Generate 1-2 rivers (elongated water bodies)
    const numRivers = 1 + Math.floor(Math.random() * 2);
    for (let i = 0; i < numRivers; i++) {
      const x = (Math.random() - 0.5) * worldSize * 0.6;
      const z = (Math.random() - 0.5) * worldSize * 0.6;

      // Avoid spawn area
      if (Math.abs(x) < 50 && Math.abs(z) < 50) continue;

      // Generate wavy river banks
      const numPoints = 20;
      const shorelineShape: number[] = [];
      for (let j = 0; j < numPoints; j++) {
        shorelineShape.push(0.6 + Math.random() * 0.4);
      }

      this.waterBodies.push({
        position: new THREE.Vector3(x, 0, z),
        radius: 12 + Math.random() * 8,
        type: 'river',
        riverLength: 80 + Math.random() * 100,
        riverAngle: Math.random() * Math.PI,
        shorelineShape,
      });
    }
  }

  private createMeshes(): void {
    // Create a procedural water normal texture
    const normalTexture = this.createWaterNormalTexture();

    this.waterBodies.forEach((body) => {
      let geometry: THREE.PlaneGeometry;
      let width: number;
      let height: number;

      if (body.type === 'lake') {
        // Use square plane for lakes - slightly larger than visible area
        width = body.radius * 2.4;
        height = body.radius * 2.4;
        geometry = new THREE.PlaneGeometry(width, height, 32, 32);
      } else {
        // River: elongated shape
        width = body.radius * 2.2;
        height = body.riverLength || 80;
        geometry = new THREE.PlaneGeometry(width, height, 16, 64);
      }

      // Create the realistic water
      const water = new ThreeWater(geometry, {
        textureWidth: 512,
        textureHeight: 512,
        waterNormals: normalTexture,
        sunDirection: this.sunLight.position.clone().normalize(),
        sunColor: 0xffffff,
        waterColor: 0x001e0f,
        distortionScale: 3.7,
        fog: this.scene.fog !== undefined,
      });

      water.rotation.x = -Math.PI / 2;
      water.position.copy(body.position);
      water.position.y = 0.1; // Slightly above ground

      if (body.type === 'river' && body.riverAngle !== undefined) {
        water.rotation.z = body.riverAngle;
      }

      // Customize water material properties
      const waterMaterial = water.material as THREE.ShaderMaterial;
      waterMaterial.uniforms['size'].value = 4.0;

      this.waterMeshes.push(water);
      this.scene.add(water);

      // Create shoreline to mask square edges
      this.createShoreline(body);

      // Add some rocks around the shoreline
      this.createShorelineRocks(body);
    });
  }

  private createShoreline(body: WaterBody): void {
    if (body.type === 'lake') {
      this.createLakeShoreline(body);
    } else {
      this.createRiverBanks(body);
    }
  }

  private createLakeShoreline(body: WaterBody): void {
    const shape = body.shorelineShape || [];
    const numPoints = shape.length || 12;

    // Create a ground plane with a hole cut out for the water
    // Use THREE.Shape with a hole path
    const outerSize = body.radius * 2.0; // Size of the ground cover square

    // Outer shape (square that covers the water plane edges)
    const outerShape = new THREE.Shape();
    outerShape.moveTo(-outerSize, -outerSize);
    outerShape.lineTo(outerSize, -outerSize);
    outerShape.lineTo(outerSize, outerSize);
    outerShape.lineTo(-outerSize, outerSize);
    outerShape.lineTo(-outerSize, -outerSize);

    // Inner hole (organic water shape)
    const holePath = new THREE.Path();
    const holeSegments = 64;

    for (let i = 0; i <= holeSegments; i++) {
      const angle = (i / holeSegments) * Math.PI * 2;

      // Get shoreline variation using interpolation between control points
      const shapeIndex = (i / holeSegments) * numPoints;
      const idx1 = Math.floor(shapeIndex) % numPoints;
      const idx2 = (idx1 + 1) % numPoints;
      const t = shapeIndex - Math.floor(shapeIndex);
      const variation = shape[idx1] * (1 - t) + shape[idx2] * t;

      const r = body.radius * variation * 0.95; // Slightly smaller than water edge
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;

      if (i === 0) {
        holePath.moveTo(x, z);
      } else {
        holePath.lineTo(x, z);
      }
    }

    outerShape.holes.push(holePath);

    // Create geometry from shape
    const geometry = new THREE.ShapeGeometry(outerShape, 1);

    // Rotate to lay flat (Shape is in XY plane, we need XZ)
    geometry.rotateX(-Math.PI / 2);

    // Ground-colored material
    const material = new THREE.MeshStandardMaterial({
      color: 0x3d3d3d, // Match ground color
      roughness: 0.95,
      metalness: 0.0,
      side: THREE.DoubleSide,
    });

    const shoreline = new THREE.Mesh(geometry, material);
    shoreline.position.copy(body.position);
    shoreline.position.y = 0.2; // Above water surface
    shoreline.receiveShadow = true;

    this.shorelineMeshes.push(shoreline);
    this.scene.add(shoreline);
  }

  private createRiverBanks(body: WaterBody): void {
    const shape = body.shorelineShape || [];
    const numPoints = shape.length || 20;
    const riverLength = body.riverLength || 80;
    const riverWidth = body.radius;
    const angle = body.riverAngle || 0;

    // Create a ground plane with a hole cut out for the river
    const outerWidth = riverWidth * 2.5;
    const outerLength = riverLength * 0.6;

    // Outer shape (rectangle covering the river plane)
    const outerShape = new THREE.Shape();
    outerShape.moveTo(-outerWidth, -outerLength);
    outerShape.lineTo(outerWidth, -outerLength);
    outerShape.lineTo(outerWidth, outerLength);
    outerShape.lineTo(-outerWidth, outerLength);
    outerShape.lineTo(-outerWidth, -outerLength);

    // Inner hole (wavy river shape)
    const holePath = new THREE.Path();

    // Build the river hole path - go along one side, then back along the other
    const riverPoints: { x: number; z: number }[] = [];

    // One side of river
    for (let i = 0; i <= numPoints; i++) {
      const t = i / numPoints;
      const alongRiver = (t - 0.5) * riverLength * 0.95;
      const variation = shape[i % numPoints];
      const offset = riverWidth * variation * 0.9;

      riverPoints.push({
        x: offset,
        z: alongRiver,
      });
    }

    // Other side of river (reverse direction)
    for (let i = numPoints; i >= 0; i--) {
      const t = i / numPoints;
      const alongRiver = (t - 0.5) * riverLength * 0.95;
      const variation = shape[i % numPoints];
      const offset = -riverWidth * variation * 0.9;

      riverPoints.push({
        x: offset,
        z: alongRiver,
      });
    }

    // Create hole path
    riverPoints.forEach((pt, i) => {
      if (i === 0) {
        holePath.moveTo(pt.x, pt.z);
      } else {
        holePath.lineTo(pt.x, pt.z);
      }
    });

    outerShape.holes.push(holePath);

    // Create geometry
    const geometry = new THREE.ShapeGeometry(outerShape, 1);

    // Rotate to lay flat and apply river angle
    geometry.rotateX(-Math.PI / 2);
    geometry.rotateY(angle);

    const material = new THREE.MeshStandardMaterial({
      color: 0x3d3d3d,
      roughness: 0.95,
      metalness: 0.0,
      side: THREE.DoubleSide,
    });

    const bank = new THREE.Mesh(geometry, material);
    bank.position.copy(body.position);
    bank.position.y = 0.2;
    bank.receiveShadow = true;

    this.shorelineMeshes.push(bank);
    this.scene.add(bank);
  }

  private createShorelineRocks(body: WaterBody): void {
    const shape = body.shorelineShape || [];
    const numRocks = body.type === 'lake' ? 8 + Math.floor(Math.random() * 6) : 12 + Math.floor(Math.random() * 8);

    const rockGeometries = [
      new THREE.DodecahedronGeometry(1, 0),
      new THREE.IcosahedronGeometry(1, 0),
      new THREE.OctahedronGeometry(1, 0),
    ];

    const rockMaterial = new THREE.MeshStandardMaterial({
      color: 0x696969,
      roughness: 0.95,
      metalness: 0.05,
    });

    for (let i = 0; i < numRocks; i++) {
      const geom = rockGeometries[Math.floor(Math.random() * rockGeometries.length)].clone();

      // Random scale
      const scale = 0.5 + Math.random() * 1.5;

      // Position along shoreline
      let rockX: number, rockZ: number;

      if (body.type === 'lake') {
        const angle = Math.random() * Math.PI * 2;
        const shapeIndex = (angle / (Math.PI * 2)) * shape.length;
        const idx1 = Math.floor(shapeIndex) % shape.length;
        const idx2 = (idx1 + 1) % shape.length;
        const t = shapeIndex - Math.floor(shapeIndex);
        const variation = shape[idx1] * (1 - t) + shape[idx2] * t;

        // Place near the shoreline edge
        const r = body.radius * variation * (0.95 + Math.random() * 0.15);
        rockX = Math.cos(angle) * r;
        rockZ = Math.sin(angle) * r;
      } else {
        // River rocks along banks
        const t = Math.random();
        const riverLength = body.riverLength || 80;
        const alongRiver = (t - 0.5) * riverLength * 0.9;
        const side = Math.random() > 0.5 ? 1 : -1;
        const riverAngle = body.riverAngle || 0;

        const offset = body.radius * (0.8 + Math.random() * 0.3) * side;
        rockX = alongRiver * Math.sin(riverAngle) + offset * Math.cos(riverAngle);
        rockZ = alongRiver * Math.cos(riverAngle) - offset * Math.sin(riverAngle);
      }

      const rock = new THREE.Mesh(geom, rockMaterial);
      rock.position.set(
        body.position.x + rockX,
        scale * 0.3,
        body.position.z + rockZ
      );
      rock.scale.set(scale, scale * 0.6, scale); // Flatten slightly
      rock.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
      );
      rock.castShadow = true;
      rock.receiveShadow = true;

      this.rockMeshes.push(rock);
      this.scene.add(rock);
    }
  }

  private createWaterNormalTexture(): THREE.Texture {
    // Create a procedural normal map for water
    const size = 256;
    const data = new Uint8Array(size * size * 4);

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4;

        // Generate procedural normals using multiple sine waves
        const fx = x / size;
        const fy = y / size;

        // Multiple wave frequencies for more realistic look
        const wave1 = Math.sin(fx * 12 + fy * 8) * 0.5;
        const wave2 = Math.sin(fx * 20 - fy * 15) * 0.3;
        const wave3 = Math.sin((fx + fy) * 25) * 0.2;
        const wave4 = Math.sin(fx * 40 + fy * 35) * 0.1;

        const nx = (wave1 + wave2) * 0.5;
        const ny = (wave3 + wave4) * 0.5;
        const nz = 1.0;

        // Normalize
        const len = Math.sqrt(nx * nx + ny * ny + nz * nz);

        // Convert to 0-255 range (normal maps use 128 as zero)
        data[i] = Math.floor(((nx / len) * 0.5 + 0.5) * 255);
        data[i + 1] = Math.floor(((ny / len) * 0.5 + 0.5) * 255);
        data[i + 2] = Math.floor(((nz / len) * 0.5 + 0.5) * 255);
        data[i + 3] = 255;
      }
    }

    const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.needsUpdate = true;

    return texture;
  }

  update(delta: number): void {
    // Update water animation
    this.waterMeshes.forEach((water) => {
      const material = water.material as THREE.ShaderMaterial;
      material.uniforms['time'].value += delta * 0.5;
    });
  }

  updateSunDirection(sunPosition: THREE.Vector3): void {
    const sunDir = sunPosition.clone().normalize();
    this.waterMeshes.forEach((water) => {
      const material = water.material as THREE.ShaderMaterial;
      material.uniforms['sunDirection'].value.copy(sunDir);
    });
  }

  // Check if a position is in water (uses organic shoreline shape)
  isInWater(position: THREE.Vector3): boolean {
    for (const body of this.waterBodies) {
      if (body.type === 'lake') {
        const dx = position.x - body.position.x;
        const dz = position.z - body.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        // Use shoreline shape for accurate boundary
        const shape = body.shorelineShape || [];
        if (shape.length > 0) {
          const angle = Math.atan2(dz, dx);
          const normalizedAngle = angle < 0 ? angle + Math.PI * 2 : angle;
          const shapeIndex = (normalizedAngle / (Math.PI * 2)) * shape.length;
          const idx1 = Math.floor(shapeIndex) % shape.length;
          const idx2 = (idx1 + 1) % shape.length;
          const t = shapeIndex - Math.floor(shapeIndex);
          const variation = shape[idx1] * (1 - t) + shape[idx2] * t;

          if (dist < body.radius * variation) return true;
        } else {
          if (dist < body.radius) return true;
        }
      } else {
        // River: check elongated bounds with wavy edges
        const angle = body.riverAngle || 0;
        const dx = position.x - body.position.x;
        const dz = position.z - body.position.z;
        // Rotate to river's local space
        const localX = dx * Math.cos(-angle) - dz * Math.sin(-angle);
        const localZ = dx * Math.sin(-angle) + dz * Math.cos(-angle);

        const riverLength = body.riverLength || 80;
        const shape = body.shorelineShape || [];

        if (Math.abs(localZ) < riverLength / 2) {
          // Get width variation at this point
          let effectiveWidth = body.radius;
          if (shape.length > 0) {
            const t = (localZ / riverLength + 0.5);
            const idx = Math.floor(t * shape.length) % shape.length;
            effectiveWidth = body.radius * shape[idx];
          }

          if (Math.abs(localX) < effectiveWidth) {
            return true;
          }
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
    this.waterMeshes.forEach((water) => {
      this.scene.remove(water);
      water.geometry.dispose();
      (water.material as THREE.Material).dispose();
    });
    this.shorelineMeshes.forEach((mesh) => {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    });
    this.rockMeshes.forEach((mesh) => {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      // Material is shared, don't dispose
    });
    this.waterMeshes = [];
    this.shorelineMeshes = [];
    this.rockMeshes = [];
    this.waterBodies = [];
  }
}
