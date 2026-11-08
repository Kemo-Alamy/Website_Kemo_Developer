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

let allApps = [];
let currentApp = null;
let isAdmin = false;
let currentUser = null;
let versionEditContext = null;
let selectedReviewRating = 5;

/* ============ الملف الشخصي ============ */
async function loadProfile() {
  try {
    const snap = await getDoc(doc(db, 'settings', 'profile'));
    const d = snap.exists() ? snap.data() : {};
    const el = (id) => document.getElementById(id);
    if (d.line1 && el('profile-line1')) el('profile-line1').textContent = d.line1;
    if (d.line2 && el('profile-line2')) el('profile-line2').textContent = d.line2;
    if (d.bio && el('profile-bio')) el('profile-bio').textContent = d.bio;
    if (d.text1 && el('profile-text1')) el('profile-text1').textContent = d.text1;
    if (d.text2 && el('profile-text2')) el('profile-text2').textContent = d.text2;

    const links = { fb: 0, wa: 1, ig: 2, gh: 3 };
    const footerLinks = document.querySelectorAll('.footer-link a');
    if (d.gh && footerLinks[0]) footerLinks[0].href = d.gh;
    if (d.wa && footerLinks[1]) footerLinks[1].href = d.wa;
    if (d.ig && footerLinks[2]) footerLinks[2].href = d.ig;
    if (d.fb && footerLinks[3]) footerLinks[3].href = d.fb;

    if (el('edit-profile-line1')) {
      el('edit-profile-line1').value = d.line1 || el('profile-line1')?.textContent || '';
      el('edit-profile-line2').value = d.line2 || el('profile-line2')?.textContent || '';
      el('edit-profile-bio').value = d.bio || el('profile-bio')?.textContent || '';
      el('edit-profile-text1').value = d.text1 || el('profile-text1')?.textContent || '';
      el('edit-profile-text2').value = d.text2 || el('profile-text2')?.textContent || '';
      el('edit-profile-fb').value = d.fb || '';
      el('edit-profile-wa').value = d.wa || '';
      el('edit-profile-ig').value = d.ig || '';
      el('edit-profile-gh').value = d.gh || '';
    }
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
      line1: document.getElementById('edit-profile-line1').value,
      line2: document.getElementById('edit-profile-line2').value,
      bio: document.getElementById('edit-profile-bio').value,
      text1: document.getElementById('edit-profile-text1').value,
      text2: document.getElementById('edit-profile-text2').value,
      fb: document.getElementById('edit-profile-fb').value,
      wa: document.getElementById('edit-profile-wa').value,
      ig: document.getElementById('edit-profile-ig').value,
      gh: document.getElementById('edit-profile-gh').value,
    };
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
    renderApps();
  } catch (e) {
    console.error(e);
    if (grid) grid.innerHTML = `<div class="empty-state">تعذّر تحميل التطبيقات</div>`;
  }
}

