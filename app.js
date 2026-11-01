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
  setTimeout(() => toastEl.classList.remove('show'), 3500);
}

// الثيم (Dark/Light)
function toggleTheme() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  document.documentElement.setAttribute('data-theme', isDark ? 'light' : 'dark');
  localStorage.setItem('kemo-theme', isDark ? 'light' : 'dark');
}
document.getElementById('theme-toggle').onclick = toggleTheme;
document.getElementById('theme-toggle-mobile').onclick = toggleTheme;
if (localStorage.getItem('kemo-theme') === 'dark') document.documentElement.setAttribute('data-theme', 'dark');

// فتح القائمة في الموبايل
document.getElementById('menu-toggle').onclick = () => document.getElementById('nav').classList.toggle('open');

// إخفاء القائمة عند النقر على أي رابط داخلها
document.querySelectorAll('.nav a').forEach(link => {
  link.onclick = () => document.getElementById('nav').classList.remove('open');
});

// العداد الحقيقي
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

// تحميل بيانات المطور بدون أي أخطاء توقف الصفحة
async function loadProfile() {
  try {
    const snap = await getDoc(doc(db, 'settings', 'profile'));
    if (snap.exists()) {
      const d = snap.data();
      if(d.name) document.getElementById('profile-name').textContent = d.name;
      if(d.tag) document.getElementById('profile-tag').textContent = d.tag;
      if(d.bio) document.getElementById('profile-bio').textContent = d.bio;
      if(d.img) document.getElementById('profile-img').src = d.img;
      
      // هنا تفادينا خطأ غياب الرابط
      if(d.fb && document.getElementById('link-facebook')) document.getElementById('link-facebook').href = d.fb;
      if(d.wa && document.getElementById('link-whatsapp')) document.getElementById('link-whatsapp').href = d.wa;
      if(d.ig && document.getElementById('link-instagram')) document.getElementById('link-instagram').href = d.ig;
      if(d.gh && document.getElementById('link-github')) document.getElementById('link-github').href = d.gh;

      if(document.getElementById('edit-profile-name')) {
        document.getElementById('edit-profile-name').value = d.name || '';
        document.getElementById('edit-profile-tag').value = d.tag || '';
        document.getElementById('edit-profile-bio').value = d.bio || '';
        document.getElementById('edit-profile-fb').value = d.fb || '';
        document.getElementById('edit-profile-wa').value = d.wa || '';
        document.getElementById('edit-profile-ig').value = d.ig || '';
        document.getElementById('edit-profile-gh').value = d.gh || '';
      }
    }
  } catch(e) { console.error("Profile Load Error:", e); }
}
loadProfile();

// التطبيقات (التصليح اللي هيعالج مشكلة جاري التجهيز)
let allApps = [];
let currentApp = null;
let isAdmin = false;

async function fetchApps() {
  try {
    const snap = await getDocs(query(collection(db, 'apps'), orderBy('createdAt', 'desc')));
    allApps = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    document.getElementById('app-count').textContent = allApps.length;
    renderApps(); // ده هيرسم التطبيقات فوراً
  } catch(e) { 
    console.error(e);
    document.getElementById('apps-grid').innerHTML = `<div class="empty-state">حدث خطأ في جلب البيانات</div>`; 
  }
}

