/* ===========================================================
   index.js
   اسکریپت‌های اختصاصی صفحه اصلی (index.html):
   انیمیشن هیرو، کاروسل تیم، مودال تیم، انیمیشن کارت‌های پروژه
   و کاروسل سه‌بعدی افتخارات.
   اسکریپت‌های مشترک بین همه صفحات در js/main.js قرار دارند.
   =========================================================== */
document.addEventListener("DOMContentLoaded", () => {
  initHeroScroll();
  initTeamCarousel();
  initTeamModalController();
  initProjectCardsAnimation();
  initAwards3DCarousel();
});

/* ---------------------------------------------------------
   3) Hero scroll sequence
--------------------------------------------------------- */
function initHeroScroll() {
  const hero = document.querySelector(".hero");
  if (!hero || typeof gsap === "undefined") return;

  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });

  ScrollTrigger.normalizeScroll({
    type: "touch",
    momentum: (self) => Math.min(3, Math.abs(self.velocityY) / 1000),
  });

  const stage = hero.querySelector(".hero-stage");
  const figure = hero.querySelector(".hero-figure");
  const headlines = hero.querySelectorAll(".hero-headline");
  const reveal = hero.querySelector(".hero-reveal");
  const navPill = document.querySelector(".nav-pill");

  const vh = window.innerHeight;
  const isDesktop = window.matchMedia("(min-width:900px)").matches;
  const distance = vh * 1.5;

  const HEADLINE_TRAVEL = isDesktop ? 0.32 : 0.36;
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
    const stepX = isDesktop ? window.innerWidth * 0.22 : window.innerWidth * 0.32; 

    cards.forEach((card, i) => {
      let offset = i - currentIndex;
      if (offset > totalCards / 2) offset -= totalCards;
      if (offset < -totalCards / 2) offset += totalCards;

      const absOffset = Math.abs(offset);
      const maxVisibleRadius = isDesktop ? 2 : 1; 

      if (absOffset <= maxVisibleRadius) {
        card.style.visibility = "visible";
        
        const opacityValue = absOffset === 0 ? "1" : (absOffset === 1 ? "0.7" : "0.4");
        const blurValue = absOffset === 0 ? "0px" : (absOffset === 1 ? "2px" : "5px");
        
        card.style.opacity = opacityValue;
        card.style.filter = `blur(${blurValue})`;

        const scale = absOffset === 0 ? 1 : (absOffset === 1 ? 0.78 : 0.55);
        const dip = absOffset === 0 ? 0 : (absOffset === 1 ? 18 : 38);
        const rotateY = offset === 0 ? 0 : (offset > 0 ? -12 : 12);
        const translateX = -offset * stepX; 

        const zIndex = 100 - absOffset;

        card.style.transform = `translate3d(calc(-50% + ${translateX}px), calc(-50% + ${dip}px), 0) scale(${scale}) rotateY(${rotateY}deg)`;
        card.style.zIndex = zIndex;
      } else {
        card.style.visibility = "hidden";
        card.style.opacity = "0";
        card.style.filter = "blur(8px)";
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
      // جهت درگ بخش تیم: حرکت دست به راست = کارت بعدی | حرکت دست به چپ = کارت قبلی
      if (diff > 0) {
        next(); 
      } else {
        prev(); 
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

      const tgBtn = document.getElementById("modalTg");
      if (tg && tg !== "") {
        tgBtn.style.display = "flex";
        tgBtn.href = `https://t.me/${tg}`;
        tgBtn.querySelector(".username").textContent = `@${tg}`;
      } else {
        tgBtn.style.display = "none";
      }

      const igBtn = document.getElementById("modalIg");
      if (ig && ig !== "") {
        igBtn.style.display = "flex";
        igBtn.href = `https://instagram.com/${ig}`;
        igBtn.querySelector(".username").textContent = ig;
      } else {
        igBtn.style.display = "none";
      }

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

/* ---------------------------------------------------------
   6) Creative 3D Tilt & Glow Effect for Project Cards
--------------------------------------------------------- */
function initProjectCardsAnimation() {
  const cards = document.querySelectorAll('.creative-tilt');

  cards.forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left; 
      const y = e.clientY - rect.top; 
      
      card.style.setProperty('--x', `${x}px`);
      card.style.setProperty('--y', `${y}px`);
      
      const multiplier = 15;
      const rotateX = ((y / rect.height) - 0.5) * -multiplier;
      const rotateY = ((x / rect.width) - 0.5) * multiplier;
      
      card.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
    });

    card.addEventListener('mouseleave', () => {
      card.style.transform = `rotateX(0deg) rotateY(0deg)`;
      const glow = card.querySelector('.project-glow');
      if (glow) glow.style.opacity = '0';
    });

    card.addEventListener('touchstart', (e) => {
      const touch = e.touches[0];
      const rect = card.getBoundingClientRect();
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;
      
      card.style.setProperty('--x', `${x}px`);
      card.style.setProperty('--y', `${y}px`);
      card.style.transform = `scale(0.98) rotateX(4deg)`;
    }, { passive: true });

    card.addEventListener('touchend', () => {
      card.style.transform = `rotateX(0deg) rotateY(0deg) scale(1)`;
    });
  });
}

