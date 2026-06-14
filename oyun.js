/* ═══════════════════════════════════════════════════════════
   ANA OYUN — Dashboard, Profil, Envanter, Görevler, Liderlik
   ═══════════════════════════════════════════════════════════ */
(function() {

  // ── Sayfa geçişi ─────────────────────────────────────────────
  window.showPage = function(id) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.page === id));
    const page = document.getElementById('page-' + id);
    if (page) page.classList.add('active');
    // Mobil sidebar kapat
    closeSidebar();
    // Sayfaya özgü yükleme
    const loaders = {
      dashboard:   loadDashboard,
      profile:     loadProfile,
      inventory:   loadInventory,
      missions:    loadMissions,
      leaderboard: loadLeaderboard,
      pazar:       typeof loadPazar      === 'function' ? loadPazar : null,
      market:      typeof loadMarket     === 'function' ? loadMarket : null,
      magaza:      typeof loadMagaza     === 'function' ? loadMagaza : null,
      uretim:      typeof loadUretim     === 'function' ? loadUretim : null,
      borsa:       typeof loadBorsa      === 'function' ? loadBorsa : null,
      kripto:      typeof loadKripto     === 'function' ? loadKripto : null,
      muzayede:    typeof loadMuzayede   === 'function' ? loadMuzayede : null,
      banka:       typeof loadBanka      === 'function' ? loadBanka : null,
      chat:        typeof loadChat       === 'function' ? loadChat : null,
      admin:       typeof loadAdmin      === 'function' ? loadAdmin : null,
    };
    if (loaders[id]) loaders[id]();
  };

  window.closeSidebar = function() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebarOverlay').classList.remove('visible');
  };

  window.toggleSidebar = function() {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('sidebarOverlay').classList.toggle('visible');
  };

  // ── Uygulama başlat ──────────────────────────────────────────
  window.initApp = function() {
    updateTopbar();
    showPage('dashboard');
    listenNotifications();
    listenUserChanges();
    startTickerCycle();
    checkDailyBonus();
  };

  function updateTopbar() {
    const u = window.ME;
    if (!u) return;
    const el = id => document.getElementById(id);
    safeSet('topbarCash',     formatMoney(u.cash || 0));
    safeSet('topbarDiamond',  (u.diamonds || 0) + ' 💎');
    safeSet('topbarLevel',    'Sv.' + (u.level || 1));
    safeSet('topbarAvatar',   u.avatar || u.username?.[0]?.toUpperCase() || '?');
    safeSet('topbarUsername', u.username);
  }

  function safeSet(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  // ── Kullanıcı değişikliklerini dinle ─────────────────────────
  function listenUserChanges() {
    const uid = window.ME.uid;
    db.ref(`users/${uid}`).on('value', snap => {
      const data = snap.val();
      if (!data) return;
      window.ME = { ...data, uid, firebaseUser: window.ME.firebaseUser };
      updateTopbar();
      checkMilestoneMissions(uid, data);
    });
  }

  async function checkMilestoneMissions(uid, u) {
    const cash  = u.cash  || 0;
    const level = u.level || 1;
    const mSnap = await dbGet(`users/${uid}/missions`);

    if (cash >= 50000 && !(mSnap?.cash50k?.claimed)) {
      const cur = mSnap?.cash50k?.progress || 0;
      if (cur < 50000) await dbSet(`users/${uid}/missions/cash50k/progress`, 50000);
    }
    if (level >= 5 && !(mSnap?.level5?.claimed)) {
      const cur = mSnap?.level5?.progress || 0;
      if (cur < 5) await dbSet(`users/${uid}/missions/level5/progress`, 5);
    }
    if (level >= 10 && !(mSnap?.level10?.claimed)) {
      const cur = mSnap?.level10?.progress || 0;
      if (cur < 10) await dbSet(`users/${uid}/missions/level10/progress`, 10);
    }
  }

  // ── Bildirimler ───────────────────────────────────────────────
  function listenNotifications() {
    const uid = window.ME.uid;
    db.ref(`users/${uid}/notifs`).orderByChild('read').equalTo(false)
      .on('value', snap => {
        const count = snap.numChildren();
        const badge = document.getElementById('notifBadge');
        if (badge) badge.textContent = count > 0 ? count : '';
        badge && badge.classList.toggle('hidden', count === 0);
      });
  }

  window.toggleNotifDropdown = function() {
    const dd = document.getElementById('notifDropdown');
    if (!dd) return;
    const open = dd.classList.toggle('open');
    if (open) loadNotifications();
  };

  async function loadNotifications() {
    const uid = window.ME.uid;
    const snap = await dbGet(`users/${uid}/notifs`);
    const list = document.getElementById('notifList');
    if (!list) return;
    list.innerHTML = '';
    if (!snap) { list.innerHTML = '<div class="notif-item"><span style="color:var(--text2)">Bildirim yok</span></div>'; return; }
    const items = Object.entries(snap).reverse().slice(0, 20);
    items.forEach(([key, n]) => {
      const div = document.createElement('div');
      div.className = 'notif-item' + (n.read ? '' : ' unread');
      div.innerHTML = `<div class="notif-item-title">${n.title}</div>
        <div style="font-size:.8rem;color:var(--text2);margin-top:2px">${n.body}</div>
        <div class="notif-item-time">${timeAgo(n.time)}</div>`;
      div.onclick = () => {
        dbUpdate(`users/${uid}/notifs/${key}`, { read: true });
        div.classList.remove('unread');
      };
      list.appendChild(div);
    });
  }

  window.markAllNotifsRead = async function() {
    const uid = window.ME.uid;
    const snap = await dbGet(`users/${uid}/notifs`);
    if (!snap) return;
    const updates = {};
    Object.keys(snap).forEach(k => updates[`users/${uid}/notifs/${k}/read`] = true);
    await db.ref().update(updates);
    toast('Tüm bildirimler okundu', 'success');
  };

  // ── DASHBOARD ────────────────────────────────────────────────
  async function loadDashboard() {
    const u = window.ME;
    const el = id => document.getElementById(id);

    safeSet('dashCash',     formatMoney(u.cash || 0));
    safeSet('dashBank',     formatMoney(u.bank || 0));
    safeSet('dashDiamond',  formatNum(u.diamonds || 0));
    safeSet('dashLevel',    u.level || 1);

    // XP bar
    const needed = levelThreshold(u.level || 1);
    const xpPct  = Math.min(100, Math.round(((u.xp || 0) / needed) * 100));
    const xpBar  = document.getElementById('dashXpBar');
    if (xpBar) xpBar.style.width = xpPct + '%';
    safeSet('dashXpText', `${formatNum(u.xp || 0)} / ${formatNum(needed)} XP`);

    // Son işlemler
    loadRecentTransactions();

    // Piyasa özeti
    loadMarketSummary();

    // Görev durumu
    loadMissionWidget();
  }

  async function loadRecentTransactions() {
    const snap = await dbGet(`users/${window.ME.uid}/transactions`);
    const el = document.getElementById('recentTx');
    if (!el) return;
    if (!snap) { el.innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div><p>Henüz işlem yok</p></div>'; return; }
    const items = Object.values(snap).reverse().slice(0, 8);
    el.innerHTML = items.map(t => `
      <div class="listing-item" style="padding:10px 14px">
        <div class="listing-icon">${t.type === 'gelir' ? '💰' : '💸'}</div>
        <div class="listing-info">
          <div class="listing-name">${t.reason || 'İşlem'}</div>
          <div class="listing-meta">${timeAgo(t.time)}</div>
        </div>
        <div class="listing-price ${t.amount >= 0 ? 'change-up' : 'change-down'}">
          ${t.amount >= 0 ? '+' : ''}${formatMoney(t.amount)}
        </div>
      </div>`).join('');
  }

  async function loadMarketSummary() {
    const snap = await dbGet('economy/prices');
    const el = document.getElementById('marketSummary');
    if (!el || !snap) return;
    const items = Object.entries(snap).slice(0, 6);
    el.innerHTML = items.map(([key, data]) => `
      <div class="stock-item">
        <div class="stock-ticker">${(data.icon || '📦')}</div>
        <div class="stock-name">${data.name || key}</div>
        <div class="stock-price">${formatMoney(data.price || 0)}</div>
        <div class="stock-change ${(data.change || 0) >= 0 ? 'change-up' : 'change-down'}">
          ${(data.change || 0) >= 0 ? '▲' : '▼'} ${Math.abs(data.change || 0).toFixed(1)}%
        </div>
      </div>`).join('');
  }

  async function loadMissionWidget() {
    const missions = getDefaultMissions();
    const snap = await dbGet(`users/${window.ME.uid}/missions`);
    const el = document.getElementById('missionWidget');
    if (!el) return;
    const active = missions.filter(m => {
      const progress = snap?.[m.id]?.progress || 0;
      return progress < m.target;
    }).slice(0, 3);
    if (!active.length) { el.innerHTML = '<div style="color:var(--green);font-weight:700">🎉 Tüm görevler tamamlandı!</div>'; return; }
    el.innerHTML = active.map(m => {
      const progress = snap?.[m.id]?.progress || 0;
      const pct = Math.min(100, Math.round((progress / m.target) * 100));
      return `<div class="mission-item">
        <div class="mission-icon">${m.icon}</div>
        <div class="mission-info">
          <div class="mission-name">${m.name}</div>
          <div class="mission-desc">${m.desc}</div>
          <div class="mission-reward">🏆 ${formatMoney(m.reward)} + ${m.xp} XP</div>
          <div class="mission-prog">
            <div style="font-size:.72rem;color:var(--text2)">${progress} / ${m.target}</div>
            <div class="mission-prog-bar"><div class="mission-prog-fill" style="width:${pct}%"></div></div>
          </div>
        </div>
      </div>`;
    }).join('');
  }

  // ── PROFİL ───────────────────────────────────────────────────
  async function loadProfile() {
    const u = window.ME;
    safeSet('profileName',    u.username);
    safeSet('profileAvatar',  u.avatar || u.username?.[0]?.toUpperCase() || '?');
    safeSet('profileLevel',   '⭐ Seviye ' + (u.level || 1));
    safeSet('profileCash',    formatMoney(u.cash || 0));
    safeSet('profileBank',    formatMoney(u.bank || 0));
    safeSet('profileDiamond', u.diamonds || 0);
    safeSet('profileTrades',  u.stats?.trades || 0);
    safeSet('profileSales',   u.stats?.sales  || 0);
    safeSet('profilePurchases', u.stats?.purchases || 0);
    safeSet('profileJoined',  new Date(u.createdAt).toLocaleDateString('tr-TR'));

    const needed = levelThreshold(u.level || 1);
    const pct = Math.min(100, Math.round(((u.xp || 0) / needed) * 100));
    const bar = document.getElementById('profileXpBar');
    if (bar) bar.style.width = pct + '%';
    safeSet('profileXpText', `${formatNum(u.xp || 0)} / ${formatNum(needed)} XP`);

    // Unvanlar
    loadBadges();
  }

  function loadBadges() {
    const u = window.ME;
    const badges = [];
    if ((u.level || 1) >= 5)  badges.push({ icon: '🥉', name: 'Acemi Tüccar' });
    if ((u.level || 1) >= 10) badges.push({ icon: '🥈', name: 'Deneyimli Tüccar' });
    if ((u.level || 1) >= 20) badges.push({ icon: '🥇', name: 'Usta Tüccar' });
    if ((u.stats?.trades || 0) >= 10) badges.push({ icon: '🤝', name: '10 İşlem' });
    if ((u.stats?.trades || 0) >= 50) badges.push({ icon: '💼', name: '50 İşlem' });
    if ((u.cash || 0) >= 100000) badges.push({ icon: '💰', name: '100K Zengin' });
    if ((u.cash || 0) >= 1000000) badges.push({ icon: '🤑', name: 'Milyoner' });
    if (u.role === 'admin') badges.push({ icon: '⚡', name: 'Yetkili' });

    const el = document.getElementById('profileBadges');
    if (!el) return;
    el.innerHTML = badges.length ? badges.map(b => `
      <div style="display:inline-flex;align-items:center;gap:5px;background:var(--bg3);
        border:1px solid var(--border);border-radius:99px;padding:4px 10px;font-size:.78rem;margin:3px">
        ${b.icon} ${b.name}
      </div>`).join('') : '<span style="color:var(--text2);font-size:.85rem">Henüz unvan yok</span>';
  }

  window.saveProfile = async function() {
    const username = document.getElementById('editUsername')?.value?.trim();
    if (!username || username.length < 3) { toast('Kullanıcı adı en az 3 karakter', 'error'); return; }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) { toast('Sadece harf, rakam ve _ kullanılabilir', 'error'); return; }

    const uid = window.ME.uid;
    const oldUsername = window.ME.usernameLower;
    if (username.toLowerCase() !== oldUsername) {
      const taken = await dbGet(`usernames/${username.toLowerCase()}`);
      if (taken) { toast('Bu kullanıcı adı alınmış', 'error'); return; }
      await dbSet(`usernames/${username.toLowerCase()}`, window.ME.email);
      if (oldUsername) await db.ref(`usernames/${oldUsername}`).remove();
    }
    await dbUpdate(`users/${uid}`, { username, usernameLower: username.toLowerCase(), avatar: username[0].toUpperCase() });
    toast('Profil güncellendi ✅', 'success');
  };

  // ── ENVANTER ─────────────────────────────────────────────────
  async function loadInventory() {
    const uid  = window.ME.uid;
    const snap = await dbGet(`users/${uid}/inventory`);
    const el   = document.getElementById('inventoryGrid');
    if (!el) return;

    if (!snap) {
      el.innerHTML = '<div class="empty-state"><div class="empty-icon">🎒</div><h3>Envanter Boş</h3><p>Marketten veya pazardan ürün satın al</p></div>';
      return;
    }

    const catalog = window.ITEM_CATALOG || {};
    el.innerHTML = Object.entries(snap)
      .filter(([,qty]) => qty > 0)
      .map(([itemId, qty]) => {
        const item = catalog[itemId] || { name: itemId, icon: '📦' };
        return `<div class="inv-item" onclick="showItemDetail('${itemId}', ${qty})">
          <div class="inv-qty">${qty}</div>
          <div class="inv-icon">${item.icon}</div>
          <div class="inv-name">${item.name}</div>
        </div>`;
      }).join('');
  }

  window.showItemDetail = function(itemId, qty) {
    const catalog = window.ITEM_CATALOG || {};
    const item = catalog[itemId] || { name: itemId, icon: '📦', desc: '' };
    const modal = document.getElementById('itemDetailModal');
    document.getElementById('itemDetailIcon').textContent = item.icon;
    document.getElementById('itemDetailName').textContent = item.name;
    document.getElementById('itemDetailDesc').textContent = item.desc || '';
    document.getElementById('itemDetailQty').textContent  = qty;
    document.getElementById('itemDetailPrice').textContent = item.price ? formatMoney(item.price) : 'Bilinmiyor';
    document.getElementById('itemSellId').value  = itemId;
    document.getElementById('itemSellQty').max   = qty;
    modal.classList.add('open');
  };

  window.sellItemFromInventory = async function() {
    const itemId = document.getElementById('itemSellId').value;
    const qty    = parseInt(document.getElementById('itemSellQty').value) || 1;
    const uid    = window.ME.uid;
    const catalog = window.ITEM_CATALOG || {};
    const item   = catalog[itemId] || {};
    const price  = (item.price || 10) * qty;

    try {
      await removeItem(uid, itemId, qty);
      await addCash(uid, price, `${item.name || itemId} satışı`);
      await addXP(uid, 5);
      toast(`${qty}x ${item.name || itemId} satıldı — ${formatMoney(price)}`, 'success');
      closeModal('itemDetailModal');
      loadInventory();
    } catch(e) { toast(e.message, 'error'); }
  };

  // ── GÖREVLER ─────────────────────────────────────────────────
  async function loadMissions() {
    const missions = getDefaultMissions();
    const snap = await dbGet(`users/${window.ME.uid}/missions`);
    const el   = document.getElementById('missionList');
    if (!el) return;

    el.innerHTML = missions.map(m => {
      const progress = snap?.[m.id]?.progress || 0;
      const completed = progress >= m.target;
      const claimed   = snap?.[m.id]?.claimed || false;
      const pct = Math.min(100, Math.round((progress / m.target) * 100));
      return `<div class="mission-item" style="${completed && !claimed ? 'border-color:var(--green);box-shadow:0 0 0 2px rgba(34,197,94,.2)' : ''}">
        <div class="mission-icon">${m.icon}</div>
        <div class="mission-info" style="flex:1">
          <div class="mission-name">${m.name}</div>
          <div class="mission-desc">${m.desc}</div>
          <div class="mission-reward">🏆 ${formatMoney(m.reward)} + ${m.xp} XP</div>
          ${!completed ? `<div class="mission-prog">
            <div style="font-size:.72rem;color:var(--text2)">${progress} / ${m.target}</div>
            <div class="mission-prog-bar"><div class="mission-prog-fill" style="width:${pct}%"></div></div>
          </div>` : claimed ?
            '<div style="color:var(--text3);font-size:.8rem;margin-top:6px">✅ Tamamlandı</div>' :
            `<button class="btn btn-success btn-sm" style="margin-top:8px" onclick="claimMission('${m.id}', ${m.reward}, ${m.xp})">🎁 Ödül Al</button>`}
        </div>
      </div>`;
    }).join('');
  }

  window.claimMission = async function(missionId, reward, xp) {
    const uid = window.ME.uid;
    const snap = await dbGet(`users/${uid}/missions/${missionId}`);
    if (!snap || snap.claimed) { toast('Bu ödül zaten alındı', 'error'); return; }
    try {
      await addCash(uid, reward, `Görev ödülü: ${missionId}`);
      await addXP(uid, xp);
      await dbUpdate(`users/${uid}/missions/${missionId}`, { claimed: true });
      toast(`Ödül alındı: ${formatMoney(reward)} + ${xp} XP 🎉`, 'success');
      loadMissions();
    } catch(e) { toast(e.message, 'error'); }
  };

  function getDefaultMissions() {
    return [
      { id: 'login1',   icon: '🔑', name: 'İlk Giriş',       desc: 'Oyuna giriş yap',                target: 1,   reward: 500,   xp: 50 },
      { id: 'trade5',   icon: '🤝', name: '5 İşlem',          desc: 'Toplam 5 alım/satım yap',        target: 5,   reward: 2000,  xp: 100 },
      { id: 'trade25',  icon: '💼', name: '25 İşlem',         desc: 'Toplam 25 alım/satım yap',       target: 25,  reward: 8000,  xp: 300 },
      { id: 'cash50k',  icon: '💰', name: '50K Biriktir',     desc: 'Kasana 50.000 ₺ biriktir',       target: 50000, reward: 5000, xp: 200 },
      { id: 'sell10',   icon: '🏪', name: '10 Satış',         desc: 'Pazarda 10 ürün sat',            target: 10,  reward: 3000,  xp: 150 },
      { id: 'buy10',    icon: '🛒', name: '10 Satın Al',      desc: '10 ürün satın al',               target: 10,  reward: 2500,  xp: 120 },
      { id: 'level5',   icon: '⭐', name: 'Seviye 5',         desc: 'Seviye 5\'e ulaş',              target: 5,   reward: 3000,  xp: 0 },
      { id: 'level10',  icon: '🌟', name: 'Seviye 10',        desc: 'Seviye 10\'a ulaş',             target: 10,  reward: 10000, xp: 0 },
      { id: 'chat20',   icon: '💬', name: '20 Mesaj',         desc: 'Sohbette 20 mesaj gönder',       target: 20,  reward: 1000,  xp: 80 },
      { id: 'produce5', icon: '🏭', name: '5 Üretim',         desc: 'Fabrikanda 5 ürün üret',         target: 5,   reward: 4000,  xp: 180 },
      { id: 'auction1', icon: '🔨', name: 'Müzayede Katılım', desc: 'Bir müzayedeye katıl',           target: 1,   reward: 1500,  xp: 100 },
      { id: 'bank10k',  icon: '🏦', name: 'Banka 10K',        desc: 'Bankaya 10.000 ₺ yatır',        target: 10000, reward: 2000, xp: 100 },
    ];
  }

  // ── LİDERLİK TABLOSU ─────────────────────────────────────────
  async function loadLeaderboard() {
    const el = document.getElementById('leaderboardList');
    if (!el) return;
    el.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text2)">⏳ Yükleniyor...</div>';

    const snap = await dbGet('users');
    if (!snap) { el.innerHTML = '<div class="empty-state"><div class="empty-icon">🏆</div><p>Henüz oyuncu yok</p></div>'; return; }

    const lbType = document.getElementById('lbType')?.value || 'cash';
    const players = Object.values(snap)
      .filter(u => u.username && !u.isAnonymous && !u.banned)
      .sort((a, b) => (b[lbType] || 0) - (a[lbType] || 0))
      .slice(0, 50);

    const rankIcons = ['🥇', '🥈', '🥉'];
    el.innerHTML = players.map((p, i) => {
      const valMap = {
        cash:  formatMoney(p.cash || 0),
        level: 'Sv.' + (p.level || 1),
        xp:    formatNum(p.xp || 0) + ' XP',
      };
      return `<div class="lb-item" style="${p.uid === window.ME.uid ? 'background:rgba(59,130,246,.08);border-left:3px solid var(--accent)' : ''}">
        <div class="lb-rank ${i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : ''}">${rankIcons[i] || (i+1)}</div>
        <div class="lb-avatar-sm">${p.avatar || p.username?.[0]?.toUpperCase() || '?'}</div>
        <div class="lb-name">${p.username || 'Anonim'}</div>
        <div class="lb-level">Sv.${p.level || 1}</div>
        <div class="lb-cash">${valMap[lbType]}</div>
      </div>`;
    }).join('');
  }

  window.changeLbType = function() { loadLeaderboard(); };

  // ── GÜNLÜK BONUS ─────────────────────────────────────────────
  async function checkDailyBonus() {
    const uid = window.ME.uid;
    const lastBonus = await dbGet(`users/${uid}/lastDailyBonus`);
    const today = new Date().toDateString();
    if (lastBonus === today) return;

    const streak = (await dbGet(`users/${uid}/dailyStreak`) || 0) + 1;
    const bonus = Math.min(500 + streak * 100, 2000);

    await dbSet(`users/${uid}/lastDailyBonus`, today);
    await dbSet(`users/${uid}/dailyStreak`, streak);
    await addCash(uid, bonus, `Günlük bonus (${streak}. gün)`);
    await addXP(uid, 20);

    setTimeout(() => {
      toast(`🎁 Günlük bonus: ${formatMoney(bonus)} (${streak}. gün serisi!)`, 'success', 5000);
    }, 2000);
  }

  // ── HABER TICKER ─────────────────────────────────────────────
  const NEWS = [
    '📈 Demir fiyatları %5 yükseldi', '🏦 Merkez Bankası faiz oranlarını açıkladı',
    '🛒 Büyük indirim haftası başladı!', '💹 Kripto piyasaları hareketlendi',
    '🏭 Yeni fabrika bölgesi açıldı', '🚢 İhracat limanları genişledi',
    '🌾 Hasat sezonu geldi — tarım ürünleri ucuzladı', '⚡ Enerji maliyetleri düştü',
    '💎 Nadir mineral keşfedildi!', '🏆 Bu haftanın en çok kazananı: ?',
  ];
  let tickerIdx = 0;
  function startTickerCycle() {
    const el = document.getElementById('tickerText');
    if (!el) return;
    el.textContent = NEWS[0];
    setInterval(() => {
      tickerIdx = (tickerIdx + 1) % NEWS.length;
      el.style.opacity = 0;
      setTimeout(() => { el.textContent = NEWS[tickerIdx]; el.style.opacity = 1; }, 300);
    }, 5000);
  }

  // ── MODAL yardımcıları ────────────────────────────────────────
  window.openModal  = id => { const m = document.getElementById(id); if(m) m.classList.add('open'); };
  window.closeModal = id => { const m = document.getElementById(id); if(m) m.classList.remove('open'); };

  // Overlay tıklama ile kapat
  document.addEventListener('click', function(e) {
    if (e.target.classList.contains('modal-overlay')) {
      e.target.classList.remove('open');
    }
    // Bildirim dropdown dışı tıklama
    if (!e.target.closest('#notifDropdown') && !e.target.closest('#notifBtn')) {
      document.getElementById('notifDropdown')?.classList.remove('open');
    }
    // Avatar dropdown
    if (!e.target.closest('#avatarMenu') && !e.target.closest('#topbarAvatar')) {
      const am = document.getElementById('avatarMenu');
      if (am) am.style.display = 'none';
    }
  });

  window.toggleAvatarMenu = function() {
    const m = document.getElementById('avatarMenu');
    if (!m) return;
    const isOpen = m.style.display === 'block';
    m.style.display = isOpen ? 'none' : 'block';
  };

  // ── ITEM CATALOG ─────────────────────────────────────────────
  window.ITEM_CATALOG = {
    ekmek:   { name: 'Ekmek',      icon: '🍞', price: 5,     category: 'gıda' },
    su:      { name: 'Su',         icon: '💧', price: 3,     category: 'gıda' },
    et:      { name: 'Et',         icon: '🥩', price: 80,    category: 'gıda' },
    tahil:   { name: 'Tahıl',      icon: '🌾', price: 15,    category: 'hammadde' },
    demir:   { name: 'Demir',      icon: '⚙️', price: 120,   category: 'hammadde' },
    ahsap:   { name: 'Ahşap',      icon: '🪵', price: 45,    category: 'hammadde' },
    tas:     { name: 'Taş',        icon: '🪨', price: 25,    category: 'hammadde' },
    komur:   { name: 'Kömür',      icon: '🖤', price: 60,    category: 'enerji' },
    petrol:  { name: 'Petrol',     icon: '🛢️', price: 200,   category: 'enerji' },
    altin:   { name: 'Altın',      icon: '🥇', price: 1800,  category: 'maden' },
    gumus:   { name: 'Gümüş',      icon: '🥈', price: 400,   category: 'maden' },
    elmas:   { name: 'Elmas',      icon: '💎', price: 5000,  category: 'maden' },
    kiyafet: { name: 'Kıyafet',    icon: '👕', price: 150,   category: 'tekstil' },
    elektrikli_alet: { name: 'El. Alet', icon: '🔌', price: 500, category: 'elektronik' },
    telefon: { name: 'Telefon',    icon: '📱', price: 3000,  category: 'elektronik' },
    araba:   { name: 'Araba',      icon: '🚗', price: 50000, category: 'ulaşım' },
    ilaç:    { name: 'İlaç',       icon: '💊', price: 200,   category: 'sağlık' },
    kitap:   { name: 'Kitap',      icon: '📚', price: 80,    category: 'eğitim' },
    mobilya: { name: 'Mobilya',    icon: '🪑', price: 800,   category: 'ev' },
    boya:    { name: 'Boya',       icon: '🎨', price: 90,    category: 'inşaat' },
    cimento: { name: 'Çimento',    icon: '🏗️', price: 70,    category: 'inşaat' },
    cam:     { name: 'Cam',        icon: '🪟', price: 110,   category: 'inşaat' },
    un:      { name: 'Un',         icon: '🌾', price: 20,    category: 'gıda' },
    seker:   { name: 'Şeker',      icon: '🍬', price: 30,    category: 'gıda' },
    sut:     { name: 'Süt',        icon: '🥛', price: 25,    category: 'gıda' },
    yumurta: { name: 'Yumurta',    icon: '🥚', price: 35,    category: 'gıda' },
    balik:   { name: 'Balık',      icon: '🐟', price: 65,    category: 'gıda' },
    plastik: { name: 'Plastik',    icon: '♻️', price: 40,    category: 'hammadde' },
    bakir:   { name: 'Bakır',      icon: '🔶', price: 280,   category: 'maden' },
    cift_kahve: { name: 'Kahve',   icon: '☕', price: 50,    category: 'gıda' },
    oyun_konsolü: { name: 'Konsol', icon: '🎮', price: 8000, category: 'elektronik' },
  };

  console.log('%c[Oyun] ✅ Ana oyun modülü yüklendi', 'color:#22c55e;font-weight:bold');
})();
/* ═══════════════════════════════════════════════════════════
   PAZAR YERİ — Oyuncular arası alım/satım sistemi
   ═══════════════════════════════════════════════════════════ */