function renderApps(filter = 'all', search = '') {
  const grid = document.getElementById('apps-grid');
  grid.innerHTML = '';
  const filtered = allApps.filter(a => (filter === 'all' || a.category === filter) && a.name.toLowerCase().includes(search.toLowerCase()));

  if (!filtered.length) { grid.innerHTML = `<div class="empty-state">لا توجد تطبيقات</div>`; return; }

  filtered.forEach(app => {
    const card = document.createElement('div');
    card.className = 'app-card reveal visible';
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

// اللايك
window.handleQuickLike = async (e, appId) => {
  e.stopPropagation(); 
  const key = `liked_${appId}`;
  if (localStorage.getItem(key)) return showToast('لقد قمت بالإعجاب مسبقاً!');
  await updateDoc(doc(db, 'apps', appId), { likes: increment(1) });
  localStorage.setItem(key, 'true');
  const span = document.getElementById(`card-like-${appId}`);
  span.textContent = parseInt(span.textContent) + 1;
  showToast('شكراً لتفاعلك! ❤️');
  const appIndex = allApps.findIndex(a => a.id === appId);
  if(appIndex > -1) allApps[appIndex].likes = (allApps[appIndex].likes || 0) + 1;
};

// فتح التطبيق
function openAppView(app) {
  currentApp = app;
  document.getElementById('home-view').classList.add('hidden');
  document.getElementById('app-details-view').classList.remove('hidden');
  window.scrollTo(0, 0);
  document.getElementById('detail-app-category').textContent = app.category;
  document.getElementById('detail-likes-count').textContent = app.likes || 0;
  setActiveVersionUI({ version: app.version, name: app.name, coverUrl: app.coverUrl, description: app.description, fileUrl: app.fileUrl, releaseNotes: app.releaseNotes }, true); 
  buildVersions(app);
  document.getElementById('detail-admin-actions').classList.toggle('hidden', !isAdmin);
  loadReviews(app.id);
}

document.getElementById('app-details-back').onclick = () => {
  document.getElementById('app-details-view').classList.add('hidden');
  document.getElementById('home-view').classList.remove('hidden');
};

function setActiveVersionUI(verData, isLatest = false) {
  document.getElementById('detail-app-latest-ver').textContent = `الإصدار المعروض: v${verData.version} ${isLatest ? '(الأحدث)' : ''}`;
  document.getElementById('detail-app-name').textContent = verData.name;
  document.getElementById('detail-app-cover').src = verData.coverUrl || 'https://via.placeholder.com/150';
  document.getElementById('detail-download-btn').href = verData.fileUrl;
  document.getElementById('detail-app-desc').textContent = isLatest ? verData.description : (verData.releaseNotes || 'نسخة سابقة.');
}

function buildVersions(app) {
  const vList = document.getElementById('detail-versions-list');
  vList.innerHTML = '';
  const mainVer = document.createElement('div');
  mainVer.className = 'version-card-selectable active-version';
  mainVer.innerHTML = `<div><b>v${app.version} (الأخير)</b><br><small style="color:var(--muted)">${app.releaseNotes || 'النسخة الحالية'}</small></div><span>محدد ✓</span>`;
  mainVer.onclick = () => { document.querySelectorAll('.version-card-selectable').forEach(c => { c.classList.remove('active-version'); c.classList.add('dimmed'); }); mainVer.classList.add('active-version'); mainVer.classList.remove('dimmed'); setActiveVersionUI(app, true); };
  vList.appendChild(mainVer);

  if (app.history) {
    app.history.forEach(h => {
      const oldVer = document.createElement('div');
      oldVer.className = 'version-card-selectable dimmed';
      oldVer.innerHTML = `<div><b>v${h.version}</b> <small style="color:var(--muted)">(سابق)</small><br><small style="color:var(--muted)">${h.releaseNotes || 'تحديثات سابقة'}</small></div><span>تصفح ↗</span>`;
      oldVer.onclick = () => { document.querySelectorAll('.version-card-selectable').forEach(c => { c.classList.remove('active-version'); c.classList.add('dimmed'); }); oldVer.classList.add('active-version'); oldVer.classList.remove('dimmed'); setActiveVersionUI(h, false); };
      vList.appendChild(oldVer);
    });
  }
}

// الآراء
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

// إدارة المصادقة (Auth) بجميع أزرارها للكمبيوتر والموبايل
let isLoginMode = true;

function openAuthForm(mode) {
  isLoginMode = (mode === 'login');
  document.getElementById('auth-title').textContent = isLoginMode ? 'تسجيل الدخول' : 'إنشاء حساب جديد';
  document.getElementById('auth-submit').textContent = isLoginMode ? 'دخول آمن' : 'إنشاء وإكمال';
  document.getElementById('switch-label').textContent = isLoginMode ? 'ليس لديك حساب؟' : 'لديك حساب بالفعل؟';
  document.getElementById('auth-switch').textContent = isLoginMode ? 'سجل حساب جديد الآن' : 'قم بتسجيل الدخول';
  document.getElementById('name-field').classList.toggle('hidden', isLoginMode);
  document.getElementById('forgot-password').classList.toggle('hidden', !isLoginMode);
  document.getElementById('auth-modal').classList.remove('hidden');
  document.getElementById('nav').classList.remove('open'); // يقفل القائمة لو مفتوحة في الموبايل
}

// أزرار الكمبيوتر
document.getElementById('login-btn').onclick = () => openAuthForm('login');
document.getElementById('signup-btn').onclick = () => openAuthForm('signup');
// أزرار الموبايل (الجديدة)
document.getElementById('mobile-login-btn').onclick = () => openAuthForm('login');
document.getElementById('mobile-signup-btn').onclick = () => openAuthForm('signup');

document.getElementById('auth-switch').onclick = (e) => { e.preventDefault(); openAuthForm(isLoginMode ? 'signup' : 'login'); };
document.getElementById('auth-close').onclick = () => document.getElementById('auth-modal').classList.add('hidden');

// حالة تسجيل الدخول
onAuthStateChanged(auth, async user => {
  if (user) {
    document.getElementById('user-email').textContent = user.email;
    document.getElementById('mobile-user-email').textContent = user.email;
    
    document.getElementById('login-btn').classList.add('hidden');
    document.getElementById('signup-btn').classList.add('hidden');
    document.getElementById('mobile-login-btn').classList.add('hidden');
    document.getElementById('mobile-signup-btn').classList.add('hidden');
    
    document.getElementById('logout-btn').classList.remove('hidden');
    document.getElementById('mobile-logout-btn').classList.remove('hidden');

    try {
      const aDoc = await getDoc(doc(db, 'admins', user.uid));
      if (aDoc.exists() && aDoc.data().role === 'admin') {
        isAdmin = true;
        document.getElementById('admin-panel').classList.remove('hidden');
      }
    } catch(e) { isAdmin = false; }
  } else {
    document.getElementById('user-email').textContent = '';
    document.getElementById('mobile-user-email').textContent = '';
    
    document.getElementById('login-btn').classList.remove('hidden');
    document.getElementById('signup-btn').classList.remove('hidden');
    document.getElementById('mobile-login-btn').classList.remove('hidden');
    document.getElementById('mobile-signup-btn').classList.remove('hidden');
    
    document.getElementById('logout-btn').classList.add('hidden');
    document.getElementById('mobile-logout-btn').classList.add('hidden');
    document.getElementById('admin-panel').classList.add('hidden');
    isAdmin = false;
  }
});

// تشغيل جلب التطبيقات عشان "جاري التجهيز" تختفي وتظهر الألعاب
fetchApps();
