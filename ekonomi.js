/* ==========================================================================
   ekonomi.js — Ekonomi Çekirdeği
   - Dükkanlar (Reyon sistemi: ürün YOKKEN satış YOK)
   - Bahçe / Çiftlik / Fabrika / Maden (üretim hatları)
   - Lojistik (depo)
   - İhracat (gerçek talep listesi, oyuncu üretiminden satış)
   - İhale (gerçek zamanlı geri sayım, en yüksek teklif kazanır)
   - Kripto (rastgele dalgalanma, gerçek alım-satım)
   - Marka (oyuncu kurar, üyeler katılır)
   - Banka (vadeli, kredi, işletme gideri, maaş)
   - Pazar (kendi reyonlarından il halkına otomatik satış)
   - Mağaza (elmas paketleri, robot)
   ========================================================================== */

/* ============== ÜRÜN VERİTABANI ============== */
const URUNLER = {
  // Temel Gıda
  bugday_unu:      { name:"Buğday Unu",     emo:"🌾", base:4.50, cat:"temel", unit:"Kilo", lv:1 },
  ayicicek_yagi:   { name:"Ayçiçek Yağı",   emo:"🌻", base:8.50, cat:"temel", unit:"Litre", lv:1 },
  zeytinyagi:      { name:"Zeytinyağı",     emo:"🫒", base:12.0, cat:"temel", unit:"Litre", lv:2 },
  misir_unu:       { name:"Mısır Unu",      emo:"🌽", base:5.20, cat:"temel", unit:"Kilo", lv:1 },
  siyah_cay:       { name:"Siyah Çay",      emo:"🍵", base:14.0, cat:"temel", unit:"Kilo", lv:2 },
  yesil_cay:       { name:"Yeşil Çay",      emo:"🍃", base:18.0, cat:"temel", unit:"Kilo", lv:3 },
  seker:           { name:"Şeker",          emo:"🍬", base:6.80, cat:"temel", unit:"Kilo", lv:1 },
  findik_yagi:     { name:"Fındık Yağı",    emo:"🥜", base:22.0, cat:"temel", unit:"Litre", lv:4 },

  // Kahvaltılık & Süt
  tavuk_yumurtasi: { name:"Tavuk Yumurtası",emo:"🥚", base:1.20, cat:"kahvalti", unit:"Adet", lv:1 },
  hindi_yumurtasi: { name:"Hindi Yumurtası",emo:"🥚", base:2.40, cat:"kahvalti", unit:"Adet", lv:5 },
  kaz_yumurtasi:   { name:"Kaz Yumurtası",  emo:"🥚", base:3.80, cat:"kahvalti", unit:"Adet", lv:6 },
  inek_sutu:       { name:"İnek Sütü",      emo:"🥛", base:5.50, cat:"kahvalti", unit:"Litre", lv:1 },
  keci_sutu:       { name:"Keçi Sütü",      emo:"🥛", base:9.20, cat:"kahvalti", unit:"Litre", lv:3 },
  beyaz_peynir:    { name:"Beyaz Peynir",   emo:"🧀", base:32.0, cat:"kahvalti", unit:"Kilo", lv:2 },
  kasar_peyniri:   { name:"Kaşar Peyniri",  emo:"🧀", base:48.0, cat:"kahvalti", unit:"Kilo", lv:3 },
  zeytin:          { name:"Zeytin",         emo:"🫒", base:18.5, cat:"kahvalti", unit:"Kilo", lv:2 },
  petek_bal:       { name:"Petek Bal",      emo:"🍯", base:85.0, cat:"kahvalti", unit:"Kilo", lv:5 },
  suzme_bal:       { name:"Süzme Bal",      emo:"🍯", base:65.0, cat:"kahvalti", unit:"Kilo", lv:4 },
  polen:           { name:"Polen",          emo:"🌼", base:32.0, cat:"kahvalti", unit:"Kilo", lv:5 },

  // Meyve & Sebze
  domates:         { name:"Domates",        emo:"🍅", base:8.50, cat:"meyve", unit:"Kilo", lv:1 },
  patates:         { name:"Patates",        emo:"🥔", base:6.00, cat:"meyve", unit:"Kilo", lv:1 },
  sogan:           { name:"Soğan",          emo:"🧅", base:5.50, cat:"meyve", unit:"Kilo", lv:1 },
  elma:            { name:"Elma",           emo:"🍎", base:9.00, cat:"meyve", unit:"Kilo", lv:1 },
  uzum:            { name:"Üzüm",           emo:"🍇", base:14.0, cat:"meyve", unit:"Kilo", lv:2 },
  kiraz:           { name:"Kiraz",          emo:"🍒", base:24.0, cat:"meyve", unit:"Kilo", lv:3 },
  kayisi:          { name:"Kayısı",         emo:"🍑", base:16.0, cat:"meyve", unit:"Kilo", lv:2 },
  findik:          { name:"Fındık",         emo:"🥜", base:55.0, cat:"meyve", unit:"Kilo", lv:4 },

  // Et Ürünleri
  tavuk_eti:       { name:"Tavuk Eti",      emo:"🍗", base:48.0, cat:"et", unit:"Kilo", lv:3 },
  dana_eti:        { name:"Dana Eti",       emo:"🥩", base:185.0,cat:"et", unit:"Kilo", lv:5 },
  kuzu_eti:        { name:"Kuzu Eti",       emo:"🥩", base:220.0,cat:"et", unit:"Kilo", lv:6 },

  // Madenler
  altin:           { name:"Altın",          emo:"🥇", base:2400.0,cat:"maden", unit:"Gram", lv:30 },
  gumus:           { name:"Gümüş",          emo:"🥈", base:32.0, cat:"maden", unit:"Gram", lv:30 },
  bakir:           { name:"Bakır",          emo:"🟫", base:2.20, cat:"maden", unit:"Kilo", lv:30 },
  demir:           { name:"Demir",          emo:"⚙️", base:1.80, cat:"maden", unit:"Kilo", lv:30 },
  kromit:          { name:"Krom",           emo:"⛏️", base:4.50, cat:"maden", unit:"Kilo", lv:30 },

  // Fabrika ürünleri
  ekmek:           { name:"Ekmek",          emo:"🍞", base:5.00, cat:"firin", unit:"Adet", lv:2 },
  pasta:           { name:"Pasta",          emo:"🎂", base:120.0,cat:"firin", unit:"Adet", lv:4 },
  dondurma:        { name:"Dondurma",       emo:"🍦", base:18.0, cat:"firin", unit:"Adet", lv:3 },
  kimyasal_cozucu: { name:"Kimyasal Çözücü",emo:"⚗️", base:15.0, cat:"sanayi",unit:"Litre", lv:10 },
  cimento:         { name:"Çimento",        emo:"🧱", base:3.50, cat:"sanayi",unit:"Kilo", lv:8 },
  yun:             { name:"Yün",            emo:"🧶", base:28.0, cat:"sanayi",unit:"Kilo", lv:5 },
  keten_kumas:     { name:"Keten Kumaş",    emo:"🧵", base:65.0, cat:"sanayi",unit:"m²", lv:6 },
  eldiven:         { name:"Çift Eldiven",   emo:"🧤", base:42.0, cat:"sanayi",unit:"Çift", lv:5 },
};
window.URUNLER = URUNLER;

