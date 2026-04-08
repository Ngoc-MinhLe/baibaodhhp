import { db } from './firebase-config.js';
import { collection, addDoc, doc, updateDoc, deleteDoc, query, onSnapshot, orderBy, where, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { requireAuth, setupLogoutButton, hasPermission } from './common.js';

let currentUser = null;
let currentUserData = null;
let userPerms = {}; 
let allArticles = []; // Lưu trữ toàn bộ bài báo để lọc ở Client
let categoriesData = [];
const HOME_PATH = '../'; 

// --- KHỞI TẠO ---
requireAuth(async (user, userData) => {
    const canAccess = userData.role === 'super_admin' || hasPermission(userData.permissions, 'articles', 'access');
    if (!canAccess) {
        alert("Bạn không có quyền truy cập.");
        window.location.href = HOME_PATH;
        return;
    }

    currentUser = user;
    currentUserData = userData;
    userPerms = userData.permissions || {};
    
    if (userData.role === 'super_admin') {
        userPerms.articles = { access: true, view_all: true, create: true, manage_others: true };
    }

    document.getElementById('auth-loading').classList.add('hidden');
    document.getElementById('main-app').classList.remove('hidden');
    document.getElementById('main-app').classList.add('flex');
    document.getElementById('user-display').textContent = user.email;
    setupLogoutButton(HOME_PATH);
    
    setupUI(); 
    loadCategories();
    loadYears();
    loadData();
}, HOME_PATH);

function setupUI() {
    document.getElementById('print-name').textContent = (currentUserData.authorName || currentUser.displayName || "").toUpperCase();
    document.getElementById('print-email').textContent = currentUser.email;
    document.getElementById('print-signer').textContent = currentUserData.authorName || currentUser.displayName;
    
    if (hasPermission(userPerms, 'articles', 'create')) {
        document.getElementById('btn-add').classList.remove('hidden');
    }
    document.querySelectorAll('.action-col').forEach(el => el.classList.remove('hidden'));
}

// --- TẢI DANH MỤC ---
async function loadCategories() {
    const q = query(collection(db, 'categories'), orderBy('ten', 'asc'));
    onSnapshot(q, (snapshot) => {
        categoriesData = [];
        let html = '';
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            categoriesData.push({ id: docSnap.id, ...data });
            html += `<option value="${data.ten}" data-hours="${data.soGio || 0}">${data.ten} (${data.soGio || 0} giờ)</option>`;
        });
        if(html) document.getElementById('danh-muc').innerHTML = html;
        else document.getElementById('danh-muc').innerHTML = '<option value="">Chưa có danh mục nào</option>';
    });
}

// --- TẢI NĂM HỌC ---
async function loadYears() {
    const q = query(collection(db, 'school_years'), orderBy('name', 'desc'));
    onSnapshot(q, (snapshot) => {
        let html = '';
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            html += `<option value="${data.name}">${data.name}</option>`;
        });
        if(html) document.getElementById('nam-hoc').innerHTML = html;
        else document.getElementById('nam-hoc').innerHTML = '<option value="">Chưa có năm học nào</option>';
    });
}

// --- TẢI DỮ LIỆU ---
function loadData() {
    const ref = collection(db, 'articles');
    let q;
    
    // Nếu có quyền xem tất cả -> Load hết
    if (hasPermission(userPerms, 'articles', 'view_all')) {
        q = query(ref, orderBy("createdAt", "desc"));
    } else {
        q = query(ref, where("createdBy", "==", currentUser.uid), orderBy("createdAt", "desc"));
    }
    
    onSnapshot(q, (snapshot) => {
        allArticles = [];
        snapshot.forEach(docSnap => {
            allArticles.push({ id: docSnap.id, ...docSnap.data() });
        });

        // 1. Cập nhật bộ lọc Tác giả (Nếu xem all)
        if (hasPermission(userPerms, 'articles', 'view_all')) {
            updateAuthorFilterOptions();
        } else {
            document.getElementById('filter-author').classList.add('hidden'); // Ẩn filter nếu chỉ xem bài mình
        }

        // Cập nhật bộ lọc Năm học
        updateYearFilterOptions();

        // 2. Vẽ bảng
        renderTable();
    });
}

