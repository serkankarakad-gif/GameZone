/* ============================================================================
   dinamik-sistem.js — GameZone ERP: Otomatik Bot + Admin Onay + Tam Sistem
   ============================================================================
   1)  Bot Oyuncular (5 farklı bot, otomatik aktivite)
   2)  Admin Onay Sistemi (kimlik, ruhsat, konkordato, dava)
   3)  AI Bot Onay (admin offline ise otomatik onaylar)
   4)  Çalışan Mahkeme, Noter, Sözleşme, Vergi, Kredi ekranları
   5)  Dinamik Ürün Fiyatları (saatte bir değişir, habere yansır)
   6)  Otomatik Haber Jeneratörü (her 10 dk yeni haber)
   7)  Otomatik İhale Jeneratörü (günde 3 yeni ihale)
   8)  Enerji Sanayisi (admin yönetir, oyuncu satın alır)
   9)  SGK İşveren Prim Ödeme
   10) Konkordato/Borç Yapılandırma çalışan ekran
   ============================================================================ */
'use strict';

(function() {

  /* ──────── Yardımcı ──────── */
  function _f(n) { return typeof cashFmt === 'function' ? cashFmt(n) : Math.round(Number(n)||0).toLocaleString('tr-TR') + ' ₺'; }
  function _ts(t) { return new Date(t).toLocaleString('tr-TR'); }
  function _isAdminOnline() {
    return new Promise(async (resolve) => {
      try {
        const founders = await dbGet('founders') || {};
        for (const fuid of Object.keys(founders)) {
          const u = await dbGet(`users/${fuid}`);
          if (u?.lastSeen && Date.now() - u.lastSeen < 5 * 60000) {
            resolve(true); return;
          }
        }
        resolve(false);
      } catch { resolve(false); }
    });
  }

  /* ════════════════════════════════════════════════════════════════════════
     1) ADMIN ONAY KUYRUĞU SİSTEMİ
     Kimlik kartı, ruhsat, konkordato, dava — hepsi admin onayından geçer
     Admin offline ise AI bot 30 saniye sonra otomatik onaylar
     ════════════════════════════════════════════════════════════════════════ */

  // Yeni: Onaylı kimlik çıkartma
  window.GZX_M01_issueIDCard = async function(uid) {
    const fee = (await dbGet('system/idCardFee')) || 10000;
    const has = await dbGet(`users/${uid}/kimlikKarti`);
    if (has) return toast?.('Kimlik kartınız zaten var', 'warn');

    // Onay başvurusu oluştur (önce ücreti tahsil et)
    const ok = await spendCash(uid, fee, 'Kimlik Kartı Başvurusu');
    if (!ok) return toast?.('💸 Yetersiz bakiye', 'error');

    const userData = await dbGet(`users/${uid}`) || {};
    const ref = await dbPush('approvals/idCard', {
      uid,
      username: userData.username || 'Anonim',
      type: 'kimlik_karti',
      fee,
      status: 'pending',
      ts: Date.now(),
    });

    toast?.('🪪 Kimlik kartı başvurunuz alındı! Admin onayı bekleniyor... (5 dakika içinde onaylanacak)', 'info', 8000);

    // 5 dakika sonra admin online değilse AI asistan otomatik onaylasın
    setTimeout(async () => {
      const data = await dbGet(`approvals/idCard/${ref.key}`);
      if (data?.status !== 'pending') return;
      const adminOnline = await _isAdminOnline();
      if (!adminOnline) {
        await GZX_aiOnayKimlik(ref.key);
      }
    }, 300000); // 5 dakika = 300.000 ms

    return ref.key;
  };

  // AI Bot kimlik onayı
  window.GZX_aiOnayKimlik = async function(approvalId) {
    const data = await dbGet(`approvals/idCard/${approvalId}`);
    if (!data || data.status !== 'pending') return;

    const userData = await dbGet(`users/${data.uid}`) || {};
    const tcNo = 'GZ' + String(Date.now()).slice(-9);
    await dbUpdate(`users/${data.uid}`, {
      kimlikKarti: {
        tc: tcNo,
        ad: userData.username || 'OYUNCU',
        il: userData.province || 'İstanbul',
        verilis: Date.now(),
        muhtarOnay: true,
        seriNo: `BOT-${Date.now().toString(36).toUpperCase()}`,
        onaylayan: 'AI-Bot-Memur',
      },
      canTrade: true,
    });
    await dbUpdate(`approvals/idCard/${approvalId}`, {
      status: 'approved', approvedBy: 'AI-Bot-Memur', approvedAt: Date.now(),
    });
    await GZX_notify(data.uid, `🪪 Kimlik kartınız hazır! TC: ${tcNo}`, 'success');
  };

  // Admin manuel kimlik onay
  window.GZX_adminOnayKimlik = async function(approvalId, action) {
    const data = await dbGet(`approvals/idCard/${approvalId}`);
    if (!data || data.status !== 'pending') return;

    if (action === 'approve') {
      await GZX_aiOnayKimlik(approvalId);
      await dbUpdate(`approvals/idCard/${approvalId}/approvedBy`, window.GZ?.data?.username || 'Admin');
      toast?.('✅ Kimlik onaylandı','success');
    } else {
      // Red — para iade
      await addCash(data.uid, data.fee, 'Kimlik başvurusu iadesi');
      await dbUpdate(`approvals/idCard/${approvalId}`, { status:'rejected', rejectedBy: window.GZ?.data?.username, rejectedAt: Date.now() });
      await GZX_notify(data.uid, '❌ Kimlik başvurunuz reddedildi, ücretiniz iade edildi', 'warn');
      toast?.('❌ Reddedildi','success');
    }
  };

  /* ════════════════════════════════════════════════════════════════════════
     1B) OYUNCULAR ARASI BORÇ SİSTEMİ
     - Oyuncular birbirine borç para verebilir
     - Firebase'e kayıt edilir (mahkemede delil olarak kullanılabilir)
     - Borç geri ödeme, gecikme takibi
     - Mahkemeye verme butonu (dava açma)
     ════════════════════════════════════════════════════════════════════════ */

  /**
   * Başka bir oyuncuya borç para gönder
   * @param {string} alacakliUid  - Parayı alan (borç verilen) kişinin UID'si
   * @param {number} miktar       - TL cinsinden borç miktarı
   * @param {string} aciklama     - Borç açıklaması / neden veriliyor
   * @param {number} vade         - Gün cinsinden geri ödeme vadesi (max 90 gün)
   */
  window.GZX_borcVer = async function(alacakliUid, miktar, aciklama, vade) {
    const borcluUid = window.GZ?.uid;
    if (!borcluUid) return toast?.('⛔ Giriş yapmalısınız', 'error');
    if (!alacakliUid || alacakliUid === borcluUid) return toast?.('⛔ Kendinize borç veremezsiniz', 'error');
    miktar = Math.floor(Number(miktar) || 0);
    if (miktar < 100) return toast?.('⛔ Minimum borç miktarı ₺100', 'error');
    vade = Math.min(90, Math.max(1, parseInt(vade) || 30));

    // Kimlik kartı zorunlu
    const borcluData = await dbGet(`users/${borcluUid}`);
    if (!borcluData?.kimlikKarti) return toast?.('⛔ Borç vermek için kimlik kartı gerekli! Muhtardan çıkartın.', 'error', 7000);

    // Alıcı var mı?
    const alacakliData = await dbGet(`users/${alacakliUid}`);
    if (!alacakliData) return toast?.('⛔ Kullanıcı bulunamadı', 'error');
    if (alacakliData.banned) return toast?.('⛔ Bu kullanıcı banlı', 'error');
    if (!alacakliData.kimlikKarti) return toast?.('⛔ Karşı tarafın kimlik kartı yok, borç yapılamaz', 'error', 7000);

    // Bakiye kontrolü
    const ok = await spendCash(borcluUid, miktar, 'Oyuncu borç transferi');
    if (!ok) return toast?.(`💸 Yetersiz bakiye. Gerekli: ₺${miktar.toLocaleString('tr-TR')}`, 'error');

    // Alıcıya parayı ekle
    await addCash(alacakliUid, miktar, 'Oyuncu borç alındı');

    // Geri ödeme tarihi
    const vadeTarihi = Date.now() + (vade * 24 * 60 * 60 * 1000);

    // Firebase'e borç kaydı oluştur
    const borcRef = await dbPush('peerLoans', {
      borcluUid,
      borcluAd:    borcluData.username || 'Anonim',
      borcluTC:    borcluData.kimlikKarti?.tc || '',
      alacakliUid,
      alacakliAd:  alacakliData.username || 'Anonim',
      alacakliTC:  alacakliData.kimlikKarti?.tc || '',
      miktar,
      aciklama:    (aciklama || '').slice(0, 200),
      vade,
      vadeTarihi,
      odemeDurumu: 'odenmedi',
      odenemisMiktar: 0,
      ts:          Date.now(),
      status:      'aktif',
    });

    // Her iki tarafa da bildirim gönder
    await GZX_notify(alacakliUid,
      `💰 ${borcluData.username} sana ₺${miktar.toLocaleString('tr-TR')} borç verdi. Vade: ${vade} gün. Kayıt No: ${borcRef.key?.slice(-8)}`,
      'info'
    );
    await GZX_notify(borcluUid,
      `📋 ₺${miktar.toLocaleString('tr-TR')} borç verildi → ${alacakliData.username}. Vade: ${vade} gün. Kayıt No: ${borcRef.key?.slice(-8)}`,
      'success'
    );

    toast?.(`✅ Borç kaydedildi! ₺${miktar.toLocaleString('tr-TR')} → ${alacakliData.username} | Kayıt: ${borcRef.key?.slice(-8)}`, 'success', 8000);
    return borcRef.key;
  };

  /**
   * Borç geri öde (kısmen veya tamamen)
   * @param {string} borcId  - Firebase'deki borç kaydının ID'si
   * @param {number} miktar  - Geri ödenecek miktar (boş bırakılırsa tamamı)
   */
  window.GZX_borcOde = async function(borcId, miktar) {
    const odeyenUid = window.GZ?.uid;
    if (!odeyenUid) return toast?.('⛔ Giriş yapmalısınız', 'error');

    const borc = await dbGet(`peerLoans/${borcId}`);
    if (!borc) return toast?.('⛔ Borç kaydı bulunamadı', 'error');
    if (borc.status === 'kapandi') return toast?.('✅ Bu borç zaten kapatılmış', 'warn');

    // Sadece borçlu ödeyebilir
    if (borc.borcluUid !== odeyenUid) return toast?.('⛔ Bu borcu yalnızca borçlu kişi ödeyebilir', 'error');

    const kalanBorc = borc.miktar - (borc.odenemisMiktar || 0);
    miktar = miktar ? Math.min(Math.floor(Number(miktar)), kalanBorc) : kalanBorc;
    if (miktar <= 0) return toast?.('⛔ Geçersiz miktar', 'error');

    // Ödeyenden para çek
    const ok = await spendCash(odeyenUid, miktar, 'Borç geri ödemesi');
    if (!ok) return toast?.(`💸 Yetersiz bakiye. Gerekli: ₺${miktar.toLocaleString('tr-TR')}`, 'error');

    // Alacaklıya ver
    await addCash(borc.alacakliUid, miktar, 'Borç tahsilatı');

    const yeniOdenen  = (borc.odenemisMiktar || 0) + miktar;
    const tamOdendi   = yeniOdenen >= borc.miktar;

    await dbUpdate(`peerLoans/${borcId}`, {
      odenemisMiktar: yeniOdenen,
      odemeDurumu:    tamOdendi ? 'odendi' : 'kismi',
      status:         tamOdendi ? 'kapandi' : 'aktif',
      sonOdemeTarihi: Date.now(),
    });

    // Bildirimler
    await GZX_notify(borc.alacakliUid,
      `💵 ${borc.borcluAd} borcunun ₺${miktar.toLocaleString('tr-TR')} kısmını ödedi. ${tamOdendi ? '✅ Borç tamamen kapandı!' : `Kalan: ₺${(borc.miktar-yeniOdenen).toLocaleString('tr-TR')}`}`,
      tamOdendi ? 'success' : 'info'
    );

    if (tamOdendi) {
      toast?.('✅ Borç tamamen ödendi ve kapatıldı!', 'success', 6000);
    } else {
      toast?.(`💵 ₺${miktar.toLocaleString('tr-TR')} ödendi. Kalan: ₺${(borc.miktar-yeniOdened).toLocaleString('tr-TR')}`, 'success', 6000);
    }
  };

  /**
   * Borcu mahkemeye taşı (dava aç)
   * @param {string} borcId  - Firebase'deki borç kaydının ID'si
   */
  window.GZX_borcMahkeme = async function(borcId) {
    const davacıUid = window.GZ?.uid;
    if (!davacıUid) return toast?.('⛔ Giriş yapmalısınız', 'error');

    const borc = await dbGet(`peerLoans/${borcId}`);
    if (!borc) return toast?.('⛔ Borç kaydı bulunamadı', 'error');
    if (borc.status === 'kapandi') return toast?.('✅ Bu borç zaten kapatılmış, dava açılamaz', 'warn');
    if (borc.mahkemeStatus === 'davali') return toast?.('⚖️ Bu borç zaten mahkemede', 'warn');

    // Sadece alacaklı dava açabilir
    if (borc.alacakliUid !== davacıUid) return toast?.('⛔ Yalnızca alacaklı dava açabilir', 'error');

    // Vade geçmiş olmalı
    if (Date.now() < borc.vadeTarihi) {
      const kalanGun = Math.ceil((borc.vadeTarihi - Date.now()) / (24*60*60*1000));
      return toast?.(`⏳ Vade henüz dolmadı. ${kalanGun} gün sonra dava açabilirsiniz.`, 'warn', 6000);
    }

    // Mahkeme davası aç
    const davaRef = await dbPush('mahkeme/davalar', {
      tip:         'borc_davasi',
      borcId,
      davacıUid,
      davacıAd:    borc.alacakliAd,
      davacıTC:    borc.alacakliTC,
      davalıUid:   borc.borcluUid,
      davalıAd:    borc.borcluAd,
      davalıTC:    borc.borcluTC,
      talepMiktar: borc.miktar - (borc.odenemisMiktar || 0),
      aciklama:    `Borç geri ödemesi yapılmadı. Borç tarihi: ${new Date(borc.ts).toLocaleDateString('tr-TR')}. Vade: ${borc.vade} gün.`,
      delil:       `Firebase Kayıt ID: ${borcId} | Borç veriliş: ${new Date(borc.ts).toLocaleString('tr-TR')} | Vade tarihi: ${new Date(borc.vadeTarihi).toLocaleDateString('tr-TR')}`,
      status:      'inceleniyor',
      ts:          Date.now(),
    });

    // Borç kaydına dava durumunu işle
    await dbUpdate(`peerLoans/${borcId}`, {
      mahkemeStatus: 'davali',
      davaId:        davaRef.key,
      davaTs:        Date.now(),
    });

    // Davalıya bildirim
    await GZX_notify(borc.borcluUid,
      `⚖️ ${borc.alacakliAd} sizi mahkemeye verdi! Dava No: ${davaRef.key?.slice(-8)} | Borç: ₺${(borc.miktar-(borc.odenemisMiktar||0)).toLocaleString('tr-TR')}`,
      'error'
    );

    toast?.(`⚖️ Dava açıldı! Dava No: ${davaRef.key?.slice(-8)}. Admin mahkeme kararı verecek.`, 'success', 8000);
    return davaRef.key;
  };

  /**
   * Kullanıcının tüm borçlarını listele (hem verdiği hem aldığı)
   * @param {string} uid  - Kullanıcı UID'si (boş ise mevcut kullanıcı)
   */
  window.GZX_borcListesi = async function(hedefUid) {
    const uid = hedefUid || window.GZ?.uid;
    if (!uid) return [];
    const tumBorc = await dbGet('peerLoans') || {};
    const list = [];
    for (const [id, b] of Object.entries(tumBorc)) {
      if (b.borcluUid === uid || b.alacakliUid === uid) {
        list.push({ id, ...b });
      }
    }
    return list.sort((a, b) => b.ts - a.ts);
  };

  /**
   * Borç sistemi UI panelini render et (cüzdan / oyun içi)
   */
  window.GZX_renderBorcPaneli = async function(container) {
    if (!container) return;
    const uid = window.GZ?.uid;
    if (!uid) { container.innerHTML = '<p style="color:#ef4444;padding:20px">Giriş yapın</p>'; return; }

    container.innerHTML = '<div style="padding:16px;color:#94a3b8;font-size:12px">Borçlar yükleniyor...</div>';
    const liste = await GZX_borcListesi(uid);

    const verilenler = liste.filter(b => b.borcluUid === uid);
    const alinanlar  = liste.filter(b => b.alacakliUid === uid);

    function _borcKart(b, rol) {
      const karsiTaraf = rol === 'borclu' ? b.alacakliAd : b.borcluAd;
      const kalan = b.miktar - (b.odenemisMiktar || 0);
      const gecikti = b.status !== 'kapandi' && Date.now() > b.vadeTarihi;
      const renk = b.status === 'kapandi' ? '#22c55e' : gecikti ? '#ef4444' : '#f59e0b';
      const durum = b.status === 'kapandi' ? '✅ Kapalı' : gecikti ? '🔴 GECİKMİŞ' : '⏳ Aktif';

      return `
        <div style="background:#0d1a2e;border:1px solid ${renk}44;border-radius:10px;padding:14px;margin-bottom:10px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <span style="font-size:11px;color:${renk};font-weight:700">${durum}</span>
            <span style="font-size:10px;color:#475569">#${b.id?.slice(-8)}</span>
          </div>
          <div style="font-size:13px;color:#e2e8f0;font-weight:700;margin-bottom:4px">
            ${rol === 'borclu' ? '👤 Alacaklı' : '👤 Borçlu'}: ${karsiTaraf}
          </div>
          <div style="font-size:12px;color:#94a3b8;margin-bottom:4px">
            💬 ${b.aciklama || 'Açıklama yok'}
          </div>
          <div style="display:flex;gap:12px;font-size:12px;margin-bottom:8px">
            <span>💰 Toplam: <b style="color:#60a5fa">₺${b.miktar?.toLocaleString('tr-TR')}</b></span>
            <span>💵 Kalan: <b style="color:${renk}">₺${kalan.toLocaleString('tr-TR')}</b></span>
          </div>
          <div style="font-size:11px;color:#475569;margin-bottom:8px">
            📅 Vade: ${new Date(b.vadeTarihi).toLocaleDateString('tr-TR')} | Tarih: ${new Date(b.ts).toLocaleDateString('tr-TR')}
            ${b.mahkemeStatus === 'davali' ? ' | <span style="color:#ef4444">⚖️ DAVALI</span>' : ''}
          </div>
          ${b.status !== 'kapandi' && rol === 'borclu' ? `
            <button onclick="(async()=>{const m=prompt('Kaç TL ödemek istiyorsunuz? (Kalan: ₺${kalan.toLocaleString('tr-TR')})');if(m&&parseInt(m)>0){await GZX_borcOde('${b.id}',parseInt(m));GZX_renderBorcPaneli(document.getElementById('borcPanelContainer'));}})()"
              style="background:#1e40af;color:#fff;border:none;border-radius:7px;padding:6px 14px;font-size:11px;font-weight:700;cursor:pointer;margin-right:6px">
              💵 Ödeme Yap
            </button>` : ''}
          ${b.status !== 'kapandi' && rol === 'alacakli' && Date.now() > b.vadeTarihi && b.mahkemeStatus !== 'davali' ? `
            <button onclick="(async()=>{if(confirm('${b.borcluAd} kişisini mahkemeye vermek istiyor musunuz?')){await GZX_borcMahkeme('${b.id}');GZX_renderBorcPaneli(document.getElementById('borcPanelContainer'));}})()"
              style="background:#7f1d1d;color:#fca5a5;border:none;border-radius:7px;padding:6px 14px;font-size:11px;font-weight:700;cursor:pointer">
              ⚖️ Mahkemeye Ver
            </button>` : ''}
        </div>`;
    }

    container.innerHTML = `
      <div style="padding:16px">
        <h3 style="color:#e2e8f0;font-size:15px;font-weight:800;margin:0 0 14px">💰 Borç Sistemi</h3>

        <!-- Yeni Borç Ver -->
        <div style="background:#0d1a2e;border:1px solid #1e3a5f;border-radius:10px;padding:14px;margin-bottom:18px">
          <div style="font-size:12px;font-weight:700;color:#60a5fa;margin-bottom:10px">➕ Yeni Borç Ver</div>
          <input id="borcAlacakliId" placeholder="Alacaklının UID'si veya Kullanıcı Adı"
            style="width:100%;background:#060d18;border:1px solid #1e3a5f;border-radius:7px;color:#e2e8f0;padding:8px;font-size:12px;margin-bottom:6px;box-sizing:border-box">
          <div style="display:flex;gap:6px;margin-bottom:6px">
            <input id="borcMiktar" type="number" placeholder="Miktar (₺)" min="100"
              style="flex:1;background:#060d18;border:1px solid #1e3a5f;border-radius:7px;color:#e2e8f0;padding:8px;font-size:12px">
            <input id="borcVade" type="number" placeholder="Vade (gün)" min="1" max="90" value="30"
              style="width:90px;background:#060d18;border:1px solid #1e3a5f;border-radius:7px;color:#e2e8f0;padding:8px;font-size:12px">
          </div>
          <input id="borcAciklama" placeholder="Borç açıklaması (isteğe bağlı)"
            style="width:100%;background:#060d18;border:1px solid #1e3a5f;border-radius:7px;color:#e2e8f0;padding:8px;font-size:12px;margin-bottom:8px;box-sizing:border-box">
          <button onclick="(async()=>{
            const al=document.getElementById('borcAlacakliId').value.trim();
            const mk=parseInt(document.getElementById('borcMiktar').value)||0;
            const vd=parseInt(document.getElementById('borcVade').value)||30;
            const ac=document.getElementById('borcAciklama').value.trim();
            if(!al||mk<100){toast?.('⛔ UID ve min ₺100 girin','error');return;}
            // UID veya kullanıcı adı ile ara
            let tuid=al;
            if(!al.startsWith('user')){
              const snap=await dbGet('users');
              if(snap){const found=Object.entries(snap).find(([,u])=>u.username?.toLowerCase()===al.toLowerCase());if(found)tuid=found[0];}
            }
            await GZX_borcVer(tuid,mk,ac,vd);
            GZX_renderBorcPaneli(document.getElementById('borcPanelContainer'));
          })()"
            style="width:100%;background:linear-gradient(135deg,#1e40af,#1d4ed8);color:#fff;border:none;border-radius:8px;padding:10px;font-size:12px;font-weight:700;cursor:pointer">
            💸 Borç Ver
          </button>
        </div>

        <!-- Verdiklerim -->
        <div style="font-size:11px;font-weight:800;letter-spacing:1px;color:#475569;margin-bottom:8px">VERDİĞİM BORÇLAR (${verilenler.length})</div>
        ${verilenler.length ? verilenler.map(b => _borcKart(b, 'borclu')).join('') : '<div style="color:#334155;font-size:12px;padding:10px;text-align:center">Verdiğiniz borç yok</div>'}

        <!-- Aldıklarım -->
        <div style="font-size:11px;font-weight:800;letter-spacing:1px;color:#475569;margin:14px 0 8px">ALDIĞIM BORÇLAR (${alinanlar.length})</div>
        ${alinanlar.length ? alinanlar.map(b => _borcKart(b, 'alacakli')).join('') : '<div style="color:#334155;font-size:12px;padding:10px;text-align:center">Aldığınız borç yok</div>'}
      </div>`;
  };

  /* ════════════════════════════════════════════════════════════════════════
     2) BOT OYUNCULAR — Otomatik aktivite
     ════════════════════════════════════════════════════════════════════════ */

  const BOT_ISIMLER = [
    { username: 'Bot_Ahmet',   province: 'İstanbul', avatar: '👨' },
    { username: 'Bot_Ayse',    province: 'Ankara',   avatar: '👩' },
    { username: 'Bot_Mehmet',  province: 'İzmir',    avatar: '🧔' },
    { username: 'Bot_Fatma',   province: 'Bursa',    avatar: '👵' },
    { username: 'Bot_Ali',     province: 'Antalya',  avatar: '👨‍🦱' },
  ];

  const BOT_SIKAYET_LIST = [
    'Mahallemizdeki yol berbat, asfalt yapılması lazım',
    'Sokak lambası 3 gündür yanmıyor',
    'Çöp toplama gecikiyor, mahalle koktu',
    'Su faturalarımız çok yüksek, açıklama bekliyoruz',
    'Park alanı yok, çocuklar oynayacak yer arıyor',
    'Toplu taşıma seferleri azaltıldı, şikayet ediyoruz',
    'Kaldırımlarda bisikletliler tehlike yaratıyor',
    'Mahallemizde hırsızlık olayları arttı, polis önlem alsın',
    'Kanalizasyon sorunu var, belediye gelmiyor',
    'Park yapan araçlar yolu kapatıyor',
    'Gece geç saatte gürültü çıkaranlar oluyor',
    'Sokak köpekleri çoğaldı, kontrolsüz',
    'Esnaflar tabela vergisi çok diye şikayet ediyor',
    'Asgari ücret yetersiz, zam talep ediyoruz',
    'Marketler fiyatları sürekli artırıyor',
  ];

  // Botları kur (admin paneli butonu ile)
  window.GZX_kurulumBotlar = async function() {
    if (!window.GZ?.data?.isFounder) return toast?.('Yetkisiz', 'error');
    let kuruldu = 0;
    for (const bot of BOT_ISIMLER) {
      const exists = await dbGet(`bots/${bot.username}`);
      if (exists) continue;
      const botUid = 'bot_' + bot.username.toLowerCase();
      await dbSet(`bots/${bot.username}`, { uid: botUid, ...bot, createdAt: Date.now() });
      await dbSet(`users/${botUid}`, {
        username: bot.username,
        province: bot.province,
        avatar: bot.avatar,
        money: 50000 + Math.floor(Math.random() * 100000),
        level: 5 + Math.floor(Math.random() * 15),
        xp: Math.floor(Math.random() * 5000),
        role: 'vatandas',
        isBot: true,
        kimlikKarti: { tc: 'BOT' + Date.now().toString().slice(-9) },
        krediSkoru: 50 + Math.floor(Math.random() * 30),
        joinedAt: Date.now(),
      });
      kuruldu++;
    }
    toast?.(`✅ ${kuruldu} bot oyuncu kuruldu/güncellendi`, 'success', 6000);
  };

  // Bot otomatik aktivite (her 5 dk)
  window.GZX_botAktivite = async function() {
    if (!window.GZ?.data?.isFounder) return;
    const bots = await dbGet('bots') || {};
    const botList = Object.values(bots);
    if (!botList.length) return;

    for (const bot of botList) {
      // %30 ihtimalle şikayet yap
      if (Math.random() < 0.3) {
        const sikayet = BOT_SIKAYET_LIST[Math.floor(Math.random() * BOT_SIKAYET_LIST.length)];
        await dbPush(`politics/${bot.province.replace(/\s/g,'_')}/sikayetler`, {
          fromUid: bot.uid,
          username: bot.username,
          message: sikayet,
          ts: Date.now(),
        });
      }

      // %20 ihtimalle haber yap
      if (Math.random() < 0.2) {
        const haberler = [
          `${bot.username}: ${bot.province}'da fiyatlar çok yüksek!`,
          `${bot.username} esnaflara destek çağrısı yaptı`,
          `${bot.province}'dan ${bot.username}: Belediyeye teşekkürler`,
        ];
        await dbPush('news', {
          title: '💬 ' + haberler[Math.floor(Math.random()*haberler.length)],
          type: 'social', impact: 'neutral', ts: Date.now(),
        });
      }
    }
  };

  // Her 5 dakikada bot aktivitesi
  setInterval(() => {
    if (window.GZ?.data?.isFounder) GZX_botAktivite();
  }, 5 * 60 * 1000);

  // Her 5 dakikada admin onay kuyruğunu kontrol et
  setInterval(async () => {
    if (window.GZ?.data?.isFounder) return; // Admin online ise AI asistan çalışmasın
    const queue = await dbGet('approvals/idCard') || {};
    for (const [id, app] of Object.entries(queue)) {
      if (app.status === 'pending' && Date.now() - app.ts > 300000) { // 5 dakika
        await GZX_aiOnayKimlik(id);
      }
    }
  }, 60000); // Her 1 dakikada kontrol et (5 dk geçmişse onaylar)


  /* ════════════════════════════════════════════════════════════════════════
     3) DİNAMİK ÜRÜN FİYATLARI — Saatte bir değişir
     ════════════════════════════════════════════════════════════════════════ */
  window.GZX_dinamikFiyatlar = async function() {
    if (!window.URUNLER) return;
    const updates = {};
    const haberler = [];
    let degistirilen = 0;
    const tumUrunler = Object.entries(window.URUNLER);
    const ornekSayisi = Math.min(8, tumUrunler.length); // Her saat 8 ürün değişir

    // Rastgele 8 ürün seç
    const sample = tumUrunler.sort(() => Math.random() - 0.5).slice(0, ornekSayisi);
    for (const [key, urun] of sample) {
      const eskiFiyat = (await dbGet(`market/baseprices/${key}`)) || urun.base;
      const change = (Math.random() - 0.5) * 0.10; // ±%10
      const yeniFiyat = +(eskiFiyat * (1 + change)).toFixed(2);
      const yuzde = (change * 100).toFixed(1);

      updates[`market/baseprices/${key}`] = yeniFiyat;
      degistirilen++;

      if (Math.abs(change) > 0.05) {
        const yon = change > 0 ? '📈 ARTTI' : '📉 DÜŞTÜ';
        haberler.push(`${urun.emo} ${urun.name} fiyatı %${Math.abs(yuzde)} ${yon}: ${eskiFiyat.toFixed(2)}₺ → ${yeniFiyat.toFixed(2)}₺`);
      }
    }

    if (Object.keys(updates).length > 0) {
      await db.ref('/').update(updates);
    }

    // Önemli değişimleri haberlere yaz
    for (const h of haberler.slice(0, 3)) {
      await dbPush('news', {
        title: h,
        type: 'price_change',
        impact: h.includes('ARTTI') ? 'negative' : 'positive',
        ts: Date.now(),
      });
    }

    return { degistirilen, haberler: haberler.length };
  };

  // Her saat fiyatlar dalgalanır
  setInterval(() => {
    if (window.GZ?.uid) GZX_dinamikFiyatlar();
  }, 60 * 60 * 1000);

  /* ════════════════════════════════════════════════════════════════════════
     4) OTOMATİK HABER JENERATÖRÜ (10 dakikada bir yeni haber)
     ════════════════════════════════════════════════════════════════════════ */
  const HABER_SABLONLARI = [
    { t: '🏦 Merkez Bankası repo faizi sabit tuttu', impact: 'neutral' },
    { t: '📊 Borsa rekorları kırıyor — yatırımcılar kazançlı', impact: 'positive' },
    { t: '⚠️ Döviz piyasalarında dalgalanma', impact: 'negative' },
    { t: '🏗️ Yeni kentsel dönüşüm projesi başladı', impact: 'positive' },
    { t: '⛽ Akaryakıtta indirim haberi piyasayı sevindirdi', impact: 'positive' },
    { t: '📈 Enflasyon beklenenden yüksek geldi', impact: 'negative' },
    { t: '🌾 Buğday hasadı verimli, ekmek fiyatları düşebilir', impact: 'positive' },
    { t: '🚢 İhracat rakamlarında rekor artış', impact: 'positive' },
    { t: '💼 Yeni iş ilanları yayınlandı', impact: 'positive' },
    { t: '🏛️ Hükümet ekonomi paketini açıkladı', impact: 'neutral' },
    { t: '🏭 Sanayi üretiminde toparlanma', impact: 'positive' },
    { t: '🚗 Otomobil satışlarında düşüş', impact: 'negative' },
    { t: '🏥 SGK prim oranları gözden geçirildi', impact: 'neutral' },
    { t: '🌐 Teknoloji sektörü yatırım çekiyor', impact: 'positive' },
    { t: '⚡ Elektrik fiyatlarında değişiklik bekleniyor', impact: 'neutral' },
    { t: '🛒 Marketlerde fiyat denetimi başladı', impact: 'positive' },
    { t: '🚧 Yol yapım ihalesi sonuçlandı', impact: 'positive' },
    { t: '🎓 Eğitim bütçesi artırıldı', impact: 'positive' },
    { t: '💰 Asgari ücret görüşmeleri devam ediyor', impact: 'neutral' },
    { t: '🌱 Çevre yatırımları hızlanıyor', impact: 'positive' },
  ];

  window.GZX_otomatikHaber = async function() {
    const haber = HABER_SABLONLARI[Math.floor(Math.random() * HABER_SABLONLARI.length)];
    await dbPush('news', {
      title: haber.t,
      type: 'auto',
      impact: haber.impact,
      ts: Date.now(),
    });
  };

  // 10 dakikada bir yeni haber
  setInterval(() => {
    if (window.GZ?.uid) GZX_otomatikHaber();
  }, 10 * 60 * 1000);

  /* ════════════════════════════════════════════════════════════════════════
     5) OTOMATİK İHALE JENERATÖRÜ (Günde 3 yeni ihale)
     ════════════════════════════════════════════════════════════════════════ */
  const IHALE_SABLONLARI = [
    { title: '🏗️ Şehir Otoyolu Genişletme Projesi', budget: 5000000, desc: '20 km otoyolun genişletilmesi' },
    { title: '🌳 Park ve Yeşil Alan İhalesi',         budget: 2000000, desc: 'Şehir merkezine yeni park' },
    { title: '🏥 Hastane Tadilat Projesi',            budget: 3500000, desc: 'Devlet hastanesi yenileme' },
    { title: '🏫 Okul Yapım İhalesi',                  budget: 8000000, desc: '500 öğrencilik yeni okul' },
    { title: '🚇 Metro Hat Genişletme',                budget: 25000000, desc: '5 km yeni metro hattı' },
    { title: '💧 Su Şebekesi Yenileme',                budget: 4000000, desc: '50 km su borusu' },
    { title: '🌉 Köprü Onarım İhalesi',                budget: 6000000, desc: '3 köprünün güçlendirilmesi' },
    { title: '🚦 Trafik Sinyalizasyonu',               budget: 1500000, desc: '100 kavşağa akıllı sinyal' },
    { title: '⚡ Sokak Aydınlatma Projesi',            budget: 2500000, desc: 'LED dönüşüm' },
    { title: '🏟️ Spor Tesisi İnşaatı',                budget: 7000000, desc: 'Olimpik yüzme havuzu' },
    { title: '📚 Kütüphane Modernizasyon',             budget: 1800000, desc: 'Dijital kütüphane sistemi' },
    { title: '🚒 İtfaiye Araç Tedariki',                budget: 5500000, desc: '10 yeni itfaiye aracı' },
  ];

  window.GZX_otomatikIhale = async function() {
    const sablon = IHALE_SABLONLARI[Math.floor(Math.random() * IHALE_SABLONLARI.length)];
    const sure = 48 + Math.floor(Math.random() * 72); // 48-120 saat
    const ref = await dbPush('tenders', {
      title: sablon.title,
      budget: sablon.budget,
      description: sablon.desc,
      status: 'open',
      openedAt: Date.now(),
      endsAt: Date.now() + sure * 3600000,
      bids: {},
      autoGenerated: true,
    });
    await dbPush('news', {
      title: `📋 Yeni İhale: ${sablon.title} (${_f(sablon.budget)})`,
      type: 'tender_auto', impact: 'positive', ts: Date.now(),
    });
  };

  // 8 saatte bir yeni ihale (günde 3)
  setInterval(() => {
    if (window.GZ?.data?.isFounder) GZX_otomatikIhale();
  }, 8 * 3600000);

  /* ════════════════════════════════════════════════════════════════════════
     6) ENERJİ SANAYİSİ — Admin yönetir, oyuncu satın alır
     ════════════════════════════════════════════════════════════════════════ */
  window.GZX_setEnergyPrice = async function(elektrik, gaz, su) {
    if (!window.GZ?.data?.isFounder) return toast?.('Yetkisiz', 'error');
    await dbUpdate('system/energyPrices', {
      elektrik: elektrik,    // kWh başına
      dogalgaz: gaz,         // m³ başına
      su: su,                // m³ başına
      updatedAt: Date.now(),
    });
    await dbPush('news', {
      title: `⚡ Enerji fiyatları güncellendi: Elektrik ${elektrik}₺/kWh`,
      type: 'energy', impact: 'neutral', ts: Date.now(),
    });
    toast?.('⚡ Enerji fiyatları güncellendi', 'success');
  };

  window.GZX_buyEnergy = async function(uid, type, amount) {
    const prices = (await dbGet('system/energyPrices')) || { elektrik: 2.50, dogalgaz: 8.00, su: 1.50 };
    const fiyat = prices[type] * amount;
    const ok = await spendCash(uid, fiyat, `Enerji: ${type} (${amount} birim)`);
    if (!ok) return toast?.('💸 Yetersiz bakiye', 'error');
    await dbTransaction(`users/${uid}/energyAccount/${type}`, v => (v||0) + amount);
    toast?.(`⚡ ${amount} ${type} satın alındı: ${_f(fiyat)}`, 'success');
  };

  /* ════════════════════════════════════════════════════════════════════════
     7) ÇALIŞAN MAHKEME EKRANI
     ════════════════════════════════════════════════════════════════════════ */
  window.renderMahkeme = async function() {
    const main = document.getElementById('appMain'); if (!main) return;
    const uid  = window.GZ?.uid; if (!uid) return;
    const d    = await dbGet(`users/${uid}`) || {};
    const isJudge = d.role === 'judge' || d.isFounder;
    const myCases = Object.entries(await dbGet('davalar') || {})
      .filter(([,c]) => c.uid === uid || c.karsi === uid)
      .sort(([,a],[,b]) => (b.acilanAt||0) - (a.acilanAt||0));

    main.innerHTML = `
      <div style="padding:16px 16px 100px">
        <div style="text-align:center;padding:8px 0 16px">
          <div style="font-size:42px;margin-bottom:8px">⚖️</div>
          <div style="font-size:20px;font-weight:800;color:var(--text)">Mahkeme</div>
          <div style="font-size:12px;color:var(--muted);margin-top:4px">Hukuki işlemler ve dava takibi</div>
        </div>

        <div style="background:var(--card);border:1px solid var(--border);border-radius:14px;padding:16px;margin-bottom:12px">
          <div style="font-size:11px;color:var(--muted);font-weight:700;letter-spacing:1.5px;margin-bottom:12px">⚖️ YENİ DAVA AÇ</div>
          <input id="dava_karsi" placeholder='Davalı (kullanıcı adı veya "Devlet")' style="width:100%;padding:10px;background:var(--bg);border:1px solid var(--border);border-radius:8px;color:var(--text);margin-bottom:8px;box-sizing:border-box">
          <input id="dava_sebep" placeholder="Dava konusu (örn: Haksız ceza itirazı)" style="width:100%;padding:10px;background:var(--bg);border:1px solid var(--border);border-radius:8px;color:var(--text);margin-bottom:8px;box-sizing:border-box">
          <select id="dava_avukat" style="width:100%;padding:10px;background:var(--bg);border:1px solid var(--border);border-radius:8px;color:var(--text);margin-bottom:10px">
            <option value="none">Avukatsız (riskli) — Ücretsiz</option>
            <option value="junior">Junior Avukat — 5.000₺</option>
            <option value="senior">Kıdemli Avukat — 25.000₺ (kazanma şansı yüksek)</option>
            <option value="top">Baş Avukat — 100.000₺ (en yüksek başarı)</option>
          </select>
          <button onclick="(async()=>{
            const k=document.getElementById('dava_karsi').value;
            const s=document.getElementById('dava_sebep').value;
            const av=document.getElementById('dava_avukat').value;
            const ucret={none:0,junior:5000,senior:25000,top:100000}[av]||0;
            if(!k||!s){toast('Tüm alanları doldurun','error');return;}
            if(ucret>0){const r=await spendCash('${uid}',ucret,'Avukat ücreti');if(!r){toast('💸 Yetersiz bakiye','error');return;}}
            await dbPush('davalar',{uid:'${uid}',karsi:k,sebep:s,avukat:av,ucret,status:'acik',acilanAt:Date.now()});
            toast('⚖️ Dava açıldı, hakim kararı bekleniyor','success',6000);
            renderMahkeme();
          })()" style="width:100%;background:var(--primary);color:white;border:none;border-radius:10px;padding:12px;font-weight:700;cursor:pointer">
            ⚖️ Davayı Aç
          </button>
        </div>

        <div style="background:var(--card);border:1px solid var(--border);border-radius:14px;padding:16px">
          <div style="font-size:11px;color:var(--muted);font-weight:700;letter-spacing:1.5px;margin-bottom:12px">📋 DAVA DOSYALARIM</div>
          ${myCases.length ? myCases.slice(0,10).map(([id,c]) => {
            const statusColor = c.status==='acik'?'var(--accent)':c.status==='kazanildi'?'var(--green)':'var(--red)';
            const statusText = c.status==='acik'?'⏳ Açık':c.status==='kazanildi'?'✅ Kazanıldı':'❌ Kaybedildi';
            return `
              <div style="background:var(--bg);border-radius:10px;padding:12px;margin-bottom:8px">
                <div style="display:flex;justify-content:space-between;align-items:flex-start">
                  <div style="flex:1">
                    <div style="font-size:13px;font-weight:700;color:var(--text)">${c.sebep||'Dava'}</div>
                    <div style="font-size:11px;color:var(--muted);margin-top:2px">Davalı: ${c.karsi||'?'} · ${_ts(c.acilanAt||0)}</div>
                  </div>
                  <span style="color:${statusColor};font-size:12px;font-weight:700">${statusText}</span>
                </div>
              </div>`;
          }).join('') : '<div style="text-align:center;padding:16px;color:var(--muted);font-size:12px">Açılmış davanız yok</div>'}
        </div>

        ${isJudge ? `
          <div style="background:linear-gradient(135deg,#7c3aed22,#a855f722);border:2px solid var(--primary);border-radius:14px;padding:16px;margin-top:12px">
            <div style="font-size:11px;color:var(--primary);font-weight:800;letter-spacing:1.5px;margin-bottom:12px">⚖️ HAKİM YETKİLERİNİZ</div>
            <button onclick="if(window.AP)AP.openAdminPanel();setTimeout(()=>openMahkemeAdmin(),500)"
              style="width:100%;background:var(--primary);color:white;border:none;border-radius:10px;padding:12px;font-weight:700;cursor:pointer">
              ⚖️ Mahkeme Yönetim Paneli
            </button>
          </div>` : ''}
      </div>`;
  };


  /* ════════════════════════════════════════════════════════════════════════
     8) ÇALIŞAN NOTERLİK
     ════════════════════════════════════════════════════════════════════════ */
  window.renderNoter = async function() {
    const main = document.getElementById('appMain'); if (!main) return;
    const uid  = window.GZ?.uid; if (!uid) return;
    const belgeler = Object.entries(await dbGet(`users/${uid}/noterBelgeleri`) || {})
      .sort(([,a],[,b]) => (b.ts||0) - (a.ts||0));

    const HIZMETLER = [
      { k:'kira',     i:'🤝', n:'Kira Sözleşmesi', f:500 },
      { k:'is',       i:'💼', n:'İş Sözleşmesi',   f:750 },
      { k:'tapu',     i:'🏠', n:'Tapu Devri',       f:2000 },
      { k:'vekalet',  i:'📋', n:'Vekaletname',      f:1000 },
      { k:'ortakl',   i:'🏭', n:'Ortaklık Sözleşmesi', f:3000 },
      { k:'vasiyet',  i:'📄', n:'Vasiyetname',     f:1500 },
    ];

    main.innerHTML = `
      <div style="padding:16px 16px 100px">
        <div style="text-align:center;padding:8px 0 16px">
          <div style="font-size:42px;margin-bottom:8px">📜</div>
          <div style="font-size:20px;font-weight:800;color:var(--text)">Noterlik</div>
          <div style="font-size:12px;color:var(--muted);margin-top:4px">Resmi belge tasdiki</div>
        </div>

        <div style="background:var(--card);border:1px solid var(--border);border-radius:14px;padding:16px;margin-bottom:12px">
          <div style="font-size:11px;color:var(--muted);font-weight:700;letter-spacing:1.5px;margin-bottom:12px">📋 BELGE TASDİK İŞLEMLERİ</div>
          ${HIZMETLER.map(h => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:12px;background:var(--bg);border-radius:10px;margin-bottom:8px">
              <div>
                <div style="font-size:13px;font-weight:700;color:var(--text)">${h.i} ${h.n}</div>
                <div style="font-size:11px;color:var(--muted);margin-top:2px">Tasdik ücreti</div>
              </div>
              <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
                <span style="font-size:13px;font-weight:700;color:var(--primary)">${_f(h.f)}</span>
                <button onclick="(async()=>{
                  const r=await spendCash('${uid}',${h.f},'Noter: ${h.n}');
                  if(!r){toast('💸 Yetersiz bakiye','error');return;}
                  await dbPush('users/${uid}/noterBelgeleri',{type:'${h.k}',ad:'${h.n}',ucret:${h.f},ts:Date.now()});
                  toast('✅ ${h.n} tasdiklendi','success');
                  renderNoter();
                })()" style="background:var(--primary);color:white;border:none;border-radius:6px;padding:5px 10px;font-size:11px;font-weight:700;cursor:pointer">📄 Tasdik Et</button>
              </div>
            </div>`).join('')}
        </div>

        <div style="background:var(--card);border:1px solid var(--border);border-radius:14px;padding:16px">
          <div style="font-size:11px;color:var(--muted);font-weight:700;letter-spacing:1.5px;margin-bottom:12px">📜 BELGELERIM</div>
          ${belgeler.length ? belgeler.slice(0,10).map(([id,b]) => `
            <div style="padding:10px 0;border-bottom:1px solid var(--border)">
              <div style="display:flex;justify-content:space-between">
                <span style="font-size:13px;font-weight:600;color:var(--text)">${b.ad||'Belge'}</span>
                <span style="font-size:11px;color:var(--muted)">${_ts(b.ts||0)}</span>
              </div>
            </div>`).join('') : '<div style="text-align:center;padding:16px;color:var(--muted);font-size:12px">Belge yok</div>'}
        </div>
      </div>`;
  };

  /* ════════════════════════════════════════════════════════════════════════
     9) ÇALIŞAN VERGİ DAİRESİ
     ════════════════════════════════════════════════════════════════════════ */
  window.renderVergi = async function() {
    const main = document.getElementById('appMain'); if (!main) return;
    const uid  = window.GZ?.uid; if (!uid) return;
    const d    = await dbGet(`users/${uid}`) || {};
    const kdv  = (await dbGet('system/kdv')) || 0.20;
    const odenmis = Object.values(await dbGet(`users/${uid}/vergiler`) || {})
      .sort((a,b) => (b.ts||0) - (a.ts||0)).slice(0,10);
    const toplamOdenmis = odenmis.reduce((s,v) => s + (v.amount||0), 0);
    const taxAmnesty = await dbGet('system/taxAmnesty');

    main.innerHTML = `
      <div style="padding:16px 16px 100px">
        <div style="text-align:center;padding:8px 0 16px">
          <div style="font-size:42px;margin-bottom:8px">🧾</div>
          <div style="font-size:20px;font-weight:800;color:var(--text)">Vergi Dairesi</div>
          <div style="font-size:12px;color:var(--muted);margin-top:4px">Vergi beyan ve ödeme</div>
        </div>

        <div style="background:var(--card);border:1px solid var(--border);border-radius:14px;padding:16px;margin-bottom:12px">
          <div style="font-size:11px;color:var(--muted);font-weight:700;letter-spacing:1.5px;margin-bottom:12px">📊 VERGİ BİLGİLERİM</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            <div style="background:var(--bg);border-radius:8px;padding:10px;text-align:center">
              <div style="font-size:10px;color:var(--muted)">KDV Oranı</div>
              <div style="font-size:18px;font-weight:800;color:var(--primary)">%${(kdv*100).toFixed(0)}</div>
            </div>
            <div style="background:var(--bg);border-radius:8px;padding:10px;text-align:center">
              <div style="font-size:10px;color:var(--muted)">Ödenmiş Vergi</div>
              <div style="font-size:14px;font-weight:800;color:var(--green)">${_f(toplamOdenmis)}</div>
            </div>
            <div style="background:var(--bg);border-radius:8px;padding:10px;text-align:center">
              <div style="font-size:10px;color:var(--muted)">Vergi Borcu</div>
              <div style="font-size:14px;font-weight:800;color:${(d.vergiBorc||0)>0?'var(--red)':'var(--green)'}">${_f(d.vergiBorc||0)}</div>
            </div>
            <div style="background:var(--bg);border-radius:8px;padding:10px;text-align:center">
              <div style="font-size:10px;color:var(--muted)">Toplam Gelir</div>
              <div style="font-size:14px;font-weight:800;color:var(--text)">${_f(d.aylikGelir||0)}</div>
            </div>
          </div>
        </div>

        ${taxAmnesty?.active ? `
          <div style="background:linear-gradient(135deg,#22c55e22,#16a34a22);border:2px solid var(--green);border-radius:14px;padding:14px;margin-bottom:12px">
            <div style="font-size:14px;font-weight:800;color:var(--green);margin-bottom:6px">🎁 VERGİ AFFI YÜRÜRLÜKTE!</div>
            <div style="font-size:12px;color:var(--text)">İndirim: %${taxAmnesty.pct||30} · Son tarih: ${new Date(taxAmnesty.deadline||0).toLocaleDateString('tr-TR')}</div>
          </div>` : ''}

        <div style="background:var(--card);border:1px solid var(--border);border-radius:14px;padding:16px;margin-bottom:12px">
          <div style="font-size:11px;color:var(--muted);font-weight:700;letter-spacing:1.5px;margin-bottom:12px">💸 VERGİ BORCU ÖDEME</div>
          ${(d.vergiBorc||0) > 0 ? `
            <div style="display:flex;justify-content:space-between;align-items:center;background:var(--bg);border-radius:10px;padding:14px">
              <div style="font-size:14px;color:var(--red);font-weight:700">Borç: ${_f(d.vergiBorc)}</div>
              <button onclick="(async()=>{
                const indirim=${taxAmnesty?.active?taxAmnesty.pct/100:0};
                const odenecek=${d.vergiBorc||0}*(1-indirim);
                const r=await spendCash('${uid}',odenecek,'Vergi borcu ödeme');
                if(!r){toast('💸 Yetersiz bakiye','error');return;}
                await dbUpdate('users/${uid}',{vergiBorc:0});
                await dbPush('users/${uid}/vergiler',{amount:odenecek,type:'borc-odeme',ts:Date.now()});
                await addCash('system_treasury',odenecek,'Hazineye vergi');
                toast('✅ Vergi borcu kapatıldı','success');renderVergi();
              })()" style="background:var(--green);color:white;border:none;border-radius:8px;padding:8px 14px;font-size:12px;font-weight:700;cursor:pointer">
                💸 Borcu Öde${taxAmnesty?.active?` (-${taxAmnesty.pct}%)`:''}
              </button>
            </div>` : '<div style="text-align:center;padding:14px;color:var(--green);font-size:13px;font-weight:700">✅ Vergi borcunuz yok</div>'}
        </div>

        <div style="background:var(--card);border:1px solid var(--border);border-radius:14px;padding:16px">
          <div style="font-size:11px;color:var(--muted);font-weight:700;letter-spacing:1.5px;margin-bottom:12px">📋 ÖDENEN VERGİLER</div>
          ${odenmis.length ? odenmis.slice(0,8).map(v => `
            <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)">
              <span style="font-size:12px;color:var(--text)">${v.type||v.source||'Vergi'}</span>
              <span style="font-size:12px;color:var(--green);font-weight:700">${_f(v.amount||0)}</span>
            </div>`).join('') : '<div style="text-align:center;padding:14px;color:var(--muted);font-size:12px">Kayıt yok</div>'}
        </div>
      </div>`;
  };

  /* ════════════════════════════════════════════════════════════════════════
     10) ÇALIŞAN KREDI OFISI
     ════════════════════════════════════════════════════════════════════════ */
  window.renderKredi = async function() {
    const main = document.getElementById('appMain'); if (!main) return;
    const uid  = window.GZ?.uid; if (!uid) return;
    const d    = await dbGet(`users/${uid}`) || {};
    const krediler = Object.entries(await dbGet(`users/${uid}/krediler`) || {});
    const skor = await GZX_B03_calcCreditScore(uid);
    const repo = (await dbGet('bank/repoRate')) || 0.42;

    const TIPLER = [
      { k:'ihtiyac', i:'💳', n:'İhtiyaç', max:200000,    rate:0.28+repo*0.5, minSkor:40 },
      { k:'ticari',  i:'🏪', n:'Ticari',  max:5000000,   rate:0.22+repo*0.5, minSkor:55 },
      { k:'konut',   i:'🏠', n:'Konut',    max:20000000,  rate:0.18+repo*0.5, minSkor:60 },
      { k:'ihracat', i:'🚢', n:'İhracat',  max:10000000,  rate:0.15+repo*0.5, minSkor:65 },
      { k:'tarim',   i:'🌾', n:'Tarım',    max:1000000,   rate:0.12+repo*0.5, minSkor:30 },
    ];

    main.innerHTML = `
      <div style="padding:16px 16px 100px">
        <div style="text-align:center;padding:8px 0 16px">
          <div style="font-size:42px;margin-bottom:8px">💳</div>
          <div style="font-size:20px;font-weight:800;color:var(--text)">Kredi Ofisi</div>
          <div style="font-size:12px;color:var(--muted);margin-top:4px">Banka kredileri ve ödeme planları</div>
        </div>

        <div style="background:var(--card);border:1px solid var(--border);border-radius:14px;padding:16px;margin-bottom:12px">
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
            <div style="background:var(--bg);border-radius:10px;padding:12px;text-align:center">
              <div style="font-size:10px;color:var(--muted)">Kredi Skoru</div>
              <div style="font-size:24px;font-weight:900;color:${skor>=60?'var(--green)':skor>=40?'var(--accent)':'var(--red)'}">${skor}</div>
              <div style="font-size:10px;color:var(--muted)">/100</div>
            </div>
            <div style="background:var(--bg);border-radius:10px;padding:12px;text-align:center">
              <div style="font-size:10px;color:var(--muted)">Repo Faizi</div>
              <div style="font-size:18px;font-weight:800;color:var(--primary)">%${(repo*100).toFixed(1)}</div>
            </div>
            <div style="background:var(--bg);border-radius:10px;padding:12px;text-align:center">
              <div style="font-size:10px;color:var(--muted)">Aktif Kredi</div>
              <div style="font-size:18px;font-weight:800;color:var(--text)">${krediler.filter(([,k])=>k.status==='active').length}</div>
            </div>
          </div>
        </div>

        <div style="background:var(--card);border:1px solid var(--border);border-radius:14px;padding:16px;margin-bottom:12px">
          <div style="font-size:11px;color:var(--muted);font-weight:700;letter-spacing:1.5px;margin-bottom:12px">💳 KREDİ BAŞVUR</div>
          ${TIPLER.map(t => `
            <div style="background:var(--bg);border-radius:10px;padding:12px;margin-bottom:8px">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
                <div>
                  <div style="font-size:13px;font-weight:700;color:var(--text)">${t.i} ${t.n} Kredisi</div>
                  <div style="font-size:11px;color:var(--muted)">Max: ${_f(t.max)} · Faiz: %${(t.rate*100).toFixed(1)}/yıl · Min skor: ${t.minSkor}</div>
                </div>
                ${skor < t.minSkor ? '<span style="color:var(--red);font-size:11px;font-weight:700">❌ Skor Yetersiz</span>' : ''}
              </div>
              ${skor >= t.minSkor ? `
                <div style="display:flex;gap:6px">
                  <input id="krd_${t.k}_amt" type="number" placeholder="Tutar (₺)" style="flex:2;padding:8px;background:var(--card);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:12px">
                  <input id="krd_${t.k}_term" type="number" placeholder="Ay" style="flex:1;padding:8px;background:var(--card);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:12px">
                  <button onclick="(async()=>{
                    const amt=parseInt(document.getElementById('krd_${t.k}_amt').value)||0;
                    const term=parseInt(document.getElementById('krd_${t.k}_term').value)||12;
                    if(amt<=0||amt>${t.max}){toast('Geçersiz tutar','error');return;}
                    await GZX_B04_applyForLoan('${uid}','${t.k}',amt,term);
                    setTimeout(()=>renderKredi(),500);
                  })()" style="background:var(--primary);color:white;border:none;border-radius:6px;padding:8px 12px;font-size:12px;font-weight:700;cursor:pointer">Başvur</button>
                </div>` : ''}
            </div>`).join('')}
        </div>

        <div style="background:var(--card);border:1px solid var(--border);border-radius:14px;padding:16px">
          <div style="font-size:11px;color:var(--muted);font-weight:700;letter-spacing:1.5px;margin-bottom:12px">📋 KREDİLERİM</div>
          ${krediler.length ? krediler.map(([id,k]) => `
            <div style="background:var(--bg);border-radius:10px;padding:12px;margin-bottom:8px">
              <div style="display:flex;justify-content:space-between">
                <div>
                  <div style="font-size:13px;font-weight:700;color:var(--text)">${k.type||'Kredi'} - ${_f(k.amount||0)}</div>
                  <div style="font-size:11px;color:var(--muted)">Taksit: ${_f(k.monthlyPayment||0)}/ay · ${k.term||0} ay</div>
                  <div style="font-size:11px;color:var(--muted)">Kalan: ${_f(k.remainingBalance||0)}</div>
                </div>
                <span style="color:${k.status==='active'?'var(--accent)':'var(--green)'};font-size:11px;font-weight:700">${k.status==='active'?'⏳':'✅'}</span>
              </div>
              ${k.status==='active'?`
                <button onclick="GZX_B20_earlyPayoff('${uid}','${id}').then(()=>renderKredi())" style="margin-top:6px;background:var(--green);color:white;border:none;border-radius:6px;padding:6px 12px;font-size:11px;font-weight:700;cursor:pointer">⚡ Erken Kapat (-%3)</button>
              `:''}
            </div>`).join('') : '<div style="text-align:center;padding:14px;color:var(--muted);font-size:12px">Kredi yok</div>'}
        </div>
      </div>`;
  };

  /* ════════════════════════════════════════════════════════════════════════
     11) KONKORDATO / BORÇ YAPILANDIRMA — Admin onaylı
     ════════════════════════════════════════════════════════════════════════ */
  window.renderKonkurato = async function() {
    const main = document.getElementById('appMain'); if (!main) return;
    const uid  = window.GZ?.uid; if (!uid) return;
    const d    = await dbGet(`users/${uid}`) || {};
    const totalDebt = (d.borglar||0) + (d.vergiBorc||0) +
      Object.values(await dbGet(`users/${uid}/krediler`) || {}).reduce((s,k) => s + (k.status==='active'?k.remainingBalance||0:0), 0);
    const myAppl = Object.entries(await dbGet('approvals/konkordato') || {})
      .filter(([,a]) => a.uid === uid).sort(([,a],[,b]) => (b.ts||0)-(a.ts||0));

    main.innerHTML = `
      <div style="padding:16px 16px 100px">
        <div style="text-align:center;padding:8px 0 16px">
          <div style="font-size:42px;margin-bottom:8px">🚫</div>
          <div style="font-size:20px;font-weight:800;color:var(--text)">Konkordato</div>
          <div style="font-size:12px;color:var(--muted);margin-top:4px">Borç yapılandırma başvurusu</div>
        </div>

        <div style="background:var(--card);border:1px solid var(--border);border-radius:14px;padding:16px;margin-bottom:12px;text-align:center">
          <div style="font-size:11px;color:var(--muted);margin-bottom:4px">TOPLAM BORÇ</div>
          <div style="font-size:32px;font-weight:900;color:${totalDebt>0?'var(--red)':'var(--green)'}">${_f(totalDebt)}</div>
        </div>

        ${totalDebt > 0 ? `
          <div style="background:var(--card);border:1px solid var(--border);border-radius:14px;padding:16px;margin-bottom:12px">
            <div style="font-size:11px;color:var(--muted);font-weight:700;letter-spacing:1.5px;margin-bottom:12px">📋 KONKORDATO BAŞVURUSU</div>
            <p style="font-size:12px;color:var(--muted);margin-bottom:12px;line-height:1.6">
              Borçlarınızı 36 aya kadar uzun vadeye yayabilirsiniz. Hakim ve adminin onayı gerekir.
              Onay süreci 30 saniye içinde otomatik incelenecektir.
            </p>
            <div style="background:var(--bg);border-radius:8px;padding:10px;margin-bottom:10px;font-size:12px;color:var(--text)">
              <b>📊 Yapılandırma Önerisi:</b><br>
              • 36 aylık vade<br>
              • %25 indirim<br>
              • Aylık taksit: ${_f(totalDebt*0.75/36)}<br>
              • Başvuru ücreti: 5.000₺
            </div>
            <button onclick="(async()=>{
              const r=await spendCash('${uid}',5000,'Konkordato başvurusu');
              if(!r){toast('💸 Başvuru ücreti yetersiz','error');return;}
              const ref=await dbPush('approvals/konkordato',{uid:'${uid}',username:'${d.username||'Anonim'}',totalDebt:${totalDebt},status:'pending',ts:Date.now()});
              toast('📋 Konkordato başvurunuz alındı, inceleme başladı','success',6000);
              setTimeout(async()=>{
                const data=await dbGet('approvals/konkordato/'+ref.key);
                if(data?.status==='pending'){
                  const ao=${(await _isAdminOnline())};
                  if(!ao){
                    if(${totalDebt}>10000){
                      await dbUpdate('users/${uid}',{borglar:Math.max(0,(${d.borglar||0}*0.75)),vergiBorc:Math.max(0,(${d.vergiBorc||0}*0.75)),konkordatoAt:Date.now()});
                      await dbUpdate('approvals/konkordato/'+ref.key,{status:'approved',by:'AI-Hakim'});
                      GZX_notify('${uid}','✅ Konkordato onaylandı! Borçlarınız %25 indirildi','success');
                    }else{
                      await dbUpdate('approvals/konkordato/'+ref.key,{status:'rejected',by:'AI-Hakim',reason:'Borç tutarı yetersiz'});
                      GZX_notify('${uid}','❌ Konkordato reddedildi: Borç tutarı çok düşük','error');
                    }
                  }
                }
              },30000);
              renderKonkurato();
            })()" style="width:100%;background:var(--accent);color:#000;border:none;border-radius:10px;padding:12px;font-weight:700;cursor:pointer">
              📋 Konkordato Başvur (5.000₺)
            </button>
          </div>` : `
          <div style="background:var(--card);border:1px solid var(--border);border-radius:14px;padding:24px;text-align:center">
            <div style="font-size:48px;margin-bottom:8px">✅</div>
            <div style="font-size:14px;font-weight:700;color:var(--green)">Borçsuzsunuz!</div>
          </div>`}

        <div style="background:var(--card);border:1px solid var(--border);border-radius:14px;padding:16px">
          <div style="font-size:11px;color:var(--muted);font-weight:700;letter-spacing:1.5px;margin-bottom:12px">📋 BAŞVURULARIM</div>
          ${myAppl.length ? myAppl.slice(0,5).map(([id,a]) => `
            <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border)">
              <span style="font-size:12px;color:var(--text)">${_f(a.totalDebt)} - ${_ts(a.ts)}</span>
              <span style="color:${a.status==='approved'?'var(--green)':a.status==='rejected'?'var(--red)':'var(--accent)'};font-weight:700;font-size:11px">${a.status==='approved'?'✅ Onaylandı':a.status==='rejected'?'❌ Reddedildi':'⏳ Bekliyor'}</span>
            </div>`).join('') : '<div style="text-align:center;padding:14px;color:var(--muted);font-size:12px">Başvuru yok</div>'}
        </div>
      </div>`;
  };

  /* ════════════════════════════════════════════════════════════════════════
     12) ÇALIŞAN ENERJİ SANAYİSİ EKRANI
     ════════════════════════════════════════════════════════════════════════ */
  window.renderEnerji = async function() {
    const main = document.getElementById('appMain'); if (!main) return;
    const uid  = window.GZ?.uid; if (!uid) return;
    const d    = await dbGet(`users/${uid}`) || {};
    const prices = (await dbGet('system/energyPrices')) || { elektrik:2.50, dogalgaz:8.00, su:1.50 };

    main.innerHTML = `
      <div style="padding:16px 16px 100px">
        <div style="text-align:center;padding:8px 0 16px">
          <div style="font-size:42px;margin-bottom:8px">⚡</div>
          <div style="font-size:20px;font-weight:800;color:var(--text)">Enerji Sanayisi</div>
          <div style="font-size:12px;color:var(--muted);margin-top:4px">Elektrik · Doğalgaz · Su</div>
        </div>

        <div style="background:var(--card);border:1px solid var(--border);border-radius:14px;padding:16px;margin-bottom:12px">
          <div style="font-size:11px;color:var(--muted);font-weight:700;letter-spacing:1.5px;margin-bottom:12px">⚡ ENERJİ HESAPLARI</div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
            <div style="background:var(--bg);border-radius:10px;padding:12px;text-align:center">
              <div style="font-size:24px;margin-bottom:4px">⚡</div>
              <div style="font-size:11px;color:var(--muted)">Elektrik</div>
              <div style="font-size:14px;font-weight:800;color:var(--accent)">${(d.energyAccount?.elektrik||0).toFixed(0)} kWh</div>
              <div style="font-size:10px;color:var(--muted);margin-top:2px">${prices.elektrik}₺/kWh</div>
            </div>
            <div style="background:var(--bg);border-radius:10px;padding:12px;text-align:center">
              <div style="font-size:24px;margin-bottom:4px">🔥</div>
              <div style="font-size:11px;color:var(--muted)">Doğalgaz</div>
              <div style="font-size:14px;font-weight:800;color:var(--primary)">${(d.energyAccount?.dogalgaz||0).toFixed(0)} m³</div>
              <div style="font-size:10px;color:var(--muted);margin-top:2px">${prices.dogalgaz}₺/m³</div>
            </div>
            <div style="background:var(--bg);border-radius:10px;padding:12px;text-align:center">
              <div style="font-size:24px;margin-bottom:4px">💧</div>
              <div style="font-size:11px;color:var(--muted)">Su</div>
              <div style="font-size:14px;font-weight:800;color:var(--green)">${(d.energyAccount?.su||0).toFixed(0)} m³</div>
              <div style="font-size:10px;color:var(--muted);margin-top:2px">${prices.su}₺/m³</div>
            </div>
          </div>
        </div>

        <div style="background:var(--card);border:1px solid var(--border);border-radius:14px;padding:16px">
          <div style="font-size:11px;color:var(--muted);font-weight:700;letter-spacing:1.5px;margin-bottom:12px">🛒 ENERJİ SATIN AL</div>
          ${[
            {k:'elektrik', n:'Elektrik (kWh)', i:'⚡'},
            {k:'dogalgaz', n:'Doğalgaz (m³)',  i:'🔥'},
            {k:'su',       n:'Su (m³)',         i:'💧'},
          ].map(e => `
            <div style="background:var(--bg);border-radius:10px;padding:12px;margin-bottom:8px">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
                <span style="font-size:13px;font-weight:700;color:var(--text)">${e.i} ${e.n}</span>
                <span style="font-size:13px;color:var(--primary);font-weight:700">${prices[e.k]}₺/birim</span>
              </div>
              <div style="display:flex;gap:6px">
                <input id="enr_${e.k}_amt" type="number" placeholder="Miktar" style="flex:1;padding:8px;background:var(--card);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:12px">
                <button onclick="(async()=>{
                  const amt=parseInt(document.getElementById('enr_${e.k}_amt').value)||0;
                  if(amt<=0)return;
                  await GZX_buyEnergy('${uid}','${e.k}',amt);renderEnerji();
                })()" style="background:var(--primary);color:white;border:none;border-radius:6px;padding:8px 14px;font-size:12px;font-weight:700;cursor:pointer">🛒 Al</button>
              </div>
            </div>`).join('')}
        </div>
      </div>`;
  };

  /* ════════════════════════════════════════════════════════════════════════
     13) Sözleşmeler ekranı — temel
     ════════════════════════════════════════════════════════════════════════ */
  window.renderSozlesme = async function() {
    const main = document.getElementById('appMain'); if (!main) return;
    const uid  = window.GZ?.uid; if (!uid) return;
    const sozlesmeler = Object.entries(await dbGet(`users/${uid}/noterBelgeleri`) || {}).filter(([,b]) => ['kira','is','ortakl'].includes(b.type));

    main.innerHTML = `
      <div style="padding:16px 16px 100px">
        <div style="text-align:center;padding:8px 0 16px">
          <div style="font-size:42px;margin-bottom:8px">📝</div>
          <div style="font-size:20px;font-weight:800;color:var(--text)">Sözleşmelerim</div>
          <div style="font-size:12px;color:var(--muted);margin-top:4px">Aktif anlaşmalar</div>
        </div>

        <div style="background:var(--card);border:1px solid var(--border);border-radius:14px;padding:16px">
          ${sozlesmeler.length ? sozlesmeler.map(([id,s]) => `
            <div style="background:var(--bg);border-radius:10px;padding:12px;margin-bottom:8px">
              <div style="font-size:13px;font-weight:700;color:var(--text)">${s.ad||s.type}</div>
              <div style="font-size:11px;color:var(--muted);margin-top:2px">${_ts(s.ts||0)}</div>
            </div>`).join('') : `
            <div style="text-align:center;padding:24px;color:var(--muted)">
              <div style="font-size:32px;margin-bottom:8px">📝</div>
              <div style="font-size:13px">Sözleşmeniz yok</div>
              <button onclick="switchTab('noter')" style="margin-top:10px;background:var(--primary);color:white;border:none;border-radius:8px;padding:8px 16px;font-size:12px;font-weight:700;cursor:pointer">📜 Notere Git</button>
            </div>`}
        </div>
      </div>`;
  };

  /* ════════════════════════════════════════════════════════════════════════
     14) İşveren Personel Sigorta Ödeme
     ════════════════════════════════════════════════════════════════════════ */
  window.renderCalisan = async function() {
    const main = document.getElementById('appMain'); if (!main) return;
    const uid  = window.GZ?.uid; if (!uid) return;
    const calisanlar = Object.entries(await dbGet(`users/${uid}/calisanlar`) || {});
    const sgkRate = (await dbGet('system/sgkRate')) || 0.145;

    main.innerHTML = `
      <div style="padding:16px 16px 100px">
        <div style="text-align:center;padding:8px 0 16px">
          <div style="font-size:42px;margin-bottom:8px">👷</div>
          <div style="font-size:20px;font-weight:800;color:var(--text)">Personel Yönetimi</div>
          <div style="font-size:12px;color:var(--muted);margin-top:4px">Çalışan tut, maaş & sigorta öde</div>
        </div>

        <div style="background:var(--card);border:1px solid var(--border);border-radius:14px;padding:16px;margin-bottom:12px">
          <div style="font-size:11px;color:var(--muted);font-weight:700;letter-spacing:1.5px;margin-bottom:12px">👷 PERSONEL İŞE AL</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            ${[
              {t:'🔧 Teknisyen',m:15000},
              {t:'📦 Depocu',m:12000},
              {t:'🚗 Şoför',m:14000},
              {t:'📊 Muhasebeci',m:18000},
              {t:'👨‍💼 Müdür',m:25000},
              {t:'🛡️ Güvenlik',m:13000},
            ].map(r => `
              <button onclick="(async()=>{
                const ok=await spendCash('${uid}',${r.m},'İşe alım: ${r.t}');
                if(!ok){toast('💸 Yetersiz bakiye','error');return;}
                await dbPush('users/${uid}/calisanlar',{title:'${r.t}',salary:${r.m},hiredAt:Date.now(),sigorta:false});
                toast('✅ ${r.t} işe alındı','success');renderCalisan();
              })()" style="background:var(--blue-l);color:var(--primary);border:1px solid var(--primary)44;border-radius:10px;padding:10px;font-size:11px;font-weight:700;cursor:pointer;text-align:left">
                ${r.t}<br><small>${_f(r.m)}/ay</small>
              </button>
            `).join('')}
          </div>
        </div>

        <div style="background:var(--card);border:1px solid var(--border);border-radius:14px;padding:16px">
          <div style="font-size:11px;color:var(--muted);font-weight:700;letter-spacing:1.5px;margin-bottom:12px">👥 ÇALIŞANLARIM</div>
          ${calisanlar.length ? calisanlar.map(([id,c]) => {
            const sgkPrim = Math.ceil((c.salary||0) * sgkRate);
            return `
              <div style="background:var(--bg);border-radius:10px;padding:12px;margin-bottom:8px">
                <div style="display:flex;justify-content:space-between;align-items:flex-start">
                  <div style="flex:1">
                    <div style="font-size:13px;font-weight:700;color:var(--text)">${c.title||'Çalışan'}</div>
                    <div style="font-size:11px;color:var(--muted);margin-top:2px">Maaş: ${_f(c.salary||0)}/ay · SGK: ${_f(sgkPrim)}</div>
                    <div style="font-size:10px;color:${c.sigorta?'var(--green)':'var(--red)'};font-weight:700;margin-top:2px">${c.sigorta?'✅ Sigortalı':'❌ Sigortasız'}</div>
                  </div>
                </div>
                <div style="display:flex;gap:6px;margin-top:8px">
                  <button onclick="(async()=>{
                    const ok=await spendCash('${uid}',${c.salary||0},'Maaş: ${c.title}');
                    if(!ok){toast('💸 Yetersiz bakiye','error');return;}
                    await dbUpdate('users/${uid}/calisanlar/${id}',{lastPaid:Date.now()});
                    toast('✅ Maaş ödendi','success');renderCalisan();
                  })()" style="flex:1;background:var(--green);color:white;border:none;border-radius:6px;padding:7px;font-size:11px;font-weight:700;cursor:pointer">💰 Maaş Öde</button>
                  ${!c.sigorta?`
                    <button onclick="(async()=>{
                      const ok=await spendCash('${uid}',${sgkPrim},'SGK Primi: ${c.title}');
                      if(!ok){toast('💸 Yetersiz bakiye','error');return;}
                      await dbUpdate('users/${uid}/calisanlar/${id}',{sigorta:true,sgkAt:Date.now()});
                      toast('🏥 Sigorta yapıldı','success');renderCalisan();
                    })()" style="flex:1;background:var(--accent);color:#000;border:none;border-radius:6px;padding:7px;font-size:11px;font-weight:700;cursor:pointer">🏥 Sigorta Yap</button>
                  `:''}
                  <button onclick="if(confirm('Çıkar?')){dbRemove('users/${uid}/calisanlar/${id}');toast('✅ Çıkarıldı','success');renderCalisan();}" style="background:var(--red);color:white;border:none;border-radius:6px;padding:7px 12px;font-size:11px;font-weight:700;cursor:pointer">🚪</button>
                </div>
              </div>`;
          }).join('') : '<div style="text-align:center;padding:18px;color:var(--muted);font-size:12px">Çalışan yok</div>'}
        </div>
      </div>`;
  };


  /* ════════════════════════════════════════════════════════════════════════
     15) DİJİTAL CÜZDAN (Aktif)
     ════════════════════════════════════════════════════════════════════════ */
  window.renderCuzdan = async function() {
    const main = document.getElementById('appMain'); if (!main) return;
    const uid  = window.GZ?.uid; if (!uid) return;
    const d    = await dbGet(`users/${uid}`) || {};
    const goldPrice = (await dbGet('system/goldPrice')) || 2400;
    const usdRate   = (await dbGet('system/forexRates/USD')) || 32.5;
    const eurRate   = (await dbGet('system/forexRates/EUR')) || 35.0;
    const xp = d.xp || 0;
    const level = d.level || 1;
    const cardType = (d.money||0) > 10000000 ? 'black' : (d.money||0) > 1000000 ? 'platinum' : (d.money||0) > 100000 ? 'gold' : 'standart';
    const cardColors = { standart:'#3b82f6', gold:'#eab308', platinum:'#a78bfa', black:'#a21caf' };
    const cardLabels = { standart:'💳 STANDART', gold:'👑 GOLD', platinum:'⚡ PLATİNUM', black:'💎 BLACK' };

    main.innerHTML = `
      <div style="padding:16px 16px 100px">
        <!-- Banka Kartı -->
        <div style="background:linear-gradient(135deg,#0b1931,#1e3a6b,#0f2451);border:1px solid ${cardColors[cardType]}44;border-radius:18px;padding:22px;margin-bottom:14px;position:relative;overflow:hidden">
          <div style="position:absolute;top:16px;right:16px;width:44px;height:36px;background:${cardColors[cardType]}44;border-radius:6px;border:1px solid ${cardColors[cardType]}66"></div>
          <div style="font-size:12px;font-weight:900;letter-spacing:2px;color:${cardColors[cardType]};margin-bottom:14px">${cardLabels[cardType]}</div>
          <div style="font-size:14px;font-weight:700;letter-spacing:4px;margin-bottom:14px;font-family:monospace;color:#e2e8f0">**** **** **** ${(d.kimlikKarti?.tc||'0000').slice(-4)}</div>
          <div style="display:flex;justify-content:space-between;align-items:flex-end">
            <div>
              <div style="font-size:9px;color:#94a3b8;letter-spacing:1px">KART SAHİBİ</div>
              <div style="font-size:13px;font-weight:700;color:white">${(d.username||'OYUNCU').toUpperCase()}</div>
            </div>
            <div style="text-align:right">
              <div style="font-size:9px;color:#94a3b8;letter-spacing:1px">BAKİYE</div>
              <div style="font-size:18px;font-weight:900;color:${cardColors[cardType]}">${_f(d.money||0)}</div>
            </div>
          </div>
        </div>

        <!-- Varlıklar -->
        <div style="background:var(--card);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:12px">
          <div style="font-size:11px;color:var(--muted);font-weight:700;letter-spacing:1.5px;margin-bottom:10px">💎 TÜM VARLIKLARIM</div>
          <div style="display:flex;flex-direction:column;gap:6px">
            <div style="display:flex;justify-content:space-between;padding:10px;background:var(--bg);border-radius:8px">
              <span style="color:var(--text);font-size:13px">🇹🇷 Türk Lirası</span>
              <span style="color:var(--text);font-weight:700">${_f(d.money||0)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;padding:10px;background:var(--bg);border-radius:8px">
              <span style="color:var(--text);font-size:13px">🥇 Altın (${(d.altinHesap||0).toFixed(2)}g)</span>
              <span style="color:var(--accent);font-weight:700">${_f((d.altinHesap||0)*goldPrice)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;padding:10px;background:var(--bg);border-radius:8px">
              <span style="color:var(--text);font-size:13px">💵 Dolar Karşılığı</span>
              <span style="color:var(--green);font-weight:700">$${((d.money||0)/usdRate).toFixed(0)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;padding:10px;background:var(--bg);border-radius:8px">
              <span style="color:var(--text);font-size:13px">💶 Euro Karşılığı</span>
              <span style="color:var(--green);font-weight:700">€${((d.money||0)/eurRate).toFixed(0)}</span>
            </div>
            ${Object.entries(d.crypto||{}).filter(([,v])=>v>0).slice(0,3).map(([sym,amt]) => `
              <div style="display:flex;justify-content:space-between;padding:10px;background:var(--bg);border-radius:8px">
                <span style="color:var(--text);font-size:13px">₿ ${sym}</span>
                <span style="color:#a855f7;font-weight:700">${amt}</span>
              </div>`).join('')}
          </div>
        </div>

        <!-- XP & Level -->
        <div style="background:var(--card);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:12px">
          <div style="display:flex;justify-content:space-between;margin-bottom:8px">
            <span style="font-size:13px;font-weight:700;color:var(--text)">⚡ Level ${level}</span>
            <span style="font-size:11px;color:var(--muted)">${xp.toLocaleString('tr-TR')} XP</span>
          </div>
          <div style="background:var(--bg);height:8px;border-radius:4px;overflow:hidden">
            <div style="width:${Math.min(100,Math.round(xp/((typeof xpForLevel==='function'?xpForLevel(level+1):1000))*100))}%;height:100%;background:linear-gradient(90deg,var(--primary),#6366f1);border-radius:4px"></div>
          </div>
          <div style="font-size:10px;color:var(--muted);margin-top:6px;text-align:center">${typeof GZX_getRank==='function'?GZX_getRank(level):''}</div>
        </div>

        <!-- Kimlik -->
        ${d.kimlikKarti ? `
          <div style="background:var(--card);border:1px solid var(--border);border-radius:14px;padding:14px">
            <div style="font-size:11px;color:var(--muted);font-weight:700;letter-spacing:1.5px;margin-bottom:8px">🪪 KİMLİK</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:12px">
              <div><div style="color:var(--muted);font-size:10px">TC</div><div style="font-weight:700;font-family:monospace;color:var(--primary)">${d.kimlikKarti.tc}</div></div>
              <div><div style="color:var(--muted);font-size:10px">İL</div><div style="font-weight:700">${d.province||'—'}</div></div>
              <div><div style="color:var(--muted);font-size:10px">EHLİYET</div><div style="color:${d.ehliyet?'var(--green)':'var(--red)'};font-weight:700">${d.ehliyet?'✅ Var':'❌ Yok'}</div></div>
              <div><div style="color:var(--muted);font-size:10px">PASAPORT</div><div style="color:${d.pasaport?'var(--green)':'var(--red)'};font-weight:700">${d.pasaport?'✅ Var':'❌ Yok'}</div></div>
            </div>
          </div>` : ''}
      </div>`;
  };
  window.renderProfil = window.renderCuzdan;

  /* ════════════════════════════════════════════════════════════════════════
     16) HABERLER EKRANI (Sürekli güncel)
     ════════════════════════════════════════════════════════════════════════ */
  window.renderHaberler = async function() {
    const main = document.getElementById('appMain'); if (!main) return;
    const haberler = Object.entries(await dbGet('news') || {})
      .sort(([,a],[,b]) => (b.ts||0)-(a.ts||0))
      .slice(0, 30);

    main.innerHTML = `
      <div style="padding:16px 16px 100px">
        <div style="text-align:center;padding:8px 0 16px">
          <div style="font-size:42px;margin-bottom:8px">📰</div>
          <div style="font-size:20px;font-weight:800;color:var(--text)">Güncel Haberler</div>
          <div style="font-size:12px;color:var(--muted);margin-top:4px">Son 30 haber</div>
        </div>

        ${haberler.length ? haberler.map(([id,n]) => {
          const colors = {positive:'var(--green)',negative:'var(--red)',critical:'var(--red)',volatile:'var(--accent)',neutral:'var(--primary)'};
          const c = colors[n.impact] || colors.neutral;
          return `
            <div style="background:var(--card);border:1px solid ${c}33;border-left:3px solid ${c};border-radius:10px;padding:12px;margin-bottom:8px">
              <div style="font-size:13px;font-weight:600;color:var(--text);line-height:1.4">${n.title}</div>
              <div style="font-size:10px;color:var(--muted);margin-top:6px">${_ts(n.ts||0)}</div>
            </div>`;
        }).join('') : '<div style="text-align:center;padding:30px;color:var(--muted)">Henüz haber yok</div>'}
      </div>`;
  };

  /* ════════════════════════════════════════════════════════════════════════
     17) İHALE EKRANI (Çalışan)
     ════════════════════════════════════════════════════════════════════════ */
  window.renderIhale = async function() {
    const main = document.getElementById('appMain'); if (!main) return;
    const uid  = window.GZ?.uid; if (!uid) return;
    const tenders = Object.entries(await dbGet('tenders') || {})
      .filter(([,t]) => t.status === 'open' && Date.now() < (t.endsAt||0))
      .sort(([,a],[,b]) => (b.openedAt||0)-(a.openedAt||0));

    main.innerHTML = `
      <div style="padding:16px 16px 100px">
        <div style="text-align:center;padding:8px 0 16px">
          <div style="font-size:42px;margin-bottom:8px">📋</div>
          <div style="font-size:20px;font-weight:800;color:var(--text)">Devlet İhaleleri</div>
          <div style="font-size:12px;color:var(--muted);margin-top:4px">${tenders.length} aktif ihale</div>
        </div>

        ${tenders.length ? tenders.map(([id,t]) => {
          const myBid = t.bids?.[uid];
          const allBids = Object.values(t.bids||{});
          const enYuksek = allBids.length ? Math.max(...allBids.map(b => b.amount||0)) : 0;
          const kalan = Math.ceil((t.endsAt - Date.now())/3600000);
          return `
            <div style="background:var(--card);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:10px">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
                <div style="flex:1">
                  <div style="font-size:14px;font-weight:700;color:var(--text)">${t.title}</div>
                  <div style="font-size:11px;color:var(--muted);margin-top:3px">Bütçe: ${_f(t.budget)} · ${kalan} saat kaldı</div>
                  <div style="font-size:11px;color:var(--muted);margin-top:2px">${t.description||''}</div>
                </div>
              </div>
              <div style="background:var(--bg);border-radius:8px;padding:8px;margin-bottom:8px">
                <div style="display:flex;justify-content:space-between;font-size:11px">
                  <span style="color:var(--muted)">${allBids.length} teklif</span>
                  ${enYuksek > 0 ? `<span style="color:var(--green);font-weight:700">En yüksek: ${_f(enYuksek)}</span>` : '<span style="color:var(--muted)">Henüz teklif yok</span>'}
                </div>
                ${myBid ? `<div style="font-size:11px;color:var(--primary);margin-top:4px;font-weight:700">📋 Sizin teklifiniz: ${_f(myBid.amount||0)}</div>` : ''}
              </div>
              <div style="display:flex;gap:6px">
                <input id="bid_${id}" type="number" placeholder="Teklif tutarı (₺)" style="flex:1;padding:8px;background:var(--bg);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:12px">
                <button onclick="(async()=>{
                  const a=parseInt(document.getElementById('bid_${id}').value)||0;
                  if(a<=0||a>${t.budget}){toast('Geçersiz teklif','error');return;}
                  await GZX_I02_submitBid('${uid}','${id}',a,${(window.GZ?.data?.level||1)*5});
                  renderIhale();
                })()" style="background:var(--primary);color:white;border:none;border-radius:6px;padding:8px 14px;font-size:12px;font-weight:700;cursor:pointer">Teklif Ver</button>
              </div>
            </div>`;
        }).join('') : '<div style="text-align:center;padding:30px;color:var(--muted)">Aktif ihale yok</div>'}
      </div>`;
  };

  /* ════════════════════════════════════════════════════════════════════════
     18) Yönetim Merkezi & Başbakanlık (gerçek çalışan)
     ════════════════════════════════════════════════════════════════════════ */
  window.renderBasbakanlik = async function() {
    const main = document.getElementById('appMain'); if (!main) return;
    const uid  = window.GZ?.uid; if (!uid) return;
    const d    = await dbGet(`users/${uid}`) || {};
    const isAuth = d.isFounder || d.isPM || d.isPresident;

    if (!isAuth) {
      main.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:60vh;padding:32px;text-align:center">
          <div style="font-size:64px;margin-bottom:16px">🏛️</div>
          <div style="font-size:18px;font-weight:800;color:var(--text)">Yetkili Sayfası</div>
          <div style="font-size:13px;color:var(--muted);margin-top:8px;max-width:300px">Bu sayfa yalnızca Başbakan, Cumhurbaşkanı ve Kurucular tarafından görüntülenebilir.</div>
          <button onclick="switchTab('secim')" style="margin-top:16px;background:var(--primary);color:white;border:none;border-radius:10px;padding:10px 20px;font-weight:700;cursor:pointer">🗳️ Seçimlere Git</button>
        </div>`;
      return;
    }

    const kdv = (await dbGet('system/kdv')) || 0.20;
    const repo = (await dbGet('bank/repoRate')) || 0.42;
    const minWage = (await dbGet('system/minWage')) || 17002;
    const fuel = (await dbGet('system/fuelPrice')) || 28.5;

    main.innerHTML = `
      <div style="padding:16px 16px 100px">
        <div style="text-align:center;padding:8px 0 16px">
          <div style="font-size:42px;margin-bottom:8px">🏛️</div>
          <div style="font-size:20px;font-weight:800;color:var(--text)">Yönetim Merkezi</div>
          <div style="font-size:12px;color:var(--muted);margin-top:4px">${d.isFounder?'⚡ Kurucu':d.isPresident?'🇹🇷 Cumhurbaşkanı':'🏛️ Başbakan'}</div>
        </div>

        <div style="background:var(--card);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:12px">
          <div style="font-size:11px;color:var(--muted);font-weight:700;letter-spacing:1.5px;margin-bottom:12px">📊 EKONOMİ KONTROLLERİ</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            <div style="background:var(--bg);border-radius:10px;padding:10px;text-align:center">
              <div style="font-size:10px;color:var(--muted)">KDV</div>
              <div style="font-size:18px;font-weight:800;color:var(--primary)">%${(kdv*100).toFixed(0)}</div>
            </div>
            <div style="background:var(--bg);border-radius:10px;padding:10px;text-align:center">
              <div style="font-size:10px;color:var(--muted)">Repo Faizi</div>
              <div style="font-size:18px;font-weight:800;color:var(--accent)">%${(repo*100).toFixed(1)}</div>
            </div>
            <div style="background:var(--bg);border-radius:10px;padding:10px;text-align:center">
              <div style="font-size:10px;color:var(--muted)">Asgari Ücret</div>
              <div style="font-size:14px;font-weight:800;color:var(--green)">${_f(minWage)}</div>
            </div>
            <div style="background:var(--bg);border-radius:10px;padding:10px;text-align:center">
              <div style="font-size:10px;color:var(--muted)">Yakıt</div>
              <div style="font-size:14px;font-weight:800;color:var(--text)">${fuel.toFixed(2)}₺/L</div>
            </div>
          </div>
        </div>

        <div style="background:var(--card);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:12px">
          <div style="font-size:11px;color:var(--muted);font-weight:700;letter-spacing:1.5px;margin-bottom:12px">⚡ HIZLI YETKİLER</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            <button onclick="(async()=>{const r=parseFloat(prompt('Yeni KDV oranı (örn: 0.20)'));if(!isNaN(r)){await GZX_E22_taxLawChange(r);}})" style="background:var(--blue-l);color:var(--primary);border:1px solid var(--primary)44;border-radius:10px;padding:12px;font-size:12px;font-weight:700;cursor:pointer">💸 KDV Değiştir</button>
            <button onclick="(async()=>{const r=parseFloat(prompt('Repo faizi (örn: 0.42)'));if(!isNaN(r)){await GZX_B12_setRepoRate(r);}})" style="background:var(--blue-l);color:var(--primary);border:1px solid var(--primary)44;border-radius:10px;padding:12px;font-size:12px;font-weight:700;cursor:pointer">🏦 Repo Değiştir</button>
            <button onclick="(async()=>{const w=parseInt(prompt('Yeni asgari ücret'));if(w>0){await GZX_E02_setMinWage(w);}})" style="background:var(--blue-l);color:var(--primary);border:1px solid var(--primary)44;border-radius:10px;padding:12px;font-size:12px;font-weight:700;cursor:pointer">💰 Asgari Ücret</button>
            <button onclick="GZX_E06_taxAmnesty(parseInt(prompt('İndirim %?'))||30,parseInt(prompt('Süre (gün)?'))||7)" style="background:var(--blue-l);color:var(--primary);border:1px solid var(--primary)44;border-radius:10px;padding:12px;font-size:12px;font-weight:700;cursor:pointer">🎁 Vergi Affı</button>
          </div>
        </div>

        <div style="background:var(--card);border:1px solid var(--border);border-radius:14px;padding:14px">
          <div style="font-size:11px;color:var(--muted);font-weight:700;letter-spacing:1.5px;margin-bottom:12px">📢 RESMİ DUYURU</div>
          <input id="bsk_duyuru" placeholder="Tüm vatandaşlara duyuru..." style="width:100%;padding:10px;background:var(--bg);border:1px solid var(--border);border-radius:8px;color:var(--text);margin-bottom:8px;box-sizing:border-box">
          <button onclick="(async()=>{
            const m=document.getElementById('bsk_duyuru').value;
            if(!m){toast('Mesaj girin','error');return;}
            await dbPush('news',{title:'🇹🇷 Resmi Duyuru: '+m,type:'official',impact:'neutral',ts:Date.now()});
            await GZX_R03_globalBroadcast('🇹🇷 '+m,30000);
            toast('📢 Duyuru tüm ekranlara gönderildi','success');
          })()" style="width:100%;background:var(--primary);color:white;border:none;border-radius:10px;padding:11px;font-weight:700;cursor:pointer">📡 Tüm Ülkeye Duyur</button>
        </div>

        ${d.isFounder ? `
          <div style="margin-top:12px">
            <button onclick="window.AP&&AP.openAdminPanel()" style="width:100%;background:linear-gradient(135deg,#dc2626,#7c2d12);color:white;border:none;border-radius:10px;padding:14px;font-weight:800;cursor:pointer">⚡ Tam Admin Panele Git</button>
          </div>
        ` : ''}
      </div>`;
  };
  window.renderCumhurbaskani = window.renderBasbakanlik;
  window.renderYonetim = window.renderBasbakanlik;

  /* ════════════════════════════════════════════════════════════════════════
     19) Render dispatcher patch — yeni ekranları ana render'a bağla
     ════════════════════════════════════════════════════════════════════════ */
  const _origRender = window.render;
  window.render = function(tab) {
    const yeni = {
      muhtarlik: window.renderMuhtarlik,
      belediye: window.renderBelediye,
      polis: window.renderPolis,
      mahkeme: window.renderMahkeme,
      noter: window.renderNoter,
      vergi: window.renderVergi,
      kredi: window.renderKredi,
      konkurato: window.renderKonkurato,
      enerji: window.renderEnerji,
      sozlesme: window.renderSozlesme,
      calisan: window.renderCalisan,
      cuzdan: window.renderCuzdan,
      profil: window.renderCuzdan,
      haberler: window.renderHaberler,
      ihale: window.renderIhale,
      basbakanlik: window.renderBasbakanlik,
      cumhurbaskani: window.renderBasbakanlik,
      yonetim: window.renderBasbakanlik,
    };
    if (yeni[tab]) {
      const main = document.getElementById('appMain');
      if (main) main.innerHTML = '<div style="padding:40px;text-align:center"><div class="spinner" style="margin:0 auto"></div></div>';
      yeni[tab]();
    } else if (typeof _origRender === 'function') {
      _origRender(tab);
    }
  };

  console.log('[dinamik-sistem.js] ✅ Bot, Onay, Mahkeme, Noter, Vergi, Kredi, Enerji, Konkordato, Cüzdan, Haberler — TÜM EKRANLAR AKTİF');

})();
