// ============================================================
// TÜRK İMPARATORLUĞU — kimlik.js  (Auth)
// ============================================================
"use strict";

var AUTH = (function() {

  var _attempts = {};

  function sanitize(s) {
    return (s || "").trim().replace(/[<>"'`]/g, "").substring(0, 300);
  }

  function _validEmail(e) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) && e.length < 255;
  }

  function _validPass(p) {
    if (!p || p.length < 8)  return "Şifre en az 8 karakter olmalı.";
    if (!/[A-Z]/.test(p))    return "En az 1 büyük harf (A-Z) gerekli.";
    if (!/[0-9]/.test(p))    return "En az 1 rakam (0-9) gerekli.";
    return null;
  }

  function _errMsg(code) {
    var m = {
      "auth/user-not-found":        "Bu e-posta ile kayıtlı kullanıcı bulunamadı.",
      "auth/wrong-password":        "E-posta veya şifre hatalı.",
      "auth/invalid-credential":    "E-posta veya şifre hatalı.",
      "auth/email-already-in-use":  "Bu e-posta zaten kayıtlı.",
      "auth/weak-password":         "Şifre çok zayıf.",
      "auth/invalid-email":         "Geçersiz e-posta formatı.",
      "auth/too-many-requests":     "Çok fazla deneme. Biraz bekleyin.",
      "auth/network-request-failed":"İnternet bağlantısı yok.",
      "auth/operation-not-allowed": "E-posta/şifre girişi aktif değil."
    };
    return m[code] || ("Hata: " + (code || "Bilinmeyen"));
  }

  function _defaultState(uid, name, email) {
    var now = new Date().toISOString();
    return {
      profil: {
        uid: uid, username: name, email: email,
        avatar: "👤", unvan: "Çırak 📜",
        seviye: 1, xp: 0, elmas: D.CONFIG.INITIAL_ELMAS,
        kupon: D.CONFIG.INITIAL_KUPON,
        calisanMorali: 100,
        olusturulma: now
      },
      cuzdan: {
        nakit: D.CONFIG.INITIAL_TL,
        banka: 0,
        yatirimHesabi: 0,
        kredi: 0,
        krediLimit: 0
      },
      banka: {
        hesaplar: [],
        krediler: [],
        mevduatlar: [],
        hareketler: []
      },
      borsa: { portfoy: {}, favori: [] },
      kripto: { portfoy: {} },
      doviz:  { portfoy: {} },
      fonlar: { portfoy: {} },
      uretim: { bahceler:[], ciftlikler:[], fabrikalar:[], madenler:[] },
      dukkanlar: {},
      gayrimenkul: { mulkler:[] },
      sigortalar: { aktif:[] },
      gorevler: { gunluk:{}, haftalik:{}, basarimlar:{} },
      istatistik: {
        toplamKazanc: 0, toplamHarcama: 0,
        islemSayisi: 0, loginSayisi: 1,
        sonGiris: now
      }
    };
  }

  function show(screen) {
    ["login","reg","forgot"].forEach(function(s) {
      var el = document.getElementById("screen-" + s);
      if (el) el.classList.add("hidden");
    });
    var target = document.getElementById("screen-" + screen);
    if (target) target.classList.remove("hidden");
  }

  function login() {
    var email = sanitize(document.getElementById("login-email").value).toLowerCase();
    var pass  = document.getElementById("login-pass").value;
    if (!_validEmail(email)) return UI.toast("Geçerli e-posta girin.", "error");
    if (!pass)               return UI.toast("Şifrenizi girin.", "error");
    _setBtn("login-btn", true, "Giriş yapılıyor...");
    fbAuth.signInWithEmailAndPassword(email, pass)
      .catch(function(e) { UI.toast(_errMsg(e.code), "error"); })
      .finally(function() { _setBtn("login-btn", false, "Giriş Yap"); });
  }

  function register() {
    var name  = sanitize(document.getElementById("reg-name").value);
    var email = sanitize(document.getElementById("reg-email").value).toLowerCase();
    var pass  = document.getElementById("reg-pass").value;
    var pass2 = document.getElementById("reg-pass2").value;
    var terms = document.getElementById("reg-terms").checked;
    if (!name || name.length < 2)    return UI.toast("Kullanıcı adı en az 2 karakter.", "error");
    if (!_validEmail(email))          return UI.toast("Geçerli e-posta girin.", "error");
    var pe = _validPass(pass);
    if (pe)                           return UI.toast(pe, "error");
    if (pass !== pass2)               return UI.toast("Şifreler eşleşmiyor.", "error");
    if (!terms)                       return UI.toast("Kullanım koşullarını kabul edin.", "error");
    _setBtn("reg-btn", true, "Kayıt olunuyor...");
    fbAuth.createUserWithEmailAndPassword(email, pass)
      .then(function(cred) {
        var uid   = cred.user.uid;
        var state = _defaultState(uid, name, email);
        return cred.user.updateProfile({displayName: name})
          .then(function() { return DB.saveUser(uid, state); });
      })
      .then(function() { UI.toast("Hoş geldiniz! 20.000 TL ile başlıyorsunuz 🎉", "success"); })
      .catch(function(e) { UI.toast(_errMsg(e.code), "error"); })
      .finally(function() { _setBtn("reg-btn", false, "Kayıt Ol — 20.000 TL ile başla!"); });
  }

  function forgotPassword() {
    var email = sanitize(document.getElementById("forgot-email").value).toLowerCase();
    if (!_validEmail(email)) return UI.toast("Geçerli e-posta girin.", "error");
    _setBtn("forgot-btn", true, "Gönderiliyor...");
    fbAuth.sendPasswordResetEmail(email)
      .then(function() { UI.toast("Sıfırlama linki gönderildi! Spam kutunuzu da kontrol edin.", "success"); show("login"); })
      .catch(function() { UI.toast("Link gönderildi (eğer kayıtlıysa).", "success"); show("login"); })
      .finally(function() { _setBtn("forgot-btn", false, "Sıfırlama Linki Gönder"); });
  }

  function logout() {
    if (!fbAuth) { location.reload(); return; }
    fbAuth.signOut().then(function() {
      if (typeof OYUN !== "undefined" && OYUN.destroy) OYUN.destroy();
      document.getElementById("app").classList.add("hidden");
      document.getElementById("auth-screen").classList.remove("hidden");
      show("login");
    }).catch(function() { location.reload(); });
  }

  function _setBtn(id, loading, txt) {
    var b = document.getElementById(id);
    if (!b) return;
    b.disabled = loading;
    b.textContent = loading ? ("⏳ " + txt) : txt;
  }

  return { show:show, login:login, register:register, forgotPassword:forgotPassword, logout:logout, sanitize:sanitize, _defaultState:_defaultState };
})();