/* ---------------------------------------------------------
   7) 3D Virtual Trophies Carousel (ویترین افتخارات رسا)
--------------------------------------------------------- */
function initAwards3DCarousel() {
  const viewport = document.getElementById("awardsCarousel");
  const track = document.getElementById("awardsTrack");
  if (!viewport || !track) return;

  const items = Array.from(track.children);
  const totalItems = items.length;
  if (totalItems === 0) return;

  let currentIndex = 0;
  let autoplayTimer = null;
  const AUTOPLAY_DELAY = 3000;

  let startX = 0;
  let isDragging = false;
  let globalTime = 0;

  track.style.position = "relative";
  track.style.width = "100%";
  track.style.height = "100%";

  items.forEach(item => {
    item.style.position = "absolute";
    item.style.top = "50%";
    item.style.left = "50%";
    item.style.transformOrigin = "center center";
    item.style.transition = "transform 0.65s cubic-bezier(0.2, 1, 0.25, 1), opacity 0.65s ease, filter 0.65s";
  });

  const fallbackSVG = `
    <svg class="award-fallback-svg" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6v5Zm0 0v8a4 4 0 0 0 4 4h4a4 4 0 0 0 4-4V9M6 9h12M18 9h1.5a2.5 2.5 0 0 0 0-5H18v5Zm-6 12v2m-4 0h8" stroke="#0c8d8d" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `;

  items.forEach(item => {
    const img = item.querySelector('img');
    if(img) {
      img.onerror = () => { item.innerHTML = fallbackSVG; };
    }
  });

  function updateAwards() {
    const isDesktop = window.matchMedia("(min-width: 900px)").matches;
    const isTablet = window.matchMedia("(min-width: 600px)").matches;
    
    let stepX = isDesktop ? window.innerWidth * 0.24 : (isTablet ? window.innerWidth * 0.32 : window.innerWidth * 0.42);
    let stepZ = isDesktop ? 180 : 120;

    items.forEach((item, i) => {
      let offset = i - currentIndex;
      
      if (offset > totalItems / 2) offset -= totalItems;
      if (offset < -totalItems / 2) offset += totalItems;

      const absOffset = Math.abs(offset);

      if (absOffset <= 1.4) {
        item.style.visibility = "visible";

        let scale = 1 - (absOffset * 0.32); 
        let opacity = 1 - (absOffset * 0.55);
        let blur = absOffset * 6;
        let rotateY = -offset * 35;
        let transX = -offset * stepX;
        let transZ = -absOffset * stepZ;

        item.dataset.transX = transX;
        item.dataset.transZ = transZ;
        item.dataset.scale = scale;
        item.dataset.rotateY = rotateY;
        item.dataset.absOffset = absOffset;

        item.style.opacity = Math.max(0, Math.min(1, opacity));
        item.style.filter = `blur(${blur}px)`;
        item.style.zIndex = Math.round(100 - absOffset * 10);
        
        item.style.transform = `translate3d(calc(-50% + ${transX}px), -50%, ${transZ}px) scale(${scale}) rotateY(${rotateY}deg)`;
      } else {
        item.style.visibility = "hidden";
        item.style.opacity = "0";
        item.style.transform = `translate3d(-50%, -50%, -300px) scale(0.3)`;
      }
    });
  }

  function floatLoop() {
    globalTime += 0.025;
    
    items.forEach((item) => {
      if (item.style.visibility === "visible" && item.dataset.absOffset) {
        const absOffset = parseFloat(item.dataset.absOffset);
        const transX = parseFloat(item.dataset.transX);
        const transZ = parseFloat(item.dataset.transZ);
        const scale = parseFloat(item.dataset.scale);
        const rotateY = parseFloat(item.dataset.rotateY);

        const centerFactor = 1 - Math.min(1, absOffset);
        const floatY = Math.sin(globalTime) * 12 * centerFactor; 
        const floatTilt = Math.cos(globalTime * 0.6) * 1.5 * centerFactor;

        item.style.transform = `translate3d(calc(-50% + ${transX}px), calc(-50% + ${floatY}px), ${transZ}px) scale(${scale}) rotateY(${rotateY + floatTilt}deg)`;
      }
    });
    
    requestAnimationFrame(floatLoop);
  }

  function next() {
    currentIndex = (currentIndex + 1) % totalItems;
    updateAwards();
  }

  function prev() {
    currentIndex = (currentIndex - 1 + totalItems) % totalItems;
    updateAwards();
  }

  function handleStart(clientX) {
    startX = clientX;
    isDragging = true;
    stopAutoplay();
  }

  function handleMove(clientX) {
    if (!isDragging) return;
    const diff = clientX - startX;
    
    if (Math.abs(diff) > 50) { 
      // جهت درگ بخش افتخارات: حرکت دست به راست = کارت بعدی | حرکت دست به چپ = کارت قبلی
      if (diff > 0) {
        next();
      } else {
        prev();
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
    e.preventDefault();
    viewport.style.cursor = "grabbing";
    handleStart(e.clientX);
  });
  window.addEventListener("mousemove", (e) => handleMove(e.clientX));
  window.addEventListener("mouseup", () => {
    viewport.style.cursor = "grab";
    handleEnd();
  });

  function startAutoplay() {
    stopAutoplay();
    autoplayTimer = setInterval(next, AUTOPLAY_DELAY);
  }

  function stopAutoplay() {
    if (autoplayTimer) clearInterval(autoplayTimer);
  }

  viewport.style.cursor = "grab";
  updateAwards();
  startAutoplay();
  floatLoop();

  window.addEventListener("resize", updateAwards);
}