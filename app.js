
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  sendPasswordResetEmail, signOut, onAuthStateChanged, updateProfile
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  getFirestore, collection, doc, getDoc, getDocs, addDoc, setDoc,
  updateDoc, deleteDoc, query, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import {
  getStorage, ref, uploadBytesResumable, getDownloadURL, deleteObject
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js";
import { firebaseConfig } from "./firebase-config.js";

const $ = id => document.getElementById(id);
const configured = firebaseConfig.apiKey !== "PASTE_API_KEY" && firebaseConfig.projectId !== "PASTE_PROJECT_ID";

let auth = null, db = null, storage = null, currentUser = null, isAdmin = false;
let signupMode = false, activeCategory = "all", apps = [], editing = null;

$("year").textContent = new Date().getFullYear();

const toast = message => {
  $("toast").textContent = message;
  $("toast").classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => $("toast").classList.remove("show"), 3000);
};

const message = (id, value) => {
  $(id).textContent = value || "";
};

$("theme-toggle").addEventListener("click", () => {
  const dark = document.documentElement.dataset.theme !== "dark";
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  $("theme-toggle").textContent = dark ? "☀" : "☾";
  try {
    localStorage.setItem("kemo-theme", dark ? "dark" : "light");
  } catch {}
});

try {
  const saved = localStorage.getItem("kemo-theme");
  if (saved) {
    document.documentElement.dataset.theme = saved;
    $("theme-toggle").textContent = saved === "dark" ? "☀" : "☾";
  }
} catch {}

$("menu-toggle").addEventListener("click", () => {
  const open = $("nav").classList.toggle("open");
  $("menu-toggle").setAttribute("aria-expanded", String(open));
});

$("nav").querySelectorAll("a").forEach(a =>
  a.addEventListener("click", () => $("nav").classList.remove("open"))
);

function openAuth(mode) {
  signupMode = mode === "signup";
  $("auth-modal").classList.remove("hidden");
  $("auth-title").textContent = signupMode ? "إنشاء حساب جديد" : "تسجيل الدخول";
  $("auth-subtitle").textContent = signupMode
    ? "أنشئ حسابك وابدأ استكشاف المكتبة."
    : "سجّل الدخول للوصول إلى حسابك.";
  $("auth-submit").textContent = signupMode ? "إنشاء الحساب" : "دخول";
  $("name-field").classList.toggle("hidden", !signupMode);
  $("auth-switch").textContent = signupMode ? "تسجيل الدخول" : "إنشاء حساب";
  $("switch-label").textContent = signupMode ? "لديك حساب بالفعل؟" : "ليس لديك حساب؟";
  message("auth-message", "");
}

$("login-btn").addEventListener("click", () =>
  configured ? openAuth("login") : toast("أضف إعدادات Firebase أولًا.")
);

$("signup-btn").addEventListener("click", () =>
  configured ? openAuth("signup") : toast("أضف إعدادات Firebase أولًا.")
);

$("auth-close").addEventListener("click", () =>
  $("auth-modal").classList.add("hidden")
);

$("auth-switch").addEventListener("click", () =>
  openAuth(signupMode ? "login" : "signup")
);

$("logout-btn").addEventListener("click", async () => {
  if (auth) await signOut(auth);
  toast("تم تسجيل الخروج.");
});

$("forgot-password").addEventListener("click", async () => {
  if (!configured) return;
  const email = $("auth-email").value.trim();
  if (!email) return message("auth-message", "اكتب بريدك الإلكتروني أولًا.");

  try {
    await sendPasswordResetEmail(auth, email);
    message("auth-message", "أرسلنا رابط إعادة تعيين كلمة المرور إلى بريدك.");
  } catch (e) {
    message("auth-message", authError(e.code));
  }
});

function authError(code) {
  const map = {
    "auth/email-already-in-use": "هذا البريد مسجل بالفعل.",
    "auth/invalid-email": "البريد الإلكتروني غير صحيح.",
    "auth/weak-password": "كلمة المرور ضعيفة؛ استخدم 6 أحرف على الأقل.",
    "auth/invalid-credential": "البريد أو كلمة المرور غير صحيحة.",
    "auth/user-not-found": "لا يوجد حساب بهذا البريد.",
    "auth/too-many-requests": "محاولات كثيرة. حاول لاحقًا.",
    "auth/network-request-failed": "تحقق من اتصال الإنترنت."
  };

  return map[code] || "حدث خطأ. راجع إعدادات Firebase وحاول مرة أخرى.";
}

