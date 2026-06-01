// ══════════════════════════════════════════════
//  WAR ZONE v4 — FIREBASE CONFIG & AUTH (Email/Password)
// ══════════════════════════════════════════════

let _fbReady = false;
let currentUser = null;
let _domReady = false;
let _pendingAfterLoad = false;

// DOM hazır olduğunda bekleyen lobby açılışını başlat
document.addEventListener('DOMContentLoaded', () => {
  _domReady = true;
  if (_pendingAfterLoad) _afterLoad();
});

try {
  firebase.initializeApp({
    apiKey:            "AIzaSyB5pl78DRao2SmUWsMYMSZ6YbfX4rtRNdc",
    authDomain:        "gamezone-e11b0.firebaseapp.com",
    databaseURL:       "https://gamezone-e11b0-default-rtdb.europe-west1.firebasedatabase.app",
    projectId:         "gamezone-e11b0",
    storageBucket:     "gamezone-e11b0.firebasestorage.app",
    messagingSenderId: "775694460272",
    appId:             "1:775694460272:web:7e5fd5691df9d8399d5bb5"
  });
  _fbReady = true;

  firebase.auth().onAuthStateChanged(user => {
    // Eğer eski anonim oturum varsa hemen sil, auth ekranına dön
    if (user && user.isAnonymous) {
      firebase.auth().signOut();
      return;
    }

    currentUser = user;

    if (user) {
      // Gerçek kullanıcı (email/password) → veriyi yükle
      _hideAuthModal();
      loadDataFromFirebase();
    } else {
      // Giriş yok → sadece auth ekranını göster, başka hiçbir şey açma
      _showAuthModal();
    }
  });

} catch(e) {
  console.warn('[FB] Firebase init hatası:', e);
  // Firebase tamamen çalışmıyorsa localStorage ile devam et
  setTimeout(() => {
    loadDataLocal();
    _hideAuthModal();

  }, 150);
}

// ── Ekran yardımcıları ──
function _showAuthModal() {
  const el = document.getElementById('auth-modal');
  if (el) el.style.display = 'flex';

  const lb = document.getElementById('lobby');
  if (lb) lb.style.display = 'none';
}
function _hideAuthModal() {
  const el = document.getElementById('auth-modal');
  if (el) el.style.display = 'none';
}
// name-modal kaldırıldı

function fbDB() {
  return _fbReady ? firebase.database() : null;
}

// ══════════════════════════════════════════════
//  AUTH SEKME / FORM KONTROLLERI
// ══════════════════════════════════════════════

function showAuthTab(tab) {
  const lf = document.getElementById('auth-login-form');
  const rf = document.getElementById('auth-register-form');
  const lb = document.getElementById('tab-login-btn');
  const rb = document.getElementById('tab-register-btn');
  if (lf) lf.style.display = tab === 'login'    ? 'flex' : 'none';
  if (rf) rf.style.display = tab === 'register' ? 'flex' : 'none';
  if (lb) lb.classList.toggle('active', tab === 'login');
  if (rb) rb.classList.toggle('active', tab === 'register');
  hideAuthMsg();
}

function showAuthMsg(msg, ok) {
  const el = document.getElementById('auth-error');
  if (!el) return;
  el.textContent = msg;
  el.style.display = 'block';
  el.style.color = ok ? '#44ff88' : '#ff6666';
  el.style.borderColor = ok ? 'rgba(50,200,80,0.4)' : 'rgba(200,30,30,0.35)';
}
function hideAuthMsg() {
  const el = document.getElementById('auth-error');
  if (el) el.style.display = 'none';
}
function setAuthLoading(on) {
  const ld = document.getElementById('auth-loading');
  if (ld) ld.style.display = on ? 'block' : 'none';
  ['auth-login-btn', 'auth-register-btn'].forEach(id => {
    const b = document.getElementById(id);
    if (b) b.disabled = on;
  });
}

// ── GİRİŞ YAP ──
function doLogin() {
  const email = (document.getElementById('auth-email')?.value || '').trim();
  const pass  =  document.getElementById('auth-password')?.value || '';
  if (!email || !pass) { showAuthMsg('E-posta ve şifre gerekli!'); return; }
  hideAuthMsg();
  setAuthLoading(true);
  firebase.auth().signInWithEmailAndPassword(email, pass)
    .then(() => setAuthLoading(false))
    .catch(err => {
      setAuthLoading(false);
      const TR = {
        'auth/user-not-found':    'Bu e-posta kayıtlı değil.',
        'auth/wrong-password':    'Şifre hatalı.',
        'auth/invalid-email':     'Geçersiz e-posta adresi.',
        'auth/invalid-credential':'E-posta veya şifre hatalı.',
        'auth/too-many-requests': 'Çok fazla deneme. Bekleyin.',
        'auth/user-disabled':     'Bu hesap devre dışı.',
      };
      showAuthMsg(TR[err.code] || 'Giriş hatası: ' + err.message);
    });
}

