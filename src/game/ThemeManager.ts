import * as THREE from 'three';

export interface Theme {
  name: string;
  skyColor: number;
  fogColor: number;
  fogDensity: number;
  ambientIntensity: number;
  sunColor: number;
  sunIntensity: number;
  groundColor: number;
  collectibleColor: number;
  collectibleEmissive: number;
}

export const THEMES: Record<string, Theme> = {
  day: {
    name: 'Day',
    skyColor: 0xd4d4d8,
    fogColor: 0xd4d4d8,
    fogDensity: 0.008,
    ambientIntensity: 0.6,
    sunColor: 0xffffff,
    sunIntensity: 0.8,
    groundColor: 0x2a2a2a,
    collectibleColor: 0x00ffaa,
    collectibleEmissive: 0x00ff88,
  },
  dusk: {
    name: 'Dusk',
    skyColor: 0x4a3b5c,
    fogColor: 0x5c4a6e,
    fogDensity: 0.01,
    ambientIntensity: 0.4,
    sunColor: 0xff9966,
    sunIntensity: 0.6,
    groundColor: 0x1a1a2a,
    collectibleColor: 0xff6600,
    collectibleEmissive: 0xff4400,
  },
  night: {
    name: 'Night',
    skyColor: 0x0a0a1a,
    fogColor: 0x101020,
    fogDensity: 0.015,
    ambientIntensity: 0.2,
    sunColor: 0x6688ff,
    sunIntensity: 0.3,
    groundColor: 0x0a0a0f,
    collectibleColor: 0x00aaff,
    collectibleEmissive: 0x0088ff,
  },
  neon: {
    name: 'Neon',
    skyColor: 0x0f0020,
    fogColor: 0x1a0030,
    fogDensity: 0.012,
    ambientIntensity: 0.3,
    sunColor: 0xff00ff,
    sunIntensity: 0.5,
    groundColor: 0x0a000f,
    collectibleColor: 0xff00ff,
    collectibleEmissive: 0xff00aa,
  },
};

export class ThemeManager {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private ambientLight: THREE.AmbientLight | null = null;
  private sunLight: THREE.DirectionalLight | null = null;
  private ground: THREE.Mesh | null = null;
  private currentTheme: Theme;
  private transitionProgress = 1;
  private targetTheme: Theme | null = null;
  private transitionDuration = 4.0; // 4 seconds for smooth cross-fade

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene) {
    this.renderer = renderer;
    this.scene = scene;
    this.currentTheme = THEMES.day;
  }

  setLights(ambient: THREE.AmbientLight, sun: THREE.DirectionalLight): void {
    this.ambientLight = ambient;
    this.sunLight = sun;
  }

  setGround(ground: THREE.Mesh): void {
    this.ground = ground;
  }

  getCurrentTheme(): Theme {
    return this.currentTheme;
  }

  setTheme(themeName: string, instant = false): void {
    const theme = THEMES[themeName];
    if (!theme) return;

    if (instant) {
      this.currentTheme = theme;
      this.applyTheme(theme);
      this.transitionProgress = 1;
      this.targetTheme = null;
    } else {
      this.targetTheme = theme;
      this.transitionProgress = 0;
    }
  }

  private applyTheme(theme: Theme): void {
    // Renderer
    this.renderer.setClearColor(theme.skyColor);

    // Scene fog
    if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.color.setHex(theme.fogColor);
      this.scene.fog.density = theme.fogDensity;
    }

    // Lights
    if (this.ambientLight) {
      this.ambientLight.intensity = theme.ambientIntensity;
    }
    if (this.sunLight) {
      this.sunLight.color.setHex(theme.sunColor);
      this.sunLight.intensity = theme.sunIntensity;
    }

    // Ground
    if (this.ground && this.ground.material instanceof THREE.MeshStandardMaterial) {
      this.ground.material.color.setHex(theme.groundColor);
    }
  }

  private lerpColor(a: number, b: number, t: number): number {
    const colorA = new THREE.Color(a);
    const colorB = new THREE.Color(b);
    colorA.lerp(colorB, t);
    return colorA.getHex();
  }

  private lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }

  private easeInOutCubic(t: number): number {
    return t < 0.5
      ? 4 * t * t * t
      : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  update(delta: number): void {
    if (!this.targetTheme || this.transitionProgress >= 1) return;

    this.transitionProgress = Math.min(1, this.transitionProgress + delta / this.transitionDuration);
    const t = this.easeInOutCubic(this.transitionProgress);

    // Interpolate all theme values
    const from = this.currentTheme;
    const to = this.targetTheme;

    // Renderer
    this.renderer.setClearColor(this.lerpColor(from.skyColor, to.skyColor, t));

    // Scene fog
    if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.color.setHex(this.lerpColor(from.fogColor, to.fogColor, t));
      this.scene.fog.density = this.lerp(from.fogDensity, to.fogDensity, t);
    }

    // Lights
    if (this.ambientLight) {
      this.ambientLight.intensity = this.lerp(from.ambientIntensity, to.ambientIntensity, t);
    }
    if (this.sunLight) {
      this.sunLight.color.setHex(this.lerpColor(from.sunColor, to.sunColor, t));
      this.sunLight.intensity = this.lerp(from.sunIntensity, to.sunIntensity, t);
    }

    // Ground
    if (this.ground && this.ground.material instanceof THREE.MeshStandardMaterial) {
      this.ground.material.color.setHex(this.lerpColor(from.groundColor, to.groundColor, t));
    }

    // Complete transition
    if (this.transitionProgress >= 1) {
      this.currentTheme = this.targetTheme;
      this.targetTheme = null;
    }
  }
}
