/**
 * ሀላል ኤሌክትሮኒክስ — 🔄 አዲስ ስሪት ማሳወቂያ
 * አዲስ ኮድ ሲሰማራ (deploy) የተከፈተው/የተጫነው App ራሱ ይፈትሻል፤ አዲስ ስሪት ካለ
 * ከታች «🔄 አዲስ ስሪት አለ» ባነር + «አሁን አድስ» ቁልፍ ያሳያል። ተጠቃሚው ሲነካ ብቻ ይታደሳል
 * (እየተሞላ ያለ ሪፖርት በድንገት እንዳይጠፋ በራሱ አይታደስም)።
 * ምንም የስሪት ቁጥር መቀየር አያስፈልግም — የገጹን ፋይል አሻራ (ETag/Last-Modified) በማነጻጸር ነው የሚያውቀው።
 */
(function () {
    'use strict';
    if (window.__heUpdateInit) return; window.__heUpdateInit = true;

    var FILES = [location.pathname.split('/').pop() || 'index.html', 'he-common.js', 'service-worker.js'];
    var CHECK_EVERY = 5 * 60 * 1000;   // በየ 5 ደቂቃው
    var MIN_GAP = 60 * 1000;           // ከአንድ ፍተሻ በኋላ ቢያንስ 1 ደቂቃ
    var LATER_MS = 30 * 60 * 1000;     // «በኋላ» ካለ ከ 30 ደቂቃ በኋላ ድጋሜ ያሳያል
    var base = null, lastCheck = 0, laterUntil = 0, shown = false, busy = false;

    function sigOf(url) {
        return fetch(url + (url.indexOf('?') < 0 ? '?' : '&') + '_hv=' + Date.now(), { method: 'HEAD', cache: 'no-store' })
            .then(function (r) {
                if (!r.ok) return null;
                var s = (r.headers.get('etag') || '') + '|' + (r.headers.get('last-modified') || '') + '|' + (r.headers.get('content-length') || '');
                if (s === '||') return null;
                return s;
            }).catch(function () { return null; });
    }
    function sigAll() {
        return Promise.all(FILES.map(sigOf)).then(function (a) { return a.some(function (x) { return x; }) ? a.join('#') : null; });
    }

    function showBanner() {
        if (shown || document.getElementById('heUpdBar')) return;
        shown = true;
        var d = document.createElement('div');
        d.id = 'heUpdBar';
        d.setAttribute('style', 'position:fixed;left:8px;right:8px;bottom:72px;z-index:2147483000;background:#0b5ed7;color:#fff;border-radius:14px;padding:12px 14px;box-shadow:0 6px 24px rgba(0,0,0,.35);font:600 14px/1.5 system-ui,sans-serif;text-align:center');
        d.innerHTML = '🔄 አዲስ ስሪት አለ!<div style="font-weight:400;font-size:12px;margin:2px 0 8px">ሪፖርት እየሞሉ ከሆነ መጀመሪያ ይላኩት፣ ከዚያ ያድሱ።</div>' +
            '<button id="heUpdNow" style="background:#fff;color:#0b5ed7;border:0;border-radius:10px;padding:8px 16px;font-weight:700;margin:0 4px">አሁን አድስ</button>' +
            '<button id="heUpdLater" style="background:transparent;color:#fff;border:1px solid rgba(255,255,255,.7);border-radius:10px;padding:8px 14px;margin:0 4px">በኋላ</button>';
        document.body.appendChild(d);
        document.getElementById('heUpdLater').onclick = function () {
            d.remove(); shown = false; laterUntil = Date.now() + LATER_MS;
        };
        document.getElementById('heUpdNow').onclick = doUpdate;
    }

    function doUpdate() {
        var b = document.getElementById('heUpdNow');
        if (b) { b.disabled = true; b.textContent = '⏳ በማደስ ላይ…'; }
        var p = [];
        try { if (window.caches) p.push(caches.keys().then(function (ks) { return Promise.all(ks.map(function (k) { return caches.delete(k); })); })); } catch (e) {}
        try {
            if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations)
                p.push(navigator.serviceWorker.getRegistrations().then(function (rs) { return Promise.all(rs.map(function (r) { return r.update().catch(function () {}); })); }));
        } catch (e) {}
        // የአሳሹ HTTP መሸጎጫ ውስጥ ያለውን የድሮ ፋይል ለማደስ
        FILES.forEach(function (f) { p.push(fetch(f, { cache: 'reload' }).catch(function () {})); });
        var done = false;
        function go() { if (done) return; done = true; location.reload(); }
        Promise.all(p).then(go, go);
        setTimeout(go, 6000);
    }

    function check(force) {
        var now = Date.now();
        if (busy || shown || document.hidden) return;
        if (!force && (now - lastCheck < MIN_GAP || now < laterUntil)) return;
        busy = true; lastCheck = now;
        sigAll().then(function (s) {
            busy = false;
            if (!s) return;
            if (base === null) { base = s; return; }
            if (s !== base) showBanner();
        }).catch(function () { busy = false; });
    }

    function start() {
        sigAll().then(function (s) { if (s) base = s; });
        setInterval(function () { check(false); }, CHECK_EVERY);
        document.addEventListener('visibilitychange', function () { if (!document.hidden) check(false); });
        window.addEventListener('online', function () { check(false); });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
