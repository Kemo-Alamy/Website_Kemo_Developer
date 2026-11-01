import { firebaseConfig } from './firebase-config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, collection, addDoc, updateDoc, deleteDoc, getDocs, query, orderBy, serverTimestamp, increment } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const toastEl = document.getElementById('toast');
function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  setTimeout(() => toastEl.classList.remove('show'), 3000);
}

document.getElementById('theme-toggle').onclick = () => {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  document.documentElement.setAttribute('data-theme', isDark ? 'light' : 'dark');
  localStorage.setItem('kemo-theme', isDark ? 'light' : 'dark');
};
if (localStorage.getItem('kemo-theme') === 'dark') document.documentElement.setAttribute('data-theme', 'dark');

document.getElementById('menu-toggle').onclick = () => document.getElementById('nav').classList.toggle('open');
document.getElementById('year').textContent = new Date().getFullYear();

const observer = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); }), { threshold: 0.1 });
document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

// 1. عداد الزوار الحقيقي
async function trackVisitor() {
  const vRef = doc(db, 'stats', 'visitors');
  try {
    if (!sessionStorage.getItem('visited_session')) {
      await setDoc(vRef, { count: increment(1) }, { merge: true });
      sessionStorage.setItem('visited_session', 'true');
    }
    const snap = await getDoc(vRef);
    if (snap.exists()) document.getElementById('live-visitors-count').textContent = snap.data().count.toLocaleString('ar-EG');
  } catch(e) { document.getElementById('live-visitors-count').textContent = '1'; }
}
trackVisitor();

// 2. بيانات المطور
async function loadProfile() {
  try {
    const snap = await getDoc(doc(db, 'settings', 'profile'));
    if (snap.exists()) {
      const d = snap.data();
      if(d.name) document.getElementById('profile-name').textContent = d.name;
      if(d.tag) document.getElementById('profile-tag').textContent = d.tag;
      if(d.bio) document.getElementById('profile-bio').textContent = d.bio;
      if(d.img) document.getElementById('profile-img').src = d.img;
      if(d.fb) document.getElementById('link-facebook').href = d.fb;
      if(d.wa) document.getElementById('link-whatsapp').href = d.wa;
      if(d.gh) document.getElementById('link-github').href = d.gh;

      document.getElementById('edit-profile-name').value = d.name || '';
      document.getElementById('edit-profile-tag').value = d.tag || '';
      document.getElementById('edit-profile-bio').value = d.bio || '';
      document.getElementById('edit-profile-fb').value = d.fb || '';
      document.getElementById('edit-profile-wa').value = d.wa || '';
      document.getElementById('edit-profile-gh').value = d.gh || '';
    }
  } catch(e) {}
}
loadProfile();

document.getElementById('profile-form').onsubmit = async (e) => {
  e.preventDefault();
  const d = {
    name: document.getElementById('edit-profile-name').value,
    tag: document.getElementById('edit-profile-tag').value,
    bio: document.getElementById('edit-profile-bio').value,
    fb: document.getElementById('edit-profile-fb').value,
    wa: document.getElementById('edit-profile-wa').value,
    gh: document.getElementById('edit-profile-gh').value,
  };
  const imgF = document.getElementById('edit-profile-img').files[0];
  if (imgF) d.img = await fileToBase64(imgF);
  await setDoc(doc(db, 'settings', 'profile'), d, { merge: true });
  showToast('تم حفظ الملف الشخصي!');
  loadProfile();
};

document.getElementById('show-app-form-btn').onclick = () => {
  document.getElementById('app-form').classList.remove('hidden');
  document.getElementById('profile-form').classList.add('hidden');
};
document.getElementById('show-profile-form-btn').onclick = () => {
  document.getElementById('app-form').classList.add('hidden');
  document.getElementById('profile-form').classList.remove('hidden');
};

// 3. التطبيقات وتفاصيلها (صفحة كاملة)
let allApps = [];
let currentApp = null;
let isAdmin = false;

