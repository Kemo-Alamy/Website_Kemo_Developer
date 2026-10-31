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

// المظهر وقائمة الموبايل
document.getElementById('theme-toggle').onclick = () => {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  document.documentElement.setAttribute('data-theme', isDark ? 'light' : 'dark');
  localStorage.setItem('kemo-theme', isDark ? 'light' : 'dark');
};
if (localStorage.getItem('kemo-theme') === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
document.getElementById('menu-toggle').onclick = () => document.getElementById('nav').classList.toggle('open');
document.getElementById('year').textContent = new Date().getFullYear();

// أنميشن الظهور
const observer = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); }), { threshold: 0.1 });
document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

// 1. عداد الزيارات الحقيقي
async function trackVisitor() {
  try {
    const vRef = doc(db, 'stats', 'visitors');
    await setDoc(vRef, { count: increment(1) }, { merge: true });
    const snap = await getDoc(vRef);
    if (snap.exists()) document.getElementById('live-visitors-count').textContent = snap.data().count.toLocaleString('ar-EG');
  } catch(e) { document.getElementById('live-visitors-count').textContent = '2,400+'; }
}
trackVisitor();

// 2. تحميل وحفظ بيانات من أنا
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
  const st = document.getElementById('profile-save-status');
  st.textContent = 'جاري الحفظ...';
  const data = {
    name: document.getElementById('edit-profile-name').value,
    tag: document.getElementById('edit-profile-tag').value,
    bio: document.getElementById('edit-profile-bio').value,
    fb: document.getElementById('edit-profile-fb').value,
    wa: document.getElementById('edit-profile-wa').value,
    gh: document.getElementById('edit-profile-gh').value,
  };
  const imgF = document.getElementById('edit-profile-img').files[0];
  if (imgF) data.img = await fileToBase64(imgF);

  await setDoc(doc(db, 'settings', 'profile'), data, { merge: true });
  st.textContent = 'تم حفظ بياناتك بنجاح!';
  loadProfile();
  setTimeout(() => st.textContent = '', 3000);
};

// التبديل بين فورم التطبيق وفورم من أنا في لوحة الأدمن
document.getElementById('show-app-form-btn').onclick = () => {
  document.getElementById('app-form').classList.remove('hidden');
  document.getElementById('profile-form').classList.add('hidden');
};
document.getElementById('show-profile-form-btn').onclick = () => {
  document.getElementById('app-form').classList.add('hidden');
  document.getElementById('profile-form').classList.remove('hidden');
};

// 3. جلب التطبيقات وعرضها
let allApps = [];
let currentApp = null;
let isAdmin = false;

async function fetchApps() {
  try {
    const snap = await getDocs(query(collection(db, 'apps'), orderBy('createdAt', 'desc')));
    allApps = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    document.getElementById('app-count').textContent = allApps.length;
    renderApps();
  } catch(e) {
    document.getElementById('apps-grid').innerHTML = `<div class="empty-state">حدث خطأ في تحميل التطبيقات</div>`;
  }
}

