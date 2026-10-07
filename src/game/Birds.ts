import * as THREE from 'three';

interface Bird {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  wingPhase: number;
  wingSpeed: number;
  targetPoint: THREE.Vector3;
  isBat: boolean;
}

export class Birds {
  private scene: THREE.Scene;
  private birds: Bird[] = [];
  private worldSize: number;
  private isNightMode = false;

  // Flocking parameters
  private readonly BIRD_COUNT = 20;
  private readonly FLIGHT_HEIGHT_MIN = 40;
  private readonly FLIGHT_HEIGHT_MAX = 100;
  private readonly SPEED = 15;

  constructor(scene: THREE.Scene, worldSize: number) {
    this.scene = scene;
    this.worldSize = worldSize;
    this.createBirds();
  }

  private createBirds(): void {
    for (let i = 0; i < this.BIRD_COUNT; i++) {
      this.createBird(false); // Start with daytime birds
    }
  }

  private createBird(isBat: boolean): Bird {
    // Create simple bird/bat shape using triangles
    const geometry = new THREE.BufferGeometry();

    // Bird body + wings shape (vertices in local space)
    const vertices = new Float32Array([
      // Body (triangle pointing forward)
      0, 0, 1,     // nose
      -0.3, 0, -0.5, // left back
      0.3, 0, -0.5,  // right back

      // Left wing
      -0.3, 0, 0,   // wing base
      -2, 0.2, -0.3, // wing tip
      -0.3, 0, -0.5, // wing back

      // Right wing
      0.3, 0, 0,    // wing base
      2, 0.2, -0.3,  // wing tip
      0.3, 0, -0.5,  // wing back
    ]);

    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geometry.computeVertexNormals();

    const material = new THREE.MeshBasicMaterial({
      color: isBat ? 0x1a1a2e : 0x2d2d2d,
      side: THREE.DoubleSide,
    });

    const mesh = new THREE.Mesh(geometry, material);

    // Random starting position
    mesh.position.set(
      (Math.random() - 0.5) * this.worldSize,
      this.FLIGHT_HEIGHT_MIN + Math.random() * (this.FLIGHT_HEIGHT_MAX - this.FLIGHT_HEIGHT_MIN),
      (Math.random() - 0.5) * this.worldSize
    );

    // Random scale
    const scale = 0.8 + Math.random() * 0.4;
    mesh.scale.set(scale, scale, scale);

    // Random initial velocity
    const angle = Math.random() * Math.PI * 2;
    const velocity = new THREE.Vector3(
      Math.cos(angle) * this.SPEED,
      0,
      Math.sin(angle) * this.SPEED
    );

    // Random target point
    const targetPoint = new THREE.Vector3(
      (Math.random() - 0.5) * this.worldSize,
      this.FLIGHT_HEIGHT_MIN + Math.random() * (this.FLIGHT_HEIGHT_MAX - this.FLIGHT_HEIGHT_MIN),
      (Math.random() - 0.5) * this.worldSize
    );

    this.scene.add(mesh);

    const bird: Bird = {
      mesh,
      velocity,
      wingPhase: Math.random() * Math.PI * 2,
      wingSpeed: 8 + Math.random() * 4,
      targetPoint,
      isBat,
    };

    this.birds.push(bird);
    return bird;
  }

  update(delta: number): void {
    const halfSize = this.worldSize / 2;

    this.birds.forEach((bird) => {
      // Update wing animation
      bird.wingPhase += bird.wingSpeed * delta;

      // Apply wing flapping by modifying the geometry
      const positions = bird.mesh.geometry.attributes.position.array as Float32Array;

      // Animate wing tips (vertices 4 and 7)
      const wingOffset = Math.sin(bird.wingPhase) * 0.5;
      positions[4 * 3 + 1] = 0.2 + wingOffset; // Left wing tip Y
      positions[7 * 3 + 1] = 0.2 + wingOffset; // Right wing tip Y

      bird.mesh.geometry.attributes.position.needsUpdate = true;

      // Steering toward target
      const toTarget = bird.targetPoint.clone().sub(bird.mesh.position);
      const distToTarget = toTarget.length();

      if (distToTarget < 20) {
        // Pick new target
        bird.targetPoint.set(
          (Math.random() - 0.5) * this.worldSize,
          this.FLIGHT_HEIGHT_MIN + Math.random() * (this.FLIGHT_HEIGHT_MAX - this.FLIGHT_HEIGHT_MIN),
          (Math.random() - 0.5) * this.worldSize
        );
      }

      // Gradually turn toward target
      toTarget.normalize();
      bird.velocity.lerp(toTarget.multiplyScalar(this.SPEED), delta * 0.5);

      // Maintain speed
      bird.velocity.normalize().multiplyScalar(this.SPEED);

      // Apply velocity
      bird.mesh.position.add(bird.velocity.clone().multiplyScalar(delta));

      // Keep within bounds
      if (bird.mesh.position.x > halfSize) bird.mesh.position.x = -halfSize;
      if (bird.mesh.position.x < -halfSize) bird.mesh.position.x = halfSize;
      if (bird.mesh.position.z > halfSize) bird.mesh.position.z = -halfSize;
      if (bird.mesh.position.z < -halfSize) bird.mesh.position.z = halfSize;

      // Maintain flight height
      bird.mesh.position.y = THREE.MathUtils.clamp(
        bird.mesh.position.y,
        this.FLIGHT_HEIGHT_MIN,
        this.FLIGHT_HEIGHT_MAX
      );

      // Orient bird in direction of movement
      if (bird.velocity.length() > 0.1) {
        bird.mesh.lookAt(bird.mesh.position.clone().add(bird.velocity));
      }
    });
  }

  setNightMode(isNight: boolean): void {
    if (isNight === this.isNightMode) return;

    this.isNightMode = isNight;

    // Change bird colors and behavior for night/day
    this.birds.forEach((bird) => {
      const material = bird.mesh.material as THREE.MeshBasicMaterial;
      if (isNight) {
        // Transform to bats at night
        material.color.setHex(0x1a1a2e);
        bird.isBat = true;
        bird.wingSpeed = 12 + Math.random() * 6; // Bats flap faster
      } else {
        // Transform to birds during day
        material.color.setHex(0x2d2d2d);
        bird.isBat = false;
        bird.wingSpeed = 8 + Math.random() * 4;
      }
    });
  }

  dispose(): void {
    this.birds.forEach((bird) => {
      this.scene.remove(bird.mesh);
      bird.mesh.geometry.dispose();
      (bird.mesh.material as THREE.Material).dispose();
    });
    this.birds = [];
  }
}