$("auth-form").addEventListener("submit", async e => {
  e.preventDefault();

  if (!configured) return message("auth-message", "أكمل إعداد Firebase أولًا.");

  const email = $("auth-email").value.trim();
  const password = $("auth-password").value;

  $("auth-submit").disabled = true;

  try {
    if (signupMode) {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const displayName = $("display-name").value.trim();

      if (displayName) {
        await updateProfile(cred.user, { displayName });
      }

      await setDoc(doc(db, "users", cred.user.uid), {
        email, displayName, createdAt: serverTimestamp()
      });
    } else {
      await signInWithEmailAndPassword(auth, email, password);
    }

    $("auth-modal").classList.add("hidden");
    $("auth-form").reset();
    toast("تم تسجيل الدخول بنجاح.");
  } catch (err) {
    message("auth-message", authError(err.code));
  } finally {
    $("auth-submit").disabled = false;
  }
});

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, ch => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[ch]));
}

function visibleApps() {
  const term = $("search-input").value.trim().toLowerCase();

  return apps.filter(a =>
    (activeCategory === "all" || a.category === activeCategory) &&
    [a.name, a.category, a.description].some(v =>
      String(v || "").toLowerCase().includes(term)
    )
  );
}

function renderApps() {
  const list = visibleApps();
  $("app-count").textContent = apps.length;

  const grid = $("apps-grid");

  if (!list.length) {
    grid.innerHTML = `<div class="empty-state">${configured
      ? "لا توجد تطبيقات في هذا القسم حاليًا."
      : "اربط الموقع بمشروع Firebase حتى تظهر التطبيقات."}</div>`;
    return;
  }

  grid.innerHTML = list.map(a => `
    <article class="app-card">
      <div class="app-cover">
        ${a.coverUrl
          ? `<img src="${escapeHtml(a.coverUrl)}" alt="${escapeHtml(a.name)}" loading="lazy">`
          : `<div class="cover-placeholder">${escapeHtml((a.name || "K").slice(0,1).toUpperCase())}</div>`}
        <span class="app-tag">${escapeHtml(a.category || "عام")}</span>
      </div>
      <div class="app-body">
        <div class="app-title-line">
          <h3>${escapeHtml(a.name)}</h3>
          <span class="app-version">${a.version ? "v" + escapeHtml(a.version) : ""}</span>
        </div>
        <p class="app-description">${escapeHtml(a.description || "")}</p>
        <div class="app-card-actions">
          ${a.downloadUrl
            ? `<a class="btn btn-dark" href="${escapeHtml(a.downloadUrl)}" target="_blank" rel="noopener noreferrer">تحميل <span>↓</span></a>`
            : `<button class="btn btn-outline" disabled>رابط التحميل غير متاح</button>`}
        </div>
      </div>
    </article>
  `).join("");
}

$("search-input").addEventListener("input", renderApps);

$("category-filters").querySelectorAll("button").forEach(btn =>
  btn.addEventListener("click", () => {
    activeCategory = btn.dataset.category;

    $("category-filters").querySelectorAll("button").forEach(b =>
      b.classList.toggle("active", b === btn)
    );

    renderApps();
  })
);

document.querySelectorAll("[data-pick]").forEach(btn =>
  btn.addEventListener("click", () => {
    activeCategory = btn.dataset.pick;

    $("category-filters").querySelectorAll("button").forEach(b =>
      b.classList.toggle("active", b.dataset.category === activeCategory)
    );

    $("apps").scrollIntoView({ behavior: "smooth" });
    renderApps();
  })
);

async function loadApps() {
  if (!db) {
    renderApps();
    return;
  }

  try {
    const snap = await getDocs(
      query(collection(db, "apps"), orderBy("createdAt", "desc"))
    );

    apps = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderApps();
    renderAdminList();
  } catch (e) {
    console.error(e);
    $("apps-grid").innerHTML =
      `<div class="empty-state">تعذر تحميل المكتبة. تأكد من نشر قواعد Firestore.</div>`;
  }
}

