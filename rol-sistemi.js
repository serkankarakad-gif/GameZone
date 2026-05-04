/* ============================================================================
   rol-sistemi.js — GameZone ERP: Tam Rol & Yönetim Sistemi
   ─────────────────────────────────────────────────────────────────────────
   1.  ROL KİLİDİ       — Her rol sadece kendi panelini görür
   2.  MUHTARİLİK        — 250 şikayet kategorisi, belediyeye başvuru akışı,
                           yolsuzluk/rüşvet mekanizması, otomatik maaş
   3.  BELEDİYE BAŞKANI  — Tam yetki paneli (bütçe, imar, ruhsat, taşıma)
                           Halk şikayetlerini alır, yetersizse devlete yönlendirir
   4.  BAŞBAKAN          — Ulusal ekonomi + il bütçe dağıtımı
   5.  CUMHURBAŞKANI     — Her şeye hakimdir (yetkili panel)
   6.  MAAS SİSTEMİ      — Tüm kamu görevlileri otomatik maaş alır
   7.  RÜŞVET/YOLSUZLUK  — Yakalanma → mahkeme → görevden alma
   8.  81 İL SEÇİM       — Tam belediye seçimi bağlantısı
   ============================================================================
   index.html'de gamezone-v3.js ve duzeltmeler.js'in ALTINA ekle:
       <script src="rol-sistemi.js"></script>
   ============================================================================ */

'use strict';

/* ══════════════════════════════════════════════════════════════════════════
   BÖLÜM 0 — YARDIMCILAR
   ══════════════════════════════════════════════════════════════════════════ */

const RS = {
  uid:   () => window.GZ?.uid,
  data:  () => window.GZ?.data || {},
  role:  () => window.GZ?.data?.role || 'vatandas',
  main:  () => document.getElementById('appMain'),
  db:    async (path) => { try { return (await window.db.ref(path).once('value')).val(); } catch(e) { return null; } },
  set:   async (path, val) => window.db.ref(path).set(val),
  upd:   async (path, obj) => window.db.ref(path).update(obj),
  push:  async (path, val) => window.db.ref(path).push(val),
  tx:    async (path, fn)  => window.db.ref(path).transaction(fn),
  fmt:   (n) => (typeof cashFmt === 'function' ? cashFmt(n) : (n||0).toLocaleString('tr-TR') + '₺'),
  toast: (msg, type, ms) => typeof toast === 'function' && toast(msg, type || 'info', ms || 4000),
  news:  async (title, type, impact) => {
    await window.RS.push('news', { title, type: type||'genel', impact: impact||'neutral', ts: Date.now() });
  },
};

/* ══════════════════════════════════════════════════════════════════════════
   BÖLÜM 1 — ROL KİLİDİ SİSTEMİ
   Her rol kendi menüsünü görür; başkasının paneline erişemez
   ══════════════════════════════════════════════════════════════════════════ */

/* Rol → erişebileceği sekmeler */
const RS_ROL_ERİŞİM = {
  vatandas:   ['dukkan','banka','pazar','ihracat','kripto','borsa','maden','bahce','ciftlik',
               'fabrika','lojistik','ihale','marka','liderlik','haberler','sehirler','magaza',
               'hikaye','oyunlar','gorevler','basarimlar','profil','cuzdan','kredi','vergi',
               'egitim','muhtarlik','belediye','secim'],
  esnaf:      ['dukkan','banka','pazar','ihracat','ihale','lojistik','marka','bahce','ciftlik',
               'fabrika','maden','kripto','borsa','liderlik','magaza','gorevler','basarimlar',
               'profil','cuzdan','kredi','vergi','muhtarlik','belediye','secim','haberler'],
  banker:     ['banka','borsa','kripto','tahvil','futures','hedgefon','ihracat','liderlik',
               'magaza','profil','cuzdan','kredi','vergi','muhtarlik','haberler','secim'],
  police:     ['polis','muhtarlik','mahkeme','noter','liderlik','profil','cuzdan','haberler',
               'belediye','askeriye','gorevler'],
  soldier:    ['askeriye','polis','muhtarlik','sahilguz','jandarma','liderlik','profil','cuzdan','haberler'],
  judge:      ['mahkeme','noter','polis','muhtarlik','liderlik','profil','cuzdan','haberler'],
  muhtar:     ['muhtarlik','belediye','sgk','noter','polis','mahkeme','liderlik','haberler',
               'profil','cuzdan','sehirler','secim'],
  mayor:      ['belediye','muhtarlik','sgk','polis','noter','mahkeme','ihale','liderlik',
               'haberler','profil','cuzdan','sehirler','secim'],
  mp:         ['basbakanlik','belediye','secim','muhtarlik','liderlik','haberler','profil','cuzdan'],
  pm:         ['basbakanlik','belediye','muhtarlik','secim','sgk','polis','mahkeme','liderlik',
               'haberler','profil','cuzdan','sehirler'],
  president:  null, // null = HER ŞEYE erişir
};

/* Rol → sadece bu rolün YÖNETIM PANELİ var (diğer ticaret sekmeleri gizlenir) */
const RS_YONETİM_ROLLERI = ['muhtar','mayor','mp','pm','president','police','soldier','judge'];

/* Erişim kontrolü — sekme açılmadan önce çağrılır */
window.RS_erişimKontrol = function(tab) {
  const role = RS.role();
  if (role === 'president' || RS.data().isFounder) return true; // Tam yetki
  const izinler = RS_ROL_ERİŞİM[role];
  if (!izinler) return true;
  if (!izinler.includes(tab)) {
    RS.toast(`🚫 Bu sekmeye ${role} rolüyle erişemezsiniz.`, 'error', 3000);
    return false;
  }
  return true;
};

/* Erişim kontrolü — render patch KALDIRILDI (admin ekranı siyah yapıyordu)
   Erişim kontrolü artık sadece RS_erişimKontrol() çağrısıyla manuel yapılır */

/* ══════════════════════════════════════════════════════════════════════════
   BÖLÜM 2 — MUHTARİLİK TAM SİSTEMİ
   ══════════════════════════════════════════════════════════════════════════ */

