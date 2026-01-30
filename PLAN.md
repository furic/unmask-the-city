# Implementation Plan

## Overview

A 3D exploration game where players navigate a fog-covered city, permanently revealing areas as they explore. Built with Three.js for Global Game Jam 2025.

---

## Phase 1: Core Setup (1-2 hours)

### 1.1 Project Initialization
- [x] Create project directory
- [x] Initialize with Vite + TypeScript
- [x] Install Three.js dependencies
- [x] Basic HTML canvas setup
- [x] Dev server running

### 1.2 Basic Scene
- [x] Create Three.js scene, camera, renderer
- [x] Add orbit controls for testing
- [x] Basic lighting (ambient + directional)
- [x] Ground plane
- [x] Render loop with delta time

**Milestone:** Empty scene renders with camera controls

---

## Phase 2: Procedural City (2-3 hours)

### 2.1 Building Generator
```typescript
interface BuildingConfig {
  minWidth: number;    // 10-30
  maxWidth: number;
  minHeight: number;   // 20-100
  maxHeight: number;
  minDepth: number;
  maxDepth: number;
}
```

- [x] Create `City.ts` class
- [x] Generate random building dimensions
- [x] Use BoxGeometry for buildings
- [x] Apply basic materials (grayscale, slight variation)
- [ ] Add horizontal "floor" lines texture (like the reference)

### 2.2 City Layout
- [x] Grid-based placement with random offsets
- [x] Varying density (more buildings toward center)
- [x] Leave walkable paths between buildings
- [x] City bounds (e.g., 500x500 units)

### 2.3 Performance
- [x] Use InstancedMesh for buildings (single draw call)
- [ ] Simple LOD: far buildings = simpler geometry
- [x] Frustum culling (built into Three.js)

**Milestone:** Procedural city generates and renders at 60fps

---

## Phase 3: Fog of War System (3-4 hours) ⭐ Core Feature

### 3.1 Fog Texture Approach
```typescript
class FogOfWar {
  texture: THREE.DataTexture;   // 512x512 grayscale
  resolution: number;           // World units per texel
  
  clear(worldX: number, worldZ: number, radius: number): void;
  getTexture(): THREE.Texture;
}
```

- [x] Create `FogOfWar.ts` class
- [x] Initialize fog texture (all white = fully fogged)
- [x] `clear()` method: paint black circle at position
- [x] Smooth falloff at edges (Gaussian or linear)
- [x] Update texture to GPU when changed

### 3.2 Fog Shader
```glsl
// Fragment shader concept
uniform sampler2D fogMap;
uniform vec2 worldBounds;

void main() {
  // Get world position XZ, map to UV
  vec2 fogUV = (worldPos.xz - worldBounds.x) / (worldBounds.y - worldBounds.x);
  float fogDensity = texture2D(fogMap, fogUV).r;
  
  // Mix between object color and fog color
  vec3 finalColor = mix(objectColor, fogColor, fogDensity);
  gl_FragColor = vec4(finalColor, 1.0);
}
```

- [x] Create custom ShaderMaterial for buildings
- [x] Pass fog texture as uniform
- [x] Pass player position for additional real-time clear zone
- [x] Fog color matches sky (white/light gray)

### 3.3 Visual Polish
- [ ] Animated fog edges (Perlin noise distortion)
- [ ] Height-based fog (thicker at ground level)
- [x] Soft transition at clear boundary

**Milestone:** Walking reveals fog permanently, fog looks atmospheric

---

## Phase 4: Player Controller (1-2 hours)

### 4.1 First-Person Controls
- [x] Create `Player.ts` class
- [x] PointerLockControls for mouse look
- [x] WASD movement relative to camera direction
- [x] Collision detection with buildings (AABB-based)
- [x] Sprint with stamina

### 4.2 Movement Feel
```typescript
const WALK_SPEED = 15;
const SPRINT_SPEED = 25;
const ACCELERATION = 50;
const DECELERATION = 30;
const MAX_STAMINA = 100;
const STAMINA_DRAIN = 20;  // per second
const STAMINA_REGEN = 15;  // per second
```

- [x] Smooth acceleration/deceleration
- [ ] Head bob (subtle)
- [ ] Footstep sounds (optional)

**Milestone:** Smooth first-person movement through city

---

## Phase 5: Collectibles & Objectives (1-2 hours)

