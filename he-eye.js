/**
 * 👁 የይለፍ ቃል ማሳያ/መደበቂያ (ዓይን አይከን) — በሁሉም type="password" ግብዓት ላይ በራስ-ሰር ይጨመራል።
 * አዲስ የሚፈጠሩ ግብዓቶችን (modal ወዘተ) ደግሞ MutationObserver ይይዛቸዋል።
 */
(function () {
    var SVG_EYE = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>';
    var SVG_OFF = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';

    function paint(input, btn) {
        var shown = input.type !== 'password';
        btn.innerHTML = shown ? SVG_OFF : SVG_EYE;
        btn.title = btn.setAttribute('aria-label', shown ? 'የይለፍ ቃል ደብቅ' : 'የይለፍ ቃል አሳይ') || (shown ? 'ደብቅ' : 'አሳይ');
        btn.style.opacity = shown ? '1' : '.6';
    }

    function enhance(input) {
        if (input.dataset.heEye) return;
        input.dataset.heEye = '1';
        var cs = getComputedStyle(input);

        var wrap = document.createElement('span');
        wrap.className = 'he-eye-wrap';
        wrap.style.cssText = 'position:relative;display:' + (cs.display === 'inline-block' || cs.display === 'inline' ? 'inline-block' : 'block') + ';width:100%;box-sizing:border-box;';
        // የግብዓቱን አቀማመጥ ለወላጅ ይውረስ (flex ቦታ፣ ከፍተኛ ስፋት፣ ህዳግ)
        if (input.style.maxWidth) wrap.style.maxWidth = input.style.maxWidth;
        if (input.style.flex) wrap.style.flex = input.style.flex;
        if (input.style.margin) wrap.style.margin = input.style.margin;
        if (input.style.minWidth) wrap.style.minWidth = input.style.minWidth;
        if (cs.flexGrow !== '0' && input.parentElement && getComputedStyle(input.parentElement).display.indexOf('flex') > -1) wrap.style.flex = '1 1 0%';
        input.style.margin = '0';

        input.parentNode.insertBefore(wrap, input);
        wrap.appendChild(input);
        input.style.width = '100%';
        input.style.boxSizing = 'border-box';
        input.style.paddingRight = '44px';

        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'he-eye-btn';
        btn.tabIndex = -1;
        btn.style.cssText = 'position:absolute;right:6px;top:50%;transform:translateY(-50%);width:34px;height:34px;display:flex;align-items:center;justify-content:center;background:transparent;border:0;padding:0;cursor:pointer;color:inherit;border-radius:8px;';
        wrap.appendChild(btn);
        paint(input, btn);

        btn.addEventListener('mousedown', function (e) { e.preventDefault(); });   // focus እንዳይጠፋ
        btn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            input.type = input.type === 'password' ? 'text' : 'password';
            paint(input, btn);
            input.focus();
        });
        // ሌላ ኮድ (ለምሳሌ «አሳይ» checkbox) type ቢቀይር አይከኑ ይዛመድ
        new MutationObserver(function () { paint(input, btn); }).observe(input, { attributes: true, attributeFilter: ['type'] });
    }

    function scan(root) {
        (root.querySelectorAll ? root.querySelectorAll('input[type="password"]') : []).forEach(enhance);
    }
    function start() {
        scan(document);
        new MutationObserver(function (muts) {
            for (var i = 0; i < muts.length; i++) {
                var added = muts[i].addedNodes;
                for (var j = 0; j < added.length; j++) {
                    var n = added[j];
                    if (n.nodeType !== 1) continue;
                    if (n.matches && n.matches('input[type="password"]')) enhance(n); else scan(n);
                }
            }
        }).observe(document.documentElement, { childList: true, subtree: true });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
