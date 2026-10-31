import { firebaseConfig } from './firebase-config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, collection, addDoc, updateDoc, deleteDoc, getDocs, query, orderBy, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { getStorage, ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

const toastEl = document.getElementById('toast');
function showToast(msg, isError = false) {
  toastEl.textContent = msg;
  toastEl.style.backgroundColor = isError ? 'var(--error, #dc3545)' : 'var(--ink, #171722)';
  toastEl.classList.add('show');
  setTimeout(() => toastEl.classList.remove('show'), 3000);
}

const themeBtn = document.getElementById('theme-toggle');
themeBtn.onclick = () => {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  document.documentElement.setAttribute('data-theme', isDark ? 'light' : 'dark');
  localStorage.setItem('kemo-theme', isDark ? 'light' : 'dark');
};
if(localStorage.getItem('kemo-theme') === 'dark') document.documentElement.setAttribute('data-theme', 'dark');

const menuBtn = document.getElementById('menu-toggle');
const nav = document.getElementById('nav');
menuBtn.onclick = () => nav.classList.toggle('open');

const reveals = document.querySelectorAll('.reveal');
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if(entry.isIntersecting) entry.target.classList.add('visible');
  });
}, { threshold: 0.1 });
reveals.forEach(r => revealObserver.observe(r));

document.getElementById('year').textContent = new Date().getFullYear();

let isLogin = true;
const authModal = document.getElementById('auth-modal');
const authClose = document.getElementById('auth-close');
const loginBtn = document.getElementById('login-btn');
const signupBtn = document.getElementById('signup-btn');
const logoutBtn = document.getElementById('logout-btn');
const authForm = document.getElementById('auth-form');
const authSwitch = document.getElementById('auth-switch');

function openAuth(mode) {
  isLogin = mode === 'login';
  document.getElementById('auth-title').textContent = isLogin ? 'تسجيل الدخول' : 'إنشاء حساب';
  document.getElementById('auth-submit').textContent = isLogin ? 'دخول' : 'إنشاء حساب';
  document.getElementById('switch-label').textContent = isLogin ? 'ليس لديك حساب؟' : 'لديك حساب بالفعل؟';
  authSwitch.textContent = isLogin ? 'إنشاء حساب' : 'تسجيل الدخول';
  document.getElementById('name-field').classList.toggle('hidden', isLogin);
  authModal.classList.remove('hidden');
}

loginBtn.onclick = () => openAuth('login');
signupBtn.onclick = () => openAuth('signup');
authClose.onclick = () => authModal.classList.add('hidden');
authSwitch.onclick = (e) => { e.preventDefault(); openAuth(isLogin ? 'signup' : 'login'); };

authForm.onsubmit = async (e) => {
  e.preventDefault();
  const email = document.getElementById('auth-email').value;
  const pass = document.getElementById('auth-password').value;
  const msg = document.getElementById('auth-message');
  msg.textContent = 'جاري المعالجة...';
  try {
    if(isLogin) {
      await signInWithEmailAndPassword(auth, email, pass);
    } else {
      const cred = await createUserWithEmailAndPassword(auth, email, pass);
      await setDoc(doc(db, 'users', cred.user.uid), { email: cred.user.email, name: document.getElementById('display-name').value || '' });
    }
    authModal.classList.add('hidden');
    authForm.reset();
    msg.textContent = '';
    showToast('تمت العملية بنجاح');
  } catch (err) {
    msg.textContent = 'خطأ: ' + err.message;
  }
};

logoutBtn.onclick = async () => {
  await signOut(auth);
  showToast('تم تسجيل الخروج');
};

document.getElementById('forgot-password').onclick = async (e) => {
  e.preventDefault();
  const email = document.getElementById('auth-email').value;
  if(!email) return showToast('يرجى كتابة البريد الإلكتروني أولاً', true);
  try {
    await sendPasswordResetEmail(auth, email);
    showToast('تم إرسال رابط استعادة كلمة المرور');
  } catch(err) {
    showToast('خطأ: ' + err.message, true);
  }
};

let currentUser = null;
let isAdmin = false;

onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  if(user) {
    document.getElementById('user-email').textContent = user.email;
    loginBtn.classList.add('hidden');
    signupBtn.classList.add('hidden');
    logoutBtn.classList.remove('hidden');
    
    try {
      const adminDoc = await getDoc(doc(db, 'admins', user.uid));
      if(adminDoc.exists() && adminDoc.data().role === 'admin') {
        isAdmin = true;
        document.getElementById('admin-panel').classList.remove('hidden');
      } else {
        isAdmin = false;
        document.getElementById('admin-panel').classList.add('hidden');
      }
    } catch(e) {
      isAdmin = false;
      document.getElementById('admin-panel').classList.add('hidden');
    }
  } else {
    document.getElementById('user-email').textContent = '';
    loginBtn.classList.remove('hidden');
    signupBtn.classList.remove('hidden');
    logoutBtn.classList.add('hidden');
    document.getElementById('admin-panel').classList.add('hidden');
    isAdmin = false;
  }
});

let allApps = [];

async function fetchApps() {
  try {
    const q = query(collection(db, 'apps'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    allApps = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    
    document.getElementById('app-count').textContent = allApps.length;
    document.getElementById('admin-app-count').textContent = allApps.length;
    
    renderApps();
    renderAdminApps();
  } catch(err) {
    document.getElementById('apps-grid').innerHTML = `<div class="empty-state">حدث خطأ أثناء تحميل التطبيقات</div>`;
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

  if(filtered.length === 0) {
    grid.innerHTML = `<div class="empty-state">لا توجد تطبيقات مطابقة لعملية البحث</div>`;
    return;
  }

  filtered.forEach(app => {
    const div = document.createElement('div');
    div.className = 'app-card reveal visible';
    div.innerHTML = `
      <div class="app-cover">
        ${app.coverUrl ? `<img src="${app.coverUrl}" alt="${app.name}" loading="lazy">` : `<div class="cover-placeholder">✦</div>`}
        <span class="app-tag">${app.category}</span>
      </div>
      <div class="app-body">
        <div class="app-title-line">
          <h3>${app.name}</h3>
          <span class="app-version">v${app.version || '1.0'}</span>
        </div>
        <p class="app-description">${app.description}</p>
        <div class="app-card-actions">
          ${app.fileUrl ? `<a href="${app.fileUrl}" target="_blank" class="btn btn-dark">تحميل الآن</a>` : `<button class="btn btn-outline" disabled>غير متوفر</button>`}
        </div>
      </div>
    `;
    grid.appendChild(div);
  });
}

document.getElementById('search-input').addEventListener('input', (e) => {
  const activeFilter = document.querySelector('.filter.active').dataset.category;
  renderApps(activeFilter, e.target.value);
});

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
    const targetBtn = document.querySelector(`.filter[data-category="${cat}"]`);
    if(targetBtn) targetBtn.classList.add('active');
    renderApps(cat, document.getElementById('search-input').value);
  };
});

function renderAdminApps() {
  const list = document.getElementById('admin-app-list');
  list.innerHTML = '';
  allApps.forEach(app => {
    const div = document.createElement('div');
    div.className = 'admin-row';
    div.innerHTML = `
      ${app.coverUrl ? `<img src="${app.coverUrl}">` : `<div class="admin-thumb">✦</div>`}
      <div>
        <b>${app.name}</b>
        <small>${app.category} · v${app.version}</small>
      </div>
      <button class="btn btn-outline edit-btn" data-id="${app.id}">تعديل</button>
      <button class="btn btn-outline del-btn" data-id="${app.id}" style="color:var(--error, #dc3545); border-color:var(--error, #dc3545);">حذف</button>
    `;
    list.appendChild(div);
  });

  document.querySelectorAll('.edit-btn').forEach(b => b.onclick = (e) => loadEditForm(e.target.dataset.id));
  document.querySelectorAll('.del-btn').forEach(b => b.onclick = (e) => deleteApp(e.target.dataset.id));
}

let editModeApp = null;
function loadEditForm(id) {
  editModeApp = allApps.find(a => a.id === id);
  if(!editModeApp) return;
  document.getElementById('edit-id').value = editModeApp.id;
  document.getElementById('app-name').value = editModeApp.name;
  document.getElementById('app-category').value = editModeApp.category;
  document.getElementById('app-version').value = editModeApp.version;
  document.getElementById('app-description').value = editModeApp.description;
  document.getElementById('cancel-edit').classList.remove('hidden');
  document.getElementById('save-app').textContent = 'حفظ التعديلات';
  window.scrollTo({ top: document.getElementById('admin-panel').offsetTop, behavior: 'smooth' });
}

