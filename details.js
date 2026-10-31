import { db } from "./firebase-config.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const container = document.getElementById('detailsContainer');
const params = new URLSearchParams(window.location.search);
const appId = params.get('id');

async function loadAppDetails() {
    if(!appId) {
        container.innerHTML = `<h2 style="color:var(--error); text-align:center;">Invalid Application ID.</h2>`;
        return;
    }

    try {
        const docRef = doc(db, "apps", appId);
        const docSnap = await getDoc(docRef);

        if(docSnap.exists()) {
            const app = docSnap.data();
            container.innerHTML = `
                <div class="details-header">
                    <img src="${app.imageUrl}" alt="${app.name}">
                    <div class="details-info">
                        <h1>${app.name}</h1>
                        <span class="badge">${app.category}</span>
                        <span class="badge" style="margin-left: 10px; background: var(--surface);">v${app.version}</span>
                    </div>
                </div>
                <div class="details-desc">
                    <h3>About Application</h3>
                    <p style="margin-top:1rem;">${app.description.replace(/\n/g, '<br>')}</p>
                </div>
                <div style="text-align: center; margin-top: 3rem;">
                    <a href="${app.downloadUrl}" target="_blank" class="btn-download">Download Application</a>
                </div>
            `;
        } else {
            container.innerHTML = `<h2 style="color:var(--error); text-align:center;">Application not found.</h2>`;
        }
    } catch(error) {
        container.innerHTML = `<h2 style="color:var(--error); text-align:center;">Error loading details.</h2>`;
    }
}

loadAppDetails();
