import * as THREE from 'three';
import { FogOfWar } from './FogOfWar';

type BuildingType = 'box' | 'cylinder' | 'pyramid';

interface Building {
  position: THREE.Vector3;
  width: number;
  height: number;
  depth: number;
  type: BuildingType;
  hasAntenna: boolean;
  hasWaterTower: boolean;
}

interface Park {
  position: THREE.Vector3;
  radius: number;
}

interface Tree {
  position: THREE.Vector3;
  height: number;
  crownRadius: number;
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

export class City {
  private scene: THREE.Scene;
  private size: number;
  private fogOfWar: FogOfWar;
  private buildings: Building[] = [];
  private parks: Park[] = [];
  private trees: Tree[] = [];
  private streetLights: StreetLight[] = [];
  private neonSigns: NeonSign[] = [];
  private boxMeshes: THREE.InstancedMesh | null = null;
  private cylinderMeshes: THREE.InstancedMesh | null = null;
  private pyramidMeshes: THREE.InstancedMesh | null = null;
  private antennaMeshes: THREE.InstancedMesh | null = null;
  private waterTowerMeshes: THREE.InstancedMesh | null = null;
  private treeTrunkMeshes: THREE.InstancedMesh | null = null;
  private treeCrownMeshes: THREE.InstancedMesh | null = null;
  private parkGroundMeshes: THREE.Mesh[] = [];
  private streetLightPoleMeshes: THREE.InstancedMesh | null = null;
  private streetLightBulbMeshes: THREE.InstancedMesh | null = null;
  private streetLights3D: THREE.PointLight[] = [];
  private neonSignMeshes: THREE.Mesh[] = [];
  private landmarkTower: THREE.Group | null = null;
  private buildingMaterial: THREE.MeshStandardMaterial;
  private treeTrunkMaterial: THREE.MeshStandardMaterial;
  private treeCrownMaterial: THREE.MeshStandardMaterial;
  private streetLightPoleMaterial: THREE.MeshStandardMaterial;
  private streetLightBulbMaterial: THREE.MeshBasicMaterial;
  private buildingDensity: number;

  constructor(scene: THREE.Scene, size: number, fogOfWar: FogOfWar, buildingDensity = 0.7) {
    this.scene = scene;
    this.size = size;
    this.fogOfWar = fogOfWar;
    this.buildingDensity = buildingDensity;

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
      shader.uniforms.cityBounds = { 
        value: new THREE.Vector4(
          -this.size / 2, -this.size / 2, 
          this.size / 2, this.size / 2
        ) 
      };
      shader.uniforms.playerPos = { value: new THREE.Vector3() };

      // Add varying for world position
      shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        `
        #include <common>
        varying vec3 vWorldPos;
        `
      );

      shader.vertexShader = shader.vertexShader.replace(
        '#include <worldpos_vertex>',
        `
        #include <worldpos_vertex>
        vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
        `
      );

      // Add fog of war to fragment shader
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <common>',
        `
        #include <common>
        uniform sampler2D fogMap;
        uniform vec4 cityBounds;
        uniform vec3 playerPos;
        varying vec3 vWorldPos;
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

        // Window pattern (darker rectangles)
        float windowSpacing = 3.0;
        float windowWidth = 0.6;
        float windowX = mod(vWorldPos.x + vWorldPos.z, windowSpacing);
        float windowPattern = step(windowWidth, windowX);

        // Combine for AO-like effect (darker in window areas, lighter on edges)
        float aoEffect = mix(0.85, 1.0, floorLine * 0.5 + windowPattern * 0.5);
        gl_FragColor.rgb *= aoEffect;

        // Fog of war calculation
        vec2 fowUV = (vWorldPos.xz - cityBounds.xy) / (cityBounds.zw - cityBounds.xy);
        fowUV = clamp(fowUV, 0.0, 1.0);
        float fowDensity = texture2D(fogMap, fowUV).r;

        // Player proximity (real-time clear zone)
        float distToPlayer = length(vWorldPos.xz - playerPos.xz);
        float playerClear = 1.0 - smoothstep(15.0, 30.0, distToPlayer);
        fowDensity = min(fowDensity, 1.0 - playerClear);

        // Apply fog of war
        vec3 fowColor = vec3(0.83, 0.83, 0.85);
        gl_FragColor.rgb = mix(gl_FragColor.rgb, fowColor, fowDensity * 0.9);

        #include <fog_fragment>
        `
      );

