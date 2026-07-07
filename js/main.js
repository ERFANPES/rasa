/* =========================================================
   رویایی رسا — main.js
   1) Ambient Three.js backdrop
   2) GSAP ScrollTrigger hero sequence
   3) Fixed bottom nav pill
   4) Team section — Responsive 3D Carousel (10 Cards Loop)
   5) Team Dynamic Modal Controller
   ========================================================= */

   document.addEventListener("DOMContentLoaded", () => {
    initBackground();
    initNavPill();
    initHeroScroll();
    initTeamCarousel();
    initTeamModalController();
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
  
  /* ---------------------------------------------------------
     3) Hero scroll sequence
  --------------------------------------------------------- */
  function initHeroScroll() {
    const hero = document.querySelector(".hero");
    if (!hero || typeof gsap === "undefined") return;
  
    gsap.registerPlugin(ScrollTrigger);
  
    const stage = hero.querySelector(".hero-stage");
    const figure = hero.querySelector(".hero-figure");
    const headlines = hero.querySelectorAll(".hero-headline");
    const reveal = hero.querySelector(".hero-reveal");
    const navPill = document.querySelector(".nav-pill");
  
    const vh = window.innerHeight;
    const isDesktop = window.matchMedia("(min-width:900px)").matches;
    const distance = vh * 1.5;
  
    const HEADLINE_TRAVEL = isDesktop ? 0.32 : 0.46;
    const FIGURE_PARALLAX = isDesktop ? 0.3 : 0.42;
  
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: hero,
        start: "top top",
        end: `+=${distance}`,
        scrub: true,
        pin: true,
        anticipatePin: 1,
      },
    });
  
    tl.to(stage, { y: -vh * 0.14, ease: "none", duration: 1 }, 0);
    tl.to(figure, { y: -vh * FIGURE_PARALLAX, ease: "none", duration: 1 }, 0);
    tl.to(headlines, { y: vh * HEADLINE_TRAVEL, scale: 0.56, ease: "none", duration: 1 }, 0);
  
    tl.call(() => navPill.classList.remove("is-visible"), null, 0);
    tl.call(() => navPill.classList.add("is-visible"), null, 0.05);
  
    tl.to(reveal, { opacity: 1, duration: 0.001 }, 0.82);
  }
  
  /* ---------------------------------------------------------
     4) Team section — Responsive 3D 10-Card Loop Carousel
  --------------------------------------------------------- */
  function initTeamCarousel() {
    const viewport = document.getElementById("teamCarousel");
    const track = document.getElementById("teamTrack");
    const dotsWrap = document.getElementById("teamDots");
    if (!viewport || !track) return;
  
    const cards = Array.from(track.children);
    const totalCards = cards.length;
    if (totalCards === 0) return;
  
    const dots = dotsWrap ? Array.from(dotsWrap.children) : [];
    let currentIndex = 0;
    let autoplayTimer = null;
    const AUTOPLAY_DELAY = 3000; 
  
    let startX = 0;
    let isDragging = false;
  
    track.style.position = "relative";
    track.style.width = "100%";
    track.style.height = "100%";
    
    cards.forEach(card => {
      card.style.position = "absolute";
      card.style.top = "50%";
      card.style.left = "50%";
      card.style.transformOrigin = "center center"; 
      card.style.transition = "transform 0.7s cubic-bezier(0.2, 1, 0.25, 1), opacity 0.7s ease, visibility 0.7s";
    });
  
    function updateCarousel() {
      const isDesktop = window.matchMedia("(min-width: 900px)").matches;
      const stepX = isDesktop ? window.innerWidth * 0.16 : window.innerWidth * 0.25;
  
      cards.forEach((card, i) => {
        let offset = i - currentIndex;
        if (offset > totalCards / 2) offset -= totalCards;
        if (offset < -totalCards / 2) offset += totalCards;
  
        const absOffset = Math.abs(offset);
        const maxVisibleRadius = isDesktop ? 2 : 1; 
  
        if (absOffset <= maxVisibleRadius) {
          card.style.visibility = "visible";
          card.style.opacity = absOffset === 0 ? "1" : (absOffset === 1 ? "0.65" : "0.32");
  
          const scale = absOffset === 0 ? 1 : (absOffset === 1 ? 0.76 : 0.58);
          const dip = absOffset === 0 ? 0 : (absOffset === 1 ? 26 : 48);
          const rotateY = offset === 0 ? 0 : (offset > 0 ? -16 : 16);
          const translateX = -offset * stepX; 
  
          const zIndex = 100 - absOffset;
  
          card.style.transform = `translate3d(calc(-50% + ${translateX}px), calc(-50% + ${dip}px), 0) scale(${scale}) rotateY(${rotateY}deg)`;
          card.style.zIndex = zIndex;
        } else {
          card.style.visibility = "hidden";
          card.style.opacity = "0";
          card.style.transform = `translate3d(-50%, -50%, 0) scale(0.4)`;
        }
      });
  
      dots.forEach((dot, i) => dot.classList.toggle("is-active", i === currentIndex));
    }
  
    function next() {
      currentIndex = (currentIndex + 1) % totalCards;
      updateCarousel();
    }
  
    function prev() {
      currentIndex = (currentIndex - 1 + totalCards) % totalCards;
      updateCarousel();
    }
  
    function startAutoplay() {
      stopAutoplay();
      autoplayTimer = setInterval(next, AUTOPLAY_DELAY);
    }
  
    function stopAutoplay() {
      if (autoplayTimer) clearInterval(autoplayTimer);
    }
  
    dots.forEach((dot, i) => {
      dot.addEventListener("click", () => {
        stopAutoplay();
        currentIndex = i;
        updateCarousel();
        startAutoplay();
      });
    });
  
    function handleStart(clientX) {
      startX = clientX;
      isDragging = true;
      stopAutoplay();
    }
  
    function handleMove(clientX) {
      if (!isDragging) return;
      const diff = clientX - startX;
      
      if (Math.abs(diff) > 45) { 
        if (diff > 0) {
          prev();
        } else {
          next();
        }
        isDragging = false; 
      }
    }
  
    function handleEnd() {
      isDragging = false;
      startAutoplay();
    }
  
    viewport.addEventListener("touchstart", (e) => handleStart(e.touches[0].clientX), { passive: true });
    viewport.addEventListener("touchmove", (e) => handleMove(e.touches[0].clientX), { passive: true });
    viewport.addEventListener("touchend", handleEnd, { passive: true });
  
    viewport.addEventListener("mousedown", (e) => {
      viewport.classList.add("is-dragging");
      handleStart(e.clientX);
    });
    window.addEventListener("mousemove", (e) => handleMove(e.clientX));
    window.addEventListener("mouseup", () => {
      viewport.classList.remove("is-dragging");
      handleEnd();
    });
  
    updateCarousel();
    startAutoplay();
  
    window.addEventListener("resize", updateCarousel);
    window.addEventListener("load", updateCarousel);
  }
  
  /* ---------------------------------------------------------
     5) Team Dynamic Modal Controller
  --------------------------------------------------------- */
  function initTeamModalController() {
    const modal = document.getElementById("teamModal");
    const cards = document.querySelectorAll(".team-card");
  
    if (!modal) return;
  
    cards.forEach(card => {
      card.addEventListener("click", () => {
        const name = card.getAttribute("data-name");
        const role = card.getAttribute("data-role");
        const img = card.getAttribute("data-img");
        const tg = card.getAttribute("data-tg") ? card.getAttribute("data-tg").replace('@', '').trim() : "";
        const ig = card.getAttribute("data-ig") ? card.getAttribute("data-ig").trim() : "";
        const site = card.getAttribute("data-site") ? card.getAttribute("data-site").trim() : "";
  
        document.getElementById("modalName").textContent = name;
        document.getElementById("modalRole").textContent = role;
        document.getElementById("modalImg").src = img;
  
        // بررسی تلگرام
        const tgBtn = document.getElementById("modalTg");
        if (tg && tg !== "") {
          tgBtn.style.display = "flex";
          tgBtn.href = `https://t.me/${tg}`;
          tgBtn.querySelector(".username").textContent = `@${tg}`;
        } else {
          tgBtn.style.display = "none";
        }
  
        // بررسی اینستاگرام
        const igBtn = document.getElementById("modalIg");
        if (ig && ig !== "") {
          igBtn.style.display = "flex";
          igBtn.href = `https://instagram.com/${ig}`;
          igBtn.querySelector(".username").textContent = ig;
        } else {
          igBtn.style.display = "none";
        }
  
        // بررسی وب‌سایت
        const siteBtn = document.getElementById("modalSite");
        if (site && site !== "") {
          siteBtn.style.display = "flex";
          siteBtn.href = site.startsWith('http') ? site : `https://${site}`;
          siteBtn.querySelector(".username").textContent = site;
        } else {
          siteBtn.style.display = "none";
        }
  
        modal.classList.add("is-open");
      });
    });
  }
  
  function closeTeamModal() {
    const modal = document.getElementById("teamModal");
    if (modal) {
      modal.classList.remove("is-open");
    }
  }
  
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeTeamModal();
  });