/* 250 Altyapı Şikayet Kategorisi */
const RS_ŞİKAYET_KATEGORİLERİ = [
  // YOLLAR (1-40)
  {id:'yol_cukur',        grup:'🛣️ Yollar',      label:'Çukurlu Yol',            oncelik:'yüksek'},
  {id:'yol_bozuk',        grup:'🛣️ Yollar',      label:'Bozuk Asfalt',           oncelik:'orta'},
  {id:'yol_kaldirim',     grup:'🛣️ Yollar',      label:'Kaldırım Hasarı',        oncelik:'orta'},
  {id:'yol_levha',        grup:'🛣️ Yollar',      label:'Eksik Trafik Levhası',   oncelik:'yüksek'},
  {id:'yol_isik',         grup:'🛣️ Yollar',      label:'Trafik Işığı Arızası',   oncelik:'acil'},
  {id:'yol_kasis',        grup:'🛣️ Yollar',      label:'Hız Kesici Yok',         oncelik:'orta'},
  {id:'yol_refuj',        grup:'🛣️ Yollar',      label:'Refüj Bakımsız',         oncelik:'düşük'},
  {id:'yol_isaret',       grup:'🛣️ Yollar',      label:'Yol Çizgisi Silik',      oncelik:'orta'},
  {id:'yol_kar',          grup:'🛣️ Yollar',      label:'Kış Bakımı Yapılmıyor',  oncelik:'yüksek'},
  {id:'yol_sel',          grup:'🛣️ Yollar',      label:'Sel Baskını',            oncelik:'acil'},
  // KÖPRÜLER & GEÇİTLER (11-25)
  {id:'kopru_hasarli',    grup:'🌉 Köprüler',    label:'Köprü Hasarı',           oncelik:'acil'},
  {id:'kopru_korkuluk',   grup:'🌉 Köprüler',    label:'Korkuluk Kırık',         oncelik:'yüksek'},
  {id:'kopru_bant',       grup:'🌉 Köprüler',    label:'Bant Tutmuyor',          oncelik:'orta'},
  {id:'kopru_islak',      grup:'🌉 Köprüler',    label:'Islak Zemin Tehlikeli',  oncelik:'yüksek'},
  {id:'gecit_yaya',       grup:'🌉 Köprüler',    label:'Yaya Geçidi Yok',        oncelik:'yüksek'},
  // SU & KANALİZASYON (26-50)
  {id:'su_kesintisi',     grup:'💧 Su',           label:'Su Kesintisi',           oncelik:'acil'},
  {id:'su_kirli',         grup:'💧 Su',           label:'Kirli/Renkli Su',        oncelik:'acil'},
  {id:'su_boru_patlamasi',grup:'💧 Su',           label:'Boru Patlaması',         oncelik:'acil'},
  {id:'su_dusuk_basinc',  grup:'💧 Su',           label:'Düşük Su Basıncı',       oncelik:'yüksek'},
  {id:'su_israf',         grup:'💧 Su',           label:'Kayıp-Kaçak Su',         oncelik:'orta'},
  {id:'kanal_tikali',     grup:'💧 Su',           label:'Tıkalı Kanalizasyon',    oncelik:'acil'},
  {id:'kanal_koku',       grup:'💧 Su',           label:'Kötü Koku',              oncelik:'yüksek'},
  {id:'kanal_tasma',      grup:'💧 Su',           label:'Kanalizasyon Taşması',   oncelik:'acil'},
  {id:'yagmur_drenaj',    grup:'💧 Su',           label:'Yağmursuyu Drenaj Yok',  oncelik:'orta'},
  // ELEKTRİK (51-70)
  {id:'elek_kesintisi',   grup:'⚡ Elektrik',     label:'Elektrik Kesintisi',     oncelik:'acil'},
  {id:'elek_kablo',       grup:'⚡ Elektrik',     label:'Açıkta Kablo',           oncelik:'acil'},
  {id:'elek_direk',       grup:'⚡ Elektrik',     label:'Eğik/Hasarlı Direk',     oncelik:'yüksek'},
  {id:'elek_aydinlatma',  grup:'⚡ Elektrik',     label:'Sokak Lambası Arızası',  oncelik:'yüksek'},
  {id:'elek_sayac',       grup:'⚡ Elektrik',     label:'Sayaç Sorunu',           oncelik:'orta'},
  {id:'elek_voltaj',      grup:'⚡ Elektrik',     label:'Voltaj Dalgalanması',    oncelik:'yüksek'},
  // ÇEVRE & TEMİZLİK (71-100)
  {id:'cop_toplanmiyor',  grup:'🗑️ Çevre',       label:'Çöp Toplanmıyor',        oncelik:'yüksek'},
  {id:'cop_konteyner',    grup:'🗑️ Çevre',       label:'Konteyner Taşıyor',      oncelik:'orta'},
  {id:'cop_kaçak_doküm',  grup:'🗑️ Çevre',       label:'Kaçak Çöp Dökümü',       oncelik:'yüksek'},
  {id:'cop_geri_donusum', grup:'🗑️ Çevre',       label:'Geri Dönüşüm Kutusu Yok',oncelik:'düşük'},
  {id:'hava_is_dumanı',   grup:'🗑️ Çevre',       label:'Fabrika Dumanı',         oncelik:'yüksek'},
  {id:'gurultu_gece',     grup:'🗑️ Çevre',       label:'Gece Gürültüsü',         oncelik:'orta'},
  {id:'gurultu_is',       grup:'🗑️ Çevre',       label:'Şantiye Gürültüsü',      oncelik:'orta'},
  {id:'yasadisi_yapilas', grup:'🗑️ Çevre',       label:'Kaçak Yapılaşma',        oncelik:'yüksek'},
  // PARK & BAHÇE (101-115)
  {id:'park_bakimsiz',    grup:'🌳 Park/Bahçe',  label:'Park Bakımsız',          oncelik:'düşük'},
  {id:'park_oyun_araç',   grup:'🌳 Park/Bahçe',  label:'Oyun Grubu Kırık',       oncelik:'yüksek'},
  {id:'park_aydınlatma',  grup:'🌳 Park/Bahçe',  label:'Park Aydınlatması Yok',  oncelik:'orta'},
  {id:'agac_kesim',       grup:'🌳 Park/Bahçe',  label:'İzinsiz Ağaç Kesimi',    oncelik:'yüksek'},
  {id:'yesil_alan',       grup:'🌳 Park/Bahçe',  label:'Yeşil Alan Azalıyor',    oncelik:'orta'},
  // ULAŞIM (116-135)
  {id:'ulas_otobüs',      grup:'🚌 Ulaşım',      label:'Otobüs Seferi Azaldı',   oncelik:'orta'},
  {id:'ulas_durak',       grup:'🚌 Ulaşım',      label:'Durak Yok/Hasarlı',      oncelik:'orta'},
  {id:'ulas_engelli',     grup:'🚌 Ulaşım',      label:'Engelli Rampa Yok',      oncelik:'yüksek'},
  {id:'ulas_trafik',      grup:'🚌 Ulaşım',      label:'Trafik Sorunu',          oncelik:'orta'},
  {id:'ulas_otopark',     grup:'🚌 Ulaşım',      label:'Otopark Yetersiz',       oncelik:'düşük'},
  // SAĞLIK (136-155)
  {id:'saglik_asfv',      grup:'🏥 Sağlık',      label:'ASM Kapalı/Yetersiz',    oncelik:'acil'},
  {id:'saglik_ambulans',  grup:'🏥 Sağlık',      label:'Ambulans Gelmedi',       oncelik:'acil'},
  {id:'saglik_ilac',      grup:'🏥 Sağlık',      label:'İlaç Bulunamıyor',       oncelik:'yüksek'},
  {id:'saglik_hastane',   grup:'🏥 Sağlık',      label:'Hastane Kapasitesi Yok', oncelik:'yüksek'},
  {id:'saglik_hijyen',    grup:'🏥 Sağlık',      label:'Hijyen Sorunu',          oncelik:'yüksek'},
  // EĞİTİM (156-170)
  {id:'egitim_okul',      grup:'📚 Eğitim',      label:'Okul Yetersiz/Hasarlı',  oncelik:'yüksek'},
  {id:'egitim_ogretmen',  grup:'📚 Eğitim',      label:'Öğretmen Eksikliği',     oncelik:'yüksek'},
  {id:'egitim_ulasim',    grup:'📚 Eğitim',      label:'Okul Servisi Yok',       oncelik:'orta'},
  {id:'egitim_internet',  grup:'📚 Eğitim',      label:'İnternet Altyapısı Yok', oncelik:'orta'},
  // GÜVENLİK (171-185)
  {id:'guv_aydinlatma',   grup:'🔒 Güvenlik',    label:'Karanlık Sokak',         oncelik:'yüksek'},
  {id:'guv_kamera',       grup:'🔒 Güvenlik',    label:'Güvenlik Kamerası Yok',  oncelik:'orta'},
  {id:'guv_hirsizlik',    grup:'🔒 Güvenlik',    label:'Hırsızlık Şikayeti',     oncelik:'yüksek'},
  {id:'guv_uyusturucu',   grup:'🔒 Güvenlik',    label:'Uyuşturucu Şikayeti',    oncelik:'acil'},
  {id:'guv_kovusturma',   grup:'🔒 Güvenlik',    label:'Kovuşturma Yapılmıyor',  oncelik:'yüksek'},
  // HAYVAN (186-195)
  {id:'hayvan_sokak',     grup:'🐕 Hayvanlar',   label:'Başıboş Hayvan Sorunu',  oncelik:'orta'},
  {id:'hayvan_kuduz',     grup:'🐕 Hayvanlar',   label:'Kuduz/Hastalık Şüphesi', oncelik:'acil'},
  {id:'hayvan_kedi_mama', grup:'🐕 Hayvanlar',   label:'Mama İstasyonu Yok',     oncelik:'düşük'},
  // SOSYAL (196-215)
  {id:'sosyal_yoksul',    grup:'🤝 Sosyal',      label:'Yoksulluk Artıyor',      oncelik:'yüksek'},
  {id:'sosyal_barınak',   grup:'🤝 Sosyal',      label:'Barınak Yetersiz',       oncelik:'yüksek'},
  {id:'sosyal_engelli',   grup:'🤝 Sosyal',      label:'Engelli Hakları İhlali', oncelik:'yüksek'},
  {id:'sosyal_yasli',     grup:'🤝 Sosyal',      label:'Yaşlı Bakımı Yetersiz',  oncelik:'yüksek'},
  {id:'sosyal_cocuk',     grup:'🤝 Sosyal',      label:'Çocuk İstismarı',        oncelik:'acil'},
  // ESNAF & TİCARET ŞİKAYETLERİ (216-235)
  {id:'tic_kaçak_satis',  grup:'🏪 Ticaret',     label:'Kaçak Satış',            oncelik:'orta'},
  {id:'tic_fahis_fiyat',  grup:'🏪 Ticaret',     label:'Fahiş Fiyat',            oncelik:'yüksek'},
  {id:'tic_vergi_kacak',  grup:'🏪 Ticaret',     label:'Vergi Kaçakçılığı',      oncelik:'yüksek'},
  {id:'tic_etiket_yok',   grup:'🏪 Ticaret',     label:'Etiket/Fatura Yok',      oncelik:'orta'},
  {id:'tic_sahte_urun',   grup:'🏪 Ticaret',     label:'Sahte Ürün Satışı',      oncelik:'acil'},
  // İMAR & YAPI (236-250)
  {id:'imar_ruhsatsiz',   grup:'🏗️ İmar',        label:'Ruhsatsız Yapı',         oncelik:'yüksek'},
  {id:'imar_yikim',       grup:'🏗️ İmar',        label:'Yeşil Alan Yıkılıyor',   oncelik:'yüksek'},
  {id:'imar_is_guvenligi',grup:'🏗️ İmar',        label:'İş Güvenliği İhlali',    oncelik:'acil'},
  {id:'imar_tarihi',      grup:'🏗️ İmar',        label:'Tarihi Yapı Zarar Görüyor',oncelik:'yüksek'},
  {id:'imar_deprem',      grup:'🏗️ İmar',        label:'Depreme Dayanıksız Bina',oncelik:'acil'},
];
window.RS_ŞİKAYET_KATEGORİLERİ = RS_ŞİKAYET_KATEGORİLERİ;

/* Şikayet Gönder */
window.RS_sikayetGonder = async function(uid, kategoriId, detay, mahalle) {
  const kat = RS_ŞİKAYET_KATEGORİLERİ.find(k => k.id === kategoriId);
  if (!kat) return RS.toast('Geçersiz şikayet kategorisi', 'error');
  const d   = await RS.db(`users/${uid}`) || {};
  const prov= d.province || 'İstanbul';

  // Aynı şikayeti bu ay daha önce gönderdi mi?
  const ayKey = new Date().toISOString().slice(0,7);
  const varMi = await RS.db(`sikayetler/${prov}/${ayKey}/${uid}_${kategoriId}`);
  if (varMi) return RS.toast('Bu şikayeti bu ay zaten gönderdiniz.', 'warn');

  const sikayet = {
    uid, username: d.username || '—',
    kategoriId, label: kat.label, grup: kat.grup,
    oncelik: kat.oncelik, detay: (detay || '').slice(0, 500),
    mahalle: mahalle || d.mahalle || 'Genel',
    il: prov, durum: 'beklemede',
    ts: Date.now(),
  };

  await RS.push(`sikayetler/${prov}/${ayKey}`, sikayet);
  await RS.push(`sikayetler_muhtar/${prov}`, sikayet); // Muhtar görsün

  // XP ver
  if (typeof addXP === 'function') addXP(uid, 10);
  RS.toast(`📋 Şikayetiniz muhtara iletildi: ${kat.label}`, 'success', 5000);
};

/* Muhtar'ın şikayetleri görmesi */
window.RS_muhtarSikayetleri = async function(uid) {
  const d   = await RS.db(`users/${uid}`) || {};
  const rol = d.role;
  if (rol !== 'muhtar') return RS.toast('Sadece muhtar şikayetleri görebilir.', 'error');
  const prov = d.province || 'İstanbul';
  const raw  = await RS.db(`sikayetler_muhtar/${prov}`) || {};
  return Object.entries(raw)
    .map(([k,v]) => ({...v, _key: k}))
    .sort((a,b) => {
      const p = {acil:4,yüksek:3,orta:2,düşük:1};
      return (p[b.oncelik]||0) - (p[a.oncelik]||0) || b.ts - a.ts;
    });
};

