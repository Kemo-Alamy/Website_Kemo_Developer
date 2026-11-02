import { firebaseConfig } from './firebase-config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, collection, addDoc, updateDoc, deleteDoc, getDocs, query, orderBy, serverTimestamp, increment } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const toastEl = document.getElementById('toast');
function showToast(msg) {
  if(!toastEl) return;
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  setTimeout(() => toastEl.classList.remove('show'), 3500);
}

function toggleTheme() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  document.documentElement.setAttribute('data-theme', isDark ? 'light' : 'dark');
  localStorage.setItem('kemo-theme', isDark ? 'light' : 'dark');
}
const thBtn = document.getElementById('theme-toggle');
const thBtnM = document.getElementById('theme-toggle-mobile');
if(thBtn) thBtn.onclick = toggleTheme;
if(thBtnM) thBtnM.onclick = toggleTheme;
if (localStorage.getItem('kemo-theme') === 'dark') document.documentElement.setAttribute('data-theme', 'dark');

const menuBtn = document.getElementById('menu-toggle');
if(menuBtn) menuBtn.onclick = () => document.getElementById('nav')?.classList.toggle('open');
document.querySelectorAll('.nav a').forEach(link => { link.onclick = () => document.getElementById('nav')?.classList.remove('open'); });

async function trackVisitor() {
  const vRef = doc(db, 'stats', 'visitors');
  const countEl = document.getElementById('live-visitors-count');
  try {
    if (!sessionStorage.getItem('visited_session')) {
      await setDoc(vRef, { count: increment(1) }, { merge: true });
      sessionStorage.setItem('visited_session', 'true');
    }
    const snap = await getDoc(vRef);
    if (snap.exists() && countEl) countEl.textContent = snap.data().count.toLocaleString('ar-EG');
  } catch(e) { if(countEl) countEl.textContent = '1'; }
}
trackVisitor();

async function loadProfile() {
  try {
    const snap = await getDoc(doc(db, 'settings', 'profile'));
    if (snap.exists()) {
      const d = snap.data();
      const el = (id) => document.getElementById(id);
      if(d.name && el('profile-name')) el('profile-name').textContent = d.name;
      if(d.tag && el('profile-tag')) el('profile-tag').textContent = d.tag;
      if(d.bio && el('profile-bio')) el('profile-bio').textContent = d.bio;
      if(d.img && el('profile-img')) el('profile-img').src = d.img;
      if(d.fb && el('link-facebook')) el('link-facebook').href = d.fb;
      if(d.wa && el('link-whatsapp')) el('link-whatsapp').href = d.wa;
      if(d.ig && el('link-instagram')) el('link-instagram').href = d.ig;
      if(d.gh && el('link-github')) el('link-github').href = d.gh;
      
      if(el('edit-profile-name')) {
        el('edit-profile-name').value = d.name || '';
        el('edit-profile-tag').value = d.tag || '';
        el('edit-profile-bio').value = d.bio || '';
        el('edit-profile-fb').value = d.fb || '';
        el('edit-profile-wa').value = d.wa || '';
        el('edit-profile-ig').value = d.ig || '';
        el('edit-profile-gh').value = d.gh || '';
      }
    }
  } catch(e) {}
}
loadProfile();

const profileForm = document.getElementById('profile-form');
if(profileForm) {
  profileForm.onsubmit = async (e) => {
    e.preventDefault();
    const d = {
      name: document.getElementById('edit-profile-name').value,
      tag: document.getElementById('edit-profile-tag').value,
      bio: document.getElementById('edit-profile-bio').value,
      fb: document.getElementById('edit-profile-fb').value,
      wa: document.getElementById('edit-profile-wa').value,
      ig: document.getElementById('edit-profile-ig').value,
      gh: document.getElementById('edit-profile-gh').value,
    };
    const imgF = document.getElementById('edit-profile-img').files[0];
    if (imgF) d.img = await fileToBase64(imgF);
    await setDoc(doc(db, 'settings', 'profile'), d, { merge: true });
    showToast('تم حفظ الملف الشخصي بنجاح!');
    loadProfile();
  };
}