function renderApps(filter = 'all', search = '') {
  const grid = document.getElementById('apps-grid');
  if (!grid) return;
  grid.innerHTML = '';
  const filtered = allApps.filter(a => (filter === 'all' || a.category === filter) && a.name.toLowerCase().includes(search.toLowerCase()));

  if (!filtered.length) { grid.innerHTML = `<div class="empty-state">لا توجد تطبيقات بعد</div>`; return; }

  filtered.forEach(app => {
    const box = document.createElement('div');
    box.className = 'work-box';
    box.onclick = () => openAppDetail(app);
    const isLiked = localStorage.getItem(`liked_${app.id}`);
    box.innerHTML = `
      <div class="work-textbox">
        <h3 class="h3">${app.name}</h3>
        <p class="work-text">${app.description}</p>
        <ol class="work-technologies">
          <li>${app.category}</li>
          <li>الإصدار ${app.version || '1.0'}</li>
        </ol>
        <div class="work-links">
          <span class="link">استكشف هذا التطبيق</span>
          <button type="button" class="icon-btn-circle ${isLiked ? 'liked' : ''}" data-like-btn="${app.id}">♥</button>
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
  document.getElementById('detail-name').textContent = verData.name || currentApp.name;
  document.getElementById('detail-version-label').textContent = `الإصدار المعروض: v${verData.version} ${isLatest ? '(الأحدث)' : '(سابق)'}`;
  const cover = document.getElementById('detail-cover');
  if (cover) cover.src = verData.coverUrl || fallbackCover || '';
  document.getElementById('detail-download-btn').href = verData.fileUrl || '#';
  document.getElementById('detail-description').textContent = isLatest ? currentApp.description : (verData.releaseNotes || 'نسخة سابقة.');
  document.getElementById('detail-tags').innerHTML = `<li>${currentApp.category}</li><li>الإصدار ${verData.version}</li>`;
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
    <span class="link" style="cursor:pointer;">v${app.version} (الأحدث)</span>
    <span style="display:flex; gap:10px; align-items:center;">
      ${isAdmin ? `<button type="button" class="icon-btn-circle" data-main-del title="حذف الإصدار الحالي">🗑</button>` : ''}
    </span>`;
  mainRow.querySelector('.link').onclick = () => setActiveVersionUI(app, true, app.coverUrl);
  const mainDel = mainRow.querySelector('[data-main-del]');
  if (mainDel) mainDel.onclick = async () => {
    if (!app.history || !app.history.length) { showToast('ده آخر إصدار، احذف التطبيق كله لو عايز'); return; }
    if (!confirm(`حذف الإصدار الحالي v${app.version}؟`)) return;
    try {
      const newHistory = [...app.history];
      const promoted = newHistory.shift();
      const updatedFields = { version: promoted.version, name: promoted.name, fileUrl: promoted.fileUrl, releaseNotes: promoted.releaseNotes || '', history: newHistory };
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
      <span class="link" style="cursor:pointer;">v${h.version}</span>
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
  document.getElementById('nav-admin-br')?.classList.toggle('hidden-el', !isAdmin);
  document.getElementById('nav-admin-br2')?.classList.toggle('hidden-el', !isAdmin);
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
          <div class="stars">${'★'.repeat(r.rating || 5)}</div>
          ${isAdmin ? `<button type="button" class="icon-btn-circle" data-del-review="${r.id}" title="حذف">🗑</button>` : ''}
        </div>
        <blockquote class="testimonial-text" style="font-size:var(--text-small); margin:6px 0;">${r.text}</blockquote>
        <strong style="font-size:var(--text-small);">${r.name}</strong>
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
  document.getElementById('app-name').value = currentApp.name;
  document.getElementById('app-category').value = currentApp.category;
  document.getElementById('app-version').value = currentApp.version;
  document.getElementById('app-file').value = currentApp.fileUrl;
  document.getElementById('app-description').value = currentApp.description;
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
      if (currentApp && currentApp.id === id) Object.assign(currentApp, appData);
    } else {
      appData.createdAt = serverTimestamp();
      appData.likes = 0;
      appData.history = [];
      appData.releaseNotes = 'الإصدار الأول';
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
  document.getElementById('new-ver-name').value = currentApp.name;
  document.getElementById('new-ver-url').value = '';
  document.getElementById('new-ver-notes').value = '';
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
  document.getElementById('new-ver-name').value = data.name || app.name;
  document.getElementById('new-ver-url').value = data.fileUrl || '';
  document.getElementById('new-ver-notes').value = data.releaseNotes || '';
  document.getElementById('new-ver-image').value = '';
  openModal('version-modal');
}

const verForm = document.getElementById('version-form');
if (verForm) verForm.onsubmit = async (e) => {
  e.preventDefault();
  const id = document.getElementById('ver-app-id').value;
  const newVer = document.getElementById('new-ver-number').value;
  const newName = document.getElementById('new-ver-name').value;
  const newUrl = document.getElementById('new-ver-url').value;
  const newNotes = document.getElementById('new-ver-notes').value;
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
      const updatedEntry = { ...history[editCtx.idx], version: newVer, name: newName, fileUrl: newUrl, releaseNotes: newNotes };
      if (imgF) updatedEntry.coverUrl = await fileToBase64(imgF);
      history[editCtx.idx] = updatedEntry;
      await updateDoc(appRef, { history });
      if (currentApp?.id === id) { currentApp.history = history; buildVersions(currentApp); }
      showToast('تم تعديل الإصدار');
    } else if (editCtx && editCtx.idx === null) {
      const updatedFields = { version: newVer, name: newName, fileUrl: newUrl, releaseNotes: newNotes };
      if (imgF) updatedFields.coverUrl = await fileToBase64(imgF);
      await updateDoc(appRef, updatedFields);
      if (currentApp?.id === id) { Object.assign(currentApp, updatedFields); buildVersions(currentApp); setActiveVersionUI(currentApp, true, currentApp.coverUrl); }
      showToast('تم تعديل الإصدار الحالي');
    } else {
      const snap = await getDoc(appRef);
      if (snap.exists()) {
        const d = snap.data();
        const history = d.history || [];
        history.unshift({ version: d.version, name: d.name, coverUrl: d.coverUrl, fileUrl: d.fileUrl, releaseNotes: d.releaseNotes || d.description });
        const updatedData = { version: newVer, name: newName, fileUrl: newUrl, releaseNotes: newNotes, history, updatedAt: serverTimestamp() };
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
  document.getElementById('auth-modal-title').textContent = isLoginMode ? 'تسجيل الدخول' : 'إنشاء حساب جديد';
  document.getElementById('auth-submit-btn').textContent = isLoginMode ? 'دخول' : 'إنشاء حساب';
  document.getElementById('auth-name-field').classList.toggle('hidden-el', isLoginMode);
  document.getElementById('auth-switch-label').innerHTML = isLoginMode
    ? `مفيش حساب؟ <button type="button" class="switch-auth-mode" id="auth-switch-btn">إنشاء حساب جديد</button>`
    : `لديك حساب بالفعل؟ <button type="button" class="switch-auth-mode" id="auth-switch-btn">تسجيل الدخول</button>`;
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

  statusEl.textContent = 'جاري الإرسال...';
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
      statusEl.textContent = 'تم استلام رسالتك! هترد عليك قريب ✓';
      statusEl.style.color = '#4ade80';
      contactForm.reset();
    } else {
      console.error('contact failed', res.status, result);
      statusEl.innerHTML = `تعذّر الإرسال. تقدر تبعتلي مباشرة على <a href="mailto:kareemammar2025@gmail.com" style="text-decoration:underline;">البريد الإلكتروني</a>`;
      statusEl.style.color = '#ff4d6d';
    }
  } catch (err) {
    console.error(err);
    statusEl.innerHTML = `تعذّر الإرسال. تقدر تبعتلي مباشرة على <a href="mailto:kareemammar2025@gmail.com" style="text-decoration:underline;">البريد الإلكتروني</a>`;
    statusEl.style.color = '#ff4d6d';
  } finally {
    submitBtn.disabled = false;
  }
};

fetchApps();