// Cập nhật Dropdown chọn Tác giả
function updateAuthorFilterOptions() {
    const select = document.getElementById('filter-author');
    const currentVal = select.value;
    
    const allAuthors = allArticles.flatMap(item => Array.isArray(item.tacGia) ? item.tacGia : [item.tacGia]).map(a => a ? a.trim() : '').filter(a => a !== '');
    const uniqueAuthors = [...new Set(allAuthors)].sort();
    
    let html = '<option value="all">Tất cả tác giả</option>';
    uniqueAuthors.forEach(author => {
         html += `<option value="${author}">${author}</option>`;
    });
    
    select.innerHTML = html;
    if (uniqueAuthors.includes(currentVal) || currentVal === 'all') {
        select.value = currentVal;
    }
}

// Cập nhật Dropdown chọn Năm học
function updateYearFilterOptions() {
    const select = document.getElementById('filter-year');
    const currentVal = select.value;
    
    const uniqueYears = [...new Set(allArticles.map(item => item.namHoc))].filter(y => y).sort().reverse();
    
    let html = '<option value="all">Tất cả năm học</option>';
    uniqueYears.forEach(year => {
        html += `<option value="${year}">${year}</option>`;
    });
    
    select.innerHTML = html;
    if (uniqueYears.includes(currentVal) || currentVal === 'all') {
        select.value = currentVal;
    }
}

// --- VẼ BẢNG & LỌC DỮ LIỆU ---
function renderTable() {
    const tbody = document.getElementById('table-body');
    const emptyState = document.getElementById('empty-state');
    const searchTerm = document.getElementById('search-input').value.toLowerCase();
    const filterAuthor = document.getElementById('filter-author').value;
    const filterYear = document.getElementById('filter-year').value;

    tbody.innerHTML = '';
    let totalSum = 0;

    // Lọc dữ liệu
    const filteredData = allArticles.filter(item => {
        const matchesSearch = (item.tenBai || '').toLowerCase().includes(searchTerm) || 
                              (item.tacGia || '').toLowerCase().includes(searchTerm) ||
                              (item.ghiChu || '').toLowerCase().includes(searchTerm); // Cho phép tìm kiếm cả trong ghi chú
        
        const matchesAuthor = filterAuthor === 'all' || (Array.isArray(item.tacGia) 
                              ? item.tacGia.map(a => a.trim()).includes(filterAuthor) 
                              : (item.tacGia || '').trim() === filterAuthor);
        const matchesYear = filterYear === 'all' || item.namHoc === filterYear;

        return matchesSearch && matchesAuthor && matchesYear;
    });

    if (filteredData.length === 0) {
        emptyState.classList.remove('hidden');
    } else {
        emptyState.classList.add('hidden');
        filteredData.forEach((item, index) => {
            totalSum += getMyHoursValue(item);
            renderRow(item, index + 1, tbody);
        });
    }
    
    document.getElementById('total-hours-display').textContent = Number(totalSum.toFixed(2));
}

// Lấy giá trị số giờ để tính tổng
function getMyHoursValue(item) {
    const totalHours = item.soGioQuyDoi || 0;
    const authors = Array.isArray(item.tacGia) ? item.tacGia : [item.tacGia];
    const authorCount = authors.length || 1;
    
    // So sánh tên (không phân biệt hoa thường)
    const myName = (currentUserData.authorName || currentUser.displayName || "").trim().toLowerCase();
    const mainAuthorName = (item.tacGiaChinh || authors[0] || "").trim().toLowerCase();

    let isMain = mainAuthorName === myName;
    let isCoAuthor = !isMain && authors.some(a => a.trim().toLowerCase() === myName);

    if (isMain) {
        return (1/3 * totalHours) + ((2/3 * totalHours) / authorCount);
    } else if (isCoAuthor) {
        return (2/3 * totalHours) / authorCount;
    } else {
        return totalHours;
    }
}