/* Muhtar → belediyeye başvuru */
window.RS_muhtarBelBasvuru = async function(muhtarUid, sikayetKey, aciklama) {
  const d    = await RS.db(`users/${muhtarUid}`) || {};
  if (d.role !== 'muhtar') return RS.toast('Sadece muhtar başvuru yapabilir.', 'error');
  const prov = d.province || 'İstanbul';

  // Belediye başkanı var mı?
  const mayorUid = await RS.db(`politics/${prov}/mayor`);
  if (!mayorUid) {
    RS.toast('Bu ilde belediye başkanı henüz seçilmedi. Başvuru devlet merkezine iletildi.', 'warn', 6000);
    await RS.push('merkez_basvurular', {
      tip: 'altyapi', il: prov, muhtarUid, aciklama: aciklama || '—',
      sikayetKey, ts: Date.now(), durum: 'merkeze_iletildi',
    });
    return;
  }

  await RS.push(`belediye_basvurular/${prov}`, {
    muhtarUid, muhtarName: d.username || '—',
    sikayetKey, aciklama: aciklama || '—',
    durum: 'beklemede', ts: Date.now(),
  });

  // Belediye başkanına bildir
  if (typeof window.GZX_notify === 'function') {
    window.GZX_notify(mayorUid,
      `🏛️ ${d.username} Muhtarından yeni altyapı başvurusu! Detay: ${(aciklama||'').slice(0,80)}`,
      'info');
  }
  RS.toast('✅ Belediyeye başvurunuz iletildi!', 'success', 5000);
};

/* Muhtar rüşvet al → yakalanma riski */
window.RS_muhtarRusvet = async function(muhtarUid, tarafUid, miktar, tip) {
  const d    = await RS.db(`users/${muhtarUid}`) || {};
  if (d.role !== 'muhtar') return RS.toast('Sadece muhtar rüşvet sisteminde yer alabilir.', 'error');
  const prov = d.province || 'İstanbul';

  // Yakalanma olasılığı: Miktar arttıkça yükselir
  const catchChance = Math.min(0.92, 0.10 + (miktar / 500000) * 0.6);
  if (Math.random() < catchChance) {
    // YAKALANDI — mahkeme süreci başlat
    const ceza = miktar * 5;
    await RS.push('mahkeme_davalari', {
      sanik: muhtarUid, sanikName: d.username,
      sucTipi: 'rüşvet', sucDetay: `${tip || 'Kimlik işlemleri'} karşılığı ${RS.fmt(miktar)} rüşvet`,
      cezaMiktari: ceza, durum: 'sorusturma', ts: Date.now(), il: prov,
    });

    // Muhtarı görevden al — vatandaşa düşür
    await RS.upd(`users/${muhtarUid}`, {
      role: 'vatandas', rusvetTespiti: Date.now(),
      gorevBitisi: Date.now(), criminalRecord: (d.criminalRecord || 0) + 3,
    });
    if (window.GZ?.uid === muhtarUid && window.GZ?.data) {
      window.GZ.data.role = 'vatandas';
    }

    // Ceza kes
    if (typeof spendCash === 'function') spendCash(muhtarUid, ceza, 'rüşvet-cezası');

    RS.toast(`🚔 RÜŞVET TESPİT EDİLDİ! Görevden alındınız. Ceza: ${RS.fmt(ceza)}`, 'error', 10000);
    await RS.news(`🚨 ${d.username} muhtarı rüşvet almaktan görevden alındı!`, 'rüşvet', 'negative');
    return { yakalandi: true, ceza };
  }

  // Yakalanmadı
  if (typeof addCash === 'function') addCash(muhtarUid, miktar, 'rüşvet-alınan');
  RS.toast(`🤫 Rüşvet alındı. Risk: %${Math.round(catchChance * 100)}`, 'warn', 6000);
  return { yakalandi: false };
};

/* Muhtar Panel — tam versiyon */
window.RS_renderMuhtarPanel = async function() {
  const main = RS.main(); if (!main) return;
  const uid  = RS.uid();  if (!uid)  return;
  const d    = await RS.db(`users/${uid}`) || {};
  const isMuhtar = (d.role === 'muhtar');
  const prov = d.province || 'İstanbul';

  // Şikayet listesini çek (muhtar ise)
  let sikayetHTML = '';
  if (isMuhtar) {
    const list = await window.RS_muhtarSikayetleri(uid).catch(() => []);
    const oncelikRenk = {acil:'#ef4444',yüksek:'#f97316',orta:'#eab308',düşük:'#22c55e'};
    sikayetHTML = `
      <div style="margin-bottom:16px">
        <div style="font-size:13px;font-weight:700;color:#e2e8f0;margin-bottom:10px">
          📋 Gelen Şikayetler (${list.length})
        </div>
        ${list.length === 0
          ? '<div style="background:#0d1829;border-radius:10px;padding:20px;text-align:center;color:#64748b;font-size:12px">Henüz şikayet yok</div>'
          : list.slice(0, 15).map(s => `
            <div style="background:#0d1829;border:1px solid #1e3a5f;border-radius:10px;padding:12px;margin-bottom:8px">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
                <div style="flex:1">
                  <div style="font-size:12px;font-weight:700;color:#e2e8f0">${s.grup} — ${s.label}</div>
                  <div style="font-size:11px;color:#64748b;margin-top:2px">${s.mahalle} · ${new Date(s.ts).toLocaleDateString('tr-TR')}</div>
                  ${s.detay ? `<div style="font-size:11px;color:#94a3b8;margin-top:4px">"${s.detay.slice(0,100)}"</div>` : ''}
                </div>
                <span style="background:${oncelikRenk[s.oncelik]}22;color:${oncelikRenk[s.oncelik]};
                  font-size:9px;font-weight:800;padding:2px 8px;border-radius:999px;white-space:nowrap;flex-shrink:0">
                  ${s.oncelik.toUpperCase()}
                </span>
              </div>
              <div style="display:flex;gap:6px;margin-top:10px">
                <button onclick="(async()=>{
                  const ac=prompt('Belediyeye iletme açıklaması:');
                  if(ac!==null) await window.RS_muhtarBelBasvuru('${uid}','${s._key}',ac);
                })()" style="flex:1;background:#3b82f622;color:#3b82f6;border:1px solid #3b82f644;
                  border-radius:8px;padding:8px;font-size:11px;font-weight:700;cursor:pointer">
                  🏙️ Belediyeye İlet
                </button>
                <button onclick="db.ref('sikayetler_muhtar/${prov}/${s._key}/durum').set('cozuldu').then(()=>window.RS_renderMuhtarPanel())"
                  style="flex:1;background:#22c55e22;color:#22c55e;border:1px solid #22c55e44;
                  border-radius:8px;padding:8px;font-size:11px;font-weight:700;cursor:pointer">
                  ✅ Çözüldü
                </button>
              </div>
            </div>`).join('')
        }
      </div>`;
  }

  // Şikayet gönderme formu (tüm vatandaşlar için)
  const gruplar = [...new Set(RS_ŞİKAYET_KATEGORİLERİ.map(k => k.grup))];
  const sikayetFormHTML = `
    <div style="background:#0d1829;border:1px solid #1e3a5f;border-radius:12px;padding:16px;margin-bottom:16px">
      <div style="font-size:13px;font-weight:700;color:#e2e8f0;margin-bottom:12px">📢 Şikayet Bildir</div>
      <select id="rs_grup" onchange="(()=>{
        const g=this.value;
        const kats=window.RS_ŞİKAYET_KATEGORİLERİ.filter(k=>k.grup===g);
        const sel=document.getElementById('rs_kat');
        sel.innerHTML=kats.map(k=>'<option value=\"'+k.id+'\">'+k.label+'</option>').join('');
        document.getElementById('rs_oncelik').textContent='Öncelik: '+kats[0]?.oncelik?.toUpperCase();
      })()" style="width:100%;padding:10px;background:#080d1a;border:1px solid #1e3a5f;border-radius:8px;color:#e2e8f0;font-size:13px;margin-bottom:8px">
        ${gruplar.map(g => `<option value="${g}">${g}</option>`).join('')}
      </select>
      <select id="rs_kat" style="width:100%;padding:10px;background:#080d1a;border:1px solid #1e3a5f;border-radius:8px;color:#e2e8f0;font-size:13px;margin-bottom:8px">
        ${RS_ŞİKAYET_KATEGORİLERİ.filter(k => k.grup === gruplar[0]).map(k => `<option value="${k.id}">${k.label}</option>`).join('')}
      </select>
      <div id="rs_oncelik" style="font-size:10px;color:#f97316;margin-bottom:8px;font-weight:700"></div>
      <input id="rs_detay" placeholder="Detay açıklama (isteğe bağlı, max 500 karakter)"
        style="width:100%;padding:10px;background:#080d1a;border:1px solid #1e3a5f;border-radius:8px;color:#e2e8f0;font-size:12px;margin-bottom:8px;box-sizing:border-box">
      <input id="rs_mahalle" placeholder="Mahalle / Cadde adı"
        style="width:100%;padding:10px;background:#080d1a;border:1px solid #1e3a5f;border-radius:8px;color:#e2e8f0;font-size:12px;margin-bottom:12px;box-sizing:border-box">
      <button onclick="(async()=>{
        const kat=document.getElementById('rs_kat')?.value;
        const detay=document.getElementById('rs_detay')?.value;
        const mah=document.getElementById('rs_mahalle')?.value;
        await window.RS_sikayetGonder('${uid}',kat,detay,mah);
      })()" style="width:100%;background:#3b82f6;color:white;border:none;border-radius:10px;padding:14px;font-weight:800;cursor:pointer">
        📋 Şikayeti Gönder
      </button>
    </div>`;

  main.innerHTML = `
    <div style="padding:0 0 80px">
      <div style="background:linear-gradient(135deg,#4c1d95,#6d28d9);padding:20px 16px 16px">
        <div style="font-size:18px;font-weight:900;color:white">🏛️ Muhtarlık</div>
        <div style="font-size:12px;color:#c4b5fd;margin-top:2px">${prov} ${isMuhtar ? '· Muhtar Paneli' : '· Vatandaş Başvuruları'}</div>
        ${isMuhtar ? `<div style="background:#ffffff22;border-radius:8px;padding:8px 12px;margin-top:10px;font-size:12px;color:#e9d5ff">
          <b>Görev bitiş:</b> ${d.gorevBitisi ? new Date(d.gorevBitisi).toLocaleDateString('tr-TR') : '—'}
          · <b>Maaş:</b> ${RS.fmt(d.muhtarMaas || 15000)}/ay
        </div>` : ''}
      </div>
      <div style="padding:16px">
        ${isMuhtar ? sikayetHTML : ''}
        ${sikayetFormHTML}
        ${isMuhtar ? `
        <div style="background:#0d1829;border:1px solid #1e3a5f;border-radius:12px;padding:16px;margin-bottom:16px">
          <div style="font-size:13px;font-weight:700;color:#e2e8f0;margin-bottom:12px">⚙️ Muhtar Yetkileri</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            <button onclick="if(typeof renderMuhtarlik==='function') renderMuhtarlik()"
              style="background:#8b5cf622;color:#8b5cf6;border:1px solid #8b5cf644;border-radius:10px;padding:12px;font-size:12px;font-weight:700;cursor:pointer">
              🪪 Kimlik İşlemleri
            </button>
            <button onclick="(()=>{const m=prompt('Duyuru metni:');if(m&&typeof GZX_R05_cityAnnouncement==='function') GZX_R05_cityAnnouncement('${uid}',m,'${prov}').then(()=>RS.toast('📢 Duyuru yayınlandı','success'));})()"
              style="background:#eab30822;color:#eab308;border:1px solid #eab30844;border-radius:10px;padding:12px;font-size:12px;font-weight:700;cursor:pointer">
              📢 Mahalle Duyurusu
            </button>
            <button onclick="(async()=>{const m=prompt('Sosyal yardım miktarı (₺)?');if(!m)return;const users=await dbGet('users')||{};const uygun=Object.entries(users).filter(([,u])=>u.province==='${prov}'&&(u.money||u.bakiye||0)<5000);if(uygun.length===0)return toast('Yardım gereken kimse bulunamadı','info');for(const[tuid]of uygun)await addCash(tuid,parseInt(m)||1000,'sosyal-yardım');toast('✅ '+uygun.length+' kişiye yardım yapıldı','success',5000);})()"
              style="background:#22c55e22;color:#22c55e;border:1px solid #22c55e44;border-radius:10px;padding:12px;font-size:12px;font-weight:700;cursor:pointer">
              💰 Sosyal Yardım Dağıt
            </button>
            <button onclick="(async()=>{const hedef=prompt('Hedef oyuncu kullanıcı adı:');if(!hedef)return;const users=await dbGet('users')||{};const found=Object.entries(users).find(([,u])=>u.username===hedef);if(!found)return toast('Oyuncu bulunamadı','error');const m=parseInt(prompt('Rüşvet miktarı (₺)?')||0);if(m>0)await window.RS_muhtarRusvet('${uid}',found[0],m,'Test')})()"
              style="background:#ef444422;color:#ef4444;border:1px solid #ef444444;border-radius:10px;padding:12px;font-size:12px;font-weight:700;cursor:pointer">
              🤫 Rüşvet Al (Riskli!)
            </button>
          </div>
        </div>` : ''}
      </div>
    </div>`;
};
window.renderMuhtarPanel = window.RS_renderMuhtarPanel;

