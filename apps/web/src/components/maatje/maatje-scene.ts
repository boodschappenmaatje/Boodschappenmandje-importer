import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import model from "./maatje-model.json";

/*
 * Maatje in 3D, opgebouwd uit het officiële Home-plaatje. De vormen
 * (lijf, handjes, streepjes, ogen, mond, wenkbrauwen) zijn uit dat plaatje
 * gehaald (scripts/maatje-3d/build.py) en dik gemaakt; het plaatje zelf is
 * de textuur. Van voren ziet hij er daardoor precies zo uit als op Home,
 * maar hij heeft echte diepte, glans en losse bewegende delen.
 *
 * Modelcoördinaten: het beeldvierkant van het Home-plaatje loopt van -1
 * tot 1 (y omhoog). Zo kan de scène hem exact over het plaatje leggen.
 */

type Point = [number, number];
type PartName = "eyeL" | "eyeR" | "mouth" | "browL" | "browR";
interface PartData { min: Point; max: Point; contour: Point[] }
const MODEL = model as unknown as {
  rim: number;
  body: Point[];
  hands: Point[][];
  sparks: Point[][];
  parts: Record<PartName, PartData>;
};

const BODY_DEPTH = 0.1;
const BODY_BEVEL = 0.075;
const BODY_FRONT = BODY_DEPTH / 2 + BODY_BEVEL;
const CURL = 0.07;
const FOV = 20;
const CAMERA_Z = 14;

export type MaatjeReaction = "jump" | "wave" | "giggle";

export interface MaatjeSceneOptions {
  reducedMotion: boolean;
  /** Plek van het Home-plaatje; daar begint en eindigt Maatje. */
  anchor: () => DOMRect;
  /** Plek waar Maatje naartoe komt als hij tot leven komt. */
  target: () => DOMRect;
  onReady?: () => void;
  onTap?: () => void;
  onTapOutside?: () => void;
}

export interface MaatjeSceneController {
  /** Maatje wordt wakker en komt naar voren. */
  wake(): void;
  react(kind?: MaatjeReaction): void;
  setTalking(talking: boolean): void;
  /** Laat Maatje terugvliegen naar zijn plek op Home, waar hij weer indommelt. */
  close(): Promise<void>;
  dispose(): void;
}

const projectUv = {
  generateTopUV(_g: THREE.ExtrudeGeometry, v: number[], a: number, b: number, c: number) {
    return [a, b, c].map(i => new THREE.Vector2((v[i * 3] + 1) / 2, (v[i * 3 + 1] + 1) / 2));
  },
  generateSideWallUV(_g: THREE.ExtrudeGeometry, v: number[], a: number, b: number, c: number, d: number) {
    return [a, b, c, d].map(i => new THREE.Vector2((v[i * 3] + 1) / 2, (v[i * 3 + 1] + 1) / 2));
  },
};

function shapeOf(points: Point[], origin: Point = [0, 0]): THREE.Shape {
  return new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x - origin[0], y - origin[1])));
}

