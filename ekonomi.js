/* ═══════════════════════════════════════════════════════════
   EKONOMİ — Borsa, Kripto, Banka, Üretim, Müzayede
   ═══════════════════════════════════════════════════════════ */
(function() {

  // ═══════════════════════════════════════
  //  BORSA (Hisse Senedi)
  // ═══════════════════════════════════════

  const STOCKS = {
    GZA: { name: 'GameZone A.Ş.',    icon: '🎮', price: 1250, change: 2.4,  sector: 'Teknoloji' },
    TRD: { name: 'Ticaret A.Ş.',     icon: '💼', price: 580,  change: -1.2, sector: 'Finans' },
    ENJ: { name: 'Enerji Holding',    icon: '⚡', price: 890,  change: 0.8,  sector: 'Enerji' },
    FAR: { name: 'Tarım Koop.',      icon: '🌾', price: 320,  change: 3.1,  sector: 'Tarım' },
    INS: { name: 'İnşaat A.Ş.',      icon: '🏗️', price: 740,  change: -0.5, sector: 'İnşaat' },
    MET: { name: 'Metal San.',        icon: '⚙️', price: 1100, change: 1.7,  sector: 'Sanayi' },
    FIN: { name: 'Finans Bank A.Ş.', icon: '🏦', price: 2200, change: -2.3, sector: 'Finans' },
    TEK: { name: 'Teknoloji Ltd.',    icon: '💻', price: 4500, change: 5.2,  sector: 'Teknoloji' },
    SAG: { name: 'Sağlık A.Ş.',      icon: '💊', price: 670,  change: 0.3,  sector: 'Sağlık' },
    LOJ: { name: 'Lojistik A.Ş.',    icon: '🚛', price: 430,  change: -1.8, sector: 'Ulaşım' },
  };

  let stockPrices = { ...STOCKS };
  let stockInterval = null;

  window.loadBorsa = async function() {
    // Firebase'den fiyatları yükle (çok oyunculu senkronizasyon)
    const saved = await dbGet('economy/stocks');
    if (saved) {
      Object.entries(saved).forEach(([ticker, d]) => {
        if (stockPrices[ticker]) {
          stockPrices[ticker].price  = d.price  ?? STOCKS[ticker].price;
          stockPrices[ticker].change = d.change ?? 0;
        }
      });
    } else {
      // İlk kez: varsayılan fiyatları kaydet
      const init = {};
      Object.entries(STOCKS).forEach(([t, s]) => { init[t] = { price: s.price, change: s.change }; });
      dbSet('economy/stocks', init);
    }
    renderStockList();
    if (!stockInterval) {
      stockInterval = setInterval(updateStockPrices, 8000);
    }
  };

  function renderStockList() {
    const el = document.getElementById('stockList');
    if (!el) return;
    el.innerHTML = Object.entries(stockPrices).map(([ticker, s]) => `
      <div class="stock-item" onclick="openStockDetail('${ticker}')">
        <div class="stock-ticker">${ticker}</div>
        <div style="font-size:1.2rem;width:30px">${s.icon}</div>
        <div class="stock-name">${s.name}<br><span style="font-size:.72rem;color:var(--text3)">${s.sector}</span></div>
        <div class="stock-price" id="sp_${ticker}">${formatMoney(s.price)}</div>
        <div class="stock-change ${s.change >= 0 ? 'change-up' : 'change-down'}" id="sc_${ticker}">
          ${s.change >= 0 ? '▲' : '▼'} ${Math.abs(s.change).toFixed(2)}%
        </div>
      </div>`).join('');
  }

  function updateStockPrices() {
    const updates = {};
    Object.keys(stockPrices).forEach(ticker => {
      const s = stockPrices[ticker];
      const change = (Math.random() - 0.48) * 4;
      s.change = parseFloat(change.toFixed(2));
      s.price  = Math.max(10, parseFloat((s.price * (1 + change / 100)).toFixed(0)));
      updates[`economy/stocks/${ticker}/price`]  = s.price;
      updates[`economy/stocks/${ticker}/change`] = s.change;

      const priceEl  = document.getElementById(`sp_${ticker}`);
      const changeEl = document.getElementById(`sc_${ticker}`);
      if (priceEl) {
        priceEl.textContent = formatMoney(s.price);
        priceEl.classList.remove('flash-up', 'flash-down');
        void priceEl.offsetWidth;
        priceEl.classList.add(change >= 0 ? 'flash-up' : 'flash-down');
      }
      if (changeEl) {
        changeEl.textContent = `${change >= 0 ? '▲' : '▼'} ${Math.abs(change).toFixed(2)}%`;
        changeEl.className   = `stock-change ${change >= 0 ? 'change-up' : 'change-down'}`;
      }
    });
    db.ref().update(updates); // Firebase'e kaydet (fire & forget)
  }

  window.openStockDetail = async function(ticker) {
    const s = stockPrices[ticker];
    if (!s) return;
    document.getElementById('sdTicker').textContent = ticker;
    document.getElementById('sdName').textContent   = s.name;
    document.getElementById('sdIcon').textContent   = s.icon;
    document.getElementById('sdPrice').textContent  = formatMoney(s.price);
    document.getElementById('sdChange').textContent = `${s.change >= 0 ? '▲' : '▼'} ${Math.abs(s.change).toFixed(2)}%`;
    document.getElementById('sdChange').className   = s.change >= 0 ? 'change-up' : 'change-down';
    document.getElementById('sdSector').textContent = s.sector;
    document.getElementById('sdKey').value = ticker;

    // Portföy
    const held = (await dbGet(`users/${window.ME.uid}/portfolio/${ticker}`)) || 0;
    document.getElementById('sdHeld').textContent = held + ' adet';
    document.getElementById('sdHeldVal').textContent = formatMoney(held * s.price);

    openModal('stockDetailModal');
  };

  window.buyStock = async function() {
    const ticker = document.getElementById('sdKey').value;
    const qty    = parseInt(document.getElementById('sdBuyQty').value) || 1;
    const s      = stockPrices[ticker];
    if (!s) return;
    const total = s.price * qty;
    try {
      await spendCash(window.ME.uid, total, `${ticker} hisse alım`);
      await db.ref(`users/${window.ME.uid}/portfolio/${ticker}`).transaction(v => (v || 0) + qty);
      await addXP(window.ME.uid, 10);
      await updateMissionProgress(window.ME.uid, 'trade5', 1);
      await updateMissionProgress(window.ME.uid, 'trade25', 1);
      toast(`${qty}x ${ticker} hissesi alındı — ${formatMoney(total)} ✅`, 'success');
      openStockDetail(ticker);
    } catch(e) { toast(e.message, 'error'); }
  };

  window.sellStock = async function() {
    const ticker = document.getElementById('sdKey').value;
    const qty    = parseInt(document.getElementById('sdSellQty').value) || 1;
    const s      = stockPrices[ticker];
    if (!s) return;
    const held = (await dbGet(`users/${window.ME.uid}/portfolio/${ticker}`)) || 0;
    if (held < qty) { toast('Yeterli hissesin yok', 'error'); return; }
    const total = s.price * qty;
    try {
      await db.ref(`users/${window.ME.uid}/portfolio/${ticker}`).transaction(v => (v || 0) - qty);
      await addCash(window.ME.uid, total, `${ticker} hisse satım`);
      await addXP(window.ME.uid, 10);
      toast(`${qty}x ${ticker} hissesi satıldı — ${formatMoney(total)} 💰`, 'success');
      openStockDetail(ticker);
    } catch(e) { toast(e.message, 'error'); }
  };

  window.loadPortfolio = async function() {
    const uid  = window.ME.uid;
    const port = await dbGet(`users/${uid}/portfolio`);
    const el   = document.getElementById('portfolioList');
    if (!el) return;
    if (!port) { el.innerHTML = '<div class="empty-state"><div class="empty-icon">📊</div><p>Portföyün boş</p></div>'; return; }

    let totalVal = 0;
    const rows = Object.entries(port).filter(([, q]) => q > 0).map(([ticker, qty]) => {
      const s = stockPrices[ticker] || { name: ticker, price: 0, change: 0 };
      const val = s.price * qty;
      totalVal += val;
      return `<tr>
        <td><strong>${ticker}</strong></td>
        <td>${s.name || '?'}</td>
        <td>${qty}</td>
        <td>${formatMoney(s.price)}</td>
        <td>${formatMoney(val)}</td>
        <td class="${(s.change || 0) >= 0 ? 'change-up' : 'change-down'}">${(s.change || 0) >= 0 ? '▲' : '▼'} ${Math.abs(s.change || 0).toFixed(2)}%</td>
      </tr>`;
    });

    el.innerHTML = `<div style="margin-bottom:12px;font-size:.9rem;color:var(--text2)">
      Toplam Portföy Değeri: <strong style="color:var(--green)">${formatMoney(totalVal)}</strong>
    </div>
    <div class="table-wrap"><table>
      <thead><tr><th>Ticker</th><th>Şirket</th><th>Adet</th><th>Fiyat</th><th>Değer</th><th>Değişim</th></tr></thead>
      <tbody>${rows.join('')}</tbody>
    </table></div>`;
  };

  // ═══════════════════════════════════════
  //  KRİPTO
  // ═══════════════════════════════════════

  const CRYPTOS = {
    GZC: { name: 'GameZone Coin',  icon: '🎮', price: 850,    change: 4.2 },
    TRK: { name: 'TürkCoin',       icon: '🇹🇷', price: 12.5,  change: -1.8 },
    BTC: { name: 'Bitcoin',        icon: '₿',   price: 1850000, change: 2.1 },
    ETH: { name: 'Ethereum',       icon: '⟠',   price: 95000,  change: -0.9 },
    SOL: { name: 'Solana',         icon: '◎',   price: 4200,   change: 6.3 },
    DOG: { name: 'Dogecoin',       icon: '🐕', price: 35,     change: 8.7 },
  };

  let cryptoPrices = { ...CRYPTOS };
  let cryptoInterval = null;

  window.loadKripto = async function() {
    // Firebase'den fiyatları yükle
    const saved = await dbGet('economy/crypto');
    if (saved) {
      Object.entries(saved).forEach(([sym, d]) => {
        if (cryptoPrices[sym]) {
          cryptoPrices[sym].price  = d.price  ?? CRYPTOS[sym].price;
          cryptoPrices[sym].change = d.change ?? 0;
        }
      });
    } else {
      const init = {};
      Object.entries(CRYPTOS).forEach(([sym, c]) => { init[sym] = { price: c.price, change: c.change }; });
      dbSet('economy/crypto', init);
    }
    renderCryptoList();
    if (!cryptoInterval) {
      cryptoInterval = setInterval(updateCryptoPrices, 5000);
    }
  };

  function renderCryptoList() {
    const el = document.getElementById('cryptoList');
    if (!el) return;
    el.innerHTML = Object.entries(cryptoPrices).map(([sym, c]) => `
      <div class="stock-item" onclick="openCryptoDetail('${sym}')">
        <div class="stock-ticker" style="font-size:1.3rem">${c.icon}</div>
        <div class="stock-name">${c.name}<br><span style="font-size:.72rem;color:var(--text3)">${sym}</span></div>
        <div class="stock-price" id="cp_${sym}">${formatMoney(c.price)}</div>
        <div class="stock-change ${c.change >= 0 ? 'change-up' : 'change-down'}" id="cc_${sym}">
          ${c.change >= 0 ? '▲' : '▼'} ${Math.abs(c.change).toFixed(2)}%
        </div>
      </div>`).join('');
  }

  function updateCryptoPrices() {
    const updates = {};
    Object.keys(cryptoPrices).forEach(sym => {
      const c = cryptoPrices[sym];
      const change = (Math.random() - 0.47) * 8;
      c.change = parseFloat(change.toFixed(2));
      c.price  = Math.max(0.01, parseFloat((c.price * (1 + change / 100)).toFixed(2)));
      updates[`economy/crypto/${sym}/price`]  = c.price;
      updates[`economy/crypto/${sym}/change`] = c.change;
      const pe = document.getElementById(`cp_${sym}`);
      const ce = document.getElementById(`cc_${sym}`);
      if (pe) { pe.textContent = formatMoney(c.price); pe.classList.remove('flash-up','flash-down'); void pe.offsetWidth; pe.classList.add(change>=0?'flash-up':'flash-down'); }
      if (ce) { ce.textContent = `${change>=0?'▲':'▼'} ${Math.abs(change).toFixed(2)}%`; ce.className = `stock-change ${change>=0?'change-up':'change-down'}`; }
    });
    db.ref().update(updates);
  }

  window.openCryptoDetail = async function(sym) {
    const c = cryptoPrices[sym];
    if (!c) return;
    document.getElementById('cdSym').textContent    = sym;
    document.getElementById('cdName').textContent   = c.name;
    document.getElementById('cdIcon').textContent   = c.icon;
    document.getElementById('cdPrice').textContent  = formatMoney(c.price);
    document.getElementById('cdChange').textContent = `${c.change >= 0 ? '▲' : '▼'} ${Math.abs(c.change).toFixed(2)}%`;
    document.getElementById('cdChange').className   = c.change >= 0 ? 'change-up' : 'change-down';
    document.getElementById('cdKey').value = sym;
    const held = parseFloat(await dbGet(`users/${window.ME.uid}/crypto/${sym}`) || 0);
    document.getElementById('cdHeld').textContent    = held.toFixed(4) + ' ' + sym;
    document.getElementById('cdHeldVal').textContent = formatMoney(held * c.price);
    openModal('cryptoDetailModal');
  };

  window.buyCrypto = async function() {
    const sym   = document.getElementById('cdKey').value;
    const spend = parseFloat(document.getElementById('cdBuyAmount').value) || 0;
    const c     = cryptoPrices[sym];
    if (!c || spend <= 0) { toast('Geçersiz miktar', 'error'); return; }
    const qty = spend / c.price;
    try {
      await spendCash(window.ME.uid, spend, `${sym} kripto alım`);
      await db.ref(`users/${window.ME.uid}/crypto/${sym}`).transaction(v => (parseFloat(v) || 0) + qty);
      await addXP(window.ME.uid, 10);
      toast(`${qty.toFixed(4)} ${sym} satın alındı — ${formatMoney(spend)} ✅`, 'success');
      openCryptoDetail(sym);
    } catch(e) { toast(e.message, 'error'); }
  };

  window.sellCrypto = async function() {
    const sym  = document.getElementById('cdKey').value;
    const qty  = parseFloat(document.getElementById('cdSellQty').value) || 0;
    const c    = cryptoPrices[sym];
    if (!c || qty <= 0) { toast('Geçersiz miktar', 'error'); return; }
    const held = parseFloat(await dbGet(`users/${window.ME.uid}/crypto/${sym}`) || 0);
    if (held < qty) { toast('Yetersiz kripto bakiyesi', 'error'); return; }
    const total = qty * c.price;
    try {
      await db.ref(`users/${window.ME.uid}/crypto/${sym}`).transaction(v => Math.max(0, (parseFloat(v) || 0) - qty));
      await addCash(window.ME.uid, total, `${sym} kripto satım`);
      await addXP(window.ME.uid, 10);
      toast(`${qty} ${sym} satıldı — ${formatMoney(total)} 💰`, 'success');
      openCryptoDetail(sym);
    } catch(e) { toast(e.message, 'error'); }
  };

  // ═══════════════════════════════════════
  //  BANKA
  // ═══════════════════════════════════════

  window.loadBanka = async function() {
    const uid  = window.ME.uid;
    const u    = window.ME;
    document.getElementById('bankCash').textContent  = formatMoney(u.cash  || 0);
    document.getElementById('bankSaving').textContent= formatMoney(u.bank  || 0);

    const loans = await dbGet(`users/${uid}/loans`);
    const loanEl = document.getElementById('loanList');
    if (loanEl) {
      if (!loans) {
        loanEl.innerHTML = '<div style="color:var(--text2);font-size:.85rem">Aktif kredin yok</div>';
      } else {
        loanEl.innerHTML = Object.entries(loans).map(([key, loan]) => `
          <div class="listing-item" style="margin-bottom:8px">
            <div class="listing-icon">🏦</div>
            <div class="listing-info">
              <div class="listing-name">${formatMoney(loan.amount)} kredi</div>
              <div class="listing-meta">%${loan.interest} faiz • ${timeAgo(loan.takenAt)}</div>
            </div>
            <div class="listing-right">
              <div class="listing-price" style="color:var(--red)">${formatMoney(loan.remaining)}</div>
              <button class="btn btn-success btn-sm" onclick="repayLoan('${key}')">Öde</button>
            </div>
          </div>`).join('');
      }
    }
    loadTransactionHistory();
  };

  window.deposit = async function() {
    const amt = parseFloat(document.getElementById('depositAmt').value) || 0;
    if (amt <= 0) { toast('Geçerli miktar girin', 'error'); return; }
    const uid = window.ME.uid;
    try {
      await spendCash(uid, amt, 'Banka yatırımı');
      await db.ref(`users/${uid}/bank`).transaction(v => (v || 0) + amt);
      await updateMissionProgress(uid, 'bank10k', amt);
      await addXP(uid, 5);
      toast(`${formatMoney(amt)} yatırıldı ✅`, 'success');
      document.getElementById('depositAmt').value = '';
      loadBanka();
    } catch(e) { toast(e.message, 'error'); }
  };

  window.withdraw = async function() {
    const amt = parseFloat(document.getElementById('withdrawAmt').value) || 0;
    if (amt <= 0) { toast('Geçerli miktar girin', 'error'); return; }
    const uid  = window.ME.uid;
    const bank = await dbGet(`users/${uid}/bank`) || 0;
    if (bank < amt) { toast('Yeterli banka bakiyesi yok', 'error'); return; }
    try {
      await db.ref(`users/${uid}/bank`).transaction(v => (v || 0) - amt);
      await addCash(uid, amt, 'Banka çekimi');
      toast(`${formatMoney(amt)} çekildi ✅`, 'success');
      document.getElementById('withdrawAmt').value = '';
      loadBanka();
    } catch(e) { toast(e.message, 'error'); }
  };

  window.takeLoan = async function() {
    const amt  = parseFloat(document.getElementById('loanAmt').value) || 0;
    const uid  = window.ME.uid;
    if (amt < 1000) { toast('Minimum kredi 1.000 ₺', 'error'); return; }
    if (amt > 500000) { toast('Maximum kredi 500.000 ₺', 'error'); return; }

    const existingLoans = await dbGet(`users/${uid}/loans`);
    if (existingLoans && Object.keys(existingLoans).length >= 3) {
      toast('En fazla 3 aktif kredin olabilir', 'error'); return;
    }

    const interest = amt >= 100000 ? 12 : amt >= 50000 ? 15 : 18;
    const total    = Math.round(amt * (1 + interest / 100));

    if (!confirm(`${formatMoney(amt)} kredi alacaksın.\n%${interest} faizle geri ödeme: ${formatMoney(total)}\nOnaylıyor musun?`)) return;

    try {
      await dbPush(`users/${uid}/loans`, {
        amount: amt, interest, remaining: total,
        takenAt: Date.now()
      });
      await addCash(uid, amt, `${formatMoney(amt)} kredi çekildi`);
      toast(`${formatMoney(amt)} kredi hesabına yatırıldı ✅`, 'success');
      document.getElementById('loanAmt').value = '';
      loadBanka();
    } catch(e) { toast(e.message, 'error'); }
  };

  window.repayLoan = async function(loanKey) {
    const uid  = window.ME.uid;
    const loan = await dbGet(`users/${uid}/loans/${loanKey}`);
    if (!loan) { toast('Kredi bulunamadı', 'error'); return; }
    if (!confirm(`${formatMoney(loan.remaining)} ödeyerek krediyi kapatmak istiyor musun?`)) return;
    try {
      await spendCash(uid, loan.remaining, 'Kredi geri ödemesi');
      await db.ref(`users/${uid}/loans/${loanKey}`).remove();
      toast('Kredi kapatıldı ✅', 'success');
      loadBanka();
    } catch(e) { toast(e.message, 'error'); }
  };

  async function loadTransactionHistory() {
    const uid  = window.ME.uid;
    const snap = await dbGet(`users/${uid}/transactions`);
    const el   = document.getElementById('bankTxHistory');
    if (!el) return;
    if (!snap) { el.innerHTML = '<div style="color:var(--text2);font-size:.85rem;padding:10px 0">İşlem geçmişi yok</div>'; return; }
    const items = Object.values(snap).reverse().slice(0, 15);
    el.innerHTML = `<div class="table-wrap"><table>
      <thead><tr><th>Tür</th><th>Açıklama</th><th>Tutar</th><th>Tarih</th></tr></thead>
      <tbody>${items.map(t => `<tr>
        <td>${t.type === 'gelir' ? '💰' : '💸'}</td>
        <td>${t.reason || '—'}</td>
        <td class="${t.amount >= 0 ? 'change-up' : 'change-down'}">${t.amount >= 0 ? '+' : ''}${formatMoney(t.amount)}</td>
        <td style="color:var(--text2);font-size:.78rem">${timeAgo(t.time)}</td>
      </tr>`).join('')}
      </tbody></table></div>`;
  }

  // ═══════════════════════════════════════
  //  ÜRETİM (Fabrika, Çiftlik, Maden)
  // ═══════════════════════════════════════

  const PRODUCTION_TYPES = {
    farm: {
      name: 'Çiftlik',
      icon: '🌾',
      slots: [
        { id: 'tahil',  name: 'Tahıl',  icon: '🌾', time: 30, cost: 50,   output: 'tahil',  qty: 10 },
        { id: 'sut',    name: 'Süt',    icon: '🥛', time: 60, cost: 80,   output: 'sut',    qty: 5  },
        { id: 'yumurta',name: 'Yumurta',icon: '🥚', time: 45, cost: 60,   output: 'yumurta',qty: 8  },
        { id: 'balik',  name: 'Balık',  icon: '🐟', time: 90, cost: 120,  output: 'balik',  qty: 4  },
      ]
    },
    factory: {
      name: 'Fabrika',
      icon: '🏭',
      slots: [
        { id: 'kiyafet', name: 'Kıyafet',  icon: '👕', time: 120, cost: 300,  output: 'kiyafet', qty: 3 },
        { id: 'mobilya', name: 'Mobilya',  icon: '🪑', time: 180, cost: 500,  output: 'mobilya', qty: 2 },
        { id: 'plastik', name: 'Plastik',  icon: '♻️', time: 60,  cost: 150,  output: 'plastik', qty: 8 },
        { id: 'cam',     name: 'Cam',      icon: '🪟', time: 90,  cost: 200,  output: 'cam',     qty: 5 },
      ]
    },
    mine: {
      name: 'Maden',
      icon: '⛏️',
      slots: [
        { id: 'demir',  name: 'Demir',  icon: '⚙️', time: 60,  cost: 200,  output: 'demir',  qty: 5  },
        { id: 'bakir',  name: 'Bakır',  icon: '🔶', time: 90,  cost: 350,  output: 'bakir',  qty: 3  },
        { id: 'altin',  name: 'Altın',  icon: '🥇', time: 240, cost: 1500, output: 'altin',  qty: 1  },
        { id: 'komur',  name: 'Kömür',  icon: '🖤', time: 45,  cost: 120,  output: 'komur',  qty: 8  },
      ]
    },
  };

  window.loadUretim = function() {
    const tabs = ['farm', 'factory', 'mine'];
    tabs.forEach(type => renderProductionSlots(type));
  };

  async function renderProductionSlots(type) {
    const config  = PRODUCTION_TYPES[type];
    const uid     = window.ME.uid;
    const ongoing = await dbGet(`users/${uid}/production/${type}`) || {};
    const el      = document.getElementById(`prod_${type}`);
    if (!el) return;

    const now = Date.now();
    el.innerHTML = config.slots.map(slot => {
      const job = ongoing[slot.id];
      const inProgress = job && job.finishAt > now;
      const ready      = job && job.finishAt <= now && !job.collected;
      return `<div class="production-card">
        <div class="p-icon">${slot.icon}</div>
        <div class="p-name">${slot.name}</div>
        <div class="p-info">Maliyet: ${formatMoney(slot.cost)} • Çıktı: ${slot.qty}x</div>
        ${inProgress ? `
          <div class="production-progress">
            <div style="font-size:.78rem;color:var(--text2);margin-bottom:4px" id="ptxt_${type}_${slot.id}">⏳ Üretiliyor...</div>
            <div class="prog-bar"><div class="prog-fill" id="pfill_${type}_${slot.id}" style="width:0%"></div></div>
          </div>` :
        ready ? `
          <div style="color:var(--green);font-size:.85rem;margin-top:8px">✅ Hazır!</div>
          <button class="btn btn-success btn-sm p-btn" onclick="collectProduction('${type}','${slot.id}')">🎁 Topla</button>` :
        `<button class="btn btn-primary btn-sm p-btn" onclick="startProduction('${type}','${slot.id}',${slot.time},${slot.cost},'${slot.output}',${slot.qty})">Üret</button>`}
      </div>`;
    }).join('');

    // Progress bar güncelleyici
    config.slots.forEach(slot => {
      const job = ongoing[slot.id];
      if (!job || job.finishAt <= now) return;
      updateProgressBar(type, slot.id, job.startAt, job.finishAt);
    });
  }

  function updateProgressBar(type, slotId, startAt, finishAt) {
    const interval = setInterval(() => {
      const now   = Date.now();
      const total = finishAt - startAt;
      const elapsed = now - startAt;
      const pct   = Math.min(100, (elapsed / total) * 100);
      const fill  = document.getElementById(`pfill_${type}_${slotId}`);
      const txt   = document.getElementById(`ptxt_${type}_${slotId}`);
      if (!fill) { clearInterval(interval); return; }
      fill.style.width = pct + '%';
      const remaining = Math.max(0, Math.ceil((finishAt - now) / 1000));
      if (txt) txt.textContent = remaining > 60 ? `⏳ ${Math.ceil(remaining/60)} dk kaldı` : `⏳ ${remaining} sn kaldı`;
      if (now >= finishAt) { clearInterval(interval); renderProductionSlots(type); }
    }, 1000);
  }

  window.startProduction = async function(type, slotId, timeMin, cost, outputId, qty) {
    const uid = window.ME.uid;
    const existing = await dbGet(`users/${uid}/production/${type}/${slotId}`);
    if (existing && existing.finishAt > Date.now()) { toast('Bu slotta üretim sürüyor', 'error'); return; }
    try {
      await spendCash(uid, cost, `${type} üretim başlatma`);
      const now = Date.now();
      await dbSet(`users/${uid}/production/${type}/${slotId}`, {
        startAt: now, finishAt: now + timeMin * 1000,
        outputId, qty, collected: false
      });
      await updateMissionProgress(uid, 'produce5', 1);
      toast('Üretim başladı ✅', 'success');
      renderProductionSlots(type);
    } catch(e) { toast(e.message, 'error'); }
  };

  window.collectProduction = async function(type, slotId) {
    const uid = window.ME.uid;
    const job = await dbGet(`users/${uid}/production/${type}/${slotId}`);
    if (!job || job.collected) { toast('Toplanacak bir şey yok', 'error'); return; }
    if (job.finishAt > Date.now()) { toast('Üretim henüz tamamlanmadı', 'error'); return; }
    try {
      await addItem(uid, job.outputId, job.qty);
      await db.ref(`users/${uid}/production/${type}/${slotId}`).remove();
      await addXP(uid, 20);
      const catalog = window.ITEM_CATALOG || {};
      const item = catalog[job.outputId] || { name: job.outputId };
      toast(`${job.qty}x ${item.name} toplandı! ✅`, 'success');
      renderProductionSlots(type);
    } catch(e) { toast(e.message, 'error'); }
  };

  // ═══════════════════════════════════════
  //  MÜZAYEDEler
  // ═══════════════════════════════════════

  const AUCTION_ITEMS = [
    { id: 'a1', name: 'Nadir Altın Kılıç',  icon: '⚔️',  startPrice: 5000,  duration: 3600000 },
    { id: 'a2', name: 'Efsanevi Araba',      icon: '🏎️',  startPrice: 80000, duration: 7200000 },
    { id: 'a3', name: 'Nadir Elmas',         icon: '💎',  startPrice: 10000, duration: 1800000 },
    { id: 'a4', name: 'Antika Vazo',         icon: '🏺',  startPrice: 2000,  duration: 3600000 },
    { id: 'a5', name: 'Altın Tablo',         icon: '🖼️',  startPrice: 15000, duration: 5400000 },
  ];

  window.loadMuzayede = async function() {
    const el = document.getElementById('auctionGrid');
    if (!el) return;

    // Müzayedeleri başlat (yoksa)
    for (const item of AUCTION_ITEMS) {
      const existing = await dbGet(`auctions/${item.id}`);
      if (!existing || existing.endAt < Date.now()) {
        await dbSet(`auctions/${item.id}`, {
          ...item, currentBid: item.startPrice, bidder: null, bidderName: 'Yok',
          endAt: Date.now() + item.duration, active: true
        });
      }
    }

    const snap = await dbGet('auctions');
    if (!snap) { el.innerHTML = '<div class="empty-state"><p>Müzayede yok</p></div>'; return; }

    el.innerHTML = Object.entries(snap).filter(([,a]) => a.active).map(([key, a]) => {
      const remaining = Math.max(0, a.endAt - Date.now());
      return `<div class="auction-card" id="acard_${key}">
        <div class="auction-icon">${a.icon}</div>
        <div class="auction-name">${a.name}</div>
        <div class="auction-current" id="abid_${key}">${formatMoney(a.currentBid)}</div>
        <div class="auction-bids">En yüksek teklif: ${a.bidderName || 'Yok'}</div>
        <div class="auction-timer" id="atimer_${key}">⏱️ ${formatCountdown(remaining)}</div>
        <div style="display:flex;gap:6px;margin-top:12px;justify-content:center">
          <input type="number" id="abidAmt_${key}" placeholder="${Math.ceil(a.currentBid * 1.05)}"
            style="width:100px;padding:6px 8px;background:var(--bg3);border:1px solid var(--border);
              border-radius:6px;color:var(--text);font-size:.82rem" />
          <button class="btn btn-primary btn-sm" onclick="placeBid('${key}')">Teklif Ver</button>
        </div>
      </div>`;
    }).join('');

    // Sayaç güncelle
    startAuctionTimers(Object.keys(snap));
  };

  function formatCountdown(ms) {
    if (ms <= 0) return 'Sona erdi';
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return `${h > 0 ? h + 's ' : ''}${m}d ${s}sn`;
  }

  function startAuctionTimers(keys) {
    keys.forEach(key => {
      const timerEl = document.getElementById(`atimer_${key}`);
      if (!timerEl) return;
      const interval = setInterval(async () => {
        const a = await dbGet(`auctions/${key}`);
        if (!a) { clearInterval(interval); return; }
        const rem = Math.max(0, a.endAt - Date.now());
        timerEl.textContent = '⏱️ ' + formatCountdown(rem);
        if (rem <= 0) {
          clearInterval(interval);
          timerEl.textContent = '🏁 Sona erdi!';
          if (a.bidder && a.bidder !== 'claimed') {
            await dbUpdate(`auctions/${key}`, { active: false });
          }
        }
      }, 1000);
    });
  }

  window.placeBid = async function(key) {
    const uid  = window.ME.uid;
    const amt  = parseFloat(document.getElementById(`abidAmt_${key}`)?.value) || 0;
    const snap = await dbGet(`auctions/${key}`);
    if (!snap) { toast('Müzayede bulunamadı', 'error'); return; }
    if (snap.endAt < Date.now()) { toast('Bu müzayede sona erdi', 'error'); return; }
    if (amt <= snap.currentBid) { toast(`Minimum teklif: ${formatMoney(Math.ceil(snap.currentBid * 1.05))}`, 'error'); return; }
    if (snap.bidder === uid) { toast('Zaten en yüksek teklif sende', 'error'); return; }

    try {
      // Önceki teklif sahibine para iade
      if (snap.bidder) {
        await addCash(snap.bidder, snap.currentBid, 'Müzayede teklifi iade');
      }
      await spendCash(uid, amt, `Müzayede teklifi: ${snap.name}`);
      await dbUpdate(`auctions/${key}`, {
        currentBid: amt, bidder: uid, bidderName: window.ME.username
      });
      await updateMissionProgress(uid, 'auction1', 1);
      await addXP(uid, 15);
      document.getElementById(`abid_${key}`).textContent = formatMoney(amt);
      toast(`Teklif verildi: ${formatMoney(amt)} ✅`, 'success');
    } catch(e) { toast(e.message, 'error'); }
  };

  console.log('%c[Ekonomi] ✅ Borsa, Kripto, Banka, Üretim, Müzayede yüklendi', 'color:#22c55e;font-weight:bold');
})();
/* ═══════════════════════════════════════════════════════════
   SOHBET — Global, Ticaret, Yerel kanallar
   ═══════════════════════════════════════════════════════════ */
