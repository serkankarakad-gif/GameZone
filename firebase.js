// ============================================================
// TÜRK İMPARATORLUĞU — firebase.js  (Realtime Database)
// ============================================================
"use strict";

const FB = {
  apiKey:            "AIzaSyB5pl78DRao2SmUWsMYMSZ6YbfX4rtRNdc",
  authDomain:        "gamezone-e11b0.firebaseapp.com",
  databaseURL:       "https://gamezone-e11b0-default-rtdb.europe-west1.firebasedatabase.app",
  projectId:         "gamezone-e11b0",
  storageBucket:     "gamezone-e11b0.firebasestorage.app",
  messagingSenderId: "775694460272",
  appId:             "1:775694460272:web:7e5fd5691df9d8399d5bb5"
};

window.fbApp  = null;
window.fbAuth = null;
window.fbDB   = null;

function initFirebase() {
  try {
    window.fbApp  = (firebase.apps && firebase.apps.length)
      ? firebase.apps[0]
      : firebase.initializeApp(FB);
    window.fbAuth = firebase.auth();
    window.fbDB   = firebase.database();
    console.log("✅ Firebase (Realtime DB) hazır");
  } catch(e) {
    console.error("Firebase init hatası:", e);
    // UI henüz yüklenmemiş olabilir, setTimeout ile güvenli çağır
    setTimeout(function() {
      if (typeof UI !== "undefined" && UI.toast) {
        UI.toast("Sunucu bağlantısı kurulamadı!", "error");
      }
    }, 500);
  }
}

/*
──────────────────────────────────────────────
  REALTİME DATABASE RULES
  Firebase Console → Realtime Database → Rules
──────────────────────────────────────────────
{
  "rules": {
    "users": {
      "$uid": {
        ".read":  "$uid === auth.uid",
        ".write": "$uid === auth.uid"
      }
    },
    "chat": {
      ".read":  "auth != null",
      ".write": "auth != null"
    },
    "leaderboard": {
      ".read":  "auth != null",
      ".write": "auth != null"
    },
    "announcements": {
      ".read":  "auth != null",
      ".write": "auth.uid === 'IEqctPKFy6bL5u9ew6kIm8W6CsF2'"
    },
    "promo_codes": {
      ".read":  "auth != null",
      ".write": "auth.uid === 'IEqctPKFy6bL5u9ew6kIm8W6CsF2'"
    },
    "credit_requests": {
      ".read":  "auth.uid === 'IEqctPKFy6bL5u9ew6kIm8W6CsF2' || data.child('uid').val() === auth.uid",
      ".write": "auth != null"
    },
    "feed": {
      ".read":  "auth != null",
      ".write": "auth != null"
    }
  }
}
*/

var DB = {
  _lastSave: 0,

  getUser: function(uid) {
    return fbDB.ref("users/" + uid).once("value")
      .then(function(s) { return s.exists() ? s.val() : null; })
      .catch(function(e) { console.error("getUser:", e); return null; });
  },

  saveUser: function(uid, data) {
    var now = Date.now();
    if (now - DB._lastSave < 4000) return Promise.resolve(true);
    DB._lastSave = now;
    var clean = JSON.parse(JSON.stringify(data));
    clean._ts = now;
    return fbDB.ref("users/" + uid).set(clean)
      .then(function() { return true; })
      .catch(function(e) { console.error("saveUser:", e); return false; });
  },

  updateUser: function(uid, updates) {
    return fbDB.ref("users/" + uid).update(updates)
      .catch(function(e) { console.error("updateUser:", e); });
  },

  logFeed: function(uid, username, action, product, amount, fromCity, toCity) {
    var entry = {
      uid: uid, user: username, action: action,
      product: product, amount: amount,
      from: fromCity || null, to: toCity || null,
      ts: Date.now()
    };
    return fbDB.ref("feed").push(entry)
      .catch(function() {});
  },

  getFeed: function(limit) {
    return fbDB.ref("feed").orderByChild("ts").limitToLast(limit || 20).once("value")
      .then(function(s) {
        var items = [];
        s.forEach(function(c) { items.unshift(c.val()); });
        return items;
      }).catch(function() { return []; });
  },

  getLeaderboard: function() {
    return fbDB.ref("leaderboard").orderByChild("varlik").limitToLast(50).once("value")
      .then(function(s) {
        var list = [];
        s.forEach(function(c) { list.unshift(Object.assign({uid: c.key}, c.val())); });
        return list;
      }).catch(function() { return []; });
  },

  updateLeaderboard: function(uid, name, varlik, level) {
    return fbDB.ref("leaderboard/" + uid).set({name:name, varlik:varlik, level:level, ts:Date.now()})
      .catch(function() {});
  },

  sendChatMsg: function(uid, name, msg) {
    return fbDB.ref("chat").push({uid:uid, name:name, msg:msg, ts:Date.now()})
      .catch(function() {});
  },

  listenChat: function(callback) {
    fbDB.ref("chat").orderByChild("ts").limitToLast(50).on("value", function(s) {
      var msgs = [];
      s.forEach(function(c) { msgs.push(c.val()); });
      callback(msgs);
    });
  },

  submitCreditRequest: function(uid, username, amount, bankId) {
    var req = {
      uid: uid, username: username,
      amount: amount, bankId: bankId,
      status: "pending", ts: Date.now(),
      autoApproveAt: Date.now() + (D.CONFIG.CREDIT_BOT_MIN + Math.floor(Math.random() * (D.CONFIG.CREDIT_BOT_MAX - D.CONFIG.CREDIT_BOT_MIN))) * 60000
    };
    return fbDB.ref("credit_requests").push(req)
      .then(function(ref) { return ref.key; })
      .catch(function() { return null; });
  },

  listenCreditRequests: function(uid, callback) {
    fbDB.ref("credit_requests").orderByChild("uid").equalTo(uid).on("value", function(s) {
      var reqs = [];
      s.forEach(function(c) { reqs.push(Object.assign({id: c.key}, c.val())); });
      callback(reqs);
    });
  },

  getAnnouncement: function(callback) {
    fbDB.ref("announcements/current").on("value", function(s) {
      if (s.exists()) callback(s.val());
    });
  },

  getPromoCode: function(code) {
    return fbDB.ref("promo_codes/" + code).once("value")
      .then(function(s) { return s.exists() ? s.val() : null; })
      .catch(function() { return null; });
  },

  usePromoCode: function(code) {
    return fbDB.ref("promo_codes/" + code).transaction(function(cur) {
      if (!cur || !cur.active) return;
      if (cur.usedCount >= cur.maxUse) { cur.active = false; return cur; }
      cur.usedCount = (cur.usedCount || 0) + 1;
      if (cur.usedCount >= cur.maxUse) cur.active = false;
      return cur;
    });
  }
};
