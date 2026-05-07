// ============================================================
// TÜRK İMPARATORLUĞU — dukkan.js
// 81 İl | 25 Dükkan Türü | Her birinde 20-30 Ürün
// ============================================================
"use strict";

var DUKKAN = (function () {

  // ════ 81 İL ════
  var ILLER = [
    {plaka:1, ad:"Adana",          bolge:"Akdeniz",    nufus:2258718,  zenginlik:3},
    {plaka:2, ad:"Adıyaman",       bolge:"Güneydoğu",  nufus:634365,   zenginlik:1},
    {plaka:3, ad:"Afyonkarahisar", bolge:"Ege",        nufus:742251,   zenginlik:2},
    {plaka:4, ad:"Ağrı",           bolge:"Doğu",       nufus:508588,   zenginlik:1},
    {plaka:5, ad:"Amasya",         bolge:"Karadeniz",  nufus:337160,   zenginlik:2},
    {plaka:6, ad:"Ankara",         bolge:"İç Anadolu", nufus:5782285,  zenginlik:5},
    {plaka:7, ad:"Antalya",        bolge:"Akdeniz",    nufus:2688004,  zenginlik:5},
    {plaka:8, ad:"Artvin",         bolge:"Karadeniz",  nufus:169543,   zenginlik:2},
    {plaka:9, ad:"Aydın",          bolge:"Ege",        nufus:1148241,  zenginlik:3},
    {plaka:10,ad:"Balıkesir",      bolge:"Marmara",    nufus:1257590,  zenginlik:3},
    {plaka:11,ad:"Bilecik",        bolge:"Marmara",    nufus:237194,   zenginlik:2},
    {plaka:12,ad:"Bingöl",         bolge:"Doğu",       nufus:277212,   zenginlik:1},
    {plaka:13,ad:"Bitlis",         bolge:"Doğu",       nufus:341065,   zenginlik:1},
    {plaka:14,ad:"Bolu",           bolge:"Karadeniz",  nufus:322098,   zenginlik:3},
    {plaka:15,ad:"Burdur",         bolge:"Akdeniz",    nufus:280969,   zenginlik:2},
    {plaka:16,ad:"Bursa",          bolge:"Marmara",    nufus:3147818,  zenginlik:5},
    {plaka:17,ad:"Çanakkale",      bolge:"Marmara",    nufus:578524,   zenginlik:3},
    {plaka:18,ad:"Çankırı",        bolge:"İç Anadolu", nufus:196515,   zenginlik:2},
    {plaka:19,ad:"Çorum",          bolge:"Karadeniz",  nufus:521882,   zenginlik:2},
    {plaka:20,ad:"Denizli",        bolge:"Ege",        nufus:1059684,  zenginlik:4},
    {plaka:21,ad:"Diyarbakır",     bolge:"Güneydoğu",  nufus:1804880,  zenginlik:2},
    {plaka:22,ad:"Edirne",         bolge:"Marmara",    nufus:421099,   zenginlik:3},
    {plaka:23,ad:"Elazığ",         bolge:"Doğu",       nufus:595170,   zenginlik:2},
    {plaka:24,ad:"Erzincan",       bolge:"Doğu",       nufus:232781,   zenginlik:2},
    {plaka:25,ad:"Erzurum",        bolge:"Doğu",       nufus:749754,   zenginlik:2},
    {plaka:26,ad:"Eskişehir",      bolge:"İç Anadolu", nufus:906541,   zenginlik:4},
    {plaka:27,ad:"Gaziantep",      bolge:"Güneydoğu",  nufus:2154051,  zenginlik:4},
    {plaka:28,ad:"Giresun",        bolge:"Karadeniz",  nufus:446388,   zenginlik:2},
    {plaka:29,ad:"Gümüşhane",      bolge:"Karadeniz",  nufus:163423,   zenginlik:1},
    {plaka:30,ad:"Hakkari",        bolge:"Doğu",       nufus:285373,   zenginlik:1},
    {plaka:31,ad:"Hatay",          bolge:"Akdeniz",    nufus:1686043,  zenginlik:3},
    {plaka:32,ad:"Isparta",        bolge:"Akdeniz",    nufus:446258,   zenginlik:2},
    {plaka:33,ad:"Mersin",         bolge:"Akdeniz",    nufus:1916432,  zenginlik:4},
    {plaka:34,ad:"İstanbul",       bolge:"Marmara",    nufus:15840900, zenginlik:5},
    {plaka:35,ad:"İzmir",          bolge:"Ege",        nufus:4425789,  zenginlik:5},
    {plaka:36,ad:"Kars",           bolge:"Doğu",       nufus:286891,   zenginlik:1},
    {plaka:37,ad:"Kastamonu",      bolge:"Karadeniz",  nufus:376202,   zenginlik:2},
    {plaka:38,ad:"Kayseri",        bolge:"İç Anadolu", nufus:1441523,  zenginlik:4},
    {plaka:39,ad:"Kırklareli",     bolge:"Marmara",    nufus:371414,   zenginlik:3},
    {plaka:40,ad:"Kırşehir",       bolge:"İç Anadolu", nufus:241852,   zenginlik:2},
    {plaka:41,ad:"Kocaeli",        bolge:"Marmara",    nufus:2079072,  zenginlik:5},
    {plaka:42,ad:"Konya",          bolge:"İç Anadolu", nufus:2277017,  zenginlik:4},
    {plaka:43,ad:"Kütahya",        bolge:"Ege",        nufus:567253,   zenginlik:2},
    {plaka:44,ad:"Malatya",        bolge:"Doğu",       nufus:812580,   zenginlik:3},
    {plaka:45,ad:"Manisa",         bolge:"Ege",        nufus:1474669,  zenginlik:4},
    {plaka:46,ad:"Kahramanmaraş",  bolge:"Akdeniz",    nufus:1175330,  zenginlik:3},
    {plaka:47,ad:"Mardin",         bolge:"Güneydoğu",  nufus:853826,   zenginlik:2},
    {plaka:48,ad:"Muğla",          bolge:"Ege",        nufus:1040118,  zenginlik:5},
    {plaka:49,ad:"Muş",            bolge:"Doğu",       nufus:408542,   zenginlik:1},
    {plaka:50,ad:"Nevşehir",       bolge:"İç Anadolu", nufus:307528,   zenginlik:3},
    {plaka:51,ad:"Niğde",          bolge:"İç Anadolu", nufus:370198,   zenginlik:2},
    {plaka:52,ad:"Ordu",           bolge:"Karadeniz",  nufus:748482,   zenginlik:2},
    {plaka:53,ad:"Rize",           bolge:"Karadeniz",  nufus:346754,   zenginlik:3},
    {plaka:54,ad:"Sakarya",        bolge:"Marmara",    nufus:1086956,  zenginlik:4},
    {plaka:55,ad:"Samsun",         bolge:"Karadeniz",  nufus:1372877,  zenginlik:4},
    {plaka:56,ad:"Siirt",          bolge:"Güneydoğu",  nufus:327630,   zenginlik:1},
    {plaka:57,ad:"Sinop",          bolge:"Karadeniz",  nufus:220341,   zenginlik:2},
    {plaka:58,ad:"Sivas",          bolge:"İç Anadolu", nufus:621224,   zenginlik:2},
    {plaka:59,ad:"Tekirdağ",       bolge:"Marmara",    nufus:1102247,  zenginlik:4},
    {plaka:60,ad:"Tokat",          bolge:"Karadeniz",  nufus:597296,   zenginlik:2},
    {plaka:61,ad:"Trabzon",        bolge:"Karadeniz",  nufus:814468,   zenginlik:3},
    {plaka:62,ad:"Tunceli",        bolge:"Doğu",       nufus:82180,    zenginlik:1},
    {plaka:63,ad:"Şanlıurfa",      bolge:"Güneydoğu",  nufus:2143326,  zenginlik:2},
    {plaka:64,ad:"Uşak",           bolge:"Ege",        nufus:370519,   zenginlik:2},
    {plaka:65,ad:"Van",            bolge:"Doğu",       nufus:1136371,  zenginlik:2},
    {plaka:66,ad:"Yozgat",         bolge:"İç Anadolu", nufus:415247,   zenginlik:1},
    {plaka:67,ad:"Zonguldak",      bolge:"Karadeniz",  nufus:597506,   zenginlik:3},
    {plaka:68,ad:"Aksaray",        bolge:"İç Anadolu", nufus:426787,   zenginlik:2},
    {plaka:69,ad:"Bayburt",        bolge:"Karadeniz",  nufus:84833,    zenginlik:1},
    {plaka:70,ad:"Karaman",        bolge:"İç Anadolu", nufus:259679,   zenginlik:2},
    {plaka:71,ad:"Kırıkkale",      bolge:"İç Anadolu", nufus:282439,   zenginlik:2},
    {plaka:72,ad:"Batman",         bolge:"Güneydoğu",  nufus:634205,   zenginlik:2},
    {plaka:73,ad:"Şırnak",         bolge:"Güneydoğu",  nufus:573745,   zenginlik:1},
    {plaka:74,ad:"Bartın",         bolge:"Karadeniz",  nufus:204980,   zenginlik:2},
    {plaka:75,ad:"Ardahan",        bolge:"Doğu",       nufus:97319,    zenginlik:1},
    {plaka:76,ad:"Iğdır",          bolge:"Doğu",       nufus:200190,   zenginlik:1},
    {plaka:77,ad:"Yalova",         bolge:"Marmara",    nufus:290793,   zenginlik:4},
    {plaka:78,ad:"Karabük",        bolge:"Karadeniz",  nufus:251424,   zenginlik:3},
    {plaka:79,ad:"Kilis",          bolge:"Güneydoğu",  nufus:145826,   zenginlik:2},
    {plaka:80,ad:"Osmaniye",       bolge:"Akdeniz",    nufus:558491,   zenginlik:2},
    {plaka:81,ad:"Düzce",          bolge:"Karadeniz",  nufus:406347,   zenginlik:3}
  ];

  // ════ 25 DÜKKAN TÜRÜ — HER BİRİNDE 20-30 ÜRÜN ════
  var DUKKAN_TURLERI = [

    // 1. FIRIN
    {id:"firin", ad:"Fırın", emoji:"🥖", acilis:25000, kategori:"gida",
     urunler:[
      {id:"ekmek",      ad:"Ekmek (somun)",        emoji:"🍞", m:2,    s:6,    sure:20,  max:1000},
      {id:"francala",   ad:"Francala",             emoji:"🥖", m:3,    s:8,    sure:20,  max:800 },
      {id:"simit",      ad:"Simit",                emoji:"🥯", m:3,    s:9,    sure:25,  max:600 },
      {id:"pogaca",     ad:"Poğaça (peynirli)",    emoji:"🥐", m:6,    s:18,   sure:40,  max:400 },
      {id:"acma",       ad:"Açma",                 emoji:"🧇", m:5,    s:15,   sure:35,  max:400 },
      {id:"borek",      ad:"Börek (tepsi)",         emoji:"🥧", m:30,   s:80,   sure:60,  max:100 },
      {id:"pide",       ad:"Ramazan Pidesi",       emoji:"🫓", m:10,   s:28,   sure:30,  max:300 },
      {id:"lahmacun",   ad:"Lahmacun",             emoji:"🫓", m:12,   s:35,   sure:25,  max:300 },
      {id:"kurabiye",   ad:"Kurabiye (kg)",         emoji:"🍪", m:35,   s:90,   sure:60,  max:100 },
      {id:"kek",        ad:"Kek (dilim)",           emoji:"🍰", m:15,   s:40,   sure:45,  max:200 },
      {id:"pasta",      ad:"Pasta (8 dilim)",       emoji:"🎂", m:80,   s:220,  sure:120, max:30  },
      {id:"baklava",    ad:"Baklava (kg)",          emoji:"🍯", m:120,  s:320,  sure:120, max:50  },
      {id:"sutlac",     ad:"Sütlaç (porsiyon)",     emoji:"🍮", m:12,   s:35,   sure:30,  max:200 },
      {id:"revani",     ad:"Revani (kg)",           emoji:"🟡", m:40,   s:100,  sure:60,  max:80  },
      {id:"lokma",      ad:"Lokma (kg)",            emoji:"🍩", m:20,   s:55,   sure:45,  max:150 },
      {id:"tulumba",    ad:"Tulumba (kg)",          emoji:"🍩", m:25,   s:65,   sure:50,  max:120 },
      {id:"croissant",  ad:"Kruvasan",             emoji:"🥐", m:10,   s:28,   sure:35,  max:200 },
      {id:"sandvic",    ad:"Sandviç (hazır)",       emoji:"🥪", m:20,   s:55,   sure:15,  max:200 },
      {id:"tost",       ad:"Tost (hazır)",          emoji:"🫕", m:15,   s:40,   sure:10,  max:300 },
      {id:"muffin",     ad:"Muffin (6lı)",          emoji:"🧁", m:30,   s:80,   sure:45,  max:150 },
      {id:"galeta",     ad:"Galeta Unu (kg)",       emoji:"🍘", m:15,   s:38,   sure:60,  max:100 },
      {id:"krep",       ad:"Krep (porsiyon)",       emoji:"🥞", m:12,   s:32,   sure:15,  max:200 }
    ]},

    // 2. MARKET
    {id:"market", ad:"Market", emoji:"🛒", acilis:80000, kategori:"gida",
     urunler:[
      {id:"domates",    ad:"Domates (kg)",          emoji:"🍅", m:8,    s:20,   sure:60,  max:2000},
      {id:"sogan",      ad:"Soğan (kg)",            emoji:"🧅", m:5,    s:12,   sure:60,  max:2000},
      {id:"patates",    ad:"Patates (kg)",          emoji:"🥔", m:6,    s:15,   sure:60,  max:2000},
      {id:"biber",      ad:"Biber (kg)",            emoji:"🫑", m:10,   s:25,   sure:60,  max:1000},
      {id:"patlican",   ad:"Patlıcan (kg)",         emoji:"🍆", m:9,    s:22,   sure:60,  max:1000},
      {id:"salatalik",  ad:"Salatalık (kg)",        emoji:"🥒", m:7,    s:18,   sure:60,  max:1000},
      {id:"sut",        ad:"Süt (lt)",              emoji:"🥛", m:12,   s:30,   sure:60,  max:1000},
      {id:"yogurt",     ad:"Yoğurt (kg)",           emoji:"🥛", m:20,   s:48,   sure:60,  max:500 },
      {id:"peynir",     ad:"Beyaz Peynir (kg)",     emoji:"🧀", m:80,   s:190,  sure:120, max:200 },
      {id:"kasar",      ad:"Kaşar Peynir (kg)",     emoji:"🧀", m:100,  s:240,  sure:120, max:150 },
      {id:"yumurta",    ad:"Yumurta (30lu)",        emoji:"🥚", m:60,   s:130,  sure:60,  max:400 },
      {id:"tavuk",      ad:"Tavuk (kg)",            emoji:"🍗", m:90,   s:210,  sure:90,  max:300 },
      {id:"makarna",    ad:"Makarna (500g)",        emoji:"🍝", m:15,   s:38,   sure:30,  max:800 },
      {id:"pirinc",     ad:"Pirinç (kg)",           emoji:"🍚", m:25,   s:58,   sure:30,  max:500 },
      {id:"seker",      ad:"Şeker (kg)",            emoji:"🍬", m:22,   s:50,   sure:30,  max:500 },
      {id:"un",         ad:"Un (kg)",               emoji:"🌾", m:15,   s:35,   sure:30,  max:800 },
      {id:"zeytinyagi", ad:"Zeytinyağı (lt)",       emoji:"🫙", m:150,  s:340,  sure:60,  max:150 },
      {id:"aycicekYagi",ad:"Ayçiçek Yağı (lt)",    emoji:"🫙", m:60,   s:140,  sure:60,  max:300 },
      {id:"cay",        ad:"Çay (500g)",            emoji:"🍵", m:50,   s:120,  sure:30,  max:300 },
      {id:"kahve",      ad:"Türk Kahvesi (250g)",   emoji:"☕", m:60,   s:145,  sure:30,  max:200 },
      {id:"konserve",   ad:"Konserve (domates)",    emoji:"🥫", m:15,   s:38,   sure:30,  max:500 },
      {id:"deterjan",   ad:"Deterjan (kg)",         emoji:"🧺", m:40,   s:95,   sure:30,  max:300 },
      {id:"sampuan",    ad:"Şampuan (400ml)",       emoji:"🧴", m:35,   s:85,   sure:30,  max:300 },
      {id:"tuvalet_k",  ad:"Tuvalet Kağıdı (12li)",emoji:"🧻", m:45,   s:105,  sure:30,  max:400 },
      {id:"firca",      ad:"Diş Fırçası",           emoji:"🪥", m:15,   s:38,   sure:30,  max:300 }
    ]},

    // 3. TELEFON & TEKNOLOJİ
    {id:"telefon", ad:"Telefon & Teknoloji", emoji:"📱", acilis:250000, kategori:"elektronik",
     urunler:[
      {id:"ucuztel",    ad:"Ucuz Telefon",          emoji:"📱", m:2000,  s:4500,  sure:480, max:100},
      {id:"ortatel",    ad:"Orta Segment Telefon",  emoji:"📲", m:7000,  s:14000, sure:480, max:80 },
      {id:"iphonese",   ad:"iPhone SE",             emoji:"🍎", m:18000, s:33000, sure:480, max:30 },
      {id:"iphone14",   ad:"iPhone 14",             emoji:"🍎", m:36000, s:62000, sure:480, max:20 },
      {id:"iphone15",   ad:"iPhone 15 Pro",         emoji:"🍎", m:52000, s:85000, sure:480, max:10 },
      {id:"samsung_a",  ad:"Samsung Galaxy A",      emoji:"📱", m:8000,  s:16000, sure:480, max:50 },
      {id:"samsung_s",  ad:"Samsung Galaxy S24",    emoji:"📱", m:38000, s:65000, sure:480, max:20 },
      {id:"xiaomi",     ad:"Xiaomi Poco X6",        emoji:"📱", m:9000,  s:18000, sure:480, max:40 },
      {id:"ipad",       ad:"iPad (9. nesil)",       emoji:"📟", m:14000, s:26000, sure:480, max:25 },
      {id:"macbook",    ad:"MacBook Air M2",        emoji:"💻", m:55000, s:90000, sure:480, max:10 },
      {id:"laptop",     ad:"Laptop (i5 16GB)",      emoji:"💻", m:25000, s:42000, sure:480, max:20 },
      {id:"watch",      ad:"Apple Watch",           emoji:"⌚", m:12000, s:22000, sure:480, max:30 },
      {id:"samsung_w",  ad:"Samsung Watch",         emoji:"⌚", m:8000,  s:15000, sure:480, max:30 },
      {id:"airpods",    ad:"AirPods Pro",           emoji:"🎧", m:4500,  s:8500,  sure:240, max:50 },
      {id:"kulaklik",   ad:"Sony Kulaklık",         emoji:"🎧", m:3000,  s:6000,  sure:240, max:50 },
      {id:"powerbank",  ad:"Powerbank 20000mAh",    emoji:"🔋", m:600,   s:1400,  sure:120, max:100},
      {id:"sarj",       ad:"Hızlı Şarj Aleti",     emoji:"🔌", m:300,   s:750,   sure:60,  max:150},
      {id:"kilif",      ad:"Telefon Kılıfı",        emoji:"📱", m:80,    s:220,   sure:30,  max:300},
      {id:"cam",        ad:"Ekran Koruyucu",        emoji:"🔲", m:50,    s:150,   sure:30,  max:300},
      {id:"kamera",     ad:"Fotoğraf Makinesi",     emoji:"📷", m:8000,  s:16000, sure:480, max:20 },
      {id:"drone",      ad:"Drone (mini)",          emoji:"🚁", m:5000,  s:10000, sure:480, max:15 },
      {id:"hoparlor",   ad:"Bluetooth Hoparlör",    emoji:"🔊", m:800,   s:1900,  sure:120, max:80 },
      {id:"klavye",     ad:"Mekanik Klavye",        emoji:"⌨️", m:1200,  s:2800,  sure:120, max:60 }
    ]},

    // 4. KUYUMCU
    {id:"kuyumcu", ad:"Kuyumcu", emoji:"💍", acilis:500000, kategori:"kiymetli",
     urunler:[
      {id:"ceyrek",     ad:"Çeyrek Altın",          emoji:"🪙", m:8500,  s:9300,  sure:180, max:200},
      {id:"yarim",      ad:"Yarım Altın",           emoji:"🪙", m:17000, s:18600, sure:180, max:100},
      {id:"tam",        ad:"Tam Altın",             emoji:"🥇", m:34000, s:37200, sure:180, max:50 },
      {id:"cumhuriyet", ad:"Cumhuriyet Altını",     emoji:"🥇", m:52000, s:57000, sure:180, max:30 },
      {id:"ata",        ad:"Ata Lirası",            emoji:"🪙", m:55000, s:61000, sure:180, max:20 },
      {id:"bilezik22",  ad:"22 Ayar Bilezik (gr)",  emoji:"💛", m:2600,  s:3200,  sure:360, max:50 },
      {id:"bilezik14",  ad:"14 Ayar Bilezik",       emoji:"💛", m:1800,  s:2400,  sure:360, max:60 },
      {id:"kolye",      ad:"Altın Kolye",           emoji:"📿", m:3000,  s:4500,  sure:360, max:40 },
      {id:"kupe",       ad:"Altın Küpe",            emoji:"✨", m:2000,  s:3200,  sure:240, max:60 },
      {id:"yuzuk_altin",ad:"Altın Yüzük",           emoji:"💍", m:2500,  s:4000,  sure:300, max:50 },
      {id:"pırlanta",   ad:"Pırlanta Yüzük",        emoji:"💎", m:15000, s:28000, sure:600, max:20 },
      {id:"zumrut",     ad:"Zümrüt Set",            emoji:"💚", m:8000,  s:16000, sure:600, max:15 },
      {id:"yakut",      ad:"Yakut Kolye",           emoji:"❤️", m:10000, s:20000, sure:600, max:10 },
      {id:"saat_altin", ad:"Altın Saat",            emoji:"⌚", m:20000, s:38000, sure:600, max:10 },
      {id:"gumus_set",  ad:"Gümüş Takı Seti",       emoji:"⚪", m:1500,  s:3800,  sure:180, max:80 },
      {id:"gumus_kolye",ad:"Gümüş Kolye",           emoji:"📿", m:800,   s:2200,  sure:120, max:100},
      {id:"platin",     ad:"Platin Yüzük",          emoji:"⬜", m:5000,  s:11000, sure:480, max:20 },
      {id:"inverter",   ad:"Gram Altın Sertifikası",emoji:"📜", m:3400,  s:3600,  sure:60,  max:100},
      {id:"sikke",      ad:"Osmanlı Sikkesi",       emoji:"🪙", m:5000,  s:12000, sure:240, max:30 },
      {id:"antika_s",   ad:"Antika Saat",           emoji:"🕰️", m:3000,  s:8000,  sure:480, max:15 }
    ]},

    // 5. ECZANE
    {id:"eczane", ad:"Eczane", emoji:"💊", acilis:150000, kategori:"saglik",
     urunler:[
      {id:"agrikesici",  ad:"Ağrı Kesici (20li)",    emoji:"💊", m:15,   s:35,   sure:30,  max:500},
      {id:"atespdusurucu",ad:"Ateş Düşürücü",        emoji:"🌡️", m:20,   s:48,   sure:30,  max:400},
      {id:"antibiyotik", ad:"Antibiyotik (reçeteli)",emoji:"💊", m:50,   s:95,   sure:60,  max:200},
      {id:"vitamin_c",   ad:"Vitamin C (30lu)",      emoji:"🍊", m:30,   s:75,   sure:30,  max:300},
      {id:"vitamin_d",   ad:"Vitamin D3",            emoji:"☀️", m:40,   s:95,   sure:30,  max:300},
      {id:"magnezyum",   ad:"Magnezyum",             emoji:"💊", m:35,   s:85,   sure:30,  max:300},
      {id:"probiyotik",  ad:"Probiyotik",            emoji:"🦠", m:80,   s:185,  sure:60,  max:150},
      {id:"omega3",      ad:"Omega 3 (60lı)",        emoji:"🐟", m:90,   s:210,  sure:60,  max:150},
      {id:"kolajen",     ad:"Kolajen Takviyesi",     emoji:"✨", m:120,  s:280,  sure:60,  max:100},
      {id:"protein_t",   ad:"Protein Tozu (1kg)",    emoji:"💪", m:400,  s:950,  sure:120, max:50 },
      {id:"kreatin",     ad:"Kreatin (300g)",        emoji:"💊", m:200,  s:480,  sure:90,  max:80 },
      {id:"bvitamin",    ad:"B Vitamini Kompleks",   emoji:"💊", m:45,   s:108,  sure:30,  max:200},
      {id:"demir",       ad:"Demir Takviyesi",       emoji:"💊", m:35,   s:82,   sure:30,  max:200},
      {id:"kolonya",     ad:"Kolonya (lt)",          emoji:"🧴", m:80,   s:190,  sure:60,  max:150},
      {id:"el_des",      ad:"El Dezenfektanı (lt)",  emoji:"🧴", m:40,   s:95,   sure:30,  max:300},
      {id:"maske_50",    ad:"Maske (50li)",          emoji:"😷", m:50,   s:120,  sure:30,  max:200},
      {id:"kan_olc",     ad:"Kan Ölçer",            emoji:"🩺", m:500,  s:1200, sure:240, max:30 },
      {id:"tansiyon",    ad:"Tansiyon Aleti",        emoji:"🩺", m:800,  s:1900, sure:240, max:20 },
      {id:"bandaj",      ad:"Steril Bandaj (10lu)",  emoji:"🩹", m:15,   s:38,   sure:30,  max:400},
      {id:"ates_olc",    ad:"Ateş Ölçer (dijital)", emoji:"🌡️", m:200,  s:480,  sure:120, max:60 },
      {id:"nebulizor",   ad:"Nebülizör",            emoji:"💨", m:600,  s:1400, sure:240, max:25 },
      {id:"saglik_kol",  ad:"Sağlık Kolyesi",       emoji:"📿", m:300,  s:750,  sure:120, max:50 }
    ]},

    // 6. GİYİM MAĞAZASI
    {id:"giyim", ad:"Giyim Mağazası", emoji:"👕", acilis:120000, kategori:"giyim",
     urunler:[
      {id:"tisort_e",   ad:"Erkek Tişört",          emoji:"👕", m:80,   s:220,  sure:90,  max:300},
      {id:"tisort_k",   ad:"Kadın Tişört",          emoji:"👚", m:90,   s:250,  sure:90,  max:300},
      {id:"pantolon_e", ad:"Erkek Kot Pantolon",    emoji:"👖", m:180,  s:480,  sure:120, max:200},
      {id:"pantolon_k", ad:"Kadın Pantolon",        emoji:"👖", m:160,  s:440,  sure:120, max:200},
      {id:"elbise",     ad:"Yazlık Elbise",         emoji:"👗", m:200,  s:580,  sure:150, max:150},
      {id:"takim",      ad:"Erkek Takım Elbise",    emoji:"🤵", m:800,  s:2200, sure:360, max:30 },
      {id:"kaban",      ad:"Kaban / Mont",          emoji:"🧥", m:400,  s:1100, sure:240, max:80 },
      {id:"trencot",    ad:"Trençkot",              emoji:"🧥", m:600,  s:1600, sure:240, max:50 },
      {id:"kazak",      ad:"Kazak / Sweatshirt",    emoji:"🧶", m:150,  s:400,  sure:120, max:200},
      {id:"gomlek",     ad:"Erkek Gömlek",          emoji:"👔", m:200,  s:550,  sure:120, max:150},
      {id:"spor_esofman",ad:"Eşofman Takımı",       emoji:"🏃", m:250,  s:680,  sure:150, max:150},
      {id:"sort",       ad:"Şort",                 emoji:"🩳", m:80,   s:220,  sure:60,  max:250},
      {id:"etek",       ad:"Etek",                  emoji:"👗", m:120,  s:340,  sure:90,  max:150},
      {id:"ic_giyim",   ad:"İç Giyim Seti",        emoji:"🩲", m:100,  s:270,  sure:60,  max:200},
      {id:"pijama",     ad:"Pijama Takımı",         emoji:"🛌", m:150,  s:400,  sure:90,  max:150},
      {id:"corap_6",    ad:"Çorap (6lı paket)",     emoji:"🧦", m:45,   s:110,  sure:30,  max:400},
      {id:"atlet",      ad:"Atlet (3lü)",           emoji:"👕", m:60,   s:155,  sure:30,  max:300},
      {id:"bere_elic",  ad:"Bere + Eldiven Set",    emoji:"🧤", m:80,   s:210,  sure:60,  max:200},
      {id:"sapka",      ad:"Şapka",                 emoji:"🧢", m:60,   s:165,  sure:60,  max:200},
      {id:"kravat",     ad:"Kravat",                emoji:"👔", m:100,  s:280,  sure:60,  max:100},
      {id:"kemer",      ad:"Deri Kemer",            emoji:"🪢", m:120,  s:320,  sure:90,  max:100},
      {id:"canta_bayan",ad:"Bayan Çantası",         emoji:"👜", m:300,  s:850,  sure:180, max:80 },
      {id:"sirt_canta", ad:"Sırt Çantası",         emoji:"🎒", m:200,  s:550,  sure:120, max:100}
    ]},

    // 7. AYAKKABICI
    {id:"ayakkabici", ad:"Ayakkabıcı", emoji:"👟", acilis:90000, kategori:"giyim",
     urunler:[
      {id:"spor_ayk",   ad:"Spor Ayakkabı (Nike)",  emoji:"👟", m:800,  s:2200, sure:180, max:100},
      {id:"yuruyus",    ad:"Yürüyüş Ayakkabısı",   emoji:"👟", m:600,  s:1600, sure:180, max:100},
      {id:"klasik_e",   ad:"Klasik Erkek Ayakkabı", emoji:"👞", m:500,  s:1400, sure:180, max:80 },
      {id:"topuklu",    ad:"Topuklu Ayakkabı",      emoji:"👠", m:400,  s:1100, sure:180, max:80 },
      {id:"sandalet",   ad:"Sandalet",              emoji:"👡", m:200,  s:550,  sure:120, max:150},
      {id:"terlik",     ad:"Ev Terliği",            emoji:"🩴", m:80,   s:210,  sure:60,  max:300},
      {id:"cizme",      ad:"Çizme (deri)",          emoji:"👢", m:600,  s:1600, sure:180, max:60 },
      {id:"bot",        ad:"Bot / Kışlık Ayakkabı", emoji:"🥾", m:500,  s:1350, sure:180, max:80 },
      {id:"cocuk_ayk",  ad:"Çocuk Spor Ayakkabı",  emoji:"👟", m:300,  s:800,  sure:120, max:150},
      {id:"bebek_ayk",  ad:"Bebek Ayakkabısı",     emoji:"🐾", m:150,  s:420,  sure:90,  max:200},
      {id:"sneaker",    ad:"Sneaker (Adidas)",      emoji:"👟", m:700,  s:1900, sure:180, max:80 },
      {id:"converse",   ad:"Converse Tarzı",        emoji:"👟", m:500,  s:1300, sure:180, max:100},
      {id:"takunya",    ad:"Crocs Tarzı",           emoji:"🪝", m:200,  s:550,  sure:90,  max:150},
      {id:"kaucuk_c",   ad:"Kauçuk Çizme",         emoji:"🌧️", m:250,  s:680,  sure:120, max:100},
      {id:"ayk_boyasi", ad:"Ayakkabı Boyası (set)", emoji:"🎨", m:80,   s:210,  sure:30,  max:200},
      {id:"tabanlık",   ad:"Ortopedik Tabanlık",    emoji:"🦶", m:100,  s:280,  sure:60,  max:200},
      {id:"babet",      ad:"Babet Ayakkabı",        emoji:"🩱", m:200,  s:560,  sure:120, max:150}
    ]},

    // 8. KASAP
    {id:"kasap", ad:"Kasap", emoji:"🥩", acilis:60000, kategori:"gida",
     urunler:[
      {id:"dana_kiyma",  ad:"Dana Kıyma (kg)",       emoji:"🥩", m:180,  s:380,  sure:90,  max:300},
      {id:"dana_antrik", ad:"Dana Antrikot (kg)",    emoji:"🥩", m:280,  s:580,  sure:120, max:150},
      {id:"dana_but",    ad:"Dana But (kg)",         emoji:"🥩", m:220,  s:460,  sure:120, max:200},
      {id:"kuzu_but",    ad:"Kuzu But (kg)",         emoji:"🍖", m:280,  s:580,  sure:150, max:150},
      {id:"kuzu_piz",    ad:"Kuzu Pirzola (kg)",     emoji:"🍖", m:320,  s:680,  sure:150, max:100},
      {id:"tavuk_but",   ad:"Tavuk But (kg)",        emoji:"🍗", m:80,   s:175,  sure:60,  max:400},
      {id:"tavuk_gogus", ad:"Tavuk Göğüs (kg)",     emoji:"🍗", m:90,   s:200,  sure:60,  max:400},
      {id:"sucuk",       ad:"Sucuk (kg)",            emoji:"🌭", m:120,  s:265,  sure:90,  max:200},
      {id:"salam",       ad:"Salam (kg)",            emoji:"🥓", m:90,   s:200,  sure:90,  max:200},
      {id:"pastirma",    ad:"Pastırma (kg)",         emoji:"🥩", m:200,  s:450,  sure:120, max:100},
      {id:"hindi",       ad:"Hindi (bütün)",         emoji:"🦃", m:350,  s:750,  sure:180, max:50 },
      {id:"balık_somon", ad:"Somon (kg)",            emoji:"🐟", m:200,  s:440,  sure:90,  max:150},
      {id:"balik_levrek",ad:"Levrek (kg)",           emoji:"🐠", m:150,  s:330,  sure:90,  max:150},
      {id:"midye",       ad:"Midye (kg)",            emoji:"🦪", m:60,   s:140,  sure:60,  max:200},
      {id:"karides",     ad:"Karides (kg)",          emoji:"🦐", m:180,  s:400,  sure:90,  max:100},
      {id:"kofte",       ad:"Köfte Malzeme (kg)",    emoji:"🫕", m:120,  s:265,  sure:60,  max:200},
      {id:"ciğer",       ad:"Dana Ciğer (kg)",      emoji:"🫀", m:80,   s:175,  sure:60,  max:150},
      {id:"beyaz_et",    ad:"Beyaz Peynirli Tavuk",  emoji:"🍗", m:100,  s:225,  sure:90,  max:200},
      {id:"sucuk_b",     ad:"Biberli Sucuk (kg)",    emoji:"🌶️", m:130,  s:290,  sure:90,  max:150},
      {id:"kavurma",     ad:"Kavurma (kg)",          emoji:"🥘", m:180,  s:400,  sure:120, max:100}
    ]},

    // 9. MOBİLYA
    {id:"mobilya", ad:"Mobilya Mağazası", emoji:"🪑", acilis:300000, kategori:"ev",
     urunler:[
      {id:"kose_koltuk", ad:"L Köşe Koltuk",        emoji:"🛋️", m:3000,  s:7800,  sure:480, max:20},
      {id:"ikili_koltuk",ad:"İkili Koltuk",          emoji:"🛋️", m:1500,  s:4200,  sure:360, max:30},
      {id:"berjer",      ad:"Berjer Koltuk",         emoji:"🪑", m:1200,  s:3500,  sure:360, max:30},
      {id:"yatak_cift",  ad:"Çift Kişilik Yatak",   emoji:"🛏️", m:4000,  s:9800,  sure:600, max:15},
      {id:"yatak_tek",   ad:"Tek Kişilik Yatak",    emoji:"🛏️", m:2000,  s:5200,  sure:480, max:20},
      {id:"bas_oda_tak", ad:"Yatak Odası Takımı",   emoji:"🪑", m:8000,  s:20000, sure:720, max:10},
      {id:"yemek_masa",  ad:"Yemek Masası (6 kişi)",emoji:"🪑", m:2500,  s:6500,  sure:480, max:15},
      {id:"kare_masa",   ad:"Kare Yemek Masası",    emoji:"🪑", m:1500,  s:4000,  sure:360, max:20},
      {id:"calisma_masa",ad:"Çalışma Masası",       emoji:"🖥️", m:800,   s:2200,  sure:240, max:30},
      {id:"ofis_sandalye",ad:"Ofis Sandalyesi",     emoji:"🪑", m:600,   s:1700,  sure:240, max:40},
      {id:"kitaplik",    ad:"Kitaplık",             emoji:"📚", m:600,   s:1700,  sure:300, max:30},
      {id:"gardrop",     ad:"Gardırop (3 kapı)",    emoji:"🚪", m:2000,  s:5500,  sure:480, max:15},
      {id:"tv_unitesi",  ad:"TV Ünitesi",           emoji:"📺", m:800,   s:2200,  sure:300, max:25},
      {id:"dekor_raf",   ad:"Dekoratif Raf",        emoji:"🪟", m:300,   s:850,   sure:180, max:50},
      {id:"banyo_tak",   ad:"Banyo Mobilya Takımı", emoji:"🚿", m:3000,  s:7500,  sure:600, max:10},
      {id:"hol_konsolü", ad:"Hol Konsolu",          emoji:"🪞", m:600,   s:1700,  sure:240, max:30},
      {id:"ayna",        ad:"Boy Aynası",           emoji:"🪞", m:400,   s:1100,  sure:180, max:40},
      {id:"cocuk_oda",   ad:"Çocuk Odası Takımı",  emoji:"🧸", m:4000,  s:10000, sure:720, max:10},
      {id:"bebek_b",     ad:"Bebek Beşiği",        emoji:"🍼", m:1200,  s:3200,  sure:360, max:15},
      {id:"mutfak_tak",  ad:"Mutfak Mobilyası (m²)",emoji:"🍳", m:1000,  s:2800,  sure:600, max:20}
    ]},

    // 10. BERBER / KUAFÖR
    {id:"berber", ad:"Berber / Kuaför", emoji:"💈", acilis:35000, kategori:"hizmet",
     urunler:[
      {id:"sac_kesim_e", ad:"Erkek Saç Kesimi",     emoji:"✂️", m:20,   s:80,   sure:20,  max:9999},
      {id:"sac_kesim_k", ad:"Kadın Saç Kesimi",     emoji:"✂️", m:40,   s:180,  sure:40,  max:9999},
      {id:"sac_boya_tek",ad:"Tek Renk Boyama",      emoji:"🎨", m:80,   s:350,  sure:90,  max:9999},
      {id:"sac_boya_ombr",ad:"Ombre Boyama",        emoji:"🌈", m:150,  s:650,  sure:150, max:9999},
      {id:"dipleme",     ad:"Dipleme (rötuş)",      emoji:"🎨", m:60,   s:250,  sure:60,  max:9999},
      {id:"fon_masin",   ad:"Fön Maşası",          emoji:"💨", m:30,   s:120,  sure:30,  max:9999},
      {id:"sac_duzlest", ad:"Saç Düzleştirme",     emoji:"✨", m:50,   s:200,  sure:60,  max:9999},
      {id:"perma",       ad:"Perma",                emoji:"🌀", m:100,  s:400,  sure:120, max:9999},
      {id:"keratin",     ad:"Keratin Bakım",        emoji:"💆", m:200,  s:800,  sure:180, max:9999},
      {id:"sakal",       ad:"Sakal Kesim+Şekil",   emoji:"🪒", m:15,   s:60,   sure:20,  max:9999},
      {id:"sakal_formalin",ad:"Sakal Bakım Seti",  emoji:"🧴", m:25,   s:100,  sure:30,  max:9999},
      {id:"manikur",     ad:"Manikür",              emoji:"💅", m:30,   s:130,  sure:45,  max:9999},
      {id:"pedikur",     ad:"Pedikür",              emoji:"🦶", m:40,   s:160,  sure:60,  max:9999},
      {id:"kakilma",     ad:"Kaş Alımı",           emoji:"🪮", m:15,   s:60,   sure:15,  max:9999},
      {id:"ipek_kirpik", ad:"İpek Kirpik",          emoji:"👁️", m:80,   s:350,  sure:90,  max:9999},
      {id:"kalici_oje",  ad:"Kalıcı Oje",          emoji:"💅", m:50,   s:200,  sure:60,  max:9999},
      {id:"gelin_paketi",ad:"Gelin Saç+Makyaj",    emoji:"👰", m:300,  s:1500, sure:240, max:9999},
      {id:"cocuk_kesim", ad:"Çocuk Saç Kesimi",    emoji:"✂️", m:15,   s:60,   sure:15,  max:9999},
      {id:"masaj_kafa",  ad:"Kafa Masajı",         emoji:"🧖", m:20,   s:80,   sure:20,  max:9999},
      {id:"yuz_bakimi",  ad:"Yüz Bakımı",          emoji:"🧴", m:60,   s:250,  sure:60,  max:9999}
    ]},

    // 11. AKARYAKIT İSTASYONU
    {id:"akaryakit", ad:"Akaryakıt İstasyonu", emoji:"⛽", acilis:1000000, kategori:"enerji",
     urunler:[
      {id:"benzin95",   ad:"95 Oktan Benzin (lt)",  emoji:"⛽", m:28,   s:43,   sure:15,  max:100000},
      {id:"benzin97",   ad:"97 Oktan Premium (lt)",  emoji:"⛽", m:30,   s:47,   sure:15,  max:50000 },
      {id:"motorin",    ad:"Motorin (lt)",           emoji:"🛢️", m:26,   s:40,   sure:15,  max:100000},
      {id:"lpg",        ad:"LPG Otogaz (lt)",       emoji:"🔵", m:12,   s:19,   sure:15,  max:80000 },
      {id:"yikama_dis", ad:"Dış Yıkama",            emoji:"🚗", m:40,   s:150,  sure:15,  max:9999  },
      {id:"yikama_ic",  ad:"İç+Dış Temizlik",      emoji:"🧹", m:80,   s:300,  sure:30,  max:9999  },
      {id:"lastik_p",   ad:"Lastik Şişirme",        emoji:"🔧", m:5,    s:20,   sure:5,   max:9999  },
      {id:"motor_yagi", ad:"Motor Yağı Değişimi",   emoji:"🛠️", m:300,  s:800,  sure:30,  max:9999  },
      {id:"antifriz",   ad:"Antifriz (lt)",         emoji:"🧊", m:30,   s:75,   sure:15,  max:1000  },
      {id:"cam_suyu",   ad:"Cam Suyu (lt)",         emoji:"💧", m:20,   s:50,   sure:15,  max:1000  },
      {id:"market_gida",ad:"Market Gıda",           emoji:"🛒", m:15,   s:40,   sure:15,  max:9999  },
      {id:"sigara",     ad:"Sigara (paket)",        emoji:"🚬", m:25,   s:58,   sure:15,  max:5000  },
      {id:"kahve_kapsul",ad:"Kapsül Kahve Makinesi",emoji:"☕", m:30,   s:75,   sure:15,  max:9999  }
    ]},

    // 12. RESTORAN
    {id:"restoran", ad:"Restoran", emoji:"🍽️", acilis:200000, kategori:"gida",
     urunler:[
      {id:"adana_keb",  ad:"Adana Kebap",           emoji:"🍢", m:60,   s:185,  sure:20,  max:9999},
      {id:"urfa_keb",   ad:"Urfa Kebap",            emoji:"🍢", m:55,   s:170,  sure:20,  max:9999},
      {id:"iskender",   ad:"İskender Kebap",        emoji:"🍽️", m:80,   s:250,  sure:25,  max:9999},
      {id:"kofte",      ad:"Izgara Köfte",          emoji:"🍖", m:45,   s:140,  sure:20,  max:9999},
      {id:"pide_kasarl",ad:"Kaşarlı Pide",          emoji:"🫓", m:35,   s:110,  sure:15,  max:9999},
      {id:"lahmacun_r", ad:"Lahmacun + Ayran",     emoji:"🫓", m:25,   s:80,   sure:15,  max:9999},
      {id:"meze",       ad:"Meze Tabağı",           emoji:"🫕", m:40,   s:130,  sure:15,  max:9999},
      {id:"balik_tab",  ad:"Izgara Balık Tabağı",  emoji:"🐟", m:90,   s:280,  sure:30,  max:9999},
      {id:"mantı",      ad:"Mantı",                emoji:"🥟", m:30,   s:95,   sure:20,  max:9999},
      {id:"mercimek",   ad:"Mercimek Çorbası",     emoji:"🥣", m:10,   s:35,   sure:10,  max:9999},
      {id:"tarhana",    ad:"Tarhana Çorbası",      emoji:"🥣", m:12,   s:38,   sure:10,  max:9999},
      {id:"dolma",      ad:"Yaprak Dolma",         emoji:"🫑", m:25,   s:80,   sure:20,  max:9999},
      {id:"borek_r",    ad:"Börek",                emoji:"🥧", m:20,   s:65,   sure:15,  max:9999},
      {id:"tatli_baklava",ad:"Baklava (porsiyon)", emoji:"🍯", m:25,   s:80,   sure:10,  max:9999},
      {id:"kazandibi",  ad:"Kazandibi",            emoji:"🍮", m:15,   s:50,   sure:10,  max:9999},
      {id:"asure",      ad:"Aşure",                emoji:"🍲", m:12,   s:40,   sure:10,  max:9999},
      {id:"cay_r",      ad:"Çay",                  emoji:"🍵", m:3,    s:15,   sure:5,   max:9999},
      {id:"ayran",      ad:"Ayran (büyük)",        emoji:"🥛", m:5,    s:20,   sure:5,   max:9999},
      {id:"kola",       ad:"Kola (büyük)",         emoji:"🥤", m:8,    s:30,   sure:5,   max:9999},
      {id:"nargile",    ad:"Nargile",              emoji:"💨", m:50,   s:200,  sure:60,  max:9999},
      {id:"kahvalti",   ad:"Serpme Kahvaltı",      emoji:"🍳", m:80,   s:250,  sure:30,  max:9999},
      {id:"dugun_yemek",ad:"Düğün Yemeği (kişi)",  emoji:"🎊", m:80,   s:250,  sure:60,  max:9999}
    ]},

    // 13. KİTABEVİ
    {id:"kitabevi", ad:"Kitabevi & Kırtasiye", emoji:"📚", acilis:45000, kategori:"egitim",
     urunler:[
      {id:"roman",      ad:"Roman",                 emoji:"📖", m:30,   s:80,   sure:30,  max:500},
      {id:"hikaye",     ad:"Hikaye Kitabı",         emoji:"📕", m:20,   s:55,   sure:30,  max:500},
      {id:"tarih",      ad:"Tarih Kitabı",          emoji:"📗", m:40,   s:105,  sure:30,  max:300},
      {id:"ders_kit",   ad:"Ders Kitabı",           emoji:"📘", m:50,   s:130,  sure:30,  max:400},
      {id:"soru_bank",  ad:"Soru Bankası",          emoji:"📙", m:60,   s:155,  sure:30,  max:300},
      {id:"ansiklop",   ad:"Ansiklopedi",           emoji:"📚", m:80,   s:210,  sure:60,  max:100},
      {id:"atlas",      ad:"Dünya Atlası",          emoji:"🌍", m:70,   s:180,  sure:60,  max:100},
      {id:"defter_kol", ad:"Kolej Defter (5li)",   emoji:"📓", m:30,   s:80,   sure:20,  max:500},
      {id:"defter_spi", ad:"Spiralli Defter",       emoji:"📒", m:15,   s:40,   sure:20,  max:500},
      {id:"kalem",      ad:"Kalem Seti (12li)",    emoji:"✏️", m:15,   s:40,   sure:15,  max:600},
      {id:"tukenmez",   ad:"Tükenmez Kalem (10lu)",emoji:"🖊️", m:20,   s:52,   sure:15,  max:500},
      {id:"boya_seti",  ad:"Boya Kalemi Seti",     emoji:"🎨", m:60,   s:155,  sure:30,  max:200},
      {id:"cetvel_set", ad:"Cetvel + Gönye Seti",  emoji:"📐", m:25,   s:65,   sure:20,  max:300},
      {id:"silgi",      ad:"Silgi (5li paket)",    emoji:"⬜", m:10,   s:28,   sure:10,  max:500},
      {id:"dosya",      ad:"Dosya (10lu)",         emoji:"🗂️", m:25,   s:65,   sure:20,  max:300},
      {id:"oyuncak_eg", ad:"Eğitici Oyuncak",      emoji:"🧸", m:100,  s:280,  sure:60,  max:100},
      {id:"puzzle",     ad:"Yapboz (500 parça)",   emoji:"🧩", m:80,   s:210,  sure:60,  max:100},
      {id:"fen_kit",    ad:"Deney Seti",           emoji:"🔬", m:150,  s:400,  sure:90,  max:50 },
      {id:"harita",     ad:"Türkiye Haritası",     emoji:"🗺️", m:30,   s:80,   sure:30,  max:200},
      {id:"hesap_mak",  ad:"Bilimsel Hesap Mak.",  emoji:"🔢", m:150,  s:380,  sure:60,  max:100},
      {id:"harfli_tahta",ad:"Manyetik Harf Tahta", emoji:"🔤", m:80,   s:210,  sure:60,  max:100}
    ]},

    // 14. ELEKTRONİK BEYAZ EŞYA
    {id:"beyaz_esya", ad:"Beyaz Eşya Mağazası", emoji:"🏠", acilis:400000, kategori:"elektronik",
     urunler:[
      {id:"buzdolabi",  ad:"No-Frost Buzdolabı",   emoji:"🧊", m:8000,  s:18000, sure:600, max:20},
      {id:"bulasik_m",  ad:"Bulaşık Makinesi",     emoji:"🫧", m:5000,  s:11000, sure:480, max:25},
      {id:"camasir_m",  ad:"Çamaşır Makinesi",    emoji:"🌀", m:5000,  s:11000, sure:480, max:25},
      {id:"kurutucu",   ad:"Çamaşır Kurutma",     emoji:"💨", m:6000,  s:13000, sure:480, max:20},
      {id:"firin_e",    ad:"Ankastre Fırın",       emoji:"🔥", m:3000,  s:7000,  sure:360, max:30},
      {id:"ocak",       ad:"Doğalgaz Ocağı",       emoji:"🍳", m:2000,  s:4800,  sure:360, max:30},
      {id:"davlumbaz",  ad:"Davlumbaz",            emoji:"💨", m:1500,  s:3600,  sure:240, max:40},
      {id:"klima",      ad:"Klima (12000 BTU)",    emoji:"❄️", m:5000,  s:11000, sure:480, max:20},
      {id:"kombi",      ad:"Kombi",                emoji:"🔥", m:8000,  s:18000, sure:600, max:15},
      {id:"tv_55",      ad:"55 inç Smart TV",      emoji:"📺", m:8000,  s:17000, sure:480, max:20},
      {id:"tv_43",      ad:"43 inç Smart TV",      emoji:"📺", m:5000,  s:11000, sure:480, max:30},
      {id:"robot_sup",  ad:"Robot Süpürge",        emoji:"🤖", m:3000,  s:7000,  sure:360, max:30},
      {id:"elektrik_sup",ad:"Elektrikli Süpürge",  emoji:"🌀", m:1500,  s:3600,  sure:240, max:40},
      {id:"mikser",     ad:"Stand Mikser",         emoji:"🥣", m:800,   s:2000,  sure:180, max:60},
      {id:"blender",    ad:"Blender Seti",         emoji:"🥤", m:600,   s:1500,  sure:120, max:80},
      {id:"hava_fryer", ad:"Airfryer (5lt)",       emoji:"🍟", m:1500,  s:3600,  sure:240, max:50},
      {id:"kahve_mak",  ad:"Espresso Makinesi",    emoji:"☕", m:2000,  s:4800,  sure:300, max:30},
      {id:"ekmek_kiz",  ad:"Ekmek Kızartma",      emoji:"🍞", m:300,   s:750,   sure:60,  max:100},
      {id:"su_isiticisi",ad:"Su Isıtıcısı",       emoji:"♨️", m:200,   s:500,   sure:60,  max:150},
      {id:"saat_duvar", ad:"Akıllı Saat (duvar)", emoji:"🕰️", m:500,   s:1300,  sure:120, max:80}
    ]},

    // 15. SPOR MALZEMELERİ
    {id:"spormarket", ad:"Spor Malzemeleri", emoji:"🏋️", acilis:180000, kategori:"spor",
     urunler:[
      {id:"dumbbell",   ad:"Dumbbell Seti (20kg)",  emoji:"🏋️", m:800,   s:2100,  sure:180, max:50 },
      {id:"barbell",    ad:"Barbell + Plakalar",    emoji:"🏋️", m:2000,  s:5200,  sure:360, max:20 },
      {id:"squat_rack", ad:"Squat Rack",            emoji:"🏗️", m:5000,  s:12000, sure:480, max:10 },
      {id:"kog_bandi",  ad:"Koşu Bandı",           emoji:"🏃", m:4000,  s:9500,  sure:480, max:15 },
      {id:"bisiklet",   ad:"Kondisyon Bisikleti",   emoji:"🚴", m:2000,  s:5000,  sure:360, max:20 },
      {id:"kupa_aleti", ad:"Kürek Çekme Aleti",    emoji:"🚣", m:3000,  s:7500,  sure:480, max:15 },
      {id:"yoga_mat",   ad:"Yoga Matı (premium)",   emoji:"🧘", m:200,   s:550,   sure:60,  max:100},
      {id:"diren_bant", ad:"Direnç Bandı Seti",    emoji:"🪢", m:150,   s:400,   sure:60,  max:150},
      {id:"atla_ipi",   ad:"Atlama İpi (pro)",     emoji:"🪢", m:100,   s:280,   sure:30,  max:200},
      {id:"futbol_top", ad:"Futbol Topu (FIFA)",    emoji:"⚽", m:300,   s:800,   sure:90,  max:100},
      {id:"basketbol_t",ad:"Basketbol Topu",        emoji:"🏀", m:250,   s:650,   sure:90,  max:80 },
      {id:"voleybol_t", ad:"Voleybol Topu",         emoji:"🏐", m:200,   s:520,   sure:90,  max:80 },
      {id:"tenis_raket",ad:"Tenis Raketi",          emoji:"🎾", m:500,   s:1300,  sure:120, max:60 },
      {id:"boks_torba", ad:"Boks Torbası Seti",    emoji:"🥊", m:800,   s:2100,  sure:180, max:30 },
      {id:"boks_eldiven",ad:"Boks Eldiveni",        emoji:"🥊", m:300,   s:800,   sure:90,  max:80 },
      {id:"yuzme_goz",  ad:"Yüzme Gözlüğü",       emoji:"🥽", m:80,    s:220,   sure:30,  max:200},
      {id:"bisiklet_k", ad:"Bisiklet Kaskı",       emoji:"🪖", m:200,   s:550,   sure:60,  max:100},
      {id:"kosu_ayak",  ad:"Koşu Ayakkabısı",     emoji:"👟", m:600,   s:1600,  sure:120, max:80 },
      {id:"spor_cantasi",ad:"Spor Çantası (50lt)",  emoji:"🎒", m:300,   s:800,   sure:90,  max:100},
      {id:"fitness_tr", ad:"Fitness Tracker",       emoji:"⌚", m:500,   s:1300,  sure:120, max:80 },
      {id:"protein_sh", ad:"Protein Shaker",        emoji:"🥤", m:80,    s:220,   sure:30,  max:200}
    ]},

    // 16. ÇOCUK OYUNCAK
    {id:"oyuncakci", ad:"Oyuncakçı", emoji:"🧸", acilis:70000, kategori:"cocuk",
     urunler:[
      {id:"lego",       ad:"LEGO Seti (orta)",      emoji:"🧱", m:200,  s:550,  sure:120, max:150},
      {id:"lego_buyuk", ad:"LEGO Technic (büyük)",  emoji:"🧱", m:600,  s:1600, sure:240, max:50 },
      {id:"barbie",     ad:"Barbie Bebek Seti",     emoji:"👧", m:150,  s:420,  sure:90,  max:200},
      {id:"hotwheels",  ad:"Hot Wheels Set",        emoji:"🚗", m:80,   s:220,  sure:60,  max:300},
      {id:"rc_araba",   ad:"Uzaktan Kumandalı Araba",emoji:"🚗",m:300,  s:800,  sure:180, max:80 },
      {id:"drone_oyun", ad:"Çocuk Drone",           emoji:"🚁", m:400,  s:1050, sure:240, max:40 },
      {id:"puzzle_c",   ad:"Çocuk Yapbozu (100p)",  emoji:"🧩", m:50,   s:135,  sure:60,  max:300},
      {id:"satranc",    ad:"Satranç Seti",          emoji:"♟️", m:80,   s:220,  sure:60,  max:150},
      {id:"monopoly",   ad:"Monopoly (Türkiye)",    emoji:"🎲", m:200,  s:550,  sure:90,  max:100},
      {id:"bilardo_m",  ad:"Mini Bilardo Masası",   emoji:"🎱", m:300,  s:800,  sure:180, max:30 },
      {id:"kaydırak",   ad:"Kaydırak + Salıncak",  emoji:"🎠", m:800,  s:2100, sure:360, max:15 },
      {id:"teneke_ev",  ad:"Oyun Evi (bahçe)",     emoji:"🏠", m:1500, s:3800, sure:480, max:10 },
      {id:"paten",      ad:"Paten (çocuk)",         emoji:"🛼", m:200,  s:550,  sure:90,  max:80 },
      {id:"bisiklet_c", ad:"Çocuk Bisikleti",      emoji:"🚲", m:500,  s:1300, sure:240, max:40 },
      {id:"scooter_c",  ad:"Çocuk Scooter",        emoji:"🛴", m:300,  s:800,  sure:180, max:60 },
      {id:"resim_seti", ad:"Resim ve Boya Seti",   emoji:"🎨", m:80,   s:220,  sure:60,  max:200},
      {id:"hamuroyun",  ad:"Oyun Hamuru Seti",     emoji:"🟡", m:50,   s:135,  sure:30,  max:300},
      {id:"uzay_oyun",  ad:"Uzay Temalı Oyun",     emoji:"🚀", m:200,  s:550,  sure:90,  max:100},
      {id:"dinozor",    ad:"Dinozor Figür Seti",   emoji:"🦕", m:150,  s:420,  sure:90,  max:120},
      {id:"kukla",      ad:"El Kuklası Seti",      emoji:"🎭", m:100,  s:280,  sure:60,  max:150}
    ]},

    // 17. BAHÇE MERKEZİ
    {id:"bahce", ad:"Bahçe & Tarım Merkezi", emoji:"🌱", acilis:65000, kategori:"tarim",
     urunler:[
      {id:"cic_gul",    ad:"Gül Fidanı",           emoji:"🌹", m:30,   s:80,   sure:60,  max:300},
      {id:"cic_orkide", ad:"Orkide",               emoji:"🪷", m:50,   s:140,  sure:60,  max:200},
      {id:"cic_mevsim", ad:"Mevsimlik Çiçek",      emoji:"🌸", m:15,   s:42,   sure:30,  max:500},
      {id:"kaktus",     ad:"Kaktüs Koleksiyonu",   emoji:"🌵", m:20,   s:55,   sure:30,  max:400},
      {id:"sukulent",   ad:"Sukulent Set (5li)",   emoji:"🪴", m:60,   s:165,  sure:60,  max:200},
      {id:"domates_fid",ad:"Domates Fidesi (6lı)",  emoji:"🍅", m:30,   s:80,   sure:30,  max:300},
      {id:"biber_fid",  ad:"Biber Fidesi",         emoji:"🫑", m:20,   s:55,   sure:30,  max:300},
      {id:"herb_set",   ad:"Bitki Seti (nane,reyhan)",emoji:"🌿",m:40,  s:105,  sure:30,  max:200},
      {id:"toprak",     ad:"Saksı Toprağı (10lt)", emoji:"🪴", m:25,   s:65,   sure:30,  max:400},
      {id:"gübre",      ad:"Gübre (1kg)",          emoji:"🌾", m:30,   s:75,   sure:30,  max:300},
      {id:"ilaç_b",     ad:"Böcek İlacı",         emoji:"🐛", m:40,   s:100,  sure:30,  max:200},
      {id:"sulama_h",   ad:"Sulama Hortumu (25m)", emoji:"💧", m:200,  s:520,  sure:120, max:80 },
      {id:"bahce_alet", ad:"Bahçe Alet Seti",     emoji:"🛠️", m:150,  s:400,  sure:90,  max:100},
      {id:"bahce_kuyru",ad:"Bahçe Küreği",        emoji:"🪣", m:80,   s:210,  sure:60,  max:150},
      {id:"saksı_büyük",ad:"Büyük Saksı (seramik)",emoji:"🪴",m:80,   s:210,  sure:60,  max:100},
      {id:"çim_tohum",  ad:"Çim Tohumu (1kg)",    emoji:"🌱", m:50,   s:130,  sure:30,  max:200},
      {id:"compost",    ad:"Kompost (5kg)",        emoji:"♻️", m:60,   s:155,  sure:60,  max:150},
      {id:"agac_fidan", ad:"Meyve Ağacı Fidanı",  emoji:"🌳", m:100,  s:280,  sure:90,  max:100},
      {id:"çim_bic",    ad:"Çim Biçme Makinesi",  emoji:"🌿", m:1500, s:3800, sure:480, max:15 },
      {id:"damla_sul",  ad:"Damla Sulama Seti",   emoji:"💧", m:300,  s:780,  sure:180, max:50 }
    ]},

    // 18. OTOPARK / GARAj
    {id:"oto_garaj", ad:"Oto Servis & Galeri", emoji:"🚗", acilis:500000, kategori:"otoomotiv",
     urunler:[
      {id:"lastik_yaz", ad:"Yaz Lastiği (4lü)",    emoji:"🔄", m:2000, s:4500, sure:240, max:30},
      {id:"lastik_kis", ad:"Kış Lastiği (4lü)",    emoji:"❄️", m:2500, s:5500, sure:240, max:30},
      {id:"motor_yag",  ad:"Motor Yağı 5W40 (4lt)",emoji:"🛢️", m:400,  s:950,  sure:60,  max:100},
      {id:"fren_disk",  ad:"Fren Diski + Balata",  emoji:"⚙️", m:800,  s:2000, sure:180, max:40},
      {id:"akümulator", ad:"Akü (70 Amper)",       emoji:"🔋", m:1200, s:2800, sure:180, max:30},
      {id:"muayene",    ad:"Araç Muayene Yardım",  emoji:"🔍", m:200,  s:600,  sure:60,  max:9999},
      {id:"kaza_raporl",ad:"Kaza Tespit Tutanağı", emoji:"📋", m:100,  s:350,  sure:30,  max:9999},
      {id:"arac_yikama",ad:"Araç Yıkama (detay)",  emoji:"🚿", m:100,  s:400,  sure:60,  max:9999},
      {id:"boya_tamir", ad:"Boya Çizik Tamiri",    emoji:"🎨", m:500,  s:1800, sure:240, max:9999},
      {id:"cam_degis",  ad:"Ön Cam Değişimi",      emoji:"🔲", m:1500, s:4000, sure:360, max:9999},
      {id:"sanziman",   ad:"Şanzıman Bakımı",      emoji:"⚙️", m:1000, s:3000, sure:360, max:9999},
      {id:"klima_bak",  ad:"Araç Klima Bakımı",   emoji:"❄️", m:300,  s:900,  sure:120, max:9999},
      {id:"xenon_far",  ad:"Xenon Far Takımı",     emoji:"💡", m:800,  s:2200, sure:180, max:40 },
      {id:"kamera_ar",  ad:"Geri Görüş Kamerası",  emoji:"📷", m:500,  s:1400, sure:120, max:50 },
      {id:"ses_sistemi",ad:"Araç Ses Sistemi",     emoji:"🔊", m:1000, s:2800, sure:240, max:30 }
    ]},

    // 19. KUAFÖR (Erkek Berberi)
    {id:"erkekkuafor", ad:"Erkek Berberi", emoji:"🪒", acilis:30000, kategori:"hizmet",
     urunler:[
      {id:"sac_klasik", ad:"Klasik Saç Kesimi",    emoji:"✂️", m:15,  s:60,   sure:15, max:9999},
      {id:"sac_modern", ad:"Modern Kesim+Şekil",   emoji:"✂️", m:25,  s:100,  sure:25, max:9999},
      {id:"sakal_tam",  ad:"Sakal Kesim+Şekil",   emoji:"🪒", m:15,  s:60,   sure:20, max:9999},
      {id:"sakal_alim", ad:"Sakal Tamamen Alım",   emoji:"🪒", m:20,  s:80,   sure:20, max:9999},
      {id:"biyore",     ad:"Bıyık Düzeltme",       emoji:"👨", m:10,  s:40,   sure:10, max:9999},
      {id:"kel_tiras",  ad:"Kel Traş (jilet)",    emoji:"🪒", m:20,  s:80,   sure:20, max:9999},
      {id:"sac_sakal",  ad:"Saç + Sakal Kombo",   emoji:"✂️", m:35,  s:130,  sure:35, max:9999},
      {id:"coc_sac",    ad:"Çocuk Saç Kesimi",    emoji:"👦", m:15,  s:55,   sure:15, max:9999},
      {id:"sac_boyama_e",ad:"Erkek Saç Boyama",   emoji:"🎨", m:60,  s:230,  sure:60, max:9999},
      {id:"sac_yikama", ad:"Saç Yıkama + Fön",   emoji:"💆", m:20,  s:75,   sure:20, max:9999},
      {id:"kafa_masaj", ad:"Kafa Masajı",         emoji:"🧖", m:15,  s:60,   sure:15, max:9999},
      {id:"yuz_bakim_e",ad:"Erkek Yüz Bakımı",   emoji:"🧴", m:40,  s:155,  sure:30, max:9999},
      {id:"kak_erkek",  ad:"Kaş Alma",            emoji:"🪮", m:10,  s:40,   sure:10, max:9999},
      {id:"kulak_bur",  ad:"Kulak+Burun Temizlik",emoji:"👂", m:10,  s:40,   sure:10, max:9999},
      {id:"ozel_damat", ad:"Damat Hazırlama",     emoji:"🤵", m:150, s:600,  sure:90, max:9999}
    ]},

    // 20. EMLAK OFİSİ
    {id:"emlak", ad:"Emlak Ofisi", emoji:"🏢", acilis:200000, kategori:"hizmet",
     urunler:[
      {id:"kira_1",     ad:"1+1 Kiralık Bulma",    emoji:"🏠", m:500,  s:5000,  sure:1440,max:9999},
      {id:"kira_2",     ad:"2+1 Kiralık Bulma",    emoji:"🏠", m:800,  s:8000,  sure:1440,max:9999},
      {id:"kira_3",     ad:"3+1 Kiralık Bulma",    emoji:"🏠", m:1000, s:12000, sure:1440,max:9999},
      {id:"satis_1",    ad:"1+1 Satılık Bulma",    emoji:"🏡", m:2000, s:25000, sure:2880,max:9999},
      {id:"satis_2",    ad:"2+1 Satılık Bulma",    emoji:"🏡", m:3000, s:40000, sure:2880,max:9999},
      {id:"satis_3",    ad:"3+1 Satılık Bulma",    emoji:"🏡", m:4000, s:60000, sure:2880,max:9999},
      {id:"villa",      ad:"Villa Satışı",          emoji:"🏰", m:10000,s:200000,sure:4320,max:9999},
      {id:"isyeri",     ad:"İşyeri Kiralama",       emoji:"🏪", m:1500, s:15000, sure:2880,max:9999},
      {id:"arsa",       ad:"Arsa Alım-Satım",      emoji:"🌍", m:5000, s:80000, sure:4320,max:9999},
      {id:"degerleme",  ad:"Gayrimenkul Değerleme", emoji:"📊", m:500,  s:2500,  sure:240, max:9999},
      {id:"danismanlik",ad:"Yatırım Danışmanlığı",  emoji:"💼", m:1000, s:5000,  sure:480, max:9999}
    ]},

    // 21. ÇIÇEKÇI
    {id:"cicekci", ad:"Çiçekçi", emoji:"💐", acilis:30000, kategori:"hizmet",
     urunler:[
      {id:"gul_buket",  ad:"Gül Buketi (10lu)",    emoji:"🌹", m:80,   s:220,  sure:60,  max:200},
      {id:"gul_kirmizi",ad:"Kırmızı Gül (1 adet)", emoji:"🌹", m:10,   s:30,   sure:30,  max:9999},
      {id:"lale_buket", ad:"Lale Buketi",          emoji:"🌷", m:60,   s:165,  sure:60,  max:150},
      {id:"kir_cic",    ad:"Kır Çiçeği Buketi",   emoji:"💐", m:50,   s:135,  sure:60,  max:200},
      {id:"gelin_buketi",ad:"Gelin Buketi",         emoji:"👰", m:200,  s:650,  sure:180, max:50 },
      {id:"cenaze_cic", ad:"Cenaze Çelengi",       emoji:"⚫", m:300,  s:800,  sure:240, max:30 },
      {id:"saks_aranj", ad:"Saksı Aranjman",       emoji:"🪴", m:80,   s:220,  sure:90,  max:100},
      {id:"ayi_buket",  ad:"Çiçekli Ayıcık",      emoji:"🧸", m:100,  s:280,  sure:90,  max:80 },
      {id:"balonlu",    ad:"Balon + Çiçek Seti",  emoji:"🎈", m:80,   s:220,  sure:60,  max:100},
      {id:"sevgililer", ad:"Sevgililer Günü Set",  emoji:"❤️", m:150,  s:420,  sure:120, max:100},
      {id:"anneler",    ad:"Anneler Günü Buketi",  emoji:"💝", m:120,  s:340,  sure:90,  max:150},
      {id:"bebek_cic",  ad:"Bebek Doğum Çiçeği",  emoji:"🍼", m:100,  s:280,  sure:90,  max:100},
      {id:"orkide_sak", ad:"Orkide Saksı",         emoji:"🪷", m:80,   s:220,  sure:60,  max:150},
      {id:"kuru_cic",   ad:"Kuru Çiçek Aranjman", emoji:"🌾", m:60,   s:165,  sure:60,  max:150}
    ]},

    // 22. KAFEYERİ
    {id:"kafe", ad:"Kafe & Kahvehane", emoji:"☕", acilis:85000, kategori:"gida",
     urunler:[
      {id:"turk_kahve", ad:"Türk Kahvesi",         emoji:"☕", m:5,    s:25,   sure:5,   max:9999},
      {id:"espresso",   ad:"Espresso",             emoji:"☕", m:8,    s:35,   sure:5,   max:9999},
      {id:"latte",      ad:"Latte / Sütlü Kahve",  emoji:"🥛", m:10,   s:45,   sure:5,   max:9999},
      {id:"cappuccino", ad:"Cappuccino",           emoji:"☕", m:10,   s:45,   sure:5,   max:9999},
      {id:"soguk_kahve",ad:"Soğuk Kahve",          emoji:"🧊", m:12,   s:55,   sure:5,   max:9999},
      {id:"cay",        ad:"Çay (bardak)",         emoji:"🍵", m:2,    s:10,   sure:3,   max:9999},
      {id:"bitki_cay",  ad:"Bitki Çayı",           emoji:"🌿", m:5,    s:22,   sure:5,   max:9999},
      {id:"salep",      ad:"Salep",                emoji:"🥛", m:8,    s:32,   sure:5,   max:9999},
      {id:"limonata",   ad:"Limonata (büyük)",     emoji:"🍋", m:8,    s:35,   sure:5,   max:9999},
      {id:"smoothie",   ad:"Meyve Smoothie",       emoji:"🥤", m:15,   s:60,   sure:5,   max:9999},
      {id:"waffle",     ad:"Waffle",               emoji:"🧇", m:20,   s:80,   sure:15,  max:9999},
      {id:"krasor",     ad:"Kruvasan + Kahve",     emoji:"🥐", m:20,   s:75,   sure:10,  max:9999},
      {id:"cheesecake", ad:"Cheesecake Dilim",     emoji:"🍰", m:25,   s:95,   sure:10,  max:9999},
      {id:"tost_k",     ad:"Tost",                emoji:"🫕", m:15,   s:55,   sure:10,  max:9999},
      {id:"sandvic_k",  ad:"Club Sandviç",         emoji:"🥪", m:30,   s:110,  sure:15,  max:9999},
      {id:"nargile_k",  ad:"Nargile",             emoji:"💨", m:50,   s:200,  sure:60,  max:9999},
      {id:"tahta_oyun", ad:"Masa Oyunu Kiralama", emoji:"🎲", m:10,   s:50,   sure:60,  max:9999}
    ]},

    // 23. HALICI
    {id:"halici", ad:"Halı & Dekorasyon", emoji:"🪆", acilis:120000, kategori:"ev",
     urunler:[
      {id:"hali_kucuk", ad:"Halı (80x150)",        emoji:"🟥", m:300,  s:800,  sure:240, max:60 },
      {id:"hali_orta",  ad:"Halı (150x230)",       emoji:"🟥", m:800,  s:2100, sure:360, max:30 },
      {id:"hali_buyuk", ad:"Halı (200x300)",       emoji:"🟥", m:1500, s:4000, sure:480, max:15 },
      {id:"hereke",     ad:"El Dokuma Hereke",      emoji:"✨", m:5000, s:15000,sure:720, max:5  },
      {id:"kilim",      ad:"Kilim (el dokuması)",   emoji:"🟧", m:1000, s:2800, sure:480, max:20 },
      {id:"banyo_paspas",ad:"Banyo Paspası Seti",  emoji:"🟦", m:150,  s:400,  sure:90,  max:100},
      {id:"kapı_paspas",ad:"Kapı Paspası",         emoji:"🟫", m:80,   s:220,  sure:60,  max:150},
      {id:"tablo",      ad:"Dekoratif Tablo",      emoji:"🖼️", m:200,  s:550,  sure:120, max:80 },
      {id:"vazo",       ad:"Seramik Vazo",         emoji:"🪆", m:150,  s:420,  sure:90,  max:100},
      {id:"mum",        ad:"Dekoratif Mum Seti",   emoji:"🕯️", m:80,   s:220,  sure:60,  max:150},
      {id:"lamba",      ad:"Dekoratif Lamba",      emoji:"🪔", m:200,  s:550,  sure:120, max:80 },
      {id:"fotoraf_cer",ad:"Fotoğraf Çerçevesi",   emoji:"🖼️", m:60,   s:165,  sure:60,  max:200},
      {id:"avize",      ad:"Avize",                emoji:"💡", m:800,  s:2200, sure:360, max:20 },
      {id:"yastik",     ad:"Yastık Kılıfı Seti",  emoji:"🛌", m:100,  s:280,  sure:90,  max:150}
    ]},

    // 24. ELEKTRİKÇİ MALZEME
    {id:"elektrikci", ad:"Elektrik & Donanım", emoji:"⚡", acilis:80000, kategori:"teknik",
     urunler:[
      {id:"priz",       ad:"Priz (topraklı)",      emoji:"🔌", m:15,   s:40,   sure:30,  max:500},
      {id:"anahtar",    ad:"Işık Anahtarı",        emoji:"🔆", m:10,   s:28,   sure:30,  max:500},
      {id:"kablo",      ad:"NYA Kablo (m)",        emoji:"🔴", m:5,    s:14,   sure:15,  max:1000},
      {id:"ampul_led",  ad:"LED Ampul (10W)",      emoji:"💡", m:30,   s:75,   sure:30,  max:400},
      {id:"spot",       ad:"LED Spot (5li)",       emoji:"💡", m:100,  s:260,  sure:60,  max:200},
      {id:"sigorta",    ad:"Sigorta Kutusu",       emoji:"⚡", m:200,  s:520,  sure:90,  max:80 },
      {id:"guc_priz",   ad:"Çoklu Priz (5li)",    emoji:"🔌", m:80,   s:210,  sure:30,  max:200},
      {id:"ups",        ad:"UPS (650VA)",           emoji:"🔋", m:500,  s:1300, sure:120, max:50 },
      {id:"kamera_gv",  ad:"Güvenlik Kamerası",   emoji:"📷", m:500,  s:1300, sure:180, max:50 },
      {id:"kapi_zili",  ad:"Görüntülü Kapı Zili",  emoji:"🔔", m:600,  s:1600, sure:180, max:40 },
      {id:"alarm",      ad:"Hırsız Alarm Seti",   emoji:"🚨", m:800,  s:2100, sure:240, max:30 },
      {id:"solar",      ad:"Solar Panel (100W)",   emoji:"☀️", m:1500, s:3800, sure:360, max:20 },
      {id:"voltmetre",  ad:"Dijital Voltmetre",   emoji:"⚡", m:150,  s:400,  sure:60,  max:80 },
      {id:"tamir_seti", ad:"Elektrik Tamir Seti", emoji:"🛠️", m:200,  s:520,  sure:90,  max:60 }
    ]},

    // 25. SUPERmarket (büyük)
    {id:"supermarket", ad:"Süpermarket", emoji:"🏬", acilis:500000, kategori:"gida",
     urunler:[
      {id:"et_reyonu",  ad:"Et Reyonu Dolum",      emoji:"🥩", m:500,  s:1200, sure:60,  max:9999},
      {id:"sut_urn",    ad:"Süt Ürünleri Dolum",  emoji:"🥛", m:300,  s:720,  sure:60,  max:9999},
      {id:"sebze_meyve",ad:"Sebze-Meyve Dolum",   emoji:"🥦", m:400,  s:960,  sure:60,  max:9999},
      {id:"ekmek_dolum",ad:"Ekmek Reyonu Dolum",  emoji:"🍞", m:200,  s:480,  sure:30,  max:9999},
      {id:"temizlik",   ad:"Temizlik Reyonu",      emoji:"🧹", m:300,  s:720,  sure:60,  max:9999},
      {id:"icecek_bol", ad:"İçecek Bölümü",       emoji:"🥤", m:400,  s:960,  sure:60,  max:9999},
      {id:"atistirma",  ad:"Atıştırmalık Reyonu", emoji:"🍿", m:250,  s:600,  sure:60,  max:9999},
      {id:"dondurulmus",ad:"Dondurulmuş Gıda",    emoji:"🧊", m:350,  s:840,  sure:60,  max:9999},
      {id:"organik",    ad:"Organik Ürünler",      emoji:"🌿", m:500,  s:1200, sure:60,  max:9999},
      {id:"ithal",      ad:"İthal Ürünler",        emoji:"🌍", m:600,  s:1440, sure:60,  max:9999},
      {id:"kozmetik_s", ad:"Kozmetik Bölümü",     emoji:"💄", m:400,  s:960,  sure:60,  max:9999},
      {id:"elektronik_s",ad:"Elektronik Bölümü",  emoji:"📱", m:1000, s:2400, sure:120, max:9999},
      {id:"giyim_s",    ad:"Tekstil Bölümü",      emoji:"👕", m:500,  s:1200, sure:120, max:9999},
      {id:"oyuncak_s",  ad:"Oyuncak Bölümü",      emoji:"🧸", m:400,  s:960,  sure:120, max:9999},
      {id:"market_kafe",ad:"Market Kafesi",        emoji:"☕", m:100,  s:350,  sure:30,  max:9999}
    ]}
  ];

  // ════ SEVİYE SİSTEMİ ════
  var SEVIYELER = [
    {s:1,  mc:1.0,  gc:1.0,  db:0,     maliyet:0        },
    {s:2,  mc:1.3,  gc:1.2,  db:100,   maliyet:50000    },
    {s:3,  mc:1.7,  gc:1.5,  db:200,   maliyet:150000   },
    {s:4,  mc:2.2,  gc:2.0,  db:400,   maliyet:400000   },
    {s:5,  mc:3.0,  gc:2.8,  db:800,   maliyet:1000000  },
    {s:6,  mc:4.0,  gc:3.8,  db:1500,  maliyet:2500000  },
    {s:7,  mc:5.5,  gc:5.0,  db:3000,  maliyet:6000000  },
    {s:8,  mc:7.5,  gc:7.0,  db:5000,  maliyet:15000000 },
    {s:9,  mc:10.0, gc:9.5,  db:10000, maliyet:40000000 },
    {s:10, mc:15.0, gc:14.0, db:20000, maliyet:100000000}
  ];

  function _sev(n){ return SEVIYELER.find(function(x){return x.s===n;})||SEVIYELER[0]; }
  function _il(p){ return ILLER.find(function(x){return x.plaka===p;}); }
  function _tur(id){ return DUKKAN_TURLERI.find(function(x){return x.id===id;}); }
  function _st(){ if(!OYUN.s.dukkanlar) OYUN.s.dukkanlar={}; return OYUN.s.dukkanlar; }

  // ════ DÜKKAN AÇ ════
  function dukkanAc(plaka, turId){
    plaka=parseInt(plaka);
    var il=_il(plaka), tur=_tur(turId);
    if(!il||!tur) return UI.toast("Geçersiz seçim.","error");
    var durum=_st();
    if(durum[plaka]) return UI.toast(il.ad+" ilinde zaten dükkanınız var!","warning");
    if(!OYUN.harca(tur.acilis, tur.ad+" açılış")) return;
    var stok={};
    tur.urunler.forEach(function(u){stok[u.id]=0;});
    durum[plaka]={ilAdi:il.ad,plaka:plaka,turId:turId,turAdi:tur.ad,emoji:tur.emoji,seviye:1,stok:stok,toplamKazanc:0,acilis:Date.now(),sonGelir:Date.now()};
    OYUN.kaydet(); OYUN.xpEkle(200);
    UI.toast("🎉 "+il.ad+" — "+tur.emoji+" "+tur.ad+" açıldı!","success");
    renderDukkanlar();
  }

  // ════ YÜKSELT ════
  function dukkanYukselt(plaka){
    plaka=parseInt(plaka);
    var d=_st()[plaka];
    if(!d) return;
    if(d.seviye>=10) return UI.toast("Maksimum seviye!","warning");
    var sonraki=_sev(d.seviye+1);
    if(!OYUN.harca(sonraki.maliyet,"Yükseltme")) return;
    d.seviye++;
    OYUN.kaydet(); OYUN.xpEkle(100*d.seviye);
    UI.toast("⬆️ "+d.turAdi+" Seviye "+d.seviye+"!","success");
    renderDukkanlar();
  }

  // ════ ÜRETİM ════
  function uretimYap(plaka, urunId, miktar){
    plaka=parseInt(plaka); miktar=parseInt(miktar)||1;
    var d=_st()[plaka]; if(!d) return;
    var tur=_tur(d.turId), urun=tur.urunler.find(function(u){return u.id===urunId;});
    if(!urun) return;
    var sb=_sev(d.seviye), max=urun.max+sb.db;
    var mevcut=d.stok[urunId]||0;
    if(mevcut>=max) return UI.toast("Depo dolu! Önce sat.","warning");
    miktar=Math.min(miktar,max-mevcut);
    if(!OYUN.harca(urun.m*miktar,"Üretim")) return;
    d.stok[urunId]=mevcut+miktar;
    OYUN.kaydet(); OYUN.xpEkle(3);
    UI.toast("✅ "+miktar+"x "+urun.emoji+" "+urun.ad+" üretildi.","success");
    renderDukkanDetay(plaka);
  }

  // ════ GELİR TOPLA ════
  function gelirTopla(plaka){
    plaka=parseInt(plaka);
    var d=_st()[plaka]; if(!d) return;
    var tur=_tur(d.turId), il=_il(plaka), sb=_sev(d.seviye);
    var elapsed=(Date.now()-(d.sonGelir||Date.now()))/3600000;
    if(elapsed<0.016) return UI.toast("Çok erken! 1 dakika bekleyin.","warning");
    var toplamGelir=0, satirlar=[];
    var musteriSaat=Math.floor((il.nufus/10000)*il.zenginlik*sb.mc);
    tur.urunler.forEach(function(urun){
      var stok=d.stok[urun.id]||0; if(stok<=0) return;
      var satis=Math.min(stok,Math.floor(musteriSaat*elapsed*(Math.random()*0.4+0.2)));
      if(satis<=0) return;
      var gelir=Math.round(satis*urun.s*sb.gc);
      d.stok[urun.id]-=satis; toplamGelir+=gelir;
      satirlar.push(urun.emoji+" "+urun.ad+": "+satis+" adet → "+OYUN.fmt(gelir));
    });
    if(toplamGelir<=0) return UI.toast("Stok boş! Ürün üretin.","warning");
    d.sonGelir=Date.now(); d.toplamKazanc+=toplamGelir;
    OYUN.kazan(toplamGelir); OYUN.xpEkle(Math.floor(toplamGelir/100)); OYUN.kaydet();
    UI.showModal("💰 "+d.turAdi+" — "+il.ad,
      '<div style="line-height:2;font-size:.9rem">'+
      satirlar.map(function(s){return'<div>✅ '+s+'</div>';}).join('')+
      '<div style="margin-top:1rem;padding-top:.75rem;border-top:1px solid var(--border);font-size:1.05rem">Toplam: <b style="color:var(--gold)">'+OYUN.fmt(toplamGelir)+'</b></div></div>');
    renderDukkanlar();
  }

  // ════ KAPAT ════
  function dukkanKapat(plaka){
    plaka=parseInt(plaka);
    var d=_st()[plaka]; if(!d) return;
    if(!confirm(d.turAdi+" — "+d.ilAdi+" kapatılsın mı?")) return;
    delete _st()[plaka]; OYUN.kaydet();
    UI.toast("Dükkan kapatıldı.","info"); renderDukkanlar();
  }

  // ════ ANA RENDER ════
  function renderDukkanlar(){
    var el=document.getElementById("main-content");
    var durum=_st(), acik=Object.values(durum);
    var html='<div class="page-header"><h1>🏪 Dükkanlarım</h1><p>81 ilde '+DUKKAN_TURLERI.length+' farklı dükkan türü — her ilde 1 dükkan</p></div>';

    if(acik.length){
      var tk=acik.reduce(function(t,d){return t+d.toplamKazanc;},0);
      html+='<div class="stats-grid" style="margin-bottom:1.5rem">';
      html+='<div class="stat-card gold"><div class="stat-icon">🏪</div><div class="stat-value">'+acik.length+'/81</div><div class="stat-label">Açık Dükkan</div></div>';
      html+='<div class="stat-card green"><div class="stat-icon">💰</div><div class="stat-value">'+OYUN.fmt(tk)+'</div><div class="stat-label">Toplam Kazanç</div></div>';
      html+='</div>';
      html+='<div class="card-grid">';
      acik.forEach(function(d){
        var il=_il(d.plaka), sb=_sev(d.seviye), sonraki=d.seviye<10?_sev(d.seviye+1):null;
        var ms=Math.floor((il.nufus/10000)*il.zenginlik*sb.mc);
        var ts=Object.values(d.stok).reduce(function(a,b){return a+b;},0);
        html+='<div class="card"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.6rem">';
        html+='<div style="font-size:1.6rem">'+d.emoji+'</div><span class="badge badge-gold">Sev.'+d.seviye+'</span></div>';
        html+='<b style="font-size:1rem">'+d.turAdi+'</b><br>';
        html+='<span style="color:var(--text2);font-size:.82rem">📍 '+d.ilAdi+' ('+d.plaka+') — '+il.bolge+'</span>';
        html+='<div style="margin:.6rem 0"><div class="progress"><div class="progress-fill" style="width:'+(d.seviye/10*100)+'%"></div></div></div>';
        html+='<div style="font-size:.8rem;color:var(--text2);display:grid;grid-template-columns:1fr 1fr;gap:.25rem;margin-bottom:.75rem">';
        html+='<div>👥 '+ms.toLocaleString("tr-TR")+'/sa</div><div>📦 Stok: '+ts+'</div>';
        html+='<div>💰 '+OYUN.fmt(d.toplamKazanc)+'</div><div>x'+sb.gc+' gelir</div></div>';
        html+='<div class="btn-group">';
        html+='<button class="btn btn-gold btn-sm" onclick="DUKKAN.gelirTopla('+d.plaka+')">💰 Gelir</button>';
        html+='<button class="btn btn-sm" onclick="DUKKAN.renderDukkanDetay('+d.plaka+')">📦 Ürünler</button>';
        if(sonraki) html+='<button class="btn btn-green btn-sm" onclick="DUKKAN.dukkanYukselt('+d.plaka+')" title="'+OYUN.fmt(sonraki.maliyet)+'">⬆️ Yükselt</button>';
        html+='<button class="btn btn-sm btn-red" onclick="DUKKAN.dukkanKapat('+d.plaka+')">🔒</button>';
        html+='</div></div>';
      });
      html+='</div>';
    }

    // Yeni dükkan
    html+='<div class="card" style="margin-top:1.5rem"><h3 style="margin-bottom:1rem">🆕 Yeni Dükkan Aç</h3>';
    html+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem">';
    html+='<div><label class="form-label">İl Seç</label><select id="dk-il" class="input" onchange="DUKKAN.ilBilgi()">';
    ILLER.forEach(function(il){
      var d=durum[il.plaka];
      html+='<option value="'+il.plaka+'"'+(d?' disabled':'')+'>'+il.plaka+'. '+il.ad+(d?' ✅ ('+d.emoji+')':"")+'</option>';
    });
    html+='</select></div>';
    html+='<div><label class="form-label">Dükkan Türü ('+DUKKAN_TURLERI.length+' tür)</label><select id="dk-tur" class="input" onchange="DUKKAN.ilBilgi()">';
    DUKKAN_TURLERI.forEach(function(t){
      html+='<option value="'+t.id+'">'+t.emoji+' '+t.ad+' — '+OYUN.fmt(t.acilis)+'</option>';
    });
    html+='</select></div></div>';
    html+='<div id="dk-bilgi" style="margin-top:.75rem;font-size:.85rem;color:var(--text2)"></div>';
    html+='<button class="btn btn-gold full-width" style="margin-top:.75rem" onclick="DUKKAN.dukkanAc(document.getElementById(\'dk-il\').value,document.getElementById(\'dk-tur\').value)">🏪 Dükkan Aç</button></div>';

    // 81 il haritası
    html+='<div class="card" style="margin-top:1.5rem"><h3 style="margin-bottom:.75rem">🗺️ 81 İl Haritası</h3>';
    html+='<div style="display:flex;flex-wrap:wrap;gap:.35rem">';
    ILLER.forEach(function(il){
      var d=durum[il.plaka];
      var renk=d?'var(--gold)':'rgba(255,255,255,.2)';
      var bg=d?'rgba(212,160,23,.15)':'transparent';
      html+='<div title="'+il.ad+(d?'\n'+d.emoji+' '+d.turAdi+' Sev.'+d.seviye:'\nBoş')+'" style="width:30px;height:30px;border:1px solid '+renk+';border-radius:3px;background:'+bg+';font-size:.65rem;color:'+renk+';display:flex;align-items:center;justify-content:center;cursor:default">'+il.plaka+'</div>';
    });
    html+='</div><div style="margin-top:.5rem;font-size:.75rem;color:var(--text3)">🟡 Dükkan var &nbsp; ⬜ Boş il</div></div>';

    el.innerHTML=html;
    setTimeout(function(){DUKKAN.ilBilgi();},100);
  }

  // ════ İL BİLGİSİ ════
  function ilBilgi(){
    var ilEl=document.getElementById("dk-il"), turEl=document.getElementById("dk-tur"), bilgiEl=document.getElementById("dk-bilgi");
    if(!ilEl||!turEl||!bilgiEl) return;
    var il=_il(parseInt(ilEl.value)), tur=_tur(turEl.value);
    if(!il||!tur) return;
    bilgiEl.innerHTML='<b>'+il.ad+'</b> nüfus: '+il.nufus.toLocaleString("tr-TR")+' | Bölge: '+il.bolge+' | Zenginlik: '+"⭐".repeat(il.zenginlik)+' <br>'+tur.emoji+' '+tur.ad+': <b>'+OYUN.fmt(tur.acilis)+'</b> açılış — '+tur.urunler.length+' ürün çeşidi';
  }

  // ════ DETAY RENDER ════
  function renderDukkanDetay(plaka){
    plaka=parseInt(plaka);
    var d=_st()[plaka]; if(!d) return;
    var tur=_tur(d.turId), il=_il(plaka), sb=_sev(d.seviye);
    var html='<div class="page-header"><h1>'+d.emoji+' '+d.turAdi+'</h1><p>'+il.ad+' | Seviye '+d.seviye+' | '+tur.urunler.length+' ürün çeşidi</p></div>';
    html+='<button class="btn btn-ghost" style="margin-bottom:1rem" onclick="DUKKAN.renderDukkanlar()">← Geri</button>';
    html+='<div class="card-grid">';
    tur.urunler.forEach(function(urun){
      var stok=d.stok[urun.id]||0, max=urun.max+sb.db, pct=Math.min(100,Math.round(stok/Math.max(max,1)*100));
      var kar=urun.s-urun.m, karPct=Math.round(kar/urun.m*100);
      html+='<div class="card"><div style="text-align:center;font-size:1.8rem">'+urun.emoji+'</div>';
      html+='<div style="text-align:center;font-weight:700;margin:.4rem 0;font-size:.92rem">'+urun.ad+'</div>';
      html+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:.3rem;font-size:.78rem;color:var(--text2);margin-bottom:.6rem">';
      html+='<div>Maliyet: <b style="color:var(--text)">'+OYUN.fmt(urun.m)+'</b></div>';
      html+='<div>Satış: <b style="color:var(--green)">'+OYUN.fmt(urun.s)+'</b></div>';
      html+='<div>Kâr: <b style="color:var(--gold)">'+OYUN.fmt(kar)+'</b></div>';
      html+='<div>Marj: <b style="color:var(--gold)">%'+karPct+'</b></div></div>';
      html+='<div style="font-size:.72rem;color:var(--text2);margin-bottom:.3rem">Stok: '+stok+'/'+max+'</div>';
      html+='<div class="progress" style="margin-bottom:.6rem"><div class="progress-fill" style="width:'+pct+'%;background:'+(pct>70?'var(--green)':pct>30?'var(--gold)':'var(--red-l)')+'"></div></div>';
      html+='<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:.3rem">';
      [10,50,100].forEach(function(a){
        html+='<button class="btn btn-sm btn-gold" onclick="DUKKAN.uretimYap('+plaka+',\''+urun.id+'\','+a+')" title="'+OYUN.fmt(urun.m*a)+'">'+a+'x</button>';
      });
      html+='</div>';
      html+='<div style="display:flex;gap:.4rem;margin-top:.4rem">';
      html+='<input type="number" id="u-'+urun.id+'" class="input" style="flex:1;margin:0" placeholder="Özel" min="1">';
      html+='<button class="btn btn-sm" onclick="DUKKAN.uretimYap('+plaka+',\''+urun.id+'\',document.getElementById(\'u-'+urun.id+'\').value)">Üret</button>';
      html+='</div></div>';
    });
    html+='</div>';
    document.getElementById("main-content").innerHTML=html;
  }

  return {
    dukkanAc:dukkanAc, dukkanYukselt:dukkanYukselt, dukkanKapat:dukkanKapat,
    uretimYap:uretimYap, gelirTopla:gelirTopla, ilBilgi:ilBilgi,
    renderDukkanlar:renderDukkanlar, renderDukkanDetay:renderDukkanDetay,
    ILLER:ILLER, DUKKAN_TURLERI:DUKKAN_TURLERI
  };
})();
