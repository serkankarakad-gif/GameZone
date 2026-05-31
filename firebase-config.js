// ══════════════════════════════════════════════
//  WAR ZONE v4 — FIREBASE CONFIG & AUTH (Email/Password)
// ══════════════════════════════════════════════

let _fbReady = false;
let currentUser = null;

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

  // ── Auth state listener — controls entire screen flow ──
  firebase.auth().onAuthStateChanged(user => {
    currentUser = user;
    const authModal  = document.getElementById('auth-modal');
    const nameModal  = document.getElementById('name-modal');
    const lobbyEl    = document.getElementById('lobby');

    if (user) {
      // User logged in — load data then decide what to show
      if (authModal) authModal.style.display = 'none';
      loadDataFromFirebase();
    } else {
      // Not logged in — show auth screen
      if (authModal)  authModal.style.display  = 'flex';
      if (nameModal)  nameModal.style.display   = 'none';
      if (lobbyEl)    lobbyEl.style.display      = 'none';
    }
  });

} catch(e) {
  console.warn('[FB] Init failed:', e);
  // Full fallback: skip auth entirely
  setTimeout(() => {
    loadDataLocal();
    const authModal = document.getElementById('auth-modal');
    const nameModal = document.getElementById('name-modal');
    if (authModal) authModal.style.display = 'none';
    if (nameModal) nameModal.style.display = 'flex';
  }, 120);
}

function fbDB() {
  return _fbReady ? firebase.database() : null;
}

// ══════════════════════════════════════════════
//  AUTH UI HELPERS
// ══════════════════════════════════════════════

function showAuthTab(tab) {
  const loginForm  = document.getElementById('auth-login-form');
  const regForm    = document.getElementById('auth-register-form');
  const loginBtn   = document.getElementById('tab-login-btn');
  const regBtn     = document.getElementById('tab-register-btn');
  if (loginForm) loginForm.style.display  = tab === 'login'    ? 'flex' : 'none';
  if (regForm)   regForm.style.display    = tab === 'register' ? 'flex' : 'none';
  if (loginBtn)  loginBtn.classList.toggle('active',  tab === 'login');
  if (regBtn)    regBtn.classList.toggle('active',    tab === 'register');
  hideAuthMsg();
}

function showAuthMsg(msg, isOk) {
  const el = document.getElementById('auth-error');
  if (!el) return;
  el.textContent = msg;
  el.style.display = 'block';
  el.style.color   = isOk ? '#44ff88' : '#ff6666';
  el.style.borderColor = isOk ? 'rgba(50,200,80,0.4)' : 'rgba(200,30,30,0.3)';
}
function hideAuthMsg() {
  const el = document.getElementById('auth-error');
  if (el) el.style.display = 'none';
}

