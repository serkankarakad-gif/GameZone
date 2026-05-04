/* ============================================================================
   system-logic.js — GameZone ERP: Sistem Mantığı & Bağlantı Köprüsü
   ─────────────────────────────────────────────────────────────────────────
   Bu dosya; admin-panel.js, ekonomi.js ve diğer modüller arasındaki
   köprü fonksiyonlarını sağlar. Ayrıca eksik global fonksiyonları tanımlar.
   ============================================================================ */
'use strict';

/* ══════════════════════════════════════════════════════════════════════════
   1. CANLI VERİ GÜNCELLEME — DİJİTAL CÜZDAN TOPBAR
   ══════════════════════════════════════════════════════════════════════════ */
(function watchWallet() {
  const _wait = setInterval(function () {
    if (!window.db || !window.GZ?.uid) return;
    clearInterval(_wait);

    // Kullanıcı verisini gerçek zamanlı dinle
    window.db.ref('users/' + window.GZ.uid).on('value', function (snap) {
      const d = snap.val();
      if (!d) return;
      window.GZ.data = d;

      // Topbar güncelle
      const fmt = window.cashFmt || (n => (n || 0).toLocaleString('tr-TR') + ' ₺');

      const cashEl = document.getElementById('cashTxt');
      const diaEl = document.getElementById('diaTxt');
      const lvlEl = document.getElementById('lvlPill');
      const xpFill = document.getElementById('xpFill');
      const xpText = document.getElementById('xpText');

      if (cashEl) cashEl.textContent = fmt(d.money || 0);
      if (diaEl) diaEl.textContent = (d.diamonds || 0);
      if (lvlEl) lvlEl.textContent = 'Lv ' + (d.level || 1);

      if (xpFill || xpText) {
        const xpFn = window.xpForLevel || (lv => lv * 1000);
        const need = xpFn(d.level || 1);
        const pct = Math.min(100, Math.floor(((d.xp || 0) / need) * 100));
        if (xpFill) xpFill.style.width = pct + '%';
        if (xpText) xpText.textContent = (d.xp || 0) + '/' + need;
      }

      // Robot raporu bildirimi
      if (d.robotReport && d.robotReport.lastRun > Date.now() - 60000) {
        const rr = d.robotReport;
        if (rr.msg && typeof window.toast === 'function' && !window._robotReportShown) {
          window._robotReportShown = true;
          setTimeout(() => {
            window.toast('🤖 Robot Raporu: ' + rr.msg, 'info', 8000);
            window._robotReportShown = false;
          }, 3000);
        }
      }
    });

    // Bildirimler (rozetler)
    window.db.ref('notifs/' + window.GZ.uid).orderByChild('read').equalTo(false).on('value', function (snap) {
      let count = 0;
      snap.forEach(() => count++);
      const badge = document.getElementById('notifBadge');
      if (badge) {
        badge.style.display = count > 0 ? 'flex' : 'none';
        badge.textContent = count > 9 ? '9+' : count;
      }
    });

  }, 500);
})();

/* ══════════════════════════════════════════════════════════════════════════
   2. KİMLİK KARTI SİSTEMİ (Muhtarlık)
   ══════════════════════════════════════════════════════════════════════════ */
