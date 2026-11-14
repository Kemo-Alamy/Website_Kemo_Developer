import { firebaseConfig } from './firebase-config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, collection, addDoc, updateDoc, deleteDoc, getDocs, query, orderBy, serverTimestamp, increment } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const toastEl = document.getElementById('toast');
function showToast(msg) {
  if (!toastEl) return;
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  setTimeout(() => toastEl.classList.remove('show'), 3500);
}

function openModal(id) { document.getElementById(id)?.classList.remove('hidden-el'); }
function closeModal(id) { document.getElementById(id)?.classList.add('hidden-el'); }
document.querySelectorAll('.modal-overlay').forEach(ov => {
  ov.addEventListener('click', (e) => { if (e.target === ov) ov.classList.add('hidden-el'); });
});
document.querySelectorAll('.modal-close-x').forEach(btn => {
  btn.addEventListener('click', () => btn.closest('.modal-overlay')?.classList.add('hidden-el'));
});

// ========== نظام ثنائي اللغة للمحتوى (مش بس الواجهة الثابتة) ==========
function currentLang() { return document.documentElement.lang === 'en' ? 'en' : 'ar'; }
// بياخد الحقل بلغة العرض الحالية، ولو مش موجود يرجع للعربي، ولو مش موجود يرجع للحقل القديم (توافق مع تطبيقات قديمة)
function pick(obj, field) {
  if (!obj) return '';
  const lang = currentLang();
  return obj[`${field}_${lang}`] || obj[`${field}_ar`] || obj[field] || '';
}
const CATEGORY_LABELS = {
  'تطبيقات': { ar: 'تطبيقات', en: 'Apps' },
  'ألعاب': { ar: 'ألعاب', en: 'Games' },
  'أدوات': { ar: 'أدوات', en: 'Tools' },
  'مواقع': { ar: 'مواقع', en: 'Websites' },
};
function categoryLabel(cat) {
  const entry = CATEGORY_LABELS[cat];
  return entry ? entry[currentLang()] : cat;
}
const STR = {
  version: { ar: 'الإصدار', en: 'Version' },
  latest: { ar: 'الأحدث', en: 'latest' },
  previous: { ar: 'سابق', en: 'previous' },
  shownVersion: { ar: 'الإصدار المعروض', en: 'Showing version' },
  explore: { ar: 'استكشف هذا التطبيق', en: 'Explore this app' },
  noApps: { ar: 'لا توجد تطبيقات بعد', en: 'No apps yet' },
  loading: { ar: 'جاري التجهيز...', en: 'Loading...' },
  prevVersion: { ar: 'نسخة سابقة.', en: 'A previous version.' },
  login: { ar: 'تسجيل الدخول', en: 'Log in' },
  signup: { ar: 'إنشاء حساب جديد', en: 'Create account' },
  signupBtn: { ar: 'إنشاء حساب', en: 'Sign up' },
  loginBtn: { ar: 'دخول', en: 'Log in' },
  noAccountQ: { ar: 'مفيش حساب؟', en: "Don't have an account?" },
  hasAccountQ: { ar: 'لديك حساب بالفعل؟', en: 'Already have an account?' },
};
function t(key) { return STR[key] ? STR[key][currentLang()] : key; }

