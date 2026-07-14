/* ===========================================================
   data-shim.js
   نسخه‌ی کاملاً استاتیک رویایی رسا (برای گیت‌هاب / GitHub Pages)
   -----------------------------------------------------------
   این فایل جایگزین بک‌اند PHP/MySQL می‌شود: داده‌ها را یک‌بار از
   data/db.json می‌خواند و fetch() صفحات را برای مسیرهای api/*.php
   با همان قرارداد JSON قبلی (ok/data/message) پاسخ می‌دهد، بدون
   نیاز به هیچ سروری. تغییرات کاربر (کامنت جدید، پیام تماس) در
   localStorage مرورگر همان کاربر ذخیره می‌شود.
   =========================================================== */
(function (global) {
  "use strict";

  const DB_URL = "data/db.json";
  const LS_KEY = "resa_static_overlay_v1";

  let dbPromise = null;
  function loadDb() {
    if (!dbPromise) {
      dbPromise = fetch(DB_URL, { cache: "no-store" })
        .then((r) => r.json())
        .then((db) => {
          applyOverlay(db);
          return db;
        });
    }
    return dbPromise;
  }

  /* ---------- overlay: کامنت‌ها و پیام‌های تازه‌ی همین مرورگر ---------- */
  function readOverlay() {
    try {
      return JSON.parse(localStorage.getItem(LS_KEY) || "{}");
    } catch (e) {
      return {};
    }
  }
  function writeOverlay(ov) {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(ov));
    } catch (e) {}
  }
  function applyOverlay(db) {
    const ov = readOverlay();
    if (ov.newComments) {
      for (const articleId in ov.newComments) {
        db.comments[articleId] = (db.comments[articleId] || []).concat(ov.newComments[articleId]);
      }
    }
    if (ov.newMessages) {
      db.messages = db.messages.concat(ov.newMessages);
    }
    if (ov.viewedIds) {
      // بازدید افزوده‌شده در همین نشست را روی شمارنده اعمال کن
      db.articles.forEach((a) => { if (ov.viewedIds.articles && ov.viewedIds.articles.includes(a.id)) a.views++; });
      db.projects.forEach((p) => { if (ov.viewedIds.projects && ov.viewedIds.projects.includes(p.id)) p.views++; });
    }
  }

  const SESSION_VIEWED = { articles: new Set(), projects: new Set() };

  function nowIso() {
    return new Date().toISOString().slice(0, 19).replace("T", " ");
  }
  function isoDaysAgo(days) {
    const d = new Date(Date.now() - days * 86400000);
    return d.toISOString().slice(0, 19).replace("T", " ");
  }
  function isoHoursAgo(hours) {
    const d = new Date(Date.now() - hours * 3600000);
    return d.toISOString().slice(0, 19).replace("T", " ");
  }

  function jsonResponse(body) {
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }

  function ok(data, message) {
    const out = { ok: true };
    if (message) out.message = message;
    if (data !== undefined) out.data = data;
    return out;
  }
  function fail(message, extra) {
    return Object.assign({ ok: false, message: message || "" }, extra || {});
  }

  /* ---------- کمک: مقاله/پروژه را برای خروجی عمومی آماده کن ---------- */
  function publicArticleCard(a) {
    const admin = a.author_admin_id ? adminById(a.author_admin_id) : null;
    return {
      id: a.id, title: a.title, slug: a.slug, excerpt: a.excerpt, cover_image: a.cover_image,
      author: a.author, author_admin_id: a.author_admin_id, author_avatar: admin ? admin.avatar : null,
      reading_time: a.reading_time, published_at: isoDaysAgo(a.days_ago), views: a.views,
      category_name: a.category_name, category_slug: a.category_slug,
      category_description: a.category_description, category_icon: a.category_icon,
      tags: a.tags,
    };
  }
  function publicProjectCard(p) {
    return {
      id: p.id, title: p.title, slug: p.slug, excerpt: p.excerpt,
      cover_type: p.cover_type, cover_image: p.cover_image, cover_video: p.cover_video,
      published_at: isoDaysAgo(p.days_ago), views: p.views,
      category_name: p.category_name, category_slug: p.category_slug,
      team: (p.team || []).map((t) => ({ name: t.name, avatar: t.avatar })),
    };
  }

  let DB = null;
  function adminById(id) { return DB.admins.find((a) => a.id === id) || null; }
  function categoryById(id) { return DB.categories.find((c) => c.id === id) || null; }

  /* ---------- هندلرهای معادل هر اندپوینت PHP ---------- */
  const handlers = {
    "api/articles_list.php": (params) => {
      let list = DB.articles.filter((a) => a.status === "published");
      if (params.get("stack") || params.get("top")) {
        const limit = Math.max(1, Math.min(20, parseInt(params.get("limit") || "5", 10)));
        list.sort((a, b) => params.get("top") ? (b.views - a.views) : (b.days_ago * -1 - a.days_ago * -1));
        if (params.get("top")) list.sort((a, b) => b.views - a.views);
        else list.sort((a, b) => a.days_ago - b.days_ago);
        return ok({ articles: list.slice(0, limit).map(publicArticleCard) });
      }

      const q = (params.get("q") || "").trim();
      const category = (params.get("category") || "").trim();
      const subcategory = (params.get("subcategory") || "").trim();
      const tag = (params.get("tag") || "").trim();
      const authorId = parseInt(params.get("author") || "0", 10);
      const sortKey = params.get("sort") || "newest";
      const page = Math.max(1, parseInt(params.get("page") || "1", 10));
      const perPage = 9;

      if (q) list = list.filter((a) => a.title.includes(q) || (a.excerpt || "").includes(q));
      if (authorId) list = list.filter((a) => a.author_admin_id === authorId);
      if (category) list = list.filter((a) => a.category_slug === category || (a.subcategories || []).some((s) => s.slug === category));
      if (subcategory) list = list.filter((a) => (a.subcategories || []).some((s) => s.slug === subcategory));
      if (tag) list = list.filter((a) => (a.tags || []).some((t) => t.slug === tag));

      const sorters = {
        newest: (a, b) => a.days_ago - b.days_ago,
        oldest: (a, b) => b.days_ago - a.days_ago,
        views: (a, b) => b.views - a.views,
        reading_time: (a, b) => a.reading_time - b.reading_time,
      };
      list.sort(sorters[sortKey] || sorters.newest);

      const total = list.length;
      const start = (page - 1) * perPage;
      const pageItems = list.slice(start, start + perPage).map(publicArticleCard);

      return ok({
        articles: pageItems, page, per_page: perPage, total,
        total_pages: Math.max(1, Math.ceil(total / perPage)),
      });
    },

    "api/article_single.php": (params) => {
      const slug = (params.get("slug") || "").trim();
      const a = DB.articles.find((x) => x.slug === slug && x.status === "published");
      if (!a) return fail("مقاله یافت نشد.");

      if (!SESSION_VIEWED.articles.has(a.id)) {
        SESSION_VIEWED.articles.add(a.id);
        a.views++;
        const ov = readOverlay();
        ov.viewedIds = ov.viewedIds || { articles: [], projects: [] };
        ov.viewedIds.articles.push(a.id);
        writeOverlay(ov);
      }

      const admin = a.author_admin_id ? adminById(a.author_admin_id) : null;
      let related = DB.articles.filter((x) => x.id !== a.id && x.status === "published" && x.category_id === a.category_id).slice(0, 3);
      if (related.length < 3) {
        const excludeIds = new Set([a.id, ...related.map((r) => r.id)]);
        const fill = DB.articles.filter((x) => x.status === "published" && !excludeIds.has(x.id)).slice(0, 3 - related.length);
        related = related.concat(fill);
      }

      const article = {
        id: a.id, title: a.title, slug: a.slug, excerpt: a.excerpt, content: a.content,
        cover_image: a.cover_image, author: admin ? admin.display_name : a.author,
        author_admin_id: a.author_admin_id, category_id: a.category_id,
        category_name: a.category_name, category_slug: a.category_slug,
        category_description: a.category_description, category_icon: a.category_icon,
        reading_time: a.reading_time, views: a.views, published_at: isoDaysAgo(a.days_ago),
        subcategories: a.subcategories || [], tags: a.tags || [],
        related: related.map((r) => ({
          id: r.id, title: r.title, slug: r.slug, excerpt: r.excerpt, cover_image: r.cover_image,
          reading_time: r.reading_time, published_at: isoDaysAgo(r.days_ago),
        })),
        author_profile: admin ? {
          id: admin.id, display_name: admin.display_name, avatar: admin.avatar,
          bio_short: admin.bio_short, bio_full: admin.bio_full,
          social_telegram: admin.social_telegram, social_instagram: admin.social_instagram,
          social_email: admin.social_email, social_phone: admin.social_phone,
          social_linkedin: admin.social_linkedin, social_x: admin.social_x,
        } : null,
      };
      return ok({ article });
    },

    "api/projects_list.php": (params) => {
      let list = DB.projects.filter((p) => p.status === "published");
      const q = (params.get("q") || "").trim();
      const category = (params.get("category") || "").trim();
      const page = Math.max(1, parseInt(params.get("page") || "1", 10));
      const perPage = Math.max(1, Math.min(60, parseInt(params.get("per_page") || "9", 10)));

      if (q) list = list.filter((p) => p.title.includes(q) || (p.excerpt || "").includes(q));
      if (category) list = list.filter((p) => p.category_slug === category);
      list.sort((a, b) => a.days_ago - b.days_ago);

      const total = list.length;
      const start = (page - 1) * perPage;
      const pageItems = list.slice(start, start + perPage).map(publicProjectCard);
      const categories = DB.categories.filter((c) => c.type === "project");

      return ok({
        projects: pageItems, categories, page, per_page: perPage, total,
        total_pages: Math.max(1, Math.ceil(total / perPage)),
      });
    },

    "api/project_single.php": (params) => {
      const slug = (params.get("slug") || "").trim();
      const p = DB.projects.find((x) => x.slug === slug && x.status === "published");
      if (!p) return fail("پروژه یافت نشد.");

      if (!SESSION_VIEWED.projects.has(p.id)) {
        SESSION_VIEWED.projects.add(p.id);
        p.views++;
        const ov = readOverlay();
        ov.viewedIds = ov.viewedIds || { articles: [], projects: [] };
        ov.viewedIds.projects.push(p.id);
        writeOverlay(ov);
      }

      let related = DB.projects.filter((x) => x.id !== p.id && x.status === "published" && x.category_id === p.category_id).slice(0, 3);
      if (related.length < 3) {
        const excludeIds = new Set([p.id, ...related.map((r) => r.id)]);
        const fill = DB.projects.filter((x) => x.status === "published" && !excludeIds.has(x.id)).slice(0, 3 - related.length);
        related = related.concat(fill);
      }

      const project = {
        id: p.id, title: p.title, slug: p.slug, excerpt: p.excerpt, content: p.content,
        cover_type: p.cover_type, cover_image: p.cover_image, cover_video: p.cover_video,
        category_id: p.category_id, category_name: p.category_name, category_slug: p.category_slug,
        views: p.views, published_at: isoDaysAgo(p.days_ago),
        team: p.team || [],
        related: related.map((r) => ({
          id: r.id, title: r.title, slug: r.slug, excerpt: r.excerpt,
          cover_type: r.cover_type, cover_image: r.cover_image, cover_video: r.cover_video,
          published_at: isoDaysAgo(r.days_ago),
        })),
      };
      return ok({ project });
    },

    "api/author_single.php": (params) => {
      const id = parseInt(params.get("id") || "0", 10);
      const admin = adminById(id);
      if (!admin) return fail("نویسنده یافت نشد.");
      const authored = DB.articles.filter((a) => a.author_admin_id === id && a.status === "published");
      const totalViews = authored.reduce((s, a) => s + a.views, 0);
      return ok({
        author: {
          id: admin.id, display_name: admin.display_name, avatar: admin.avatar,
          bio_short: admin.bio_short, bio_full: admin.bio_full,
          social_telegram: admin.social_telegram, social_instagram: admin.social_instagram,
          social_email: admin.social_email, social_phone: admin.social_phone,
          social_linkedin: admin.social_linkedin, social_x: admin.social_x,
          article_count: authored.length, total_views: totalViews,
        },
      });
    },

    "api/taxonomy_list.php": () => {
      const publishedArticles = DB.articles.filter((a) => a.status === "published");
      const blogCats = DB.categories.filter((c) => c.type === "blog");
      const categories = blogCats
        .map((c) => {
          const count = publishedArticles.filter((a) => a.category_id === c.id || (a.subcategories || []).some((s) => s.id === c.id)).length;
          return Object.assign({}, c, { icon: c.icon_image || null, article_count: count });
        })
        .filter((c) => c.article_count > 0);

      const tagCounts = {};
      publishedArticles.forEach((a) => (a.tags || []).forEach((t) => { tagCounts[t.slug] = (tagCounts[t.slug] || 0) + 1; }));
      const tags = DB.tags
        .filter((t) => tagCounts[t.slug])
        .map((t) => Object.assign({}, t, { article_count: tagCounts[t.slug] }))
        .sort((a, b) => b.article_count - a.article_count)
        .slice(0, 24);

      const authorCounts = {};
      publishedArticles.forEach((a) => { if (a.author_admin_id) authorCounts[a.author_admin_id] = (authorCounts[a.author_admin_id] || 0) + 1; });
      const authors = DB.admins
        .filter((a) => authorCounts[a.id])
        .map((a) => ({ id: a.id, name: a.display_name, avatar: a.avatar, article_count: authorCounts[a.id] }))
        .sort((a, b) => b.article_count - a.article_count);

      return ok({ categories, tags, authors });
    },

    "api/comments_list.php": (params) => {
      let articleId = parseInt(params.get("article_id") || "0", 10);
      const slug = (params.get("slug") || "").trim();
      if (slug) {
        const a = DB.articles.find((x) => x.slug === slug);
        articleId = a ? a.id : 0;
      }
      if (!articleId) return fail("مقاله یافت نشد.");
      const list = enrichComments(DB.comments[articleId] || []);
      const totalCount = countCommentsDeep(list);
      return ok({ article_id: articleId, total_count: totalCount, comments: list });
    },

    "api/comments_submit.php": (params, body) => {
      const articleId = parseInt(body.get("article_id") || "0", 10);
      const parentId = body.get("parent_id") ? parseInt(body.get("parent_id"), 10) : null;
      const userName = (body.get("user_name") || "").trim();
      const content = (body.get("content") || "").trim();
      const captchaInput = (body.get("captcha") || "").trim();

      const article = DB.articles.find((a) => a.id === articleId);
      if (!article) return fail("مقاله یافت نشد.");

      const errors = {};
      if (userName.length < 2 || userName.length > 100) errors.user_name = "نام باید بین ۲ تا ۱۰۰ کاراکتر باشد.";
      if (content.length < 3 || content.length > 2000) errors.content = "متن نظر باید بین ۳ تا ۲۰۰۰ کاراکتر باشد.";
      if (!checkCaptcha("comment", captchaInput)) errors.captcha = "کد امنیتی صحیح نیست.";
      if (Object.keys(errors).length) return fail("لطفاً خطاهای فرم را بررسی کنید.", { errors });

      const newComment = {
        id: Date.now(), parent_id: parentId, author_type: "user", user_name: userName,
        content, hours_ago: 0, created_at: nowIso(), replies: [],
      };

      const ov = readOverlay();
      ov.newComments = ov.newComments || {};
      if (parentId) {
        const list = DB.comments[articleId] || [];
        const parent = findCommentDeep(list, parentId);
        if (parent) parent.replies.push(newComment);
      }
      ov.newComments[articleId] = ov.newComments[articleId] || [];
      if (!parentId) ov.newComments[articleId].push(newComment);
      writeOverlay(ov);
      if (!parentId) {
        DB.comments[articleId] = (DB.comments[articleId] || []).concat([newComment]);
      }

      return ok({ auto_approved: true, comment_id: newComment.id }, "نظر شما با موفقیت ثبت شد.");
    },

    "api/contact_submit.php": (params, body) => {
      const fullName = (body.get("full_name") || "").trim();
      const contactInfo = (body.get("contact_info") || "").trim();
      const message = (body.get("message") || "").trim();
      const captchaInput = (body.get("captcha") || "").trim();

      const errors = {};
      if (fullName.length < 3 || fullName.length > 150) errors.full_name = "نام و نام خانوادگی را به‌درستی وارد کنید.";
      const isPhone = /^09[0-9]{9}$/.test(contactInfo);
      const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactInfo);
      if (!isPhone && !isEmail) errors.contact_info = "شماره تماس باید ۱۱ رقمی و با ۰۹ شروع شود، یا یک ایمیل معتبر وارد کنید.";
      if (message.length < 5 || message.length > 3000) errors.message = "متن پیام باید بین ۵ تا ۳۰۰۰ کاراکتر باشد.";
      if (!checkCaptcha("contact", captchaInput)) errors.captcha = "کد امنیتی صحیح نیست.";
      if (Object.keys(errors).length) return fail("لطفاً خطاهای فرم را بررسی کنید.", { errors });

      const ov = readOverlay();
      ov.newMessages = ov.newMessages || [];
      ov.newMessages.push({ id: Date.now(), full_name: fullName, contact_info: contactInfo, message, is_read: false, hours_ago: 0, created_at: nowIso() });
      writeOverlay(ov);

      return ok(null, "پیام شما با موفقیت ارسال شد. به‌زودی با شما تماس خواهیم گرفت.");
    },

    "api/track_visit.php": () => ok(null),
  };

  function enrichComments(list) {
    return list.map((c) => {
      const isAdmin = c.author_type === "admin";
      const admin = isAdmin && c.admin_id ? adminById(c.admin_id) : null;
      return Object.assign({}, c, {
        author_name: isAdmin ? (admin ? admin.display_name : "ادمین") : (c.user_name || c.author_name),
        admin_avatar: admin ? admin.avatar : null,
        created_at: c.created_at || isoHoursAgo(c.hours_ago || 0),
        replies: enrichComments(c.replies || []),
      });
    });
  }

  function countCommentsDeep(list) {
    let c = 0;
    for (const item of list) { c++; c += countCommentsDeep(item.replies || []); }
    return c;
  }
  function findCommentDeep(list, id) {
    for (const item of list) {
      if (item.id === id) return item;
      const found = findCommentDeep(item.replies || [], id);
      if (found) return found;
    }
    return null;
  }

  /* ---------- کپچای سبک سمت مرورگر (بدون سرور) ---------- */
  const captchaCodes = {};
  function genCaptchaCode() {
    let c = "";
    for (let i = 0; i < 4; i++) c += Math.floor(Math.random() * 10);
    return c;
  }
  function checkCaptcha(purpose, input) {
    const expected = captchaCodes[purpose];
    return !!expected && !!input && input === expected;
  }
  function captchaSvgDataUri(purpose) {
    const code = genCaptchaCode();
    captchaCodes[purpose] = code;
    const w = 150, h = 50;
    let noise = "";
    for (let i = 0; i < 6; i++) {
      const x1 = Math.random() * w, y1 = Math.random() * h;
      const x2 = Math.random() * w, y2 = Math.random() * h;
      noise += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#b9feff" stroke-width="1" opacity="0.5"/>`;
    }
    let glyphs = "";
    for (let i = 0; i < code.length; i++) {
      const x = 22 + i * 28 + (Math.random() * 6 - 3);
      const y = 33 + (Math.random() * 8 - 4);
      const rot = (Math.random() * 24 - 12).toFixed(1);
      glyphs += `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-family="Vazirmatn, monospace" font-size="26" font-weight="700" fill="#125454" transform="rotate(${rot} ${x.toFixed(1)} ${y.toFixed(1)})">${code[i]}</text>`;
    }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="100%" height="100%" fill="#f6fdff" rx="10"/>${noise}${glyphs}</svg>`;
    return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
  }
  global.RESA_CAPTCHA = { image: captchaSvgDataUri };

  /* ---------- override fetch ---------- */
  const realFetch = global.fetch ? global.fetch.bind(global) : null;

  global.fetch = function (input, init) {
    const urlStr = typeof input === "string" ? input : (input && input.url) || "";
    const clean = urlStr.split("?")[0].replace(/^\.?\//, "");
    const isApi = /^api\/[a-z_]+\.php$/.test(clean);

    if (!isApi) {
      return realFetch ? realFetch(input, init) : Promise.reject(new Error("fetch unavailable: " + urlStr));
    }

    const qIndex = urlStr.indexOf("?");
    const params = new URLSearchParams(qIndex >= 0 ? urlStr.slice(qIndex + 1) : "");
    const handler = handlers[clean];

    return loadDb().then((db) => {
      DB = db;
      if (!handler) return jsonResponse(fail("اندپوینت پیدا نشد: " + clean));

      let bodyParams = new URLSearchParams();
      const method = (init && init.method) || "GET";
      if (method === "POST" && init && init.body instanceof FormData) {
        bodyParams = init.body;
      }
      try {
        const result = handler(params, bodyParams);
        return jsonResponse(result);
      } catch (e) {
        console.error("[data-shim] خطا در پردازش", clean, e);
        return jsonResponse(fail("خطای داخلی دمو."));
      }
    });
  };

  // پیش‌بارگذاری داده برای کاهش تأخیر اولین درخواست
  loadDb();
})(window);
