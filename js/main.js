/* ===========================================================
   main.js
   اسکریپت‌های مشترک بین همه صفحات سایت:
   پس‌زمینه سه‌بعدی (bg-canvas) و دکمه‌های ثابت ناوبری پایین صفحه.
   اسکریپت‌های اختصاصی صفحه اصلی در js/index.js قرار دارند.
   =========================================================== */
document.addEventListener("DOMContentLoaded", () => {
  initBackground();
  initNavPill();
});

/* ---------------------------------------------------------
   1) Ambient background
--------------------------------------------------------- */
function initBackground() {
  const canvas = document.getElementById("bg-canvas");
  if (!canvas || typeof THREE === "undefined") return;

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.z = 8;

  const COUNT = 260;
  const positions = new Float32Array(COUNT * 3);
  for (let i = 0; i < COUNT; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 18;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 12;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 10 - 2;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

  const material = new THREE.PointsMaterial({
    color: 0x7bfeff,
    size: 0.035,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
  const points = new THREE.Points(geometry, material);
  scene.add(points);

  const glowGeo = new THREE.SphereGeometry(2.4, 32, 32);
  const glowMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.1 });
  const glow = new THREE.Mesh(glowGeo, glowMat);
  glow.position.set(2.2, -1.4, -4);
  scene.add(glow);

  let scrollProgress = 0;
  window.addEventListener("scroll", () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    scrollProgress = max > 0 ? window.scrollY / max : 0;
  }, { passive: true });

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  const clock = new THREE.Clock();
  function tick() {
    requestAnimationFrame(tick);
    const t = clock.getElapsedTime();
    if (!prefersReducedMotion) {
      points.rotation.y = t * 0.015;
      points.rotation.x = Math.sin(t * 0.3) * 0.05;
      glow.position.y = -1.4 + Math.sin(t * 0.3) * 0.2;
    }
    points.position.y = scrollProgress * 1.4;
    camera.position.y = scrollProgress * -0.6;
    renderer.render(scene, camera);
  }
  tick();
}

/* ---------------------------------------------------------
   2) Fixed bottom nav pill
--------------------------------------------------------- */
function initNavPill() {
  const pill = document.querySelector(".nav-pill");
  if (!pill) return;

  pill.querySelectorAll(".nav-item").forEach((item) => {
    const color = item.getAttribute("data-color");
    if (color) item.style.setProperty("--nav-color", color);
  });

  if (!document.querySelector(".hero")) {
    pill.classList.add("is-visible");
  }
}
