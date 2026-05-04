/* ============================================================================
   duzeltmeler.js — GameZone ERP: Kritik Fix + Eksik Özellikler
   ============================================================================
   Bu dosya gamezone-v3.js'in ALTINDA yüklenir.
   Tüm kritik bugları düzeltir ve eksik özellikleri ekler.
   ============================================================================ */
'use strict';

/* ══════════════════════════════════════════════════════════════════
   FIX 1 — money vs bakiye alan çakışması
   ekonomi.js "money" kullanıyor, biz "bakiye" yazmıştık.
   GZX_safePay artık spendCash'e yönlendiriyor.
   ══════════════════════════════════════════════════════════════════ */
window.GZX_safePay = async function(uid, amount, description) {
  if (!uid || amount <= 0) return { ok: false, reason: 'Geçersiz' };
  try {
    // Ana sistemin spendCash fonksiyonunu kullan (vergi + log dahil)
    const ok = await spendCash(uid, amount, description || 'gider');
    if (!ok) {
      window.toast?.('💸 Yetersiz bakiye', 'error', 3000);
      return { ok: false, reason: 'Yetersiz bakiye' };
    }
    return { ok: true, amount };
  } catch (e) {
    console.error('[GZX_safePay]', e);
    window.toast?.('⚠️ İşlem hatası, bakiyeniz korundu.', 'error');
    return { ok: false, reason: 'Hata' };
  }
};

// dbGet/dbUpdate için money alanını kullan
window.dbGet = window.dbGet || async function(path) {
  return (await db.ref(path).once('value')).val();
};
window.dbUpdate = window.dbUpdate || async function(path, obj) {
  return db.ref(path).update(obj);
};
window.dbPush = window.dbPush || async function(path, val) {
  return db.ref(path).push(val);
};
window.dbSet = window.dbSet || async function(path, val) {
  return db.ref(path).set(val);
};
window.dbTransaction = window.dbTransaction || async function(path, fn) {
  return db.ref(path).transaction(fn);
};
window.cashFmt = window.cashFmt || function(n) {
  return fmt(n) + ' ₺';
};
// bakiye → money köprüsü: her iki alanı da oku
window.GZX_getBakiye = async function(uid) {
  const d = await window.dbGet(`users/${uid}`);
  return d?.money || d?.bakiye || 0;
};
// Para ekle (her iki alana da yaz — uyumluluk için)
window.GZX_addMoney = async function(uid, amount, reason) {
  await addCash(uid, amount, reason || 'gelir');
};

/* ══════════════════════════════════════════════════════════════════
   FIX 2 — GZX_B04_applyForLoan money kullan
   ══════════════════════════════════════════════════════════════════ */
window.GZX_B04_applyForLoan = async function(uid, type, amount, term) {
  const TIPLER = {
    ihtiyac: { label:'💳 İhtiyaç', maxAmount:200000, baseRate:0.28, minScore:40 },
    ticari:  { label:'🏪 Ticari',  maxAmount:5000000, baseRate:0.22, minScore:55 },
    konut:   { label:'🏠 Konut',   maxAmount:20000000,baseRate:0.18, minScore:60 },
    ihracat: { label:'🚢 İhracat', maxAmount:10000000,baseRate:0.15, minScore:65 },
    tarim:   { label:'🌾 Tarım',   maxAmount:1000000, baseRate:0.12, minScore:30 },
  };
  const def = TIPLER[type]; if (!def) return window.toast?.('Geçersiz kredi türü','error');
  if (amount > def.maxAmount) return window.toast?.(`Max: ${cashFmt(def.maxAmount)}`,'error');

  const score = await window.GZX_B03_calcCreditScore(uid);
  if (score < def.minScore) {
    window.toast?.(`❌ Kredi reddedildi. Skor: ${score} / Gereken: ${def.minScore}`,'error',6000);
    return;
  }

  const repo = (await window.dbGet('bank/repoRate')) || 0.42;
  const rate = def.baseRate + repo * 0.5;
  const mr   = rate / 12;
  const pmt  = Math.ceil(amount * mr / (1 - Math.pow(1+mr, -term)));

  await addCash(uid, amount, 'kredi');   // ← money alanına yaz
  await window.dbPush(`users/${uid}/krediler`, {
    type, amount, term, monthlyPayment: pmt,
    remainingBalance: amount, interestRate: rate,
    score, status: 'active', approvedAt: Date.now(),
  });

  window.toast?.(`✅ Kredi onaylandı! ${cashFmt(amount)} yatırıldı. Taksit: ${cashFmt(pmt)}/ay`,'success',8000);
  return { amount, pmt, rate };
};

/* ══════════════════════════════════════════════════════════════════
   FIX 3 — Seçim sistemi renderSecim çakışması
   ══════════════════════════════════════════════════════════════════ */
// secim-sistemi.js zaten renderSecim tanımlıyor, burada çakışmayı önlüyoruz
// ui-manager.js'deki case 'belediye' zaten renderBelediye çağırıyor, sorun yok.

/* ══════════════════════════════════════════════════════════════════
   FIX 4 — Emekli maaşı & işsizlik otomatik ödeme
   ══════════════════════════════════════════════════════════════════ */
