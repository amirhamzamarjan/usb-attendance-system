/* ============================================================
   US BENGOL - Employee Attendance & Payroll Management System
   Main Application JavaScript
   ============================================================ */

'use strict';

/* ==================== DATABASE / STORAGE LAYER ==================== */
const DB = {
    _get(key) {
        try {
            const data = localStorage.getItem('usbengol_' + key);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            console.error('Storage read error:', e);
            return null;
        }
    },

    _set(key, value) {
        try {
            localStorage.setItem('usbengol_' + key, JSON.stringify(value));
            return true;
        } catch (e) {
            console.error('Storage write error:', e);
            UI.toast('স্টোরেজ ত্রুটি! ডেটা সংরক্ষণ করা যায়নি।', 'error');
            return false;
        }
    },

    /* Workers */
    getWorkers() { return this._get('workers') || []; },
    saveWorkers(workers) { return this._set('workers', workers); },
    getWorker(id) { return this.getWorkers().find(w => w.id === id); },
    addWorker(worker) {
        const workers = this.getWorkers();
        worker.id = this.generateId();
        worker.createdAt = new Date().toISOString();
        workers.push(worker);
        this.saveWorkers(workers);
        return worker;
    },
    updateWorker(id, data) {
        const workers = this.getWorkers();
        const idx = workers.findIndex(w => w.id === id);
        if (idx !== -1) {
            workers[idx] = { ...workers[idx], ...data, updatedAt: new Date().toISOString() };
            this.saveWorkers(workers);
            return workers[idx];
        }
        return null;
    },
    deleteWorker(id) {
        const workers = this.getWorkers().filter(w => w.id !== id);
        this.saveWorkers(workers);
        // Also remove attendance and payments for this worker
        const attendance = this.getAttendance().filter(a => a.workerId !== id);
        this._set('attendance', attendance);
        const payments = this.getPayments().filter(p => p.workerId !== id);
        this._set('payments', payments);
    },

    /* Attendance */
    getAttendance() { return this._get('attendance') || []; },
    saveAttendance(records) { return this._set('attendance', records); },
    getAttendanceByDate(date) {
        return this.getAttendance().filter(a => a.date === date);
    },
    getAttendanceByWorker(workerId) {
        return this.getAttendance().filter(a => a.workerId === workerId);
    },
    getAttendanceByWorkerAndMonth(workerId, year, month) {
        const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
        return this.getAttendance().filter(a => a.workerId === workerId && a.date.startsWith(prefix));
    },
    upsertAttendance(record) {
        const records = this.getAttendance();
        const idx = records.findIndex(a => a.workerId === record.workerId && a.date === record.date);
        if (idx !== -1) {
            records[idx] = { ...records[idx], ...record };
        } else {
            record.id = this.generateId();
            records.push(record);
        }
        this._set('attendance', records);
    },

    /* Payments */
    getPayments() { return this._get('payments') || []; },
    savePayments(payments) { return this._set('payments', payments); },
    getPaymentsByWorker(workerId) {
        return this.getPayments().filter(p => p.workerId === workerId);
    },
    addPayment(payment) {
        const payments = this.getPayments();
        payment.id = this.generateId();
        payment.createdAt = new Date().toISOString();
        payments.push(payment);
        this.savePayments(payments);
        return payment;
    },
    deletePayment(id) {
        const payments = this.getPayments().filter(p => p.id !== id);
        this.savePayments(payments);
    },

    /* Documents (Quotations, Invoices, Pads) */
    getDocuments() { return this._get('documents') || []; },
    saveDocuments(documents) { return this._set('documents', documents); },
    getDocument(id) { return this.getDocuments().find(d => d.id === id); },
    addDocument(doc) {
        const docs = this.getDocuments();
        doc.id = this.generateId();
        doc.createdAt = new Date().toISOString();
        docs.push(doc);
        this.saveDocuments(docs);
        return doc;
    },
    updateDocument(id, data) {
        const docs = this.getDocuments();
        const idx = docs.findIndex(d => d.id === id);
        if (idx !== -1) {
            docs[idx] = { ...docs[idx], ...data, updatedAt: new Date().toISOString() };
            this.saveDocuments(docs);
            return docs[idx];
        }
        return null;
    },
    deleteDocument(id) {
        const docs = this.getDocuments().filter(d => d.id !== id);
        this.saveDocuments(docs);
    },

    /* Settings */
    getSettings() { return this._get('settings') || { darkMode: false }; },
    saveSetting(key, value) {
        const settings = this.getSettings();
        settings[key] = value;
        this._set('settings', settings);
    },

    /* Utilities */
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    },

    /* Backup / Restore */
    exportAll() {
        return {
            version: '1.0.0',
            exportDate: new Date().toISOString(),
            workers: this.getWorkers(),
            attendance: this.getAttendance(),
            payments: this.getPayments(),
            documents: this.getDocuments(),
            settings: this.getSettings()
        };
    },
    importAll(data) {
        if (data.workers) this.saveWorkers(data.workers);
        if (data.attendance) this._set('attendance', data.attendance);
        if (data.payments) this.savePayments(data.payments);
        if (data.documents) this.saveDocuments(data.documents);
        if (data.settings) this._set('settings', data.settings);
    },
    resetAttendance() { this._set('attendance', []); },
    resetPayments() { this._set('payments', []); },
    resetAll() {
        localStorage.removeItem('usbengol_workers');
        localStorage.removeItem('usbengol_attendance');
        localStorage.removeItem('usbengol_payments');
        localStorage.removeItem('usbengol_settings');
    },

    /* Storage Usage */
    getStorageUsage() {
        let total = 0;
        for (let key in localStorage) {
            if (localStorage.hasOwnProperty(key) && key.startsWith('usbengol_')) {
                total += localStorage.getItem(key).length * 2; // UTF-16
            }
        }
        return total;
    }
};


/* ==================== UTILITIES ==================== */
const Utils = {
    /* Bangla month names */
    banglaMonths: ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'],

    banglaDayNames: ['রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহ', 'শুক্র', 'শনি'],

    /* Convert English numbers to Bangla */
    toBanglaNum(num) {
        if (num === null || num === undefined) return '';
        const banglaDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
        return String(num).replace(/[0-9]/g, d => banglaDigits[d]);
    },

    /* Format currency */
    formatCurrency(amount) {
        const num = parseFloat(amount) || 0;
        return Utils.toBanglaNum(num.toLocaleString('en-IN')) + ' ৳';
    },

    formatCurrencyShort(amount) {
        const num = parseFloat(amount) || 0;
        if (num >= 100000) {
            return Utils.toBanglaNum((num / 100000).toFixed(1)) + ' লক্ষ';
        }
        return Utils.toBanglaNum(num.toLocaleString('en-IN')) + ' ৳';
    },

    /* Format date in Bangla */
    formatDateBangla(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return `${Utils.toBanglaNum(d.getDate())} ${Utils.banglaMonths[d.getMonth()]} ${Utils.toBanglaNum(d.getFullYear())}`;
    },

    formatDateShort(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
    },

    /* Get today's date as YYYY-MM-DD */
    getToday() {
        return new Date().toISOString().split('T')[0];
    },

    /* Get current month year */
    getCurrentMonth() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    },

    /* Parse date */
    parseDate(dateStr) {
        const [y, m, d] = dateStr.split('-').map(Number);
        return new Date(y, m - 1, d);
    },

    /* Get days in month */
    getDaysInMonth(year, month) {
        return new Date(year, month + 1, 0).getDate();
    },

    /* Get first day of month (0=Sun) */
    getFirstDayOfMonth(year, month) {
        return new Date(year, month, 1).getDay();
    },

    /* Calculate time difference in hours */
    timeDiffHours(timeIn, timeOut) {
        if (!timeIn || !timeOut) return 0;
        const [h1, m1] = timeIn.split(':').map(Number);
        const [h2, m2] = timeOut.split(':').map(Number);
        return Math.max(0, ((h2 * 60 + m2) - (h1 * 60 + m1)) / 60);
    },

    /* Get worker initials */
    getInitials(name) {
        if (!name) return '?';
        const parts = name.trim().split(/\s+/);
        if (parts.length >= 2) {
            return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
        }
        return parts[0].substring(0, 2).toUpperCase();
    },

    /* Status labels in Bangla */
    statusLabel(status) {
        const labels = {
            'present': 'উপস্থিত',
            'halfday': 'আধা দিন',
            'absent': 'অনুপস্থিত',
            'paid-leave': 'পেইড লিভ',
            'unpaid-leave': 'আনপেইড লিভ'
        };
        return labels[status] || status;
    },

    statusClass(status) {
        const classes = {
            'present': 'present',
            'halfday': 'halfday',
            'absent': 'absent',
            'paid-leave': 'paid-leave',
            'unpaid-leave': 'unpaid-leave'
        };
        return classes[status] || '';
    },

    /* Relative time */
    timeAgo(dateStr) {
        const now = new Date();
        const date = new Date(dateStr);
        const diff = Math.floor((now - date) / 1000);
        if (diff < 60) return 'এইমাত্র';
        if (diff < 3600) return Utils.toBanglaNum(Math.floor(diff / 60)) + ' মিনিট আগে';
        if (diff < 86400) return Utils.toBanglaNum(Math.floor(diff / 3600)) + ' ঘণ্টা আগে';
        if (diff < 2592000) return Utils.toBanglaNum(Math.floor(diff / 86400)) + ' দিন আগে';
        return Utils.formatDateShort(dateStr);
    }
};


/* ==================== UI HELPERS ==================== */
const UI = {
    /* Show toast notification */
    toast(message, type = 'info', duration = 3000) {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        const icons = {
            success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
            error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
            warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
            info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
        };

        toast.innerHTML = `<span class="toast-icon">${icons[type] || icons.info}</span><span>${message}</span>`;
        container.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('removing');
            setTimeout(() => toast.remove(), 300);
        }, duration);
    },

    /* Open modal */
    openModal(id) {
        const modal = document.getElementById(id);
        if (modal) {
            modal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
        }
    },

    /* Close modal */
    closeModal(id) {
        const modal = document.getElementById(id);
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = '';
        }
    },

    /* Confirmation dialog */
    confirm(title, message, confirmText = 'মুছুন', confirmClass = 'btn-danger') {
        return new Promise((resolve) => {
            document.getElementById('confirm-title').textContent = title;
            document.getElementById('confirm-message').textContent = message;
            const okBtn = document.getElementById('confirm-ok');
            okBtn.textContent = confirmText;
            okBtn.className = `btn ${confirmClass}`;

            UI.openModal('modal-confirm');

            const cleanup = (result) => {
                UI.closeModal('modal-confirm');
                document.getElementById('confirm-ok').removeEventListener('click', onOk);
                document.getElementById('confirm-cancel').removeEventListener('click', onCancel);
                resolve(result);
            };

            const onOk = () => cleanup(true);
            const onCancel = () => cleanup(false);

            document.getElementById('confirm-ok').addEventListener('click', onOk);
            document.getElementById('confirm-cancel').addEventListener('click', onCancel);
        });
    },

    /* Format file size */
    formatSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }
};


