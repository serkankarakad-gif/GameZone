/* ============================================================================
   admin-panel.js — GameZone ERP: Ana Admin Paneli v2.0
   window.AP objesini kurar → giris.js ve admin-yonetim.js bu objeyi bekler
   ============================================================================ */
'use strict';

(function () {

  /* ──────────────────────────────────────────────────────────────────────
     YARDIMCI FONKSİYONLAR
  ────────────────────────────────────────────────────────────────────── */
  function dbGet(p) { return window.db.ref(p).once('value').then(s => s.val()); }
  function dbSet(p, v) { return window.db.ref(p).set(v); }
  function dbUpd(p, o) { return window.db.ref(p).update(o); }
  function dbPush(p, v) { return window.db.ref(p).push(v); }
  function body() { return document.getElementById('adminScreenBody'); }
  function fmt(n) { return (typeof cashFmt === 'function') ? cashFmt(n) : (Number(n) || 0).toLocaleString('tr-TR') + ' ₺'; }
  function ts(t) { return t ? new Date(t).toLocaleString('tr-TR') : '-'; }
  function esc(s) { return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  function card(title, value, sub, color) {
    return `<div style="background:#0d1a2e;border:1px solid #1a2f4a;border-radius:12px;padding:18px;text-align:center">
      <div style="font-size:10px;font-weight:700;letter-spacing:1px;color:#475569;margin-bottom:6px">${title}</div>
      <div style="font-size:24px;font-weight:900;color:${color || '#e2e8f0'}">${value}</div>
      ${sub ? `<div style="font-size:10px;color:#334155;margin-top:4px">${sub}</div>` : ''}
    </div>`;
  }

  function section(title, html) {
    return `<div style="padding:24px;max-width:1400px;margin:0 auto">
      <h2 style="color:#e2e8f0;margin:0 0 20px;font-size:20px;font-weight:800;padding-bottom:12px;border-bottom:1px solid #1a2f4a">${title}</h2>
      ${html}
    </div>`;
  }

  function btn(label, onclick, color, extra) {
    return `<button onclick="${onclick}" style="background:${color || '#3b82f6'};color:#fff;border:none;
      border-radius:8px;padding:10px 18px;font-weight:700;font-size:13px;cursor:pointer;${extra || ''}">${label}</button>`;
  }

  function inp(id, ph, type, val) {
    return `<input id="${id}" type="${type || 'text'}" placeholder="${ph}" value="${esc(val || '')}"
      style="flex:1;padding:10px 12px;background:#080d1a;border:1px solid #1a2f4a;
      border-radius:8px;color:#e2e8f0;font-size:13px;box-sizing:border-box">`;
  }

  function loading(msg) {
    if (body()) body().innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:60vh;gap:16px">
      <div style="width:40px;height:40px;border:4px solid #1a2f4a;border-top-color:#3b82f6;border-radius:50%;animation:spin 1s linear infinite"></div>
      <div style="color:#64748b;font-size:14px">${msg || 'Yükleniyor...'}</div>
    </div>
    <style>@keyframes spin{to{transform:rotate(360deg)}}</style>`;
  }

  function grid3(items) { return `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;margin-bottom:20px">${items.join('')}</div>`; }

  /* ──────────────────────────────────────────────────────────────────────
     NAV DURUMU
  ────────────────────────────────────────────────────────────────────── */
  let _activeSection = 'dashboard';

  /* ──────────────────────────────────────────────────────────────────────
     DASHBOARD
  ────────────────────────────────────────────────────────────────────── */
  async function renderDashboard() {
    loading('Dashboard yükleniyor...');
    try {
      const [users, systemData, borsaData, bankData] = await Promise.all([
        dbGet('users'),
        dbGet('system'),
        dbGet('borsa'),
        dbGet('bank')
      ]);

      const userList = users ? Object.entries(users) : [];
      const totalUsers = userList.length;
      const onlineUsers = userList.filter(([,u]) => u?.online).length;
      const bannedUsers = userList.filter(([,u]) => u?.banned).length;
      const totalMoney = userList.reduce((s, [,u]) => s + (u?.money || 0), 0);
      const inflation = systemData?.inflation || 0;
      const repoRate = bankData?.repoRate || 0;

      // Son 10 işlem
      const txSnap = await window.db.ref('txlog').orderByChild('ts').limitToLast(10).once('value');
      const txs = [];
      txSnap.forEach(c => txs.unshift({ ...c.val(), key: c.key }));

      body().innerHTML = section('📊 Admin Dashboard', `
        ${grid3([
          card('TOPLAM KULLANICI', totalUsers, null, '#60a5fa'),
          card('ÇEVRİMİÇİ', onlineUsers, null, '#22c55e'),
          card('BANLI', bannedUsers, null, '#ef4444'),
          card('SİSTEM PARASİ', fmt(totalMoney), 'tüm oyuncuların toplam parası', '#f59e0b'),
          card('ENFLASYON', '%' + (inflation * 100).toFixed(1), null, inflation > 0.3 ? '#ef4444' : '#22c55e'),
          card('REPO ORANI', '%' + ((repoRate || 0) * 100).toFixed(1), null, '#a78bfa'),
        ])}

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px">
          <!-- Hızlı Eylemler -->
          <div style="background:#0d1a2e;border:1px solid #1a2f4a;border-radius:12px;padding:20px">
            <h3 style="color:#e2e8f0;margin:0 0 14px;font-size:14px;font-weight:700">⚡ Hızlı Eylemler</h3>
            <div style="display:flex;flex-wrap:wrap;gap:8px">
              ${btn('💰 Herkese Para Ver', 'window.AP._quickMoney()', '#16a34a')}
              ${btn('📢 Duyuru Yayınla', 'window.AP.navTo(null,\"news\")', '#7c3aed')}
              ${btn('📈 Borsa Güncelle', 'window.AP.navTo(null,\"borsa\")', '#0891b2')}
              ${btn('🏦 Repo Oranı Ayarla', 'window.AP.navTo(null,\"merkez\")', '#ea580c')}
              ${btn('👥 Kullanıcılar', 'window.AP.navTo(null,\"users\")', '#334155')}
              ${btn('🔄 Dashboard Yenile', 'window.AP.renderDashboard()', '#1e3a5f')}
            </div>
          </div>

          <!-- Son İşlemler -->
          <div style="background:#0d1a2e;border:1px solid #1a2f4a;border-radius:12px;padding:20px">
            <h3 style="color:#e2e8f0;margin:0 0 14px;font-size:14px;font-weight:700">🔍 Son İşlemler</h3>
            <div style="max-height:200px;overflow-y:auto">
              ${txs.length ? txs.map(tx => `
                <div style="border-bottom:1px solid #1a2f4a;padding:8px 0;font-size:11px;display:flex;justify-content:space-between;gap:8px">
                  <span style="color:#94a3b8">${esc(tx.desc || tx.type || '?')}</span>
                  <span style="color:${(tx.amount||0) >= 0 ? '#22c55e' : '#ef4444'};font-weight:700;white-space:nowrap">${fmt(tx.amount || 0)}</span>
                </div>`).join('') : '<div style="color:#334155;font-size:12px">İşlem yok</div>'}
            </div>
          </div>
        </div>

        <!-- Kullanıcı Listesi Özeti -->
        <div style="background:#0d1a2e;border:1px solid #1a2f4a;border-radius:12px;padding:20px">
          <h3 style="color:#e2e8f0;margin:0 0 14px;font-size:14px;font-weight:700">👥 Aktif Kullanıcılar (İlk 20)</h3>
          <div style="overflow-x:auto">
            <table style="width:100%;border-collapse:collapse;font-size:12px">
              <thead><tr style="color:#475569;border-bottom:1px solid #1a2f4a">
                <th style="text-align:left;padding:8px">Kullanıcı</th>
                <th style="text-align:right;padding:8px">Seviye</th>
                <th style="text-align:right;padding:8px">Para</th>
                <th style="text-align:center;padding:8px">Durum</th>
                <th style="text-align:center;padding:8px">İşlem</th>
              </tr></thead>
              <tbody>
                ${userList.slice(0, 20).map(([uid, u]) => `
                  <tr style="border-bottom:1px solid #0d1a2e;color:#94a3b8">
                    <td style="padding:8px"><span style="color:#e2e8f0;font-weight:600">${esc(u?.username || uid.slice(0, 8))}</span></td>
                    <td style="padding:8px;text-align:right">Lv${u?.level || 1}</td>
                    <td style="padding:8px;text-align:right;color:#f59e0b">${fmt(u?.money || 0)}</td>
                    <td style="padding:8px;text-align:center">
                      <span style="color:${u?.banned ? '#ef4444' : (u?.online ? '#22c55e' : '#475569')}">
                        ${u?.banned ? '🚫 Banlı' : (u?.online ? '🟢 Çevrimiçi' : '⚫ Çevrimdışı')}
                      </span>
                    </td>
                    <td style="padding:8px;text-align:center">
                      <button onclick="window.AP._viewUser('${uid}')" style="background:#1e3a5f;color:#60a5fa;border:none;border-radius:6px;padding:4px 10px;font-size:11px;cursor:pointer">Detay</button>
                      ${u?.banned
                        ? `<button onclick="window.AP._unbanUser('${uid}')" style="background:#16a34a22;color:#22c55e;border:1px solid #16a34a;border-radius:6px;padding:4px 10px;font-size:11px;cursor:pointer;margin-left:4px">Bansız</button>`
                        : `<button onclick="window.AP._banUser('${uid}')" style="background:#ef444422;color:#ef4444;border:1px solid #ef4444;border-radius:6px;padding:4px 10px;font-size:11px;cursor:pointer;margin-left:4px">Ban</button>`
                      }
                    </td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `);
    } catch (e) {
      body().innerHTML = `<div style="padding:24px;color:#ef4444">Dashboard yükleme hatası: ${esc(e.message)}</div>`;
    }
  }

  /* ──────────────────────────────────────────────────────────────────────
     KULLANICI YÖNETİMİ
  ────────────────────────────────────────────────────────────────────── */
  async function renderUsers(search) {
    loading('Kullanıcılar yükleniyor...');
    try {
      const users = await dbGet('users');
      const list = users ? Object.entries(users) : [];
      const filtered = search
        ? list.filter(([, u]) => (u?.username || '').toLowerCase().includes(search.toLowerCase()))
        : list;

      body().innerHTML = section('👥 Kullanıcı Yönetimi', `
        <div style="display:flex;gap:10px;margin-bottom:16px">
          ${inp('userSearch', '🔍 Kullanıcı adı ara...', 'text', search)}
          ${btn('Ara', 'window.AP._searchUsers()', '#3b82f6')}
          ${btn('Tüm Kullanıcılar', 'window.AP._searchUsers(\"\")', '#334155')}
        </div>
        <div style="background:#0d1a2e;border:1px solid #1a2f4a;border-radius:12px;overflow:hidden">
          <table style="width:100%;border-collapse:collapse;font-size:12px">
            <thead><tr style="background:#080d1a;color:#475569;border-bottom:1px solid #1a2f4a">
              <th style="text-align:left;padding:12px">Kullanıcı</th>
              <th style="text-align:left;padding:12px">E-posta</th>
              <th style="text-align:right;padding:12px">Lv</th>
              <th style="text-align:right;padding:12px">Para</th>
              <th style="text-align:right;padding:12px">Elmas</th>
              <th style="text-align:center;padding:12px">Rol</th>
              <th style="text-align:center;padding:12px">Durum</th>
              <th style="text-align:center;padding:12px">İşlemler</th>
            </tr></thead>
            <tbody>
              ${filtered.slice(0, 50).map(([uid, u]) => `
                <tr style="border-bottom:1px solid #0d1a2e;color:#94a3b8;transition:.15s" onmouseover="this.style.background='rgba(255,255,255,.03)'" onmouseout="this.style.background=''">
                  <td style="padding:12px"><span style="color:#e2e8f0;font-weight:600">${esc(u?.username || '-')}</span><br><span style="font-size:10px;color:#334155">${uid.slice(0, 12)}...</span></td>
                  <td style="padding:12px">${esc(u?.email || (u?.isAnonymous ? '🛡️ Anonim' : '-'))}</td>
                  <td style="padding:12px;text-align:right;color:#a78bfa">Lv${u?.level || 1}</td>
                  <td style="padding:12px;text-align:right;color:#f59e0b">${fmt(u?.money || 0)}</td>
                  <td style="padding:12px;text-align:right;color:#22c55e">${(u?.diamonds || 0)} 💎</td>
                  <td style="padding:12px;text-align:center">
                    <select onchange="window.AP._setUserRole('${uid}',this.value)" style="background:#080d1a;border:1px solid #1a2f4a;color:#94a3b8;border-radius:6px;padding:3px 6px;font-size:11px">
                      ${['vatandas','esnaf','banker','police','soldier','judge','muhtar','mayor','mp','pm','president'].map(r =>
                        `<option value="${r}" ${(u?.role || 'vatandas') === r ? 'selected' : ''}>${r}</option>`
                      ).join('')}
                    </select>
                  </td>
                  <td style="padding:12px;text-align:center">
                    <span style="color:${u?.banned ? '#ef4444' : (u?.online ? '#22c55e' : '#475569')}">
                      ${u?.banned ? '🚫' : (u?.online ? '🟢' : '⚫')}
                    </span>
                  </td>
                  <td style="padding:12px;text-align:center">
                    <div style="display:flex;gap:4px;justify-content:center;flex-wrap:wrap">
                      <button onclick="window.AP._viewUser('${uid}')" style="background:#1e3a5f;color:#60a5fa;border:none;border-radius:6px;padding:4px 8px;font-size:11px;cursor:pointer">👁</button>
                      <button onclick="window.AP._editMoneyUser('${uid}','${esc(u?.username || uid)}')" style="background:#16a34a22;color:#22c55e;border:1px solid #16a34a33;border-radius:6px;padding:4px 8px;font-size:11px;cursor:pointer">💰</button>
                      <button onclick="window.AP._editDiamondsUser('${uid}','${esc(u?.username || uid)}')" style="background:#7c3aed22;color:#a78bfa;border:1px solid #7c3aed33;border-radius:6px;padding:4px 8px;font-size:11px;cursor:pointer">💎</button>
                      ${u?.banned
                        ? `<button onclick="window.AP._unbanUser('${uid}')" style="background:#16a34a22;color:#22c55e;border:1px solid #16a34a;border-radius:6px;padding:4px 8px;font-size:11px;cursor:pointer">✅</button>`
                        : `<button onclick="window.AP._banUser('${uid}')" style="background:#ef444422;color:#ef4444;border:1px solid #ef4444;border-radius:6px;padding:4px 8px;font-size:11px;cursor:pointer">🚫</button>`
                      }
                    </div>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
          ${filtered.length > 50 ? `<div style="padding:12px;text-align:center;color:#475569;font-size:12px">Toplam ${filtered.length} kullanıcıdan ilk 50 gösteriliyor. Aramayı daraltın.</div>` : ''}
        </div>
      `);
    } catch (e) {
      body().innerHTML = `<div style="padding:24px;color:#ef4444">Hata: ${esc(e.message)}</div>`;
    }
  }

  /* ──────────────────────────────────────────────────────────────────────
     EKONOMİ KONTROL
  ────────────────────────────────────────────────────────────────────── */
  async function renderEconomy() {
    loading('Ekonomi yükleniyor...');
    try {
      const [sys, bank, stockPrices] = await Promise.all([
        dbGet('system'),
        dbGet('bank'),
        dbGet('borsaFiyatlar')
      ]);

      const inflation = sys?.inflation || 0;
      const taxRate = sys?.taxRate || 0.15;
      const vatRate = sys?.vatRate || 0.18;

      body().innerHTML = section('💰 Ekonomi Kontrol Paneli', `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
          <!-- Enflasyon & Vergi -->
          <div style="background:#0d1a2e;border:1px solid #1a2f4a;border-radius:12px;padding:20px">
            <h3 style="color:#e2e8f0;margin:0 0 16px;font-size:15px;font-weight:700">📊 Makro Göstergeler</h3>
            <div style="display:flex;flex-direction:column;gap:12px">
              <div>
                <label style="color:#94a3b8;font-size:12px">Enflasyon Oranı: <b style="color:#f59e0b">%${(inflation * 100).toFixed(1)}</b></label>
                <div style="display:flex;gap:8px;margin-top:6px">
                  ${inp('newInflation', 'Yeni enflasyon (0-2 arası, örn: 0.45)', 'number', (inflation || 0).toString())}
                  ${btn('Güncelle', 'window.AP._setInflation()', '#ea580c')}
                </div>
                <div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap">
                  ${btn('-0.05', 'window.AP._adjInflation(-0.05)', '#16a34a', 'font-size:11px;padding:5px 10px')}
                  ${btn('+0.05', 'window.AP._adjInflation(0.05)', '#ef4444', 'font-size:11px;padding:5px 10px')}
                  ${btn('Sıfırla (0)', 'window.AP._adjInflation(null)', '#475569', 'font-size:11px;padding:5px 10px')}
                </div>
              </div>
              <div>
                <label style="color:#94a3b8;font-size:12px">Gelir Vergisi: <b style="color:#f59e0b">%${(taxRate * 100).toFixed(1)}</b></label>
                <div style="display:flex;gap:8px;margin-top:6px">
                  ${inp('newTaxRate', '0.05 - 0.45 arası', 'number', taxRate.toString())}
                  ${btn('Güncelle', 'window.AP._setTaxRate()', '#7c3aed')}
                </div>
              </div>
              <div>
                <label style="color:#94a3b8;font-size:12px">KDV: <b style="color:#f59e0b">%${(vatRate * 100).toFixed(1)}</b></label>
                <div style="display:flex;gap:8px;margin-top:6px">
                  ${inp('newVatRate', '0.08 - 0.30 arası', 'number', vatRate.toString())}
                  ${btn('Güncelle', 'window.AP._setVatRate()', '#0891b2')}
                </div>
              </div>
            </div>
          </div>

          <!-- Para Arzı -->
          <div style="background:#0d1a2e;border:1px solid #1a2f4a;border-radius:12px;padding:20px">
            <h3 style="color:#e2e8f0;margin:0 0 16px;font-size:15px;font-weight:700">💸 Para Arzı Yönetimi</h3>
            <div style="display:flex;flex-direction:column;gap:12px">
              <div>
                <label style="color:#94a3b8;font-size:12px;display:block;margin-bottom:6px">Herkese Para Dağıt (toplam bütçe)</label>
                <div style="display:flex;gap:8px">
                  ${inp('massGiveAmount', 'Miktar (₺)', 'number', '')}
                  ${btn('💰 Dağıt', 'window.AP._massGiveMoney()', '#16a34a')}
                </div>
              </div>
              <div>
                <label style="color:#94a3b8;font-size:12px;display:block;margin-bottom:6px">Başlangıç Parası</label>
                <div style="display:flex;gap:8px">
                  ${inp('startingMoney', 'Yeni başlangıç (₺)', 'number', (window.GZ_STARTING_MONEY || 25000).toString())}
                  ${btn('Kaydet', 'window.AP._setStartingMoney()', '#7c3aed')}
                </div>
              </div>
              <div>
                <label style="color:#94a3b8;font-size:12px;display:block;margin-bottom:6px">Bakım Modu</label>
                <div style="display:flex;gap:8px">
                  ${btn('🔧 Bakım Modunu Aç', 'window.AP._setMaintenance(true)', '#ea580c')}
                  ${btn('✅ Bakım Modunu Kapat', 'window.AP._setMaintenance(false)', '#16a34a')}
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Elmas Mağazası Fiyatları -->
        <div style="background:#0d1a2e;border:1px solid #1a2f4a;border-radius:12px;padding:20px;margin-bottom:16px">
          <h3 style="color:#e2e8f0;margin:0 0 16px;font-size:15px;font-weight:700">💎 Elmas Mağazası Fiyatları</h3>
          <div id="elmasConfigArea">Yükleniyor...</div>
          <button onclick="window.AP._loadElmasFiyatlari()" style="background:#7c3aed;color:#fff;border:none;border-radius:8px;padding:8px 16px;font-size:13px;cursor:pointer;margin-top:8px">🔄 Fiyatları Yükle</button>
        </div>

        <!-- Dünya Olayları -->
        <div style="background:#0d1a2e;border:1px solid #1a2f4a;border-radius:12px;padding:20px">
          <h3 style="color:#e2e8f0;margin:0 0 16px;font-size:15px;font-weight:700">🌍 Ekonomik Olay Tetikle</h3>
          <div style="display:flex;flex-wrap:wrap;gap:8px">
            ${btn('📈 Ekonomik Boom (+%20 gelir)', 'window.AP._triggerEvent(\"boom\")', '#16a34a')}
            ${btn('📉 Ekonomik Kriz (-%20 değer)', 'window.AP._triggerEvent(\"crisis\")', '#ef4444')}
            ${btn('🌾 Hasat Bolluğu', 'window.AP._triggerEvent(\"harvest\")', '#ca8a04')}
            ${btn('🏭 Sanayi Patlaması', 'window.AP._triggerEvent(\"industrial\")', '#0891b2')}
            ${btn('💱 Döviz Krizi', 'window.AP._triggerEvent(\"forex\")', '#7c3aed')}
            ${btn('🔥 Enflasyon Atağı', 'window.AP._triggerEvent(\"inflation_spike\")', '#ea580c')}
          </div>
        </div>
      `);

      // Elmas fiyatlarını yükle
      window.AP._loadElmasFiyatlari();
    } catch (e) {
      body().innerHTML = `<div style="padding:24px;color:#ef4444">Hata: ${esc(e.message)}</div>`;
    }
  }

  /* ──────────────────────────────────────────────────────────────────────
     KREDİ BAŞVURULARI
  ────────────────────────────────────────────────────────────────────── */
  async function renderKrediOnay() {
    loading('Kredi başvuruları yükleniyor...');
    try {
      const apps = await dbGet('krediBasvurulari');
      const list = apps ? Object.entries(apps).filter(([, a]) => a?.status === 'pending') : [];

      // Badge güncelle
      const badge = document.getElementById('krediOnayBadge');
      if (badge) { badge.hidden = list.length === 0; badge.textContent = list.length || ''; }

      body().innerHTML = section('💳 Kredi Başvuruları', `
        <div style="margin-bottom:16px;display:flex;gap:10px;align-items:center">
          <span style="color:#94a3b8;font-size:13px">Bekleyen: <b style="color:#f59e0b">${list.length}</b> başvuru</span>
          ${btn('🔄 Yenile', 'window.AP.navTo(null,\"krediOnay\")', '#334155', 'font-size:11px;padding:6px 12px')}
        </div>
        ${list.length === 0 ? '<div style="text-align:center;color:#475569;padding:40px;background:#0d1a2e;border-radius:12px;border:1px solid #1a2f4a">✅ Bekleyen kredi başvurusu yok</div>' : ''}
        ${list.map(([key, a]) => `
          <div style="background:#0d1a2e;border:1px solid #1a2f4a;border-radius:12px;padding:18px;margin-bottom:12px">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px">
              <div>
                <div style="font-size:15px;font-weight:700;color:#e2e8f0;margin-bottom:6px">${esc(a.username || a.uid?.slice(0, 8))} — ${esc(a.type || 'Kredi')}</div>
                <div style="font-size:12px;color:#94a3b8;display:flex;flex-wrap:wrap;gap:16px">
                  <span>💰 Tutar: <b style="color:#f59e0b">${fmt(a.amount || 0)}</b></span>
                  <span>📅 Vade: <b style="color:#60a5fa">${a.term || '-'} ay</b></span>
                  <span>📊 Skor: <b style="color:#a78bfa">${a.creditScore || '-'}</b></span>
                  <span>🕐 Tarih: ${ts(a.appliedAt)}</span>
                </div>
                ${a.note ? `<div style="margin-top:8px;font-size:11px;color:#64748b;background:#080d1a;padding:8px;border-radius:6px">"${esc(a.note)}"</div>` : ''}
              </div>
              <div style="display:flex;gap:8px">
                ${btn('✅ Onayla', `window.AP._krediOnayla('${key}','${a.uid}',${a.amount || 0})`, '#16a34a')}
                ${btn('❌ Reddet', `window.AP._krediReddet('${key}','${a.uid}')`, '#ef4444')}
              </div>
            </div>
          </div>`).join('')}
      `);
    } catch (e) {
      body().innerHTML = `<div style="padding:24px;color:#ef4444">Hata: ${esc(e.message)}</div>`;
    }
  }

  /* ──────────────────────────────────────────────────────────────────────
     VERGİ & FAİZ
  ────────────────────────────────────────────────────────────────────── */
  async function renderVergi() {
    loading('Vergi paneli yükleniyor...');
    try {
      const sys = await dbGet('system');
      const taxRate = sys?.taxRate || 0.15;
      const vatRate = sys?.vatRate || 0.18;
      const corporateTax = sys?.corporateTax || 0.22;
      const interestRate = sys?.interestRate || 0.30;
      const penaltyRate = sys?.penaltyRate || 0.05;
      const graceDays = sys?.taxGraceDays || 7;

      // Vergi borçları
      const users = await dbGet('users');
      const debtors = users ? Object.entries(users).filter(([, u]) => (u?.taxDebt || 0) > 0) : [];

      body().innerHTML = section('🏛️ Vergi & Faiz Yönetimi', `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
          <div style="background:#0d1a2e;border:1px solid #1a2f4a;border-radius:12px;padding:20px">
            <h3 style="color:#e2e8f0;margin:0 0 16px;font-size:15px;font-weight:700">⚙️ Vergi Oranları</h3>
            <div style="display:flex;flex-direction:column;gap:10px">
              <div>
                <label style="color:#94a3b8;font-size:12px">Gelir Vergisi: <b style="color:#f59e0b">%${(taxRate*100).toFixed(0)}</b></label>
                <div style="display:flex;gap:8px;margin-top:4px">${inp('vt_income','0.05-0.45','number',taxRate.toString())}${btn('Güncelle','window.AP._updateTax(\"taxRate\",\"vt_income\")','#3b82f6')}</div>
              </div>
              <div>
                <label style="color:#94a3b8;font-size:12px">KDV: <b style="color:#f59e0b">%${(vatRate*100).toFixed(0)}</b></label>
                <div style="display:flex;gap:8px;margin-top:4px">${inp('vt_vat','0.08-0.30','number',vatRate.toString())}${btn('Güncelle','window.AP._updateTax(\"vatRate\",\"vt_vat\")','#3b82f6')}</div>
              </div>
              <div>
                <label style="color:#94a3b8;font-size:12px">Kurumlar Vergisi: <b style="color:#f59e0b">%${(corporateTax*100).toFixed(0)}</b></label>
                <div style="display:flex;gap:8px;margin-top:4px">${inp('vt_corp','0.15-0.40','number',corporateTax.toString())}${btn('Güncelle','window.AP._updateTax(\"corporateTax\",\"vt_corp\")','#3b82f6')}</div>
              </div>
            </div>
          </div>
          <div style="background:#0d1a2e;border:1px solid #1a2f4a;border-radius:12px;padding:20px">
            <h3 style="color:#e2e8f0;margin:0 0 16px;font-size:15px;font-weight:700">💰 Faiz & Ceza</h3>
            <div style="display:flex;flex-direction:column;gap:10px">
              <div>
                <label style="color:#94a3b8;font-size:12px">Gecikme Faizi: <b style="color:#ef4444">%${(interestRate*100).toFixed(0)}</b></label>
                <div style="display:flex;gap:8px;margin-top:4px">${inp('vt_int','0.10-0.80','number',interestRate.toString())}${btn('Güncelle','window.AP._updateTax(\"interestRate\",\"vt_int\")','#ea580c')}</div>
              </div>
              <div>
                <label style="color:#94a3b8;font-size:12px">Ceza Oranı: <b style="color:#ef4444">%${(penaltyRate*100).toFixed(0)}</b></label>
                <div style="display:flex;gap:8px;margin-top:4px">${inp('vt_pen','0.01-0.30','number',penaltyRate.toString())}${btn('Güncelle','window.AP._updateTax(\"penaltyRate\",\"vt_pen\")','#ea580c')}</div>
              </div>
              <div>
                <label style="color:#94a3b8;font-size:12px">Vade (gün): <b style="color:#f59e0b">${graceDays}</b></label>
                <div style="display:flex;gap:8px;margin-top:4px">${inp('vt_grace','3-30','number',graceDays.toString())}${btn('Güncelle','window.AP._updateTax(\"taxGraceDays\",\"vt_grace\")','#7c3aed')}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Vergi Borçluları -->
        <div style="background:#0d1a2e;border:1px solid #1a2f4a;border-radius:12px;padding:20px">
          <h3 style="color:#e2e8f0;margin:0 0 14px;font-size:15px;font-weight:700">⚠️ Vergi Borçluları (${debtors.length})</h3>
          ${debtors.length === 0 ? '<div style="color:#475569;font-size:13px">Vergi borcu olan kullanıcı yok ✅</div>' : ''}
          ${debtors.map(([uid, u]) => `
            <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #0d1a2e;padding:10px 0;flex-wrap:wrap;gap:8px">
              <div>
                <span style="color:#e2e8f0;font-weight:600">${esc(u.username || uid.slice(0,8))}</span>
                <span style="color:#ef4444;font-weight:700;margin-left:12px">${fmt(u.taxDebt)}</span>
                <span style="color:#475569;font-size:11px;margin-left:8px">borç</span>
              </div>
              <div style="display:flex;gap:6px">
                ${btn('💸 Zorla Tahsil', `window.AP._forceTax('${uid}',${u.taxDebt})`, '#ef4444', 'font-size:11px;padding:6px 12px')}
                ${btn('📋 Faiz Uygula', `window.AP._applyInterest('${uid}',${u.taxDebt})`, '#ea580c', 'font-size:11px;padding:6px 12px')}
                ${btn('✅ Sil (Af)', `window.AP._forgiveTax('${uid}')`, '#16a34a', 'font-size:11px;padding:6px 12px')}
              </div>
            </div>`).join('')}
        </div>
      `);
    } catch(e) { body().innerHTML = `<div style="padding:24px;color:#ef4444">Hata: ${esc(e.message)}</div>`; }
  }

  /* ──────────────────────────────────────────────────────────────────────
     MERKEZ BANKASI
  ────────────────────────────────────────────────────────────────────── */
  async function renderMerkezBankasi() {
    loading('Merkez Bankası yükleniyor...');
    try {
      const bank = await dbGet('bank');
      const repoRate = bank?.repoRate || 0.42;
      const depositRate = bank?.depositRate || 0.38;
      const loanRate = bank?.loanRate || 0.55;
      const minBalance = bank?.minBalance || 0;

      body().innerHTML = section('🏦 Merkez Bankası', `
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px;margin-bottom:16px">
          ${card('REPO ORANI', '%'+(repoRate*100).toFixed(1), null, '#f59e0b')}
          ${card('MEVDUAT ORANI', '%'+(depositRate*100).toFixed(1), null, '#22c55e')}
          ${card('KREDİ ORANI', '%'+(loanRate*100).toFixed(1), null, '#ef4444')}
          ${card('MİN. BAKİYE', fmt(minBalance), null, '#60a5fa')}
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
          <div style="background:#0d1a2e;border:1px solid #1a2f4a;border-radius:12px;padding:20px">
            <h3 style="color:#e2e8f0;margin:0 0 16px;font-size:15px;font-weight:700">📊 Faiz Oranları</h3>
            <div style="display:flex;flex-direction:column;gap:10px">
              <div>
                <label style="color:#94a3b8;font-size:12px">Repo Oranı (Para Politikası)</label>
                <div style="display:flex;gap:8px;margin-top:4px">${inp('mb_repo','0.10-2.00','number',repoRate.toString())}${btn('Güncelle','window.AP._setRepoRate()','#f59e0b')}</div>
              </div>
              <div>
                <label style="color:#94a3b8;font-size:12px">Mevduat Faizi</label>
                <div style="display:flex;gap:8px;margin-top:4px">${inp('mb_dep','0.05-1.50','number',depositRate.toString())}${btn('Güncelle','window.AP._setBankRate(\"depositRate\",\"mb_dep\")','#22c55e')}</div>
              </div>
              <div>
                <label style="color:#94a3b8;font-size:12px">Kredi Faizi</label>
                <div style="display:flex;gap:8px;margin-top:4px">${inp('mb_loan','0.15-2.00','number',loanRate.toString())}${btn('Güncelle','window.AP._setBankRate(\"loanRate\",\"mb_loan\")','#ef4444')}</div>
              </div>
            </div>
          </div>
          <div style="background:#0d1a2e;border:1px solid #1a2f4a;border-radius:12px;padding:20px">
            <h3 style="color:#e2e8f0;margin:0 0 16px;font-size:15px;font-weight:700">⚡ Hızlı Faiz Senaryoları</h3>
            <div style="display:flex;flex-direction:column;gap:8px">
              ${btn('🕊️ Faiz İndir (TCMB tarzı)', 'window.AP._rateScenario("easy")', '#16a34a')}
              ${btn('🦅 Faiz Artır (Sıkılaştırma)', 'window.AP._rateScenario("tight")', '#ef4444')}
              ${btn('⚖️ Nötr Politika', 'window.AP._rateScenario("neutral")', '#475569')}
              ${btn('💥 Kriz Modu (Acil Müdahale)', 'window.AP._rateScenario("crisis")', '#7c3aed')}
            </div>
          </div>
        </div>
      `);
    } catch(e) { body().innerHTML = `<div style="padding:24px;color:#ef4444">Hata: ${esc(e.message)}</div>`; }
  }

  /* ──────────────────────────────────────────────────────────────────────
     BORSA KONTROL
  ────────────────────────────────────────────────────────────────────── */
  async function renderBorsa() {
    loading('Borsa yükleniyor...');
    try {
      const prices = await dbGet('borsaFiyatlar') || {};

      const hisseler = ['GZGM', 'GZTK', 'GZBT', 'GZAN', 'GZIM', 'GZTA', 'GZET', 'GZFN'];
      const defaultPrices = { GZGM:120, GZTK:85, GZBT:340, GZAN:67, GZIM:210, GZTA:155, GZET:98, GZFN:280 };

      body().innerHTML = section('📈 Borsa Kontrol Paneli', `
        <div style="background:#0e1a2e;border:1px solid #1a2f4a;border-radius:12px;padding:20px;margin-bottom:16px">
          <h3 style="color:#e2e8f0;margin:0 0 16px;font-size:15px;font-weight:700">⚡ Hızlı Borsa Eylemleri</h3>
          <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px">
            ${btn('📈 Tümünü %10 Artır', 'window.AP._borsaAdj(0.10)', '#16a34a')}
            ${btn('📉 Tümünü %10 Düşür', 'window.AP._borsaAdj(-0.10)', '#ef4444')}
            ${btn('📈 Tümünü %25 Artır', 'window.AP._borsaAdj(0.25)', '#16a34a')}
            ${btn('📉 Tümünü %25 Düşür', 'window.AP._borsaAdj(-0.25)', '#ef4444')}
            ${btn('🎲 Rastgele Dalgalan', 'window.AP._borsaRandom()', '#7c3aed')}
            ${btn('🔄 Otomatik Mod Aç', 'window.AP._borsaAutoToggle(true)', '#0891b2')}
            ${btn('⏸ Otomatik Durdur', 'window.AP._borsaAutoToggle(false)', '#475569')}
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px">
          ${hisseler.map(s => {
            const p = prices[s] || defaultPrices[s] || 100;
            return `<div style="background:#0d1a2e;border:1px solid #1a2f4a;border-radius:12px;padding:16px">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
                <span style="font-weight:700;color:#e2e8f0;font-size:15px">${s}</span>
                <span style="font-size:18px;font-weight:900;color:#f59e0b">${fmt(p)}</span>
              </div>
              <div style="display:flex;gap:6px;margin-bottom:8px">
                ${btn('-20%', `window.AP._borsaHisse('${s}',-0.20)`, '#ef4444', 'font-size:11px;padding:4px 8px;flex:1')}
                ${btn('-10%', `window.AP._borsaHisse('${s}',-0.10)`, '#ef444466', 'font-size:11px;padding:4px 8px;flex:1')}
                ${btn('+10%', `window.AP._borsaHisse('${s}',0.10)`, '#16a34a66', 'font-size:11px;padding:4px 8px;flex:1')}
                ${btn('+20%', `window.AP._borsaHisse('${s}',0.20)`, '#16a34a', 'font-size:11px;padding:4px 8px;flex:1')}
              </div>
              <div style="display:flex;gap:6px">
                <input id="bp_${s}" type="number" placeholder="Manuel fiyat" value="${p}" 
                  style="flex:1;padding:6px;background:#080d1a;border:1px solid #1a2f4a;border-radius:6px;color:#e2e8f0;font-size:12px">
                ${btn('Set', `window.AP._borsaSetPrice('${s}')`, '#3b82f6', 'font-size:11px;padding:6px 10px')}
              </div>
            </div>`;
          }).join('')}
        </div>
      `);
    } catch(e) { body().innerHTML = `<div style="padding:24px;color:#ef4444">Hata: ${esc(e.message)}</div>`; }
  }

  /* ──────────────────────────────────────────────────────────────────────
     KRİPTO KONTROL
  ────────────────────────────────────────────────────────────────────── */
  async function renderKripto() {
    loading('Kripto yükleniyor...');
    try {
      const kriptoPrices = await dbGet('kriptoPrices') || {};
      const coins = ['BTC','ETH','BNB','SOL','ADA','XRP','DOGE','GZC'];
      const defaults = { BTC:2800000, ETH:175000, BNB:24000, SOL:7000, ADA:45, XRP:28, DOGE:12, GZC:150 };

      body().innerHTML = section('₿ Kripto Kontrol Paneli', `
        <div style="background:#0e1a2e;border:1px solid #1a2f4a;border-radius:12px;padding:20px;margin-bottom:16px">
          <h3 style="color:#e2e8f0;margin:0 0 14px;font-size:15px;font-weight:700">⚡ Toplu Kripto Eylemleri</h3>
          <div style="display:flex;flex-wrap:wrap;gap:8px">
            ${btn('🚀 Bull Run (+%30)', 'window.AP._kriptoAdj(0.30)', '#16a34a')}
            ${btn('💥 Çöküş (-%30)', 'window.AP._kriptoAdj(-0.30)', '#ef4444')}
            ${btn('🎲 Rastgele', 'window.AP._kriptoRandom()', '#7c3aed')}
            ${btn('🔄 Otomatik Aç', 'window.AP._kriptoAutoToggle(true)', '#0891b2')}
            ${btn('⏸ Otomatik Kapat', 'window.AP._kriptoAutoToggle(false)', '#475569')}
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px">
          ${coins.map(c => {
            const p = kriptoPrices[c] || defaults[c] || 100;
            return `<div style="background:#0d1a2e;border:1px solid #1a2f4a;border-radius:12px;padding:16px">
              <div style="display:flex;justify-content:space-between;margin-bottom:10px">
                <span style="font-weight:700;color:#e2e8f0">${c}</span>
                <span style="font-weight:900;color:#f59e0b">${fmt(p)}</span>
              </div>
              <div style="display:flex;gap:5px;margin-bottom:7px">
                ${btn('-25%',`window.AP._kriptoHisse('${c}',-0.25)`,'#ef4444','font-size:10px;padding:4px 7px;flex:1')}
                ${btn('-10%',`window.AP._kriptoHisse('${c}',-0.10)`,'#ef444466','font-size:10px;padding:4px 7px;flex:1')}
                ${btn('+10%',`window.AP._kriptoHisse('${c}',0.10)`,'#16a34a66','font-size:10px;padding:4px 7px;flex:1')}
                ${btn('+25%',`window.AP._kriptoHisse('${c}',0.25)`,'#16a34a','font-size:10px;padding:4px 7px;flex:1')}
              </div>
              <div style="display:flex;gap:6px">
                <input id="kp_${c}" type="number" placeholder="Manuel" value="${p}"
                  style="flex:1;padding:6px;background:#080d1a;border:1px solid #1a2f4a;border-radius:6px;color:#e2e8f0;font-size:12px">
                ${btn('Set',`window.AP._kriptoSetPrice('${c}')`,'#3b82f6','font-size:11px;padding:6px 10px')}
              </div>
            </div>`;
          }).join('')}
        </div>
      `);
    } catch(e) { body().innerHTML = `<div style="padding:24px;color:#ef4444">Hata: ${esc(e.message)}</div>`; }
  }

  /* ──────────────────────────────────────────────────────────────────────
     HABERLER
  ────────────────────────────────────────────────────────────────────── */
  async function renderNews() {
    loading('Haberler yükleniyor...');
    try {
      const newsSnap = await window.db.ref('news').orderByChild('ts').limitToLast(30).once('value');
      const newsList = [];
      newsSnap.forEach(c => newsList.unshift({ key: c.key, ...c.val() }));

      body().innerHTML = section('📰 Haber Yönetimi', `
        <!-- Haber Ekle -->
        <div style="background:#0d1a2e;border:1px solid #1a2f4a;border-radius:12px;padding:20px;margin-bottom:16px">
          <h3 style="color:#e2e8f0;margin:0 0 14px;font-size:15px;font-weight:700">➕ Yeni Haber Yayınla</h3>
          <div style="display:flex;flex-direction:column;gap:10px">
            <input id="newsTitle" placeholder="Haber başlığı..."
              style="padding:10px 12px;background:#080d1a;border:1px solid #1a2f4a;border-radius:8px;color:#e2e8f0;font-size:13px">
            <select id="newsType" style="padding:10px;background:#080d1a;border:1px solid #1a2f4a;border-radius:8px;color:#94a3b8;font-size:13px">
              <option value="ekonomi">💰 Ekonomi</option>
              <option value="siyasi">🏛️ Siyasi</option>
              <option value="acil">🚨 Acil</option>
              <option value="piyasa">📈 Piyasa</option>
              <option value="genel">📄 Genel</option>
            </select>
            <select id="newsImpact" style="padding:10px;background:#080d1a;border:1px solid #1a2f4a;border-radius:8px;color:#94a3b8;font-size:13px">
              <option value="positive">✅ Pozitif</option>
              <option value="negative">❌ Negatif</option>
              <option value="neutral">⚖️ Nötr</option>
            </select>
            ${btn('📰 Yayınla', 'window.AP._publishNews()', '#7c3aed', 'align-self:flex-start')}
          </div>
        </div>

        <!-- Mevcut Haberler -->
        <div style="background:#0d1a2e;border:1px solid #1a2f4a;border-radius:12px;padding:20px">
          <h3 style="color:#e2e8f0;margin:0 0 14px;font-size:15px;font-weight:700">📋 Son Haberler</h3>
          ${newsList.length === 0 ? '<div style="color:#475569">Henüz haber yok.</div>' : ''}
          ${newsList.map(n => `
            <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #0d1a2e;padding:10px 0;gap:12px;flex-wrap:wrap">
              <div>
                <span style="color:#e2e8f0;font-size:13px">${esc(n.title || '-')}</span>
                <span style="color:#475569;font-size:11px;margin-left:8px">${esc(n.type || '')} • ${ts(n.ts)}</span>
              </div>
              <button onclick="window.AP._deleteNews('${n.key}')" style="background:#ef444422;color:#ef4444;border:1px solid #ef4444;border-radius:6px;padding:4px 10px;font-size:11px;cursor:pointer">Sil</button>
            </div>`).join('')}
        </div>
      `);
    } catch(e) { body().innerHTML = `<div style="padding:24px;color:#ef4444">Hata: ${esc(e.message)}</div>`; }
  }

  /* ──────────────────────────────────────────────────────────────────────
     GÜVENLİK
  ────────────────────────────────────────────────────────────────────── */
  async function renderSecurity() {
    loading('Güvenlik yükleniyor...');
    try {
      const [alerts, logins] = await Promise.all([
        dbGet('security/alerts'),
        window.db.ref('security/logins').orderByChild('ts').limitToLast(20).once('value').then(s => {
          const r = []; s.forEach(c => r.unshift(c.val())); return r;
        })
      ]);

      const alertList = alerts ? Object.entries(alerts).flatMap(([uid, a]) =>
        Object.entries(a || {}).map(([k, v]) => ({ uid, key: k, ...v }))
      ).filter(a => !a.handled).slice(0, 20) : [];

      body().innerHTML = section('🛡️ Güvenlik Merkezi', `
        ${grid3([
          card('AKTİF UYARILAR', alertList.length, null, alertList.length > 0 ? '#ef4444' : '#22c55e'),
          card('SON GİRİŞLER', logins.length, 'son 20 giriş', '#60a5fa'),
        ])}

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
          <div style="background:#0d1a2e;border:1px solid #1a2f4a;border-radius:12px;padding:20px">
            <h3 style="color:#e2e8f0;margin:0 0 14px;font-size:15px;font-weight:700">⚠️ Güvenlik Uyarıları</h3>
            ${alertList.length === 0 ? '<div style="color:#475569;font-size:12px">Aktif uyarı yok ✅</div>' : ''}
            ${alertList.map(a => `
              <div style="border:1px solid #ef444433;border-radius:8px;padding:12px;margin-bottom:8px;background:#ef444411">
                <div style="color:#ef4444;font-weight:600;font-size:12px">${esc(a.type || 'Uyarı')}</div>
                <div style="color:#94a3b8;font-size:11px;margin-top:4px">${esc(a.label || '')} • ${ts(a.ts)}</div>
                <button onclick="window.AP._resolveAlert('${a.uid}','${a.key}')" style="background:#ef444422;color:#ef4444;border:1px solid #ef4444;border-radius:5px;padding:3px 8px;font-size:10px;cursor:pointer;margin-top:6px">Çözüldü</button>
              </div>`).join('')}
          </div>
          <div style="background:#0d1a2e;border:1px solid #1a2f4a;border-radius:12px;padding:20px">
            <h3 style="color:#e2e8f0;margin:0 0 14px;font-size:15px;font-weight:700">🔐 Son Girişler</h3>
            ${logins.map(l => `
              <div style="border-bottom:1px solid #0d1a2e;padding:8px 0;font-size:11px">
                <div style="color:#94a3b8">${esc(l.label || 'Bilinmeyen')} ${l.isNewDevice ? '<span style="color:#f59e0b">🆕 Yeni Cihaz</span>' : ''}</div>
                <div style="color:#475569">${ts(l.ts)} • ${esc(l.tz || '')}</div>
              </div>`).join('')}
          </div>
        </div>
      `);
    } catch(e) { body().innerHTML = `<div style="padding:24px;color:#ef4444">Hata: ${esc(e.message)}</div>`; }
  }

  /* ──────────────────────────────────────────────────────────────────────
     SİSTEM AYARLARI
  ────────────────────────────────────────────────────────────────────── */
  async function renderSystem() {
    loading('Sistem ayarları yükleniyor...');
    try {
      const sys = await dbGet('system');
      const maintenance = sys?.maintenance?.active || false;
      const idCardFee = sys?.idCardFee || 500;
      const driverFee = sys?.driverLicenseFee || 1200;
      const passportFee = sys?.passportFee || 3500;
      const minWage = sys?.minWage || 17000;

      body().innerHTML = section('⚙️ Sistem Ayarları', `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
          <!-- Bakım & Versiyon -->
          <div style="background:#0d1a2e;border:1px solid #1a2f4a;border-radius:12px;padding:20px">
            <h3 style="color:#e2e8f0;margin:0 0 14px;font-size:15px;font-weight:700">🔧 Bakım & Versiyon</h3>
            <div style="display:flex;flex-direction:column;gap:10px">
              <div style="display:flex;align-items:center;gap:10px">
                <span style="color:#94a3b8;font-size:13px">Bakım Modu:</span>
                <span style="color:${maintenance ? '#ef4444' : '#22c55e'};font-weight:700">${maintenance ? '🔧 Aktif' : '✅ Kapalı'}</span>
              </div>
              ${btn(maintenance ? '✅ Bakım Modunu Kapat' : '🔧 Bakım Modunu Aç',
                `window.AP._setMaintenance(${!maintenance})`,
                maintenance ? '#16a34a' : '#ea580c')}
              <div style="margin-top:8px">
                <label style="color:#94a3b8;font-size:12px;display:block;margin-bottom:6px">Yeni Versiyon Yayınla</label>
                <div style="display:flex;gap:8px">
                  ${inp('sysVersion','3.0.20260503','text','')}
                  ${btn('Yayınla','window.AP._publishVersion()','#7c3aed')}
                </div>
              </div>
            </div>
          </div>

          <!-- Muhtarlık/Belediye Ücretleri -->
          <div style="background:#0d1a2e;border:1px solid #1a2f4a;border-radius:12px;padding:20px">
            <h3 style="color:#e2e8f0;margin:0 0 14px;font-size:15px;font-weight:700">🏛️ Devlet Hizmet Ücretleri</h3>
            <div style="display:flex;flex-direction:column;gap:10px">
              <div>
                <label style="color:#94a3b8;font-size:12px">Kimlik Kartı Ücreti: <b style="color:#f59e0b">${fmt(idCardFee)}</b></label>
                <div style="display:flex;gap:8px;margin-top:4px">${inp('sys_idCard','₺','number',idCardFee.toString())}${btn('Güncelle','window.AP._updateSys(\"idCardFee\",\"sys_idCard\")','#3b82f6')}</div>
              </div>
              <div>
                <label style="color:#94a3b8;font-size:12px">Ehliyet Ücreti: <b style="color:#f59e0b">${fmt(driverFee)}</b></label>
                <div style="display:flex;gap:8px;margin-top:4px">${inp('sys_driver','₺','number',driverFee.toString())}${btn('Güncelle','window.AP._updateSys(\"driverLicenseFee\",\"sys_driver\")','#3b82f6')}</div>
              </div>
              <div>
                <label style="color:#94a3b8;font-size:12px">Pasaport Ücreti: <b style="color:#f59e0b">${fmt(passportFee)}</b></label>
                <div style="display:flex;gap:8px;margin-top:4px">${inp('sys_passport','₺','number',passportFee.toString())}${btn('Güncelle','window.AP._updateSys(\"passportFee\",\"sys_passport\")','#3b82f6')}</div>
              </div>
              <div>
                <label style="color:#94a3b8;font-size:12px">Asgari Ücret: <b style="color:#f59e0b">${fmt(minWage)}</b></label>
                <div style="display:flex;gap:8px;margin-top:4px">${inp('sys_minWage','₺','number',minWage.toString())}${btn('Güncelle','window.AP._updateSys(\"minWage\",\"sys_minWage\")','#16a34a')}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Tehlikeli Eylemler -->
        <div style="background:#0d1a2e;border:1px solid #ef444433;border-radius:12px;padding:20px">
          <h3 style="color:#ef4444;margin:0 0 14px;font-size:15px;font-weight:700">⚠️ Tehlikeli Eylemler</h3>
          <div style="display:flex;flex-wrap:wrap;gap:8px">
            ${btn('🗑️ Tüm Sohbeti Temizle', 'window.AP._clearChat()', '#ef4444')}
            ${btn('📊 Borsa Sıfırla', 'window.AP._resetBorsa()', '#ea580c')}
            ${btn('₿ Kripto Sıfırla', 'window.AP._resetKripto()', '#ea580c')}
          </div>
        </div>
      `);
    } catch(e) { body().innerHTML = `<div style="padding:24px;color:#ef4444">Hata: ${esc(e.message)}</div>`; }
  }

  /* ──────────────────────────────────────────────────────────────────────
     ANALİTİK
  ────────────────────────────────────────────────────────────────────── */
  async function renderAnalytics() {
    loading('Analitik yükleniyor...');
    try {
      const users = await dbGet('users');
      const list = users ? Object.values(users) : [];

      const byLevel = {};
      const byProvince = {};
      let totalMoney = 0, totalDiamonds = 0;

      list.forEach(u => {
        const lv = u?.level || 1;
        byLevel[lv] = (byLevel[lv] || 0) + 1;
        const prov = u?.province || 'Bilinmeyen';
        byProvince[prov] = (byProvince[prov] || 0) + 1;
        totalMoney += u?.money || 0;
        totalDiamonds += u?.diamonds || 0;
      });

      const topUsers = list.sort((a, b) => (b?.money || 0) - (a?.money || 0)).slice(0, 10);
      const topProvs = Object.entries(byProvince).sort((a, b) => b[1] - a[1]).slice(0, 10);

      body().innerHTML = section('📈 Analitik & İstatistik', `
        ${grid3([
          card('TOPLAM KULLANICI', list.length, null, '#60a5fa'),
          card('TOPLAM PARA', fmt(totalMoney), 'tüm oyuncular', '#f59e0b'),
          card('TOPLAM ELMAS', totalDiamonds + ' 💎', null, '#a78bfa'),
          card('ORT. SEVİYE', (list.reduce((s,u)=>s+(u?.level||1),0)/Math.max(1,list.length)).toFixed(1), null, '#22c55e'),
        ])}

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
          <!-- En Zengin -->
          <div style="background:#0d1a2e;border:1px solid #1a2f4a;border-radius:12px;padding:20px">
            <h3 style="color:#e2e8f0;margin:0 0 14px;font-size:15px;font-weight:700">💰 En Zengin Oyuncular</h3>
            ${topUsers.map((u, i) => `
              <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #0d1a2e;font-size:12px">
                <span style="color:#94a3b8">#${i+1} <span style="color:#e2e8f0">${esc(u.username || '-')}</span></span>
                <span style="color:#f59e0b;font-weight:700">${fmt(u.money || 0)}</span>
              </div>`).join('')}
          </div>

          <!-- İllere Göre -->
          <div style="background:#0d1a2e;border:1px solid #1a2f4a;border-radius:12px;padding:20px">
            <h3 style="color:#e2e8f0;margin:0 0 14px;font-size:15px;font-weight:700">🗺️ İllere Göre Dağılım</h3>
            ${topProvs.map(([prov, count]) => `
              <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #0d1a2e;font-size:12px">
                <span style="color:#94a3b8">${esc(prov)}</span>
                <span style="color:#60a5fa;font-weight:700">${count} oyuncu</span>
              </div>`).join('')}
          </div>
        </div>
      `);
    } catch(e) { body().innerHTML = `<div style="padding:24px;color:#ef4444">Hata: ${esc(e.message)}</div>`; }
  }

  /* ──────────────────────────────────────────────────────────────────────
     ETKİNLİK YÖNETİMİ
  ────────────────────────────────────────────────────────────────────── */
  async function renderEvents() {
    loading('Etkinlikler yükleniyor...');
    try {
      const evSnap = await window.db.ref('events').orderByChild('ts').limitToLast(20).once('value');
      const evList = [];
      evSnap.forEach(c => evList.unshift({ key: c.key, ...c.val() }));

      body().innerHTML = section('⚡ Etkinlik Yönetimi', `
        <div style="background:#0d1a2e;border:1px solid #1a2f4a;border-radius:12px;padding:20px;margin-bottom:16px">
          <h3 style="color:#e2e8f0;margin:0 0 14px;font-size:15px;font-weight:700">➕ Yeni Etkinlik</h3>
          <div style="display:flex;flex-direction:column;gap:10px">
            <input id="evTitle" placeholder="Etkinlik adı..."
              style="padding:10px;background:#080d1a;border:1px solid #1a2f4a;border-radius:8px;color:#e2e8f0;font-size:13px">
            <input id="evDesc" placeholder="Açıklama..."
              style="padding:10px;background:#080d1a;border:1px solid #1a2f4a;border-radius:8px;color:#e2e8f0;font-size:13px">
            <div style="display:flex;gap:10px">
              <input id="evReward" type="number" placeholder="Ödül (₺)" 
                style="flex:1;padding:10px;background:#080d1a;border:1px solid #1a2f4a;border-radius:8px;color:#e2e8f0;font-size:13px">
              <input id="evDuration" type="number" placeholder="Süre (saat)"
                style="flex:1;padding:10px;background:#080d1a;border:1px solid #1a2f4a;border-radius:8px;color:#e2e8f0;font-size:13px" value="24">
            </div>
            ${btn('⚡ Etkinlik Başlat', 'window.AP._createEvent()', '#7c3aed')}
          </div>
        </div>

        <div style="background:#0d1a2e;border:1px solid #1a2f4a;border-radius:12px;padding:20px">
          <h3 style="color:#e2e8f0;margin:0 0 14px;font-size:15px;font-weight:700">📋 Aktif & Son Etkinlikler</h3>
          ${evList.length === 0 ? '<div style="color:#475569">Etkinlik yok.</div>' : ''}
          ${evList.map(ev => `
            <div style="border:1px solid #1a2f4a;border-radius:8px;padding:12px;margin-bottom:8px">
              <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px">
                <div>
                  <div style="color:#e2e8f0;font-weight:600">${esc(ev.title || '-')}</div>
                  <div style="color:#94a3b8;font-size:11px;margin-top:4px">${esc(ev.desc || '')} • ${ts(ev.ts)}</div>
                  ${ev.reward ? `<div style="color:#f59e0b;font-size:11px;margin-top:2px">Ödül: ${fmt(ev.reward)}</div>` : ''}
                </div>
                <button onclick="window.AP._deleteEvent('${ev.key}')" style="background:#ef444422;color:#ef4444;border:1px solid #ef4444;border-radius:6px;padding:5px 10px;font-size:11px;cursor:pointer">Sil</button>
              </div>
            </div>`).join('')}
        </div>
      `);
    } catch(e) { body().innerHTML = `<div style="padding:24px;color:#ef4444">Hata: ${esc(e.message)}</div>`; }
  }

  /* ──────────────────────────────────────────────────────────────────────
     SOHBET YÖNETİMİ
  ────────────────────────────────────────────────────────────────────── */
  async function renderChat() {
    loading('Sohbet yükleniyor...');
    try {
      const chatSnap = await window.db.ref('chat/global').orderByChild('ts').limitToLast(50).once('value');
      const msgs = [];
      chatSnap.forEach(c => msgs.unshift({ key: c.key, ...c.val() }));

      body().innerHTML = section('💬 Sohbet Yönetimi', `
        <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">
          ${btn('🗑️ Tüm Sohbeti Temizle', 'window.AP._clearChat()', '#ef4444')}
          ${btn('📢 Sistem Mesajı Gönder', 'window.AP._sendSystemMsg()', '#7c3aed')}
          ${btn('🔄 Yenile', 'window.AP.navTo(null,\"chat\")', '#334155')}
        </div>
        <div style="background:#0d1a2e;border:1px solid #1a2f4a;border-radius:12px;padding:16px;margin-bottom:14px">
          <div style="display:flex;gap:10px">
            <input id="systemMsgInput" placeholder="Sistem duyurusu yaz..."
              style="flex:1;padding:10px;background:#080d1a;border:1px solid #1a2f4a;border-radius:8px;color:#e2e8f0;font-size:13px">
            ${btn('Gönder','window.AP._sendSystemMsg()','#7c3aed')}
          </div>
        </div>
        <div style="background:#0d1a2e;border:1px solid #1a2f4a;border-radius:12px;overflow:hidden;max-height:600px;overflow-y:auto">
          ${msgs.length === 0 ? '<div style="padding:20px;color:#475569;text-align:center">Mesaj yok</div>' : ''}
          ${msgs.map(m => `
            <div style="display:flex;justify-content:space-between;align-items:flex-start;padding:12px;border-bottom:1px solid #0d1a2e;gap:12px" id="chat_${m.key}">
              <div style="flex:1;min-width:0">
                <span style="color:#60a5fa;font-size:12px;font-weight:600">${esc(m.username || m.user || 'Anonim')}</span>
                <span style="color:#475569;font-size:10px;margin-left:8px">${ts(m.ts)}</span>
                <div style="color:#e2e8f0;font-size:13px;margin-top:4px;word-break:break-word">${esc(m.text || m.msg || '')}</div>
              </div>
              <button onclick="window.AP._deleteMsg('${m.key}')" style="background:#ef444422;color:#ef4444;border:1px solid #ef4444;border-radius:5px;padding:3px 8px;font-size:11px;cursor:pointer;flex-shrink:0">Sil</button>
            </div>`).join('')}
        </div>
      `);
    } catch(e) { body().innerHTML = `<div style="padding:24px;color:#ef4444">Hata: ${esc(e.message)}</div>`; }
  }

  /* ──────────────────────────────────────────────────────────────────────
     OYUN YÖNETİMİ
  ────────────────────────────────────────────────────────────────────── */
  async function renderGames() {
    loading('Oyun yönetimi yükleniyor...');
    try {
      const miniGames = await dbGet('miniGameConfig') || {};

      body().innerHTML = section('🎮 Oyun Yönetimi', `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
          <div style="background:#0d1a2e;border:1px solid #1a2f4a;border-radius:12px;padding:20px">
            <h3 style="color:#e2e8f0;margin:0 0 14px;font-size:15px;font-weight:700">🎯 Mini Oyun Ayarları</h3>
            <div style="display:flex;flex-direction:column;gap:10px">
              <div>
                <label style="color:#94a3b8;font-size:12px">Min. Bahis (₺)</label>
                <div style="display:flex;gap:8px;margin-top:4px">${inp('mg_minBet','₺','number',(miniGames.minBet||100).toString())}${btn('Güncelle','window.AP._mgSet(\"minBet\",\"mg_minBet\")','#3b82f6')}</div>
              </div>
              <div>
                <label style="color:#94a3b8;font-size:12px">Max. Bahis (₺)</label>
                <div style="display:flex;gap:8px;margin-top:4px">${inp('mg_maxBet','₺','number',(miniGames.maxBet||50000).toString())}${btn('Güncelle','window.AP._mgSet(\"maxBet\",\"mg_maxBet\")','#3b82f6')}</div>
              </div>
              <div>
                <label style="color:#94a3b8;font-size:12px">Günlük Görev XP Çarpanı</label>
                <div style="display:flex;gap:8px;margin-top:4px">${inp('mg_xpMult','1.0-5.0','number',(miniGames.xpMultiplier||1.0).toString())}${btn('Güncelle','window.AP._mgSet(\"xpMultiplier\",\"mg_xpMult\")','#7c3aed')}</div>
              </div>
            </div>
          </div>
          <div style="background:#0d1a2e;border:1px solid #1a2f4a;border-radius:12px;padding:20px">
            <h3 style="color:#e2e8f0;margin:0 0 14px;font-size:15px;font-weight:700">🤖 Robot Sistemi</h3>
            <p style="color:#94a3b8;font-size:12px;margin:0 0 12px">Robotlar oyuncuların reyonlarını doldurur ve ürün yönetimi yapar.</p>
            <div style="display:flex;flex-direction:column;gap:8px">
              <div>
                <label style="color:#94a3b8;font-size:12px">Robot Dolum Aralığı (saat)</label>
                <div style="display:flex;gap:8px;margin-top:4px">${inp('robot_interval','1-24','number',(miniGames.robotInterval||6).toString())}${btn('Güncelle','window.AP._mgSet(\"robotInterval\",\"robot_interval\")','#ea580c')}</div>
              </div>
              <div>
                <label style="color:#94a3b8;font-size:12px">Robot Bütçesi (₺/dolum)</label>
                <div style="display:flex;gap:8px;margin-top:4px">${inp('robot_budget','₺','number',(miniGames.robotBudget||10000).toString())}${btn('Güncelle','window.AP._mgSet(\"robotBudget\",\"robot_budget\")','#ea580c')}</div>
              </div>
              ${btn('🤖 Tüm Robotları Şimdi Çalıştır', 'window.AP._runAllRobots()', '#16a34a')}
            </div>
          </div>
        </div>
      `);
    } catch(e) { body().innerHTML = `<div style="padding:24px;color:#ef4444">Hata: ${esc(e.message)}</div>`; }
  }

  /* ──────────────────────────────────────────────────────────────────────
     ŞÜPHELİ HAREKETLER
  ────────────────────────────────────────────────────────────────────── */
  async function renderTxLog() {
    loading('İşlemler yükleniyor...');
    try {
      const txSnap = await window.db.ref('txlog').orderByChild('ts').limitToLast(100).once('value');
      const txs = [];
      txSnap.forEach(c => txs.unshift({ key: c.key, ...c.val() }));
      const suspicious = txs.filter(t => Math.abs(t.amount || 0) > 10000000);

      body().innerHTML = section('🔍 İşlem Günlüğü', `
        <div style="margin-bottom:16px;display:flex;gap:10px;align-items:center;flex-wrap:wrap">
          <span style="color:#94a3b8;font-size:13px">Şüpheli: <b style="color:#ef4444">${suspicious.length}</b> | Toplam: <b style="color:#60a5fa">${txs.length}</b></span>
        </div>
        <div style="background:#0d1a2e;border:1px solid #1a2f4a;border-radius:12px;overflow:hidden">
          <table style="width:100%;border-collapse:collapse;font-size:12px">
            <thead><tr style="background:#080d1a;color:#475569;border-bottom:1px solid #1a2f4a">
              <th style="text-align:left;padding:10px">Kullanıcı</th>
              <th style="text-align:left;padding:10px">İşlem</th>
              <th style="text-align:right;padding:10px">Tutar</th>
              <th style="text-align:right;padding:10px">Tarih</th>
            </tr></thead>
            <tbody>
              ${txs.slice(0, 50).map(t => `
                <tr style="border-bottom:1px solid #0d1a2e;${Math.abs(t.amount||0)>10000000?'background:#ef444411':''}" >
                  <td style="padding:10px;color:#94a3b8">${esc(t.username || t.uid?.slice(0,8) || '-')}</td>
                  <td style="padding:10px;color:#e2e8f0">${esc(t.desc || t.type || '-')}</td>
                  <td style="padding:10px;text-align:right;color:${(t.amount||0)>=0?'#22c55e':'#ef4444'};font-weight:600">${fmt(t.amount||0)}</td>
                  <td style="padding:10px;text-align:right;color:#475569">${ts(t.ts)}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      `);
    } catch(e) { body().innerHTML = `<div style="padding:24px;color:#ef4444">Hata: ${esc(e.message)}</div>`; }
  }

  /* ──────────────────────────────────────────────────────────────────────
     EYLEM FONKSİYONLARI
  ────────────────────────────────────────────────────────────────────── */

  function _toast(msg, type) {
    if (typeof window.toast === 'function') window.toast(msg, type || 'success');
    else alert(msg);
  }

  async function _viewUser(uid) {
    try {
      const u = await dbGet('users/' + uid);
      const bank = await dbGet('bank/' + uid);
      if (!u) return _toast('Kullanıcı bulunamadı', 'error');

      const modal = document.createElement('div');
      modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.8);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px';
      modal.innerHTML = `
        <div style="background:#0d1a2e;border:1px solid #1a2f4a;border-radius:16px;padding:24px;max-width:500px;width:100%;max-height:80vh;overflow-y:auto">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
            <h3 style="color:#e2e8f0;margin:0;font-size:17px">👤 ${esc(u.username || uid)}</h3>
            <button onclick="this.closest('[style*=fixed]').remove()" style="background:none;border:none;color:#ef4444;font-size:20px;cursor:pointer">✕</button>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:12px;color:#94a3b8">
            <div>UID: <span style="color:#475569">${uid}</span></div>
            <div>E-posta: <span style="color:#e2e8f0">${esc(u.email || (u.isAnonymous ? '🛡️ Anonim' : '-'))}</span></div>
            <div>Seviye: <span style="color:#a78bfa;font-weight:700">Lv${u.level || 1}</span></div>
            <div>XP: <span style="color:#e2e8f0">${u.xp || 0}</span></div>
            <div>Para: <span style="color:#f59e0b;font-weight:700">${fmt(u.money || 0)}</span></div>
            <div>Elmas: <span style="color:#22c55e">${u.diamonds || 0} 💎</span></div>
            <div>İl: <span style="color:#e2e8f0">${esc(u.province || u.location || '-')}</span></div>
            <div>Rol: <span style="color:#60a5fa">${esc(u.role || 'vatandas')}</span></div>
            <div>Kayıt: <span style="color:#475569">${ts(u.createdAt)}</span></div>
            <div>Son Görülme: <span style="color:#475569">${ts(u.lastSeen)}</span></div>
            <div>Banlı: <span style="color:${u.banned?'#ef4444':'#22c55e'}">${u.banned ? '🚫 Evet' : '✅ Hayır'}</span></div>
            <div>Banka: <span style="color:#f59e0b">${fmt(bank?.balance || 0)}</span></div>
          </div>
          <div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap">
            <button onclick="window.AP._editMoneyUser('${uid}','${esc(u.username||uid)}');this.closest('[style*=fixed]').remove()" 
              style="background:#16a34a22;color:#22c55e;border:1px solid #16a34a;border-radius:8px;padding:8px 14px;font-size:12px;cursor:pointer">💰 Para Düzenle</button>
            <button onclick="window.AP._editDiamondsUser('${uid}','${esc(u.username||uid)}');this.closest('[style*=fixed]').remove()"
              style="background:#7c3aed22;color:#a78bfa;border:1px solid #7c3aed;border-radius:8px;padding:8px 14px;font-size:12px;cursor:pointer">💎 Elmas Düzenle</button>
            ${u.banned
              ? `<button onclick="window.AP._unbanUser('${uid}');this.closest('[style*=fixed]').remove()" style="background:#16a34a22;color:#22c55e;border:1px solid #16a34a;border-radius:8px;padding:8px 14px;font-size:12px;cursor:pointer">✅ Banı Kaldır</button>`
              : `<button onclick="window.AP._banUser('${uid}');this.closest('[style*=fixed]').remove()" style="background:#ef444422;color:#ef4444;border:1px solid #ef4444;border-radius:8px;padding:8px 14px;font-size:12px;cursor:pointer">🚫 Banla</button>`
            }
          </div>
        </div>`;
      document.body.appendChild(modal);
      modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    } catch(e) { _toast('Hata: ' + e.message, 'error'); }
  }

  async function _banUser(uid) {
    const reason = prompt('Ban sebebi:');
    if (!reason) return;
    await dbUpd('users/' + uid, { banned: true, banReason: reason, bannedAt: Date.now() });
    await dbPush('notifs/' + uid, { type: 'ban', icon: '🚫', msg: 'Hesabınız banlandı: ' + reason, ts: Date.now(), read: false });
    _toast('Kullanıcı banlandı ✅', 'success');
    renderDashboard();
  }

  async function _unbanUser(uid) {
    await dbUpd('users/' + uid, { banned: false, banReason: null });
    _toast('Ban kaldırıldı ✅', 'success');
    renderDashboard();
  }

  async function _editMoneyUser(uid, username) {
    const amtStr = prompt(`${username} için para miktarı (eklemek için pozitif, çıkarmak için negatif):`);
    if (!amtStr) return;
    const amt = parseFloat(amtStr);
    if (isNaN(amt)) return _toast('Geçersiz miktar', 'error');
    const cur = (await dbGet('users/' + uid + '/money')) || 0;
    await dbSet('users/' + uid + '/money', cur + amt);
    await dbPush('txlog', { uid, username, desc: 'Admin para düzenleme', amount: amt, ts: Date.now(), adminAction: true });
    _toast(`${username}'e ${fmt(amt)} ${amt >= 0 ? 'eklendi' : 'düşüldü'} ✅`);
  }

  async function _editDiamondsUser(uid, username) {
    const amtStr = prompt(`${username} için elmas miktarı:`);
    if (!amtStr) return;
    const amt = parseInt(amtStr);
    if (isNaN(amt)) return _toast('Geçersiz miktar', 'error');
    const cur = (await dbGet('users/' + uid + '/diamonds')) || 0;
    await dbSet('users/' + uid + '/diamonds', Math.max(0, cur + amt));
    _toast(`${username}'e ${amt} elmas ${amt >= 0 ? 'eklendi' : 'düşüldü'} ✅`);
  }

  async function _setUserRole(uid, role) {
    await dbSet('users/' + uid + '/role', role);
    _toast('Rol güncellendi: ' + role, 'success');
  }

  async function _searchUsers() {
    const q = document.getElementById('userSearch')?.value || '';
    renderUsers(q);
  }

  async function _quickMoney() {
    const amtStr = prompt('Her oyuncuya verilecek para miktarı (₺):');
    if (!amtStr) return;
    const amt = parseFloat(amtStr);
    if (isNaN(amt) || amt <= 0) return _toast('Geçersiz miktar', 'error');
    _toast('Para dağıtılıyor...', 'info');
    const users = await dbGet('users');
    if (!users) return;
    let count = 0;
    const updates = {};
    for (const [uid, u] of Object.entries(users)) {
      if (u?.banned) continue;
      updates['users/' + uid + '/money'] = (u?.money || 0) + amt;
      count++;
    }
    await window.db.ref().update(updates);
    _toast(`${count} oyuncuya ${fmt(amt)} dağıtıldı ✅`, 'success');
  }

  async function _setInflation() {
    const v = parseFloat(document.getElementById('newInflation')?.value || '0');
    if (isNaN(v) || v < 0 || v > 2) return _toast('0-2 arası bir değer gir', 'error');
    await dbSet('system/inflation', v);
    _toast('Enflasyon %' + (v * 100).toFixed(1) + ' olarak ayarlandı ✅');
    renderEconomy();
  }

  async function _adjInflation(delta) {
    const cur = (await dbGet('system/inflation')) || 0;
    const nv = delta === null ? 0 : Math.max(0, Math.min(2, cur + delta));
    await dbSet('system/inflation', Math.round(nv * 1000) / 1000);
    _toast('Enflasyon %' + (nv * 100).toFixed(1) + ' ✅');
    renderEconomy();
  }

  async function _setTaxRate() {
    const v = parseFloat(document.getElementById('newTaxRate')?.value || '0');
    if (isNaN(v)) return _toast('Geçersiz değer', 'error');
    await dbSet('system/taxRate', v);
    _toast('Vergi oranı ayarlandı ✅');
    renderEconomy();
  }

  async function _setVatRate() {
    const v = parseFloat(document.getElementById('newVatRate')?.value || '0');
    if (isNaN(v)) return _toast('Geçersiz değer', 'error');
    await dbSet('system/vatRate', v);
    _toast('KDV ayarlandı ✅');
    renderEconomy();
  }

  async function _updateTax(field, inputId) {
    const v = parseFloat(document.getElementById(inputId)?.value || '0');
    if (isNaN(v)) return _toast('Geçersiz değer', 'error');
    await dbSet('system/' + field, v);
    _toast(field + ' güncellendi ✅');
    renderVergi();
  }

  async function _forceTax(uid, debt) {
    const cur = (await dbGet('users/' + uid + '/money')) || 0;
    if (cur < debt) {
      const pay = cur;
      await dbSet('users/' + uid + '/money', 0);
      await dbSet('users/' + uid + '/taxDebt', debt - pay);
      _toast('Kısmi tahsilat: ' + fmt(pay), 'warn');
    } else {
      await dbSet('users/' + uid + '/money', cur - debt);
      await dbSet('users/' + uid + '/taxDebt', 0);
      _toast('Vergi tahsil edildi: ' + fmt(debt), 'success');
    }
    renderVergi();
  }

  async function _applyInterest(uid, debt) {
    const rate = (await dbGet('system/interestRate')) || 0.30;
    const newDebt = Math.ceil(debt * (1 + rate));
    await dbSet('users/' + uid + '/taxDebt', newDebt);
    _toast('Faiz uygulandı. Yeni borç: ' + fmt(newDebt), 'warn');
    renderVergi();
  }

  async function _forgiveTax(uid) {
    if (!confirm('Vergi borcunu sil (af)?')) return;
    await dbSet('users/' + uid + '/taxDebt', 0);
    _toast('Vergi affedildi ✅');
    renderVergi();
  }

  async function _setMaintenance(active) {
    if (active && !confirm('Bakım modu açılacak, tüm oyuncular atılacak. Emin misin?')) return;
    await dbSet('system/maintenance', { active, msg: active ? '🔧 Bakım yapılıyor, lütfen bekleyin.' : '' });
    _toast('Bakım modu ' + (active ? 'AÇILdı 🔧' : 'KAPANDI ✅'), active ? 'warn' : 'success');
    renderSystem();
  }

  async function _updateSys(field, inputId) {
    const el = document.getElementById(inputId);
    if (!el) return;
    const v = el.type === 'number' ? parseFloat(el.value) : el.value;
    if (el.type === 'number' && isNaN(v)) return _toast('Geçersiz değer', 'error');
    await dbSet('system/' + field, v);
    _toast(field + ' güncellendi ✅');
    renderSystem();
  }

  async function _publishVersion() {
    const v = document.getElementById('sysVersion')?.value?.trim();
    if (!v) return _toast('Versiyon gir', 'error');
    if (!confirm(`"${v}" versiyonunu yayınlayacaksın. Tüm oyuncular yenilenecek. Devam?`)) return;
    await dbSet('system/appVersion', v);
    _toast('Versiyon yayınlandı: ' + v + ' ✅');
  }

  async function _setRepoRate() {
    const v = parseFloat(document.getElementById('mb_repo')?.value || '0');
    if (isNaN(v) || v <= 0) return _toast('Geçersiz oran', 'error');
    await dbSet('bank/repoRate', v);
    _toast('Repo oranı %' + (v * 100).toFixed(1) + ' ✅');
    renderMerkezBankasi();
  }

  async function _setBankRate(field, inputId) {
    const v = parseFloat(document.getElementById(inputId)?.value || '0');
    if (isNaN(v)) return _toast('Geçersiz değer', 'error');
    await dbSet('bank/' + field, v);
    _toast(field + ' güncellendi ✅');
    renderMerkezBankasi();
  }

  async function _rateScenario(type) {
    const scenarios = {
      easy:    { repoRate: 0.30, depositRate: 0.26, loanRate: 0.40 },
      tight:   { repoRate: 0.65, depositRate: 0.58, loanRate: 0.80 },
      neutral: { repoRate: 0.42, depositRate: 0.38, loanRate: 0.55 },
      crisis:  { repoRate: 1.20, depositRate: 1.10, loanRate: 1.80 }
    };
    const s = scenarios[type];
    if (!s) return;
    await window.db.ref('bank').update(s);
    _toast('Faiz senaryosu uygulandı: ' + type + ' ✅');
    renderMerkezBankasi();
  }

  async function _borsaAdj(delta) {
    const prices = await dbGet('borsaFiyatlar') || {};
    const updates = {};
    for (const [k, v] of Object.entries(prices)) {
      updates['borsaFiyatlar/' + k] = Math.max(1, Math.round(v * (1 + delta)));
    }
    await window.db.ref().update(updates);
    _toast('Borsa ' + (delta > 0 ? '+' : '') + (delta * 100).toFixed(0) + '% ✅');
    renderBorsa();
  }

  async function _borsaRandom() {
    const prices = await dbGet('borsaFiyatlar') || {};
    const updates = {};
    for (const [k, v] of Object.entries(prices)) {
      const chg = (Math.random() * 0.3) - 0.15;
      updates['borsaFiyatlar/' + k] = Math.max(1, Math.round(v * (1 + chg)));
    }
    await window.db.ref().update(updates);
    _toast('Rastgele borsa dalgalanması ✅');
    renderBorsa();
  }

  async function _borsaHisse(ticker, delta) {
    const cur = (await dbGet('borsaFiyatlar/' + ticker)) || 100;
    await dbSet('borsaFiyatlar/' + ticker, Math.max(1, Math.round(cur * (1 + delta))));
    _toast(ticker + ' ' + (delta > 0 ? '+' : '') + (delta * 100).toFixed(0) + '% ✅');
    renderBorsa();
  }

  async function _borsaSetPrice(ticker) {
    const v = parseFloat(document.getElementById('bp_' + ticker)?.value || '0');
    if (isNaN(v) || v <= 0) return _toast('Geçersiz fiyat', 'error');
    await dbSet('borsaFiyatlar/' + ticker, v);
    _toast(ticker + ' fiyatı ' + fmt(v) + ' ✅');
    renderBorsa();
  }

  async function _borsaAutoToggle(active) {
    await dbSet('system/borsaAutoMode', active);
    _toast('Borsa otomatik mod ' + (active ? 'açıldı' : 'kapatıldı'), active ? 'success' : 'warn');
  }

  async function _kriptoAdj(delta) {
    const prices = await dbGet('kriptoPrices') || {};
    const updates = {};
    for (const [k, v] of Object.entries(prices)) {
      updates['kriptoPrices/' + k] = Math.max(1, Math.round(v * (1 + delta)));
    }
    await window.db.ref().update(updates);
    _toast('Kripto ' + (delta > 0 ? '+' : '') + (delta * 100).toFixed(0) + '% ✅');
    renderKripto();
  }

  async function _kriptoRandom() {
    const prices = await dbGet('kriptoPrices') || {};
    const updates = {};
    for (const [k, v] of Object.entries(prices)) {
      const chg = (Math.random() * 0.5) - 0.25;
      updates['kriptoPrices/' + k] = Math.max(1, Math.round(v * (1 + chg)));
    }
    await window.db.ref().update(updates);
    _toast('Kripto rastgele dalgalandı ✅');
    renderKripto();
  }

  async function _kriptoHisse(coin, delta) {
    const cur = (await dbGet('kriptoPrices/' + coin)) || 100;
    await dbSet('kriptoPrices/' + coin, Math.max(1, Math.round(cur * (1 + delta))));
    _toast(coin + ' ' + (delta > 0 ? '+' : '') + (delta * 100).toFixed(0) + '% ✅');
    renderKripto();
  }

  async function _kriptoSetPrice(coin) {
    const v = parseFloat(document.getElementById('kp_' + coin)?.value || '0');
    if (isNaN(v) || v <= 0) return _toast('Geçersiz fiyat', 'error');
    await dbSet('kriptoPrices/' + coin, v);
    _toast(coin + ' fiyatı ' + fmt(v) + ' ✅');
    renderKripto();
  }

  async function _kriptoAutoToggle(active) {
    await dbSet('system/kriptoAutoMode', active);
    _toast('Kripto otomatik mod ' + (active ? 'açıldı' : 'kapatıldı'), active ? 'success' : 'warn');
  }

  async function _publishNews() {
    const title = document.getElementById('newsTitle')?.value?.trim();
    const type = document.getElementById('newsType')?.value || 'genel';
    const impact = document.getElementById('newsImpact')?.value || 'neutral';
    if (!title) return _toast('Başlık gir', 'error');
    await dbPush('news', { title, type, impact, ts: Date.now(), publishedBy: window.GZ?.uid || 'admin' });
    _toast('Haber yayınlandı ✅');
    renderNews();
  }

  async function _deleteNews(key) {
    if (!confirm('Haberi sil?')) return;
    await dbSet('news/' + key, null);
    _toast('Haber silindi');
    renderNews();
  }

  async function _resolveAlert(uid, key) {
    await dbSet('security/alerts/' + uid + '/' + key + '/handled', true);
    _toast('Uyarı çözüldü ✅');
    renderSecurity();
  }

  async function _clearChat() {
    if (!confirm('Tüm global sohbet silinecek. Emin misin?')) return;
    await dbSet('chat/global', null);
    _toast('Sohbet temizlendi ✅');
    renderChat();
  }

  async function _sendSystemMsg() {
    const text = document.getElementById('systemMsgInput')?.value?.trim();
    if (!text) {
      const t = prompt('Sistem mesajı:');
      if (!t) return;
      await dbPush('chat/global', { username: '🤖 SİSTEM', text: t, ts: Date.now(), isSystem: true });
      _toast('Mesaj gönderildi ✅');
      renderChat();
      return;
    }
    await dbPush('chat/global', { username: '🤖 SİSTEM', text, ts: Date.now(), isSystem: true });
    _toast('Mesaj gönderildi ✅');
    renderChat();
  }

  async function _deleteMsg(key) {
    await dbSet('chat/global/' + key, null);
    document.getElementById('chat_' + key)?.remove();
    _toast('Mesaj silindi');
  }

  async function _krediOnayla(key, uid, amount) {
    if (!confirm(`${fmt(amount)} krediyi onayla?`)) return;
    await dbUpd('krediBasvurulari/' + key, { status: 'approved', approvedAt: Date.now() });
    const cur = (await dbGet('users/' + uid + '/money')) || 0;
    await dbSet('users/' + uid + '/money', cur + amount);
    await dbPush('users/' + uid + '/krediler', { amount, approvedAt: Date.now(), status: 'active', remainingBalance: amount });
    await dbPush('notifs/' + uid, { type: 'kredi', icon: '✅', msg: '✅ Krediniz onaylandı! ' + fmt(amount) + ' hesabınıza yatırıldı.', ts: Date.now(), read: false });
    await dbPush('txlog', { uid, desc: 'Kredi onayı', amount, ts: Date.now(), adminAction: true });
    _toast('Kredi onaylandı ve para yatırıldı ✅');
    renderKrediOnay();
  }

  async function _krediReddet(key, uid) {
    const reason = prompt('Red sebebi:');
    if (!reason) return;
    await dbUpd('krediBasvurulari/' + key, { status: 'rejected', reason, rejectedAt: Date.now() });
    await dbPush('notifs/' + uid, { type: 'kredi', icon: '❌', msg: '❌ Kredi başvurunuz reddedildi: ' + reason, ts: Date.now(), read: false });
    _toast('Kredi reddedildi ✅');
    renderKrediOnay();
  }

  async function _createEvent() {
    const title = document.getElementById('evTitle')?.value?.trim();
    const desc = document.getElementById('evDesc')?.value?.trim();
    const reward = parseFloat(document.getElementById('evReward')?.value || '0');
    const durHours = parseInt(document.getElementById('evDuration')?.value || '24');
    if (!title) return _toast('Etkinlik adı gir', 'error');
    await dbPush('events', { title, desc, reward, durHours, ts: Date.now(), endsAt: Date.now() + durHours * 3600000, active: true });
    _toast('Etkinlik başlatıldı ✅');
    renderEvents();
  }

  async function _deleteEvent(key) {
    if (!confirm('Etkinliği sil?')) return;
    await dbSet('events/' + key, null);
    _toast('Etkinlik silindi');
    renderEvents();
  }

  async function _triggerEvent(type) {
    const events = {
      boom: { title: '📈 Ekonomik Patlama', effect: 'income_boost', multiplier: 1.2 },
      crisis: { title: '📉 Ekonomik Kriz', effect: 'income_penalty', multiplier: 0.8 },
      harvest: { title: '🌾 Hasat Bolluğu', effect: 'farm_boost', multiplier: 1.5 },
      industrial: { title: '🏭 Sanayi Patlaması', effect: 'factory_boost', multiplier: 1.4 },
      forex: { title: '💱 Döviz Krizi', effect: 'forex_crisis', multiplier: 1.0 },
      inflation_spike: { title: '🔥 Enflasyon Atağı', effect: 'inflation', multiplier: 1.0 }
    };
    const ev = events[type];
    if (!ev) return;
    await dbSet('system/activeEconomicEvent', { ...ev, startedAt: Date.now(), endsAt: Date.now() + 24 * 3600000 });
    await dbPush('news', { title: ev.title, type: 'ekonomi', impact: type.includes('crisis') || type.includes('spike') ? 'negative' : 'positive', ts: Date.now() });
    _toast(ev.title + ' başlatıldı ✅');
  }

  async function _mgSet(field, inputId) {
    const v = parseFloat(document.getElementById(inputId)?.value || '0');
    if (isNaN(v)) return _toast('Geçersiz değer', 'error');
    await dbSet('miniGameConfig/' + field, v);
    _toast(field + ' güncellendi ✅');
  }

  async function _runAllRobots() {
    _toast('Robotlar çalıştırılıyor...', 'info');
    try {
      const users = await dbGet('users');
      if (!users) return;
      const budget = (await dbGet('miniGameConfig/robotBudget')) || 10000;
      let count = 0;
      const updates = {};
      for (const [uid, u] of Object.entries(users)) {
        if (u?.banned || !u?.dukkanlar) continue;
        // Reyonları doldur
        for (const [dKey, dukkan] of Object.entries(u.dukkanlar || {})) {
          for (const [rKey] of Object.entries(dukkan.reyonlar || {})) {
            updates[`users/${uid}/dukkanlar/${dKey}/reyonlar/${rKey}/stok`] = 100;
            updates[`users/${uid}/dukkanlar/${dKey}/reyonlar/${rKey}/lastRefill`] = Date.now();
          }
        }
        // Robot raporu bildir
        updates[`users/${uid}/robotReport`] = { lastRun: Date.now(), msg: `Reyonlarınız dolduruldu. Harcama: ${(budget).toLocaleString('tr-TR')} ₺` };
        count++;
      }
      await window.db.ref().update(updates);
      _toast(`${count} oyuncunun reyonları dolduruldu ✅`);
    } catch(e) { _toast('Robot hatası: ' + e.message, 'error'); }
  }

  async function _resetBorsa() {
    if (!confirm('Borsa sıfırlanacak. Emin misin?')) return;
    const defaults = { GZGM:120, GZTK:85, GZBT:340, GZAN:67, GZIM:210, GZTA:155, GZET:98, GZFN:280 };
    await dbSet('borsaFiyatlar', defaults);
    _toast('Borsa sıfırlandı ✅');
    renderBorsa();
  }

  async function _resetKripto() {
    if (!confirm('Kripto sıfırlanacak?')) return;
    const defaults = { BTC:2800000, ETH:175000, BNB:24000, SOL:7000, ADA:45, XRP:28, DOGE:12, GZC:150 };
    await dbSet('kriptoPrices', defaults);
    _toast('Kripto sıfırlandı ✅');
    renderKripto();
  }

  async function _massGiveMoney() {
    const amt = parseFloat(document.getElementById('massGiveAmount')?.value || '0');
    if (!amt || amt <= 0) return _toast('Geçersiz miktar', 'error');
    await window.AP._quickMoney_custom(amt);
  }

  async function _quickMoney_custom(amt) {
    _toast('Para dağıtılıyor...', 'info');
    const users = await dbGet('users');
    if (!users) return;
    const updates = {};
    let count = 0;
    for (const [uid, u] of Object.entries(users)) {
      if (u?.banned) continue;
      updates['users/' + uid + '/money'] = (u?.money || 0) + amt;
      count++;
    }
    await window.db.ref().update(updates);
    _toast(`${count} oyuncuya ${fmt(amt)} dağıtıldı ✅`);
    renderEconomy();
  }

  async function _setStartingMoney() {
    const v = parseFloat(document.getElementById('startingMoney')?.value || '25000');
    if (isNaN(v) || v < 0) return _toast('Geçersiz miktar', 'error');
    await dbSet('system/startingMoney', v);
    _toast('Başlangıç parası ' + fmt(v) + ' ✅');
  }

  async function _loadElmasFiyatlari() {
    const area = document.getElementById('elmasConfigArea');
    if (!area) return;
    try {
      const config = await dbGet('elmasMagaza') || {
        paket_100: { label: '100 Elmas', price: 9.99, diamonds: 100 },
        paket_250: { label: '250 Elmas', price: 19.99, diamonds: 250 },
        paket_600: { label: '600 Elmas', price: 44.99, diamonds: 600 },
        paket_1300: { label: '1300 Elmas', price: 89.99, diamonds: 1300 },
        paket_robot: { label: 'Robot (1ay)', price: 29.99, diamonds: 0, item: 'robot' }
      };

      area.innerHTML = `
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:10px">
          ${Object.entries(config).map(([k, p]) => `
            <div style="border:1px solid #1a2f4a;border-radius:8px;padding:12px;background:#080d1a">
              <div style="font-weight:700;color:#e2e8f0;margin-bottom:8px">${esc(p.label || k)}</div>
              <div style="display:flex;gap:8px;margin-bottom:6px">
                <input id="ep_price_${k}" type="number" placeholder="₺ fiyat" value="${p.price || 0}"
                  style="flex:1;padding:6px;background:#0d1a2e;border:1px solid #1a2f4a;border-radius:6px;color:#e2e8f0;font-size:12px">
                <input id="ep_dia_${k}" type="number" placeholder="💎 elmas" value="${p.diamonds || 0}"
                  style="flex:1;padding:6px;background:#0d1a2e;border:1px solid #1a2f4a;border-radius:6px;color:#e2e8f0;font-size:12px">
              </div>
              <button onclick="window.AP._saveElmasPaket('${k}')" 
                style="width:100%;background:#7c3aed;color:#fff;border:none;border-radius:6px;padding:6px;font-size:12px;cursor:pointer">💾 Kaydet</button>
            </div>`).join('')}
        </div>
        <button onclick="window.AP._addElmasPaket()" 
          style="margin-top:10px;background:#16a34a;color:#fff;border:none;border-radius:8px;padding:8px 16px;font-size:12px;cursor:pointer">➕ Yeni Paket Ekle</button>
      `;
    } catch(e) { area.innerHTML = `<span style="color:#ef4444">Hata: ${esc(e.message)}</span>`; }
  }

  async function _saveElmasPaket(key) {
    const price = parseFloat(document.getElementById('ep_price_' + key)?.value || '0');
    const diamonds = parseInt(document.getElementById('ep_dia_' + key)?.value || '0');
    await dbUpd('elmasMagaza/' + key, { price, diamonds });
    _toast('Paket güncellendi ✅');
  }

  async function _addElmasPaket() {
    const label = prompt('Paket adı:');
    if (!label) return;
    const key = 'paket_' + Date.now();
    await dbSet('elmasMagaza/' + key, { label, price: 9.99, diamonds: 100 });
    _toast('Paket eklendi ✅');
    _loadElmasFiyatlari();
  }

  /* ──────────────────────────────────────────────────────────────────────
     ANA NAV
  ────────────────────────────────────────────────────────────────────── */
  function navTo(btn, section) {
    // Aktif butonu güncelle
    document.querySelectorAll('.asnb').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    else {
      document.querySelectorAll('.asnb').forEach(b => {
        if (b.getAttribute('onclick')?.includes(`'${section}'`)) b.classList.add('active');
      });
    }

    _activeSection = section;

    const renderers = {
      dashboard: renderDashboard,
      users: () => renderUsers(''),
      economy: renderEconomy,
      krediOnay: renderKrediOnay,
      vergi: renderVergi,
      merkez: renderMerkezBankasi,
      borsa: renderBorsa,
      kripto: renderKripto,
      news: renderNews,
      chat: renderChat,
      games: renderGames,
      security: renderSecurity,
      txlog: renderTxLog,
      events: renderEvents,
      system: renderSystem,
      analytics: renderAnalytics
    };

    const fn = renderers[section];
    if (fn) fn();
    else body().innerHTML = `<div style="padding:40px;text-align:center;color:#475569">Bu bölüm yakında: <b style="color:#60a5fa">${section}</b></div>`;
  }

  function adminLogout() {
    if (!confirm('Yönetici oturumundan çıkış yapılacak. Emin misin?')) return;
    sessionStorage.removeItem('gz_admin_active');
    sessionStorage.removeItem('gz_founder_session');
    window.GZ_IS_FOUNDER = false;
    window.GZ_FOUNDER_VERIFIED = false;
    const adminScr = document.getElementById('adminScreen');
    const gameScr = document.getElementById('gameScreen');
    if (adminScr) adminScr.style.display = 'none';
    if (gameScr) { gameScr.style.display = ''; gameScr.classList.add('active'); }
    if (typeof window.toast === 'function') window.toast('Yönetici oturumu kapatıldı 🚪', 'info');
  }

  /* ──────────────────────────────────────────────────────────────────────
     KREDİ BADGE CANLI DİNLEME
  ────────────────────────────────────────────────────────────────────── */
  function watchKrediBadge() {
    window.db.ref('krediBasvurulari').on('value', snap => {
      let count = 0;
      snap.forEach(c => { if (c.val()?.status === 'pending') count++; });
      const badge = document.getElementById('krediOnayBadge');
      if (badge) { badge.hidden = count === 0; badge.textContent = count || ''; }
    });
  }

  /* ──────────────────────────────────────────────────────────────────────
     openAdminPanel — giris.js tarafından çağrılır
  ────────────────────────────────────────────────────────────────────── */
  function openAdminPanel() {
    // admin-yonetim.js için geriye dönük uyumluluk
    window._adminTarget = 'adminScreenBody';

    // Badge dinleyicisi
    if (window.db) watchKrediBadge();

    // Dashboard'ı render et
    renderDashboard();

    // admin-yonetim.js için admin-nav class ekle (backwards compat)
    const nav = document.getElementById('adminScreenNav');
    if (nav && !nav.classList.contains('admin-nav')) nav.classList.add('admin-nav');

    console.log('[AdminPanel] ✅ Panel açıldı');
  }

  /* ──────────────────────────────────────────────────────────────────────
     window.AP OBJESI
  ────────────────────────────────────────────────────────────────────── */
  window.AP = {
    openAdminPanel,
    renderDashboard,
    navTo,
    adminLogout,

    // Kullanıcı yönetimi
    _viewUser,
    _banUser,
    _unbanUser,
    _editMoneyUser,
    _editDiamondsUser,
    _setUserRole,
    _searchUsers,

    // Para
    _quickMoney,
    _quickMoney_custom,
    _massGiveMoney,
    _setStartingMoney,

    // Ekonomi
    _setInflation,
    _adjInflation,
    _setTaxRate,
    _setVatRate,
    _updateTax,
    _triggerEvent,

    // Vergi
    _forceTax,
    _applyInterest,
    _forgiveTax,

    // Sistem
    _setMaintenance,
    _updateSys,
    _publishVersion,

    // Merkez Bankası
    _setRepoRate,
    _setBankRate,
    _rateScenario,

    // Borsa
    _borsaAdj,
    _borsaRandom,
    _borsaHisse,
    _borsaSetPrice,
    _borsaAutoToggle,
    _resetBorsa,

    // Kripto
    _kriptoAdj,
    _kriptoRandom,
    _kriptoHisse,
    _kriptoSetPrice,
    _kriptoAutoToggle,
    _resetKripto,

    // Haberler
    _publishNews,
    _deleteNews,

    // Güvenlik
    _resolveAlert,

    // Sohbet
    _clearChat,
    _sendSystemMsg,
    _deleteMsg,

    // Kredi
    _krediOnayla,
    _krediReddet,

    // Etkinlik
    _createEvent,
    _deleteEvent,

    // Oyun
    _mgSet,
    _runAllRobots,

    // Elmas Mağazası
    _loadElmasFiyatlari,
    _saveElmasPaket,
    _addElmasPaket,
  };

  console.log('[AdminPanel] ✅ window.AP hazır');

})();