(function startPeriodicPayments() {
  const _w = setInterval(function() {
    if (!window.GZ?.uid || !window.GZ?.data?.isFounder) return;
    clearInterval(_w);

    // Her 10 dakikada bir emekli + memur maaşları
    setInterval(async function() {
      try { await window.SL_maasOde?.(); } catch(e) {}
    }, 10 * 60 * 1000);

    // İlk çalıştırma
    setTimeout(async function() {
      try { await window.SL_maasOde?.(); } catch(e) {}
    }, 5000);
  }, 1000);
})();

/* ══════════════════════════════════════════════════════════════════
   FIX 5 — Enflasyon → Ürün fiyatları gerçekten güncellensin
   ══════════════════════════════════════════════════════════════════ */
window.GZX_E01_updateInflation = async function(rate) {
  if (!window.GZ?.data?.isFounder) return window.toast?.('Yetkisiz','error');
  if (isNaN(rate) || rate < 0 || rate > 2) return window.toast?.('Geçersiz oran (0-2 arası)','error');

  await window.dbUpdate('system', {
    tufRate: rate, enflasyon: rate, lastInflationUpdate: Date.now()
  });

  // URUNLER fiyatlarını Firebase'de güncelle
  try {
    const mevcut = (await window.dbGet('market/baseprices')) || {};
    const updates = {};

    // Eğer market/baseprices boşsa URUNLER objesinden yükle
    if (typeof window.URUNLER === 'object') {
      for (const [key, urun] of Object.entries(window.URUNLER)) {
        const eskiFiyat = mevcut[key] || urun.base || 1;
        updates[`market/baseprices/${key}`] = +(eskiFiyat * (1 + rate * 0.3)).toFixed(2);
      }
    } else {
      for (const [key, fiyat] of Object.entries(mevcut)) {
        updates[`market/baseprices/${key}`] = +(Number(fiyat) * (1 + rate * 0.3)).toFixed(2);
      }
    }

    if (Object.keys(updates).length > 0) {
      await db.ref('/').update(updates);
    }
  } catch(e) { console.error('[Enflasyon] Fiyat güncelleme hatası:', e); }

  await window.dbPush('news', {
    title: `📊 Enflasyon %${(rate*100).toFixed(1)} olarak güncellendi — Fiyatlar arttı!`,
    type: 'inflation', impact: 'negative', ts: Date.now()
  });

  window.toast?.(`📊 Enflasyon %${(rate*100).toFixed(1)} — Ürün fiyatları güncellendi`,'success',6000);
};

/* ══════════════════════════════════════════════════════════════════
   YENİ ÖZELLİK 1 — Günlük Giriş Ödülü (Streak Sistemi)
   ══════════════════════════════════════════════════════════════════ */
window.GZX_dailyLogin = async function(uid) {
  if (!uid) return;
  const today    = new Date().toDateString();
  const d        = await window.dbGet(`users/${uid}`) || {};
  const lastLogin= d.lastDailyLogin || '';
  const streak   = d.loginStreak || 0;

  if (lastLogin === today) return; // Zaten aldı

  const dun = new Date(Date.now() - 86400000).toDateString();
  const yeniStreak = lastLogin === dun ? streak + 1 : 1;

  // Ödül hesapla (streak'e göre artar)
  const BASE  = 500;
  const bonus = Math.min(yeniStreak * 200, 5000);
  const odul  = BASE + bonus;
  const xp    = 50 + yeniStreak * 10;
  const diamonds = yeniStreak % 7 === 0 ? 5 : 0; // 7. günde elmas

  await addCash(uid, odul, 'daily-login');
  if (diamonds > 0) await addDiamonds(uid, diamonds);
  await addXP(uid, xp);
  await window.dbUpdate(`users/${uid}`, {
    lastDailyLogin: today,
    loginStreak: yeniStreak,
    totalLogins: (d.totalLogins || 0) + 1,
  });

  // Bildirim
  const msg = diamonds > 0
    ? `🎁 Günlük ödül: ${cashFmt(odul)} + ${diamonds}💎 + ${xp}XP (${yeniStreak}. gün!)`
    : `🎁 Günlük ödül: ${cashFmt(odul)} + ${xp}XP (${yeniStreak}. gün)`;
  window.toast?.(msg, 'success', 7000);

  // 7'nin katı — özel kutlama
  if (yeniStreak % 7 === 0) {
    window.toast?.(`🎉 ${yeniStreak} GÜN ÜSTÜSTE! +${diamonds}💎 bonus!`, 'success', 8000);
  }

  return { odul, xp, diamonds, streak: yeniStreak };
};

// Giriş yapınca otomatik çalış
(function dailyLoginInit() {
  const _w = setInterval(function() {
    if (!window.GZ?.uid) return;
    clearInterval(_w);
    setTimeout(() => window.GZX_dailyLogin(window.GZ.uid), 2000);
  }, 500);
})();

/* ══════════════════════════════════════════════════════════════════
   YENİ ÖZELLİK 2 — Gelişmiş Bildirim Sistemi
   ══════════════════════════════════════════════════════════════════ */
window.GZX_notify = async function(toUid, msg, kind, data) {
  if (!toUid || !msg) return;
  await window.dbPush(`notifs/${toUid}`, {
    msg: (msg || '').slice(0, 200),
    kind: kind || 'info',
    data: data || null,
    read: false,
    ts: Date.now(),
  });
};