async function fetchApps() {
  try {
    const snap = await getDocs(query(collection(db, 'apps'), orderBy('createdAt', 'desc')));
    allApps = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    document.getElementById('app-count').textContent = allApps.length;
    renderApps();
  } catch(e) { document.getElementById('apps-grid').innerHTML = `<div class="empty-state">خطأ في التحميل</div>`; }
}

function renderApps(filter = 'all', search = '') {
  const grid = document.getElementById('apps-grid');
  grid.innerHTML = '';
  const filtered = allApps.filter(a => (filter === 'all' || a.category === filter) && a.name.toLowerCase().includes(search.toLowerCase()));

  if (!filtered.length) { grid.innerHTML = `<div class="empty-state">لا توجد تطبيقات</div>`; return; }

  filtered.forEach(app => {
    const card = document.createElement('div');
    card.className = 'app-card reveal visible';
    // فتح الصفحة عند الضغط على الكارت
    card.onclick = () => openAppView(app);
    card.innerHTML = `
      <div class="app-cover">
        ${app.coverUrl ? `<img src="${app.coverUrl}" alt="${app.name}">` : `<div class="cover-placeholder">✦</div>`}
        <span class="app-tag">${app.category}</span>
      </div>
      <div class="app-body">
        <div class="app-title-line">
          <h3>${app.name}</h3>
          <span class="app-version">v${app.version || '1.0'}</span>
        </div>
        <p class="app-description">${app.description}</p>
        <div class="app-card-actions">
          <span>التفاصيل والتحميل ←</span>
          <button class="quick-like-btn" onclick="handleQuickLike(event, '${app.id}')">♥ <span id="card-like-${app.id}">${app.likes || 0}</span></button>
        </div>
      </div>
    `;
    grid.appendChild(card);
  });
}

// اللايك السريع من الخارج بدون فتح الصفحة
window.handleQuickLike = async (e, appId) => {
  e.stopPropagation(); // منع فتح صفحة التطبيق
  const key = `liked_${appId}`;
  if (localStorage.getItem(key)) return showToast('لقد تفاعلت من قبل!');
  await updateDoc(doc(db, 'apps', appId), { likes: increment(1) });
  localStorage.setItem(key, 'true');
  const span = document.getElementById(`card-like-${appId}`);
  span.textContent = parseInt(span.textContent) + 1;
  showToast('إعجاب سريع ❤️!');
  
  // تحديث البيانات داخلياً عشان لو فتح الصفحة يلاقي اللايك متحدث
  const appIndex = allApps.findIndex(a => a.id === appId);
  if(appIndex > -1) allApps[appIndex].likes = (allApps[appIndex].likes || 0) + 1;
};

// فتح صفحة التطبيق (Full Page) وإخفاء الرئيسية
function openAppView(app) {
  currentApp = app;
  document.getElementById('home-view').classList.add('hidden'); // إخفاء الرئيسية
  const detailsView = document.getElementById('app-details-view');
  detailsView.classList.remove('hidden'); // إظهار صفحة التفاصيل
  window.scrollTo(0, 0);

  document.getElementById('detail-app-name').textContent = app.name;
  document.getElementById('detail-app-category').textContent = app.category;
  document.getElementById('detail-app-desc').textContent = app.description;
  document.getElementById('detail-app-cover').src = app.coverUrl || '';
  document.getElementById('detail-likes-count').textContent = app.likes || 0;

  setActiveVersion(app.version, app.fileUrl);
  buildVersions(app);

  if (isAdmin) document.getElementById('detail-admin-actions').classList.remove('hidden');
  else document.getElementById('detail-admin-actions').classList.add('hidden');

  loadReviews(app.id);
}

// إغلاق صفحة التطبيق والعودة للرئيسية
document.getElementById('app-details-back').onclick = () => {
  document.getElementById('app-details-view').classList.add('hidden');
  document.getElementById('home-view').classList.remove('hidden');
};

function setActiveVersion(ver, url) {
  document.getElementById('detail-app-latest-ver').textContent = `الإصدار المختار: v${ver}`;
  document.getElementById('detail-download-btn').href = url;
  document.getElementById('detail-download-btn').innerHTML = `تثبيت وتحميل (v${ver}) ⤓`;
}

