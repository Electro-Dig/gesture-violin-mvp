import * as THREE from "three";

import type { PerformanceState } from "../music/performanceModel";
import { mapBowPose } from "./sceneLayout";

const IVORY = new THREE.Color("#f3e8d2");
const AMBER = new THREE.Color("#f19a38");
const VERMILION = new THREE.Color("#ff4d2e");
const ALIGNED = new THREE.Color("#9fd18f");

export class ViolinScene {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  private readonly instrument = new THREE.Group();
  private readonly bow = new THREE.Group();
  private readonly bowMaterials: THREE.MeshStandardMaterial[] = [];
  private readonly stringMaterials: THREE.MeshStandardMaterial[] = [];
  private readonly particles: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
  private readonly resizeObserver: ResizeObserver;
  private performance: PerformanceState | null = null;
  private guidance: number | null = null;
  private running = false;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.camera.position.set(0, 0.25, 8.1);
    this.camera.lookAt(0, 0.25, 0);

    this.scene.add(new THREE.AmbientLight("#7a4c35", 1.5));
    const key = new THREE.SpotLight("#ffd5a2", 70, 15, Math.PI / 5, 0.65, 1.2);
    key.position.set(-3.5, 5.5, 6);
    this.scene.add(key);
    const rim = new THREE.PointLight("#ff3f21", 25, 12, 1.5);
    rim.position.set(3.5, 1.5, 2);
    this.scene.add(rim);

    this.addStageHalo();
    this.buildInstrument();
    this.buildBow();
    this.particles = this.buildParticles();

