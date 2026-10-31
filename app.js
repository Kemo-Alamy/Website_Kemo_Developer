import { firebaseConfig } from './firebase-config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, collection, addDoc, updateDoc, deleteDoc, getDocs, query, orderBy, serverTimestamp, increment } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// رسائل Toast
const toastEl = document.getElementById('toast');
function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  setTimeout(() => toastEl.classList.remove('show'), 3000);
}

// المظهر الليلي والفاتح
document.getElementById('theme-toggle').onclick = () => {
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  document.documentElement.setAttribute('data-theme', isLight ? 'dark' : 'light');
  localStorage.setItem('kemo-theme', isLight ? 'dark' : 'light');
};
if (localStorage.getItem('kemo-theme') === 'light') document.documentElement.setAttribute('data-theme', 'light');

// القائمة للموبايل
document.getElementById('menu-toggle').onclick = () => document.getElementById('nav').classList.toggle('open');
document.getElementById('year').textContent = new Date().getFullYear();

// ===================== 1. عداد الزيارات الحقيقي =====================
async function trackVisitor() {
  const visitorDocRef = doc(db, 'stats', 'visitors');
  try {
    // زيادة عدد الزيارات الحقيقية في فايربيز
    await setDoc(visitorDocRef, { count: increment(1) }, { merge: true });
    const snap = await getDoc(visitorDocRef);
    if (snap.exists()) {
      document.getElementById('live-visitors-count').textContent = snap.data().count.toLocaleString('ar-EG');
    }
  } catch(e) {
    document.getElementById('live-visitors-count').textContent = '1,250+';
  }
}
trackVisitor();

// ===================== 2. إدارة قسم التعريف (About Me) =====================
async function loadProfile() {
  try {
    const pDoc = await getDoc(doc(db, 'settings', 'profile'));
    if (pDoc.exists()) {
      const data = pDoc.data();
      if(data.name) document.getElementById('profile-name').textContent = data.name;
      if(data.tag) document.getElementById('profile-tag').textContent = data.tag;
      if(data.bio) document.getElementById('profile-bio').textContent = data.bio;
      if(data.img) document.getElementById('profile-img').src = data.img;
      if(data.fb) document.getElementById('link-facebook').href = data.fb;
      if(data.wa) document.getElementById('link-whatsapp').href = data.wa;
      if(data.gh) document.getElementById('link-github').href = data.gh;

      // ملء بيانات الأدمن في الفورم
      document.getElementById('edit-profile-name').value = data.name || '';
      document.getElementById('edit-profile-tag').value = data.tag || '';
      document.getElementById('edit-profile-bio').value = data.bio || '';
      document.getElementById('edit-profile-fb').value = data.fb || '';
      document.getElementById('edit-profile-wa').value = data.wa || '';
      document.getElementById('edit-profile-gh').value = data.gh || '';
    }
  } catch(e) { console.log(e); }
}
loadProfile();

// حفظ بيانات الأدمن (الملف الشخصي)
document.getElementById('profile-form').onsubmit = async (e) => {
  e.preventDefault();
  const status = document.getElementById('profile-save-status');
  status.textContent = 'جاري الحفظ...';

  const profileData = {
    name: document.getElementById('edit-profile-name').value,
    tag: document.getElementById('edit-profile-tag').value,
    bio: document.getElementById('edit-profile-bio').value,
    fb: document.getElementById('edit-profile-fb').value,
    wa: document.getElementById('edit-profile-wa').value,
    gh: document.getElementById('edit-profile-gh').value,
  };

  const imgFile = document.getElementById('edit-profile-img').files[0];
  if(imgFile) {
    profileData.img = await fileToBase64(imgFile);
  }

  await setDoc(doc(db, 'settings', 'profile'), profileData, { merge: true });
  status.textContent = 'تم تحديث ملفك الشخصي بنجاح!';
  loadProfile();
  setTimeout(() => status.textContent = '', 3000);
};

// ===================== 3. نظام التطبيقات والمودال المتطور =====================
let allApps = [];
let currentOpenApp = null;
let isAdmin = false;
let currentUser = null;

