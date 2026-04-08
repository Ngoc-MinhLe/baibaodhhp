import { db } from './firebase-config.js';
import { collection, getDocs, doc, updateDoc, query, orderBy, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { requireAuth, setupLogoutButton, DEFAULT_ROLES } from './common.js';

let currentUserData = null;

requireAuth(async (user, userData) => {
    currentUserData = userData;
    
    // Bảo vệ trang: Chỉ Super Admin hoặc người có quyền 'admin.access' mới được vào
    const canAccess = userData.role === 'super_admin' || (userData.permissions && userData.permissions.admin && userData.permissions.admin.access);
    
    if (!canAccess) {
        alert("Bạn không có quyền truy cập trang quản trị!");
        window.location.href = '../';
        return;
    }
    
    document.getElementById('auth-loading').classList.add('hidden');
    document.getElementById('admin-ui').classList.remove('hidden');
    document.getElementById('admin-ui').classList.add('flex');
    
    setupLogoutButton('../');
    loadUsers();
}, '../');

async function loadUsers() {
    const tbody = document.getElementById('user-table-body');
    tbody.innerHTML = '<tr><td colspan="10" class="text-center p-4">Đang tải...</td></tr>';
    
    const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    
    tbody.innerHTML = '';
    snapshot.forEach(docSnap => {
        const u = { id: docSnap.id, ...docSnap.data() };
        renderUserRow(u, tbody);
    });
}

function renderUserRow(u, tbody) {
    const tr = document.createElement('tr');
    tr.className = "border-b hover:bg-gray-50";
    
    // Xử lý permissions mặc định nếu thiếu
    const perms = u.permissions || {};
    // Thêm quyền manage_others (Sửa xóa bài người khác)
    const artPerms = perms.articles || { access: false, view_all: false, create: false, manage_others: false };
    const adminPerms = perms.admin || { access: false };
    const catPerms = perms.categories || { access: false };
    const yearPerms = perms.years || { access: false };

    // Role Label
    const roleInfo = DEFAULT_ROLES[u.role] || DEFAULT_ROLES['member'];
    const roleBadge = `<span class="bg-${roleInfo.color} text-white px-2 py-1 rounded text-xs">${roleInfo.label}</span>`;

    // Logic Disable:
    let isDisabled = false;
    if (u.role === 'super_admin') isDisabled = true;
    if (currentUserData.role !== 'super_admin' && u.role === 'admin') isDisabled = true; 

    // Nút Xóa
    const showDelete = currentUserData.role === 'super_admin' && u.role !== 'super_admin';

    tr.innerHTML = `
        <td class="px-4 py-3">
            <div class="font-bold text-gray-900">${u.displayName || 'Không tên'}</div>
            <div class="text-gray-500 text-xs">${u.email}</div>
        </td>
        <td class="px-4 py-3 text-center">${roleBadge}</td>
        
        <!-- Module Bài Báo -->
        <td class="px-4 py-3 text-center border-l bg-blue-50/30">
            <label class="block text-xs text-gray-500">Truy cập</label>
            <input type="checkbox" ${artPerms.access ? 'checked' : ''} ${isDisabled ? 'disabled' : ''} 
                onchange="window.updateModulePerm('${u.id}', 'articles', 'access', this.checked)">
        </td>
        <td class="px-4 py-3 text-center bg-blue-50/30">
            <label class="block text-xs text-gray-500">Xem tất cả</label>
            <input type="checkbox" ${artPerms.view_all ? 'checked' : ''} ${isDisabled ? 'disabled' : ''} 
                onchange="window.updateModulePerm('${u.id}', 'articles', 'view_all', this.checked)">
        </td>
        <td class="px-4 py-3 text-center bg-blue-50/30">
            <label class="block text-xs text-gray-500">Đăng bài</label>
            <input type="checkbox" ${artPerms.create ? 'checked' : ''} ${isDisabled ? 'disabled' : ''} 
                onchange="window.updateModulePerm('${u.id}', 'articles', 'create', this.checked)">
        </td>
        <td class="px-4 py-3 text-center bg-blue-50/30 border-r">
            <label class="block text-xs text-gray-500 font-bold text-red-600">Sửa/Xóa All</label>
            <input type="checkbox" ${artPerms.manage_others ? 'checked' : ''} ${isDisabled ? 'disabled' : ''} 
                onchange="window.updateModulePerm('${u.id}', 'articles', 'manage_others', this.checked)">
        </td>

        <!-- Module Danh Mục -->
        <td class="px-4 py-3 text-center bg-green-50/30 border-r">
            <label class="block text-xs text-gray-500">Truy cập</label>
            <input type="checkbox" ${catPerms.access ? 'checked' : ''} ${isDisabled ? 'disabled' : ''} 
                onchange="window.updateModulePerm('${u.id}', 'categories', 'access', this.checked)">
        </td>

        <!-- Module Năm Học -->
        <td class="px-4 py-3 text-center bg-yellow-50/30 border-r">
            <label class="block text-xs text-gray-500">Truy cập</label>
            <input type="checkbox" ${yearPerms.access ? 'checked' : ''} ${isDisabled ? 'disabled' : ''} 
                onchange="window.updateModulePerm('${u.id}', 'years', 'access', this.checked)">
        </td>

        <!-- Module Admin (Quyền quản trị) -->
        <td class="px-4 py-3 text-center bg-purple-50/30">
            <label class="block text-xs text-gray-500">Vào trang này</label>
            <input type="checkbox" ${adminPerms.access ? 'checked' : ''} ${isDisabled ? 'disabled' : ''} 
                onchange="window.updateModulePerm('${u.id}', 'admin', 'access', this.checked)">
        </td>

        <!-- Hành động -->
        <td class="px-4 py-3 text-center">
            ${u.role === 'pending' ? `
                <button onclick="window.approveUser('${u.id}')" class="bg-green-600 text-white px-2 py-1 rounded text-xs hover:bg-green-700 block w-full mb-1">
                    <i class="fas fa-check mr-1"></i> Duyệt
                </button>
            ` : ''}
            
            ${showDelete ? `
                <button onclick="window.removeUser('${u.id}')" class="text-red-500 hover:text-red-700 text-xs" title="Xóa tài khoản">
                    <i class="fas fa-trash"></i>
                </button>
            ` : ''}
        </td>
    `;
    tbody.appendChild(tr);
}

// Cập nhật Permission lồng nhau (articles.access, admin.access...)
window.updateModulePerm = async (uid, module, action, value) => {
    // Firestore update nested fields: "permissions.articles.access": true
    const fieldPath = `permissions.${module}.${action}`;
    const updateData = {};
    updateData[fieldPath] = value;
    
    try {
        await updateDoc(doc(db, 'users', uid), updateData);
    } catch (e) {
        alert("Lỗi: " + e.message);
        loadUsers(); // Revert UI nếu lỗi
    }
};

window.approveUser = async (uid) => {
    if(confirm("Duyệt thành viên này? Họ sẽ thành 'Member' và có quyền cơ bản.")) {
        await updateDoc(doc(db, 'users', uid), {
            role: 'member',
            permissions: {
                articles: { access: true, view_all: false, create: true, manage_others: false }, 
                categories: { access: false },
                years: { access: false },
                admin: { access: false }
            }
        });
        loadUsers();
    }
};

window.removeUser = async (uid) => {
    if(confirm("CẢNH BÁO: Bạn có chắc chắn muốn xóa hoàn toàn user này khỏi hệ thống?")) {
        try {
            await deleteDoc(doc(db, 'users', uid));
            loadUsers();
        } catch (e) { alert("Lỗi xóa: " + e.message); }
    }
};