/** Dik, afgerond gemaakt silhouet met de textuur recht van voren geprojecteerd. */
function puffy(points: Point[], depth: number, bevel: number, origin: Point = [0, 0], segments = 5, bevelSize = bevel * 0.7): THREE.BufferGeometry {
  const uv = {
    generateTopUV: (g: THREE.ExtrudeGeometry, v: number[], a: number, b: number, c: number) =>
      projectUv.generateTopUV(g, v.map((n, i) => i % 3 === 0 ? n + origin[0] : i % 3 === 1 ? n + origin[1] : n), a, b, c),
    generateSideWallUV: (g: THREE.ExtrudeGeometry, v: number[], a: number, b: number, c: number, d: number) =>
      projectUv.generateSideWallUV(g, v.map((n, i) => i % 3 === 0 ? n + origin[0] : i % 3 === 1 ? n + origin[1] : n), a, b, c, d),
  };
  const geometry = new THREE.ExtrudeGeometry(shapeOf(points, origin), {
    depth, bevelEnabled: true, bevelThickness: bevel, bevelSize, bevelOffset: -bevelSize,
    bevelSegments: segments, curveSegments: 1, UVGenerator: uv,
  });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

/**
 * Verdeelt driehoeken in voorkant (groep 0), achterkant (groep 1) en de
 * afgeronde zijkant (groep 2), zodat de zijkant een eigen effen kleur krijgt.
 */
function splitFaces(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  const source = geometry.index ? geometry.toNonIndexed() : geometry;
  const position = source.attributes.position;
  let maxZ = -Infinity;
  let minZ = Infinity;
  for (let i = 0; i < position.count; i++) {
    maxZ = Math.max(maxZ, position.getZ(i));
    minZ = Math.min(minZ, position.getZ(i));
  }
  const groups: number[][] = [[], [], []];
  const eps = 1e-5;
  for (let i = 0; i < position.count; i += 3) {
    const zs = [position.getZ(i), position.getZ(i + 1), position.getZ(i + 2)];
    const group = zs.every(z => z > maxZ - eps) ? 0 : zs.every(z => z < minZ + eps) ? 1 : 2;
    groups[group].push(i);
  }
  const order = groups.flat();
  const result = new THREE.BufferGeometry();
  for (const name of Object.keys(source.attributes)) {
    const attribute = source.attributes[name] as THREE.BufferAttribute;
    const array = new Float32Array(order.length * 3 * attribute.itemSize);
    order.forEach((start, t) => {
      for (let k = 0; k < 3; k++) {
        for (let c = 0; c < attribute.itemSize; c++) {
          array[(t * 3 + k) * attribute.itemSize + c] = attribute.array[(start + k) * attribute.itemSize + c];
        }
      }
    });
    result.setAttribute(name, new THREE.BufferAttribute(array, attribute.itemSize));
  }
  let offset = 0;
  groups.forEach((list, index) => {
    result.addGroup(offset, list.length * 3, index);
    offset += list.length * 3;
  });
  return result;
}

/** Het papier krult licht naar achteren; ook gezichtsdelen volgen die bolling. */
const curl = (x: number) => -CURL * x * x;

function curlGeometry(geometry: THREE.BufferGeometry, offsetX = 0) {
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i++) position.setZ(i, position.getZ(i) + curl(position.getX(i) + offsetX));
  position.needsUpdate = true;
  geometry.computeVertexNormals();
}

function centerOf(points: Point[]): Point {
  const xs = points.map(p => p[0]);
  const ys = points.map(p => p[1]);
  return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
}

const easeInOut = (t: number) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const smoothstep = (t: number) => t * t * (3 - 2 * t);
const easeOutBack = (t: number) => t <= 0 ? 0 : 1 + 2.7 * Math.pow(t - 1, 3) + 1.7 * Math.pow(t - 1, 2);
/** Waar t tussen a en b zit, als 0..1. */
const range = (t: number, a: number, b: number) => THREE.MathUtils.clamp((t - a) / (b - a), 0, 1);
/** Zacht heen en terug: 0 → 1 → 0. */
const bell = (t: number) => Math.sin(t * Math.PI) ** 2;

function loadTexture(loader: THREE.TextureLoader, url: string): Promise<THREE.Texture> {
  return new Promise((resolve, reject) => loader.load(url, texture => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    resolve(texture);
  }, undefined, reject));
}

