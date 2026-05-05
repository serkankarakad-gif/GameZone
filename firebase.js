// ============================================================
// TÜRK İMPARATORLUĞU — firebase.js
// Firebase başlatma + Sunucu tarafı veri doğrulama
// ============================================================
"use strict";

const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyB5pl78DRao2SmUWsMYMSZ6YbfX4rtRNdc",
  authDomain:        "gamezone-e11b0.firebaseapp.com",
  databaseURL:       "https://gamezone-e11b0-default-rtdb.europe-west1.firebasedatabase.app",
  projectId:         "gamezone-e11b0",
  storageBucket:     "gamezone-e11b0.firebasestorage.app",
  messagingSenderId: "775694460272",
  appId:             "1:775694460272:web:7e5fd5691df9d8399d5bb5",
  measurementId:     "G-3M7FXX8XR4"
};

window.fbApp  = null;
window.fbAuth = null;
window.fbDB   = null;

function initFirebase() {
  try {
    window.fbApp  = firebase.apps && firebase.apps.length
      ? firebase.apps[0]
      : firebase.initializeApp(FIREBASE_CONFIG);
    window.fbAuth = firebase.auth();
    window.fbDB   = firebase.firestore();

    window.fbDB.enablePersistence({ synchronizeTabs: false }).catch(function () {});
  } catch (err) {
    alert("Sunucu bağlantısı kurulamadı. Sayfayı yenileyin.");
  }
}

// ════════════════════════════════════════════════════════════
// FİRESTORE GÜVENLİK KURALLARI
// Firebase Console → Firestore → Rules sekmesi → yapıştır → Publish
// ════════════════════════════════════════════════════════════
/*
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Güvenlik olayları — sadece yazılır, dışarıdan okunamaz
    match /security_log/{doc} {
      allow read:  if false;
      allow write: if request.auth != null;
    }

    // Kullanıcı belgesi
    match /users/{userId} {
      allow read: if request.auth != null && request.auth.uid == userId;

      allow write: if request.auth != null
                   && request.auth.uid == userId
                   && _isValidUser(request.resource.data, resource.data);

      // İşlem geçmişi
      match /transactions/{txId} {
        allow read:   if request.auth != null && request.auth.uid == userId;
        allow create: if request.auth != null && request.auth.uid == userId;
        allow update, delete: if false;
      }
    }

    // Oyuncu pazarı
    match /marketplace/{id} {
      allow read:   if request.auth != null;
      allow create: if request.auth != null
                    && request.resource.data.sellerId == request.auth.uid
                    && request.resource.data.qty    is int
                    && request.resource.data.qty    > 0
                    && request.resource.data.qty    <= 1000000
                    && request.resource.data.pricePerUnit is number
                    && request.resource.data.pricePerUnit > 0;
      allow update, delete: if request.auth != null
                    && resource.data.sellerId == request.auth.uid;
    }

    // Doğrulama fonksiyonu
    function _isValidUser(n, old) {
      return n.keys().hasAll(['wallet','profile','bank','stocks','crypto',
                              'production','commerce','properties','government','stats'])
          && n.wallet.tl      is number
          && n.wallet.tl      >= -500000000
          && n.wallet.tl      <= 10000000000000
          && n.profile.elmas  is int
          && n.profile.elmas  >= 0
          && n.profile.elmas  <= 100000
          && n.profile.level  is int
          && n.profile.level  >= 1
          && n.profile.level  <= 100
          && (old == null || n.profile.level >= old.profile.level)
          && (old == null || (n.wallet.tl - old.wallet.tl) <= 5000000000)
          && n.profile.creditScore is int
          && n.profile.creditScore >= 300
          && n.profile.creditScore <= 900;
    }
  }
}
*/

// ════════════════════════════════════════════════════════════
// DB Yardımcıları
// ════════════════════════════════════════════════════════════
var DB = {

  async getUser(uid) {
    try {
      var snap = await window.fbDB.collection("users").doc(uid).get();
      return snap.exists ? snap.data() : null;
    } catch (e) { return null; }
  },

  async saveUser(uid, data) {
    if (typeof SEC !== "undefined" && !SEC.canSave())   return true;
    if (typeof SEC !== "undefined" && !SEC.validateState(data)) {
      SEC.violation("Geçersiz state kaydedilmeye çalışıldı", false);
      return false;
    }
    try {
      await window.fbDB.collection("users").doc(uid).set(
        Object.assign({}, data, { _updatedAt: firebase.firestore.FieldValue.serverTimestamp() }),
        { merge: true }
      );
      if (typeof SEC !== "undefined") SEC.captureHash();
      return true;
    } catch (e) {
      if (e.code === "permission-denied" && typeof SEC !== "undefined") {
        SEC.violation("Sunucu veriyi reddetti (permission-denied)", false);
      }
      return false;
    }
  },

  async logTransaction(uid, tx) {
    try {
      await window.fbDB.collection("users").doc(uid)
        .collection("transactions").add(
          Object.assign({}, tx, { _ts: firebase.firestore.FieldValue.serverTimestamp() })
        );
    } catch (e) { /* sessiz */ }
  },

  async getTransactions(uid, lim) {
    try {
      var snap = await window.fbDB.collection("users").doc(uid)
        .collection("transactions").orderBy("_ts","desc").limit(lim||30).get();
      return snap.docs.map(function(d){ return Object.assign({id:d.id}, d.data()); });
    } catch (e) { return []; }
  },

  async logSecurityEvent(uid, reason) {
    try {
      await window.fbDB.collection("security_log").add({
        uid: uid, reason: reason,
        ua:  navigator.userAgent,
        ts:  firebase.firestore.FieldValue.serverTimestamp()
      });
    } catch (e) { /* sessiz */ }
  },

  async addListing(data) {
    try {
      var ref = await window.fbDB.collection("marketplace").add(
        Object.assign({}, data, { _createdAt: firebase.firestore.FieldValue.serverTimestamp(), active: true })
      );
      return ref.id;
    } catch (e) { return null; }
  },

  async getListings(lim) {
    try {
      var snap = await window.fbDB.collection("marketplace")
        .where("active","==",true).orderBy("_createdAt","desc").limit(lim||50).get();
      return snap.docs.map(function(d){ return Object.assign({id:d.id}, d.data()); });
    } catch (e) { return []; }
  }
};