const URUN_KATEGORI = {
  temel: "Temel Gıda",
  kahvalti: "Kahvaltılık ve Süt",
  meyve: "Meyve ve Sebze",
  et: "Et Ürünleri",
  firin: "Fırın",
  sanayi: "Sanayi",
  maden: "Madenler"
};

/* ============== KRİPTO LİSTESİ ============== */
const KRIPTO = [
  { sym:"VGN", name:"Vortigon",   color:"#0ea5e9", base:54000, supply:350000000, vol:0.04 },
  { sym:"NNX", name:"Neonix",     color:"#eab308", base:430000, supply:120000000, vol:0.05 },
  { sym:"STC", name:"Solstice",   color:"#fb923c", base:75,    supply:9000000000, vol:0.06 },
  { sym:"HYN", name:"Hyperion",   color:"#7c3aed", base:0.0055,supply:8e11, vol:0.08 },
  { sym:"CLM", name:"Celestium",  color:"#22c55e", base:61000, supply:80000000, vol:0.04 },
  { sym:"AST", name:"Astrium",    color:"#ef4444", base:617,   supply:1500000000, vol:0.05 },
  { sym:"GLX", name:"Galactix",   color:"#dc2626", base:18.9,  supply:9e9, vol:0.05 },
  { sym:"ZTH", name:"Zenithium",  color:"#6366f1", base:28.3,  supply:3e9, vol:0.04 },
  { sym:"XEN", name:"Xenon",      color:"#f97316", base:68500000, supply:21000, vol:0.03 },
  { sym:"ORN", name:"Orionium",   color:"#3b82f6", base:3350000, supply:500000, vol:0.04 },
  { sym:"ZPH", name:"Zephyria",   color:"#06b6d4", base:14000, supply:1e8, vol:0.05 },
  { sym:"MTX", name:"Meteorix",   color:"#f43f5e", base:1.47,  supply:5e10, vol:0.07 },
  { sym:"LMX", name:"Luminex",    color:"#e11d48", base:94000, supply:8e7, vol:0.04 },
  { sym:"ECP", name:"Eclipsium",  color:"#1e40af", base:3.64,  supply:2e10, vol:0.06 },
  { sym:"ASL", name:"Astrolis",   color:"#10b981", base:0.137, supply:5e11, vol:0.07 },
  { sym:"CMX", name:"Cometrix",   color:"#ec4899", base:1.05,  supply:4e10, vol:0.07 },
  { sym:"QSR", name:"Quasarium",  color:"#a855f7", base:202,   supply:6e8, vol:0.05 },
  { sym:"SLR", name:"Solara",     color:"#f59e0b", base:467000,supply:1e7, vol:0.04 },
  { sym:"PAR", name:"Partion",    color:"#8b5cf6", base:351000,supply:1.2e7, vol:0.04 },
  { sym:"NBL", name:"Nebulon",    color:"#14b8a6", base:1677,  supply:8e8, vol:0.06 },
  { sym:"QNT", name:"Quantix",    color:"#0891b2", base:42.5,  supply:2e9, vol:0.05 },
  { sym:"VRX", name:"Vortexa",    color:"#7e22ce", base:8800,  supply:5e7, vol:0.05 },
  { sym:"OMG", name:"Omegium",    color:"#be123c", base:0.42,  supply:1e11, vol:0.08 },
  { sym:"PLX", name:"Pulsex",     color:"#0d9488", base:165,   supply:9e8, vol:0.05 },
  { sym:"NOV", name:"Novarium",   color:"#1d4ed8", base:1240000, supply:3e6, vol:0.04 },
];
window.KRIPTO = KRIPTO;

/* ============== İHRACAT ŞABLONLARI ============== */
const IHRACAT_SIRKETLER = [
  { name:"Siam Group Co., Ltd.",      country:"Tayland",   flag:"🇹🇭" },
  { name:"Volga Holdings OOO",        country:"Rusya",     flag:"🇷🇺" },
  { name:"Azteca Group SA de CV",     country:"Meksika",   flag:"🇲🇽" },
  { name:"Royal Union Ltd.",          country:"İngiltere", flag:"🇬🇧" },
  { name:"Alpine Partners AG",        country:"İsviçre",   flag:"🇨🇭" },
  { name:"Lumière Groupe SAS",        country:"Fransa",    flag:"🇫🇷" },
  { name:"Kaiser Handels GmbH",       country:"Almanya",   flag:"🇩🇪" },
  { name:"Sakura Trading K.K.",       country:"Japonya",   flag:"🇯🇵" },
  { name:"Nile Commerce Co.",         country:"Mısır",     flag:"🇪🇬" },
  { name:"Pampas SRL",                country:"Arjantin",  flag:"🇦🇷" },
  { name:"Maple Leaf Inc.",           country:"Kanada",    flag:"🇨🇦" },
  { name:"Liberty Trade LLC",         country:"ABD",       flag:"🇺🇸" },
  { name:"Outback Pty Ltd.",          country:"Avustralya",flag:"🇦🇺" },
  { name:"Iberia Comercial SA",       country:"İspanya",   flag:"🇪🇸" },
  { name:"Hellas Emporiki AE",        country:"Yunanistan",flag:"🇬🇷" },
];

/* ============== INIT ============== */
function initEkonomi(){
  // Kripto fiyat döngüsü (sadece bir kullanıcı çalıştırsın diye admin değil ama hep çalışır)
  initCryptoEngine();
  // İhracat talep listesi yenileme
  initExportEngine();
  // İhale döngüsü
  initAuctionEngine();
  // Banka periyodik ödemeler
  initBankEngine();
  // Pazar otomatik satışları
  initMarketSalesEngine();
}
window.initEkonomi = initEkonomi;