/* ══════════════════════════════════════════════════════════════════════════
   BÖLÜM 3 — BELEDİYE BAŞKANI TAM PANELİ
   ══════════════════════════════════════════════════════════════════════════ */

window.RS_renderBelediyeBaskanPanel = async function() {
  const main = RS.main(); if (!main) return;
  const uid  = RS.uid();  if (!uid)  return;
  const d    = await RS.db(`users/${uid}`) || {};
  const prov = d.province || d.mayorOf || 'İstanbul';
  const isMayor = (d.role === 'mayor' || d.mayorOf === prov);

  if (!isMayor) {
    // Vatandaş olarak Belediye paneline girdi → normal renderBelediye yeterli
    if (typeof renderBelediye === 'function') return renderBelediye();
    return;
  }

  const belBudget = (await RS.db(`politics/${prov}/belediyeBudgeti`)) || 0;
  const basvurular = await RS.db(`belediye_basvurular/${prov}`) || {};
  const basvuruList = Object.entries(basvurular)
    .map(([k,v]) => ({...v,_key:k}))
    .filter(v => v.durum === 'beklemede')
    .sort((a,b) => b.ts - a.ts);

  const RUHSAT_UCRET = {dukkan:15000,restaurant:35000,market:25000,fabrika:100000,cafe:20000,otel:500000,hastane:2000000};
  const ALTYAPI_MALIYETLER = [
    {id:'yol',    label:'🛣️ Yol Onarım',        maliyet:250000},
    {id:'su',     label:'💧 Su Şebekesi',        maliyet:500000},
    {id:'park',   label:'🌳 Park Yapımı',         maliyet:150000},
    {id:'okul',   label:'📚 Okul Onarımı',        maliyet:1000000},
    {id:'ulas',   label:'🚌 Toplu Taşıma',        maliyet:300000},
    {id:'aydinlat',label:'💡 Sokak Aydınlatması', maliyet:80000},
  ];

  main.innerHTML = `
    <div style="padding:0 0 80px">
      <div style="background:linear-gradient(135deg,#0c4a6e,#0369a1);padding:20px 16px 16px">
        <div style="font-size:18px;font-weight:900;color:white">🏙️ Belediye Başkanlığı</div>
        <div style="font-size:12px;color:#bae6fd;margin-top:2px">${prov} Belediyesi</div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:12px">
          <div style="background:#ffffff22;border-radius:8px;padding:10px;text-align:center">
            <div style="font-size:9px;color:#bae6fd">BELEDİYE BÜTÇESİ</div>
            <div style="font-size:15px;font-weight:900;color:white">${RS.fmt(belBudget)}</div>
          </div>
          <div style="background:#ffffff22;border-radius:8px;padding:10px;text-align:center">
            <div style="font-size:9px;color:#bae6fd">BEKLEYEN BAŞVURU</div>
            <div style="font-size:22px;font-weight:900;color:white">${basvuruList.length}</div>
          </div>
          <div style="background:#ffffff22;border-radius:8px;padding:10px;text-align:center">
            <div style="font-size:9px;color:#bae6fd">MAAŞ</div>
            <div style="font-size:15px;font-weight:900;color:white">${RS.fmt(d.belediyeMaas || 45000)}/ay</div>
          </div>
        </div>
      </div>
      <div style="padding:16px">

        <!-- Muhtar Başvuruları -->
        <div style="background:#0d1829;border:1px solid #1e3a5f;border-radius:12px;padding:16px;margin-bottom:16px">
          <div style="font-size:13px;font-weight:700;color:#e2e8f0;margin-bottom:12px">
            📋 Muhtar Başvuruları (${basvuruList.length})
          </div>
          ${basvuruList.length === 0
            ? '<div style="text-align:center;color:#64748b;font-size:12px;padding:16px">Bekleyen başvuru yok</div>'
            : basvuruList.slice(0,10).map(b => `
              <div style="background:#080d1a;border-radius:10px;padding:12px;margin-bottom:8px">
                <div style="font-size:12px;font-weight:700;color:#e2e8f0">${b.muhtarName} muhtarından</div>
                <div style="font-size:11px;color:#94a3b8;margin:4px 0">"${(b.aciklama||'—').slice(0,120)}"</div>
                <div style="font-size:10px;color:#64748b">${new Date(b.ts).toLocaleDateString('tr-TR')}</div>
                <div style="display:flex;gap:6px;margin-top:10px">
                  <button onclick="(async()=>{
                    const miktar=parseInt(prompt('Bütçeden ne kadar ayrılsın (₺)?')||0);
                    if(!miktar)return;
                    const bud=await RS.db('politics/${prov}/belediyeBudgeti')||0;
                    if(bud<miktar){
                      const onay=confirm('Bütçe yetersiz! Devlet merkezine mi iletilsin?');
                      if(onay){
                        await RS.push('merkez_basvurular',{tip:'belediye',il:'${prov}',basvuruKey:'${b._key}',miktar,ts:Date.now()});
                        toast('📤 Devlet merkezine iletildi','info');
                      }
                    } else {
                      await db.ref('politics/${prov}/belediyeBudgeti').transaction(c=>(c||0)-miktar);
                      await db.ref('belediye_basvurular/${prov}/${b._key}/durum').set('onaylandi');
                      await RS.news('🏙️ ${prov} belediyesi altyapı yatırımı: '+cashFmt(miktar),'yatirim','positive');
                      toast('✅ Başvuru onaylandı! '+RS.fmt(miktar)+' bütçeden ayrıldı','success',6000);
                      window.RS_renderBelediyeBaskanPanel();
                    }
                  })()" style="flex:1;background:#22c55e22;color:#22c55e;border:1px solid #22c55e44;border-radius:8px;padding:8px;font-size:11px;font-weight:700;cursor:pointer">
                    ✅ Onayla & Fon Ayır
                  </button>
                  <button onclick="db.ref('belediye_basvurular/${prov}/${b._key}/durum').set('reddedildi').then(()=>window.RS_renderBelediyeBaskanPanel())"
                    style="flex:1;background:#ef444422;color:#ef4444;border:1px solid #ef444444;border-radius:8px;padding:8px;font-size:11px;font-weight:700;cursor:pointer">
                    ❌ Reddet
                  </button>
                </div>
              </div>`).join('')
          }
        </div>

        <!-- Altyapı Projeleri -->
        <div style="background:#0d1829;border:1px solid #1e3a5f;border-radius:12px;padding:16px;margin-bottom:16px">
          <div style="font-size:13px;font-weight:700;color:#e2e8f0;margin-bottom:12px">🏗️ Altyapı Projeleri</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            ${ALTYAPI_MALIYETLER.map(a => `
              <button onclick="(async()=>{
                const bud=await RS.db('politics/${prov}/belediyeBudgeti')||0;
                if(bud<${a.maliyet}){
                  const k=confirm('Bütçe yetersiz (${RS.fmt(a.maliyet)}). Devlet merkezine iletilsin mi?');
                  if(k){await RS.push('merkez_basvurular',{tip:'altyapi_proje',proje:'${a.id}',il:'${prov}',ts:Date.now()});toast('📤 Merkeze iletildi','info');}
                } else {
                  await db.ref('politics/${prov}/belediyeBudgeti').transaction(c=>(c||0)-${a.maliyet});
                  await RS.push('belediye_projeler/${prov}',{tip:'${a.id}',label:'${a.label}',maliyet:${a.maliyet},baslangic:Date.now(),bitmeTarihi:Date.now()+7*86400000,durum:'devam_ediyor'});
                  await RS.news('🏗️ ${prov}: ${a.label} projesi başladı!','yatirim','positive');
                  toast('✅ ${a.label} projesi başlatıldı!','success',5000);
                }
              })()" style="background:#0369a122;color:#38bdf8;border:1px solid #0369a144;border-radius:10px;padding:12px;font-size:12px;font-weight:700;cursor:pointer;text-align:left">
                ${a.label}<br><small style="font-weight:400;color:#64748b">${RS.fmt(a.maliyet)}</small>
              </button>`).join('')}
          </div>
        </div>

        <!-- Vergi & Ruhsat Ayarları -->
        <div style="background:#0d1829;border:1px solid #1e3a5f;border-radius:12px;padding:16px;margin-bottom:16px">
          <div style="font-size:13px;font-weight:700;color:#e2e8f0;margin-bottom:12px">💼 Vergi & Ruhsat Yönetimi</div>
          <div style="margin-bottom:10px">
            <label style="font-size:11px;color:#94a3b8">İşletme Vergi Oranı (%)</label>
            <input id="bel_vergi" type="number" min="1" max="50" value="10"
              style="width:100%;padding:10px;background:#080d1a;border:1px solid #1e3a5f;border-radius:8px;color:#e2e8f0;font-size:13px;box-sizing:border-box;margin-top:4px">
          </div>
          <div style="margin-bottom:10px">
            <label style="font-size:11px;color:#94a3b8">Toplu Taşıma Bilet (₺)</label>
            <input id="bel_bilet" type="number" min="1" max="200" value="15"
              style="width:100%;padding:10px;background:#080d1a;border:1px solid #1e3a5f;border-radius:8px;color:#e2e8f0;font-size:13px;box-sizing:border-box;margin-top:4px">
          </div>
          <button onclick="(async()=>{
            const vr=parseInt(document.getElementById('bel_vergi')?.value||10)/100;
            const bilet=parseInt(document.getElementById('bel_bilet')?.value||15);
            await db.ref('politics/${prov}').update({isletmeVergi:vr,transitFare:bilet});
            await RS.news('🏙️ ${prov} Belediyesi vergi oranını güncelledi.','vergi','neutral');
            toast('✅ Vergi ve bilet fiyatı güncellendi!','success');
          })()" style="width:100%;background:#0369a1;color:white;border:none;border-radius:10px;padding:14px;font-weight:800;cursor:pointer">
            💾 Kaydet
          </button>
        </div>

        <!-- Belediye Bütçesine Para Ekle (devlet fonu) -->
        <div style="background:#0d1829;border:1px solid #1e3a5f;border-radius:12px;padding:16px">
          <div style="font-size:13px;font-weight:700;color:#e2e8f0;margin-bottom:12px">💰 Bütçe & Fonlar</div>
          <div style="font-size:12px;color:#64748b;margin-bottom:10px">
            Belediye bütçesi; işyeri vergileri, ruhsat ücretleri ve devlet transferinden oluşur.
            Başbakan veya Cumhurbaşkanı direkt fon aktarabilir.
          </div>
          <button onclick="(async()=>{
            const users=await dbGet('users')||{};
            const esnaflar=Object.entries(users).filter(([,u])=>u.province==='${prov}'&&['esnaf','banker'].includes(u.role));
            const vergiOrani=await RS.db('politics/${prov}/isletmeVergi')||0.10;
            let toplam=0;
            for(const[tuid,tu]of esnaflar){
              const bakiye=(tu.money||tu.bakiye||0);
              const vergi=Math.floor(bakiye*vergiOrani*0.01);
              if(vergi>0){
                await spendCash(tuid,vergi,'belediye-vergi');
                toplam+=vergi;
              }
            }
            await db.ref('politics/${prov}/belediyeBudgeti').transaction(c=>(c||0)+toplam);
            toast('💰 Vergi toplandı: '+RS.fmt(toplam),'success',5000);
            window.RS_renderBelediyeBaskanPanel();
          })()" style="width:100%;background:#22c55e22;color:#22c55e;border:1px solid #22c55e44;border-radius:10px;padding:12px;font-weight:700;cursor:pointer">
            🏦 İl Vergisini Topla
          </button>
        </div>

      </div>
    </div>`;
};

