import { db } from './firebase-config.js';
import { collection, addDoc, doc, updateDoc, deleteDoc, query, onSnapshot, orderBy } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { requireAuth, setupLogoutButton, hasPermission } from './common.js';

let allYears = [];
const HOME_PATH = '../';

requireAuth(async (user, userData) => {
    const canAccess = userData.role === 'super_admin' || hasPermission(userData.permissions, 'years', 'access');
    if (!canAccess) {
        alert("Bạn không có quyền truy cập trang quản lý năm học.");
        window.location.href = HOME_PATH;
        return;
    }

    document.getElementById('auth-loading').classList.add('hidden');
    document.getElementById('main-app').classList.remove('hidden');
    document.getElementById('main-app').classList.add('flex');
    document.getElementById('user-display').textContent = user.email;
    setupLogoutButton(HOME_PATH);
    
    loadYears();
}, HOME_PATH);

function loadYears() {
    const q = query(collection(db, 'school_years'), orderBy("name", "desc"));
    
    onSnapshot(q, (snapshot) => {
        allYears = [];
        snapshot.forEach(docSnap => {
            allYears.push({ id: docSnap.id, ...docSnap.data() });
        });
        renderTable();
    });
}

function renderTable() {
    const tbody = document.getElementById('table-body');
    const emptyState = document.getElementById('empty-state');

    tbody.innerHTML = '';

    if (allYears.length === 0) {
        emptyState.classList.remove('hidden');
    } else {
        emptyState.classList.add('hidden');
        allYears.forEach((item, index) => {
            const tr = document.createElement('tr');
            tr.className = "border-b hover:bg-gray-50 transition";
            tr.innerHTML = `
                <td class="text-center py-3 text-gray-500">${index + 1}</td>
                <td class="px-5 py-3 font-semibold text-gray-800">${item.name}</td>
                <td class="text-center">
                    <button class="text-blue-600 mr-3 hover:text-blue-800" onclick="window.openModal('${item.id}')"><i class="fas fa-edit"></i></button>
                    <button class="text-red-600 hover:text-red-800" onclick="window.deleteItem('${item.id}')"><i class="fas fa-trash"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }
}

let editId = null;

window.openModal = (id = null) => {
    document.getElementById('form-year').reset();
    editId = null;
    document.getElementById('modal-title').textContent = "Thêm Năm Học";
    
    if (id) {
        editId = id;
        const item = allYears.find(x => x.id === id);
        if (item) {
            document.getElementById('year-name').value = item.name;
            document.getElementById('modal-title').textContent = "Cập Nhật Năm Học";
        }
    }
    document.getElementById('year-modal').classList.remove('hidden');
};

window.closeModal = () => document.getElementById('year-modal').classList.add('hidden');

document.getElementById('form-year').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = { name: document.getElementById('year-name').value.trim() };
    try {
        if (editId) await updateDoc(doc(collection(db, 'school_years'), editId), data);
        else await addDoc(collection(db, 'school_years'), data);
        closeModal();
    } catch (err) { alert("Lỗi: " + err.message); }
});

window.deleteItem = async (id) => { 
    if(confirm("Bạn có chắc chắn muốn xóa năm học này?")) await deleteDoc(doc(collection(db, 'school_years'), id));
};

window.seedDefaultYears = async () => {
    const defaults = ["2022-2023", "2023-2024", "2024-2025", "2025-2026", "2026-2027"];
    if(confirm("Tự động tạo các năm học từ 2022 đến 2027?")) {
        try {
            for(const y of defaults) await addDoc(collection(db, 'school_years'), { name: y });
            alert("Đã khởi tạo thành công!");
        } catch(err) { alert("Lỗi: " + err.message); }
    }
};