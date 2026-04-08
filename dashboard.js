import { auth, provider, db } from './firebase-config.js';
import { signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, getDoc, setDoc, updateDoc, query, where, getDocs, collection } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { setupLogoutButton, DEFAULT_ROLES, hasPermission } from './common.js';

const loginOverlay = document.getElementById('login-overlay');
const dashboardUi = document.getElementById('dashboard-ui');
const loginError = document.getElementById('login-error');
const btnLogin = document.getElementById('btn-google-login');

let currentUserUid = null;
let currentUserData = null;

btnLogin.addEventListener('click', async () => {
    loginError.classList.add('hidden');
    try {
        const result = await signInWithPopup(auth, provider);
        handleUserCheck(result.user);
    } catch (error) {
        loginError.textContent = "Lỗi: " + error.message;
        loginError.classList.remove('hidden');
    }
});

async function handleUserCheck(user) {
    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);
    let userData = null;

    if (userSnap.exists()) {
        userData = userSnap.data();
    } else {
        // Kiểm tra xem đã có Super Admin chưa?
        const qSuper = query(collection(db, 'users'), where("role", "==", "super_admin"));
        const superSnaps = await getDocs(qSuper);
        
        let initialRole = 'pending';
        // Nếu chưa có ai -> Người đầu tiên là Super Admin
        if (superSnaps.empty) {
            initialRole = 'super_admin';
        }

        userData = {
            email: user.email,
            displayName: user.displayName,
            role: initialRole,
            // Cấu trúc Permission mới: Theo từng Module
            permissions: {
                articles: { access: initialRole === 'super_admin', view_all: initialRole === 'super_admin', create: initialRole === 'super_admin' },
                categories: { access: initialRole === 'super_admin' },
                admin: { access: initialRole === 'super_admin' } // Quyền vào trang quản trị
            },
            createdAt: Date.now()
        };

        await setDoc(userRef, userData);
    }

    showDashboard(user, userData);
}

function showDashboard(user, userData) {
    loginOverlay.style.display = 'none';
    dashboardUi.classList.remove('hidden');
    dashboardUi.classList.add('flex');
    currentUserUid = user.uid;
    currentUserData = userData;

    document.getElementById('user-name').textContent = user.displayName;
    
    // Hiển thị Role Badge
    const roleInfo = DEFAULT_ROLES[userData.role] || DEFAULT_ROLES['member'];
    const roleBadge = document.getElementById('user-role');
    roleBadge.textContent = roleInfo.label;
    roleBadge.className = `text-xs bg-${roleInfo.color} px-2 py-0.5 rounded inline-block text-white`;

    const warningBox = document.getElementById('pending-warning');
    const moduleArticles = document.getElementById('module-articles');
    const moduleAdmin = document.getElementById('admin-module');
    const moduleCategories = document.getElementById('module-categories');

    // Reset UI
    warningBox.classList.add('hidden');
    moduleArticles.classList.remove('opacity-50', 'pointer-events-none');
    moduleAdmin.classList.add('hidden'); // Mặc định ẩn Admin
    moduleCategories.classList.add('hidden');

    // 1. Nếu là Pending -> Hiện cảnh báo, khóa hết
    if (userData.role === 'pending') {
        warningBox.classList.remove('hidden');
        moduleArticles.classList.add('opacity-50', 'pointer-events-none');
        return; // Dừng, không check tiếp
    }

    // 2. Check quyền Module Bài Báo
    // Super Admin luôn có quyền (hoặc check permission cũng được vì super admin luôn full)
    if (userData.role !== 'super_admin' && !hasPermission(userData.permissions, 'articles', 'access')) {
        moduleArticles.classList.add('opacity-50', 'pointer-events-none');
    }

    // 3. Check quyền Module Admin
    // Chỉ Super Admin hoặc Admin được cấp quyền mới thấy
    if (userData.role === 'super_admin' || hasPermission(userData.permissions, 'admin', 'access')) {
        moduleAdmin.classList.remove('hidden');
    }

    // 4. Check quyền Module Categories
    if (userData.role === 'super_admin' || hasPermission(userData.permissions, 'categories', 'access')) {
        moduleCategories.classList.remove('hidden');
    }

    setupLogoutButton();
}

onAuthStateChanged(auth, async (user) => {
    if (user) {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (snap.exists()) {
            showDashboard(user, snap.data());
        } else {
            handleUserCheck(user);
        }
    } else {
        loginOverlay.style.display = 'flex';
        dashboardUi.classList.remove('flex');
        dashboardUi.classList.add('hidden');
    }
});

// --- QUẢN LÝ HỒ SƠ TÁC GIẢ ---
window.openProfileModal = () => {
    document.getElementById('profile-author-name').value = currentUserData.authorName || currentUserData.displayName || "";
    document.getElementById('profile-modal').classList.remove('hidden');
};
window.closeProfileModal = () => document.getElementById('profile-modal').classList.add('hidden');

document.getElementById('form-profile').addEventListener('submit', async (e) => {
    e.preventDefault();
    const newName = document.getElementById('profile-author-name').value.trim();
    try {
        await updateDoc(doc(db, 'users', currentUserUid), { authorName: newName });
        currentUserData.authorName = newName;
        alert("Cập nhật tên tác giả thành công!");
        window.closeProfileModal();
    } catch (err) { alert("Lỗi: " + err.message); }
});