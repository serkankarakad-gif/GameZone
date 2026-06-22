/* ==========================================================================
   ui-manager.js — UI Render & Navigasyon & Modaller
   ========================================================================== */

function initUI(){
  $$('#bottomNav .navbtn').forEach(b => {
    b.addEventListener('click', () => switchTab(b.dataset.tab));
  });
  $$('[data-open]').forEach(b => {
    b.addEventListener('click', () => openTopbarModal(b.dataset.open));
  });
  switchTab('dukkan');
  // Dinamik konsolu başlat
  if (typeof initKonsol === 'function') setTimeout(initKonsol, 100);

  // Bildirim sayısı
  db.ref(`notifs/${GZ.uid}`).on('value', s => {
    const list = s.val() || {};
    const unread = Object.values(list).filter(x=>!x.read).length;
    const el = $('#notifBadge');
    if (unread > 0){ el.textContent = unread; el.hidden = false; }
    else el.hidden = true;
  });

  // Sohbet rozeti
  db.ref('chat/global').limitToLast(1).on('value', s => {
    const lastSeen = parseInt(localStorage.getItem('chatLastSeen')||'0');
    const list = s.val() || {};
    const v = Object.values(list)[0];
    if (v && v.ts > lastSeen && v.uid !== GZ.uid){
      const el = $('#chatBadge');
      el.textContent = '•';
      el.hidden = false;
    }
  });

  // Tema yükle
  const theme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', theme);
}
window.initUI = initUI;

function switchTab(tab){
  GZ.currentTab = tab;
  $$('#bottomNav .navbtn').forEach(b => b.classList.toggle('active', b.dataset.tab===tab));
  const active = $(`#bottomNav .navbtn.active`);
  if (active) active.scrollIntoView({ behavior:'smooth', inline:'center', block:'nearest' });
  render(tab);
}
window.switchTab = switchTab;

function render(tab){
  const main = $('#appMain');
  main.innerHTML = `<div style="padding:40px;text-align:center"><div class="spinner" style="margin:0 auto"></div></div>`;
  switch(tab){
    case 'dukkan':   renderDukkan();   break;
    case 'bahce':    renderProduction('gardens',   'Bahçeler',    '🌱', ['domates','patates','sogan','elma','uzum','kiraz','kayisi','findik','zeytin']); break;
    case 'ciftlik':  renderProduction('farms',     'Çiftlikler',  '🐄', ['inek_sutu','keci_sutu','tavuk_yumurtasi','hindi_yumurtasi','kaz_yumurtasi','tavuk_eti','dana_eti','kuzu_eti','yun']); break;
    case 'fabrika':  renderProduction('factories', 'Fabrikalar',  '🏭', ['ekmek','pasta','dondurma','beyaz_peynir','kasar_peyniri','suzme_bal','petek_bal','polen','kimyasal_cozucu','cimento','keten_kumas','eldiven','siyah_cay','yesil_cay','bugday_unu','misir_unu','seker','ayicicek_yagi','zeytinyagi','findik_yagi']); break;
    case 'maden':    renderProduction('mines',     'Madenler',    '⛏️', ['altin','gumus','bakir','demir','kromit'], 30); break;
    case 'lojistik': renderLojistik(); break;
    case 'ihracat':  renderIhracat();  break;
    case 'ihale':    renderIhale();    break;
    case 'kripto':   renderKripto();   break;
    case 'marka':    renderMarka();    break;
    case 'pazar':    renderPazar();    break;
    case 'liderlik': renderLiderlik(); break;
    case 'haberler': renderHaberler(); break;
    case 'sehirler': renderSehirler(); break;
    case 'magaza':   renderMagaza();   break;
    case 'hikaye':   renderHikaye();   break;
    case 'sss':      renderSSS();      break;
  }
}
window.render = render;