function buildVersions(app) {
  const vList = document.getElementById('detail-versions-list');
  vList.innerHTML = '';
  
  const mainVer = document.createElement('div');
  mainVer.className = 'version-card-selectable active-version';
  mainVer.innerHTML = `<div><b>v${app.version} (الأخير)</b><br><small style="color:var(--muted)">${app.releaseNotes || 'تحديثات الأداء'}</small></div><span>محدد ✓</span>`;
  mainVer.onclick = () => { highlightVer(mainVer); setActiveVersion(app.version, app.fileUrl); };
  vList.appendChild(mainVer);

  if (app.history) {
    app.history.forEach(h => {
      const oldVer = document.createElement('div');
      oldVer.className = 'version-card-selectable dimmed';
      oldVer.innerHTML = `<div><b>v${h.version}</b> <small style="color:var(--muted)">(سابق)</small><br><small style="color:var(--muted)">${h.releaseNotes || 'نسخة قديمة'}</small></div><span>اختيار ↗</span>`;
      oldVer.onclick = () => { highlightVer(oldVer); setActiveVersion(h.version, h.fileUrl); };
      vList.appendChild(oldVer);
    });
  }
}

function highlightVer(card) {
  document.querySelectorAll('.version-card-selectable').forEach(c => { c.classList.remove('active-version'); c.classList.add('dimmed'); });
  card.classList.add('active-version'); card.classList.remove('dimmed');
}

// لايك من داخل الصفحة
document.getElementById('detail-like-btn').onclick = async () => {
  if (!currentApp) return;
  const key = `liked_${currentApp.id}`;
  if (localStorage.getItem(key)) return showToast('تفاعلت بالفعل!');
  await updateDoc(doc(db, 'apps', currentApp.id), { likes: increment(1) });
  localStorage.setItem(key, 'true');
  currentApp.likes = (currentApp.likes || 0) + 1;
  document.getElementById('detail-likes-count').textContent = currentApp.likes;
  showToast('شكراً لتفاعلك! ❤️');
  fetchApps(); // لتحديث الكروت في الرئيسية بالخلفية
};

async function loadReviews(appId) {
  const rList = document.getElementById('reviews-list');
  rList.innerHTML = '<small>جاري جلب الآراء...</small>';
  const snap = await getDocs(query(collection(db, `apps/${appId}/reviews`), orderBy('createdAt', 'desc')));
  const revs = snap.docs.map(d => d.data());
  document.getElementById('reviews-count').textContent = revs.length;
  if (!revs.length) { rList.innerHTML = '<small>لا توجد آراء بعد.</small>'; return; }
  rList.innerHTML = '';
  revs.forEach(r => { rList.innerHTML += `<div class="review-item"><b>${r.name}</b><p>${r.text}</p></div>`; });
}

document.getElementById('add-review-form').onsubmit = async (e) => {
  e.preventDefault();
  await addDoc(collection(db, `apps/${currentApp.id}/reviews`), {
    name: document.getElementById('review-user-name').value,
    text: document.getElementById('review-user-text').value,
    createdAt: serverTimestamp()
  });
  document.getElementById('add-review-form').reset();
  showToast('تم النشر بنجاح!');
  loadReviews(currentApp.id);
};

// 4. أدوات الأدمن
document.getElementById('admin-add-ver-btn').onclick = () => {
  document.getElementById('ver-app-id').value = currentApp.id;
  document.getElementById('version-app-title').textContent = currentApp.name;
  document.getElementById('version-modal').classList.remove('hidden');
};
document.getElementById('version-modal-close').onclick = () => document.getElementById('version-modal').classList.add('hidden');