function openAppFromHashIfAny() {
  const m = location.hash.match(/^#app-(.+)$/);
  if (!m) return;
  const app = allApps.find(a => a.id === m[1]);
  if (app) openAppDetail(app);
}

function heartSvg() {
  return `<svg viewBox="0 0 24 24" width="15" height="15"><path d="M12 21s-6.7-4.35-9.3-8.1C.8 10.1 1.2 6.2 4.6 4.6c2.2-1 4.6-.3 6 1.4l1.4 1.7 1.4-1.7c1.4-1.7 3.8-2.4 6-1.4 3.4 1.6 3.8 5.5 1.9 8.3C18.7 16.65 12 21 12 21z"/></svg>`;
}

let allApps = [];
let currentApp = null;
let isAdmin = false;
let currentUser = null;
let versionEditContext = null;
let selectedReviewRating = 5;

/* ============ الملف الشخصي ============ */
/* ============ عداد الزوار وعدد التطبيقات ============ */
async function trackVisitor() {
  const vRef = doc(db, 'stats', 'visitors');
  try {
    if (!sessionStorage.getItem('visited_session')) {
      await setDoc(vRef, { count: increment(1) }, { merge: true });
      sessionStorage.setItem('visited_session', 'true');
    }
    const snap = await getDoc(vRef);
    const count = snap.exists() ? snap.data().count : 1;
    const el = document.getElementById('stat-visitors');
    if (el) el.textContent = Number(count).toLocaleString('en-US');
  } catch (e) {
    console.error(e);
    const el = document.getElementById('stat-visitors');
    if (el) el.textContent = '—';
  }
}
trackVisitor();

let lastProfileData = {};

function renderProfileDisplay(d) {
  const el = (id) => document.getElementById(id);
  if (d.avatar && el('profile-avatar')) { el('profile-avatar').src = d.avatar; el('profile-avatar').classList.remove('hidden-el'); }
  if (d.avatar && el('stats-image-box')) el('stats-image-box').innerHTML = `<img src="${d.avatar}" alt="" loading="lazy">`;
  const FALLBACK = {
    line1: { ar: 'أهلًا، أنا كريم عمار المعروف ب كيمو 👋', en: "Hey, I'm Kemo 👋" },
    line2: { ar: 'بعمل تطبيقات أندرويد ومواقع وبوتات', en: 'I build Android apps, websites & bots' },
    bio: { ar: 'بحب أحول أي فكرة لحاجة شغالة فعلاً. بابني كل حاجة بنفسي من الصفر وبهتم إنها تبقى سريعة وسهلة ومريحة في الاستخدام 🚀', en: 'I turn ideas into things that actually work. I build everything myself from scratch, and I care about it being fast, simple, and nice to use 🚀' },
    text1: { ar: 'عندك فكرة تطبيق أو سؤال؟ ابعتلي وهرد عليك بنفسي.', en: 'Got an app idea or a question? Just message me, I reply personally.' },
    text2: { ar: 'مفيش فكرة صغيرة قوي، كل حاجة تستاهل تتعمل صح.', en: "No idea's too small — everything deserves to be done right." },
  };
  const lang = currentLang();
  if (el('profile-line1')) el('profile-line1').textContent = pick(d, 'line1') || FALLBACK.line1[lang];
  if (el('profile-line2')) el('profile-line2').textContent = pick(d, 'line2') || FALLBACK.line2[lang];
  if (el('profile-bio')) el('profile-bio').textContent = pick(d, 'bio') || FALLBACK.bio[lang];
  if (el('profile-text1')) el('profile-text1').textContent = pick(d, 'text1') || FALLBACK.text1[lang];
  if (el('profile-text2')) el('profile-text2').textContent = pick(d, 'text2') || FALLBACK.text2[lang];

  const DEFAULT_ABOUT = {
    ar: 'كريم عمار حسانين، المعروف بـ KEMO DEVELOPER. بدأت رحلتي في البرمجة بشغف بسيط: إني أعرف إزاي الحاجات اللي بستخدمها كل يوم بتتبني من جوه. دلوقتي بصمم وأبني تطبيقات أندرويد ومواقع وبوتات ذكية، وبحوّل أي فكرة — مهما كانت بسيطة — لحاجة شغالة فعلاً وممتعة في الاستخدام. بؤمن إن أحسن تطبيق هو اللي الناس بتحس إنه اتعمل عشانها هي بالظبط.',
    en: "I'm Kareem Ammar Hassanein, known as KEMO DEVELOPER. My coding journey started with a simple curiosity — wanting to know how the stuff I use every day actually works under the hood. Today I design and build Android apps, websites, and smart bots, turning ideas, no matter how small, into something that actually works and feels great to use. I believe the best apps are the ones that feel like they were made just for you.",
  };
  if (el('about-bio')) el('about-bio').textContent = pick(d, 'about') || DEFAULT_ABOUT[currentLang()];
  if (el('about-name')) el('about-name').textContent = currentLang() === 'en' ? 'Kareem Ammar Hassanein — KEMO DEVELOPER' : 'كريم عمار حسانين — KEMO DEVELOPER';
  if (d.avatar && el('about-image-box')) el('about-image-box').innerHTML = `<img src="${d.avatar}" alt="" loading="lazy">`;

  const footerLinks = document.querySelectorAll('.footer-link a');
  if (d.gh && footerLinks[0]) footerLinks[0].href = d.gh;
  if (d.wa && footerLinks[1]) footerLinks[1].href = d.wa;
  if (d.ig && footerLinks[2]) footerLinks[2].href = d.ig;
  if (d.fb && footerLinks[3]) footerLinks[3].href = d.fb;
}

function fillProfileEditForm(d) {
  const el = (id) => document.getElementById(id);
  if (!el('edit-profile-line1-ar')) return;
  el('edit-profile-line1-ar').value = d.line1_ar || d.line1 || '';
  el('edit-profile-line1-en').value = d.line1_en || '';
  el('edit-profile-line2-ar').value = d.line2_ar || d.line2 || '';
  el('edit-profile-line2-en').value = d.line2_en || '';
  el('edit-profile-bio-ar').value = d.bio_ar || d.bio || '';
  el('edit-profile-bio-en').value = d.bio_en || '';
  el('edit-profile-text1-ar').value = d.text1_ar || d.text1 || '';
  el('edit-profile-text1-en').value = d.text1_en || '';
  el('edit-profile-text2-ar').value = d.text2_ar || d.text2 || '';
  el('edit-profile-text2-en').value = d.text2_en || '';
  el('edit-profile-about-ar').value = d.about_ar || '';
  el('edit-profile-about-en').value = d.about_en || '';
  el('edit-profile-fb').value = d.fb || '';
  el('edit-profile-wa').value = d.wa || '';
  el('edit-profile-ig').value = d.ig || '';
  el('edit-profile-gh').value = d.gh || '';
}

async function loadProfile() {
  try {
    const snap = await getDoc(doc(db, 'settings', 'profile'));
    const d = snap.exists() ? snap.data() : {};
    lastProfileData = d;
    renderProfileDisplay(d);
    fillProfileEditForm(d);
  } catch (e) { console.error(e); }
}
loadProfile();

const profileForm = document.getElementById('profile-form');
if (profileForm) profileForm.onsubmit = async (e) => {
  e.preventDefault();
  const submitBtn = profileForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  try {
    const d = {
      line1_ar: document.getElementById('edit-profile-line1-ar').value,
      line1_en: document.getElementById('edit-profile-line1-en').value,
      line2_ar: document.getElementById('edit-profile-line2-ar').value,
      line2_en: document.getElementById('edit-profile-line2-en').value,
      bio_ar: document.getElementById('edit-profile-bio-ar').value,
      bio_en: document.getElementById('edit-profile-bio-en').value,
      text1_ar: document.getElementById('edit-profile-text1-ar').value,
      text1_en: document.getElementById('edit-profile-text1-en').value,
      text2_ar: document.getElementById('edit-profile-text2-ar').value,
      text2_en: document.getElementById('edit-profile-text2-en').value,
      about_ar: document.getElementById('edit-profile-about-ar').value,
      about_en: document.getElementById('edit-profile-about-en').value,
      fb: document.getElementById('edit-profile-fb').value,
      wa: document.getElementById('edit-profile-wa').value,
      ig: document.getElementById('edit-profile-ig').value,
      gh: document.getElementById('edit-profile-gh').value,
    };
    const avatarF = document.getElementById('edit-profile-avatar').files[0];
    if (avatarF) d.avatar = await fileToBase64(avatarF);
    await setDoc(doc(db, 'settings', 'profile'), d, { merge: true });
    showToast('تم حفظ الملف الشخصي');
    closeModal('profile-modal');
    loadProfile();
  } catch (err) {
    console.error(err);
    showToast('تعذّر الحفظ، حاول تاني');
  } finally {
    submitBtn.disabled = false;
  }
};

/* ============ تحويل وضغط الصور ============ */
function fileToBase64(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX = 800;
        let { width, height } = img;
        if (width > height) { if (width > MAX) { height *= MAX / width; width = MAX; } }
        else { if (height > MAX) { width *= MAX / height; height = MAX; } }
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
    };
  });
}

