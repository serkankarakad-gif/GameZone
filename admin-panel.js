/* ╔══════════════════════════════════════════════════════════════════════════╗
   ║                                                                          ║
   ║   👑 GAMEZONE ADMİN PANELİ v4.0 — TAM YETKİ MERKEZİ                     ║
   ║                                                                          ║
   ║   380 ÖZELLİK — Dashboard · Kullanıcı · Ekonomi · Oyun ·               ║
   ║   İletişim · İşletme · Güvenlik · Sistem · Analitik · Tema              ║
   ║                                                                          ║
   ║   GİRİŞ: ⚡ Yetkili sekmesi → e-posta + şifre + serkan2026             ║
   ║   E-POSTA: Kaynak kodda görünmez (4 katman hash)                        ║
   ║                                                                          ║
   ╚══════════════════════════════════════════════════════════════════════════╝ */

(function AdminPanel() {
  'use strict';

  /* ══════════════════════════════════════════════════════════════════════════
     BÖLÜM 0: CORE HELPERS & YETKİ KONTROL
     ══════════════════════════════════════════════════════════════════════════ */
  const db  = () => firebase.database();
  const TS  = () => firebase.database.ServerValue.TIMESTAMP;
  const uid = () => firebase.auth().currentUser?.uid;

  /* ─── E-posta hash kontrolü (4 katman, kaynak kodda e-posta YOK) ─── */
  function _isAdminEmail(em) {
    if (!em || typeof em !== 'string') return false;
    const e = em.trim().toLowerCase();
    const h = [...e].reduce((a, c) => a + c.charCodeAt(0), 0);
    let x = 0; for (let i = 0; i < e.length; i++) x = ((x << 3) - x + e.charCodeAt(i)) & 0xFFFF;
    let m = 1; for (let i = 0; i < e.length; i++) m = (m * 31 + e.charCodeAt(i)) & 0x7FFFFFFF;
    return h === 1908 && e.length === 20 && x === 64726 && m === 2009737551
        && e.charCodeAt(0) === 115 && e.charCodeAt(19) === 109;
  }

  /* ─── DB Helpers ─── */
  const _get    = p => db().ref(p).once('value').then(s => s.val());
  const _set    = (p, v) => db().ref(p).set(v);
  const _upd    = (p, o) => db().ref(p).update(o);
  const _push   = (p, v) => db().ref(p).push(v);
  const _rm     = p => db().ref(p).remove();
  const _tx     = (p, fn) => db().ref(p).transaction(fn);
  const _nowTs  = () => Date.now();

  /* ─── Güvenli sayı ─── */
  const safeNum = (v, def = 0) => (isFinite(v) && !isNaN(v)) ? Number(v) : def;

  /* ─── Admin log ─── */
  async function _adminLog(action, details = {}) {
    try {
      await _push('adminLogs', {
        ts: TS(), adminUid: uid() || 'system',
        action, details: JSON.stringify(details).slice(0, 500)
      });
    } catch(e) {}
  }

  /* ─── Toast helper ─── */
  function _toast(msg, kind = 'success', ms = 3500) {
    if (typeof window.toast === 'function') window.toast(msg, kind, ms);
    else alert((kind === 'error' ? '❌ ' : '✅ ') + msg);
  }

  /* ─── Modal helper ─── */
  function _modal(title, html, wide = false) {
    if (typeof window.showModal === 'function') {
      window.showModal(title, html, wide);
    } else {
      const m = document.getElementById('adminModal');
      if (m) { m.querySelector('.admin-modal-title').textContent = title; m.querySelector('.admin-modal-body').innerHTML = html; m.style.display = 'flex'; }
    }
  }
  function _closeModal() {
    if (typeof window.closeModal === 'function') window.closeModal();
    const m = document.getElementById('adminModal');
    if (m) m.style.display = 'none';
  }

  /* ─── cashFmt helper ─── */
  const _fmt = n => new Intl.NumberFormat('tr-TR', { style:'currency', currency:'TRY', minimumFractionDigits:0 }).format(n || 0);

  /* ─── Tablo render helper ─── */
  function _table(cols, rows, actions = '') {
    return `<div class="admin-table-wrap">
      <table class="admin-table">
        <thead><tr>${cols.map(c => `<th>${c}</th>`).join('')}${actions?'<th>İşlem</th>':''}</tr></thead>
        <tbody>${rows.map(r => `<tr>${r.map(c=>`<td>${c??''}</td>`).join('')}${actions?`<td>${actions}</td>`:''}</tr>`).join('')}</tbody>
      </table>
    </div>`;
  }

  /* ══════════════════════════════════════════════════════════════════════════
     BÖLÜM 1: ANA DASHBOARD (25 Özellik)
     ══════════════════════════════════════════════════════════════════════════ */
  async function renderDashboard() {
    const panel = document.getElementById(window._adminTarget||'adminPanelBody');
    if (!panel) return;
    panel.innerHTML = '<div class="admin-loading">📊 Dashboard yükleniyor...</div>';

    try {
      const [usersSnap, bankSnap, cryptoSnap, stocksSnap, marketSnap, auctionSnap, txSnap, secSnap] = await Promise.all([
        _get('users'), _get('bank'), _get('crypto/holdings'), _get('stocks/holdings'),
        _get('playerMarket'), _get('auctions'), _get('txLog'), _get('security/founderAttempts')
      ]);

      const users = usersSnap || {};
      const uids  = Object.keys(users);
      const now   = Date.now();
      const day   = 24 * 3600 * 1000;

      // Hesapla
      const totalUsers    = uids.length;
      const onlineUsers   = uids.filter(u => users[u].online === true).length;
      const todayNew      = uids.filter(u => users[u].createdAt && (now - users[u].createdAt) < day).length;
      const weekActive    = uids.filter(u => users[u].lastLogin && (now - users[u].lastLogin) < 7*day).length;
      const bannedCount   = uids.filter(u => users[u].banned === true).length;
      const frozenCount   = uids.filter(u => users[u].frozen === true).length;
      const vipCount      = uids.filter(u => users[u].isVip === true).length;
      const adminCount    = uids.filter(u => users[u].isFounder === true).length;

      const totalMoney    = uids.reduce((s, u) => s + (users[u].money || 0), 0);
      const totalDiamonds = uids.reduce((s, u) => s + (users[u].diamonds || 0), 0);
      const avgLevel      = totalUsers ? (uids.reduce((s, u) => s + (users[u].level || 1), 0) / totalUsers).toFixed(1) : 0;
      const avgMoney      = totalUsers ? Math.floor(totalMoney / totalUsers) : 0;

      // Banka toplamı
      const bankData = bankSnap || {};
      let totalBank = 0, totalInvest = 0, totalDebt = 0;
      Object.values(bankData).forEach(b => {
        totalBank    += b.balance    || 0;
        totalInvest  += b.investment || 0;
        totalDebt    += b.loan       || 0;
      });

      // Aktif ilanlar
      const activeListings = Object.values(marketSnap || {}).filter(l => l && l.remaining > 0).length;
      const activeAuctions = Object.keys(auctionSnap || {}).length;

      // Admin giriş denemeleri
      const attempts = Object.values(secSnap || {});
      const failedAttempts = attempts.filter(a => !a.success).length;

      // Top 5 zengin
      const richList = uids.sort((a, b) => (users[b].money || 0) - (users[a].money || 0)).slice(0, 5);
      // Top 5 seviye
      const levelList = uids.sort((a, b) => (users[b].level || 1) - (users[a].level || 1)).slice(0, 5);

      panel.innerHTML = `
        <div class="admin-section">
          <h2 class="admin-section-title">📊 Canlı Dashboard</h2>
          <div class="admin-refresh-bar">
            <button class="admin-btn-sm" onclick="window.AP.renderDashboard()">🔄 Yenile</button>
            <span class="admin-muted">Son güncelleme: ${new Date().toLocaleTimeString('tr-TR')}</span>
          </div>

          <!-- STAT KARTLARI -->
          <div class="admin-stats-grid">
            <div class="admin-stat-card blue">
              <div class="asc-icon">👥</div>
              <div class="asc-num">${totalUsers.toLocaleString('tr-TR')}</div>
              <div class="asc-lbl">Toplam Oyuncu</div>
            </div>
            <div class="admin-stat-card green">
              <div class="asc-icon">🟢</div>
              <div class="asc-num">${onlineUsers.toLocaleString('tr-TR')}</div>
              <div class="asc-lbl">Şu An Online</div>
            </div>
            <div class="admin-stat-card yellow">
              <div class="asc-icon">🆕</div>
              <div class="asc-num">${todayNew.toLocaleString('tr-TR')}</div>
              <div class="asc-lbl">Bugün Kayıt</div>
            </div>
            <div class="admin-stat-card purple">
              <div class="asc-icon">📅</div>
              <div class="asc-num">${weekActive.toLocaleString('tr-TR')}</div>
              <div class="asc-lbl">Haftalık Aktif</div>
            </div>
            <div class="admin-stat-card gold">
              <div class="asc-icon">💰</div>
              <div class="asc-num">${_fmt(totalMoney)}</div>
              <div class="asc-lbl">Toplam Para</div>
            </div>
            <div class="admin-stat-card teal">
              <div class="asc-icon">💎</div>
              <div class="asc-num">${totalDiamonds.toLocaleString('tr-TR')}</div>
              <div class="asc-lbl">Toplam Elmas</div>
            </div>
            <div class="admin-stat-card blue">
              <div class="asc-icon">🏦</div>
              <div class="asc-num">${_fmt(totalBank + totalInvest)}</div>
              <div class="asc-lbl">Toplam Banka</div>
            </div>
            <div class="admin-stat-card red">
              <div class="asc-icon">💳</div>
              <div class="asc-num">${_fmt(totalDebt)}</div>
              <div class="asc-lbl">Toplam Borç</div>
            </div>
            <div class="admin-stat-card orange">
              <div class="asc-icon">🛒</div>
              <div class="asc-num">${activeListings.toLocaleString('tr-TR')}</div>
              <div class="asc-lbl">Aktif İlan</div>
            </div>
            <div class="admin-stat-card purple">
              <div class="asc-icon">⚖️</div>
              <div class="asc-num">${activeAuctions.toLocaleString('tr-TR')}</div>
              <div class="asc-lbl">Aktif İhale</div>
            </div>
            <div class="admin-stat-card red">
              <div class="asc-icon">🚫</div>
              <div class="asc-num">${bannedCount.toLocaleString('tr-TR')}</div>
              <div class="asc-lbl">Banlı Oyuncu</div>
            </div>
            <div class="admin-stat-card yellow">
              <div class="asc-icon">🔒</div>
              <div class="asc-num">${frozenCount.toLocaleString('tr-TR')}</div>
              <div class="asc-lbl">Dondurulmuş</div>
            </div>
          </div>

          <!-- EKONOMİ ÖZET -->
          <div class="admin-row-2">
            <div class="admin-card">
              <h3>💹 Ekonomi Özeti</h3>
              <table class="admin-mini-table">
                <tr><td>Ortalama Seviye</td><td><b>${avgLevel}</b></td></tr>
                <tr><td>Ortalama Para</td><td><b>${_fmt(avgMoney)}</b></td></tr>
                <tr><td>VIP Oyuncu</td><td><b>${vipCount}</b></td></tr>
                <tr><td>Admin/Kurucu</td><td><b>${adminCount}</b></td></tr>
                <tr><td>Toplam Yatırım</td><td><b>${_fmt(totalInvest)}</b></td></tr>
                <tr><td>Admin Giriş Denemesi</td><td><b>${attempts.length} (${failedAttempts} başarısız)</b></td></tr>
              </table>
            </div>

            <div class="admin-card">
              <h3>👑 En Zengin 5</h3>
              ${richList.map((u, i) => `
                <div class="admin-user-row" onclick="window.AP.openUserDetail('${u}')">
                  <span class="rank">${i+1}.</span>
                  <span class="uname">${users[u].username || '?'}</span>
                  <span class="umoney">${_fmt(users[u].money || 0)}</span>
                </div>`).join('')}
            </div>

            <div class="admin-card">
              <h3>🏅 En Yüksek Seviye 5</h3>
              ${levelList.map((u, i) => `
                <div class="admin-user-row" onclick="window.AP.openUserDetail('${u}')">
                  <span class="rank">${i+1}.</span>
                  <span class="uname">${users[u].username || '?'}</span>
                  <span class="ulevel">Lv ${users[u].level || 1}</span>
                </div>`).join('')}
            </div>
          </div>

          <!-- HIZLI İŞLEMLER -->
          <div class="admin-card">
            <h3>⚡ Hızlı İşlemler</h3>
            <div class="admin-quick-actions">
              <button class="admin-btn green" onclick="window.AP.openBroadcastModal()">📢 Duyuru Yayınla</button>
              <button class="admin-btn red" onclick="window.AP.toggleMaintModal()">🔧 Bakım Modu</button>
              <button class="admin-btn blue" onclick="window.AP.openUserSearch()">🔍 Kullanıcı Ara</button>
              <button class="admin-btn yellow" onclick="window.AP.openGlobalEconModal()">💰 Global Ekonomi</button>
              <button class="admin-btn purple" onclick="window.AP.openEventModal()">🎉 Etkinlik Başlat</button>
              <button class="admin-btn teal" onclick="window.AP.openBulkNotifModal()">📨 Toplu Bildirim</button>
              <button class="admin-btn orange" onclick="window.AP.openAllUsersModal()">👥 Tüm Kullanıcılar</button>
              <button class="admin-btn red" onclick="window.AP.openSecurityLogs()">🛡️ Güvenlik Logları</button>
            </div>
          </div>
        </div>`;

    } catch(e) {
      panel.innerHTML = `<div class="admin-error">❌ Dashboard yüklenemedi: ${e.message}</div>`;
    }
  }

  /* ══════════════════════════════════════════════════════════════════════════
     BÖLÜM 2: KULLANICI YÖNETİMİ (65 Özellik)
     ══════════════════════════════════════════════════════════════════════════ */

  /* Kullanıcı Arama */
  function openUserSearch() {
    _modal('🔍 Kullanıcı Ara', `
      <div class="admin-search-box">
        <div class="admin-filter-row">
          <input type="text" id="usrQ" placeholder="Kullanıcı adı, UID veya e-posta..." class="admin-input">
          <button class="admin-btn blue" onclick="window.AP._searchUsers()">Ara</button>
        </div>
        <div class="admin-filter-row">
          <select id="usrFilter" class="admin-select">
            <option value="all">Tüm Kullanıcılar</option>
            <option value="banned">Banlılar</option>
            <option value="frozen">Donmuşlar</option>
            <option value="vip">VIP</option>
            <option value="admin">Adminler</option>
            <option value="active">Son 7 gün aktif</option>
            <option value="inactive">14+ gün inaktif</option>
          </select>
          <input type="number" id="usrLvMin" placeholder="Min Seviye" class="admin-input-sm">
          <input type="number" id="usrLvMax" placeholder="Max Seviye" class="admin-input-sm">
          <button class="admin-btn yellow" onclick="window.AP._filterUsers()">Filtrele</button>
        </div>
      </div>
      <div id="usrResults" class="admin-user-results"></div>
    `, true);
  }

  async function _searchUsers() {
    const q = document.getElementById('usrQ')?.value?.trim()?.toLowerCase() || '';
    const snap = await _get('users');
    const users = snap || {};
    let results = Object.entries(users).filter(([uid, u]) =>
      !q || (u.username||'').toLowerCase().includes(q) ||
             uid.includes(q) ||
             (u.email||'').toLowerCase().includes(q)
    ).slice(0, 50);
    _renderUserResults(results, users);
  }

  async function _filterUsers() {
    const filter = document.getElementById('usrFilter')?.value;
    const lvMin  = safeNum(document.getElementById('usrLvMin')?.value, 0);
    const lvMax  = safeNum(document.getElementById('usrLvMax')?.value, 999);
    const snap   = await _get('users');
    const users  = snap || {};
    const now    = Date.now();
    const day    = 24 * 3600 * 1000;

    let results = Object.entries(users).filter(([uid, u]) => {
      const lv = u.level || 1;
      if (lv < lvMin || lv > lvMax) return false;
      if (filter === 'banned')   return u.banned === true;
      if (filter === 'frozen')   return u.frozen === true;
      if (filter === 'vip')      return u.isVip === true;
      if (filter === 'admin')    return u.isFounder === true;
      if (filter === 'active')   return u.lastLogin && (now - u.lastLogin) < 7*day;
      if (filter === 'inactive') return !u.lastLogin || (now - u.lastLogin) > 14*day;
      return true;
    }).slice(0, 100);
    _renderUserResults(results, users);
  }

  function _renderUserResults(results, allUsers) {
    const div = document.getElementById('usrResults');
    if (!div) return;
    if (!results.length) { div.innerHTML = '<p class="admin-muted">Sonuç yok</p>'; return; }
    div.innerHTML = `<p class="admin-muted">${results.length} sonuç</p>
    <div class="admin-user-list">
      ${results.map(([id, u]) => `
        <div class="admin-user-item" onclick="window.AP.openUserDetail('${id}')">
          <div class="aui-avatar">${u.avatar ? u.avatar : '👤'}</div>
          <div class="aui-info">
            <div class="aui-name">${u.username||'İsimsiz'}
              ${u.banned ? '<span class="badge-red">BANLANDI</span>' : ''}
              ${u.frozen ? '<span class="badge-blue">DONDURULDU</span>' : ''}
              ${u.isFounder ? '<span class="badge-gold">ADMİN</span>' : ''}
              ${u.isVip ? '<span class="badge-purple">VIP</span>' : ''}
            </div>
            <div class="aui-meta">Lv ${u.level||1} · ${_fmt(u.money||0)} · ${u.diamonds||0}💎</div>
          </div>
          <div class="aui-uid">${id.slice(0,8)}...</div>
        </div>
      `).join('')}
    </div>`;
  }

  /* Kullanıcı Detay Sayfası */
  async function openUserDetail(targetUid) {
    _modal('👤 Kullanıcı Detayı', '<div class="admin-loading">Yükleniyor...</div>', true);
    const [userData, bankData, cryptoData, stockData, txData] = await Promise.all([
      _get('users/' + targetUid),
      _get('bank/' + targetUid),
      _get('crypto/holdings/' + targetUid),
      _get('stocks/holdings/' + targetUid),
      _get('txLog/' + targetUid)
    ]);

    const u = userData || {};
    const b = bankData  || { balance:0, investment:0, loan:0 };
    const txList = Object.values(txData || {}).sort((a,b_) => (b_.ts||0) - (a.ts||0)).slice(0, 20);

    const modal = document.querySelector('.modal-content') || document.getElementById(window._adminTarget||'adminPanelBody');
    if (!modal) return;

    const html = `
      <div class="admin-user-detail">

        <!-- PROFIL BAŞLIK -->
        <div class="aud-header" style="background:${u.bannerColor||'#3b82f6'}">
          <div class="aud-avatar">${u.avatar || '👤'}</div>
          <div class="aud-name">${u.username || 'İsimsiz'}
            ${u.banned ? '<span class="badge-red">BANLANDI</span>' : ''}
            ${u.frozen ? '<span class="badge-blue">DONDURULDU</span>' : ''}
            ${u.isFounder ? '<span class="badge-gold">👑 ADMİN</span>' : ''}
          </div>
          <div class="aud-uid">${targetUid}</div>
        </div>

        <!-- TEMEL BİLGİLER -->
        <div class="aud-grid">
          <div class="aud-card">
            <h4>📋 Temel Bilgiler</h4>
            <table class="admin-mini-table">
              <tr><td>Kullanıcı Adı</td><td><b>${u.username||'—'}</b></td></tr>
              <tr><td>Seviye</td><td><b>Lv ${u.level||1}</b></td></tr>
              <tr><td>XP</td><td><b>${(u.xp||0).toLocaleString('tr-TR')}</b></td></tr>
              <tr><td>Prestij</td><td><b>${u.prestige||0}</b></td></tr>
              <tr><td>Kayıt Tarihi</td><td><b>${u.createdAt ? new Date(u.createdAt).toLocaleDateString('tr-TR') : '?'}</b></td></tr>
              <tr><td>Son Giriş</td><td><b>${u.lastLogin ? new Date(u.lastLogin).toLocaleDateString('tr-TR') : '?'}</b></td></tr>
              <tr><td>Aktif Pet</td><td><b>${u.activePet || '—'}</b></td></tr>
              <tr><td>Unvan</td><td><b>${u.title || '—'}</b></td></tr>
            </table>
          </div>

          <div class="aud-card">
            <h4>💰 Ekonomi</h4>
            <table class="admin-mini-table">
              <tr><td>Para (Cüzdan)</td><td><b>${_fmt(u.money||0)}</b></td></tr>
              <tr><td>Elmas</td><td><b>${u.diamonds||0} 💎</b></td></tr>
              <tr><td>Banka Bakiyesi</td><td><b>${_fmt(b.balance||0)}</b></td></tr>
              <tr><td>Yatırım</td><td><b>${_fmt(b.investment||0)}</b></td></tr>
              <tr><td>Borç</td><td><b style="color:#dc2626">${_fmt(b.loan||0)}</b></td></tr>
              <tr><td>Net Değer</td><td><b>${_fmt(u.netWorth||0)}</b></td></tr>
              <tr><td>Haftalık Gelir</td><td><b>${_fmt(u.weeklyRevenue||0)}</b></td></tr>
            </table>
          </div>

          <div class="aud-card">
            <h4>🔒 Durum & Güvenlik</h4>
            <table class="admin-mini-table">
              <tr><td>Ban Durumu</td><td><b style="color:${u.banned?'#dc2626':'#16a34a'}">${u.banned?'BANLANDI':'Aktif'}</b></td></tr>
              <tr><td>Ban Sebebi</td><td><b>${u.banReason||'—'}</b></td></tr>
              <tr><td>Dondurulmuş</td><td><b>${u.frozen?'EVET':'Hayır'}</b></td></tr>
              <tr><td>VIP</td><td><b>${u.isVip?'✅ VIP':'—'}</b></td></tr>
              <tr><td>Admin</td><td><b>${u.isFounder?'✅ ADMİN':'—'}</b></td></tr>
            </table>
          </div>
        </div>

        <!-- ADMIN İŞLEM BUTONLARI -->
        <div class="aud-actions">
          <h4>⚡ Kullanıcıya Uygula</h4>
          <div class="aud-btn-grid">
            <div class="aud-action-group">
              <h5>💰 Para / Ekonomi</h5>
              <div class="aud-input-row">
                <input type="number" id="au_money" placeholder="₺ Tutar" class="admin-input-sm">
                <button class="admin-btn green" onclick="window.AP.userGrantMoney('${targetUid}')">+Para Ver</button>
                <button class="admin-btn red" onclick="window.AP.userRemoveMoney('${targetUid}')">-Para Al</button>
              </div>
              <div class="aud-input-row">
                <input type="number" id="au_diamond" placeholder="💎 Elmas" class="admin-input-sm">
                <button class="admin-btn blue" onclick="window.AP.userGrantDiamond('${targetUid}')">+Elmas Ver</button>
                <button class="admin-btn orange" onclick="window.AP.userRemoveDiamond('${targetUid}')">-Elmas Al</button>
              </div>
              <div class="aud-input-row">
                <input type="number" id="au_xp" placeholder="XP Miktarı" class="admin-input-sm">
                <button class="admin-btn purple" onclick="window.AP.userGrantXP('${targetUid}')">+XP Ver</button>
              </div>
              <div class="aud-input-row">
                <input type="number" id="au_level" placeholder="Seviye (1-100)" min="1" max="100" class="admin-input-sm">
                <button class="admin-btn teal" onclick="window.AP.userSetLevel('${targetUid}')">Seviye Ayarla</button>
              </div>
              <div class="aud-input-row">
                <button class="admin-btn yellow" onclick="window.AP.userResetDebt('${targetUid}')">💳 Borcu Sıfırla</button>
                <button class="admin-btn teal" onclick="window.AP.userResetCrypto('${targetUid}')">📈 Kripto Sıfırla</button>
                <button class="admin-btn orange" onclick="window.AP.userResetStocks('${targetUid}')">📊 Hisse Sıfırla</button>
              </div>
            </div>

            <div class="aud-action-group">
              <h5>🔒 Hesap İşlemleri</h5>
              <div class="aud-input-row">
                <input type="text" id="au_ban_reason" placeholder="Ban sebebi" class="admin-input-sm">
                <button class="admin-btn red" onclick="window.AP.userBan('${targetUid}')">🚫 Banla</button>
                <button class="admin-btn green" onclick="window.AP.userUnban('${targetUid}')">✅ Banı Kaldır</button>
              </div>
              <div class="aud-input-row">
                <button class="admin-btn blue" onclick="window.AP.userFreeze('${targetUid}')">❄️ Dondur</button>
                <button class="admin-btn yellow" onclick="window.AP.userUnfreeze('${targetUid}')">🔥 Çöz</button>
                <button class="admin-btn red" onclick="window.AP.userResetAccount('${targetUid}')">♻️ Hesap Sıfırla</button>
              </div>
              <div class="aud-input-row">
                <button class="admin-btn purple" onclick="window.AP.userGrantVIP('${targetUid}')">⭐ VIP Ver</button>
                <button class="admin-btn orange" onclick="window.AP.userRevokeVIP('${targetUid}')">VIP Kaldır</button>
              </div>
              <div class="aud-input-row">
                <button class="admin-btn gold" onclick="window.AP.userGrantAdmin('${targetUid}')">👑 Admin Ver</button>
                <button class="admin-btn red" onclick="window.AP.userRevokeAdmin('${targetUid}')">Admin Kaldır</button>
              </div>
              <div class="aud-input-row">
                <button class="admin-btn teal" onclick="window.AP.userResetDailyBonus('${targetUid}')">🎁 Günlük Bonus Sıfırla</button>
                <button class="admin-btn blue" onclick="window.AP.userResetWheel('${targetUid}')">🎡 Çark Sıfırla</button>
              </div>
            </div>

            <div class="aud-action-group">
              <h5>🎨 Özel & Unvan</h5>
              <div class="aud-input-row">
                <input type="text" id="au_title" placeholder="Unvan metni" class="admin-input-sm">
                <input type="color" id="au_title_color" value="#fbbf24">
                <button class="admin-btn gold" onclick="window.AP.userGrantTitle('${targetUid}')">🎖️ Unvan Ver</button>
              </div>
              <div class="aud-input-row">
                <button class="admin-btn orange" onclick="window.AP.userRemoveTitle('${targetUid}')">Unvanı Kaldır</button>
                <button class="admin-btn purple" onclick="window.AP.userCompleteAllAch('${targetUid}')">🏅 Tüm Başarımlar</button>
              </div>
              <div class="aud-input-row">
                <button class="admin-btn teal" onclick="window.AP.userCompleteAllTech('${targetUid}')">🔬 Tüm Ar-Ge</button>
                <button class="admin-btn blue" onclick="window.AP.userCompleteAllCourses('${targetUid}')">🎓 Tüm Kurslar</button>
              </div>
            </div>

            <div class="aud-action-group">
              <h5>📨 Mesaj</h5>
              <div class="aud-input-row">
                <textarea id="au_msg" placeholder="Kullanıcıya özel mesaj" rows="2" class="admin-textarea"></textarea>
              </div>
              <button class="admin-btn blue" onclick="window.AP.userSendMsg('${targetUid}')">📩 Mesaj Gönder</button>
              <button class="admin-btn teal" onclick="window.AP.userSendReward('${targetUid}')">🎁 Sürpriz Ödül</button>
            </div>
          </div>
        </div>

        <!-- İŞLEM GEÇMİŞİ -->
        <div class="aud-txlog">
          <h4>📜 Son 20 İşlem</h4>
          ${txList.length ? `<div class="admin-table-wrap">
            <table class="admin-table">
              <thead><tr><th>Tarih</th><th>Tür</th><th>Tutar</th><th>Sebep</th></tr></thead>
              <tbody>
                ${txList.map(tx => `<tr>
                  <td>${new Date(tx.ts||0).toLocaleString('tr-TR', {day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</td>
                  <td><span class="badge-${tx.type==='in'?'green':'red'}">${tx.type==='in'?'GELİR':'GİDER'}</span></td>
                  <td><b style="color:${tx.type==='in'?'#16a34a':'#dc2626'}">${tx.type==='in'?'+':'−'}${_fmt(Math.abs(tx.amount||0))}</b></td>
                  <td>${tx.reason||'—'}</td>
                </tr>`).join('')}
              </tbody>
            </table>
          </div>` : '<p class="admin-muted">İşlem geçmişi yok</p>'}
        </div>
      </div>
    `;

    const modalBody = document.querySelector('.modal-body') || document.querySelector('.modal-content');
    if (modalBody) modalBody.innerHTML = html;
    else _modal('👤 Kullanıcı Detayı', html, true);
  }

  /* Kullanıcı İşlem Fonksiyonları */
  async function userGrantMoney(tuid) {
    const amt = safeNum(document.getElementById('au_money')?.value);
    if (!amt || amt <= 0) return _toast('Geçerli tutar gir', 'error');
    await _tx('users/' + tuid + '/money', c => (c||0) + amt);
    await _adminLog('grant_money', { tuid, amt });
    _toast(`+${_fmt(amt)} verildi`);
  }

  async function userRemoveMoney(tuid) {
    const amt = safeNum(document.getElementById('au_money')?.value);
    if (!amt || amt <= 0) return _toast('Geçerli tutar gir', 'error');
    await _tx('users/' + tuid + '/money', c => Math.max(0, (c||0) - amt));
    await _adminLog('remove_money', { tuid, amt });
    _toast(`−${_fmt(amt)} alındı`);
  }

  async function userGrantDiamond(tuid) {
    const amt = Math.floor(safeNum(document.getElementById('au_diamond')?.value));
    if (!amt || amt <= 0) return _toast('Geçerli miktar gir', 'error');
    await _tx('users/' + tuid + '/diamonds', c => (c||0) + amt);
    await _adminLog('grant_diamond', { tuid, amt });
    _toast(`+${amt} 💎 verildi`);
  }

  async function userRemoveDiamond(tuid) {
    const amt = Math.floor(safeNum(document.getElementById('au_diamond')?.value));
    if (!amt || amt <= 0) return _toast('Geçerli miktar gir', 'error');
    await _tx('users/' + tuid + '/diamonds', c => Math.max(0, (c||0) - amt));
    await _adminLog('remove_diamond', { tuid, amt });
    _toast(`−${amt} 💎 alındı`);
  }

  async function userGrantXP(tuid) {
    const amt = safeNum(document.getElementById('au_xp')?.value);
    if (!amt || amt <= 0) return _toast('Geçerli XP gir', 'error');
    await _tx('users/' + tuid + '/xp', c => (c||0) + amt);
    await _adminLog('grant_xp', { tuid, amt });
    _toast(`+${amt} XP verildi`);
  }

  async function userSetLevel(tuid) {
    const lv = Math.floor(safeNum(document.getElementById('au_level')?.value));
    if (!lv || lv < 1 || lv > 100) return _toast('1-100 arası seviye gir', 'error');
    await _upd('users/' + tuid, { level: lv, xp: 0 });
    await _adminLog('set_level', { tuid, lv });
    _toast(`Seviye ${lv} ayarlandı`);
  }

  async function userBan(tuid) {
    const reason = document.getElementById('au_ban_reason')?.value || 'Admin kararı';
    await _upd('users/' + tuid, { banned: true, banReason: reason, bannedAt: TS() });
    await _adminLog('ban', { tuid, reason });
    _toast(`🚫 ${tuid.slice(0,8)} banlandı`);
  }

  async function userUnban(tuid) {
    await _upd('users/' + tuid, { banned: false, banReason: null });
    await _adminLog('unban', { tuid });
    _toast(`✅ Ban kaldırıldı`);
  }

  async function userFreeze(tuid) {
    await _upd('users/' + tuid, { frozen: true, frozenAt: TS() });
    await _adminLog('freeze', { tuid });
    _toast(`❄️ Hesap donduruldu`);
  }

  async function userUnfreeze(tuid) {
    await _upd('users/' + tuid, { frozen: false });
    await _adminLog('unfreeze', { tuid });
    _toast(`🔥 Hesap çözüldü`);
  }

  async function userResetAccount(tuid) {
    if (!confirm('Hesabı TAMAMEN sıfırla? (Para, işletme, kriptolar silinir)')) return;
    const startMoney = (await _get('system/settings/startMoney')) || 10000;
    await _upd('users/' + tuid, { money: startMoney, level: 1, xp: 0, prestige: 0, diamonds: 10 });
    await _rm('bank/' + tuid);
    await _rm('businesses/' + tuid);
    await _rm('crypto/holdings/' + tuid);
    await _rm('stocks/holdings/' + tuid);
    await _adminLog('reset_account', { tuid });
    _toast(`♻️ Hesap sıfırlandı`);
  }

  async function userGrantVIP(tuid) {
    await _upd('users/' + tuid, { isVip: true, vipSince: TS() });
    await _adminLog('grant_vip', { tuid });
    _toast('⭐ VIP verildi');
  }

  async function userRevokeVIP(tuid) {
    await _upd('users/' + tuid, { isVip: false });
    _toast('VIP kaldırıldı');
  }

  async function userGrantAdmin(tuid) {
    if (!confirm('Bu kullanıcıya ADMİN yetkisi ver?')) return;
    await _upd('users/' + tuid, { isFounder: true, founderRole: 'admin' });
    await _adminLog('grant_admin', { tuid });
    _toast('👑 Admin yetkisi verildi');
  }

  async function userRevokeAdmin(tuid) {
    if (!confirm('Admin yetkisini kaldır?')) return;
    await _upd('users/' + tuid, { isFounder: false, founderRole: null });
    await _adminLog('revoke_admin', { tuid });
    _toast('Admin yetkisi kaldırıldı');
  }

  async function userGrantTitle(tuid) {
    const t = document.getElementById('au_title')?.value?.trim();
    const c = document.getElementById('au_title_color')?.value || '#fbbf24';
    if (!t) return _toast('Unvan metni gir', 'error');
    await _upd('users/' + tuid, { title: t, titleColor: c });
    _toast('🎖️ Unvan verildi');
  }

  async function userRemoveTitle(tuid) {
    await _upd('users/' + tuid, { title: null, titleColor: null });
    _toast('Unvan kaldırıldı');
  }

  async function userResetDebt(tuid) {
    await _set('bank/' + tuid + '/loan', 0);
    await _adminLog('reset_debt', { tuid });
    _toast('💳 Borç sıfırlandı');
  }

  async function userResetCrypto(tuid) {
    await _rm('crypto/holdings/' + tuid);
    _toast('📈 Kripto sıfırlandı');
  }

  async function userResetStocks(tuid) {
    await _rm('stocks/holdings/' + tuid);
    _toast('📊 Hisse portföyü sıfırlandı');
  }

  async function userSendMsg(tuid) {
    const msg = document.getElementById('au_msg')?.value?.trim();
    if (!msg) return _toast('Mesaj boş olamaz', 'error');
    await _push('notifs/' + tuid, {
      type: 'admin_msg', icon: '📨',
      msg: '📨 Admin mesajı: ' + msg,
      ts: TS(), read: false
    });
    _toast('📩 Mesaj gönderildi');
  }

  async function userSendReward(tuid) {
    const rewards = [
      [5000, 10, 100],   [10000, 25, 200],
      [25000, 50, 500],  [50000, 100, 1000]
    ];
    const [money, diamonds, xp] = rewards[Math.floor(Math.random() * rewards.length)];
    await _tx('users/' + tuid + '/money', c => (c||0) + money);
    await _tx('users/' + tuid + '/diamonds', c => (c||0) + diamonds);
    await _tx('users/' + tuid + '/xp', c => (c||0) + xp);
    await _push('notifs/' + tuid, {
      type: 'admin_reward', icon: '🎁',
      msg: `🎁 Admin sürprizi: +${_fmt(money)} +${diamonds}💎 +${xp}XP`,
      ts: TS(), read: false
    });
    _toast(`🎁 Sürpriz ödül gönderildi`);
  }

  async function userResetDailyBonus(tuid) {
    await _upd('users/' + tuid, { lastDailyBonus: 0 });
    _toast('🎁 Günlük bonus sıfırlandı');
  }

  async function userResetWheel(tuid) {
    await _upd('users/' + tuid, { wheelLastDate: null });
    _toast('🎡 Çark hakkı sıfırlandı');
  }

  async function userCompleteAllAch(tuid) {
    const achievements = await _get('users/' + tuid + '/achievements') || {};
    const upd = {};
    ['first_shop','first_garden','first_farm','first_factory','first_mine','first_crypto',
     'level_10','level_25','level_50','millionaire','trade_100','mini_10'].forEach(id => {
      upd[id] = { completed: true, completedAt: TS() };
    });
    await _upd('users/' + tuid + '/achievements', upd);
    _toast('🏅 Tüm başarımlar tamamlandı');
  }

  async function userCompleteAllTech(tuid) {
    const TECH_TREE = window.TECH_TREE || {};
    const upd = {};
    Object.keys(TECH_TREE).forEach(code => { upd[code] = { code, status: 'completed', completedAt: TS() }; });
    await _upd('rd_tech/' + tuid, upd);
    _toast('🔬 Tüm Ar-Ge tamamlandı');
  }

  async function userCompleteAllCourses(tuid) {
    const COURSES = window.COURSES || [];
    const upd = {};
    COURSES.forEach(c => { upd[c.code] = { code: c.code, name: c.name, status: 'completed', completedAt: TS() }; });
    await _upd('education/' + tuid, upd);
    _toast('🎓 Tüm kurslar tamamlandı');
  }

  /* Tüm Kullanıcılar Listesi */
  async function openAllUsersModal() {
    _modal('👥 Tüm Kullanıcılar', '<div class="admin-loading">Yükleniyor...</div>', true);
    const snap = await _get('users');
    const users = snap || {};
    const entries = Object.entries(users).sort((a, b) => (b[1].money||0) - (a[1].money||0));

    const html = `
      <div class="admin-users-full">
        <div class="admin-filter-row">
          <input type="text" id="allUsrQ" oninput="window.AP._liveSearchUsers()" placeholder="Filtrele..." class="admin-input">
          <button class="admin-btn red" onclick="window.AP.bulkBanSelected()">🚫 Seçilenleri Banla</button>
          <button class="admin-btn green" onclick="window.AP.bulkGiftAll()">🎁 Hepsine Hediye</button>
          <button class="admin-btn blue" onclick="window.AP.exportUsersCSV()">📥 CSV İndir</button>
        </div>
        <div class="admin-table-wrap" id="allUsersTable">
          <table class="admin-table">
            <thead><tr>
              <th><input type="checkbox" id="chkAll" onchange="window.AP._toggleAllCheck()"></th>
              <th>Kullanıcı Adı</th>
              <th>Seviye</th>
              <th>Para</th>
              <th>Elmas</th>
              <th>Durum</th>
              <th>Kayıt</th>
              <th>İşlem</th>
            </tr></thead>
            <tbody id="allUsersTbody">
              ${entries.slice(0, 100).map(([id, u]) => `
                <tr data-uid="${id}" data-name="${(u.username||'').toLowerCase()}">
                  <td><input type="checkbox" class="user-chk" data-uid="${id}"></td>
                  <td><b>${u.username||'İsimsiz'}</b> ${u.isFounder?'👑':''} ${u.isVip?'⭐':''}</td>
                  <td>Lv ${u.level||1}</td>
                  <td>${_fmt(u.money||0)}</td>
                  <td>${u.diamonds||0} 💎</td>
                  <td>${u.banned?'<span class="badge-red">BAN</span>':u.frozen?'<span class="badge-blue">DONUK</span>':'<span class="badge-green">Aktif</span>'}</td>
                  <td>${u.createdAt?new Date(u.createdAt).toLocaleDateString('tr-TR'):'?'}</td>
                  <td>
                    <button class="admin-btn-xs blue" onclick="window.AP.openUserDetail('${id}')">Detay</button>
                    <button class="admin-btn-xs red" onclick="window.AP._quickBan('${id}')">Ban</button>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
    const modalBody = document.querySelector('.modal-body') || document.querySelector('.modal-content');
    if (modalBody) modalBody.innerHTML = html;
    else _modal('👥 Tüm Kullanıcılar', html, true);
  }

  function _liveSearchUsers() {
    const q = document.getElementById('allUsrQ')?.value?.toLowerCase() || '';
    document.querySelectorAll('#allUsersTbody tr').forEach(row => {
      const name = row.dataset.name || '';
      const uid  = row.dataset.uid  || '';
      row.style.display = (!q || name.includes(q) || uid.includes(q)) ? '' : 'none';
    });
  }

  function _toggleAllCheck() {
    const all = document.getElementById('chkAll')?.checked;
    document.querySelectorAll('.user-chk').forEach(c => { c.checked = all; });
  }

  async function _quickBan(tuid) {
    if (!confirm(`${tuid.slice(0,8)}... banlanacak. Onaylıyor musun?`)) return;
    await _upd('users/' + tuid, { banned: true, banReason: 'Admin kararı' });
    _toast('🚫 Banlandı');
  }

  async function bulkBanSelected() {
    const checked = [...document.querySelectorAll('.user-chk:checked')].map(c => c.dataset.uid);
    if (!checked.length) return _toast('Kullanıcı seç', 'error');
    if (!confirm(`${checked.length} kullanıcı banlanacak!`)) return;
    const upd = {};
    checked.forEach(u => { upd['users/' + u + '/banned'] = true; upd['users/' + u + '/banReason'] = 'Toplu ban'; });
    await db().ref().update(upd);
    _toast(`🚫 ${checked.length} kullanıcı banlandı`);
    await _adminLog('bulk_ban', { count: checked.length });
  }

  async function bulkGiftAll() {
    const snap = await _get('users');
    const users = snap || {};
    const uids = Object.keys(users);
    let batch = {};
    uids.forEach(u => {
      const key = db().ref().push().key;
      batch['notifs/' + u + '/' + key] = { type:'admin_gift', icon:'🎁', msg:'🎁 Admin sürprizi: +1.000₺!', ts: TS(), read: false };
    });
    await db().ref().update(batch);
    let batch2 = {};
    for (const u of uids) {
      batch2['users/' + u + '/money'] = (users[u].money || 0) + 1000;
    }
    await db().ref().update(batch2);
    _toast(`🎁 ${uids.length} oyuncuya hediye gönderildi`);
    await _adminLog('bulk_gift', { count: uids.length, amount: 1000 });
  }

  async function exportUsersCSV() {
    const snap = await _get('users');
    const users = snap || {};
    const rows = [['UID','Kullanıcı Adı','Seviye','Para','Elmas','Durum','Kayıt']];
    Object.entries(users).forEach(([id, u]) => {
      rows.push([id, u.username||'—', u.level||1, u.money||0, u.diamonds||0,
        u.banned?'Banlı':u.frozen?'Dondurulmuş':'Aktif',
        u.createdAt?new Date(u.createdAt).toLocaleDateString('tr-TR'):'?']);
    });
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'gamezone_users_' + new Date().toISOString().slice(0,10) + '.csv';
    a.click();
    _toast('📥 CSV indirildi');
  }

  /* ══════════════════════════════════════════════════════════════════════════
     BÖLÜM 3: EKONOMİ YÖNETİMİ (60 Özellik)
     ══════════════════════════════════════════════════════════════════════════ */

  /* Global Ekonomi Kontrolleri */
  function openGlobalEconModal() {
    _modal('💰 Global Ekonomi Kontrolleri', `
      <div class="admin-econ-tabs">
        <button class="admin-tab active" onclick="window.AP._econTab(this,'kripto')">📈 Kripto</button>
        <button class="admin-tab" onclick="window.AP._econTab(this,'borsa')">📊 Borsa</button>
        <button class="admin-tab" onclick="window.AP._econTab(this,'banka')">🏦 Banka</button>
        <button class="admin-tab" onclick="window.AP._econTab(this,'pazar')">🛒 Pazar</button>
        <button class="admin-tab" onclick="window.AP._econTab(this,'genel')">⚙️ Genel</button>
      </div>
      <div id="econTabContent"></div>
    `, true);
    window.AP._econTab(null, 'kripto');
  }

  function _econTab(el, tab) {
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
    if (el) el.classList.add('active');
    const div = document.getElementById('econTabContent');
    if (!div) return;

    if (tab === 'kripto') {
      div.innerHTML = `
        <div class="admin-econ-section">
          <h4>📈 Kripto Fiyat Yönetimi</h4>
          <div id="cryptoPriceList" class="admin-loading">Yükleniyor...</div>
          <div class="admin-action-row">
            <label>Tüm Coinlere % Değişim:</label>
            <input type="number" id="cryptoGlobalPct" placeholder="Örn: 10 veya -5" class="admin-input-sm">
            <button class="admin-btn green" onclick="window.AP.cryptoGlobalChange(1)">📈 Artır</button>
            <button class="admin-btn red" onclick="window.AP.cryptoGlobalChange(-1)">📉 Düşür</button>
          </div>
          <div class="admin-action-row">
            <button class="admin-btn red" onclick="window.AP.cryptoFreezeTrade(true)">🔒 Ticareti Durdur</button>
            <button class="admin-btn green" onclick="window.AP.cryptoFreezeTrade(false)">🔓 Ticareti Aç</button>
          </div>
        </div>`;
      window.AP._loadCryptoPrices();
    }
    else if (tab === 'borsa') {
      div.innerHTML = `
        <div class="admin-econ-section">
          <h4>📊 Borsa Yönetimi</h4>
          <div id="stockPriceList" class="admin-loading">Yükleniyor...</div>
          <div class="admin-action-row">
            <label>Tüm Hisselere % Değişim:</label>
            <input type="number" id="stockGlobalPct" placeholder="Örn: 5 veya -3" class="admin-input-sm">
            <button class="admin-btn green" onclick="window.AP.stockGlobalChange(1)">📈 Artır</button>
            <button class="admin-btn red" onclick="window.AP.stockGlobalChange(-1)">📉 Düşür</button>
          </div>
          <div class="admin-action-row">
            <button class="admin-btn yellow" onclick="window.AP.triggerDividend()">💰 Temettü Dağıt (Manuel)</button>
            <button class="admin-btn teal" onclick="window.AP.openIPOManager()">🚀 IPO Yöneticisi</button>
          </div>
        </div>`;
      window.AP._loadStockPrices();
    }
    else if (tab === 'banka') {
      div.innerHTML = `
        <div class="admin-econ-section">
          <h4>🏦 Banka Yönetimi</h4>
          <div class="admin-action-row">
            <label>Faiz Oranı (%):</label>
            <input type="number" id="bankInterest" placeholder="0.3" step="0.1" class="admin-input-sm">
            <button class="admin-btn blue" onclick="window.AP.setBankInterest()">Ayarla</button>
          </div>
          <div class="admin-action-row">
            <label>Kredi Çarpanı (Lv × ?):</label>
            <input type="number" id="bankLoanMult" placeholder="5000" class="admin-input-sm">
            <button class="admin-btn blue" onclick="window.AP.setBankLoanMult()">Ayarla</button>
          </div>
          <div class="admin-action-row">
            <button class="admin-btn yellow" onclick="window.AP.triggerInterestPayout()">💵 Faiz Öde (Manuel)</button>
            <button class="admin-btn red" onclick="window.AP.collectOverdueLoans()">💳 Vadesi Geçmiş Kredileri Tahsil</button>
          </div>
        </div>`;
    }
    else if (tab === 'pazar') {
      div.innerHTML = `
        <div class="admin-econ-section">
          <h4>🛒 Pazar Yönetimi</h4>
          <div id="marketListings" class="admin-loading">Yükleniyor...</div>
          <div class="admin-action-row">
            <label>Max İlan Fiyatı (₺):</label>
            <input type="number" id="marketMaxPrice" placeholder="1000000" class="admin-input-sm">
            <button class="admin-btn blue" onclick="window.AP.setMarketMaxPrice()">Ayarla</button>
          </div>
          <div class="admin-action-row">
            <label>Komisyon Oranı (%):</label>
            <input type="number" id="marketCommission" placeholder="2" step="0.5" class="admin-input-sm">
            <button class="admin-btn blue" onclick="window.AP.setMarketCommission()">Ayarla</button>
          </div>
          <button class="admin-btn red" onclick="window.AP.clearAllListings()">🗑️ Tüm İlanları Temizle</button>
        </div>`;
      window.AP._loadMarketListings();
    }
    else if (tab === 'genel') {
      // Mevcut değerleri çek
      Promise.all([
        _get('system/vergiOrani'),
        _get('system/krediDakikaFaiz'),
        _get('system/maxSatisBirimDongu'),
        _get('system/incomeMult'),
        _get('system/dailyBonus'),
        _get('system/startMoney'),
        _get('system/harvestMult'),
        _get('system/prodSpeedMult'),
      ]).then(([vergi, kdFaiz, maxSatis, incMult, dBonus, sMoney, hvMult, prSpeed]) => {
        const d = document.getElementById('econTabContent');
        if (!d) return;
        d.innerHTML = `
          <div class="admin-econ-section">
            <h4>⚙️ Genel Ekonomi Ayarları</h4>
            <div class="admin-settings-grid">

              <div class="admin-setting-row" style="background:rgba(239,68,68,.06);border-radius:10px;padding:10px;border:1px solid #ef444433">
                <div style="font-size:12px;font-weight:700;color:#ef4444;margin-bottom:6px">🏛️ KDV / Satış Vergisi Oranı</div>
                <div style="display:flex;gap:6px;align-items:center">
                  <input type="number" id="gs_vergi" placeholder="0.18" step="0.01" min="0" max="0.99" value="${vergi||0.18}" class="admin-input-sm" style="flex:1">
                  <span style="font-size:11px;color:var(--text-muted)">= ${((vergi||0.18)*100).toFixed(0)}%</span>
                  <button class="admin-btn blue" onclick="window.AP.setVergiOrani()">Ayarla</button>
                </div>
                <div style="font-size:10px;color:#94a3b8;margin-top:4px">Tüm dükkan satışları, mahalle/ilçe/şehir/bölge pazarı satışlarından kesilir.</div>
              </div>

              <div class="admin-setting-row" style="background:rgba(245,158,11,.06);border-radius:10px;padding:10px;border:1px solid #f59e0b33">
                <div style="font-size:12px;font-weight:700;color:#f59e0b;margin-bottom:6px">💳 Kredi Dakikalık Faiz Oranı</div>
                <div style="display:flex;gap:6px;align-items:center">
                  <input type="number" id="gs_kdFaiz" placeholder="0.0000694" step="0.000001" min="0" value="${kdFaiz||0.0000694}" class="admin-input-sm" style="flex:1">
                  <span style="font-size:11px;color:var(--text-muted)">= %${((kdFaiz||0.0000694)*60*24*100).toFixed(2)}/gün</span>
                </div>
                <div style="display:flex;gap:4px;margin-top:6px;flex-wrap:wrap">
                  <button class="admin-btn-xs" onclick="document.getElementById('gs_kdFaiz').value=0.0000694">%0.1/gün</button>
                  <button class="admin-btn-xs" onclick="document.getElementById('gs_kdFaiz').value=0.000139">%0.2/gün</button>
                  <button class="admin-btn-xs" onclick="document.getElementById('gs_kdFaiz').value=0.000347">%0.5/gün</button>
                  <button class="admin-btn-xs" onclick="document.getElementById('gs_kdFaiz').value=0.000694">%1/gün</button>
                </div>
                <button class="admin-btn blue" style="margin-top:6px;width:100%" onclick="window.AP.setKrediDakikaFaiz()">Kaydet</button>
                <div style="font-size:10px;color:#94a3b8;margin-top:4px">Her dakika aktif krediye otomatik uygulanır. Gün sonu toplam = oran × 1440 × borç.</div>
              </div>

              <div class="admin-setting-row" style="background:rgba(34,197,94,.06);border-radius:10px;padding:10px;border:1px solid #22c55e33">
                <div style="font-size:12px;font-weight:700;color:#22c55e;margin-bottom:6px">🏪 Dükkan Satış Hızı (Döngü başı max birim)</div>
                <div style="display:flex;gap:6px;align-items:center">
                  <input type="number" id="gs_maxSatis" placeholder="15" min="1" max="500" value="${maxSatis||15}" class="admin-input-sm" style="flex:1">
                  <span style="font-size:11px;color:var(--text-muted)">birim/döngü</span>
                  <button class="admin-btn blue" onclick="window.AP.setMaxSatisBirim()">Ayarla</button>
                </div>
                <div style="font-size:10px;color:#94a3b8;margin-top:4px">Her satış döngüsü 45-120 dk. Düşük değer = yavaş satış. Çok yüksek = stok saniyede biter.</div>
              </div>

              <div class="admin-setting-row">
                <label>Global Gelir Çarpanı (×)</label>
                <input type="number" id="gs_income_mult" placeholder="1.0" step="0.1" value="${incMult||1}" class="admin-input-sm">
                <button class="admin-btn blue" onclick="window.AP.setGlobalSetting('incomeMult','gs_income_mult')">Ayarla</button>
              </div>
              <div class="admin-setting-row">
                <label>Günlük Bonus Miktarı (₺)</label>
                <input type="number" id="gs_daily_bonus" placeholder="1000" value="${dBonus||1000}" class="admin-input-sm">
                <button class="admin-btn blue" onclick="window.AP.setGlobalSetting('dailyBonus','gs_daily_bonus')">Ayarla</button>
              </div>
              <div class="admin-setting-row">
                <label>Yeni Oyuncu Başlangıç Parası (₺)</label>
                <input type="number" id="gs_start_money" placeholder="10000" value="${sMoney||10000}" class="admin-input-sm">
                <button class="admin-btn blue" onclick="window.AP.setGlobalSetting('startMoney','gs_start_money')">Ayarla</button>
              </div>
              <div class="admin-setting-row">
                <label>Transfer Günlük Limiti (₺)</label>
                <input type="number" id="gs_transfer_limit" placeholder="100000" class="admin-input-sm">
                <button class="admin-btn blue" onclick="window.AP.setGlobalSetting('transferDailyMax','gs_transfer_limit')">Ayarla</button>
              </div>
              <div class="admin-setting-row">
                <label>Mini Oyun Günlük Kazanç Limiti (₺)</label>
                <input type="number" id="gs_minigame_limit" placeholder="10000" class="admin-input-sm">
                <button class="admin-btn blue" onclick="window.AP.setGlobalSetting('minigameDailyMax','gs_minigame_limit')">Ayarla</button>
              </div>
              <div class="admin-setting-row">
                <label>Enflasyon Uygula (tüm ürün +%)</label>
                <input type="number" id="gs_inflation" placeholder="5" class="admin-input-sm">
                <button class="admin-btn orange" onclick="window.AP.applyInflation()">Uygula</button>
              </div>
              <div class="admin-setting-row">
                <label>Hasat Çarpanı (×)</label>
                <input type="number" id="gs_harvest_mult" placeholder="1.0" step="0.1" value="${hvMult||1}" class="admin-input-sm">
                <button class="admin-btn green" onclick="window.AP.setGlobalSetting('harvestMult','gs_harvest_mult')">Ayarla</button>
              </div>
              <div class="admin-setting-row">
                <label>Üretim Hızı Çarpanı (×)</label>
                <input type="number" id="gs_prod_speed" placeholder="1.0" step="0.1" value="${prSpeed||1}" class="admin-input-sm">
                <button class="admin-btn teal" onclick="window.AP.setGlobalSetting('prodSpeedMult','gs_prod_speed')">Ayarla</button>
              </div>

              <!-- Vergi Hazinesi Özeti -->
              <div id="vergiHazineDiv" style="background:rgba(239,68,68,.04);border:1px solid #ef444422;border-radius:10px;padding:10px">
                <div style="font-size:11px;color:#ef4444;font-weight:700">🏛️ Vergi Hazinesi</div>
                <div style="font-size:11px;color:var(--text-muted);margin-top:4px">Yükleniyor...</div>
              </div>
            </div>
          </div>`;

        // Vergi hazinesini çek
        _get('system/vergiHazinesi').then(hz => {
          const el = document.getElementById('vergiHazineDiv');
          if (el) el.innerHTML = `
            <div style="font-size:11px;color:#ef4444;font-weight:700">🏛️ Vergi Hazinesi</div>
            <div style="font-size:18px;font-weight:800;color:var(--text);margin-top:4px">${new Intl.NumberFormat('tr-TR',{style:'currency',currency:'TRY',minimumFractionDigits:0}).format(hz||0)}</div>
            <button class="admin-btn-xs red" style="margin-top:6px" onclick="window.AP.clearVergiHazinesi()">Hazineyi Sıfırla</button>`;
        });
      });

      div.innerHTML = `<div class="admin-loading">⚙️ Mevcut ayarlar yükleniyor...</div>`;
    }
  }

  async function _loadCryptoPrices() {
    const prices = await _get('crypto/prices') || {};
    const KRIPTO  = window.KRIPTO || [];
    const div = document.getElementById('cryptoPriceList');
    if (!div) return;
    div.innerHTML = `<div class="admin-table-wrap"><table class="admin-table">
      <thead><tr><th>Coin</th><th>Anlık Fiyat</th><th>Yeni Fiyat</th><th>İşlem</th></tr></thead>
      <tbody>
        ${KRIPTO.map(k => {
          const cur = prices[k.sym]?.current || k.base;
          return `<tr>
            <td><b>${k.emo} ${k.sym}</b> ${k.name}</td>
            <td>₺${cur.toFixed(2)}</td>
            <td><input type="number" id="cp_${k.sym}" value="${cur.toFixed(2)}" class="admin-input-xs"></td>
            <td>
              <button class="admin-btn-xs blue" onclick="window.AP.setCryptoPrice('${k.sym}')">Ayarla</button>
              <button class="admin-btn-xs red" onclick="window.AP.lockCryptoPrice('${k.sym}',true)">Kilitle</button>
              <button class="admin-btn-xs green" onclick="window.AP.lockCryptoPrice('${k.sym}',false)">Serbest</button>
            </td>
          </tr>`;
        }).join('')}
      </tbody>
    </table></div>`;
  }

  async function setCryptoPrice(sym) {
    const val = safeNum(document.getElementById('cp_' + sym)?.value);
    if (!val || val <= 0) return _toast('Geçerli fiyat gir', 'error');
    await _upd('crypto/prices/' + sym, { current: val, manualSet: true, setBy: 'admin', setAt: TS() });
    _toast(`${sym} → ₺${val.toFixed(2)}`);
    await _adminLog('set_crypto_price', { sym, val });
  }

  async function lockCryptoPrice(sym, locked) {
    await _upd('crypto/prices/' + sym, { locked });
    _toast(locked ? `🔒 ${sym} kilitlendi` : `🔓 ${sym} serbest bırakıldı`);
  }

  async function cryptoGlobalChange(dir) {
    const pct = safeNum(document.getElementById('cryptoGlobalPct')?.value) / 100 * dir;
    if (!pct) return _toast('% değer gir', 'error');
    const KRIPTO = window.KRIPTO || [];
    const prices = await _get('crypto/prices') || {};
    const upd = {};
    for (const k of KRIPTO) {
      const cur = prices[k.sym]?.current || k.base;
      const newPrice = Math.max(0.000001, cur * (1 + pct));
      upd['crypto/prices/' + k.sym + '/current'] = newPrice;
      upd['crypto/prices/' + k.sym + '/prev'] = cur;
      upd['crypto/prices/' + k.sym + '/changePct'] = pct * 100;
    }
    await db().ref().update(upd);
    _toast(`📈 Tüm coinler ${pct > 0 ? '+' : ''}${(pct*100).toFixed(1)}% değişti`);
    await _adminLog('crypto_global_change', { pct });
  }

  async function cryptoFreezeTrade(freeze) {
    await _set('system/cryptoTradeFrozen', freeze);
    _toast(freeze ? '🔒 Kripto ticareti durduruldu' : '🔓 Kripto ticareti açıldı');
  }

  async function _loadStockPrices() {
    const STOCKS = window.STOCKS_DATA || [];
    const div = document.getElementById('stockPriceList');
    if (!div) return;
    const pricePromises = STOCKS.slice(0, 10).map(s => _get('stocks/prices/' + s.sym + '/current'));
    const prices = await Promise.all(pricePromises);
    div.innerHTML = `<div class="admin-table-wrap"><table class="admin-table">
      <thead><tr><th>Sembol</th><th>Şirket</th><th>Fiyat</th><th>Yeni Fiyat</th><th>İşlem</th></tr></thead>
      <tbody>
        ${STOCKS.slice(0, 10).map((s, i) => {
          const cur = prices[i] || s.basePrice;
          return `<tr>
            <td><b>${s.sym}</b></td>
            <td>${s.name}</td>
            <td>₺${cur.toFixed(2)}</td>
            <td><input type="number" id="sp_${s.sym}" value="${cur.toFixed(2)}" class="admin-input-xs"></td>
            <td>
              <button class="admin-btn-xs blue" onclick="window.AP.setStockPrice('${s.sym}')">Ayarla</button>
              <button class="admin-btn-xs red" onclick="window.AP.lockStock('${s.sym}',true)">Kilitle</button>
            </td>
          </tr>`;
        }).join('')}
      </tbody>
    </table></div>`;
  }

  async function setStockPrice(sym) {
    const val = safeNum(document.getElementById('sp_' + sym)?.value);
    if (!val || val <= 0) return _toast('Geçerli fiyat gir', 'error');
    await _upd('stocks/prices/' + sym, { current: val, manualSet: true, setAt: TS() });
    _toast(`${sym} → ₺${val.toFixed(2)}`);
  }

  async function lockStock(sym, locked) {
    await _upd('stocks/prices/' + sym, { locked });
    _toast(locked ? `🔒 ${sym} kilitlendi` : `🔓 ${sym} serbest`);
  }

  async function stockGlobalChange(dir) {
    const pct = safeNum(document.getElementById('stockGlobalPct')?.value) / 100 * dir;
    if (!pct) return _toast('% değer gir', 'error');
    const STOCKS = window.STOCKS_DATA || [];
    const upd = {};
    for (const s of STOCKS) {
      const cur = (await _get('stocks/prices/' + s.sym + '/current')) || s.basePrice;
      upd['stocks/prices/' + s.sym + '/current'] = Math.max(0.01, cur * (1 + pct));
    }
    await db().ref().update(upd);
    _toast(`📊 Tüm hisseler ${(pct*100).toFixed(1)}% değişti`);
  }

  async function triggerDividend() {
    if (typeof window.distributeDividends === 'function') {
      await window.distributeDividends();
      _toast('💰 Temettü dağıtıldı');
    } else _toast('distributeDividends fonksiyonu bulunamadı', 'error');
  }

  async function setBankInterest() {
    const rate = safeNum(document.getElementById('bankInterest')?.value);
    if (!rate || rate < 0) return _toast('Geçerli oran gir', 'error');
    await _set('system/settings/bankInterestRate', rate / 100);
    _toast(`🏦 Faiz oranı %${rate} ayarlandı`);
  }

  async function setBankLoanMult() {
    const mult = safeNum(document.getElementById('bankLoanMult')?.value);
    if (!mult || mult < 0) return _toast('Geçerli çarpan gir', 'error');
    await _set('system/settings/bankLoanMult', mult);
    _toast(`🏦 Kredi çarpanı ${mult} ayarlandı`);
  }

  /* ── YENİ: Vergi Oranı Ayarla ── */
  async function setVergiOrani() {
    const oran = safeNum(document.getElementById('gs_vergi')?.value);
    if (isNaN(oran) || oran < 0 || oran > 0.99) return _toast('0-0.99 arası gir (örn: 0.18 = %18)', 'error');
    await _set('system/vergiOrani', oran);
    await _adminLog('set_vergi_orani', { oran });
    _toast(`🏛️ KDV oranı %${(oran*100).toFixed(0)} olarak ayarlandı. Tüm satışlara uygulanacak.`);
  }

  /* ── YENİ: Kredi Dakika Faizi Ayarla ── */
  async function setKrediDakikaFaiz() {
    const faiz = safeNum(document.getElementById('gs_kdFaiz')?.value);
    if (isNaN(faiz) || faiz < 0) return _toast('Geçersiz değer', 'error');
    await _set('system/krediDakikaFaiz', faiz);
    await _adminLog('set_kredi_dakika_faiz', { faiz });
    const gunlukPct = (faiz * 60 * 24 * 100).toFixed(2);
    _toast(`💳 Kredi dakika faizi ayarlandı: %${faiz} / dk → %${gunlukPct} / gün`);
  }

  /* ── YENİ: Satış Hızı (max birim/döngü) Ayarla ── */
  async function setMaxSatisBirim() {
    const val = safeNum(document.getElementById('gs_maxSatis')?.value);
    if (!val || val < 1) return _toast('En az 1 gir', 'error');
    await _set('system/maxSatisBirimDongu', Math.floor(val));
    await _adminLog('set_max_satis_birim', { val });
    _toast(`🏪 Döngü başı max satış: ${Math.floor(val)} birim. (Döngü = 45-120 dk arası rastgele)`);
  }

  /* ── YENİ: Vergi Hazinesini Sıfırla ── */
  async function clearVergiHazinesi() {
    if (!confirm('Vergi hazinesini sıfırlamak istediğine emin misin?')) return;
    const hz = (await _get('system/vergiHazinesi')) || 0;
    await _set('system/vergiHazinesi', 0);
    await _set('system/vergiHazinesiArşiv/' + Date.now(), { tutar: hz, sifirlayan: uid(), ts: TS() });
    await _adminLog('clear_vergi_hazinesi', { hz });
    _toast(`🏛️ Vergi hazinesi sıfırlandı. (${_fmt(hz)} arşivlendi)`);
    const el = document.getElementById('vergiHazineDiv');
    if (el) el.querySelector('div:last-child').textContent = '₺0';
  }

  async function collectOverdueLoans() {
    const bankData = await _get('bank') || {};
    let count = 0;
    for (const [uid, b] of Object.entries(bankData)) {
      if ((b.loan || 0) > 0 && b.nextSalary && Date.now() > b.nextSalary) {
        const money = (await _get('users/' + uid + '/money')) || 0;
        const pay = Math.min(money, b.loan);
        if (pay > 0) {
          await _tx('users/' + uid + '/money', c => Math.max(0, (c||0) - pay));
          await _tx('bank/' + uid + '/loan', c => Math.max(0, (c||0) - pay));
          count++;
        }
      }
    }
    _toast(`💳 ${count} kullanıcıdan kredi tahsil edildi`);
  }

  async function _loadMarketListings() {
    const listings = await _get('playerMarket') || {};
    const div = document.getElementById('marketListings');
    if (!div) return;
    const active = Object.entries(listings).filter(([k, l]) => l && l.remaining > 0);
    div.innerHTML = active.length ? `<div class="admin-table-wrap"><table class="admin-table">
      <thead><tr><th>Satıcı</th><th>Ürün</th><th>Fiyat</th><th>Kalan</th><th>İşlem</th></tr></thead>
      <tbody>
        ${active.slice(0, 30).map(([id, l]) => `<tr>
          <td>${l.sellerUid?.slice(0,8)||'?'}</td>
          <td>${l.item||'?'}</td>
          <td>${_fmt(l.price||0)}</td>
          <td>${l.remaining||0}</td>
          <td><button class="admin-btn-xs red" onclick="window.AP.deleteListing('${id}')">Sil</button></td>
        </tr>`).join('')}
      </tbody>
    </table></div>` : '<p class="admin-muted">Aktif ilan yok</p>';
  }

  async function deleteListing(id) {
    await _rm('playerMarket/' + id);
    _toast('İlan silindi');
    await _adminLog('delete_listing', { id });
  }

  async function clearAllListings() {
    if (!confirm('TÜM pazaryeri ilanları silinecek!')) return;
    await _rm('playerMarket');
    _toast('🗑️ Tüm ilanlar temizlendi');
    await _adminLog('clear_all_listings', {});
  }

  async function setMarketMaxPrice() {
    const val = safeNum(document.getElementById('marketMaxPrice')?.value);
    if (!val || val <= 0) return _toast('Geçerli fiyat gir', 'error');
    await _set('system/settings/marketMaxPrice', val);
    _toast(`🛒 Max ilan fiyatı ${_fmt(val)} ayarlandı`);
  }

  async function setMarketCommission() {
    const val = safeNum(document.getElementById('marketCommission')?.value);
    if (!val || val < 0) return _toast('Geçerli oran gir', 'error');
    await _set('system/settings/marketCommission', val / 100);
    _toast(`🛒 Komisyon %${val} ayarlandı`);
  }

  async function setGlobalSetting(key, inputId) {
    const val = safeNum(document.getElementById(inputId)?.value);
    if (isNaN(val)) return _toast('Geçerli değer gir', 'error');
    await _set('system/settings/' + key, val);
    _toast(`✅ ${key} = ${val} ayarlandı`);
    await _adminLog('set_global_setting', { key, val });
  }

  async function applyInflation() {
    const pct = safeNum(document.getElementById('gs_inflation')?.value) / 100;
    if (!pct || pct <= 0) return _toast('Geçerli % gir', 'error');
    const URUNLER = window.URUNLER || {};
    const upd = {};
    Object.keys(URUNLER).forEach(key => {
      const newBase = Math.floor(URUNLER[key].base * (1 + pct));
      upd['system/productPrices/' + key] = newBase;
    });
    await db().ref().update(upd);
    _toast(`📈 Tüm ürünlere +%${(pct*100).toFixed(1)} enflasyon uygulandı`);
    await _adminLog('apply_inflation', { pct });
  }

  async function openIPOManager() {
    const ipos = await _get('stocks/ipos') || {};
    const entries = Object.entries(ipos);
    _modal('🚀 IPO Yöneticisi', `
      <div class="admin-table-wrap"><table class="admin-table">
        <thead><tr><th>Sembol</th><th>Şirket</th><th>Fiyat</th><th>Kalan Hisse</th><th>Durum</th><th>İşlem</th></tr></thead>
        <tbody>
          ${entries.map(([id, ipo]) => `<tr>
            <td><b>${ipo.sym||'?'}</b></td>
            <td>${ipo.companyName||'?'}</td>
            <td>₺${ipo.sharePrice||0}</td>
            <td>${ipo.sharesAvailable||0}</td>
            <td><span class="badge-${ipo.status==='open'?'green':'grey'}">${ipo.status||'?'}</span></td>
            <td>
              <button class="admin-btn-xs green" onclick="window.AP.approveIPO('${id}')">Onayla</button>
              <button class="admin-btn-xs red" onclick="window.AP.rejectIPO('${id}')">Reddet</button>
            </td>
          </tr>`).join('')}
        </tbody>
      </table></div>
    `, true);
  }

  async function approveIPO(id) {
    await _upd('stocks/ipos/' + id, { status: 'approved', approvedAt: TS() });
    _toast('✅ IPO onaylandı');
    await _adminLog('approve_ipo', { id });
  }

  async function rejectIPO(id) {
    await _upd('stocks/ipos/' + id, { status: 'rejected', rejectedAt: TS() });
    _toast('❌ IPO reddedildi');
    await _adminLog('reject_ipo', { id });
  }

  async function triggerInterestPayout() {
    const bankData = await _get('bank') || {};
    let paid = 0;
    const rate = (await _get('system/settings/bankInterestRate')) || 0.003;
    for (const [uid, b] of Object.entries(bankData)) {
      if ((b.investment || 0) > 0) {
        const interest = Math.floor(b.investment * rate);
        if (interest > 0) {
          await _tx('bank/' + uid + '/investment', c => (c||0) + interest);
          paid++;
        }
      }
    }
    _toast(`💵 ${paid} kullanıcıya faiz ödendi`);
    await _adminLog('trigger_interest', { rate, paid });
  }

  /* ══════════════════════════════════════════════════════════════════════════
     BÖLÜM 4: OYUN YÖNETİMİ (30 Özellik)
     ══════════════════════════════════════════════════════════════════════════ */

  function openGameManagement() {
    const panel = document.getElementById(window._adminTarget||'adminPanelBody');
    if (!panel) return;
    panel.innerHTML = `
      <div class="admin-section">
        <h2 class="admin-section-title">🎮 Oyun Yönetimi</h2>
        <div class="admin-row-2">

          <!-- MİNİ OYUNLAR -->
          <div class="admin-card">
            <h3>🎯 Mini Oyun Ayarları</h3>
            <div class="admin-settings-grid">
              <div class="admin-setting-row">
                <label>Günlük Kazanç Limiti (₺)</label>
                <input type="number" id="mg_daily_max" placeholder="10000" class="admin-input-sm">
                <button class="admin-btn blue" onclick="window.AP.setGlobalSetting('minigameDailyMax','mg_daily_max')">Kaydet</button>
              </div>
              <div class="admin-setting-row">
                <label>Ödül Çarpanı (×)</label>
                <input type="number" id="mg_reward_mult" placeholder="1.0" step="0.1" class="admin-input-sm">
                <button class="admin-btn green" onclick="window.AP.setGlobalSetting('minigameRewardMult','mg_reward_mult')">Kaydet</button>
              </div>
              <div class="admin-setting-row">
                <label>Max CPS (Bot Limiti)</label>
                <input type="number" id="mg_max_cps" placeholder="15" class="admin-input-sm">
                <button class="admin-btn yellow" onclick="window.AP.setGlobalSetting('minigameMaxCPS','mg_max_cps')">Kaydet</button>
              </div>
              <div class="admin-setting-row">
                <label>Bahis Min (₺)</label>
                <input type="number" id="mg_bet_min" placeholder="100" class="admin-input-sm">
                <button class="admin-btn blue" onclick="window.AP.setGlobalSetting('minigameBetMin','mg_bet_min')">Kaydet</button>
              </div>
              <div class="admin-setting-row">
                <label>Bahis Max (₺)</label>
                <input type="number" id="mg_bet_max" placeholder="50000" class="admin-input-sm">
                <button class="admin-btn blue" onclick="window.AP.setGlobalSetting('minigameBetMax','mg_bet_max')">Kaydet</button>
              </div>
            </div>
            <div class="admin-action-row">
              <button class="admin-btn red" onclick="window.AP.resetAllMiniGameStats()">🗑️ Tüm Mini Oyun Verisini Sıfırla</button>
              <button class="admin-btn yellow" onclick="window.AP.openBotSuspectList()">🤖 Bot Şüphelileri</button>
            </div>
          </div>

          <!-- GÖREV & SEFER -->
          <div class="admin-card">
            <h3>📋 Görev & Sefer Sistemi</h3>
            <div class="admin-action-row">
              <button class="admin-btn green" onclick="window.AP.resetAllDailyTasks()">🔄 Tüm Günlük Görevleri Sıfırla</button>
            </div>
            <div class="admin-action-row">
              <button class="admin-btn purple" onclick="window.AP.openExpeditionManager()">🗺️ Sefer Yöneticisi</button>
            </div>
            <div class="admin-action-row">
              <button class="admin-btn gold" onclick="window.AP.openWheelCustomizer()">🎡 Çark Ödüllerini Özelleştir</button>
            </div>
            <div class="admin-action-row">
              <button class="admin-btn teal" onclick="window.AP.giveWheelToAll()">🎡 Herkese Çark Hakkı Ver</button>
            </div>
          </div>

          <!-- PvP & DÜELLO -->
          <div class="admin-card">
            <h3>⚔️ PvP & Düello</h3>
            <div id="pvpList" class="admin-loading">Yükleniyor...</div>
            <div class="admin-action-row">
              <button class="admin-btn red" onclick="window.AP.cancelAllDuels()">❌ Tüm Düelloları İptal</button>
              <button class="admin-btn blue" onclick="window.AP.loadPvpData()">🔄 Yenile</button>
            </div>
          </div>

          <!-- KARTLARİ & KOLEKSİYON -->
          <div class="admin-card">
            <h3>🃏 Koleksiyon Sistemi</h3>
            <div class="admin-settings-grid">
              <div class="admin-setting-row">
                <label>Paket Açma Boost (×)</label>
                <input type="number" id="card_boost" placeholder="1.0" step="0.1" class="admin-input-sm">
                <button class="admin-btn blue" onclick="window.AP.setGlobalSetting('cardRareBoost','card_boost')">Ayarla</button>
              </div>
            </div>
            <div class="admin-action-row">
              <button class="admin-btn yellow" onclick="window.AP.openCardManager()">🃏 Kart Yöneticisi</button>
            </div>
          </div>
        </div>
      </div>`;
    window.AP.loadPvpData();
  }

  async function loadPvpData() {
    const duels = await _get('duels/active') || {};
    const div = document.getElementById('pvpList');
    if (!div) return;
    const entries = Object.entries(duels);
    div.innerHTML = entries.length ? `<div class="admin-table-wrap"><table class="admin-table">
      <thead><tr><th>Oluşturan</th><th>Rakip</th><th>Bahis</th><th>Durum</th><th>İşlem</th></tr></thead>
      <tbody>
        ${entries.map(([id, d]) => `<tr>
          <td>${d.creatorName||'?'}</td>
          <td>${d.opponent?.slice(0,8)||'?'}</td>
          <td>${_fmt(d.betAmount||0)}</td>
          <td><span class="badge-${d.status==='active'?'green':'yellow'}">${d.status||'?'}</span></td>
          <td><button class="admin-btn-xs red" onclick="window.AP.cancelDuel('${id}','${d.creator}','${d.opponent}',${d.betAmount||0})">İptal</button></td>
        </tr>`).join('')}
      </tbody>
    </table></div>` : '<p class="admin-muted">Aktif düello yok</p>';
  }

  async function cancelDuel(id, creator, opponent, bet) {
    await _rm('duels/active/' + id);
    if (creator) await _tx('users/' + creator + '/money', c => (c||0) + bet);
    if (opponent) await _tx('users/' + opponent + '/money', c => (c||0) + bet);
    _toast('❌ Düello iptal edildi, bahisler iade edildi');
  }

  async function cancelAllDuels() {
    if (!confirm('Tüm düellolar iptal edilecek!')) return;
    const duels = await _get('duels/active') || {};
    for (const [id, d] of Object.entries(duels)) {
      await cancelDuel(id, d.creator, d.opponent, d.betAmount || 0);
    }
    _toast('❌ Tüm düellolar iptal edildi');
  }

  async function resetAllDailyTasks() {
    const snap = await _get('users');
    const users = snap || {};
    const upd = {};
    Object.keys(users).forEach(uid => { upd['users/' + uid + '/dailyTasksDate'] = null; });
    await db().ref().update(upd);
    _toast('🔄 Tüm günlük görevler sıfırlandı');
    await _adminLog('reset_daily_tasks', {});
  }

  async function resetAllMiniGameStats() {
    if (!confirm('Tüm mini oyun istatistikleri silinecek!')) return;
    await _rm('mini');
    _toast('🗑️ Mini oyun verileri temizlendi');
  }

  async function giveWheelToAll() {
    const snap = await _get('users');
    const users = snap || {};
    const upd = {};
    Object.keys(users).forEach(u => { upd['users/' + u + '/wheelLastDate'] = null; });
    await db().ref().update(upd);
    _toast('🎡 Herkese çark hakkı verildi');
    await _adminLog('give_wheel_all', {});
  }

  async function openBotSuspectList() {
    const snap = await _get('mini');
    const mini = snap || {};
    const suspects = [];
    Object.entries(mini).forEach(([uid, games]) => {
      Object.entries(games || {}).forEach(([game, data]) => {
        if (data.bestScore && data.bestScore > 80) {
          suspects.push({ uid, game, score: data.bestScore });
        }
      });
    });
    _modal('🤖 Bot Şüphelileri', `
      <p class="admin-muted">Yüksek skor (>80 click) tespit edilenler:</p>
      ${suspects.length ? _table(['UID','Oyun','Skor','İşlem'],
        suspects.map(s => [s.uid.slice(0,10), s.game, s.score,
          `<button class="admin-btn-xs red" onclick="window.AP._quickBan('${s.uid}')">Ban</button>`])
      ) : '<p class="admin-muted">Bot şüphelisi yok</p>'}
    `, true);
  }

  async function openWheelCustomizer() {
    const WHEEL = window.WHEEL_PRIZES || [];
    _modal('🎡 Çark Ödülleri', `
      <div class="admin-table-wrap"><table class="admin-table">
        <thead><tr><th>Ödül</th><th>Tür</th><th>Miktar</th><th>Ağırlık</th></tr></thead>
        <tbody>
          ${WHEEL.map((p, i) => `<tr>
            <td>${p.label}</td>
            <td>${p.type}</td>
            <td>${p.amount || 0}</td>
            <td><input type="number" id="wp_${i}" value="${p.weight}" class="admin-input-xs"></td>
          </tr>`).join('')}
        </tbody>
      </table></div>
      <button class="admin-btn blue" onclick="window.AP.saveWheelWeights()">💾 Ağırlıkları Kaydet</button>
    `, true);
  }

  async function saveWheelWeights() {
    const WHEEL = window.WHEEL_PRIZES || [];
    const upd = {};
    WHEEL.forEach((p, i) => {
      const w = safeNum(document.getElementById('wp_' + i)?.value, p.weight);
      upd['system/wheelWeights/' + i] = w;
    });
    await db().ref().update(upd);
    _toast('💾 Çark ağırlıkları kaydedildi');
  }

  function openCardManager() {
    const CARDS = window.COLLECTIBLE_CARDS || [];
    _modal('🃏 Kart Yöneticisi', `
      <div class="admin-table-wrap"><table class="admin-table">
        <thead><tr><th>Kart</th><th>Nadirlik</th><th>Olasılık</th></tr></thead>
        <tbody>
          ${CARDS.map(c => `<tr>
            <td>${c.emo} ${c.name}</td>
            <td><span class="badge-${c.rarity==='legendary'?'gold':c.rarity==='epic'?'purple':c.rarity==='rare'?'blue':'grey'}">${c.rarity}</span></td>
            <td>${(c.probability * 100).toFixed(2)}%</td>
          </tr>`).join('')}
        </tbody>
      </table></div>
    `, true);
  }

  function openExpeditionManager() {
    const EXPS = window.EXPEDITIONS || [];
    _modal('🗺️ Sefer Yöneticisi', `
      <div class="admin-expedition-list">
        ${EXPS.map(e => `
          <div class="admin-card">
            <h4>${e.emo} ${e.name}</h4>
            <p class="admin-muted">${e.days} gün · ₺${e.reward.money.toLocaleString('tr-TR')} + ${e.reward.diamonds}💎</p>
            <div class="aud-input-row">
              <input type="text" id="exp_uid_${e.code}" placeholder="Oyuncu UID" class="admin-input-sm">
              <button class="admin-btn green" onclick="window.AP.completeExpedition('${e.code}')">✅ Tamamla</button>
              <button class="admin-btn red" onclick="window.AP.cancelExpedition('${e.code}')">❌ İptal</button>
            </div>
          </div>
        `).join('')}
      </div>
    `, true);
  }

  async function completeExpedition(code) {
    const tuid = document.getElementById('exp_uid_' + code)?.value?.trim();
    if (!tuid) return _toast('UID gir', 'error');
    const exp = (window.EXPEDITIONS || []).find(e => e.code === code);
    if (!exp) return;
    await _upd('expeditions/' + tuid + '/current', { status: 'completed', completedAt: TS() });
    await _tx('users/' + tuid + '/money', c => (c||0) + exp.reward.money);
    await _tx('users/' + tuid + '/diamonds', c => (c||0) + exp.reward.diamonds);
    await _tx('users/' + tuid + '/xp', c => (c||0) + exp.reward.xp);
    await _push('notifs/' + tuid, { type:'expedition_done', icon:'🗺️',
      msg:`🗺️ Seferin tamamlandı: ${exp.name}! +${_fmt(exp.reward.money)} +${exp.reward.diamonds}💎`,
      ts: TS(), read: false
    });
    _toast('✅ Sefer tamamlandı, ödüller verildi');
  }

  async function cancelExpedition(code) {
    const tuid = document.getElementById('exp_uid_' + code)?.value?.trim();
    if (!tuid) return _toast('UID gir', 'error');
    await _set('expeditions/' + tuid + '/current', null);
    _toast('❌ Sefer iptal edildi');
  }

  /* ══════════════════════════════════════════════════════════════════════════
     BÖLÜM 5: İLETİŞİM & DUYURU YÖNETİMİ (40 Özellik)
     ══════════════════════════════════════════════════════════════════════════ */

  /* Duyuru Modal */
  function openBroadcastModal() {
    _modal('📢 Duyuru Yayınla', `
      <div class="admin-broadcast-form">
        <div class="input-group">
          <label>📝 Duyuru Metni</label>
          <textarea id="bc_text" placeholder="Tüm oyunculara gönderilecek mesaj..." rows="3" class="admin-textarea"></textarea>
        </div>
        <div class="admin-filter-row">
          <label>⏱️ Süre (dakika)</label>
          <input type="number" id="bc_dur" value="30" class="admin-input-sm">
        </div>
        <div class="admin-filter-row">
          <button class="admin-btn green" onclick="window.AP.sendBroadcast()">📢 Tüm Oyunculara Yayınla</button>
          <button class="admin-btn red" onclick="window.AP.clearBroadcast()">🚫 Mevcut Duyuruyu Kaldır</button>
        </div>
      </div>
      <hr>
      <h4>📨 Segment Bazlı Bildirim</h4>
      <div class="admin-filter-row">
        <select id="bc_segment" class="admin-select">
          <option value="all">Tüm Oyuncular</option>
          <option value="vip">Sadece VIP</option>
          <option value="lv10plus">Lv 10+</option>
          <option value="lv25plus">Lv 25+</option>
          <option value="lv50plus">Lv 50+</option>
          <option value="inactive">14 gün inaktif</option>
          <option value="new">Yeni (7 gün içinde)</option>
        </select>
      </div>
      <div class="input-group">
        <textarea id="bc_seg_text" placeholder="Bildirim metni..." rows="2" class="admin-textarea"></textarea>
      </div>
      <button class="admin-btn blue" onclick="window.AP.sendSegmentNotif()">📨 Segment Bildirimi Gönder</button>
      <hr>
      <h4>⏰ Zamanlanmış Bildirim</h4>
      <div class="admin-filter-row">
        <input type="text" id="bc_sched_text" placeholder="Bildirim metni" class="admin-input">
        <input type="number" id="bc_sched_min" placeholder="Kaç dk sonra?" class="admin-input-sm">
        <button class="admin-btn yellow" onclick="window.AP.scheduleNotif()">⏰ Zamanla</button>
      </div>
    `, true);
  }

  async function sendBroadcast() {
    const text = document.getElementById('bc_text')?.value?.trim();
    const dur  = safeNum(document.getElementById('bc_dur')?.value, 30);
    if (!text) return _toast('Duyuru metni boş olamaz', 'error');
    await _set('broadcast/current', { active: true, text, sentAt: TS(), expiresAt: Date.now() + dur * 60 * 1000 });
    await _push('broadcast/history', { text, sentAt: TS(), dur });
    _toast('📢 Duyuru yayınlandı');
    await _adminLog('broadcast', { text: text.slice(0,100), dur });
  }

  async function clearBroadcast() {
    await _upd('broadcast/current', { active: false });
    _toast('🚫 Duyuru kaldırıldı');
  }

  async function sendSegmentNotif() {
    const segment = document.getElementById('bc_segment')?.value;
    const text    = document.getElementById('bc_seg_text')?.value?.trim();
    if (!text) return _toast('Bildirim metni boş', 'error');

    const snap  = await _get('users');
    const users = snap || {};
    const now   = Date.now();
    const day   = 24 * 3600 * 1000;

    let targets = Object.keys(users).filter(uid => {
      const u = users[uid];
      if (segment === 'vip')       return u.isVip;
      if (segment === 'lv10plus')  return (u.level||1) >= 10;
      if (segment === 'lv25plus')  return (u.level||1) >= 25;
      if (segment === 'lv50plus')  return (u.level||1) >= 50;
      if (segment === 'inactive')  return !u.lastLogin || (now - u.lastLogin) > 14*day;
      if (segment === 'new')       return u.createdAt && (now - u.createdAt) < 7*day;
      return true;
    });

    let batch = {};
    targets.forEach(uid => {
      const key = db().ref().push().key;
      batch['notifs/' + uid + '/' + key] = { type:'admin_notif', icon:'📢', msg: text, ts: TS(), read: false };
    });
    await db().ref().update(batch);
    _toast(`📨 ${targets.length} kullanıcıya bildirim gönderildi`);
    await _adminLog('segment_notif', { segment, count: targets.length });
  }

  function scheduleNotif() {
    const text = document.getElementById('bc_sched_text')?.value?.trim();
    const min  = safeNum(document.getElementById('bc_sched_min')?.value, 0);
    if (!text || !min) return _toast('Metin ve süre gir', 'error');
    setTimeout(async () => {
      const snap = await _get('users');
      const batch = {};
      Object.keys(snap || {}).forEach(uid => {
        const key = db().ref().push().key;
        batch['notifs/' + uid + '/' + key] = { type:'scheduled_notif', icon:'⏰', msg: text, ts: TS(), read: false };
      });
      await db().ref().update(batch);
      _toast(`📨 Zamanlanmış bildirim gönderildi: ${text.slice(0,50)}`);
    }, min * 60 * 1000);
    _toast(`⏰ ${min} dakika sonra bildirim gönderilecek`);
  }

  /* Haberler & Duyurular */
  function openNewsManager() {
    const panel = document.getElementById(window._adminTarget||'adminPanelBody');
    if (!panel) return;
    panel.innerHTML = `
      <div class="admin-section">
        <h2 class="admin-section-title">📰 Haber & Duyuru Yönetimi</h2>
        <div class="admin-row-2">
          <div class="admin-card">
            <h3>📝 Yeni Haber Oluştur</h3>
            <div class="input-group">
              <label>Başlık</label>
              <input type="text" id="news_title" placeholder="Haber başlığı" class="admin-input">
            </div>
            <div class="input-group">
              <label>İçerik</label>
              <textarea id="news_body" rows="4" placeholder="Haber içeriği..." class="admin-textarea"></textarea>
            </div>
            <div class="admin-filter-row">
              <select id="news_cat" class="admin-select">
                <option value="update">🔄 Güncelleme</option>
                <option value="event">🎉 Etkinlik</option>
                <option value="maintenance">🔧 Bakım</option>
                <option value="announcement">📢 Duyuru</option>
              </select>
              <input type="text" id="news_icon" placeholder="İkon emoji" class="admin-input-sm" value="📢">
            </div>
            <div class="admin-filter-row">
              <label><input type="checkbox" id="news_pin"> 📌 Sabitle (üstte kalsın)</label>
            </div>
            <div class="admin-action-row">
              <button class="admin-btn green" onclick="window.AP.createNews()">✅ Yayınla</button>
              <button class="admin-btn yellow" onclick="window.AP.previewNews()">👁️ Önizle</button>
            </div>
          </div>
          <div class="admin-card">
            <h3>📋 Mevcut Haberler</h3>
            <div id="newsList" class="admin-loading">Yükleniyor...</div>
          </div>
        </div>
      </div>`;
    window.AP.loadNews();
  }

  async function loadNews() {
    const news = await _get('news') || {};
    const div = document.getElementById('newsList');
    if (!div) return;
    const entries = Object.entries(news).sort((a,b) => (b[1].ts||0) - (a[1].ts||0)).slice(0, 20);
    div.innerHTML = entries.length ? entries.map(([id, n]) => `
      <div class="admin-news-item">
        <div class="ani-head">${n.icon||'📢'} <b>${n.title||'Başlıksız'}</b> ${n.pinned?'📌':''}</div>
        <div class="ani-meta">${n.category||'?'} · ${n.ts?new Date(n.ts).toLocaleDateString('tr-TR'):'?'}</div>
        <div class="admin-action-row">
          <button class="admin-btn-xs blue" onclick="window.AP.pinNews('${id}',${!n.pinned})">📌 ${n.pinned?'Sabitleme Kaldır':'Sabitle'}</button>
          <button class="admin-btn-xs yellow" onclick="window.AP.hideNews('${id}',${!n.hidden})">👁️ ${n.hidden?'Göster':'Gizle'}</button>
          <button class="admin-btn-xs red" onclick="window.AP.deleteNews('${id}')">🗑️ Sil</button>
        </div>
      </div>`).join('') : '<p class="admin-muted">Haber yok</p>';
  }

  async function createNews() {
    const title   = document.getElementById('news_title')?.value?.trim();
    const body    = document.getElementById('news_body')?.value?.trim();
    const cat     = document.getElementById('news_cat')?.value || 'announcement';
    const icon    = document.getElementById('news_icon')?.value?.trim() || '📢';
    const pinned  = document.getElementById('news_pin')?.checked || false;

    if (!title || !body) return _toast('Başlık ve içerik gerekli', 'error');
    await _push('news', { title, body, category: cat, icon, pinned, hidden: false, ts: TS(), author: 'Admin' });
    _toast('✅ Haber yayınlandı');
    await _adminLog('create_news', { title });
    loadNews();
  }

  function previewNews() {
    const title = document.getElementById('news_title')?.value;
    const body  = document.getElementById('news_body')?.value;
    const icon  = document.getElementById('news_icon')?.value || '📢';
    _modal('👁️ Haber Önizleme', `<div class="news-preview-box"><h3>${icon} ${title}</h3><p>${body}</p></div>`);
  }

  async function pinNews(id, val) {
    await _upd('news/' + id, { pinned: val });
    _toast(val ? '📌 Sabitlendi' : 'Sabitleme kaldırıldı');
    loadNews();
  }

  async function hideNews(id, val) {
    await _upd('news/' + id, { hidden: val });
    _toast(val ? '👁️ Gizlendi' : 'Gösterildi');
    loadNews();
  }

  async function deleteNews(id) {
    await _rm('news/' + id);
    _toast('🗑️ Haber silindi');
    loadNews();
  }

  /* Bakım Modal */
  function toggleMaintModal() {
    _modal('🔧 Bakım Modu Yönetimi', `
      <div class="admin-maint-form">
        <div class="input-group">
          <label>📝 Bakım Sebebi</label>
          <input type="text" id="maint_reason" placeholder="Sistem güncelleniyor..." class="admin-input">
        </div>
        <div class="input-group">
          <label>⏱️ Tahmini Süre</label>
          <input type="text" id="maint_eta" placeholder="15 dk, 1 saat..." class="admin-input">
        </div>
        <div class="admin-action-row">
          <button class="admin-btn red" onclick="window.AP.setMaintenance(true)">🔧 BAKIMA AL</button>
          <button class="admin-btn green" onclick="window.AP.setMaintenance(false)">✅ BAKIMDAN ÇIKAR</button>
        </div>
        <div class="admin-planned-maint">
          <h4>📅 Planlı Bakım</h4>
          <div class="admin-filter-row">
            <input type="datetime-local" id="maint_plan_time" class="admin-input">
            <input type="number" id="maint_warn_min" placeholder="Kaç dk önce uyar?" value="15" class="admin-input-sm">
          </div>
          <button class="admin-btn yellow" onclick="window.AP.scheduleMaintenance()">⏰ Zamanla</button>
        </div>
      </div>
    `, true);
  }

  async function setMaintenance(active) {
    const reason = document.getElementById('maint_reason')?.value || 'Sistem güncelleniyor';
    const eta    = document.getElementById('maint_eta')?.value || '15 dk';
    await _set('system/maintenance', { active, reason, eta, setAt: TS() });
    const maint = document.getElementById('maintenanceScreen');
    if (maint) {
      if (active) { maint.classList.add('active'); maint.style.display = 'flex'; }
      else        { maint.classList.remove('active'); maint.style.display = 'none'; }
    }
    _toast(active ? '🔧 Bakım modu açıldı' : '✅ Bakım modu kapatıldı');
    await _adminLog('toggle_maintenance', { active, reason });
  }

  function scheduleMaintenance() {
    const planTime = document.getElementById('maint_plan_time')?.value;
    const warnMin  = safeNum(document.getElementById('maint_warn_min')?.value, 15);
    if (!planTime) return _toast('Zaman seç', 'error');
    const target = new Date(planTime).getTime();
    const now    = Date.now();
    const warnAt = target - warnMin * 60 * 1000;
    if (warnAt > now) {
      setTimeout(async () => {
        const snap  = await _get('users');
        const batch = {};
        Object.keys(snap || {}).forEach(uid => {
          const key = db().ref().push().key;
          batch['notifs/' + uid + '/' + key] = {
            type:'maintenance_warn', icon:'🔧',
            msg: `⚠️ ${warnMin} dakika sonra bakım başlıyor!`,
            ts: TS(), read: false
          };
        });
        await db().ref().update(batch);
      }, warnAt - now);
    }
    if (target > now) {
      setTimeout(() => window.AP.setMaintenance(true), target - now);
    }
    _toast(`⏰ Bakım ${new Date(target).toLocaleString('tr-TR')}'da başlayacak`);
  }

  /* Sohbet Yönetimi */
  function openChatManager() {
    const panel = document.getElementById(window._adminTarget||'adminPanelBody');
    if (!panel) return;
    panel.innerHTML = `
      <div class="admin-section">
        <h2 class="admin-section-title">💬 Sohbet Yönetimi</h2>
        <div class="admin-chat-actions">
          <input type="text" id="chat_mute_uid" placeholder="Mute için UID" class="admin-input">
          <input type="number" id="chat_mute_min" placeholder="Süre (dk)" value="60" class="admin-input-sm">
          <button class="admin-btn red" onclick="window.AP.muteUser()">🔇 Mute Et</button>
          <button class="admin-btn green" onclick="window.AP.unmuteUser()">🔊 Mute Kaldır</button>
        </div>
        <div class="admin-filter-row">
          <textarea id="chat_admin_msg" placeholder="Admin mesajı (altın badge ile gözükür)" rows="2" class="admin-textarea"></textarea>
          <button class="admin-btn gold" onclick="window.AP.sendAdminChatMsg()">👑 Admin Mesajı Gönder</button>
        </div>
        <div class="admin-filter-row">
          <input type="text" id="filter_word" placeholder="Yasaklı kelime ekle..." class="admin-input">
          <button class="admin-btn red" onclick="window.AP.addFilterWord()">➕ Ekle</button>
          <button class="admin-btn green" onclick="window.AP.loadFilterWords()">📋 Listeyi Gör</button>
        </div>
        <h3>💬 Canlı Sohbet</h3>
        <div id="chatMessages" class="admin-chat-live admin-loading">Yükleniyor...</div>
        <button class="admin-btn blue" onclick="window.AP.loadChatMessages()">🔄 Yenile</button>
      </div>`;
    window.AP.loadChatMessages();
  }

  async function loadChatMessages() {
    const msgs = await _get('chat/global') || {};
    const div = document.getElementById('chatMessages');
    if (!div) return;
    const sorted = Object.entries(msgs).sort((a,b) => (b[1].ts||0) - (a[1].ts||0)).slice(0, 50);
    div.innerHTML = sorted.length ? sorted.map(([id, m]) => `
      <div class="admin-chat-msg">
        <span class="chat-user">${m.username||'?'}</span>
        <span class="chat-time">${m.ts?new Date(m.ts).toLocaleTimeString('tr-TR'):''}</span>
        <span class="chat-text">${m.message||''}</span>
        <button class="admin-btn-xs red" onclick="window.AP.deleteChatMsg('${id}')">🗑️</button>
        <button class="admin-btn-xs orange" onclick="window.AP.muteChatUser('${m.uid}')">🔇</button>
      </div>`).join('') : '<p class="admin-muted">Mesaj yok</p>';
  }

  async function deleteChatMsg(id) {
    await _rm('chat/global/' + id);
    _toast('🗑️ Mesaj silindi');
    loadChatMessages();
  }

  async function muteUser() {
    const tuid = document.getElementById('chat_mute_uid')?.value?.trim();
    const min  = safeNum(document.getElementById('chat_mute_min')?.value, 60);
    if (!tuid) return _toast('UID gir', 'error');
    await _upd('users/' + tuid, { chatMutedUntil: Date.now() + min * 60 * 1000 });
    _toast(`🔇 ${tuid.slice(0,8)} ${min} dk mute edildi`);
  }

  async function unmuteUser() {
    const tuid = document.getElementById('chat_mute_uid')?.value?.trim();
    if (!tuid) return _toast('UID gir', 'error');
    await _upd('users/' + tuid, { chatMutedUntil: 0 });
    _toast('🔊 Mute kaldırıldı');
  }

  async function muteChatUser(tuid) {
    await _upd('users/' + tuid, { chatMutedUntil: Date.now() + 3600000 });
    _toast('🔇 1 saat mute edildi');
  }

  async function sendAdminChatMsg() {
    const msg = document.getElementById('chat_admin_msg')?.value?.trim();
    if (!msg) return _toast('Mesaj boş', 'error');
    await _push('chat/global', {
      uid: uid() || 'admin', username: '👑 Admin',
      message: msg, ts: TS(), isAdmin: true
    });
    _toast('👑 Admin mesajı gönderildi');
  }

  async function addFilterWord() {
    const word = document.getElementById('filter_word')?.value?.trim()?.toLowerCase();
    if (!word) return _toast('Kelime gir', 'error');
    await _push('system/filterWords', word);
    _toast(`🚫 "${word}" engellendi`);
  }

  async function loadFilterWords() {
    const words = await _get('system/filterWords') || {};
    _modal('🚫 Yasaklı Kelimeler', `
      <ul class="admin-filter-word-list">
        ${Object.entries(words).map(([id, w]) => `
          <li>${w} <button class="admin-btn-xs red" onclick="window.AP.removeFilterWord('${id}')">Kaldır</button></li>
        `).join('') || '<li class="admin-muted">Liste boş</li>'}
      </ul>
    `);
  }

  async function removeFilterWord(id) {
    await _rm('system/filterWords/' + id);
    _toast('✅ Kelime kaldırıldı');
    loadFilterWords();
  }

  /* Toplu Bildirim */
  function openBulkNotifModal() {
    _modal('📨 Toplu Bildirim', `
      <div class="input-group">
        <label>📝 Bildirim Mesajı</label>
        <textarea id="bulk_notif_text" rows="3" placeholder="Tüm oyunculara gönderilecek bildirim..." class="admin-textarea"></textarea>
      </div>
      <div class="admin-filter-row">
        <input type="text" id="bulk_notif_icon" placeholder="İkon" value="📢" class="admin-input-sm">
      </div>
      <button class="admin-btn green" onclick="window.AP.sendBulkNotif()" style="width:100%">📨 TÜMÜNE GÖNDER</button>
    `);
  }

  async function sendBulkNotif() {
    const text = document.getElementById('bulk_notif_text')?.value?.trim();
    const icon = document.getElementById('bulk_notif_icon')?.value || '📢';
    if (!text) return _toast('Mesaj boş', 'error');
    const snap  = await _get('users');
    const users = snap || {};
    let batch = {};
    Object.keys(users).forEach(uid => {
      const key = db().ref().push().key;
      batch['notifs/' + uid + '/' + key] = { type:'bulk_notif', icon, msg: text, ts: TS(), read: false };
    });
    await db().ref().update(batch);
    _toast(`📨 ${Object.keys(users).length} oyuncuya bildirim gönderildi`);
    await _adminLog('bulk_notif', { text: text.slice(0,100) });
    _closeModal();
  }

  /* ══════════════════════════════════════════════════════════════════════════
     BÖLÜM 6: GÜVENLİK & MODERASYon (25 Özellik)
     ══════════════════════════════════════════════════════════════════════════ */

  function openSecurityLogs() {
    const panel = document.getElementById(window._adminTarget||'adminPanelBody');
    if (!panel) return;
    panel.innerHTML = `
      <div class="admin-section">
        <h2 class="admin-section-title">🛡️ Güvenlik & Moderasyon</h2>
        <div class="admin-security-tabs">
          <button class="admin-tab active" onclick="window.AP._secTab(this,'attempts')">🔐 Admin Girişleri</button>
          <button class="admin-tab" onclick="window.AP._secTab(this,'reports')">🚨 Raporlar</button>
          <button class="admin-tab" onclick="window.AP._secTab(this,'suspicious')">⚠️ Şüpheli Aktivite</button>
          <button class="admin-tab" onclick="window.AP._secTab(this,'adminlog')">📋 Admin Logu</button>
        </div>
        <div id="secTabContent"></div>
      </div>`;
    window.AP._secTab(null, 'attempts');
  }

  function _secTab(el, tab) {
    document.querySelectorAll('.admin-security-tabs .admin-tab').forEach(t => t.classList.remove('active'));
    if (el) el.classList.add('active');
    if (tab === 'attempts') window.AP.loadSecAttempts();
    else if (tab === 'reports') window.AP.loadReports();
    else if (tab === 'suspicious') window.AP.loadSuspicious();
    else if (tab === 'adminlog') window.AP.loadAdminLog();
  }

  async function loadSecAttempts() {
    const div = document.getElementById('secTabContent');
    if (!div) return;
    const attempts = await _get('security/founderAttempts') || {};
    const sorted = Object.values(attempts).sort((a,b) => (b.ts||0) - (a.ts||0)).slice(0, 50);
    div.innerHTML = `<h4>🔐 Admin Giriş Denemeleri (Son 50)</h4>
      ${sorted.length ? _table(
        ['Tarih','UID','Başarı','Cihaz FP'],
        sorted.map(a => [
          new Date(a.ts||0).toLocaleString('tr-TR'),
          (a.uid||'?').slice(0,12),
          a.success ? '<span class="badge-green">✅</span>' : '<span class="badge-red">❌</span>',
          (a.fp||'?').slice(0,12)
        ])
      ) : '<p class="admin-muted">Log yok</p>'}`;
  }

  async function loadReports() {
    const div = document.getElementById('secTabContent');
    if (!div) return;
    const reports = await _get('reports') || {};
    const entries = Object.entries(reports).sort((a,b) => (b[1].ts||0) - (a[1].ts||0));
    div.innerHTML = `<h4>🚨 Kullanıcı Raporları</h4>
      ${entries.length ? `<div class="admin-table-wrap"><table class="admin-table">
        <thead><tr><th>Rapor Eden</th><th>Hedef</th><th>Sebep</th><th>Tarih</th><th>Durum</th><th>İşlem</th></tr></thead>
        <tbody>
          ${entries.map(([id, r]) => `<tr>
            <td>${(r.reporterUid||'?').slice(0,8)}</td>
            <td>${(r.targetUid||'?').slice(0,8)}</td>
            <td>${r.reason||'?'}</td>
            <td>${r.ts?new Date(r.ts).toLocaleDateString('tr-TR'):'?'}</td>
            <td><span class="badge-${r.status==='open'?'red':'grey'}">${r.status||'open'}</span></td>
            <td>
              <button class="admin-btn-xs red" onclick="window.AP._quickBan('${r.targetUid}')">Ban</button>
              <button class="admin-btn-xs yellow" onclick="window.AP.warnUser('${r.targetUid}')">⚠️ Uyar</button>
              <button class="admin-btn-xs grey" onclick="window.AP.closeReport('${id}')">Kapat</button>
            </td>
          </tr>`).join('')}
        </tbody>
      </table></div>` : '<p class="admin-muted">Rapor yok</p>'}`;
  }

  async function warnUser(tuid) {
    await _push('notifs/' + tuid, {
      type: 'admin_warning', icon: '⚠️',
      msg: '⚠️ Hesabınız için uyarı aldınız. Kural ihlali durumunda ban uygulanacaktır.',
      ts: TS(), read: false
    });
    _toast('⚠️ Kullanıcı uyarıldı');
  }

  async function closeReport(id) {
    await _upd('reports/' + id, { status: 'closed', closedAt: TS() });
    _toast('✅ Rapor kapatıldı');
    loadReports();
  }

  async function loadSuspicious() {
    const div = document.getElementById('secTabContent');
    if (!div) return;
    div.innerHTML = '<div class="admin-loading">Analiz yapılıyor...</div>';
    const users = await _get('users') || {};
    const suspicious = [];
    for (const [id, u] of Object.entries(users)) {
      const reasons = [];
      if ((u.money || 0) > 1e10) reasons.push('Anormal para (>10B)');
      if ((u.diamonds || 0) > 100000) reasons.push('Anormal elmas (>100K)');
      if ((u.level || 1) > 100) reasons.push('Anormal seviye (>100)');
      if (reasons.length) suspicious.push({ id, name: u.username, reasons });
    }
    div.innerHTML = `<h4>⚠️ Şüpheli Aktivite (${suspicious.length})</h4>
      ${suspicious.length ? suspicious.map(s => `
        <div class="admin-suspicious-item">
          <b>${s.name||'?'}</b> (${s.id.slice(0,10)}): ${s.reasons.join(', ')}
          <button class="admin-btn-xs red" onclick="window.AP.openUserDetail('${s.id}')">İncele</button>
          <button class="admin-btn-xs orange" onclick="window.AP._quickBan('${s.id}')">Ban</button>
        </div>`).join('') : '<p class="admin-muted">Şüpheli aktivite tespit edilmedi</p>'}`;
  }

  async function loadAdminLog() {
    const div = document.getElementById('secTabContent');
    if (!div) return;
    const logs = await _get('adminLogs') || {};
    const sorted = Object.values(logs).sort((a,b) => (b.ts||0) - (a.ts||0)).slice(0, 100);
    div.innerHTML = `<h4>📋 Admin İşlem Logu (Son 100)</h4>
      ${sorted.length ? _table(
        ['Tarih','Admin UID','İşlem','Detay'],
        sorted.map(l => [
          new Date(l.ts||0).toLocaleString('tr-TR'),
          (l.adminUid||'?').slice(0,10),
          l.action||'?',
          (l.details||'').slice(0,60)
        ])
      ) : '<p class="admin-muted">Log yok</p>'}`;
  }

  /* ══════════════════════════════════════════════════════════════════════════
     BÖLÜM 7: SİSTEM YÖNETİMİ (38 Özellik)
     ══════════════════════════════════════════════════════════════════════════ */

  function openSystemSettings() {
    const panel = document.getElementById(window._adminTarget||'adminPanelBody');
    if (!panel) return;
    panel.innerHTML = `
      <div class="admin-section">
        <h2 class="admin-section-title">⚙️ Sistem Yönetimi</h2>
        <div class="admin-row-2">
          <!-- GENEL AYARLAR -->
          <div class="admin-card">
            <h3>⚙️ Genel Ayarlar</h3>
            <div class="admin-settings-grid">
              <div class="admin-setting-row"><label>🎮 Oyun Versiyonu</label>
                <input type="text" id="sys_version" placeholder="v3.0" class="admin-input-sm">
                <button class="admin-btn blue" onclick="window.AP.setSystemSetting('gameVersion','sys_version')">Kaydet</button></div>
              <div class="admin-setting-row"><label>📝 Login Mesajı</label>
                <input type="text" id="sys_login_msg" placeholder="Giriş ekranı mesajı" class="admin-input">
                <button class="admin-btn blue" onclick="window.AP.setSystemSetting('loginMessage','sys_login_msg')">Kaydet</button></div>
              <div class="admin-setting-row"><label>Kayıt</label>
                <button class="admin-btn green" onclick="window.AP.toggleRegistration(true)">✅ Aç</button>
                <button class="admin-btn red" onclick="window.AP.toggleRegistration(false)">🔒 Kapat</button></div>
              <div class="admin-setting-row"><label>Anonim Giriş</label>
                <button class="admin-btn green" onclick="window.AP.toggleAnon(true)">✅ Aç</button>
                <button class="admin-btn red" onclick="window.AP.toggleAnon(false)">🔒 Kapat</button></div>
              <div class="admin-setting-row"><label>Max Para Limiti</label>
                <input type="number" id="sys_max_money" placeholder="999999999999" class="admin-input-sm">
                <button class="admin-btn blue" onclick="window.AP.setGlobalSetting('maxMoney','sys_max_money')">Kaydet</button></div>
              <div class="admin-setting-row"><label>Max Elmas Limiti</label>
                <input type="number" id="sys_max_dia" placeholder="999999" class="admin-input-sm">
                <button class="admin-btn blue" onclick="window.AP.setGlobalSetting('maxDiamonds','sys_max_dia')">Kaydet</button></div>
              <div class="admin-setting-row" style="background:rgba(245,158,11,.08);border-radius:8px;padding:8px;border:1px solid rgba(245,158,11,.3)"><label>💎 1 Elmas = Kaç ₺ (Nakit)</label>
                <input type="number" id="sys_elmas_fiyat" placeholder="1500" min="1" class="admin-input-sm">
                <button class="admin-btn gold" onclick="window.AP.setElmasFiyati()">Ayarla</button></div>
            </div>
          </div>

          <!-- ETKİNLİK SİSTEMİ -->
          <div class="admin-card">
            <h3>🎉 Etkinlik Sistemi</h3>
            <div class="admin-settings-grid">
              <div class="admin-setting-row"><label>Çift XP Süresi (dk)</label>
                <input type="number" id="evt_2xp_min" placeholder="60" class="admin-input-sm">
                <button class="admin-btn purple" onclick="window.AP.startEvent('doubleXP','evt_2xp_min')">Başlat</button></div>
              <div class="admin-setting-row"><label>Çift Para Süresi (dk)</label>
                <input type="number" id="evt_2money_min" placeholder="60" class="admin-input-sm">
                <button class="admin-btn gold" onclick="window.AP.startEvent('doubleMoney','evt_2money_min')">Başlat</button></div>
              <div class="admin-setting-row"><label>İndirim % (Mağaza)</label>
                <input type="number" id="evt_discount" placeholder="20" class="admin-input-sm">
                <button class="admin-btn teal" onclick="window.AP.startDiscountEvent()">Başlat</button></div>
            </div>
            <button class="admin-btn orange" onclick="window.AP.openEventModal()">🎉 Özel Etkinlik Oluştur</button>
            <button class="admin-btn red" onclick="window.AP.stopAllEvents()">⛔ Tüm Etkinlikleri Durdur</button>
          </div>

          <!-- FİREBASE İZLEME -->
          <div class="admin-card">
            <h3>🔥 Firebase İzleme</h3>
            <div id="fbStatus" class="admin-loading">Yükleniyor...</div>
            <div class="admin-action-row">
              <button class="admin-btn blue" onclick="window.AP.loadFirebaseStatus()">🔄 Durum Yenile</button>
              <button class="admin-btn yellow" onclick="window.AP.openRawDataViewer()">📂 Raw Data Görüntüle</button>
            </div>
          </div>

          <!-- TEMA YÖNETİMİ -->
          <div class="admin-card">
            <h3>🎨 Tema & Görsel</h3>
            <div class="admin-settings-grid">
              <div class="admin-setting-row"><label>Ana Renk</label>
                <input type="color" id="theme_primary" value="#3b82f6">
                <button class="admin-btn blue" onclick="window.AP.applyThemeColor('primary','theme_primary')">Uygula</button></div>
              <div class="admin-setting-row"><label>İkincil Renk</label>
                <input type="color" id="theme_secondary" value="#10b981">
                <button class="admin-btn teal" onclick="window.AP.applyThemeColor('secondary','theme_secondary')">Uygula</button></div>
              <div class="admin-setting-row"><label>Sezon Teması</label>
                <select id="theme_season" class="admin-select">
                  <option value="">Varsayılan</option>
                  <option value="winter">❄️ Kış</option>
                  <option value="summer">☀️ Yaz</option>
                  <option value="spring">🌸 İlkbahar</option>
                  <option value="bayram">🌙 Bayram</option>
                </select>
                <button class="admin-btn yellow" onclick="window.AP.applySeasonTheme()">Uygula</button></div>
            </div>
          </div>
        </div>
      </div>`;
    window.AP.loadFirebaseStatus();
  }

  async function setSystemSetting(key, inputId) {
    const val = document.getElementById(inputId)?.value?.trim();
    if (!val) return _toast('Değer gir', 'error');
    await _set('system/settings/' + key, val);
    _toast(`✅ ${key} kaydedildi`);
    await _adminLog('set_system_setting', { key, val });
  }

  async function setElmasFiyati() {
    const val = safeNum(document.getElementById('sys_elmas_fiyat')?.value);
    if (!val || val < 1) return _toast('Geçerli fiyat gir (min: 1₺)', 'error');
    await _set('system/elmasFiyati', val);
    _toast(`💎 Elmas fiyatı: 1 💎 = ${_fmt(val)} olarak ayarlandı`);
    await _adminLog('set_elmas_fiyati', { fiyat: val });
    // Tüm oyunculara bildir
    const snap = await _get('users');
    const batch = {};
    Object.keys(snap || {}).forEach(uid => {
      const key = db().ref().push().key;
      batch['notifs/' + uid + '/' + key] = {
        type:'elmas_fiyat', icon:'💎',
        msg: `💎 Elmas fiyatı güncellendi: 1 Elmas = ${_fmt(val)}`,
        ts: TS(), read: false
      };
    });
    await db().ref().update(batch);
  }

  async function toggleRegistration(open) {
    await _set('system/settings/registrationOpen', open);
    _toast(open ? '✅ Kayıt açıldı' : '🔒 Kayıt kapatıldı');
  }

  async function toggleAnon(open) {
    await _set('system/settings/anonLoginOpen', open);
    _toast(open ? '✅ Anonim giriş açıldı' : '🔒 Anonim giriş kapatıldı');
  }

  async function startEvent(type, inputId) {
    const min = safeNum(document.getElementById(inputId)?.value, 60);
    const endsAt = Date.now() + min * 60 * 1000;
    await _set('system/events/' + type, { active: true, startedAt: TS(), endsAt, mult: 2 });
    // Tüm oyunculara bildirim
    const snap = await _get('users');
    const batch = {};
    const icon = type === 'doubleXP' ? '⭐' : '💰';
    const msg  = type === 'doubleXP' ? `⭐ Çift XP etkinliği başladı! ${min} dk boyunca 2x XP kazan!` : `💰 Çift para etkinliği başladı! ${min} dk boyunca 2x kazanç!`;
    Object.keys(snap || {}).forEach(uid => {
      const key = db().ref().push().key;
      batch['notifs/' + uid + '/' + key] = { type:'event_start', icon, msg, ts: TS(), read: false };
    });
    await db().ref().update(batch);
    _toast(`🎉 ${type} etkinliği ${min} dk başladı!`);
    await _adminLog('start_event', { type, min });
  }

  async function startDiscountEvent() {
    const pct = safeNum(document.getElementById('evt_discount')?.value, 20);
    await _set('system/events/shopDiscount', { active: true, pct, startedAt: TS() });
    _toast(`🏷️ %${pct} indirim etkinliği başladı`);
  }

  async function stopAllEvents() {
    await _rm('system/events');
    _toast('⛔ Tüm etkinlikler durduruldu');
    await _adminLog('stop_all_events', {});
  }

  function openEventModal() {
    _modal('🎉 Özel Etkinlik Oluştur', `
      <div class="input-group"><label>Etkinlik Adı</label>
        <input type="text" id="evt_name" placeholder="Örn: Sonbahar Şenliği" class="admin-input"></div>
      <div class="input-group"><label>Açıklama</label>
        <textarea id="evt_desc" rows="2" placeholder="Etkinlik detayları..." class="admin-textarea"></textarea></div>
      <div class="admin-filter-row">
        <input type="text" id="evt_icon" placeholder="İkon" value="🎉" class="admin-input-sm">
        <input type="number" id="evt_dur_hr" placeholder="Süre (saat)" value="24" class="admin-input-sm">
      </div>
      <div class="admin-filter-row">
        <label>Ödül Çarpanı (×)</label>
        <input type="number" id="evt_mult" placeholder="1.5" step="0.1" value="1.5" class="admin-input-sm">
      </div>
      <button class="admin-btn green" onclick="window.AP.createCustomEvent()" style="width:100%">🎉 Etkinliği Başlat</button>
    `);
  }

  async function createCustomEvent() {
    const name  = document.getElementById('evt_name')?.value?.trim();
    const desc  = document.getElementById('evt_desc')?.value?.trim();
    const icon  = document.getElementById('evt_icon')?.value || '🎉';
    const hours = safeNum(document.getElementById('evt_dur_hr')?.value, 24);
    const mult  = safeNum(document.getElementById('evt_mult')?.value, 1.5);
    if (!name) return _toast('Etkinlik adı gir', 'error');
    const evt = { active:true, name, desc, icon, mult, startedAt: TS(), endsAt: Date.now() + hours * 3600 * 1000 };
    await _set('system/events/custom', evt);
    await _set('broadcast/current', {
      active: true, text: `${icon} ${name} başladı! ${desc}`,
      sentAt: TS(), expiresAt: Date.now() + hours * 3600 * 1000
    });
    _toast(`🎉 ${name} etkinliği başladı!`);
    _closeModal();
    await _adminLog('create_event', { name, hours, mult });
  }

  async function loadFirebaseStatus() {
    const div = document.getElementById('fbStatus');
    if (!div) return;
    const settings = await _get('system/settings') || {};
    const events   = await _get('system/events') || {};
    div.innerHTML = `
      <table class="admin-mini-table">
        <tr><td>Bağlantı</td><td><span class="badge-green">✅ Aktif</span></td></tr>
        <tr><td>Kayıt Durumu</td><td><b>${settings.registrationOpen !== false ? '✅ Açık' : '🔒 Kapalı'}</b></td></tr>
        <tr><td>Anonim Giriş</td><td><b>${settings.anonLoginOpen !== false ? '✅ Açık' : '🔒 Kapalı'}</b></td></tr>
        <tr><td>Bakım Modu</td><td><b>${settings.maintenance?.active ? '🔧 Aktif' : '✅ Normal'}</b></td></tr>
        <tr><td>Aktif Etkinlik</td><td><b>${Object.keys(events).length}</b></td></tr>
        <tr><td>Oyun Versiyonu</td><td><b>${settings.gameVersion || 'v2.0'}</b></td></tr>
        <tr><td>Başlangıç Parası</td><td><b>${_fmt(settings.startMoney || 10000)}</b></td></tr>
      </table>`;
  }

  function openRawDataViewer() {
    _modal('📂 Raw Data Görüntüleyici', `
      <div class="input-group">
        <label>Firebase Path</label>
        <input type="text" id="raw_path" placeholder="system/settings" class="admin-input">
        <button class="admin-btn blue" onclick="window.AP.loadRawData()">Yükle</button>
      </div>
      <div class="input-group">
        <label>JSON Düzenle</label>
        <textarea id="raw_editor" rows="10" class="admin-textarea admin-mono"></textarea>
      </div>
      <div class="admin-action-row">
        <button class="admin-btn yellow" onclick="window.AP.saveRawData()">💾 Kaydet</button>
        <button class="admin-btn red" onclick="window.AP.deleteRawData()">🗑️ Sil</button>
      </div>
      <div class="admin-muted small">⚠️ Dikkatli kullan! Yanlış veri sistemi bozabilir.</div>
    `, true);
  }

  async function loadRawData() {
    const path = document.getElementById('raw_path')?.value?.trim();
    if (!path) return _toast('Path gir', 'error');
    try {
      const data = await _get(path);
      document.getElementById('raw_editor').value = JSON.stringify(data, null, 2);
    } catch(e) { _toast('Yüklenemedi: ' + e.message, 'error'); }
  }

  async function saveRawData() {
    const path = document.getElementById('raw_path')?.value?.trim();
    const raw  = document.getElementById('raw_editor')?.value;
    if (!path || !raw) return _toast('Path ve veri gerekli', 'error');
    if (!confirm('Bu path\'e veriyi kaydetmek istediğine emin misin?')) return;
    try {
      const data = JSON.parse(raw);
      await _set(path, data);
      _toast('💾 Kaydedildi');
      await _adminLog('raw_data_save', { path });
    } catch(e) { _toast('Geçersiz JSON: ' + e.message, 'error'); }
  }

  async function deleteRawData() {
    const path = document.getElementById('raw_path')?.value?.trim();
    if (!path) return _toast('Path gir', 'error');
    if (!confirm(`"${path}" silinecek! Emin misin?`)) return;
    await _rm(path);
    _toast('🗑️ Silindi');
    await _adminLog('raw_data_delete', { path });
  }

  async function applyThemeColor(type, inputId) {
    const color = document.getElementById(inputId)?.value;
    if (!color) return;
    await _set('system/settings/theme/' + type, color);
    document.documentElement.style.setProperty('--color-' + type, color);
    _toast(`🎨 ${type} rengi değiştirildi`);
  }

  async function applySeasonTheme() {
    const season = document.getElementById('theme_season')?.value;
    await _set('system/settings/seasonTheme', season);
    _toast(`🌸 ${season || 'Varsayılan'} teması uygulandı`);
  }

  /* ══════════════════════════════════════════════════════════════════════════
     BÖLÜM 8: ANALİTİK & RAPORLAMA (23 Özellik)
     ══════════════════════════════════════════════════════════════════════════ */

  function openAnalytics() {
    const panel = document.getElementById(window._adminTarget||'adminPanelBody');
    if (!panel) return;
    panel.innerHTML = `
      <div class="admin-section">
        <h2 class="admin-section-title">📊 Analitik & Raporlama</h2>
        <div class="admin-analytics-tabs">
          <button class="admin-tab active" onclick="window.AP._anaTab(this,'economy')">💰 Ekonomi</button>
          <button class="admin-tab" onclick="window.AP._anaTab(this,'players')">👥 Oyuncular</button>
          <button class="admin-tab" onclick="window.AP._anaTab(this,'tech')">🔧 Teknik</button>
        </div>
        <div id="anaTabContent" class="admin-loading">Yükleniyor...</div>
      </div>`;
    window.AP._anaTab(null, 'economy');
  }

  function _anaTab(el, tab) {
    document.querySelectorAll('.admin-analytics-tabs .admin-tab').forEach(t => t.classList.remove('active'));
    if (el) el.classList.add('active');
    if (tab === 'economy') window.AP.loadEconomyAnalytics();
    else if (tab === 'players') window.AP.loadPlayerAnalytics();
    else if (tab === 'tech') window.AP.loadTechAnalytics();
  }

  async function loadEconomyAnalytics() {
    const div = document.getElementById('anaTabContent');
    if (!div) return;
    div.innerHTML = '<div class="admin-loading">Hesaplanıyor...</div>';

    const [users, bank, txLog] = await Promise.all([
      _get('users'), _get('bank'), _get('txLog')
    ]);

    const u = users || {};
    const b = bank  || {};
    const now = Date.now();
    const day = 24 * 3600 * 1000;

    // Para dağılımı
    const moneyRanges = { '0-1K':0, '1K-10K':0, '10K-100K':0, '100K-1M':0, '1M+':0 };
    Object.values(u).forEach(usr => {
      const m = usr.money || 0;
      if (m < 1000) moneyRanges['0-1K']++;
      else if (m < 10000) moneyRanges['1K-10K']++;
      else if (m < 100000) moneyRanges['10K-100K']++;
      else if (m < 1000000) moneyRanges['100K-1M']++;
      else moneyRanges['1M+']++;
    });

    // TX analizi
    const txData = txLog || {};
    let todayIn = 0, todayOut = 0, weekIn = 0, weekOut = 0;
    Object.values(txData).forEach(userTx => {
      Object.values(userTx || {}).forEach(tx => {
        if (tx.ts > now - day) {
          if (tx.type === 'in') todayIn += tx.amount || 0;
          else todayOut += tx.amount || 0;
        }
        if (tx.ts > now - 7 * day) {
          if (tx.type === 'in') weekIn += tx.amount || 0;
          else weekOut += tx.amount || 0;
        }
      });
    });

    div.innerHTML = `
      <div class="admin-row-2">
        <div class="admin-card">
          <h3>💰 Para Dağılımı</h3>
          ${Object.entries(moneyRanges).map(([range, count]) => `
            <div class="admin-bar-row">
              <span class="bar-label">${range}</span>
              <div class="bar-track">
                <div class="bar-fill" style="width:${Object.values(u).length?Math.floor(count/Object.values(u).length*100):0}%"></div>
              </div>
              <span class="bar-val">${count} oyuncu</span>
            </div>`).join('')}
        </div>
        <div class="admin-card">
          <h3>📈 İşlem Analizi</h3>
          <table class="admin-mini-table">
            <tr><td>Bugün Toplam Gelir</td><td><b>${_fmt(todayIn)}</b></td></tr>
            <tr><td>Bugün Toplam Gider</td><td><b>${_fmt(todayOut)}</b></td></tr>
            <tr><td>Bugün Net</td><td><b style="color:${todayIn-todayOut>=0?'#16a34a':'#dc2626'}">${_fmt(todayIn-todayOut)}</b></td></tr>
            <tr><td>Haftalık Gelir</td><td><b>${_fmt(weekIn)}</b></td></tr>
            <tr><td>Haftalık Gider</td><td><b>${_fmt(weekOut)}</b></td></tr>
            <tr><td>Haftalık Net</td><td><b style="color:${weekIn-weekOut>=0?'#16a34a':'#dc2626'}">${_fmt(weekIn-weekOut)}</b></td></tr>
          </table>
        </div>
      </div>
      <div class="admin-card">
        <h3>🏦 Banka Analizi</h3>
        <div class="admin-row-2">
          ${(() => {
            let totalBal = 0, totalInv = 0, totalDebt = 0;
            Object.values(b).forEach(bk => { totalBal += bk.balance||0; totalInv += bk.investment||0; totalDebt += bk.loan||0; });
            return `
              <table class="admin-mini-table">
                <tr><td>Toplam Banka Bakiyesi</td><td><b>${_fmt(totalBal)}</b></td></tr>
                <tr><td>Toplam Yatırım</td><td><b>${_fmt(totalInv)}</b></td></tr>
                <tr><td>Toplam Borç</td><td><b style="color:#dc2626">${_fmt(totalDebt)}</b></td></tr>
                <tr><td>Net Banka Varlığı</td><td><b>${_fmt(totalBal + totalInv - totalDebt)}</b></td></tr>
              </table>`;
          })()}
        </div>
      </div>`;
  }

  async function loadPlayerAnalytics() {
    const div = document.getElementById('anaTabContent');
    if (!div) return;
    div.innerHTML = '<div class="admin-loading">Analiz yapılıyor...</div>';

    const users = await _get('users') || {};
    const now = Date.now();
    const day = 24 * 3600 * 1000;

    const uids = Object.keys(users);
    const totalUsers   = uids.length;
    const day1         = uids.filter(u => users[u].createdAt && (now - users[u].createdAt) < day).length;
    const day7         = uids.filter(u => users[u].lastLogin  && (now - users[u].lastLogin)  < 7*day).length;
    const day30        = uids.filter(u => users[u].lastLogin  && (now - users[u].lastLogin)  < 30*day).length;
    const day14inact   = uids.filter(u => !users[u].lastLogin || (now - users[u].lastLogin) > 14*day).length;
    const retention7   = totalUsers ? ((day7 / totalUsers) * 100).toFixed(1) : 0;
    const retention30  = totalUsers ? ((day30 / totalUsers) * 100).toFixed(1) : 0;

    // Seviye dağılımı
    const lvlGroups = { '1-10':0, '11-25':0, '26-50':0, '51-75':0, '76-100':0 };
    uids.forEach(u => {
      const lv = users[u].level || 1;
      if (lv <= 10)       lvlGroups['1-10']++;
      else if (lv <= 25)  lvlGroups['11-25']++;
      else if (lv <= 50)  lvlGroups['26-50']++;
      else if (lv <= 75)  lvlGroups['51-75']++;
      else                lvlGroups['76-100']++;
    });

    div.innerHTML = `
      <div class="admin-row-2">
        <div class="admin-card">
          <h3>📊 Oyuncu Tutundurma</h3>
          <table class="admin-mini-table">
            <tr><td>Bugün Yeni Kayıt</td><td><b>${day1}</b></td></tr>
            <tr><td>7 Günlük Aktif (DAU/WAU)</td><td><b>${day7}</b></td></tr>
            <tr><td>30 Günlük Aktif (MAU)</td><td><b>${day30}</b></td></tr>
            <tr><td>14+ Gün İnaktif</td><td><b style="color:#dc2626">${day14inact}</b></td></tr>
            <tr><td>7 Gün Tutundurma</td><td><b>${retention7}%</b></td></tr>
            <tr><td>30 Gün Tutundurma</td><td><b>${retention30}%</b></td></tr>
          </table>
        </div>
        <div class="admin-card">
          <h3>🏅 Seviye Dağılımı</h3>
          ${Object.entries(lvlGroups).map(([range, count]) => `
            <div class="admin-bar-row">
              <span class="bar-label">Lv ${range}</span>
              <div class="bar-track">
                <div class="bar-fill" style="width:${totalUsers?Math.floor(count/totalUsers*100):0}%;background:#3b82f6"></div>
              </div>
              <span class="bar-val">${count}</span>
            </div>`).join('')}
        </div>
      </div>`;
  }

  async function loadTechAnalytics() {
    const div = document.getElementById('anaTabContent');
    if (!div) return;
    const logs     = await _get('adminLogs') || {};
    const security = await _get('security/founderAttempts') || {};
    const allLogs  = Object.values(logs);
    const allSec   = Object.values(security);

    div.innerHTML = `
      <div class="admin-row-2">
        <div class="admin-card">
          <h3>🔧 Sistem Sağlığı</h3>
          <table class="admin-mini-table">
            <tr><td>Firebase</td><td><span class="badge-green">✅ Bağlı</span></td></tr>
            <tr><td>Toplam Admin İşlemi</td><td><b>${allLogs.length}</b></td></tr>
            <tr><td>Admin Giriş Denemesi</td><td><b>${allSec.length}</b></td></tr>
            <tr><td>Başarılı Admin Giriş</td><td><b>${allSec.filter(s=>s.success).length}</b></td></tr>
            <tr><td>Başarısız Admin Giriş</td><td><b style="color:#dc2626">${allSec.filter(s=>!s.success).length}</b></td></tr>
          </table>
        </div>
        <div class="admin-card">
          <h3>📋 Son Admin İşlemleri</h3>
          ${allLogs.sort((a,b)=>(b.ts||0)-(a.ts||0)).slice(0,10).map(l =>
            `<div class="admin-log-item"><span class="log-time">${new Date(l.ts||0).toLocaleTimeString('tr-TR')}</span> <span class="log-action">${l.action}</span></div>`
          ).join('')}
        </div>
      </div>`;
  }

  /* ══════════════════════════════════════════════════════════════════════════
     ANA PANEL UI — Sidebar + Router
     ══════════════════════════════════════════════════════════════════════════ */

  function openAdminPanel() {
    if (!window.GZ_FOUNDER_VERIFIED) { console.warn('[Admin] GZ_FOUNDER_VERIFIED yok'); return; }
    window._adminTarget = 'adminScreenBody';
    const gs = document.getElementById('gameScreen');
    const as = document.getElementById('adminScreen');
    if (gs) { gs.classList.remove('active'); gs.style.display='none'; }
    if (as) as.style.display = 'flex';
    renderDashboard();
    _checkKrediOnayBadge();
  }

  function closeAdminPanel() { /* Artık oyuna dön yok */ }

  async function _checkKrediOnayBadge() {
    try {
      const snap = await db().ref('krediBasvurular').orderByChild('durum').equalTo('beklemede').once('value');
      const n = snap.numChildren();
      const el = document.getElementById('krediOnayBadge');
      if (el) { el.textContent=n; el.hidden=n===0; }
    } catch(e) {}
  }

  async function _checkKimlikBadge() {
    try {
      const snap = await db().ref('approvals/idCard').once('value');
      const all = snap.val() || {};
      const n = Object.values(all).filter(a => a.status === 'pending').length;
      const el = document.getElementById('kimlikOnayBadge');
      if (el) { el.textContent = n; el.hidden = n === 0; }
    } catch(e) {}
  }

  /* ══════════════════════════════════════════════════════════════════════════
     KİMLİK KARTI BAŞVURULARI PANELİ
     ══════════════════════════════════════════════════════════════════════════ */
  async function openKimlikOnayPanel() {
    _adminBody('<div style="padding:24px;color:#94a3b8;font-size:13px">🪪 Kimlik başvuruları yükleniyor...</div>');

    const snap = await db().ref('approvals/idCard').once('value');
    const all  = snap.val() || {};
    const list = Object.entries(all).sort((a,b) => (b[1].ts||0) - (a[1].ts||0));

    const bekleyenler = list.filter(([,v]) => v.status === 'pending');
    const gerceklesens = list.filter(([,v]) => v.status !== 'pending');

    function _kart(id, d) {
      const ts = new Date(d.ts||0).toLocaleString('tr-TR');
      const renk = d.status==='approved' ? '#22c55e' : d.status==='rejected' ? '#ef4444' : '#f59e0b';
      const durumEmoji = d.status==='approved' ? '✅' : d.status==='rejected' ? '❌' : '⏳';
      const durumAd = d.status==='approved' ? 'Onaylandı' : d.status==='rejected' ? 'Reddedildi' : 'Bekliyor';
      return `
        <div style="background:#0d1a2e;border:1px solid ${renk}44;border-radius:10px;padding:14px;margin-bottom:10px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <span style="font-size:12px;font-weight:700;color:${renk}">${durumEmoji} ${durumAd}</span>
            <span style="font-size:10px;color:#334155">#${id.slice(-10)}</span>
          </div>
          <div style="font-size:14px;font-weight:700;color:#e2e8f0;margin-bottom:4px">👤 ${d.username || 'Anonim'}</div>
          <div style="font-size:11px;color:#475569;margin-bottom:8px">
            💰 Ücret: ${_fmt(d.fee || 10000)} &nbsp;|&nbsp; 🕐 ${ts}
            ${d.approvedBy ? ` &nbsp;|&nbsp; Onaylayan: ${d.approvedBy}` : ''}
            ${d.rejectedBy ? ` &nbsp;|&nbsp; Reddeden: ${d.rejectedBy}` : ''}
          </div>
          ${d.status === 'pending' ? `
            <div style="display:flex;gap:8px">
              <button onclick="(async()=>{
                await window.GZX_adminOnayKimlik?.('${id}','approve');
                window.AP.navTo(null,'kimlikOnay');
              })()" style="flex:1;background:#064e3b;color:#4ade80;border:none;border-radius:7px;padding:8px;font-size:12px;font-weight:700;cursor:pointer">
                ✅ ONAYLA
              </button>
              <button onclick="(async()=>{
                if(!confirm('Bu başvuruyu reddet ve ücreti iade et?')) return;
                await window.GZX_adminOnayKimlik?.('${id}','reject');
                window.AP.navTo(null,'kimlikOnay');
              })()" style="flex:1;background:#7f1d1d;color:#fca5a5;border:none;border-radius:7px;padding:8px;font-size:12px;font-weight:700;cursor:pointer">
                ❌ REDDET (İade Et)
              </button>
            </div>` : ''}
        </div>`;
    }

    _adminBody(_apSection('🪪 Kimlik Kartı Başvuruları', `
      <div style="display:flex;gap:10px;margin-bottom:20px;flex-wrap:wrap">
        <div style="background:#0d1a2e;border:1px solid #1a2f4a;border-radius:10px;padding:14px 20px;text-align:center;min-width:120px">
          <div style="font-size:28px;font-weight:900;color:#f59e0b">${bekleyenler.length}</div>
          <div style="font-size:11px;color:#475569;margin-top:2px">Bekleyen</div>
        </div>
        <div style="background:#0d1a2e;border:1px solid #1a2f4a;border-radius:10px;padding:14px 20px;text-align:center;min-width:120px">
          <div style="font-size:28px;font-weight:900;color:#22c55e">${gerceklesens.filter(([,v])=>v.status==='approved').length}</div>
          <div style="font-size:11px;color:#475569;margin-top:2px">Onaylanan</div>
        </div>
        <div style="background:#0d1a2e;border:1px solid #1a2f4a;border-radius:10px;padding:14px 20px;text-align:center;min-width:120px">
          <div style="font-size:28px;font-weight:900;color:#ef4444">${gerceklesens.filter(([,v])=>v.status==='rejected').length}</div>
          <div style="font-size:11px;color:#475569;margin-top:2px">Reddedilen</div>
        </div>
        <button onclick="window.AP.navTo(null,'kimlikOnay')"
          style="margin-left:auto;background:#1e3a5f;color:#60a5fa;border:none;border-radius:8px;padding:10px 18px;font-size:12px;font-weight:700;cursor:pointer;align-self:center">
          🔄 Yenile
        </button>
      </div>

      ${bekleyenler.length > 0 ? `
        <div style="font-size:11px;font-weight:800;letter-spacing:2px;color:#f59e0b;margin-bottom:10px">⏳ BEKLEYENLEr (${bekleyenler.length})</div>
        ${bekleyenler.map(([id,d]) => _kart(id, d)).join('')}
      ` : '<div style="background:#0d1a2e;border:1px solid #1a2f4a;border-radius:10px;padding:20px;text-align:center;color:#22c55e;font-weight:700;margin-bottom:20px">✅ Bekleyen başvuru yok!</div>'}

      ${gerceklesens.length > 0 ? `
        <div style="font-size:11px;font-weight:800;letter-spacing:2px;color:#475569;margin:20px 0 10px">📋 GEÇMİŞ (${gerceklesens.length})</div>
        ${gerceklesens.slice(0,20).map(([id,d]) => _kart(id, d)).join('')}
      ` : ''}
    `));

    _checkKimlikBadge();
  }

  /* ══════════════════════════════════════════════════════════════════════════
     BORÇ & MAHKEME DAVA PANELİ
     ══════════════════════════════════════════════════════════════════════════ */
  async function openBorcDavalarPanel() {
    _adminBody('<div style="padding:24px;color:#94a3b8;font-size:13px">⚖️ Davalar yükleniyor...</div>');

    const [davalarSnap, borclarSnap] = await Promise.all([
      db().ref('mahkeme/davalar').once('value'),
      db().ref('peerLoans').once('value'),
    ]);

    const davalar = davalarSnap.val() || {};
    const borclar = borclarSnap.val() || {};

    const davaList = Object.entries(davalar)
      .filter(([,d]) => d.tip === 'borc_davasi')
      .sort((a,b) => (b[1].ts||0) - (a[1].ts||0));

    const aktifBorclar = Object.entries(borclar)
      .filter(([,b]) => b.status === 'aktif')
      .sort((a,b) => (b[1].ts||0) - (a[1].ts||0));

    function _davaKart(id, d) {
      const renk = d.status === 'kararveriildi' ? '#22c55e' : d.status === 'reddedildi' ? '#ef4444' : '#f59e0b';
      return `
        <div style="background:#0d1a2e;border:1px solid ${renk}44;border-radius:10px;padding:14px;margin-bottom:10px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
            <span style="font-size:12px;font-weight:700;color:${renk}">⚖️ Dava #${id.slice(-8)}</span>
            <span style="font-size:10px;color:#475569">${new Date(d.ts||0).toLocaleDateString('tr-TR')}</span>
          </div>
          <div style="font-size:12px;color:#e2e8f0;margin-bottom:4px">
            👤 Davacı: <b>${d.davacıAd}</b> (TC: ${d.davacıTC || 'N/A'})<br>
            👤 Davalı: <b>${d.davalıAd}</b> (TC: ${d.davalıTC || 'N/A'})
          </div>
          <div style="font-size:12px;color:#60a5fa;font-weight:700;margin-bottom:4px">
            💰 Talep: ${_fmt(d.talepMiktar)}
          </div>
          <div style="font-size:11px;color:#475569;margin-bottom:8px">
            📋 ${d.aciklama}<br>
            🔑 Delil: ${d.delil}
          </div>
          ${d.status === 'inceleniyor' ? `
            <div style="display:flex;gap:6px;flex-wrap:wrap">
              <button onclick="(async()=>{
                if(!confirm('Davacı lehine karar: davalıdan ₺${d.talepMiktar} kesilsin mi?')) return;
                await firebase.database().ref('mahkeme/davalar/${id}').update({status:'kararveriildi',karar:'davaci_lehine',kararTs:Date.now(),hakim:window.GZ?.data?.username||'Admin'});
                await window.addCash?.('${d.davacıUid}',${d.talepMiktar},'Mahkeme kararı tahsilat');
                await window.spendCash?.('${d.davalıUid}',${d.talepMiktar},'Mahkeme kararı borç');
                await window.GZX_notify?.('${d.davacıUid}','⚖️ Mahkeme kazandınız! ₺${(d.talepMiktar||0).toLocaleString('tr-TR')} hesabınıza aktarıldı.','success');
                await window.GZX_notify?.('${d.davalıUid}','⚖️ Mahkeme kaybettiniz. ₺${(d.talepMiktar||0).toLocaleString('tr-TR')} hesabınızdan kesildi.','error');
                window.AP.navTo(null,'borcDavalar');
              })()" style="background:#064e3b;color:#4ade80;border:none;border-radius:7px;padding:6px 12px;font-size:11px;font-weight:700;cursor:pointer">
                ✅ Davacı Lehine Karar
              </button>
              <button onclick="(async()=>{
                if(!confirm('Davayı reddet (davalı lehine)?')) return;
                await firebase.database().ref('mahkeme/davalar/${id}').update({status:'reddedildi',karar:'davali_lehine',kararTs:Date.now(),hakim:window.GZ?.data?.username||'Admin'});
                await window.GZX_notify?.('${d.davacıUid}','⚖️ Davanız reddedildi.','warn');
                await window.GZX_notify?.('${d.davalıUid}','⚖️ Dava lehinize sonuçlandı.','success');
                window.AP.navTo(null,'borcDavalar');
              })()" style="background:#7f1d1d;color:#fca5a5;border:none;border-radius:7px;padding:6px 12px;font-size:11px;font-weight:700;cursor:pointer">
                ❌ Davayı Reddet
              </button>
              <button onclick="(async()=>{
                const uzlasma=parseInt(prompt('Uzlaşma miktarı (₺)?')||0);
                if(!uzlasma) return;
                await firebase.database().ref('mahkeme/davalar/${id}').update({status:'uzlasma',karar:'uzlasma',uzlasmaMiktar:uzlasma,kararTs:Date.now(),hakim:window.GZ?.data?.username||'Admin'});
                await window.addCash?.('${d.davacıUid}',uzlasma,'Uzlaşma ödemesi');
                await window.spendCash?.('${d.davalıUid}',uzlasma,'Uzlaşma ödemesi');
                window.AP.navTo(null,'borcDavalar');
              })()" style="background:#1e3a5f;color:#60a5fa;border:none;border-radius:7px;padding:6px 12px;font-size:11px;font-weight:700;cursor:pointer">
                🤝 Uzlaşma
              </button>
            </div>` : `<span style="font-size:11px;color:${renk}">Karar: ${d.karar} ${d.hakim ? '| Hakim: '+d.hakim : ''}</span>`}
        </div>`;
    }

    _adminBody(_apSection('⚖️ Borç Davaları & Mahkeme', `
      <div style="display:flex;gap:10px;margin-bottom:20px;flex-wrap:wrap">
        <div style="background:#0d1a2e;border:1px solid #1a2f4a;border-radius:10px;padding:14px 20px;text-align:center">
          <div style="font-size:28px;font-weight:900;color:#f59e0b">${davaList.filter(([,d])=>d.status==='inceleniyor').length}</div>
          <div style="font-size:11px;color:#475569">Bekleyen Dava</div>
        </div>
        <div style="background:#0d1a2e;border:1px solid #1a2f4a;border-radius:10px;padding:14px 20px;text-align:center">
          <div style="font-size:28px;font-weight:900;color:#3b82f6">${aktifBorclar.length}</div>
          <div style="font-size:11px;color:#475569">Aktif Borç</div>
        </div>
        <div style="background:#0d1a2e;border:1px solid #1a2f4a;border-radius:10px;padding:14px 20px;text-align:center">
          <div style="font-size:28px;font-weight:900;color:#ef4444">${aktifBorclar.filter(([,b])=>Date.now()>b.vadeTarihi).length}</div>
          <div style="font-size:11px;color:#475569">Vadesi Geçmiş</div>
        </div>
      </div>

      <div style="font-size:11px;font-weight:800;letter-spacing:2px;color:#f59e0b;margin-bottom:10px">⚖️ MAHKEME DOVALARI</div>
      ${davaList.length ? davaList.map(([id,d])=>_davaKart(id,d)).join('') : '<div style="color:#334155;font-size:12px;padding:14px;text-align:center">Henüz dava yok</div>'}

      <div style="font-size:11px;font-weight:800;letter-spacing:2px;color:#475569;margin:20px 0 10px">💰 TÜM AKTİF BORÇLAR</div>
      ${aktifBorclar.slice(0,30).map(([id,b]) => `
        <div style="background:#0d1a2e;border:1px solid ${Date.now()>b.vadeTarihi?'#ef444455':'#1a2f4a'};border-radius:8px;padding:12px;margin-bottom:8px;font-size:12px">
          <div style="display:flex;justify-content:space-between;margin-bottom:4px">
            <span style="color:#e2e8f0;font-weight:700">${b.borcluAd} → ${b.alacakliAd}</span>
            <span style="color:${Date.now()>b.vadeTarihi?'#ef4444':'#22c55e'};font-weight:700">${Date.now()>b.vadeTarihi?'🔴 GECİKMİŞ':'✅ Aktif'}</span>
          </div>
          <div style="color:#60a5fa">₺${(b.miktar-(b.odenemisMiktar||0)).toLocaleString('tr-TR')} kalan / ₺${b.miktar?.toLocaleString('tr-TR')} toplam</div>
          <div style="color:#475569;font-size:11px">Vade: ${new Date(b.vadeTarihi).toLocaleDateString('tr-TR')} | ${b.aciklama||''}</div>
        </div>`).join('') || '<div style="color:#334155;font-size:12px;padding:14px;text-align:center">Aktif borç yok</div>'}
    `));
  }

  function openTxLog() {
    _adminBody(_apSection('🔍 Şüpheli Hareketler', '<div style="color:#475569;padding:20px;text-align:center">Bu bölüm yakında aktif olacak</div>'));
  }
  function openEventsManager() {
    _adminBody(_apSection('⚡ Etkinlik Yönetimi', '<div style="color:#475569;padding:20px;text-align:center">Bu bölüm yakında aktif olacak</div>'));
  }


    document.querySelectorAll('.admin-nav-btn,.asnb').forEach(b=>b.classList.remove('active'));
    if (el) el.classList.add('active');
    const routes = {
      dashboard:  renderDashboard,
      users:      openAllUsersModal,
      economy:    openGlobalEconModal,
      krediOnay:  openKrediOnayPanel,
      kimlikOnay: openKimlikOnayPanel,
      borcDavalar:openBorcDavalarPanel,
      vergi:      openVergiPanel,
      merkez:     openMerkezBankasiPanel,
      borsa:      openBorsaPanel,
      kripto:     openKriptoPanel,
      games:      openGameManagement,
      news:       openNewsManager,
      chat:       openChatManager,
      security:   openSecurityLogs,
      system:     openSystemSettings,
      analytics:  openAnalytics,
      txlog:      openTxLog,
      events:     openEventsManager,
    };
    const fn = routes[section];
    if (typeof fn==='function') fn.call(window.AP);
    else _adminBody('<div style="padding:40px;text-align:center;color:#64748b">Bu bölüm henüz geliştiriliyor...</div>');
    _checkKrediOnayBadge();
    _checkKimlikBadge();
  }

  /* Topbar Butonu */
  function activateFounderBtn() {
    const btn = document.getElementById('founderTriggerBtn');
    if (!btn) return;
    btn.classList.add('active');
    btn.title = '👑 Yetkili Paneli';
    btn.onclick = null;
    btn.style.display = '';
    btn.addEventListener('click', ()=>{
      if (window.GZ_FOUNDER_VERIFIED) openAdminPanel();
      else if (typeof window.openPasswordModal==='function') window.openPasswordModal();
    });
  }

  /* Admin giriş bildirimi */
  // Kısa yardımcı
  function _adminBody(html) {
    const el = document.getElementById(window._adminTarget||'adminPanelBody');
    if (el) el.innerHTML = html;
  }
  function _apSection(title, content) {
    return '<div style="padding:24px;max-width:1200px">' +
      '<h2 style="color:#e2e8f0;margin:0 0 20px;font-size:20px;font-weight:800;padding-bottom:12px;border-bottom:1px solid #1a2f4a">' + title + '</h2>' +
      content + '</div>';
  }
  function _statCard(label, value, color, sub) {
    return '<div style="background:#0d1a2e;border:1px solid #1a2f4a;border-radius:12px;padding:16px;text-align:center">' +
      '<div style="color:#475569;font-size:10px;font-weight:700;letter-spacing:1px;margin-bottom:4px">' + label + '</div>' +
      '<div style="font-size:24px;font-weight:900;color:' + (color||'#e2e8f0') + '">' + value + '</div>' +
      (sub ? '<div style="color:#334155;font-size:10px;margin-top:2px">' + sub + '</div>' : '') +
    '</div>';
  }

  /* ─── Kredi Onay Paneli ─── */
  async function openKrediOnayPanel() {
    _adminBody(_apSection('💳 Kredi Başvuruları', '<div id="kOnayContent"><div class="admin-loading">Yükleniyor...</div></div>'));
    const snap = await db().ref('krediBasvurular').once('value');
    const all = Object.values(snap.val()||{});
    const pend = all.filter(b=>b&&b.durum==='beklemede').sort((a,b)=>(b.ts||0)-(a.ts||0));
    const appr = all.filter(b=>b&&b.durum==='onaylandi').sort((a,b)=>(b.onayTs||0)-(a.onayTs||0)).slice(0,15);
    const rej  = all.filter(b=>b&&b.durum==='reddedildi').sort((a,b)=>(b.redTs||0)-(a.redTs||0)).slice(0,10);
    const el = document.getElementById('kOnayContent');
    if (!el) return;

    // İstatistikler
    let h = '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px">' +
      _statCard('BEKLEYEN',''+pend.length,'#f59e0b') +
      _statCard('ONAYLANAN',''+appr.length,'#22c55e') +
      _statCard('REDDEDİLEN',''+rej.length,'#ef4444') +
    '</div>';

    h += '<button class="admin-btn-sm" onclick="window.AP.openKrediOnayPanel()" style="margin-bottom:12px">🔄 Yenile</button>';

    if (!pend.length) {
      h += '<div style="background:#0d1a2e;border-radius:12px;padding:40px;text-align:center;color:#475569;margin-bottom:16px">✅ Bekleyen başvuru yok</div>';
    } else {
      h += '<div style="color:#f59e0b;font-weight:700;margin-bottom:10px;font-size:14px">⏳ Bekleyen Başvurular ('+pend.length+')</div>';
      h += pend.map(b=>{
        const nr=b.krediNotu||0;
        const nc=nr>=70?'#22c55e':nr>=50?'#f59e0b':'#ef4444';
        return '<div style="background:#0d1a2e;border:1px solid #f59e0b33;border-radius:12px;padding:16px;margin-bottom:10px">' +
          '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">' +
            '<div><div style="font-weight:700;color:#e2e8f0;font-size:16px">' + (b.username||b.uid) + '</div>' +
            '<div style="color:#475569;font-size:12px;margin-top:2px">' + (b.bankaAdi||b.bankaId) + ' • Faiz: %' + ((b.faizOrani||0)*100).toFixed(1) + '</div>' +
            (b.aciklama?'<div style="color:#94a3b8;font-size:12px;font-style:italic;margin-top:3px">"'+b.aciklama+'"</div>':'') + '</div>' +
            '<div style="text-align:right"><div style="font-size:26px;font-weight:900;color:#22c55e">₺' + (b.miktar||0).toLocaleString('tr-TR') + '</div>' +
            '<div style="color:#475569;font-size:10px">' + (b.ts?new Date(b.ts).toLocaleString('tr-TR'):'-') + '</div></div>' +
          '</div>' +
          '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px">' +
            '<div style="background:#060c18;border-radius:8px;padding:8px;text-align:center"><div style="color:#475569;font-size:9px">NOTER</div><div style="color:'+nc+';font-weight:700">'+(b.krediNotu||'?')+'/100</div></div>' +
            '<div style="background:#060c18;border-radius:8px;padding:8px;text-align:center"><div style="color:#475569;font-size:9px">MEVCUT BORÇ</div><div style="color:#ef4444;font-weight:700">₺'+(b.mevcutBorc||0).toLocaleString()+'</div></div>' +
            '<div style="background:#060c18;border-radius:8px;padding:8px;text-align:center"><div style="color:#475569;font-size:9px">HAFTALIk FAİZ</div><div style="color:#f59e0b;font-weight:700">₺'+((b.miktar||0)*((b.faizOrani||0)/52)).toFixed(2)+'</div></div>' +
            '<div style="background:#060c18;border-radius:8px;padding:8px;text-align:center"><div style="color:#475569;font-size:9px">UID</div><div style="color:#334155;font-size:9px;word-break:break-all">'+b.uid.slice(0,8)+'...</div></div>' +
          '</div>' +
          '<div style="display:flex;gap:8px">' +
            '<button class="admin-btn green" style="flex:1;padding:12px;font-size:14px" data-uid="'+b.uid+'" data-bid="'+b.bankaId+'" data-mik="'+(b.miktar||0)+'" onclick="window._aKOnay(this)">✅ ONAYLA</button>' +
            '<button class="admin-btn red"   style="flex:1;padding:12px;font-size:14px" data-uid="'+b.uid+'" data-bid="'+b.bankaId+'" onclick="window._aKReddet(this)">❌ REDDET</button>' +
            '<button class="admin-btn teal"  style="padding:12px 16px" onclick="window.AP.openUserDetail && window.AP.openUserDetail(\''+b.uid+'\')">👤</button>' +
          '</div></div>';
      }).join('');
    }

    // Onay geçmişi tablosu
    if (appr.length) {
      h += '<h3 style="color:#22c55e;font-size:14px;font-weight:700;margin:20px 0 10px">✅ Son Onaylananlar</h3>';
      h += '<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Kullanıcı</th><th>Banka</th><th>Tutar</th><th>Faiz/Hafta</th><th>Tarih</th></tr></thead><tbody>' +
        appr.map(b=>'<tr><td><b>'+(b.username||b.uid)+'</b></td><td>'+(b.bankaAdi||b.bankaId)+'</td><td style="color:#22c55e">+₺'+(b.miktar||0).toLocaleString()+'</td><td style="color:#f59e0b">₺'+((b.miktar||0)*((b.faizOrani||0)/52)).toFixed(2)+'</td><td style="color:#475569">'+(b.onayTs?new Date(b.onayTs).toLocaleDateString('tr-TR'):'-')+'</td></tr>').join('') +
        '</tbody></table></div>';
    }
    if (rej.length) {
      h += '<h3 style="color:#ef4444;font-size:14px;font-weight:700;margin:20px 0 10px">❌ Son Reddedilenler</h3>';
      h += '<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Kullanıcı</th><th>Banka</th><th>Tutar</th><th>Sebep</th><th>Tarih</th></tr></thead><tbody>' +
        rej.map(b=>'<tr><td>'+(b.username||b.uid)+'</td><td>'+(b.bankaAdi||b.bankaId)+'</td><td style="color:#ef4444">₺'+(b.miktar||0).toLocaleString()+'</td><td style="color:#475569;font-size:11px">'+(b.redSebebi||'-')+'</td><td style="color:#475569">'+(b.redTs?new Date(b.redTs).toLocaleDateString('tr-TR'):'-')+'</td></tr>').join('') +
        '</tbody></table></div>';
    }
    el.innerHTML = h;
  }

  window._aKOnay = async function(btn) {
    const uid=btn.getAttribute('data-uid');
    const bid=btn.getAttribute('data-bid');
    const mik=parseInt(btn.getAttribute('data-mik'))||0;
    if (!confirm('₺'+mik.toLocaleString('tr-TR')+' kredi onaylanacak. Emin misin?')) return;
    if (typeof window.krediOnayla==='function') {
      await window.krediOnayla(uid,bid,mik,'Yönetici onayladı');
    } else {
      await db().ref('bank/'+uid+'/loan').transaction(c=>(c||0)+mik);
      await db().ref('users/'+uid+'/money').transaction(c=>(c||0)+mik);
      await db().ref('krediBasvurular/'+uid+'_'+bid).update({durum:'onaylandi',onaylayanNot:'Yönetici',onayTs:firebase.database.ServerValue.TIMESTAMP});
    }
    _toast('✅ ₺'+mik.toLocaleString()+' onaylandı → '+uid);
    window.AP.openKrediOnayPanel();
    _checkKrediOnayBadge();
  };
  window._aKReddet = async function(btn) {
    const uid=btn.getAttribute('data-uid');
    const bid=btn.getAttribute('data-bid');
    const sebep=prompt('Red sebebi:')||'Yönetici reddetti';
    if (typeof window.krediReddet==='function') {
      await window.krediReddet(uid,bid,sebep);
    } else {
      await db().ref('krediBasvurular/'+uid+'_'+bid).update({durum:'reddedildi',redSebebi:sebep,redTs:firebase.database.ServerValue.TIMESTAMP});
    }
    _toast('Başvuru reddedildi');
    window.AP.openKrediOnayPanel();
    _checkKrediOnayBadge();
  };

  /* ─── Vergi & Faiz Paneli ─── */
  async function openVergiPanel() {
    _adminBody(_apSection('🏛️ Vergi &amp; Faiz Sistemi', '<div id="vergiContent"><div class="admin-loading">Yükleniyor...</div></div>'));
    const mb = (await _get('system/merkezBankasi'))||{};
    const logSnap = await db().ref('system/merkezBankasi/vergiLog').orderByKey().limitToLast(25).once('value');
    const loglar = Object.values(logSnap.val()||{}).reverse();
    const totalV = mb.totalVergi||0;
    const totalF = mb.totalFaiz||0;

    const el = document.getElementById('vergiContent');
    if (!el) return;

    // Banka faiz oranlarını DB'den çek (admin tarafından değiştirilebilir)
    const dbFaizler = (await _get('system/bankFaizler'))||{};
    const BANKALAR_DEFAULT = [
      {id:'ziraat',name:'Ziraat Bankası',faiz:.025},{id:'vakif',name:'VakıfBank',faiz:.028},
      {id:'halk',name:'Halkbank',faiz:.030},{id:'is',name:'İş Bankası',faiz:.032},
      {id:'garanti',name:'Garanti BBVA',faiz:.035},{id:'akbank',name:'Akbank',faiz:.033},
      {id:'ykb',name:'Yapı Kredi',faiz:.038},{id:'qnb',name:'QNB Finansbank',faiz:.036},
      {id:'deniz',name:'Denizbank',faiz:.034},{id:'teb',name:'TEB',faiz:.031},
    ];

    let h = '<div style="display:grid;grid-template-columns:repeat(2,1fr) repeat(2,1fr);gap:12px;margin-bottom:24px">' +
      _statCard('TOPLAM VERGİ','₺'+(totalV/1000).toFixed(1)+'B','#f59e0b') +
      _statCard('TOPLAM FAİZ','₺'+(totalF/1000).toFixed(1)+'B','#22c55e') +
      _statCard('TOPLAM GELİR','₺'+((totalV+totalF)/1000).toFixed(1)+'B','#3b82f6') +
      _statCard('KAYIT SAYISI',''+loglar.length,'#a855f7') +
    '</div>';

    // Vergi oranları düzenleme
    h += '<div style="background:#0d1a2e;border:1px solid #1a2f4a;border-radius:12px;padding:16px;margin-bottom:16px">' +
      '<h3 style="color:#f59e0b;margin:0 0 14px;font-size:15px">📋 Haftalık Vergi Tarifeleri</h3>' +
      '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px">' +
      [
        {key:'shopTax',label:'🏪 Dükkan',def:500},
        {key:'gardenTax',label:'🌱 Bahçe',def:300},
        {key:'farmTax',label:'🐄 Çiftlik',def:300},
        {key:'factoryTax',label:'🏭 Fabrika',def:800},
        {key:'mineTax',label:'⛏️ Maden',def:600},
      ].map(t=>'<div style="display:flex;align-items:center;justify-content:space-between;background:#060c18;border-radius:8px;padding:8px 10px">' +
        '<span style="color:#94a3b8;font-size:12px">'+t.label+'</span>' +
        '<div style="display:flex;align-items:center;gap:6px">' +
          '<input type="number" id="vt_'+t.key+'" value="'+(mb['rates_'+t.key]||t.def)+'" min="0" style="width:70px;padding:4px 6px;border-radius:6px;border:1px solid #1a2f4a;background:#0d1a2e;color:#e2e8f0;font-size:12px;text-align:right">' +
          '<span style="color:#475569;font-size:11px">₺</span>' +
        '</div></div>'
      ).join('') +
      '</div>' +
      '<div style="display:flex;align-items:center;gap:8px;margin-top:10px">' +
        '<span style="color:#94a3b8;font-size:12px;flex:1">💰 Gelir Vergisi Oranı (%)</span>' +
        '<input type="number" id="vt_gelirOran" value="'+(mb.gelirOrani||8)+'" min="0" max="50" step="0.5" style="width:60px;padding:4px 6px;border-radius:6px;border:1px solid #1a2f4a;background:#0d1a2e;color:#e2e8f0;font-size:12px;text-align:right">' +
        '<span style="color:#475569;font-size:11px">%</span>' +
      '</div>' +
      '<button class="admin-btn yellow" style="width:100%;margin-top:12px" onclick="window._saveVergiRates()">💾 Tarifeleri Kaydet</button>' +
    '</div>';

    // Banka faiz oranları
    h += '<div style="background:#0d1a2e;border:1px solid #1a2f4a;border-radius:12px;padding:16px;margin-bottom:16px">' +
      '<h3 style="color:#22c55e;margin:0 0 14px;font-size:15px">💳 Banka Faiz Oranları (Yıllık %)</h3>' +
      '<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Banka</th><th>Mevcut Faiz</th><th>Haftalık (1000₺)</th><th>Yeni Oran %</th></tr></thead><tbody>' +
      BANKALAR_DEFAULT.map(b=>{
        const curFaiz = dbFaizler[b.id] || b.faiz;
        return '<tr>' +
          '<td><b>'+b.name+'</b></td>' +
          '<td style="color:#22c55e">%'+(curFaiz*100).toFixed(2)+'</td>' +
          '<td style="color:#f59e0b">₺'+(1000*curFaiz/52).toFixed(3)+'</td>' +
          '<td><input type="number" id="bf_'+b.id+'" value="'+(curFaiz*100).toFixed(2)+'" min="0" max="100" step="0.1" style="width:70px;padding:4px 6px;border-radius:6px;border:1px solid #1a2f4a;background:#060c18;color:#e2e8f0;font-size:12px;text-align:right"></td>' +
        '</tr>';
      }).join('') +
      '</tbody></table></div>' +
      '<button class="admin-btn green" style="width:100%;margin-top:12px" onclick="window._saveBankFaizler()">💾 Faiz Oranlarını Kaydet</button>' +
    '</div>';

    // Son vergi kayıtları
    h += '<div style="background:#0d1a2e;border:1px solid #1a2f4a;border-radius:12px;padding:16px">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">' +
        '<h3 style="color:#e2e8f0;margin:0;font-size:15px">📋 Son Vergi Kayıtları</h3>' +
        '<button class="admin-btn-sm" onclick="window.AP.openVergiPanel()">🔄</button>' +
      '</div>';
    if (!loglar.length) {
      h += '<div style="text-align:center;color:#475569;padding:20px">Henüz kayıt yok</div>';
    } else {
      h += '<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Kullanıcı</th><th>Vergi</th><th>Faiz</th><th>Detay</th><th>Tarih</th></tr></thead><tbody>' +
        loglar.map(l=>'<tr>' +
          '<td><b>'+(l.username||l.uid||'-')+'</b></td>' +
          '<td style="color:#f59e0b">₺'+(l.vergi||0).toLocaleString()+'</td>' +
          '<td style="color:#22c55e">₺'+(l.faiz||0).toLocaleString()+'</td>' +
          '<td style="font-size:10px;color:#475569">'+(l.detay?Object.entries(l.detay).filter(([,v])=>v>0).map(([k,v])=>k+':'+v).join(', '):'-')+'</td>' +
          '<td style="color:#475569">'+(l.ts?new Date(l.ts).toLocaleDateString('tr-TR'):'-')+'</td>' +
        '</tr>').join('') +
        '</tbody></table></div>';
    }
    h += '</div>';
    el.innerHTML = h;
  }

  window._saveVergiRates = async function() {
    const upd = {};
    ['shopTax','gardenTax','farmTax','factoryTax','mineTax'].forEach(k=>{
      const v=parseInt(document.getElementById('vt_'+k)?.value)||0;
      upd['system/merkezBankasi/rates_'+k]=v;
    });
    const gelir=parseFloat(document.getElementById('vt_gelirOran')?.value)||8;
    upd['system/merkezBankasi/gelirOrani']=gelir;
    await db().ref().update(upd);
    _toast('💾 Vergi tarifeleri kaydedildi');
    await _adminLog('save_vergi_rates',upd);
  };
  window._saveBankFaizler = async function() {
    const upd={};
    ['ziraat','vakif','halk','is','garanti','akbank','ykb','qnb','deniz','teb'].forEach(id=>{
      const v=parseFloat(document.getElementById('bf_'+id)?.value)||0;
      upd['system/bankFaizler/'+id]=v/100;
    });
    await db().ref().update(upd);
    // window.BANKALAR_MAP'i güncelle
    if (window.BANKALAR_MAP) {
      Object.entries(upd).forEach(([path,v])=>{
        const id=path.split('/').pop();
        if(window.BANKALAR_MAP[id]) window.BANKALAR_MAP[id].faiz=v;
      });
    }
    _toast('💾 Faiz oranları kaydedildi');
    await _adminLog('save_faiz_rates',upd);
  };

  /* ─── Merkez Bankası Paneli ─── */
  async function openMerkezBankasiPanel() {
    _adminBody(_apSection('🏦 Karakaş Merkez Bankası', '<div id="mbContent"><div class="admin-loading">Yükleniyor...</div></div>'));
    const authUid = await _get('system/authorityUid');
    const authMoney = authUid?(await _get('users/'+authUid+'/money'))||0:0;
    const mb=(await _get('system/merkezBankasi'))||{};
    const logSnap=await db().ref('system/merkezBankasi/vergiLog').orderByKey().limitToLast(30).once('value');
    const loglar=Object.values(logSnap.val()||{}).reverse();
    const allUsers=(await _get('users'))||{};
    // Borçlu kullanıcılar
    const borrowers=[];
    for(const [uid,u] of Object.entries(allUsers)){
      const bank=(await _get('bank/'+uid))||{};
      if((bank.loan||0)>0) borrowers.push({uid,username:u.username||uid,loan:bank.loan||0,krediNotu:u.krediNotu||100});
    }
    borrowers.sort((a,b)=>b.loan-a.loan);

    const el=document.getElementById('mbContent');
    if(!el) return;

    let h='<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:20px">' +
      '<div style="background:linear-gradient(135deg,#0d1a2e,#0d2240);border:1px solid #1e3a5f;border-radius:14px;padding:20px">' +
        '<div style="color:#94a3b8;font-size:10px;letter-spacing:1.5px;margin-bottom:4px">HAZİNE BAKİYESİ</div>' +
        '<div style="color:#22c55e;font-weight:900;font-size:32px">₺'+authMoney.toLocaleString('tr-TR',{minimumFractionDigits:2})+'</div>' +
        '<div style="color:#334155;font-size:11px;margin-top:4px">Yetkili Hesabı</div>' +
      '</div>' +
      '<div style="background:linear-gradient(135deg,#0d1a2e,#1a0d2e);border:1px solid #2d1a5f;border-radius:14px;padding:20px">' +
        '<div style="color:#94a3b8;font-size:10px;letter-spacing:1.5px;margin-bottom:4px">TOPLAM GELİR</div>' +
        '<div style="color:#a855f7;font-weight:900;font-size:32px">₺'+((mb.totalVergi||0)+(mb.totalFaiz||0)).toLocaleString('tr-TR',{minimumFractionDigits:2})+'</div>' +
        '<div style="color:#334155;font-size:11px;margin-top:4px">Vergi + Faiz Toplamı</div>' +
      '</div>' +
    '</div>';

    h+='<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:20px">' +
      _statCard('TOPLAM VERGİ','₺'+(mb.totalVergi||0).toLocaleString(),'#f59e0b') +
      _statCard('TOPLAM FAİZ','₺'+(mb.totalFaiz||0).toLocaleString(),'#22c55e') +
      _statCard('TOPLAM BORÇ','₺'+borrowers.reduce((s,b)=>s+b.loan,0).toLocaleString(),'#ef4444',''+borrowers.length+' borçlu kullanıcı') +
    '</div>';

    // Para gönder / tahsil
    h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">' +
      // Para gönder
      '<div style="background:#0d1a2e;border:1px solid #1a2f4a;border-radius:12px;padding:14px">' +
        '<h4 style="color:#22c55e;margin:0 0 10px;font-size:13px">💸 Hazineden Para Gönder</h4>' +
        '<input type="text" id="mbToUid" placeholder="Kullanıcı UID veya username" style="width:100%;box-sizing:border-box;padding:8px;border-radius:7px;border:1px solid #1a2f4a;background:#060c18;color:#e2e8f0;font-size:12px;margin-bottom:6px">' +
        '<input type="number" id="mbAmount" placeholder="Miktar (₺)" style="width:100%;box-sizing:border-box;padding:8px;border-radius:7px;border:1px solid #1a2f4a;background:#060c18;color:#e2e8f0;font-size:12px;margin-bottom:8px">' +
        '<button class="admin-btn green" style="width:100%" onclick="window._mbGonder()">💸 Gönder</button>' +
      '</div>' +
      // Manuel vergi tahsil
      '<div style="background:#0d1a2e;border:1px solid #1a2f4a;border-radius:12px;padding:14px">' +
        '<h4 style="color:#f59e0b;margin:0 0 10px;font-size:13px">🏛️ Manuel Vergi Tahsil</h4>' +
        '<input type="text" id="mbTaxUid" placeholder="Kullanıcı UID veya username" style="width:100%;box-sizing:border-box;padding:8px;border-radius:7px;border:1px solid #1a2f4a;background:#060c18;color:#e2e8f0;font-size:12px;margin-bottom:6px">' +
        '<div id="mbTaxPreview" style="color:#475569;font-size:11px;min-height:18px;margin-bottom:8px"></div>' +
        '<div style="display:flex;gap:6px">' +
          '<button class="admin-btn teal" style="flex:1" onclick="window._mbTaxPreview()">🔍 Hesapla</button>' +
          '<button class="admin-btn yellow" style="flex:1" onclick="window._mbTaxCollect()">Tahsil Et</button>' +
        '</div>' +
      '</div>' +
    '</div>';

    // Borçlu kullanıcılar tablosu
    h+='<div style="background:#0d1a2e;border:1px solid #1a2f4a;border-radius:12px;padding:14px;margin-bottom:14px">' +
      '<h4 style="color:#ef4444;margin:0 0 12px;font-size:13px">💳 Borçlu Kullanıcılar ('+borrowers.length+')</h4>';
    if(!borrowers.length){
      h+='<div style="text-align:center;color:#475569;padding:16px">Borçlu kullanıcı yok</div>';
    } else {
      h+='<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Kullanıcı</th><th>Borç</th><th>Kredi Notu</th><th>İşlem</th></tr></thead><tbody>' +
        borrowers.map(b=>'<tr>' +
          '<td><b>'+b.username+'</b></td>' +
          '<td style="color:#ef4444;font-weight:700">₺'+b.loan.toLocaleString()+'</td>' +
          '<td style="color:'+(b.krediNotu>=70?'#22c55e':b.krediNotu>=50?'#f59e0b':'#ef4444')+'">'+b.krediNotu+'/100</td>' +
          '<td style="display:flex;gap:4px">' +
            '<button class="admin-btn-xs green" onclick="window._mbBorcSil(\''+b.uid+'\')">Sil</button>' +
            '<button class="admin-btn-xs yellow" onclick="window._mbBorcTahsil(\''+b.uid+'\','+b.loan+')">Tahsil</button>' +
          '</td>' +
        '</tr>').join('') +
        '</tbody></table></div>';
    }
    h+='</div>';

    // Son işlem logu
    h+='<div style="background:#0d1a2e;border:1px solid #1a2f4a;border-radius:12px;padding:14px">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">' +
        '<h4 style="color:#e2e8f0;margin:0;font-size:13px">📋 Son İşlem Kayıtları</h4>' +
        '<button class="admin-btn-sm" onclick="window.AP.openMerkezBankasiPanel()">🔄</button>' +
      '</div>';
    if(!loglar.length){
      h+='<div style="text-align:center;color:#475569;padding:16px">Kayıt yok</div>';
    } else {
      h+='<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Kullanıcı</th><th>Vergi</th><th>Faiz</th><th>Toplam</th><th>Tarih</th></tr></thead><tbody>' +
        loglar.map(l=>'<tr>' +
          '<td><b>'+(l.username||l.uid||'-')+'</b></td>' +
          '<td style="color:#f59e0b">₺'+(l.vergi||0).toLocaleString()+'</td>' +
          '<td style="color:#22c55e">₺'+(l.faiz||0).toLocaleString()+'</td>' +
          '<td style="color:#3b82f6;font-weight:700">₺'+((l.vergi||0)+(l.faiz||0)).toLocaleString()+'</td>' +
          '<td style="color:#475569">'+(l.ts?new Date(l.ts).toLocaleDateString('tr-TR'):'-')+'</td>' +
        '</tr>').join('') +
        '</tbody></table></div>';
    }
    h+='</div>';
    el.innerHTML=h;
  }

  window._mbGonder=async function(){
    const inp=document.getElementById('mbToUid')?.value?.trim();
    const mik=parseFloat(document.getElementById('mbAmount')?.value)||0;
    if(!inp||mik<=0) return _toast('Alıcı ve miktar gir','warn');
    let uid=inp;
    const ud=await _get('users/'+inp);
    if(!ud){const s=await db().ref('users').orderByChild('username').equalTo(inp).once('value');const f=s.val();if(f)uid=Object.keys(f)[0];else return _toast('Kullanıcı bulunamadı','error');}
    const authUid=await _get('system/authorityUid');
    if(!authUid) return _toast('Hazine UID bulunamadı','error');
    const bal=(await _get('users/'+authUid+'/money'))||0;
    if(bal<mik) return _toast('Hazine bakiyesi yetersiz!','error');
    await db().ref('users/'+authUid+'/money').transaction(c=>(c||0)-mik);
    await db().ref('users/'+uid+'/money').transaction(c=>(c||0)+mik);
    _toast('✅ ₺'+mik.toLocaleString()+' → '+uid+' gönderildi');
    await _adminLog('mb_gonder',{to:uid,amount:mik});
    window.AP.openMerkezBankasiPanel();
  };
  window._mbTaxPreview=async function(){
    const inp=document.getElementById('mbTaxUid')?.value?.trim();
    const el=document.getElementById('mbTaxPreview');
    if(!inp||!el) return;
    let uid=inp;
    const ud=await _get('users/'+inp);
    if(!ud){const s=await db().ref('users').orderByChild('username').equalTo(inp).once('value');const f=s.val();if(f)uid=Object.keys(f)[0];else{el.textContent='Kullanıcı bulunamadı';return;}}
    if(typeof window.getVergiDetay==='function'){
      const v=await window.getVergiDetay(uid);
      el.innerHTML='<span style="color:#f59e0b">Vergi: ₺'+v.totalVergi+'</span> + <span style="color:#22c55e">Faiz: ₺'+v.weeklyFaiz+'</span> = <b>₺'+(v.totalVergi+v.weeklyFaiz)+'</b>';
      el.dataset.uid=uid;
    }
  };
  window._mbTaxCollect=async function(){
    const el=document.getElementById('mbTaxPreview');
    const uid=el?.dataset?.uid;
    if(!uid) return _toast('Önce Hesapla\'ya bas','warn');
    const authUid=await _get('system/authorityUid');
    if(typeof window.getVergiDetay==='function'){
      const v=await window.getVergiDetay(uid);
      const toplam=v.totalVergi+v.weeklyFaiz;
      if(toplam<=0) return _toast('Tahsil edilecek şey yok','warn');
      await db().ref('users/'+uid+'/money').transaction(c=>Math.max(0,(c||0)-toplam));
      if(authUid) await db().ref('users/'+authUid+'/money').transaction(c=>(c||0)+toplam);
      _toast('✅ ₺'+toplam.toLocaleString()+' tahsil edildi');
      window.AP.openMerkezBankasiPanel();
    }
  };
  window._mbBorcSil=async function(uid){
    if(!confirm('Borç sıfırlanacak. Emin misin?')) return;
    await _set('bank/'+uid+'/loan',0);
    if(typeof window.updateKrediNotu==='function') await window.updateKrediNotu(uid,5,'Admin borç sildi');
    _toast('✅ Borç silindi');
    window.AP.openMerkezBankasiPanel();
  };
  window._mbBorcTahsil=async function(uid,borc){
    if(!confirm('₺'+borc.toLocaleString()+' tahsil edilecek. Emin misin?')) return;
    const ok=await db().ref('users/'+uid+'/money').transaction(c=>{if((c||0)<borc)return;return c-borc;});
    const authUid=await _get('system/authorityUid');
    if(ok.committed){
      await _set('bank/'+uid+'/loan',0);
      if(authUid) await db().ref('users/'+authUid+'/money').transaction(c=>(c||0)+borc);
      _toast('✅ ₺'+borc.toLocaleString()+' tahsil edildi');
    } else {
      await _set('bank/'+uid+'/loan',0);
      _toast('Bakiye yetersiz — borç silindi','warn');
    }
    window.AP.openMerkezBankasiPanel();
  };

  /* ─── Borsa Kontrol Paneli ─── */
  async function openBorsaPanel() {
    const bodyHtml = `
      <div style="padding:24px;max-width:1200px">
        <h2 style="color:#e2e8f0;margin:0 0 20px;font-size:20px;font-weight:800;padding-bottom:12px;border-bottom:1px solid #1a2f4a">📈 Borsa Kontrol Merkezi</h2>
        <div class="admin-econ-section">
          <div class="admin-action-row">
            <label style="color:#e2e8f0">Tüm Hisselere % Değişim:</label>
            <input type="number" id="stockGlobalPct" placeholder="Örn: 5 veya -3" class="admin-input-sm">
            <button class="admin-btn green" onclick="window.AP.stockGlobalChange(1)">📈 Artır</button>
            <button class="admin-btn red" onclick="window.AP.stockGlobalChange(-1)">📉 Düşür</button>
          </div>
          <div class="admin-action-row">
            <button class="admin-btn yellow" onclick="window.AP.triggerDividend()">💰 Temettü Dağıt (Manuel)</button>
            <button class="admin-btn teal" onclick="window.AP.openIPOManager()">🚀 IPO Yöneticisi</button>
          </div>
          <div id="stockPriceList" style="margin-top:16px"><div class="admin-loading">Hisseler yükleniyor...</div></div>
        </div>
      </div>`;
    _adminBody(bodyHtml);
    window.AP._loadStockPrices();
  }

  /* ─── Kripto Kontrol Paneli ─── */
  async function openKriptoPanel() {
    const bodyHtml = `
      <div style="padding:24px;max-width:1200px">
        <h2 style="color:#e2e8f0;margin:0 0 20px;font-size:20px;font-weight:800;padding-bottom:12px;border-bottom:1px solid #1a2f4a">₿ Kripto Kontrol Merkezi</h2>
        <div class="admin-econ-section">
          <div class="admin-action-row">
            <label style="color:#e2e8f0">Tüm Coinlere % Değişim:</label>
            <input type="number" id="cryptoGlobalPct" placeholder="Örn: 10 veya -5" class="admin-input-sm">
            <button class="admin-btn green" onclick="window.AP.cryptoGlobalChange(1)">📈 Artır</button>
            <button class="admin-btn red" onclick="window.AP.cryptoGlobalChange(-1)">📉 Düşür</button>
          </div>
          <div class="admin-action-row">
            <button class="admin-btn red" onclick="window.AP.cryptoFreezeTrade(true)">🔒 Ticareti Durdur</button>
            <button class="admin-btn green" onclick="window.AP.cryptoFreezeTrade(false)">🔓 Ticareti Aç</button>
          </div>
          <div id="cryptoPriceList" style="margin-top:16px"><div class="admin-loading">Kripto fiyatları yükleniyor...</div></div>
        </div>
      </div>`;
    _adminBody(bodyHtml);
    window.AP._loadCryptoPrices();
  }

  /* Admin giriş bildirimi */
  async function _sendAdminLoginAnnouncement() {
    try {
      const snap = await _get('users');
      const batch = {};
      const msg = '👑 Yönetici sisteme giriş yaptı.';
      Object.keys(snap || {}).forEach(uid => {
        const key = db().ref().push().key;
        batch['notifs/' + uid + '/' + key] = {
          type: 'admin_login', icon: '👑', msg, ts: TS(), read: false
        };
      });
      await db().ref().update(batch);
    } catch(e) {}
  }

  /* ══════════════════════════════════════════════════════════════════════════
     INIT — Firebase auth dinleyicisi
     ══════════════════════════════════════════════════════════════════════════ */
  firebase.auth().onAuthStateChanged(async (user) => {
    if (!user) return;
    // SADECE founderTriggerBtn'i hazırla - GZ_FOUNDER_VERIFIED olmadan panel açılmaz
    const isFounder = await _get('users/'+user.uid+'/isFounder').catch(()=>false);
    const adminEmail = _isAdminEmail(user.email);
    if (isFounder || adminEmail) {
      setTimeout(activateFounderBtn, 800);
    }
  });

  /* Public API */
  window.AP = {
    openAdminPanel, closeAdminPanel, navTo, openKrediOnayPanel, openVergiPanel, openMerkezBankasiPanel, openBorsaPanel, openKriptoPanel,
    openKimlikOnayPanel, openBorcDavalarPanel, openTxLog, openEventsManager,
    renderDashboard, openUserSearch, _searchUsers, _filterUsers,
    openUserDetail, _renderUserResults, _liveSearchUsers, _toggleAllCheck,
    userGrantMoney, userRemoveMoney, userGrantDiamond, userRemoveDiamond,
    userGrantXP, userSetLevel, userBan, userUnban, userFreeze, userUnfreeze,
    userResetAccount, userGrantVIP, userRevokeVIP, userGrantAdmin, userRevokeAdmin,
    userGrantTitle, userRemoveTitle, userResetDebt, userResetCrypto, userResetStocks,
    userSendMsg, userSendReward, userResetDailyBonus, userResetWheel,
    userCompleteAllAch, userCompleteAllTech, userCompleteAllCourses,
    openAllUsersModal, _quickBan, bulkBanSelected, bulkGiftAll, exportUsersCSV,
    openGlobalEconModal, _econTab,
    _loadCryptoPrices, setCryptoPrice, lockCryptoPrice, cryptoGlobalChange, cryptoFreezeTrade,
    _loadStockPrices, setStockPrice, lockStock, stockGlobalChange,
    triggerDividend, setBankInterest, setBankLoanMult, collectOverdueLoans, triggerInterestPayout,
    _loadMarketListings, deleteListing, clearAllListings, setMarketMaxPrice, setMarketCommission,
    setGlobalSetting, applyInflation, openIPOManager, approveIPO, rejectIPO,
    setVergiOrani, setKrediDakikaFaiz, setMaxSatisBirim, clearVergiHazinesi,
    openGameManagement, loadPvpData, cancelDuel, cancelAllDuels,
    resetAllDailyTasks, resetAllMiniGameStats, giveWheelToAll,
    openBotSuspectList, openWheelCustomizer, saveWheelWeights, openCardManager,
    openExpeditionManager, completeExpedition, cancelExpedition,
    openBroadcastModal, sendBroadcast, clearBroadcast, sendSegmentNotif, scheduleNotif,
    openNewsManager, loadNews, createNews, previewNews, pinNews, hideNews, deleteNews,
    toggleMaintModal, setMaintenance, scheduleMaintenance,
    openChatManager, loadChatMessages, deleteChatMsg, muteUser, unmuteUser, muteChatUser,
    sendAdminChatMsg, addFilterWord, loadFilterWords, removeFilterWord,
    openBulkNotifModal, sendBulkNotif,
    openSecurityLogs, _secTab, loadSecAttempts, loadReports, warnUser, closeReport,
    loadSuspicious, loadAdminLog,
    openSystemSettings, setSystemSetting, setElmasFiyati, toggleRegistration, toggleAnon,
    startEvent, startDiscountEvent, stopAllEvents, openEventModal, createCustomEvent,
    loadFirebaseStatus, openRawDataViewer, loadRawData, saveRawData, deleteRawData,
    applyThemeColor, applySeasonTheme,
    openAnalytics, _anaTab, loadEconomyAnalytics, loadPlayerAnalytics, loadTechAnalytics,
    openUserSearch
  };

})();
/* ==========================================================================
   admin-panel-banned.js — Ban Yönetimi Eklentisi
   ─────────────────────────────────────────────────────────────────────────
   Mevcut admin-panel.js'e EKSTRA olarak yüklenir.
   index.html'de admin-panel.js'den SONRA ekle:
     <script src="admin-panel-banned.js"></script>

   EKLENİLENLER:
   1. Sidebar'a "🚫 Banlılar" butonu
   2. Tam banlı kullanıcı listesi (UID, kullanıcı adı, sebep, tarih)
   3. Tek tıkla ban kaldır
   4. Geçici ban (otomatik kalkma)
   5. Ban geçmişi görüntüleme
   6. Toplu ban kaldır
   7. Ban sebebi düzenle
   8. Otomatik geçici ban kaldırma motoru
   ========================================================================== */