(function() {

  let allListings = {};
  let currentFilter = 'all';
  let searchTerm = '';

  // ── Pazar yükle ──────────────────────────────────────────────
  window.loadPazar = async function() {
    const el = document.getElementById('pazarList');
    if (!el) return;
    el.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text2)">⏳ Yükleniyor...</div>';

    const snap = await dbGet('pazar');
    allListings = snap || {};
    renderListings();
  };

  function renderListings() {
    const el = document.getElementById('pazarList');
    if (!el) return;

    let items = Object.entries(allListings)
      .filter(([, v]) => v && v.status === 'active')
      .filter(([, v]) => currentFilter === 'all' || v.category === currentFilter)
      .filter(([, v]) => !searchTerm || (v.itemName || '').toLowerCase().includes(searchTerm.toLowerCase()));

    // Sıralama
    const sort = document.getElementById('pazarSort')?.value || 'newest';
    items.sort((a, b) => {
      if (sort === 'price_asc')  return (a[1].price || 0) - (b[1].price || 0);
      if (sort === 'price_desc') return (b[1].price || 0) - (a[1].price || 0);
      return (b[1].createdAt || 0) - (a[1].createdAt || 0);
    });

    if (!items.length) {
      el.innerHTML = '<div class="empty-state"><div class="empty-icon">🛒</div><h3>İlan bulunamadı</h3><p>Farklı kategoride ara veya kendi ilanını ekle</p></div>';
      return;
    }

    el.innerHTML = `<div class="product-grid">${items.map(([key, item]) => `
      <div class="product-card" onclick="showPazarDetail('${key}')">
        <div class="product-icon">${item.icon || '📦'}</div>
        <div class="product-name">${item.itemName}</div>
        <div class="product-desc">${item.qty} adet • ${item.category || 'Diğer'}</div>
        <div class="product-price">${formatMoney(item.price)}<span style="font-size:.7rem;color:var(--text2)"> / adet</span></div>
        <div class="product-seller">👤 ${item.sellerName}</div>
        <div class="product-actions">
          ${item.sellerUid !== window.ME.uid
            ? `<button class="btn btn-primary btn-sm btn-block" onclick="event.stopPropagation();quickBuy('${key}')">Satın Al</button>`
            : `<button class="btn btn-danger btn-sm btn-block" onclick="event.stopPropagation();removeListing('${key}')">İlanı Kaldır</button>`}
        </div>
      </div>`).join('')}
    </div>`;
  }

  window.pazarSearch = function() {
    searchTerm = document.getElementById('pazarSearch')?.value || '';
    renderListings();
  };

  window.filterPazar = function(cat) {
    currentFilter = cat;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.toggle('active', b.dataset.cat === cat));
    renderListings();
  };

  window.sortPazar = function() { renderListings(); };

  // ── İlan detay ───────────────────────────────────────────────
  window.showPazarDetail = function(key) {
    const item = allListings[key];
    if (!item) return;
    const modal = document.getElementById('pazarDetailModal');
    document.getElementById('pdIcon').textContent  = item.icon || '📦';
    document.getElementById('pdName').textContent  = item.itemName;
    document.getElementById('pdDesc').textContent  = item.desc || 'Açıklama yok';
    document.getElementById('pdQty').textContent   = item.qty + ' adet';
    document.getElementById('pdPrice').textContent = formatMoney(item.price) + ' / adet';
    document.getElementById('pdSeller').textContent = item.sellerName;
    document.getElementById('pdDate').textContent  = timeAgo(item.createdAt);
    document.getElementById('pdTotal').textContent = formatMoney(item.price * item.qty);
    document.getElementById('pdKey').value = key;

    const buySection = document.getElementById('pdBuySection');
    const ownSection = document.getElementById('pdOwnSection');
    if (item.sellerUid === window.ME.uid) {
      buySection.style.display = 'none';
      ownSection.style.display = 'block';
    } else {
      buySection.style.display = 'block';
      ownSection.style.display = 'none';
      document.getElementById('pdBuyQty').max = item.qty;
      document.getElementById('pdBuyQty').value = 1;
      updateBuyTotal(item.price);
    }
    openModal('pazarDetailModal');
  };

  window.updateBuyTotal = function(price) {
    const qty = parseInt(document.getElementById('pdBuyQty')?.value) || 1;
    const p   = price || (allListings[document.getElementById('pdKey')?.value]?.price || 0);
    const el  = document.getElementById('pdBuyTotal');
    if (el) el.textContent = 'Toplam: ' + formatMoney(p * qty);
  };

  // ── Satın al ─────────────────────────────────────────────────
  window.buyFromPazar = async function() {
    const key = document.getElementById('pdKey').value;
    const qty = parseInt(document.getElementById('pdBuyQty').value) || 1;
    // Anti-hile: Firebase'den güncel veriyi al (stale cache kullanma)
    const item = await dbGet(`pazar/${key}`);
    if (!item || item.status !== 'active') { toast('İlan artık mevcut değil', 'error'); loadPazar(); return; }
    if (item.sellerUid === window.ME.uid) { toast('Kendi ilanını satın alamazsın', 'error'); return; }
    if (qty > item.qty) { toast(`Stokta sadece ${item.qty} adet var`, 'error'); return; }

    const total = item.price * qty;
    if (!confirm(`${qty}x ${item.itemName} satın almak için ${formatMoney(total)} ödenecek. Onaylıyor musun?`)) return;

    try {
      await spendCash(window.ME.uid, total, `${item.itemName} satın alındı`);
      await addCash(item.sellerUid, total, `${item.itemName} satıldı (${qty} adet)`);

      // Envanter güncelle
      await addItem(window.ME.uid, item.itemId, qty);

      // İlan güncelle
      const newQty = item.qty - qty;
      if (newQty <= 0) {
        await db.ref(`pazar/${key}`).update({ status: 'sold', soldAt: Date.now() });
      } else {
        await db.ref(`pazar/${key}`).update({ qty: newQty });
      }

      // İstatistikler
      await db.ref(`users/${window.ME.uid}/stats/purchases`).transaction(v => (v||0)+1);
      await db.ref(`users/${item.sellerUid}/stats/sales`).transaction(v => (v||0)+1);
      await db.ref(`users/${window.ME.uid}/stats/trades`).transaction(v => (v||0)+1);
      await db.ref(`users/${item.sellerUid}/stats/trades`).transaction(v => (v||0)+1);

      // Görev ilerlemesi
      await updateMissionProgress(window.ME.uid, 'buy10', 1);
      await updateMissionProgress(window.ME.uid, 'trade5', 1);
      await updateMissionProgress(window.ME.uid, 'trade25', 1);
      await updateMissionProgress(item.sellerUid, 'sell10', 1);
      await updateMissionProgress(item.sellerUid, 'trade5', 1);

      // Satıcıya bildirim
      await dbPush(`users/${item.sellerUid}/notifs`, {
        title: '💰 Satış Gerçekleşti!',
        body: `${window.ME.username} ${qty}x ${item.itemName} satın aldı — ${formatMoney(total)}`,
        time: Date.now(), read: false
      });

      await addXP(window.ME.uid, 15);
      await addXP(item.sellerUid, 20);

      toast(`${qty}x ${item.itemName} satın alındı! ✅`, 'success');
      closeModal('pazarDetailModal');
      loadPazar();
    } catch(e) { toast(e.message, 'error'); }
  };

  // ── Hızlı satın al ──────────────────────────────────────────
  window.quickBuy = async function(key) {
    const item = allListings[key];
    if (!item) return;
    if (!confirm(`1x ${item.itemName} için ${formatMoney(item.price)} ödenecek. Onaylıyor musun?`)) return;
    try {
      await spendCash(window.ME.uid, item.price, `${item.itemName} satın alındı`);
      await addCash(item.sellerUid, item.price, `${item.itemName} satıldı`);
      await addItem(window.ME.uid, item.itemId, 1);
      const newQty = item.qty - 1;
      if (newQty <= 0) {
        await db.ref(`pazar/${key}`).update({ status: 'sold', soldAt: Date.now() });
      } else {
        await db.ref(`pazar/${key}`).update({ qty: newQty });
      }
      await db.ref(`users/${window.ME.uid}/stats/purchases`).transaction(v => (v||0)+1);
      await db.ref(`users/${item.sellerUid}/stats/sales`).transaction(v => (v||0)+1);
      await addXP(window.ME.uid, 10);
      toast(`${item.itemName} satın alındı!`, 'success');
      loadPazar();
    } catch(e) { toast(e.message, 'error'); }
  };

  // ── İlan kaldır ──────────────────────────────────────────────
  window.removeListing = async function(key) {
    if (!confirm('İlanı kaldırmak istediğine emin misin?')) return;
    // Anti-hile: Her zaman Firebase'den güncel veriyi al
    const item = await dbGet(`pazar/${key}`);
    if (!item) { toast('İlan bulunamadı', 'error'); return; }
    if (item.sellerUid !== window.ME.uid) { toast('Bu ilanı kaldıramazsın', 'error'); return; }
    if (item.status !== 'active') { toast('Bu ilan artık aktif değil', 'error'); return; }
    // Ürünleri geri ver
    await addItem(window.ME.uid, item.itemId, item.qty);
    await db.ref(`pazar/${key}`).remove();
    toast('İlan kaldırıldı, ürünler envantere eklendi ✅', 'success');
    closeModal('pazarDetailModal');
    loadPazar();
  };

  // ── İlan ekle modal ──────────────────────────────────────────
  window.openListingModal = async function() {
    const inv = await dbGet(`users/${window.ME.uid}/inventory`);
    const select = document.getElementById('listingItemSelect');
    if (!select) return;
    const catalog = window.ITEM_CATALOG || {};
    select.innerHTML = '<option value="">-- Ürün seç --</option>';

    if (!inv) { toast('Envanterin boş. Önce ürün al.', 'warning'); return; }

    Object.entries(inv).filter(([,q]) => q > 0).forEach(([id, qty]) => {
      const item = catalog[id] || { name: id, icon: '📦' };
      const opt = document.createElement('option');
      opt.value = id;
      opt.textContent = `${item.icon} ${item.name} (${qty} adet)`;
      opt.dataset.icon = item.icon;
      opt.dataset.name = item.name;
      opt.dataset.qty  = qty;
      opt.dataset.cat  = item.category || 'diger';
      select.appendChild(opt);
    });
    openModal('addListingModal');
  };

  window.onListingItemChange = function() {
    const select = document.getElementById('listingItemSelect');
    const opt = select.options[select.selectedIndex];
    if (!opt || !opt.value) return;
    const catalog = window.ITEM_CATALOG || {};
    const item = catalog[opt.value] || {};
    document.getElementById('listingMaxQty').textContent = opt.dataset.qty || '?';
    document.getElementById('listingQty').max = opt.dataset.qty || 99;
    document.getElementById('listingPrice').value = item.price || 10;
  };

  window.addPazarListing = async function() {
    const select   = document.getElementById('listingItemSelect');
    const itemId   = select.value;
    const qty      = parseInt(document.getElementById('listingQty').value) || 1;
    const price    = parseFloat(document.getElementById('listingPrice').value) || 0;
    const desc     = document.getElementById('listingDesc').value.trim();

    if (!itemId) { toast('Ürün seç', 'error'); return; }
    if (qty < 1)   { toast('Miktar en az 1 olmalı', 'error'); return; }
    if (price <= 0){ toast('Fiyat 0\'dan büyük olmalı', 'error'); return; }

    const opt    = select.options[select.selectedIndex];
    const catalog= window.ITEM_CATALOG || {};
    const item   = catalog[itemId] || {};

    try {
      await removeItem(window.ME.uid, itemId, qty);
      await dbPush('pazar', {
        itemId, itemName: item.name || itemId,
        icon: item.icon || '📦', category: item.category || 'diger',
        qty, price, desc,
        sellerUid:  window.ME.uid,
        sellerName: window.ME.username,
        status: 'active',
        createdAt: Date.now()
      });
      toast(`${qty}x ${item.name || itemId} ${formatMoney(price)}/adet fiyatıyla listelendi ✅`, 'success');
      closeModal('addListingModal');
      loadPazar();
    } catch(e) { toast(e.message, 'error'); }
  };

  // ── KENDİ İLANLARIM ─────────────────────────────────────────
  window.loadMyListings = async function() {
    const el = document.getElementById('myListingsList');
    if (!el) return;
    const snap = await dbGet('pazar');
    if (!snap) { el.innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div><p>Aktif ilanın yok</p></div>'; return; }

    const mine = Object.entries(snap).filter(([, v]) => v.sellerUid === window.ME.uid && v.status === 'active');
    if (!mine.length) { el.innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div><p>Aktif ilanın yok</p></div>'; return; }

    el.innerHTML = mine.map(([key, item]) => `
      <div class="listing-item">
        <div class="listing-icon">${item.icon || '📦'}</div>
        <div class="listing-info">
          <div class="listing-name">${item.itemName}</div>
          <div class="listing-meta">${item.qty} adet • ${timeAgo(item.createdAt)}</div>
        </div>
        <div class="listing-right">
          <div class="listing-price">${formatMoney(item.price)}/adet</div>
          <button class="btn btn-danger btn-sm" onclick="removeListing('${key}')">Kaldır</button>
        </div>
      </div>`).join('');
  };

  // ── Görev yardımcısı ─────────────────────────────────────────
  window.updateMissionProgress = async function(uid, missionId, increment) {
    try {
      await db.ref(`users/${uid}/missions/${missionId}/progress`).transaction(v => (v || 0) + increment);
    } catch(e) {}
  };

  console.log('%c[Pazar] ✅ Pazar yeri modülü yüklendi', 'color:#22c55e;font-weight:bold');
})();
/* ═══════════════════════════════════════════════════════════
   MARKET & MAĞAZAM — NPC marketler + oyuncu mağazaları
   ═══════════════════════════════════════════════════════════ */
