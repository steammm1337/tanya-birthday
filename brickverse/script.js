/* ===========================================================
   BRICKVERSE — interactions
   - Mr. Gold minifig podium (three.js)
   - Car follows cursor on a LEGO baseplate, top-down (three.js)
   - GSAP reveals + scroll zoom
   - One-time pixelation on first scroll
   - Falling LEGO brick confetti
   Classic (non-module) script — works from file:// with no server / no internet.
   =========================================================== */
const THREE = window.THREE;
const isTouch = window.matchMedia("(hover:none)").matches || "ontouchstart" in window;
const reduceMotion = window.matchMedia("(prefers-reduced-motion:reduce)").matches;

/* ---------------- helpers ---------------- */
function frameModel(obj, targetSize) {
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  obj.position.sub(center); // center at origin
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const scale = targetSize / maxDim;
  obj.scale.setScalar(scale);
  return { size, scale, maxDim };
}

function loadGLB(dataUri) {
  return new Promise((resolve, reject) => {
    if (!THREE || !THREE.GLTFLoader) { reject(new Error("GLTFLoader missing")); return; }
    const loader = new THREE.GLTFLoader();
    loader.load(dataUri, (g) => resolve(g), undefined, (e) => reject(e));
  });
}

/* ============================================================
   1) Custom brick cursor
   ============================================================ */
(function cursor() {
  const el = document.getElementById("cursor");
  if (!el || isTouch) return;
  let x = innerWidth / 2, y = innerHeight / 2, tx = x, ty = y;
  addEventListener("mousemove", (e) => { tx = e.clientX; ty = e.clientY; });
  addEventListener("mousedown", () => el.classList.add("click"));
  addEventListener("mouseup", () => el.classList.remove("click"));
  (function loop() {
    x += (tx - x) * 0.25; y += (ty - y) * 0.25;
    el.style.transform = `translate(${x}px,${y}px)`;
    requestAnimationFrame(loop);
  })();
})();

/* ============================================================
   2) Falling LEGO brick confetti (2D)
   ============================================================ */
(function confetti() {
  const cv = document.getElementById("confetti");
  if (!cv || reduceMotion) return;
  const ctx = cv.getContext("2d");
  const colors = ["#e3000b", "#0057b8", "#ffd000", "#00963b", "#ff7a00", "#7b2ff7"];
  let bricks = [], W, H, dpr = Math.min(devicePixelRatio || 1, 2);
  function resize() {
    W = cv.width = innerWidth * dpr; H = cv.height = innerHeight * dpr;
    cv.style.width = innerWidth + "px"; cv.style.height = innerHeight + "px";
    const count = Math.min(46, Math.floor(innerWidth / 34));
    bricks = Array.from({ length: count }, () => spawn(true));
  }
  function spawn(initial) {
    return {
      x: Math.random() * W, y: initial ? Math.random() * H : -40,
      w: (20 + Math.random() * 16) * dpr, vy: (0.5 + Math.random() * 1.1) * dpr,
      vx: (Math.random() - 0.5) * 0.4 * dpr, rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.02, c: colors[(Math.random() * colors.length) | 0],
      a: 0.35 + Math.random() * 0.35,
    };
  }
  resize(); addEventListener("resize", resize);
  (function draw() {
    ctx.clearRect(0, 0, W, H);
    for (const b of bricks) {
      b.y += b.vy; b.x += b.vx; b.rot += b.vr;
      if (b.y > H + 40) Object.assign(b, spawn(false));
      const h = b.w * 0.62;
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.rot); ctx.globalAlpha = b.a;
      ctx.fillStyle = b.c;
      roundRect(ctx, -b.w / 2, -h / 2, b.w, h, 4 * dpr); ctx.fill();
      // studs
      ctx.globalAlpha = b.a * 0.85;
      ctx.beginPath();
      ctx.arc(-b.w * 0.22, -h / 2 - 2 * dpr, b.w * 0.13, 0, 7);
      ctx.arc(b.w * 0.22, -h / 2 - 2 * dpr, b.w * 0.13, 0, 7);
      ctx.fill();
      ctx.restore();
    }
    requestAnimationFrame(draw);
  })();
  function roundRect(c, x, y, w, h, r) {
    c.beginPath(); c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
})();

/* ============================================================
   3) Mr. Gold minifig podium
   ============================================================ */