### 5.1 Data Fragments
- [x] Create `Collectible.ts` class
- [x] Glowing cube/sphere geometry
- [x] Floating animation (sin wave)
- [x] Particle effect on collect
- [x] Random placement (not inside buildings)

### 5.2 Placement Algorithm
```typescript
function placeCollectibles(city: City, count: number): Vector3[] {
  const positions: Vector3[] = [];
  while (positions.length < count) {
    const pos = randomPointInCity();
    if (!city.isInsideBuilding(pos) && !tooCloseToOthers(pos, positions)) {
      positions.push(pos);
    }
  }
  return positions;
}
```

- [x] Ensure collectibles are reachable
- [ ] Minimum distance between collectibles
- [x] At least one near spawn, others distributed

### 5.3 Collection Logic
- [x] Proximity detection (player within 3 units)
- [x] Visual/audio feedback on collect
- [x] Update UI counter
- [x] Check win condition

**Milestone:** Can collect all fragments and "win"

---

## Phase 6: UI & Game Loop (1-2 hours)

### 6.1 HUD
```
┌─────────────────────────────────────┐
│ Fragments: 3/7        Time: 02:34   │
│                                     │
│                                     │
│                                     │
│                                     │
│               [+]                   │
│                                     │
│                                     │
│                                     │
│ Explored: 34%            [SPRINT]   │
└─────────────────────────────────────┘
```

- [x] Fragment counter
- [x] Timer (counts up)
- [x] Exploration percentage
- [x] Stamina bar
- [x] Crosshair

### 6.2 Game States
- [x] Title screen (click to start)
- [x] Playing state
- [x] Win screen (show stats, play again)
- [ ] Pause menu (optional)

### 6.3 Score System
```typescript
interface GameScore {
  time: number;           // seconds
  fragmentsFound: number;
  explorationPercent: number;
  finalScore: number;     // calculated
}

// Score = (fragments * 1000) + (exploration * 10) - (time * 2)
```

**Milestone:** Complete game loop from start to win

---

## Phase 7: Polish & Juice (remaining time)

### 7.1 Visual
- [x] Better building materials (procedural floor lines, window patterns)
- [x] Fog particles/volumetrics
- [x] Post-processing (bloom on collectibles, vignette)
- [x] Day/night cycle or color themes (4 themes: day, dusk, night, neon)

### 7.2 Audio
- [x] Ambient city sounds (procedural drone + wind)
- [x] Footsteps (procedural)
- [x] Collection sound (procedural arpeggio)
- [x] Background music (ambient drone)

### 7.3 Feel
- [x] Screen shake on collect
- [x] Minimap showing explored areas
- [x] Compass pointing to nearest fragment
- [x] Difficulty settings (easy/normal/hard with city size, fragment count)

---

## Technical Notes

### Fog Shader Integration

Since Three.js standard materials have built-in fog, we need to either:

**Option A: Custom ShaderMaterial** (Full control)
- Write vertex + fragment shaders from scratch
- Include our fog-of-war logic
- More work but more flexible

**Option B: onBeforeCompile Hook** (Recommended)
- Modify MeshStandardMaterial's shader
- Inject our fog-of-war sampling
- Keeps PBR lighting, less code

```typescript
material.onBeforeCompile = (shader) => {
  shader.uniforms.fogMap = { value: fogTexture };
  shader.uniforms.cityBounds = { value: new THREE.Vector4(-250, -250, 250, 250) };
  
  // Inject into fragment shader
  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <fog_fragment>',
    `
    vec2 fogUV = (vWorldPosition.xz - cityBounds.xy) / (cityBounds.zw - cityBounds.xy);
    float fowDensity = texture2D(fogMap, fogUV).r;
    gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.85), fowDensity * 0.95);
    #include <fog_fragment>
    `
  );
};
```

### Performance Budget
- Target: 60fps on mid-range hardware
- Max buildings: ~1000 (instanced)
- Fog texture: 512x512 (update once per frame max)
- Draw calls: <50

### File Size Budget (for web)
- Three.js: ~600KB (minified)
- Game code: <100KB
- Textures: <2MB
- Audio: <5MB (optional)
- **Total: <8MB**

---

## Phase 8: Gameplay Enhancements (Make it Fun!)

### 8.1 Building Variety & Props (Easy - 30-45 min)

