/* ===========================================================
   contact.js
   رفتار صفحه‌ی تماس با ما: آکاردئون سوالات متداول، رفرش کپچا
   و ارسال فرم تماس به‌صورت Ajax با اعتبارسنجی سمت کاربر.
   =========================================================== */

document.addEventListener("DOMContentLoaded", () => {
  initFaqAccordion();
  initCaptchaRefresh();
  initContactForm();
});

/* ---------------------------------------------------------
   1) FAQ accordion
--------------------------------------------------------- */
function initFaqAccordion() {
  document.querySelectorAll(".c2-faq-item").forEach((item) => {
    const btn = item.querySelector(".c2-faq-question");
    const answer = item.querySelector(".c2-faq-answer");
    if (!btn || !answer) return;

    btn.addEventListener("click", () => {
      const isOpen = item.classList.contains("is-open");

      document.querySelectorAll(".c2-faq-item.is-open").forEach((openItem) => {
        if (openItem !== item) {
          openItem.classList.remove("is-open");
          openItem.querySelector(".c2-faq-question").setAttribute("aria-expanded", "false");
          openItem.querySelector(".c2-faq-answer").style.maxHeight = null;
        }
      });

      if (isOpen) {
        item.classList.remove("is-open");
        btn.setAttribute("aria-expanded", "false");
        answer.style.maxHeight = null;
      } else {
        item.classList.add("is-open");
        btn.setAttribute("aria-expanded", "true");
        answer.style.maxHeight = answer.scrollHeight + "px";
      }
    });
  });
}

/* ---------------------------------------------------------
   2) Captcha refresh
--------------------------------------------------------- */
function initCaptchaRefresh() {
  const img = document.getElementById("captchaImg");
  const btn = document.getElementById("captchaRefresh");
  if (!img || !btn) return;

  const refresh = () => {
    img.src = "api/captcha.php?t=" + Date.now();
  };
  btn.addEventListener("click", refresh);
  window.refreshContactCaptcha = refresh;
}

/* ---------------------------------------------------------
   3) Contact form submission
--------------------------------------------------------- */
function initContactForm() {
  const form = document.getElementById("contactForm");
  if (!form) return;

  const submitBtn = document.getElementById("submitBtn");
  const resultEl = document.getElementById("formResult");

  const fields = {
    full_name: { input: document.getElementById("fullName"), err: document.getElementById("err-full_name") },
    contact_info: { input: document.getElementById("contactInfo"), err: document.getElementById("err-contact_info") },
    message: { input: document.getElementById("messageText"), err: document.getElementById("err-message") },
    captcha: { input: document.getElementById("captchaInput"), err: document.getElementById("err-captcha") },
  };

  function clearErrors() {
    Object.values(fields).forEach((f) => {
      if (f.err) f.err.textContent = "";
    });
    resultEl.textContent = "";
    resultEl.className = "c2-form-result";
  }

  function validateClientSide() {
    let valid = true;
    const name = fields.full_name.input.value.trim();
    const contact = fields.contact_info.input.value.trim();
    const message = fields.message.input.value.trim();
    const captcha = fields.captcha.input.value.trim();

    if (name.length < 3) {
      fields.full_name.err.textContent = "نام و نام خانوادگی را به‌درستی وارد کنید.";
      valid = false;
    }

    const phoneOk = /^09[0-9]{9}$/.test(contact);
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact);
    if (!phoneOk && !emailOk) {
      fields.contact_info.err.textContent = "شماره تماس ۱۱ رقمی با ۰۹ یا یک ایمیل معتبر وارد کنید.";
      valid = false;
    }

    if (message.length < 5) {
      fields.message.err.textContent = "متن پیام خیلی کوتاه است.";
      valid = false;
    }

    if (captcha.length < 4) {
      fields.captcha.err.textContent = "کد امنیتی را کامل وارد کنید.";
      valid = false;
    }

    return valid;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearErrors();

    if (!validateClientSide()) return;

    submitBtn.disabled = true;
    const originalText = submitBtn.querySelector(".submit-btn-text").textContent;
    submitBtn.querySelector(".submit-btn-text").textContent = "در حال ارسال...";

    try {
      const formData = new FormData(form);
      const res = await fetch("api/contact_submit.php", { method: "POST", body: formData });
      const data = await res.json();

      if (data.ok) {
        resultEl.textContent = data.message || "پیام شما با موفقیت ارسال شد.";
        resultEl.classList.add("is-success");
        form.reset();
        if (window.refreshContactCaptcha) window.refreshContactCaptcha();
      } else {
        if (data.errors) {
          Object.entries(data.errors).forEach(([key, msg]) => {
            if (fields[key] && fields[key].err) fields[key].err.textContent = msg;
          });
        }
        resultEl.textContent = data.message || "ارسال پیام ناموفق بود.";
        resultEl.classList.add("is-error");
        if (data.errors && data.errors.captcha && window.refreshContactCaptcha) {
          window.refreshContactCaptcha();
        }
      }
    } catch (err) {
      resultEl.textContent = "خطا در ارتباط با سرور. اتصال اینترنت خود را بررسی کنید.";
      resultEl.classList.add("is-error");
    } finally {
      submitBtn.disabled = false;
      submitBtn.querySelector(".submit-btn-text").textContent = originalText;
    }
  });
}