// رفع إصدار جديد مع إمكانية تحديث الصورة ومعلومات التحديث
document.getElementById('version-form').onsubmit = async (e) => {
  e.preventDefault();
  const id = document.getElementById('ver-app-id').value;
  const newVer = document.getElementById('new-ver-number').value;
  const newUrl = document.getElementById('new-ver-url').value;
  const newNotes = document.getElementById('new-ver-notes').value;

  const appRef = doc(db, 'apps', id);
  const snap = await getDoc(appRef);
  if (snap.exists()) {
    const d = snap.data();
    const history = d.history || [];
    // حفظ الإصدار القديم في السجل
    history.unshift({ version: d.version, fileUrl: d.fileUrl, releaseNotes: d.releaseNotes || 'تحديثات سابقة' });
    
    let updatedData = { version: newVer, fileUrl: newUrl, releaseNotes: newNotes, history, updatedAt: serverTimestamp() };
    
    const imgF = document.getElementById('new-ver-image').files[0];
    if(imgF) updatedData.coverUrl = await fileToBase64(imgF);

    await updateDoc(appRef, updatedData);
    document.getElementById('version-modal').classList.add('hidden');
    document.getElementById('version-form').reset();
    showToast('تمت إضافة التحديث بنجاح!');
    
    // إغلاق صفحة التطبيق وتحديث الرئيسية لتجنب الأخطاء
    document.getElementById('app-details-back').click();
    fetchApps();
  }
};

document.getElementById('admin-delete-app-btn').onclick = async () => {
  if (confirm(`حذف "${currentApp.name}" نهائياً؟`)) {
    await deleteDoc(doc(db, 'apps', currentApp.id));
    document.getElementById('app-details-back').click();
    showToast('تم الحذف!');
    fetchApps();
  }
};

document.getElementById('admin-edit-app-btn').onclick = () => {
  document.getElementById('app-details-back').click(); // نرجع للرئيسية
  document.getElementById('edit-id').value = currentApp.id;
  document.getElementById('app-name').value = currentApp.name;
  document.getElementById('app-category').value = currentApp.category;
  document.getElementById('app-version').value = currentApp.version;
  document.getElementById('app-file').value = currentApp.fileUrl;
  document.getElementById('app-description').value = currentApp.description;
  document.getElementById('cancel-edit').classList.remove('hidden');
  document.getElementById('save-app').textContent = 'حفظ التعديلات';
  window.scrollTo({ top: document.getElementById('admin-panel').offsetTop, behavior: 'smooth' });
};

document.getElementById('cancel-edit').onclick = () => {
  document.getElementById('app-form').reset();
  document.getElementById('edit-id').value = '';
  document.getElementById('cancel-edit').classList.add('hidden');
  document.getElementById('save-app').textContent = 'نشر التطبيق';
};

document.getElementById('app-form').onsubmit = async (e) => {
  e.preventDefault();
  const id = document.getElementById('edit-id').value;
  const appData = {
    name: document.getElementById('app-name').value,
    category: document.getElementById('app-category').value,
    version: document.getElementById('app-version').value,
    description: document.getElementById('app-description').value,
    fileUrl: document.getElementById('app-file').value,
  };
  const imgF = document.getElementById('app-image').files[0];
  if (imgF) appData.coverUrl = await fileToBase64(imgF);

  if (id) {
    await updateDoc(doc(db, 'apps', id), appData);
    showToast('تم تحديث التطبيق');
  } else {
    appData.createdAt = serverTimestamp();
    appData.likes = 0;
    appData.history = [];
    appData.releaseNotes = "الإصدار الأول";
    await addDoc(collection(db, 'apps'), appData);
    showToast('تم النشر بنجاح');
  }
  document.getElementById('app-form').reset();
  document.getElementById('cancel-edit').click();
  fetchApps();
};

function fileToBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = e => rej(e);
    r.readAsDataURL(file);
  });
}

// فلاتر البحث
document.getElementById('search-input').oninput = e => renderApps(document.querySelector('.filter.active').dataset.category, e.target.value);
document.querySelectorAll('.filter').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.filter').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderApps(btn.dataset.category, document.getElementById('search-input').value);
  };
});
document.querySelectorAll('.tool-tile').forEach(tile => {
  tile.onclick = () => {
    const cat = tile.dataset.pick;
    document.getElementById('apps').scrollIntoView();
    document.querySelectorAll('.filter').forEach(b => b.classList.remove('active'));
    const t = document.querySelector(`.filter[data-category="${cat}"]`);
    if(t) t.classList.add('active');
    renderApps(cat, document.getElementById('search-input').value);
  };
});

