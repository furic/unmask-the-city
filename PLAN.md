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
