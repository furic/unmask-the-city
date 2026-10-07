import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { City } from './City';
import { FogOfWar } from './FogOfWar';
import { Player } from './Player';
import { Collectible, FragmentType } from './Collectible';
import { Minimap } from './Minimap';
import { FogParticles } from './FogParticles';
import { ThemeManager, THEMES } from './ThemeManager';
import { AudioManager } from './AudioManager';
import { HighScoreManager } from './HighScoreManager';
import { GlobalLeaderboardManager } from './GlobalLeaderboardManager';
import { Rain } from './Rain';
import { Water } from './Water';
// import { Guard } from './Guard'; // DISABLED
import { WinSequence } from './WinSequence';
import { Clouds } from './Clouds';
import { Birds } from './Birds';
import { LeafParticles } from './LeafParticles';
import { Moon } from './Moon';
import { EmberParticles } from './EmberParticles';
import { SteamVents } from './SteamVents';
import { BreadcrumbTrail } from './BreadcrumbTrail';

// Difficulty settings interface
export interface DifficultySettings {
  citySize: number;
  fragmentCount: number;
  buildingDensity: number;
  fogClearRadius: number;
}

// Vignette shader
const VignetteShader = {
  uniforms: {
    tDiffuse: { value: null },
    offset: { value: 1.0 },
    darkness: { value: 1.0 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float offset;
    uniform float darkness;
    varying vec2 vUv;
    void main() {
      vec4 texel = texture2D(tDiffuse, vUv);
      vec2 uv = (vUv - vec2(0.5)) * vec2(offset);
      float vignette = 1.0 - dot(uv, uv);
      vignette = clamp(pow(vignette, darkness), 0.0, 1.0);
      gl_FragColor = vec4(texel.rgb * vignette, texel.a);
    }
  `,
};

export class Game {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: PointerLockControls;
  private clock: THREE.Clock;
  private composer!: EffectComposer;
  private bloomPass!: UnrealBloomPass;

  private city: City;
  private fogOfWar: FogOfWar;
  private player: Player;
  private collectibles: Collectible[] = [];
  private minimap: Minimap;
  private fogParticles: FogParticles;
  private themeManager!: ThemeManager;
  private ambientLight!: THREE.AmbientLight;
  private sunLight!: THREE.DirectionalLight;
  private torchLight!: THREE.SpotLight;
  private ground!: THREE.Mesh;
  private themeNames = Object.keys(THEMES);
  private currentThemeIndex = 0;
  private audioManager: AudioManager;

  private isRunning = false;
  private gameTime = 0;
  private fragmentsCollected = 0;
  private totalPoints = 0;
  private totalFragments: number;

  // Speed bonus tracking
  private lastFragmentTime = 0;
  private speedBonusCount = 0;
  private readonly SPEED_BONUS_WINDOW = 15; // seconds
  private readonly SPEED_BONUS_POINTS = 500;

  // Slow-motion effect
  private timeScale = 1.0;
  private slowMotionTimer = 0;
  private readonly SLOW_MOTION_DURATION = 0.2;
  private readonly SLOW_MOTION_SCALE = 0.3;

  // No-pause bonus tracking
  private hasPaused = false;

  // Screen shake
  private shakeIntensity = 0;
  private shakeDuration = 0;

  // Weather
  private rain: Rain;
  private weatherTimer = 0;
  private isRaining = false;
  private lightningTimer = 0;
  private lightningFlash = 0;

  // Water
  private water: Water;
  // private guards: Guard; // DISABLED

  // Atmosphere
  private clouds: Clouds;
  private birds: Birds;
  private leafParticles: LeafParticles;
  private moon: Moon;
  private emberParticles: EmberParticles;
  private steamVents: SteamVents;
  private breadcrumbTrail: BreadcrumbTrail;

  // Win sequence
  private winSequence!: WinSequence;
  private winSequenceTriggered = false;

  // Preview mode (for start screen)
  private previewMode = false;
  private previewTime = 0;
  private previewCameraAngle = 0;
  private previewCameraHeight = 80; // Higher to avoid tall buildings
  private previewCameraRadius = 150; // Further out to avoid building clipping

  // Settings
  private settings: DifficultySettings;
  private difficulty: string;

  constructor(container: HTMLElement, settings?: DifficultySettings, difficulty: string = 'normal') {
    // Use provided settings or defaults
    this.settings = settings || {
      citySize: 400,
      fragmentCount: 7,
      buildingDensity: 0.7,
      fogClearRadius: 25,
    };
    this.difficulty = difficulty;
    this.totalFragments = this.settings.fragmentCount;
    this.clock = new THREE.Clock();

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0xd4d4d8); // Light gray sky
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    // Scene
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0xd4d4d8, 0.008);

    // Camera
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.camera.position.set(0, 5, 0);

    // Controls
    this.controls = new PointerLockControls(this.camera, document.body);
    this.scene.add(this.controls.object);

    // Player
    this.player = new Player(this.controls);

    // Fog of War
    this.fogOfWar = new FogOfWar(512, this.settings.citySize);

    // Minimap
    this.minimap = new Minimap(this.fogOfWar, this.settings.citySize);

    // Create sunLight early (needed by Water for reflections)
    this.sunLight = new THREE.DirectionalLight(0xffffff, 0.8);
    this.sunLight.position.set(100, 200, 50);

    // Water system (create BEFORE city so buildings can avoid water)
    this.water = new Water(this.scene, this.settings.citySize, this.sunLight);

    // City (pass water so it can avoid placing buildings in water)
    this.city = new City(this.scene, this.settings.citySize, this.fogOfWar, this.settings.buildingDensity, this.water);

    // Fog Particles (reduced count for performance)
    this.fogParticles = new FogParticles(this.scene, this.settings.citySize, 200);

    // Rain
    this.rain = new Rain(this.scene, this.settings.citySize, 2000);

    // Clouds and birds
    this.clouds = new Clouds(this.scene, this.settings.citySize);
    this.birds = new Birds(this.scene, this.settings.citySize);

    // Leaf particles in parks
    this.leafParticles = new LeafParticles(this.scene, this.city.getParkCenters(), 40, 150);

    // Moon for night theme
    this.moon = new Moon(this.scene);

    // Ember particles in corrupted fog areas
    this.emberParticles = new EmberParticles(this.scene, this.fogOfWar, this.settings.citySize, 100);

    // Steam vents on buildings
    this.steamVents = new SteamVents(this.scene);
    this.placeRandomSteamVents();

    // Breadcrumb trail showing player's path
    this.breadcrumbTrail = new BreadcrumbTrail(this.scene);

    // Guards (DISABLED - removed due to bugs)
    // const guardCount = this.difficulty === 'easy' ? 3 : this.difficulty === 'hard' ? 7 : 5;
    // this.guards = new Guard(this.scene, this.settings.citySize, guardCount);

    // Audio
    this.audioManager = new AudioManager();

    // Setup
    this.setupLighting();
    this.setupGround();
    this.spawnCollectibles();
    this.setupPostProcessing();
    this.setupEventListeners();

    // Win sequence (after lighting is set up)
    this.winSequence = new WinSequence(
      this.renderer,
      this.scene,
      this.camera,
      this.fogOfWar,
      this.audioManager,
      this.sunLight,
      this.ambientLight,
      this.settings.citySize
    );

    // Initial render
    this.composer.render();
  }

  private setupPostProcessing(): void {
    // Create effect composer
    this.composer = new EffectComposer(this.renderer);

    // Render pass
    const renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(renderPass);

    // Bloom pass for glowing collectibles
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.3,  // strength
      0.4,  // radius
      0.85  // threshold
    );
    this.composer.addPass(this.bloomPass);

    // Vignette pass
    const vignettePass = new ShaderPass(VignetteShader);
    vignettePass.uniforms.offset.value = 0.95;
    vignettePass.uniforms.darkness.value = 1.2;
    this.composer.addPass(vignettePass);
  }

  private setupLighting(): void {
    // Ambient light
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(this.ambientLight);

    // Directional light (sun) - already created in constructor for Water
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 10;
    this.sunLight.shadow.camera.far = 500;
    this.sunLight.shadow.camera.left = -200;
    this.sunLight.shadow.camera.right = 200;
    this.sunLight.shadow.camera.top = 200;
    this.sunLight.shadow.camera.bottom = -200;
    this.scene.add(this.sunLight);

    // Hemisphere light for better ambient
    const hemi = new THREE.HemisphereLight(0x87ceeb, 0x3a3a3a, 0.4);
    this.scene.add(hemi);

    // Torch light (for night theme)
    this.torchLight = new THREE.SpotLight(0xffffee, 1.5, 50, Math.PI / 6, 0.3, 1);
    this.torchLight.position.set(0, 0, 0);
    this.torchLight.castShadow = false; // Disable shadows for performance
    this.camera.add(this.torchLight);
    this.camera.add(this.torchLight.target);
    this.torchLight.target.position.set(0, 0, -10); // Point forward
    this.torchLight.visible = false; // Start disabled

    // Initialize theme manager
    this.themeManager = new ThemeManager(this.renderer, this.scene);
    this.themeManager.setLights(this.ambientLight, this.sunLight);
  }

  private setupGround(): void {
    const groundGeo = new THREE.PlaneGeometry(this.settings.citySize * 2, this.settings.citySize * 2);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x2a2a2a,
      roughness: 0.9,
      metalness: 0.1,
    });
    this.ground = new THREE.Mesh(groundGeo, groundMat);
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.position.y = 0;
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);

    // Pass ground to theme manager
    this.themeManager.setGround(this.ground);
  }

  private spawnCollectibles(): void {
    // Clear existing
    this.collectibles.forEach(c => c.remove(this.scene));
    this.collectibles = [];

    const MIN_DISTANCE = 40; // Minimum distance between collectibles
    const parkPositions = this.city.getParkCenters();

    // Spawn new collectibles (all at ground level - no rooftop spawning)
    for (let i = 0; i < this.totalFragments; i++) {
      let position: THREE.Vector3;
      let attempts = 0;
      const maxAttempts = 200; // Increased for better validation

      // No rooftop placement - all fragments at ground level
      const useRooftop = false;

      // 60% chance to spawn in/near a park (except first fragment and rooftop)
      const preferPark = i > 0 && !useRooftop && Math.random() < 0.6 && parkPositions.length > 0;

      // Find valid position (all ground level)
      {
        do {
          // First collectible spawns near origin
          if (i === 0) {
            position = new THREE.Vector3(
              (Math.random() - 0.5) * 30,
              2,
              (Math.random() - 0.5) * 30
            );
          } else if (preferPark) {
            // Spawn in or near a park
            const randomPark = parkPositions[Math.floor(Math.random() * parkPositions.length)];
            const angle = Math.random() * Math.PI * 2;
            const dist = Math.random() * 35; // Within park radius + some margin
            position = new THREE.Vector3(
              randomPark.x + Math.cos(angle) * dist,
              2,
              randomPark.y + Math.sin(angle) * dist
            );
          } else {
            // Random position across city
            position = new THREE.Vector3(
              (Math.random() - 0.5) * this.settings.citySize * 0.8,
              2,
              (Math.random() - 0.5) * this.settings.citySize * 0.8
            );
          }
          attempts++;
        } while (
          (this.city.isInsideBuilding(position, 30) || this.isTooCloseToOthers(position, MIN_DISTANCE)) &&
          attempts < maxAttempts
        );

        // If we couldn't find a valid position, fall back to parks (always safe)
        if (attempts >= maxAttempts) {
          if (parkPositions.length > 0) {
            const randomPark = parkPositions[Math.floor(Math.random() * parkPositions.length)];
            position = new THREE.Vector3(
              randomPark.x + (Math.random() - 0.5) * 20,
              2,
              randomPark.y + (Math.random() - 0.5) * 20
            );
          }
        }
      }

      // Determine fragment type: 70% common, 20% rare, 10% hidden
      // Rooftop fragments are more likely to be rare
      let fragmentType: FragmentType = 'common';
      if (i > 0) {
        const roll = Math.random();
        if (useRooftop) {
          // Rooftop: 40% rare, 20% hidden, 40% common
          if (roll < 0.2) {
            fragmentType = 'hidden';
          } else if (roll < 0.6) {
            fragmentType = 'rare';
          }
        } else {
          if (roll < 0.1) {
            fragmentType = 'hidden';
          } else if (roll < 0.3) {
            fragmentType = 'rare';
          }
        }
      }

      const collectible = new Collectible(position, fragmentType);
      collectible.addToScene(this.scene);
      this.collectibles.push(collectible);
    }
  }

  private isTooCloseToOthers(position: THREE.Vector3, minDistance: number): boolean {
    for (const collectible of this.collectibles) {
      const existingPos = collectible.getPosition();
      const distance = new THREE.Vector2(
        position.x - existingPos.x,
        position.z - existingPos.z
      ).length();

      if (distance < minDistance) {
        return true;
      }
    }
    return false;
  }

  private setupEventListeners(): void {
    // Resize
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.composer.setSize(window.innerWidth, window.innerHeight);
      this.bloomPass.resolution.set(window.innerWidth, window.innerHeight);
    });

    // Pointer lock change
    document.addEventListener('pointerlockchange', () => {
      const pauseMenu = document.getElementById('pause-menu');
      if (!document.pointerLockElement && this.isRunning) {
        // Show pause menu when pointer lock is lost
        if (pauseMenu) {
          pauseMenu.style.display = 'flex';
        }
        // Track that the player has paused (for no-pause bonus)
        if (!this.winSequence.getIsPlaying()) {
          this.hasPaused = true;
        }
      } else {
        // Hide pause menu when pointer lock is acquired
        if (pauseMenu) {
          pauseMenu.style.display = 'none';
        }
      }
    });

    // Re-lock pointer on click when game is running
    document.addEventListener('click', () => {
      if (this.isRunning && !document.pointerLockElement) {
        this.controls.lock();
      }
    });

    // Mute with M key
    document.addEventListener('keydown', (e) => {
      if (e.code === 'KeyM' && this.isRunning) {
        const isMuted = this.audioManager.toggleMute();
        console.log(`Audio: ${isMuted ? 'Muted' : 'Unmuted'}`);
      }
      if (e.code === 'KeyP') {
        // Capture screenshot (works anytime)
        this.captureScreenshot();
      }
    });
  }

  private captureScreenshot(): void {
    // Render current frame to canvas
    this.composer.render();

    // Get canvas data as image
    this.renderer.domElement.toBlob((blob) => {
      if (!blob) return;

      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      link.download = `unmask-the-city-${timestamp}.png`;
      link.href = url;
      link.click();

      // Cleanup
      URL.revokeObjectURL(url);
      console.log('📸 Screenshot saved!');
    });
  }

  start(): void {
    this.isRunning = true;
    this.gameTime = 0;
    this.fragmentsCollected = 0;
    this.clock.start();
    this.controls.lock();

    // Initialize audio (must be after user interaction)
    this.audioManager.init();

    // Trigger fade-in from black
    this.triggerFadeIn();

    this.animate();
  }

  private triggerFadeIn(): void {
    const fadeOverlay = document.getElementById('fade-overlay');
    if (!fadeOverlay) return;

    // Reset to visible black
    fadeOverlay.classList.remove('hidden', 'fade-out');

    // Force a reflow to ensure the initial state is applied
    void fadeOverlay.offsetWidth;

    // Start fade out transition
    fadeOverlay.classList.add('fade-out');

    // Hide completely after transition ends
    setTimeout(() => {
      fadeOverlay.classList.add('hidden');
    }, 1500); // Match the CSS transition duration
  }

  restart(): void {
    // Unlock pointer so user can navigate UI
    this.controls.unlock();

    // Reset game state
    this.gameTime = 0;
    this.fragmentsCollected = 0;
    this.totalPoints = 0;
    this.winSequenceTriggered = false;
    this.lastFragmentTime = 0;
    this.speedBonusCount = 0;
    this.slowMotionTimer = 0;
    this.timeScale = 1.0;
    this.hasPaused = false;
    this.breadcrumbTrail.reset();

    // Reset world
    this.fogOfWar.reset();
    this.city.regenerate();
    this.spawnCollectibles();

    // Reset player
    this.player.reset();
    this.camera.position.set(0, 5, 0);
    this.camera.rotation.set(0, 0, 0);

    // Reset theme to default (day)
    this.currentThemeIndex = 0;
    this.themeManager.setTheme(this.themeNames[0]);

    // Clean up win sequence effects (fireworks, beams, sky changes)
    if (this.winSequence) {
      this.winSequence.cleanup();
    }

    // Reset weather
    this.isRaining = false;
    this.weatherTimer = 0;

    // Reset audio proximity to stop any proximity pings
    this.audioManager.setFragmentProximity(Infinity);

    this.updateUI();
    this.start();
  }

  startPreview(): void {
    this.previewMode = true;
    this.previewTime = 0;
    this.previewCameraAngle = 0;
    this.isRunning = true;

    // Unlock pointer for UI interaction
    this.controls.unlock();

    // Clear fog entirely for preview to show building colors
    this.fogOfWar.clearAll();

    // Position camera at starting preview location
    this.camera.position.set(
      Math.cos(this.previewCameraAngle) * this.previewCameraRadius,
      this.previewCameraHeight,
      Math.sin(this.previewCameraAngle) * this.previewCameraRadius
    );
    this.camera.lookAt(0, 0, 0);

    requestAnimationFrame(this.animate);
  }

  stopPreview(): void {
    this.previewMode = false;
    this.previewTime = 0;
    // Stop the animation loop so a new game can take over
    this.isRunning = false;
  }

  private updatePreview(delta: number): void {
    this.previewTime += delta;

    // Slow orbit around the city center
    this.previewCameraAngle += delta * 0.1; // Rotation speed

    // Gentle up-down movement
    const heightOffset = Math.sin(this.previewTime * 0.3) * 8;

    // Update camera position
    this.camera.position.set(
      Math.cos(this.previewCameraAngle) * this.previewCameraRadius,
      this.previewCameraHeight + heightOffset,
      Math.sin(this.previewCameraAngle) * this.previewCameraRadius
    );

    // Always look at city center, aiming slightly above ground
    const lookTarget = new THREE.Vector3(0, 30, 0);
    this.camera.lookAt(lookTarget);

    // Update city fog shader uniforms with night mode for dramatic preview
    this.city.updateFogUniforms(this.camera.position, 1.0);

    // Update fog particles for atmospheric effect
    this.fogParticles.update(delta, this.camera.position);

    // Update water
    this.water.update(delta);
  }

  private animate = (): void => {
    if (!this.isRunning) return;

    requestAnimationFrame(this.animate);

    const rawDelta = this.clock.getDelta();
    let delta = rawDelta;

    // Handle preview mode separately
    if (this.previewMode) {
      this.updatePreview(delta);
      this.composer.render();
      return;
    }

    // Apply slow motion during win sequence
    if (this.winSequence.getIsPlaying()) {
      delta *= this.winSequence.getTimeScale();
    }

    // Apply collection slow-motion effect
    if (this.slowMotionTimer > 0) {
      this.slowMotionTimer -= rawDelta; // Use raw delta so timer runs at real speed
      const progress = 1 - (this.slowMotionTimer / this.SLOW_MOTION_DURATION);
      // Ease out of slow motion
      this.timeScale = this.SLOW_MOTION_SCALE + (1 - this.SLOW_MOTION_SCALE) * progress * progress;
      delta *= this.timeScale;
    } else {
      this.timeScale = 1.0;
    }

    this.gameTime += delta;

    // Update player (freeze during win sequence)
    let playerPos: THREE.Vector3;
    if (this.winSequence.getIsPlaying()) {
      // During win sequence, get position but don't process movement
      playerPos = this.player.getPosition();
    } else {
      playerPos = this.player.update(delta, this.city);
    }

    // Update fog of war
    this.fogOfWar.clearAt(playerPos.x, playerPos.z, this.settings.fogClearRadius);
    this.fogOfWar.updateCorruption(delta);

    // Calculate night amount based on current theme (night=1, neon=0.8, dusk=0.3, day=0)
    const currentTheme = this.themeNames[this.currentThemeIndex];
    let nightAmount = 0;
    if (currentTheme === 'night') nightAmount = 1.0;
    else if (currentTheme === 'neon') nightAmount = 0.8;
    else if (currentTheme === 'dusk') nightAmount = 0.3;

    this.city.updateFogUniforms(playerPos, nightAmount, this.gameTime);

    // Enable torch light for dark themes
    this.torchLight.visible = nightAmount > 0.5;

    // Check corruption damage - drain stamina in corrupted areas
    const corruption = this.fogOfWar.getCorruptionAt(playerPos.x, playerPos.z);
    if (corruption > 0.3) {
      this.player.drainStamina(corruption * 15 * delta); // Up to 15 stamina/sec in fully corrupted areas
    }

    // Update fog particles
    this.fogParticles.update(delta, playerPos);

    // Update water
    this.water.update(delta);
    const inWater = this.water.isInWater(playerPos);
    this.player.setInWater(inWater);

    // Update guards (DISABLED)
    // this.guards.update(delta, playerPos);
    // const guardAlert = this.guards.getAlertLevel();
    // if (guardAlert > 0.3) {
    //   this.player.drainStamina(guardAlert * 20 * delta);
    // }

    // Update weather (rain)
    this.weatherTimer += delta;
    if (this.weatherTimer > 60) { // Check weather every 60 seconds
      this.weatherTimer = 0;
      // 30% chance of rain change, more likely at night
      if (Math.random() < 0.3) {
        this.isRaining = !this.isRaining;
        this.rain.setActive(this.isRaining);
        if (this.isRaining) {
          this.rain.setIntensity(0.5 + Math.random() * 0.5);
        }
      }
    }
    this.rain.update(delta, playerPos);

    // Lightning during rain
    if (this.isRaining) {
      this.lightningTimer += delta;
      // Random lightning every 5-15 seconds
      if (this.lightningTimer > 5 + Math.random() * 10) {
        this.lightningTimer = 0;
        this.lightningFlash = 1.0;
        // Play thunder sound
        this.audioManager.playThunder();
      }
    }

    // Update lightning flash effect
    if (this.lightningFlash > 0) {
      this.lightningFlash -= delta * 3; // Fade over ~0.3 seconds
      // Temporarily boost ambient light for flash
      if (this.ambientLight) {
        const baseIntensity = this.themeManager.getCurrentTheme().ambientIntensity;
        this.ambientLight.intensity = baseIntensity + this.lightningFlash * 2;
      }
    }

    // Update clouds, birds, and leaves
    this.clouds.update(delta);
    this.birds.update(delta);
    this.leafParticles.update(delta);
    this.emberParticles.update(delta, playerPos);
    this.steamVents.update(delta);

    // Update breadcrumb trail (only when not in win sequence)
    if (!this.winSequence.getIsPlaying()) {
      this.breadcrumbTrail.update(playerPos, delta);
    }

    // Update theme transitions
    this.themeManager.update(delta);

    // Auto day/night cycle (every 90 seconds)
    const cycleTime = 90;
    const newThemeIndex = Math.floor((this.gameTime % (cycleTime * this.themeNames.length)) / cycleTime);
    if (newThemeIndex !== this.currentThemeIndex) {
      this.currentThemeIndex = newThemeIndex;
      this.themeManager.setTheme(this.themeNames[this.currentThemeIndex]);

      // Update birds/bats based on time of day
      const isNight = this.themeNames[this.currentThemeIndex] === 'night' ||
                      this.themeNames[this.currentThemeIndex] === 'neon';
      this.birds.setNightMode(isNight);
    }

    // Update audio (footsteps based on movement and surface)
    const playerMovement = this.player.getMovementState();
    const surfaceType = this.city.getSurfaceType(playerPos);
    this.audioManager.setNightMode(nightAmount); // Update night sounds
    this.moon.setNightAmount(nightAmount); // Moon visibility at night
    this.audioManager.setWaterProximity(this.water.getDistanceToWater(playerPos)); // Water ambience
    this.audioManager.setBuildingProximity(this.city.getBuildingProximity(playerPos)); // Urban echo
    this.audioManager.update(delta, playerMovement.isMoving, playerMovement.isSprinting, surfaceType);

    // Update collectibles and check collection
    this.collectibles.forEach((collectible) => {
      collectible.update(delta);
      collectible.setNightMode(nightAmount); // Fragments glow brighter at night

      if (!collectible.isCollected && collectible.checkCollection(playerPos)) {
        this.fragmentsCollected++;
        this.totalPoints += collectible.points;
        this.onFragmentCollected(collectible);
      }
    });

    // Update screen shake
    this.updateScreenShake(delta);

    // Update minimap
    const cameraDirection = new THREE.Vector3();
    this.camera.getWorldDirection(cameraDirection);
    const playerRotation = Math.atan2(cameraDirection.x, cameraDirection.z);
    this.minimap.update(playerPos, playerRotation, this.collectibles);

    // Update UI
    this.updateUI();
    const nearestFragmentDist = this.updateCompass(playerPos);

    // Update fragment proximity audio (ping when near fragments)
    this.audioManager.setFragmentProximity(nearestFragmentDist);

    // Check win condition
    if (this.fragmentsCollected >= this.totalFragments && !this.winSequenceTriggered) {
      this.winSequenceTriggered = true;
      this.triggerWinSequence(playerPos);
    }

    // Update win sequence
    this.winSequence.update(delta);

    // Render with post-processing
    this.composer.render();
  };

  private updateScreenShake(delta: number): void {
    if (this.shakeDuration > 0) {
      this.shakeDuration -= delta;
      const shakeX = (Math.random() - 0.5) * this.shakeIntensity;
      const shakeY = (Math.random() - 0.5) * this.shakeIntensity;
      this.camera.position.x += shakeX;
      this.camera.position.y += shakeY;

      // Decay intensity
      this.shakeIntensity *= 0.9;
    }
  }

  private triggerScreenShake(intensity: number, duration: number): void {
    this.shakeIntensity = intensity;
    this.shakeDuration = duration;
  }

  private triggerCollectionBurst(fragmentType: 'common' | 'rare' | 'hidden'): void {
    const container = document.getElementById('collection-burst');
    if (!container) return;

    // Clear any existing particles
    container.innerHTML = '';

    // Fragment type colors
    const colors: Record<string, string[]> = {
      common: ['#00ffaa', '#00ff88', '#00ddff', '#ffffff'],
      rare: ['#ffaa00', '#ff8800', '#ffff00', '#ffffff'],
      hidden: ['#aa00ff', '#8800ff', '#ff00ff', '#ffffff'],
    };

    const particleColors = colors[fragmentType];
    const particleCount = fragmentType === 'rare' ? 30 : 20;

    // Create burst particles
    for (let i = 0; i < particleCount; i++) {
      const particle = document.createElement('div');
      particle.className = 'burst-particle';

      // Random angle and distance
      const angle = (i / particleCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
      const distance = 80 + Math.random() * 120;
      const tx = Math.cos(angle) * distance;
      const ty = Math.sin(angle) * distance;

      // Random color from fragment palette
      const color = particleColors[Math.floor(Math.random() * particleColors.length)];

      particle.style.setProperty('--tx', `${tx}px`);
      particle.style.setProperty('--ty', `${ty}px`);
      particle.style.backgroundColor = color;
      particle.style.boxShadow = `0 0 6px ${color}`;
      particle.style.animationDelay = `${Math.random() * 0.1}s`;

      container.appendChild(particle);
    }

    // Clean up after animation
    setTimeout(() => {
      container.innerHTML = '';
    }, 900);
  }

  private triggerColorTint(fragmentType: 'common' | 'rare' | 'hidden'): void {
    const tintOverlay = document.getElementById('color-tint-overlay');
    if (!tintOverlay) return;

    // Color based on fragment type
    const colors: Record<string, string> = {
      common: 'rgba(0, 255, 170, 0.15)',
      rare: 'rgba(255, 170, 0, 0.2)',
      hidden: 'rgba(170, 0, 255, 0.2)',
    };

    tintOverlay.style.backgroundColor = colors[fragmentType];
    tintOverlay.classList.add('active');

    // Remove after animation
    setTimeout(() => {
      tintOverlay.classList.remove('active');
    }, 400);
  }

  private showBonusPopup(text: string): void {
    const popup = document.createElement('div');
    popup.className = 'bonus-popup';
    popup.textContent = text;
    document.body.appendChild(popup);

    // Animate and remove
    setTimeout(() => {
      popup.classList.add('fade-out');
      setTimeout(() => {
        popup.remove();
      }, 500);
    }, 1000);
  }

  private placeRandomSteamVents(): void {
    // Place 10-15 steam vents on random buildings
    const ventCount = 10 + Math.floor(Math.random() * 6);

    for (let i = 0; i < ventCount; i++) {
      // Random position within city
      const x = (Math.random() - 0.5) * this.settings.citySize * 0.8;
      const z = (Math.random() - 0.5) * this.settings.citySize * 0.8;

      // Find a building height at this position (approximate)
      // Use a random height between 30-80 units
      const height = 30 + Math.random() * 50;

      this.steamVents.addVent(new THREE.Vector3(x, height, z));
    }
  }

  private onFragmentCollected(collectible: Collectible): void {
    // Trigger slow-motion effect (stronger for rare fragments)
    this.slowMotionTimer = collectible.fragmentType === 'rare' ? this.SLOW_MOTION_DURATION * 1.5 : this.SLOW_MOTION_DURATION;

    // Screen shake feedback varies by fragment type
    let shakeIntensity = 0.4;
    let shakeDuration = 0.15;
    if (collectible.fragmentType === 'rare') {
      shakeIntensity = 0.9;
      shakeDuration = 0.3;
    } else if (collectible.fragmentType === 'hidden') {
      shakeIntensity = 0.6;
      shakeDuration = 0.25;
    }
    this.triggerScreenShake(shakeIntensity, shakeDuration);

    // Play collection sound (different for each fragment type)
    this.audioManager.playCollect(collectible.fragmentType);

    // Screen particle burst effect
    this.triggerCollectionBurst(collectible.fragmentType);

    // Color tint effect
    this.triggerColorTint(collectible.fragmentType);

    // Speed bonus: 2 fragments within 15 seconds = +500 pts
    const timeSinceLastFragment = this.gameTime - this.lastFragmentTime;
    if (timeSinceLastFragment <= this.SPEED_BONUS_WINDOW && this.fragmentsCollected > 1) {
      this.speedBonusCount++;
      this.totalPoints += this.SPEED_BONUS_POINTS;
      this.showBonusPopup('SPEED BONUS +500');
    }
    this.lastFragmentTime = this.gameTime;

    // Play milestone chime at certain thresholds
    const milestones = [3, 5, Math.floor(this.totalFragments * 0.75)];
    if (milestones.includes(this.fragmentsCollected)) {
      setTimeout(() => {
        this.audioManager.playMilestoneChime(this.fragmentsCollected);
      }, 300); // Delay to not overlap with collect sound
    }

    console.log(`${collectible.fragmentType} fragment collected! (+${collectible.points} pts) ${this.fragmentsCollected}/${this.totalFragments}`);
  }

  private triggerWinSequence(playerPos: THREE.Vector3): void {
    // Screen shake on final fragment
    this.triggerScreenShake(1.5, 0.5);

    // Pass fragment positions to win sequence for beam effects
    const fragmentPositions = this.collectibles.map(c => c.getPosition());
    this.winSequence.setFragmentPositions(fragmentPositions);

    // Start the win sequence animation
    this.winSequence.play(playerPos, () => {
      this.onWin();
    });
  }

  private onWin(): void {
    // Don't stop game loop - let fireworks and effects continue!
    // this.isRunning = false;
    this.controls.unlock();

    const explored = this.fogOfWar.getExploredPercent();

    // Perfect exploration bonus (+2000 for 90%+ exploration)
    const perfectExplorationBonus = explored >= 90 ? 2000 : 0;

    // No-pause bonus (+1000 for completing without pausing)
    const noPauseBonus = !this.hasPaused ? 1000 : 0;

    // Time trial bonus (under 3 minutes on normal = +1500)
    const timeTrialBonus = this.gameTime < 180 ? 1500 : 0;

    const score = Math.floor(
      this.totalPoints +
      perfectExplorationBonus +
      noPauseBonus +
      timeTrialBonus +
      explored * 10 -
      this.gameTime * 2
    );

    // Save high score locally
    const scoreData = {
      score: Math.max(0, score),
      time: this.gameTime,
      explored,
      fragments: this.fragmentsCollected,
      difficulty: this.difficulty,
      date: new Date().toISOString(),
    };

    HighScoreManager.saveScore(scoreData);

    // Submit to global leaderboard (async, don't wait)
    GlobalLeaderboardManager.submitScore(scoreData)
      .then(success => {
        if (success) {
          console.log('Score submitted to global leaderboard!');
        }
      })
      .catch(err => console.error('Global submit failed:', err));

    // Update win screen with animated stat values
    const timeEl = document.querySelector('#final-time .stat-value') as HTMLElement;
    const exploredEl = document.querySelector('#final-explored .stat-value') as HTMLElement;
    const scoreEl = document.querySelector('#final-score .stat-value') as HTMLElement;
    const bonusEl = document.querySelector('#final-bonus .stat-value') as HTMLElement;

    // Show the win screen first
    document.getElementById('win-screen')!.style.display = 'flex';

    // Animate counters with staggered timing
    const finalScore = Math.max(0, score);
    this.animateCounter(timeEl, 0, this.gameTime, 1500, (v) => this.formatTime(v));
    setTimeout(() => {
      this.animateCounter(exploredEl, 0, explored, 1200, (v) => `${v.toFixed(1)}%`);
    }, 400);
    setTimeout(() => {
      if (bonusEl) {
        const bonuses: string[] = [];
        if (perfectExplorationBonus > 0) bonuses.push(`+${perfectExplorationBonus} Perfect!`);
        if (noPauseBonus > 0) bonuses.push(`+${noPauseBonus} No Pause!`);
        if (timeTrialBonus > 0) bonuses.push(`+${timeTrialBonus} Speed Run!`);
        bonusEl.textContent = bonuses.join(' ');
      }
    }, 1200);
    setTimeout(() => {
      this.animateCounter(scoreEl, 0, finalScore, 2000, (v) => String(Math.floor(v)));
    }, 800);
  }

  private animateCounter(
    element: HTMLElement | null,
    start: number,
    end: number,
    duration: number,
    formatter: (v: number) => string
  ): void {
    if (!element) return;

    const startTime = performance.now();
    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = start + (end - start) * eased;

      element.textContent = formatter(current);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    requestAnimationFrame(animate);
  }

  private updateUI(): void {
    // Fragments
    document.getElementById('fragment-counter')!.textContent = 
      `Fragments: ${this.fragmentsCollected} / ${this.totalFragments}`;

    // Timer
    document.getElementById('timer')!.textContent = 
      `Time: ${this.formatTime(this.gameTime)}`;

    // Explored
    const explored = this.fogOfWar.getExploredPercent();
    document.getElementById('explored')!.textContent = 
      `Explored: ${explored.toFixed(1)}%`;

    // Stamina
    const staminaPercent = this.player.getStaminaPercent();
    document.getElementById('stamina-fill')!.style.width = `${staminaPercent}%`;
  }

  private formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  private updateCompass(playerPos: THREE.Vector3): number {
    const compassEl = document.getElementById('compass');
    const arrowEl = document.getElementById('compass-arrow');
    const distanceEl = document.getElementById('compass-distance');

    if (!compassEl || !arrowEl || !distanceEl) return Infinity;

    // Find nearest uncollected fragment
    let nearestDist = Infinity;
    let nearestX = 0;
    let nearestZ = 0;
    let found = false;

    this.collectibles.forEach((collectible) => {
      if (collectible.isCollected) return;
      const pos = collectible.getPosition();
      const dist = new THREE.Vector2(
        pos.x - playerPos.x,
        pos.z - playerPos.z
      ).length();

      if (dist < nearestDist) {
        nearestDist = dist;
        nearestX = pos.x;
        nearestZ = pos.z;
        found = true;
      }
    });

    if (!found) {
      compassEl.classList.add('hidden');
      return Infinity;
    }

    compassEl.classList.remove('hidden');

    // Calculate angle to nearest fragment relative to camera direction
    const cameraDirection = new THREE.Vector3();
    this.camera.getWorldDirection(cameraDirection);
    const cameraAngle = Math.atan2(cameraDirection.x, cameraDirection.z);

    const dx = nearestX - playerPos.x;
    const dz = nearestZ - playerPos.z;
    const fragmentAngle = Math.atan2(dx, dz);

    // Relative angle (0 = straight ahead, negative = negate for CSS rotation direction)
    const relativeAngle = -(fragmentAngle - cameraAngle);

    // Update arrow rotation
    arrowEl.style.transform = `translate(-50%, -50%) rotate(${relativeAngle}rad)`;

    // Update distance display
    distanceEl.textContent = `${Math.round(nearestDist)}m`;

    return nearestDist;
  }

  dispose(): void {
    // Stop the game loop
    this.isRunning = false;

    // Remove canvas from DOM
    if (this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }

    // Dispose renderer
    this.renderer.dispose();

    // Dispose composer
    this.composer.dispose();

    // Clean up win sequence if it exists
    if (this.winSequence) {
      this.winSequence.dispose();
    }
  }
}
