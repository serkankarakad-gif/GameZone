// ============================================================
// TÜRK İMPARATORLUĞU — banka.js
// Hesap, Mevduat, Kredi, Bot Onay, İşlem Geçmişi
// ============================================================
"use strict";

var BANKA = (function() {
  var _creditTimer = null;

  // ══ KREDİ BOT (Otomatik Onay) ══
  function startCreditBot() {
    if (_creditTimer) clearInterval(_creditTimer);
    _creditTimer = setInterval(function() {
      var s = OYUN.s;
      if (!s) return;
      var krediler = s.banka.krediler || [];
      var now = Date.now();
      krediler.forEach(function(k) {
        if (k.durum === "bekliyor" && k.otomatikOnayTs && now >= k.otomatikOnayTs) {
          k.durum = "onaylandi";
          s.cuzdan.kredi       += k.tutar;
          s.cuzdan.krediLimit  += k.tutar;
          s.cuzdan.nakit       += k.tutar;
          OYUN.kaydet();
          UI.toast("✅ Kredi onaylandı: " + OYUN.fmt(k.tutar) + " hesabınıza aktarıldı!", "success");
          // Bildirim ekle
          _bildirimEkle("Kredi Onaylandı", OYUN.fmt(k.tutar) + " kredi hesabınıza aktarıldı.");
        }
      });
    }, 15000); // 15 saniyede bir kontrol
  }

  function _bildirimEkle(baslik, mesaj) {
    var s = OYUN.s;
    if (!s.bildirimler) s.bildirimler = [];
    s.bildirimler.unshift({ baslik:baslik, mesaj:mesaj, ts:Date.now(), okundu:false });
    if (s.bildirimler.length > 50) s.bildirimler.length = 50;
    OYUN.kaydet();
    UI.refreshNotifBadge();
  }

  // ══ RENDER ══
  function render() {
    var s   = OYUN.s;
    var tab = window._tab_banka || "ana";
    var html = '<div class="page-header"><h1>🏦 Banka</h1><div class="page-header-actions"><button class="ph-icon-btn" onclick="BANKA.showPromoModal()">🎁</button></div></div>';
    html += '<div class="tabs-bar" id="banka-tabs">';
    html += _tb("ana","Hesap",tab) + _tb("mevduat","Mevduat",tab) + _tb("kredi","Kredi",tab) + _tb("gecmis","Geçmiş",tab);
    html += '</div>';

    if      (tab==="ana")     html += _renderAna(s);
    else if (tab==="mevduat") html += _renderMevduat(s);
    else if (tab==="kredi")   html += _renderKredi(s);
    else                      html += _renderGecmis(s);

    var el = document.getElementById("main-content");
    if (el) el.innerHTML = html;
    _bindBankaTabs();
  }

  function _renderAna(s) {
    var html = '';

    // Bakiye kartı
    html += '<div style="background:var(--blue);margin:.75rem;border-radius:var(--r);padding:1.25rem;color:#fff">';
    html += '<div style="font-size:.8rem;opacity:.8;margin-bottom:.25rem">Toplam Bakiye</div>';
    html += '<div style="font-size:2rem;font-weight:800">' + OYUN.fmtTam(s.cuzdan.nakit) + '</div>';
    html += '<div style="margin-top:.75rem;display:flex;gap:.75rem">';
    html += '<div><div style="font-size:.72rem;opacity:.7">Banka</div><div style="font-size:.9rem;font-weight:700">' + OYUN.fmtTam(s.cuzdan.banka) + '</div></div>';
    html += '<div style="border-left:1px solid rgba(255,255,255,.3);padding-left:.75rem"><div style="font-size:.72rem;opacity:.7">Yatırım</div><div style="font-size:.9rem;font-weight:700">' + OYUN.fmtTam(s.cuzdan.yatirimHesabi) + '</div></div>';
    if (s.cuzdan.kredi > 0) html += '<div style="border-left:1px solid rgba(255,255,255,.3);padding-left:.75rem"><div style="font-size:.72rem;opacity:.7">Kredi Borcu</div><div style="font-size:.9rem;font-weight:700;color:#ffcdd2">-' + OYUN.fmtTam(s.cuzdan.kredi) + '</div></div>';
    html += '</div></div>';

    // İşlem butonları
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:.6rem;margin:.75rem">';
    html += '<button class="btn btn-blue btn-lg" onclick="BANKA.showParaYatir()">📥 Para Yatır</button>';
    html += '<button class="btn btn-outline btn-lg" onclick="BANKA.showParaCek()">📤 Para Çek</button>';
    html += '</div>';

    // Özet
    html += '<div class="card" style="margin:.25rem .75rem">';
    html += '<div class="bank-section-title">PARA YATIR/ÇEK</div>';
    html += '<div class="bank-row"><div class="bank-row-label">Hesap Bakiyesi</div><div style="display:flex;align-items:center;gap:.5rem"><div class="bank-row-value">' + OYUN.fmtTam(s.cuzdan.nakit) + '</div><button class="bank-action-btn" onclick="BANKA.showParaYatir()">↕️</button></div></div>';
    html += '<div class="bank-row"><div class="bank-row-label">Yatırım Hesabı</div><div style="display:flex;align-items:center;gap:.5rem"><div class="bank-row-value">' + OYUN.fmtTam(s.cuzdan.yatirimHesabi) + '</div><button class="bank-action-btn" onclick="BANKA.showYatirimHesap()">↕️</button></div></div>';
    html += '<div class="bank-row"><div class="bank-row-label">Kredi</div><div style="display:flex;align-items:center;gap:.5rem"><div class="bank-row-value text-red">' + OYUN.fmtTam(s.cuzdan.kredi) + '</div><button class="bank-action-btn" onclick="BANKA.showKrediOde()">💳</button></div></div>';
    html += '</div>';

    // Ödemeler
    html += '<div class="card" style="margin:.75rem">';
    html += '<div class="bank-section-title">ÖDEMELER</div>';
    html += '<div class="bank-row"><div class="bank-row-label">İşletme Giderleri</div><div style="display:flex;align-items:center;gap:.5rem"><div class="bank-row-value">' + OYUN.fmtTam(_hesaplaIsletmeGiderleri()) + '</div><button class="bank-action-btn" onclick="BANKA.isletmeOde()">💸</button></div></div>';
    html += '<div class="bank-row"><div class="bank-row-label">Çalışan Maaşları</div><div style="display:flex;align-items:center;gap:.5rem"><div class="bank-row-value">' + OYUN.fmtTam(_hesaplaMaas()) + '</div><button class="bank-action-btn" onclick="BANKA.maasOde()">💸</button></div></div>';
    html += '</div>';

    // Son 3 hareket
    var hareketler = (s.banka.hareketler || []).slice(0, 3);
    if (hareketler.length) {
      html += '<div class="card" style="margin:.75rem"><div class="bank-section-title">SON HESAP HAREKETLERİ</div>';
      hareketler.forEach(function(h) {
        var isGiris = h.tip === "giris";
        var tarih = new Date(h.ts).toLocaleString("tr-TR", {day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"});
        html += '<div class="bank-history-row">';
        html += '<div class="bank-hist-icon">' + (isGiris?"📥":"📤") + '</div>';
        html += '<div class="bank-hist-info"><div class="bank-hist-title">' + (h.aciklama||"İşlem") + '</div><div class="bank-hist-date">' + tarih + '</div></div>';
        html += '<div class="bank-hist-amount ' + (isGiris?"text-green":"text-red") + '">' + (isGiris?"+":"-") + OYUN.fmt(h.tutar) + '</div>';
        html += '</div>';
      });
      html += '</div>';
    }

    return html;
  }

  function _renderMevduat(s) {
    var html = '<div style="margin:.75rem">';
    html += '<button class="btn btn-blue btn-fw" onclick="BANKA.showMevduatAc()">+ Yeni Mevduat Aç</button>';
    html += '</div>';

    var mevduatlar = s.banka.mevduatlar || [];
    if (!mevduatlar.length) {
      return html + '<div class="card" style="margin:.75rem"><div class="empty-state"><div class="empty-icon">🏦</div><div class="empty-title">Mevduatınız yok</div><div class="empty-sub">Birikiminizi faize yatırın</div></div></div>';
    }

    mevduatlar.forEach(function(m) {
      var bank  = D.BANKS.find(function(b){return b.id===m.bankId;}) || {emoji:"🏦",name:"Banka"};
      var sure  = (Date.now() - m.ts) / (1000 * 3600 * 24 * 365);
      var getiri = m.tutar * m.faiz * sure;
      var toplam = m.tutar + getiri;
      var vadeStr = new Date(m.vadeBitis).toLocaleDateString("tr-TR");
      html += '<div class="card" style="margin:.25rem .75rem">';
      html += '<div style="display:flex;align-items:center;justify-content:space-between;padding:.75rem 1rem">';
      html += '<div style="display:flex;align-items:center;gap:.6rem"><span style="font-size:1.4rem">' + bank.emoji + '</span><div><div style="font-weight:700;font-size:.9rem">' + bank.name + '</div><div style="font-size:.75rem;color:var(--text2)">Vade: ' + vadeStr + '</div></div></div>';
      html += '<div style="text-align:right"><div style="font-weight:700">' + OYUN.fmt(m.tutar) + '</div><div style="font-size:.75rem;color:var(--green-l)">+' + OYUN.fmt(getiri) + ' getiri</div></div>';
      html += '</div>';
      html += '<div style="padding:0 1rem .75rem;display:flex;justify-content:space-between;font-size:.78rem;color:var(--text2)">';
      html += '<span>Toplam: <b>' + OYUN.fmt(toplam) + '</b></span><span>%' + (m.faiz*100).toFixed(0) + ' yıllık</span>';
      html += '</div>';
      html += '<div style="padding:0 1rem .75rem"><div class="progress"><div class="progress-fill green" style="width:' + Math.min(100, sure*100/m.vadeSure*100) + '%"></div></div></div>';
      if (Date.now() >= m.vadeBitis) {
        html += '<div style="padding:0 1rem .75rem"><button class="btn btn-green btn-fw" onclick="BANKA.mevduatCoz(\'' + m.id + '\')">Mevduatı Çöz (+' + OYUN.fmt(getiri) + ')</button></div>';
      }
      html += '</div>';
    });
    return html;
  }

  function _renderKredi(s) {
    var html = '';
    // Bekleyen kredi istekleri
    var bekleyenler = (s.banka.krediler || []).filter(function(k){return k.durum==="bekliyor";});
    if (bekleyenler.length) {
      html += '<div class="card" style="margin:.75rem;border-left:3px solid var(--gold)">';
      html += '<div style="padding:.75rem 1rem;font-weight:700;font-size:.85rem;color:#E65100">⏳ Bekleyen Kredi İstekleri</div>';
      bekleyenler.forEach(function(k) {
        var kalan = Math.max(0, k.otomatikOnayTs - Date.now());
        var kalanDk = Math.ceil(kalan / 60000);
        html += '<div style="padding:.5rem 1rem;font-size:.83rem;display:flex;justify-content:space-between"><span>' + OYUN.fmt(k.tutar) + '</span><span style="color:#E65100">~' + kalanDk + ' dk içinde onaylanır</span></div>';
      });
      html += '</div>';
    }

    // Aktif krediler
    var aktifler = (s.banka.krediler || []).filter(function(k){return k.durum==="onaylandi";});
    if (aktifler.length) {
      html += '<div class="card" style="margin:.75rem">';
      html += '<div class="bank-section-title">AKTİF KREDİLER</div>';
      aktifler.forEach(function(k) {
        var bank = D.BANKS.find(function(b){return b.id===k.bankId;}) || {emoji:"🏦",name:"Banka"};
        var kalanGun = Math.max(0, Math.ceil((k.sonOdeme - Date.now()) / 86400000));
        html += '<div class="bank-row"><div><div style="font-weight:600">' + bank.emoji + ' ' + bank.name + '</div><div style="font-size:.75rem;color:var(--text2)">Son ödeme: ' + kalanGun + ' gün</div></div>';
        html += '<div style="text-align:right"><div class="bank-row-value text-red">-' + OYUN.fmt(k.kalanBakins) + '</div><button class="btn btn-sm btn-red" onclick="BANKA.krediOde(\'' + k.id + '\')">Öde</button></div></div>';
      });
      html += '</div>';
    }

    // Kredi başvurusu
    html += '<div style="margin:.75rem"><button class="btn btn-blue btn-fw btn-lg" onclick="BANKA.showKrediBasvur()">Kredi Başvurusu Yap</button></div>';
    html += '<div class="card" style="margin:.75rem"><div class="bank-section-title">KREDİ LIMIT</div>';
    html += '<div style="padding:.75rem 1rem;font-size:.85rem;color:var(--text2)">Kredi limitiniz kredi notunuza ve seviyenize göre belirlenir.</div>';

    html += '<div style="padding:0 1rem .75rem">';
    D.BANKS.filter(function(b){return b.maxKredi>0;}).slice(0,4).forEach(function(b) {
      html += '<div style="display:flex;justify-content:space-between;padding:.4rem 0;font-size:.83rem;border-bottom:1px solid var(--border)">';
      html += '<span>' + b.emoji + ' ' + b.name + '</span><span class="text-blue"><b>' + OYUN.fmt(b.maxKredi) + '</b> max</span></div>';
    });
    html += '</div></div>';

    return html;
  }

  function _renderGecmis(s) {
    var hareketler = s.banka.hareketler || [];
    if (!hareketler.length) {
      return '<div class="card" style="margin:.75rem"><div class="empty-state"><div class="empty-icon">📋</div><div class="empty-title">Hareket yok</div><div class="empty-sub">Son 48 saatteki işlemler burada görünür</div></div></div>';
    }
    var html = '<div class="card" style="margin:.75rem">';
    html += '<div class="bank-section-title">HESAP HAREKETLERİ — SON 48 SAAT</div>';
    hareketler.slice(0, 50).forEach(function(h) {
      var isGiris = h.tip === "giris";
      var tarih = new Date(h.ts).toLocaleString("tr-TR", {day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"});
      html += '<div class="bank-history-row">';
      html += '<div class="bank-hist-icon">' + (isGiris?"📥":"📤") + '</div>';
      html += '<div class="bank-hist-info"><div class="bank-hist-title">' + (h.aciklama||"İşlem") + '</div><div class="bank-hist-date">' + tarih + '</div></div>';
      html += '<div class="bank-hist-amount ' + (isGiris?"text-green":"text-red") + '">' + (isGiris?"+":"-") + OYUN.fmt(h.tutar) + '</div>';
      html += '</div>';
    });
    html += '</div>';
    return html;
  }

  // ══ PARA YATIR/ÇEK MODALLERİ ══
  function showParaYatir() {
    var html = '<div class="form-row"><label class="form-label">Tutar (₺)</label><input type="number" id="py-tutar" class="inp" placeholder="5000" min="1"></div>';
    html += '<button class="btn btn-blue btn-fw btn-lg" onclick="BANKA.paraYatir()">📥 Hesap Bakiyesine Yatır</button>';
    UI.showModal("Para Yatır", html);
  }

  function paraYatir() {
    var tutar = parseFloat(document.getElementById("py-tutar").value)||0;
    if (tutar < 1) return UI.toast("Geçerli tutar girin.", "error");
    if (!OYUN.harca(tutar, "Banka yatırım")) return;
    OYUN.s.cuzdan.banka += tutar;
    OYUN.kaydet();
    UI.toast(OYUN.fmt(tutar) + " banka hesabına aktarıldı.", "success");
    UI.closeModal(); render();
  }

  function showParaCek() {
    var html = '<div class="form-row"><label class="form-label">Tutar (₺)</label><input type="number" id="pc-tutar" class="inp" placeholder="5000" min="1" max="' + OYUN.s.cuzdan.banka + '"></div>';
    html += '<div class="form-hint" style="margin-bottom:.75rem">Banka bakiyesi: ' + OYUN.fmtTam(OYUN.s.cuzdan.banka) + '</div>';
    html += '<button class="btn btn-blue btn-fw btn-lg" onclick="BANKA.paraCek()">📤 Çek</button>';
    UI.showModal("Para Çek", html);
  }

  function paraCek() {
    var tutar = parseFloat(document.getElementById("pc-tutar").value)||0;
    if (tutar < 1) return UI.toast("Geçerli tutar girin.", "error");
    if (OYUN.s.cuzdan.banka < tutar) return UI.toast("Banka bakiyesi yetersiz!", "error");
    OYUN.s.cuzdan.banka -= tutar;
    OYUN.kazanDirekt(tutar, "Banka çekim");
    OYUN.kaydet();
    UI.toast(OYUN.fmt(tutar) + " çekildi.", "success");
    UI.closeModal(); render();
  }

  function showYatirimHesap() {
    var s   = OYUN.s;
    var html = '<div style="margin-bottom:.75rem;background:var(--bg3);border-radius:var(--r-sm);padding:.75rem;font-size:.83rem">Yatırım hesabı: <b>' + OYUN.fmtTam(s.cuzdan.yatirimHesabi) + '</b></div>';
    html += '<div class="form-row"><label class="form-label">Tutar (₺)</label><input type="number" id="yh-tutar" class="inp" placeholder="10000"></div>';
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:.6rem">';
    html += '<button class="btn btn-blue" onclick="BANKA.yatirimYatir()">Yatır</button>';
    html += '<button class="btn btn-red" onclick="BANKA.yatirimCek()">Çek</button>';
    html += '</div>';
    UI.showModal("Yatırım Hesabı", html);
  }

  function yatirimYatir() {
    var tutar = parseFloat(document.getElementById("yh-tutar").value)||0;
    if (!OYUN.harca(tutar, "Yatırım hesabı")) return;
    OYUN.s.cuzdan.yatirimHesabi += tutar;
    OYUN.kaydet();
    UI.toast(OYUN.fmt(tutar) + " yatırım hesabına aktarıldı.", "success");
    UI.closeModal(); render();
  }

  function yatirimCek() {
    var tutar = parseFloat(document.getElementById("yh-tutar").value)||0;
    if (OYUN.s.cuzdan.yatirimHesabi < tutar) return UI.toast("Yetersiz yatırım bakiyesi!", "error");
    OYUN.s.cuzdan.yatirimHesabi -= tutar;
    OYUN.kazanDirekt(tutar, "Yatırım çekim");
    OYUN.kaydet();
    UI.toast(OYUN.fmt(tutar) + " çekildi.", "success");
    UI.closeModal(); render();
  }

  // ══ KREDİ ══
  function showKrediBasvur() {
    var html = '<div class="form-row"><label class="form-label">Banka</label><select id="kr-bank" class="inp">';
    D.BANKS.filter(function(b){return b.maxKredi>0;}).forEach(function(b) {
      html += '<option value="' + b.id + '">' + b.emoji + ' ' + b.name + ' (Max: ' + OYUN.fmt(b.maxKredi) + ')</option>';
    });
    html += '</select></div>';
    html += '<div class="form-row"><label class="form-label">Tutar (₺)</label><input type="number" id="kr-tutar" class="inp" placeholder="50000" min="1000" oninput="BANKA._krediHesapla()"></div>';
    html += '<div class="form-row"><label class="form-label">Vade (Ay)</label><select id="kr-vade" class="inp" onchange="BANKA._krediHesapla()"><option value="6">6 Ay</option><option value="12" selected>12 Ay</option><option value="24">24 Ay</option><option value="36">36 Ay</option></select></div>';
    html += '<div id="kr-ozet" style="background:var(--bg3);border-radius:var(--r-sm);padding:.75rem;margin-bottom:.75rem;font-size:.82rem;color:var(--text2)">Tutar girin...</div>';
    html += '<div style="background:rgba(255,179,0,.1);border-radius:var(--r-sm);padding:.75rem;margin-bottom:.75rem;font-size:.8rem;color:#E65100">⏳ Başvuru yapıldıktan <b>5-15 dakika</b> içinde bot tarafından otomatik onaylanır.</div>';
    html += '<button class="btn btn-blue btn-fw btn-lg" onclick="BANKA.krediBasvur()">Başvur</button>';
    UI.showModal("Kredi Başvurusu", html);
  }

  function _krediHesapla() {
    var tutarEl = document.getElementById("kr-tutar");
    var bankEl  = document.getElementById("kr-bank");
    var vadeEl  = document.getElementById("kr-vade");
    var ozetEl  = document.getElementById("kr-ozet");
    if (!tutarEl || !bankEl || !vadeEl || !ozetEl) return;
    var t   = parseFloat(tutarEl.value) || 0;
    var b   = D.BANKS.find(function(x){return x.id === bankEl.value;}) || {faizKredi:0.5};
    var ay  = parseInt(vadeEl.value) || 12;
    var aylik  = t * (b.faizKredi / 12);
    var toplam = t + aylik * ay;
    ozetEl.innerHTML = "Aylık taksit: <b>" + OYUN.fmt(aylik) + "</b> • Toplam geri ödeme: <b>" + OYUN.fmt(toplam) + "</b>";
  }

  function krediBasvur() {
    var bankId = document.getElementById("kr-bank").value;
    var tutar  = parseFloat(document.getElementById("kr-tutar").value)||0;
    var vade   = parseInt(document.getElementById("kr-vade").value)||12;
    var bank   = D.BANKS.find(function(b){return b.id===bankId;});
    if (!bank) return UI.toast("Banka seçin.", "error");
    if (tutar < 1000) return UI.toast("Min 1.000 TL.", "error");
    if (tutar > bank.maxKredi) return UI.toast("Bu banka için max " + OYUN.fmt(bank.maxKredi) + ".", "error");

    var s = OYUN.s;
    var krediId = "kr_" + Date.now();
    var botSure = D.CONFIG.CREDIT_BOT_MIN + Math.floor(Math.random() * (D.CONFIG.CREDIT_BOT_MAX - D.CONFIG.CREDIT_BOT_MIN));
    var faiz = bank.faizKredi;
    var aylikTaksit = tutar * faiz / 12;

    s.banka.krediler = s.banka.krediler || [];
    s.banka.krediler.push({
      id: krediId, bankId: bankId, tutar: tutar, vade: vade,
      faiz: faiz, aylikTaksit: aylikTaksit,
      kalanBakins: tutar + aylikTaksit * vade,
      durum: "bekliyor",
      ts: Date.now(),
      sonOdeme: Date.now() + vade * 30 * 86400000,
      otomatikOnayTs: Date.now() + botSure * 60000
    });

    OYUN.kaydet();
    UI.toast("Kredi başvurunuz alındı! ~" + botSure + " dakika içinde onaylanacak. ⏳", "success");
    UI.closeModal();
    render();

    // Firebase'e de gönder
    DB.submitCreditRequest(OYUN.u.uid, s.profil.username, tutar, bankId);
  }

  function krediOde(krediId) {
    var s   = OYUN.s;
    var k   = (s.banka.krediler || []).find(function(x){return x.id===krediId;});
    if (!k) return;
    var taksit = k.aylikTaksit;
    if (!OYUN.harca(taksit, "Kredi taksit ödemesi")) return;
    k.kalanBakins -= taksit;
    s.cuzdan.kredi = Math.max(0, s.cuzdan.kredi - taksit);
    if (k.kalanBakins <= 0) {
      k.durum = "kapandi";
      UI.toast("🎉 Krediniz tamamen ödendi!", "success");
    } else {
      UI.toast("Taksit ödendi. Kalan: " + OYUN.fmt(k.kalanBakins), "success");
    }
    OYUN.kaydet(); render();
  }

  function showKrediOde() {
    var s    = OYUN.s;
    var aktif = (s.banka.krediler || []).filter(function(k){return k.durum==="onaylandi";});
    if (!aktif.length) return UI.toast("Aktif kredi bulunmuyor.", "info");
    var html = '';
    aktif.forEach(function(k) {
      var bank = D.BANKS.find(function(b){return b.id===k.bankId;})||{emoji:"🏦",name:"Banka"};
      html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:.75rem 0;border-bottom:1px solid var(--border)">';
      html += '<div><div style="font-weight:600">' + bank.emoji + ' ' + bank.name + '</div><div style="font-size:.75rem;color:var(--text2)">Kalan: ' + OYUN.fmt(k.kalanBakins) + '</div></div>';
      html += '<button class="btn btn-red btn-sm" onclick="BANKA.krediOde(\'' + k.id + '\')">Taksit Öde (' + OYUN.fmt(k.aylikTaksit) + ')</button>';
      html += '</div>';
    });
    UI.showModal("Kredi Öde", '<div>' + html + '</div>');
  }

  // ══ MEVDUAT ══
  function showMevduatAc() {
    var html = '<div class="form-row"><label class="form-label">Banka</label><select id="mv-bank" class="inp">';
    D.BANKS.forEach(function(b) {
      html += '<option value="' + b.id + '">' + b.emoji + ' ' + b.name + ' (%' + (b.faizMevduat*100).toFixed(0) + '/yıl)</option>';
    });
    html += '</select></div>';
    html += '<div class="form-row"><label class="form-label">Tutar (₺)</label><input type="number" id="mv-tutar" class="inp" placeholder="10000" min="100"></div>';
    html += '<div class="form-row"><label class="form-label">Vade</label><select id="mv-vade" class="inp"><option value="1">1 Ay</option><option value="3">3 Ay</option><option value="6" selected>6 Ay</option><option value="12">12 Ay</option></select></div>';
    html += '<button class="btn btn-blue btn-fw" onclick="BANKA.mevduatAc()">Mevduat Aç</button>';
    UI.showModal("Vadeli Mevduat", html);
  }

  function mevduatAc() {
    var bankId = document.getElementById("mv-bank").value;
    var tutar  = parseFloat(document.getElementById("mv-tutar").value)||0;
    var vade   = parseInt(document.getElementById("mv-vade").value)||6;
    if (tutar < 100) return UI.toast("Min 100 ₺.", "error");
    if (!OYUN.harca(tutar, "Mevduat")) return;
    var bank = D.BANKS.find(function(b){return b.id===bankId;});
    var s = OYUN.s;
    s.banka.mevduatlar = s.banka.mevduatlar || [];
    s.banka.mevduatlar.push({
      id: "mv_" + Date.now(), bankId: bankId, tutar: tutar,
      faiz: bank.faizMevduat, vadeSure: vade,
      ts: Date.now(), vadeBitis: Date.now() + vade * 30 * 86400000
    });
    OYUN.kaydet();
    UI.toast(OYUN.fmt(tutar) + " mevduata yatırıldı. %"+((bank.faizMevduat*100).toFixed(0))+" faiz.", "success");
    UI.closeModal(); render();
  }

  function mevduatCoz(mevduatId) {
    var s   = OYUN.s;
    var idx = (s.banka.mevduatlar || []).findIndex(function(m){return m.id===mevduatId;});
    if (idx < 0) return;
    var m      = s.banka.mevduatlar[idx];
    var sure   = (Date.now() - m.ts) / (1000 * 3600 * 24 * 365);
    var getiri = m.tutar * m.faiz * sure;
    var toplam = m.tutar + getiri;
    s.banka.mevduatlar.splice(idx, 1);
    OYUN.kazanDirekt(toplam, "Mevduat çözümü");
    OYUN.xpEkle(30);
    OYUN.kaydet();
    UI.toast("Mevduat çözüldü: " + OYUN.fmt(toplam) + " (+" + OYUN.fmt(getiri) + " getiri)", "success");
    render();
  }

  // ══ İŞLETME GİDERLERİ ══
  function _hesaplaIsletmeGiderleri() {
    var s = OYUN.s;
    var toplam = 0;
    Object.values(s.dukkanlar || {}).forEach(function(d) {
      toplam += (d.isletmeGideri || 0);
    });
    return toplam;
  }

  function _hesaplaMaas() {
    var s = OYUN.s;
    var toplam = 0;
    Object.values(s.dukkanlar || {}).forEach(function(d) {
      toplam += (d.calisan || 0) * 17002;
    });
    return toplam;
  }

  function isletmeOde() {
    var gider = _hesaplaIsletmeGiderleri();
    if (gider <= 0) return UI.toast("Ödenecek işletme gideri yok.", "info");
    if (!OYUN.harca(gider, "İşletme giderleri")) return;
    UI.toast("İşletme giderleri ödendi: " + OYUN.fmt(gider), "success");
    render();
  }

  function maasOde() {
    var maas = _hesaplaMaas();
    if (maas <= 0) return UI.toast("Çalışan yok.", "info");
    if (!OYUN.harca(maas, "Çalışan maaşları")) return;
    OYUN.xpEkle(20);
    UI.toast("Maaşlar ödendi: " + OYUN.fmt(maas), "success");
    render();
  }

  // ══ PROMO KOD ══
  function showPromoModal() {
    UI.showModal("Promosyon Kodu", '<div class="form-row"><label class="form-label">Kod</label><input type="text" id="promo-inp" class="inp" placeholder="TÜRKIYE2024" style="text-transform:uppercase"></div><button class="btn btn-blue btn-fw" onclick="BANKA.promoKullan()">Kodu Kullan</button>');
  }

  function promoKullan() {
    var code = (document.getElementById("promo-inp").value || "").trim().toUpperCase();
    if (!code) return UI.toast("Kod girin.", "error");
    DB.getPromoCode(code).then(function(data) {
      if (!data || !data.active) return UI.toast("Geçersiz veya kullanılmış kod.", "error");
      if (data.expiresAt && data.expiresAt < Date.now()) return UI.toast("Kodun süresi dolmuş.", "error");
      return DB.usePromoCode(code).then(function() {
        if (data.tl)    OYUN.kazanDirekt(data.tl, "Promo kod: " + code);
        if (data.elmas) OYUN.s.profil.elmas += data.elmas;
        OYUN.kaydet();
        UI.toast("Kod kullanıldı! " + (data.tl?OYUN.fmt(data.tl)+" TL":"") + (data.elmas?" + "+data.elmas+"💎":""), "success");
        UI.closeModal();
      });
    }).catch(function() { UI.toast("Kod kontrol edilemedi.", "error"); });
  }

  // ══ YARDIMCI ══
  function _tb(id, label, active) {
    return '<button class="tab-btn' + (active===id?" active":"") + '" data-tab="' + id + '">' + label + '</button>';
  }

  function _bindBankaTabs() {
    var cont = document.getElementById("banka-tabs");
    if (!cont) return;
    cont.querySelectorAll(".tab-btn").forEach(function(btn) {
      btn.onclick = function() {
        cont.querySelectorAll(".tab-btn").forEach(function(b){b.classList.remove("active");});
        btn.classList.add("active");
        window._tab_banka = btn.dataset.tab;
        render();
      };
    });
  }

  return {
    render:render, startCreditBot:startCreditBot,
    showParaYatir:showParaYatir, paraYatir:paraYatir,
    showParaCek:showParaCek, paraCek:paraCek,
    showYatirimHesap:showYatirimHesap, yatirimYatir:yatirimYatir, yatirimCek:yatirimCek,
    showKrediBasvur:showKrediBasvur, krediBasvur:krediBasvur, krediOde:krediOde, showKrediOde:showKrediOde,
    showMevduatAc:showMevduatAc, mevduatAc:mevduatAc, mevduatCoz:mevduatCoz,
    isletmeOde:isletmeOde, maasOde:maasOde,
    showPromoModal:showPromoModal, promoKullan:promoKullan,
    _krediHesapla:_krediHesapla
  };
})();
