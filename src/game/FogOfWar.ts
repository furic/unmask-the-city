import * as THREE from 'three';

export class FogOfWar {
  private resolution: number;
  private worldSize: number;
  private data: Uint8Array;
  private texture: THREE.DataTexture;
  private pixelsCleared = 0;
  private totalPixels: number;

  constructor(resolution: number, worldSize: number) {
    this.resolution = resolution;
    this.worldSize = worldSize;
    this.totalPixels = resolution * resolution;

    // Create fog data (255 = fully fogged, 0 = clear)
    this.data = new Uint8Array(this.totalPixels);
    this.data.fill(255);

    // Create texture
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
    this.pixelsCleared = 0;
    this.texture.needsUpdate = true;
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
}
