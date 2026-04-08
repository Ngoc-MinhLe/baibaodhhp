import { db } from './firebase-config.js';
import { collection, addDoc, doc, updateDoc, deleteDoc, query, onSnapshot, orderBy } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { requireAuth, setupLogoutButton, hasPermission } from './common.js';

let allCategories = [];
const HOME_PATH = '../';

requireAuth(async (user, userData) => {
    const canAccess = userData.role === 'super_admin' || hasPermission(userData.permissions, 'categories', 'access');
    if (!canAccess) {
        alert("Bạn không có quyền truy cập trang quản lý danh mục.");
        window.location.href = HOME_PATH;
        return;
    }

    document.getElementById('auth-loading').classList.add('hidden');
    document.getElementById('main-app').classList.remove('hidden');
    document.getElementById('main-app').classList.add('flex');
    document.getElementById('user-display').textContent = user.email;
    setupLogoutButton(HOME_PATH);
    
    loadCategories();
}, HOME_PATH);

function loadCategories() {
    const q = query(collection(db, 'categories'), orderBy("ten", "asc"));
    
    onSnapshot(q, (snapshot) => {
        allCategories = [];
        snapshot.forEach(docSnap => {
            allCategories.push({ id: docSnap.id, ...docSnap.data() });
        });
        renderTable();
    });
}

function renderTable() {
    const tbody = document.getElementById('table-body');
    const emptyState = document.getElementById('empty-state');

    tbody.innerHTML = '';

    if (allCategories.length === 0) {
        emptyState.classList.remove('hidden');
    } else {
        emptyState.classList.add('hidden');
        allCategories.forEach((item, index) => {
            const tr = document.createElement('tr');
            tr.className = "border-b hover:bg-gray-50 transition";
            tr.innerHTML = `
                <td class="text-center py-3 text-gray-500">${index + 1}</td>
                <td class="px-5 py-3 font-semibold text-green-900">${item.ten}</td>
                <td class="px-5 py-3 text-center text-lg text-gray-700">${item.soGio || 0}</td>
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
    document.getElementById('form-category').reset();
    editId = null;
    document.getElementById('modal-title').textContent = "Thêm Danh Mục";
    
    if (id) {
        editId = id;
        const item = allCategories.find(x => x.id === id);
        if (item) {
            document.getElementById('cat-name').value = item.ten;
            document.getElementById('cat-hours').value = item.soGio || 0;
            document.getElementById('modal-title').textContent = "Cập Nhật Danh Mục";
        }
    }
    document.getElementById('category-modal').classList.remove('hidden');
};

window.closeModal = () => document.getElementById('category-modal').classList.add('hidden');

document.getElementById('form-category').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
        ten: document.getElementById('cat-name').value.trim(),
        soGio: parseFloat(document.getElementById('cat-hours').value) || 0
    };
    
    try {
        if (editId) {
            await updateDoc(doc(collection(db, 'categories'), editId), data);
        } else {
            await addDoc(collection(db, 'categories'), data);
        }
        closeModal();
    } catch (err) { alert("Lỗi: " + err.message); }
});

window.deleteItem = async (id) => { 
    if(confirm("Bạn có chắc chắn muốn xóa danh mục này?")) {
        await deleteDoc(doc(collection(db, 'categories'), id));
    }
};

window.seedDefaultCategories = async () => {
    const defaultCategories = [
        { ten: "Scopus Q1", soGio: 0 },
        { ten: "Scopus Q2", soGio: 0 },
        { ten: "Scopus Q3", soGio: 0 },
        { ten: "Scopus Q4", soGio: 0 },
        { ten: "ISI/WoS", soGio: 0 },
        { ten: "ESCI", soGio: 0 },
        { ten: "Tạp chí Quốc tế khác", soGio: 0 },
        { ten: "Tạp chí Trong nước (0-1 điểm)", soGio: 0 },
        { ten: "Tạp chí Trong nước (khác)", soGio: 0 },
        { ten: "Hội nghị Quốc tế (Proceedings)", soGio: 0 },
        { ten: "Hội nghị Trong nước", soGio: 0 },
        { ten: "Sách chuyên khảo/Giáo trình", soGio: 0 },
        { ten: "Khác", soGio: 0 }
    ];

    if(confirm("Bạn có muốn tự động tạo lại các danh mục cũ không?")) {
        try {
            for(const cat of defaultCategories) {
                await addDoc(collection(db, 'categories'), cat);
            }
            alert("Đã khởi tạo thành công! Bạn có thể chỉnh sửa số giờ của từng danh mục ngay bây giờ.");
        } catch(err) {
            alert("Lỗi: " + err.message);
        }
    }
};