// Tính toán số giờ hiển thị dựa trên Vai trò tác giả
function calculateMyHoursDisplay(item, returnType = 'html') {
    const totalHours = item.soGioQuyDoi || 0;
    const authors = Array.isArray(item.tacGia) ? item.tacGia : [item.tacGia];
    
    const myName = (currentUserData.authorName || currentUser.displayName || "").trim().toLowerCase();
    const mainAuthorName = (item.tacGiaChinh || authors[0] || "").trim().toLowerCase();

    let isMain = mainAuthorName === myName;
    let isCoAuthor = !isMain && authors.some(a => a.trim().toLowerCase() === myName);

    let myHours = getMyHoursValue(item);
    
    if (isMain) {
        if(returnType === 'print') return `${Number(myHours.toFixed(2))} (TG Chính)`;
        return `<span class="font-bold text-green-700">${Number(myHours.toFixed(2))}</span> <div class="text-[10px] text-gray-500">(TG chính)</div>`;
    } 
    else if (isCoAuthor) {
        if(returnType === 'print') return `${Number(myHours.toFixed(2))} (Đồng TG)`;
        return `<span class="font-bold text-blue-700">${Number(myHours.toFixed(2))}</span> <div class="text-[10px] text-gray-500">(Đồng TG)</div>`;
    } 
    else {
        if(returnType === 'print') return `${totalHours} (Tổng)`;
        return `<span class="font-bold text-gray-700">${totalHours}</span> <div class="text-[10px] text-red-400">(Tổng giờ)</div>`;
    }
}

function renderRow(item, index, tbody) {
    const tr = document.createElement('tr');
    tr.className = "border-b hover:bg-gray-50 transition";
    tr.dataset.id = item.id; 

    let canEdit = false;
    if (item.createdBy === currentUser.uid && hasPermission(userPerms, 'articles', 'create')) canEdit = true;
    if (hasPermission(userPerms, 'articles', 'manage_others')) canEdit = true;

    const actionBtns = canEdit ? `
        <button class="text-blue-600 mr-3 hover:text-blue-800" onclick="openModal('${item.id}')"><i class="fas fa-edit"></i></button>
        <button class="text-red-600 hover:text-red-800" onclick="deleteItem('${item.id}')"><i class="fas fa-trash"></i></button>
    ` : '<span class="text-gray-300">--</span>';

    // Hiển thị ghi chú nhỏ bên dưới tên bài báo (nếu có)
    const noteHtml = item.ghiChu ? `<div class="text-xs text-gray-500 mt-1"><i class="fas fa-info-circle mr-1"></i>${item.ghiChu}</div>` : '';
    
    // Xử lý hiển thị tác giả (In đậm và gạch chân tác giả chính)
    let mainAuthorName = item.tacGiaChinh || (Array.isArray(item.tacGia) ? item.tacGia[0] : item.tacGia);
    let tacGiaDisplay = Array.isArray(item.tacGia) ? item.tacGia.map(a => a === mainAuthorName ? `<span class="font-bold underline text-blue-800" title="Tác giả chính">${a}</span>` : a).join(', ') : item.tacGia;
    
    // Tính số giờ hiển thị
    const hoursDisplay = calculateMyHoursDisplay(item, 'html');

    tr.innerHTML = `
        <td class="text-center py-3">
            <input type="checkbox" class="select-row w-4 h-4 text-blue-600 rounded cursor-pointer" value="${item.id}">
        </td>
        <td class="text-center py-3 text-gray-500">${index}</td>
        <td class="px-4 py-3 font-semibold text-blue-900">
            ${item.tenBai}
            ${noteHtml}
        </td>
        <td class="px-4 py-3 italic text-gray-600">${tacGiaDisplay}</td>
        <td class="px-4 py-3 text-sm">${item.noiCongBo}</td>
        <td class="text-center font-medium text-gray-700">${item.namHoc || '---'}</td>
        <td class="text-center"><span class="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs truncate max-w-[150px] inline-block" title="${item.danhMuc}">${item.danhMuc}</span></td>
        <td class="text-center">${hoursDisplay}</td>
        <td class="text-center action-col">${actionBtns}</td>
    `;
    tbody.appendChild(tr);
}

// --- SỰ KIỆN LỌC ---
document.getElementById('search-input').addEventListener('keyup', renderTable);
document.getElementById('filter-author').addEventListener('change', renderTable);
document.getElementById('filter-year').addEventListener('change', renderTable);

document.getElementById('select-all').addEventListener('change', (e) => {
    document.querySelectorAll('.select-row').forEach(cb => cb.checked = e.target.checked);
});

