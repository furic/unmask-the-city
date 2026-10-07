import * as THREE from 'three';

/**
 * Moon with halo effect for night theme
 */
export class Moon {
  private scene: THREE.Scene;
  private moonMesh: THREE.Mesh;
  private haloMesh: THREE.Mesh;
  private group: THREE.Group;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.group = new THREE.Group();

    // Create moon
    const moonGeometry = new THREE.CircleGeometry(15, 32);
    const moonMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffee,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
    });
    this.moonMesh = new THREE.Mesh(moonGeometry, moonMaterial);

    // Create halo (larger circle behind moon with gradient)
    const haloGeometry = new THREE.CircleGeometry(45, 32);
    const haloMaterial = new THREE.ShaderMaterial({
      uniforms: {
        opacity: { value: 0.0 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float opacity;
        varying vec2 vUv;
        void main() {
          // Distance from center
          float dist = length(vUv - vec2(0.5));
          // Gradient falloff
          float halo = smoothstep(0.5, 0.15, dist) * 0.4;
          // Subtle color tint (bluish-white)
          vec3 haloColor = vec3(0.8, 0.85, 1.0);
          gl_FragColor = vec4(haloColor, halo * opacity);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.haloMesh = new THREE.Mesh(haloGeometry, haloMaterial);
    this.haloMesh.position.z = -1; // Behind moon

    // Add to group
    this.group.add(this.haloMesh);
    this.group.add(this.moonMesh);

    // Position in sky (upper right area)
    this.group.position.set(150, 180, -200);
    this.group.lookAt(0, 0, 0);

    this.scene.add(this.group);
  }

  /**
   * Set moon visibility based on night amount
   * @param nightAmount 0 = day (invisible), 1 = full night (visible)
   */
  setNightAmount(nightAmount: number): void {
    // Moon only visible during night (nightAmount > 0.5)
    const visibility = Math.max(0, (nightAmount - 0.5) * 2);

    (this.moonMesh.material as THREE.MeshBasicMaterial).opacity = visibility * 0.95;
    (this.haloMesh.material as THREE.ShaderMaterial).uniforms.opacity.value = visibility;
  }

  dispose(): void {
    this.scene.remove(this.group);
    this.moonMesh.geometry.dispose();
    (this.moonMesh.material as THREE.Material).dispose();
    this.haloMesh.geometry.dispose();
    (this.haloMesh.material as THREE.Material).dispose();
  }
}
