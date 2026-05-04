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
    case 'oyunpazari': renderOyunPazari(); break;
    case 'gorevler':   renderGorevler();   break;
    case 'basarimlar': renderBasarimlar(); break;
    case 'dukkan':   renderDukkan();   break;
    case 'bahce':    renderProduction('gardens',   'Bahçeler',    '🌱', ['domates','patates','sogan','elma','uzum','kiraz','kayisi','findik','zeytin']); break;
    case 'ciftlik':  renderProduction('farms',     'Çiftlikler',  '🐄', ['inek_sutu','keci_sutu','tavuk_yumurtasi','hindi_yumurtasi','kaz_yumurtasi','tavuk_eti','dana_eti','kuzu_eti','yun']); break;
    case 'fabrika':  renderProduction('factories', 'Fabrikalar',  '🏭', ['ekmek','pasta','dondurma','beyaz_peynir','kasar_peyniri','suzme_bal','petek_bal','polen','kimyasal_cozucu','cimento','keten_kumas','eldiven','siyah_cay','yesil_cay','bugday_unu','misir_unu','seker','ayicicek_yagi','zeytinyagi','findik_yagi']); break;
    case 'maden':    renderProduction('mines',     'Madenler',    '⛏️', ['altin','gumus','bakir','demir','kromit'], 30); break;
    case 'lojistik': renderLojistik(); break;
    case 'ihracat':  renderIhracat();  break;
    case 'ihale':    renderIhale();    break;
    case 'kripto':   renderKripto();   break;
    case 'banka':    renderBankaSekme(); break;
    case 'marka':    renderMarka();    break;
    case 'pazar':    renderPazar();    break;
    case 'liderlik': renderLiderlik(); break;
    case 'haberler': renderHaberler(); break;
    case 'sehirler': renderSehirler(); break;
    case 'magaza':   renderMagaza();   break;
    case 'oyunlar':  if (typeof renderOyunlar === 'function') renderOyunlar(); else $('#appMain').innerHTML = '<div class="empty-state"><h3>Mini Oyunlar yükleniyor...</h3></div>'; break;
    case 'hikaye':   renderHikaye();   break;
    case 'sss':      renderSSS();      break;
    case 'kredi':       if(typeof renderKredi==='function') renderKredi(); break;
    case 'vergi':       if(typeof renderVergiOyuncu==='function') renderVergiOyuncu(); break;
    // ─── Devlet & Kamu ───
    case 'muhtarlik':   if(typeof renderMuhtarlik==='function') renderMuhtarlik(); break;
    case 'belediye':    if(typeof renderBelediye==='function') renderBelediye(); break;
    case 'sgk':         if(typeof renderSGK==='function') renderSGK(); break;
    case 'secim':       if(typeof renderSecim==='function') renderSecim(); else if(typeof window.RS_renderSecimler==='function') window.RS_renderSecimler(); break;
    case 'basbakanlik': if(typeof renderBasbakanlik==='function') renderBasbakanlik(); break;
    case 'cumhurbaskani': if(typeof renderCumhurbaskani==='function') renderCumhurbaskani(); break;
    // ─── Asayiş ───
    case 'polis':       if(typeof renderPolis==='function') renderPolis(); break;
    case 'askeriye':    if(typeof renderAskeriye==='function') renderAskeriye(); else main.innerHTML='<div class="empty-state"><h3>🎖️ Askeriye</h3><p>Yakında...</p></div>'; break;
    case 'itfaiye':     if(typeof renderItfaiye==='function') renderItfaiye(); else main.innerHTML='<div class="empty-state"><h3>🚒 İtfaiye</h3><p>Yakında...</p></div>'; break;
    case 'sahilguz':    if(typeof renderSahilGuz==='function') renderSahilGuz(); else main.innerHTML='<div class="empty-state"><h3>⚓ Sahil Güvenlik</h3><p>Yakında...</p></div>'; break;
    case 'jandarma':    if(typeof renderJandarma==='function') renderJandarma(); else main.innerHTML='<div class="empty-state"><h3>🔫 Jandarma</h3><p>Yakında...</p></div>'; break;
    // ─── Hukuk ───
    case 'mahkeme':     if(typeof renderMahkeme==='function') renderMahkeme(); break;
    case 'noter':       if(typeof renderNoter==='function') renderNoter(); break;
    case 'sozlesme':    if(typeof renderSozlesme==='function') renderSozlesme(); break;
    case 'konkurato':   if(typeof renderKonkurato==='function') renderKonkurato(); break;
    // ─── Finans ───
    case 'borsa':       if(typeof renderBorsa==='function') renderBorsa(); break;
    case 'cuzdan':      if(typeof renderCuzdan==='function') renderCuzdan(); break;
    case 'tahvil':      if(typeof renderTahvil==='function') renderTahvil(); break;
    case 'futures':     if(typeof renderFutures==='function') renderFutures(); break;
    case 'hedgefon':    if(typeof renderHedgeFon==='function') renderHedgeFon(); break;
    case 'sigorta':     if(typeof renderSigorta==='function') renderSigorta(); break;
    case 'emlak':       if(typeof renderEmlak==='function') renderEmlak(); break;
    case 'karaborsa':   if(typeof renderKaraborsa==='function') renderKaraborsa(); break;
    // ─── Profil & Diğer ───
    case 'profil':      if(typeof renderProfil==='function') renderProfil(); break;
    case 'franchise':   if(typeof renderFranchise==='function') renderFranchise(); break;
    case 'calisan':     if(typeof renderCalisan==='function') renderCalisan(); break;
    case 'noter2':      if(typeof renderNoter==='function') renderNoter(); break;
    default:
      // Bilinmeyen sekme — boş göster
      if(tab) console.warn('[render] Bilinmeyen sekme:', tab);
      break;
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
  if (window.SHOP_CATALOG && window.SHOP_CATALOG[t]) return window.SHOP_CATALOG[t].icon;
  return ({market:'🏪',elektronik:'📱',mobilya:'🛋️',kuyumcu:'💍',beyazesya:'🧊',otomotiv:'🚗',benzin:'⛽'})[t] || '🏪';
}
function shopTypeName(t){
  if (window.SHOP_CATALOG && window.SHOP_CATALOG[t]) return window.SHOP_CATALOG[t].name;
  return ({market:'Market',elektronik:'Elektronik',mobilya:'Mobilya',kuyumcu:'Kuyumcu',beyazesya:'Beyaz Eşya',otomotiv:'Otomotiv',benzin:'Benzin İstasyonu'})[t] || t;
}

async function modalNewShop(){
  const lv = GZ.data.level||1;

  // Yeni: SHOP_CATALOG kullan (urun-katalog.js'den)
  if (window.SHOP_CATALOG){
    let html = `<p class="small muted mb-12">Her dükkan türü <b>sadece kendi kategorisindeki ürünleri</b> satabilir. Et market'te değil kasapta!</p>`;
    html += '<div class="shop-builder-grid">';
    Object.entries(window.SHOP_CATALOG).forEach(([type, def]) => {
      const locked = lv < def.lv;
      const cats = def.cats.map(c => (window.URUN_KATEGORI_TUM && window.URUN_KATEGORI_TUM[c]) || c).join(' · ');
      html += `<div class="shop-build-card ${locked ? 'locked' : ''}">
        <div class="sbc-icon">${def.icon}</div>
        <div class="sbc-name">${def.name}</div>
        <div class="sbc-cats">${cats}</div>
        <div class="sbc-meta"><span>Lv ${def.lv}</span><span class="green">${cashFmt(def.cost)}</span></div>
        ${locked
          ? `<button class="btn-secondary" disabled>🔒 Lv ${def.lv}</button>`
          : `<button class="btn-primary" onclick="pickCity('${type}')">Aç</button>`
        }
      </div>`;
    });
    html += '</div>';
    showModal('Yeni Dükkan Aç', html);
    return;
  }

  // Eski fallback (urun-katalog.js yüklenmediyse)
  const types = [
    { id:'market', name:'Market', emoji:'🏪', cost:5000, lv:1 },
    { id:'elektronik', name:'Elektronik', emoji:'📱', cost:12000, lv:5 },
    { id:'beyazesya', name:'Beyaz Eşya', emoji:'🧊', cost:22000, lv:10 },
    { id:'mobilya', name:'Mobilya', emoji:'🛋️', cost:18000, lv:8 },
    { id:'benzin', name:'Benzin İst.', emoji:'⛽', cost:45000, lv:12 },
    { id:'kuyumcu', name:'Kuyumcu', emoji:'💍', cost:35000, lv:15 },
    { id:'otomotiv', name:'Otomotiv', emoji:'🚗', cost:60000, lv:18 },
  ];
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
  // Yeni: dükkan türünü çek, sadece izin verilen kategorileri göster
  const shop = await dbGet(`businesses/${GZ.uid}/shops/${sid}`);
  if (!shop) return toast('Dükkan bulunamadı','error');

  // urun-katalog yüklü ise yeni filtreli picker'ı kullan
  if (window.SHOP_CATALOG && typeof window.renderShelfPicker === 'function') {
    const shelves = Object.keys(shop.shelves || {});
    const html = window.renderShelfPicker(shop.type, shelves);
    // Pickerdaki onclick → addShelfFromPicker — ama sid'i doğru ayarlamak için:
    window._shelfPickerShopId = sid;

    // Eski callback (closeModal+openShop) ile uyumlu olmasi için addShelfFromPicker'ı override et
    const _origAdd = window.addShelfFromPicker;
    window.addShelfFromPicker = async function(itemKey){
      if (!window._shelfPickerShopId) return;
      await window.addShelf(window._shelfPickerShopId, itemKey);
      closeModal();
      openShop(window._shelfPickerShopId);
    };
    showModal('Reyon Ekle', html);
    return;
  }

  // Eski fallback (urun-katalog yüklenmediyse — eski davranış)
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
  const u = URUNLER?.[k];
  if(!u) return toast('Ürün bulunamadı','error');
  const money = GZ.data?.money||0;
  const maxQty = Math.max(1,Math.floor(money/u.base));
  const defQty = Math.min(50,maxQty);
  showModal('📦 Stok Al — '+u.emo+' '+u.name, `
    <div style="background:var(--bg);border-radius:10px;padding:12px;margin-bottom:14px;display:flex;justify-content:space-between">
      <div><div style="font-size:12px;color:var(--text-muted)">Birim Fiyat</div><b>${cashFmt(u.base)}</b></div>
      <div><div style="font-size:12px;color:var(--text-muted)">Bakiyen</div><b style="color:#22c55e">${cashFmt(money)}</b></div>
    </div>
    <input type="number" id="stockQtyInp" min="1" value="${defQty}" oninput="document.getElementById('sqCost').textContent=cashFmt((parseInt(this.value)||0)*${u.base})"
      style="width:100%;box-sizing:border-box;padding:14px;font-size:22px;font-weight:700;text-align:center;border:2px solid var(--primary,#1e5cb8);border-radius:12px;background:var(--bg);color:var(--text);margin-bottom:10px">
    <div style="display:flex;gap:6px;margin-bottom:12px">
      <button style="flex:1;padding:10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);font-size:13px;font-weight:700;cursor:pointer" onclick="document.getElementById('stockQtyInp').value=10;document.getElementById('sqCost').textContent=cashFmt(10*${u.base})">10</button>
      <button style="flex:1;padding:10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);font-size:13px;font-weight:700;cursor:pointer" onclick="document.getElementById('stockQtyInp').value=25;document.getElementById('sqCost').textContent=cashFmt(25*${u.base})">25</button>
      <button style="flex:1;padding:10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);font-size:13px;font-weight:700;cursor:pointer" onclick="document.getElementById('stockQtyInp').value=50;document.getElementById('sqCost').textContent=cashFmt(50*${u.base})">50</button>
      <button style="flex:1;padding:10px;border:1px solid var(--primary,#1e5cb8);border-radius:8px;background:var(--primary,#1e5cb8);color:#fff;font-size:13px;font-weight:700;cursor:pointer" onclick="document.getElementById('stockQtyInp').value=${maxQty};document.getElementById('sqCost').textContent=cashFmt(${maxQty}*${u.base})">MAX</button>
    </div>
    <button class="btn-primary" style="width:100%;padding:16px;font-size:16px;font-weight:700" onclick="confirmBuyStock('${sid}','${k}')">
      🛒 Satın Al — <span id="sqCost">${cashFmt(defQty*u.base)}</span>
    </button>
  `);
}
window.askBuyStock = askBuyStock;
async function confirmBuyStock(sid,k){
  const q=parseInt(document.getElementById('stockQtyInp')?.value);
  if(!q||q<=0) return toast('Geçersiz miktar','error');
  closeModal();
  if(typeof window.buyShelfStock==='function') await window.buyShelfStock(sid,k,q);
  if(typeof openShop==='function') openShop(sid);
}
window.confirmBuyStock = confirmBuyStock;

function askSetPrice(sid, k, cur){
  const u = URUNLER[k];
  const maxP = +(u.base * 3).toFixed(2);
  showModal('Satış Fiyatı', `
    <div class="input-group">
      <label>${u.emo} ${u.name}</label>
      <p class="small muted mb-8">Taban: ${cashFmt(u.base)} • Önerilen: ${cashFmt(u.base*1.5)} • <span class="red">Maks: ${cashFmt(maxP)}</span></p>
      <p class="small muted mb-8">⚠️ Tabanın 3 katından fazlası girilirse kaydetmez!</p>
      <input type="number" id="newPrice" step="0.01" value="${cur}" max="${maxP}">
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
   ÜRETİM SAYFALARI — Detaylı Bahçe/Çiftlik/Fabrika/Maden
   ============================================================ */

// Bahçe türleri: her bahçenin kendine özel ismi, görseli ve ürünü
const BAHCE_TURLERI = {
  domates:   { ad:'Domates Bahçesi',  emo:'🍅', bg:'#dc2626', key:'domates',  sure:5  },
  patates:   { ad:'Patates Tarlası',  emo:'🥔', bg:'#92400e', key:'patates',  sure:6  },
  sogan:     { ad:'Soğan Tarlası',    emo:'🧅', bg:'#d97706', key:'sogan',    sure:5  },
  elma:      { ad:'Elma Bahçesi',     emo:'🍎', bg:'#16a34a', key:'elma',     sure:8  },
  uzum:      { ad:'Üzüm Bağı',        emo:'🍇', bg:'#7c3aed', key:'uzum',     sure:10 },
  kiraz:     { ad:'Kiraz Bahçesi',    emo:'🍒', bg:'#be123c', key:'kiraz',    sure:12 },
  kayisi:    { ad:'Kayısı Bahçesi',   emo:'🍑', bg:'#f59e0b', key:'kayisi',   sure:8  },
  findik:    { ad:'Fındık Bahçesi',   emo:'🥜', bg:'#78350f', key:'findik',   sure:15 },
  zeytin:    { ad:'Zeytin Bahçesi',   emo:'🫒', bg:'#166534', key:'zeytin',   sure:10 },
};

const URETIM_BILGI = {
  gardens:   { maliyet:3000, lv:2,  sure:5,  verim:100, birim:'Kilo', renk:'#16a34a', tanim:'Meyve ve sebze yetiştirirsin. Her hasat 100×Lv ürün verir.' },
  farms:     { maliyet:8000, lv:5,  sure:8,  verim:100, birim:'Adet', renk:'#f59e0b', tanim:'Hayvan çiftliği. Süt, yumurta, et üretimi.' },
  factories: { maliyet:25000,lv:8,  sure:4,  verim:100, birim:'Adet', renk:'#3b82f6', tanim:'İşlenmiş ürünler üret. Ekmek, pasta, kumaş...' },
  mines:     { maliyet:80000,lv:30, sure:12, verim:100, birim:'Gram', renk:'#6366f1', tanim:'Değerli madenler çıkar. Altın, gümüş, demir...' },
};

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
  const bilgi = URETIM_BILGI[kind] || {};
  const units = Object.values(list);
  const hasReady = units.some(u=>u.ready);
  const totalUnits = units.length;
  const growing = units.filter(u=>u.crop && u.harvestAt && now()<u.harvestAt).length;
  const ready = units.filter(u=>u.ready || (u.crop && u.harvestAt && now()>=u.harvestAt)).length;
  const empty = units.filter(u=>!u.crop).length;

  let html = `
    <div class="prod-header" style="background:linear-gradient(135deg,${bilgi.renk}22,${bilgi.renk}08);border-bottom:2px solid ${bilgi.renk}33;padding:16px;margin-bottom:12px;border-radius:16px">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px">
        <div style="font-size:36px">${emoji}</div>
        <div>
          <div style="font-size:18px;font-weight:800;color:var(--text)">${title}</div>
          <div style="font-size:12px;color:var(--text-muted)">${bilgi.tanim||''}</div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:10px">
        <div style="background:var(--card);border-radius:10px;padding:8px;text-align:center">
          <div style="font-size:20px;font-weight:800;color:${bilgi.renk}">${totalUnits}</div>
          <div style="font-size:10px;color:var(--text-muted)">Toplam</div>
        </div>
        <div style="background:var(--card);border-radius:10px;padding:8px;text-align:center">
          <div style="font-size:20px;font-weight:800;color:#22c55e">${ready}</div>
          <div style="font-size:10px;color:var(--text-muted)">Hazır 🌾</div>
        </div>
        <div style="background:var(--card);border-radius:10px;padding:8px;text-align:center">
          <div style="font-size:20px;font-weight:800;color:#f59e0b">${growing}</div>
          <div style="font-size:10px;color:var(--text-muted)">Büyüyor 🌱</div>
        </div>
        <div style="background:var(--card);border-radius:10px;padding:8px;text-align:center">
          <div style="font-size:20px;font-weight:800;color:#94a3b8">${empty}</div>
          <div style="font-size:10px;color:var(--text-muted)">Boş</div>
        </div>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn-primary" onclick="buyProductionUnit('${kind}').then(()=>render('${GZ.currentTab}'))" style="flex:1;font-size:13px">+ Yeni ${title.slice(0,-1)} (${cashFmt(bilgi.maliyet)})</button>
        ${ready>0?`<button class="btn-success" onclick="harvestAll('${kind}')" style="font-size:13px;padding:0 14px">🌾 Tümünü Hasat Et</button>`:''}
      </div>
    </div>`;

  if (totalUnits === 0){
    html += `<div class="empty-state">
      <div class="emoji">${emoji}</div>
      <h3>Henüz ${title.toLowerCase()} yok</h3>
      <p>${bilgi.maliyet ? cashFmt(bilgi.maliyet)+' ile aç, üretmeye başla' : 'Satın al ve üret'}</p>
      <button class="btn-primary mt-12" onclick="buyProductionUnit('${kind}').then(()=>render('${GZ.currentTab}'))">+ İlk ${title.slice(0,-1)}i Aç</button>
    </div>`;
  } else {
    // Bahçe kartları — grid görünümü
    html += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">`;
    for (const id of Object.keys(list)){
      const it = list[id];
      const lv = it.level||1;
      const crop = it.crop ? URUNLER[it.crop] : null;
      const isReady = it.crop && it.harvestAt && now() >= it.harvestAt;
      const isGrowing = it.crop && it.harvestAt && now() < it.harvestAt;
      const isEmpty = !it.crop;

      // Büyüme ilerleme barı
      let progressBar = '';
      let timeLabel = '';
      let statusColor = '#94a3b8';
      let statusEmoji = '⬜';
      let cardBg = 'var(--card)';
      let actionBtn = '';

      if (isReady){
        const pct = 100;
        statusColor = '#22c55e';
        statusEmoji = '✅';
        cardBg = 'rgba(34,197,94,0.06)';
        timeLabel = '<span style="color:#22c55e;font-weight:700;font-size:11px">HASAT HAZIR!</span>';
        progressBar = `<div style="height:6px;background:#22c55e33;border-radius:3px;margin:6px 0"><div style="width:100%;height:100%;background:#22c55e;border-radius:3px"></div></div>`;
        actionBtn = `<button class="btn-success" style="width:100%;font-size:12px;padding:8px" onclick="harvest('${kind}','${id}').then(()=>render('${GZ.currentTab}'))">🌾 Hasat Et (+${lv*100} ${crop?.unit||''})</button>`;
      } else if (isGrowing){
        const elapsed = now() - (it.harvestAt - ((kind==='gardens'?5:kind==='farms'?8:kind==='factories'?4:12)*60*1000));
        const total = it.harvestAt - (it.harvestAt - ((kind==='gardens'?5:kind==='farms'?8:kind==='factories'?4:12)*60*1000));
        const pct = Math.min(100, Math.max(0, ((now()-(it.harvestAt-((kind==='gardens'?5:kind==='farms'?8:kind==='factories'?4:12)*60*1000)))/((kind==='gardens'?5:kind==='farms'?8:kind==='factories'?4:12)*60*1000))*100));
        const rem = Math.ceil((it.harvestAt-now())/1000);
        const m=Math.floor(rem/60), s=rem%60;
        statusColor = '#f59e0b';
        statusEmoji = '🌱';
        timeLabel = `<span style="color:#f59e0b;font-size:11px;font-weight:600">⏱ ${m}dk ${s}s kaldı</span>`;
        progressBar = `<div style="height:6px;background:#f59e0b22;border-radius:3px;margin:6px 0"><div style="width:${pct}%;height:100%;background:linear-gradient(90deg,#f59e0b,#22c55e);border-radius:3px;transition:width 1s"></div></div>`;
        actionBtn = `<button class="btn-mini danger" style="width:100%;font-size:11px" onclick="cancelCrop('${kind}','${id}')">🗑️ İptal Et</button>`;
      } else {
        // Boş — ne ekelim seçici
        statusEmoji = '🟤';
        timeLabel = `<span style="color:var(--text-muted);font-size:11px">Boş — ekim bekleniyor</span>`;
        if (kind === 'gardens'){
          // Bahçe türü seçici — hızlı butonlar
          actionBtn = `<div style="display:flex;flex-wrap:wrap;gap:4px">
            ${allowedItems.slice(0,4).map(k=>{
              const u=URUNLER[k]; if(!u) return '';
              const locked=(GZ.data.level||1)<u.lv;
              return `<button style="flex:1;min-width:40%;padding:5px;border-radius:8px;border:1px solid ${locked?'var(--border)':'var(--primary)'};background:${locked?'transparent':'rgba(30,92,184,0.08)'};color:${locked?'var(--text-muted)':'var(--primary)'};font-size:11px;cursor:${locked?'not-allowed':'pointer'};font-weight:600" ${locked?'disabled':
                `onclick="plantCrop('${kind}','${id}','${k}').then(()=>render('${GZ.currentTab}'))"`}>
                ${u.emo} ${u.name}${locked?` 🔒${u.lv}`:''}</button>`;
            }).join('')}
            ${allowedItems.length>4?`<button style="flex:1;padding:5px;border-radius:8px;border:1px solid var(--border);background:transparent;color:var(--text-muted);font-size:11px;cursor:pointer" onclick='openPlantPicker("${kind}","${id}",${JSON.stringify(allowedItems)})'>••• Tümü</button>`:''}
          </div>`;
        } else {
          actionBtn = `<button class="btn-primary" style="width:100%;font-size:12px;padding:8px" onclick='openPlantPicker("${kind}","${id}",${JSON.stringify(allowedItems)})'>🌱 Ekim Yap</button>`;
        }
      }

      // Bahçe adı — bahçe türüne göre özel (gardens ise ekin adına göre)
      let unitName = `${emoji} ${kind==='gardens'?'Bahçe':kind==='farms'?'Çiftlik':kind==='factories'?'Fabrika':'Maden'} #${id.slice(-3)}`;
      if (kind==='gardens' && crop){
        const bt = Object.values(BAHCE_TURLERI).find(b=>b.key===it.crop);
        if (bt) unitName = `${bt.emo} ${bt.ad}`;
      }

      html += `
        <div style="background:${cardBg};border:1.5px solid ${isReady?'#22c55e33':isGrowing?'#f59e0b22':'var(--border)'};border-radius:14px;padding:12px;transition:.3s">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
            <div style="font-size:12px;font-weight:700;color:var(--text)">${unitName}</div>
            <div style="font-size:18px">${statusEmoji}</div>
          </div>
          ${crop?`<div style="font-size:13px;color:var(--text-muted);margin-bottom:2px">${crop.emo} ${crop.name}</div>`:''}
          ${progressBar}
          <div style="margin-bottom:8px">${timeLabel}</div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <span style="font-size:10px;background:${bilgi.renk}22;color:${bilgi.renk};padding:2px 8px;border-radius:999px;font-weight:700">Lv ${lv}</span>
            <button style="font-size:10px;color:var(--text-muted);background:transparent;border:1px solid var(--border);border-radius:6px;padding:2px 7px;cursor:pointer" onclick="upgradeProductionUnit('${kind}','${id}').then(()=>render('${GZ.currentTab}'))">⬆️ ${cashFmt(lv*2500)}</button>
          </div>
          ${actionBtn}
        </div>`;
    }
    html += `</div>`;
  }

  main.innerHTML = html;

  // Canlı geri sayım
  const tabMap = {gardens:'bahce',farms:'ciftlik',factories:'fabrika',mines:'maden'};
  if (Object.values(list).some(i=>i.crop && i.harvestAt && now() < i.harvestAt)){
    setTimeout(()=>{ if (GZ.currentTab === tabMap[kind]) renderProduction(kind, title, emoji, allowedItems, lvLock); }, 1000);
  }
}

