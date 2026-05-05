// ============================================================
// TÜRK İMPARATORLUĞU — ekonomi.js
// Üretim, Ticaret, Lojistik, İhracat, İhale, Karaborsa, Oyuncu Pazarı
// ============================================================
"use strict";

var EKONOMI = (function () {

  // ════ ÜRETİM ════

  function build(prodType, levelIdx, opts) {
    opts = opts || {};
    var def = D.PRODUCTION[prodType];
    if (!def) return UI.toast("Geçersiz üretim türü.", "error");
    var lv = def.levels[levelIdx];
    if (!lv) return UI.toast("Geçersiz seviye.", "error");
    if (def.needPermit && !DEVLET.hasPermit("İnşaat Ruhsatı"))
      return UI.toast("Bu tesis için belediyeden İnşaat Ruhsatı gerekli!", "error");
    if (!GAME.spend(lv.cost, def.name + " inşaatı")) return;
    var arrKey = def.arrKey;
    GAME.state.production[arrKey] = GAME.state.production[arrKey] || [];
    GAME.state.production[arrKey].push({
      id:          prodType + "_" + Date.now(),
      prodType:    prodType,
      typeName:    def.name,
      emoji:       def.emoji,
      levelIdx:    levelIdx,
      levelName:   lv.name,
      cost:        lv.cost,
      income:      lv.income,
      timeSec:     lv.timeSec,
      lastCollected: Date.now(),
      readyAt:     Date.now() + lv.timeSec * 1000,
      subtype:     AUTH.sanitize(opts.subtype || ""),
      city:        opts.city || D.CITIES[0],
      active:      true
    });
    GAME.addXP(100 + levelIdx * 50);
    UI.toast(lv.name + " inşaatı başladı! Tamamlanma: " + GAME.fmtTime(lv.timeSec), "success");
    UI.renderSection("uretim");
  }

  function collectProd(arrKey, itemId) {
    var item = (GAME.state.production[arrKey] || []).find(function (x) { return x.id === itemId; });
    if (!item) return UI.toast("Tesis bulunamadı.", "error");
    var now = Date.now();
    if (now < item.readyAt) {
      var rem = Math.ceil((item.readyAt - now) / 60000);
      return UI.toast("Henüz hazır değil. " + rem + " dakika kaldı.", "info");
    }
    var elapsed = now - item.lastCollected;
    var ticks   = Math.floor(elapsed / (item.timeSec * 1000));
    if (ticks < 1) return UI.toast("Gelir henüz hazır değil.", "info");
    var net = GAME.earnNet(ticks * item.income, item.typeName);
    item.lastCollected = now;
    item.readyAt       = now + item.timeSec * 1000;
    GAME.addXP(10);
    UI.toast(item.levelName + " geliri toplandı: " + GAME.fmt(net) + " (vergi sonrası)", "success");
    UI.renderSection("uretim");
  }

  function upgradeProd(arrKey, itemId) {
    var list = GAME.state.production[arrKey] || [];
    var item = list.find(function (x) { return x.id === itemId; });
    if (!item) return UI.toast("Tesis bulunamadı.", "error");
    var def   = D.PRODUCTION[item.prodType];
    var nextI = item.levelIdx + 1;
    if (nextI >= def.levels.length) return UI.toast("Maksimum seviyede.", "info");
    var nextLv = def.levels[nextI];
    var cost   = nextLv.cost - def.levels[item.levelIdx].cost;
    if (!GAME.spend(cost, "Yükseltme")) return;
    item.levelIdx  = nextI;
    item.levelName = nextLv.name;
    item.income    = nextLv.income;
    item.timeSec   = nextLv.timeSec;
    GAME.addXP(150);
    UI.toast(item.typeName + " yükseltildi → " + nextLv.name + ". Gelir: " + GAME.fmt(nextLv.income), "success");
    UI.renderSection("uretim");
  }

  function sellProd(arrKey, itemId) {
    var list = GAME.state.production[arrKey] || [];
    var idx  = list.findIndex(function (x) { return x.id === itemId; });
    if (idx === -1) return UI.toast("Tesis bulunamadı.", "error");
    var item = list[idx];
    var sale = parseFloat((item.cost * 0.6).toFixed(0));
    GAME.earnRaw(sale);
    list.splice(idx, 1);
    GAME.dirty = true;
    UI.toast(item.levelName + " satıldı: " + GAME.fmt(sale), "success");
    UI.renderSection("uretim");
  }

  function collectAll() {
    var now   = Date.now();
    var total = 0;
    var keys  = Object.values(D.PRODUCTION).map(function (d) { return d.arrKey; });
    keys.forEach(function (key) {
      (GAME.state.production[key] || []).forEach(function (item) {
        if (now < item.readyAt) return;
        var elapsed = now - item.lastCollected;
        var ticks   = Math.floor(elapsed / (item.timeSec * 1000));
        if (ticks < 1) return;
        total += GAME.earnNet(ticks * item.income, item.typeName);
        item.lastCollected = now;
        item.readyAt       = now + item.timeSec * 1000;
      });
    });
    if (total === 0) return UI.toast("Hazır gelir yok.", "info");
    GAME.dirty = true;
    UI.toast("Tüm gelirler toplandı: " + GAME.fmt(total), "success");
    UI.renderSection("uretim");
  }

  // ════ DÜKKANLAR ════

  function openShop(shopId, city) {
    var def = D.SHOPS.find(function (s) { return s.id === shopId; });
    if (!def) return UI.toast("Dükkan türü bulunamadı.", "error");
    if (!DEVLET.hasPermit("İşyeri Açma Ruhsatı"))
      return UI.toast("İşyeri açmak için belediyeden ruhsat alın!", "error");
    if (!GAME.spend(def.cost, def.name + " açılışı")) return;
    GAME.state.commerce.shops = GAME.state.commerce.shops || [];
    GAME.state.commerce.shops.push({
      id:            "shop_" + Date.now(),
      shopId:        shopId,
      name:          def.name,
      emoji:         def.emoji,
      income:        def.income,
      timeSec:       def.timeSec,
      cost:          def.cost,
      city:          city,
      lastCollected: Date.now(),
      readyAt:       Date.now() + def.timeSec * 1000
    });
    GAME.addXP(80);
    UI.toast(def.name + " açıldı (" + city + ")! Her " + GAME.fmtTime(def.timeSec) + " gelir üretir.", "success");
    UI.renderSection("ticaret");
  }

  function collectShop(shopId) {
    var shop = (GAME.state.commerce.shops || []).find(function (s) { return s.id === shopId; });
    if (!shop) return UI.toast("Dükkan bulunamadı.", "error");
    var now = Date.now();
    if (now < shop.readyAt) {
      var rem = Math.ceil((shop.readyAt - now) / 60000);
      return UI.toast(shop.name + " hazır değil. " + rem + " dakika.", "info");
    }
    var elapsed = now - shop.lastCollected;
    var ticks   = Math.floor(elapsed / (shop.timeSec * 1000));
    if (ticks < 1) return UI.toast("Henüz gelir yok.", "info");
    var net = GAME.earnNet(ticks * shop.income, shop.name);
    shop.lastCollected = now;
    shop.readyAt       = now + shop.timeSec * 1000;
    GAME.addXP(5);
    UI.toast(shop.name + ": " + GAME.fmt(net) + " kazanıldı.", "success");
    UI.renderSection("ticaret");
  }

  // ════ LOJİSTİK ════

  function deliverGoods(goodId, qty, fromCity, toCity) {
    qty = parseInt(qty);
    if (isNaN(qty) || qty < 1) return UI.toast("Geçerli miktar giriniz.", "error");
    var good = D.GOODS.find(function (g) { return g.id === goodId; });
    if (!good) return UI.toast("Ürün bulunamadı.", "error");
    if (fromCity === toCity) return UI.toast("Kaynak ve varış aynı olamaz.", "error");
    var cost    = qty * 10 * 3;
    var revenue = qty * good.price * 0.15;
    if (!GAME.spend(cost, "Lojistik")) return;
    var net = GAME.earnNet(revenue, "Lojistik geliri");
    GAME.addXP(30);
    UI.toast(qty + " " + good.unit + " " + good.name + " teslim edildi. Kâr: " + GAME.fmt(net - cost > 0 ? net - cost : 0), "success");
    UI.renderSection("lojistik");
  }

  // ════ İHRACAT ════

  function exportGoods(goodId, qty, country) {
    qty = parseInt(qty);
    if (isNaN(qty) || qty < 1) return UI.toast("Geçerli miktar giriniz.", "error");
    var good = D.GOODS.find(function (g) { return g.id === goodId; });
    if (!good) return UI.toast("Ürün bulunamadı.", "error");
    var multipliers = { "Almanya": 1.35, "ABD": 1.45, "Çin": 1.20, "Japonya": 1.50, "İngiltere": 1.40 };
    var mult     = multipliers[country] || 1.30;
    var cost     = qty * good.price * 0.80;
    var customs  = cost * 0.05;
    var revenue  = qty * good.price * mult;
    if (!GAME.spend(cost + customs, "İhracat maliyeti")) return;
    var net = GAME.earnNet(revenue, "İhracat geliri");
    var profit = net - cost - customs;
    GAME.addXP(100);
    GAME.updateCreditScore(5);
    UI.toast("🌍 " + qty + " " + good.unit + " " + good.name + " → " + country + ". Net kâr: " + GAME.fmt(profit), "success");
    UI.renderSection("ihracat");
  }

  // ════ İHALELER ════

  function bidForTender(tenderId) {
    var tender = D.TENDERS.find(function (t) { return t.id === tenderId; });
    if (!tender) return UI.toast("İhale bulunamadı.", "error");
    var deposit = parseFloat((tender.minBid * 0.10).toFixed(0));
    if (!GAME.spend(deposit, "İhale teminatı")) return;
    var won = Math.random() > 0.60;
    GAME.earnRaw(deposit); // Teminat her durumda iade
    if (won) {
      var net = GAME.earnNet(tender.value, "İhale geliri");
      GAME.addXP(200);
      GAME.updateCreditScore(15);
      UI.toast("🏆 İhaleyi kazandınız! Sözleşme: " + GAME.fmt(tender.value), "success");
    } else {
      UI.toast("İhale kaybedildi. Teminat iade edildi.", "warning");
    }
    UI.renderSection("ihaleler");
  }

  // ════ KARABORSA ════

  function blackMarketBuy(itemId) {
    var item = D.BLACK_MARKET.find(function (i) { return i.id === itemId; });
    if (!item) return UI.toast("Ürün bulunamadı.", "error");
    if (!GAME.spend(item.price, "Karaborsa")) return;
    var caught = Math.random() < item.riskRate;
    if (caught) {
      var fine = parseFloat((item.price * 2).toFixed(0));
      fine = Math.min(fine, GAME.state.wallet.tl);
      if (fine > 0) GAME.spend(fine, "Kaçakçılık cezası");
      GAME.updateCreditScore(-50);
      GAME.state.government.criminalRecord = GAME.state.government.criminalRecord || [];
      GAME.state.government.criminalRecord.push({
        id: "crime_" + Date.now(), type: "Kaçakçılık",
        subject: item.name, details: "Yakalandı.",
        status: "Ceza kesildi", filedAt: new Date().toISOString()
      });
      GAME.dirty = true;
      UI.toast("🚨 Yakalandınız! Ceza: " + GAME.fmt(fine) + ". Kredi notu düştü.", "error");
    } else {
      var profit = parseFloat((item.price * item.profitMult).toFixed(0));
      GAME.earnRaw(profit);
      GAME.addXP(50);
      UI.toast("⚫ İşlem tamamlandı. Kâr: " + GAME.fmt(profit - item.price), "success");
    }
    UI.renderSection("karaborsa");
  }

  // ════ OYUNCU PAZARI ════

  function listItem(goodId, qty, pricePerUnit) {
    qty          = parseInt(qty);
    pricePerUnit = parseFloat(pricePerUnit);
    var good = D.GOODS.find(function (g) { return g.id === goodId; });
    if (!good) return UI.toast("Ürün bulunamadı.", "error");
    if (isNaN(qty) || qty < 1) return UI.toast("Geçerli miktar giriniz.", "error");
    if (isNaN(pricePerUnit) || pricePerUnit <= 0) return UI.toast("Geçerli fiyat giriniz.", "error");
    var fee = parseFloat((qty * pricePerUnit * 0.02).toFixed(2));
    if (!GAME.spend(fee, "Listeleme ücreti")) return;
    DB.addListing({
      sellerId:     GAME.user.uid,
      sellerName:   GAME.state.profile.name,
      goodId:       goodId,
      goodName:     good.name,
      unit:         good.unit,
      qty:          qty,
      pricePerUnit: pricePerUnit,
      total:        parseFloat((qty * pricePerUnit).toFixed(2)),
      active:       true
    }).then(function () {
      GAME.addXP(20);
      UI.toast(good.name + " listelendi. " + qty + " " + good.unit + " @ " + GAME.fmt(pricePerUnit), "success");
      UI.renderSection("oyuncu-pazari");
    });
  }

  function buyFromMarket(listingId, listing) {
    if (!listing) return UI.toast("İlan bulunamadı.", "error");
    if (listing.sellerId === GAME.user.uid) return UI.toast("Kendi ilanınızı alamazsınız.", "error");
    if (!GAME.spend(listing.total, listing.goodName + " alımı")) return;
    // İlanı kapat
    window.fbDB.collection("marketplace").doc(listingId).update({ active: false }).catch(function () {});
    GAME.addXP(15);
    UI.toast(listing.qty + " " + listing.unit + " " + listing.goodName + " satın alındı. " + GAME.fmt(listing.total), "success");
    UI.renderSection("oyuncu-pazari");
  }

  return {
    build: build, collectProd: collectProd, upgradeProd: upgradeProd,
    sellProd: sellProd, collectAll: collectAll,
    openShop: openShop, collectShop: collectShop,
    deliverGoods: deliverGoods, exportGoods: exportGoods,
    bidForTender: bidForTender, blackMarketBuy: blackMarketBuy,
    listItem: listItem, buyFromMarket: buyFromMarket
  };
})();
