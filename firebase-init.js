/* ==========================================================================
   firebase-init.js — Firebase başlatma + global yardımcılar
   ========================================================================== */

const firebaseConfig = {
  apiKey: "AIzaSyB5pl78DRao2SmUWsMYMSZ6YbfX4rtRNdc",
  authDomain: "gamezone-e11b0.firebaseapp.com",
  databaseURL: "https://gamezone-e11b0-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "gamezone-e11b0",
  storageBucket: "gamezone-e11b0.firebasestorage.app",
  messagingSenderId: "775694460272",
  appId: "1:775694460272:web:7e5fd5691df9d8399d5bb5",
  measurementId: "G-3M7FXX8XR4"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db   = firebase.database();

/* ===== Global oyun durumu ===== */
window.GZ = {
  user: null,            // firebase user
  data: null,            // user veri ağacı /users/{uid}
  uid: null,
  listeners: [],         // off etmek için
  prices: {},            // kripto fiyatları
  online: true,
  currentTab: 'dukkan',
  cache: { users:{}, brands:{} },
  pricesUnsub: null,
  cashUnsub: null,
};

/* ===== Yardımcılar ===== */
const fmt = (n) => {
  if (n === undefined || n === null || isNaN(n)) return '0,00';
  const num = Number(n);
  if (Math.abs(num) >= 1e9) return (num/1e9).toFixed(2)+' Mr';
  if (Math.abs(num) >= 1e6) return (num/1e6).toFixed(2)+' M';
  return num.toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2});
};
const fmtInt = (n) => Math.floor(Number(n||0)).toLocaleString('tr-TR');
const cashFmt = (n) => fmt(n) + ' ₺';
const now = () => Date.now();
const $ = (sel,root=document) => root.querySelector(sel);
const $$ = (sel,root=document) => [...root.querySelectorAll(sel)];

/* Toast */
function toast(msg, kind='info', ms=3000){
  const root = $('#toastRoot');
  const el = document.createElement('div');
  el.className = 'toast ' + (kind==='info'?'':kind);
  el.textContent = msg;
  root.appendChild(el);
  setTimeout(()=>el.remove(), ms);
}

/* DB yardımcıları (transaction güvenli) */
async function dbGet(path){
  const snap = await db.ref(path).once('value');
  return snap.val();
}
async function dbSet(path, val){
  return db.ref(path).set(val);
}
async function dbUpdate(path, obj){
  return db.ref(path).update(obj);
}
async function dbPush(path, val){
  return db.ref(path).push(val);
}
async function dbTransaction(path, updateFn){
  return db.ref(path).transaction(updateFn);
}

/* Para güvenli ekleme/çıkarma — transaction ile race condition önler
 * v2 GÜNCELLEME — Bug fix:
 *   • NaN/Infinity kontrolü
 *   • Negatif amount engellemesi
 *   • UID kontrolü
 *   • Console log (debug için)
 */
async function addCash(uid, amount, reason=''){
  if (!uid || typeof uid !== 'string') { console.warn('[addCash] Geçersiz uid:', uid); return false; }
  if (!isFinite(amount) || isNaN(amount)) { console.warn('[addCash] NaN/Infinity:', amount); return false; }
  if (amount < 0) { console.warn('[addCash] Negatif amount engellendi:', amount); return false; }
  if (amount === 0) return true;
  if (amount > 1e15) { console.warn('[addCash] Anormal miktar engellendi:', amount); return false; }

  // ── ANLIK VERGİ KESİMİ ──
  // Satış gelirlerinde (shop-sale, harvest, player-market-sale, export, crypto-sell, stock-sell)
  // admin tarafından belirlenen oran kadar vergi anında kesilir
  const VERGİLİ_TIPLER = ['shop-sale','harvest','player-market-sale','export','crypto-sell','stock-sell','auction-win'];
  let vergiKesilen = 0;
  let netAmount = amount;

  if (VERGİLİ_TIPLER.includes(reason)) {
    try {
      const mbRates = await db.ref('system/merkezBankasi').once('value').then(s=>s.val()) || {};
      const oran = Math.min(0.9, Math.max(0, (mbRates.gelirOrani || 40) / 100));
      vergiKesilen = +(amount * oran).toFixed(2);
      netAmount = +(amount - vergiKesilen).toFixed(2);

      // Vergiyi admin/merkez bankası hesabına aktar
      const merkez = await db.ref('system/authorityUid').once('value').then(s=>s.val());
      if (merkez && vergiKesilen > 0) {
        db.ref(`users/${merkez}/money`).transaction(c => (c||0) + vergiKesilen);
        db.ref('system/merkezBankasi/totalVergi').transaction(c => (c||0) + vergiKesilen);
        // Finans akış logu
        const logKey = db.ref('financeLog').push().key;
        db.ref('financeLog/' + logKey).set({
          uid, reason, gross: amount, tax: vergiKesilen, net: netAmount,
          ts: firebase.database.ServerValue.TIMESTAMP,
          username: (window.GZ?.data?.username) || uid.slice(0,8)
        });
      }
    } catch(e) { netAmount = amount; vergiKesilen = 0; }
  }

  let newBalance = 0;
  const r = await db.ref(`users/${uid}/money`).transaction(cur => {
    newBalance = Math.max(0, (cur||0) + netAmount);
    return newBalance;
  });

  if (r.committed && typeof window.logTransaction === 'function') {
    try { window.logTransaction(uid, 'in', netAmount, reason + (vergiKesilen>0?` (vergi:${vergiKesilen})` : ''), newBalance); } catch(e) {}
  }

  // Haftalık gelir takibi (vergi sonrası net)
  if (r.committed && netAmount > 0) {
    db.ref(`users/${uid}/weeklyRevenue`).transaction(c => (c||0) + netAmount).catch(()=>{});
  }

  return r.committed;
}