const showAppBtn = document.getElementById('show-app-form-btn');
const showProfBtn = document.getElementById('show-profile-form-btn');
if(showAppBtn) showAppBtn.onclick = () => { document.getElementById('app-form')?.classList.remove('hidden'); document.getElementById('profile-form')?.classList.add('hidden'); };
if(showProfBtn) showProfBtn.onclick = () => { document.getElementById('app-form')?.classList.add('hidden'); document.getElementById('profile-form')?.classList.remove('hidden'); };

let allApps = [];
let currentApp = null;
let isAdmin = false;

async function fetchApps() {
  const grid = document.getElementById('apps-grid');
  try {
    const snap = await getDocs(query(collection(db, 'apps'), orderBy('createdAt', 'desc')));
    allApps = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if(document.getElementById('app-count')) document.getElementById('app-count').textContent = allApps.length;
    renderApps();
  } catch(e) { if(grid) grid.innerHTML = `<div class="empty-state">خطأ في التحميل</div>`; }
}

function renderApps(filter = 'all', search = '') {
  const grid = document.getElementById('apps-grid');
  if(!grid) return;
  grid.innerHTML = '';
  const filtered = allApps.filter(a => (filter === 'all' || a.category === filter) && a.name.toLowerCase().includes(search.toLowerCase()));

  if (!filtered.length) { grid.innerHTML = `<div class="empty-state">لا توجد تطبيقات</div>`; return; }

  filtered.forEach(app => {
    const card = document.createElement('div');
    card.className = 'app-card reveal visible';
    card.onclick = () => openAppView(app);
    const isLiked = localStorage.getItem(`liked_${app.id}`);
    card.innerHTML = `
      <div class="app-cover">${app.coverUrl ? `<img src="${app.coverUrl}">` : `<div class="cover-placeholder">✦</div>`}<span class="app-tag">${app.category}</span></div>
      <div class="app-body">
        <div class="app-title-line"><h3>${app.name}</h3><span class="app-version">v${app.version || '1.0'}</span></div>
        <p class="app-description">${app.description}</p>
        <div class="app-card-actions">
          <span>التفاصيل والتحميل ←</span>
          <button class="quick-like-btn ${isLiked?'liked':''}" onclick="handleQuickLike(event, '${app.id}')">♥ <span id="card-like-${app.id}">${app.likes || 0}</span></button>
        </div>
      </div>
    `;
    grid.appendChild(card);
  });
}

window.handleQuickLike = async (e, appId) => {
  e.stopPropagation(); 
  const key = `liked_${appId}`;
  const btn = e.currentTarget;
  const span = document.getElementById(`card-like-${appId}`);
  const appIndex = allApps.findIndex(a => a.id === appId);
  
  if (localStorage.getItem(key)) {
    await updateDoc(doc(db, 'apps', appId), { likes: increment(-1) });
    localStorage.removeItem(key);
    btn.classList.remove('liked');
    if(span) span.textContent = parseInt(span.textContent) - 1;
    if(appIndex > -1) allApps[appIndex].likes = (allApps[appIndex].likes || 1) - 1;
    showToast('تم إزالة الإعجاب');
  } else {
    await updateDoc(doc(db, 'apps', appId), { likes: increment(1) });
    localStorage.setItem(key, 'true');
    btn.classList.add('liked');
    if(span) span.textContent = parseInt(span.textContent) + 1;
    if(appIndex > -1) allApps[appIndex].likes = (allApps[appIndex].likes || 0) + 1;
    showToast('شكراً لتفاعلك! ❤️');
  }
};