    this.instrument.rotation.set(-0.08, -0.12, -0.025);
    this.instrument.position.set(0.25, -0.35, 0);
    this.instrument.scale.setScalar(0.92);
    this.scene.add(this.instrument, this.bow, this.particles);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas.parentElement ?? canvas);
    this.resize();
    this.renderFrame(0);
  }

  update(performance: PerformanceState): void {
    this.performance = performance;
  }

  setGuidance(alignment: number | null): void {
    this.guidance = alignment === null ? null : THREE.MathUtils.clamp(alignment, 0, 1);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.renderer.setAnimationLoop(this.renderFrame);
  }

  stop(): void {
    this.running = false;
    this.renderer.setAnimationLoop(null);
  }

  dispose(): void {
    this.stop();
    this.resizeObserver.disconnect();
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.Points) {
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => material.dispose());
      }
    });
    this.renderer.dispose();
  }

  private readonly renderFrame = (timeMs: number): void => {
    const delta = 1 / 60;
    const input = this.performance ?? {
      bowX: 0.5,
      pitch: 0.5,
      intensity: 0,
      direction: 0 as const,
      phase: "idle" as const,
    };
    const pose = mapBowPose(input);

    this.bow.position.x = THREE.MathUtils.damp(this.bow.position.x, pose.x, 9, delta);
    this.bow.position.y = THREE.MathUtils.damp(this.bow.position.y, pose.y, 9, delta);
    this.bow.rotation.z = THREE.MathUtils.damp(this.bow.rotation.z, pose.rotationZ, 10, delta);
    this.bowMaterials.forEach((material) => {
      material.opacity = THREE.MathUtils.damp(material.opacity, pose.opacity, 10, delta);
      material.emissiveIntensity = THREE.MathUtils.damp(
        material.emissiveIntensity,
        pose.glow * 0.24,
        10,
        delta,
      );
    });

    this.stringMaterials.forEach((material, index) => {
      const selected = index === pose.stringIndex;
      const guidedColor = this.guidance === null
        ? VERMILION
        : VERMILION.clone().lerp(ALIGNED, this.guidance);
      material.color.lerp(selected ? AMBER : IVORY, 0.16);
      material.emissive.lerp(selected ? guidedColor : new THREE.Color("#000000"), 0.16);
      material.emissiveIntensity = THREE.MathUtils.damp(
        material.emissiveIntensity,
        selected ? pose.glow : 0,
        12,
        delta,
      );
    });

    const particleMaterial = this.particles.material;
    particleMaterial.color.lerp(
      this.guidance === null ? AMBER : VERMILION.clone().lerp(ALIGNED, this.guidance),
      0.12,
    );
    particleMaterial.opacity = THREE.MathUtils.damp(
      particleMaterial.opacity,
      input.phase === "bowing" ? 0.2 + input.intensity * 0.65 : 0,
      8,
      delta,
    );
    this.particles.position.set(this.bow.position.x * 0.14 + 0.22, this.bow.position.y, 0.75);
    this.particles.rotation.z = timeMs * 0.00035;
    const pulse = input.phase === "bowing" ? 1 + Math.sin(timeMs * 0.018) * 0.035 : 1;
    this.instrument.scale.setScalar(0.92 * pulse);

    this.renderer.render(this.scene, this.camera);
  };

  private buildInstrument(): void {
    const wood = new THREE.MeshPhysicalMaterial({
      color: "#b9551e",
      roughness: 0.32,
      metalness: 0.02,
      clearcoat: 0.72,
      clearcoatRoughness: 0.22,
    });
    const darkWood = new THREE.MeshStandardMaterial({
      color: "#24130e",
      roughness: 0.48,
    });
    const maple = new THREE.MeshStandardMaterial({
      color: "#ce7934",
      roughness: 0.4,
    });

    const bodyGeometry = new THREE.ExtrudeGeometry(createBodyShape(), {
      depth: 0.38,
      bevelEnabled: true,
      bevelSegments: 5,
      bevelSize: 0.085,
      bevelThickness: 0.08,
      curveSegments: 20,
    });
    bodyGeometry.center();
    const body = new THREE.Mesh(bodyGeometry, wood);
    body.castShadow = true;
    this.instrument.add(body);

    const bodyEdge = new THREE.LineSegments(
      new THREE.EdgesGeometry(bodyGeometry, 28),
      new THREE.LineBasicMaterial({ color: "#5b2412", transparent: true, opacity: 0.42 }),
    );
    this.instrument.add(bodyEdge);

    const neck = new THREE.Mesh(new THREE.BoxGeometry(0.27, 1.85, 0.24, 2, 8, 2), maple);
    neck.position.set(0, 2.1, 0.02);
    this.instrument.add(neck);

    const fingerboard = new THREE.Mesh(new THREE.BoxGeometry(0.36, 2.65, 0.12), darkWood);
    fingerboard.position.set(0, 1.55, 0.28);
    fingerboard.scale.x = 0.8;
    this.instrument.add(fingerboard);

    const tailpiece = new THREE.Mesh(new THREE.CapsuleGeometry(0.23, 0.62, 7, 14), darkWood);
    tailpiece.position.set(0, -1.05, 0.33);
    tailpiece.scale.set(1, 1.2, 0.36);
    this.instrument.add(tailpiece);

    const bridge = new THREE.Mesh(
      new THREE.BoxGeometry(0.83, 0.1, 0.14),
      new THREE.MeshStandardMaterial({ color: "#e1ae6b", roughness: 0.62 }),
    );
    bridge.position.set(0, -0.12, 0.43);
    this.instrument.add(bridge);

    const pegbox = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.5, 8, 16), darkWood);
    pegbox.position.set(0, 3.22, 0.03);
    pegbox.scale.set(0.82, 1, 0.55);
    this.instrument.add(pegbox);

    const scroll = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.075, 12, 32), maple);
    scroll.position.set(0, 3.62, 0.04);
    this.instrument.add(scroll);

    [-1, 1].forEach((side) => {
      [-0.18, 0.2].forEach((offset, index) => {
        const peg = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.3, 5, 10), darkWood);
        peg.rotation.z = Math.PI / 2;
        peg.position.set(side * 0.34, 3.08 + offset + index * 0.04, 0.02);
        this.instrument.add(peg);
      });
    });

    [-1, 1].forEach((side) => this.instrument.add(createFHole(side)));
    this.addStrings();
  }

  private addStrings(): void {
    [-0.09, -0.03, 0.03, 0.09].forEach((x) => {
      const material = new THREE.MeshStandardMaterial({
        color: IVORY,
        emissive: "#000000",
        emissiveIntensity: 0,
        roughness: 0.3,
      });
      const string = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 4.5, 8), material);
      string.position.set(x, 0.95, 0.52);
      this.instrument.add(string);
      this.stringMaterials.push(material);
    });
  }

  private buildBow(): void {
    const stickMaterial = new THREE.MeshStandardMaterial({
      color: "#d8482c",
      emissive: "#63150f",
      emissiveIntensity: 0,
      roughness: 0.34,
      transparent: true,
      opacity: 0.38,
    });
    const hairMaterial = new THREE.MeshStandardMaterial({
      color: "#f4dec1",
      emissive: "#ff704a",
      emissiveIntensity: 0,
      roughness: 0.25,
      transparent: true,
      opacity: 0.38,
    });
    this.bowMaterials.push(stickMaterial, hairMaterial);

    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.055, 4.9, 12), stickMaterial);
    stick.rotation.z = Math.PI / 2;
    stick.position.y = 0.09;
    const hair = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 4.65, 8), hairMaterial);
    hair.rotation.z = Math.PI / 2;
    hair.position.y = -0.035;
    const frog = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 0.18, 0.16),
      new THREE.MeshStandardMaterial({ color: "#1d1210", roughness: 0.35 }),
    );
    frog.position.set(-2.18, 0.02, 0);

    this.bow.add(stick, hair, frog);
    this.bow.position.set(0, 0, 0.82);
  }

  private buildParticles(): THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial> {
    const positions = new Float32Array(54 * 3);
    for (let index = 0; index < 54; index += 1) {
      const angle = index * 2.39996;
      const radius = 0.03 + ((index * 17) % 19) * 0.008;
      positions[index * 3] = Math.cos(angle) * radius;
      positions[index * 3 + 1] = Math.sin(angle) * radius;
      positions[index * 3 + 2] = ((index % 7) - 3) * 0.015;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color: "#ffb36b",
      size: 0.035,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    return new THREE.Points(geometry, material);
  }

  private addStageHalo(): void {
    const halo = new THREE.Mesh(
      new THREE.RingGeometry(2.8, 2.82, 96),
      new THREE.MeshBasicMaterial({ color: "#7f2d1d", transparent: true, opacity: 0.34 }),
    );
    halo.position.set(0.2, 0.15, -0.6);
    this.scene.add(halo);

    const lineGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-4.6, -2.7, -0.7),
      new THREE.Vector3(4.6, -2.7, -0.7),
    ]);
    this.scene.add(
      new THREE.Line(
        lineGeometry,
        new THREE.LineBasicMaterial({ color: "#9b5035", transparent: true, opacity: 0.35 }),
      ),
    );
  }

  private resize(): void {
    const parent = this.canvas.parentElement;
    const width = Math.max(parent?.clientWidth ?? this.canvas.clientWidth, 1);
    const height = Math.max(parent?.clientHeight ?? this.canvas.clientHeight, 1);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }
}

