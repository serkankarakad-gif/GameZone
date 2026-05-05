// ============================================================
// TÜRK İMPARATORLUĞU — auth.js
// Kayıt, Giriş, Şifre Sıfırlama, Güvenlik
// ============================================================
"use strict";

var AUTH = (function () {

  var _attempts    = {};
  var MAX_ATTEMPTS = 5;
  var LOCK_MS      = 15 * 60 * 1000; // 15 dakika
  var _screen      = "login";

  // ——— Input temizle (XSS koruması) ———
  function sanitize(str) {
    if (typeof str !== "string") return "";
    return str.trim().replace(/[<>"'`]/g, "").substring(0, 500);
  }

  // ——— E-posta doğrula ———
  function validEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) && email.length <= 254;
  }

  // ——— Şifre gücü kontrolü ———
  function validPass(p) {
    if (p.length < 8)          return "Şifre en az 8 karakter olmalı.";
    if (!/[A-Z]/.test(p))      return "En az 1 büyük harf gerekli.";
    if (!/[a-z]/.test(p))      return "En az 1 küçük harf gerekli.";
    if (!/[0-9]/.test(p))      return "En az 1 rakam gerekli.";
    return null; // OK
  }

  // ——— Brute-force koruması ———
  function checkLock(email) {
    var k = email.toLowerCase();
    if (!_attempts[k]) return false;
    if (Date.now() < _attempts[k].lockUntil) {
      var rem = Math.ceil((_attempts[k].lockUntil - Date.now()) / 60000);
      UI.toast("Çok fazla deneme. " + rem + " dakika bekleyin.", "error");
      return true;
    }
    return false;
  }

  function recordFail(email) {
    var k = email.toLowerCase();
    if (!_attempts[k]) _attempts[k] = { count: 0, lockUntil: 0 };
    _attempts[k].count++;
    if (_attempts[k].count >= MAX_ATTEMPTS) {
      _attempts[k].lockUntil = Date.now() + LOCK_MS;
      _attempts[k].count = 0;
    }
  }

  function clearFail(email) { delete _attempts[email.toLowerCase()]; }

  // ——— Firebase hata mesajları ———
  function errMsg(code) {
    var m = {
      "auth/user-not-found":        "Bu e-posta ile kayıtlı kullanıcı bulunamadı.",
      "auth/wrong-password":        "E-posta veya şifre hatalı.",
      "auth/email-already-in-use":  "Bu e-posta zaten kayıtlı.",
      "auth/weak-password":         "Şifre çok zayıf.",
      "auth/invalid-email":         "Geçersiz e-posta adresi.",
      "auth/too-many-requests":     "Çok fazla deneme. Bir süre bekleyin.",
      "auth/network-request-failed":"İnternet bağlantısı yok.",
      "auth/user-disabled":         "Hesap devre dışı bırakıldı.",
      "auth/invalid-credential":    "E-posta veya şifre hatalı."
    };
    return m[code] || "Beklenmeyen bir hata oluştu. Tekrar deneyin.";
  }

  // ——— Başlangıç durumu ———
  function buildState(name, email, uid) {
    var now = new Date().toISOString();
    return {
      profile: {
        uid: uid, name: name, email: email,
        level: 1, xp: 0, elmas: D.CONFIG.INITIAL_ELMAS,
        avatar: "👤", badge: "Çırak 📜",
        creditScore: D.CONFIG.CREDIT_SCORE_INIT,
        party: null, sgkStatus: null,
        createdAt: now
      },
      wallet: {
        tl: D.CONFIG.INITIAL_TL,
        digitalWallet: { provider: null, balance: 0 }
      },
      bank: { accounts: [], loans: [], deposits: [], checks: [] },
      stocks: { portfolio: {}, watchlist: [] },
      crypto: { portfolio: {} },
      production: { gardens: [], farms: [], factories: [], mines: [], energy: [] },
      commerce: { shops: [] },
      properties: { realEstate: [], insurance: [], mortgages: [] },
      government: {
        residence: null, municipality: null,
        permits: [], taxFiled: false,
        criminalRecord: [], courtCases: [], notaryDocs: []
      },
      stats: {
        totalEarned: 0, totalSpent: 0, tradeCount: 0,
        loginCount: 1, lastLogin: now
      }
    };
  }

  // ——— Public API ———
  return {

    currentScreen: function () { return _screen; },

    sanitize: sanitize,

    show: function (screen) {
      ["login-screen", "reg-screen", "forgot-screen"].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.classList.add("hidden");
      });
      var t = document.getElementById(screen + "-screen");
      if (t) t.classList.remove("hidden");
      _screen = screen;
    },

    register: function () {
      var name  = sanitize(document.getElementById("reg-name").value);
      var email = sanitize(document.getElementById("reg-email").value).toLowerCase();
      var pass  = document.getElementById("reg-pass").value;
      var pass2 = document.getElementById("reg-pass2").value;
      var terms = document.getElementById("reg-terms").checked;

      if (!name || name.length < 2)    return UI.toast("Geçerli bir ad girin.", "error");
      if (!validEmail(email))           return UI.toast("Geçersiz e-posta.", "error");
      var pe = validPass(pass);
      if (pe)                           return UI.toast(pe, "error");
      if (pass !== pass2)               return UI.toast("Şifreler eşleşmiyor.", "error");
      if (!terms)                       return UI.toast("Kullanım koşullarını kabul edin.", "error");

      UI.setLoading("reg-btn", true);
      window.fbAuth.createUserWithEmailAndPassword(email, pass)
        .then(function (cred) {
          return cred.user.updateProfile({ displayName: name })
            .then(function () { return cred.user.sendEmailVerification(); })
            .then(function () {
              var state = buildState(name, email, cred.user.uid);
              return DB.saveUser(cred.user.uid, state);
            })
            .then(function () {
              UI.toast("Hoş geldiniz, " + name + "! E-posta doğrulama linki gönderildi.", "success");
              clearFail(email);
            });
        })
        .catch(function (err) { UI.toast(errMsg(err.code), "error"); })
        .finally(function () { UI.setLoading("reg-btn", false); });
    },

    login: function () {
      var email = sanitize(document.getElementById("login-email").value).toLowerCase();
      var pass  = document.getElementById("login-pass").value;
      if (!validEmail(email)) return UI.toast("Geçersiz e-posta.", "error");
      if (!pass)              return UI.toast("Şifre giriniz.", "error");
      if (checkLock(email))   return;

      UI.setLoading("login-btn", true);
      window.fbAuth.signInWithEmailAndPassword(email, pass)
        .then(function () { clearFail(email); })
        .catch(function (err) { recordFail(email); UI.toast(errMsg(err.code), "error"); })
        .finally(function () { UI.setLoading("login-btn", false); });
    },

    forgotPassword: function () {
      var email = sanitize(document.getElementById("forgot-email").value).toLowerCase();
      if (!validEmail(email)) return UI.toast("Geçerli e-posta giriniz.", "error");
      UI.setLoading("forgot-btn", true);
      window.fbAuth.sendPasswordResetEmail(email, { url: window.location.href })
        .then(function () {
          UI.toast("Sıfırlama linki gönderildi (kayıtlıysa).", "success");
          setTimeout(function () { AUTH.show("login"); }, 3000);
        })
        .catch(function () { UI.toast("Sıfırlama linki gönderildi (kayıtlıysa).", "success"); })
        .finally(function () { UI.setLoading("forgot-btn", false); });
    },

    logout: function () {
      window.fbAuth.signOut()
        .then(function () {
          GAME.destroy();
          document.getElementById("app").classList.add("hidden");
          document.getElementById("auth-screen").classList.remove("hidden");
          AUTH.show("login");
          UI.toast("Başarıyla çıkış yapıldı.", "info");
        })
        .catch(function () { UI.toast("Çıkış yapılamadı.", "error"); });
    },

    changePassword: function () {
      var oldPass  = document.getElementById("cp-old").value;
      var newPass  = document.getElementById("cp-new").value;
      var newPass2 = document.getElementById("cp-new2").value;
      var pe = validPass(newPass);
      if (pe)                    return UI.toast(pe, "error");
      if (newPass !== newPass2)  return UI.toast("Yeni şifreler eşleşmiyor.", "error");
      var user = window.fbAuth.currentUser;
      if (!user)                 return;
      var cred = firebase.auth.EmailAuthProvider.credential(user.email, oldPass);
      user.reauthenticateWithCredential(cred)
        .then(function () { return user.updatePassword(newPass); })
        .then(function () { UI.toast("Şifre başarıyla değiştirildi.", "success"); UI.closeModal(); })
        .catch(function (err) {
          if (err.code === "auth/wrong-password") UI.toast("Mevcut şifreniz yanlış.", "error");
          else UI.toast("Şifre değiştirilemedi.", "error");
        });
    }
  };
})();