/* ============ عرض التطبيقات ============ */
async function fetchApps() {
  const grid = document.getElementById('apps-grid');
  try {
    const snap = await getDocs(query(collection(db, 'apps'), orderBy('createdAt', 'desc')));
    allApps = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const countEl = document.getElementById('stat-apps');
    if (countEl) countEl.textContent = allApps.length;
    renderApps();
    openAppFromHashIfAny();
  } catch (e) {
    console.error(e);
    if (grid) grid.innerHTML = `<div class="empty-state">${currentLang() === 'en' ? 'Could not load apps' : 'تعذّر تحميل التطبيقات'}</div>`;
  }
}

function renderApps(filter = 'all', search = '') {
  const grid = document.getElementById('apps-grid');
  if (!grid) return;
  grid.innerHTML = '';
  const filtered = allApps.filter(a => (filter === 'all' || a.category === filter) && a.name.toLowerCase().includes(search.toLowerCase()));

  if (!filtered.length) { grid.innerHTML = `<div class="empty-state">${t('noApps')}</div>`; return; }

  filtered.forEach(app => {
    const box = document.createElement('div');
    box.className = 'work-box';
    box.onclick = () => openAppDetail(app);
    const isLiked = localStorage.getItem(`liked_${app.id}`);
    box.innerHTML = `
      <div class="work-textbox">
        <h3 class="h3">${pick(app, 'name')}</h3>
        <p class="work-text">${pick(app, 'description')}</p>
        <ol class="work-technologies">
          <li>${categoryLabel(app.category)}</li>
          <li>${t('version')} ${app.version || '1.0'}</li>
        </ol>
        <div class="work-links">
          <span class="link">${t('explore')}</span>
          <button type="button" class="icon-btn-circle ${isLiked ? 'liked' : ''}" data-like-btn="${app.id}">${heartSvg()}</button>
          <span style="color:var(--sub); font-size:var(--text-small);" id="card-like-${app.id}">${app.likes || 0}</span>
        </div>
      </div>
      <picture class="work-img">${app.coverUrl ? `<img loading="lazy" src="${app.coverUrl}">` : `<div class="cover-placeholder">✦</div>`}</picture>
    `;
    box.querySelector(`[data-like-btn="${app.id}"]`).onclick = (e) => { e.stopPropagation(); handleLike(app.id); };
    grid.appendChild(box);
  });

  if (window.observeWorkBoxes) window.observeWorkBoxes();
}

async function handleLike(appId) {
  if (!currentUser) {
    showToast('سجّل دخولك الأول عشان تقدر تعمل لايك');
    openAuthForm('login');
    return;
  }
  const key = `liked_${appId}`;
  const appIndex = allApps.findIndex(a => a.id === appId);
  const btn = document.querySelector(`[data-like-btn="${appId}"]`);
  const span = document.getElementById(`card-like-${appId}`);
  try {
    if (localStorage.getItem(key)) {
      await updateDoc(doc(db, 'apps', appId), { likes: increment(-1) });
      localStorage.removeItem(key);
      btn?.classList.remove('liked');
      if (span) span.textContent = Math.max(0, parseInt(span.textContent) - 1);
      if (appIndex > -1) allApps[appIndex].likes = Math.max(0, (allApps[appIndex].likes || 1) - 1);
    } else {
      await updateDoc(doc(db, 'apps', appId), { likes: increment(1) });
      localStorage.setItem(key, 'true');
      btn?.classList.add('liked');
      if (span) span.textContent = parseInt(span.textContent) + 1;
      if (appIndex > -1) allApps[appIndex].likes = (allApps[appIndex].likes || 0) + 1;
    }
    if (currentApp && currentApp.id === appId) {
      currentApp.likes = allApps[appIndex]?.likes || 0;
      document.getElementById('detail-likes-count').textContent = currentApp.likes;
      document.getElementById('detail-like-btn')?.classList.toggle('liked', !!localStorage.getItem(key));
    }
  } catch (err) {
    console.error(err);
    showToast('تعذّر تنفيذ العملية');
  }
}

document.getElementById('detail-like-btn').onclick = () => { if (currentApp) handleLike(currentApp.id); };

document.getElementById('detail-share-btn').onclick = async () => {
  if (!currentApp) return;
  const url = `${location.origin}${location.pathname}#app-${currentApp.id}`;
  const title = pick(currentApp, 'name');
  const text = pick(currentApp, 'description');
  try {
    if (navigator.share) {
      await navigator.share({ title, text, url });
    } else {
      await navigator.clipboard.writeText(url);
      showToast(currentLang() === 'en' ? 'Link copied!' : 'تم نسخ الرابط!');
    }
  } catch (err) {
    if (err?.name !== 'AbortError') console.error(err);
  }
};