async function initMinifig() {
  const canvas = document.getElementById("minifig");
  if (!canvas || !window.MODELS) return;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  if (THREE.sRGBEncoding !== undefined) renderer.outputEncoding = THREE.sRGBEncoding;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(0, 0.4, 5);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x442266, 1.1));
  const key = new THREE.DirectionalLight(0xfff2cc, 2.4); key.position.set(3, 5, 4); scene.add(key);
  const rim = new THREE.DirectionalLight(0xffd000, 1.6); rim.position.set(-4, 2, -3); scene.add(rim);
  const fill = new THREE.PointLight(0x66aaff, 1.2, 30); fill.position.set(-2, 1, 4); scene.add(fill);
  const front = new THREE.DirectionalLight(0xffffff, 1.5); front.position.set(0, 1.5, 6); scene.add(front);

  const pivot = new THREE.Group(); scene.add(pivot);
  try {
    const gltf = await loadGLB(window.MODELS.minifig);
    const model = gltf.scene;
    frameModel(model, 3.4);
    // re-seat on floor of group
    const box = new THREE.Box3().setFromObject(model);
    model.position.y -= box.min.y; model.position.y -= 1.7;
    model.traverse((o) => { if (o.isMesh && o.material) { o.material.envMapIntensity = 1.2; } });
    pivot.add(model);
  } catch (e) { console.warn("minifig load failed", e); }

  function resize() {
    const r = canvas.getBoundingClientRect();
    const w = Math.max(1, r.width), h = Math.max(1, r.height);
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  resize(); addEventListener("resize", resize);

  let t = 0, mx = 0, my = 0;
  addEventListener("mousemove", (e) => {
    mx = (e.clientX / innerWidth - 0.5) * 0.6;
    my = (e.clientY / innerHeight - 0.5) * 0.3;
  });
  renderer.setAnimationLoop(() => {
    t += 0.01;
    pivot.rotation.y = reduceMotion ? mx : t * 0.6 + mx;
    pivot.rotation.x = my * 0.4;
    pivot.position.y = Math.sin(t * 1.4) * 0.08;
    renderer.render(scene, camera);
  });
}

/* ============================================================
   4) Playground — car follows cursor, top-down
   ============================================================ */
