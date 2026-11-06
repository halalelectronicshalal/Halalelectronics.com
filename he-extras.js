/**
 * ሀላል ኤሌክትሮኒክስ — የጋራ ተጨማሪዎች (እንደ ቴክኒሻን ገጽ)
 *  1) 🌙/☀️ የማታ እና የቀን (Dark/Light) መቀያየሪያ
 *  2) ✈️ የቴሌግራም ቦት ማገናኛ
 * ለ operator.html · finance.html · new-orders.html · new-entry.html ብቻ ይጫናል።
 * ሌላ ነባር ኮድ አይነካም፤ ሁሉም በራሱ ተጨምሮ ይሰራል (callWorker, db, heGetSession ከገጹ ይጠቀማል)።
 */
(function () {
    'use strict';

    var THEME_KEY = 'halal_theme';          // ከ technician.html ጋር አንድ ቁልፍ — ምርጫው ይጋራል
    var BOT_USERNAME = 'HalAlElectronics_bot';

    /* ------------------------------------------------------------
       ዘይቤ (CSS)
       ------------------------------------------------------------ */
    var css = '' +
        /* ጨለማ ገጽታ — he-common.css ገጾች (--text-muted) እና operator.html (--muted) ሁለቱንም ይሸፍናል */
        'html[data-theme="dark"]{--bg:#12181F;--card:#1B2430;--text:#E7ECF2;--text-muted:#A9B4C0;--muted:#A9B4C0;--border:#2B3745;--border-light:#232D3A;color-scheme:dark}' +
        /* ብርሃን ገጽታ — ስልኩ dark ሆኖ ተጠቃሚው ☀️ ከመረጠ */
        'html[data-theme="light"]{--bg:#F1F5F9;--card:#fff;--text:#1F2937;--text-muted:#64748B;--muted:#64748B;--border:#E2E8F0;--border-light:#EEF2F7;color-scheme:light}' +
        'html[data-theme="dark"] input,html[data-theme="dark"] select,html[data-theme="dark"] textarea{background:var(--card);color:var(--text)}' +
        'html[data-theme="dark"] img{filter:brightness(.92) contrast(1.02)}' +
        /* operator.html ውስጥ በጠንካራ ቀለም (#fff) የተጻፉ ክፍሎች */
        'html[data-theme="dark"] .seg button,html[data-theme="dark"] .jf button,html[data-theme="dark"] .job,html[data-theme="dark"] .nbtn,html[data-theme="dark"] .login-box{background:var(--card)}' +
        'html[data-theme="dark"] .job.bad{background:#3A1D1F;border-color:#7F2D33}' +
        'html[data-theme="dark"] .job .note{background:#1F2A44;color:var(--text)}' +
        'html[data-theme="dark"] .job .why{background:#3B2F12;color:#FCD34D}' +
        'html[data-theme="dark"] .stat{background:var(--bg)}' +
        'html[data-theme="dark"] .st.ok{background:#12351F;color:#86EFAC}html[data-theme="dark"] .st.wait{background:#3B2F12;color:#FCD34D}' +
        'html[data-theme="dark"] .st.as{background:#14284A;color:#93C5FD}html[data-theme="dark"] .st.no{background:#3A1D1F;color:#FCA5A5}html[data-theme="dark"] .st.pur{background:#2A2150;color:#C4B5FD}' +
        'html[data-theme="dark"] .status-pending{background:#3B2F12;color:#FCD34D}html[data-theme="dark"] .status-completed{background:#12351F;color:#86EFAC}html[data-theme="dark"] .status-assigned{background:#14284A;color:#93C5FD}' +
        'html[data-theme="dark"] .op-note{background:#1F2A44!important;color:var(--text)!important}' +
        /* ቁልፎች */
        '.he-fab{position:fixed;bottom:16px;z-index:9999;width:48px;height:48px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1.25rem;cursor:pointer;box-shadow:0 8px 30px rgba(0,0,0,.28);transition:transform .2s ease;padding:0;line-height:1}' +
        '.he-fab:hover{transform:scale(1.08)}.he-fab:active{transform:scale(.95)}' +
        '#heThemeBtn{right:16px;background:var(--card);color:var(--text);border:2px solid var(--border)}' +
        '#heTgBtn{right:72px;background:#0088cc;color:#fff;border:2px solid #0088cc;font-size:1.35rem}' +
        '#heTgBtn .he-dot{position:absolute;top:-2px;right:-2px;width:14px;height:14px;border-radius:50%;background:#DC2626;border:2px solid #fff}' +
        '#heTgBtn.ok .he-dot{background:#16A34A}' +
        /* ማሳሰቢያ (banner) */
        '#heTgBanner{display:none;margin:12px;padding:12px 14px;border-radius:14px;background:linear-gradient(135deg,#0088cc,#005f8f);color:#fff}' +
        '#heTgBanner .row{display:flex;align-items:center;gap:12px;flex-wrap:wrap}' +
        '#heTgBanner i{font-size:1.9rem}#heTgBanner .txt{flex:1;min-width:200px;font-size:.85rem}#heTgBanner .txt b{display:block;font-size:1rem}' +
        '#heTgBanner button{background:#fff;color:#0088cc;font-weight:700;border:0;border-radius:10px;padding:9px 14px;cursor:pointer;font-size:.88rem}' +
        /* modal */
        '#heTgModal{display:none;position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:100002;align-items:center;justify-content:center;padding:16px}' +
        '#heTgModal.show{display:flex}' +
        '#heTgModal .box{background:var(--card);color:var(--text);border-radius:16px;max-width:420px;width:100%;padding:20px;box-shadow:0 20px 50px rgba(0,0,0,.35)}' +
        '#heTgModal h3{margin:0 0 10px;font-size:1.1rem}' +
        '#heTgModal p{margin:0 0 12px;font-size:.88rem;line-height:1.6}' +
        '#heTgModal .btn2{display:block;width:100%;border:0;border-radius:10px;padding:12px;font-weight:700;cursor:pointer;text-align:center;text-decoration:none;font-size:.95rem;margin-top:8px;box-sizing:border-box}' +
        '#heTgModal .b-tg{background:#0088cc;color:#fff}#heTgModal .b-cp{background:var(--border);color:var(--text)}#heTgModal .b-x{background:transparent;color:var(--text-muted,var(--muted));border:1.5px solid var(--border)}' +
        '#heTgModal input{width:100%;padding:10px;border:1.5px solid var(--border);border-radius:10px;font-size:.82rem;box-sizing:border-box}' +
        '#heTgModal .badge{display:inline-block;border-radius:6px;padding:2px 9px;font-size:.78rem;font-weight:700}' +
        '#heTgModal .badge.ok{background:#DCFCE7;color:#166534}#heTgModal .badge.no{background:#FEF3C7;color:#92400E}' +
        '#heExToast{position:fixed;left:50%;bottom:76px;transform:translateX(-50%);background:#1F2937;color:#fff;padding:11px 16px;border-radius:10px;z-index:100003;display:none;max-width:90%;text-align:center;font-size:.9rem;font-weight:600}';

    var styleEl = document.createElement('style');
    styleEl.textContent = css;
    document.head.appendChild(styleEl);

    /* ------------------------------------------------------------
       1) ቀን / ማታ መቀያየሪያ
       ------------------------------------------------------------ */
    var themeBtn = null;
    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        if (themeBtn) themeBtn.textContent = theme === 'dark' ? '☀️' : '🌙';
    }
    (function initThemeEarly() {
        var saved = null;
        try { saved = localStorage.getItem(THEME_KEY); } catch (e) {}
        var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        applyTheme(saved || (prefersDark ? 'dark' : 'light'));
    })();

    function mountThemeBtn() {
        themeBtn = document.createElement('button');
        themeBtn.type = 'button';
        themeBtn.id = 'heThemeBtn';
        themeBtn.className = 'he-fab';
        themeBtn.title = 'ገጽታ ቀይር';
        themeBtn.setAttribute('aria-label', 'Toggle dark/light mode');
        themeBtn.textContent = document.documentElement.getAttribute('data-theme') === 'dark' ? '☀️' : '🌙';
        themeBtn.addEventListener('click', function () {
            var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
            applyTheme(next);
            try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
        });
        document.body.appendChild(themeBtn);
    }

    /* ------------------------------------------------------------
       2) የቴሌግራም ቦት ማገናኛ
       ------------------------------------------------------------ */
    var tgBtn = null, banner = null, modal = null, connected = false, polling = null;

    function say(msg) {
        var t = document.getElementById('heExToast');
        if (!t) { t = document.createElement('div'); t.id = 'heExToast'; document.body.appendChild(t); }
        t.textContent = msg; t.style.display = 'block';
        clearTimeout(say._t); say._t = setTimeout(function () { t.style.display = 'none'; }, 4500);
    }
    function session() { try { return (typeof heGetSession === 'function') ? heGetSession() : null; } catch (e) { return null; } }
    function me() { var s = session(); return s && s.staff ? s.staff : null; }
    function connectLink(id) { return 'https://t.me/' + BOT_USERNAME + '?start=' + id; }

    function mountTelegramUI() {
        tgBtn = document.createElement('button');
        tgBtn.type = 'button';
        tgBtn.id = 'heTgBtn';
        tgBtn.className = 'he-fab';
        tgBtn.title = 'Telegram ማገናኛ';
        tgBtn.setAttribute('aria-label', 'Telegram');
        tgBtn.style.display = 'none';
        tgBtn.innerHTML = '<i class="fab fa-telegram"></i><span class="he-dot"></span>';
        tgBtn.addEventListener('click', openModal);
        document.body.appendChild(tgBtn);

        banner = document.createElement('div');
        banner.id = 'heTgBanner';
        banner.innerHTML = '<div class="row"><i class="fab fa-telegram"></i>' +
            '<div class="txt"><b>📲 Telegram ገና አልተገናኘም!</b>ማሳወቂያ በቀጥታ ወደ እርስዎ Telegram እንዲደርስ አሁን ያገናኙ።</div>' +
            '<button type="button" id="heTgBannerBtn"><i class="fab fa-telegram"></i> አሁን አገናኝ</button></div>';
        var hdr = document.querySelector('header');
        if (hdr && hdr.parentNode) hdr.parentNode.insertBefore(banner, hdr.nextSibling);
        else document.body.insertBefore(banner, document.body.firstChild);
        banner.querySelector('#heTgBannerBtn').addEventListener('click', connectNow);

        modal = document.createElement('div');
        modal.id = 'heTgModal';
        modal.innerHTML = '<div class="box"><h3><i class="fab fa-telegram" style="color:#0088cc"></i> Telegram ማገናኛ</h3>' +
            '<p>ሁኔታ፦ <span id="heTgState" class="badge no">❌ አልተገናኘም</span></p>' +
            '<div id="heTgConnectPart">' +
            '<p>«አገናኝ» ን ይጫኑ፣ Telegram ይከፈትልዎታል፣ እዚያ ላይ <b>Start</b> ይጫኑ — ወዲያውኑ ራስ-ሰር ይገናኛል (ወደዚህ ገጽ ተመልሰው ትንሽ ይጠብቁ)።</p>' +
            '<button type="button" class="btn2 b-tg" id="heTgGo"><i class="fab fa-telegram"></i> አገናኝ</button>' +
            '<p style="margin:12px 0 4px;font-size:.78rem;opacity:.8">ወይም ይህን ማገናኛ ራስዎ ይክፈቱ፦</p>' +
            '<input type="text" id="heTgLink" readonly />' +
            '<button type="button" class="btn2 b-cp" id="heTgCopy"><i class="fas fa-copy"></i> ማገናኛ ቅዳ</button></div>' +
            '<button type="button" class="btn2 b-x" id="heTgClose">ዝጋ</button></div>';
        document.body.appendChild(modal);
        modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); });
        modal.querySelector('#heTgClose').addEventListener('click', closeModal);
        modal.querySelector('#heTgGo').addEventListener('click', connectNow);
        modal.querySelector('#heTgCopy').addEventListener('click', function () {
            var u = me(); if (!u) return;
            try { navigator.clipboard.writeText(connectLink(u.id)); say('✅ ማገናኛው ተቀድቷል'); } catch (e) { modal.querySelector('#heTgLink').select(); }
        });
    }
    function openModal() {
        var u = me(); if (!u) return;
        modal.querySelector('#heTgLink').value = connectLink(u.id);
        paintState();
        modal.classList.add('show');
    }
    function closeModal() { if (modal) modal.classList.remove('show'); }

    function paintState() {
        if (!tgBtn) return;
        tgBtn.classList.toggle('ok', connected);
        var st = modal && modal.querySelector('#heTgState');
        if (st) { st.className = 'badge ' + (connected ? 'ok' : 'no'); st.textContent = connected ? '✅ ተገናኝቷል' : '❌ አልተገናኘም'; }
        var part = modal && modal.querySelector('#heTgConnectPart');
        if (part) part.style.display = connected ? 'none' : '';
        if (banner) banner.style.display = (connected || !me() || knownState !== 'loaded') ? 'none' : 'block';
    }

    var knownState = 'unknown'; // unknown | loaded
    async function refreshStatus() {
        var u = me();
        if (!u) {
            if (tgBtn) tgBtn.style.display = 'none';
            if (banner) banner.style.display = 'none';
            knownState = 'unknown';
            return;
        }
        if (tgBtn) tgBtn.style.display = 'flex';
        try {
            if (typeof authReady !== 'undefined') await authReady;
            var d = await db.collection('staff').doc(u.id).get();
            connected = !!(d.exists && d.data().chatId);
            knownState = 'loaded';
        } catch (e) { console.warn('telegram status read failed', e); }
        paintState();
    }

    // Worker ጥሪ — session ጊዜው ካለፈ አንድ ጊዜ አድሶ እንደገና ይሞክራል (technician.html ጋር ተመሳሳይ)
    async function pollFn(payload) {
        var r = await callWorker('telegramConnectPoll', payload);
        if (r && (r.error === 'forbidden' || r.error === 'unauthorized')) {
            try {
                var sr = await callWorker('session', {});
                if (sr && sr.ok) {
                    heSetSession(sr);
                    if (sr.firebaseToken) { try { await firebase.auth().signInWithCustomToken(sr.firebaseToken); } catch (e) {} }
                    r = await callWorker('telegramConnectPoll', payload);
                }
            } catch (e) {}
        }
        return r;
    }

    async function connectNow() {
        var u = me();
        if (!u) { say('⚠️ እባክዎ እንደገና ይግቡ'); return; }
        if (polling) { say('⏳ በመጠባበቅ ላይ ነው — Telegram ላይ «Start» ይጫኑ'); return; }
        var id = u.id, name = u.name || '';
        window.open(connectLink(id), '_blank');
        say('📲 Telegram ተከፍቷል! «Start» የሚለውን ይጫኑ — ወዲያውኑ ራስ-ሰር ይገናኛል');

        var busyEls = [document.getElementById('heTgBannerBtn'), document.getElementById('heTgGo')];
        var orig = busyEls.map(function (b) { return b ? b.innerHTML : ''; });
        function setBusy(on) {
            busyEls.forEach(function (b, i) {
                if (!b) return;
                b.disabled = on;
                b.innerHTML = on ? '<i class="fas fa-spinner fa-spin"></i> በመጠባበቅ ላይ...' : orig[i];
            });
        }
        setBusy(true);
        polling = true;
        function finish(ok) {
            polling = null;
            setBusy(false);
            if (ok) { connected = true; knownState = 'loaded'; paintState(); say('🎉 Telegram ተገናኝቷል! ከአሁን ጀምሮ ማሳወቂያ ይደርስዎታል'); }
        }

        var clearRes;
        try { clearRes = await pollFn({ technicianId: id, clearWebhookFirst: true }); } catch (e) { clearRes = { error: 'network' }; }
        if (clearRes && clearRes.error) {
            finish(false);
            say(clearRes.error === 'network'
                ? '❌ ከ Worker ጋር መገናኘት አልተቻለም። ኢንተርኔት ወይም CORS (ALLOWED_ORIGINS) ያረጋግጡ'
                : (clearRes.error === 'forbidden' || clearRes.error === 'unauthorized')
                    ? '⛔ ፈቃድ የለም — ወጥተው እንደገና ይግቡ። Worker ለዚህ አካውንት ቴሌግራም ማገናኘትን ካልፈቀደ አድሚኑን ያነጋግሩ'
                    : '❌ Worker ስህተት፦ ' + clearRes.error);
            return;
        }
        await new Promise(function (r) { setTimeout(r, 800); });

        var attempts = 0, maxAttempts = 30, errorStreak = 0;
        var expectedText = '/start ' + id;
        var expectedTextWithMention = '/start@' + BOT_USERNAME + ' ' + id;
        var timer = setInterval(async function () {
            attempts++;
            try {
                var res = await pollFn({ technicianId: id, technicianName: name, expectedText: expectedText, expectedTextWithMention: expectedTextWithMention });
                var status = res && res.status;
                if (res && (res.error || status === 'error')) {
                    if (++errorStreak >= 3) { clearInterval(timer); finish(false); say('❌ Telegram ስህተት፦ ' + (res.error || 'unknown')); return; }
                } else { errorStreak = 0; }
                if (status === 'connected' && res.chatId) {
                    clearInterval(timer);
                    try { await db.collection('staff').doc(id).update({ chatId: res.chatId, telegramConnectedAt: new Date() }); }
                    catch (e) { console.warn('⚠️ chatId save failed:', e); }
                    finish(true);
                    return;
                }
            } catch (e) { /* network hiccup — መሞከር ይቀጥላል */ }
            if (attempts >= maxAttempts) {
                clearInterval(timer);
                finish(false);
                say('⚠️ አልተገናኘም። Telegram ላይ «Start» መጫንዎን ያረጋግጡ እና ዳግም ይሞክሩ');
            }
        }, 3000);
    }

    /* ------------------------------------------------------------
       ማስነሻ
       ------------------------------------------------------------ */
    function init() {
        mountThemeBtn();
        mountTelegramUI();
        refreshStatus();
        // ገጹ ከገባ/ከወጣ በኋላ (login/logout) ሁኔታውን ያድሳል
        var last = null;
        setInterval(function () {
            var u = me(), key = u ? u.id : '';
            if (key !== last) { last = key; connected = false; knownState = 'unknown'; refreshStatus(); }
        }, 1500);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