/* Belediye ve muhtar render override — adminScreen kontrolü ile */
(function patchBelediyeRender() {
  const _tryPatch = setInterval(() => {
    if (typeof window.render !== 'function') return;
    clearInterval(_tryPatch);
    const _prev = window.render;
    window.render = function(tab) {
      // Admin ekranı açıksa render yapma
      const adminScr = document.getElementById('adminScreen');
      if (adminScr && adminScr.style.display === 'flex') {
        if (typeof _prev === 'function') _prev(tab);
        return;
      }
      // GZ.data yüklü değilse direkt geç
      if (!window.GZ?.data) {
        if (typeof _prev === 'function') _prev(tab);
        return;
      }
      if (tab === 'belediye' && RS.role() === 'mayor') {
        window.RS_renderBelediyeBaskanPanel(); return;
      }
      if (tab === 'muhtarlik' && RS.role() === 'muhtar') {
        window.RS_renderMuhtarPanel(); return;
      }
      if (typeof _prev === 'function') _prev(tab);
    };
  }, 200);
})();

/* ══════════════════════════════════════════════════════════════════════════
   BÖLÜM 4 — BAŞBAKAN & CUMHURBAŞKANI PANELİ
   ══════════════════════════════════════════════════════════════════════════ */

window.RS_renderBBPanel = async function() {
  const main = RS.main(); if (!main) return;
  const uid  = RS.uid();  if (!uid)  return;
  const d    = await RS.db(`users/${uid}`) || {};
  const isYetkili = d.role === 'pm' || d.role === 'president' || d.isFounder;
  if (!isYetkili) {
    main.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:60vh;text-align:center;padding:32px">
      <div style="font-size:64px;margin-bottom:16px">🏛️</div>
      <div style="font-size:18px;font-weight:900;color:#e2e8f0">Yetki Gerekli</div>
      <div style="font-size:13px;color:#64748b;margin-top:8px">Bu panel yalnızca Başbakan, Cumhurbaşkanı ve kuruculara açıktır.</div>
      <button onclick="if(typeof render==='function') render('secim')" style="margin-top:16px;background:#3b82f6;color:white;border:none;border-radius:10px;padding:12px 24px;font-weight:700;cursor:pointer">
        🗳️ Seçime Katıl
      </button>
    </div>`;
    return;
  }

  const kdv      = (await RS.db('system/kdv')) || 0.20;
  const minWage  = (await RS.db('system/minWage')) || 17002;
  const repoRate = (await RS.db('bank/repoRate')) || 0.42;
  const hazine   = (await RS.db('system/hazine')) || 0;
  const isPresident = d.role === 'president' || d.isFounder;

  // 81 il bütçe durumu
  const ilBudgetler = {};
  for (const il of (window.ILLER_LIST || []).slice(0, 10)) {
    ilBudgetler[il] = (await RS.db(`politics/${il}/belediyeBudgeti`)) || 0;
  }

  // Devlet merkezine gelen başvurular
  const merkezBasvurular = await RS.db('merkez_basvurular') || {};
  const mBList = Object.entries(merkezBasvurular)
    .map(([k,v]) => ({...v,_key:k}))
    .filter(v => !v.islendi)
    .slice(0,10);

  main.innerHTML = `
    <div style="padding:0 0 80px">
      <div style="background:linear-gradient(135deg,#7f1d1d,#991b1b);padding:20px 16px 16px">
        <div style="font-size:18px;font-weight:900;color:white">${isPresident ? '🌟 Cumhurbaşkanlığı' : '🇹🇷 Başbakanlık'}</div>
        <div style="font-size:12px;color:#fca5a5;margin-top:2px">Ulusal Yönetim Merkezi</div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:12px">
          <div style="background:#ffffff22;border-radius:8px;padding:10px;text-align:center">
            <div style="font-size:9px;color:#fca5a5">HAZİNE</div>
            <div style="font-size:13px;font-weight:900;color:white">${RS.fmt(hazine)}</div>
          </div>
          <div style="background:#ffffff22;border-radius:8px;padding:10px;text-align:center">
            <div style="font-size:9px;color:#fca5a5">REPO FAİZİ</div>
            <div style="font-size:15px;font-weight:900;color:white">%${(repoRate*100).toFixed(1)}</div>
          </div>
          <div style="background:#ffffff22;border-radius:8px;padding:10px;text-align:center">
            <div style="font-size:9px;color:#fca5a5">KDV</div>
            <div style="font-size:15px;font-weight:900;color:white">%${(kdv*100).toFixed(0)}</div>
          </div>
        </div>
      </div>
      <div style="padding:16px">

        <!-- Devlet Merkezi Başvuruları -->
        <div style="background:#0d1829;border:1px solid #1e3a5f;border-radius:12px;padding:16px;margin-bottom:16px">
          <div style="font-size:13px;font-weight:700;color:#e2e8f0;margin-bottom:12px">
            📥 Devlet Merkezine Gelen Başvurular (${mBList.length})
          </div>
          ${mBList.length === 0
            ? '<div style="text-align:center;color:#64748b;font-size:12px;padding:16px">Bekleyen başvuru yok</div>'
            : mBList.map(b => `
              <div style="background:#080d1a;border-radius:10px;padding:12px;margin-bottom:8px">
                <div style="font-size:12px;font-weight:700;color:#e2e8f0">${b.il} · ${b.tip}</div>
                <div style="font-size:11px;color:#64748b;margin-top:2px">${new Date(b.ts).toLocaleDateString('tr-TR')}</div>
                <div style="display:flex;gap:6px;margin-top:8px">
                  <button onclick="(async()=>{
                    const fon=parseInt(prompt('Hazineden ne kadar gönderilsin (₺)?')||0);
                    if(!fon)return;
                    const haz=await RS.db('system/hazine')||0;
                    if(haz<fon)return toast('Hazine yetersiz!','error');
                    await db.ref('system/hazine').transaction(c=>(c||0)-fon);
                    await db.ref('politics/${b.il}/belediyeBudgeti').transaction(c=>(c||0)+fon);
                    await db.ref('merkez_basvurular/${b._key}/islendi').set(true);
                    await RS.news('💰 Merkezi hükümet ${b.il} belediyesine '+cashFmt(fon)+' aktardı.','fon','positive');
                    toast('✅ ${b.il} belediyesine '+RS.fmt(fon)+' aktarıldı!','success',5000);
                    window.RS_renderBBPanel();
                  })()" style="flex:1;background:#22c55e22;color:#22c55e;border:1px solid #22c55e44;border-radius:8px;padding:8px;font-size:11px;font-weight:700;cursor:pointer">
                    💰 Fon Aktar
                  </button>
                  <button onclick="db.ref('merkez_basvurular/${b._key}/islendi').set(true).then(()=>window.RS_renderBBPanel())"
                    style="flex:1;background:#ef444422;color:#ef4444;border:1px solid #ef444444;border-radius:8px;padding:8px;font-size:11px;font-weight:700;cursor:pointer">
                    ❌ Reddet
                  </button>
                </div>
              </div>`).join('')
          }
        </div>

        <!-- Ekonomi Kontrolleri -->
        <div style="background:#0d1829;border:1px solid #1e3a5f;border-radius:12px;padding:16px;margin-bottom:16px">
          <div style="font-size:13px;font-weight:700;color:#e2e8f0;margin-bottom:12px">📊 Ekonomi Kontrolleri</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
            <div>
              <label style="font-size:11px;color:#94a3b8">KDV (%)</label>
              <input id="bb_kdv" type="number" min="1" max="40" value="${(kdv*100).toFixed(0)}"
                style="width:100%;padding:10px;background:#080d1a;border:1px solid #1e3a5f;border-radius:8px;color:#e2e8f0;font-size:13px;box-sizing:border-box;margin-top:4px">
            </div>
            <div>
              <label style="font-size:11px;color:#94a3b8">Repo Faizi (%)</label>
              <input id="bb_repo" type="number" step="0.5" min="5" max="100" value="${(repoRate*100).toFixed(1)}"
                style="width:100%;padding:10px;background:#080d1a;border:1px solid #1e3a5f;border-radius:8px;color:#e2e8f0;font-size:13px;box-sizing:border-box;margin-top:4px">
            </div>
            <div>
              <label style="font-size:11px;color:#94a3b8">Asgari Ücret (₺)</label>
              <input id="bb_wage" type="number" value="${minWage}"
                style="width:100%;padding:10px;background:#080d1a;border:1px solid #1e3a5f;border-radius:8px;color:#e2e8f0;font-size:13px;box-sizing:border-box;margin-top:4px">
            </div>
            <div>
              <label style="font-size:11px;color:#94a3b8">Enflasyon (%)</label>
              <input id="bb_enf" type="number" step="0.1" min="0" max="200" value="45"
                style="width:100%;padding:10px;background:#080d1a;border:1px solid #1e3a5f;border-radius:8px;color:#e2e8f0;font-size:13px;box-sizing:border-box;margin-top:4px">
            </div>
          </div>
          <button onclick="(async()=>{
            const kdv=parseInt(document.getElementById('bb_kdv')?.value||20)/100;
            const repo=parseInt(document.getElementById('bb_repo')?.value||42)/100;
            const wage=parseInt(document.getElementById('bb_wage')?.value||17002);
            const enf=parseInt(document.getElementById('bb_enf')?.value||45)/100;
            if(typeof GZX_E22_taxLawChange==='function') await GZX_E22_taxLawChange(kdv);
            if(typeof GZX_B12_setRepoRate==='function') await GZX_B12_setRepoRate(repo);
            if(typeof GZX_E02_setMinWage==='function') await GZX_E02_setMinWage(wage);
            if(typeof GZX_E01_updateInflation==='function') await GZX_E01_updateInflation(enf);
            else await db.ref('system').update({kdv,repoRate:repo,minWage:wage,enflasyon:enf});
            toast('✅ Ekonomi kararları uygulandı!','success',5000);
          })()" style="width:100%;background:#dc2626;color:white;border:none;border-radius:10px;padding:14px;font-weight:800;cursor:pointer">
            ⚡ Ekonomi Kararlarını Uygula
          </button>
        </div>

        ${isPresident ? `
        <!-- Cumhurbaşkanı Özel Yetkiler -->
        <div style="background:#0d1829;border:1px solid #f59e0b44;border-radius:12px;padding:16px;margin-bottom:16px">
          <div style="font-size:13px;font-weight:700;color:#fbbf24;margin-bottom:12px">🌟 Cumhurbaşkanlığı Özel Yetkileri</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            <button onclick="(async()=>{const m=parseInt(prompt('Tüm kamu görevlilerine ikramiye (₺)?')||0);if(m>0)await window.GZX_E09_holidayBonus?.(m);})()"
              style="background:#f59e0b22;color:#f59e0b;border:1px solid #f59e0b44;border-radius:10px;padding:12px;font-size:12px;font-weight:700;cursor:pointer">
              🎁 Toplu İkramiye
            </button>
            <button onclick="(async()=>{const il=prompt('Hangi ile acil fon (81 il)?');const m=parseInt(prompt('Miktar (₺)?')||0);if(il&&m){await db.ref('politics/'+il+'/belediyeBudgeti').transaction(c=>(c||0)+m);await RS.news('🚨 Acil fon: '+il+' iline '+cashFmt(m)+' aktarıldı.','acil','positive');toast('✅ Acil fon aktarıldı','success');}})()"
              style="background:#ef444422;color:#ef4444;border:1px solid #ef444444;border-radius:10px;padding:12px;font-size:12px;font-weight:700;cursor:pointer">
              🚨 Acil İl Fonu
            </button>
            <button onclick="(async()=>{const msg=prompt('Flash haber mesajı:');if(msg&&typeof GZX_R03_globalBroadcast==='function')GZX_R03_globalBroadcast(msg,30000);})()"
              style="background:#3b82f622;color:#3b82f6;border:1px solid #3b82f644;border-radius:10px;padding:12px;font-size:12px;font-weight:700;cursor:pointer">
              📡 Ulusal Duyuru
            </button>
            <button onclick="(async()=>{const il=prompt('Hangi ilde muhtarlık seçimi başlatılsın?');if(!il)return;const bitis=Date.now()+48*3600000;await db.ref('secimler/muhtar_'+il.replace(/ /g,'_')).set({type:'muhtar',bolge:il,baslangic:Date.now(),bitisAt:bitis,adaylar:{}});toast('🗳️ '+il+' muhtarlık seçimi başlatıldı!','success',5000);})()"
              style="background:#8b5cf622;color:#8b5cf6;border:1px solid #8b5cf644;border-radius:10px;padding:12px;font-size:12px;font-weight:700;cursor:pointer">
              🗳️ Seçim Başlat
            </button>
          </div>
        </div>` : ''}

        <!-- İl Bütçe Özeti -->
        <div style="background:#0d1829;border:1px solid #1e3a5f;border-radius:12px;padding:16px">
          <div style="font-size:13px;font-weight:700;color:#e2e8f0;margin-bottom:12px">🗺️ İl Bütçe Durumu (İlk 10 İl)</div>
          ${Object.entries(ilBudgetler).map(([il,bud]) => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #1e3a5f08">
              <span style="font-size:12px;color:#e2e8f0">${il}</span>
              <span style="font-size:12px;font-weight:700;color:${bud > 100000 ? '#22c55e' : bud > 0 ? '#f59e0b' : '#ef4444'}">${RS.fmt(bud)}</span>
            </div>`).join('')}
        </div>

      </div>
    </div>`;
};

/* basbakanlik render override — geç bind */
(function patchBBRender() {
  const _tryPatch = setInterval(() => {
    if (typeof window.render !== 'function') return;
    clearInterval(_tryPatch);
    const _prev = window.render;
    window.render = function(tab) {
      const adminScr = document.getElementById('adminScreen');
      if (adminScr && adminScr.style.display === 'flex') {
        if (typeof _prev === 'function') _prev(tab); return;
      }
      if (!window.GZ?.data) { if (typeof _prev === 'function') _prev(tab); return; }
      if ((tab === 'basbakanlik' || tab === 'cumhurbaskani') &&
          (['pm','president'].includes(RS.role()) || RS.data().isFounder)) {
        window.RS_renderBBPanel(); return;
      }
      if (typeof _prev === 'function') _prev(tab);
    };
  }, 200);
})();

/* ══════════════════════════════════════════════════════════════════════════
   BÖLÜM 5 — OTOMATİK MAAS SİSTEMİ
   ══════════════════════════════════════════════════════════════════════════ */

const RS_MAAS_TABLOSU = {
  muhtar:     15000,
  mayor:      45000,
  mp:         35000,
  pm:         80000,
  president:  120000,
  police:     22000,
  soldier:    20000,
  judge:      35000,
};

/* Maaş öde — ayda bir çalışır */
window.RS_maasOde = async function() {
  const users = await RS.db('users') || {};
  const ayKey = new Date().toISOString().slice(0,7);
  let toplamOdeme = 0;

  for (const [uid, u] of Object.entries(users)) {
    const maas = RS_MAAS_TABLOSU[u.role];
    if (!maas) continue;

    // Bu ay ödendi mi?
    const odendi = await RS.db(`maas_log/${uid}/${ayKey}`);
    if (odendi) continue;

    // Görev süresi bitmişse ödeme
    if (u.gorevBitisi && Date.now() > u.gorevBitisi) continue;

    await RS.set(`maas_log/${uid}/${ayKey}`, { ts: Date.now(), miktar: maas });
    if (typeof addCash === 'function') {
      await addCash(uid, maas, 'kamu-maas');
    }

    // Bildir (sadece aktif oyuncu ise)
    if (typeof window.GZX_notify === 'function') {
      window.GZX_notify(uid,
        `💼 ${ayKey} maaşınız yatırıldı: ${RS.fmt(maas)}`,
        'success');
    }

    toplamOdeme += maas;
  }

  if (toplamOdeme > 0) {
    console.log(`[RS_maasOde] Toplam maaş ödendi: ${toplamOdeme}₺`);
    // Hazineden düş
    const hazine = (await RS.db('system/hazine')) || 0;
    if (hazine > 0) {
      await RS.db('system/hazine'); // oku
      await window.db.ref('system/hazine').transaction(h => Math.max(0, (h||0) - toplamOdeme));
    }
  }
  return toplamOdeme;
};

/* Maaş otomatik tetikleyici — her 10 dakikada kontrol et */
(function maasAutoInit() {
  const _wait = setInterval(function() {
    if (!window.GZ?.uid || !window.db) return;
    clearInterval(_wait);

    // Sadece kurucu veya üst yönetim maaş dağıtır
    const _aylık = setInterval(async function() {
      if (!window.GZ?.data?.isFounder && !['pm','president'].includes(window.GZ?.data?.role)) return;
      try { await window.RS_maasOde(); } catch(e) { console.warn('[RS maaş]', e); }
    }, 10 * 60 * 1000);

    // İlk çalıştırma
    setTimeout(async () => {
      if (window.GZ?.data?.isFounder || ['pm','president'].includes(window.GZ?.data?.role)) {
        try { await window.RS_maasOde(); } catch(e) {}
      }
      // Kendi maaşını kontrol et
      const uid  = window.GZ.uid;
      const d    = window.GZ.data || {};
      const maas = RS_MAAS_TABLOSU[d.role];
      if (maas) {
        const ayKey = new Date().toISOString().slice(0,7);
        const odendi = await RS.db(`maas_log/${uid}/${ayKey}`);
        if (!odendi) {
          RS.toast(`💼 Aylık maaşınız yakında yatacak: ${RS.fmt(maas)}`, 'info', 5000);
        }
      }
    }, 5000);
  }, 800);
})();

/* ══════════════════════════════════════════════════════════════════════════
   BÖLÜM 6 — 81 İL SEÇİM SİSTEMİ TAM BAĞLANTISI
   ══════════════════════════════════════════════════════════════════════════ */

window.RS_renderSecimler = async function() {
  const main = RS.main(); if (!main) return;
  const uid  = RS.uid();  if (!uid)  return;
  const d    = await RS.db(`users/${uid}`) || {};
  const prov = d.province || 'İstanbul';
  const ILLER = window.ILLER_LIST || [];

  // Aktif seçimleri çek
  const secimler = await RS.db('secimler') || {};
  const aktifSecimler = Object.entries(secimler)
    .map(([k,v]) => ({...v,_key:k}))
    .filter(v => v.bitisAt && Date.now() < v.bitisAt)
    .sort((a,b) => a.bitisAt - b.bitisAt);

  // İlinizdeki mevcut yöneticiler
  const mayorUid  = await RS.db(`politics/${prov}/mayor`);
  const muhtarUid = await RS.db(`politics/${prov}/muhtar`);
  const mayorData  = mayorUid  ? (await RS.db(`users/${mayorUid}`))  : null;
  const muhtarData = muhtarUid ? (await RS.db(`users/${muhtarUid}`)) : null;

  main.innerHTML = `
    <div style="padding:0 0 80px">
      <div style="background:linear-gradient(135deg,#1e3a5f,#1e40af);padding:20px 16px 16px">
        <div style="font-size:18px;font-weight:900;color:white">🗳️ Seçimler</div>
        <div style="font-size:12px;color:#bfdbfe;margin-top:2px">${prov} · Siyasi Sistemler</div>
      </div>
      <div style="padding:16px">

        <!-- Mevcut Yöneticiler -->
        <div style="background:#0d1829;border:1px solid #1e3a5f;border-radius:12px;padding:16px;margin-bottom:16px">
          <div style="font-size:13px;font-weight:700;color:#e2e8f0;margin-bottom:10px">📌 ${prov} Mevcut Yöneticiler</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            <div style="background:#080d1a;border-radius:10px;padding:12px;text-align:center">
              <div style="font-size:10px;color:#64748b;margin-bottom:4px">🏛️ MUHTAR</div>
              <div style="font-size:13px;font-weight:700;color:#e2e8f0">${muhtarData?.username || 'Seçilmedi'}</div>
              ${muhtarData?.gorevBitisi ? `<div style="font-size:9px;color:#64748b;margin-top:2px">Bitiş: ${new Date(muhtarData.gorevBitisi).toLocaleDateString('tr-TR')}</div>` : ''}
            </div>
            <div style="background:#080d1a;border-radius:10px;padding:12px;text-align:center">
              <div style="font-size:10px;color:#64748b;margin-bottom:4px">🏙️ BELEDİYE BAŞKANI</div>
              <div style="font-size:13px;font-weight:700;color:#e2e8f0">${mayorData?.username || 'Seçilmedi'}</div>
              ${mayorData?.gorevBitisi ? `<div style="font-size:9px;color:#64748b;margin-top:2px">Bitiş: ${new Date(mayorData.gorevBitisi).toLocaleDateString('tr-TR')}</div>` : ''}
            </div>
          </div>
        </div>

        <!-- Aktif Seçimler -->
        <div style="background:#0d1829;border:1px solid #1e3a5f;border-radius:12px;padding:16px;margin-bottom:16px">
          <div style="font-size:13px;font-weight:700;color:#e2e8f0;margin-bottom:12px">
            🔴 Aktif Seçimler (${aktifSecimler.length})
          </div>
          ${aktifSecimler.length === 0
            ? '<div style="text-align:center;color:#64748b;font-size:12px;padding:16px">Şu an aktif seçim yok</div>'
            : aktifSecimler.map(s => {
                const kalanMs = s.bitisAt - Date.now();
                const kalanSaat = Math.floor(kalanMs / 3600000);
                const adaylar  = Object.entries(s.adaylar || {});
                return `
                  <div style="background:#080d1a;border-radius:10px;padding:14px;margin-bottom:10px">
                    <div style="display:flex;justify-content:space-between;align-items:flex-start">
                      <div>
                        <div style="font-size:13px;font-weight:700;color:#e2e8f0">${s.type === 'muhtar' ? '🏛️ Muhtarlık' : s.type === 'belediye' ? '🏙️ Belediye Başkanlığı' : s.type === 'basbakanlik' ? '🇹🇷 Başbakanlık' : '🌟 Cumhurbaşkanlığı'}</div>
                        <div style="font-size:11px;color:#64748b;margin-top:2px">${s.bolge || 'Ulusal'}</div>
                      </div>
                      <div style="background:#ef444422;color:#ef4444;font-size:10px;font-weight:800;padding:4px 8px;border-radius:999px">
                        ⏱ ${kalanSaat}s kaldı
                      </div>
                    </div>
                    <!-- Adaylar -->
                    <div style="margin-top:10px">
                      ${adaylar.length === 0
                        ? '<div style="font-size:11px;color:#64748b">Henüz aday yok</div>'
                        : adaylar.map(([aUid, a]) => {
                            const oylar = Object.keys(a.votes || {}).length;
                            const totalOy = adaylar.reduce((t,[,x]) => t + Object.keys(x.votes||{}).length, 0);
                            const pct = totalOy > 0 ? Math.round(oylar/totalOy*100) : 0;
                            const kullandiMi = a.votes && a.votes[uid];
                            return `
                              <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
                                <div style="flex:1">
                                  <div style="font-size:12px;font-weight:700;color:#e2e8f0">${a.username || '—'}</div>
                                  <div style="height:6px;background:#1e3a5f;border-radius:999px;margin-top:4px">
                                    <div style="height:100%;background:#3b82f6;border-radius:999px;width:${pct}%;transition:width .3s"></div>
                                  </div>
                                  <div style="font-size:10px;color:#64748b;margin-top:2px">%${pct} · ${oylar} oy</div>
                                </div>
                                ${!kullandiMi ? `
                                  <button onclick="(async()=>{
                                    await db.ref('secimler/${s._key}/adaylar/${aUid}/votes/${uid}').set(true);
                                    toast('✅ Oy verildi!','success');
                                    window.RS_renderSecimler();
                                  })()" style="background:#3b82f6;color:white;border:none;border-radius:8px;padding:6px 12px;font-size:11px;font-weight:700;cursor:pointer">
                                    Oy Ver
                                  </button>` : '<div style="font-size:10px;color:#22c55e;font-weight:700">✅ Oy verildi</div>'}
                              </div>`;
                          }).join('')
                      }
                    </div>
                    <!-- Aday ol butonu -->
                    ${!adaylar.find(([k]) => k === uid) ? `
                      <button onclick="(async()=>{
                        const cfg={muhtar:{fee:5000,minLv:5},belediye:{fee:50000,minLv:15},basbakanlik:{fee:500000,minLv:30},cumhurbaskani:{fee:1000000,minLv:50}};
                        const c=cfg['${s.type}']||{fee:5000,minLv:5};
                        const lv=window.GZ?.data?.level||1;
                        if(lv<c.minLv)return toast('Minimum Level '+c.minLv+' gerekli!','error');
                        const ok=await window.GZX_safePay?.(uid,c.fee,'aday-olma');
                        if(!ok?.ok)return;
                        const dUser=await RS.db('users/'+uid)||{};
                        await db.ref('secimler/${s._key}/adaylar/'+uid).set({username:dUser.username||'—',aday_ts:Date.now(),votes:{}});
                        toast('✅ Adaylığınız kaydedildi!','success',5000);
                        window.RS_renderSecimler();
                      })()" style="width:100%;background:#8b5cf622;color:#8b5cf6;border:1px solid #8b5cf644;border-radius:8px;padding:10px;font-size:12px;font-weight:700;cursor:pointer;margin-top:8px">
                        🎯 Aday Ol (${s.type === 'muhtar' ? '5.000₺' : s.type === 'belediye' ? '50.000₺' : '500.000₺'})
                      </button>` : ''}
                  </div>`;
              }).join('')
          }
        </div>

        <!-- İl Seç & Seçim İzle -->
        <div style="background:#0d1829;border:1px solid #1e3a5f;border-radius:12px;padding:16px">
          <div style="font-size:13px;font-weight:700;color:#e2e8f0;margin-bottom:10px">🗺️ İllere Göre Seçim Durumu</div>
          <select id="rs_il_sec" style="width:100%;padding:10px;background:#080d1a;border:1px solid #1e3a5f;border-radius:8px;color:#e2e8f0;font-size:13px;margin-bottom:8px">
            ${ILLER.map(il => `<option value="${il}" ${il===prov?'selected':''}>${il}</option>`).join('')}
          </select>
          <button onclick="(async()=>{
            const il=document.getElementById('rs_il_sec')?.value;
            if(!il)return;
            const muid=await RS.db('politics/'+il+'/mayor');
            const muhuid=await RS.db('politics/'+il+'/muhtar');
            const md=muid?await RS.db('users/'+muid):null;
            const mhd=muhuid?await RS.db('users/'+muhuid):null;
            toast(il+': Belediye Başkanı: '+(md?.username||'Seçilmedi')+' · Muhtar: '+(mhd?.username||'Seçilmedi'),'info',8000);
          })()" style="width:100%;background:#1e40af;color:white;border:none;border-radius:10px;padding:12px;font-weight:700;cursor:pointer">
            🔍 İl Yöneticilerini Gör
          </button>
        </div>

      </div>
    </div>`;
};