window.SL_applyIdCard = async function () {
  if (!window.GZ?.uid) return window.toast?.('Giriş yap!', 'error');

  const uid = window.GZ.uid;
  const userData = window.GZ.data || {};

  // Zaten varsa göster
  if (userData.idCard) {
    const ic = userData.idCard;
    window.showModal?.('🪪 Kimlik Kartın', `
      <div style="background:linear-gradient(135deg,#1e3a5f,#0d1a2e);border-radius:16px;padding:24px;border:2px solid #3b82f6;max-width:360px;margin:0 auto">
        <div style="text-align:center;margin-bottom:16px">
          <div style="font-size:32px">🇹🇷</div>
          <div style="color:#f59e0b;font-weight:900;font-size:16px;letter-spacing:2px">GAMEZONE CUMHURİYETİ</div>
          <div style="color:#94a3b8;font-size:11px">KİMLİK KARTI</div>
        </div>
        <div style="display:grid;gap:10px;font-size:13px">
          <div style="display:flex;justify-content:space-between"><span style="color:#64748b">Ad Soyad</span><span style="color:#e2e8f0;font-weight:700">${window.esc?.(ic.fullName || userData.username) || (ic.fullName || userData.username)}</span></div>
          <div style="display:flex;justify-content:space-between"><span style="color:#64748b">TC No</span><span style="color:#60a5fa;font-family:monospace">${ic.tcNo || '-'}</span></div>
          <div style="display:flex;justify-content:space-between"><span style="color:#64748b">İl</span><span style="color:#e2e8f0">${ic.province || userData.province || '-'}</span></div>
          <div style="display:flex;justify-content:space-between"><span style="color:#64748b">Veriliş</span><span style="color:#e2e8f0">${new Date(ic.issuedAt || Date.now()).toLocaleDateString('tr-TR')}</span></div>
          <div style="display:flex;justify-content:space-between"><span style="color:#64748b">Durum</span><span style="color:#22c55e;font-weight:700">✅ GEÇERLİ</span></div>
        </div>
      </div>
    `);
    return;
  }

  // Ücret kontrolü
  const fee = (await window.db?.ref('system/idCardFee').once('value').then(s => s.val())) || 500;
  const money = userData.money || 0;

  if (money < fee) {
    return window.toast?.(`❌ Kimlik kartı için ${(window.cashFmt || (n => n + '₺'))(fee)} gerekli. Bakiyeniz: ${(window.cashFmt || (n => n + '₺'))(money)}`, 'error', 5000);
  }

  window.showModal?.('🪪 Kimlik Kartı Başvurusu', `
    <div style="display:flex;flex-direction:column;gap:12px">
      <p style="color:#94a3b8;font-size:13px;margin:0">Muhtarlıktan kimlik kartı almak için ücret: <b style="color:#f59e0b">${(window.cashFmt || (n => n + '₺'))(fee)}</b></p>
      <div class="input-group">
        <label style="color:#94a3b8;font-size:12px">Ad Soyad</label>
        <input id="sl_icFullName" type="text" placeholder="Adınız Soyadınız" value="${userData.username || ''}"
          style="width:100%;padding:10px;background:#080d1a;border:1px solid #1a2f4a;border-radius:8px;color:#e2e8f0;font-size:13px;box-sizing:border-box">
      </div>
      <div class="input-group">
        <label style="color:#94a3b8;font-size:12px">İl</label>
        <input id="sl_icProvince" type="text" placeholder="İstanbul, Ankara..." value="${userData.province || userData.location || ''}"
          style="width:100%;padding:10px;background:#080d1a;border:1px solid #1a2f4a;border-radius:8px;color:#e2e8f0;font-size:13px;box-sizing:border-box">
      </div>
      <button onclick="window.SL_submitIdCard()" 
        style="background:#3b82f6;color:#fff;border:none;border-radius:8px;padding:12px;font-weight:700;font-size:14px;cursor:pointer;width:100%">
        🪪 Kimlik Kartı Al (${(window.cashFmt || (n => n + '₺'))(fee)})
      </button>
    </div>
  `);
};

window.SL_submitIdCard = async function () {
  const uid = window.GZ?.uid;
  if (!uid) return;

  const fullName = document.getElementById('sl_icFullName')?.value?.trim();
  const province = document.getElementById('sl_icProvince')?.value?.trim();

  if (!fullName) return window.toast?.('Ad soyad gir', 'error');
  if (!province) return window.toast?.('İl gir', 'error');

  const fee = (await window.db?.ref('system/idCardFee').once('value').then(s => s.val())) || 500;
  const money = window.GZ?.data?.money || 0;

  if (money < fee) return window.toast?.('Yetersiz bakiye', 'error');

  // TC No üret (rastgele ama tutarlı)
  const tcNo = String(uid).split('').reduce((a, c) => a + c.charCodeAt(0), 0).toString().padStart(11, '1').slice(0, 11);

  const idCard = {
    fullName,
    province,
    tcNo,
    issuedAt: Date.now(),
    issuedBy: 'Muhtarlık'
  };

  // Para düş
  await window.db?.ref('users/' + uid + '/money').transaction(m => Math.max(0, (m || 0) - fee));
  await window.db?.ref('users/' + uid + '/idCard').set(idCard);
  await window.db?.ref('users/' + uid + '/province').set(province);

  // Log
  await window.db?.ref('txlog').push({ uid, desc: 'Kimlik kartı ücreti', amount: -fee, ts: Date.now() });

  window.closeModal?.();
  window.toast?.('🪪 Kimlik kartı alındı! ✅', 'success', 5000);
};

