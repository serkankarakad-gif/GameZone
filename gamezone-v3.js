/* ============================================================================
   gamezone-v3.js — GameZone ERP v3.0 — TAM PAKET
   Birleştirilmiş dosya: system-logic-v3 + security-layer + ui-manager-ext + secim-sistemi + rol-sistemi
   ============================================================================ */

/* ═══════════════════════════════════════════════════════════════
   CANLI GÜNCELLEME SİSTEMİ — Tüm oyuncular otomatik güncellenir
   ═══════════════════════════════════════════════════════════════ */
(function() {
  'use strict';
  const APP_VERSION = '3.0.' + '20260503';

  // Firebase hazır olunca versiyon kontrolü başlat
  const _vWait = setInterval(function() {
    if (!window.db) return;
    clearInterval(_vWait);

    // Versiyon dinleyicisi — admin yeni versiyon yayınlayınca tüm oyuncular güncellenir
    window.db.ref('system/appVersion').on('value', function(snap) {
      const serverVer = snap.val();
      if (!serverVer) return;
      if (serverVer !== APP_VERSION) {
        console.log('[Güncelleme] Yeni sürüm:', serverVer);
        if (typeof toast === 'function') {
          toast('🔄 Oyun güncellendi! Yükleniyor...', 'info', 3000);
        }
        // 3 saniye bekleyip sayfa yenile
        setTimeout(function() {
          // Cache'i temizleyerek yenile
          const url = location.href.split('?')[0] + '?v=' + Date.now();
          location.replace(url);
        }, 3000);
      }
    });

    // Bakiye ve kullanıcı verisi gerçek zamanlı dinleyici
    // Bu olmadan diğer oyuncular güncelleme görmez
    const _dataWait = setInterval(function() {
      if (!window.GZ?.uid) return;
      clearInterval(_dataWait);

      const uid = window.GZ.uid;

      // Kullanıcı verisini CANLI dinle (one-time değil, sürekli)
      window.db.ref('users/' + uid).on('value', function(snap) {
        const newData = snap.val();
        if (!newData) return;

        const oldBal   = window.GZ.data?.money || window.GZ.data?.bakiye || 0;
        const newBal   = newData.money || newData.bakiye || 0;
        const oldLevel = window.GZ.data?.level || 1;
        const newLevel = newData.level || 1;

        // Veriyi güncelle
        window.GZ.data = newData;

        // Topbar'ı güncelle
        if (typeof window.updateTopbar === 'function') {
          window.updateTopbar();
        } else {
          // Manuel topbar güncelleme
          const cashEl = document.getElementById('topCash');
          const lvlEl  = document.getElementById('topLevel');
          const xpEl   = document.getElementById('xpFill');
          if (cashEl) cashEl.textContent = typeof cashFmt === 'function' ? cashFmt(newBal) : newBal + '₺';
          if (lvlEl)  lvlEl.textContent  = 'Lv ' + newLevel;
          if (xpEl) {
            const xp    = newData.xp || 0;
            const xpReq = typeof xpForLevel === 'function' ? xpForLevel(newLevel) : 1000;
            xpEl.style.width = Math.min(100, Math.round(xp / xpReq * 100)) + '%';
          }
        }

        // Level atladıysa bildir
        if (newLevel > oldLevel) {
          if (typeof toast === 'function')
            toast('🎉 SEVİYE ' + newLevel + '! ' + (typeof GZX_getRank === 'function' ? GZX_getRank(newLevel) : ''), 'success', 6000);
        }
      });

      // Bakiye/money dinleyicisi (ayrı, daha hızlı)
      window.db.ref('users/' + uid + '/money').on('value', function(snap) {
        const bal = snap.val() || 0;
        const cashEl = document.getElementById('topCash');
        if (cashEl && typeof cashFmt === 'function') cashEl.textContent = cashFmt(bal);
        if (window.GZ?.data) window.GZ.data.money = bal;
      });

      // Bildirimler
      window.db.ref('notifs/' + uid).orderByChild('ts').limitToLast(1).on('child_added', function(snap) {
        const notif = snap.val();
        if (!notif || notif.read) return;
        if (typeof toast === 'function') toast(notif.msg || notif.message || 'Yeni bildirim', notif.kind || 'info', 5000);
        // Okundu işaretle
        setTimeout(function() { window.db.ref('notifs/' + uid + '/' + snap.key + '/read').set(true); }, 2000);
      });

      // Admin duyurusu — global broadcast
      window.db.ref('system/globalBroadcast').on('value', function(snap) {
        const bc = snap.val();
        if (!bc || !bc.message) return;
        if (Date.now() > bc.expiresAt) return;
        const el = document.getElementById('globalBroadcast');
        const txt = document.getElementById('gbText');
        if (el && txt) { txt.textContent = bc.message; el.style.display = 'flex'; }
      });

    }, 500);
  }, 400);

  // Admin: Yeni versiyon yayınla
  window.GZV_yeniVersiyon = async function() {
    if (!window.GZ?.data?.isFounder) { toast && toast('Yetkisiz', 'error'); return; }
    const newVer = '3.0.' + Date.now();
    await window.db?.ref('system/appVersion').set(newVer);
    toast && toast('✅ v' + newVer + ' yayınlandı — Tüm oyuncular güncellenecek', 'success', 6000);
  };

})();
// Güncelleme sistemi eklendi
/* ============================================================================
   security-layer.js v2.0 — GameZone ERP Güvenlik & Denge Katmanı
   ============================================================================
   ÖZELLİKLER:
   1.  F12 / DevTools Engelleme + Sağ Tık Koruması
   2.  Console Anti-Debug (Debugger Tuzağı + Temizleme Döngüsü)
   3.  DevTools Açık Mı Algılama (Boyut Farkı Yöntemi)
   4.  Rate Limiting (Hız Kontrolü — Spam önleme)
   5.  XOR Bakiye Şifreleme (localStorage manipulation koruması)
   6.  Bakiye Manipülasyon Algılama (Sunucu-yerel karşılaştırma)
   7.  Şüpheli Hareket Loglama → Firebase adminAlerts
   8.  Admin Onaylı Büyük Transfer (1M₺+)
   9.  XP Logaritmik Denge (1 günde 70 level önlemi)
   10. Günlük XP Limiti & Yorgunluk Sistemi
   11. Enerji Barı Sistemi (aktivite ile enerji tüketimi)
   12. Rütbe Sistemi (Çırak → İmparator)
   13. Dinamik Artan Oranlı Vergi (Progressive Tax)
   14. Bug Report Sistemi (+500₺ ödül)
   15. Eksi Bakiye Koruması (Kredi yoksa sıfırdan aşağı gidemez)
   16. HTML/Script Injection Koruması (Input Sanitization)
   17. Atomic Transaction Hatası Yönetimi (Rollback)
   18. Admin Onay Bekleyen İşlemler Kuyruk Sistemi
   ============================================================================
   KULLANIM: index.html'de system-logic.js'in ALTINA ekle:
   <script src="security-layer.js"></script>
   ============================================================================ */

(function SecurityLayer() {
  'use strict';

  /* ══════════════════════════════════════════════════════════════════════════
     BÖLÜM 1: F12 / DEVTOOLS / SAĞ TIK ENGELLEYICI
     ══════════════════════════════════════════════════════════════════════════ */

  // Klavye kısayollarını engelle
  document.addEventListener('keydown', function (e) {
    const isAdmin = () => window.GZ?.data?.isFounder || window.GZ?.data?.isAdmin;
    if (isAdmin()) return; // Admin'e kısıtlama yok

    // F12
    if (e.key === 'F12') { e.preventDefault(); e.stopPropagation(); return false; }
    // Ctrl+Shift+I (DevTools)
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'I' || e.key === 'i')) {
      e.preventDefault(); return false;
    }
    // Ctrl+Shift+J (Console)
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'J' || e.key === 'j')) {
      e.preventDefault(); return false;
    }
    // Ctrl+Shift+C (Inspector)
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'C' || e.key === 'c')) {
      e.preventDefault(); return false;
    }
    // Ctrl+U (Kaynak Görüntüle)
    if ((e.ctrlKey || e.metaKey) && (e.key === 'u' || e.key === 'U')) {
      e.preventDefault(); return false;
    }
  }, true);

  // Sağ tık engelle (input/textarea hariç)
  document.addEventListener('contextmenu', function (e) {
    const isAdmin = () => window.GZ?.data?.isFounder || window.GZ?.data?.isAdmin;
    if (isAdmin()) return;
    if (!e.target.closest('input, textarea, select')) {
      e.preventDefault();
    }
  });

  /* ══════════════════════════════════════════════════════════════════════════
     BÖLÜM 2: DEVTOOLS AÇIK MI ALGILAMA
     ══════════════════════════════════════════════════════════════════════════ */

  let _devToolsOpen = false;
  const DEVTOOLS_THRESHOLD = 160;

  function _checkDevTools() {
    const isAdmin = window.GZ?.data?.isFounder || window.GZ?.data?.isAdmin;
    if (isAdmin) return;

    const widthDiff = window.outerWidth - window.innerWidth;
    const heightDiff = window.outerHeight - window.innerHeight;
    const isOpen = widthDiff > DEVTOOLS_THRESHOLD || heightDiff > DEVTOOLS_THRESHOLD;

    if (isOpen && !_devToolsOpen) {
      _devToolsOpen = true;
      _onDevToolsOpen();
    } else if (!isOpen && _devToolsOpen) {
      _devToolsOpen = false;
    }
  }

  function _onDevToolsOpen() {
    // Konsolu sürekli temizle
    console.clear();
    console.log(
      '%c🔒 GameZone ERP — Güvenlik Uyarısı',
      'color:#ef4444;font-size:36px;font-weight:900;background:#0a0a0a;padding:10px 20px;border-radius:8px'
    );
    console.log(
      '%cBu alan yalnızca geliştiriciler içindir.\nKonsoldan hile yapmak kalıcı ban ile sonuçlanır.\nTüm işlemler sunucu tarafında doğrulanmaktadır.',
      'color:#f97316;font-size:14px'
    );

    if (window.GZ?.uid) {
      _logSuspicious(window.GZ.uid, 'devtools_detected', {
        ua: navigator.userAgent.slice(0, 150)
      });
    }
  }

  /* ══════════════════════════════════════════════════════════════════════════
     BÖLÜM 3: CONSOLE ANTİ-DEBUG (Debugger Tuzağı)
     ══════════════════════════════════════════════════════════════════════════ */

  function _installDebuggerTrap() {
    // Sadece non-admin kullanıcılara uygula
    const _isAdmin = () => window.GZ?.data?.isFounder || window.GZ?.data?.isAdmin;

    // DevTools açıkken konsolu periyodik temizle
    setInterval(() => {
      if (_devToolsOpen && !_isAdmin()) {
        console.clear();
        console.log(
          '%c⛔ HAREKETLERİNİZ KAYDEDILMEKTEDIR',
          'color:#ef4444;font-size:20px;font-weight:bold'
        );
      }
    }, 2500);

    // toString tuzağı — profiler bunu yakaladığında DevTools anlar
    const _devtoolsChecker = new Function();
    _devtoolsChecker.toString = function () {
      if (!_isAdmin()) {
        _devToolsOpen = true;
        _onDevToolsOpen();
      }
      return 'GameZone_Secure_Function';
    };

    // Periyodik konsol check (boyut yöntemi)
    setInterval(_checkDevTools, 1200);
  }

  /* ══════════════════════════════════════════════════════════════════════════
     BÖLÜM 4: RATE LİMİTİNG — Hız Kontrolü
     ══════════════════════════════════════════════════════════════════════════ */

  const _actionTimestamps = {}; // { uid_action: [timestamps] }
  const _mutedUsers       = {}; // { uid: untilTimestamp }

  const RATE_LIMITS = {
    purchase:   { max: 15,  windowMs: 5000   },   // 5 sn'de 15 satın alma
    transfer:   { max: 5,   windowMs: 3000   },   // 3 sn'de 5 transfer
    marketBuy:  { max: 20,  windowMs: 5000   },   // 5 sn'de 20 borsa alımı
    shopOpen:   { max: 3,   windowMs: 10000  },   // 10 sn'de 3 dükkan açma
    levelUp:    { max: 5,   windowMs: 60000  },   // 1 dk'da 5 seviye
    chatSend:   { max: 8,   windowMs: 10000  },   // 10 sn'de 8 mesaj
    exportSend: { max: 5,   windowMs: 30000  },   // 30 sn'de 5 ihracat
    loanApply:  { max: 2,   windowMs: 60000  },   // 1 dk'da 2 kredi başvurusu
  };

  window.GZX_checkRate = function (uid, action) {
    if (!uid || !action) return true;
    const isAdmin = window.GZ?.data?.isFounder || window.GZ?.data?.isAdmin;
    if (isAdmin) return true; // Admin'e rate limit yok

    // Mute kontrolü
    if (_mutedUsers[uid] && Date.now() < _mutedUsers[uid]) {
      const remaining = Math.ceil((_mutedUsers[uid] - Date.now()) / 60000);
      window.toast?.(`⏸️ ${remaining} dk. bekleyiniz (spam koruması)`, 'error', 5000);
      return false;
    }
    if (_mutedUsers[uid]) delete _mutedUsers[uid];

    const limit = RATE_LIMITS[action];
    if (!limit) return true;

    const key = `${uid}_${action}`;
    const now = Date.now();
    if (!_actionTimestamps[key]) _actionTimestamps[key] = [];

    // Eski kayıtları temizle
    _actionTimestamps[key] = _actionTimestamps[key].filter(t => now - t < limit.windowMs);

    if (_actionTimestamps[key].length >= limit.max) {
      // Rate limit aşıldı → 10 dk mute
      _mutedUsers[uid] = now + 10 * 60 * 1000;
      _logSuspicious(uid, 'rate_limit_exceeded', { action, count: _actionTimestamps[key].length });
      window.toast?.('🚨 Çok hızlı işlem! 10 dakika askıya alındınız.', 'error', 8000);
      return false;
    }

    _actionTimestamps[key].push(now);
    return true;
  };

  window.GZX_isMuted = function (uid) {
    if (!_mutedUsers[uid]) return false;
    if (Date.now() > _mutedUsers[uid]) { delete _mutedUsers[uid]; return false; }
    return true;
  };

  /* ══════════════════════════════════════════════════════════════════════════
     BÖLÜM 5: BAKIYE XOR ŞİFRELEME
     ══════════════════════════════════════════════════════════════════════════ */

  // Günlük değişen salt — Inspect Element'te dün kaydettiği değer bugün çalışmaz
  const _SALT = 'GZP_' + btoa(new Date().toDateString()).slice(0, 8) + '_' +
    (navigator.language || 'tr').replace('-', '');

  function _xorEncode(str) {
    const key = _SALT;
    let out = '';
    for (let i = 0; i < str.length; i++) {
      out += String.fromCharCode(str.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    return btoa(unescape(encodeURIComponent(out)));
  }

  function _xorDecode(encoded) {
    try {
      const str = decodeURIComponent(escape(atob(encoded)));
      const key = _SALT;
      let out = '';
      for (let i = 0; i < str.length; i++) {
        out += String.fromCharCode(str.charCodeAt(i) ^ key.charCodeAt(i % key.length));
      }
      return out;
    } catch { return null; }
  }

  window.GZX_secureStore = function (key, value) {
    try {
      localStorage.setItem('gz_enc_' + key, _xorEncode(JSON.stringify(value)));
    } catch (e) {}
  };

  window.GZX_secureRead = function (key) {
    try {
      const raw = localStorage.getItem('gz_enc_' + key);
      if (!raw) return null;
      const dec = _xorDecode(raw);
      return dec ? JSON.parse(dec) : null;
    } catch { return null; }
  };

  /* ══════════════════════════════════════════════════════════════════════════
     BÖLÜM 6: BAKİYE MANİPÜLASYON ALGILAMA
     ══════════════════════════════════════════════════════════════════════════ */

  let _balWatchInterval = null;

  window.GZX_startBalanceWatch = async function (uid) {
    if (_balWatchInterval) clearInterval(_balWatchInterval);

    _balWatchInterval = setInterval(async () => {
      if (!uid || !window.dbGet) return;
      try {
        const serverBal = await window.dbGet(`users/${uid}/bakiye`);
        if (serverBal === null || serverBal === undefined) return;

        const storedBal = window.GZX_secureRead('bal_' + uid);

        if (storedBal !== null && typeof storedBal === 'number') {
          // Pozitif yönde büyük fark → manipülasyon şüphesi
          const diff = serverBal - storedBal;
          if (diff > 50000 && diff > storedBal * 0.5) {
            await _logSuspicious(uid, 'balance_spike', {
              serverBal, storedBal, diff
            });
          }
        }

        window.GZX_secureStore('bal_' + uid, serverBal);
      } catch (e) {}
    }, 45000); // 45 saniyede bir
  };

  /* ══════════════════════════════════════════════════════════════════════════
     BÖLÜM 7: ŞÜPHELİ HAREKET LOGLAMA
     ══════════════════════════════════════════════════════════════════════════ */

  async function _logSuspicious(uid, type, data) {
    try {
      if (!window.dbPush) return;
      const entry = {
        uid: uid || 'unknown',
        type,
        data: JSON.stringify(data || {}).slice(0, 500),
        ts: Date.now(),
        ua: navigator.userAgent.slice(0, 150),
        url: location.href.slice(0, 200)
      };

      await window.dbPush('security/logs', entry);

      // 🚨 Admin paneline anlık uyarı
      await window.dbPush('adminAlerts', {
        ...entry,
        severity: ['balance_spike', 'devtools_detected'].includes(type) ? 'critical' : 'high',
        message: `🚨 ${type.toUpperCase()} — UID: ${(uid || '').slice(0, 8)}`,
        read: false
      });
    } catch (e) {}
  }
  window.GZX_logSuspicious = _logSuspicious;

  /* ══════════════════════════════════════════════════════════════════════════
     BÖLÜM 8: ADMİN ONAYLI BÜYÜK TRANSFER (1M₺+)
     ══════════════════════════════════════════════════════════════════════════ */

  const LARGE_TRANSFER_THRESHOLD = 1_000_000;

  window.GZX_checkLargeTx = async function (uid, amount, description) {
    if (amount < LARGE_TRANSFER_THRESHOLD) return true; // Normal işle

    // Admin onay kuyruğuna gönder
    await window.dbPush?.('adminApprovals', {
      uid,
      username: window.GZ?.data?.username || 'Bilinmiyor',
      type: 'large_transfer',
      amount,
      description: (description || '').slice(0, 200),
      status: 'pending',
      ts: Date.now()
    });

    await _logSuspicious(uid, 'large_transfer_queued', { amount, description });

    window.toast?.(
      `⏳ ${window.cashFmt?.(amount) || amount + '₺'} tutarındaki işlem admin onayına gönderildi.`,
      'info', 7000
    );
    return false; // Onay bekle
  };

  /* ══════════════════════════════════════════════════════════════════════════
     BÖLÜM 9 & 10: XP LOGARİTMİK DENGE & GÜNLÜK LİMİT
     ══════════════════════════════════════════════════════════════════════════ */

  window.GZX_XP_CFG = {
    baseXP:          200,    // Seviye 1 için gereken XP (firebase-init xpForLevel ile uyumlu)
    scaleFactor:     1.9,    // lv^1.9 katsayısı (firebase-init ile eşleşiyor)
    dailyXPCap:      2000,   // Günlük max XP — hızlı leveling engeli
    maxDailyLevels:  2,      // Günde max 2 seviye atlanabilir
    energyCap:       100,    // Maksimum enerji
    energyPerHour:   8,      // Saatte enerji yenilenme
    energyPerAction: 2,      // Her XP kazanma işleminde enerji tüketimi (ortalama)
  };

  /* GZX_xpRequired'ı firebase-init.js xpForLevel ile senkronize et */
  window.GZX_xpRequired = function (level) {
    return Math.floor(200 * Math.pow(level, 1.9));
  };
  window.xpForLevel = window.GZX_xpRequired; // Alias — her iki isim de çalışsın

  /* Seviye için gereken XP (logaritmik) */
  window.GZX_xpRequired = function (level) {
    if (level <= 1) return 0;
    const cfg = window.GZX_XP_CFG;
    return Math.floor(cfg.baseXP * Math.pow(cfg.scaleFactor, level - 1));
  };

  /* Bir seviyeye ulaşmak için toplam XP */
  window.GZX_totalXP = function (level) {
    let total = 0;
    for (let i = 1; i < level; i++) total += window.GZX_xpRequired(i);
    return total;
  };

  /* XP ver — tüm kontroller dahil */
  window.GZX_grantXP = async function (uid, rawAmount, source) {
    if (!uid || rawAmount <= 0) return 0;

    const today = new Date().toDateString();
    try {
      // Mevcut kullanıcı verisi
      const userData = await window.dbGet?.(`users/${uid}`) || {};
      const cfg = window.GZX_XP_CFG;

      // Enerji kontrolü
      const energy = userData.energy ?? cfg.energyCap;
      if (energy <= 0) {
        window.toast?.('😴 Enerjiniz tükendi! Dinlenmeniz gerekiyor.', 'warn', 4000);
        return 0;
      }

      // Günlük cap kontrolü
      const xpMeta = userData.xpMeta || {};
      const isNewDay = xpMeta.day !== today;
      const dailyXP  = isNewDay ? 0 : (xpMeta.daily || 0);
      const dailyLvl = isNewDay ? 0 : (xpMeta.dailyLevels || 0);

      if (dailyXP >= cfg.dailyXPCap) {
        window.toast?.('⚡ Günlük XP limitine ulaştınız! Yarın devam edin.', 'warn', 4000);
        return 0;
      }

      // Gerçek XP (kalan kotaya göre)
      const actualXP = Math.min(rawAmount, cfg.dailyXPCap - dailyXP);

      // Enerji tüket
      const energyCost = Math.max(1, Math.floor(actualXP / 40) * cfg.energyPerAction);
      const newEnergy  = Math.max(0, energy - energyCost);

      // XP güncelle
      const currentXP = userData.xp || 0;
      const newXP      = currentXP + actualXP;

      // Seviye hesapla
      const oldLevel = userData.level || 1;
      let newLevel    = oldLevel;
      while (
        window.GZX_totalXP(newLevel + 1) <= newXP &&
        (newLevel - oldLevel) < Math.min(cfg.maxDailyLevels, cfg.maxDailyLevels - dailyLvl)
      ) newLevel++;

      // Rütbe kontrolü
      const newRank = window.GZX_getRank(newLevel);

      const updates = {
        xp: newXP,
        level: newLevel,
        energy: newEnergy,
        rank: newRank,
        xpMeta: {
          day: today,
          daily: dailyXP + actualXP,
          dailyLevels: dailyLvl + (newLevel - oldLevel)
        }
      };

      await window.dbUpdate?.(`users/${uid}`, updates);

      if (newLevel > oldLevel) {
        const lvlDiff = newLevel - oldLevel;
        window.toast?.(`🎉 SEVİYE ${newLevel}! +${lvlDiff} seviye — Rütbe: ${newRank}`, 'success', 6000);

        // Log
        await window.dbPush?.('xpLogs', {
          uid, fromLevel: oldLevel, toLevel: newLevel,
          xpGained: actualXP, source, ts: Date.now()
        });

        // Güvenlik: Çok hızlı seviye → şüpheli
        if (lvlDiff >= 3) {
          await _logSuspicious(uid, 'rapid_levelup', { oldLevel, newLevel, source });
        }
      }

      return actualXP;
    } catch (e) {
      console.error('[GZX_grantXP] Hata:', e);
      return 0;
    }
  };

  /* ══════════════════════════════════════════════════════════════════════════
     BÖLÜM 11: ENERJİ BARSI SİSTEMİ
     ══════════════════════════════════════════════════════════════════════════ */

  window.GZX_regenEnergy = async function (uid) {
    if (!uid || !window.dbGet) return;
    try {
      const data = await window.dbGet(`users/${uid}`);
      if (!data) return;

      const cfg      = window.GZX_XP_CFG;
      const lastRegen = data.lastEnergyRegen || 0;
      const hours    = (Date.now() - lastRegen) / 3_600_000;

      if (hours < 0.083) return; // En az 5 dk bekle

      const regen    = Math.min(Math.floor(hours * cfg.energyPerHour), cfg.energyCap);
      const current  = data.energy ?? cfg.energyCap;
      const newEnergy = Math.min(cfg.energyCap, current + regen);

      if (newEnergy > current) {
        await window.dbUpdate?.(`users/${uid}`, {
          energy: newEnergy,
          lastEnergyRegen: Date.now()
        });
      }
    } catch (e) {}
  };

  /* Enerji barı UI render */
  window.GZX_renderEnergyBar = function (energy, max) {
    const pct   = Math.round((energy / max) * 100);
    const color = pct > 60 ? '#22c55e' : pct > 30 ? '#eab308' : '#ef4444';
    const emoji = pct > 60 ? '⚡' : pct > 30 ? '🟡' : '🔴';
    return `
      <div class="gz-energy-bar" title="Enerji: ${energy}/${max}">
        <span style="font-size:11px;color:#94a3b8">${emoji} Enerji</span>
        <div style="flex:1;height:6px;background:#1e3a5f;border-radius:3px;overflow:hidden;margin:0 6px">
          <div style="width:${pct}%;height:100%;background:${color};border-radius:3px;transition:width .5s"></div>
        </div>
        <span style="font-size:10px;color:${color};font-weight:700;min-width:28px">${pct}%</span>
      </div>`;
  };

  /* ══════════════════════════════════════════════════════════════════════════
     BÖLÜM 12: RÜTBE SİSTEMİ
     ══════════════════════════════════════════════════════════════════════════ */

  window.GZX_RANKS = [
    { min: 1,   max: 4,   title: '🥬 Çırak',      badge: 'rank-novice',   color: '#94a3b8', perk: 'Temel ticaret'        },
    { min: 5,   max: 9,   title: '🛒 Esnaf',       badge: 'rank-merchant', color: '#22c55e', perk: '1 ekstra dükkan'      },
    { min: 10,  max: 19,  title: '💼 İş İnsanı',  badge: 'rank-biz',      color: '#3b82f6', perk: 'Banka kredisi +%20'   },
    { min: 20,  max: 34,  title: '🏭 Sanayici',    badge: 'rank-ind',      color: '#a855f7', perk: 'Fabrika hakkı'        },
    { min: 35,  max: 49,  title: '👑 Baron',       badge: 'rank-baron',    color: '#eab308', perk: 'İhracat teşviki +%15' },
    { min: 50,  max: 74,  title: '🏦 Patron',      badge: 'rank-patron',   color: '#f97316', perk: 'Borsa manipülasyon önceliği' },
    { min: 75,  max: 99,  title: '⚡ Oligark',     badge: 'rank-oligarch', color: '#ef4444', perk: 'Özel vergi muafiyeti' },
    { min: 100, max: 9999,title: '🌍 İmparator',   badge: 'rank-emperor',  color: '#a21caf', perk: 'Tüm ayrıcalıklar'    },
  ];

  window.GZX_getRank = function (level) {
    const r = window.GZX_RANKS.find(r => level >= r.min && level <= r.max);
    return r ? r.title : '🥬 Çırak';
  };

  window.GZX_getRankData = function (level) {
    return window.GZX_RANKS.find(r => level >= r.min && level <= r.max) || window.GZX_RANKS[0];
  };

  /* Rütbe rozeti HTML */
  window.GZX_renderRankBadge = function (level) {
    const r = window.GZX_getRankData(level);
    return `<span class="gz-rank-badge" style="color:${r.color};background:${r.color}18;
      border:1px solid ${r.color}44;border-radius:999px;padding:2px 10px;font-size:11px;
      font-weight:700">${r.title}</span>`;
  };

  /* ══════════════════════════════════════════════════════════════════════════
     BÖLÜM 13: DİNAMİK ARTAN ORANLI VERGİ (Progressive Tax)
     ══════════════════════════════════════════════════════════════════════════ */

  window.GZX_TAX_BRACKETS = [
    { min: 0,          max: 100_000,    rate: 0.05,  label: 'Alt Dilim %5'      },
    { min: 100_000,    max: 500_000,    rate: 0.10,  label: 'Orta-Alt %10'      },
    { min: 500_000,    max: 2_000_000,  rate: 0.18,  label: 'Orta %18'          },
    { min: 2_000_000,  max: 10_000_000, rate: 0.27,  label: 'Üst-Orta %27'      },
    { min: 10_000_000, max: Infinity,   rate: 0.40,  label: 'Üst Dilim %40'     },
  ];

  window.GZX_calcTax = function (income) {
    let tax = 0; let rem = income;
    for (const b of window.GZX_TAX_BRACKETS) {
      if (rem <= 0) break;
      const taxable = Math.min(rem, b.max - b.min);
      tax += taxable * b.rate;
      rem -= taxable;
    }
    return Math.floor(tax);
  };

  window.GZX_applyTax = async function (uid, income, source) {
    const tax = window.GZX_calcTax(income);
    if (tax <= 0) return 0;

    try {
      const bal = await window.dbGet?.(`users/${uid}/bakiye`) || 0;
      if (bal < tax) {
        window.toast?.('⚠️ Vergi ödeyecek yeterli bakiye yok, borçlandırıldınız.', 'warn');
      }

      await window.dbTransaction?.(`users/${uid}/bakiye`, b => Math.max(-tax, (b || 0) - tax));
      await window.dbTransaction?.('system/hazine', h => (h || 0) + tax);

      await window.dbPush?.(`users/${uid}/vergiler`, {
        amount: tax,
        income,
        rate: ((tax / income) * 100).toFixed(1),
        source: source || 'otomatik',
        ts: Date.now()
      });

      window.toast?.(`🏛️ Gelir vergisi: ${window.cashFmt?.(tax) || tax + '₺'}`, 'info', 4000);
      return tax;
    } catch (e) {
      console.error('[GZX_applyTax]', e);
      return 0;
    }
  };

  /* ══════════════════════════════════════════════════════════════════════════
     BÖLÜM 14: BUG REPORT SİSTEMİ
     ══════════════════════════════════════════════════════════════════════════ */

  window.GZX_submitBugReport = async function (description) {
    if (!window.GZ?.uid) return window.toast?.('Giriş yapmalısınız', 'error');
    const uid = window.GZ.uid;

    if (!description || description.trim().length < 10) {
      window.toast?.('Lütfen en az 10 karakter açıklama yazın', 'error');
      return;
    }

    // Günlük 3 rapor limiti
    const today = new Date().toDateString();
    const key   = `bugRep_${uid}_${today}`;
    const count = parseInt(sessionStorage.getItem(key) || '0');
    if (count >= 3) {
      window.toast?.('Günlük bug raporu limitiniz doldu (3/3)', 'warn');
      return;
    }
    sessionStorage.setItem(key, String(count + 1));

    const sanitized = window.GZX_sanitize(description);

    const ref = await window.dbPush?.('bugReports', {
      uid,
      username: window.GZ.data?.username || 'Bilinmiyor',
      description: sanitized.slice(0, 1000),
      level: window.GZ.data?.level || 1,
      ua: navigator.userAgent.slice(0, 100),
      status: 'pending',
      ts: Date.now()
    });

    // 500₺ ödül
    const REWARD = 500;
    await window.dbTransaction?.(`users/${uid}/bakiye`, b => (b || 0) + REWARD);
    await window.dbPush?.(`users/${uid}/gelirler`, {
      amount: REWARD, source: 'bug_reward',
      desc: 'Bug raporu ödülü', ts: Date.now()
    });

    window.toast?.(`🐛 Rapor alındı! +${REWARD}₺ ödül hesabınıza yatırıldı.`, 'success', 6000);
    return ref?.key;
  };

  window.GZX_openBugModal = function () {
    const html = `
      <div style="padding:20px;max-width:420px">
        <p style="color:#94a3b8;font-size:12px;margin-bottom:12px">
          Bulduğunuz hatayı detaylıca açıklayın. Geçerli raporlara <b style="color:#22c55e">+500₺</b> ödül verilir.
        </p>
        <textarea id="gzxBugDesc"
          placeholder="Hata nerede oluştu? Ne yaparken? Hangi değerler görüntülendi?"
          style="width:100%;height:120px;background:#080d1a;border:1px solid #1e3a5f;
          border-radius:8px;color:#e2e8f0;padding:10px;font-size:13px;resize:none;
          box-sizing:border-box;font-family:inherit"></textarea>
        <div style="margin-top:12px;display:flex;gap:8px">
          <button onclick="GZX_submitBugReport(document.getElementById('gzxBugDesc').value)"
            style="flex:1;background:#3b82f6;color:white;border:none;border-radius:8px;
            padding:10px;font-weight:700;cursor:pointer;font-size:13px">
            📤 Gönder (+500₺ ödül)
          </button>
        </div>
      </div>`;
    window.showModal?.('🐛 Bug Bildir', html) ||
      alert('Bug modalı açılamadı. showModal() fonksiyonu yok.');
  };

  /* ══════════════════════════════════════════════════════════════════════════
     BÖLÜM 15: EKSİ BAKİYE KORUMASI
     ══════════════════════════════════════════════════════════════════════════ */

  window.GZX_safePay = async function (uid, amount, description) {
    if (amount <= 0) return { ok: false, reason: 'Geçersiz tutar' };
    try {
      let success = false;
      await window.dbTransaction?.(`users/${uid}/bakiye`, (bal) => {
        if ((bal || 0) < amount) {
          success = false;
          return; // abort transaction (returns undefined)
        }
        success = true;
        return (bal || 0) - amount;
      });

      if (!success) {
        window.toast?.('💸 Yetersiz bakiye', 'error', 3000);
        return { ok: false, reason: 'Yetersiz bakiye' };
      }

      await window.dbPush?.(`users/${uid}/giderler`, {
        amount, description: (description || '').slice(0, 200), ts: Date.now()
      });

      return { ok: true, amount };
    } catch (e) {
      console.error('[GZX_safePay] Rollback:', e);
      window.toast?.('⚠️ İşlem hatası, bakiyeniz korundu.', 'error');
      return { ok: false, reason: 'İşlem hatası' };
    }
  };

  /* ══════════════════════════════════════════════════════════════════════════
     BÖLÜM 16: HTML INJECTION KORUMASI (Input Sanitization)
     ══════════════════════════════════════════════════════════════════════════ */

  window.GZX_sanitize = function (str) {
    if (typeof str !== 'string') return '';
    return str
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;')
      .replace(/\\/g, '&#x5C;')
      .replace(/`/g, '&#96;')
      // Script injection
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .replace(/eval\s*\(/gi, '')
      .replace(/document\s*\./gi, '')
      .replace(/window\s*\./gi, '')
      .replace(/alert\s*\(/gi, '')
      .replace(/fetch\s*\(/gi, '')
      .replace(/XMLHttpRequest/gi, '')
      // Firebase injection
      .replace(/\$\[/g, '')
      .replace(/\.ref\s*\(/gi, '')
      .trim()
      .slice(0, 500);
  };

  /* ══════════════════════════════════════════════════════════════════════════
     BÖLÜM 17: ADMIN PANELİ — GÜVENLİK SEKMESİ UI
     ══════════════════════════════════════════════════════════════════════════ */

  window.GZX_renderSecurityTab = async function (container) {
    if (!container) return;
    container.innerHTML = '<div style="padding:16px;color:#94a3b8">🔄 Güvenlik verileri yükleniyor...</div>';

    const [logs, alerts, approvals] = await Promise.all([
      window.dbGet?.('security/logs') || {},
      window.dbGet?.('adminAlerts') || {},
      window.dbGet?.('adminApprovals') || {}
    ]);

    const logEntries = Object.entries(logs || {}).sort(([,a],[,b]) => b.ts - a.ts).slice(0, 50);
    const alertEntries = Object.entries(alerts || {}).filter(([,a]) => !a.read)
      .sort(([,a],[,b]) => b.ts - a.ts).slice(0, 20);
    const pendingApprovals = Object.entries(approvals || {}).filter(([,a]) => a.status === 'pending');

    const _timeFmt = ts => new Date(ts).toLocaleString('tr-TR');
    const _severityColor = s => s === 'critical' ? '#ef4444' : s === 'high' ? '#f97316' : '#eab308';

    container.innerHTML = `
      <div style="padding:20px;display:flex;flex-direction:column;gap:20px">

        <!-- Alert Özet -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px">
          <div style="background:#0d1829;border:1px solid #ef444433;border-radius:12px;padding:16px;text-align:center">
            <div style="font-size:28px;font-weight:900;color:#ef4444">${alertEntries.length}</div>
            <div style="font-size:11px;color:#94a3b8;margin-top:4px">Okunmamış Uyarı</div>
          </div>
          <div style="background:#0d1829;border:1px solid #f9731633;border-radius:12px;padding:16px;text-align:center">
            <div style="font-size:28px;font-weight:900;color:#f97316">${pendingApprovals.length}</div>
            <div style="font-size:11px;color:#94a3b8;margin-top:4px">Onay Bekleyen</div>
          </div>
          <div style="background:#0d1829;border:1px solid #3b82f633;border-radius:12px;padding:16px;text-align:center">
            <div style="font-size:28px;font-weight:900;color:#3b82f6">${logEntries.length}</div>
            <div style="font-size:11px;color:#94a3b8;margin-top:4px">Güvenlik Logu</div>
          </div>
          <div style="background:#0d1829;border:1px solid #22c55e33;border-radius:12px;padding:16px;text-align:center">
            <div style="font-size:28px;font-weight:900;color:#22c55e">${Object.keys(_mutedUsers).length}</div>
            <div style="font-size:11px;color:#94a3b8;margin-top:4px">Mute'lu Kullanıcı</div>
          </div>
        </div>

        <!-- Onay Bekleyen Büyük Transferler -->
        ${pendingApprovals.length ? `
        <div style="background:#0d1829;border:1px solid #1e3a5f;border-radius:12px;padding:16px">
          <h3 style="color:#f97316;margin:0 0 12px;font-size:14px">⏳ Onay Bekleyen Büyük Transferler (1M₺+)</h3>
          ${pendingApprovals.map(([id, a]) => `
            <div style="display:flex;align-items:center;gap:8px;padding:10px 0;
              border-bottom:1px solid #1e3a5f;flex-wrap:wrap">
              <span style="color:#e2e8f0;font-size:13px;flex:1">
                <b>${a.username || a.uid?.slice(0,8)}</b> →
                <b style="color:#f97316">${window.cashFmt?.(a.amount) || a.amount+'₺'}</b>
                <span style="color:#94a3b8;font-size:11px">${a.description || ''}</span>
              </span>
              <button onclick="window.GZX_approveTransfer('${id}','${a.uid}')"
                style="background:#22c55e22;color:#22c55e;border:1px solid #22c55e44;
                border-radius:6px;padding:5px 12px;font-size:11px;font-weight:700;cursor:pointer">
                ✅ Onayla
              </button>
              <button onclick="window.GZX_rejectTransfer('${id}','${a.uid}')"
                style="background:#ef444422;color:#ef4444;border:1px solid #ef444444;
                border-radius:6px;padding:5px 12px;font-size:11px;font-weight:700;cursor:pointer">
                ❌ Reddet
              </button>
            </div>`).join('')}
        </div>` : ''}

        <!-- Şüpheli Hareketler Log -->
        <div style="background:#0d1829;border:1px solid #1e3a5f;border-radius:12px;padding:16px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
            <h3 style="color:#60a5fa;margin:0;font-size:14px">🔍 Şüpheli Hareketler (Son 50)</h3>
            <button onclick="window.dbSet('adminAlerts', null).then(() => window.GZX_renderSecurityTab(document.getElementById('adminScreenBody')))"
              style="background:rgba(255,255,255,.05);color:#64748b;border:1px solid #1e3a5f;
              border-radius:6px;padding:4px 10px;font-size:11px;cursor:pointer">
              🗑️ Temizle
            </button>
          </div>
          ${logEntries.length ? logEntries.map(([id, l]) => `
            <div style="display:flex;gap:8px;align-items:flex-start;padding:8px 0;
              border-bottom:1px solid #0f1e33">
              <span style="font-size:18px;flex-shrink:0">🚨</span>
              <div style="flex:1">
                <div style="font-size:12px;font-weight:700;
                  color:${_severityColor(l.severity)}">${l.type || 'unknown'}</div>
                <div style="font-size:11px;color:#64748b">
                  UID: ${(l.uid||'').slice(0,12)} · ${_timeFmt(l.ts)}
                </div>
                <div style="font-size:11px;color:#94a3b8;margin-top:2px;word-break:break-all">
                  ${(l.data||'').slice(0,120)}
                </div>
              </div>
            </div>`).join('') : '<p style="color:#475569;text-align:center;padding:16px">Log yok</p>'}
        </div>

        <!-- XP Config -->
        <div style="background:#0d1829;border:1px solid #1e3a5f;border-radius:12px;padding:16px">
          <h3 style="color:#60a5fa;margin:0 0 12px;font-size:14px">⚙️ XP Denge Ayarları</h3>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div>
              <label style="font-size:11px;color:#94a3b8">Günlük XP Limiti</label>
              <input id="gzxDailyXPCap" type="number" value="${window.GZX_XP_CFG.dailyXPCap}"
                style="width:100%;padding:8px;background:#080d1a;border:1px solid #1e3a5f;
                border-radius:6px;color:#e2e8f0;font-size:13px;box-sizing:border-box;margin-top:4px">
            </div>
            <div>
              <label style="font-size:11px;color:#94a3b8">Günlük Max Seviye</label>
              <input id="gzxMaxDailyLvl" type="number" value="${window.GZX_XP_CFG.maxDailyLevels}"
                style="width:100%;padding:8px;background:#080d1a;border:1px solid #1e3a5f;
                border-radius:6px;color:#e2e8f0;font-size:13px;box-sizing:border-box;margin-top:4px">
            </div>
            <div>
              <label style="font-size:11px;color:#94a3b8">Ölçek Faktörü (1.5-2.5)</label>
              <input id="gzxScaleFactor" type="number" step="0.05" value="${window.GZX_XP_CFG.scaleFactor}"
                style="width:100%;padding:8px;background:#080d1a;border:1px solid #1e3a5f;
                border-radius:6px;color:#e2e8f0;font-size:13px;box-sizing:border-box;margin-top:4px">
            </div>
            <div>
              <label style="font-size:11px;color:#94a3b8">Büyük Transfer Eşiği (₺)</label>
              <input id="gzxLargeTxThresh" type="number" value="${LARGE_TRANSFER_THRESHOLD}"
                style="width:100%;padding:8px;background:#080d1a;border:1px solid #1e3a5f;
                border-radius:6px;color:#e2e8f0;font-size:13px;box-sizing:border-box;margin-top:4px">
            </div>
          </div>
          <button onclick="window.GZX_saveSecurityConfig()"
            style="margin-top:12px;width:100%;background:#3b82f6;color:white;border:none;
            border-radius:8px;padding:10px;font-weight:700;cursor:pointer;font-size:13px">
            💾 Ayarları Kaydet & Firebase'e Yaz
          </button>

          <!-- Level XP Tablosu -->
          <div style="margin-top:16px;overflow-x:auto">
            <table style="width:100%;border-collapse:collapse;font-size:11px">
              <thead>
                <tr style="color:#64748b">
                  <th style="padding:4px 8px;text-align:left">Seviye</th>
                  <th style="padding:4px 8px;text-align:right">Gerekli XP</th>
                  <th style="padding:4px 8px;text-align:right">Toplam XP</th>
                  <th style="padding:4px 8px;text-align:left">Rütbe</th>
                </tr>
              </thead>
              <tbody>
                ${[1,5,10,15,20,30,50,75,100].map(lvl => `
                  <tr style="border-top:1px solid #0f1e33">
                    <td style="padding:4px 8px;color:#e2e8f0">${lvl}</td>
                    <td style="padding:4px 8px;text-align:right;color:#3b82f6">
                      ${(window.GZX_xpRequired(lvl)).toLocaleString('tr-TR')}
                    </td>
                    <td style="padding:4px 8px;text-align:right;color:#94a3b8">
                      ${(window.GZX_totalXP(lvl)).toLocaleString('tr-TR')}
                    </td>
                    <td style="padding:4px 8px">${window.GZX_getRank(lvl)}</td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>

      </div>`;
  };

  window.GZX_saveSecurityConfig = async function () {
    const dailyCap   = parseInt(document.getElementById('gzxDailyXPCap')?.value || 5000);
    const maxLevels  = parseInt(document.getElementById('gzxMaxDailyLvl')?.value || 5);
    const scale      = parseFloat(document.getElementById('gzxScaleFactor')?.value || 1.85);

    window.GZX_XP_CFG.dailyXPCap    = dailyCap;
    window.GZX_XP_CFG.maxDailyLevels = maxLevels;
    window.GZX_XP_CFG.scaleFactor    = scale;

    await window.dbUpdate?.('system/xpConfig', {
      dailyXPCap: dailyCap,
      maxDailyLevels: maxLevels,
      scaleFactor: scale,
      updatedAt: Date.now()
    });

    window.toast?.('✅ XP denge ayarları kaydedildi', 'success');
  };

  window.GZX_approveTransfer = async function (approvalId, uid) {
    await window.dbUpdate?.(`adminApprovals/${approvalId}`, {
      status: 'approved', approvedAt: Date.now()
    });
    const a = await window.dbGet?.(`adminApprovals/${approvalId}`);
    if (a?.amount) {
      await window.dbTransaction?.(`users/${uid}/bakiye`, b => (b || 0) + a.amount);
    }
    window.toast?.('✅ Transfer onaylandı ve hesaba yatırıldı', 'success');
  };

  window.GZX_rejectTransfer = async function (approvalId) {
    await window.dbUpdate?.(`adminApprovals/${approvalId}`, {
      status: 'rejected', rejectedAt: Date.now()
    });
    window.toast?.('❌ Transfer reddedildi', 'success');
  };

  /* ══════════════════════════════════════════════════════════════════════════
     BÖLÜM 18: BAŞLATICI & FIREBASE CONFIG SENKRONIZASYON
     ══════════════════════════════════════════════════════════════════════════ */

  async function _loadXPConfigFromFirebase() {
    try {
      const cfg = await window.dbGet?.('system/xpConfig');
      if (cfg) {
        if (cfg.dailyXPCap)    window.GZX_XP_CFG.dailyXPCap    = cfg.dailyXPCap;
        if (cfg.maxDailyLevels) window.GZX_XP_CFG.maxDailyLevels = cfg.maxDailyLevels;
        if (cfg.scaleFactor)   window.GZX_XP_CFG.scaleFactor    = cfg.scaleFactor;
      }
    } catch (e) {}
  }

  function _init() {
    _installDebuggerTrap();

    // GZ.uid hazır olduğunda kişisel servisleri başlat
    const _wait = setInterval(async () => {
      if (window.GZ?.uid) {
        clearInterval(_wait);
        await _loadXPConfigFromFirebase();
        await window.GZX_regenEnergy(window.GZ.uid);
        window.GZX_startBalanceWatch(window.GZ.uid);
      }
    }, 600);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _init);
  } else {
    setTimeout(_init, 100);
  }

  /* CSS */
  const _style = document.createElement('style');
  _style.textContent = `
    .gz-energy-bar{display:flex;align-items:center;gap:4px;padding:4px 8px;
      background:rgba(15,30,51,.8);border-radius:999px;font-size:11px}
    .gz-rank-badge{display:inline-flex;align-items:center;gap:4px;cursor:default}
  `;
  document.head.appendChild(_style);

  console.log('[SecurityLayer v2.0] Aktif — F12, Rate-Limit, XP-Denge, Anti-Hack çalışıyor');
})();

/* ============================================================================
   system-logic-v3.js — GameZone ERP: 200 Mikro Özellik (YENİ PAKET v3)
   ============================================================================
   DIŞ TİCARET, BANKACILIK, BORSA/KRİPTO, EMLAK, HABER/SİYASET
   + MUHTARLIK, BELEDİYE, POLİS, SGK, KARA BORSA, SEÇİM, İHALE
   + KİMLİK KARTI, BANKA KARTI UI, REKLAM/BİLLBOARD, ADMİN EKLENTİLERİ
   ============================================================================ */
'use strict';

/* ══ GLOBAL SABİTLER ══ */
const GZX_GUMRUK = {
  DE:0.05,FR:0.05,NL:0.05,IT:0.07,ES:0.07,UK:0.08,CH:0.06,
  US:0.10,CA:0.08,MX:0.15,CN:0.15,JP:0.10,KR:0.10,IN:0.18,
  RU:0.20,UA:0.12,SA:0.12,AE:0.05,IR:0.40,IQ:0.35,SY:0.45,
  EG:0.20,NG:0.25,ZA:0.18,BR:0.22,AR:0.20,AU:0.08,DEFAULT:0.12
};
const GZX_LOJISTIK = {
  kara:     {label:'🚛 Kara',    costPerKm:0.18, speed:80,  fuelFactor:1.0},
  deniz:    {label:'🚢 Deniz',   costPerKm:0.04, speed:30,  fuelFactor:0.6},
  hava:     {label:'✈️ Hava',    costPerKm:1.20, speed:850, fuelFactor:4.0},
  demiryolu:{label:'🚂 Tren',    costPerKm:0.09, speed:120, fuelFactor:0.7}
};
const GZX_KREDI_TURLERI = {
  ihtiyac:{label:'💳 İhtiyaç',maxAmount:200000,baseRate:0.28,minScore:40},
  ticari: {label:'🏪 Ticari', maxAmount:5000000,baseRate:0.22,minScore:55},
  konut:  {label:'🏠 Konut',  maxAmount:20000000,baseRate:0.18,minScore:60},
  ihracat:{label:'🚢 İhracat',maxAmount:10000000,baseRate:0.15,minScore:65},
  tarim:  {label:'🌾 Tarım',  maxAmount:1000000, baseRate:0.12,minScore:30}
};
const GZX_HISSELER = {
  GZTEC:{name:'GZ Teknoloji',price:142},GZFIN:{name:'GZ Finans',price:89},
  GZINŞ:{name:'GZ İnşaat',price:55},   GZGDA:{name:'GZ Gıda',price:38},
  GZENE:{name:'GZ Enerji',price:210}
};
const GZX_KRIPTO = {
  BTC:{name:'Bitcoin',basePrice:1500000,vol:0.04},
  ETH:{name:'Ethereum',basePrice:85000,vol:0.05},
  GZCN:{name:'GZCoin',basePrice:2.50,vol:0.12},
  SOL:{name:'Solana',basePrice:4200,vol:0.07}
};
const GZX_EMLAK = {
  konut:  {tapuHarci:0.02,emlakVergisi:0.001,kdv:0.01},
  ofis:   {tapuHarci:0.04,emlakVergisi:0.003,kdv:0.18},
  dukkan: {tapuHarci:0.04,emlakVergisi:0.003,kdv:0.18},
  fabrika:{tapuHarci:0.04,emlakVergisi:0.002,kdv:0.18},
  arazi:  {tapuHarci:0.02,emlakVergisi:0.001,kdv:0.01}
};
const GZX_BOLGELER = {
  merkez:{multiplier:2.2,growth:0.012},avrupa:{multiplier:1.8,growth:0.010},
  asya:  {multiplier:1.5,growth:0.008},cevre: {multiplier:0.8,growth:0.005},
  koy:   {multiplier:0.3,growth:0.002}
};

/* ══════════════════════════════════════════════════════════════════════════
   [A] DIŞ TİCARET & İHRACAT — 40 Madde
   ══════════════════════════════════════════════════════════════════════════ */
/* A01 */ window.GZX_A01_getCustomsDuty = (country, cat) => {
  const base = GZX_GUMRUK[country] || GZX_GUMRUK.DEFAULT;
  const m = {temel:0.5,maden:1.5,lüks:2.0,elektronik:1.2,tekstil:0.8}[cat]||1;
  return Math.min(0.45, +(base*m).toFixed(4));
};
/* A02 */ window.GZX_A02_getLogisticsRoutes = () => GZX_LOJISTIK;
/* A03 */ window.GZX_A03_calcFuelCost = async (route, distKm, weightKg) => {
  const fuel = (await window.dbGet?.('system/fuelPrice')) || 28.50;
  const l = GZX_LOJISTIK[route] || GZX_LOJISTIK.kara;
  return +((distKm/100)*(weightKg/1000)*3*l.fuelFactor*fuel).toFixed(2);
};
/* A04 */ window.GZX_A04_getExportIncentive = async (cat, country) => {
  const t = (await window.dbGet?.('system/exportIncentives'))||{gıda:0.05,tekstil:0.08,makine:0.12};
  const isAB = ['DE','FR','IT','ES','NL','BE'].includes(country);
  return (t[cat]||0.03) + (isAB?0.02:0);
};
/* A05 */ window.GZX_A05_lockExchangeRate = async (uid, currency, rate, amtUSD, days) => {
  const cost = amtUSD*0.005;
  const r = await window.GZX_safePay?.(uid, cost, 'Kur opsiyon primi');
  if(!r?.ok) return;
  await window.dbPush?.(`users/${uid}/dovizOpsiyonlari`,{currency,lockedRate:rate,amount:amtUSD,expiresAt:Date.now()+days*86400000,premium:cost,status:'active',ts:Date.now()});
  window.toast?.(`💱 ${currency}=${rate} kilitledi, prim: ${window.cashFmt?.(cost)||cost+'₺'}`,'success');
};
/* A06 */ window.GZX_A06_trackContainer = async (id) => window.dbGet?.(`containers/${id}`);
/* A07 */ window.GZX_A07_checkPerishable = (product, hours) => {
  const lt={domates:18,kiraz:24,et:48,süt:72,peynir:240,ekmek:96,findik:8760};
  const life=lt[product]||8760;
  return {spoiled:hours>=life, loss:Math.min(0.8,hours/life*0.3)};
};
/* A08 */ window.GZX_A08_getInsurancePremium = (val, type) => {
  const rates={full:0.022,basic:0.008,none:0};
  return {premium:Math.ceil(val*(rates[type]||0.008)), coveragePct:type==='full'?100:60};
};
/* A09 */ window.GZX_A09_getBorderCongestion = async (gate) => {
  const data = await window.dbGet?.(`borders/${gate}`)||{};
  const h=new Date().getHours(), rush=(h>=8&&h<=11)||(h>=15&&h<=18);
  const q=(data.queue||Math.floor(Math.random()*40+10))*(rush?2:1);
  return {gate,queueLength:q,waitHours:+(q*0.15).toFixed(1),status:q>60?'SIKIŞIK':q>30?'YOĞUN':'AÇIK',rush};
};
/* A10 */ window.GZX_A10_checkDumping = async (uid, product, expPrice, domPrice) => {
  if(expPrice >= domPrice*0.8) return {isDumping:false};
  const ratio=(domPrice-expPrice)/domPrice;
  const penalty=Math.ceil(expPrice*ratio*2.5);
  await window.dbTransaction?.(`users/${uid}/bakiye`, b=>Math.max(0,(b||0)-penalty));
  window.toast?.(`🚨 Damping cezası: ${window.cashFmt?.(penalty)||penalty+'₺'}`,'error',6000);
  return {isDumping:true,penalty};
};
/* A11 */ window.GZX_A11_getExportQuota = async (uid, product) => {
  const q=(await window.dbGet?.(`system/exportQuotas/${product}`))||Infinity;
  const u=(await window.dbGet?.(`users/${uid}/exportQuotaUsed/${product}`))||0;
  return {quota:q,used:u,remaining:Math.max(0,q-u)};
};
/* A12 */ window.GZX_A12_getTradeAgreement = async (country) => {
  const ag=(await window.dbGet?.('system/tradeAgreements'))||{DE:'AB',US:'STF(Müzakere)'};
  return {country,agreement:ag[country]||null,hasAgreement:!!ag[country]};
};
/* A13 */ window.GZX_A13_calcShippingTime = (route, distKm, urgency) => {
  const l=GZX_LOJISTIK[route]||GZX_LOJISTIK.kara;
  const hrs=(distKm/l.speed)+24;
  return {hours:+(urgency==='express'?hrs*0.7:hrs).toFixed(1)};
};
/* A14 */ window.GZX_A14_getCustomsBrokerFee = (val) =>
  val<50000?Math.max(500,val*0.015):val<500000?val*0.010:val<5000000?val*0.007:val*0.004;
/* A15 */ window.GZX_A15_issueExportDoc = async (uid, product, country, qty) => {
  const r=await window.GZX_safePay?.(uid,2500,'İhracat belgesi');
  if(!r?.ok) return;
  const ref=await window.dbPush?.(`users/${uid}/ihracatBelgeleri`,{product,country,qty,status:'active',issuedAt:Date.now(),expiresAt:Date.now()+180*86400000});
  window.toast?.('📄 İhracat belgesi düzenlendi (6 ay geçerli)','success');
  return ref?.key;
};
/* A16 */ window.GZX_A16_trackAirCargo   = async id => window.dbGet?.(`airCargo/${id}`);
/* A17 */ window.GZX_A17_trackSeaCargo   = async id => window.dbGet?.(`seaCargo/${id}`);
/* A18 */ window.GZX_A18_calcTransitFee  = (country, tons) => ({RO:850,BG:650,GR:700,IR:1200,IQ:1500}[country]||500)*tons;
/* A19 */ window.GZX_A19_checkExportBan  = async (product, country) => {
  const b=(await window.dbGet?.('system/exportBans'))||{altin:['ALL']};
  const ban=b[product];
  return ban&&(ban.includes('ALL')||ban.includes(country))?{banned:true}:{banned:false};
};
/* A20 */ window.GZX_A20_getRiskPremium  = (country) => { const r={DE:1,US:1.2,RU:2.5,IR:4.0,SY:6.0}[country]||2; return {riskFactor:r,premiumRate:+(0.015*r).toFixed(4)}; };
/* A21 */ window.GZX_A21_checkForexLimit = async (uid, amtUSD) => {
  const lim=(await window.dbGet?.('system/forexDailyLimit'))||100000;
  const used=(await window.dbGet?.(`users/${uid}/forexDaily/${new Date().toDateString()}`))||0;
  return {allowed:amtUSD<=lim-used,remaining:Math.max(0,lim-used)};
};
/* A22 */ window.GZX_A22_getExportCreditGuarantee = async uid => {
  const s=(await window.dbGet?.(`users/${uid}/krediSkoru`))||50;
  return {score:s,maxGuarantee:s>=80?5000000:s>=60?2000000:s>=40?500000:0};
};
/* A23 */ window.GZX_A23_issueQualityCert = async (uid, product) => {
  const r=await window.GZX_safePay?.(uid,1500,'Kalite sertifikası');
  if(!r?.ok) return;
  await window.dbPush?.(`users/${uid}/sertifikalar`,{type:'kalite',product,validUntil:Date.now()+365*86400000,ts:Date.now()});
  window.toast?.('📋 Kalite sertifikası alındı','success');
};
/* A24 */ window.GZX_A24_issueOriginCert = async (uid, product, country) => {
  await window.GZX_safePay?.(uid,800,'Menşei belgesi');
  await window.dbPush?.(`users/${uid}/sertifikalar`,{type:'mensej',product,country,ts:Date.now()});
  window.toast?.('🏳️ Menşei belgesi düzenlendi','success');
};
/* A25 */ window.GZX_A25_generateInvoice = async (uid, product, qty, price, country) => {
  const total=qty*price, dutyRate=window.GZX_A01_getCustomsDuty(country,'genel'), duty=total*dutyRate;
  const ref=await window.dbPush?.(`users/${uid}/faturalar`,{product,qty,price,total,country,duty,ts:Date.now()});
  return {total,duty,id:ref?.key};
};
/* A26 */ window.GZX_A26_calcPortFee     = (tons,route) => ({deniz:120,kara:30,hava:200}[route]||80)*tons;
/* A27 */ window.GZX_A27_calcDemurrage   = (days,containers) => days*containers*850;
/* A28 */ window.GZX_A28_getPreFinancing = async uid => { const s=(await window.dbGet?.(`users/${uid}/krediSkoru`))||50; return {maxPct:s>=70?0.80:s>=50?0.60:0.40,rate:0.18}; };
/* A29 */ window.GZX_A29_calcFactoring   = (amt, days) => { const fee=amt*(0.20/365)*days; return {fee:Math.ceil(fee),net:Math.floor(amt-fee)}; };
/* A30 */ window.GZX_A30_openLC         = async (uid, amt, country) => {
  const fee=Math.max(1000,amt*0.01);
  const r=await window.GZX_safePay?.(uid,fee,'Akreditif komisyonu');
  if(!r?.ok) return;
  const ref=await window.dbPush?.(`users/${uid}/akreditifler`,{amt,country,fee,status:'open',expiresAt:Date.now()+90*86400000,ts:Date.now()});
  window.toast?.(`🏦 Akreditif açıldı (${window.cashFmt?.(fee)||fee+'₺'})`,'success');
  return ref?.key;
};
/* A31-A40 */ 
window.GZX_A31_calcExportInsurance = v => Math.ceil(v*0.018);
window.GZX_A32_calcWarehouseRent   = (days,m3) => days*m3*12;
window.GZX_A33_calcColdChain       = (product, distKm) => distKm * (['süt','et','peynir','dondurma'].some(p=>product.includes(p))?0.85:0.18);
window.GZX_A34_calcHazmatFee       = (product, kg) => ['kimyasal','yakıt','asit'].some(p=>product.includes(p))?kg*4.50:0;
window.GZX_A35_getLabelingReq      = country => ({DE:'Almanca etiket + BPA-free',US:'FDA + İngilizce',SA:'Helal sertifikası + Arapça'}[country]||'Hedef dil etiketi gerekli');
window.GZX_A36_getLangDocCost      = lang => ({EN:500,DE:700,CN:1200,AR:900,RU:800}[lang]||600);
window.GZX_A37_getVATRefund        = async (uid, exportAmt) => { const vat=(await window.dbGet?.('system/kdv'))||0.20; const r=exportAmt*vat; await window.dbTransaction?.(`users/${uid}/bakiye`,b=>(b||0)+r); window.toast?.(`💰 KDV iadesi: ${window.cashFmt?.(r)||r+'₺'}`,'success'); return r; };
window.GZX_A38_getRawMatDiscount   = async uid => { const v=(await window.dbGet?.(`users/${uid}/totalExportVolume`))||0; return v>5000000?0.12:v>1000000?0.07:0.03; };
window.GZX_A39_getFTZDiscount      = async uid => (await window.dbGet?.(`users/${uid}/freeTradeZone`))?0.18:0;
window.GZX_A40_registerFair        = async (uid, fairId) => {
  const fairs={hannover:{name:'Hannover Messe',fee:35000},dubai:{name:'Expo Dubai',fee:25000}};
  const f=fairs[fairId]; if(!f) return window.toast?.('Fuar bulunamadı','error');
  await window.GZX_safePay?.(uid,f.fee,`Fuar: ${f.name}`);
  await window.dbPush?.(`users/${uid}/fuarlar`,{...f,fairId,ts:Date.now()});
  window.toast?.(`🏛️ ${f.name} kaydı tamamlandı`,'success');
};

/* ══════════════════════════════════════════════════════════════════════════
   [B] BANKACILIK & MERKEZ BANKASI — 40 Madde
   ══════════════════════════════════════════════════════════════════════════ */
/* B01 */ window.GZX_B01_getRepoRate    = async () => (await window.dbGet?.('bank/repoRate'))||0.42;
/* B02 */ window.GZX_B02_getReserveReq  = async () => (await window.dbGet?.('bank/reserveRequirement'))||0.10;
/* B03 */ window.GZX_B03_calcCreditScore = async uid => {
  const d=await window.dbGet?.(`users/${uid}`)||{};
  let s=50;
  const loans=Object.values(d.krediler||{});
  s+=loans.filter(l=>l.paidOnTime).length*5;
  s-=loans.filter(l=>l.latePayment).length*10;
  const b=d.bakiye||0;
  if(b>1000000)s+=20; else if(b>100000)s+=10; else if(b<1000)s-=15;
  if(d.karaListede)s-=40;
  if((d.criminalRecord||0)>0)s-=20;
  if((d.dukkanSayisi||0)>0)s+=8;
  const score=Math.max(0,Math.min(100,Math.round(s)));
  await window.dbUpdate?.(`users/${uid}`,{krediSkoru:score});
  return score;
};
/* B04 */ window.GZX_B04_applyForLoan = async (uid, type, amount, term) => {
  const def=GZX_KREDI_TURLERI[type]; if(!def) return window.toast?.('Geçersiz kredi türü','error');
  const score=await window.GZX_B03_calcCreditScore(uid);
  if(score<def.minScore) return window.toast?.(`❌ Kredi reddedildi. Skor: ${score} < ${def.minScore}`,'error',6000);
  if(amount>def.maxAmount) return window.toast?.(`Max: ${window.cashFmt?.(def.maxAmount)||def.maxAmount+'₺'}`,'error');
  const repo=await window.GZX_B01_getRepoRate();
  const rate=def.baseRate+repo*0.5, mr=rate/12;
  const payment=Math.ceil(amount*mr/(1-Math.pow(1+mr,-term)));
  const ref=await window.dbPush?.(`users/${uid}/krediler`,{type,amount,term,monthlyPayment:payment,remainingBalance:amount,interestRate:rate,score,status:'active',approvedAt:Date.now(),nextPayAt:Date.now()+30*86400000});
  await window.dbTransaction?.(`users/${uid}/bakiye`,b=>(b||0)+amount);
  window.toast?.(`✅ Kredi onaylandı! ${window.cashFmt?.(amount)||amount+'₺'} yatırıldı. Taksit: ${window.cashFmt?.(payment)||payment+'₺'}/ay`,'success',8000);
  return {amount,payment,rate,id:ref?.key};
};
/* B05 */ window.GZX_B05_getLoanSchedule = (principal, rate, term) => {
  const mr=rate/12, pmt=principal*mr/(1-Math.pow(1+mr,-term));
  let bal=principal; const sched=[];
  for(let m=1;m<=term;m++){const int=bal*mr,prin=pmt-int; bal-=prin; sched.push({month:m,payment:+pmt.toFixed(2),interest:+int.toFixed(2),balance:+Math.max(0,bal).toFixed(2)});}
  return sched;
};
/* B06 */ window.GZX_B06_calcLateFee    = (amt, days) => Math.ceil(amt*0.003*days);
/* B07 */ window.GZX_B07_openDeposit   = async (uid, amt, type, termDays) => {
  if(amt<1000) return window.toast?.('Min mevduat 1.000₺','error');
  const r=await window.GZX_safePay?.(uid,amt,'Mevduat yatırma'); if(!r?.ok) return;
  const rates={vadesiz:0.10,vadeli_3ay:0.28,vadeli_6ay:0.32,vadeli_1yil:0.38};
  const interest=type==='vadesiz'?0:Math.floor(amt*(rates[type]||0.10)*(termDays||90)/365);
  await window.dbPush?.(`users/${uid}/mevduatlar`,{type,amount:amt,interest,termDays,matureAt:Date.now()+(termDays||0)*86400000,status:'active',ts:Date.now()});
  window.toast?.(`🏦 Mevduat açıldı — Faiz: ${window.cashFmt?.(interest)||interest+'₺'}`,'success');
};
/* B08 */ window.GZX_B08_buyGoldAccount = async (uid, gram) => {
  const price=(await window.dbGet?.('system/goldPrice'))||2400;
  const r=await window.GZX_safePay?.(uid,gram*price,`${gram}g altın`); if(!r?.ok) return;
  await window.dbTransaction?.(`users/${uid}/altinHesap`,g=>(g||0)+gram);
  window.toast?.(`🥇 ${gram}g altın alındı`,'success');
};
/* B09 */ window.GZX_B09_transfer = async (from, to, amt) => {
  const fee=Math.max(5,amt*0.001);
  const r=await window.GZX_safePay?.(from,amt+fee,`Havale → ${to?.slice(0,8)}`); if(!r?.ok) return;
  await window.dbTransaction?.(`users/${to}/bakiye`,b=>(b||0)+amt);
  await window.dbPush?.('transferLog',{from,to,amount:amt,fee,ts:Date.now()});
  window.toast?.(`💸 Havale tamam. Komisyon: ${window.cashFmt?.(fee)||fee+'₺'}`,'success');
};
/* B10 */ window.GZX_B10_addToBlacklist = async (uid, reason) => {
  await window.dbUpdate?.(`users/${uid}`,{karaListede:true,karaListeReason:reason,karaListeAt:Date.now()});
  await window.dbTransaction?.(`users/${uid}/krediSkoru`,s=>Math.max(0,(s||50)-40));
  window.toast?.('⛔ Kara listeye alındı','success');
};
/* B11 */ window.GZX_B11_calcCardLimit = async uid => {
  const s=(await window.dbGet?.(`users/${uid}/krediSkoru`))||50;
  const b=(await window.dbGet?.(`users/${uid}/bakiye`))||0;
  const m=s>=80?3.0:s>=60?2.0:s>=40?1.2:0.5;
  return Math.floor(Math.max(1000,b*0.3*m));
};
/* B12 */ window.GZX_B12_setRepoRate = async rate => {
  if(!window.GZ?.data?.isFounder) return window.toast?.('Yetkisiz','error');
  await window.dbSet?.('bank/repoRate',rate);
  await window.dbPush?.('bank/rateHistory',{rate,ts:Date.now()});
  window.toast?.(`🏦 Repo %${(rate*100).toFixed(1)} yapıldı`,'success');
};
/* B13 */ window.GZX_B13_getMoneySupply = async () => {
  const users=await window.dbGet?.('users')||{};
  const total=Object.values(users).reduce((s,u)=>s+(u.bakiye||0),0);
  const hazine=(await window.dbGet?.('system/hazine'))||0;
  return {M1:total,hazine,total:total+hazine};
};
/* B14 */ window.GZX_B14_getForexReserves = async () => (await window.dbGet?.('bank/forexReserves'))||{USD:5e9,EUR:3e9,GOLD:500};
/* B15 */ window.GZX_B15_swapLine        = async (currency, amount) => { await window.dbUpdate?.('bank/swapLines',{[currency]:amount}); window.toast?.(`🔄 ${currency} swap: ${window.cashFmt?.(amount)||amount}`,'success'); };
/* B16 */ window.GZX_B16_issueBond       = async (uid, face, coupon, years) => { await window.GZX_safePay?.(uid,face*0.002,'Tahvil ihraç ücreti'); await window.dbPush?.(`users/${uid}/tahviller`,{face,coupon,years,ts:Date.now()}); window.toast?.(`📜 Tahvil ihraç edildi (${window.cashFmt?.(face)||face+'₺'}, %${(coupon*100).toFixed(1)})`,'success'); };
/* B17 */ window.GZX_B17_freezeAccount  = async (uid,reason) => { await window.dbUpdate?.(`users/${uid}`,{accountFrozen:true,frozenReason:reason}); window.toast?.('🔒 Hesap donduruldu','success'); };
/* B18 */ window.GZX_B18_unfreezeAccount= async uid => { await window.dbUpdate?.(`users/${uid}`,{accountFrozen:false}); window.toast?.('🔓 Hesap çözüldü','success'); };
/* B19 */ window.GZX_B19_calcEMI        = (p,r,n) => Math.ceil(p*(r/12)*Math.pow(1+r/12,n)/(Math.pow(1+r/12,n)-1));
/* B20 */ window.GZX_B20_earlyPayoff    = async (uid, loanId) => {
  const l=await window.dbGet?.(`users/${uid}/krediler/${loanId}`); if(!l) return;
  const disc=l.remainingBalance*0.03;
  const r=await window.GZX_safePay?.(uid,l.remainingBalance-disc,'Erken kredi kapatma'); if(!r?.ok) return;
  await window.dbUpdate?.(`users/${uid}/krediler/${loanId}`,{status:'paid',paidAt:Date.now()});
  await window.dbUpdate?.(`users/${uid}`,{krediSkoru:firebase.database.ServerValue.increment(5)});
  window.toast?.(`✅ Kredi kapatıldı! ${window.cashFmt?.(disc)||disc+'₺'} indirim kazandınız.`,'success',6000);
};
/* B21-B40 kısa */
window.GZX_B21_calcATMFee      = amt => Math.max(3,amt*0.005);
window.GZX_B22_calcCardAidat   = type => ({gold:150,platinum:300,black:600,standard:0}[type]||0);
window.GZX_B23_issueCheque     = async (uid,to,amt,due) => { const r=await window.dbPush?.('cheques',{from:uid,to,amount:amt,dueDate:due,status:'pending',ts:Date.now()}); window.toast?.(`📄 Çek: ${window.cashFmt?.(amt)||amt+'₺'}`,'success'); return r?.key; };
window.GZX_B24_getDepositGuarantee = amt => Math.min(amt,250000);
window.GZX_B25_bankLicense     = async uid => { const r=await window.GZX_safePay?.(uid,10000000,'Banka lisansı'); if(!r?.ok) return; await window.dbUpdate?.(`users/${uid}`,{hasBankLicense:true}); window.toast?.('🏦 Banka lisansı alındı!','success',8000); };
window.GZX_B26_calcArbitrage   = async () => { const r=await window.dbGet?.('system/forexRates')||{USD:32.5,EUR:35}; return {rates:r,opportunity:r.EUR/r.USD>1.08?'Fırsat var':'Yok'}; };
window.GZX_B27_offshoreAccount = async uid => window.dbUpdate?.(`users/${uid}`,{hasOffshore:true});
window.GZX_B28_islamicBanking  = async (uid,amt) => window.GZX_B07_openDeposit(uid,amt,'vadesiz',0);
window.GZX_B29_creditInsurance = loanAmt => Math.ceil(loanAmt*0.015);
window.GZX_B30_stressTest      = async () => { const u=await window.dbGet?.('users')||{}; return Object.entries(u).map(([id,d])=>({uid:id,balance:d.bakiye||0,risk:(d.bakiye||0)<1000?'YÜKSEK':'DÜŞÜK'})).sort((a,b)=>a.balance-b.balance); };
window.GZX_B31_munzamKarsilik  = async () => (await window.dbGet?.('bank/munzam'))||0.03;
window.GZX_B32_paraArzi        = async () => window.GZX_B13_getMoneySupply();
window.GZX_B33_dovizRezerv     = async () => window.GZX_B14_getForexReserves();
window.GZX_B34_faizKoridoru    = async () => ({upper:(await window.GZX_B01_getRepoRate())+0.03,lower:(await window.GZX_B01_getRepoRate())-0.03});
window.GZX_B35_likiditeYonet   = async () => ({ status:'Normal', excessLiquidity: Math.random()*1e9 });
window.GZX_B36_kaldiracOrani   = async uid => { const b=(await window.dbGet?.(`users/${uid}/bakiye`))||1; const l=Object.values((await window.dbGet?.(`users/${uid}/krediler`))||{}).reduce((s,k)=>s+(k.amount||0),0); return +(l/b).toFixed(2); };
window.GZX_B37_sermayeYeterliligi = async uid => { const r=await window.GZX_B36_kaldiracOrani(uid); return {ratio:r,adequate:r<=12}; };
window.GZX_B38_krediMevduatOrani = async () => { const s=await window.GZX_B13_getMoneySupply(); return {ratio:+(s.M1/Math.max(1,s.hazine)).toFixed(2)}; };
window.GZX_B39_senetDuzenle    = async (uid,to,amt,due) => window.GZX_B23_issueCheque(uid,to,amt,due);
window.GZX_B40_mevduatGuvence  = window.GZX_B24_getDepositGuarantee;


/* ══════════════════════════════════════════════════════════════════════════
   [C] BORSA & KRİPTO DÜNYASI — 40 Madde
   ══════════════════════════════════════════════════════════════════════════ */
/* C01 */ window.GZX_C01_initiateIPO = async (uid, company, shares, price) => {
  const val=shares*price; if(val<1000000) return window.toast?.('Min piyasa değeri 1M₺','error');
  const r=await window.GZX_safePay?.(uid,val*0.02,`IPO: ${company}`); if(!r?.ok) return;
  const ref=await window.dbPush?.('ipo/listings',{uid,company,shares,price,soldShares:0,status:'active',startedAt:Date.now(),endsAt:Date.now()+72*3600000});
  window.toast?.(`📊 ${company} IPO başlatıldı!`,'success'); return ref?.key;
};
/* C02 */ window.GZX_C02_distributeDividend = async (symbol, perShare) => {
  const h=await window.dbGet?.('stocks/holdings')||{};
  let total=0;
  for(const [uid,held] of Object.entries(h)){ const s=(held[symbol]||0); if(s>0){await window.dbTransaction?.(`users/${uid}/bakiye`,b=>(b||0)+s*perShare); total+=s*perShare;} }
  window.toast?.(`💰 ${symbol} temettü: toplam ${window.cashFmt?.(total)||total+'₺'}`,'success',6000);
  return total;
};
/* C03 */ window.GZX_C03_checkPriceLimit = async (symbol, newPrice) => {
  const prev=(await window.dbGet?.(`stocks/prices/${symbol}/prevClose`))||100;
  if(newPrice>prev*1.10) return {blocked:true,capped:prev*1.10,reason:'TAVAN'};
  if(newPrice<prev*0.90) return {blocked:true,capped:prev*0.90,reason:'TABAN'};
  return {blocked:false};
};
/* C04 */ window.GZX_C04_detectManipulation = async symbol => {
  const t=Object.values(await window.dbGet?.(`stocks/recentTrades/${symbol}`)||{}).slice(-20);
  const buy=t.filter(x=>x.type==='buy').reduce((s,x)=>s+x.amount,0);
  const sell=t.filter(x=>x.type==='sell').reduce((s,x)=>s+x.amount,0);
  const imb=buy+sell>0?Math.abs(buy-sell)/(buy+sell):0;
  if(imb>0.85) await window.dbPush?.('adminAlerts',{type:'manipulation',symbol,imb,message:`⚠️ Manipülasyon: ${symbol}`,ts:Date.now(),read:false});
  return {suspicious:imb>0.85,imbalance:+imb.toFixed(3)};
};
/* C05 */ window.GZX_C05_runWhaleBots = async () => {
  for(const [sym,def] of Object.entries(GZX_HISSELER)){
    const cur=(await window.dbGet?.(`stocks/prices/${sym}/current`))||def.price;
    const chg=(Math.random()-0.50)*cur*0.03;
    const np=Math.max(1,+(cur+chg).toFixed(2));
    const lim=await window.GZX_C03_checkPriceLimit(sym,np);
    await window.dbUpdate?.(`stocks/prices/${sym}`,{current:lim.blocked?lim.capped:np,updatedAt:Date.now()});
  }
};
/* C06 */ window.GZX_C06_coldWalletTransfer = async (uid, symbol, amt) => {
  const fee=amt*0.001+50;
  await window.GZX_safePay?.(uid,fee,`Soğuk cüzdan: ${symbol}`);
  window.toast?.(`❄️ ${amt} ${symbol} soğuk cüzdana aktarıldı. Ücret: ${window.cashFmt?.(fee)||fee+'₺'}`,'success');
};
/* C07 */ window.GZX_C07_openLeverage = async (uid, symbol, dir, lev, margin) => {
  if(lev<1||lev>100) return window.toast?.('Kaldıraç 1x-100x arası olmalı','error');
  const r=await window.GZX_safePay?.(uid,margin,`Marjin ${symbol}x${lev}`); if(!r?.ok) return;
  const cur=(await window.dbGet?.(`stocks/prices/${symbol}/current`))||(GZX_HISSELER[symbol]?.price||100);
  const liqPrice=dir==='long'?+(cur*(1-1/lev*0.9)).toFixed(2):+(cur*(1+1/lev*0.9)).toFixed(2);
  const ref=await window.dbPush?.(`users/${uid}/leveragePositions`,{symbol,dir,lev,margin,positionSize:margin*lev,entryPrice:cur,liquidationPrice:liqPrice,status:'open',openedAt:Date.now()});
  window.toast?.(`📊 ${lev}x ${dir}. Likidasyon: ${liqPrice}₺`,'info',6000);
  return {posId:ref?.key,liqPrice};
};
/* C08 */ window.GZX_C08_checkLiquidations = async uid => {
  const pos=await window.dbGet?.(`users/${uid}/leveragePositions`)||{};
  for(const [pid,p] of Object.entries(pos)){
    if(p.status!=='open') continue;
    const cur=(await window.dbGet?.(`stocks/prices/${p.symbol}/current`))||p.entryPrice;
    const liq=p.dir==='long'?cur<=p.liquidationPrice:cur>=p.liquidationPrice;
    if(liq){ await window.dbUpdate?.(`users/${uid}/leveragePositions/${pid}`,{status:'liquidated',liquidatedAt:Date.now()}); window.toast?.(`💀 LİKİDE EDİLDİ: ${p.symbol}`,'error',8000); }
  }
};
/* C09 */ window.GZX_C09_getCandleData  = async (sym,limit) => Object.values(await window.dbGet?.(`stocks/candles/${sym}`)||{}).sort((a,b)=>a.ts-b.ts).slice(-(limit||50));
/* C10 */ window.GZX_C10_getMiningDiff  = async sym => { const d=(await window.dbGet?.(`crypto/difficulty/${sym}`))||1.0; const rw=(await window.dbGet?.(`crypto/reward/${sym}`))||10; return {difficulty:d,reward:rw,earningsPerDay:rw/d}; };
/* C11 */ window.GZX_C11_burnAltcoins   = async (uid, sym, amt) => {
  const h=(await window.dbGet?.(`users/${uid}/crypto/${sym}`))||0; if(h<amt) return window.toast?.('Yeterli kripto yok','error');
  await window.dbTransaction?.(`users/${uid}/crypto/${sym}`,h2=>Math.max(0,(h2||0)-amt));
  await window.dbTransaction?.(`crypto/totalSupply/${sym}`,s=>Math.max(0,(s||1e6)-amt));
  await window.dbTransaction?.(`crypto/price/${sym}`,p=>(p||1)*(1+amt/10000*0.01));
  window.toast?.(`🔥 ${amt} ${sym} yakıldı! Değer artabilir.`,'success',6000);
};
/* C12 */ window.GZX_C12_buyStock = async (uid, sym, qty) => {
  const p=(await window.dbGet?.(`stocks/prices/${sym}/current`))||GZX_HISSELER[sym]?.price||100;
  const r=await window.GZX_safePay?.(uid,p*qty+Math.max(5,p*qty*0.002),`Hisse: ${sym}x${qty}`); if(!r?.ok) return;
  await window.dbTransaction?.(`stocks/holdings/${uid}/${sym}`,h=>(h||0)+qty);
  await window.dbPush?.(`stocks/recentTrades/${sym}`,{uid,type:'buy',amount:qty,price:p,ts:Date.now()});
  window.toast?.(`📈 ${qty} ${sym} alındı`,'success');
};
/* C13 */ window.GZX_C13_sellStock = async (uid, sym, qty) => {
  const h=(await window.dbGet?.(`stocks/holdings/${uid}/${sym}`))||0; if(h<qty) return window.toast?.('Yeterli hisse yok','error');
  const p=(await window.dbGet?.(`stocks/prices/${sym}/current`))||100;
  const net=p*qty-Math.max(5,p*qty*0.002);
  await window.dbTransaction?.(`stocks/holdings/${uid}/${sym}`,h2=>Math.max(0,(h2||0)-qty));
  await window.dbTransaction?.(`users/${uid}/bakiye`,b=>(b||0)+net);
  window.toast?.(`📉 ${qty} ${sym} satıldı. Net: ${window.cashFmt?.(net)||net+'₺'}`,'success');
};
/* C14 */ window.GZX_C14_stopLoss   = async (uid,sym,trigger) => { await window.dbPush?.(`users/${uid}/stopLoss`,{sym,trigger,active:true,ts:Date.now()}); window.toast?.(`🛑 Stop-Loss: ${sym} @ ${trigger}₺`,'info'); };
/* C15 */ window.GZX_C15_takeProfit = async (uid,sym,trigger) => { await window.dbPush?.(`users/${uid}/takeProfit`,{sym,trigger,active:true,ts:Date.now()}); window.toast?.(`✅ Take-Profit: ${sym} @ ${trigger}₺`,'info'); };
/* C16 */ window.GZX_C16_portfolioScore = async uid => { const h=await window.dbGet?.(`stocks/holdings/${uid}`)||{}; const n=Object.keys(h).length; return {count:n,score:Math.min(100,n*15),label:n>=5?'İyi Çeşitlendirilmiş':'Yoğunlaşmış'}; };
/* C17 */ window.GZX_C17_getBeta    = async sym => (await window.dbGet?.(`stocks/beta/${sym}`))||1.0;
/* C18 */ window.GZX_C18_getVIX     = async () => (await window.dbGet?.('market/vix'))||22;
/* C19 */ window.GZX_C19_getOrderBook = async sym => (await window.dbGet?.(`stocks/orderBook/${sym}`))||{bids:[],asks:[]};
/* C20 */ window.GZX_C20_findArbitrage = async () => ({opportunity:Math.random()>0.9,detail:'BTC/ETH spread>3%'});
/* C21 */ window.GZX_C21_cryptoBridge = async (uid,from,to,amt) => window.toast?.(`🌉 ${amt} ${from}→${to} bridge başlatıldı`,'info');
/* C22 */ window.GZX_C22_flashLoan    = async (uid, amt) => window.toast?.(`⚡ Flash loan: ${window.cashFmt?.(amt)||amt+'₺'}`,'info');
/* C23 */ window.GZX_C23_yieldFarm   = async (uid, pool, amt) => { await window.dbPush?.(`users/${uid}/yieldFarms`,{pool,amount:amt,apy:0.42,ts:Date.now()}); window.toast?.(`🌾 ${pool} yield farming (APY %42)`,'success'); };
/* C24 */ window.GZX_C24_staking     = async (uid,sym,amt) => { await window.dbPush?.(`users/${uid}/stakings`,{sym,amount:amt,apy:0.15,ts:Date.now()}); window.toast?.(`🔒 ${amt} ${sym} stake edildi (APY %15)`,'success'); };
/* C25 */ window.GZX_C25_DeFiLend    = async (uid,amt,sym) => window.toast?.(`💱 ${amt} ${sym} DeFi havuzuna yatırıldı`,'info');
/* C26-C40 */ 
window.GZX_C26_capitalIncrease = async (uid,sym,shares,price) => window.dbPush?.('ipo/listings',{uid,symbol:sym,shares,price,type:'sermaye_artisi',ts:Date.now()});
window.GZX_C27_buyback         = async (uid,sym,amt) => window.GZX_C13_sellStock(uid,sym,amt);
window.GZX_C28_delisting       = async sym => window.dbUpdate?.(`stocks/prices/${sym}`,{status:'delisted',delistedAt:Date.now()});
window.GZX_C29_indexFund       = async uid => window.toast?.('📊 Endeks fonu takibi aktif','info');
window.GZX_C30_callOption      = async (uid,sym,strike,prem) => window.dbPush?.(`users/${uid}/options`,{type:'call',sym,strike,prem,ts:Date.now()});
window.GZX_C31_putOption       = async (uid,sym,strike,prem) => window.dbPush?.(`users/${uid}/options`,{type:'put',sym,strike,prem,ts:Date.now()});
window.GZX_C32_futures         = async (uid,sym,qty,price) => window.dbPush?.(`users/${uid}/futures`,{sym,qty,price,ts:Date.now()});
window.GZX_C33_CFD             = async (uid,sym,dir,amt) => window.GZX_C07_openLeverage(uid,sym,dir,10,amt);
window.GZX_C34_warrant         = async sym => window.dbGet?.(`stocks/warrants/${sym}`);
window.GZX_C35_repoTrade       = async (uid,amt,rate,days) => window.dbPush?.(`users/${uid}/repos`,{amt,rate,days,ts:Date.now()});
window.GZX_C36_reverseRepo     = async (uid,amt) => window.GZX_B07_openDeposit(uid,amt,'vadeli_3ay',90);
window.GZX_C37_marketMaker     = async uid => window.dbUpdate?.(`users/${uid}`,{isMarketMaker:true});
window.GZX_C38_darkPool        = async (uid,sym,qty,price) => window.dbPush?.('darkPool/orders',{uid,sym,qty,price,ts:Date.now()});
window.GZX_C39_HFT             = async uid => window.toast?.('⚡ HFT gerçek zamanlı DB gerektirir','info');
window.GZX_C40_algoBot         = async (uid,strategy) => window.dbPush?.(`users/${uid}/algoBots`,{strategy,active:true,ts:Date.now()});

/* ══════════════════════════════════════════════════════════════════════════
   [D] EMLAK & GAYRİMENKUL — 40 Madde
   ══════════════════════════════════════════════════════════════════════════ */
/* D01 */ window.GZX_D01_calcTapuHarci  = (price, type) => Math.ceil(price*(GZX_EMLAK[type]||GZX_EMLAK.konut).tapuHarci);
/* D02 */ window.GZX_D02_calcEmlakVergisi = async propId => { const p=await window.dbGet?.(`properties/${propId}`); if(!p)return 0; const v=Math.ceil(p.purchasePrice*(GZX_BOLGELER[p.region]||GZX_BOLGELER.cevre).multiplier); return Math.ceil(v*(GZX_EMLAK[p.type]||GZX_EMLAK.konut).emlakVergisi); };
/* D03 */ window.GZX_D03_calcRentMultiplier = (price, monthlyRent) => +(price/(monthlyRent*12)).toFixed(1);
/* D04 */ window.GZX_D04_calcDepreciation  = (price, monthlyRent) => { const y=price/(monthlyRent*12); return {years:+y.toFixed(1),months:Math.ceil(y*12)}; };
/* D05 */ window.GZX_D05_buyProperty = async (uid, def) => {
  const {name,type,region,price,m2}=def;
  const harci=window.GZX_D01_calcTapuHarci(price,type);
  const kdv=price*(GZX_EMLAK[type]||{}).kdv||0;
  const r=await window.GZX_safePay?.(uid,price+harci+kdv,`Mülk: ${name}`); if(!r?.ok) return;
  const ref=await window.dbPush?.('properties',{name,type,region,purchasePrice:price,m2,owner:uid,boughtAt:Date.now(),isForSale:false,monthlyRent:0,isRented:false});
  await window.dbSet?.(`users/${uid}/mulkler/${ref?.key}`,true);
  window.toast?.(`🏠 ${name} satın alındı!`,'success',7000); return ref?.key;
};
/* D06 */ window.GZX_D06_getPropertyValue = (price, region, months) => Math.ceil(price*Math.pow(1+(GZX_BOLGELER[region]||GZX_BOLGELER.cevre).growth,months));
/* D07 */ window.GZX_D07_calcRestoration  = (m2, cond) => m2*({iyi:200,orta:600,kötü:1200,harabe:2500}[cond]||600);
/* D08 */ window.GZX_D08_applyZoning      = async (uid, propId, plan) => { const f={yeni_kat:15000,imar_degisikligi:25000,teras:8000}[plan]||10000; await window.GZX_safePay?.(uid,f,`İmar: ${plan}`); await window.dbPush?.('zoningApplications',{uid,propId,plan,status:'pending',ts:Date.now()}); window.toast?.('🏗️ İmar başvurusu yapıldı','info'); };
/* D09 */ window.GZX_D09_mortgageSale     = async (uid, propId, buyerUid, salePrice) => { const p=await window.dbGet?.(`properties/${propId}`); if(!p||p.owner!==uid) return window.toast?.('Mülk size ait değil','error'); await window.dbTransaction?.(`users/${uid}/bakiye`,b=>(b||0)+salePrice); await window.dbUpdate?.(`properties/${propId}`,{owner:buyerUid,soldAt:Date.now()}); window.toast?.(`✅ Mülk satıldı: ${window.cashFmt?.(salePrice)||salePrice+'₺'}`,'success'); };
/* D10 */ window.GZX_D10_getDASKPremium   = (m2, region, year) => { const z={merkez:4,avrupa:3,asya:3,cevre:2,koy:1}[region]||2; return Math.ceil(m2*z*8*(Date.now()/1000/31536000-year>30?1.5:1.0)); };
/* D11 */ window.GZX_D11_evictTenant      = async (uid, propId) => { await window.dbUpdate?.(`properties/${propId}`,{isRented:false,tenantUid:null,evictedAt:Date.now()}); window.toast?.('📜 Kiracı tahliye edildi','info'); };
/* D12 */ window.GZX_D12_calcRentIncrease = async cur => { const t=(await window.dbGet?.('system/tufRate'))||0.45; return Math.ceil(cur*(1+Math.min(t,0.25))); };
/* D13 */ window.GZX_D13_calcAidat        = (m2, age) => Math.ceil(m2*8*(age>20?1.5:1));
/* D14 */ window.GZX_D14_leaseContract    = async (uid, propId, tenantUid, rent) => { await window.dbUpdate?.(`properties/${propId}`,{isRented:true,tenantUid,monthlyRent:rent,rentedAt:Date.now()}); window.toast?.(`📋 Kira sözleşmesi: ${window.cashFmt?.(rent)||rent+'₺'}/ay`,'success'); };
/* D15 */ window.GZX_D15_valueReport      = async propId => { const p=await window.dbGet?.(`properties/${propId}`); if(!p)return null; const m=Math.floor((Date.now()-p.boughtAt)/2592000000); return {...p,currentValue:window.GZX_D06_getPropertyValue(p.purchasePrice,p.region,m),months:m}; };
/* D16 */ window.GZX_D16_foreclosure      = async propId => window.dbUpdate?.(`properties/${propId}`,{foreclosed:true,ts:Date.now()});
/* D17 */ window.GZX_D17_expropriation    = async (propId, comp) => { const p=await window.dbGet?.(`properties/${propId}`); if(!p) return; await window.dbTransaction?.(`users/${p.owner}/bakiye`,b=>(b||0)+comp); await window.dbUpdate?.(`properties/${propId}`,{owner:'state',expropriatedAt:Date.now()}); };
/* D18 */ window.GZX_D18_REIT             = async (uid, amt) => { await window.dbPush?.(`users/${uid}/GYO`,{amount:amt,joinedAt:Date.now(),expectedReturn:0.12}); window.toast?.('🏢 GYO\'ya katıldınız (%12 yıllık)'  ,'success'); };
/* D19 */ window.GZX_D19_luxuryTax        = price => price>5000000?price*0.03:0;
/* D20 */ window.GZX_D20_rentalTax        = income => Math.ceil(income*0.15);
/* D21 */ window.GZX_D21_constructionPermit = async (uid, fee) => window.GZX_safePay?.(uid,fee||8000,'İnşaat ruhsatı');
/* D22 */ window.GZX_D22_occupancyPermit  = async (uid, propId) => window.dbPush?.('permits/occupancy',{uid,propId,ts:Date.now()});
/* D23 */ window.GZX_D23_buildingAgeDiscount = (price, year) => price*(Date.now()/1000/31536000-year>30?0.85:1.0);
/* D24 */ window.GZX_D24_urbanTransformation = async propId => window.dbUpdate?.(`properties/${propId}`,{urbanTransform:true,bonus:1.3});
/* D25 */ window.GZX_D25_cooperative      = async (uid, name) => window.dbPush?.('cooperatives',{name,founder:uid,members:{[uid]:true},ts:Date.now()});
/* D26 */ window.GZX_D26_socialHousing    = async uid => window.dbPush?.('socialHousingApps',{uid,ts:Date.now(),status:'pending'});
/* D27 */ window.GZX_D27_storageUnit      = async (uid, m3) => window.GZX_safePay?.(uid,m3*250,'Depo kirası');
/* D28 */ window.GZX_D28_tourismBonus     = region => (['merkez','avrupa'].includes(region)?1.15:1.0);
/* D29 */ window.GZX_D29_financialLease   = async (uid, propId, months) => window.dbPush?.(`users/${uid}/leasings`,{propId,months,ts:Date.now()});
/* D30 */ window.GZX_D30_industrialVal    = (m2, type) => m2*({fabrika:1200,depo:600}[type]||400);
/* D31 */ window.GZX_D31_katIrtifaki      = async propId => window.dbUpdate?.(`properties/${propId}`,{katIrtifaki:true});
/* D32 */ window.GZX_D32_katMulkiyeti     = async propId => window.dbUpdate?.(`properties/${propId}`,{katMulkiyeti:true});
/* D33 */ window.GZX_D33_municipalityLien = async propId => window.dbUpdate?.(`properties/${propId}`,{municipalityLien:true});
/* D34 */ window.GZX_D34_foreclosureAuction = async propId => window.dbUpdate?.(`properties/${propId}`,{inAuction:true});
/* D35 */ window.GZX_D35_forestRestriction = region => region==='koy';
/* D36 */ window.GZX_D36_sitAlan          = async propId => (await window.dbGet?.(`properties/${propId}/sitAlan`))||false;
/* D37 */ window.GZX_D37_imarAffi         = async (propId, fee) => { await window.GZX_safePay?.(window.GZ?.uid,fee||50000,'İmar affı'); await window.dbUpdate?.(`properties/${propId}`,{imarAffi:true,legalizedAt:Date.now()}); window.toast?.('✅ İmar affı onaylandı','success'); };
/* D38 */ window.GZX_D38_altyapiBonusu    = async (propId, bonus) => window.dbTransaction?.(`properties/${propId}/value`,v=>(v||0)*bonus);
/* D39 */ window.GZX_D39_agricultureLimit = async uid => ({canBuy:(await window.dbGet?.(`users/${uid}/level`))||1>=10});
/* D40 */ window.GZX_D40_propManager      = async propId => window.dbGet?.(`properties/${propId}`);

/* ══════════════════════════════════════════════════════════════════════════
   [E] HABER, SİYASET & SOSYAL OLAYLAR — 40 Madde
   ══════════════════════════════════════════════════════════════════════════ */
const _addNews = (title, type, impact) => window.dbPush?.('news',{title,type,impact:impact||'neutral',ts:Date.now()});

/* E01 */ window.GZX_E01_updateInflation = async rate => { if(!window.GZ?.data?.isFounder) return window.toast?.('Yetkisiz','error'); await window.dbUpdate?.('system',{tufRate:rate,enflasyon:rate,lastInflationUpdate:Date.now()}); await _addNews(`📊 Enflasyon %${(rate*100).toFixed(1)} güncellendi`,'inflation','negative'); window.toast?.(`📊 Enflasyon %${(rate*100).toFixed(1)} oldu`,'success'); };
/* E02 */ window.GZX_E02_setMinWage      = async wage => { const old=(await window.dbGet?.('system/minWage'))||17002; await window.dbSet?.('system/minWage',wage); await _addNews(`💰 Asgari ücret ${wage.toLocaleString('tr-TR')}₺ oldu (+${Math.round((wage/old-1)*100)}%)`,'wage','positive'); window.toast?.(`💰 Asgari ücret ${wage.toLocaleString('tr-TR')}₺`,'success'); };
/* E03 */ window.GZX_E03_electionEffect  = async () => { for(const s of Object.keys(GZX_HISSELER)){const p=(await window.dbGet?.(`stocks/prices/${s}/current`))||100; await window.dbUpdate?.(`stocks/prices/${s}`,{current:+(p*(1+(Math.random()-0.5)*0.30)).toFixed(2)});} await _addNews('🗳️ SEÇİM: Piyasalarda yüksek dalgalanma!','politics','volatile'); window.toast?.('🗳️ Seçim atmosferi: Piyasalar çalkantılı!','warn',6000); };
/* E04 */ window.GZX_E04_triggerStrike   = async (sector, days) => { await window.dbUpdate?.(`system/strikes/${sector}`,{active:true,startedAt:Date.now(),endsAt:Date.now()+days*86400000,penalty:0.40}); await _addNews(`⚠️ GREV: ${sector} sektörü ${days} gün duraklıyor`,'strike','negative'); window.toast?.(`⚠️ ${sector} grevi başladı!`,'warn',6000); };
/* E05 */ window.GZX_E05_imposeSanction  = async (country, prods) => { await window.dbUpdate?.('system/sanctions',{[country]:{products:prods,since:Date.now()}}); await _addNews(`🚫 ${country} ambargo altına alındı`,'sanction','negative'); };
/* E06 */ window.GZX_E06_taxAmnesty      = async (pct, days) => { await window.dbUpdate?.('system/taxAmnesty',{active:true,pct,deadline:Date.now()+days*86400000}); await _addNews(`🎁 VERGİ AFFI: %${pct} indirim (${days} gün)`,'tax_amnesty','positive'); window.toast?.(`🎁 Vergi affı ilan edildi! %${pct} indirim`,'success',8000); };
/* E07 */ window.GZX_E07_techRevolution  = async sector => { await window.dbUpdate?.(`system/techBonus`,{[sector]:1.25,since:Date.now()}); await _addNews(`🚀 TEKNOLOJİ DEVRİMİ: ${sector} %25 verimlilik artışı`,'tech','positive'); window.toast?.(`🚀 Teknoloji devrimi! ${sector} %25 artı`,'success',6000); };
/* E08 */ window.GZX_E08_corruptionOp    = async (uid, amt) => { if(!window.GZ?.data?.isFounder) return; await window.dbTransaction?.(`users/${uid}/bakiye`,b=>Math.max(0,(b||0)-amt)); await window.dbUpdate?.(`users/${uid}`,{suspended:true}); await _addNews('🚔 YOLSUZLUK OPERASYONU: Güven sarsıldı','corruption','negative'); for(const s of Object.keys(GZX_HISSELER)){await window.dbTransaction?.(`stocks/prices/${s}/current`,p=>p*0.95);} };
/* E09 */ window.GZX_E09_holidayBonus    = async amt => { const u=await window.dbGet?.('users')||{}; const officers=Object.entries(u).filter(([,x])=>['police','soldier','judge','official'].includes(x.role)); for(const [uid] of officers){await window.dbTransaction?.(`users/${uid}/bakiye`,b=>(b||0)+amt);} await _addNews(`🎊 Bayram ikramiyesi: ${officers.length} memura ${window.cashFmt?.(amt)||amt+'₺'}`,'bonus','positive'); return officers.length*amt; };
/* E10 */ window.GZX_E10_naturalDisaster = async (province, type) => { await window.dbUpdate?.(`politics/${province}`,{disaster:{type,at:Date.now()},happiness:firebase.database.ServerValue.increment(-20)}); await _addNews(`🌋 AFET: ${province}'de ${type}!`,'disaster','critical'); window.toast?.(`🌋 AFET: ${province} — ${type}`,'error',10000); };
/* E11 */ window.GZX_E11_pandemic        = async () => { await window.dbUpdate?.('system',{pandemicActive:true,productionPenalty:0.30,since:Date.now()}); await _addNews('🦠 PANDEMİ: Üretim %30 düştü!','pandemic','critical'); };
/* E12 */ window.GZX_E12_electionPromise = async promise => _addNews(`🗳️ Seçim vaadi: ${promise}`,'politics','neutral');
/* E13 */ window.GZX_E13_govChange       = async policy => window.dbUpdate?.('system/policy',policy);
/* E14 */ window.GZX_E14_centralBankChg  = async rate => window.GZX_B12_setRepoRate?.(rate);
/* E15 */ window.GZX_E15_currencyCrisis  = async () => { await window.dbTransaction?.('system/forexRates/USD',r=>(r||32)*1.20); await _addNews('💸 DÖVİZ KRİZİ: TL %20 değer kaybetti!','currency','critical'); window.toast?.('💸 DÖVİZ KRİZİ!','error',8000); };
/* E16 */ window.GZX_E16_energyCrisis    = async () => { await window.dbTransaction?.('system/fuelPrice',p=>(p||28)*1.40); await _addNews('⛽ ENERJİ KRİZİ: Yakıt %40 arttı!','energy','critical'); };
/* E17 */ window.GZX_E17_foodCrisis      = async () => { await window.dbTransaction?.('market/baseprices/ekmek',p=>(p||5)*1.50); await _addNews('🌾 GIDA KRİZİ: Temel fiyatlar artıyor!','food','critical'); };
/* E18 */ window.GZX_E18_warScenario     = async region => window.dbUpdate?.(`system/wars/${region}`,{active:true,since:Date.now(),penalty:0.50});
/* E19 */ window.GZX_E19_peaceDeal       = async region => { await window.dbUpdate?.(`system/wars/${region}`,{active:false,endedAt:Date.now()}); await _addNews(`✌️ BARIŞ: ${region} anlaşması imzalandı!`,'peace','positive'); };
/* E20 */ window.GZX_E20_globalCrash     = async () => { for(const s of Object.keys(GZX_HISSELER)){await window.dbTransaction?.(`stocks/prices/${s}/current`,p=>Math.max(1,p*0.65));} await _addNews('📉 KÜRESEL KRİZ: Borsalar %35 düştü!','global','critical'); window.toast?.('📉 KÜRESEL KRİZ!','error',10000); };
/* E21-E40 kısa tetikleyiciler */
window.GZX_E21_IMFDeal          = async agreed => window.dbUpdate?.('system',{IMFProgram:agreed});
window.GZX_E22_taxLawChange     = async newKDV => { await window.dbSet?.('system/kdv',newKDV); await _addNews(`🏛️ KDV %${(newKDV*100).toFixed(0)} yapıldı`,'tax'); };
window.GZX_E23_socialSecReform  = async rate => window.dbSet?.('system/sgkRate',rate);
window.GZX_E24_privatization    = async sector => window.dbUpdate?.(`system/state/${sector}`,{privatized:true});
window.GZX_E25_nationalization  = async sector => window.dbUpdate?.(`system/state/${sector}`,{nationalized:true});
window.GZX_E26_capitalFlight    = async pct => window.dbTransaction?.('bank/forexReserves/USD',r=>Math.max(0,(r||5e9)*(1-pct)));
window.GZX_E27_crisisPackage    = async amt => { await window.dbTransaction?.('system/hazine',h=>(h||0)+amt); await _addNews(`🆘 KRİZ PAKETİ: ${window.cashFmt?.(amt)||amt+'₺'} aktarıldı`,'stimulus'); };
window.GZX_E28_stimulusPackage  = async (sector,amt) => _addNews(`💉 TEŞVIK: ${sector} → ${window.cashFmt?.(amt)||amt+'₺'}`,'stimulus','positive');
window.GZX_E29_debtRestructure  = async uid => window.dbUpdate?.(`users/${uid}`,{debtRestructured:true});
window.GZX_E30_inflationTarget  = async t => window.dbSet?.('system/inflationTarget',t);
window.GZX_E31_forexIntervention = async amt => window.dbTransaction?.('bank/forexReserves/USD',r=>Math.max(0,(r||5e9)-amt));
window.GZX_E32_laborLaw         = async changes => window.dbUpdate?.('system/laborLaw',changes);
window.GZX_E33_techBan          = async platform => window.dbUpdate?.(`system/bans/${platform}`,{banned:true});
window.GZX_E34_currencyReform   = async (name,ratio) => window.dbUpdate?.('system/currency',{name,ratio});
window.GZX_E35_climateChange    = async () => { await window.dbTransaction?.('system/fuelPrice',p=>(p||28)*1.15); await _addNews('🌡️ İKLİM: Enerji maliyetleri artıyor','climate'); };
window.GZX_E36_AIRevolution     = async () => { await window.GZX_E07_techRevolution?.('teknoloji'); await _addNews('🤖 YAPAY ZEKA DEVRİMİ: Üretkenlik sıçradı!','tech','positive'); };
window.GZX_E37_politicalCrisis  = async () => _addNews('🚨 SİYASİ KRİZ: Piyasalar tedirgin!','politics','negative');
window.GZX_E38_globalNews       = async (headline, impact) => _addNews(headline,'global',impact);
window.GZX_E39_barajIkramiyesi  = window.GZX_E09_holidayBonus;
window.GZX_E40_marketEvent      = async (type, mag) => window.dbPush?.('marketEvents',{type,magnitude:mag,ts:Date.now()});


/* ══════════════════════════════════════════════════════════════════════════
   [M] MUHTARLIK & YERELYÖNETİM
   ══════════════════════════════════════════════════════════════════════════ */

/* M01 — Kimlik Kartı Çıkartma (KİMİLİK OLMADAN TİCARET YAPAMAZ) */
window.GZX_M01_issueIDCard = async function (uid) {
  const fee     = (await window.dbGet?.('system/idCardFee')) || 500;
  const hasCard = await window.dbGet?.(`users/${uid}/kimlikKarti`);
  if (hasCard) return window.toast?.('Kimlik kartınız zaten var', 'warn');
  const r = await window.GZX_safePay?.(uid, fee, 'Kimlik Kartı');
  if (!r?.ok) return;
  const tcNo = 'GZ' + String(Date.now()).slice(-9);
  const data = await window.dbGet?.(`users/${uid}`) || {};
  await window.dbUpdate?.(`users/${uid}`, {
    kimlikKarti: {
      tc: tcNo, ad: data.username || 'OYUNCU', il: data.province || 'İstanbul',
      verilis: Date.now(), muhtarOnay: true, seriNo: `SRK-${Date.now().toString(36).toUpperCase()}`
    }, canTrade: true
  });
  window.toast?.(`🪪 Kimlik kartı hazır! TC: ${tcNo}`, 'success', 8000);
  return tcNo;
};

/* M02 — Ticaret Eligibility Kontrolü */
window.GZX_M02_checkTradeEligibility = async function (uid) {
  const d = await window.dbGet?.(`users/${uid}`) || {};
  if (!d.kimlikKarti) {
    window.toast?.('⛔ Ticaret için önce Muhtardan kimlik kartı çıkartmalısınız! (500₺)', 'error', 8000);
    return false;
  }
  if (d.accountFrozen) { window.toast?.('⛔ Hesabınız dondurulmuş', 'error'); return false; }
  if (d.suspended) { window.toast?.('⛔ Hesabınız askıya alınmış', 'error'); return false; }
  return true;
};

/* M03 — Fakirlik Belgesi & Sosyal Yardım */
window.GZX_M03_checkPovertyBenefit = async function (uid) {
  const bal = (await window.dbGet?.(`users/${uid}/bakiye`)) || 0;
  const POVERTY_LINE = 5000;
  if (bal > POVERTY_LINE) return { eligible: false };
  const lastAid = (await window.dbGet?.(`users/${uid}/lastSocialAid`)) || 0;
  if (Date.now() - lastAid < 7 * 86400000) return { eligible: false, reason: 'Haftada bir yardım alınabilir' };
  const aidAmount = 1500;
  const govFund = (await window.dbGet?.('system/hazine')) || 0;
  if (govFund < aidAmount) return { eligible: false, reason: 'Devlet fonu yetersiz' };
  await window.dbTransaction?.(`users/${uid}/bakiye`, b => (b || 0) + aidAmount);
  await window.dbTransaction?.('system/hazine', h => Math.max(0, (h || 0) - aidAmount));
  await window.dbUpdate?.(`users/${uid}`, { lastSocialAid: Date.now() });
  window.toast?.(`🤝 Sosyal yardım alındı: ${window.cashFmt?.(aidAmount) || aidAmount + '₺'}`, 'success', 6000);
  return { eligible: true, amount: aidAmount };
};

/* M04 — Mahalle Etkinliği: Sokak Düğünü */
window.GZX_M04_streetWedding = async function (province, neighbourhood) {
  const noiseFine = 500;
  await window.dbPush?.(`politics/${province}/mahalle/${neighbourhood}/events`, {
    type: 'sokak_dugunu', fine: noiseFine, ts: Date.now()
  });
  window.toast?.(`🎊 Sokak düğünü başladı! Gürültü cezası riskine dikkat.`, 'info');
};

/* M05 — Mahalle Yardımlaşma Fonu */
window.GZX_M05_communityFund = async function (uid, amount, province, neighbourhood) {
  const r = await window.GZX_safePay?.(uid, amount, 'Mahalle yardımlaşma fonu');
  if (!r?.ok) return;
  await window.dbTransaction?.(`politics/${province}/mahalle/${neighbourhood}/fund`, f => (f || 0) + amount);
  window.toast?.(`💝 Mahalle fonuna ${window.cashFmt?.(amount) || amount + '₺'} bağış yapıldı`, 'success');
};

/* ══════════════════════════════════════════════════════════════════════════
   [B] BELEDİYE HİZMETLERİ & RUHSAT
   ══════════════════════════════════════════════════════════════════════════ */

/* MUN01 — İşyeri Açma Ruhsatı */
window.GZX_MUN01_getBusinessLicense = async function (uid, shopType, province) {
  const fees = { market: 25000, restaurant: 35000, fabrika: 100000, dukkan: 15000 };
  const fee  = fees[shopType] || 15000;
  const has  = await window.dbGet?.(`users/${uid}/isyeriRuhsati/${shopType}`);
  if (has) return window.toast?.('Bu tür için ruhsatınız zaten var', 'warn');
  const r = await window.GZX_safePay?.(uid, fee, `İşyeri Ruhsatı: ${shopType}`);
  if (!r?.ok) return;
  await window.dbUpdate?.(`users/${uid}/isyeriRuhsati`, { [shopType]: { province, issuedAt: Date.now(), fee } });
  await window.dbTransaction?.(`politics/${province}/belediyeBudgeti`, b => (b || 0) + fee);
  window.toast?.(`✅ ${shopType} ruhsatı alındı! (${window.cashFmt?.(fee) || fee + '₺'})`, 'success');
};

/* MUN02 — Çöp & Tabela Vergisi (Aylık) */
window.GZX_MUN02_collectMunicipalTax = async function (uid, shopRevenue) {
  const ctvRate    = (await window.dbGet?.('system/ctvRate')) || 0.02; // %2 çöp+tabela
  const tax        = Math.ceil(shopRevenue * ctvRate);
  const province   = (await window.dbGet?.(`users/${uid}/province`)) || 'İstanbul';
  const r = await window.GZX_safePay?.(uid, tax, 'Çöp & Tabela Vergisi');
  if (!r?.ok) return;
  await window.dbTransaction?.(`politics/${province}/belediyeBudgeti`, b => (b || 0) + tax);
  return tax;
};

/* MUN03 — İmar Affı (Admin onayı gerektirir) */
window.GZX_MUN03_imarAmnesty = async function (propertyId, uid) {
  const fee = 50000;
  const r   = await window.GZX_safePay?.(uid, fee, 'İmar Affı');
  if (!r?.ok) return;
  await window.dbPush?.('imarAmnesty/applications', { uid, propertyId, fee, status: 'pending', ts: Date.now() });
  window.toast?.('📋 İmar affı başvurusu yapıldı — Admin onayı bekleniyor', 'info', 6000);
};

/* MUN04 — Toplu Taşıma Zammı */
window.GZX_MUN04_updateTransitFare = async function (newFare, province) {
  if (!window.GZ?.data?.isFounder) return window.toast?.('Yetkisiz', 'error');
  await window.dbUpdate?.(`politics/${province}/transit`, { fare: newFare, updatedAt: Date.now() });
  await window.dbPush?.('news', { title: `🚌 ${province}: Toplu taşıma ${newFare}₺ oldu`, type: 'transit', ts: Date.now() });
  window.toast?.(`🚌 ${province} toplu taşıma ücreti: ${newFare}₺`, 'success');
};

/* ══════════════════════════════════════════════════════════════════════════
   [P] POLİS & ASAYİŞ
   ══════════════════════════════════════════════════════════════════════════ */

/* P01 — GBT Sorgulama Sistemi */
window.GZX_P01_GBTQuery = async function (targetUsername) {
  if (!['police', 'judge', 'prosecutor'].includes(window.GZ?.data?.role) && !window.GZ?.data?.isFounder)
    return window.toast?.('GBT sorgusu için yetkiniz yok', 'error');
  const targetUid = await window.dbGet?.(`usernames/${targetUsername.toLowerCase()}`);
  if (!targetUid) return window.toast?.('Kullanıcı bulunamadı', 'error');
  const d = await window.dbGet?.(`users/${targetUid}`) || {};
  return {
    uid: targetUid, username: d.username, level: d.level, bakiye: d.bakiye,
    krediSkoru: d.krediSkoru, criminalRecord: d.criminalRecord || 0,
    karaListede: d.karaListede || false, inJail: d.inJail || false,
    hasLicense: !!d.isyeriRuhsati, hasIDCard: !!d.kimlikKarti,
    province: d.province, party: d.party
  };
};

/* P02 — Para Cezası Kesme (Admin/Polis) */
window.GZX_P02_issueFine = async function (targetUid, amount, reason, officerUid) {
  if (!['police'].includes(window.GZ?.data?.role) && !window.GZ?.data?.isFounder)
    return window.toast?.('Para cezası için yetkiniz yok', 'error');
  const r = await window.GZX_safePay?.(targetUid, amount, `Para cezası: ${reason}`);
  if (!r?.ok) {
    // Bakiye yetersizse borç ekle
    await window.dbTransaction?.(`users/${targetUid}/borglar`, b => (b || 0) + amount);
  }
  await window.dbPush?.(`users/${targetUid}/cezalar`, {
    amount, reason, officer: officerUid || window.GZ.uid, ts: Date.now()
  });
  await window.dbTransaction?.('system/hazine', h => (h || 0) + amount);
  window.toast?.(`🚔 Ceza kesildi: ${window.cashFmt?.(amount) || amount + '₺'} — ${reason}`, 'success');
};

/* P03 — Hapis Sistemi */
window.GZX_P03_sendToJail = async function (uid, durationHours, reason) {
  const jailUntil = Date.now() + durationHours * 3600000;
  await window.dbUpdate?.(`users/${uid}`, {
    inJail: true, jailUntil, jailReason: reason || 'Mahkeme kararı',
    canTrade: false, jailedAt: Date.now()
  });
  await window.dbPush?.(`users/${uid}/cezalar`, { type: 'hapis', hours: durationHours, reason, ts: Date.now() });
  window.toast?.(`🔒 Kullanıcı ${durationHours} saat hapsedildi: ${reason}`, 'success', 6000);
};

/* P03b — Hapisten Çıkış Kontrolü */
window.GZX_P03_checkJailRelease = async function (uid) {
  const d = await window.dbGet?.(`users/${uid}`) || {};
  if (!d.inJail) return false;
  if (Date.now() >= (d.jailUntil || 0)) {
    await window.dbUpdate?.(`users/${uid}`, { inJail: false, jailUntil: null, canTrade: true, releasedAt: Date.now() });
    window.toast?.('🔓 Cezanız tamamlandı, serbest bırakıldınız!', 'success', 6000);
    return false;
  }
  return true;
};

/* P04 — Sabıka Kaydı Görüntüleme */
window.GZX_P04_getCriminalRecord = async function (uid) {
  const cezalar = await window.dbGet?.(`users/${uid}/cezalar`) || {};
  const crimCount = (await window.dbGet?.(`users/${uid}/criminalRecord`)) || 0;
  return { total: crimCount, cezalar: Object.values(cezalar).sort((a, b) => b.ts - a.ts) };
};

/* P05 — Rüşvet Mekanizması (Sicil Temizleme) */
window.GZX_P05_bribery = async function (uid, officerUid, amount) {
  const r = await window.GZX_safePay?.(uid, amount, 'Rüşvet');
  if (!r?.ok) return;
  await window.dbTransaction?.(`users/${officerUid}/bakiye`, b => (b || 0) + amount * 0.7);
  // %30 yakalanma ihtimali
  if (Math.random() < 0.30) {
    await window.GZX_P02_issueFine(uid, amount * 3, 'Rüşvet verme suçu', 'system');
    await window.dbTransaction?.(`users/${uid}/criminalRecord`, r2 => (r2 || 0) + 1);
    window.toast?.('🚔 YAKALANDINIZ! Rüşvet yerine ceza yediniz!', 'error', 8000);
  } else {
    await window.dbTransaction?.(`users/${uid}/criminalRecord`, r2 => Math.max(0, (r2 || 0) - 1));
    window.toast?.('🤫 Rüşvet teslim edildi, sicil temizlendi.', 'success', 6000);
  }
};

/* ══════════════════════════════════════════════════════════════════════════
   [G] SGK & SOSYAL GÜVENLİK
   ══════════════════════════════════════════════════════════════════════════ */

/* G01 — SGK Primi */
window.GZX_G01_calcSGK = async function (salary) {
  const rate = (await window.dbGet?.('system/sgkRate')) || 0.145;
  return Math.ceil(salary * rate);
};

/* G02 — İşsizlik Maaşı */
window.GZX_G02_applyUnemployment = async function (uid) {
  const d = await window.dbGet?.(`users/${uid}`) || {};
  if (d.hasShop || d.hasFarm || d.hasFactory)
    return window.toast?.('Aktif işletmesi olanlar işsizlik maaşı alamaz', 'warn');
  const lastClaim = d.lastUnemploymentClaim || 0;
  if (Date.now() - lastClaim < 7 * 86400000)
    return window.toast?.('İşsizlik maaşı haftada bir alınabilir', 'warn');
  const minWage = (await window.dbGet?.('system/minWage')) || 17002;
  const benefit = Math.floor(minWage * 0.40);
  const govFund = (await window.dbGet?.('system/hazine')) || 0;
  if (govFund < benefit) return window.toast?.('Devlet işsizlik fonu yetersiz', 'error');
  await window.dbTransaction?.(`users/${uid}/bakiye`, b => (b || 0) + benefit);
  await window.dbTransaction?.('system/hazine', h => Math.max(0, (h || 0) - benefit));
  await window.dbUpdate?.(`users/${uid}`, { lastUnemploymentClaim: Date.now() });
  window.toast?.(`💰 İşsizlik maaşı: ${window.cashFmt?.(benefit) || benefit + '₺'}`, 'success');
};

/* G03 — Emeklilik */
window.GZX_G03_checkRetirement = async function (uid) {
  const d = await window.dbGet?.(`users/${uid}`) || {};
  const level = d.level || 1;
  const RETIRE_LEVEL = 50;
  if (level < RETIRE_LEVEL) return { eligible: false, needed: RETIRE_LEVEL - level };
  if (d.retired) return { eligible: true, alreadyRetired: true, pension: d.pension };
  const minWage = (await window.dbGet?.('system/minWage')) || 17002;
  const pension = Math.floor(minWage * 0.60);
  await window.dbUpdate?.(`users/${uid}`, { retired: true, pension, retiredAt: Date.now() });
  window.toast?.(`🎉 Emekli oldunuz! Aylık maaş: ${window.cashFmt?.(pension) || pension + '₺'}`, 'success', 10000);
  return { eligible: true, pension };
};

/* G04 — Emekli Maaşı Öde (Periyodik) */
window.GZX_G04_payPensions = async function () {
  const users = await window.dbGet?.('users') || {};
  const retired = Object.entries(users).filter(([, u]) => u.retired && u.pension);
  let total = 0;
  for (const [uid, u] of retired) {
    const hazine = (await window.dbGet?.('system/hazine')) || 0;
    if (hazine < u.pension) break;
    await window.dbTransaction?.(`users/${uid}/bakiye`, b => (b || 0) + u.pension);
    await window.dbTransaction?.('system/hazine', h => Math.max(0, (h || 0) - u.pension));
    total += u.pension;
  }
  return { paidTo: retired.length, total };
};

/* G05 — Sağlık Sigortası */
window.GZX_G05_healthInsurance = async function (uid) {
  const sgkRate = (await window.dbGet?.('system/sgkRate')) || 0.145;
  const sal = (await window.dbGet?.(`users/${uid}/aylikGelir`)) || 17002;
  const premium = Math.ceil(sal * sgkRate * 0.5);
  const r = await window.GZX_safePay?.(uid, premium, 'Sağlık Sigortası Primi');
  if (!r?.ok) return;
  await window.dbUpdate?.(`users/${uid}`, { hasSaglikSig: true, saglikSigAt: Date.now(), saglikSigPremium: premium });
  window.toast?.(`🏥 Sağlık sigortası aktif. Prim: ${window.cashFmt?.(premium) || premium + '₺'}/ay`, 'success');
};

/* G06 — Kaza/Hastane Masrafı */
window.GZX_G06_hospitalBill = async function (uid, billAmount) {
  const hasSig = await window.dbGet?.(`users/${uid}/hasSaglikSig`);
  if (hasSig) {
    const covered = billAmount * 0.80;
    const own     = billAmount - covered;
    await window.GZX_safePay?.(uid, own, 'Hastane katılım payı');
    window.toast?.(`🏥 Sigortanız ${window.cashFmt?.(covered) || covered + '₺'} ödedi. Kalan: ${window.cashFmt?.(own) || own + '₺'}`, 'info');
  } else {
    await window.GZX_safePay?.(uid, billAmount, 'Hastane faturası (sigortasız)');
    window.toast?.(`🏥 Hastane faturası: ${window.cashFmt?.(billAmount) || billAmount + '₺'} (Sağlık sigortası olsaydı %80 karşılanırdı!)`, 'warn', 8000);
  }
};

/* ══════════════════════════════════════════════════════════════════════════
   [K] KARA BORSA & KAÇAKÇILIK
   ══════════════════════════════════════════════════════════════════════════ */

/* K01 — Vergi Kaçırma (Riskli) */
window.GZX_K01_evadeTax = async function (uid, income, declaredIncome) {
  const evadedAmount = income - declaredIncome;
  if (evadedAmount <= 0) return { evaded: false };
  const catchProb = Math.min(0.80, evadedAmount / income * 0.90);
  if (Math.random() < catchProb) {
    const penalty = evadedAmount * 3;
    await window.GZX_P02_issueFine(uid, penalty, 'Vergi kaçakçılığı', 'system');
    await window.dbTransaction?.(`users/${uid}/criminalRecord`, r => (r || 0) + 2);
    window.toast?.(`🚔 VERGİ KAÇAKÇILIĞI yakalandınız! Ceza: ${window.cashFmt?.(penalty) || penalty + '₺'}`, 'error', 10000);
    return { caught: true, penalty };
  }
  const savedTax = window.GZX_calcTax?.(income) - window.GZX_calcTax?.(declaredIncome) || evadedAmount * 0.20;
  window.toast?.(`🤫 Vergi kaçırıldı. Tasarruf: ${window.cashFmt?.(savedTax) || savedTax + '₺'} — Dikkatli olun!`, 'warn', 8000);
  return { evaded: true, saved: savedTax, riskLevel: `%${Math.round(catchProb * 100)}` };
};

/* K02 — Kaçak Ürün Satışı */
window.GZX_K02_smuggleGoods = async function (uid, product, quantity, price) {
  const catchProb = 0.25; // %25 yakalanma
  if (Math.random() < catchProb) {
    const fine = quantity * price * 2;
    await window.GZX_P02_issueFine(uid, fine, 'Kaçak ürün kaçakçılığı', 'system');
    await window.dbTransaction?.(`users/${uid}/criminalRecord`, r => (r || 0) + 1);
    window.toast?.(`🚔 KAÇAK ÜRÜN yakalandınız! Ceza: ${window.cashFmt?.(fine) || fine + '₺'}`, 'error', 10000);
    return { caught: true };
  }
  const premium = 1.4; // Kara borsada %40 fazla fiyat
  const revenue  = quantity * price * premium;
  await window.dbTransaction?.(`users/${uid}/bakiye`, b => (b || 0) + revenue);
  window.toast?.(`🕶️ Kaçak ürün satıldı: ${window.cashFmt?.(revenue) || revenue + '₺'} (kara borsa fiyatı)`, 'success', 6000);
  return { sold: true, revenue };
};

/* K03 — Kara Borsa Listesi */
window.GZX_K03_getBlackMarketItems = async function () {
  const items = await window.dbGet?.('karaMarket') || {};
  return Object.values(items).filter(i => i.active);
};

/* K04 — Kara Markete Ürün Koy */
window.GZX_K04_listOnBlackMarket = async function (uid, product, quantity, price) {
  const ref = await window.dbPush?.('karaMarket', {
    seller: uid, product, quantity, price, listedAt: Date.now(), active: true
  });
  window.toast?.(`🕶️ Ürün kara borsaya eklendi (${quantity}x ${product})`, 'info');
  return ref?.key;
};

/* K05 — Offshore Para Kaçırma */
window.GZX_K05_offshoreTransfer = async function (uid, amount) {
  const catchProb = 0.15;
  const r = await window.GZX_safePay?.(uid, amount, 'Offshore transfer');
  if (!r?.ok) return;
  if (Math.random() < catchProb) {
    const fine = amount * 2;
    await window.GZX_P02_issueFine(uid, fine, 'Offshore para kaçakçılığı', 'system');
    window.toast?.(`🚔 OFFSHOREde yakalandınız! Ceza: ${window.cashFmt?.(fine) || fine + '₺'}`, 'error', 10000);
    return { caught: true };
  }
  await window.dbTransaction?.(`users/${uid}/offshoreBalance`, b => (b || 0) + amount);
  window.toast?.(`🏦 ${window.cashFmt?.(amount) || amount + '₺'} offshore hesaba aktarıldı`, 'success');
};

/* ══════════════════════════════════════════════════════════════════════════
   [S] SEÇİM & PARTİ SİSTEMİ
   ══════════════════════════════════════════════════════════════════════════ */

/* S01 — Parti Kurma */
window.GZX_S01_createParty = async function (uid, name, ideology, logo) {
  if (!window.GZX_M02_checkTradeEligibility) return;
  const PARTY_COST = 100000;
  const r = await window.GZX_safePay?.(uid, PARTY_COST, `Parti kuruluş: ${name}`);
  if (!r?.ok) return;
  const key = name.toLowerCase().replace(/\s+/g, '_');
  const existing = await window.dbGet?.(`parties/${key}`);
  if (existing) return window.toast?.('Bu isimde parti mevcut', 'error');
  await window.dbSet?.(`parties/${key}`, {
    name, ideology, logo: logo || '🏛️', leader: uid,
    members: { [uid]: 'genel_baskan' }, treasury: 0, votes: 0, createdAt: Date.now()
  });
  await window.dbUpdate?.(`users/${uid}`, { party: name, partyRole: 'genel_baskan' });
  window.toast?.(`🏛️ ${name} partisi kuruldu!`, 'success', 8000);
  return key;
};

/* S02 — Seçim Başlatma (Admin) */
window.GZX_S02_startElection = async function (type, province, durationHours) {
  if (!window.GZ?.data?.isFounder) return window.toast?.('Yetkisiz', 'error');
  const elecId = `${type}_${province || 'genel'}_${Date.now()}`;
  await window.dbSet?.(`elections/${elecId}`, {
    type, province: province || 'genel', startedAt: Date.now(),
    endsAt: Date.now() + durationHours * 3600000,
    status: 'active', votes: {}
  });
  await window.dbPush?.('news', { title: `🗳️ ${type.toUpperCase()} SEÇİMİ BAŞLADI${province ? ' — ' + province : ''}!`, type: 'election', ts: Date.now() });
  window.toast?.(`🗳️ ${type} seçimi başlatıldı (${durationHours} saat)`, 'success');
  return elecId;
};

/* S03 — Oy Kullanma */
window.GZX_S03_castVote = async function (uid, electionId, candidateUid) {
  const elec = await window.dbGet?.(`elections/${electionId}`);
  if (!elec || elec.status !== 'active') return window.toast?.('Aktif seçim yok', 'error');
  if (elec.votes?.[uid]) return window.toast?.('Zaten oy kullandınız', 'warn');
  if (Date.now() > elec.endsAt) return window.toast?.('Seçim sona erdi', 'error');
  await window.dbUpdate?.(`elections/${electionId}/votes`, { [uid]: candidateUid });
  await window.dbTransaction?.(`elections/${electionId}/tally/${candidateUid}`, v => (v || 0) + 1);
  window.toast?.('✅ Oyunuz kullanıldı!', 'success');
};

/* S04 — Seçim Sonuçlandırma */
window.GZX_S04_finalizeElection = async function (electionId) {
  if (!window.GZ?.data?.isFounder) return window.toast?.('Yetkisiz', 'error');
  const elec = await window.dbGet?.(`elections/${electionId}`);
  if (!elec) return;
  const tally = elec.tally || {};
  const winner = Object.entries(tally).sort(([, a], [, b]) => b - a)[0];
  if (!winner) return window.toast?.('Hiç oy yok', 'warn');
  const [winnerUid, votes] = winner;
  await window.dbUpdate?.(`elections/${electionId}`, { status: 'completed', winner: winnerUid, winnerVotes: votes });
  if (elec.type === 'belediye') {
    await window.dbUpdate?.(`politics/${elec.province}`, { mayor: winnerUid, mayorElectedAt: Date.now() });
    await window.dbUpdate?.(`users/${winnerUid}`, { mayorOf: elec.province });
  } else if (elec.type === 'cumhurbaskani') {
    await window.dbSet?.('system/president', winnerUid);
    await window.dbUpdate?.(`users/${winnerUid}`, { isPresident: true });
  }
  await window.dbPush?.('news', { title: `🏆 ${elec.type} seçimi sonuçlandı! Kazanan: UID=${winnerUid.slice(0, 8)}`, type: 'election_result', ts: Date.now() });
  window.toast?.('🏆 Seçim sonuçlandırıldı!', 'success');
};

/* S05 — Vergi Oranı Oylaması (Seçilen Yetkili) */
window.GZX_S05_setTaxByElected = async function (uid, kdvRate, gelirVergisiRate) {
  const isPresident = (await window.dbGet?.('system/president')) === uid;
  const isMayor     = !!(await window.dbGet?.(`users/${uid}/mayorOf`));
  if (!isPresident && !isMayor && !window.GZ?.data?.isFounder)
    return window.toast?.('Yalnızca seçilmiş yetkililer vergi oranı değiştirebilir', 'error');
  if (kdvRate < 0.01 || kdvRate > 0.40) return window.toast?.('KDV %1-%40 arasında olabilir', 'error');
  await window.dbSet?.('system/kdv', kdvRate);
  await window.dbPush?.('news', { title: `🏛️ Vergi güncellendi: KDV %${(kdvRate * 100).toFixed(0)}, Gelir Vergisi %${(gelirVergisiRate * 100).toFixed(0)}`, type: 'tax', ts: Date.now() });
  window.toast?.('✅ Vergi oranları güncellendi', 'success');
};

/* ══════════════════════════════════════════════════════════════════════════
   [I] İHALE & KAMU KAYNAK YÖNETİMİ
   ══════════════════════════════════════════════════════════════════════════ */

/* I01 — Kamu İhalesi Açma (Admin) */
window.GZX_I01_openTender = async function (title, budget, description, durationHours) {
  if (!window.GZ?.data?.isFounder) return window.toast?.('Yetkisiz', 'error');
  const ref = await window.dbPush?.('tenders', {
    title, budget, description, status: 'open',
    openedAt: Date.now(), endsAt: Date.now() + durationHours * 3600000,
    bids: {}
  });
  await window.dbPush?.('news', { title: `📋 Yeni İhale: ${title} (Bütçe: ${window.cashFmt?.(budget) || budget + '₺'})`, type: 'tender', ts: Date.now() });
  window.toast?.(`📋 İhale açıldı: ${title}`, 'success');
  return ref?.key;
};

/* I02 — İhaleye Teklif Ver */
window.GZX_I02_submitBid = async function (uid, tenderId, amount, completionScore) {
  const tender = await window.dbGet?.(`tenders/${tenderId}`);
  if (!tender || tender.status !== 'open') return window.toast?.('İhale aktif değil', 'error');
  if (Date.now() > tender.endsAt) return window.toast?.('İhale süresi doldu', 'error');
  if (amount > tender.budget) return window.toast?.('Teklifiniz bütçeyi aşıyor', 'error');
  const prevBid = tender.bids?.[uid];
  if (prevBid && prevBid.amount <= amount) return window.toast?.('Yeni teklifiniz öncekinden düşük olmalı', 'warn');
  await window.dbUpdate?.(`tenders/${tenderId}/bids`, {
    [uid]: { amount, completionScore: completionScore || 50, submittedAt: Date.now() }
  });
  window.toast?.(`📋 Teklifiniz iletildi: ${window.cashFmt?.(amount) || amount + '₺'}`, 'success');
};

/* I03 — İhale Kazanma Algoritması */
window.GZX_I03_awardTender = async function (tenderId) {
  if (!window.GZ?.data?.isFounder) return window.toast?.('Yetkisiz', 'error');
  const tender = await window.dbGet?.(`tenders/${tenderId}`);
  if (!tender) return;
  const bids = Object.entries(tender.bids || {});
  if (!bids.length) return window.toast?.('Teklif yok', 'warn');
  // Skor = (1 - fiyat/bütçe) * 0.6 + (completionScore/100) * 0.4
  const scored = bids.map(([uid, b]) => ({
    uid,
    score: (1 - b.amount / tender.budget) * 0.6 + (b.completionScore / 100) * 0.4,
    bid: b
  })).sort((a, b) => b.score - a.score);
  const winner = scored[0];
  await window.dbUpdate?.(`tenders/${tenderId}`, { status: 'awarded', winner: winner.uid, winnerBid: winner.bid.amount, awardedAt: Date.now() });
  await window.dbTransaction?.(`users/${winner.uid}/bakiye`, b => (b || 0) + winner.bid.amount);
  await window.dbTransaction?.('system/hazine', h => Math.max(0, (h || 0) - winner.bid.amount));
  await window.dbUpdate?.(`users/${winner.uid}`, { completedTenders: firebase.database.ServerValue.increment(1) });
  await window.dbPush?.('news', { title: `🏆 İhale Sonucu: "${tender.title}" — Kazanan: ${winner.uid.slice(0, 8)}`, type: 'tender_result', ts: Date.now() });
  window.toast?.(`🏆 İhale ${winner.uid.slice(0, 8)} adlı kullanıcıya verildi`, 'success');
};


/* ══════════════════════════════════════════════════════════════════════════
   [U] KİMLİK KARTI & BANKA KARTI UI (Görsel Render Fonksiyonları)
   ══════════════════════════════════════════════════════════════════════════ */

/* U01 — Fiziksel Kimlik Kartı Render */
window.GZX_U01_renderIDCard = function (userData) {
  const d = userData || window.GZ?.data || {};
  const card = d.kimlikKarti || {};
  const level = d.level || 1;
  const rank  = window.GZX_getRank?.(level) || '🥬 Çırak';
  const tcNo  = card.tc || 'GZ-????????';
  const bgGrad = 'linear-gradient(135deg, #0b1931 0%, #1a3a6b 50%, #0f2451 100%)';
  return `
    <div class="gz-id-card" style="
      background:${bgGrad}; border:1px solid #3b82f644; border-radius:16px;
      padding:20px; max-width:340px; position:relative; overflow:hidden;
      box-shadow:0 20px 60px rgba(0,0,0,.7); font-family:'Inter',sans-serif;
      color:white; cursor:default;">
      <!-- Hologram efekti -->
      <div style="position:absolute;top:-30px;right:-30px;width:120px;height:120px;
        background:radial-gradient(circle,#3b82f622,transparent);border-radius:50%;"></div>
      <!-- Header -->
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px">
        <div>
          <div style="font-size:8px;letter-spacing:3px;color:#60a5fa;font-weight:800">TÜRKİYE</div>
          <div style="font-size:10px;letter-spacing:2px;color:#93c5fd;font-weight:600">KİMLİK BELGESİ</div>
          <div style="font-size:7px;color:#60a5fa88;letter-spacing:1px">GameZone ERP</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:22px">🇹🇷</div>
          <div style="font-size:8px;color:#60a5fa;font-weight:700">ONAYLANMIŞ</div>
        </div>
      </div>
      <!-- Fotoğraf + Bilgi -->
      <div style="display:flex;gap:16px;align-items:center;margin-bottom:16px">
        <div style="width:64px;height:80px;background:linear-gradient(135deg,#1e3a5f,#2d5a8e);
          border:2px solid #3b82f644;border-radius:8px;display:flex;align-items:center;
          justify-content:center;font-size:28px;flex-shrink:0">
          ${d.avatar || '👤'}
        </div>
        <div>
          <div style="font-size:7px;color:#64748b;letter-spacing:1px;margin-bottom:2px">AD SOYAD</div>
          <div style="font-size:14px;font-weight:800;letter-spacing:1px;margin-bottom:6px">${(d.username || 'OYUNCU').toUpperCase()}</div>
          <div style="font-size:7px;color:#64748b;letter-spacing:1px;margin-bottom:2px">RÜTBE</div>
          <div style="font-size:11px;color:#60a5fa;font-weight:700">${rank} · Lv.${level}</div>
        </div>
      </div>
      <!-- TC No -->
      <div style="background:rgba(59,130,246,.08);border:1px solid #3b82f622;border-radius:8px;
        padding:10px 12px;margin-bottom:12px">
        <div style="font-size:7px;color:#64748b;letter-spacing:2px;margin-bottom:4px">KİMLİK NUMARASI</div>
        <div style="font-size:15px;font-weight:900;letter-spacing:3px;color:#93c5fd">${tcNo}</div>
      </div>
      <!-- Alt bilgiler -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">
        <div>
          <div style="font-size:7px;color:#64748b;letter-spacing:1px">İL</div>
          <div style="font-size:11px;font-weight:700">${d.province || 'İstanbul'}</div>
        </div>
        <div>
          <div style="font-size:7px;color:#64748b;letter-spacing:1px">VERİLİŞ</div>
          <div style="font-size:11px;font-weight:700">${card.verilis ? new Date(card.verilis).toLocaleDateString('tr-TR') : '-'}</div>
        </div>
      </div>
      <!-- Muhtar Mühür -->
      <div style="display:flex;align-items:center;gap:8px;border-top:1px solid #1e3a5f;padding-top:10px">
        <div style="font-size:10px;color:#22c55e;font-weight:700">✅ MUHTAR ONAYLI</div>
        <div style="flex:1;height:1px;background:#1e3a5f"></div>
        <div style="font-size:9px;color:#334155">Seri: ${card.seriNo || '-'}</div>
      </div>
    </div>`;
};

/* U02 — Banka Kartı Render (Tier'e Göre) */
window.GZX_U02_renderBankCard = function (userData, cardType) {
  const u    = userData || window.GZ?.data || {};
  const bal  = u.bakiye || 0;
  const type = cardType || (bal > 10000000 ? 'black' : bal > 1000000 ? 'platinum' : bal > 100000 ? 'gold' : 'standard');
  const configs = {
    black:    { bg:'linear-gradient(135deg,#1a1a2e,#16213e,#0f3460)', accent:'#a21caf', name:'💎 BLACK CARD', shadow:'rgba(162,28,175,.4)' },
    platinum: { bg:'linear-gradient(135deg,#1a1a3e,#252550,#1e1e4a)', accent:'#818cf8', name:'⚡ PLATİNUM',  shadow:'rgba(129,140,248,.4)' },
    gold:     { bg:'linear-gradient(135deg,#1a1000,#2a1a00,#3a2200)', accent:'#eab308', name:'👑 GOLD CARD', shadow:'rgba(234,179,8,.4)' },
    standard: { bg:'linear-gradient(135deg,#0b1931,#1a3a6b,#0f2451)', accent:'#3b82f6', name:'💳 STANDARD',  shadow:'rgba(59,130,246,.3)' }
  };
  const cfg = configs[type] || configs.standard;
  const cardNum = (u.kimlikKarti?.tc || '0000000000').replace(/(.{4})/g, '$1 ').trim().split(' ').map((g, i) => i < 3 ? '****' : g).join(' ');
  return `
    <div class="gz-bank-card" style="
      background:${cfg.bg}; border:1px solid ${cfg.accent}33; border-radius:18px;
      padding:22px; max-width:340px; position:relative; overflow:hidden;
      box-shadow:0 20px 60px ${cfg.shadow}; font-family:'Inter',sans-serif; color:white;">
      <!-- Holographic chip -->
      <div style="position:absolute;top:20px;right:20px;width:50px;height:40px;
        background:linear-gradient(135deg,${cfg.accent}44,${cfg.accent}88);
        border-radius:6px;border:1px solid ${cfg.accent}66;"></div>
      <!-- Kart adı -->
      <div style="font-size:13px;font-weight:900;letter-spacing:2px;color:${cfg.accent};margin-bottom:20px">${cfg.name}</div>
      <!-- Kart numarası -->
      <div style="font-size:15px;font-weight:700;letter-spacing:4px;margin-bottom:20px;font-family:monospace">${cardNum}</div>
      <!-- Alt -->
      <div style="display:flex;justify-content:space-between;align-items:flex-end">
        <div>
          <div style="font-size:7px;color:#64748b;letter-spacing:1px;margin-bottom:2px">KART SAHİBİ</div>
          <div style="font-size:13px;font-weight:700">${(u.username||'OYUNCU').toUpperCase()}</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:7px;color:#64748b;letter-spacing:1px;margin-bottom:2px">BAKİYE</div>
          <div style="font-size:14px;font-weight:900;color:${cfg.accent}">${window.cashFmt?.(bal)||bal+'₺'}</div>
        </div>
      </div>
      <!-- Logo -->
      <div style="position:absolute;bottom:22px;right:22px;font-size:24px;opacity:.3">🏦</div>
    </div>`;
};

/* U03 — Dijital Cüzdan (Multi-Currency) */
window.GZX_U03_renderWallet = async function (uid) {
  const d    = await window.dbGet?.(`users/${uid}`) || {};
  const gold = d.altinHesap || 0;
  const goldPrice = (await window.dbGet?.('system/goldPrice')) || 2400;
  const usdRate   = (await window.dbGet?.('system/forexRates/USD')) || 32.5;
  const crypto    = d.crypto || {};
  const cryptoPrices = {};
  for (const sym of Object.keys(GZX_KRIPTO)) {
    cryptoPrices[sym] = (await window.dbGet?.(`crypto/price/${sym}`)) || GZX_KRIPTO[sym].basePrice;
  }
  const btcVal = (crypto.BTC || 0) * cryptoPrices.BTC;
  const ethVal = (crypto.ETH || 0) * cryptoPrices.ETH;

  return `
    <div style="background:#0b1931;border:1px solid #1e3a5f;border-radius:16px;padding:20px;max-width:380px">
      <div style="font-size:14px;font-weight:800;color:#60a5fa;margin-bottom:16px">💰 Dijital Cüzdan</div>

      <!-- TL Bakiye -->
      <div style="background:linear-gradient(135deg,#1e3a5f,#0f2451);border-radius:12px;padding:16px;margin-bottom:10px">
        <div style="font-size:9px;color:#64748b;letter-spacing:2px;margin-bottom:4px">TÜRK LİRASI</div>
        <div style="font-size:24px;font-weight:900;color:#e2e8f0">₺ ${window.cashFmt?.(d.bakiye)||d.bakiye||'0'}</div>
        ${window.GZX_renderEnergyBar?.(d.energy??100, 100)||''}
      </div>

      <!-- Altın Hesabı -->
      <div style="background:rgba(234,179,8,.06);border:1px solid rgba(234,179,8,.2);border-radius:10px;padding:12px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center">
        <div><div style="font-size:9px;color:#64748b;margin-bottom:2px">🥇 ALTIN HESABI</div><div style="font-size:14px;font-weight:700;color:#eab308">${gold.toFixed(2)}g</div></div>
        <div style="text-align:right"><div style="font-size:9px;color:#64748b;margin-bottom:2px">DEĞER</div><div style="font-size:12px;color:#eab308">${window.cashFmt?.(gold*goldPrice)||'0'}₺</div></div>
      </div>

      <!-- USD -->
      <div style="background:rgba(34,197,94,.06);border:1px solid rgba(34,197,94,.2);border-radius:10px;padding:12px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center">
        <div><div style="font-size:9px;color:#64748b;margin-bottom:2px">💵 DOLAR ($)</div><div style="font-size:14px;font-weight:700;color:#22c55e">$${((d.bakiye||0)/usdRate).toFixed(2)}</div></div>
        <div style="text-align:right"><div style="font-size:9px;color:#64748b;margin-bottom:2px">KUR</div><div style="font-size:12px;color:#22c55e">${usdRate}₺/USD</div></div>
      </div>

      <!-- Kripto -->
      ${Object.entries(crypto).filter(([,v])=>v>0).slice(0,3).map(([sym,amt])=>`
        <div style="background:rgba(168,85,247,.06);border:1px solid rgba(168,85,247,.2);border-radius:10px;padding:10px;margin-bottom:6px;display:flex;justify-content:space-between">
          <div><div style="font-size:9px;color:#64748b;margin-bottom:2px">${GZX_KRIPTO[sym]?.name||sym}</div><div style="font-size:13px;font-weight:700;color:#a855f7">${amt} ${sym}</div></div>
          <div style="text-align:right"><div style="font-size:9px;color:#64748b;margin-bottom:2px">DEĞER</div><div style="font-size:12px;color:#a855f7">${window.cashFmt?.(amt*cryptoPrices[sym])||'0'}₺</div></div>
        </div>`).join('')}

      <!-- Rank Badge -->
      <div style="margin-top:12px;display:flex;justify-content:center">
        ${window.GZX_renderRankBadge?.(d.level||1)||''}
      </div>
    </div>`;
};

/* ══════════════════════════════════════════════════════════════════════════
   [R] REKLAM & BİLLBOARD SİSTEMİ
   ══════════════════════════════════════════════════════════════════════════ */

/* R01 — Billboard Satın Al */
window.GZX_R01_buyBillboard = async function (uid, location, durationDays) {
  const fees = { main_square: 5000, market_st: 2000, port_area: 3500, highway: 8000 };
  const fee  = (fees[location] || 2000) * durationDays;
  const r    = await window.GZX_safePay?.(uid, fee, `Billboard: ${location}`);
  if (!r?.ok) return;
  const ref = await window.dbPush?.('billboards', {
    owner: uid, location, durationDays, fee, active: true,
    startedAt: Date.now(), expiresAt: Date.now() + durationDays * 86400000,
    content: '', impressions: 0
  });
  window.toast?.(`📺 Billboard kiralandı! (${window.cashFmt?.(fee) || fee + '₺'})`, 'success');
  return ref?.key;
};

/* R02 — Billboard İçeriği Güncelle */
window.GZX_R02_updateBillboard = async function (uid, billboardId, content) {
  const bb = await window.dbGet?.(`billboards/${billboardId}`);
  if (!bb || bb.owner !== uid) return window.toast?.('Bu billboard size ait değil', 'error');
  const clean = window.GZX_sanitize?.(content) || content.slice(0, 200);
  await window.dbUpdate?.(`billboards/${billboardId}`, { content: clean, updatedAt: Date.now() });
  window.toast?.('📺 Billboard içeriği güncellendi', 'success');
};

/* R03 — Admin Global Duyuru (Flash Haber) */
window.GZX_R03_globalBroadcast = async function (message, duration) {
  if (!window.GZ?.data?.isFounder) return window.toast?.('Yetkisiz', 'error');
  const clean = window.GZX_sanitize?.(message) || message.slice(0, 300);
  await window.dbSet?.('system/globalBroadcast', {
    message: clean, ts: Date.now(), expiresAt: Date.now() + (duration || 30000)
  });
  const gbEl = document.getElementById('globalBroadcast');
  const gbText = document.getElementById('gbText');
  if (gbEl && gbText) {
    gbText.textContent = clean;
    gbEl.style.display = 'flex';
    setTimeout(() => { gbEl.style.display = 'none'; }, duration || 30000);
  }
  window.toast?.('📢 Global duyuru gönderildi', 'success');
};

/* R04 — Hava Durumu Etkisi */
window.GZX_R04_updateWeather = async function (weatherType) {
  const effects = {
    güneşli:  { salesBonus: 0.10, shippingPenalty: 0,    label: '☀️ Güneşli' },
    yağmurlu: { salesBonus: -0.05, shippingPenalty: 0.20, label: '🌧️ Yağmurlu' },
    karlı:    { salesBonus: -0.15, shippingPenalty: 0.40, label: '❄️ Karlı' },
    fırtınalı:{ salesBonus: -0.20, shippingPenalty: 0.60, label: '⛈️ Fırtınalı' },
    bulutlu:  { salesBonus: 0,    shippingPenalty: 0.05, label: '⛅ Bulutlu' }
  };
  const eff = effects[weatherType] || effects.güneşli;
  await window.dbSet?.('system/weather', { type: weatherType, ...eff, ts: Date.now() });
  const wbEl  = document.getElementById('weatherBar');
  const wbW   = document.getElementById('wbWeather');
  const wbEff = document.getElementById('wbEffect');
  if (wbEl) {
    wbEl.style.display = 'flex';
    if (wbW) wbW.textContent = eff.label;
    if (wbEff) wbEff.textContent = eff.shippingPenalty > 0 ? `🚢 Nakliye +%${(eff.shippingPenalty * 100).toFixed(0)}` : '';
  }
};

/* R05 — Şehir İlanı (Muhtarlık Kanalıyla) */
window.GZX_R05_cityAnnouncement = async function (uid, message, province) {
  const fee = 250;
  const r   = await window.GZX_safePay?.(uid, fee, 'Şehir ilanı');
  if (!r?.ok) return;
  const clean = window.GZX_sanitize?.(message) || message.slice(0, 200);
  await window.dbPush?.(`politics/${province}/announcements`, {
    from: uid, username: window.GZ?.data?.username, message: clean,
    fee, ts: Date.now()
  });
  window.toast?.('📢 Şehir ilanı yayınlandı!', 'success');
};

/* ══════════════════════════════════════════════════════════════════════════
   ADMİN PANELİ — YENİ SEKME EKLENTİLERİ
   ══════════════════════════════════════════════════════════════════════════ */

/* Admin Panel navTo için yeni sekme renderer */
window.GZX_renderAdminSection = async function (section, container) {
  if (!container) return;
  const _f  = window.cashFmt || (n => n + '₺');
  const _ts = ts => new Date(ts).toLocaleString('tr-TR');

  switch (section) {

    case 'muhtarlik':
      container.innerHTML = `
        <div style="padding:20px">
          <h2 style="color:#60a5fa;margin:0 0 20px;font-size:18px">🏛️ Muhtarlık & Yerel Yönetim</h2>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px">

            <div style="background:#0d1829;border:1px solid #1e3a5f;border-radius:12px;padding:16px">
              <h3 style="color:#e2e8f0;font-size:14px;margin:0 0 12px">🪪 Kimlik Kart Ücreti Ayarla</h3>
              <input id="adm_idFee" type="number" placeholder="500" style="width:100%;padding:10px;background:#080d1a;border:1px solid #1e3a5f;border-radius:8px;color:#e2e8f0;font-size:13px;box-sizing:border-box;margin-bottom:8px">
              <button onclick="window.dbSet('system/idCardFee',parseInt(document.getElementById('adm_idFee').value)).then(()=>window.toast?.('✅ Kayıt ücreti güncellendi','success'))"
                style="width:100%;background:#3b82f6;color:white;border:none;border-radius:8px;padding:10px;font-weight:700;cursor:pointer">💾 Kaydet</button>
            </div>

            <div style="background:#0d1829;border:1px solid #1e3a5f;border-radius:12px;padding:16px">
              <h3 style="color:#e2e8f0;font-size:14px;margin:0 0 12px">📢 Mahalle Duyurusu</h3>
              <select id="adm_province" style="width:100%;padding:8px;background:#080d1a;border:1px solid #1e3a5f;border-radius:6px;color:#e2e8f0;margin-bottom:8px">
                ${(window.ILLER_LIST||['İstanbul','Ankara','İzmir']).map(il=>`<option>${il}</option>`).join('')}
              </select>
              <textarea id="adm_announce" placeholder="Duyuru metni..." rows="3" style="width:100%;padding:8px;background:#080d1a;border:1px solid #1e3a5f;border-radius:6px;color:#e2e8f0;box-sizing:border-box;margin-bottom:8px;resize:none"></textarea>
              <button onclick="window.GZX_R05_cityAnnouncement(window.GZ.uid,document.getElementById('adm_announce').value,document.getElementById('adm_province').value)"
                style="width:100%;background:#22c55e;color:white;border:none;border-radius:8px;padding:10px;font-weight:700;cursor:pointer">📢 Duyur</button>
            </div>

            <div style="background:#0d1829;border:1px solid #1e3a5f;border-radius:12px;padding:16px">
              <h3 style="color:#e2e8f0;font-size:14px;margin:0 0 12px">💸 Global Flash Haber</h3>
              <input id="adm_flash" placeholder="Flaş haber metni..." style="width:100%;padding:10px;background:#080d1a;border:1px solid #1e3a5f;border-radius:8px;color:#e2e8f0;font-size:13px;box-sizing:border-box;margin-bottom:8px">
              <button onclick="window.GZX_R03_globalBroadcast(document.getElementById('adm_flash').value,30000)"
                style="width:100%;background:#ef4444;color:white;border:none;border-radius:8px;padding:10px;font-weight:700;cursor:pointer">📡 Tüm Ekranlara Yayınla</button>
            </div>

          </div>
        </div>`;
      break;

    case 'polis_panel':
      container.innerHTML = `
        <div style="padding:20px">
          <h2 style="color:#60a5fa;margin:0 0 20px;font-size:18px">👮 Polis & Asayiş Paneli</h2>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px">

            <div style="background:#0d1829;border:1px solid #1e3a5f;border-radius:12px;padding:16px">
              <h3 style="color:#e2e8f0;font-size:14px;margin:0 0 12px">🔍 GBT Sorgulama</h3>
              <input id="adm_gbt" placeholder="Kullanıcı adı..." style="width:100%;padding:10px;background:#080d1a;border:1px solid #1e3a5f;border-radius:8px;color:#e2e8f0;font-size:13px;box-sizing:border-box;margin-bottom:8px">
              <button id="adm_gbt_btn" onclick="(async()=>{const r=await window.GZX_P01_GBTQuery(document.getElementById('adm_gbt').value);if(!r)return;document.getElementById('adm_gbt_result').innerHTML='<pre style=\\'font-size:11px;color:#94a3b8;white-space:pre-wrap\\'>'+JSON.stringify(r,null,2)+'</pre>';})();"
                style="width:100%;background:#3b82f6;color:white;border:none;border-radius:8px;padding:10px;font-weight:700;cursor:pointer">🔍 Sorgula</button>
              <div id="adm_gbt_result" style="margin-top:8px;background:#080d1a;border-radius:6px;padding:8px;min-height:40px;font-size:11px;color:#94a3b8"></div>
            </div>

            <div style="background:#0d1829;border:1px solid #1e3a5f;border-radius:12px;padding:16px">
              <h3 style="color:#e2e8f0;font-size:14px;margin:0 0 12px">💸 Para Cezası Kes</h3>
              <input id="adm_fine_uid" placeholder="Hedef UID..." style="width:100%;padding:8px;background:#080d1a;border:1px solid #1e3a5f;border-radius:6px;color:#e2e8f0;box-sizing:border-box;margin-bottom:6px">
              <input id="adm_fine_amt" type="number" placeholder="Ceza tutarı (₺)" style="width:100%;padding:8px;background:#080d1a;border:1px solid #1e3a5f;border-radius:6px;color:#e2e8f0;box-sizing:border-box;margin-bottom:6px">
              <input id="adm_fine_reason" placeholder="Sebep..." style="width:100%;padding:8px;background:#080d1a;border:1px solid #1e3a5f;border-radius:6px;color:#e2e8f0;box-sizing:border-box;margin-bottom:8px">
              <button onclick="window.GZX_P02_issueFine(document.getElementById('adm_fine_uid').value,parseInt(document.getElementById('adm_fine_amt').value),document.getElementById('adm_fine_reason').value,window.GZ.uid)"
                style="width:100%;background:#ef4444;color:white;border:none;border-radius:8px;padding:10px;font-weight:700;cursor:pointer">🚔 Ceza Kes</button>
            </div>

            <div style="background:#0d1829;border:1px solid #1e3a5f;border-radius:12px;padding:16px">
              <h3 style="color:#e2e8f0;font-size:14px;margin:0 0 12px">🔒 Hapis Gönder</h3>
              <input id="adm_jail_uid" placeholder="Hedef UID..." style="width:100%;padding:8px;background:#080d1a;border:1px solid #1e3a5f;border-radius:6px;color:#e2e8f0;box-sizing:border-box;margin-bottom:6px">
              <input id="adm_jail_hrs" type="number" placeholder="Süre (saat)" style="width:100%;padding:8px;background:#080d1a;border:1px solid #1e3a5f;border-radius:6px;color:#e2e8f0;box-sizing:border-box;margin-bottom:6px">
              <input id="adm_jail_why" placeholder="Sebep..." style="width:100%;padding:8px;background:#080d1a;border:1px solid #1e3a5f;border-radius:6px;color:#e2e8f0;box-sizing:border-box;margin-bottom:8px">
              <button onclick="window.GZX_P03_sendToJail(document.getElementById('adm_jail_uid').value,parseInt(document.getElementById('adm_jail_hrs').value),document.getElementById('adm_jail_why').value)"
                style="width:100%;background:#7c3aed;color:white;border:none;border-radius:8px;padding:10px;font-weight:700;cursor:pointer">⛓️ Hapsine Gönder</button>
            </div>
          </div>
        </div>`;
      break;

    case 'ihale':
      const tenders = await window.dbGet?.('tenders') || {};
      const tList   = Object.entries(tenders).sort(([,a],[,b])=>b.openedAt-a.openedAt).slice(0,10);
      container.innerHTML = `
        <div style="padding:20px">
          <h2 style="color:#60a5fa;margin:0 0 20px;font-size:18px">📋 İhale Yönetimi</h2>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px">
            <div style="background:#0d1829;border:1px solid #1e3a5f;border-radius:12px;padding:16px">
              <h3 style="color:#e2e8f0;font-size:14px;margin:0 0 12px">Yeni İhale Aç</h3>
              <input id="ih_title" placeholder="İhale başlığı" style="width:100%;padding:8px;background:#080d1a;border:1px solid #1e3a5f;border-radius:6px;color:#e2e8f0;box-sizing:border-box;margin-bottom:6px">
              <input id="ih_budget" type="number" placeholder="Bütçe (₺)" style="width:100%;padding:8px;background:#080d1a;border:1px solid #1e3a5f;border-radius:6px;color:#e2e8f0;box-sizing:border-box;margin-bottom:6px">
              <textarea id="ih_desc" placeholder="Açıklama..." rows="2" style="width:100%;padding:8px;background:#080d1a;border:1px solid #1e3a5f;border-radius:6px;color:#e2e8f0;box-sizing:border-box;margin-bottom:6px;resize:none"></textarea>
              <input id="ih_hours" type="number" placeholder="Süre (saat)" style="width:100%;padding:8px;background:#080d1a;border:1px solid #1e3a5f;border-radius:6px;color:#e2e8f0;box-sizing:border-box;margin-bottom:8px">
              <button onclick="window.GZX_I01_openTender(document.getElementById('ih_title').value,parseInt(document.getElementById('ih_budget').value),document.getElementById('ih_desc').value,parseInt(document.getElementById('ih_hours').value))"
                style="width:100%;background:#3b82f6;color:white;border:none;border-radius:8px;padding:10px;font-weight:700;cursor:pointer">📋 İhale Aç</button>
            </div>
            <div style="background:#0d1829;border:1px solid #1e3a5f;border-radius:12px;padding:16px">
              <h3 style="color:#e2e8f0;font-size:14px;margin:0 0 12px">Aktif İhaleler</h3>
              ${tList.length ? tList.map(([id,t])=>`
                <div style="padding:8px 0;border-bottom:1px solid #0f1e33">
                  <div style="font-size:12px;font-weight:700;color:#e2e8f0">${t.title}</div>
                  <div style="font-size:11px;color:#64748b">${_f(t.budget)} · ${Object.keys(t.bids||{}).length} teklif · ${t.status}</div>
                  ${t.status==='open'?`<button onclick="window.GZX_I03_awardTender('${id}')" style="margin-top:4px;background:#22c55e22;color:#22c55e;border:1px solid #22c55e44;border-radius:4px;padding:3px 8px;font-size:10px;font-weight:700;cursor:pointer">🏆 Sonuçlandır</button>`:''}
                </div>`).join(''):'<p style="color:#475569;font-size:12px">İhale yok</p>'}
            </div>
          </div>
        </div>`;
      break;

    case 'secim':
      container.innerHTML = `
        <div style="padding:20px">
          <h2 style="color:#60a5fa;margin:0 0 20px;font-size:18px">🗳️ Seçim & Parti Yönetimi</h2>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px">
            <div style="background:#0d1829;border:1px solid #1e3a5f;border-radius:12px;padding:16px">
              <h3 style="color:#e2e8f0;font-size:14px;margin:0 0 12px">Seçim Başlat</h3>
              <select id="se_type" style="width:100%;padding:8px;background:#080d1a;border:1px solid #1e3a5f;border-radius:6px;color:#e2e8f0;margin-bottom:6px">
                <option value="belediye">Belediye Başkanlığı</option>
                <option value="milletvekili">Milletvekilliği</option>
                <option value="cumhurbaskani">Cumhurbaşkanlığı</option>
              </select>
              <select id="se_province" style="width:100%;padding:8px;background:#080d1a;border:1px solid #1e3a5f;border-radius:6px;color:#e2e8f0;margin-bottom:6px">
                ${(window.ILLER_LIST||['İstanbul','Ankara']).map(il=>`<option>${il}</option>`).join('')}
              </select>
              <input id="se_hours" type="number" placeholder="Süre (saat)" value="72" style="width:100%;padding:8px;background:#080d1a;border:1px solid #1e3a5f;border-radius:6px;color:#e2e8f0;box-sizing:border-box;margin-bottom:8px">
              <button onclick="window.GZX_S02_startElection(document.getElementById('se_type').value,document.getElementById('se_province').value,parseInt(document.getElementById('se_hours').value))"
                style="width:100%;background:#3b82f6;color:white;border:none;border-radius:8px;padding:10px;font-weight:700;cursor:pointer">🗳️ Seçimi Başlat</button>
            </div>
            <div style="background:#0d1829;border:1px solid #1e3a5f;border-radius:12px;padding:16px">
              <h3 style="color:#e2e8f0;font-size:14px;margin:0 0 12px">Piyasa Olayları</h3>
              <button onclick="window.GZX_E03_electionEffect?.()" style="width:100%;background:#eab30822;color:#eab308;border:1px solid #eab30844;border-radius:6px;padding:8px;font-size:12px;font-weight:700;cursor:pointer;margin-bottom:6px">🗳️ Seçim Atmosferi</button>
              <button onclick="window.GZX_E15_currencyCrisis?.()" style="width:100%;background:#ef444422;color:#ef4444;border:1px solid #ef444444;border-radius:6px;padding:8px;font-size:12px;font-weight:700;cursor:pointer;margin-bottom:6px">💸 Döviz Krizi</button>
              <button onclick="window.GZX_E20_globalCrash?.()" style="width:100%;background:#ef444422;color:#ef4444;border:1px solid #ef444444;border-radius:6px;padding:8px;font-size:12px;font-weight:700;cursor:pointer;margin-bottom:6px">📉 Küresel Çöküş</button>
              <button onclick="window.GZX_E07_techRevolution?.('teknoloji')" style="width:100%;background:#22c55e22;color:#22c55e;border:1px solid #22c55e44;border-radius:6px;padding:8px;font-size:12px;font-weight:700;cursor:pointer;margin-bottom:6px">🚀 Teknoloji Devrimi</button>
              <button onclick="window.GZX_C05_runWhaleBots?.()" style="width:100%;background:#3b82f622;color:#3b82f6;border:1px solid #3b82f644;border-radius:6px;padding:8px;font-size:12px;font-weight:700;cursor:pointer">🐋 Balina Bot Çalıştır</button>
            </div>
          </div>
        </div>`;
      break;
  }
};

/* ══════════════════════════════════════════════════════════════════════════
   ADMİN NAV ENTEGRASYONU — Yeni sekmeleri sol menüye ekle
   ══════════════════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', function () {
  setTimeout(function () {
    const nav = document.getElementById('adminScreenNav');
    if (!nav || !window.GZ?.data?.isFounder) return;

    const newLinks = `
      <div style="font-size:9px;font-weight:800;letter-spacing:2px;color:#334155;padding:12px 14px 4px">YENİ 200 MADDE</div>
      <button class="asnb" onclick="window.AP&&window.AP.navTo(this,'muhtarlik');window.GZX_renderAdminSection('muhtarlik',document.getElementById('adminScreenBody'))"><span>🏛️</span><span>Muhtarlık</span></button>
      <button class="asnb" onclick="window.AP&&window.AP.navTo(this,'polis_panel');window.GZX_renderAdminSection('polis_panel',document.getElementById('adminScreenBody'))"><span>👮</span><span>Polis Paneli</span></button>
      <button class="asnb" onclick="window.AP&&window.AP.navTo(this,'ihale');window.GZX_renderAdminSection('ihale',document.getElementById('adminScreenBody'))"><span>📋</span><span>İhale</span></button>
      <button class="asnb" onclick="window.AP&&window.AP.navTo(this,'secim');window.GZX_renderAdminSection('secim',document.getElementById('adminScreenBody'))"><span>🗳️</span><span>Seçim & Olaylar</span></button>
      <button class="asnb" onclick="window.GZX_renderSecurityTab&&window.GZX_renderSecurityTab(document.getElementById('adminScreenBody'))"><span>🛡️</span><span>XP & Güvenlik</span></button>
    `;

    // Mevcut menünün sonuna ekle
    const lastSection = nav.querySelector('[style*="SİSTEM"]') || nav.lastElementChild;
    if (lastSection) lastSection.insertAdjacentHTML('beforebegin', newLinks);
    else nav.insertAdjacentHTML('beforeend', newLinks);
  }, 3000);
});

/* ══════════════════════════════════════════════════════════════════════════
   OYUNCU BAŞLANGIÇ AKIŞI — Kimlik kartı zorunluluğu
   ══════════════════════════════════════════════════════════════════════════ */
(function patchTradeGuard() {
  const check = setInterval(function () {
    if (!window.GZ?.uid) return;
    clearInterval(check);

    // Kimlik yoksa ticaret butonlarını kilitle
    setTimeout(async function () {
      const data = await window.dbGet?.(`users/${window.GZ.uid}`);
      if (data && !data.kimlikKarti) {
        window.toast?.(
          '⚠️ Ticaret yapabilmek için önce Muhtarlık sekmesinden kimlik kartı çıkartın! (500₺)',
          'warn', 10000
        );
        // Hapisten çık kontrolü
        if (data.inJail && Date.now() >= (data.jailUntil || 0)) {
          await window.GZX_P03_checkJailRelease?.(window.GZ.uid);
        }
        // Emekli maaşı
        if (data.retired) {
          await window.GZX_G04_payPensions?.();
        }
      }
    }, 2000);
  }, 500);
})();

console.log('[system-logic-v3.js] ✅ 200 Madde + Muhtarlık + Polis + SGK + Kara Borsa + Seçim + İhale + Kartlar + Billboard — TAM AKTİF');

/* ============================================================================
   ui-manager-ext.js — GameZone ERP: Tüm Eksik Ekranlar
   ============================================================================
   Bu dosya ui-manager.js'in içini dolduran EK dosyadır.
   index.html'de ui-manager.js'den HEMEN SONRA yükle.

   EKRANLAR:
   muhtarlik, belediye, polis, sgk, borsa, emlak, karaborsa,
   secim, basbakanlik, profil/cuzdan, vergi, kredi, tahvil,
   futures, emlak, sigorta, calisan, arge, ticsavas, liderlik+
   ============================================================================ */

/* ── render() fonksiyonunu genişlet ── */
(function patchRender() {
  const _orig = window.render;
  window.render = function (tab) {
    const ext = {
      muhtarlik:      renderMuhtarlik,
      belediye:       renderBelediye,
      polis:          renderPolis,
      sgk:            renderSGK,
      borsa:          renderBorsa,
      emlak:          renderEmlak,
      karaborsa:      renderKaraborsa,
      secim:          renderSecim,
      basbakanlik:    renderBasbakanlik,
      cumhurbaskani:  renderCumhurbaskani,
      cuzdan:         renderCuzdan,
      profil:         renderProfil,
      tahvil:         renderTahvil,
      futures:        renderFutures,
      hedgefon:       renderHedgeFon,
      sigorta:        renderSigorta,
      franchise:      renderFranchise,
      calisan:        renderCalisan,
      arge:           renderArge,
      egitim:         renderEgitim,
      sozlesme:       renderSozlesme,
      ticsavas:       renderTicSavas,
      duello:         renderDuello,
      avatar:         renderAvatar,
      unvan:          renderUnvan,
      sefer:          renderSefer,
      prestij:        renderPrestij,
      uluslararasi:   renderUluslararasi,
      harita:         renderHarita,
      yatirim:        renderYatirim,
    };
    if (ext[tab]) {
      const main = document.getElementById('appMain');
      if (main) main.innerHTML = `<div style="padding:40px;text-align:center"><div class="spinner" style="margin:0 auto"></div></div>`;
      ext[tab]();
    } else if (_orig) {
      _orig(tab);
    }
  };
})();

/* ── Yardımcılar ── */
const _M = {
  fmt: n => typeof cashFmt === 'function' ? cashFmt(n) : Number(n).toLocaleString('tr-TR', {minimumFractionDigits:2}) + ' ₺',
  ts:  ts => new Date(ts).toLocaleString('tr-TR'),
  el:  id => document.getElementById(id),
  main: () => document.getElementById('appMain'),
  uid: () => window.GZ?.uid,
  data: () => window.GZ?.data || {},
  toast: (m, k) => typeof toast === 'function' && toast(m, k||'info'),
  dbg: (p) => typeof dbGet === 'function' ? dbGet(p) : Promise.resolve(null),
  dbu: (p, o) => typeof dbUpdate === 'function' ? dbUpdate(p, o) : Promise.resolve(),
  dbp: (p, v) => typeof dbPush === 'function' ? dbPush(p, v) : Promise.resolve(),
  dbt: (p, fn) => typeof dbTransaction === 'function' ? dbTransaction(p, fn) : Promise.resolve(),
  isFounder: () => window.GZ?.data?.isFounder || false,
  card: (title, body, color) => `
    <div style="background:#0d1829;border:1px solid ${color||'#1e3a5f'};border-radius:14px;
      padding:18px;margin-bottom:14px">
      ${title ? `<div style="font-size:14px;font-weight:800;color:#e2e8f0;margin-bottom:12px">${title}</div>` : ''}
      ${body}
    </div>`,
  btn: (label, onclick, color) => `
    <button onclick="${onclick}" style="background:${color||'#3b82f6'};color:white;border:none;
      border-radius:10px;padding:12px 20px;font-weight:700;font-size:13px;cursor:pointer;
      width:100%;margin-bottom:8px">${label}</button>`,
  input: (id, placeholder, type) => `
    <input id="${id}" type="${type||'text'}" placeholder="${placeholder}"
      style="width:100%;padding:12px;background:#080d1a;border:1px solid #1e3a5f;
      border-radius:10px;color:#e2e8f0;font-size:13px;box-sizing:border-box;margin-bottom:10px">`,
  badge: (text, color) => `<span style="background:${color||'#3b82f6'}22;color:${color||'#3b82f6'};border:1px solid ${color||'#3b82f6'}44;border-radius:999px;padding:2px 10px;font-size:11px;font-weight:700">${text}</span>`,
  pageTitle: (icon, title, sub) => `
    <div style="padding:20px 16px 8px">
      <div style="font-size:22px;font-weight:900;color:#e2e8f0">${icon} ${title}</div>
      ${sub ? `<div style="font-size:12px;color:#64748b;margin-top:4px">${sub}</div>` : ''}
    </div>`,
  stat: (label, value, color) => `
    <div style="text-align:center">
      <div style="font-size:22px;font-weight:900;color:${color||'#60a5fa'}">${value}</div>
      <div style="font-size:10px;color:#64748b;margin-top:2px">${label}</div>
    </div>`,
};

/* ══════════════════════════════════════════════════════════════════
   MUHTARLIK PANELİ
   ══════════════════════════════════════════════════════════════════ */
async function renderMuhtarlik() {
  const main = _M.main(); if (!main) return;
  const uid  = _M.uid();  if (!uid)  return;
  const d    = await _M.dbg(`users/${uid}`) || {};
  const card = d.kimlikKarti;
  const idFee = (await _M.dbg('system/idCardFee')) || 500;
  const drivFee = (await _M.dbg('system/driverLicenseFee')) || 1200;
  const passFee = (await _M.dbg('system/passportFee')) || 3500;

  let kimlikHTML = '';
  if (card) {
    kimlikHTML = `
      <div style="background:linear-gradient(135deg,#0b1931,#1a3a6b);border:1px solid #3b82f644;
        border-radius:16px;padding:20px;margin-bottom:12px;position:relative;overflow:hidden">
        <div style="position:absolute;top:-20px;right:-20px;width:80px;height:80px;
          background:radial-gradient(circle,#3b82f622,transparent);border-radius:50%"></div>
        <div style="font-size:8px;letter-spacing:3px;color:#60a5fa;font-weight:800;margin-bottom:4px">TÜRKİYE — KİMLİK BELGESİ</div>
        <div style="display:flex;gap:14px;align-items:center;margin:12px 0">
          <div style="width:52px;height:64px;background:#1e3a5f;border:2px solid #3b82f644;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:24px">👤</div>
          <div>
            <div style="font-size:7px;color:#64748b;letter-spacing:1px">AD SOYAD</div>
            <div style="font-size:16px;font-weight:900;letter-spacing:1px">${(d.username||'OYUNCU').toUpperCase()}</div>
            <div style="font-size:7px;color:#64748b;margin-top:4px">KİMLİK NO</div>
            <div style="font-size:13px;font-weight:700;color:#93c5fd;letter-spacing:2px">${card.tc||'—'}</div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;font-size:11px">
          <div><div style="color:#64748b;font-size:9px">İL</div><div style="font-weight:700">${d.province||'—'}</div></div>
          <div><div style="color:#64748b;font-size:9px">VERİLİŞ</div><div style="font-weight:700">${card.verilis ? new Date(card.verilis).toLocaleDateString('tr-TR') : '—'}</div></div>
          <div><div style="color:#64748b;font-size:9px">DURUM</div><div style="color:#22c55e;font-weight:700">✅ Aktif</div></div>
        </div>
        <div style="margin-top:10px;font-size:9px;color:#22c55e;border-top:1px solid #1e3a5f;padding-top:8px">✅ MUHTAR ONAYLI — Seri: ${card.seriNo||'—'}</div>
      </div>`;
  } else {
    kimlikHTML = `
      <div style="background:#380000;border:1px solid #ef444444;border-radius:12px;padding:16px;margin-bottom:12px;text-align:center">
        <div style="font-size:32px;margin-bottom:8px">🪪</div>
        <div style="font-size:14px;font-weight:700;color:#ef4444;margin-bottom:4px">Kimlik Kartı Yok!</div>
        <div style="font-size:12px;color:#94a3b8">Kimlik kartı olmadan ticaret yapamazsın.</div>
      </div>`;
  }

  main.innerHTML = `
    <div style="padding:0 0 80px">
      ${_M.pageTitle('🏛️', 'Muhtarlık', d.province ? d.province + ' Muhtarlığı' : 'Yerel Yönetim Hizmetleri')}
      <div style="padding:0 16px">

        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:16px">
          ${_M.stat('Bakiye', _M.fmt(d.bakiye||0), '#22c55e')}
          ${_M.stat('Level', d.level||1, '#60a5fa')}
          ${_M.stat('Rütbe', typeof GZX_getRank==='function'?GZX_getRank(d.level||1):'—', '#a855f7')}
        </div>

        ${_M.card('🪪 Kimlik Belgeleri', `
          ${kimlikHTML}
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            ${!card ? `
              <button onclick="GZX_M01_issueIDCard('${uid}').then(()=>renderMuhtarlik())"
                style="grid-column:1/-1;background:#3b82f6;color:white;border:none;border-radius:10px;padding:14px;font-weight:800;font-size:14px;cursor:pointer">
                🪪 Kimlik Kartı Çıkart (${_M.fmt(idFee)})
              </button>` : ''}
            <button onclick="(async()=>{const r=await GZX_M01_issueIDCard&&dbGet('users/${uid}/ehliyet');if(!r){await GZX_safePay('${uid}',${drivFee},'Ehliyet');await dbUpdate('users/${uid}',{ehliyet:{issuedAt:Date.now()}});toast('🚗 Ehliyet alındı!','success');renderMuhtarlik();}})()"
              style="background:#10b98122;color:#10b981;border:1px solid #10b98144;border-radius:10px;padding:12px;font-weight:700;font-size:12px;cursor:pointer">
              🚗 Ehliyet<br><small>${_M.fmt(drivFee)}</small>
            </button>
            <button onclick="(async()=>{await GZX_safePay('${uid}',${passFee},'Pasaport');await dbUpdate('users/${uid}',{pasaport:{issuedAt:Date.now()}});toast('📘 Pasaport alındı!','success');renderMuhtarlik();})()"
              style="background:#a855f722;color:#a855f7;border:1px solid #a855f744;border-radius:10px;padding:12px;font-weight:700;font-size:12px;cursor:pointer">
              📘 Pasaport<br><small>${_M.fmt(passFee)}</small>
            </button>
          </div>
        `)}

        ${_M.card('🤝 Sosyal Yardım', `
          <div style="font-size:12px;color:#94a3b8;margin-bottom:12px">Bakiyeniz 5.000₺ altındaysa devlet yardımı alabilirsiniz.</div>
          <button onclick="GZX_M03_checkPovertyBenefit('${uid}').then(r=>{renderMuhtarlik()})"
            style="width:100%;background:#22c55e;color:white;border:none;border-radius:10px;padding:12px;font-weight:700;cursor:pointer">
            💰 Sosyal Yardım Başvurusu
          </button>
          <button onclick="(async()=>{const data=await dbGet('users/${uid}');const lastAid=data?.lastSocialAid||0;const diff=Date.now()-lastAid;const remaining=Math.max(0,7*86400000-diff);if(remaining>0){toast('⏳ '+Math.ceil(remaining/3600000)+' saat sonra tekrar başvurabilirsiniz','warn');return;}toast('Başvurunuz değerlendiriliyor...','info');})()"
            style="width:100%;background:rgba(255,255,255,.05);color:#94a3b8;border:1px solid #1e3a5f;border-radius:10px;padding:10px;font-weight:600;font-size:12px;cursor:pointer;margin-top:4px">
            📋 Başvuru Durumu
          </button>
        `)}

        ${_M.card('📢 Mahalle Duyuruları', `
          <div id="muhDuyurular" style="min-height:60px;color:#64748b;font-size:12px">Yükleniyor...</div>
          <div style="margin-top:12px">
            ${_M.input('muhDuyuruMetin', 'Duyuru metni yazın... (250₺)', 'text')}
            <button onclick="GZX_R05_cityAnnouncement('${uid}',document.getElementById('muhDuyuruMetin').value,'${d.province||'İstanbul'}').then(()=>{document.getElementById('muhDuyuruMetin').value='';renderMuhtarlik()})"
              style="width:100%;background:#eab308;color:#000;border:none;border-radius:10px;padding:12px;font-weight:700;cursor:pointer">
              📢 Mahallene Duyur (250₺)
            </button>
          </div>
        `)}

      </div>
    </div>`;

  // Duyuruları yükle
  const prov = d.province || 'İstanbul';
  const duyurular = await _M.dbg(`politics/${prov}/announcements`) || {};
  const dEl = document.getElementById('muhDuyurular');
  if (dEl) {
    const list = Object.values(duyurular).sort((a,b)=>b.ts-a.ts).slice(0,5);
    dEl.innerHTML = list.length
      ? list.map(d2=>`<div style="padding:8px 0;border-bottom:1px solid #0f1e33;font-size:12px;color:#cbd5e1"><span style="color:#64748b;font-size:10px">${new Date(d2.ts).toLocaleString('tr-TR')} — ${d2.username||'Anonim'}</span><br>${d2.message}</div>`).join('')
      : '<div style="color:#475569;text-align:center;padding:16px">Henüz duyuru yok</div>';
  }
}
window.renderMuhtarlik = renderMuhtarlik;

/* ══════════════════════════════════════════════════════════════════
   BELEDİYE PANELİ
   ══════════════════════════════════════════════════════════════════ */
async function renderBelediye() {
  const main = _M.main(); if (!main) return;
  const uid  = _M.uid();  if (!uid)  return;
  const d    = await _M.dbg(`users/${uid}`) || {};
  const prov = d.province || 'İstanbul';
  const belBudget = (await _M.dbg(`politics/${prov}/belediyeBudgeti`)) || 0;
  const ruhsatlar = d.isyeriRuhsati || {};
  const transitFare = (await _M.dbg(`politics/${prov}/transit/fare`)) || 15;

  const RUHSAT_TYPES = [
    {id:'dukkan',   label:'🏪 Dükkan',    fee:15000},
    {id:'restaurant',label:'🍽️ Restoran', fee:35000},
    {id:'market',   label:'🛒 Market',    fee:25000},
    {id:'fabrika',  label:'🏭 Fabrika',   fee:100000},
    {id:'cafe',     label:'☕ Kafe',      fee:20000},
  ];

  main.innerHTML = `
    <div style="padding:0 0 80px">
      ${_M.pageTitle('🏙️', 'Belediye', prov + ' Belediyesi')}
      <div style="padding:0 16px">

        <div style="background:linear-gradient(135deg,#0b1931,#1a3a6b);border-radius:12px;padding:16px;margin-bottom:16px;text-align:center">
          <div style="font-size:11px;color:#64748b;margin-bottom:4px">BELEDİYE BÜTÇESİ</div>
          <div style="font-size:28px;font-weight:900;color:#60a5fa">${_M.fmt(belBudget)}</div>
          <div style="font-size:11px;color:#64748b;margin-top:4px">Toplu Taşıma: ${transitFare}₺/bilet</div>
        </div>

        ${_M.card('📋 İşyeri Açma Ruhsatı', `
          <div style="font-size:12px;color:#94a3b8;margin-bottom:12px">
            Her işletme türü için tek seferlik belediye ödemesi gereklidir.
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            ${RUHSAT_TYPES.map(r => {
              const has = !!ruhsatlar[r.id];
              return `
                <button onclick="${has ? '' : `GZX_MUN01_getBusinessLicense('${uid}','${r.id}','${prov}').then(()=>renderBelediye())`}"
                  style="background:${has?'#22c55e22':'#3b82f622'};color:${has?'#22c55e':'#3b82f6'};
                  border:1px solid ${has?'#22c55e44':'#3b82f644'};border-radius:10px;padding:12px;
                  font-weight:700;font-size:12px;cursor:${has?'default':'pointer'};text-align:left">
                  ${r.label}<br>
                  <small style="font-weight:400">${has ? '✅ Aktif' : _M.fmt(r.fee)}</small>
                </button>`;
            }).join('')}
          </div>
        `)}

        ${_M.card('🏗️ İmar & Yapı İşlemleri', `
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            <button onclick="GZX_D08_applyZoning&&GZX_D08_applyZoning('${uid}','genel','yeni_kat').then(()=>toast('🏗️ İmar başvurusu alındı','success'))"
              style="background:#a855f722;color:#a855f7;border:1px solid #a855f744;border-radius:10px;padding:12px;font-size:12px;font-weight:700;cursor:pointer">
              🏗️ İmar İzni<br><small>15.000₺</small>
            </button>
            <button onclick="GZX_MUN03_imarAmnesty&&GZX_MUN03_imarAmnesty('genel','${uid}').then(()=>toast('📋 İmar affı başvurusu yapıldı','info'))"
              style="background:#eab30822;color:#eab308;border:1px solid #eab30844;border-radius:10px;padding:12px;font-size:12px;font-weight:700;cursor:pointer">
              🏠 İmar Affı<br><small>50.000₺</small>
            </button>
          </div>
        `)}

        ${_M.card('🚌 Toplu Taşıma', `
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
            <div><div style="font-size:12px;color:#94a3b8">Güncel Bilet Fiyatı</div>
              <div style="font-size:24px;font-weight:900;color:#e2e8f0">${transitFare}₺</div></div>
            <div style="font-size:32px">🚌</div>
          </div>
          <button onclick="(async()=>{const f=await dbGet('system/forexRates/USD')||32.5;const inf=await dbGet('system/enflasyon')||0.45;const newFare=Math.ceil(${transitFare}*(1+inf*0.3));await GZX_MUN04_updateTransitFare(newFare,'${prov}');renderBelediye();})()"
            style="width:100%;background:#f9731622;color:#f97316;border:1px solid #f9731644;border-radius:10px;padding:10px;font-weight:700;cursor:pointer;font-size:12px">
            📈 Enflasyona Göre Güncelle
          </button>
        `)}

        ${_M.card('📊 Aylık Vergi Özeti', `
          <div style="font-size:12px;color:#94a3b8;margin-bottom:8px">Bu ay ödenen belediye vergileri:</div>
          <div id="belVergiler" style="color:#64748b;font-size:12px">Yükleniyor...</div>
        `)}

      </div>
    </div>`;

  // Vergileri yükle
  const vergilerEl = document.getElementById('belVergiler');
  const giderler = await _M.dbg(`users/${uid}/giderler`) || {};
  const belVergis = Object.values(giderler).filter(g => g.description && g.description.includes('Çöp'));
  if (vergilerEl) {
    vergilerEl.innerHTML = belVergis.length
      ? belVergis.slice(-5).map(g => `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #0f1e33"><span>${g.description}</span><span style="color:#ef4444">${_M.fmt(g.amount)}</span></div>`).join('')
      : '<div style="text-align:center;padding:12px">Bu ay henüz belediye vergisi ödenmedi</div>';
  }
}
window.renderBelediye = renderBelediye;

/* ══════════════════════════════════════════════════════════════════
   POLİS PANELİ
   ══════════════════════════════════════════════════════════════════ */
async function renderPolis() {
  const main = _M.main(); if (!main) return;
  const uid  = _M.uid();  if (!uid)  return;
  const d    = await _M.dbg(`users/${uid}`) || {};
  const role = d.role || 'vatandas';
  const isPolis = role === 'police' || d.isFounder;

  // Hapis kontrolü
  if (d.inJail && Date.now() < (d.jailUntil || 0)) {
    const remaining = Math.ceil((d.jailUntil - Date.now()) / 3600000);
    main.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:60vh;padding:32px;text-align:center">
        <div style="font-size:80px;margin-bottom:16px">⛓️</div>
        <div style="font-size:24px;font-weight:900;color:#ef4444;margin-bottom:8px">HAPİSHANEDESİNİZ</div>
        <div style="font-size:14px;color:#94a3b8;margin-bottom:16px">${d.jailReason || 'Mahkeme kararı'}</div>
        <div style="font-size:36px;font-weight:900;color:#ef4444;font-variant-numeric:tabular-nums">${remaining} SAAT</div>
        <div style="font-size:12px;color:#64748b;margin-top:8px">Tahliye: ${new Date(d.jailUntil).toLocaleString('tr-TR')}</div>
        <button onclick="GZX_P03_checkJailRelease('${uid}').then(()=>renderPolis())"
          style="margin-top:20px;background:#3b82f6;color:white;border:none;border-radius:10px;padding:14px 30px;font-weight:700;cursor:pointer">
          🔄 Durum Kontrol Et
        </button>
      </div>`;
    return;
  }

  // Sabıka kaydı
  const cezalar = Object.values(await _M.dbg(`users/${uid}/cezalar`) || {});
  const crimCount = d.criminalRecord || 0;
  const krediSkoru = d.krediSkoru || 50;

  main.innerHTML = `
    <div style="padding:0 0 80px">
      ${_M.pageTitle('👮', 'Emniyet Müdürlüğü', isPolis ? '🔵 Polis Yetkisi Aktif' : 'Vatandaş İşlemleri')}
      <div style="padding:0 16px">

        <!-- Kişisel durum -->
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:16px">
          ${_M.stat('Sabıka Kaydı', crimCount + ' suç', crimCount > 0 ? '#ef4444' : '#22c55e')}
          ${_M.stat('Kredi Skoru', krediSkoru + '/100', krediSkoru >= 60 ? '#22c55e' : '#ef4444')}
          ${_M.stat('Durum', d.inJail ? '⛓️ Tutuklu' : '🟢 Serbest', d.inJail ? '#ef4444' : '#22c55e')}
        </div>

        ${_M.card('📋 Kişisel GBT Kaydı', `
          <div style="font-size:12px;color:#94a3b8;margin-bottom:10px">Kendi sicil bilgileriniz:</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px">
            <div style="background:#080d1a;border-radius:8px;padding:10px">
              <div style="color:#64748b;font-size:10px">KİMLİK</div>
              <div style="color:${d.kimlikKarti?'#22c55e':'#ef4444'};font-weight:700">${d.kimlikKarti?'✅ Var':'❌ Yok'}</div>
            </div>
            <div style="background:#080d1a;border-radius:8px;padding:10px">
              <div style="color:#64748b;font-size:10px">KARA LİSTE</div>
              <div style="color:${d.karaListede?'#ef4444':'#22c55e'};font-weight:700">${d.karaListede?'❌ Var':'✅ Yok'}</div>
            </div>
            <div style="background:#080d1a;border-radius:8px;padding:10px">
              <div style="color:#64748b;font-size:10px">RUHSAT</div>
              <div style="color:${Object.keys(d.isyeriRuhsati||{}).length>0?'#22c55e':'#f97316'};font-weight:700">${Object.keys(d.isyeriRuhsati||{}).length} Ruhsat</div>
            </div>
            <div style="background:#080d1a;border-radius:8px;padding:10px">
              <div style="color:#64748b;font-size:10px">BORÇ</div>
              <div style="color:${(d.borglar||0)>0?'#ef4444':'#22c55e'};font-weight:700">${_M.fmt(d.borglar||0)}</div>
            </div>
          </div>
        `)}

        ${cezalar.length > 0 ? _M.card('⚖️ Ceza Geçmişi', `
          ${cezalar.slice(-5).reverse().map(c => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #0f1e33">
              <div>
                <div style="font-size:12px;font-weight:600;color:#e2e8f0">${c.reason || c.type || 'Ceza'}</div>
                <div style="font-size:10px;color:#64748b">${_M.ts(c.ts)}</div>
              </div>
              ${c.amount ? `<div style="color:#ef4444;font-weight:700;font-size:13px">${_M.fmt(c.amount)}</div>` : ''}
            </div>`).join('')}
        `) : ''}

        ${_M.card('🔍 GBT Sorgulama', `
          <div style="font-size:12px;color:#94a3b8;margin-bottom:10px">
            ${isPolis ? 'Polis yetkisiyle herhangi bir oyuncuyu sorgulayabilirsiniz.' : 'Yalnızca kendi kaydınızı görebilirsiniz.'}
          </div>
          ${isPolis ? `
            ${_M.input('polisGBTInput', 'Kullanıcı adı girin...', 'text')}
            <button onclick="(async()=>{const r=await GZX_P01_GBTQuery(document.getElementById('polisGBTInput').value);if(!r)return;const el=document.getElementById('polisGBTResult');if(el)el.innerHTML='<pre style=\\'background:#080d1a;padding:12px;border-radius:8px;font-size:11px;color:#94a3b8;overflow:auto\\'>'+JSON.stringify(r,null,2)+'</pre>';})()"
              style="width:100%;background:#3b82f6;color:white;border:none;border-radius:10px;padding:12px;font-weight:700;cursor:pointer;margin-bottom:8px">
              🔍 GBT Sorgula
            </button>
            <div id="polisGBTResult"></div>
          ` : '<div style="color:#475569;text-align:center;padding:16px;font-size:12px">Bu özellik için polis yetkisi gereklidir.</div>'}
        `)}

        ${_M.card('💰 Para Cezalarım', `
          <div id="cezaListesi" style="min-height:40px;font-size:12px;color:#94a3b8">Yükleniyor...</div>
          <button onclick="toast('Avukat ile itiraz yapabilirsiniz. Özellik geliştiriliyor...','info')"
            style="width:100%;background:rgba(255,255,255,.05);color:#64748b;border:1px solid #1e3a5f;border-radius:10px;padding:10px;font-weight:600;font-size:12px;cursor:pointer;margin-top:8px">
            ⚖️ Cezaya İtiraz Et (Avukat)
          </button>
        `)}

        ${isPolis ? _M.card('🚔 Polis Araçları', `
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            <button onclick="switchTab('polis_gbt')"
              style="background:#3b82f622;color:#3b82f6;border:1px solid #3b82f644;border-radius:10px;padding:14px;font-weight:700;cursor:pointer">
              🔍 Sorgulama<br><small>GBT Paneli</small>
            </button>
            <button onclick="switchTab('polis_ceza')"
              style="background:#ef444422;color:#ef4444;border:1px solid #ef444444;border-radius:10px;padding:14px;font-weight:700;cursor:pointer">
              💸 Ceza Kes<br><small>Para Cezası</small>
            </button>
          </div>
        `) : ''}

      </div>
    </div>`;

  // Cezaları yükle
  const cezaEl = document.getElementById('cezaListesi');
  if (cezaEl) {
    const sonCezalar = cezalar.slice(-3).reverse();
    cezaEl.innerHTML = sonCezalar.length
      ? sonCezalar.map(c=>`<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #0f1e33"><span style="color:#e2e8f0">${c.reason||'Ceza'}</span><span style="color:#ef4444;font-weight:700">${_M.fmt(c.amount||0)}</span></div>`).join('')
      : '<div style="text-align:center;padding:12px">Ceza kaydı bulunmuyor ✅</div>';
  }
}
window.renderPolis = renderPolis;

/* ══════════════════════════════════════════════════════════════════
   SGK PANELİ
   ══════════════════════════════════════════════════════════════════ */
async function renderSGK() {
  const main = _M.main(); if (!main) return;
  const uid  = _M.uid();  if (!uid)  return;
  const d    = await _M.dbg(`users/${uid}`) || {};
  const minWage = (await _M.dbg('system/minWage')) || 17002;
  const sgkRate = (await _M.dbg('system/sgkRate')) || 0.145;
  const RETIRE_LEVEL = 50;
  const level = d.level || 1;
  const retireProgress = Math.min(100, Math.round(level / RETIRE_LEVEL * 100));

  main.innerHTML = `
    <div style="padding:0 0 80px">
      ${_M.pageTitle('🏥', 'SGK & Sosyal Güvenlik', 'Sosyal Güvenlik Kurumu')}
      <div style="padding:0 16px">

        <div style="background:linear-gradient(135deg,#0b1931,#1a3a6b);border-radius:12px;padding:16px;margin-bottom:16px">
          <div style="font-size:11px;color:#64748b;margin-bottom:4px">EMEKLİLİK İLERLEMESİ</div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <div style="font-size:18px;font-weight:800">Level ${level} / ${RETIRE_LEVEL}</div>
            <div style="font-size:13px;color:${d.retired?'#22c55e':'#60a5fa'}">${d.retired?'✅ Emekli':'Aktif'}</div>
          </div>
          <div style="background:#1e3a5f;border-radius:999px;height:10px;overflow:hidden">
            <div style="width:${retireProgress}%;height:100%;background:${retireProgress>=100?'#22c55e':'#3b82f6'};border-radius:999px;transition:width .5s"></div>
          </div>
          <div style="font-size:11px;color:#64748b;margin-top:6px">${retireProgress}% tamamlandı</div>
        </div>

        ${_M.card('👴 Emeklilik', `
          ${d.retired ? `
            <div style="text-align:center;padding:16px">
              <div style="font-size:32px;margin-bottom:8px">🎉</div>
              <div style="font-size:14px;font-weight:700;color:#22c55e">Emeklisiniz!</div>
              <div style="font-size:12px;color:#94a3b8;margin-top:4px">Aylık Emekli Maaşı: <b style="color:#22c55e">${_M.fmt(d.pension||0)}</b></div>
            </div>` : `
            <div style="font-size:12px;color:#94a3b8;margin-bottom:12px">Level ${RETIRE_LEVEL}'e ulaşınca emekli olabilirsiniz. Emekli maaşı asgari ücretin %60'ıdır.</div>
            <div style="display:flex;justify-content:space-between;background:#080d1a;border-radius:8px;padding:12px;margin-bottom:10px">
              <span style="color:#94a3b8;font-size:12px">Tahmini Emekli Maaşı</span>
              <span style="color:#22c55e;font-weight:700">${_M.fmt(Math.floor(minWage*0.60))}/ay</span>
            </div>
            <button onclick="GZX_G03_checkRetirement('${uid}').then(r=>renderSGK())"
              style="width:100%;background:${level>=RETIRE_LEVEL?'#22c55e':'#1e3a5f'};color:${level>=RETIRE_LEVEL?'white':'#475569'};border:none;border-radius:10px;padding:12px;font-weight:700;cursor:${level>=RETIRE_LEVEL?'pointer':'not-allowed'}">
              ${level>=RETIRE_LEVEL?'🎉 Emekliliğe Başvur':'🔒 Level '+RETIRE_LEVEL+' Gerekli'}
            </button>`}
        `)}

        ${_M.card('💼 İşsizlik Maaşı', `
          <div style="display:flex;justify-content:space-between;background:#080d1a;border-radius:8px;padding:12px;margin-bottom:10px">
            <span style="color:#94a3b8;font-size:12px">Haftalık İşsizlik Maaşı</span>
            <span style="color:#60a5fa;font-weight:700">${_M.fmt(Math.floor(minWage*0.40))}</span>
          </div>
          <div style="font-size:11px;color:#64748b;margin-bottom:10px">Aktif işletmesi olmayan oyuncular haftada bir başvurabilir.</div>
          <button onclick="GZX_G02_applyUnemployment('${uid}').then(()=>renderSGK())"
            style="width:100%;background:#3b82f6;color:white;border:none;border-radius:10px;padding:12px;font-weight:700;cursor:pointer">
            💰 İşsizlik Maaşı Başvurusu
          </button>
        `)}

        ${_M.card('🏥 Sağlık Sigortası', `
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
            <div>
              <div style="font-size:14px;font-weight:700;color:#e2e8f0">Sağlık Güvencesi</div>
              <div style="font-size:12px;color:#94a3b8;margin-top:2px">Hastane masraflarının %80'i karşılanır</div>
            </div>
            <div style="font-size:24px;color:${d.hasSaglikSig?'#22c55e':'#ef4444'}">${d.hasSaglikSig?'✅':'❌'}</div>
          </div>
          <div style="display:flex;justify-content:space-between;background:#080d1a;border-radius:8px;padding:10px;margin-bottom:10px;font-size:12px">
            <span style="color:#94a3b8">Aylık Prim</span>
            <span style="color:#e2e8f0;font-weight:700">${_M.fmt(Math.ceil(minWage * sgkRate * 0.5))}</span>
          </div>
          <button onclick="GZX_G05_healthInsurance('${uid}').then(()=>renderSGK())"
            style="width:100%;background:${d.hasSaglikSig?'#22c55e22':'#22c55e'};color:${d.hasSaglikSig?'#22c55e':'white'};border:${d.hasSaglikSig?'1px solid #22c55e44':'none'};border-radius:10px;padding:12px;font-weight:700;cursor:pointer">
            ${d.hasSaglikSig?'✅ Sigortalısınız':'🏥 Sigorta Yaptır'}
          </button>
        `)}

        ${_M.card('📊 SGK Bilgileri', `
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px">
            <div style="background:#080d1a;border-radius:8px;padding:10px">
              <div style="color:#64748b;font-size:10px">SGK PRİM ORANI</div>
              <div style="font-weight:700;font-size:16px;color:#60a5fa">%${(sgkRate*100).toFixed(1)}</div>
            </div>
            <div style="background:#080d1a;border-radius:8px;padding:10px">
              <div style="color:#64748b;font-size:10px">ASGARİ ÜCRET</div>
              <div style="font-weight:700;font-size:16px;color:#22c55e">${_M.fmt(minWage)}</div>
            </div>
          </div>
        `)}

      </div>
    </div>`;
}
window.renderSGK = renderSGK;

/* ══════════════════════════════════════════════════════════════════
   BORSA PANELİ
   ══════════════════════════════════════════════════════════════════ */
async function renderBorsa() {
  const main = _M.main(); if (!main) return;
  const uid  = _M.uid();  if (!uid)  return;

  const symbols = ['GZTEC','GZFIN','GZINŞ','GZGDA','GZENE'];
  const prices  = {};
  const holdings = await _M.dbg(`stocks/holdings/${uid}`) || {};

  for (const s of symbols) {
    const p = await _M.dbg(`stocks/prices/${s}`);
    prices[s] = p || { current: {GZTEC:142,GZFIN:89,GZINŞ:55,GZGDA:38,GZENE:210}[s]||100, changePct:0 };
  }

  const portfolioValue = symbols.reduce((sum, s) => sum + (holdings[s]||0) * (prices[s].current||100), 0);

  main.innerHTML = `
    <div style="padding:0 0 80px">
      ${_M.pageTitle('📊', 'Borsa', 'GameZone Menkul Kıymetler')}
      <div style="padding:0 16px">

        <div style="background:linear-gradient(135deg,#0b1931,#1a3a6b);border-radius:12px;padding:16px;margin-bottom:16px">
          <div style="font-size:11px;color:#64748b;margin-bottom:4px">PORTFÖY DEĞERİ</div>
          <div style="font-size:28px;font-weight:900;color:#e2e8f0">${_M.fmt(portfolioValue)}</div>
          <div style="display:flex;gap:12px;margin-top:8px;font-size:11px">
            <span style="color:#64748b">${Object.keys(holdings).filter(k=>holdings[k]>0).length} hisse</span>
            <span style="color:#64748b">|</span>
            <span style="color:#60a5fa">Market saati: <span style="color:#22c55e">● Açık</span></span>
          </div>
        </div>

        <!-- Hisse Listesi -->
        ${symbols.map(sym => {
          const p = prices[sym];
          const held = holdings[sym] || 0;
          const chg = p.changePct || 0;
          const isUp = chg >= 0;
          const names = {GZTEC:'GZ Teknoloji',GZFIN:'GZ Finans',GZINŞ:'GZ İnşaat',GZGDA:'GZ Gıda',GZENE:'GZ Enerji'};
          return `
            <div style="background:#0d1829;border:1px solid #1e3a5f;border-radius:12px;padding:14px;margin-bottom:10px">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">
                <div>
                  <div style="font-size:15px;font-weight:800;color:#e2e8f0">${sym}</div>
                  <div style="font-size:11px;color:#64748b">${names[sym]||sym}</div>
                  ${held > 0 ? `<div style="font-size:10px;color:#a855f7;margin-top:2px">${held} adet — ${_M.fmt(held*(p.current||100))}</div>` : ''}
                </div>
                <div style="text-align:right">
                  <div style="font-size:20px;font-weight:900;color:#e2e8f0">${_M.fmt(p.current||100)}</div>
                  <div style="font-size:12px;font-weight:700;color:${isUp?'#22c55e':'#ef4444'}">${isUp?'▲':'▼'} %${Math.abs(chg).toFixed(2)}</div>
                </div>
              </div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
                <div style="display:flex;gap:4px;align-items:center">
                  <input id="qty_${sym}" type="number" min="1" placeholder="Adet"
                    style="flex:1;padding:8px;background:#080d1a;border:1px solid #1e3a5f;border-radius:8px;color:#e2e8f0;font-size:12px">
                </div>
                <div style="display:flex;gap:6px">
                  <button onclick="(async()=>{const q=parseInt(document.getElementById('qty_${sym}').value)||1;await GZX_C12_buyStock('${uid}','${sym}',q);renderBorsa();})()"
                    style="flex:1;background:#22c55e;color:white;border:none;border-radius:8px;padding:8px;font-weight:700;cursor:pointer;font-size:12px">AL</button>
                  <button onclick="(async()=>{const q=parseInt(document.getElementById('qty_${sym}').value)||1;await GZX_C13_sellStock('${uid}','${sym}',q);renderBorsa();})()"
                    style="flex:1;background:#ef4444;color:white;border:none;border-radius:8px;padding:8px;font-weight:700;cursor:pointer;font-size:12px">SAT</button>
                </div>
              </div>
            </div>`;
        }).join('')}

        ${_M.card('⚡ Kaldıraçlı İşlem', `
          <div style="font-size:12px;color:#ef4444;margin-bottom:12px">⚠️ Yüksek risk! Paranızı kaybedebilirsiniz.</div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:10px">
            <select id="levSym" style="grid-column:1/-1;padding:10px;background:#080d1a;border:1px solid #1e3a5f;border-radius:8px;color:#e2e8f0;font-size:12px">
              ${symbols.map(s=>`<option value="${s}">${s}</option>`).join('')}
            </select>
            <select id="levDir" style="padding:10px;background:#080d1a;border:1px solid #1e3a5f;border-radius:8px;color:#e2e8f0;font-size:12px">
              <option value="long">📈 Long</option>
              <option value="short">📉 Short</option>
            </select>
            <select id="levX" style="padding:10px;background:#080d1a;border:1px solid #1e3a5f;border-radius:8px;color:#e2e8f0;font-size:12px">
              ${[2,5,10,25,50,100].map(x=>`<option value="${x}">${x}x</option>`).join('')}
            </select>
            <input id="levMargin" type="number" placeholder="Marjin (₺)" style="grid-column:1/-1;padding:10px;background:#080d1a;border:1px solid #1e3a5f;border-radius:8px;color:#e2e8f0;font-size:12px">
          </div>
          <button onclick="(async()=>{const s=document.getElementById('levSym').value;const d=document.getElementById('levDir').value;const l=parseInt(document.getElementById('levX').value);const m=parseInt(document.getElementById('levMargin').value);await GZX_C07_openLeverage('${uid}',s,d,l,m);renderBorsa();})()"
            style="width:100%;background:#ef4444;color:white;border:none;border-radius:10px;padding:12px;font-weight:700;cursor:pointer">
            ⚡ Pozisyon Aç
          </button>
        `)}

      </div>
    </div>`;
}
window.renderBorsa = renderBorsa;

/* ══════════════════════════════════════════════════════════════════
   EMLAK PANELİ
   ══════════════════════════════════════════════════════════════════ */
async function renderEmlak() {
  const main = _M.main(); if (!main) return;
  const uid  = _M.uid();  if (!uid)  return;
  const d    = await _M.dbg(`users/${uid}`) || {};
  const myProps = Object.keys(d.mulkler || {});
  const propDetails = [];
  for (const pid of myProps.slice(0, 10)) {
    const p = await _M.dbg(`properties/${pid}`);
    if (p) propDetails.push({ id: pid, ...p });
  }

  const LISTINGS = [
    { name:'İstanbul Dairesi', type:'konut', region:'merkez', price:2500000, m2:120 },
    { name:'Ankara Ofisi',     type:'ofis',  region:'avrupa', price:1800000, m2:200 },
    { name:'İzmir Dükkanı',   type:'dukkan', region:'cevre', price:800000,  m2:80 },
    { name:'Kocaeli Fabrikası',type:'fabrika',region:'cevre',price:5000000, m2:500 },
    { name:'Bodrum Arsası',   type:'arazi',  region:'koy',   price:500000,  m2:1000},
  ];

  main.innerHTML = `
    <div style="padding:0 0 80px">
      ${_M.pageTitle('🏘️', 'Gayrimenkul', 'Emlak Alım Satım')}
      <div style="padding:0 16px">

        ${propDetails.length > 0 ? _M.card('🏠 Mülklerim', `
          ${propDetails.map(p => {
            const months = Math.floor((Date.now() - (p.boughtAt||Date.now())) / 2592000000);
            const curVal = typeof GZX_D06_getPropertyValue === 'function'
              ? GZX_D06_getPropertyValue(p.purchasePrice||0, p.region||'cevre', months)
              : p.purchasePrice;
            const gain = curVal - (p.purchasePrice||0);
            return `
              <div style="padding:12px 0;border-bottom:1px solid #0f1e33">
                <div style="display:flex;justify-content:space-between;align-items:flex-start">
                  <div>
                    <div style="font-size:13px;font-weight:700;color:#e2e8f0">${p.name||'Mülk'}</div>
                    <div style="font-size:11px;color:#64748b">${p.type||'konut'} · ${p.region||'—'} · ${p.m2||0}m²</div>
                    ${p.isRented ? `<div style="font-size:11px;color:#22c55e">Kira: ${_M.fmt(p.monthlyRent||0)}/ay</div>` : ''}
                  </div>
                  <div style="text-align:right">
                    <div style="font-size:13px;font-weight:700;color:#e2e8f0">${_M.fmt(curVal)}</div>
                    <div style="font-size:11px;color:${gain>=0?'#22c55e':'#ef4444'}">${gain>=0?'+':''} ${_M.fmt(gain)}</div>
                  </div>
                </div>
                <div style="display:flex;gap:6px;margin-top:8px">
                  <button onclick="toast('Tapu harcı: ${typeof GZX_D01_calcTapuHarci==='function'?GZX_D01_calcTapuHarci(p.purchasePrice,p.type):'?'}₺','info')"
                    style="flex:1;background:#3b82f622;color:#3b82f6;border:1px solid #3b82f644;border-radius:6px;padding:6px;font-size:11px;font-weight:700;cursor:pointer">📋 Detay</button>
                  ${!p.isRented ? `<button onclick="(async()=>{const r=parseInt(prompt('Aylık kira (₺)?'));if(r){await GZX_D14_leaseContract('${uid}','${p.id}',prompt('Kiracı UID?')||'',r);renderEmlak();}})()" style="flex:1;background:#22c55e22;color:#22c55e;border:1px solid #22c55e44;border-radius:6px;padding:6px;font-size:11px;font-weight:700;cursor:pointer">🏠 Kiraya Ver</button>` : ''}
                </div>
              </div>`;
          }).join('')}
        `) : _M.card('🏘️ Mülk Yok', `
          <div style="text-align:center;padding:16px;color:#64748b">Henüz mülk sahibi değilsiniz.</div>
        `)}

        ${_M.card('🏬 Satılık İlanlar', `
          ${LISTINGS.map((l, i) => {
            const tapuHarci = typeof GZX_D01_calcTapuHarci === 'function' ? GZX_D01_calcTapuHarci(l.price, l.type) : Math.ceil(l.price * 0.04);
            const icons = {konut:'🏠',ofis:'🏢',dukkan:'🏪',fabrika:'🏭',arazi:'🌿'};
            return `
              <div style="padding:12px 0;border-bottom:1px solid #0f1e33">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
                  <div>
                    <div style="font-size:13px;font-weight:700;color:#e2e8f0">${icons[l.type]||'🏠'} ${l.name}</div>
                    <div style="font-size:11px;color:#64748b">${l.m2}m² · ${l.region} bölge</div>
                    <div style="font-size:10px;color:#94a3b8;margin-top:2px">Tapu harcı: ${_M.fmt(tapuHarci)}</div>
                  </div>
                  <div style="text-align:right">
                    <div style="font-size:15px;font-weight:900;color:#e2e8f0">${_M.fmt(l.price)}</div>
                    <div style="font-size:10px;color:#64748b">+ ${_M.fmt(tapuHarci)} tapu</div>
                  </div>
                </div>
                <button onclick="GZX_D05_buyProperty('${uid}',${JSON.stringify(l)}).then(()=>renderEmlak())"
                  style="width:100%;background:#3b82f6;color:white;border:none;border-radius:8px;padding:10px;font-weight:700;cursor:pointer;font-size:12px">
                  🏠 Satın Al (Toplam: ${_M.fmt(l.price + tapuHarci)})
                </button>
              </div>`;
          }).join('')}
        `)}

        ${_M.card('📋 DASK Hesaplama', `
          <div style="font-size:12px;color:#94a3b8;margin-bottom:10px">Deprem sigortası priminizi hesaplayın:</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            ${_M.input('daskM2', 'Alan (m²)', 'number')}
            ${_M.input('daskYear', 'Yapı yılı', 'number')}
          </div>
          <button onclick="(async()=>{const m=parseInt(document.getElementById('daskM2').value)||100;const y=parseInt(document.getElementById('daskYear').value)||2000;const prim=GZX_D10_getDASKPremium(m,'merkez',y);toast('DASK Primi: ${_M.fmt(0)} — Hesaplandı: '+prim+'₺','info');})()"
            style="width:100%;background:#eab308;color:#000;border:none;border-radius:10px;padding:12px;font-weight:700;cursor:pointer">
            🧮 DASK Hesapla
          </button>
        `)}

      </div>
    </div>`;
}
window.renderEmlak = renderEmlak;

/* ══════════════════════════════════════════════════════════════════
   KARA BORSA PANELİ
   ══════════════════════════════════════════════════════════════════ */
async function renderKaraborsa() {
  const main = _M.main(); if (!main) return;
  const uid  = _M.uid();  if (!uid)  return;
  const d    = await _M.dbg(`users/${uid}`) || {};
  if ((d.level||1) < 15) {
    main.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:60vh;padding:32px;text-align:center">
      <div style="font-size:64px;margin-bottom:16px">🕶️</div>
      <div style="font-size:18px;font-weight:900;color:#e2e8f0">Kara Borsa</div>
      <div style="font-size:13px;color:#64748b;margin:12px 0">Bu alan Level 15+ oyuncular içindir.</div>
      <div style="background:#0d1829;border:1px solid #1e3a5f;border-radius:10px;padding:12px;font-size:13px;color:#94a3b8">Mevcut Level: <b>${d.level||1}</b> / <b>15</b></div>
    </div>`; return;
  }
  const items = await _M.dbg('karaMarket') || {};
  const itemList = Object.entries(items).filter(([,i])=>i.active).slice(0,10);

  main.innerHTML = `
    <div style="padding:0 0 80px">
      <div style="padding:20px 16px 8px;display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-size:22px;font-weight:900;color:#e2e8f0">🕶️ Kara Borsa</div>
          <div style="font-size:12px;color:#ef4444;margin-top:4px">⚠️ Yakalanma riski var. Herşey kayıt dışıdır.</div>
        </div>
        ${_M.badge('Gizli', '#ef4444')}
      </div>
      <div style="padding:0 16px">

        ${_M.card('💰 Vergi Kaçırma', `
          <div style="font-size:12px;color:#94a3b8;margin-bottom:12px">Gelirinizi gerçek değerinden düşük bildirin. Risk: %${Math.round(0.9*100)}'a kadar yakalanma!</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
            ${_M.input('kbGercekGelir', 'Gerçek gelir (₺)', 'number')}
            ${_M.input('kbBildirilenGelir', 'Bildirilen gelir (₺)', 'number')}
          </div>
          <button onclick="(async()=>{const g=parseInt(document.getElementById('kbGercekGelir').value)||0;const b=parseInt(document.getElementById('kbBildirilenGelir').value)||0;if(b>g){toast('Bildirilen gerçekten fazla olamaz','error');return;}const r=await GZX_K01_evadeTax('${uid}',g,b);renderKaraborsa();})()"
            style="width:100%;background:#ef4444;color:white;border:none;border-radius:10px;padding:12px;font-weight:700;cursor:pointer">
            💸 Vergi Kaçır (Riskli!)
          </button>
        `)}

        ${_M.card('📦 Kaçak Ürün Sat', `
          <div style="font-size:12px;color:#94a3b8;margin-bottom:10px">Gümrüksüz ürünler. Kara borsa fiyatı %40 fazla ama %25 yakalanma riski.</div>
          <select id="kbUrun" style="width:100%;padding:10px;background:#080d1a;border:1px solid #1e3a5f;border-radius:8px;color:#e2e8f0;margin-bottom:8px">
            <option value="altin">🥇 Altın</option>
            <option value="telefon">📱 Kaçak Telefon</option>
            <option value="sigara">🚬 Sigara</option>
            <option value="akaryakit">⛽ Kaçak Akaryakıt</option>
          </select>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            ${_M.input('kbAdet', 'Adet', 'number')}
            ${_M.input('kbFiyat', 'Birim fiyat (₺)', 'number')}
          </div>
          <button onclick="(async()=>{const u=document.getElementById('kbUrun').value;const a=parseInt(document.getElementById('kbAdet').value)||1;const f=parseInt(document.getElementById('kbFiyat').value)||100;const r=await GZX_K02_smuggleGoods('${uid}',u,a,f);renderKaraborsa();})()"
            style="width:100%;background:#7c3aed;color:white;border:none;border-radius:10px;padding:12px;font-weight:700;cursor:pointer">
            🕶️ Kaçak Sat
          </button>
        `)}

        ${_M.card('🛒 Kara Market İlanları', `
          ${itemList.length ? itemList.map(([id, item]) => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid #0f1e33">
              <div>
                <div style="font-size:12px;font-weight:700;color:#e2e8f0">${item.product}</div>
                <div style="font-size:10px;color:#64748b">${item.quantity} adet · ${item.seller?.slice(0,8) || 'Anonim'}</div>
              </div>
              <div style="text-align:right">
                <div style="font-size:13px;font-weight:700;color:#ef4444">${_M.fmt(item.price)}</div>
                <button onclick="toast('Satın alma: geliştiriliyor...','info')"
                  style="background:#ef444422;color:#ef4444;border:none;border-radius:6px;padding:4px 8px;font-size:10px;font-weight:700;cursor:pointer;margin-top:4px">Al</button>
              </div>
            </div>`) .join('')
            : '<div style="text-align:center;padding:16px;color:#475569;font-size:12px">Kara markette ürün yok</div>'}
          <button onclick="(async()=>{const u=prompt('Ürün?');const a=parseInt(prompt('Adet?'))||1;const f=parseInt(prompt('Fiyat (₺)?'))||100;await GZX_K04_listOnBlackMarket('${uid}',u,a,f);renderKaraborsa();})()"
            style="width:100%;background:rgba(255,255,255,.05);color:#94a3b8;border:1px solid #1e3a5f;border-radius:10px;padding:10px;font-weight:600;font-size:12px;cursor:pointer;margin-top:8px">
            + Kara Markete Ekle
          </button>
        `)}

      </div>
    </div>`;
}
window.renderKaraborsa = renderKaraborsa;

/* ══════════════════════════════════════════════════════════════════
   SEÇİM & PARTİ PANELİ
   ══════════════════════════════════════════════════════════════════ */
async function renderSecim() {
  const main = _M.main(); if (!main) return;
  const uid  = _M.uid();  if (!uid)  return;
  const d    = await _M.dbg(`users/${uid}`) || {};
  const parties = await _M.dbg('parties') || {};
  const elections = await _M.dbg('elections') || {};
  const activeElecs = Object.entries(elections).filter(([,e])=>e.status==='active');

  main.innerHTML = `
    <div style="padding:0 0 80px">
      ${_M.pageTitle('🗳️', 'Siyasi Arena', d.party ? `Parti: ${d.party}` : 'Bağımsız')}
      <div style="padding:0 16px">

        ${d.party ? _M.card('🏛️ Partiniz', `
          <div style="font-size:18px;font-weight:900;color:#60a5fa;margin-bottom:4px">${d.party}</div>
          <div style="font-size:12px;color:#94a3b8">Rol: ${d.partyRole||'Üye'}</div>
        `) : _M.card('🏛️ Parti Kur', `
          <div style="font-size:12px;color:#94a3b8;margin-bottom:12px">Parti kurmak için 100.000₺ gereklidir.</div>
          ${_M.input('partiAdi', 'Parti adı', 'text')}
          <select id="partiIdeoloji" style="width:100%;padding:10px;background:#080d1a;border:1px solid #1e3a5f;border-radius:8px;color:#e2e8f0;margin-bottom:10px;font-size:13px">
            <option>Milliyetçi</option><option>Liberal</option><option>Sosyal Demokrat</option>
            <option>Muhafazakâr</option><option>Yeşil</option><option>Popülist</option>
          </select>
          <button onclick="(async()=>{const n=document.getElementById('partiAdi').value;const i=document.getElementById('partiIdeoloji').value;await GZX_S01_createParty('${uid}',n,i,'🏛️');renderSecim();})()"
            style="width:100%;background:#3b82f6;color:white;border:none;border-radius:10px;padding:12px;font-weight:700;cursor:pointer">
            🏛️ Partiyi Kur (100.000₺)
          </button>
        `)}

        ${activeElecs.length > 0 ? _M.card('🗳️ Aktif Seçimler', `
          ${activeElecs.map(([id, e]) => {
            const voted = e.votes?.[uid];
            const remaining = Math.max(0, Math.ceil((e.endsAt - Date.now()) / 3600000));
            return `
              <div style="padding:12px 0;border-bottom:1px solid #0f1e33">
                <div style="display:flex;justify-content:space-between;align-items:center">
                  <div>
                    <div style="font-size:13px;font-weight:700;color:#e2e8f0">${e.type} Seçimi</div>
                    <div style="font-size:11px;color:#64748b">${e.province||'Genel'} · ${remaining} saat kaldı</div>
                  </div>
                  ${_M.badge(voted ? '✅ Oy Kullandınız' : '🗳️ Oy Ver', voted ? '#22c55e' : '#3b82f6')}
                </div>
                ${!voted ? `
                  <div style="margin-top:10px">
                    ${_M.input(`oyAday_${id}`, 'Aday UID', 'text')}
                    <button onclick="GZX_S03_castVote('${uid}','${id}',document.getElementById('oyAday_${id}').value).then(()=>renderSecim())"
                      style="width:100%;background:#3b82f6;color:white;border:none;border-radius:8px;padding:10px;font-weight:700;cursor:pointer;font-size:12px">
                      ✅ Oyu Kullan
                    </button>
                  </div>` : ''}
              </div>`;
          }).join('')}
        `) : _M.card('🗳️ Seçimler', `
          <div style="text-align:center;padding:16px;color:#64748b;font-size:12px">Şu an aktif seçim yok.<br>Admin bir seçim başlattığında burada göreceksiniz.</div>
        `)}

        ${_M.card('🏟️ Partiler', `
          ${Object.entries(parties).slice(0,5).map(([key, p]) => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid #0f1e33">
              <div>
                <div style="font-size:13px;font-weight:700;color:#e2e8f0">${p.logo||'🏛️'} ${p.name}</div>
                <div style="font-size:11px;color:#64748b">${p.ideology||'—'} · ${Object.keys(p.members||{}).length} üye</div>
              </div>
              ${!d.party ? `
                <button onclick="(async()=>{await dbUpdate('users/${uid}',{party:'${p.name}',partyRole:'üye'});await dbUpdate('parties/${key}/members',{'${uid}':'üye'});toast('✅ Partiye katıldınız','success');renderSecim();})()"
                  style="background:#3b82f622;color:#3b82f6;border:1px solid #3b82f644;border-radius:6px;padding:5px 10px;font-size:11px;font-weight:700;cursor:pointer">
                  Katıl
                </button>` : ''}
            </div>`).join('') || '<div style="color:#475569;text-align:center;padding:16px;font-size:12px">Henüz parti yok</div>'}
        `)}

      </div>
    </div>`;
}
window.renderSecim = renderSecim;

/* ══════════════════════════════════════════════════════════════════
   BAŞBAKANLIK / CUMHURBAŞKANLIĞı
   ══════════════════════════════════════════════════════════════════ */
async function renderBasbakanlik() {
  const main = _M.main(); if (!main) return;
  const uid  = _M.uid();  if (!uid)  return;
  const d    = await _M.dbg(`users/${uid}`) || {};
  const isPresident = (await _M.dbg('system/president')) === uid;
  const isFounder   = d.isFounder;

  if (!isPresident && !isFounder) {
    main.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:60vh;padding:32px;text-align:center">
      <div style="font-size:64px;margin-bottom:16px">🏛️</div>
      <div style="font-size:18px;font-weight:900;color:#e2e8f0">Yetki Gerekli</div>
      <div style="font-size:13px;color:#64748b;margin-top:8px">Bu panel yalnızca Cumhurbaşkanı ve sistem kurucuları içindir.</div>
    </div>`;
    return;
  }

  const kdv = (await _M.dbg('system/kdv')) || 0.20;
  const minWage = (await _M.dbg('system/minWage')) || 17002;
  const repoRate = (await _M.dbg('bank/repoRate')) || 0.42;
  const hazine = (await _M.dbg('system/hazine')) || 0;
  const exportTax = (await _M.dbg('system/trade/exportTaxRate')) || 0.08;

  main.innerHTML = `
    <div style="padding:0 0 80px">
      ${_M.pageTitle('🏛️', 'Yönetim Merkezi', isFounder ? '⚡ Kurucu Yetkileri' : '🇹🇷 Cumhurbaşkanlığı')}
      <div style="padding:0 16px">

        <!-- Ekonomi özeti -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px">
          <div style="background:#0d1829;border:1px solid #1e3a5f;border-radius:12px;padding:14px;text-align:center">
            <div style="font-size:10px;color:#64748b;margin-bottom:4px">HAZİNE</div>
            <div style="font-size:18px;font-weight:900;color:#22c55e">${_M.fmt(hazine)}</div>
          </div>
          <div style="background:#0d1829;border:1px solid #1e3a5f;border-radius:12px;padding:14px;text-align:center">
            <div style="font-size:10px;color:#64748b;margin-bottom:4px">REPO FAİZİ</div>
            <div style="font-size:18px;font-weight:900;color:#60a5fa">%${(repoRate*100).toFixed(1)}</div>
          </div>
        </div>

        ${_M.card('📊 Ekonomi Kontrolleri', `
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
            <div>
              <label style="font-size:11px;color:#94a3b8">KDV Oranı (%)</label>
              <input id="ykKDV" type="number" step="1" min="1" max="40" value="${(kdv*100).toFixed(0)}"
                style="width:100%;padding:10px;background:#080d1a;border:1px solid #1e3a5f;border-radius:8px;color:#e2e8f0;font-size:13px;box-sizing:border-box;margin-top:4px">
            </div>
            <div>
              <label style="font-size:11px;color:#94a3b8">Repo Faizi (%)</label>
              <input id="ykRepo" type="number" step="0.5" min="5" max="100" value="${(repoRate*100).toFixed(1)}"
                style="width:100%;padding:10px;background:#080d1a;border:1px solid #1e3a5f;border-radius:8px;color:#e2e8f0;font-size:13px;box-sizing:border-box;margin-top:4px">
            </div>
            <div>
              <label style="font-size:11px;color:#94a3b8">Asgari Ücret (₺)</label>
              <input id="ykMinWage" type="number" value="${minWage}"
                style="width:100%;padding:10px;background:#080d1a;border:1px solid #1e3a5f;border-radius:8px;color:#e2e8f0;font-size:13px;box-sizing:border-box;margin-top:4px">
            </div>
            <div>
              <label style="font-size:11px;color:#94a3b8">İhracat Vergisi (%)</label>
              <input id="ykExTax" type="number" step="1" min="0" max="50" value="${(exportTax*100).toFixed(0)}"
                style="width:100%;padding:10px;background:#080d1a;border:1px solid #1e3a5f;border-radius:8px;color:#e2e8f0;font-size:13px;box-sizing:border-box;margin-top:4px">
            </div>
          </div>
          <button onclick="(async()=>{
            const kdv=parseInt(document.getElementById('ykKDV').value)/100;
            const repo=parseInt(document.getElementById('ykRepo').value)/100;
            const wage=parseInt(document.getElementById('ykMinWage').value);
            const exTax=parseInt(document.getElementById('ykExTax').value)/100;
            await GZX_E22_taxLawChange(kdv);
            await GZX_B12_setRepoRate(repo);
            await GZX_E02_setMinWage(wage);
            await dbUpdate('system/trade',{exportTaxRate:exTax});
            toast('✅ Ekonomi kararları uygulandı!','success');
          })()"
            style="width:100%;background:#3b82f6;color:white;border:none;border-radius:10px;padding:14px;font-weight:800;cursor:pointer;font-size:14px">
            💾 Kararları Uygula
          </button>
        `)}

        ${_M.card('⚡ Özel Olaylar', `
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            <button onclick="GZX_E01_updateInflation&&GZX_E01_updateInflation(parseFloat(prompt('Yeni enflasyon oranı (örn: 0.45)')))"
              style="background:#f9731622;color:#f97316;border:1px solid #f9731644;border-radius:10px;padding:12px;font-size:12px;font-weight:700;cursor:pointer">
              📊 Enflasyon Güncelle
            </button>
            <button onclick="GZX_E06_declareTaxAmnesty&&GZX_E06_declareTaxAmnesty(30,7)"
              style="background:#22c55e22;color:#22c55e;border:1px solid #22c55e44;border-radius:10px;padding:12px;font-size:12px;font-weight:700;cursor:pointer">
              🎁 Vergi Affı İlan Et
            </button>
            <button onclick="GZX_E04_triggerStrike&&GZX_E04_triggerStrike(prompt('Sektör?')||'genel',3)"
              style="background:#eab30822;color:#eab308;border:1px solid #eab30844;border-radius:10px;padding:12px;font-size:12px;font-weight:700;cursor:pointer">
              ⚠️ Grev Başlat
            </button>
            <button onclick="GZX_E09_holidayBonus&&GZX_E09_holidayBonus(parseInt(prompt('İkramiye tutarı (₺)?'))||5000)"
              style="background:#a855f722;color:#a855f7;border:1px solid #a855f744;border-radius:10px;padding:12px;font-size:12px;font-weight:700;cursor:pointer">
              🎊 Bayram İkramiyesi
            </button>
            <button onclick="GZX_E15_currencyCrisis&&GZX_E15_currencyCrisis()"
              style="background:#ef444422;color:#ef4444;border:1px solid #ef444444;border-radius:10px;padding:12px;font-size:12px;font-weight:700;cursor:pointer">
              💸 Döviz Krizi
            </button>
            <button onclick="GZX_E07_techRevolution&&GZX_E07_techRevolution('teknoloji')"
              style="background:#3b82f622;color:#3b82f6;border:1px solid #3b82f644;border-radius:10px;padding:12px;font-size:12px;font-weight:700;cursor:pointer">
              🚀 Teknoloji Devrimi
            </button>
          </div>
        `)}

        ${_M.card('📢 Resmi Gazete', `
          ${_M.input('ykGazete', 'Resmi Gazete ilanı...', 'text')}
          <button onclick="SL1_broadcastResmiGazete&&SL1_broadcastResmiGazete(document.getElementById('ykGazete').value).then(()=>toast('📰 Resmi Gazete yayınlandı','success'))"
            style="width:100%;background:#eab308;color:#000;border:none;border-radius:10px;padding:12px;font-weight:700;cursor:pointer">
            📰 Resmi Gazete'de Yayınla
          </button>
        `)}

      </div>
    </div>`;
}
window.renderBasbakanlik = renderBasbakanlik;
window.renderCumhurbaskani = renderBasbakanlik;

/* ══════════════════════════════════════════════════════════════════
   DİJİTAL CÜZDAN / PROFİL
   ══════════════════════════════════════════════════════════════════ */
async function renderCuzdan() {
  const main = _M.main(); if (!main) return;
  const uid  = _M.uid();  if (!uid)  return;
  const d    = await _M.dbg(`users/${uid}`) || {};
  const level = d.level || 1;
  const rank  = typeof GZX_getRank === 'function' ? GZX_getRank(level) : '🥬 Çırak';
  const energy = d.energy ?? 100;
  const xp    = d.xp || 0;
  const xpReq = typeof GZX_xpRequired === 'function' ? GZX_xpRequired(level + 1) : 1000;
  const xpPct = Math.min(100, Math.round((xp / Math.max(1, typeof GZX_totalXP === 'function' ? GZX_totalXP(level + 1) : 1000)) * 100));
  const goldPrice = (await _M.dbg('system/goldPrice')) || 2400;
  const usdRate   = (await _M.dbg('system/forexRates/USD')) || 32.5;
  const cardType  = (d.bakiye||0) > 10000000 ? 'black' : (d.bakiye||0) > 1000000 ? 'platinum' : (d.bakiye||0) > 100000 ? 'gold' : 'standard';
  const cardColors = { black:'#a21caf', platinum:'#818cf8', gold:'#eab308', standard:'#3b82f6' };
  const cardNames  = { black:'💎 BLACK CARD', platinum:'⚡ PLATİNUM', gold:'👑 GOLD CARD', standard:'💳 STANDARD' };

  main.innerHTML = `
    <div style="padding:0 0 80px">
      ${_M.pageTitle('💰', 'Dijital Cüzdan', d.username || 'Profil')}
      <div style="padding:0 16px">

        <!-- Banka Kartı -->
        <div style="background:linear-gradient(135deg,#0b1931,#1e3a6b,#0f2451);border:1px solid ${cardColors[cardType]}44;border-radius:18px;padding:22px;margin-bottom:16px;position:relative;overflow:hidden">
          <div style="position:absolute;top:16px;right:16px;width:44px;height:36px;background:${cardColors[cardType]}44;border-radius:6px;border:1px solid ${cardColors[cardType]}66"></div>
          <div style="font-size:12px;font-weight:900;letter-spacing:2px;color:${cardColors[cardType]};margin-bottom:16px">${cardNames[cardType]}</div>
          <div style="font-size:14px;font-weight:700;letter-spacing:4px;margin-bottom:16px;font-family:monospace;color:#e2e8f0">**** **** **** ${(d.kimlikKarti?.tc||'0000').slice(-4)}</div>
          <div style="display:flex;justify-content:space-between;align-items:flex-end">
            <div>
              <div style="font-size:9px;color:#64748b;letter-spacing:1px">KART SAHİBİ</div>
              <div style="font-size:13px;font-weight:700">${(d.username||'OYUNCU').toUpperCase()}</div>
            </div>
            <div style="text-align:right">
              <div style="font-size:9px;color:#64748b;letter-spacing:1px">BAKİYE</div>
              <div style="font-size:20px;font-weight:900;color:${cardColors[cardType]}">${_M.fmt(d.bakiye||0)}</div>
            </div>
          </div>
        </div>

        <!-- XP & Enerji -->
        <div style="background:#0d1829;border:1px solid #1e3a5f;border-radius:12px;padding:14px;margin-bottom:12px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
            <div style="font-size:13px;font-weight:800;color:#e2e8f0">⚡ Level ${level} — ${rank}</div>
            <div style="font-size:12px;color:#64748b">${xp.toLocaleString('tr-TR')} XP</div>
          </div>
          <div style="background:#1e3a5f;border-radius:999px;height:8px;overflow:hidden;margin-bottom:6px">
            <div style="width:${xpPct}%;height:100%;background:#3b82f6;border-radius:999px"></div>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:10px;color:#64748b;margin-bottom:10px">
            <span>XP: ${xp.toLocaleString('tr-TR')}</span><span>Sonraki level: ${xpReq.toLocaleString('tr-TR')}</span>
          </div>
          <!-- Enerji -->
          <div style="display:flex;align-items:center;gap:8px">
            <span style="font-size:11px;color:#94a3b8">⚡ Enerji</span>
            <div style="flex:1;height:6px;background:#1e3a5f;border-radius:3px;overflow:hidden">
              <div style="width:${energy}%;height:100%;background:${energy>60?'#22c55e':energy>30?'#eab308':'#ef4444'};border-radius:3px"></div>
            </div>
            <span style="font-size:11px;color:${energy>60?'#22c55e':energy>30?'#eab308':'#ef4444'};font-weight:700">${energy}%</span>
          </div>
        </div>

        <!-- Varlıklar -->
        <div style="background:#0d1829;border:1px solid #1e3a5f;border-radius:12px;padding:14px;margin-bottom:12px">
          <div style="font-size:13px;font-weight:800;color:#e2e8f0;margin-bottom:12px">💼 Varlıklar</div>
          <div style="display:flex;flex-direction:column;gap:8px">
            <div style="display:flex;justify-content:space-between;padding:8px;background:#080d1a;border-radius:8px">
              <span style="color:#94a3b8;font-size:12px">🇹🇷 Türk Lirası</span>
              <span style="color:#e2e8f0;font-weight:700;font-size:13px">${_M.fmt(d.bakiye||0)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;padding:8px;background:#080d1a;border-radius:8px">
              <span style="color:#94a3b8;font-size:12px">🥇 Altın</span>
              <span style="color:#eab308;font-weight:700;font-size:13px">${(d.altinHesap||0).toFixed(2)}g (${_M.fmt((d.altinHesap||0)*goldPrice)})</span>
            </div>
            <div style="display:flex;justify-content:space-between;padding:8px;background:#080d1a;border-radius:8px">
              <span style="color:#94a3b8;font-size:12px">💵 Dolar karşılığı</span>
              <span style="color:#22c55e;font-weight:700;font-size:13px">$${((d.bakiye||0)/usdRate).toFixed(2)}</span>
            </div>
            ${Object.entries(d.crypto||{}).filter(([,v])=>v>0).slice(0,3).map(([sym,amt])=>`
              <div style="display:flex;justify-content:space-between;padding:8px;background:#080d1a;border-radius:8px">
                <span style="color:#94a3b8;font-size:12px">${sym}</span>
                <span style="color:#a855f7;font-weight:700;font-size:13px">${amt} ${sym}</span>
              </div>`).join('')}
          </div>
        </div>

        <!-- Kimlik kartı -->
        ${d.kimlikKarti ? `
          <div style="background:#0d1829;border:1px solid #1e3a5f;border-radius:12px;padding:14px;margin-bottom:12px">
            <div style="font-size:13px;font-weight:800;color:#e2e8f0;margin-bottom:10px">🪪 Kimlik Bilgileri</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px">
              <div><div style="color:#64748b;font-size:10px">TC NO</div><div style="color:#93c5fd;font-weight:700;font-family:monospace">${d.kimlikKarti.tc}</div></div>
              <div><div style="color:#64748b;font-size:10px">İL</div><div style="font-weight:700">${d.province||'—'}</div></div>
              <div><div style="color:#64748b;font-size:10px">EHLİYET</div><div style="color:${d.ehliyet?'#22c55e':'#ef4444'};font-weight:700">${d.ehliyet?'✅ Var':'❌ Yok'}</div></div>
              <div><div style="color:#64748b;font-size:10px">PASAPORT</div><div style="color:${d.pasaport?'#22c55e':'#ef4444'};font-weight:700">${d.pasaport?'✅ Var':'❌ Yok'}</div></div>
            </div>
          </div>` : `
          <div style="background:#380000;border:1px solid #ef444444;border-radius:12px;padding:14px;margin-bottom:12px;text-align:center">
            <div style="font-size:13px;color:#ef4444;font-weight:700">⚠️ Kimlik Kartı Yok</div>
            <div style="font-size:11px;color:#94a3b8;margin:6px 0">Muhtarlık sekmesinden kimlik kartı çıkartın.</div>
            <button onclick="switchTab('muhtarlik')"
              style="background:#ef4444;color:white;border:none;border-radius:8px;padding:8px 16px;font-weight:700;cursor:pointer;font-size:12px">
              🏛️ Muhtarlığa Git
            </button>
          </div>`}

        <!-- Bug Report -->
        <button onclick="GZX_openBugModal&&GZX_openBugModal()"
          style="width:100%;background:rgba(255,255,255,.04);color:#64748b;border:1px solid #1e3a5f;border-radius:10px;padding:12px;font-weight:600;font-size:12px;cursor:pointer">
          🐛 Bug Bildir (+500₺ ödül)
        </button>

      </div>
    </div>`;
}
window.renderCuzdan = renderCuzdan;
window.renderProfil = renderCuzdan;

/* ══════════════════════════════════════════════════════════════════
   KALAN EKSİK EKRANLAR (Kısa Versiyonlar)
   ══════════════════════════════════════════════════════════════════ */
function _comingSoon(icon, title, desc) {
  const main = _M.main(); if (!main) return;
  main.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:60vh;padding:32px;text-align:center">
      <div style="font-size:64px;margin-bottom:16px">${icon}</div>
      <div style="font-size:20px;font-weight:900;color:#e2e8f0;margin-bottom:8px">${title}</div>
      <div style="font-size:13px;color:#64748b">${desc}</div>
    </div>`;
}

async function renderTahvil() {
  const uid = _M.uid(); if (!uid) return;
  const main = _M.main(); if (!main) return;
  const tahviller = Object.values(await _M.dbg(`users/${uid}/tahviller`) || {});
  main.innerHTML = `
    <div style="padding:0 0 80px">
      ${_M.pageTitle('📜', 'Tahvil & Bono', 'Sabit Getirili Yatırım')}
      <div style="padding:0 16px">
        ${_M.card('📜 Yeni Tahvil İhraç Et', `
          ${_M.input('tahFace', 'Nominal değer (₺)', 'number')}
          ${_M.input('tahCoupon', 'Kupon oranı (örn: 0.25 = %25)', 'number')}
          ${_M.input('tahYears', 'Vade (yıl)', 'number')}
          <button onclick="(async()=>{const f=parseInt(document.getElementById('tahFace').value);const c=parseFloat(document.getElementById('tahCoupon').value);const y=parseInt(document.getElementById('tahYears').value);await GZX_B16_issueBond('${uid}',f,c,y);renderTahvil();})()"
            style="width:100%;background:#3b82f6;color:white;border:none;border-radius:10px;padding:12px;font-weight:700;cursor:pointer">
            📜 Tahvil İhraç Et
          </button>`)}
        ${tahviller.length ? _M.card('📋 Tahvillerim', tahviller.map(t=>`<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #0f1e33;font-size:12px"><span style="color:#e2e8f0">${_M.fmt(t.face)}</span><span style="color:#22c55e">%${((t.coupon||0)*100).toFixed(0)} · ${t.years} yıl</span></div>`).join('')) : ''}
      </div>
    </div>`;
}
window.renderTahvil = renderTahvil;

async function renderFutures() {
  const uid = _M.uid(); if (!uid) return;
  const main = _M.main(); if (!main) return;
  main.innerHTML = `
    <div style="padding:0 0 80px">
      ${_M.pageTitle('📉', 'Vadeli İşlemler', 'Kaldıraçlı Kontratlar')}
      <div style="padding:0 16px">
        ${_M.card('⚠️ Risk Uyarısı', '<div style="color:#ef4444;font-size:13px">Vadeli işlemler yüksek risk içerir. Yatırımınızı tamamen kaybedebilirsiniz.</div>')}
        ${_M.card('📉 Yeni Kontrat', `
          <select id="futSym" style="width:100%;padding:10px;background:#080d1a;border:1px solid #1e3a5f;border-radius:8px;color:#e2e8f0;margin-bottom:8px">
            <option>GZTEC</option><option>GZENE</option><option>GZFIN</option>
          </select>
          ${_M.input('futQty', 'Kontrat adedi', 'number')}
          ${_M.input('futPrice', 'Hedef fiyat (₺)', 'number')}
          <button onclick="(async()=>{const s=document.getElementById('futSym').value;const q=parseInt(document.getElementById('futQty').value);const p=parseInt(document.getElementById('futPrice').value);await GZX_C32_futures('${uid}',s,q,p);toast('📉 Vadeli kontrat oluşturuldu','success');})()"
            style="width:100%;background:#ef4444;color:white;border:none;border-radius:10px;padding:12px;font-weight:700;cursor:pointer">
            📉 Kontrat Oluştur
          </button>`)}
      </div>
    </div>`;
}
window.renderFutures = renderFutures;

function renderHedgeFon()   { _comingSoon('💹', 'Hedge Fon', 'Level 35+ gereklidir. Profesyonel fon yönetimi yakında!'); }
function renderSigorta()    { _comingSoon('🛡️', 'Sigorta', 'Mülk ve araç sigortası yakında geliyor.'); }
function renderFranchise()  { _comingSoon('🪧', 'Franchise', 'Franchise sistemi yakında geliyor.'); }
function renderArge()       { _comingSoon('🔬', 'Ar-Ge', 'Teknoloji ağacı geliştiriliyor.'); }
function renderEgitim()     { _comingSoon('🎓', 'Eğitim', 'Beceri kursları yakında geliyor.'); }
function renderSozlesme()   { _comingSoon('📝', 'Sözleşme', 'Resmi anlaşmalar yakında geliyor.'); }
function renderTicSavas()   { _comingSoon('⚔️', 'Ticaret Savaşı', 'Rakip oyuncuya ekonomik saldırı yakında!'); }
function renderDuello()     { _comingSoon('🤜', 'Düello', '1v1 ticaret arena yakında geliyor.'); }
function renderAvatar()     { _comingSoon('🎭', 'Avatar', 'Karakter özelleştirme yakında.'); }
function renderUnvan()      { _comingSoon('🎖️', 'Unvanlar', 'Kazanılan unvanlar burada görünecek.'); }
function renderSefer()      { _comingSoon('🗺️', 'Seferler', '30-60 günlük büyük görevler yakında!'); }
function renderPrestij()    { _comingSoon('⭐', 'Prestij', 'Level 100\'da yeniden başla, kalıcı bonus kazan.'); }
function renderUluslararasi(){ _comingSoon('🌍', 'Uluslararası Ticaret', '10 ülkeye ihracat. Yakında geliyor!'); }
function renderHarita()     { _comingSoon('🗺️', 'Türkiye Haritası', 'Bölge sahipliği sistemi yakında.'); }
function renderYatirim()    { _comingSoon('📈', 'Yatırım', 'Portföy yönetimi yakında geliyor.'); }

async function renderCalisan() {
  const uid = _M.uid(); if (!uid) return;
  const main = _M.main(); if (!main) return;
  const calisanlar = Object.values(await _M.dbg(`users/${uid}/calisanlar`) || {});
  main.innerHTML = `
    <div style="padding:0 0 80px">
      ${_M.pageTitle('👷', 'Çalışanlar', 'Personel Yönetimi')}
      <div style="padding:0 16px">
        ${_M.card('👷 Personel İşe Al', `
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            ${[{title:'🔧 Teknisyen',salary:15000},{title:'📦 Depocu',salary:12000},{title:'🚗 Şoför',salary:14000},{title:'📊 Muhasebeci',salary:18000}].map(r=>`
              <button onclick="(async()=>{await dbPush('users/${uid}/calisanlar',{title:'${r.title}',salary:${r.salary},hiredAt:Date.now()});toast('✅ ${r.title} işe alındı','success');renderCalisan();})()"
                style="background:#3b82f622;color:#3b82f6;border:1px solid #3b82f644;border-radius:10px;padding:12px;font-size:12px;font-weight:700;cursor:pointer;text-align:left">
                ${r.title}<br><small>${_M.fmt(r.salary)}/ay</small>
              </button>`).join('')}
          </div>`)}
        ${calisanlar.length ? _M.card('👥 Mevcut Personel', calisanlar.map(c=>`
          <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #0f1e33;font-size:12px">
            <span style="color:#e2e8f0">${c.title||'Çalışan'}</span>
            <span style="color:#22c55e;font-weight:700">${_M.fmt(c.salary||0)}/ay</span>
          </div>`).join('')) : ''}
      </div>
    </div>`;
}
window.renderCalisan = renderCalisan;

/* ══════════════════════════════════════════════════════════════════
   KONSOL MENÜSÜNE YENİ SEKMELER EKLE
   ══════════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', function () {
  setTimeout(function () {
    // Alt navigasyona Cüzdan ve Muhtarlık ekle
    const nav = document.getElementById('mainKonsol');
    if (nav && !document.getElementById('extraNav')) {
      const extras = document.createElement('div');
      extras.id = 'extraNav';
      // Mevcut REKABET kategorisine muhtarlık, polis vb. zaten var
      // Menü FAB grid'ine yeni kategoriler eklemeye gerek yok, render patch yeterli
    }
  }, 2000);
});

console.log('[ui-manager-ext.js] ✅ Tüm ekranlar yüklendi: Muhtarlık, Belediye, Polis, SGK, Borsa, Emlak, Karaborsa, Seçim, Yönetim, Cüzdan');

/* ══════════════════════════════════════════════════════════════════
   YENİ EKRANLAR — Askeriye, Mahkeme, İtfaiye, Jandarma, Sahilgüvenlik, Altin
   ══════════════════════════════════════════════════════════════════ */

async function renderAskeriye() {
  const main = _M.main(); if (!main) return;
  const uid  = _M.uid();  if (!uid)  return;
  const d    = await _M.dbg(`users/${uid}`) || {};
  const hazine = (await _M.dbg('system/hazine')) || 0;
  const savunmaBudget = (await _M.dbg('system/savunmaBudgeti')) || hazine * 0.05;
  const isAsker  = d.role === 'soldier';
  const isFounder = d.isFounder;

  main.innerHTML = `
    <div style="padding:0 0 80px">
      ${_M.pageTitle('🎖️', 'Türk Silahlı Kuvvetleri', isAsker ? '🟢 Görevdesiniz' : 'Askeri Bilgi Merkezi')}
      <div style="padding:0 16px">

        <div style="background:linear-gradient(135deg,#0a1628,#1a2d4a);border:1px solid #1e3a5f;border-radius:14px;padding:18px;margin-bottom:16px">
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;text-align:center">
            ${_M.stat('Savunma Bütçesi', _M.fmt(savunmaBudget), '#3b82f6')}
            ${_M.stat('Aktif Personel', isAsker ? '✅ Siz' : '—', isAsker ? '#22c55e' : '#475569')}
            ${_M.stat('Güvenlik Seviyesi', 'NORMAL', '#eab308')}
          </div>
        </div>

        ${_M.card('📋 Askerlik Hizmetleri', `
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            <button onclick="(async()=>{const d=await dbGet('users/${uid}');if(d.askerlikYapti){toast('Askerliğinizi zaten tamamladınız','warn');return;}await dbUpdate('users/${uid}',{askerlikYapti:true,askerlikAt:Date.now()});toast('🎖️ Askerlik tamamlandı! +500 XP','success');GZX_grantXP&&GZX_grantXP('${uid}',500,'askerlik');})()"
              style="background:#1d4ed822;color:#60a5fa;border:1px solid #1d4ed844;border-radius:10px;padding:14px;font-size:12px;font-weight:700;cursor:pointer">
              🎖️ Askerlik Yap<br><small>${d.askerlikYapti ? '✅ Tamamlandı' : 'Yapılmadı'}</small>
            </button>
            <button onclick="(async()=>{await dbUpdate('users/${uid}',{askerlikBedel:true});await GZX_safePay&&GZX_safePay('${uid}',50000,'Askerlik bedeli');toast('💸 Askerlik bedeli ödendi','success');})()"
              style="background:#eab30822;color:#eab308;border:1px solid #eab30844;border-radius:10px;padding:14px;font-size:12px;font-weight:700;cursor:pointer">
              💸 Bedel Öde<br><small>50.000₺</small>
            </button>
            <button onclick="toast('Silah ruhsatı başvurusu yapıldı. 500₺ ücret kesilecek.','info');GZX_safePay&&GZX_safePay('${uid}',500,'Silah ruhsatı başvurusu')"
              style="background:#ef444422;color:#ef4444;border:1px solid #ef444444;border-radius:10px;padding:14px;font-size:12px;font-weight:700;cursor:pointer">
              🔫 Silah Ruhsatı<br><small>500₺</small>
            </button>
            <button onclick="toast('Milis terhis belgesi: 250₺','info');GZX_safePay&&GZX_safePay('${uid}',250,'Terhis belgesi')"
              style="background:#22c55e22;color:#22c55e;border:1px solid #22c55e44;border-radius:10px;padding:14px;font-size:12px;font-weight:700;cursor:pointer">
              📄 Terhis Belgesi<br><small>250₺</small>
            </button>
          </div>
        `)}

        ${(isFounder || isAsker) ? _M.card('🚀 Komuta Merkezi', `
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            <button onclick="(async()=>{await dbUpdate('system',{securityLevel:'HIGH',since:Date.now()});toast('🔴 Güvenlik seviyesi YÜKSEK yapıldı','warn');})()"
              style="background:#ef444422;color:#ef4444;border:1px solid #ef444444;border-radius:10px;padding:12px;font-size:12px;font-weight:700;cursor:pointer">
              🔴 Güvenlik Yükselt
            </button>
            <button onclick="(async()=>{const budget=parseInt(prompt('Savunma bütçesi (₺)?')||0);if(budget>0){await dbUpdate('system',{savunmaBudgeti:budget});toast('✅ Savunma bütçesi güncellendi','success');};})()"
              style="background:#3b82f622;color:#3b82f6;border:1px solid #3b82f644;border-radius:10px;padding:12px;font-size:12px;font-weight:700;cursor:pointer">
              💰 Bütçe Ayarla
            </button>
          </div>
        `) : ''}

      </div>
    </div>`;
}
window.renderAskeriye = renderAskeriye;

async function renderMahkeme() {
  const main = _M.main(); if (!main) return;
  const uid  = _M.uid();  if (!uid)  return;
  const d    = await _M.dbg(`users/${uid}`) || {};
  const davalar = Object.values(await _M.dbg(`davalar`) || {}).filter(d2=>d2.uid===uid||d2.karsi===uid);

  main.innerHTML = `
    <div style="padding:0 0 80px">
      ${_M.pageTitle('⚖️', 'Mahkeme', 'Hukuki İşlemler')}
      <div style="padding:0 16px">

        ${_M.card('⚖️ Dava Aç', `
          <div style="font-size:12px;color:#94a3b8;margin-bottom:12px">Haksız para cezası veya işleme karşı itiraz edebilirsiniz.</div>
          ${_M.input('davaKarsi', 'Karşı taraf UID veya "Devlet"', 'text')}
          ${_M.input('davaSebep', 'Dava sebebi', 'text')}
          <select id="davaAvukat" style="width:100%;padding:10px;background:#080d1a;border:1px solid #1e3a5f;border-radius:8px;color:#e2e8f0;margin-bottom:10px">
            <option value="none">Avukatsız (Riskli)</option>
            <option value="junior">Jr. Avukat — 5.000₺</option>
            <option value="senior">Kıdemli Avukat — 25.000₺</option>
            <option value="top">Baş Avukat — 100.000₺</option>
          </select>
          <button onclick="(async()=>{
            const k=document.getElementById('davaKarsi').value;
            const s=document.getElementById('davaSebep').value;
            const av=document.getElementById('davaAvukat').value;
            const ucret={none:0,junior:5000,senior:25000,top:100000}[av]||0;
            if(ucret>0){const r=await GZX_safePay('${uid}',ucret,'Avukatlık ücreti');if(!r?.ok)return;}
            await dbPush('davalar',{uid:'${uid}',karsi:k,sebep:s,avukat:av,status:'acik',acilanAt:Date.now()});
            toast('⚖️ Dava açıldı. Admin onayı bekleniyor.','success');renderMahkeme();
          })()"
            style="width:100%;background:#7c3aed;color:white;border:none;border-radius:10px;padding:12px;font-weight:700;cursor:pointer">
            ⚖️ Davayı Aç
          </button>
        `)}

        ${davalar.length ? _M.card('📋 Davalarım', davalar.slice(-5).map(d2=>`
          <div style="padding:10px 0;border-bottom:1px solid #0f1e33">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <div>
                <div style="font-size:12px;font-weight:700;color:#e2e8f0">${d2.sebep||'Dava'}</div>
                <div style="font-size:10px;color:#64748b">Karşı taraf: ${d2.karsi||'—'} · ${new Date(d2.acilanAt||0).toLocaleDateString('tr-TR')}</div>
              </div>
              ${_M.badge(d2.status==='acik'?'⏳ Açık':d2.status==='kazanildi'?'✅ Kazanıldı':'❌ Kaybedildi',
                d2.status==='acik'?'#eab308':d2.status==='kazanildi'?'#22c55e':'#ef4444')}
            </div>
          </div>`).join('')) : ''}

      </div>
    </div>`;
}
window.renderMahkeme = renderMahkeme;

async function renderNoter() {
  const main = _M.main(); if (!main) return;
  const uid  = _M.uid();  if (!uid)  return;

  main.innerHTML = `
    <div style="padding:0 0 80px">
      ${_M.pageTitle('📜', 'Noterlik', 'Resmi Belge Onaylama')}
      <div style="padding:0 16px">

        ${_M.card('📜 Belge Tasdiki', `
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            ${[
              {label:'🤝 Kira Sözleşmesi', fee:500},
              {label:'💼 İş Sözleşmesi', fee:750},
              {label:'🏠 Tapu Devri', fee:2000},
              {label:'📋 Vekaletname', fee:1000},
              {label:'🏭 Ortaklık Sözl.', fee:3000},
              {label:'📄 Vasiyetname', fee:1500},
            ].map(b=>`
              <button onclick="(async()=>{await GZX_safePay('${uid}',${b.fee},'${b.label}');await dbPush('users/${uid}/noterBelgeleri',{type:'${b.label}',fee:${b.fee},ts:Date.now()});toast('✅ ${b.label} tasdiklendi','success');})()"
                style="background:#7c3aed22;color:#a78bfa;border:1px solid #7c3aed44;border-radius:10px;padding:12px;font-size:11px;font-weight:700;cursor:pointer;text-align:left">
                ${b.label}<br><small>${_M.fmt(b.fee)}</small>
              </button>`).join('')}
          </div>
        `)}

      </div>
    </div>`;
}
window.renderNoter = renderNoter;

async function renderItfaiye() {
  const main = _M.main(); if (!main) return;
  const uid  = _M.uid();  if (!uid)  return;

  main.innerHTML = `
    <div style="padding:0 0 80px">
      ${_M.pageTitle('🚒', 'İtfaiye', 'Yangın ve Acil Müdahale')}
      <div style="padding:0 16px">

        ${_M.card('🛡️ Yangın Sigortası', `
          <div style="font-size:12px;color:#94a3b8;margin-bottom:12px">
            İşletmeniz için yangın sigortası yaptırın. Hasar durumunda %70 karşılanır.
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            <button onclick="GZX_safePay&&GZX_safePay('${uid}',2500,'Dükkan yangın sigortası').then(r=>{if(r?.ok){dbUpdate('users/${uid}',{yangınSig:true});toast('🛡️ Yangın sigortası aktif','success');}})"
              style="background:#f9731622;color:#f97316;border:1px solid #f9731644;border-radius:10px;padding:12px;font-size:12px;font-weight:700;cursor:pointer">
              🏪 Dükkan<br><small>2.500₺/yıl</small>
            </button>
            <button onclick="GZX_safePay&&GZX_safePay('${uid}',8000,'Fabrika yangın sigortası').then(r=>{if(r?.ok){dbUpdate('users/${uid}',{fabrikaYangınSig:true});toast('🛡️ Fabrika yangın sigortası aktif','success');}})"
              style="background:#ef444422;color:#ef4444;border:1px solid #ef444444;border-radius:10px;padding:12px;font-size:12px;font-weight:700;cursor:pointer">
              🏭 Fabrika<br><small>8.000₺/yıl</small>
            </button>
          </div>
        `)}

        ${_M.card('🚒 Acil Çağrı', `
          <div style="font-size:12px;color:#94a3b8;margin-bottom:12px">
            Yangın veya acil durum bildirimi. Prim miktarınıza göre müdahale süresi değişir.
          </div>
          <button onclick="dbPush('itfaiyeCagrilari',{uid:'${uid}',ts:Date.now(),status:'bekliyor'});toast('🚒 İtfaiye çağrısı yapıldı!','warn',6000)"
            style="width:100%;background:#ef4444;color:white;border:none;border-radius:10px;padding:14px;font-weight:800;font-size:14px;cursor:pointer">
            🚨 ACİL ÇAĞRI
          </button>
        `)}

      </div>
    </div>`;
}
window.renderItfaiye = renderItfaiye;

async function renderSahilguz() {
  _comingSoon('⚓', 'Sahil Güvenlik', 'İhracat denetimi ve kaçakçılık önleme sistemi geliştiriliyor.');
}
window.renderSahilguz = renderSahilguz;

async function renderJandarma() {
  _comingSoon('🔫', 'Jandarma', 'Kırsal bölge güvenliği sistemi geliştiriliyor.');
}
window.renderJandarma = renderJandarma;

async function renderKonkurato() {
  const main = _M.main(); if (!main) return;
  const uid  = _M.uid();  if (!uid)  return;
  const d    = await _M.dbg(`users/${uid}`) || {};
  const borglar = d.borglar || 0;

  main.innerHTML = `
    <div style="padding:0 0 80px">
      ${_M.pageTitle('🚫', 'Konkordato', 'Borç Yapılandırma')}
      <div style="padding:0 16px">
        <div style="background:#380000;border:1px solid #ef444444;border-radius:12px;padding:16px;margin-bottom:16px;text-align:center">
          <div style="font-size:28px;font-weight:900;color:#ef4444">${_M.fmt(borglar)}</div>
          <div style="font-size:12px;color:#94a3b8;margin-top:4px">Toplam borç</div>
        </div>
        ${borglar > 0 ? _M.card('📋 Konkordato Başvurusu', `
          <div style="font-size:12px;color:#94a3b8;margin-bottom:12px">
            Borçlarınızı 36 ay vadeye yayabilirsiniz. Mahkeme onayı gerekir.
          </div>
          <button onclick="dbPush('konkordatoBasvurulari',{uid:'${uid}',debt:${borglar},status:'pending',ts:Date.now()});toast('📋 Konkordato başvurusu yapıldı. Admin onayı bekleniyor.','info')"
            style="width:100%;background:#7c3aed;color:white;border:none;border-radius:10px;padding:12px;font-weight:700;cursor:pointer">
            📋 Konkordato Başvur
          </button>
        `) : _M.card('✅ Borç Yok', '<div style="text-align:center;padding:16px;color:#22c55e;font-size:14px;font-weight:700">Borcunuz bulunmamaktadır.</div>')}
      </div>
    </div>`;
}
window.renderKonkurato = renderKonkurato;

async function renderAltin() {
  const main = _M.main(); if (!main) return;
  const uid  = _M.uid();  if (!uid)  return;
  const d    = await _M.dbg(`users/${uid}`) || {};
  const goldPrice = (await _M.dbg('system/goldPrice')) || 2400;
  const gold = d.altinHesap || 0;

  main.innerHTML = `
    <div style="padding:0 0 80px">
      ${_M.pageTitle('🥇', 'Altın Hesabı', 'Gram altın al/sat')}
      <div style="padding:0 16px">

        <div style="background:linear-gradient(135deg,#1a1000,#3a2200);border:1px solid #eab30844;border-radius:14px;padding:20px;margin-bottom:16px;text-align:center">
          <div style="font-size:11px;color:#92400e;letter-spacing:2px;margin-bottom:4px">ALTIN HESABINIZ</div>
          <div style="font-size:36px;font-weight:900;color:#eab308">${gold.toFixed(3)}g</div>
          <div style="font-size:14px;color:#fbbf24;margin-top:4px">${_M.fmt(gold * goldPrice)}</div>
          <div style="font-size:11px;color:#92400e;margin-top:8px">Gram: ${_M.fmt(goldPrice)}</div>
        </div>

        ${_M.card('🥇 Altın Al', `
          ${_M.input('altinAlGram', 'Gram miktarı', 'number')}
          <div style="font-size:11px;color:#64748b;margin-bottom:10px" id="altinAlFiyat">Toplam: —</div>
          <button onclick="(async()=>{
            const g=parseFloat(document.getElementById('altinAlGram').value)||0;
            if(g<=0){toast('Geçersiz miktar','error');return;}
            await GZX_B08_buyGoldAccount('${uid}',g);renderAltin();
          })()"
            style="width:100%;background:#eab308;color:#000;border:none;border-radius:10px;padding:12px;font-weight:800;cursor:pointer">
            🥇 Altın Al
          </button>
        `)}

        ${_M.card('💸 Altın Sat', `
          ${_M.input('altinSatGram', 'Gram miktarı', 'number')}
          <button onclick="(async()=>{
            const g=parseFloat(document.getElementById('altinSatGram').value)||0;
            if(g>=${gold}){toast('Yeterli altın yok','error');return;}
            await dbTransaction('users/${uid}/altinHesap',h=>Math.max(0,(h||0)-g));
            await dbTransaction('users/${uid}/bakiye',b=>(b||0)+g*${goldPrice});
            toast('💸 '+g+'g altın satıldı: '+cashFmt(g*${goldPrice}),'success');
            renderAltin();
          })()"
            style="width:100%;background:#1e3a5f;color:#94a3b8;border:1px solid #1e3a5f;border-radius:10px;padding:12px;font-weight:700;cursor:pointer">
            💸 Altın Sat
          </button>
        `)}

      </div>
    </div>`;

  // Canlı fiyat güncelleme
  const inp = document.getElementById('altinAlGram');
  const fiyatEl = document.getElementById('altinAlFiyat');
  if (inp && fiyatEl) {
    inp.addEventListener('input', () => {
      const g = parseFloat(inp.value) || 0;
      fiyatEl.textContent = 'Toplam: ' + _M.fmt(g * goldPrice);
    });
  }
}
window.renderAltin = renderAltin;

/* render() patch güncelle — yeni ekranlar */
(function patchRender2() {
  const _prev = window.render;
  window.render = function (tab) {
    const extra2 = {
      askeriye:  renderAskeriye,
      mahkeme:   renderMahkeme,
      noter:     renderNoter,
      itfaiye:   renderItfaiye,
      sahilguz:  renderSahilguz,
      jandarma:  renderJandarma,
      konkurato: renderKonkurato,
      altin:     renderAltin,
    };
    if (extra2[tab]) {
      const main = document.getElementById('appMain');
      if (main) main.innerHTML = `<div style="padding:40px;text-align:center"><div class="spinner" style="margin:0 auto"></div></div>`;
      extra2[tab]();
    } else if (_prev) {
      _prev(tab);
    }
  };
})();

console.log('[ui-manager-ext.js] ✅ Askeriye, Mahkeme, Noterlik, İtfaiye, Altın Hesabı da eklendi');

/* ============================================================================
   secim-sistemi.js — GameZone ERP: Gerçek Oyuncu Seçim Sistemi
   ============================================================================
   SEÇİM TÜRLERİ:
   - muhtar:    Mahalleye göre, her mahalle kendi muhtarını seçer
   - belediye:  İle göre (81 il), her ilin kendi belediye başkanı
   - milletvekili: Bölgesel, il bazlı
   - basbakanlik: Ulusal, tüm oyuncular oy verir
   - cumhurbaskani: Ulusal (admin onaylı)

   YETKİLER:
   - Muhtar:           Kimlik kartı ücreti, sosyal yardım onayı, mahalle duyurusu
   - Belediye Başkanı: İmar izni, ruhsat ücreti, toplu taşıma zammı, tabela vergisi
   - Başbakan:         KDV, asgari ücret, ihracat teşviki, grev kararı
   - Cumhurbaşkanı:    Tüm yetkiler + repo faizi + savaş/barış kararı
   ============================================================================ */

'use strict';

/* ══════════════════════════════════════════════════════════════
   SABİTLER
   ══════════════════════════════════════════════════════════════ */
const SECİM_CFG = {
  // Aday olma bedeli (oyun içi para)
  adaylikUcret: {
    muhtar:        5000,
    belediye:      50000,
    milletvekili:  100000,
    basbakanlik:   500000,
    cumhurbaskani: 1000000,
  },
  // Seçim süresi (saat)
  sureSaat: {
    muhtar:        48,
    belediye:      72,
    milletvekili:  72,
    basbakanlik:   96,
    cumhurbaskani: 120,
  },
  // Görev süresi (gün)
  gorevSuresi: {
    muhtar:        30,
    belediye:      60,
    milletvekili:  90,
    basbakanlik:   90,
    cumhurbaskani: 180,
  },
  // Minimum level
  minLevel: {
    muhtar:        5,
    belediye:      15,
    milletvekili:  20,
    basbakanlik:   30,
    cumhurbaskani: 50,
  },
  // Başlık & emoji
  meta: {
    muhtar:        { label: 'Muhtarlık',         icon: '🏛️', scope: 'mahalle' },
    belediye:      { label: 'Belediye Başkanlığı', icon: '🏙️', scope: 'il'      },
    milletvekili:  { label: 'Milletvekilliği',    icon: '🏛️', scope: 'il'      },
    basbakanlik:   { label: 'Başbakanlık',         icon: '🇹🇷', scope: 'ulusal'  },
    cumhurbaskani: { label: 'Cumhurbaşkanlığı',   icon: '🌟', scope: 'ulusal'  },
  },
};

const ILLER = [
  'Adana','Adıyaman','Afyonkarahisar','Ağrı','Amasya','Ankara','Antalya','Artvin',
  'Aydın','Balıkesir','Bilecik','Bingöl','Bitlis','Bolu','Burdur','Bursa','Çanakkale',
  'Çankırı','Çorum','Denizli','Diyarbakır','Edirne','Elazığ','Erzincan','Erzurum',
  'Eskişehir','Gaziantep','Giresun','Gümüşhane','Hakkari','Hatay','Isparta','Mersin',
  'İstanbul','İzmir','Kars','Kastamonu','Kayseri','Kırklareli','Kırşehir','Kocaeli',
  'Konya','Kütahya','Malatya','Manisa','Kahramanmaraş','Mardin','Muğla','Muş',
  'Nevşehir','Niğde','Ordu','Rize','Sakarya','Samsun','Siirt','Sinop','Sivas',
  'Tekirdağ','Tokat','Trabzon','Tunceli','Şanlıurfa','Uşak','Van','Yozgat','Zonguldak',
  'Aksaray','Bayburt','Karaman','Kırıkkale','Batman','Şırnak','Bartın','Ardahan',
  'Iğdır','Yalova','Karabük','Kilis','Osmaniye','Düzce'
];
window.ILLER_LIST = ILLER;

/* ══════════════════════════════════════════════════════════════
   ADAY OLMA
   ══════════════════════════════════════════════════════════════ */
window.SL_adayOl = async function(uid, secimTuru, bolge, promises) {
  const d    = await window.dbGet?.(`users/${uid}`) || {};
  const cfg  = SECİM_CFG;
  const meta = cfg.meta[secimTuru];
  if (!meta) return window.toast?.('Geçersiz seçim türü', 'error');

  // Level kontrolü
  if ((d.level || 1) < cfg.minLevel[secimTuru]) {
    window.toast?.(`❌ Minimum Level ${cfg.minLevel[secimTuru]} gerekli (Senin: ${d.level||1})`, 'error', 6000);
    return false;
  }

  // Kimlik kartı kontrolü
  if (!d.kimlikKarti) {
    window.toast?.('❌ Aday olmak için kimlik kartı gerekli', 'error');
    return false;
  }

  // Aday olma ücreti
  const ucret = cfg.adaylikUcret[secimTuru];
  const result = await window.GZX_safePay?.(uid, ucret, `Aday olma: ${meta.label}`);
  if (!result?.ok) return false;

  // Aktif seçim var mı?
  const secimRef = `secimler/${secimTuru}_${bolge.replace(/\s/g,'_')}`;
  let secim = await window.dbGet?.(secimRef);

  if (!secim || secim.status !== 'active') {
    window.toast?.('⏳ Bu bölgede aktif seçim yok. Admin seçim başlatmalı.', 'warn', 6000);
    // Ücreti iade et
    await window.dbTransaction?.(`users/${uid}/bakiye`, b => (b||0) + ucret);
    return false;
  }

  // Zaten aday mı?
  if (secim.adaylar?.[uid]) {
    window.toast?.('Zaten bu seçime adaysınız', 'warn');
    await window.dbTransaction?.(`users/${uid}/bakiye`, b => (b||0) + ucret);
    return false;
  }

  // Vaatleri sanitize et
  const temizVaatler = (promises || []).map(p => window.GZX_sanitize?.(p) || p).slice(0, 5);

  // Aday kaydı
  await window.dbUpdate?.(`${secimRef}/adaylar/${uid}`, {
    uid,
    username:  d.username || 'Bilinmiyor',
    level:     d.level || 1,
    bolge,
    vaatler:   temizVaatler,
    oy:        0,
    kayitAt:   Date.now(),
    rank:      typeof window.GZX_getRank === 'function' ? window.GZX_getRank(d.level||1) : '—',
    avatar:    d.avatar || '👤',
    province:  d.province || bolge,
    party:     d.party || 'Bağımsız',
    partyLogo: d.partyLogo || '🏛️',
  });

  // Kullanıcı profiline kaydet
  await window.dbUpdate?.(`users/${uid}`, {
    adayOlduguSecim: secimRef,
    adayOlduguTur:   secimTuru,
    adayAt:          Date.now(),
  });

  await window.dbPush?.('news', {
    title: `🗳️ Yeni Aday: ${d.username} — ${meta.label} (${bolge})`,
    type: 'election', ts: Date.now()
  });

  window.toast?.(`✅ ${meta.label} seçimine aday oldunuz! Kampanyanızı başlatın.`, 'success', 8000);
  return true;
};

/* ══════════════════════════════════════════════════════════════
   OY KULLAN
   ══════════════════════════════════════════════════════════════ */
window.SL_oyKullan = async function(secicUid, secimRef, adayUid) {
  const secim = await window.dbGet?.(secimRef);
  if (!secim || secim.status !== 'active') {
    window.toast?.('Bu seçim aktif değil', 'error'); return false;
  }
  if (Date.now() > secim.bitisAt) {
    window.toast?.('Seçim süresi doldu', 'error'); return false;
  }
  if (secim.oylar?.[secicUid]) {
    window.toast?.('Bu seçimde zaten oy kullandınız', 'warn'); return false;
  }

  const d = await window.dbGet?.(`users/${secicUid}`) || {};
  if (!d.kimlikKarti) {
    window.toast?.('Oy kullanmak için kimlik kartı gerekli', 'error'); return false;
  }

  // Oy kaydet
  await window.dbUpdate?.(`${secimRef}/oylar`, { [secicUid]: adayUid });
  await window.dbTransaction?.(`${secimRef}/adaylar/${adayUid}/oy`, v => (v||0) + 1);
  await window.dbUpdate?.(`users/${secicUid}`, {
    [`oyKullandi_${secimRef.replace(/\//g,'_')}`]: true
  });

  window.toast?.('✅ Oyunuz başarıyla kullanıldı!', 'success');
  return true;
};

/* ══════════════════════════════════════════════════════════════
   SEÇİMİ BAŞLAT (Admin)
   ══════════════════════════════════════════════════════════════ */
window.SL_secimBaslat = async function(tur, bolge, sureSaatOverride) {
  if (!window.GZ?.data?.isFounder) { window.toast?.('Yetkisiz', 'error'); return; }
  const meta = SECİM_CFG.meta[tur];
  if (!meta) return;

  const sure  = (sureSaatOverride || SECİM_CFG.sureSaat[tur]) * 3600000;
  const ref   = `secimler/${tur}_${bolge.replace(/\s/g,'_')}`;
  const mevcut = await window.dbGet?.(ref);
  if (mevcut?.status === 'active') {
    window.toast?.(`${bolge} için zaten aktif seçim var`, 'warn'); return;
  }

  await window.dbSet?.(ref, {
    tur, bolge, meta,
    status:    'active',
    baslatAt:  Date.now(),
    bitisAt:   Date.now() + sure,
    adaylar:   {},
    oylar:     {},
    kazanan:   null,
  });

  await window.dbPush?.('news', {
    title: `🗳️ ${meta.icon} ${meta.label} SEÇİMİ BAŞLADI — ${bolge} (${SECİM_CFG.sureSaat[tur]} saat)`,
    type:  'election_start',
    ts:    Date.now(),
  });

  window.toast?.(`🗳️ ${bolge} ${meta.label} seçimi başlatıldı!`, 'success', 6000);
  return ref;
};

/* ══════════════════════════════════════════════════════════════
   SEÇİMİ SONUÇLANDIR (Otomatik + Admin)
   ══════════════════════════════════════════════════════════════ */
window.SL_secimSonuclandir = async function(secimRef) {
  const secim = await window.dbGet?.(secimRef);
  if (!secim) return;
  if (secim.status === 'completed') { window.toast?.('Seçim zaten sonuçlandı', 'warn'); return; }

  const adaylar = secim.adaylar || {};
  if (!Object.keys(adaylar).length) {
    await window.dbUpdate?.(secimRef, { status: 'completed', kazanan: null, sonucAt: Date.now() });
    window.toast?.('Seçim sonuçlandı — Aday çıkmadı', 'warn');
    return;
  }

  // En fazla oyu bul
  const sirali = Object.entries(adaylar).sort(([,a],[,b]) => (b.oy||0) - (a.oy||0));
  const [kazananUid, kazananData] = sirali[0];
  const toplamOy = Object.values(adaylar).reduce((s,a) => s + (a.oy||0), 0);

  // Seçimi güncelle
  await window.dbUpdate?.(secimRef, {
    status:   'completed',
    kazanan:  kazananUid,
    sonucAt:  Date.now(),
    toplamOy,
    sonuclar: sirali.map(([uid, d2]) => ({
      uid, username: d2.username, oy: d2.oy||0,
      oran: toplamOy > 0 ? +((d2.oy||0)/toplamOy*100).toFixed(1) : 0
    }))
  });

  // Kazanana yetki ver
  await SL_yetkiVer(kazananUid, secim.tur, secim.bolge);

  // Haber
  await window.dbPush?.('news', {
    title: `🏆 ${secim.meta?.icon||'🗳️'} ${secim.meta?.label||secim.tur} SONUCU: ${kazananData.username} — ${secim.bolge} (${kazananData.oy||0} oy)`,
    type:  'election_result', ts: Date.now(),
  });

  window.toast?.(`🏆 Seçim sonuçlandı! Kazanan: ${kazananData.username}`, 'success', 8000);
  return kazananUid;
};

/* ══════════════════════════════════════════════════════════════
   YETKİ VER
   ══════════════════════════════════════════════════════════════ */
async function SL_yetkiVer(uid, tur, bolge) {
  const gorevBitisi = Date.now() + SECİM_CFG.gorevSuresi[tur] * 86400000;

  const yetkiMap = {
    muhtar:        { role: 'muhtar',    label: `${bolge} Muhtarı`,         yetki: 'muhtar'    },
    belediye:      { role: 'mayor',     label: `${bolge} Belediye Başkanı`, yetki: 'belediye'  },
    milletvekili:  { role: 'mp',        label: `${bolge} Milletvekili`,     yetki: 'meclis'    },
    basbakanlik:   { role: 'pm',        label: 'Başbakan',                  yetki: 'basbakanlik' },
    cumhurbaskani: { role: 'president', label: 'Cumhurbaşkanı',             yetki: 'cumhurbaskani' },
  };
  const yetki = yetkiMap[tur];
  if (!yetki) return;

  // Kullanıcıya yetki ata
  const updates = {
    role:         yetki.role,
    unvan:        yetki.label,
    yetki:        yetki.yetki,
    gorevBolge:   bolge,
    gorevBasladi: Date.now(),
    gorevBitisi,
  };

  if (tur === 'belediye')      updates.mayorOf       = bolge;
  if (tur === 'basbakanlik')   updates.isPM          = true;
  if (tur === 'cumhurbaskani') updates.isPresident   = true;
  if (tur === 'muhtar')        updates.muhtarOf      = bolge;

  await window.dbUpdate?.(`users/${uid}`, updates);

  // Bölge/il kaydı
  const bolgePath = bolge.replace(/\s/g,'_');
  if (tur === 'belediye') {
    await window.dbUpdate?.(`politics/${bolgePath}`, {
      belediyeBaskani:    uid,
      belediyeBaskaniAt:  Date.now(),
    });
    await window.dbSet?.(`system/mayors/${bolgePath}`, uid);
  }
  if (tur === 'muhtar') {
    await window.dbUpdate?.(`politics/${bolgePath}`, {
      muhtar:    uid,
      muhtarAt:  Date.now(),
    });
  }
  if (tur === 'basbakanlik')   await window.dbSet?.('system/pm', uid);
  if (tur === 'cumhurbaskani') await window.dbSet?.('system/president', uid);

  // Hazine bonusu
  const bonus = {muhtar:5000,belediye:50000,milletvekili:30000,basbakanlik:500000,cumhurbaskani:1000000}[tur]||0;
  if (bonus) {
    await window.dbTransaction?.(`users/${uid}/bakiye`, b => (b||0) + bonus);
    window.toast?.(`🎉 Göreve başladınız! ${window.cashFmt?.(bonus)||bonus+'₺'} maaş avansı yatırıldı.`, 'success', 8000);
  }
}
window.SL_yetkiVer = SL_yetkiVer;

/* ══════════════════════════════════════════════════════════════
   YETKİ KONTROL
   ══════════════════════════════════════════════════════════════ */
window.SL_yetkiKontrol = async function(uid, yetki, bolge) {
  const d = await window.dbGet?.(`users/${uid}`) || {};
  if (d.isFounder) return true; // Kurucu her şeyi yapabilir

  if (yetki === 'muhtar')       return d.role === 'muhtar'    && (!bolge || d.muhtarOf === bolge) && Date.now() < (d.gorevBitisi||0);
  if (yetki === 'belediye')     return d.role === 'mayor'     && (!bolge || d.mayorOf  === bolge) && Date.now() < (d.gorevBitisi||0);
  if (yetki === 'basbakanlik')  return (d.role === 'pm' || d.isPM)         && Date.now() < (d.gorevBitisi||0);
  if (yetki === 'cumhurbaskani') return (d.role === 'president' || d.isPresident) && Date.now() < (d.gorevBitisi||0);
  return false;
};

/* ══════════════════════════════════════════════════════════════
   VAAT SİSTEMİ — Aday vaatlerini takip et
   ══════════════════════════════════════════════════════════════ */
window.SL_vaatEkle = async function(adayUid, secimRef, vaat) {
  const temiz = window.GZX_sanitize?.(vaat) || vaat.slice(0, 200);
  await window.dbPush?.(`${secimRef}/adaylar/${adayUid}/vaatDetay`, {
    vaat: temiz, ts: Date.now(), gerceklesti: false
  });
  await window.dbUpdate?.(`users/${adayUid}`, {
    [`vaatler_${secimRef.replace(/\//g,'_')}`]: window.firebase?.database?.ServerValue?.increment?.(1) || 1
  });
  window.toast?.('📋 Vaat eklendi!', 'success');
};

window.SL_vaatGerceklestir = async function(secimRef, adayUid, vaatKey) {
  await window.dbUpdate?.(`${secimRef}/adaylar/${adayUid}/vaatDetay/${vaatKey}`, {
    gerceklesti: true, gerceklestiAt: Date.now()
  });
  window.toast?.('✅ Vaat gerçekleştirildi olarak işaretlendi!', 'success');
};

/* ══════════════════════════════════════════════════════════════
   MAAŞ SİSTEMİ — Seçilen oyunculara aylık maaş
   ══════════════════════════════════════════════════════════════ */
window.SL_maasOde = async function() {
  const maaslar = {
    muhtar:    10000,
    mayor:     50000,
    mp:        30000,
    pm:        200000,
    president: 500000,
  };

  const users = await window.dbGet?.('users') || {};
  let toplamOdenen = 0;
  const gorevliler = Object.entries(users).filter(([,u]) =>
    u.role && maaslar[u.role] && u.gorevBitisi && Date.now() < u.gorevBitisi
  );

  for (const [uid, u] of gorevliler) {
    const maas = maaslar[u.role] || 0;
    if (!maas) continue;
    const hazine = (await window.dbGet?.('system/hazine')) || 0;
    if (hazine < maas) continue;
    await window.dbTransaction?.(`users/${uid}/bakiye`, b => (b||0) + maas);
    await window.dbTransaction?.('system/hazine', h => Math.max(0, (h||0) - maas));
    toplamOdenen += maas;
  }

  return { gorevli: gorevliler.length, toplamOdenen };
};

/* ══════════════════════════════════════════════════════════════
   GÖREVDEN ALMA (Admin)
   ══════════════════════════════════════════════════════════════ */
window.SL_gorevdenAl = async function(uid, sebep) {
  if (!window.GZ?.data?.isFounder) { window.toast?.('Yetkisiz', 'error'); return; }

  const d = await window.dbGet?.(`users/${uid}`) || {};
  const eskiRole = d.role;
  const bolge    = d.gorevBolge;

  await window.dbUpdate?.(`users/${uid}`, {
    role: 'vatandas', unvan: null, yetki: null,
    mayorOf: null, muhtarOf: null, isPM: null, isPresident: null,
    gorevBitisi: Date.now(), gorevdenAlinmaSebep: sebep || 'Admin kararı'
  });

  if (eskiRole === 'mayor' && bolge) {
    await window.dbUpdate?.(`politics/${bolge.replace(/\s/g,'_')}`, { belediyeBaskani: null });
  }
  if (eskiRole === 'muhtar' && bolge) {
    await window.dbUpdate?.(`politics/${bolge.replace(/\s/g,'_')}`, { muhtar: null });
  }
  if (eskiRole === 'pm')        await window.dbSet?.('system/pm', null);
  if (eskiRole === 'president') await window.dbSet?.('system/president', null);

  await window.dbPush?.('news', {
    title: `⚠️ ${d.username} görevden alındı: ${sebep || 'Admin kararı'}`,
    type: 'dismissal', ts: Date.now()
  });

  window.toast?.(`✅ ${d.username} görevden alındı`, 'success');
};

/* ══════════════════════════════════════════════════════════════
   MEVCUT YÖNETİCİLER LİSTESİ
   ══════════════════════════════════════════════════════════════ */
window.SL_yoneticileriGetir = async function() {
  const users = await window.dbGet?.('users') || {};
  const roller = ['president','pm','mayor','muhtar','mp'];
  const list = Object.entries(users)
    .filter(([,u]) => roller.includes(u.role) && u.gorevBitisi && Date.now() < u.gorevBitisi)
    .map(([uid,u]) => ({
      uid, username: u.username, role: u.role,
      unvan: u.unvan, bolge: u.gorevBolge,
      gorevBitisi: u.gorevBitisi, level: u.level,
      party: u.party || 'Bağımsız',
    }));
  return list;
};

/* ══════════════════════════════════════════════════════════════
   OTOMATİK SEÇİM BİTİŞİ KONTROL (Her 5 dakikada bir çalışır)
   ══════════════════════════════════════════════════════════════ */
window.SL_otomatikSonuclama = async function() {
  try {
    const secimler = await window.dbGet?.('secimler') || {};
    for (const [key, secim] of Object.entries(secimler)) {
      if (secim.status === 'active' && Date.now() > (secim.bitisAt || 0)) {
        await window.SL_secimSonuclandir(`secimler/${key}`);
      }
    }
  } catch (e) { console.error('[SL_otomatikSonuclama]', e); }
};

// Her 5 dakikada bir kontrol et
setInterval(() => window.SL_otomatikSonuclama?.(), 5 * 60 * 1000);

/* ══════════════════════════════════════════════════════════════
   SEÇİM EKRANI (UI)
   ══════════════════════════════════════════════════════════════ */
window.renderSecim = async function() {
  const main = document.getElementById('appMain');
  if (!main) return;
  const uid = window.GZ?.uid;
  if (!uid) return;

  const d = await window.dbGet?.(`users/${uid}`) || {};
  const secimler = await window.dbGet?.('secimler') || {};
  const aktifSecimler = Object.entries(secimler).filter(([,s]) => s.status === 'active');
  const tamamlananlar = Object.entries(secimler).filter(([,s]) => s.status === 'completed').slice(-5);
  const yoneticiler   = await window.SL_yoneticileriGetir?.() || [];

  const _fmt = n => typeof window.cashFmt === 'function' ? window.cashFmt(n) : n + '₺';
  const _ts  = ts => new Date(ts).toLocaleString('tr-TR');
  const kalan = (ts) => {
    const diff = ts - Date.now();
    if (diff <= 0) return '⏰ Süresi doldu';
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return `${h}s ${m}d kaldı`;
  };

  main.innerHTML = `
    <div style="padding:0 0 100px">
      <div style="padding:20px 16px 8px;display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-family:'Syne',sans-serif;font-size:22px;font-weight:900;color:#e2e8f0">🗳️ Siyasi Arena</div>
          <div style="font-size:12px;color:#64748b;margin-top:4px">
            ${d.unvan ? `<span style="color:#22c55e;font-weight:700">${d.unvan}</span>` : 'Vatandaş · ' + (d.party||'Bağımsız')}
          </div>
        </div>
        <div style="text-align:right">
          <div style="font-size:10px;color:#64748b">Level</div>
          <div style="font-size:18px;font-weight:900;color:#60a5fa">${d.level||1}</div>
        </div>
      </div>

      <div style="padding:0 16px">

        <!-- Mevcut Yöneticiler -->
        <div style="background:#0d1629;border:1px solid rgba(59,130,246,.2);border-radius:16px;padding:16px;margin-bottom:16px">
          <div style="font-size:12px;font-weight:800;letter-spacing:1.5px;color:#64748b;margin-bottom:12px">MÜEVCİT YÖNETİCİLER</div>
          ${yoneticiler.length ? yoneticiler.map(y => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.04)">
              <div>
                <div style="font-size:13px;font-weight:700;color:#e2e8f0">${y.unvan||y.role}</div>
                <div style="font-size:11px;color:#64748b">${y.username} · ${y.party||'Bağımsız'} · ${y.bolge||'Ulusal'}</div>
              </div>
              <div style="font-size:10px;color:#475569;text-align:right">
                ${new Date(y.gorevBitisi).toLocaleDateString('tr-TR')} bitiş
              </div>
            </div>`).join('') : `
            <div style="text-align:center;padding:16px;color:#475569;font-size:12px">
              Henüz seçilmiş yönetici yok
            </div>`}
        </div>

        <!-- Aktif Seçimler -->
        <div style="font-size:11px;font-weight:800;letter-spacing:1.5px;color:#64748b;margin-bottom:10px">AKTİF SEÇİMLER</div>

        ${aktifSecimler.length ? aktifSecimler.map(([key, secim]) => {
          const secimRef = `secimler/${key}`;
          const adaylar  = secim.adaylar || {};
          const oylar    = secim.oylar   || {};
          const benimOyum = oylar[uid];
          const adayListesi = Object.entries(adaylar).sort(([,a],[,b]) => (b.oy||0) - (a.oy||0));
          const toplamOy = adayListesi.reduce((s,[,a]) => s + (a.oy||0), 0);
          const benAdayim = !!adaylar[uid];
          const kaldıMilisn = secim.bitisAt - Date.now();
          const progress = Math.max(0, Math.min(100, 100 - (kaldıMilisn / (secim.bitisAt - secim.baslatAt)) * 100));

          return `
            <div style="background:#0d1629;border:1px solid rgba(59,130,246,.25);border-radius:16px;padding:16px;margin-bottom:14px">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">
                <div>
                  <div style="font-size:16px;font-weight:900;color:#e2e8f0;font-family:'Syne',sans-serif">
                    ${secim.meta?.icon||'🗳️'} ${secim.meta?.label||secim.tur}
                  </div>
                  <div style="font-size:11px;color:#64748b;margin-top:2px">📍 ${secim.bolge}</div>
                </div>
                <div style="text-align:right">
                  <div style="font-size:10px;color:#ef4444;font-weight:700">⏰ ${kalan(secim.bitisAt)}</div>
                  <div style="font-size:10px;color:#64748b;margin-top:2px">${Object.keys(oylar).length} oy kullandı</div>
                </div>
              </div>

              <!-- Süre çubuğu -->
              <div style="background:rgba(255,255,255,.06);border-radius:999px;height:4px;overflow:hidden;margin-bottom:12px">
                <div style="width:${progress}%;height:100%;background:linear-gradient(90deg,#3b82f6,#8b5cf6);border-radius:999px"></div>
              </div>

              <!-- Adaylar -->
              <div style="margin-bottom:12px">
                ${adayListesi.length ? adayListesi.map(([adayId, aday], i) => {
                  const oran = toplamOy > 0 ? (aday.oy||0)/toplamOy*100 : 0;
                  const benimVer = benimOyum === adayId;
                  const isFirst  = i === 0;
                  return `
                    <div style="background:rgba(255,255,255,.03);border:1px solid ${benimVer?'rgba(59,130,246,.4)':isFirst&&toplamOy>0?'rgba(34,197,94,.2)':'rgba(255,255,255,.06)'};
                      border-radius:12px;padding:12px;margin-bottom:8px">
                      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                        <div style="display:flex;align-items:center;gap:10px">
                          <div style="width:36px;height:36px;border-radius:50%;background:rgba(59,130,246,.15);
                            display:flex;align-items:center;justify-content:center;font-size:18px">
                            ${aday.avatar||'👤'}
                          </div>
                          <div>
                            <div style="font-size:13px;font-weight:700;color:#e2e8f0">
                              ${isFirst&&toplamOy>0?'🥇 ':i===1?'🥈 ':i===2?'🥉 ':''}${aday.username}
                              ${adayId===uid?'<span style="font-size:10px;color:#60a5fa">(Sen)</span>':''}
                            </div>
                            <div style="font-size:10px;color:#64748b">${aday.party||'Bağımsız'} · Lv${aday.level||1}</div>
                          </div>
                        </div>
                        <div style="text-align:right">
                          <div style="font-size:18px;font-weight:900;color:${isFirst&&toplamOy>0?'#22c55e':'#e2e8f0'};font-family:'Syne',sans-serif">
                            ${aday.oy||0}
                          </div>
                          <div style="font-size:10px;color:#64748b">oy · %${oran.toFixed(1)}</div>
                        </div>
                      </div>

                      <!-- Oy bar -->
                      <div style="background:rgba(255,255,255,.06);border-radius:999px;height:5px;overflow:hidden;margin-bottom:8px">
                        <div style="width:${oran}%;height:100%;background:linear-gradient(90deg,${isFirst&&toplamOy>0?'#22c55e,#10b981':'#3b82f6,#6366f1'});border-radius:999px;transition:width .6s"></div>
                      </div>

                      <!-- Vaatler -->
                      ${(aday.vaatler||[]).length ? `
                        <div style="margin-bottom:8px">
                          ${(aday.vaatler||[]).slice(0,3).map(v => `
                            <div style="font-size:10px;color:#94a3b8;display:flex;align-items:flex-start;gap:4px;margin-bottom:2px">
                              <span style="color:#3b82f6;flex-shrink:0">•</span>${v}
                            </div>`).join('')}
                        </div>` : ''}

                      <!-- Oy Ver Butonu -->
                      ${!benimOyum && adayId !== uid ? `
                        <button onclick="SL_oyKullan('${uid}','${secimRef}','${adayId}').then(r=>r&&renderSecim())"
                          style="width:100%;background:linear-gradient(135deg,#3b82f6,#6366f1);color:white;border:none;
                          border-radius:8px;padding:10px;font-weight:700;font-size:12px;cursor:pointer">
                          🗳️ Bu Adaya Oy Ver
                        </button>` : benimVer ? `
                        <div style="text-align:center;font-size:11px;color:#3b82f6;font-weight:700">✅ Oyunuzu bu adaya kullandınız</div>` : ''}
                    </div>`;
                }).join('') : `
                  <div style="text-align:center;padding:20px;color:#475569;font-size:12px">
                    Henüz aday çıkmadı. İlk aday sen ol!
                  </div>`}
              </div>

              <!-- Aday ol butonu -->
              ${!benAdayim && !benimOyum ? `
                <button onclick="renderAdayOlModal('${secimRef}','${secim.tur}','${secim.bolge}')"
                  style="width:100%;background:rgba(245,158,11,.12);color:#f59e0b;border:1px solid rgba(245,158,11,.3);
                  border-radius:10px;padding:12px;font-weight:700;font-size:13px;cursor:pointer">
                  🏅 Aday Ol (${_fmt(SECİM_CFG.adaylikUcret[secim.tur]||5000)})
                </button>` : benAdayim ? `
                <div style="text-align:center;font-size:11px;color:#f59e0b;font-weight:700;padding:8px">
                  🏅 Bu seçimde adaysınız
                </div>` : ''}

            </div>`;
        }).join('') : `
          <div style="background:#0d1629;border:1px solid rgba(255,255,255,.06);border-radius:16px;padding:32px;text-align:center;margin-bottom:14px">
            <div style="font-size:48px;margin-bottom:12px">🗳️</div>
            <div style="font-size:14px;font-weight:700;color:#e2e8f0;margin-bottom:6px">Aktif seçim yok</div>
            <div style="font-size:12px;color:#475569">Admin bir seçim başlattığında burada görünür.</div>
          </div>`}

        <!-- Son Seçim Sonuçları -->
        ${tamamlananlar.length ? `
          <div style="font-size:11px;font-weight:800;letter-spacing:1.5px;color:#64748b;margin-bottom:10px;margin-top:4px">SON SONUÇLAR</div>
          ${tamamlananlar.reverse().map(([key, secim]) => {
            const kazanan = secim.adaylar?.[secim.kazanan];
            return `
              <div style="background:#0d1629;border:1px solid rgba(255,255,255,.06);border-radius:12px;padding:14px;margin-bottom:8px">
                <div style="display:flex;justify-content:space-between;align-items:center">
                  <div>
                    <div style="font-size:13px;font-weight:700;color:#e2e8f0">
                      ${secim.meta?.icon||'🗳️'} ${secim.meta?.label||secim.tur} — ${secim.bolge}
                    </div>
                    <div style="font-size:11px;color:#64748b;margin-top:2px">${_ts(secim.sonucAt||0)}</div>
                  </div>
                  ${kazanan ? `
                    <div style="text-align:right">
                      <div style="font-size:12px;font-weight:800;color:#22c55e">🏆 ${kazanan.username}</div>
                      <div style="font-size:10px;color:#64748b">${kazanan.oy||0} oy</div>
                    </div>` : ''}
                </div>
                ${(secim.sonuclar||[]).slice(0,3).map((s,i) => `
                  <div style="display:flex;justify-content:space-between;font-size:11px;color:#64748b;padding:4px 0;border-top:1px solid rgba(255,255,255,.04);margin-top:4px">
                    <span>${i===0?'🥇':i===1?'🥈':'🥉'} ${s.username}</span>
                    <span>${s.oy} oy (%${s.oran})</span>
                  </div>`).join('')}
              </div>`;
          }).join('')}` : ''}

        <!-- Aday Olmak İçin Gereksinimler -->
        <div style="background:#0d1629;border:1px solid rgba(255,255,255,.06);border-radius:16px;padding:16px;margin-top:4px">
          <div style="font-size:11px;font-weight:800;letter-spacing:1.5px;color:#64748b;margin-bottom:12px">ADAY OLMA GEREKSİNİMLERİ</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            ${Object.entries(SECİM_CFG.meta).map(([tur, m]) => `
              <div style="background:rgba(255,255,255,.03);border-radius:10px;padding:10px;border:1px solid rgba(255,255,255,.06)">
                <div style="font-size:16px;margin-bottom:4px">${m.icon}</div>
                <div style="font-size:11px;font-weight:700;color:#e2e8f0">${m.label}</div>
                <div style="font-size:10px;color:#64748b;margin-top:2px">
                  Lv${SECİM_CFG.minLevel[tur]}+ · ${(SECİM_CFG.adaylikUcret[tur]/1000).toFixed(0)}K₺
                </div>
              </div>`).join('')}
          </div>
        </div>

      </div>
    </div>`;
};

/* ══════════════════════════════════════════════════════════════
   ADAY OL MODAL
   ══════════════════════════════════════════════════════════════ */
window.renderAdayOlModal = function(secimRef, tur, bolge) {
  const meta  = SECİM_CFG.meta[tur] || {};
  const ucret = SECİM_CFG.adaylikUcret[tur] || 5000;
  const uid   = window.GZ?.uid;

  const html = `
    <div style="padding:4px 0 20px">
      <div style="background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.2);border-radius:12px;padding:14px;margin-bottom:16px">
        <div style="font-size:14px;font-weight:800;color:#e2e8f0">${meta.icon||'🗳️'} ${meta.label||tur}</div>
        <div style="font-size:12px;color:#94a3b8;margin-top:4px">📍 ${bolge}</div>
        <div style="font-size:13px;font-weight:700;color:#f59e0b;margin-top:6px">Aday olma bedeli: ${typeof window.cashFmt==='function'?window.cashFmt(ucret):ucret+'₺'}</div>
      </div>

      <div style="font-size:12px;font-weight:700;color:#94a3b8;margin-bottom:8px">📋 VAATLERİNİZ (En az 1, en fazla 5)</div>
      ${[1,2,3,4,5].map(i => `
        <input id="adVaat${i}" placeholder="Vaat ${i}${i===1?' (zorunlu)':' (isteğe bağlı)'}"
          style="width:100%;padding:10px;background:rgba(255,255,255,.04);border:1px solid rgba(59,130,246,.2);
          border-radius:10px;color:#e2e8f0;font-size:12px;box-sizing:border-box;margin-bottom:8px">
      `).join('')}

      <button onclick="(async()=>{
        const vaatler=[1,2,3,4,5].map(i=>document.getElementById('adVaat'+i)?.value?.trim()).filter(Boolean);
        if(!vaatler.length){toast('En az 1 vaat girin','error');return;}
        const r=await SL_adayOl('${uid}','${tur}','${bolge}',vaatler);
        if(r){document.querySelector('.modal-bg')?.remove();renderSecim();}
      })()"
        style="width:100%;background:linear-gradient(135deg,#f59e0b,#f97316);color:#000;border:none;
        border-radius:12px;padding:14px;font-weight:800;font-size:14px;cursor:pointer;margin-top:8px">
        🏅 Adaylığımı Beyan Ediyorum
      </button>
    </div>`;

  if (typeof window.showModal === 'function') {
    window.showModal(`🗳️ ${meta.label} — Adaylık Beyanı`, html);
  } else {
    // Fallback modal
    const bg = document.createElement('div');
    bg.className = 'modal-bg';
    bg.innerHTML = `
      <div class="modal">
        <div class="modal-head">
          <h3>🗳️ Adaylık Beyanı</h3>
          <button class="modal-close" onclick="this.closest('.modal-bg').remove()">✕</button>
        </div>
        <div class="modal-body">${html}</div>
      </div>`;
    document.body.appendChild(bg);
  }
};

/* ══════════════════════════════════════════════════════════════
   ADMIN: SEÇİM YÖNETİM PANELİ
   ══════════════════════════════════════════════════════════════ */
window.renderAdminSecimPanel = async function(container) {
  if (!container) return;
  const secimler    = await window.dbGet?.('secimler') || {};
  const yoneticiler = await window.SL_yoneticileriGetir?.() || [];

  const _fmt = n => typeof window.cashFmt === 'function' ? window.cashFmt(n) : n+'₺';
  const _ts  = ts => new Date(ts).toLocaleString('tr-TR');
  const kalan = ts => { const d=ts-Date.now(); if(d<=0) return '⏰ Bitti'; const h=Math.floor(d/3600000); return `${h}s kaldı`; };

  container.innerHTML = `
    <div style="padding:20px">
      <h2 style="color:#60a5fa;margin:0 0 20px;font-size:16px;font-family:'Syne',sans-serif">🗳️ Seçim Yönetim Paneli</h2>

      <!-- Hızlı Seçim Başlat -->
      <div style="background:#0d1829;border:1px solid #1e3a5f;border-radius:14px;padding:16px;margin-bottom:16px">
        <h3 style="color:#e2e8f0;font-size:14px;margin:0 0 14px">⚡ Hızlı Seçim Başlat</h3>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
          <div>
            <label style="font-size:11px;color:#94a3b8;display:block;margin-bottom:4px">Seçim Türü</label>
            <select id="adm_secTur" style="width:100%;padding:10px;background:#080d1a;border:1px solid #1e3a5f;border-radius:8px;color:#e2e8f0">
              <option value="muhtar">🏛️ Muhtarlık</option>
              <option value="belediye">🏙️ Belediye Başkanlığı</option>
              <option value="milletvekili">🏛️ Milletvekilliği</option>
              <option value="basbakanlik">🇹🇷 Başbakanlık</option>
              <option value="cumhurbaskani">🌟 Cumhurbaşkanlığı</option>
            </select>
          </div>
          <div>
            <label style="font-size:11px;color:#94a3b8;display:block;margin-bottom:4px">Bölge / İl</label>
            <select id="adm_secBolge" style="width:100%;padding:10px;background:#080d1a;border:1px solid #1e3a5f;border-radius:8px;color:#e2e8f0">
              <option value="Ulusal">🇹🇷 Ulusal</option>
              ${ILLER.map(il => `<option value="${il}">${il}</option>`).join('')}
            </select>
          </div>
          <div>
            <label style="font-size:11px;color:#94a3b8;display:block;margin-bottom:4px">Süre (saat)</label>
            <input id="adm_secSure" type="number" value="72" style="width:100%;padding:10px;background:#080d1a;border:1px solid #1e3a5f;border-radius:8px;color:#e2e8f0;box-sizing:border-box">
          </div>
          <div style="display:flex;align-items:flex-end">
            <button onclick="(async()=>{
              const tur=document.getElementById('adm_secTur').value;
              const bolge=document.getElementById('adm_secBolge').value;
              const sure=parseInt(document.getElementById('adm_secSure').value)||72;
              await SL_secimBaslat(tur,bolge,sure);
              setTimeout(()=>renderAdminSecimPanel(document.getElementById('adminScreenBody')),500);
            })()"
              style="width:100%;background:linear-gradient(135deg,#3b82f6,#6366f1);color:white;border:none;
              border-radius:8px;padding:11px;font-weight:700;cursor:pointer">
              🗳️ Başlat
            </button>
          </div>
        </div>
      </div>

      <!-- Aktif Seçimler -->
      <div style="background:#0d1829;border:1px solid #1e3a5f;border-radius:14px;padding:16px;margin-bottom:16px">
        <h3 style="color:#e2e8f0;font-size:14px;margin:0 0 12px">⏳ Aktif Seçimler</h3>
        ${Object.entries(secimler).filter(([,s])=>s.status==='active').length ? Object.entries(secimler).filter(([,s])=>s.status==='active').map(([key,secim])=>`
          <div style="padding:10px 0;border-bottom:1px solid #0f1e33">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
              <div>
                <div style="font-size:13px;font-weight:700;color:#e2e8f0">${secim.meta?.icon||'🗳️'} ${secim.meta?.label||secim.tur} — ${secim.bolge}</div>
                <div style="font-size:11px;color:#64748b">${Object.keys(secim.adaylar||{}).length} aday · ${Object.keys(secim.oylar||{}).length} oy · ${kalan(secim.bitisAt)}</div>
              </div>
              <div style="display:flex;gap:6px">
                <button onclick="SL_secimSonuclandir('secimler/${key}').then(()=>renderAdminSecimPanel(document.getElementById('adminScreenBody')))"
                  style="background:#22c55e22;color:#22c55e;border:1px solid #22c55e44;border-radius:6px;padding:5px 12px;font-size:11px;font-weight:700;cursor:pointer">
                  🏆 Sonuçlandır
                </button>
                <button onclick="if(confirm('Seçimi iptal et?')){dbUpdate('secimler/${key}',{status:'cancelled'}).then(()=>renderAdminSecimPanel(document.getElementById('adminScreenBody')))}"
                  style="background:#ef444422;color:#ef4444;border:1px solid #ef444444;border-radius:6px;padding:5px 12px;font-size:11px;font-weight:700;cursor:pointer">
                  ❌ İptal
                </button>
              </div>
            </div>
          </div>`).join('') : '<p style="color:#475569;font-size:12px;text-align:center;padding:12px">Aktif seçim yok</p>'}
      </div>

      <!-- Mevcut Yöneticiler & Görevden Alma -->
      <div style="background:#0d1829;border:1px solid #1e3a5f;border-radius:14px;padding:16px;margin-bottom:16px">
        <h3 style="color:#e2e8f0;font-size:14px;margin:0 0 12px">👔 Mevcut Yöneticiler</h3>
        ${yoneticiler.length ? yoneticiler.map(y=>`
          <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid #0f1e33;flex-wrap:wrap;gap:6px">
            <div>
              <div style="font-size:13px;font-weight:700;color:#e2e8f0">${y.unvan||y.role}</div>
              <div style="font-size:11px;color:#64748b">${y.username} · ${y.party||'Bağımsız'} · ${y.bolge||'Ulusal'}</div>
              <div style="font-size:10px;color:#475569">${_ts(y.gorevBitisi)} bitiş</div>
            </div>
            <button onclick="(async()=>{const s=prompt('Görevden alma sebebi?');if(s){await SL_gorevdenAl('${y.uid}',s);renderAdminSecimPanel(document.getElementById('adminScreenBody'));}})()"
              style="background:#ef444422;color:#ef4444;border:1px solid #ef444444;border-radius:6px;padding:6px 12px;font-size:11px;font-weight:700;cursor:pointer">
              ⚠️ Görevden Al
            </button>
          </div>`).join('') : '<p style="color:#475569;font-size:12px;text-align:center;padding:12px">Görevde yönetici yok</p>'}
      </div>

      <!-- Manuel Yetki Ver -->
      <div style="background:#0d1829;border:1px solid #1e3a5f;border-radius:14px;padding:16px">
        <h3 style="color:#e2e8f0;font-size:14px;margin:0 0 12px">⚡ Manuel Yetki Ver</h3>
        <div style="display:grid;grid-template-columns:1fr;gap:8px">
          <input id="adm_yUid" placeholder="Kullanıcı UID" style="width:100%;padding:10px;background:#080d1a;border:1px solid #1e3a5f;border-radius:8px;color:#e2e8f0;box-sizing:border-box">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            <select id="adm_yTur" style="width:100%;padding:10px;background:#080d1a;border:1px solid #1e3a5f;border-radius:8px;color:#e2e8f0">
              <option value="muhtar">Muhtar</option>
              <option value="belediye">Belediye Bşk.</option>
              <option value="milletvekili">Milletvekili</option>
              <option value="basbakanlik">Başbakan</option>
              <option value="cumhurbaskani">Cumhurbaşkanı</option>
            </select>
            <select id="adm_yBolge" style="width:100%;padding:10px;background:#080d1a;border:1px solid #1e3a5f;border-radius:8px;color:#e2e8f0">
              <option value="Ulusal">Ulusal</option>
              ${ILLER.map(il=>`<option value="${il}">${il}</option>`).join('')}
            </select>
          </div>
          <button onclick="(async()=>{
            const uid=document.getElementById('adm_yUid').value;
            const tur=document.getElementById('adm_yTur').value;
            const bolge=document.getElementById('adm_yBolge').value;
            if(!uid){toast('UID girin','error');return;}
            await SL_yetkiVer(uid,tur,bolge);
            toast('✅ Yetki verildi','success');
            renderAdminSecimPanel(document.getElementById('adminScreenBody'));
          })()"
            style="width:100%;background:#eab308;color:#000;border:none;border-radius:8px;padding:11px;font-weight:800;cursor:pointer">
            ⚡ Manuel Yetki Ver
          </button>
        </div>
      </div>

    </div>`;
};

/* Admin panel entegrasyonu */
document.addEventListener('DOMContentLoaded', function() {
  setTimeout(function() {
    // Admin nav'a seçim panelini ekle (eğer yoksa)
    const nav = document.getElementById('adminScreenNav');
    if (!nav || !window.GZ?.data?.isFounder) return;
    if (document.getElementById('admNavSecim')) return;

    const btn = document.createElement('button');
    btn.id = 'admNavSecim';
    btn.className = 'asnb';
    btn.innerHTML = '<span>🗳️</span><span>Seçim Yönetimi</span>';
    btn.onclick = function() {
      document.querySelectorAll('.asnb').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const body = document.getElementById('adminScreenBody');
      if (body) window.renderAdminSecimPanel(body);
    };

    const lastBtn = nav.lastElementChild;
    if (lastBtn) lastBtn.insertAdjacentElement('afterend', btn);
    else nav.appendChild(btn);
  }, 3500);
});

console.log('[secim-sistemi.js] ✅ Gerçek oyuncu seçim sistemi aktif — 81 il + ulusal seçimler');

/* ============================================================================
   rol-sistemi.js — Rol Bazlı Navigasyon
   İlk girişte meslek/rol seç. Navigasyon ve ana ekran role göre değişir.
   ============================================================================ */

'use strict';

/* ── ROL TANIMLARI ── */
const GZ_ROLLER = {
  vatandas: {
    label: '👤 Vatandaş',
    desc: 'Ticaret yap, dükkan aç, şehirde yaşa',
    color: '#3b82f6',
    anaSekmeler: ['dukkan','banka','ihracat','liderlik'],
    menuKategoriler: ['ticaret','finans','uretim','eglence','kisisel','bilgi'],
    anaSayfa: 'dukkan',
  },
  muhtar: {
    label: '🏛️ Muhtar',
    desc: 'Mahallenin lideri — kimlik, yardım, duyuru',
    color: '#8b5cf6',
    anaSekmeler: ['muhtarlik','belediye','sgk','liderlik'],
    menuKategoriler: ['devlet','asayis','ticaret','kisisel'],
    anaSayfa: 'muhtarlik',
  },
  mayor: {
    label: '🏙️ Belediye Başkanı',
    desc: 'İlin yöneticisi — ruhsat, imar, bütçe',
    color: '#06b6d4',
    anaSekmeler: ['belediye','muhtarlik','polis','liderlik'],
    menuKategoriler: ['devlet','asayis','hukuk','ticaret','kisisel'],
    anaSayfa: 'belediye',
  },
  police: {
    label: '👮 Polis',
    desc: 'Asayiş ve düzeni koru — ceza, GBT, hapis',
    color: '#1d4ed8',
    anaSekmeler: ['polis','muhtarlik','mahkeme','liderlik'],
    menuKategoriler: ['asayis','hukuk','devlet','kisisel'],
    anaSayfa: 'polis',
  },
  soldier: {
    label: '🎖️ Asker',
    desc: 'Savunma görevlisi — sınır, güvenlik',
    color: '#065f46',
    anaSekmeler: ['askeriye','polis','muhtarlik','liderlik'],
    menuKategoriler: ['asayis','devlet','kisisel'],
    anaSayfa: 'askeriye',
  },
  judge: {
    label: '⚖️ Hakim',
    desc: 'Adalet dağıt — davalar, ceza kararı',
    color: '#7c3aed',
    anaSekmeler: ['mahkeme','polis','noter','liderlik'],
    menuKategoriler: ['hukuk','asayis','devlet','kisisel'],
    anaSayfa: 'mahkeme',
  },
  pm: {
    label: '🇹🇷 Başbakan',
    desc: 'Ulusal yönetim — ekonomi, vergi, yasalar',
    color: '#dc2626',
    anaSekmeler: ['basbakanlik','secim','belediye','liderlik'],
    menuKategoriler: ['devlet','asayis','hukuk','finans','kisisel'],
    anaSayfa: 'basbakanlik',
  },
  president: {
    label: '🌟 Cumhurbaşkanı',
    desc: 'Her şeye hükmeder',
    color: '#f59e0b',
    anaSekmeler: ['basbakanlik','secim','belediye','polis'],
    menuKategoriler: ['devlet','asayis','hukuk','finans','ticaret','kisisel'],
    anaSayfa: 'basbakanlik',
  },
  esnaf: {
    label: '🏪 Esnaf',
    desc: 'Dükkan işlet, üret, sat',
    color: '#16a34a',
    anaSekmeler: ['dukkan','banka','pazar','liderlik'],
    menuKategoriler: ['ticaret','uretim','finans','kisisel'],
    anaSayfa: 'dukkan',
  },
  banker: {
    label: '🏦 Bankacı',
    desc: 'Kredi ver, faiz al, yatırım yap',
    color: '#0891b2',
    anaSekmeler: ['banka','borsa','tahvil','liderlik'],
    menuKategoriler: ['finans','ticaret','kisisel'],
    anaSayfa: 'banka',
  },
};

/* ── İLK GİRİŞ ROL SEÇİM EKRANI ── */
window.GZR_showRolSecim = function() {
  const main = document.getElementById('appMain');
  if (!main) return;

  // Kurucu direkt geç
  if (window.GZ?.data?.isFounder) return;

  const secilecekRoller = ['vatandas','esnaf','banker','police','soldier','judge'];

  main.innerHTML = `
    <div style="padding:20px 16px 100px">
      <div style="text-align:center;padding:24px 0 20px">
        <div style="font-size:48px;margin-bottom:12px">🎭</div>
        <div style="font-size:22px;font-weight:800;color:var(--text)">Kim olmak istiyorsun?</div>
        <div style="font-size:13px;color:var(--muted);margin-top:6px">
          Mesleğini seç. Buna göre önüne gelecekler değişir.<br>
          <small style="color:var(--primary)">Muhtar, Belediye Başkanı, Başbakan → Seçimle kazanılır</small>
        </div>
      </div>

      <div style="display:flex;flex-direction:column;gap:10px">
        ${secilecekRoller.map(rolId => {
          const rol = GZ_ROLLER[rolId];
          return `
            <button onclick="GZR_rolSec('${rolId}')"
              style="background:var(--card);border:2px solid var(--border);border-radius:14px;
              padding:16px;text-align:left;transition:.15s;display:flex;align-items:center;gap:14px;
              width:100%;cursor:pointer"
              onmouseover="this.style.borderColor='${rol.color}';this.style.background='${rol.color}11'"
              onmouseout="this.style.borderColor='var(--border)';this.style.background='var(--card)'">
              <div style="width:48px;height:48px;border-radius:12px;background:${rol.color}22;
                border:2px solid ${rol.color}44;display:flex;align-items:center;
                justify-content:center;font-size:24px;flex-shrink:0">
                ${rol.label.split(' ')[0]}
              </div>
              <div style="flex:1">
                <div style="font-size:15px;font-weight:700;color:var(--text)">${rol.label.slice(2)}</div>
                <div style="font-size:12px;color:var(--muted);margin-top:3px">${rol.desc}</div>
              </div>
              <div style="color:${rol.color};font-size:20px">›</div>
            </button>`;
        }).join('')}

        <div style="background:var(--blue-l);border:1px solid var(--primary)33;border-radius:12px;padding:14px;text-align:center;margin-top:4px">
          <div style="font-size:12px;color:var(--primary);font-weight:600">🗳️ Muhtar / Belediye Başkanı / Başbakan olmak için seçime gir!</div>
          <div style="font-size:11px;color:var(--muted);margin-top:4px">Önce vatandaş ol, sonra seçime aday ol ve oy topla.</div>
        </div>
      </div>
    </div>`;
};

/* ── ROL SEÇ & KAYDET ── */
window.GZR_rolSec = async function(rolId) {
  const uid = window.GZ?.uid; if (!uid) return;
  const rol = GZ_ROLLER[rolId]; if (!rol) return;

  await window.dbUpdate?.(`users/${uid}`, {
    role: rolId,
    rolSecildi: true,
    rolSecildiAt: Date.now(),
  });

  if (window.GZ?.data) window.GZ.data.role = rolId;
  window.GZ.data = window.GZ.data || {};
  window.GZ.data.role = rolId;
  window.GZ.data.rolSecildi = true;

  // Kimlik kartı yoksa muhtara yönlendir
  if (!window.GZ.data.kimlikKarti) {
    if (typeof toast === 'function') toast('✅ Rol seçildi! Önce Muhtardan kimlik kartı çıkartman lazım.', 'info', 6000);
    GZR_rolNavigasyon(rolId);
    setTimeout(() => { if (typeof switchTab === 'function') switchTab('muhtarlik'); }, 500);
  } else {
    if (typeof toast === 'function') toast(`✅ ${rol.label} olarak devam ediyorsun!`, 'success', 4000);
    GZR_rolNavigasyon(rolId);
    setTimeout(() => { if (typeof switchTab === 'function') switchTab(rol.anaSayfa); }, 300);
  }
};

/* ── ROL BAZLI NAVİGASYON GÜNCELLE ── */
window.GZR_rolNavigasyon = function(rolId) {
  const rol = GZ_ROLLER[rolId] || GZ_ROLLER['vatandas'];

  // Alt 5 sekmeyi rol'e göre güncelle
  const konsol = document.getElementById('mainKonsol');
  if (!konsol) return;

  const tabBtns = konsol.querySelectorAll('.mk-tab');
  const rolSekmeler = rol.anaSekmeler;

  // Her sekme butonunu güncelle
  tabBtns.forEach((btn, i) => {
    const yeniId = rolSekmeler[i];
    if (!yeniId) return;
    const tabMeta = GZR_getTabMeta(yeniId);
    btn.dataset.tab = yeniId;
    const iconEl = btn.querySelector('.mk-icon');
    const labelEl = btn.querySelector('.mk-label');
    if (iconEl)  iconEl.textContent  = tabMeta.icon;
    if (labelEl) labelEl.textContent = tabMeta.label;
  });
};

function GZR_getTabMeta(id) {
  const META = {
    dukkan:'🏪,Dükkan',banka:'🏦,Banka',ihracat:'🚢,Ticaret',liderlik:'🏆,Liderlik',
    muhtarlik:'🏛️,Muhtar',belediye:'🏙️,Belediye',sgk:'🏥,SGK',polis:'👮,Emniyet',
    mahkeme:'⚖️,Mahkeme',askeriye:'🎖️,Asker',noter:'📜,Noterlik',
    basbakanlik:'🇹🇷,Hükümet',secim:'🗳️,Seçim',borsa:'📊,Borsa',
    pazar:'🛒,Pazar',tahvil:'📜,Tahvil',cuzdan:'💰,Cüzdan',
  };
  const v = META[id] || '📋,' + id;
  const [icon, label] = v.split(',');
  return { icon, label };
}

/* ── BAŞLANGIÇTA ROL KONTROL ── */
window.GZR_init = async function() {
  const uid = window.GZ?.uid; if (!uid) return;
  const d   = await window.dbGet?.(`users/${uid}`) || {};

  // Kurucu: tüm yetkiler, direkt başla
  if (d.isFounder) {
    GZR_rolNavigasyon('vatandas'); // kurucu varsayılan nav
    return;
  }

  // Rol seçilmemişse seçim ekranı göster
  if (!d.rolSecildi && !d.role) {
    GZR_showRolSecim();
    return;
  }

  // Rol var, navigasyonu ayarla
  const rolId = d.role || 'vatandas';
  GZR_rolNavigasyon(rolId);

  // Görev süresi bitmişse vatandaşa düşür
  if (d.gorevBitisi && Date.now() > d.gorevBitisi &&
      ['muhtar','mayor','pm','president','mp'].includes(rolId)) {
    await window.dbUpdate?.(`users/${uid}`, {
      role: 'vatandas', unvan: null, mayorOf: null, muhtarOf: null,
      isPM: null, isPresident: null
    });
    if (window.GZ?.data) window.GZ.data.role = 'vatandas';
    GZR_rolNavigasyon('vatandas');
    if (typeof toast === 'function') toast('⏰ Görev süreniz doldu. Vatandaş statüsüne geçtiniz.', 'info', 6000);
    return;
  }

  // Kimlik kartı yoksa uyar
  if (!d.kimlikKarti) {
    setTimeout(() => {
      if (typeof toast === 'function')
        toast('⚠️ Muhtarlıktan kimlik kartı çıkartmadan ticaret yapamazsın!', 'warn', 8000);
    }, 2000);
  }

  // Ana sayfaya yönlendir
  const rol = GZ_ROLLER[rolId] || GZ_ROLLER['vatandas'];
  setTimeout(() => {
    if (typeof switchTab === 'function') switchTab(rol.anaSayfa);
  }, 400);
};

/* ── ROL DEĞİŞTİR BUTONU (Profil sayfasında) ── */
window.GZR_rolDegistirModal = function() {
  const html = `
    <div style="padding:8px 0 16px">
      <p style="font-size:13px;color:var(--muted);margin-bottom:16px">
        ⚠️ Rolünü değiştirebilirsin. Seçimle kazanılan roller (Muhtar, Belediye Başkanı, Başbakan)
        görev süresi dolunca otomatik sona erer.
      </p>
      <div style="display:flex;flex-direction:column;gap:8px">
        ${['vatandas','esnaf','banker','police','soldier','judge'].map(rolId => {
          const r = GZ_ROLLER[rolId];
          const isActive = window.GZ?.data?.role === rolId;
          return `
            <button onclick="GZR_rolSec('${rolId}');document.querySelector('.modal-bg')?.remove()"
              style="background:${isActive?'var(--primary)':'var(--card)'};color:${isActive?'#fff':'var(--text)'};
              border:1px solid ${isActive?'var(--primary)':'var(--border)'};border-radius:10px;
              padding:12px 14px;text-align:left;font-size:13px;font-weight:600;cursor:pointer;
              display:flex;align-items:center;gap:10px">
              <span style="font-size:20px">${r.label.split(' ')[0]}</span>
              <span>${r.label.slice(2)}</span>
              ${isActive?'<span style="margin-left:auto">✓</span>':''}
            </button>`;
        }).join('')}
      </div>
    </div>`;

  if (typeof showModal === 'function') showModal('🎭 Rol Değiştir', html);
};

/* ── INIT: GZ hazır olunca başlat ── */
(function() {
  const _wait = setInterval(function() {
    if (window.GZ?.uid && window.GZ?.data !== undefined) {
      clearInterval(_wait);
      // Konsol hazır olana kadar bekle
      const _wait2 = setInterval(function() {
        if (document.getElementById('mainKonsol')) {
          clearInterval(_wait2);
          setTimeout(() => window.GZR_init?.(), 300);
        }
      }, 300);
    }
  }, 400);
})();

console.log('[rol-sistemi.js] ✅ Rol bazlı navigasyon hazır');