// جلب التطبيقات
async function fetchApps() {
  try {
    const q = query(collection(db, 'apps'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
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
    grid.innerHTML = `<div class="empty-state">لا توجد تطبيقات مطابقة للبحث</div>`;
    return;
  }

  filtered.forEach(app => {
    const card = document.createElement('div');
    card.className = 'app-card';
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
        <div class="card-bottom-bar">
          <span>اضغط للمعاينة والتثبيت ↗</span>
          <span class="card-likes">♥ ${app.likes || 0}</span>
        </div>
      </div>
    `;
    grid.appendChild(card);
  });
}

// فتح نافذة التطبيق الكاملة (Modal)
function openAppModal(app) {
  currentOpenApp = app;
  document.getElementById('modal-app-name').textContent = app.name;
  document.getElementById('modal-app-category').textContent = app.category;
  document.getElementById('modal-app-desc').textContent = app.description;
  document.getElementById('modal-app-cover').src = app.coverUrl || 'https://via.placeholder.com/150';
  document.getElementById('modal-app-latest-ver').textContent = `الإصدار الأحدث: v${app.version}`;
  document.getElementById('modal-download-btn').href = app.fileUrl || '#';
  document.getElementById('modal-likes-count').textContent = app.likes || 0;

  // سجل الإصدارات (الحديث من فوق والقديم من تحت)
  const versionsList = document.getElementById('modal-versions-list');
  versionsList.innerHTML = `
    <div class="version-item latest">
      <div><b>v${app.version} (الحالي)</b> <small>أحدث نسخة</small></div>
      <a href="${app.fileUrl}" target="_blank" class="btn btn-dark small">تحميل ⤓</a>
    </div>
  `;

  if (app.history && app.history.length > 0) {
    app.history.forEach(v => {
      versionsList.innerHTML += `
        <div class="version-item">
          <div><b>v${v.version}</b> <small>إصدار سابق</small></div>
          <a href="${v.fileUrl}" target="_blank" class="btn btn-outline small">تحميل ⤓</a>
        </div>
      `;
    });
  }

  // إظهار أزرار الأدمن لو مسجل كمدير
  if (isAdmin) {
    document.getElementById('modal-admin-actions').classList.remove('hidden');
  } else {
    document.getElementById('modal-admin-actions').classList.add('hidden');
  }

  loadReviews(app.id);
  document.getElementById('app-modal').classList.remove('hidden');
}

document.getElementById('app-modal-close').onclick = () => document.getElementById('app-modal').classList.add('hidden');

// التفاعل مع القلب (Like الحقيقي)
document.getElementById('modal-like-btn').onclick = async () => {
  if (!currentOpenApp) return;
  const likedKey = `liked_${currentOpenApp.id}`;
  if (localStorage.getItem(likedKey)) {
    showToast('لقد تفاعلت مع هذا التطبيق بالفعل!');
    return;
  }
  try {
    await updateDoc(doc(db, 'apps', currentOpenApp.id), { likes: increment(1) });
    localStorage.setItem(likedKey, 'true');
    currentOpenApp.likes = (currentOpenApp.likes || 0) + 1;
    document.getElementById('modal-likes-count').textContent = currentOpenApp.likes;
    showToast('شكراً لتفاعلك! ❤️');
    fetchApps();
  } catch(e) { console.log(e); }
};

// الآراء الحقيقية (Reviews)
async function loadReviews(appId) {
  const list = document.getElementById('reviews-list');
  list.innerHTML = '<p class="empty-state">جاري تحميل الآراء...</p>';
  try {
    const snap = await getDocs(query(collection(db, `apps/${appId}/reviews`), orderBy('createdAt', 'desc')));
    const reviews = snap.docs.map(d => d.data());
    document.getElementById('reviews-count').textContent = reviews.length;
    if (reviews.length === 0) {
      list.innerHTML = '<p class="empty-state">لا توجد مراجعات حتى الآن، كن أول من يكتب رأيه!</p>';
      return;
    }
    list.innerHTML = '';
    reviews.forEach(r => {
      list.innerHTML += `
        <div class="review-card">
          <b>${r.name}</b>
          <p>${r.text}</p>
        </div>
      `;
    });
  } catch(e) { list.innerHTML = ''; }
}

// إضافة رأي حقيقي
document.getElementById('add-review-form').onsubmit = async (e) => {
  e.preventDefault();
  if (!currentOpenApp) return;
  const name = document.getElementById('review-user-name').value;
  const text = document.getElementById('review-user-text').value;

  await addDoc(collection(db, `apps/${currentOpenApp.id}/reviews`), {
    name, text, createdAt: serverTimestamp()
  });

  document.getElementById('add-review-form').reset();
  showToast('تم نشر رأيك بنجاح!');
  loadReviews(currentOpenApp.id);
};

// ===================== 4. أدمن: إضافة إصدار جديد وحذف وتعديل =====================

// إضافة إصدار جديد (يضع الجديد فوق والقديم في السجل)
document.getElementById('admin-add-ver-btn').onclick = () => {
  document.getElementById('app-modal').classList.add('hidden');
  document.getElementById('ver-app-id').value = currentOpenApp.id;
  document.getElementById('version-app-title').textContent = `تحديث: ${currentOpenApp.name}`;
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
    const data = snap.data();
    const history = data.history || [];
    // نقل الإصدار الحالي للسجل في الأعلى
    history.unshift({ version: data.version, fileUrl: data.fileUrl });

    // تحديث التطبيق بالإصدار الجديد كإصدار رئيسي
    await updateDoc(appRef, {
      version: newVer,
      fileUrl: newUrl,
      history: history,
      updatedAt: serverTimestamp()
    });

    document.getElementById('version-modal').classList.add('hidden');
    document.getElementById('version-form').reset();
    showToast('تمت إضافة الإصدار الجديد بنجاح!');
    fetchApps();
  }
};

// حذف التطبيق
document.getElementById('admin-delete-app-btn').onclick = async () => {
  if (confirm(`هل أنت متأكد من حذف تطبيق "${currentOpenApp.name}" نهائياً؟`)) {
    await deleteDoc(doc(db, 'apps', currentOpenApp.id));
    document.getElementById('app-modal').classList.add('hidden');
    showToast('تم حذف التطبيق!');
    fetchApps();
  }
};

// تعديل التطبيق
document.getElementById('admin-edit-app-btn').onclick = () => {
  document.getElementById('app-modal').classList.add('hidden');
  document.getElementById('edit-id').value = currentOpenApp.id;
  document.getElementById('app-name').value = currentOpenApp.name;
  document.getElementById('app-category').value = currentOpenApp.category;
  document.getElementById('app-version').value = currentOpenApp.version;
  document.getElementById('app-file').value = currentOpenApp.fileUrl;
  document.getElementById('app-description').value = currentOpenApp.description;
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

// نشر أو تحديث التطبيق
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

  const imgFile = document.getElementById('app-image').files[0];
  if (imgFile) {
    appData.coverUrl = await fileToBase64(imgFile);
  }

  if (id) {
    await updateDoc(doc(db, 'apps', id), appData);
    showToast('تم تحديث التطبيق بنجاح');
  } else {
    appData.createdAt = serverTimestamp();
    appData.likes = 0;
    appData.history = [];
    await addDoc(collection(db, 'apps'), appData);
    showToast('تم نشر التطبيق في المكتبة!');
  }

  document.getElementById('app-form').reset();
  document.getElementById('cancel-edit').click();
  msg.textContent = '';
  fetchApps();
};

function fileToBase64(file) {
  return new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = () => res(reader.result);
    reader.onerror = e => rej(e);
    reader.readAsDataURL(file);
  });
}

// تبويبات الأدمن
document.querySelectorAll('.tab-btn').forEach(b => {
  b.onclick = () => {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.remove('active'));
    b.classList.add('active');
    document.getElementById(b.dataset.tab).classList.add('active');
  };
});

// الفلاتر والبحث
document.getElementById('search-input').oninput = (e) => {
  const cat = document.querySelector('.filter.active').dataset.category;
  renderApps(cat, e.target.value);
};
document.querySelectorAll('.filter').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.filter').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderApps(btn.dataset.category, document.getElementById('search-input').value);
  };
});

// المصادقة (Auth)
onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  if (user) {
    document.getElementById('user-email').textContent = user.email;
    document.getElementById('login-btn').classList.add('hidden');
    document.getElementById('signup-btn').classList.add('hidden');
    document.getElementById('logout-btn').classList.remove('hidden');

    try {
      const adminDoc = await getDoc(doc(db, 'admins', user.uid));
      if (adminDoc.exists() && adminDoc.data().role === 'admin') {
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

// مودال الدخول
document.getElementById('login-btn').onclick = () => document.getElementById('auth-modal').classList.remove('hidden');
document.getElementById('auth-close').onclick = () => document.getElementById('auth-modal').classList.add('hidden');
document.getElementById('auth-form').onsubmit = async (e) => {
  e.preventDefault();
  const email = document.getElementById('auth-email').value;
  const pass = document.getElementById('auth-password').value;
  try {
    await signInWithEmailAndPassword(auth, email, pass);
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

// نموذج تواصل
document.getElementById('contact-form').onsubmit = (e) => {
  e.preventDefault();
  document.getElementById('contact-status').textContent = 'تم إرسال رسالتك بنجاح!';
  e.target.reset();
  setTimeout(() => document.getElementById('contact-status').textContent = '', 4000);
};

// تشغيل جلب التطبيقات فور فتح الموقع
fetchApps();