(function() {

  let currentChannel = 'global';
  let chatListener   = null;

  window.loadChat = function() {
    switchChannel(currentChannel);
  };

  window.switchChannel = function(channel) {
    const prevChannel = currentChannel;
    currentChannel = channel;
    document.querySelectorAll('.chat-channel-btn').forEach(b =>
      b.classList.toggle('active', b.dataset.channel === channel)
    );

    // Önceki listener'ı kaldır
    if (chatListener) {
      db.ref(`chat/${prevChannel}`).off('value', chatListener);
      chatListener = null;
    }

    const msgEl = document.getElementById('chatMessages');
    if (msgEl) msgEl.innerHTML = '<div style="text-align:center;color:var(--text2);padding:20px">⏳ Yükleniyor...</div>';

    // Son 50 mesajı dinle
    chatListener = db.ref(`chat/${channel}`)
      .orderByChild('time')
      .limitToLast(50)
      .on('value', snap => {
        if (!msgEl) return;
        if (!snap.exists()) {
          msgEl.innerHTML = '<div style="text-align:center;color:var(--text2);padding:20px">Henüz mesaj yok. İlk mesajı sen gönder! 💬</div>';
          return;
        }
        const messages = [];
        snap.forEach(child => messages.push({ key: child.key, ...child.val() }));
        renderMessages(messages, msgEl);
      });
  };

  function renderMessages(messages, el) {
    const myUid = window.ME.uid;
    el.innerHTML = messages.map(m => {
      const isOwn = m.uid === myUid;
      return `<div class="chat-msg ${isOwn ? 'own' : ''}">
        <div class="chat-avatar">${m.avatar || m.username?.[0]?.toUpperCase() || '?'}</div>
        <div>
          ${!isOwn ? `<div class="chat-name">${m.username || 'Anonim'} ${m.role === 'admin' ? '⚡' : ''}</div>` : ''}
          <div class="chat-bubble">
            ${escapeHtml(m.text)}
            ${m.type === 'trade' ? `<div style="margin-top:4px;font-size:.72rem;color:var(--gold)">💼 Ticaret Teklifi</div>` : ''}
          </div>
          <div class="chat-time">${timeAgo(m.time)}</div>
        </div>
      </div>`;
    }).join('');
    el.scrollTop = el.scrollHeight;
  }

  window.sendChatMessage = async function() {
    const input = document.getElementById('chatInput');
    const text  = input?.value?.trim();
    if (!text || text.length > 500) { toast('Mesaj 1-500 karakter arasında olmalı', 'error'); return; }

    const u = window.ME;
    // Ban kontrolü
    if (u?.banned) { toast('Hesabın banlı, mesaj gönderemezsin', 'error'); return; }
    const ref = db.ref(`chat/${currentChannel}`);

    // Flood koruması (3 sn)
    const recentSnap = await db.ref(`chat/${currentChannel}`)
      .orderByChild('uid').equalTo(u.uid)
      .limitToLast(1)
      .once('value');

    if (recentSnap.exists()) {
      let lastTime = 0;
      recentSnap.forEach(c => { lastTime = c.val().time; });
      if (Date.now() - lastTime < 3000) { toast('Çok hızlı mesaj gönderiyorsun! Bekle...', 'warning'); return; }
    }

    try {
      await dbPush(`chat/${currentChannel}`, {
        text,
        uid:      u.uid,
        username: u.username,
        avatar:   u.avatar || u.username?.[0]?.toUpperCase() || '?',
        role:     u.role || 'user',
        time:     serverTime()
      });

      // Eski mesajları temizle (son 200'ü tut)
      const countSnap = await db.ref(`chat/${currentChannel}`).once('value');
      if (countSnap.numChildren() > 200) {
        const keys = [];
        countSnap.forEach(c => keys.push(c.key));
        const toDelete = keys.slice(0, keys.length - 200);
        const updates = {};
        toDelete.forEach(k => updates[`chat/${currentChannel}/${k}`] = null);
        await db.ref().update(updates);
      }

      input.value = '';
      await addXP(u.uid, 2);
      await updateMissionProgress(u.uid, 'chat20', 1);
    } catch(e) { toast('Mesaj gönderilemedi: ' + e.message, 'error'); }
  };

  // Enter ile gönder
  document.addEventListener('keydown', function(e) {
    const input = document.getElementById('chatInput');
    if (e.key === 'Enter' && document.activeElement === input) {
      sendChatMessage();
    }
  });

  // HTML escape
  function escapeHtml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
      .replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener" style="color:var(--accent)">$1</a>');
  }

  // Emoji picker toggle
  window.toggleEmojiPicker = function() {
    const EMOJIS = ['😀','😂','🎉','🔥','💰','🚀','🏆','💎','❤️','👍','😎','🤑','💪','🎮','⚡','🌟','🤝','😅'];
    const picker = document.getElementById('emojiPicker');
    if (!picker) return;
    if (picker.innerHTML) { picker.innerHTML = ''; return; }
    picker.innerHTML = EMOJIS.map(e =>
      `<span onclick="addEmoji('${e}')" style="cursor:pointer;font-size:1.3rem;padding:2px">${e}</span>`
    ).join('');
  };

  window.addEmoji = function(emoji) {
    const input = document.getElementById('chatInput');
    if (input) { input.value += emoji; input.focus(); }
    document.getElementById('emojiPicker').innerHTML = '';
  };

  console.log('%c[Chat] ✅ Sohbet modülü yüklendi', 'color:#22c55e;font-weight:bold');
})();
/* ═══════════════════════════════════════════════════════════
   ADMİN PANELİ — Kullanıcı yönetimi, ekonomi kontrolü
   ═══════════════════════════════════════════════════════════ */
