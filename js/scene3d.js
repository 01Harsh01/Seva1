// ============================================================
//  js/scene3d.js — dynamic 3D backdrops (category hero + homepage hero)
//
//  Renders small, abstract, procedurally-shaped 3D scenes rather
//  than photographic imagery — see README on avoiding unrelated
//  stock imagery; these are stylised brand visuals matched to the
//  category's theme color, not a substitute for a real photo
//  library.
//
//  three.js is loaded from CDN lazily, only when a scene actually
//  mounts, and is skipped entirely (falling back to a cheap CSS
//  gradient) for reduced-motion visitors or low-power devices.
//  Everything is disposed on teardown() so navigating between
//  pages/categories never leaks canvases, geometry or listeners.
// ============================================================

let threePromise = null;
function loadThree() {
  if (window.THREE) return Promise.resolve(window.THREE);
  if (!threePromise) {
    threePromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
      script.onload = () => resolve(window.THREE);
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }
  return threePromise;
}

export function reducedMotionPreferred() {
  return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Conservative, dependency-free heuristic — no benchmarking, just
// signals that reliably correlate with weak GPUs/CPUs or a screen
// too small to make a big WebGL hero worthwhile.
export function isLowPowerDevice() {
  const smallScreen = window.matchMedia && window.matchMedia("(max-width: 720px)").matches;
  const fewCores = navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4;
  const noFinePointer = window.matchMedia && !window.matchMedia("(pointer: fine)").matches;
  return smallScreen || (fewCores && noFinePointer);
}

function buildGeometry(THREE, shape, scale = 1) {
  const s = scale;
  switch (shape) {
    case "torus": return new THREE.TorusGeometry(1.1 * s, 0.38 * s, 20, 56);
    case "box": return new THREE.BoxGeometry(1.5 * s, 1.5 * s, 1.5 * s);
    case "cone": return new THREE.ConeGeometry(1.1 * s, 1.9 * s, 28);
    case "cylinder": return new THREE.CylinderGeometry(0.9 * s, 0.9 * s, 1.7 * s, 28);
    case "octahedron": return new THREE.OctahedronGeometry(1.35 * s, 0);
    case "capsule": return new THREE.CapsuleGeometry ? new THREE.CapsuleGeometry(0.65 * s, 1.1 * s, 6, 14) : new THREE.SphereGeometry(1.15 * s, 28, 28);
    case "sphere":
    default: return new THREE.SphereGeometry(1.2 * s, 28, 28);
  }
}

// A soft, blurred elliptical "shadow" drawn on a canvas texture and
// projected onto a flat plane beneath a floating object. Reads as
// realistic contact-shadow depth for a fraction of the cost of a
// real shadow map, which matters since these run on every page.
function makeShadowTexture(THREE) {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(0,0,0,0.35)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

function makeParticles(THREE, count, spread, color) {
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * spread;
    positions[i * 3 + 1] = (Math.random() - 0.5) * spread * 0.6;
    positions[i * 3 + 2] = (Math.random() - 0.5) * spread * 0.5;
  }
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({ color, size: 0.035, transparent: true, opacity: 0.55, sizeAttenuation: true });
  return new THREE.Points(geo, mat);
}

function trackPointer(target, onMove) {
  let raw = { x: 0, y: 0 };
  function handler(e) {
    const rect = target.getBoundingClientRect();
    const cx = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const cy = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
    raw = { x: (cx / rect.width) * 2 - 1, y: (cy / rect.height) * 2 - 1 };
    onMove(raw);
  }
  window.addEventListener("pointermove", handler, { passive: true });
  return { untrack: () => window.removeEventListener("pointermove", handler), get: () => raw };
}

let activeHandles = [];
function registerHandle(h) { activeHandles.push(h); return h; }

// ------------------------------------------------------------
// Single-shape scene used by category.html / booking.html / etc.
// Now with a fake-AO ground shadow and subtle cursor-parallax.
// ------------------------------------------------------------
export async function mountCategoryScene({ container, shape, color }) {
  teardownScene(container);
  if (!container) return () => {};

  if (reducedMotionPreferred() || isLowPowerDevice()) {
    container.style.background = `radial-gradient(circle at 65% 40%, ${color}55, transparent 60%)`;
    registerHandle({ container, dispose: () => { container.style.background = ""; } });
    return () => teardownScene(container);
  }

  let THREE;
  try { THREE = await loadThree(); }
  catch {
    container.style.background = `radial-gradient(circle at 65% 40%, ${color}55, transparent 60%)`;
    registerHandle({ container, dispose: () => { container.style.background = ""; } });
    return () => teardownScene(container);
  }

  const width = container.clientWidth || 600;
  const height = container.clientHeight || 400;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
  camera.position.set(0, 0, 4.2);

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  container.innerHTML = "";
  container.style.background = "";
  container.appendChild(renderer.domElement);

  const group = new THREE.Group();
  scene.add(group);

  const geometry = buildGeometry(THREE, shape);
  const material = new THREE.MeshStandardMaterial({ color, metalness: 0.35, roughness: 0.35 });
  const mesh = new THREE.Mesh(geometry, material);
  group.add(mesh);

  const wireGeo = buildGeometry(THREE, shape);
  const wireMat = new THREE.MeshBasicMaterial({ color: "#ffffff", wireframe: true, transparent: true, opacity: 0.08 });
  const wireMesh = new THREE.Mesh(wireGeo, wireMat);
  wireMesh.scale.setScalar(1.03);
  group.add(wireMesh);

  const shadowMat = new THREE.MeshBasicMaterial({ map: makeShadowTexture(THREE), transparent: true, depthWrite: false });
  const shadowPlane = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), shadowMat);
  shadowPlane.position.set(0, -1.7, -0.5);
  group.add(shadowPlane);

  scene.add(new THREE.AmbientLight(0xffffff, 0.65));
  const key = new THREE.PointLight(0xffffff, 1.15);
  key.position.set(3, 3, 4);
  scene.add(key);
  const rim = new THREE.PointLight(color, 0.6);
  rim.position.set(-3, -1, 2);
  scene.add(rim);

  let raf = null, disposed = false;
  const pointerTracker = trackPointer(container.closest("section") || container, () => {});

  function resize() {
    if (disposed) return;
    const w = container.clientWidth || width;
    const h = container.clientHeight || height;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(container);

  function tick() {
    if (disposed) return;
    mesh.rotation.x += 0.004;
    mesh.rotation.y += 0.006;
    wireMesh.rotation.copy(mesh.rotation);
    const pointer = pointerTracker.get();
    group.rotation.y += ((pointer.x * 0.35) - group.rotation.y) * 0.04;
    group.rotation.x += ((-pointer.y * 0.2) - group.rotation.x) * 0.04;
    group.position.x += ((pointer.x * 0.25) - group.position.x) * 0.04;
    renderer.render(scene, camera);
    raf = requestAnimationFrame(tick);
  }
  tick();

  function dispose() {
    disposed = true;
    if (raf) cancelAnimationFrame(raf);
    ro.disconnect();
    pointerTracker.untrack();
    geometry.dispose(); material.dispose();
    wireGeo.dispose(); wireMat.dispose();
    shadowPlane.geometry.dispose(); shadowMat.dispose(); shadowMat.map.dispose();
    renderer.dispose();
    container.innerHTML = "";
  }

  registerHandle({ container, dispose });
  return () => teardownScene(container);
}