function renderAdminList() {
  $("admin-app-count").textContent = apps.length;

  $("admin-app-list").innerHTML = apps.length
    ? apps.map(a => `
      <div class="admin-row">
        ${a.coverUrl
          ? `<img src="${escapeHtml(a.coverUrl)}" alt="">`
          : `<span class="admin-thumb">K</span>`}
        <div>
          <b>${escapeHtml(a.name)}</b>
          <small>${escapeHtml(a.category || "")} ${a.version ? " · " + escapeHtml(a.version) : ""}</small>
        </div>
        <button class="btn btn-outline" data-edit="${a.id}">تعديل</button>
        <button class="btn btn-outline" data-delete="${a.id}">حذف</button>
      </div>
    `).join("")
    : `<div class="empty-state">لم يتم نشر تطبيقات بعد.</div>`;

  $("admin-app-list").querySelectorAll("[data-edit]").forEach(b =>
    b.addEventListener("click", () => startEdit(b.dataset.edit))
  );

  $("admin-app-list").querySelectorAll("[data-delete]").forEach(b =>
    b.addEventListener("click", () => removeApp(b.dataset.delete))
  );
}

function startEdit(id) {
  const a = apps.find(x => x.id === id);
  if (!a) return;

  editing = a;
  $("edit-id").value = id;
  $("app-name").value = a.name || "";
  $("app-category").value = a.category || "تطبيقات";
  $("app-version").value = a.version || "";
  $("app-description").value = a.description || "";
  $("save-app").textContent = "حفظ التعديلات";
  $("cancel-edit").classList.remove("hidden");
  $("admin-panel").scrollIntoView({ behavior: "smooth" });
}

function clearEdit() {
  editing = null;
  $("app-form").reset();
  $("edit-id").value = "";
  $("save-app").textContent = "نشر التطبيق";
  $("cancel-edit").classList.add("hidden");
  message("admin-message", "");
}

$("cancel-edit").addEventListener("click", clearEdit);

function uploadFile(file, path, onProgress) {
  return new Promise((resolve, reject) => {
    const task = uploadBytesResumable(
      ref(storage, path),
      file,
      { contentType: file.type || "application/octet-stream" }
    );

    task.on(
      "state_changed",
      snap => onProgress?.(
        snap.totalBytes
          ? Math.round(snap.bytesTransferred / snap.totalBytes * 100)
          : 0
      ),
      reject,
      async () => {
        try {
          resolve(await getDownloadURL(task.snapshot.ref));
        } catch (e) {
          reject(e);
        }
      }
    );
  });
}

async function removeApp(id) {
  const a = apps.find(x => x.id === id);
  if (!a || !confirm(`حذف ${a.name}؟`)) return;

  try {
    await deleteDoc(doc(db, "apps", id));

    for (const path of [a.coverPath, a.filePath]) {
      if (path) {
        try {
          await deleteObject(ref(storage, path));
        } catch (e) {
          console.warn("Could not remove storage object", e);
        }
      }
    }

    toast("تم حذف التطبيق.");
    await loadApps();
  } catch (e) {
    toast("تعذر الحذف. تأكد من صلاحيات الأدمن.");
    console.error(e);
  }
}

