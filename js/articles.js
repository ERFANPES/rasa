/* ===========================================================
   articles.js — منطق صفحه‌ی مقالات (نسخه دسکتاپ)
   -----------------------------------------------------------
   قرارداد API (هماهنگ با ساختار قبلیِ پروژه):
     GET  api/taxonomy_list.php
          -> { ok:true, data:{ categories:[...], tags:[...] } }
          هر دسته می‌تواند فیلدهای اختیاری icon و color هم داشته
          باشد. اگر نداشت، از نگاشتِ محلی ICONS/COLORS استفاده
          می‌شود (پایین همین فایل).
          category: { id, slug, name, description, parent_id, icon?, color? }

     GET  api/articles_list.php?stack=1&limit=5
          -> { ok:true, data:{ articles:[...] } }
          برای بخش «جدیدترین‌ها» — چند مقاله‌ی اخیر برای پشته.

     GET  api/articles_list.php?page=N&q=&category=&tag=
          -> { ok:true, data:{ articles:[...], page, total_pages } }
          برای لیست «وبلاگ» — صفحه‌بندی ۱۰تا۱۰تا.

     ساختار هر مقاله:
       { slug, title, excerpt, cover_image, author, author_avatar,
         category_slug, category_name, category_description,
         published_at, reading_time }

   ⚠️ MOCK DATA:
   چون بک‌اند هنوز آماده نیست، اگر fetch با خطا مواجه شود
   (یا فایل به‌صورت محلی باز شود)، به‌صورت خودکار از داده‌ی
   نمونه‌ی پایین فایل استفاده می‌شود تا طراحی قابل پیش‌نمایش
   باشد. وقتی بک‌اند واقعی جواب داد، این fallback به‌طور خودکار
   دیگر استفاده نمی‌شود و لازم نیست چیزی حذف کنید.
   =========================================================== */
