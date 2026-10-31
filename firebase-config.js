import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDZpKG0OSqUrkpTg_kR8fNZb5Obp8rVDY",
  authDomain: "kemo-developer.firebaseapp.com",
  projectId: "kemo-developer",
  storageBucket: "kemo-developer.firebasestorage.app",
  messagingSenderId: "241341205454",
  appId: "1:241341205454:web:fd564b9716a1d74a67799f"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const ADMIN_UID = "yEzjER74k7dMURcoVaeeuHHfOl42";

export { app, auth, db, ADMIN_UID };