async function spendCash(uid, amount, reason=''){
  if (!uid || typeof uid !== 'string') {
    console.warn('[spendCash] Geçersiz uid:', uid);
    return false;
  }
  if (!isFinite(amount) || isNaN(amount)) {
    console.warn('[spendCash] NaN/Infinity:', amount);
    return false;
  }
  if (amount <= 0) return false;
  if (amount > 1e15) {
    console.warn('[spendCash] Anormal miktar:', amount);
    return false;
  }

  let newBalance = 0;
  const result = await db.ref(`users/${uid}/money`).transaction(cur => {
    if ((cur||0) < amount) return; // abort
    newBalance = cur - amount;
    return newBalance;
  });

  // İşlem log'u
  if (result.committed && typeof window.logTransaction === 'function') {
    try { window.logTransaction(uid, 'out', amount, reason, newBalance); } catch(e) {}
  }

  return result.committed && result.snapshot.exists();
}

async function addDiamonds(uid, amount){
  if (!uid || !isFinite(amount) || isNaN(amount) || amount < 0) return false;
  if (amount === 0) return true;
  const r = await db.ref(`users/${uid}/diamonds`).transaction(cur => Math.max(0,(cur||0) + Math.floor(amount)));
  return r.committed;
}

async function spendDiamonds(uid, amount){
  if (!uid || !isFinite(amount) || isNaN(amount) || amount <= 0) return false;
  amount = Math.floor(amount);
  const r = await db.ref(`users/${uid}/diamonds`).transaction(cur => {
    if ((cur||0) < amount) return;
    return cur - amount;
  });
  return r.committed;
}

/* XP ve seviye */
function xpForLevel(lv){
  // Dengeli XP eğrisi — düşük seviyelerde hızlı, yüksekte çok zorlaşır
  // Lv10: ~63K toplam, Lv50: ~6M toplam, Lv100: ~44M toplam
  return Math.floor(200 * Math.pow(lv, 1.9));
}
async function addXP(uid, amount){
  await db.ref(`users/${uid}/xp`).transaction(cur => (cur||0)+amount);
  // Seviye atlat
  const u = await dbGet(`users/${uid}`);
  let lv = u.level || 1;
  let xp = u.xp || 0;
  let leveledUp = false;
  while (xp >= xpForLevel(lv)){
    xp -= xpForLevel(lv);
    lv++;
    leveledUp = true;
  }
  if (leveledUp){
    await dbUpdate(`users/${uid}`, { level: lv, xp });
    if (uid === GZ.uid){
      toast(`🎉 Seviye atladın! Yeni seviye: ${lv}`, 'success', 4000);
    }
  }
}

/* Toplam servet (sıralama için) */
async function calcNetWorth(uid){
  const u = await dbGet(`users/${uid}`);
  if (!u) return 0;
  let total = (u.money||0);
  // Banka bakiyesi
  const bank = await dbGet(`bank/${uid}`);
  if (bank){
    total += (bank.balance||0) + (bank.investment||0) - (bank.loan||0);
  }
  // Kripto
  const holdings = await dbGet(`crypto/holdings/${uid}`) || {};
  for (const sym of Object.keys(holdings)){
    const p = await dbGet(`crypto/prices/${sym}/current`);
    total += (holdings[sym] || 0) * (p || 0);
  }
  return total;
}

/* Online/offline durum */
function setupPresence(uid){
  const ref = db.ref(`users/${uid}/online`);
  const lastRef = db.ref(`users/${uid}/lastSeen`);
  db.ref('.info/connected').on('value', s => {
    if (s.val() === false) return;
    ref.onDisconnect().set(false);
    lastRef.onDisconnect().set(firebase.database.ServerValue.TIMESTAMP);
    ref.set(true);
  });
}

