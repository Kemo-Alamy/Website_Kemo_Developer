# KEMO DEVELOPER Platform

A premium, modern software distribution platform built with HTML, CSS, JavaScript Modules, and Firebase.

## Features Implemented:
- **Premium Futuristic UI:** Glassmorphism, animated glow effects, intersection observers.
- **Firebase Auth:** Login/Register functionalities.
- **Secure Admin Panel:** Only visible and functional for `ADMIN_UID` (`yEzjER74k7dMURcoVaeeuHHfOl42`).
- **Dynamic App Catalog:** Real-time search and category filtering without reload.
- **Dedicated App Details:** Dynamic page routing `?id=...` preventing direct downloads from the grid.
- **Responsive & Theme:** Fully responsive grid and Light/Dark theme toggle.

## Setup Instructions:
1. Ensure all files (`index.html`, `app-details.html`, `styles.css`, `app.js`, `details.js`, `firebase-config.js`) are in the same directory.
2. Run via a local server (e.g., Live Server extension in VS Code) because ES Modules (`type="module"`) require a server to bypass CORS.
3. Deploy directly on GitHub Pages.

## Firebase Firestore Security Rules
To fully protect the database so no one can edit apps via console except the admin, go to Firebase Console -> Firestore Database -> Rules, and paste this:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /apps/{app} {
      // Anyone can read (view the applications)
      allow read: if true;
      // Only the verified Admin can create, update, or delete
      allow write: if request.auth != null && request.auth.uid == "yEzjER74k7dMURcoVaeeuHHfOl42";
    }
  }
}
