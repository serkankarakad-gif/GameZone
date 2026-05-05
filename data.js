// ============================================================
// TÜRK İMPARATORLUĞU — data.js  (Tüm sabit veriler)
// ============================================================
"use strict";

const D = (function () {

  const CONFIG = {
    GAME_NAME:       "Türk İmparatorluğu",
    INITIAL_TL:      50000,
    INITIAL_ELMAS:   10,
    LEVEL_XP_BASE:   1000,
    LEVEL_XP_MULT:   1.5,
    MARKET_TICK_MS:  30000,   // 30 saniye
    AUTO_SAVE_MS:    60000,   // 1 dakika
    COMMISSION:      0.001,   // %0.1
    CRYPTO_SPREAD:   0.002,   // %0.2
    TRANSFER_FEE:    5,
    TAX_RATE:        0.20,    // %20 gelir vergisi
    VAT:             0.18,    // %18 KDV
    VAT_LOW:         0.08,    // %8 indirimli KDV
    MAX_LOANS:       5,
    CREDIT_SCORE_INIT: 650,
    OFFLINE_MAX_MS:  8 * 3600 * 1000  // maks 8 saat offline kazanç
  };

  const BANKS = [
    { id:"ziraat",   name:"Ziraat Bankası",  emoji:"🌾", type:"Devlet",  color:"#c8102e", depositRate:0.42, loanRate:0.62, minDeposit:1000, maxLoan:500000, minScore:500 },
    { id:"halkbank", name:"Halk Bankası",    emoji:"🏛️", type:"Devlet",  color:"#003399", depositRate:0.40, loanRate:0.60, minDeposit:1000, maxLoan:400000, minScore:500 },
    { id:"vakifbank",name:"VakıfBank",       emoji:"🕌", type:"Devlet",  color:"#ff6600", depositRate:0.41, loanRate:0.61, minDeposit:1000, maxLoan:450000, minScore:500 },
    { id:"isbank",   name:"İş Bankası",      emoji:"💼", type:"Özel",   color:"#003366", depositRate:0.46, loanRate:0.66, minDeposit:500,  maxLoan:600000, minScore:600 },
    { id:"akbank",   name:"Akbank",          emoji:"🔴", type:"Özel",   color:"#cc0000", depositRate:0.45, loanRate:0.65, minDeposit:500,  maxLoan:550000, minScore:600 },
    { id:"garanti",  name:"Garanti BBVA",    emoji:"💚", type:"Özel",   color:"#00a651", depositRate:0.47, loanRate:0.67, minDeposit:500,  maxLoan:650000, minScore:600 },
    { id:"yapikredi",name:"Yapı Kredi",      emoji:"🏗️", type:"Özel",   color:"#002d6e", depositRate:0.44, loanRate:0.64, minDeposit:500,  maxLoan:500000, minScore:600 },
    { id:"teb",      name:"TEB",             emoji:"🔵", type:"Özel",   color:"#003399", depositRate:0.43, loanRate:0.63, minDeposit:250,  maxLoan:350000, minScore:550 }
  ];

  const STOCKS = [
    { sym:"THYAO", name:"Türk Hava Yolları",    sector:"Havacılık",        price:285.40, vol:0.025, pe:12.5, div:0.030 },
    { sym:"GARAN", name:"Garanti BBVA",          sector:"Bankacılık",       price:155.60, vol:0.020, pe:4.2,  div:0.120 },
    { sym:"ISCTR", name:"İş Bankası C",          sector:"Bankacılık",       price:42.18,  vol:0.018, pe:3.8,  div:0.150 },
    { sym:"AKBNK", name:"Akbank",                sector:"Bankacılık",       price:78.50,  vol:0.019, pe:4.5,  div:0.100 },
    { sym:"EREGL", name:"Ereğli Demir Çelik",    sector:"Metal",            price:62.30,  vol:0.022, pe:6.8,  div:0.080 },
    { sym:"KRDMD", name:"Kardemir",              sector:"Metal",            price:14.85,  vol:0.030, pe:5.9,  div:0.050 },
    { sym:"BIMAS", name:"BİM Mağazalar",         sector:"Perakende",        price:512.00, vol:0.015, pe:22.1, div:0.025 },
    { sym:"MGROS", name:"Migros",                sector:"Perakende",        price:812.00, vol:0.018, pe:28.3, div:0.010 },
    { sym:"TUPRS", name:"Tüpraş",               sector:"Petrokimya",       price:648.00, vol:0.020, pe:9.2,  div:0.070 },
    { sym:"TCELL", name:"Turkcell",              sector:"Telekom",          price:104.80, vol:0.016, pe:18.5, div:0.030 },
    { sym:"KCHOL", name:"Koç Holding",           sector:"Holding",          price:215.80, vol:0.017, pe:11.2, div:0.040 },
    { sym:"SAHOL", name:"Sabancı Holding",        sector:"Holding",          price:95.40,  vol:0.016, pe:9.8,  div:0.050 },
    { sym:"FROTO", name:"Ford Otosan",            sector:"Otomotiv",         price:1248.00,vol:0.021, pe:16.2, div:0.040 },
    { sym:"TOASO", name:"Tofaş",                 sector:"Otomotiv",         price:354.20, vol:0.019, pe:14.8, div:0.060 },
    { sym:"ARCLK", name:"Arçelik",              sector:"Dayanıklı Tüketim",price:188.50, vol:0.024, pe:15.3, div:0.020 },
    { sym:"VESTL", name:"Vestel",               sector:"Elektronik",       price:45.30,  vol:0.032, pe:11.2, div:0.020 },
    { sym:"PGSUS", name:"Pegasus",              sector:"Havacılık",        price:845.00, vol:0.028, pe:18.7, div:0.000 },
    { sym:"ENKAI", name:"Enka İnşaat",          sector:"İnşaat",           price:58.80,  vol:0.015, pe:8.9,  div:0.070 },
    { sym:"OYAKC", name:"Oyak Çimento",         sector:"Çimento",          price:88.90,  vol:0.020, pe:7.1,  div:0.090 },
    { sym:"SISE",  name:"Şişe Cam",             sector:"Cam",              price:48.20,  vol:0.018, pe:8.2,  div:0.040 },
    { sym:"ULKER", name:"Ülker",                sector:"Gıda",             price:152.30, vol:0.016, pe:20.1, div:0.025 },
    { sym:"AEFES", name:"Anadolu Efes",          sector:"İçecek",           price:184.50, vol:0.017, pe:12.4, div:0.030 },
    { sym:"ALARK", name:"Alarko Holding",        sector:"Enerji",           price:238.40, vol:0.020, pe:7.3,  div:0.060 },
    { sym:"DOHOL", name:"Doğan Holding",        sector:"Holding",          price:18.45,  vol:0.022, pe:6.5,  div:0.050 }
  ];

  const CRYPTOS = [
    { sym:"BTC",  name:"Bitcoin",   price:2850000, vol:0.040, color:"#f7931a" },
    { sym:"ETH",  name:"Ethereum",  price:168000,  vol:0.045, color:"#627eea" },
    { sym:"BNB",  name:"BNB",       price:35800,   vol:0.035, color:"#f3ba2f" },
    { sym:"XRP",  name:"XRP",       price:285,     vol:0.050, color:"#00aae4" },
    { sym:"SOL",  name:"Solana",    price:12800,   vol:0.055, color:"#9945ff" },
    { sym:"ADA",  name:"Cardano",   price:42.5,    vol:0.048, color:"#0033ad" },
    { sym:"DOGE", name:"Dogecoin",  price:18.5,    vol:0.065, color:"#c2a633" },
    { sym:"AVAX", name:"Avalanche", price:4200,    vol:0.052, color:"#e84142" },
    { sym:"LINK", name:"Chainlink", price:1850,    vol:0.042, color:"#2a5ada" },
    { sym:"MATIC",name:"Polygon",   price:285,     vol:0.058, color:"#8247e5" }
  ];

  const FUNDS = [
    { id:"f1", name:"Türkiye Büyüme Fonu",  type:"Hisse",         risk:"Orta-Yüksek", ret:0.65, min:1000 },
    { id:"f2", name:"Tahvil & Bono Fonu",   type:"Sabit Getirili",risk:"Düşük",       ret:0.38, min:500  },
    { id:"f3", name:"Para Piyasası Fonu",   type:"Para Piyasası", risk:"Çok Düşük",   ret:0.40, min:100  },
    { id:"f4", name:"Altın Fonu",           type:"Emtia",         risk:"Orta",        ret:0.52, min:500  },
    { id:"f5", name:"BIST 30 Endeks Fonu",  type:"Endeks",        risk:"Orta-Yüksek", ret:0.58, min:250  },
    { id:"f6", name:"Global Teknoloji Fonu",type:"Yabancı Hisse", risk:"Yüksek",      ret:0.72, min:2000 }
  ];

  const INSURANCES = [
    { id:"kasko",  name:"Kasko",           emoji:"🚗", opts:["Tam Kasko","Mini Kasko"],              minPrem:8000  },
    { id:"trafik", name:"Trafik Sigortası",emoji:"🛡️", opts:["Zorunlu Trafik"],                     minPrem:2000  },
    { id:"konut",  name:"Konut Sigortası", emoji:"🏠", opts:["Yangın","Genişletilmiş","DASK"],       minPrem:1500  },
    { id:"saglik", name:"Sağlık Sigortası",emoji:"🏥", opts:["Bireysel","Aile"],                     minPrem:12000 },
    { id:"hayat",  name:"Hayat Sigortası", emoji:"💚", opts:["Term","Birikimli"],                    minPrem:3000  },
    { id:"isyeri", name:"İşyeri Sigortası",emoji:"🏢", opts:["Yangın","Hırsızlık","Sorumluluk"],    minPrem:5000  }
  ];

  const PRODUCTION = {
    garden:  { name:"Bahçe",           emoji:"🌿", arrKey:"gardens",   levels:[
      { name:"Küçük Bahçe", cost:15000,    income:800,    timeSec:3600  },
      { name:"Orta Bahçe",  cost:45000,    income:2500,   timeSec:3600  },
      { name:"Büyük Bahçe", cost:120000,   income:7000,   timeSec:3600  },
      { name:"Sera Bahçe",  cost:350000,   income:22000,  timeSec:3600  }
    ]},
    farm:    { name:"Çiftlik",         emoji:"🚜", arrKey:"farms",     levels:[
      { name:"Küçük Çiftlik",cost:80000,   income:4500,   timeSec:7200  },
      { name:"Orta Çiftlik", cost:250000,  income:15000,  timeSec:7200  },
      { name:"Büyük Çiftlik",cost:750000,  income:45000,  timeSec:7200  }
    ]},
    factory: { name:"Fabrika",         emoji:"🏭", arrKey:"factories", levels:[
      { name:"Küçük Fabrika",cost:500000,  income:35000,  timeSec:14400 },
      { name:"Orta Fabrika", cost:1500000, income:110000, timeSec:14400 },
      { name:"Büyük Fabrika",cost:5000000, income:380000, timeSec:14400 }
    ], needPermit:true },
    mine:    { name:"Maden",           emoji:"⛏️", arrKey:"mines",     levels:[
      { name:"Küçük Maden",  cost:300000,  income:25000,  timeSec:10800 },
      { name:"Orta Maden",   cost:1000000, income:85000,  timeSec:10800 },
      { name:"Büyük Maden",  cost:3500000, income:300000, timeSec:10800 }
    ], subtypes:["Kömür","Bakır","Altın","Gümüş","Bor"] },
    energy:  { name:"Enerji Santrali", emoji:"⚡", arrKey:"energy",    levels:[
      { name:"Küçük Santral",cost:1000000, income:80000,  timeSec:21600 },
      { name:"Orta Santral", cost:5000000, income:420000, timeSec:21600 },
      { name:"Büyük Santral",cost:20000000,income:1800000,timeSec:21600 }
    ], subtypes:["Solar","Rüzgar","Hidroelektrik","Doğalgaz","Nükleer"] }
  };

  const SHOPS = [
    { id:"bakkal",   name:"Bakkal",          emoji:"🏪", cost:25000,  income:1200,  timeSec:1800  },
    { id:"market",   name:"Market",          emoji:"🛒", cost:120000, income:6500,  timeSec:3600  },
    { id:"restoran", name:"Restoran",        emoji:"🍽️", cost:200000, income:12000, timeSec:3600  },
    { id:"cafe",     name:"Kafe",            emoji:"☕", cost:80000,  income:4500,  timeSec:1800  },
    { id:"tekstil",  name:"Tekstil Dükkanı",emoji:"👔", cost:150000, income:8000,  timeSec:3600  },
    { id:"eczane",   name:"Eczane",          emoji:"💊", cost:300000, income:18000, timeSec:7200  },
    { id:"elektrik", name:"Elektronik",      emoji:"📱", cost:250000, income:14000, timeSec:7200  },
    { id:"kuyumcu",  name:"Kuyumcu",         emoji:"💍", cost:500000, income:32000, timeSec:7200  }
  ];

  const REAL_ESTATE = [
    { type:"Daire",  emoji:"🏢", sizes:["1+1","2+1","3+1","4+1","5+1"],        priceM2:35000 },
    { type:"Villa",  emoji:"🏡", sizes:["3+1","4+1","5+1","6+1"],              priceM2:55000 },
    { type:"Arsa",   emoji:"🌱", sizes:["200m²","500m²","1000m²","5000m²"],    priceM2:8000  },
    { type:"Dükkan", emoji:"🏪", sizes:["25m²","50m²","100m²","200m²"],        priceM2:45000 },
    { type:"Ofis",   emoji:"🏢", sizes:["50m²","100m²","250m²","500m²"],       priceM2:40000 },
    { type:"Depo",   emoji:"🏗️", sizes:["500m²","1000m²","5000m²"],            priceM2:15000 }
  ];

  const CITIES = ["İstanbul","Ankara","İzmir","Bursa","Antalya","Adana","Konya","Gaziantep","Kayseri","Mersin"];

  const PARTIES = [
    { id:"mkp", name:"Milli Kalkınma Partisi", ideology:"Milliyetçi-Muhafazakâr",color:"#c8102e",support:35,emoji:"🦅" },
    { id:"chp", name:"Cumhuriyet Halk Partisi",ideology:"Sosyal Demokrat",       color:"#ff6600",support:28,emoji:"🔑" },
    { id:"dop", name:"Demokratik Özgürlük P.", ideology:"Liberal",               color:"#0066cc",support:15,emoji:"🕊️" },
    { id:"ytp", name:"Yeşil Türkiye Partisi",  ideology:"Çevreci",               color:"#00aa44",support:8, emoji:"🌿" },
    { id:"eap", name:"Emek ve Adalet Partisi", ideology:"Sol",                   color:"#cc0000",support:10,emoji:"✊" }
  ];

  const GOODS = [
    { id:"bugday",  name:"Buğday",    unit:"ton",   price:8500,   cat:"Tarım"    },
    { id:"domates", name:"Domates",   unit:"kg",    price:18,     cat:"Tarım"    },
    { id:"demir",   name:"Demir",     unit:"ton",   price:45000,  cat:"Metal"    },
    { id:"bakir",   name:"Bakır",     unit:"ton",   price:280000, cat:"Metal"    },
    { id:"altin",   name:"Altın",     unit:"gram",  price:2850,   cat:"Kıymetli" },
    { id:"gumus",   name:"Gümüş",     unit:"gram",  price:32,     cat:"Kıymetli" },
    { id:"komur",   name:"Kömür",     unit:"ton",   price:6200,   cat:"Enerji"   },
    { id:"petrol",  name:"Ham Petrol",unit:"varil", price:2850,   cat:"Enerji"   },
    { id:"cimento", name:"Çimento",   unit:"ton",   price:2200,   cat:"İnşaat"   },
    { id:"tekstil", name:"Tekstil",   unit:"kg",    price:450,    cat:"Sanayi"   }
  ];

  const SGK_TYPES = [
    { id:"4a", name:"SSK (İşçi)",              emoji:"👷", min:2500, desc:"Çalışan işçiler için" },
    { id:"4b", name:"Bağ-Kur (Esnaf/Serbest)", emoji:"🤝", min:3000, desc:"Serbest çalışanlar için" },
    { id:"4c", name:"Emekli Sandığı (Memur)",  emoji:"🏛️", min:3500, desc:"Devlet memurları için" }
  ];

  const FAQ = [
    { q:"Oyuna nasıl başlarım?",       a:"Kayıt olduktan sonra 50.000 TL başlangıç sermayesi verilir. Bankaya yatırabilir, hisse alabilir veya işletme kurabilirsiniz." },
    { q:"Elmas ne işe yarar?",         a:"Premium para birimi. Mağazadan satın alınır. Hız artırma ve özel içerikler için kullanılır." },
    { q:"Borsa nasıl çalışır?",        a:"BIST hisseleri simüle edilir. Fiyatlar her 30 saniyede güncellenir. %0.1 komisyon uygulanır." },
    { q:"Vergi ödeyecek miyim?",       a:"Evet. Gelirlerin %20'si vergi olarak kesilir. Vergi dairesinden beyanname de verebilirsiniz." },
    { q:"Fabrika nasıl kurarım?",      a:"Önce belediyeden İnşaat Ruhsatı alın, ardından Üretim menüsünden Fabrika seçin." },
    { q:"Kredi alabilir miyim?",       a:"Evet. Bankacılık → Kredi Başvurusu. Kredi notunuz ve banka şartları geçerlidir." },
    { q:"Seçimlere katılabilir miyim?",a:"Partiye üye olun, kampanya yaparak oy kazanın ve seçime aday olun." },
    { q:"Güvenliğim nasıl korunur?",   a:"Şifreniz Firebase Auth ile hash'lenerek saklanır. E-postanız şifrelenir. Düz metin saklanmaz." }
  ];

  const STORY = [
    { ch:1, title:"Mütevazı Başlangıç",  text:"Anadolu'nun kalbinde küçük bir şehirde doğdunuz. Elinizde sadece 50.000 TL ve büyük hayaller var. Amcanızdan miras kalan bu sermayeyle büyük bir imparatorluk kuracaksınız." },
    { ch:2, title:"İlk Adımlar",         text:"Şehrin çarşısında küçük bir dükkan kiraladınız. Yerel pazarınızı kuruyorsunuz. Belediye başkanı bile adınızı duymuş." },
    { ch:3, title:"Genişleme",           text:"İşler yolunda gidiyor. Bankadan kredi aldınız, fabrika kurdunuz. Borsa yatırımları meyvesini veriyor. Artık vergi ödüyorsunuz ve ekonomiye katkı sağlıyorsunuz." },
    { ch:4, title:"Güç ve Siyaset",      text:"Servetiniz büyüdükçe siyasi çevreler de ilgilenmeye başladı. Partiye katılma teklifi geldi. Belediye meclisinde mi yer alacaksınız?" }
  ];

  const ELMAS_PACKAGES = [
    { id:"ep1", elmas:100,  price:"₺99",   bonus:0,    popular:false },
    { id:"ep2", elmas:500,  price:"₺399",  bonus:50,   popular:false },
    { id:"ep3", elmas:1200, price:"₺799",  bonus:200,  popular:true  },
    { id:"ep4", elmas:2500, price:"₺1499", bonus:500,  popular:false },
    { id:"ep5", elmas:5000, price:"₺2499", bonus:1500, popular:false }
  ];

  const NEWS_TEMPLATES = [
    "📈 Borsa günü %{v} artışla kapattı! {sym} öncü oldu.",
    "📉 Dolar kuru {rate} TL'ye yükseldi, piyasalar tedirgin.",
    "🏭 {name} yeni yatırım planını açıkladı.",
    "🏛️ Merkez Bankası politika faizini {baz} baz puan artırdı.",
    "⚡ Enerji fiyatları %{v} geriledi.",
    "🚀 Kripto piyasası hareketlendi! BTC %{v} değer kazandı.",
    "🌾 Tarım ürünleri fiyatları mevsimsel baskıyla yükseliyor.",
    "🏗️ Konut satışları geçen aya göre %{v} arttı.",
    "🔴 {sym} beklenmedik zarar açıkladı.",
    "💰 Hazine {amount} milyar TL iç borçlanma ihraç etti."
  ];

  const PERMIT_TYPES = ["İşyeri Açma Ruhsatı","İnşaat Ruhsatı","Tadilat İzni","Reklam Tabelası İzni","Açık Alan Kullanım İzni","Çevre Temizlik İzni"];
  const PERMIT_FEES  = { "İşyeri Açma Ruhsatı":3500, "İnşaat Ruhsatı":15000, "Tadilat İzni":2000, "Reklam Tabelası İzni":1200, "Açık Alan Kullanım İzni":800, "Çevre Temizlik İzni":500 };

  const NOTARY_TYPES = ["Satış Sözleşmesi","Kira Sözleşmesi","Vekaletname","Vasiyetname","Şirket Kuruluşu","Kat Mülkiyeti","Borç Senedi","Taahhütname"];
  const NOTARY_FEES  = { "Satış Sözleşmesi":2500,"Kira Sözleşmesi":800,"Vekaletname":600,"Vasiyetname":1200,"Şirket Kuruluşu":5000,"Kat Mülkiyeti":3500,"Borç Senedi":400,"Taahhütname":300 };

  const TENDERS = [
    { id:"t1", name:"Yol Yapım İhalesi",  type:"İnşaat",   minBid:500000,  value:1200000  },
    { id:"t2", name:"Okul Renovasyonu",   type:"İnşaat",   minBid:200000,  value:450000   },
    { id:"t3", name:"Gıda Tedariki",      type:"Gıda",     minBid:100000,  value:280000   },
    { id:"t4", name:"Enerji Santrali",    type:"Enerji",   minBid:5000000, value:12000000 },
    { id:"t5", name:"Hastane Tedariki",   type:"Sağlık",   minBid:800000,  value:2500000  },
    { id:"t6", name:"Teknoloji Altyapısı",type:"Teknoloji",minBid:2000000, value:5500000  }
  ];

  const BLACK_MARKET = [
    { id:"bm1", name:"Kaçak Elektronik",   price:15000,  profitMult:1.8, riskRate:0.25 },
    { id:"bm2", name:"Gümrüksüz İthalat",  price:50000,  profitMult:1.6, riskRate:0.30 },
    { id:"bm3", name:"Döviz Spekülasyon",  price:100000, profitMult:1.4, riskRate:0.20 },
    { id:"bm4", name:"İzinsiz Maden",      price:200000, profitMult:2.0, riskRate:0.40 },
    { id:"bm5", name:"Kaçak Tütün",        price:8000,   profitMult:2.2, riskRate:0.35 }
  ];

  const RE_SIZE_M2 = { "1+1":55,"2+1":85,"3+1":120,"4+1":160,"5+1":200,"6+1":250 };

  return {
    CONFIG, BANKS, STOCKS, CRYPTOS, FUNDS, INSURANCES, PRODUCTION, SHOPS,
    REAL_ESTATE, CITIES, PARTIES, GOODS, SGK_TYPES, FAQ, STORY,
    ELMAS_PACKAGES, NEWS_TEMPLATES, PERMIT_TYPES, PERMIT_FEES,
    NOTARY_TYPES, NOTARY_FEES, TENDERS, BLACK_MARKET, RE_SIZE_M2
  };
})();
