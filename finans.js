// ============================================================
// TÜRK İMPARATORLUĞU — finans.js
// Bankacılık, Borsa, Kripto, Tahvil, Fon, Sigorta, Gayrimenkul, Dijital Cüzdan
// ============================================================
"use strict";

var FINANS = (function () {

  // ════ BANKA ════

  function openAccount(bankId) {
    var bank = D.BANKS.find(function (b) { return b.id === bankId; });
    if (!bank) return UI.toast("Banka bulunamadı.", "error");
    var s = GAME.state;
    if ((s.bank.accounts || []).filter(function (a) { return a.bankId === bankId; }).length >= 3)
      return UI.toast("Bu bankada maksimum 3 hesap açılabilir.", "error");

    s.bank.accounts = s.bank.accounts || [];
    s.bank.accounts.push({
      id:       "acc_" + Date.now(),
      bankId:   bankId,
      bankName: bank.name,
      bankEmoji:bank.emoji,
      type:     "Vadesiz",
      balance:  0,
      iban:     GAME.genIBAN(),
      openedAt: new Date().toISOString()
    });
    GAME.dirty = true;
    GAME.addXP(50);
    UI.toast(bank.name + "'da hesap açıldı!", "success");
    UI.renderSection("banka");
  }

  function closeAccount(accId) {
    var s = GAME.state;
    var idx = (s.bank.accounts || []).findIndex(function (a) { return a.id === accId; });
    if (idx === -1) return UI.toast("Hesap bulunamadı.", "error");
    var bal = s.bank.accounts[idx].balance;
    if (bal > 0) { GAME.earnRaw(bal); UI.toast(GAME.fmt(bal) + " cüzdanınıza aktarıldı.", "info"); }
    s.bank.accounts.splice(idx, 1);
    GAME.dirty = true;
    UI.toast("Hesap kapatıldı.", "success");
    UI.renderSection("banka");
  }

  function deposit(accId, amount) {
    amount = parseFloat(amount);
    if (isNaN(amount) || amount <= 0) return UI.toast("Geçerli miktar giriniz.", "error");
    var acc = (GAME.state.bank.accounts || []).find(function (a) { return a.id === accId; });
    if (!acc) return UI.toast("Hesap bulunamadı.", "error");
    if (!GAME.spend(amount, "Para yatırma")) return;
    acc.balance += amount;
    DB.logTransaction(GAME.user.uid, { type: "deposit", accId: accId, amount: amount });
    UI.toast(GAME.fmt(amount) + " yatırıldı.", "success");
    UI.renderSection("banka");
  }

  function withdraw(accId, amount) {
    amount = parseFloat(amount);
    if (isNaN(amount) || amount <= 0) return UI.toast("Geçerli miktar giriniz.", "error");
    var acc = (GAME.state.bank.accounts || []).find(function (a) { return a.id === accId; });
    if (!acc) return UI.toast("Hesap bulunamadı.", "error");
    if (acc.balance < amount) return UI.toast("Hesap bakiyesi yetersiz.", "error");
    acc.balance -= amount;
    GAME.earnRaw(amount);
    DB.logTransaction(GAME.user.uid, { type: "withdraw", accId: accId, amount: amount });
    UI.toast(GAME.fmt(amount) + " çekildi.", "success");
    UI.renderSection("banka");
  }

  function transfer(accId, toIBAN, amount, desc) {
    amount = parseFloat(amount);
    if (isNaN(amount) || amount < 1) return UI.toast("Geçerli miktar giriniz.", "error");
    if (!toIBAN || toIBAN.length < 10) return UI.toast("Geçerli IBAN giriniz.", "error");
    var acc = (GAME.state.bank.accounts || []).find(function (a) { return a.id === accId; });
    if (!acc) return UI.toast("Kaynak hesap bulunamadı.", "error");
    var total = amount + D.CONFIG.TRANSFER_FEE;
    if (acc.balance < total) return UI.toast("Bakiye yetersiz (ücret dahil: " + GAME.fmt(total) + ").", "error");
    acc.balance -= total;
    GAME.updateCreditScore(2);
    GAME.dirty = true;
    DB.logTransaction(GAME.user.uid, { type: "transfer", toIBAN: toIBAN, amount: amount, fee: D.CONFIG.TRANSFER_FEE, desc: desc || "" });
    UI.toast(GAME.fmt(amount) + " gönderildi. Ücret: " + GAME.fmt(D.CONFIG.TRANSFER_FEE), "success");
    UI.renderSection("banka");
  }

  function openTD(accId, amount, months) {
    amount = parseFloat(amount); months = parseInt(months);
    if (isNaN(amount) || amount < 1000) return UI.toast("Minimum mevduat 1.000 TL.", "error");
    if (![1, 3, 6, 12].includes(months)) return UI.toast("Geçersiz vade.", "error");
    var acc = (GAME.state.bank.accounts || []).find(function (a) { return a.id === accId; });
    if (!acc) return UI.toast("Hesap bulunamadı.", "error");
    if (acc.balance < amount) return UI.toast("Bakiye yetersiz.", "error");
    var bank     = D.BANKS.find(function (b) { return b.id === acc.bankId; });
    var rate     = bank.depositRate * (months / 12);
    var interest = parseFloat((amount * rate).toFixed(2));
    acc.balance -= amount;
    GAME.state.bank.deposits.push({
      id:         "dep_" + Date.now(),
      type:       "mevduat",
      bankId:     acc.bankId,
      bankName:   acc.bankName,
      amount:     amount,
      rate:       rate,
      months:     months,
      interest:   interest,
      accumulated:0,
      startDate:  new Date().toISOString(),
      maturity:   new Date(Date.now() + months * 30 * 86400 * 1000).toISOString(),
      active:     true
    });
    GAME.dirty = true;
    GAME.addXP(100);
    UI.toast(months + " aylık mevduat açıldı. Getiri: " + GAME.fmt(interest), "success");
    UI.renderSection("banka");
  }

  function breakDeposit(depId) {
    var idx = (GAME.state.bank.deposits || []).findIndex(function (d) { return d.id === depId; });
    if (idx === -1) return UI.toast("Mevduat bulunamadı.", "error");
    var dep     = GAME.state.bank.deposits[idx];
    var penalty = dep.amount * 0.01;
    var ret     = dep.amount + dep.accumulated - penalty;
    GAME.earnRaw(ret);
    GAME.state.bank.deposits.splice(idx, 1);
    GAME.dirty = true;
    UI.toast("Mevduat bozuldu. " + GAME.fmt(ret) + " iade edildi (ceza: " + GAME.fmt(penalty) + ").", "info");
    UI.renderSection("banka");
  }

  function applyLoan(bankId, amount, months) {
    amount = parseFloat(amount); months = parseInt(months);
    var bank = D.BANKS.find(function (b) { return b.id === bankId; });
    if (!bank) return UI.toast("Banka bulunamadı.", "error");
    var activeLoans = (GAME.state.bank.loans || []).filter(function (l) { return l.active; });
    if (activeLoans.length >= D.CONFIG.MAX_LOANS) return UI.toast("Maksimum " + D.CONFIG.MAX_LOANS + " aktif kredi.", "error");
    if (GAME.state.profile.creditScore < bank.minScore)
      return UI.toast("Kredi notu yetersiz. Gerekli: " + bank.minScore + ", Sizin: " + GAME.state.profile.creditScore, "error");
    if (amount > bank.maxLoan) return UI.toast("Max kredi: " + GAME.fmt(bank.maxLoan), "error");
    if (amount < 5000) return UI.toast("Minimum kredi 5.000 TL.", "error");
    var mr      = bank.loanRate / 12;
    var monthly = amount * mr * Math.pow(1 + mr, months) / (Math.pow(1 + mr, months) - 1);
    GAME.state.bank.loans = GAME.state.bank.loans || [];
    GAME.state.bank.loans.push({
      id:            "loan_" + Date.now(),
      bankId:        bankId,
      bankName:      bank.name,
      amount:        amount,
      months:        months,
      monthlyPayment:parseFloat(monthly.toFixed(2)),
      totalPayment:  parseFloat((monthly * months).toFixed(2)),
      rate:          bank.loanRate,
      paidMonths:    0,
      startDate:     new Date().toISOString(),
      active:        true
    });
    GAME.earnRaw(amount);
    GAME.updateCreditScore(-20);
    GAME.addXP(150);
    DB.logTransaction(GAME.user.uid, { type: "loan", bankId: bankId, amount: amount, months: months });
    UI.toast(GAME.fmt(amount) + " kredi onaylandı! Aylık: " + GAME.fmt(monthly), "success");
    UI.renderSection("banka");
  }

  function payLoan(loanId) {
    var loan = (GAME.state.bank.loans || []).find(function (l) { return l.id === loanId; });
    if (!loan || !loan.active) return UI.toast("Kredi bulunamadı.", "error");
    if (!GAME.spend(loan.monthlyPayment, "Kredi taksiti")) return;
    loan.paidMonths++;
    GAME.updateCreditScore(5);
    if (loan.paidMonths >= loan.months) {
      loan.active = false;
      GAME.updateCreditScore(30);
      UI.toast("🎉 Krediniz tamamen ödendi!", "success");
    } else {
      UI.toast("Taksit ödendi. Kalan: " + (loan.months - loan.paidMonths), "success");
    }
    UI.renderSection("banka");
  }

  function issueCheck(accId, amount, payee) {
    amount = parseFloat(amount);
    if (isNaN(amount) || amount < 100) return UI.toast("Minimum çek 100 TL.", "error");
    var acc = (GAME.state.bank.accounts || []).find(function (a) { return a.id === accId; });
    if (!acc) return UI.toast("Hesap bulunamadı.", "error");
    if (acc.balance < amount) return UI.toast("Bakiye yetersiz.", "error");
    acc.balance -= amount;
    GAME.state.bank.checks = GAME.state.bank.checks || [];
    var serial = "TR" + Date.now().toString().slice(-8);
    GAME.state.bank.checks.push({ id: "chk_" + Date.now(), serial: serial, accId: accId, amount: amount, payee: AUTH.sanitize(payee || ""), issuedAt: new Date().toISOString(), cashed: false });
    GAME.dirty = true;
    UI.toast("Çek kesildi. Seri: " + serial, "success");
    UI.renderSection("banka");
  }

  // ════ BORSA ════

  function buyStock(sym, qty) {
    qty = parseInt(qty);
    if (isNaN(qty) || qty < 1) return UI.toast("Geçerli lot giriniz.", "error");
    var price      = GAME.prices[sym];
    if (!price)    return UI.toast("Hisse bulunamadı.", "error");
    var commission = price * qty * D.CONFIG.COMMISSION;
    var total      = price * qty + commission;
    if (!GAME.spend(total, sym + " alımı")) return;
    var p = GAME.state.stocks.portfolio;
    if (!p[sym]) p[sym] = { qty: 0, avgCost: 0, invested: 0 };
    p[sym].invested += price * qty;
    p[sym].qty      += qty;
    p[sym].avgCost   = p[sym].invested / p[sym].qty;
    GAME.state.stats.tradeCount++;
    GAME.addXP(20 + Math.floor(qty / 10));
    DB.logTransaction(GAME.user.uid, { type: "buy_stock", sym: sym, qty: qty, price: price, commission: commission });
    UI.toast(qty + " lot " + sym + " alındı. Komisyon: " + GAME.fmt(commission), "success");
    UI.renderSection("borsa");
  }

  function sellStock(sym, qty) {
    qty = parseInt(qty);
    if (isNaN(qty) || qty < 1) return UI.toast("Geçerli lot giriniz.", "error");
    var p = GAME.state.stocks.portfolio;
    if (!p[sym] || p[sym].qty < qty) return UI.toast("Yeterli hisse yok.", "error");
    var price      = GAME.prices[sym];
    var commission = price * qty * D.CONFIG.COMMISSION;
    var net        = price * qty - commission;
    var pnl        = net - p[sym].avgCost * qty;
    p[sym].qty    -= qty;
    p[sym].invested = p[sym].avgCost * p[sym].qty;
    if (p[sym].qty === 0) delete p[sym];
    GAME.earnRaw(net);
    GAME.state.stats.tradeCount++;
    GAME.addXP(15);
    DB.logTransaction(GAME.user.uid, { type: "sell_stock", sym: sym, qty: qty, price: price, net: net, pnl: pnl });
    var pStr = pnl >= 0 ? "+" + GAME.fmt(pnl) + " kâr" : GAME.fmt(pnl) + " zarar";
    UI.toast(qty + " lot " + sym + " satıldı. " + pStr, pnl >= 0 ? "success" : "warning");
    UI.renderSection("borsa");
  }

  function toggleWatchlist(sym) {
    var wl = GAME.state.stocks.watchlist;
    var idx = wl.indexOf(sym);
    if (idx === -1) { wl.push(sym); UI.toast(sym + " izlemeye alındı.", "success"); }
    else { wl.splice(idx, 1); UI.toast(sym + " izlemeden çıkarıldı.", "info"); }
    GAME.dirty = true;
  }

  // ════ KRİPTO ════

  function buyCrypto(sym, tlAmount) {
    tlAmount = parseFloat(tlAmount);
    if (isNaN(tlAmount) || tlAmount < 10) return UI.toast("Minimum 10 TL giriniz.", "error");
    var price  = GAME.cprices[sym];
    if (!price) return UI.toast("Kripto bulunamadı.", "error");
    var spread = tlAmount * D.CONFIG.CRYPTO_SPREAD;
    var total  = tlAmount + spread;
    if (!GAME.spend(total, sym + " alımı")) return;
    var qty = tlAmount / price;
    var p = GAME.state.crypto.portfolio;
    if (!p[sym]) p[sym] = { qty: 0, avgCost: 0, invested: 0 };
    p[sym].invested += tlAmount;
    p[sym].qty      += qty;
    p[sym].avgCost   = p[sym].invested / p[sym].qty;
    GAME.addXP(10);
    DB.logTransaction(GAME.user.uid, { type: "buy_crypto", sym: sym, qty: qty, price: price });
    UI.toast(qty.toFixed(6) + " " + sym + " alındı. Spread: " + GAME.fmt(spread), "success");
    UI.renderSection("kripto");
  }

  function sellCrypto(sym, qty) {
    qty = parseFloat(qty);
    if (isNaN(qty) || qty <= 0) return UI.toast("Geçerli miktar giriniz.", "error");
    var p = GAME.state.crypto.portfolio;
    if (!p[sym] || p[sym].qty < qty) return UI.toast("Yeterli kripto yok.", "error");
    var price  = GAME.cprices[sym];
    var gross  = qty * price;
    var spread = gross * D.CONFIG.CRYPTO_SPREAD;
    var net    = gross - spread;
    var pnl    = net - p[sym].avgCost * qty;
    p[sym].qty -= qty;
    p[sym].invested = p[sym].avgCost * p[sym].qty;
    if (p[sym].qty < 1e-8) delete p[sym];
    GAME.earnRaw(net);
    GAME.addXP(8);
    DB.logTransaction(GAME.user.uid, { type: "sell_crypto", sym: sym, qty: qty, net: net, pnl: pnl });
    var pStr = pnl >= 0 ? "+" + GAME.fmt(pnl) + " kâr" : GAME.fmt(pnl) + " zarar";
    UI.toast(qty + " " + sym + " satıldı. " + pStr, pnl >= 0 ? "success" : "warning");
    UI.renderSection("kripto");
  }

  // ════ TAHVİL / FON ════

  function buyBond(type, amount, months) {
    amount = parseFloat(amount); months = parseInt(months);
    if (isNaN(amount) || amount < 1000) return UI.toast("Minimum 1.000 TL.", "error");
    var rates  = { devlet: 0.35, ozel: 0.42, belediye: 0.38 };
    var rate   = (rates[type] || 0.35) * (months / 12);
    if (!GAME.spend(amount, "Tahvil")) return;
    GAME.state.bank.deposits.push({
      id: "bond_" + Date.now(), type: "tahvil", subtype: type,
      bankName: type === "devlet" ? "Hazine" : type === "ozel" ? "Özel Sektör" : "Belediye",
      amount: amount, rate: rate, months: months,
      interest: parseFloat((amount * rate).toFixed(2)), accumulated: 0,
      startDate: new Date().toISOString(),
      maturity: new Date(Date.now() + months * 30 * 86400 * 1000).toISOString(),
      active: true
    });
    GAME.addXP(80);
    UI.toast("Tahvil alındı. Getiri: " + GAME.fmt(amount * rate), "success");
    UI.renderSection("tahvil");
  }

  function buyFund(fundId, amount) {
    amount = parseFloat(amount);
    var fund = D.FUNDS.find(function (f) { return f.id === fundId; });
    if (!fund) return UI.toast("Fon bulunamadı.", "error");
    if (amount < fund.min) return UI.toast("Minimum: " + GAME.fmt(fund.min), "error");
    if (!GAME.spend(amount, "Fon")) return;
    GAME.state.bank.deposits.push({
      id: "fund_" + Date.now(), type: "fon", subtype: fundId,
      bankName: fund.name, amount: amount, rate: fund.ret, months: 12,
      interest: parseFloat((amount * fund.ret).toFixed(2)), accumulated: 0,
      startDate: new Date().toISOString(),
      maturity: new Date(Date.now() + 365 * 86400 * 1000).toISOString(),
      active: true
    });
    GAME.addXP(60);
    UI.toast(fund.name + "'a " + GAME.fmt(amount) + " yatırıldı.", "success");
    UI.renderSection("fonlar");
  }

  // ════ SİGORTA ════

  function buyInsurance(typeId, optIdx, vehicleOrProp) {
    var ins = D.INSURANCES.find(function (i) { return i.id === typeId; });
    if (!ins) return UI.toast("Sigorta türü bulunamadı.", "error");
    var premium = ins.minPrem + Math.floor(Math.random() * ins.minPrem * 0.3);
    if (!GAME.spend(premium, "Sigorta primi")) return;
    GAME.state.properties.insurance.push({
      id: "ins_" + Date.now(), typeId: typeId, typeName: ins.name,
      option: ins.opts[optIdx] || ins.opts[0],
      premium: premium, vehicleOrProp: AUTH.sanitize(vehicleOrProp || ""),
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 365 * 86400 * 1000).toISOString(),
      active: true
    });
    GAME.addXP(40);
    UI.toast(ins.name + " poliçesi oluşturuldu. Prim: " + GAME.fmt(premium) + "/yıl", "success");
    UI.renderSection("sigorta");
  }

  // ════ GAYRİMENKUL ════

  function buyRealEstate(typeIdx, sizeIdx, city) {
    var re = D.REAL_ESTATE[typeIdx];
    if (!re) return UI.toast("Tür bulunamadı.", "error");
    var sizeStr = re.sizes[sizeIdx];
    var m2      = _parseM2(sizeStr, re.type);
    var price   = re.priceM2 * m2 * (1 + (Math.random() * 0.1 - 0.05));
    var kdv     = price * D.CONFIG.VAT_LOW;
    var total   = parseFloat((price + kdv).toFixed(0));
    if (!GAME.spend(total, "Gayrimenkul")) return;
    GAME.state.properties.realEstate.push({
      id: "re_" + Date.now(), type: re.type, emoji: re.emoji,
      size: sizeStr, m2: m2, city: city,
      price: parseFloat(price.toFixed(0)),
      purchaseDate: new Date().toISOString(),
      rented: false, rentIncome: 0
    });
    GAME.addXP(200 + m2);
    GAME.updateCreditScore(10);
    UI.toast(city + "'de " + sizeStr + " " + re.type + " alındı. KDV dahil: " + GAME.fmt(total), "success");
    UI.renderSection("gayrimenkul");
  }

  function rentProperty(propId, monthlyRent) {
    monthlyRent = parseFloat(monthlyRent);
    var prop = (GAME.state.properties.realEstate || []).find(function (p) { return p.id === propId; });
    if (!prop) return UI.toast("Mülk bulunamadı.", "error");
    if (prop.rented) return UI.toast("Mülk zaten kiralanmış.", "info");
    if (isNaN(monthlyRent) || monthlyRent < 1) return UI.toast("Geçerli kira giriniz.", "error");
    prop.rented = true;
    prop.rentIncome = monthlyRent;
    GAME.dirty = true;
    UI.toast("Mülk kiralandı. Aylık: " + GAME.fmt(monthlyRent), "success");
    UI.renderSection("gayrimenkul");
  }

  function collectRent(propId) {
    var prop = (GAME.state.properties.realEstate || []).find(function (p) { return p.id === propId; });
    if (!prop || !prop.rented) return UI.toast("Kiralanmış mülk yok.", "error");
    var net = GAME.earnNet(prop.rentIncome, "Kira");
    GAME.addXP(10);
    UI.toast("Kira tahsil edildi: " + GAME.fmt(net) + " (vergi sonrası)", "success");
    UI.renderSection("gayrimenkul");
  }

  // ════ DİJİTAL CÜZDAN ════

  function setupWallet(provider) {
    if (GAME.state.wallet.digitalWallet.provider)
      return UI.toast("Dijital cüzdan zaten aktif.", "info");
    GAME.state.wallet.digitalWallet.provider = provider;
    GAME.state.wallet.digitalWallet.balance  = 0;
    GAME.dirty = true;
    GAME.addXP(30);
    UI.toast(provider + " dijital cüzdanı aktive edildi!", "success");
    UI.renderSection("dijital-cuzdani");
  }

  function loadWallet(amount) {
    amount = parseFloat(amount);
    if (isNaN(amount) || amount < 10) return UI.toast("Minimum 10 TL yükleyin.", "error");
    if (!GAME.spend(amount, "Dijital cüzdan")) return;
    GAME.state.wallet.digitalWallet.balance += amount;
    UI.toast(GAME.fmt(amount) + " dijital cüzdana yüklendi.", "success");
    UI.renderSection("dijital-cuzdani");
  }

  // ————— YARDIMCILAR —————

  function _parseM2(sizeStr, type) {
    if (sizeStr.includes("m²")) return parseInt(sizeStr.replace("m²", "")) || 100;
    return D.RE_SIZE_M2[sizeStr] || 100;
  }

  return {
    openAccount: openAccount, closeAccount: closeAccount,
    deposit: deposit, withdraw: withdraw, transfer: transfer,
    openTD: openTD, breakDeposit: breakDeposit,
    applyLoan: applyLoan, payLoan: payLoan, issueCheck: issueCheck,
    buyStock: buyStock, sellStock: sellStock, toggleWatchlist: toggleWatchlist,
    buyCrypto: buyCrypto, sellCrypto: sellCrypto,
    buyBond: buyBond, buyFund: buyFund,
    buyInsurance: buyInsurance,
    buyRealEstate: buyRealEstate, rentProperty: rentProperty, collectRent: collectRent,
    setupWallet: setupWallet, loadWallet: loadWallet
  };
})();
