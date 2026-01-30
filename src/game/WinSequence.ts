import * as THREE from 'three';
import { FogOfWar } from './FogOfWar';
import { AudioManager } from './AudioManager';

export class WinSequence {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private fogOfWar: FogOfWar;
  private audioManager: AudioManager;
  private sunLight: THREE.DirectionalLight;
  private ambientLight: THREE.AmbientLight;

  private isPlaying = false;
  private sequenceTime = 0;
  private playerPos = new THREE.Vector3();
  private onComplete: (() => void) | null = null;

  // Animation state
  private fogClearRadius = 0;
  private maxFogRadius = 0;
  private originalSkyColor: THREE.Color;
  private originalSunColor: THREE.Color;
  private originalSunIntensity: number;
  private originalAmbientIntensity: number;

  // Flash overlay
  private flashOverlay: HTMLDivElement | null = null;

  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    fogOfWar: FogOfWar,
    audioManager: AudioManager,
    sunLight: THREE.DirectionalLight,
    ambientLight: THREE.AmbientLight,
    worldSize: number
  ) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.fogOfWar = fogOfWar;
    this.audioManager = audioManager;
    this.sunLight = sunLight;
    this.ambientLight = ambientLight;

    this.maxFogRadius = Math.sqrt(worldSize * worldSize * 2);
    this.originalSkyColor = new THREE.Color(0xd4d4d8);
    this.originalSunColor = this.sunLight.color.clone();
    this.originalSunIntensity = this.sunLight.intensity;
    this.originalAmbientIntensity = this.ambientLight.intensity;

    this.createFlashOverlay();
  }

  private createFlashOverlay(): void {
    this.flashOverlay = document.createElement('div');
    this.flashOverlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: white;
      opacity: 0;
      pointer-events: none;
      z-index: 1000;
      transition: opacity 0.1s ease-out;
    `;
    document.body.appendChild(this.flashOverlay);
  }

  play(playerPos: THREE.Vector3, onComplete: () => void): void {
    this.isPlaying = true;
    this.sequenceTime = 0;
    this.playerPos.copy(playerPos);
    this.onComplete = onComplete;
    this.fogClearRadius = 0;

    // Store original values
    this.originalSkyColor.copy(this.scene.fog ? (this.scene.fog as THREE.FogExp2).color : new THREE.Color(0xd4d4d8));
    this.originalSunColor.copy(this.sunLight.color);
    this.originalSunIntensity = this.sunLight.intensity;
    this.originalAmbientIntensity = this.ambientLight.intensity;

    // Initial flash
    this.triggerFlash();

    // Play victory sound
    this.playVictorySound();
  }

  private triggerFlash(): void {
    if (this.flashOverlay) {
      this.flashOverlay.style.opacity = '0.8';
      setTimeout(() => {
        if (this.flashOverlay) {
          this.flashOverlay.style.opacity = '0';
        }
      }, 100);
    }
  }

  private playVictorySound(): void {
    // Play a triumphant chord using AudioManager's context
    const audioContext = (this.audioManager as any).audioContext as AudioContext;
    if (!audioContext) return;

    const now = audioContext.currentTime;

    // Triumphant chord: C major with octave (C4, E4, G4, C5)
    const frequencies = [261.63, 329.63, 392.00, 523.25, 659.25];

    frequencies.forEach((freq, i) => {
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();

      osc.type = 'sine';
      osc.frequency.value = freq;

      const startTime = now + i * 0.05;
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.15, startTime + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + 2.0);

      osc.connect(gain);
      gain.connect(audioContext.destination);

      osc.start(startTime);
      osc.stop(startTime + 2.5);
    });
  }

  update(delta: number): boolean {
    if (!this.isPlaying) return false;

    this.sequenceTime += delta;

    // Phase 1: Initial impact (0-0.5s) - handled by flash

    // Phase 2: Fog clear wave (0.5-3.5s)
    if (this.sequenceTime > 0.3 && this.sequenceTime < 3.5) {
      const fogProgress = Math.min((this.sequenceTime - 0.3) / 3.0, 1);
      // Ease-in-out cubic
      const eased = fogProgress < 0.5
        ? 4 * fogProgress * fogProgress * fogProgress
        : 1 - Math.pow(-2 * fogProgress + 2, 3) / 2;

      this.fogClearRadius = eased * this.maxFogRadius;
      this.fogOfWar.clearAt(this.playerPos.x, this.playerPos.z, this.fogClearRadius);
    }

    // Phase 3: Sky transform (1.0-4.0s)
    if (this.sequenceTime > 1.0 && this.sequenceTime < 4.0) {
      const skyProgress = Math.min((this.sequenceTime - 1.0) / 3.0, 1);
      const targetSkyColor = new THREE.Color(0xffa563); // Golden
      const targetSunColor = new THREE.Color(0xffa500); // Orange

      // Interpolate colors
      const currentSkyColor = this.originalSkyColor.clone().lerp(targetSkyColor, skyProgress);
      this.renderer.setClearColor(currentSkyColor);
      if (this.scene.fog) {
        (this.scene.fog as THREE.FogExp2).color.copy(currentSkyColor);
      }

      // Animate sun
      this.sunLight.color.copy(this.originalSunColor.clone().lerp(targetSunColor, skyProgress));
      this.sunLight.intensity = this.originalSunIntensity + skyProgress * 0.4;
      this.ambientLight.intensity = this.originalAmbientIntensity + skyProgress * 0.3;
    }

    // Phase 4: Camera drift up slightly (2.0-5.0s)
    if (this.sequenceTime > 2.0 && this.sequenceTime < 5.0) {
      const camProgress = (this.sequenceTime - 2.0) / 3.0;
      this.camera.position.y += delta * 2 * (1 - camProgress); // Slow drift up
    }

    // Sequence complete
    if (this.sequenceTime >= 5.5) {
      this.isPlaying = false;
      if (this.onComplete) {
        this.onComplete();
      }
      return false;
    }

    return true;
  }

  getIsPlaying(): boolean {
    return this.isPlaying;
  }

  dispose(): void {
    if (this.flashOverlay && this.flashOverlay.parentNode) {
      this.flashOverlay.parentNode.removeChild(this.flashOverlay);
    }
  }
}
