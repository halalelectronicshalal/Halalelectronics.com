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

// 🔁 APP_ROLE="pages" → የተመዘገቡ ሠራተኞች ራሳቸው session (he_session_pages) አላቸው።
//    አድሚን በ admin.html ከገባ ደግሞ እዚህ በራስ-ሰር ይገባል (ያንን session ይገለብጣል)።
if (window.APP_ROLE === 'pages') {
    try {
        const ok = (raw) => { try { const x = JSON.parse(raw || 'null'); return !!(x && x.token && x.staff && x.exp && x.exp * 1000 > Date.now()); } catch (e) { return false; } };
        const mine = localStorage.getItem('he_session_pages');
        const adm = localStorage.getItem('he_session_admin');
        if (!ok(mine) && ok(adm) && JSON.parse(adm).staff.role === 'admin') localStorage.setItem('he_session_pages', adm);
    } catch (e) {}
}

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
/** በ activity / staff መስክ የሚገባ ስም — አድሚን «አስተዳዳሪ»፣ ሌላ ሠራተኛ ራሱ ስሙ */
function heUserName() {
    const s = heGetSession();
    return (s && s.staff && s.staff.role !== 'admin' && s.staff.name) ? s.staff.name : 'አስተዳዳሪ';
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
    const PAGE_LABEL = { finance: ['finance.html', '💰 ፋይናንስ'], newOrders: ['new-orders.html', '🆕 አዲስ ትዕዛዞች'], newEntry: ['new-entry.html', '➕ አዲስ ግቤት'] };

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
                <h2 id="heGateTitle">መግቢያ</h2>

                <!-- ===== መግቢያ ===== -->
                <div id="heLoginPane">
                    <p class="sub">በስልክ ቁጥርና በይለፍ ቃል ይግቡ</p>
                    <form id="heLoginForm">
                        <div class="form-group"><label>📱 ስልክ ቁጥር</label><input type="tel" id="heLoginPhone" placeholder="ለምሳሌ: 09XXXXXXXX" required autocomplete="username" /></div>
                        <div class="form-group"><label>🔒 የይለፍ ቃል</label><input type="password" id="heLoginPassword" placeholder="የይለፍ ቃል" required autocomplete="current-password" /></div>
                        <button type="submit" class="btn btn-primary btn-block" id="heLoginBtn"><i class="fas fa-sign-in-alt"></i> ግባ</button>
                        <div class="he-err" id="heLoginError"></div>
                    </form>
                    <div class="text-center" style="display:flex;flex-direction:column;gap:8px;">
                        <a href="#" onclick="HE.pane('register');return false;">📝 አዲስ ነዎት? እዚህ ይመዝገቡ</a>
                        <a href="#" onclick="HE.forgot();return false;">❓ የይለፍ ቃል ረሱ?</a>
                    </div>
                </div>

                <!-- ===== ምዝገባ ===== -->
                <div id="heRegisterPane" style="display:none;">
                    <p class="sub">ከተመዘገቡ በኋላ አድሚኑ ሲያፀድቅና የገጽ ፈቃድ ሲሰጥዎ መግባት ይችላሉ።</p>
                    <form id="heRegisterForm">
                        <div class="form-group"><label>👤 ሙሉ ስም</label><input type="text" id="heRegName" required /></div>
                        <div class="form-group"><label>📱 ስልክ ቁጥር</label><input type="tel" id="heRegPhone" placeholder="09XXXXXXXX" required /></div>
                        <div class="form-group"><label>🏠 አድራሻ</label><input type="text" id="heRegAddress" required /></div>
                        <div class="form-group"><label>🔒 የይለፍ ቃል (ቢያንስ 8 ፊደል)</label><input type="password" id="heRegPassword" required autocomplete="new-password" /></div>
                        <button type="submit" class="btn btn-primary btn-block" id="heRegBtn"><i class="fas fa-user-plus"></i> ተመዝገብ</button>
                        <div class="he-err" id="heRegError"></div>
                    </form>
                    <div class="text-center"><a href="#" onclick="HE.pane('login');return false;">🔙 አካውንት አለኝ — ልግባ</a></div>
                </div>

                <!-- ===== ማጽደቅ መጠበቅ ===== -->
                <div id="hePendingPane" style="display:none;text-align:center;">
                    <i class="fas fa-hourglass-half" style="font-size:2.4rem;color:var(--secondary);margin:6px 0 12px;"></i>
                    <p style="font-weight:700;">⏳ ምዝገባዎ ተልኳል!</p>
                    <p class="text-muted" style="font-size:.9rem;">አድሚኑ እስኪያፀድቅና የገጽ ፈቃድ እስኪሰጥዎ ይጠብቁ። ከዚያ በስልክና በይለፍ ቃልዎ ይግቡ።</p>
                    <button type="button" class="btn btn-outline" onclick="HE.pane('login')">🔙 ወደ መግቢያ</button>
                </div>

                <!-- ===== ፈቃድ የለም ===== -->
                <div id="heNoAccessPane" style="display:none;text-align:center;">
                    <i class="fas fa-ban" style="font-size:2.4rem;color:var(--emergency);margin:6px 0 12px;"></i>
                    <p style="font-weight:700;">⛔ ለዚህ ገጽ ፈቃድ የለዎትም</p>
                    <p class="text-muted" style="font-size:.9rem;">አድሚኑን ያነጋግሩ። ፈቃድ የተሰጠዎት ገጾች ካሉ ከታች ይታያሉ።</p>
                    <div id="heNoAccessLinks" style="display:flex;flex-direction:column;gap:8px;margin-bottom:12px;"></div>
                    <button type="button" class="btn btn-secondary" onclick="HE.logout()"><i class="fas fa-sign-out-alt"></i> ውጣ</button>
                </div>
            </div>
        </div>`;
        while (wrap.firstChild) document.body.appendChild(wrap.firstChild);
        document.getElementById('modalOverlay').addEventListener('click', function (e) { if (e.target === this) closeModal(); });
    }

    function pane(name) {
        ['Login', 'Register', 'Pending', 'NoAccess'].forEach(p => {
            const el = document.getElementById('he' + p + 'Pane');
            if (el) el.style.display = (p.toLowerCase() === name.toLowerCase()) ? '' : 'none';
        });
        document.getElementById('heGate').classList.add('show');
    }

    const isAdminStaff = (st) => !!(st && st.role === 'admin');
    const canOpen = (st, page) => isAdminStaff(st) || (Array.isArray(st && st.pages) && st.pages.includes(page));

    function applyAccess(staff, page) {
        document.body.classList.toggle('not-admin', !isAdminStaff(staff));
        document.querySelectorAll('[data-page]').forEach(a => { a.style.display = canOpen(staff, a.dataset.page) ? '' : 'none'; });
        const who = document.getElementById('heWho');
        if (who && staff) who.textContent = '👤 ' + (staff.name || 'አድሚን');
    }

    const LOGIN_ERR = {
        'no-pages-access': '⛔ ለእነዚህ ገጾች ገና ፈቃድ አልተሰጠዎትም — አድሚኑን ያነጋግሩ'
    };
    const REG_ERR = {
        'duplicate': '❌ ይህ ስልክ ቁጥር ቀድሞ ተመዝግቧል — ይግቡ',
        'weak-password': '❌ የይለፍ ቃል ቢያንስ 8 ፊደል/ቁጥር ሊኖረው ይገባል',
        'invalid': '❌ ስም፣ አድራሻ ወይም ስልክ ቁጥር ትክክል አይደለም',
        'too-many-attempts': '⛔ ብዙ ሙከራ ተደርጓል፤ ቆይተው ይሞክሩ'
    };

    async function boot(onReady, opts = {}) {
        injectChrome();
        const page = opts.page || null;
        if (opts.title) document.getElementById('heGateTitle').textContent = opts.title;
        await authReady;

        const enter = (staff) => {
            document.getElementById('heGate').classList.remove('show');
            document.body.classList.add('he-ready');
            applyAccess(staff, page);
            onReady(staff);
        };
        const showNoAccess = (staff) => {
            const box = document.getElementById('heNoAccessLinks');
            const links = (staff.pages || []).filter(p => PAGE_LABEL[p]).map(p => `<a class="btn btn-outline btn-block" href="${PAGE_LABEL[p][0]}">${PAGE_LABEL[p][1]}</a>`).join('');
            box.innerHTML = links || '<span class="text-muted">ምንም ፈቃድ የለዎትም</span>';
            pane('noaccess');
        };

        // ── የተቀመጠ session ካለ፦ ፈቃዱን ከ Worker አድሱ (አድሚን ከሻረው ወዲያው ይሰራል)
        let s = heGetSession();
        if (s && !isAdminStaff(s.staff)) {
            try {
                const r = await callWorker('session', {});
                if (r && r.ok) {
                    heSetSession(r);
                    if (r.firebaseToken) await firebase.auth().signInWithCustomToken(r.firebaseToken);
                } else if (r && !r.ok) { await heLogout(); }
            } catch (e) { console.warn('session refresh failed (offline?)', e); }
            s = heGetSession();
        }
        if (s) {
            if (page && !canOpen(s.staff, page)) { document.getElementById('heGate').classList.add('show'); showNoAccess(s.staff); }
            else enter(s.staff);
            return;
        }

        pane('login');
        document.getElementById('heLoginForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const err = document.getElementById('heLoginError'), btn = document.getElementById('heLoginBtn');
            err.textContent = '';
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> በመግባት ላይ...';
            try {
                const phone = document.getElementById('heLoginPhone').value.trim();
                const password = document.getElementById('heLoginPassword').value;
                const res = await callWorker('login', { phone, password, role: 'pages' });
                if (res && res.ok && res.staff) {
                    await heSignInWithResult(res);
                    document.getElementById('heLoginPassword').value = '';
                    if (page && !canOpen(res.staff, page)) showNoAccess(res.staff); else enter(res.staff);
                } else {
                    err.textContent = LOGIN_ERR[res && res.error] || heLoginErrorText(res && res.error, 'pages');
                }
            } catch (ex) {
                err.textContent = '❌ ' + (ex && ex.message ? ex.message : 'መግባት አልተቻለም');
            }
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> ግባ';
        });

        document.getElementById('heRegisterForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const err = document.getElementById('heRegError'), btn = document.getElementById('heRegBtn');
            err.textContent = '';
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> በመላክ ላይ...';
            try {
                const res = await callWorker('register', {
                    name: document.getElementById('heRegName').value.trim(),
                    phone: document.getElementById('heRegPhone').value.trim(),
                    address: document.getElementById('heRegAddress').value.trim(),
                    password: document.getElementById('heRegPassword').value,
                    portal: 'pages'
                });
                if (res && res.ok) {
                    e.target.reset();
                    pane('pending');
                } else {
                    err.textContent = REG_ERR[res && res.error] || '❌ መመዝገብ አልተቻለም፣ እንደገና ይሞክሩ';
                }
            } catch (ex) {
                err.textContent = '❌ ' + (ex && ex.message ? ex.message : 'መመዝገብ አልተቻለም');
            }
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-user-plus"></i> ተመዝገብ';
        });
    }

    /* የይለፍ ቃል መልሶ ማግኛ — በ Worker (requestReset / confirmReset) */
    function forgot() {
        const html = `
            <div id="fpStep1">
                <p class="text-muted" style="margin-bottom:10px;">በተመዘገቡበት ስልክ ቁጥር ኮድ ይላካል።</p>
                <div class="form-group"><label>📱 ስልክ ቁጥር</label><input type="tel" id="fpPhone" placeholder="09XXXXXXXX" /></div>
                <button class="btn btn-primary btn-block" id="fpSendBtn" onclick="HE._fpSend()">ኮድ ላክ</button>
            </div>
            <div id="fpStep2" style="display:none;">
                <div class="form-group"><label>🔢 የደረሰዎት ኮድ</label><input type="text" id="fpCode" /></div>
                <div class="form-group"><label>🔒 አዲስ የይለፍ ቃል</label><input type="password" id="fpNew" autocomplete="new-password" /></div>
                <div class="form-group"><label>🔒 አረጋግጡ</label><input type="password" id="fpConfirm" autocomplete="new-password" /></div>
                <button class="btn btn-success btn-block" id="fpResetBtn" onclick="HE._fpConfirm()">ቀይር</button>
            </div>
            <div class="he-err" id="fpErr"></div>`;
        openModal('❓ የይለፍ ቃል መልሶ ማግኛ', html);
    }
    async function _fpSend() {
        const err = document.getElementById('fpErr'); err.textContent = '';
        const phone = document.getElementById('fpPhone').value.trim();
        if (!phone) { err.textContent = '❌ ስልክ ቁጥር ያስገቡ'; return; }
        try {
            const r = await callWorker('requestReset', { phone });
            if (r && r.ok) { window._fpPhone = phone; document.getElementById('fpStep1').style.display = 'none'; document.getElementById('fpStep2').style.display = ''; }
            else err.textContent = '⛔ ብዙ ሙከራ ተደርጓል፤ ቆይተው ይሞክሩ';
        } catch (e) { err.textContent = '❌ ' + e.message; }
    }
    async function _fpConfirm() {
        const err = document.getElementById('fpErr'); err.textContent = '';
        const code = document.getElementById('fpCode').value.trim(), nw = document.getElementById('fpNew').value, cf = document.getElementById('fpConfirm').value;
        if (!code || !nw) { err.textContent = '❌ ሁሉንም ይሙሉ'; return; }
        if (nw.length < 8) { err.textContent = '❌ የይለፍ ቃል ቢያንስ 8 ፊደል ይሁን'; return; }
        if (nw !== cf) { err.textContent = '❌ ሁለቱ የይለፍ ቃሎች አይመሳሰሉም'; return; }
        try {
            const r = await callWorker('confirmReset', { phone: window._fpPhone, code, newPassword: nw });
            if (r && r.ok) { closeModal(); showToast('✅ የይለፍ ቃል ተቀይሯል — አሁን ይግቡ', 'success'); document.getElementById('heLoginPhone').value = window._fpPhone || ''; }
            else err.textContent = '❌ ኮዱ ትክክል አይደለም ወይም ጊዜው አልፎበታል';
        } catch (e) { err.textContent = '❌ ' + e.message; }
    }

    async function logout() { await heLogout(); location.reload(); }
    return { boot, logout, pane, forgot, _fpSend, _fpConfirm };
})();