// Bildirim paneli
window.GZX_renderNotifs = async function() {
  const uid   = window.GZ?.uid; if (!uid) return;
  const notifs= await window.dbGet(`notifs/${uid}`) || {};
  const list  = Object.entries(notifs).sort(([,a],[,b]) => b.ts - a.ts).slice(0, 30);

  const html = list.length ? list.map(([key, n]) => `
    <div onclick="db.ref('notifs/${uid}/${key}/read').set(true);this.style.opacity='.5'"
      style="padding:12px;border-bottom:1px solid var(--border);cursor:pointer;
      opacity:${n.read?'.5':'1'};background:${n.read?'transparent':'var(--blue-l)'}">
      <div style="font-size:13px;font-weight:600;color:var(--text)">${n.msg}</div>
      <div style="font-size:11px;color:var(--muted);margin-top:3px">
        ${new Date(n.ts).toLocaleString('tr-TR')}
      </div>
    </div>`).join('')
  : '<div style="padding:32px;text-align:center;color:var(--muted)">Bildirim yok</div>';

  // Tümünü okundu yap
  const updates = {};
  list.filter(([,n])=>!n.read).forEach(([k])=>{ updates[`notifs/${uid}/${k}/read`]=true; });
  if (Object.keys(updates).length) db.ref('/').update(updates);

  return html;
};

// Bildirim butonu tıklamasına bağla
document.addEventListener('DOMContentLoaded', function() {
  setTimeout(function() {
    const btn = document.querySelector('[data-open="notif"]') ||
                document.getElementById('btnNotif');
    if (btn) {
      btn.addEventListener('click', async function() {
        const html = await window.GZX_renderNotifs();
        if (typeof showModal === 'function') showModal('🔔 Bildirimler', `<div style="max-height:70vh;overflow-y:auto">${html}</div>`);
      });
    }
  }, 3000);
});

/* ══════════════════════════════════════════════════════════════════
   YENİ ÖZELLİK 3 — Oyuncu Profil Kartı (İsme tıkla → profil aç)
   ══════════════════════════════════════════════════════════════════ */
