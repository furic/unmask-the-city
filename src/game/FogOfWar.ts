import * as THREE from 'three';

export class FogOfWar {
  private resolution: number;
  private worldSize: number;
  private data: Uint8Array;
  private corruptionData: Uint8Array;
  private texture: THREE.DataTexture;
  private corruptionTexture: THREE.DataTexture;
  private pixelsCleared = 0;
  private totalPixels: number;
  private corruptionTimer = 0;
  private readonly CORRUPTION_INTERVAL = 2; // Spread corruption every 2 seconds
  private readonly CORRUPTION_RATE = 15; // Amount to increase corruption per tick

  constructor(resolution: number, worldSize: number) {
    this.resolution = resolution;
    this.worldSize = worldSize;
    this.totalPixels = resolution * resolution;

    // Create fog data (255 = fully fogged, 0 = clear)
    this.data = new Uint8Array(this.totalPixels);
    this.data.fill(255);

    // Create corruption data (0 = safe, 255 = fully corrupted)
    this.corruptionData = new Uint8Array(this.totalPixels);
    this.corruptionData.fill(0);

    // Create fog texture
    this.texture = new THREE.DataTexture(
      this.data as unknown as BufferSource,
      resolution,
      resolution,
      THREE.RedFormat,
      THREE.UnsignedByteType
    );
    this.texture.wrapS = THREE.ClampToEdgeWrapping;
    this.texture.wrapT = THREE.ClampToEdgeWrapping;
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.needsUpdate = true;

    // Create corruption texture
    this.corruptionTexture = new THREE.DataTexture(
      this.corruptionData as unknown as BufferSource,
      resolution,
      resolution,
      THREE.RedFormat,
      THREE.UnsignedByteType
    );
    this.corruptionTexture.wrapS = THREE.ClampToEdgeWrapping;
    this.corruptionTexture.wrapT = THREE.ClampToEdgeWrapping;
    this.corruptionTexture.magFilter = THREE.LinearFilter;
    this.corruptionTexture.minFilter = THREE.LinearFilter;
    this.corruptionTexture.needsUpdate = true;
  }

  /**
   * Clear fog at a world position with given radius
   */
  clearAt(worldX: number, worldZ: number, radius: number): void {
    // Convert world position to texture coordinates
    const halfWorld = this.worldSize / 2;
    const texX = ((worldX + halfWorld) / this.worldSize) * this.resolution;
    const texZ = ((worldZ + halfWorld) / this.worldSize) * this.resolution;
    const texRadius = (radius / this.worldSize) * this.resolution;

    // Paint circle on texture
    const minX = Math.max(0, Math.floor(texX - texRadius));
    const maxX = Math.min(this.resolution - 1, Math.ceil(texX + texRadius));
    const minZ = Math.max(0, Math.floor(texZ - texRadius));
    const maxZ = Math.min(this.resolution - 1, Math.ceil(texZ + texRadius));

    for (let z = minZ; z <= maxZ; z++) {
      for (let x = minX; x <= maxX; x++) {
        const dx = x - texX;
        const dz = z - texZ;
        const dist = Math.sqrt(dx * dx + dz * dz);

        if (dist <= texRadius) {
          const index = z * this.resolution + x;
          const oldValue = this.data[index];

          // Smooth falloff at edges
          const falloff = 1 - Math.pow(dist / texRadius, 2);
          const clearAmount = Math.floor(falloff * 255);
          const newValue = Math.max(0, oldValue - clearAmount);

          if (newValue < oldValue) {
            // Track cleared pixels for exploration %
            if (oldValue > 128 && newValue <= 128) {
              this.pixelsCleared++;
            }
            this.data[index] = newValue;
          }
        }
      }
    }

    this.texture.needsUpdate = true;
  }

  /**
   * Get fog texture for shader
   */
  getTexture(): THREE.DataTexture {
    return this.texture;
  }

  /**
   * Get percentage of map explored
   */
  getExploredPercent(): number {
    let cleared = 0;
    for (let i = 0; i < this.totalPixels; i++) {
      if (this.data[i] < 128) cleared++;
    }
    return (cleared / this.totalPixels) * 100;
  }

  /**
   * Reset fog to fully covered
   */
  reset(): void {
    this.data.fill(255);
    this.corruptionData.fill(0);
    this.pixelsCleared = 0;
    this.corruptionTimer = 0;
    this.texture.needsUpdate = true;
    this.corruptionTexture.needsUpdate = true;
  }

  /**
   * Check if a position is explored
   */
  isExplored(worldX: number, worldZ: number): boolean {
    const halfWorld = this.worldSize / 2;
    const texX = Math.floor(((worldX + halfWorld) / this.worldSize) * this.resolution);
    const texZ = Math.floor(((worldZ + halfWorld) / this.worldSize) * this.resolution);

    if (texX < 0 || texX >= this.resolution || texZ < 0 || texZ >= this.resolution) {
      return false;
    }

    const index = texZ * this.resolution + texX;
    return this.data[index] < 128;
  }

  /**
   * Update corruption spread over time
   */
  updateCorruption(delta: number): void {
    this.corruptionTimer += delta;

    if (this.corruptionTimer >= this.CORRUPTION_INTERVAL) {
      this.corruptionTimer = 0;
      this.spreadCorruption();
    }
  }

  /**
   * Spread corruption in unexplored areas
   */
  private spreadCorruption(): void {
    // Start corruption from edges and spread inward in unexplored areas
    for (let z = 0; z < this.resolution; z++) {
      for (let x = 0; x < this.resolution; x++) {
        const index = z * this.resolution + x;

        // Only corrupt unexplored areas (fog value > 128)
        if (this.data[index] > 128) {
          // Check if near edge or near already corrupted area
          const isEdge = x < 5 || x > this.resolution - 5 || z < 5 || z > this.resolution - 5;
          const hasCorruptedNeighbor = this.hasCorruptedNeighbor(x, z);

          if (isEdge || hasCorruptedNeighbor) {
            this.corruptionData[index] = Math.min(255, this.corruptionData[index] + this.CORRUPTION_RATE);
          }
        } else {
          // Explored areas lose corruption
          this.corruptionData[index] = Math.max(0, this.corruptionData[index] - 30);
        }
      }
    }

    this.corruptionTexture.needsUpdate = true;
  }

  /**
   * Check if any neighbor is corrupted
   */
  private hasCorruptedNeighbor(x: number, z: number): boolean {
    const offsets = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (const [dx, dz] of offsets) {
      const nx = x + dx;
      const nz = z + dz;
      if (nx >= 0 && nx < this.resolution && nz >= 0 && nz < this.resolution) {
        const nIndex = nz * this.resolution + nx;
        if (this.corruptionData[nIndex] > 100) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Get corruption texture for shader
   */
  getCorruptionTexture(): THREE.DataTexture {
    return this.corruptionTexture;
  }

  /**
   * Get corruption level at world position (0-1)
   */
  getCorruptionAt(worldX: number, worldZ: number): number {
    const halfWorld = this.worldSize / 2;
    const texX = Math.floor(((worldX + halfWorld) / this.worldSize) * this.resolution);
    const texZ = Math.floor(((worldZ + halfWorld) / this.worldSize) * this.resolution);

    if (texX < 0 || texX >= this.resolution || texZ < 0 || texZ >= this.resolution) {
      return 0;
    }

    const index = texZ * this.resolution + texX;
    return this.corruptionData[index] / 255;
  }
}
