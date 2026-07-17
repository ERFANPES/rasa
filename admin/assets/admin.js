/* =========================================================
   admin.js — پنل ادمین رسا (نسخه‌ی دموی استاتیک)
   این فایل، ظاهر و رفتار پنل ادمین واقعی پروژه رسا را با
   داده‌های نمونه و بدون بک‌اند واقعی بازسازی می‌کند. همه‌ی
   تغییرات (خواندن پیام، تایید نظر، ویرایش مقاله و ...) در
   localStorage همین مرورگر ذخیره می‌شوند و به هیچ سروری
   ارسال نمی‌شوند.
   ========================================================= */
(function () {
  "use strict";

  const LS_AUTH = "resa_admin_auth_v1";
  const LS_OVERLAY = "resa_admin_overlay_v1";
  const DEMO_USER = "admin";
  const DEMO_PASS = "demo1234";

  let DB = null;
  let nextId = Date.now();
  function newId() { return nextId++; }
  function esc(str) {
    const div = document.createElement("div");
    div.textContent = str ?? "";
    return div.innerHTML;
  }
  function formatDate(input) {
    try {
      const d = typeof input === "number" ? new Date(Date.now() - input * 3600 * 1000) : new Date(input);
      return d.toLocaleString("fa-IR", { dateStyle: "medium", timeStyle: "short" });
    } catch (e) { return ""; }
  }

  const tabTitles = {
    messages: "پیام‌های تماس با ما",
    projects: "مدیریت پروژه‌ها",
    articles: "مدیریت مقالات",
    comments: "نظرات کاربران",
    settings: "تنظیمات",
  };
  const settingsRowTitles = {
    profile: "پروفایل و امنیت",
    admins: "ادمین‌ها",
    site: "سایت",
    stats: "آمار و گزارش",
    backup: "پشتیبان‌گیری",
  };
  const ROLE_LABELS = { super_admin: "سوپر ادمین", admin: "ادمین" };
  function roleLabel(role) { return ROLE_LABELS[role] || ROLE_LABELS.admin; }

  /* ---------------- overlay (تغییرات محلی روی داده دمو) ---------------- */
  function readOverlay() {
    try { return JSON.parse(localStorage.getItem(LS_OVERLAY) || "{}"); }
    catch (e) { return {}; }
  }
  function writeOverlay(ov) { localStorage.setItem(LS_OVERLAY, JSON.stringify(ov)); }
  function patchOverlay(mutator) {
    const ov = readOverlay();
    mutator(ov);
    writeOverlay(ov);
  }
  function logActivity(description) {
    patchOverlay((ov) => {
      ov.activity = ov.activity || [];
      ov.activity.unshift({ id: newId(), admin_username: DEMO_USER, description, hours_ago: 0, justNow: true });
      ov.activity = ov.activity.slice(0, 40);
    });
  }

  function applyOverlay(db) {
    const ov = readOverlay();

    (ov.newCategories || []).forEach((c) => db.categories.push(c));
    Object.entries(ov.categoryPatches || {}).forEach(([id, patch]) => {
      const c = db.categories.find((x) => x.id == id);
      if (c) Object.assign(c, patch);
    });
    (ov.deletedCategories || []).forEach((id) => { db.categories = db.categories.filter((c) => c.id != id); });

    (ov.newAdmins || []).forEach((a) => db.admins.push(a));
    Object.entries(ov.adminPatches || {}).forEach(([id, patch]) => {
      const a = db.admins.find((x) => x.id == id);
      if (a) Object.assign(a, patch);
    });
    (ov.deletedAdmins || []).forEach((id) => { db.admins = db.admins.filter((a) => a.id != id); });

    (ov.newArticles || []).forEach((a) => db.articles.push(a));
    (ov.deletedArticles || []).forEach((id) => { db.articles = db.articles.filter((a) => a.id != id); });
    Object.entries(ov.articlePatches || {}).forEach(([id, patch]) => {
      const a = db.articles.find((x) => x.id == id);
      if (a) Object.assign(a, patch);
    });

    (ov.newProjects || []).forEach((p) => db.projects.push(p));
    (ov.deletedProjects || []).forEach((id) => { db.projects = db.projects.filter((p) => p.id != id); });
    Object.entries(ov.projectPatches || {}).forEach(([id, patch]) => {
      const p = db.projects.find((x) => x.id == id);
      if (p) Object.assign(p, patch);
    });

    db.articles.forEach((a) => {
      const cat = db.categories.find((c) => c.id === a.category_id);
      if (cat) { a.category_name = cat.name; a.category_slug = cat.slug; }
    });
    db.projects.forEach((p) => {
      const cat = db.categories.find((c) => c.id === p.category_id);
      if (cat) { p.category_name = cat.name; p.category_slug = cat.slug; }
    });

    /* ---- نظرات (تایید/رد/حذف/پاسخ روی نظرات واقعی + صف در انتظار) ---- */
    Object.entries(ov.commentStatus || {}).forEach(([id, status]) => {
      forEachComment(db, (c) => { if (String(c.id) === String(id)) c.status = status; });
    });
    (ov.deletedComments || []).forEach((id) => {
      removeCommentById(db, id);
    });
    (ov.commentReplies || []).forEach((reply) => {
      const list = db.comments[String(reply.article_id)] = db.comments[String(reply.article_id)] || [];
      const parent = list.find((c) => c.id == reply.parent_id);
      if (parent) {
        parent.replies = parent.replies || [];
        parent.replies.push(reply);
      }
    });

    (ov.deletedPending || []).forEach((id) => { db.pending_comments = (db.pending_comments || []).filter((c) => c.id != id); });
    Object.entries(ov.messageRead || {}).forEach(([id, val]) => {
      const m = db.messages.find((x) => x.id == id);
      if (m) m.is_read = val;
    });
    (ov.deletedMessages || []).forEach((id) => { db.messages = db.messages.filter((m) => m.id != id); });
    if (ov.settings) Object.assign(db.settings, ov.settings);
    if (ov.site) Object.assign(db.site, ov.site);
    if (ov.profile) Object.assign(db.admins[0], ov.profile);

    db.pending_comments = db.pending_comments || [];
    db.extraActivity = ov.activity || [];
  }

  function forEachComment(db, fn) {
    Object.values(db.comments || {}).forEach((list) => {
      list.forEach((c) => {
        fn(c);
        (c.replies || []).forEach(fn);
      });
    });
    (db.pending_comments || []).forEach(fn);
  }
  function removeCommentById(db, id) {
    Object.keys(db.comments || {}).forEach((k) => {
      db.comments[k] = db.comments[k].filter((c) => String(c.id) !== String(id));
      db.comments[k].forEach((c) => { c.replies = (c.replies || []).filter((r) => String(r.id) !== String(id)); });
    });
    db.pending_comments = (db.pending_comments || []).filter((c) => String(c.id) !== String(id));
  }

  /* ---- تبدیل ساختار comments/pending_comments به یک لیست یکپارچه، دقیقا مثل پنل واقعی ---- */
  function flattenComments(db) {
    const out = [];
    const articleTitle = (id) => (db.articles.find((a) => a.id == id) || {}).title || "";
    const articleSlug = (id) => (db.articles.find((a) => a.id == id) || {}).slug || "";
    const adminName = (id) => (db.admins.find((a) => a.id == id) || {}).display_name || "ادمین";

    Object.entries(db.comments || {}).forEach(([articleId, list]) => {
      list.forEach((c) => {
        out.push({
          id: c.id, status: c.status || "approved", content: c.content, hours_ago: c.hours_ago,
          author_type: c.author_type, author_name: c.author_type === "admin" ? adminName(c.admin_id) : c.user_name,
          parent_id: null, parent_author_name: "",
          article_id: articleId, article_title: articleTitle(articleId), article_slug: articleSlug(articleId),
        });
        (c.replies || []).forEach((r) => {
          out.push({
            id: r.id, status: r.status || "approved", content: r.content, hours_ago: r.hours_ago,
            author_type: r.author_type, author_name: r.author_type === "admin" ? adminName(r.admin_id) : r.user_name,
            parent_id: c.id, parent_author_name: c.author_type === "admin" ? adminName(c.admin_id) : c.user_name,
            article_id: articleId, article_title: articleTitle(articleId), article_slug: articleSlug(articleId),
          });
        });
      });
    });
    (db.pending_comments || []).forEach((c) => {
      out.push({
        id: c.id, status: c.status || "pending", content: c.content, hours_ago: c.hours_ago,
        author_type: "user", author_name: c.user_name, parent_id: null, parent_author_name: "",
        article_id: c.article_id, article_title: c.article_title, article_slug: articleSlug(c.article_id),
      });
    });
    out.sort((a, b) => a.hours_ago - b.hours_ago);
    return out;
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

  const body = document.getElementById("pageBody");
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
      err.classList.remove("hidden");
    }
  });

  document.getElementById("logoutBtn").addEventListener("click", (e) => {
    e.preventDefault();
    clearLoggedIn();
    app.classList.add("hidden");
    loginScreen.classList.remove("hidden");
    body.classList.add("login-body");
  });

  function showToast(message, isError) {
    const toast = document.getElementById("toast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.toggle("is-error", !!isError);
    toast.classList.add("is-visible");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toast.classList.remove("is-visible"), 3200);
  }

  /* ---------------- ناوبری sidebar / موبایل / تب‌های تنظیمات ---------------- */
  function initSidebarTabs() {
    const tabs = document.querySelectorAll(".side-tab");
    const panels = document.querySelectorAll(".tab-panel");
    const title = document.getElementById("topbarTitle");
    const sidebar = document.querySelector(".admin-sidebar");
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        tabs.forEach((t) => t.classList.remove("is-active"));
        tab.classList.add("is-active");
        const target = tab.dataset.tab;
        panels.forEach((p) => p.classList.toggle("is-active", p.id === "tab-" + target));
        if (title) title.textContent = tabTitles[target] || "";
        sidebar.classList.remove("is-open");
        document.getElementById("sidebarBackdrop")?.classList.remove("is-open");
      });
    });
  }
  function initMobileMenu() {
    const btn = document.getElementById("mobileMenuBtn");
    const sidebar = document.querySelector(".admin-sidebar");
    const backdrop = document.getElementById("sidebarBackdrop");
    if (!btn || !sidebar) return;
    function closeSidebar() { sidebar.classList.remove("is-open"); backdrop?.classList.remove("is-open"); }
    function toggleSidebar() { sidebar.classList.toggle("is-open"); backdrop?.classList.toggle("is-open"); }
    btn.addEventListener("click", toggleSidebar);
    backdrop?.addEventListener("click", closeSidebar);
  }
  function initSettingsSubtabs() {
    const wrap = document.getElementById("iosSettings");
    const rows = document.querySelectorAll(".ios-row[data-subtab]");
    const panels = document.querySelectorAll(".settings-subpanel");
    const backBtn = document.getElementById("settingsBackBtn");
    const detailTitle = document.getElementById("settingsDetailTitle");
    if (!wrap || !rows.length) return;
    function openSubtab(target) {
      panels.forEach((p) => p.classList.toggle("is-active", p.dataset.subtabPanel === target));
      if (detailTitle) detailTitle.textContent = settingsRowTitles[target] || "";
      wrap.classList.add("is-drilled");
      wrap.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    rows.forEach((row) => row.addEventListener("click", () => openSubtab(row.dataset.subtab)));
    backBtn?.addEventListener("click", () => wrap.classList.remove("is-drilled"));
  }

  /* ================= پیام‌ها ================= */
  function messageCardHtml(m) {
    const unreadClass = m.is_read ? "" : "is-unread";
    const nextRead = m.is_read ? "0" : "1";
    const readIcon = m.is_read
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12s3.5-7 9-7 9 7 9 7-3.5 7-9 7-9-7-9-7Z"/><circle cx="12" cy="12" r="3"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 5.5 20.5 18.5"/><path d="M9.9 6.6C10.6 6.2 11.3 6 12 6c5.5 0 9 6 9 6a15 15 0 0 1-3.1 3.6M6.5 8C4.4 9.5 3 12 3 12s3.5 6 9 6c1 0 2-.2 2.9-.5"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>';
    return `
      <div class="message-card ${unreadClass}" data-id="${m.id}">
        <div class="message-main">
          <div class="message-name">${esc(m.full_name)}</div>
          <div class="message-contact">${esc(m.contact_info)}</div>
          <div class="message-preview">${esc(m.message)}</div>
          <div class="message-date">${formatDate(m.hours_ago)}</div>
        </div>
        <div class="message-actions">
          <button class="icon-btn" data-action="toggle-read" data-id="${m.id}" data-next="${nextRead}" title="${m.is_read ? "علامت‌گذاری به‌عنوان نخوانده" : "علامت‌گذاری به‌عنوان خوانده‌شده"}">${readIcon}</button>
          <button class="icon-btn icon-btn--danger" data-action="delete" data-id="${m.id}" title="حذف پیام">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16"/><path d="M9 7V4.5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1V7"/><path d="M6 7l1 13a1.5 1.5 0 0 0 1.5 1.4h7a1.5 1.5 0 0 0 1.5-1.4L18 7"/></svg>
          </button>
        </div>
      </div>`;
  }
  function renderMessages() {
    const listEl = document.getElementById("messagesList");
    const list = DB.messages.slice().sort((a, b) => a.hours_ago - b.hours_ago);
    const unread = list.filter((m) => !m.is_read).length;
    document.getElementById("msgTotalCount").textContent = list.length.toLocaleString("fa-IR");
    document.getElementById("msgUnreadCount").textContent = unread.toLocaleString("fa-IR");
    const badge = document.getElementById("sidebarUnreadBadge");
    badge.textContent = unread;
    badge.style.display = unread > 0 ? "flex" : "none";

    if (!list.length) { listEl.innerHTML = '<div class="empty-state">هنوز پیامی دریافت نشده است.</div>'; return; }
    listEl.innerHTML = list.map(messageCardHtml).join("");
    listEl.querySelectorAll(".message-card").forEach((card) => {
      card.addEventListener("click", (e) => {
        if (e.target.closest(".icon-btn")) return;
        openMessageModal(parseInt(card.dataset.id, 10));
      });
    });
    listEl.querySelectorAll("[data-action='toggle-read']").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        const m = DB.messages.find((x) => x.id == id);
        patchOverlay((ov) => { ov.messageRead = Object.assign({}, ov.messageRead, { [id]: !m.is_read }); });
        refreshAll();
      });
    });
    listEl.querySelectorAll("[data-action='delete']").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (!confirm("آیا از حذف این پیام مطمئن هستید؟")) return;
        patchOverlay((ov) => { ov.deletedMessages = (ov.deletedMessages || []).concat([parseInt(btn.dataset.id, 10)]); });
        showToast("پیام حذف شد.");
        refreshAll();
      });
    });
  }
  function openMessageModal(id) {
    const m = DB.messages.find((x) => x.id == id);
    if (!m) return;
    document.getElementById("modalSenderName").textContent = m.full_name;
    document.getElementById("modalMeta").textContent = m.contact_info + " — " + formatDate(m.hours_ago);
    document.getElementById("modalMessageText").textContent = m.message;
    document.getElementById("messageModal").classList.add("is-open");
  }

  /* ================= پروژه‌ها ================= */
  function projectCardHtml(p) {
    const thumb = p.cover_image ? `<img src="${esc(p.cover_image)}" alt="">` : `<div class="proj-thumb-empty">—</div>`;
    const statusBadge = p.status === "published"
      ? '<span class="status-badge status-badge--published">منتشر شده</span>'
      : '<span class="status-badge status-badge--draft">پیش‌نویس</span>';
    const cat = p.category_name ? `<span class="cat-badge">${esc(p.category_name)}</span>` : `<span class="cat-badge cat-badge--empty">بدون دسته</span>`;
    const team = (p.team || []).slice(0, 4).map((t) => t.avatar
      ? `<span class="team-avatar-stack-item"><img src="${esc(t.avatar)}" alt="" title="${esc(t.name)}"></span>`
      : `<span class="team-avatar-stack-item" title="${esc(t.name)}">${esc((t.name || "").slice(0, 1))}</span>`).join("");
    const previewBtn = p.status === "published"
      ? `<a class="icon-btn" target="_blank" href="../project.html?slug=${encodeURIComponent(p.slug)}" title="مشاهده در سایت"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12s3.5-7 9-7 9 7 9 7-3.5 7-9 7-9-7-9-7Z"/><circle cx="12" cy="12" r="3"/></svg></a>`
      : "";
    return `
      <div class="proj-card-admin" data-id="${p.id}">
        <div class="proj-card-admin-thumb">${thumb}</div>
        <div class="proj-card-admin-body">
          <div class="proj-card-admin-title"><a href="#" data-action="edit" data-id="${p.id}">${esc(p.title)}</a></div>
          <div class="proj-card-admin-meta">${cat} ${statusBadge}</div>
          <div class="proj-card-admin-team">${team}</div>
          <div class="proj-card-admin-date">${formatDate ? esc((p.days_ago || 0) + " روز پیش") : ""}</div>
        </div>
        <div class="proj-card-admin-actions">
          ${previewBtn}
          <button class="icon-btn" data-action="edit" data-id="${p.id}" title="ویرایش">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L18.5 9.5a2 2 0 0 0-4-4L4 16v4Z"/><path d="M13 6.5 17.5 11"/></svg>
          </button>
          <button class="icon-btn icon-btn--danger" data-action="delete" data-id="${p.id}" title="حذف">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16"/><path d="M9 7V4.5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1V7"/><path d="M6 7l1 13a1.5 1.5 0 0 0 1.5 1.4h7a1.5 1.5 0 0 0 1.5-1.4L18 7"/></svg>
          </button>
        </div>
      </div>`;
  }
  function renderProjects() {
    const grid = document.getElementById("projectsGridAdmin");
    const q = (document.getElementById("projectSearchInput").value || "").trim().toLowerCase();
    const catFilter = document.getElementById("projectCategoryFilter").value;
    const statusFilter = document.getElementById("projectStatusFilter").value;

    const projectCats = DB.categories.filter((c) => c.type === "project");
    const catSelect = document.getElementById("projectCategoryFilter");
    if (!catSelect.dataset.filled) {
      catSelect.innerHTML = '<option value="">همه دسته‌بندی‌ها</option>' + projectCats.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join("");
      catSelect.dataset.filled = "1";
    }

    let list = DB.projects.slice();
    document.getElementById("projTotalCount").textContent = list.length.toLocaleString("fa-IR");
    document.getElementById("projPublishedCount").textContent = list.filter((p) => p.status === "published").length.toLocaleString("fa-IR");
    document.getElementById("projDraftCount").textContent = list.filter((p) => p.status === "draft").length.toLocaleString("fa-IR");

    if (q) list = list.filter((p) => p.title.toLowerCase().includes(q));
    if (catFilter) list = list.filter((p) => String(p.category_id) === catFilter);
    if (statusFilter) list = list.filter((p) => p.status === statusFilter);

    if (!list.length) { grid.innerHTML = '<div class="empty-state">پروژه‌ای یافت نشد.</div>'; return; }
    grid.innerHTML = list.map(projectCardHtml).join("");
    grid.querySelectorAll('[data-action="edit"]').forEach((el) => el.addEventListener("click", (e) => { e.preventDefault(); openProjectEditor(parseInt(el.dataset.id, 10)); }));
    grid.querySelectorAll('[data-action="delete"]').forEach((el) => el.addEventListener("click", () => {
      if (!confirm("این پروژه برای همیشه حذف شود؟")) return;
      patchOverlay((ov) => { ov.deletedProjects = (ov.deletedProjects || []).concat([parseInt(el.dataset.id, 10)]); });
      logActivity(`پروژه «${DB.projects.find((p) => p.id == el.dataset.id)?.title || ""}» حذف شد.`);
      showToast("پروژه حذف شد.");
      refreshAll();
    }));
  }
  function openProjectEditor(id) {
    const p = id ? DB.projects.find((x) => x.id === id) : null;
    const cats = DB.categories.filter((c) => c.type === "project");
    openModal(`
      <button class="modal-close-btn" data-close type="button">&times;</button>
      <h3>${p ? "ویرایش پروژه" : "پروژه جدید"}</h3>
      <div class="admin-form-grid">
        <div class="admin-form-row"><label class="field-label">عنوان</label><input type="text" id="mProjTitle" class="field-control" value="${p ? esc(p.title) : ""}"></div>
        <div class="admin-form-row"><label class="field-label">خلاصه</label><textarea id="mProjExcerpt" class="field-control" rows="2">${p ? esc(p.excerpt || "") : ""}</textarea></div>
        <div class="admin-form-row"><label class="field-label">آدرس تصویر شاخص</label><input type="text" id="mProjCover" class="field-control" value="${p ? esc(p.cover_image || "") : ""}"></div>
        <div class="admin-form-row"><label class="field-label">دسته‌بندی</label>
          <select id="mProjCategory" class="field-control"><option value="">— انتخاب کنید —</option>${cats.map((c) => `<option value="${c.id}" ${p && p.category_id === c.id ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select>
        </div>
        <div class="admin-form-row"><label class="field-label">وضعیت</label>
          <select id="mProjStatus" class="field-control">
            <option value="draft" ${p && p.status === "draft" ? "selected" : ""}>پیش‌نویس</option>
            <option value="published" ${!p || p.status === "published" ? "selected" : ""}>منتشر شده</option>
          </select>
        </div>
      </div>
      <div class="form-msg" id="mProjMsg"></div>
      <button class="btn-primary" id="mProjSave" style="margin-top:1rem;">${p ? "ذخیره تغییرات" : "ایجاد پروژه"}</button>
    `);
    document.getElementById("mProjSave").addEventListener("click", () => {
      const title = document.getElementById("mProjTitle").value.trim();
      if (!title) { document.getElementById("mProjMsg").textContent = "عنوان الزامی است."; return; }
      const cat = DB.categories.find((c) => c.id == document.getElementById("mProjCategory").value);
      const data = {
        title, excerpt: document.getElementById("mProjExcerpt").value.trim(),
        cover_image: document.getElementById("mProjCover").value.trim(),
        category_id: cat ? cat.id : null, category_name: cat ? cat.name : "", category_slug: cat ? cat.slug : "",
        status: document.getElementById("mProjStatus").value,
      };
      if (p) {
        patchOverlay((ov) => { ov.projectPatches = ov.projectPatches || {}; ov.projectPatches[p.id] = Object.assign({}, ov.projectPatches[p.id], data); });
        logActivity(`پروژه «${title}» ویرایش شد.`);
        showToast("تغییرات ذخیره شد.");
      } else {
        const id = newId();
        patchOverlay((ov) => {
          ov.newProjects = ov.newProjects || [];
          ov.newProjects.push(Object.assign({ id, slug: "project-" + id, views: 0, days_ago: 0, team: [] }, data));
        });
        logActivity(`پروژه «${title}» ایجاد شد.`);
        showToast("پروژه ایجاد شد.");
      }
      closeModal();
      refreshAll();
    });
  }

  /* ================= مقالات ================= */
  function articleRowHtml(a) {
    const thumb = a.cover_image ? `<img class="art-thumb" src="${esc(a.cover_image)}" alt="">` : `<span class="art-thumb art-thumb--empty">—</span>`;
    const cat = a.category_name ? `<span class="cat-badge">${esc(a.category_name)}</span>` : `<span class="cat-badge cat-badge--empty">بدون دسته</span>`;
    const statusBadge = a.status === "published"
      ? '<span class="status-badge status-badge--published">منتشر شده</span>'
      : '<span class="status-badge status-badge--draft">پیش‌نویس</span>';
    const previewBtn = a.status === "published"
      ? `<a class="icon-btn" target="_blank" href="../article.html?slug=${encodeURIComponent(a.slug)}" title="مشاهده در سایت"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12s3.5-7 9-7 9 7 9 7-3.5 7-9 7-9-7-9-7Z"/><circle cx="12" cy="12" r="3"/></svg></a>`
      : "";
    return `
      <tr data-id="${a.id}">
        <td>${thumb}</td>
        <td class="art-title-cell"><div class="art-title-text"><a href="#" data-action="edit" data-id="${a.id}">${esc(a.title)}</a></div></td>
        <td>${cat}</td>
        <td>${esc(a.author || "—")}</td>
        <td>${statusBadge}</td>
        <td>${esc((a.days_ago || 0) + " روز پیش")}</td>
        <td>${(a.views || 0).toLocaleString("fa-IR")}</td>
        <td><div class="art-actions">
          ${previewBtn}
          <button class="icon-btn" data-action="edit" data-id="${a.id}" title="ویرایش"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L18.5 9.5a2 2 0 0 0-4-4L4 16v4Z"/><path d="M13 6.5 17.5 11"/></svg></button>
          <button class="icon-btn icon-btn--danger" data-action="delete" data-id="${a.id}" title="حذف"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16"/><path d="M9 7V4.5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1V7"/><path d="M6 7l1 13a1.5 1.5 0 0 0 1.5 1.4h7a1.5 1.5 0 0 0 1.5-1.4L18 7"/></svg></button>
        </div></td>
      </tr>`;
  }
  function renderArticles() {
    const tbody = document.querySelector("#articlesTable tbody");
    const q = (document.getElementById("articleSearchInput").value || "").trim().toLowerCase();
    const catFilter = document.getElementById("articleCategoryFilter").value;
    const statusFilter = document.getElementById("articleStatusFilter").value;

    const blogCats = DB.categories.filter((c) => c.type === "blog");
    const catSelect = document.getElementById("articleCategoryFilter");
    if (!catSelect.dataset.filled) {
      catSelect.innerHTML = '<option value="">همه دسته‌بندی‌ها</option>' + blogCats.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join("");
      catSelect.dataset.filled = "1";
    }

    let list = DB.articles.slice();
    document.getElementById("artTotalCount").textContent = list.length.toLocaleString("fa-IR");
    document.getElementById("artPublishedCount").textContent = list.filter((a) => a.status === "published").length.toLocaleString("fa-IR");
    document.getElementById("artDraftCount").textContent = list.filter((a) => a.status === "draft").length.toLocaleString("fa-IR");

    if (q) list = list.filter((a) => a.title.toLowerCase().includes(q) || (a.author || "").toLowerCase().includes(q));
    if (catFilter) list = list.filter((a) => String(a.category_id) === catFilter);
    if (statusFilter) list = list.filter((a) => a.status === statusFilter);

    if (!list.length) { tbody.innerHTML = '<tr><td colspan="8" class="empty-state">مقاله‌ای یافت نشد.</td></tr>'; return; }
    tbody.innerHTML = list.map(articleRowHtml).join("");
    tbody.querySelectorAll('[data-action="edit"]').forEach((el) => el.addEventListener("click", (e) => { e.preventDefault(); openArticleEditor(parseInt(el.dataset.id, 10)); }));
    tbody.querySelectorAll('[data-action="delete"]').forEach((el) => el.addEventListener("click", () => {
      if (!confirm("این مقاله برای همیشه حذف شود؟")) return;
      patchOverlay((ov) => { ov.deletedArticles = (ov.deletedArticles || []).concat([parseInt(el.dataset.id, 10)]); });
      logActivity(`مقاله «${DB.articles.find((a) => a.id == el.dataset.id)?.title || ""}» حذف شد.`);
      showToast("مقاله حذف شد.");
      refreshAll();
    }));
  }
  function openArticleEditor(id) {
    const a = id ? DB.articles.find((x) => x.id === id) : null;
    const cats = DB.categories.filter((c) => c.type === "blog");
    openModal(`
      <button class="modal-close-btn" data-close type="button">&times;</button>
      <h3>${a ? "ویرایش مقاله" : "مقاله جدید"}</h3>
      <div class="admin-form-grid">
        <div class="admin-form-row"><label class="field-label">عنوان</label><input type="text" id="mArtTitle" class="field-control" value="${a ? esc(a.title) : ""}"></div>
        <div class="admin-form-row"><label class="field-label">خلاصه</label><textarea id="mArtExcerpt" class="field-control" rows="2">${a ? esc(a.excerpt || "") : ""}</textarea></div>
        <div class="admin-form-row"><label class="field-label">متن مقاله</label><textarea id="mArtContent" class="field-control" rows="6">${a ? esc(a.content || "") : ""}</textarea></div>
        <div class="admin-form-row"><label class="field-label">آدرس تصویر شاخص</label><input type="text" id="mArtCover" class="field-control" value="${a ? esc(a.cover_image || "") : ""}"></div>
        <div class="admin-form-row"><label class="field-label">دسته‌بندی</label>
          <select id="mArtCategory" class="field-control"><option value="">— انتخاب کنید —</option>${cats.map((c) => `<option value="${c.id}" ${a && a.category_id === c.id ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select>
        </div>
        <div class="admin-form-row"><label class="field-label">وضعیت</label>
          <select id="mArtStatus" class="field-control">
            <option value="draft" ${a && a.status === "draft" ? "selected" : ""}>پیش‌نویس</option>
            <option value="published" ${!a || a.status === "published" ? "selected" : ""}>منتشر شده</option>
          </select>
        </div>
      </div>
      <div class="form-msg" id="mArtMsg"></div>
      <button class="btn-primary" id="mArtSave" style="margin-top:1rem;">${a ? "ذخیره تغییرات" : "ایجاد مقاله"}</button>
    `, "modal-box--wide");
    document.getElementById("mArtSave").addEventListener("click", () => {
      const title = document.getElementById("mArtTitle").value.trim();
      if (!title) { document.getElementById("mArtMsg").textContent = "عنوان الزامی است."; return; }
      const cat = DB.categories.find((c) => c.id == document.getElementById("mArtCategory").value);
      const data = {
        title, excerpt: document.getElementById("mArtExcerpt").value.trim(),
        content: document.getElementById("mArtContent").value.trim(),
        cover_image: document.getElementById("mArtCover").value.trim(),
        category_id: cat ? cat.id : null, category_name: cat ? cat.name : "", category_slug: cat ? cat.slug : "",
        status: document.getElementById("mArtStatus").value,
      };
      if (a) {
        patchOverlay((ov) => { ov.articlePatches = ov.articlePatches || {}; ov.articlePatches[a.id] = Object.assign({}, ov.articlePatches[a.id], data); });
        logActivity(`مقاله «${title}» ویرایش شد.`);
        showToast("تغییرات ذخیره شد.");
      } else {
        const id = newId();
        patchOverlay((ov) => {
          ov.newArticles = ov.newArticles || [];
          ov.newArticles.push(Object.assign({ id, slug: "article-" + id, author: "سمیرا راد (دمو)", views: 0, days_ago: 0, reading_time: 3, tags: [] }, data));
        });
        logActivity(`مقاله «${title}» ایجاد شد.`);
        showToast("مقاله ایجاد شد.");
      }
      closeModal();
      refreshAll();
    });
  }

  /* ================= مدیریت دسته‌بندی‌ها (مشترک بین مقالات و پروژه‌ها) ================= */
  function openCategoryManager(type) {
    const title = type === "project" ? "مدیریت دسته‌بندی‌های پروژه" : "مدیریت دسته‌بندی‌ها";
    openModal(`
      <button class="modal-close-btn" data-close type="button">&times;</button>
      <h3>${title}</h3>
      <form class="inline-form" id="addCategoryForm">
        <input type="text" id="catNameInput" placeholder="نام دسته‌بندی" required minlength="2" maxlength="100">
        <button type="submit" class="btn-primary">افزودن</button>
      </form>
      <div class="form-msg" id="addCategoryMsg"></div>
      <div class="cat-tree" id="categoryTree"></div>
    `, "modal-box--wide");
    function renderTree() {
      const list = DB.categories.filter((c) => c.type === (type === "project" ? "project" : "blog") && !c.parent_id);
      const tree = document.getElementById("categoryTree");
      if (!list.length) { tree.innerHTML = '<div class="empty-state">هنوز دسته‌بندی‌ای ساخته نشده است.</div>'; return; }
      tree.innerHTML = list.map((c) => {
        const count = type === "project" ? DB.projects.filter((p) => p.category_id === c.id).length : DB.articles.filter((a) => a.category_id === c.id).length;
        return `<div class="cat-row" data-id="${c.id}">
          <div class="cat-row-main"><span class="cat-row-name">📁 ${esc(c.name)} <span class="cat-row-count">(${count} ${type === "project" ? "پروژه" : "مقاله"})</span></span>
          <div class="cat-row-actions"><button class="cat-row-del" data-id="${c.id}" title="حذف">&times;</button></div></div>
        </div>`;
      }).join("");
      tree.querySelectorAll(".cat-row-del").forEach((btn) => btn.addEventListener("click", () => {
        if (!confirm("این دسته‌بندی حذف شود؟")) return;
        patchOverlay((ov) => { ov.deletedCategories = (ov.deletedCategories || []).concat([parseInt(btn.dataset.id, 10)]); });
        showToast("دسته‌بندی حذف شد.");
        refreshAll(); renderTree();
      }));
    }
    renderTree();
    document.getElementById("addCategoryForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const name = document.getElementById("catNameInput").value.trim();
      if (!name) return;
      const id = newId();
      const slug = "cat-" + id;
      patchOverlay((ov) => {
        ov.newCategories = ov.newCategories || [];
        ov.newCategories.push({ id, name, slug, parent_id: null, type: type === "project" ? "project" : "blog" });
      });
      document.getElementById("catNameInput").value = "";
      showToast("دسته‌بندی اضافه شد.");
      refreshAll(); renderTree();
    });
  }

  /* ================= نظرات کاربران ================= */
  const STATUS_LABELS = { pending: "در انتظار تایید", approved: "تاییدشده", rejected: "رد شده" };
  function statusBadgeHtml(status) {
    const cls = status === "approved" ? "status-badge--published" : status === "rejected" ? "" : "status-badge--draft";
    const extra = status === "rejected" ? "background:var(--danger-bg); color:var(--danger);" : "";
    return `<span class="status-badge ${cls}" style="${extra}">${STATUS_LABELS[status] || status}</span>`;
  }
  function commentCardHtml(c) {
    const authorLabel = c.author_type === "admin"
      ? `<span class="cm-author cm-author--admin">${esc(c.author_name || "ادمین")} <span class="role-badge role-badge--comment_admin">پاسخ ادمین</span></span>`
      : `<span class="cm-author">${esc(c.author_name || "کاربر")}</span>`;
    const replyContext = c.parent_id ? `<div class="cm-reply-context">در پاسخ به ${esc(c.parent_author_name || "نظر دیگر")}</div>` : "";
    const actions = `
      <button class="btn-ghost btn-ghost--sm" data-action="reply" data-id="${c.id}">پاسخ</button>
      ${c.status !== "approved" ? `<button class="btn-ghost btn-ghost--sm" data-action="approve" data-id="${c.id}">تایید</button>` : ""}
      ${c.status !== "rejected" ? `<button class="btn-ghost btn-ghost--sm" data-action="reject" data-id="${c.id}">رد</button>` : ""}
      ${c.status !== "pending" ? `<button class="btn-ghost btn-ghost--sm" data-action="pending" data-id="${c.id}">در انتظار</button>` : ""}
      <button class="table-del-btn" data-action="delete" data-id="${c.id}">حذف</button>`;
    return `
      <div class="comment-card" data-id="${c.id}">
        <div class="comment-card-head">${authorLabel} ${statusBadgeHtml(c.status)} <span class="comment-card-date">${formatDate(c.hours_ago)}</span></div>
        ${replyContext}
        <p class="comment-card-text">${esc(c.content)}</p>
        <div class="comment-card-meta"><a href="../article.html?slug=${encodeURIComponent(c.article_slug)}" target="_blank" rel="noopener">${esc(c.article_title)}</a></div>
        <div class="comment-card-actions">${actions}</div>
      </div>`;
  }
  function renderComments() {
    const listEl = document.getElementById("commentsList");
    const q = (document.getElementById("commentSearchInput").value || "").trim().toLowerCase();
    const statusFilter = document.getElementById("commentStatusFilter").value;

    let list = flattenComments(DB);
    document.getElementById("cmTotalCount").textContent = list.length.toLocaleString("fa-IR");
    document.getElementById("cmPendingCount").textContent = list.filter((c) => c.status === "pending").length.toLocaleString("fa-IR");
    document.getElementById("cmApprovedCount").textContent = list.filter((c) => c.status === "approved").length.toLocaleString("fa-IR");
    const badge = document.getElementById("sidebarCommentsBadge");
    const pending = list.filter((c) => c.status === "pending").length;
    badge.textContent = pending; badge.style.display = pending > 0 ? "flex" : "none";

    if (q) list = list.filter((c) => c.content.toLowerCase().includes(q) || (c.author_name || "").toLowerCase().includes(q) || (c.article_title || "").toLowerCase().includes(q));
    if (statusFilter) list = list.filter((c) => c.status === statusFilter);

    if (!list.length) { listEl.innerHTML = '<div class="empty-state">نظری یافت نشد.</div>'; return; }
    listEl.innerHTML = list.map(commentCardHtml).join("");
    listEl.querySelectorAll("[data-action='approve']").forEach((btn) => btn.addEventListener("click", () => setCommentStatus(btn.dataset.id, "approved")));
    listEl.querySelectorAll("[data-action='reject']").forEach((btn) => btn.addEventListener("click", () => setCommentStatus(btn.dataset.id, "rejected")));
    listEl.querySelectorAll("[data-action='pending']").forEach((btn) => btn.addEventListener("click", () => setCommentStatus(btn.dataset.id, "pending")));
    listEl.querySelectorAll("[data-action='delete']").forEach((btn) => btn.addEventListener("click", () => {
      if (!confirm("این نظر برای همیشه حذف شود؟")) return;
      patchOverlay((ov) => { ov.deletedComments = (ov.deletedComments || []).concat([btn.dataset.id]); ov.deletedPending = (ov.deletedPending || []).concat([parseInt(btn.dataset.id, 10)]); });
      showToast("نظر حذف شد.");
      refreshAll();
    }));
    listEl.querySelectorAll("[data-action='reply']").forEach((btn) => btn.addEventListener("click", () => openCommentReply(btn.dataset.id)));
  }
  function setCommentStatus(id, status) {
    patchOverlay((ov) => { ov.commentStatus = Object.assign({}, ov.commentStatus, { [id]: status }); });
    showToast(status === "approved" ? "نظر تایید شد." : status === "rejected" ? "نظر رد شد." : "نظر در انتظار قرار گرفت.");
    refreshAll();
  }
  function openCommentReply(id) {
    const list = flattenComments(DB);
    const c = list.find((x) => String(x.id) === String(id));
    if (!c) return;
    document.getElementById("commentReplyTarget").textContent = (c.author_name || "کاربر") + " — " + esc(c.article_title);
    document.getElementById("commentReplyOriginalText").textContent = c.content;
    document.getElementById("commentReplyText").value = "";
    document.getElementById("commentReplyMsg").textContent = "";
    const modal = document.getElementById("commentReplyModal");
    modal.classList.add("is-open");
    const form = document.getElementById("commentReplyForm");
    form.onsubmit = (e) => {
      e.preventDefault();
      const text = document.getElementById("commentReplyText").value.trim();
      if (!text) return;
      patchOverlay((ov) => {
        ov.commentReplies = ov.commentReplies || [];
        ov.commentReplies.push({ id: newId(), parent_id: c.id, article_id: c.article_id, author_type: "admin", admin_id: DB.admins[0].id, content: text, hours_ago: 0 });
        ov.commentStatus = Object.assign({}, ov.commentStatus, { [c.id]: "approved" });
      });
      modal.classList.remove("is-open");
      showToast("پاسخ ارسال شد.");
      refreshAll();
    };
  }

  /* ================= تنظیمات: پروفایل ================= */
  function fillProfileForm() {
    const me = DB.admins[0];
    document.getElementById("currentAdminName").textContent = me.display_name;
    document.getElementById("profileDisplayName").value = me.display_name || "";
    document.getElementById("profileBioShort").value = me.bio_short || "";
    document.getElementById("profileBioFull").value = me.bio_full || "";
    document.getElementById("profileTelegram").value = me.social_telegram || "";
    document.getElementById("profileInstagram").value = me.social_instagram || "";
    document.getElementById("profileEmail").value = me.social_email || "";
    document.getElementById("profilePhone").value = me.social_phone || "";
    document.getElementById("profileLinkedin").value = me.social_linkedin || "";
    document.getElementById("profileX").value = me.social_x || "";
    const preview = document.getElementById("profileAvatarPreview");
    const placeholder = document.getElementById("profileAvatarPlaceholder");
    if (me.avatar) { preview.src = me.avatar; preview.style.display = "block"; placeholder.style.display = "none"; }
  }
  function initProfileSettings() {
    document.getElementById("saveProfileBtn").addEventListener("click", () => {
      const data = {
        display_name: document.getElementById("profileDisplayName").value.trim(),
        bio_short: document.getElementById("profileBioShort").value.trim(),
        bio_full: document.getElementById("profileBioFull").value.trim(),
        social_telegram: document.getElementById("profileTelegram").value.trim(),
        social_instagram: document.getElementById("profileInstagram").value.trim(),
        social_email: document.getElementById("profileEmail").value.trim(),
        social_phone: document.getElementById("profilePhone").value.trim(),
        social_linkedin: document.getElementById("profileLinkedin").value.trim(),
        social_x: document.getElementById("profileX").value.trim(),
      };
      patchOverlay((ov) => { ov.profile = Object.assign({}, ov.profile, data); });
      showToast("پروفایل ذخیره شد.");
      refreshAll();
    });
    document.getElementById("changePasswordForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const cur = e.target.current_password.value;
      const msg = document.getElementById("changePasswordMsg");
      if (cur !== DEMO_PASS) { msg.textContent = "رمز عبور فعلی اشتباه است."; msg.style.color = "var(--danger)"; return; }
      msg.textContent = "در حالت دمو، رمز عبور واقعاً تغییر نمی‌کند.";
      msg.style.color = "var(--text-mute)";
      e.target.reset();
    });
  }

  /* ================= تنظیمات: ادمین‌ها ================= */
  function renderAdminsTable() {
    const tbody = document.querySelector("#adminsTable tbody");
    const list = DB.admins;
    if (!list.length) { tbody.innerHTML = '<tr><td colspan="4" class="empty-state">ادمینی یافت نشد.</td></tr>'; return; }
    tbody.innerHTML = list.map((a, i) => `
      <tr>
        <td>${esc(a.display_name || a.username)}${i === 0 ? '<span class="you-tag">شما</span>' : ""}</td>
        <td><span class="role-badge role-badge--${i === 0 ? "super_admin" : "admin"}">${roleLabel(i === 0 ? "super_admin" : "admin")}</span></td>
        <td>${esc(a.created_note || "—")}</td>
        <td class="admins-table-actions">${i === 0 ? '<span class="perm-locked-note">سوپر ادمین</span>' : `<button class="table-del-btn" data-id="${a.id}">حذف</button>`}</td>
      </tr>`).join("");
    tbody.querySelectorAll(".table-del-btn").forEach((btn) => btn.addEventListener("click", () => {
      if (!confirm("این ادمین حذف شود؟")) return;
      patchOverlay((ov) => { ov.deletedAdmins = (ov.deletedAdmins || []).concat([parseInt(btn.dataset.id, 10)]); });
      showToast("ادمین حذف شد.");
      refreshAll();
    }));
  }
  function initAddAdminForm() {
    document.getElementById("addAdminForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const username = document.getElementById("newAdminUsername").value.trim();
      if (!username) return;
      const id = newId();
      patchOverlay((ov) => {
        ov.newAdmins = ov.newAdmins || [];
        ov.newAdmins.push({
          id, username, display_name: username,
          avatar: `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(username)}`,
          role: document.getElementById("newAdminRole").value, created_note: "همین الان",
        });
      });
      document.getElementById("addAdminMsg").textContent = "ادمین جدید اضافه شد.";
      e.target.reset();
      showToast("ادمین اضافه شد.");
      refreshAll();
    });
  }

  /* ================= تنظیمات: سایت ================= */
  function fillSiteSettings() {
    document.getElementById("commentsAutoApproveToggle").checked = DB.settings.comments_auto_approve === "1";
    document.getElementById("maintenanceModeToggle").checked = DB.settings.maintenance_mode === "1";
    document.getElementById("maintenanceMessageInput").value = DB.settings.maintenance_message || "";
  }
  function initSiteSettings() {
    document.getElementById("commentsAutoApproveToggle").addEventListener("change", (e) => {
      patchOverlay((ov) => { ov.settings = Object.assign({}, ov.settings, { comments_auto_approve: e.target.checked ? "1" : "0" }); });
      showToast("تنظیمات ذخیره شد.");
      refreshAll();
    });
    document.getElementById("saveMaintenanceBtn").addEventListener("click", () => {
      const on = document.getElementById("maintenanceModeToggle").checked;
      const message = document.getElementById("maintenanceMessageInput").value.trim();
      patchOverlay((ov) => { ov.settings = Object.assign({}, ov.settings, { maintenance_mode: on ? "1" : "0", maintenance_message: message }); });
      document.getElementById("maintenanceMsg").textContent = "تنظیمات حالت تعمیرات ذخیره شد.";
      showToast("ذخیره شد.");
    });
  }

  /* ================= تنظیمات: آمار و گزارش ================= */
  function renderVisitStats() {
    const stats = DB.visit_stats;
    document.getElementById("visitStatsCards").innerHTML = `
      <div class="stat-card"><div class="stat-card-num">${(stats.total || 0).toLocaleString("fa-IR")}</div><div class="stat-card-label">کل بازدیدها</div></div>
      <div class="stat-card"><div class="stat-card-num">${(stats.today || 0).toLocaleString("fa-IR")}</div><div class="stat-card-label">بازدید امروز</div></div>`;
    const days = stats.last_7_days || [];
    const max = Math.max(1, ...days.map((d) => d.count));
    document.getElementById("visitChart").innerHTML =
      '<div class="visit-chart-title">بازدید ۷ روز اخیر</div><div class="visit-chart-bars">' +
      days.map((d) => {
        const h = Math.round((d.count / max) * 100);
        return `<div class="visit-bar-col" title="${d.count} بازدید">
          <div class="visit-bar" style="height:${Math.max(h, 3)}%"></div>
          <div class="visit-bar-count">${d.count}</div>
          <div class="visit-bar-label">${d.offset_days} روز پیش</div>
        </div>`;
      }).join("") + "</div>";
    const pages = stats.top_pages || [];
    document.getElementById("topPagesList").innerHTML = !pages.length
      ? '<div class="empty-state">هنوز بازدیدی ثبت نشده است.</div>'
      : '<div class="visit-chart-title">پربازدیدترین صفحات</div><ul class="top-pages-list">' +
        pages.map((p) => `<li><span class="top-page-path">${esc(p.page_path)}</span><span class="top-page-count">${p.count.toLocaleString("fa-IR")}</span></li>`).join("") + "</ul>";
  }
  function renderActivityLog() {
    const wrap = document.getElementById("activityLogList");
    const logs = (DB.extraActivity || []).concat(DB.activity_log || []);
    if (!logs.length) { wrap.innerHTML = '<div class="empty-state">هنوز رویدادی ثبت نشده است.</div>'; return; }
    wrap.innerHTML = logs.map((log) => `
      <div class="log-item">
        <div class="log-item-top"><span class="log-action">${esc(log.description)}</span><span class="log-date">${log.justNow ? "لحظاتی پیش" : formatDate(log.hours_ago)}</span></div>
        <div class="log-meta">${log.admin_username ? `<span>کاربر: ${esc(log.admin_username)}</span>` : ""}</div>
      </div>`).join("");
  }

  /* ================= تنظیمات: پشتیبان‌گیری ================= */
  function initBackup() {
    document.getElementById("downloadBackupBtn").addEventListener("click", () => {
      const blob = new Blob([JSON.stringify(DB, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "resa-demo-backup.json"; a.click();
      URL.revokeObjectURL(url);
      document.getElementById("backupMsg").textContent = "فایل پشتیبان دانلود شد.";
      showToast("پشتیبان دانلود شد.");
    });
    document.getElementById("restoreBackupForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const file = document.getElementById("restoreBackupFile").files[0];
      const msg = document.getElementById("restoreBackupMsg");
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result);
          localStorage.removeItem(LS_OVERLAY);
          patchOverlay((ov) => {
            ov.site = data.site; ov.settings = data.settings;
            ov.newArticles = data.articles; ov.newProjects = data.projects;
          });
          msg.textContent = "بازیابی با موفقیت انجام شد.";
          showToast("داده‌ها بازیابی شد.");
          refreshAll();
        } catch (err) {
          msg.textContent = "فایل انتخاب‌شده معتبر نیست.";
          msg.style.color = "var(--danger)";
        }
      };
      reader.readAsText(file);
    });
    document.getElementById("resetDemoBtn").addEventListener("click", () => {
      if (!confirm("همه‌ی تغییرات محلی پنل مدیریت پاک شود؟")) return;
      localStorage.removeItem(LS_OVERLAY);
      showToast("داده‌های دمو بازنشانی شد.");
      refreshAll();
    });
  }

  /* ---------- مودال عمومی ---------- */
  function openModal(html, extraClass) {
    const box = document.getElementById("modalBox");
    box.className = "modal-box" + (extraClass ? " " + extraClass : "");
    box.innerHTML = html;
    document.getElementById("modalOverlay").classList.add("is-open");
    box.querySelectorAll("[data-close]").forEach((btn) => btn.addEventListener("click", closeModal));
  }
  function closeModal() { document.getElementById("modalOverlay").classList.remove("is-open"); }
  document.getElementById("modalOverlay").addEventListener("click", (e) => { if (e.target.id === "modalOverlay") closeModal(); });
  document.getElementById("modalCloseBtn").addEventListener("click", () => document.getElementById("messageModal").classList.remove("is-open"));
  document.getElementById("messageModal").addEventListener("click", (e) => { if (e.target.id === "messageModal") e.currentTarget.classList.remove("is-open"); });
  document.getElementById("commentReplyCloseBtn").addEventListener("click", () => document.getElementById("commentReplyModal").classList.remove("is-open"));
  document.getElementById("commentReplyModal").addEventListener("click", (e) => { if (e.target.id === "commentReplyModal") e.currentTarget.classList.remove("is-open"); });

  /* ---------- بروزرسانی همه‌چیز پس از هر تغییر ---------- */
  function refreshAll() {
    loadDb().then(() => {
      renderMessages();
      renderProjects();
      renderArticles();
      renderComments();
      fillProfileForm();
      renderAdminsTable();
      fillSiteSettings();
      renderVisitStats();
      renderActivityLog();
    });
  }

  ["refreshMessagesBtn"].forEach((id) => document.getElementById(id)?.addEventListener("click", () => { refreshAll(); showToast("بروزرسانی شد."); }));
  document.getElementById("refreshCommentsBtn").addEventListener("click", () => { refreshAll(); showToast("بروزرسانی شد."); });
  document.getElementById("newProjectBtn").addEventListener("click", () => openProjectEditor(null));
  document.getElementById("newArticleBtn").addEventListener("click", () => openArticleEditor(null));
  document.getElementById("manageProjectCategoriesBtn").addEventListener("click", () => openCategoryManager("project"));
  document.getElementById("manageCategoriesBtn").addEventListener("click", () => openCategoryManager("blog"));
  ["projectSearchInput", "projectCategoryFilter", "projectStatusFilter"].forEach((id) => {
    const el = document.getElementById(id);
    el.addEventListener(el.tagName === "SELECT" ? "change" : "input", renderProjects);
  });
  ["articleSearchInput", "articleCategoryFilter", "articleStatusFilter"].forEach((id) => {
    const el = document.getElementById(id);
    el.addEventListener(el.tagName === "SELECT" ? "change" : "input", renderArticles);
  });
  ["commentSearchInput", "commentStatusFilter"].forEach((id) => {
    const el = document.getElementById(id);
    el.addEventListener(el.tagName === "SELECT" ? "change" : "input", renderComments);
  });

  /* ---------------- بوت ---------------- */
  function boot() {
    loginScreen.classList.add("hidden");
    app.classList.remove("hidden");
    body.classList.remove("login-body");

    initSidebarTabs();
    initMobileMenu();
    initSettingsSubtabs();
    initProfileSettings();
    initAddAdminForm();
    initSiteSettings();
    initBackup();

    refreshAll();
  }

  if (isLoggedIn()) boot();
})();
