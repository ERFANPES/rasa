/* ===========================================================
   about.js
   اسکریپت اختصاصی صفحه‌ی درباره ما: نمایان‌شدن تدریجی آیتم‌های
   تایم‌لاین هنگام اسکرول. بقیه‌ی تعامل‌های این صفحه (کاروسل تیم،
   مودال تیم، کاروسل افتخارات) عیناً از js/index.js می‌آید.
   =========================================================== */
document.addEventListener("DOMContentLoaded", () => {
  const items = document.querySelectorAll(".about-timeline-item");
  if (items.length) {
    if (typeof IntersectionObserver === "undefined") {
      items.forEach((el) => el.classList.add("is-visible"));
    } else {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add("is-visible");
              observer.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.2, rootMargin: "0px 0px -8% 0px" }
      );
      items.forEach((el) => observer.observe(el));
    }
  }

  initStatsCounters();
});

/* ---------------------------------------------------------
   شمارنده‌های بخش «آمار رسا» — از صفر تا عدد نهایی هنگام ورود به دید
--------------------------------------------------------- */
function initStatsCounters() {
  const nums = document.querySelectorAll(".about-stat-num");
  if (!nums.length) return;

  function toFa(n) { return n.toLocaleString("fa-IR"); }

  function animate(el) {
    const target = parseInt(el.dataset.count, 10) || 0;
    const suffix = el.dataset.suffix || "";
    const duration = 1400;
    const start = performance.now();

    function tick(now) {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = toFa(Math.round(target * eased)) + suffix;
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  if (typeof IntersectionObserver === "undefined") {
    nums.forEach(animate);
    return;
  }

  const statsObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          animate(entry.target);
          statsObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.4 }
  );
  nums.forEach((el) => statsObserver.observe(el));
}