/* Şehir listesi (81 il) */
const ILLER = [
  "Adana","Adıyaman","Afyonkarahisar","Ağrı","Amasya","Ankara","Antalya","Artvin","Aydın","Balıkesir",
  "Bilecik","Bingöl","Bitlis","Bolu","Burdur","Bursa","Çanakkale","Çankırı","Çorum","Denizli",
  "Diyarbakır","Edirne","Elazığ","Erzincan","Erzurum","Eskişehir","Gaziantep","Giresun","Gümüşhane","Hakkari",
  "Hatay","Isparta","Mersin","İstanbul","İzmir","Kars","Kastamonu","Kayseri","Kırklareli","Kırşehir",
  "Kocaeli","Konya","Kütahya","Malatya","Manisa","Kahramanmaraş","Mardin","Muğla","Muş","Nevşehir",
  "Niğde","Ordu","Rize","Sakarya","Samsun","Siirt","Sinop","Sivas","Tekirdağ","Tokat",
  "Trabzon","Tunceli","Şanlıurfa","Uşak","Van","Yozgat","Zonguldak","Aksaray","Bayburt","Karaman",
  "Kırıkkale","Batman","Şırnak","Bartın","Ardahan","Iğdır","Yalova","Karabük","Kilis","Osmaniye","Düzce"
];
window.ILLER = ILLER;

/* ============================================================
   GELİŞTİRİLMİŞ LEVEL UP — ses + başarım kontrolü
   ============================================================ */
const _origAddXP = window.addXP;
window.addXP = async function(uid, amount){
  if (typeof _origAddXP === 'function'){
    const uBefore = await dbGet(`users/${uid}`);
    const lvBefore = uBefore?.level || 1;
    await _origAddXP(uid, amount);
    const uAfter = await dbGet(`users/${uid}`);
    const lvAfter = uAfter?.level || 1;
    if (lvAfter > lvBefore && uid === GZ.uid){
      if (window.SoundManager) SoundManager.play('levelup');
      // Başarım kontrolü
      if (typeof checkAndGrantAchievement === 'function'){
        if (lvAfter >= 10) await checkAndGrantAchievement(uid, 'lv10');
        if (lvAfter >= 25) await checkAndGrantAchievement(uid, 'lv25');
        if (lvAfter >= 50) await checkAndGrantAchievement(uid, 'lv50');
      }
    }
  }
};

/* NET WORTH — servet başarımı */
const _origCalcNetWorth = window.calcNetWorth;
window.calcNetWorth = async function(uid){
  const nw = typeof _origCalcNetWorth === 'function' ? await _origCalcNetWorth(uid) : 0;
  if (uid === GZ.uid && typeof checkAndGrantAchievement === 'function'){
    if (nw >= 1000000)       await checkAndGrantAchievement(uid, 'rich_1');
    if (nw >= 1000000000)    await checkAndGrantAchievement(uid, 'rich_2');
  }
  return nw;
};

/* ============================================================
   EKSTRA: Canlı destek + admin entegrasyon yardımcıları
   ============================================================ */

/* pushNotif — herhangi yerden kullanılabilir */
async function pushNotif(uid, msg, icon, type) {
  if (!uid || !msg) return;
  try {
    await db.ref('notifs/' + uid).push({
      type: type || 'system',
      icon: icon || '🔔',
      msg,
      ts: firebase.database.ServerValue.TIMESTAMP,
      read: false
    });
  } catch(e) {}
}
window.pushNotif = pushNotif;

/* logTransaction — işlem geçmişi */
window.logTransaction = async function(uid, dir, amount, reason, newBalance) {
  try {
    await db.ref('txHistory/' + uid).push({
      dir, amount, reason,
      newBalance: newBalance || 0,
      ts: firebase.database.ServerValue.TIMESTAMP
    });
  } catch(e) {}
};

/* Güvenli sayı formatlama */
window.safeFmt = function(n) {
  if (!isFinite(n) || isNaN(n)) return '0';
  if (Math.abs(n) >= 1e9) return (n/1e9).toFixed(2)+' Mr';
  if (Math.abs(n) >= 1e6) return (n/1e6).toFixed(2)+' M';
  if (Math.abs(n) >= 1e3) return (n/1e3).toFixed(1)+' B';
  return n.toFixed(2);
};

/* Firebase hazır sinyali */
document.dispatchEvent(new Event('firebaseReady'));
window.KOMISYON={dukkan:.05,pazar:.05,oyunpazari:.03,ihracat:.04,ihale:.06,kripto:.02,borsa:.02,futures:.03};
window.KREDI_VARSAYILAN=100;window.KREDI_MAX_LIMIT=1000;window.KREDI_MIN_NOT=40;
window.getKrediLimit=n=>(!n||n<window.KREDI_MIN_NOT)?0:Math.min(window.KREDI_MAX_LIMIT,Math.floor(n*10));
window.getKrediNotu=window.getKrediNotu||async function(uid){const v=await dbGet('users/'+uid+'/krediNotu');return v!=null?v:100;};
window.updateKrediNotu=window.updateKrediNotu||async function(uid,d){await db.ref('users/'+uid+'/krediNotu').transaction(c=>Math.max(0,Math.min(100,(c!=null?c:100)+d)));};