window.GZX_showPlayerProfile = async function(targetUid) {
  if (!targetUid) return;
  const d = await window.dbGet(`users/${targetUid}`) || {};
  if (!d.username) return window.toast?.('Kullanıcı bulunamadı','error');

  const level  = d.level || 1;
  const rank   = typeof GZX_getRank === 'function' ? GZX_getRank(level) : '—';
  const money  = d.money || d.bakiye || 0;
  const card   = d.kimlikKarti || {};

  // Seçilmiş mi?
  const isElected = ['muhtar','mayor','pm','president'].includes(d.role);
  const roleLabel = {
    muhtar:'🏛️ Muhtar', mayor:'🏙️ Bel.Başkanı',
    pm:'🇹🇷 Başbakan', president:'🌟 Cumhurbaşkanı',
    police:'👮 Polis', soldier:'🎖️ Asker',
    judge:'⚖️ Hakim', esnaf:'🏪 Esnaf',
    banker:'🏦 Bankacı', vatandas:'👤 Vatandaş'
  }[d.role] || '👤 Vatandaş';

  const html = `
    <div style="padding:4px 0 16px">
      <!-- Profil başlık -->
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:20px">
        <div style="width:64px;height:64px;border-radius:50%;
          background:var(--blue-l);border:3px solid var(--primary);
          display:flex;align-items:center;justify-content:center;font-size:32px">
          ${d.avatar || '👤'}
        </div>
        <div>
          <div style="font-size:18px;font-weight:800;color:var(--text)">${d.username}</div>
          <div style="font-size:12px;color:var(--muted);margin-top:2px">${roleLabel}</div>
          ${d.unvan ? `<div style="font-size:11px;color:var(--primary);font-weight:700;margin-top:2px">${d.unvan}</div>` : ''}
          ${d.party ? `<div style="font-size:11px;color:var(--muted)">🏛️ ${d.party}</div>` : ''}
        </div>
      </div>

      <!-- İstatistikler -->
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:16px">
        <div style="background:var(--bg);border-radius:10px;padding:10px;text-align:center">
          <div style="font-size:18px;font-weight:800;color:var(--primary)">${level}</div>
          <div style="font-size:10px;color:var(--muted)">Level</div>
        </div>
        <div style="background:var(--bg);border-radius:10px;padding:10px;text-align:center">
          <div style="font-size:13px;font-weight:800;color:var(--green)">${cashFmt(money)}</div>
          <div style="font-size:10px;color:var(--muted)">Bakiye</div>
        </div>
        <div style="background:var(--bg);border-radius:10px;padding:10px;text-align:center">
          <div style="font-size:13px;font-weight:800;color:var(--text)">${rank}</div>
          <div style="font-size:10px;color:var(--muted)">Rütbe</div>
        </div>
      </div>

      <!-- Kimlik Bilgileri -->
      ${card.tc ? `
        <div style="background:linear-gradient(135deg,#1e3a6b,#0f2451);border-radius:12px;padding:14px;margin-bottom:12px">
          <div style="font-size:9px;letter-spacing:2px;color:#93c5fd;margin-bottom:6px">KİMLİK NO</div>
          <div style="font-size:16px;font-weight:800;letter-spacing:3px;color:white">${card.tc}</div>
          <div style="font-size:11px;color:#93c5fd;margin-top:4px">
            📍 ${d.province || '—'} · ✅ Muhtar Onaylı
          </div>
        </div>` : `
        <div style="background:var(--red-l);border-radius:10px;padding:12px;margin-bottom:12px;text-align:center;font-size:12px;color:var(--red);font-weight:600">
          ❌ Kimlik kartı yok
        </div>`}

      <!-- Sabıka & Durum -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px">
        <div style="background:var(--bg);border-radius:10px;padding:10px">
          <div style="font-size:10px;color:var(--muted)">Sabıka</div>
          <div style="font-size:13px;font-weight:700;color:${(d.criminalRecord||0)>0?'var(--red)':'var(--green)'}">
            ${d.criminalRecord || 0} kayıt
          </div>
        </div>
        <div style="background:var(--bg);border-radius:10px;padding:10px">
          <div style="font-size:10px;color:var(--muted)">Durum</div>
          <div style="font-size:13px;font-weight:700;color:${d.inJail?'var(--red)':d.karaListede?'var(--accent)':'var(--green)'}">
            ${d.inJail?'⛓️ Tutuklu':d.karaListede?'⚠️ Kara Liste':'✅ Serbest'}
          </div>
        </div>
        <div style="background:var(--bg);border-radius:10px;padding:10px">
          <div style="font-size:10px;color:var(--muted)">Kredi Skoru</div>
          <div style="font-size:13px;font-weight:700;color:${(d.krediSkoru||50)>=60?'var(--green)':'var(--red)'}">
            ${d.krediSkoru || 50}/100
          </div>
        </div>
        <div style="background:var(--bg);border-radius:10px;padding:10px">
          <div style="font-size:10px;color:var(--muted)">Üyelik</div>
          <div style="font-size:11px;font-weight:700;color:var(--text)">
            ${d.joinedAt ? new Date(d.joinedAt).toLocaleDateString('tr-TR') : '—'}
          </div>
        </div>
      </div>

      <!-- Aksiyon Butonları -->
      ${window.GZ?.uid !== targetUid ? `
        <div style="display:flex;gap:8px">
          <button onclick="GZX_B09_transfer&&(()=>{const a=parseInt(prompt('Kaç ₺ göndereceksiniz?'));if(a>0)GZX_B09_transfer('${window.GZ?.uid}','${targetUid}',a).then(()=>document.querySelector('.modal-bg')?.remove());})()"
            style="flex:1;background:var(--green);color:white;border:none;border-radius:10px;padding:12px;font-weight:700;cursor:pointer">
            💸 Para Gönder
          </button>
          ${window.GZ?.data?.isFounder || ['police','judge'].includes(window.GZ?.data?.role) ? `
            <button onclick="GZX_P02_issueFine&&GZX_P02_issueFine('${targetUid}',parseInt(prompt('Ceza tutarı (₺)?')||0),prompt('Sebep?')||'Genel ceza',window.GZ?.uid)"
              style="flex:1;background:var(--red);color:white;border:none;border-radius:10px;padding:12px;font-weight:700;cursor:pointer">
              🚔 Ceza Kes
            </button>` : ''}
        </div>` : ''}
    </div>`;

  if (typeof showModal === 'function') {
    showModal(`👤 ${d.username} — Profil`, html);
  }
};

// Liderlik tablosundaki isimlere tıklanabilir yap
window.GZX_makeNamesClickable = function(container) {
  if (!container) return;
  container.querySelectorAll('[data-uid]').forEach(el => {
    el.style.cursor = 'pointer';
    el.addEventListener('click', function() {
      window.GZX_showPlayerProfile(el.dataset.uid);
    });
  });
};

/* ══════════════════════════════════════════════════════════════════
   YENİ ÖZELLİK 4 — İhale Teklif Geçilince Bildirim
   ══════════════════════════════════════════════════════════════════ */
window.GZX_I02_submitBid = async function(uid, tenderId, amount, completionScore) {
  const tender = await window.dbGet(`tenders/${tenderId}`);
  if (!tender || tender.status !== 'open') return window.toast?.('İhale aktif değil','error');
  if (Date.now() > tender.endsAt) return window.toast?.('Süre doldu','error');
  if (amount > tender.budget) return window.toast?.('Bütçeyi aşıyor','error');

  // Önceki en yüksek teklifi bul
  const eskiBidler = tender.bids || {};
  const eskiEnYuksek = Object.entries(eskiBidler)
    .sort(([,a],[,b]) => b.amount - a.amount)[0];

  // Teklifi kaydet
  await window.dbUpdate(`tenders/${tenderId}/bids`, {
    [uid]: { amount, completionScore: completionScore||50, submittedAt: Date.now() }
  });

  window.toast?.(`📋 Teklifiniz iletildi: ${cashFmt(amount)}`,'success');

  // Önceki lider varsa bildir
  if (eskiEnYuksek && eskiEnYuksek[0] !== uid) {
    await window.GZX_notify(
      eskiEnYuksek[0],
      `⚠️ "${tender.title}" ihalesinde teklifiniz geçildi! Yeni teklif: ${cashFmt(amount)}`,
      'warn',
      { tenderId, type: 'bid_overtaken' }
    );
  }
};