function openAppView(app) {
  currentApp = app;
  document.getElementById('home-view')?.classList.add('hidden');
  document.getElementById('app-details-view')?.classList.remove('hidden');
  window.scrollTo(0, 0);
  
  document.getElementById('detail-app-category').textContent = app.category;
  
  const likeBtn = document.getElementById('detail-like-btn');
  if(likeBtn) {
    if(localStorage.getItem(`liked_${app.id}`)) likeBtn.classList.add('liked');
    else likeBtn.classList.remove('liked');
  }
  document.getElementById('detail-likes-count').textContent = app.likes || 0;

  setActiveVersionUI({ version: app.version, name: app.name, coverUrl: app.coverUrl, description: app.description, fileUrl: app.fileUrl, releaseNotes: app.releaseNotes }, true, app.coverUrl); 
  buildVersions(app);
  
  document.getElementById('detail-admin-actions')?.classList.toggle('hidden', !isAdmin);
  loadReviews(app.id);
}

document.getElementById('app-details-back').onclick = () => {
  document.getElementById('app-details-view')?.classList.add('hidden');
  document.getElementById('home-view')?.classList.remove('hidden');
};

function setActiveVersionUI(verData, isLatest, fallbackCover) {
  document.getElementById('detail-app-latest-ver').textContent = `الإصدار المعروض: v${verData.version} ${isLatest ? '(الأحدث)' : ''}`;
  document.getElementById('detail-app-name').textContent = verData.name || currentApp.name;
  const coverImg = document.getElementById('detail-app-cover');
  if(coverImg) coverImg.src = verData.coverUrl || fallbackCover || 'https://via.placeholder.com/150';
  document.getElementById('detail-download-btn').href = verData.fileUrl;
  document.getElementById('detail-app-desc').textContent = isLatest ? verData.description : (verData.releaseNotes || 'نسخة سابقة.');
}

function buildVersions(app) {
  const vList = document.getElementById('detail-versions-list');
  if(!vList) return;
  vList.innerHTML = '';
  const mainVer = document.createElement('div');
  mainVer.className = 'version-card-selectable active-version';
  mainVer.innerHTML = `<div><b>v${app.version} (الأخير)</b><br><small style="color:var(--muted)">${app.releaseNotes || 'النسخة الحالية'}</small></div><span>محدد ✓</span>`;
  mainVer.onclick = () => { 
    document.querySelectorAll('.version-card-selectable').forEach(c => { c.classList.remove('active-version'); c.classList.add('dimmed'); }); 
    mainVer.classList.add('active-version'); mainVer.classList.remove('dimmed'); 
    setActiveVersionUI(app, true, app.coverUrl); 
  };
  vList.appendChild(mainVer);

  if (app.history) {
    app.history.forEach(h => {
      const oldVer = document.createElement('div');
      oldVer.className = 'version-card-selectable dimmed';
      oldVer.innerHTML = `<div><b>v${h.version}</b> <small style="color:var(--muted)">(سابق)</small><br><small style="color:var(--muted)">${h.releaseNotes || 'تحديثات سابقة'}</small></div><span>تصفح ↗</span>`;
      oldVer.onclick = () => { 
        document.querySelectorAll('.version-card-selectable').forEach(c => { c.classList.remove('active-version'); c.classList.add('dimmed'); }); 
        oldVer.classList.add('active-version'); oldVer.classList.remove('dimmed'); 
        setActiveVersionUI(h, false, app.coverUrl); 
      };
      vList.appendChild(oldVer);
    });
  }
}