/* Seçim bitis kontrolü — kazananı ata */
window.RS_secimBitisKontrol = async function() {
  const secimler = await RS.db('secimler') || {};
  const bitmisler = Object.entries(secimler)
    .filter(([,v]) => v.bitisAt && Date.now() > v.bitisAt && !v.islendi);

  for (const [key, s] of bitmisler) {
    const adaylar = Object.entries(s.adaylar || {});
    if (adaylar.length === 0) {
      await RS.upd(`secimler/${key}`, { islendi: true });
      continue;
    }

    // En çok oy alanı bul
    const kazanan = adaylar
      .map(([uid, a]) => ({ uid, oylar: Object.keys(a.votes || {}).length, username: a.username }))
      .sort((a,b) => b.oylar - a.oylar)[0];

    if (!kazanan) continue;

    // Rolü ata
    const SURE = { muhtar: 30, belediye: 60, basbakanlik: 90, cumhurbaskani: 180 };
    const sureDays = SURE[s.type] || 30;
    const gorevBitisi = Date.now() + sureDays * 86400000;
    const MAAŞ = { muhtar: 15000, belediye: 45000, basbakanlik: 80000, cumhurbaskani: 120000 };
    const rolMap = { muhtar: 'muhtar', belediye: 'mayor', basbakanlik: 'pm', cumhurbaskani: 'president' };

    await RS.upd(`users/${kazanan.uid}`, {
      role: rolMap[s.type] || 'vatandas',
      rolSecildi: true,
      gorevBitisi,
      [`${s.type === 'muhtar' ? 'muhtar' : 'mayor'}Of`]: s.bolge,
      [`${s.type}Maas`]: MAAŞ[s.type] || 15000,
    });

    // İle kaydet
    if (s.type === 'muhtar') {
      await RS.set(`politics/${s.bolge}/muhtar`, kazanan.uid);
    } else if (s.type === 'belediye') {
      await RS.set(`politics/${s.bolge}/mayor`, kazanan.uid);
    } else if (s.type === 'basbakanlik') {
      await RS.set('system/pm', kazanan.uid);
    } else if (s.type === 'cumhurbaskani') {
      await RS.set('system/president', kazanan.uid);
    }

    await RS.upd(`secimler/${key}`, { islendi: true, kazanan: kazanan.uid });
    await RS.news(
      `🗳️ ${s.bolge || 'Ulusal'} ${s.type} seçimini ${kazanan.username} kazandı! (${kazanan.oylar} oy)`,
      'secim', 'neutral'
    );

    // Kazanana bildir
    if (typeof window.GZX_notify === 'function') {
      window.GZX_notify(kazanan.uid,
        `🏆 ${s.type} seçimini kazandınız! Görev süreniz: ${sureDays} gün.`,
        'success');
    }
    console.log(`[RS_seçim] Kazanan: ${kazanan.username} (${s.type}, ${s.bolge})`);
  }
};

