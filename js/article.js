/* ===========================================================
   article.js — منطق صفحه‌ی تکی مقاله
   =========================================================== */
(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", () => {
    if (!document.getElementById("articlePage")) return;
    const slug = new URLSearchParams(window.location.search).get("slug");
    if (!slug) {
      showNotFound();
      return;
    }
    loadArticle(slug);
    initReadingProgress();
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
      return isoLike;
    }
  }

  function showNotFound() {
    document.getElementById("articleLoading").style.display = "none";
    document.getElementById("articleNotFound").style.display = "flex";
  }

  async function loadArticle(slug) {
    try {
      const res = await fetch("api/article_single.php?slug=" + encodeURIComponent(slug));
      const data = await res.json();
      if (!data.ok) {
        showNotFound();
        return;
      }
      renderArticle(data.data.article);
    } catch (err) {
      showNotFound();
    }
  }

  function initialsOf(name) {
    if (!name) return "ر";
    return name.trim().charAt(0);
  }

  function renderArticle(a) {
    document.getElementById("articleLoading").style.display = "none";
    const content = document.getElementById("articleContent");
    content.style.display = "block";

    document.title = (a.meta_title || a.title) + " | رویایی رسا";
    document.getElementById("pageTitle").textContent = (a.meta_title || a.title) + " | رویایی رسا";
    const desc = a.meta_description || a.excerpt || "";
    document.getElementById("pageDescription").setAttribute("content", desc);
    document.getElementById("ogTitle").setAttribute("content", a.title);
    document.getElementById("ogDescription").setAttribute("content", desc);
    if (a.cover_image) document.getElementById("ogImage").setAttribute("content", window.location.origin + "/" + a.cover_image);

    const heroImg = document.getElementById("articleHeroImg");
    if (a.cover_image) {
      heroImg.src = a.cover_image;
      heroImg.alt = a.title;
    } else {
      document.getElementById("articleHero").style.background = "linear-gradient(135deg, var(--c-deep), var(--c-ink))";
    }

    if (a.category_name) {
      const badge = document.getElementById("articleCatBadge");
      badge.textContent = a.category_name;
      badge.style.display = "inline-block";
    }

    document.getElementById("articleTitle").textContent = a.title;
    document.getElementById("authorAvatar").textContent = "";
    document.getElementById("authorAvatar").style.display = "inline-flex";
    document.getElementById("authorAvatar").style.alignItems = "center";
    document.getElementById("authorAvatar").style.justifyContent = "center";
    document.getElementById("authorAvatar").style.color = "#fff";
    document.getElementById("authorAvatar").style.fontSize = ".7rem";
    document.getElementById("authorAvatar").style.fontWeight = "700";
    document.getElementById("authorAvatar").textContent = initialsOf(a.author);
    document.getElementById("articleAuthor").textContent = a.author || "رویایی رسا";
    document.getElementById("articleDate").textContent = formatDate(a.published_at);
    document.getElementById("articleReadingTime").textContent = `${(a.reading_time || 1).toLocaleString("fa-IR")} دقیقه مطالعه`;
    document.getElementById("articleViews").textContent = `${(a.views || 0).toLocaleString("fa-IR")} بازدید`;

    document.getElementById("articleProse").innerHTML = a.content || "";

    const allTags = (a.tags || []);
    if (allTags.length) {
      document.getElementById("tagsCard").style.display = "block";
      document.getElementById("articleTagsCloud").innerHTML = allTags
        .map((t) => `<a href="articles.html?tag=${encodeURIComponent(t.slug)}">#${escapeHtml(t.name)}</a>`)
        .join("");
    }

    wireShareButtons(a.title);
    renderRelated(a.related || []);
    initParallax();
  }

  function articleCardHtml(article) {
    const img = article.cover_image
      ? `<img src="${article.cover_image}" alt="${escapeHtml(article.title)}" loading="lazy">`
      : "";
    return `
      <article class="article-card">
        <a href="article.html?slug=${encodeURIComponent(article.slug)}" class="article-card-media">${img}</a>
        <div class="article-card-body">
          <h3><a href="article.html?slug=${encodeURIComponent(article.slug)}">${escapeHtml(article.title)}</a></h3>
          <p class="article-card-excerpt">${escapeHtml(article.excerpt || "")}</p>
          <div class="article-card-meta">
            <span>${formatDate(article.published_at)}</span>
            <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>${(article.reading_time || 1).toLocaleString("fa-IR")} دقیقه</span>
          </div>
        </div>
      </article>`;
  }

  function renderRelated(list) {
    if (!list.length) return;
    document.getElementById("relatedSection").style.display = "block";
    document.getElementById("relatedGrid").innerHTML = list.map(articleCardHtml).join("");
  }

  function wireShareButtons(title) {
    const url = window.location.href;

    document.getElementById("shareTelegram").href = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`;

    document.getElementById("shareNativeBtn")?.addEventListener("click", async () => {
      if (navigator.share) {
        try {
          await navigator.share({ title, url });
        } catch (e) {
          /* user cancelled */
        }
      } else {
        copyLink(url);
      }
    });

    document.getElementById("shareCopyBtn")?.addEventListener("click", () => copyLink(url));
  }

  function copyLink(url) {
    navigator.clipboard?.writeText(url).then(() => {
      const btn = document.getElementById("shareCopyBtn");
      const original = btn.innerHTML;
      btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5 9 18l11-12"/></svg>';
      setTimeout(() => (btn.innerHTML = original), 1600);
    });
  }

  /* ---------------------------------------------------------
     Reading progress bar
  --------------------------------------------------------- */
  function initReadingProgress() {
    const bar = document.getElementById("readingProgressBar");
    if (!bar) return;
    window.addEventListener(
      "scroll",
      () => {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        const pct = max > 0 ? Math.min(100, (window.scrollY / max) * 100) : 0;
        bar.style.width = pct + "%";
      },
      { passive: true }
    );
  }

  /* ---------------------------------------------------------
     Lightweight hero parallax (vanilla, avoids GSAP pin issues on mobile)
  --------------------------------------------------------- */
  function initParallax() {
    const media = document.querySelector(".article-hero-media");
    const hero = document.getElementById("articleHero");
    if (!media || !hero) return;
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return;

    let ticking = false;
    function update() {
      const rect = hero.getBoundingClientRect();
      const progress = Math.min(1, Math.max(0, -rect.top / (rect.height || 1)));
      media.style.transform = `translateY(${progress * 8}%)`;
      ticking = false;
    }
    window.addEventListener(
      "scroll",
      () => {
        if (!ticking) {
          requestAnimationFrame(update);
          ticking = true;
        }
      },
      { passive: true }
    );
  }
})();