const detailLikeBtn = document.getElementById('detail-like-btn');
if(detailLikeBtn) {
  detailLikeBtn.onclick = async () => {
    if (!currentApp) return;
    const key = `liked_${currentApp.id}`;
    if (localStorage.getItem(key)) {
      await updateDoc(doc(db, 'apps', currentApp.id), { likes: increment(-1) });
      localStorage.removeItem(key);
      detailLikeBtn.classList.remove('liked');
      currentApp.likes = (currentApp.likes || 1) - 1;
      showToast('تم إزالة الإعجاب');
    } else {
      await updateDoc(doc(db, 'apps', currentApp.id), { likes: increment(1) });
      localStorage.setItem(key, 'true');
      detailLikeBtn.classList.add('liked');
      currentApp.likes = (currentApp.likes || 0) + 1;
      showToast('شكراً لتفاعلك! ❤️');
    }
    document.getElementById('detail-likes-count').textContent = currentApp.likes;
    fetchApps();
  };
}

async function loadReviews(appId) {
  const rList = document.getElementById('reviews-list');
  rList.innerHTML = '<small>جاري جلب الآراء...</small>';
  const snap = await getDocs(query(collection(db, `apps/${appId}/reviews`), orderBy('createdAt', 'desc')));
  const revs = snap.docs.map(d => d.data());
  document.getElementById('reviews-count').textContent = revs.length;
  if (!revs.length) { rList.innerHTML = '<small style="color:var(--muted)">لا توجد آراء بعد. كن أول من يعلق!</small>'; return; }
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
  showToast('تم نشر تعليقك للجميع بنجاح!');
  loadReviews(currentApp.id);
};

const adminAddVerBtn = document.getElementById('admin-add-ver-btn');
if(adminAddVerBtn) adminAddVerBtn.onclick = () => {
  document.getElementById('ver-app-id').value = currentApp.id;
  document.getElementById('version-app-title').textContent = currentApp.name;
  document.getElementById('new-ver-name').value = currentApp.name; 
  document.getElementById('version-modal')?.classList.remove('hidden');
};
const verCloseBtn = document.getElementById('version-modal-close');
if(verCloseBtn) verCloseBtn.onclick = () => document.getElementById('version-modal')?.classList.add('hidden');

const verForm = document.getElementById('version-form');
if(verForm) verForm.onsubmit = async (e) => {
  e.preventDefault();
  const id = document.getElementById('ver-app-id').value;
  const newVer = document.getElementById('new-ver-number').value;
  const newName = document.getElementById('new-ver-name').value;
  const newUrl = document.getElementById('new-ver-url').value;
  const newNotes = document.getElementById('new-ver-notes').value;

  document.getElementById('version-modal')?.classList.add('hidden');
  showToast('جاري رفع الإصدار وتحديث الصفحة...'); 

  const appRef = doc(db, 'apps', id);
  const snap = await getDoc(appRef);
  if (snap.exists()) {
    const d = snap.data();
    const history = d.history || [];
    history.unshift({ version: d.version, name: d.name, coverUrl: d.coverUrl, fileUrl: d.fileUrl, releaseNotes: d.releaseNotes || d.description });
    let updatedData = { version: newVer, name: newName, fileUrl: newUrl, releaseNotes: newNotes, history, updatedAt: serverTimestamp() };
    
    const imgF = document.getElementById('new-ver-image').files[0];
    if(imgF) updatedData.coverUrl = await fileToBase64(imgF);
    
    await updateDoc(appRef, updatedData);
    verForm.reset();
    showToast('تمت إضافة التحديث بنجاح!');
    document.getElementById('app-details-back')?.click();
    fetchApps();
  }
};

const delAppBtn = document.getElementById('admin-delete-app-btn');
if(delAppBtn) delAppBtn.onclick = async () => {
  if (confirm(`حذف "${currentApp.name}" نهائياً؟`)) {
    document.getElementById('app-details-back')?.click();
    showToast('جاري الحذف...');
    await deleteDoc(doc(db, 'apps', currentApp.id));
    showToast('تم الحذف بنجاح!');
    fetchApps();
  }
};

