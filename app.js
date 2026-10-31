import { auth, db, ADMIN_UID } from "./firebase-config.js";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, getDocs, addDoc, deleteDoc, doc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// DOM Elements
const authBtn = document.getElementById('authBtn');
const logoutBtn = document.getElementById('logoutBtn');
const authModal = document.getElementById('authModal');
const closeAuth = document.getElementById('closeAuth');
const authForm = document.getElementById('authForm');
const toggleAuthMode = document.getElementById('toggleAuthMode');
const modalTitle = document.getElementById('modalTitle');
const adminPanel = document.getElementById('adminPanel');
const appsGrid = document.getElementById('appsGrid');
const addAppForm = document.getElementById('addAppForm');

let isLoginMode = true;
let allApps = [];
let currentUser = null;

// UI & Animations
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if(entry.isIntersecting) {
            entry.target.classList.add('show-scroll');
        } else {
            entry.target.classList.remove('show-scroll');
        }
    });
}, { threshold: 0.1 });
document.querySelectorAll('.hidden-scroll').forEach(el => observer.observe(el));

// Theme Toggle
document.getElementById('themeToggle').addEventListener('click', () => {
    document.body.classList.toggle('light-theme');
    localStorage.setItem('theme', document.body.classList.contains('light-theme') ? 'light' : 'dark');
});
if(localStorage.getItem('theme') === 'light') document.body.classList.add('light-theme');

// Toast Notification
window.showToast = (msg) => {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

// Auth Modals Toggle
authBtn.onclick = () => authModal.classList.add('active');
closeAuth.onclick = () => authModal.classList.remove('active');
toggleAuthMode.onclick = () => {
    isLoginMode = !isLoginMode;
    modalTitle.textContent = isLoginMode ? "Login" : "Sign Up";
    document.getElementById('authSubmitBtn').textContent = isLoginMode ? "Login" : "Register";
    toggleAuthMode.textContent = isLoginMode ? "Don't have an account? Sign Up" : "Already have an account? Login";
};

// Authentication Flow
authForm.onsubmit = async (e) => {
    e.preventDefault();
    const email = document.getElementById('authEmail').value;
    const pass = document.getElementById('authPassword').value;
    try {
        if(isLoginMode) await signInWithEmailAndPassword(auth, email, pass);
        else await createUserWithEmailAndPassword(auth, email, pass);
        authModal.classList.remove('active');
        showToast("Authentication Successful!");
    } catch(err) {
        showToast("Error: " + err.message);
    }
};

logoutBtn.onclick = async () => {
    await signOut(auth);
    showToast("Logged out successfully");
};

// Auth State Listener
onAuthStateChanged(auth, (user) => {
    currentUser = user;
    if(user) {
        authBtn.style.display = 'none';
        logoutBtn.style.display = 'inline-block';
        if(user.uid === ADMIN_UID) adminPanel.classList.add('active');
        else adminPanel.classList.remove('active');
    } else {
        authBtn.style.display = 'inline-block';
        logoutBtn.style.display = 'none';
        adminPanel.classList.remove('active');
    }
    renderApps(); // Re-render to show/hide delete buttons
});

// Fetch & Render Apps
async function loadApps() {
    try {
        const querySnapshot = await getDocs(collection(db, "apps"));
        allApps = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderApps();
    } catch(err) {
        appsGrid.innerHTML = `<div class="empty-state" style="color:var(--error)">Failed to load applications.</div>`;
    }
}

function renderApps(filterText = "", filterCat = "All") {
    appsGrid.innerHTML = '';
    const filtered = allApps.filter(app => {
        const matchName = app.name.toLowerCase().includes(filterText.toLowerCase());
        const matchCat = filterCat === "All" || app.category === filterCat;
        return matchName && matchCat;
    });

    if(filtered.length === 0) {
        appsGrid.innerHTML = `<div class="empty-state">No applications found.</div>`;
        return;
    }

    filtered.forEach(app => {
        const card = document.createElement('div');
        card.className = 'card hidden-scroll show-scroll';
        
        let adminHtml = '';
        if(currentUser && currentUser.uid === ADMIN_UID) {
            adminHtml = `<button onclick="deleteApp(event, '${app.id}')" style="background:var(--error); color:#fff; border:none; padding:5px 10px; border-radius:5px; margin-top:10px; position:absolute; top:10px; right:10px; z-index:10;">Delete</button>`;
        }

        card.innerHTML = `
            ${adminHtml}
            <div onclick="window.location.href='app-details.html?id=${app.id}'">
                <img src="${app.imageUrl}" alt="${app.name}">
                <span class="category">${app.category} v${app.version}</span>
                <h3>${app.name}</h3>
                <p>${app.description}</p>
            </div>
        `;
        appsGrid.appendChild(card);
    });
}

// Search and Filter Listeners
document.getElementById('searchInput').addEventListener('input', (e) => renderApps(e.target.value, document.getElementById('filterCategory').value));
document.getElementById('filterCategory').addEventListener('change', (e) => renderApps(document.getElementById('searchInput').value, e.target.value));

// Add App (Admin Only)
addAppForm.onsubmit = async (e) => {
    e.preventDefault();
    if(!currentUser || currentUser.uid !== ADMIN_UID) return showToast("Unauthorized!");
    
    const newApp = {
        name: document.getElementById('appName').value,
        category: document.getElementById('appCategory').value,
        version: document.getElementById('appVersion').value,
        imageUrl: document.getElementById('appImage').value,
        downloadUrl: document.getElementById('appDownload').value,
        description: document.getElementById('appDesc').value,
        createdAt: serverTimestamp()
    };

    try {
        await addDoc(collection(db, "apps"), newApp);
        showToast("Application added successfully!");
        addAppForm.reset();
        loadApps();
    } catch(err) {
        showToast("Error adding app!");
    }
};

// Delete App (Admin Only) attached to window for inline HTML onclick
window.deleteApp = async (e, id) => {
    e.stopPropagation();
    if(confirm("Are you sure you want to delete this app?")) {
        try {
            await deleteDoc(doc(db, "apps", id));
            showToast("App deleted successfully!");
            loadApps();
        } catch(err) {
            showToast("Error deleting app!");
        }
    }
};

// Initial Load
loadApps();
