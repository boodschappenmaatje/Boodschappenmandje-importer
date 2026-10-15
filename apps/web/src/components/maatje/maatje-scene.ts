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

// Huisstijl (DESIGN.md): primair blauw en de lichtblauwe gloed.
const GLOW_CORE = 0x1d87f7;
const GLOW_LIGHT = 0x62bffc;

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
  /** Je houdt Maatje vast: hij luistert. */
  /**
   * Bij het loslaten van Maatje (na tikken of vasthouden), nog binnen de
   * aanraking zelf: alleen dan staat iPhone een trilling toe.
   */
  onRelease?: () => void;
  onHoldStart?: () => void;
  /** Je laat Maatje los (cancelled: de vinger ging eraf zonder los te laten). */
  onHoldEnd?: (cancelled: boolean) => void;
  /** Plek van het winkelmandje naast Maatje (stap 3). */
  cart?: () => DOMRect;
}

export interface MaatjeSceneController {
  /** Direct opnieuw tekenen, bijvoorbeeld nadat het canvas verplaatst is. */
  redraw(): void;
  /** Maatje wordt wakker en komt naar voren. */
  wake(): void;
  react(kind?: MaatjeReaction): void;
  setTalking(talking: boolean): void;
  /** Maatje luistert (je houdt hem vast) of denkt na over je vraag. */
  setMood(mood: "idle" | "listening" | "thinking"): void;
  /** Laat Maatje terugvliegen naar zijn plek op Home, waar hij weer indommelt. */
  close(): Promise<void>;
  /** Knip met de vingers: een product verschijnt in zijn hand. */
  conjure(): void;
  /** Een product valt in het mandje: het mandje veert even mee. */
  drop(): void;
  /** Hoeveel producten er (zichtbaar) in het mandje liggen. */
  setCartFill(count: number): void;
  /** Waar zijn tover-hand nu op het scherm is (voor het product dat verschijnt). */
  handPoint(): { x: number; y: number } | null;
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
  smoothNormals(result);
  return result;
}

/**
 * Gladde normalen. ExtrudeGeometry geeft elke driehoek een eigen, vlakke
 * normaal; op glanzend vinyl zie je dan dunne witte lijnen langs de
 * driehoeksranden. Voor- en achterkant krijgen hun exacte (gebolde) normaal,
 * de zijkanten het gemiddelde van de aangrenzende vlakken.
 */
function smoothNormals(geometry: THREE.BufferGeometry, curlAmount = 0, offsetX = 0) {
  const position = geometry.attributes.position;
  const normals = new Float32Array(position.count * 3);
  const sums = new Map<string, THREE.Vector3>();
  const keyOf = (i: number) => `${Math.round(position.getX(i) * 1e4)},${Math.round(position.getY(i) * 1e4)},${Math.round(position.getZ(i) * 1e4)}`;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let i = 0; i < position.count; i += 3) {
    a.fromBufferAttribute(position, i);
    b.fromBufferAttribute(position, i + 1);
    c.fromBufferAttribute(position, i + 2);
    const face = new THREE.Vector3().subVectors(c, b).cross(new THREE.Vector3().subVectors(a, b));
    for (let k = 0; k < 3; k++) {
      const key = keyOf(i + k);
      const sum = sums.get(key) ?? new THREE.Vector3();
      sums.set(key, sum.add(face));
    }
  }
  const [front, back] = geometry.groups;
  const normal = new THREE.Vector3();
  for (let i = 0; i < position.count; i++) {
    if (front && i >= front.start && i < front.start + front.count) normal.set(2 * curlAmount * (position.getX(i) + offsetX), 0, 1);
    else if (back && i >= back.start && i < back.start + back.count) normal.set(-2 * curlAmount * (position.getX(i) + offsetX), 0, -1);
    else normal.copy(sums.get(keyOf(i)) ?? normal.set(0, 0, 1));
    normal.normalize();
    normals.set([normal.x, normal.y, normal.z], i * 3);
  }
  geometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
}

