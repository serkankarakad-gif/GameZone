// ============================================================
// TÜRK İMPARATORLUĞU — game.js  v3
// Oyun motoru — SEC entegreli
// ============================================================
"use strict";

var GAME = (function () {

  var _state   = null;
  var _user    = null;
  var _prices  = {};
  var _cprices = {};
  var _news    = [];
  var _timers  = [];
  var _dirty   = false;

  // ——— BAŞLAT ———
  function init() {
    SEC.init();          // güvenlik önce
    initFirebase();

    D.STOCKS.forEach(function(s)  { _prices[s.sym]   = s.price; });
    D.CRYPTOS.forEach(function(c) { _cprices[c.sym]  = c.price; });

    window.fbAuth.onAuthStateChanged(function(user) {
      if (user) { _user = user; _loadGame(user.uid); }
      else      { _user = null; _state = null; UI.showAuth(); }
    });

    _startMarket();
    _startNews();
  }

  // ——— YÜKLE ———
  function _loadGame(uid) {
    UI.showLoader("Oyun yükleniyor...");
    DB.getUser(uid).then(function(data) {
      if (!data) { UI.hideLoader(); UI.toast("Veri bulunamadı.", "error"); AUTH.logout(); return; }
      _state = data;
      _migrate();
      _calcOffline();
      _state.stats.loginCount = (_state.stats.loginCount || 0) + 1;
      _state.stats.lastLogin  = new Date().toISOString();
      _dirty = true;
      _startAutoSave();
      return save();
    }).then(function() {
      if (!_state) return;
      UI.hideLoader();
      UI.showApp();
      SEC.captureHash();   // temiz başlangıç hash'i
      UI.toast("Hoş geldiniz, " + _state.profile.name + "! 👋", "success");
    }).catch(function() {
      UI.hideLoader();
      UI.toast("Yükleme başarısız. Bağlantınızı kontrol edin.", "error");
    });
  }

  // ——— MİGRASYON ———
  function _migrate() {
    var g = _state.government;
    var w = _state.wallet;
    if (!w.digitalWallet)           w.digitalWallet = { provider:null, balance:0 };
    if (!_state.bank.checks)        _state.bank.checks = [];
    if (!g.permits)                 g.permits = [];
    if (!g.notaryDocs)              g.notaryDocs = [];
    if (!g.criminalRecord)          g.criminalRecord = [];
    if (!g.courtCases)              g.courtCases = [];
    if (!_state.production.energy)  _state.production.energy = [];
    if (!_state.profile.creditScore) _state.profile.creditScore = D.CONFIG.CREDIT_SCORE_INIT;
  }

  // ——— OFFLİNE KAZANÇ ———
  function _calcOffline() {
    var last    = new Date(_state.stats.lastLogin).getTime();
    var elapsed = Math.min(Date.now() - last, D.CONFIG.OFFLINE_MAX_MS);
    if (elapsed < 60000) return;

    var total = 0;
    ["gardens","farms","factories","mines","energy"].forEach(function(key) {
      (_state.production[key]||[]).forEach(function(item) {
        var ticks = Math.floor(elapsed / (item.timeSec * 1000));
        if (ticks > 0) total += ticks * item.income;
      });
    });
    (_state.commerce.shops||[]).forEach(function(sh) {
      var ticks = Math.floor(elapsed / (sh.timeSec * 1000));
      if (ticks > 0) total += ticks * sh.income;
    });
    (_state.bank.deposits||[]).filter(function(d){return d.active;}).forEach(function(dep) {
      var days = elapsed / (86400 * 1000);
      dep.accumulated = (dep.accumulated||0) + dep.amount * dep.rate * days;
    });

    if (total > 0) {
      var net = Math.round(total * (1 - D.CONFIG.TAX_RATE));
      // Makul offline sınırı — çok büyük değerler reddedilir
      if (net > 5e9) { net = 5e9; }
      _state.wallet.tl       += net;
      _state.stats.totalEarned += net;
      _dirty = true;
      setTimeout(function() { UI.toast("Yokluğunuzda " + fmt(net) + " TL kazandınız!", "info"); }, 2000);
    }
  }

  // ——— OTO KAYIT ———
  function _startAutoSave() {
    var t = setInterval(function() {
      if (_dirty) { save(); _dirty = false; }
    }, D.CONFIG.AUTO_SAVE_MS);
    _timers.push(t);
  }

  // ——— PİYASA ———
  function _startMarket() {
    var t = setInterval(function() {
      D.STOCKS.forEach(function(s) {
        var r = (Math.random()-0.48)*s.vol*2;
        _prices[s.sym] = Math.max(s.price*0.3, Math.min(s.price*3, _prices[s.sym]*(1+r)));
        _prices[s.sym] = parseFloat(_prices[s.sym].toFixed(2));
      });
      D.CRYPTOS.forEach(function(c) {
        var r = (Math.random()-0.47)*c.vol*2;
        _cprices[c.sym] = Math.max(c.price*0.1, Math.min(c.price*10, _cprices[c.sym]*(1+r)));
        _cprices[c.sym] = parseFloat(_cprices[c.sym].toFixed(c.price>=1000?0:4));
      });
      UI.refreshTicker();
      _checkDividends();
    }, D.CONFIG.MARKET_TICK_MS);
    _timers.push(t);
  }

  function _checkDividends() {
    if (!_state) return;
    var d   = new Date();
    if (d.getDate() !== 15) return;
    var key = d.getFullYear() + "-" + (d.getMonth()+1);
    if (_state._lastDivKey === key) return;
    _state._lastDivKey = key;
    var total = 0;
    Object.keys(_state.stocks.portfolio).forEach(function(sym) {
      var stock = D.STOCKS.find(function(s){return s.sym===sym;});
      if (!stock||!stock.div) return;
      total += _state.stocks.portfolio[sym].qty * (_prices[sym]||stock.price) * stock.div / 12;
    });
    if (total > 0) {
      var net = Math.round(total);
      _state.wallet.tl        += net;
      _state.stats.totalEarned += net;
      _dirty = true;
      SEC.captureHash();
      UI.toast("💰 Temettü: " + fmt(net) + " yatırıldı!", "success");
      UI.updateHUD();
    }
  }

  // ——— HABERLER ———
  function _startNews() {
    function gen() {
      var tmpl = D.NEWS_TEMPLATES[Math.floor(Math.random()*D.NEWS_TEMPLATES.length)];
      var s    = D.STOCKS[Math.floor(Math.random()*D.STOCKS.length)];
      var txt  = tmpl
        .replace("{v}",     (Math.random()*5+0.5).toFixed(1))
        .replace("{rate}",  (Math.random()*2+32).toFixed(2))
        .replace("{sym}",   s.sym)
        .replace("{name}",  s.name)
        .replace("{amount}",String(Math.floor(Math.random()*50+10)))
        .replace("{baz}",   String(Math.floor(Math.random()*4+1)*25));
      _news.unshift({ text:txt, time:new Date() });
      if (_news.length > 30) _news.pop();
      UI.updateNewsTicker();
    }
    gen();
    _timers.push(setInterval(gen, 45000));
  }

  // ——— FORMAT ———
  function fmt(n) {
    if (n == null || !isFinite(n)) return "₺0";
    var abs = Math.abs(n), pre = n < 0 ? "-" : "";
    if (abs >= 1e9) return pre+"₺"+(abs/1e9).toFixed(2)+" Mr";
    if (abs >= 1e6) return pre+"₺"+(abs/1e6).toFixed(2)+" M";
    if (abs >= 1e3) return pre+"₺"+(abs/1e3).toFixed(1)+" B";
    return pre+"₺"+parseFloat(abs.toFixed(2)).toLocaleString("tr-TR");
  }
  function fmtFull(n) {
    return parseFloat((n||0).toFixed(2)).toLocaleString("tr-TR",{minimumFractionDigits:2,maximumFractionDigits:2});
  }
  function fmtTime(sec) {
    if (sec<3600)  return Math.floor(sec/60)+" dakika";
    if (sec<86400) return (sec/3600).toFixed(1)+" saat";
    return (sec/86400).toFixed(1)+" gün";
  }

  // ——— PARA İŞLEMLERİ (SEC entegreli) ———
  function canAfford(amount) { return _state && isFinite(amount) && amount > 0 && _state.wallet.tl >= amount; }

  function spend(amount, desc) {
    amount = parseFloat(amount);
    if (!isFinite(amount) || amount <= 0) { UI.toast("Geçersiz miktar.", "error"); return false; }
    if (!SEC.checkRateLimit())             { UI.toast("Çok hızlı işlem yapıyorsunuz.", "warning"); return false; }
    if (!canAfford(amount))                { UI.toast("Yetersiz bakiye!", "error"); return false; }
    _state.wallet.tl        -= amount;
    _state.stats.totalSpent += amount;
    _dirty = true;
    SEC.captureHash();
    return true;
  }

  function earnNet(gross, desc) {
    gross = parseFloat(gross);
    if (!isFinite(gross) || gross < 0) return 0;
    var net = Math.round(gross * (1 - D.CONFIG.TAX_RATE));
    _state.wallet.tl        += net;
    _state.stats.totalEarned += net;
    _dirty = true;
    SEC.captureHash();
    return net;
  }

  function earnRaw(amount) {
    amount = parseFloat(amount);
    if (!isFinite(amount) || amount < 0) return;
    _state.wallet.tl        += amount;
    _state.stats.totalEarned += amount;
    _dirty = true;
    SEC.captureHash();
  }

  // ——— LEVEL / XP ———
  function xpForLevel(lvl) {
    return Math.floor(D.CONFIG.LEVEL_XP_BASE * Math.pow(D.CONFIG.LEVEL_XP_MULT, lvl-1));
  }
  function addXP(amount) {
    if (!_state) return;
    _state.profile.xp += amount;
    var needed = xpForLevel(_state.profile.level+1);
    if (_state.profile.xp >= needed) {
      _state.profile.level++;
      _state.profile.xp    -= needed;
      _state.profile.badge  = _badge(_state.profile.level);
      _state.profile.elmas += 5;
      _dirty = true;
      UI.toast("🎉 Seviye "+_state.profile.level+" — "+_state.profile.badge, "success");
    }
    _dirty = true;
    UI.updateHUD();
  }
  function _badge(lvl) {
    if (lvl>=50) return "İmparator 👑";
    if (lvl>=40) return "Paşa 🦅";
    if (lvl>=30) return "Vezir 🏛️";
    if (lvl>=20) return "Bey 💎";
    if (lvl>=15) return "Ağa 🌟";
    if (lvl>=10) return "Tüccar 🏪";
    if (lvl>=5)  return "Esnaf 🛒";
    return "Çırak 📜";
  }

  // ——— HESAPLAMALAR ———
  function portfolioValue() {
    if (!_state) return 0;
    var v = 0;
    Object.keys(_state.stocks.portfolio).forEach(function(sym) {
      v += (_state.stocks.portfolio[sym].qty||0) * (_prices[sym]||0);
    });
    return v;
  }
  function cryptoValue() {
    if (!_state) return 0;
    var v = 0;
    Object.keys(_state.crypto.portfolio).forEach(function(sym) {
      v += (_state.crypto.portfolio[sym].qty||0) * (_cprices[sym]||0);
    });
    return v;
  }
  function netWorth() {
    if (!_state) return 0;
    var nw = _state.wallet.tl;
    nw += portfolioValue();
    nw += cryptoValue();
    (_state.bank.accounts||[]).forEach(function(a){ nw += (a.balance||0); });
    (_state.bank.deposits||[]).filter(function(d){return d.active;}).forEach(function(d){ nw += (d.amount||0); });
    return nw;
  }
  function updateCreditScore(delta) {
    if (!_state) return;
    _state.profile.creditScore = Math.min(900, Math.max(300, (_state.profile.creditScore||650)+delta));
    _dirty = true;
  }

  // ——— KAYDET ———
  function save() {
    if (!_user || !_state) return Promise.resolve();
    return DB.saveUser(_user.uid, _state);
  }

  // ——— TEMİZLE ———
  function destroy() {
    _timers.forEach(function(t){ clearInterval(t); });
    _timers = []; _state = null; _user = null; _dirty = false;
  }

  // ——— IBAN ———
  function genIBAN() {
    var d = "";
    for (var i=0; i<22; i++) d += Math.floor(Math.random()*10);
    return "TR"+d.slice(0,2)+" "+d.slice(2,6)+" "+d.slice(6,10)+" "+d.slice(10,14)+" "+d.slice(14,18)+" "+d.slice(18,22);
  }

  return {
    init: init, destroy: destroy, save: save,
    get state()  { return _state;   },
    get user()   { return _user;    },
    get prices() { return _prices;  },
    get cprices(){ return _cprices; },
    get news()   { return _news;    },
    set dirty(v) { _dirty = v;      },
    fmt: fmt, fmtFull: fmtFull, fmtTime: fmtTime,
    canAfford: canAfford, spend: spend, earnNet: earnNet, earnRaw: earnRaw,
    addXP: addXP, xpForLevel: xpForLevel,
    portfolioValue: portfolioValue, cryptoValue: cryptoValue,
    netWorth: netWorth, updateCreditScore: updateCreditScore,
    genIBAN: genIBAN
  };
})();

window.addEventListener("load", function() { GAME.init(); });