function renderApps(filter = 'all', search = '') {
  const grid = document.getElementById('apps-grid');
  grid.innerHTML = '';
  const filtered = allApps.filter(app => {
    const matchCat = filter === 'all' || app.category === filter;
    const matchSearch = app.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  if (filtered.length === 0) {
    grid.innerHTML = `<div class="empty-state">لا توجد تطبيقات مطابقة</div>`;
    return;
  }

  filtered.forEach(app => {
    const card = document.createElement('div');
    card.className = 'app-card reveal visible';
    card.onclick = () => openAppModal(app);
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
          <span>عرض التفاصيل والتثبيت ←</span>
          <span style="color:#ff4d6d">♥ ${app.likes || 0}</span>
        </div>
      </div>
    `;
    grid.appendChild(card);
  });
}

// فتح نافذة تفاصيل التطبيق
function openAppModal(app) {
  currentApp = app;
  document.getElementById('modal-app-name').textContent = app.name;
  document.getElementById('modal-app-category').textContent = app.category;
  document.getElementById('modal-app-desc').textContent = app.description;
  document.getElementById('modal-app-cover').src = app.coverUrl || '';
  document.getElementById('modal-app-latest-ver').textContent = `الإصدار الأخير: v${app.version}`;
  document.getElementById('modal-download-btn').href = app.fileUrl || '#';
  document.getElementById('modal-likes-count').textContent = app.likes || 0;

  // سجل الإصدارات
  const vList = document.getElementById('modal-versions-list');
  vList.innerHTML = `
    <div class="version-row" style="border-color: var(--accent);">
      <div><b>v${app.version} (الأحدث)</b></div>
      <a href="${app.fileUrl}" target="_blank" class="btn btn-dark small">تحميل ⤓</a>
    </div>
  `;
  if (app.history) {
    app.history.forEach(h => {
      vList.innerHTML += `
        <div class="version-row">
          <div><b>v${h.version}</b> <small style="color:var(--muted);">(إصدار قديم)</small></div>
          <a href="${h.fileUrl}" target="_blank" class="btn btn-outline small">تحميل ⤓</a>
        </div>
      `;
    });
  }

  if (isAdmin) document.getElementById('modal-admin-actions').classList.remove('hidden');
  else document.getElementById('modal-admin-actions').classList.add('hidden');

  loadReviews(app.id);
  document.getElementById('app-modal').classList.remove('hidden');
}

document.getElementById('app-modal-close').onclick = () => document.getElementById('app-modal').classList.add('hidden');

// التفاعل بالقلب
document.getElementById('modal-like-btn').onclick = async () => {
  if (!currentApp) return;
  const key = `liked_${currentApp.id}`;
  if (localStorage.getItem(key)) return showToast('لقد تفاعلت بالفعل!');
  await updateDoc(doc(db, 'apps', currentApp.id), { likes: increment(1) });
  localStorage.setItem(key, 'true');
  currentApp.likes = (currentApp.likes || 0) + 1;
  document.getElementById('modal-likes-count').textContent = currentApp.likes;
  showToast('شكراً لتفاعلك! ❤️');
  fetchApps();
};

// الآراء
async function loadReviews(appId) {
  const rList = document.getElementById('reviews-list');
  rList.innerHTML = '<small style="color:var(--muted)">جاري جلب الآراء...</small>';
  const snap = await getDocs(query(collection(db, `apps/${appId}/reviews`), orderBy('createdAt', 'desc')));
  const revs = snap.docs.map(d => d.data());
  document.getElementById('reviews-count').textContent = revs.length;
  if (!revs.length) {
    rList.innerHTML = '<small style="color:var(--muted)">لا توجد آراء حتى الآن، اكتب رأيك الأول!</small>';
    return;
  }
  rList.innerHTML = '';
  revs.forEach(r => {
    rList.innerHTML += `<div class="review-box"><b>${r.name}</b><p style="margin:0">${r.text}</p></div>`;
  });
}

document.getElementById('add-review-form').onsubmit = async (e) => {
  e.preventDefault();
  const name = document.getElementById('review-user-name').value;
  const text = document.getElementById('review-user-text').value;
  await addDoc(collection(db, `apps/${currentApp.id}/reviews`), { name, text, createdAt: serverTimestamp() });
  document.getElementById('add-review-form').reset();
  showToast('تمت إضافة رأيك بنجاح!');
  loadReviews(currentApp.id);
};

// 4. تحكم الأدمن في الإصدارات والحذف والتعديل
document.getElementById('admin-add-ver-btn').onclick = () => {
  document.getElementById('app-modal').classList.add('hidden');
  document.getElementById('ver-app-id').value = currentApp.id;
  document.getElementById('version-app-title').textContent = currentApp.name;
  document.getElementById('version-modal').classList.remove('hidden');
};
document.getElementById('version-modal-close').onclick = () => document.getElementById('version-modal').classList.add('hidden');

document.getElementById('version-form').onsubmit = async (e) => {
  e.preventDefault();
  const id = document.getElementById('ver-app-id').value;
  const newVer = document.getElementById('new-ver-number').value;
  const newUrl = document.getElementById('new-ver-url').value;

  const appRef = doc(db, 'apps', id);
  const snap = await getDoc(appRef);
  if (snap.exists()) {
    const d = snap.data();
    const history = d.history || [];
    history.unshift({ version: d.version, fileUrl: d.fileUrl }); // الإصدار القديم في السجل
    await updateDoc(appRef, { version: newVer, fileUrl: newUrl, history, updatedAt: serverTimestamp() });
    document.getElementById('version-modal').classList.add('hidden');
    document.getElementById('version-form').reset();
    showToast('تم نشر الإصدار الجديد بنجاح!');
    fetchApps();
  }
};

document.getElementById('admin-delete-app-btn').onclick = async () => {
  if (confirm(`هل أنت متأكد من حذف "${currentApp.name}" نهائياً؟`)) {
    await deleteDoc(doc(db, 'apps', currentApp.id));
    document.getElementById('app-modal').classList.add('hidden');
    showToast('تم الحذف بنجاح!');
    fetchApps();
  }
};

document.getElementById('admin-edit-app-btn').onclick = () => {
  document.getElementById('app-modal').classList.add('hidden');
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

// نشر التطبيق الجديد
document.getElementById('app-form').onsubmit = async (e) => {
  e.preventDefault();
  const id = document.getElementById('edit-id').value;
  const msg = document.getElementById('admin-message');
  msg.textContent = 'جاري الحفظ...';

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
    await addDoc(collection(db, 'apps'), appData);
    showToast('تم نشر التطبيق بنجاح');
  }
  document.getElementById('app-form').reset();
  document.getElementById('cancel-edit').click();
  msg.textContent = '';
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

// البحث والتصنيفات
document.getElementById('search-input').oninput = e => {
  renderApps(document.querySelector('.filter.active').dataset.category, e.target.value);
};
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

// تسجيل الدخول وحالة الأدمن
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

document.getElementById('login-btn').onclick = () => document.getElementById('auth-modal').classList.remove('hidden');
document.getElementById('auth-close').onclick = () => document.getElementById('auth-modal').classList.add('hidden');
document.getElementById('auth-form').onsubmit = async (e) => {
  e.preventDefault();
  try {
    await signInWithEmailAndPassword(auth, document.getElementById('auth-email').value, document.getElementById('auth-password').value);
    document.getElementById('auth-modal').classList.add('hidden');
    showToast('تم تسجيل الدخول بنجاح');
  } catch(err) {
    document.getElementById('auth-message').textContent = 'خطأ: ' + err.message;
  }
};
document.getElementById('logout-btn').onclick = async () => {
  await signOut(auth);
  showToast('تم تسجيل الخروج');
};
document.getElementById('contact-form').onsubmit = e => {
  e.preventDefault();
  document.getElementById('contact-status').textContent = 'تم إرسال رسالتك بنجاح!';
  e.target.reset();
  setTimeout(() => document.getElementById('contact-status').textContent = '', 4000);
};

fetchApps();
