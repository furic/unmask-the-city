# Changelog

All notable changes to Unmask the City will be documented in this file.

## [1.0.0] - 2026-01-31

### 🎮 Initial Release - Global Game Jam 2026

First complete release of Unmask the City, a 3D exploration game built for Global Game Jam 2026.

### ✨ Core Features

#### Gameplay
- First-person exploration with smooth WASD movement
- Procedurally generated city (300+ buildings)
- Fog of war system that permanently reveals explored areas
- Collectible fragments (5 Easy / 7 Normal / 10 Hard difficulty)
- Three difficulty levels with scaled challenges
- Stamina system with sprint mechanics
- Parkour slide mechanic (Ctrl + Sprint)
- Jump ability with stamina cost
- Collision detection with buildings

#### Visual Effects
- Automatic day/night cycle (4 themes: Day, Dusk, Night, Neon)
- Dynamic weather with animated clouds
- Birds during day, bats at night
- Moon with atmospheric lighting
- Particle systems: leaves (parks), steam (vents), embers (corrupted fog)
- Fragment collection effects: particle burst, color tint, slow-motion
- Continuous fireworks during victory sequence
- Building sway animation for tall skyscrapers
- Seasonal tree variations (Spring, Summer, Autumn, Winter)
- Glowing breadcrumb trail showing player path
- Shadow mapping with soft shadows

#### Audio Design
- 100% procedural audio (zero external sound files)
- Surface-specific footsteps (concrete, grass, water)
- Echo/reverb effects near tall buildings
- Distance-based wind (louder in open areas)
- Water ambience near lakes
- Distant traffic rumble
- Night creature sounds (crickets, owls)
- Fragment type-specific collection sounds (common, rare, hidden)
- Milestone chimes (3/7, 5/7 collected)
- Thunder effects during lightning

#### Scoring System
- Base score: Time + Exploration percentage
- Speed Bonus: Collect 2 fragments within 15 seconds (+500)
- Perfect Explorer: All fragments + 90% explored (+2000)
- No Pause Bonus: Complete without pausing (+1000)
- Time Trial: Under 3 minutes on Normal (+1500)

#### UI/UX
- Professional start screen with live 3D city preview
- Loading screen with animated tips
- Game info modal with story and controls
- Local leaderboard (per difficulty, persisted in LocalStorage)
- Real-time HUD: fragments collected, timer, exploration %, stamina bar
- Compass pointing to nearest fragment
- Mini-map showing fragment locations
- Screenshot capability (P key)
- Pause menu with control reference

### 🔧 Technical Implementation

#### Rendering
- Three.js v0.170.0 with WebGL
- Instanced rendering (300+ buildings in 1-2 draw calls)
- Custom shader injection via `onBeforeCompile`
- DataTexture fog system (512×512 texture)
- Shadow mapping with PCFSoftShadowMap
- 60 FPS performance target

#### Architecture
- TypeScript v5.7.0 for type safety
- Vite v6.0.0 for dev server and builds
- Modular game systems (20+ classes)
- Entity-component pattern for game objects
- Procedural generation algorithms

### 📦 Assets
- Zero external image files (all procedural)
- Zero external audio files (Web Audio API synthesis)
- Zero 3D model files (Three.js primitives)
- 6 promotional screenshots (2300×1635)

### 📝 Documentation
- Comprehensive README with badges and demo link
- TECH_STACK.md with detailed technical overview
- TECH_STACK_QUICK.md for quick reference
- TECH_LIST.md with top 20 technologies
- PLAN.md with complete development roadmap
- CLAUDE.md with AI development guidance

### 🎯 Performance
- Smooth 60 FPS on modern hardware
- ~500 KB bundle size (gzipped)
- <200 MB total memory usage
- 4-8ms average frame time
- No lag spikes or stuttering

### 🐛 Known Issues
- Fragments may occasionally spawn near building edges (clearance: 30 units)
- Tree wind animation disabled to prevent visual gaps
- Mobile/touch controls not supported (requires Pointer Lock API)

### 🙏 Credits
- **Developer:** Richard Fu / Raw Fun Gaming
- **Theme:** Mask (Global Game Jam 2026)
- **AI Pair Programming:** Claude Code
- **Inspiration:** Three.js custom fog examples

---

## Future Releases

### Planned Features (Post-GGJ)
- LOD system for distant buildings
- Complete settings menu (graphics, audio, controls)
- Accessibility features (colorblind modes, high contrast)
- Mobile touch controls
- Multiplayer fog reveal
- Additional particle systems

---

**Format:** This changelog follows [Keep a Changelog](https://keepachangelog.com/) principles.

**Versioning:** Uses [Semantic Versioning](https://semver.org/).
