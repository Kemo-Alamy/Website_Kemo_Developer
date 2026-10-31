import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, updateProfile, signOut,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  getFirestore, collection, doc, getDoc, addDoc, updateDoc,
  deleteDoc, onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const $ = id => document.getElementById(id);

let currentUser = null;
let isAdmin = false;
let allApps = [];
let activeCategory = "all";
let authMode = "login";
let toastTimer;

function toast(message) {
  const el = $("toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 3200);
}
function safeText(value = "") {
  return String(value).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
}
function validHttpUrl(value) {
  try { const u = new URL(value); return u.protocol === "https:" || u.protocol === "http:"; }
  catch { return false; }
}
function openAuth(mode) {
  authMode = mode;
  $("auth-modal").classList.remove("hidden");
  $("auth-title").textContent = mode === "login" ? "تسجيل الدخول" : "إنشاء حساب";
  $("auth-subtitle").textContent = mode === "login" ? "سجّل الدخول للمتابعة." : "أنشئ حسابًا جديدًا على المنصة.";
  $("auth-submit").textContent = mode === "login" ? "دخول" : "إنشاء الحساب";
  $("name-field").classList.toggle("hidden", mode === "login");
  $("display-name").required = mode === "signup";
  $("auth-password").autocomplete = mode === "login" ? "current-password" : "new-password";
  $("switch-label").textContent = mode === "login" ? "ليس لديك حساب؟" : "لديك حساب بالفعل؟";
  $("auth-switch").textContent = mode === "login" ? "إنشاء حساب" : "تسجيل الدخول";
  $("auth-message").textContent = "";
}
function closeAuth() { $("auth-modal").classList.add("hidden"); }
$("login-btn").addEventListener("click", () => openAuth("login"));
$("signup-btn").addEventListener("click", () => openAuth("signup"));
$("logout-btn").addEventListener("click", async () => {
  try { await signOut(auth); toast("تم تسجيل الخروج."); }
  catch (e) { toast("تعذر تسجيل الخروج: " + e.message); }
});
$("auth-close").addEventListener("click", closeAuth);
$("auth-modal").addEventListener("click", e => { if (e.target === $("auth-modal")) closeAuth(); });
$("auth-switch").addEventListener("click", () => openAuth(authMode === "login" ? "signup" : "login"));
$("forgot-password").addEventListener("click", async () => {
  const email = $("auth-email").value.trim();
  if (!email) { $("auth-message").textContent = "اكتب بريدك الإلكتروني أولًا."; return; }
  try { await sendPasswordResetEmail(auth, email); $("auth-message").textContent = "تم إرسال رابط استعادة كلمة المرور إذا كان البريد مسجلًا."; }
  catch (e) { $("auth-message").textContent = "تعذر إرسال الرابط: " + e.message; }
});
$("auth-form").addEventListener("submit", async e => {
  e.preventDefault();
  const email = $("auth-email").value.trim();
  const password = $("auth-password").value;
  const submit = $("auth-submit");
  submit.disabled = true;
  try {
    if (authMode === "login") {
      await signInWithEmailAndPassword(auth, email, password);
      closeAuth(); toast("تم تسجيل الدخول بنجاح.");
    } else {
      const name = $("display-name").value.trim();
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      if (name) await updateProfile(credential.user, { displayName: name });
      closeAuth(); toast("تم إنشاء الحساب بنجاح.");
    }
  } catch (e) {
    $("auth-message").textContent = authError(e.code);
  } finally { submit.disabled = false; }
});
function authError(code) {
  const messages = {
    "auth/invalid-email":"البريد الإلكتروني غير صحيح.",
    "auth/user-not-found":"لا يوجد حساب بهذا البريد.",
    "auth/wrong-password":"كلمة المرور غير صحيحة.",
    "auth/invalid-credential":"بيانات الدخول غير صحيحة.",
    "auth/email-already-in-use":"هذا البريد مسجل بالفعل.",
    "auth/weak-password":"كلمة المرور ضعيفة؛ استخدم 6 أحرف على الأقل.",
    "auth/too-many-requests":"محاولات كثيرة. حاول لاحقًا."
  };
  return messages[code] || "حدث خطأ. راجع البيانات وحاول مرة أخرى.";
}

$("theme-toggle").addEventListener("click", () => {
  const next = document.documentElement.dataset.theme === "light" ? "dark" : "light";
  document.documentElement.dataset.theme = next;
  $("theme-toggle").textContent = next === "light" ? "☀" : "☾";
});
$("menu-toggle").addEventListener("click", () => $("nav").classList.toggle("open"));
$("nav").querySelectorAll("a").forEach(a => a.addEventListener("click", () => $("nav").classList.remove("open")));
$("year").textContent = new Date().getFullYear();

function renderApps() {
  const term = $("search-input").value.trim().toLowerCase();
  const filtered = allApps.filter(item => {
    const categoryOk = activeCategory === "all" || item.category === activeCategory;
    const text = `${item.name || ""} ${item.description || ""}`.toLowerCase();
    return categoryOk && text.includes(term);
  });
  $("app-count").textContent = allApps.length;
  $("library-count").textContent = allApps.length;
  if (!filtered.length) {
    $("apps-grid").innerHTML = `<div class="state-card">لا توجد تطبيقات مطابقة حاليًا.</div>`;
    return;
  }
  $("apps-grid").innerHTML = filtered.map(item => {
    const image = validHttpUrl(item.imageUrl || "") ? `<img src="${safeText(item.imageUrl)}" alt="${safeText(item.name)}" loading="lazy" onerror="this.style.display='none'">` : `<div class="cover-placeholder">${safeText((item.name || "K").slice(0,1).toUpperCase())}</div>`;
    const download = validHttpUrl(item.downloadUrl || "") ? safeText(item.downloadUrl) : "#";
    const adminButtons = isAdmin ? `<button class="btn btn-ghost admin-action" data-edit="${safeText(item.id)}">تعديل</button><button class="btn btn-ghost admin-action" data-delete="${safeText(item.id)}">حذف</button>` : "";
    return `<article class="app-card"><div class="app-cover">${image}<span class="app-tag">${safeText(item.category || "تطبيقات")}</span></div><div class="app-body"><div class="app-title-line"><h3>${safeText(item.name || "بدون اسم")}</h3><span class="app-version">${safeText(item.version || "")}</span></div><p class="app-description">${safeText(item.description || "")}</p><div class="app-card-actions"><a class="btn btn-primary" href="${download}" target="_blank" rel="noopener noreferrer" ${download === "#" ? "aria-disabled='true'" : ""}>تحميل التطبيق ↗</a>${adminButtons}</div></div></article>`;
  }).join("");
  $("apps-grid").querySelectorAll("[data-edit]").forEach(btn => btn.addEventListener("click", () => editApp(btn.dataset.edit)));
  $("apps-grid").querySelectorAll("[data-delete]").forEach(btn => btn.addEventListener("click", () => removeApp(btn.dataset.delete)));
}
$("search-input").addEventListener("input", renderApps);
$("category-filters").querySelectorAll("[data-category]").forEach(btn => btn.addEventListener("click", () => {
  activeCategory = btn.dataset.category;
  $("category-filters").querySelectorAll(".filter").forEach(b => b.classList.toggle("active", b === btn));
  renderApps();
}));

function resetForm() {
  $("app-form").reset();
  $("edit-id").value = "";
  $("save-app").textContent = "نشر التطبيق";
  $("cancel-edit").classList.add("hidden");
  $("admin-message").textContent = "";
}
$("cancel-edit").addEventListener("click", resetForm);
$("app-form").addEventListener("submit", async e => {
  e.preventDefault();
  if (!isAdmin) { toast("هذه الخاصية متاحة للأدمن فقط."); return; }
  const id = $("edit-id").value;
  const name = $("app-name").value.trim();
  const category = $("app-category").value;
  const version = $("app-version").value.trim();
  const imageUrl = $("app-image-url").value.trim();
  const downloadUrl = $("app-download-url").value.trim();
  const description = $("app-description").value.trim();
  if (!validHttpUrl(downloadUrl)) { $("admin-message").textContent = "اكتب رابط تحميل صحيح يبدأ بـ https:// أو http://"; return; }
  if (imageUrl && !validHttpUrl(imageUrl)) { $("admin-message").textContent = "رابط الصورة غير صحيح."; return; }
  const payload = { name, category, version, imageUrl, downloadUrl, description, updatedAt: serverTimestamp() };
  const button = $("save-app");
  button.disabled = true;
  $("admin-message").textContent = "جارٍ الحفظ...";
  try {
    if (id) await updateDoc(doc(db, "apps", id), payload);
    else await addDoc(collection(db, "apps"), { ...payload, createdAt: serverTimestamp() });
    resetForm();
    toast(id ? "تم تحديث التطبيق." : "تم نشر التطبيق.");
  } catch (e) {
    $("admin-message").textContent = "تعذر الحفظ: " + (e.code || e.message);
  } finally { button.disabled = false; }
});
function editApp(id) {
  const item = allApps.find(x => x.id === id);
  if (!item) return;
  $("edit-id").value = id;
  $("app-name").value = item.name || "";
  $("app-category").value = item.category || "تطبيقات";
  $("app-version").value = item.version || "";
  $("app-image-url").value = item.imageUrl || "";
  $("app-download-url").value = item.downloadUrl || "";
  $("app-description").value = item.description || "";
  $("save-app").textContent = "حفظ التعديلات";
  $("cancel-edit").classList.remove("hidden");
  $("admin-panel").scrollIntoView({ behavior: "smooth", block: "start" });
}
async function removeApp(id) {
  if (!isAdmin || !confirm("هل تريد حذف هذا التطبيق من المكتبة؟")) return;
  try { await deleteDoc(doc(db, "apps", id)); toast("تم حذف التطبيق."); }
  catch (e) { toast("تعذر الحذف: " + (e.code || e.message)); }
}
function renderAdminList() {
  $("admin-app-count").textContent = allApps.length;
  $("admin-app-list").innerHTML = allApps.length ? allApps.map(item => `<div class="admin-row"><div class="admin-thumb">${safeText((item.name || "K").slice(0,1))}</div><div class="admin-row-info"><b>${safeText(item.name || "بدون اسم")}</b><small>${safeText(item.category || "")} · ${safeText(item.version || "بدون إصدار")}</small></div><button class="btn btn-ghost" data-list-edit="${safeText(item.id)}">تعديل</button><button class="btn btn-ghost" data-list-delete="${safeText(item.id)}">حذف</button></div>`).join("") : `<div class="state-card">لم تتم إضافة تطبيقات بعد.</div>`;
  $("admin-app-list").querySelectorAll("[data-list-edit]").forEach(b => b.addEventListener("click", () => editApp(b.dataset.listEdit)));
  $("admin-app-list").querySelectorAll("[data-list-delete]").forEach(b => b.addEventListener("click", () => removeApp(b.dataset.listDelete)));
}

let unsubscribeApps = null;
function subscribeApps() {
  if (unsubscribeApps) unsubscribeApps();
  unsubscribeApps = onSnapshot(collection(db, "apps"), snapshot => {
    allApps = snapshot.docs.map(d => ({ id: d.id, ...d.data() })).filter(x => x.name);
    allApps.sort((a,b) => {
      const ta = a.createdAt?.seconds || 0, tb = b.createdAt?.seconds || 0;
      return tb - ta;
    });
    renderApps();
    if (isAdmin) renderAdminList();
  }, error => {
    $("apps-grid").innerHTML = `<div class="state-card">تعذر تحميل المكتبة. تأكد من إعدادات Firestore وقواعد الوصول.</div>`;
    console.error(error);
  });
}

onAuthStateChanged(auth, async user => {
  currentUser = user;
  isAdmin = false;
  if (user) {
    try {
      const adminSnap = await getDoc(doc(db, "admins", user.uid));
      isAdmin = adminSnap.exists() && adminSnap.data().role === "admin";
    } catch (e) { console.error("Admin check:", e); }
  }
  $("login-btn").classList.toggle("hidden", !!user);
  $("signup-btn").classList.toggle("hidden", !!user);
  $("logout-btn").classList.toggle("hidden", !user);
  $("user-email").textContent = user ? (user.displayName || user.email || "") : "";
  $("admin-panel").classList.toggle("hidden", !isAdmin);
  if (isAdmin) renderAdminList();
  renderApps();
  if (!unsubscribeApps) subscribeApps();
});