/* ============ صفحة تفاصيل التطبيق ============ */
function openAppDetail(appApp) {
  const app = allApps.find(a => a.id === appApp.id) || appApp;
  currentApp = app;
  document.getElementById('app-detail-overlay').classList.remove('hidden-el');
  document.body.classList.add('lock-screen');
  window.scrollTo(0, 0);

  setActiveVersionUI(app, true, app.coverUrl);
  buildVersions(app);
  applyAdminUI();
  loadReviews(app.id);
}

document.getElementById('app-detail-back').onclick = (e) => {
  e.preventDefault();
  document.getElementById('app-detail-overlay').classList.add('hidden-el');
  document.body.classList.remove('lock-screen');
};

function setActiveVersionUI(verData, isLatest, fallbackCover) {
  document.getElementById('detail-name').textContent = pick(verData, 'name') || pick(currentApp, 'name');
  document.getElementById('detail-version-label').textContent = `${t('shownVersion')}: v${verData.version} (${isLatest ? t('latest') : t('previous')})`;
  const coverBox = document.querySelector('.detail-cover-box');
  const coverSrc = verData.coverUrl || fallbackCover || '';
  if (coverBox) {
    coverBox.innerHTML = coverSrc
      ? `<img id="detail-cover" src="${coverSrc}" alt="" loading="lazy">`
      : `<div class="cover-placeholder" style="aspect-ratio:16/11; border-radius:var(--gutter-nano);">✦</div>`;
  }
  document.getElementById('detail-download-btn').href = verData.fileUrl || '#';
  document.getElementById('detail-description').textContent = isLatest ? pick(currentApp, 'description') : (pick(verData, 'releaseNotes') || t('prevVersion'));
  document.getElementById('detail-tags').innerHTML = `<li>${categoryLabel(currentApp.category)}</li><li>${t('version')} ${verData.version}</li>`;
  document.getElementById('detail-likes-count').textContent = currentApp.likes || 0;
  document.getElementById('detail-like-btn').classList.toggle('liked', !!localStorage.getItem(`liked_${currentApp.id}`));
}

function buildVersions(app) {
  const list = document.getElementById('detail-versions-list');
  if (!list) return;
  list.innerHTML = '';

  const mainRow = document.createElement('div');
  mainRow.className = 'version-row';
  mainRow.innerHTML = `
    <span class="link" style="cursor:pointer;">v${app.version} (${t('latest')})</span>
    <span style="display:flex; gap:10px; align-items:center;">
      ${isAdmin ? `<button type="button" class="icon-btn-circle" data-main-edit title="تعديل">✎</button><button type="button" class="icon-btn-circle" data-main-del title="حذف الإصدار الحالي">🗑</button>` : ''}
    </span>`;
  mainRow.querySelector('.link').onclick = () => setActiveVersionUI(app, true, app.coverUrl);
  const mainEdit = mainRow.querySelector('[data-main-edit]');
  if (mainEdit) mainEdit.onclick = () => openVersionEditForm(app, null);
  const mainDel = mainRow.querySelector('[data-main-del]');
  if (mainDel) mainDel.onclick = async () => {
    if (!app.history || !app.history.length) { showToast('ده آخر إصدار، احذف التطبيق كله لو عايز'); return; }
    if (!confirm(`حذف الإصدار الحالي v${app.version}؟`)) return;
    try {
      const newHistory = [...app.history];
      const promoted = newHistory.shift();
      const updatedFields = { version: promoted.version, name_ar: promoted.name_ar || promoted.name || app.name_ar || app.name, name_en: promoted.name_en || app.name_en || '', fileUrl: promoted.fileUrl, releaseNotes_ar: promoted.releaseNotes_ar || promoted.releaseNotes || '', releaseNotes_en: promoted.releaseNotes_en || '', history: newHistory };
      if (promoted.coverUrl) updatedFields.coverUrl = promoted.coverUrl;
      await updateDoc(doc(db, 'apps', app.id), updatedFields);
      Object.assign(app, updatedFields);
      showToast('تم حذف الإصدار الحالي');
      buildVersions(app);
      setActiveVersionUI(app, true, app.coverUrl);
      fetchApps();
    } catch (err) { console.error(err); showToast('تعذّر الحذف'); }
  };
  list.appendChild(mainRow);

  (app.history || []).forEach((h, idx) => {
    const row = document.createElement('div');
    row.className = 'version-row';
    row.innerHTML = `
      <span class="link" style="cursor:pointer;">v${h.version} (${t('previous')})</span>
      <span style="display:flex; gap:10px; align-items:center;">
        ${isAdmin ? `<button type="button" class="icon-btn-circle" data-edit-idx="${idx}" title="تعديل">✎</button><button type="button" class="icon-btn-circle" data-del-idx="${idx}" title="حذف">🗑</button>` : ''}
      </span>`;
    row.querySelector('.link').onclick = () => setActiveVersionUI(h, false, app.coverUrl);
    const editBtn = row.querySelector(`[data-edit-idx="${idx}"]`);
    if (editBtn) editBtn.onclick = () => openVersionEditForm(app, idx);
    const delBtn = row.querySelector(`[data-del-idx="${idx}"]`);
    if (delBtn) delBtn.onclick = async () => {
      if (!confirm(`حذف الإصدار v${h.version} نهائيًا؟`)) return;
      try {
        const newHistory = app.history.filter((_, i) => i !== idx);
        await updateDoc(doc(db, 'apps', app.id), { history: newHistory });
        app.history = newHistory;
        showToast('تم حذف الإصدار');
        buildVersions(app);
      } catch (err) { console.error(err); showToast('تعذّر الحذف'); }
    };
    list.appendChild(row);
  });
}