/* Seçim bitiş kontrolü her 5 dakikada */
(function secimKontrolInit() {
  const _w = setInterval(function() {
    if (!window.db) return;
    clearInterval(_w);
    setInterval(() => window.RS_secimBitisKontrol().catch(()=>{}), 5 * 60 * 1000);
    setTimeout(() => window.RS_secimBitisKontrol().catch(()=>{}), 3000);
  }, 1000);
})();

/* secim render override — geç bind */
(function patchSecimRender() {
  const _tryPatch = setInterval(() => {
    if (typeof window.render !== 'function') return;
    clearInterval(_tryPatch);
    const _prev = window.render;
    window.render = function(tab) {
      const adminScr = document.getElementById('adminScreen');
      if (adminScr && adminScr.style.display === 'flex') {
        if (typeof _prev === 'function') _prev(tab); return;
      }
      if (tab === 'secim') { window.RS_renderSecimler(); return; }
      if (typeof _prev === 'function') _prev(tab);
    };
  }, 200);
})();

/* ══════════════════════════════════════════════════════════════════════════
   BÖLÜM 7 — ROL MENÜSÜ GÜNCELLEMESİ (Yönetim rolleri için menü kilidi)
   ══════════════════════════════════════════════════════════════════════════ */

/* Alt menü (konsol) yönetim rolleri için özelleştirilmiş görünüm */
window.RS_rolMenuGuncelle = function(rolId) {
  const konsol = document.getElementById('mainKonsol');
  if (!konsol) return;

  const YON_MENULERI = {
    muhtar:   [
      {tab:'muhtarlik',  icon:'🏛️', label:'Muhtarlık'},
      {tab:'belediye',   icon:'🏙️', label:'Belediye'},
      {tab:'secim',      icon:'🗳️', label:'Seçim'},
      {tab:'liderlik',   icon:'🏆', label:'Liderlik'},
    ],
    mayor:    [
      {tab:'belediye',   icon:'🏙️', label:'Belediye'},
      {tab:'muhtarlik',  icon:'🏛️', label:'Muhtarlık'},
      {tab:'secim',      icon:'🗳️', label:'Seçim'},
      {tab:'liderlik',   icon:'🏆', label:'Liderlik'},
    ],
    police:   [
      {tab:'polis',      icon:'👮', label:'Emniyet'},
      {tab:'mahkeme',    icon:'⚖️', label:'Mahkeme'},
      {tab:'muhtarlik',  icon:'🏛️', label:'Muhtar'},
      {tab:'liderlik',   icon:'🏆', label:'Liderlik'},
    ],
    soldier:  [
      {tab:'askeriye',   icon:'🎖️', label:'Kışla'},
      {tab:'polis',      icon:'👮', label:'Emniyet'},
      {tab:'muhtarlik',  icon:'🏛️', label:'Muhtar'},
      {tab:'liderlik',   icon:'🏆', label:'Liderlik'},
    ],
    judge:    [
      {tab:'mahkeme',    icon:'⚖️', label:'Mahkeme'},
      {tab:'noter',      icon:'📜', label:'Noterlik'},
      {tab:'polis',      icon:'👮', label:'Emniyet'},
      {tab:'liderlik',   icon:'🏆', label:'Liderlik'},
    ],
    pm:       [
      {tab:'basbakanlik',icon:'🇹🇷', label:'Hükümet'},
      {tab:'secim',      icon:'🗳️', label:'Seçim'},
      {tab:'liderlik',   icon:'🏆', label:'Liderlik'},
      {tab:'haberler',   icon:'📰', label:'Haberler'},
    ],
    president:[
      {tab:'basbakanlik',icon:'🌟', label:'Yönetim'},
      {tab:'secim',      icon:'🗳️', label:'Seçim'},
      {tab:'liderlik',   icon:'🏆', label:'Liderlik'},
      {tab:'haberler',   icon:'📰', label:'Haberler'},
    ],
  };

  const menü = YON_MENULERI[rolId];
  if (!menü) return; // Vatandaş/esnaf/banker → mevcut menü kalır

  const tabBtns = konsol.querySelectorAll('.mk-tab');
  tabBtns.forEach((btn, i) => {
    const m = menü[i];
    if (!m) return;
    btn.dataset.tab = m.tab;
    const iconEl  = btn.querySelector('.mk-icon');
    const labelEl = btn.querySelector('.mk-label');
    if (iconEl)  iconEl.textContent  = m.icon;
    if (labelEl) labelEl.textContent = m.label;
  });
};