/** Het papier krult licht naar achteren; ook gezichtsdelen volgen die bolling. */
const curl = (x: number) => -CURL * x * x;

function curlGeometry(geometry: THREE.BufferGeometry, offsetX = 0) {
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i++) position.setZ(i, position.getZ(i) + curl(position.getX(i) + offsetX));
  position.needsUpdate = true;
  smoothNormals(geometry, CURL, offsetX);
}

/**
 * Rondt een omtrek af (Chaikin): elke hoek wordt twee keer afgesneden, zodat
 * de rand van mond, ogen en wenkbrauwen een gladde boog is in plaats van
 * zichtbare rechte stukjes.
 */
function smoothContour(points: Point[], rounds = 3): Point[] {
  let result = points;
  for (let r = 0; r < rounds; r++) {
    result = result.flatMap((point, i) => {
      const next = result[(i + 1) % result.length];
      return [
        [point[0] * 0.75 + next[0] * 0.25, point[1] * 0.75 + next[1] * 0.25] as Point,
        [point[0] * 0.25 + next[0] * 0.75, point[1] * 0.25 + next[1] * 0.75] as Point,
      ];
    });
  }
  return result;
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
  // De donkere belijning is mat: glanzende randen gaven dunne witte lijnen
  // langs zijn omtrek. Als hij wakker is gloeit de rand zacht blauw op.
  const matte = (color: number) => new THREE.MeshPhysicalMaterial({
    color, roughness: 0.62, metalness: 0, envMapIntensity: 0.35, emissive: GLOW_CORE, emissiveIntensity: 0,
  });
  const materials = [
    vinyl(frontMap), vinyl(backMap), vinyl(original), vinyl(partsMap, { transparent: true, alphaTest: 0.04, alphaToCoverage: true }),
    matte(0x123a8c), solid(0xf4f8fd), matte(0x0a1f52),
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
    const geometry = splitFaces(puffy(smoothContour(data.contour), 0.001, depth, origin, 6, depth * 0.5));
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
  const handHomeX = hands.map(hand => hand.position.x);
  const handHomeZ = hands.map(hand => hand.position.z);

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

  // ----- Winkelmandje naast Maatje (stap 3) -----
  // Een speelgoedmandje in huisstijlblauw, iets naar je toe gekanteld zodat je
  // erin kijkt. Er liggen gekleurde pakjes in die meegroeien met je lijst.
  const cart = new THREE.Group();
  const cartBody = new THREE.Group();
  cart.add(cartBody);
  const basketMaterial = new THREE.MeshPhysicalMaterial({ color: GLOW_CORE, roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.2, side: THREE.DoubleSide });
  const basketProfile = [new THREE.Vector2(0, -0.42), new THREE.Vector2(0.58, -0.42), new THREE.Vector2(0.66, -0.36), new THREE.Vector2(0.84, 0.4)];
  const basketShell = new THREE.LatheGeometry(basketProfile, 40);
  const basketRimGeometry = new THREE.TorusGeometry(0.84, 0.065, 12, 48);
  const handleGeometry = new THREE.TorusGeometry(0.72, 0.05, 10, 32, Math.PI);
  cartBody.add(new THREE.Mesh(basketShell, basketMaterial));
  const basketRim = new THREE.Mesh(basketRimGeometry, whiteMaterial);
  basketRim.position.y = 0.4;
  basketRim.rotation.x = Math.PI / 2;
  cartBody.add(basketRim);
  const basketHandle = new THREE.Mesh(handleGeometry, rimMaterial);
  basketHandle.position.y = 0.4;
  cartBody.add(basketHandle);
  // Gevlochten bandjes rondom.
  for (const y of [-0.12, 0.14]) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.66 + (y + 0.42) * 0.2, 0.03, 8, 40), whiteMaterial);
    band.position.y = y;
    band.rotation.x = Math.PI / 2;
    cartBody.add(band);
  }
  const PACK_COLORS = [0xffb347, 0x7ed957, 0xff6b81, 0xffe066, 0x9b8cff, 0x5ce1e6, 0xff9f43, 0xa3e635];
  const packMaterials = PACK_COLORS.map(color => new THREE.MeshPhysicalMaterial({ color, roughness: 0.4, clearcoat: 0.6 }));
  const packGeometry = new THREE.BoxGeometry(0.4, 0.5, 0.26);
  const packs = PACK_COLORS.map((_, i) => {
    const pack = new THREE.Mesh(packGeometry, packMaterials[i]);
    const angle = i * 2.4;
    const ring = i < 4 ? 0.36 : 0.14;
    pack.position.set(Math.cos(angle) * ring, 0.12 + Math.floor(i / 4) * 0.24, Math.sin(angle) * ring);
    pack.rotation.set((i % 3) * 0.2 - 0.2, angle, (i % 2) * 0.3 - 0.15);
    pack.scale.setScalar(0.001);
    cartBody.add(pack);
    return pack;
  });
  cart.visible = false;
  scene.add(cart);

  // ----- Plaatsing in schermcoördinaten -----
  let viewport = { width: 1, height: 1 };
  // ----- Blauwe gloed als Maatje wakker is -----
  // Zijn silhouet wordt klein en wit getekend, vervaagd en in huisstijlblauw
  // achter hem gezet; zo gloeit er een zachte rand om zijn hele omtrek.
  const GLOW_SCALE = 0.25;
  const glowTargets = [0, 1, 2].map(() => new THREE.WebGLRenderTarget(1, 1));
  const maskMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const quadGeometry = new THREE.PlaneGeometry(2, 2);
  const quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const fullscreen = "varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }";
  const blurMaterial = new THREE.ShaderMaterial({
    uniforms: { source: { value: null }, step: { value: new THREE.Vector2() } },
    vertexShader: fullscreen,
    fragmentShader: `
      uniform sampler2D source; uniform vec2 step; varying vec2 vUv;
      void main() {
        float w[5]; w[0] = 0.227; w[1] = 0.195; w[2] = 0.122; w[3] = 0.054; w[4] = 0.016;
        float a = texture2D(source, vUv).r * w[0];
        for (int i = 1; i < 5; i++) {
          a += texture2D(source, vUv + step * float(i)).r * w[i];
          a += texture2D(source, vUv - step * float(i)).r * w[i];
        }
        gl_FragColor = vec4(a, a, a, 1.0);
      }`,
    depthTest: false, depthWrite: false,
  });
  const srgb = (hex: number) => new THREE.Vector3(((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255);
  const glowMaterial = new THREE.ShaderMaterial({
    uniforms: { source: { value: null }, strength: { value: 0 }, core: { value: srgb(GLOW_CORE) }, light: { value: srgb(GLOW_LIGHT) } },
    vertexShader: fullscreen,
    fragmentShader: `
      uniform sampler2D source; uniform float strength; uniform vec3 core; uniform vec3 light; varying vec2 vUv;
      void main() {
        float a = clamp(texture2D(source, vUv).r * 2.4, 0.0, 1.0);
        gl_FragColor = vec4(mix(light, core, a), a * strength);
      }`,
    transparent: true, depthTest: false, depthWrite: false,
  });
  const quad = new THREE.Mesh(quadGeometry, blurMaterial);
  const quadScene = new THREE.Scene();
  quadScene.add(quad);

  function pass(material: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget | null) {
    quad.material = material;
    renderer.setRenderTarget(target);
    renderer.render(quadScene, quadCamera);
  }

  function draw(glow: number) {
    if (glow < 0.005) {
      renderer.render(scene, camera);
      return;
    }
    const [mask, blurA, blurB] = glowTargets;
    const cartShown = cart.visible;
    shadow.visible = false;
    cart.visible = false;
    scene.overrideMaterial = maskMaterial;
    renderer.setClearColor(0x000000, 1);
    renderer.setRenderTarget(mask);
    renderer.render(scene, camera);
    scene.overrideMaterial = null;
    shadow.visible = true;
    cart.visible = cartShown;
    renderer.setClearColor(0x000000, 0);
    let source = mask.texture;
    for (const spread of [1.8, 3.8]) {
      blurMaterial.uniforms.source.value = source;
      blurMaterial.uniforms.step.value.set(spread / mask.width, 0);
      pass(blurMaterial, blurA);
      blurMaterial.uniforms.source.value = blurA.texture;
      blurMaterial.uniforms.step.value.set(0, spread / mask.height);
      pass(blurMaterial, blurB);
      source = blurB.texture;
    }
    glowMaterial.uniforms.source.value = source;
    glowMaterial.uniforms.strength.value = glow;
    renderer.setRenderTarget(null);
    renderer.clear();
    renderer.autoClear = false;
    pass(glowMaterial, null);
    renderer.clearDepth();
    renderer.render(scene, camera);
    renderer.autoClear = true;
  }

  function resize() {
    viewport = { width: container.clientWidth || window.innerWidth, height: container.clientHeight || window.innerHeight };
    renderer.setSize(viewport.width, viewport.height, false);
    const ratio = renderer.getPixelRatio() * GLOW_SCALE;
    glowTargets.forEach(target => target.setSize(Math.max(1, Math.round(viewport.width * ratio)), Math.max(1, Math.round(viewport.height * ratio))));
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
  // Kort tikken laat hem reageren; vasthouden betekent praten.
  const HOLD_DELAY = 250;
  let press: { startX: number; startY: number; moved: boolean; holding: boolean; timer: number } | null = null;

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
    if (press) window.clearTimeout(press.timer);
    const current = { startX: event.clientX, startY: event.clientY, moved: false, holding: false, timer: 0 };
    if (phase === "live" && hits()) {
      current.timer = window.setTimeout(() => {
        if (press !== current || current.moved) return;
        current.holding = true;
        options.onHoldStart?.();
      }, HOLD_DELAY);
    }
    press = current;
    canvas.setPointerCapture?.(event.pointerId);
  };
  const onMove = (event: PointerEvent) => {
    setPointer(event);
    if (press && !press.holding && Math.hypot(event.clientX - press.startX, event.clientY - press.startY) > 12) press.moved = true;
  };
  const onUp = (event: PointerEvent) => {
    setPointer(event);
    const current = press;
    press = null;
    if (!current) return;
    window.clearTimeout(current.timer);
    if (current.holding) {
      if (event.type !== "pointercancel") options.onRelease?.();
      options.onHoldEnd?.(event.type === "pointercancel");
      return;
    }
    if (current.moved || phase !== "live" || event.type === "pointercancel") return;
    if (hits()) {
      options.onRelease?.();
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
  // meteen wakker, rekt zich uit en springt in een boogje naar voren; daarna
  // leeft hij. Bij teruggaan gaapt hij, vliegt terug en dommelt weer in.
  const motion = options.reducedMotion ? 0.2 : 1;
  const wakeDuration = options.reducedMotion ? 0.25 : 1.6;
  const leaveDuration = options.reducedMotion ? 0.2 : 1;
  const DOZE = 1.4;
  let phase: "sleeping" | "waking" | "live" | "leaving" = "sleeping";
  // Bij het openen ligt hij meteen al te slapen, net als het plaatje op Home.
  let phaseStart = performance.now() / 1000 - DOZE;
  let leaveFrom = { x: 0, y: 0, scale: 1, yaw: 0 };
  let resolveClose: (() => void) | null = null;
  let reaction: { kind: MaatjeReaction; start: number } | null = null;
  let talking = false;
  let mouthOpen = 1;
  let blink = 0;
  let nextBlink = performance.now() / 1000 + 2.2;
  let blinkStart = -1;
  let happy = 0;
  let mood: "idle" | "listening" | "thinking" = "idle";
  let listenAmount = 0;
  let thinkAmount = 0;
  let frame = 0;
  let disposed = false;
  let readySent = false;
  let lastRender = 0;
  let glowAmount = 0;
  let wasVisible = true;
  const lookSmooth = { x: 0, y: 0 };
  let cartAmount = 0;
  let cartFill = 0;
  let dropStart = -10;
  let snapStart = -10;
  const packSize = packs.map(() => 0);
  // De hand die het dichtst bij het mandje (rechts) zit, tovert.
  const magicHand = handHomeX[0] > handHomeX[1] ? 0 : 1;

  function tick() {
    if (disposed) return;
    frame = requestAnimationFrame(tick);
    update(false);
  }

  function update(force: boolean) {
    const now = performance.now() / 1000;
    const t = now - phaseStart;
    const anchorRect = options.anchor();
    const from = place(anchorRect);
    const to = place(options.target());

    // Slapend is er weinig beweging: 30 beelden per seconde is genoeg, en
    // buiten beeld tekenen we niets.
    if (phase === "sleeping" && readySent && !force) {
      const visible = anchorRect.bottom > -40 && anchorRect.top < window.innerHeight + 40;
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
    // tuck: 1 = handjes weggestopt achter zijn lijf (slapen), 0 = duimen omhoog.
    let tuck = 0;
    let landSquash = 1;

    if (phase === "sleeping") {
      sleep = smoothstep(Math.min(1, t / DOZE));
      sparkAmount = 1 - sleep;
      tuck = sleep;
    } else if (phase === "waking") {
      const p = Math.min(1, t / wakeDuration);
      if (options.reducedMotion) {
        const e = easeInOut(p);
        x = THREE.MathUtils.lerp(from.x, to.x, e);
        y = THREE.MathUtils.lerp(from.y, to.y, e);
        scale = THREE.MathUtils.lerp(from.scale, to.scale, e);
        sleep = 1 - e;
        sparkAmount = e;
        tuck = 1 - e;
        live = e;
      } else {
        // Alles loopt in één beweging door elkaar heen, zodat hij meteen
        // reageert op je tik en nergens stilstaat.
        // Ogen floepen open en hij knippert één keer de slaap weg.
        sleep = 1 - smoothstep(range(p, 0, 0.16));
        wakeBlink = bell(range(p, 0.2, 0.3));
        // Handjes groeien rustig uit zijn lijf terwijl hij zich uitrekt en gaapt.
        tuck = 1 - easeOutBack(range(p, 0.04, 0.3));
        stretch = bell(range(p, 0.04, 0.36));
        // Even door de knieën (aanloop), dan een vrolijk boogsprongetje naar voren.
        const crouch = bell(range(p, 0.3, 0.42));
        const travel = easeInOut(range(p, 0.36, 0.8));
        x = THREE.MathUtils.lerp(from.x, to.x, travel);
        y = THREE.MathUtils.lerp(from.y, to.y, travel);
        scale = THREE.MathUtils.lerp(from.scale, to.scale, travel);
        const flying = range(p, 0.36, 0.8) > 0 && range(p, 0.36, 0.8) < 1;
        lift = Math.sin(travel * Math.PI) * 0.32 * to.scale;
        yaw = Math.sin(travel * Math.PI) * 0.25;
        // Landen met een veertje: eerst inzakken, dan nadeinen.
        const land = range(p, 0.8, 1);
        landSquash = (1 - crouch * 0.12) * (flying ? 1 + Math.sin(travel * Math.PI) * 0.06 : 1)
          * (land > 0 ? 1 - Math.sin(land * Math.PI * 3) * 0.1 * (1 - land) : 1);
        // Glinsters springen tevoorschijn bij de landing en hij zwaait hallo.
        sparkAmount = easeOutBack(range(p, 0.74, 0.9));
        wave = Math.sin(range(p, 0.82, 1) * Math.PI);
        live = smoothstep(range(p, 0.3, 0.9));
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
      // Andersom dan wakker worden: eerst een flinke geeuw, dan een boogje
      // terug naar zijn plek, waar hij daarna weer indommelt.
      stretch = bell(range(p, 0, 0.35)) * 0.8;
      lift = Math.sin(e * Math.PI) * 0.16 * leaveFrom.scale;
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
    let squash = (1 + Math.sin(now * 4) * 0.01 * motion * live) * (1 + breath * 0.018 * motion * sleep) * (1 + stretch * 0.07) * landSquash;
    let roll = Math.sin(now * 1.3) * 0.03 * motion * live + 0.05 * sleep + Math.sin(now * 0.85) * 0.012 * motion * sleep;
    pitch += 0.07 * sleep - stretch * 0.1;
    let handLift = [Math.sin(now * 2 + 0.7), Math.sin(now * 2 + 1.6)].map(v => v * 0.025 * motion * live);
    const handTwist = [Math.sin(now * 3.1) * 0.06 * motion * live, -Math.sin(now * 2.7) * 0.06 * motion * live];
    handLift = handLift.map((v, i) => v - 0.035 * sleep + breath * 0.008 * sleep + stretch * 0.2 + (i === 1 ? wave * 0.2 : 0));
    let waveAngle = wave * Math.sin(now * 13) * 0.42;
    // Toveren: tovenaarshand gaat omhoog, knipt (kort wiebelen) en zakt terug.
    const snapT = (now - snapStart) / (options.reducedMotion ? 0.3 : 0.55);
    const snap = snapT >= 0 && snapT < 1 ? Math.sin(snapT * Math.PI) : 0;
    if (snap > 0) {
      handLift[magicHand] += snap * 0.22;
      happy = Math.max(happy, snap);
    }
    const snapTwist = snap > 0 ? Math.sin(snapT * Math.PI * 5) * 0.25 * snap * motion : 0;
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

    // Luisteren: hij buigt naar je toe en wordt iets groter. Nadenken: hij
    // kijkt omhoog en wiegt zijn hoofd.
    listenAmount = THREE.MathUtils.lerp(listenAmount, phase === "live" && mood === "listening" ? 1 : 0, 0.15);
    thinkAmount = THREE.MathUtils.lerp(thinkAmount, phase === "live" && mood === "thinking" ? 1 : 0, 0.08);
    scale *= 1 + listenAmount * 0.05;
    pitch += listenAmount * 0.1;
    roll += thinkAmount * Math.sin(now * 2.2) * 0.06 * motion;
    const lookX = thinkAmount > 0.01 ? THREE.MathUtils.lerp(look.x, 0.55, thinkAmount) : look.x;
    const lookY = thinkAmount > 0.01 ? THREE.MathUtils.lerp(look.y, 0.7, thinkAmount) : look.y;
    lookSmooth.x = THREE.MathUtils.lerp(lookSmooth.x, phase === "live" ? lookX : 0, 0.1);
    lookSmooth.y = THREE.MathUtils.lerp(lookSmooth.y, phase === "live" ? lookY : 0, 0.1);

    root.position.set(x, y + (lift + bob) * scale, 0);
    root.scale.setScalar(scale);
    pitch += -lookSmooth.y * 0.12 * live;
    root.rotation.set(pitch, yaw + sway + lookSmooth.x * 0.3 * live, roll);
    figure.scale.set(1 / Math.sqrt(squash), squash, 1);
    const hover = (lift + bob) * scale;
    shadow.position.set(x, y - 0.98 * scale, -0.5 * scale);
    shadow.scale.setScalar(scale * (1 - Math.min(0.4, hover / scale)));
    shadowMaterial.opacity = live * (1 - Math.min(0.6, (hover / scale) * 1.5));

    // Slapend liggen de handjes weggestopt achter zijn lijf; pas bij het
    // wakker worden komen de duimen omhoog.
    hands.forEach((hand, i) => {
      const side = Math.sign(handHomeX[i]);
      hand.position.x = handHomeX[i] - side * 0.3 * tuck;
      hand.position.y = handHome[i] + handLift[i] - 0.22 * tuck;
      hand.position.z = handHomeZ[i] - 0.3 * tuck;
      hand.rotation.z = handTwist[i] + (i === 1 ? -waveAngle : 0) + side * 0.6 * tuck + (i === magicHand ? snapTwist : 0);
      hand.scale.setScalar(1 - 0.45 * tuck);
    });
    sparks.forEach((spark, i) => spark.scale.setScalar(Math.max(0.001, sparkAmount * (1 + Math.sin(now * 3.4 + i * 1.3) * 0.12 * live) * (1 + snap * 0.5))));

    // Mandje: springt erbij als hij wakker is, veert mee als er iets in valt.
    cartAmount = THREE.MathUtils.lerp(cartAmount, phase === "live" && options.cart ? 1 : 0, phase === "live" ? 0.12 : 0.3);
    cart.visible = cartAmount > 0.01;
    if (cart.visible && options.cart) {
      const spot = place(options.cart());
      const pop = options.reducedMotion ? cartAmount : easeOutBack(cartAmount);
      const dropT = (now - dropStart) / 0.6;
      const bounce = dropT >= 0 && dropT < 1 ? Math.sin(dropT * Math.PI * 3) * (1 - dropT) * 0.12 * motion : 0;
      cart.position.set(spot.x, spot.y + Math.sin(now * 1.8 + 1) * 0.015 * spot.scale * motion, 0.2);
      cart.scale.set(spot.scale * pop * (1 + bounce * 0.6), spot.scale * pop * (1 - bounce), spot.scale * pop);
      cartBody.rotation.set(0.55, -0.35 + Math.sin(now * 0.9) * 0.05 * motion, 0);
      packs.forEach((pack, i) => {
        packSize[i] = THREE.MathUtils.lerp(packSize[i], i < cartFill ? 1 : 0, 0.18);
        pack.scale.setScalar(Math.max(0.001, packSize[i]));
      });
    }

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

    // Gloed: gaat aan zodra je tikt en pulseert zacht zolang hij wakker is.
    glowAmount = THREE.MathUtils.lerp(glowAmount, phase === "waking" || phase === "live" ? 1 : 0, 0.12);
    const pulse = glowAmount * (0.85 + 0.15 * Math.sin(now * (2.6 + listenAmount * 3.4)) * motion) * (1 + listenAmount * 0.5);
    rimMaterial.emissiveIntensity = pulse * 0.4;
    draw(pulse);
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
    redraw() {
      if (!disposed) update(true);
    },
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
    setMood(value) {
      mood = value;
    },
    conjure() {
      if (phase === "live") snapStart = performance.now() / 1000;
    },
    drop() {
      dropStart = performance.now() / 1000;
    },
    setCartFill(count) {
      cartFill = Math.min(packs.length, Math.max(0, count));
    },
    handPoint() {
      if (phase !== "live") return null;
      const point = new THREE.Vector3();
      hands[magicHand].getWorldPosition(point);
      point.y += 0.12 * root.scale.y;
      point.project(camera);
      const box = container.getBoundingClientRect();
      return { x: box.left + (point.x + 1) / 2 * viewport.width, y: box.top + (1 - point.y) / 2 * viewport.height };
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
      mood = "idle";
      return new Promise<void>(resolve => { resolveClose = resolve; });
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      if (press) window.clearTimeout(press.timer);
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
      [basketMaterial, ...packMaterials].forEach(material => material.dispose());
      glowTargets.forEach(target => target.dispose());
      [maskMaterial, blurMaterial, glowMaterial].forEach(material => material.dispose());
      quadGeometry.dispose();
      [original, frontMap, backMap, partsMap, environment, shadowTexture].forEach(texture => texture.dispose());
      shadowMaterial.dispose();
      pmrem.dispose();
      renderer.dispose();
      canvas.remove();
    },
  };
  return controller;
}