// --- CHẾ ĐỘ IN ẤN THÔNG MINH ---
window.togglePreview = () => {
    const p = document.getElementById('print-area');
    const m = document.getElementById('main-app');
    const printBody = document.getElementById('print-table-body');
    
    if (p.classList.contains('preview-mode')) {
        p.classList.remove('preview-mode');
        m.classList.remove('hidden'); m.classList.add('flex');
    } else {
        const checkedIds = Array.from(document.querySelectorAll('.select-row:checked')).map(cb => cb.value);
        let itemsToPrint = [];
        if (checkedIds.length > 0) {
            itemsToPrint = allArticles.filter(item => checkedIds.includes(item.id));
        } else {
            const searchTerm = document.getElementById('search-input').value.toLowerCase();
            const filterAuthor = document.getElementById('filter-author').value;
            const filterYear = document.getElementById('filter-year').value;
            itemsToPrint = allArticles.filter(item => {
                const matchesSearch = (item.tenBai || '').toLowerCase().includes(searchTerm) || 
                                      (item.tacGia || '').toLowerCase().includes(searchTerm) ||
                                      (item.ghiChu || '').toLowerCase().includes(searchTerm);
                const matchesAuthor = filterAuthor === 'all' || (Array.isArray(item.tacGia) 
                                      ? item.tacGia.map(a => a.trim()).includes(filterAuthor) 
                                      : (item.tacGia || '').trim() === filterAuthor);
                const matchesYear = filterYear === 'all' || item.namHoc === filterYear;
                return matchesSearch && matchesAuthor && matchesYear;
            });
        }

        printBody.innerHTML = '';
        if (itemsToPrint.length === 0) {
            alert("Không có bài báo nào để in!");
            return;
        }

        let index = 1;
        itemsToPrint.forEach(item => {
            // Hiển thị ghi chú trong bảng in (nếu có)
            const notePrint = item.ghiChu ? `<br><span style="font-style: italic; font-size: 0.9em; color: #555;">(Ghi chú: ${item.ghiChu})</span>` : '';
            const mainA = item.tacGiaChinh || (Array.isArray(item.tacGia) ? item.tacGia[0] : item.tacGia);
            const tgPrint = Array.isArray(item.tacGia) ? item.tacGia.map(a => a === mainA ? `<u><b>${a}</b></u>` : a).join(', ') : item.tacGia;
            const printHours = calculateMyHoursDisplay(item, 'print');

            printBody.insertAdjacentHTML('beforeend', `
                <tr>
                    <td style="text-align:center">${index++}</td>
                    <td>${item.tenBai}</td>
                    <td>${tgPrint}</td>
                    <td>${item.noiCongBo}</td>
                    <td style="text-align:center">${item.namHoc || ''}</td>
                    <td style="text-align:center">${item.danhMuc}</td>
                    <td style="text-align:center">${printHours}</td>
                    <td>${item.ghiChu || ''}</td>
                </tr>
            `);
        });
        
        while(index <= 5) {
             printBody.insertAdjacentHTML('beforeend', '<tr><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>');
             index++;
        }

        p.classList.add('preview-mode');
        m.classList.add('hidden'); m.classList.remove('flex');
        window.scrollTo(0,0);
    }
};

// --- CRUD ---
window.addAuthorField = (val = '', isMain = false, isFirst = false) => {
    const container = document.getElementById('authors-container');
    const div = document.createElement('div');
    div.className = `flex items-center gap-2 author-row ${isFirst ? '' : 'mt-2'}`;
    
    const btn = isFirst 
        ? `<button type="button" onclick="window.addAuthorField()" class="bg-blue-100 text-blue-600 px-3 py-2 rounded hover:bg-blue-200" title="Thêm tác giả"><i class="fas fa-plus"></i></button>`
        : `<button type="button" onclick="this.parentElement.remove()" class="bg-red-100 text-red-600 px-3 py-2 rounded hover:bg-red-200" title="Xóa tác giả này"><i class="fas fa-minus"></i></button>`;

    div.innerHTML = `
        <input type="radio" name="main-author" class="main-author-radio w-4 h-4 text-blue-600 focus:ring-blue-500 cursor-pointer flex-shrink-0" ${isMain ? 'checked' : ''} title="Đánh dấu là tác giả chính">
        <input type="text" class="author-input w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Tên tác giả" value="${val}" required>
        ${btn}
    `;
    container.appendChild(div);
};