/* ============================================================
   KRİPTO MOTORU — fiyatları her 30 saniyede bir günceller
   ============================================================ */
async function initCryptoEngine(){
  // İlk kurulum
  const exists = await dbGet('crypto/prices');
  if (!exists){
    const init = {};
    KRIPTO.forEach(k => {
      init[k.sym] = { current: k.base, prev: k.base, ts: now() };
    });
    await dbSet('crypto/prices', init);
  }

  // Fiyatları dinle
  if (GZ.pricesUnsub) GZ.pricesUnsub();
  const ref = db.ref('crypto/prices');
  ref.on('value', s => { GZ.prices = s.val() || {}; if (GZ.currentTab === 'kripto') renderKripto(); });
  GZ.pricesUnsub = () => ref.off();

  // Sadece bir tarayıcının fiyat tick'ini yapması için lock kullanırız
  setInterval(tickCrypto, 30000);
  setTimeout(tickCrypto, 2000);
}

async function tickCrypto(){
  // Lock al — son 25 sn'de kim tick yaptıysa o devam etsin
  const lockRef = db.ref('crypto/_tickLock');
  const r = await lockRef.transaction(cur => {
    if (cur && (now() - cur.ts) < 25000) return; // başka biri yaptı
    return { uid: GZ.uid, ts: now() };
  });
  if (!r.committed) return;

  // Fiyatları güncelle
  const updates = {};
  for (const k of KRIPTO){
    const cur = (GZ.prices[k.sym]?.current) || k.base;
    // Genelde aşağı eğilimli (kullanıcı: "adamı zarara götürmemiz lazım"), bazen yukarı
    // %60 düşüş, %40 yükseliş; volatilite kripto bazlı
    const direction = Math.random() < 0.55 ? -1 : 1;
    const change = direction * (Math.random() * k.vol);
    let next = cur * (1 + change);
    // Tabanın %10'u altına / 5 katı üstüne çıkmasın
    next = Math.max(k.base * 0.1, Math.min(k.base * 5, next));
    updates[`${k.sym}/prev`] = cur;
    updates[`${k.sym}/current`] = next;
    updates[`${k.sym}/ts`] = now();
  }
  await db.ref('crypto/prices').update(updates);
}

/* ============================================================
   İHRACAT MOTORU
   ============================================================ */
async function initExportEngine(){
  // Eğer talepler yoksa veya hepsi eski ise yenile
  const list = await dbGet('exports/list');
  if (!list || Object.keys(list).length < 15 || (now() - (await dbGet('exports/_renewedAt')||0)) > 30*60*1000){
    await renewExports();
  }
  // 30 dk'da bir lock'lı yenile
  setInterval(async () => {
    const r = await db.ref('exports/_renewLock').transaction(cur => {
      if (cur && (now() - cur) < 25*60*1000) return;
      return now();
    });
    if (r.committed) await renewExports();
  }, 60*1000);
}

async function renewExports(){
  const updates = {};
  const items = Object.keys(URUNLER);
  for (let i=0;i<20;i++){
    const sirket = IHRACAT_SIRKETLER[Math.floor(Math.random()*IHRACAT_SIRKETLER.length)];
    const itemKey = items[Math.floor(Math.random()*items.length)];
    const u = URUNLER[itemKey];
    const demand = (Math.floor(Math.random()*8)+1) * 500000;
    const price = +(u.base * (1.5 + Math.random()*1.5)).toFixed(2); // taban x 1.5-3
    const minOrder = Math.max(2000, Math.floor(demand * 0.005));
    const id = 'ex_' + Math.random().toString(36).slice(2,10);
    updates[id] = {
      id, sirket: sirket.name, country: sirket.country, flag: sirket.flag,
      item: itemKey, demand, fulfilled: 0,
      pricePerUnit: price, minOrder,
      createdAt: now()
    };
  }
  await db.ref('exports/list').set(updates);
  await db.ref('exports/_renewedAt').set(now());
}

/* Kullanıcı bir ihracat talebine gönderim yapsın */
async function exportShip(exId, qty){
  const ex = await dbGet(`exports/list/${exId}`);
  if (!ex) return toast('Talep bulunamadı', 'error');
  if (qty < ex.minOrder) return toast(`Min sipariş: ${fmtInt(ex.minOrder)} ${URUNLER[ex.item].unit}`, 'warn');
  const remaining = ex.demand - (ex.fulfilled||0);
  if (qty > remaining) qty = remaining;
  if (qty <= 0) return toast('Talep doldu', 'warn');

  // Kullanıcının bu üründen depoda var mı? (Lojistik depolardan tüketir)
  const total = await getTotalStock(GZ.uid, ex.item);
  if (total < qty) return toast(`Yeterli stok yok. Var: ${fmtInt(total)} ${URUNLER[ex.item].unit}`, 'error');

  // Stok düş
  await consumeStock(GZ.uid, ex.item, qty);
  // Ödeme al
  const earn = +(qty * ex.pricePerUnit).toFixed(2);
  await addCash(GZ.uid, earn, 'export');
  await addXP(GZ.uid, Math.floor(earn / 100));
  // İhracat fulfillment güncelle
  await dbUpdate(`exports/list/${exId}`, { fulfilled: (ex.fulfilled||0) + qty });

  toast(`💰 +${cashFmt(earn)} ihracat geliri`, 'success');
  if (GZ.currentTab === 'ihracat') render('ihracat');
  if (GZ.currentTab === 'lojistik') render('lojistik');
}
window.exportShip = exportShip;

/* ============================================================
   İHALE MOTORU
   ============================================================ */
async function initAuctionEngine(){
  // İhaleler yoksa oluştur
  const list = await dbGet('auctions/list');
  if (!list || Object.keys(list).length < 5){
    await createAuctions();
  }
  // Bitenleri sonlandır + yenile
  setInterval(processAuctions, 5000);
}