$("app-form").addEventListener("submit", async e => {
  e.preventDefault();

  if (!isAdmin) {
    return message("admin-message", "لا تملك صلاحية الأدمن.");
  }

  const name = $("app-name").value.trim();
  const description = $("app-description").value.trim();

  if (!name || !description) {
    return message("admin-message", "اكتب اسم التطبيق والوصف.");
  }

  const imageFile = $("app-image").files[0];
  const appFile = $("app-file").files[0];

  if (!editing && !appFile) {
    return message("admin-message", "اختر ملف التطبيق أو رابط تحميل خارجي بعد التعديل.");
  }

  if (imageFile && imageFile.size > 8 * 1024 * 1024) {
    return message("admin-message", "حجم صورة الغلاف يجب ألا يتجاوز 8 ميجابايت.");
  }

  if (appFile && appFile.size > 200 * 1024 * 1024) {
    return message("admin-message", "حجم الملف يجب ألا يتجاوز 200 ميجابايت.");
  }

  const allowed = /\.(apk|aab|zip|xapk|apks)$/i;

  if (appFile && !allowed.test(appFile.name)) {
    return message("admin-message", "نوع الملف غير مدعوم. استخدم APK أو AAB أو ZIP أو XAPK أو APKS.");
  }

  $("save-app").disabled = true;
  $("upload-progress").classList.remove("hidden");

  const bar = $("progress-bar");
  bar.style.width = "0%";

  const wasEditing = Boolean(editing);

  try {
    const id = editing?.id || doc(collection(db, "apps")).id;

    let coverUrl = editing?.coverUrl || "";
    let coverPath = editing?.coverPath || "";
    let downloadUrl = editing?.downloadUrl || "";
    let filePath = editing?.filePath || "";

    if (imageFile) {
      coverPath = `apps/${id}/cover-${Date.now()}-${imageFile.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

      coverUrl = await uploadFile(
        imageFile,
        coverPath,
        p => bar.style.width = `${Math.round(p * .35)}%`
      );
    }

    if (appFile) {
      filePath = `apps/${id}/file-${Date.now()}-${appFile.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

      downloadUrl = await uploadFile(
        appFile,
        filePath,
        p => bar.style.width = `${35 + Math.round(p * .65)}%`
      );
    }

    const data = {
      name,
      description,
      category: $("app-category").value,
      version: $("app-version").value.trim(),
      coverUrl,
      coverPath,
      downloadUrl,
      filePath,
      updatedAt: serverTimestamp()
    };

    if (editing) {
      await updateDoc(doc(db, "apps", id), data);
    } else {
      await setDoc(doc(db, "apps", id), {
        ...data,
        createdAt: serverTimestamp()
      });
    }

    clearEdit();
    toast(wasEditing ? "تم تحديث التطبيق." : "تم نشر التطبيق.");
    await loadApps();

  } catch (err) {
    console.error(err);

    message(
      "admin-message",
      err.code === "storage/unauthorized"
        ? "رفع الملفات غير مسموح. راجع Storage Rules وحالة خطة Firebase."
        : "حدث خطأ أثناء الحفظ أو الرفع. راجع إعداد Firebase."
    );

  } finally {
    $("save-app").disabled = false;

    setTimeout(
      () => $("upload-progress").classList.add("hidden"),
      900
    );
  }
});

$("contact-form").addEventListener("submit", e => {
  e.preventDefault();

  const name = $("contact-name").value.trim();
  const email = $("contact-email").value.trim();
  const msg = $("contact-message").value.trim();

  const subject = encodeURIComponent("رسالة من موقع KEMO DEVELOPER");
  const body = encodeURIComponent(
    `الاسم: ${name}\nالبريد: ${email}\n\nالرسالة:\n${msg}`
  );

  window.location.href =
    `mailto:kareemammar2025@gmail.com?subject=${subject}&body=${body}`;

  message("contact-status", "سيتم فتح تطبيق البريد لإرسال رسالتك.");
});

if (configured) {
  const firebaseApp = initializeApp(firebaseConfig);

  auth = getAuth(firebaseApp);
  db = getFirestore(firebaseApp);
  storage = getStorage(firebaseApp);

  onAuthStateChanged(auth, async user => {
    currentUser = user;
    isAdmin = false;

    if (user) {
      try {
        const adminDocRef = doc(db, "admins", user.uid);
        const snap = await getDoc(adminDocRef);

        console.log("Admin check:", {
          uid: user.uid,
          documentExists: snap.exists(),
          role: snap.exists() ? snap.data().role : null
        });

        isAdmin = snap.exists() && snap.data().role === "admin";

        if (!isAdmin) {
          toast("تم تسجيل الدخول، لكن الحساب ليس أدمن.");
        } else {
          toast("تم التعرف على حساب الأدمن بنجاح.");
        }

      } catch (e) {
        console.error("Admin check failed:", e);
        toast("فشل التحقق من الأدمن: " + (e.code || e.message));
      }
    }

    $("login-btn").classList.toggle("hidden", !!user);
    $("signup-btn").classList.toggle("hidden", !!user);
    $("logout-btn").classList.toggle("hidden", !user);

    $("user-email").textContent = user
      ? (user.displayName || user.email || "حسابي")
      : "";

    $("admin-panel").classList.toggle("hidden", !isAdmin);

    await loadApps();
  });

} else {
  $("apps-grid").innerHTML =
    `<div class="empty-state">التصميم جاهز. أضف إعدادات Firebase في firebase-config.js لتفعيل التسجيل وقاعدة البيانات ورفع الملفات.</div>`;

  $("app-count").textContent = "0";
}

const observer = new IntersectionObserver(
  entries => entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add("visible");
      observer.unobserve(entry.target);
    }
  }),
  { threshold: .12 }
);

document.querySelectorAll(".reveal").forEach(el =>
  observer.observe(el)
);