function createBodyShape(): THREE.Shape {
  const shape = new THREE.Shape();
  shape.moveTo(0, -2.05);
  shape.bezierCurveTo(-0.58, -2.06, -1.06, -1.72, -1.02, -1.22);
  shape.bezierCurveTo(-0.98, -0.83, -0.62, -0.77, -0.65, -0.38);
  shape.bezierCurveTo(-0.68, -0.08, -0.98, 0.08, -0.94, 0.55);
  shape.bezierCurveTo(-0.9, 1.03, -0.48, 1.42, 0, 1.46);
  shape.bezierCurveTo(0.48, 1.42, 0.9, 1.03, 0.94, 0.55);
  shape.bezierCurveTo(0.98, 0.08, 0.68, -0.08, 0.65, -0.38);
  shape.bezierCurveTo(0.62, -0.77, 0.98, -0.83, 1.02, -1.22);
  shape.bezierCurveTo(1.06, -1.72, 0.58, -2.06, 0, -2.05);
  return shape;
}

function createFHole(side: number): THREE.Mesh {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(side * 0.52, 0.46, 0.43),
    new THREE.Vector3(side * 0.63, 0.18, 0.47),
    new THREE.Vector3(side * 0.49, -0.06, 0.48),
    new THREE.Vector3(side * 0.57, -0.38, 0.45),
  ]);
  const material = new THREE.MeshStandardMaterial({ color: "#29110b", roughness: 0.7 });
  return new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.035, 7, false), material);
}