let editId = null;
window.openModal = (id = null) => {
    document.getElementById('form-article').reset();
    editId = null;
    document.getElementById('modal-title').textContent = "Thêm Mới";
    
    // Reset authors container
    document.getElementById('authors-container').innerHTML = '';

    if (id) {
        editId = id;
        const item = allArticles.find(x => x.id === id);
        if (item) {
            document.getElementById('ten-bai').value = item.tenBai;
            document.getElementById('noi-cong-bo').value = item.noiCongBo;
            
            // Gán giá trị, nếu không tồn tại do data cũ thì vẫn cố gắng select
            const yearSelect = document.getElementById('nam-hoc');
            if (item.namHoc) yearSelect.value = item.namHoc;
            
            document.getElementById('danh-muc').value = item.danhMuc;
            // Load ghi chú lên form
            document.getElementById('ghi-chu').value = item.ghiChu || '';
            
            // Load Authors
            let authors = Array.isArray(item.tacGia) ? item.tacGia : [item.tacGia];
            if(authors.length === 0) authors = [''];
            let mainAuthor = item.tacGiaChinh || authors[0];
            
            authors.forEach((a, index) => {
                window.addAuthorField(a, a === mainAuthor, index === 0);
            });
            
            document.getElementById('modal-title').textContent = "Cập Nhật";
        }
    } else {
        window.addAuthorField('', true, true);
    }
    document.getElementById('article-modal').classList.remove('hidden');
};
window.closeModal = () => document.getElementById('article-modal').classList.add('hidden');

document.getElementById('form-article').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const authorRows = document.querySelectorAll('.author-row');
    let tacGiaArray = [];
    let tacGiaChinh = "";

    authorRows.forEach(row => {
        const input = row.querySelector('.author-input').value.trim();
        const isMain = row.querySelector('.main-author-radio').checked;
        if (input !== '') {
            tacGiaArray.push(input);
            if (isMain) tacGiaChinh = input;
        }
    });
    
    // Nếu vì lý do nào đó không có ai được chọn, mặc định lấy người đầu tiên
    if (!tacGiaChinh && tacGiaArray.length > 0) tacGiaChinh = tacGiaArray[0];
    
    const danhMucSelect = document.getElementById('danh-muc');
    const selectedOption = danhMucSelect.options[danhMucSelect.selectedIndex];

    const data = {
        tenBai: document.getElementById('ten-bai').value,
        tacGia: tacGiaArray,
        tacGiaChinh: tacGiaChinh,
        noiCongBo: document.getElementById('noi-cong-bo').value,
        namHoc: document.getElementById('nam-hoc').value,
        danhMuc: selectedOption ? selectedOption.value : '',
        soGioQuyDoi: selectedOption ? parseFloat(selectedOption.dataset.hours) : 0,
        // Lưu trường ghi chú mới
        ghiChu: document.getElementById('ghi-chu').value,
        updatedAt: Date.now(),
        createdBy: currentUser.uid, 
        createdEmail: currentUser.email 
    };
    try {
        if (editId) {
            delete data.createdBy; delete data.createdEmail;
            await updateDoc(doc(collection(db, 'articles'), editId), data);
        } else {
            data.createdAt = Date.now();
            await addDoc(collection(db, 'articles'), data);
        }
        closeModal();
    } catch (err) { alert(err.message); }
});

window.deleteItem = async (id) => { if(confirm("Xóa bài này?")) await deleteDoc(doc(collection(db, 'articles'), id)); };

// --- QUẢN LÝ HỒ SƠ TÁC GIẢ ---
window.openProfileModal = () => {
    document.getElementById('profile-author-name').value = currentUserData.authorName || currentUser.displayName || "";
    document.getElementById('profile-modal').classList.remove('hidden');
};
window.closeProfileModal = () => document.getElementById('profile-modal').classList.add('hidden');

document.getElementById('form-profile').addEventListener('submit', async (e) => {
    e.preventDefault();
    const newName = document.getElementById('profile-author-name').value.trim();
    try {
        await updateDoc(doc(db, 'users', currentUser.uid), { authorName: newName });
        currentUserData.authorName = newName; // Cập nhật lại UI tạm thời
        alert("Cập nhật tên tác giả thành công!");
        window.closeProfileModal();
        renderTable(); // Tự động load lại bảng để tính lại số giờ
    } catch (err) { alert("Lỗi: " + err.message); }
});