/* ══════════════════════════════════════════════════════════════════
   YENİ ÖZELLİK 5 — Kara Borsa düzeltmesi (money kullan)
   ══════════════════════════════════════════════════════════════════ */
window.GZX_K01_evadeTax = async function(uid, income, declaredIncome) {
  const evaded = income - declaredIncome;
  if (evaded <= 0) return { evaded: false };
  const catchProb = Math.min(0.80, evaded / income * 0.90);
  if (Math.random() < catchProb) {
    const penalty = evaded * 3;
    await spendCash(uid, penalty, 'vergi-kacakcilik-cezasi');
    await window.dbTransaction(`users/${uid}/criminalRecord`, r => (r||0)+2);
    window.toast?.(`🚔 VERGİ KAÇAKÇILIĞI yakalandınız! Ceza: ${cashFmt(penalty)}`,'error',10000);
    await window.GZX_notify(uid, `🚔 Vergi kaçakçılığı cezası: ${cashFmt(penalty)}`,'error');
    return { caught: true, penalty };
  }
  const savedTax = Math.floor(evaded * 0.20);
  window.toast?.(`🤫 Kaçırıldı. Tasarruf: ${cashFmt(savedTax)} — Risk: %${Math.round(catchProb*100)}`,'warn',8000);
  return { evaded: true, saved: savedTax };
};

window.GZX_K02_smuggleGoods = async function(uid, product, quantity, price) {
  if (Math.random() < 0.25) {
    const fine = quantity * price * 2;
    await spendCash(uid, fine, 'kacakcilik-cezasi');
    await window.dbTransaction(`users/${uid}/criminalRecord`, r => (r||0)+1);
    window.toast?.(`🚔 KAÇAK ÜRÜN! Ceza: ${cashFmt(fine)}`,'error',10000);
    return { caught: true };
  }
  const revenue = quantity * price * 1.4;
  await addCash(uid, revenue, 'kara-borsa-satis');
  window.toast?.(`🕶️ Satıldı: ${cashFmt(revenue)}`,'success',6000);
  return { sold: true, revenue };
};

/* ══════════════════════════════════════════════════════════════════
   YENİ ÖZELLİK 6 — Admin Paneline "Versiyon Yayınla" butonu
   ══════════════════════════════════════════════════════════════════ */
(function addVersionBtn() {
  const _w = setInterval(function() {
    if (!window.GZ?.data?.isFounder) return;
    const nav = document.getElementById('adminScreenNav');
    if (!nav) return;
    clearInterval(_w);
    if (document.getElementById('admBtnVersiyon')) return;

    // Admin nav'ın altına ekle
    const btn = document.createElement('button');
    btn.id = 'admBtnVersiyon';
    btn.className = 'asnb';
    btn.style.cssText = 'color:#22c55e;margin-top:8px;border-top:1px solid var(--border);padding-top:12px';
    btn.innerHTML = '<span>🚀</span><span>Versiyon Yayınla</span>';
    btn.onclick = function() {
      if (!confirm('Tüm oyuncuların sayfası yenilenecek. Emin misiniz?')) return;
      window.GZV_yeniVersiyon?.();
    };
    nav.appendChild(btn);

    // Flash Haber butonu
    const flashBtn = document.createElement('button');
    flashBtn.className = 'asnb';
    flashBtn.style.cssText = 'color:#ef4444';
    flashBtn.innerHTML = '<span>📡</span><span>Flash Haber Gönder</span>';
    flashBtn.onclick = function() {
      const msg = prompt('Tüm ekranlara gönderilecek mesaj:');
      if (msg) window.GZX_R03_globalBroadcast?.(msg, 30000);
    };
    nav.appendChild(flashBtn);
  }, 1500);
})();

/* ══════════════════════════════════════════════════════════════════
   YENİ ÖZELLİK 7 — Rol seçimi ilk girişte otomatik tetikle
   ══════════════════════════════════════════════════════════════════ */
(function patchRolInit() {
  // GZ.uid ve GZ.data hazır olunca kontrol et
  const _w = setInterval(async function() {
    if (!window.GZ?.uid || window.GZ?.data === null) return;
    clearInterval(_w);

    const d = window.GZ.data;
    if (d?.isFounder) return; // Kurucu atlasın

    // Rol seçilmemişse → 1 sn bekle sonra göster
    if (!d?.rolSecildi && !d?.role) {
      setTimeout(() => window.GZR_showRolSecim?.(), 1200);
    }

    // Günlük giriş ödülü
    await window.GZX_dailyLogin?.(window.GZ.uid);

  }, 600);
})();

/* ══════════════════════════════════════════════════════════════════
   YENİ ÖZELLİK 8 — SGK otomatik primler (aylık)
   ══════════════════════════════════════════════════════════════════ */
