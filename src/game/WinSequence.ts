import * as THREE from 'three';
import { FogOfWar } from './FogOfWar';
import { AudioManager } from './AudioManager';
import { FireworksSystem } from './Fireworks';

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

  // Fireworks
  private fireworks: FireworksSystem;
  private lastFireworkLaunch = 0; // Track when we last launched fireworks
  private pendingSoundTimers: number[] = []; // Track setTimeout IDs for cleanup

  // Fragment beams
  private fragmentBeams: THREE.Mesh[] = [];
  private fragmentPositions: THREE.Vector3[] = [];

  // God rays overlay
  private godRaysOverlay: HTMLDivElement | null = null;

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

    this.fireworks = new FireworksSystem(scene);

    this.createFlashOverlay();
    this.createGodRaysOverlay();
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

  private createGodRaysOverlay(): void {
    this.godRaysOverlay = document.createElement('div');
    this.godRaysOverlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: radial-gradient(ellipse at 50% 30%, rgba(255, 200, 100, 0.3) 0%, transparent 60%);
      opacity: 0;
      pointer-events: none;
      z-index: 999;
      transition: opacity 0.5s ease-out;
    `;
    document.body.appendChild(this.godRaysOverlay);
  }

  setFragmentPositions(positions: THREE.Vector3[]): void {
    this.fragmentPositions = positions;
  }

  play(playerPos: THREE.Vector3, onComplete: () => void): void {
    this.isPlaying = true;
    this.sequenceTime = 0;
    this.playerPos.copy(playerPos);
    this.onComplete = onComplete;
    this.fogClearRadius = 0;
    this.lastFireworkLaunch = 0;

    // Clear any pending sound timers from previous sequence
    this.pendingSoundTimers.forEach(id => clearTimeout(id));
    this.pendingSoundTimers = [];

    // Store original values
    this.originalSkyColor.copy(this.scene.fog ? (this.scene.fog as THREE.FogExp2).color : new THREE.Color(0xd4d4d8));
    this.originalSunColor.copy(this.sunLight.color);
    this.originalSunIntensity = this.sunLight.intensity;
    this.originalAmbientIntensity = this.ambientLight.intensity;

    // Initial flash
    this.triggerFlash();

    // Play victory sound
    this.playVictorySound();

    // Create fragment beams
    this.createFragmentBeams();
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

  private createFragmentBeams(): void {
    // Clear existing beams
    this.fragmentBeams.forEach(beam => {
      this.scene.remove(beam);
      beam.geometry.dispose();
      (beam.material as THREE.Material).dispose();
    });
    this.fragmentBeams = [];

    // Create beams from player to each fragment position
    this.fragmentPositions.forEach((fragPos, i) => {
      const start = this.playerPos.clone();
      start.y = 3;
      const end = fragPos.clone();
      end.y = 3;

      const distance = start.distanceTo(end);
      const geometry = new THREE.CylinderGeometry(0.15, 0.15, distance, 8);

      // Different colors for each beam
      const colors = [0x00ffaa, 0xffaa00, 0xff00ff, 0x00aaff, 0xff4444, 0xffff00, 0x00ff00];
      const material = new THREE.MeshBasicMaterial({
        color: colors[i % colors.length],
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
      });

      const beam = new THREE.Mesh(geometry, material);

      // Position at midpoint
      beam.position.copy(start).lerp(end, 0.5);

      // Rotate to point toward fragment
      beam.lookAt(end);
      beam.rotateX(Math.PI / 2);

      this.fragmentBeams.push(beam);
      this.scene.add(beam);
    });
  }

  private playVictorySound(): void {
    const audioContext = (this.audioManager as any).audioContext as AudioContext;
    if (!audioContext) return;

    const now = audioContext.currentTime;

    // Triumphant chord: C major with octave
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

    // Firework sounds (delayed)
    const timerId = setTimeout(() => {
      this.playFireworkSound(audioContext);
    }, 2500);
    this.pendingSoundTimers.push(timerId);
  }

  private playFireworkSound(audioContext: AudioContext): void {
    // Just one subtle explosion per wave
    this.playFireworkExplosion(audioContext);
  }

  private playFireworkExplosion(audioContext: AudioContext): void {
    const now = audioContext.currentTime;
    const duration = 0.3; // Much shorter

    // Soft sparkle burst
    const buffer = audioContext.createBuffer(1, audioContext.sampleRate * duration, audioContext.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      // Quick exponential decay
      const env = Math.exp(-i / (audioContext.sampleRate * 0.06));
      // Softer, less dense sparkle
      const sparkle = Math.random() < 0.2 ? (Math.random() * 2 - 1) : 0;
      data[i] = sparkle * env * 0.3;
    }

    const source = audioContext.createBufferSource();
    source.buffer = buffer;

    // Gentle high-pass filter for pleasant sparkle
    const filter = audioContext.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 2500;
    filter.Q.value = 0.3;

    // Quiet, non-disturbing volume
    const gain = audioContext.createGain();
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(audioContext.destination);
    source.start(now);
  }

  update(delta: number): boolean {
    if (!this.isPlaying) return false;

    this.sequenceTime += delta;

    // Phase 1: Fragment beams appear (0.5-2.0s)
    if (this.sequenceTime > 0.5 && this.sequenceTime < 2.0) {
      const beamProgress = Math.min((this.sequenceTime - 0.5) / 1.0, 1);
      this.fragmentBeams.forEach((beam, i) => {
        const staggeredProgress = Math.max(0, Math.min(1, (beamProgress - i * 0.1) * 1.5));
        (beam.material as THREE.MeshBasicMaterial).opacity = staggeredProgress * 0.7;
      });
    }

    // Fade out beams (2.0-3.0s)
    if (this.sequenceTime > 2.0 && this.sequenceTime < 3.0) {
      const fadeProgress = (this.sequenceTime - 2.0) / 1.0;
      this.fragmentBeams.forEach(beam => {
        (beam.material as THREE.MeshBasicMaterial).opacity = 0.7 * (1 - fadeProgress);
      });
    }

    // Phase 2: Fog clear wave (0.3-3.5s)
    if (this.sequenceTime > 0.3 && this.sequenceTime < 3.5) {
      const fogProgress = Math.min((this.sequenceTime - 0.3) / 3.0, 1);
      const eased = fogProgress < 0.5
        ? 4 * fogProgress * fogProgress * fogProgress
        : 1 - Math.pow(-2 * fogProgress + 2, 3) / 2;

      this.fogClearRadius = eased * this.maxFogRadius;
      this.fogOfWar.clearAt(this.playerPos.x, this.playerPos.z, this.fogClearRadius);
    }

    // Phase 3: Sky transform + God rays (1.0-4.0s)
    if (this.sequenceTime > 1.0 && this.sequenceTime < 4.0) {
      const skyProgress = Math.min((this.sequenceTime - 1.0) / 3.0, 1);
      const targetSkyColor = new THREE.Color(0xffa563);
      const targetSunColor = new THREE.Color(0xffa500);

      const currentSkyColor = this.originalSkyColor.clone().lerp(targetSkyColor, skyProgress);
      this.renderer.setClearColor(currentSkyColor);
      if (this.scene.fog) {
        (this.scene.fog as THREE.FogExp2).color.copy(currentSkyColor);
      }

      this.sunLight.color.copy(this.originalSunColor.clone().lerp(targetSunColor, skyProgress));
      this.sunLight.intensity = this.originalSunIntensity + skyProgress * 0.4;
      this.ambientLight.intensity = this.originalAmbientIntensity + skyProgress * 0.3;

      // God rays fade in
      if (this.godRaysOverlay) {
        this.godRaysOverlay.style.opacity = String(skyProgress * 0.8);
      }
    }

    // Phase 4: Fireworks (2.5s onwards - launch waves every 1.2 seconds)
    if (this.sequenceTime > 2.5 && this.sequenceTime - this.lastFireworkLaunch > 1.2) {
      this.lastFireworkLaunch = this.sequenceTime;

      // Launch 3-4 fireworks per wave
      const launchPositions: THREE.Vector3[] = [];
      const count = 3 + Math.floor(Math.random() * 2);
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 60 + Math.random() * 60;
        launchPositions.push(new THREE.Vector3(
          Math.cos(angle) * dist,
          0,
          Math.sin(angle) * dist
        ));
      }
      this.fireworks.start(launchPositions);

      // Play firework sound for this wave (delayed to match explosion)
      const audioContext = (this.audioManager as any).audioContext as AudioContext;
      if (audioContext) {
        // Delay sound to match when fireworks explode (~1.6s after launch)
        const timerId = setTimeout(() => {
          this.playFireworkSound(audioContext);
        }, 1600);
        this.pendingSoundTimers.push(timerId);
      }
    }

    // Update fireworks
    this.fireworks.update(delta);

    // Phase 5: Camera drift up (2.0-5.0s)
    if (this.sequenceTime > 2.0 && this.sequenceTime < 5.0) {
      const camProgress = (this.sequenceTime - 2.0) / 3.0;
      this.camera.position.y += delta * 2 * (1 - camProgress);
    }

    // Show win screen at 6s, but keep sequence running for fireworks!
    if (this.sequenceTime >= 6.0 && this.onComplete) {
      this.onComplete(); // Show win screen
      this.onComplete = null; // Clear callback so it only fires once
      // Don't set isPlaying = false or call cleanup() - let fireworks continue!
    }

    return true; // Keep updating!
  }

  cleanup(): void {
    // Stop the sequence
    this.isPlaying = false;

    // Stop fireworks
    this.fireworks.stop();

    // Clear all pending sound timers
    this.pendingSoundTimers.forEach(id => clearTimeout(id));
    this.pendingSoundTimers = [];

    // Remove beams
    this.fragmentBeams.forEach(beam => {
      this.scene.remove(beam);
      beam.geometry.dispose();
      (beam.material as THREE.Material).dispose();
    });
    this.fragmentBeams = [];

    // Fade out god rays
    if (this.godRaysOverlay) {
      this.godRaysOverlay.style.opacity = '0';
    }
  }

  getIsPlaying(): boolean {
    return this.isPlaying;
  }

  dispose(): void {
    if (this.flashOverlay && this.flashOverlay.parentNode) {
      this.flashOverlay.parentNode.removeChild(this.flashOverlay);
    }
    if (this.godRaysOverlay && this.godRaysOverlay.parentNode) {
      this.godRaysOverlay.parentNode.removeChild(this.godRaysOverlay);
    }
    this.cleanup();
  }
}
