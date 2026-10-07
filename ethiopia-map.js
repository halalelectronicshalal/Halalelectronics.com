/**
 * Halal Electronics — የጋራ የካርታ እገዛ (Leaflet + OpenStreetMap, ለኢትዮጵያ የተስተካከለ)
 * ------------------------------------------------------------------
 * Leaflet (leaflet.js) ከዚህ ፋይል በፊት መጫን አለበት።
 *
 *   const map = HEMap.create(el);                       // አዲስ አበባ፣ zoom 12
 *   const map = HEMap.create(el, { view: "country" });  // መላ ኢትዮጵያ
 *   const map = HEMap.create(el, { restrict: false });  // ከኢትዮጵያ ውጭ መሄድ ይፈቀድ
 *   HEMap.fitPoints(map, [[9.03, 38.74], ...]);
 */
(function (w) {
  "use strict";
  if (!w.L) { console.error("HEMap: Leaflet አልተጫነም"); return; }

  /* ኢትዮጵያ (ከድንበር ትንሽ ሰፋ ያለ): [ደቡብ-ምዕራብ], [ሰሜን-ምስራቅ] */
  var ETHIOPIA_BOUNDS = L.latLngBounds([3.2, 32.8], [15.2, 48.3]);
  var ETHIOPIA_CENTER = [9.145, 40.49];   // የአገሪቱ ማዕከል
  var ADDIS_CENTER = [9.0300, 38.7469];   // አዲስ አበባ (መስቀል አደባባይ አካባቢ)

  /* ⚠️ የሱቁ ግምታዊ ቦታ (ኮልፌ ቀራኒዮ)። ትክክለኛውን ከ Google/OSM ላይ ገልብጠው እዚህ ያስተካክሉ */
  var SHOP = { lat: 9.0130, lng: 38.7030, name: "HalAl Electronic & Maintenance" };

  var VIEWS = {
    addis:   { center: ADDIS_CENTER,   zoom: 12 },
    country: { center: ETHIOPIA_CENTER, zoom: 6 }
  };

  function validCoords(lat, lng) {
    lat = Number(lat); lng = Number(lng);
    return isFinite(lat) && isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);
  }
  function inEthiopia(lat, lng) {
    return validCoords(lat, lng) && ETHIOPIA_BOUNDS.contains([Number(lat), Number(lng)]);
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /** opts: { view:'addis'|'country', center, zoom, restrict:true, scale:true } */
  function create(el, opts) {
    opts = opts || {};
    var v = VIEWS[opts.view] || VIEWS.addis;
    var restrict = opts.restrict !== false;

    var map = L.map(el, {
      center: opts.center || v.center,
      zoom: opts.zoom != null ? opts.zoom : v.zoom,
      minZoom: restrict ? 5 : 2,
      maxZoom: 19,
      maxBounds: restrict ? ETHIOPIA_BOUNDS : undefined,
      maxBoundsViscosity: 0.9,
      preferCanvas: true,        // ብዙ ምልክቶች ሲኖሩ ፈጣን
      zoomControl: true,
      attributionControl: true,
      tap: true
    });

    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      keepBuffer: 4,                       // ሲጎትቱ ባዶ ሰሌዳ እንዳይታይ
      updateWhenIdle: L.Browser.mobile,    // ሞባይል ላይ ዳታ ይቆጥባል
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'
    }).addTo(map);

    if (opts.scale !== false) L.control.scale({ metric: true, imperial: false, position: "bottomleft" }).addTo(map);

    // መያዣው መጠኑን ከቀየረ (tab መቀየር፣ ማዞር) ካርታው ራሱ ይስተካከል
    if (w.ResizeObserver) {
      var t;
      new ResizeObserver(function () { clearTimeout(t); t = setTimeout(function () { map.invalidateSize(); }, 80); }).observe(el);
    }
    return map;
  }

  /** ነጥቦችን በሙሉ ማሳየት — አንድ ነጥብ ብቻ ከሆነ ከልክ በላይ አይቀርብም */
  function fitPoints(map, latlngs, opts) {
    opts = opts || {};
    var pts = (latlngs || []).filter(function (p) { return validCoords(p[0], p[1]); });
    if (!pts.length) return false;
    if (pts.length === 1) { map.setView(pts[0], opts.singleZoom || 15); return true; }
    map.fitBounds(L.latLngBounds(pts).pad(0.15), { maxZoom: opts.maxZoom || 16, animate: false });
    return true;
  }

  w.HEMap = {
    create: create, fitPoints: fitPoints,
    validCoords: validCoords, inEthiopia: inEthiopia, esc: esc,
    BOUNDS: ETHIOPIA_BOUNDS, ADDIS_CENTER: ADDIS_CENTER, ETHIOPIA_CENTER: ETHIOPIA_CENTER, SHOP: SHOP
  };
})(window);