/* ══════════════════════════════════════════════════════════════════════════
   3. DİJİTAL CÜZDAN
   ══════════════════════════════════════════════════════════════════════════ */
window.SL_renderCuzdan = async function () {
  if (!window.GZ?.uid) return;
  const uid = window.GZ.uid;

  try {
    const [userData, bankData, kriptoPositions, borsaPositions, kriptoPrices, borsaPrices] = await Promise.all([
      window.db.ref('users/' + uid).once('value').then(s => s.val()),
      window.db.ref('bank/' + uid).once('value').then(s => s.val()),
      window.db.ref('users/' + uid + '/kripto').once('value').then(s => s.val()),
      window.db.ref('users/' + uid + '/borsa').once('value').then(s => s.val()),
      window.db.ref('kriptoPrices').once('value').then(s => s.val()),
      window.db.ref('borsaFiyatlar').once('value').then(s => s.val())
    ]);

    const fmt = window.cashFmt || (n => (n || 0).toLocaleString('tr-TR') + ' ₺');

    // Kripto değer hesapla
    let kriptoVal = 0;
    const kriptoItems = [];
    if (kriptoPositions && kriptoPrices) {
      for (const [coin, pos] of Object.entries(kriptoPositions)) {
        const amount = pos?.amount || 0;
        const price = kriptoPrices[coin] || 0;
        const val = amount * price;
        kriptoVal += val;
        if (amount > 0) kriptoItems.push({ coin, amount, price, val });
      }
    }

    // Borsa değer hesapla
    let borsaVal = 0;
    const borsaItems = [];
    if (borsaPositions && borsaPrices) {
      for (const [ticker, pos] of Object.entries(borsaPositions)) {
        const amount = pos?.amount || pos || 0;
        const price = borsaPrices[ticker] || 0;
        const val = amount * price;
        borsaVal += val;
        if (amount > 0) borsaItems.push({ ticker, amount, price, val });
      }
    }

    const totalWealth = (userData?.money || 0) + (bankData?.balance || 0) + kriptoVal + borsaVal;

    const main = document.getElementById('appMain');
    if (!main) return;

    main.innerHTML = `
      <div style="padding:16px;max-width:800px;margin:0 auto">
        <h2 style="color:#e2e8f0;margin:0 0 16px;font-size:18px;font-weight:800">💳 Dijital Cüzdan</h2>

        <!-- Toplam Net Değer -->
        <div style="background:linear-gradient(135deg,#1e3a5f,#0d1a2e);border:1px solid #3b82f6;border-radius:16px;padding:24px;margin-bottom:16px;text-align:center">
          <div style="color:#94a3b8;font-size:12px;font-weight:700;letter-spacing:1px;margin-bottom:8px">TOPLAM NET DEĞER</div>
          <div style="font-size:32px;font-weight:900;color:#f59e0b">${fmt(totalWealth)}</div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
          <!-- Nakit -->
          <div style="background:#0d1a2e;border:1px solid #1a2f4a;border-radius:12px;padding:16px">
            <div style="color:#64748b;font-size:11px;font-weight:700;letter-spacing:1px">💵 NAKİT</div>
            <div style="font-size:22px;font-weight:900;color:#22c55e;margin-top:8px">${fmt(userData?.money || 0)}</div>
          </div>
          <!-- Banka -->
          <div style="background:#0d1a2e;border:1px solid #1a2f4a;border-radius:12px;padding:16px">
            <div style="color:#64748b;font-size:11px;font-weight:700;letter-spacing:1px">🏦 BANKA</div>
            <div style="font-size:22px;font-weight:900;color:#60a5fa;margin-top:8px">${fmt(bankData?.balance || 0)}</div>
          </div>
          <!-- Kripto -->
          <div style="background:#0d1a2e;border:1px solid #1a2f4a;border-radius:12px;padding:16px">
            <div style="color:#64748b;font-size:11px;font-weight:700;letter-spacing:1px">₿ KRİPTO</div>
            <div style="font-size:22px;font-weight:900;color:#f59e0b;margin-top:8px">${fmt(kriptoVal)}</div>
            ${kriptoItems.length ? `<div style="margin-top:8px;font-size:11px;color:#475569">${kriptoItems.slice(0,3).map(k => k.coin + ' × ' + k.amount.toFixed(4)).join(' | ')}</div>` : ''}
          </div>
          <!-- Borsa -->
          <div style="background:#0d1a2e;border:1px solid #1a2f4a;border-radius:12px;padding:16px">
            <div style="color:#64748b;font-size:11px;font-weight:700;letter-spacing:1px">📈 BORSA</div>
            <div style="font-size:22px;font-weight:900;color:#a78bfa;margin-top:8px">${fmt(borsaVal)}</div>
            ${borsaItems.length ? `<div style="margin-top:8px;font-size:11px;color:#475569">${borsaItems.slice(0,3).map(b => b.ticker + ' × ' + b.amount).join(' | ')}</div>` : ''}
          </div>
        </div>

        <!-- Kimlik Kartı -->
        <div style="background:#0d1a2e;border:1px solid #1a2f4a;border-radius:12px;padding:16px;margin-bottom:12px">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div>
              <div style="color:#64748b;font-size:11px;font-weight:700;letter-spacing:1px">🪪 KİMLİK KARTI</div>
              <div style="color:${userData?.idCard ? '#22c55e' : '#ef4444'};font-weight:700;margin-top:4px">
                ${userData?.idCard ? '✅ Mevcut — ' + (userData.idCard.fullName || '') : '❌ Kimlik kartın yok'}
              </div>
            </div>
            <button onclick="window.SL_applyIdCard()" 
              style="background:#3b82f6;color:#fff;border:none;border-radius:8px;padding:8px 16px;font-weight:700;font-size:12px;cursor:pointer">
              ${userData?.idCard ? '🪪 Görüntüle' : '🪪 Al (Muhtarlık)'}
            </button>
          </div>
        </div>

        <!-- Elmaslar -->
        <div style="background:#0d1a2e;border:1px solid #1a2f4a;border-radius:12px;padding:16px">
          <div style="color:#64748b;font-size:11px;font-weight:700;letter-spacing:1px;margin-bottom:8px">💎 ELMASLAR</div>
          <div style="font-size:28px;font-weight:900;color:#a78bfa">${userData?.diamonds || 0} 💎</div>
          <div style="font-size:11px;color:#475569;margin-top:4px">Oyun içi premium para birimi</div>
        </div>
      </div>
    `;
  } catch (e) {
    console.error('[SL_renderCuzdan]', e);
  }
};

