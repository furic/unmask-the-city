import * as THREE from 'three';
import { FogOfWar } from './FogOfWar';

export class Minimap {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private fogOfWar: FogOfWar;
  private worldSize: number;
  private resolution: number;

  private readonly SIZE = 150;
  private readonly PLAYER_MARKER_SIZE = 6;
  private readonly FRAGMENT_MARKER_SIZE = 4;

  constructor(fogOfWar: FogOfWar, worldSize: number) {
    this.fogOfWar = fogOfWar;
    this.worldSize = worldSize;
    this.resolution = 512; // Match fog texture resolution

    // Create canvas element
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.SIZE;
    this.canvas.height = this.SIZE;
    this.canvas.id = 'minimap';
    this.canvas.style.cssText = `
      position: absolute;
      top: 20px;
      right: 20px;
      width: ${this.SIZE}px;
      height: ${this.SIZE}px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-radius: 8px;
      background: rgba(0, 0, 0, 0.6);
      pointer-events: none;
    `;

    this.ctx = this.canvas.getContext('2d')!;

    // Add to HUD
    const hud = document.getElementById('hud');
    if (hud) {
      hud.appendChild(this.canvas);
    }
  }

  update(
    playerPos: THREE.Vector3,
    playerRotation: number,
    collectibles: { getPosition: () => THREE.Vector3; isCollected: boolean }[]
  ): void {
    const ctx = this.ctx;
    const halfWorld = this.worldSize / 2;

    // Clear canvas
    ctx.clearRect(0, 0, this.SIZE, this.SIZE);

    // Draw fog of war (explored areas)
    const fogTexture = this.fogOfWar.getTexture();
    const fogData = fogTexture.image.data as Uint8Array;

    // Create image data for the minimap
    const imageData = ctx.createImageData(this.SIZE, this.SIZE);
    const data = imageData.data;

    // Scale factor from fog texture to minimap
    const scale = this.resolution / this.SIZE;

    for (let y = 0; y < this.SIZE; y++) {
      for (let x = 0; x < this.SIZE; x++) {
        // Sample fog texture (flip both X and Y to match world orientation)
        const fogX = Math.floor((this.SIZE - 1 - x) * scale); // Flip X
        const fogY = Math.floor((this.SIZE - 1 - y) * scale); // Flip Y
        const fogIndex = fogY * this.resolution + fogX;
        const fogValue = fogData[fogIndex];

        const pixelIndex = (y * this.SIZE + x) * 4;

        // Fog color (darker = explored)
        const explored = 1 - fogValue / 255;

        // Background (unexplored) is dark gray, explored is lighter
        const baseColor = 30; // Dark background
        const exploredColor = 80; // Lighter for explored areas
        const color = baseColor + explored * (exploredColor - baseColor);

        data[pixelIndex] = color;     // R
        data[pixelIndex + 1] = color; // G
        data[pixelIndex + 2] = color + explored * 20; // B (slight blue tint for explored)
        data[pixelIndex + 3] = 200;   // A
      }
    }

    ctx.putImageData(imageData, 0, 0);

    // Convert world position to minimap position
    const worldToMinimap = (worldX: number, worldZ: number): [number, number] => {
      const x = ((halfWorld - worldX) / this.worldSize) * this.SIZE; // Flip X for correct orientation
      const y = ((halfWorld - worldZ) / this.worldSize) * this.SIZE; // Flip Z
      return [x, y];
    };

    // Draw uncollected fragments
    ctx.fillStyle = '#00ffaa';
    collectibles.forEach((collectible) => {
      if (collectible.isCollected) return;
      const pos = collectible.getPosition();
      const [mx, my] = worldToMinimap(pos.x, pos.z);

      // Only draw if in explored area
      const fogX = Math.floor(((pos.x + halfWorld) / this.worldSize) * this.resolution);
      const fogZ = Math.floor(((pos.z + halfWorld) / this.worldSize) * this.resolution);
      const fogIndex = fogZ * this.resolution + fogX;
      if (fogIndex >= 0 && fogIndex < fogData.length && fogData[fogIndex] < 200) {
        ctx.beginPath();
        ctx.arc(mx, my, this.FRAGMENT_MARKER_SIZE, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // Draw player marker (triangle pointing in look direction)
    const [px, py] = worldToMinimap(playerPos.x, playerPos.z);

    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(-playerRotation); // Match player facing direction

    // Draw player arrow
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -this.PLAYER_MARKER_SIZE);
    ctx.lineTo(-this.PLAYER_MARKER_SIZE * 0.6, this.PLAYER_MARKER_SIZE * 0.6);
    ctx.lineTo(this.PLAYER_MARKER_SIZE * 0.6, this.PLAYER_MARKER_SIZE * 0.6);
    ctx.closePath();
    ctx.fill();

    ctx.restore();

    // Draw border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, this.SIZE, this.SIZE);
  }

  dispose(): void {
    this.canvas.remove();
  }
}
