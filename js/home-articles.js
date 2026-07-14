/* ===========================================================
   home-articles.js — بخش «جدیدترین‌ها» در پایین صفحه اصلی
   -----------------------------------------------------------
   کپیِ دقیقِ منطق و استایلِ بخشِ «جدیدترین‌ها» در صفحه‌ی مقالات
   (articles.js) که به‌صورت مستقل روی صفحه‌ی اصلی اجرا می‌شود.

   GET api/articles_list.php?stack=1&limit=5
       -> { ok:true, data:{ articles:[...] } }
   =========================================================== */
(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", () => {
    const wrap = document.getElementById("homeStackWrap");
    if (!wrap) return;
    loadHomeStack(wrap);
  });

  /* -------------------- ابزارهای عمومی -------------------- */
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
      console.error("[home-articles.js] خطا در دریافت اطلاعات از سرور:", url, e);
      return null;
    }
  }

  /* -------------------- کارت مقاله (المان مشترک) -------------------- */
  function categoryVisual(cat) {
    const color = cat.color || COLORS[cat.slug] || "var(--c-teal)";
    if (cat.icon && (cat.icon.startsWith("assets/") || /^https?:\/\//.test(cat.icon))) {
      return {
        icon: `<img src="${cat.icon}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;">`,
        color,
      };
    }
    const icon = cat.icon && ICONS[cat.icon] ? ICONS[cat.icon] : (ICONS[cat.slug] || ICONS.default);
    return { icon, color };
  }

  function articleCardHtml(article) {
    const cat = {
      slug: article.category_slug,
      name: article.category_name,
      description: article.category_description,
      icon: article.category_icon,
      color: article.category_color,
    };
    const { icon, color } = categoryVisual(cat);
    const img = article.cover_image
      ? `<img src="${article.cover_image}" alt="${escapeHtml(article.title)}" loading="lazy">`
      : "";

    return `
      <a href="article.html?slug=${encodeURIComponent(article.slug)}" class="rasa-card">
        <div class="rasa-card-media">
          ${img}
          <div class="rasa-card-author">
            <img src="${article.author_avatar || ""}" alt="${escapeHtml(article.author || "")}">
            <span>${escapeHtml(article.author || "رویایی رسا")}</span>
          </div>
        </div>
        <div class="rasa-card-body">
          <div class="rasa-card-cat" style="--cat-color:${color}">
            <span class="rasa-card-cat-icon">${icon}</span>
            <span class="rasa-card-cat-text">
              <strong>${escapeHtml(article.category_name || "")}</strong>
              <small>${escapeHtml(article.category_description || "")}</small>
            </span>
          </div>
          <h3 class="rasa-card-title">${escapeHtml(article.title)}</h3>
          <p class="rasa-card-excerpt">${escapeHtml(article.excerpt || "")}</p>
        </div>
      </a>`;
  }

  /* -----------------------------------------------------------
     جدیدترین‌ها — انیمیشن پشته سه بعدی (همواره صعودی رو به بالا)
  ----------------------------------------------------------- */
  async function loadHomeStack(wrap) {
    const section = wrap.closest(".home-latest-section");
    const data = await fetchJSON("api/articles_list.php?stack=1&limit=5");
    if (!data) {
      section?.style.setProperty("display", "none");
      return;
    }
    const list = data.articles || [];
    if (!list.length) { section?.style.setProperty("display", "none"); return; }

    wrap.innerHTML = list
      .map((article) => `<div class="stack-card2">${articleCardHtml(article)}</div>`)
      .join("");

    const cards = Array.from(wrap.children);
    let order = cards.map((_, i) => i);

    const OFFSET_X = 0;
    const VISIBLE_LAYERS = 3;

    function layout() {
      const isMobile = window.innerWidth <= 768;
      const stepY = isMobile ? -14 : -24;

      order.forEach((cardIndex, pos) => {
        const el = cards[cardIndex];
        el.style.zIndex = String(order.length - pos);
        el.style.transform = `translate(${pos * OFFSET_X}px, ${pos * stepY}px) scale(${1 - pos * 0.04})`;
        el.style.opacity = pos < VISIBLE_LAYERS ? String(1 - pos * 0.22) : "0";
        el.style.pointerEvents = pos === 0 ? "auto" : "none";
      });
    }
    function stepForward() { order.push(order.shift()); layout(); }
    function stepBack() { order.unshift(order.pop()); layout(); }

    layout();

    window.addEventListener("resize", layout);

    if (cards.length > 1) {
      let timer = setInterval(stepForward, 4500);
      wrap.addEventListener("mouseenter", () => clearInterval(timer));
      wrap.addEventListener("mouseleave", () => { timer = setInterval(stepForward, 4500); });

      let wheelLock = false;
      wrap.addEventListener("wheel", (e) => {
        if (wheelLock) return;
        e.preventDefault();
        wheelLock = true;
        if (e.deltaY > 0) stepForward(); else stepBack();
        setTimeout(() => { wheelLock = false; }, 550);
      }, { passive: false });
    }
  }

  const ICONS = {
    rasa: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8c3-3 9-3 12 0M4 12.5c4.4-4 11.6-4 16 0M8 17c2-1.6 6-1.6 8 0"/><circle cx="12" cy="20" r="1.1" fill="currentColor" stroke="none"/></svg>`,
    rasabaz: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="8" width="19" height="10" rx="5"/><path d="M7.5 11v4M5.5 13h4"/><circle cx="16" cy="11.6" r="1" fill="currentColor" stroke="none"/><circle cx="18.2" cy="14" r="1" fill="currentColor" stroke="none"/></svg>`,
    raysanes: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 2.5h6M10 2.5v5.6L5.5 16a2.4 2.4 0 0 0 2.1 3.5h8.8a2.4 2.4 0 0 0 2.1-3.5L14 8.1V2.5"/><path d="M7.5 14.5h9"/></svg>`,
    default: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3.5h9L19 8v12.5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z"/><path d="M9 12h6M9 16h6"/></svg>`,
  };
  const COLORS = {
    rasa: "var(--cat-a)",
    rasabaz: "var(--cat-b)",
    raysanes: "var(--cat-c)",
  };
})();