/* ══════════════════════════════════════════════════════════════════════════
   4. PERSONEL & MAAŞ SİSTEMİ
   ══════════════════════════════════════════════════════════════════════════ */

// Personel ekleme (admin tarafından belirlenen maaşlar)
window.SL_addPersonel = async function (businessUid, businessKey, businessType) {
  if (!window.GZ?.uid) return;
  const uid = window.GZ.uid;

  // Seviyelere göre personel kotası
  const userData = await window.db.ref('users/' + uid).once('value').then(s => s.val());
  const level = userData?.level || 1;
  const quota = Math.floor(level / 5) + 1; // Her 5 seviyede 1 personel

  const currentPersonel = userData?.personel || [];
  if (currentPersonel.length >= quota) {
    return window.toast?.(`❌ Seviye ${level}'de maksimum ${quota} personel alabilirsiniz. Seviye yükseltin!`, 'error', 5000);
  }

  const adminWage = (await window.db.ref('system/minWage').once('value').then(s => s.val())) || 17000;

  window.showModal?.('👷 Personel Al', `
    <div style="display:flex;flex-direction:column;gap:12px">
      <div style="background:#0d1a2e;border-radius:8px;padding:12px;border:1px solid #1a2f4a">
        <div style="color:#94a3b8;font-size:12px">Kotanız: <b style="color:#f59e0b">${currentPersonel.length}/${quota}</b> personel</div>
        <div style="color:#94a3b8;font-size:12px;margin-top:4px">Maaş: <b style="color:#22c55e">${(window.cashFmt || (n=>n+'₺'))(adminWage)}/hafta</b> (admin tarafından belirlendi)</div>
      </div>
      <input id="sl_personelName" placeholder="Personel adı" 
        style="padding:10px;background:#080d1a;border:1px solid #1a2f4a;border-radius:8px;color:#e2e8f0;font-size:13px">
      <select id="sl_personelRole" style="padding:10px;background:#080d1a;border:1px solid #1a2f4a;border-radius:8px;color:#94a3b8;font-size:13px">
        <option value="kasiyer">💳 Kasiyer</option>
        <option value="guvenlık">🛡️ Güvenlik</option>
        <option value="depocu">📦 Depocu</option>
        <option value="muhasebe">📊 Muhasebeci</option>
        <option value="pazarlamaci">📢 Pazarlamacı</option>
      </select>
      <button onclick="window.SL_hirePersonel('${uid}','${businessKey}','${businessType}')"
        style="background:#16a34a;color:#fff;border:none;border-radius:8px;padding:12px;font-weight:700;cursor:pointer">✅ İşe Al</button>
    </div>
  `);
};

