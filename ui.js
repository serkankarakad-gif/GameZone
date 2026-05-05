// ============================================================
// TÜRK İMPARATORLUĞU — ui.js
// Tüm UI render, modal, toast, navigasyon, HUD
// ============================================================
"use strict";

var UI = (function () {

  // ——— EKRAN ———
  function showApp()  { document.getElementById("auth-screen").classList.add("hidden"); document.getElementById("app").classList.remove("hidden"); renderSection("dashboard"); updateHUD(); refreshTicker(); }
  function showAuth() { document.getElementById("app").classList.add("hidden"); document.getElementById("auth-screen").classList.remove("hidden"); AUTH.show("login"); }
  function showLoader(msg) { var el=document.getElementById("loader"); if(el){el.querySelector(".loader-msg").textContent=msg||"Yükleniyor...";el.classList.remove("hidden");} }
  function hideLoader()    { var el=document.getElementById("loader"); if(el)el.classList.add("hidden"); }
  function setLoading(btnId,state) { var b=document.getElementById(btnId);if(!b)return;b.disabled=state;b.dataset.orig=b.dataset.orig||b.innerHTML;b.innerHTML=state?"<span class='spinner'></span> Bekleyin...":b.dataset.orig; }

  // ——— NAVİGASYON ———
  function navigate(section) {
    document.querySelectorAll(".nav-item").forEach(function(el){el.classList.remove("active");});
    var n = document.querySelector(".nav-item[data-s='" + section + "']");
    if(n) n.classList.add("active");
    renderSection(section);
    // mobilde sidebar kapat
    document.getElementById("sidebar").classList.remove("open");
  }

  function renderSection(section) {
    var c = document.getElementById("main-content");
    if(!c || !GAME.state) return;
    var map = {
      dashboard:          renderDashboard,
      banka:              renderBanka,
      borsa:              renderBorsa,
      kripto:             renderKripto,
      tahvil:             renderTahvil,
      fonlar:             renderFonlar,
      sigorta:            renderSigorta,
      gayrimenkul:        renderGayrimenkul,
      "dijital-cuzdani":  renderDijitalCuzdan,
      uretim:             renderUretim,
      ticaret:            renderTicaret,
      lojistik:           renderLojistik,
      ihracat:            renderIhracat,
      ihaleler:           renderIhaleler,
      karaborsa:          renderKaraborsa,
      "oyuncu-pazari":    renderOyuncuPazari,
      belediye:           renderBelediye,
      muhtarlik:          renderMuhtarlik,
      sgk:                renderSGK,
      vergi:              renderVergi,
      "kredi-ofisi":      renderKrediOfisi,
      emniyet:            renderEmniyet,
      mahkeme:            renderMahkeme,
      noterlik:           renderNoterlik,
      siyaset:            renderSiyaset,
      haberler:           renderHaberler,
      magaza:             renderMagaza,
      profil:             renderProfil,
      sss:                renderSSS,
      hikaye:             renderHikaye
    };
    if (map[section]) map[section]();
    else c.innerHTML = ph("⚙️ " + section, "Bu bölüm yakında açılacak.");
  }

  // ——— YARDIMCI HTML ———
  function ph(title, sub) { return '<div class="page-header"><h1>' + title + '</h1><p>' + (sub||"") + '</p></div>'; }
  function card(html, extra) { return '<div class="card ' + (extra||"") + '">' + html + '</div>'; }
  function badge(txt, cls) { return '<span class="badge ' + (cls||"") + '">' + txt + '</span>'; }
  function btn(label, onclick, cls) { return '<button class="btn ' + (cls||"") + '" onclick="' + onclick + '">' + label + '</button>'; }
  function empty(msg) { return '<div class="empty-state">' + (msg||"Henüz veri yok.") + '</div>'; }
  function tabs(items, contentId) {
    return '<div class="tabs">' + items.map(function(t,i){
      return '<button class="tab' + (i===0?" active":"") + '" onclick="UI._tab(this,\'' + contentId + '\',\'' + t.fn + '\')">' + t.label + '</button>';
    }).join("") + '</div><div id="' + contentId + '">' + (items[0] ? window[items[0].fn]() : "") + '</div>';
  }
  function _tab(btn, contentId, fn) {
    btn.closest(".tabs").querySelectorAll(".tab").forEach(function(b){b.classList.remove("active");});
    btn.classList.add("active");
    document.getElementById(contentId).innerHTML = window[fn]();
  }

  function fmtTime(sec) { if(sec<3600)return Math.floor(sec/60)+"dk"; if(sec<86400)return(sec/3600)+"sa"; return(sec/86400)+"gün"; }
  function timeAgo(d) { var s=Math.floor((new Date()-new Date(d))/1000); if(s<60)return s+"sn"; if(s<3600)return Math.floor(s/60)+"dk"; return Math.floor(s/3600)+"sa"; }

  function cityOpts() { return D.CITIES.map(function(c){return'<option>'+c+'</option>';}).join(""); }
  function bankOpts() { return D.BANKS.map(function(b){return'<option value="'+b.id+'">'+b.emoji+' '+b.name+'</option>';}).join(""); }
  function goodOpts() { return D.GOODS.map(function(g){return'<option value="'+g.id+'">'+g.name+' ('+g.unit+')</option>';}).join(""); }

  function formGroup(label, inputHtml) { return '<div class="form-group"><label>'+label+'</label>'+inputHtml+'</div>'; }
  function inp(id,type,placeholder,min,extra) { return '<input id="'+id+'" type="'+(type||"text")+'" class="input" placeholder="'+(placeholder||"")+'"'+(min?' min="'+min+'"':'')+' '+(extra||'')+'>'; }
  function sel(id,optionsHtml,extra) { return '<select id="'+id+'" class="input" '+(extra||'')+'>'+optionsHtml+'</select>'; }

  // ——— DASHBOARD ———
  function renderDashboard() {
    var s=GAME.state;
    var nw=GAME.netWorth();
    var xpN=GAME.xpForLevel(s.profile.level+1);
    var xpP=Math.min(100,Math.round(s.profile.xp/xpN*100));
    document.getElementById("main-content").innerHTML=
      ph("📊 Kontrol Paneli","Hoş geldiniz, "+s.profile.name+"! "+s.profile.badge)+
      '<div class="stats-grid">'+
        statCard("₺",GAME.fmt(s.wallet.tl),"TL Bakiye","gold")+
        statCard("📈",GAME.fmt(GAME.portfolioValue()),"Hisse Portföyü","blue")+
        statCard("₿",GAME.fmt(GAME.cryptoValue()),"Kripto Portföyü","purple")+
        statCard("🏦",GAME.fmt((s.bank.accounts||[]).reduce(function(a,b){return a+(b.balance||0);},0)),"Banka Bakiyesi","green")+
        statCard("🏠",s.properties.realEstate.length+" mülk","Gayrimenkul","red")+
        statCard("👑",GAME.fmt(nw),"Net Varlık","shimmer")+
      '</div>'+
      '<div class="dashboard-grid">'+
        card('<h3>Seviye '+s.profile.level+' — '+s.profile.badge+'</h3><div class="xp-bar"><div class="xp-fill" style="width:'+xpP+'%"></div></div><small>'+s.profile.xp.toLocaleString()+' / '+xpN.toLocaleString()+' XP ('+xpP+'%)</small>')+
        card('<h3>💎 Elmas</h3><div class="elmas-count">'+s.profile.elmas+'</div>'+btn("Satın Al","UI.navigate('magaza')","btn-gold"))+
        card('<h3>📊 İstatistikler</h3><div class="stats-list"><div>Kazanılan: <b>'+GAME.fmt(s.stats.totalEarned)+'</b></div><div>Harcanan: <b>'+GAME.fmt(s.stats.totalSpent)+'</b></div><div>İşlemler: <b>'+s.stats.tradeCount+'</b></div><div>Kredi Notu: <b>'+s.profile.creditScore+'</b></div></div>')+
      '</div>'+
      card('<h3>📰 Son Haberler</h3><div id="news-feed">'+_newsFeed()+'</div>')+
      '<div class="quick-actions"><h3>⚡ Hızlı Erişim</h3><div class="quick-grid">'+
        [["💰","Borsa","borsa"],["🏦","Banka","banka"],["₿","Kripto","kripto"],["🏭","Üretim","uretim"],["🏪","Ticaret","ticaret"],["🏛️","Devlet","belediye"],["🏠","Gayrimenkul","gayrimenkul"],["📰","Haberler","haberler"]].map(function(x){return'<button class="quick-btn" onclick="UI.navigate(\''+x[2]+'\')" >'+x[0]+'<span>'+x[1]+'</span></button>';}).join("")+
      '</div></div>';
  }

  function statCard(icon,val,label,cls) { return '<div class="stat-card '+cls+'"><div class="stat-icon">'+icon+'</div><div class="stat-value">'+val+'</div><div class="stat-label">'+label+'</div></div>'; }
  function _newsFeed() { return GAME.news.slice(0,5).map(function(n){return'<div class="news-item">'+n.text+' <span class="news-time">'+timeAgo(n.time)+'</span></div>';}).join("")||'<div style="opacity:.5">Haberler yükleniyor...</div>'; }

  // ——— BORSA ———
  function renderBorsa() {
    document.getElementById("main-content").innerHTML=
      ph("📈 BIST Hisse Senedi Piyasası","Komisyon: %0.1 | Her 30 saniyede güncellenir")+
      tabs([{label:"Piyasa",fn:"_borsaMarket"},{label:"Portföyüm",fn:"_borsaPort"},{label:"İzleme",fn:"_borsaWatch"}],"borsa-content");
  }
  function _borsaMarket() {
    return '<div class="table-wrap"><table class="data-table"><thead><tr><th>Sembol</th><th>Şirket</th><th>Sektör</th><th>Fiyat</th><th>Değişim</th><th>F/K</th><th>İşlem</th></tr></thead><tbody>'+
      D.STOCKS.map(function(s){
        var p=GAME.prices[s.sym]||s.price;
        var chg=((p-s.price)/s.price*100).toFixed(2);
        var up=parseFloat(chg)>=0;
        return'<tr><td><b>'+s.sym+'</b></td><td>'+s.name+'</td><td>'+badge(s.sector)+'</td>'+
          '<td>'+GAME.fmt(p)+'</td>'+
          '<td class="'+(up?"up":"down")+'">'+(up?"▲":"▼")+" %"+Math.abs(chg)+'</td>'+
          '<td>'+s.pe+'</td>'+
          '<td>'+btn("Al","UI.showBuyStock('"+s.sym+"')","btn-sm btn-green")+' '+btn("Sat","UI.showSellStock('"+s.sym+"')","btn-sm btn-red")+' '+btn("👁","FINANS.toggleWatchlist('"+s.sym+"')","btn-sm")+'</td></tr>';
      }).join("")+
    '</tbody></table></div>';
  }
  function _borsaPort() {
    var p=GAME.state.stocks.portfolio;var keys=Object.keys(p);
    if(!keys.length) return empty("📭 Portföy boş.");
    var tv=0,tc=0;
    var rows=keys.map(function(sym){
      var e=p[sym];var price=GAME.prices[sym]||0;
      var val=e.qty*price;var cost=e.qty*e.avgCost;var pnl=val-cost;
      tv+=val;tc+=cost;
      return'<tr><td><b>'+sym+'</b></td><td>'+e.qty+' lot</td><td>'+GAME.fmt(e.avgCost)+'</td><td>'+GAME.fmt(price)+'</td><td>'+GAME.fmt(val)+'</td>'+
        '<td class="'+(pnl>=0?"up":"down")+'">'+(pnl>=0?"▲":"▼")+" "+GAME.fmt(Math.abs(pnl))+'</td>'+
        '<td>'+btn("Sat","UI.showSellStock('"+sym+"')","btn-sm btn-red")+'</td></tr>';
    }).join("");
    return'<div class="portfolio-summary"><span>Toplam: <b>'+GAME.fmt(tv)+'</b></span><span class="'+(tv-tc>=0?"up":"down")+'">K/Z: <b>'+GAME.fmt(tv-tc)+'</b></span></div>'+
      '<div class="table-wrap"><table class="data-table"><thead><tr><th>Sembol</th><th>Lot</th><th>Ort.Maliyet</th><th>Güncel</th><th>Değer</th><th>K/Z</th><th></th></tr></thead><tbody>'+rows+'</tbody></table></div>';
  }
  function _borsaWatch() {
    var wl=GAME.state.stocks.watchlist;
    if(!wl.length) return empty("📋 İzleme listesi boş.");
    return'<div class="table-wrap"><table class="data-table"><thead><tr><th>Sembol</th><th>Fiyat</th><th></th></tr></thead><tbody>'+
      wl.map(function(sym){return'<tr><td><b>'+sym+'</b></td><td>'+GAME.fmt(GAME.prices[sym]||0)+'</td><td>'+btn("Al","UI.showBuyStock('"+sym+"')","btn-sm btn-green")+'</td></tr>';}).join("")+
    '</tbody></table></div>';
  }

  function showBuyStock(sym) {
    showModal('<div class="modal-body">'+
      '<div class="trade-info"><b>'+sym+'</b> — '+GAME.fmt(GAME.prices[sym]||0)+' / lot</div>'+
      formGroup("Lot Adedi",inp("bq","number","10",1))+
      btn("Satın Al","FINANS.buyStock('"+sym+"',document.getElementById('bq').value);UI.closeModal()","btn-green full-width")+
    '</div>',sym+" Al");
  }
  function showSellStock(sym) {
    var qty=(GAME.state.stocks.portfolio[sym]||{}).qty||0;
    showModal('<div class="modal-body">'+
      '<div class="trade-info"><b>'+sym+'</b> | Elinizde: '+qty+' lot</div>'+
      formGroup("Satılacak Lot",inp("sq","number",String(qty),1,'max="'+qty+'"'))+
      btn("Sat","FINANS.sellStock('"+sym+"',document.getElementById('sq').value);UI.closeModal()","btn-red full-width")+
    '</div>',sym+" Sat");
  }

  // ——— KRİPTO ———
  function renderKripto() {
    document.getElementById("main-content").innerHTML=
      ph("₿ Kripto Para Borsası","Spread: %0.2")+
      '<div class="crypto-grid">'+
      D.CRYPTOS.map(function(c){
        var p=GAME.cprices[c.sym]||c.price;
        var chg=((p-c.price)/c.price*100).toFixed(2);var up=parseFloat(chg)>=0;
        var h=GAME.state.crypto.portfolio[c.sym];
        return'<div class="crypto-card" style="border-top:3px solid '+c.color+'">'+
          '<div class="crypto-header"><span class="crypto-sym" style="color:'+c.color+'">'+c.sym+'</span><span class="'+(up?"up":"down")+'">'+(up?"▲":"▼")+" %"+Math.abs(chg)+'</span></div>'+
          '<div class="crypto-name">'+c.name+'</div>'+
          '<div class="crypto-price">₺'+GAME.fmtFull(p)+'</div>'+
          (h?'<div class="crypto-holding">'+h.qty.toFixed(6)+' '+c.sym+'</div>':'')+
          '<div class="crypto-actions">'+btn("Al","UI.showBuyCrypto('"+c.sym+"')","btn-sm btn-green")+' '+btn("Sat","UI.showSellCrypto('"+c.sym+"')","btn-sm btn-red")+'</div>'+
        '</div>';
      }).join("")+
      '</div>';
  }
  function showBuyCrypto(sym){showModal('<div class="modal-body">'+
    '<div class="trade-info">'+sym+' — ₺'+GAME.fmtFull(GAME.cprices[sym]||0)+'</div>'+
    formGroup("TL Miktar",inp("ctl","number","100",10))+
    btn("Satın Al","FINANS.buyCrypto('"+sym+"',document.getElementById('ctl').value);UI.closeModal()","btn-green full-width")+
  '</div>',sym+" Al");}
  function showSellCrypto(sym){var h=GAME.state.crypto.portfolio[sym];var qty=h?h.qty:0;
    showModal('<div class="modal-body">'+
      '<div class="trade-info">'+sym+' | Elinizde: '+qty.toFixed(6)+'</div>'+
      formGroup("Satılacak Miktar",inp("scq","number",String(qty)))+
      btn("Sat","FINANS.sellCrypto('"+sym+"',document.getElementById('scq').value);UI.closeModal()","btn-red full-width")+
    '</div>',sym+" Sat");}

  // ——— BANKA ———
  function renderBanka() {
    document.getElementById("main-content").innerHTML=
      ph("🏦 Bankacılık")+
      tabs([{label:"Hesaplarım",fn:"_bankaAccounts"},{label:"Kredilerim",fn:"_bankaLoans"},{label:"Mevduatlarım",fn:"_bankaDeposits"},{label:"Hesap Aç",fn:"_bankaOpen"},{label:"Kredi Başvurusu",fn:"_loanApply"}],"banka-content");
  }
  function _bankaAccounts(){
    var accs=GAME.state.bank.accounts||[];
    if(!accs.length) return empty("📭 Hesap yok. 'Hesap Aç' sekmesine gidin.");
    return accs.map(function(a){
      return'<div class="card bank-account-card">'+
        '<div class="bank-header"><span>'+(D.BANKS.find(function(b){return b.id===a.bankId;})||{}).emoji||"🏦"} ' + a.bankName+'</span>'+badge(a.type)+'</div>'+
        '<div class="iban-display">'+a.iban+'</div>'+
        '<div class="account-balance">'+GAME.fmt(a.balance)+'</div>'+
        '<div class="account-actions">'+
          btn("Para Yatır","UI.showDeposit('"+a.id+"')","btn-green")+' '+
          btn("Çek","UI.showWithdraw('"+a.id+"')","btn-red")+' '+
          btn("Havale","UI.showTransfer('"+a.id+"')")+' '+
          btn("Vadeli Aç","UI.showTD('"+a.id+"')")+' '+
          btn("Çek Kes","UI.showCheck('"+a.id+"')","btn-sm")+' '+
          btn("Kapat","FINANS.closeAccount('"+a.id+"')","btn-sm btn-red")+
        '</div></div>';
    }).join("");
  }
  function _bankaLoans(){
    var loans=(GAME.state.bank.loans||[]).filter(function(l){return l.active;});
    if(!loans.length) return empty("✅ Aktif krediniz yok.");
    return loans.map(function(l){
      return'<div class="card loan-card">'+
        '<div class="loan-header"><b>'+l.bankName+'</b>'+badge("Aktif","red")+'</div>'+
        '<div class="loan-details"><span>Anapara: '+GAME.fmt(l.amount)+'</span><span>Taksit: '+GAME.fmt(l.monthlyPayment)+'</span><span>Kalan: '+(l.months-l.paidMonths)+' ay</span></div>'+
        btn("Taksit Öde ("+GAME.fmt(l.monthlyPayment)+")","FINANS.payLoan('"+l.id+"')","btn-red full-width")+
      '</div>';
    }).join("");
  }
  function _bankaDeposits(){
    var deps=(GAME.state.bank.deposits||[]).filter(function(d){return d.active;});
    if(!deps.length) return empty("📭 Aktif mevduat yok.");
    return deps.map(function(d){
      var lbl={mevduat:"Mevduat",tahvil:"Tahvil",fon:"Fon"};
      return'<div class="card deposit-card">'+
        '<div class="deposit-header"><b>'+d.bankName+'</b>'+badge(lbl[d.type]||d.type,"green")+'</div>'+
        '<div class="deposit-details"><span>'+GAME.fmt(d.amount)+'</span><span>Getiri: '+GAME.fmt(d.interest)+'</span><span>'+d.months+' ay</span></div>'+
        btn("Erken Boz","FINANS.breakDeposit('"+d.id+"')","btn-sm btn-red")+
      '</div>';
    }).join("");
  }
  function _bankaOpen(){
    return'<div class="bank-list">'+D.BANKS.map(function(b){
      return'<div class="card bank-card" style="border-left:3px solid '+b.color+'">'+
        '<div class="bank-info">'+b.emoji+' <b>'+b.name+'</b> '+badge(b.type)+'</div>'+
        '<div class="bank-rates"><span>Mevduat: %'+(b.depositRate*100).toFixed(0)+'</span><span>Kredi: %'+(b.loanRate*100).toFixed(0)+'</span><span>Min.Skor: '+b.minScore+'</span></div>'+
        btn("Hesap Aç","FINANS.openAccount('"+b.id+"')","btn-green")+
      '</div>';
    }).join("")+'</div>';
  }
  function _loanApply(){
    return card('<h3>💳 Kredi Başvurusu</h3>'+
      formGroup("Banka",sel("lb",bankOpts()))+
      formGroup("Tutar (TL)",inp("la","number","50000",5000))+
      formGroup("Vade",'<select id="lm" class="input"><option value="12">12 ay</option><option value="24">24 ay</option><option value="36">36 ay</option><option value="48">48 ay</option><option value="60">60 ay</option></select>')+
      '<p style="margin:.5rem 0;font-size:.85rem">Kredi Notunuz: <b>'+GAME.state.profile.creditScore+'</b></p>'+
      btn("Başvur","FINANS.applyLoan(document.getElementById('lb').value,document.getElementById('la').value,document.getElementById('lm').value)","btn-gold full-width"));
  }

  function showDeposit(id){showModal('<div class="modal-body">'+formGroup("Para Yatır (TL)",inp("da","number","1000",1))+btn("Yatır","FINANS.deposit('"+id+"',document.getElementById('da').value);UI.closeModal()","btn-green full-width")+'</div>',"Para Yatır");}
  function showWithdraw(id){showModal('<div class="modal-body">'+formGroup("Para Çek (TL)",inp("wa","number","1000",1))+btn("Çek","FINANS.withdraw('"+id+"',document.getElementById('wa').value);UI.closeModal()","btn-red full-width")+'</div>',"Para Çek");}
  function showTransfer(id){showModal('<div class="modal-body">'+formGroup("Alıcı IBAN",inp("ti","text","TR00 0000..."))+formGroup("Tutar (TL)",inp("ta","number","500",1))+formGroup("Açıklama",inp("td","text","opsiyonel"))+'<small>İşlem ücreti: ₺5</small><br><br>'+btn("Gönder","FINANS.transfer('"+id+"',document.getElementById('ti').value,document.getElementById('ta').value,document.getElementById('td').value);UI.closeModal()","btn-gold full-width")+'</div>',"Havale");}
  function showTD(id){showModal('<div class="modal-body">'+formGroup("Tutar (min 1.000 TL)",inp("vda","number","10000",1000))+formGroup("Vade",'<select id="vdm" class="input"><option value="1">1 Ay</option><option value="3">3 Ay</option><option value="6">6 Ay</option><option value="12">12 Ay</option></select>')+btn("Mevduat Aç","FINANS.openTD('"+id+"',document.getElementById('vda').value,document.getElementById('vdm').value);UI.closeModal()","btn-green full-width")+'</div>',"Vadeli Mevduat");}
  function showCheck(id){showModal('<div class="modal-body">'+formGroup("Tutar (TL)",inp("ca","number","1000",100))+formGroup("Alıcı",inp("cp","text","Ad Soyad"))+btn("Çek Kes","FINANS.issueCheck('"+id+"',document.getElementById('ca').value,document.getElementById('cp').value);UI.closeModal()","btn-gold full-width")+'</div>',"Çek Kes");}

  // ——— TAHVİL ———
  function renderTahvil(){
    document.getElementById("main-content").innerHTML=ph("📜 Tahvil & Bono")+
      card('<h3>Yeni Tahvil Al</h3>'+formGroup("Tür",'<select id="bt" class="input"><option value="devlet">Devlet Tahvili (%35)</option><option value="ozel">Özel Sektör (%42)</option><option value="belediye">Belediye (%38)</option></select>')+formGroup("Tutar (TL)",inp("ba","number","10000",1000))+formGroup("Vade",'<select id="bm" class="input"><option value="6">6 Ay</option><option value="12">12 Ay</option><option value="24">24 Ay</option><option value="36">36 Ay</option></select>')+btn("Tahvil Al","FINANS.buyBond(document.getElementById('bt').value,document.getElementById('ba').value,document.getElementById('bm').value)","btn-gold full-width"))+
      ((GAME.state.bank.deposits||[]).filter(function(d){return d.type==='tahvil'&&d.active;}).map(function(b){return card('<b>'+b.bankName+'</b> | '+GAME.fmt(b.amount)+' | Getiri: '+GAME.fmt(b.interest));}).join("")||empty("Tahvil yok."));
  }

  // ——— FON ———
  function renderFonlar(){
    document.getElementById("main-content").innerHTML=ph("📊 Yatırım Fonları")+
      '<div class="funds-grid">'+D.FUNDS.map(function(f){
        return'<div class="card fund-card"><div class="fund-name"><b>'+f.name+'</b></div>'+badge(f.type)+' '+badge(f.risk+" Risk","green")+'<div class="fund-return">Tahmini: <b>%'+(f.ret*100).toFixed(0)+'/yıl</b></div><div>Min: '+GAME.fmt(f.min)+'</div>'+btn("Yatırım Yap","UI.showFundModal('"+f.id+"')","btn-gold")+'</div>';
      }).join("")+'</div>';
  }
  function showFundModal(id){var f=D.FUNDS.find(function(x){return x.id===id;});showModal('<div class="modal-body"><div class="trade-info">'+f.name+'<br>Min: '+GAME.fmt(f.min)+' | %'+(f.ret*100).toFixed(0)+'/yıl</div>'+formGroup("Tutar (TL)",inp("fa","number",String(f.min),f.min))+btn("Yatır","FINANS.buyFund('"+id+"',document.getElementById('fa').value);UI.closeModal()","btn-gold full-width")+'</div>',f.name);}

  // ——— SİGORTA ———
  function renderSigorta(){
    document.getElementById("main-content").innerHTML=ph("🛡️ Sigorta & Kasko")+
      '<div class="insurance-grid">'+D.INSURANCES.map(function(ins){
        return'<div class="card ins-card"><div class="ins-header">'+ins.emoji+' <b>'+ins.name+'</b></div>'+
          '<div class="ins-opts">'+ins.opts.map(function(o,j){return btn(o,"UI.showInsModal('"+ins.id+"',"+j+")")+"";}).join(" ")+'</div>'+
          '<div>Min: '+GAME.fmt(ins.minPrem)+'/yıl</div></div>';
      }).join("")+'</div>'+
      '<h3 style="margin-top:1rem">Aktif Poliçelerim</h3>'+
      ((GAME.state.properties.insurance||[]).map(function(i){return card('<b>'+i.typeName+'</b> — '+i.option+' | '+GAME.fmt(i.premium)+'/yıl');}).join("")||empty("Poliçe yok."));
  }
  function showInsModal(tid,oi){var ins=D.INSURANCES.find(function(i){return i.id===tid;});showModal('<div class="modal-body"><div class="trade-info">'+ins.emoji+' '+ins.name+' — '+ins.opts[oi]+'</div>'+formGroup("Araç/Mülk (opsiyonel)",inp("ip","text","34 ABC 123..."))+btn("Poliçe Oluştur","FINANS.buyInsurance('"+tid+"',"+oi+",document.getElementById('ip').value);UI.closeModal()","btn-gold full-width")+'</div>',ins.name);}

  // ——— GAYRİMENKUL ———
  function renderGayrimenkul(){
    document.getElementById("main-content").innerHTML=ph("🏠 Gayrimenkul & İnşaat")+
      tabs([{label:"Satın Al",fn:"_reBuy"},{label:"Portföyüm",fn:"_rePort"}],"re-content");
  }
  function _reBuy(){
    return card('<h3>Gayrimenkul Satın Al</h3>'+
      formGroup("Tür",'<select id="ret" class="input" onchange="UI._reSizes()">'+ D.REAL_ESTATE.map(function(r,i){return'<option value="'+i+'">'+r.emoji+' '+r.type+' ('+GAME.fmt(r.priceM2)+'/m²)</option>';}).join("") +'</select>')+
      formGroup("Büyüklük",'<select id="res" class="input">'+ D.REAL_ESTATE[0].sizes.map(function(s,i){return'<option value="'+i+'">'+s+'</option>';}).join("") +'</select>')+
      formGroup("Şehir",sel("rec",cityOpts()))+
      btn("Satın Al (KDV dahil)","FINANS.buyRealEstate(parseInt(document.getElementById('ret').value),parseInt(document.getElementById('res').value),document.getElementById('rec').value)","btn-gold full-width"));
  }
  function _reSizes(){var i=parseInt(document.getElementById("ret").value);document.getElementById("res").innerHTML=D.REAL_ESTATE[i].sizes.map(function(s,j){return'<option value="'+j+'">'+s+'</option>';}).join("");}
  function _rePort(){
    var props=GAME.state.properties.realEstate;if(!props.length) return empty("📭 Mülk yok.");
    return props.map(function(p){return card(p.emoji+' <b>'+p.city+' — '+p.size+' '+p.type+'</b><br>Alış: '+GAME.fmt(p.price)+(p.rented?' | Kira: '+GAME.fmt(p.rentIncome)+'/ay<br>'+btn("Kira Tahsil","FINANS.collectRent('"+p.id+"')","btn-gold"):'<br>'+btn("Kiraya Ver","UI.showRentModal('"+p.id+"')","btn-green")));}).join("");
  }
  function showRentModal(id){showModal('<div class="modal-body">'+formGroup("Aylık Kira (TL)",inp("ra","number","5000",1))+btn("Kiraya Ver","FINANS.rentProperty('"+id+"',document.getElementById('ra').value);UI.closeModal()","btn-green full-width")+'</div>',"Kiraya Ver");}

  // ——— ÜRETİM ———
  function renderUretim(){
    document.getElementById("main-content").innerHTML=
      ph("🏭 Üretim Tesisleri")+
      btn("⚡ Tümünü Topla","EKONOMI.collectAll()","btn-gold")+
      '<div class="tabs" id="prod-tabs">'+Object.keys(D.PRODUCTION).map(function(k,i){
        return'<button class="tab'+(i===0?" active":"")+'" onclick="UI._prodTab(\''+k+'\',this)">'+D.PRODUCTION[k].emoji+' '+D.PRODUCTION[k].name+'</button>';
      }).join("")+'</div>'+
      '<div id="prod-content">'+_prodSection("garden")+'</div>';
  }
  function _prodTab(type,btn2){document.getElementById("prod-tabs").querySelectorAll(".tab").forEach(function(b){b.classList.remove("active");});btn2.classList.add("active");document.getElementById("prod-content").innerHTML=_prodSection(type);}
  function _prodSection(type){
    var def=D.PRODUCTION[type];var list=GAME.state.production[def.arrKey]||[];var now=Date.now();
    var owned=list.length?list.map(function(item){
      var ready=now>=item.readyAt;var rem=ready?0:Math.ceil((item.readyAt-now)/60000);
      return'<div class="card prod-card '+(ready?"ready":"")+'">'+
        def.emoji+' <b>'+item.levelName+'</b> — '+item.city+(item.subtype?' ('+item.subtype+')':'')+
        '<br>Gelir: '+GAME.fmt(item.income)+' / '+fmtTime(item.timeSec)+
        '<br><span class="'+(ready?"text-green":"")+'">Durum: '+(ready?"✅ Hazır!":"⏳ "+rem+" dk")+'</span>'+
        '<div class="prod-actions">'+btn("Topla","EKONOMI.collectProd('"+def.arrKey+"','"+item.id+"')","btn-green")+' '+btn("Yükselt","EKONOMI.upgradeProd('"+def.arrKey+"','"+item.id+"')","btn-gold")+' '+btn("Sat","EKONOMI.sellProd('"+def.arrKey+"','"+item.id+"')","btn-sm btn-red")+'</div>'+
      '</div>';
    }).join(""):empty("Henüz yok.")+
    '<h3 style="margin-top:1rem">Yeni Kur</h3>'+
    def.levels.map(function(lv,i){
      var stId="pst_"+type+"_"+i,scId="psc_"+type+"_"+i;
      return'<div class="card level-card">'+
        '<b>'+lv.name+'</b><br>Maliyet: '+GAME.fmt(lv.cost)+' | Gelir: '+GAME.fmt(lv.income)+" / "+fmtTime(lv.timeSec)+
        (def.subtypes?'<br>'+formGroup("Tür",'<select id="'+stId+'" class="input">'+def.subtypes.map(function(s){return'<option>'+s+'</option>';}).join("")+'</select>'):'<br>')+
        formGroup("Şehir",'<select id="'+scId+'" class="input">'+cityOpts()+'</select>')+
        btn("Kur ("+GAME.fmt(lv.cost)+")","EKONOMI.build('"+type+"',"+i+",{subtype:document.getElementById('"+stId+"')?.value,city:document.getElementById('"+scId+"').value})","btn-gold")+
      '</div>';
    }).join("");
    return owned;
  }

  // ——— TİCARET ———
  function renderTicaret(){
    document.getElementById("main-content").innerHTML=ph("🏪 Ticaret Yönetimi")+
      tabs([{label:"Dükkanlarım",fn:"_myShops"},{label:"Dükkan Aç",fn:"_openShop"}],"ticaret-content");
  }
  function _myShops(){
    var shops=GAME.state.commerce.shops||[];if(!shops.length) return empty("📭 Dükkan yok. Önce belediyeden ruhsat alın!");
    var now=Date.now();
    return shops.map(function(sh){var ready=now>=sh.readyAt;var rem=ready?0:Math.ceil((sh.readyAt-now)/60000);
      return card(sh.emoji+' <b>'+sh.name+'</b> — '+sh.city+'<br>Gelir: '+GAME.fmt(sh.income)+' / '+fmtTime(sh.timeSec)+'<br><span class="'+(ready?"text-green":"")+'">Durum: '+(ready?"✅ Hazır!":"⏳ "+rem+" dk")+'</span><br>'+btn("Tahsil Et","EKONOMI.collectShop('"+sh.id+"')","btn-green"),(ready?"ready":""));
    }).join("");
  }
  function _openShop(){
    return D.SHOPS.map(function(sh){
      var sid="scity_"+sh.id;
      return card(sh.emoji+' <b>'+sh.name+'</b><br>Maliyet: '+GAME.fmt(sh.cost)+' | Gelir: '+GAME.fmt(sh.income)+' / '+fmtTime(sh.timeSec)+
        '<br>'+formGroup("Şehir",'<select id="'+sid+'" class="input">'+cityOpts()+'</select>')+
        btn("Aç","EKONOMI.openShop('"+sh.id+"',document.getElementById('"+sid+"').value)","btn-gold"));
    }).join("");
  }

  // ——— DEVLET BÖLÜMLERİ ———
  function renderBelediye(){
    var s=GAME.state;
    document.getElementById("main-content").innerHTML=ph("🏛️ Belediye")+
      card('<h3>Vergi Öde</h3>'+formGroup("Şehir",sel("mc",cityOpts()))+btn("Belediye Vergisi Öde","DEVLET.payMunicipalTax(document.getElementById('mc').value)","btn-gold"))+
      card('<h3>Ruhsat Başvurusu</h3>'+formGroup("Tür",sel("pt",'<option>'+D.PERMIT_TYPES.join("</option><option>")+'</option>'))+formGroup("Şehir",sel("pc",cityOpts()))+btn("Başvur","DEVLET.applyForPermit(document.getElementById('pt').value,document.getElementById('pc').value)","btn-gold"))+
      '<h3>Ruhsatlarım</h3>'+((s.government.permits||[]).map(function(p){return card('<b>'+p.type+'</b> — '+p.city+' '+badge("Aktif","green"));}).join("")||empty("Ruhsat yok."));
  }
  function renderMuhtarlik(){
    document.getElementById("main-content").innerHTML=ph("🏘️ Muhtarlık")+
      card('<h3>İkametgah Tesis Et (150 TL)</h3>'+formGroup("İlçe",inp("rd","text","Kadıköy"))+formGroup("Şehir",sel("rc",cityOpts()))+btn("Tesisi Yap","DEVLET.applyResidence(document.getElementById('rd').value,document.getElementById('rc').value)","btn-gold"))+
      card('<h3>Muhtarlıktan Belge Al (50 TL)</h3>'+["İkametgah Belgesi","Nüfus Cüzdanı Sureti","Fakirlik Belgesi"].map(function(d){return btn(d,"DEVLET.getDocFromMuhtar('"+d+"')");}).join(" "));
  }
  function renderSGK(){
    var s=GAME.state;
    document.getElementById("main-content").innerHTML=ph("🏛️ SGK")+
      (s.government.sgkStatus?card('✅ <b>'+s.government.sgkStatus.typeName+'</b><br>Aylık Prim: '+GAME.fmt(s.government.sgkStatus.monthlyPremium)+'<br>'+btn("Aylık Prim Öde","DEVLET.paySGKPremium()","btn-gold"),"success-card"):
        card('<h3>SGK Kaydı Yaptır</h3>'+D.SGK_TYPES.map(function(t){return card(t.emoji+' <b>'+t.name+'</b><br><small>'+t.desc+'</small><br>'+btn("Kayıt Yaptır","UI.showSGKModal('"+t.id+"')","btn-gold")).replace("card","card" );}).join("")));
  }
  function showSGKModal(id){var t=D.SGK_TYPES.find(function(x){return x.id===id;});showModal('<div class="modal-body"><div class="trade-info">'+t.emoji+' '+t.name+'</div>'+formGroup("Aylık Gelir (Min: "+GAME.fmt(t.min)+")",inp("si","number",String(t.min),t.min))+btn("Kayıt Yaptır","DEVLET.registerSGK('"+id+"',document.getElementById('si').value);UI.closeModal()","btn-gold full-width")+'</div>',t.name);}

  function renderVergi(){
    document.getElementById("main-content").innerHTML=ph("📋 Vergi Dairesi")+
      card('<h3>Gelir Vergisi Beyannamesi</h3>'+formGroup("Yıllık Gelir (TL)",inp("ti","number",Math.round(GAME.state.stats.totalEarned).toString(),0))+btn("Beyanname Ver","DEVLET.fileIncomeTax(document.getElementById('ti').value)","btn-gold"))+
      card('<h3>KDV Öde</h3>'+formGroup("Satış Tutarı (TL)",inp("ki","number","10000",1))+btn("KDV Öde (%18)","DEVLET.payKDV(document.getElementById('ki').value)","btn-gold"));
  }
  function renderKrediOfisi(){
    document.getElementById("main-content").innerHTML=ph("📊 Kredi Ofisi")+
      card(btn("Kredi Notu Sorgula","DEVLET.checkCreditScore()","btn-gold"))+
      card('<h3>Borç Yapılandırma</h3><p>Birden fazla kredinizi tek taksitli krediye dönüştürün.</p>'+btn("Borç Yapılandırma Başvurusu","DEVLET.restructureDebt()","btn-gold"));
  }
  function renderEmniyet(){
    var s=GAME.state;
    document.getElementById("main-content").innerHTML=ph("🚔 Emniyet Müdürlüğü")+
      card('<h3>Suç Duyurusu</h3>'+formGroup("Konu",inp("ps","text","Dolandırıcılık..."))+formGroup("Detaylar",inp("pd","text","Olay detayları..."))+btn("Bildir","DEVLET.filePoliceReport(document.getElementById('ps').value,document.getElementById('pd').value)","btn-gold"))+
      btn("Sabıka Kaydı Al (250 TL)","DEVLET.applyGoodConduct()")+
      '<h3 style="margin-top:1rem">Kayıtlarım</h3>'+
      ((s.government.criminalRecord||[]).map(function(r){return card('<b>'+r.type+'</b>: '+r.subject+' — '+badge(r.status));}).join("")||empty("Kayıt yok."));
  }
  function renderMahkeme(){
    var s=GAME.state;
    document.getElementById("main-content").innerHTML=ph("⚖️ Mahkeme")+
      card('<h3>Dava Aç</h3>'+formGroup("Dava Türü",sel("ct",'<option>'+["Borç Davası","Tazminat","İş Davası","Sözleşme İhlali","Mülkiyet Uyuşmazlığı"].join("</option><option>")+'</option>'))+formGroup("Karşı Taraf",inp("cd","text","Ad Soyad / Kurum"))+formGroup("Talep (TL)",inp("cc","number","50000",0))+btn("Dava Aç","DEVLET.fileCase(document.getElementById('ct').value,document.getElementById('cd').value,document.getElementById('cc').value)","btn-gold"))+
      '<h3>Davalarım</h3>'+
      ((s.government.courtCases||[]).map(function(c){return card('<b>'+c.type+'</b> — '+c.defendant+' | Talep: '+GAME.fmt(c.claimAmount)+' '+badge(c.status)+(c.status==="Beklemede"?'<br>'+btn("Karar Al","DEVLET.resolveCase('"+c.id+"')","btn-sm btn-gold"):""));}).join("")||empty("Dava yok."));
  }
  function renderNoterlik(){
    var s=GAME.state;
    document.getElementById("main-content").innerHTML=ph("📄 Noterlik")+
      card('<h3>Belge Onaylat</h3>'+formGroup("Belge Türü",sel("nt",'<option>'+D.NOTARY_TYPES.join("</option><option>")+'</option>'))+formGroup("Taraflar",inp("np","text","A. Yılmaz, B. Kaya..."))+btn("Onaylat","DEVLET.notarizeDocument(document.getElementById('nt').value,document.getElementById('np').value)","btn-gold"))+
      '<h3>Belgelerim</h3>'+
      ((s.government.notaryDocs||[]).map(function(d){return card('<b>'+d.type+'</b> — Belge No: '+d.docNo);}).join("")||empty("Belge yok."));
  }
  function renderSiyaset(){
    var s=GAME.state;
    document.getElementById("main-content").innerHTML=ph("🗳️ Siyaset & Seçimler")+
      (s.profile.party?
        card('<h3>'+(D.PARTIES.find(function(p){return p.id===s.profile.party.id;})||{}).emoji+' '+s.profile.party.name+'</h3><div>Oy: '+(s.profile.party.votes||0).toLocaleString()+'</div>'+(s.profile.party.position?badge(s.profile.party.position,"green")+"<br>":"")+'<div class="party-actions" style="margin-top:.7rem">'+btn("Kampanya Yap","DEVLET.campaignForVotes()","btn-gold")+' '+btn("Seçime Katıl","UI.showElectionModal()","btn-gold")+' '+btn("İstifa","DEVLET.leaveParty()","btn-sm btn-red")+'</div>',"success-card"):
        '<div class="parties-grid">'+D.PARTIES.map(function(p){return'<div class="card party-card" style="border-left:3px solid '+p.color+'"><div>'+p.emoji+' <b>'+p.name+'</b></div><div>'+p.ideology+'</div><div class="support-bar"><div style="width:'+p.support+'%;background:'+p.color+';height:6px;border-radius:3px"></div></div><div>Destek: %'+p.support+'</div>'+btn("Üye Ol (500 TL)","DEVLET.joinParty('"+p.id+"')","btn-gold")+'</div>';}).join("")+'</div>');
  }
  function showElectionModal(){showModal('<div class="modal-body">'+formGroup("Pozisyon",sel("ep",'<option>Muhtarlık</option><option>Belediye Meclis Üyeliği</option><option>Belediye Başkanlığı</option><option>Milletvekili</option>'))+btn("Aday Ol","DEVLET.nominateForElection(document.getElementById('ep').value);UI.closeModal()","btn-gold full-width")+'</div>',"Seçime Katıl");}

  // ——— LOJİSTİK / İHRACAT / İHALE / KARABORSA ———
  function renderLojistik(){
    document.getElementById("main-content").innerHTML=ph("🚛 Lojistik")+
      card('<h3>Sevkiyat Yap</h3>'+formGroup("Ürün",sel("lg",goodOpts()))+formGroup("Miktar",inp("lq","number","100",1))+formGroup("Çıkış",sel("lf",cityOpts()))+formGroup("Varış",sel("lt",cityOpts()))+btn("Başlat","EKONOMI.deliverGoods(document.getElementById('lg').value,document.getElementById('lq').value,document.getElementById('lf').value,document.getElementById('lt').value)","btn-gold"));
  }
  function renderIhracat(){
    document.getElementById("main-content").innerHTML=ph("🌍 İhracat")+
      card('<h3>Ürün İhraç Et</h3>'+formGroup("Ürün",sel("ig",goodOpts()))+formGroup("Miktar",inp("iq","number","100",1))+formGroup("Hedef Ülke",sel("ic",'<option>Almanya</option><option>ABD</option><option>Çin</option><option>Japonya</option><option>İngiltere</option>'))+btn("İhraç Et","EKONOMI.exportGoods(document.getElementById('ig').value,document.getElementById('iq').value,document.getElementById('ic').value)","btn-gold"));
  }
  function renderIhaleler(){
    document.getElementById("main-content").innerHTML=ph("📋 İhaleler")+
      '<div class="tenders-grid">'+D.TENDERS.map(function(t){return'<div class="card tender-card"><div><b>'+t.name+'</b></div>'+badge(t.type)+'<div>Değer: <b>'+GAME.fmt(t.value)+'</b></div><div>Min.Teklif: '+GAME.fmt(t.minBid)+'</div><div>Teminat: '+GAME.fmt(t.minBid*0.1)+'</div>'+btn("Teklif Ver","EKONOMI.bidForTender('"+t.id+"')","btn-gold")+'</div>';}).join("")+'</div>';
  }
  function renderKaraborsa(){
    document.getElementById("main-content").innerHTML=ph("⚫ Karaborsa","⚠️ Yakalanırsanız ağır ceza!")+
      '<div class="bm-grid">'+D.BLACK_MARKET.map(function(item){return'<div class="card bm-card"><div><b>'+item.name+'</b></div><div>Fiyat: '+GAME.fmt(item.price)+'</div><div>Pot. Kâr: '+GAME.fmt(item.price*(item.profitMult-1))+'</div><div class="risk-ind">Risk: %'+Math.round(item.riskRate*100)+'</div>'+btn("Satın Al","EKONOMI.blackMarketBuy('"+item.id+"')","btn-red")+'</div>';}).join("")+'</div>';
  }

  // ——— OYUNCU PAZARI ———
  function renderOyuncuPazari(){
    var c=document.getElementById("main-content");
    c.innerHTML=ph("🤝 Oyuncu Pazarı")+'<div class="loader-inline">İlanlar yükleniyor...</div>';
    DB.getListings().then(function(listings){
      c.innerHTML=ph("🤝 Oyuncu Pazarı")+
        btn("İlan Ver","UI.showListModal()","btn-gold")+
        '<br><br>'+
        (listings.length?
          '<div class="table-wrap"><table class="data-table"><thead><tr><th>Ürün</th><th>Satıcı</th><th>Miktar</th><th>Birim</th><th>Toplam</th><th></th></tr></thead><tbody>'+
            listings.map(function(l){return'<tr><td>'+l.goodName+'</td><td>'+l.sellerName+'</td><td>'+l.qty+' '+l.unit+'</td><td>'+GAME.fmt(l.pricePerUnit)+'</td><td>'+GAME.fmt(l.total)+'</td><td>'+btn("Al","UI._buyListing('"+l.id+"',"+JSON.stringify(l).replace(/"/g,"&quot;")+"...","btn-sm btn-green")+'</td></tr>';}).join("")+
          '</tbody></table></div>':
          empty("Şu an ilan yok."));
    });
  }
  function _buyListing(id){ DB.getListings().then(function(list){var l=list.find(function(x){return x.id===id;});if(l)EKONOMI.buyFromMarket(id,l);}); }
  function showListModal(){showModal('<div class="modal-body">'+formGroup("Ürün",sel("pmg",goodOpts()))+formGroup("Miktar",inp("pmq","number","100",1))+formGroup("Birim Fiyat (TL)",inp("pmp","number","1000",1))+'<small>Listeleme ücreti: %2</small><br><br>'+btn("İlan Ver","EKONOMI.listItem(document.getElementById('pmg').value,document.getElementById('pmq').value,document.getElementById('pmp').value);UI.closeModal()","btn-gold full-width")+'</div>',"İlan Ver");}

  // ——— DİJİTAL CÜZDAN ———
  function renderDijitalCuzdan(){
    var dw=GAME.state.wallet.digitalWallet;
    document.getElementById("main-content").innerHTML=ph("📱 Dijital Cüzdan")+
      (dw.provider?
        card('<h3>✅ '+dw.provider+'</h3><div class="wallet-balance">'+GAME.fmt(dw.balance)+'</div>'+formGroup("Yükle (TL)",inp("dwa","number","100",10))+btn("Para Yükle","FINANS.loadWallet(document.getElementById('dwa').value)","btn-gold"),"success-card"):
        card('<h3>Dijital Cüzdan Kur</h3>'+["Papara","PayPay","Param","BKM Express"].map(function(p){return btn(p,"FINANS.setupWallet('"+p+"')");}).join(" ")));
  }

  // ——— HABERLER ———
  function renderHaberler(){
    document.getElementById("main-content").innerHTML=ph("📰 Ekonomi Haberleri")+
      '<div class="news-grid">'+
      (GAME.news.length?GAME.news.map(function(n){return card('<div>'+n.text+'</div><div class="news-time">'+timeAgo(n.time)+'</div>');}).join(""):empty("Yükleniyor..."))+
      '</div>';
  }

  // ——— MAĞAZA ———
  function renderMagaza(){
    document.getElementById("main-content").innerHTML=ph("💎 Mağaza","Mevcut: "+GAME.state.profile.elmas+" 💎")+
      '<div class="elmas-grid">'+D.ELMAS_PACKAGES.map(function(p){return'<div class="card elmas-card '+(p.popular?"popular":"")+'">'+
        (p.popular?'<div class="popular-badge">⭐ En Popüler</div>':'')+
        '<div class="elmas-amount">💎 '+p.elmas.toLocaleString()+'</div>'+
        (p.bonus?'<div class="bonus-text">+'+p.bonus+' bonus!</div>':'')+
        '<div class="elmas-price">'+p.price+'</div>'+
        btn("Satın Al","UI.toast('Ödeme sistemi yakında aktif!','info')","btn-gold")+
      '</div>';}).join("")+'</div>';
  }

  // ——— PROFİL ———
  function renderProfil(){
    var s=GAME.state;
    var xpN=GAME.xpForLevel(s.profile.level+1);
    var xpP=Math.min(100,Math.round(s.profile.xp/xpN*100));
    document.getElementById("main-content").innerHTML=ph("👤 Profilim")+
      card('<div class="profile-card"><div class="profile-avatar">'+s.profile.avatar+'</div><div class="profile-name">'+s.profile.name+'</div><div class="profile-badge">'+s.profile.badge+'</div><div style="opacity:.6">'+s.profile.email+'</div><div class="xp-bar" style="margin:.8rem 0"><div class="xp-fill" style="width:'+xpP+'%"></div></div><small>Lv.'+s.profile.level+' — '+s.profile.xp+'/'+xpN+' XP</small></div>')+
      card('<h3>🔑 Şifre Değiştir</h3>'+formGroup("Mevcut Şifre",inp("cp-old","password","••••••••"))+formGroup("Yeni Şifre",inp("cp-new","password","••••••••"))+formGroup("Tekrar",inp("cp-new2","password","••••••••"))+btn("Değiştir","AUTH.changePassword()","btn-gold"))+
      card(btn("🚪 Çıkış Yap","AUTH.logout()","btn-red"));
  }

  // ——— SSS & HİKAYE ———
  function renderSSS(){
    document.getElementById("main-content").innerHTML=ph("❓ Sıkça Sorulan Sorular")+
      '<div class="faq-list">'+D.FAQ.map(function(f){return'<div class="card faq-card" onclick="this.classList.toggle(\'open\')"><div class="faq-q">❓ '+f.q+'</div><div class="faq-a">💬 '+f.a+'</div></div>';}).join("")+'</div>';
  }
  function renderHikaye(){
    document.getElementById("main-content").innerHTML=ph("📖 Oyun Hikayesi")+
      D.STORY.map(function(ch){return card('<div class="story-chapter">Bölüm '+ch.ch+'</div><div class="story-title">'+ch.title+'</div><div class="story-text">'+ch.text+'</div>',"story-card");}).join("");
  }

  // ——— MODAL ———
  function showModal(html, title){
    document.getElementById("modal-title").textContent = title||"";
    document.getElementById("modal-body-wrap").innerHTML = html;
    document.getElementById("modal-overlay").classList.remove("hidden");
  }
  function closeModal(){ document.getElementById("modal-overlay").classList.add("hidden"); }

  // ——— TOAST ———
  function toast(msg, type){
    var container = document.getElementById("toast-container");
    if(!container) return;
    var el = document.createElement("div");
    el.className = "toast toast-" + (type||"info");
    var icons = {success:"✅",error:"❌",warning:"⚠️",info:"ℹ️"};
    el.innerHTML = "<span>"+(icons[type]||"ℹ️")+"</span><span>"+msg+"</span>";
    container.appendChild(el);
    setTimeout(function(){el.classList.add("show");},10);
    setTimeout(function(){el.classList.remove("show");setTimeout(function(){if(el.parentNode)el.remove();},400);},4500);
  }

  // ——— HUD & TİCKER ———
  function updateHUD(){
    var s=GAME.state; if(!s) return;
    var g = function(id){return document.getElementById(id);};
    if(g("hud-tl"))    g("hud-tl").textContent   = GAME.fmt(s.wallet.tl);
    if(g("hud-elmas")) g("hud-elmas").textContent = s.profile.elmas+"💎";
    if(g("hud-level")) g("hud-level").textContent = "Lv."+s.profile.level;
    if(g("hud-name"))  g("hud-name").textContent  = s.profile.name;
  }

  function refreshTicker(){
    var el = document.getElementById("ticker-strip"); if(!el) return;
    el.innerHTML = D.STOCKS.slice(0,10).map(function(s){
      var p=GAME.prices[s.sym]||s.price;
      var chg=((p-s.price)/s.price*100).toFixed(2);var up=parseFloat(chg)>=0;
      return'<span class="ticker-item"><b>'+s.sym+'</b> '+GAME.fmt(p)+' <span class="'+(up?"up":"down")+'">'+(up?"▲":"▼")+Math.abs(chg)+"%</span></span>";
    }).join("");
  }

  function updateNewsTicker(){
    var el=document.getElementById("news-feed");
    if(el) el.innerHTML=_newsFeed();
  }

  // ——— PUBLIC API ———
  return {
    showApp:showApp,showAuth:showAuth,showLoader:showLoader,hideLoader:hideLoader,setLoading:setLoading,
    navigate:navigate,renderSection:renderSection,
    refreshTicker:refreshTicker,updateNewsTicker:updateNewsTicker,updateHUD:updateHUD,
    showModal:showModal,closeModal:closeModal,toast:toast,
    // Borsa
    showBuyStock:showBuyStock,showSellStock:showSellStock,
    // Kripto
    showBuyCrypto:showBuyCrypto,showSellCrypto:showSellCrypto,
    // Banka
    showDeposit:showDeposit,showWithdraw:showWithdraw,showTransfer:showTransfer,showTD:showTD,showCheck:showCheck,
    // Fon
    showFundModal:showFundModal,
    // Sigorta
    showInsModal:showInsModal,
    // Gayrimenkul
    showRentModal:showRentModal,_reSizes:_reSizes,
    // SGK
    showSGKModal:showSGKModal,
    // Seçim
    showElectionModal:showElectionModal,
    // Pazar
    showListModal:showListModal,_buyListing:_buyListing,
    // iç tab yardımcıları
    _tab:_tab,_prodTab:_prodTab,
    _borsaMarket:_borsaMarket,_borsaPort:_borsaPort,_borsaWatch:_borsaWatch,
    _bankaAccounts:_bankaAccounts,_bankaLoans:_bankaLoans,_bankaDeposits:_bankaDeposits,_bankaOpen:_bankaOpen,_loanApply:_loanApply,
    _myShops:_myShops,_openShop:_openShop,
    _reBuy:_reBuy,_rePort:_rePort,
    _prodSection:_prodSection
  };
})();

// tabs helper global yap (string fn çözümlemesi için)
window._borsaMarket = UI._borsaMarket ? UI._borsaMarket.bind(UI) : function(){};