export async function createMaatjeScene(container: HTMLElement, options: MaatjeSceneOptions): Promise<MaatjeSceneController> {
  const loader = new THREE.TextureLoader();
  const [original, frontMap, backMap, partsMap] = await Promise.all([
    loadTexture(loader, "/branding/maatje-3d/original.webp"),
    loadTexture(loader, "/branding/maatje-3d/front.webp"),
    loadTexture(loader, "/branding/maatje-3d/back.webp"),
    loadTexture(loader, "/branding/maatje-3d/parts.webp"),
  ]);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 3));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  const anisotropy = renderer.capabilities.getMaxAnisotropy();
  [original, frontMap, backMap, partsMap].forEach(texture => {
    texture.anisotropy = anisotropy;
  });
  const canvas = renderer.domElement;
  canvas.className = "maatje-live-canvas";
  container.appendChild(canvas);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = environment;
  scene.environmentIntensity = 0.25;
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);
  camera.position.set(0, 0, CAMERA_Z);
  // Strijklicht van linksboven: de voorkant blijft vrijwel gelijk aan het
  // plaatje, de bolle randen krijgen licht en schaduw.
  const key = new THREE.DirectionalLight(0xffffff, 0.8);
  key.position.set(-5, 6, 1.5);
  scene.add(key, new THREE.AmbientLight(0xffffff, 0.05));

  // Glanzend vinyl-speelgoed: de textuur licht zelf op (zodat de kleuren
  // gelijk blijven aan het plaatje); licht en omgeving geven glans en diepte.
  const vinyl = (map: THREE.Texture, extra: THREE.MeshPhysicalMaterialParameters = {}) => new THREE.MeshPhysicalMaterial({
    map, emissiveMap: map, emissive: 0xffffff, emissiveIntensity: 0.56, roughness: 0.5, metalness: 0,
    clearcoat: 0.55, clearcoatRoughness: 0.25, ...extra,
  });
  // De afgeronde zijkanten zijn effen donkerblauw (rand) of wit (streepjes).
  const solid = (color: number) => new THREE.MeshPhysicalMaterial({
    color, roughness: 0.32, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.18,
  });
  const materials = [
    vinyl(frontMap), vinyl(backMap), vinyl(original), vinyl(partsMap, { transparent: true, alphaTest: 0.04 }),
    solid(0x123a8c), solid(0xf4f8fd), solid(0x0a1f52),
  ];
  const [frontMaterial, backMaterial, originalMaterial, partsMaterial, rimMaterial, whiteMaterial, partDarkMaterial] = materials;

  const root = new THREE.Group();
  const figure = new THREE.Group();
  root.add(figure);
  scene.add(root);

  const bodyGeometry = splitFaces(puffy(MODEL.body, BODY_DEPTH, BODY_BEVEL, [0, 0], 10));
  curlGeometry(bodyGeometry);
  const body = new THREE.Mesh(bodyGeometry, [frontMaterial, backMaterial, rimMaterial]);
  figure.add(body);

  const frontZ = (x: number) => BODY_FRONT + curl(x);

  function part(name: PartName, depth: number, pivot: "center" | "top" = "center") {
    const data = MODEL.parts[name];
    const [cx, cy] = centerOf(data.contour);
    const origin: Point = [cx, pivot === "top" ? data.max[1] : cy];
    const geometry = splitFaces(puffy(data.contour, 0.001, depth, origin, 6, depth * 0.5));
    const mesh = new THREE.Mesh(geometry, [partsMaterial, partsMaterial, partDarkMaterial]);
    mesh.position.set(origin[0], origin[1], frontZ(cx) + depth * 0.4);
    mesh.rotation.y = Math.atan(2 * CURL * cx);
    figure.add(mesh);
    return mesh;
  }
  const eyes = [part("eyeL", 0.035), part("eyeR", 0.035)];
  const mouth = part("mouth", 0.012, "top");
  const brows = [part("browL", 0.022), part("browR", 0.022)];
  const eyeHome = eyes.map(eye => eye.position.clone());
  const browHome = brows.map(brow => brow.position.clone());

  // Handjes draaien rond hun pols (onderkant) voor zwaaien en duim-wiebelen.
  const hands = MODEL.hands.map(points => {
    const [cx] = centerOf(points);
    const bottom = Math.min(...points.map(p => p[1]));
    const pivot: Point = [cx, bottom + 0.08];
    const mesh = new THREE.Mesh(splitFaces(puffy(points, 0.16, 0.09, pivot, 10, 0.028)), [originalMaterial, originalMaterial, rimMaterial]);
    const group = new THREE.Group();
    group.position.set(pivot[0], pivot[1], BODY_FRONT + 0.06);
    group.add(mesh);
    figure.add(group);
    return group;
  });
  const handHome = hands.map(hand => hand.position.y);

  const sparks = MODEL.sparks.map(points => {
    const center = centerOf(points);
    const mesh = new THREE.Mesh(splitFaces(puffy(points, 0.02, 0.025, center, 6)), [originalMaterial, originalMaterial, whiteMaterial]);
    mesh.position.set(center[0], center[1], 0.05);
    figure.add(mesh);
    return mesh;
  });

  // Zachte schaduw onder Maatje, zodat hij boven de app lijkt te zweven.
  const shadowCanvas = document.createElement("canvas");
  shadowCanvas.width = shadowCanvas.height = 128;
  const shadowContext = shadowCanvas.getContext("2d")!;
  const shadowGradient = shadowContext.createRadialGradient(64, 64, 2, 64, 64, 62);
  shadowGradient.addColorStop(0, "rgba(3, 40, 110, 0.32)");
  shadowGradient.addColorStop(1, "rgba(3, 40, 110, 0)");
  shadowContext.fillStyle = shadowGradient;
  shadowContext.fillRect(0, 0, 128, 128);
  const shadowTexture = new THREE.CanvasTexture(shadowCanvas);
  const shadowMaterial = new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false, opacity: 0 });
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.32), shadowMaterial);
  shadow.renderOrder = -1;
  scene.add(shadow);

  // ----- Plaatsing in schermcoördinaten -----
  let viewport = { width: 1, height: 1 };
  function resize() {
    viewport = { width: container.clientWidth || window.innerWidth, height: container.clientHeight || window.innerHeight };
    renderer.setSize(viewport.width, viewport.height, false);
    camera.aspect = viewport.width / viewport.height;
    camera.updateProjectionMatrix();
  }
  resize();
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);

  function place(rect: DOMRect) {
    const worldPerPixel = (2 * CAMERA_Z * Math.tan(THREE.MathUtils.degToRad(FOV / 2))) / viewport.height;
    const box = container.getBoundingClientRect();
    return {
      x: (rect.left + rect.width / 2 - box.left - viewport.width / 2) * worldPerPixel,
      y: -(rect.top + rect.height / 2 - box.top - viewport.height / 2) * worldPerPixel,
      scale: (rect.width * worldPerPixel) / 2,
    };
  }

  // ----- Interactie -----
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const look = { x: 0, y: 0 };
  let drag: { x: number; startX: number; startY: number; moved: boolean } | null = null;
  let dragYaw = 0;
  const MAX_TURN = 0.85;
  let dragVelocity = 0;

  function setPointer(event: PointerEvent) {
    const box = canvas.getBoundingClientRect();
    pointer.set(((event.clientX - box.left) / box.width) * 2 - 1, -((event.clientY - box.top) / box.height) * 2 + 1);
    const center = new THREE.Vector3().setFromMatrixPosition(root.matrixWorld).project(camera);
    look.x = THREE.MathUtils.clamp((pointer.x - center.x) * 2.5, -1, 1);
    look.y = THREE.MathUtils.clamp((pointer.y - center.y) * 2.5, -1, 1);
  }
  const hits = () => {
    raycaster.setFromCamera(pointer, camera);
    return raycaster.intersectObject(figure, true).length > 0;
  };
  const onDown = (event: PointerEvent) => {
    setPointer(event);
    drag = { x: event.clientX, startX: event.clientX, startY: event.clientY, moved: false };
    canvas.setPointerCapture?.(event.pointerId);
  };
  const onMove = (event: PointerEvent) => {
    setPointer(event);
    if (!drag) return;
    const dx = event.clientX - drag.x;
    drag.x = event.clientX;
    if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 8) drag.moved = true;
    if (drag.moved && phase === "live") {
      dragYaw = THREE.MathUtils.clamp(dragYaw + dx * 0.013, -2 * MAX_TURN, 2 * MAX_TURN);
      dragVelocity = dx * 0.013;
    }
  };
  const onUp = (event: PointerEvent) => {
    setPointer(event);
    const tap = drag && !drag.moved;
    drag = null;
    if (!tap || phase !== "live") return;
    if (hits()) {
      controller.react();
      options.onTap?.();
    } else options.onTapOutside?.();
  };
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onUp);

  // ----- Animatie -----
  // Maatje slaapt op Home (ogen dicht, rustig ademen). Bij tikken wordt hij
  // wakker, rekt zich uit en komt naar voren; daarna leeft hij. Bij teruggaan
  // vliegt hij terug naar zijn plek en dommelt weer in.
  const motion = options.reducedMotion ? 0.2 : 1;
  const wakeDuration = options.reducedMotion ? 0.25 : 1.9;
  const leaveDuration = options.reducedMotion ? 0.2 : 0.75;
  const DOZE = 1.4;
  let phase: "sleeping" | "waking" | "live" | "leaving" = "sleeping";
  let phaseStart = performance.now() / 1000;
  let leaveFrom = { x: 0, y: 0, scale: 1, yaw: 0 };
  let resolveClose: (() => void) | null = null;
  let reaction: { kind: MaatjeReaction; start: number } | null = null;
  let talking = false;
  let mouthOpen = 1;
  let blink = 0;
  let nextBlink = performance.now() / 1000 + 2.2;
  let blinkStart = -1;
  let happy = 0;
  let frame = 0;
  let disposed = false;
  let readySent = false;
  let lastRender = 0;
  let wasVisible = true;
  const lookSmooth = { x: 0, y: 0 };

  function tick() {
    if (disposed) return;
    frame = requestAnimationFrame(tick);
    const now = performance.now() / 1000;
    const t = now - phaseStart;
    const anchorRect = options.anchor();
    const from = place(anchorRect);
    const to = place(options.target());

    // Slapend is er weinig beweging: 30 beelden per seconde is genoeg, en
    // buiten beeld tekenen we niets.
    if (phase === "sleeping" && readySent) {
      const visible = anchorRect.bottom > -40 && anchorRect.top < viewport.height + 40;
      if (!visible && !wasVisible) return;
      wasVisible = visible;
      if (now - lastRender < 1 / 30) return;
    }
    lastRender = now;

    let x = from.x;
    let y = from.y;
    let scale = from.scale;
    let yaw = 0;
    let pitch = 0;
    let lift = 0;
    let live = 0;
    // sleep: 1 = diep in slaap, 0 = klaarwakker.
    let sleep = 1;
    let stretch = 0;
    let wave = 0;
    let sparkAmount = 0;
    let wakeBlink = 0;

    if (phase === "sleeping") {
      sleep = smoothstep(Math.min(1, t / DOZE));
      sparkAmount = 1 - sleep;
    } else if (phase === "waking") {
      const p = Math.min(1, t / wakeDuration);
      if (options.reducedMotion) {
        const e = easeInOut(p);
        x = THREE.MathUtils.lerp(from.x, to.x, e);
        y = THREE.MathUtils.lerp(from.y, to.y, e);
        scale = THREE.MathUtils.lerp(from.scale, to.scale, e);
        sleep = 1 - e;
        sparkAmount = e;
        live = e;
      } else {
        // Ogen gaan langzaam open, met één slaperige knipper.
        sleep = 1 - smoothstep(range(p, 0, 0.42));
        wakeBlink = bell(range(p, 0.4, 0.52));
        // Uitrekken met een kleine geeuw, armpjes omhoog.
        stretch = bell(range(p, 0.06, 0.5));
        // Dan naar voren komen en groter worden, met een klein boogje.
        const travel = easeInOut(range(p, 0.3, 0.78));
        x = THREE.MathUtils.lerp(from.x, to.x, travel);
        y = THREE.MathUtils.lerp(from.y, to.y, travel);
        scale = THREE.MathUtils.lerp(from.scale, to.scale, travel);
        lift = Math.sin(travel * Math.PI) * 0.1 * to.scale;
        yaw = Math.sin(travel * Math.PI) * 0.22;
        // Glinsters springen tevoorschijn en hij zwaait hallo.
        sparkAmount = easeOutBack(range(p, 0.55, 0.8));
        wave = Math.sin(range(p, 0.74, 1) * Math.PI);
        live = smoothstep(range(p, 0.35, 1));
      }
      if (p >= 1) {
        phase = "live";
        phaseStart = now;
      }
    } else if (phase === "leaving") {
      const p = Math.min(1, t / leaveDuration);
      const e = easeInOut(p);
      x = THREE.MathUtils.lerp(leaveFrom.x, from.x, e);
      y = THREE.MathUtils.lerp(leaveFrom.y, from.y, e);
      scale = THREE.MathUtils.lerp(leaveFrom.scale, from.scale, e);
      yaw = THREE.MathUtils.lerp(leaveFrom.yaw, 0, e);
      lift = Math.sin(e * Math.PI) * 0.06 * leaveFrom.scale;
      live = 1 - e;
      sleep = 0;
      sparkAmount = 1;
      if (p >= 1) {
        // Terug op zijn plek: hij dommelt weer in.
        phase = "sleeping";
        phaseStart = now;
        sleep = 0;
        if (resolveClose) {
          const done = resolveClose;
          resolveClose = null;
          done();
        }
      }
    } else {
      x = to.x;
      y = to.y;
      scale = to.scale;
      live = 1;
      sleep = 0;
      sparkAmount = 1;
    }

    // Leven: zweven, wiegen (laat de diepte zien) en ademen.
    const bob = Math.sin(now * 2) * 0.03 * motion * live;
    const sway = Math.sin(now * 0.9) * 0.2 * motion * live;
    // Slapen: diep en langzaam ademen, hoofdje licht voorover en opzij.
    const breath = Math.sin(now * 1.7);
    let squash = (1 + Math.sin(now * 4) * 0.01 * motion * live) * (1 + breath * 0.018 * motion * sleep) * (1 + stretch * 0.07);
    let roll = Math.sin(now * 1.3) * 0.03 * motion * live + 0.05 * sleep + Math.sin(now * 0.85) * 0.012 * motion * sleep;
    pitch += 0.07 * sleep - stretch * 0.1;
    let handLift = [Math.sin(now * 2 + 0.7), Math.sin(now * 2 + 1.6)].map(v => v * 0.025 * motion * live);
    const handTwist = [Math.sin(now * 3.1) * 0.06 * motion * live, -Math.sin(now * 2.7) * 0.06 * motion * live];
    handLift = handLift.map((v, i) => v - 0.035 * sleep + breath * 0.008 * sleep + stretch * 0.2 + (i === 1 ? wave * 0.2 : 0));
    let waveAngle = wave * Math.sin(now * 13) * 0.42;
    happy = THREE.MathUtils.lerp(happy, talking ? 0.7 : 0.25 * (1 - sleep), 0.06);
    let giggle = false;

    if (reaction) {
      const r = (now - reaction.start) / (options.reducedMotion ? 0.5 : 1.05);
      if (r >= 1) reaction = null;
      else if (reaction.kind === "jump") {
        lift += Math.sin(r * Math.PI) * 0.45 * motion;
        yaw += options.reducedMotion ? 0 : easeInOut(r) * Math.PI * 2;
        squash *= r < 0.14 ? 1 - Math.sin((r / 0.14) * Math.PI) * 0.08 : 1;
        handLift = handLift.map(v => v + Math.sin(r * Math.PI) * 0.12);
        happy = 1;
      } else if (reaction.kind === "wave") {
        waveAngle = Math.sin(r * Math.PI * 6) * 0.45 * Math.sin(r * Math.PI);
        handLift[1] += Math.sin(r * Math.PI) * 0.18;
        happy = 1;
      } else {
        squash *= 1 + Math.sin(r * Math.PI * 9) * 0.04 * (1 - r);
        roll += Math.sin(r * Math.PI * 7) * 0.07 * (1 - r);
        happy = 1;
        giggle = true;
      }
    }

    if (!drag) {
      dragYaw += dragVelocity;
      dragVelocity *= 0.86;
      dragYaw *= 0.92;
    }
    // Zachte rem: van opzij is Maatje een dun vel, dus hij draait hooguit ~50°.
    const turned = MAX_TURN * Math.tanh(dragYaw / MAX_TURN);
    lookSmooth.x = THREE.MathUtils.lerp(lookSmooth.x, phase === "live" ? look.x : 0, 0.1);
    lookSmooth.y = THREE.MathUtils.lerp(lookSmooth.y, phase === "live" ? look.y : 0, 0.1);

    root.position.set(x, y + (lift + bob) * scale, 0);
    root.scale.setScalar(scale);
    pitch += -lookSmooth.y * 0.12 * live;
    root.rotation.set(pitch, yaw + sway + turned + lookSmooth.x * 0.3 * live, roll);
    figure.scale.set(1 / Math.sqrt(squash), squash, 1);
    const hover = (lift + bob) * scale;
    shadow.position.set(x, y - 0.98 * scale, -0.5 * scale);
    shadow.scale.setScalar(scale * (1 - Math.min(0.4, hover / scale)));
    shadowMaterial.opacity = live * (1 - Math.min(0.6, (hover / scale) * 1.5));

    hands.forEach((hand, i) => {
      hand.position.y = handHome[i] + handLift[i];
      hand.rotation.z = handTwist[i] + (i === 1 ? -waveAngle : 0);
    });
    sparks.forEach((spark, i) => spark.scale.setScalar(Math.max(0.001, sparkAmount * (1 + Math.sin(now * 3.4 + i * 1.3) * 0.12 * live))));

    // Gezicht: knipperen, meekijken, praten en blij kijken.
    if (blinkStart < 0 && now > nextBlink) blinkStart = now;
    if (blinkStart >= 0) {
      const b = (now - blinkStart) / 0.15;
      blink = b < 1 ? Math.sin(b * Math.PI) : 0;
      if (b >= 1) {
        blinkStart = -1;
        nextBlink = now + 2 + Math.random() * 3;
      }
    }
    const awake = 1 - sleep;
    const eyeOpen = giggle ? 0.18 : Math.max(0.07, awake * (1 - blink * live) * (1 - wakeBlink * 0.85));
    eyes.forEach((eye, i) => {
      eye.scale.set(1, eyeOpen, 1);
      eye.position.x = eyeHome[i].x + lookSmooth.x * 0.018;
      eye.position.y = eyeHome[i].y + lookSmooth.y * 0.014 - sleep * 0.01;
    });
    brows.forEach((brow, i) => {
      brow.position.y = browHome[i].y + happy * 0.025 * live - sleep * 0.012;
    });
    const awakeMouth = talking ? 0.75 + Math.sin(now * 16) * 0.25 + Math.sin(now * 5.1) * 0.15 : 1 + happy * 0.06;
    const targetMouth = THREE.MathUtils.lerp(awakeMouth, 0.3 + breath * 0.04, sleep) + stretch * 0.3;
    mouthOpen = THREE.MathUtils.lerp(mouthOpen, targetMouth, 0.3);
    mouth.scale.set(1 - sleep * 0.3, mouthOpen, 1);

    renderer.render(scene, camera);
    if (!readySent) {
      readySent = true;
      options.onReady?.();
    }
  }
  tick();

  const onVisibility = () => {
    cancelAnimationFrame(frame);
    if (!document.hidden && !disposed) tick();
  };
  document.addEventListener("visibilitychange", onVisibility);

  const controller: MaatjeSceneController = {
    wake() {
      if (phase !== "sleeping") return;
      phase = "waking";
      phaseStart = performance.now() / 1000;
    },
    react(kind) {
      if (phase !== "live") return;
      const kinds: MaatjeReaction[] = ["jump", "wave", "giggle"];
      reaction = { kind: kind ?? kinds[Math.floor(Math.random() * kinds.length)], start: performance.now() / 1000 };
    },
    setTalking(value) {
      talking = value;
    },
    close() {
      if (phase === "sleeping") return Promise.resolve();
      if (phase === "leaving") return new Promise<void>(resolve => {
        const previous = resolveClose;
        resolveClose = () => { previous?.(); resolve(); };
      });
      leaveFrom = { x: root.position.x, y: root.position.y, scale: root.scale.x, yaw: THREE.MathUtils.euclideanModulo(root.rotation.y + Math.PI, Math.PI * 2) - Math.PI };
      phase = "leaving";
      phaseStart = performance.now() / 1000;
      reaction = null;
      talking = false;
      dragVelocity = 0;
      dragYaw = 0;
      return new Promise<void>(resolve => { resolveClose = resolve; });
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      scene.traverse(object => {
        if (object instanceof THREE.Mesh) object.geometry.dispose();
      });
      materials.forEach(material => material.dispose());
      [original, frontMap, backMap, partsMap, environment, shadowTexture].forEach(texture => texture.dispose());
      shadowMaterial.dispose();
      pmrem.dispose();
      renderer.dispose();
      canvas.remove();
    },
  };
  return controller;
}
