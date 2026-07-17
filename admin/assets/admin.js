/* =========================================================
   admin.js — پنل ادمین رسا
   ========================================================= */

   (function () {
    "use strict";
  
    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || "";
    const canDeleteMessages = document.querySelector('meta[name="can-delete-messages"]')?.content === "1";
    const tabTitles = {
      messages: "پیام‌های تماس با ما",
      projects: "مدیریت پروژه‌ها",
      articles: "مدیریت مقالات",
      comments: "نظرات کاربران",
      settings: "تنظیمات",
    };
    const ROLE_LABELS = {
      super_admin: "سوپر ادمین",
      admin: "ادمین",
    };
  
    function roleLabel(role) {
      return ROLE_LABELS[role] || ROLE_LABELS.admin;
    }
  
    document.addEventListener("DOMContentLoaded", () => {
      const steps = [
        ["initSidebarTabs", initSidebarTabs],
        ["initMobileMenu", initMobileMenu],
        ["initSettingsSubtabs", initSettingsSubtabs],
        ["loadMessages", loadMessages],
        ["loadAdmins", loadAdmins],
        ["initAddAdminForm", initAddAdminForm],
        ["initEditAdminModal", initEditAdminModal],
        ["initChangePasswordForm", initChangePasswordForm],
        ["initModal", initModal],
        ["initProfileSettings", initProfileSettings],
      ];
      steps.forEach(([name, fn]) => {
        try {
          fn();
        } catch (err) {
          console.error("[admin] " + name + " failed:", err);
        }
      });
    });
  
    /* ---------------------------------------------------------
       Toast helper
    --------------------------------------------------------- */
    function showToast(message, isError) {
      const toast = document.getElementById("toast");
      if (!toast) return;
      toast.textContent = message;
      toast.classList.toggle("is-error", !!isError);
      toast.classList.add("is-visible");
      clearTimeout(showToast._t);
      showToast._t = setTimeout(() => toast.classList.remove("is-visible"), 3200);
    }
  
    /* ---------------------------------------------------------
       API helper
    --------------------------------------------------------- */
    async function apiCall(url, body) {
      const opts = {
        method: body ? "POST" : "GET",
        headers: { "X-CSRF-Token": csrfToken },
      };
      if (body) {
        opts.headers["Content-Type"] = "application/json";
        opts.body = JSON.stringify(body);
      }
      const res = await fetch(url, opts);
      let data;
      try {
        data = await res.json();
      } catch (e) {
        throw new Error("پاسخ نامعتبر از سرور دریافت شد.");
      }
      if (!res.ok && !data) throw new Error("خطای ارتباط با سرور.");
      return data;
    }
  
    /* ---------------------------------------------------------
       Sidebar tabs
    --------------------------------------------------------- */
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
  
    /* ---------------------------------------------------------
       Settings — iOS-style list / drill-down navigation
    --------------------------------------------------------- */
    const settingsRowTitles = {
      profile: "پروفایل و امنیت",
      admins: "ادمین‌ها",
      site: "سایت",
      stats: "آمار و گزارش",
      backup: "پشتیبان‌گیری",
    };

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
        document.dispatchEvent(new CustomEvent("settings-subtab-open", { detail: { target } }));
        wrap.scrollIntoView({ behavior: "smooth", block: "start" });
      }

      rows.forEach((row) => {
        row.addEventListener("click", () => openSubtab(row.dataset.subtab));
      });

      backBtn?.addEventListener("click", () => {
        wrap.classList.remove("is-drilled");
      });
    }
  
    function initMobileMenu() {
      const btn = document.getElementById("mobileMenuBtn");
      const sidebar = document.querySelector(".admin-sidebar");
      const backdrop = document.getElementById("sidebarBackdrop");
      if (!btn || !sidebar) return;
  
      function closeSidebar() {
        sidebar.classList.remove("is-open");
        backdrop?.classList.remove("is-open");
      }
      function toggleSidebar() {
        sidebar.classList.toggle("is-open");
        backdrop?.classList.toggle("is-open");
      }
  
      btn.addEventListener("click", toggleSidebar);
      backdrop?.addEventListener("click", closeSidebar);
      document.addEventListener("click", (e) => {
        if (sidebar.classList.contains("is-open") && !sidebar.contains(e.target) && e.target !== btn && !btn.contains(e.target)) {
          closeSidebar();
        }
      });
    }
  
    /* ---------------------------------------------------------
       Messages tab
    --------------------------------------------------------- */
    let messagesCache = [];
  
    async function loadMessages() {
      const listEl = document.getElementById("messagesList");
      if (!listEl) return;
      try {
        const data = await apiCall("api/messages_list.php");
        if (!data.ok) throw new Error(data.message || "خطا در دریافت پیام‌ها.");
  
        messagesCache = data.data.messages;
        renderMessages(messagesCache);
        updateUnreadUI(data.data.unread_count, data.data.total_count);
      } catch (err) {
        listEl.innerHTML = '<div class="empty-state">خطا در بارگذاری پیام‌ها. صفحه را رفرش کنید.</div>';
      }
    }
  
    function updateUnreadUI(unread, total) {
      const badge = document.getElementById("sidebarUnreadBadge");
      const unreadEl = document.getElementById("msgUnreadCount");
      const totalEl = document.getElementById("msgTotalCount");
      if (unreadEl) unreadEl.textContent = unread;
      if (totalEl) totalEl.textContent = total;
      if (badge) {
        badge.textContent = unread;
        badge.style.display = unread > 0 ? "flex" : "none";
      }
    }
  
    function renderMessages(list) {
      const listEl = document.getElementById("messagesList");
      if (!list.length) {
        listEl.innerHTML = '<div class="empty-state">هنوز پیامی دریافت نشده است.</div>';
        return;
      }
      listEl.innerHTML = list.map((m) => messageCardHtml(m)).join("");
  
      listEl.querySelectorAll(".message-card").forEach((card) => {
        card.addEventListener("click", (e) => {
          if (e.target.closest(".icon-btn")) return;
          openMessageModal(parseInt(card.dataset.id, 10));
        });
      });
      listEl.querySelectorAll("[data-action='toggle-read']").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          toggleRead(parseInt(btn.dataset.id, 10), btn.dataset.next === "1");
        });
      });
      listEl.querySelectorAll("[data-action='delete']").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          deleteMessage(parseInt(btn.dataset.id, 10));
        });
      });
    }
  
    function escapeHtml(str) {
      const div = document.createElement("div");
      div.textContent = str ?? "";
      return div.innerHTML;
    }
  
    function formatDate(isoLike) {
      try {
        const d = new Date(isoLike.replace(" ", "T"));
        return d.toLocaleString("fa-IR", { dateStyle: "medium", timeStyle: "short" });
      } catch (e) {
        return isoLike;
      }
    }
  
    function messageCardHtml(m) {
      const unreadClass = m.is_read ? "" : "is-unread";
      const nextRead = m.is_read ? "0" : "1";
      const readIcon = m.is_read
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12s3.5-7 9-7 9 7 9 7-3.5 7-9 7-9-7-9-7Z"/><circle cx="12" cy="12" r="3"/></svg>'
        : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 5.5 20.5 18.5"/><path d="M9.9 6.6C10.6 6.2 11.3 6 12 6c5.5 0 9 6 9 6a15 15 0 0 1-3.1 3.6M6.5 8C4.4 9.5 3 12 3 12s3.5 6 9 6c1 0 2-.2 2.9-.5"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>';
  
      return `
        <div class="message-card ${unreadClass}" data-id="${m.id}">
          <div class="message-main">
            <div class="message-name">${escapeHtml(m.full_name)}</div>
            <div class="message-contact">${escapeHtml(m.contact_info)}</div>
            <div class="message-preview">${escapeHtml(m.message)}</div>
            <div class="message-date">${formatDate(m.created_at)}</div>
          </div>
          <div class="message-actions">
            <button class="icon-btn" data-action="toggle-read" data-id="${m.id}" data-next="${nextRead}" title="${m.is_read ? "علامت‌گذاری به‌عنوان نخوانده" : "علامت‌گذاری به‌عنوان خوانده‌شده"}">${readIcon}</button>
            ${
              canDeleteMessages
                ? `<button class="icon-btn icon-btn--danger" data-action="delete" data-id="${m.id}" title="حذف پیام">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16"/><path d="M9 7V4.5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1V7"/><path d="M6 7l1 13a1.5 1.5 0 0 0 1.5 1.4h7a1.5 1.5 0 0 0 1.5-1.4L18 7"/></svg>
            </button>`
                : ""
            }
          </div>
        </div>`;
    }
  
    async function toggleRead(id, nextRead) {
      try {
        const data = await apiCall("api/messages_mark_read.php", { id, read: nextRead });
        if (!data.ok) throw new Error(data.message);
        await loadMessages();
      } catch (err) {
        showToast(err.message || "خطا در بروزرسانی پیام.", true);
      }
    }
  
    async function deleteMessage(id) {
      if (!confirm("آیا از حذف این پیام مطمئن هستید؟")) return;
      try {
        const data = await apiCall("api/messages_delete.php", { id });
        if (!data.ok) throw new Error(data.message);
        showToast("پیام حذف شد.");
        await loadMessages();
        closeModal();
      } catch (err) {
        showToast(err.message || "خطا در حذف پیام.", true);
      }
    }
  
    document.getElementById && document.addEventListener("DOMContentLoaded", () => {
      const refreshBtn = document.getElementById("refreshMessagesBtn");
      if (refreshBtn) refreshBtn.addEventListener("click", loadMessages);
    });
  
    /* ---------------------------------------------------------
       Modal
    --------------------------------------------------------- */
    function initModal() {
      const closeBtn = document.getElementById("modalCloseBtn");
      const backdrop = document.getElementById("messageModal");
      if (closeBtn) closeBtn.addEventListener("click", closeModal);
      if (backdrop) {
        backdrop.addEventListener("click", (e) => {
          if (e.target === backdrop) closeModal();
        });
      }
    }
  
    function openMessageModal(id) {
      const m = messagesCache.find((x) => x.id === id);
      if (!m) return;
      document.getElementById("modalSenderName").textContent = m.full_name;
      document.getElementById("modalMeta").textContent = m.contact_info + " — " + formatDate(m.created_at);
      document.getElementById("modalMessageText").textContent = m.message;
      document.getElementById("messageModal").classList.add("is-open");
      if (!m.is_read) toggleRead(id, true);
    }
  
    function closeModal() {
      document.getElementById("messageModal").classList.remove("is-open");
    }
  
    /* ---------------------------------------------------------
       Settings: admins management
    --------------------------------------------------------- */
    let adminsListCache = [];
    const viewerRole = document.querySelector('meta[name="admin-role"]')?.content || "admin";
    const viewerIsSuperAdmin = viewerRole === "super_admin";
  
    async function loadAdmins() {
      const tbody = document.querySelector("#adminsTable tbody");
      if (!tbody) return;
      try {
        const data = await apiCall("api/admins_list.php");
        if (!data.ok) throw new Error(data.message);
        adminsListCache = data.data.admins;
        renderAdmins(adminsListCache);
      } catch (err) {
        tbody.innerHTML = '<tr><td colspan="4" class="empty-state">خطا در بارگذاری فهرست ادمین‌ها.</td></tr>';
      }
    }
  
    function renderAdmins(admins) {
      const tbody = document.querySelector("#adminsTable tbody");
      if (!admins.length) {
        tbody.innerHTML = '<tr><td colspan="4" class="empty-state">ادمینی یافت نشد.</td></tr>';
        return;
      }
      tbody.innerHTML = admins
        .map((a) => {
          const isProtected = a.role === "super_admin" && !viewerIsSuperAdmin;
          const actionsHtml = isProtected
            ? '<span class="perm-locked-note">فقط سوپر ادمین</span>'
            : `<button class="btn-ghost--sm" data-edit-id="${a.id}">ویرایش</button>
               <button class="table-del-btn" data-id="${a.id}" ${a.is_you ? "disabled" : ""}>حذف</button>`;
          return `
        <tr>
          <td>${escapeHtml(a.display_name || a.username)}${a.is_you ? '<span class="you-tag">شما</span>' : ""}</td>
          <td><span class="role-badge role-badge--${a.role}">${roleLabel(a.role)}</span></td>
          <td>${formatDate(a.created_at)}</td>
          <td class="admins-table-actions">${actionsHtml}</td>
        </tr>`;
        })
        .join("");
  
      tbody.querySelectorAll(".table-del-btn").forEach((btn) => {
        btn.addEventListener("click", () => deleteAdmin(parseInt(btn.dataset.id, 10)));
      });
      tbody.querySelectorAll("[data-edit-id]").forEach((btn) => {
        btn.addEventListener("click", () => openEditAdminModal(parseInt(btn.dataset.editId, 10)));
      });
    }
  
    /* ---------------------------------------------------------
       Settings: edit any admin's username/password/permissions
    --------------------------------------------------------- */
    function openEditAdminModal(id) {
      const modal = document.getElementById("editAdminModal");
      if (!modal) return;
      const admin = adminsListCache.find((a) => a.id === id);
      if (!admin) return;
  
      document.getElementById("editAdminId").value = id;
      document.getElementById("editAdminUsername").value = "";
      document.getElementById("editAdminPassword").value = "";
      document.getElementById("editAdminTarget").textContent = `ویرایش «${admin.display_name || admin.username}» — فیلد خالی تغییر نمی‌کند.`;
      document.getElementById("editAdminMsg").textContent = "";
      document.getElementById("editAdminMsg").className = "form-msg";
  
      const permWrap = document.getElementById("editAdminPermissionsWrap");
      if (admin.role === "super_admin") {
        if (permWrap) permWrap.style.display = "none";
      } else {
        if (permWrap) {
          permWrap.style.display = "block";
          fillPermissions(permWrap, admin.permissions);
        }
      }
  
      modal.classList.add("is-open");
    }
  
    function initEditAdminModal() {
      const modal = document.getElementById("editAdminModal");
      const closeBtn = document.getElementById("editAdminCloseBtn");
      const form = document.getElementById("editAdminForm");
      if (!modal || !form) return;
  
      closeBtn?.addEventListener("click", () => modal.classList.remove("is-open"));
      modal.addEventListener("click", (e) => {
        if (e.target === modal) modal.classList.remove("is-open");
      });
  
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const msgEl = document.getElementById("editAdminMsg");
        msgEl.textContent = "";
        msgEl.className = "form-msg";
  
        const id = parseInt(document.getElementById("editAdminId").value, 10);
        const username = document.getElementById("editAdminUsername").value.trim();
        const password = document.getElementById("editAdminPassword").value;
        const admin = adminsListCache.find((a) => a.id === id);
        const permWrap = document.getElementById("editAdminPermissionsWrap");
        const includePermissions = admin && admin.role !== "super_admin";
  
        if (!username && !password && !includePermissions) {
          msgEl.textContent = "حداقل یکی از فیلدها را پر کنید.";
          msgEl.classList.add("is-error");
          return;
        }
  
        const payload = { id, username, password };
        if (includePermissions) {
          payload.permissions = collectPermissions(permWrap);
        }
  
        try {
          const data = await apiCall("api/admins_update.php", payload);
          if (!data.ok) throw new Error(data.message);
          showToast(data.message || "اطلاعات ادمین بروزرسانی شد.");
          modal.classList.remove("is-open");
          await loadAdmins();
        } catch (err) {
          msgEl.textContent = err.message || "خطا در بروزرسانی اطلاعات ادمین.";
          msgEl.classList.add("is-error");
        }
      });
    }
  
    async function deleteAdmin(id) {
      if (!confirm("آیا از حذف این ادمین مطمئن هستید؟")) return;
      try {
        const data = await apiCall("api/admins_delete.php", { id });
        if (!data.ok) throw new Error(data.message);
        showToast("ادمین حذف شد.");
        await loadAdmins();
      } catch (err) {
        showToast(err.message || "خطا در حذف ادمین.", true);
      }
    }
  
    /* ---------------------------------------------------------
       Permission-panel helpers
    --------------------------------------------------------- */
    function collectPermissions(container) {
      if (!container) return null;
      const chk = (sel) => !!container.querySelector(`[data-perm="${sel}"]`)?.checked;
      const scopeRadio = container.querySelector('input[data-perm="blog.scope"]:checked');
      const projectsScopeRadio = container.querySelector('input[data-perm="projects.scope"]:checked');
      const commentsScopeRadio = container.querySelector('input[data-perm="comments.scope"]:checked');
      return {
        messages: { view: chk("messages.view"), delete: chk("messages.delete") },
        projects: {
          access: chk("projects.access"),
          scope: projectsScopeRadio ? projectsScopeRadio.value : "own",
          manage_categories: chk("projects.manage_categories"),
        },
        blog: {
          access: chk("blog.access"),
          scope: scopeRadio ? scopeRadio.value : "own",
          manage_categories: chk("blog.manage_categories"),
        },
        comments: {
          access: chk("comments.access"),
          scope: commentsScopeRadio ? commentsScopeRadio.value : "own",
        },
        settings: { manage_admins: chk("settings.manage_admins") },
      };
    }
  
    function fillPermissions(container, perms) {
      if (!container || !perms) return;
      const set = (sel, val) => {
        const el = container.querySelector(`[data-perm="${sel}"]`);
        if (el) el.checked = !!val;
      };
      set("messages.view", perms.messages?.view);
      set("messages.delete", perms.messages?.delete);
      set("projects.access", perms.projects?.access);
      set("projects.manage_categories", perms.projects?.manage_categories);
      const projectsScope = perms.projects?.scope === "all" ? "all" : "own";
      const projectsRadio = container.querySelector(`input[data-perm="projects.scope"][value="${projectsScope}"]`);
      if (projectsRadio) projectsRadio.checked = true;
      set("blog.access", perms.blog?.access);
      set("blog.manage_categories", perms.blog?.manage_categories);
      const scope = perms.blog?.scope === "all" ? "all" : "own";
      const radio = container.querySelector(`input[data-perm="blog.scope"][value="${scope}"]`);
      if (radio) radio.checked = true;
      set("comments.access", perms.comments?.access);
      const commentsScope = perms.comments?.scope === "all" ? "all" : "own";
      const commentsRadio = container.querySelector(`input[data-perm="comments.scope"][value="${commentsScope}"]`);
      if (commentsRadio) commentsRadio.checked = true;
      set("settings.manage_admins", perms.settings?.manage_admins);
    }
  
    function defaultNewAdminPermissions() {
      return {
        messages: { view: false, delete: false },
        projects: { access: false, scope: "own", manage_categories: false },
        blog: { access: true, scope: "own", manage_categories: false },
        comments: { access: false, scope: "own" },
        settings: { manage_admins: false },
      };
    }
  
    /* =========================================================
       فرم افزودن ادمین
       ========================================================= */
    function initAddAdminForm() {
      const form = document.getElementById("addAdminForm");
      const msgEl = document.getElementById("addAdminMsg");
      if (!form) return;
  
      const roleSelect = document.getElementById("newAdminRole");
      const permWrap = document.getElementById("newAdminPermissionsWrap");
  
      if (permWrap) {
        fillPermissions(permWrap, defaultNewAdminPermissions());
        // پیش‌فرض همیشه نمایش داده شود؛ اگر انتخاب‌گر نقش وجود نداشته باشد
        // (یعنی کاربر سوپر ادمین نیست)، این پنل باید همیشه دیده شود.
        permWrap.style.display = "block";
      }
  
      function toggleRolePanels() {
        if (!roleSelect || !permWrap) return;
        const isSuper = roleSelect.value === "super_admin";
        permWrap.style.display = isSuper ? "none" : "block";
      }
  
      roleSelect?.addEventListener("change", toggleRolePanels);
      toggleRolePanels();
  
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        msgEl.textContent = "";
        msgEl.className = "form-msg";
  
        const username = form.username.value.trim();
        const password = form.password.value;
        const role = roleSelect ? roleSelect.value : "admin";
  
        if (!username || username.length < 3) {
          msgEl.textContent = "نام کاربری باید حداقل ۳ کاراکتر باشد.";
          msgEl.classList.add("is-error");
          return;
        }
        if (!password || password.length < 8) {
          msgEl.textContent = "رمز عبور باید حداقل ۸ کاراکتر باشد.";
          msgEl.classList.add("is-error");
          return;
        }
  
        const payload = { username, password, role };
        if (role !== "super_admin") {
          payload.permissions = collectPermissions(permWrap);
        }
  
        try {
          const data = await apiCall("api/admins_add.php", payload);
          if (!data.ok) throw new Error(data.message);
          msgEl.textContent = data.message || "ادمین با موفقیت اضافه شد.";
          msgEl.classList.add("is-success");
          form.reset();
          if (permWrap) {
            fillPermissions(permWrap, defaultNewAdminPermissions());
          }
          toggleRolePanels();
          await loadAdmins();
        } catch (err) {
          msgEl.textContent = err.message || "خطا در افزودن ادمین.";
          msgEl.classList.add("is-error");
        }
      });
    }
  
    /* ---------------------------------------------------------
       تغییر رمز عبور
    --------------------------------------------------------- */
    function initChangePasswordForm() {
      const form = document.getElementById("changePasswordForm");
      const msgEl = document.getElementById("changePasswordMsg");
      if (!form) return;
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        msgEl.textContent = "";
        msgEl.className = "form-msg";
        const current_password = form.current_password.value;
        const new_password = form.new_password.value;
        try {
          const data = await apiCall("api/change_password.php", { current_password, new_password });
          if (!data.ok) throw new Error(data.message);
          msgEl.textContent = data.message || "رمز عبور تغییر کرد.";
          msgEl.classList.add("is-success");
          form.reset();
        } catch (err) {
          msgEl.textContent = err.message || "خطا در تغییر رمز عبور.";
          msgEl.classList.add("is-error");
        }
      });
    }
  
    /* ---------------------------------------------------------
       Settings: my profile (self-service, any role)
    --------------------------------------------------------- */
    let profileAvatarFile = null;
    let profileRemoveAvatarFlag = false;
  
    function initProfileSettings() {
      const saveBtn = document.getElementById("saveProfileBtn");
      if (!saveBtn) return;
  
      loadProfile();
  
      const drop = document.getElementById("profileAvatarDrop");
      const fileInput = document.getElementById("profileAvatarInput");
      drop?.addEventListener("click", () => fileInput.click());
      fileInput?.addEventListener("change", () => {
        const file = fileInput.files[0];
        if (!file) return;
        if (file.size > 6 * 1024 * 1024) {
          showToast("حجم عکس نباید بیشتر از ۶ مگابایت باشد.", true);
          return;
        }
        profileAvatarFile = file;
        profileRemoveAvatarFlag = false;
        const reader = new FileReader();
        reader.onload = (e) => {
          const img = document.getElementById("profileAvatarPreview");
          img.src = e.target.result;
          img.style.display = "block";
          document.getElementById("profileAvatarPlaceholder").style.display = "none";
        };
        reader.readAsDataURL(file);
      });
  
      document.getElementById("removeProfileAvatarBtn")?.addEventListener("click", () => {
        profileAvatarFile = null;
        profileRemoveAvatarFlag = true;
        fileInput.value = "";
        document.getElementById("profileAvatarPreview").style.display = "none";
        document.getElementById("profileAvatarPlaceholder").style.display = "block";
      });
  
      saveBtn.addEventListener("click", saveProfile);
    }
  
    async function loadProfile() {
      try {
        const data = await apiCall("api/profile_get.php");
        if (!data.ok) throw new Error(data.message);
        const p = data.data.admin;
        document.getElementById("profileDisplayName").value = p.display_name || "";
        document.getElementById("profileBioShort").value = p.bio_short || "";
        document.getElementById("profileBioFull").value = p.bio_full || "";
        document.getElementById("profileTelegram").value = p.social_telegram || "";
        document.getElementById("profileInstagram").value = p.social_instagram || "";
        document.getElementById("profileEmail").value = p.social_email || "";
        document.getElementById("profilePhone").value = p.social_phone || "";
        document.getElementById("profileLinkedin").value = p.social_linkedin || "";
        document.getElementById("profileX").value = p.social_x || "";
        if (p.avatar) {
          const img = document.getElementById("profileAvatarPreview");
          img.src = "../" + p.avatar;
          img.style.display = "block";
          document.getElementById("profileAvatarPlaceholder").style.display = "none";
        }
      } catch (err) {
        showToast(err.message || "خطا در بارگذاری پروفایل.", true);
      }
    }
  
    async function saveProfile() {
      const msgEl = document.getElementById("profileMsg");
      msgEl.textContent = "";
      msgEl.className = "form-msg";
  
      const fd = new FormData();
      fd.append("display_name", document.getElementById("profileDisplayName").value.trim());
      fd.append("bio_short", document.getElementById("profileBioShort").value.trim());
      fd.append("bio_full", document.getElementById("profileBioFull").value.trim());
      fd.append("social_telegram", document.getElementById("profileTelegram").value.trim());
      fd.append("social_instagram", document.getElementById("profileInstagram").value.trim());
      fd.append("social_email", document.getElementById("profileEmail").value.trim());
      fd.append("social_phone", document.getElementById("profilePhone").value.trim());
      fd.append("social_linkedin", document.getElementById("profileLinkedin").value.trim());
      fd.append("social_x", document.getElementById("profileX").value.trim());
      if (profileAvatarFile) fd.append("avatar", profileAvatarFile);
      if (profileRemoveAvatarFlag) fd.append("remove_avatar", "1");
      fd.append("csrf", csrfToken);
  
      try {
        const res = await fetch("api/profile_save.php", {
          method: "POST",
          headers: { "X-CSRF-Token": csrfToken },
          body: fd,
        });
        const data = await res.json();
        if (!data.ok) throw new Error(data.message);
        showToast(data.message || "پروفایل ذخیره شد.");
        profileAvatarFile = null;
        profileRemoveAvatarFlag = false;
      } catch (err) {
        msgEl.textContent = err.message || "خطا در ذخیره پروفایل.";
        msgEl.classList.add("is-error");
      }
    }
  })();