// ===================== 5. نظام المصادقة (إصلاح الأزرار) =====================
let isLoginMode = true;

function openAuthForm(mode) {
  isLoginMode = (mode === 'login');
  document.getElementById('auth-title').textContent = isLoginMode ? 'تسجيل الدخول' : 'إنشاء حساب';
  document.getElementById('auth-submit').textContent = isLoginMode ? 'دخول' : 'حساب جديد';
  document.getElementById('switch-label').textContent = isLoginMode ? 'ليس لديك حساب؟' : 'لديك حساب بالفعل؟';
  document.getElementById('auth-switch').textContent = isLoginMode ? 'إنشاء حساب جديد' : 'تسجيل الدخول';
  document.getElementById('name-field').classList.toggle('hidden', isLoginMode);
  document.getElementById('auth-modal').classList.remove('hidden');
}

// أزرار الهيدر
document.getElementById('login-btn').onclick = () => openAuthForm('login');
document.getElementById('signup-btn').onclick = () => openAuthForm('signup');
// زر التبديل داخل الفورم
document.getElementById('auth-switch').onclick = (e) => {
  e.preventDefault();
  openAuthForm(isLoginMode ? 'signup' : 'login');
};
document.getElementById('auth-close').onclick = () => document.getElementById('auth-modal').classList.add('hidden');

document.getElementById('auth-form').onsubmit = async (e) => {
  e.preventDefault();
  const email = document.getElementById('auth-email').value;
  const pass = document.getElementById('auth-password').value;
  try {
    if (isLoginMode) {
      await signInWithEmailAndPassword(auth, email, pass);
      showToast('تم تسجيل الدخول بنجاح');
    } else {
      const cred = await createUserWithEmailAndPassword(auth, email, pass);
      await setDoc(doc(db, 'users', cred.user.uid), { email: cred.user.email, name: document.getElementById('display-name').value || '' });
      showToast('تم إنشاء الحساب وتسجيل الدخول');
    }
    document.getElementById('auth-modal').classList.add('hidden');
    document.getElementById('auth-form').reset();
  } catch(err) {
    document.getElementById('auth-message').textContent = 'خطأ: ' + err.message;
  }
};

// زر استعادة كلمة المرور (شغال 100%)
document.getElementById('forgot-password').onclick = async (e) => {
  e.preventDefault();
  const email = document.getElementById('auth-email').value;
  if(!email) return showToast('يرجى كتابة البريد الإلكتروني أولاً في الخانة المخصصة');
  try {
    await sendPasswordResetEmail(auth, email);
    showToast('تم إرسال رابط استعادة كلمة المرور إلى بريدك!');
  } catch(err) {
    showToast('حدث خطأ: تأكد من صحة البريد');
  }
};

document.getElementById('logout-btn').onclick = async () => {
  await signOut(auth);
  showToast('تم تسجيل الخروج');
};

onAuthStateChanged(auth, async user => {
  if (user) {
    document.getElementById('user-email').textContent = user.email;
    document.getElementById('login-btn').classList.add('hidden');
    document.getElementById('signup-btn').classList.add('hidden');
    document.getElementById('logout-btn').classList.remove('hidden');
    try {
      const aDoc = await getDoc(doc(db, 'admins', user.uid));
      if (aDoc.exists() && aDoc.data().role === 'admin') {
        isAdmin = true;
        document.getElementById('admin-panel').classList.remove('hidden');
      }
    } catch(e) { isAdmin = false; }
  } else {
    document.getElementById('user-email').textContent = '';
    document.getElementById('login-btn').classList.remove('hidden');
    document.getElementById('signup-btn').classList.remove('hidden');
    document.getElementById('logout-btn').classList.add('hidden');
    document.getElementById('admin-panel').classList.add('hidden');
    isAdmin = false;
  }
});

document.getElementById('contact-form').onsubmit = e => {
  e.preventDefault();
  document.getElementById('contact-status').textContent = 'تم إرسال رسالتك بنجاح!';
  e.target.reset();
  setTimeout(() => document.getElementById('contact-status').textContent = '', 4000);
};

fetchApps();
