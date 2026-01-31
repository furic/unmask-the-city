import * as THREE from 'three';

interface GuardData {
  position: THREE.Vector3;
  rotation: number; // Direction they're facing
  visionAngle: number; // Half-angle of vision cone
  visionDistance: number;
}

export class Guard {
  private scene: THREE.Scene;
  private guards: GuardData[] = [];
  private guardMeshes: THREE.Mesh[] = [];
  private visionConeMeshes: THREE.Mesh[] = [];
  private alertLevel = 0; // 0-1, how alerted guards are

  constructor(scene: THREE.Scene, worldSize: number, count = 5) {
    this.scene = scene;
    this.generateGuards(worldSize, count);
    this.createMeshes();
  }

  private generateGuards(worldSize: number, count: number): void {
    const spawnClearRadius = 80; // Keep guards away from spawn

    for (let i = 0; i < count; i++) {
      let x: number, z: number;
      let attempts = 0;

      // Find valid position away from spawn
      do {
        x = (Math.random() - 0.5) * worldSize * 0.8;
        z = (Math.random() - 0.5) * worldSize * 0.8;
        attempts++;
      } while (Math.abs(x) < spawnClearRadius && Math.abs(z) < spawnClearRadius && attempts < 50);

      // Random facing direction
      const rotation = Math.random() * Math.PI * 2;

      this.guards.push({
        position: new THREE.Vector3(x, 0, z),
        rotation,
        visionAngle: Math.PI / 6, // 30 degrees half-angle (60 degree total cone)
        visionDistance: 25,
      });
    }
  }

  private createMeshes(): void {
    this.guards.forEach((guard) => {
      // Guard body (simple cylinder + cone head)
      const bodyGroup = new THREE.Group();

      // Body
      const bodyGeometry = new THREE.CylinderGeometry(0.8, 0.8, 3, 8);
      const bodyMaterial = new THREE.MeshStandardMaterial({
        color: 0x333344,
        roughness: 0.7,
        metalness: 0.3,
      });
      const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
      body.position.y = 1.5;
      body.castShadow = true;
      bodyGroup.add(body);

      // Head
      const headGeometry = new THREE.SphereGeometry(0.6, 8, 8);
      const headMaterial = new THREE.MeshStandardMaterial({
        color: 0x445566,
        roughness: 0.5,
        metalness: 0.2,
      });
      const head = new THREE.Mesh(headGeometry, headMaterial);
      head.position.y = 3.3;
      head.castShadow = true;
      bodyGroup.add(head);

      // Eye glow (indicates facing direction)
      const eyeGeometry = new THREE.SphereGeometry(0.15, 8, 8);
      const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0xff3333 });
      const eye1 = new THREE.Mesh(eyeGeometry, eyeMaterial);
      const eye2 = new THREE.Mesh(eyeGeometry, eyeMaterial);
      eye1.position.set(-0.25, 3.4, 0.45);
      eye2.position.set(0.25, 3.4, 0.45);
      bodyGroup.add(eye1);
      bodyGroup.add(eye2);

      bodyGroup.position.copy(guard.position);
      bodyGroup.rotation.y = guard.rotation;

      this.guardMeshes.push(bodyGroup as unknown as THREE.Mesh);
      this.scene.add(bodyGroup);

      // Vision cone (transparent red) - simpler approach
      const coneLength = guard.visionDistance;
      const coneRadius = Math.tan(guard.visionAngle) * coneLength;

      // Create cone with tip at origin pointing down (-Y)
      const coneGeometry = new THREE.ConeGeometry(coneRadius, coneLength, 16, 1, true);
      const coneMaterial = new THREE.MeshBasicMaterial({
        color: 0xff0000,
        transparent: true,
        opacity: 0.15,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const cone = new THREE.Mesh(coneGeometry, coneMaterial);

      // Rotate cone to point along +Z axis (forward)
      cone.rotation.x = -Math.PI / 2; // Tip points forward

      // Put cone in a group for easier positioning
      const coneGroup = new THREE.Group();
      // No offset - cone centered at origin, extends forward and back
      cone.position.z = 0;
      coneGroup.add(cone);

      // Position group at guard
      coneGroup.position.copy(guard.position);
      coneGroup.position.y = 2;

      // Rotate group to face guard's direction
      coneGroup.rotation.y = guard.rotation;

      this.visionConeMeshes.push(coneGroup as unknown as THREE.Mesh);
      this.scene.add(coneGroup);
    });
  }

