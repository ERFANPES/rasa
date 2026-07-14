/* ===========================================================
   project.js — منطق صفحه‌ی تکی پروژه (بازطراحی‌شده)
   =========================================================== */
   (function () {
    "use strict";
  
    document.addEventListener("DOMContentLoaded", () => {
      if (!document.getElementById("projectContent")) return;
  
      const slug = new URLSearchParams(window.location.search).get("slug");
      if (!slug) {
        showNotFound();
        return;
      }
      loadProject(slug);
      wireReadingProgress();
    });
  
    function escapeHtml(str) {
      const div = document.createElement("div");
      div.textContent = str ?? "";
      return div.innerHTML;
    }
  
    function formatDate(isoLike) {
      if (!isoLike) return "";
      try {
        const d = new Date(isoLike.replace(" ", "T"));
        return d.toLocaleDateString("fa-IR", { year: "numeric", month: "long", day: "numeric" });
      } catch (e) {
        return "";
      }
    }
  
    function showNotFound() {
      document.getElementById("projectLoading").style.display = "none";
      document.getElementById("projectNotFound").style.display = "flex";
    }
  
    async function loadProject(slug) {
      try {
        const res = await fetch("api/project_single.php?slug=" + encodeURIComponent(slug));
        const data = await res.json();
        if (!data.ok) throw new Error(data.message || "not found");
        renderProject(data.data.project);
      } catch (e) {
        console.error("[project.js] خطا در دریافت پروژه:", e);
        showNotFound();
      }
    }
  
    function renderProject(p) {
      document.getElementById("projectLoading").style.display = "none";
      document.getElementById("projectContent").style.display = "block";
  
      document.title = (p.meta_title || p.title) + " | رویایی رسا";
      document.getElementById("pageTitle").textContent = (p.meta_title || p.title) + " | رویایی رسا";
      document.getElementById("pageDescription").setAttribute("content", p.meta_description || p.excerpt || "");
      document.getElementById("ogTitle").setAttribute("content", p.title || "");
      document.getElementById("ogDescription").setAttribute("content", p.excerpt || "");
      if (p.cover_type === "image" && p.cover_image) {
        const ogUrl = /^https?:\/\//.test(p.cover_image) ? p.cover_image : location.origin + "/" + p.cover_image;
        document.getElementById("ogImage").setAttribute("content", ogUrl);
      }
  
      /* رسانه شاخص هیرو */
      const heroImg = document.getElementById("projectHeroImg");
      const heroVideo = document.getElementById("projectHeroVideo");
      if (p.cover_type === "video" && p.cover_video) {
        heroVideo.src = p.cover_video;
        heroVideo.style.display = "block";
        heroImg.style.display = "none";
        heroVideo.play?.().catch(() => {});
      } else if (p.cover_image) {
        heroImg.src = p.cover_image;
        heroImg.style.display = "block";
        heroVideo.style.display = "none";
      } else {
        document.getElementById("projectHero").style.minHeight = "320px";
      }
  
      document.getElementById("projectTitle").textContent = p.title;
      document.getElementById("projectDate").textContent = formatDate(p.published_at || p.created_at);
      document.getElementById("projectViews").textContent = (p.views || 0).toLocaleString("fa-IR") + " بازدید";
      if (p.excerpt) document.getElementById("projectExcerpt").textContent = p.excerpt;
  
      const team = p.team || [];
      if (team.length) {
        document.getElementById("projectTeamCount").textContent = team.length.toLocaleString("fa-IR") + " نفر تیم سازنده";
        document.getElementById("projectTeamCountItem").style.display = "flex";
      }
  
      if (p.category_name) {
        const badge = document.getElementById("projectCatBadge");
        badge.style.display = "inline-flex";
        badge.href = "projects.html?category=" + encodeURIComponent(p.category_slug || "");
        document.getElementById("projectCatBadgeName").textContent = p.category_name;
      }
  
      document.getElementById("projectProse").innerHTML = p.content || "";
      buildChapterRail();
  
      /* تیم پروژه */
      if (team.length) {
        document.getElementById("projectTeamSection").style.display = "block";
        document.getElementById("projectTeamGrid").innerHTML = team.map(teamChipHtml).join("");
        initAutoScroller(document.getElementById("projectTeamGrid"), 2800);
      }
  
      /* پروژه‌های مرتبط */
      const related = p.related || [];
      if (related.length) {
        document.getElementById("relatedSection").style.display = "block";
        document.getElementById("relatedGrid").innerHTML = related.map(relatedCardHtml).join("");
        initAutoScroller(document.getElementById("relatedGrid"), 3600);
      }
  
      wireShareButtons(p.title);
    }
  
    /* ---------------------------------------------------------
       ریل فصل‌ها — از h2های موجود در محتوا فصل می‌سازد
    --------------------------------------------------------- */
    function toFa(n) { return n.toLocaleString("fa-IR", { minimumIntegerDigits: 2 }); }

    function buildChapterRail() {
      const prose = document.getElementById("projectProse");
      const rail = document.getElementById("chapterRail");
      const list = document.getElementById("chapterRailList");
      const frame = document.getElementById("chapterRailFrame");
      const headings = Array.from(prose.querySelectorAll("h2"));

      if (headings.length < 2) { rail.style.display = "none"; return; }

      headings.forEach((h, i) => { h.id = h.id || "chapter-" + (i + 1); });

      list.innerHTML = headings
        .map(
          (h, i) => `
          <li>
            <button type="button" class="chapter-rail-dot" data-target="${h.id}" aria-label="${escapeHtml(h.textContent)}"></button>
            <span class="chapter-rail-tip">${escapeHtml(h.textContent)}</span>
          </li>`
        )
        .join("");

      rail.style.display = "flex";
      frame.textContent = toFa(1) + "/" + toFa(headings.length);

      const dots = Array.from(list.querySelectorAll(".chapter-rail-dot"));
      dots.forEach((dot) => {
        dot.addEventListener("click", () => {
          const target = document.getElementById(dot.dataset.target);
          if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      });

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            const idx = headings.findIndex((h) => h.id === entry.target.id);
            if (idx === -1) return;
            dots.forEach((d) => d.classList.toggle("is-active", d.dataset.target === entry.target.id));
            frame.textContent = toFa(idx + 1) + "/" + toFa(headings.length);
          });
        },
        { rootMargin: "-40% 0px -55% 0px", threshold: 0 }
      );
      headings.forEach((h) => observer.observe(h));
      dots[0]?.classList.add("is-active");
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
        items[idx].scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
        window.scrollTo({ top: y, left: window.scrollX, behavior: "auto" });
      }
      function start() { stop(); timer = setInterval(next, intervalMs); }
      function stop() { if (timer) clearInterval(timer); timer = null; }
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
  
    function teamChipHtml(t) {
      const avatar = t.avatar
        ? `<img src="${t.avatar}" alt="${escapeHtml(t.name)}">`
        : `<span>${escapeHtml((t.name || "؟").trim().charAt(0))}</span>`;
      const nameHtml = t.is_admin
        ? `<h3><a href="articles.html?author=${t.id}">${escapeHtml(t.name)}</a></h3>`
        : `<h3>${escapeHtml(t.name)}</h3>`;
      const role = t.role_title || (t.is_admin ? "عضو تیم رسا" : "");
      return `
        <div class="team-chip">
          <div class="team-chip-avatar">${avatar}</div>
          ${nameHtml}
          ${role ? `<p>${escapeHtml(role)}</p>` : ""}
          ${t.is_admin ? '<span class="team-chip-badge">تیم رسا</span>' : ""}
        </div>`;
    }
  
    function relatedCardHtml(p) {
      const isVideo = p.cover_type === "video" && p.cover_video;
      const media = isVideo
        ? `<video src="${p.cover_video}" muted loop playsinline preload="metadata"></video>`
        : p.cover_image
        ? `<img src="${p.cover_image}" alt="${escapeHtml(p.title)}" loading="lazy">`
        : "";
      return `
        <a class="related-card" href="project.html?slug=${encodeURIComponent(p.slug)}">
          <div class="related-card-media">${media}</div>
          <div class="related-card-body">
            <h3 class="related-card-title">${escapeHtml(p.title)}</h3>
          </div>
        </a>`;
    }
  
    function wireShareButtons(title) {
      const url = window.location.href;
      document.getElementById("shareTelegram").href = "https://t.me/share/url?url=" + encodeURIComponent(url) + "&text=" + encodeURIComponent(title || "");
      document.getElementById("shareNativeBtn")?.addEventListener("click", async () => {
        if (navigator.share) {
          try { await navigator.share({ title, url }); } catch (e) {}
        } else {
          wireShareButtons._copy();
        }
      });
      document.getElementById("shareCopyBtn")?.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(url);
          const btn = document.getElementById("shareCopyBtn");
          const old = btn.innerHTML;
          btn.innerHTML = "✓";
          setTimeout(() => { btn.innerHTML = old; }, 1500);
        } catch (e) {}
      });
    }
  
    function wireReadingProgress() {
      const bar = document.getElementById("readingProgressBar");
      window.addEventListener("scroll", () => {
        const h = document.documentElement;
        const scrolled = h.scrollTop;
        const height = h.scrollHeight - h.clientHeight;
        bar.style.width = height > 0 ? (scrolled / height) * 100 + "%" : "0%";
      }, { passive: true });
    }
  })();