window.SL_hirePersonel = async function (uid, businessKey, businessType) {
  const name = document.getElementById('sl_personelName')?.value?.trim();
  const role = document.getElementById('sl_personelRole')?.value;
  if (!name) return window.toast?.('Personel adı gir', 'error');

  const adminWage = (await window.db.ref('system/minWage').once('value').then(s => s.val())) || 17000;

  const personel = {
    name,
    role,
    wage: adminWage,
    hiredAt: Date.now(),
    businessKey,
    businessType
  };

  await window.db.ref('users/' + uid + '/personel').push(personel);
  await window.db.ref('txlog').push({ uid, desc: 'Personel alımı: ' + name, amount: -adminWage, ts: Date.now() });

  window.closeModal?.();
  window.toast?.(`✅ ${name} işe alındı! Haftalık maaş: ${(window.cashFmt || (n=>n+'₺'))(adminWage)}`, 'success', 5000);
};

/* ══════════════════════════════════════════════════════════════════════════
   5. SGK SİSTEMİ
   ══════════════════════════════════════════════════════════════════════════ */
window.SL_paySGK = async function () {
  if (!window.GZ?.uid) return;
  const uid = window.GZ.uid;
  const userData = window.GZ.data || {};
  const personel = userData.personel ? Object.values(userData.personel) : [];

  if (personel.length === 0) {
    return window.toast?.('SGK ödemesi için personel almanız gerekiyor', 'warn');
  }

  const totalWage = personel.reduce((s, p) => s + (p.wage || 0), 0);
  const sgkAmount = Math.ceil(totalWage * 0.205); // %20.5 SGK işveren payı
  const money = userData.money || 0;

  window.showModal?.('🏥 SGK Ödemesi', `
    <div style="display:flex;flex-direction:column;gap:12px">
      <div style="background:#0d1a2e;border-radius:8px;padding:12px;border:1px solid #1a2f4a">
        <div style="color:#94a3b8;font-size:13px">Personel Sayısı: <b style="color:#e2e8f0">${personel.length}</b></div>
        <div style="color:#94a3b8;font-size:13px;margin-top:4px">Toplam Maaş: <b style="color:#f59e0b">${(window.cashFmt || (n=>n+'₺'))(totalWage)}</b></div>
        <div style="color:#94a3b8;font-size:13px;margin-top:4px">SGK Primi (%20.5): <b style="color:#ef4444">${(window.cashFmt || (n=>n+'₺'))(sgkAmount)}</b></div>
        <div style="color:#94a3b8;font-size:13px;margin-top:4px">Bakiyeniz: <b style="color:${money >= sgkAmount ? '#22c55e' : '#ef4444'}">${(window.cashFmt || (n=>n+'₺'))(money)}</b></div>
      </div>
      ${money < sgkAmount ? '<div style="color:#ef4444;font-size:12px;background:#ef444411;padding:10px;border-radius:6px;border:1px solid #ef444433">⚠️ Yetersiz bakiye! SGK primini ödeyemezsiniz. Vergi borcu oluşacak.</div>' : ''}
      <button onclick="window.SL_submitSGK(${sgkAmount})" ${money < sgkAmount ? 'disabled' : ''}
        style="background:${money < sgkAmount ? '#334155' : '#3b82f6'};color:#fff;border:none;border-radius:8px;padding:12px;font-weight:700;cursor:pointer">
        ${money < sgkAmount ? '❌ Yetersiz Bakiye' : '✅ SGK Primini Öde'}
      </button>
    </div>
  `);
};