function applyAdminUI() {
  document.getElementById('detail-admin-actions')?.classList.toggle('hidden-el', !isAdmin);
  document.getElementById('nav-admin-btn')?.classList.toggle('hidden-el', !isAdmin);
  document.getElementById('nav-admin-profile-btn')?.classList.toggle('hidden-el', !isAdmin);
  document.getElementById('nav-admin-broadcast-btn')?.classList.toggle('hidden-el', !isAdmin);
  if (currentApp) { buildVersions(currentApp); loadReviews(currentApp.id); }
}

/* ============ المراجعات والتقييم ============ */
function paintStars(container, count) {
  container.querySelectorAll('.star').forEach(s => s.classList.toggle('filled', Number(s.dataset.value) <= count));
}

function buildStarInput() {
  const box = document.getElementById('review-stars');
  box.innerHTML = '';
  selectedReviewRating = 5;
  for (let i = 1; i <= 5; i++) {
    const star = document.createElement('span');
    star.className = 'star';
    star.dataset.value = i;
    star.textContent = '★';
    star.onclick = () => { selectedReviewRating = i; paintStars(box, i); };
    box.appendChild(star);
  }
  paintStars(box, selectedReviewRating);
}
buildStarInput();

async function loadReviews(appId) {
  const list = document.getElementById('reviews-list');
  list.innerHTML = '<li style="color:var(--sub); padding:10px 0;">جاري التحميل...</li>';
  try {
    const snap = await getDocs(query(collection(db, `apps/${appId}/reviews`), orderBy('createdAt', 'desc')));
    const revs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    document.getElementById('reviews-count').textContent = revs.length;
    list.innerHTML = '';
    if (!revs.length) { list.innerHTML = '<li style="color:var(--sub); padding:10px 0;">لا توجد تقييمات بعد.</li>'; return; }
    revs.forEach(r => {
      const li = document.createElement('li');
      li.className = 'review-item';
      li.innerHTML = `
        <div class="review-head">
          <span class="review-author">👤 ${r.name}</span>
          ${isAdmin ? `<button type="button" class="icon-btn-circle" data-del-review="${r.id}" title="حذف">🗑</button>` : ''}
        </div>
        <div class="stars">${'★'.repeat(r.rating || 5)}</div>
        <blockquote class="testimonial-text" style="font-size:var(--text-small); margin:6px 0 0;">${r.text}</blockquote>
      `;
      const delBtn = li.querySelector('[data-del-review]');
      if (delBtn) delBtn.onclick = async () => {
        if (!confirm('حذف هذا التقييم؟')) return;
        try {
          await deleteDoc(doc(db, `apps/${appId}/reviews/${r.id}`));
          showToast('تم الحذف');
          loadReviews(appId);
        } catch (err) { console.error(err); showToast('تعذّر الحذف'); }
      };
      list.appendChild(li);
    });
  } catch (e) {
    console.error(e);
    list.innerHTML = '<li style="color:var(--sub); padding:10px 0;">تعذّر تحميل التقييمات.</li>';
  }
}

const addReviewForm = document.getElementById('add-review-form');
if (addReviewForm) addReviewForm.onsubmit = async (e) => {
  e.preventDefault();
  if (!currentApp) return;
  const name = document.getElementById('review-user-name').value.trim();
  const text = document.getElementById('review-user-text').value.trim();
  if (!name || !text) { showToast('اكتب اسمك ورأيك الأول'); return; }
  const btn = addReviewForm.querySelector('button[type="submit"]');
  btn.disabled = true;
  try {
    await addDoc(collection(db, `apps/${currentApp.id}/reviews`), {
      name, text, rating: selectedReviewRating, createdAt: serverTimestamp()
    });
    addReviewForm.reset();
    buildStarInput();
    showToast('تم نشر تقييمك، شكرًا!');
    loadReviews(currentApp.id);
  } catch (err) {
    console.error(err);
    showToast('تعذّر نشر التقييم، حاول تاني');
  } finally {
    btn.disabled = false;
  }
};

/* ============ أدمن: إضافة/تعديل تطبيق ============ */
document.getElementById('nav-admin-btn').onclick = (e) => {
  e.preventDefault();
  document.getElementById('app-form').reset();
  document.getElementById('edit-id').value = '';
  document.getElementById('app-modal-title').textContent = 'تطبيق جديد';
  document.getElementById('app-cancel-edit').classList.add('hidden-el');
  openModal('app-modal');
};

document.getElementById('nav-admin-profile-btn').onclick = (e) => { e.preventDefault(); openModal('profile-modal'); };

document.getElementById('admin-edit-app-btn').onclick = () => {
  if (!currentApp) return;
  document.getElementById('edit-id').value = currentApp.id;
  document.getElementById('app-name-ar').value = currentApp.name_ar || currentApp.name || '';
  document.getElementById('app-name-en').value = currentApp.name_en || '';
  document.getElementById('app-category').value = currentApp.category;
  document.getElementById('app-version').value = currentApp.version;
  document.getElementById('app-file').value = currentApp.fileUrl;
  document.getElementById('app-description-ar').value = currentApp.description_ar || currentApp.description || '';
  document.getElementById('app-description-en').value = currentApp.description_en || '';
  document.getElementById('app-modal-title').textContent = 'تعديل التطبيق';
  document.getElementById('app-cancel-edit').classList.remove('hidden-el');
  openModal('app-modal');
};

document.getElementById('app-cancel-edit').onclick = () => {
  document.getElementById('app-form').reset();
  document.getElementById('edit-id').value = '';
  closeModal('app-modal');
};