(function() {

  window.loadAdmin = async function() {
    const u = window.ME;
    if (!u || u.role !== 'admin') {
      document.getElementById('page-admin').innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🔒</div>
          <h3>Erişim Engellendi</h3>
          <p>Bu sayfaya sadece yetkililer erişebilir</p>
        </div>`;
      return;
    }
    loadAdminStats();
    loadUserList();
  };

  async function loadAdminStats() {
    const usersSnap = await dbGet('users');
    const chatSnap  = await dbGet('chat/global');
    const pazarSnap = await dbGet('pazar');

    const users    = usersSnap ? Object.keys(usersSnap).length : 0;
    const messages = chatSnap  ? Object.keys(chatSnap).length  : 0;
    const listings = pazarSnap ? Object.values(pazarSnap).filter(v => v.status === 'active').length : 0;

    let totalCash = 0;
    if (usersSnap) Object.values(usersSnap).forEach(u => { totalCash += (u.cash || 0) + (u.bank || 0); });

    document.getElementById('adminStatUsers')?.setAttribute('data-val', users);
    const statsEls = [
      { id: 'adminStatUsers',    val: users },
      { id: 'adminStatMessages', val: messages },
      { id: 'adminStatListings', val: listings },
      { id: 'adminStatCash',     val: formatMoney(totalCash) },
    ];
    statsEls.forEach(s => {
      const el = document.getElementById(s.id);
      if (el) el.textContent = s.val;
    });
  }

  async function loadUserList() {
    const el = document.getElementById('adminUserList');
    if (!el) return;
    el.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text2)">⏳ Yükleniyor...</div>';

    const snap = await dbGet('users');
    if (!snap) { el.innerHTML = '<div class="empty-state"><p>Kullanıcı yok</p></div>'; return; }

    const search = document.getElementById('adminUserSearch')?.value?.toLowerCase() || '';
    const users  = Object.values(snap)
      .filter(u => !search || u.username?.toLowerCase().includes(search))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      .slice(0, 100);

    el.innerHTML = `<div class="table-wrap"><table>
      <thead><tr><th>Kullanıcı</th><th>Seviye</th><th>Kasa</th><th>Banka</th><th>Rol</th><th>Kayıt</th><th>İşlem</th></tr></thead>
      <tbody>${users.map(u => `<tr class="user-row">
        <td>
          <div style="display:flex;align-items:center;gap:8px">
            <div style="width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,var(--accent),var(--purple));
              display:flex;align-items:center;justify-content:center;font-size:.75rem;font-weight:700;color:#fff">
              ${u.avatar || u.username?.[0]?.toUpperCase() || '?'}
            </div>
            <div>
              <div style="font-weight:600;font-size:.88rem">${u.username || 'Anonim'}</div>
              <div style="font-size:.72rem;color:var(--text3)">${u.email || 'misafir'}</div>
            </div>
          </div>
        </td>
        <td>Sv.${u.level || 1}</td>
        <td class="change-up">${formatMoney(u.cash || 0)}</td>
        <td>${formatMoney(u.bank || 0)}</td>
        <td><span class="badge ${u.banned ? 'badge-red' : u.role === 'admin' ? 'badge-purple' : u.isAnonymous ? 'badge-yellow' : 'badge-blue'}">${u.banned ? '🔨 banned' : u.role || 'user'}</span></td>
        <td style="color:var(--text2);font-size:.78rem">${u.createdAt ? timeAgo(u.createdAt) : '?'}</td>
        <td>
          <button class="btn btn-ghost btn-sm" onclick="adminManageUser('${u.uid}')">Yönet</button>
        </td>
      </tr>`).join('')}
      </tbody></table></div>`;
  }

  window.adminSearchUsers = function() { loadUserList(); };

  window.adminManageUser = async function(uid) {
    const u = await dbGet(`users/${uid}`);
    if (!u) { toast('Kullanıcı bulunamadı', 'error'); return; }

    document.getElementById('auName').textContent  = u.username || 'Anonim';
    document.getElementById('auEmail').textContent = u.email || '—';
    document.getElementById('auCash').textContent  = formatMoney(u.cash || 0);
    document.getElementById('auBank').textContent  = formatMoney(u.bank || 0);
    document.getElementById('auLevel').textContent = u.level || 1;
    document.getElementById('auRole').textContent  = u.role || 'user';
    document.getElementById('auUid').value = uid;

    // Ban durumu göster
    const banInfo = document.getElementById('auBanInfo');
    if (banInfo) {
      if (u.banned) {
        banInfo.style.display = 'block';
        banInfo.innerHTML = `🔨 <strong>Banlı</strong> — ${u.banReason || 'Sebep yok'} • ${u.banAt ? timeAgo(u.banAt) : ''}`;
      } else {
        banInfo.style.display = 'none';
        banInfo.innerHTML = '';
      }
    }
    // Ban nedeni input'unu temizle
    const banR = document.getElementById('banReason');
    if (banR) banR.value = '';

    openModal('adminUserModal');
  };

  window.adminGiveCash = async function() {
    const uid = document.getElementById('auUid').value;
    const amt = parseFloat(document.getElementById('adminGiveAmount').value) || 0;
    if (!uid || amt <= 0) { toast('UID ve miktar girin', 'error'); return; }
    await addCash(uid, amt, `Admin tarafından verildi`);
    await dbPush(`users/${uid}/notifs`, {
      title: '💰 Admin Bonusu!',
      body: `Yönetici tarafından hesabına ${formatMoney(amt)} eklendi.`,
      time: Date.now(), read: false
    });
    toast(`${formatMoney(amt)} verildi ✅`, 'success');
    document.getElementById('adminGiveAmount').value = '';
    adminManageUser(uid);
  };

  window.adminRemoveCash = async function() {
    const uid = document.getElementById('auUid').value;
    const amt = parseFloat(document.getElementById('adminRemoveAmount').value) || 0;
    if (!uid || amt <= 0) { toast('UID ve miktar girin', 'error'); return; }
    try {
      await spendCash(uid, amt, 'Admin tarafından düşüldü');
      toast(`${formatMoney(amt)} düşüldü ✅`, 'success');
      document.getElementById('adminRemoveAmount').value = '';
      adminManageUser(uid);
    } catch(e) { toast(e.message, 'error'); }
  };

  window.adminSetRole = async function(role) {
    const uid = document.getElementById('auUid').value;
    if (!uid) return;
    await dbUpdate(`users/${uid}`, { role });
    toast(`Rol "${role}" olarak ayarlandı`, 'success');
    adminManageUser(uid);
    loadUserList();
  };

  window.adminBanUser = async function() {
    const uid    = document.getElementById('auUid').value;
    const reason = document.getElementById('banReason')?.value?.trim() || 'Belirtilmedi';
    if (!uid) return;
    if (uid === window.ME.uid) { toast('Kendini banlayamazsın', 'error'); return; }
    if (!confirm(`Kullanıcı banlansın mı?\nNeden: "${reason}"`)) return;
    await dbUpdate(`users/${uid}`, {
      banned: true, role: 'banned',
      banReason: reason, banAt: Date.now(), bannedBy: window.ME.uid
    });
    await dbPush('admin/suspiciousLog', {
      type: 'ban', uid, reason,
      by: window.ME.uid, byName: window.ME.username, time: Date.now()
    });
    toast('Kullanıcı banlandı 🔨', 'warning');
    closeModal('adminUserModal');
    loadUserList();
  };

  window.adminUnbanUser = async function() {
    const uid = document.getElementById('auUid').value;
    if (!uid) return;
    if (!confirm('Kullanıcının banını kaldırmak istiyor musun?')) return;
    await dbUpdate(`users/${uid}`, {
      banned: false, role: 'user', banReason: null, banAt: null, bannedBy: null
    });
    await dbPush('admin/suspiciousLog', {
      type: 'unban', uid,
      by: window.ME.uid, byName: window.ME.username, time: Date.now()
    });
    toast('Ban kaldırıldı ✅', 'success');
    closeModal('adminUserModal');
    loadUserList();
  };

  window.loadSuspiciousLog = async function() {
    const el = document.getElementById('suspiciousLogList');
    if (!el) return;
    el.innerHTML = '<div style="color:var(--text2);padding:10px">⏳ Yükleniyor...</div>';
    const snap = await dbGet('admin/suspiciousLog');
    if (!snap) {
      el.innerHTML = '<div style="color:var(--text2);font-size:.85rem;padding:8px">Şüpheli aktivite yok 🎉</div>';
      return;
    }
    const items = Object.values(snap).reverse().slice(0, 100);
    const typeLabel = { ban:'🔨 Ban', unban:'✅ Unban', large_tx:'💸 Büyük İşlem', limit_exceeded:'🚨 Limit Aşımı' };
    const typeColor = { ban:'badge-red', unban:'badge-green', large_tx:'badge-yellow', limit_exceeded:'badge-red' };
    el.innerHTML = `<div class="table-wrap"><table>
      <thead><tr><th>Tip</th><th>Kullanıcı UID</th><th>Sebep/Açıklama</th><th>Admin/Tutar</th><th>Tarih</th></tr></thead>
      <tbody>${items.map(l => `<tr>
        <td><span class="badge ${typeColor[l.type] || 'badge-yellow'}">${typeLabel[l.type] || l.type}</span></td>
        <td style="font-size:.78rem;color:var(--text2)">${(l.uid || '?').slice(0,12)}…</td>
        <td style="font-size:.82rem">${l.reason || l.msg || '—'}</td>
        <td style="font-size:.82rem">${l.byName ? '👤 '+l.byName : (l.amount ? formatMoney(l.amount) : '—')}</td>
        <td style="color:var(--text2);font-size:.75rem">${l.time ? timeAgo(l.time) : '?'}</td>
      </tr>`).join('')}
      </tbody></table></div>`;
  };

  window.adminGiveItem = async function() {
    const uid    = document.getElementById('auUid').value;
    const itemId = document.getElementById('adminGiveItem').value;
    const qty    = parseInt(document.getElementById('adminGiveItemQty').value) || 1;
    if (!uid || !itemId) { toast('Kullanıcı ve ürün seçin', 'error'); return; }
    await addItem(uid, itemId, qty);
    const item = (window.ITEM_CATALOG || {})[itemId] || { name: itemId };
    toast(`${qty}x ${item.name} verildi ✅`, 'success');
  };

  window.adminBroadcast = async function() {
    const title = document.getElementById('broadcastTitle').value.trim();
    const body  = document.getElementById('broadcastBody').value.trim();
    if (!title || !body) { toast('Başlık ve mesaj girin', 'error'); return; }

    const usersSnap = await dbGet('users');
    if (!usersSnap) { toast('Kullanıcı yok', 'error'); return; }

    const batch = {};
    Object.keys(usersSnap).forEach(uid => {
      const key = db.ref(`users/${uid}/notifs`).push().key;
      batch[`users/${uid}/notifs/${key}`] = {
        title: '📢 ' + title, body,
        time: Date.now(), read: false
      };
    });
    await db.ref().update(batch);

    // Global sohbete de gönder
    await dbPush('chat/global', {
      text: `📢 [DUYURU] ${title}: ${body}`,
      uid: window.ME.uid, username: '⚡ Sistem',
      avatar: '⚡', role: 'admin',
      time: serverTime()
    });

    toast(`Duyuru ${Object.keys(usersSnap).length} kişiye gönderildi ✅`, 'success');
    document.getElementById('broadcastTitle').value = '';
    document.getElementById('broadcastBody').value  = '';
  };

  window.adminClearChat = async function() {
    if (!confirm('Tüm sohbet geçmişi silinecek. Emin misin?')) return;
    await db.ref('chat/global').remove();
    await db.ref('chat/ticaret').remove();
    toast('Sohbet temizlendi', 'success');
  };

  window.adminRefreshStats = function() {
    loadAdminStats();
    toast('İstatistikler güncellendi', 'success');
  };

  console.log('%c[Admin] ✅ Admin paneli yüklendi', 'color:#a855f7;font-weight:bold');
})();