**Diverse Building Shapes**
- [ ] Add cylinder buildings (towers) - Use `CylinderGeometry`
- [ ] Add pyramids (peaked roofs) - Use `ConeGeometry` on top of boxes
- [ ] Add L-shaped buildings - Combine two boxes
- [ ] Vary building types by distance from center:
  - City center: Tall cylinders (skyscrapers)
  - Mid-range: Box buildings (current style)
  - Outer areas: Lower, wider buildings

**Building Details** (Use additional InstancedMesh or regular meshes)
- [ ] Rooftop antennas - Thin cylinders on tall buildings (10% chance)
- [ ] Water towers - Small cylinders on flat roofs (5% chance)
- [ ] Neon signs - Glowing rectangles on building sides (emissive material)
- [ ] Street lights - Point lights along paths, turn on at night

**Implementation Notes:**
- Create separate InstancedMesh for each geometry type
- Store building type in Building interface
- Add `createBuildingMesh()` method that picks geometry based on type
- Keep using instancing for performance (separate mesh per geometry type)

### 8.2 Auto Day/Night Cycle (Easy - 20 min)

**Replace Manual Theme Cycling**
- [ ] Remove T key theme toggle
- [ ] Add automatic theme transition based on game time
- [ ] Cycle: day → dusk → night → neon → repeat (every 90-120 seconds)
- [ ] Update pause menu to remove T key control

**Night Vision / Torch Effect**
- [ ] Add SpotLight attached to camera (night theme only)
- [ ] Cone angle: 45°, distance: 30 units
- [ ] Points in camera direction
- [ ] Enable only during night/neon themes
- [ ] Fragments glow brighter at night (increase emissive intensity)

**Implementation:**
```typescript
// In Game.ts animate()
const cycleTime = 120; // 2 minutes per full cycle
const themeIndex = Math.floor((this.gameTime % (cycleTime * 4)) / cycleTime);
if (themeIndex !== this.currentThemeIndex) {
  this.currentThemeIndex = themeIndex;
  this.themeManager.setTheme(this.themeNames[themeIndex]);
}
```

### 8.3 Water/Lake System (Medium - 45-60 min)

**Water Bodies**
- [ ] Create `Water.ts` class
- [ ] Add 1-3 lakes/rivers to city generation
- [ ] Lakes = circular blue planes with animated shader
- [ ] Rivers = elongated rectangles connecting areas
- [ ] Skip building spawn in water areas

**Water Mechanics**
- [ ] Detect when player is in water (check Y < 0.5 and XZ in water bounds)
- [ ] Reduce movement speed by 50% in water
- [ ] Lower camera height slightly (wade effect)
- [ ] Add ripple effect around player in water
- [ ] Fragments can spawn on small islands or floating in water

**Water Shader** (Simple animated water)
```glsl
// Fragment shader
float time = uTime;
vec2 uv = vUv;
uv += sin(uv.yx * 10.0 + time) * 0.02; // Ripples
vec3 waterColor = vec3(0.1, 0.3, 0.6);
float foam = step(0.98, sin(uv.x * 50.0 + time * 2.0));
gl_FragColor = vec4(mix(waterColor, vec3(0.8), foam), 0.7);
```

**Collision Updates:**
- [ ] Update `City.checkCollision()` to handle water boundaries
- [ ] Add `isInWater()` method to City class
- [ ] Update Player movement to check water state

### 8.4 Enemy/Hazard System (Medium - 60 min)

**Option A: Stationary Guards (Simpler)**
- [ ] Create `Guard.ts` class
- [ ] Spawn 3-5 guards in random locations (not near spawn)
- [ ] Guards have vision cones (check player angle + distance)
- [ ] If spotted: lose stamina rapidly (drain faster)
- [ ] Visual: Red cone showing vision area
- [ ] Avoid combat - pure stealth mechanic

**Option B: Fog Creatures (Thematic)**
- [ ] Create `FogCreature.ts` class
- [ ] Creatures spawn in heavily fogged areas
- [ ] Move slowly toward player when in range
- [ ] Disappear when fog clears around them
- [ ] Contact drains stamina (5 stamina/sec)
- [ ] Visual: Dark shadowy figures, particle-based

**Option C: Time Pressure (Easiest)**
- [ ] Add "fog corruption" mechanic
- [ ] Unexplored areas slowly become "corrupted" (darker fog)
- [ ] Corrupted areas drain stamina when entered
- [ ] Must explore before corruption spreads
- [ ] Visual: Fog color shifts to red in corrupted zones