async function createAuctions(){
  const updates = {};
  const items = Object.keys(URUNLER);
  for (let i=0;i<6;i++){
    const sirket = IHRACAT_SIRKETLER[Math.floor(Math.random()*IHRACAT_SIRKETLER.length)];
    const itemKey = items[Math.floor(Math.random()*items.length)];
    const u = URUNLER[itemKey];
    const qty = (Math.floor(Math.random()*6)+1) * 100000;
    const minBid = +(u.base * (1.2 + Math.random()*0.8)).toFixed(2);
    const id = 'au_' + Math.random().toString(36).slice(2,10);
    const duration = (Math.floor(Math.random()*5)+1) * 60 * 1000; // 1-5 dk
    updates[id] = {
      id, sirket: sirket.name, country: sirket.country, flag: sirket.flag,
      item: itemKey, qty, minBid, currentBid: minBid,
      currentBidder: null, currentBidderName: null,
      endsAt: now() + duration, createdAt: now(), finalized: false
    };
  }
  await db.ref('auctions/list').update(updates);
}

async function processAuctions(){
  const list = await dbGet('auctions/list') || {};
  const ids = Object.keys(list);
  const expired = ids.filter(id => list[id].endsAt < now() && !list[id].finalized);

  // Lock — sadece bir kullanıcı sonlandırsın
  if (expired.length){
    const r = await db.ref('auctions/_finLock').transaction(cur => {
      if (cur && (now() - cur) < 4000) return;
      return now();
    });
    if (r.committed){
      for (const id of expired){
        const a = list[id];
        await dbUpdate(`auctions/list/${id}`, { finalized: true });
        if (a.currentBidder){
          // Kazanan stok alır, parası daha önce çekildi (teklif ederken)
          await addStock(a.currentBidder, a.item, a.qty, 'mainWarehouse');
          await pushNotif(a.currentBidder, `🏆 İhaleyi kazandın: ${fmtInt(a.qty)} ${URUNLER[a.item].unit} ${URUNLER[a.item].name}`);
        }
        // Bittiğinde yenisini oluşturmak için sil
        await db.ref(`auctions/list/${id}`).remove();
      }
      // Yeni ihaleler ekle
      const remaining = Object.keys(list).filter(id=>!list[id].finalized).length;
      if (remaining < 5) await createAuctions();
    }
  }
  if (GZ.currentTab === 'ihale') renderIhale();
}

/* Teklif ver */
async function placeBid(auId, bidAmount){
  const a = await dbGet(`auctions/list/${auId}`);
  if (!a) return toast('İhale bulunamadı', 'error');
  if (a.finalized) return toast('İhale bitti', 'warn');
  if (a.endsAt < now()) return toast('İhale süresi doldu', 'warn');
  if (bidAmount <= a.currentBid) return toast(`En düşük teklif: ${cashFmt(a.currentBid + 0.01)}`, 'warn');

  const totalCost = bidAmount * a.qty;
  // Önceki teklifi iade et + yeni teklifi al — transactional bir flow yapalım
  const ok = await spendCash(GZ.uid, totalCost, 'auction-bid');
  if (!ok) return toast(`Yetersiz bakiye. Gerekli: ${cashFmt(totalCost)}`, 'error');

  // Önceki teklif sahibine iade
  if (a.currentBidder && a.currentBidder !== GZ.uid){
    await addCash(a.currentBidder, a.currentBid * a.qty, 'auction-refund');
    await pushNotif(a.currentBidder, `İhalede teklifin geçildi, paran iade edildi.`);
  } else if (a.currentBidder === GZ.uid){
    // Aynı kullanıcı yeniden teklif verdi: önceki tutarı iade et
    await addCash(GZ.uid, a.currentBid * a.qty, 'auction-self-refund');
  }

  await dbUpdate(`auctions/list/${auId}`, {
    currentBid: bidAmount,
    currentBidder: GZ.uid,
    currentBidderName: GZ.data.username,
    endsAt: Math.max(a.endsAt, now() + 30000) // son 30 sn'de teklif gelirse uzat
  });
  toast('Teklif kaydedildi', 'success');
}
window.placeBid = placeBid;

/* ============================================================
   BANKA MOTORU
   ============================================================ */
async function initBankEngine(){
  // Her dakika kullanıcının bankasını kontrol et: yatırım faizi & ödeme tarihleri
  setInterval(processBankUser, 60000);
  setTimeout(processBankUser, 5000);
}

async function processBankUser(){
  if (!GZ.uid || !GZ.data) return;
  const bank = await dbGet(`bank/${GZ.uid}`);
  if (!bank) return;

  const t = now();

  // Yatırım hesabına faiz: günlük %0.3 (yıllık ~%109 ama oyun)
  if (bank.investment > 0){
    const elapsedMs = t - (bank.investmentDate || t);
    if (elapsedMs > 60000){
      const days = elapsedMs / (24*3600*1000);
      const interest = bank.investment * 0.003 * days; // birikmiş
      // SADECE her tam dakika için yaz
      await dbUpdate(`bank/${GZ.uid}`, {
        investment: +(bank.investment + interest).toFixed(2),
        investmentDate: t
      });
    }
  }

  // İşletme gideri (haftalık) — sadece dolduğunda bir kez
  if (t > (bank.nextBusinessExpense||t+1)){
    const businesses = await countBusinesses(GZ.uid);
    const expense = businesses * 200; // her işletme 200₺/hafta
    if (expense > 0){
      const ok = await spendCash(GZ.uid, expense, 'business-exp');
      if (ok){
        await pushNotif(GZ.uid, `🏢 İşletme gideri ödendi: ${cashFmt(expense)}`);
      } else {
        // Para yoksa — borç olarak ekle
        await dbUpdate(`bank/${GZ.uid}`, { loan: (bank.loan||0) + expense });
        await pushNotif(GZ.uid, `⚠️ İşletme gideri ödenemedi, ${cashFmt(expense)} kredi olarak eklendi.`);
      }
    }
    await dbUpdate(`bank/${GZ.uid}`, { nextBusinessExpense: t + 7*24*3600*1000 });
  }

  // Çalışan maaşları (haftalık)
  if (t > (bank.nextSalary||t+1)){
    const employees = await countEmployees(GZ.uid);
    const salary = employees * 350;
    if (salary > 0){
      const ok = await spendCash(GZ.uid, salary, 'salary');
      if (ok) await pushNotif(GZ.uid, `👥 Çalışan maaşları ödendi: ${cashFmt(salary)}`);
      else {
        await dbUpdate(`bank/${GZ.uid}`, { loan: (bank.loan||0) + salary });
        await pushNotif(GZ.uid, `⚠️ Maaşlar ödenemedi, ${cashFmt(salary)} krediye eklendi.`);
      }
    }
    await dbUpdate(`bank/${GZ.uid}`, { nextSalary: t + 7*24*3600*1000 });
  }
}