const appForm = document.getElementById('app-form');
if (appForm) appForm.onsubmit = async (e) => {
  e.preventDefault();
  const id = document.getElementById('edit-id').value;
  const btn = appForm.querySelector('button[type="submit"]');
  btn.disabled = true;
  showToast('جاري الحفظ...');
  try {
    const appData = {
      name_ar: document.getElementById('app-name-ar').value,
      name_en: document.getElementById('app-name-en').value,
      category: document.getElementById('app-category').value,
      version: document.getElementById('app-version').value,
      description_ar: document.getElementById('app-description-ar').value,
      description_en: document.getElementById('app-description-en').value,
      fileUrl: document.getElementById('app-file').value,
    };
    const imgF = document.getElementById('app-image').files[0];
    if (imgF) appData.coverUrl = await fileToBase64(imgF);

    if (id) {
      await updateDoc(doc(db, 'apps', id), appData);
      showToast('تم تحديث التطبيق');
      if (currentApp && currentApp.id === id) Object.assign(currentApp, appData);
    } else {
      appData.createdAt = serverTimestamp();
      appData.likes = 0;
      appData.history = [];
      appData.releaseNotes_ar = 'الإصدار الأول';
      appData.releaseNotes_en = 'First release';
      await addDoc(collection(db, 'apps'), appData);
      showToast('تم نشر التطبيق');
    }
    appForm.reset();
    document.getElementById('edit-id').value = '';
    closeModal('app-modal');
    fetchApps();
    if (currentApp && currentApp.id === id) { buildVersions(currentApp); setActiveVersionUI(currentApp, true, currentApp.coverUrl); }
  } catch (err) {
    console.error(err);
    showToast('تعذّر حفظ التطبيق، حاول تاني');
  } finally {
    btn.disabled = false;
  }
};

document.getElementById('admin-delete-app-btn').onclick = async () => {
  if (!currentApp) return;
  if (!confirm(`حذف "${currentApp.name}" نهائيًا؟`)) return;
  try {
    showToast('جاري الحذف...');
    await deleteDoc(doc(db, 'apps', currentApp.id));
    document.getElementById('app-detail-back').click();
    showToast('تم الحذف');
    fetchApps();
  } catch (err) { console.error(err); showToast('تعذّر الحذف'); }
};

/* ============ أدمن: الإصدارات ============ */
document.getElementById('admin-add-ver-btn').onclick = () => {
  versionEditContext = null;
  document.getElementById('ver-app-id').value = currentApp.id;
  document.getElementById('version-modal-title').textContent = 'إضافة تحديث جديد';
  document.getElementById('version-submit-btn').textContent = 'نشر الإصدار الجديد';
  document.getElementById('new-ver-number').value = '';
  document.getElementById('new-ver-name-ar').value = currentApp.name_ar || currentApp.name || '';
  document.getElementById('new-ver-name-en').value = currentApp.name_en || '';
  document.getElementById('new-ver-url').value = '';
  document.getElementById('new-ver-notes-ar').value = '';
  document.getElementById('new-ver-notes-en').value = '';
  document.getElementById('new-ver-image').value = '';
  openModal('version-modal');
};

function openVersionEditForm(app, idx) {
  versionEditContext = { idx };
  document.getElementById('ver-app-id').value = app.id;
  document.getElementById('version-modal-title').textContent = 'تعديل الإصدار';
  document.getElementById('version-submit-btn').textContent = 'حفظ التعديلات';
  const data = (idx === null) ? app : app.history[idx];
  document.getElementById('new-ver-number').value = data.version || '';
  document.getElementById('new-ver-name-ar').value = data.name_ar || data.name || app.name_ar || app.name || '';
  document.getElementById('new-ver-name-en').value = data.name_en || '';
  document.getElementById('new-ver-url').value = data.fileUrl || '';
  document.getElementById('new-ver-notes-ar').value = data.releaseNotes_ar || data.releaseNotes || '';
  document.getElementById('new-ver-notes-en').value = data.releaseNotes_en || '';
  document.getElementById('new-ver-image').value = '';
  openModal('version-modal');
}

const verForm = document.getElementById('version-form');
if (verForm) verForm.onsubmit = async (e) => {
  e.preventDefault();
  const id = document.getElementById('ver-app-id').value;
  const newVer = document.getElementById('new-ver-number').value;
  const newNameAr = document.getElementById('new-ver-name-ar').value;
  const newNameEn = document.getElementById('new-ver-name-en').value;
  const newUrl = document.getElementById('new-ver-url').value;
  const newNotesAr = document.getElementById('new-ver-notes-ar').value;
  const newNotesEn = document.getElementById('new-ver-notes-en').value;
  const imgF = document.getElementById('new-ver-image').files[0];
  const editCtx = versionEditContext;

  closeModal('version-modal');
  showToast('جاري الحفظ...');

  try {
    const appRef = doc(db, 'apps', id);
    if (editCtx && editCtx.idx !== null) {
      const snap = await getDoc(appRef);
      const history = snap.data().history || [];
      if (!history[editCtx.idx]) throw new Error('not-found');
      const updatedEntry = { ...history[editCtx.idx], version: newVer, name_ar: newNameAr, name_en: newNameEn, fileUrl: newUrl, releaseNotes_ar: newNotesAr, releaseNotes_en: newNotesEn };
      if (imgF) updatedEntry.coverUrl = await fileToBase64(imgF);
      history[editCtx.idx] = updatedEntry;
      await updateDoc(appRef, { history });
      if (currentApp?.id === id) { currentApp.history = history; buildVersions(currentApp); }
      showToast('تم تعديل الإصدار');
    } else if (editCtx && editCtx.idx === null) {
      const updatedFields = { version: newVer, name_ar: newNameAr, name_en: newNameEn, fileUrl: newUrl, releaseNotes_ar: newNotesAr, releaseNotes_en: newNotesEn };
      if (imgF) updatedFields.coverUrl = await fileToBase64(imgF);
      await updateDoc(appRef, updatedFields);
      if (currentApp?.id === id) { Object.assign(currentApp, updatedFields); buildVersions(currentApp); setActiveVersionUI(currentApp, true, currentApp.coverUrl); }
      showToast('تم تعديل الإصدار الحالي');
    } else {
      const snap = await getDoc(appRef);
      if (snap.exists()) {
        const d = snap.data();
        const history = d.history || [];
        history.unshift({ version: d.version, name_ar: d.name_ar || d.name, name_en: d.name_en, coverUrl: d.coverUrl, fileUrl: d.fileUrl, releaseNotes_ar: d.releaseNotes_ar || d.description_ar || d.description, releaseNotes_en: d.releaseNotes_en || d.description_en });
        const updatedData = { version: newVer, name_ar: newNameAr, name_en: newNameEn, fileUrl: newUrl, releaseNotes_ar: newNotesAr, releaseNotes_en: newNotesEn, history, updatedAt: serverTimestamp() };
        if (imgF) updatedData.coverUrl = await fileToBase64(imgF);
        await updateDoc(appRef, updatedData);
        if (currentApp?.id === id) { Object.assign(currentApp, updatedData); buildVersions(currentApp); setActiveVersionUI(currentApp, true, currentApp.coverUrl); }
        showToast('تمت إضافة التحديث بنجاح!');
      }
    }
    verForm.reset();
    versionEditContext = null;
    fetchApps();
  } catch (err) {
    console.error(err);
    showToast('تعذّر حفظ الإصدار، حاول تاني');
  }
};