/* ==================== WORKERS MODULE ==================== */
const Workers = {
    /* Get all workers with optional filters */
    getAll(filter = 'all', search = '') {
        let workers = DB.getWorkers();

        // Apply filter
        switch (filter) {
            case 'daily': workers = workers.filter(w => w.employmentType === 'daily'); break;
            case 'monthly': workers = workers.filter(w => w.employmentType === 'monthly'); break;
            case 'active': workers = workers.filter(w => w.isActive); break;
            case 'inactive': workers = workers.filter(w => !w.isActive); break;
        }

        // Apply search
        if (search.trim()) {
            const q = search.toLowerCase().trim();
            workers = workers.filter(w =>
                w.name.toLowerCase().includes(q) ||
                w.mobile.includes(q) ||
                w.designation.toLowerCase().includes(q) ||
                w.workerId.toLowerCase().includes(q)
            );
        }

        return workers.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },

    /* Get active workers only */
    getActive() {
        return DB.getWorkers().filter(w => w.isActive);
    },

    /* Render workers list */
    render(filter = 'all', search = '') {
        const workers = this.getAll(filter, search);
        const list = document.getElementById('workers-list');
        const empty = document.getElementById('no-workers');
        const badge = document.getElementById('worker-count-badge');

        badge.textContent = Utils.toBanglaNum(DB.getWorkers().length);

        if (workers.length === 0) {
            list.innerHTML = '';
            empty.style.display = 'block';
            return;
        }

        empty.style.display = 'none';

        list.innerHTML = workers.map(w => `
            <div class="worker-card ${w.isActive ? '' : 'inactive'}" onclick="Workers.showDetail('${w.id}')">
                <div class="worker-avatar">
                    ${w.photo ? `<img src="${w.photo}" alt="${w.name}">` : Utils.getInitials(w.name)}
                </div>
                <div class="worker-info">
                    <div class="worker-name">${w.name}</div>
                    <div class="worker-meta">
                        <span>${w.designation}</span>
                        <span class="dot"></span>
                        <span>${w.mobile}</span>
                    </div>
                    <div class="worker-meta" style="margin-top:2px;">
                        <span class="worker-type-badge ${w.employmentType}">${w.employmentType === 'daily' ? 'দৈনিক' : 'মাসিক'}</span>
                        <span style="font-size:11px; color:var(--text-secondary);">${w.employmentType === 'daily' ? Utils.formatCurrency(w.dailyWage) + '/দিন' : Utils.formatCurrency(w.monthlySalary) + '/মাস'}</span>
                    </div>
                </div>
                <div style="display:flex; flex-direction:column; align-items:center; gap:4px;">
                    <span class="worker-status-dot ${w.isActive ? 'active' : 'inactive'}"></span>
                    <div class="worker-card-actions" onclick="event.stopPropagation()">
                        <button class="icon-btn-sm" onclick="Workers.edit('${w.id}')" title="সম্পাদনা">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    },

    /* Open add worker form */
    openAddForm() {
        document.getElementById('worker-form-title').textContent = 'নতুন কর্মচারী যোগ করুন';
        document.getElementById('form-worker').reset();
        document.getElementById('worker-edit-id').value = '';
        document.getElementById('worker-submit-btn').textContent = 'সংরক্ষণ করুন';
        document.getElementById('daily-wage-group').style.display = 'none';
        document.getElementById('monthly-salary-group').style.display = 'none';
        document.getElementById('worker-joining-date').value = Utils.getToday();
        document.getElementById('photo-preview').innerHTML = `
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            <span>ছবি আপলোড করুন</span>`;
        UI.openModal('modal-worker');
    },

    /* Edit worker */
    edit(id) {
        const w = DB.getWorker(id);
        if (!w) return;

        document.getElementById('worker-form-title').textContent = 'কর্মচারী সম্পাদনা';
        document.getElementById('worker-edit-id').value = w.id;
        document.getElementById('worker-name').value = w.name;
        document.getElementById('worker-mobile').value = w.mobile;
        document.getElementById('worker-designation').value = w.designation;
        document.getElementById('worker-joining-date').value = w.joiningDate;
        document.getElementById('worker-type').value = w.employmentType;
        document.getElementById('worker-daily-wage').value = w.dailyWage || '';
        document.getElementById('worker-monthly-salary').value = w.monthlySalary || '';
        document.getElementById('worker-overtime-rate').value = w.overtimeRate || '';
        document.getElementById('worker-status').value = w.isActive ? 'active' : 'inactive';
        document.getElementById('worker-submit-btn').textContent = 'আপডেট করুন';

        // Show/hide wage fields
        Workers._toggleWageFields(w.employmentType);

        // Show photo if exists
        if (w.photo) {
            document.getElementById('photo-preview').innerHTML = `<img src="${w.photo}" alt="${w.name}"><span>ছবি পরিবর্তন করুন</span>`;
        }

        UI.openModal('modal-worker');
    },

    /* Save worker (add or update) */
    save(e) {
        e.preventDefault();
        const editId = document.getElementById('worker-edit-id').value;
        const type = document.getElementById('worker-type').value;

        const data = {
            name: document.getElementById('worker-name').value.trim(),
            mobile: document.getElementById('worker-mobile').value.trim(),
            designation: document.getElementById('worker-designation').value.trim(),
            joiningDate: document.getElementById('worker-joining-date').value,
            employmentType: type,
            dailyWage: type === 'daily' ? parseFloat(document.getElementById('worker-daily-wage').value) || 0 : 0,
            monthlySalary: type === 'monthly' ? parseFloat(document.getElementById('worker-monthly-salary').value) || 0 : 0,
            overtimeRate: parseFloat(document.getElementById('worker-overtime-rate').value) || 0,
            isActive: document.getElementById('worker-status').value === 'active'
        };

        // Validation
        if (!data.name || !data.mobile || !data.designation || !data.joiningDate || !type) {
            UI.toast('সকল প্রয়োজনীয় তথ্য পূরণ করুন!', 'warning');
            return;
        }

        if (type === 'daily' && data.dailyWage <= 0) {
            UI.toast('দৈনিক বেতন উল্লেখ করুন!', 'warning');
            return;
        }

        if (type === 'monthly' && data.monthlySalary <= 0) {
            UI.toast('মাসিক বেতন উল্লেখ করুন!', 'warning');
            return;
        }

        // Generate worker ID
        if (!editId) {
            const workerCount = DB.getWorkers().length;
            data.workerId = 'UB-' + String(workerCount + 1).padStart(4, '0');
        }

        // Handle photo
        const photoInput = document.getElementById('worker-photo');
        if (photoInput.files && photoInput.files[0]) {
            const reader = new FileReader();
            reader.onload = function (ev) {
                data.photo = ev.target.result;
                if (editId) {
                    DB.updateWorker(editId, data);
                    UI.toast('কর্মচারী আপডেট হয়েছে!', 'success');
                } else {
                    DB.addWorker(data);
                    UI.toast('নতুন কর্মচারী যোগ হয়েছে!', 'success');
                }
                UI.closeModal('modal-worker');
                App.refreshCurrentPage();
            };
            reader.readAsDataURL(photoInput.files[0]);
        } else {
            if (editId) {
                // Keep existing photo
                const existing = DB.getWorker(editId);
                if (existing && existing.photo && !data.photo) {
                    data.photo = existing.photo;
                }
                DB.updateWorker(editId, data);
                UI.toast('কর্মচারী আপডেট হয়েছে!', 'success');
            } else {
                DB.addWorker(data);
                UI.toast('নতুন কর্মচারী যোগ হয়েছে!', 'success');
            }
            UI.closeModal('modal-worker');
            App.refreshCurrentPage();
        }
    },

    /* Show worker detail */
    showDetail(id) {
        const w = DB.getWorker(id);
        if (!w) return;

        const payments = DB.getPaymentsByWorker(id);
        const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
        const earnings = Salary.calculateWorkerEarnings(id);
        const due = earnings - totalPaid;

        const content = document.getElementById('worker-detail-content');
        content.innerHTML = `
            <div class="worker-detail-header">
                <div class="worker-detail-avatar">
                    ${w.photo ? `<img src="${w.photo}" alt="${w.name}">` : Utils.getInitials(w.name)}
                </div>
                <div class="worker-detail-info">
                    <h3>${w.name}</h3>
                    <p>${w.workerId} &bull; ${w.designation}</p>
                    <p style="margin-top:4px;">
                        <span class="worker-type-badge ${w.employmentType}">${w.employmentType === 'daily' ? 'দৈনিক' : 'মাসিক'}</span>
                        <span class="worker-status-dot ${w.isActive ? 'active' : 'inactive'}" style="display:inline-block; vertical-align:middle; margin-left:6px;"></span>
                        <span style="font-size:12px; color:var(--text-secondary);">${w.isActive ? 'সক্রিয়' : 'নিষ্ক্রিয়'}</span>
                    </p>
                </div>
            </div>
            <div class="detail-grid">
                <div class="detail-item">
                    <div class="detail-label">মোবাইল</div>
                    <div class="detail-value">${w.mobile}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">যোগদানের তারিখ</div>
                    <div class="detail-value">${Utils.formatDateBangla(w.joiningDate)}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">${w.employmentType === 'daily' ? 'দৈনিক বেতন' : 'মাসিক বেতন'}</div>
                    <div class="detail-value">${w.employmentType === 'daily' ? Utils.formatCurrency(w.dailyWage) : Utils.formatCurrency(w.monthlySalary)}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">ওভারটাইম রেট</div>
                    <div class="detail-value">${Utils.formatCurrency(w.overtimeRate)}/ঘণ্টা</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">মোট আয়</div>
                    <div class="detail-value" style="color:var(--success);">${Utils.formatCurrency(earnings)}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">মোট পেমেন্ট</div>
                    <div class="detail-value" style="color:var(--primary);">${Utils.formatCurrency(totalPaid)}</div>
                </div>
                <div class="detail-item" style="grid-column: 1 / -1;">
                    <div class="detail-label">বকেয়া</div>
                    <div class="detail-value" style="color:${due > 0 ? 'var(--danger)' : 'var(--success)'}; font-size:18px;">${Utils.formatCurrency(due)}</div>
                </div>
            </div>
            <div style="display:flex; gap:8px; margin-bottom:12px;">
                <button class="btn btn-outline" onclick="UI.closeModal('modal-worker-detail'); Calendar.show('${w.id}')" style="flex:1;">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    ক্যালেন্ডার
                </button>
                <button class="btn btn-outline" onclick="UI.closeModal('modal-worker-detail'); Workers.openAddForm(); document.getElementById('worker-edit-id').value='${w.id}'; Workers.edit('${w.id}')" style="flex:1;">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    সম্পাদনা
                </button>
            </div>
            <div class="detail-actions">
                <button class="btn btn-danger" onclick="Workers.deleteConfirm('${w.id}')">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    মুছুন
                </button>
                <button class="btn btn-primary" onclick="UI.closeModal('modal-worker-detail'); Payments.openForm('${w.id}')">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                    পেমেন্ট দিন
                </button>
            </div>
        `;

        UI.openModal('modal-worker-detail');
    },

    /* Delete worker confirmation */
    async deleteConfirm(id) {
        const w = DB.getWorker(id);
        if (!w) return;

        const ok = await UI.confirm(
            'কর্মচারী মুছুন',
            `"${w.name}" কে মুছে ফেলতে চান? এই কর্মচারীর সকল হাজিরা ও পেমেন্ট রেকর্ডও মুছে ফেলা হবে।`,
            'মুছুন',
            'btn-danger'
        );

        if (ok) {
            DB.deleteWorker(id);
            UI.closeModal('modal-worker-detail');
            UI.toast('কর্মচারী মুছে ফেলা হয়েছে!', 'success');
            App.refreshCurrentPage();
        }
    },

    /* Toggle wage fields based on type */
    _toggleWageFields(type) {
        document.getElementById('daily-wage-group').style.display = type === 'daily' ? 'block' : 'none';
        document.getElementById('monthly-salary-group').style.display = type === 'monthly' ? 'block' : 'none';
    }
};


/* ==================== ATTENDANCE MODULE ==================== */
const Attendance = {
    currentDate: Utils.getToday(),

    /* Initialize */
    init() {
        this.currentDate = Utils.getToday();
        document.getElementById('attendance-date').value = this.currentDate;
    },

    /* Render attendance list for current date */
    render() {
        const date = this.currentDate;
        const workers = Workers.getActive();
        const existingRecords = DB.getAttendanceByDate(date);

        const list = document.getElementById('attendance-list');
        const empty = document.getElementById('no-attendance-workers');
        const summaryBar = document.getElementById('attendance-summary-bar');

        if (workers.length === 0) {
            list.innerHTML = '';
            empty.style.display = 'block';
            summaryBar.innerHTML = '';
            return;
        }

        empty.style.display = 'none';

        // Calculate summary
        let present = 0, halfday = 0, absent = 0, leave = 0;
        existingRecords.forEach(r => {
            switch (r.status) {
                case 'present': present++; break;
                case 'halfday': halfday++; break;
                case 'absent': absent++; break;
                case 'paid-leave': case 'unpaid-leave': leave++; break;
            }
        });

        // Unmarked workers count as absent in summary
        const marked = existingRecords.length;
        const unmarked = workers.length - marked;
        absent += unmarked;

        summaryBar.innerHTML = `
            <div class="att-bar-item">
                <div class="num" style="color:var(--text-primary);">${Utils.toBanglaNum(workers.length)}</div>
                <div class="txt">মোট</div>
            </div>
            <div class="att-bar-item">
                <div class="num" style="color:var(--success);">${Utils.toBanglaNum(present)}</div>
                <div class="txt">উপস্থিত</div>
            </div>
            <div class="att-bar-item">
                <div class="num" style="color:var(--warning);">${Utils.toBanglaNum(halfday)}</div>
                <div class="txt">আধা দিন</div>
            </div>
            <div class="att-bar-item">
                <div class="num" style="color:var(--danger);">${Utils.toBanglaNum(absent)}</div>
                <div class="txt">অনুপস্থিত</div>
            </div>
            <div class="att-bar-item">
                <div class="num" style="color:var(--info);">${Utils.toBanglaNum(leave)}</div>
                <div class="txt">লিভ</div>
            </div>
        `;

        // Render worker attendance cards
        list.innerHTML = workers.map(w => {
            const record = existingRecords.find(r => r.workerId === w.id) || {};
            const status = record.status || '';
            const checkIn = record.checkIn || '';
            const checkOut = record.checkOut || '';
            const totalHours = record.totalHours || 0;
            const overtimeHours = record.overtimeHours || 0;

            return `
                <div class="attendance-card" data-worker-id="${w.id}">
                    <div class="worker-avatar" style="width:42px;height:42px;font-size:16px;">
                        ${w.photo ? `<img src="${w.photo}" alt="${w.name}">` : Utils.getInitials(w.name)}
                    </div>
                    <div class="att-info">
                        <div class="att-name">${w.name}</div>
                        <div class="att-details">${w.designation} &bull; ${w.workerId}</div>
                        ${status ? `
                            <div>
                                ${totalHours > 0 ? `<span class="att-hours-badge">⏱ ${Utils.toBanglaNum(totalHours.toFixed(1))} ঘণ্টা</span>` : ''}
                                ${overtimeHours > 0 ? `<span class="att-overtime-badge">+${Utils.toBanglaNum(overtimeHours.toFixed(1))} ঘণ্টা OT</span>` : ''}
                            </div>
                        ` : ''}
                    </div>
                    <div class="att-status">
                        <select class="att-status-select ${Utils.statusClass(status)}"
                                onchange="Attendance.updateStatus('${w.id}', this.value, this)">
                            <option value="" ${!status ? 'selected' : ''}>নির্বাচন</option>
                            <option value="present" ${status === 'present' ? 'selected' : ''}>উপস্থিত</option>
                            <option value="halfday" ${status === 'halfday' ? 'selected' : ''}>আধা দিন</option>
                            <option value="absent" ${status === 'absent' ? 'selected' : ''}>অনুপস্থিত</option>
                            <option value="paid-leave" ${status === 'paid-leave' ? 'selected' : ''}>পেইড লিভ</option>
                            <option value="unpaid-leave" ${status === 'unpaid-leave' ? 'selected' : ''}>আনপেইড লিভ</option>
                        </select>
                        ${status && status !== 'absent' && status !== 'paid-leave' && status !== 'unpaid-leave' ? `
                            <div class="att-time-row">
                                <input type="time" class="att-time-input" value="${checkIn}" placeholder="ইন"
                                       onchange="Attendance.updateTime('${w.id}', 'checkIn', this.value)">
                                <input type="time" class="att-time-input" value="${checkOut}" placeholder="আউট"
                                       onchange="Attendance.updateTime('${w.id}', 'checkOut', this.value)">
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');
    },

    /* Update attendance status */
    updateStatus(workerId, status, selectEl) {
        // Update select styling
        selectEl.className = 'att-status-select ' + Utils.statusClass(status);

        if (!status) {
            // Remove attendance record
            const records = DB.getAttendance().filter(a => !(a.workerId === workerId && a.date === this.currentDate));
            DB.saveAttendance(records);
            this.render();
            Dashboard.render();
            return;
        }

        const now = new Date();
        const checkInTime = status !== 'absent' && status !== 'paid-leave' && status !== 'unpaid-leave'
            ? `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
            : '';

        const record = {
            workerId: workerId,
            date: this.currentDate,
            status: status,
            checkIn: checkInTime,
            checkOut: '',
            totalHours: 0,
            overtimeHours: 0,
            notes: ''
        };

        DB.upsertAttendance(record);
        UI.toast(`${Utils.statusLabel(status)} চিহ্নিত হয়েছে!`, 'success');
        this.render();
        Dashboard.render();
    },

    /* Update check-in/check-out time */
    updateTime(workerId, field, value) {
        const records = DB.getAttendance();
        const record = records.find(a => a.workerId === workerId && a.date === this.currentDate);

        if (record) {
            record[field] = value;

            // Calculate hours
            if (record.checkIn && record.checkOut) {
                record.totalHours = Utils.timeDiffHours(record.checkIn, record.checkOut);
                // Calculate overtime (assuming 8 hour work day)
                const w = DB.getWorker(workerId);
                const standardHours = 8;
                record.overtimeHours = Math.max(0, record.totalHours - standardHours);
            }

            DB.saveAttendance(records);
            this.render();
            Dashboard.render();
        }
    },

    /* Navigate dates */
    prevDay() {
        const d = Utils.parseDate(this.currentDate);
        d.setDate(d.getDate() - 1);
        this.currentDate = d.toISOString().split('T')[0];
        document.getElementById('attendance-date').value = this.currentDate;
        this.render();
    },

    nextDay() {
        const d = Utils.parseDate(this.currentDate);
        d.setDate(d.getDate() + 1);
        this.currentDate = d.toISOString().split('T')[0];
        document.getElementById('attendance-date').value = this.currentDate;
        this.render();
    },

    setDate(dateStr) {
        this.currentDate = dateStr;
        this.render();
    }
};


/* ==================== SALARY MODULE ==================== */
const Salary = {
    /* Calculate salary for a daily worker in a month */
    calculateDailyWorker(workerId, year, month) {
        const w = DB.getWorker(workerId);
        if (!w || w.employmentType !== 'daily') return { earned: 0, otAmount: 0 };

        const records = DB.getAttendanceByWorkerAndMonth(workerId, year, month);
        const daysInMonth = Utils.getDaysInMonth(year, month);

        let fullDays = 0;
        let halfDays = 0;
        let paidLeaves = 0;
        let unpaidLeaves = 0;
        let absentDays = 0;
        let totalOvertimeHours = 0;

        records.forEach(r => {
            switch (r.status) {
                case 'present': fullDays++; break;
                case 'halfday': halfDays++; break;
                case 'paid-leave': paidLeaves++; break;
                case 'unpaid-leave': unpaidLeaves++; break;
                case 'absent': absentDays++; break;
            }
            totalOvertimeHours += r.overtimeHours || 0;
        });

        // Uncounted days (no record) = absent
        const markedDays = records.length;
        absentDays += Math.max(0, daysInMonth - markedDays);

        const wageEarned = (fullDays * w.dailyWage) + (halfDays * w.dailyWage * 0.5) + (paidLeaves * w.dailyWage);
        const otAmount = totalOvertimeHours * (w.overtimeRate || 0);

        return {
            earned: wageEarned + otAmount,
            wageEarned,
            otAmount,
            fullDays,
            halfDays,
            paidLeaves,
            unpaidLeaves,
            absentDays,
            totalOvertimeHours,
            dailyWage: w.dailyWage
        };
    },

    /* Calculate salary for a monthly worker in a month */
    calculateMonthlyWorker(workerId, year, month) {
        const w = DB.getWorker(workerId);
        if (!w || w.employmentType !== 'monthly') return { earned: 0, otAmount: 0 };

        const records = DB.getAttendanceByWorkerAndMonth(workerId, year, month);
        const daysInMonth = Utils.getDaysInMonth(year, month);

        let fullDays = 0;
        let halfDays = 0;
        let paidLeaves = 0;
        let unpaidLeaves = 0;
        let absentDays = 0;
        let totalOvertimeHours = 0;

        records.forEach(r => {
            switch (r.status) {
                case 'present': fullDays++; break;
                case 'halfday': halfDays++; break;
                case 'paid-leave': paidLeaves++; break;
                case 'unpaid-leave': unpaidLeaves++; break;
                case 'absent': absentDays++; break;
            }
            totalOvertimeHours += r.overtimeHours || 0;
        });

        const markedDays = records.length;
        absentDays += Math.max(0, daysInMonth - markedDays);

        // Monthly salary: proportional deduction for unpaid leaves
        const perDaySalary = w.monthlySalary / daysInMonth;
        const deduction = unpaidLeaves * perDaySalary;
        const halfDayDeduction = halfDays * perDaySalary * 0.5;
        const baseSalary = w.monthlySalary - deduction - halfDayDeduction;
        const otAmount = totalOvertimeHours * (w.overtimeRate || 0);

        return {
            earned: Math.max(0, baseSalary + otAmount),
            wageEarned: Math.max(0, baseSalary),
            otAmount,
            fullDays,
            halfDays,
            paidLeaves,
            unpaidLeaves,
            absentDays,
            totalOvertimeHours,
            monthlySalary: w.monthlySalary,
            deduction,
            halfDayDeduction
        };
    },

    /* Calculate total earnings for a worker (all time) */
    calculateWorkerEarnings(workerId) {
        const w = DB.getWorker(workerId);
        if (!w) return 0;

        // Calculate for all months from joining to now
        const joinDate = Utils.parseDate(w.joiningDate);
        const now = new Date();
        let totalEarned = 0;

        let current = new Date(joinDate.getFullYear(), joinDate.getMonth(), 1);
        const end = new Date(now.getFullYear(), now.getMonth(), 1);

        while (current <= end) {
            const year = current.getFullYear();
            const month = current.getMonth();

            if (w.employmentType === 'daily') {
                const result = this.calculateDailyWorker(workerId, year, month);
                totalEarned += result.earned;
            } else {
                const result = this.calculateMonthlyWorker(workerId, year, month);
                totalEarned += result.earned;
            }

            current.setMonth(current.getMonth() + 1);
        }

        return totalEarned;
    },

    /* Get current month salary for a worker */
    getCurrentMonthSalary(workerId) {
        const w = DB.getWorker(workerId);
        if (!w) return { earned: 0 };

        const now = new Date();
        if (w.employmentType === 'daily') {
            return this.calculateDailyWorker(workerId, now.getFullYear(), now.getMonth());
        } else {
            return this.calculateMonthlyWorker(workerId, now.getFullYear(), now.getMonth());
        }
    }
};


/* ==================== PAYMENTS MODULE ==================== */
const Payments = {
    /* Open payment form */
    openForm(workerId = '') {
        document.getElementById('form-payment').reset();
        document.getElementById('payment-date').value = Utils.getToday();
        document.getElementById('payment-worker-id').value = '';

        // Populate worker select
        const select = document.getElementById('payment-worker-select');
        const workers = Workers.getActive();
        select.innerHTML = '<option value="">কর্মচারী নির্বাচন করুন</option>' +
            workers.map(w => `<option value="${w.id}" ${w.id === workerId ? 'selected' : ''}>${w.name} (${w.workerId})</option>`).join('');

        if (workerId) {
            this._updatePayableAmount(workerId);
        }

        UI.openModal('modal-payment');
    },

    /* Update payable amount display */
    _updatePayableAmount(workerId) {
        // Will be shown in the form if needed
    },

    /* Save payment */
    save(e) {
        e.preventDefault();
        const workerId = document.getElementById('payment-worker-select').value;
        const date = document.getElementById('payment-date').value;
        const amount = parseFloat(document.getElementById('payment-amount').value);
        const notes = document.getElementById('payment-notes').value.trim();

        if (!workerId || !date || !amount || amount <= 0) {
            UI.toast('সকল প্রয়োজনীয় তথ্য পূরণ করুন!', 'warning');
            return;
        }

        DB.addPayment({ workerId, date, amount, notes });
        UI.toast('পেমেন্ট সফলভাবে সংরক্ষিত হয়েছে!', 'success');
        UI.closeModal('modal-payment');
        this.render();
        Dashboard.render();
    },

    /* Render payment page */
    render(search = '') {
        const workers = DB.getWorkers();
        const payments = DB.getPayments().sort((a, b) => b.date.localeCompare(a.date));

        // Summary
        const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
        let totalEarned = 0;
        workers.forEach(w => {
            totalEarned += Salary.calculateWorkerEarnings(w.id);
        });
        const totalDue = totalEarned - totalPaid;

        const summaryEl = document.getElementById('payment-summary');
        summaryEl.innerHTML = `
            <div class="stat-card success">
                <div class="stat-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div>
                <div class="stat-value">${Utils.formatCurrencyShort(totalEarned)}</div>
                <div class="stat-label">মোট আয়</div>
            </div>
            <div class="stat-card primary">
                <div class="stat-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg></div>
                <div class="stat-value">${Utils.formatCurrencyShort(totalPaid)}</div>
                <div class="stat-label">মোট পেমেন্ট</div>
            </div>
            <div class="stat-card danger">
                <div class="stat-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></div>
                <div class="stat-value">${Utils.formatCurrencyShort(Math.max(0, totalDue))}</div>
                <div class="stat-label">মোট বকেয়া</div>
            </div>
            <div class="stat-card warning">
                <div class="stat-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/></svg></div>
                <div class="stat-value">${Utils.toBanglaNum(payments.length)}</div>
                <div class="stat-label">মোট লেনদেন</div>
            </div>
        `;

        // Payment list grouped by worker
        const listEl = document.getElementById('payment-list');
        const noPayments = document.getElementById('no-payments');

        const workerPayments = {};
        workers.forEach(w => {
            const wp = payments.filter(p => p.workerId === w.id);
            if (search && !w.name.toLowerCase().includes(search.toLowerCase())) return;
            if (wp.length > 0 || !search) {
                workerPayments[w.id] = { worker: w, payments: wp };
            }
        });

        const entries = Object.values(workerPayments);

        if (entries.length === 0) {
            listEl.innerHTML = '';
            noPayments.style.display = 'block';
            return;
        }

        noPayments.style.display = 'none';

        listEl.innerHTML = entries.map(({ worker: w, payments: wp }) => {
            const earnings = Salary.calculateWorkerEarnings(w.id);
            const totalWorkerPaid = wp.reduce((s, p) => s + p.amount, 0);
            const due = earnings - totalWorkerPaid;
            const lastPayment = wp.length > 0 ? wp[0].date : null;

            return `
                <div class="worker-payment-card">
                    <div class="worker-payment-header">
                        <div class="worker-avatar" style="width:40px;height:40px;font-size:15px;">
                            ${w.photo ? `<img src="${w.photo}" alt="${w.name}">` : Utils.getInitials(w.name)}
                        </div>
                        <div style="flex:1;">
                            <div style="font-weight:600; font-size:14px;">${w.name}</div>
                            <div style="font-size:12px; color:var(--text-secondary);">${w.workerId} &bull; ${lastPayment ? 'শেষ পেমেন্ট: ' + Utils.formatDateShort(lastPayment) : 'কোনো পেমেন্ট নেই'}</div>
                        </div>
                    </div>
                    <div class="worker-payment-details">
                        <div class="payment-detail earned">
                            <div class="amount">${Utils.formatCurrencyShort(earnings)}</div>
                            <div class="label">মোট আয়</div>
                        </div>
                        <div class="payment-detail paid">
                            <div class="amount">${Utils.formatCurrencyShort(totalWorkerPaid)}</div>
                            <div class="label">পরিশোধিত</div>
                        </div>
                        <div class="payment-detail due">
                            <div class="amount">${Utils.formatCurrencyShort(Math.max(0, due))}</div>
                            <div class="label">বকেয়া</div>
                        </div>
                    </div>
                    ${wp.length > 0 ? `
                        <div style="margin-bottom:10px;">
                            <div style="font-size:12px; font-weight:600; color:var(--text-secondary); margin-bottom:6px;">পেমেন্ট ইতিহাস:</div>
                            ${wp.slice(0, 5).map(p => `
                                <div style="display:flex; justify-content:space-between; align-items:center; padding:4px 0; font-size:12px; border-bottom:1px solid var(--border-light);">
                                    <span style="color:var(--text-secondary);">${Utils.formatDateShort(p.date)}${p.notes ? ' - ' + p.notes : ''}</span>
                                    <span style="font-weight:600; color:var(--success);">${Utils.formatCurrency(p.amount)}</span>
                                </div>
                            `).join('')}
                            ${wp.length > 5 ? `<div style="text-align:center; padding:4px; font-size:11px; color:var(--text-tertiary);">আরও ${Utils.toBanglaNum(wp.length - 5)}টি লেনদেন...</div>` : ''}
                        </div>
                    ` : ''}
                    <div class="worker-payment-actions">
                        <button class="btn btn-sm btn-primary" onclick="Payments.openForm('${w.id}')">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                            পেমেন্ট দিন
                        </button>
                        <button class="btn btn-sm btn-outline" onclick="Payments.showAllPayments('${w.id}')">
                            সব দেখুন
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    },

    /* Show all payments for a worker */
    showAllPayments(workerId) {
        const w = DB.getWorker(workerId);
        if (!w) return;

        const payments = DB.getPaymentsByWorker(workerId).sort((a, b) => b.date.localeCompare(a.date));

        const content = document.getElementById('report-content');
        content.innerHTML = `
            <h3 style="margin-bottom:12px;">${w.name} - পেমেন্ট ইতিহাস</h3>
            ${payments.length === 0 ? '<p style="color:var(--text-secondary); text-align:center; padding:20px;">কোনো পেমেন্ট নেই</p>' : `
                <div class="table-scroll">
                    <table>
                        <thead>
                            <tr>
                                <th>তারিখ</th>
                                <th>পরিমাণ</th>
                                <th>নোট</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            ${payments.map(p => `
                                <tr>
                                    <td>${Utils.formatDateShort(p.date)}</td>
                                    <td style="font-weight:600; color:var(--success);">${Utils.formatCurrency(p.amount)}</td>
                                    <td style="color:var(--text-secondary);">${p.notes || '-'}</td>
                                    <td><button class="icon-btn-sm" onclick="Payments.deletePayment('${p.id}', '${workerId}')" style="color:var(--danger);" title="মুছুন"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `}
        `;
        document.querySelector('#modal-report .modal-header h3').textContent = 'পেমেন্ট ইতিহাস';
        UI.openModal('modal-report');
    },

    /* Delete payment */
    async deletePayment(id, workerId) {
        const ok = await UI.confirm('পেমেন্ট মুছুন', 'এই পেমেন্ট রেকর্ড মুছে ফেলতে চান?', 'মুছুন', 'btn-danger');
        if (ok) {
            DB.deletePayment(id);
            UI.toast('পেমেন্ট মুছে ফেলা হয়েছে!', 'success');
            UI.closeModal('modal-report');
            this.render();
            Dashboard.render();
        }
    }
};


/* ==================== DASHBOARD MODULE ==================== */
const Dashboard = {
    render() {
        const workers = DB.getWorkers();
        const activeWorkers = workers.filter(w => w.isActive);
        const today = Utils.getToday();
        const todayAttendance = DB.getAttendanceByDate(today);

        // Stats
        const presentToday = todayAttendance.filter(a => a.status === 'present').length;
        const absentToday = activeWorkers.length - todayAttendance.filter(a =>
            ['present', 'halfday', 'paid-leave', 'unpaid-leave'].includes(a.status)
        ).length;
        const onLeave = todayAttendance.filter(a => a.status === 'paid-leave' || a.status === 'unpaid-leave').length;

        // Financial stats
        const now = new Date();
        let monthlyPayroll = 0;
        let totalOvertime = 0;
        let totalPaid = 0;
        let totalEarned = 0;

        activeWorkers.forEach(w => {
            const salary = Salary.getCurrentMonthSalary(w.id);
            monthlyPayroll += salary.earned;
            totalOvertime += salary.otAmount;
            totalEarned += Salary.calculateWorkerEarnings(w.id);
        });

        totalPaid = DB.getPayments().reduce((s, p) => s + p.amount, 0);
        const totalDue = totalEarned - totalPaid;

        // Attendance percentage
        const attPct = activeWorkers.length > 0 ? Math.round((presentToday / activeWorkers.length) * 100) : 0;

        // Render stats
        const statsEl = document.getElementById('dashboard-stats');
        statsEl.innerHTML = `
            <div class="stat-card highlight">
                <div class="stat-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg></div>
                <div>
                    <div class="stat-value">${Utils.toBanglaNum(activeWorkers.length)}</div>
                    <div class="stat-label">সক্রিয় কর্মচারী</div>
                </div>
            </div>
            <div class="stat-card success">
                <div class="stat-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></div>
                <div class="stat-value">${Utils.toBanglaNum(presentToday)}</div>
                <div class="stat-label">আজ উপস্থিত</div>
            </div>
            <div class="stat-card danger">
                <div class="stat-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg></div>
                <div class="stat-value">${Utils.toBanglaNum(Math.max(0, absentToday))}</div>
                <div class="stat-label">আজ অনুপস্থিত</div>
            </div>
            <div class="stat-card info">
                <div class="stat-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></div>
                <div class="stat-value">${Utils.toBanglaNum(onLeave)}</div>
                <div class="stat-label">লিভে আছেন</div>
            </div>
            <div class="stat-card primary">
                <div class="stat-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div>
                <div class="stat-value">${Utils.formatCurrencyShort(monthlyPayroll)}</div>
                <div class="stat-label">মাসিক বেতন</div>
            </div>
            <div class="stat-card success">
                <div class="stat-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg></div>
                <div class="stat-value">${Utils.formatCurrencyShort(totalPaid)}</div>
                <div class="stat-label">মোট পরিশোধ</div>
            </div>
            <div class="stat-card danger">
                <div class="stat-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></div>
                <div class="stat-value">${Utils.formatCurrencyShort(Math.max(0, totalDue))}</div>
                <div class="stat-label">মোট বকেয়া</div>
            </div>
            <div class="stat-card warning">
                <div class="stat-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/></svg></div>
                <div class="stat-value">${Utils.formatCurrencyShort(totalOvertime)}</div>
                <div class="stat-label">ওভারটাইম</div>
            </div>
            <div class="stat-card" style="grid-column: 1 / -1;">
                <div style="display:flex; align-items:center; gap:12px;">
                    <div style="flex:1;">
                        <div class="stat-label" style="margin-bottom:4px;">আজকের হাজিরা শতাংশ</div>
                        <div style="background:var(--border-light); border-radius:8px; height:12px; overflow:hidden;">
                            <div style="background:var(--primary); height:100%; border-radius:8px; width:${attPct}%; transition:width 0.5s;"></div>
                        </div>
                    </div>
                    <div class="stat-value" style="color:var(--primary); font-size:28px;">${Utils.toBanglaNum(attPct)}%</div>
                </div>
            </div>
        `;

        // Attendance summary cards
        const summaryEl = document.getElementById('dashboard-attendance-summary');
        const pCount = todayAttendance.filter(a => a.status === 'present').length;
        const hCount = todayAttendance.filter(a => a.status === 'halfday').length;
        const aCount = Math.max(0, activeWorkers.length - todayAttendance.filter(a => a.status !== 'absent').length);
        const lCount = todayAttendance.filter(a => a.status === 'paid-leave' || a.status === 'unpaid-leave').length;

        summaryEl.innerHTML = `
            <div class="att-summary-item present">
                <div class="count">${Utils.toBanglaNum(pCount)}</div>
                <div class="label">উপস্থিত</div>
            </div>
            <div class="att-summary-item halfday">
                <div class="count">${Utils.toBanglaNum(hCount)}</div>
                <div class="label">আধা দিন</div>
            </div>
            <div class="att-summary-item absent">
                <div class="count">${Utils.toBanglaNum(aCount)}</div>
                <div class="label">অনুপস্থিত</div>
            </div>
            <div class="att-summary-item leave">
                <div class="count">${Utils.toBanglaNum(lCount)}</div>
                <div class="label">লিভ</div>
            </div>
            <div class="att-summary-item pct">
                <div class="count">${Utils.toBanglaNum(attPct)}%</div>
                <div class="label">হাজিরা</div>
            </div>
        `;

        // Recent activity
        const activityEl = document.getElementById('dashboard-recent-activity');
        const recentPayments = DB.getPayments().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5);
        const recentAttendance = DB.getAttendance().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);

        let activities = [];

        recentPayments.forEach(p => {
            const w = DB.getWorker(p.workerId);
            if (w) {
                activities.push({
                    type: 'payment',
                    text: `<strong>${w.name}</strong> কে <strong>${Utils.formatCurrency(p.amount)}</strong> পেমেন্ট দেওয়া হয়েছে`,
                    time: p.createdAt,
                    color: 'var(--success)'
                });
            }
        });

        recentAttendance.forEach(a => {
            const w = DB.getWorker(a.workerId);
            if (w) {
                activities.push({
                    type: 'attendance',
                    text: `<strong>${w.name}</strong> - ${Utils.statusLabel(a.status)}`,
                    time: a.date,
                    color: a.status === 'present' ? 'var(--success)' : a.status === 'absent' ? 'var(--danger)' : 'var(--warning)'
                });
            }
        });

        activities.sort((a, b) => b.time.localeCompare(a.time));
        activities = activities.slice(0, 8);

        if (activities.length === 0) {
            activityEl.innerHTML = '<p style="color:var(--text-tertiary); text-align:center; padding:20px;">কোনো সাম্প্রতিক কার্যক্রম নেই</p>';
        } else {
            activityEl.innerHTML = activities.map(a => `
                <div class="activity-item">
                    <span class="activity-dot" style="background:${a.color};"></span>
                    <span class="activity-text">${a.text}</span>
                    <span class="activity-time">${Utils.timeAgo(a.time)}</span>
                </div>
            `).join('');
        }

        // Update date
        document.getElementById('dashboard-date').textContent = Utils.formatDateBangla(Utils.getToday());
    }
};


/* ==================== CALENDAR MODULE ==================== */
const Calendar = {
    currentWorkerId: null,
    currentYear: new Date().getFullYear(),
    currentMonth: new Date().getMonth(),

    show(workerId) {
        this.currentWorkerId = workerId;
        this.currentYear = new Date().getFullYear();
        this.currentMonth = new Date().getMonth();
        this.render();
        UI.openModal('modal-calendar');
    },

    prevMonth() {
        this.currentMonth--;
        if (this.currentMonth < 0) {
            this.currentMonth = 11;
            this.currentYear--;
        }
        this.render();
    },

    nextMonth() {
        this.currentMonth++;
        if (this.currentMonth > 11) {
            this.currentMonth = 0;
            this.currentYear++;
        }
        this.render();
    },

    render() {
        const w = DB.getWorker(this.currentWorkerId);
        if (!w) return;

        document.getElementById('calendar-title').textContent = `${w.name} - হাজিরা ক্যালেন্ডার`;
        document.getElementById('cal-month-year').textContent =
            `${Utils.banglaMonths[this.currentMonth]} ${Utils.toBanglaNum(this.currentYear)}`;

        const records = DB.getAttendanceByWorkerAndMonth(this.currentWorkerId, this.currentYear, this.currentMonth);
        const daysInMonth = Utils.getDaysInMonth(this.currentYear, this.currentMonth);
        const firstDay = Utils.getFirstDayOfMonth(this.currentYear, this.currentMonth);
        const today = Utils.getToday();

        const grid = document.getElementById('calendar-grid');
        let html = '';

        // Day headers
        const dayNames = ['রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহ', 'শুক্র', 'শনি'];
        dayNames.forEach(d => {
            html += `<div class="cal-day-header">${d}</div>`;
        });

        // Empty cells before first day
        for (let i = 0; i < firstDay; i++) {
            html += '<div class="cal-day empty"></div>';
        }

        // Days
        let present = 0, halfday = 0, absent = 0, paidLeave = 0, unpaidLeave = 0;

        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${this.currentYear}-${String(this.currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const record = records.find(r => r.date === dateStr);
            const isToday = dateStr === today;
            const isFuture = dateStr > today;

            let statusClass = '';
            if (record) {
                statusClass = Utils.statusClass(record.status);
                switch (record.status) {
                    case 'present': present++; break;
                    case 'halfday': halfday++; break;
                    case 'paid-leave': paidLeave++; break;
                    case 'unpaid-leave': unpaidLeave++; break;
                    case 'absent': absent++; break;
                }
            } else if (isFuture) {
                statusClass = 'future';
            } else {
                absent++;
            }

            html += `<div class="cal-day ${statusClass} ${isToday ? 'today' : ''}" title="${Utils.statusLabel(record?.status || (isFuture ? '' : 'absent'))}">${Utils.toBanglaNum(day)}</div>`;
        }

        grid.innerHTML = html;

        // Summary
        const summaryEl = document.getElementById('calendar-summary');
        summaryEl.innerHTML = `
            <div class="cal-summary-item" style="background:var(--success-bg);">
                <div class="num" style="color:var(--success);">${Utils.toBanglaNum(present)}</div>
                <div class="txt">উপস্থিত</div>
            </div>
            <div class="cal-summary-item" style="background:var(--warning-bg);">
                <div class="num" style="color:var(--warning);">${Utils.toBanglaNum(halfday)}</div>
                <div class="txt">আধা দিন</div>
            </div>
            <div class="cal-summary-item" style="background:var(--danger-bg);">
                <div class="num" style="color:var(--danger);">${Utils.toBanglaNum(absent)}</div>
                <div class="txt">অনুপস্থিত</div>
            </div>
            <div class="cal-summary-item" style="background:var(--info-bg);">
                <div class="num" style="color:var(--info);">${Utils.toBanglaNum(paidLeave)}</div>
                <div class="txt">পেইড লিভ</div>
            </div>
            <div class="cal-summary-item" style="background:var(--bg-tertiary);">
                <div class="num" style="color:var(--text-secondary);">${Utils.toBanglaNum(unpaidLeave)}</div>
                <div class="txt">আনপেইড লিভ</div>
            </div>
            <div class="cal-summary-item" style="background:var(--primary-bg);">
                <div class="num" style="color:var(--primary);">${Utils.toBanglaNum(present + halfday + paidLeave)}/${Utils.toBanglaNum(daysInMonth)}</div>
                <div class="txt">হাজিরা</div>
            </div>
        `;
    }
};



/* ==================== BANGLA FONT LOADER ====================
   Loads Kalpurush Unicode Bengali font locally for PDF rendering.
   Falls back to English/Helvetica if unavailable.
   ============================================================ */
const BanglaFont = {
    fontData: null,
    fontName: 'Kalpurush',
    fileName: 'Kalpurush.ttf',
    isLoaded: false,

    async load() {
        if (this.isLoaded) return true;
        if (typeof window !== 'undefined' && window.KALPURUSH_FONT_B64) {
            this.fontData = window.KALPURUSH_FONT_B64;
            this.isLoaded = true;
            return true;
        }
        return false;
    },

    register(doc) {
        if (!this.fontData && typeof window !== 'undefined' && window.KALPURUSH_FONT_B64) {
            this.fontData = window.KALPURUSH_FONT_B64;
            this.isLoaded = true;
        }
        if (!this.fontData) return false;
        try {
            doc.addFileToVFS(this.fileName, this.fontData);
            doc.addFont(this.fileName, this.fontName, 'normal');
            doc.addFont(this.fileName, this.fontName, 'bold');
            return true;
        } catch (e) {
            console.error('Font registration failed:', e);
            return false;
        }
    }
};

/* ==================== REPORTS MODULE ====================
   Dual-language PDF Reports on Original US BENGOL Letterhead
   ======================================================== */
const Reports = {

    /* Language & font state */
    _lang: 'bn',
    _fontName: 'Kalpurush',

    /* Bangla ↔ English string helper */
    __(bn, en) { return this._lang === 'bn' ? bn : en; },

    /* Font setter shorthand */
    _setFont(doc, style) { doc.setFont(this._fontName, style || 'normal'); },

    /* Stamp Letterhead Background */
    _stampPadBg(doc) {
        if (typeof window !== 'undefined' && window.US_BENGOL_PAD_BG) {
            try {
                doc.addImage(window.US_BENGOL_PAD_BG, 'PNG', 0, 0, 210, 297, undefined, 'FAST');
            } catch (e) {
                console.warn('Pad background raster stamp failed:', e);
            }
        }
    },

    /* Save PDF with Original Illustrator Vector Letterhead Merge */
    async _saveWithLetterhead(doc, filename) {
        const totalPages = doc.internal.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
            doc.setPage(i);
            this._addFooter(doc, i, totalPages);
        }

        let finalBytes = null;
        let usedVector = false;

        if (typeof window !== 'undefined' && window.PDFLib && window.PDFLib.PDFDocument) {
            try {
                const resp = await fetch('assets/pad.pdf');
                if (resp.ok) {
                    const padBytes = await resp.arrayBuffer();
                    const jsPdfBytes = doc.output('arraybuffer');
                    const { PDFDocument } = window.PDFLib;
                    const finalPdfDoc = await PDFDocument.load(jsPdfBytes);
                    const templatePdfDoc = await PDFDocument.load(padBytes);
                    const [embeddedPad] = await finalPdfDoc.embedPdf(templatePdfDoc, [0]);

                    const pages = finalPdfDoc.getPages();
                    for (const page of pages) {
                        page.drawPage(embeddedPad, {
                            x: -8.504,
                            y: -8.504,
                            width: 612.283,
                            height: 858.898,
                            opacity: 1.0,
                        });
                    }
                    finalBytes = await finalPdfDoc.save();
                    usedVector = true;
                }
            } catch (e) {
                console.warn('Vector PDF-Lib merge failed, fallback to jsPDF direct download:', e);
            }
        }

        if (!usedVector) {
            doc.save(filename);
            return;
        }

        const blob = new Blob([finalBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    /* ─────────────────────────────────────────────────
       Footer with page numbers (placed safely at y = 266mm)
       ───────────────────────────────────────────────── */
    _addFooter(doc, pageNum, totalPages) {
        if (totalPages <= 1) return;
        this._setFont(doc, 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(120, 120, 120);
        doc.text(`পৃষ্ঠা / Page ${pageNum} of ${totalPages}`, 105, 266, { align: 'center' });
    },

    /* ─────────────────────────────────────────────────
       Header inside safe middle dynamic area (y = 48mm)
       Original letterhead artwork occupies y = 0 to 42mm
       ───────────────────────────────────────────────── */
    _drawHeader(doc, title, subtitle) {
        let y = 48;
        this._setFont(doc, 'bold');
        doc.setFontSize(13);
        doc.setTextColor(27, 54, 93); // US BENGOL Navy Blue
        doc.text(title, 105, y, { align: 'center' });
        y += 5.5;

        if (subtitle) {
            this._setFont(doc, 'normal');
            doc.setFontSize(9);
            doc.setTextColor(80, 80, 80);
            doc.text(subtitle, 105, y, { align: 'center' });
            y += 5;
        }

        doc.setDrawColor(0, 136, 82); // US BENGOL Green
        doc.setLineWidth(0.4);
        doc.line(18, y, 192, y);
    },

    /* ─────────────────────────────────────────────────
       Bordered information box
       ───────────────────────────────────────────────── */
    _drawInfoBox(doc, startY, data) {
        const boxW = 170;
        const leftX = 20;
        const rowH = 7;
        const totalH = data.length * rowH;

        doc.setDrawColor(200);
        doc.setLineWidth(0.5);
        doc.roundedRect(leftX, startY, boxW, totalH, 3, 3, 'S');
        doc.setLineWidth(0.2);

        data.forEach((row, i) => {
            const y = startY + (i * rowH) + (rowH * 0.65);
            this._setFont(doc, 'bold');
            doc.setFontSize(9);
            doc.setTextColor(60);
            doc.text(row.label, leftX + 6, y);

            this._setFont(doc, 'normal');
            doc.setFontSize(9);
            doc.setTextColor(30);
            doc.text(row.value, leftX + boxW / 2 + 4, y);

            if (i < data.length - 1) {
                doc.setDrawColor(235);
                doc.line(leftX + 4, startY + (i + 1) * rowH, leftX + boxW - 4, startY + (i + 1) * rowH);
            }
        });
        return startY + totalH + 4;
    },

    /* ─────────────────────────────────────────────────
       Salary calculation box
       ───────────────────────────────────────────────── */
    _drawSalaryBox(doc, startY, heading, items) {
        const boxW = 170;
        const leftX = 20;
        const rowH = 8;

        // Header
        doc.setFillColor(26, 115, 232);
        doc.roundedRect(leftX, startY, boxW, rowH + 2, 3, 3, 'F');
        this._setFont(doc, 'bold');
        doc.setFontSize(10);
        doc.setTextColor(255, 255, 255);
        doc.text(heading, leftX + boxW / 2, startY + rowH * 0.6, { align: 'center' });

        items.forEach((item, i) => {
            const y = startY + rowH + 4 + (i * rowH) + rowH * 0.65;
            const isLast = i === items.length - 1;

            if (i % 2 === 0 && !isLast) {
                doc.setFillColor(248, 248, 255);
                doc.rect(leftX + 2, startY + rowH + 4 + (i * rowH), boxW - 4, rowH, 'F');
            }

            this._setFont(doc, item.bold ? 'bold' : 'normal');
            doc.setFontSize(item.bold ? 10 : 9);
            doc.setTextColor(isLast ? 26 : (item.color || 60), isLast ? 115 : 0, isLast ? 232 : 0);
            doc.text(item.label, leftX + 10, y);

            // Value
            this._setFont(doc, 'bold');
            doc.setFontSize(item.bold ? 11 : 9);
            doc.setTextColor(isLast ? 26 : (item.valueColor || item.color || 60), isLast ? 115 : 0, isLast ? 232 : (item.valueColor ? 0 : 0));
            doc.text(item.value, leftX + boxW - 10, y, { align: 'right' });

            if (isLast) {
                doc.setDrawColor(26, 115, 232);
                doc.setLineWidth(0.8);
                doc.line(leftX + 6, startY + rowH + 4 + (i * rowH) + rowH, leftX + boxW - 6, startY + rowH + 4 + (i * rowH) + rowH);
                doc.setLineWidth(0.2);
            } else {
                doc.setDrawColor(235);
                doc.line(leftX + 6, startY + rowH + 4 + (i * rowH) + rowH, leftX + boxW - 6, startY + rowH + 4 + (i * rowH) + rowH);
            }
        });
        return startY + rowH + 4 + items.length * rowH + 6;
    },

    /* ─────────────────────────────────────────────────
       Signature section
       ───────────────────────────────────────────────── */
    _drawSignatures(doc, startY) {
        if (startY > 265) return startY;
        const lineY = startY + 8;
        this._setFont(doc, 'normal');
        doc.setFontSize(9);
        doc.setTextColor(60);

        const labels = [
            'Prepared By',
            'Employee Signature',
            'Authorized Signature'
        ];
        const cols = 3;
        const colW = 55;
        for (let i = 0; i < cols; i++) {
            const x = 20 + (i * (colW + 8));
            doc.setDrawColor(180);
            doc.line(x, lineY, x + colW, lineY);
            doc.text(labels[i], x + colW / 2, lineY + 5, { align: 'center' });
        }

        doc.setFontSize(7);
        doc.setTextColor(150);
        doc.text('US BENGOL', 105, lineY + 14, { align: 'center' });
        return lineY + 18;
    },

    /* ─────────────────────────────────────────────────
       Draw stat cards (used in both reports)
       ───────────────────────────────────────────────── */
    _drawStatCards(doc, startY, cards, cardW, cardGap, leftX) {
        const cw = cardW || 37.5;
        const cg = cardGap || 4;
        const lx = leftX || 22;
        cards.forEach((card, i) => {
            const x = lx + (i * (cw + cg));
            const ch = 17;
            doc.setFillColor(card.bg[0], card.bg[1], card.bg[2]);
            doc.setDrawColor(card.border[0], card.border[1], card.border[2]);
            doc.roundedRect(x, startY, cw, ch, 3, 3, 'FD');
            this._setFont(doc, 'bold');
            doc.setFontSize(11);
            doc.setTextColor(card.textColor[0], card.textColor[1], card.textColor[2]);
            doc.text(card.value, x + cw / 2, startY + 7.5, { align: 'center' });
            this._setFont(doc, 'normal');
            doc.setFontSize(6);
            doc.setTextColor(card.labelColor[0], card.labelColor[1], card.labelColor[2]);
            doc.text(card.label, x + cw / 2, startY + 13.5, { align: 'center' });
        });
        return startY + 22;
    },

    /* ═══════════════════════════════════════════════
       INDIVIDUAL WORKER PDF
       ═══════════════════════════════════════════════ */
    async _ensureFont(doc) {
        await BanglaFont.load();
        const ok = BanglaFont.register(doc);
        if (ok) {
            this._lang = 'bn';
            this._fontName = 'Kalpurush';
            doc.setFont('Kalpurush');
            return true;
        }
        this._lang = 'en';
        this._fontName = 'helvetica';
        doc.setFont('helvetica');
        return false;
    },

    async generateIndividualPDF(workerId, startMonth, endMonth) {
        const w = DB.getWorker(workerId);
        if (!w) { UI.toast('Worker not found!', 'error'); return; }

        try {
            if (typeof window.jspdf === 'undefined' || typeof window.jspdf.jsPDF !== 'function') {
                UI.toast('jsPDF library not loaded!', 'error');
                return;
            }

            const { jsPDF } = window.jspdf;
            const doc = new jsPDF('p', 'mm', 'a4');

            await this._ensureFont(doc);
            this._stampPadBg(doc);

            // ─── Parse month range ────────────────
            const [startY, startM] = startMonth.split('-').map(Number);
            const [endY, endM] = endMonth.split('-').map(Number);
            const enMonths = ['January','February','March','April','May','June','July','August','September','October','November','December'];
            const monthLabel = `${enMonths[startM - 1]} ${startY}`;
            const endLabel = endMonth !== startMonth
                ? ` - ${enMonths[endM - 1]} ${endY}`
                : '';

            // ─── Header inside safe area (y = 48mm) ──
            this._drawHeader(doc,
                'Employee Attendance & Payroll Statement',
                `Report Month: ${monthLabel}${endLabel}`
            );

            // ─── Worker Information Box ──────────
            const empType = w.employmentType === 'daily' ? 'Daily Wage Worker' : 'Monthly Salary Worker';
            const wageLabel = w.employmentType === 'daily' ? 'Daily Wage' : 'Monthly Salary';
            const wageValue = Utils.formatCurrency(w.employmentType === 'daily' ? w.dailyWage : w.monthlySalary);

            const infoData = [
                { label: 'Worker Name', value: w.name },
                { label: 'Worker ID', value: w.workerId },
                { label: 'Designation', value: w.designation },
                { label: 'Mobile', value: w.mobile },
                { label: 'Joining Date', value: Utils.formatDateBangla(w.joiningDate) },
                { label: 'Employment Type', value: empType },
                { label: wageLabel, value: wageValue },
                { label: 'Overtime Rate', value: `${Utils.formatCurrency(w.overtimeRate)}/hour` }
            ];
            let y = this._drawInfoBox(doc, 60, infoData);

            // ─── Collect Attendance Data ──────────
            let totalFullDays = 0, totalHalfDays = 0, totalPaidLeaves = 0;
            let totalUnpaidLeaves = 0, totalAbsent = 0, totalEarned = 0;
            let totalOT = 0, totalOTAmount = 0;
            const allRecords = [];

            let current = new Date(startY, startM - 1, 1);
            const end = new Date(endY, endM - 1, 1);

            while (current <= end) {
                const yr = current.getFullYear();
                const mo = current.getMonth();
                const monthRecords = DB.getAttendanceByWorkerAndMonth(workerId, yr, mo)
                    .sort((a, b) => a.date.localeCompare(b.date));

                monthRecords.forEach(r => { allRecords.push(r); });

                let mFd = 0, mHd = 0, mPl = 0, mUl = 0, mAb = 0, mOt = 0;
                allRecords.forEach(r => {
                    if (r.date.startsWith(`${yr}-${String(mo + 1).padStart(2, '0')}`)) {
                        switch (r.status) {
                            case 'present': mFd++; break;
                            case 'halfday': mHd++; break;
                            case 'paid-leave': mPl++; break;
                            case 'unpaid-leave': mUl++; break;
                            case 'absent': mAb++; break;
                        }
                        mOt += r.overtimeHours || 0;
                    }
                });

                let mEarned = 0, mOTamt = 0;
                if (w.employmentType === 'daily') {
                    const r2 = Salary.calculateDailyWorker(workerId, yr, mo);
                    mEarned = r2.earned; mOTamt = r2.otAmount;
                } else {
                    const r2 = Salary.calculateMonthlyWorker(workerId, yr, mo);
                    mEarned = r2.earned; mOTamt = r2.otAmount;
                }

                totalFullDays += mFd; totalHalfDays += mHd;
                totalPaidLeaves += mPl; totalUnpaidLeaves += mUl;
                totalAbsent += mAb; totalEarned += mEarned;
                totalOT += mOt; totalOTAmount += mOTamt;

                current.setMonth(current.getMonth() + 1);
            }

            // ─── Attendance Summary Cards ─────────
            y += 2;
            const summaryHeading = 'ATTENDANCE SUMMARY';
            this._setFont(doc, 'bold');
            doc.setFontSize(10);
            doc.setTextColor(50);
            doc.text(summaryHeading, 105, y, { align: 'center' });
            y += 5;

            const totalDays = totalFullDays + totalHalfDays + totalPaidLeaves + totalUnpaidLeaves + totalAbsent;
            const attRate = totalDays > 0 ? Math.round((totalFullDays + totalHalfDays + totalPaidLeaves) / totalDays * 100) : 0;

            const row1 = [
                { label: 'Total Days', value: `${totalDays}`, bg: [245, 248, 255], border: [200, 215, 245], textColor: [26, 115, 232], labelColor: [80, 80, 80] },
                { label: 'Present', value: String(totalFullDays), bg: [235, 248, 240], border: [180, 220, 190], textColor: [15, 157, 88], labelColor: [80, 80, 80] },
                { label: 'Half Day', value: String(totalHalfDays), bg: [255, 248, 230], border: [240, 210, 160], textColor: [244, 180, 0], labelColor: [80, 80, 80] },
                { label: 'Paid Leave', value: String(totalPaidLeaves), bg: [235, 242, 255], border: [180, 210, 240], textColor: [66, 133, 244], labelColor: [80, 80, 80] }
            ];
            y = this._drawStatCards(doc, y, row1);

            const row2 = [
                { label: 'Unpaid Leave', value: String(totalUnpaidLeaves), bg: [250, 240, 240], border: [220, 190, 190], textColor: [160, 80, 80], labelColor: [80, 80, 80] },
                { label: 'Absent', value: String(totalAbsent), bg: [255, 240, 238], border: [230, 200, 200], textColor: [219, 68, 55], labelColor: [80, 80, 80] },
                { label: 'Total Overtime', value: `${totalOT.toFixed(1)}h`, bg: [255, 248, 230], border: [240, 210, 160], textColor: [244, 180, 0], labelColor: [80, 80, 80] },
                { label: 'Attendance %', value: `${attRate}%`, bg: [245, 248, 255], border: [200, 215, 245], textColor: [26, 115, 232], labelColor: [80, 80, 80] }
            ];
            y = this._drawStatCards(doc, y, row2);

            // ─── Detailed Attendance Table ────────
            if (allRecords.length > 0) {
                if (y > 200) {
                    doc.addPage();
                    this._stampPadBg(doc);
                    y = 48;
                }

                this._setFont(doc, 'bold');
                doc.setFontSize(10);
                doc.setTextColor(50);
                doc.text('DETAILED ATTENDANCE RECORD', 105, y, { align: 'center' });
                y += 4;

                const enMonths = ['January','February','March','April','May','June','July','August','September','October','November','December'];
                const attRows = allRecords.sort((a, b) => a.date.localeCompare(b.date)).map(r => {
                    const d = Utils.parseDate(r.date);
                    const dateStr = `${enMonths[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
                    const statusStr = ({ present: 'Present', halfday: 'Half Day', absent: 'Absent', 'paid-leave': 'Paid Leave', 'unpaid-leave': 'Unpaid Leave' }[r.status] || r.status);
                    const otStr = (r.overtimeHours || 0) > 0 ? `${r.overtimeHours.toFixed(1)}h` : '—';
                    return [
                        dateStr,
                        r.checkIn || '—',
                        r.checkOut || '—',
                        statusStr,
                        otStr
                    ];
                });

                const attHeaders = [
                    'Date',
                    'Check In',
                    'Check Out',
                    'Status',
                    'Overtime'
                ];

                doc.autoTable({
                    startY: y,
                    head: [attHeaders],
                    body: attRows,
                    theme: 'grid',
                    headStyles: { fillColor: [27, 54, 93], textColor: [255, 255, 255], font: this._fontName, fontStyle: 'bold', fontSize: 8 },
                    bodyStyles: { font: this._fontName, fontSize: 7.5, cellPadding: 1.5 },
                    alternateRowStyles: { fillColor: [248, 250, 255] },
                    styles: { font: this._fontName, lineColor: [220, 220, 220], lineWidth: 0.1 },
                    margin: { top: 48, bottom: 35, left: 18, right: 18 },
                    pageBreak: 'auto',
                    rowPageBreak: 'avoid',
                    showHead: 'everyPage',
                    willDrawPage: () => { this._stampPadBg(doc); }
                });
                y = doc.lastAutoTable.finalY + 8;
            } else {
                if (y > 220) { doc.addPage(); this._stampPadBg(doc); y = 48; }
                this._setFont(doc, 'normal');
                doc.setFontSize(9);
                doc.setTextColor(150);
                doc.text('No Attendance Records Found.', 105, y + 4, { align: 'center' });
                y += 10;
            }

            // ─── Payment History ─────────────────
            const payments = DB.getPaymentsByWorker(workerId);
            if (payments.length > 0) {
                if (y > 210) {
                    doc.addPage();
                    this._stampPadBg(doc);
                    y = 48;
                }

                this._setFont(doc, 'bold');
                doc.setFontSize(10);
                doc.setTextColor(50);
                doc.text('PAYMENT HISTORY', 105, y, { align: 'center' });
                y += 4;

                const sp = payments.sort((a, b) => b.date.localeCompare(a.date));
                const payRows = sp.map(p => [
                    Utils.formatDateShort(p.date),
                    p.notes || 'Salary Payment',
                    Utils.formatCurrency(p.amount)
                ]);
                const payHeaders = [
                    'Date',
                    'Description',
                    'Amount'
                ];

                doc.autoTable({
                    startY: y,
                    head: [payHeaders],
                    body: payRows,
                    theme: 'grid',
                    headStyles: { fillColor: [27, 54, 93], textColor: [255, 255, 255], font: this._fontName, fontStyle: 'bold', fontSize: 8 },
                    bodyStyles: { font: this._fontName, fontSize: 7.5, cellPadding: 1.5 },
                    alternateRowStyles: { fillColor: [248, 250, 255] },
                    columnStyles: { 0: { cellWidth: 35 }, 1: { cellWidth: 80 }, 2: { cellWidth: 40, halign: 'right' } },
                    styles: { font: this._fontName, lineColor: [220, 220, 220], lineWidth: 0.1 },
                    margin: { top: 48, bottom: 35, left: 18, right: 18 },
                    pageBreak: 'auto',
                    rowPageBreak: 'avoid',
                    showHead: 'everyPage',
                    willDrawPage: () => { this._stampPadBg(doc); }
                });
                y = doc.lastAutoTable.finalY + 10;
            } else {
                this._setFont(doc, 'normal');
                doc.setFontSize(9);
                doc.setTextColor(150);
                doc.text('No Payment Records Found.', 105, y + 4, { align: 'center' });
                y += 10;
            }

            // ─── Salary Calculation Box ──────────
            const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
            const due = Math.max(0, totalEarned - totalPaid);

            if (y > 200) {
                doc.addPage();
                this._stampPadBg(doc);
                y = 48;
            }

            const salaryItems = [
                { label: 'Total Earned', value: Utils.formatCurrency(totalEarned - totalOTAmount), color: 60, bold: false },
                { label: 'Overtime Amount', value: `+ ${Utils.formatCurrency(totalOTAmount)}`, color: 15, valueColor: 80, bold: false },
                { label: 'Gross Pay', value: Utils.formatCurrency(totalEarned), bold: true, color: 26 },
                { label: 'Total Paid', value: `- ${Utils.formatCurrency(totalPaid)}`, color: 200, valueColor: 200, bold: false },
                { label: 'Remaining Due', value: Utils.formatCurrency(due), bold: true, color: 219, valueColor: 219 }
            ];
            y = this._drawSalaryBox(doc, y, 'SALARY CALCULATION', salaryItems) + 4;

            // ─── Signatures ───────────────────────
            this._drawSignatures(doc, y);

            await this._saveWithLetterhead(doc, `${w.workerId}_${w.name}_Report.pdf`);
            UI.toast('PDF রিপোর্ট তৈরি ও ডাউনলোড সম্পন্ন হয়েছে!', 'success');

        } catch (err) {
            console.error('PDF generation error:', err);
            UI.toast('Failed to generate PDF!', 'error');
        }
    },

    /* ═══════════════════════════════════════════════
       ALL WORKERS PDF
       ═══════════════════════════════════════════════ */
    async generateAllPDF(month) {
        const workers = DB.getWorkers();
        if (workers.length === 0) { UI.toast('No workers found!', 'warning'); return; }

        try {
            if (typeof window.jspdf === 'undefined' || typeof window.jspdf.jsPDF !== 'function') {
                UI.toast('jsPDF library not loaded!', 'error');
                return;
            }

            const { jsPDF } = window.jspdf;
            const doc = new jsPDF('p', 'mm', 'a4');

            await this._ensureFont(doc);
            this._stampPadBg(doc);

            const [year, mon] = month.split('-').map(Number);
            const enMonths = ['January','February','March','April','May','June','July','August','September','October','November','December'];
            const monthName = `${enMonths[mon - 1]} ${year}`;

            // ─── Header inside safe area (y = 48mm) ──
            this._drawHeader(doc,
                'All Workers Monthly Payroll & Attendance Report',
                `Month: ${monthName}`
            );

            // ─── Summary Cards ──────────────────────
            const allPayts = DB.getPayments();
            let grandEarned = 0, grandPaid = 0;

            workers.forEach(w => {
                let data;
                if (w.employmentType === 'daily') {
                    data = Salary.calculateDailyWorker(w.id, year, mon - 1);
                } else {
                    data = Salary.calculateMonthlyWorker(w.id, year, mon - 1);
                }
                grandEarned += data.earned;
            });

            const monthPrefix = `${year}-${String(mon).padStart(2, '0')}`;
            allPayts.forEach(p => { if (p.date.startsWith(monthPrefix)) grandPaid += p.amount; });
            const grandDue = Math.max(0, grandEarned - grandPaid);

            let y = 60;
            const scW = 37.5, scG = 4, scX = 22;
            const sCards = [
                { label: 'Total Workers', value: String(workers.length), bg: [245, 248, 255], border: [200, 215, 245], textColor: [26, 115, 232], labelColor: [80, 80, 80] },
                { label: 'Total Salary', value: Utils.formatCurrencyShort(grandEarned), bg: [235, 248, 240], border: [180, 220, 190], textColor: [15, 157, 88], labelColor: [80, 80, 80] },
                { label: 'Total Paid', value: Utils.formatCurrencyShort(grandPaid), bg: [235, 242, 255], border: [180, 210, 240], textColor: [66, 133, 244], labelColor: [80, 80, 80] },
                { label: 'Total Due', value: Utils.formatCurrencyShort(grandDue), bg: [255, 240, 238], border: [230, 200, 200], textColor: [219, 68, 55], labelColor: [80, 80, 80] }
            ];

            sCards.forEach((card, i) => {
                const cx = scX + (i * (scW + scG));
                const ch = 18;
                doc.setFillColor(card.bg[0], card.bg[1], card.bg[2]);
                doc.setDrawColor(card.border[0], card.border[1], card.border[2]);
                doc.roundedRect(cx, y, scW, ch, 3, 3, 'FD');
                this._setFont(doc, 'bold');
                doc.setFontSize(11);
                doc.setTextColor(card.textColor[0], card.textColor[1], card.textColor[2]);
                doc.text(card.value, cx + scW / 2, y + 8, { align: 'center' });
                this._setFont(doc, 'normal');
                doc.setFontSize(6.5);
                doc.setTextColor(card.labelColor[0], card.labelColor[1], card.labelColor[2]);
                doc.text(card.label, cx + scW / 2, y + 14.5, { align: 'center' });
            });
            y += 24;

            // ─── Main Table ─────────────────────────
            const tableRows = workers.map(w => {
                let data;
                if (w.employmentType === 'daily') data = Salary.calculateDailyWorker(w.id, year, mon - 1);
                else data = Salary.calculateMonthlyWorker(w.id, year, mon - 1);

                const tDays = data.fullDays + data.halfDays + data.paidLeaves + data.unpaidLeaves + data.absentDays;
                const allEarned = Salary.calculateWorkerEarnings(w.id);
                const wrkPay = allPayts.filter(p => p.workerId === w.id).reduce((s, p) => s + p.amount, 0);
                const dueAmt = Math.max(0, allEarned - wrkPay);

                return [
                    w.name,
                    `${tDays}/${Utils.getDaysInMonth(year, mon - 1)}`,
                    data.totalOvertimeHours > 0 ? `${data.totalOvertimeHours.toFixed(1)}h` : '—',
                    Utils.formatCurrency(data.earned),
                    Utils.formatCurrency(wrkPay),
                    dueAmt > 0 ? Utils.formatCurrency(dueAmt) : 'Settled'
                ];
            });

            const tblHeaders = [
                'Name',
                'Work Days',
                'Overtime',
                'Total Earned',
                'Paid',
                'Due'
            ];

            doc.autoTable({
                startY: y,
                head: [tblHeaders],
                body: tableRows,
                theme: 'grid',
                headStyles: { fillColor: [27, 54, 93], textColor: [255, 255, 255], font: this._fontName, fontStyle: 'bold', fontSize: 8 },
                bodyStyles: { font: this._fontName, fontSize: 7.5, cellPadding: 1.5 },
                alternateRowStyles: { fillColor: [248, 250, 255] },
                columnStyles: {
                    0: { cellWidth: 50 },
                    1: { cellWidth: 25, halign: 'center' },
                    2: { cellWidth: 28, halign: 'center' },
                    3: { cellWidth: 28, halign: 'right' },
                    4: { cellWidth: 24, halign: 'right' },
                    5: { cellWidth: 24, halign: 'right' }
                },
                styles: { font: this._fontName, lineColor: [220, 220, 220], lineWidth: 0.1 },
                margin: { top: 48, bottom: 35, left: 15, right: 15 },
                pageBreak: 'auto',
                rowPageBreak: 'avoid',
                showHead: 'everyPage',
                willDrawPage: () => { this._stampPadBg(doc); }
            });
            y = doc.lastAutoTable.finalY + 10;

            // ─── Final Totals ─────────────────────
            if (y > 220) { doc.addPage(); this._stampPadBg(doc); y = 48; }

            doc.setDrawColor(27, 54, 93);
            doc.setFillColor(245, 248, 255);
            doc.roundedRect(20, y, 170, 30, 4, 4, 'FD');

            this._setFont(doc, 'bold');
            doc.setFontSize(10);
            doc.setTextColor(50);
            doc.text('SUMMARY', 105, y + 7, { align: 'center' });

            this._setFont(doc, 'normal');
            doc.setFontSize(9);
            doc.setTextColor(60);
            doc.text(`Total Workers: ${workers.length}`, 30, y + 15);
            doc.text(`Total Salary: ${Utils.formatCurrency(grandEarned)}`, 30, y + 22);
            doc.text(`Total Paid: ${Utils.formatCurrency(grandPaid)}`, 120, y + 15);
            this._setFont(doc, 'bold');
            doc.setTextColor(219, 68, 55);
            doc.text(`Total Due: ${Utils.formatCurrency(grandDue)}`, 120, y + 22);

            // ─── Signatures ─────────────────────────
            this._drawSignatures(doc, y + 36);

            await this._saveWithLetterhead(doc, `US_BENGOL_All_Workers_${month}.pdf`);
            UI.toast('All workers PDF report downloaded!', 'success');

        } catch (err) {
            console.error('PDF generation error:', err);
            UI.toast('Failed to generate PDF!', 'error');
        }
    },

    /* ═══════════════════════════════════════════════
       CUSTOM LETTERHEAD DOCUMENT (QUOTATION, INVOICE, PAD)
       ═══════════════════════════════════════════════ */
    async generateDocumentPDF(docData) {
        if (typeof window.jspdf === 'undefined' || typeof window.jspdf.jsPDF !== 'function') {
            UI.toast('jsPDF লাইব্রেরি লোড হয়নি!', 'error');
            return;
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'a4');

        await this._ensureFont(doc);
        this._stampPadBg(doc);

        const leftX = 18;
        const rightX = 192;
        const contentW = rightX - leftX; // 174 mm

        let y = 48;

        // 1. Document Title & Subtitle
        this._setFont(doc, 'bold');
        doc.setFontSize(13);
        doc.setTextColor(27, 54, 93); // US BENGOL Navy Blue
        doc.text(docData.title || 'QUOTATION / দরপত্র', 105, y, { align: 'center' });
        y += 5.5;

        if (docData.subtitle) {
            this._setFont(doc, 'normal');
            doc.setFontSize(9);
            doc.setTextColor(80, 80, 80);
            doc.text(docData.subtitle, 105, y, { align: 'center' });
            y += 5;
        }

        // Horizontal green rule
        doc.setDrawColor(0, 136, 82); // US BENGOL Green
        doc.setLineWidth(0.4);
        doc.line(leftX, y, rightX, y);
        y += 5;

        // 2. Reference & Date
        this._setFont(doc, 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(50, 50, 50);
        doc.text(`স্মারক / Ref: ${docData.refNo || 'UB/DOC/' + Utils.getToday()}`, leftX, y);
        doc.text(`তারিখ / Date: ${docData.date || Utils.getToday()}`, rightX, y, { align: 'right' });
        y += 6;

        // 3. Recipient Information Box
        if (docData.recipient && (docData.recipient.name || docData.recipient.org)) {
            doc.setFillColor(248, 250, 252);
            doc.setDrawColor(220, 226, 235);
            doc.roundedRect(leftX, y, contentW, 18, 2, 2, 'FD');

            doc.setFontSize(8.5);
            doc.setTextColor(40, 40, 40);
            this._setFont(doc, 'bold');
            doc.text(`প্রাপক / To: ${docData.recipient.name || ''}`, leftX + 4, y + 5);
            this._setFont(doc, 'normal');
            if (docData.recipient.org) doc.text(docData.recipient.org, leftX + 4, y + 9);
            if (docData.recipient.address) doc.text(docData.recipient.address, leftX + 4, y + 13);
            if (docData.recipient.phone) doc.text(`মোবাইল: ${docData.recipient.phone}`, rightX - 4, y + 5, { align: 'right' });
            y += 22;
        }

        // 4. Subject
        if (docData.subject) {
            this._setFont(doc, 'bold');
            doc.setFontSize(9.5);
            doc.setTextColor(27, 54, 93);
            doc.text(`বিষয় / Subject: ${docData.subject}`, leftX, y);
            y += 6;
        }

        // 5. Body Text
        if (docData.body) {
            this._setFont(doc, 'normal');
            doc.setFontSize(8.5);
            doc.setTextColor(40, 40, 40);
            const splitBody = doc.splitTextToSize(docData.body, contentW);
            doc.text(splitBody, leftX, y);
            y += splitBody.length * 4.5 + 4;
        }

        // 6. Dynamic Items Table (with auto-overflow, repeated headers)
        if (docData.items && docData.items.length > 0) {
            const tableHeaders = ['ক্রমিক', 'বিবরণ (Description)', 'পরিমাণ (Qty)', 'দর (Rate BDT)', 'মোট (Total BDT)'];
            const tableRows = docData.items.map((item, idx) => [
                String(idx + 1),
                item.desc,
                `${item.qty} ${item.unit || ''}`.trim(),
                Number(item.rate || 0).toLocaleString('en-US', { minimumFractionDigits: 2 }),
                Number(item.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })
            ]);

            doc.autoTable({
                startY: y,
                head: [tableHeaders],
                body: tableRows,
                theme: 'grid',
                headStyles: {
                    fillColor: [27, 54, 93],
                    textColor: [255, 255, 255],
                    font: this._fontName,
                    fontStyle: 'bold',
                    fontSize: 8,
                    halign: 'center'
                },
                bodyStyles: {
                    font: this._fontName,
                    fontSize: 7.5,
                    cellPadding: 1.8,
                    textColor: [40, 40, 40]
                },
                alternateRowStyles: {
                    fillColor: [248, 250, 253]
                },
                columnStyles: {
                    0: { cellWidth: 14, halign: 'center' },
                    1: { cellWidth: 80 },
                    2: { cellWidth: 24, halign: 'center' },
                    3: { cellWidth: 26, halign: 'right' },
                    4: { cellWidth: 30, halign: 'right' }
                },
                styles: { lineColor: [220, 226, 235], lineWidth: 0.1 },
                margin: { top: 48, bottom: 35, left: leftX, right: 18 },
                pageBreak: 'auto',
                rowPageBreak: 'avoid',
                showHead: 'everyPage',
                willDrawPage: () => {
                    this._stampPadBg(doc);
                }
            });

            y = doc.lastAutoTable.finalY + 4;

            // Totals Box
            if (y > 225) {
                doc.addPage();
                this._stampPadBg(doc);
                y = 48;
            }

            const subtotal = docData.items.reduce((s, it) => s + (Number(it.total) || 0), 0);
            const discount = Number(docData.discount) || 0;
            const vat = Number(docData.vat) || 0;
            const grandTotal = subtotal + vat - discount;

            const totBoxW = 75;
            const totBoxX = rightX - totBoxW;

            doc.setDrawColor(220, 226, 235);
            doc.setFillColor(250, 252, 255);
            doc.roundedRect(totBoxX, y, totBoxW, discount > 0 || vat > 0 ? 24 : 16, 2, 2, 'FD');

            let ty = y + 4.5;
            this._setFont(doc, 'normal');
            doc.setFontSize(8);
            doc.setTextColor(60, 60, 60);
            doc.text('উপ-মোট / Subtotal:', totBoxX + 4, ty);
            doc.text(subtotal.toLocaleString('en-US', { minimumFractionDigits: 2 }), rightX - 4, ty, { align: 'right' });

            if (discount > 0) {
                ty += 4;
                doc.text('ছাড় / Discount:', totBoxX + 4, ty);
                doc.text(`- ${discount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, rightX - 4, ty, { align: 'right' });
            }
            if (vat > 0) {
                ty += 4;
                doc.text('ভ্যাট / VAT:', totBoxX + 4, ty);
                doc.text(`+ ${vat.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, rightX - 4, ty, { align: 'right' });
            }

            ty += 2;
            doc.setDrawColor(0, 136, 82);
            doc.setLineWidth(0.3);
            doc.line(totBoxX + 2, ty, rightX - 2, ty);
            ty += 4.5;

            this._setFont(doc, 'bold');
            doc.setFontSize(9);
            doc.setTextColor(27, 54, 93);
            doc.text('সর্বমোট / Grand Total:', totBoxX + 4, ty);
            doc.text(`${grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })} BDT`, rightX - 4, ty, { align: 'right' });

            y = ty + 8;
        }

        // 7. Terms & Conditions
        if (docData.notes) {
            if (y > 230) {
                doc.addPage();
                this._stampPadBg(doc);
                y = 48;
            }
            this._setFont(doc, 'bold');
            doc.setFontSize(8);
            doc.setTextColor(60, 60, 60);
            doc.text('শর্তাবলী / Terms & Conditions:', leftX, y);
            y += 4;
            this._setFont(doc, 'normal');
            doc.setFontSize(7.5);
            doc.setTextColor(70, 70, 70);
            const splitNotes = doc.splitTextToSize(docData.notes, contentW);
            doc.text(splitNotes, leftX, y);
            y += splitNotes.length * 3.8 + 6;
        }

        // 8. Signatures Section
        if (y > 235) {
            doc.addPage();
            this._stampPadBg(doc);
            y = 48;
        }
        const sigY = Math.max(y + 8, 238);
        doc.setDrawColor(180, 180, 180);
        doc.setLineWidth(0.3);
        doc.line(leftX, sigY, leftX + 48, sigY);
        doc.line(rightX - 48, sigY, rightX, sigY);

        this._setFont(doc, 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(70, 70, 70);
        doc.text(docData.preparedBy || 'প্রস্তুতকারক / Prepared By', leftX + 24, sigY + 4, { align: 'center' });
        doc.text(docData.authorizedBy || 'অনুমোদনকারী / Authorized Signatory', rightX - 24, sigY + 4, { align: 'center' });

        const safeFilename = `${docData.refNo || 'US_BENGOL_Doc'}`.replace(/[/\\?%*:|"<>]/g, '_') + '.pdf';
        await this._saveWithLetterhead(doc, safeFilename);
        UI.toast('অফিসিয়াল প্যাড PDF ডাউনলোড সম্পন্ন হয়েছে!', 'success');
    }
};


/* ==================== COMPANY DOCUMENTS MODULE ====================
   Official US BENGOL Quotations, Invoices, Letters & Notices Builder
   ================================================================== */
const CompanyDocuments = {
    _currentDoc: null,

    init() {
        this.bindEvents();
        this.seedSamplesIfEmpty();
        this.renderList();
        this.renderSavedList();
    },

    seedSamplesIfEmpty() {
        const docs = DB.getDocuments();
        if (docs.length === 0) {
            const sampleQuotation = {
                id: 'sample-qt-01',
                type: 'quotation',
                refNo: 'UB/QT/2026/0088',
                date: Utils.getToday(),
                title: 'COMMERCIAL QUOTATION / বাণিজ্যিক দরপত্র',
                subtitle: 'Metal, Electrical & Gas Supply Solutions',
                recipient: {
                    name: 'জনাব মোহাম্মদ মোস্তফা কামাল (প্রজেক্ট ডিরেক্টর)',
                    org: 'মেঘনা টেক্সটাইল অ্যান্ড স্টিল লিমিটেড',
                    address: 'প্লট ৪২, সিইপিজেড শিল্প এলাকা, চট্টগ্রাম',
                    phone: '+8801711 234567'
                },
                subject: 'কারখানা আধুনিকায়ন প্রকল্পের জন্য মেটাল ও ইলেকট্রিক সামগ্রী সরবরাহ দরপত্র',
                body: 'সম্মানিত মহোদয়, আপনার পত্র নং MT-459 এর প্রেক্ষিতে আমরা অত্যন্ত আনন্দের সাথে আপনার চাহিদামাফিক মালামালের বিস্তারিত বিবরণ এবং সর্বনিম্ন মূল্যতালিকা নিচে উপস্থাপন করছি। আমরা আন্তর্জাতিক মানসম্পন্ন পণ্য সরবরাহে প্রতিশ্রুতিবদ্ধ।',
                items: [
                    { desc: 'হাই-প্রেসার গ্যাস রেগুলেটর ভালভ (Model: G-204)', qty: 5, unit: 'Pcs', rate: 4500, total: 22500 },
                    { desc: 'হেভি-ডিউটি কপার কেবল (3Core 16sqmm - 100m Roll)', qty: 8, unit: 'Rolls', rate: 18500, total: 148000 },
                    { desc: 'এসএস মেটাল পাইপ (Grade 304, 2-inch, 20ft)', qty: 25, unit: 'Pcs', rate: 3200, total: 80000 },
                    { desc: 'ইন্ডাস্ট্রিয়াল গ্যাস ফ্লো-মিটার সেন্সর', qty: 2, unit: 'Sets', rate: 38000, total: 76000 },
                    { desc: 'সার্কিট ব্রেকার ও কন্ট্রোল প্যানেল বক্স (IP65)', qty: 4, unit: 'Units', rate: 12500, total: 50000 }
                ],
                discount: 5000,
                vat: 0,
                notes: '১. এই দরপত্রের মেয়াদ ইস্যু তারিখ হতে ৩০ দিন পর্যন্ত বলবৎ থাকবে।\n২. মালামাল চট্টগ্রাম সাইটে পৌঁছানোর পরিবহন খরচ কোম্পানি বহন করবে।\n৩. কার্যাদেশ প্রাপ্তির ১৫ কার্যদিবসের মধ্যে সরবরাহ সম্পন্ন হবে।\n৪. পরিশোধের শর্তাবলী: ৫০% অগ্রিম এবং অবশিষ্ট ৫০% মালামাল বুঝে পাওয়ার পর চেকে মারফত।',
                preparedBy: 'ইঞ্জিনিয়ার মারজান (বিক্রয় ও প্রকল্প)',
                authorizedBy: 'ব্যবস্থাপনা পরিচালক, US BENGOL'
            };

            const sampleNotice = {
                id: 'sample-nt-01',
                type: 'notice',
                refNo: 'UB/ADM/2026/014',
                date: Utils.getToday(),
                title: 'OFFICIAL NOTICE / নোটিশ',
                subtitle: 'US BENGOL Internal Office Communication',
                recipient: {
                    name: 'সকল বিভাগীয় প্রধান ও কর্মকর্তা-কর্মচারী',
                    org: 'US BENGOL Manufacturing & Operations',
                    address: 'উত্তরা ও টঙ্গী কারখানা শাখা, ঢাকা',
                    phone: '+8801921 692008'
                },
                subject: 'কারখানা নিরাপত্তা ও হাজিরা সংক্রান্ত নির্দেশনা',
                body: 'এতদ্বারা US BENGOL-এর সকল কর্মকর্তা ও কর্মচারীকে জানানো যাচ্ছে যে, আগামী ১৫ অক্টোবর ২০২৬ তারিখ থেকে নতুন ডিজিটাল হাজিরা সিস্টেমে এবং সুরক্ষা প্রটোকল কার্যকর হবে। নির্ধারিত কর্মসময়ের মধ্যে ডিজিটাল হাজিরা সম্পন্ন করতে সকলকে অনুরোধ করা হচ্ছে।',
                items: [],
                discount: 0,
                vat: 0,
                notes: '১. সকল শাখা ব্যবস্থাপক নিশ্চিত করবেন।\n২. জরুরি প্রয়োজনে প্রধান কার্যালয়ে যোগাযোগ করুন।',
                preparedBy: 'প্রশাসন বিভাগ, US BENGOL',
                authorizedBy: 'ব্যবস্থাপনা পরিচালক, US BENGOL'
            };

            DB.addDocument(sampleQuotation);
            DB.addDocument(sampleNotice);
        }
    },

    bindEvents() {
        const btnOpen = document.getElementById('btn-open-doc-builder');
        if (btnOpen) btnOpen.addEventListener('click', () => this.openBuilder());

        const btnAdd = document.getElementById('btn-add-doc-item');
        if (btnAdd) btnAdd.addEventListener('click', () => this.addItemRow());

        const form = document.getElementById('form-doc-builder');
        if (form) form.addEventListener('submit', (e) => this.saveFromForm(e));

        const btnPreview = document.getElementById('btn-preview-doc');
        if (btnPreview) btnPreview.addEventListener('click', () => this.previewCurrentForm());

        const btnDirect = document.getElementById('btn-download-doc-direct');
        if (btnDirect) btnDirect.addEventListener('click', () => this.downloadDirectFromForm());

        const btnDownloadPreview = document.getElementById('btn-download-from-preview');
        if (btnDownloadPreview) btnDownloadPreview.addEventListener('click', () => {
            if (this._currentDoc) Reports.generateDocumentPDF(this._currentDoc);
        });

        // Modal Discount & VAT live changes
        const discInput = document.getElementById('doc-discount');
        if (discInput) discInput.addEventListener('input', () => this.calculateTotals());
        const vatInput = document.getElementById('doc-vat');
        if (vatInput) vatInput.addEventListener('input', () => this.calculateTotals());

        // Modal Type change auto title
        const typeSelect = document.getElementById('doc-type');
        if (typeSelect) {
            typeSelect.addEventListener('change', (e) => {
                const titleInput = document.getElementById('doc-title');
                const t = e.target.value;
                if (t === 'quotation') titleInput.value = 'COMMERCIAL QUOTATION / বাণিজ্যিক দরপত্র';
                else if (t === 'invoice') titleInput.value = 'OFFICIAL INVOICE / চালান ও বিল';
                else if (t === 'letter') titleInput.value = 'OFFICIAL LETTER / অফিসিয়াল পত্র';
                else if (t === 'notice') titleInput.value = 'OFFICIAL NOTICE / নোটিশ';
            });
        }

        // ==================== Dedicated Quotation Page Events (#page-quotation) ====================
        const pageForm = document.getElementById('form-page-quotation');
        if (pageForm) {
            pageForm.addEventListener('submit', (e) => this.saveAndGeneratePage(e));
        }

        const btnPqNew = document.getElementById('btn-pq-new');
        if (btnPqNew) btnPqNew.addEventListener('click', () => this.resetPageForm());

        const btnPqReset = document.getElementById('btn-pq-reset');
        if (btnPqReset) btnPqReset.addEventListener('click', () => this.resetPageForm());

        const btnPqSaveOnly = document.getElementById('btn-pq-save-only');
        if (btnPqSaveOnly) btnPqSaveOnly.addEventListener('click', () => this.savePageOnly());

        const btnPqPreviewTop = document.getElementById('btn-pq-preview-top');
        if (btnPqPreviewTop) btnPqPreviewTop.addEventListener('click', () => this.previewPageForm());

        const btnPqPreviewBottom = document.getElementById('btn-pq-preview-bottom');
        if (btnPqPreviewBottom) btnPqPreviewBottom.addEventListener('click', () => this.previewPageForm());

        const btnPqAddItem = document.getElementById('btn-pq-add-item');
        if (btnPqAddItem) btnPqAddItem.addEventListener('click', () => this.addPageItemRow());

        // Page Discount & VAT live calculation
        const pqDiscInput = document.getElementById('pq-discount');
        if (pqDiscInput) pqDiscInput.addEventListener('input', () => this.calculatePageTotals());
        const pqVatInput = document.getElementById('pq-vat');
        if (pqVatInput) pqVatInput.addEventListener('input', () => this.calculatePageTotals());

        // Page Type change auto title
        const pqTypeSelect = document.getElementById('pq-doc-type');
        if (pqTypeSelect) {
            pqTypeSelect.addEventListener('change', (e) => {
                const titleInput = document.getElementById('pq-doc-title');
                const t = e.target.value;
                if (t === 'quotation') titleInput.value = 'COMMERCIAL QUOTATION / বাণিজ্যিক দরপত্র';
                else if (t === 'invoice') titleInput.value = 'OFFICIAL INVOICE / চালান ও বিল';
                else if (t === 'letter') titleInput.value = 'OFFICIAL LETTER / অফিসিয়াল পত্র';
                else if (t === 'notice') titleInput.value = 'OFFICIAL NOTICE / নোটিশ';
            });
        }
    },

    openBuilder(docId = null) {
        const form = document.getElementById('form-doc-builder');
        if (!form) return;
        form.reset();
        document.getElementById('doc-items-container').innerHTML = '';

        if (docId) {
            const doc = DB.getDocument(docId);
            if (doc) {
                document.getElementById('doc-id').value = doc.id;
                document.getElementById('doc-type').value = doc.type || 'quotation';
                document.getElementById('doc-ref').value = doc.refNo || '';
                document.getElementById('doc-date').value = doc.date || Utils.getToday();
                document.getElementById('doc-title').value = doc.title || '';
                document.getElementById('doc-subtitle').value = doc.subtitle || '';
                if (doc.recipient) {
                    document.getElementById('doc-recipient-name').value = doc.recipient.name || '';
                    document.getElementById('doc-recipient-org').value = doc.recipient.org || '';
                    document.getElementById('doc-recipient-address').value = doc.recipient.address || '';
                    document.getElementById('doc-recipient-phone').value = doc.recipient.phone || '';
                }
                document.getElementById('doc-subject').value = doc.subject || '';
                document.getElementById('doc-body').value = doc.body || '';
                document.getElementById('doc-discount').value = doc.discount || 0;
                document.getElementById('doc-vat').value = doc.vat || 0;
                document.getElementById('doc-notes').value = doc.notes || '';
                document.getElementById('doc-prepared-by').value = doc.preparedBy || '';
                document.getElementById('doc-authorized-by').value = doc.authorizedBy || '';

                if (doc.items && doc.items.length > 0) {
                    doc.items.forEach(it => this.addItemRow(it));
                } else {
                    this.addItemRow();
                }
                this.calculateTotals();
                UI.openModal('modal-doc-builder');
                return;
            }
        }

        // New Document
        document.getElementById('doc-id').value = '';
        document.getElementById('doc-type').value = 'quotation';
        document.getElementById('doc-ref').value = `UB/QT/${new Date().getFullYear()}/${String(Math.floor(Math.random() * 900) + 100)}`;
        document.getElementById('doc-date').value = Utils.getToday();
        document.getElementById('doc-title').value = 'COMMERCIAL QUOTATION / বাণিজ্যিক দরপত্র';
        document.getElementById('doc-subtitle').value = 'Metal, Electrical & Gas Supply Solutions';
        document.getElementById('doc-prepared-by').value = 'ইঞ্জিনিয়ার মারজান';
        document.getElementById('doc-authorized-by').value = 'ব্যবস্থাপনা পরিচালক, US BENGOL';
        document.getElementById('doc-discount').value = 0;
        document.getElementById('doc-vat').value = 0;

        this.addItemRow();
        this.addItemRow();
        this.calculateTotals();
        UI.openModal('modal-doc-builder');
    },

    addItemRow(item = null) {
        const container = document.getElementById('doc-items-container');
        if (!container) return;

        const row = document.createElement('div');
        row.className = 'doc-item-row';
        row.innerHTML = `
            <div style="flex:3;">
                <input type="text" class="item-desc" placeholder="পণ্যের বিবরণ *" value="${item ? (item.desc || '') : ''}" required>
            </div>
            <div style="flex:1;">
                <input type="number" class="item-qty" placeholder="পরিমাণ" value="${item ? (item.qty || 1) : 1}" min="0" step="any" required>
            </div>
            <div style="flex:1;">
                <input type="text" class="item-unit" placeholder="একক (Pcs/Kg)" value="${item ? (item.unit || 'Pcs') : 'Pcs'}">
            </div>
            <div style="flex:1.5;">
                <input type="number" class="item-rate" placeholder="দর (BDT)" value="${item ? (item.rate || 0) : 0}" min="0" step="any" required>
            </div>
            <div style="flex:1.5; display:flex; align-items:center; justify-content:flex-end;">
                <span class="item-total-display" style="font-weight:600; font-size:13px; color:var(--text-primary); margin-right:8px;">0.00</span>
                <button type="button" class="btn-remove-row" style="background:none; border:none; color:var(--danger); cursor:pointer; font-size:16px; padding:2px 6px;">&times;</button>
            </div>
        `;

        const qtyInput = row.querySelector('.item-qty');
        const rateInput = row.querySelector('.item-rate');
        const updateRowTotal = () => {
            const q = parseFloat(qtyInput.value) || 0;
            const r = parseFloat(rateInput.value) || 0;
            const tot = q * r;
            row.querySelector('.item-total-display').textContent = tot.toLocaleString('en-US', { minimumFractionDigits: 2 });
            this.calculateTotals();
        };

        qtyInput.addEventListener('input', updateRowTotal);
        rateInput.addEventListener('input', updateRowTotal);

        row.querySelector('.btn-remove-row').addEventListener('click', () => {
            row.remove();
            this.calculateTotals();
        });

        container.appendChild(row);
        updateRowTotal();
    },

    calculateTotals() {
        const rows = document.querySelectorAll('.doc-item-row');
        let subtotal = 0;
        rows.forEach(r => {
            const q = parseFloat(r.querySelector('.item-qty').value) || 0;
            const rt = parseFloat(r.querySelector('.item-rate').value) || 0;
            subtotal += (q * rt);
        });

        const disc = parseFloat(document.getElementById('doc-discount')?.value) || 0;
        const vat = parseFloat(document.getElementById('doc-vat')?.value) || 0;
        const grandTotal = Math.max(0, subtotal + vat - disc);

        const subEl = document.getElementById('doc-calc-subtotal');
        if (subEl) subEl.textContent = `${subtotal.toLocaleString('en-US', { minimumFractionDigits: 2 })} BDT`;

        const grandEl = document.getElementById('doc-calc-grand-total');
        if (grandEl) grandEl.textContent = `${grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })} BDT`;
    },

    _getFormData() {
        const id = document.getElementById('doc-id').value;
        const items = [];
        document.querySelectorAll('.doc-item-row').forEach(r => {
            const desc = r.querySelector('.item-desc').value.trim();
            const qty = parseFloat(r.querySelector('.item-qty').value) || 0;
            const unit = r.querySelector('.item-unit').value.trim();
            const rate = parseFloat(r.querySelector('.item-rate').value) || 0;
            if (desc) {
                items.push({ desc, qty, unit, rate, total: qty * rate });
            }
        });

        return {
            id: id || undefined,
            type: document.getElementById('doc-type').value,
            refNo: document.getElementById('doc-ref').value.trim(),
            date: document.getElementById('doc-date').value,
            title: document.getElementById('doc-title').value.trim(),
            subtitle: document.getElementById('doc-subtitle').value.trim(),
            recipient: {
                name: document.getElementById('doc-recipient-name').value.trim(),
                org: document.getElementById('doc-recipient-org').value.trim(),
                address: document.getElementById('doc-recipient-address').value.trim(),
                phone: document.getElementById('doc-recipient-phone').value.trim()
            },
            subject: document.getElementById('doc-subject').value.trim(),
            body: document.getElementById('doc-body').value.trim(),
            items,
            discount: parseFloat(document.getElementById('doc-discount').value) || 0,
            vat: parseFloat(document.getElementById('doc-vat').value) || 0,
            notes: document.getElementById('doc-notes').value.trim(),
            preparedBy: document.getElementById('doc-prepared-by').value.trim(),
            authorizedBy: document.getElementById('doc-authorized-by').value.trim()
        };
    },

    saveFromForm(e) {
        if (e) e.preventDefault();
        const data = this._getFormData();
        if (data.id) {
            DB.updateDocument(data.id, data);
            UI.toast('ডকুমেন্ট সফলভাবে আপডেট হয়েছে!', 'success');
        } else {
            DB.addDocument(data);
            UI.toast('নতুন ডকুমেন্ট সফলভাবে সংরক্ষিত হয়েছে!', 'success');
        }
        UI.closeModal('modal-doc-builder');
        this.renderList();
    },

    previewCurrentForm() {
        const data = this._getFormData();
        this.previewDocument(data);
    },

    downloadDirectFromForm() {
        const data = this._getFormData();
        Reports.generateDocumentPDF(data);
    },

    previewDocument(docData) {
        this._currentDoc = docData;
        const container = document.getElementById('doc-preview-sheets-container');
        if (!container) return;

        const subtotal = (docData.items || []).reduce((s, it) => s + (it.total || 0), 0);
        const grandTotal = subtotal + (docData.vat || 0) - (docData.discount || 0);

        const itemsHtml = (docData.items && docData.items.length > 0) ? `
            <table class="pad-preview-table" style="width:100%; border-collapse:collapse; margin-top:12px; font-size:12px;">
                <thead>
                    <tr style="background:#1b365d; color:#ffffff; text-align:center;">
                        <th style="padding:6px; border:1px solid #cbd5e1; width:35px;">ক্রমিক</th>
                        <th style="padding:6px; border:1px solid #cbd5e1; text-align:left;">বিবরণ</th>
                        <th style="padding:6px; border:1px solid #cbd5e1; width:70px;">পরিমাণ</th>
                        <th style="padding:6px; border:1px solid #cbd5e1; width:80px; text-align:right;">দর (BDT)</th>
                        <th style="padding:6px; border:1px solid #cbd5e1; width:90px; text-align:right;">মোট (BDT)</th>
                    </tr>
                </thead>
                <tbody>
                    ${docData.items.map((it, idx) => `
                        <tr style="background:${idx % 2 === 0 ? '#ffffff' : '#f8fafc'}; color:#334155;">
                            <td style="padding:5px; border:1px solid #e2e8f0; text-align:center;">${idx + 1}</td>
                            <td style="padding:5px; border:1px solid #e2e8f0;">${it.desc}</td>
                            <td style="padding:5px; border:1px solid #e2e8f0; text-align:center;">${it.qty} ${it.unit || ''}</td>
                            <td style="padding:5px; border:1px solid #e2e8f0; text-align:right;">${Number(it.rate).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                            <td style="padding:5px; border:1px solid #e2e8f0; text-align:right; font-weight:600;">${Number(it.total).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            <div style="display:flex; justify-content:flex-end; margin-top:8px;">
                <div style="width:250px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:4px; padding:8px; font-size:12px;">
                    <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                        <span>উপ-মোট / Subtotal:</span>
                        <span>${subtotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    </div>
                    ${docData.discount > 0 ? `
                        <div style="display:flex; justify-content:space-between; margin-bottom:4px; color:#e11d48;">
                            <span>ছাড় / Discount:</span>
                            <span>- ${Number(docData.discount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                        </div>
                    ` : ''}
                    ${docData.vat > 0 ? `
                        <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                            <span>ভ্যাট / VAT:</span>
                            <span>+ ${Number(docData.vat).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                        </div>
                    ` : ''}
                    <div style="display:flex; justify-content:space-between; padding-top:4px; border-top:1px solid #008852; font-weight:bold; color:#1b365d; font-size:13px;">
                        <span>সর্বমোট / Grand Total:</span>
                        <span>${grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })} BDT</span>
                    </div>
                </div>
            </div>
        ` : '';

        const bgUrl = (typeof window !== 'undefined' && window.US_BENGOL_PAD_BG) ? window.US_BENGOL_PAD_BG : 'assets/pad_background.png';

        container.innerHTML = `
            <div class="pad-preview-sheet" style="background-image:url('${bgUrl}'); background-size:100% 100%; background-repeat:no-repeat; box-shadow:0 10px 25px rgba(0,0,0,0.3); margin:0 auto 20px auto; position:relative; background-color:#ffffff;">
                <div class="pad-preview-body-zone">
                    <div style="text-align:center; margin-bottom:6px;">
                        <h2 style="font-size:18px; color:#1b365d; margin:0 0 4px 0; font-weight:700;">${docData.title}</h2>
                        ${docData.subtitle ? `<p style="font-size:11px; color:#64748b; margin:0;">${docData.subtitle}</p>` : ''}
                        <div style="height:2px; background:#008852; margin:6px auto 10px auto; width:100%;"></div>
                    </div>

                    <div style="display:flex; justify-content:space-between; font-size:11px; color:#475569; margin-bottom:10px;">
                        <span><strong>স্মারক / Ref:</strong> ${docData.refNo}</span>
                        <span><strong>তারিখ / Date:</strong> ${docData.date}</span>
                    </div>

                    ${(docData.recipient && (docData.recipient.name || docData.recipient.org)) ? `
                        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:4px; padding:8px 12px; margin-bottom:10px; font-size:11px;">
                            <div style="display:flex; justify-content:space-between;">
                                <div>
                                    <strong style="color:#1e293b;">প্রাপক / To: ${docData.recipient.name || ''}</strong>
                                    ${docData.recipient.org ? `<div>${docData.recipient.org}</div>` : ''}
                                    ${docData.recipient.address ? `<div>${docData.recipient.address}</div>` : ''}
                                </div>
                                ${docData.recipient.phone ? `<div style="color:#475569;">মোবাইল: ${docData.recipient.phone}</div>` : ''}
                            </div>
                        </div>
                    ` : ''}

                    ${docData.subject ? `
                        <div style="font-size:13px; font-weight:700; color:#1b365d; margin-bottom:8px;">
                            বিষয় / Subject: ${docData.subject}
                        </div>
                    ` : ''}

                    ${docData.body ? `
                        <div style="font-size:11.5px; line-height:1.6; color:#334155; margin-bottom:10px; white-space:pre-wrap;">
                            ${docData.body}
                        </div>
                    ` : ''}

                    ${itemsHtml}

                    ${docData.notes ? `
                        <div style="margin-top:12px; font-size:11px; color:#64748b; background:#fafafa; border-left:3px solid #008852; padding:6px 10px;">
                            <strong>শর্তাবলী / Terms & Conditions:</strong>
                            <div style="white-space:pre-wrap; margin-top:2px;">${docData.notes}</div>
                        </div>
                    ` : ''}

                    <div style="display:flex; justify-content:space-between; margin-top:40px; padding:0 20px;">
                        <div style="text-align:center; border-top:1px solid #94a3b8; width:160px; padding-top:4px; font-size:11px; color:#475569;">
                            ${docData.preparedBy || 'প্রস্তুতকারক / Prepared By'}
                        </div>
                        <div style="text-align:center; border-top:1px solid #94a3b8; width:160px; padding-top:4px; font-size:11px; color:#475569;">
                            ${docData.authorizedBy || 'অনুমোদনকারী / Authorized Signatory'}
                        </div>
                    </div>
                </div>
            </div>
        `;

        UI.openModal('modal-doc-preview');
    },

    renderList() {
        const container = document.getElementById('documents-list-container');
        if (!container) return;

        const docs = DB.getDocuments();
        if (docs.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="padding:24px; text-align:center; color:var(--text-secondary);">
                    <p>কোনো সংরক্ষিত ডকুমেন্ট নেই। উপরের "+ নতুন ডকুমেন্ট" বোতামে ক্লিক করুন।</p>
                </div>
            `;
            return;
        }

        const typeLabels = {
            quotation: 'বাণিজ্যিক দরপত্র',
            invoice: 'বিল / ইনভয়েস',
            letter: 'অফিসিয়াল চিঠি',
            notice: 'নোটিশ'
        };

        const typeBadges = {
            quotation: 'badge-primary',
            invoice: 'badge-success',
            letter: 'badge-info',
            notice: 'badge-warning'
        };

        container.innerHTML = `
            <table class="data-table documents-table" style="width:100%; border-collapse:collapse;">
                <thead>
                    <tr>
                        <th>স্মারক / Ref</th>
                        <th>ধরন</th>
                        <th>শিরোনাম ও প্রাপক</th>
                        <th>তারিখ</th>
                        <th style="text-align:right;">অ্যাকশন</th>
                    </tr>
                </thead>
                <tbody>
                    ${docs.map(d => {
                        const recName = d.recipient?.name || d.recipient?.org || 'সাধারণ';
                        return `
                            <tr>
                                <td><strong style="color:var(--primary);">${d.refNo}</strong></td>
                                <td><span class="badge ${typeBadges[d.type] || 'badge-primary'}">${typeLabels[d.type] || d.type}</span></td>
                                <td>
                                    <div style="font-weight:600; font-size:13px;">${d.title}</div>
                                    <div style="font-size:11px; color:var(--text-secondary);">${recName}</div>
                                </td>
                                <td><small>${d.date}</small></td>
                                <td style="text-align:right; white-space:nowrap;">
                                    <button class="btn btn-xs btn-outline" onclick="CompanyDocuments.previewById('${d.id}')" title="প্রিভিউ">
                                        প্রিভিউ
                                    </button>
                                    <button class="btn btn-xs btn-primary" onclick="CompanyDocuments.downloadById('${d.id}')" title="PDF ডাউনলোড">
                                        PDF
                                    </button>
                                    <button class="btn btn-xs btn-outline" onclick="CompanyDocuments.openBuilder('${d.id}')" title="এডিট">
                                        এডিট
                                    </button>
                                    <button class="btn btn-xs btn-danger" onclick="CompanyDocuments.deleteById('${d.id}')" title="মুছুন">
                                        &times;
                                    </button>
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;
    },

    previewById(id) {
        const doc = DB.getDocument(id);
        if (doc) this.previewDocument(doc);
    },

    downloadById(id) {
        const doc = DB.getDocument(id);
        if (doc) Reports.generateDocumentPDF(doc);
    },

    _escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    },

    renderPage() {
        const refInput = document.getElementById('pq-doc-ref');
        if (refInput && !refInput.value.trim()) {
            refInput.value = `UB/QT/${new Date().getFullYear()}/${String(Math.floor(Math.random() * 900) + 100)}`;
        }

        const dateInput = document.getElementById('pq-doc-date');
        if (dateInput && !dateInput.value) {
            dateInput.value = Utils.getToday();
        }

        const container = document.getElementById('pq-items-container');
        if (container && container.children.length === 0) {
            this.addPageItemRow();
            this.addPageItemRow();
        }

        this.calculatePageTotals();
        this.renderSavedList();
    },

    resetPageForm() {
        const form = document.getElementById('form-page-quotation');
        if (!form) return;
        form.reset();

        document.getElementById('pq-doc-id').value = '';
        document.getElementById('pq-doc-type').value = 'quotation';
        document.getElementById('pq-doc-ref').value = `UB/QT/${new Date().getFullYear()}/${String(Math.floor(Math.random() * 900) + 100)}`;
        document.getElementById('pq-doc-date').value = Utils.getToday();
        document.getElementById('pq-doc-title').value = 'COMMERCIAL QUOTATION / বাণিজ্যিক দরপত্র';
        document.getElementById('pq-doc-subtitle').value = 'Metal, Electrical & Gas Supply Solutions';
        document.getElementById('pq-recipient-name').value = '';
        document.getElementById('pq-recipient-org').value = '';
        document.getElementById('pq-recipient-address').value = '';
        document.getElementById('pq-recipient-phone').value = '';
        document.getElementById('pq-doc-subject').value = '';
        document.getElementById('pq-doc-body').value = '';
        document.getElementById('pq-discount').value = 0;
        document.getElementById('pq-vat').value = 0;
        document.getElementById('pq-doc-notes').value = '১. এই দরপত্রের মেয়াদ ইস্যু তারিখ হতে ৩০ দিন পর্যন্ত বলবৎ থাকবে।\n২. মালামাল চট্টগ্রাম সাইটে পৌঁছানোর পরিবহন খরচ কোম্পানি বহন করবে।\n৩. কার্যাদেশ প্রাপ্তির ১৫ কার্যদিবসের মধ্যে সরবরাহ সম্পন্ন হবে।\n৪. পরিশোধের শর্তাবলী: ৫০% অগ্রিম এবং অবশিষ্ট ৫০% মালামাল বুঝে পাওয়ার পর চেক মারফত।';
        document.getElementById('pq-prepared-by').value = 'ইঞ্জিনিয়ার মারজান (বিক্রয় ও প্রকল্প)';
        document.getElementById('pq-authorized-by').value = 'ব্যবস্থাপনা পরিচালক, US BENGOL';

        const container = document.getElementById('pq-items-container');
        if (container) {
            container.innerHTML = '';
            this.addPageItemRow();
            this.addPageItemRow();
        }
        this.calculatePageTotals();

        const formCard = document.getElementById('form-page-quotation');
        if (formCard) formCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
        UI.toast('নতুন কোটেশন ফর্ম প্রস্তুত করা হয়েছে', 'info');
    },

    addPageItemRow(item = null) {
        const container = document.getElementById('pq-items-container');
        if (!container) return;

        const row = document.createElement('div');
        row.className = 'pq-item-row';
        row.innerHTML = `
            <div>
                <input type="text" class="pq-item-desc" placeholder="পণ্যের বিবরণ *" value="${item ? (this._escapeHtml(item.desc) || '') : ''}" required style="width:100%; padding:7px 9px; font-size:12.5px;">
            </div>
            <div>
                <input type="number" class="pq-item-qty" placeholder="পরিমাণ" value="${item ? (item.qty || 1) : 1}" min="0" step="any" required style="width:100%; padding:7px 6px; font-size:12.5px; text-align:center;">
            </div>
            <div>
                <input type="text" class="pq-item-unit" placeholder="একক" value="${item ? (this._escapeHtml(item.unit) || 'Pcs') : 'Pcs'}" style="width:100%; padding:7px 6px; font-size:12.5px; text-align:center;">
            </div>
            <div>
                <input type="number" class="pq-item-rate" placeholder="দর" value="${item ? (item.rate || 0) : 0}" min="0" step="any" required style="width:100%; padding:7px 8px; font-size:12.5px; text-align:right;">
            </div>
            <div style="text-align:right; font-weight:600; font-size:13px; color:var(--text-primary);">
                <span class="pq-item-total-display">0.00</span>
            </div>
            <div style="text-align:center;">
                <button type="button" class="btn-remove-pq-row" title="আইটেম মুছুন" style="background:none; border:none; color:var(--danger); cursor:pointer; font-size:18px; line-height:1; padding:2px 4px;">&times;</button>
            </div>
        `;

        const qtyInput = row.querySelector('.pq-item-qty');
        const rateInput = row.querySelector('.pq-item-rate');
        const updateRowTotal = () => {
            const q = parseFloat(qtyInput.value) || 0;
            const r = parseFloat(rateInput.value) || 0;
            const tot = q * r;
            row.querySelector('.pq-item-total-display').textContent = tot.toLocaleString('en-US', { minimumFractionDigits: 2 });
            this.calculatePageTotals();
        };

        qtyInput.addEventListener('input', updateRowTotal);
        rateInput.addEventListener('input', updateRowTotal);

        row.querySelector('.btn-remove-pq-row').addEventListener('click', () => {
            row.remove();
            this.calculatePageTotals();
        });

        container.appendChild(row);
        updateRowTotal();
    },

    calculatePageTotals() {
        const rows = document.querySelectorAll('#pq-items-container .pq-item-row');
        let subtotal = 0;
        rows.forEach(r => {
            const q = parseFloat(r.querySelector('.pq-item-qty').value) || 0;
            const rt = parseFloat(r.querySelector('.pq-item-rate').value) || 0;
            subtotal += (q * rt);
        });

        const disc = parseFloat(document.getElementById('pq-discount')?.value) || 0;
        const vat = parseFloat(document.getElementById('pq-vat')?.value) || 0;
        const grandTotal = Math.max(0, subtotal + vat - disc);

        const subEl = document.getElementById('pq-calc-subtotal');
        if (subEl) subEl.textContent = `${subtotal.toLocaleString('en-US', { minimumFractionDigits: 2 })} BDT`;

        const grandEl = document.getElementById('pq-calc-grand-total');
        if (grandEl) grandEl.textContent = `${grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })} BDT`;
    },

    _getPageFormData() {
        const id = document.getElementById('pq-doc-id').value;
        const items = [];
        document.querySelectorAll('#pq-items-container .pq-item-row').forEach(r => {
            const desc = r.querySelector('.pq-item-desc').value.trim();
            const qty = parseFloat(r.querySelector('.pq-item-qty').value) || 0;
            const unit = r.querySelector('.pq-item-unit').value.trim();
            const rate = parseFloat(r.querySelector('.pq-item-rate').value) || 0;
            if (desc) {
                items.push({ desc, qty, unit, rate, total: qty * rate });
            }
        });

        return {
            id: id || undefined,
            type: document.getElementById('pq-doc-type').value,
            refNo: document.getElementById('pq-doc-ref').value.trim() || `UB/QT/${new Date().getFullYear()}/001`,
            date: document.getElementById('pq-doc-date').value || Utils.getToday(),
            title: document.getElementById('pq-doc-title').value.trim() || 'COMMERCIAL QUOTATION / বাণিজ্যিক দরপত্র',
            subtitle: document.getElementById('pq-doc-subtitle').value.trim(),
            recipient: {
                name: document.getElementById('pq-recipient-name').value.trim(),
                org: document.getElementById('pq-recipient-org').value.trim(),
                address: document.getElementById('pq-recipient-address').value.trim(),
                phone: document.getElementById('pq-recipient-phone').value.trim()
            },
            subject: document.getElementById('pq-doc-subject').value.trim(),
            body: document.getElementById('pq-doc-body').value.trim(),
            items,
            discount: parseFloat(document.getElementById('pq-discount').value) || 0,
            vat: parseFloat(document.getElementById('pq-vat').value) || 0,
            notes: document.getElementById('pq-doc-notes').value.trim(),
            preparedBy: document.getElementById('pq-prepared-by').value.trim(),
            authorizedBy: document.getElementById('pq-authorized-by').value.trim()
        };
    },

    saveAndGeneratePage(e) {
        if (e) e.preventDefault();
        const data = this._getPageFormData();
        if (!data.refNo) {
            UI.toast('দয়া করে রেফারেন্স নম্বর দিন', 'warning');
            return;
        }

        let savedDoc;
        if (data.id) {
            savedDoc = DB.updateDocument(data.id, data);
            UI.toast('কোটেশন সংরক্ষিত হয়েছে! PDF ডাউনলোড হচ্ছে...', 'success');
        } else {
            savedDoc = DB.addDocument(data);
            document.getElementById('pq-doc-id').value = savedDoc.id;
            UI.toast('নতুন কোটেশন সংরক্ষিত হয়েছে! PDF ডাউনলোড হচ্ছে...', 'success');
        }

        this.renderSavedList();
        this.renderList();

        // Direct PDF generation and download on original US BENGOL letterhead
        Reports.generateDocumentPDF(savedDoc);
    },

    savePageOnly() {
        const data = this._getPageFormData();
        if (!data.refNo) {
            UI.toast('দয়া করে রেফারেন্স নম্বর দিন', 'warning');
            return;
        }

        if (data.id) {
            DB.updateDocument(data.id, data);
            UI.toast('কোটেশন সফলভাবে আপডেট হয়েছে!', 'success');
        } else {
            const saved = DB.addDocument(data);
            document.getElementById('pq-doc-id').value = saved.id;
            UI.toast('কোটেশন খসড়া সংরক্ষিত হয়েছে!', 'success');
        }

        this.renderSavedList();
        this.renderList();
    },

    previewPageForm() {
        const data = this._getPageFormData();
        this.previewDocument(data);
    },

    loadIntoPageForm(id) {
        const doc = DB.getDocument(id);
        if (!doc) {
            UI.toast('ডকুমেন্ট পাওয়া যায়নি!', 'error');
            return;
        }

        // Switch to quotation page if not currently active
        if (App.currentPage !== 'quotation') {
            App.navigateTo('quotation');
        }

        document.getElementById('pq-doc-id').value = doc.id;
        document.getElementById('pq-doc-type').value = doc.type || 'quotation';
        document.getElementById('pq-doc-ref').value = doc.refNo || '';
        document.getElementById('pq-doc-date').value = doc.date || Utils.getToday();
        document.getElementById('pq-doc-title').value = doc.title || '';
        document.getElementById('pq-doc-subtitle').value = doc.subtitle || '';
        document.getElementById('pq-recipient-name').value = doc.recipient?.name || '';
        document.getElementById('pq-recipient-org').value = doc.recipient?.org || '';
        document.getElementById('pq-recipient-address').value = doc.recipient?.address || '';
        document.getElementById('pq-recipient-phone').value = doc.recipient?.phone || '';
        document.getElementById('pq-doc-subject').value = doc.subject || '';
        document.getElementById('pq-doc-body').value = doc.body || '';
        document.getElementById('pq-discount').value = doc.discount || 0;
        document.getElementById('pq-vat').value = doc.vat || 0;
        document.getElementById('pq-doc-notes').value = doc.notes || '';
        document.getElementById('pq-prepared-by').value = doc.preparedBy || '';
        document.getElementById('pq-authorized-by').value = doc.authorizedBy || '';

        const container = document.getElementById('pq-items-container');
        if (container) {
            container.innerHTML = '';
            if (doc.items && doc.items.length > 0) {
                doc.items.forEach(it => this.addPageItemRow(it));
            } else {
                this.addPageItemRow();
            }
        }

        this.calculatePageTotals();

        const formCard = document.getElementById('form-page-quotation');
        if (formCard) formCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
        UI.toast(`কোটেশন "${doc.refNo}" এডিটের জন্য প্রস্তুত`, 'info');
    },

    renderSavedList() {
        const container = document.getElementById('pq-saved-list-container');
        if (!container) return;

        const docs = DB.getDocuments();
        if (docs.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="padding:28px 16px; text-align:center; color:var(--text-secondary);">
                    <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom:8px; opacity:0.6;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    <p style="margin:0; font-size:14px; font-weight:600;">কোনো সংরক্ষিত কোটেশন বা প্যাড নেই</p>
                    <p style="margin:4px 0 0 0; font-size:12px;">উপরের ফর্মে তথ্য পূরণ করে "PDF জেনারেট ও সেভ করুন" বোতামে ক্লিক করুন।</p>
                </div>
            `;
            return;
        }

        const typeLabels = {
            quotation: 'বাণিজ্যিক দরপত্র',
            invoice: 'বিল / ইনভয়েস',
            letter: 'অফিসিয়াল চিঠি',
            notice: 'নোটিশ'
        };

        const typeBadges = {
            quotation: 'badge-primary',
            invoice: 'badge-success',
            letter: 'badge-info',
            notice: 'badge-warning'
        };

        container.innerHTML = `
            <div class="table-responsive">
                <table class="data-table documents-table" style="width:100%; border-collapse:collapse;">
                    <thead>
                        <tr>
                            <th style="width:130px;">স্মারক / Ref</th>
                            <th style="width:110px;">ধরন</th>
                            <th>শিরোনাম ও প্রাপক</th>
                            <th style="width:90px;">তারিখ</th>
                            <th style="text-align:right; width:110px;">মোট টাকা</th>
                            <th style="text-align:right; width:180px;">অ্যাকশন</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${docs.map(d => {
                            const recName = d.recipient?.name || d.recipient?.org || 'সাধারণ';
                            const subtotal = (d.items || []).reduce((s, it) => s + (it.total || 0), 0);
                            const grandTotal = Math.max(0, subtotal + (d.vat || 0) - (d.discount || 0));
                            const amountStr = grandTotal > 0 ? (grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2 }) + ' ৳') : '—';
                            return `
                                <tr>
                                    <td><strong style="color:var(--primary); font-size:12.5px;">${this._escapeHtml(d.refNo)}</strong></td>
                                    <td><span class="badge ${typeBadges[d.type] || 'badge-primary'}">${typeLabels[d.type] || d.type}</span></td>
                                    <td>
                                        <div style="font-weight:600; font-size:13px; color:var(--text-primary);">${this._escapeHtml(d.title)}</div>
                                        <div style="font-size:11px; color:var(--text-secondary);">${this._escapeHtml(recName)}</div>
                                    </td>
                                    <td><small style="color:var(--text-secondary);">${d.date}</small></td>
                                    <td style="text-align:right; font-weight:700; color:#008852;">${amountStr}</td>
                                    <td style="text-align:right; white-space:nowrap;">
                                        <button type="button" class="btn btn-xs btn-primary" onclick="CompanyDocuments.downloadById('${d.id}')" title="PDF ডাউনলোড" style="background:#008852; border-color:#008852;">
                                            PDF
                                        </button>
                                        <button type="button" class="btn btn-xs btn-outline" onclick="CompanyDocuments.previewById('${d.id}')" title="প্রিভিউ">
                                            প্রিভিউ
                                        </button>
                                        <button type="button" class="btn btn-xs btn-outline" onclick="CompanyDocuments.loadIntoPageForm('${d.id}')" title="এডিট">
                                            এডিট
                                        </button>
                                        <button type="button" class="btn btn-xs btn-danger" onclick="CompanyDocuments.deleteById('${d.id}')" title="মুছুন">
                                            &times;
                                        </button>
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
    },

    async deleteById(id) {
        const doc = DB.getDocument(id);
        if (!doc) return;
        const ok = await UI.confirm('ডকুমেন্ট মুছুন', `স্মারক "${doc.refNo}" স্থায়ীভাবে মুছে ফেলতে চান?`, 'মুছুন', 'btn-danger');
        if (ok) {
            DB.deleteDocument(id);
            UI.toast('ডকুমেন্ট মুছে ফেলা হয়েছে!', 'success');
            this.renderList();
            this.renderSavedList();
            const currId = document.getElementById('pq-doc-id');
            if (currId && currId.value === id) {
                this.resetPageForm();
            }
        }
    }
};


/* ==================== SETTINGS MODULE ==================== */
const Settings = {
    init() {
        const settings = DB.getSettings();
        document.getElementById('toggle-dark-mode').checked = settings.darkMode;
        this.updateStorageUsage();
    },

    toggleDarkMode(enabled) {
        DB.saveSetting('darkMode', enabled);
        document.documentElement.setAttribute('data-theme', enabled ? 'dark' : '');

        // Toggle icons
        const sunIcon = document.querySelector('#btn-dark-mode .sun-icon');
        const moonIcon = document.querySelector('#btn-dark-mode .moon-icon');
        if (sunIcon && moonIcon) {
            sunIcon.style.display = enabled ? 'none' : 'block';
            moonIcon.style.display = enabled ? 'block' : 'none';
        }

        // Update meta theme color
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.content = enabled ? '#0f0f1a' : '#1a73e8';
    },

    exportBackup() {
        const data = DB.exportAll();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `US_BENGOL_Backup_${Utils.getToday()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        UI.toast('ব্যাকআপ ডাউনলোড হয়েছে!', 'success');
    },

    importBackup(file) {
        const reader = new FileReader();
        reader.onload = function (e) {
            try {
                const data = JSON.parse(e.target.result);
                if (!data.workers && !data.attendance && !data.payments) {
                    UI.toast('অবৈধ ব্যাকআপ ফাইল!', 'error');
                    return;
                }
                DB.importAll(data);
                UI.toast('ব্যাকআপ সফলভাবে পুনরুদ্ধার করা হয়েছে!', 'success');
                App.refreshCurrentPage();
                Settings.init();
            } catch (err) {
                UI.toast('ফাইল পড়তে সমস্যা হয়েছে!', 'error');
            }
        };
        reader.readAsText(file);
    },

    updateStorageUsage() {
        const usage = DB.getStorageUsage();
        document.getElementById('storage-usage').textContent = UI.formatSize(usage);
    }
};


/* ==================== APP CONTROLLER ==================== */
const App = {
    currentPage: 'dashboard',

    init() {
        // Set up page navigation
        this.setupNavigation();

        // Set up dark mode
        const settings = DB.getSettings();
        Settings.toggleDarkMode(settings.darkMode);
        Settings.init();

        // Render initial page
        this.renderPage('dashboard');

        // Set up event listeners
        this.setupEventListeners();

        // Initialize attendance date
        Attendance.init();

        // Register service worker
        this.registerServiceWorker();

        // Preload Bangla font for PDF generation (background)
        BanglaFont.load().then(ok => {
            if (ok) console.log('Bangla PDF font ready');
            else console.log('Bangla PDF font unavailable — English fallback');
        });

        // Initialize Company Documents Module
        CompanyDocuments.init();
    },

    setupNavigation() {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', () => {
                const page = item.dataset.page;
                this.navigateTo(page);
            });
        });
    },

    navigateTo(page) {
        this.currentPage = page;

        // Update nav active state
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.page === page);
        });

        // Show/hide pages
        document.querySelectorAll('.page').forEach(p => {
            p.classList.toggle('active', p.id === `page-${page}`);
        });

        // Show/hide FAB
        const fab = document.getElementById('fab-add-worker');
        if (fab) fab.style.display = page === 'workers' ? 'flex' : 'none';

        // Render page content
        this.renderPage(page);

        // Scroll to top
        window.scrollTo(0, 0);
    },

    renderPage(page) {
        switch (page) {
            case 'dashboard': Dashboard.render(); break;
            case 'workers': Workers.render(); break;
            case 'attendance': Attendance.render(); break;
            case 'payment': Payments.render(); break;
            case 'quotation': CompanyDocuments.renderPage(); break;
            case 'report': this.setupReportPage(); break;
            case 'settings': Settings.init(); break;
        }
    },

    refreshCurrentPage() {
        this.renderPage(this.currentPage);
    },

    setupReportPage() {
        // Populate worker select
        const select = document.getElementById('report-worker-select');
        const workers = DB.getWorkers();
        select.innerHTML = '<option value="">কর্মচারী নির্বাচন করুন</option>' +
            workers.map(w => `<option value="${w.id}">${w.name} (${w.workerId})</option>`).join('');

        // Set default months
        const now = new Date();
        const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        document.getElementById('report-start-month').value = monthStr;
        document.getElementById('report-end-month').value = monthStr;
        document.getElementById('report-all-month').value = monthStr;

        // Render company documents (Quotations, Invoices, Pads)
        CompanyDocuments.renderList();
    },

    setupEventListeners() {
        // Worker form
        document.getElementById('form-worker').addEventListener('submit', (e) => Workers.save(e));

        // Worker type change
        document.getElementById('worker-type').addEventListener('change', (e) => {
            Workers._toggleWageFields(e.target.value);
        });

        // Photo upload
        document.getElementById('photo-upload-area').addEventListener('click', () => {
            document.getElementById('worker-photo').click();
        });

        document.getElementById('worker-photo').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function (ev) {
                    document.getElementById('photo-preview').innerHTML =
                        `<img src="${ev.target.result}" alt="Preview"><span>ছবি পরিবর্তন করুন</span>`;
                };
                reader.readAsDataURL(file);
            }
        });

        // Payment form
        document.getElementById('form-payment').addEventListener('submit', (e) => Payments.save(e));

        // FAB
        document.getElementById('fab-add-worker').addEventListener('click', () => Workers.openAddForm());

        // Add payment button
        document.getElementById('btn-add-payment').addEventListener('click', () => Payments.openForm());

        // Dark mode toggle (header)
        document.getElementById('btn-dark-mode').addEventListener('click', () => {
            const settings = DB.getSettings();
            Settings.toggleDarkMode(!settings.darkMode);
            document.getElementById('toggle-dark-mode').checked = !settings.darkMode;
        });

        // Dark mode toggle (settings)
        document.getElementById('toggle-dark-mode').addEventListener('change', (e) => {
            Settings.toggleDarkMode(e.target.checked);
        });

        // Worker search
        document.getElementById('search-workers').addEventListener('input', (e) => {
            const filter = document.querySelector('#worker-filters .chip.active')?.dataset.filter || 'all';
            Workers.render(filter, e.target.value);
        });

        // Worker filters
        document.querySelectorAll('#worker-filters .chip').forEach(chip => {
            chip.addEventListener('click', () => {
                document.querySelectorAll('#worker-filters .chip').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                const search = document.getElementById('search-workers').value;
                Workers.render(chip.dataset.filter, search);
            });
        });

        // Payment search
        document.getElementById('search-payments').addEventListener('input', (e) => {
            Payments.render(e.target.value);
        });

        // Attendance date change
        document.getElementById('attendance-date').addEventListener('change', (e) => {
            Attendance.setDate(e.target.value);
        });

        // Attendance navigation
        document.getElementById('att-prev-day').addEventListener('click', () => Attendance.prevDay());
        document.getElementById('att-next-day').addEventListener('click', () => Attendance.nextDay());

        // Calendar navigation
        document.getElementById('cal-prev-month').addEventListener('click', () => Calendar.prevMonth());
        document.getElementById('cal-next-month').addEventListener('click', () => Calendar.nextMonth());

        // Report generation
        document.getElementById('btn-generate-individual-report').addEventListener('click', () => {
            const workerId = document.getElementById('report-worker-select').value;
            const startMonth = document.getElementById('report-start-month').value;
            const endMonth = document.getElementById('report-end-month').value;

            if (!workerId) {
                UI.toast('কর্মচারী নির্বাচন করুন!', 'warning');
                return;
            }
            if (!startMonth || !endMonth) {
                UI.toast('মাস নির্বাচন করুন!', 'warning');
                return;
            }

            Reports.generateIndividualPDF(workerId, startMonth, endMonth);
        });

        document.getElementById('btn-generate-all-report').addEventListener('click', () => {
            const month = document.getElementById('report-all-month').value;
            if (!month) {
                UI.toast('মাস নির্বাচন করুন!', 'warning');
                return;
            }
            Reports.generateAllPDF(month);
        });

        // Settings - Export
        document.getElementById('btn-export-backup').addEventListener('click', () => Settings.exportBackup());

        // Settings - Import
        document.getElementById('btn-import-backup').addEventListener('click', () => {
            document.getElementById('import-file-input').click();
        });

        document.getElementById('import-file-input').addEventListener('change', (e) => {
            if (e.target.files[0]) {
                Settings.importBackup(e.target.files[0]);
                e.target.value = '';
            }
        });

        // Settings - Reset
        document.getElementById('btn-reset-attendance').addEventListener('click', async () => {
            const ok = await UI.confirm('হাজিরা ডেটা মুছুন', 'সকল হাজিরা রেকর্ড মুছে ফেলতে চান?', 'মুছুন', 'btn-danger');
            if (ok) {
                DB.resetAttendance();
                UI.toast('হাজিরা ডেটা মুছে ফেলা হয়েছে!', 'success');
                App.refreshCurrentPage();
            }
        });

        document.getElementById('btn-reset-payments').addEventListener('click', async () => {
            const ok = await UI.confirm('পেমেন্ট ডেটা মুছুন', 'সকল পেমেন্ট রেকর্ড মুছে ফেলতে চান?', 'মুছুন', 'btn-danger');
            if (ok) {
                DB.resetPayments();
                UI.toast('পেমেন্ট ডেটা মুছে ফেলা হয়েছে!', 'success');
                App.refreshCurrentPage();
            }
        });

        document.getElementById('btn-reset-all').addEventListener('click', async () => {
            const ok = await UI.confirm('সকল ডেটা মুছুন', 'সম্পূর্ণ অ্যাপ ডেটা মুছে ফেলতে চান? এই কাজ পূর্বাবস্থায় ফেরানো যাবে না!', 'সকল ডেটা মুছুন', 'btn-danger');
            if (ok) {
                DB.resetAll();
                UI.toast('সকল ডেটা মুছে ফেলা হয়েছে!', 'success');
                App.refreshCurrentPage();
                Settings.init();
            }
        });

        // Close modals on overlay click
        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    overlay.style.display = 'none';
                    document.body.style.overflow = '';
                }
            });
        });

        // Handle back button for modals
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                document.querySelectorAll('.modal-overlay').forEach(overlay => {
                    if (overlay.style.display === 'flex') {
                        overlay.style.display = 'none';
                        document.body.style.overflow = '';
                    }
                });
            }
        });
    },

    registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('sw.js').catch(err => {
                console.log('SW registration failed:', err);
            });
        }
    }
};


/* ==================== INITIALIZE APP ==================== */
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
