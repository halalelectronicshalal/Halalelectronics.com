/**
 * 🕘 he-history.js — የስራ (order) ሂስትሪ በራስ-ሰር መመዝገብ
 * ------------------------------------------------------------------
 * በ orders ላይ የሚደረግ ማንኛውም ለውጥ (መመዝገብ፣ መመደብ፣ መመለስ፣ ማጠናቀቅ፣ ቀጠሮ፣ መያዝ…) በሰነዱ ውስጥ `history` ዝርዝር ላይ
 * { at, by, ev, text, status, tech } ተብሎ ይጨመራል። ያለፈው ታሪክ አይሰረዝም (arrayUnion)።
 * ስራው ወደ ሪሳይክል ቢን ሲሄድ/ሲመለስ ሰነዱ ሙሉ በሙሉ ስለሚገለበጥ ታሪኩ አብሮ ይሄዳል።
 * ይህ ፋይል firebase-firestore-compat.js ከተጫነ በኋላ ይጫን።
 */
(function () {
  if (window.__heHistoryInstalled) return;
  var F = window.firebase && window.firebase.firestore;
  if (!F) return;
  window.__heHistoryInstalled = true;

  var ST = {
    Pending: '⏳ ያልተመደበ (ወደ አድሚን ተመልሷል)', Assigned: '📋 ተመድቧል', Completed: '✅ ተጠናቋል',
    PriceNotAgreed: '💰 ዋጋ አልተስማሙም', Rescheduled: '📅 ለሌላ ቀን ተዘጋጅቷል', NotToday: '📝 ዛሬ አይመቻቸውም',
    PhoneNoAnswer: '📵 ስልክ አይነሳም', Other: '📌 ሌላ ምክንያት', Cancelled: '❌ ተሰርዟል'
  };

  function actor() {
    try { if (typeof window.heActorName === 'function') return String(window.heActorName()); } catch (e) {}
    try { if (typeof window.heUserName === 'function') return String(window.heUserName()); } catch (e) {}
    try { var s = typeof window.heGetSession === 'function' ? window.heGetSession() : null; if (s && s.staff && s.staff.name) return String(s.staff.name); } catch (e) {}
    try { if (typeof technicianName !== 'undefined' && technicianName) return String(technicianName); } catch (e) {}
    return '';
  }
  function str(v) { return typeof v === 'string' ? v : ''; }

  function describe(d) {
    var keys = ['status', 'technician', 'scheduledTechnician', 'onHold', 'returnReason', 'holdRequest.status', 'rescheduledDate', 'convertedInReportId', 'price'];
    if (!keys.some(function (k) { return k in d; })) return null;
    var st = str(d.status), parts = [];
    if (st) parts.push(ST[st] || st);
    if (str(d.technician)) parts.push('👷 ' + d.technician);
    if (str(d.returnedFrom)) parts.push('ከ ' + d.returnedFrom);
    if (str(d.returnReason)) parts.push('ምክንያት: ' + d.returnReason);
    if (str(d.scheduledTechnician)) parts.push('📅 ለ ' + d.scheduledTechnician + ' ተይዟል' + (str(d.scheduledReleaseDate) ? ' (' + d.scheduledReleaseDate + ')' : ''));
    if (d.onHold === true) parts.push('📦 ከቴክኒሻኑ ጋር ተይዟል');
    else if (d.onHold === false && !st) parts.push('▶️ መያዝ ተነስቷል');
    if (str(d['holdRequest.status'])) parts.push('📨 የጥያቄ ውሳኔ: ' + d['holdRequest.status']);
    if (str(d.rescheduledDate)) parts.push('📅 ቀጠሮ ' + d.rescheduledDate);
    if (d.convertedInReportId) parts.push('🔄 ወደ አጠናቅ ተቀየረ');
    if (typeof d.price === 'number' || (typeof d.price === 'string' && d.price)) parts.push('💰 ዋጋ ' + d.price);
    if (!parts.length) return null;
    var via = str(d.assignedBy) || str(d.returnedToAdminVia) || '';
    return { at: Date.now(), by: actor(), ev: st || 'update', text: parts.join(' • '), status: st, tech: str(d.technician), via: via };
  }

  function withHistory(data) {
    try {
      if (!data || typeof data !== 'object' || 'history' in data) return data;
      var e = describe(data);
      if (!e) return data;
      return Object.assign({}, data, { history: F.FieldValue.arrayUnion(e) });
    } catch (err) { return data; }
  }

  // DocumentReference.update(data)
  var DR = F.DocumentReference && F.DocumentReference.prototype;
  if (DR && DR.update) {
    var dUpd = DR.update;
    DR.update = function (a) {
      if (arguments.length === 1 && this.parent && this.parent.id === 'orders') return dUpd.call(this, withHistory(a));
      return dUpd.apply(this, arguments);
    };
  }
  // WriteBatch.update(ref, data) / Transaction.update(ref, data)
  ['WriteBatch', 'Transaction'].forEach(function (nm) {
    var P = F[nm] && F[nm].prototype;
    if (!P || !P.update) return;
    var o = P.update;
    P.update = function (ref, a) {
      if (arguments.length === 2 && ref && ref.parent && ref.parent.id === 'orders') return o.call(this, ref, withHistory(a));
      return o.apply(this, arguments);
    };
  });
  // CollectionReference.add(data) — አዲስ ስራ ሲመዘገብ የመጀመሪያው ታሪክ
  var CR = F.CollectionReference && F.CollectionReference.prototype;
  if (CR && CR.add) {
    var cAdd = CR.add;
    CR.add = function (data) {
      try {
        if (this.id === 'orders' && data && typeof data === 'object' && !data.history) {
          var by = actor() || (data.createdByName || (data.createdBy === 'admin' ? 'አስተዳዳሪ' : 'ደንበኛ'));
          var src = data.source ? ' (' + data.source + ')' : '';
          var h = [{ at: Date.now(), by: by, ev: 'created', status: str(data.status) || 'Pending', text: '🆕 ስራ ተመዝግቧል' + src + (str(data.appliance) ? ' • ' + data.appliance : '') }];
          if (str(data.technician)) h.push({ at: Date.now() + 1, by: by, ev: 'Assigned', status: 'Assigned', tech: data.technician, text: '📋 ተመድቧል • 👷 ' + data.technician });
          data = Object.assign({}, data, { history: h });
        }
      } catch (e) {}
      return cAdd.call(this, data);
    };
  }

  /** ለማሳያ፦ ታሪኩን ወደ HTML ይቀይራል (ለድሮ ስራዎች ከ timestamp መስኮች ይሞላል) */
  window.heOrderHistoryHtml = function (o, fmt) {
    function ms(v) { return v && v.toDate ? v.toDate().getTime() : (typeof v === 'number' ? v : (v ? (new Date(v).getTime() || 0) : 0)); }
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    var rows = Array.isArray(o && o.history) ? o.history.slice() : [];
    if (!rows.length) { // ከዚህ ዝመና በፊት የነበሩ ስራዎች
      if (ms(o.createdAt)) rows.push({ at: ms(o.createdAt), by: o.createdByName || '', text: '🆕 ስራ ተመዝግቧል' });
      if (ms(o.returnedAt)) rows.push({ at: ms(o.returnedAt), by: o.returnedFrom || '', text: '↩️ ተመልሷል' + (o.returnReason ? ' • ምክንያት: ' + o.returnReason : '') });
      if (ms(o.assignedAt) && o.technician) rows.push({ at: ms(o.assignedAt), by: '', text: '📋 ተመድቧል • 👷 ' + o.technician });
      if (ms(o.completedAt)) rows.push({ at: ms(o.completedAt), by: o.technician || '', text: '✅ ተጠናቋል' });
    }
    rows.sort(function (a, b) { return ms(a.at) - ms(b.at); });
    if (!rows.length) return '<p style="color:#64748B;font-size:0.85rem;">ታሪክ የለም</p>';
    return rows.map(function (r) {
      var t = ms(r.at), when = t ? (typeof fmt === 'function' ? fmt(new Date(t)) : new Date(t).toLocaleString()) : '';
      return '<div style="padding:6px 0;border-bottom:1px dashed #E2E8F0;font-size:0.85rem;"><div>' + esc(r.text || r.ev || '') + '</div><div style="color:#64748B;font-size:0.75rem;">🕒 ' + esc(when) + (r.by ? ' • 👤 ' + esc(r.by) : '') + '</div></div>';
    }).join('');
  };
})();
