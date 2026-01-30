# Unmask the City

> A 3D exploration game for Global Game Jam 2025 | Theme: **Mask**

## Concept

Navigate through a fog-covered procedural city, revealing the world as you explore. Find hidden data fragments scattered throughout the urban landscape. The fog is the city's mask - and you're here to unmask it.

## Gameplay

- **Explore**: Move through a procedurally generated city shrouded in fog
- **Reveal**: Your presence permanently clears the fog around you
- **Collect**: Find 5-10 data fragments hidden in the city
- **Score**: Fastest time + highest exploration % wins

## Controls

- `WASD` / Arrow Keys - Move
- `Mouse` - Look around
- `Shift` - Sprint (limited stamina)
- `Space` - Interact / Collect
- `Esc` - Release mouse / Click to resume
- `T` - Cycle visual themes
- `M` - Mute/unmute audio

## Tech Stack

- **Three.js** - 3D rendering (WebGPU/WebGL)
- **TypeScript** - Type safety
- **Vite** - Fast dev server & build

## Getting Started

```bash
# Install dependencies
npm install

# Run dev server
npm run dev

# Build for production
npm run build
```

## Project Structure

```
unmask-the-city/
├── src/
│   ├── main.ts              # Entry point
│   ├── game/
│   │   ├── Game.ts          # Main game class
│   │   ├── Player.ts        # Player controller
│   │   ├── City.ts          # Procedural city generator
│   │   ├── FogOfWar.ts      # Fog system
│   │   └── Collectible.ts   # Data fragment pickups
│   ├── shaders/
│   │   ├── fog.vert         # Fog vertex shader
│   │   └── fog.frag         # Fog fragment shader
│   └── utils/
│       └── math.ts          # Helper functions
├── public/
│   └── index.html
├── README.md
├── PLAN.md
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## Theme Connection

**Mask** → The fog is Earth's mask, hiding the city below. As you explore, you literally "unmask" the urban landscape, revealing what was hidden. The permanent fog clearing creates a visual record of your journey - a map drawn by your presence.

## Credits

- Built for Global Game Jam 2025
- Three.js Custom Fog example as visual inspiration
- Developer: Richard Fu / Raw Fun Gaming

## License

MIT