async function bankDeposit(amount){
  if (amount <= 0) return toast('Geçersiz tutar','error');
  const ok = await spendCash(GZ.uid, amount, 'bank-deposit');
  if (!ok) return toast('Yetersiz bakiye', 'error');
  await db.ref(`bank/${GZ.uid}/balance`).transaction(c => (c||0)+amount);
  toast(`+${cashFmt(amount)} hesaba yatırıldı`, 'success');
}
window.bankDeposit = bankDeposit;

async function bankWithdraw(amount){
  if (amount <= 0) return toast('Geçersiz tutar','error');
  const r = await db.ref(`bank/${GZ.uid}/balance`).transaction(c => {
    if ((c||0) < amount) return;
    return c - amount;
  });
  if (!r.committed) return toast('Yetersiz hesap bakiyesi','error');
  await addCash(GZ.uid, amount, 'bank-withdraw');
  toast(`+${cashFmt(amount)} hesaptan çekildi`, 'success');
}
window.bankWithdraw = bankWithdraw;

async function bankInvest(amount){
  if (amount <= 0) return toast('Geçersiz tutar','error');
  const ok = await spendCash(GZ.uid, amount, 'invest');
  if (!ok) return toast('Yetersiz bakiye', 'error');
  await db.ref(`bank/${GZ.uid}`).transaction(b => {
    b = b || { investment:0, investmentDate: now() };
    b.investment = (b.investment||0) + amount;
    b.investmentDate = now();
    return b;
  });
  toast(`+${cashFmt(amount)} yatırım yapıldı`, 'success');
}
window.bankInvest = bankInvest;

async function bankInvestWithdraw(amount){
  if (amount <= 0) return toast('Geçersiz tutar','error');
  const r = await db.ref(`bank/${GZ.uid}/investment`).transaction(c => {
    if ((c||0) < amount) return;
    return +(c - amount).toFixed(2);
  });
  if (!r.committed) return toast('Yetersiz yatırım', 'error');
  await addCash(GZ.uid, amount, 'invest-withdraw');
  toast(`+${cashFmt(amount)} yatırım çekildi`, 'success');
}
window.bankInvestWithdraw = bankInvestWithdraw;

async function bankBorrow(amount){
  if (amount <= 0) return toast('Geçersiz tutar','error');
  const lv = (GZ.data.level||1);
  const max = lv * 5000;
  const cur = (await dbGet(`bank/${GZ.uid}/loan`))||0;
  if (cur + amount > max) return toast(`Kredi limitiniz: ${cashFmt(max)}`, 'warn');
  await db.ref(`bank/${GZ.uid}/loan`).transaction(c => (c||0)+amount);
  await addCash(GZ.uid, amount, 'borrow');
  toast(`+${cashFmt(amount)} kredi çekildi`, 'success');
}
window.bankBorrow = bankBorrow;

async function bankRepay(amount){
  if (amount <= 0) return toast('Geçersiz tutar','error');
  const ok = await spendCash(GZ.uid, amount, 'repay');
  if (!ok) return toast('Yetersiz bakiye', 'error');
  await db.ref(`bank/${GZ.uid}/loan`).transaction(c => Math.max(0,(c||0)-amount));
  toast(`-${cashFmt(amount)} kredi ödendi`, 'success');
}
window.bankRepay = bankRepay;

/* ============================================================
   PAZAR — DÜKKAN OTOMATİK SATIŞ MOTORU
   YALNIZCA REYONA ÜRÜN EKLENMİŞSE SATIŞ OLUR (kafasına göre satış YOK)
   ============================================================ */
async function initMarketSalesEngine(){
  setInterval(processSales, 90000); // her 90 sn
  setTimeout(processSales, 7000);
}

async function processSales(){
  if (!GZ.uid) return;
  // Kullanıcının dükkanlarını gez
  const shops = await dbGet(`businesses/${GZ.uid}/shops`) || {};
  const profitRate = (await dbGet(`businesses/${GZ.uid}/profitRate`)) || 0.20;

  for (const sid of Object.keys(shops)){
    const shop = shops[sid];
    const shelves = shop.shelves || {};
    let totalSale = 0;
    const updates = {};
    for (const item of Object.keys(shelves)){
      const sh = shelves[item];
      // **REYONDA STOK YOKSA SATIŞ YOK**
      if (!sh || (sh.stock||0) <= 0) continue;
      if (!sh.price || sh.price <= 0) continue;

      const u = URUNLER[item];
      if (!u) continue;

      // Fiyat-talep eğrisi: fiyat tabanın 1.5x üstünde ise satış %50 düşer
      const ratio = sh.price / u.base;
      let demandFactor = 1;
      if (ratio < 1) demandFactor = 1.5;
      else if (ratio < 1.5) demandFactor = 1;
      else if (ratio < 2) demandFactor = 0.6;
      else if (ratio < 3) demandFactor = 0.3;
      else demandFactor = 0.1;

      // Açılış bonus: ilk 24 saatte +5x
      const since = now() - (shop.createdAt||now());
      const opening = since < 24*3600*1000 ? 5 : 1;

      const baseRate = 6 * demandFactor * opening * (shop.level||1);
      const sold = Math.min(sh.stock, Math.floor(baseRate * (0.7 + Math.random()*0.6)));
      if (sold <= 0) continue;

      const revenue = +(sold * sh.price).toFixed(2);
      totalSale += revenue;

      updates[`${sid}/shelves/${item}/stock`] = sh.stock - sold;
      updates[`${sid}/shelves/${item}/totalSold`] = (sh.totalSold||0) + sold;
      updates[`${sid}/shelves/${item}/totalRevenue`] = +((sh.totalRevenue||0) + revenue).toFixed(2);
    }

    if (totalSale > 0){
      // Para ekle, XP ekle
      await addCash(GZ.uid, totalSale, 'shop-sale');
      await addXP(GZ.uid, Math.floor(totalSale/50));
      await db.ref(`businesses/${GZ.uid}/shops`).update(updates);
    }
  }
  // Bahçe / Çiftlik / Fabrika / Maden hasatlarını işle
  await processProductions();
}

