// ══════════════════════════════════════════════
//  WAR ZONE v4 — FIREBASE CONFIG & AUTH
// ══════════════════════════════════════════════

let _fbReady = false;
let currentUser = null;   // Firebase Auth user object (anonymous)

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

  // ── Anonymous sign-in so we have a stable UID ──
  firebase.auth().signInAnonymously()
    .then(result => {
      currentUser = result.user;
      console.log('[FB] Signed in anonymously:', currentUser.uid);
      // Load player data from Firebase after auth
      loadDataFromFirebase();
    })
    .catch(err => {
      console.warn('[FB] Auth failed, using localStorage fallback:', err);
      loadDataLocal();
    });

  firebase.auth().onAuthStateChanged(user => {
    currentUser = user;
  });

} catch(e) {
  console.warn('[FB] Init failed:', e);
  setTimeout(loadDataLocal, 100);
}

function fbDB() {
  return _fbReady ? firebase.database() : null;
}

// ── SAVE to Firebase (primary) + localStorage (backup) ──
function saveData() {
  // Always save to localStorage as backup
  saveDataLocal();

  // Save to Firebase under UID path
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

// ── LOAD from Firebase ──
function loadDataFromFirebase() {
  if (!_fbReady || !currentUser) { loadDataLocal(); return; }
  try {
    const db = fbDB();
    db.ref('players/' + currentUser.uid).once('value').then(snap => {
      const s = snap.val();
      if (s) {
        applyLoadedData(s);
      } else {
        // New user: try localStorage then apply defaults
        loadDataLocal();
      }
      // Refresh lobby UI if lobby is open
      if (document.getElementById('lobby').style.display !== 'none') {
        if (typeof refreshLobbyStats === 'function') refreshLobbyStats();
        if (typeof updateRankBadge  === 'function') updateRankBadge();
      }
    });
  } catch(e) {
    console.warn('[FB] Load failed:', e);
    loadDataLocal();
  }
}

// ── LOCAL FALLBACK ──
function saveDataLocal() {
  try {
    localStorage.setItem('wz4_save', JSON.stringify({
      playerName:      LD.playerName,
      bestScore:       LD.bestScore,
      totalKills:      LD.totalKills,
      gamesPlayed:     LD.gamesPlayed,
      wins:            LD.wins,
      xp:              LD.xp,
      settings:        LD.settings,
      unlockedWeapons: LD.unlockedWeapons,
    }));
  } catch(e) {}
}

function loadDataLocal() {
  try {
    const s = JSON.parse(localStorage.getItem('wz4_save') || '{}');
    applyLoadedData(s);
  } catch(e) {}
}

function applyLoadedData(s) {
  if (s.playerName)      LD.playerName       = s.playerName;
  if (s.bestScore)       LD.bestScore        = s.bestScore;
  if (s.totalKills)      LD.totalKills       = s.totalKills;
  if (s.gamesPlayed)     LD.gamesPlayed      = s.gamesPlayed;
  if (s.wins)            LD.wins             = s.wins;
  if (s.xp !== undefined) LD.xp             = s.xp;
  if (s.settings)        Object.assign(LD.settings, s.settings);
  if (s.unlockedWeapons) LD.unlockedWeapons  = s.unlockedWeapons;
}

// ── SAVE SCORE TO LEADERBOARD ──
function saveScoreFirebase(name, score, kills, place) {
  // Always update leaderboard in Firebase
  if (!_fbReady) return;
  try {
    const db = fbDB();
    const uid = currentUser ? currentUser.uid : 'anon_' + Date.now();
    // Keyed by uid so each player has one entry (best score wins)
    db.ref('leaderboard/' + uid).transaction(existing => {
      if (!existing || score > (existing.score || 0)) {
        return { name, score, kills, place, timestamp: firebase.database.ServerValue.TIMESTAMP };
      }
      return; // don't update if new score is lower
    });
  } catch(e) { console.warn('[FB] Score save:', e); }
}
