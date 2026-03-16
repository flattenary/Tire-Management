import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getFirestore, collection, getDoc, doc, query, where, getDocs, orderBy } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

// TODO: Replace with actual Firebase Web App configuration if this throws warnings
// The API Key and Project ID are generally enough for basic Firestore web access 
// on the same project assuming rules allow it.
const firebaseConfig = {
  apiKey: "AIzaSyDFjDK7EjGVQp_bv4_wCyPrlRJrxrZvXOY",
  projectId: "tire-management-fcb15",
  storageBucket: "tire-management-fcb15.firebasestorage.app",
  appId: "1:698826845609:web:placeholder" // Required by v10+ but can be placeholder if rules don't strictly require valid web app id
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// DOM Elements
const loadingEl = document.getElementById('loading');
const appEl = document.getElementById('app');
const errorEl = document.getElementById('error-screen');
const emptyEl = document.getElementById('empty-state');

const userNameEl = document.getElementById('user-name');
const userLogoEl = document.getElementById('user-logo');
const userLocationEl = document.getElementById('user-location');
const userLocationContainerEl = document.getElementById('user-location-container');
const userPhoneEl = document.getElementById('user-phone');
const userPhoneContainerEl = document.getElementById('user-phone-container');
const contactActionsEl = document.getElementById('contact-actions');
const whatsappBtnEl = document.getElementById('whatsapp-btn');
const tireCountEl = document.getElementById('tire-count');
const tiresGridEl = document.getElementById('tires-grid');
const searchInput = document.getElementById('tire-search');

let allTires = []; // Store all fetched tires for filtering

// Utility to format price
const formatPrice = (price) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(price);
};

// Main initialization
async function init() {
    const urlParams = new URLSearchParams(window.location.search);
    const uid = urlParams.get('uid');

    if (!uid) {
        showError("Invalid Link", "No user ID string provided in the link.");
        return;
    }

    // Set up search listener
    searchInput.addEventListener('input', (e) => {
        filterAndRenderTires(e.target.value);
    });

    try {
        await fetchAndRenderData(uid);
        hideLoading();
    } catch (err) {
        console.error("Initialization error:", err);
        showError("Access Denied or Error", "Could not load data. The user might not exist, or Firestore rules are preventing access.");
    }
}

async function fetchAndRenderData(uid) {
    // 1. Fetch User Profile
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
        throw new Error("User not found");
    }

    const userData = userSnap.data();
    
    // Update Profile UI
    userNameEl.textContent = userData.username || "Tire Dealer";
    
    if (userData.logoUrl && userData.logoUrl.startsWith("http")) {
        userLogoEl.src = userData.logoUrl;
    } else {
        const initial = (userData.username || "T").charAt(0).toUpperCase();
        userLogoEl.src = `https://ui-avatars.com/api/?name=${initial}&background=1d4ed8&color=fff&size=128&bold=true`;
    }

    // Location
    if (userData.location) {
        userLocationEl.textContent = userData.location;
        const encodedLocation = encodeURIComponent(userData.location);
        userLocationEl.href = `https://www.google.com/maps/search/?api=1&query=${encodedLocation}`;
        userLocationContainerEl.classList.remove('hidden');
    }

    // Phone & WhatsApp
    if (userData.phoneNumber) {
        userPhoneEl.textContent = userData.phoneNumber;
        userPhoneEl.href = `tel:${userData.phoneNumber}`;
        userPhoneContainerEl.classList.remove('hidden');

        const cleanPhone = userData.phoneNumber.replace(/\D/g, '');
        whatsappBtnEl.href = `https://wa.me/${cleanPhone}`;
        contactActionsEl.classList.remove('hidden');
    }

    // 2. Fetch Active Tires
    const tiresRef = collection(db, 'tires');
    const q = query(tiresRef,where('userId', '==', uid));

    const snapshot = await getDocs(q);
    allTires = [];
    snapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (data.status !== 'sold') {
            allTires.push({ id: docSnap.id, ...data });
        }
    });

    // Sort by newest first
    allTires.sort((a, b) => {
        const timeA = (a.createdAt?.seconds || 0);
        const timeB = (b.createdAt?.seconds || 0);
        return timeB - timeA;
    });

    // Initial render
    filterAndRenderTires("");
}

function filterAndRenderTires(searchTerm) {
    const term = searchTerm.toLowerCase().trim();
    const filtered = allTires.filter(tire => {
        const ref = (tire.reference || "").toLowerCase();
        const mark = (tire.mark || "").toLowerCase();
        const desc = (tire.description || "").toLowerCase();
        const dimStr = `${tire.width || ""} ${tire.speedRating || ""} ${tire.rimDiameter || ""}`.toLowerCase();
        
        return ref.includes(term) || mark.includes(term) || desc.includes(term) || dimStr.includes(term);
    });

    tireCountEl.textContent = filtered.length;

    if (filtered.length === 0) {
        tiresGridEl.innerHTML = '';
        emptyEl.classList.remove('hidden');
    } else {
        emptyEl.classList.add('hidden');
        renderTires(filtered);
    }
}

function renderTires(tires) {
    tiresGridEl.innerHTML = '';
    
    tires.forEach(tire => {
        const card = document.createElement('div');
        card.className = 'tire-card';
        
        const dims = (tire.width && tire.speedRating && tire.rimDiameter) 
            ? `${tire.width} ${tire.speedRating} ${tire.rimDiameter}"`
            : "";

        const statusMap = {
            'new': 'New',
            '4/4': 'Excellent (4/4)',
            '3/4': 'Good (3/4)',
            '2/4': 'Fair (2/4)',
            '1/4': 'Usable (1/4)'
        };
        const statusText = statusMap[tire.status] || tire.status;
        const markText = tire.mark || "";
        
        // Remove "Tire" from reference if it exists
        let cleanRef = (tire.reference || "");
        if (cleanRef.toLowerCase() === "tire") {
            cleanRef = "Ref: " + (tire.id?.substring(0, 6) || "N/A");
        } else {
            cleanRef = cleanRef.replace(/tire/gi, '').trim();
        }

        // Only show price if it's greater than 0
        const priceDisplay = (tire.price && tire.price > 0) 
            ? `<span class="price">${formatPrice(tire.price)}</span>`
            : '<span></span>';

        card.innerHTML = `
            <div class="card-top">
                ${markText ? `<span class="mark-badge">${markText}</span>` : '<span></span>'}
                <span class="status-badge">${statusText}</span>
            </div>
            <h3 class="ref-title">${cleanRef}</h3>
            <div class="details">
                ${tire.description ? `<p>${tire.description}</p>` : ''}
            </div>
            <div class="card-bottom">
                ${dims ? `<span class="dimensions">${dims}</span>` : '<span></span>'}
                ${priceDisplay}
            </div>
        `;
        tiresGridEl.appendChild(card);
    });
}

function showError(title, message) {
    hideLoading();
    appEl.classList.add('hidden');
    errorEl.classList.remove('hidden');
    document.getElementById('error-title').textContent = title;
    document.getElementById('error-message').textContent = message;
}

function hideLoading() {
    loadingEl.classList.add('hidden');
    appEl.classList.remove('hidden');
}

// Start app
init();
