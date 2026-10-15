import * as THREE from "three";

/*
 * Maatje in 3D, procedureel opgebouwd zodat er geen los 3D-bestand nodig is.
 * Het lijf is een golvend bonnetje met donkerblauwe rand, het gezicht een
 * canvas-textuur (knipperen, ogen volgen je vinger, mond praat mee) en de
 * handjes zweven los naast het lijf, net als op de officiële mascotte.
 */

const NAVY = 0x0b2a6b;
const PAPER = 0xffffff;
const FACE_SIZE = 512;
const BODY_W = 1.5;
const BODY_H = 2.05;
const DEPTH = 0.1;

export interface MaatjeSceneController {
  /** Speelt een willekeurige vrolijke reactie (sprong, zwaai of giechel). */
  react(kind?: MaatjeReaction): void;
  /** Laat de mond meebewegen zolang Maatje praat. */
  setTalking(talking: boolean): void;
  dispose(): void;
}

export type MaatjeReaction = "jump" | "wave" | "giggle";

interface SceneOptions {
  reducedMotion: boolean;
  onTap?: () => void;
}

function toonGradient(): THREE.DataTexture {
  const data = new Uint8Array([90, 90, 90, 255, 185, 185, 185, 255, 255, 255, 255, 255]);
  const texture = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.needsUpdate = true;
  return texture;
}

/** Golvende bovenrand en onderrand, licht bolle zijkanten: het bonnetje. */
function receiptShape(): THREE.Shape {
  const shape = new THREE.Shape();
  const w = BODY_W / 2;
  const h = BODY_H / 2;
  const waves = 5;
  const amp = 0.055;
  const steps = 60;
  shape.moveTo(-w, -h);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = -w + t * BODY_W;
    shape.lineTo(x, -h + Math.sin(t * Math.PI * 2 * waves) * amp);
  }
  for (let i = 1; i <= 20; i++) {
    const t = i / 20;
    shape.lineTo(w + Math.sin(t * Math.PI) * 0.035, -h + t * BODY_H);
  }
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const x = w - t * BODY_W;
    shape.lineTo(x, h + Math.sin(t * Math.PI * 2 * waves) * amp);
  }
  for (let i = 1; i < 20; i++) {
    const t = i / 20;
    shape.lineTo(-w - Math.sin(t * Math.PI) * 0.035, h - t * BODY_H);
  }
  shape.closePath();
  return shape;
}

/** Buigt het bonnetje een beetje, zodat het als echt papier oogt. */
function bendPaper(geometry: THREE.BufferGeometry) {
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const curl = -0.16 * x * x + 0.05 * Math.sin(y * 1.6);
    position.setXYZ(i, x + 0.04 * Math.sin(y * 1.4), y, z + curl);
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
}

interface FaceState {
  blink: number;
  lookX: number;
  lookY: number;
  mouthOpen: number;
  happy: number;
}

