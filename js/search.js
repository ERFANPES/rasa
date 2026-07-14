/* ===========================================================
   search.js — صفحه‌ی جستجوی پیشرفته مقالات
   -----------------------------------------------------------
   قرارداد API (هماهنگ با articles.js و بک‌اند PHP):
     GET api/taxonomy_list.php
         -> { ok:true, data:{ categories:[...], tags:[...], authors:[...] } }
         category: { id, slug, name, parent_id, icon, description }
         author:   { id, name, avatar, article_count }
         tag:      { id, slug, name, article_count }

     GET api/articles_list.php?page=&q=&category=&author=&tag=
         -> { ok:true, data:{ articles:[...], page, total_pages } }

   منطق دسته‌بندی اصلی/فرعی:
     دسته‌بندی‌هایی که parent_id ندارند «اصلی» هستند.
     زیرمجموعه‌های هر دسته (parent_id برابر شناسه‌ی آن) به‌عنوان
     «دسته‌بندی فرعی» نمایش داده می‌شوند. چون بک‌اند فیلتر category
     را هم روی دسته‌ی اصلیِ مقاله و هم زیردسته‌های آن اعمال می‌کند،
     انتخاب دسته‌بندی فرعی (در صورت وجود) جایگزین دسته‌بندی اصلی
     در پارامتر category می‌شود.
   =========================================================== */