// Tüm hasatları tek seferde topla
async function harvestAll(kind){
  const list = await dbGet(`businesses/${GZ.uid}/${kind}`) || {};
  let count = 0;
  for (const id of Object.keys(list)){
    const it = list[id];
    if (it.crop && it.harvestAt && now() >= it.harvestAt){
      await harvest(kind, id).catch(()=>{});
      count++;
    }
  }
  if (count === 0) toast('Hasat edilecek bir şey yok', 'warn');
  else { toast(`✅ ${count} hasatlandı`, 'success'); render(GZ.currentTab); }
}
window.harvestAll = harvestAll;

// Ekim iptal et
async function cancelCrop(kind, unitId){
  if (!confirm('Ekim iptal edilsin mi? Maliyet iade edilmez.')) return;
  await dbUpdate(`businesses/${GZ.uid}/${kind}/${unitId}`, { crop:null, harvestAt:null, ready:false });
  toast('Ekim iptal edildi', 'warn');
  render(GZ.currentTab);
}
window.cancelCrop = cancelCrop;

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
  GZ._curCryptoOwned = own;  // Sat butonları için cache
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
    const myMoney = GZ.data?.money || 0;
    div.innerHTML = `
      <div class="input-group mt-12">
        <label>Tutar (₺) — Bakiye: <b style="color:#16a34a">${cashFmt(myMoney)}</b></label>
        <input type="number" id="cryptoTl" step="0.01" placeholder="Ne kadarlık alacaksın?">
      </div>
      <div class="quick-amount-row">
        <button class="btn-quick" onclick="cryptoQuickBuy(0.25)">%25</button>
        <button class="btn-quick" onclick="cryptoQuickBuy(0.50)">%50</button>
        <button class="btn-quick" onclick="cryptoQuickBuy(0.75)">%75</button>
        <button class="btn-quick btn-quick-max" onclick="cryptoQuickBuy(1.0)">💰 TÜMÜ</button>
      </div>
      <button class="btn-success" onclick="cryptoExecBuy('${sym}')" style="width:100%;margin-top:10px">SATIN AL</button>
      <div class="muted small tac" style="margin-top:6px">Komisyon: %0.5</div>
    `;
  } else {
    const own = GZ._curCryptoOwned || 0;
    const sym2 = sym;
    div.innerHTML = `
      <div class="input-group mt-12">
        <label>Miktar (${sym}) — Sahip: <b style="color:#3b82f6">${own.toFixed(6)}</b></label>
        <input type="number" id="cryptoQty" step="0.0001" placeholder="Satılacak miktar">
      </div>
      <div class="quick-amount-row">
        <button class="btn-quick" onclick="cryptoQuickSell('${sym2}',0.25)">%25</button>
        <button class="btn-quick" onclick="cryptoQuickSell('${sym2}',0.50)">%50</button>
        <button class="btn-quick" onclick="cryptoQuickSell('${sym2}',0.75)">%75</button>
        <button class="btn-quick btn-quick-max btn-quick-sell" onclick="cryptoQuickSell('${sym2}',1.0)">💸 TÜMÜNÜ SAT</button>
      </div>
      <button class="btn-danger" onclick="cryptoExecSell('${sym2}')" style="width:100%;margin-top:10px">SAT</button>
      <div class="muted small tac" style="margin-top:6px">Komisyon: %0.5</div>
    `;
  }
}
window.cryptoOp = cryptoOp;

// Hızlı al butonları - bakiyenin %X'ini doldur
window.cryptoQuickBuy = function(ratio) {
  const myMoney = GZ.data?.money || 0;
  if (myMoney <= 0) return toast('Bakiyen yok', 'warn');
  const amount = Math.floor(myMoney * ratio * 100) / 100;
  const inp = document.getElementById('cryptoTl');
  if (inp) {
    inp.value = amount.toFixed(2);
    if (ratio === 1.0) toast(`💰 Tüm bakiye: ${cashFmt(amount)}`, 'info', 2000);
  }
};

// Hızlı sat butonları - sahip olunan kriptonun %X'i
window.cryptoQuickSell = async function(sym, ratio) {
  const own = (await dbGet(`crypto/holdings/${GZ.uid}/${sym}`)) || 0;
  if (own <= 0) return toast('Bu kriptodan yok', 'warn');
  const qty = Math.floor(own * ratio * 1000000) / 1000000;
  const inp = document.getElementById('cryptoQty');
  if (inp) {
    inp.value = qty.toFixed(6);
    if (ratio === 1.0) toast(`💸 Tüm ${sym}: ${qty.toFixed(6)}`, 'info', 2000);
  }
};

// Al butonu yürüt
window.cryptoExecBuy = async function(sym) {
  const inp = document.getElementById('cryptoTl');
  if (!inp) return;
  const amount = parseFloat(inp.value);
  if (!amount || amount <= 0) return toast('Geçerli tutar gir', 'error');
  const r = await buyCrypto(sym, amount);
  if (r !== false) {
    closeModal();
    render('kripto');
  }
};

// Sat butonu yürüt
window.cryptoExecSell = async function(sym) {
  const inp = document.getElementById('cryptoQty');
  if (!inp) return;
  const qty = parseFloat(inp.value);
  if (!qty || qty <= 0) return toast('Geçerli miktar gir', 'error');
  const r = await sellCrypto(sym, qty);
  if (r !== false) {
    closeModal();
    render('kripto');
  }
};

/* ============================================================
   BANKALAR SEKMESİ — ekonomi.js BANKALAR ile uyumlu
   (Eski blok kaldırıldı. window.BANKALAR ekonomi.js'ten geliyor.)
   ============================================================ */

async function renderBankaSekme(activeTab) {
  activeTab = activeTab || 'hesaplar';
  const main = $('#appMain');
  if (!main) return;

  const uid     = GZ.uid;
  const lv      = GZ.data?.level || 1;
  const bank    = (await dbGet('bank/' + uid)) || {};
  const loanBankId = bank.loanBankId || null;
  const dbFaizler  = (await dbGet('system/bankFaizler')) || {};
  const BLIST   = window.BANKALAR || [];

  /* ── SEKMELER ── */
  const tabs = [
    { id: 'hesaplar', label: '🏦 Hesaplar'   },
    { id: 'kredi',    label: '💳 Kredi'       },
    { id: 'vadeli',   label: '📈 Vadeli'      },
    { id: 'transfer', label: '💸 Transfer'    },
  ];

  const tabBar = `<div class="tab-bar" style="display:flex;gap:6px;overflow-x:auto;padding:0 0 10px;margin-bottom:12px">
    ${tabs.map(t => `<button onclick="renderBankaSekme('${t.id}')"
      style="padding:8px 16px;border-radius:999px;border:none;cursor:pointer;font-weight:700;font-size:12px;
      background:${activeTab===t.id?'var(--primary)':'var(--bg2)'};
      color:${activeTab===t.id?'#fff':'var(--text-muted)'};white-space:nowrap">
      ${t.label}</button>`).join('')}
  </div>`;

  let content = '';

  /* ══════════════ HESAPLAR SEKMESİ ══════════════ */
  if (activeTab === 'hesaplar') {
    const money     = GZ.data?.money || GZ.data?.bakiye || 0;
    const diamonds  = GZ.data?.diamonds || 0;
    const krediNotu = typeof window.getKrediNotu === 'function' ? (await window.getKrediNotu(uid)) : 50;
    const notRenk   = krediNotu >= 80 ? '#22c55e' : krediNotu >= 60 ? '#f59e0b' : '#ef4444';

    content = `
      <!-- Ana bakiye kartı -->
      <div class="card" style="background:linear-gradient(135deg,#1e3a8a,#1e40af);color:#fff;margin-bottom:12px">
        <div style="font-size:11px;opacity:.7;margin-bottom:4px">TOPLAM BAKİYE</div>
        <div style="font-size:28px;font-weight:900">${cashFmt(money)}</div>
        <div style="display:flex;justify-content:space-between;margin-top:12px;font-size:12px;opacity:.8">
          <span>💎 ${diamonds} Elmas</span>
          <span>Lv ${lv}</span>
          <span>Kredi Notu: <b style="color:${notRenk}">${krediNotu}</b></span>
        </div>
      </div>

      <!-- Banka kartları -->
      <div style="font-size:13px;font-weight:700;color:var(--text-muted);margin-bottom:8px">Bankalar</div>
      ${BLIST.map(b => {
        const faiz   = dbFaizler[b.id] || b.faiz;
        const isMine = loanBankId === b.id;
        return `<div class="card mb-8" style="border-left:4px solid ${b.color}${isMine?'':'66'}">
          <div style="display:flex;align-items:center;gap:12px">
            <div style="width:42px;height:42px;border-radius:12px;background:${b.color}22;
              display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0">${b.logo}</div>
            <div style="flex:1">
              <div style="font-size:13px;font-weight:700;color:var(--text)">
                ${b.name}${isMine ? ` <span style="font-size:9px;background:${b.color};color:#fff;padding:1px 6px;border-radius:999px">AKTİF KREDİ</span>` : ''}
              </div>
              <div style="font-size:10px;color:var(--text-muted)">${b.info || ''}</div>
            </div>
            <div style="text-align:right">
              <div style="font-size:10px;color:var(--text-muted)">FAİZ</div>
              <div style="font-size:14px;font-weight:800;color:${b.color}">%${(faiz * 100).toFixed(1)}</div>
            </div>
          </div>
        </div>`;
      }).join('')}`;
  }

  /* ══════════════ KREDİ SEKMESİ ══════════════ */
  else if (activeTab === 'kredi') {
    if (typeof renderKredi === 'function') {
      renderKredi();
      return; // renderKredi kendi main.innerHTML'ini set ediyor
    }
  }

  /* ══════════════ VADELİ SEKMESİ ══════════════ */
  else if (activeTab === 'vadeli') {
    const vadeli = (await dbGet('vadeli/' + uid)) || {};
    const list   = Object.entries(vadeli);
    content = list.length === 0
      ? `<div class="card" style="text-align:center;padding:32px;color:var(--text-muted)">
           <div style="font-size:36px;margin-bottom:8px">📈</div>
           Aktif vadeli hesabınız yok<br>
           <button class="btn-primary" style="margin-top:16px" onclick="renderBankaSekme('kredi')">Vadeli Aç</button>
         </div>`
      : list.map(([k, v]) => `
          <div class="card mb-8">
            <div style="font-weight:700">${v.bankName || v.bankId} — Vadeli Hesap</div>
            <div style="font-size:12px;color:var(--text-muted)">
              Miktar: <b>${cashFmt(v.amount)}</b> · Faiz: <b>%${(v.rate * 100).toFixed(1)}</b>
            </div>
            <div style="font-size:11px;color:var(--text-muted)">
              Bitiş: ${new Date(v.maturesAt).toLocaleDateString('tr-TR')}
            </div>
          </div>`).join('');
  }

  /* ══════════════ TRANSFER SEKMESİ ══════════════ */
  else if (activeTab === 'transfer') {
    content = `
      <div class="card">
        <div style="font-size:14px;font-weight:700;margin-bottom:12px">💸 Oyuncu Transferi</div>
        <input id="tfUser" placeholder="Kullanıcı adı" style="width:100%;padding:10px;border-radius:8px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-size:13px;box-sizing:border-box;margin-bottom:8px">
        <input id="tfAmount" type="number" placeholder="Miktar (₺)" style="width:100%;padding:10px;border-radius:8px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-size:13px;box-sizing:border-box;margin-bottom:12px">
        <button onclick="(async()=>{
          const uname=document.getElementById('tfUser')?.value?.trim();
          const amt=parseInt(document.getElementById('tfAmount')?.value)||0;
          if(!uname||!amt) return toast('Kullanıcı adı ve miktar girin','warn');
          const users=await dbGet('users')||{};
          const found=Object.entries(users).find(([,u])=>u.username===uname);
          if(!found) return toast('Kullanıcı bulunamadı','error');
          await window.GZX_B09_transfer?.(GZ.uid,found[0],amt);
          renderBankaSekme('transfer');
        })()" class="btn-primary" style="width:100%">Transfer Gönder</button>
      </div>`;
  }

  main.innerHTML = `
    <div class="page-title">🏦 Bankacılık</div>
    ${tabBar}
    <div id="bankaContent">${content}</div>`;
}
window.renderBankaSekme = renderBankaSekme;




function getNextSaturday(){
  const d = new Date();
  const day = d.getDay();
  const diff = (6 - day + 7) % 7 || 7;
  d.setDate(d.getDate() + diff);
  return d.toLocaleDateString('tr-TR', {weekday:'long', day:'numeric', month:'long'});
}

async function askKrediCek(bankId, maxLimit){
  const b = BANKALAR_MAP[bankId];
  if (!b) return;
  if (maxLimit <= 0) return toast(`Kredi limitiniz dolu. Önce borcunuzu ödeyin.`, 'warn');
  showModal(`💳 ${b.name || (b.name || b.ad)} — Kredi Çek`, `
    <div style="background:${b.color || b.color || b.color || b.renk}11;border-radius:12px;padding:12px;margin-bottom:14px">
      <div style="display:flex;justify-content:space-between;margin-bottom:6px">
        <span style="font-size:12px;color:var(--text-muted)">Faiz Oranı (yıllık)</span>
        <b style="color:${b.color || b.color || b.color || b.renk}">%${(b.faiz*100).toFixed(1)}</b>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:6px">
        <span style="font-size:12px;color:var(--text-muted)">Haftalık faiz (1000₺ için)</span>
        <b>${cashFmt(+(1000*b.faiz/52).toFixed(2))}</b>
      </div>
      <div style="display:flex;justify-content:space-between">
        <span style="font-size:12px;color:var(--text-muted)">Kullanılabilir Limit</span>
        <b class="green">${cashFmt(maxLimit)}</b>
      </div>
    </div>
    <div class="input-group">
      <label>Kredi Miktarı (₺)</label>
      <input type="number" id="krediMiktar" min="100" max="${maxLimit}" placeholder="Min: 100₺" step="100">
    </div>
    <div class="quick-amount-row">
      <button class="btn-quick" onclick="bankQuickFill(${maxLimit},0.25)">%25</button>
      <button class="btn-quick" onclick="bankQuickFill(${maxLimit},0.50)">%50</button>
      <button class="btn-quick" onclick="bankQuickFill(${maxLimit},0.75)">%75</button>
      <button class="btn-quick btn-quick-max" onclick="bankQuickFill(${maxLimit},1.0)">💰 MAX</button>
    </div>
    <p style="font-size:11px;color:var(--text-muted);margin-bottom:12px">⚠️ Kredi, her Cumartesi faiz işler. Ödenmezse haciz başlatılır.</p>
    <button class="btn-primary" style="width:100%" onclick="confirmKrediCek('${bankId}')">💳 Krediyi Onayla</button>
  `);
  // bankQuickFill krediMiktar input'unu doldursun
  window._tempBankQuickTarget = 'krediMiktar';
}
window.askKrediCek = askKrediCek;