/* ===========================================================
   articles.js — منطق صفحه‌ی مقالات (نسخه دسکتاپ و موبایل)
   =========================================================== */
   (function () {
    "use strict";
  
    const PAGE_SIZE = 10;
  
    let state = { page: 1, q: "", category: "" };
    let categories = [];
  
    document.addEventListener("DOMContentLoaded", () => {
      if (!document.getElementById("blogList")) return;
  
      const params = new URLSearchParams(window.location.search);
      state.q = params.get("q") || "";
      state.category = params.get("category") || "";
      if (state.q) document.getElementById("searchInput").value = state.q;
  
      wireSearch();
      loadTaxonomy();
      loadStack();
      loadBlogList();
  
      document.getElementById("clearFiltersBtn")?.addEventListener("click", () => {
        state = { page: 1, q: "", category: "" };
        document.getElementById("searchInput").value = "";
        syncSelectedCategory();
        loadBlogList();
      });
    });
  
    /* -------------------- ابزارهای عمومی -------------------- */
    function escapeHtml(str) {
      const div = document.createElement("div");
      div.textContent = str ?? "";
      return div.innerHTML;
    }
  
    async function fetchJSON(url, mockFallback) {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error("bad status");
        const data = await res.json();
        if (!data.ok) throw new Error(data.message || "bad response");
        return data.data;
      } catch (e) {
        console.info("[articles.js] استفاده از داده‌ی نمونه برای:", url);
        return mockFallback;
      }
    }
  
    /* -------------------- جستجو (هدر ثابت) -------------------- */
    function wireSearch() {
      const input = document.getElementById("searchInput");
      const header = document.getElementById("searchHeader");
  
      let debounce;
      input?.addEventListener("input", () => {
        clearTimeout(debounce);
        debounce = setTimeout(() => {
          state.q = input.value.trim();
          state.page = 1;
          loadBlogList();
        }, 400);
      });
  
      let lastY = window.scrollY;
      let ticking = false;
      window.addEventListener("scroll", () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
          const y = window.scrollY;
          const goingDown = y > lastY;
          if (goingDown && y > 120) {
            header.classList.add("is-hidden");
          } else {
            header.classList.remove("is-hidden");
          }
          if (document.activeElement === input) header.classList.remove("is-hidden");
          lastY = y;
          ticking = false;
        });
      }, { passive: true });
    }
  
    /* -------------------- دسته‌بندی‌ها -------------------- */
    async function loadTaxonomy() {
      const data = await fetchJSON("api/taxonomy_list.php", { categories: MOCK_CATEGORIES });
      categories = (data.categories || []).filter((c) => !c.parent_id);
      renderCategories();
    }
  
    function categoryVisual(cat) {
      const icon = cat.icon && ICONS[cat.icon] ? ICONS[cat.icon] : (ICONS[cat.slug] || ICONS.default);
      const color = cat.color || COLORS[cat.slug] || "var(--c-teal)";
      return { icon, color };
    }
  
    function renderCategories() {
      const wrap = document.getElementById("catScroller");
      if (!categories.length) { wrap.innerHTML = ""; return; }
      wrap.innerHTML = categories
        .map((c) => {
          const { icon, color } = categoryVisual(c);
          return `
          <button type="button" class="cat-card ${state.category === c.slug ? "is-selected" : ""}"
                  data-slug="${escapeHtml(c.slug)}" style="--cat-color:${color}">
            <span class="cat-card-icon">${icon}</span>
            <span class="cat-card-text">
              <strong>${escapeHtml(c.name)}</strong>
              <small>${escapeHtml(c.description || "")}</small>
            </span>
          </button>`;
        })
        .join("");
  
      wrap.querySelectorAll(".cat-card").forEach((btn) => {
        btn.addEventListener("click", () => {
          const slug = btn.dataset.slug;
          state.category = state.category === slug ? "" : slug;
          state.page = 1;
          syncSelectedCategory();
          if (state.category) {
            btn.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
          }
          loadBlogList();
        });
      });
    }
  
    function syncSelectedCategory() {
      document.querySelectorAll("#catScroller .cat-card").forEach((btn) => {
        btn.classList.toggle("is-selected", btn.dataset.slug === state.category);
      });
    }
  
    /* -------------------- کارت مقاله (المان مشترک) -------------------- */
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
    async function loadStack() {
      const wrap = document.getElementById("stackWrap");
      const data = await fetchJSON("api/articles_list.php?stack=1&limit=5", { articles: MOCK_STACK });
      const list = data.articles || [];
      if (!list.length) { wrap.innerHTML = ""; return; }
  
      wrap.innerHTML = list
        .map((article) => `<div class="stack-card2">${articleCardHtml(article)}</div>`)
        .join("");
  
      const cards = Array.from(wrap.children);
      let order = cards.map((_, i) => i);
      
      const OFFSET_X = 0;   
      const VISIBLE_LAYERS = 3; 
  
      function layout() {
        const isMobile = window.innerWidth <= 768;
        // لایه‌ها در موبایل کمی فشرده‌تر (-14) و در دسکتاپ عمیق‌تر (-24) به سمت بالا می‌روند
        const stepY = isMobile ? -14 : -24; 
  
        order.forEach((cardIndex, pos) => {
          const el = cards[cardIndex];
          el.style.zIndex = String(order.length - pos);
          
          // اعمال استایل صعودی برای هر دو ساختار موبایل و دسکتاپ
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
  
    /* -------------------- وبلاگ (لیست صفحه‌بندی‌شده) -------------------- */
    async function loadBlogList() {
      const listEl = document.getElementById("blogList");
      const emptyEl = document.getElementById("articlesEmpty");
      const paginationEl = document.getElementById("pagination");
  
      listEl.innerHTML = '<div class="list-skel"></div><div class="list-skel"></div><div class="list-skel"></div>';
      emptyEl.style.display = "none";
  
      const params = new URLSearchParams();
      params.set("page", state.page);
      if (state.q) params.set("q", state.q);
      if (state.category) params.set("category", state.category);
  
      const mock = mockPage(state.page, state.q, state.category);
      const data = await fetchJSON("api/articles_list.php?" + params.toString(), mock);
      const list = data.articles || [];
  
      if (!list.length) {
        listEl.innerHTML = "";
        emptyEl.style.display = "block";
        paginationEl.style.display = "none";
        return;
      }
  
      listEl.innerHTML = list.map(articleCardHtml).join("");
      renderPagination(data.page || state.page, data.total_pages || 1);
    }
  
    function renderPagination(page, totalPages) {
      const el = document.getElementById("pagination");
      if (totalPages <= 1) { el.style.display = "none"; return; }
      el.style.display = "flex";
      let html = `<button class="pagination-btn" data-page="${page - 1}" ${page <= 1 ? "disabled" : ""}>قبلی</button>`;
      for (let i = 1; i <= totalPages; i++) {
        html += `<button class="pagination-btn ${i === page ? "is-active" : ""}" data-page="${i}">${i.toLocaleString("fa-IR")}</button>`;
      }
      html += `<button class="pagination-btn" data-page="${page + 1}" ${page >= totalPages ? "disabled" : ""}>بعدی</button>`;
      el.innerHTML = html;
      el.querySelectorAll(".pagination-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          const p = parseInt(btn.dataset.page, 10);
          if (!p || p < 1 || p > totalPages) return;
          state.page = p;
          loadBlogList();
          document.getElementById("blogList").scrollIntoView({ behavior: "smooth", block: "start" });
        });
      });
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
  
    const MOCK_CATEGORIES = [
      { id: 1, slug: "rasa", name: "رسا", description: "محتوای داخلی رسا", parent_id: null },
      { id: 2, slug: "rasabaz", name: "رساباز", description: "محتوای بازی‌های ویدیویی", parent_id: null },
      { id: 3, slug: "raysanes", name: "رساینس", description: "محتوای جهان علم", parent_id: null },
    ];
  
    function mockArticle(i, categoryIndex) {
      const cat = MOCK_CATEGORIES[categoryIndex % MOCK_CATEGORIES.length];
      const authors = ["عرفان سعادتی منعم", "نگار احمدی", "سام رستمی"];
      const author = authors[i % authors.length];
      return {
        slug: `article-${i}`,
        title:
          i % 3 === 0
            ? "بازی‌های ویدیویی؛ سرگرمی یا فرصتی برای یادگیری؟"
            : i % 3 === 1
            ? "چطور یک روتین محتوایی پایدار برای وبلاگ بسازیم"
            : "روایت رسا از پروژه‌ای که همه چیز را تغییر داد",
        excerpt:
          "خیلی از ما وقتی اسمِ این موضوع را می‌شنویم، یاد ساعت‌ها نشستن پای صفحه می‌افتیم؛ اما واقعیت این است که ماجرا خیلی فراتر از این حرف‌هاست...",
        cover_image: `https://picsum.photos/seed/rasa-${i}/700/900`,
        author,
        author_avatar: `https://ui-avatars.com/api/?background=0c8d8d&color=fff&name=${encodeURIComponent(author)}`,
        category_slug: cat.slug,
        category_name: cat.name,
        category_description: cat.description,
        published_at: `1404-04-${String((i % 28) + 1).padStart(2, "0")}`,
        reading_time: 3 + (i % 6),
      };
    }
  
    const MOCK_STACK = [0, 1, 2, 3].map((i) => mockArticle(i, i));
    const MOCK_ALL = Array.from({ length: 24 }, (_, i) => mockArticle(i + 4, i));
  
    function mockPage(page, q, category) {
      let list = MOCK_ALL;
      if (category) list = list.filter((a) => a.category_slug === category);
      if (q) list = list.filter((a) => a.title.includes(q) || a.excerpt.includes(q));
      const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
      const start = (page - 1) * PAGE_SIZE;
      return {
        articles: list.slice(start, start + PAGE_SIZE),
        page,
        total_pages: totalPages,
      };
    }
  })();