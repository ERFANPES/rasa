/* ===========================================================
   projects.js — منطق صفحه‌ی فهرست پروژه‌ها (بازطراحی‌شده)
   تب دسته‌بندی + اسپاتلایت پروژه ویژه + ردیف‌های دسته‌بندی‌شده
   =========================================================== */
   (function () {
    "use strict";
  
    let allProjects = [];
    let categories = [];
    let activeCategory = "";
  
    document.addEventListener("DOMContentLoaded", () => {
      if (!document.getElementById("projGroups")) return;
  
      const params = new URLSearchParams(window.location.search);
      activeCategory = params.get("category") || "";
  
      loadProjects();
    });
  
    function escapeHtml(str) {
      const div = document.createElement("div");
      div.textContent = str ?? "";
      return div.innerHTML;
    }
  
    async function fetchJSON(url) {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error("bad status " + res.status);
        const data = await res.json();
        if (!data.ok) throw new Error(data.message || "bad response");
        return data.data;
      } catch (e) {
        console.error("[projects.js] خطا در دریافت اطلاعات از سرور:", url, e);
        return null;
      }
    }
  
    async function loadProjects() {
      const data = await fetchJSON("api/projects_list.php?per_page=60");
      const emptyEl = document.getElementById("projectsEmpty");
  
      if (!data) {
        document.getElementById("projTabs").innerHTML = "";
        document.getElementById("projBentoSection").style.display = "none";
        document.getElementById("projectsEmptyMsg").textContent = "خطا در برقراری ارتباط با سرور. لطفاً بعداً دوباره تلاش کنید.";
        emptyEl.style.display = "block";
        return;
      }
  
      allProjects = data.projects || [];
      categories = data.categories || [];
  
      if (!allProjects.length) {
        document.getElementById("projTabs").innerHTML = "";
        document.getElementById("projBentoSection").style.display = "none";
        emptyEl.style.display = "block";
        return;
      }
  
      renderTabs();
      renderBento();
      renderGroups();
  
      if (activeCategory) {
        const target = document.getElementById("cat-" + activeCategory);
        if (target) setTimeout(() => target.scrollIntoView({ behavior: "smooth", block: "start" }), 200);
      }
    }
  
    /* ---------------------------------------------------------
       تب‌های دسته‌بندی
    --------------------------------------------------------- */
    const CAT_COLORS = ["var(--cat-a)", "var(--cat-b)", "var(--cat-c)", "var(--cat-d)", "var(--cat-e)", "var(--cat-f)"];
  
    function catColor(index) {
      return CAT_COLORS[index % CAT_COLORS.length];
    }
  
    function renderTabs() {
      const wrap = document.getElementById("projTabs");
      let html = `<button type="button" class="proj-tab ${activeCategory === "" ? "is-active" : ""}" data-slug="">
          <span class="proj-tab-dot" style="--cat-color:var(--c-teal)"></span>همه
        </button>`;
      html += categories
        .map(
          (c, i) => `
          <button type="button" class="proj-tab ${activeCategory === c.slug ? "is-active" : ""}" data-slug="${escapeHtml(c.slug)}" style="--cat-color:${catColor(i)}">
            <span class="proj-tab-dot"></span>${escapeHtml(c.name)}
          </button>`
        )
        .join("");
      wrap.innerHTML = html;
  
      wrap.querySelectorAll(".proj-tab").forEach((btn) => {
        btn.addEventListener("click", () => {
          activeCategory = btn.dataset.slug;
          wrap.querySelectorAll(".proj-tab").forEach((b) => b.classList.toggle("is-active", b === btn));
          if (activeCategory === "") {
            window.scrollTo({ top: document.querySelector(".proj-bento-section")?.offsetTop - 90 || 0, behavior: "smooth" });
          } else {
            const target = document.getElementById("cat-" + activeCategory);
            target?.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        });
      });
    }
  
    /* ---------------------------------------------------------
       رسانه (عکس/ویدیو) مشترک
    --------------------------------------------------------- */
    function mediaHtml(p, tag) {
      const isVideo = p.cover_type === "video" && p.cover_video;
      if (isVideo) {
        return `<video src="${p.cover_video}" muted loop playsinline autoplay preload="metadata"></video>`;
      }
      if (p.cover_image) {
        return `<img src="${p.cover_image}" alt="${escapeHtml(p.title)}" loading="lazy">`;
      }
      return "";
    }
  
    function teamAvatarsHtml(team, max, sizeClass) {
      const list = (team || []).slice(0, max);
      const extra = (team || []).length - list.length;
      let html = list
        .map((t) =>
          t.avatar
            ? `<img src="${t.avatar}" alt="${escapeHtml(t.name || "")}" title="${escapeHtml(t.name || "")}">`
            : `<span title="${escapeHtml(t.name || "")}">${escapeHtml((t.name || "؟").trim().charAt(0))}</span>`
        )
        .join("");
      if (extra > 0) html += `<span class="team-more">+${extra.toLocaleString("fa-IR")}</span>`;
      return html;
    }
  
    /* ---------------------------------------------------------
       بنتو — گزیده‌ی تصادفی پروژه‌ها، چیدمان نامتقارن
       هر بار که صفحه لود می‌شود ترکیب متفاوتی از پروژه‌ها نمایش داده می‌شود
    --------------------------------------------------------- */
    function shuffle(arr) {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    }

    function renderBento() {
      const section = document.getElementById("projBentoSection");
      const grid = document.getElementById("projBentoGrid");
      const slots = ["bento-a", "bento-b", "bento-c", "bento-d", "bento-e"];
      const items = shuffle(allProjects).slice(0, Math.min(slots.length, allProjects.length));
      if (!items.length) { section.style.display = "none"; return; }

      grid.innerHTML = items
        .map((p, i) => {
          const isVideo = p.cover_type === "video" && p.cover_video;
          return `
          <a href="project.html?slug=${encodeURIComponent(p.slug)}" class="proj-bento-item ${slots[i]}">
            <div class="proj-bento-media">${mediaHtml(p)}</div>
            ${isVideo ? `<span class="proj-bento-play">${ICON_PLAY}</span>` : ""}
            ${p.category_name ? `<span class="proj-bento-tag">${escapeHtml(p.category_name)}</span>` : ""}
            <h2 class="proj-bento-title">${escapeHtml(p.title)}</h2>
          </a>`;
        })
        .join("");
    }
  
    /* ---------------------------------------------------------
       کارت عمودی
    --------------------------------------------------------- */
    function projectCardHtml(p, catColorVar, index) {
      const isVideo = p.cover_type === "video" && p.cover_video;
      return `
        <a href="project.html?slug=${encodeURIComponent(p.slug)}" class="proj-card">
          <div class="proj-card-media">${mediaHtml(p)}</div>
          ${isVideo ? `<span class="proj-card-video-badge">${ICON_PLAY}</span>` : ""}
          <div class="proj-card-team">${teamAvatarsHtml(p.team, 3)}</div>
          <span class="proj-card-index">${(index + 1).toLocaleString("fa-IR")}</span>
          <div class="proj-card-body">
            ${p.category_name ? `<span class="proj-card-cat" style="--cat-color:${catColorVar}">${escapeHtml(p.category_name)}</span>` : ""}
            <h3 class="proj-card-title">${escapeHtml(p.title)}</h3>
          </div>
        </a>`;
    }
  
    /* ---------------------------------------------------------
       ردیف‌های دسته‌بندی‌شده — به‌سبک فروشگاهی، هرکدام یک اسکرول افقی
    --------------------------------------------------------- */
    function renderGroups() {
      const wrap = document.getElementById("projGroups");

      const byCat = new Map();
      allProjects.forEach((p) => {
        const key = p.category_slug || "__none";
        if (!byCat.has(key)) byCat.set(key, []);
        byCat.get(key).push(p);
      });
  
      const orderedCats = categories.filter((c) => byCat.has(c.slug));
      if (byCat.has("__none")) orderedCats.push({ slug: "__none", name: "متفرقه" });
  
      if (!orderedCats.length) { wrap.innerHTML = ""; return; }
  
      wrap.innerHTML = orderedCats
        .map((c) => {
          const idx = categories.findIndex((x) => x.slug === c.slug);
          const color = catColor(idx >= 0 ? idx : 0);
          const items = byCat.get(c.slug) || [];
          return `
          <div class="proj-group" id="cat-${escapeHtml(c.slug)}" style="--cat-color:${color}">
            <div class="proj-group-head">
              <span class="proj-group-count">${items.length.toLocaleString("fa-IR")} پروژه</span>
              <h2>${escapeHtml(c.name)}</h2>
            </div>
            <div class="proj-scroll-row" data-slug="${escapeHtml(c.slug)}">${items.map((p, i) => projectCardHtml(p, color, i)).join("")}</div>
          </div>`;
        })
        .join("");
  
      wrap.querySelectorAll(".proj-scroll-row").forEach((row, i) => {
        initAutoScroller(row, 3200 + i * 250);
      });
    }
  
    /* ---------------------------------------------------------
       اسکرول خودکار افقی — با توقف روی تعامل کاربر
    --------------------------------------------------------- */
    function initAutoScroller(container, intervalMs) {
      if (!container) return;
      const items = Array.from(container.children);
      if (items.length < 2) return;
  
      let idx = 0;
      let timer = null;
      let resumeTimeout = null;
  
      function next() {
        idx = (idx + 1) % items.length;
        const y = window.scrollY;
        items[idx].scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
        window.scrollTo({ top: y, left: window.scrollX, behavior: "auto" });
      }
  
      function start() {
        stop();
        timer = setInterval(next, intervalMs);
      }
      function stop() {
        if (timer) clearInterval(timer);
        timer = null;
      }
      function pauseThenResume() {
        stop();
        clearTimeout(resumeTimeout);
        resumeTimeout = setTimeout(start, intervalMs * 1.6);
      }
  
      container.addEventListener("pointerdown", pauseThenResume, { passive: true });
      container.addEventListener("wheel", pauseThenResume, { passive: true });
      container.addEventListener("touchstart", pauseThenResume, { passive: true });
  
      start();
    }
  
    const ICON_PLAY = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7Z"/></svg>`;
    const ICON_STAR = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.6l2.9 6.2 6.6.7-4.9 4.6 1.3 6.6-5.9-3.3-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.7Z"/></svg>`;
  })();