async function confirmKrediCek(bankId){
  const amt = parseFloat(document.getElementById('krediMiktar')?.value);
  if (!amt || amt < 100) return toast('En az 100₺ giriniz','error');
  closeModal();
  // bankBorrow'u bankId ile çağır
  await bankBorrowFromBank(bankId, Math.floor(amt));
  render('banka');
}
window.confirmKrediCek = confirmKrediCek;

async function bankBorrowFromBank(bankId, amount){
  if (!amount || amount <= 0) return toast('Geçersiz tutar','error');
  const b = BANKALAR_MAP[bankId];
  if (!b) return;
  const lv = (GZ.data.level||1);
  const max = lv * Math.floor((b.maxKat || 2) * (window.getKrediLimit ? window.getKrediLimit(GZ.data?.krediNotu||50) : 5000));
  const cur = (await dbGet(`bank/${GZ.uid}/loan`))||0;
  const curBankId = (await dbGet(`bank/${GZ.uid}/loanBankId`));
  // Farklı bankadan borç alıyorsa önce eski borç ödenmeli
  if (curBankId && curBankId !== bankId && cur > 0){
    return toast(`Önce ${BANKALAR_MAP[curBankId]?.name || BANKALAR_MAP[curBankId]?.ad||curBankId} borcunuzu ödeyin!`, 'warn');
  }
  if (cur + amount > max) return toast(`Kredi limitiniz: ${cashFmt(max)} (Mevcut borç: ${cashFmt(cur)})`, 'warn');
  await db.ref(`bank/${GZ.uid}/loan`).transaction(c => (c||0)+amount);
  await db.ref(`bank/${GZ.uid}/loanBankId`).set(bankId);
  await addCash(GZ.uid, amount, 'borrow');
  await pushNotif(GZ.uid, `💳 ${b.name || b.name || b.ad}'dan ${cashFmt(amount)} kredi çekildi. Haftalık faiz: ${cashFmt(+(amount*b.faiz/52).toFixed(2))}`);
  toast(`+${cashFmt(amount)} kredi çekildi — ${b.name || b.ad}`, 'success');
}
window.bankBorrowFromBank = bankBorrowFromBank;

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
  main.innerHTML = '<div class="page-title">📰 Haberler</div><div style="text-align:center;padding:30px;color:var(--text-muted)">Yükleniyor...</div>';

  // 1. Aktif etkinlik
  const aktifEtkinlik = await dbGet('system/aktifEtkinlik');
  // 2. Son 30 etkinlik/haber logu
  const haberSnap = await db.ref('haberler').orderByChild('ts').limitToLast(30).once('value');
  const haberler = [];
  haberSnap.forEach(s => haberler.unshift({ key: s.key, ...s.val() }));
  // 3. Kripto fiyat hareketleri
  let topGain = null, topLoss = null;
  for (const k of (window.KRIPTO||[])){
    const p = GZ.prices?.[k.sym]; if (!p || !p.prev) continue;
    const ch = ((p.current - p.prev)/(p.prev||1))*100;
    if (!topGain || ch > topGain.change) topGain = { ...k, change:ch, price:p.current };
    if (!topLoss || ch < topLoss.change) topLoss = { ...k, change:ch, price:p.current };
  }
  // 4. İhracat talepleri
  const exps = await dbGet('exports/list') || {};
  const topEx = Object.values(exps).sort((a,b)=>b.pricePerUnit-a.pricePerUnit)[0];
  // 5. İhaleler
  const auctions = await dbGet('auctions/list') || {};
  const liveAu = Object.values(auctions).filter(a=>!a.finalized);
  // 6. Liderlik
  const usersRaw = await dbGet('users') || {};
  const topUser = Object.values(usersRaw).filter(u=>!u.banned).sort((a,b)=>(b.netWorth||b.money||0)-(a.netWorth||a.money||0))[0];

  let html = '';

  // ── AKTİF ETKİNLİK BANNER (sayfa içinde, ekran dışında değil) ──
  if (aktifEtkinlik && !aktifEtkinlik.bitti && aktifEtkinlik.bitecegiZaman > Date.now()){
    const e = aktifEtkinlik;
    const kalanDk = Math.max(0, Math.ceil((e.bitecegiZaman - Date.now()) / 60000));
    const renk = e.tip === 'kriz' ? '#dc2626' : '#16a34a';
    const bg   = e.tip === 'kriz' ? 'rgba(220,38,38,.08)' : 'rgba(22,163,74,.08)';
    html += `
      <div style="background:${bg};border:2px solid ${renk}44;border-radius:14px;padding:14px;margin-bottom:14px">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
          <span style="font-size:28px">${e.ikon||'⚡'}</span>
          <div style="flex:1">
            <div style="font-size:14px;font-weight:800;color:${renk}">${e.baslik}</div>
            <div style="display:inline-block;font-size:9px;padding:1px 7px;border-radius:999px;background:${renk};color:#fff;font-weight:700;margin-top:2px">
              ${e.tip === 'kriz' ? '⚠️ KRİZ' : '🚀 FIRSAT'} — ${kalanDk} DK KALDI
            </div>
          </div>
        </div>
        <p style="font-size:12px;color:var(--text);line-height:1.6;margin:0">${e.mesaj}</p>
        ${e.efektler ? `<div style="margin-top:8px;font-size:10px;color:var(--text-muted)">
          Etki: ${JSON.stringify(e.efektler).replace(/[{}"]/g,'').slice(0,80)}...
        </div>` : ''}
      </div>`;
    // nav badge temizle
    document.querySelectorAll('.ev-dot').forEach(d=>d.remove());
  }

  html += `<div class="page-title">📰 Haberler & Duyurular</div>`;

  // ── ETKİNLİK LOGU ──
  if (haberler.length > 0){
    html += `<div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:8px">⚡ Etkinlik Logu</div>`;
    for (const h of haberler){
      const ts = h.ts ? new Date(h.ts).toLocaleString('tr-TR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}) : '';
      const renk = h.tip === 'kriz' ? '#dc2626' : h.bitti ? '#64748b' : '#16a34a';
      html += `
        <div class="card mb-6" style="border-left:3px solid ${renk}">
          <div style="display:flex;align-items:center;gap:8px">
            <span style="font-size:20px">${h.ikon||'📢'}</span>
            <div style="flex:1">
              <div style="font-size:13px;font-weight:700;color:var(--text)">${h.baslik}
                ${h.bitti?'<span style="font-size:9px;color:#64748b;margin-left:4px">• Sona erdi</span>':''}
              </div>
              <div style="font-size:11px;color:var(--text-muted);margin-top:2px">${h.mesaj}</div>
              <div style="font-size:10px;color:var(--text-muted);margin-top:3px">${ts}${h.sure?' • '+h.sure+' dakika':''}</div>
            </div>
          </div>
        </div>`;
    }
  }

  // ── PİYASA HABERLERİ ──
  html += `<div style="font-size:12px;font-weight:700;color:var(--text);margin:12px 0 8px">📊 Piyasa Haberleri</div>`;

  if (topGain && topGain.change > 0){
    html += `<div class="card mb-6">
      <div style="display:flex;align-items:center;gap:8px">
        <span style="font-size:22px">📈</span>
        <div>
          <div style="font-size:13px;font-weight:700;color:#16a34a">${topGain.name} (${topGain.sym}) yükselişte!</div>
          <div style="font-size:11px;color:var(--text-muted)">Birim fiyatı %${Math.abs(topGain.change).toFixed(2)} arttı → ${cashFmt(topGain.price)}</div>
        </div>
      </div>
    </div>`;
  }
  if (topLoss && topLoss.change < 0){
    html += `<div class="card mb-6">
      <div style="display:flex;align-items:center;gap:8px">
        <span style="font-size:22px">📉</span>
        <div>
          <div style="font-size:13px;font-weight:700;color:#ef4444">${topLoss.name} (${topLoss.sym}) düşüşte!</div>
          <div style="font-size:11px;color:var(--text-muted)">%${Math.abs(topLoss.change).toFixed(2)} kayıp → ${cashFmt(topLoss.price)}</div>
        </div>
      </div>
    </div>`;
  }
  if (topEx){
    const u = URUNLER[topEx.item];
    html += `<div class="card mb-6">
      <div style="display:flex;align-items:center;gap:8px">
        <span style="font-size:22px">${topEx.flag||'🌍'}</span>
        <div>
          <div style="font-size:13px;font-weight:700;color:var(--text)">${topEx.country} büyük talep açtı</div>
          <div style="font-size:11px;color:var(--text-muted)">${topEx.sirket} — ${fmtInt(topEx.demand)} ${u?.unit} ${u?.name} @ ${cashFmt(topEx.pricePerUnit)}</div>
        </div>
      </div>
    </div>`;
  }
  if (liveAu.length){
    const a = liveAu[0];
    const u = URUNLER[a.item];
    html += `<div class="card mb-6">
      <div style="display:flex;align-items:center;gap:8px">
        <span style="font-size:22px">⚖️</span>
        <div>
          <div style="font-size:13px;font-weight:700;color:var(--text)">Sıcak İhale: ${a.country}</div>
          <div style="font-size:11px;color:var(--text-muted)">${u?.emo||''} ${fmtInt(a.qty)} ${u?.unit} ${u?.name} • Teklif: ${cashFmt(a.currentBid)}/${u?.unit}</div>
        </div>
      </div>
    </div>`;
  }
  if (topUser){
    html += `<div class="card mb-6">
      <div style="display:flex;align-items:center;gap:8px">
        <span style="font-size:22px">🏆</span>
        <div>
          <div style="font-size:13px;font-weight:700;color:var(--text)">Servet Zirvesi</div>
          <div style="font-size:11px;color:var(--text-muted)"><b>${topUser.username}</b> — ${cashFmt(topUser.netWorth||topUser.money||0)}</div>
        </div>
      </div>
    </div>`;
  }

  if (!haberler.length && !topGain && !topEx){
    html += `<div style="text-align:center;padding:40px 20px;color:var(--text-muted)">
      <div style="font-size:36px;margin-bottom:8px">📭</div>
      <div style="font-size:14px">Henüz haber yok</div>
      <div style="font-size:12px;margin-top:4px">Etkinlikler ve piyasa hareketleri burada görünecek</div>
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
  const totalDia = p.dia + p.bonus;
  // Elmas fiyatını al
  const fiyat = typeof getElmasFiyati === 'function' ? await getElmasFiyati() : 1500;
  const nakitKarsilik = totalDia * fiyat;
  if (!confirm(`${p.tl} ₺ karşılığında ${totalDia} 💎 satın al?\n\nElmaslar otomatik olarak ${cashFmt(nakitKarsilik)} nakit olarak hesabına eklenecek.\n(1 💎 = ${cashFmt(fiyat)})`)) return;
  await addDiamonds(GZ.uid, totalDia);
  // Elmasları otomatik nakite çevir
  if (typeof elmasiNakiteVer === 'function') {
    await elmasiNakiteVer(totalDia);
  } else {
    toast(`+${totalDia} 💎`, 'success');
  }
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

async function askBankOp(op){
  const titles = {
    deposit:'💰 Hesaba Yatır', withdraw:'💸 Hesaptan Çek',
    invest:'📈 Yatırım Yap', investWithdraw:'📉 Yatırım Çek',
    borrow:'💳 Kredi Çek', repay:'✅ Kredi Öde'
  };
  // Max tutarı operasyona göre belirle
  const bank = await dbGet(`bank/${GZ.uid}`) || { balance:0, investment:0, loan:0 };
  const myMoney = GZ.data?.money || 0;
  const lv = GZ.data?.level || 1;
  const maxLoan = lv * 5000;

  let maxAmount = 0;
  let maxLabel = '';
  switch(op) {
    case 'deposit':         maxAmount = myMoney;                    maxLabel = 'Cüzdan'; break;
    case 'withdraw':        maxAmount = bank.balance || 0;          maxLabel = 'Hesap'; break;
    case 'invest':          maxAmount = myMoney;                    maxLabel = 'Cüzdan'; break;
    case 'investWithdraw':  maxAmount = bank.investment || 0;       maxLabel = 'Yatırım'; break;
    case 'borrow':          maxAmount = maxLoan - (bank.loan||0);   maxLabel = 'Kalan limit'; break;
    case 'repay':           maxAmount = Math.min(myMoney, bank.loan || 0); maxLabel = 'Borç/Bakiye'; break;
    case 'repayFull': {
      const fullAmt = bank.loan||0;
      if (fullAmt <= 0) return toast('Borcunuz yok','info');
      if (myMoney < fullAmt) return toast(`Yeterli para yok. Gerekli: ${cashFmt(fullAmt)}`,'warn');
      if (!confirm(`Tüm borcunuz (${cashFmt(fullAmt)}) ödensin mi?`)) return;
      await bankRepay(fullAmt);
      toast('✅ Tüm borç ödendi!','success');
      render('banka');
      return;
    }
    case 'payTaxNow': {
      // Vergiyi hemen hesapla ve öde
      const mbR = await dbGet('system/merkezBankasi') || {};
      const vOran = Math.min(0.9, (mbR.gelirOrani||40)/100);
      const sps = await dbGet('businesses/'+GZ.uid+'/shops') || {};
      const gds = await dbGet('businesses/'+GZ.uid+'/gardens') || {};
      const fms = await dbGet('businesses/'+GZ.uid+'/farms') || {};
      const fcs = await dbGet('businesses/'+GZ.uid+'/factories') || {};
      const mns = await dbGet('businesses/'+GZ.uid+'/mines') || {};
      const sabit = Object.keys(sps).length*(mbR.rates_shopTax||500)+
                    Object.keys(gds).length*(mbR.rates_gardenTax||300)+
                    Object.keys(fms).length*(mbR.rates_farmTax||300)+
                    Object.keys(fcs).length*(mbR.rates_factoryTax||800)+
                    Object.keys(mns).length*(mbR.rates_mineTax||600);
      const gelirV = +((GZ.data?.weeklyRevenue||0)*vOran).toFixed(2);
      const toplam = sabit + gelirV;
      if (toplam <= 0) return toast('Ödenecek vergi yok','info');
      if (!confirm(`Toplam ${cashFmt(toplam)} vergi ödensin mi?`)) return;
      const ok = await spendCash(GZ.uid, toplam, 'tax-manual');
      if (ok) {
        const merkez = await dbGet('system/authorityUid');
        if (merkez) await db.ref('users/'+merkez+'/money').transaction(c=>(c||0)+toplam);
        await db.ref('system/merkezBankasi/totalVergi').transaction(c=>(c||0)+toplam);
        await dbUpdate('users/'+GZ.uid, { weeklyRevenue: 0 });
        toast('✅ Vergi ödendi: '+cashFmt(toplam),'success');
        render('banka');
      } else {
        toast('Yeterli para yok','error');
      }
      return;
    }
  }
  maxAmount = Math.max(0, Math.floor(maxAmount * 100) / 100);

  showModal(titles[op], `
    <div class="input-group">
      <label>Tutar (₺) — <b style="color:var(--primary)">${maxLabel}: ${cashFmt(maxAmount)}</b></label>
      <input type="number" id="bankAmount" step="0.01" min="0.01" placeholder="Tutar gir">
    </div>
    <div class="quick-amount-row">
      <button class="btn-quick" onclick="bankQuickFill(${maxAmount},0.25)">%25</button>
      <button class="btn-quick" onclick="bankQuickFill(${maxAmount},0.50)">%50</button>
      <button class="btn-quick" onclick="bankQuickFill(${maxAmount},0.75)">%75</button>
      <button class="btn-quick btn-quick-max" onclick="bankQuickFill(${maxAmount},1.0)">💰 TÜMÜ</button>
    </div>
    <button class="btn-primary" onclick="confirmBankOp('${op}')" style="width:100%;margin-top:10px">Onayla</button>
  `);
}
window.askBankOp = askBankOp;

window.bankQuickFill = function(maxAmount, ratio) {
  const inp = document.getElementById('bankAmount');
  if (!inp) return;
  const v = Math.floor(maxAmount * ratio * 100) / 100;
  inp.value = v;
  if (ratio === 1.0) toast(`💰 Maksimum: ${cashFmt(v)}`, 'info', 2000);
};

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
  closeModal();
  setTimeout(()=>render('banka'), 300);
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
  setTimeout(()=>{ GZ.data = {}; switchTab('dukkan'); }, 1000);
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

/* ============================================================
   OYUNCU PAZARI — Render
   ============================================================ */
async function renderOyunPazari(){
  const main = $('#appMain');
  let html = `
    <div class="page-title">🏬 Oyuncu Pazarı</div>
    <div class="subtabs">
      <button class="subtab active" onclick="oyunPazariView('all',event)">Tüm İlanlar</button>
      <button class="subtab" onclick="oyunPazariView('mine',event)">İlanlarım</button>
      <button class="subtab" onclick="oyunPazariView('sell',event)">+ Sat</button>
    </div>
    <div id="oyunPazariList"><div class="spinner" style="margin:20px auto"></div></div>
  `;
  main.innerHTML = html;
  oyunPazariView('all');
}
window.renderOyunPazari = renderOyunPazari;

async function oyunPazariView(view, ev){
  if (ev){ $$('.subtab').forEach(b=>b.classList.remove('active')); ev.target.classList.add('active'); }
  const list = $('#oyunPazariList'); if (!list) return;

  if (view === 'sell'){
    // Stoktan satışa koy
    const mainWH = await dbGet(`businesses/${GZ.uid}/mainWarehouse`) || {};
    const stok = Object.entries(mainWH).filter(([k,v])=>v>0);
    if (stok.length === 0){
      list.innerHTML = emptyState('📦','Ana deponda ürün yok','Önce üretim yap, sonra sat');
      return;
    }
    let html = '<div class="section-title">Depodaki Ürünler</div>';
    for (const [k,v] of stok){
      const u = URUNLER[k]; if (!u) continue;
      html += `
        <div class="card">
          <div class="card-row">
            <div class="card-thumb">${u.emo}</div>
            <div class="card-body">
              <div class="card-title">${u.name}</div>
              <div class="card-sub">Stok: ${fmtInt(v)} ${u.unit} • Taban: ${cashFmt(u.base)}</div>
            </div>
            <button class="btn-mini primary" onclick="askListPlayerItem('${k}',${v})">Sat</button>
          </div>
        </div>
      `;
    }
    list.innerHTML = html;
    return;
  }

  if (view === 'mine'){
    const all = await dbGet('playerMarket') || {};
    const mine = Object.values(all).filter(l=>l.sellerUid===GZ.uid);
    if (mine.length === 0){ list.innerHTML = emptyState('🏬','Aktif ilanın yok','Depodaki ürünleri sat'); return; }
    let html = '';
    for (const l of mine){
      const u = URUNLER[l.item]; if (!u) continue;
      html += `
        <div class="card">
          <div class="card-row">
            <div class="card-thumb">${u.emo}</div>
            <div class="card-body">
              <div class="card-title">${u.name} <span class="small muted">${l.isPublic?'🌐 Açık':'🔒 Gizli'}</span></div>
              <div class="card-sub">${cashFmt(l.price)}/${u.unit} • Kalan: ${fmtInt(l.remaining)}/${fmtInt(l.qty)}</div>
              <div class="card-sub green">Satılan: ${fmtInt(l.sold||0)} • Kazanç: ${cashFmt((l.sold||0)*l.price*0.98)}</div>
            </div>
          </div>
          <button class="btn-mini danger mt-12" onclick="cancelPlayerListing('${l.id}').then(()=>oyunPazariView('mine'))">İptal Et</button>
        </div>
      `;
    }
    list.innerHTML = html;
    return;
  }

  // Tüm ilanlar
  const all = await dbGet('playerMarket') || {};
  const pub = Object.values(all).filter(l=>l.isPublic && l.remaining > 0).sort((a,b)=>a.price-b.price);
  if (pub.length === 0){ list.innerHTML = emptyState('🏬','Şu an ilan yok','İlk satıcı sen ol!'); return; }

  // Kategorilere grupla
  const grouped = {};
  for (const l of pub){
    const cat = URUNLER[l.item]?.cat || 'diger';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(l);
  }
  let html = '';
  for (const [cat, items] of Object.entries(grouped)){
    html += `<div class="section-title">${URUN_KATEGORI[cat]||cat.toUpperCase()}</div>`;
    for (const l of items){
      const u = URUNLER[l.item]; if (!u) continue;
      const cheaper = l.price < u.base * 1.2;
      html += `
        <div class="card">
          <div class="card-row">
            <div class="card-thumb">${u.emo}</div>
            <div class="card-body">
              <div class="card-title">${u.name} ${cheaper?'<span class="small green">🔥 Ucuz</span>':''}</div>
              <div class="card-sub">Satıcı: ${escapeHtml(l.sellerName)} • Kalan: ${fmtInt(l.remaining)} ${u.unit}</div>
              <div class="card-sub"><b class="green">${cashFmt(l.price)}</b> / ${u.unit} <span class="muted">(Taban: ${cashFmt(u.base)})</span></div>
            </div>
          </div>
          <button class="btn-primary mt-12" style="width:100%" onclick="askBuyFromMarket('${l.id}')">Satın Al</button>
        </div>
      `;
    }
  }
  list.innerHTML = html;
}
window.oyunPazariView = oyunPazariView;

function askListPlayerItem(itemKey, maxQty){
  const u = URUNLER[itemKey];
  showModal(`${u.emo} ${u.name} Satışa Koy`, `
    <p class="small muted mb-8">Depoda: ${fmtInt(maxQty)} ${u.unit} • Taban: ${cashFmt(u.base)}</p>
    <p class="small red mb-8">⚠️ Komisyon: %2 (platforma gider)</p>
    <div class="input-group">
      <label>Miktar</label>
      <input type="number" id="pmQty" value="${Math.min(50, maxQty)}" min="1" max="${maxQty}">
    </div>
    <div class="input-group">
      <label>Birim Fiyat (₺)</label>
      <input type="number" id="pmPrice" step="0.01" value="${+(u.base*1.3).toFixed(2)}">
    </div>
    <div class="input-group">
      <label>Görünürlük</label>
      <select id="pmPublic">
        <option value="1">🌐 Herkese Açık</option>
        <option value="0">🔒 Gizli (link ile)</option>
      </select>
    </div>
    <button class="btn-primary" onclick="confirmListItem('${itemKey}')">Satışa Çıkar</button>
  `);
}
window.askListPlayerItem = askListPlayerItem;

async function confirmListItem(itemKey){
  const qty = parseInt($('#pmQty').value);
  const price = parseFloat($('#pmPrice').value);
  const isPublic = $('#pmPublic').value === '1';
  closeModal();
  await listPlayerItem(itemKey, qty, price, isPublic);
  oyunPazariView('mine');
}
window.confirmListItem = confirmListItem;

async function askBuyFromMarket(listingId){
  const l = await dbGet(`playerMarket/${listingId}`);
  if (!l) return toast('İlan bulunamadı','error');
  const u = URUNLER[l.item];
  showModal(`${u.emo} Satın Al`, `
    <p class="small muted mb-8">Satıcı: ${escapeHtml(l.sellerName)} • Kalan: ${fmtInt(l.remaining)} ${u.unit}</p>
    <p class="small mb-8">Birim: <b class="green">${cashFmt(l.price)}</b></p>
    <div class="input-group">
      <label>Miktar</label>
      <input type="number" id="pmBuyQty" value="1" min="1" max="${l.remaining}">
    </div>
    <p class="small muted" id="pmBuyTotal">Toplam: ${cashFmt(l.price)}</p>
    <button class="btn-primary" onclick="confirmBuyMarket('${listingId}',${l.price})">Satın Al</button>
  `);
  $('#pmBuyQty').addEventListener('input', e => {
    const t = document.getElementById('pmBuyTotal');
    if (t) t.textContent = `Toplam: ${cashFmt(parseFloat(e.target.value||1)*l.price)}`;
  });
}
window.askBuyFromMarket = askBuyFromMarket;

async function confirmBuyMarket(listingId, price){
  const qty = parseInt($('#pmBuyQty').value);
  closeModal();
  await buyFromPlayerMarket(listingId, qty);
  await updateDailyTask('trade_1', 1);
  renderOyunPazari();
}
window.confirmBuyMarket = confirmBuyMarket;

/* ============================================================
   GÜNLÜK GÖREVLER — Render
   ============================================================ */
async function renderGorevler(){
  const main = $('#appMain');
  const today = new Date().toDateString();
  const taskData = await dbGet(`users/${GZ.uid}/dailyTasks/${today}`) || {};
  const targets = { sell_100:100, harvest_3:3, trade_1:1, chat_5:5, crypto_1:1, login:1 };

  let html = `<div class="page-title">📋 Günlük Görevler</div>
    <p class="small muted mb-12">Her gün sıfırlanır. Görev tamamla, ödül kazan!</p>`;

  for (const task of DAILY_TASKS){
    const td = taskData[task.id] || { count:0, done:false };
    const target = targets[task.id] || 1;
    const pct = Math.min(100, ((td.count||0)/target)*100);
    html += `
      <div class="card ${td.done?'style="border-color:var(--green)"':''}">
        <div class="card-row">
          <div class="card-thumb">${td.done?'✅':'🎯'}</div>
          <div class="card-body">
            <div class="card-title">${task.name} ${td.done?'<span class="small green">TAMAM</span>':''}</div>
            <div class="card-sub">${task.desc}</div>
            <div class="shelf-prog mt-8"><div class="shelf-prog-fill" style="width:${pct}%"></div></div>
            <div class="small muted">${td.count||0} / ${target}</div>
          </div>
          <div class="tac" style="min-width:70px">
            <div class="green bold">${cashFmt(task.reward)}</div>
            <div class="small muted">+${task.xp} XP</div>
          </div>
        </div>
      </div>
    `;
  }
  main.innerHTML = html;
}
window.renderGorevler = renderGorevler;

/* ============================================================
   BAŞARIMLAR — Render
   ============================================================ */
async function renderBasarimlar(){
  const main = $('#appMain');
  const earned = await dbGet(`users/${GZ.uid}/achievements`) || {};
  const total = ACHIEVEMENTS.length;
  const done = Object.keys(earned).length;

  let html = `<div class="page-title">🏅 Başarımlar</div>
    <div class="stats-grid">
      <div class="stat-box"><div class="lbl">Kazanılan</div><div class="val green">${done}</div></div>
      <div class="stat-box"><div class="lbl">Toplam</div><div class="val">${total}</div></div>
      <div class="stat-box"><div class="lbl">Tamamlama</div><div class="val">%${Math.floor(done/total*100)}</div></div>
    </div>`;

  for (const ach of ACHIEVEMENTS){
    const isEarned = !!earned[ach.id];
    html += `
      <div class="card ${isEarned?'':'opacity:.6'}">
        <div class="card-row">
          <div class="card-thumb" style="${isEarned?'':'filter:grayscale(1)'}">${ach.emo}</div>
          <div class="card-body">
            <div class="card-title">${ach.name} ${isEarned?'<span class="small green">✓</span>':''}</div>
            <div class="card-sub">${ach.desc}</div>
            ${isEarned?`<div class="small muted">${new Date(earned[ach.id].ts).toLocaleDateString('tr-TR')}</div>`:''}
          </div>
          <div class="small muted">+${ach.xp} XP</div>
        </div>
      </div>
    `;
  }
  main.innerHTML = html;
}
window.renderBasarimlar = renderBasarimlar;

/* ============================================================
   SES SİSTEMİ — Düzeltilmiş
   ============================================================ */
const SoundManager = (() => {
  const ctx = { ac: null };
  function getCtx(){
    if (!ctx.ac) ctx.ac = new (window.AudioContext || window.webkitAudioContext)();
    return ctx.ac;
  }
  function play(type){
    if (localStorage.getItem('sound') === 'off') return;
    try {
      const ac = getCtx();
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.connect(g); g.connect(ac.destination);
      const configs = {
        success:  { freq:[523,659,784], dur:0.08, vol:0.3, type:'sine' },
        error:    { freq:[400,300],     dur:0.15, vol:0.3, type:'sawtooth' },
        warn:     { freq:[440,440],     dur:0.1,  vol:0.2, type:'triangle' },
        cash:     { freq:[659,784,1047],dur:0.07, vol:0.4, type:'sine' },
        levelup:  { freq:[523,659,784,1047], dur:0.1, vol:0.4, type:'sine' },
        click:    { freq:[600],         dur:0.05, vol:0.15, type:'sine' },
      };
      const c = configs[type] || configs.click;
      o.type = c.type;
      g.gain.setValueAtTime(0, ac.currentTime);
      g.gain.linearRampToValueAtTime(c.vol, ac.currentTime + 0.01);
      let t = ac.currentTime;
      for (let i = 0; i < c.freq.length; i++){
        o.frequency.setValueAtTime(c.freq[i], t);
        t += c.dur;
      }
      g.gain.setValueAtTime(c.vol, t - 0.01);
      g.gain.linearRampToValueAtTime(0, t + 0.05);
      o.start(ac.currentTime);
      o.stop(t + 0.1);
    } catch(e) { /* Sessiz hata */ }
  }
  return { play };
})();
window.SoundManager = SoundManager;

// Toast'a ses entegrasyonu
const _origToast = window.toast;
window.toast = function(msg, type){
  if (typeof _origToast === 'function') _origToast(msg, type);
  if (type === 'success') SoundManager.play('success');
  else if (type === 'error') SoundManager.play('error');
  else if (type === 'warn') SoundManager.play('warn');
};

/* ============================================================
   PAZAR YERİ DETAYLI SİSTEM — Birden fazla pazar seviye kilidi
   ============================================================ */
async function renderPazar(){
  const main = $('#appMain');
  const lv = GZ.data.level || 1;
  const shops = await dbGet(`businesses/${GZ.uid}/shops`) || {};

  // Pazar seviyeleri
  const pazarSeviyeleri = [
    { lv:1,  name:'Mahalle Pazarı',  emo:'🛒', desc:'Temel ürünler: gıda, meyve, sebze' },
    { lv:5,  name:'İlçe Pazarı',     emo:'🏪', desc:'Süt ürünleri, et, fırın' },
    { lv:10, name:'Şehir Pazarı',    emo:'🏬', desc:'Sanayi ürünleri, tekstil' },
    { lv:20, name:'Bölge Pazarı',    emo:'🏭', desc:'Madenler, kimyasallar' },
    { lv:30, name:'Ulusal Pazar',    emo:'🌍', desc:'Tüm ürünler, özel ihaleler' },
  ];

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

  let html = `<div class="page-title">🛒 Pazar Sistemi</div>
    <div class="stats-grid">
      <div class="stat-box"><div class="lbl">Reyon</div><div class="val">${totalShelves}</div></div>
      <div class="stat-box"><div class="lbl">Ciro</div><div class="val green" style="font-size:12px">${cashFmt(totalRev)}</div></div>
      <div class="stat-box"><div class="lbl">Satış</div><div class="val">${fmtInt(totalSold)}</div></div>
      <div class="stat-box"><div class="lbl">Seviye</div><div class="val">Lv ${lv}</div></div>
    </div>
    <div class="section-title">PAZAR KADEMELERİ</div>`;

  for (const p of pazarSeviyeleri){
    const unlocked = lv >= p.lv;
    html += `<div class="card ${unlocked?'':'opacity:.5'}">
      <div class="card-row">
        <div class="card-thumb">${unlocked?p.emo:'🔒'}</div>
        <div class="card-body">
          <div class="card-title">${p.name} ${unlocked?'<span class="small green">✓ Açık</span>':''}</div>
          <div class="card-sub">${p.desc}</div>
          <div class="small muted">Gerekli seviye: Lv ${p.lv}</div>
        </div>
      </div>
    </div>`;
  }

  // Oyuncu pazarına link
  html += `<button class="btn-primary mt-12" style="width:100%" onclick="switchTab('oyunpazari')">🏬 Oyuncu Pazarına Git</button>`;

  html += `<div class="card mt-12">
    <div class="card-title">📊 Pazar Kuralları</div>
    <p class="small muted mt-12">• Pazar her 90 saniyede otomatik döner<br>• Fiyat tabanın 3 katını geçemez<br>• Reyona stok yüklemeden satış olmaz<br>• %2 pazar komisyonu kesilir</p>
  </div>`;
  main.innerHTML = html;
}


/* ╔══════════════════════════════════════════════════════════════════════════╗
   ║                    UI MANAGER — v2.0 RENDER GENİŞLETMESİ                 ║
   ║   Borsa, Emlak, Sigorta, Franchise, Uluslararası, Karaborsa, Tahvil,   ║
   ║   Futures, Hedge, Çalışan, Ar-Ge, Eğitim, Sözleşme, Belediye,           ║
   ║   Tic.Savaş, Düello, Sefer, Prestij, Koleksiyon, TR Harita,             ║
   ║   Avatar, Unvan, Dekorasyon + KURUCU PANELİ                            ║
   ╚══════════════════════════════════════════════════════════════════════════╝ */

/* render() switch'ine yeni case'leri ekle */
const _origRender = window.render;
window.render = function(tab) {
  const main = $('#appMain');
  switch(tab) {
    case 'borsa':       return renderBorsa();
    case 'emlak':       return renderEmlak();
    case 'sigorta':     return renderSigorta();
    case 'franchise':   return renderFranchise();
    case 'uluslararasi':return renderUluslararasi();
    case 'karaborsa':   return renderKaraborsa();
    case 'tahvil':      return renderTahvil();
    case 'futures':     return renderFutures();
    case 'hedgefon':    return renderHedgeFon();
    case 'calisan':     return renderCalisan();
    case 'arge':        return renderArge();
    case 'egitim':      return renderEgitim();
    case 'sozlesme':    return renderSozlesme();
    case 'belediye':    return renderBelediye();
    case 'ticsavas':    return renderTicsavas();
    case 'duello':      return renderDuello();
    case 'avatar':      return renderAvatar();
    case 'unvan':       return renderUnvan();
    case 'dekorasyon':  return renderDekorasyon();
    case 'sefer':       return renderSefer();
    case 'prestij':     return renderPrestij();
    case 'koleksiyon':  return renderKoleksiyon();
    case 'harita':      return renderHarita();
    default:            return _origRender ? _origRender(tab) : null;
  }
};

/* ─── Yardımcı kart şablonu ─── */
function _v2Card(title, body, footer) {
  return `<div class="v2-card">
    <div class="v2-card-head"><h3>${title}</h3></div>
    <div class="v2-card-body">${body}</div>
    ${footer ? `<div class="v2-card-foot">${footer}</div>` : ''}
  </div>`;
}

/* ============================================================
   📊 BORSA RENDER
   ============================================================ */
async function renderBorsa() {
  const main = $('#appMain');
  main.innerHTML = `<div class="page-head"><h2>📊 Borsa İstanbul (Sanal)</h2><p class="muted">Hisse senedi al-sat, temettü kazan, IPO yap.</p></div>
    <div class="v2-toolbar">
      <button class="btn-secondary" onclick="renderBorsaIPO()">🚀 Kendi Şirketini Halka Aç (IPO)</button>
      <button class="btn-secondary" onclick="renderBorsaPortfoy()">💼 Portföyüm</button>
    </div>
    <div id="borsaList" class="stocks-grid"></div>`;

  const list = $('#borsaList');
  let html = '';
  for (const s of STOCKS_DATA) {
    const price = await dbGet('stocks/prices/' + s.sym + '/current') || s.basePrice;
    const change = await dbGet('stocks/prices/' + s.sym + '/changePct') || 0;
    const cls = change > 0 ? 'up' : change < 0 ? 'down' : '';
    html += `<div class="stock-card ${cls}">
      <div class="sc-head">
        <span class="sc-sym">${s.sym}</span>
        <span class="sc-sector">${STOCK_SECTORS[s.sector]||s.sector}</span>
      </div>
      <div class="sc-name">${s.name}</div>
      <div class="sc-price">₺${price.toFixed(2)}</div>
      <div class="sc-change ${cls}">${change>0?'▲':change<0?'▼':'■'} ${change.toFixed(2)}%</div>
      <div class="sc-actions">
        <button class="btn-mini buy" onclick="borsaTradeModal('${s.sym}','buy')">AL</button>
        <button class="btn-mini sell" onclick="borsaTradeModal('${s.sym}','sell')">SAT</button>
      </div>
      <div class="sc-meta">Temettü: %${(s.divRate*100).toFixed(1)}/yıl</div>
    </div>`;
  }
  list.innerHTML = html;
}
window.renderBorsa = renderBorsa;

window.borsaTradeModal = async function(sym, action) {
  const stock = STOCKS_DATA.find(s => s.sym === sym);
  const price = await dbGet('stocks/prices/' + sym + '/current') || stock.basePrice;
  const owned = await dbGet('stocks/holdings/' + GZ.uid + '/' + sym) || { qty:0, avgPrice:0 };
  const myMoney = GZ.data?.money || 0;

  // Max alabileceği lot
  const maxBuyQty = Math.floor(myMoney / (price * 1.002));
  // Max satabileceği lot
  const maxSellQty = owned.qty || 0;
  const maxQty = action === 'buy' ? maxBuyQty : maxSellQty;
  const maxLabel = action === 'buy' ? `Alabileceğin: ${maxBuyQty} adet` : `Sahip: ${maxSellQty} adet`;

  showModal(`${action==='buy'?'📈 Al':'📉 Sat'} — ${sym}`, `
    <div class="trade-info">
      <div><b>Şirket:</b> ${stock.name}</div>
      <div><b>Anlık Fiyat:</b> ₺${price.toFixed(2)}</div>
      <div><b>Sahip Olunan:</b> ${owned.qty || 0} adet (Ort: ₺${owned.avgPrice?.toFixed(2)||'0'})</div>
      <div><b style="color:var(--primary)">${maxLabel}</b></div>
    </div>
    <input type="number" id="trdQty" placeholder="Adet" min="1">
    <div class="quick-amount-row">
      <button class="btn-quick" onclick="borsaQuickFill(${maxQty},0.25)">%25</button>
      <button class="btn-quick" onclick="borsaQuickFill(${maxQty},0.50)">%50</button>
      <button class="btn-quick" onclick="borsaQuickFill(${maxQty},0.75)">%75</button>
      <button class="btn-quick btn-quick-max ${action==='sell'?'btn-quick-sell':''}" onclick="borsaQuickFill(${maxQty},1.0)">${action==='sell'?'💸 TÜMÜNÜ SAT':'💰 MAX'}</button>
    </div>
    <div id="trdSummary" class="trade-summary"></div>
    <button class="btn-primary" onclick="borsaExecute('${sym}','${action}')" style="margin-top:10px">${action==='buy'?'Satın Al':'Sat'}</button>
  `);
  setTimeout(() => {
    const inp = document.getElementById('trdQty');
    if (!inp) return;
    const updateSummary = () => {
      const q = parseInt(inp.value) || 0;
      const total = q * price;
      const com = total * 0.002;
      const sumEl = document.getElementById('trdSummary');
      if (sumEl) sumEl.innerHTML = `
        Tutar: ₺${total.toFixed(2)}<br>
        Komisyon (%0.2): ₺${com.toFixed(2)}<br>
        <b>Toplam: ₺${(action==='buy'? total+com : total-com).toFixed(2)}</b>`;
    };
    inp.addEventListener('input', updateSummary);
    inp._updateSummary = updateSummary;
  }, 100);
};

window.borsaQuickFill = function(maxQty, ratio) {
  const inp = document.getElementById('trdQty');
  if (!inp) return;
  const v = Math.floor(maxQty * ratio);
  inp.value = v;
  if (inp._updateSummary) inp._updateSummary();
  if (ratio === 1.0) toast(`📊 ${v} adet`, 'info', 2000);
};

window.borsaExecute = async function(sym, action) {
  const qty = parseInt(document.getElementById('trdQty').value) || 0;
  if (qty <= 0) return toast('Geçerli adet girin', 'error');
  const result = action === 'buy' ? await buyStock(sym, qty) : await sellStock(sym, qty);
  if (result.ok) { toast(result.msg, 'success'); closeModal(); renderBorsa(); }
  else toast(result.msg, 'error');
};

window.renderBorsaPortfoy = async function() {
  const holdings = await dbGet('stocks/holdings/' + GZ.uid) || {};
  let html = '<h3>💼 Hisse Portföyüm</h3>';
  if (!Object.keys(holdings).length) html += '<p class="muted">Henüz hisseniz yok.</p>';
  else {
    html += '<div class="portfoy-list">';
    for (const sym of Object.keys(holdings)) {
      const h = holdings[sym];
      const stock = STOCKS_DATA.find(s => s.sym === sym);
      const price = await dbGet('stocks/prices/' + sym + '/current') || stock.basePrice;
      const value = price * h.qty;
      const profit = value - h.totalCost;
      html += `<div class="portfoy-row">
        <b>${sym}</b> ${h.qty} adet × ₺${price.toFixed(2)} = ₺${value.toFixed(2)}
        <span style="color:${profit>=0?'#16a34a':'#dc2626'}">${profit>=0?'+':''}${profit.toFixed(2)}</span>
      </div>`;
    }
    html += '</div>';
  }
  showModal('💼 Portföyüm', html);
};

window.renderBorsaIPO = async function() {
  showModal('🚀 IPO — Şirketini Halka Aç', `
    <p class="muted">Min. Lv 25 + ₺500K servet · Listeleme ücreti: hisse×fiyat×%5</p>
    <input type="text" id="ipoCompany" placeholder="Şirket adı (ör: GZ Tekstil A.Ş.)">
    <input type="number" id="ipoShares" placeholder="Toplam hisse (1000-1.000.000)">
    <input type="number" id="ipoPrice" placeholder="Hisse fiyatı (₺1-1000)">
    <button class="btn-primary" onclick="executeIPO()">Halka Aç</button>
  `);
};
window.executeIPO = async function() {
  const c = document.getElementById('ipoCompany').value.trim();
  const s = parseInt(document.getElementById('ipoShares').value);
  const p = parseFloat(document.getElementById('ipoPrice').value);
  if (!c) return toast('Şirket adı gerekli', 'error');
  const r = await createIPO(c, s, p);
  if (r.ok) { toast(`✅ IPO açıldı: ${r.sym}`, 'success'); closeModal(); }
  else toast(r.msg, 'error');
};

/* ============================================================
   🏘️ EMLAK RENDER
   ============================================================ */
async function renderEmlak() {
  const main = $('#appMain');
  main.innerHTML = `<div class="page-head"><h2>🏘️ Emlak Pazarı</h2><p class="muted">Arsa al, bina yap, kira topla, değer kazansın.</p></div>
    <div class="v2-toolbar">
      <button class="btn-secondary" onclick="renderEmlakOwned()">🏠 Emlaklarım</button>
    </div>
    <div class="emlak-grid" id="emlakGrid"></div>`;

  let html = '';
  for (const t of EMLAK_TIPLERI) {
    html += `<div class="emlak-card">
      <div class="ec-emo">${t.emo}</div>
      <div class="ec-name">${t.name}</div>
      <div class="ec-price">₺${t.basePrice.toLocaleString('tr-TR')}+</div>
      <div class="ec-desc">${t.desc}</div>
      <div class="ec-meta">${t.rentMax > 0 ? `Kira: ₺${t.rentMin}-${t.rentMax}/ay` : 'Kira: yok (arsa)'}</div>
      <button class="btn-mini buy" onclick="emlakBuyModal('${t.type}')">SATIN AL</button>
    </div>`;
  }
  $('#emlakGrid').innerHTML = html;
}
window.renderEmlak = renderEmlak;

window.emlakBuyModal = function(typeId) {
  const cities = (window.ILLER || []).slice(0, 30);
  showModal('🏘️ Emlak Satın Al', `
    <p class="muted">Şehir seç (İstanbul/Ankara/İzmir daha pahalı):</p>
    <select id="emlakCity">${cities.map(c => `<option>${c}</option>`).join('')}</select>
    <button class="btn-primary" onclick="emlakBuyExec('${typeId}')">Satın Al</button>
  `);
};

window.emlakBuyExec = async function(typeId) {
  const city = document.getElementById('emlakCity').value;
  const r = await buyProperty(typeId, city);
  if (r.ok) { toast(`✅ ${city}'da emlak alındı! ₺${r.price.toLocaleString('tr-TR')}`, 'success'); closeModal(); }
  else toast(r.msg, 'error');
};

window.renderEmlakOwned = async function() {
  const owned = await dbGet('realestate/owned/' + GZ.uid) || {};
  let html = '<h3>🏠 Emlak Portföyüm</h3>';
  if (!Object.keys(owned).length) html += '<p class="muted">Emlağınız yok.</p>';
  else {
    for (const k of Object.keys(owned)) {
      const p = owned[k];
      const t = EMLAK_TIPLERI.find(x => x.type === p.type);
      html += `<div class="owned-prop">
        <b>${t.emo} ${t.name}</b> · ${p.city}<br>
        <small>Değer: ₺${p.currentValue?.toLocaleString('tr-TR')} · ${p.rented ? `Kiracı: ${p.tenantName} (₺${p.monthlyRent}/ay)` : 'Boş'}</small><br>
        ${!p.rented && p.rentMax > 0 ? `<button class="btn-mini" onclick="findTenantUI('${k}')">Kiracı Bul</button>` : ''}
        <button class="btn-mini sell" onclick="sellPropertyUI('${k}')">Sat</button>
      </div>`;
    }
  }
  showModal('🏠 Emlaklarım', html);
};
window.findTenantUI = async function(k) {
  const r = await findTenant(k);
  if (r.ok) toast(`✅ Kiracı bulundu: ${r.tenant} · ₺${r.rent}/ay`, 'success');
  else toast(r.msg, 'error');
  renderEmlakOwned();
};
window.sellPropertyUI = async function(k) {
  if (!confirm('Bu emlağı %95 değerinde satmak istediğine emin misin?')) return;
  const r = await sellProperty(k);
  if (r.ok) { toast(`✅ Satıldı: ₺${r.sellPrice.toLocaleString('tr-TR')}`, 'success'); renderEmlakOwned(); }
  else toast(r.msg, 'error');
};

/* ============================================================
   🛡️ SİGORTA RENDER
   ============================================================ */
function renderSigorta() {
  const main = $('#appMain');
  let html = `<div class="page-head"><h2>🛡️ Sigorta Şirketi</h2><p class="muted">Tesislerini, ürünlerini, araçlarını sigortala. Afet halinde tazminat al.</p></div>
    <div class="sigorta-grid">`;
  for (const k of Object.keys(INSURANCE_TYPES)) {
    const c = INSURANCE_TYPES[k];
    html += `<div class="ins-card">
      <h3>${c.name}</h3>
      <div class="muted">Riskler: ${c.risks.join(', ')}</div>
      <div class="ins-tiers">
        ${c.coverPct.map((cv, i) => `
          <button class="btn-mini" onclick="sigortaBuyModal('${k}', ${i})">
            Kademe ${i+1} (Teminat %${cv*100}, Prim %${(c.premiumPct[i]*100).toFixed(2)}/ay)
          </button>
        `).join('')}
      </div>
    </div>`;
  }
  html += '</div><div style="margin-top:20px"><button class="btn-secondary" onclick="renderSigortaPolicies()">📋 Poliçelerim</button></div>';
  main.innerHTML = html;
}
window.renderSigorta = renderSigorta;

window.sigortaBuyModal = function(typeKey, tier) {
  showModal('🛡️ Sigorta Satın Al', `
    <p class="muted">Sigorta yapılacak varlığın değerini gir:</p>
    <input type="number" id="insAsset" placeholder="Varlık değeri (₺)">
    <button class="btn-primary" onclick="sigortaBuyExec('${typeKey}',${tier})">Poliçe Oluştur</button>
  `);
};
window.sigortaBuyExec = async function(typeKey, tier) {
  const v = parseFloat(document.getElementById('insAsset').value) || 0;
  const r = await buyInsurance(typeKey, tier, v);
  if (r.ok) { toast('✅ Poliçe oluşturuldu!', 'success'); closeModal(); }
  else toast(r.msg, 'error');
};
window.renderSigortaPolicies = async function() {
  const ps = await dbGet('insurance/policies/' + GZ.uid) || {};
  let html = '<h3>📋 Aktif Poliçelerim</h3>';
  if (!Object.keys(ps).length) html += '<p class="muted">Poliçeniz yok.</p>';
  else for (const k of Object.keys(ps)) {
    const p = ps[k];
    html += `<div class="policy-row">
      <b>${p.type}</b> · Teminat: ₺${p.coverage?.toLocaleString('tr-TR')}<br>
      <small>Prim: ₺${p.premium}/ay · ${p.claims||0} hasar talebi</small>
    </div>`;
  }
  showModal('📋 Poliçelerim', html);
};

/* ============================================================
   🪧 FRANCHISE RENDER
   ============================================================ */
async function renderFranchise() {
  const main = $('#appMain');
  const offers = await dbGet('franchise/offers') || {};
  let html = `<div class="page-head"><h2>🪧 Franchise Pazarı</h2><p class="muted">Hazır markalar al, kendi markanı ver. Royalty kazan.</p></div>
    <div class="v2-toolbar">
      <button class="btn-secondary" onclick="franchiseCreateModal()">🆕 Kendi Franchise'ını Aç</button>
      <button class="btn-secondary" onclick="renderMyFranchises()">🪪 Sahip Olduklarım</button>
    </div>
    <div class="franchise-list">`;
  for (const k of Object.keys(offers)) {
    const o = offers[k];
    if (o.status !== 'open' || o.ownerUid === GZ.uid) continue;
    html += `<div class="franchise-card">
      <h3>${o.brandName}</h3>
      <div class="muted">Sahip: ${o.ownerName}</div>
      <div>Royalty: %${o.royaltyPct} · Başlangıç: ₺${o.initialFee?.toLocaleString('tr-TR')}</div>
      <div class="muted">Aktif şube: ${o.activeFranchisees||0}</div>
      <button class="btn-mini buy" onclick="franchiseBuy('${k}')">Satın Al</button>
    </div>`;
  }
  html += '</div>';
  main.innerHTML = html;
}
window.renderFranchise = renderFranchise;

window.franchiseCreateModal = function() {
  showModal('🆕 Franchise Oluştur', `
    <input type="text" id="frBrand" placeholder="Marka adı">
    <input type="number" id="frRoyalty" placeholder="Royalty % (5-30)" min="5" max="30">
    <input type="number" id="frFee" placeholder="Başlangıç ücreti (min ₺10K)">
    <input type="text" id="frProduct" placeholder="Ürün tipi (kahve, kıyafet, vb)">
    <button class="btn-primary" onclick="franchiseCreateExec()">Oluştur</button>
  `);
};
window.franchiseCreateExec = async function() {
  const r = await createFranchiseOffer(
    $('#frBrand').value.trim(),
    parseFloat($('#frRoyalty').value),
    parseFloat($('#frFee').value),
    $('#frProduct').value.trim()
  );
  if (r.ok) { toast('✅ Franchise oluşturuldu!', 'success'); closeModal(); renderFranchise(); }
  else toast(r.msg, 'error');
};
window.franchiseBuy = async function(k) {
  const r = await buyFranchise(k);
  if (r.ok) { toast('✅ Franchise alındı!', 'success'); renderFranchise(); }
  else toast(r.msg, 'error');
};
window.renderMyFranchises = async function() {
  const all = await dbGet('franchise/active') || {};
  const mine = Object.values(all).filter(f => f.franchiseeUid === GZ.uid);
  let html = '<h3>🪪 Sahip Olduğum Franchise\'lar</h3>';
  if (!mine.length) html = '<p class="muted">Franchise yok.</p>';
  else for (const f of mine) {
    html += `<div class="my-fr"><b>${f.brandName}</b> · Royalty: %${f.royaltyPct} · Sahibi: ${f.offerOwnerName}</div>`;
  }
  showModal('🪪 Franchise\'larım', html);
};

/* ============================================================
   🌍 ULUSLARARASI TİCARET RENDER
   ============================================================ */
function renderUluslararasi() {
  const main = $('#appMain');
  let html = `<div class="page-head"><h2>🌍 Uluslararası Ticaret</h2><p class="muted">10 ülkeye ihracat yap. Mesafe = teslim süresi. Gümrük vergisi %4-12.</p></div>
    <div class="countries-grid">`;
  for (const c of COUNTRIES) {
    html += `<div class="country-card">
      <div class="cc-flag">${c.flag}</div>
      <h3>${c.name}</h3>
      <div class="muted">${c.currency} · 1 USD = ${(1/c.rateUsd).toFixed(2)} ${c.currency}</div>
      <div>Talep: ×${c.demandMult.toFixed(1)} · Gümrük: %${(c.tariff*100).toFixed(0)}</div>
      <div class="muted">Mesafe: ${c.distance} km · Teslim: ~${Math.ceil(c.distance/800)} gün</div>
      <button class="btn-mini buy" onclick="intlExportModal('${c.code}')">İhracat Yap</button>
    </div>`;
  }
  html += '</div><div style="margin-top:16px"><button class="btn-secondary" onclick="renderIntlShipments()">📦 Sevkiyatlarım</button></div>';
  main.innerHTML = html;
}
window.renderUluslararasi = renderUluslararasi;

window.intlExportModal = function(code) {
  const products = Object.keys(URUNLER).slice(0, 30);
  showModal('🌍 İhracat Yap', `
    <select id="intlProd">${products.map(p => `<option value="${p}">${URUNLER[p].emo} ${URUNLER[p].name}</option>`).join('')}</select>
    <input type="number" id="intlQty" placeholder="Adet">
    <button class="btn-primary" onclick="intlExportExec('${code}')">Gönder</button>
  `);
};
window.intlExportExec = async function(code) {
  const p = $('#intlProd').value;
  const q = parseInt($('#intlQty').value) || 0;
  const r = await exportInternational(code, p, q);
  if (r.ok) { toast(`✅ Sevk edildi! Net: ₺${r.netRevenue.toLocaleString('tr-TR')} (${r.days} gün)`, 'success'); closeModal(); }
  else toast(r.msg, 'error');
};
window.renderIntlShipments = async function() {
  const ships = await dbGet('intl_trade/shipments/' + GZ.uid) || {};
  let html = '<h3>📦 Sevkiyatlarım</h3>';
  for (const k of Object.keys(ships)) {
    const s = ships[k];
    const remaining = Math.max(0, s.arrivesAt - Date.now());
    const days = Math.ceil(remaining / (24*3600*1000));
    html += `<div class="ship-row"><b>${s.countryName}</b> ${s.product}×${s.qty} · ${s.status==='in_transit'?`${days} gün kaldı`:'✅ Teslim Edildi'} · ₺${s.netRevenue?.toLocaleString('tr-TR')}</div>`;
  }
  showModal('📦 Sevkiyatlarım', html || '<p class="muted">Yok</p>');
};

/* ============================================================
   🕶️ KARABORSA RENDER (oyun özelliği - illegal değil)
   ============================================================ */
function renderKaraborsa() {
  const main = $('#appMain');
  let html = `<div class="page-head"><h2>🕶️ Karaborsa</h2><p class="muted">⚠️ Yüksek risk, yüksek kazanç. Yakalanırsan ceza! Min Lv 15.</p></div>
    <div class="bm-grid">`;
  for (const it of BLACKMARKET_ITEMS) {
    html += `<div class="bm-card">
      <div class="bm-emo">${it.emo}</div>
      <h3>${it.name}</h3>
      <div>Alış: ₺${it.priceMin}-${it.priceMax}</div>
      <div class="risk-bar">Risk: ${'⚠️'.repeat(Math.ceil(it.risk*5))}</div>
      <div>Kar potansiyeli: ×${it.profit}</div>
      <button class="btn-mini buy" onclick="bmBuyModal('${it.code}')">AL</button>
      <button class="btn-mini sell" onclick="bmSellModal('${it.code}')">SAT</button>
    </div>`;
  }
  html += '</div>';
  main.innerHTML = html;
}
window.renderKaraborsa = renderKaraborsa;
window.bmBuyModal = function(c) {
  showModal('🕶️ Karaborsa Alış', `<input type="number" id="bmQ" placeholder="Adet"><button class="btn-primary" onclick="bmBuyExec('${c}')">Risk Al</button>`);
};
window.bmBuyExec = async function(c) {
  const q = parseInt($('#bmQ').value) || 0;
  const r = await blackmarketBuy(c, q);
  toast(r.msg || (r.ok ? 'Alındı' : 'Hata'), r.ok ? 'success' : 'error');
  if (r.ok) closeModal();
};
window.bmSellModal = function(c) {
  showModal('🕶️ Karaborsa Satış', `<input type="number" id="bmQ" placeholder="Adet"><button class="btn-primary" onclick="bmSellExec('${c}')">Risk Al</button>`);
};
window.bmSellExec = async function(c) {
  const q = parseInt($('#bmQ').value) || 0;
  const r = await blackmarketSell(c, q);
  toast(r.msg || (r.ok ? `Satıldı: ₺${r.total?.toFixed(0)}` : 'Hata'), r.ok ? 'success' : 'error');
  if (r.ok) closeModal();
};

/* ============================================================
   📜 TAHVİL RENDER
   ============================================================ */
function renderTahvil() {
  const main = $('#appMain');
  let html = `<div class="page-head"><h2>📜 Tahvil Piyasası</h2><p class="muted">Sabit getirili yatırım. 3 ayda bir kupon, vadede anapara.</p></div>
    <div class="bonds-grid">`;
  for (const b of BONDS) {
    html += `<div class="bond-card">
      <div class="bc-head"><span>${b.emo}</span><h3>${b.name}</h3></div>
      <div>Nominal: ₺${b.face.toLocaleString('tr-TR')}</div>
      <div>Yıllık Getiri: %${(b.yieldRate*100).toFixed(1)}</div>
      <div>Vade: ${Math.floor(b.term/365)} yıl</div>
      <div>İhraç: ${b.issuer}</div>
      <div class="risk">Risk: ${'⚠️'.repeat(b.riskLevel)}</div>
      <button class="btn-mini buy" onclick="bondBuyModal('${b.code}')">Satın Al</button>
    </div>`;
  }
  html += '</div>';
  main.innerHTML = html;
}
window.renderTahvil = renderTahvil;
window.bondBuyModal = function(c) {
  showModal('📜 Tahvil Al', `<input type="number" id="bndQ" placeholder="Adet"><button class="btn-primary" onclick="bondBuyExec('${c}')">Al</button>`);
};
window.bondBuyExec = async function(c) {
  const q = parseInt($('#bndQ').value) || 0;
  const r = await buyBond(c, q);
  if (r.ok) { toast(`✅ Alındı! ₺${r.cost.toLocaleString('tr-TR')}`, 'success'); closeModal(); }
  else toast(r.msg, 'error');
};

/* ============================================================
   📉 FUTURES RENDER
   ============================================================ */
async function renderFutures() {
  const main = $('#appMain');
  let html = `<div class="page-head"><h2>📉 Vadeli İşlemler (Futures)</h2><p class="muted">Kaldıraçlı al/sat. ⚠️ Liquidation riski!</p></div>
    <div class="futures-grid">`;
  for (const s of STOCKS_DATA.slice(0, 10)) {
    const price = await dbGet('stocks/prices/' + s.sym + '/current') || s.basePrice;
    html += `<div class="fut-card">
      <h3>${s.sym}</h3>
      <div>₺${price.toFixed(2)}</div>
      <button class="btn-mini buy" onclick="futOpenModal('${s.sym}','long')">📈 LONG</button>
      <button class="btn-mini sell" onclick="futOpenModal('${s.sym}','short')">📉 SHORT</button>
    </div>`;
  }
  html += '</div><div style="margin-top:16px"><button class="btn-secondary" onclick="renderFutPositions()">📊 Açık Pozisyonlarım</button></div>';
  main.innerHTML = html;
}
window.renderFutures = renderFutures;
window.futOpenModal = function(sym, dir) {
  showModal(`📊 Pozisyon Aç (${dir.toUpperCase()})`, `
    <input type="number" id="futLot" placeholder="Lot büyüklüğü">
    <select id="futLev"><option value="1">1x</option><option value="2">2x</option><option value="5">5x</option><option value="10">10x</option></select>
    <button class="btn-primary" onclick="futOpenExec('${sym}','${dir}')">Aç</button>
  `);
};
window.futOpenExec = async function(sym, dir) {
  const lot = parseInt($('#futLot').value) || 0;
  const lev = parseInt($('#futLev').value) || 1;
  const r = await openFuturesPosition(sym, dir, lot, lev);
  if (r.ok) { toast('✅ Pozisyon açıldı', 'success'); closeModal(); }
  else toast(r.msg, 'error');
};
window.renderFutPositions = async function() {
  const ps = await dbGet('futures/positions/' + GZ.uid) || {};
  let html = '<h3>📊 Pozisyonlarım</h3>';
  for (const k of Object.keys(ps)) {
    const p = ps[k];
    if (p.status !== 'open') continue;
    const cur = await dbGet('stocks/prices/' + p.symbol + '/current') || p.entryPrice;
    const diff = p.direction === 'long' ? (cur - p.entryPrice) : (p.entryPrice - cur);
    const pnl = diff * p.lotSize * p.leverage;
    html += `<div class="pos-row">
      <b>${p.symbol}</b> ${p.direction.toUpperCase()} ${p.leverage}x · 
      Giriş: ₺${p.entryPrice.toFixed(2)} · Şu an: ₺${cur.toFixed(2)} · 
      <span style="color:${pnl>=0?'#16a34a':'#dc2626'}">PnL: ₺${pnl.toFixed(2)}</span>
      <button class="btn-mini" onclick="futClose('${k}')">Kapat</button>
    </div>`;
  }
  showModal('📊 Pozisyonlarım', html);
};
window.futClose = async function(k) {
  const r = await closeFuturesPosition(k);
  if (r.liquidated) toast(`💥 LIQUIDATED! Kayıp: ₺${Math.abs(r.pnl).toFixed(2)}`, 'error');
  else if (r.ok) toast(`✅ Kapatıldı! PnL: ₺${r.pnl.toFixed(2)}`, 'success');
  else toast(r.msg, 'error');
  renderFutPositions();
};

/* ============================================================
   💹 HEDGE FON RENDER
   ============================================================ */
async function renderHedgeFon() {
  const main = $('#appMain');
  const funds = await dbGet('hedgefunds/list') || {};
  let html = `<div class="page-head"><h2>💹 Hedge Fonları</h2><p class="muted">Profesyonel yöneticilerin fonlarına yatırım yap. Min Lv 35 ile fon kur.</p></div>
    <button class="btn-secondary" onclick="hfCreateModal()">🆕 Hedge Fon Kur</button>
    <div class="funds-list">`;
  for (const k of Object.keys(funds)) {
    const f = funds[k];
    html += `<div class="fund-card">
      <h3>${f.fundName}</h3>
      <div>Yönetici: ${f.managerName}</div>
      <div>NAV: ₺${f.nav?.toFixed(4)} · AUM: ₺${(f.aum||0).toLocaleString('tr-TR')}</div>
      <div>Yönetim: %${(f.mgmtFee*100).toFixed(2)} · Performans: %${(f.perfFee*100).toFixed(0)}</div>
      <div>Yatırımcı: ${f.investorCount||0} · Min: ₺${f.minInvest?.toLocaleString('tr-TR')}</div>
      <button class="btn-mini buy" onclick="hfInvestModal('${k}',${f.minInvest||10000})">Yatırım Yap</button>
    </div>`;
  }
  html += '</div>';
  main.innerHTML = html;
}
window.renderHedgeFon = renderHedgeFon;
window.hfCreateModal = function() {
  showModal('🆕 Hedge Fon Kur', `
    <input type="text" id="hfName" placeholder="Fon adı">
    <input type="number" id="hfMgmt" placeholder="Yönetim ücreti (0.005-0.05)" step="0.005">
    <input type="number" id="hfPerf" placeholder="Performans ücreti (0.05-0.30)" step="0.01">
    <input type="number" id="hfMin" placeholder="Min yatırım (₺)">
    <button class="btn-primary" onclick="hfCreateExec()">Kur</button>
  `);
};
window.hfCreateExec = async function() {
  const r = await createHedgeFund($('#hfName').value, parseFloat($('#hfMgmt').value), parseFloat($('#hfPerf').value), parseFloat($('#hfMin').value), 'balanced');
  if (r.ok) { toast('✅ Fon kuruldu', 'success'); closeModal(); renderHedgeFon(); }
  else toast(r.msg, 'error');
};
window.hfInvestModal = function(k, min) {
  showModal('💹 Yatırım Yap', `<input type="number" id="hfAmt" placeholder="Tutar (min ₺${min})"><button class="btn-primary" onclick="hfInvestExec('${k}')">Yatır</button>`);
};
window.hfInvestExec = async function(k) {
  const a = parseFloat($('#hfAmt').value) || 0;
  const r = await investInHedgeFund(k, a);
  if (r.ok) { toast(`✅ ${r.shares.toFixed(4)} pay alındı`, 'success'); closeModal(); }
  else toast(r.msg, 'error');
};

/* ============================================================
   👷 ÇALIŞAN RENDER
   ============================================================ */
async function renderCalisan() {
  const main = $('#appMain');
  const emps = await dbGet('employees/' + GZ.uid) || {};
  let html = `<div class="page-head"><h2>👷 Çalışan Yönetimi</h2><p class="muted">Personel tut, maaş öde, verimliliği artır.</p></div>
    <div class="emp-positions">`;
  for (const p of EMPLOYEE_POSITIONS) {
    html += `<div class="empos-card">
      <div class="emp-emo">${p.emo}</div>
      <h3>${p.name}</h3>
      <div>Maaş: ₺${p.minSalary.toLocaleString('tr-TR')}-${p.maxSalary.toLocaleString('tr-TR')}</div>
      <div>Verim Bonus: +%${p.productivityBonus*100}</div>
      <button class="btn-mini buy" onclick="empHireModal('${p.code}', ${p.minSalary}, ${p.maxSalary})">İşe Al</button>
    </div>`;
  }
  html += '</div><h3 style="margin-top:20px">Çalışanlarım</h3><div class="emps-list">';
  for (const k of Object.keys(emps)) {
    const e = emps[k];
    html += `<div class="emp-row">
      <b>${e.name}</b> · ${e.positionName} · ₺${e.salary}/ay · Moral: ${e.morale}%
      ${e.onStrike ? ' 🚫 GREVDE' : ''}
      <button class="btn-mini sell" onclick="empFire('${k}')">Çıkar</button>
    </div>`;
  }
  html += '</div>';
  main.innerHTML = html;
}
window.renderCalisan = renderCalisan;
window.empHireModal = function(code, min, max) {
  showModal('👷 İşe Al', `<input type="number" id="empSal" placeholder="Maaş (₺${min}-${max})"><button class="btn-primary" onclick="empHireExec('${code}')">Al</button>`);
};
window.empHireExec = async function(code) {
  const s = parseFloat($('#empSal').value) || 0;
  const r = await hireEmployee(code, s);
  if (r.ok) { toast(`✅ İşe alındı: ${r.employee.name}`, 'success'); closeModal(); renderCalisan(); }
  else toast(r.msg, 'error');
};
window.empFire = async function(k) {
  if (!confirm('Tazminat (2 maaş) ödenecek. Onaylıyor musun?')) return;
  const r = await fireEmployee(k);
  if (r.ok) { toast(`✅ Çıkarıldı. Tazminat: ₺${r.severance.toLocaleString('tr-TR')}`, 'success'); renderCalisan(); }
  else toast(r.msg, 'error');
};

/* ============================================================
   🔬 AR-GE RENDER
   ============================================================ */
async function renderArge() {
  const main = $('#appMain');
  const research = await dbGet('rd_tech/' + GZ.uid) || {};
  let html = `<div class="page-head"><h2>🔬 Ar-Ge / Teknoloji Ağacı</h2><p class="muted">Yatırım yap, kalıcı bonus kazan.</p></div>
    <div class="tech-grid">`;
  for (const code of Object.keys(TECH_TREE)) {
    const t = TECH_TREE[code];
    const r = research[code];
    const status = r?.status || 'available';
    let badge = '';
    if (status === 'completed') badge = '<span class="badge ok">✅ Tamam</span>';
    else if (status === 'in_progress') {
      const remH = Math.max(0, Math.ceil((r.completesAt - Date.now()) / 3600000));
      badge = `<span class="badge prog">⏳ ${remH}sa</span>`;
    }
    html += `<div class="tech-card">
      <h3>${t.name} ${badge}</h3>
      <div class="muted">${t.desc}</div>
      <div>Maliyet: ₺${t.cost.toLocaleString('tr-TR')} · Süre: ${t.days} gün</div>
      ${t.prereq.length ? `<div class="muted">Önkoşul: ${t.prereq.map(p => TECH_TREE[p].name).join(', ')}</div>` : ''}
      ${status === 'available' ? `<button class="btn-mini buy" onclick="rdStart('${code}')">Başlat</button>` : ''}
    </div>`;
  }
  html += '</div>';
  main.innerHTML = html;
}
window.renderArge = renderArge;
window.rdStart = async function(c) {
  const r = await startResearch(c);
  if (r.ok) { toast('✅ Araştırma başlatıldı', 'success'); renderArge(); }
  else toast(r.msg, 'error');
};

/* ============================================================
   🎓 EĞİTİM RENDER
   ============================================================ */
async function renderEgitim() {
  const main = $('#appMain');
  const edu = await dbGet('education/' + GZ.uid) || {};
  let html = `<div class="page-head"><h2>🎓 Eğitim Merkezi</h2><p class="muted">Kurslar al, kalıcı yetenek bonusları kazan.</p></div>
    <div class="course-grid">`;
  for (const c of COURSES) {
    const e = edu[c.code];
    let badge = e?.status === 'completed' ? '✅' : e?.status === 'in_progress' ? '⏳' : '';
    html += `<div class="course-card">
      <h3>${badge} ${c.name}</h3>
      <div class="muted">${c.desc} · ${c.branch}</div>
      <div>₺${c.cost.toLocaleString('tr-TR')} · ${c.days} gün</div>
      ${!e ? `<button class="btn-mini buy" onclick="eduEnroll('${c.code}')">Kayıt Ol</button>` : ''}
    </div>`;
  }
  html += '</div>';
  main.innerHTML = html;
}
window.renderEgitim = renderEgitim;
window.eduEnroll = async function(c) {
  const r = await enrollCourse(c);
  if (r.ok) { toast('✅ Kayıt olundu', 'success'); renderEgitim(); }
  else toast(r.msg, 'error');
};

/* ============================================================
   📝 SÖZLEŞME RENDER
   ============================================================ */
async function renderSozlesme() {
  const main = $('#appMain');
  const cts = await dbGet('contracts') || {};
  const my = Object.entries(cts).filter(([k,c]) => c.creator === GZ.uid || c.target === GZ.uid);
  let html = `<div class="page-head"><h2>📝 Sözleşmeler</h2><p class="muted">Oyuncularla resmi ticaret anlaşmaları.</p></div>
    <button class="btn-secondary" onclick="contractCreateModal()">🆕 Yeni Sözleşme</button>
    <div class="contracts-list">`;
  for (const [k, c] of my) {
    html += `<div class="contract-row">
      <b>${c.type}</b> · ${c.creatorName||'?'} → ${c.target===GZ.uid?'SEN':'?'} · 
      <span class="badge ${c.status}">${c.status}</span>
      ${c.status === 'pending' && c.target === GZ.uid ? `<button class="btn-mini" onclick="ctAccept('${k}')">Kabul</button>` : ''}
    </div>`;
  }
  html += '</div>';
  main.innerHTML = html;
}
window.renderSozlesme = renderSozlesme;
window.contractCreateModal = function() {
  showModal('📝 Sözleşme Oluştur', `
    <input type="text" id="ctTarget" placeholder="Hedef oyuncu UID">
    <select id="ctType">
      <option value="tedarik">Tedarik</option>
      <option value="satis">Satış</option>
      <option value="ortak_yatirim">Ortak Yatırım</option>
    </select>
    <textarea id="ctTerms" placeholder="Şartlar (JSON veya açıklama)"></textarea>
    <button class="btn-primary" onclick="ctCreateExec()">Gönder</button>
  `);
};
window.ctCreateExec = async function() {
  await createContract($('#ctTarget').value, $('#ctType').value, { note: $('#ctTerms').value });
  toast('✅ Sözleşme önerildi', 'success'); closeModal();
};
window.ctAccept = async function(k) {
  const r = await acceptContract(k);
  if (r.ok) { toast('✅ Kabul edildi', 'success'); renderSozlesme(); }
  else toast(r.msg, 'error');
};

/* ============================================================
   🏛️ BELEDİYE RENDER
   ============================================================ */
async function renderBelediye() {
  const main = $('#appMain');
  const elections = await dbGet('city_mayor/elections') || {};
  let html = `<div class="page-head"><h2>🏛️ Belediye Seçimleri</h2><p class="muted">Şehirlerde belediye başkanı ol, vergi ayarla.</p></div>
    <div class="cities-list">`;
  const cities = (window.ILLER || []).slice(0, 15);
  for (const city of cities) {
    const el = elections[city];
    html += `<div class="city-row">
      <b>${city}</b>
      ${el ? `· Adaylar: ${Object.keys(el.candidates||{}).length}` : ''}
      <button class="btn-mini" onclick="mayorRunModal('${city}')">Aday Ol</button>
      ${el ? `<button class="btn-mini" onclick="mayorVoteModal('${city}')">Oy Ver</button>` : ''}
    </div>`;
  }
  html += '</div>';
  main.innerHTML = html;
}
window.renderBelediye = renderBelediye;
window.mayorRunModal = function(city) {
  showModal('🏛️ Aday Ol — ' + city, `
    <textarea id="mManif" placeholder="Vaadlerin (manifesto)"></textarea>
    <input type="number" id="mTax" placeholder="Vergi % (0-20)" step="0.5" max="20" min="0">
    <button class="btn-primary" onclick="mayorRunExec('${city}')">Aday Ol (₺50K)</button>
  `);
};
window.mayorRunExec = async function(city) {
  const r = await runForMayor(city, $('#mManif').value, parseFloat($('#mTax').value)/100);
  if (r.ok) { toast('✅ Aday oldun', 'success'); closeModal(); }
  else toast(r.msg, 'error');
};
window.mayorVoteModal = async function(city) {
  const el = await dbGet('city_mayor/elections/' + city);
  let html = `<h3>${city} - Adaylar</h3>`;
  for (const uid of Object.keys(el.candidates || {})) {
    const c = el.candidates[uid];
    html += `<div class="candidate"><b>${c.name}</b> · Vergi: %${(c.taxPolicy*100).toFixed(1)}<br>${c.manifesto}<br><button class="btn-mini" onclick="mayorVoteExec('${city}','${uid}')">Oy Ver</button></div>`;
  }
  showModal('🗳️ Oy Ver', html);
};
window.mayorVoteExec = async function(city, uid) {
  const r = await voteForMayor(city, uid);
  if (r.ok) { toast('✅ Oy verildi', 'success'); closeModal(); }
  else toast(r.msg, 'error');
};

/* ============================================================
   ⚔️ TİCARET SAVAŞI RENDER
   ============================================================ */
async function renderTicsavas() {
  const main = $('#appMain');
  const wars = await dbGet('trade_war/active') || {};
  let html = `<div class="page-head"><h2>⚔️ Ticaret Savaşları</h2><p class="muted">Rakiplere ekonomik baskı uygula.</p></div>
    <button class="btn-secondary" onclick="warDeclareModal()">⚔️ Savaş İlan Et</button>
    <div class="wars-list">`;
  for (const k of Object.keys(wars)) {
    const w = wars[k];
    html += `<div class="war-row"><b>${w.aggressorName}</b> ⚔️ → <b>${w.target}</b> · ${w.weapon} · ${w.status}</div>`;
  }
  html += '</div>';
  main.innerHTML = html;
}
window.renderTicsavas = renderTicsavas;
window.warDeclareModal = function() {
  showModal('⚔️ Ticaret Savaşı İlan Et', `
    <input type="text" id="warTarget" placeholder="Hedef UID">
    <select id="warWeapon">
      <option value="fiyat_dampingi">Fiyat Dampingi</option>
      <option value="boykot">Boykot</option>
      <option value="reklam_savasi">Reklam Savaşı</option>
      <option value="lobi">Lobi Faaliyeti</option>
    </select>
    <input type="number" id="warDays" placeholder="Süre (gün)" value="7">
    <button class="btn-primary" onclick="warDeclareExec()">İlan Et (₺100K)</button>
  `);
};
window.warDeclareExec = async function() {
  const r = await declareTradeWar($('#warTarget').value, parseInt($('#warDays').value), $('#warWeapon').value);
  if (r.ok) { toast('⚔️ Savaş ilan edildi', 'success'); closeModal(); renderTicsavas(); }
  else toast(r.msg, 'error');
};

/* ============================================================
   🤜 DÜELLO RENDER
   ============================================================ */
async function renderDuello() {
  const main = $('#appMain');
  const duels = await dbGet('duels/active') || {};
  let html = `<div class="page-head"><h2>🤜 Düello Arena</h2><p class="muted">1v1 ticaret düellosu. Bahis koyar, kim daha çok kar yapar.</p></div>
    <button class="btn-secondary" onclick="duelCreateModal()">🤜 Düello Çağrısı Yap</button>
    <div class="duels-list">`;
  for (const k of Object.keys(duels)) {
    const d = duels[k];
    html += `<div class="duel-row"><b>${d.creatorName}</b> 🤜 ${d.opponent===GZ.uid?'SEN':'?'} · Bahis: ₺${d.betAmount?.toLocaleString('tr-TR')} · ${d.status}
      ${d.status==='pending' && d.opponent===GZ.uid ? `<button class="btn-mini" onclick="duelAccept('${k}')">Kabul</button>` : ''}
    </div>`;
  }
  html += '</div>';
  main.innerHTML = html;
}
window.renderDuello = renderDuello;
window.duelCreateModal = function() {
  showModal('🤜 Düello', `
    <input type="text" id="duelOpp" placeholder="Rakip UID">
    <input type="number" id="duelBet" placeholder="Bahis (min ₺10K)">
    <input type="number" id="duelDur" placeholder="Süre dk (5-60)" value="15">
    <button class="btn-primary" onclick="duelCreateExec()">Çağrı Yap</button>
  `);
};
window.duelCreateExec = async function() {
  const r = await createDuel($('#duelOpp').value, parseFloat($('#duelBet').value), parseInt($('#duelDur').value));
  if (r.ok) { toast('🤜 Düello çağrısı gönderildi', 'success'); closeModal(); }
  else toast(r.msg, 'error');
};
window.duelAccept = async function(k) {
  const r = await acceptDuel(k);
  if (r.ok) { toast('🤜 Düello başladı!', 'success'); renderDuello(); }
  else toast(r.msg, 'error');
};

/* ============================================================
   🎭 AVATAR / 🎖️ UNVAN / 🎨 DEKORASYON
   ============================================================ */
async function renderAvatar() {
  const main = $('#appMain');
  const owned = await dbGet('users/' + GZ.uid + '/ownedAvatars') || {};
  let html = `<div class="page-head"><h2>🎭 Avatar Seç</h2><p class="muted">Karakterini seç, premium olanlar 💎 ile.</p></div><div class="avatar-grid">`;
  for (const a of AVATARS) {
    const has = owned[a.code] || a.cost === 0 && !a.premium;
    html += `<div class="av-card ${has?'owned':''}">
      <div class="av-emo">${a.emo}</div>
      <h3>${a.name}</h3>
      ${has ? `<button class="btn-mini" onclick="setAvatarUI('${a.code}')">Kullan</button>` :
        `<button class="btn-mini buy" onclick="buyAvatarUI('${a.code}')">${a.premium ? `${a.diamondCost} 💎` : `₺${a.cost.toLocaleString('tr-TR')}`}</button>`}
    </div>`;
  }
  html += '</div>';
  main.innerHTML = html;
}
window.renderAvatar = renderAvatar;
window.setAvatarUI = async function(c) { await setAvatar(c); toast('✅ Avatar değişti', 'success'); };
window.buyAvatarUI = async function(c) {
  const r = await buyAvatar(c);
  if (r.ok) { toast('✅ Alındı', 'success'); renderAvatar(); }
  else toast(r.msg, 'error');
};

async function renderUnvan() {
  const main = $('#appMain');
  let html = `<div class="page-head"><h2>🎖️ Unvanlar</h2><p class="muted">Şartları yerine getirdiğin unvanları kullan.</p></div><div class="title-grid">`;
  for (const t of TITLES) {
    html += `<div class="title-card" style="border-color:${t.color}">
      <h3 style="color:${t.color}">${t.name}</h3>
      <div class="muted">Şart: ${JSON.stringify(t.condition)}</div>
      <button class="btn-mini" onclick="setTitleUI('${t.code}')">Kullan</button>
    </div>`;
  }
  html += '</div>';
  main.innerHTML = html;
}
window.renderUnvan = renderUnvan;
window.setTitleUI = async function(c) { await setTitle(c); toast('✅ Unvan ayarlandı', 'success'); };

async function renderDekorasyon() {
  const main = $('#appMain');
  let html = `<div class="page-head"><h2>🎨 Dükkan Dekorasyonu</h2></div><div class="decor-grid">`;
  for (const d of DECORATIONS) {
    html += `<div class="decor-card">
      <h3>${d.name}</h3>
      <div class="muted">${d.desc}</div>
      <button class="btn-mini buy" onclick="buyDecorUI('${d.code}')">${d.diamondCost ? `${d.diamondCost} 💎` : `₺${d.cost.toLocaleString('tr-TR')}`}</button>
    </div>`;
  }
  html += '</div>';
  main.innerHTML = html;
}
window.renderDekorasyon = renderDekorasyon;
window.buyDecorUI = async function(c) {
  const r = await buyDecoration(c);
  if (r.ok) { toast('✅ Alındı', 'success'); renderDekorasyon(); }
  else toast(r.msg, 'error');
};

/* ============================================================
   🗺️ SEFER / ⭐ PRESTİJ / 🃏 KOLEKSİYON / 🗺️ HARİTA
   ============================================================ */
async function renderSefer() {
  const main = $('#appMain');
  const cur = await dbGet('expeditions/' + GZ.uid + '/current');
  let html = `<div class="page-head"><h2>🗺️ Seferler / Kampanyalar</h2><p class="muted">Uzun soluklu büyük görevler.</p></div>`;
  if (cur && cur.status === 'active') {
    const rem = Math.ceil((cur.endsAt - Date.now()) / 86400000);
    html += `<div class="expedition-active"><h3>${cur.emo} ${cur.name}</h3><div>Kalan: ${rem} gün</div></div>`;
  }
  html += '<div class="exp-grid">';
  for (const e of EXPEDITIONS) {
    html += `<div class="exp-card">
      <div class="exp-emo">${e.emo}</div>
      <h3>${e.name}</h3>
      <div>${e.days} gün · Ödül: ₺${e.reward.money.toLocaleString('tr-TR')} + ${e.reward.diamonds}💎 + ${e.reward.xp} XP</div>
      <ul>${e.goals.map(g => `<li>${g.desc}</li>`).join('')}</ul>
      <button class="btn-mini buy" onclick="seferStart('${e.code}')">Başlat</button>
    </div>`;
  }
  html += '</div>';
  main.innerHTML = html;
}
window.renderSefer = renderSefer;
window.seferStart = async function(c) {
  const r = await startExpedition(c);
  if (r.ok) { toast('🗺️ Sefer başladı', 'success'); renderSefer(); }
  else toast(r.msg, 'error');
};

async function renderPrestij() {
  const main = $('#appMain');
  const u = GZ.data;
  main.innerHTML = `<div class="page-head"><h2>⭐ Prestij Sistemi</h2><p class="muted">Lv 100 + ₺100M servete ulaştığında prestij kazan, kalıcı bonuslar al.</p></div>
    <div class="prestige-info">
      <h3>Mevcut Prestij: ${u?.prestige || 0}</h3>
      <div>Cash Çarpanı: ×${(1 + 0.05 * (u?.prestige || 0)).toFixed(2)}</div>
      <div>XP Çarpanı: ×${(1 + 0.10 * (u?.prestige || 0)).toFixed(2)}</div>
      ${(u?.level||1) >= 100 && (u?.netWorth||0) >= 100000000 ? 
        `<button class="btn-primary" onclick="prestijExec()">⭐ PRESTİJ AL</button>` : 
        `<div class="muted">Şartlar henüz yetersiz.</div>`}
    </div>`;
}
window.renderPrestij = renderPrestij;
window.prestijExec = async function() {
  if (!confirm('⚠️ Hesap sıfırlanacak (level, para, işletmeler) ama prestij + bonuslar kalır. Onaylıyor musun?')) return;
  const r = await attemptPrestige();
  if (r.ok) { toast(`⭐ Prestij ${r.newPrestige}!`, 'success', 6000); renderPrestij(); }
  else toast(r.msg, 'error');
};

async function renderKoleksiyon() {
  const main = $('#appMain');
  const owned = await dbGet('collectibles/owned/' + GZ.uid) || {};
  let html = `<div class="page-head"><h2>🃏 Koleksiyon Kartları</h2><p class="muted">Paket aç, nadir kart topla, takas et.</p></div>
    <div class="pack-buttons">
      <button class="btn-secondary" onclick="cardPackOpen('basic')">📦 Basic Paket (₺5K)</button>
      <button class="btn-secondary" onclick="cardPackOpen('premium')">💎 Premium Paket (₺25K)</button>
      <button class="btn-secondary" onclick="cardPackOpen('legendary')">👑 Legendary Paket (₺100K)</button>
    </div>
    <h3>Koleksiyonum (${Object.keys(owned).length} farklı kart)</h3>
    <div class="cards-grid">`;
  for (const c of COLLECTIBLE_CARDS) {
    const cnt = owned[c.id] || 0;
    if (cnt > 0) {
      html += `<div class="card-item ${c.rarity}" style="border-color:${RARITY_COLORS[c.rarity]}">
        <div class="ci-emo">${c.emo}</div>
        <h4>${c.name}</h4>
        <small>${c.rarity}</small>
        <div>Adet: ${cnt}</div>
      </div>`;
    }
  }
  html += '</div>';
  main.innerHTML = html;
}
window.renderKoleksiyon = renderKoleksiyon;
window.cardPackOpen = async function(type) {
  const r = await openCardPack(type);
  if (r.ok) {
    let txt = '🃏 Paket Açıldı:<br>';
    for (const c of r.drawn) txt += `<div style="color:${RARITY_COLORS[c.rarity]}">${c.emo} ${c.name} (${c.rarity})</div>`;
    showModal('🎉 Paket Açıldı', txt);
    setTimeout(renderKoleksiyon, 100);
  } else toast(r.msg, 'error');
};

async function renderHarita() {
  const main = $('#appMain');
  const regions = await dbGet('tr_map/regions') || {};
  let html = `<div class="page-head"><h2>🗺️ Türkiye Harita Modu</h2><p class="muted">Bölgelerin %50'sinde işletme = bölge sahipliği. Bölgede +%10 gelir bonus.</p></div>
    <div class="regions-grid">`;
  for (const r of TR_REGIONS) {
    const owned = regions[r.code];
    html += `<div class="region-card ${owned?'owned':''}">
      <h3>${r.name}</h3>
      <div class="muted">${r.cities.length} şehir</div>
      ${owned ? `<div>👑 Sahip: ${owned.ownerName}</div>` : 
        `<button class="btn-mini buy" onclick="regionClaim('${r.code}')">Bölgeyi Al (₺1M)</button>`}
    </div>`;
  }
  html += '</div>';
  main.innerHTML = html;
}
window.renderHarita = renderHarita;
window.regionClaim = async function(c) {
  const r = await claimRegion(c);
  if (r.ok) { toast('👑 Bölge alındı', 'success'); renderHarita(); }
  else toast(r.msg, 'error');
};

/* ============================================================
   ⚡ KURUCU PANELİ
   ============================================================ */
window.openFounderPanel = async function() {
  if (!window.GZ_IS_FOUNDER) { toast('Yetki yok', 'error'); return; }

  const statsR = await window.founderActions.getStats();
  const s = statsR.stats || {};

  showModal('⚡ KURUCU PANELİ', `
    <div class="founder-panel">
      <div class="fp-stats">
        <div class="fp-stat"><div class="fps-num">${s.totalUsers||0}</div><div class="fps-lbl">Oyuncu</div></div>
        <div class="fp-stat"><div class="fps-num">${s.onlineUsers||0}</div><div class="fps-lbl">Online</div></div>
        <div class="fp-stat"><div class="fps-num">₺${(s.totalMoney||0).toLocaleString('tr-TR')}</div><div class="fps-lbl">Toplam Para</div></div>
        <div class="fp-stat"><div class="fps-num">${s.bannedUsers||0}</div><div class="fps-lbl">Banlı</div></div>
        <div class="fp-stat"><div class="fps-num">${(s.avgLevel||0).toFixed(1)}</div><div class="fps-lbl">Ortalama Lv</div></div>
        <div class="fp-stat"><div class="fps-num">${s.founders||0}</div><div class="fps-lbl">Kurucular</div></div>
      </div>

      <div class="fp-section">
        <h3>📢 Global Duyuru</h3>
        <textarea id="fpBroadcast" placeholder="Tüm oyunculara bant olarak gözükecek mesaj"></textarea>
        <input type="number" id="fpBroadcastDur" placeholder="Süre (dakika)" value="30">
        <button class="btn-primary" onclick="fpDoBroadcast()">📢 Yayınla</button>
        <button class="btn-secondary" onclick="fpClearBroadcast()">🚫 Duyuruyu Kaldır</button>
      </div>

      <div class="fp-section">
        <h3>🔧 Bakım Modu</h3>
        <input type="text" id="fpMaintReason" placeholder="Sebep">
        <input type="text" id="fpMaintEta" placeholder="ETA (örn: 10 dk)">
        <button class="btn-primary" onclick="fpToggleMaint(true)">🔧 BAKIMA AL</button>
        <button class="btn-secondary" onclick="fpToggleMaint(false)">✅ Bakımdan Çıkar</button>
      </div>

      <div class="fp-section">
        <h3>👤 Kullanıcı İşlemleri</h3>
        <input type="text" id="fpUid" placeholder="Hedef Kullanıcı UID">
        <input type="number" id="fpAmount" placeholder="Miktar (₺ veya 💎 veya seviye)">
        <div class="fp-actions">
          <button class="btn-mini" onclick="fpGrantMoney()">💰 Para Ver</button>
          <button class="btn-mini" onclick="fpGrantDia()">💎 Elmas Ver</button>
          <button class="btn-mini" onclick="fpSetLv()">📊 Seviye Ayarla</button>
          <button class="btn-mini sell" onclick="fpBan()">🚫 Banla</button>
          <button class="btn-mini" onclick="fpUnban()">✅ Ban Kaldır</button>
        </div>
      </div>

      <div class="fp-section">
        <h3>📨 Tüm Oyunculara Bildirim</h3>
        <textarea id="fpNotif" placeholder="Bildirim mesajı"></textarea>
        <button class="btn-primary" onclick="fpSendNotif()">📨 Tüm Oyunculara Gönder</button>
      </div>
    </div>
  `);
};

window.fpDoBroadcast = async function() {
  const t = $('#fpBroadcast').value.trim();
  const d = parseInt($('#fpBroadcastDur').value) || 30;
  if (!t) return toast('Mesaj gerekli', 'error');
  const r = await window.founderActions.sendBroadcast(t, d);
  if (r.ok) toast('📢 Yayınlandı', 'success');
};
window.fpClearBroadcast = async function() { await window.founderActions.clearBroadcast(); toast('Kaldırıldı', 'success'); };
window.fpToggleMaint = async function(active) {
  await window.founderActions.toggleMaintenance(active, $('#fpMaintReason').value, $('#fpMaintEta').value);
  toast(active ? '🔧 Bakıma alındı' : '✅ Çıkarıldı', 'success');
};
window.fpGrantMoney = async function() {
  await window.founderActions.grantMoney($('#fpUid').value, parseFloat($('#fpAmount').value));
  toast('💰 Verildi', 'success');
};
window.fpGrantDia = async function() {
  await window.founderActions.grantDiamonds($('#fpUid').value, parseInt($('#fpAmount').value));
  toast('💎 Verildi', 'success');
};
window.fpSetLv = async function() {
  await window.founderActions.setLevel($('#fpUid').value, parseInt($('#fpAmount').value));
  toast('📊 Ayarlandı', 'success');
};
window.fpBan = async function() {
  if (!confirm('Banlamak istediğine emin misin?')) return;
  await window.founderActions.banUser($('#fpUid').value, 'Kurucu kararı');
  toast('🚫 Banlandı', 'success');
};
window.fpUnban = async function() {
  await window.founderActions.unbanUser($('#fpUid').value);
  toast('✅ Ban kaldırıldı', 'success');
};
window.fpSendNotif = async function() {
  const r = await window.founderActions.sendNotificationToAll($('#fpNotif').value, '📢');
  if (r.ok) toast(`📨 ${r.count} oyuncuya gönderildi`, 'success');
};


/* ╔══════════════════════════════════════════════════════════════════════════╗
   ║   🎨 v3.0 UI MODÜLÜ — Modaller, render fonksiyonları                     ║
   ╚══════════════════════════════════════════════════════════════════════════╝ */


/* ▼ 1. PARA TRANSFERİ MODAL'I */
window.openMoneyTransfer = function() {
  showModal('💸 Para Transferi', `
    <div class="muted small mb-12">
      Min Lv 5 · Komisyon %3 · Günlük Max ₺100.000
    </div>
    <div class="input-group">
      <label>👤 Hedef Kullanıcı UID</label>
      <input type="text" id="trUid" placeholder="Hedefin UID'si">
    </div>
    <div class="input-group">
      <label>💰 Tutar (₺)</label>
      <input type="number" id="trAmount" placeholder="Gönderilecek tutar">
    </div>
    <div class="input-group">
      <label>💬 Mesaj (Opsiyonel)</label>
      <input type="text" id="trMsg" maxlength="100" placeholder="Selamla...">
    </div>
    <div id="trPreview" class="trade-summary"></div>
    <button class="btn-primary" onclick="executeTransfer()" style="width:100%;margin-top:10px">💸 Gönder</button>
  `);

  setTimeout(() => {
    const a = document.getElementById('trAmount');
    if (a) a.addEventListener('input', () => {
      const amt = parseFloat(a.value) || 0;
      const fee = Math.floor(amt * 0.03);
      const total = amt + fee;
      const preview = document.getElementById('trPreview');
      if (preview) preview.innerHTML = amt > 0 ? `
        Gönderilecek: <b>${cashFmt(amt)}</b><br>
        Komisyon (%3): ${cashFmt(fee)}<br>
        <b>Toplam çekiliş: ${cashFmt(total)}</b>
      ` : '';
    });
  }, 100);
};

window.executeTransfer = async function() {
  const uid = document.getElementById('trUid').value.trim();
  const amt = parseFloat(document.getElementById('trAmount').value);
  const msg = document.getElementById('trMsg').value.trim();
  if (!uid) return toast('UID gir', 'error');
  if (!amt || amt <= 0) return toast('Geçerli tutar gir', 'error');

  const r = await transferMoney(uid, amt, msg);
  if (r.ok) {
    toast(`✅ ${cashFmt(amt)} gönderildi! (Komisyon: ${cashFmt(r.fee)})`, 'success', 5000);
    closeModal();
  } else {
    toast(r.msg, 'error');
  }
};


/* ▼ 2. İŞLEM GEÇMİŞİ MODAL'I */
window.openTxHistory = async function() {
  const log = await getTxLog(GZ.uid, 50);
  let html = '<h3>📜 Son İşlemler (50)</h3>';

  if (!log.length) {
    html += '<p class="muted">Henüz işlem yok</p>';
  } else {
    html += '<div class="tx-list">';
    for (const tx of log) {
      const date = new Date(tx.ts || 0).toLocaleString('tr-TR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' });
      const isIn = tx.type === 'in';
      html += `<div class="tx-row ${isIn?'tx-in':'tx-out'}">
        <div class="tx-date">${date}</div>
        <div class="tx-reason">${tx.reason || '—'}</div>
        <div class="tx-amount ${isIn?'green':'red'}">
          ${isIn?'+':'-'}${cashFmt(Math.abs(tx.amount||0))}
        </div>
      </div>`;
    }
    html += '</div>';
  }

  showModal('📜 İşlem Geçmişi', html);
};


/* ▼ 3. ÇARK ÇEVİRME MODAL'I */
window.openWheel = async function() {
  const canSpin = await canSpinWheel();
  showModal('🎡 Günlük Çark', `
    <div class="wheel-container">
      <div class="wheel-pointer">▼</div>
      <div class="wheel" id="wheelEl">
        ${WHEEL_PRIZES.map((p, i) => {
          const angle = (360 / WHEEL_PRIZES.length) * i;
          return `<div class="wheel-slice" style="background:${p.color};transform:rotate(${angle}deg)">
            <span>${p.label}</span>
          </div>`;
        }).join('')}
      </div>
    </div>
    <div class="tac mt-12 mb-8">
      ${canSpin ? '<p>Bugünkü ücretsiz çarkın hazır!</p>' : '<p class="red">Bugün çark çevirdin, yarın gel!</p>'}
    </div>
    <button class="btn-primary" id="wheelSpinBtn" onclick="executeWheelSpin()" style="width:100%" ${!canSpin?'disabled':''}>
      ${canSpin ? '🎡 ÇARKI ÇEVİR' : '⏳ Yarın Tekrar Gel'}
    </button>
    <div id="wheelResult" class="mg-result"></div>
  `);
};

window.executeWheelSpin = async function() {
  const btn = document.getElementById('wheelSpinBtn');
  const wheel = document.getElementById('wheelEl');
  const resultDiv = document.getElementById('wheelResult');
  if (!btn || !wheel) return;

  btn.disabled = true;
  btn.textContent = '🌀 Dönüyor...';

  // Sonuç al
  const r = await spinWheel();
  if (!r.ok) {
    btn.disabled = false;
    return toast(r.msg, 'warn');
  }

  // Animasyon
  const idx = WHEEL_PRIZES.findIndex(p => p.label === r.prize.label);
  const segmentAngle = 360 / WHEEL_PRIZES.length;
  const targetAngle = 360 * 5 + (360 - (idx * segmentAngle) - segmentAngle / 2);
  wheel.style.transition = 'transform 4s cubic-bezier(0.17, 0.67, 0.16, 1)';
  wheel.style.transform = `rotate(${targetAngle}deg)`;

  setTimeout(() => {
    let msg = '';
    if (r.prize.type === 'money') msg = `💰 +${cashFmt(r.prize.amount)} kazandın!`;
    else if (r.prize.type === 'diamond') msg = `💎 +${r.prize.amount} elmas kazandın!`;
    else if (r.prize.type === 'xp') msg = `⭐ +${r.prize.amount} XP kazandın!`;
    else msg = `😢 Bu sefer şanssızsın, yarın tekrar dene!`;

    resultDiv.innerHTML = `<div class="mg-win">${msg}</div>`;
    btn.textContent = '⏳ Yarın Tekrar Gel';
    if (r.prize.type !== 'nothing') toast(msg, 'success', 5000);
  }, 4200);
};


/* ▼ 4. PET MODAL'I */
window.openPetShop = async function() {
  const owned = await dbGet(`users/${GZ.uid}/pets`) || {};
  const active = await dbGet(`users/${GZ.uid}/activePet`);

  let html = '<h3>🐾 Pet Mağazası</h3><div class="pet-grid">';
  for (const p of PETS) {
    const isOwned = owned[p.id];
    const isActive = active === p.id;
    html += `<div class="pet-card ${isOwned?'owned':''} ${isActive?'active':''}">
      <div class="pet-emo">${p.emo}</div>
      <h4>${p.name}</h4>
      <div class="muted small">${p.desc}</div>
      ${isOwned ? `
        ${isActive
          ? '<div class="badge ok">✅ Aktif</div>'
          : `<button class="btn-mini" onclick="petActivate('${p.id}')">Aktifleştir</button>`}
        <button class="btn-mini" onclick="petFeed('${p.id}')">🍖 Besle (₺100)</button>
      ` : `
        <button class="btn-mini buy" onclick="petBuy('${p.id}')">
          ${p.diamondCost ? `${p.diamondCost}💎` : cashFmt(p.cost)}
        </button>
      `}
    </div>`;
  }
  html += '</div>';
  showModal('🐾 Pet Mağazası', html);
};

window.petBuy = async function(id) {
  const r = await buyPet(id);
  if (r.ok) { toast(`🎉 ${r.pet.name} satın aldın!`, 'success'); openPetShop(); }
  else toast(r.msg, 'error');
};

window.petActivate = async function(id) {
  const r = await setActivePet(id);
  if (r.ok) { toast('✅ Pet aktifleştirildi', 'success'); openPetShop(); }
  else toast(r.msg, 'error');
};

window.petFeed = async function(id) {
  const r = await feedPet(id);
  if (r.ok) toast('🍖 Pet beslendi', 'success');
  else toast(r.msg, 'error');
};


/* ▼ 5. REFERANS MODAL'I */
window.openReferral = async function() {
  const code = await generateReferralCode();
  const refCount = await dbGet(`users/${GZ.uid}/referralCount`) || 0;

  showModal('🎁 Referans Sistemi', `
    <div class="referral-banner">
      <h3>🎁 Arkadaşını Davet Et!</h3>
      <p>Sen: <b>+₺10.000 + 25💎</b> kazan</p>
      <p>Arkadaşın: <b>+₺5.000 + 10💎</b> kazansın</p>
    </div>

    <div class="ref-code-box">
      <div class="rc-label">Senin kodun:</div>
      <div class="rc-code" onclick="navigator.clipboard.writeText('${code}').then(()=>toast('📋 Kod kopyalandı','success'))">
        ${code}
      </div>
      <div class="muted small">Tıkla kopyala</div>
    </div>

    <div class="ref-stats">
      <div class="rs-num">${refCount}</div>
      <div class="rs-lbl">Davet edilen oyuncu</div>
    </div>

    <hr>
    <h4>Bir kod kullanmak ister misin?</h4>
    <p class="muted small">Sadece ilk 7 gün, tek kullanımlık</p>
    <input type="text" id="refUseCode" placeholder="Kod gir...">
    <button class="btn-secondary" onclick="useRefUI()" style="width:100%">Kodu Kullan</button>
  `);
};

window.useRefUI = async function() {
  const c = document.getElementById('refUseCode').value;
  const r = await useReferralCode(c);
  if (r.ok) { toast('🎁 Bonus alındı!', 'success', 5000); closeModal(); }
  else toast(r.msg, 'error');
};


/* ▼ 6. DASHBOARD MODAL'I */
window.openDashboard = async function() {
  const stats = await getDashboardStats();
  if (!stats) return toast('Veri alınamadı', 'error');

  showModal('📊 Genel Görünüm', `
    <div class="dash-grid">
      <div class="dash-card primary">
        <div class="dc-label">💎 Net Değer</div>
        <div class="dc-value">${cashFmt(stats.netWorth)}</div>
      </div>
      <div class="dash-card">
        <div class="dc-label">💰 Cüzdan</div>
        <div class="dc-value">${cashFmt(stats.cash)}</div>
      </div>
      <div class="dash-card">
        <div class="dc-label">🏦 Banka</div>
        <div class="dc-value">${cashFmt(stats.bank)}</div>
      </div>
      ${stats.debt > 0 ? `
      <div class="dash-card debt">
        <div class="dc-label">💳 Borç</div>
        <div class="dc-value red">${cashFmt(stats.debt)}</div>
      </div>` : ''}
      <div class="dash-card">
        <div class="dc-label">📈 Bu Hafta</div>
        <div class="dc-value ${stats.weekProfit>=0?'green':'red'}">
          ${stats.weekProfit>=0?'+':''}${cashFmt(stats.weekProfit)}
        </div>
        <div class="dc-sub">Gelir: ${cashFmt(stats.weekIn)}<br>Gider: ${cashFmt(stats.weekOut)}</div>
      </div>
      <div class="dash-card">
        <div class="dc-label">🏢 İşletmeler</div>
        <div class="dc-value">${stats.businesses.total}</div>
        <div class="dc-sub">
          🏪${stats.businesses.shops} 🌱${stats.businesses.gardens}
          🐄${stats.businesses.farms} 🏭${stats.businesses.factories}
          ⛏️${stats.businesses.mines}
        </div>
      </div>
    </div>
    <div style="display:flex;gap:8px;margin-top:12px">
      <button class="btn-secondary" onclick="openTxHistory()" style="flex:1">📜 İşlem Geçmişi</button>
      <button class="btn-secondary" onclick="openWeeklyGoal()" style="flex:1">🎯 Haftalık Hedef</button>
    </div>
  `);
};


/* ▼ 7. HAFTALIK HEDEF MODAL'I */
window.openWeeklyGoal = async function() {
  const goal = await getWeeklyGoal();

  if (!goal) {
    showModal('🎯 Haftalık Hedef Belirle', `
      <p class="muted">Bu hafta için bir kazanç hedefi belirle. Tamamlarsan bonus alırsın!</p>
      <div class="input-group">
        <label>Hedef tutar (Min ₺1.000)</label>
        <input type="number" id="goalAmount" placeholder="₺50000">
      </div>
      <button class="btn-primary" onclick="setWeeklyGoalUI()" style="width:100%">Hedef Belirle</button>
    `);
  } else {
    const progress = Math.min(100, ((goal.progress || 0) / goal.target) * 100);
    showModal('🎯 Haftalık Hedef', `
      <div class="weekly-goal">
        <div class="wg-target">Hedef: ${cashFmt(goal.target)}</div>
        <div class="wg-progress">${cashFmt(goal.progress || 0)} / ${cashFmt(goal.target)}</div>
        <div class="wg-bar">
          <div class="wg-bar-fill" style="width:${progress}%"></div>
        </div>
        <div class="wg-percent">${progress.toFixed(1)}%</div>
        ${progress >= 100 ? '<div class="wg-done">✅ TAMAMLANDI! Bonus kazanıldı.</div>' : ''}
      </div>
    `);
  }
};

window.setWeeklyGoalUI = async function() {
  const v = parseFloat(document.getElementById('goalAmount').value);
  const r = await setWeeklyGoal(v);
  if (r.ok) { toast('🎯 Hedef belirlendi!', 'success'); openWeeklyGoal(); }
  else toast(r.msg, 'error');
};


/* ▼ 8. PROFİL DÜZENLEME (gelişmiş) */
window.openEditProfile = async function() {
  const u = GZ.data;
  showModal('✏️ Profili Düzenle', `
    <div class="input-group">
      <label>📝 Bio (max 200 karakter)</label>
      <textarea id="pfBio" maxlength="200" rows="3" placeholder="Kendinden bahset...">${u.bio || ''}</textarea>
    </div>
    <div class="input-group">
      <label>🎨 Banner Rengi</label>
      <input type="color" id="pfBanner" value="${u.bannerColor || '#3b82f6'}">
    </div>
    <div class="input-group">
      <label><input type="checkbox" id="pfShowBank" ${u.showBank?'checked':''}> 🏦 Banka bakiyemi göster</label>
    </div>
    <div class="input-group">
      <label><input type="checkbox" id="pfShowStats" ${u.showStats!==false?'checked':''}> 📊 İstatistiklerimi göster</label>
    </div>
    <button class="btn-primary" onclick="saveProfile()" style="width:100%">💾 Kaydet</button>
  `);
};

window.saveProfile = async function() {
  await updateProfile({
    bio: document.getElementById('pfBio').value,
    bannerColor: document.getElementById('pfBanner').value,
    showBank: document.getElementById('pfShowBank').checked,
    showStats: document.getElementById('pfShowStats').checked
  });
  toast('✅ Profil kaydedildi', 'success');
  closeModal();
};

/* ═══ KREDİ SİSTEMİ — 10 Banka (Oyuncu Görünümü) ═══ */
async function renderKredi(){
  const main=$('#appMain');
  main.innerHTML='<div style="padding:40px;text-align:center"><div class="spinner" style="margin:0 auto"></div></div>';
  const not=typeof window.getKrediNotu==='function'?await window.getKrediNotu(GZ.uid):100;
  const limit=typeof window.getKrediLimit==='function'?window.getKrediLimit(not):1000;
  const borc=(await dbGet('bank/'+GZ.uid+'/loan'))||0;
  const kalan=Math.max(0,limit-borc);
  const renk=not>=80?'#22c55e':not>=60?'#f59e0b':not>=40?'#f97316':'#ef4444';
  const etiket=not>=80?'Mükemmel':not>=60?'İyi':not>=40?'Orta':'Düşük';
  const bankalar=window.BANKALAR||[];
  const minNot=window.KREDI_MIN_NOT||40;
  // DB'den güncel faiz oranlarını çek
  const dbFaizler=(await dbGet('system/bankFaizler'))||{};
  const basvurular={};
  for(const b of bankalar){const bas=await dbGet('krediBasvurular/'+GZ.uid+'_'+b.id);if(bas)basvurular[b.id]=bas;}

  const cards=bankalar.map(b=>{
    const curFaiz=dbFaizler[b.id]||b.faiz;
    const bas=basvurular[b.id];
    const bLimit=Math.floor(limit*(b.maxKat||2));
    const bKalan=Math.max(0,bLimit-borc);
    const canApp=(!bas||bas.durum==='reddedildi')&&bKalan>0&&not>=minNot;
    let badge='';
    if(bas){
      if(bas.durum==='beklemede') badge='<div style="color:#f59e0b;font-size:11px;margin-top:3px">⏳ Başvuru beklemede...</div>';
      else if(bas.durum==='onaylandi') badge='<div style="color:#22c55e;font-size:11px;margin-top:3px">✅ Onaylandı (+₺'+((bas.miktar||0).toLocaleString())+')</div>';
      else badge='<div style="color:#ef4444;font-size:11px;margin-top:3px">❌ Reddedildi</div>';
    }
    const btnHtml=canApp?'<div style="display:flex;gap:8px;margin-top:10px">'+
      '<input type="number" id="bas_'+b.id+'" placeholder="Miktar (₺)" min="100" max="'+bKalan+'" style="flex:1;padding:10px;border-radius:8px;border:1px solid var(--border,#e5e7eb);background:var(--bg,#fff);color:var(--text,#111);font-size:14px">'+
      '<button style="padding:10px 14px;background:'+b.color+';border:none;border-radius:8px;color:#fff;font-weight:700;cursor:pointer" onclick="window._uiBasvur(\''+b.id+'\')">📋 Başvur</button>'+
      '</div>':(!bas||bas.durum==='reddedildi')?'<div style="text-align:center;color:#ef4444;font-size:11px;padding:6px 0">'+(not<minNot?'❌ Kredi notun yetersiz (min '+minNot+')':'⚠️ Limit yok')+'</div>':'';
    return '<div class="card" style="border-left:4px solid '+b.color+';margin-bottom:10px">'+
      '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">'+
        '<span style="font-size:26px">'+b.logo+'</span>'+
        '<div style="flex:1"><div style="font-weight:700;font-size:14px">'+b.name+'</div>'+
        '<div style="font-size:11px;color:#64748b">'+b.info+'</div>'+badge+'</div>'+
        '<div style="text-align:right"><div style="font-size:10px;color:#64748b">FAİZ</div><div style="font-weight:700;color:'+b.color+'">%'+(curFaiz*100).toFixed(2)+'</div>'+
        '<div style="font-size:9px;color:#475569">yıllık</div></div>'+
      '</div>'+
      '<div style="display:flex;justify-content:space-between;font-size:12px;color:#64748b;margin-bottom:6px">'+
        '<span>Max limit: <b style="color:var(--text)">'+cashFmt(bLimit)+'</b></span>'+
        '<span>Haftalık: <b style="color:#f59e0b">₺'+(1000*curFaiz/52).toFixed(2)+'</b>/1000₺</span>'+
        '<span>Kalan: <b style="color:#3b82f6">'+cashFmt(bKalan)+'</b></span>'+
      '</div>'+
      btnHtml+'</div>';
  }).join('');

  main.innerHTML=
    '<div class="page-title">💳 Kredi Sistemi</div>'+
    // Kredi notu
    '<div class="card" style="background:linear-gradient(135deg,#0f172a,#1e293b);border:1px solid #334155;margin-bottom:12px">'+
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">'+
        '<div><div style="color:#94a3b8;font-size:11px;letter-spacing:1px">KREDİ NOTUN</div>'+
        '<div style="font-size:44px;font-weight:900;color:'+renk+';line-height:1">'+not+'</div>'+
        '<div style="font-size:12px;color:#64748b">/ 100 · <span style="color:'+renk+'">'+etiket+'</span></div></div>'+
        '<span style="font-size:42px">'+(not>=80?'⭐':not>=60?'✅':not>=40?'⚠️':'❌')+'</span>'+
      '</div>'+
      '<div style="background:#1e3a5f;border-radius:8px;padding:2px;margin-bottom:12px">'+
        '<div style="background:'+renk+';height:10px;border-radius:8px;width:'+not+'%"></div></div>'+
      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">'+
        '<div style="background:#0f172a;border-radius:8px;padding:10px;text-align:center"><div style="color:#64748b;font-size:10px">TEMEL LİMİT</div><div style="color:#e2e8f0;font-weight:700">'+cashFmt(limit)+'</div></div>'+
        '<div style="background:#0f172a;border-radius:8px;padding:10px;text-align:center"><div style="color:#64748b;font-size:10px">MEVCUT BORÇ</div><div style="color:'+(borc>0?'#ef4444':'#22c55e')+';font-weight:700">'+cashFmt(borc)+'</div></div>'+
        '<div style="background:#0f172a;border-radius:8px;padding:10px;text-align:center"><div style="color:#64748b;font-size:10px">KALAN</div><div style="color:#3b82f6;font-weight:700">'+cashFmt(kalan)+'</div></div>'+
      '</div></div>'+
    // Borç ödeme
    (borc>0?'<div class="card" style="background:#1c1917;border:1px solid #78350f;margin-bottom:12px">'+
      '<div class="card-title" style="color:#fbbf24">⚠️ Borcunu Öde — Her ödeme notu artırır!</div>'+
      '<div class="input-group"><input type="number" id="krediOdemeInp" placeholder="Miktar (₺)" max="'+borc+'"></div>'+
      '<div style="display:flex;gap:6px;margin-bottom:10px">'+
        '<button class="btn-primary" style="flex:1;background:#92400e;padding:8px;font-size:12px" onclick="document.getElementById(\'krediOdemeInp\').value='+Math.floor(borc*0.25)+'">%25</button>'+
        '<button class="btn-primary" style="flex:1;background:#92400e;padding:8px;font-size:12px" onclick="document.getElementById(\'krediOdemeInp\').value='+Math.floor(borc*0.5)+'">%50</button>'+
        '<button class="btn-primary" style="flex:1;background:#92400e;padding:8px;font-size:12px" onclick="document.getElementById(\'krediOdemeInp\').value='+borc+'">TÜMÜ</button>'+
      '</div>'+
      '<button class="btn-primary" style="width:100%;background:#d97706" onclick="window._uiKrediOde()">✅ Borç Öde</button></div>':'') +
    '<div style="font-size:12px;font-weight:700;color:var(--text-muted);margin:16px 0 8px;letter-spacing:.5px">🏦 10 BANKA — KREDİ BAŞVURUSU</div>'+
    cards+
    '<div class="card" style="background:#0c1a2e;border:1px solid #1e3a5f">'+
      '<div style="font-size:12px;color:#64748b">💡 Başvuruyu yetkili onaylar. Çevrimdışıysa AI asistan 8dk içinde değerlendirir. Ödedikçe notun artar → limit yükselir.</div></div>';
}
window.renderKredi=renderKredi;

window._uiBasvur=async function(bankaId){
  const inp=document.getElementById('bas_'+bankaId);
  const m=parseInt(inp?.value);
  if(!m||m<=0) return toast('Geçerli miktar gir','error');
  if(typeof window.krediBasvuruYap==='function'){await window.krediBasvuruYap(bankaId,m);renderKredi();}
  else toast('Kredi sistemi yüklenmedi','error');
};
window._uiKrediOde=async function(){
  const m=parseInt(document.getElementById('krediOdemeInp')?.value);
  if(!m||m<=0) return toast('Geçerli miktar gir','error');
  if(typeof bankRepay!=='function') return toast('bankRepay bulunamadı','error');
  const ok=await bankRepay(m);
  if(ok){
    if(typeof window.updateKrediNotu==='function') await window.updateKrediNotu(GZ.uid,Math.min(5,Math.floor(m/200)));
    renderKredi();
  }
};

/* Oyuncu vergi görünümü */
async function renderVergiOyuncu(){
  const main=$('#appMain');
  main.innerHTML='<div style="padding:40px;text-align:center"><div class="spinner" style="margin:0 auto"></div></div>';
  let v=null;
  if(typeof window.getVergiDetay==='function') v=await window.getVergiDetay(GZ.uid).catch(()=>null);
  if(!v){main.innerHTML='<div class="page-title">🏛️ Vergi Bilgisi</div><div class="card"><p>Vergi bilgisi yüklenemedi.</p></div>';return;}
  main.innerHTML='<div class="page-title">🏛️ Vergi & Faiz</div>'+
    '<div class="card" style="background:#1c1917;border:1px solid #78350f;margin-bottom:12px">'+
      '<div class="card-title" style="color:#fbbf24">🏛️ Haftalık Vergi (Cumartesi Tahsil)</div>'+
      '<div style="line-height:2;font-size:14px">'+
        (v.shopTax>0?'<div style="display:flex;justify-content:space-between"><span>🏪 Dükkan vergisi</span><b style="color:#f59e0b">'+cashFmt(v.shopTax)+'</b></div>':'')+
        (v.gardenTax>0?'<div style="display:flex;justify-content:space-between"><span>🌱 Bahçe vergisi</span><b style="color:#f59e0b">'+cashFmt(v.gardenTax)+'</b></div>':'')+
        (v.farmTax>0?'<div style="display:flex;justify-content:space-between"><span>🐄 Çiftlik vergisi</span><b style="color:#f59e0b">'+cashFmt(v.farmTax)+'</b></div>':'')+
        (v.factoryTax>0?'<div style="display:flex;justify-content:space-between"><span>🏭 Fabrika vergisi</span><b style="color:#f59e0b">'+cashFmt(v.factoryTax)+'</b></div>':'')+
        (v.mineTax>0?'<div style="display:flex;justify-content:space-between"><span>⛏️ Maden vergisi</span><b style="color:#f59e0b">'+cashFmt(v.mineTax)+'</b></div>':'')+
        (v.gelirVer>0?'<div style="display:flex;justify-content:space-between"><span>💰 Gelir vergisi</span><b style="color:#f59e0b">'+cashFmt(v.gelirVer)+'</b></div>':'')+
        '<div style="border-top:1px solid var(--border);margin-top:8px;padding-top:8px;display:flex;justify-content:space-between;font-weight:700"><span>TOPLAM</span><b style="color:#f59e0b">'+cashFmt(v.totalVergi)+'</b></div>'+
      '</div></div>'+
    (v.weeklyFaiz>0?'<div class="card" style="margin-bottom:12px">'+
      '<div class="card-title">💳 Kredi Faizi (Haftalık)</div>'+
      '<div style="display:flex;justify-content:space-between;font-size:14px"><span>Toplam borç: <b>'+cashFmt(v.loan)+'</b></span><span>Faiz: <b>%'+(v.bankaFaiz*100).toFixed(2)+'</b> yıllık</span></div>'+
      '<div style="display:flex;justify-content:space-between;font-size:14px;margin-top:8px;font-weight:700"><span>Haftalık faiz ödemesi</span><b style="color:#22c55e">'+cashFmt(v.weeklyFaiz)+'</b></div>'+
      '</div>':'') +
    '<div class="card" style="background:#0c1a2e;border:1px solid #1e3a5f">'+
      '<div style="font-size:12px;color:#64748b">🏦 Tüm vergiler ve faizler <b>Karakaş Merkez Bankası</b>\'na (yetkili hesabına) her cumartesi otomatik yatırılır.</div></div>';
}
window.renderVergiOyuncu=renderVergiOyuncu;
