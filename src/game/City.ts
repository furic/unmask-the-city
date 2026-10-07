import * as THREE from 'three';
import { FogOfWar } from './FogOfWar';

type BuildingType = 'box' | 'cylinder' | 'pyramid' | 'lshaped';

interface Building {
  position: THREE.Vector3;
  width: number;
  height: number;
  depth: number;
  type: BuildingType;
  hasAntenna: boolean;
  hasWaterTower: boolean;
  hasHelipad: boolean;
  hasGarden: boolean;
  hasSolarPanels: boolean;
  // For L-shaped buildings: wing dimensions
  wingWidth?: number;
  wingDepth?: number;
  wingDirection?: number; // 0-3 for which corner the wing extends
}

type Season = 'spring' | 'summer' | 'autumn' | 'winter';

interface Park {
  position: THREE.Vector3;
  radius: number;
  season: Season; // Each park has a seasonal color theme
}

interface Tree {
  position: THREE.Vector3;
  height: number;
  crownRadius: number;
  season: Season; // Inherited from park
  sizeTier: number; // 0-3 for size variation
}

interface StreetLight {
  position: THREE.Vector3;
}

interface NeonSign {
  position: THREE.Vector3;
  width: number;
  height: number;
  color: number;
  rotation: number;
}

interface Bench {
  position: THREE.Vector3;
  rotation: number;
}

interface TrashBin {
  position: THREE.Vector3;
}

export class City {
  private scene: THREE.Scene;
  private size: number;
  private fogOfWar: FogOfWar;
  private buildings: Building[] = [];
  private parks: Park[] = [];
  private trees: Tree[] = [];
  private streetLights: StreetLight[] = [];
  private neonSigns: NeonSign[] = [];
  private benches: Bench[] = [];
  private trashBins: TrashBin[] = [];
  private boxMeshes: THREE.InstancedMesh | null = null;
  private cylinderMeshes: THREE.InstancedMesh | null = null;
  private pyramidMeshes: THREE.InstancedMesh | null = null;
  private antennaMeshes: THREE.InstancedMesh | null = null;
  private waterTowerMeshes: THREE.InstancedMesh | null = null;
  private helipadMeshes: THREE.InstancedMesh | null = null;
  private gardenMeshes: THREE.InstancedMesh | null = null;
  private solarPanelMeshes: THREE.InstancedMesh | null = null;
  private treeTrunkMeshes: THREE.InstancedMesh | null = null;
  private treeCrownMeshes: THREE.InstancedMesh | null = null;
  private parkGroundMeshes: THREE.Mesh[] = [];
  private streetLightPoleMeshes: THREE.InstancedMesh | null = null;
  private streetLightBulbMeshes: THREE.InstancedMesh | null = null;
  private streetLights3D: THREE.PointLight[] = [];
  private neonSignMeshes: THREE.Mesh[] = [];
  private lshapedWingMeshes: THREE.InstancedMesh | null = null;
  private landmarkTower: THREE.Group | null = null;
  private landmarkPyramid: THREE.Mesh | null = null;
  private landmarkDome: THREE.Mesh | null = null;
  private benchMeshes: THREE.InstancedMesh | null = null;
  private trashBinMeshes: THREE.InstancedMesh | null = null;
  private buildingMaterial: THREE.MeshStandardMaterial;
  private compiledShaders: any[] = []; // Store all compiled shader instances
  private treeShaders: any[] = []; // Store tree shader instances for wind animation
  private treeTrunkMaterial: THREE.MeshStandardMaterial;
  private treeCrownMaterial: THREE.MeshStandardMaterial;
  private streetLightPoleMaterial: THREE.MeshStandardMaterial;
  private streetLightBulbMaterial: THREE.MeshBasicMaterial;
  private buildingDensity: number;
  private water: any; // Water instance for checking water areas