function setAuthLoading(on) {
  const ld = document.getElementById('auth-loading');
  if (ld) ld.style.display = on ? 'block' : 'none';
  ['auth-login-btn','auth-register-btn'].forEach(id => {
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
    .then(() => { setAuthLoading(false); })
    .catch(err => {
      setAuthLoading(false);
      const TR = {
        'auth/user-not-found':    'Bu e-posta kayıtlı değil.',
        'auth/wrong-password':    'Şifre hatalı.',
        'auth/invalid-email':     'Geçersiz e-posta adresi.',
        'auth/invalid-credential':'E-posta veya şifre hatalı.',
        'auth/too-many-requests': 'Çok fazla deneme. Biraz bekleyin.',
        'auth/user-disabled':     'Bu hesap devre dışı bırakıldı.',
      };
      showAuthMsg(TR[err.code] || ('Hata: ' + err.message));
    });
}

// ── KAYIT OL ──
function doRegister() {
  const name  = (document.getElementById('auth-reg-name')?.value     || '').trim().toUpperCase().slice(0,12);
  const email = (document.getElementById('auth-reg-email')?.value    || '').trim();
  const pass  =  document.getElementById('auth-reg-password')?.value || '';
  if (!name)          { showAuthMsg('Oyuncu adı gerekli!'); return; }
  if (!email)         { showAuthMsg('E-posta adresi gerekli!'); return; }
  if (pass.length < 6){ showAuthMsg('Şifre en az 6 karakter olmalı!'); return; }
  hideAuthMsg();
  setAuthLoading(true);

  firebase.auth().createUserWithEmailAndPassword(email, pass)
    .then(result => {
      currentUser = result.user;
      LD.playerName = name;
      saveData();
      setAuthLoading(false);
      // onAuthStateChanged will fire and route to lobby
    })
    .catch(err => {
      setAuthLoading(false);
      const TR = {
        'auth/email-already-in-use': 'Bu e-posta zaten kayıtlı. Giriş yapın.',
        'auth/invalid-email':        'Geçersiz e-posta adresi.',
        'auth/weak-password':        'Şifre çok zayıf (min. 6 karakter).',
        'auth/operation-not-allowed':'E-posta girişi henüz açılmamış.',
      };
      showAuthMsg(TR[err.code] || ('Kayıt hatası: ' + err.message));
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
  firebase.auth().signOut().catch(e => console.warn(e));
  // onAuthStateChanged(null) will show auth modal automatically
  const lobby = document.getElementById('lobby');
  if (lobby) lobby.style.display = 'none';
}

// ══════════════════════════════════════════════
//  SAVE / LOAD
// ══════════════════════════════════════════════

function saveData() {
  saveDataLocal();
  if (!_fbReady || !currentUser) return;
  try {
    const db = fbDB();
    db.ref('players/' + currentUser.uid).set({
      playerName:      LD.playerName,
      bestScore:       LD.bestScore,
      totalKills:      LD.totalKills,
      gamesPlayed:     LD.gamesPlayed,
      wins:            LD.wins,
      xp:              LD.xp,
      settings:        LD.settings,
      unlockedWeapons: LD.unlockedWeapons,
      lastSeen:        firebase.database.ServerValue.TIMESTAMP
    });
  } catch(e) { console.warn('[FB] Save failed:', e); }
}

function loadDataFromFirebase() {
  if (!_fbReady || !currentUser) { loadDataLocal(); _afterLoad(); return; }
  try {
    const db = fbDB();
    db.ref('players/' + currentUser.uid).once('value').then(snap => {
      const s = snap.val();
      if (s) applyLoadedData(s);
      else   loadDataLocal();
      _afterLoad();
    }).catch(() => { loadDataLocal(); _afterLoad(); });
  } catch(e) {
    console.warn('[FB] Load failed:', e);
    loadDataLocal(); _afterLoad();
  }
}

function _afterLoad() {
  // Route: if player has a name → lobby, else name modal
  const nameModal = document.getElementById('name-modal');
  if (LD.playerName && LD.playerName !== 'KOMUTAN') {
    if (typeof openLobby === 'function') {
      const lobby = document.getElementById('lobby');
      if (!lobby || lobby.style.display === 'none') openLobby();
      else { refreshLobbyStats?.(); updateRankBadge?.(); }
    } else {
      if (nameModal) nameModal.style.display = 'flex';
    }
  } else {
    if (nameModal) nameModal.style.display = 'flex';
  }
}

// ── localStorage fallback ──
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

// ── Leaderboard ──
function saveScoreFirebase(name, score, kills, place) {
  if (!_fbReady) return;
  try {
    const db  = fbDB();
    const uid = currentUser ? currentUser.uid : 'anon_' + Date.now();
    db.ref('leaderboard/' + uid).transaction(ex => {
      if (!ex || score > (ex.score || 0))
        return { name, score, kills, place, timestamp: firebase.database.ServerValue.TIMESTAMP };
    });
  } catch(e) { console.warn('[FB] Score save:', e); }
}