function drawFace(ctx: CanvasRenderingContext2D, face: FaceState) {
  const s = FACE_SIZE;
  ctx.clearRect(0, 0, s, s);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // Kassabonregels.
  ctx.strokeStyle = "#9cc8fa";
  ctx.lineWidth = 15;
  for (const [x1, x2, y] of [[150, 380, 372], [150, 300, 412], [326, 370, 412], [150, 270, 452]]) {
    ctx.beginPath();
    ctx.moveTo(x1, y);
    ctx.lineTo(x2, y);
    ctx.stroke();
  }

  // Wangen.
  ctx.fillStyle = "rgba(140, 190, 250, 0.75)";
  for (const x of [148, 364]) {
    ctx.beginPath();
    ctx.ellipse(x, 252, 26, 15, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Wenkbrauwen gaan omhoog als Maatje blij is.
  ctx.strokeStyle = "#0b2a6b";
  ctx.lineWidth = 12;
  const browLift = face.happy * 10;
  for (const x of [196, 316]) {
    ctx.beginPath();
    ctx.moveTo(x - 30, 128 - browLift);
    ctx.quadraticCurveTo(x, 104 - browLift, x + 30, 124 - browLift);
    ctx.stroke();
  }

  // Ogen met glimlichtjes; ze volgen je vinger.
  const eyeOpen = Math.max(0.08, 1 - face.blink);
  for (const x of [200, 312]) {
    ctx.save();
    ctx.translate(x + face.lookX * 9, 196 + face.lookY * 7);
    ctx.scale(1, eyeOpen);
    ctx.fillStyle = "#0b2a6b";
    ctx.beginPath();
    ctx.ellipse(0, 0, 34, 46, 0, 0, Math.PI * 2);
    ctx.fill();
    if (eyeOpen > 0.4) {
      ctx.fillStyle = "white";
      ctx.beginPath();
      ctx.ellipse(10, -16, 12, 14, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(-10, 14, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Mond: een open lach die meebeweegt tijdens het praten.
  const open = 20 + face.mouthOpen * 34 + face.happy * 8;
  ctx.fillStyle = "#0b2a6b";
  ctx.beginPath();
  ctx.moveTo(206, 262);
  ctx.quadraticCurveTo(256, 276, 306, 262);
  ctx.quadraticCurveTo(300, 262 + open * 1.6, 256, 262 + open * 1.55);
  ctx.quadraticCurveTo(212, 262 + open * 1.6, 206, 262);
  ctx.fill();
  ctx.fillStyle = "#ed6780";
  ctx.beginPath();
  ctx.ellipse(262, 262 + open * 1.2, 26, Math.max(6, open * 0.42), 0, 0, Math.PI * 2);
  ctx.fill();
}

function outlined(geometry: THREE.BufferGeometry, material: THREE.Material, outline: THREE.Material, grow = 1.09) {
  const group = new THREE.Group();
  group.add(new THREE.Mesh(geometry, material));
  const hull = new THREE.Mesh(geometry, outline);
  hull.scale.setScalar(grow);
  group.add(hull);
  return group;
}

/** Een wit cartoonhandje met opgestoken duim. */
function buildHand(material: THREE.Material, outline: THREE.Material, mirror: boolean): THREE.Group {
  const hand = new THREE.Group();
  const palm = outlined(new THREE.SphereGeometry(0.2, 24, 18), material, outline, 1.1);
  palm.scale.set(1.05, 0.95, 0.85);
  hand.add(palm);
  const finger = new THREE.CapsuleGeometry(0.065, 0.13, 6, 12);
  for (let i = 0; i < 3; i++) {
    const f = outlined(finger, material, outline, 1.14);
    f.rotation.z = Math.PI / 2;
    f.position.set(mirror ? 0.06 : -0.06, -0.04 - i * 0.085, 0.13);
    hand.add(f);
  }
  const thumb = outlined(new THREE.CapsuleGeometry(0.075, 0.17, 6, 12), material, outline, 1.13);
  thumb.position.set(mirror ? -0.04 : 0.04, 0.2, 0.03);
  thumb.rotation.z = mirror ? 0.25 : -0.25;
  hand.add(thumb);
  return hand;
}

function shadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
  gradient.addColorStop(0, "rgba(3, 40, 110, 0.38)");
  gradient.addColorStop(1, "rgba(3, 40, 110, 0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
}

const easeOutBack = (t: number) => {
  const c = 1.9;
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
};

export function createMaatjeScene(container: HTMLElement, options: SceneOptions): MaatjeSceneController {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.className = "maatje-stage-canvas";
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 50);
  // Camera iets lager richten: Maatje staat dan hoger, met ruimte voor een chatbalk eronder.
  camera.position.set(0, -0.45, 6.4);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x8fbff5, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 1.8);
  sun.position.set(2.5, 3.5, 4);
  scene.add(sun);

  const gradient = toonGradient();
  const paper = new THREE.MeshToonMaterial({ color: PAPER, gradientMap: gradient });
  const glove = new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: gradient });
  const outline = new THREE.MeshBasicMaterial({ color: NAVY, side: THREE.BackSide });

  const root = new THREE.Group();
  scene.add(root);
  const body = new THREE.Group();
  root.add(body);

  const bodyGeometry = new THREE.ExtrudeGeometry(receiptShape(), {
    depth: DEPTH, bevelEnabled: true, bevelThickness: 0.035, bevelSize: 0.035, bevelSegments: 3, curveSegments: 4,
  });
  bodyGeometry.translate(0, 0, -DEPTH / 2);
  bendPaper(bodyGeometry);
  body.add(new THREE.Mesh(bodyGeometry, paper));
  const hull = new THREE.Mesh(bodyGeometry, outline);
  hull.scale.set(1.045, 1.035, 1.6);
  body.add(hull);

  const faceCanvas = document.createElement("canvas");
  faceCanvas.width = faceCanvas.height = FACE_SIZE;
  const faceContext = faceCanvas.getContext("2d")!;
  const faceTexture = new THREE.CanvasTexture(faceCanvas);
  faceTexture.colorSpace = THREE.SRGBColorSpace;
  faceTexture.anisotropy = 4;
  const faceGeometry = new THREE.PlaneGeometry(BODY_W * 0.98, BODY_W * 0.98, 24, 24);
  faceGeometry.translate(0, 0.12, DEPTH / 2 + 0.04);
  bendPaper(faceGeometry);
  const faceMesh = new THREE.Mesh(faceGeometry, new THREE.MeshBasicMaterial({ map: faceTexture, transparent: true }));
  body.add(faceMesh);

  const leftHand = buildHand(glove, outline, false);
  const rightHand = buildHand(glove, outline, true);
  leftHand.position.set(-0.98, -0.3, 0.38);
  rightHand.position.set(0.98, -0.3, 0.38);
  leftHand.scale.setScalar(1.15);
  rightHand.scale.setScalar(1.15);
  root.add(leftHand, rightHand);

  // Kleine "blije streepjes" naast de handjes, zoals op het logo.
  const sparkGeometry = new THREE.CapsuleGeometry(0.03, 0.14, 4, 8);
  const sparkMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const sparks: THREE.Mesh[] = [];
  for (const [x, y, r] of [[-1.22, 0.32, 0.5], [-1.36, 0.02, 1.3], [1.22, 0.32, -0.5], [1.36, 0.02, -1.3]] as const) {
    const spark = new THREE.Mesh(sparkGeometry, sparkMaterial);
    spark.position.set(x, y, 0.1);
    spark.rotation.z = r;
    sparks.push(spark);
    root.add(spark);
  }

  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.7), new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -1.45;
  scene.add(shadow);

  const face: FaceState = { blink: 0, lookX: 0, lookY: 0, mouthOpen: 0, happy: 0 };
  const look = { x: 0, y: 0 };
  let talking = false;
  let nextBlink = 1.8;
  let blinkStart = -1;
  let reaction: { kind: MaatjeReaction; start: number } | null = null;
  const enterStart = performance.now() / 1000;
  const enterDuration = options.reducedMotion ? 0.25 : 1.1;
  let dragYaw = 0;
  let dragVelocity = 0;
  let dragging: { x: number; startX: number; startY: number; moved: boolean } | null = null;
  let disposed = false;
  let frame = 0;

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  function resize() {
    const { clientWidth: width, clientHeight: height } = container;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    // Afstand zo kiezen dat Maatje mét handjes altijd in beeld past.
    const halfFov = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    camera.position.z = Math.max(1.75 / halfFov, 1.5 / (halfFov * camera.aspect));
    camera.updateProjectionMatrix();
  }
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);
  resize();

  function updatePointer(event: PointerEvent) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    look.x = THREE.MathUtils.clamp(pointer.x * 1.6, -1, 1);
    look.y = THREE.MathUtils.clamp(-pointer.y * 1.6, -1, 1);
  }
  function hitsMaatje(): boolean {
    raycaster.setFromCamera(pointer, camera);
    return raycaster.intersectObject(root, true).length > 0;
  }
  const onPointerDown = (event: PointerEvent) => {
    updatePointer(event);
    dragging = { x: event.clientX, startX: event.clientX, startY: event.clientY, moved: false };
    renderer.domElement.setPointerCapture?.(event.pointerId);
  };
  const onPointerMove = (event: PointerEvent) => {
    updatePointer(event);
    if (!dragging) return;
    const dx = event.clientX - dragging.x;
    dragging.x = event.clientX;
    if (Math.abs(event.clientX - dragging.startX) + Math.abs(event.clientY - dragging.startY) > 8) dragging.moved = true;
    if (dragging.moved) {
      dragYaw += dx * 0.012;
      dragVelocity = dx * 0.012;
    }
  };
  const onPointerUp = (event: PointerEvent) => {
    updatePointer(event);
    const wasTap = dragging && !dragging.moved;
    dragging = null;
    if (wasTap && hitsMaatje()) {
      controller.react();
      options.onTap?.();
    }
  };
  const canvas = renderer.domElement;
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);

  function tick() {
    if (disposed) return;
    frame = requestAnimationFrame(tick);
    const now = performance.now() / 1000;
    const t = now - enterStart;
    const motion = options.reducedMotion ? 0.25 : 1;

    // Binnenkomst: Maatje ploft tevoorschijn en draait naar je toe.
    const enter = Math.min(1, t / enterDuration);
    const pop = options.reducedMotion ? enter : easeOutBack(enter);
    root.scale.setScalar(Math.max(0.001, pop));
    let yaw = options.reducedMotion ? 0 : (1 - enter) * -Math.PI * 1.5;

    // Zweven en ademen.
    let y = Math.sin(t * 2.1) * 0.06 * motion;
    let squash = 1 + Math.sin(t * 4.2) * 0.012 * motion;
    let roll = Math.sin(t * 1.3) * 0.04 * motion;
    let leftLift = Math.sin(t * 2.1 + 0.6) * 0.05 * motion;
    let rightLift = Math.sin(t * 2.1 + 1.4) * 0.05 * motion;
    let rightWave = 0;
    face.happy = THREE.MathUtils.lerp(face.happy, talking ? 0.6 : 0.3, 0.05);

    if (reaction) {
      const r = (now - reaction.start) / (options.reducedMotion ? 0.6 : 1.1);
      if (r >= 1) reaction = null;
      else if (reaction.kind === "jump") {
        y += Math.sin(r * Math.PI) * 0.75 * motion;
        yaw += options.reducedMotion ? 0 : r * Math.PI * 2;
        squash *= r < 0.12 ? 1 - r * 1.2 : 1;
        leftLift += Math.sin(r * Math.PI) * 0.35;
        rightLift += Math.sin(r * Math.PI) * 0.35;
        face.happy = 1;
      } else if (reaction.kind === "wave") {
        rightLift += Math.sin(r * Math.PI) * 0.7;
        rightWave = Math.sin(r * Math.PI * 6) * 0.5 * Math.sin(r * Math.PI);
        face.happy = 1;
      } else {
        squash *= 1 + Math.sin(r * Math.PI * 8) * 0.05 * (1 - r);
        roll += Math.sin(r * Math.PI * 6) * 0.08 * (1 - r);
        face.happy = 1;
        face.blink = 0.85;
      }
    }

    // Loslaten na draaien: zacht terugveren naar voren.
    if (!dragging) {
      dragYaw += dragVelocity;
      dragVelocity *= 0.9;
      dragYaw *= 0.93;
    }

    root.position.y = y;
    root.rotation.set(-look.y * 0.08, yaw + dragYaw + look.x * 0.25, roll - 0.05);
    body.scale.set(1 / Math.sqrt(squash), squash, 1);
    leftHand.position.y = -0.3 + leftLift;
    rightHand.position.y = -0.3 + rightLift;
    rightHand.rotation.z = rightWave;
    sparks.forEach((spark, i) => {
      const pulse = 0.75 + Math.sin(t * 3 + i) * 0.25;
      spark.scale.setScalar(pulse);
    });
    shadow.scale.setScalar(1 - y * 0.35);

    // Knipperen op willekeurige momenten.
    if (blinkStart < 0 && t > nextBlink) blinkStart = t;
    if (blinkStart >= 0) {
      const b = (t - blinkStart) / 0.16;
      if (!(reaction?.kind === "giggle")) face.blink = b < 1 ? Math.sin(b * Math.PI) : 0;
      if (b >= 1) {
        blinkStart = -1;
        nextBlink = t + 2.2 + Math.random() * 2.8;
      }
    } else if (!(reaction?.kind === "giggle")) face.blink = 0;

    face.lookX = THREE.MathUtils.lerp(face.lookX, look.x, 0.12);
    face.lookY = THREE.MathUtils.lerp(face.lookY, look.y, 0.12);
    const targetMouth = talking ? (Math.sin(now * 17) * 0.5 + 0.5) * (0.6 + Math.sin(now * 5.3) * 0.4) : 0;
    face.mouthOpen = THREE.MathUtils.lerp(face.mouthOpen, targetMouth, 0.35);
    drawFace(faceContext, face);
    faceTexture.needsUpdate = true;

    renderer.render(scene, camera);
  }
  tick();

  const onVisibility = () => {
    if (document.hidden) cancelAnimationFrame(frame);
    else if (!disposed) {
      cancelAnimationFrame(frame);
      tick();
    }
  };
  document.addEventListener("visibilitychange", onVisibility);

  const controller: MaatjeSceneController = {
    react(kind) {
      const kinds: MaatjeReaction[] = ["jump", "wave", "giggle"];
      reaction = { kind: kind ?? kinds[Math.floor(Math.random() * kinds.length)], start: performance.now() / 1000 };
    },
    setTalking(value) {
      talking = value;
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      scene.traverse(object => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach(material => {
            (material as THREE.MeshBasicMaterial).map?.dispose();
            material.dispose();
          });
        }
      });
      gradient.dispose();
      renderer.dispose();
      canvas.remove();
    },
  };
  return controller;
}
