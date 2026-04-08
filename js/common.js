import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Các quyền mặc định cho từng role
export const DEFAULT_ROLES = {
    super_admin: { label: 'Quản trị cấp cao', color: 'red-700' },
    admin: { label: 'Quản trị viên', color: 'red-500' },
    member: { label: 'Thành viên', color: 'blue-600' },
    pending: { label: 'Chờ duyệt', color: 'yellow-500' }
};

export function setupLogoutButton(redirectPath = 'index.html') {
    const btn = document.getElementById('btn-logout');
    if (btn) {
        btn.addEventListener('click', async () => {
            await signOut(auth);
            window.location.href = redirectPath;
        });
    }
}

export async function getUserRole(uid) {
    try {
        const docRef = doc(db, 'users', uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return docSnap.data(); // Trả về toàn bộ data user
        }
    } catch (e) { console.error(e); }
    return null;
}

// Hàm kiểm tra quyền truy cập module
export function hasPermission(userPermissions, moduleKey, action = 'access') {
    // Nếu không có permissions object -> false
    if (!userPermissions) return false;
    // Kiểm tra quyền cụ thể: permissions['articles']['access']
    return userPermissions[moduleKey] && userPermissions[moduleKey][action] === true;
}

export function requireAuth(callback, failRedirectPath = 'index.html') {
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            window.location.href = failRedirectPath;
        } else {
            const userData = await getUserRole(user.uid);
            
            // Nếu user bị xóa khỏi DB hoặc chưa có data
            if (!userData) {
                await signOut(auth);
                window.location.href = failRedirectPath;
                return;
            }

            callback(user, userData);
        }
    });
}