const editAppBtn = document.getElementById('admin-edit-app-btn');
if(editAppBtn) editAppBtn.onclick = () => {
  document.getElementById('app-details-back')?.click();
  document.getElementById('edit-id').value = currentApp.id;
  document.getElementById('app-name').value = currentApp.name;
  document.getElementById('app-category').value = currentApp.category;
  document.getElementById('app-version').value = currentApp.version;
  document.getElementById('app-file').value = currentApp.fileUrl;
  document.getElementById('app-description').value = currentApp.description;
  document.getElementById('cancel-edit')?.classList.remove('hidden');
  window.scrollTo({ top: document.getElementById('admin-panel').offsetTop, behavior: 'smooth' });
};

const cancelEditBtn = document.getElementById('cancel-edit');
if(cancelEditBtn) cancelEditBtn.onclick = () => {
  document.getElementById('app-form')?.reset();
  document.getElementById('edit-id').value = '';
  cancelEditBtn.classList.add('hidden');
};

const appForm = document.getElementById('app-form');
if(appForm) appForm.onsubmit = async (e) => {
  e.preventDefault();
  const id = document.getElementById('edit-id').value;
  showToast('جاري الحفظ...');
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
  appForm.reset();
  document.getElementById('cancel-edit')?.click();
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

document.getElementById('search-input').oninput = e => renderApps(document.querySelector('.filter.active').dataset.category, e.target.value);
document.querySelectorAll('.filter').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.filter').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderApps(btn.dataset.category, document.getElementById('search-input').value);
  };
});

// نظام تسجيل الدخول وإخفاء زر نسيت كلمة المرور بذكاء
let isLoginMode = true;
function openAuthForm(mode) {
  isLoginMode = (mode === 'login');
  const title = document.getElementById('auth-title');
  if(title) title.textContent = isLoginMode ? 'تسجيل الدخول' : 'إنشاء حساب جديد';
  
  const submitBtn = document.getElementById('auth-submit');
  if(submitBtn) submitBtn.textContent = isLoginMode ? 'دخول' : 'إنشاء حساب';
  
  const switchLabel = document.getElementById('switch-label');
  if(switchLabel) switchLabel.textContent = isLoginMode ? 'ليس لديك حساب؟' : 'لديك حساب بالفعل؟';
  
  const switchBtn = document.getElementById('auth-switch');
  if(switchBtn) switchBtn.textContent = isLoginMode ? 'حساب جديد' : 'تسجيل الدخول';
  
  // إخفاء/إظهار حقل الاسم
  document.getElementById('name-field')?.classList.toggle('hidden', isLoginMode);
  
  // إخفاء زر "نسيت كلمة المرور" في صفحة إنشاء حساب وإظهاره في صفحة الدخول
  const forgotBtn = document.getElementById('forgot-password');
  if(forgotBtn) {
    if (isLoginMode) {
      forgotBtn.classList.remove('hidden');
    } else {
      forgotBtn.classList.add('hidden');
    }
  }

  document.getElementById('auth-modal')?.classList.remove('hidden');
  document.getElementById('nav')?.classList.remove('open');
}

const buttonsToOpenAuth = ['login-btn', 'signup-btn', 'mobile-login-btn', 'mobile-signup-btn'];
buttonsToOpenAuth.forEach(id => {
  const btn = document.getElementById(id);
  if(btn) btn.onclick = () => openAuthForm(id.includes('signup') ? 'signup' : 'login');
});

const authSwitch = document.getElementById('auth-switch');
if(authSwitch) authSwitch.onclick = (e) => { e.preventDefault(); openAuthForm(isLoginMode ? 'signup' : 'login'); };

const authClose = document.getElementById('auth-close');
if(authClose) authClose.onclick = () => document.getElementById('auth-modal')?.classList.add('hidden');

