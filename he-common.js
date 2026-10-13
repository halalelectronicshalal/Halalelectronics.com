/**
 * ሀላል ኤሌክትሮኒክስ — ለብቻ የቆሙ የአድሚን ገጾች የጋራ ኮድ
 * (finance.html · new-orders.html · new-entry.html)
 * ------------------------------------------------------------------
 * • ከ admin.html ጋር አንድ session ይጋራል (localStorage "he_session_admin") →
 *   አድሚን ላይ ከገቡ እዚህ በራስ-ሰር ተገብቷል፤ እዚህ ከገቡም admin.html ተገብቷል።
 * • ከዚህ ፋይል በፊት  window.APP_ROLE = "admin"  መቀመጥ አለበት።
 * • መግቢያ፣ Firebase፣ Worker ጥሪ፣ የኢትዮጵያ ቀን፣ toast/modal እዚህ አሉ።
 */
const firebaseConfig = {
    apiKey: "AIzaSyAZ7MU2B58bWcu-8jH9Pvv5Ob9XGQyx4NU",
    authDomain: "halal-report-2.firebaseapp.com",
    projectId: "halal-report-2",
    storageBucket: "halal-report-2.firebasestorage.app",
    messagingSenderId: "242965792260",
    appId: "1:242965792260:web:8dd83989172924f8c5d751"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
db.settings({ experimentalAutoDetectLongPolling: true, merge: true });

const WORKER_BASE_URL = "https://halalelectronics.ashenafi6275.workers.dev";
const HE_ROLE = (typeof window !== 'undefined' && window.APP_ROLE) || 'operator';
const HE_SESSION_KEY = 'he_session_' + HE_ROLE;
function heGetSession() {
    try {
        const s = JSON.parse(localStorage.getItem(HE_SESSION_KEY) || 'null');
        if (!s || !s.token || !s.staff || !s.exp || s.exp * 1000 < Date.now()) return null;
        return s;
    } catch (e) { return null; }
}
function heSetSession(res) {
    let exp = 0;
    try { exp = JSON.parse(atob(res.token.split('.')[0].replace(/-/g, '+').replace(/_/g, '/'))).exp; } catch (e) {}
    localStorage.setItem(HE_SESSION_KEY, JSON.stringify({ token: res.token, staff: res.staff, exp }));
}
function heIsAdminSession() { const s = heGetSession(); return !!(s && s.staff && s.staff.role === 'admin'); }
async function heLogout() {
    try { localStorage.removeItem(HE_SESSION_KEY); } catch (e) {}
    try { await firebase.auth().signOut(); await firebase.auth().signInAnonymously(); } catch (e) {}
}
async function callWorker(name, payload) {
    const headers = { 'Content-Type': 'application/json' };
    const s = heGetSession();
    if (s) headers['Authorization'] = 'Bearer ' + s.token;
    const res = await fetch(`${WORKER_BASE_URL}/${name}`, { method: 'POST', headers, body: JSON.stringify(payload || {}) });
    return res.json();
}
async function heSignInWithResult(res) {
    heSetSession(res);
    if (res.firebaseToken) await firebase.auth().signInWithCustomToken(res.firebaseToken);
}
function heLoginErrorText(code, role) {
    const m = {
        'invalid-credentials': '❌ ስልክ ቁጥር ወይም የይለፍ ቃል ትክክል አይደለም',
        'pending': '⏳ አካውንትዎ ገና በአስተዳዳሪ አልፀደቀም',
        'rejected': '⛔ ምዝገባዎ ውድቅ ተደርጓል',
        'inactive': '⛔ አካውንትዎ ተዘግቷል',
        'locked': '⛔ ብዙ ጊዜ ተሳስተዋል፤ ከ15 ደቂቃ በኋላ ይሞክሩ',
        'too-many-attempts': '⛔ ብዙ ሙከራ ተደርጓል፤ ጥቂት ቆይተው ይሞክሩ',
        'token-failed': '⛔ የአገልጋይ ቅንብር ችግር (Firebase ቶከን)፤ አድሚኑን ያነጋግሩ',
        'wrong-portal': role === 'admin'
            ? '⛔ ይህ የአድሚን ገፅ ነው። ቴክኒሻን ከሆኑ የቴክኒሻን ሊንክ (technician.html) ይጠቀሙ'
            : role === 'operator'
                ? '⛔ ይህ አካውንት ኦፕሬተር አይደለም። አድሚኑን ያነጋግሩ'
                : '⛔ ይህ የቴክኒሻን ገፅ ነው። አድሚን ከሆኑ admin.html፣ ኦፕሬተር ከሆኑ operator.html ይጠቀሙ'
    };
    return m[code] || '❌ መግባት አልተቻለም፣ እንደገና ይሞክሩ';
}
// ገጽ ሲከፈት፦ የተቀመጠ session ካለ Firebase በ role claim ይግባ፤ ከሌለ anonymous (ለደንበኛ ጥሪዎች)
let authReady = (async () => {
    try {
        const s = heGetSession();
        if (s) {
            await new Promise(r => { const u = firebase.auth().onAuthStateChanged(() => { u(); r(); }); });
            const cu = firebase.auth().currentUser;
            let hasRole = false;
            if (cu && cu.uid === s.staff.id) { const tr = await cu.getIdTokenResult(); hasRole = !!tr.claims.role; }
            if (!hasRole) {
                const r = await callWorker('session', {});
                if (r && r.ok && r.firebaseToken) { heSetSession(r); await firebase.auth().signInWithCustomToken(r.firebaseToken); return; }
                await heLogout();
                return;
            }
            return;
        }
        await new Promise(r => { const u = firebase.auth().onAuthStateChanged(() => { u(); r(); }); });
        if (!firebase.auth().currentUser) await firebase.auth().signInAnonymously();
    } catch (err) { console.error('⚠️ Auth init failed:', err); }
})();

/* ============================================================
   የኢትዮጵያ ዘመን አቆጣጠር
   ============================================================ */
const ETH_MONTHS = ['መስከረም','ጥቅምት','ኅዳር','ታኅሳስ','ጥር','የካቲት','መጋቢት','ሚያዝያ','ግንቦት','ሰኔ','ሐምሌ','ነሐሴ','ጳጉሜ'];
const ETH_WEEKDAYS = ['እሁድ','ሰኞ','ማክሰኞ','ረቡዕ','ሐሙስ','ዓርብ','ቅዳሜ'];

function isGregorianLeap(y) {
    return (y % 4 === 0 && y % 100 !== 0) || (y % 400 === 0);
}
function ethiopianNewYearDayInSept(gYear) {
    return isGregorianLeap(gYear + 1) ? 12 : 11;
}
function gregorianToEthiopian(dateInput) {
    const d = (dateInput instanceof Date) ? dateInput : new Date(dateInput);
    const gYear = d.getFullYear(), gMonth = d.getMonth() + 1, gDay = d.getDate();
    const inputDate = new Date(Date.UTC(gYear, gMonth - 1, gDay));
    const nyDayThisYear = ethiopianNewYearDayInSept(gYear);
    const newYearThisGregYear = new Date(Date.UTC(gYear, 8, nyDayThisYear));
    let ethYear, newYearRef;
    if (inputDate >= newYearThisGregYear) {
        ethYear = gYear - 7;
        newYearRef = newYearThisGregYear;
    } else {
        ethYear = gYear - 8;
        const nyDayPrevYear = ethiopianNewYearDayInSept(gYear - 1);
        newYearRef = new Date(Date.UTC(gYear - 1, 8, nyDayPrevYear));
    }
    const diffDays = Math.round((inputDate - newYearRef) / 86400000);
    const ethMonth = Math.floor(diffDays / 30) + 1;
    const ethDay = (diffDays % 30) + 1;
    return { year: ethYear, month: ethMonth, day: ethDay };
}
function ethiopianToGregorian(ethYear, ethMonth, ethDay) {
    const gYearOfNewYear = ethYear + 7;
    const nyDay = ethiopianNewYearDayInSept(gYearOfNewYear);
    const newYearGregDate = new Date(Date.UTC(gYearOfNewYear, 8, nyDay));
    const totalDaysFromNewYear = (ethMonth - 1) * 30 + (ethDay - 1);
    return new Date(newYearGregDate.getTime() + totalDaysFromNewYear * 86400000);
}
// ዋናው display function - navbar/table/card በ ሁሉም ቦታ ለ መጠቀም
function formatEthDate(dateInput, includeWeekday) {
    if (!dateInput) return '—';
    const d = (dateInput && dateInput.toDate) ? dateInput.toDate() : (dateInput instanceof Date ? dateInput : new Date(dateInput));
    if (isNaN(d.getTime())) return '—';
    const eth = gregorianToEthiopian(d);
    const monthName = ETH_MONTHS[eth.month - 1] || '';
    let result = `${eth.day} ${monthName} ${eth.year}`;
    if (includeWeekday) result = `${ETH_WEEKDAYS[d.getDay()]}፣ ` + result;
    return result;
}
function formatEthDateTime(dateInput) {
    if (!dateInput) return '—';
    const d = (dateInput && dateInput.toDate) ? dateInput.toDate() : (dateInput instanceof Date ? dateInput : new Date(dateInput));
    if (isNaN(d.getTime())) return '—';
    const timeStr = d.toLocaleTimeString('am-ET', { hour: '2-digit', minute: '2-digit' });
    return formatEthDate(d) + ' ' + timeStr;
}

// ============================================================
// ✅ NEW: Ethiopian Date Picker Widget (native <input type="date"> ምትክ)
// ጠቃሚ ንድፍ፦ ነባሩ native input hidden ሆኖ ይቆያል፣ Ethiopian dropdown ሲቀየር
// ወደ Gregorian ተቀይሮ hidden input ላይ ይሰፍራል + change event ይተኮሳል -
// ስለዚህ ነባር renderOrders/filter ኮድ ምንም ሳይቀየር ይቀጥላል።
// ============================================================
function buildEthiopianPickerHTML(idPrefix, targetInputId, gregorianDefaultValue) {
    const defaultDate = gregorianDefaultValue ? new Date(gregorianDefaultValue) : new Date();
    const eth = gregorianToEthiopian(defaultDate);
    const currentEthYear = eth.year;
    let dayOptions = '', monthOptions = '', yearOptions = '';
    for (let d = 1; d <= 30; d++) dayOptions += `<option value="${d}" ${d === eth.day ? 'selected' : ''}>${d}</option>`;
    ETH_MONTHS.slice(0, 12).forEach((m, i) => { monthOptions += `<option value="${i+1}" ${i+1 === eth.month ? 'selected' : ''}>${m}</option>`; });
    for (let y = currentEthYear - 3; y <= currentEthYear + 1; y++) yearOptions += `<option value="${y}" ${y === currentEthYear ? 'selected' : ''}>${y}</option>`;
    return `
        <select id="${idPrefix}_day" class="eth-picker-part" onchange="syncEthPickerToGregorian('${idPrefix}','${targetInputId}')">${dayOptions}</select>
        <select id="${idPrefix}_month" class="eth-picker-part" onchange="syncEthPickerToGregorian('${idPrefix}','${targetInputId}')">${monthOptions}</select>
        <select id="${idPrefix}_year" class="eth-picker-part" onchange="syncEthPickerToGregorian('${idPrefix}','${targetInputId}')">${yearOptions}</select>
    `;
}
function syncEthPickerToGregorian(idPrefix, targetInputId) {
    const day = parseInt(document.getElementById(idPrefix + '_day').value);
    const month = parseInt(document.getElementById(idPrefix + '_month').value);
    const year = parseInt(document.getElementById(idPrefix + '_year').value);
    const greg = ethiopianToGregorian(year, month, day);
    const target = document.getElementById(targetInputId);
    target.value = greg.toISOString().slice(0, 10);
    target.dispatchEvent(new Event('change', { bubbles: true }));
}
function setEthPickerFromGregorian(idPrefix, gregDateStr) {
    if (!gregDateStr) return;
    const d = new Date(gregDateStr);
    const eth = gregorianToEthiopian(d);
    const dayEl = document.getElementById(idPrefix + '_day');
    const monthEl = document.getElementById(idPrefix + '_month');
    const yearEl = document.getElementById(idPrefix + '_year');
    if (dayEl) dayEl.value = eth.day;
    if (monthEl) monthEl.value = eth.month;
    if (yearEl) yearEl.value = eth.year;
}


/* ============================================================
   አጋዥ ተግባራት
   ============================================================ */
function getDateKey(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function escHtml(v) {
    return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.className = 'toast ' + type + ' show';
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => toast.classList.remove('show'), 4000);
}
function openModal(title, bodyHTML, footerHTML = '') {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = bodyHTML;
    document.getElementById('modalFooter').innerHTML = footerHTML || '<button class="btn btn-secondary" onclick="closeModal()">ዝጋ</button>';
    document.getElementById('modalOverlay').classList.add('show');
}
function closeModal() { document.getElementById('modalOverlay').classList.remove('show'); }

/* ---- የ Worker ጥሪ ማሳወቂያ ተግባራት (admin.html ጋር ተመሳሳይ) ---- */
async function sendTelegramNotification(message, targetChatId) {
    try {
        await callWorker('sendTelegramMessage', { text: message, targetChatId: targetChatId || null, bot: targetChatId ? 'tech' : 'admin' });
    } catch (e) { console.warn('⚠️ Telegram send failed:', e); }
}
function toAfroMessagePhone(raw) {
    if (!raw) return '';
    let p = raw.toString().trim().replace(/[\s\-()]/g, '').replace(/^\+/, '');
    if (p.startsWith('0')) p = '251' + p.slice(1);
    else if (p.length === 9 && !p.startsWith('251')) p = '251' + p;
    return p;
}
async function sendSmsNotification(message, phone) {
    if (!phone || phone === '—') return;
    const formatted = toAfroMessagePhone(phone);
    if (!formatted) return;
    try { await callWorker('sendSms', { phone: formatted, message }); } catch (e) { console.warn('⚠️ SMS send failed:', e); }
}

/* ============================================================
   🔐 መግቢያ በር (Login gate) + ገጽ ማስነሻ
   HE.boot(staff => { ...ገጹን አስጀምር... })
   ============================================================ */
const HE = (() => {
    function injectChrome() {
        if (document.getElementById('heGate')) return;
        const wrap = document.createElement('div');
        wrap.innerHTML = `
        <div id="toast" class="toast"></div>
        <div class="modal-overlay" id="modalOverlay">
            <div class="modal">
                <div class="modal-header"><h2 id="modalTitle"></h2><button class="close-btn" onclick="closeModal()" aria-label="ዝጋ">&times;</button></div>
                <div class="modal-body" id="modalBody"></div>
                <div class="modal-footer" id="modalFooter"></div>
            </div>
        </div>
        <div id="heGate">
            <div class="he-login-box">
                <img src="icon-512.png" alt="ሀላል ኤሌክትሮኒክስ" />
                <h2 id="heGateTitle">የአድሚን መግቢያ</h2>
                <p class="sub">በአድሚን ስልክ ቁጥርና የይለፍ ቃል ይግቡ</p>
                <form id="heLoginForm">
                    <div class="form-group"><label>📱 ስልክ ቁጥር</label><input type="tel" id="heLoginPhone" placeholder="ለምሳሌ: 09XXXXXXXX" required autocomplete="username" /></div>
                    <div class="form-group"><label>🔒 የይለፍ ቃል</label><input type="password" id="heLoginPassword" placeholder="የይለፍ ቃል" required autocomplete="current-password" /></div>
                    <button type="submit" class="btn btn-primary btn-block" id="heLoginBtn"><i class="fas fa-sign-in-alt"></i> ግባ</button>
                    <div class="he-err" id="heLoginError"></div>
                </form>
                <div class="text-center"><a href="admin.html">← ወደ አድሚን ገፅ</a></div>
            </div>
        </div>`;
        while (wrap.firstChild) document.body.appendChild(wrap.firstChild);
        document.getElementById('modalOverlay').addEventListener('click', function (e) { if (e.target === this) closeModal(); });
    }

    async function boot(onReady, opts = {}) {
        injectChrome();
        if (opts.title) document.getElementById('heGateTitle').textContent = opts.title;
        await authReady;
        const start = (staff) => {
            document.getElementById('heGate').classList.remove('show');
            const who = document.getElementById('heWho');
            if (who && staff) who.textContent = '👤 ' + (staff.name || 'አድሚን');
            onReady(staff);
        };
        if (heIsAdminSession()) { start(heGetSession().staff); return; }

        const gate = document.getElementById('heGate');
        gate.classList.add('show');
        const form = document.getElementById('heLoginForm');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const err = document.getElementById('heLoginError'), btn = document.getElementById('heLoginBtn');
            err.textContent = '';
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> በመግባት ላይ...';
            try {
                const phone = document.getElementById('heLoginPhone').value.trim();
                const password = document.getElementById('heLoginPassword').value;
                const res = await callWorker('login', { phone, password, role: 'admin' });
                if (res && res.ok && res.staff && res.staff.role === 'admin') {
                    await heSignInWithResult(res);
                    document.getElementById('heLoginPassword').value = '';
                    start(res.staff);
                } else {
                    err.textContent = heLoginErrorText(res && res.error, 'admin');
                }
            } catch (ex) {
                err.textContent = '❌ ' + (ex && ex.message ? ex.message : 'መግባት አልተቻለም');
            }
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> ግባ';
        });
    }

    async function logout() { await heLogout(); location.reload(); }
    return { boot, logout };
})();
