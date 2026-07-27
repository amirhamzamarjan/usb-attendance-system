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
            settings: this.getSettings()
        };
    },
    importAll(data) {
        if (data.workers) this.saveWorkers(data.workers);
        if (data.attendance) this._set('attendance', data.attendance);
        if (data.payments) this.savePayments(data.payments);
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
   Loads Noto Sans Bengali from CDN for PDF rendering.
   Falls back to English if the font cannot be loaded.
   ============================================================ */
const BanglaFont = {
    fontData: null,
    fontName: 'BNFont',
    fileName: 'NotoSansBengali-Regular.ttf',
    urls: [
        'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/notosansbengali/static/NotoSansBengali-Regular.ttf',
        'https://raw.githubusercontent.com/google/fonts/main/ofl/notosansbengali/static/NotoSansBengali-Regular.ttf'
    ],
    isLoaded: false,
    isLoading: false,
    _loadPromise: null,

    async load() {
        if (this.isLoaded) return true;
        if (this.isLoading) return this._loadPromise;

        this.isLoading = true;
        this._loadPromise = this._doLoad();
        return this._loadPromise;
    },

    async _doLoad() {
        for (const url of this.urls) {
            try {
                const resp = await fetch(url, { mode: 'cors' });
                if (!resp.ok) continue;
                const buf = await resp.arrayBuffer();
                this.fontData = this._bufferToBase64(buf);
                this.isLoaded = true;
                console.log('Bangla font loaded from:', url);
                return true;
            } catch (e) {
                console.warn('Font URL failed:', url);
            }
        }
        console.warn('All Bangla font CDN URLs failed — will use English fallback');
        return false;
    },

    register(doc) {
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
    },

    _bufferToBase64(buffer) {
        let bin = '';
        const bytes = new Uint8Array(buffer);
        for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
        return btoa(bin);
    }
};

/* ==================== REPORTS MODULE ====================
   Dual-language PDF Reports (Bangla with English fallback)
   ======================================================== */
const Reports = {

    /* Language & font state — set per report */
    _lang: 'en',
    _fontName: 'helvetica',

    /* Bangla ↔ English string helper */
    __(bn, en) { return this._lang === 'bn' ? bn : en; },

    /* Font setter shorthand */
    _setFont(doc, style) { doc.setFont(this._fontName, style || 'normal'); },

    /* ─────────────────────────────────────────────────
       Add fallback notice (English mode only)
       ───────────────────────────────────────────────── */
    _addFallbackNotice(doc) {
        if (this._lang === 'bn') return;
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(7.5);
        doc.setTextColor(180, 100, 80);
        const msg = 'Bangla PDF is currently unavailable on this device. This report has been generated in English for compatibility.';
        doc.text(msg, 105, 46, { align: 'center', maxWidth: 170 });
    },

    /* ─────────────────────────────────────────────────
       Footer with page numbers
       ───────────────────────────────────────────────── */
    _addFooter(doc, pageNum, totalPages) {
        this._setFont(doc, 'normal');
        doc.setFontSize(8);
        doc.setTextColor(100);
        const now = new Date();
        const d = now.getDate().toString().padStart(2, '0');
        const mo = (now.getMonth() + 1).toString().padStart(2, '0');
        const h = now.getHours().toString().padStart(2, '0');
        const mi = now.getMinutes().toString().padStart(2, '0');
        const dateStr = `${d}/${mo}/${now.getFullYear()} ${h}:${mi}`;
        const genLabel = 'Generated:';
        const pageLabel = 'Page';
        doc.text(`${genLabel} ${dateStr}`, 20, 290);
        doc.text(`${pageLabel} ${pageNum} / ${totalPages}`, 190, 290, { align: 'right' });
    },

    /* ─────────────────────────────────────────────────
       Company header
       ───────────────────────────────────────────────── */
    _drawHeader(doc, title, subtitle) {
        // Logo box
        doc.setFillColor(26, 115, 232);
        doc.setDrawColor(26, 115, 232);
        doc.roundedRect(17, 14, 14, 14, 3, 3, 'F');
        this._setFont(doc, 'bold');
        doc.setFontSize(10);
        doc.setTextColor(255, 255, 255);
        doc.text('UB', 24, 24, { align: 'center' });

        // Company name
        this._setFont(doc, 'bold');
        doc.setFontSize(18);
        doc.setTextColor(26, 115, 232);
        doc.text('US BENGOL', 105, 20, { align: 'center' });

        // Separator line
        doc.setDrawColor(26, 115, 232);
        doc.line(20, 26, 190, 26);

        // Title
        this._setFont(doc, 'bold');
        doc.setFontSize(13);
        doc.setTextColor(50, 50, 50);
        doc.text(title, 105, 33, { align: 'center' });

        // Subtitle
        if (subtitle) {
            this._setFont(doc, 'normal');
            doc.setFontSize(10);
            doc.setTextColor(80);
            doc.text(subtitle, 105, 39, { align: 'center' });
        }
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
        // Always generate PDF in English for reliability across all devices
        this._lang = 'en';
        this._fontName = 'helvetica';
        return false;
    },

    async generateIndividualPDF(workerId, startMonth, endMonth) {
        const w = DB.getWorker(workerId);
        if (!w) { UI.toast('Worker not found!', 'error'); return; }

        try {
            // Check jsPDF library
            if (typeof window.jspdf === 'undefined' || typeof window.jspdf.jsPDF !== 'function') {
                UI.toast('jsPDF library not loaded! Check internet connection.', 'error');
                return;
            }

            const { jsPDF } = window.jspdf;
            const doc = new jsPDF('p', 'mm', 'a4');

            // Load Bangla font (sets _lang and _fontName)
            await this._ensureFont(doc);

            // ─── Parse month range ────────────────
            const [startY, startM] = startMonth.split('-').map(Number);
            const [endY, endM] = endMonth.split('-').map(Number);
            const enMonths = ['January','February','March','April','May','June','July','August','September','October','November','December'];
            const monthLabel = `${enMonths[startM - 1]} ${startY}`;
            const endLabel = endMonth !== startMonth
                ? ` - ${enMonths[endM - 1]} ${endY}`
                : '';

            // ─── Header ─────────────────────────────
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
            let y = this._drawInfoBox(doc, this._lang === 'bn' ? 46 : 50, infoData);

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
                    this._addFooter(doc, doc.internal.getNumberOfPages(), 0);
                    doc.addPage(); y = 20;
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
                    headStyles: { fillColor: [26, 115, 232], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
                    bodyStyles: { fontSize: 7.5, cellPadding: 1.5 },
                    alternateRowStyles: { fillColor: [248, 250, 255] },
                    styles: { font: this._fontName, lineColor: [220, 220, 220], lineWidth: 0.1 },
                    margin: { left: 20, right: 20 },
                    pageBreak: 'auto'
                });
                y = doc.lastAutoTable.finalY + 8;
            } else {
                if (y > 260) { doc.addPage(); y = 20; }
                this._setFont(doc, 'normal');
                doc.setFontSize(9);
                doc.setTextColor(150);
                doc.text('No Attendance Records Found.', 105, y + 4, { align: 'center' });
                y += 10;
            }

            // ─── Payment History ─────────────────
            const payments = DB.getPaymentsByWorker(workerId);
            if (payments.length > 0) {
                if (y > 230) {
                    this._addFooter(doc, doc.internal.getNumberOfPages(), 0);
                    doc.addPage(); y = 20;
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
                    headStyles: { fillColor: [26, 115, 232], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
                    bodyStyles: { fontSize: 7.5, cellPadding: 1.5 },
                    alternateRowStyles: { fillColor: [248, 250, 255] },
                    columnStyles: { 0: { cellWidth: 35 }, 1: { cellWidth: 80 }, 2: { cellWidth: 40, halign: 'right' } },
                    styles: { font: this._fontName, lineColor: [220, 220, 220], lineWidth: 0.1 },
                    margin: { left: 20, right: 20 },
                    pageBreak: 'auto'
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
                this._addFooter(doc, doc.internal.getNumberOfPages(), 0);
                doc.addPage(); y = 20;
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

            // ─── Footer on all pages ────────────
            const totalPages = doc.internal.getNumberOfPages();
            for (let i = 1; i <= totalPages; i++) {
                doc.setPage(i);
                this._addFooter(doc, i, totalPages);
            }

            doc.save(`${w.workerId}_${w.name}_Report.pdf`);
            UI.toast('PDF report downloaded!', 'success');

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

            const [year, mon] = month.split('-').map(Number);
            const enMonths = ['January','February','March','April','May','June','July','August','September','October','November','December'];
            const monthName = `${enMonths[mon - 1]} ${year}`;

            // ─── Header ─────────────────────────────
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

            let y = 46;
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
                headStyles: { fillColor: [26, 115, 232], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
                bodyStyles: { fontSize: 7.5, cellPadding: 1.5 },
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
                margin: { left: 15, right: 15 },
                pageBreak: 'auto',
                showHead: 'everyPage'
            });
            y = doc.lastAutoTable.finalY + 10;

            // ─── Final Totals ─────────────────────
            if (y > 250) { doc.addPage(); y = 20; }

            doc.setDrawColor(26, 115, 232);
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

            // ─── Footer on all pages ────────────────
            const totalPages = doc.internal.getNumberOfPages();
            for (let i = 1; i <= totalPages; i++) {
                doc.setPage(i);
                this._addFooter(doc, i, totalPages);
            }

            doc.save(`US_BENGOL_All_Workers_${month}.pdf`);
            UI.toast('All workers PDF report downloaded!', 'success');

        } catch (err) {
            console.error('PDF generation error:', err);
            UI.toast('Failed to generate PDF!', 'error');
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