**Recommended:** Option C (time pressure) - fits theme, no AI needed

### 8.5 Jump Ability (Easy - 15 min)

- [ ] Add Space key as jump (update controls, remove "Interact" text)
- [ ] Jump velocity: 8 units/sec upward
- [ ] Gravity: -20 units/sec²
- [ ] Can't jump while in air (isGrounded check)
- [ ] Costs 10 stamina per jump
- [ ] Allows hopping over low obstacles/debris
- [ ] Update Player.ts with vertical velocity

**Implementation:**
```typescript
// In Player.ts
private verticalVelocity = 0;
private isGrounded = true;
private readonly JUMP_FORCE = 8;
private readonly GRAVITY = -20;

// In update()
this.verticalVelocity += GRAVITY * delta;
newPosition.y += this.verticalVelocity * delta;
if (newPosition.y <= PLAYER_HEIGHT) {
  newPosition.y = PLAYER_HEIGHT;
  this.verticalVelocity = 0;
  this.isGrounded = true;
}
```

### 8.6 Fragment Variety (Easy - 20 min)

**Fragment Types:**
- [ ] Common fragments (green, current): 1000 points
- [ ] Rare fragments (gold/yellow): 2000 points
- [ ] Hidden fragments (purple): Only visible within 15 units, 1500 points

**Spawn Distribution:**
- 70% common, 20% rare, 10% hidden
- Update `Collectible.ts` constructor to accept type parameter
- Different colors, emissive intensities, and particle colors
- Update score calculation to use fragment values