  // Check if player is spotted by any guard
  checkPlayerSpotted(playerPos: THREE.Vector3): boolean {
    for (const guard of this.guards) {
      if (this.isInVisionCone(guard, playerPos)) {
        return true;
      }
    }
    return false;
  }

  // Get the detection level (0-1) based on how "seen" the player is
  getDetectionLevel(playerPos: THREE.Vector3): number {
    let maxDetection = 0;

    for (const guard of this.guards) {
      if (this.isInVisionCone(guard, playerPos)) {
        const distance = guard.position.distanceTo(playerPos);
        // Closer = more detected
        const distFactor = 1 - (distance / guard.visionDistance);
        maxDetection = Math.max(maxDetection, distFactor);
      }
    }

    return maxDetection;
  }

  private isInVisionCone(guard: GuardData, playerPos: THREE.Vector3): boolean {
    // Vector from guard to player
    const dx = playerPos.x - guard.position.x;
    const dz = playerPos.z - guard.position.z;
    const distance = Math.sqrt(dx * dx + dz * dz);

    // Too far
    if (distance > guard.visionDistance) return false;

    // Angle to player
    const angleToPlayer = Math.atan2(dx, dz);

    // Normalize angle difference
    let angleDiff = angleToPlayer - guard.rotation;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

    // Check if within vision cone
    return Math.abs(angleDiff) < guard.visionAngle;
  }

  update(delta: number, playerPos: THREE.Vector3): void {
    // Update alert level based on player detection
    const detection = this.getDetectionLevel(playerPos);

    if (detection > 0) {
      this.alertLevel = Math.min(1, this.alertLevel + delta * 2);
    } else {
      this.alertLevel = Math.max(0, this.alertLevel - delta * 0.5);
    }

    // Update vision cone colors based on alert level
    this.visionConeMeshes.forEach((coneGroup) => {
      // Get the cone mesh from the group (it's the first child)
      const cone = (coneGroup as unknown as THREE.Group).children[0] as THREE.Mesh;
      if (cone && cone.material) {
        const mat = cone.material as THREE.MeshBasicMaterial;
        // Interpolate from red (calm) to bright red (alert)
        mat.opacity = 0.15 + this.alertLevel * 0.25;
        if (this.alertLevel > 0.5) {
          mat.color.setHex(0xff0000);
        } else {
          mat.color.setHex(0xff3333);
        }
      }
    });

    // Slowly rotate guards (patrol behavior)
    this.guards.forEach((guard, i) => {
      guard.rotation += Math.sin(Date.now() * 0.001 + i) * delta * 0.3;

      // Update mesh rotation
      const mesh = this.guardMeshes[i];
      mesh.rotation.y = guard.rotation;

      // Update cone position and rotation
      const cone = this.visionConeMeshes[i];
      cone.rotation.z = guard.rotation + Math.PI / 2;
      const coneLength = guard.visionDistance;
      const forwardX = Math.sin(guard.rotation) * (coneLength / 2);
      const forwardZ = Math.cos(guard.rotation) * (coneLength / 2);
      cone.position.x = guard.position.x + forwardX;
      cone.position.z = guard.position.z + forwardZ;
    });
  }

  getAlertLevel(): number {
    return this.alertLevel;
  }

  dispose(): void {
    this.guardMeshes.forEach((mesh) => {
      this.scene.remove(mesh);
      mesh.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (child.material instanceof THREE.Material) {
            child.material.dispose();
          }
        }
      });
    });

    this.visionConeMeshes.forEach((mesh) => {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    });

    this.guardMeshes = [];
    this.visionConeMeshes = [];
    this.guards = [];
  }
}