// تسجيل الدخول / إنشاء حساب
const authFormLog = document.getElementById('auth-form');
if(authFormLog) authFormLog.onsubmit = async (e) => {
  e.preventDefault();
  const email = document.getElementById('auth-email').value;
  const pass = document.getElementById('auth-password').value;
  try {
    if (isLoginMode) {
      await signInWithEmailAndPassword(auth, email, pass);
      showToast('أهلاً بك مجدداً!');
    } else {
      const cred = await createUserWithEmailAndPassword(auth, email, pass);
      await setDoc(doc(db, 'users', cred.user.uid), { email: cred.user.email, name: document.getElementById('display-name').value || '' });
      showToast('تم إنشاء الحساب بنجاح');
    }
    document.getElementById('auth-modal')?.classList.add('hidden');
    authFormLog.reset();
  } catch(err) { showToast('خطأ: تأكد من صحة البيانات!'); }
};

// حل مشكلة نسيت كلمة المرور (فصل الزرار عن الفورم ليتم التنفيذ مباشرة)
const forgotBtnMain = document.getElementById('forgot-password');
if(forgotBtnMain) {
  forgotBtnMain.onclick = async (e) => {
    e.preventDefault(); // منع الفورم من عمل Reload للصفحة
    const email = document.getElementById('auth-email').value;
    if(!email) {
      showToast('يرجى كتابة بريدك الإلكتروني في الخانة أولاً، ثم الضغط هنا');
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      document.getElementById('auth-modal')?.classList.add('hidden');
      showToast('تم إرسال رابط آمن لاستعادة كلمة المرور إلى بريدك!');
    } catch(err) { 
      showToast('حدث خطأ: تأكد أن البريد مكتوب بشكل صحيح ومسجل لدينا'); 
    }
  };
}

onAuthStateChanged(auth, async user => {
  const toggleVisibility = (id, hide) => { const el = document.getElementById(id); if(el) hide ? el.classList.add('hidden') : el.classList.remove('hidden'); };
  
  if (user) {
    if(document.getElementById('user-email')) { document.getElementById('user-email').textContent = user.email; document.getElementById('user-email').style.display = 'block'; }
    if(document.getElementById('mobile-user-email')) { document.getElementById('mobile-user-email').textContent = user.email; document.getElementById('mobile-user-email').style.display = 'block'; }
    
    toggleVisibility('login-btn', true); toggleVisibility('signup-btn', true);
    toggleVisibility('mobile-login-btn', true); toggleVisibility('mobile-signup-btn', true);
    toggleVisibility('logout-btn', false); toggleVisibility('mobile-logout-btn', false);

    try {
      const aDoc = await getDoc(doc(db, 'admins', user.uid));
      if (aDoc.exists() && aDoc.data().role === 'admin') {
        isAdmin = true;
        toggleVisibility('admin-panel', false);
      }
    } catch(e) { isAdmin = false; }
  } else {
    if(document.getElementById('user-email')) { document.getElementById('user-email').textContent = ''; document.getElementById('user-email').style.display = 'none'; }
    if(document.getElementById('mobile-user-email')) { document.getElementById('mobile-user-email').textContent = ''; document.getElementById('mobile-user-email').style.display = 'none'; }
    
    toggleVisibility('login-btn', false); toggleVisibility('signup-btn', false);
    toggleVisibility('mobile-login-btn', false); toggleVisibility('mobile-signup-btn', false);
    toggleVisibility('logout-btn', true); toggleVisibility('mobile-logout-btn', true);
    toggleVisibility('admin-panel', true);
    isAdmin = false;
  }
});

const logoutBtns = ['logout-btn', 'mobile-logout-btn'];
logoutBtns.forEach(id => {
  const btn = document.getElementById(id);
  if(btn) btn.onclick = async () => { await signOut(auth); showToast('تم تسجيل الخروج'); };
});

const formC = document.getElementById('contact-form');
if(formC) formC.onsubmit = e => {
  e.preventDefault();
  document.getElementById('contact-status').textContent = 'تم الإرسال بنجاح!';
  e.target.reset();
  setTimeout(() => document.getElementById('contact-status').textContent = '', 4000);
};

fetchApps();