async function processProductions(){
  // Bahçeler hasada hazır mı?
  const gardens = await dbGet(`businesses/${GZ.uid}/gardens`) || {};
  const farms   = await dbGet(`businesses/${GZ.uid}/farms`) || {};
  const factories = await dbGet(`businesses/${GZ.uid}/factories`) || {};
  const mines   = await dbGet(`businesses/${GZ.uid}/mines`) || {};

  const t = now();
  // Bahçe & çiftlik & fabrika & maden ortak: harvestAt geldiyse stok ekle
  const allLists = [
    { col:'gardens', items: gardens },
    { col:'farms', items: farms },
    { col:'factories', items: factories },
    { col:'mines', items: mines }
  ];
  for (const grp of allLists){
    for (const id of Object.keys(grp.items)){
      const it = grp.items[id];
      if (it.crop && it.harvestAt && t >= it.harvestAt && !it.harvested){
        // Hasada hazır — kullanıcı tıklayınca alacak; otomatik EKLEMİYORUZ
        // Sadece bayrak göster
        if (!it.ready){
          await dbUpdate(`businesses/${GZ.uid}/${grp.col}/${id}`, { ready: true });
        }
      }
    }
  }
}

/* ============================================================
   STOK / DEPO YARDIMCILARI
   ============================================================ */
// Tüm depolardaki + reyonlardaki + hammadde stoğu = toplam
async function getTotalStock(uid, item){
  let total = 0;
  const wh = await dbGet(`businesses/${uid}/warehouses`) || {};
  for (const city of Object.keys(wh)){
    total += (wh[city].items?.[item]) || 0;
  }
  // Ana depo
  const main = (await dbGet(`businesses/${uid}/mainWarehouse/${item}`)) || 0;
  total += main;
  return total;
}
window.getTotalStock = getTotalStock;

async function addStock(uid, item, qty, target='mainWarehouse'){
  if (qty <= 0) return;
  if (target === 'mainWarehouse'){
    await db.ref(`businesses/${uid}/mainWarehouse/${item}`).transaction(c => (c||0)+qty);
  } else {
    await db.ref(`businesses/${uid}/warehouses/${target}/items/${item}`).transaction(c => (c||0)+qty);
  }
}
window.addStock = addStock;

async function consumeStock(uid, item, qty){
  // Önce mainWarehouse'tan, sonra şehirlerden tüket
  let need = qty;
  const main = (await dbGet(`businesses/${uid}/mainWarehouse/${item}`)) || 0;
  if (main >= need){
    await db.ref(`businesses/${uid}/mainWarehouse/${item}`).set(main - need);
    return true;
  } else {
    if (main > 0){
      need -= main;
      await db.ref(`businesses/${uid}/mainWarehouse/${item}`).set(0);
    }
    const wh = await dbGet(`businesses/${uid}/warehouses`) || {};
    for (const city of Object.keys(wh)){
      const cur = (wh[city].items?.[item]) || 0;
      if (cur <= 0) continue;
      if (cur >= need){
        await db.ref(`businesses/${uid}/warehouses/${city}/items/${item}`).set(cur - need);
        return true;
      } else {
        need -= cur;
        await db.ref(`businesses/${uid}/warehouses/${city}/items/${item}`).set(0);
      }
    }
    if (need > 0) return false;
    return true;
  }
}
window.consumeStock = consumeStock;

async function countBusinesses(uid){
  const shops = await dbGet(`businesses/${uid}/shops`) || {};
  const gardens = await dbGet(`businesses/${uid}/gardens`) || {};
  const farms = await dbGet(`businesses/${uid}/farms`) || {};
  const factories = await dbGet(`businesses/${uid}/factories`) || {};
  const mines = await dbGet(`businesses/${uid}/mines`) || {};
  return Object.keys(shops).length + Object.keys(gardens).length + Object.keys(farms).length + Object.keys(factories).length + Object.keys(mines).length;
}

async function countEmployees(uid){
  const shops = await dbGet(`businesses/${uid}/shops`) || {};
  let total = 0;
  for (const id of Object.keys(shops)) total += (shops[id].employees||1);
  return total;
}

/* ============================================================
   REYON / DÜKKAN İŞLEMLERİ
   ============================================================ */
async function buyShop(type, city){
  const costs = { market: 5000, elektronik: 12000, mobilya: 18000, kuyumcu: 35000,
                  beyazesya: 22000, otomotiv: 60000, benzin: 45000 };
  const lvReq = { market:1, elektronik:5, mobilya:8, kuyumcu:15, beyazesya:10, otomotiv:18, benzin:12 };
  const cost = costs[type];
  const lv = GZ.data.level||1;
  if (lv < lvReq[type]) return toast(`${lvReq[type]}. seviyede açılır`, 'warn');
  const ok = await spendCash(GZ.uid, cost, 'buy-shop');
  if (!ok) return toast('Yetersiz bakiye', 'error');
  const id = 'sh_' + Math.random().toString(36).slice(2,8);
  await dbSet(`businesses/${GZ.uid}/shops/${id}`, {
    id, type, city, level:1, employees:1, createdAt: now(), shelves:{}
  });
  toast(`${type} açıldı!`, 'success');
}
window.buyShop = buyShop;

async function addShelf(shopId, itemKey){
  const item = URUNLER[itemKey];
  if (!item) return toast('Geçersiz ürün','error');
  if ((GZ.data.level||1) < item.lv) return toast(`${item.lv}. seviyede açılır`, 'warn');
  const exist = await dbGet(`businesses/${GZ.uid}/shops/${shopId}/shelves/${itemKey}`);
  if (exist) return toast('Bu reyon zaten var','warn');
  const cost = 500;
  const ok = await spendCash(GZ.uid, cost, 'add-shelf');
  if (!ok) return toast(`Reyon kurulum: ${cashFmt(cost)} gerekli`, 'error');
  await dbSet(`businesses/${GZ.uid}/shops/${shopId}/shelves/${itemKey}`, {
    item: itemKey, stock:0, max:50, price: +(item.base * 1.2).toFixed(2),
    cost: 0, totalSold:0, totalRevenue:0
  });
  toast('Reyon eklendi', 'success');
}
window.addShelf = addShelf;

