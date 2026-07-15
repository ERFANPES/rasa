/* =========================================================
   admin-static.js — منطق پنل مدیریت دمو (بدون بک‌اند واقعی)
   داده‌ها از ../data/db.json خوانده می‌شوند و همه‌ی تغییرات
   (ایجاد/ویرایش/حذف مقاله و پروژه، دسته‌بندی، تگ، عضو تیم،
   تایید/رد نظر، خواندن پیام، تنظیمات و ...) در localStorage
   همین مرورگر ذخیره می‌شوند. برای ریست کامل دمو، دکمه‌ی
   «بازنشانی داده‌های دمو» در تب تنظیمات استفاده شود.
   ========================================================= */
(function () {
  "use strict";

  const LS_AUTH = "resa_admin_auth_v1";
  const LS_OVERLAY = "resa_admin_overlay_v1";
  const DEMO_USER = "admin";
  const DEMO_PASS = "demo1234";

  let DB = null;
  let currentView = "dashboard";
  let nextId = Date.now();
  function newId() { return nextId++; }

  /* ---------------- overlay (تغییرات محلی روی داده دمو) ---------------- */
  function readOverlay() {
    try { return JSON.parse(localStorage.getItem(LS_OVERLAY) || "{}"); }
    catch (e) { return {}; }
  }
  function writeOverlay(ov) {
    localStorage.setItem(LS_OVERLAY, JSON.stringify(ov));
  }
  function patchOverlay(mutator) {
    const ov = readOverlay();
    mutator(ov);
    writeOverlay(ov);
  }

  function applyOverlay(db) {
    const ov = readOverlay();

    /* ---- دسته‌بندی‌ها ---- */
    (ov.newCategories || []).forEach((c) => db.categories.push(c));
    Object.entries(ov.categoryPatches || {}).forEach(([id, patch]) => {
      const c = db.categories.find((x) => x.id == id);
      if (c) Object.assign(c, patch);
    });
    (ov.deletedCategories || []).forEach((id) => { db.categories = db.categories.filter((c) => c.id != id); });

    /* ---- تگ‌ها ---- */
    (ov.newTags || []).forEach((t) => db.tags.push(t));
    Object.entries(ov.tagPatches || {}).forEach(([id, patch]) => {
      const t = db.tags.find((x) => x.id == id);
      if (t) Object.assign(t, patch);
    });
    (ov.deletedTags || []).forEach((id) => { db.tags = db.tags.filter((t) => t.id != id); });

    /* ---- مدیران / تیم ---- */
    (ov.newAdmins || []).forEach((a) => db.admins.push(a));
    Object.entries(ov.adminPatches || {}).forEach(([id, patch]) => {
      const a = db.admins.find((x) => x.id == id);
      if (a) Object.assign(a, patch);
    });
    (ov.deletedAdmins || []).forEach((id) => { db.admins = db.admins.filter((a) => a.id != id); });

    /* ---- مقالات ---- */
    (ov.newArticles || []).forEach((a) => db.articles.push(a));
    (ov.deletedArticles || []).forEach((id) => { db.articles = db.articles.filter((a) => a.id !== id); });
    Object.entries(ov.articlePatches || {}).forEach(([id, patch]) => {
      const a = db.articles.find((x) => x.id == id);
      if (a) Object.assign(a, patch);
    });

    /* ---- پروژه‌ها ---- */
    (ov.newProjects || []).forEach((p) => db.projects.push(p));
    (ov.deletedProjects || []).forEach((id) => { db.projects = db.projects.filter((p) => p.id !== id); });
    Object.entries(ov.projectPatches || {}).forEach(([id, patch]) => {
      const p = db.projects.find((x) => x.id == id);
      if (p) Object.assign(p, patch);
    });

    /* ---- همگام‌سازی نام/اسلاگ دسته روی مقالات و پروژه‌ها ---- */
    db.articles.forEach((a) => {
      const cat = db.categories.find((c) => c.id === a.category_id);
      if (cat) { a.category_name = cat.name; a.category_slug = cat.slug; }
      const admin = db.admins.find((x) => x.id === a.author_admin_id);
      if (admin) a.author = admin.display_name;
    });
    db.projects.forEach((p) => {
      const cat = db.categories.find((c) => c.id === p.category_id);
      if (cat) { p.category_name = cat.name; p.category_slug = cat.slug; }
    });

    /* ---- نظرات، پیام‌ها، تنظیمات ---- */
    Object.entries(ov.commentStatus || {}).forEach(([id, status]) => {
      const c = findPendingComment(db, id);
      if (c) c.status = status;
    });
    (ov.deletedPending || []).forEach((id) => { db.pending_comments = (db.pending_comments || []).filter((c) => c.id != id); });
    Object.entries(ov.messageRead || {}).forEach(([id, val]) => {
      const m = db.messages.find((x) => x.id == id);
      if (m) m.is_read = val;
    });
    (ov.deletedMessages || []).forEach((id) => { db.messages = db.messages.filter((m) => m.id != id); });
    if (ov.settings) Object.assign(db.settings, ov.settings);
    if (ov.site) Object.assign(db.site, ov.site);

    db.pending_comments = db.pending_comments || [];
    db.extraActivity = ov.activity || [];
  }
  function findPendingComment(db, id) {
    return (db.pending_comments || []).find((c) => c.id == id);
  }
  function logActivity(description) {
    patchOverlay((ov) => {
      ov.activity = ov.activity || [];
      ov.activity.unshift({ id: Date.now(), admin_username: DEMO_USER, description, hours_ago: 0, justNow: true });
      ov.activity = ov.activity.slice(0, 30);
    });
  }

  /* ---------------- بارگذاری داده ---------------- */
  function loadDb() {
    return fetch("../data/db.json", { cache: "no-store" })
      .then((r) => r.json())
      .then((db) => { applyOverlay(db); DB = db; return db; });
  }

  /* ---------------- احراز هویت ---------------- */
  function isLoggedIn() { return sessionStorage.getItem(LS_AUTH) === "1"; }
  function setLoggedIn() { sessionStorage.setItem(LS_AUTH, "1"); }
  function clearLoggedIn() { sessionStorage.removeItem(LS_AUTH); }

  const loginScreen = document.getElementById("loginScreen");
  const app = document.getElementById("app");

  document.getElementById("loginForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const u = document.getElementById("loginUser").value.trim();
    const p = document.getElementById("loginPass").value;
    const err = document.getElementById("loginError");
    if (u === DEMO_USER && p === DEMO_PASS) {
      setLoggedIn();
      boot();
    } else {
      err.textContent = "نام کاربری یا رمز عبور اشتباه است. (دمو: admin / demo1234)";
    }
  });

  document.getElementById("logoutBtn").addEventListener("click", () => {
    clearLoggedIn();
    app.classList.add("hidden");
    loginScreen.classList.remove("hidden");
  });

  /* ---------------- ناوبری ---------------- */
  const sidebarEl = document.getElementById("sidebar");
  const sidebarBackdrop = document.getElementById("sidebarBackdrop");

  function openSidebar() {
    sidebarEl.classList.add("is-open");
    sidebarBackdrop.classList.add("is-visible");
    document.body.classList.add("sidebar-open");
  }
  function closeSidebar() {
    sidebarEl.classList.remove("is-open");
    sidebarBackdrop.classList.remove("is-visible");
    document.body.classList.remove("sidebar-open");
  }

  document.querySelectorAll(".side-link[data-view]").forEach((btn) => {
    btn.addEventListener("click", () => {
      currentView = btn.dataset.view;
      document.querySelectorAll(".side-link[data-view]").forEach((b) => b.classList.toggle("is-active", b === btn));
      closeSidebar();
      render();
    });
  });
  document.getElementById("mobileMenuBtn").addEventListener("click", () => {
    if (sidebarEl.classList.contains("is-open")) closeSidebar();
    else openSidebar();
  });
  sidebarBackdrop.addEventListener("click", closeSidebar);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeSidebar();
  });

  /* ---------------- کمک‌کننده‌های نمایش ---------------- */
  function fmtHoursAgo(h) {
    if (h < 1) return "لحظاتی پیش";
    if (h < 24) return `${Math.round(h)} ساعت پیش`;
    return `${Math.round(h / 24)} روز پیش`;
  }
  function toast(msg) {
    const t = document.getElementById("toast");
    t.textContent = msg;
    t.classList.remove("hidden");
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => t.classList.add("hidden"), 2600);
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function slugify(str) {
    return String(str || "")
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^\w\u0600-\u06FF-]/g, "")
      .toLowerCase()
      .slice(0, 80) || "item-" + Date.now();
  }

  /* ---------------- بج‌های سایدبار ---------------- */
  function updateBadges() {
    document.getElementById("badgeArticles").textContent = DB.articles.filter((a) => a.status === "draft").length || "";
    document.getElementById("badgeProjects").textContent = DB.projects.filter((p) => p.status === "draft").length || "";
    document.getElementById("badgeComments").textContent = (DB.pending_comments || []).filter((c) => c.status === "pending").length || "";
    document.getElementById("badgeMessages").textContent = DB.messages.filter((m) => !m.is_read).length || "";
  }

  /* ---------------- رندر هر تب ---------------- */
  const viewArea = document.getElementById("viewArea");
  const viewTitles = {
    dashboard: "داشبورد", articles: "مقالات", projects: "پروژه‌ها",
    comments: "نظرات", messages: "پیام‌ها", categories: "دسته‌بندی‌ها",
    tags: "تگ‌ها", team: "تیم و مدیران", settings: "تنظیمات",
  };

  function render() {
    document.getElementById("viewTitle").textContent = viewTitles[currentView];
    updateBadges();
    const map = {
      dashboard: renderDashboard, articles: renderArticles, projects: renderProjects,
      comments: renderComments, messages: renderMessages, categories: renderCategories,
      tags: renderTags, team: renderTeam, settings: renderSettings,
    };
    (map[currentView] || renderDashboard)();
  }

  /* ================= داشبورد ================= */
  function renderDashboard() {
    const publishedArticles = DB.articles.filter((a) => a.status === "published").length;
    const draftArticles = DB.articles.filter((a) => a.status === "draft").length;
    const publishedProjects = DB.projects.filter((p) => p.status === "published").length;
    const pendingComments = (DB.pending_comments || []).filter((c) => c.status === "pending").length;
    const unreadMsgs = DB.messages.filter((m) => !m.is_read).length;
    const totalViews = DB.articles.reduce((s, a) => s + a.views, 0) + DB.projects.reduce((s, p) => s + p.views, 0);
    const activity = (DB.extraActivity || []).concat(DB.activity_log || []).slice(0, 6);

    viewArea.innerHTML = `
      <div class="stat-grid">
        <div class="stat-card"><div class="stat-num">${publishedArticles}</div><div class="stat-label">مقاله منتشرشده${draftArticles ? ` (+${draftArticles} پیش‌نویس)` : ""}</div></div>
        <div class="stat-card"><div class="stat-num">${publishedProjects}</div><div class="stat-label">پروژه منتشرشده</div></div>
        <div class="stat-card"><div class="stat-num">${DB.categories.length}</div><div class="stat-label">دسته‌بندی</div></div>
        <div class="stat-card"><div class="stat-num">${DB.tags.length}</div><div class="stat-label">تگ</div></div>
        <div class="stat-card"><div class="stat-num">${pendingComments}</div><div class="stat-label">نظر در انتظار تایید</div></div>
        <div class="stat-card"><div class="stat-num">${unreadMsgs}</div><div class="stat-label">پیام خوانده‌نشده</div></div>
        <div class="stat-card"><div class="stat-num">${totalViews.toLocaleString("fa-IR")}</div><div class="stat-label">مجموع بازدید محتوا</div></div>
        <div class="stat-card"><div class="stat-num">${DB.visit_stats.today}</div><div class="stat-label">بازدید امروز سایت</div></div>
      </div>

      <div class="two-col">
        <div class="panel">
          <h3>فعالیت‌های اخیر</h3>
          ${activity.map((a) => `
            <div class="panel-row">
              <span>${esc(a.description)}</span>
              <span style="color:var(--text-faint); white-space:nowrap;">${a.justNow ? "لحظاتی پیش" : fmtHoursAgo(a.hours_ago)}</span>
            </div>`).join("") || `<div class="empty-state">فعالیتی ثبت نشده</div>`}
        </div>
        <div class="panel">
          <h3>بازدید ۷ روز اخیر</h3>
          <div class="mini-bars">
            ${DB.visit_stats.last_7_days.map((d) => {
              const max = Math.max(...DB.visit_stats.last_7_days.map((x) => x.count));
              const h = Math.max(6, Math.round((d.count / max) * 70));
              return `<div class="bar" style="height:${h}px" title="${d.count} بازدید"><span>${d.offset_days === 0 ? "امروز" : d.offset_days + "ر پیش"}</span></div>`;
            }).join("")}
          </div>
        </div>
      </div>
    `;
  }

  /* ================= مقالات ================= */
  function renderArticles() {
    viewArea.innerHTML = `
      <div class="panel">
        <div class="table-toolbar">
          <input type="search" id="articleSearch" placeholder="جست‌وجو در عنوان مقالات...">
          <button class="btn btn-primary btn-sm" id="newArticleBtn">+ مقاله جدید</button>
        </div>
        <div style="overflow-x:auto;">
        <table>
          <thead><tr><th>عنوان</th><th>دسته</th><th>نویسنده</th><th>وضعیت</th><th>بازدید</th><th></th></tr></thead>
          <tbody id="articlesTbody"></tbody>
        </table>
        </div>
      </div>
    `;
    const tbody = document.getElementById("articlesTbody");
    function draw(filter) {
      const list = DB.articles
        .filter((a) => !filter || a.title.includes(filter))
        .slice()
        .sort((a, b) => a.days_ago - b.days_ago);
      tbody.innerHTML = list.map((a) => `
        <tr>
          <td class="cell-title">${esc(a.title)}<span class="sub">/${esc(a.slug)}</span></td>
          <td>${esc(a.category_name || "—")}</td>
          <td>${esc(a.author)}</td>
          <td><span class="badge badge-${a.status}">${a.status === "published" ? "منتشرشده" : "پیش‌نویس"}</span></td>
          <td>${a.views.toLocaleString("fa-IR")}</td>
          <td>
            <div class="row-actions">
              <button class="btn btn-ghost btn-sm" data-act="edit-article" data-id="${a.id}">ویرایش</button>
              <button class="btn btn-danger btn-sm" data-act="delete-article" data-id="${a.id}">حذف</button>
            </div>
          </td>
        </tr>
      `).join("") || `<tr><td colspan="6"><div class="empty-state">مقاله‌ای یافت نشد.</div></td></tr>`;
    }
    draw("");
    document.getElementById("articleSearch").addEventListener("input", (e) => draw(e.target.value.trim()));
    document.getElementById("newArticleBtn").addEventListener("click", () => openArticleModal(null));

    tbody.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-act]");
      if (!btn) return;
      const id = parseInt(btn.dataset.id, 10);
      if (btn.dataset.act === "edit-article") openArticleModal(id);
      if (btn.dataset.act === "delete-article") {
        if (!confirm("این مقاله حذف شود؟ (فقط در همین مرورگر)")) return;
        patchOverlay((ov) => { ov.deletedArticles = (ov.deletedArticles || []).concat([id]); });
        logActivity(`مقاله «${DB.articles.find((a) => a.id === id)?.title || ""}» حذف شد.`);
        toast("مقاله حذف شد.");
        loadDb().then(render);
      }
    });
  }

  function tagCheckboxList(selectedSlugs) {
    return `<div class="checkbox-list">${DB.tags.map((t) => `
      <label><input type="checkbox" value="${t.slug}" data-tagname="${esc(t.name)}" ${selectedSlugs.includes(t.slug) ? "checked" : ""}> ${esc(t.name)}</label>
    `).join("") || `<span style="color:var(--text-faint); font-size:.8rem;">تگی ثبت نشده — ابتدا از تب «تگ‌ها» اضافه کنید.</span>`}</div>`;
  }

  function openArticleModal(id) {
    const isNew = id === null;
    const a = isNew ? {
      title: "", slug: "", excerpt: "", content: "", category_id: (DB.categories.find((c) => c.type === "blog") || {}).id,
      author_admin_id: DB.admins[0] ? DB.admins[0].id : null, reading_time: 5, status: "draft",
      cover_image: "https://picsum.photos/seed/resa-article-" + Date.now() + "/1200/750", tags: [],
    } : DB.articles.find((x) => x.id === id);
    if (!a) return;
    const blogCats = DB.categories.filter((c) => c.type === "blog");
    const selectedSlugs = (a.tags || []).map((t) => t.slug);

    openModal(`
      <h3>${isNew ? "مقاله جدید" : "ویرایش مقاله"}</h3>
      <div class="field"><label>عنوان</label><input id="edTitle" value="${esc(a.title)}"></div>
      <div class="field"><label>نامک (slug)</label><input id="edSlug" value="${esc(a.slug)}" placeholder="در صورت خالی بودن، خودکار از روی عنوان ساخته می‌شود"></div>
      <div class="field"><label>خلاصه</label><textarea id="edExcerpt" style="min-height:70px;">${esc(a.excerpt)}</textarea></div>
      <div class="field"><label>متن کامل مقاله</label><textarea id="edContent" style="min-height:160px;">${esc(a.content)}</textarea></div>
      <div class="field-row">
        <div class="field"><label>دسته‌بندی</label>
          <select id="edCategory">${blogCats.map((c) => `<option value="${c.id}" ${c.id === a.category_id ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select>
        </div>
        <div class="field"><label>نویسنده</label>
          <select id="edAuthor">${DB.admins.map((ad) => `<option value="${ad.id}" ${ad.id === a.author_admin_id ? "selected" : ""}>${esc(ad.display_name)}</option>`).join("")}</select>
        </div>
      </div>
      <div class="field-row">
        <div class="field"><label>زمان مطالعه (دقیقه)</label><input id="edReadingTime" type="number" min="1" max="60" value="${a.reading_time || 5}"></div>
        <div class="field"><label>وضعیت</label>
          <select id="edStatus">
            <option value="published" ${a.status === "published" ? "selected" : ""}>منتشرشده</option>
            <option value="draft" ${a.status === "draft" ? "selected" : ""}>پیش‌نویس</option>
          </select>
        </div>
      </div>
      <div class="field"><label>آدرس تصویر کاور</label><input id="edCover" value="${esc(a.cover_image || "")}"></div>
      <div class="field"><label>تگ‌ها</label>${tagCheckboxList(selectedSlugs)}</div>
      <div class="modal-actions">
        <button class="btn btn-primary" id="edSave">${isNew ? "ایجاد مقاله" : "ذخیره تغییرات"}</button>
        <button class="btn btn-ghost" id="edCancel">انصراف</button>
      </div>
    `, "modal-wide");

    document.getElementById("edCancel").addEventListener("click", closeModal);
    document.getElementById("edSave").addEventListener("click", () => {
      const title = document.getElementById("edTitle").value.trim();
      if (!title) { toast("عنوان الزامی است."); return; }
      const catId = parseInt(document.getElementById("edCategory").value, 10);
      const cat = DB.categories.find((c) => c.id === catId);
      const authorId = parseInt(document.getElementById("edAuthor").value, 10);
      const author = DB.admins.find((x) => x.id === authorId);
      const selTags = Array.from(document.querySelectorAll("#modalBox .checkbox-list input:checked"))
        .map((el) => ({ slug: el.value, name: el.dataset.tagname }));

      const patch = {
        title,
        slug: document.getElementById("edSlug").value.trim() || slugify(title),
        excerpt: document.getElementById("edExcerpt").value.trim(),
        content: document.getElementById("edContent").value.trim(),
        category_id: catId, category_name: cat ? cat.name : "", category_slug: cat ? cat.slug : "",
        author_admin_id: authorId, author: author ? author.display_name : "",
        reading_time: parseInt(document.getElementById("edReadingTime").value, 10) || 5,
        status: document.getElementById("edStatus").value,
        cover_image: document.getElementById("edCover").value.trim(),
        tags: selTags,
      };

      if (isNew) {
        const newArticle = Object.assign({
          id: newId(), views: 0, days_ago: 0, subcategories: [],
        }, patch);
        patchOverlay((ov) => { ov.newArticles = (ov.newArticles || []).concat([newArticle]); });
        logActivity(`مقاله «${patch.title}» ایجاد شد.`);
        toast("مقاله جدید ایجاد شد.");
      } else {
        patchOverlay((ov) => {
          ov.articlePatches = ov.articlePatches || {};
          ov.articlePatches[id] = Object.assign({}, ov.articlePatches[id], patch);
        });
        logActivity(`مقاله «${patch.title}» ویرایش شد.`);
        toast("تغییرات ذخیره شد.");
      }
      closeModal();
      loadDb().then(render);
    });
  }

  /* ================= پروژه‌ها ================= */
  function renderProjects() {
    viewArea.innerHTML = `
      <div class="panel">
        <div class="table-toolbar">
          <input type="search" id="projectSearch" placeholder="جست‌وجو در عنوان پروژه‌ها...">
          <button class="btn btn-primary btn-sm" id="newProjectBtn">+ پروژه جدید</button>
        </div>
        <div style="overflow-x:auto;">
        <table>
          <thead><tr><th>عنوان</th><th>دسته</th><th>وضعیت</th><th>بازدید</th><th></th></tr></thead>
          <tbody id="projectsTbody"></tbody>
        </table>
        </div>
      </div>
    `;
    const tbody = document.getElementById("projectsTbody");
    function draw(filter) {
      const list = DB.projects
        .filter((p) => !filter || p.title.includes(filter))
        .slice()
        .sort((a, b) => a.days_ago - b.days_ago);
      tbody.innerHTML = list.map((p) => `
        <tr>
          <td class="cell-title">${esc(p.title)}<span class="sub">/${esc(p.slug)}</span></td>
          <td>${esc(p.category_name || "—")}</td>
          <td><span class="badge badge-${p.status}">${p.status === "published" ? "منتشرشده" : "پیش‌نویس"}</span></td>
          <td>${p.views.toLocaleString("fa-IR")}</td>
          <td>
            <div class="row-actions">
              <button class="btn btn-ghost btn-sm" data-act="edit-project" data-id="${p.id}">ویرایش</button>
              <button class="btn btn-danger btn-sm" data-act="delete-project" data-id="${p.id}">حذف</button>
            </div>
          </td>
        </tr>
      `).join("") || `<tr><td colspan="5"><div class="empty-state">پروژه‌ای یافت نشد.</div></td></tr>`;
    }
    draw("");
    document.getElementById("projectSearch").addEventListener("input", (e) => draw(e.target.value.trim()));
    document.getElementById("newProjectBtn").addEventListener("click", () => openProjectModal(null));

    tbody.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-act]");
      if (!btn) return;
      const id = parseInt(btn.dataset.id, 10);
      if (btn.dataset.act === "edit-project") openProjectModal(id);
      if (btn.dataset.act === "delete-project") {
        if (!confirm("این پروژه حذف شود؟ (فقط در همین مرورگر)")) return;
        patchOverlay((ov) => { ov.deletedProjects = (ov.deletedProjects || []).concat([id]); });
        logActivity(`پروژه «${DB.projects.find((p) => p.id === id)?.title || ""}» حذف شد.`);
        toast("پروژه حذف شد.");
        loadDb().then(render);
      }
    });
  }

  function teamCheckboxList(selectedIds) {
    return `<div class="checkbox-list">${DB.admins.map((ad) => `
      <label><input type="checkbox" value="${ad.id}" ${selectedIds.includes(ad.id) ? "checked" : ""}> ${esc(ad.display_name)}</label>
    `).join("")}</div>`;
  }

  function openProjectModal(id) {
    const isNew = id === null;
    const p = isNew ? {
      title: "", slug: "", excerpt: "", content: "",
      category_id: (DB.categories.find((c) => c.type === "project") || {}).id,
      status: "draft", cover_type: "image",
      cover_image: "https://picsum.photos/seed/resa-project-" + Date.now() + "/1200/750", team: [],
    } : DB.projects.find((x) => x.id === id);
    if (!p) return;
    const projectCats = DB.categories.filter((c) => c.type === "project");
    const selectedTeamIds = (p.team || []).filter((t) => t.is_admin !== false).map((t) => t.id);

    openModal(`
      <h3>${isNew ? "پروژه جدید" : "ویرایش پروژه"}</h3>
      <div class="field"><label>عنوان</label><input id="epTitle" value="${esc(p.title)}"></div>
      <div class="field"><label>نامک (slug)</label><input id="epSlug" value="${esc(p.slug)}" placeholder="در صورت خالی بودن، خودکار از روی عنوان ساخته می‌شود"></div>
      <div class="field"><label>خلاصه</label><textarea id="epExcerpt" style="min-height:70px;">${esc(p.excerpt)}</textarea></div>
      <div class="field"><label>توضیح کامل پروژه</label><textarea id="epContent" style="min-height:160px;">${esc(p.content)}</textarea></div>
      <div class="field-row">
        <div class="field"><label>دسته‌بندی</label>
          <select id="epCategory">${projectCats.map((c) => `<option value="${c.id}" ${c.id === p.category_id ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select>
        </div>
        <div class="field"><label>وضعیت</label>
          <select id="epStatus">
            <option value="published" ${p.status === "published" ? "selected" : ""}>منتشرشده</option>
            <option value="draft" ${p.status === "draft" ? "selected" : ""}>پیش‌نویس</option>
          </select>
        </div>
      </div>
      <div class="field"><label>آدرس تصویر کاور</label><input id="epCover" value="${esc(p.cover_image || "")}"></div>
      <div class="field"><label>اعضای تیم پروژه</label>${teamCheckboxList(selectedTeamIds)}</div>
      <div class="modal-actions">
        <button class="btn btn-primary" id="epSave">${isNew ? "ایجاد پروژه" : "ذخیره تغییرات"}</button>
        <button class="btn btn-ghost" id="epCancel">انصراف</button>
      </div>
    `, "modal-wide");

    document.getElementById("epCancel").addEventListener("click", closeModal);
    document.getElementById("epSave").addEventListener("click", () => {
      const title = document.getElementById("epTitle").value.trim();
      if (!title) { toast("عنوان الزامی است."); return; }
      const catId = parseInt(document.getElementById("epCategory").value, 10);
      const cat = DB.categories.find((c) => c.id === catId);
      const teamIds = Array.from(document.querySelectorAll("#modalBox .checkbox-list input:checked")).map((el) => parseInt(el.value, 10));
      const team = teamIds.map((tid, i) => {
        const ad = DB.admins.find((x) => x.id === tid);
        return { id: tid, name: ad ? ad.display_name : "", avatar: ad ? ad.avatar : "", bio: ad ? ad.bio_short : "", is_admin: true, sort_order: i };
      });

      const patch = {
        title,
        slug: document.getElementById("epSlug").value.trim() || slugify(title),
        excerpt: document.getElementById("epExcerpt").value.trim(),
        content: document.getElementById("epContent").value.trim(),
        category_id: catId, category_name: cat ? cat.name : "", category_slug: cat ? cat.slug : "",
        status: document.getElementById("epStatus").value,
        cover_type: "image",
        cover_image: document.getElementById("epCover").value.trim(),
        team,
      };

      if (isNew) {
        const newProject = Object.assign({ id: newId(), views: 0, days_ago: 0 }, patch);
        patchOverlay((ov) => { ov.newProjects = (ov.newProjects || []).concat([newProject]); });
        logActivity(`پروژه «${patch.title}» ایجاد شد.`);
        toast("پروژه جدید ایجاد شد.");
      } else {
        patchOverlay((ov) => {
          ov.projectPatches = ov.projectPatches || {};
          ov.projectPatches[id] = Object.assign({}, ov.projectPatches[id], patch);
        });
        logActivity(`پروژه «${patch.title}» ویرایش شد.`);
        toast("تغییرات ذخیره شد.");
      }
      closeModal();
      loadDb().then(render);
    });
  }

  /* ================= دسته‌بندی‌ها ================= */
  function renderCategories() {
    viewArea.innerHTML = `
      <div class="panel">
        <div class="table-toolbar">
          <span style="color:var(--text-mute); font-size:.85rem;">دسته‌بندی مقالات و پروژه‌ها</span>
          <button class="btn btn-primary btn-sm" id="newCategoryBtn">+ دسته‌بندی جدید</button>
        </div>
        <div style="overflow-x:auto;">
        <table>
          <thead><tr><th>نام</th><th>نامک</th><th>نوع</th><th>تعداد آیتم</th><th></th></tr></thead>
          <tbody id="categoriesTbody"></tbody>
        </table>
        </div>
      </div>
    `;
    const tbody = document.getElementById("categoriesTbody");
    function count(c) {
      return c.type === "blog"
        ? DB.articles.filter((a) => a.category_id === c.id).length
        : DB.projects.filter((p) => p.category_id === c.id).length;
    }
    function draw() {
      tbody.innerHTML = DB.categories.map((c) => `
        <tr>
          <td class="cell-title">${esc(c.name)}${c.parent_id ? `<span class="sub">زیرمجموعه‌ی ${esc((DB.categories.find(x=>x.id===c.parent_id)||{}).name||"")}</span>` : ""}</td>
          <td style="direction:ltr; text-align:right;">${esc(c.slug)}</td>
          <td>${c.type === "blog" ? "مقاله" : "پروژه"}</td>
          <td>${count(c)}</td>
          <td>
            <div class="row-actions">
              <button class="btn btn-ghost btn-sm" data-act="edit-cat" data-id="${c.id}">ویرایش</button>
              <button class="btn btn-danger btn-sm" data-act="delete-cat" data-id="${c.id}">حذف</button>
            </div>
          </td>
        </tr>
      `).join("") || `<tr><td colspan="5"><div class="empty-state">دسته‌بندی‌ای ثبت نشده.</div></td></tr>`;
    }
    draw();
    document.getElementById("newCategoryBtn").addEventListener("click", () => openCategoryModal(null));
    tbody.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-act]");
      if (!btn) return;
      const id = parseInt(btn.dataset.id, 10);
      if (btn.dataset.act === "edit-cat") openCategoryModal(id);
      if (btn.dataset.act === "delete-cat") {
        const c = DB.categories.find((x) => x.id === id);
        if (c && count(c) > 0) { toast("این دسته‌بندی روی محتوای منتشرشده استفاده شده؛ ابتدا آن‌ها را جابه‌جا یا حذف کنید."); return; }
        if (!confirm("این دسته‌بندی حذف شود؟")) return;
        patchOverlay((ov) => { ov.deletedCategories = (ov.deletedCategories || []).concat([id]); });
        toast("دسته‌بندی حذف شد.");
        loadDb().then(render);
      }
    });
  }

  function openCategoryModal(id) {
    const isNew = id === null;
    const c = isNew ? { name: "", slug: "", type: "blog", parent_id: null, description: "" } : DB.categories.find((x) => x.id === id);
    if (!c) return;
    const blogParents = DB.categories.filter((x) => x.type === "blog" && x.id !== id);
    openModal(`
      <h3>${isNew ? "دسته‌بندی جدید" : "ویرایش دسته‌بندی"}</h3>
      <div class="field"><label>نام</label><input id="ccName" value="${esc(c.name)}"></div>
      <div class="field"><label>نامک (slug)</label><input id="ccSlug" value="${esc(c.slug)}" placeholder="خودکار از روی نام ساخته می‌شود"></div>
      <div class="field"><label>نوع</label>
        <select id="ccType">
          <option value="blog" ${c.type === "blog" ? "selected" : ""}>مربوط به مقالات</option>
          <option value="project" ${c.type === "project" ? "selected" : ""}>مربوط به پروژه‌ها</option>
        </select>
      </div>
      <div class="field" id="ccParentField" style="${c.type === "project" ? "display:none;" : ""}">
        <label>زیرمجموعه‌ی (اختیاری)</label>
        <select id="ccParent">
          <option value="">— بدون والد —</option>
          ${blogParents.map((p) => `<option value="${p.id}" ${p.id === c.parent_id ? "selected" : ""}>${esc(p.name)}</option>`).join("")}
        </select>
      </div>
      <div class="field"><label>توضیح کوتاه</label><textarea id="ccDesc" style="min-height:60px;">${esc(c.description || "")}</textarea></div>
      <div class="modal-actions">
        <button class="btn btn-primary" id="ccSave">${isNew ? "ایجاد" : "ذخیره تغییرات"}</button>
        <button class="btn btn-ghost" id="ccCancel">انصراف</button>
      </div>
    `);
    document.getElementById("ccType").addEventListener("change", (e) => {
      document.getElementById("ccParentField").style.display = e.target.value === "blog" ? "" : "none";
    });
    document.getElementById("ccCancel").addEventListener("click", closeModal);
    document.getElementById("ccSave").addEventListener("click", () => {
      const name = document.getElementById("ccName").value.trim();
      if (!name) { toast("نام دسته‌بندی الزامی است."); return; }
      const type = document.getElementById("ccType").value;
      const patch = {
        name, type,
        slug: document.getElementById("ccSlug").value.trim() || slugify(name),
        parent_id: type === "blog" && document.getElementById("ccParent").value ? parseInt(document.getElementById("ccParent").value, 10) : null,
        description: document.getElementById("ccDesc").value.trim(),
      };
      if (isNew) {
        patchOverlay((ov) => { ov.newCategories = (ov.newCategories || []).concat([Object.assign({ id: newId() }, patch)]); });
        toast("دسته‌بندی ایجاد شد.");
      } else {
        patchOverlay((ov) => { ov.categoryPatches = Object.assign({}, ov.categoryPatches, { [id]: patch }); });
        toast("تغییرات ذخیره شد.");
      }
      closeModal();
      loadDb().then(render);
    });
  }

  /* ================= تگ‌ها ================= */
  function renderTags() {
    function count(slug) {
      return DB.articles.filter((a) => (a.tags || []).some((t) => t.slug === slug)).length;
    }
    viewArea.innerHTML = `
      <div class="panel">
        <div class="table-toolbar">
          <span style="color:var(--text-mute); font-size:.85rem;">تگ‌های مقالات</span>
          <button class="btn btn-primary btn-sm" id="newTagBtn">+ تگ جدید</button>
        </div>
        <div style="overflow-x:auto;">
        <table>
          <thead><tr><th>نام</th><th>نامک</th><th>تعداد مقاله</th><th></th></tr></thead>
          <tbody id="tagsTbody"></tbody>
        </table>
        </div>
      </div>
    `;
    const tbody = document.getElementById("tagsTbody");
    function draw() {
      tbody.innerHTML = DB.tags.map((t) => `
        <tr>
          <td class="cell-title">${esc(t.name)}</td>
          <td style="direction:ltr; text-align:right;">${esc(t.slug)}</td>
          <td>${count(t.slug)}</td>
          <td>
            <div class="row-actions">
              <button class="btn btn-ghost btn-sm" data-act="edit-tag" data-id="${t.id}">ویرایش</button>
              <button class="btn btn-danger btn-sm" data-act="delete-tag" data-id="${t.id}">حذف</button>
            </div>
          </td>
        </tr>
      `).join("") || `<tr><td colspan="4"><div class="empty-state">تگی ثبت نشده.</div></td></tr>`;
    }
    draw();
    document.getElementById("newTagBtn").addEventListener("click", () => openTagModal(null));
    tbody.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-act]");
      if (!btn) return;
      const id = parseInt(btn.dataset.id, 10);
      if (btn.dataset.act === "edit-tag") openTagModal(id);
      if (btn.dataset.act === "delete-tag") {
        if (!confirm("این تگ حذف شود؟ از همه‌ی مقالات هم برداشته می‌شود.")) return;
        const t = DB.tags.find((x) => x.id === id);
        patchOverlay((ov) => {
          ov.deletedTags = (ov.deletedTags || []).concat([id]);
          if (t) {
            ov.articlePatches = ov.articlePatches || {};
            DB.articles.filter((a) => (a.tags || []).some((x) => x.slug === t.slug)).forEach((a) => {
              const kept = (a.tags || []).filter((x) => x.slug !== t.slug);
              ov.articlePatches[a.id] = Object.assign({}, ov.articlePatches[a.id], { tags: kept });
            });
          }
        });
        toast("تگ حذف شد.");
        loadDb().then(render);
      }
    });
  }

  function openTagModal(id) {
    const isNew = id === null;
    const t = isNew ? { name: "", slug: "" } : DB.tags.find((x) => x.id === id);
    if (!t) return;
    openModal(`
      <h3>${isNew ? "تگ جدید" : "ویرایش تگ"}</h3>
      <div class="field"><label>نام</label><input id="tgName" value="${esc(t.name)}"></div>
      <div class="field"><label>نامک (slug)</label><input id="tgSlug" value="${esc(t.slug)}" placeholder="خودکار از روی نام ساخته می‌شود"></div>
      <div class="modal-actions">
        <button class="btn btn-primary" id="tgSave">${isNew ? "ایجاد" : "ذخیره تغییرات"}</button>
        <button class="btn btn-ghost" id="tgCancel">انصراف</button>
      </div>
    `);
    document.getElementById("tgCancel").addEventListener("click", closeModal);
    document.getElementById("tgSave").addEventListener("click", () => {
      const name = document.getElementById("tgName").value.trim();
      if (!name) { toast("نام تگ الزامی است."); return; }
      const slug = document.getElementById("tgSlug").value.trim() || slugify(name);
      if (isNew) {
        patchOverlay((ov) => { ov.newTags = (ov.newTags || []).concat([{ id: newId(), name, slug }]); });
        toast("تگ ایجاد شد.");
      } else {
        patchOverlay((ov) => {
          ov.tagPatches = Object.assign({}, ov.tagPatches, { [id]: { name, slug } });
          ov.articlePatches = ov.articlePatches || {};
          DB.articles.filter((a) => (a.tags || []).some((x) => x.slug === t.slug)).forEach((a) => {
            const updated = (a.tags || []).map((x) => (x.slug === t.slug ? { name, slug } : x));
            ov.articlePatches[a.id] = Object.assign({}, ov.articlePatches[a.id], { tags: updated });
          });
        });
        toast("تغییرات ذخیره شد.");
      }
      closeModal();
      loadDb().then(render);
    });
  }

  /* ================= تیم و مدیران ================= */
  function renderTeam() {
    viewArea.innerHTML = `
      <div class="table-toolbar" style="margin-bottom:16px;">
        <span style="color:var(--text-mute); font-size:.85rem;">اعضای تیم که می‌توانند نویسنده‌ی مقاله یا عضو تیم پروژه باشند</span>
        <button class="btn btn-primary btn-sm" id="newAdminBtn">+ عضو جدید</button>
      </div>
      <div class="team-grid" id="teamGrid"></div>
    `;
    function draw() {
      const grid = document.getElementById("teamGrid");
      grid.innerHTML = DB.admins.map((ad) => {
        const articleCount = DB.articles.filter((a) => a.author_admin_id === ad.id).length;
        return `
          <div class="team-card">
            <img src="${esc(ad.avatar)}" alt="${esc(ad.display_name)}">
            <h4>${esc(ad.display_name)}</h4>
            <p>${esc(ad.bio_short || "")}<br><span style="color:var(--text-faint);">${articleCount} مقاله</span></p>
            <div class="row-actions">
              <button class="btn btn-ghost btn-sm" data-act="edit-admin" data-id="${ad.id}">ویرایش</button>
              <button class="btn btn-danger btn-sm" data-act="delete-admin" data-id="${ad.id}">حذف</button>
            </div>
          </div>
        `;
      }).join("") || `<div class="empty-state">عضوی ثبت نشده.</div>`;

      grid.querySelectorAll("button[data-act]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const id = parseInt(btn.dataset.id, 10);
          if (btn.dataset.act === "edit-admin") openAdminModal(id);
          if (btn.dataset.act === "delete-admin") {
            if (DB.admins.length <= 1) { toast("حداقل باید یک عضو تیم باقی بماند."); return; }
            if (!confirm("این عضو حذف شود؟")) return;
            patchOverlay((ov) => { ov.deletedAdmins = (ov.deletedAdmins || []).concat([id]); });
            toast("عضو حذف شد.");
            loadDb().then(render);
          }
        });
      });
    }
    draw();
    document.getElementById("newAdminBtn").addEventListener("click", () => openAdminModal(null));
  }

  function openAdminModal(id) {
    const isNew = id === null;
    const ad = isNew ? {
      display_name: "", bio_short: "", bio_full: "",
      avatar: "https://api.dicebear.com/9.x/notionists/svg?seed=resa-member-" + Date.now(),
      social_telegram: "", social_instagram: "", social_email: "",
    } : DB.admins.find((x) => x.id === id);
    if (!ad) return;
    openModal(`
      <h3>${isNew ? "عضو جدید تیم" : "ویرایش عضو تیم"}</h3>
      <div style="display:flex; align-items:center; gap:12px; margin-bottom:14px;">
        <img id="admAvatarPreview" class="avatar-preview" src="${esc(ad.avatar)}" alt="">
        <div class="field" style="flex:1; margin-bottom:0;"><label>آدرس تصویر آواتار</label><input id="admAvatar" value="${esc(ad.avatar)}"></div>
      </div>
      <div class="field"><label>نام نمایشی</label><input id="admName" value="${esc(ad.display_name)}"></div>
      <div class="field"><label>معرفی کوتاه</label><input id="admBioShort" value="${esc(ad.bio_short || "")}"></div>
      <div class="field"><label>بیوگرافی کامل</label><textarea id="admBioFull" style="min-height:90px;">${esc(ad.bio_full || "")}</textarea></div>
      <div class="field-row">
        <div class="field"><label>تلگرام</label><input id="admTelegram" value="${esc(ad.social_telegram || "")}"></div>
        <div class="field"><label>اینستاگرام</label><input id="admInstagram" value="${esc(ad.social_instagram || "")}"></div>
      </div>
      <div class="field"><label>ایمیل</label><input id="admEmail" value="${esc(ad.social_email || "")}"></div>
      <div class="modal-actions">
        <button class="btn btn-primary" id="admSave">${isNew ? "ایجاد عضو" : "ذخیره تغییرات"}</button>
        <button class="btn btn-ghost" id="admCancel">انصراف</button>
      </div>
    `);
    document.getElementById("admAvatar").addEventListener("input", (e) => {
      document.getElementById("admAvatarPreview").src = e.target.value;
    });
    document.getElementById("admCancel").addEventListener("click", closeModal);
    document.getElementById("admSave").addEventListener("click", () => {
      const display_name = document.getElementById("admName").value.trim();
      if (!display_name) { toast("نام الزامی است."); return; }
      const patch = {
        display_name,
        bio_short: document.getElementById("admBioShort").value.trim(),
        bio_full: document.getElementById("admBioFull").value.trim(),
        avatar: document.getElementById("admAvatar").value.trim(),
        social_telegram: document.getElementById("admTelegram").value.trim(),
        social_instagram: document.getElementById("admInstagram").value.trim(),
        social_email: document.getElementById("admEmail").value.trim(),
      };
      if (isNew) {
        patchOverlay((ov) => {
          ov.newAdmins = (ov.newAdmins || []).concat([Object.assign({
            id: newId(), username: slugify(display_name),
          }, patch)]);
        });
        toast("عضو جدید ایجاد شد.");
      } else {
        patchOverlay((ov) => { ov.adminPatches = Object.assign({}, ov.adminPatches, { [id]: patch }); });
        toast("تغییرات ذخیره شد.");
      }
      closeModal();
      loadDb().then(render);
    });
  }

  /* ================= نظرات ================= */
  function renderComments() {
    const list = (DB.pending_comments || []).slice().sort((a, b) => a.hours_ago - b.hours_ago);
    viewArea.innerHTML = `
      <div class="panel">
        <h3>صف بررسی نظرات</h3>
        <div style="overflow-x:auto;">
        <table>
          <thead><tr><th>نویسنده</th><th>متن</th><th>مقاله</th><th>وضعیت</th><th></th></tr></thead>
          <tbody>
            ${list.map((c) => `
              <tr>
                <td>${esc(c.user_name)}</td>
                <td style="max-width:320px;">${esc(c.content)}</td>
                <td>${esc(c.article_title)}</td>
                <td><span class="badge badge-${c.status}">${{ pending: "در انتظار", approved: "تاییدشده", rejected: "رد‌شده" }[c.status]}</span></td>
                <td>
                  <div class="row-actions">
                    ${c.status !== "approved" ? `<button class="btn btn-success btn-sm" data-act="approve" data-id="${c.id}">تایید</button>` : ""}
                    ${c.status !== "rejected" ? `<button class="btn btn-danger btn-sm" data-act="reject" data-id="${c.id}">رد</button>` : ""}
                    <button class="btn btn-ghost btn-sm" data-act="delete-comment" data-id="${c.id}">حذف</button>
                  </div>
                </td>
              </tr>
            `).join("") || `<tr><td colspan="5"><div class="empty-state">نظری برای بررسی نیست.</div></td></tr>`}
          </tbody>
        </table>
        </div>
      </div>
      <p style="color:var(--text-faint); font-size:.8rem;">نظرات تاییدشده‌ی خودِ کاربران سایت به‌صورت خودکار زیر مقالات منتشر می‌شوند (چون در تنظیمات، تایید خودکار فعال است) و در این صف نیستند.</p>
    `;
    viewArea.querySelector("table").addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-act]");
      if (!btn) return;
      const id = btn.dataset.id;
      if (btn.dataset.act === "approve") {
        patchOverlay((ov) => { ov.commentStatus = Object.assign({}, ov.commentStatus, { [id]: "approved" }); });
        toast("نظر تایید شد.");
      } else if (btn.dataset.act === "reject") {
        patchOverlay((ov) => { ov.commentStatus = Object.assign({}, ov.commentStatus, { [id]: "rejected" }); });
        toast("نظر رد شد.");
      } else if (btn.dataset.act === "delete-comment") {
        if (!confirm("این نظر برای همیشه حذف شود؟")) return;
        patchOverlay((ov) => { ov.deletedPending = (ov.deletedPending || []).concat([parseInt(id, 10)]); });
        toast("نظر حذف شد.");
      }
      loadDb().then(render);
    });
  }

  /* ================= پیام‌ها ================= */
  function renderMessages() {
    const list = DB.messages.slice().sort((a, b) => a.hours_ago - b.hours_ago);
    viewArea.innerHTML = `
      <div class="panel" id="messagesPanel">
        <h3>پیام‌های فرم تماس</h3>
        ${list.map((m) => `
          <div class="panel-row" style="align-items:flex-start; flex-direction:column; gap:6px;">
            <div style="display:flex; width:100%; justify-content:space-between; gap:10px;">
              <strong>${esc(m.full_name)} <span style="color:var(--text-faint); font-weight:400;">— ${esc(m.contact_info)}</span></strong>
              <span class="badge badge-${m.is_read ? "read" : "unread"}">${m.is_read ? "خوانده‌شده" : "خوانده‌نشده"}</span>
            </div>
            <p style="margin:2px 0; color:var(--text-main); font-size:.85rem;">${esc(m.message)}</p>
            <div style="display:flex; justify-content:space-between; width:100%; align-items:center;">
              <span style="color:var(--text-faint); font-size:.75rem;">${fmtHoursAgo(m.hours_ago)}</span>
              <div class="row-actions">
                <button class="btn btn-ghost btn-sm" data-act="toggle-read" data-id="${m.id}">${m.is_read ? "علامت‌گذاری به‌عنوان نخوانده" : "علامت‌گذاری به‌عنوان خوانده‌شده"}</button>
                <button class="btn btn-danger btn-sm" data-act="delete-message" data-id="${m.id}">حذف</button>
              </div>
            </div>
          </div>
        `).join("") || `<div class="empty-state">پیامی وجود ندارد.</div>`}
      </div>
    `;
    document.getElementById("messagesPanel").addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-act]");
      if (!btn) return;
      const id = btn.dataset.id;
      if (btn.dataset.act === "toggle-read") {
        const m = DB.messages.find((x) => x.id == id);
        patchOverlay((ov) => { ov.messageRead = Object.assign({}, ov.messageRead, { [id]: !m.is_read }); });
      } else if (btn.dataset.act === "delete-message") {
        if (!confirm("این پیام حذف شود؟")) return;
        patchOverlay((ov) => { ov.deletedMessages = (ov.deletedMessages || []).concat([parseInt(id, 10)]); });
        toast("پیام حذف شد.");
      }
      loadDb().then(render);
    });
  }

  /* ================= تنظیمات ================= */
  function renderSettings() {
    const autoApprove = DB.settings.comments_auto_approve === "1";
    viewArea.innerHTML = `
      <div class="panel">
        <h3>اطلاعات کلی سایت</h3>
        <div class="field"><label>نام سایت</label><input id="stSiteName" value="${esc(DB.site.name)}"></div>
        <div class="field"><label>شعار / تگ‌لاین</label><input id="stSiteTagline" value="${esc(DB.site.tagline)}"></div>
        <button class="btn btn-primary btn-sm" id="stSaveSite">ذخیره اطلاعات سایت</button>
      </div>

      <div class="panel">
        <h3>تنظیمات نظرات</h3>
        <div class="switch-row">
          <div>
            <div>تایید خودکار نظرات</div>
            <div style="color:var(--text-faint); font-size:.78rem; margin-top:2px;">اگر خاموش باشد، نظرات جدید کاربران قبل از انتشار در صف «نظرات» منتظر تایید می‌مانند.</div>
          </div>
          <label class="switch">
            <input type="checkbox" id="autoApproveSwitch" ${autoApprove ? "checked" : ""}>
            <span class="switch-track"></span>
          </label>
        </div>
      </div>

      <div class="panel">
        <h3>آمار بازدید سایت</h3>
        <div class="panel-row"><span>مجموع بازدید</span><strong>${DB.visit_stats.total.toLocaleString("fa-IR")}</strong></div>
        <div class="panel-row"><span>بازدید امروز</span><strong>${DB.visit_stats.today.toLocaleString("fa-IR")}</strong></div>
        ${DB.visit_stats.top_pages.map((p) => `<div class="panel-row"><span style="direction:ltr; text-align:right;">${esc(p.page_path)}</span><strong>${p.count.toLocaleString("fa-IR")}</strong></div>`).join("")}
      </div>

      <div class="panel">
        <h3>گزارش کامل فعالیت‌ها</h3>
        ${((DB.extraActivity || []).concat(DB.activity_log || [])).map((a) => `
          <div class="panel-row">
            <span>${esc(a.description)}</span>
            <span style="color:var(--text-faint); white-space:nowrap;">${a.justNow ? "لحظاتی پیش" : fmtHoursAgo(a.hours_ago)}</span>
          </div>`).join("") || `<div class="empty-state">فعالیتی ثبت نشده</div>`}
      </div>

      <div class="panel">
        <h3>مدیریت داده‌های دمو</h3>
        <p style="color:var(--text-mute); font-size:.85rem; line-height:2;">
          این پنل داده‌ی واقعی ندارد و همه‌چیز روی <code>localStorage</code> مرورگر شما کار می‌کند.
          با دکمه‌ی زیر می‌توانید تمام تغییراتی که در این پنل انجام داده‌اید را به حالت اولیه‌ی دمو برگردانید.
        </p>
        <button class="btn btn-danger" id="resetDemoBtn">بازنشانی داده‌های دمو</button>
      </div>
    `;
    document.getElementById("stSaveSite").addEventListener("click", () => {
      patchOverlay((ov) => {
        ov.site = Object.assign({}, ov.site, {
          name: document.getElementById("stSiteName").value.trim(),
          tagline: document.getElementById("stSiteTagline").value.trim(),
        });
      });
      toast("اطلاعات سایت ذخیره شد.");
      loadDb().then(render);
    });
    document.getElementById("autoApproveSwitch").addEventListener("change", (e) => {
      patchOverlay((ov) => { ov.settings = Object.assign({}, ov.settings, { comments_auto_approve: e.target.checked ? "1" : "0" }); });
      toast("تنظیمات ذخیره شد.");
      loadDb().then(render);
    });
    document.getElementById("resetDemoBtn").addEventListener("click", () => {
      if (!confirm("همه‌ی تغییرات محلی پنل مدیریت پاک شود؟")) return;
      localStorage.removeItem(LS_OVERLAY);
      toast("داده‌های دمو بازنشانی شد.");
      loadDb().then(render);
    });
  }

  /* ---------- مودال عمومی ---------- */
  function openModal(html, extraClass) {
    const box = document.getElementById("modalBox");
    box.className = "modal-box" + (extraClass ? " " + extraClass : "");
    box.innerHTML = html;
    document.getElementById("modalOverlay").classList.remove("hidden");
  }
  function closeModal() {
    document.getElementById("modalOverlay").classList.add("hidden");
  }
  document.getElementById("modalOverlay").addEventListener("click", (e) => {
    if (e.target.id === "modalOverlay") closeModal();
  });

  /* ---------------- بوت ---------------- */
  function boot() {
    loginScreen.classList.add("hidden");
    app.classList.remove("hidden");
    document.getElementById("currentAdminName").textContent = "سمیرا راد (دمو)";
    loadDb().then(render);
  }

  if (isLoggedIn()) boot();
})();