// ------------------------------------------------------------
// Multi-object "field" scene for the homepage hero — a small
// cluster of floating primitives (one per lead trade) plus a
// soft particle drift, all colored from the brand palette, with
// mouse parallax and a slow autonomous drift so it still feels
// alive when the cursor hasn't moved.
// ------------------------------------------------------------
export async function mountHeroFieldScene({ container, colors }) {
  teardownScene(container);
  if (!container) return () => {};

  if (reducedMotionPreferred() || isLowPowerDevice()) {
    container.style.background = `radial-gradient(circle at 70% 35%, ${colors[0]}40, transparent 55%), radial-gradient(circle at 25% 70%, ${colors[1]}30, transparent 50%)`;
    registerHandle({ container, dispose: () => { container.style.background = ""; } });
    return () => teardownScene(container);
  }

  let THREE;
  try { THREE = await loadThree(); }
  catch {
    container.style.background = `radial-gradient(circle at 70% 35%, ${colors[0]}40, transparent 55%)`;
    registerHandle({ container, dispose: () => { container.style.background = ""; } });
    return () => teardownScene(container);
  }

  const width = container.clientWidth || 700;
  const height = container.clientHeight || 520;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
  camera.position.set(0, 0, 6.5);

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  container.innerHTML = "";
  container.appendChild(renderer.domElement);

  const shapes = ["torus", "box", "octahedron", "cone", "sphere"];
  const cluster = new THREE.Group();
  scene.add(cluster);

  const meshes = shapes.map((shape, i) => {
    const color = colors[i % colors.length];
    const geo = buildGeometry(THREE, shape, 0.55 + Math.random() * 0.15);
    const mat = new THREE.MeshStandardMaterial({ color, metalness: 0.4, roughness: 0.3, transparent: true, opacity: 0.94 });
    const m = new THREE.Mesh(geo, mat);
    const angle = (i / shapes.length) * Math.PI * 2;
    const radius = 2.1;
    m.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius * 0.55, (Math.random() - 0.5) * 1.4);
    m.userData.baseY = m.position.y;
    m.userData.floatOffset = Math.random() * Math.PI * 2;
    m.userData.floatSpeed = 0.6 + Math.random() * 0.4;
    m.userData.spinSpeed = { x: (Math.random() - 0.5) * 0.006, y: (Math.random() - 0.5) * 0.008 };
    cluster.add(m);
    return { mesh: m, geo, mat };
  });

  const particles = makeParticles(THREE, 90, 9, "#ffffff");
  scene.add(particles);

  scene.add(new THREE.AmbientLight(0xffffff, 0.7));
  const key = new THREE.PointLight(0xffffff, 1.2);
  key.position.set(4, 4, 5);
  scene.add(key);
  const rim = new THREE.PointLight(colors[0], 0.8);
  rim.position.set(-4, -2, 3);
  scene.add(rim);

  let raf = null, disposed = false, t = 0;
  const pointerTracker = trackPointer(container.closest("section") || container, () => {});

  function resize() {
    if (disposed) return;
    const w = container.clientWidth || width;
    const h = container.clientHeight || height;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(container);

  function tick() {
    if (disposed) return;
    t += 0.012;
    meshes.forEach(({ mesh }) => {
      mesh.position.y = mesh.userData.baseY + Math.sin(t * mesh.userData.floatSpeed + mesh.userData.floatOffset) * 0.18;
      mesh.rotation.x += mesh.userData.spinSpeed.x;
      mesh.rotation.y += mesh.userData.spinSpeed.y;
    });
    particles.rotation.y += 0.0006;
    const pointer = pointerTracker.get();
    cluster.rotation.y += ((pointer.x * 0.4) - cluster.rotation.y) * 0.03;
    cluster.rotation.x += ((-pointer.y * 0.22) - cluster.rotation.x) * 0.03;
    camera.position.x += ((pointer.x * 0.4) - camera.position.x) * 0.02;
    camera.position.y += ((-pointer.y * 0.25) - camera.position.y) * 0.02;
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
    raf = requestAnimationFrame(tick);
  }
  tick();

  function dispose() {
    disposed = true;
    if (raf) cancelAnimationFrame(raf);
    ro.disconnect();
    pointerTracker.untrack();
    meshes.forEach(({ geo, mat }) => { geo.dispose(); mat.dispose(); });
    particles.geometry.dispose(); particles.material.dispose();
    renderer.dispose();
    container.innerHTML = "";
  }

  registerHandle({ container, dispose });
  return () => teardownScene(container);
}

export function teardownScene(container) {
  activeHandles = activeHandles.filter((h) => {
    if (!container || h.container === container) { h.dispose(); return false; }
    return true;
  });
}

export function teardownActiveScene() {
  activeHandles.forEach((h) => h.dispose());
  activeHandles = [];
}