async function buyShelfStock(shopId, itemKey, qty){
  const sh = await dbGet(`businesses/${GZ.uid}/shops/${shopId}/shelves/${itemKey}`);
  if (!sh) return toast('Reyon bulunamadı','error');
  const u = URUNLER[itemKey];
  if (qty <= 0) return toast('Geçersiz miktar','error');
  if (sh.stock + qty > sh.max) qty = sh.max - sh.stock;
  if (qty <= 0) return toast('Reyon dolu','warn');
  const cost = +(qty * u.base).toFixed(2);
  const ok = await spendCash(GZ.uid, cost, 'shelf-stock');
  if (!ok) return toast(`Yetersiz bakiye (${cashFmt(cost)})`, 'error');
  await dbUpdate(`businesses/${GZ.uid}/shops/${shopId}/shelves/${itemKey}`, {
    stock: sh.stock + qty,
    cost: +((sh.cost*sh.stock + cost)/(sh.stock+qty)).toFixed(2) // ortalama maliyet
  });
  toast(`+${qty} ${u.unit} eklendi`, 'success');
}
window.buyShelfStock = buyShelfStock;

async function setShelfPrice(shopId, itemKey, price){
  if (price <= 0) return toast('Geçersiz fiyat','error');
  await dbUpdate(`businesses/${GZ.uid}/shops/${shopId}/shelves/${itemKey}`, { price });
  toast('Fiyat güncellendi', 'success');
}
window.setShelfPrice = setShelfPrice;

async function deleteShelf(shopId, itemKey){
  await db.ref(`businesses/${GZ.uid}/shops/${shopId}/shelves/${itemKey}`).remove();
  toast('Reyon kapatıldı','success');
}
window.deleteShelf = deleteShelf;

async function upgradeShop(shopId){
  const shop = await dbGet(`businesses/${GZ.uid}/shops/${shopId}`);
  if (!shop) return;
  const next = (shop.level||1)+1;
  const cost = next * 5000;
  const ok = await spendCash(GZ.uid, cost, 'upgrade-shop');
  if (!ok) return toast(`Yetersiz bakiye (${cashFmt(cost)})`, 'error');
  await dbUpdate(`businesses/${GZ.uid}/shops/${shopId}`, {
    level: next,
    employees: (shop.employees||1)+1
  });
  toast(`Dükkan Lv ${next}`, 'success');
}
window.upgradeShop = upgradeShop;

/* ============================================================
   BAHÇE / ÇİFTLİK / FABRİKA / MADEN
   ============================================================ */
async function buyProductionUnit(kind){
  const map = {
    gardens:    { cost:3000, lv:2,  name:"Bahçe" },
    farms:     { cost:8000, lv:5,  name:"Çiftlik" },
    factories: { cost:25000,lv:8,  name:"Fabrika" },
    mines:     { cost:80000,lv:30, name:"Maden" }
  };
  const m = map[kind]; if (!m) return;
  if ((GZ.data.level||1) < m.lv) return toast(`${m.lv}. seviyede açılır`, 'warn');
  const ok = await spendCash(GZ.uid, m.cost, 'buy-prod');
  if (!ok) return toast('Yetersiz bakiye', 'error');
  const id = kind.slice(0,2) + '_' + Math.random().toString(36).slice(2,8);
  await dbSet(`businesses/${GZ.uid}/${kind}/${id}`, {
    id, level:1, createdAt: now(), crop:null, harvestAt:null, ready:false
  });
  toast(`${m.name} açıldı`, 'success');
}
window.buyProductionUnit = buyProductionUnit;

async function plantCrop(kind, unitId, itemKey){
  const u = URUNLER[itemKey];
  if (!u) return toast('Geçersiz ürün','error');
  if ((GZ.data.level||1) < u.lv) return toast(`${u.lv}. seviyede açılır`,'warn');
  const cropCost = +(u.base * 0.4 * 100).toFixed(2); // 100 birim ekim maliyeti
  const ok = await spendCash(GZ.uid, cropCost, 'plant');
  if (!ok) return toast(`Yetersiz bakiye (${cashFmt(cropCost)})`, 'error');
  const grow = (kind==='gardens'? 5 : kind==='farms'? 8 : kind==='factories'? 4 : 12) * 60 * 1000;
  await dbUpdate(`businesses/${GZ.uid}/${kind}/${unitId}`, {
    crop: itemKey,
    harvestAt: now() + grow,
    ready: false
  });
  toast(`${u.name} ekildi`, 'success');
}
window.plantCrop = plantCrop;

async function harvest(kind, unitId){
  const u = await dbGet(`businesses/${GZ.uid}/${kind}/${unitId}`);
  if (!u || !u.crop) return;
  if (now() < u.harvestAt) return toast(`Henüz hazır değil`, 'warn');
  const yieldQty = (u.level||1) * 100; // her seviyede 100 birim
  await addStock(GZ.uid, u.crop, yieldQty, 'mainWarehouse');
  await dbUpdate(`businesses/${GZ.uid}/${kind}/${unitId}`, {
    crop:null, harvestAt:null, ready:false
  });
  await addXP(GZ.uid, Math.floor(yieldQty * URUNLER[u.crop].base / 50));
  toast(`+${yieldQty} ${URUNLER[u.crop].unit} ${URUNLER[u.crop].name} hasat edildi`, 'success');
}
window.harvest = harvest;

async function upgradeProductionUnit(kind, unitId){
  const u = await dbGet(`businesses/${GZ.uid}/${kind}/${unitId}`);
  if (!u) return;
  const cost = (u.level||1) * 2500;
  const ok = await spendCash(GZ.uid, cost, 'upgrade-prod');
  if (!ok) return toast('Yetersiz bakiye','error');
  await dbUpdate(`businesses/${GZ.uid}/${kind}/${unitId}`, { level:(u.level||1)+1 });
  toast(`Yükseltildi → Lv ${(u.level||1)+1}`, 'success');
}
window.upgradeProductionUnit = upgradeProductionUnit;

/* ============================================================
   LOJİSTİK — DEPO
   ============================================================ */
async function buyWarehouse(city, payment){
  const exist = await dbGet(`businesses/${GZ.uid}/warehouses/${city}`);
  if (exist) return toast('Bu şehirde deponuz zaten var','warn');
  if (payment === 'diamond'){
    const ok = await spendDiamonds(GZ.uid, 100);
    if (!ok) return toast('Yetersiz elmas (100 gerekli)','error');
  } else {
    const ok = await spendCash(GZ.uid, 25000, 'warehouse');
    if (!ok) return toast('Yetersiz bakiye (25.000 ₺ gerekli)','error');
  }
  await dbSet(`businesses/${GZ.uid}/warehouses/${city}`, {
    city, capacity: 100000, items: {}, createdAt: now()
  });
  toast(`${city} deposu açıldı`, 'success');
}
window.buyWarehouse = buyWarehouse;