async function initPlayground() {
  const canvas = document.getElementById("playground");
  if (!canvas || !window.MODELS) return;
  const hint = document.getElementById("stageHint");

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  if (THREE.sRGBEncoding !== undefined) renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1c1448);
  scene.fog = new THREE.Fog(0x1c1448, 30, 70);

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);
  camera.position.set(0, 17, 9);
  camera.lookAt(0, 0, 0);

  scene.add(new THREE.HemisphereLight(0xbfd4ff, 0x3a2a66, 1.0));
  const sun = new THREE.DirectionalLight(0xfff4d6, 2.2);
  sun.position.set(8, 16, 6); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 60;
  sun.shadow.camera.left = -16; sun.shadow.camera.right = 16;
  sun.shadow.camera.top = 16; sun.shadow.camera.bottom = -16;
  scene.add(sun);

  const HALF = 12;        // playfield half-size (car bounds)
  const PLATE = 22;       // visual baseplate half-size (fills the frame)

  // baseplate
  const plate = new THREE.Mesh(
    new THREE.BoxGeometry(PLATE * 2, 0.6, PLATE * 2),
    new THREE.MeshStandardMaterial({ color: 0x2fa84f, roughness: 0.85 })
  );
  plate.position.y = -0.3; plate.receiveShadow = true; scene.add(plate);

  // studs (instanced) across the whole visible plate
  const STUDS = 34;
  const studGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.16, 14);
  const studMat = new THREE.MeshStandardMaterial({ color: 0x37c25c, roughness: 0.8 });
  const inst = new THREE.InstancedMesh(studGeo, studMat, STUDS * STUDS);
  inst.receiveShadow = true;
  const dummy = new THREE.Object3D();
  const step = (PLATE * 2) / STUDS;
  let i = 0;
  for (let a = 0; a < STUDS; a++)
    for (let b = 0; b < STUDS; b++) {
      dummy.position.set(-PLATE + step / 2 + a * step, 0.08, -PLATE + step / 2 + b * step);
      dummy.updateMatrix(); inst.setMatrixAt(i++, dummy.matrix);
    }
  scene.add(inst);

  // a few decorative bricks around the field
  const brickColors = [0xe3000b, 0x0057b8, 0xffd000, 0xff7a00, 0x7b2ff7];
  for (let k = 0; k < 7; k++) {
    const bw = 1.4 + Math.random() * 1.2;
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(bw, 0.9, 1.1),
      new THREE.MeshStandardMaterial({ color: brickColors[k % brickColors.length], roughness: 0.5 })
    );
    const ang = (k / 7) * Math.PI * 2;
    m.position.set(Math.cos(ang) * (HALF - 2.2), 0.45, Math.sin(ang) * (HALF - 2.2));
    m.rotation.y = Math.random() * Math.PI; m.castShadow = true; m.receiveShadow = true;
    scene.add(m);
  }

  // car
  const car = new THREE.Group(); scene.add(car);
  let carReady = false, FORWARD = 0;
  try {
    const gltf = await loadGLB(window.MODELS.car);
    const model = gltf.scene;
    const info = frameModel(model, 3.0);
    const box = new THREE.Box3().setFromObject(model);
    model.position.y -= box.min.y; // sit on ground
    model.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    // orient car so its longest horizontal axis points to +Z (driving direction)
    if (info.size.x > info.size.z) FORWARD = Math.PI / 2;
    car.add(model);
    carReady = true;
  } catch (e) { console.warn("car load failed", e); }

  // soft shadow blob fallback under the car
  const blob = new THREE.Mesh(
    new THREE.CircleGeometry(1.4, 24),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.18 })
  );
  blob.rotation.x = -Math.PI / 2; blob.position.y = 0.18; car.add(blob);

  // target tracking
  const target = new THREE.Vector3(0, 0, 0);
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const hitPoint = new THREE.Vector3();
  let hasPointer = false, lastHeading = 0;

  function pointerToTarget(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    ndc.x = ((clientX - r.left) / r.width) * 2 - 1;
    ndc.y = -((clientY - r.top) / r.height) * 2 + 1;
    ray.setFromCamera(ndc, camera);
    if (ray.ray.intersectPlane(plane, hitPoint)) {
      target.x = THREE.MathUtils.clamp(hitPoint.x, -HALF + 1.5, HALF - 1.5);
      target.z = THREE.MathUtils.clamp(hitPoint.z, -HALF + 1.5, HALF - 1.5);
      hasPointer = true;
      if (hint) hint.style.opacity = "0";
    }
  }

  if (!isTouch) {
    canvas.addEventListener("mousemove", (e) => pointerToTarget(e.clientX, e.clientY));
  }

  // mobile: car drives in the direction of scroll
  let scrollTargetZ = 0, wander = 0;
  if (isTouch) {
    if (hint) hint.textContent = "скролль — машинка едет 📜";
    let lastY = scrollY;
    addEventListener("scroll", () => {
      const dy = scrollY - lastY; lastY = scrollY;
      scrollTargetZ = THREE.MathUtils.clamp(scrollTargetZ + dy * 0.02, -HALF + 1.5, HALF - 1.5);
      hasPointer = true;
    }, { passive: true });
  }

  // honk + drop brick on click/tap
  function pop(clientX, clientY) {
    pointerToTarget(clientX, clientY);
    const b = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.5, 0.7),
      new THREE.MeshStandardMaterial({ color: brickColors[(Math.random() * brickColors.length) | 0], roughness: 0.5 })
    );
    b.castShadow = true;
    b.position.set(car.position.x, 4, car.position.z);
    scene.add(b);
    const vy = { v: 0 }, life = { t: 0 };
    const drop = () => {
      vy.v -= 0.012; b.position.y += vy.v; b.rotation.y += 0.1; life.t += 1;
      if (b.position.y <= 0.25) { b.position.y = 0.25; vy.v *= -0.4; }
      if (life.t < 160) requestAnimationFrame(drop); else scene.remove(b);
    };
    drop();
  }
  canvas.addEventListener("pointerdown", (e) => pop(e.clientX, e.clientY));

  function resize() {
    const r = canvas.getBoundingClientRect();
    const w = Math.max(1, r.width), h = Math.max(1, r.height);
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  resize(); addEventListener("resize", resize);

  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.05);
    // idle gentle wander before first interaction
    if (!hasPointer) {
      wander += dt * 0.5;
      target.x = Math.cos(wander) * 5;
      target.z = Math.sin(wander * 1.3) * 5;
    } else if (isTouch) {
      wander += dt * 0.6;
      target.x = Math.cos(wander * 0.7) * 4.5;
      target.z = scrollTargetZ;
    }

    if (carReady) {
      const prev = car.position.clone();
      car.position.x += (target.x - car.position.x) * Math.min(1, dt * 3.2);
      car.position.z += (target.z - car.position.z) * Math.min(1, dt * 3.2);
      const dx = car.position.x - prev.x, dz = car.position.z - prev.z;
      const speed = Math.hypot(dx, dz);
      if (speed > 0.0015) {
        lastHeading = Math.atan2(dx, dz); // face travel direction
      }
      // smooth heading
      let diff = lastHeading + FORWARD - car.rotation.y;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      car.rotation.y += diff * Math.min(1, dt * 6);
      // little bounce / lean
      car.rotation.z = Math.sin(performance.now() * 0.008) * 0.02 * (speed * 40);
      car.position.y = Math.abs(Math.sin(performance.now() * 0.012)) * 0.04 * Math.min(1, speed * 30);
    }
    renderer.render(scene, camera);
  });
}

