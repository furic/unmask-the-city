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

  // Screen shake
  private shakeIntensity = 0;
  private shakeDuration = 0;

  // Weather
  private rain: Rain;
  private weatherTimer = 0;
  private isRaining = false;

  // Water
  private water: Water;
  // private guards: Guard; // DISABLED

  // Win sequence
  private winSequence!: WinSequence;
  private winSequenceTriggered = false;

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

    // Spawn new collectibles
    for (let i = 0; i < this.totalFragments; i++) {
      let position: THREE.Vector3;
      let attempts = 0;

      // Find valid position
      do {
        position = new THREE.Vector3(
          (Math.random() - 0.5) * this.settings.citySize * 0.8,
          2,
          (Math.random() - 0.5) * this.settings.citySize * 0.8
        );
        attempts++;
      } while (
        (this.city.isInsideBuilding(position) || this.isTooCloseToOthers(position, MIN_DISTANCE)) &&
        attempts < 100
      );

      // Ensure first collectible is near spawn and always common
      if (i === 0) {
        position.set(
          (Math.random() - 0.5) * 30,
          2,
          (Math.random() - 0.5) * 30
        );
      }

      // Determine fragment type: 70% common, 20% rare, 10% hidden
      let fragmentType: FragmentType = 'common';
      if (i > 0) {
        const roll = Math.random();
        if (roll < 0.1) {
          fragmentType = 'hidden';
        } else if (roll < 0.3) {
          fragmentType = 'rare';
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

    this.animate();
  }

  restart(): void {
    // Reset game state
    this.gameTime = 0;
    this.fragmentsCollected = 0;
    this.totalPoints = 0;
    this.winSequenceTriggered = false;

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

    this.updateUI();
    this.start();
  }

  private animate = (): void => {
    if (!this.isRunning) return;

    requestAnimationFrame(this.animate);

    const delta = this.clock.getDelta();
    this.gameTime += delta;

    // Update player
    const playerPos = this.player.update(delta, this.city);

    // Update fog of war
    this.fogOfWar.clearAt(playerPos.x, playerPos.z, this.settings.fogClearRadius);
    this.fogOfWar.updateCorruption(delta);

    // Calculate night amount based on current theme (night=1, neon=0.8, dusk=0.3, day=0)
    const currentTheme = this.themeNames[this.currentThemeIndex];
    let nightAmount = 0;
    if (currentTheme === 'night') nightAmount = 1.0;
    else if (currentTheme === 'neon') nightAmount = 0.8;
    else if (currentTheme === 'dusk') nightAmount = 0.3;

    this.city.updateFogUniforms(playerPos, nightAmount);

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

    // Update theme transitions
    this.themeManager.update(delta);

    // Auto day/night cycle (every 90 seconds)
    const cycleTime = 90;
    const newThemeIndex = Math.floor((this.gameTime % (cycleTime * this.themeNames.length)) / cycleTime);
    if (newThemeIndex !== this.currentThemeIndex) {
      this.currentThemeIndex = newThemeIndex;
      this.themeManager.setTheme(this.themeNames[this.currentThemeIndex]);
    }

    // Update audio (footsteps based on movement)
    const playerMovement = this.player.getMovementState();
    this.audioManager.update(delta, playerMovement.isMoving, playerMovement.isSprinting);

    // Update collectibles and check collection
    this.collectibles.forEach((collectible) => {
      collectible.update(delta);

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

  private onFragmentCollected(collectible: Collectible): void {
    // Screen shake feedback (stronger for rare fragments)
    const shakeIntensity = collectible.fragmentType === 'rare' ? 0.8 : 0.5;
    this.triggerScreenShake(shakeIntensity, 0.2);

    // Play collection sound
    this.audioManager.playCollect();

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
    const score = Math.floor(
      this.totalPoints +
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
    const timeEl = document.querySelector('#final-time .stat-value');
    const exploredEl = document.querySelector('#final-explored .stat-value');
    const scoreEl = document.querySelector('#final-score .stat-value');

    if (timeEl) timeEl.textContent = this.formatTime(this.gameTime);
    if (exploredEl) exploredEl.textContent = `${explored.toFixed(1)}%`;
    if (scoreEl) scoreEl.textContent = String(Math.max(0, score));

    document.getElementById('win-screen')!.style.display = 'flex';
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
}
