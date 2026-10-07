import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { City } from './City';

export class Player {
  private controls: PointerLockControls;
  private velocity: THREE.Vector3;
  private direction: THREE.Vector3;

  // Movement
  private moveForward = false;
  private moveBackward = false;
  private moveLeft = false;
  private moveRight = false;
  private isSprinting = false;
  private jumpPressed = false;

  // Settings
  private readonly WALK_SPEED = 20;
  private readonly SPRINT_SPEED = 35;
  private readonly ACCELERATION = 80;
  private readonly DECELERATION = 60;
  private readonly PLAYER_HEIGHT = 5;
  private readonly COLLISION_RADIUS = 1.5;

  // Jump settings
  private readonly JUMP_FORCE = 12;
  private readonly GRAVITY = -30;
  private readonly JUMP_STAMINA_COST = 10;
  private verticalVelocity = 0;
  private isGrounded = true;

  // Stamina
  private stamina = 100;
  private readonly MAX_STAMINA = 100;
  private readonly STAMINA_DRAIN = 25; // per second
  private readonly STAMINA_REGEN = 15; // per second
  private readonly STAMINA_REGEN_PARK_MULTIPLIER = 2; // 2x regen in parks
  private readonly STAMINA_SPRINT_THRESHOLD = 10;
  private isInPark = false;

  // Water
  private inWater = false;
  private readonly WATER_SPEED_MULTIPLIER = 0.5;

  // Dash (currently using sprint instead - dash vars kept for cooldown mechanics)
  private readonly DASH_SPEED = 60;
  private readonly DASH_COOLDOWN = 1.0;
  private isDashing = false;
  private dashTimer = 0;
  private dashCooldownTimer = 0;
  private dashDirection = new THREE.Vector3();

  // Head bob
  private headBobTime = 0;
  private readonly HEAD_BOB_FREQUENCY = 12;
  private readonly HEAD_BOB_AMPLITUDE = 0.08;

  // Slide
  private isSliding = false;
  private slideTimer = 0;
  private slideCooldownTimer = 0;
  private slideDirection = new THREE.Vector3();
  private readonly SLIDE_DURATION = 0.6;
  private readonly SLIDE_COOLDOWN = 1.2;
  private readonly SLIDE_SPEED = 50;
  private readonly SLIDE_HEIGHT = 2.5; // Crouched height during slide
  private ctrlPressed = false;

  constructor(controls: PointerLockControls) {
    this.controls = controls;
    this.velocity = new THREE.Vector3();
    this.direction = new THREE.Vector3();

    this.setupInputs();
  }

  private setupInputs(): void {
    document.addEventListener('keydown', (e) => this.onKeyDown(e));
    document.addEventListener('keyup', (e) => this.onKeyUp(e));
  }

  private onKeyDown(event: KeyboardEvent): void {
    // Double-tap dash detection - DISABLED (was causing accidental dashes)
    // const now = performance.now();
    // const doubleTapWindow = 150; // ms

    switch (event.code) {
      case 'ArrowUp':
      case 'KeyW':
        // if (this.lastKeyPress?.key === 'forward' && now - this.lastKeyPress.time < doubleTapWindow) {
        //   this.triggerDash('forward');
        // }
        // this.lastKeyPress = { key: 'forward', time: now };
        this.moveForward = true;
        break;
      case 'ArrowLeft':
      case 'KeyA':
        // if (this.lastKeyPress?.key === 'left' && now - this.lastKeyPress.time < doubleTapWindow) {
        //   this.triggerDash('left');
        // }
        // this.lastKeyPress = { key: 'left', time: now };
        this.moveLeft = true;
        break;
      case 'ArrowDown':
      case 'KeyS':
        // if (this.lastKeyPress?.key === 'backward' && now - this.lastKeyPress.time < doubleTapWindow) {
        //   this.triggerDash('backward');
        // }
        // this.lastKeyPress = { key: 'backward', time: now };
        this.moveBackward = true;
        break;
      case 'ArrowRight':
      case 'KeyD':
        // if (this.lastKeyPress?.key === 'right' && now - this.lastKeyPress.time < doubleTapWindow) {
        //   this.triggerDash('right');
        // }
        // this.lastKeyPress = { key: 'right', time: now };
        this.moveRight = true;
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        this.isSprinting = true;
        break;
      case 'Space':
        this.jumpPressed = true;
        break;
      case 'ControlLeft':
      case 'ControlRight':
        this.ctrlPressed = true;
        break;
    }
  }