(function () {
  "use strict";

  const PAGE_SIZE = 9;

  let state = { page: 1, q: "", category: "", subcategory: "", author: "", tag: "" };
  let allCategories = [];
  let mainCategories = [];
  let authors = [];
  let tags = [];

  document.addEventListener("DOMContentLoaded", () => {
    if (!document.getElementById("blogList")) return;

    readStateFromURL();
    wireSearchHeader();
    wireFiltersPanel();
    loadTaxonomy().then(() => {
      syncFieldsFromState();
      fetchResults();
    });

    document.getElementById("clearFiltersBtn")?.addEventListener("click", clearFilters);
    document.getElementById("emptyClearFiltersBtn")?.addEventListener("click", clearFilters);
    document.getElementById("applyFiltersBtn")?.addEventListener("click", () => {
      readFieldsIntoState();
      state.page = 1;
      updateURL();
      fetchResults();
    });

    window.addEventListener("popstate", () => {
      readStateFromURL();
      syncFieldsFromState();
      fetchResults();
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
      if (!res.ok) throw new Error("bad status");
      const data = await res.json();
      if (!data.ok) throw new Error(data.message || "bad response");
      return data.data;
    } catch (e) {
      console.error("[search.js] خطا در دریافت:", url, e);
      return null;
    }
  }

  /* -------------------- خواندن/نوشتن state <-> URL -------------------- */
  function readStateFromURL() {
    const params = new URLSearchParams(window.location.search);
    state.q = params.get("q") || "";
    state.category = params.get("category") || "";
    state.subcategory = params.get("subcategory") || "";
    state.author = params.get("author") || "";
    state.tag = params.get("tag") || "";
    state.page = Math.max(1, parseInt(params.get("page"), 10) || 1);
  }

  function updateURL(push) {
    const params = new URLSearchParams();
    if (state.q) params.set("q", state.q);
    if (state.category) params.set("category", state.category);
    if (state.subcategory) params.set("subcategory", state.subcategory);
    if (state.author) params.set("author", state.author);
    if (state.tag) params.set("tag", state.tag);
    if (state.page > 1) params.set("page", state.page);
    const url = "search.html" + (params.toString() ? "?" + params.toString() : "");
    if (push === false) {
      history.replaceState(null, "", url);
    } else {
      history.pushState(null, "", url);
    }
  }

  function syncFieldsFromState() {
    const input = document.getElementById("searchInput");
    if (input) input.value = state.q;

    const catSel = document.getElementById("filterCategory");
    if (catSel) catSel.value = state.category && !state.subcategory ? state.category : (mainCategoryForSlug(state.category || state.subcategory) || "");

    populateSubcategoryOptions(catSel ? catSel.value : "");
    const subSel = document.getElementById("filterSubcategory");
    if (subSel) subSel.value = state.subcategory || "";

    const authorSel = document.getElementById("filterAuthor");
    if (authorSel) authorSel.value = state.author || "";

    const tagSel = document.getElementById("filterTag");
    if (tagSel) tagSel.value = state.tag || "";

    if (state.category || state.subcategory || state.author || state.tag) {
      document.getElementById("filtersPanel")?.classList.add("is-open");
      document.getElementById("filtersToggle")?.setAttribute("aria-expanded", "true");
    }
    renderChips();
  }

  function readFieldsIntoState() {
    state.q = document.getElementById("searchInput")?.value.trim() || "";
    state.category = document.getElementById("filterCategory")?.value || "";
    state.subcategory = document.getElementById("filterSubcategory")?.value || "";
    state.author = document.getElementById("filterAuthor")?.value || "";
    state.tag = document.getElementById("filterTag")?.value || "";
  }

  function mainCategoryForSlug(slug) {
    if (!slug) return "";
    const cat = allCategories.find((c) => c.slug === slug);
    if (!cat) return "";
    if (!cat.parent_id) return cat.slug;
    const parent = allCategories.find((c) => c.id === cat.parent_id);
    return parent ? parent.slug : "";
  }

  /* -------------------- هدر جستجو (ثابت، مخفی‌شونده هنگام اسکرول) -------------------- */
  function wireSearchHeader() {
    const input = document.getElementById("searchInput");
    const header = document.getElementById("searchHeader");

    input?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        state.q = input.value.trim();
        state.page = 1;
        updateURL();
        fetchResults();
      }
    });

    let debounce;
    input?.addEventListener("input", () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        state.q = input.value.trim();
        state.page = 1;
        updateURL();
        fetchResults();
      }, 450);
    });

    let lastY = window.scrollY;
    let ticking = false;
    window.addEventListener("scroll", () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        const goingDown = y > lastY;
        if (goingDown && y > 120) header.classList.add("is-hidden");
        else header.classList.remove("is-hidden");
        if (document.activeElement === input) header.classList.remove("is-hidden");
        lastY = y;
        ticking = false;
      });
    }, { passive: true });
  }

  /* -------------------- پنل فیلترهای پیشرفته -------------------- */
  function wireFiltersPanel() {
    const toggle = document.getElementById("filtersToggle");
    const panel = document.getElementById("filtersPanel");
    toggle?.addEventListener("click", () => {
      const isOpen = panel.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(isOpen));
    });

    document.getElementById("filterCategory")?.addEventListener("change", (e) => {
      populateSubcategoryOptions(e.target.value);
      document.getElementById("filterSubcategory").value = "";
    });
  }

  function populateSubcategoryOptions(mainSlug) {
    const subSel = document.getElementById("filterSubcategory");
    if (!subSel) return;
    if (!mainSlug) {
      subSel.innerHTML = '<option value="">ابتدا دسته‌بندی اصلی را انتخاب کنید</option>';
      subSel.disabled = true;
      return;
    }
    const mainCat = allCategories.find((c) => c.slug === mainSlug);
    const children = mainCat ? allCategories.filter((c) => c.parent_id === mainCat.id) : [];
    if (!children.length) {
      subSel.innerHTML = '<option value="">این دسته زیرمجموعه‌ای ندارد</option>';
      subSel.disabled = true;
      return;
    }
    subSel.disabled = false;
    subSel.innerHTML =
      '<option value="">همه زیردسته‌ها</option>' +
      children.map((c) => `<option value="${escapeHtml(c.slug)}">${escapeHtml(c.name)}</option>`).join("");
  }

  function clearFilters() {
    state = { page: 1, q: "", category: "", subcategory: "", author: "", tag: "" };
    document.getElementById("searchInput").value = "";
    document.getElementById("filterCategory").value = "";
    populateSubcategoryOptions("");
    document.getElementById("filterAuthor").value = "";
    document.getElementById("filterTag").value = "";
    updateURL();
    renderChips();
    fetchResults();
  }

  function renderChips() {
    const wrap = document.getElementById("activeChips");
    if (!wrap) return;
    const chips = [];
    if (state.q) chips.push({ key: "q", label: `کلیدواژه: «${state.q}»` });
    if (state.subcategory) {
      const c = allCategories.find((c) => c.slug === state.subcategory);
      chips.push({ key: "subcategory", label: `زیردسته: ${c ? c.name : state.subcategory}` });
    } else if (state.category) {
      const c = allCategories.find((c) => c.slug === state.category);
      chips.push({ key: "category", label: `دسته‌بندی: ${c ? c.name : state.category}` });
    }
    if (state.author) {
      const a = authors.find((a) => String(a.id) === String(state.author));
      chips.push({ key: "author", label: `نویسنده: ${a ? a.name : state.author}` });
    }
    if (state.tag) {
      const t = tags.find((t) => t.slug === state.tag);
      chips.push({ key: "tag", label: `برچسب: ${t ? t.name : state.tag}` });
    }

    wrap.innerHTML = chips
      .map(
        (c) =>
          `<span class="chip" data-key="${c.key}">${escapeHtml(c.label)}<button type="button" aria-label="حذف فیلتر">×</button></span>`
      )
      .join("");

    wrap.querySelectorAll(".chip button").forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.parentElement.dataset.key;
        if (key === "q") { state.q = ""; document.getElementById("searchInput").value = ""; }
        if (key === "category") { state.category = ""; document.getElementById("filterCategory").value = ""; populateSubcategoryOptions(""); }
        if (key === "subcategory") { state.subcategory = ""; document.getElementById("filterSubcategory").value = ""; }
        if (key === "author") { state.author = ""; document.getElementById("filterAuthor").value = ""; }
        if (key === "tag") { state.tag = ""; document.getElementById("filterTag").value = ""; }
        state.page = 1;
        updateURL();
        renderChips();
        fetchResults();
      });
    });
  }

  /* -------------------- تاکسونومی (دسته‌بندی/نویسنده/برچسب) -------------------- */
  async function loadTaxonomy() {
    const data = await fetchJSON("api/taxonomy_list.php");
    if (!data) return;

    allCategories = data.categories || [];
    mainCategories = allCategories.filter((c) => !c.parent_id);
    authors = data.authors || [];
    tags = data.tags || [];

    const catSel = document.getElementById("filterCategory");
    if (catSel) {
      catSel.innerHTML =
        '<option value="">همه دسته‌بندی‌ها</option>' +
        mainCategories.map((c) => `<option value="${escapeHtml(c.slug)}">${escapeHtml(c.name)}</option>`).join("");
    }

    const authorSel = document.getElementById("filterAuthor");
    if (authorSel) {
      authorSel.innerHTML =
        '<option value="">همه نویسنده‌ها</option>' +
        authors.map((a) => `<option value="${a.id}">${escapeHtml(a.name)}</option>`).join("");
    }

    const tagSel = document.getElementById("filterTag");
    if (tagSel) {
      tagSel.innerHTML =
        '<option value="">همه برچسب‌ها</option>' +
        tags.map((t) => `<option value="${escapeHtml(t.slug)}">${escapeHtml(t.name)}</option>`).join("");
    }
  }

  /* -------------------- کارت مقاله (مشابه articles.js) -------------------- */
  const ICONS = {
    rasa: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8c3-3 9-3 12 0M4 12.5c4.4-4 11.6-4 16 0M8 17c2-1.6 6-1.6 8 0"/><circle cx="12" cy="20" r="1.1" fill="currentColor" stroke="none"/></svg>`,
    rasabaz: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="8" width="19" height="10" rx="5"/><path d="M7.5 11v4M5.5 13h4"/><circle cx="16" cy="11.6" r="1" fill="currentColor" stroke="none"/><circle cx="18.2" cy="14" r="1" fill="currentColor" stroke="none"/></svg>`,
    raysanes: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 2.5h6M10 2.5v5.6L5.5 16a2.4 2.4 0 0 0 2.1 3.5h8.8a2.4 2.4 0 0 0 2.1-3.5L14 8.1V2.5"/><path d="M7.5 14.5h9"/></svg>`,
    default: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3.5h9L19 8v12.5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z"/><path d="M9 12h6M9 16h6"/></svg>`,
  };
  const COLORS = { rasa: "var(--cat-a)", rasabaz: "var(--cat-b)", raysanes: "var(--cat-c)" };

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

  /* -------------------- دریافت و نمایش نتایج -------------------- */
  async function fetchResults() {
    const listEl = document.getElementById("blogList");
    const emptyEl = document.getElementById("articlesEmpty");
    const paginationEl = document.getElementById("pagination");
    const summaryEl = document.getElementById("searchSummary");

    listEl.innerHTML = '<div class="list-skel"></div><div class="list-skel"></div><div class="list-skel"></div>';
    emptyEl.style.display = "none";
    paginationEl.style.display = "none";
    if (summaryEl) summaryEl.textContent = "در حال بارگذاری نتایج...";

    const params = new URLSearchParams();
    params.set("page", state.page);
    if (state.q) params.set("q", state.q);
    const categoryParam = state.subcategory || state.category;
    if (categoryParam) params.set("category", categoryParam);
    if (state.author) params.set("author", state.author);
    if (state.tag) params.set("tag", state.tag);

    const data = await fetchJSON("api/articles_list.php?" + params.toString());
    const list = (data && data.articles) || [];

    if (!list.length) {
      listEl.innerHTML = "";
      emptyEl.style.display = "block";
      if (summaryEl) {
        summaryEl.textContent = data
          ? "نتیجه‌ای برای این جستجو پیدا نشد."
          : "خطا در دریافت اطلاعات. لطفاً دوباره تلاش کنید.";
      }
      return;
    }

    listEl.innerHTML = list.map(articleCardHtml).join("");
    const total = data.total ?? list.length;
    if (summaryEl) {
      summaryEl.textContent = state.q
        ? `${total.toLocaleString("fa-IR")} نتیجه برای «${state.q}»`
        : `${total.toLocaleString("fa-IR")} مقاله پیدا شد`;
    }
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
        updateURL();
        fetchResults();
        document.getElementById("blogList").scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  }
})();