/* GZR_rolNavigasyon'u override et */
(function patchRolNavigasyon() {
  const _prev = window.GZR_rolNavigasyon;
  window.GZR_rolNavigasyon = function(rolId) {
    if (typeof _prev === 'function') _prev(rolId);
    setTimeout(() => window.RS_rolMenuGuncelle(rolId), 100);
  };
})();

/* ══════════════════════════════════════════════════════════════════════════
   BÖLÜM 8 — BAŞLANGIÇ
   ══════════════════════════════════════════════════════════════════════════ */
(function rsInit() {
  const _w = setInterval(function() {
    if (!window.GZ?.uid || window.GZ?.data === null || window.GZ?.data === undefined) return;
    clearInterval(_w);

    const role = window.GZ?.data?.role || 'vatandas';

    // Menüyü rol'e göre ayarla
    const _wMenu = setInterval(function() {
      if (document.getElementById('mainKonsol')) {
        clearInterval(_wMenu);
        setTimeout(() => window.RS_rolMenuGuncelle(role), 500);
      }
    }, 300);

    console.log(`[rol-sistemi.js] ✅ Rol: ${role}`);
  }, 400);
})();

console.log('[rol-sistemi.js] ✅ Yüklendi — Rol kilidi, muhtar şikayetleri (250 kat.), belediye paneli, maas sistemi, 81 il seçim, rüşvet mekanizması aktif');