function emptyState(emoji, title, sub){
  return `<div class="empty-state"><div class="emoji">${emoji}</div><h3>${title}</h3><p>${sub||''}</p></div>`;
}
function escapeHtml(s){
  return String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

/* ============================================================
   DÜKKANLAR
   ============================================================ */
async function renderDukkan(){
  const main = $('#appMain');
  const shops = await dbGet(`businesses/${GZ.uid}/shops`) || {};
  const lvl = GZ.data.level||1;

  let html = `
    <div class="page-title">🏪 Dükkanlarım <span class="badge-info">Lv ${lvl}</span></div>
    <button class="btn-primary mb-12" onclick="modalNewShop()" style="width:100%">+ Yeni Dükkan</button>
  `;
  if (Object.keys(shops).length === 0){
    html += emptyState('🏪', 'Henüz dükkanın yok', 'İlk dükkanını aç ve para kazanmaya başla');
  } else {
    for (const sid of Object.keys(shops)){
      const s = shops[sid];
      const shelves = s.shelves || {};
      const shCount = Object.keys(shelves).length;
      const totalStock = Object.values(shelves).reduce((a,b)=>a+(b.stock||0),0);
      const totalRev = Object.values(shelves).reduce((a,b)=>a+(b.totalRevenue||0),0);
      html += `
        <div class="card" onclick="openShop('${sid}')">
          <div class="card-row">
            <div class="card-thumb">${shopEmoji(s.type)}</div>
            <div class="card-body">
              <div class="card-title">${shopTypeName(s.type)} <span class="small muted">Lv ${s.level||1}</span></div>
              <div class="card-sub">📍 ${s.city} • ${shCount} reyon • Stok: ${fmtInt(totalStock)}</div>
              <div class="card-sub green">Toplam ciro: ${cashFmt(totalRev)}</div>
            </div>
            <div class="muted">›</div>
          </div>
        </div>
      `;
    }
  }
  main.innerHTML = html;
}

function shopEmoji(t){
  return ({market:'🏪',elektronik:'📱',mobilya:'🛋️',kuyumcu:'💍',beyazesya:'🧊',otomotiv:'🚗',benzin:'⛽'})[t] || '🏪';
}
function shopTypeName(t){
  return ({market:'Market',elektronik:'Elektronik',mobilya:'Mobilya',kuyumcu:'Kuyumcu',beyazesya:'Beyaz Eşya',otomotiv:'Otomotiv',benzin:'Benzin İstasyonu'})[t] || t;
}

async function modalNewShop(){
  const types = [
    { id:'market', name:'Market', emoji:'🏪', cost:5000, lv:1 },
    { id:'elektronik', name:'Elektronik', emoji:'📱', cost:12000, lv:5 },
    { id:'beyazesya', name:'Beyaz Eşya', emoji:'🧊', cost:22000, lv:10 },
    { id:'mobilya', name:'Mobilya', emoji:'🛋️', cost:18000, lv:8 },
    { id:'benzin', name:'Benzin İst.', emoji:'⛽', cost:45000, lv:12 },
    { id:'kuyumcu', name:'Kuyumcu', emoji:'💍', cost:35000, lv:15 },
    { id:'otomotiv', name:'Otomotiv', emoji:'🚗', cost:60000, lv:18 },
  ];
  const lv = GZ.data.level||1;
  const cards = types.map(t => `
    <div class="card" ${lv>=t.lv ? `onclick="pickCity('${t.id}')"` : ''} style="${lv<t.lv?'opacity:.5;':''}">
      <div class="card-row">
        <div class="card-thumb">${t.emoji}</div>
        <div class="card-body">
          <div class="card-title">${t.name}</div>
          <div class="card-sub">${cashFmt(t.cost)} • Lv ${t.lv}+ ${lv<t.lv?'🔒':''}</div>
        </div>
      </div>
    </div>
  `).join('');
  showModal('Yeni Dükkan', cards);
}
window.modalNewShop = modalNewShop;

function pickCity(type){
  closeModal();
  const opts = ILLER.map(c => `<option>${c}</option>`).join('');
  showModal('Şehir Seç', `
    <div class="input-group">
      <label>Şehir</label>
      <select id="newShopCity">${opts}</select>
    </div>
    <button class="btn-primary" onclick="confirmNewShop('${type}')">Aç</button>
  `);
}
window.pickCity = pickCity;

async function confirmNewShop(type){
  const city = $('#newShopCity').value;
  closeModal();
  await buyShop(type, city);
  render('dukkan');
}
window.confirmNewShop = confirmNewShop;

/* Dükkan detayı */
async function openShop(sid){
  const s = await dbGet(`businesses/${GZ.uid}/shops/${sid}`);
  if (!s) return;
  const shelves = s.shelves || {};
  let body = `
    <div class="stats-grid">
      <div class="stat-box"><div class="lbl">Seviye</div><div class="val">${s.level||1}</div></div>
      <div class="stat-box"><div class="lbl">Çalışan</div><div class="val">${s.employees||1}</div></div>
      <div class="stat-box"><div class="lbl">Şehir</div><div class="val" style="font-size:13px">${s.city}</div></div>
      <div class="stat-box"><div class="lbl">Reyonlar</div><div class="val">${Object.keys(shelves).length}</div></div>
    </div>
    <div class="flex gap-8 mb-12">
      <button class="btn-primary" style="flex:1" onclick="openShelfPicker('${sid}')">+ Yeni Reyon</button>
      <button class="btn-secondary" style="flex:1" onclick="upgradeShop('${sid}').then(()=>{closeModal();openShop('${sid}')})">⬆️ Yükselt</button>
    </div>
    <div class="section-title">REYONLAR</div>
  `;
  if (Object.keys(shelves).length === 0){
    body += `<div class="empty-state"><div class="emoji">📦</div><h3>Boş reyon</h3><p>Reyona ürün eklemeden satış olmaz</p></div>`;
  } else {
    for (const k of Object.keys(shelves)){
      const sh = shelves[k];
      const u = URUNLER[k]; if (!u) continue;
      const pct = Math.min(100, ((sh.stock||0)/(sh.max||1))*100);
      const cls = pct < 20 ? 'empty' : pct < 50 ? 'warn' : '';
      body += `
        <div class="shelf-item">
          <div class="shelf-head">
            <div class="shelf-emoji">${u.emo}</div>
            <div class="shelf-name">
              ${u.name}
              <div class="shelf-stock">${sh.stock||0} / ${sh.max||50} ${u.unit}</div>
            </div>
          </div>
          <div class="shelf-prog"><div class="shelf-prog-fill ${cls}" style="width:${pct}%"></div></div>
          <div class="shelf-row">
            <span class="muted">Maliyet: ${cashFmt(sh.cost||0)}</span>
            <span class="price">${cashFmt(sh.price||0)}</span>
          </div>
          <div class="shelf-row small muted">
            <span>Satış: ${fmtInt(sh.totalSold||0)} ${u.unit}</span>
            <span>Ciro: ${cashFmt(sh.totalRevenue||0)}</span>
          </div>
          <div class="shelf-actions">
            <button class="btn-mini primary" onclick="askBuyStock('${sid}','${k}')">+ Stok</button>
            <button class="btn-mini" onclick="askSetPrice('${sid}','${k}',${sh.price||u.base})">💰 Fiyat</button>
            <button class="btn-mini danger" onclick="askDeleteShelf('${sid}','${k}')">🗑️</button>
          </div>
        </div>
      `;
    }
  }
  showModal(shopTypeName(s.type) + ' • ' + s.city, body);
}
window.openShop = openShop;

async function openShelfPicker(sid){
  closeModal();
  let body = '';
  for (const cat of Object.keys(URUN_KATEGORI)){
    const items = Object.entries(URUNLER).filter(([k,u])=>u.cat===cat);
    if (items.length === 0) continue;
    body += `<div class="section-title">${URUN_KATEGORI[cat]}</div><div class="grid-3">`;
    for (const [k,u] of items){
      const locked = (GZ.data.level||1) < u.lv;
      body += `<div class="product-card" ${locked?'style="opacity:.4"':`onclick="addShelf('${sid}','${k}').then(()=>{closeModal();openShop('${sid}')})"`}>
        <div class="emoji">${u.emo}</div>
        <div class="name">${u.name}${locked?` 🔒Lv${u.lv}`:''}</div>
      </div>`;
    }
    body += '</div>';
  }
  showModal('Ürün Seç', body);
}
window.openShelfPicker = openShelfPicker;

function askBuyStock(sid, k){
  const u = URUNLER[k];
  showModal('Stok Al', `
    <div class="input-group">
      <label>${u.emo} ${u.name} — Birim: ${cashFmt(u.base)}</label>
      <input type="number" id="stockQty" placeholder="Miktar (${u.unit})" min="1" value="50">
    </div>
    <button class="btn-primary" onclick="confirmBuyStock('${sid}','${k}')">Satın Al</button>
  `);
}
window.askBuyStock = askBuyStock;
async function confirmBuyStock(sid,k){
  const q = parseInt($('#stockQty').value);
  if (!q || q<=0) return toast('Geçersiz miktar','error');
  closeModal();
  await buyShelfStock(sid, k, q);
  openShop(sid);
}
window.confirmBuyStock = confirmBuyStock;

function askSetPrice(sid, k, cur){
  const u = URUNLER[k];
  showModal('Satış Fiyatı', `
    <div class="input-group">
      <label>${u.emo} ${u.name}</label>
      <p class="small muted mb-8">Taban: ${cashFmt(u.base)} • Önerilen: ${cashFmt(u.base*1.5)}</p>
      <input type="number" id="newPrice" step="0.01" value="${cur}">
    </div>
    <button class="btn-primary" onclick="confirmSetPrice('${sid}','${k}')">Kaydet</button>
  `);
}
window.askSetPrice = askSetPrice;
async function confirmSetPrice(sid,k){
  const p = parseFloat($('#newPrice').value);
  closeModal();
  await setShelfPrice(sid, k, p);
  openShop(sid);
}
window.confirmSetPrice = confirmSetPrice;

function askDeleteShelf(sid,k){
  if (!confirm('Bu reyonu silmek istiyor musun? Mevcut stok kaybolur.')) return;
  deleteShelf(sid,k).then(()=>openShop(sid));
}
window.askDeleteShelf = askDeleteShelf;

/* ============================================================
   ÜRETİM SAYFALARI
   ============================================================ */
async function renderProduction(kind, title, emoji, allowedItems, lvLock){
  const main = $('#appMain');
  if (lvLock && (GZ.data.level||1) < lvLock){
    main.innerHTML = `<div class="locked-state">
      <div class="lock-icon">🔒</div>
      <h3>${lvLock}. Seviyede Açılacak</h3>
      <p>Şu anki seviyen: ${GZ.data.level||1}</p>
    </div>`;
    return;
  }
  const list = await dbGet(`businesses/${GZ.uid}/${kind}`) || {};
  let html = `<div class="page-title">${emoji} ${title}</div>
    <button class="btn-primary mb-12" onclick="buyProductionUnit('${kind}').then(()=>render('${GZ.currentTab}'))" style="width:100%">+ Yeni</button>`;
  if (Object.keys(list).length === 0){
    html += emptyState(emoji, 'Henüz yok', 'Aç ve üretmeye başla');
  } else {
    for (const id of Object.keys(list)){
      const it = list[id];
      let status = '<span class="muted">Boş — ekim yapın</span>';
      let action = `<button class="btn-mini primary" onclick='openPlantPicker("${kind}","${id}",${JSON.stringify(allowedItems)})'>+ Ekim</button>`;
      if (it.crop && it.harvestAt){
        if (now() >= it.harvestAt){
          status = `<span class="green bold">✓ Hasada hazır: ${URUNLER[it.crop]?.name}</span>`;
          action = `<button class="btn-mini success" onclick="harvest('${kind}','${id}').then(()=>render('${GZ.currentTab}'))">🌾 Hasat Et</button>`;
        } else {
          const remaining = Math.ceil((it.harvestAt - now())/1000);
          const m = Math.floor(remaining/60), s = remaining%60;
          status = `<span class="muted">${URUNLER[it.crop]?.emo} ${URUNLER[it.crop]?.name} büyüyor — ${m}d ${s}s</span>`;
        }
      }
      html += `
        <div class="card">
          <div class="card-row">
            <div class="card-thumb">${emoji}</div>
            <div class="card-body">
              <div class="card-title">#${id.slice(-4)} <span class="small muted">Lv ${it.level||1}</span></div>
              <div class="card-sub">${status}</div>
            </div>
          </div>
          <div class="card-actions">
            ${action}
            <button class="btn-mini" onclick="upgradeProductionUnit('${kind}','${id}').then(()=>render('${GZ.currentTab}'))">⬆️ Lv (${cashFmt((it.level||1)*2500)})</button>
          </div>
        </div>
      `;
    }
  }
  main.innerHTML = html;

  // Geri sayım canlı
  const tabMap = {gardens:'bahce',farms:'ciftlik',factories:'fabrika',mines:'maden'};
  if (Object.values(list).some(i=>i.crop && i.harvestAt && now() < i.harvestAt)){
    setTimeout(()=>{ if (GZ.currentTab === tabMap[kind]) render(GZ.currentTab); }, 1000);
  }
}

function openPlantPicker(kind, id, allowed){
  let body = '<div class="grid-3">';
  for (const k of allowed){
    const u = URUNLER[k]; if (!u) continue;
    const locked = (GZ.data.level||1) < u.lv;
    body += `<div class="product-card" ${locked?'style="opacity:.4"':`onclick="plantCrop('${kind}','${id}','${k}').then(()=>{closeModal();render(GZ.currentTab)})"`}>
      <div class="emoji">${u.emo}</div>
      <div class="name">${u.name}${locked?` 🔒Lv${u.lv}`:''}</div>
    </div>`;
  }
  body += '</div>';
  showModal('Ne Ekelim?', body);
}
window.openPlantPicker = openPlantPicker;

/* ============================================================
   LOJİSTİK
   ============================================================ */
async function renderLojistik(){
  const main = $('#appMain');
  const wh = await dbGet(`businesses/${GZ.uid}/warehouses`) || {};
  const main_ = await dbGet(`businesses/${GZ.uid}/mainWarehouse`) || {};
  let html = `<div class="page-title">🚚 Lojistik</div>`;

  // Ana depo
  const mainItems = Object.entries(main_).filter(([k,v])=>v>0);
  html += `<div class="card">
    <div class="card-row">
      <div class="card-thumb">📦</div>
      <div class="card-body">
        <div class="card-title">Ana Depo</div>
        <div class="card-sub">${mainItems.length} ürün çeşidi</div>
      </div>
    </div>`;
  if (mainItems.length){
    html += '<div class="divider"></div>';
    for (const [k,v] of mainItems){
      const u = URUNLER[k]; if (!u) continue;
      html += `<div class="row-between" style="padding:6px 0">
        <span>${u.emo} ${u.name}</span>
        <b>${fmtInt(v)} ${u.unit}</b>
      </div>`;
    }
  } else {
    html += '<p class="small muted mt-12">Boş — bahçe/çiftlik/fabrikadan hasat ile dolar</p>';
  }
  html += '</div>';

  html += `<div class="row-between mb-12 mt-12">
    <h3 style="font-size:15px">Şehir Depoları</h3>
    <button class="btn-primary" onclick="openWarehouseCity()">+ Depo Aç</button>
  </div>`;

  if (Object.keys(wh).length === 0){
    html += `<div class="empty-state"><div class="emoji">🚚</div><h3>Şehir deposu yok</h3><p>81 ilden istediğin yere depo açabilirsin</p></div>`;
  } else {
    for (const c of Object.keys(wh)){
      const w = wh[c];
      const items = w.items || {};
      const itemKeys = Object.entries(items).filter(([k,v])=>v>0);
      const used = itemKeys.reduce((a,b)=>a+b[1],0);
      html += `<div class="card" onclick="openWarehouseDetail('${c}')">
        <div class="card-row">
          <div class="card-thumb">🏭</div>
          <div class="card-body">
            <div class="card-title">${c} Depo</div>
            <div class="card-sub">${fmtInt(used)} / ${fmtInt(w.capacity)} kapasite • ${itemKeys.length} ürün</div>
          </div>
          <div class="muted">›</div>
        </div>
      </div>`;
    }
  }

  main.innerHTML = html;
}

function openWarehouseCity(){
  const opts = ILLER.map(c => `<option>${c}</option>`).join('');
  showModal('Yeni Depo Aç', `
    <div class="input-group">
      <label>Şehir</label>
      <select id="whCity">${opts}</select>
    </div>
    <p class="small muted mb-8">Maliyet: 25.000 ₺ veya 100 💎</p>
    <div class="flex gap-8">
      <button class="btn-primary" style="flex:1" onclick="buyWarehouse($('#whCity').value,'cash').then(()=>{closeModal();render('lojistik')})">25.000 ₺</button>
      <button class="btn-secondary" style="flex:1" onclick="buyWarehouse($('#whCity').value,'diamond').then(()=>{closeModal();render('lojistik')})">💎 100</button>
    </div>
  `);
}
window.openWarehouseCity = openWarehouseCity;

async function openWarehouseDetail(city){
  const w = await dbGet(`businesses/${GZ.uid}/warehouses/${city}`);
  if (!w) return;
  const items = w.items || {};
  let body = `<p class="small muted mb-8">Kapasite: ${fmtInt(w.capacity)}</p>`;
  const list = Object.entries(items).filter(([k,v])=>v>0);
  if (list.length === 0){
    body += '<div class="empty-state"><p>Bu depo boş</p></div>';
  } else {
    for (const [k,v] of list){
      const u = URUNLER[k]; if (!u) continue;
      body += `<div class="row-between" style="padding:8px 0;border-bottom:1px solid var(--border)">
        <span>${u.emo} ${u.name}</span>
        <b>${fmtInt(v)} ${u.unit}</b>
      </div>`;
    }
  }
  showModal(`${city} Depo`, body);
}
window.openWarehouseDetail = openWarehouseDetail;

/* ============================================================
   İHRACAT
   ============================================================ */
async function renderIhracat(){
  const main = $('#appMain');
  const list = await dbGet('exports/list') || {};
  let html = `<div class="page-title">🚢 İhracat <span class="badge-info">Stoğunu satabilirsin</span></div>`;
  const arr = Object.values(list).sort((a,b)=>b.pricePerUnit - a.pricePerUnit);
  if (arr.length === 0){
    html += '<div class="empty-state"><div class="emoji">🚢</div><h3>Talep listesi yenileniyor</h3></div>';
  } else {
    for (const ex of arr){
      const u = URUNLER[ex.item]; if (!u) continue;
      const remaining = ex.demand - (ex.fulfilled||0);
      const pct = ((ex.fulfilled||0)/ex.demand)*100;
      html += `
        <div class="card">
          <div class="card-row">
            <div class="card-thumb">${ex.flag}</div>
            <div class="card-body">
              <div class="card-title">${ex.sirket}</div>
              <div class="card-sub">${ex.country} • ${u.emo} ${u.name}</div>
            </div>
          </div>
          <div class="row-between mt-12">
            <span class="small">Fiyat: <b class="green">${cashFmt(ex.pricePerUnit)}</b> /${u.unit}</span>
            <span class="small">Kalan: ${fmtInt(remaining)}</span>
          </div>
          <div class="shelf-prog"><div class="shelf-prog-fill" style="width:${pct}%"></div></div>
          <div class="row-between small muted">
            <span>Min: ${fmtInt(ex.minOrder)}</span>
            <span>${fmtInt(ex.fulfilled||0)} / ${fmtInt(ex.demand)}</span>
          </div>
          <button class="btn-primary mt-12" style="width:100%" onclick="askExportShip('${ex.id}')">🚚 Gönder</button>
        </div>
      `;
    }
  }
  main.innerHTML = html;
}

async function askExportShip(exId){
  const ex = await dbGet(`exports/list/${exId}`);
  if (!ex) return;
  const u = URUNLER[ex.item];
  const myStock = await getTotalStock(GZ.uid, ex.item);
  showModal(`${u.emo} ${u.name} Gönder`, `
    <p class="small muted mb-8">Stoğunda: <b>${fmtInt(myStock)} ${u.unit}</b></p>
    <p class="small muted mb-8">Min sipariş: ${fmtInt(ex.minOrder)} • Birim: ${cashFmt(ex.pricePerUnit)}</p>
    <div class="input-group">
      <label>Miktar</label>
      <input type="number" id="exQty" value="${Math.min(myStock, ex.minOrder)}" min="${ex.minOrder}" max="${myStock}">
    </div>
    <button class="btn-primary" onclick="confirmExport('${exId}')">Gönder</button>
  `);
}
window.askExportShip = askExportShip;

async function confirmExport(exId){
  const q = parseInt($('#exQty').value);
  if (!q || q<=0) return toast('Geçersiz miktar','error');
  closeModal();
  await exportShip(exId, q);
  render('ihracat');
}
window.confirmExport = confirmExport;

/* ============================================================
   İHALE
   ============================================================ */
async function renderIhale(){
  const main = $('#appMain');
  const list = await dbGet('auctions/list') || {};
  let html = `<div class="page-title">⚖️ İhaleler</div>`;
  const arr = Object.values(list).filter(a=>!a.finalized).sort((a,b)=>a.endsAt-b.endsAt);
  if (arr.length === 0){
    html += '<div class="empty-state"><div class="emoji">⚖️</div><h3>Yenisi hazırlanıyor</h3></div>';
  } else {
    for (const a of arr){
      const u = URUNLER[a.item]; if (!u) continue;
      const remaining = Math.max(0, a.endsAt - now());
      const m = Math.floor(remaining/60000);
      const s = Math.floor((remaining%60000)/1000);
      html += `
        <div class="card">
          <div class="card-row">
            <div class="card-thumb">${a.flag}</div>
            <div class="card-body">
              <div class="card-title">${a.sirket}</div>
              <div class="card-sub">${a.country}</div>
            </div>
          </div>
          <div class="tac mt-12">
            <div style="font-size:42px">${u.emo}</div>
            <div class="bold">${fmtInt(a.qty)} ${u.unit} ${u.name}</div>
            <div class="small muted">Min teklif: ${cashFmt(a.minBid)}/${u.unit}</div>
          </div>
          <div class="tac mt-12">
            <span class="timer-pill ${remaining<60000?'warn':''}">⏱ ${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}</span>
          </div>
          <div class="row-between mt-12">
            <span>En yüksek teklif:</span>
            <b class="green">${cashFmt(a.currentBid)}/${u.unit}</b>
          </div>
          <div class="small muted">${a.currentBidderName ? `Lider: ${a.currentBidderName}` : 'Henüz teklif yok'}</div>
          <button class="btn-primary mt-12" style="width:100%" onclick="askBid('${a.id}')">💰 Teklif Ver</button>
        </div>
      `;
    }
  }
  main.innerHTML = html;
  if (GZ.currentTab === 'ihale'){
    setTimeout(()=>{ if (GZ.currentTab==='ihale') renderIhale(); }, 1000);
  }
}

async function askBid(auId){
  const a = await dbGet(`auctions/list/${auId}`);
  if (!a) return;
  const u = URUNLER[a.item];
  const minNext = +(a.currentBid + 0.01).toFixed(2);
  showModal('Teklif Ver', `
    <p class="small mb-8">Mevcut: <b>${cashFmt(a.currentBid)}/${u.unit}</b></p>
    <p class="small muted mb-8">${fmtInt(a.qty)} ${u.unit} → Toplam: ${cashFmt(minNext * a.qty)} (min)</p>
    <div class="input-group">
      <label>Birim Teklif (${u.unit} başına)</label>
      <input type="number" id="bidPrice" step="0.01" value="${minNext}" min="${minNext}">
    </div>
    <button class="btn-primary" onclick="confirmBid('${auId}')">Teklif Ver</button>
  `);
}
window.askBid = askBid;

async function confirmBid(auId){
  const p = parseFloat($('#bidPrice').value);
  closeModal();
  await placeBid(auId, p);
  renderIhale();
}
window.confirmBid = confirmBid;

/* ============================================================
   KRİPTO
   ============================================================ */
async function renderKripto(){
  const main = $('#appMain');
  let html = `<div class="page-title">📈 Kripto Borsa</div>
    <div class="subtabs">
      <button class="subtab active" onclick="cryptoView('all',event)">Tümü</button>
      <button class="subtab" onclick="cryptoView('mine',event)">Cüzdanım</button>
    </div>
    <div id="cryptoList"></div>`;
  main.innerHTML = html;
  drawCryptoList('all');
}

function cryptoView(view, ev){
  $$('.subtab').forEach(b=>b.classList.remove('active'));
  if (ev && ev.target) ev.target.classList.add('active');
  drawCryptoList(view);
}
window.cryptoView = cryptoView;

async function drawCryptoList(view){
  const list = $('#cryptoList'); if (!list) return;
  const holdings = await dbGet(`crypto/holdings/${GZ.uid}`) || {};
  let html = '';
  for (const k of KRIPTO){
    const p = GZ.prices[k.sym] || { current: k.base, prev: k.base };
    const change = ((p.current - p.prev)/(p.prev||1))*100;
    const own = holdings[k.sym] || 0;
    if (view==='mine' && own <= 0) continue;
    html += `
      <div class="crypto-row" onclick="openCryptoDetail('${k.sym}')">
        <div class="crypto-icon" style="background:${k.color}">${k.sym[0]}</div>
        <div class="crypto-name">
          <div class="nm">${k.name}</div>
          <div class="sym">${k.sym}${own>0?` • ${own.toFixed(4)}`:''}</div>
        </div>
        <div class="crypto-price">
          <div class="pr">${cashFmt(p.current)}</div>
          <div class="ch ${change>=0?'up':'down'}">${change>=0?'▲':'▼'} %${Math.abs(change).toFixed(2)}</div>
        </div>
      </div>
    `;
  }
  if (!html) html = '<div class="empty-state"><p>Cüzdanın boş</p></div>';
  list.innerHTML = html;
}

async function openCryptoDetail(sym){
  const k = KRIPTO.find(x=>x.sym===sym); if (!k) return;
  const p = GZ.prices[sym] || { current: k.base };
  const own = (await dbGet(`crypto/holdings/${GZ.uid}/${sym}`)) || 0;
  const value = own * p.current;
  showModal(`${k.name} (${sym})`, `
    <div class="tac mb-12">
      <div style="font-size:32px;color:${k.color};font-weight:800">${cashFmt(p.current)}</div>
    </div>
    <div class="stats-grid">
      <div class="stat-box"><div class="lbl">Bakiye</div><div class="val">${own.toFixed(4)}</div></div>
      <div class="stat-box"><div class="lbl">Değer</div><div class="val green">${cashFmt(value)}</div></div>
      <div class="stat-box"><div class="lbl">Toplam Arz</div><div class="val" style="font-size:11px">${fmtInt(k.supply)}</div></div>
      <div class="stat-box"><div class="lbl">Piyasa Değeri</div><div class="val" style="font-size:11px">${cashFmt(p.current * k.supply)}</div></div>
    </div>
    <div class="subtabs mt-12">
      <button class="subtab active" onclick="cryptoOp('buy','${sym}',event)">AL</button>
      <button class="subtab" onclick="cryptoOp('sell','${sym}',event)">SAT</button>
    </div>
    <div id="cryptoOp"></div>
  `);
  cryptoOp('buy', sym);
}
window.openCryptoDetail = openCryptoDetail;

function cryptoOp(op, sym, ev){
  $$('.subtab').forEach(b=>b.classList.remove('active'));
  if (ev && ev.target) ev.target.classList.add('active');
  const div = $('#cryptoOp');
  if (!div) return;
  if (op === 'buy'){
    div.innerHTML = `
      <div class="input-group mt-12">
        <label>Tutar (₺)</label>
        <input type="number" id="cryptoTl" step="0.01" placeholder="Ne kadarlık alacaksın?">
      </div>
      <button class="btn-success" onclick="buyCrypto('${sym}',parseFloat($('#cryptoTl').value)).then(()=>{closeModal();render('kripto')})" style="width:100%">SATIN AL</button>
    `;
  } else {
    div.innerHTML = `
      <div class="input-group mt-12">
        <label>Miktar (${sym})</label>
        <input type="number" id="cryptoQty" step="0.0001" placeholder="Satılacak miktar">
      </div>
      <button class="btn-danger" onclick="sellCrypto('${sym}',parseFloat($('#cryptoQty').value)).then(()=>{closeModal();render('kripto')})" style="width:100%">SAT</button>
    `;
  }
}
window.cryptoOp = cryptoOp;

/* ============================================================
   MARKA
   ============================================================ */
async function renderMarka(){
  const main = $('#appMain');
  const myBrand = GZ.data.brand;
  let html = `<div class="page-title">🏢 Markalar</div>`;
  if (!myBrand){
    html += `<button class="btn-primary mb-12" onclick="askCreateBrand()" style="width:100%">+ Marka Kur (25.000 ₺ • Lv 10+)</button>`;
  } else {
    const b = await dbGet(`brands/${myBrand}`);
    if (b){
      html += `<div class="card">
        <div class="card-title">${b.name} <span class="small muted">${b.leader===GZ.uid?'(Lider)':''}</span></div>
        <div class="card-sub">Üye: ${Object.keys(b.members||{}).length} • Puan: ${b.points||0}</div>
        <button class="btn-mini danger mt-12" onclick="leaveBrand().then(()=>render('marka'))">Markadan Ayrıl</button>
      </div>`;
    }
  }
  // Tüm markalar (gerçek oyuncuların kurduğu)
  const allBrands = await dbGet('brands') || {};
  const arr = Object.values(allBrands).sort((a,b)=>(b.points||0)-(a.points||0));
  html += `<div class="section-title">Tüm Markalar (${arr.length})</div>`;
  if (arr.length === 0){
    html += emptyState('🏢','Henüz marka yok','İlk markayı sen kur');
  } else {
    for (let i=0;i<arr.length;i++){
      const b = arr[i];
      const memCount = Object.keys(b.members||{}).length;
      const isMine = b.id === myBrand;
      html += `<div class="card">
        <div class="card-row">
          <div class="card-thumb">🏢</div>
          <div class="card-body">
            <div class="card-title">#${i+1} ${b.name}</div>
            <div class="card-sub">Lider: ${b.leaderName} • ${memCount} üye • ${b.points||0} puan</div>
          </div>
          ${isMine ? '<span class="small green">✓</span>' : (myBrand ? '' : `<button class="btn-mini primary" onclick="joinBrand('${b.id}').then(()=>render('marka'))">Katıl</button>`)}
        </div>
      </div>`;
    }
  }
  main.innerHTML = html;
}

function askCreateBrand(){
  showModal('Marka Kur', `
    <p class="small muted mb-8">Maliyet: 25.000 ₺ • Min Lv 10</p>
    <div class="input-group">
      <label>Marka Adı (3-20 harf/rakam)</label>
      <input type="text" id="brandName" maxlength="20" placeholder="Örn: TURAN">
    </div>
    <button class="btn-primary" onclick="createBrand($('#brandName').value).then(()=>{closeModal();render('marka')})">Kur</button>
  `);
}
window.askCreateBrand = askCreateBrand;

/* ============================================================
   PAZAR
   ============================================================ */
async function renderPazar(){
  const main = $('#appMain');
  const shops = await dbGet(`businesses/${GZ.uid}/shops`) || {};
  let totalRev = 0, totalSold = 0, totalShelves = 0;
  for (const s of Object.values(shops)){
    const shelves = s.shelves || {};
    for (const k of Object.keys(shelves)){
      const sh = shelves[k];
      totalShelves++;
      totalRev += sh.totalRevenue || 0;
      totalSold += sh.totalSold || 0;
    }
  }
  let html = `<div class="page-title">🛒 Oyuncu Pazarı</div>
    <div class="stats-grid">
      <div class="stat-box"><div class="lbl">Toplam Reyon</div><div class="val">${totalShelves}</div></div>
      <div class="stat-box"><div class="lbl">Toplam Ciro</div><div class="val green">${cashFmt(totalRev)}</div></div>
      <div class="stat-box"><div class="lbl">Satış (adet)</div><div class="val">${fmtInt(totalSold)}</div></div>
      <div class="stat-box"><div class="lbl">Şehir</div><div class="val" style="font-size:13px">${GZ.data.location||'İstanbul'}</div></div>
    </div>
    <div class="card">
      <div class="card-title">📊 Pazar Mantığı</div>
      <p class="small muted mt-12">• Pazar her 90 saniyede otomatik döner<br>• Reyona stok eklemediğin sürece <b>satış olmaz</b><br>• Fiyat tabanın 1.5x altındaysa: satış %50 artar<br>• 3x üzerindeyse satış %90 düşer<br>• Açılış 24 saatinde 5x bonus<br>• Yüksek seviye dükkan = daha hızlı satış</p>
    </div>
    <div class="card mt-12">
      <div class="card-title">💡 Para Kazanmak İçin</div>
      <p class="small mt-12">1. Dükkan aç → reyon ekle → stok yükle → fiyat ayarla<br>2. Bahçe/çiftlik/fabrika ile <b>kendi üretimini</b> yap<br>3. Üretim → ihracat (2-3 katı kâr)<br>4. İhalelerde kazan → ihracat olarak sat<br>5. Banka yatırımı %0,3/gün</p>
    </div>`;
  main.innerHTML = html;
}

/* ============================================================
   LİDERLİK
   ============================================================ */
async function renderLiderlik(){
  const main = $('#appMain');
  let html = `<div class="page-title">🏆 Liderlik</div>
    <div class="subtabs">
      <button class="subtab active" onclick="lbView('total',event)">Servet</button>
      <button class="subtab" onclick="lbView('level',event)">Seviye</button>
      <button class="subtab" onclick="lbView('online',event)">Çevrimiçi</button>
    </div>
    <div id="lbList"><div class="spinner" style="margin:20px auto"></div></div>`;
  main.innerHTML = html;
  lbView('total');
}

async function lbView(mode, ev){
  $$('.subtab').forEach(b=>b.classList.remove('active'));
  if (ev && ev.target) ev.target.classList.add('active');
  const list = $('#lbList'); if (!list) return;
  list.innerHTML = '<div class="spinner" style="margin:20px auto"></div>';

  // GERÇEK kullanıcılar — bot yok
  const usersRaw = await dbGet('users') || {};
  let users = Object.entries(usersRaw)
    .map(([uid,u]) => ({ uid, ...u }))
    .filter(u => !u.banned && u.username);

  if (mode === 'total'){
    users.sort((a,b) => (b.netWorth||b.money||0) - (a.netWorth||a.money||0));
  } else if (mode === 'level'){
    users.sort((a,b) => (b.level||1) - (a.level||1));
  } else if (mode === 'online'){
    users = users.filter(u=>u.online);
    users.sort((a,b) => (b.netWorth||b.money||0) - (a.netWorth||a.money||0));
  }
  users = users.slice(0, 100);

  if (users.length === 0){
    list.innerHTML = emptyState('🏆','Listede oyuncu yok','İlk sırada sen olabilirsin');
    return;
  }

  let html = '';
  for (let i=0;i<users.length;i++){
    const u = users[i];
    const rank = i+1;
    const cls = rank===1?'gold':rank===2?'silver':rank===3?'bronze':'';
    const val = mode==='level' ? `Lv ${u.level||1}` : cashFmt(u.netWorth||u.money||0);
    html += `<div class="list-row" onclick="openProfile('${u.uid}')">
      <div class="rank ${cls}">#${rank}</div>
      <div class="av">${(u.username||'?')[0].toUpperCase()}</div>
      <div class="name">${u.username||'?'} ${u.online?'<span class="green small">●</span>':''}</div>
      <div class="lv">Lv ${u.level||1}</div>
      <div class="val">${val}</div>
    </div>`;
  }
  list.innerHTML = html;
}
window.lbView = lbView;

async function openProfile(uid){
  const u = await dbGet(`users/${uid}`);
  if (!u) return;
  const shops = await dbGet(`businesses/${uid}/shops`) || {};
  const isMe = uid === GZ.uid;
  const isFriend = (await dbGet(`friends/${GZ.uid}/${uid}`)) ? true : false;
  const lastSeen = u.lastSeen ? new Date(u.lastSeen).toLocaleString('tr-TR') : 'Hiç';

  showModal('Oyuncu Profili', `
    <div class="tac mb-12">
      <div style="width:80px;height:80px;font-size:36px;margin:0 auto 8px;background:var(--blue-l);border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;color:var(--primary)">${(u.username||'?')[0].toUpperCase()}</div>
      <h3>${u.username} ${u.online?'<span class="green">●</span>':''}</h3>
      <p class="small muted">${u.location||''} • ${u.online?'Çevrimiçi':'Son: '+lastSeen}</p>
    </div>
    <div class="stats-grid">
      <div class="stat-box"><div class="lbl">Seviye</div><div class="val">${u.level||1}</div></div>
      <div class="stat-box"><div class="lbl">Servet</div><div class="val green" style="font-size:13px">${cashFmt(u.netWorth||u.money||0)}</div></div>
      <div class="stat-box"><div class="lbl">Dükkanları</div><div class="val">${Object.keys(shops).length}</div></div>
      <div class="stat-box"><div class="lbl">Üyelik</div><div class="val" style="font-size:11px">${u.createdAt?new Date(u.createdAt).toLocaleDateString('tr-TR'):'-'}</div></div>
    </div>
    ${u.bio ? `<div class="card mt-12"><div class="small muted">Hakkında</div><p class="mt-12">${escapeHtml(u.bio)}</p></div>` : ''}
    ${!isMe ? `
      <div class="flex gap-8 mt-12">
        ${isFriend ? `
          <button class="btn-secondary" style="flex:1" onclick="removeFriend('${uid}').then(()=>{closeModal();})">✓ Arkadaş</button>
          <button class="btn-primary" style="flex:1" onclick="askLend('${uid}','${u.username}')">💸 Borç Ver</button>
        ` : `
          <button class="btn-primary" style="flex:1" onclick="addFriend('${uid}').then(()=>{closeModal();openProfile('${uid}')})">+ Arkadaş Ekle</button>
        `}
      </div>
    ` : ''}
  `);
}
window.openProfile = openProfile;

async function addFriend(uid){
  await dbSet(`friends/${GZ.uid}/${uid}`, now());
  await dbSet(`friends/${uid}/${GZ.uid}`, now());
  toast('Arkadaş eklendi','success');
}
window.addFriend = addFriend;

async function removeFriend(uid){
  await db.ref(`friends/${GZ.uid}/${uid}`).remove();
  await db.ref(`friends/${uid}/${GZ.uid}`).remove();
  toast('Arkadaşlık kaldırıldı');
}
window.removeFriend = removeFriend;

function askLend(uid, username){
  showModal('Borç Ver', `
    <p class="mb-8">Kime: <b>${username}</b></p>
    <div class="input-group">
      <label>Tutar (₺)</label>
      <input type="number" id="lendAmount" step="0.01" min="1">
    </div>
    <button class="btn-primary" onclick="confirmLend('${uid}')">Gönder</button>
  `);
}
window.askLend = askLend;

async function confirmLend(uid){
  const amt = parseFloat($('#lendAmount').value);
  if (!amt || amt<=0) return toast('Geçersiz tutar','error');
  const ok = await spendCash(GZ.uid, amt, 'lend');
  if (!ok) return toast('Yetersiz bakiye','error');
  await addCash(uid, amt, 'borrow-from-friend');
  await pushNotif(uid, `💸 ${GZ.data.username} sana ${cashFmt(amt)} gönderdi`);
  await dbPush(`loans`, { from:GZ.uid, to:uid, amount:amt, paid:0, createdAt:now() });
  toast('Gönderildi','success');
  closeModal();
}
window.confirmLend = confirmLend;

/* ============================================================
   HABERLER
   ============================================================ */
async function renderHaberler(){
  const main = $('#appMain');
  const exps = await dbGet('exports/list') || {};
  const auctions = await dbGet('auctions/list') || {};

  const topEx = Object.values(exps).sort((a,b)=>b.pricePerUnit-a.pricePerUnit)[0];
  let topGain = null, topLoss = null;
  for (const k of KRIPTO){
    const p = GZ.prices[k.sym]; if (!p) continue;
    const ch = ((p.current - p.prev)/(p.prev||1))*100;
    if (!topGain || ch > topGain.change) topGain = { ...k, change:ch, price:p.current };
    if (!topLoss || ch < topLoss.change) topLoss = { ...k, change:ch, price:p.current };
  }

  let html = `<div class="page-title">📰 Haberler</div>`;
  if (topGain && topGain.change > 0){
    html += `<div class="card">
      <div class="card-title green">📈 ${topGain.name} (${topGain.sym}) yükselişte!</div>
      <p class="small mt-12">Birim fiyatı %${Math.abs(topGain.change).toFixed(2)} arttı, şu an ${cashFmt(topGain.price)} seviyesinde işlem görüyor.</p>
    </div>`;
  }
  if (topLoss && topLoss.change < 0){
    html += `<div class="card">
      <div class="card-title red">📉 ${topLoss.name} sert düşüş</div>
      <p class="small mt-12">${topLoss.sym} %${Math.abs(topLoss.change).toFixed(2)} kayıpla ${cashFmt(topLoss.price)} seviyesine geriledi.</p>
    </div>`;
  }
  if (topEx){
    const u = URUNLER[topEx.item];
    html += `<div class="card">
      <div class="card-title">${topEx.flag} ${topEx.country} büyük talep açtı</div>
      <p class="small mt-12">${topEx.sirket} ${fmtInt(topEx.demand)} ${u?.unit} ${u?.name} talep etti, birim fiyatı: ${cashFmt(topEx.pricePerUnit)}</p>
    </div>`;
  }
  const liveAu = Object.values(auctions).filter(a=>!a.finalized);
  if (liveAu.length){
    const a = liveAu[0];
    const u = URUNLER[a.item];
    html += `<div class="card">
      <div class="card-title">⚖️ Sıcak ihale: ${a.country}</div>
      <p class="small mt-12">${u?.emo} ${fmtInt(a.qty)} ${u?.unit} ${u?.name} için açık ihale. Mevcut teklif: ${cashFmt(a.currentBid)}/${u?.unit}</p>
    </div>`;
  }
  // Liderlik
  const usersRaw = await dbGet('users') || {};
  const top = Object.values(usersRaw).filter(u=>!u.banned).sort((a,b)=>(b.netWorth||b.money||0)-(a.netWorth||a.money||0))[0];
  if (top){
    html += `<div class="card">
      <div class="card-title">🏆 Servet zirvesi</div>
      <p class="small mt-12">Lider: <b>${top.username}</b> — ${cashFmt(top.netWorth||top.money||0)} servet ile sıralamanın başında.</p>
    </div>`;
  }
  main.innerHTML = html;
}

/* ============================================================
   ŞEHİRLER
   ============================================================ */
async function renderSehirler(){
  const main = $('#appMain');
  const my = GZ.data.location || 'İstanbul';
  let html = `<div class="page-title">🏙️ Şehirler</div>
    <p class="small muted mb-12">Şehir seçimi dükkanların açıldığı yeri ve halk talebini etkiler.</p>`;
  for (const c of ILLER){
    const isMine = c === my;
    const pop = (Math.floor((c.charCodeAt(0)*7919) % 5)+1) * 100000; // sahte ama tutarlı
    html += `<div class="card" ${isMine?'':`onclick="moveCity('${c}')"`}>
      <div class="card-row">
        <div class="card-thumb">📍</div>
        <div class="card-body">
          <div class="card-title">${c} ${isMine?'<span class="small green">(Şehrin)</span>':''}</div>
          <div class="card-sub">Tahmini nüfus: ${fmtInt(pop)}</div>
        </div>
      </div>
    </div>`;
  }
  main.innerHTML = html;
}

async function moveCity(city){
  if (!confirm(`Ana şehrini ${city}'e taşımak ister misin? (Ücretsiz)`)) return;
  await dbUpdate(`users/${GZ.uid}`, { location: city });
  toast(`Ana şehrin: ${city}`, 'success');
  render('sehirler');
}
window.moveCity = moveCity;

/* ============================================================
   MAĞAZA
   ============================================================ */
async function renderMagaza(){
  const main = $('#appMain');
  let html = `<div class="page-title">💎 Mağaza</div>
    <p class="small muted mb-12">Para satın al butonu sadece simülasyondur — gerçek tahsilat için entegrasyon gerekir.</p>
    <div class="section-title">Elmas Paketleri</div>`;
  for (const p of ELMAS_PAKETLERI){
    const total = p.dia + p.bonus;
    html += `<div class="card">
      <div class="card-row">
        <div class="card-thumb">💎</div>
        <div class="card-body">
          <div class="card-title">${total} 💎 ${p.bonus?`<span class="small green">+${p.bonus} bonus</span>`:''}</div>
          <div class="card-sub">${cashFmt(p.tl)}</div>
        </div>
        <button class="btn-mini primary" onclick="buyDiamondPack('${p.id}')">Satın Al</button>
      </div>
    </div>`;
  }
  html += `<div class="section-title">Robotlar (Çevrimdışıyken otomatik yönetir)</div>`;
  for (const r of ROBOT_PAKETLERI){
    html += `<div class="card">
      <div class="card-row">
        <div class="card-thumb">🤖</div>
        <div class="card-body">
          <div class="card-title">${r.name}</div>
          <div class="card-sub">${r.hours} saat aktif</div>
        </div>
        <button class="btn-mini primary" onclick="buyRobot('${r.id}').then(()=>render('magaza'))">💎 ${r.diamonds}</button>
      </div>
    </div>`;
  }
  // Robot durumu
  const robotUntil = GZ.data.robotUntil || 0;
  if (robotUntil > now()){
    const remaining = Math.ceil((robotUntil - now())/3600000);
    html += `<div class="card mt-12" style="border-color:var(--green)">
      <div class="card-title green">🤖 Robot aktif</div>
      <p class="small mt-12">Kalan süre: ~${remaining} saat</p>
    </div>`;
  }
  main.innerHTML = html;
}

async function buyDiamondPack(pid){
  const p = ELMAS_PAKETLERI.find(x=>x.id===pid);
  if (!p) return;
  if (!confirm(`${p.tl} ₺ karşılığında ${p.dia + p.bonus} 💎 satın al?\n\n(Bu demo sürümünde ödeme alınmaz, sadece elmas eklenir.)`)) return;
  await addDiamonds(GZ.uid, p.dia + p.bonus);
  toast(`+${p.dia + p.bonus} 💎`, 'success');
}
window.buyDiamondPack = buyDiamondPack;

/* ============================================================
   HİKAYE
   ============================================================ */
function renderHikaye(){
  const main = $('#appMain');
  main.innerHTML = `
    <div class="page-title">📖 Hikaye</div>
    <div class="card">
      <div class="card-title">GameZone ERP</div>
      <p class="mt-12" style="line-height:1.7">
        GameZone ERP, gerçek zamanlı bir ticaret simülasyon oyunudur. Sıfırdan bir imparatorluk inşa edersin: dükkan açar, bahçe ekersin, çiftlik kurar, fabrika işletir ve madenler keşfedersin. Ürettiklerini ihracat eder, ihalelerde rekabet eder, kripto piyasasında pozisyon alırsın. Markalar kurar, takımlar oluşturur ve liderlik tablosunda en zengin oyuncu olmak için yarışırsın.
      </p>
    </div>
    <div class="card mt-12">
      <div class="card-title">👨‍💻 Geliştiriciler</div>
      <p class="mt-12">Bu oyun <b>Serkan Karakaş</b> ve <b>Resul Karakaş</b> tarafından <b>GameZone ERP</b> markası altında geliştirilmektedir. Düzenli olarak (haftada 1-2 defa) güncellenmektedir.</p>
    </div>
    <div class="card mt-12">
      <div class="card-title">🤝 Birlikte Geliştir</div>
      <p class="mt-12">Fikrin veya önerin varsa, bu oyunu birlikte geliştirmeyi düşünüyoruz. <b>Geri bildirim</b> kısmından düşüncelerini ilet — incelemeden geri çevirmeyiz.</p>
      <button class="btn-primary mt-12" style="width:100%" onclick="askFeedback()">📝 Geri Bildirim Gönder</button>
    </div>
    <div class="card mt-12">
      <div class="card-title">🛡️ Adil Oyun Politikası</div>
      <p class="mt-12">
        • Para hilesi <b>kesinlikle</b> kabul edilmez. Ben dahil hiç kimse bu kuralın üstünde değildir.<br>
        • Küfür, taciz, hakaret tespit edildiğinde <b>kalıcı ban</b> uygulanır.<br>
        • Tüm verileriniz Firebase'de saklanır — telefonunuza bağımlı değildir, başka cihazdan aynı hesapla giriş yapabilirsiniz.<br>
        • Anormal yüksek bakiyeli yeni hesaplar otomatik incelenir.<br>
        • Şifre sıfırlama, e-posta doğrulama gibi güvenlik akışları kuruluyor — şifrenizi kimseyle paylaşmayın.
      </p>
    </div>
    <div class="card mt-12">
      <div class="card-title">🚀 Gelecek Güncellemeler</div>
      <p class="mt-12">• Marka içi üretim tesisleri<br>• Şehirler arası lojistik araçları<br>• Borsa endeksleri<br>• Sezonluk etkinlikler<br>• Klan savaşları</p>
    </div>
  `;
}

function askFeedback(){
  showModal('Geri Bildirim', `
    <div class="input-group">
      <label>Görüşün, hatan veya öneriniz</label>
      <textarea id="fbText" rows="6" style="resize:vertical;width:100%;padding:12px;border:1px solid var(--border);border-radius:10px;font-family:inherit" placeholder="Şu özellik şöyle olsa daha iyi olur, şurda hata var, vs."></textarea>
    </div>
    <button class="btn-primary" onclick="sendFeedback()">Gönder</button>
  `);
}
window.askFeedback = askFeedback;

async function sendFeedback(){
  const txt = $('#fbText').value.trim();
  if (txt.length < 10) return toast('En az 10 karakter','warn');
  await dbPush('feedback', {
    uid: GZ.uid, username: GZ.data.username, text: txt, ts: now(), read: false
  });
  closeModal();
  toast('Teşekkürler, ulaştı 🙏','success');
}
window.sendFeedback = sendFeedback;

/* ============================================================
   SSS
   ============================================================ */
function renderSSS(){
  const main = $('#appMain');
  main.innerHTML = `
    <div class="page-title">❓ Sıkça Sorulanlar</div>
    ${faqCard('Para nasıl kazanırım?',
      `1. <b>Dükkan aç</b> → reyon ekle → stok yükle → mantıklı fiyat belirle → otomatik satışlar başlar (her 90sn)<br>
       2. <b>Bahçe / Çiftlik / Fabrika kur</b> → ekim yap → hasat et → ihracat'tan sat (2-3 katı kâr)<br>
       3. <b>İhalelere katıl</b> → kazandığın ürünleri ihracatta sat<br>
       4. <b>Kripto al-sat</b> → düşükten al, tepede sat<br>
       5. <b>Banka yatırımı</b> → günlük %0,3 faiz`)}
    ${faqCard('Reyon nedir, nasıl açılır?',
      `Dükkanın içine girip "+ Yeni Reyon" butonuna bas. Açmak için 500₺. Sonra ürün stoku yüklemen ve fiyat belirlemen gerekir. <b>Reyona stok yüklemediğin sürece satış olmaz.</b>`)}
    ${faqCard('Üst seviye özellikler nasıl açılır?',
      `Her özellik belirli seviyede açılır:<br>
       • Bahçe: Lv 2<br>
       • Elektronik dükkan: Lv 5<br>
       • Çiftlik: Lv 5<br>
       • Fabrika: Lv 8<br>
       • Marka kurma: Lv 10<br>
       • Madenler: Lv 30<br>
       Erken seviyede para kazanmaya odaklan.`)}
    ${faqCard('Banka nasıl çalışır?',
      `<b>Hesap Bakiyesi:</b> Cebinden çekip yatırırsın, faizsiz korunur.<br>
       <b>Yatırım Hesabı:</b> Günlük %0,3 faiz biriktirir.<br>
       <b>Kredi:</b> Seviye × 5.000 ₺ kadar çekebilirsin.<br>
       <b>İşletme Gideri:</b> Haftalık her dükkan için 200₺.<br>
       <b>Çalışan Maaşları:</b> Haftalık her çalışan için 350₺.<br>
       Para yetmezse otomatik krediye eklenir.`)}
    ${faqCard('Seviye sistemi sınırlı mı?',
      `Hayır — sınırsız. Ama her seviye atlamak öncekinin ~1,6 katı XP gerektirir. XP, satışlardan ve hasattan kazanılır.`)}
    ${faqCard('Hile yaparsam ne olur?',
      `Anormal davranış (tek seferde milyonlarca kazanma, IP-VPN spam, ekran içi para hilesi) tespit edildiğinde <b>kalıcı ban</b>. Ben dahil hiç kimsenin istisnası yok.`)}
    ${faqCard('Şifremi unuttum, ne yapmalıyım?',
      `Giriş ekranındaki "Şifremi Unuttum" linkine bas, e-posta adresini gir. Firebase üzerinden sıfırlama bağlantısı gönderilir.`)}
    ${faqCard('Verilerim nerede saklanıyor?',
      `Tüm verilerin Google Firebase Realtime Database'de saklanır. Telefonunu değiştirsen bile aynı hesapla girince her şey yerinde olur.`)}
    ${faqCard('Robot ne işe yarar?',
      `Çevrimdışıyken otomatik olarak: hasatları toplar, ihracat fırsatlarını değerlendirir, fiyat ayarlar. Saatlik/günlük/haftalık/aylık paketler mağazada.`)}
  `;
}
function faqCard(q, a){
  return `<div class="card"><div class="card-title">${q}</div><p class="mt-12 small" style="line-height:1.7">${a}</p></div>`;
}

/* ============================================================
   TOPBAR MODALLERİ (Chat / Bildirim / Banka / Profil)
   ============================================================ */
function openTopbarModal(name){
  if (name==='chat') openChat();
  else if (name==='notif') openNotifs();
  else if (name==='bank') openBank();
  else if (name==='profile') openMyProfile();
}

/* ----- CHAT ----- */
let chatUnsub = null;
function openChat(){
  $('#chatBadge').hidden = true;
  localStorage.setItem('chatLastSeen', String(now()));

  showModal('💬 Sohbet', `
    <div class="chat-wrap" style="height:60vh">
      <div class="chat-list" id="chatList"></div>
      <div class="chat-input">
        <input type="text" id="chatInput" placeholder="Mesaj yaz..." maxlength="200">
        <button onclick="sendChat()">➤</button>
      </div>
    </div>
  `);

  $('#chatInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') sendChat();
  });

  // Önceki dinleyiciyi kapat
  if (chatUnsub) chatUnsub();
  const ref = db.ref('chat/global').limitToLast(50);
  const cb = ref.on('value', s => {
    const list = s.val() || {};
    const arr = Object.entries(list).sort((a,b)=>a[1].ts-b[1].ts);
    const out = arr.map(([id,m]) => {
      const me = m.uid === GZ.uid;
      return `<div class="chat-msg ${me?'me':''}">
        <div class="chat-meta">${me?'':`<b>${escapeHtml(m.username||'?')}</b> • `}${new Date(m.ts).toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'})}</div>
        <div class="chat-bubble">${escapeHtml(m.message||'')}</div>
      </div>`;
    }).join('');
    const cl = $('#chatList');
    if (cl){
      cl.innerHTML = out || '<p class="muted small tac" style="padding:20px">Sohbet boş, ilk mesajı sen at!</p>';
      cl.scrollTop = cl.scrollHeight;
    }
  });
  chatUnsub = () => ref.off();
}

async function sendChat(){
  const inp = $('#chatInput'); if (!inp) return;
  const msg = inp.value.trim();
  if (!msg) return;
  if (msg.length > 200) return toast('Çok uzun (max 200)','warn');
  // Basit küfür filtresi
  const banned = ['kafa', 'küfür_örnek1', 'küfür_örnek2'];
  // Mesaj içerik denetimi: sadece açık küfür kelimeleri için.
  // Kullanıcılar geri bildirimle ekletebilir.

  await dbPush('chat/global', {
    uid: GZ.uid,
    username: GZ.data.username,
    message: msg,
    ts: now()
  });
  inp.value = '';
}
window.sendChat = sendChat;

/* ----- BİLDİRİMLER ----- */
async function openNotifs(){
  const list = await dbGet(`notifs/${GZ.uid}`) || {};
  const arr = Object.entries(list).sort((a,b)=>b[1].ts-a[1].ts);
  let body = '';
  if (arr.length === 0){
    body = emptyState('🔔','Bildirim yok','İşlemlerin burada görünür');
  } else {
    for (const [id, n] of arr){
      body += `<div class="card ${n.read?'':'style="border-color:var(--primary)"'}">
        <p>${escapeHtml(n.msg)}</p>
        <p class="small muted mt-12">${new Date(n.ts).toLocaleString('tr-TR')}</p>
      </div>`;
    }
    body += `<button class="btn-secondary mt-12" style="width:100%" onclick="clearNotifs()">Tümünü Temizle</button>`;
  }
  showModal('🔔 Bildirimler', body);

  // Hepsini okundu işaretle
  const updates = {};
  for (const [id] of arr) updates[`${id}/read`] = true;
  if (Object.keys(updates).length) db.ref(`notifs/${GZ.uid}`).update(updates);
}

async function clearNotifs(){
  if (!confirm('Tüm bildirimler silinsin mi?')) return;
  await db.ref(`notifs/${GZ.uid}`).remove();
  closeModal();
  toast('Temizlendi');
}
window.clearNotifs = clearNotifs;

/* ----- BANKA ----- */
async function openBank(){
  const bank = await dbGet(`bank/${GZ.uid}`) || { balance:0, investment:0, loan:0 };
  const total = (GZ.data.money||0) + (bank.balance||0) + (bank.investment||0) - (bank.loan||0);
  const lv = GZ.data.level||1;
  const maxLoan = lv * 5000;

  showModal('🏦 Banka', `
    <div class="tac mb-12">
      <div class="small muted">Toplam Bakiye</div>
      <div style="font-size:24px;font-weight:800;color:var(--primary)">${cashFmt(total)}</div>
    </div>

    <div class="bank-acc">
      <div class="lbl">Hesap Bakiyesi</div>
      <div class="bal">${cashFmt(bank.balance||0)}</div>
      <div class="desc">Faizsiz korumalı hesap</div>
      <div class="acts">
        <button class="btn-primary" onclick="askBankOp('deposit')">Yatır</button>
        <button class="btn-secondary" onclick="askBankOp('withdraw')">Çek</button>
      </div>
    </div>

    <div class="bank-acc">
      <div class="lbl">Yatırım Hesabı <span class="small green">(%0,3 / gün)</span></div>
      <div class="bal">${cashFmt(bank.investment||0)}</div>
      <div class="desc">Günlük faiz birikir, istediğinde çek</div>
      <div class="acts">
        <button class="btn-primary" onclick="askBankOp('invest')">Yatır</button>
        <button class="btn-secondary" onclick="askBankOp('investWithdraw')">Çek</button>
      </div>
    </div>

    <div class="bank-acc">
      <div class="lbl">Kredi <span class="small muted">(Limit: ${cashFmt(maxLoan)})</span></div>
      <div class="bal red">${cashFmt(bank.loan||0)}</div>
      <div class="desc">Limit her seviyede artar</div>
      <div class="acts">
        <button class="btn-primary" onclick="askBankOp('borrow')">Çek</button>
        <button class="btn-success" onclick="askBankOp('repay')">Öde</button>
      </div>
    </div>

    <div class="card mt-12">
      <div class="row-between">
        <span>İşletme gideri (haftalık)</span>
        <b>${cashFmt(bank.nextBusinessExpense ? Math.max(0, bank.nextBusinessExpense - now())/(24*3600*1000) : 0)} gün</b>
      </div>
      <div class="row-between mt-12">
        <span>Çalışan maaşı (haftalık)</span>
        <b>${cashFmt(bank.nextSalary ? Math.max(0, bank.nextSalary - now())/(24*3600*1000) : 0)} gün</b>
      </div>
    </div>
  `);
}

function askBankOp(op){
  const titles = {
    deposit:'Hesaba Yatır', withdraw:'Hesaptan Çek',
    invest:'Yatırım Yap', investWithdraw:'Yatırım Çek',
    borrow:'Kredi Çek', repay:'Kredi Öde'
  };
  showModal(titles[op], `
    <div class="input-group">
      <label>Tutar (₺)</label>
      <input type="number" id="bankAmount" step="0.01" min="0.01">
    </div>
    <button class="btn-primary" onclick="confirmBankOp('${op}')">Onayla</button>
  `);
}
window.askBankOp = askBankOp;

async function confirmBankOp(op){
  const amt = parseFloat($('#bankAmount').value);
  if (!amt || amt<=0) return toast('Geçersiz tutar','error');
  closeModal();
  if (op==='deposit') await bankDeposit(amt);
  else if (op==='withdraw') await bankWithdraw(amt);
  else if (op==='invest') await bankInvest(amt);
  else if (op==='investWithdraw') await bankInvestWithdraw(amt);
  else if (op==='borrow') await bankBorrow(amt);
  else if (op==='repay') await bankRepay(amt);
  setTimeout(openBank, 500);
}
window.confirmBankOp = confirmBankOp;

/* ----- PROFİLİM ----- */
async function openMyProfile(){
  const u = GZ.data;
  const bank = await dbGet(`bank/${GZ.uid}`) || {};
  const friends = await dbGet(`friends/${GZ.uid}`) || {};
  const twoFA = u.twoFactorEnabled || false;

  // Güvenlik puanı hesapla
  let secScore = 0;
  if (u.verified) secScore += 25;
  if (twoFA) secScore += 40;
  if (u.email && u.email.includes('@')) secScore += 20;
  if (u.level > 1) secScore += 15;
  const secColor = secScore >= 80 ? '#16a34a' : secScore >= 50 ? '#f59e0b' : '#dc2626';
  const secLabel = secScore >= 80 ? 'Yüksek' : secScore >= 50 ? 'Orta' : 'Düşük';

  showModal('👤 Profilim', `
    <div class="tac mb-12">
      <div style="width:80px;height:80px;font-size:36px;margin:0 auto 8px;background:var(--blue-l);border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;color:var(--primary)">${(u.username||'?')[0].toUpperCase()}</div>
      <h3>${u.username}</h3>
      <p class="small muted">${u.email}</p>
    </div>

    <div class="stats-grid">
      <div class="stat-box"><div class="lbl">Seviye</div><div class="val">${u.level||1}</div></div>
      <div class="stat-box"><div class="lbl">Konum</div><div class="val" style="font-size:13px">${u.location||'-'}</div></div>
      <div class="stat-box"><div class="lbl">Nakit</div><div class="val green" style="font-size:13px">${cashFmt(u.money||0)}</div></div>
      <div class="stat-box"><div class="lbl">Banka</div><div class="val" style="font-size:13px">${cashFmt((bank.balance||0)+(bank.investment||0))}</div></div>
      <div class="stat-box"><div class="lbl">Elmas</div><div class="val">💎 ${u.diamonds||0}</div></div>
      <div class="stat-box"><div class="lbl">Arkadaş</div><div class="val">${Object.keys(friends).length}</div></div>
    </div>

    <!-- HESAP GÜVENLİĞİ BÖLÜMÜ -->
    <div class="section-title">🛡️ Hesap Güvenliği</div>
    <div class="sec-score-wrap">
      <div class="sec-score-bar"><div class="sec-score-fill" style="width:${secScore}%;background:${secColor}"></div></div>
      <div class="sec-score-lbl"><span>Güvenlik Puanı</span><span style="color:${secColor};font-weight:800">${secScore}/100 — ${secLabel}</span></div>
    </div>

    <!-- 2FA Kartı -->
    <div class="twofa-card ${twoFA ? 'active-2fa' : ''}">
      <div class="twofa-row">
        <div class="twofa-icon">📱</div>
        <div class="twofa-body">
          <div class="twofa-title">SMS İki Adımlı Doğrulama</div>
          <div class="twofa-sub">${twoFA ? (u.twoFactorPhone || 'Aktif') : 'Her girişte SMS kodu istenir'}</div>
        </div>
        <span class="twofa-badge ${twoFA ? '' : 'off'}">${twoFA ? '✓ AKTİF' : 'KAPALI'}</span>
      </div>
      <div class="flex gap-8 mt-12">
        ${twoFA
          ? `<button class="btn-danger" style="flex:1" onclick="disable2FA()">Devre Dışı Bırak</button>`
          : `<button class="btn-primary" style="flex:1" onclick="open2FASetup()">🔐 Aktifleştir</button>`
        }
      </div>
    </div>

    <!-- E-posta & Şifre Değiştir -->
    <div class="card">
      <div class="row-between mb-8">
        <span>✉️ E-posta Değiştir</span>
        <button class="btn-mini primary" onclick="changeEmail()">Değiştir</button>
      </div>
      <div class="row-between">
        <span>🔑 Şifre Değiştir</span>
        <button class="btn-mini primary" onclick="changePassword()">Değiştir</button>
      </div>
    </div>

    <div class="section-title">Hakkımda</div>
    <div class="input-group">
      <textarea id="bioText" rows="3" style="width:100%;padding:12px;border:1px solid var(--border);border-radius:10px" placeholder="Kısaca kendinden bahset...">${escapeHtml(u.bio||'')}</textarea>
    </div>
    <button class="btn-primary mb-12" onclick="saveBio()" style="width:100%">Kaydet</button>

    <div class="section-title">Ayarlar</div>
    <div class="card">
      <div class="row-between">
        <span>🌙 Karanlık Mod</span>
        <button class="btn-mini primary" onclick="toggleTheme()">Değiştir</button>
      </div>
      <div class="row-between mt-12">
        <span>🔔 Sesli Bildirim</span>
        <button class="btn-mini" onclick="toggleSound()">${localStorage.getItem('sound')==='off'?'Kapalı':'Açık'}</button>
      </div>
    </div>

    <div class="flex gap-8 mt-12">
      <button class="btn-secondary" style="flex:1" onclick="logout()">Çıkış Yap</button>
      <button class="btn-danger" style="flex:1" onclick="askResetAccount()">Hesap Sıfırla</button>
    </div>
  `);
}

async function saveBio(){
  const txt = $('#bioText').value.trim().slice(0, 500);
  await dbUpdate(`users/${GZ.uid}`, { bio: txt });
  toast('Kaydedildi','success');
}
window.saveBio = saveBio;

function toggleTheme(){
  const cur = document.documentElement.getAttribute('data-theme') || 'light';
  const next = cur === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  toast(next==='dark'?'Karanlık mod':'Aydınlık mod','success');
}
window.toggleTheme = toggleTheme;

function toggleSound(){
  const cur = localStorage.getItem('sound') || 'on';
  localStorage.setItem('sound', cur==='on'?'off':'on');
  toast(cur==='on'?'Ses kapalı':'Ses açık');
  closeModal(); openMyProfile();
}
window.toggleSound = toggleSound;

async function logout(){
  await auth.signOut();
  location.reload();
}
window.logout = logout;

function askResetAccount(){
  if (!confirm('TÜM verilerin silinecek (dükkanlar, para, kripto). Bunu yapmak istediğinden emin misin?')) return;
  if (!confirm('Son uyarı! Geri alınamaz. Devam?')) return;
  resetAccount();
}
window.askResetAccount = askResetAccount;

async function resetAccount(){
  await db.ref(`businesses/${GZ.uid}`).remove();
  await db.ref(`bank/${GZ.uid}`).remove();
  await db.ref(`crypto/holdings/${GZ.uid}`).remove();
  await db.ref(`friends/${GZ.uid}`).remove();
  await dbUpdate(`users/${GZ.uid}`, {
    money: 20000, diamonds: 10, level:1, xp:0, location:'İstanbul', netWorth: 20000
  });
  await dbSet(`bank/${GZ.uid}`, {
    balance:0, investment:0, investmentDate: now(), loan:0,
    nextBusinessExpense: now()+7*24*3600*1000, nextSalary: now()+7*24*3600*1000
  });
  toast('Hesap sıfırlandı','success');
  closeModal();
  setTimeout(()=>location.reload(), 1000);
}

/* ============================================================
   MODAL ALTYAPISI
   ============================================================ */
function showModal(title, bodyHtml, footHtml){
  closeModal();
  const root = $('#modalRoot');
  const bg = document.createElement('div');
  bg.className = 'modal-bg';
  bg.innerHTML = `
    <div class="modal" onclick="event.stopPropagation()">
      <div class="modal-grabber"></div>
      <div class="modal-head">
        <h3>${title}</h3>
        <button class="modal-close" onclick="closeModal()">✕</button>
      </div>
      <div class="modal-body">${bodyHtml}</div>
      ${footHtml ? `<div class="modal-foot">${footHtml}</div>` : ''}
    </div>
  `;
  bg.addEventListener('click', closeModal);
  root.appendChild(bg);
}
window.showModal = showModal;

function closeModal(){
  if (chatUnsub){ chatUnsub(); chatUnsub = null; }
  $('#modalRoot').innerHTML = '';
}
window.closeModal = closeModal;

/* ============================================================
   NET WORTH PERIODIC UPDATE — sıralama doğru olsun diye
   ============================================================ */
setInterval(async () => {
  if (!GZ.uid) return;
  const nw = await calcNetWorth(GZ.uid);
  await dbUpdate(`users/${GZ.uid}`, { netWorth: nw });
}, 30000);
