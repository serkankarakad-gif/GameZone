// ============================================================
// TÜRK İMPARATORLUĞU — gorev.js
// Günlük/Haftalık Görevler + Başarımlar
// ============================================================
"use strict";

var GOREV = (function() {

  var GUNLUK = [
    {id:"g1",  name:"İlk Alım",         aciklama:"Bugün hisse senedi al",               hedef:1,  xp:50,  elmas:0, tip:"borsa_al"  },
    {id:"g2",  name:"Piyasa Takipçisi", aciklama:"Kripto fiyatına bak",              hedef:3,  xp:30,  elmas:0, tip:"kripto_bak"},
    {id:"g3",  name:"Günlük Giriş",     aciklama:"Oyuna giriş yap",                 hedef:1,  xp:100, elmas:1, tip:"giris"     },
    {id:"g4",  name:"Tüccar",           aciklama:"5 farklı işlem yap",              hedef:5,  xp:80,  elmas:0, tip:"islem"     },
    {id:"g5",  name:"Sohbet Et",        aciklama:"Chat'te 2 mesaj gönder",           hedef:2,  xp:40,  elmas:0, tip:"chat"      },
    {id:"g6",  name:"Banka Hamlesi",    aciklama:"Banka hesabına para yatır",        hedef:1,  xp:60,  elmas:0, tip:"banka_yatir"},
    {id:"g7",  name:"Üretimde Aktif",   aciklama:"Bir saha hasat et",               hedef:1,  xp:70,  elmas:0, tip:"hasat"     }
  ];

  var HAFTALIK = [
    {id:"h1",  name:"Büyük Yatırımcı",  aciklama:"50.000 TL değerinde hisse al",    hedef:50000, xp:500, elmas:3, tip:"borsa_tutar"},
    {id:"h2",  name:"Mülk Sahibi",      aciklama:"1 gayrimenkul satın al",           hedef:1, xp:400,  elmas:2, tip:"gm_al"     },
    {id:"h3",  name:"Kredi Sorumlusu",  aciklama:"Bir kredi taksiti öde",            hedef:1, xp:300,  elmas:1, tip:"kredi_ode" },
    {id:"h4",  name:"Çeşitli Portföy", aciklama:"5 farklı hisse satın al",          hedef:5, xp:600,  elmas:3, tip:"farkli_hisse"},
    {id:"h5",  name:"Sigortalı Yaşam",  aciklama:"Bir sigorta yaptır",              hedef:1, xp:350,  elmas:2, tip:"sigorta_al"},
    {id:"h6",  name:"Dükkan Açıcı",     aciklama:"Yeni bir dükkan aç",              hedef:1, xp:800,  elmas:5, tip:"dukkan_ac" }
  ];

  var BASARIMLAR = [
    {id:"b1",  name:"İlk Adım",      emoji:"🎯", aciklama:"İlk hisse alımını yap",           xp:200,  elmas:2  },
    {id:"b2",  name:"Trilyoner Yolu",emoji:"💰", aciklama:"1 Milyar TL varlık biriktir",     xp:5000, elmas:50 },
    {id:"b3",  name:"Koleksiyoncu",  emoji:"🏡", aciklama:"5 gayrimenkul satın al",           xp:1000, elmas:10 },
    {id:"b4",  name:"Çelik Gibi",    emoji:"🔒", aciklama:"10 ay kredi taksiti öde",    xp:800,  elmas:8  },
    {id:"b5",  name:"Kripto Ustası", emoji:"₿",  aciklama:"Her kriptoyu bir kez al",    xp:1500, elmas:15 },
    {id:"b6",  name:"Ticaret İmparatorluğu",emoji:"🏪",aciklama:"10 dükkan aç",        xp:3000, elmas:30 },
    {id:"b7",  name:"Borsa Gurusu",  emoji:"📈", aciklama:"Borsada 1M TL kâr et",      xp:2000, elmas:20 },
    {id:"b8",  name:"Sigorta Uzmanı",emoji:"🛡️", aciklama:"Tüm sigorta türlerini al",  xp:1000, elmas:10 },
    {id:"b9",  name:"Üretim Devi",   emoji:"🏭", aciklama:"100 hasat yap",              xp:2000, elmas:20 },
    {id:"b10", name:"Seviye 50",     emoji:"👑", aciklama:"50. seviyeye ulaş",          xp:10000,elmas:100}
  ];

  function render() {
    var s   = OYUN.s;
    var tab = window._tab_gorev || "gunluk";
    var html = '<div class="page-header"><h1>🎯 Görevler</h1></div>';
    html += '<div class="tabs-bar" id="gorev-tabs">';
    html += _tb("gunluk","Günlük",tab) + _tb("haftalik","Haftalık",tab) + _tb("basarimlar","Başarımlar",tab);
    html += '</div>';

    if      (tab === "gunluk")    html += _renderGunluk(s);
    else if (tab === "haftalik")  html += _renderHaftalik(s);
    else                          html += _renderBasarimlar(s);

    document.getElementById("main-content").innerHTML = html;
    _bindTabs();
  }

  function _renderGunluk(s) {
    var bugunkiTarih = new Date().toDateString();
    var gorevDurum   = s.gorevler.gunluk || {};
    if (gorevDurum._tarih !== bugunkiTarih) {
      gorevDurum = {_tarih: bugunkiTarih};
      s.gorevler.gunluk = gorevDurum;
      OYUN.kaydet();
    }

    var html = '';
    var tamam = 0;
    GUNLUK.forEach(function(g) {
      var ilerleme = gorevDurum[g.id] || {ilerleme:0, tamamlandi:false, odul:false};
      var pct = Math.min(100, Math.round((ilerleme.ilerleme||0) / g.hedef * 100));
      var hazir = ilerleme.tamamlandi && !ilerleme.odul;
      if (ilerleme.tamamlandi) tamam++;

      html += '<div class="task-card" style="background:var(--bg2);margin:.5rem .75rem 0;border-radius:var(--r);' + (ilerleme.odul?"opacity:.55":"") + '">';
      html += '<div class="task-header"><div class="task-title">' + g.name + '</div>';
      html += '<div class="task-reward">+' + g.xp + ' XP ' + (g.elmas?'• +'+g.elmas+'💎':'') + '</div></div>';
      html += '<div class="task-desc">' + g.aciklama + '</div>';
      html += '<div class="task-progress">';
      html += '<div class="task-progress-bar"><div class="task-progress-fill" style="width:' + pct + '%"></div></div>';
      html += '<div class="task-progress-text">' + (ilerleme.ilerleme||0) + '/' + g.hedef + '</div>';
      html += '</div>';
      if (hazir) {
        html += '<button class="btn btn-gold task-claim-btn btn-fw" onclick="GOREV.odulAl(\'gunluk\',\'' + g.id + '\')">🎁 Ödül Al</button>';
      } else if (ilerleme.odul) {
        html += '<div style="font-size:.78rem;color:var(--green-l);margin-top:.4rem">✅ Tamamlandı</div>';
      }
      html += '</div>';
    });

    return '<div style="background:var(--bg2);border-radius:var(--r);margin:.75rem;padding:.85rem 1rem;display:flex;align-items:center;gap:.75rem"><div style="font-size:2rem">📅</div><div><div style="font-weight:700">Günlük Görevler</div><div style="font-size:.78rem;color:var(--text2)">Her gece 00:00\'da yenilenir • ' + tamam + '/' + GUNLUK.length + ' tamamlandı</div></div><div style="margin-left:auto;font-size:1.2rem;font-weight:800;color:var(--blue)">' + Math.round(tamam/GUNLUK.length*100) + '%</div></div>' + html + '<div style="height:.75rem"></div>';
  }

  function _renderHaftalik(s) {
    var haftaTarih   = _haftaBaslangici();
    var gorevDurum   = s.gorevler.haftalik || {};
    if (gorevDurum._hafta !== haftaTarih) {
      gorevDurum = {_hafta: haftaTarih};
      s.gorevler.haftalik = gorevDurum;
      OYUN.kaydet();
    }

    var html = '';
    var tamam = 0;
    HAFTALIK.forEach(function(g) {
      var ilerleme = gorevDurum[g.id] || {ilerleme:0, tamamlandi:false, odul:false};
      var pct = Math.min(100, Math.round((ilerleme.ilerleme||0) / g.hedef * 100));
      var hazir = ilerleme.tamamlandi && !ilerleme.odul;
      if (ilerleme.tamamlandi) tamam++;

      html += '<div class="task-card" style="background:var(--bg2);margin:.5rem .75rem 0;border-radius:var(--r)">';
      html += '<div class="task-header"><div class="task-title">' + g.name + '</div>';
      html += '<div class="task-reward">+' + g.xp + ' XP ' + (g.elmas?'• +'+g.elmas+'💎':'') + '</div></div>';
      html += '<div class="task-desc">' + g.aciklama + '</div>';
      html += '<div class="task-progress"><div class="task-progress-bar"><div class="task-progress-fill" style="width:' + pct + '%"></div></div><div class="task-progress-text">' + (ilerleme.ilerleme||0) + '/' + g.hedef + '</div></div>';
      if (hazir) html += '<button class="btn btn-gold task-claim-btn btn-fw" onclick="GOREV.odulAl(\'haftalik\',\'' + g.id + '\')">🎁 Ödül Al</button>';
      else if (ilerleme.odul) html += '<div style="font-size:.78rem;color:var(--green-l);margin-top:.4rem">✅ Tamamlandı</div>';
      html += '</div>';
    });
    return '<div style="background:var(--bg2);border-radius:var(--r);margin:.75rem;padding:.85rem 1rem;display:flex;align-items:center;gap:.75rem"><div style="font-size:2rem">📆</div><div><div style="font-weight:700">Haftalık Görevler</div><div style="font-size:.78rem;color:var(--text2)">Her Pazartesi yenilenir • ' + tamam + '/' + HAFTALIK.length + ' tamamlandı</div></div></div>' + html + '<div style="height:.75rem"></div>';
  }

  function _renderBasarimlar(s) {
    var bs   = s.gorevler.basarimlar || {};
    var html = '<div style="padding:.75rem;display:grid;grid-template-columns:repeat(2,1fr);gap:.6rem">';
    BASARIMLAR.forEach(function(b) {
      var kazanildi = bs[b.id];
      html += '<div style="background:var(--bg2);border-radius:var(--r);padding:.85rem;text-align:center;opacity:' + (kazanildi?"1":".5") + '">';
      html += '<div style="font-size:2rem;margin-bottom:.35rem">' + b.emoji + '</div>';
      html += '<div style="font-size:.82rem;font-weight:700;margin-bottom:.2rem">' + b.name + '</div>';
      html += '<div style="font-size:.72rem;color:var(--text2);margin-bottom:.35rem">' + b.aciklama + '</div>';
      html += '<div style="font-size:.72rem;color:var(--gold)">+' + b.xp + ' XP • +' + b.elmas + '💎</div>';
      if (kazanildi) html += '<div style="font-size:.7rem;color:var(--green-l);margin-top:.2rem">✅ Kazanıldı</div>';
      html += '</div>';
    });
    html += '</div>';
    return html;
  }

  function odulAl(tip, gorevId) {
    var s    = OYUN.s;
    var gorevler = tip === "gunluk" ? GUNLUK : HAFTALIK;
    var g    = gorevler.find(function(x){return x.id===gorevId;});
    if (!g)  return;

    var durumKey = tip === "gunluk" ? "gunluk" : "haftalik";
    var durum    = s.gorevler[durumKey][gorevId];
    if (!durum || !durum.tamamlandi || durum.odul) return;

    durum.odul = true;
    OYUN.xpEkle(g.xp);
    if (g.elmas > 0) {
      s.profil.elmas += g.elmas;
      UI.refreshHUD();
    }
    OYUN.kaydet();
    UI.toast("🎁 " + g.name + " görevi tamamlandı! +" + g.xp + " XP" + (g.elmas?" +"+g.elmas+"💎":""), "success");
    render();
  }

  function ilerlemeGuncelle(tip, miktar) {
    var s = OYUN.s;
    if (!s) return;

    var bugunkiTarih = new Date().toDateString();
    var haftaTarih   = _haftaBaslangici();
    var gDurum = s.gorevler.gunluk  || {};
    var hDurum = s.gorevler.haftalik || {};
    if (gDurum._tarih !== bugunkiTarih) { gDurum = {_tarih:bugunkiTarih}; s.gorevler.gunluk  = gDurum; }
    if (hDurum._hafta !== haftaTarih)   { hDurum = {_hafta:haftaTarih};   s.gorevler.haftalik = hDurum; }

    GUNLUK.forEach(function(g) {
      if (g.tip !== tip) return;
      if (!gDurum[g.id]) gDurum[g.id] = {ilerleme:0, tamamlandi:false, odul:false};
      if (gDurum[g.id].tamamlandi) return;
      gDurum[g.id].ilerleme = Math.min(g.hedef, (gDurum[g.id].ilerleme||0) + (miktar||1));
      if (gDurum[g.id].ilerleme >= g.hedef) {
        gDurum[g.id].tamamlandi = true;
        UI.toast("🎯 " + g.name + " görevi tamamlandı! Ödülü al!", "success");
      }
    });

    HAFTALIK.forEach(function(g) {
      if (g.tip !== tip) return;
      if (!hDurum[g.id]) hDurum[g.id] = {ilerleme:0, tamamlandi:false, odul:false};
      if (hDurum[g.id].tamamlandi) return;
      hDurum[g.id].ilerleme = Math.min(g.hedef, (hDurum[g.id].ilerleme||0) + (miktar||1));
      if (hDurum[g.id].ilerleme >= g.hedef) {
        hDurum[g.id].tamamlandi = true;
        UI.toast("🏆 " + g.name + " haftalık görevi tamamlandı!", "success");
      }
    });

    OYUN.kaydet();
  }

  function kontrol() {
    var s   = OYUN.s;
    var bs  = s.gorevler.basarimlar || {};
    s.gorevler.basarimlar = bs;

    // Seviye 50
    if (s.profil.seviye >= 50 && !bs["b10"]) {
      bs["b10"] = true;
      OYUN.xpEkle(10000);
      s.profil.elmas += 100;
      UI.toast("🎉 Başarım: Seviye 50 👑 +100💎", "success");
      OYUN.kaydet();
    }
    // 10 dükkan
    if (Object.keys(s.dukkanlar||{}).length >= 10 && !bs["b6"]) {
      bs["b6"] = true;
      OYUN.xpEkle(3000);
      s.profil.elmas += 30;
      UI.toast("🎉 Başarım: Ticaret İmparatorluğu 🏪 +30💎", "success");
      OYUN.kaydet();
    }
  }

  function _haftaBaslangici() {
    var d = new Date();
    d.setDate(d.getDate() - d.getDay());
    return d.toDateString();
  }

  function _tb(id, label, active) {
    return '<button class="tab-btn' + (active===id?" active":"") + '" data-tab="' + id + '">' + label + '</button>';
  }

  function _bindTabs() {
    var cont = document.getElementById("gorev-tabs");
    if (!cont) return;
    cont.querySelectorAll(".tab-btn").forEach(function(btn) {
      btn.onclick = function() {
        cont.querySelectorAll(".tab-btn").forEach(function(b){b.classList.remove("active");});
        btn.classList.add("active");
        window._tab_gorev = btn.dataset.tab;
        render();
      };
    });
  }

  return { render:render, odulAl:odulAl, ilerlemeGuncelle:ilerlemeGuncelle, kontrol:kontrol };
})();