  private onKeyUp(event: KeyboardEvent): void {
    switch (event.code) {
      case 'ArrowUp':
      case 'KeyW':
        this.moveForward = false;
        break;
      case 'ArrowLeft':
      case 'KeyA':
        this.moveLeft = false;
        break;
      case 'ArrowDown':
      case 'KeyS':
        this.moveBackward = false;
        break;
      case 'ArrowRight':
      case 'KeyD':
        this.moveRight = false;
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        this.isSprinting = false;
        break;
      case 'ControlLeft':
      case 'ControlRight':
        this.ctrlPressed = false;
        break;
    }
  }

  update(delta: number, city: City): THREE.Vector3 {
    if (!this.controls.isLocked) {
      return this.controls.object.position;
    }

    // Update dash cooldown
    if (this.dashCooldownTimer > 0) {
      this.dashCooldownTimer -= delta;
    }

    // Update dash state
    if (this.isDashing) {
      this.dashTimer -= delta;
      if (this.dashTimer <= 0) {
        this.isDashing = false;
        this.dashCooldownTimer = this.DASH_COOLDOWN;
      }
    }

    // Update slide cooldown
    if (this.slideCooldownTimer > 0) {
      this.slideCooldownTimer -= delta;
    }

    // Trigger slide (Ctrl while sprinting and moving)
    const isMoving = this.moveForward || this.moveBackward || this.moveLeft || this.moveRight;
    const canSprint = this.isSprinting && this.stamina > this.STAMINA_SPRINT_THRESHOLD;
    if (this.ctrlPressed && canSprint && isMoving && !this.isSliding && this.slideCooldownTimer <= 0 && this.isGrounded) {
      this.isSliding = true;
      this.slideTimer = this.SLIDE_DURATION;

      // Capture current movement direction for slide
      const forward = new THREE.Vector3();
      const right = new THREE.Vector3();
      this.controls.object.getWorldDirection(forward);
      forward.y = 0;
      forward.normalize();
      right.crossVectors(forward, new THREE.Vector3(0, 1, 0));

      this.slideDirection.set(0, 0, 0);
      this.slideDirection.addScaledVector(forward, Number(this.moveForward) - Number(this.moveBackward));
      this.slideDirection.addScaledVector(right, Number(this.moveRight) - Number(this.moveLeft));
      this.slideDirection.normalize();

      // Drain some stamina for slide
      this.stamina = Math.max(0, this.stamina - 15);
    }

    // Update slide state
    if (this.isSliding) {
      this.slideTimer -= delta;
      if (this.slideTimer <= 0) {
        this.isSliding = false;
        this.slideCooldownTimer = this.SLIDE_COOLDOWN;
      }
    }

    // Determine target speed (isMoving and canSprint already defined above for slide)
    let targetSpeed = isMoving ? (canSprint ? this.SPRINT_SPEED : this.WALK_SPEED) : 0;

    // Apply water slowdown
    if (this.inWater) {
      targetSpeed *= this.WATER_SPEED_MULTIPLIER;
    }

    // Check if player is in a park (for stamina bonus)
    this.isInPark = city.isPlayerInPark(this.controls.object.position);

    // Update stamina (regenerates 2x faster in parks)
    const regenMultiplier = this.isInPark ? this.STAMINA_REGEN_PARK_MULTIPLIER : 1;
    if (isMoving && canSprint && this.isSprinting) {
      this.stamina = Math.max(0, this.stamina - this.STAMINA_DRAIN * delta);
    } else if (!this.isSprinting || !isMoving) {
      this.stamina = Math.min(this.MAX_STAMINA, this.stamina + this.STAMINA_REGEN * regenMultiplier * delta);
    }

    // Calculate movement direction
    this.direction.z = Number(this.moveForward) - Number(this.moveBackward);
    this.direction.x = Number(this.moveRight) - Number(this.moveLeft);
    this.direction.normalize();

    // Get camera's forward and right vectors (horizontal only)
    const forward = new THREE.Vector3();
    const right = new THREE.Vector3();
    this.controls.object.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();
    right.crossVectors(forward, new THREE.Vector3(0, 1, 0));

    // Calculate desired velocity
    const desiredVelocity = new THREE.Vector3();
    if (this.isDashing) {
      // During dash, use dash direction at high speed
      desiredVelocity.copy(this.dashDirection).multiplyScalar(this.DASH_SPEED);
    } else if (this.isSliding) {
      // During slide, use captured slide direction with decaying speed
      const slideProgress = 1 - (this.slideTimer / this.SLIDE_DURATION);
      const slideSpeed = this.SLIDE_SPEED * (1 - slideProgress * 0.5); // Decay to 50% speed
      desiredVelocity.copy(this.slideDirection).multiplyScalar(slideSpeed);
    } else {
      desiredVelocity.addScaledVector(forward, this.direction.z);
      desiredVelocity.addScaledVector(right, this.direction.x);
      desiredVelocity.normalize().multiplyScalar(targetSpeed);
    }

    // Smooth acceleration/deceleration (faster during dash)
    const accel = this.isDashing ? 200 : (isMoving ? this.ACCELERATION : this.DECELERATION);
    this.velocity.lerp(desiredVelocity, 1 - Math.exp(-accel * delta));

    // Handle jumping (can't jump in water or while dashing)
    if (this.jumpPressed && this.isGrounded && this.stamina >= this.JUMP_STAMINA_COST && !this.inWater && !this.isDashing) {
      this.verticalVelocity = this.JUMP_FORCE;
      this.isGrounded = false;
      this.stamina -= this.JUMP_STAMINA_COST;
    }
    this.jumpPressed = false;

    // Apply gravity
    this.verticalVelocity += this.GRAVITY * delta;

    // Apply movement
    const movement = this.velocity.clone().multiplyScalar(delta);
    const newPosition = this.controls.object.position.clone().add(movement);

    // Apply vertical movement
    newPosition.y += this.verticalVelocity * delta;

    // Ground/water height check (lower during slide)
    let currentHeight = this.PLAYER_HEIGHT;
    if (this.isSliding) {
      currentHeight = this.SLIDE_HEIGHT;
    } else if (this.inWater) {
      currentHeight = this.PLAYER_HEIGHT - 1;
    }

    if (newPosition.y <= currentHeight) {
      newPosition.y = currentHeight;
      this.verticalVelocity = 0;
      this.isGrounded = true;
    }

    // Head bob effect when moving on ground (not during slide or dash)
    if (isMoving && this.isGrounded && !this.isDashing && !this.isSliding) {
      this.headBobTime += delta * this.HEAD_BOB_FREQUENCY * (canSprint ? 1.3 : 1);
      const bobOffset = Math.sin(this.headBobTime) * this.HEAD_BOB_AMPLITUDE;
      newPosition.y += bobOffset;
    } else {
      // Smoothly return to base height
      this.headBobTime = 0;
    }

    // Check collision with buildings
    const collision = city.checkCollision(newPosition, this.COLLISION_RADIUS);
    if (collision) {
      newPosition.add(collision);
    }

    // Apply position
    this.controls.object.position.copy(newPosition);

    return this.controls.object.position;
  }