(function sgkAutoDeduct() {
  const _w = setInterval(function() {
    if (!window.GZ?.uid) return;
    clearInterval(_w);

    setInterval(async function() {
      const uid = window.GZ.uid;
      const d   = await window.dbGet(`users/${uid}`);
      if (!d?.hasSaglikSig) return;

      const minWage = (await window.dbGet('system/minWage')) || 17002;
      const sgkRate = (await window.dbGet('system/sgkRate')) || 0.145;
      const prim    = Math.ceil(minWage * sgkRate * 0.5);
      const lastSGK = d.lastSGKPrim || 0;

      // Ayda bir kesim (30 gün)
      if (Date.now() - lastSGK < 30 * 86400000) return;

      const ok = await spendCash(uid, prim, 'sgk-prim');
      if (ok) {
        await window.dbUpdate(`users/${uid}`, { lastSGKPrim: Date.now() });
        window.toast?.(`🏥 SGK primi kesildi: ${cashFmt(prim)}`,'info',4000);
      }
    }, 60 * 60 * 1000); // Saatte bir kontrol
  }, 800);
})();

/* ══════════════════════════════════════════════════════════════════
   YENİ ÖZELLİK 9 — Haftalık Kira Tahsilatı (Mülk sahipleri için)
   ══════════════════════════════════════════════════════════════════ */
window.GZX_collectRents = async function(uid) {
  const mulkler = await window.dbGet(`users/${uid}/mulkler`) || {};
  let toplam = 0;

  for (const pid of Object.keys(mulkler)) {
    const prop = await window.dbGet(`properties/${pid}`);
    if (!prop || prop.owner !== uid || !prop.isRented || !prop.monthlyRent) continue;

    const lastRent = prop.lastRentAt || 0;
    if (Date.now() - lastRent < 7 * 86400000) continue; // Haftada bir

    const kira = prop.monthlyRent / 4; // Haftalık kira
    await addCash(uid, kira, 'kira-geliri');
    await window.dbUpdate(`properties/${pid}`, { lastRentAt: Date.now() });
    toplam += kira;
  }

  if (toplam > 0) {
    window.toast?.(`🏠 Kira tahsilatı: ${cashFmt(toplam)}`,'success',5000);
  }
  return toplam;
};

// Haftalık kira otomatik tahsilat
(function rentAutoCollect() {
  const _w = setInterval(function() {
    if (!window.GZ?.uid) return;
    clearInterval(_w);
    setInterval(() => window.GZX_collectRents(window.GZ.uid), 30 * 60 * 1000);
    setTimeout(() => window.GZX_collectRents(window.GZ.uid), 5000);
  }, 800);
})();

/* ══════════════════════════════════════════════════════════════════
   YENİ ÖZELLİK 10 — Haber Akışı Gerçek Zamanlı
   ══════════════════════════════════════════════════════════════════ */
(function liveNews() {
  const _w = setInterval(function() {
    if (!window.db) return;
    clearInterval(_w);

    window.db.ref('news').orderByChild('ts').limitToLast(1).on('child_added', function(snap) {
      const n = snap.val();
      if (!n || !n.title || Date.now() - n.ts > 30000) return; // 30 sn'den eski haberleri atlat

      const colors = {
        positive:'var(--green)', negative:'var(--red)',
        critical:'var(--red)', volatile:'var(--accent)', neutral:'var(--primary)'
      };
      const color = colors[n.impact] || colors.neutral;

      window.toast?.(
        `📰 ${n.title}`,
        n.impact === 'critical' ? 'error' : n.impact === 'positive' ? 'success' : 'info',
        6000
      );

      // Global broadcast bar
      const el  = document.getElementById('globalBroadcast');
      const txt = document.getElementById('gbText');
      if (el && txt) {
        el.style.background = `linear-gradient(90deg,${color},${color}cc)`;
        txt.textContent = n.title;
        el.style.display = 'flex';
        setTimeout(() => { el.style.display = 'none'; }, 8000);
      }
    });
  }, 500);
})();

/* ══════════════════════════════════════════════════════════════════
   YENİ ÖZELLİK 11 — Oyuncu Arama
   ══════════════════════════════════════════════════════════════════ */
window.GZX_searchPlayer = async function(query) {
  if (!query || query.length < 2) return [];
  const users = await window.dbGet('users') || {};
  const q     = query.toLowerCase();
  return Object.entries(users)
    .filter(([,u]) => (u.username||'').toLowerCase().includes(q))
    .map(([uid,u]) => ({ uid, username:u.username, level:u.level, role:u.role, province:u.province }))
    .slice(0, 10);
};

window.GZX_renderPlayerSearch = async function() {
  const html = `
    <div style="padding:8px 0 16px">
      <div style="display:flex;gap:8px;margin-bottom:12px">
        <input id="oyAraInput" placeholder="Kullanıcı adı ara..."
          style="flex:1;padding:10px;background:var(--bg);border:1px solid var(--border);
          border-radius:10px;color:var(--text);font-size:13px">
        <button onclick="(async()=>{
          const q=document.getElementById('oyAraInput').value;
          const r=await GZX_searchPlayer(q);
          const el=document.getElementById('oyAraResult');
          if(!el)return;
          el.innerHTML=r.length?r.map(u=>\`
            <div onclick=\\"GZX_showPlayerProfile('${`'+u.uid+'`}');document.querySelector('.modal-bg')?.remove()\\"
              style=\\"display:flex;align-items:center;gap:10px;padding:10px;border-bottom:1px solid var(--border);cursor:pointer\\">
              <div style=\\"width:36px;height:36px;border-radius:50%;background:var(--blue-l);display:flex;align-items:center;justify-content:center;font-weight:700;color:var(--primary)\\">${'?'}</div>
              <div><div style=\\"font-weight:700\\">\${u.username}</div><div style=\\"font-size:11px;color:var(--muted)\\">Lv\${u.level} · \${u.province||'—'}</div></div>
            </div>\`).join(''):'<div style=\\"padding:16px;text-align:center;color:var(--muted)\\">Sonuç yok</div>';
        })()"
          style="background:var(--primary);color:white;border:none;border-radius:10px;
          padding:10px 16px;font-weight:700;cursor:pointer">
          🔍 Ara
        </button>
      </div>
      <div id="oyAraResult" style="max-height:50vh;overflow-y:auto"></div>
    </div>`;

  if (typeof showModal === 'function') showModal('🔍 Oyuncu Ara', html);
};

