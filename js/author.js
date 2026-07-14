/* ===========================================================
   author.js — منطق صفحه‌ی اختصاصی نویسنده
   -----------------------------------------------------------
   GET api/author_single.php?id=N
       -> { ok:true, data:{ author:{ id, display_name, avatar,
            bio_short, bio_full, social_*, article_count, total_views } } }

   GET api/articles_list.php?author=N&sort=&page=
       -> { ok:true, data:{ articles:[...], page, total_pages } }
       sort: newest | views | reading_time
   =========================================================== */
(function () {
  "use strict";

  let state = { id: 0, page: 1, sort: "newest" };

  document.addEventListener("DOMContentLoaded", () => {
    const params = new URLSearchParams(window.location.search);
    state.id = parseInt(params.get("id"), 10) || 0;

    wireSearch();

    if (!state.id) {
      showNotFound();
      return;
    }

    loadAuthor();
    document.getElementById("authorSortSelect")?.addEventListener("change", (e) => {
      state.sort = e.target.value;
      state.page = 1;
      loadArticles();
    });
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
      console.error("[author.js] خطا در دریافت اطلاعات از سرور:", url, e);
      return null;
    }
  }

  function initialsOf(name) {
    const parts = (name || "").trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "ر";
    return parts[0][0];
  }

  function showNotFound() {
    document.getElementById("authorLoading").style.display = "none";
    document.getElementById("authorNotFound").style.display = "flex";
  }

  /* -------------------- جستجو (هدر ثابت) -------------------- */
  function goToSearch() {
    const input = document.getElementById("searchInput");
    const q = (input?.value || "").trim();
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    window.location.href = "search.html" + (params.toString() ? "?" + params.toString() : "");
  }

  function wireSearch() {
    const input = document.getElementById("searchInput");
    const header = document.getElementById("searchHeader");
    const icon = header?.querySelector("svg");

    input?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        goToSearch();
      }
    });
    icon?.addEventListener("click", goToSearch);
    if (icon) icon.style.cursor = "pointer";

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

  /* -------------------- هیرو نویسنده -------------------- */
  const SOCIAL_ICONS = {
    social_telegram: {
      label: "تلگرام",
      urlPrefix: (v) => (v.startsWith("http") ? v : `https://t.me/${v.replace(/^@/, "")}`),
      svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="m21 4-9 16-3-7-7-3Z"/><path d="M21 4 8.5 13.2"/></svg>',
    },
    social_instagram: {
      label: "اینستاگرام",
      urlPrefix: (v) => (v.startsWith("http") ? v : `https://instagram.com/${v.replace(/^@/, "")}`),
      svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="3.6"/><circle cx="17" cy="7" r="1"/></svg>',
    },
    social_linkedin: {
      label: "لینکدین",
      urlPrefix: (v) => (v.startsWith("http") ? v : `https://linkedin.com/in/${v}`),
      svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3.5" y="3.5" width="17" height="17" rx="3"/><circle cx="8" cy="9" r="1"/><path d="M8 11.5v5.5M12 17v-3.5c0-1.2 1-2 2-2s2 .8 2 2V17"/></svg>',
    },
    social_x: {
      label: "ایکس",
      urlPrefix: (v) => (v.startsWith("http") ? v : `https://x.com/${v.replace(/^@/, "")}`),
      svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="m4 4 16 16M20 4 4 20"/></svg>',
    },
    social_email: {
      label: "ایمیل",
      urlPrefix: (v) => `mailto:${v}`,
      svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3.5" y="5.5" width="17" height="13" rx="2"/><path d="M4.5 7 12 13l7.5-6"/></svg>',
    },
    social_phone: {
      label: "تماس",
      urlPrefix: (v) => `tel:${v}`,
      svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3.5h3l1.5 4-2 2a11 11 0 0 0 5.5 5.5l2-2 4 1.5v3a2 2 0 0 1-2.2 2A17 17 0 0 1 4 6.2 2 2 0 0 1 6 3.5Z"/></svg>',
    },
  };

  async function loadAuthor() {
    const data = await fetchJSON(`api/author_single.php?id=${state.id}`);
    if (!data || !data.author) {
      showNotFound();
      return;
    }
    renderHero(data.author);

    document.getElementById("authorLoading").style.display = "none";
    document.getElementById("authorContent").style.display = "block";

    loadArticles();
  }

  function renderHero(author) {
    document.getElementById("pageTitle").textContent = `${author.display_name} | رویایی رسا`;
    document.getElementById("pageDescription")?.setAttribute("content", author.bio_short || author.bio_full || `مقالات ${author.display_name} در رویایی رسا`);

    document.getElementById("authorHeroName").textContent = author.display_name;

    const avatarImg = document.getElementById("authorHeroAvatarImg");
    const initialEl = document.getElementById("authorHeroInitial");
    if (author.avatar) {
      avatarImg.src = author.avatar;
      avatarImg.style.display = "block";
      initialEl.style.display = "none";
    } else {
      initialEl.textContent = initialsOf(author.display_name);
      initialEl.style.display = "flex";
      avatarImg.style.display = "none";
    }

    const bioEl = document.getElementById("authorHeroBio");
    bioEl.textContent = author.bio_full || author.bio_short || "";
    bioEl.style.display = (author.bio_full || author.bio_short) ? "block" : "none";

    document.getElementById("authorHeroArticleCount").innerHTML =
      `<strong>${(author.article_count || 0).toLocaleString("fa-IR")}</strong> مقاله`;
    document.getElementById("authorHeroViews").innerHTML =
      `<strong>${(author.total_views || 0).toLocaleString("fa-IR")}</strong> بازدید`;

    const socialsEl = document.getElementById("authorHeroSocials");
    const links = Object.keys(SOCIAL_ICONS)
      .filter((key) => author[key])
      .map((key) => {
        const conf = SOCIAL_ICONS[key];
        return `<a href="${conf.urlPrefix(author[key])}" target="_blank" rel="noopener" title="${conf.label}" class="author-hero-social-btn">${conf.svg}</a>`;
      });
    socialsEl.innerHTML = links.join("");
  }

  /* -------------------- کارت مقاله -------------------- */
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

  /* -------------------- لیست مقالات نویسنده -------------------- */
  async function loadArticles() {
    const listEl = document.getElementById("authorArticlesList");
    const emptyEl = document.getElementById("authorArticlesEmpty");
    const paginationEl = document.getElementById("authorPagination");

    listEl.innerHTML = '<div class="list-skel"></div><div class="list-skel"></div><div class="list-skel"></div>';
    emptyEl.style.display = "none";
    paginationEl.style.display = "none";

    const params = new URLSearchParams();
    params.set("author", state.id);
    params.set("page", state.page);
    params.set("sort", state.sort);

    const data = await fetchJSON("api/articles_list.php?" + params.toString());

    if (!data || !(data.articles || []).length) {
      listEl.innerHTML = "";
      emptyEl.style.display = "block";
      return;
    }

    listEl.innerHTML = data.articles.map(articleCardHtml).join("");
    renderPagination(data.page || state.page, data.total_pages || 1);
  }

  function renderPagination(page, totalPages) {
    const el = document.getElementById("authorPagination");
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
        loadArticles();
        document.getElementById("authorArticlesList").scrollIntoView({ behavior: "smooth", block: "start" });
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
})();
