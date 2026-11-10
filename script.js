const nav = document.querySelector(".nav");
const navMenu = document.querySelector(".nav-items");
const btnToggleNav = document.querySelector(".menu-btn");
const mainEl = document.querySelector("main");
const yearEl = document.querySelector(".footer-text span");

const toggleNav = () => {
  nav.classList.toggle("hidden");
  document.body.classList.toggle("lock-screen");

  if (nav.classList.contains("hidden")) {
    btnToggleNav.textContent = "القائمة";
  } else {
    setTimeout(() => {
      btnToggleNav.textContent = "إغلاق";
    }, 475);
  }
};

btnToggleNav.addEventListener("click", toggleNav);

navMenu.addEventListener("click", (e) => {
  if (e.target.localName === "a") {
    toggleNav();
  }
});

document.body.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !nav.classList.contains("hidden")) {
    toggleNav();
  }
});

// تحريك كروت التطبيقات عند ظهورها في الشاشة أثناء السكرول
// (يعمل على عناصر .work-box الموجودة فعليًا وقت تحميل الصفحة فقط،
//  observeWorkBoxes يُعاد استدعاؤها من app.js بعد كل عملية رسم للتطبيقات)
function observeWorkBoxes() {
  const workEls = document.querySelectorAll(".work-box");
  const workImgs = document.querySelectorAll(".work-img");
  workImgs.forEach((workImg) => workImg.classList.add("transform"));

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const children = Array.from(entry.target.children);
        const textbox = children.find((c) => c.classList.contains("work-textbox"));
        const picture = children.find((c) => c.classList.contains("work-img"));
        if (entry.isIntersecting) {
          if (picture) picture.classList.remove("transform");
          if (textbox) {
            Array.from(textbox.children).forEach(
              (el) => (el.style.animationPlayState = "running")
            );
          }
        }
      });
    },
    { threshold: 0.2 }
  );

  workEls.forEach((workEl) => observer.observe(workEl));
}
window.observeWorkBoxes = observeWorkBoxes;
observeWorkBoxes();

// تبديل الوضع الداكن/الفاتح
const switchThemeEl = document.querySelector('input[type="checkbox"]');
const storedTheme = localStorage.getItem("theme");

switchThemeEl.checked = storedTheme === "dark" || storedTheme === null;

switchThemeEl.addEventListener("click", () => {
  const isChecked = switchThemeEl.checked;

  if (!isChecked) {
    document.body.classList.remove("dark");
    document.body.classList.add("light");
    localStorage.setItem("theme", "light");
    switchThemeEl.checked = false;
  } else {
    document.body.classList.add("dark");
    document.body.classList.remove("light");
    localStorage.setItem("theme", "dark");
  }
});

// حبس التاب جوه القائمة وهي مفتوحة
const lastFocusedEl = document.querySelector('a[data-focused="last-focused"]');

document.body.addEventListener("keydown", (e) => {
  if (e.key === "Tab" && document.activeElement === lastFocusedEl) {
    e.preventDefault();
    btnToggleNav.focus();
  }
});

if (yearEl) yearEl.textContent = new Date().getFullYear();

// تبديل اللغة عربي/إنجليزي (للواجهة الثابتة؛ محتوى التطبيقات المضاف من لوحة التحكم بيفضل باللغة اللي كُتب بيها)
function applyLanguage(lang) {
  const isEn = lang === 'en';
  document.documentElement.lang = isEn ? 'en' : 'ar';
  document.documentElement.dir = isEn ? 'ltr' : 'rtl';
  document.querySelectorAll('[data-ar]').forEach((el) => {
    el.textContent = isEn ? (el.dataset.en || el.dataset.ar) : el.dataset.ar;
  });
  document.querySelectorAll('[data-ar-ph]').forEach((el) => {
    el.setAttribute('placeholder', isEn ? (el.dataset.enPh || el.dataset.arPh) : el.dataset.arPh);
  });
  const label = document.getElementById('lang-switch-label');
  if (label) label.textContent = isEn ? 'AR' : 'EN';
  localStorage.setItem('lang', lang);
  window.dispatchEvent(new CustomEvent('langchange', { detail: { lang } }));
}

const langBtn = document.getElementById('lang-switch-btn');
if (langBtn) {
  langBtn.addEventListener('click', () => {
    const current = document.documentElement.lang === 'en' ? 'en' : 'ar';
    applyLanguage(current === 'en' ? 'ar' : 'en');
  });
}
applyLanguage(localStorage.getItem('lang') || 'ar');