window.SL_submitSGK = async function (amount) {
  const uid = window.GZ?.uid;
  if (!uid) return;

  await window.db.ref('users/' + uid + '/money').transaction(m => Math.max(0, (m || 0) - amount));
  await window.db.ref('users/' + uid + '/sgkLastPaid').set(Date.now());
  await window.db.ref('txlog').push({ uid, desc: 'SGK primi ödemesi', amount: -amount, ts: Date.now() });

  window.closeModal?.();
  window.toast?.('✅ SGK primi ödendi! ' + (window.cashFmt || (n=>n+'₺'))(amount), 'success', 5000);
};

/* ══════════════════════════════════════════════════════════════════════════
   6. İL SEÇİMİ — HESAP AÇILIŞI
   ══════════════════════════════════════════════════════════════════════════ */
window.SL_showProvinceSelector = function () {
  if (!window.GZ?.uid) return;
  if (window.GZ?.data?.province && window.GZ.data.province !== 'İstanbul') return; // Zaten seçilmiş

  const iller = [
    'Adana','Adıyaman','Afyonkarahisar','Ağrı','Amasya','Ankara','Antalya','Artvin','Aydın','Balıkesir',
    'Bilecik','Bingöl','Bitlis','Bolu','Burdur','Bursa','Çanakkale','Çankırı','Çorum','Denizli',
    'Diyarbakır','Edirne','Elazığ','Erzincan','Erzurum','Eskişehir','Gaziantep','Giresun','Gümüşhane','Hakkari',
    'Hatay','Isparta','İçel (Mersin)','İstanbul','İzmir','Kars','Kastamonu','Kayseri','Kırklareli','Kırşehir',
    'Kocaeli','Konya','Kütahya','Malatya','Manisa','Kahramanmaraş','Mardin','Muğla','Muş','Nevşehir',
    'Niğde','Ordu','Rize','Sakarya','Samsun','Siirt','Sinop','Sivas','Tekirdağ','Tokat',
    'Trabzon','Tunceli','Şanlıurfa','Uşak','Van','Yozgat','Zonguldak','Aksaray','Bayburt','Karaman',
    'Kırıkkale','Batman','Şırnak','Bartın','Ardahan','Iğdır','Yalova','Karabük','Kilis','Osmaniye','Düzce'
  ];

  const modal = document.createElement('div');
  modal.id = 'provinceSelectorModal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px';
  modal.innerHTML = `
    <div style="background:#0d1a2e;border:1px solid #3b82f6;border-radius:16px;padding:24px;max-width:480px;width:100%;max-height:80vh;overflow-y:auto">
      <h3 style="color:#e2e8f0;margin:0 0 8px;font-size:18px;text-align:center">🗺️ İlin Seç</h3>
      <p style="color:#94a3b8;font-size:13px;text-align:center;margin:0 0 20px">Hangi ilde yaşıyorsun? (Seçim ve yönetim sistemi için önemli)</p>
      <input id="provSearch" placeholder="🔍 İl ara..." oninput="window.SL_filterProvs(this.value)"
        style="width:100%;padding:10px;background:#080d1a;border:1px solid #1a2f4a;border-radius:8px;color:#e2e8f0;font-size:13px;margin-bottom:12px;box-sizing:border-box">
      <div id="provList" style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">
        ${iller.map(il => `
          <button onclick="window.SL_setProvince('${il}')"
            style="background:#080d1a;border:1px solid #1a2f4a;border-radius:8px;padding:8px;color:#94a3b8;font-size:12px;cursor:pointer;transition:.15s"
            onmouseover="this.style.background='#1e3a5f';this.style.color='#60a5fa'"
            onmouseout="this.style.background='#080d1a';this.style.color='#94a3b8'">${il}</button>`).join('')}
      </div>
    </div>
  `;
  document.body.appendChild(modal);
};

