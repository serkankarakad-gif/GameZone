// ============================================================
// TÜRK İMPARATORLUĞU — oyun.js  (Oyun Motoru)
// ============================================================
"use strict";

var OYUN = (function() {
  var _s = null; // state
  var _u = null; // user
  var _timers = [];
  var _dirty = false;

  // ══ BAŞLAT ══
  function init() {
    initFirebase();
    // Not: PIYASA kendi kendini başlatır (IIFE içinde)
    fbAuth.onAuthStateChanged(function(user) {
      if (user) { _u = user; _yukle(user); }
      else { _u=null; _s=null; UI.showAuth(); }
    });
  }

  // ══ YUKLE ══
  function _yukle(user) {
    UI.showLoader("Oyun yükleniyor...");
    DB.getUser(user.uid).then(function(data) {
      if (data) {
        _s = data;
        _migrate();
        _offlineKazanc();
        _s.istatistik.loginSayisi = (_s.istatistik.loginSayisi || 0) + 1;
        _s.istatistik.sonGiris = new Date().toISOString();
      } else {
        var isim = user.displayName || (user.email && user.email.split("@")[0]) || "Oyuncu";
        _s = (typeof AUTH !== "undefined" && AUTH._defaultState)
          ? AUTH._defaultState(user.uid, isim, user.email || "")
          : _defaultState(user.uid, isim, user.email || "");
      }
      _dirty = true;
      return _kaydet();
    }).then(function() {
      UI.hideLoader();
      UI.showApp();
      UI.showSection("anasayfa");
      UI.refreshHUD();
      _startTimers();
      DB.updateLeaderboard(_u.uid, _s.profil.username, netDeger(), _s.profil.seviye);
      // Kredi bot kontrolü başlat
      if (typeof BANKA !== "undefined") BANKA.startCreditBot();
      // Duyuru dinle
      DB.getAnnouncement(function(ann) {
        if (ann && ann.active) UI.showAnnouncement(ann);
      });
    }).catch(function(e) {
      console.error("Yükleme hatası:", e);
      UI.hideLoader();
      if (_s) {
        UI.showApp();
        UI.showSection("anasayfa");
        UI.refreshHUD();
        UI.toast("Çevrimdışı mod — veriler kaydedilmeyebilir.", "warning");
      } else {
        UI.toast("Yükleme başarısız. Sayfayı yenileyin.", "error");
      }
    });
  }

  function _defaultState(uid, name, email) {
    var now = new Date().toISOString();
    return {
      profil: { uid:uid, username:name, email:email, avatar:"👤", unvan:"Çırak 📜", seviye:1, xp:0, elmas:D.CONFIG.INITIAL_ELMAS, kupon:1, calisanMorali:100, olusturulma:now },
      cuzdan: { nakit:D.CONFIG.INITIAL_TL, banka:0, yatirimHesabi:0, kredi:0, krediLimit:0 },
      banka:  { hesaplar:[], krediler:[], mevduatlar:[], hareketler:[] },
      borsa:  { portfoy:{}, favori:[] },
      kripto: { portfoy:{} },
      doviz:  { portfoy:{} },
      fonlar: { portfoy:{} },
      uretim: { bahceler:[], ciftlikler:[], fabrikalar:[], madenler:[] },
      dukkanlar: {},
      gayrimenkul: { mulkler:[] },
      sigortalar: { aktif:[] },
      gorevler: { gunluk:{}, haftalik:{}, basarimlar:{} },
      istatistik: { toplamKazanc:0, toplamHarcama:0, islemSayisi:0, loginSayisi:1, sonGiris:now }
    };
  }

  function _migrate() {
    if (!_s) return;
    if (!_s.profil.kupon)             _s.profil.kupon = 0;
    if (!_s.profil.calisanMorali)     _s.profil.calisanMorali = 100;
    if (!_s.banka)                    _s.banka = {hesaplar:[],krediler:[],mevduatlar:[],hareketler:[]};
    if (!_s.banka.hesaplar)           _s.banka.hesaplar = [];
    if (!_s.banka.krediler)           _s.banka.krediler = [];
    if (!_s.banka.mevduatlar)         _s.banka.mevduatlar = [];
    if (!_s.banka.hareketler)         _s.banka.hareketler = [];
    if (!_s.borsa)                    _s.borsa = {portfoy:{},favori:[]};
    if (!_s.borsa.favori)             _s.borsa.favori = [];
    if (!_s.kripto)                   _s.kripto = {portfoy:{}};
    if (!_s.doviz)                    _s.doviz  = {portfoy:{}};
    if (!_s.fonlar)                   _s.fonlar = {portfoy:{}};
    if (!_s.uretim)                   _s.uretim = {bahceler:[],ciftlikler:[],fabrikalar:[],madenler:[]};
    if (!_s.uretim.bahceler)          _s.uretim.bahceler = [];
    if (!_s.uretim.ciftlikler)        _s.uretim.ciftlikler = [];
    if (!_s.uretim.fabrikalar)        _s.uretim.fabrikalar = [];
    if (!_s.uretim.madenler)          _s.uretim.madenler = [];
    if (!_s.dukkanlar)                _s.dukkanlar = {};
    if (!_s.gayrimenkul)              _s.gayrimenkul = {mulkler:[]};
    if (!_s.sigortalar)               _s.sigortalar = {aktif:[]};
    if (!_s.gorevler)                 _s.gorevler = {gunluk:{},haftalik:{},basarimlar:{}};
    if (!_s.istatistik)               _s.istatistik = {toplamKazanc:0,toplamHarcama:0,islemSayisi:0,loginSayisi:0,sonGiris:new Date().toISOString()};
  }

  function _offlineKazanc() {
    if (!_s || !_s.istatistik || !_s.istatistik.sonGiris) return;
    var last = new Date(_s.istatistik.sonGiris).getTime();
    if (isNaN(last)) return;
    var elapsed = Math.min(Date.now() - last, D.CONFIG.OFFLINE_MAX_H * 3600000);
    if (elapsed < 60000) return;
    var total = 0;
    var saat  = elapsed / 3600000;

    // Dükkan gelirleri
    Object.values(_s.dukkanlar || {}).forEach(function(d) {
      // Dükkan stok yapısı: d.stok = { urunId: miktar }
      if (d.stok && d.turId) {
        // Basit offline gelir: toplamKazanc'ın saatlik ortalaması
        var gunlukOrtalama = (d.toplamKazanc || 0) / Math.max(1, (Date.now() - (d.acilis || Date.now())) / 86400000);
        var gelir = gunlukOrtalama * saat * 0.5; // offline %50 verimlilik
        if (gelir > 1) total += Math.round(gelir);
      }
    });

    // Gayrimenkul kira
    (_s.gayrimenkul.mulkler || []).forEach(function(m) {
      if (m.gunlukKira > 0) { total += m.gunlukKira * elapsed / 86400000; }
    });

    if (total > 1) {
      var net = Math.round(total);
      _s.cuzdan.nakit += net;
      _s.istatistik.toplamKazanc += net;
      _dirty = true;
      setTimeout(function() {
        UI.toast("Yokluğunuzda " + fmt(net) + " kazandınız! 💰", "success");
      }, 2000);
    }
  }

  function _startTimers() {
    // Otomatik kayıt
    _timers.push(setInterval(function() {
      if (_dirty) { _kaydet(); _dirty = false; }
    }, D.CONFIG.AUTO_SAVE_SEC * 1000));

    // Piyasa güncellemesi — 20 dakikada bir
    if (typeof PIYASA !== "undefined") {
      // İlk tick hemen
      PIYASA.tick();
      _timers.push(setInterval(function() {
        PIYASA.tick();
      }, 20 * 60 * 1000)); // 20 dakika
    }

    // Liderlik tablosu
    _timers.push(setInterval(function() {
      if (_u && _s) {
        DB.updateLeaderboard(_u.uid, _s.profil.username, netDeger(), _s.profil.seviye);
      }
    }, 60000));

    // Sayfadan çıkarken kaydet
    window.addEventListener("beforeunload", function() { _kaydet(); });
  }

  function _kaydet() {
    if (!_u || !_s) return Promise.resolve();
    return DB.saveUser(_u.uid, _s);
  }

  // ══ PARA YÖNETİMİ ══
  function fmt(n) {
    if (n == null || !isFinite(n)) return "₺0";
    var abs = Math.abs(n), pre = n < 0 ? "-" : "";
    if (abs >= 1e12) return pre + "₺" + (abs/1e12).toFixed(2) + " Tr";
    if (abs >= 1e9)  return pre + "₺" + (abs/1e9).toFixed(2) + " Mr";
    if (abs >= 1e6)  return pre + "₺" + (abs/1e6).toFixed(2) + " M";
    if (abs >= 1e3)  return pre + "₺" + (abs/1e3).toFixed(1) + " B";
    return pre + "₺" + parseFloat(abs.toFixed(2)).toLocaleString("tr-TR");
  }

  function fmtTam(n) {
    return "₺" + parseFloat((n||0).toFixed(2)).toLocaleString("tr-TR", {minimumFractionDigits:2, maximumFractionDigits:2});
  }

  function canAfford(amount) {
    return _s && isFinite(amount) && amount >= 0 && _s.cuzdan.nakit >= amount;
  }

  function harca(amount, aciklama) {
    amount = parseFloat(amount);
    if (!isFinite(amount) || amount < 0)  { UI.toast("Geçersiz tutar.", "error"); return false; }
    if (!canAfford(amount))               { UI.toast("Yetersiz bakiye! " + fmt(_s.cuzdan.nakit) + " var.", "error"); return false; }
    _s.cuzdan.nakit           -= amount;
    _s.istatistik.toplamHarcama += amount;
    _s.istatistik.islemSayisi++;
    _hareket("cikis", amount, aciklama || "Ödeme");
    _dirty = true;
    UI.refreshHUD();
    return true;
  }

  function kazan(brut, aciklama) {
    brut = parseFloat(brut);
    if (!isFinite(brut) || brut < 0) return 0;
    var net = Math.round(brut * (1 - D.CONFIG.TAX_RATE));
    _s.cuzdan.nakit           += net;
    _s.istatistik.toplamKazanc += net;
    _s.istatistik.islemSayisi++;
    _hareket("giris", net, aciklama || "Gelir");
    _dirty = true;
    UI.refreshHUD();
    return net;
  }

  function kazanDirekt(amount, aciklama) {
    amount = parseFloat(amount);
    if (!isFinite(amount) || amount < 0) return;
    _s.cuzdan.nakit           += amount;
    _s.istatistik.toplamKazanc += amount;
    _hareket("giris", amount, aciklama || "Gelir");
    _dirty = true;
    UI.refreshHUD();
  }

  function _hareket(tip, amount, aciklama) {
    if (!_s.banka.hareketler) _s.banka.hareketler = [];
    _s.banka.hareketler.unshift({
      tip: tip, tutar: amount,
      aciklama: aciklama, ts: Date.now()
    });
    if (_s.banka.hareketler.length > 200) _s.banka.hareketler.length = 200;
  }

  // ══ XP / LEVEL ══
  function xpIcin(seviye) {
    return Math.floor(D.CONFIG.LEVEL_XP_BASE * Math.pow(D.CONFIG.LEVEL_XP_MULT, seviye - 1));
  }

  function xpEkle(miktar) {
    if (!_s) return;
    _s.profil.xp = (_s.profil.xp || 0) + miktar;
    var needed = xpIcin(_s.profil.seviye + 1);
    if (_s.profil.xp >= needed) {
      _s.profil.seviye++;
      _s.profil.xp -= needed;
      _s.profil.unvan = _unvan(_s.profil.seviye);
      _s.profil.elmas += 5;
      _dirty = true;
      UI.refreshHUD();
      UI.toast("🎉 Seviye " + _s.profil.seviye + " — " + _s.profil.unvan + " (+5💎)", "success");
      if (typeof GOREV !== "undefined") GOREV.kontrol();
    }
    _dirty = true;
    UI.refreshHUD();
  }

  function _unvan(seviye) {
    if (seviye >= 50) return "İmparator 👑";
    if (seviye >= 40) return "Paşa 🦅";
    if (seviye >= 30) return "Vezir 🏛️";
    if (seviye >= 25) return "Bey 💎";
    if (seviye >= 20) return "Ağa 🌟";
    if (seviye >= 15) return "Tüccar 🏪";
    if (seviye >= 10) return "Esnaf 🛒";
    if (seviye >= 5)  return "Kalfa ⭐";
    return "Çırak 📜";
  }

  // ══ NET DEĞER ══
  function netDeger() {
    if (!_s) return 0;
    var nw = _s.cuzdan.nakit + _s.cuzdan.banka + _s.cuzdan.yatirimHesabi - _s.cuzdan.kredi;
    // Borsa portföy
    if (typeof PIYASA !== "undefined") {
      Object.keys(_s.borsa.portfoy || {}).forEach(function(sym) {
        var pos = _s.borsa.portfoy[sym];
        nw += (pos.adet || 0) * (PIYASA.fiyat(sym) || pos.avgMaliyet || 0);
      });
      Object.keys(_s.kripto.portfoy || {}).forEach(function(sym) {
        var pos = _s.kripto.portfoy[sym];
        nw += (pos.adet || 0) * (PIYASA.kriptoFiyat(sym) || pos.avgMaliyet || 0);
      });
    }
    (_s.gayrimenkul.mulkler || []).forEach(function(m) { nw += m.deger || 0; });
    return Math.round(nw);
  }

  function destroy() {
    _timers.forEach(function(t) { clearInterval(t); clearTimeout(t); });
    _timers = []; _s = null; _u = null; _dirty = false;
  }

  return {
    init:init, destroy:destroy,
    get s()   { return _s; },
    get u()   { return _u; },
    set dirty(v) { _dirty = v; },
    fmt:fmt, fmtTam:fmtTam,
    canAfford:canAfford, harca:harca, kazan:kazan, kazanDirekt:kazanDirekt,
    xpEkle:xpEkle, xpIcin:xpIcin, netDeger:netDeger,
    kaydet: function() { _dirty = true; }
  };
})();

window.addEventListener("load", function() { OYUN.init(); });
