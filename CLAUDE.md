# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A 3D exploration game built for Global Game Jam 2025. Players navigate a fog-covered procedural city using first-person controls, revealing the map as they explore and collecting data fragments. Built with Three.js, TypeScript, and Vite.

## Development Commands

```bash
# Start dev server (auto-opens browser)
npm run dev

# Build for production (compiles TS + bundles)
npm run build

# Preview production build
npm run preview
```

Note: There are no tests or linting configured in this project.

## Core Architecture

### Game Loop Flow

[main.ts](src/main.ts) → [Game.ts](src/game/Game.ts) (orchestrator) → [Player](src/game/Player.ts), [City](src/game/City.ts), [FogOfWar](src/game/FogOfWar.ts), [Collectible](src/game/Collectible.ts)

**Game.ts** is the central orchestrator that:
- Manages the Three.js renderer, scene, camera, and PointerLockControls
- Owns and coordinates all game systems (Player, City, FogOfWar, Collectibles)
- Runs the animation loop (`animate()` method using `requestAnimationFrame`)
- Updates UI elements (HUD, win screen)
- Handles game state (start, restart, win condition)

### Component Responsibilities

**Player.ts**
- Handles WASD/Arrow keyboard input for movement
- Implements stamina system for sprinting (Shift key)
- Performs collision detection with buildings via `City.checkCollision()`
- Uses PointerLockControls for mouse-look FPS controls
- Returns position each frame for fog clearing

**City.ts**
- Generates procedural city grid with randomized building placement
- Uses THREE.InstancedMesh for efficient rendering of hundreds of buildings
- Implements collision detection (AABB-based with push-out response)
- **Custom shader injection**: Modifies material shader at runtime via `onBeforeCompile` to add fog of war effects
- Buildings get taller toward city center for visual interest

**FogOfWar.ts**
- Manages a 512×512 DataTexture (Uint8Array) representing fog coverage
- Maps world coordinates to texture coordinates for fog queries/updates
- `clearAt()` method paints circular areas on the texture with smooth falloff
- Tracks exploration percentage for scoring
- Texture is updated every frame and passed to building shaders

**Collectible.ts**
- Animated glowing octahedrons with bobbing/rotation
- Includes PointLight for atmospheric glow effect
- Auto-collects when player within 4 units
- Simple visibility toggle on collection (no complex particle system)

### Key Technical Patterns

**Fog of War Shader System**
- FogOfWar creates a DataTexture (512x512, single channel, 0-255 values)
- City material uses `onBeforeCompile` to inject custom shader code
- Fragment shader samples fog texture using world position UVs
- Buildings are tinted gray in fogged areas, reveal color when cleared
- Player position passed as uniform for real-time "clear zone" around player

**Performance Optimization**
- InstancedMesh for all buildings (single draw call for ~300+ buildings)
- Per-instance color variation via `setColorAt()`
- Shadow mapping enabled with PCFSoftShadowMap for quality

**Coordinate System**
- World origin (0,0,0) is city center and player spawn point
- City extends ±200 units (CITY_SIZE = 400)
- Y-axis is up (standard Three.js convention)
- Player height fixed at 5 units
- Buildings use procedural grid with 20-unit spacing

## Configuration & Constants

**Game.ts**
- `CITY_SIZE = 400` (total world size)
- `totalFragments = 7` (win condition)

**Player.ts**
- `WALK_SPEED = 20`, `SPRINT_SPEED = 35`
- `COLLISION_RADIUS = 1.5` (player capsule)
- `MAX_STAMINA = 100`, drains at 25/sec, regens at 15/sec

**FogOfWar.ts**
- Fog texture resolution: 512×512
- Exploration threshold: pixels with value < 128 count as "explored"
- Player clears 25-unit radius each frame

**City.ts**
- Building spawn chance: 70%
- Spawn clear zone: 40-unit radius around origin
- Building size: 8-20 units wide/deep, 15-100+ units tall

**Collectible Spawning**
- Minimum distance between collectibles: 40 units
- First collectible always spawns within 30 units of origin
- Validates positions are not inside buildings and maintain minimum spacing

## HTML Integration

The game integrates with [index.html](index.html) UI elements:
- `#game-container` - Three.js canvas mount point
- `#start-screen` - Click to start, locks pointer
- `#hud` - Shows fragments, timer, exploration %, stamina bar
- `#win-screen` - Displays final time, exploration %, score

Game updates DOM directly via `getElementById()` in `updateUI()` and `onWin()`.

## Shader Modification

When modifying fog of war visuals, edit the shader code in [City.ts](src/game/City.ts) `setupFogShader()` method. The shader:
- Receives `fogMap` (DataTexture), `cityBounds` (vec4), `playerPos` (vec3) uniforms
- Calculates UVs from world position in fragment shader
- Samples fog density and applies real-time player proximity clearing
- Mixes building color with gray fog color based on density

## Adding New Features

**New game mechanics**: Add to Game.ts and call in the `animate()` loop
**New shader effects**: Modify `setupFogShader()` in City.ts or add new materials
**Adjust difficulty**: Tweak constants in respective class files (speeds, radii, counts)
**Sound effects**: Hook into events like `onFragmentCollected()`, player collision, etc.