async function transferStock(item, qty, fromCity, toCity){
  // basit transfer
  const f = await dbGet(`businesses/${GZ.uid}/warehouses/${fromCity}/items/${item}`) || 0;
  if (f < qty) return toast('Yetersiz stok','error');
  await db.ref(`businesses/${GZ.uid}/warehouses/${fromCity}/items/${item}`).set(f - qty);
  await db.ref(`businesses/${GZ.uid}/warehouses/${toCity}/items/${item}`).transaction(c => (c||0)+qty);
  toast('Transfer tamam', 'success');
}
window.transferStock = transferStock;

/* ============================================================
   KRİPTO ALIM-SATIM
   ============================================================ */
async function buyCrypto(sym, tlAmount){
  if (tlAmount <= 0) return toast('Geçersiz tutar','error');
  const price = GZ.prices[sym]?.current;
  if (!price) return toast('Fiyat alınamadı','error');
  const ok = await spendCash(GZ.uid, tlAmount, 'crypto-buy');
  if (!ok) return toast('Yetersiz bakiye','error');
  const fee = tlAmount * 0.005;
  const qty = (tlAmount - fee) / price;
  await db.ref(`crypto/holdings/${GZ.uid}/${sym}`).transaction(c => (c||0)+qty);
  toast(`+${qty.toFixed(4)} ${sym}`, 'success');
}
window.buyCrypto = buyCrypto;

async function sellCrypto(sym, qty){
  if (qty <= 0) return toast('Geçersiz miktar','error');
  const price = GZ.prices[sym]?.current;
  if (!price) return toast('Fiyat alınamadı','error');
  const cur = (await dbGet(`crypto/holdings/${GZ.uid}/${sym}`)) || 0;
  if (cur < qty) return toast('Yetersiz miktar','error');
  await db.ref(`crypto/holdings/${GZ.uid}/${sym}`).set(cur - qty);
  const tl = qty * price * 0.995;
  await addCash(GZ.uid, tl, 'crypto-sell');
  toast(`+${cashFmt(tl)}`, 'success');
}
window.sellCrypto = sellCrypto;

/* ============================================================
   MARKA
   ============================================================ */
async function createBrand(name){
  if (!name || name.length<3 || name.length>20) return toast('İsim 3-20 karakter olmalı','error');
  if (!/^[a-zA-Z0-9_ ]+$/.test(name)) return toast('Sadece harf/rakam','error');
  const lv = GZ.data.level||1;
  if (lv < 10) return toast('10. seviyede açılır','warn');
  const ok = await spendCash(GZ.uid, 25000, 'brand');
  if (!ok) return toast('25.000 ₺ gerekli','error');
  const id = 'br_' + Math.random().toString(36).slice(2,8);
  await dbSet(`brands/${id}`, {
    id, name, leader: GZ.uid, leaderName: GZ.data.username,
    members: { [GZ.uid]: { joinedAt: now(), role:'leader' } },
    points: 100, power: 1, createdAt: now()
  });
  await dbUpdate(`users/${GZ.uid}`, { brand: id });
  toast(`Marka kuruldu: ${name}`, 'success');
}
window.createBrand = createBrand;

async function joinBrand(id){
  const b = await dbGet(`brands/${id}`);
  if (!b) return toast('Marka bulunamadı','error');
  if (Object.keys(b.members||{}).length >= 20) return toast('Marka dolu','warn');
  await dbSet(`brands/${id}/members/${GZ.uid}`, { joinedAt: now(), role:'member' });
  await dbUpdate(`users/${GZ.uid}`, { brand: id });
  toast('Markaya katıldın', 'success');
}
window.joinBrand = joinBrand;

async function leaveBrand(){
  const id = GZ.data.brand;
  if (!id) return;
  const b = await dbGet(`brands/${id}`);
  if (b && b.leader === GZ.uid){
    // Lider çıkıyorsa marka dağılır
    await db.ref(`brands/${id}`).remove();
  } else {
    await db.ref(`brands/${id}/members/${GZ.uid}`).remove();
  }
  await dbUpdate(`users/${GZ.uid}`, { brand: null });
  toast('Markadan ayrıldın', 'success');
}
window.leaveBrand = leaveBrand;

/* ============================================================
   MAĞAZA — Elmas paketleri & robot
   ============================================================ */
const ELMAS_PAKETLERI = [
  { id:'p1', dia:50,    tl:60,   bonus:0   },
  { id:'p2', dia:200,   tl:300,  bonus:20  },
  { id:'p3', dia:500,   tl:600,  bonus:80  },
  { id:'p4', dia:1200,  tl:1200, bonus:300 },
  { id:'p5', dia:3000,  tl:2400, bonus:1000},
  { id:'p6', dia:10000, tl:6000, bonus:5000}
];
window.ELMAS_PAKETLERI = ELMAS_PAKETLERI;

const ROBOT_PAKETLERI = [
  { id:'r_h', name:'Saatlik Robot',   diamonds:30,   hours:1   },
  { id:'r_d', name:'Günlük Robot',    diamonds:200,  hours:24  },
  { id:'r_w', name:'Haftalık Robot',  diamonds:1000, hours:168 },
  { id:'r_m', name:'Aylık Robot',     diamonds:3500, hours:720 }
];
window.ROBOT_PAKETLERI = ROBOT_PAKETLERI;

async function buyRobot(rid){
  const r = ROBOT_PAKETLERI.find(x=>x.id===rid);
  if (!r) return;
  const ok = await spendDiamonds(GZ.uid, r.diamonds);
  if (!ok) return toast('Yetersiz elmas','error');
  const cur = await dbGet(`users/${GZ.uid}/robotUntil`) || 0;
  const start = Math.max(now(), cur);
  await dbUpdate(`users/${GZ.uid}`, { robotUntil: start + r.hours*3600*1000 });
  toast(`Robot aktif: ${r.hours} saat`, 'success');
}
window.buyRobot = buyRobot;

/* ============================================================
   BİLDİRİMLER
   ============================================================ */
async function pushNotif(uid, msg){
  const id = await dbPush(`notifs/${uid}`, { msg, ts: now(), read:false });
  return id;
}
window.pushNotif = pushNotif;