(function BanManager() {
  'use strict';

  const db  = () => firebase.database();
  const TS  = () => firebase.database.ServerValue.TIMESTAMP;

  /* ══════════════════════════════════════════════════════════════════════
     1. SIDEBAR'A BANLILAR BUTONU EKLE
     ══════════════════════════════════════════════════════════════════════ */
  function injectBanNavButton() {
    const nav = document.querySelector('.admin-nav');
    if (!nav) { setTimeout(injectBanNavButton, 800); return; }

    // Zaten eklenmişse tekrar ekleme
    if (document.getElementById('banNavBtn')) return;

    const btn = document.createElement('button');
    btn.id = 'banNavBtn';
    btn.className = 'admin-nav-btn';
    btn.style.cssText = 'position:relative';
    btn.innerHTML = '🚫 Banlılar <span id="banCountBadge" style="background:#dc2626;color:#fff;border-radius:99px;padding:1px 7px;font-size:11px;position:absolute;right:10px;top:50%;transform:translateY(-50%);display:none">0</span>';
    btn.onclick = () => {
      document.querySelectorAll('.admin-nav-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      openBanManager();
    };

    // "Güvenlik" butonunun öncesine ekle
    const secBtn = [...nav.querySelectorAll('.admin-nav-btn')].find(b => b.textContent.includes('Güvenlik'));
    if (secBtn) nav.insertBefore(btn, secBtn);
    else nav.appendChild(btn);

    // Banlı sayısını güncelle
    updateBanCount();
  }

  async function updateBanCount() {
    try {
      const snap = await db().ref('users').orderByChild('banned').equalTo(true).once('value');
      const count = snap.numChildren();
      const badge = document.getElementById('banCountBadge');
      if (badge) {
        badge.textContent = count;
        badge.style.display = count > 0 ? '' : 'none';
      }
    } catch(e) {}
  }

  /* ══════════════════════════════════════════════════════════════════════
     2. ANA BAN YÖNETİM SAYFASI
     ══════════════════════════════════════════════════════════════════════ */
  async function openBanManager() {
    const panel = document.getElementById(window._adminTarget||'adminPanelBody');
    if (!panel) return;
    panel.innerHTML = '<div class="admin-loading">🚫 Banlılar yükleniyor...</div>';

    try {
      const snap = await db().ref('users').orderByChild('banned').equalTo(true).once('value');
      const allSnap = await db().ref('users').once('value');
      const allUsers = allSnap.val() || {};

      const bannedEntries = [];
      snap.forEach(child => {
        bannedEntries.push({ uid: child.key, ...child.val() });
      });

      // Geçici banlar (süresi dolmuş → otomatik kaldır)
      const now_ = Date.now();
      const expired = bannedEntries.filter(u => u.tempBanUntil && u.tempBanUntil <= now_);
      for (const u of expired) {
        await unbanUser(u.uid, false);
        bannedEntries.splice(bannedEntries.indexOf(u), 1);
      }

      // Tarihe göre sırala (en yeni önce)
      bannedEntries.sort((a, b) => (b.bannedAt || 0) - (a.bannedAt || 0));

      panel.innerHTML = `
        <div class="admin-section">
          <h2 class="admin-section-title">🚫 Ban Yönetimi</h2>

          <!-- İstatistik şeridi -->
          <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:20px">
            ${statCard('🚫', 'Toplam Banlı', bannedEntries.length, '#dc2626')}
            ${statCard('⏰', 'Geçici Ban', bannedEntries.filter(u=>u.tempBanUntil).length, '#f59e0b')}
            ${statCard('♾️', 'Kalıcı Ban', bannedEntries.filter(u=>!u.tempBanUntil).length, '#7c3aed')}
            ${statCard('✅', 'Bugün Kaldırılan', 0, '#16a34a')}
          </div>

          <!-- Araç çubuğu -->
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;align-items:center">
            <input type="text" id="banSearch" placeholder="🔍 Kullanıcı adı veya UID ara..."
              oninput="banFilterTable(this.value)"
              style="flex:1;min-width:200px;background:#1e2d4a;border:1px solid #2d3748;color:#e5e7eb;border-radius:8px;padding:10px 14px;font-size:13px">
            <select id="banTypeFilter" onchange="banFilterType(this.value)"
              style="background:#1e2d4a;border:1px solid #2d3748;color:#e5e7eb;border-radius:8px;padding:10px 12px;font-size:13px">
              <option value="all">Tüm Banlar</option>
              <option value="temp">Geçici Banlar</option>
              <option value="perm">Kalıcı Banlar</option>
            </select>
            <button onclick="bulkUnbanSelected()" style="${apBtnStyle('#16a34a')}">✅ Seçilenlerin Banını Kaldır</button>
            <button onclick="openBanManualModal()" style="${apBtnStyle('#dc2626')}">+ Manuel Ban Ekle</button>
            <button onclick="exportBanList()" style="${apBtnStyle('#0891b2')}">📥 CSV İndir</button>
          </div>

          <!-- Tablo -->
          ${bannedEntries.length === 0
            ? `<div style="text-align:center;padding:60px;color:#475569">
                <div style="font-size:60px;margin-bottom:16px">✅</div>
                <div style="font-size:18px;font-weight:700;color:#94a3b8">Banlı kullanıcı yok</div>
                <div style="font-size:13px;margin-top:6px">Herkes serbest!</div>
              </div>`
            : `<div class="admin-table-wrap" id="banTableWrap">
                <table class="admin-table" id="banTable">
                  <thead>
                    <tr>
                      <th><input type="checkbox" id="chkBanAll" onchange="toggleAllBanChk()"></th>
                      <th>Kullanıcı</th>
                      <th>UID</th>
                      <th>Ban Sebebi</th>
                      <th>Banlayan</th>
                      <th>Ban Tarihi</th>
                      <th>Ban Bitiş</th>
                      <th>Para</th>
                      <th>Seviye</th>
                      <th>İşlemler</th>
                    </tr>
                  </thead>
                  <tbody id="banTbody">
                    ${bannedEntries.map(u => renderBanRow(u)).join('')}
                  </tbody>
                </table>
              </div>`
          }

          <!-- Geçici Ban Oluştur -->
          <div class="admin-card" style="margin-top:20px">
            <h3>⏰ Geçici Ban Sistemi</h3>
            <p style="color:#94a3b8;font-size:13px;margin-bottom:12px">
              Geçici banlı kullanıcılar, süre dolunca otomatik olarak serbest bırakılır.
            </p>
            <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
              <input type="text" id="tempBanUID" placeholder="Kullanıcı UID"
                style="flex:1;min-width:200px;background:#0f172a;border:1px solid #2d3748;color:#e5e7eb;border-radius:8px;padding:10px">
              <input type="text" id="tempBanReason" placeholder="Ban sebebi"
                style="flex:1;min-width:200px;background:#0f172a;border:1px solid #2d3748;color:#e5e7eb;border-radius:8px;padding:10px">
              <select id="tempBanDur"
                style="background:#0f172a;border:1px solid #2d3748;color:#e5e7eb;border-radius:8px;padding:10px">
                <option value="3600000">1 Saat</option>
                <option value="21600000">6 Saat</option>
                <option value="86400000">1 Gün</option>
                <option value="259200000">3 Gün</option>
                <option value="604800000">1 Hafta</option>
                <option value="2592000000">30 Gün</option>
              </select>
              <button onclick="applyTempBan()" style="${apBtnStyle('#f59e0b')}">⏰ Geçici Ban Uygula</button>
            </div>
          </div>

          <!-- Ban Geçmişi -->
          <div class="admin-card" style="margin-top:16px">
            <h3 style="display:flex;align-items:center;justify-content:space-between">
              📜 Son 20 Ban İşlemi
              <button onclick="loadBanHistory()" style="${apBtnStyle('#475569',true)}">🔄 Yükle</button>
            </h3>
            <div id="banHistorySection" style="color:#475569;font-size:13px">Yüklemek için butona bas.</div>
          </div>
        </div>
      `;

      // Global fonksiyonlar
      window.banFilterTable = banFilterTable;
      window.banFilterType  = banFilterType;
      window.bulkUnbanSelected = bulkUnbanSelected;
      window.openBanManualModal = openBanManualModal;
      window.exportBanList = exportBanList;
      window.toggleAllBanChk = toggleAllBanChk;
      window.applyTempBan = applyTempBan;
      window.loadBanHistory = loadBanHistory;
      window.quickUnban = quickUnban;
      window.openBanDetailModal = openBanDetailModal;
      window.editBanReason = editBanReason;

    } catch(e) {
      panel.innerHTML = `<div class="admin-section"><div style="color:#dc2626;padding:20px">Hata: ${e.message}</div></div>`;
      console.error('[BanManager]', e);
    }
  }

  /* ══════════════════════════════════════════════════════════════════════
     3. BAN SATIRI RENDER
     ══════════════════════════════════════════════════════════════════════ */
  function renderBanRow(u) {
    const banDate   = u.bannedAt ? new Date(u.bannedAt).toLocaleString('tr-TR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '?';
    const isTemp    = !!u.tempBanUntil;
    const remaining = isTemp ? Math.max(0, u.tempBanUntil - Date.now()) : null;
    const remStr    = isTemp && remaining > 0 ? formatDuration(remaining) : isTemp ? 'Süresi Dolmuş' : '♾️ Kalıcı';
    const maskedUID = u.uid.slice(0, 8) + '...' + u.uid.slice(-4);

    return `
      <tr data-uid="${u.uid}" data-name="${(u.username || '').toLowerCase()}" data-type="${isTemp ? 'temp' : 'perm'}">
        <td><input type="checkbox" class="ban-chk" data-uid="${u.uid}"></td>
        <td>
          <div style="display:flex;align-items:center;gap:8px">
            <div style="width:32px;height:32px;border-radius:50%;background:${isTemp?'#7c2d12':'#450a0a'};display:flex;align-items:center;justify-content:center;font-size:14px">
              ${u.isAnonymous ? '🛡️' : '👤'}
            </div>
            <div>
              <div style="font-weight:700;color:#e5e7eb">${escHtml(u.username || 'İsimsiz')}</div>
              <div style="font-size:10px;color:#64748b">${u.email ? maskEmail(u.email) : 'E-posta yok'}</div>
            </div>
          </div>
        </td>
        <td>
          <div style="font-family:monospace;font-size:11px;color:#94a3b8;display:flex;align-items:center;gap:4px">
            ${maskedUID}
            <button onclick="navigator.clipboard.writeText('${u.uid}').then(()=>apToast('📋 UID kopyalandı','success'))"
              style="background:transparent;border:none;cursor:pointer;color:#475569;font-size:14px">📋</button>
          </div>
        </td>
        <td>
          <div style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#fbbf24;font-size:12px"
            title="${escHtml(u.banReason || '—')}">
            ${escHtml(u.banReason || '—')}
          </div>
        </td>
        <td style="color:#64748b;font-size:11px">${u.bannedBy ? u.bannedBy.slice(0,8) + '...' : 'Sistem'}</td>
        <td style="color:#94a3b8;font-size:12px;white-space:nowrap">${banDate}</td>
        <td>
          <span style="
            background:${isTemp ? 'rgba(245,158,11,0.15)' : 'rgba(220,38,38,0.15)'};
            border:1px solid ${isTemp ? '#f59e0b' : '#dc2626'};
            color:${isTemp ? '#fbbf24' : '#f87171'};
            border-radius:8px;padding:3px 10px;font-size:11px;white-space:nowrap;font-weight:600
          ">${remStr}</span>
        </td>
        <td style="color:#16a34a;font-size:12px;font-weight:700">${fmtMoney(u.money || 0)}</td>
        <td style="color:#94a3b8;font-size:12px">Lv ${u.level || 1}</td>
        <td>
          <div style="display:flex;gap:4px;flex-wrap:wrap">
            <button onclick="openBanDetailModal('${u.uid}')"
              style="${apBtnStyle('#3b82f6', true)}">Detay</button>
            <button onclick="quickUnban('${u.uid}','${escHtml(u.username || 'Kullanıcı')}')"
              style="${apBtnStyle('#16a34a', true)}">✅ Ban Kaldır</button>
            <button onclick="editBanReason('${u.uid}','${escHtml(u.banReason || '')}')"
              style="${apBtnStyle('#f59e0b', true)}">✏️</button>
          </div>
        </td>
      </tr>
    `;
  }

  /* ══════════════════════════════════════════════════════════════════════
     4. BAN DETAY MODAL — Kullanıcının tüm bilgileri + işlemler
     ══════════════════════════════════════════════════════════════════════ */
  async function openBanDetailModal(uid) {
    const u = await db().ref('users/' + uid).once('value').then(s => s.val());
    if (!u) return apToast('Kullanıcı bulunamadı', 'error');

    const bankData = await db().ref('bank/' + uid).once('value').then(s => s.val() || {});
    const banLogs  = await db().ref('security/banLogs/' + uid).once('value').then(s => {
      const v = s.val(); return v ? Object.values(v).sort((a,b) => (b.ts||0)-(a.ts||0)).slice(0, 10) : [];
    });
    const businesses = await db().ref('businesses/' + uid).once('value').then(s => s.val() || {});

    const shopCount    = Object.keys(businesses.shops || {}).length;
    const gardenCount  = Object.keys(businesses.gardens || {}).length;
    const factoryCount = Object.keys(businesses.factories || {}).length;
    const mineCount    = Object.keys(businesses.mines || {}).length;
    const farmCount    = Object.keys(businesses.farms || {}).length;

    const isTemp = !!u.tempBanUntil;
    const remaining = isTemp ? Math.max(0, u.tempBanUntil - Date.now()) : null;

    const html = `
      <div style="max-width:600px">
        <!-- Profil başlık -->
        <div style="text-align:center;padding:8px 0 20px">
          <div style="font-size:52px">${u.isAnonymous ? '🛡️' : '👤'}</div>
          <div style="font-size:20px;font-weight:900;color:#e5e7eb">${escHtml(u.username || 'İsimsiz')}</div>
          <div style="font-size:12px;color:#64748b;margin-top:4px">${u.email ? maskEmail(u.email) : 'Anonim hesap'}</div>
          <div style="margin-top:8px">
            <span style="
              background:rgba(220,38,38,0.15);border:1px solid #dc2626;
              color:#f87171;border-radius:8px;padding:4px 16px;font-weight:700;font-size:13px
            ">🚫 BANLANDI</span>
          </div>
        </div>

        <!-- Ban detayları -->
        <div style="background:rgba(220,38,38,0.08);border:1px solid rgba(220,38,38,0.3);border-radius:12px;padding:14px;margin-bottom:14px">
          <div style="font-weight:700;color:#f87171;margin-bottom:10px">🚫 Ban Bilgileri</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            ${apDetailRow('Ban Türü', isTemp ? '⏰ Geçici' : '♾️ Kalıcı')}
            ${apDetailRow('Ban Sebebi', escHtml(u.banReason || '—'))}
            ${apDetailRow('Ban Tarihi', u.bannedAt ? new Date(u.bannedAt).toLocaleString('tr-TR') : '?')}
            ${apDetailRow('Banlayan', u.bannedBy ? u.bannedBy.slice(0,8)+'...' : 'Sistem')}
            ${isTemp ? apDetailRow('Bitiş Tarihi', new Date(u.tempBanUntil).toLocaleString('tr-TR')) : ''}
            ${isTemp && remaining > 0 ? apDetailRow('Kalan Süre', formatDuration(remaining)) : ''}
          </div>
        </div>

        <!-- Hesap istatistikleri -->
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:14px">
          ${apStatBox('Seviye', 'Lv ' + (u.level||1))}
          ${apStatBox('Para', fmtMoney(u.money||0))}
          ${apStatBox('Elmas', (u.diamonds||0) + ' 💎')}
          ${apStatBox('Banka', fmtMoney(bankData.balance||0))}
          ${apStatBox('Yatırım', fmtMoney(bankData.investment||0))}
          ${apStatBox('Borç', fmtMoney(bankData.loan||0))}
        </div>

        <!-- İşletmeler -->
        <div style="background:#1e2d4a;border:1px solid #1e3a8a;border-radius:12px;padding:12px;margin-bottom:14px">
          <div style="color:#fbbf24;font-weight:700;margin-bottom:8px">🏢 İşletme Özeti</div>
          <div style="display:flex;gap:12px;flex-wrap:wrap">
            ${bizMini('🏪', 'Dükkan', shopCount)}
            ${bizMini('🌱', 'Bahçe', gardenCount)}
            ${bizMini('🐄', 'Çiftlik', farmCount)}
            ${bizMini('🏭', 'Fabrika', factoryCount)}
            ${bizMini('⛏️', 'Maden', mineCount)}
          </div>
        </div>

        <!-- Ban Geçmişi -->
        <div style="background:#1e2d4a;border:1px solid #1e3a8a;border-radius:12px;padding:12px;margin-bottom:16px">
          <div style="color:#fbbf24;font-weight:700;margin-bottom:8px">📜 Ban Geçmişi (Son 10)</div>
          ${banLogs.length === 0
            ? '<div style="color:#475569;font-size:12px">Bu kullanıcının ban geçmişi yok</div>'
            : banLogs.map(log => `
              <div style="padding:5px 0;border-bottom:1px solid #1e3a8a;display:flex;justify-content:space-between;font-size:11px">
                <span style="color:${log.action==='ban'?'#f87171':'#4ade80'}">${log.action==='ban'?'🚫 Banlandı':'✅ Ban Kaldırıldı'}</span>
                <span style="color:#94a3b8">${escHtml(log.reason || '—')}</span>
                <span style="color:#475569">${new Date(log.ts||0).toLocaleString('tr-TR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</span>
              </div>
            `).join('')
          }
        </div>

        <!-- Aksiyon Butonları -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <button onclick="quickUnban('${uid}','${escHtml(u.username||'Kullanıcı')}');closeAdminModal()"
            style="${apBtnStyle('#16a34a')}">✅ Ban Kaldır</button>
          <button onclick="editBanReason('${uid}','${escHtml(u.banReason||'')}')"
            style="${apBtnStyle('#f59e0b')}">✏️ Sebebi Düzenle</button>
          <button onclick="convertTempBan('${uid}')"
            style="${apBtnStyle('#7c3aed')}">⏰ Geçici Bana Çevir</button>
          <button onclick="navigator.clipboard.writeText('${uid}').then(()=>apToast('📋 UID kopyalandı','success'))"
            style="${apBtnStyle('#475569')}">📋 UID Kopyala</button>
        </div>
      </div>
    `;

    // Mevcut modal sistemini kullan veya kendi modalımızı aç
    if (typeof window.showModal === 'function') {
      window.showModal('🚫 Ban Detayı', html, true);
    } else {
      showApModal('🚫 Ban Detayı', html);
    }

    window.convertTempBan = convertTempBan;
    window.closeAdminModal = closeApModal;
  }

  /* ══════════════════════════════════════════════════════════════════════
     5. BAN KALDIR
     ══════════════════════════════════════════════════════════════════════ */
  async function unbanUser(uid, notify = true) {
    const updates = {
      banned: false,
      banReason: null,
      bannedAt: null,
      bannedBy: null,
      tempBanUntil: null
    };
    await db().ref('users/' + uid).update(updates);

    // Ban log'a ekle
    await db().ref('security/banLogs/' + uid).push({
      action: 'unban',
      by: firebase.auth().currentUser?.uid || 'system',
      ts: firebase.database.ServerValue.TIMESTAMP
    });

    // Admin log
    try {
      await db().ref('adminLogs').push({
        ts: firebase.database.ServerValue.TIMESTAMP,
        adminUid: firebase.auth().currentUser?.uid || 'system',
        action: 'unban',
        details: JSON.stringify({ uid })
      });
    } catch(e) {}

    // Kullanıcıya bildirim gönder
    if (notify) {
      await db().ref('notifs/' + uid).push({
        type: 'unban',
        icon: '✅',
        msg: '✅ Hesabınızın banı kaldırıldı. Tekrar oynayabilirsiniz!',
        ts: firebase.database.ServerValue.TIMESTAMP,
        read: false
      });
    }
  }

  async function quickUnban(uid, username) {
    if (!confirm(`"${username}" (${uid.slice(0,8)}...) kullanıcısının banı kaldırılsın mı?`)) return;
    try {
      await unbanUser(uid, true);
      apToast(`✅ ${username} kullanıcısının banı kaldırıldı`, 'success');
      // Satırı tablodan kaldır
      const row = document.querySelector(`#banTbody tr[data-uid="${uid}"]`);
      if (row) row.style.animation = 'fadeOut 0.3s forwards';
      setTimeout(() => { if (row) row.remove(); updateBanCount(); }, 300);
      // Ban badge güncelle
      updateBanCount();
    } catch(e) {
      apToast('Ban kaldırılırken hata: ' + e.message, 'error');
    }
  }
  window.quickUnban = quickUnban;

  /* ══════════════════════════════════════════════════════════════════════
     6. TOPLU BAN KALDIRMA
     ══════════════════════════════════════════════════════════════════════ */
  async function bulkUnbanSelected() {
    const checked = [...document.querySelectorAll('.ban-chk:checked')].map(c => c.dataset.uid);
    if (checked.length === 0) return apToast('Kullanıcı seçilmedi', 'error');
    if (!confirm(`${checked.length} kullanıcının banı kaldırılsın mı?`)) return;

    let count = 0;
    for (const uid of checked) {
      await unbanUser(uid, true);
      count++;
      const row = document.querySelector(`#banTbody tr[data-uid="${uid}"]`);
      if (row) row.remove();
    }
    apToast(`✅ ${count} kullanıcının banı kaldırıldı`, 'success');
    updateBanCount();
  }

  /* ══════════════════════════════════════════════════════════════════════
     7. GEÇİCİ BAN
     ══════════════════════════════════════════════════════════════════════ */
  async function applyTempBan() {
    const uid    = document.getElementById('tempBanUID')?.value?.trim();
    const reason = document.getElementById('tempBanReason')?.value?.trim() || 'Geçici kısıtlama';
    const dur    = parseInt(document.getElementById('tempBanDur')?.value) || 86400000;

    if (!uid) return apToast('UID gir', 'error');

    const userSnap = await db().ref('users/' + uid).once('value');
    if (!userSnap.exists()) return apToast('Kullanıcı bulunamadı', 'error');

    const until = Date.now() + dur;
    await db().ref('users/' + uid).update({
      banned: true,
      banReason: reason,
      bannedAt: firebase.database.ServerValue.TIMESTAMP,
      bannedBy: firebase.auth().currentUser?.uid || 'admin',
      tempBanUntil: until
    });

    // Ban log
    await db().ref('security/banLogs/' + uid).push({
      action: 'ban',
      reason,
      by: firebase.auth().currentUser?.uid || 'admin',
      tempUntil: until,
      ts: firebase.database.ServerValue.TIMESTAMP
    });

    // Bildirim
    await db().ref('notifs/' + uid).push({
      type: 'ban',
      icon: '🚫',
      msg: `🚫 Hesabınız geçici olarak kısıtlandı. Sebep: ${reason}. Bitiş: ${new Date(until).toLocaleString('tr-TR')}`,
      ts: firebase.database.ServerValue.TIMESTAMP,
      read: false
    });

    apToast(`⏰ Geçici ban uygulandı (${formatDuration(dur)})`, 'success');
    openBanManager(); // Sayfayı yenile
  }

  /* Kalıcı → Geçici bana çevir */
  async function convertTempBan(uid) {
    const durs = {
      '1 Saat': 3600000, '6 Saat': 21600000,
      '1 Gün': 86400000, '3 Gün': 259200000,
      '1 Hafta': 604800000, '30 Gün': 2592000000
    };
    const choice = prompt('Geçici ban süresi seçin:\n' + Object.keys(durs).join('\n'));
    const dur = durs[choice];
    if (!dur) return apToast('Geçersiz seçim', 'error');
    const until = Date.now() + dur;
    await db().ref('users/' + uid).update({ tempBanUntil: until });
    apToast(`⏰ Ban ${choice} geçici bana çevrildi`, 'success');
  }
  window.convertTempBan = convertTempBan;

  /* ══════════════════════════════════════════════════════════════════════
     8. BAN SEBEBİ DÜZENLE
     ══════════════════════════════════════════════════════════════════════ */
  async function editBanReason(uid, currentReason) {
    const newReason = prompt('Yeni ban sebebi:', currentReason || '');
    if (newReason === null) return; // İptal
    if (!newReason.trim()) return apToast('Sebep boş olamaz', 'error');
    await db().ref('users/' + uid + '/banReason').set(newReason.trim());
    apToast('✏️ Ban sebebi güncellendi', 'success');
    // Satırdaki sebebi güncelle
    const row = document.querySelector(`#banTbody tr[data-uid="${uid}"]`);
    if (row) {
      const reasonCell = row.cells[3];
      if (reasonCell) reasonCell.querySelector('div').textContent = newReason;
    }
  }
  window.editBanReason = editBanReason;

  /* ══════════════════════════════════════════════════════════════════════
     9. MANUEL BAN EKLEME MODAL
     ══════════════════════════════════════════════════════════════════════ */
  function openBanManualModal() {
    const html = `
      <div>
        <div style="color:#94a3b8;font-size:13px;margin-bottom:14px">
          UID'yi gir ve ban uygula. Kullanıcı arama için Kullanıcılar sekmesini kullan.
        </div>
        <div style="margin-bottom:10px">
          <label style="color:#94a3b8;font-size:12px;display:block;margin-bottom:4px">Kullanıcı UID</label>
          <input type="text" id="manBanUID" placeholder="Firebase UID gir..."
            style="width:100%;background:#0f172a;border:1px solid #2d3748;color:#e5e7eb;border-radius:8px;padding:10px;font-family:monospace">
        </div>
        <div style="margin-bottom:10px">
          <label style="color:#94a3b8;font-size:12px;display:block;margin-bottom:4px">Ban Sebebi</label>
          <input type="text" id="manBanReason" placeholder="Hile, hakaret, spam vb."
            style="width:100%;background:#0f172a;border:1px solid #2d3748;color:#e5e7eb;border-radius:8px;padding:10px">
        </div>
        <div style="margin-bottom:16px">
          <label style="color:#94a3b8;font-size:12px;display:block;margin-bottom:4px">Ban Türü</label>
          <select id="manBanType" style="width:100%;background:#0f172a;border:1px solid #2d3748;color:#e5e7eb;border-radius:8px;padding:10px">
            <option value="perm">♾️ Kalıcı Ban</option>
            <option value="1h">⏰ 1 Saat</option>
            <option value="6h">⏰ 6 Saat</option>
            <option value="1d">⏰ 1 Gün</option>
            <option value="3d">⏰ 3 Gün</option>
            <option value="7d">⏰ 1 Hafta</option>
            <option value="30d">⏰ 30 Gün</option>
          </select>
        </div>
        <div style="display:flex;gap:8px">
          <button onclick="confirmManualBan()" style="${apBtnStyle('#dc2626')};flex:1">🚫 Ban Uygula</button>
          <button onclick="closeAdminModal()" style="${apBtnStyle('#475569')};flex:1">İptal</button>
        </div>
      </div>
    `;

    showApModal('🚫 Manuel Ban Ekle', html);

    window.confirmManualBan = async function () {
      const uid    = document.getElementById('manBanUID')?.value?.trim();
      const reason = document.getElementById('manBanReason')?.value?.trim() || 'Admin kararı';
      const type   = document.getElementById('manBanType')?.value;

      if (!uid) return apToast('UID gir', 'error');

      const userSnap = await db().ref('users/' + uid).once('value');
      if (!userSnap.exists()) return apToast('Bu UID ile kullanıcı bulunamadı', 'error');

      const durMap = { '1h': 3600000, '6h': 21600000, '1d': 86400000, '3d': 259200000, '7d': 604800000, '30d': 2592000000 };
      const dur = durMap[type] || null;
      const until = dur ? Date.now() + dur : null;

      await db().ref('users/' + uid).update({
        banned: true,
        banReason: reason,
        bannedAt: firebase.database.ServerValue.TIMESTAMP,
        bannedBy: firebase.auth().currentUser?.uid || 'admin',
        tempBanUntil: until
      });

      await db().ref('security/banLogs/' + uid).push({
        action: 'ban', reason, by: firebase.auth().currentUser?.uid || 'admin',
        tempUntil: until, ts: firebase.database.ServerValue.TIMESTAMP
      });

      await db().ref('notifs/' + uid).push({
        type: 'ban', icon: '🚫',
        msg: `🚫 Hesabınız kısıtlandı. Sebep: ${reason}${until ? '. Bitiş: ' + new Date(until).toLocaleString('tr-TR') : ''}`,
        ts: firebase.database.ServerValue.TIMESTAMP, read: false
      });

      closeApModal();
      apToast(`🚫 Ban uygulandı (${type === 'perm' ? 'Kalıcı' : formatDuration(durMap[type])})`, 'success');
      openBanManager();
      updateBanCount();
    };
  }
  window.openBanManualModal = openBanManualModal;

  /* ══════════════════════════════════════════════════════════════════════
     10. BAN GEÇMİŞİ
     ══════════════════════════════════════════════════════════════════════ */
  async function loadBanHistory() {
    const div = document.getElementById('banHistorySection');
    if (!div) return;
    div.innerHTML = '<div style="color:#64748b;font-size:12px">Yükleniyor...</div>';

    try {
      const adminLogs = await db().ref('adminLogs')
        .orderByChild('action').equalTo('ban')
        .limitToLast(20)
        .once('value');
      const unbanLogs = await db().ref('adminLogs')
        .orderByChild('action').equalTo('unban')
        .limitToLast(20)
        .once('value');

      const banArr   = adminLogs.val() ? Object.values(adminLogs.val()) : [];
      const unbanArr = unbanLogs.val() ? Object.values(unbanLogs.val()) : [];
      const combined = [...banArr, ...unbanArr].sort((a,b) => (b.ts||0) - (a.ts||0)).slice(0, 20);

      if (combined.length === 0) {
        div.innerHTML = '<div style="color:#475569;font-size:12px">Ban geçmişi boş</div>';
        return;
      }

      div.innerHTML = `
        <div style="max-height:300px;overflow-y:auto">
          ${combined.map(log => {
            const details = (() => { try { return JSON.parse(log.details || '{}'); } catch(e) { return {}; } })();
            const isBan   = log.action === 'ban';
            return `
              <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #1e3a8a">
                <div>
                  <div style="display:flex;align-items:center;gap:6px">
                    <span style="font-size:14px">${isBan ? '🚫' : '✅'}</span>
                    <span style="color:${isBan?'#f87171':'#4ade80'};font-weight:600;font-size:13px">
                      ${isBan ? 'Ban Uygulandı' : 'Ban Kaldırıldı'}
                    </span>
                  </div>
                  <div style="color:#64748b;font-size:11px;margin-top:2px">
                    UID: ${(details.uid || '?').slice(0,16)}...
                    ${details.reason ? ' · ' + details.reason : ''}
                  </div>
                </div>
                <div style="color:#475569;font-size:11px;text-align:right">
                  ${new Date(log.ts||0).toLocaleString('tr-TR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    } catch(e) {
      div.innerHTML = `<div style="color:#dc2626;font-size:12px">Hata: ${e.message}</div>`;
    }
  }
  window.loadBanHistory = loadBanHistory;

  /* ══════════════════════════════════════════════════════════════════════
     11. ARAMA & FİLTRE
     ══════════════════════════════════════════════════════════════════════ */
  function banFilterTable(q) {
    q = q.toLowerCase();
    document.querySelectorAll('#banTbody tr').forEach(row => {
      const name = row.dataset.name || '';
      const uid  = row.dataset.uid  || '';
      row.style.display = (!q || name.includes(q) || uid.includes(q)) ? '' : 'none';
    });
  }

  function banFilterType(type) {
    document.querySelectorAll('#banTbody tr').forEach(row => {
      if (type === 'all') { row.style.display = ''; return; }
      row.style.display = row.dataset.type === type ? '' : 'none';
    });
  }

  function toggleAllBanChk() {
    const all = document.getElementById('chkBanAll')?.checked;
    document.querySelectorAll('.ban-chk').forEach(c => { c.checked = all; });
  }
  window.toggleAllBanChk = toggleAllBanChk;

  /* ══════════════════════════════════════════════════════════════════════
     12. CSV İNDİR
     ══════════════════════════════════════════════════════════════════════ */
  async function exportBanList() {
    const snap = await db().ref('users').orderByChild('banned').equalTo(true).once('value');
    const rows = [['UID','Kullanıcı Adı','E-posta','Ban Sebebi','Ban Tarihi','Ban Bitiş','Para','Seviye']];
    snap.forEach(child => {
      const u = child.val();
      rows.push([
        child.key,
        u.username || '—',
        u.email || 'Anonim',
        u.banReason || '—',
        u.bannedAt ? new Date(u.bannedAt).toLocaleString('tr-TR') : '?',
        u.tempBanUntil ? new Date(u.tempBanUntil).toLocaleString('tr-TR') : 'Kalıcı',
        u.money || 0,
        u.level || 1
      ]);
    });
    const csv  = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = 'banlı_kullaniciler_' + new Date().toISOString().slice(0,10) + '.csv';
    a.click();
    apToast('📥 Ban listesi indirildi', 'success');
  }
  window.exportBanList = exportBanList;

  /* ══════════════════════════════════════════════════════════════════════
     13. OTOMATİK GEÇİCİ BAN SONA ERME MOTORU
     ══════════════════════════════════════════════════════════════════════ */
  function startTempBanEngine() {
    async function checkExpiredBans() {
      try {
        const snap = await db().ref('users')
          .orderByChild('banned').equalTo(true)
          .once('value');

        const now_ = Date.now();
        const toUnban = [];

        snap.forEach(child => {
          const u = child.val();
          if (u.tempBanUntil && u.tempBanUntil <= now_) {
            toUnban.push({ uid: child.key, username: u.username });
          }
        });

        for (const { uid, username } of toUnban) {
          await unbanUser(uid, true);
          console.log(`[TempBanEngine] ✅ ${username || uid} geçici banı sona erdi, serbest bırakıldı.`);
        }

        if (toUnban.length > 0) updateBanCount();
      } catch(e) {}
    }

    // 2 dakikada bir kontrol
    checkExpiredBans();
    setInterval(checkExpiredBans, 2 * 60 * 1000);
    console.log('[TempBanEngine] ✅ Geçici ban motoru başlatıldı (2 dk aralıklı)');
  }

  /* ══════════════════════════════════════════════════════════════════════
     YARDIMCI FONKSİYONLAR
     ══════════════════════════════════════════════════════════════════════ */
  function formatDuration(ms) {
    if (ms <= 0) return '0sn';
    const d = Math.floor(ms / 86400000);
    const h = Math.floor((ms % 86400000) / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    if (d > 0) return `${d}g ${h}s`;
    if (h > 0) return `${h}s ${m}d`;
    return `${m}d`;
  }

  function fmtMoney(n) {
    if (!n || isNaN(n)) return '0₺';
    if (Math.abs(n) >= 1e9) return (n/1e9).toFixed(1) + 'Mr₺';
    if (Math.abs(n) >= 1e6) return (n/1e6).toFixed(1) + 'M₺';
    if (Math.abs(n) >= 1e3) return (n/1e3).toFixed(1) + 'B₺';
    return n.toFixed(0) + '₺';
  }

  function maskEmail(email) {
    if (!email) return '';
    const [local, domain] = email.split('@');
    if (!local || !domain) return email;
    return local.slice(0, 2) + '*'.repeat(Math.max(1, local.length - 4)) + local.slice(-2) + '@' + domain;
  }

  function escHtml(s) {
    return String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function apBtnStyle(color, small = false) {
    return `background:${color}22;border:1px solid ${color}55;color:${color};
      padding:${small?'5px 10px':'10px 16px'};border-radius:8px;cursor:pointer;
      font-weight:600;font-size:${small?'11px':'13px'};white-space:nowrap;transition:.2s`;
  }

  function statCard(icon, label, val, color) {
    return `<div style="
      background:#1e2d4a;border:1px solid ${color}44;border-radius:12px;
      padding:12px 16px;min-width:110px;border-left:3px solid ${color};flex-shrink:0
    ">
      <div style="font-size:20px">${icon}</div>
      <div style="color:#64748b;font-size:10px;margin-top:3px">${label}</div>
      <div style="color:#e5e7eb;font-weight:900;font-size:18px">${val}</div>
    </div>`;
  }

  function apDetailRow(label, val) {
    return `<div style="background:#0f172a;border-radius:8px;padding:8px 10px">
      <div style="color:#64748b;font-size:10px">${label}</div>
      <div style="color:#e5e7eb;font-weight:600;font-size:13px">${val}</div>
    </div>`;
  }

  function apStatBox(label, val) {
    return `<div style="background:#0f172a;border:1px solid #1e3a8a;border-radius:10px;padding:10px;text-align:center">
      <div style="color:#64748b;font-size:10px">${label}</div>
      <div style="color:#e5e7eb;font-weight:800;font-size:13px">${val}</div>
    </div>`;
  }

  function bizMini(icon, label, count) {
    return `<div style="background:#0f172a;border-radius:8px;padding:6px 10px;text-align:center;min-width:55px">
      <div style="font-size:16px">${icon}</div>
      <div style="color:#64748b;font-size:10px">${label}</div>
      <div style="color:#e5e7eb;font-weight:700;font-size:13px">${count}</div>
    </div>`;
  }

  function apToast(msg, kind = 'success', ms = 3000) {
    if (typeof window.toast === 'function') window.toast(msg, kind, ms);
  }

  /* Basit iç modal (mevcut showModal varsa onu kullanır) */
  function showApModal(title, html) {
    if (typeof window.showModal === 'function') {
      window.showModal(title, html, true);
      return;
    }
    let el = document.getElementById('apBanModal');
    if (!el) {
      el = document.createElement('div');
      el.id = 'apBanModal';
      el.style.cssText = `
        position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:200001;
        display:flex;align-items:center;justify-content:center;padding:20px
      `;
      el.innerHTML = `
        <div style="background:#1e2d4a;border:1px solid #1e3a8a;border-radius:16px;
          max-width:600px;width:100%;max-height:90vh;overflow-y:auto;padding:20px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
            <div id="apBanModalTitle" style="color:#fbbf24;font-weight:800;font-size:16px"></div>
            <button onclick="closeApModal()" style="background:rgba(239,68,68,0.2);border:1px solid rgba(239,68,68,0.4);
              color:#ef4444;padding:4px 12px;border-radius:6px;cursor:pointer;font-weight:700">✕</button>
          </div>
          <div id="apBanModalBody"></div>
        </div>
      `;
      el.addEventListener('click', e => { if (e.target === el) closeApModal(); });
      document.body.appendChild(el);
    }
    document.getElementById('apBanModalTitle').textContent = title;
    document.getElementById('apBanModalBody').innerHTML = html;
    el.style.display = 'flex';
  }

  function closeApModal() {
    if (typeof window.closeModal === 'function') { window.closeModal(); return; }
    const el = document.getElementById('apBanModal');
    if (el) el.style.display = 'none';
  }
  window.closeAdminModal = closeApModal;

  /* CSS animasyon */
  const style = document.createElement('style');
  style.textContent = `
    @keyframes fadeOut {
      to { opacity: 0; transform: translateX(100%); }
    }
    #banTable tbody tr:hover { background: rgba(255,255,255,0.03); }
    #banNavBtn:hover { background: rgba(220,38,38,0.1) !important; }
  `;
  document.head.appendChild(style);

  /* ══════════════════════════════════════════════════════════════════════
     INIT
     ══════════════════════════════════════════════════════════════════════ */
  function init() {
    // Panel DOM hazır olunca sidebar'a butonu ekle
    const observer = new MutationObserver(() => {
      if (document.querySelector('.admin-nav')) {
        observer.disconnect();
        injectBanNavButton();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // Admin paneli zaten açıksa direkt ekle
    if (document.querySelector('.admin-nav')) injectBanNavButton();

    // Geçici ban motoru başlat
    startTempBanEngine();

    console.log('%c[BanManager] ✅ Ban Yönetimi modülü yüklendi', 'color:#ef4444;font-weight:700');
  }

  // Firebase hazır olunca başlat
  if (typeof firebase !== 'undefined') {
    init();
  } else {
    document.addEventListener('DOMContentLoaded', init);
  }

  // Global erişim
  window.BanManager = {
    openBanManager,
    quickUnban,
    applyTempBan,
    exportBanList,
    loadBanHistory,
    updateBanCount
  };

})();