document.getElementById('cancel-edit').onclick = () => {
  document.getElementById('app-form').reset();
  document.getElementById('edit-id').value = '';
  document.getElementById('cancel-edit').classList.add('hidden');
  document.getElementById('save-app').textContent = 'نشر التطبيق';
  editModeApp = null;
};

async function uploadFile(file, pathFolder) {
  return new Promise((resolve, reject) => {
    const storageRef = ref(storage, `${pathFolder}/${Date.now()}_${file.name}`);
    const task = uploadBytesResumable(storageRef, file);
    const progressEl = document.getElementById('upload-progress');
    const barEl = document.getElementById('progress-bar');
    progressEl.classList.remove('hidden');

    task.on('state_changed', 
      (snap) => {
        const progress = (snap.bytesTransferred / snap.totalBytes) * 100;
        barEl.style.width = progress + '%';
      },
      (err) => { progressEl.classList.add('hidden'); reject(err); },
      async () => {
        progressEl.classList.add('hidden');
        const url = await getDownloadURL(task.snapshot.ref);
        resolve({ url, path: task.snapshot.ref.fullPath });
      }
    );
  });
}

document.getElementById('app-form').onsubmit = async (e) => {
  e.preventDefault();
  if(!isAdmin) return showToast('غير مصرح لك');

  const msg = document.getElementById('admin-message');
  msg.textContent = 'جاري المعالجة...';
  const id = document.getElementById('edit-id').value;
  
  const appData = {
    name: document.getElementById('app-name').value,
    category: document.getElementById('app-category').value,
    version: document.getElementById('app-version').value,
    description: document.getElementById('app-description').value,
  };

  const imgFile = document.getElementById('app-image').files[0];
  const apkFile = document.getElementById('app-file').files[0];

  try {
    if(imgFile) {
      msg.textContent = 'جاري رفع غلاف التطبيق...';
      const imgUpload = await uploadFile(imgFile, 'apps/covers');
      appData.coverUrl = imgUpload.url;
      appData.coverPath = imgUpload.path;
    }
    if(apkFile) {
      msg.textContent = 'جاري رفع ملف التطبيق/اللعبة...';
      const fileUpload = await uploadFile(apkFile, 'apps/files');
      appData.fileUrl = fileUpload.url;
      appData.filePath = fileUpload.path;
    }

    if(id) {
      appData.updatedAt = serverTimestamp();
      await updateDoc(doc(db, 'apps', id), appData);
      showToast('تم تحديث بيانات التطبيق بنجاح');
    } else {
      appData.createdAt = serverTimestamp();
      await addDoc(collection(db, 'apps'), appData);
      showToast('تم نشر التطبيق في المكتبة بنجاح');
    }

    document.getElementById('app-form').reset();
    document.getElementById('cancel-edit').click();
    msg.textContent = '';
    fetchApps(); // تحديث القائمة
  } catch (err) {
    msg.textContent = 'خطأ: ' + err.message;
  }
};

async function deleteApp(id) {
  if(!confirm('هل أنت متأكد من أنك تريد حذف هذا التطبيق نهائياً؟')) return;
  const app = allApps.find(a => a.id === id);
  try {
    if(app.coverPath) await deleteObject(ref(storage, app.coverPath)).catch(e=>console.log(e));
    if(app.filePath) await deleteObject(ref(storage, app.filePath)).catch(e=>console.log(e));
    await deleteDoc(doc(db, 'apps', id));
    showToast('تم حذف التطبيق نهائياً');
    fetchApps();
  } catch(err) {
    showToast('حدث خطأ أثناء الحذف: ' + err.message, true);
  }
}

document.getElementById('contact-form').onsubmit = (e) => {
  e.preventDefault();
  document.getElementById('contact-status').textContent = 'تم إرسال رسالتك بنجاح! سنقوم بالرد عليك قريباً.';
  document.getElementById('contact-status').style.color = '#35a477';
  e.target.reset();
  setTimeout(() => document.getElementById('contact-status').textContent = '', 5000);
};

fetchApps();