// ── KAYIT OL ──
function doRegister() {
  const name  = (document.getElementById('auth-reg-name')?.value     || '').trim().toUpperCase().slice(0, 12);
  const email = (document.getElementById('auth-reg-email')?.value    || '').trim();
  const pass  =  document.getElementById('auth-reg-password')?.value || '';
  if (!name)           { showAuthMsg('Oyuncu adı gerekli!'); return; }
  if (!email)          { showAuthMsg('E-posta adresi gerekli!'); return; }
  if (pass.length < 6) { showAuthMsg('Şifre en az 6 karakter olmalı!'); return; }
  hideAuthMsg();
  setAuthLoading(true);
  firebase.auth().createUserWithEmailAndPassword(email, pass)
    .then(result => {
      currentUser = result.user;
      LD.playerName = name;
      saveData();
      setAuthLoading(false);
      // onAuthStateChanged devreye girer ve lobby'i açar
    })
    .catch(err => {
      setAuthLoading(false);
      const TR = {
        'auth/email-already-in-use':  'Bu e-posta zaten kayıtlı. Giriş yapın.',
        'auth/invalid-email':         'Geçersiz e-posta adresi.',
        'auth/weak-password':         'Şifre çok zayıf (min. 6 karakter).',
        'auth/operation-not-allowed': 'E-posta girişi Firebase\'de açılmamış!',
      };
      showAuthMsg(TR[err.code] || 'Kayıt hatası: ' + err.message);
    });
}

// ── ŞİFREMİ UNUTTUM ──
function doForgotPassword() {
  const email = (document.getElementById('auth-email')?.value || '').trim();
  if (!email) { showAuthMsg('Önce e-posta adresinizi girin.'); return; }
  firebase.auth().sendPasswordResetEmail(email)
    .then(() => showAuthMsg('✅ Sıfırlama e-postası gönderildi!', true))
    .catch(err => showAuthMsg('Hata: ' + err.message));
}

// ── ÇIKIŞ YAP ──
function logoutUser() {
  if (!confirm('Çıkış yapmak istiyor musunuz?')) return;
  firebase.auth().signOut();
  // onAuthStateChanged(null) → _showAuthModal() otomatik çalışır
}

// ══════════════════════════════════════════════
//  VERİ KAYDET / YÜKLE
// ══════════════════════════════════════════════

function saveData() {
  saveDataLocal();
  if (!_fbReady || !currentUser) return;
  try {
    firebase.database().ref('players/' + currentUser.uid).set({
      playerName:      LD.playerName,
      bestScore:       LD.bestScore,
      totalKills:      LD.totalKills,
      gamesPlayed:     LD.gamesPlayed,
      wins:            LD.wins,
      xp:              LD.xp,
      settings:        LD.settings,
      unlockedWeapons: LD.unlockedWeapons,
      lastSeen:        firebase.database.ServerValue.TIMESTAMP,
    });
  } catch(e) { console.warn('[FB] Kayıt hatası:', e); }
}

function loadDataFromFirebase() {
  if (!_fbReady || !currentUser) { loadDataLocal(); _afterLoad(); return; }
  try {
    firebase.database().ref('players/' + currentUser.uid).once('value')
      .then(snap => {
        const s = snap.val();
        if (s) applyLoadedData(s);
        else   loadDataLocal();
        _afterLoad();
      })
      .catch(() => { loadDataLocal(); _afterLoad(); });
  } catch(e) {
    console.warn('[FB] Yükleme hatası:', e);
    loadDataLocal();
    _afterLoad();
  }
}

function _afterLoad() {
  // DOM ve tüm JS dosyaları henüz yüklenmediyse bekle
  if (!_domReady) {
    _pendingAfterLoad = true;
    return;
  }
  _pendingAfterLoad = false;

  if (currentUser) {
    // İsim yoksa email'den üret
    if (!LD.playerName || LD.playerName === 'KOMUTAN') {
      const fallback = (currentUser.email || 'OYUNCU').split('@')[0].toUpperCase().slice(0, 12);
      LD.playerName = fallback;
      saveData();
    }
    if (typeof openLobby === 'function') {
      openLobby();
    } else {
      // openLobby yoksa 100ms sonra tekrar dene (script yükleniyor olabilir)
      setTimeout(_afterLoad, 100);
    }
  }
}

// ── localStorage yedek ──
function saveDataLocal() {
  try {
    localStorage.setItem('wz4_save', JSON.stringify({
      playerName:LD.playerName, bestScore:LD.bestScore, totalKills:LD.totalKills,
      gamesPlayed:LD.gamesPlayed, wins:LD.wins, xp:LD.xp,
      settings:LD.settings, unlockedWeapons:LD.unlockedWeapons,
    }));
  } catch(e) {}
}
function loadDataLocal() {
  try { applyLoadedData(JSON.parse(localStorage.getItem('wz4_save') || '{}')); } catch(e) {}
}
function applyLoadedData(s) {
  if (s.playerName)       LD.playerName       = s.playerName;
  if (s.bestScore)        LD.bestScore        = s.bestScore;
  if (s.totalKills)       LD.totalKills       = s.totalKills;
  if (s.gamesPlayed)      LD.gamesPlayed      = s.gamesPlayed;
  if (s.wins)             LD.wins             = s.wins;
  if (s.xp !== undefined) LD.xp               = s.xp;
  if (s.settings)         Object.assign(LD.settings, s.settings);
  if (s.unlockedWeapons)  LD.unlockedWeapons  = s.unlockedWeapons;
}

// ── Liderboard ──
function saveScoreFirebase(name, score, kills, place) {
  if (!_fbReady) return;
  try {
    const uid = currentUser ? currentUser.uid : 'anon_' + Date.now();
    firebase.database().ref('leaderboard/' + uid).transaction(ex => {
      if (!ex || score > (ex.score || 0))
        return { name, score, kills, place, timestamp: firebase.database.ServerValue.TIMESTAMP };
    });
  } catch(e) { console.warn('[FB] Liderboard hatası:', e); }
}