  setInWater(inWater: boolean): void {
    this.inWater = inWater;
  }

  getStaminaPercent(): number {
    return (this.stamina / this.MAX_STAMINA) * 100;
  }

  drainStamina(amount: number): void {
    this.stamina = Math.max(0, this.stamina - amount);
  }

  getMovementState(): { isMoving: boolean; isSprinting: boolean; inPark: boolean } {
    const isMoving = this.moveForward || this.moveBackward || this.moveLeft || this.moveRight;
    const canSprint = this.isSprinting && this.stamina > this.STAMINA_SPRINT_THRESHOLD;
    return {
      isMoving,
      isSprinting: isMoving && canSprint,
      inPark: this.isInPark,
    };
  }

  reset(): void {
    this.velocity.set(0, 0, 0);
    this.verticalVelocity = 0;
    this.isGrounded = true;
    this.stamina = this.MAX_STAMINA;
    this.moveForward = false;
    this.moveBackward = false;
    this.moveLeft = false;
    this.moveRight = false;
    this.isSprinting = false;
    this.jumpPressed = false;
    this.isDashing = false;
    this.dashTimer = 0;
    this.dashCooldownTimer = 0;
    this.isSliding = false;
    this.slideTimer = 0;
    this.slideCooldownTimer = 0;
    this.ctrlPressed = false;
    this.inWater = false;
    this.headBobTime = 0;
  }

  /**
   * Get current player position without updating movement
   */
  getPosition(): THREE.Vector3 {
    return this.controls.object.position;
  }
}