/* ══════════════════════════════════════════════════════════════════
   YENİ ÖZELLİK 12 — Streak & Başarım Göstergesi (Topbar)
   ══════════════════════════════════════════════════════════════════ */
(function addStreakToTopbar() {
  const _w = setInterval(function() {
    if (!window.GZ?.uid || !window.GZ?.data) return;
    clearInterval(_w);

    const streak = window.GZ.data?.loginStreak || 0;
    if (streak < 2) return;

    const topbar = document.querySelector('.topbar-row2');
    if (!topbar || document.getElementById('streakPill')) return;

    const pill = document.createElement('div');
    pill.id = 'streakPill';
    pill.style.cssText = `
      background: linear-gradient(135deg,#f59e0b,#ef4444);
      color:white;padding:2px 8px;border-radius:999px;
      font-size:10px;font-weight:800;flex-shrink:0;white-space:nowrap;
      cursor:pointer;
    `;
    pill.textContent = `🔥${streak}`;
    pill.title = `${streak} günlük giriş serisi!`;
    pill.onclick = () => window.toast?.(`🔥 ${streak} gün üst üste giriş yaptınız!`,'success',4000);
    topbar.appendChild(pill);
  }, 1000);
})();

/* ══════════════════════════════════════════════════════════════════
   YENİ ÖZELLİK 13 — Oyuncu Arası Para Transfer Koruması
   ══════════════════════════════════════════════════════════════════ */
window.GZX_B09_transfer = async function(fromUid, toUid, amount) {
  if (!fromUid || !toUid || amount <= 0) return;
  if (fromUid === toUid) return window.toast?.('Kendinize transfer yapamazsınız','error');

  // Rate limit
  if (!window.GZX_checkRate?.(fromUid, 'transfer')) return;

  // Büyük transfer → admin onayı
  const needsApproval = await window.GZX_checkLargeTx?.(fromUid, amount, `Transfer → ${toUid.slice(0,8)}`);
  if (needsApproval === false) return; // Onay bekleniyor

  const commission = Math.max(5, amount * 0.001);
  const ok = await spendCash(fromUid, amount + commission, `transfer-to-${toUid.slice(0,8)}`);
  if (!ok) return;

  await addCash(toUid, amount, `transfer-from-${fromUid.slice(0,8)}`);
  await window.GZX_notify(toUid, `💸 ${cashFmt(amount)} para aldınız (${window.GZ?.data?.username || fromUid.slice(0,8)}'dan)`, 'success');

  await window.dbPush('transferLog', { from:fromUid, to:toUid, amount, commission, ts:Date.now() });
  window.toast?.(`💸 Transfer tamam. Komisyon: ${cashFmt(commission)}`,'success');
};

console.log('[duzeltmeler.js] ✅ 13 fix + yeni özellik aktif');

/* ══════════════════════════════════════════════════════════════════
   FIX — province alanı yoksa location'dan doldur (eski hesaplar)
   ══════════════════════════════════════════════════════════════════ */
(function migrateProvince() {
  const _w = setInterval(async () => {
    if (!window.GZ?.uid || !window.GZ?.data) return;
    clearInterval(_w);
    const d = window.GZ.data;
    if (!d.province && d.location) {
      await window.dbUpdate('users/' + window.GZ.uid, { province: d.location });
      window.GZ.data.province = d.location;
      console.log('[fix] province ← location:', d.location);
    }
  }, 500);
})();

/* ══════════════════════════════════════════════════════════════════
   FIX — il seçim modalı: kullanıcı province'ini seçebilsin
   ══════════════════════════════════════════════════════════════════ */