/* ============ فلاتر وبحث ============ */
document.getElementById('search-input').oninput = (e) => renderApps(document.querySelector('.filter.active').dataset.category, e.target.value);
document.querySelectorAll('.filter').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.filter').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderApps(btn.dataset.category, document.getElementById('search-input').value);
  };
});

/* ============ المصادقة ============ */
let isLoginMode = true;
function openAuthForm(mode) {
  isLoginMode = (mode === 'login');
  document.getElementById('auth-modal-title').textContent = isLoginMode ? t('login') : t('signup');
  document.getElementById('auth-submit-btn').textContent = isLoginMode ? t('loginBtn') : t('signupBtn');
  document.getElementById('auth-name-field').classList.toggle('hidden-el', isLoginMode);
  document.getElementById('auth-switch-label').innerHTML = isLoginMode
    ? `${t('noAccountQ')} <button type="button" class="switch-auth-mode" id="auth-switch-btn">${t('signup')}</button>`
    : `${t('hasAccountQ')} <button type="button" class="switch-auth-mode" id="auth-switch-btn">${t('login')}</button>`;
  document.getElementById('auth-switch-btn').onclick = () => openAuthForm(isLoginMode ? 'signup' : 'login');
  openModal('auth-modal');
  if (!nav.classList.contains('hidden')) toggleNavIfOpen();
}
function toggleNavIfOpen() {
  const navEl = document.querySelector('.nav');
  const menuBtn = document.querySelector('.menu-btn');
  if (navEl && !navEl.classList.contains('hidden')) {
    navEl.classList.add('hidden');
    document.body.classList.remove('lock-screen');
    if (menuBtn) menuBtn.textContent = 'القائمة';
  }
}
const nav = document.querySelector('.nav');

document.getElementById('nav-login-btn').onclick = (e) => { e.preventDefault(); openAuthForm('login'); };
document.getElementById('auth-switch-btn').onclick = () => openAuthForm(isLoginMode ? 'signup' : 'login');

const authForm = document.getElementById('auth-form');
if (authForm) authForm.onsubmit = async (e) => {
  e.preventDefault();
  const email = document.getElementById('auth-email').value;
  const pass = document.getElementById('auth-password').value;
  try {
    if (isLoginMode) {
      await signInWithEmailAndPassword(auth, email, pass);
      showToast('أهلًا بيك تاني!');
    } else {
      const cred = await createUserWithEmailAndPassword(auth, email, pass);
      await setDoc(doc(db, 'users', cred.user.uid), { email: cred.user.email, name: document.getElementById('auth-display-name').value || '' });
      showToast('تم إنشاء الحساب بنجاح');
    }
    closeModal('auth-modal');
    authForm.reset();
  } catch (err) {
    console.error(err);
    showToast('تأكد من صحة البيانات وحاول تاني');
  }
};

document.getElementById('auth-forgot-btn').onclick = async () => {
  const email = document.getElementById('auth-email').value;
  if (!email) { showToast('اكتب بريدك الإلكتروني في الخانة الأول'); return; }
  try {
    await sendPasswordResetEmail(auth, email);
    closeModal('auth-modal');
    showToast('اتبعت رابط استعادة كلمة المرور لبريدك');
  } catch (err) { console.error(err); showToast('تأكد إن البريد مسجل عندنا'); }
};

document.getElementById('nav-logout-btn').onclick = async (e) => {
  e.preventDefault();
  await signOut(auth);
  showToast('تم تسجيل الخروج');
};

onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  if (user) {
    document.getElementById('nav-guest-area').classList.add('hidden-el');
    document.getElementById('nav-user-area').classList.remove('hidden-el');
    document.getElementById('nav-user-email').textContent = user.email;
    isAdmin = false;
    try {
      const aDoc = await getDoc(doc(db, 'admins', user.uid));
      isAdmin = aDoc.exists() && aDoc.data().role === 'admin';
    } catch (e) { isAdmin = false; }
  } else {
    document.getElementById('nav-guest-area').classList.remove('hidden-el');
    document.getElementById('nav-user-area').classList.add('hidden-el');
    isAdmin = false;
  }
  applyAdminUI();
});