window.SL_filterProvs = function (q) {
  const list = document.getElementById('provList');
  if (!list) return;
  list.querySelectorAll('button').forEach(b => {
    b.style.display = b.textContent.toLowerCase().includes(q.toLowerCase()) ? 'block' : 'none';
  });
};

window.SL_setProvince = async function (il) {
  const uid = window.GZ?.uid;
  if (!uid) return;
  await window.db.ref('users/' + uid + '/province').set(il);
  await window.db.ref('users/' + uid + '/location').set(il);
  window.GZ.data = window.GZ.data || {};
  window.GZ.data.province = il;
  window.GZ.data.location = il;
  document.getElementById('provinceSelectorModal')?.remove();
  window.toast?.('✅ İlin ' + il + ' olarak ayarlandı!', 'success', 4000);
};

/* ══════════════════════════════════════════════════════════════════════════
   7. İL SEÇİCİYİ OYUN GİRİŞİNDE GÖSTER
   ══════════════════════════════════════════════════════════════════════════ */
(function waitForUser() {
  const _pw = setInterval(function () {
    if (!window.GZ?.uid || !window.GZ?.data) return;
    clearInterval(_pw);

    // İl seçilmemişse (veya varsayılan İstanbul ise yeni kullanıcı)
    const d = window.GZ.data;
    const createdAt = d.createdAt || 0;
    const isNew = Date.now() - (typeof createdAt === 'number' ? createdAt : 0) < 120000; // 2 dakikadan yeni

    if (isNew && (!d.province || d.province === 'İstanbul')) {
      setTimeout(() => window.SL_showProvinceSelector?.(), 2000);
    }
  }, 1000);
})();

/* ══════════════════════════════════════════════════════════════════════════
   8. BORSA / KRİPTO OTOMATİK GÜNCELLEME
   ══════════════════════════════════════════════════════════════════════════ */
(function autoMarkets() {
  let borsaInterval = null;
  let kriptoInterval = null;

  async function autoUpdateBorsa() {
    try {
      const autoMode = (await window.db?.ref('system/borsaAutoMode').once('value').then(s => s.val()));
      if (!autoMode) return;
      const prices = await window.db?.ref('borsaFiyatlar').once('value').then(s => s.val());
      if (!prices) return;
      const updates = {};
      for (const [k, v] of Object.entries(prices)) {
        const chg = (Math.random() * 0.04) - 0.02; // ±2%
        updates['borsaFiyatlar/' + k] = Math.max(1, Math.round(v * (1 + chg)));
      }
      await window.db?.ref().update(updates);
    } catch(e) {}
  }

  async function autoUpdateKripto() {
    try {
      const autoMode = await window.db?.ref('system/kriptoAutoMode').once('value').then(s => s.val());
      if (!autoMode) return;
      const prices = await window.db?.ref('kriptoPrices').once('value').then(s => s.val());
      if (!prices) return;
      const updates = {};
      for (const [k, v] of Object.entries(prices)) {
        const chg = (Math.random() * 0.06) - 0.03; // ±3%
        updates['kriptoPrices/' + k] = Math.max(1, Math.round(v * (1 + chg)));
      }
      await window.db?.ref().update(updates);
    } catch(e) {}
  }

  // Her 5 dakikada bir otomatik güncelle (sadece admin açmışsa)
  const _mWait = setInterval(function () {
    if (!window.db) return;
    clearInterval(_mWait);
    borsaInterval = setInterval(autoUpdateBorsa, 5 * 60 * 1000);
    kriptoInterval = setInterval(autoUpdateKripto, 3 * 60 * 1000);
  }, 2000);

  window.SL_stopAutoMarkets = function () {
    if (borsaInterval) clearInterval(borsaInterval);
    if (kriptoInterval) clearInterval(kriptoInterval);
  };
})();

/* ══════════════════════════════════════════════════════════════════════════
   9. SATIŞ SİSTEMİ DÜZELTMESİ — Reyon stok kontrolü
   ══════════════════════════════════════════════════════════════════════════ */