/* ============================================================
   5) GSAP reveals + scroll zoom + progress
   ============================================================ */
function initScroll() {
  // ----- progress bar (vanilla, no deps) -----
  const bar = document.querySelector("#progress span");
  if (bar) {
    const upd = () => {
      const sc = document.documentElement;
      const p = sc.scrollTop / Math.max(1, sc.scrollHeight - sc.clientHeight);
      bar.style.width = (p * 100).toFixed(1) + "%";
    };
    addEventListener("scroll", upd, { passive: true }); upd();
  }

  // ----- reveals: IntersectionObserver (works even if GSAP fails to load) -----
  const reveals = Array.from(document.querySelectorAll(".reveal"));
  const showAll = () => reveals.forEach((el) => el.classList.add("in"));
  if (reduceMotion || !("IntersectionObserver" in window)) {
    showAll();
  } else {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    reveals.forEach((el) => io.observe(el));
    // hard safety net: if anything is still hidden after 3.5s, show it
    setTimeout(showAll, 3500);
  }

  // ----- fancy scroll-zoom: GSAP only (progressive enhancement) -----
  if (!window.gsap) return;
  const { gsap } = window;
  if (window.ScrollTrigger) gsap.registerPlugin(window.ScrollTrigger);
  if (reduceMotion) return;

  // zoom-in cards as they enter
  gsap.utils.toArray(".zoomable").forEach((el) => {
    gsap.fromTo(el, { scale: 0.82 }, {
      scale: 1, ease: "none",
      scrollTrigger: { trigger: el, start: "top 95%", end: "top 55%", scrub: true },
    });
  });

  // strong zoom for the build block
  gsap.utils.toArray(".zoomable-strong").forEach((el) => {
    gsap.fromTo(el, { scale: 0.7, rotateX: 8 }, {
      scale: 1, rotateX: 0, ease: "none",
      scrollTrigger: { trigger: el, start: "top bottom", end: "center center", scrub: true },
    });
  });

  // hero subtle zoom out on scroll
  const hero = document.querySelector(".hero");
  if (hero && window.ScrollTrigger) {
    gsap.to(hero, {
      scale: 0.92, opacity: 0.55, ease: "none",
      scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: true },
    });
  }
}

/* ============================================================
   6) One-time pixelation on first scroll
   ============================================================ */
function initPixelation() {
  const app = document.getElementById("app");
  const comp = document.getElementById("px-comp");
  const morph = document.getElementById("px-morph");
  if (!app || !comp || !morph || reduceMotion) return;
  let done = false;
  function run() {
    if (done) return; done = true;
    removeEventListener("scroll", onScroll);
    removeEventListener("wheel", onScroll);
    removeEventListener("touchmove", onScroll);

    app.classList.add("pixelating");
    const start = performance.now();
    const DUR = 750, MAXCELL = 9, MAXR = 4.5;
    function tick(now) {
      let p = (now - start) / DUR;
      if (p < 0) p = 0;
      if (p >= 1) {
        app.classList.remove("pixelating");
        return;
      }
      const ease = 1 - Math.pow(p, 1.7);          // shrink pixels over time
      const cell = Math.max(1, MAXCELL * ease);
      const r = Math.max(0, MAXR * ease);
      comp.setAttribute("width", cell.toFixed(2));
      comp.setAttribute("height", cell.toFixed(2));
      morph.setAttribute("radius", r.toFixed(2));
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }
  function onScroll() { run(); }
  addEventListener("scroll", onScroll, { passive: true, once: false });
  addEventListener("wheel", onScroll, { passive: true });
  addEventListener("touchmove", onScroll, { passive: true });
}

/* ============================================================
   boot
   ============================================================ */
function boot() {
  initScroll();
  initPixelation();
  initMinifig().catch((e) => console.warn(e));
  initPlayground().catch((e) => console.warn(e));
}
if (document.readyState === "loading") addEventListener("DOMContentLoaded", boot);
else boot();