      // Store shader reference for updates
      (this.buildingMaterial as any).shader = shader;
    };
  }

  updateFogUniforms(playerPos?: THREE.Vector3): void {
    const shader = (this.buildingMaterial as any).shader;
    if (shader) {
      shader.uniforms.fogMap.value = this.fogOfWar.getTexture();
      shader.uniforms.fogMap.value.needsUpdate = true;
      if (playerPos) {
        shader.uniforms.playerPos.value.copy(playerPos);
      }
    }
  }

  generate(): void {
    this.buildings = [];
    this.parks = [];
    this.trees = [];
    this.streetLights = [];
    this.neonSigns = [];
    const halfSize = this.size / 2;
    const gridSize = 20; // Space between potential building spots
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

      this.parks.push({
        position: new THREE.Vector3(parkX, 0, parkZ),
        radius: parkRadius,
      });

      // Generate trees in park
      const treesInPark = 8 + Math.floor(Math.random() * 12);
      for (let t = 0; t < treesInPark; t++) {
        const treeAngle = Math.random() * Math.PI * 2;
        const treeDist = Math.random() * (parkRadius - 5);
        const treeX = parkX + Math.cos(treeAngle) * treeDist;
        const treeZ = parkZ + Math.sin(treeAngle) * treeDist;

        this.trees.push({
          position: new THREE.Vector3(treeX, 0, treeZ),
          height: 6 + Math.random() * 8,
          crownRadius: 3 + Math.random() * 3,
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
          // Outer areas: some pyramids
          type = 'pyramid';
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

        // Rooftop props (only on tall box buildings)
        const hasAntenna = type === 'box' && height > 50 && Math.random() < 0.15;
        const hasWaterTower = type === 'box' && height > 30 && height < 60 && Math.random() < 0.1;

        this.buildings.push({
          position: new THREE.Vector3(x + offsetX, height / 2, z + offsetZ),
          width,
          height,
          depth,
          type,
          hasAntenna,
          hasWaterTower,
        });

        // Add neon signs to some box buildings (20% chance)
        if (type === 'box' && height > 25 && Math.random() < 0.2) {
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

        if (!tooCloseToBuilding && Math.random() < 0.3) {
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
      this.treeTrunkMeshes,
      this.treeCrownMeshes,
      this.streetLightPoleMeshes,
      this.streetLightBulbMeshes,
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

    // Generate new city
    this.generate();
  }

  private createMeshes(): void {
    // Count buildings by type
    const boxBuildings = this.buildings.filter((b) => b.type === 'box');
    const cylinderBuildings = this.buildings.filter((b) => b.type === 'cylinder');
    const pyramidBuildings = this.buildings.filter((b) => b.type === 'pyramid');
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

        const shade = 0.3 + Math.random() * 0.2;
        color.setRGB(shade, shade, shade + 0.02);
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

        // Slightly bluer tint for glass towers
        const shade = 0.35 + Math.random() * 0.15;
        color.setRGB(shade * 0.9, shade * 0.95, shade + 0.05);
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
        const pyramidWidth = Math.min(building.width, building.depth) * 0.9;

        scaleMatrix.makeScale(pyramidWidth, pyramidHeight, pyramidWidth);
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

    // Create tree trunks
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

      // Create tree crowns (spheres)
      const crownGeometry = new THREE.SphereGeometry(1, 12, 8);
      this.treeCrownMeshes = new THREE.InstancedMesh(
        crownGeometry,
        this.treeCrownMaterial,
        this.trees.length
      );
      this.treeCrownMeshes.castShadow = true;

      this.trees.forEach((tree, i) => {
        const crownY = tree.height * 0.5 + tree.crownRadius * 0.7;
        scaleMatrix.makeScale(tree.crownRadius, tree.crownRadius * 0.8, tree.crownRadius);
        posMatrix.makeTranslation(tree.position.x, crownY, tree.position.z);
        matrix.multiplyMatrices(posMatrix, scaleMatrix);
        this.treeCrownMeshes!.setMatrixAt(i, matrix);

        // Green color variation
        const greenShade = 0.25 + Math.random() * 0.15;
        color.setRGB(greenShade * 0.6, greenShade + 0.1, greenShade * 0.5);
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

        // Add actual point light (but limit to avoid performance issues)
        if (i < 50) {
          const pointLight = new THREE.PointLight(0xffffaa, 0.5, 25);
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

    // Create neon signs
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

      // Add glow light for each neon sign
      const signLight = new THREE.PointLight(sign.color, 0.3, 15);
      signLight.position.copy(sign.position);
      this.scene.add(signLight);
    });

    // Create central landmark tower (visible from anywhere for navigation)
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

    // Beacon light
    const beaconLight = new THREE.PointLight(0x00ffaa, 2, 100);
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

    // Check landmark tower collision (circular)
    const towerX = 50;
    const towerZ = 50;
    const towerRadius = 10 + radius;
    const dx = position.x - towerX;
    const dz = position.z - towerZ;
    const distSq = dx * dx + dz * dz;
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

    return null;
  }
}