**Visual Differences:**
- Common: Green (#00ffaa) - current
- Rare: Gold (#ffaa00) - larger, brighter glow
- Hidden: Purple (#aa00ff) - faint glow, only brighten when close

### 8.7 Environmental Props (Medium - 45 min)

**Parks & Open Spaces**
- [ ] Designate 5-10 "park" areas (no buildings)
- [ ] Add trees: Cylinder trunk + sphere crown
- [ ] Use InstancedMesh for trees (100-200 trees)
- [ ] Parks restore stamina 2x faster
- [ ] Fragments often spawn in parks (easier to see)

**Street Furniture**
- [ ] Benches - Small boxes in park areas
- [ ] Lamp posts - Cylinders with PointLight on top
- [ ] Trash bins - Small cylinders
- [ ] Billboards - Tall rectangles with emissive texture

**Landmarks** (1-3 unique structures)
- [ ] Central tower - Ultra-tall cylinder (150+ units) in city center
- [ ] Pyramid monument - Large pyramid in random location
- [ ] Sphere dome - Large sphere (planetarium/arena)
- [ ] Visible from anywhere, helps with navigation

### 8.8 Advanced Movement (Medium - 30 min)

**Parkour Mechanics:**
- [ ] Climb low buildings - If building height < 15 units, can walk up at reduced speed
- [ ] Dash ability - Double-tap WASD for quick burst (costs 20 stamina)
- [ ] Slide - Hold Ctrl while sprinting to slide (faster, can't turn)
- [ ] Wallrun - Run along building sides briefly

**Recommended for GGJ:** Just implement **Jump** - simplest, most impactful

### 8.9 Atmospheric Improvements (Easy - 30 min)

**Sound Design:**
- [ ] Fragment proximity hum - Quiet beep that gets louder/faster when close
- [ ] Distance-based wind - Wind sound increases in open areas
- [ ] Echo in tight spaces - Reverb near buildings
- [ ] Night creature sounds - Ambient creepy sounds at night

**Visual Polish:**
- [ ] Fragment trails - Particle stream drifting toward player when very close
- [ ] Visited path glow - Ground slightly glows where you've walked (fades over time)
- [ ] Building windows light up at night - Random windows become emissive
- [ ] Birds/bats - Simple flying creatures (boxes with flapping animation)

**Weather Effects:**
- [ ] Rain - Particle system, reduces visibility slightly
- [ ] Snow - White particles, leaves white patches on ground
- [ ] Fog density changes - Thicker fog in certain areas randomly

### 8.10 Risk/Reward Mechanics (Medium - 30 min)

**Hazard Zones:**
- [ ] Red fog areas - Drain stamina 2x faster, often contain rare fragments
- [ ] Rooftop fragments - Placed on tall buildings (requires jump/parkour)
- [ ] Timed fragments - Appear for 30 seconds then disappear, respawn elsewhere
- [ ] Fragment clusters - 2-3 fragments close together, guarded by hazard

**Bonuses:**
- [ ] Speed bonus - Collect 2 fragments within 15 seconds = +500 points
- [ ] Perfect exploration - Collect all fragments + 90% explored = +2000 points
- [ ] No pause bonus - Complete without pausing = +1000 points
- [ ] Time trials - Under 3 minutes on normal = +1500 points

---

## Implementation Priority (Recommended Order)

### Must-Have (Core Fun Factor)
1. **Building variety** - Makes city visually interesting
2. **Auto day/night** - Adds atmosphere, reuses existing themes
3. **Jump ability** - More engaging movement
4. **Fragment types** - Adds collection variety

### Should-Have (Big Impact)
5. **Parks/trees** - Breaks up monotony, navigation landmarks
6. **Neon signs** - Visual interest, guides navigation
7. **Street lights** - Helpful at night
8. **Landmark towers** - Navigation reference points

### Nice-to-Have (Polish)
9. **Water system** - Cool feature but complex
10. **Enemy/hazard** - Adds tension (use Option C: corruption)
11. **Fragment proximity sound** - QOL improvement
12. **Rooftop props** - Visual detail

### Advanced (If Extra Time)
13. **Weather effects**
14. **Parkour beyond jumping**
15. **Timed fragments**
16. **Bonus scoring**

---

## Phase 9: Epic Victory Sequence - "The Great Unmasking" 🎆

### Overview
Create a dramatic, thematic ending that visualizes the "unmasking" of the city when all fragments are collected. Total sequence: ~5-6 seconds before win screen.

### 9.1 Trigger & Initial Impact (0-0.5s)

**Final Fragment Collection:**
- [ ] Detect final fragment collection in `Game.ts`
- [ ] Trigger `startWinSequence()` instead of immediate win screen
- [ ] Lock player controls (freeze movement)
- [ ] **Intense screen shake** (2x normal collection shake)
- [ ] **Bright flash** effect (white overlay, fade out quickly)
- [ ] **Sound**: Triumphant chord/arpeggio

### 9.2 Fog Vanishes - "Unmask" Effect (0.5-3.0s)

**Expanding Wave Clear:**
- [ ] Create `clearAllFog()` method in `FogOfWar.ts`
- [ ] Animate clearing in expanding circular wave from player
- [ ] Use easing: start slow, accelerate, then slow at edges
- [ ] Duration: 2.5 seconds total
- [ ] Update texture every frame during animation

**Implementation:**
```typescript
// In FogOfWar.ts
clearAllAnimated(centerX: number, centerZ: number, duration: number, onComplete: () => void): void {
  const maxRadius = Math.sqrt(this.worldSize * this.worldSize * 2);
  let elapsed = 0;

  const animate = (delta: number) => {
    elapsed += delta;
    const progress = Math.min(elapsed / duration, 1);

    // Ease-in-out cubic
    const eased = progress < 0.5
      ? 4 * progress * progress * progress
      : 1 - Math.pow(-2 * progress + 2, 3) / 2;

    const radius = eased * maxRadius;
    this.clearAt(centerX, centerZ, radius);

    if (progress >= 1) {
      onComplete();
    }
  };

  // Call from game loop
}
```

**Particle Effect:**
- [ ] Fog particles stream upward as fog clears
- [ ] Spawn 200-300 particles in cleared ring area
- [ ] Rise speed: 20 units/sec
- [ ] Fade out over 2 seconds
- [ ] Reuse `FogParticles` with upward velocity

### 9.3 City Awakens (1.0-4.0s)

**Building Windows Light Up:**
- [ ] Add `windowLightIntensity` uniform to building shader
- [ ] Animate intensity: 0 → 1 over 2 seconds
- [ ] Wave pattern: lights turn on from center outward or bottom to top
- [ ] Use existing window pattern from shader, add emissive

**Shader Update:**
```glsl
// Add to building fragment shader (in City.ts setupFogShader)
uniform float windowLightIntensity;

// After window pattern calculation
float windowEmit = (1.0 - windowPattern) * windowLightIntensity;
vec3 windowColor = vec3(1.0, 0.8, 0.4); // Warm golden
gl_FragColor.rgb += windowColor * windowEmit * 0.4;
```

**Neon Signs (if implemented):**
- [ ] Pulse existing neon signs brighter
- [ ] Increase emissive intensity by 2x
- [ ] Add pulsing animation

**Street Lights (if implemented):**
- [ ] All street lights turn on
- [ ] Point light intensity increases
- [ ] Add lens flare effect (optional)

### 9.4 Sky & Atmosphere Transform (1.5-4.0s)

**Sky Color Transition:**
- [ ] Animate scene fog color: `0xd4d4d8` → `0xffa563` (golden)
- [ ] Animate clear color to match
- [ ] Duration: 2 seconds
- [ ] Smooth interpolation

**Lighting Changes:**
- [ ] Sun intensity: 0.8 → 1.2 (50% brighter)
- [ ] Sun color: white → warm orange `0xffa500`
- [ ] Ambient light intensity: 0.6 → 0.9
- [ ] Hemisphere sky color: blue → warm orange

**Implementation:**
```typescript
// In Game.ts or WinSequence.ts
private animateSkyTransform(duration: number): void {
  const startColor = new THREE.Color(0xd4d4d8);
  const endColor = new THREE.Color(0xffa563);

  // Animate in update loop
  const progress = this.sequenceTime / duration;
  const currentColor = startColor.clone().lerp(endColor, progress);

  this.renderer.setClearColor(currentColor);
  this.scene.fog.color.copy(currentColor);
  this.sunLight.color.lerp(new THREE.Color(0xffa500), progress);
}
```

**God Rays (Volumetric Light):**
- [ ] Add radial blur post-processing pass
- [ ] Source point: sun position in screen space
- [ ] Intensity fades in: 0 → 0.3 over 1 second
- [ ] Yellow/orange tint

**God Ray Implementation:**
```typescript
const GodRayShader = {
  uniforms: {
    tDiffuse: { value: null },
    sunPosition: { value: new THREE.Vector2(0.5, 0.3) },
    intensity: { value: 0.0 },
  },
  vertexShader: `...`,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform vec2 sunPosition;
    uniform float intensity;
    varying vec2 vUv;

    void main() {
      vec3 color = texture2D(tDiffuse, vUv).rgb;
      vec2 dir = vUv - sunPosition;
      float dist = length(dir);

      // Radial blur
      vec3 rays = vec3(0.0);
      for (int i = 0; i < 6; i++) {
        rays += texture2D(tDiffuse, vUv - dir * float(i) * 0.015).rgb;
      }
      rays /= 6.0;

      // Mix based on distance from sun
      float rayStrength = (1.0 - smoothstep(0.0, 0.8, dist)) * intensity;
      color += rays * rayStrength * vec3(1.0, 0.9, 0.6);

      gl_FragColor = vec4(color, 1.0);
    }
  `,
};
```

### 9.5 Fireworks System (2.5-5.5s)

**Create `Firework.ts`:**

```typescript
interface FireworkParticle {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  color: THREE.Color;
}

export class Firework {
  private particles: FireworkParticle[] = [];
  private state: 'launching' | 'exploding' | 'done' = 'launching';
  private rocket: THREE.Mesh;
  private rocketVelocity: THREE.Vector3;

  constructor(
    launchPos: THREE.Vector3,
    color: THREE.Color,
    scene: THREE.Scene
  ) {
    // Create rocket (small glowing particle)
    this.rocket = new THREE.Mesh(
      new THREE.SphereGeometry(0.3),
      new THREE.MeshBasicMaterial({ color })
    );
    this.rocket.position.copy(launchPos);
    scene.add(this.rocket);

    // Upward velocity
    this.rocketVelocity = new THREE.Vector3(
      (Math.random() - 0.5) * 5,  // Slight X variance
      50 + Math.random() * 20,     // Upward
      (Math.random() - 0.5) * 5    // Slight Z variance
    );
  }

  update(delta: number): void {
    if (this.state === 'launching') {
      // Apply gravity
      this.rocketVelocity.y -= 30 * delta;
      this.rocket.position.add(
        this.rocketVelocity.clone().multiplyScalar(delta)
      );

      // Explode when velocity becomes downward
      if (this.rocketVelocity.y < 0) {
        this.explode();
      }
    } else if (this.state === 'exploding') {
      this.updateExplosion(delta);
    }
  }

  private explode(): void {
    this.state = 'exploding';
    this.rocket.visible = false;

    // Spawn 60-80 explosion particles
    const particleCount = 60 + Math.random() * 20;
    for (let i = 0; i < particleCount; i++) {
      // Radial explosion
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      const speed = 15 + Math.random() * 10;

      this.particles.push({
        position: this.rocket.position.clone(),
        velocity: new THREE.Vector3(
          Math.sin(phi) * Math.cos(theta) * speed,
          Math.abs(Math.cos(phi)) * speed,
          Math.sin(phi) * Math.sin(theta) * speed
        ),
        life: 1.5 + Math.random() * 0.5,
        maxLife: 1.5 + Math.random() * 0.5,
        color: this.color.clone(),
      });
    }
  }
}
```

**Firework Spawning:**
- [ ] Find 5-7 tallest buildings
- [ ] Stagger launches (0.3-0.5s apart)
- [ ] Use colors: green, gold, purple, blue, red
- [ ] Random pattern (not all buildings)

### 9.6 Camera Animation (2.0-5.0s)

**Cinematic Movement:**
- [ ] Store original camera position and rotation
- [ ] Target: Move back 20%, tilt up 10°
- [ ] Smooth interpolation (ease-in-out)
- [ ] Duration: 3 seconds
- [ ] Disable pointer lock during sequence

**Implementation:**
```typescript
private animateCamera(duration: number): void {
  const startPos = this.camera.position.clone();
  const startRot = this.camera.rotation.clone();

  // Calculate target (zoom out and tilt up)
  const direction = new THREE.Vector3();
  this.camera.getWorldDirection(direction);
  const targetPos = startPos.clone().sub(direction.multiplyScalar(20));
  targetPos.y += 10;

  // Animate in update loop
  const progress = Math.min(this.sequenceTime / duration, 1);
  const eased = this.easeInOutCubic(progress);

  this.camera.position.lerpVectors(startPos, targetPos, eased);
  this.camera.lookAt(startPos); // Keep looking at player area
}
```

### 9.7 Fragment Connection Beams (1.5-3.5s)

**Light Beam Effect:**
- [ ] Create beam from player to each collected fragment
- [ ] Use `CylinderGeometry` (thin, tall)
- [ ] Rotate to point from player to fragment
- [ ] Emissive material with additive blending
- [ ] Animate: grow from 0 → full length over 0.5s
- [ ] Hold for 1s, fade out over 0.5s
- [ ] Stagger: 0.2s delay between each beam

**Beam Creation:**
```typescript
private createFragmentBeam(
  start: THREE.Vector3,
  end: THREE.Vector3,
  color: THREE.Color
): THREE.Mesh {
  const distance = start.distanceTo(end);
  const geometry = new THREE.CylinderGeometry(0.1, 0.1, distance, 8);
  const material = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.6,
    blending: THREE.AdditiveBlending,
  });

  const beam = new THREE.Mesh(geometry, material);

  // Position and rotate toward target
  beam.position.copy(start).lerp(end, 0.5);
  beam.lookAt(end);
  beam.rotateX(Math.PI / 2);

  return beam;
}
```

### 9.8 Audio Sequence (Throughout)

**Sound Timeline:**
- [ ] 0.0s: Final collection chime (existing)
- [ ] 0.5s: Whoosh/wind sound (fog clearing)
- [ ] 2.0s: Ambient music shifts to triumphant/uplifting
- [ ] 2.5-3.5s: Firework launch sounds (whoosh)
- [ ] 3.0-4.5s: Firework explosions (pops, crackles)
- [ ] 4.0s: Victory fanfare (musical stinger)
- [ ] 5.0s: Ambience fades for win screen

**Audio Manager Updates:**
- [ ] Add `playVictorySequence()` method
- [ ] Procedural sounds for fireworks (pitch-varied pops)
- [ ] Layered music transition

### 9.9 Win Screen Enhancement

**Background:**
- [ ] City remains visible (dimmed)
- [ ] Win screen semi-transparent overlay
- [ ] Lit buildings shimmer in background
- [ ] Optional: Capture screenshot before dimming

**Animated Stats:**
- [ ] Stats appear with stagger (not all at once)
- [ ] Counter animation (numbers count up)
- [ ] Pulse/glow effect on high scores
- [ ] Confetti particles in UI layer (optional)

---

## Victory Sequence Implementation Strategy

### File Structure

**New File: `src/game/WinSequence.ts`**
```typescript
export class WinSequence {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private fogOfWar: FogOfWar;
  private city: City;
  private player: Player;
  private collectibles: Collectible[];
  private audioManager: AudioManager;
  private composer: EffectComposer;

  private sequenceTime = 0;
  private isPlaying = false;
  private fireworks: Firework[] = [];
  private beams: THREE.Mesh[] = [];
  private godRayPass: ShaderPass | null = null;

  constructor(/*...*/) { }

  async play(playerPos: THREE.Vector3): Promise<void> {
    this.isPlaying = true;

    // Phase 1: Initial impact (0.5s)
    await this.initialImpact();

    // Phase 2-7: Parallel animations
    this.startFogClear(playerPos);
    this.startBuildingLights();
    this.startSkyTransform();
    this.spawnFireworks();
    this.animateCamera(playerPos);
    this.connectFragments(playerPos);

    // Wait for all to complete
    await this.waitForSequence(5500);

    this.isPlaying = false;
  }

  update(delta: number): void {
    if (!this.isPlaying) return;
    this.sequenceTime += delta;

    this.updateFogClear(delta);
    this.updateBuildingLights(delta);
    this.updateSkyTransform(delta);
    this.updateFireworks(delta);
    this.updateCamera(delta);
    this.updateBeams(delta);
  }

  cleanup(): void {
    // Remove all temporary objects
    this.fireworks.forEach(f => f.cleanup());
    this.beams.forEach(b => this.scene.remove(b));
    if (this.godRayPass) this.composer.removePass(this.godRayPass);
  }
}
```

**Integrate into `Game.ts`:**
```typescript
private winSequence: WinSequence;

constructor() {
  // After other initializations
  this.winSequence = new WinSequence(
    this.scene,
    this.camera,
    this.fogOfWar,
    this.city,
    this.player,
    this.collectibles,
    this.audioManager,
    this.composer
  );
}

private async onWin(): Promise<void> {
  const playerPos = this.player.getCurrentPosition();

  // Play epic win sequence
  await this.winSequence.play(playerPos);

  // Then show win screen with stats
  this.showWinScreen();
}

// Update loop
private animate(): void {
  // ... existing code ...

  // Update win sequence if playing
  this.winSequence.update(delta);
}
```

---

## Complexity Tiers

### ⚡ Quick Version (15-20 min)
**Just the essentials:**
- [ ] Fog clears instantly (call `fogOfWar.reset()` but set to clear)
- [ ] Sky shifts to sunset (existing theme change)
- [ ] Brief pause (2s) before win screen
- [ ] **Impact:** Moderate, very quick to implement

### ⭐ Medium Version (30-45 min)
**Noticeable improvement:**
- [ ] Animated fog clear (expanding wave, 2s)
- [ ] Building windows light up progressively
- [ ] Sky transforms to golden
- [ ] Camera zooms out slightly
- [ ] Win screen overlays lit city
- [ ] **Impact:** Good, thematic, satisfying

### 🔥 Full Epic Version (60-90 min)
**Maximum impact:**
- [ ] All medium features
- [ ] Fireworks from tall buildings (5-7 fireworks)
- [ ] God rays from sky (volumetric light shader)
- [ ] Fragment connection beams
- [ ] Upward fog particles (steam effect)
- [ ] Audio sequence with multiple sound cues
- [ ] Cinematic camera movement
- [ ] Animated win screen stats
- [ ] **Impact:** Spectacular, memorable, award-worthy

**Recommended:** Start with ⭐ **Medium**, add 🔥 **Epic** features if time permits

---

## Stretch Goals (If Time Permits)

1. **Multiplayer fog reveal** - See other players' explored areas
2. **Procedural landmarks** - Special buildings that are objectives
3. **Day/night cycle** - Fog behavior changes
4. **Mobile support** - Touch controls
5. **Leaderboard** - Submit scores online

---

## Dependencies

```json
{
  "dependencies": {
    "three": "^0.170.0"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "vite": "^5.0.0",
    "@types/three": "^0.170.0"
  }
}
```

---

## References

- [Three.js Custom Fog Example](https://threejs.org/examples/?q=webgpu#webgpu_custom_fog)
- [Three.js Fog Hacks Article](https://snayss.medium.com/three-js-fog-hacks-fc0b42f63386)
- [Fog of War Implementation](https://medium.com/@travnick/fog-of-war-282c8335a355)
- [PointerLockControls](https://threejs.org/docs/#examples/en/controls/PointerLockControls)
