// ============================================================
// TÜRK İMPARATORLUĞU — devlet.js
// Belediye, Muhtarlık, SGK, Vergi, Kredi Ofisi,
// Emniyet, Mahkeme, Noterlik, Seçim, Parti Merkezi
// ============================================================
"use strict";

var DEVLET = (function () {

  // ════ BELEDİYE ════

  function payMunicipalTax(city) {
    var amount = 1500 + Math.floor(Math.random() * 1000);
    if (!GAME.spend(amount, "Belediye vergisi")) return;
    GAME.state.government.municipality = { city: city, taxPaid: true, paidAt: new Date().toISOString() };
    GAME.addXP(30);
    UI.toast(city + " Belediyesi vergisi ödendi: " + GAME.fmt(amount), "success");
    UI.renderSection("belediye");
  }

  function applyForPermit(permitType, city) {
    var cost = D.PERMIT_FEES[permitType] || 2000;
    if (!GAME.spend(cost, permitType)) return;
    GAME.state.government.permits = GAME.state.government.permits || [];
    GAME.state.government.permits.push({
      id: "prm_" + Date.now(), type: permitType, city: city,
      issuedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 365 * 86400 * 1000).toISOString(),
      active: true
    });
    GAME.addXP(50);
    UI.toast(permitType + " onaylandı! Ücret: " + GAME.fmt(cost), "success");
    UI.renderSection("belediye");
  }

  function hasPermit(type) {
    return (GAME.state.government.permits || []).some(function (p) { return p.type === type && p.active; });
  }

  // ════ MUHTARLIK ════

  function applyResidence(district, city) {
    district = AUTH.sanitize(district);
    if (!district) return UI.toast("İlçe adı giriniz.", "error");
    if (!GAME.spend(150, "İkametgah belgesi")) return;
    GAME.state.government.residence = {
      district: district, city: city,
      issuedAt: new Date().toISOString(),
      docNo: "MHT" + Date.now().toString().slice(-8)
    };
    GAME.addXP(20);
    UI.toast(district + ", " + city + " adresine ikametgah tesis edildi.", "success");
    UI.renderSection("muhtarlik");
  }

  function getDocFromMuhtar(docType) {
    if (!GAME.state.government.residence)
      return UI.toast("Önce ikametgah tesis ettirin.", "error");
    if (!GAME.spend(50, docType)) return;
    GAME.addXP(10);
    UI.toast(docType + " alındı (" + GAME.state.government.residence.district + " Muhtarlığı).", "success");
  }

  // ════ SGK ════

  function registerSGK(typeId, declaredIncome) {
    declaredIncome = parseFloat(declaredIncome);
    var type = D.SGK_TYPES.find(function (t) { return t.id === typeId; });
    if (!type) return UI.toast("SGK türü bulunamadı.", "error");
    if (GAME.state.government.sgkStatus) return UI.toast("Zaten SGK kaydınız var.", "info");
    if (isNaN(declaredIncome) || declaredIncome < type.min)
      return UI.toast("Minimum bildirilen gelir: " + GAME.fmt(type.min), "error");
    var premium = declaredIncome * 0.20;
    if (!GAME.spend(premium, "SGK primi")) return;
    GAME.state.government.sgkStatus = {
      typeId: typeId, typeName: type.name,
      declaredIncome: declaredIncome, monthlyPremium: premium,
      registeredAt: new Date().toISOString(), active: true
    };
    GAME.addXP(100);
    GAME.updateCreditScore(15);
    UI.toast("SGK kaydı tamamlandı (" + type.name + "). Aylık: " + GAME.fmt(premium), "success");
    UI.renderSection("sgk");
  }

  function paySGKPremium() {
    if (!GAME.state.government.sgkStatus) return UI.toast("SGK kaydınız yok.", "error");
    var p = GAME.state.government.sgkStatus.monthlyPremium;
    if (!GAME.spend(p, "SGK aylık prim")) return;
    GAME.addXP(15);
    GAME.updateCreditScore(3);
    UI.toast("SGK primi ödendi: " + GAME.fmt(p), "success");
  }

  // ════ VERGİ DAİRESİ ════

  function fileIncomeTax(declaredIncome) {
    declaredIncome = parseFloat(declaredIncome);
    if (isNaN(declaredIncome) || declaredIncome < 0) return UI.toast("Geçerli gelir giriniz.", "error");
    var tax;
    if      (declaredIncome <= 70000)   tax = declaredIncome * 0.15;
    else if (declaredIncome <= 150000)  tax = 10500  + (declaredIncome - 70000)   * 0.20;
    else if (declaredIncome <= 370000)  tax = 26500  + (declaredIncome - 150000)  * 0.27;
    else if (declaredIncome <= 1900000) tax = 86000  + (declaredIncome - 370000)  * 0.35;
    else                                tax = 621500 + (declaredIncome - 1900000) * 0.40;
    var alreadyPaid = declaredIncome * D.CONFIG.TAX_RATE;
    var diff        = tax - alreadyPaid;
    if (diff > 0) {
      if (!GAME.spend(diff, "Vergi farkı")) return;
      UI.toast("Beyanname verildi. Ek vergi: " + GAME.fmt(diff), "info");
    } else {
      var refund = Math.abs(diff);
      if (refund > 0) { GAME.earnRaw(refund); UI.toast("Beyanname verildi. İade: " + GAME.fmt(refund) + " 🎉", "success"); }
    }
    GAME.state.government.taxFiled = true;
    GAME.addXP(80);
    GAME.updateCreditScore(10);
    UI.renderSection("vergi");
  }

  function payKDV(salesAmount) {
    salesAmount = parseFloat(salesAmount);
    if (isNaN(salesAmount) || salesAmount <= 0) return UI.toast("Geçerli satış tutarı giriniz.", "error");
    var kdv = salesAmount * D.CONFIG.VAT;
    if (!GAME.spend(kdv, "KDV")) return;
    GAME.addXP(20);
    UI.toast("KDV ödendi: " + GAME.fmt(kdv) + " (%18)", "success");
  }

  // ════ KREDİ OFİSİ ════

  function checkCreditScore() {
    var score  = GAME.state.profile.creditScore || 650;
    var rating, color, desc;
    if      (score >= 800) { rating = "Mükemmel"; color = "#22c55e"; desc = "En iyi kredi şartları sunulur."; }
    else if (score >= 700) { rating = "Çok İyi";  color = "#84cc16"; desc = "İyi faiz oranlarına hak kazanırsınız."; }
    else if (score >= 600) { rating = "İyi";       color = "#eab308"; desc = "Standart şartlarda kredi alabilirsiniz."; }
    else if (score >= 500) { rating = "Orta";      color = "#f97316"; desc = "Sınırlı kredi seçenekleri mevcut."; }
    else                   { rating = "Düşük";     color = "#ef4444"; desc = "Kredi başvurunuz reddedilebilir."; }
    var s = GAME.state;
    UI.showModal(
      '<div class="modal-body" style="text-align:center">' +
        '<div style="font-size:3rem;font-weight:700;color:' + color + '">' + score + '</div>' +
        '<div style="color:' + color + ';font-size:1.3rem;font-weight:700;margin:.3rem 0">' + rating + '</div>' +
        '<p style="opacity:.7;margin-bottom:1rem">' + desc + '</p>' +
        '<div style="text-align:left">' +
          '<div class="stats-list">' +
            '<div>Tamamlanan Kredi: <b>' + (s.bank.loans || []).filter(function(l){return !l.active;}).length + '</b></div>' +
            '<div>Aktif Kredi: <b>' + (s.bank.loans || []).filter(function(l){return l.active;}).length + '</b></div>' +
            '<div>Banka Hesabı: <b>' + (s.bank.accounts || []).length + '</b></div>' +
            '<div>SGK Kaydı: <b>' + (s.government.sgkStatus ? "✅ Var" : "❌ Yok") + '</b></div>' +
          '</div>' +
        '</div>' +
      '</div>',
      "Kredi Notu Sorgulama"
    );
    GAME.addXP(5);
  }

  function restructureDebt() {
    var loans = (GAME.state.bank.loans || []).filter(function (l) { return l.active; });
    if (loans.length < 2) return UI.toast("Yapılandırma için en az 2 aktif kredi gerekli.", "error");
    var totalDebt = loans.reduce(function (sum, l) { return sum + l.monthlyPayment * (l.months - l.paidMonths); }, 0);
    var fee       = parseFloat((totalDebt * 0.01).toFixed(2));
    if (!GAME.spend(fee, "Yapılandırma ücreti")) return;
    var newMonths  = 60;
    var newMonthly = parseFloat((totalDebt / newMonths).toFixed(2));
    GAME.state.bank.loans = (GAME.state.bank.loans || []).filter(function (l) { return !l.active; });
    GAME.state.bank.loans.push({
      id: "loan_restr_" + Date.now(), bankId: "ziraat", bankName: "Borç Yapılandırma",
      amount: totalDebt, months: newMonths, monthlyPayment: newMonthly,
      totalPayment: totalDebt, rate: 0.10, paidMonths: 0,
      startDate: new Date().toISOString(), active: true, isRestructured: true
    });
    GAME.updateCreditScore(-30);
    UI.toast(loans.length + " kredi yapılandırıldı. Yeni taksit: " + GAME.fmt(newMonthly), "success");
    UI.renderSection("kredi-ofisi");
  }

  // ════ EMNİYET ════

  function filePoliceReport(subject, details) {
    subject = AUTH.sanitize(subject); details = AUTH.sanitize(details);
    if (!subject) return UI.toast("Konu giriniz.", "error");
    GAME.state.government.criminalRecord = GAME.state.government.criminalRecord || [];
    GAME.state.government.criminalRecord.push({
      id: "rpt_" + Date.now(), type: "Şikayet",
      subject: subject, details: details,
      status: "İncelemede", filedAt: new Date().toISOString()
    });
    GAME.addXP(10);
    GAME.dirty = true;
    UI.toast("Suç duyurusu alındı. Dosya No: " + Date.now().toString().slice(-6), "success");
    UI.renderSection("emniyet");
  }

  function applyGoodConduct() {
    if (!GAME.spend(250, "Sabıka kaydı")) return;
    GAME.addXP(5);
    UI.toast("Sabıka kaydı alındı. Sonuç: TEMİZ ✅", "success");
  }

  // ════ MAHKEME ════

  function fileCase(caseType, defendant, claimAmount) {
    defendant   = AUTH.sanitize(defendant);
    claimAmount = parseFloat(claimAmount) || 0;
    var fee     = parseFloat((800 + claimAmount * 0.005).toFixed(2));
    if (!GAME.spend(fee, "Mahkeme harcı")) return;
    GAME.state.government.courtCases = GAME.state.government.courtCases || [];
    GAME.state.government.courtCases.push({
      id: "case_" + Date.now(), type: caseType, defendant: defendant,
      claimAmount: claimAmount, fee: fee, status: "Beklemede",
      filedAt: new Date().toISOString()
    });
    GAME.addXP(30);
    UI.toast("Dava açıldı. Esasno: " + Date.now().toString().slice(-8) + ". Harç: " + GAME.fmt(fee), "success");
    UI.renderSection("mahkeme");
  }

  function resolveCase(caseId) {
    var c = (GAME.state.government.courtCases || []).find(function (x) { return x.id === caseId; });
    if (!c || c.status !== "Beklemede") return;
    var win = Math.random() > 0.45;
    c.status = win ? "Kazanıldı" : "Kaybedildi";
    GAME.dirty = true;
    if (win) {
      var award = c.claimAmount * 0.70;
      GAME.earnRaw(award);
      GAME.addXP(100);
      UI.toast("⚖️ Dava kazanıldı! " + GAME.fmt(award) + " tazminat alındı.", "success");
    } else {
      UI.toast("⚖️ Dava kaybedildi.", "warning");
    }
    UI.renderSection("mahkeme");
  }

  // ════ NOTERLİK ════

  function notarizeDocument(docType, parties) {
    parties = AUTH.sanitize(parties || "");
    var fee = D.NOTARY_FEES[docType] || 500;
    if (!GAME.spend(fee, "Noterlik: " + docType)) return;
    GAME.state.government.notaryDocs = GAME.state.government.notaryDocs || [];
    var docNo = "NOT" + Date.now().toString().slice(-8);
    GAME.state.government.notaryDocs.push({
      id: "not_" + Date.now(), type: docType, parties: parties,
      fee: fee, docNo: docNo, notarizedAt: new Date().toISOString()
    });
    GAME.addXP(25);
    UI.toast(docType + " onaylandı. Belge No: " + docNo + ". Ücret: " + GAME.fmt(fee), "success");
    UI.renderSection("noterlik");
  }

  // ════ SİYASET ════

  function joinParty(partyId) {
    if (GAME.state.profile.party) return UI.toast("Zaten bir partiye üyesiniz.", "info");
    var party = D.PARTIES.find(function (p) { return p.id === partyId; });
    if (!party) return UI.toast("Parti bulunamadı.", "error");
    if (!GAME.spend(500, "Parti aidatı")) return;
    GAME.state.profile.party = { id: partyId, name: party.name, rank: "Üye", votes: 0, position: null, joinedAt: new Date().toISOString() };
    GAME.addXP(100);
    UI.toast(party.name + "'e üye oldunuz! " + party.emoji, "success");
    UI.renderSection("siyaset");
  }

  function leaveParty() {
    if (!GAME.state.profile.party) return UI.toast("Partiye üye değilsiniz.", "info");
    GAME.state.profile.party = null;
    GAME.dirty = true;
    UI.toast("Partiden istifa ettiniz.", "info");
    UI.renderSection("siyaset");
  }

  function campaignForVotes() {
    if (!GAME.state.profile.party) return UI.toast("Önce bir partiye katılın.", "error");
    var cost   = 5000 + Math.floor(Math.random() * 3000);
    if (!GAME.spend(cost, "Seçim kampanyası")) return;
    var gained = Math.floor(Math.random() * 5000) + 500;
    GAME.state.profile.party.votes = (GAME.state.profile.party.votes || 0) + gained;
    GAME.addXP(50);
    UI.toast("Kampanya tamamlandı! +" + gained.toLocaleString() + " oy. Harcama: " + GAME.fmt(cost), "success");
    UI.renderSection("siyaset");
  }

  function nominateForElection(position) {
    if (!GAME.state.profile.party) return UI.toast("Önce bir partiye katılın.", "error");
    var required = { "Muhtarlık": 1000, "Belediye Meclis Üyeliği": 5000, "Belediye Başkanlığı": 15000, "Milletvekili": 25000 };
    var req      = required[position] || 5000;
    var votes    = GAME.state.profile.party.votes || 0;
    if (votes < req) return UI.toast(position + " için " + req.toLocaleString() + " oy gerekli. Şu anki: " + votes.toLocaleString(), "error");
    var won = Math.random() > 0.5;
    GAME.dirty = true;
    if (won) {
      GAME.state.profile.party.position = position;
      var bonuses = { "Muhtarlık": 5000, "Belediye Meclis Üyeliği": 20000, "Belediye Başkanlığı": 50000, "Milletvekili": 100000 };
      GAME.earnRaw(bonuses[position] || 10000);
      GAME.addXP(500);
      UI.toast("🎉 " + position + " seçildiniz! Maaş: " + GAME.fmt(bonuses[position] || 10000), "success");
    } else {
      UI.toast("Seçimi kaybettiniz. Daha fazla kampanya yapın!", "warning");
    }
    UI.renderSection("siyaset");
  }

  return {
    payMunicipalTax: payMunicipalTax, applyForPermit: applyForPermit, hasPermit: hasPermit,
    applyResidence: applyResidence, getDocFromMuhtar: getDocFromMuhtar,
    registerSGK: registerSGK, paySGKPremium: paySGKPremium,
    fileIncomeTax: fileIncomeTax, payKDV: payKDV,
    checkCreditScore: checkCreditScore, restructureDebt: restructureDebt,
    filePoliceReport: filePoliceReport, applyGoodConduct: applyGoodConduct,
    fileCase: fileCase, resolveCase: resolveCase,
    notarizeDocument: notarizeDocument,
    joinParty: joinParty, leaveParty: leaveParty,
    campaignForVotes: campaignForVotes, nominateForElection: nominateForElection
  };
})();
