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

/* Para güvenli ekleme/çıkarma — transaction ile race condition önler */
async function addCash(uid, amount, reason=''){
  const r = await db.ref(`users/${uid}/money`).transaction(cur => {
    return Math.max(0, (cur||0) + amount);
  });
  if (reason && uid === GZ.uid){
    // log opsiyonel
  }
  return r.committed;
}
async function spendCash(uid, amount, reason=''){
  if (amount <= 0) return false;
  const result = await db.ref(`users/${uid}/money`).transaction(cur => {
    if ((cur||0) < amount) return; // abort
    return cur - amount;
  });
  return result.committed && result.snapshot.exists();
}
async function addDiamonds(uid, amount){
  return db.ref(`users/${uid}/diamonds`).transaction(cur => Math.max(0,(cur||0)+amount));
}
async function spendDiamonds(uid, amount){
  const r = await db.ref(`users/${uid}/diamonds`).transaction(cur => {
    if ((cur||0) < amount) return;
    return cur - amount;
  });
  return r.committed;
}

/* XP ve seviye */
function xpForLevel(lv){
  // Seviye başına gereken XP — yüksek seviyelerde zorlaşır
  // L1->L2: 100, L2->L3: 200, üstü kübik artış
  return Math.floor(100 * Math.pow(lv, 1.6));
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