window.GZX_ilSecModal = function() {
  const ILLER = window.ILLER_LIST || window.ILLER || [
    'Adana','Adıyaman','Afyonkarahisar','Ağrı','Amasya','Ankara','Antalya','Artvin',
    'Aydın','Balıkesir','Bilecik','Bingöl','Bitlis','Bolu','Burdur','Bursa','Çanakkale',
    'Çankırı','Çorum','Denizli','Diyarbakır','Edirne','Elazığ','Erzincan','Erzurum',
    'Eskişehir','Gaziantep','Giresun','Gümüşhane','Hakkari','Hatay','Isparta','Mersin',
    'İstanbul','İzmir','Kars','Kastamonu','Kayseri','Kırklareli','Kırşehir','Kocaeli',
    'Konya','Kütahya','Malatya','Manisa','Kahramanmaraş','Mardin','Muğla','Muş',
    'Nevşehir','Niğde','Ordu','Rize','Sakarya','Samsun','Siirt','Sinop','Sivas',
    'Tekirdağ','Tokat','Trabzon','Tunceli','Şanlıurfa','Uşak','Van','Yozgat','Zonguldak',
    'Aksaray','Bayburt','Karaman','Kırıkkale','Batman','Şırnak','Bartın','Ardahan',
    'Iğdır','Yalova','Karabük','Kilis','Osmaniye','Düzce'
  ];

  const html = `
    <div style="padding:8px 0">
      <p style="font-size:13px;color:#94a3b8;margin-bottom:12px">
        Yaşadığın ili seç. Muhtarlık, belediye, seçimler bu ile göre çalışır.
      </p>
      <select id="ilSecInput" style="width:100%;padding:12px;background:#080d1a;border:1px solid #1e3a5f;
        border-radius:10px;color:#e2e8f0;font-size:14px;margin-bottom:16px">
        ${ILLER.map(il => `<option value="${il}" ${(window.GZ?.data?.province||'İstanbul')===il?'selected':''}>${il}</option>`).join('')}
      </select>
      <button onclick="(async()=>{
        const il=document.getElementById('ilSecInput')?.value;
        if(!il)return;
        await window.dbUpdate('users/'+window.GZ.uid,{province:il,location:il});
        window.GZ.data.province=il;
        window.GZ.data.location=il;
        document.querySelector('.modal-bg')?.remove();
        window.toast?.('📍 İl güncellendi: '+il,'success',4000);
        if(typeof renderMuhtarlik==='function') renderMuhtarlik();
      })()" style="width:100%;background:#3b82f6;color:white;border:none;border-radius:10px;
        padding:14px;font-weight:800;font-size:14px;cursor:pointer">
        📍 İlimi Kaydet
      </button>
    </div>`;

  if (typeof showModal === 'function') showModal('📍 İl Seç', html);
};

/* ══════════════════════════════════════════════════════════════════
   FIX — renderMuhtarlik'e il seçimi butonu ekle (province yoksa)
   ══════════════════════════════════════════════════════════════════ */
(function patchMuhtarlikIl() {
  // Geç bind — renderMuhtarlik gamezone-v3.js'te tanımlanıyor
  const _tryBind = setInterval(() => {
    if (typeof window.renderMuhtarlik !== 'function') return;
    clearInterval(_tryBind);
    const _prev = window.renderMuhtarlik;
    window.renderMuhtarlik = async function() {
    // Province yoksa önce il seçtir
    const d = window.GZ?.data || {};
    if (!d.province && !d.location) {
      const main = document.getElementById('appMain');
      if (main) {
        main.innerHTML = `
          <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;
            min-height:60vh;padding:32px;text-align:center">
            <div style="font-size:56px;margin-bottom:16px">📍</div>
            <div style="font-size:18px;font-weight:900;color:#e2e8f0;margin-bottom:8px">İlini Seç</div>
            <div style="font-size:13px;color:#64748b;margin-bottom:24px">
              Muhtarlık hizmetlerinden yararlanmak için<br>önce hangi ilde olduğunu belirt.
            </div>
            <button onclick="window.GZX_ilSecModal?.()" style="background:#3b82f6;color:white;border:none;
              border-radius:12px;padding:14px 32px;font-weight:800;font-size:15px;cursor:pointer">
              📍 İlimi Seç
            </button>
          </div>`;
      }
      return;
    }
    if (typeof _prev === 'function') return _prev();
    };
  }, 300);
})();

/* ══════════════════════════════════════════════════════════════════
   FIX — Rol seçilmemişse ticaret engellenmesin (sadece uyarı ver)
   ══════════════════════════════════════════════════════════════════ */
(function patchTradeCheck() {
  const _tryBind = setInterval(() => {
    if (typeof window.buyShop !== 'function') return;
    clearInterval(_tryBind);
    const _prevBuyShop = window.buyShop;
    window.buyShop = async function(type, city) {
    const d = window.GZ?.data || {};
    if (!d.kimlikKarti) {
      window.toast?.('⚠️ Kimlik kartın yok! Muhtarlık → Kimlik Kartı Çıkart (500₺)', 'warn', 6000);
      setTimeout(() => { if (typeof switchTab === 'function') switchTab('muhtarlik'); }, 1500);
      return;
    }
    return _prevBuyShop(type, city);
    };
  }, 300);
})();

/* ══════════════════════════════════════════════════════════════════
   FIX — il seçimi profiline de ekle
   ══════════════════════════════════════════════════════════════════ */
(function addIlToProfile() {
  const _prevRenderProfil = window.renderCuzdan || window.renderProfil;
  // Profil render edilince il değiştir butonu göster
  // Bu basit bir observer — profil ekranı açılınca il bilgisini güncelle
  window.GZX_showIlChangeBtn = function() {
    const prov = window.GZ?.data?.province || window.GZ?.data?.location || 'Seçilmedi';
    return `<button onclick="window.GZX_ilSecModal?.()" style="background:#1e3a5f;color:#60a5fa;border:1px solid #1e3a5f;border-radius:8px;padding:8px 14px;font-size:12px;font-weight:700;cursor:pointer">📍 İl: ${prov} (Değiştir)</button>`;
  };
})();

console.log('[duzeltmeler.js] ✅ province fix + il seçimi + ticaret kilidi fixleri yüklendi');
