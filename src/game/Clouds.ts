import * as THREE from 'three';

interface Cloud {
  mesh: THREE.Mesh;
  speed: number;
  startX: number;
}

export class Clouds {
  private scene: THREE.Scene;
  private clouds: Cloud[] = [];
  private worldSize: number;
  private cloudHeight = 120;

  constructor(scene: THREE.Scene, worldSize: number) {
    this.scene = scene;
    this.worldSize = worldSize;
    this.createClouds();
  }

  private createClouds(): void {
    const cloudCount = 15;

    // Create cloud material - semi-transparent white
    const cloudMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.6,
      roughness: 1,
      metalness: 0,
      side: THREE.DoubleSide,
    });

    for (let i = 0; i < cloudCount; i++) {
      // Random cloud size
      const baseSize = 15 + Math.random() * 25;

      // Create 3-6 spheres for each cloud
      const sphereCount = 3 + Math.floor(Math.random() * 4);
      const geometries: THREE.SphereGeometry[] = [];

      for (let j = 0; j < sphereCount; j++) {
        const sphereSize = baseSize * (0.5 + Math.random() * 0.5);
        const geometry = new THREE.SphereGeometry(sphereSize, 8, 6);

        // Offset spheres to create cloud shape
        const offsetX = (Math.random() - 0.5) * baseSize * 1.5;
        const offsetY = (Math.random() - 0.5) * baseSize * 0.3;
        const offsetZ = (Math.random() - 0.5) * baseSize * 1.2;

        geometry.translate(offsetX, offsetY, offsetZ);
        geometries.push(geometry);
      }

      // Merge geometries for performance
      const mergedGeometry = this.mergeGeometries(geometries);
      const cloudMesh = new THREE.Mesh(mergedGeometry, cloudMaterial.clone());

      // Position cloud
      const x = (Math.random() - 0.5) * this.worldSize * 1.5;
      const z = (Math.random() - 0.5) * this.worldSize * 1.5;
      cloudMesh.position.set(x, this.cloudHeight + Math.random() * 30, z);

      // Random rotation
      cloudMesh.rotation.y = Math.random() * Math.PI * 2;

      // Scale variation
      const scale = 0.8 + Math.random() * 0.4;
      cloudMesh.scale.set(scale, scale * 0.6, scale);

      this.clouds.push({
        mesh: cloudMesh,
        speed: 2 + Math.random() * 3,
        startX: x,
      });

      this.scene.add(cloudMesh);
    }
  }

  private mergeGeometries(geometries: THREE.SphereGeometry[]): THREE.BufferGeometry {
    // Simple merge by combining all vertices
    const positions: number[] = [];
    const normals: number[] = [];
    const indices: number[] = [];
    let indexOffset = 0;

    geometries.forEach((geom) => {
      const pos = geom.attributes.position.array;
      const norm = geom.attributes.normal.array;
      const idx = geom.index?.array;

      for (let i = 0; i < pos.length; i++) {
        positions.push(pos[i]);
      }
      for (let i = 0; i < norm.length; i++) {
        normals.push(norm[i]);
      }
      if (idx) {
        for (let i = 0; i < idx.length; i++) {
          indices.push(idx[i] + indexOffset);
        }
      }
      indexOffset += pos.length / 3;
    });

    const merged = new THREE.BufferGeometry();
    merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    merged.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    merged.setIndex(indices);

    return merged;
  }

  update(delta: number): void {
    const boundX = this.worldSize;

    this.clouds.forEach((cloud) => {
      // Move cloud
      cloud.mesh.position.x += cloud.speed * delta;

      // Wrap around when cloud goes too far
      if (cloud.mesh.position.x > boundX) {
        cloud.mesh.position.x = -boundX;
      }

      // Gentle vertical bobbing
      cloud.mesh.position.y += Math.sin(Date.now() * 0.0005 + cloud.startX) * 0.01;
    });
  }

  setOpacity(opacity: number): void {
    this.clouds.forEach((cloud) => {
      (cloud.mesh.material as THREE.MeshStandardMaterial).opacity = opacity * 0.6;
    });
  }

  dispose(): void {
    this.clouds.forEach((cloud) => {
      this.scene.remove(cloud.mesh);
      cloud.mesh.geometry.dispose();
      (cloud.mesh.material as THREE.Material).dispose();
    });
    this.clouds = [];
  }
}