/* ============ فورم التواصل (Web3Forms) ============ */
const contactForm = document.getElementById('contact-form');
if (contactForm) contactForm.onsubmit = async (e) => {
  e.preventDefault();
  const statusEl = document.getElementById('contact-status');
  const submitBtn = contactForm.querySelector('button[type="submit"]');
  const name = document.getElementById('contact-name').value;
  const email = document.getElementById('contact-email').value;
  const message = document.getElementById('contact-message').value;

  const L = currentLang();
  statusEl.textContent = L === 'en' ? 'Sending...' : 'جاري الإرسال...';
  statusEl.style.color = 'var(--sub)';
  submitBtn.disabled = true;

  try {
    const formData = new FormData();
    formData.append('access_key', '7f538b9c-791a-498e-8e84-f1b08ced7939');
    formData.append('name', name);
    formData.append('email', email);
    formData.append('message', message);
    formData.append('subject', 'رسالة جديدة من موقع KEMO.DEVELOPER');
    formData.append('from_name', 'KEMO.DEVELOPER');

    const res = await fetch('https://api.web3forms.com/submit', { method: 'POST', body: formData });
    const result = await res.json().catch(() => ({}));

    if (res.ok && result.success) {
      statusEl.textContent = L === 'en' ? "Got it! I'll get back to you soon ✓" : 'تم استلام رسالتك! هترد عليك قريب ✓';
      statusEl.style.color = '#4ade80';
      showToast(L === 'en' ? 'Message sent successfully!' : 'تم إرسال رسالتك بنجاح!');
      contactForm.reset();
    } else {
      console.error('contact failed', res.status, result);
      statusEl.innerHTML = L === 'en'
        ? `Couldn't send it. Email me directly at <a href="mailto:kareemammar2025@gmail.com" style="text-decoration:underline;">this address</a>`
        : `تعذّر الإرسال. تقدر تبعتلي مباشرة على <a href="mailto:kareemammar2025@gmail.com" style="text-decoration:underline;">البريد الإلكتروني</a>`;
      statusEl.style.color = '#ff4d6d';
      showToast(L === 'en' ? 'Could not send the message' : 'تعذّر إرسال الرسالة');
    }
  } catch (err) {
    console.error(err);
    statusEl.innerHTML = L === 'en'
      ? `Couldn't send it. Email me directly at <a href="mailto:kareemammar2025@gmail.com" style="text-decoration:underline;">this address</a>`
      : `تعذّر الإرسال. تقدر تبعتلي مباشرة على <a href="mailto:kareemammar2025@gmail.com" style="text-decoration:underline;">البريد الإلكتروني</a>`;
    statusEl.style.color = '#ff4d6d';
    showToast(L === 'en' ? 'Could not send the message' : 'تعذّر إرسال الرسالة');
  } finally {
    submitBtn.disabled = false;
  }
};

fetchApps();

/* ============ الرسالة الجماعية ============ */
let lastAnnouncement = null;

function renderAnnouncement() {
  const bar = document.getElementById('announcement-bar');
  const textEl = document.getElementById('announcement-text');
  if (!bar || !lastAnnouncement || !lastAnnouncement.active) { bar?.classList.add('hidden-el'); return; }
  const dismissedId = localStorage.getItem('dismissed_announcement');
  if (dismissedId === String(lastAnnouncement.version)) { bar.classList.add('hidden-el'); return; }
  textEl.textContent = pick(lastAnnouncement, 'text');
  bar.classList.remove('hidden-el');
}

async function loadAnnouncement() {
  try {
    const snap = await getDoc(doc(db, 'settings', 'announcement'));
    lastAnnouncement = snap.exists() ? snap.data() : null;
    renderAnnouncement();
  } catch (e) { console.error(e); }
}
loadAnnouncement();

document.getElementById('announcement-close').onclick = () => {
  document.getElementById('announcement-bar').classList.add('hidden-el');
  if (lastAnnouncement) localStorage.setItem('dismissed_announcement', String(lastAnnouncement.version));
};

document.getElementById('nav-admin-broadcast-btn').onclick = (e) => {
  e.preventDefault();
  document.getElementById('broadcast-text-ar').value = lastAnnouncement?.text_ar || '';
  document.getElementById('broadcast-text-en').value = lastAnnouncement?.text_en || '';
  openModal('broadcast-modal');
};

const broadcastForm = document.getElementById('broadcast-form');
if (broadcastForm) broadcastForm.onsubmit = async (e) => {
  e.preventDefault();
  const btn = broadcastForm.querySelector('button[type="submit"]');
  btn.disabled = true;
  try {
    const data = {
      active: true,
      text_ar: document.getElementById('broadcast-text-ar').value,
      text_en: document.getElementById('broadcast-text-en').value,
      version: Date.now(),
    };
    await setDoc(doc(db, 'settings', 'announcement'), data);
    lastAnnouncement = data;
    renderAnnouncement();
    closeModal('broadcast-modal');
    showToast('اتنشرت الرسالة للزوار');
  } catch (err) {
    console.error(err);
    showToast('تعذّر نشر الرسالة، حاول تاني');
  } finally {
    btn.disabled = false;
  }
};

document.getElementById('broadcast-remove-btn').onclick = async () => {
  if (!confirm('تأكيد إلغاء الرسالة الجماعية الحالية؟')) return;
  try {
    await setDoc(doc(db, 'settings', 'announcement'), { active: false }, { merge: true });
    lastAnnouncement = { active: false };
    renderAnnouncement();
    closeModal('broadcast-modal');
    showToast('اتلغت الرسالة');
  } catch (err) { console.error(err); showToast('تعذّر الإلغاء'); }
};

window.addEventListener('langchange', () => {
  renderAnnouncement();
  const activeFilter = document.querySelector('.filter.active')?.dataset.category || 'all';
  const searchVal = document.getElementById('search-input')?.value || '';
  renderApps(activeFilter, searchVal);
  renderProfileDisplay(lastProfileData);
  if (currentApp && !document.getElementById('app-detail-overlay').classList.contains('hidden-el')) {
    setActiveVersionUI(currentApp, true, currentApp.coverUrl);
    buildVersions(currentApp);
  }
});
