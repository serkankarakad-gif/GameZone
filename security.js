// ============================================================
// TÜRK İMPARATORLUĞU — security.js
// Anti-cheat | DevTools algılama | State bütünlüğü | Rate limit
// Bu dosya data.js'den SONRA, firebase.js'den ÖNCE yüklenir.
// ============================================================
"use strict";

var SEC = (function () {

  // ——— AYARLAR ———
  var CFG = {
    MAX_TL:            1e13,        // 10 trilyon TL üstü = hile
    MAX_ELMAS:         100000,
    MAX_LEVEL:         100,
    MIN_SPEND_INTERVAL:100,         // ms — aynı işlem bu kadar hızlı tekrar edilemez
    MAX_ACTIONS_PER_MIN: 60,        // dakikada max işlem
    DEVTOOLS_CHECK_MS: 2000,        // devtools kontrol aralığı
    KICK_DELAY_MS:     1500,        // kick öncesi bekleme
    WARN_BEFORE_KICK:  2,           // kick öncesi uyarı sayısı
    HASH_CHECK_MS:     15000,       // state hash kontrol aralığı
    SAVE_RATE_LIMIT_MS:5000         // kayıt min aralığı
  };

  var _violations    = 0;
  var _actionLog     = [];          // {ts: timestamp} listesi
  var _lastSpend     = 0;
  var _stateHash     = null;
  var _devOpen       = false;
  var _kicked        = false;
  var _timers        = [];
  var _lastSave      = 0;

  // ══════════════════════════════════════════════════════════
  // 1. DEVTOOLS ALGILAMA
  // ══════════════════════════════════════════════════════════
  function _detectDevTools() {
    // Yöntem A: window boyutu farkı
    var threshold = 160;
    var widthDiff  = window.outerWidth  - window.innerWidth;
    var heightDiff = window.outerHeight - window.innerHeight;
    if (widthDiff > threshold || heightDiff > threshold) return true;

    // Yöntem B: console.log ile obje genişletme tuzağı
    var opened = false;
    var el = document.createElement("div");
    Object.defineProperty(el, "id", {
      get: function () { opened = true; return "ti-trap"; }
    });
    console.log && console.log("%c", el);
    if (opened) return true;

    // Yöntem C: debugger zamanlama
    var t0 = performance.now();
    // eslint-disable-next-line no-debugger
    debugger;
    var t1 = performance.now();
    if (t1 - t0 > 100) return true;

    return false;
  }

  function _startDevToolsWatch() {
    var warns = 0;
    var t = setInterval(function () {
      if (_kicked) return;
      if (_detectDevTools()) {
        if (!_devOpen) {
          _devOpen = true;
          warns++;
          _violation("DevTools açıldı", warns < CFG.WARN_BEFORE_KICK);
        }
      } else {
        _devOpen  = false;
        warns     = 0;
      }
    }, CFG.DEVTOOLS_CHECK_MS);
    _timers.push(t);
  }

  // ══════════════════════════════════════════════════════════
  // 2. STATE HASH — TL / Elmas / Level değişti mi?
  // ══════════════════════════════════════════════════════════
  function _hashState(state) {
    if (!state) return "0";
    try {
      var s = state;
      var raw = [
        Math.round(s.wallet.tl),
        s.profile.level,
        s.profile.elmas,
        Math.round(s.stats.totalEarned),
        Math.round(s.stats.totalSpent)
      ].join("|");
      // Basit 32-bit hash (FNV-1a)
      var h = 0x811c9dc5;
      for (var i = 0; i < raw.length; i++) {
        h ^= raw.charCodeAt(i);
        h = (h * 0x01000193) >>> 0;
      }
      return h.toString(16);
    } catch (e) { return "err"; }
  }

  function captureHash() {
    if (typeof GAME === "undefined" || !GAME.state) return;
    _stateHash = _hashState(GAME.state);
  }

  function _startHashWatch() {
    var t = setInterval(function () {
      if (_kicked || !GAME || !GAME.state) return;
      var current = _hashState(GAME.state);
      if (_stateHash && _stateHash !== "0" && current !== _stateHash) {
        // Hash değişti — legal bir işlem mi?
        // Legal işlemler captureHash() çağırır, bu yüzden hash'i günceller.
        // Eğer burada hâlâ uyuşmuyorsa dışarıdan müdahale var demektir.
        _violation("State tampering — hash uyuşmazlığı", false);
      }
    }, CFG.HASH_CHECK_MS);
    _timers.push(t);
  }

  // ══════════════════════════════════════════════════════════
  // 3. DEĞER SINIR KONTROLLARI (her işlem sonrası çağrılır)
  // ══════════════════════════════════════════════════════════
  function validateState(state) {
    if (!state) return true;
    var p = state.profile;
    var w = state.wallet;

    if (w.tl > CFG.MAX_TL)        { _violation("TL limite aşıldı: " + w.tl, false); return false; }
    if (w.tl < -1e9)               { _violation("TL sınır altı: " + w.tl, false); return false; }
    if (p.elmas > CFG.MAX_ELMAS)   { _violation("Elmas limite aşıldı: " + p.elmas, false); return false; }
    if (p.level > CFG.MAX_LEVEL)   { _violation("Level limite aşıldı: " + p.level, false); return false; }
    if (!isFinite(w.tl))           { _violation("TL NaN/Infinity", false); return false; }
    if (!isFinite(p.elmas))        { _violation("Elmas NaN/Infinity", false); return false; }
    return true;
  }

  // ══════════════════════════════════════════════════════════
  // 4. İŞLEM HIZI SINIRI (spam / bot koruması)
  // ══════════════════════════════════════════════════════════
  function checkRateLimit() {
    var now = Date.now();
    // Son 1 dakikayı filtrele
    _actionLog = _actionLog.filter(function (a) { return now - a < 60000; });
    if (_actionLog.length >= CFG.MAX_ACTIONS_PER_MIN) {
      _violation("Dakikada " + _actionLog.length + " işlem — rate limit", true);
      return false;
    }
    _actionLog.push(now);
    return true;
  }

  function checkSpendInterval() {
    var now = Date.now();
    if (now - _lastSpend < CFG.MIN_SPEND_INTERVAL) return false;
    _lastSpend = now;
    return true;
  }

  function canSave() {
    var now = Date.now();
    if (now - _lastSave < CFG.SAVE_RATE_LIMIT_MS) return false;
    _lastSave = now;
    return true;
  }

  // ══════════════════════════════════════════════════════════
  // 5. CONSOLE OVERRIDE — production'da sessiz hale getir
  // ══════════════════════════════════════════════════════════
  function _muteConsole() {
    // Hata ayıklama amaçlı logları engelle
    // (error hâlâ açık — Firebase hataları görünür kalır)
    var noop = function () {};
    window.console.log   = noop;
    window.console.warn  = noop;
    window.console.debug = noop;
    window.console.info  = noop;
    window.console.table = noop;
    window.console.dir   = noop;
    window.console.group = noop;
  }

  // ══════════════════════════════════════════════════════════
  // 6. GLOBAL OBJELERİ DONDUR (D.CONFIG vs.)
  // ══════════════════════════════════════════════════════════
  function _freezeData() {
    try {
      Object.freeze(D.CONFIG);
      Object.freeze(D.BANKS);
      Object.freeze(D.STOCKS);
      Object.freeze(D.CRYPTOS);
    } catch (e) { /* ignore */ }
  }

  // ══════════════════════════════════════════════════════════
  // 7. SAYFA GÖRÜNÜRLÜK — sekme gizlenince kontrol
  // ══════════════════════════════════════════════════════════
  function _visibilityWatch() {
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) return;
      // Sekme tekrar görünür — hash kontrol et
      if (GAME && GAME.state) {
        var cur = _hashState(GAME.state);
        if (_stateHash && cur !== _stateHash) {
          _violation("Sekme arası state manipülasyonu", false);
        }
      }
    });
  }

  // ══════════════════════════════════════════════════════════
  // 8. İHLAL & KICK
  // ══════════════════════════════════════════════════════════
  function _violation(reason, warn) {
    _violations++;
    console.error("[SEC] İhlal #" + _violations + ": " + reason);

    if (warn && _violations < 3) {
      // Uyar, henüz at ma
      if (typeof UI !== "undefined") {
        UI.toast("⚠️ Şüpheli aktivite tespit edildi! (" + _violations + "/3)", "warning");
      }
      return;
    }

    // KICK
    _kick(reason);
  }

  function _kick(reason) {
    if (_kicked) return;
    _kicked = true;

    // Tüm timer'ları durdur
    _timers.forEach(function (t) { clearInterval(t); clearTimeout(t); });

    // Oyunu durdur
    if (typeof GAME !== "undefined" && GAME.destroy) GAME.destroy();

    // Firebase çıkış
    if (window.fbAuth) {
      window.fbAuth.signOut().catch(function () {});
    }

    // Ekranı kilitle
    var overlay = document.createElement("div");
    overlay.id  = "sec-overlay";
    overlay.style.cssText = [
      "position:fixed","inset:0","background:#000","z-index:99999",
      "display:flex","flex-direction:column","align-items:center",
      "justify-content:center","gap:1.5rem","font-family:sans-serif"
    ].join(";");
    overlay.innerHTML =
      '<div style="font-size:3rem">🚫</div>' +
      '<div style="color:#ef4444;font-size:1.4rem;font-weight:700">GÜVENLİK İHLALİ</div>' +
      '<div style="color:#888;font-size:.92rem;text-align:center;max-width:340px">' +
        'Hesabınızda şüpheli aktivite tespit edildi.<br>' +
        'Güvenliğiniz için oturumunuz sonlandırıldı.' +
      '</div>' +
      '<button onclick="location.reload()" style="padding:.7rem 2rem;background:#c8102e;' +
        'color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:1rem">' +
        'Yeniden Giriş Yap' +
      '</button>';
    document.body.appendChild(overlay);

    // Konsola kayıt
    var msg = "[TürkImparatorluğu] Güvenlik ihlali. Sebep: " + reason;
    if (window.fbDB && window.fbAuth && window.fbAuth.currentUser) {
      window.fbDB.collection("security_log").add({
        uid:       window.fbAuth.currentUser.uid,
        reason:    reason,
        userAgent: navigator.userAgent,
        ts:        new Date().toISOString()
      }).catch(function () {});
    }
  }

  // ══════════════════════════════════════════════════════════
  // 9. BAŞLAT
  // ══════════════════════════════════════════════════════════
  function init() {
    _freezeData();
    _muteConsole();
    _startDevToolsWatch();
    _startHashWatch();
    _visibilityWatch();

    // Right-click engelle (opsiyonel — UX'e göre karar ver)
    // document.addEventListener("contextmenu", function (e) { e.preventDefault(); });

    // Sayfa kapatılmadan önce kaydet
    window.addEventListener("beforeunload", function () {
      if (typeof GAME !== "undefined" && GAME.state) GAME.save();
    });
  }

  // ——— PUBLIC ———
  return {
    init:              init,
    captureHash:       captureHash,
    validateState:     validateState,
    checkRateLimit:    checkRateLimit,
    checkSpendInterval:checkSpendInterval,
    canSave:           canSave,
    violation:         _violation
  };
})();