// Satış için reyon stok kontrolü
window.SL_checkStock = async function (ownerUid, dukkanKey, reyonKey) {
  const stok = await window.db?.ref(`users/${ownerUid}/dukkanlar/${dukkanKey}/reyonlar/${reyonKey}/stok`).once('value').then(s => s.val());
  return (stok || 0) > 0;
};

// Reyon dolum (robot veya manuel)
window.SL_fillReyon = async function (ownerUid, dukkanKey, reyonKey, amount) {
  amount = amount || 100;
  const urun = await window.db?.ref(`users/${ownerUid}/dukkanlar/${dukkanKey}/reyonlar/${reyonKey}`).once('value').then(s => s.val());
  if (!urun) return false;

  const cost = (urun.basePrice || 10) * amount * 0.6; // maliyet
  const money = await window.db?.ref(`users/${ownerUid}/money`).once('value').then(s => s.val()) || 0;
  if (money < cost) return false;

  await window.db?.ref(`users/${ownerUid}/money`).transaction(m => Math.max(0, (m || 0) - cost));
  await window.db?.ref(`users/${ownerUid}/dukkanlar/${dukkanKey}/reyonlar/${reyonKey}/stok`).set(amount);
  await window.db?.ref(`users/${ownerUid}/dukkanlar/${dukkanKey}/reyonlar/${reyonKey}/lastRefill`).set(Date.now());
  return true;
};

/* ══════════════════════════════════════════════════════════════════════════
   10. GAYRİMENKUL OTOMATİK GÜNCELLEME (saatte bir yeni ilan)
   ══════════════════════════════════════════════════════════════════════════ */
(function autoGayrimenkul() {
  const _gWait = setInterval(function () {
    if (!window.db) return;
    clearInterval(_gWait);

    async function refreshListings() {
      try {
        // Son güncelleme zamanı
        const lastUpdate = await window.db.ref('gayrimenkul/lastAutoUpdate').once('value').then(s => s.val());
        if (lastUpdate && Date.now() - lastUpdate < 3600000) return; // 1 saatten yeni

        const iller = ['İstanbul','Ankara','İzmir','Bursa','Antalya','Samsun','Gaziantep','Konya'];
        const tipler = [
          { type: 'Daire', emoji: '🏢', rooms: ['1+1','2+1','3+1','4+1'], basePrice: 2500000 },
          { type: 'Villa', emoji: '🏡', rooms: ['3+1','4+2','5+2'], basePrice: 8000000 },
          { type: 'Arsa', emoji: '🌿', rooms: ['500m²','1000m²','2000m²'], basePrice: 1000000 },
          { type: 'İşyeri', emoji: '🏪', rooms: ['50m²','100m²','200m²'], basePrice: 3000000 },
        ];

        const listings = {};
        for (let i = 0; i < 12; i++) {
          const tip = tipler[Math.floor(Math.random() * tipler.length)];
          const il = iller[Math.floor(Math.random() * iller.length)];
          const rooms = tip.rooms[Math.floor(Math.random() * tip.rooms.length)];
          const price = Math.round(tip.basePrice * (0.7 + Math.random() * 0.9));
          const key = 'listing_' + Date.now() + '_' + i;

          listings[key] = {
            type: tip.type,
            emoji: tip.emoji,
            rooms,
            province: il,
            price,
            listedAt: Date.now(),
            expiresAt: Date.now() + 3600000,
            owner: 'sistem',
            available: true
          };
        }

        await window.db.ref('gayrimenkul/listings').update(listings);
        await window.db.ref('gayrimenkul/lastAutoUpdate').set(Date.now());

        // Süresi dolmuş ilanları temizle
        const all = await window.db.ref('gayrimenkul/listings').once('value').then(s => s.val()) || {};
        const now = Date.now();
        const removals = {};
        for (const [k, v] of Object.entries(all)) {
          if (v.expiresAt && v.expiresAt < now) removals['gayrimenkul/listings/' + k] = null;
        }
        if (Object.keys(removals).length) await window.db.ref().update(removals);

      } catch(e) { console.warn('[AutoGayrimenkul]', e); }
    }

    refreshListings();
    setInterval(refreshListings, 3600000); // Her saat
  }, 3000);
})();

console.log('[SystemLogic] ✅ system-logic.js yüklendi');
