// ============================================================
//  js/scene3d.js — Subtle, project-themed cooperative network backdrops
//
//  Replaced distracting random 3D shapes (cubes, donuts, cones)
//  with a clean, elegant, non-intrusive cooperative network &
//  particle depth effect that stays safely in the background.
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

export function isLowPowerDevice() {
  const smallScreen = window.matchMedia && window.matchMedia("(max-width: 720px)").matches;
  const fewCores = navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4;
  const noFinePointer = window.matchMedia && !window.matchMedia("(pointer: fine)").matches;
  return smallScreen || (fewCores && noFinePointer);
}

let activeHandles = [];
function registerHandle(h) { activeHandles.push(h); return h; }

// ------------------------------------------------------------
// Subtle Category Hero Backdrop — clean ambient glow & subtle depth
// ------------------------------------------------------------
export async function mountCategoryScene({ container, color = "#0F766E" }) {
  teardownScene(container);
  if (!container) return () => {};

  // Simple, elegant radial background gradient matching the category
  container.style.background = `radial-gradient(ellipse 70% 60% at 80% 30%, ${color}22 0%, transparent 70%)`;
  registerHandle({
    container,
    dispose: () => {
      if (container) container.style.background = "";
    },
  });
  return () => teardownScene(container);
}

// ------------------------------------------------------------
// Homepage Hero Scene — Cooperative service connection network
// Subtle nodes and connections on the right side of the hero
// ------------------------------------------------------------
export async function mountHeroFieldScene({ container, colors = ["#0F766E", "#0D9488", "#D97706"] }) {
  teardownScene(container);
  if (!container) return () => {};

  if (reducedMotionPreferred() || isLowPowerDevice()) {
    container.style.background = `radial-gradient(circle at 85% 40%, ${colors[0]}18, transparent 60%)`;
    registerHandle({ container, dispose: () => { if (container) container.style.background = ""; } });
    return () => teardownScene(container);
  }

  let THREE;
  try { THREE = await loadThree(); }
  catch {
    container.style.background = `radial-gradient(circle at 85% 40%, ${colors[0]}18, transparent 60%)`;
    registerHandle({ container, dispose: () => { if (container) container.style.background = ""; } });
    return () => teardownScene(container);
  }

  const width = container.clientWidth || 700;
  const height = container.clientHeight || 500;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
  camera.position.set(0, 0, 7);

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  container.innerHTML = "";
  container.appendChild(renderer.domElement);

  // Create subtle cooperative service network nodes (clean small glowing nodes)
  const nodeGroup = new THREE.Group();
  scene.add(nodeGroup);

  const nodeCount = 18;
  const nodeGeo = new THREE.SphereGeometry(0.08, 16, 16);
  const nodeMeshes = [];

  for (let i = 0; i < nodeCount; i++) {
    const nodeColor = colors[i % colors.length];
    const nodeMat = new THREE.MeshBasicMaterial({ color: nodeColor, transparent: true, opacity: 0.7 });
    const mesh = new THREE.Mesh(nodeGeo, nodeMat);
    // Position mostly in right hemisphere so it complements the service card visual
    mesh.position.set(
      0.8 + (Math.random() - 0.2) * 3.6,
      (Math.random() - 0.5) * 3.2,
      (Math.random() - 0.5) * 2.0
    );
    mesh.userData = {
      baseY: mesh.position.y,
      speed: 0.5 + Math.random() * 0.5,
      offset: Math.random() * Math.PI * 2,
    };
    nodeGroup.add(mesh);
    nodeMeshes.push(mesh);
  }

  // Soft ambient dust particles
  const particleCount = 45;
  const pGeo = new THREE.BufferGeometry();
  const pPositions = new Float32Array(particleCount * 3);
  for (let i = 0; i < particleCount; i++) {
    pPositions[i * 3] = 0.5 + (Math.random() - 0.2) * 4.0;
    pPositions[i * 3 + 1] = (Math.random() - 0.5) * 3.5;
    pPositions[i * 3 + 2] = (Math.random() - 0.5) * 2.5;
  }
  pGeo.setAttribute("position", new THREE.BufferAttribute(pPositions, 3));
  const pMat = new THREE.PointsMaterial({ color: colors[0], size: 0.04, transparent: true, opacity: 0.45 });
  const particles = new THREE.Points(pGeo, pMat);
  scene.add(particles);

  let raf = null, disposed = false, t = 0;

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
    t += 0.01;
    nodeMeshes.forEach((m) => {
      m.position.y = m.userData.baseY + Math.sin(t * m.userData.speed + m.userData.offset) * 0.12;
    });
    particles.rotation.y += 0.0005;
    renderer.render(scene, camera);
    raf = requestAnimationFrame(tick);
  }
  tick();

  function dispose() {
    disposed = true;
    if (raf) cancelAnimationFrame(raf);
    ro.disconnect();
    nodeGeo.dispose();
    nodeMeshes.forEach(m => m.material.dispose());
    pGeo.dispose();
    pMat.dispose();
    renderer.dispose();
    container.innerHTML = "";
  }

  registerHandle({ container, dispose });
  return () => teardownScene(container);
}

export function teardownScene(container) {
  activeHandles = activeHandles.filter((h) => {
    if (!container || h.container === container) {
      if (h.dispose) h.dispose();
      return false;
    }
    return true;
  });
}

export function teardownActiveScene() {
  activeHandles.forEach((h) => { if (h.dispose) h.dispose(); });
  activeHandles = [];
}