  constructor(scene: THREE.Scene, size: number, fogOfWar: FogOfWar, buildingDensity = 0.7, water?: any) {
    this.scene = scene;
    this.size = size;
    this.fogOfWar = fogOfWar;
    this.buildingDensity = buildingDensity;
    this.water = water;

    // Create building material with fog of war support
    this.buildingMaterial = new THREE.MeshStandardMaterial({
      color: 0x4a4a4a,
      roughness: 0.7,
      metalness: 0.2,
    });

    // Create tree materials
    this.treeTrunkMaterial = new THREE.MeshStandardMaterial({
      color: 0x4a3728,
      roughness: 0.9,
      metalness: 0.0,
    });

    this.treeCrownMaterial = new THREE.MeshStandardMaterial({
      color: 0x2d5a27,
      roughness: 0.8,
      metalness: 0.0,
    });

    // Add wind animation shader to tree crowns
    this.setupTreeWindShader();

    // Create street light materials
    this.streetLightPoleMaterial = new THREE.MeshStandardMaterial({
      color: 0x333333,
      roughness: 0.5,
      metalness: 0.8,
    });

    this.streetLightBulbMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffaa,
    });

    // Hook into shader to add fog of war
    this.setupFogShader();

    // Generate initial city
    this.generate();
  }

  private setupFogShader(): void {
    this.buildingMaterial.onBeforeCompile = (shader) => {
      // Add uniforms
      shader.uniforms.fogMap = { value: this.fogOfWar.getTexture() };
      shader.uniforms.corruptionMap = { value: this.fogOfWar.getCorruptionTexture() };
      shader.uniforms.cityBounds = {
        value: new THREE.Vector4(
          -this.size / 2, -this.size / 2,
          this.size / 2, this.size / 2
        )
      };
      shader.uniforms.playerPos = { value: new THREE.Vector3() };
      shader.uniforms.nightAmount = { value: 0.0 }; // 0 = day, 1 = full night
      shader.uniforms.uTime = { value: 0.0 }; // For sway animation

      // Add varying for world position and sway
      shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        `
        #include <common>
        varying vec3 vWorldPos;
        uniform float uTime;
        `
      );

      shader.vertexShader = shader.vertexShader.replace(
        '#include <worldpos_vertex>',
        `
        #include <worldpos_vertex>
        vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;

        // Building sway animation - taller buildings sway more
        float height = vWorldPos.y;
        float swayAmount = height * 0.0008; // Subtle sway based on height
        float swaySpeed = 0.5;
        vec2 buildingId = floor(vWorldPos.xz / 30.0); // Unique ID per building area
        float phase = dot(buildingId, vec2(12.9898, 78.233));
        float swayX = sin(uTime * swaySpeed + phase) * swayAmount;
        float swayZ = cos(uTime * swaySpeed * 0.7 + phase * 1.3) * swayAmount * 0.7;

        // Apply sway to world position (only affects position, not vWorldPos for lighting)
        gl_Position.x += swayX;
        gl_Position.z += swayZ;
        `
      );

      // Add fog of war to fragment shader
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <common>',
        `
        #include <common>
        uniform sampler2D fogMap;
        uniform sampler2D corruptionMap;
        uniform vec4 cityBounds;
        uniform vec3 playerPos;
        uniform float nightAmount;
        varying vec3 vWorldPos;

        // Simple hash function for pseudo-random window lighting
        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }

        uniform float uTime;
        `
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <fog_fragment>',
        `
        // Procedural floor lines
        float floorHeight = 4.0;
        float lineWidth = 0.15;
        float floorY = mod(vWorldPos.y, floorHeight);
        float floorLine = smoothstep(0.0, lineWidth, floorY) * (1.0 - smoothstep(floorHeight - lineWidth, floorHeight, floorY));

        // Window grid
        float windowSpacingX = 3.0;
        float windowSpacingY = 4.0;
        float windowWidth = 1.8;
        float windowHeight = 2.5;

        // Calculate window cell
        vec2 windowCell = floor(vec2(vWorldPos.x + vWorldPos.z, vWorldPos.y) / vec2(windowSpacingX, windowSpacingY));
        vec2 windowUV = mod(vec2(vWorldPos.x + vWorldPos.z, vWorldPos.y), vec2(windowSpacingX, windowSpacingY));

        // Check if we're inside a window
        float inWindowX = step(0.5, windowUV.x) * step(windowUV.x, windowWidth + 0.5);
        float inWindowY = step(0.7, windowUV.y) * step(windowUV.y, windowHeight + 0.7);
        float inWindow = inWindowX * inWindowY;

        // Random window lighting (some windows are lit at night)
        float windowRand = hash(windowCell);
        float windowLit = step(0.5, windowRand) * inWindow * nightAmount; // More windows lit (50% instead of 40%)

        // Window light colors (warm yellow/orange) with variety
        vec3 windowLightColor = mix(vec3(1.0, 0.9, 0.6), vec3(1.0, 0.7, 0.4), windowRand);

        // Brightness variation - some windows are brighter than others
        float brightnessVariation = 0.7 + windowRand * 0.5; // 0.7 to 1.2

        // Subtle flicker effect for some windows (10% chance)
        float flickerWindow = step(0.9, windowRand);
        float flicker = 1.0 + flickerWindow * sin(uTime * 10.0 + windowRand * 100.0) * 0.15;

        // Enhanced night glow - brighter at full night
        float glowIntensity = 0.85 * brightnessVariation * flicker * (1.0 + nightAmount * 0.5);

        // Apply window lighting with enhanced glow
        gl_FragColor.rgb = mix(gl_FragColor.rgb, windowLightColor * 1.2, windowLit * glowIntensity);

        // AO effect for non-lit windows
        float windowPattern = 1.0 - inWindow * (1.0 - windowLit);
        float aoEffect = mix(0.8, 1.0, floorLine * 0.5 + windowPattern * 0.3);
        gl_FragColor.rgb *= aoEffect;

        // Fog of war calculation
        vec2 fowUV = (vWorldPos.xz - cityBounds.xy) / (cityBounds.zw - cityBounds.xy);
        fowUV = clamp(fowUV, 0.0, 1.0);
        float fowDensity = texture2D(fogMap, fowUV).r;
        float corruption = texture2D(corruptionMap, fowUV).r;

        // Player proximity (real-time clear zone)
        float distToPlayer = length(vWorldPos.xz - playerPos.xz);
        float playerClear = 1.0 - smoothstep(15.0, 30.0, distToPlayer);
        fowDensity = min(fowDensity, 1.0 - playerClear);

        // Apply fog of war with corruption tint
        vec3 fowColor = vec3(0.83, 0.83, 0.85);
        vec3 corruptedColor = vec3(0.6, 0.2, 0.2); // Dark red for corrupted areas
        vec3 finalFogColor = mix(fowColor, corruptedColor, corruption);
        gl_FragColor.rgb = mix(gl_FragColor.rgb, finalFogColor, fowDensity * 0.9);

        #include <fog_fragment>
        `
      );

      // Store shader reference for updates
      this.compiledShaders.push(shader);
    };
  }

  private setupTreeWindShader(): void {
    this.treeCrownMaterial.onBeforeCompile = (shader) => {
      // Add time uniform for wind animation
      shader.uniforms.uTime = { value: 0.0 };

      // Add varying and uniform declarations
      shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        `
        #include <common>
        uniform float uTime;
        `
      );

      // Add wind displacement in world space
      shader.vertexShader = shader.vertexShader.replace(
        '#include <worldpos_vertex>',
        `
        #include <worldpos_vertex>

        // Wind animation for tree crowns
        vec3 worldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;

        // Use position for unique phase per tree
        float treeId = worldPos.x * 0.1 + worldPos.z * 0.13;

        // Primary wind sway
        float windSpeed = 1.2;
        float windStrength = 0.4;
        float primaryWind = sin(uTime * windSpeed + treeId) * windStrength;

        // Secondary faster rustling
        float rustleSpeed = 3.5;
        float rustleStrength = 0.15;
        float rustle = sin(uTime * rustleSpeed + treeId * 2.0) * rustleStrength;

        // Combined displacement - more at top of crown
        float heightFactor = max(0.0, transformed.y) * 0.3;
        float totalSway = (primaryWind + rustle) * heightFactor;

        // Apply to gl_Position for visual sway
        gl_Position.x += totalSway;
        gl_Position.z += totalSway * 0.6;
        `
      );

      // Store shader reference for updates
      this.treeShaders.push(shader);
    };
  }

  updateFogUniforms(playerPos?: THREE.Vector3, nightAmount = 0, time = 0): void {
    // Update all compiled shaders (box, cylinder, pyramid, etc.)
    this.compiledShaders.forEach(shader => {
      if (shader && shader.uniforms) {
        shader.uniforms.fogMap.value = this.fogOfWar.getTexture();
        shader.uniforms.fogMap.value.needsUpdate = true;
        shader.uniforms.corruptionMap.value = this.fogOfWar.getCorruptionTexture();
        shader.uniforms.corruptionMap.value.needsUpdate = true;
        shader.uniforms.nightAmount.value = nightAmount;
        shader.uniforms.uTime.value = time;
        if (playerPos) {
          shader.uniforms.playerPos.value.copy(playerPos);
        }
      }
    });

    // Update tree wind animation shaders
    this.treeShaders.forEach(shader => {
      if (shader && shader.uniforms && shader.uniforms.uTime) {
        shader.uniforms.uTime.value = time;
      }
    });
  }

  generate(): void {
    this.buildings = [];
    this.parks = [];
    this.trees = [];
    this.streetLights = [];
    this.neonSigns = [];
    this.benches = [];
    this.trashBins = [];
    const halfSize = this.size / 2;
    const gridSize = 25; // Space between potential building spots (increased to prevent overlap)
    const buildingChance = this.buildingDensity;

    // Clear spawn area
    const spawnClearRadius = 40;

    // Generate parks first (4-6 parks scattered around the city)
    const numParks = 4 + Math.floor(Math.random() * 3);
    for (let i = 0; i < numParks; i++) {
      // Place parks in different quadrants
      const angle = (i / numParks) * Math.PI * 2 + Math.random() * 0.5;
      const distance = 80 + Math.random() * (halfSize - 120);
      const parkX = Math.cos(angle) * distance;
      const parkZ = Math.sin(angle) * distance;
      const parkRadius = 30 + Math.random() * 20;

      // Assign a random season to each park for visual variety
      const seasons: Season[] = ['spring', 'summer', 'autumn', 'winter'];
      const parkSeason = seasons[i % seasons.length]; // Cycle through seasons

      this.parks.push({
        position: new THREE.Vector3(parkX, 0, parkZ),
        radius: parkRadius,
        season: parkSeason,
      });

      // Generate trees in park with varied sizes (4 size tiers)
      const treesInPark = 8 + Math.floor(Math.random() * 12);
      for (let t = 0; t < treesInPark; t++) {
        const treeAngle = Math.random() * Math.PI * 2;
        const treeDist = Math.random() * (parkRadius - 5);
        const treeX = parkX + Math.cos(treeAngle) * treeDist;
        const treeZ = parkZ + Math.sin(treeAngle) * treeDist;

        // Size tiers: 0=small, 1=medium, 2=large, 3=extra large
        const sizeTier = Math.floor(Math.random() * 4);
        const sizeMultipliers = [0.6, 0.85, 1.1, 1.4];
        const sizeMultiplier = sizeMultipliers[sizeTier];

        this.trees.push({
          position: new THREE.Vector3(treeX, 0, treeZ),
          height: (6 + Math.random() * 6) * sizeMultiplier,
          crownRadius: (3 + Math.random() * 2) * sizeMultiplier,
          season: parkSeason,
          sizeTier,
        });
      }

      // Generate benches in park (2-4 per park, along the edge)
      const benchesInPark = 2 + Math.floor(Math.random() * 3);
      for (let b = 0; b < benchesInPark; b++) {
        const benchAngle = (b / benchesInPark) * Math.PI * 2 + Math.random() * 0.5;
        const benchDist = parkRadius * (0.5 + Math.random() * 0.3); // Inner half of park
        const benchX = parkX + Math.cos(benchAngle) * benchDist;
        const benchZ = parkZ + Math.sin(benchAngle) * benchDist;

        this.benches.push({
          position: new THREE.Vector3(benchX, 0, benchZ),
          rotation: benchAngle + Math.PI / 2, // Face towards center
        });
      }

      // Generate trash bins near benches (1-2 per park)
      const binsInPark = 1 + Math.floor(Math.random() * 2);
      for (let b = 0; b < binsInPark; b++) {
        const binAngle = Math.random() * Math.PI * 2;
        const binDist = parkRadius * (0.3 + Math.random() * 0.4);
        const binX = parkX + Math.cos(binAngle) * binDist;
        const binZ = parkZ + Math.sin(binAngle) * binDist;

        this.trashBins.push({
          position: new THREE.Vector3(binX, 0, binZ),
        });
      }
    }

    for (let x = -halfSize + 10; x < halfSize - 10; x += gridSize) {
      for (let z = -halfSize + 10; z < halfSize - 10; z += gridSize) {
        // Skip spawn area
        if (Math.abs(x) < spawnClearRadius && Math.abs(z) < spawnClearRadius) {
          continue;
        }

        // Skip park areas
        if (this.isInPark(new THREE.Vector3(x, 0, z))) {
          continue;
        }

        // Skip water areas
        if (this.water && this.water.isInWater(new THREE.Vector3(x, 0, z))) {
          continue;
        }

        // Random chance to place building
        if (Math.random() > buildingChance) continue;

        // Random offset within grid cell
        const offsetX = (Math.random() - 0.5) * (gridSize * 0.5);
        const offsetZ = (Math.random() - 0.5) * (gridSize * 0.5);

        // Height varies by distance from center (taller towards center)
        const distFromCenter = Math.sqrt(x * x + z * z);
        const normalizedDist = distFromCenter / halfSize;
        const heightMultiplier = 1 + (1 - normalizedDist) * 2;
        const height = (15 + Math.random() * 40) * heightMultiplier;

        // Determine building type based on location
        let type: BuildingType = 'box';
        if (normalizedDist < 0.3 && height > 60 && Math.random() < 0.4) {
          // City center: tall cylinders (skyscrapers)
          type = 'cylinder';
        } else if (normalizedDist > 0.6 && Math.random() < 0.15) {
          // Outer areas: pyramids disabled due to collision issues
          // type = 'pyramid';
          type = 'box'; // Use box instead
        } else if (normalizedDist > 0.3 && normalizedDist < 0.7 && Math.random() < 0.12) {
          // Mid-range: L-shaped buildings
          type = 'lshaped';
        }

        // Building dimensions based on type
        let width: number, depth: number;
        if (type === 'cylinder') {
          // Cylinders use radius, make them narrower
          width = 6 + Math.random() * 8;
          depth = width; // Square footprint for cylinder
        } else {
          width = 8 + Math.random() * 12;
          depth = 8 + Math.random() * 12;
        }

        // Rooftop props (only on box buildings)
        const hasAntenna = type === 'box' && height > 50 && Math.random() < 0.15;
        const hasWaterTower = type === 'box' && height > 30 && height < 60 && Math.random() < 0.1;
        // New rooftop details
        const hasHelipad = type === 'box' && height > 70 && width > 12 && depth > 12 && Math.random() < 0.2;
        const hasGarden = type === 'box' && height > 20 && height < 50 && width > 10 && Math.random() < 0.12;
        const hasSolarPanels = type === 'box' && height < 40 && width > 10 && Math.random() < 0.15;

        // L-shaped building wings
        let wingWidth, wingDepth, wingDirection;
        if (type === 'lshaped') {
          wingWidth = width * (0.4 + Math.random() * 0.3);
          wingDepth = depth * (0.5 + Math.random() * 0.3);
          wingDirection = Math.floor(Math.random() * 4);
        }

        this.buildings.push({
          position: new THREE.Vector3(x + offsetX, height / 2, z + offsetZ),
          width,
          height,
          depth,
          type,
          hasAntenna,
          hasWaterTower,
          hasHelipad,
          hasGarden,
          hasSolarPanels,
          wingWidth,
          wingDepth,
          wingDirection,
        });

        // Add neon signs to some box buildings (10% chance for performance)
        if (type === 'box' && height > 25 && Math.random() < 0.1) {
          const signHeight = 3 + Math.random() * 4;
          const signWidth = width * (0.3 + Math.random() * 0.4);
          const signY = height * (0.3 + Math.random() * 0.5);
          // Pick a random side (0-3)
          const side = Math.floor(Math.random() * 4);
          let signX = x + offsetX;
          let signZ = z + offsetZ;
          let rotation = 0;

          if (side === 0) {
            signZ += depth / 2 + 0.1;
            rotation = 0;
          } else if (side === 1) {
            signZ -= depth / 2 + 0.1;
            rotation = Math.PI;
          } else if (side === 2) {
            signX += width / 2 + 0.1;
            rotation = Math.PI / 2;
          } else {
            signX -= width / 2 + 0.1;
            rotation = -Math.PI / 2;
          }

          // Neon colors
          const neonColors = [0xff00ff, 0x00ffff, 0xff6600, 0x00ff00, 0xff0066];
          const color = neonColors[Math.floor(Math.random() * neonColors.length)];

          this.neonSigns.push({
            position: new THREE.Vector3(signX, signY, signZ),
            width: signWidth,
            height: signHeight,
            color,
            rotation,
          });
        }
      }
    }

    // Generate street lights along grid lines
    for (let x = -halfSize + gridSize / 2; x < halfSize; x += gridSize) {
      for (let z = -halfSize + gridSize / 2; z < halfSize; z += gridSize) {
        // Skip spawn area
        if (Math.abs(x) < spawnClearRadius && Math.abs(z) < spawnClearRadius) {
          continue;
        }

        // Skip park areas
        if (this.isInPark(new THREE.Vector3(x, 0, z))) {
          continue;
        }

        // Check if there's a building nearby (avoid placing lights too close)
        const tooCloseToBuilding = this.buildings.some((b) => {
          const dx = Math.abs(b.position.x - x);
          const dz = Math.abs(b.position.z - z);
          return dx < b.width / 2 + 3 && dz < b.depth / 2 + 3;
        });

        if (!tooCloseToBuilding && Math.random() < 0.15) {
          this.streetLights.push({
            position: new THREE.Vector3(x, 0, z),
          });
        }
      }
    }

    this.createMeshes();
  }

  regenerate(): void {
    // Remove old meshes
    const meshesToRemove = [
      this.boxMeshes,
      this.cylinderMeshes,
      this.pyramidMeshes,
      this.antennaMeshes,
      this.waterTowerMeshes,
      this.helipadMeshes,
      this.gardenMeshes,
      this.solarPanelMeshes,
      this.treeTrunkMeshes,
      this.treeCrownMeshes,
      this.streetLightPoleMeshes,
      this.streetLightBulbMeshes,
      this.benchMeshes,
      this.trashBinMeshes,
    ];

    meshesToRemove.forEach((mesh) => {
      if (mesh) {
        this.scene.remove(mesh);
        mesh.geometry.dispose();
      }
    });

    // Remove park grounds
    this.parkGroundMeshes.forEach((mesh) => {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    });
    this.parkGroundMeshes = [];

    // Remove street light point lights
    this.streetLights3D.forEach((light) => {
      this.scene.remove(light);
    });
    this.streetLights3D = [];

    // Remove neon signs
    this.neonSignMeshes.forEach((mesh) => {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    });
    this.neonSignMeshes = [];

    // Remove L-shaped wings
    if (this.lshapedWingMeshes) {
      this.scene.remove(this.lshapedWingMeshes);
      this.lshapedWingMeshes.geometry.dispose();
      this.lshapedWingMeshes = null;
    }

    // Remove landmark tower
    if (this.landmarkTower) {
      this.scene.remove(this.landmarkTower);
      this.landmarkTower.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          (child.material as THREE.Material).dispose();
        }
      });
      this.landmarkTower = null;
    }

    // Remove landmark pyramid
    if (this.landmarkPyramid) {
      this.scene.remove(this.landmarkPyramid);
      this.landmarkPyramid.geometry.dispose();
      (this.landmarkPyramid.material as THREE.Material).dispose();
      this.landmarkPyramid = null;
    }

    // Remove landmark dome
    if (this.landmarkDome) {
      this.scene.remove(this.landmarkDome);
      this.landmarkDome.geometry.dispose();
      (this.landmarkDome.material as THREE.Material).dispose();
      this.landmarkDome = null;
    }

    // Generate new city
    this.generate();
  }

  /**
   * Get district-based color for a building at given position
   * Divides city into 4 quadrants with different color themes
   */
  private getDistrictColor(position: THREE.Vector3, baseShade: number): { r: number; g: number; b: number } {
    // Determine quadrant (district)
    const isNorth = position.z < 0;
    const isEast = position.x > 0;

    // Base shade variation
    const shade = baseShade + Math.random() * 0.15;

    // District color themes (subtle tints)
    if (isNorth && isEast) {
      // Northeast: Financial district - bluish steel
      return {
        r: shade * 0.85,
        g: shade * 0.9,
        b: shade + 0.05
      };
    } else if (isNorth && !isEast) {
      // Northwest: Industrial - warmer grays with slight brown
      return {
        r: shade + 0.03,
        g: shade * 0.95,
        b: shade * 0.9
      };
    } else if (!isNorth && isEast) {
      // Southeast: Modern district - cooler grays
      return {
        r: shade * 0.9,
        g: shade * 0.92,
        b: shade + 0.02
      };
    } else {
      // Southwest: Old town - warmer tones
      return {
        r: shade + 0.02,
        g: shade * 0.98,
        b: shade * 0.92
      };
    }
  }

  private createMeshes(): void {
    // Count buildings by type
    // Pyramid and L-shaped buildings also need a box base, so include them
    const boxBuildings = this.buildings.filter((b) => b.type === 'box' || b.type === 'pyramid' || b.type === 'lshaped');
    const cylinderBuildings = this.buildings.filter((b) => b.type === 'cylinder');
    const pyramidBuildings = this.buildings.filter((b) => b.type === 'pyramid');
    const lshapedBuildings = this.buildings.filter((b) => b.type === 'lshaped');
    const antennaBuildings = this.buildings.filter((b) => b.hasAntenna);
    const waterTowerBuildings = this.buildings.filter((b) => b.hasWaterTower);

    // Create geometries
    const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
    const cylinderGeometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 16);
    const pyramidGeometry = new THREE.ConeGeometry(0.5, 1, 4);
    const antennaGeometry = new THREE.CylinderGeometry(0.02, 0.02, 1, 6);
    const waterTowerGeometry = new THREE.CylinderGeometry(0.3, 0.3, 0.5, 8);

    const matrix = new THREE.Matrix4();
    const scaleMatrix = new THREE.Matrix4();
    const posMatrix = new THREE.Matrix4();
    const color = new THREE.Color();

    // Create box buildings
    if (boxBuildings.length > 0) {
      this.boxMeshes = new THREE.InstancedMesh(
        boxGeometry,
        this.buildingMaterial,
        boxBuildings.length
      );
      this.boxMeshes.castShadow = true;
      this.boxMeshes.receiveShadow = true;

      boxBuildings.forEach((building, i) => {
        scaleMatrix.makeScale(building.width, building.height, building.depth);
        posMatrix.makeTranslation(building.position.x, building.position.y, building.position.z);
        matrix.multiplyMatrices(posMatrix, scaleMatrix);
        this.boxMeshes!.setMatrixAt(i, matrix);

        // District-based color variation
        const districtColor = this.getDistrictColor(building.position, 0.3);
        color.setRGB(districtColor.r, districtColor.g, districtColor.b);
        this.boxMeshes!.setColorAt(i, color);
      });

      this.boxMeshes.instanceMatrix.needsUpdate = true;
      if (this.boxMeshes.instanceColor) this.boxMeshes.instanceColor.needsUpdate = true;
      this.scene.add(this.boxMeshes);
    }

    // Create cylinder buildings (towers)
    if (cylinderBuildings.length > 0) {
      this.cylinderMeshes = new THREE.InstancedMesh(
        cylinderGeometry,
        this.buildingMaterial,
        cylinderBuildings.length
      );
      this.cylinderMeshes.castShadow = true;
      this.cylinderMeshes.receiveShadow = true;

      cylinderBuildings.forEach((building, i) => {
        scaleMatrix.makeScale(building.width, building.height, building.width);
        posMatrix.makeTranslation(building.position.x, building.position.y, building.position.z);
        matrix.multiplyMatrices(posMatrix, scaleMatrix);
        this.cylinderMeshes!.setMatrixAt(i, matrix);

        // Glass towers with district tint + extra blue
        const districtColor = this.getDistrictColor(building.position, 0.35);
        color.setRGB(districtColor.r * 0.95, districtColor.g * 0.97, districtColor.b + 0.03);
        this.cylinderMeshes!.setColorAt(i, color);
      });

      this.cylinderMeshes.instanceMatrix.needsUpdate = true;
      if (this.cylinderMeshes.instanceColor) this.cylinderMeshes.instanceColor.needsUpdate = true;
      this.scene.add(this.cylinderMeshes);
    }

    // Create pyramid-topped buildings
    if (pyramidBuildings.length > 0) {
      this.pyramidMeshes = new THREE.InstancedMesh(
        pyramidGeometry,
        this.buildingMaterial,
        pyramidBuildings.length
      );
      this.pyramidMeshes.castShadow = true;

      pyramidBuildings.forEach((building, i) => {
        // Pyramid sits on top of building
        const pyramidHeight = building.height * 0.3;
        const pyramidY = building.position.y + building.height / 2 + pyramidHeight / 2;

        // Use average of width/depth so pyramid base better matches building footprint
        const pyramidBase = (building.width + building.depth) / 2 * 0.98;

        scaleMatrix.makeScale(pyramidBase, pyramidHeight, pyramidBase);
        posMatrix.makeTranslation(building.position.x, pyramidY, building.position.z);
        matrix.multiplyMatrices(posMatrix, scaleMatrix);
        this.pyramidMeshes!.setMatrixAt(i, matrix);

        // Reddish tint for pyramid roofs
        const shade = 0.35 + Math.random() * 0.1;
        color.setRGB(shade + 0.05, shade, shade - 0.02);
        this.pyramidMeshes!.setColorAt(i, color);
      });

      this.pyramidMeshes.instanceMatrix.needsUpdate = true;
      if (this.pyramidMeshes.instanceColor) this.pyramidMeshes.instanceColor.needsUpdate = true;
      this.scene.add(this.pyramidMeshes);
    }

    // Create antennas
    if (antennaBuildings.length > 0) {
      this.antennaMeshes = new THREE.InstancedMesh(
        antennaGeometry,
        this.buildingMaterial,
        antennaBuildings.length
      );

      antennaBuildings.forEach((building, i) => {
        const antennaHeight = 8 + Math.random() * 6;
        const antennaY = building.position.y + building.height / 2 + antennaHeight / 2;

        scaleMatrix.makeScale(1, antennaHeight, 1);
        posMatrix.makeTranslation(building.position.x, antennaY, building.position.z);
        matrix.multiplyMatrices(posMatrix, scaleMatrix);
        this.antennaMeshes!.setMatrixAt(i, matrix);

        color.setRGB(0.2, 0.2, 0.2);
        this.antennaMeshes!.setColorAt(i, color);
      });

      this.antennaMeshes.instanceMatrix.needsUpdate = true;
      if (this.antennaMeshes.instanceColor) this.antennaMeshes.instanceColor.needsUpdate = true;
      this.scene.add(this.antennaMeshes);
    }

    // Create water towers
    if (waterTowerBuildings.length > 0) {
      this.waterTowerMeshes = new THREE.InstancedMesh(
        waterTowerGeometry,
        this.buildingMaterial,
        waterTowerBuildings.length
      );

      waterTowerBuildings.forEach((building, i) => {
        const towerScale = 4 + Math.random() * 2;
        const towerY = building.position.y + building.height / 2 + towerScale * 0.25 + 1;
        // Offset from center
        const offsetX = (Math.random() - 0.5) * building.width * 0.4;
        const offsetZ = (Math.random() - 0.5) * building.depth * 0.4;

        scaleMatrix.makeScale(towerScale, towerScale, towerScale);
        posMatrix.makeTranslation(
          building.position.x + offsetX,
          towerY,
          building.position.z + offsetZ
        );
        matrix.multiplyMatrices(posMatrix, scaleMatrix);
        this.waterTowerMeshes!.setMatrixAt(i, matrix);

        color.setRGB(0.25, 0.25, 0.28);
        this.waterTowerMeshes!.setColorAt(i, color);
      });

      this.waterTowerMeshes.instanceMatrix.needsUpdate = true;
      if (this.waterTowerMeshes.instanceColor) this.waterTowerMeshes.instanceColor.needsUpdate = true;
      this.scene.add(this.waterTowerMeshes);
    }

    // Create helipads (white circle with H marking - simplified as flat cylinder)
    const helipadBuildings = this.buildings.filter((b) => b.hasHelipad);
    if (helipadBuildings.length > 0) {
      const helipadGeometry = new THREE.CylinderGeometry(1, 1, 0.1, 16);
      const helipadMaterial = new THREE.MeshStandardMaterial({
        color: 0xcccccc,
        roughness: 0.8,
        metalness: 0.1,
      });
      this.helipadMeshes = new THREE.InstancedMesh(
        helipadGeometry,
        helipadMaterial,
        helipadBuildings.length
      );

      helipadBuildings.forEach((building, i) => {
        const padScale = Math.min(building.width, building.depth) * 0.35;
        const padY = building.position.y + building.height / 2 + 0.1;

        scaleMatrix.makeScale(padScale, 1, padScale);
        posMatrix.makeTranslation(building.position.x, padY, building.position.z);
        matrix.multiplyMatrices(posMatrix, scaleMatrix);
        this.helipadMeshes!.setMatrixAt(i, matrix);

        // Slight color variation
        color.setRGB(0.75 + Math.random() * 0.1, 0.75 + Math.random() * 0.1, 0.75 + Math.random() * 0.1);
        this.helipadMeshes!.setColorAt(i, color);
      });

      this.helipadMeshes.instanceMatrix.needsUpdate = true;
      if (this.helipadMeshes.instanceColor) this.helipadMeshes.instanceColor.needsUpdate = true;
      this.scene.add(this.helipadMeshes);
    }

    // Create rooftop gardens (green squares)
    const gardenBuildings = this.buildings.filter((b) => b.hasGarden);
    if (gardenBuildings.length > 0) {
      const gardenGeometry = new THREE.BoxGeometry(1, 0.3, 1);
      const gardenMaterial = new THREE.MeshStandardMaterial({
        color: 0x3d6b3d,
        roughness: 0.9,
        metalness: 0.0,
      });
      this.gardenMeshes = new THREE.InstancedMesh(
        gardenGeometry,
        gardenMaterial,
        gardenBuildings.length
      );

      gardenBuildings.forEach((building, i) => {
        const gardenW = building.width * (0.5 + Math.random() * 0.3);
        const gardenD = building.depth * (0.5 + Math.random() * 0.3);
        const gardenY = building.position.y + building.height / 2 + 0.15;
        // Offset from center
        const offsetX = (Math.random() - 0.5) * (building.width - gardenW) * 0.6;
        const offsetZ = (Math.random() - 0.5) * (building.depth - gardenD) * 0.6;

        scaleMatrix.makeScale(gardenW, 1, gardenD);
        posMatrix.makeTranslation(building.position.x + offsetX, gardenY, building.position.z + offsetZ);
        matrix.multiplyMatrices(posMatrix, scaleMatrix);
        this.gardenMeshes!.setMatrixAt(i, matrix);

        // Varied green colors
        const greenShade = 0.25 + Math.random() * 0.15;
        color.setRGB(greenShade * 0.6, greenShade + 0.1, greenShade * 0.5);
        this.gardenMeshes!.setColorAt(i, color);
      });

      this.gardenMeshes.instanceMatrix.needsUpdate = true;
      if (this.gardenMeshes.instanceColor) this.gardenMeshes.instanceColor.needsUpdate = true;
      this.scene.add(this.gardenMeshes);
    }

    // Create solar panels (dark blue/black rectangles)
    const solarBuildings = this.buildings.filter((b) => b.hasSolarPanels);
    if (solarBuildings.length > 0) {
      const solarGeometry = new THREE.BoxGeometry(1, 0.15, 1);
      const solarMaterial = new THREE.MeshStandardMaterial({
        color: 0x1a2a4a,
        roughness: 0.3,
        metalness: 0.6,
      });
      this.solarPanelMeshes = new THREE.InstancedMesh(
        solarGeometry,
        solarMaterial,
        solarBuildings.length
      );

      solarBuildings.forEach((building, i) => {
        const panelW = building.width * (0.6 + Math.random() * 0.2);
        const panelD = building.depth * (0.6 + Math.random() * 0.2);
        const panelY = building.position.y + building.height / 2 + 0.2;
        // Offset from center (usually on one side)
        const offsetX = (Math.random() - 0.5) * (building.width - panelW) * 0.4;
        const offsetZ = (Math.random() - 0.5) * (building.depth - panelD) * 0.4;

        scaleMatrix.makeScale(panelW, 1, panelD);
        posMatrix.makeTranslation(building.position.x + offsetX, panelY, building.position.z + offsetZ);
        matrix.multiplyMatrices(posMatrix, scaleMatrix);
        this.solarPanelMeshes!.setMatrixAt(i, matrix);

        // Dark blue/purple variation
        const shade = 0.1 + Math.random() * 0.1;
        color.setRGB(shade, shade * 1.3, shade * 2);
        this.solarPanelMeshes!.setColorAt(i, color);
      });

      this.solarPanelMeshes.instanceMatrix.needsUpdate = true;
      if (this.solarPanelMeshes.instanceColor) this.solarPanelMeshes.instanceColor.needsUpdate = true;
      this.scene.add(this.solarPanelMeshes);
    }

    // Create L-shaped building wings
    if (lshapedBuildings.length > 0) {
      const wingGeometry = new THREE.BoxGeometry(1, 1, 1);
      this.lshapedWingMeshes = new THREE.InstancedMesh(
        wingGeometry,
        this.buildingMaterial,
        lshapedBuildings.length
      );
      this.lshapedWingMeshes.castShadow = true;
      this.lshapedWingMeshes.receiveShadow = true;

      lshapedBuildings.forEach((building, i) => {
        const wingW = building.wingWidth || building.width * 0.5;
        const wingD = building.wingDepth || building.depth * 0.5;
        const wingH = building.height * (0.6 + Math.random() * 0.3); // Slightly shorter wing

        // Calculate wing position based on direction
        let wingX = building.position.x;
        let wingZ = building.position.z;
        const dir = building.wingDirection || 0;

        if (dir === 0) {
          wingX += building.width / 2 + wingW / 2 - 1;
          wingZ += building.depth / 2 - wingD / 2;
        } else if (dir === 1) {
          wingX -= building.width / 2 + wingW / 2 - 1;
          wingZ += building.depth / 2 - wingD / 2;
        } else if (dir === 2) {
          wingX += building.width / 2 - wingW / 2;
          wingZ -= building.depth / 2 + wingD / 2 - 1;
        } else {
          wingX -= building.width / 2 + wingW / 2 - 1;
          wingZ -= building.depth / 2 + wingD / 2 - 1;
        }

        scaleMatrix.makeScale(wingW, wingH, wingD);
        posMatrix.makeTranslation(wingX, wingH / 2, wingZ);
        matrix.multiplyMatrices(posMatrix, scaleMatrix);
        this.lshapedWingMeshes!.setMatrixAt(i, matrix);

        const shade = 0.3 + Math.random() * 0.2;
        color.setRGB(shade, shade, shade + 0.02);
        this.lshapedWingMeshes!.setColorAt(i, color);
      });

      this.lshapedWingMeshes.instanceMatrix.needsUpdate = true;
      if (this.lshapedWingMeshes.instanceColor) this.lshapedWingMeshes.instanceColor.needsUpdate = true;
      this.scene.add(this.lshapedWingMeshes);
    }

    // Create park grounds
    this.parks.forEach((park) => {
      const groundGeometry = new THREE.CircleGeometry(park.radius, 32);
      const groundMaterial = new THREE.MeshStandardMaterial({
        color: 0x3d6b35,
        roughness: 0.9,
        metalness: 0.0,
      });
      const groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
      groundMesh.rotation.x = -Math.PI / 2;
      groundMesh.position.set(park.position.x, 0.05, park.position.z);
      groundMesh.receiveShadow = true;
      this.parkGroundMeshes.push(groundMesh);
      this.scene.add(groundMesh);
    });

    // Create tree trunks (static, no animation to avoid gaps)
    if (this.trees.length > 0) {
      const trunkGeometry = new THREE.CylinderGeometry(0.3, 0.4, 1, 8);
      this.treeTrunkMeshes = new THREE.InstancedMesh(
        trunkGeometry,
        this.treeTrunkMaterial,
        this.trees.length
      );
      this.treeTrunkMeshes.castShadow = true;

      this.trees.forEach((tree, i) => {
        const trunkHeight = tree.height * 0.5;
        scaleMatrix.makeScale(1, trunkHeight, 1);
        posMatrix.makeTranslation(tree.position.x, trunkHeight / 2, tree.position.z);
        matrix.multiplyMatrices(posMatrix, scaleMatrix);
        this.treeTrunkMeshes!.setMatrixAt(i, matrix);

        // Slight color variation
        const shade = 0.2 + Math.random() * 0.1;
        color.setRGB(shade + 0.1, shade * 0.7, shade * 0.5);
        this.treeTrunkMeshes!.setColorAt(i, color);
      });

      this.treeTrunkMeshes.instanceMatrix.needsUpdate = true;
      if (this.treeTrunkMeshes.instanceColor) this.treeTrunkMeshes.instanceColor.needsUpdate = true;
      this.scene.add(this.treeTrunkMeshes);

      // Create tree crowns (static, no wind animation)
      const crownGeometry = new THREE.SphereGeometry(1, 12, 8);
      this.treeCrownMeshes = new THREE.InstancedMesh(
        crownGeometry,
        this.treeCrownMaterial,
        this.trees.length
      );
      this.treeCrownMeshes.castShadow = true;

      this.trees.forEach((tree, i) => {
        const crownY = tree.height * 0.5 + tree.crownRadius * 0.6;
        scaleMatrix.makeScale(tree.crownRadius, tree.crownRadius * 0.8, tree.crownRadius);
        posMatrix.makeTranslation(tree.position.x, crownY, tree.position.z);
        matrix.multiplyMatrices(posMatrix, scaleMatrix);
        this.treeCrownMeshes!.setMatrixAt(i, matrix);

        // Seasonal color variation
        const variation = Math.random() * 0.1;
        switch (tree.season) {
          case 'spring':
            // Light green with pink hints (cherry blossom)
            color.setRGB(0.4 + variation, 0.5 + variation, 0.35);
            break;
          case 'summer':
            // Deep green
            color.setRGB(0.15 + variation, 0.35 + variation, 0.12);
            break;
          case 'autumn':
            // Orange/red/yellow mix
            const autumnHue = Math.random();
            if (autumnHue < 0.33) {
              color.setRGB(0.7 + variation, 0.3 + variation, 0.1); // Orange
            } else if (autumnHue < 0.66) {
              color.setRGB(0.6 + variation, 0.15 + variation, 0.1); // Red
            } else {
              color.setRGB(0.7 + variation, 0.55 + variation, 0.15); // Yellow
            }
            break;
          case 'winter':
            // Sparse/bare look - grayish brown (leafless) or evergreen
            if (Math.random() < 0.4) {
              // Evergreen (dark green)
              color.setRGB(0.1 + variation, 0.25 + variation, 0.12);
            } else {
              // Bare branches (brownish)
              color.setRGB(0.3 + variation, 0.25 + variation, 0.2);
            }
            break;
          default:
            // Default green
            const greenShade = 0.25 + Math.random() * 0.15;
            color.setRGB(greenShade * 0.6, greenShade + 0.1, greenShade * 0.5);
        }
        this.treeCrownMeshes!.setColorAt(i, color);
      });

      this.treeCrownMeshes.instanceMatrix.needsUpdate = true;
      if (this.treeCrownMeshes.instanceColor) this.treeCrownMeshes.instanceColor.needsUpdate = true;
      this.scene.add(this.treeCrownMeshes);
    }

    // Create street lights
    if (this.streetLights.length > 0) {
      const poleGeometry = new THREE.CylinderGeometry(0.15, 0.2, 1, 8);
      const bulbGeometry = new THREE.SphereGeometry(0.4, 8, 8);
      const streetLightHeight = 8;

      this.streetLightPoleMeshes = new THREE.InstancedMesh(
        poleGeometry,
        this.streetLightPoleMaterial,
        this.streetLights.length
      );
      this.streetLightPoleMeshes.castShadow = true;

      this.streetLightBulbMeshes = new THREE.InstancedMesh(
        bulbGeometry,
        this.streetLightBulbMaterial,
        this.streetLights.length
      );

      this.streetLights.forEach((light, i) => {
        // Pole
        scaleMatrix.makeScale(1, streetLightHeight, 1);
        posMatrix.makeTranslation(light.position.x, streetLightHeight / 2, light.position.z);
        matrix.multiplyMatrices(posMatrix, scaleMatrix);
        this.streetLightPoleMeshes!.setMatrixAt(i, matrix);

        // Bulb at top
        scaleMatrix.makeScale(1, 1, 1);
        posMatrix.makeTranslation(light.position.x, streetLightHeight + 0.3, light.position.z);
        matrix.multiplyMatrices(posMatrix, scaleMatrix);
        this.streetLightBulbMeshes!.setMatrixAt(i, matrix);

        // Add actual point light (limit to 15 for performance)
        if (i < 15) {
          const pointLight = new THREE.PointLight(0xffffaa, 0.4, 20);
          pointLight.position.set(light.position.x, streetLightHeight + 0.3, light.position.z);
          this.streetLights3D.push(pointLight);
          this.scene.add(pointLight);
        }
      });

      this.streetLightPoleMeshes.instanceMatrix.needsUpdate = true;
      this.streetLightBulbMeshes.instanceMatrix.needsUpdate = true;
      this.scene.add(this.streetLightPoleMeshes);
      this.scene.add(this.streetLightBulbMeshes);
    }

    // Create neon signs (no PointLights - MeshBasicMaterial already appears to glow)
    this.neonSigns.forEach((sign) => {
      const signGeometry = new THREE.PlaneGeometry(sign.width, sign.height);
      const signMaterial = new THREE.MeshBasicMaterial({
        color: sign.color,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.9,
      });
      const signMesh = new THREE.Mesh(signGeometry, signMaterial);
      signMesh.position.copy(sign.position);
      signMesh.rotation.y = sign.rotation;
      this.neonSignMeshes.push(signMesh);
      this.scene.add(signMesh);
    });

    // Create park benches
    if (this.benches.length > 0) {
      // Simple bench geometry: seat + back + legs
      const benchGroup = new THREE.Group();

      // Seat
      const seatGeo = new THREE.BoxGeometry(2, 0.15, 0.6);
      const seatMesh = new THREE.Mesh(seatGeo);
      seatMesh.position.y = 0.5;
      benchGroup.add(seatMesh);

      // Back
      const backGeo = new THREE.BoxGeometry(2, 0.6, 0.1);
      const backMesh = new THREE.Mesh(backGeo);
      backMesh.position.set(0, 0.85, -0.25);
      benchGroup.add(backMesh);

      // Legs (4 corners)
      const legGeo = new THREE.BoxGeometry(0.1, 0.5, 0.1);
      const legPositions = [
        [-0.85, 0.25, 0.2],
        [0.85, 0.25, 0.2],
        [-0.85, 0.25, -0.2],
        [0.85, 0.25, -0.2],
      ];
      legPositions.forEach(([x, y, z]) => {
        const leg = new THREE.Mesh(legGeo);
        leg.position.set(x, y, z);
        benchGroup.add(leg);
      });

      // Merge into single geometry
      const benchGeometry = new THREE.BoxGeometry(2, 0.8, 0.5); // Park bench size
      const benchMaterial = new THREE.MeshStandardMaterial({
        color: 0x8b6914, // Brighter wood color
        roughness: 0.8,
        metalness: 0.1,
        emissive: 0x1a1005, // Slight glow so visible at night
        emissiveIntensity: 0.3,
      });

      this.benchMeshes = new THREE.InstancedMesh(
        benchGeometry,
        benchMaterial,
        this.benches.length
      );
      this.benchMeshes.castShadow = true;
      this.benchMeshes.receiveShadow = true;

      const benchMatrix = new THREE.Matrix4();
      const benchScale = new THREE.Matrix4();
      const benchPos = new THREE.Matrix4();
      const benchRot = new THREE.Matrix4();
      const benchColor = new THREE.Color();

      this.benches.forEach((bench, i) => {
        benchScale.makeScale(1, 1, 1);
        benchPos.makeTranslation(bench.position.x, 0.6, bench.position.z);
        benchRot.makeRotationY(bench.rotation);
        benchMatrix.multiplyMatrices(benchPos, benchRot);
        benchMatrix.multiply(benchScale);
        this.benchMeshes!.setMatrixAt(i, benchMatrix);

        // Brighter wood color variation
        const woodShade = 0.45 + Math.random() * 0.15;
        benchColor.setRGB(woodShade + 0.15, woodShade * 0.6, woodShade * 0.25);
        this.benchMeshes!.setColorAt(i, benchColor);
      });

      this.benchMeshes.instanceMatrix.needsUpdate = true;
      if (this.benchMeshes.instanceColor) this.benchMeshes.instanceColor.needsUpdate = true;
      this.scene.add(this.benchMeshes);
    }

    // Create trash bins
    if (this.trashBins.length > 0) {
      const binGeometry = new THREE.CylinderGeometry(0.4, 0.45, 1.0, 12);
      const binMaterial = new THREE.MeshStandardMaterial({
        color: 0x4a6a4a,
        roughness: 0.6,
        metalness: 0.2,
      });

      this.trashBinMeshes = new THREE.InstancedMesh(
        binGeometry,
        binMaterial,
        this.trashBins.length
      );
      this.trashBinMeshes.castShadow = true;

      const binPos = new THREE.Matrix4();
      const binColor = new THREE.Color();

      this.trashBins.forEach((bin, i) => {
        binPos.makeTranslation(bin.position.x, 0.5, bin.position.z);
        this.trashBinMeshes!.setMatrixAt(i, binPos);

        // Brighter green color variation (park bins)
        const shade = 0.25 + Math.random() * 0.1;
        binColor.setRGB(shade * 0.8, shade + 0.15, shade * 0.8);
        this.trashBinMeshes!.setColorAt(i, binColor);
      });

      this.trashBinMeshes.instanceMatrix.needsUpdate = true;
      if (this.trashBinMeshes.instanceColor) this.trashBinMeshes.instanceColor.needsUpdate = true;
      this.scene.add(this.trashBinMeshes);
    }

    // Create central landmark tower (visible from anywhere for navigation)
    // DISABLED: Landmarks cause collectible spawn/collision issues
    /*
    this.landmarkTower = new THREE.Group();
    const towerHeight = 180;
    const towerRadius = 8;

    // Main tower body
    const towerGeometry = new THREE.CylinderGeometry(towerRadius, towerRadius * 1.2, towerHeight, 16);
    const towerMaterial = new THREE.MeshStandardMaterial({
      color: 0x2a2a3a,
      roughness: 0.3,
      metalness: 0.8,
    });
    const towerMesh = new THREE.Mesh(towerGeometry, towerMaterial);
    towerMesh.position.y = towerHeight / 2;
    towerMesh.castShadow = true;
    this.landmarkTower.add(towerMesh);

    // Tower top (glowing beacon)
    const beaconGeometry = new THREE.SphereGeometry(towerRadius * 0.8, 16, 16);
    const beaconMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ffaa,
    });
    const beaconMesh = new THREE.Mesh(beaconGeometry, beaconMaterial);
    beaconMesh.position.y = towerHeight + towerRadius * 0.4;
    this.landmarkTower.add(beaconMesh);

    // Beacon light (lower intensity for performance)
    const beaconLight = new THREE.PointLight(0x00ffaa, 1, 60);
    beaconLight.position.y = towerHeight + towerRadius * 0.4;
    this.landmarkTower.add(beaconLight);

    // Tower rings (decorative)
    for (let i = 0; i < 5; i++) {
      const ringY = (i + 1) * (towerHeight / 6);
      const ringGeometry = new THREE.TorusGeometry(towerRadius + 1, 0.5, 8, 24);
      const ringMaterial = new THREE.MeshBasicMaterial({
        color: 0x00ccff,
        transparent: true,
        opacity: 0.6,
      });
      const ringMesh = new THREE.Mesh(ringGeometry, ringMaterial);
      ringMesh.position.y = ringY;
      ringMesh.rotation.x = Math.PI / 2;
      this.landmarkTower.add(ringMesh);
    }

    // Position the tower slightly offset from exact center (avoiding spawn point)
    this.landmarkTower.position.set(50, 0, 50);
    this.scene.add(this.landmarkTower);

    // Create pyramid monument landmark (opposite corner)
    const pyramidSize = 40;
    const pyramidHeight = 60;
    const pyramidGeom = new THREE.ConeGeometry(pyramidSize, pyramidHeight, 4);
    const pyramidMat = new THREE.MeshStandardMaterial({
      color: 0x8b7355,
      roughness: 0.6,
      metalness: 0.2,
    });
    this.landmarkPyramid = new THREE.Mesh(pyramidGeom, pyramidMat);
    this.landmarkPyramid.position.set(-120, pyramidHeight / 2, -120);
    this.landmarkPyramid.rotation.y = Math.PI / 4; // Rotate to align edges with grid
    this.landmarkPyramid.castShadow = true;
    this.scene.add(this.landmarkPyramid);

    // Create dome landmark (planetarium/arena)
    const domeRadius = 35;
    const domeGeom = new THREE.SphereGeometry(domeRadius, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    const domeMat = new THREE.MeshStandardMaterial({
      color: 0x3a5a7a,
      roughness: 0.3,
      metalness: 0.7,
    });
    this.landmarkDome = new THREE.Mesh(domeGeom, domeMat);
    this.landmarkDome.position.set(130, 0, -100);
    this.landmarkDome.castShadow = true;
    this.scene.add(this.landmarkDome);
    */
  }

  isInsideBuilding(point: THREE.Vector3, padding = 2): boolean {
    for (const building of this.buildings) {
      const halfW = building.width / 2 + padding;
      const halfD = building.depth / 2 + padding;

      if (
        point.x > building.position.x - halfW &&
        point.x < building.position.x + halfW &&
        point.z > building.position.z - halfD &&
        point.z < building.position.z + halfD
      ) {
        return true;
      }
    }
    return false;
  }

  // Check if a position is inside a park
  private isInPark(position: THREE.Vector3): boolean {
    for (const park of this.parks) {
      const dist = Math.sqrt(
        Math.pow(position.x - park.position.x, 2) +
        Math.pow(position.z - park.position.z, 2)
      );
      if (dist < park.radius) {
        return true;
      }
    }
    return false;
  }

  // Public method to check if player is in a park (for stamina bonus)
  isPlayerInPark(position: THREE.Vector3): boolean {
    return this.isInPark(position);
  }

  // Get surface type at position for footstep sounds
  getSurfaceType(position: THREE.Vector3): 'grass' | 'concrete' | 'water' {
    // Check if in water
    if (this.water && this.water.isInWater(position)) {
      return 'water';
    }
    // Check if in park (grass)
    if (this.isInPark(position)) {
      return 'grass';
    }
    // Default to concrete
    return 'concrete';
  }

  // Get park center positions for safe collectible spawning
  getParkCenters(): THREE.Vector2[] {
    return this.parks.map(park => new THREE.Vector2(park.position.x, park.position.z));
  }

  // Calculate building proximity for echo effect (0 = open, 1 = surrounded by buildings)
  getBuildingProximity(position: THREE.Vector3): number {
    let nearbyBuildings = 0;
    let totalProximity = 0;
    const checkRadius = 40; // Check buildings within 40 units

    for (const building of this.buildings) {
      const dx = position.x - building.position.x;
      const dz = position.z - building.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist < checkRadius) {
        nearbyBuildings++;
        // Higher proximity for closer and taller buildings
        const distFactor = 1 - (dist / checkRadius);
        const heightFactor = Math.min(building.height / 100, 1);
        totalProximity += distFactor * (0.5 + heightFactor * 0.5);
      }
    }

    // Normalize based on number of nearby buildings
    const avgProximity = nearbyBuildings > 0 ? totalProximity / nearbyBuildings : 0;
    const densityFactor = Math.min(nearbyBuildings / 5, 1); // More buildings = more echo

    return Math.min(avgProximity * densityFactor * 2, 1);
  }

  // Get rooftop positions for fragment spawning (returns building top positions)
  getRooftopPositions(count: number): THREE.Vector3[] {
    // Filter to low-medium height buildings (jumpable from ground or nearby)
    const suitableBuildings = this.buildings.filter(b =>
      b.height >= 15 && b.height <= 35 && b.type === 'box'
    );

    // Shuffle and pick random buildings
    const shuffled = [...suitableBuildings].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, Math.min(count, shuffled.length));

    return selected.map(b => new THREE.Vector3(
      b.position.x,
      b.position.y + b.height / 2 + 2, // On top of building
      b.position.z
    ));
  }

  // Get building at position (for climbing)
  getBuildingAt(position: THREE.Vector3, radius: number): { height: number; position: THREE.Vector3; width: number; depth: number } | null {
    for (const building of this.buildings) {
      const halfW = building.width / 2 + radius;
      const halfD = building.depth / 2 + radius;

      if (
        position.x > building.position.x - halfW &&
        position.x < building.position.x + halfW &&
        position.z > building.position.z - halfD &&
        position.z < building.position.z + halfD
      ) {
        return {
          height: building.height,
          position: building.position.clone(),
          width: building.width,
          depth: building.depth,
        };
      }
    }
    return null;
  }

  // Check collision for player movement
  checkCollision(position: THREE.Vector3, radius: number): THREE.Vector3 | null {
    // Check buildings
    for (const building of this.buildings) {
      const halfW = building.width / 2 + radius;
      const halfD = building.depth / 2 + radius;

      // Check if inside building bounds
      if (
        position.x > building.position.x - halfW &&
        position.x < building.position.x + halfW &&
        position.z > building.position.z - halfD &&
        position.z < building.position.z + halfD
      ) {
        // Push out to nearest edge
        const dx1 = position.x - (building.position.x - halfW);
        const dx2 = (building.position.x + halfW) - position.x;
        const dz1 = position.z - (building.position.z - halfD);
        const dz2 = (building.position.z + halfD) - position.z;

        const minDist = Math.min(dx1, dx2, dz1, dz2);
        const pushOut = new THREE.Vector3();

        if (minDist === dx1) pushOut.x = -dx1;
        else if (minDist === dx2) pushOut.x = dx2;
        else if (minDist === dz1) pushOut.z = -dz1;
        else pushOut.z = dz2;

        return pushOut;
      }
    }

    // DISABLED: Landmark collision checks (landmarks are visually disabled)
    // Check landmark tower collision (circular)
    /*
    const towerX = 50;
    const towerZ = 50;
    const towerRadius = 10 + radius;
    let dx = position.x - towerX;
    let dz = position.z - towerZ;
    let distSq = dx * dx + dz * dz;
    if (distSq < towerRadius * towerRadius) {
      const dist = Math.sqrt(distSq);
      const pushDist = towerRadius - dist;
      const pushOut = new THREE.Vector3(
        (dx / dist) * pushDist,
        0,
        (dz / dist) * pushDist
      );
      return pushOut;
    }

    // Check pyramid monument collision (approximate as circle)
    const pyramidX = -120;
    const pyramidZ = -120;
    const pyramidRadius = 42 + radius;
    dx = position.x - pyramidX;
    dz = position.z - pyramidZ;
    distSq = dx * dx + dz * dz;
    if (distSq < pyramidRadius * pyramidRadius) {
      const dist = Math.sqrt(distSq);
      const pushDist = pyramidRadius - dist;
      return new THREE.Vector3((dx / dist) * pushDist, 0, (dz / dist) * pushDist);
    }

    // Check dome collision (circular)
    const domeX = 130;
    const domeZ = -100;
    const domeRadius = 37 + radius;
    dx = position.x - domeX;
    dz = position.z - domeZ;
    distSq = dx * dx + dz * dz;
    if (distSq < domeRadius * domeRadius) {
      const dist = Math.sqrt(distSq);
      const pushDist = domeRadius - dist;
      return new THREE.Vector3((dx / dist) * pushDist, 0, (dz / dist) * pushDist);
    }
    */

    return null;
  }
}