(function() {

  // ═══════════════════════════════════════
  //  NPC MARKETLERİ
  // ═══════════════════════════════════════

  const NPC_SHOPS = {
    bakkal: {
      name: 'Bakkal',
      icon: '🏪',
      desc: 'Günlük temel ihtiyaçlar',
      color: '#22c55e',
      items: ['ekmek', 'su', 'sut', 'yumurta', 'seker', 'un', 'cift_kahve'],
    },
    kasap: {
      name: 'Kasap',
      icon: '🥩',
      desc: 'Et ve balık ürünleri',
      color: '#ef4444',
      items: ['et', 'balik'],
    },
    insaat: {
      name: 'İnşaat Malzemeleri',
      icon: '🏗️',
      desc: 'Yapı ve inşaat gereçleri',
      color: '#f97316',
      items: ['tas', 'ahsap', 'cimento', 'cam', 'boya'],
    },
    demir_celik: {
      name: 'Demir Çelik',
      icon: '⚙️',
      desc: 'Metal hammaddeler',
      color: '#64748b',
      items: ['demir', 'bakir', 'plastik'],
    },
    elektronik: {
      name: 'Elektronik',
      icon: '📱',
      desc: 'Elektronik ürünler',
      color: '#3b82f6',
      items: ['telefon', 'elektrikli_alet', 'oyun_konsolü'],
    },
    enerji: {
      name: 'Enerji Marketi',
      icon: '⚡',
      desc: 'Yakıt ve enerji kaynakları',
      color: '#f59e0b',
      items: ['komur', 'petrol'],
    },
    tekstil: {
      name: 'Tekstil',
      icon: '👕',
      desc: 'Giyim ve kumaş',
      color: '#ec4899',
      items: ['kiyafet'],
    },
    eczane: {
      name: 'Eczane',
      icon: '💊',
      desc: 'Sağlık ürünleri',
      color: '#06b6d4',
      items: ['ilaç'],
    },
    mobilya_mavis: {
      name: 'Mobilya Mağazası',
      icon: '🪑',
      desc: 'Ev ve ofis mobilyaları',
      color: '#8b5cf6',
      items: ['mobilya', 'cam'],
    },
    kitabevi: {
      name: 'Kitabevi',
      icon: '📚',
      desc: 'Kitap ve eğitim materyalleri',
      color: '#10b981',
      items: ['kitap'],
    },
  };

  window.loadMarket = function() {
    const el = document.getElementById('marketShopList');
    if (!el) return;
    el.innerHTML = Object.entries(NPC_SHOPS).map(([id, shop]) => `
      <div class="product-card" onclick="openNpcShop('${id}')" style="border-top:3px solid ${shop.color}">
        <div class="product-icon">${shop.icon}</div>
        <div class="product-name">${shop.name}</div>
        <div class="product-desc">${shop.desc}</div>
        <div style="margin-top:8px;font-size:.78rem;color:var(--text2)">${shop.items.length} ürün</div>
      </div>`).join('');
  };

  window.openNpcShop = function(shopId) {
    const shop    = NPC_SHOPS[shopId];
    const catalog = window.ITEM_CATALOG || {};
    if (!shop) return;
    document.getElementById('npcShopTitle').textContent = shop.icon + ' ' + shop.name;
    document.getElementById('npcShopDesc').textContent  = shop.desc;
    const list = document.getElementById('npcShopItems');
    list.innerHTML = shop.items.map(itemId => {
      const item  = catalog[itemId] || { name: itemId, icon: '📦', price: 10 };
      const price = Math.round((item.price || 10) * 1.15); // %15 kâr marjı
      return `<div class="listing-item">
        <div class="listing-icon">${item.icon}</div>
        <div class="listing-info">
          <div class="listing-name">${item.name}</div>
          <div class="listing-meta">${item.category || 'Genel'}</div>
        </div>
        <div class="listing-right">
          <div class="listing-price">${formatMoney(price)}</div>
          <div style="display:flex;align-items:center;gap:6px;margin-top:4px">
            <input type="number" id="npcQty_${itemId}" min="1" max="999" value="1"
              style="width:52px;padding:4px 6px;background:var(--bg3);border:1px solid var(--border);
                border-radius:6px;color:var(--text);font-size:.8rem" />
            <button class="btn btn-primary btn-sm" onclick="buyFromNpc('${itemId}', ${price})">Al</button>
          </div>
        </div>
      </div>`;
    }).join('');
    openModal('npcShopModal');
  };

  window.buyFromNpc = async function(itemId, price) {
    const uid  = window.ME.uid;
    const qty  = parseInt(document.getElementById(`npcQty_${itemId}`)?.value) || 1;
    const total= price * qty;
    const item = (window.ITEM_CATALOG || {})[itemId] || { name: itemId };

    if (!confirm(`${qty}x ${item.name} için ${formatMoney(total)} ödenecek. Onaylıyor musun?`)) return;
    try {
      await spendCash(uid, total, `Market alımı: ${item.name}`);
      await addItem(uid, itemId, qty);
      await addXP(uid, 5);
      await updateMissionProgress(uid, 'buy10', 1);
      await updateMissionProgress(uid, 'trade5', 1);
      await updateMissionProgress(uid, 'trade25', 1);
      toast(`${qty}x ${item.name} satın alındı! ✅`, 'success');
    } catch(e) { toast(e.message, 'error'); }
  };

  // ═══════════════════════════════════════
  //  OYUNCU MAĞAZALARI
  // ═══════════════════════════════════════

  window.loadMagaza = async function() {
    const uid = window.ME.uid;
    const shopData = (await dbGet(`users/${uid}/shop`)) || {};

    // Mağaza bilgilerini doldur
    document.getElementById('shopName').value  = shopData.name  || (window.ME.username + '\'ın Mağazası');
    document.getElementById('shopDesc').value  = shopData.desc  || '';
    const bannerEl = document.getElementById('shopBanner'); if (bannerEl) bannerEl.value = shopData.banner || '';

    const toggle = document.getElementById('shopToggle');
    if (toggle) {
      toggle.checked = shopData.open || false;
      toggle.onchange = () => toggleShop(toggle.checked);
    }

    loadShopInventory();
    loadShopStats();
  };

  async function loadShopInventory() {
    const uid = window.ME.uid;
    const inv  = await dbGet(`users/${uid}/inventory`);
    const shopItems = await dbGet(`shops/${uid}/items`);
    const catalog = window.ITEM_CATALOG || {};
    const el = document.getElementById('shopItemList');
    if (!el) return;

    if (!inv) { el.innerHTML = '<div class="empty-state"><div class="empty-icon">📦</div><p>Envanterin boş</p></div>'; return; }

    el.innerHTML = `<div class="table-wrap"><table>
      <thead><tr><th>Ürün</th><th>Envanter</th><th>Mağaza Fiyatı</th><th>Durum</th><th>İşlem</th></tr></thead>
      <tbody>
      ${Object.entries(inv).filter(([,q]) => q > 0).map(([itemId, qty]) => {
        const item  = catalog[itemId] || { name: itemId, icon: '📦', price: 10 };
        const listed = shopItems?.[itemId];
        return `<tr>
          <td><span style="margin-right:6px">${item.icon}</span>${item.name}</td>
          <td>${qty}</td>
          <td>
            <input type="number" id="shopPrice_${itemId}" value="${listed?.price || item.price || 10}"
              style="width:90px;padding:4px 8px;background:var(--bg3);border:1px solid var(--border);
                border-radius:6px;color:var(--text);font-size:.82rem" />
          </td>
          <td>${listed ? '<span class="badge badge-green">Listelendi</span>' : '<span class="badge badge-yellow">Listelenmedi</span>'}</td>
          <td>
            <button class="btn btn-primary btn-sm" onclick="listInShop('${itemId}')">Listele</button>
            ${listed ? `<button class="btn btn-ghost btn-sm" onclick="delistFromShop('${itemId}')">Kaldır</button>` : ''}
          </td>
        </tr>`;
      }).join('')}
      </tbody></table></div>`;
  }

  window.listInShop = async function(itemId) {
    const uid   = window.ME.uid;
    const price = parseFloat(document.getElementById(`shopPrice_${itemId}`)?.value) || 10;
    const inv   = await dbGet(`users/${uid}/inventory/${itemId}`);
    const catalog = window.ITEM_CATALOG || {};
    const item  = catalog[itemId] || { name: itemId, icon: '📦' };

    if (!inv || inv <= 0) { toast('Envanterde bu ürün yok', 'error'); return; }
    await dbSet(`shops/${uid}/items/${itemId}`, {
      itemId, name: item.name, icon: item.icon, price, qty: inv,
      category: item.category || 'diger'
    });
    await dbUpdate(`users/${uid}/shop`, { updatedAt: Date.now() });
    toast(`${item.name} mağazanda listelendi ✅`, 'success');
    loadShopInventory();
  };

  window.delistFromShop = async function(itemId) {
    const uid = window.ME.uid;
    await db.ref(`shops/${uid}/items/${itemId}`).remove();
    toast('Ürün mağazadan kaldırıldı', 'success');
    loadShopInventory();
  };

  window.saveShopSettings = async function() {
    const uid  = window.ME.uid;
    const name = document.getElementById('shopName').value.trim();
    const desc = document.getElementById('shopDesc').value.trim();
    if (!name) { toast('Mağaza adı girin', 'error'); return; }
    await dbUpdate(`users/${uid}/shop`, { name, desc, updatedAt: Date.now() });
    await dbSet(`shops/${uid}/info`, {
      ownerUid: uid, ownerName: window.ME.username, name, desc,
      updatedAt: Date.now()
    });
    toast('Mağaza ayarları kaydedildi ✅', 'success');
  };

  window.toggleShop = async function(open) {
    const uid = window.ME.uid;
    await dbUpdate(`users/${uid}/shop`, { open });
    await db.ref(`shops/${uid}/info/open`).set(open);
    toast(open ? 'Mağazan açıldı 🏪' : 'Mağazan kapatıldı', open ? 'success' : 'info');
  };

  async function loadShopStats() {
    const uid   = window.ME.uid;
    const sales = await dbGet(`users/${uid}/stats/sales`)   || 0;
    const rev   = await dbGet(`users/${uid}/stats/revenue`) || 0;
    safeSet('shopStatSales', sales);
    safeSet('shopStatRev', formatMoney(rev));
  }

  // ── TÜM MAĞAZALAR ────────────────────────────────────────────
  window.loadAllShops = async function() {
    const el = document.getElementById('allShopsList');
    if (!el) return;
    el.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text2)">⏳ Yükleniyor...</div>';
    const snap = await dbGet('shops');
    if (!snap) { el.innerHTML = '<div class="empty-state"><div class="empty-icon">🏪</div><p>Henüz mağaza yok</p></div>'; return; }

    const shops = Object.entries(snap)
      .filter(([, s]) => s.info?.open)
      .map(([uid, s]) => ({ uid, ...s.info }));

    if (!shops.length) { el.innerHTML = '<div class="empty-state"><div class="empty-icon">🏪</div><p>Açık mağaza yok</p></div>'; return; }

    el.innerHTML = `<div class="product-grid">${shops.map(s => `
      <div class="product-card" onclick="openPlayerShop('${s.uid}')">
        <div class="product-icon">🏪</div>
        <div class="product-name">${s.name || s.ownerName + "'ın Mağazası"}</div>
        <div class="product-desc">${s.desc || 'Çeşitli ürünler'}</div>
        <div class="product-seller">👤 ${s.ownerName}</div>
      </div>`).join('')}
    </div>`;
  };

  window.openPlayerShop = async function(ownerUid) {
    const shopData = await dbGet(`shops/${ownerUid}`);
    if (!shopData) { toast('Mağaza bulunamadı', 'error'); return; }
    const info  = shopData.info  || {};
    const items = shopData.items || {};

    document.getElementById('playerShopTitle').textContent = info.name || 'Mağaza';
    document.getElementById('playerShopOwner').textContent = '👤 ' + (info.ownerName || '?');
    document.getElementById('playerShopDesc').textContent  = info.desc || '';

    const list = document.getElementById('playerShopItems');
    const itemList = Object.entries(items);
    if (!itemList.length) {
      list.innerHTML = '<div class="empty-state"><div class="empty-icon">📦</div><p>Mağazada ürün yok</p></div>';
    } else {
      list.innerHTML = itemList.map(([itemId, item]) => `
        <div class="listing-item">
          <div class="listing-icon">${item.icon || '📦'}</div>
          <div class="listing-info">
            <div class="listing-name">${item.name}</div>
            <div class="listing-meta">${item.qty} adet stok</div>
          </div>
          <div class="listing-right">
            <div class="listing-price">${formatMoney(item.price)}</div>
            ${ownerUid !== window.ME.uid ?
              `<button class="btn btn-primary btn-sm" onclick="buyFromPlayerShop('${ownerUid}','${itemId}',${item.price})">Satın Al</button>` : ''}
          </div>
        </div>`).join('');
    }
    openModal('playerShopModal');
    document.getElementById('playerShopModal').dataset.owner = ownerUid;
  };

  window.buyFromPlayerShop = async function(ownerUid, itemId, price) {
    const uid  = window.ME.uid;
    if (ownerUid === uid) { toast('Kendi ürününü satın alamazsın', 'error'); return; }
    // Anti-hile: Güncel stok kontrolü Firebase'den
    const shopItem = await dbGet(`shops/${ownerUid}/items/${itemId}`);
    if (!shopItem || shopItem.qty <= 0) { toast('Stokta yok', 'error'); return; }
    // Fiyat manipülasyon koruması: aktarılan fiyat ile Firebase fiyatını karşılaştır
    const actualPrice = shopItem.price;
    if (!confirm(`${shopItem.name} için ${formatMoney(actualPrice)} ödenecek. Onaylıyor musun?`)) return;
    const netRevenue = Math.round(actualPrice * 0.95); // %5 komisyon
    try {
      await spendCash(uid, actualPrice, `${shopItem.name} satın alındı`);
      await addCash(ownerUid, netRevenue, `${shopItem.name} satıldı (%5 komisyon düşüldü)`);
      await addItem(uid, itemId, 1);
      const newQty = shopItem.qty - 1;
      if (newQty <= 0) {
        await db.ref(`shops/${ownerUid}/items/${itemId}`).remove();
      } else {
        await db.ref(`shops/${ownerUid}/items/${itemId}/qty`).set(newQty);
      }
      // İstatistikler ve gelir takibi
      await db.ref(`users/${uid}/stats/purchases`).transaction(v => (v||0)+1);
      await db.ref(`users/${ownerUid}/stats/sales`).transaction(v => (v||0)+1);
      await db.ref(`users/${ownerUid}/stats/revenue`).transaction(v => (v||0)+netRevenue);
      await db.ref(`users/${uid}/stats/trades`).transaction(v => (v||0)+1);
      await db.ref(`users/${ownerUid}/stats/trades`).transaction(v => (v||0)+1);
      await updateMissionProgress(uid, 'buy10', 1);
      await updateMissionProgress(uid, 'trade5', 1);
      await updateMissionProgress(uid, 'trade25', 1);
      await updateMissionProgress(ownerUid, 'sell10', 1);
      await addXP(uid, 10);
      await addXP(ownerUid, 15);
      // Satıcıya bildirim
      await dbPush(`users/${ownerUid}/notifs`, {
        title: '💰 Mağazandan Satış!',
        body: `${window.ME.username} mağazandan ${shopItem.name} satın aldı — ${formatMoney(actualPrice)}`,
        time: Date.now(), read: false
      });
      toast(`${shopItem.name} satın alındı! ✅`, 'success');
      openPlayerShop(ownerUid);
    } catch(e) { toast(e.message, 'error'); }
  };

  function safeSet(id, val) { const e = document.getElementById(id); if (e) e.textContent = val; }

  console.log('%c[Market] ✅ Market & Mağaza modülü yüklendi', 'color:#22c55e;font-weight:bold');
})();
