/* ═══ CORE.JS — 5 dosya birleştirildi ═══ */
"use strict";


/* ─── giris.js ─── */
/* ==========================================================================
   giriş.js — TAM GÜVENLİK + GİZLİLİK PAKETİ v1.1
   ─────────────────────────────────────────────────────────────────────────
   YENİ : Anonim Mod (e-posta toplamadan kayıt)
   YENİ : Kullanıcı adı + Şifre ile giriş
   YENİ : Kurtarma Kodu sistemi (anonim hesap için şifre sıfırlama)
   YENİ : 25.000 TL başlangıç parası
   KORUNAN : Cihaz Parmak İzi · Şüpheli Giriş · Re-Auth · 2FA · Rate Limit
             Geçici Mail Engeli · Şifre Güç Göstergesi · Oturum Zaman Aşımı
   ========================================================================== */

(function () {

  /* ══════════════════════════════════════════════════════════════════════
     SABİTLER
     ══════════════════════════════════════════════════════════════════════ */
  const STARTING_MONEY = 25000;       // Başlangıç bakiyesi (eskiden 20.000)
  const STARTING_DIAMONDS = 10;
  const ANON_EMAIL_DOMAIN = 'anon.gamezone.local';

  /* ══════════════════════════════════════════════════════════════════════
     KRİPTO YARDIMCILAR (kurtarma kodu hash + username hash)
     ══════════════════════════════════════════════════════════════════════ */

  async function sha256(text) {
    const buf = new TextEncoder().encode(text);
    const hash = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  // Anonim hesap için sahte e-posta üret
  async function makeAnonEmail(username) {
    const h = await sha256('gz_anon_' + username.toLowerCase());
    return 'u_' + h.slice(0, 20) + '@' + ANON_EMAIL_DOMAIN;
  }

  // 16 karakterlik insan-okur kurtarma kodu (4-4-4-4 formatında)
  function generateRecoveryCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 0/O/I/1 yok (karışmasın)
    let s = '';
    for (let i = 0; i < 16; i++) {
      s += chars.charAt(Math.floor(Math.random() * chars.length));
      if (i === 3 || i === 7 || i === 11) s += '-';
    }
    return s; // örn: ABCD-EFGH-JKLM-NPQR
  }

  /* ══════════════════════════════════════════════════════════════════════
     YARDIMCILAR
     ══════════════════════════════════════════════════════════════════════ */

  function getDeviceFingerprint() {
    const parts = [
      navigator.userAgent, navigator.language,
      screen.width + 'x' + screen.height, screen.colorDepth,
      new Date().getTimezoneOffset(),
      navigator.hardwareConcurrency || 0,
      navigator.platform || '',
      (navigator.plugins || []).length,
      Intl.DateTimeFormat().resolvedOptions().timeZone || ''
    ];
    let hash = 0;
    const str = parts.join('|');
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(36);
  }

  function getDeviceLabel() {
    const ua = navigator.userAgent;
    if (/iPhone/.test(ua)) return 'iPhone';
    if (/iPad/.test(ua)) return 'iPad';
    if (/Android/.test(ua)) return 'Android';
    if (/Windows/.test(ua)) return 'Windows PC';
    if (/Mac/.test(ua)) return 'Mac';
    if (/Linux/.test(ua)) return 'Linux';
    return 'Bilinmeyen Cihaz';
  }

  /* ─── Rate Limiting ─── */
  const LOGIN_MAX = 5;
  const LOGIN_WIN = 15 * 60 * 1000;

  function checkLoginRL(ident) {
    const key = 'lr_' + btoa(ident).slice(0, 20);
    let d = JSON.parse(localStorage.getItem(key) || '{"c":0,"t":0}');
    const now = Date.now();
    if (now - d.t > LOGIN_WIN) d = { c: 0, t: now };
    d.c++;
    d.t = d.t || now;
    localStorage.setItem(key, JSON.stringify(d));
    if (d.c > LOGIN_MAX) {
      return { blocked: true, wait: Math.ceil((d.t + LOGIN_WIN - now) / 60000) };
    }
    return { blocked: false, left: LOGIN_MAX - d.c };
  }
  function clearLoginRL(ident) {
    localStorage.removeItem('lr_' + btoa(ident).slice(0, 20));
  }

  function checkRegRL() {
    const key = 'rr_attempts';
    let d = JSON.parse(localStorage.getItem(key) || '{"c":0,"t":0}');
    const now = Date.now();
    if (now - d.t > 3600000) d = { c: 0, t: now };
    d.c++; d.t = d.t || now;
    localStorage.setItem(key, JSON.stringify(d));
    return d.c > 3;
  }

  /* ─── Geçici Mail Engeli ─── */
  const BLOCKED_DOMAINS = [
    'mailinator.com', 'guerrillamail.com', '10minutemail.com', 'tempmail.com',
    'throwam.com', 'yopmail.com', 'fakeinbox.com', 'dispostable.com',
    'trashmail.com', 'sharklasers.com', 'getairmail.com', 'mailnull.com',
    'spamgourmet.com', 'trashmail.me', 'maildrop.cc', 'tempr.email'
  ];
  function isEmailAllowed(email) {
    return !BLOCKED_DOMAINS.includes((email.split('@')[1] || '').toLowerCase());
  }

  /* ─── Şifre Gücü ─── */
  function passStrength(p) {
    let s = 0;
    if (p.length >= 8) s++;
    if (p.length >= 12) s++;
    if (/[A-Z]/.test(p)) s++;
    if (/[0-9]/.test(p)) s++;
    if (/[^a-zA-Z0-9]/.test(p)) s++;
    return s;
  }

  /* ─── Şifre Toggle ─── */
  function addPassToggle(id) {
    const inp = document.getElementById(id);
    if (!inp || inp.dataset.pt) return;
    inp.dataset.pt = '1';
    inp.parentElement.style.position = 'relative';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.innerHTML = '👁';
    btn.style.cssText = 'position:absolute;right:12px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;font-size:16px;color:var(--muted);z-index:2;line-height:1';
    btn.onclick = () => { inp.type = inp.type === 'password' ? 'text' : 'password'; btn.innerHTML = inp.type === 'password' ? '👁' : '🙈'; };
    inp.parentElement.appendChild(btn);
  }

  /* ─── Oturum Zaman Aşımı ─── */
  function updateActivity() {
    if (GZ.uid) localStorage.setItem('act_' + GZ.uid, Date.now());
  }
  function checkSessionTimeout() {
    if (!GZ.uid) return;
    const last = parseInt(localStorage.getItem('act_' + GZ.uid) || '0');
    if (last && Date.now() - last > 30 * 24 * 3600 * 1000) {
      auth.signOut();
      toast('Uzun süre giriş yapılmadı. Lütfen tekrar giriş yap.', 'warn');
    }
  }
  setInterval(updateActivity, 60000);

  /* ══════════════════════════════════════════════════════════════════════
     CİHAZ KAYDI & ŞÜPHELİ GİRİŞ TESPİTİ
     ══════════════════════════════════════════════════════════════════════ */

  async function recordDevice(uid) {
    const fp = getDeviceFingerprint();
    const knownKey = 'kfp_' + uid;
    const known = JSON.parse(localStorage.getItem(knownKey) || '[]');
    const isNew = !known.includes(fp);
    const label = getDeviceLabel();
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';

    try {
      await db.ref('security/logins/' + uid).push({
        fp, label, tz,
        ua: navigator.userAgent.slice(0, 180),
        ts: firebase.database.ServerValue.TIMESTAMP,
        isNewDevice: isNew
      });

      if (isNew) {
        await db.ref('notifs/' + uid).push({
          type: 'security',
          icon: '🔐',
          msg: '🔐 Yeni cihazdan giriş: ' + label + '. Sen değilsen şifreni hemen değiştir!',
          ts: firebase.database.ServerValue.TIMESTAMP,
          read: false
        });
        await db.ref('security/alerts/' + uid).push({
          type: 'new_device',
          label, tz,
          ts: firebase.database.ServerValue.TIMESTAMP,
          handled: false
        });

        known.push(fp);
        if (known.length > 15) known.shift();
        localStorage.setItem(knownKey, JSON.stringify(known));

        toast('🔐 Yeni cihazdan giriş! Bildirim oluşturuldu.', 'warn', 5000);
      }
    } catch (e) { console.warn('Device log err:', e); }
  }

  /* ══════════════════════════════════════════════════════════════════════
     EKRAN YÖNETİMİ
     ══════════════════════════════════════════════════════════════════════ */

  const splash = document.getElementById('splash');
  const authScreen = document.getElementById('authScreen');
  const gameScreen = document.getElementById('gameScreen');
  const banScreen = document.getElementById('banScreen');

  $$('.auth-tab').forEach(b => b.addEventListener('click', () => {
    showPanel(b.dataset.tab);
    $$('.auth-tab').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
  }));

  function showPanel(name) {
    $$('.auth-panel').forEach(p => p.classList.remove('active'));
    const map = {
      login: 'loginPanel', register: 'registerPanel',
      anon: 'anonPanel', verify: 'verifyPanel', forgot: 'forgotPanel',
      founder: 'founderPanel'  // ← KRİTİK FIX: Yetkili sekmesi mapping
    };
    const el = document.getElementById(map[name]);
    if (el) el.classList.add('active');
  }

  // Forgot panel sub-tab
  document.addEventListener('click', e => {
    if (e.target.matches('.forgot-subtabs .subtab')) {
      const mode = e.target.dataset.fmode;
      $$('.forgot-subtabs .subtab').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      $('#forgotByEmail').style.display = mode === 'email' ? 'block' : 'none';
      $('#forgotByCode').style.display = mode === 'code' ? 'block' : 'none';
    }
  });

  // Şifre toggle butonları (her panel için)
  setTimeout(() => {
    addPassToggle('loginPass');
    addPassToggle('regPass');
    addPassToggle('regPass2');
    addPassToggle('anonPass');
    addPassToggle('anonPass2');
    addPassToggle('forgotNewPass');
  }, 400);

  // Şifre güç barı (standart + anonim)
  document.addEventListener('input', e => {
    if (e.target.id !== 'regPass' && e.target.id !== 'anonPass') return;
    const s = passStrength(e.target.value);
    const barId = 'psBar_' + e.target.id;
    const lblId = 'psLbl_' + e.target.id;
    let bar = document.getElementById(barId);
    let lbl = document.getElementById(lblId);
    if (!bar) {
      bar = Object.assign(document.createElement('div'), { id: barId });
      bar.style.cssText = 'height:4px;border-radius:2px;transition:.3s;margin-top:4px;width:0%';
      e.target.parentElement.appendChild(bar);
      lbl = Object.assign(document.createElement('div'), { id: lblId });
      lbl.style.cssText = 'font-size:11px;margin-top:2px;font-weight:600';
      e.target.parentElement.appendChild(lbl);
    }
    const cols = ['#dc2626', '#ef4444', '#f59e0b', '#16a34a', '#15803d', '#0d5c32'];
    const labs = ['Çok Zayıf', 'Zayıf', 'Orta', 'İyi', 'Güçlü', 'Çok Güçlü'];
    bar.style.background = cols[s]; bar.style.width = (s * 20) + '%';
    lbl.textContent = labs[s]; lbl.style.color = cols[s];
  });

  /* ══════════════════════════════════════════════════════════════════════
     STANDART KAYIT (e-posta ile)
     ══════════════════════════════════════════════════════════════════════ */

  $('#btnRegister').addEventListener('click', async () => {
    const username = $('#regUsername').value.trim();
    const email = $('#regEmail').value.trim().toLowerCase();
    const pass = $('#regPass').value;
    const pass2 = $('#regPass2').value;
    const agree = $('#regAgree').checked;

    if (username.length < 3 || username.length > 16) return toast('Kullanıcı adı 3-16 karakter olmalı', 'error');
    if (!/^[a-zA-Z0-9_]+$/.test(username)) return toast('Sadece harf, rakam ve alt çizgi', 'error');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return toast('Geçersiz e-posta', 'error');
    if (!isEmailAllowed(email)) return toast('Geçici e-posta servisleri kabul edilmiyor', 'error');
    if (pass.length < 6) return toast('Şifre en az 6 karakter olmalı', 'error');
    if (pass !== pass2) return toast('Şifreler eşleşmiyor', 'error');
    if (!agree) return toast('Kuralları kabul etmelisin', 'error');
    if (passStrength(pass) < 2) return toast('Şifre çok zayıf! Büyük harf veya rakam ekle.', 'warn');
    if (checkRegRL()) return toast('Çok fazla kayıt denemesi. 1 saat sonra tekrar dene.', 'error');

    const existing = await dbGet('usernames/' + username.toLowerCase());
    if (existing) return toast('Bu kullanıcı adı alınmış', 'error');

    const btn = $('#btnRegister');
    btn.disabled = true; btn.textContent = 'Kaydediliyor...';

    try {
      const cred = await auth.createUserWithEmailAndPassword(email, pass);
      const uid = cred.user.uid;
      await createUserData(uid, username, email, false, null);

      try {
        await cred.user.sendEmailVerification({
          url: 'https://serkankarakad-gif.github.io/GameZone/?verified=1',
          handleCodeInApp: false
        });
      } catch(evErr) {
        console.warn('[emailVerif] Gönderim hatası:', evErr.code, evErr.message);
        // Hata olsa bile kayıt tamamlandı, kullanıcıya bildir
        toast('Kayıt tamam! Doğrulama maili gönderilemedi, tekrar dene.', 'warn', 5000);
      }

      $('#verifyEmailText').textContent = email + ' adresine doğrulama bağlantısı gönderdik.';
      showPanel('verify');
      $$('.auth-tab').forEach(x => x.classList.remove('active'));
      toast('Kayıt başarılı! E-postanı doğrula 📧', 'success');
    } catch (e) {
      const msgs = {
        'auth/email-already-in-use': 'Bu e-posta zaten kayıtlı',
        'auth/invalid-email': 'Geçersiz e-posta',
        'auth/weak-password': 'Şifre çok zayıf'
      };
      toast(msgs[e.code] || 'Bir hata oluştu', 'error');
    }
    btn.disabled = false; btn.textContent = 'Kayıt Ol';
  });

  /* ══════════════════════════════════════════════════════════════════════
     ANONİM KAYIT (e-posta toplamadan)
     ══════════════════════════════════════════════════════════════════════ */

  $('#btnAnonRegister').addEventListener('click', async () => {
    const username = $('#anonUsername').value.trim();
    const pass = $('#anonPass').value;
    const pass2 = $('#anonPass2').value;
    const agree = $('#anonAgree').checked;
    const accept = $('#anonAccept').checked;

    if (username.length < 3 || username.length > 16) return toast('Kullanıcı adı 3-16 karakter olmalı', 'error');
    if (!/^[a-zA-Z0-9_]+$/.test(username)) return toast('Sadece harf, rakam, alt çizgi', 'error');
    if (pass.length < 6) return toast('Şifre en az 6 karakter olmalı', 'error');
    if (pass !== pass2) return toast('Şifreler eşleşmiyor', 'error');
    if (!agree) return toast('Kuralları kabul etmelisin', 'error');
    if (!accept) return toast('Kurtarma kodu sorumluluğunu onayla', 'error');
    if (passStrength(pass) < 2) return toast('Şifre çok zayıf — büyük harf/rakam ekle', 'warn');
    if (checkRegRL()) return toast('Çok fazla kayıt denemesi. 1 saat bekle.', 'error');

    const existing = await dbGet('usernames/' + username.toLowerCase());
    if (existing) return toast('Bu kullanıcı adı alınmış', 'error');

    const btn = $('#btnAnonRegister');
    btn.disabled = true; btn.textContent = 'Anonim hesap oluşturuluyor...';

    try {
      const fakeEmail = await makeAnonEmail(username);
      const cred = await auth.createUserWithEmailAndPassword(fakeEmail, pass);
      const uid = cred.user.uid;

      // Kurtarma kodu üret + hash'le
      const recoveryCode = generateRecoveryCode();
      const codeHash = await sha256('gz_rec_v1_' + recoveryCode);

      await createUserData(uid, username, null, true, codeHash);

      // Kurtarma kodunu kullanıcıya GÖSTER (modal)
      showRecoveryCodeModal(username, recoveryCode);
    } catch (e) {
      const msgs = {
        'auth/email-already-in-use': 'Bu kullanıcı adı zaten alınmış (anonim)',
        'auth/weak-password': 'Şifre çok zayıf'
      };
      toast(msgs[e.code] || ('Kayıt hatası: ' + (e.message || '')), 'error');
      btn.disabled = false; btn.textContent = '🛡️ Anonim Kayıt Ol';
    }
  });

  /* Ortak: kullanıcı verisini oluştur (25.000 TL başlangıç) */
  async function createUserData(uid, username, email, isAnonymous, recoveryCodeHash) {
    const fp = getDeviceFingerprint();
    const userObj = {
      username,
      usernameLower: username.toLowerCase(),
      email: email || null,                   // anonim ise null
      isAnonymous: !!isAnonymous,
      level: 1, xp: 0,
      money: STARTING_MONEY,                  // 25.000 TL
      diamonds: STARTING_DIAMONDS,
      location: 'İstanbul',
      online: true,
      lastSeen: firebase.database.ServerValue.TIMESTAMP,
      createdAt: firebase.database.ServerValue.TIMESTAMP,
      banned: false,
      verified: !!isAnonymous,                // anonim direkt verified, standart e-posta sonrası
      bio: '',
      netWorth: STARTING_MONEY,
      twoFactorEnabled: false,
      registrationFp: fp,
      registrationUa: navigator.userAgent.slice(0, 180)
    };
    if (recoveryCodeHash) {
      userObj.recoveryHash = recoveryCodeHash;
      userObj.recoverySetAt = firebase.database.ServerValue.TIMESTAMP;
    }
    await dbSet('users/' + uid, userObj);
    await dbSet('usernames/' + username.toLowerCase(), uid);
    await dbSet('bank/' + uid, {
      balance: 0, investment: 0, investmentDate: now(), loan: 0,
      nextBusinessExpense: now() + 7 * 24 * 3600 * 1000,
      nextSalary: now() + 7 * 24 * 3600 * 1000
    });
    await db.ref('security/logins/' + uid).push({
      fp, label: getDeviceLabel(), ua: navigator.userAgent.slice(0, 180),
      ts: firebase.database.ServerValue.TIMESTAMP, type: 'register',
      anonymous: !!isAnonymous
    });
    localStorage.setItem('kfp_' + uid, JSON.stringify([fp]));
  }

  /* Kurtarma kodunu kullanıcıya gösteren modal — KAPATMASI ZOR */
  function showRecoveryCodeModal(username, code) {
    const root = $('#modalRoot');
    root.innerHTML = `
      <div class="modal-bg" style="z-index:5000">
        <div class="modal" onclick="event.stopPropagation()" style="max-width:480px">
          <div class="modal-grabber"></div>
          <div class="modal-head">
            <h3>🛡️ Kurtarma Kodun</h3>
          </div>
          <div class="modal-body">
            <div class="security-notice danger">
              <div class="sec-icon">⚠️</div>
              <p><b>Bu kodu ŞİMDİ kaydet.</b> Bir daha gösterilmeyecek. Şifreni unutursan bu kodla yeni şifre belirlersin.</p>
            </div>

            <div class="recovery-card">
              <div class="rc-label">Kullanıcı Adı</div>
              <div class="rc-username">${username}</div>
              <div class="rc-label" style="margin-top:14px">Kurtarma Kodu</div>
              <div class="rc-code" id="rcCode">${code}</div>
              <button class="btn-secondary" id="btnCopyCode" style="width:100%;margin-top:10px">📋 Kopyala</button>
              <button class="btn-secondary" id="btnDownloadCode" style="width:100%;margin-top:6px">💾 .txt Dosyası Olarak İndir</button>
            </div>

            <label class="auth-check" style="margin-top:14px">
              <input type="checkbox" id="rcConfirm">
              <span><b>Bu kodu güvenli yere kaydettim. Kaybedersem hesabım kurtarılamaz.</b></span>
            </label>

            <button class="btn-primary" id="btnRcContinue" style="width:100%;margin-top:10px" disabled>Devam Et</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('btnCopyCode').onclick = async () => {
      try {
        await navigator.clipboard.writeText('GameZone Anonim Hesap\nKullanıcı Adı: ' + username + '\nKurtarma Kodu: ' + code);
        toast('📋 Kopyalandı', 'success');
      } catch (e) {
        toast('Kopyalama başarısız, manuel yaz', 'warn');
      }
    };

    document.getElementById('btnDownloadCode').onclick = () => {
      const text = `GameZone ERP — Anonim Hesap Kurtarma\n\n` +
                   `Kullanıcı Adı : ${username}\n` +
                   `Kurtarma Kodu : ${code}\n` +
                   `Oluşturma     : ${new Date().toLocaleString('tr-TR')}\n\n` +
                   `BU DOSYAYI GÜVENLİ YERE SAKLA.\n` +
                   `Şifrenizi unutursanız bu kodla yeni şifre belirleyebilirsin.\n` +
                   `Bu kod kaybolursa hesabın kurtarılamaz.\n`;
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `gamezone-${username}-recovery.txt`;
      a.click();
      toast('💾 İndirildi', 'success');
    };

    document.getElementById('rcConfirm').onchange = (e) => {
      document.getElementById('btnRcContinue').disabled = !e.target.checked;
    };

    document.getElementById('btnRcContinue').onclick = () => {
      $('#modalRoot').innerHTML = '';
      toast('🛡️ Anonim hesap aktif! Hoş geldin.', 'success', 4000);
      // enterGame onAuthStateChanged tarafından otomatik tetiklenir
    };
  }

  /* ══════════════════════════════════════════════════════════════════════
     GİRİŞ — Kullanıcı Adı VEYA E-posta + Rate Limit + Cihaz Kaydı
     ══════════════════════════════════════════════════════════════════════ */

  $('#btnLogin').addEventListener('click', async () => {
    const ident = $('#loginIdent').value.trim();
    const pass = $('#loginPass').value;
    if (!ident || !pass) return toast('Kullanıcı adı/e-posta ve şifre gir', 'error');

    const rl = checkLoginRL(ident.toLowerCase());
    if (rl.blocked) return toast('Hesap ' + rl.wait + ' dk kilitli. Şifre sıfırlamayı dene.', 'error');

    const btn = $('#btnLogin');
    btn.disabled = true; btn.textContent = 'Giriş yapılıyor...';

    try {
      // E-posta mı yoksa kullanıcı adı mı?
      let loginEmail;
      if (ident.includes('@')) {
        loginEmail = ident.toLowerCase();
      } else {
        // Kullanıcı adından UID bul, sonra UID'den email çek
        const username = ident.toLowerCase();
        if (!/^[a-zA-Z0-9_]+$/.test(username)) {
          throw { code: 'auth/invalid-credential' };
        }
        const uid = await dbGet('usernames/' + username);
        if (!uid) throw { code: 'auth/user-not-found' };
        const emailFromDb = await dbGet('users/' + uid + '/email');
        const isAnon = await dbGet('users/' + uid + '/isAnonymous');
        if (isAnon || !emailFromDb) {
          // Anonim hesap — sahte e-postayı yeniden hesapla
          loginEmail = await makeAnonEmail(username);
        } else {
          loginEmail = emailFromDb;
        }
      }

      const cred = await auth.signInWithEmailAndPassword(loginEmail, pass);
      clearLoginRL(ident.toLowerCase());

      const twoFA = await dbGet('users/' + cred.user.uid + '/twoFactorEnabled');
      if (twoFA) {
        GZ._pendingUser = cred.user;
        await auth.signOut();
        show2FAVerify(loginEmail, pass);
      } else {
        await recordDevice(cred.user.uid);
        updateActivity();
      }
    } catch (e) {
      const msgs = {
        'auth/wrong-password': 'Şifre yanlış (kalan: ' + (rl.left - 1) + ')',
        'auth/invalid-credential': 'Bilgiler hatalı (kalan: ' + (rl.left - 1) + ')',
        'auth/user-not-found': 'Kullanıcı bulunamadı',
        'auth/too-many-requests': 'Geçici kilit. Şifreni sıfırla.',
        'auth/user-disabled': 'Hesap devre dışı.'
      };
      toast(msgs[e.code] || 'Giriş başarısız', 'error');
    }
    btn.disabled = false; btn.textContent = 'Giriş Yap';
  });

  /* ══════════════════════════════════════════════════════════════════════
     SMS 2FA (Firebase Phone Auth) — kalıyor
     ══════════════════════════════════════════════════════════════════════ */

  let recaptchaVerifier = null;
  let confirmationResult = null;

  function initRecaptcha(containerId) {
    if (recaptchaVerifier) { try { recaptchaVerifier.clear(); } catch (e) {} }
    recaptchaVerifier = new firebase.auth.RecaptchaVerifier(containerId, {
      size: 'invisible',
      callback: () => {}
    });
  }

  window.open2FASetup = async function () {
    if (!GZ.uid) return;
    showModal('📱 SMS 2FA Kurulumu', `
      <div class="security-notice">
        <div class="sec-icon">🛡️</div>
        <p>Telefon numarana her girişte SMS kodu gönderilir. Hesabın çok daha güvende olur.</p>
      </div>
      <div class="input-group">
        <label>Telefon Numarası</label>
        <div style="display:flex;gap:8px">
          <select id="phoneCC" style="width:100px;flex-shrink:0">
            <option value="+90">🇹🇷 +90</option>
            <option value="+1">🇺🇸 +1</option>
            <option value="+44">🇬🇧 +44</option>
            <option value="+49">🇩🇪 +49</option>
          </select>
          <input type="tel" id="phoneNum" placeholder="5XX XXX XX XX" maxlength="15">
        </div>
      </div>
      <div id="recaptcha2fa"></div>
      <button class="btn-primary" id="btnSend2FA" style="width:100%">SMS Kodu Gönder</button>
      <div id="smsCodeWrap" style="display:none;margin-top:12px">
        <div class="input-group">
          <label>SMS Kodu (6 hane)</label>
          <input type="number" id="smsCodeInput" placeholder="000000" maxlength="6" style="font-size:22px;text-align:center;letter-spacing:6px">
        </div>
        <button class="btn-success" id="btnConfirm2FA" style="width:100%">Onayla & 2FA Aktifleştir</button>
      </div>
    `);

    setTimeout(() => {
      document.getElementById('btnSend2FA')?.addEventListener('click', async () => {
        const cc = document.getElementById('phoneCC').value;
        const num = document.getElementById('phoneNum').value.replace(/\s/g, '');
        if (!num || num.length < 9) return toast('Geçerli telefon gir', 'error');
        const fullPhone = cc + num;
        const btn = document.getElementById('btnSend2FA');
        btn.disabled = true; btn.textContent = 'Gönderiliyor...';
        try {
          initRecaptcha('recaptcha2fa');
          confirmationResult = await firebase.auth().currentUser
            .linkWithPhoneNumber(fullPhone, recaptchaVerifier)
            .catch(async () => firebase.auth().signInWithPhoneNumber(fullPhone, recaptchaVerifier));
          document.getElementById('smsCodeWrap').style.display = 'block';
          btn.textContent = '✅ Gönderildi';
          toast('SMS gönderildi 📨', 'success');

          document.getElementById('btnConfirm2FA').addEventListener('click', async () => {
            const code = document.getElementById('smsCodeInput').value.trim();
            if (code.length !== 6) return toast('6 haneli kodu gir', 'error');
            try {
              await confirmationResult.confirm(code);
              await dbUpdate('users/' + GZ.uid, {
                twoFactorEnabled: true,
                twoFactorPhone: cc + ' ' + num.slice(0, 3) + '*** ' + num.slice(-2),
                twoFactorPhoneRaw: fullPhone
              });
              toast('🛡️ SMS 2FA aktifleşti!', 'success');
              closeModal();
            } catch (e) {
              toast('Kod yanlış veya süresi dolmuş', 'error');
            }
          });
        } catch (e) {
          toast('SMS gönderilemedi: ' + (e.message || 'bilinmeyen'), 'error');
          btn.disabled = false; btn.textContent = 'SMS Kodu Gönder';
        }
      });
    }, 100);
  };

  window.disable2FA = async function () {
    if (!confirm('SMS 2FA\'yı devre dışı bırakmak istediğinden emin misin?')) return;
    await dbUpdate('users/' + GZ.uid, { twoFactorEnabled: false, twoFactorPhone: null, twoFactorPhoneRaw: null });
    toast('2FA devre dışı bırakıldı', 'warn');
  };

  function show2FAVerify(loginEmail, pass) {
    showModal('📱 SMS Doğrulama', `
      <div class="security-notice">
        <div class="sec-icon">🔐</div>
        <p>Hesabında iki adımlı doğrulama aktif. Telefonuna gelen 6 haneli kodu gir.</p>
      </div>
      <div id="recaptchaLogin"></div>
      <button class="btn-secondary" id="btnSendLoginSMS" style="width:100%">📨 SMS Kodu Gönder</button>
      <div class="input-group" id="smsInputWrap" style="display:none;margin-top:12px">
        <label>SMS Kodu (6 hane)</label>
        <input type="number" id="loginSmsCode" placeholder="000000" maxlength="6" style="font-size:22px;text-align:center;letter-spacing:6px">
      </div>
      <button class="btn-primary" id="btnConfirmLoginSMS" style="width:100%;display:none">Doğrula & Giriş</button>
      <button class="btn-link" onclick="closeModal()" style="width:100%">İptal</button>
    `);

    setTimeout(() => {
      document.getElementById('btnSendLoginSMS')?.addEventListener('click', async () => {
        try {
          initRecaptcha('recaptchaLogin');
          const cred = await auth.signInWithEmailAndPassword(loginEmail, pass);
          const fullPhone = await dbGet('users/' + cred.user.uid + '/twoFactorPhoneRaw');
          await auth.signOut();
          if (!fullPhone) {
            await auth.signInWithEmailAndPassword(loginEmail, pass);
            toast('2FA verisi yok, normal giriş.', 'warn');
            closeModal(); return;
          }
          confirmationResult = await firebase.auth().signInWithPhoneNumber(fullPhone, recaptchaVerifier);
          document.getElementById('smsInputWrap').style.display = 'block';
          document.getElementById('btnConfirmLoginSMS').style.display = 'block';
          document.getElementById('btnSendLoginSMS').textContent = '✅ Gönderildi';
          document.getElementById('btnSendLoginSMS').disabled = true;
          toast('SMS gönderildi 📨', 'success');
        } catch (e) { toast('SMS hatası: ' + (e.message || ''), 'error'); }
      });

      document.getElementById('btnConfirmLoginSMS')?.addEventListener('click', async () => {
        const code = document.getElementById('loginSmsCode').value.trim();
        if (code.length !== 6) return toast('6 haneli kodu gir', 'error');
        try {
          await confirmationResult.confirm(code);
          await auth.signInWithEmailAndPassword(loginEmail, pass);
          closeModal();
          toast('✅ İki adımlı doğrulama başarılı!', 'success');
        } catch (e) { toast('Kod yanlış veya süresi dolmuş', 'error'); }
      });
    }, 150);
  }

  /* ══════════════════════════════════════════════════════════════════════
     ŞİFRE SIFIRLA — E-posta + Kurtarma Kodu (anonim için)
     ══════════════════════════════════════════════════════════════════════ */

  $('#btnForgot').addEventListener('click', () => {
    const ident = $('#loginIdent').value.trim();
    if (ident.includes('@')) $('#forgotEmail').value = ident;
    else $('#forgotUsername').value = ident;
    showPanel('forgot');
    $$('.auth-tab').forEach(x => x.classList.remove('active'));
  });
  $('#btnForgotBack').addEventListener('click', () => {
    showPanel('login');
    $$('.auth-tab').forEach(x => x.classList.remove('active'));
    $$('.auth-tab')[0].classList.add('active');
  });

  $('#btnForgotSend').addEventListener('click', async () => {
    const email = $('#forgotEmail').value.trim().toLowerCase();
    if (!email) return toast('E-posta gir', 'error');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return toast('Geçersiz e-posta', 'error');
    if (email.endsWith('@' + ANON_EMAIL_DOMAIN)) {
      return toast('Bu anonim hesap. Kurtarma Kodu sekmesini kullan.', 'warn');
    }
    try {
      await auth.sendPasswordResetEmail(email, {
        url: window.location.origin + window.location.pathname + '?reset=1'
      });
      toast('✅ Sıfırlama bağlantısı gönderildi', 'success');
      setTimeout(() => showPanel('login'), 2000);
    } catch (e) {
      toast(e.code === 'auth/user-not-found' ? 'E-posta kayıtlı değil' : 'Gönderim hatası', 'error');
    }
  });

  // Kurtarma kodu ile sıfırlama (anonim hesap)
  $('#btnForgotCode').addEventListener('click', async () => {
    const username = $('#forgotUsername').value.trim().toLowerCase();
    const code = $('#forgotCode').value.trim().toUpperCase();
    const newPass = $('#forgotNewPass').value;
    if (username.length < 3) return toast('Kullanıcı adı gir', 'error');
    if (code.length < 16) return toast('Kurtarma kodunu tam gir (16+ karakter)', 'error');
    if (newPass.length < 6) return toast('Yeni şifre en az 6 karakter', 'error');
    if (passStrength(newPass) < 2) return toast('Şifre çok zayıf', 'warn');

    const btn = $('#btnForgotCode');
    btn.disabled = true; btn.textContent = 'Doğrulanıyor...';

    try {
      const uid = await dbGet('usernames/' + username);
      if (!uid) throw new Error('Kullanıcı bulunamadı');
      const isAnon = await dbGet('users/' + uid + '/isAnonymous');
      const storedHash = await dbGet('users/' + uid + '/recoveryHash');
      if (!isAnon || !storedHash) throw new Error('Bu hesap kurtarma kodu kullanmıyor');

      const inputHash = await sha256('gz_rec_v1_' + code);
      if (inputHash !== storedHash) throw new Error('Kurtarma kodu yanlış');

      // Kod doğru — şifre sıfırlama isteğini DB'ye yaz, Firebase Cloud Function işleyecek
      // Cloud Function yokken: kullanıcı eski şifresiyle bir kez girip değiştirsin diye
      // alternatif: sıfırlama isteğini DB'ye yaz, manuel onay
      await db.ref('security/recoveryRequests/' + uid).set({
        ts: firebase.database.ServerValue.TIMESTAMP,
        username,
        // Yeni şifre düz metinde TUTULMAZ — sadece hash + flag
        newPassHash: await sha256('gz_pw_v1_' + newPass),
        handled: false,
        method: 'recovery_code',
        codeMatched: true
      });

      // Yeni kurtarma kodu da üret (eski geçersiz)
      const newCode = generateRecoveryCode();
      const newCodeHash = await sha256('gz_rec_v1_' + newCode);
      await dbUpdate('users/' + uid, {
        recoveryHash: newCodeHash,
        recoverySetAt: firebase.database.ServerValue.TIMESTAMP,
        passwordResetPending: true
      });

      // Bilgilendir
      showModal('✅ Kurtarma Onaylandı', `
        <div class="security-notice">
          <div class="sec-icon">🛡️</div>
          <p>Kurtarma kodun doğrulandı. Yeni şifre talebi <b>onay sırasında</b>. Birkaç dakika içinde aktifleşir.</p>
        </div>
        <div class="recovery-card">
          <div class="rc-label">YENİ Kurtarma Kodun (eski artık geçersiz)</div>
          <div class="rc-code">${newCode}</div>
          <p class="small muted mt-12">Bu yeni kodu da kaydet. Eski kod artık çalışmaz.</p>
        </div>
        <button class="btn-primary" onclick="closeModal();" style="width:100%;margin-top:14px">Tamam</button>
      `);

      // ⚠️ Not: Firebase Auth tarafından şifre değiştirme client'tan yapılamadığı için
      // gerçek senaryoda admin SDK / Cloud Function gerekir. Bu sürümde recovery isteği
      // DB'ye işlenir, geliştirici tarafından (veya bir Cloud Function ile) onaylanır.
      btn.disabled = false; btn.textContent = 'Şifreyi Sıfırla';
    } catch (e) {
      toast(e.message || 'Hata', 'error');
      btn.disabled = false; btn.textContent = 'Şifreyi Sıfırla';
    }
  });

  /* ══════════════════════════════════════════════════════════════════════
     E-POSTA DEĞİŞİKLİĞİ RE-AUTH KORUMASI (standart hesap için)
     ══════════════════════════════════════════════════════════════════════ */

  window.changeEmail = async function () {
    if (GZ.data?.isAnonymous) {
      return toast('Anonim hesaplarda e-posta değiştirilemez. Standart hesap aç.', 'warn');
    }
    showModal('✉️ E-posta Değiştir', `
      <div class="security-notice warn">
        <div class="sec-icon">⚠️</div>
        <p>E-posta değiştirmek yüksek güvenlik gerektirir. Mevcut şifrenle kimliğini doğrulamalısın.</p>
      </div>
      <div class="input-group">
        <label>Mevcut Şifre</label>
        <input type="password" id="reAuthPass" placeholder="Mevcut şifren">
      </div>
      <div class="input-group">
        <label>Yeni E-posta</label>
        <input type="email" id="newEmailInput" placeholder="yeni@eposta.com">
      </div>
      <div class="input-group">
        <label>Yeni E-posta (tekrar)</label>
        <input type="email" id="newEmailInput2" placeholder="yeni@eposta.com">
      </div>
      <button class="btn-primary" id="btnChangeEmail" style="width:100%">E-postayı Değiştir</button>
    `);

    setTimeout(() => {
      document.getElementById('btnChangeEmail')?.addEventListener('click', async () => {
        const pass = document.getElementById('reAuthPass').value;
        const newEmail = document.getElementById('newEmailInput').value.trim().toLowerCase();
        const newEmail2 = document.getElementById('newEmailInput2').value.trim().toLowerCase();
        if (!pass) return toast('Şifrenizi girin', 'error');
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) return toast('Geçersiz e-posta', 'error');
        if (newEmail !== newEmail2) return toast('E-postalar eşleşmiyor', 'error');
        if (!isEmailAllowed(newEmail)) return toast('Geçici e-posta kabul edilmiyor', 'error');
        if (newEmail === auth.currentUser.email) return toast('Bu zaten mevcut e-postan', 'warn');

        const btn = document.getElementById('btnChangeEmail');
        btn.disabled = true; btn.textContent = 'Doğrulanıyor...';
        try {
          const credential = firebase.auth.EmailAuthProvider.credential(auth.currentUser.email, pass);
          await auth.currentUser.reauthenticateWithCredential(credential);
          await auth.currentUser.updateEmail(newEmail);
          await auth.currentUser.sendEmailVerification({
            url: 'https://serkankarakad-gif.github.io/GameZone/?verified=1',
            handleCodeInApp: false
          });
          await dbUpdate('users/' + GZ.uid, { email: newEmail, verified: false });
          await db.ref('security/emailChanges/' + GZ.uid).push({
            oldEmail: auth.currentUser.email, newEmail,
            ts: firebase.database.ServerValue.TIMESTAMP
          });
          toast('✅ E-posta güncellendi! Yeni adresini doğrula.', 'success', 5000);
          closeModal();
          setTimeout(() => auth.signOut(), 2000);
        } catch (e) {
          if (e.code === 'auth/wrong-password') toast('Şifre yanlış', 'error');
          else if (e.code === 'auth/requires-recent-login') toast('Oturum eskidi. Tekrar giriş yap.', 'error');
          else if (e.code === 'auth/email-already-in-use') toast('Bu e-posta başka hesapta kullanılıyor', 'error');
          else toast('Hata: ' + (e.message || ''), 'error');
        }
        btn.disabled = false; btn.textContent = 'E-postayı Değiştir';
      });
    }, 100);
  };

  /* Şifre değiştir — Re-Auth */
  window.changePassword = async function () {
    showModal('🔑 Şifre Değiştir', `
      <div class="security-notice">
        <div class="sec-icon">🔐</div>
        <p>Güvenliğin için mevcut şifreni doğrulaman gerekiyor.</p>
      </div>
      <div class="input-group">
        <label>Mevcut Şifre</label>
        <input type="password" id="cpOld" placeholder="Mevcut şifren">
      </div>
      <div class="input-group">
        <label>Yeni Şifre</label>
        <input type="password" id="cpNew" placeholder="En az 8 karakter">
      </div>
      <div class="input-group">
        <label>Yeni Şifre (tekrar)</label>
        <input type="password" id="cpNew2" placeholder="Yeni şifreni tekrarla">
      </div>
      <div id="cpStrBar" style="height:4px;border-radius:2px;width:0%;transition:.3s;margin-bottom:4px"></div>
      <div id="cpStrLbl" style="font-size:11px;font-weight:600;margin-bottom:12px"></div>
      <button class="btn-primary" id="btnChangePass" style="width:100%">Şifreyi Değiştir</button>
    `);

    setTimeout(() => {
      document.getElementById('cpNew')?.addEventListener('input', e => {
        const s = passStrength(e.target.value);
        const cols = ['#dc2626', '#ef4444', '#f59e0b', '#16a34a', '#15803d', '#0d5c32'];
        const labs = ['Çok Zayıf', 'Zayıf', 'Orta', 'İyi', 'Güçlü', 'Çok Güçlü'];
        const bar = document.getElementById('cpStrBar');
        const lbl = document.getElementById('cpStrLbl');
        if (bar) { bar.style.width = (s * 20) + '%'; bar.style.background = cols[s]; }
        if (lbl) { lbl.textContent = labs[s]; lbl.style.color = cols[s]; }
      });

      document.getElementById('btnChangePass')?.addEventListener('click', async () => {
        const old = document.getElementById('cpOld').value;
        const nw = document.getElementById('cpNew').value;
        const nw2 = document.getElementById('cpNew2').value;
        if (!old) return toast('Mevcut şifreni gir', 'error');
        if (nw.length < 6) return toast('Şifre en az 6 karakter olmalı', 'error');
        if (nw !== nw2) return toast('Şifreler eşleşmiyor', 'error');
        if (passStrength(nw) < 2) return toast('Şifre çok zayıf', 'warn');

        const btn = document.getElementById('btnChangePass');
        btn.disabled = true; btn.textContent = 'Değiştiriliyor...';
        try {
          const cred = firebase.auth.EmailAuthProvider.credential(auth.currentUser.email, old);
          await auth.currentUser.reauthenticateWithCredential(cred);
          await auth.currentUser.updatePassword(nw);
          await db.ref('security/passChanges/' + GZ.uid).push({
            ts: firebase.database.ServerValue.TIMESTAMP
          });
          toast('✅ Şifre değiştirildi!', 'success');
          closeModal();
        } catch (e) {
          if (e.code === 'auth/wrong-password') toast('Mevcut şifre yanlış', 'error');
          else toast('Hata: ' + (e.message || ''), 'error');
        }
        btn.disabled = false; btn.textContent = 'Şifreyi Değiştir';
      });
    }, 100);
  };

  /* ══════════════════════════════════════════════════════════════════════
     DOĞRULAMA PANELİ (standart hesap için)
     ══════════════════════════════════════════════════════════════════════ */

  $('#btnVerifyCheck').addEventListener('click', async () => {
    if (!auth.currentUser) return showPanel('login');
    await auth.currentUser.reload();
    if (auth.currentUser.emailVerified) {
      await dbUpdate('users/' + auth.currentUser.uid, { verified: true });
      toast('✅ Hesabın doğrulandı! Hoş geldin.', 'success');
      enterGame();
    } else {
      toast('E-posta henüz doğrulanmamış. Spam klasörünü kontrol et.', 'warn');
    }
  });

  $('#btnVerifyResend').addEventListener('click', async () => {
    if (!auth.currentUser) return;
    try {
      await auth.currentUser.sendEmailVerification({
        url: 'https://serkankarakad-gif.github.io/GameZone/?verified=1',
        handleCodeInApp: false
      });
      toast('📧 Doğrulama e-postası tekrar gönderildi. Spam klasörünü kontrol et!', 'success');
    } catch (e) {
      toast(e.code === 'auth/too-many-requests' ? 'Birkaç dakika bekle.' : 'Hata: ' + e.message, 'warn');
    }
  });

  $('#btnVerifyLogout').addEventListener('click', async () => { await auth.signOut(); showPanel('login'); });
  $('#btnBanLogout').addEventListener('click', async () => { await auth.signOut(); location.reload(); });

  /* ══════════════════════════════════════════════════════════════════════
     AUTH STATE
     ══════════════════════════════════════════════════════════════════════ */

  auth.onAuthStateChanged(async (user) => {
    splash.classList.remove('hidden');

    // Admin oturumu devam ediyor mu? (sayfa yenilenince)
    if (sessionStorage.getItem('gz_admin_active') === '1') {
      const adminScr = document.getElementById('adminScreen');
      if (adminScr && user) {
        splash.classList.add('hidden');
        window.GZ_IS_FOUNDER = true;
        window.GZ_FOUNDER_VERIFIED = true;
        adminScr.style.display = 'flex';
        GZ.user = user; GZ.uid = user.uid;

        // adminScreenBody'ye hemen yükleniyor göster (siyah ekran önleme)
        const _adminBody = document.getElementById('adminScreenBody');
        if (_adminBody && !_adminBody.innerHTML.trim()) {
          _adminBody.innerHTML = '<div style="padding:40px;text-align:center;color:#3b82f6;font-size:14px;font-weight:700">⚡ Yönetici paneli yükleniyor...</div>';
        }
        const lbl = document.getElementById('adminTopbarUser');

        // Kullanıcı verisi + AP başlatma — timeout ile güvenli
        Promise.race([
          firebase.database().ref('users/'+user.uid).once('value'),
          new Promise((_,rej) => setTimeout(() => rej(new Error('user-data-timeout')), 8000))
        ]).then(s => {
          GZ.data = (s && s.val()) || {};
          if (lbl) lbl.textContent = (GZ.data?.username || user.uid) + ' (Yönetici)';
          try { if (typeof initEkonomi === 'function') initEkonomi(); } catch(e) { console.warn('[Admin] initEkonomi hatası:', e); }
        }).catch(e => {
          console.warn('[Admin] Kullanıcı verisi çekilemedi:', e && (e.message || e.code || e));
          GZ.data = GZ.data || {};
          if (lbl) lbl.textContent = (user.uid) + ' (Yönetici)';
        }).finally(() => {
          // AP hazır olana kadar bekle — max 10sn timeout
          let _apTries = 0;
          const _tryAP = () => {
            _apTries++;
            if (window.AP?.openAdminPanel) {
              window.AP.openAdminPanel();
            } else if (_apTries < 33) {
              setTimeout(_tryAP, 300);
            } else {
              // AP hiç yüklenmediyse hata göster
              const b = document.getElementById('adminScreenBody');
              if (b) b.innerHTML = '<div style="padding:40px;text-align:center;color:#ef4444;font-size:14px">❌ Admin modülü yüklenemedi.<br><br><button onclick="location.reload()" style="background:#3b82f6;color:#fff;border:none;padding:10px 20px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:700">🔄 Sayfayı Yenile</button></div>';
              console.error('[Admin] AP modülü 10sn içinde yüklenemedi.');
            }
          };
          _tryAP();
        });
        return;
      }
    }

    // Failsafe: 8sn sonra splash kapanır
    const _sTO = setTimeout(()=>{
      splash.classList.add('hidden');
      if(!gameScreen.classList.contains('active')) authScreen.classList.add('active');
    }, 8000);

    try {
      if (!user) {
        sessionStorage.removeItem('gz_admin_active');
        authScreen.classList.add('active');
        gameScreen.classList.remove('active');
        banScreen.classList.remove('active');
        splash.classList.add('hidden');
        GZ.user=null; GZ.uid=null;
        // Destek widgetını geri göster (giriş ekranına döndük)
        const sw = document.getElementById('supportWidget');
        if (sw) sw.style.display = '';
        clearTimeout(_sTO); return;
      }

      GZ.user=user; GZ.uid=user.uid;
      checkSessionTimeout();

      const userIsAnon = await Promise.race([dbGet('users/'+user.uid+'/isAnonymous'),new Promise(r=>setTimeout(()=>r(null),3000))]);
      if (!userIsAnon && !user.emailVerified) {
        $('#verifyEmailText').textContent = user.email+' adresine doğrulama bağlantısı gönderildi.';
        authScreen.classList.add('active');
        gameScreen.classList.remove('active');
        showPanel('verify');
        splash.classList.add('hidden');
        clearTimeout(_sTO); return;
      }

      let userData = await Promise.race([dbGet('users/'+user.uid),new Promise(r=>setTimeout(()=>r(null),4000))]);
      if (!userData) {
        try {
          const uname=(user.email?.split('@')[0]||'Oyuncu').replace(/[^a-zA-Z0-9_]/g,'').slice(0,16);
          await createUserData(user.uid,uname,user.email,!!userIsAnon,null);
          userData=await Promise.race([dbGet('users/'+user.uid),new Promise(r=>setTimeout(()=>r({}),3000))]);
        } catch(e){userData={};}
      }

      const banned=await Promise.race([dbGet('users/'+user.uid+'/banned'),new Promise(r=>setTimeout(()=>r(false),2000))]);
      if (banned) {
        authScreen.classList.remove('active');
        gameScreen.classList.remove('active');
        banScreen.classList.add('active');
        splash.classList.add('hidden');
        clearTimeout(_sTO);
        const reason=await Promise.race([dbGet('users/'+user.uid+'/banReason'),new Promise(r=>setTimeout(()=>r(''),2000))]);
        if(reason) $('#banReason').textContent=reason;
        return;
      }

      if(!userData?.verified) dbUpdate('users/'+user.uid,{verified:true}).catch(()=>{});
      GZ.data=userData||{};
      clearTimeout(_sTO);
      enterGame();
    } catch(err) {
      console.error('[Auth]',err);
      splash.classList.add('hidden');
      clearTimeout(_sTO);
      authScreen.classList.add('active');
    }
  });

  async function enterGame() {
    // GZ.uid kontrolü
    if (!GZ.uid) {
      console.error('[enterGame] GZ.uid yok, giriş iptal.');
      return;
    }

    // Ekranları kapat
    document.getElementById('authScreen').classList.remove('active');
    document.getElementById('authScreen').style.display = '';
    banScreen.classList.remove('active');
    banScreen.style.display = '';
    splash.classList.add('hidden');
    splash.style.display = '';

    // Oyun ekranını aç — inline style temizle, CSS flex devralır
    gameScreen.style.display = '';
    gameScreen.classList.add('active');

    // Tema: her zaman dark
    document.documentElement.setAttribute('data-theme', 'dark');
    localStorage.setItem('theme', 'dark');

    // Destek widgetını oyun içinde gizle (sadece giriş ekranında görünsün)
    const sw = document.getElementById('supportWidget');
    if (sw) sw.style.display = 'none';

    // Açılışta .once() ile veri çek (sistemi kilitlemez)
    try {
      const snap = await db.ref('users/' + GZ.uid).once('value');
      GZ.data = snap.val() || {};
    } catch(e) {
      console.warn('[enterGame] Veri çekme hatası, local ile devam:', e);
      GZ.data = GZ.data || {};
    }

    // Topbar'ı güncelle
    try { renderTopbar(); } catch(e) {}

    // Sonrasında .on() ile canlı dinlemeye geç
    const userRef = db.ref('users/' + GZ.uid);
    const cb = userRef.on('value', s => {
      GZ.data = s.val() || {};
      try { renderTopbar(); } catch(e) {}
      if (GZ.data?.banned) location.reload();
    });
    GZ.listeners.push({ ref: userRef, cb });

    setupPresence(GZ.uid);
    updateActivity();

    // Ekonomiyi başlat
    try {
      if (typeof initEkonomi === 'function') initEkonomi();
    } catch(e) { console.warn('[enterGame] initEkonomi hatası:', e); }

    // initUI — try-catch ile güvenli tetikle
    try {
      if (typeof initUI === 'function') {
        initUI();
      } else {
        console.error('[enterGame] initUI fonksiyonu bulunamadı! ui-manager.js yüklü mü?');
      }
    } catch(e) {
      console.error('[enterGame] initUI hatası:', e);
    }

    setTimeout(async () => {
      try {
        if (typeof checkDailyLogin === 'function') await checkDailyLogin();
        if (typeof processTaxAndSalaryIfDue === 'function') await processTaxAndSalaryIfDue();
        if (typeof checkAndGrantAchievement === 'function') await checkAndGrantAchievement(GZ.uid, 'login');
      } catch(e) { console.warn('[enterGame] Periyodik kontrol hatası:', e); }
    }, 3000);
  }

  function renderTopbar() {
    const d = GZ.data || {};
    const cashEl = document.getElementById('cashTxt');
    const diaEl  = document.getElementById('diaTxt');
    const lvlEl  = document.getElementById('lvlPill');
    const xpFill = document.getElementById('xpFill');
    const xpText = document.getElementById('xpText');
    if (cashEl) cashEl.textContent = cashFmt(d.money || 0);
    if (diaEl)  diaEl.textContent  = fmtInt(d.diamonds || 0);
    if (lvlEl)  lvlEl.textContent  = 'Lv ' + (d.level || 1);
    const need = xpForLevel(d.level || 1);
    const pct  = Math.min(100, Math.floor(((d.xp || 0) / need) * 100));
    if (xpFill) xpFill.style.width = pct + '%';
    if (xpText) xpText.textContent = (d.xp || 0) + '/' + need;
  }
  window.renderTopbar = renderTopbar;

  setTimeout(() => { if (!auth.currentUser) splash.classList.add('hidden'); }, 1500);

  // Dışarı export edilen sabit
  window.GZ_STARTING_MONEY = STARTING_MONEY;
  window.GZ_STARTING_DIAMONDS = STARTING_DIAMONDS;

})();



/* ╔══════════════════════════════════════════════════════════════════════════╗
   ║                                                                          ║
   ║   ⚡⚡⚡  YETKİLİ / KURUCU GİRİŞ SİSTEMİ v4.1 — GÜVENLİ ⚡⚡⚡              ║
   ║                                                                          ║
   ║   ────────────────────────────────────────────────────────────────       ║
   ║   2 YÖNTEM ARTIK VAR:                                                    ║
   ║                                                                          ║
   ║   1️⃣ AUTH EKRANINDA "⚡ Yetkili" SEKMESİ                                 ║
   ║      Giriş yapmadan önce sekmeyi seç, normal hesabınla giriş yap         ║
   ║      ve sonra yetkili şifresi gir                                        ║
   ║                                                                          ║
   ║   2️⃣ TOPBAR'DA SAĞ ÜSTTE ⚡ BUTONU                                       ║
   ║      Giriş yaptıktan sonra her zaman görünür                             ║
   ║      Tıkla, şifreyi gir, yetki aktif!                                    ║
   ║                                                                          ║
   ║   ŞİFRE: Firebase'de system/founderPassHash olarak saklanır.             ║
   ║   İlk kurulumda tarayıcı konsoluna şunu yaz:                            ║
   ║   > window.GZ_setupFounderPass('yeni_sifren')                           ║
   ║                                                                          ║
   ╚══════════════════════════════════════════════════════════════════════════╝ */

(function FounderModule(){
  
  // ═══════════════════════════════════════════════════════════════════════
  //   KONFIGÜRASYON — şifre artık JS'de DEĞİL, Firebase'de hash olarak
  // ═══════════════════════════════════════════════════════════════════════
  const CFG = {
    // PASSWORD artık burada YOK — Firebase /system/founderPassHash'te SHA-256 hash
    MAX_ATTEMPTS:      3,
    LOCK_DURATION_MS:  60 * 60 * 1000,
    LS_LOCK:           'gz_founder_lock_v4',
    LS_ATTEMPTS:       'gz_founder_attempts_v4',
  };

  /* ──────────────────────────────────────────────────────────────
     SHA-256 yardımcısı (Web Crypto API — tüm modern tarayıcıda var)
     ────────────────────────────────────────────────────────────── */
  async function sha256hex(text) {
    const buf  = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /* ──────────────────────────────────────────────────────────────
     Firebase'den hash al (cache'le — her doğrulamada çekme)
     ────────────────────────────────────────────────────────────── */
  let _cachedPassHash = null;
  async function getFounderPassHash() {
    if (_cachedPassHash) return _cachedPassHash;
    try {
      const snap = await firebase.database().ref('system/founderPassHash').once('value');
      _cachedPassHash = snap.val() || '';
      return _cachedPassHash;
    } catch(e) {
      console.warn('[Founder] Hash alınamadı:', e.message);
      return '';
    }
  }

  /* ──────────────────────────────────────────────────────────────
     İlk kurulum yardımcısı — tarayıcı konsolundan bir kez çalıştır:
       window.GZ_setupFounderPass('yeni_sifren')
     Bundan sonra şifre sadece Firebase'de (hash olarak) tutulur.
     ────────────────────────────────────────────────────────────── */
  window.GZ_setupFounderPass = async function(plainPass) {
    if (!plainPass || plainPass.length < 6) {
      console.error('[Founder] Şifre en az 6 karakter olmalı!');
      return;
    }
    const hash = await sha256hex('gz_founder_v1_' + plainPass);
    await firebase.database().ref('system/founderPassHash').set(hash);
    _cachedPassHash = hash;
    console.log('%c[Founder] ✅ Şifre güvenli biçimde kaydedildi. Hash:', 'color:lime', hash.slice(0,16)+'...');
    console.log('%cBu fonksiyonu bir daha çağırmana gerek yok.', 'color:yellow');
  };

  // ═══════════════════════════════════════════════════════════════════════
  //   YARDIMCILAR
  // ═══════════════════════════════════════════════════════════════════════
  function notify(msg, kind = 'info', ms = 3500) {
    if (typeof window.toast === 'function') {
      try { return window.toast(msg, kind, ms); } catch(e) {}
    }
    if (kind === 'error')        alert('❌ ' + msg);
    else if (kind === 'success') alert('✅ ' + msg);
    else                          alert(msg);
  }

  function deviceFP() {
    try {
      const s = (navigator.userAgent||'') + '|' + (navigator.language||'') + '|' + screen.width + 'x' + screen.height;
      let h = 0;
      for (let i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0; }
      return Math.abs(h).toString(36);
    } catch(e) { return 'unknown'; }
  }

  function getLockInfo() {
    try {
      const raw = localStorage.getItem(CFG.LS_LOCK);
      if (!raw) return null;
      const lock = JSON.parse(raw);
      if (!lock || !lock.until || Date.now() > lock.until) {
        localStorage.removeItem(CFG.LS_LOCK);
        localStorage.removeItem(CFG.LS_ATTEMPTS);
        return null;
      }
      return { remainingMs: lock.until - Date.now(), remainingMin: Math.ceil((lock.until - Date.now()) / 60000) };
    } catch(e) { return null; }
  }

  function lockDevice() {
    try {
      localStorage.setItem(CFG.LS_LOCK, JSON.stringify({ until: Date.now() + CFG.LOCK_DURATION_MS }));
      localStorage.removeItem(CFG.LS_ATTEMPTS);
    } catch(e) {}
  }

  function incrAttempts() {
    try {
      const cur = parseInt(localStorage.getItem(CFG.LS_ATTEMPTS) || '0');
      const nv = cur + 1;
      localStorage.setItem(CFG.LS_ATTEMPTS, String(nv));
      return nv;
    } catch(e) { return 1; }
  }

  function resetAttempts() {
    try { localStorage.removeItem(CFG.LS_ATTEMPTS); } catch(e) {}
  }

  async function safeDbSet(path, data) {
    try {
      if (typeof firebase === 'undefined' || !firebase.database) return false;
      await firebase.database().ref(path).set(data);
      return true;
    } catch(e) {
      console.warn('[Founder] DB set fail:', path, e.message);
      return false;
    }
  }

  async function safeDbPush(path, data) {
    try {
      if (typeof firebase === 'undefined' || !firebase.database) return false;
      await firebase.database().ref(path).push(data);
      return true;
    } catch(e) { return false; }
  }

  async function safeDbGet(path) {
    try {
      if (typeof firebase === 'undefined' || !firebase.database) return null;
      const s = await firebase.database().ref(path).once('value');
      return s.val();
    } catch(e) { return null; }
  }

  // ═══════════════════════════════════════════════════════════════════════
  //   ANA YETKİLENDİRME FONKSİYONU (2 modda çalışır)
  //   Mod 1: Zaten giriş yapmış → sadece şifre yeterli
  //   Mod 2: Giriş yapmamış → email + accPass + founderPass al, direkt yetkili giriş yap
  // ═══════════════════════════════════════════════════════════════════════
  async function authorizeFounder(passwordValue, opts = {}) {
    // 1) Kilit kontrolü
    const lock = getLockInfo();
    if (lock) {
      notify(`🚫 Cihaz kilitli! ${lock.remainingMin} dakika sonra tekrar dene.`, 'error');
      return { ok: false, reason: 'locked' };
    }

    // 2) Boş şifre kontrolü
    if (!passwordValue || passwordValue.length === 0) {
      notify('Yetkili şifresini gir!', 'error');
      return { ok: false, reason: 'empty' };
    }

    // 3) Şifre doğrulama — Firebase'deki SHA-256 hash ile karşılaştır
    const enteredHash  = await sha256hex('gz_founder_v1_' + passwordValue);
    const storedHash   = await getFounderPassHash();

    if (!storedHash) {
      notify('⚠️ Yetkili şifresi henüz ayarlanmamış! Konsola şunu yaz:\nwindow.GZ_setupFounderPass("sifren")', 'error', 7000);
      return { ok: false, reason: 'not_configured' };
    }

    if (enteredHash !== storedHash) {
      const attempts = incrAttempts();
      const remaining = CFG.MAX_ATTEMPTS - attempts;

      // Log
      const _user = (typeof firebase !== 'undefined' && firebase.auth) ? firebase.auth().currentUser : null;
      safeDbPush('security/founderAttempts', {
        ts: firebase.database.ServerValue.TIMESTAMP,
        uid: _user ? _user.uid : 'no_user',
        success: false,
        fp: deviceFP()
      });

      if (attempts >= CFG.MAX_ATTEMPTS) {
        lockDevice();
        notify(`🚫 ${CFG.MAX_ATTEMPTS} hatalı deneme! Cihaz 1 saat kilitlendi.`, 'error', 6000);
      } else {
        notify(`❌ Hatalı yetkili şifresi! Kalan deneme: ${remaining}`, 'error', 4000);
      }
      return { ok: false, reason: 'wrong_password' };
    }

    // ─── ŞİFRE DOĞRU ───

    // 4) Mevcut auth durumu kontrol
    let currentUser = (typeof firebase !== 'undefined' && firebase.auth) ? firebase.auth().currentUser : null;

    // Eğer kullanıcı henüz giriş yapmamışsa: otomatik giriş yap
    if (!currentUser) {
      // opts'tan email/pass geldi mi?
      if (!opts.email || !opts.accPass) {
        notify('Hesap bilgilerini gir (email + hesap şifresi)!', 'error');
        return { ok: false, reason: 'need_login' };
      }

      try {
        notify('Hesaba giriş yapılıyor...', 'info', 2000);

        // Email mi yoksa kullanıcı adı mı?
        let emailToUse = opts.email.trim();
        if (!emailToUse.includes('@')) {
          // Kullanıcı adı verilmiş, e-postasını bul
          const usernameSnap = await safeDbGet('usernames/' + emailToUse.toLowerCase());
          if (!usernameSnap) {
            notify('Bu kullanıcı adı bulunamadı', 'error');
            return { ok: false, reason: 'no_user' };
          }
          // UID'den kullanıcı verisini al
          const uid4Founder = usernameSnap;
          const userData = await safeDbGet('users/' + uid4Founder);
          if (!userData) {
            notify('Hesap bulunamadı', 'error');
            return { ok: false, reason: 'no_user' };
          }
          // Anonim hesap: sahte email oluştur; standart hesap: DB'deki email kullan
          if (userData.isAnonymous || !userData.email) {
            const buf = new TextEncoder().encode('gz_anon_' + emailToUse.toLowerCase());
            const hashBuf = await crypto.subtle.digest('SHA-256', buf);
            const hex = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
            emailToUse = 'u_' + hex.slice(0, 20) + '@anon.gamezone.local';
          } else {
            emailToUse = userData.email;
          }
        }

        // Firebase auth ile giriş
        const cred = await firebase.auth().signInWithEmailAndPassword(emailToUse, opts.accPass);
        currentUser = cred.user;
      } catch(e) {
        console.error('[Founder] Auto-login fail:', e);
        let msg = 'Hesap bilgileri hatalı';
        if (e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential') msg = '❌ Hesap şifresi hatalı';
        else if (e.code === 'auth/user-not-found') msg = '❌ Kullanıcı bulunamadı';
        else if (e.code === 'auth/invalid-email') msg = '❌ Geçersiz e-posta';
        else if (e.code === 'auth/too-many-requests') msg = '⏳ Çok fazla deneme, biraz bekle';
        notify(msg, 'error', 5000);
        return { ok: false, reason: 'login_failed' };
      }
    }

    // 5) Yetkilendirme
    resetAttempts();

    // ── Yetkili e-posta hash kontrolü (e-posta düz metin SAKLANMAZ) ──
    function _isAdminEmailHash(em) {
      if (!em || typeof em !== 'string') return false;
      const e = em.trim().toLowerCase();
      const h = [...e].reduce((a, c) => a + c.charCodeAt(0), 0);
      let x = 0;
      for (let i = 0; i < e.length; i++) x = ((x << 3) - x + e.charCodeAt(i)) & 0xFFFF;
      let m = 1;
      for (let i = 0; i < e.length; i++) m = (m * 31 + e.charCodeAt(i)) & 0x7FFFFFFF;
      return h === 1908 && e.length === 20 && x === 64726 && m === 2009737551
          && e.charCodeAt(0) === 115 && e.charCodeAt(19) === 109;
    }

    // Kendi banını ve bakım modunu otomatik kaldır (yetkili e-posta için tek seferlik kurtarma)
    try {
      const _cu = currentUser;
      if (_cu && _cu.email && _isAdminEmailHash(_cu.email)) {
        await firebase.database().ref('users/' + _cu.uid + '/banned').set(false);
        await firebase.database().ref('users/' + _cu.uid + '/banReason').remove();
        await firebase.database().ref('system/maintenance').set({ active: false });
        console.log('[Founder] 🔓 Ban ve bakım modu otomatik kaldırıldı.');
      }
    } catch(_e) { console.warn('[Founder] Oto-kurtarma hatası:', _e); }

    try {
      const uid = currentUser.uid;
      const username = (window.GZ && window.GZ.data && window.GZ.data?.username) ||
                       currentUser.displayName || 'Founder';

      await safeDbSet('users/' + uid + '/isFounder', true);
      await safeDbSet('users/' + uid + '/founderRole', 'admin');
      await safeDbSet('system/founders/' + uid, {
        username:    username,
        activatedAt: firebase.database.ServerValue.TIMESTAMP,
        role:        'admin',
        fp:          deviceFP()
      });

      safeDbPush('security/founderAttempts', {
        ts: firebase.database.ServerValue.TIMESTAMP,
        uid: uid,
        success: true,
        fp: deviceFP()
      });

      window.GZ_IS_FOUNDER      = true;
      window.GZ_FOUNDER_VERIFIED  = true;

      // Session kaydet — yenilenince admin kalır
      sessionStorage.setItem('gz_admin_active','1');
      sessionStorage.setItem('gz_founder_session',JSON.stringify({uid,activated:Date.now()}));

      // authorityUid kaydet
      firebase.database().ref('system/authorityUid').set(uid).catch(()=>{});

      // Admin ekranını aç — OYUN KAPANIR
      const _gs=document.getElementById('gameScreen');
      const _as=document.getElementById('adminScreen');
      const _au=document.getElementById('authScreen');
      if(_gs){_gs.classList.remove('active');_gs.style.display='none';}
      if(_au){_au.classList.remove('active');_au.style.display='none';}
      if(_as){
        _as.style.display='flex';
        const lbl=document.getElementById('adminTopbarUser');
        if(lbl) lbl.textContent=(window.GZ?.data?.username||uid)+' (Yönetici)';
      }

      // AP hazır olana kadar bekle
      const _tryAP=()=>{
        if(window.AP?.openAdminPanel){ window.AP.openAdminPanel(); }
        else { setTimeout(_tryAP,250); }
      };
      setTimeout(_tryAP,400);

      window.exitAdminMode=function(){
        sessionStorage.removeItem('gz_admin_active');
        if(_as) _as.style.display='none';
        if(_gs){_gs.style.display='';_gs.classList.add('active');}
      };

      activateTopbarButton();
      notify('⚡ YETKİLİ OTURUMU AÇILDI','success',4000);
      return {ok:true};

    } catch(e){
      console.error('[Founder]',e);
      notify('Yetki aktive edilemedi: '+e.message,'error');
      return {ok:false,reason:'error'};
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  //   AUTH EKRANI: "⚡ Yetkili" SEKMESİ
  // ═══════════════════════════════════════════════════════════════════════
  function setupAuthTabFlow() {
    // Auth ekranındaki "⚡ Yetkili olarak yetkilendir" butonu
    const btnAuthFounder = document.getElementById('btnFounderLogin');
    if (btnAuthFounder && btnAuthFounder.dataset.bound !== '1') {
      btnAuthFounder.dataset.bound = '1';
      btnAuthFounder.addEventListener('click', async (e) => {
        e.preventDefault();
        const passEl = document.getElementById('founderPass');
        const emailEl = document.getElementById('founderEmail');
        const accPassEl = document.getElementById('founderAccPass');
        if (!passEl) return notify('Şifre alanı bulunamadı!', 'error');

        const opts = {
          email:   emailEl ? emailEl.value.trim() : '',
          accPass: accPassEl ? accPassEl.value : ''
        };

        // Buton disable
        btnAuthFounder.disabled = true;
        btnAuthFounder.textContent = '⏳ İşleniyor...';

        try {
          const result = await authorizeFounder(passEl.value || '', opts);
          if (result.ok) {
            passEl.value = '';
            if (accPassEl) accPassEl.value = '';
          }
        } finally {
          btnAuthFounder.disabled = false;
          btnAuthFounder.textContent = '⚡ YETKİLİ OLARAK GİRİŞ YAP';
        }
      });
    }

    // Enter ile gönder (her input için)
    ['founderEmail', 'founderAccPass', 'founderPass'].forEach(id => {
      const inp = document.getElementById(id);
      if (inp && inp.dataset.bound !== '1') {
        inp.dataset.bound = '1';
        inp.addEventListener('keypress', async (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            const btn = document.getElementById('btnFounderLogin');
            if (btn) btn.click();
          }
        });
      }
    });
  }

  function updateFounderStatusUI() {
    // Artık status göstergesi kullanılmıyor, ama eski referansları için
    return;
  }

  // ═══════════════════════════════════════════════════════════════════════
  //   TOPBAR ⚡ BUTONU (her zaman görünür)
  // ═══════════════════════════════════════════════════════════════════════
  function setupTopbarTrigger() {
    const btn = document.getElementById('founderTriggerBtn');
    if (!btn) {
      // Topbar henüz yüklenmediyse 1 saniye sonra tekrar dene
      if (!setupTopbarTrigger._tries) setupTopbarTrigger._tries = 0;
      setupTopbarTrigger._tries++;
      if (setupTopbarTrigger._tries < 15) setTimeout(setupTopbarTrigger, 1000);
      return;
    }
    if (btn.dataset.bound === '1') return;
    btn.dataset.bound = '1';

    btn.addEventListener('click', () => {
      // Eğer zaten yetkiliyse → kontrol panelini aç
      if (window.GZ_IS_FOUNDER && typeof window.openFounderPanel === 'function') {
        window.openFounderPanel();
        return;
      }
      // Değilse → şifre modal'ını aç
      openPasswordModal();
    });

    console.log('[Founder] ⚡ Topbar butonu hazır');
  }

  function activateTopbarButton() {
    const btn = document.getElementById('founderTriggerBtn');
    if (btn) {
      btn.classList.add('active');
      btn.title = 'Yetkili Paneli';
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  //   ŞİFRE MODAL'I (topbar butonundan açılır)
  // ═══════════════════════════════════════════════════════════════════════
  function openPasswordModal() {
    const panel = document.getElementById('founderLoginPanel');
    if (!panel) return notify('Modal bulunamadı', 'error');
    panel.classList.add('active');
    panel.style.display = 'flex';
    const inp = document.getElementById('founderPassModal');
    if (inp) {
      inp.value = '';
      setTimeout(() => inp.focus(), 100);
    }
  }

  function closePasswordModal() {
    const panel = document.getElementById('founderLoginPanel');
    if (panel) {
      panel.classList.remove('active');
      panel.style.display = 'none';
    }
  }

  function setupModalEvents() {
    const btnLogin = document.getElementById('btnFounderLoginModal');
    const btnClose = document.getElementById('btnFounderClose');
    const passInp  = document.getElementById('founderPassModal');

    if (btnLogin && btnLogin.dataset.bound !== '1') {
      btnLogin.dataset.bound = '1';
      btnLogin.addEventListener('click', async (e) => {
        e.preventDefault();
        if (!passInp) return;
        const result = await authorizeFounder(passInp.value || '');
        if (result.ok) {
          passInp.value = '';
          closePasswordModal();
        }
      });
    }

    if (btnClose && btnClose.dataset.bound !== '1') {
      btnClose.dataset.bound = '1';
      btnClose.addEventListener('click', (e) => {
        e.preventDefault();
        closePasswordModal();
      });
    }

    if (passInp && passInp.dataset.bound !== '1') {
      passInp.dataset.bound = '1';
      passInp.addEventListener('keypress', async (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const result = await authorizeFounder(passInp.value || '');
          if (result.ok) {
            passInp.value = '';
            closePasswordModal();
          }
        }
      });
    }

    // ESC ile kapatma
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const panel = document.getElementById('founderLoginPanel');
        if (panel && panel.classList.contains('active')) closePasswordModal();
      }
    });

    // Dış tıklama ile kapatma
    const panel = document.getElementById('founderLoginPanel');
    if (panel && panel.dataset.bound !== '1') {
      panel.dataset.bound = '1';
      panel.addEventListener('click', (e) => {
        if (e.target === panel) closePasswordModal();
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  //   AUTH STATE - Mevcut yetki kontrolü
  // ═══════════════════════════════════════════════════════════════════════
  function setupAuthListener() {
    if (typeof firebase === 'undefined' || !firebase.auth) return;
    firebase.auth().onAuthStateChanged(async (user) => {
      updateFounderStatusUI();
      if (!user) {
        window.GZ_IS_FOUNDER = false;
        const btn = document.getElementById('founderTriggerBtn');
        if (btn) btn.classList.remove('active');
        return;
      }
      try {
        const flag = await safeDbGet('users/'+user.uid+'/isFounder');
        if (flag===true) {
          // Sadece buton görünür - panel açılmaz, GZ_IS_FOUNDER set edilmez
          const btn2=document.getElementById('founderTriggerBtn');
          if(btn2) btn2.style.display='';
        }
      } catch(e){}
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  //   BAKIM MODU & GLOBAL DUYURU DİNLEYİCİLERİ
  // ═══════════════════════════════════════════════════════════════════════
  // ─── Bakım modunda yetkili bypass ───
  window._maintBypass = function() {
    const maint = document.getElementById('maintenanceScreen');
    const auth  = document.getElementById('authScreen');
    if (maint) { maint.classList.remove('active'); maint.style.display = 'none'; }
    if (auth)  { auth.style.display = 'flex'; }
    // Yetkili sekmesini otomatik aç
    setTimeout(() => {
      const tab = document.querySelector('.auth-tab[data-tab="founder"]');
      if (tab) tab.click();
      const passEl = document.getElementById('founderPass');
      if (passEl) setTimeout(() => passEl.focus(), 200);
    }, 150);
  };

  function setupSystemListeners() {
    if (typeof firebase === 'undefined' || !firebase.database) return;
    try {
      firebase.database().ref('system/maintenance').on('value', (s) => {
        const m = s.val();
        const screen = document.getElementById('maintenanceScreen');
        if (!screen) return;
        const isMaint = m && m.active === true;
        if (isMaint && !window.GZ_IS_FOUNDER) {
          screen.classList.add('active');
          screen.style.display = 'flex';
          const r = document.getElementById('maintReason');
          const e = document.getElementById('maintEta');
          if (r && m.reason) r.textContent = m.reason;
          if (e && m.eta)    e.textContent = 'Tahmini süre: ' + m.eta;
        } else {
          screen.classList.remove('active');
          screen.style.display = 'none';
        }
      });
    } catch(e) {}

    try {
      firebase.database().ref('broadcast/current').on('value', (s) => {
        const b = s.val();
        const bar = document.getElementById('globalBroadcast');
        if (!bar) return;
        const isActive = b && b.active === true && b.text && (!b.expiresAt || Date.now() < b.expiresAt);
        if (isActive) {
          bar.style.display = 'flex';
          const t = document.getElementById('gbText');
          if (t) t.textContent = b.text;
        } else {
          bar.style.display = 'none';
        }
      });
    } catch(e) {}

    const gbClose = document.getElementById('gbClose');
    if (gbClose && gbClose.dataset.bound !== '1') {
      gbClose.dataset.bound = '1';
      gbClose.addEventListener('click', () => {
        const bar = document.getElementById('globalBroadcast');
        if (bar) bar.style.display = 'none';
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  //   INIT
  // ═══════════════════════════════════════════════════════════════════════
  function init() {
    setupAuthTabFlow();
    setupTopbarTrigger();
    setupModalEvents();
    setupAuthListener();
    setupSystemListeners();
    console.log('%c[Founder v4] ⚡ Sistem aktif. Auth ekranında "⚡ Yetkili" sekmesi VEYA topbar\'da ⚡ butonu kullanılabilir.', 'color:#fbbf24;font-weight:bold');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 100);
  }

  // Geç yüklenen elementler için ekstra retry
  setTimeout(() => {
    setupAuthTabFlow();
    setupTopbarTrigger();
    setupModalEvents();
  }, 2500);

  setTimeout(() => {
    setupAuthTabFlow();
    setupTopbarTrigger();
    setupModalEvents();
  }, 5000);

  // ═══════════════════════════════════════════════════════════════════════
  //   PUBLIC API
  // ═══════════════════════════════════════════════════════════════════════
  window.openFounderLogin    = openPasswordModal;
  window.closeFounderLogin   = closePasswordModal;
  window.authorizeFounder    = authorizeFounder;
  window.GZ_isFounderLocked  = getLockInfo;
  window.GZ_resetFounderLock = () => {
    localStorage.removeItem(CFG.LS_LOCK);
    localStorage.removeItem(CFG.LS_ATTEMPTS);
    notify('🔓 Kilit kaldırıldı', 'success');
  };

})();


/* ╔══════════════════════════════════════════════════════════════════════════╗
   ║   ⚡ YETKİLİ ÜSTÜN GÜÇLER — Yetkili olunca her şeye erişim, hiç sınır    ║
   ╚══════════════════════════════════════════════════════════════════════════╝ */
(function FounderPowers(){
  
  // Yetkili olunca uygulanacak override'lar
  function applyFounderOverrides() {
    if (!window.GZ_IS_FOUNDER) return;

    // 1) Tüm seviye kilitlerini bypass et (canPlay, hire, vb.)
    window.GZ_FOUNDER_BYPASS_LEVEL = true;

    // 2) Bakım modunu görmezden gel (zaten giris.js'de var)
    // 3) Konsol komutları
    if (!window.founderHelp) {
      window.founderHelp = function() {
        // Komutlar gizli tutuldu
        console.log('%c⚡ Yetkili panelini kullan', 'color:#fbbf24');
      };
    }

    // ── KISA YOL FONKSİYONLAR (Console için) ──
    window.giveMoney = async (amount) => {
      if (!window.GZ_IS_FOUNDER || !window.GZ?.data?.isFounder) return console.warn('❌ Yetki yok');
      const r = await addCash(GZ.uid, amount, 'founder_self');
      toast(`💰 +${amount.toLocaleString('tr-TR')} ₺`, 'success');
      return r;
    };

    window.giveDiamonds = async (amount) => {
      if (!window.GZ_IS_FOUNDER) return console.warn('Yetki yok');
      const r = await addDiamonds(GZ.uid, amount);
      toast(`💎 +${amount} elmas`, 'success');
      return r;
    };

    window.setLevel = async (lv) => {
      if (!window.GZ_IS_FOUNDER) return console.warn('Yetki yok');
      await dbUpdate('users/' + GZ.uid, { level: lv, xp: 0 });
      toast(`📊 Seviye ${lv}`, 'success');
      setTimeout(() => location.reload(), 1500);
    };

    window.maintenanceOn = async (reason) => {
      if (!window.GZ_IS_FOUNDER) return console.warn('Yetki yok');
      if (window.founderActions) await window.founderActions.toggleMaintenance(true, reason || 'Sistem güncelleniyor', '15 dk');
      toast('🔧 Bakım modunda', 'success');
    };

    window.maintenanceOff = async () => {
      if (!window.GZ_IS_FOUNDER) return console.warn('Yetki yok');
      if (window.founderActions) await window.founderActions.toggleMaintenance(false);
      toast('✅ Bakımdan çıkıldı', 'success');
    };

    window.broadcast = async (text, durationMin) => {
      if (!window.GZ_IS_FOUNDER) return console.warn('Yetki yok');
      if (window.founderActions) await window.founderActions.sendBroadcast(text, durationMin || 30);
      toast('📢 Duyuru gönderildi', 'success');
    };

    window.broadcastClear = async () => {
      if (!window.GZ_IS_FOUNDER) return console.warn('Yetki yok');
      if (window.founderActions) await window.founderActions.clearBroadcast();
      toast('🚫 Duyuru kapatıldı', 'success');
    };

    window.notifyAll = async (msg, icon) => {
      if (!window.GZ_IS_FOUNDER) return console.warn('Yetki yok');
      if (window.founderActions) {
        const r = await window.founderActions.sendNotificationToAll(msg, icon || '📢');
        toast(`📨 ${r.count} oyuncuya gönderildi`, 'success');
      }
    };

    window.banUser = async (uid) => {
      if (!window.GZ_IS_FOUNDER) return console.warn('Yetki yok');
      if (window.founderActions) await window.founderActions.banUser(uid, 'Yetkili kararı');
      toast('🚫 Banlandı', 'success');
    };

    window.unbanUser = async (uid) => {
      if (!window.GZ_IS_FOUNDER) return console.warn('Yetki yok');
      if (window.founderActions) await window.founderActions.unbanUser(uid);
      toast('✅ Ban kaldırıldı', 'success');
    };

    window.giveMoneyTo = async (uid, amount) => {
      if (!window.GZ_IS_FOUNDER) return console.warn('Yetki yok');
      if (window.founderActions) await window.founderActions.grantMoney(uid, amount);
      toast(`💰 ${amount.toLocaleString('tr-TR')} ₺ verildi`, 'success');
    };

    window.foundStats = async () => {
      if (!window.GZ_IS_FOUNDER) return console.warn('Yetki yok');
      if (window.founderActions) {
        const r = await window.founderActions.getStats();
        console.table(r.stats);
        return r.stats;
      }
    };

    console.log('%c⚡ YETKİLİ AKTİF — Komutlar için: founderHelp()', 'background:linear-gradient(90deg,#fbbf24,#f59e0b);color:#000;padding:8px 16px;font-size:14px;font-weight:bold;border-radius:8px');
  }

  // Auth state değiştiğinde override'ları uygula
  if (typeof firebase !== 'undefined' && firebase.auth) {
    firebase.auth().onAuthStateChanged(() => {
      setTimeout(applyFounderOverrides, 1000);
      setTimeout(applyFounderOverrides, 3000);
      setTimeout(applyFounderOverrides, 6000);
    });
  }

  // Founder yetkisi alındığında da tetikle
  const _origActivate = window.activateTopbarButton;
  setTimeout(() => {
    setTimeout(applyFounderOverrides, 500);
  }, 500);
})();
/* ==========================================================================
   giris-eklenti.js — E-posta Doğrulama Düzeltmesi + Canlı Destek
   ─────────────────────────────────────────────────────────────────────────
   index.html'de giris.js'den SONRA ekle:
     <script src="giris-eklenti.js"></script>

   DÜZELTILENLER:
   1. E-posta doğrulama bildirimi gönderimi (retry + hata yönetimi)
   2. Doğrulama ekranı iyileştirmesi (yeniden gönder butonu)
   3. Oyuna girince e-posta doğrulanmamışsa uyarı banneri
   4. Canlı Destek widget (auth ekranı + oyun içi)
   5. Destek mesajları Firebase'e kaydedilir → admin panelden görünür
   ========================================================================== */

(function GirisEklenti() {
  
  /* ════════════════════════════════════════════════════════════════════
     1. E-POSTA DOĞRULAMA — TAM DÜZELTME
     ════════════════════════════════════════════════════════════════════ */

  /**
   * E-posta doğrulama maili gönder — retry + Türkçe hata mesajları
   * giris.js içindeki sendEmailVerification yerine bu kullanılır
   */
  async function sendVerificationEmail(user, attempt = 1) {
    if (!user || !user.email) return { ok: false, error: 'Kullanıcı bulunamadı' };

    // Anonim hesaplar doğrulama almaz
    if (user.email.endsWith('@anon.gamezone.local')) {
      return { ok: true, skipped: true };
    }

    try {
      // Firebase Action URL
      const actionCodeSettings = {
        url: 'https://serkankarakad-gif.github.io/GameZone/?verified=1&ts=' + Date.now(),
        handleCodeInApp: false
      };

      await user.sendEmailVerification(actionCodeSettings);

      // Firebase'e kayıt — son gönderim zamanı
      try {
        await firebase.database().ref('users/' + user.uid + '/lastVerifEmailSent')
          .set(firebase.database.ServerValue.TIMESTAMP);
      } catch(e) {}

      return { ok: true };
    } catch (e) {
      const errMap = {
        'auth/too-many-requests': 'Çok fazla istek gönderildi. Lütfen birkaç dakika bekle.',
        'auth/user-not-found':    'Kullanıcı bulunamadı.',
        'auth/network-request-failed': 'İnternet bağlantını kontrol et.',
        'auth/invalid-email':     'E-posta adresi geçersiz.',
      };

      const msg = errMap[e.code] || ('Gönderim hatası: ' + (e.message || e.code));

      // 2 kez retry yap
      if (attempt < 3 && e.code !== 'auth/too-many-requests') {
        await new Promise(r => setTimeout(r, 2000 * attempt));
        return sendVerificationEmail(user, attempt + 1);
      }

      return { ok: false, error: msg };
    }
  }

  /**
   * Kayıt olduktan sonra doğrulama e-postası gönder + ekranı göster
   * giris.js'deki createUserWithEmailAndPassword bloğunu yakala
   */
  async function handlePostRegister(user, email) {
    // Yükleniyor bildirimi
    if (typeof window.toast === 'function') {
      window.toast('📧 Doğrulama maili gönderiliyor...', 'info', 3000);
    }

    const result = await sendVerificationEmail(user);

    if (result.skipped) {
      // Anonim hesap — doğrulama gerekmez
      return;
    }

    if (result.ok) {
      // Doğrulama ekranını güncelle
      const verifyText = document.getElementById('verifyEmailText');
      if (verifyText) {
        verifyText.innerHTML = `
          <b>${escHtml(email)}</b> adresine doğrulama bağlantısı gönderdik.<br>
          <span style="font-size:12px;color:var(--muted)">
            Gelen kutunuzu ve spam/gereksiz klasörünüzü kontrol edin.
          </span>
        `;
      }
      if (typeof window.toast === 'function') {
        window.toast('📧 Doğrulama maili gönderildi! E-postanı kontrol et.', 'success', 6000);
      }
    } else {
      if (typeof window.toast === 'function') {
        window.toast('⚠️ Mail gönderilemedi: ' + result.error, 'warn', 8000);
      }
      // Yine de doğrulama ekranını göster — manuel retry butonu var
    }

    // Doğrulama ekranını zenginleştir
    enrichVerifyScreen(user, email);
  }

  /**
   * Doğrulama ekranını zenginleştir — yeniden gönder, yardım, durum kontrolü
   */
  function enrichVerifyScreen(user, email) {
    const panel = document.getElementById('verifyPanel');
    if (!panel) return;

    // Mevcut içeriği koru, altına ekstra butonlar ekle
    let extra = document.getElementById('verifyPanelExtra');
    if (extra) extra.remove();

    extra = document.createElement('div');
    extra.id = 'verifyPanelExtra';
    extra.innerHTML = `
      <div style="margin-top:14px">
        <!-- Geri sayım + yeniden gönder -->
        <div id="verifyCooldown" style="
          text-align:center;color:var(--muted);font-size:13px;margin-bottom:10px
        ">Mail gönderildi. Yeniden gönderebilmek için <b id="verifyCd">60</b> saniye bekle.</div>

        <button id="btnResendVerify" disabled style="
          width:100%;padding:12px;border-radius:10px;
          border:1px solid var(--border);background:var(--card-bg);
          color:var(--muted);font-size:13px;cursor:not-allowed;margin-bottom:8px
        ">📧 Doğrulama Mailini Yeniden Gönder</button>

        <button id="btnCheckVerify" style="
          width:100%;padding:12px;border-radius:10px;
          border:none;background:#3b82f6;color:#fff;
          font-size:13px;font-weight:700;cursor:pointer;margin-bottom:8px
        ">🔄 Doğruladım — Kontrol Et</button>

        <button id="btnVerifyHelp" style="
          width:100%;padding:10px;border-radius:10px;
          border:1px solid var(--border);background:transparent;
          color:var(--muted);font-size:12px;cursor:pointer
        ">❓ Mail gelmiyor mu? Yardım al</button>

        <!-- Sorun giderme ipuçları -->
        <div id="verifyTips" style="display:none;
          background:rgba(59,130,246,0.08);border:1px solid rgba(59,130,246,0.2);
          border-radius:10px;padding:12px;margin-top:10px;font-size:12px;
          color:var(--muted);line-height:1.6
        ">
          <b style="color:var(--text)">📋 Mail gelmiyor mu?</b><br>
          1. Spam / Gereksiz klasörünü kontrol et<br>
          2. <b>${escHtml(email)}</b> adresinin doğru olduğuna emin ol<br>
          3. 5 dakika bekle — gecikme olabilir<br>
          4. Farklı bir e-posta ile tekrar kayıt ol<br>
          5. Sorun devam ediyorsa canlı destek kullan ↓
          <div style="margin-top:8px">
            <button onclick="openLiveSupport()" style="
              background:#10b981;border:none;color:#fff;padding:8px 16px;
              border-radius:8px;cursor:pointer;font-size:12px;font-weight:600
            ">💬 Canlı Destek</button>
          </div>
        </div>
      </div>
    `;

    panel.appendChild(extra);

    // Geri sayım — 60 sn
    let cd = 60;
    const cdEl = document.getElementById('verifyCd');
    const resendBtn = document.getElementById('btnResendVerify');
    const cdTimer = setInterval(() => {
      cd--;
      if (cdEl) cdEl.textContent = cd;
      if (cd <= 0) {
        clearInterval(cdTimer);
        if (resendBtn) {
          resendBtn.disabled = false;
          resendBtn.style.cssText = `
            width:100%;padding:12px;border-radius:10px;border:none;
            background:#f59e0b;color:#fff;font-size:13px;font-weight:700;cursor:pointer;margin-bottom:8px
          `;
          resendBtn.textContent = '📧 Doğrulama Mailini Yeniden Gönder';
        }
        const cdDiv = document.getElementById('verifyCooldown');
        if (cdDiv) cdDiv.style.display = 'none';
      }
    }, 1000);

    // Yeniden gönder
    if (resendBtn) {
      resendBtn.onclick = async () => {
        resendBtn.disabled = true;
        resendBtn.textContent = 'Gönderiliyor...';
        await user.reload();
        const result = await sendVerificationEmail(user);
        if (result.ok) {
          if (typeof window.toast === 'function') window.toast('📧 Mail yeniden gönderildi!', 'success');
          resendBtn.textContent = '✅ Gönderildi';
          // 60sn tekrar bekle
          setTimeout(() => {
            resendBtn.textContent = '📧 Yeniden Gönder';
            resendBtn.disabled = false;
          }, 60000);
        } else {
          if (typeof window.toast === 'function') window.toast('⚠️ ' + result.error, 'warn');
          resendBtn.disabled = false;
          resendBtn.textContent = '📧 Doğrulama Mailini Yeniden Gönder';
        }
      };
    }

    // Doğrulandı mı kontrol et
    const checkBtn = document.getElementById('btnCheckVerify');
    if (checkBtn) {
      checkBtn.onclick = async () => {
        checkBtn.textContent = 'Kontrol ediliyor...';
        checkBtn.disabled = true;
        try {
          await user.reload();
          if (user.emailVerified) {
            // Firebase DB güncelle
            await firebase.database().ref('users/' + user.uid + '/verified').set(true);
            if (typeof window.toast === 'function') window.toast('✅ E-posta doğrulandı! Oyuna girildi.', 'success', 5000);
            // Oyuna giriş — onAuthStateChanged tetiklenecek
            if (typeof window.enterGame === 'function') {
              await window.enterGame(user);
            } else {
              window.location.reload();
            }
          } else {
            if (typeof window.toast === 'function') window.toast('⏳ Henüz doğrulanmamış. E-postanı kontrol et!', 'warn', 4000);
            checkBtn.textContent = '🔄 Doğruladım — Kontrol Et';
            checkBtn.disabled = false;
          }
        } catch(e) {
          checkBtn.textContent = '🔄 Doğruladım — Kontrol Et';
          checkBtn.disabled = false;
        }
      };
    }

    // Yardım toggle
    const helpBtn = document.getElementById('btnVerifyHelp');
    const tipsDiv = document.getElementById('verifyTips');
    if (helpBtn && tipsDiv) {
      helpBtn.onclick = () => {
        const shown = tipsDiv.style.display !== 'none';
        tipsDiv.style.display = shown ? 'none' : 'block';
        helpBtn.textContent = shown ? '❓ Mail gelmiyor mu? Yardım al' : '❌ Kapat';
      };
    }
  }

  /**
   * URL'de ?verified=1 parametresi varsa — link tıklandı
   * Firebase action URL'den döndükten sonra
   */
  async function handleVerificationReturn() {
    const params = new URLSearchParams(window.location.search);
    if (!params.has('verified')) return;

    // URL'yi temizle
    window.history.replaceState({}, '', window.location.pathname);

    // Kullanıcıyı yenile
    const user = firebase.auth().currentUser;
    if (!user) return;

    try {
      await user.reload();
      if (user.emailVerified) {
        await firebase.database().ref('users/' + user.uid + '/verified').set(true);
        if (typeof window.toast === 'function') {
          window.toast('✅ E-posta doğrulandı! Hoş geldin.', 'success', 5000);
        }
      }
    } catch(e) {}
  }

  /**
   * Oyun içi — e-posta doğrulanmamış kullanıcıya uyarı banner göster
   */
  function showUnverifiedBanner(user) {
    if (!user || user.emailVerified) return;
    if (user.email && user.email.endsWith('@anon.gamezone.local')) return; // anonim

    // Zaten var mı
    if (document.getElementById('unverifiedBanner')) return;

    const banner = document.createElement('div');
    banner.id = 'unverifiedBanner';
    banner.style.cssText = `
      position:fixed;bottom:70px;left:50%;transform:translateX(-50%);
      background:#f59e0b;color:#000;
      padding:10px 16px;border-radius:12px;
      font-size:13px;font-weight:700;
      z-index:9998;display:flex;align-items:center;gap:10px;
      box-shadow:0 4px 20px rgba(0,0,0,0.3);
      max-width:calc(100vw - 32px);
    `;
    banner.innerHTML = `
      <span>⚠️ E-posta doğrulanmamış!</span>
      <button id="btnBannerVerify" style="
        background:#000;color:#fbbf24;border:none;padding:6px 12px;
        border-radius:8px;cursor:pointer;font-size:12px;font-weight:700
      ">Doğrula</button>
      <button onclick="document.getElementById('unverifiedBanner').remove()" style="
        background:transparent;border:none;color:#000;cursor:pointer;font-size:18px;padding:0
      ">✕</button>
    `;
    document.body.appendChild(banner);

    document.getElementById('btnBannerVerify').onclick = async () => {
      banner.innerHTML = '<span>📧 Mail gönderiliyor...</span>';
      const result = await sendVerificationEmail(user);
      if (result.ok) {
        banner.innerHTML = '<span>✅ Doğrulama maili gönderildi! E-postanı kontrol et.</span>';
        setTimeout(() => banner.remove(), 5000);
      } else {
        banner.innerHTML = `<span>⚠️ ${result.error}</span><button onclick="this.parentElement.remove()" style="background:transparent;border:none;color:#000;cursor:pointer;font-size:18px">✕</button>`;
      }
    };
  }

  /* ════════════════════════════════════════════════════════════════════
     2. CANLI DESTEK WİDGET
     ════════════════════════════════════════════════════════════════════ */

  const SUPPORT_CONFIG = {
    ownerNotifUID: null,   // Admin UID — Firebase'den çekilir
    maxMsgLen: 500,
    autoReply: {
      delay: 1500,
      messages: [
        '👋 Merhaba! Sana yardımcı olmaya çalışacağız. Mesajın alındı!',
        '📝 Mesajın kaydedildi. Ekibimiz en kısa sürede yanıt verecek.',
        '⚡ Destek talebin oluşturuldu. Genellikle birkaç dakika içinde yanıt veriyoruz.'
      ]
    }
  };

  let supportOpen = false;
  let supportSessionId = null;

  /**
   * Canlı destek widgetını oluştur (auth ekranı + oyun içi)
   */
  function createSupportWidget() {
    if (document.getElementById('supportWidget')) return;

    const widget = document.createElement('div');
    widget.id = 'supportWidget';
    widget.innerHTML = `
      <!-- Destek Butonu -->
      <button id="supportToggleBtn" onclick="toggleLiveSupport()" style="
        position:fixed;bottom:20px;right:20px;z-index:9990;
        width:56px;height:56px;border-radius:50%;
        background:linear-gradient(135deg,#10b981,#059669);
        border:none;cursor:pointer;
        box-shadow:0 4px 20px rgba(16,185,129,0.5);
        display:flex;align-items:center;justify-content:center;
        font-size:24px;transition:.3s;
      " title="Canlı Destek">
        💬
        <span id="supportUnreadBadge" style="
          display:none;position:absolute;top:-4px;right:-4px;
          background:#dc2626;color:#fff;border-radius:50%;
          width:20px;height:20px;font-size:11px;font-weight:700;
          align-items:center;justify-content:center;
        ">0</span>
      </button>

      <!-- Chat Penceresi -->
      <div id="supportChatWindow" style="
        display:none;
        position:fixed;bottom:90px;right:20px;z-index:9991;
        width:320px;max-width:calc(100vw - 40px);
        background:#1e2d4a;border:1px solid #1e3a8a;
        border-radius:16px;overflow:hidden;
        box-shadow:0 8px 40px rgba(0,0,0,0.5);
        flex-direction:column;height:440px;
      ">
        <!-- Header -->
        <div style="
          background:linear-gradient(135deg,#10b981,#059669);
          padding:14px 16px;display:flex;align-items:center;gap:10px;flex-shrink:0
        ">
          <div style="
            width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,0.2);
            display:flex;align-items:center;justify-content:center;font-size:18px;
          ">🎮</div>
          <div style="flex:1">
            <div style="color:#fff;font-weight:700;font-size:14px">GameZone Destek</div>
            <div style="color:rgba(255,255,255,0.8);font-size:11px">
              <span style="width:8px;height:8px;border-radius:50%;background:#86efac;display:inline-block;margin-right:4px"></span>
              Genellikle dakikalar içinde yanıt verir
            </div>
          </div>
          <button onclick="toggleLiveSupport()" style="
            background:rgba(255,255,255,0.2);border:none;color:#fff;
            width:28px;height:28px;border-radius:50%;cursor:pointer;font-size:16px;
            display:flex;align-items:center;justify-content:center;
          ">✕</button>
        </div>

        <!-- Mesaj alanı -->
        <div id="supportMsgArea" style="
          flex:1;overflow-y:auto;padding:12px;
          display:flex;flex-direction:column;gap:8px;
        ">
          <!-- Karşılama mesajı -->
          <div style="
            background:rgba(255,255,255,0.05);border-radius:12px 12px 12px 0;
            padding:10px 12px;max-width:85%;
          ">
            <div style="color:#e5e7eb;font-size:13px">
              👋 Merhaba! GameZone desteğine hoş geldin.<br><br>
              Sorularını buradan yazabilirsin. Ne konuda yardım istiyorsun?
            </div>
            <div style="color:#64748b;font-size:10px;margin-top:4px">GameZone • Şimdi</div>
          </div>

          <!-- Hızlı sorular -->
          <div style="display:flex;flex-direction:column;gap:6px;margin-top:4px">
            <div style="color:#64748b;font-size:11px;padding-left:2px">Hızlı sorular:</div>
            ${[
              'E-postam doğrulanmıyor',
              'Hesabıma giremiyorum',
              'Para/elmas kaybettim',
              'Hesabım banlandı',
              'Teknik sorun yaşıyorum'
            ].map(q => `
              <button onclick="supportQuickMsg('${q}')" style="
                background:rgba(59,130,246,0.1);border:1px solid rgba(59,130,246,0.3);
                color:#93c5fd;padding:7px 12px;border-radius:20px;
                cursor:pointer;font-size:12px;text-align:left;transition:.2s;
              ">${q}</button>
            `).join('')}
          </div>
        </div>

        <!-- Input alanı -->
        <div style="
          padding:10px;border-top:1px solid #1e3a8a;flex-shrink:0;
          display:flex;gap:8px;align-items:flex-end;
        ">
          <textarea id="supportInput" placeholder="Mesajını yaz..." rows="2" style="
            flex:1;background:#0f172a;border:1px solid #2d3748;color:#e5e7eb;
            border-radius:10px;padding:8px 12px;font-size:13px;resize:none;
            font-family:inherit;line-height:1.4;max-height:80px;
          " oninput="this.style.height='auto';this.style.height=Math.min(this.scrollHeight,80)+'px'"
          onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();sendSupportMsg()}"
          ></textarea>
          <button onclick="sendSupportMsg()" style="
            background:linear-gradient(135deg,#10b981,#059669);border:none;
            color:#fff;width:40px;height:40px;border-radius:50%;cursor:pointer;
            display:flex;align-items:center;justify-content:center;font-size:18px;
            flex-shrink:0;
          ">➤</button>
        </div>
      </div>
    `;

    document.body.appendChild(widget);

    // CSS
    const style = document.createElement('style');
    style.textContent = `
      #supportToggleBtn:hover { transform: scale(1.1); box-shadow: 0 6px 24px rgba(16,185,129,0.7) !important; }
      #supportChatWindow { display: none; }
      #supportChatWindow.open { display: flex !important; }
      .support-msg-user {
        background: linear-gradient(135deg,#1e3a8a,#1e5cb8);
        border-radius: 12px 12px 0 12px;
        padding: 10px 12px; max-width: 85%; align-self: flex-end;
        color: #e5e7eb; font-size: 13px;
      }
      .support-msg-admin {
        background: rgba(255,255,255,0.05);
        border-radius: 12px 12px 12px 0;
        padding: 10px 12px; max-width: 85%;
        color: #e5e7eb; font-size: 13px;
      }
      .support-msg-time { color: #64748b; font-size: 10px; margin-top: 3px; }
      @keyframes supportPulse { 0%,100%{box-shadow:0 4px 20px rgba(16,185,129,0.5)} 50%{box-shadow:0 4px 30px rgba(16,185,129,0.9)} }
    `;
    document.head.appendChild(style);
  }

  window.toggleLiveSupport = function () {
    const win = document.getElementById('supportChatWindow');
    if (!win) return;
    supportOpen = !supportOpen;
    win.classList.toggle('open', supportOpen);
    const btn = document.getElementById('supportToggleBtn');
    if (btn) btn.innerHTML = supportOpen ? '✕' : '💬';

    if (supportOpen) {
      // Session ID oluştur
      if (!supportSessionId) supportSessionId = 'sup_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
      // Okunmadı sayacını sıfırla
      const badge = document.getElementById('supportUnreadBadge');
      if (badge) badge.style.display = 'none';
      // Input'a odaklan
      setTimeout(() => document.getElementById('supportInput')?.focus(), 100);
      // Firebase'den mesajları yükle
      loadSupportHistory();
    }
  };

  window.openLiveSupport = function () {
    if (!supportOpen) window.toggleLiveSupport();
  };

  window.supportQuickMsg = function (text) {
    const inp = document.getElementById('supportInput');
    if (inp) { inp.value = text; inp.focus(); }
    sendSupportMsg();
  };

  window.sendSupportMsg = async function () {
    const inp = document.getElementById('supportInput');
    const text = (inp?.value || '').trim();
    if (!text) return;
    if (text.length > SUPPORT_CONFIG.maxMsgLen) {
      if (typeof window.toast === 'function') window.toast(`Mesaj en fazla ${SUPPORT_CONFIG.maxMsgLen} karakter`, 'warn');
      return;
    }

    inp.value = '';
    inp.style.height = 'auto';

    // Kullanıcı bilgisi
    const user = firebase.auth().currentUser;
    const uid  = user?.uid || 'guest_' + Date.now();
    const username = (window.GZ?.data?.username) || user?.email?.split('@')[0] || 'Misafir';

    // Mesajı ekrana ekle
    appendSupportMsg(text, 'user', username, new Date());

    // Firebase'e kaydet
    try {
      const msgRef = await firebase.database().ref('support/sessions/' + supportSessionId + '/messages').push({
        text,
        senderUid: uid,
        senderName: username,
        senderEmail: user?.email || null,
        ts: firebase.database.ServerValue.TIMESTAMP,
        read: false,
        type: 'user'
      });

      // Session meta güncelle
      await firebase.database().ref('support/sessions/' + supportSessionId).update({
        uid, username,
        email: user?.email || null,
        lastMsg: text.slice(0, 100),
        lastTs: firebase.database.ServerValue.TIMESTAMP,
        status: 'open',
        unread: true
      });

      // Admin'e bildirim gönder — isFounder=true olan kullanıcıyı bul
      notifyAdminNewMsg(username, text);

    } catch(e) {
      console.warn('[Support] Mesaj kaydedilemedi:', e);
    }

    // Otomatik cevap (1.5 sn sonra)
    setTimeout(() => {
      const replies = SUPPORT_CONFIG.autoReply.messages;
      const reply = replies[Math.floor(Math.random() * replies.length)];
      appendSupportMsg(reply, 'admin', 'GameZone Destek', new Date());
    }, SUPPORT_CONFIG.autoReply.delay);
  };

  function appendSupportMsg(text, type, name, date) {
    const area = document.getElementById('supportMsgArea');
    if (!area) return;

    const div = document.createElement('div');
    div.style.display = 'flex';
    div.style.flexDirection = 'column';
    div.style.alignItems = type === 'user' ? 'flex-end' : 'flex-start';

    const time = date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    div.innerHTML = `
      <div class="support-msg-${type === 'user' ? 'user' : 'admin'}">
        ${type === 'admin' ? '<div style="color:#10b981;font-size:10px;font-weight:700;margin-bottom:3px">🎮 ' + escHtml(name) + '</div>' : ''}
        ${escHtml(text)}
      </div>
      <div class="support-msg-time">${time}</div>
    `;

    area.appendChild(div);
    area.scrollTop = area.scrollHeight;
  }

  async function loadSupportHistory() {
    if (!supportSessionId) return;
    try {
      const snap = await firebase.database().ref('support/sessions/' + supportSessionId + '/messages')
        .limitToLast(20).once('value');
      if (!snap.val()) return;
      // Zaten gösterilmiş mesajları tekrar gösterme (sadece ilk yüklemede)
    } catch(e) {}
  }

  async function notifyAdminNewMsg(username, text) {
    try {
      // isFounder=true olan kullanıcıları bul
      const snap = await firebase.database().ref('users')
        .orderByChild('isFounder').equalTo(true).once('value');
      const founders = snap.val() || {};
      const batch = {};
      Object.keys(founders).forEach(fuid => {
        const key = firebase.database().ref().push().key;
        batch['notifs/' + fuid + '/' + key] = {
          type: 'support_msg',
          icon: '💬',
          msg: `💬 Yeni destek mesajı — ${username}: "${text.slice(0, 80)}${text.length > 80 ? '...' : ''}"`,
          sessionId: supportSessionId,
          ts: firebase.database.ServerValue.TIMESTAMP,
          read: false
        };
      });
      if (Object.keys(batch).length > 0) {
        await firebase.database().ref().update(batch);
      }
    } catch(e) {}
  }

  /* ════════════════════════════════════════════════════════════════════
     3. ADMİN PANELİ — Destek Mesajları Sekmesi
     ════════════════════════════════════════════════════════════════════ */

  /**
   * Admin paneline destek sekmesi enjekte et
   */
  function injectSupportAdminTab() {
    const nav = document.querySelector('.admin-nav');
    if (!nav || document.getElementById('supportNavBtn')) return;

    const btn = document.createElement('button');
    btn.id = 'supportNavBtn';
    btn.className = 'admin-nav-btn';
    btn.innerHTML = '💬 Destek <span id="supportMsgBadge" style="background:#10b981;color:#fff;border-radius:99px;padding:1px 7px;font-size:11px;margin-left:4px;display:none">0</span>';
    btn.onclick = () => {
      document.querySelectorAll('.admin-nav-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      openSupportAdmin();
    };

    nav.appendChild(btn);
    updateSupportBadge();
  }

  async function updateSupportBadge() {
    try {
      const snap = await firebase.database().ref('support/sessions')
        .orderByChild('unread').equalTo(true).once('value');
      const count = snap.numChildren();
      const badge = document.getElementById('supportMsgBadge');
      if (badge) {
        badge.textContent = count;
        badge.style.display = count > 0 ? '' : 'none';
      }
    } catch(e) {}
  }

  async function openSupportAdmin() {
    const panel = document.getElementById('adminPanelBody');
    if (!panel) return;
    panel.innerHTML = '<div class="admin-loading">💬 Destek mesajları yükleniyor...</div>';

    const snap = await firebase.database().ref('support/sessions')
      .orderByChild('lastTs').limitToLast(50).once('value');
    const sessions = snap.val() || {};
    const sessionList = Object.entries(sessions)
      .sort((a, b) => (b[1].lastTs || 0) - (a[1].lastTs || 0));

    panel.innerHTML = `
      <div class="admin-section">
        <h2 class="admin-section-title">💬 Canlı Destek Mesajları</h2>

        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">
          <button onclick="markAllSupportRead()" style="background:#10b98122;border:1px solid #10b98155;color:#10b981;padding:10px 16px;border-radius:8px;cursor:pointer;font-weight:600;font-size:13px">✅ Tümünü Okundu İşaretle</button>
          <button onclick="openSupportAdmin()" style="background:#3b82f622;border:1px solid #3b82f655;color:#3b82f6;padding:10px 16px;border-radius:8px;cursor:pointer;font-weight:600;font-size:13px">🔄 Yenile</button>
        </div>

        ${sessionList.length === 0
          ? '<div style="text-align:center;padding:60px;color:#475569"><div style="font-size:60px">💬</div><div style="font-size:18px;font-weight:700;color:#94a3b8;margin-top:12px">Destek mesajı yok</div></div>'
          : sessionList.map(([sid, s]) => `
            <div onclick="openSupportSession('${sid}')" style="
              background:${s.unread ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.03)'};
              border:1px solid ${s.unread ? 'rgba(16,185,129,0.3)' : '#1e3a8a'};
              border-radius:12px;padding:14px;margin-bottom:10px;cursor:pointer;
              display:flex;align-items:center;gap:12px;
            ">
              <div style="
                width:40px;height:40px;border-radius:50%;
                background:${s.unread ? 'linear-gradient(135deg,#10b981,#059669)' : '#1e2d4a'};
                display:flex;align-items:center;justify-content:center;
                font-size:18px;flex-shrink:0;
              ">💬</div>
              <div style="flex:1;overflow:hidden">
                <div style="display:flex;justify-content:space-between;align-items:center">
                  <div style="font-weight:700;color:#e5e7eb">${escHtml(s.username || 'Misafir')}</div>
                  <div style="color:#64748b;font-size:11px">${s.lastTs ? new Date(s.lastTs).toLocaleString('tr-TR', {day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}) : '?'}</div>
                </div>
                <div style="color:#94a3b8;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:2px">${escHtml(s.lastMsg || '')}</div>
                <div style="color:#64748b;font-size:10px;margin-top:2px">${s.email || 'E-posta yok'}</div>
              </div>
              ${s.unread ? '<div style="width:10px;height:10px;border-radius:50%;background:#10b981;flex-shrink:0"></div>' : ''}
            </div>
          `).join('')
        }
      </div>
    `;

    window.markAllSupportRead = async () => {
      const upd = {};
      sessionList.forEach(([sid]) => { upd['support/sessions/' + sid + '/unread'] = false; });
      await firebase.database().ref().update(upd);
      if (typeof window.toast === 'function') window.toast('✅ Tümü okundu', 'success');
      openSupportAdmin();
      updateSupportBadge();
    };

    window.openSupportSession = async (sid) => {
      const sessSnap = await firebase.database().ref('support/sessions/' + sid).once('value');
      const sess = sessSnap.val() || {};
      const msgsSnap = await firebase.database().ref('support/sessions/' + sid + '/messages').once('value');
      const msgs = msgsSnap.val() ? Object.values(msgsSnap.val()).sort((a,b) => (a.ts||0)-(b.ts||0)) : [];

      // Okundu işaretle
      await firebase.database().ref('support/sessions/' + sid + '/unread').set(false);

      const html = `
        <div style="max-width:560px">
          <!-- Kullanıcı bilgisi -->
          <div style="background:#1e2d4a;border:1px solid #1e3a8a;border-radius:12px;padding:12px;margin-bottom:14px">
            <div style="font-weight:700;color:#e5e7eb">${escHtml(sess.username || 'Misafir')}</div>
            <div style="color:#64748b;font-size:12px">${sess.email || 'E-posta yok'} · UID: ${(sess.uid||'?').slice(0,16)}...</div>
            <div style="color:#64748b;font-size:11px;margin-top:2px">Durum: <span style="color:${sess.status==='closed'?'#dc2626':'#10b981'}">${sess.status==='closed'?'Kapalı':'Açık'}</span></div>
          </div>

          <!-- Mesajlar -->
          <div style="background:#0f172a;border-radius:12px;padding:12px;margin-bottom:12px;max-height:300px;overflow-y:auto;display:flex;flex-direction:column;gap:8px">
            ${msgs.map(m => `
              <div style="display:flex;flex-direction:column;align-items:${m.type==='user'?'flex-end':'flex-start'}">
                <div style="
                  background:${m.type==='user'?'linear-gradient(135deg,#1e3a8a,#1e5cb8)':'rgba(255,255,255,0.05)'};
                  border-radius:${m.type==='user'?'12px 12px 0 12px':'12px 12px 12px 0'};
                  padding:10px 12px;max-width:85%;
                ">
                  ${m.type!=='user'?`<div style="color:#10b981;font-size:10px;font-weight:700;margin-bottom:3px">🎮 ${escHtml(m.senderName||'Sistem')}</div>`:''}
                  <div style="color:#e5e7eb;font-size:13px">${escHtml(m.text||'')}</div>
                </div>
                <div style="color:#64748b;font-size:10px;margin-top:2px">${m.ts ? new Date(m.ts).toLocaleString('tr-TR',{hour:'2-digit',minute:'2-digit'}) : ''}</div>
              </div>
            `).join('') || '<div style="color:#475569;text-align:center">Mesaj yok</div>'}
          </div>

          <!-- Admin cevap kutusu -->
          <div style="display:flex;gap:8px;margin-bottom:10px">
            <textarea id="adminReplyText" placeholder="Cevabını yaz..." rows="3" style="
              flex:1;background:#0f172a;border:1px solid #2d3748;color:#e5e7eb;
              border-radius:10px;padding:10px;font-size:13px;resize:none;font-family:inherit
            "></textarea>
          </div>
          <div style="display:flex;gap:8px">
            <button onclick="sendAdminSupportReply('${sid}','${sess.uid||''}')" style="
              flex:1;padding:12px;background:#10b981;border:none;color:#fff;
              border-radius:10px;cursor:pointer;font-weight:700;font-size:13px
            ">📤 Cevap Gönder</button>
            <button onclick="closeSupportSession('${sid}')" style="
              padding:12px 16px;background:#dc262622;border:1px solid #dc262655;
              color:#dc2626;border-radius:10px;cursor:pointer;font-size:13px
            ">Kapat</button>
          </div>
        </div>
      `;

      if (typeof window.showModal === 'function') {
        window.showModal('💬 Destek Oturumu', html, true);
      }

      window.sendAdminSupportReply = async (sid, targetUid) => {
        const text = document.getElementById('adminReplyText')?.value?.trim();
        if (!text) return;
        const adminUser = firebase.auth().currentUser;
        await firebase.database().ref('support/sessions/' + sid + '/messages').push({
          text,
          senderUid: adminUser?.uid || 'admin',
          senderName: '⚡ Destek Ekibi',
          ts: firebase.database.ServerValue.TIMESTAMP,
          read: false,
          type: 'admin'
        });
        await firebase.database().ref('support/sessions/' + sid).update({
          lastMsg: text.slice(0, 100),
          lastTs: firebase.database.ServerValue.TIMESTAMP
        });
        if (targetUid) {
          await firebase.database().ref('notifs/' + targetUid).push({
            type: 'support_reply',
            icon: '💬',
            msg: '💬 Destek ekibinden cevap: ' + text.slice(0, 100),
            ts: firebase.database.ServerValue.TIMESTAMP,
            read: false
          });
        }
        if (typeof window.toast === 'function') window.toast('✅ Cevap gönderildi', 'success');
        if (typeof window.closeModal === 'function') window.closeModal();
        openSupportAdmin();
      };

      window.closeSupportSession = async (sid) => {
        await firebase.database().ref('support/sessions/' + sid + '/status').set('closed');
        if (typeof window.toast === 'function') window.toast('✅ Oturum kapatıldı', 'success');
        if (typeof window.closeModal === 'function') window.closeModal();
        openSupportAdmin();
      };
    };
  }

  /* ════════════════════════════════════════════════════════════════════
     4. GİRİŞ.JS HOOK — Kayıt sonrası doğrulama mailini yakala
     ════════════════════════════════════════════════════════════════════ */

  /**
   * Firebase auth'u izle — kayıt sonrası e-posta doğrulama düzeltmesi
   */
  function hookAuthForVerification() {
    firebase.auth().onAuthStateChanged(async (user) => {
      if (!user) return;

      // Yeni kayıt oldu ve e-posta doğrulanmamış
      if (!user.emailVerified && user.email && !user.email.endsWith('@anon.gamezone.local')) {
        const dbVerified = await firebase.database().ref('users/' + user.uid + '/verified').once('value').then(s => s.val());
        if (!dbVerified) {
          // Oyun içinde uyarı banner göster (3 sn gecikmeli)
          setTimeout(() => showUnverifiedBanner(user), 3000);
        }
      }

      // URL'de ?verified=1 varsa işle
      handleVerificationReturn();
    });
  }

  /* ════════════════════════════════════════════════════════════════════
     YARDIMCI
     ════════════════════════════════════════════════════════════════════ */
  function escHtml(s) {
    return String(s || '').replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
    );
  }

  /* ════════════════════════════════════════════════════════════════════
     INIT
     ════════════════════════════════════════════════════════════════════ */
  function init() {
    // 1. Destek widget oluştur
    createSupportWidget();

    // 2. giris.js'in btnRegister butonunu yakala (post-register hook)
    const origBtn = document.getElementById('btnRegister');
    if (origBtn) {
      origBtn.addEventListener('click', async () => {
        // giris.js'in handleri çalışır, biz sadece sonucu izliyoruz
        await new Promise(r => setTimeout(r, 2000));
        const user = firebase.auth().currentUser;
        if (user && !user.emailVerified && user.email && !user.email.endsWith('@anon.gamezone.local')) {
          enrichVerifyScreen(user, user.email);
        }
      }, true); // capture = true (giris.js'den önce çalışmaz, sonra çalışır)
    }

    // 3. Auth hook
    if (typeof firebase !== 'undefined' && firebase.auth) {
      hookAuthForVerification();
    } else {
      document.addEventListener('firebaseReady', hookAuthForVerification);
    }

    // 4. Admin paneli hazır olunca destek sekmesi ekle
    const adminObserver = new MutationObserver(() => {
      if (document.querySelector('.admin-nav')) {
        injectSupportAdminTab();
      }
    });
    adminObserver.observe(document.body, { childList: true, subtree: true });

    // 5. Firebase realtime — yeni destek mesajı gelince badge güncelle
    try {
      firebase.database().ref('support/sessions')
        .orderByChild('unread').equalTo(true)
        .on('value', (snap) => {
          const count = snap.numChildren();
          const badge = document.getElementById('supportMsgBadge');
          if (badge) { badge.textContent = count; badge.style.display = count > 0 ? '' : 'none'; }
          // Destek toggle butonundaki unread
          const unread = document.getElementById('supportUnreadBadge');
          if (unread && !supportOpen) {
            unread.textContent = count;
            unread.style.display = count > 0 ? 'flex' : 'none';
          }
        });
    } catch(e) {}

    console.log('%c[GirisEklenti] ✅ E-posta doğrulama + Canlı Destek yüklendi', 'color:#10b981;font-weight:700');
  }

  // DOM + Firebase hazır olunca başlat
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(init, 500));
  } else {
    setTimeout(init, 500);
  }

  // Public API
  window.GirisEklenti = {
    sendVerificationEmail,
    openLiveSupport: window.toggleLiveSupport,
    handleVerificationReturn,
    enrichVerifyScreen
  };

})();


/* ─── ekonomi.js ─── */
/* ==========================================================================
   ekonomi.js — Ekonomi Çekirdeği
   - Dükkanlar (Reyon sistemi: ürün YOKKEN satış YOK)
   - Bahçe / Çiftlik / Fabrika / Maden (üretim hatları)
   - Lojistik (depo)
   - İhracat (gerçek talep listesi, oyuncu üretiminden satış)
   - İhale (gerçek zamanlı geri sayım, en yüksek teklif kazanır)
   - Kripto (rastgele dalgalanma, gerçek alım-satım)
   - Marka (oyuncu kurar, üyeler katılır)
   - Banka (vadeli, kredi, işletme gideri, maaş)
   - Pazar (kendi reyonlarından il halkına otomatik satış)
   - Mağaza (elmas paketleri, robot)
   ========================================================================== */

/* ============== ÜRÜN VERİTABANI ============== */
const URUNLER = {
  // Temel Gıda
  bugday_unu:      { name:"Buğday Unu",     emo:"🌾", base:4.50, cat:"temel", unit:"Kilo", lv:1 },
  ayicicek_yagi:   { name:"Ayçiçek Yağı",   emo:"🌻", base:8.50, cat:"temel", unit:"Litre", lv:1 },
  zeytinyagi:      { name:"Zeytinyağı",     emo:"🫒", base:12.0, cat:"temel", unit:"Litre", lv:2 },
  misir_unu:       { name:"Mısır Unu",      emo:"🌽", base:5.20, cat:"temel", unit:"Kilo", lv:1 },
  siyah_cay:       { name:"Siyah Çay",      emo:"🍵", base:14.0, cat:"temel", unit:"Kilo", lv:2 },
  yesil_cay:       { name:"Yeşil Çay",      emo:"🍃", base:18.0, cat:"temel", unit:"Kilo", lv:3 },
  seker:           { name:"Şeker",          emo:"🍬", base:6.80, cat:"temel", unit:"Kilo", lv:1 },
  findik_yagi:     { name:"Fındık Yağı",    emo:"🥜", base:22.0, cat:"temel", unit:"Litre", lv:4 },

  // Kahvaltılık & Süt
  tavuk_yumurtasi: { name:"Tavuk Yumurtası",emo:"🥚", base:1.20, cat:"kahvalti", unit:"Adet", lv:1 },
  hindi_yumurtasi: { name:"Hindi Yumurtası",emo:"🥚", base:2.40, cat:"kahvalti", unit:"Adet", lv:5 },
  kaz_yumurtasi:   { name:"Kaz Yumurtası",  emo:"🥚", base:3.80, cat:"kahvalti", unit:"Adet", lv:6 },
  inek_sutu:       { name:"İnek Sütü",      emo:"🥛", base:5.50, cat:"kahvalti", unit:"Litre", lv:1 },
  keci_sutu:       { name:"Keçi Sütü",      emo:"🥛", base:9.20, cat:"kahvalti", unit:"Litre", lv:3 },
  beyaz_peynir:    { name:"Beyaz Peynir",   emo:"🧀", base:32.0, cat:"kahvalti", unit:"Kilo", lv:2 },
  kasar_peyniri:   { name:"Kaşar Peyniri",  emo:"🧀", base:48.0, cat:"kahvalti", unit:"Kilo", lv:3 },
  zeytin:          { name:"Zeytin",         emo:"🫒", base:18.5, cat:"kahvalti", unit:"Kilo", lv:2 },
  petek_bal:       { name:"Petek Bal",      emo:"🍯", base:85.0, cat:"kahvalti", unit:"Kilo", lv:5 },
  suzme_bal:       { name:"Süzme Bal",      emo:"🍯", base:65.0, cat:"kahvalti", unit:"Kilo", lv:4 },
  polen:           { name:"Polen",          emo:"🌼", base:32.0, cat:"kahvalti", unit:"Kilo", lv:5 },

  // Meyve & Sebze
  domates:         { name:"Domates",        emo:"🍅", base:8.50, cat:"meyve", unit:"Kilo", lv:1 },
  patates:         { name:"Patates",        emo:"🥔", base:6.00, cat:"meyve", unit:"Kilo", lv:1 },
  sogan:           { name:"Soğan",          emo:"🧅", base:5.50, cat:"meyve", unit:"Kilo", lv:1 },
  elma:            { name:"Elma",           emo:"🍎", base:9.00, cat:"meyve", unit:"Kilo", lv:1 },
  uzum:            { name:"Üzüm",           emo:"🍇", base:14.0, cat:"meyve", unit:"Kilo", lv:2 },
  kiraz:           { name:"Kiraz",          emo:"🍒", base:24.0, cat:"meyve", unit:"Kilo", lv:3 },
  kayisi:          { name:"Kayısı",         emo:"🍑", base:16.0, cat:"meyve", unit:"Kilo", lv:2 },
  findik:          { name:"Fındık",         emo:"🥜", base:55.0, cat:"meyve", unit:"Kilo", lv:4 },

  // Et Ürünleri
  tavuk_eti:       { name:"Tavuk Eti",      emo:"🍗", base:48.0, cat:"et", unit:"Kilo", lv:3 },
  dana_eti:        { name:"Dana Eti",       emo:"🥩", base:185.0,cat:"et", unit:"Kilo", lv:5 },
  kuzu_eti:        { name:"Kuzu Eti",       emo:"🥩", base:220.0,cat:"et", unit:"Kilo", lv:6 },

  // Madenler
  altin:           { name:"Altın",          emo:"🥇", base:2400.0,cat:"maden", unit:"Gram", lv:30 },
  gumus:           { name:"Gümüş",          emo:"🥈", base:32.0, cat:"maden", unit:"Gram", lv:30 },
  bakir:           { name:"Bakır",          emo:"🟫", base:2.20, cat:"maden", unit:"Kilo", lv:30 },
  demir:           { name:"Demir",          emo:"⚙️", base:1.80, cat:"maden", unit:"Kilo", lv:30 },
  kromit:          { name:"Krom",           emo:"⛏️", base:4.50, cat:"maden", unit:"Kilo", lv:30 },

  // Fabrika ürünleri
  ekmek:           { name:"Ekmek",          emo:"🍞", base:5.00, cat:"firin", unit:"Adet", lv:2 },
  pasta:           { name:"Pasta",          emo:"🎂", base:120.0,cat:"firin", unit:"Adet", lv:4 },
  dondurma:        { name:"Dondurma",       emo:"🍦", base:18.0, cat:"firin", unit:"Adet", lv:3 },
  kimyasal_cozucu: { name:"Kimyasal Çözücü",emo:"⚗️", base:15.0, cat:"sanayi",unit:"Litre", lv:10 },
  cimento:         { name:"Çimento",        emo:"🧱", base:3.50, cat:"sanayi",unit:"Kilo", lv:8 },
  yun:             { name:"Yün",            emo:"🧶", base:28.0, cat:"sanayi",unit:"Kilo", lv:5 },
  keten_kumas:     { name:"Keten Kumaş",    emo:"🧵", base:65.0, cat:"sanayi",unit:"m²", lv:6 },
  eldiven:         { name:"Çift Eldiven",   emo:"🧤", base:42.0, cat:"sanayi",unit:"Çift", lv:5 },
};
window.URUNLER = URUNLER;

const URUN_KATEGORI = {
  temel: "Temel Gıda",
  kahvalti: "Kahvaltılık ve Süt",
  meyve: "Meyve ve Sebze",
  et: "Et Ürünleri",
  firin: "Fırın",
  sanayi: "Sanayi",
  maden: "Madenler"
};

/* ============== KRİPTO LİSTESİ ============== */
const KRIPTO = [
  { sym:"VGN", name:"Vortigon",   color:"#0ea5e9", base:54000, supply:350000000, vol:0.04 },
  { sym:"NNX", name:"Neonix",     color:"#eab308", base:430000, supply:120000000, vol:0.05 },
  { sym:"STC", name:"Solstice",   color:"#fb923c", base:75,    supply:9000000000, vol:0.06 },
  { sym:"HYN", name:"Hyperion",   color:"#7c3aed", base:0.0055,supply:8e11, vol:0.08 },
  { sym:"CLM", name:"Celestium",  color:"#22c55e", base:61000, supply:80000000, vol:0.04 },
  { sym:"AST", name:"Astrium",    color:"#ef4444", base:617,   supply:1500000000, vol:0.05 },
  { sym:"GLX", name:"Galactix",   color:"#dc2626", base:18.9,  supply:9e9, vol:0.05 },
  { sym:"ZTH", name:"Zenithium",  color:"#6366f1", base:28.3,  supply:3e9, vol:0.04 },
  { sym:"XEN", name:"Xenon",      color:"#f97316", base:68500000, supply:21000, vol:0.03 },
  { sym:"ORN", name:"Orionium",   color:"#3b82f6", base:3350000, supply:500000, vol:0.04 },
  { sym:"ZPH", name:"Zephyria",   color:"#06b6d4", base:14000, supply:1e8, vol:0.05 },
  { sym:"MTX", name:"Meteorix",   color:"#f43f5e", base:1.47,  supply:5e10, vol:0.07 },
  { sym:"LMX", name:"Luminex",    color:"#e11d48", base:94000, supply:8e7, vol:0.04 },
  { sym:"ECP", name:"Eclipsium",  color:"#1e40af", base:3.64,  supply:2e10, vol:0.06 },
  { sym:"ASL", name:"Astrolis",   color:"#10b981", base:0.137, supply:5e11, vol:0.07 },
  { sym:"CMX", name:"Cometrix",   color:"#ec4899", base:1.05,  supply:4e10, vol:0.07 },
  { sym:"QSR", name:"Quasarium",  color:"#a855f7", base:202,   supply:6e8, vol:0.05 },
  { sym:"SLR", name:"Solara",     color:"#f59e0b", base:467000,supply:1e7, vol:0.04 },
  { sym:"PAR", name:"Partion",    color:"#8b5cf6", base:351000,supply:1.2e7, vol:0.04 },
  { sym:"NBL", name:"Nebulon",    color:"#14b8a6", base:1677,  supply:8e8, vol:0.06 },
  { sym:"QNT", name:"Quantix",    color:"#0891b2", base:42.5,  supply:2e9, vol:0.05 },
  { sym:"VRX", name:"Vortexa",    color:"#7e22ce", base:8800,  supply:5e7, vol:0.05 },
  { sym:"OMG", name:"Omegium",    color:"#be123c", base:0.42,  supply:1e11, vol:0.08 },
  { sym:"PLX", name:"Pulsex",     color:"#0d9488", base:165,   supply:9e8, vol:0.05 },
  { sym:"NOV", name:"Novarium",   color:"#1d4ed8", base:1240000, supply:3e6, vol:0.04 },
];
window.KRIPTO = KRIPTO;

/* ============== İHRACAT ŞABLONLARI ============== */
const IHRACAT_SIRKETLER = [
  { name:"Siam Group Co., Ltd.",      country:"Tayland",   flag:"🇹🇭" },
  { name:"Volga Holdings OOO",        country:"Rusya",     flag:"🇷🇺" },
  { name:"Azteca Group SA de CV",     country:"Meksika",   flag:"🇲🇽" },
  { name:"Royal Union Ltd.",          country:"İngiltere", flag:"🇬🇧" },
  { name:"Alpine Partners AG",        country:"İsviçre",   flag:"🇨🇭" },
  { name:"Lumière Groupe SAS",        country:"Fransa",    flag:"🇫🇷" },
  { name:"Kaiser Handels GmbH",       country:"Almanya",   flag:"🇩🇪" },
  { name:"Sakura Trading K.K.",       country:"Japonya",   flag:"🇯🇵" },
  { name:"Nile Commerce Co.",         country:"Mısır",     flag:"🇪🇬" },
  { name:"Pampas SRL",                country:"Arjantin",  flag:"🇦🇷" },
  { name:"Maple Leaf Inc.",           country:"Kanada",    flag:"🇨🇦" },
  { name:"Liberty Trade LLC",         country:"ABD",       flag:"🇺🇸" },
  { name:"Outback Pty Ltd.",          country:"Avustralya",flag:"🇦🇺" },
  { name:"Iberia Comercial SA",       country:"İspanya",   flag:"🇪🇸" },
  { name:"Hellas Emporiki AE",        country:"Yunanistan",flag:"🇬🇷" },
];

/* ============== INIT ============== */
function initEkonomi(){
  // Kripto fiyat döngüsü (sadece bir kullanıcı çalıştırsın diye admin değil ama hep çalışır)
  initCryptoEngine();
  // İhracat talep listesi yenileme
  initExportEngine();
  // İhale döngüsü
  initAuctionEngine();
  // Banka periyodik ödemeler
  initBankEngine();
  // Pazar otomatik satışları
  initMarketSalesEngine();
  // Dinamik etkinlik sistemi (kriz/fırsat mekanizması)
  setTimeout(() => initEventSystem().catch(e => console.warn('[Events]', e)), 5000);
}
window.initEkonomi = initEkonomi;

/* ============================================================
   KRİPTO MOTORU — fiyatları her 30 saniyede bir günceller
   ============================================================ */
async function initCryptoEngine(){
  // İlk kurulum
  const exists = await dbGet('crypto/prices');
  if (!exists){
    const init = {};
    KRIPTO.forEach(k => {
      init[k.sym] = { current: k.base, prev: k.base, ts: now() };
    });
    await dbSet('crypto/prices', init);
  }

  // Fiyatları dinle
  if (GZ.pricesUnsub) GZ.pricesUnsub();
  const ref = db.ref('crypto/prices');
  ref.on('value', s => { GZ.prices = s.val() || {}; if (GZ.currentTab === 'kripto') renderKripto(); });
  GZ.pricesUnsub = () => ref.off();

  // Kripto fiyatı 2-5 dakikada bir güncellenir (canlı his)
  function scheduleCryptoTick(){
    const delay = (2 + Math.random() * 3) * 60 * 1000; // 2-5 dakika
    setTimeout(async () => { await tickCrypto(); scheduleCryptoTick(); }, delay);
  }
  scheduleCryptoTick();
  setTimeout(tickCrypto, 2000); // ilk yükleme hemen
}

async function tickCrypto(){
  // Lock al — son 25 sn'de kim tick yaptıysa o devam etsin
  const lockRef = db.ref('crypto/_tickLock');
  const r = await lockRef.transaction(cur => {
    if (cur && (now() - cur.ts) < 25000) return; // başka biri yaptı
    return { uid: GZ.uid, ts: now() };
  });
  if (!r.committed) return;

  // Fiyatları güncelle
  const updates = {};
  for (const k of KRIPTO){
    const cur = (GZ.prices[k.sym]?.current) || k.base;
    // Adil piyasa: %50/%50 yükseliş/düşüş
    const direction = Math.random() < 0.50 ? -1 : 1;
    const change = direction * (Math.random() * k.vol);
    let next = cur * (1 + change);
    // Tabanın %20'si altına / 8 katı üstüne çıkmasın
    next = Math.max(k.base * 0.20, Math.min(k.base * 8, next));
    updates[`${k.sym}/prev`] = cur;
    updates[`${k.sym}/current`] = next;
    updates[`${k.sym}/ts`] = now();
  }
  await db.ref('crypto/prices').update(updates);
}

/* ============================================================
   İHRACAT MOTORU
   ============================================================ */
async function initExportEngine(){
  // Eğer talepler yoksa veya hepsi eski ise yenile
  const list = await dbGet('exports/list');
  if (!list || Object.keys(list).length < 15 || (now() - (await dbGet('exports/_renewedAt')||0)) > 30*60*1000){
    await renewExports();
  }
  // 30 dk'da bir lock'lı yenile
  setInterval(async () => {
    const r = await db.ref('exports/_renewLock').transaction(cur => {
      if (cur && (now() - cur) < 25*60*1000) return;
      return now();
    });
    if (r.committed) await renewExports();
  }, 60*1000);
}

async function renewExports(){
  const updates = {};
  const items = Object.keys(URUNLER);
  for (let i=0;i<20;i++){
    const sirket = IHRACAT_SIRKETLER[Math.floor(Math.random()*IHRACAT_SIRKETLER.length)];
    const itemKey = items[Math.floor(Math.random()*items.length)];
    const u = URUNLER[itemKey];
    const demand = (Math.floor(Math.random()*8)+1) * 500000;
    const price = +(u.base * (1.5 + Math.random()*1.5)).toFixed(2); // taban x 1.5-3
    const minOrder = Math.max(2000, Math.floor(demand * 0.005));
    const id = 'ex_' + Math.random().toString(36).slice(2,10);
    updates[id] = {
      id, sirket: sirket.name, country: sirket.country, flag: sirket.flag,
      item: itemKey, demand, fulfilled: 0,
      pricePerUnit: price, minOrder,
      createdAt: now()
    };
  }
  await db.ref('exports/list').set(updates);
  await db.ref('exports/_renewedAt').set(now());
}

/* Kullanıcı bir ihracat talebine gönderim yapsın */
async function exportShip(exId, qty){
  const ex = await dbGet(`exports/list/${exId}`);
  if (!ex) return toast('Talep bulunamadı', 'error');
  if (qty < ex.minOrder) return toast(`Min sipariş: ${fmtInt(ex.minOrder)} ${URUNLER[ex.item].unit}`, 'warn');
  const remaining = ex.demand - (ex.fulfilled||0);
  if (qty > remaining) qty = remaining;
  if (qty <= 0) return toast('Talep doldu', 'warn');

  // Kullanıcının bu üründen depoda var mı? (Lojistik depolardan tüketir)
  const total = await getTotalStock(GZ.uid, ex.item);
  if (total < qty) return toast(`Yeterli stok yok. Var: ${fmtInt(total)} ${URUNLER[ex.item].unit}`, 'error');

  // Stok düş
  await consumeStock(GZ.uid, ex.item, qty);
  // Ödeme al
  const earn = +(qty * ex.pricePerUnit).toFixed(2);
  await addCash(GZ.uid, earn, 'export');
  await addXP(GZ.uid, Math.floor(earn / 100));
  // İhracat fulfillment güncelle
  await dbUpdate(`exports/list/${exId}`, { fulfilled: (ex.fulfilled||0) + qty });

  toast(`💰 +${cashFmt(earn)} ihracat geliri`, 'success');
  if (GZ.currentTab === 'ihracat') render('ihracat');
  if (GZ.currentTab === 'lojistik') render('lojistik');
}
window.exportShip = exportShip;

/* ============================================================
   İHALE MOTORU
   ============================================================ */
async function initAuctionEngine(){
  // İhaleler yoksa oluştur
  const list = await dbGet('auctions/list');
  if (!list || Object.keys(list).length < 5){
    await createAuctions();
  }
  // Bitenleri sonlandır + yenile
  setInterval(processAuctions, 5000);
}

async function createAuctions(){
  const updates = {};
  const items = Object.keys(URUNLER);
  for (let i=0;i<6;i++){
    const sirket = IHRACAT_SIRKETLER[Math.floor(Math.random()*IHRACAT_SIRKETLER.length)];
    const itemKey = items[Math.floor(Math.random()*items.length)];
    const u = URUNLER[itemKey];
    const qty = (Math.floor(Math.random()*6)+1) * 100000;
    const minBid = +(u.base * (1.2 + Math.random()*0.8)).toFixed(2);
    const id = 'au_' + Math.random().toString(36).slice(2,10);
    const duration = (Math.floor(Math.random()*5)+1) * 60 * 1000; // 1-5 dk
    updates[id] = {
      id, sirket: sirket.name, country: sirket.country, flag: sirket.flag,
      item: itemKey, qty, minBid, currentBid: minBid,
      currentBidder: null, currentBidderName: null,
      endsAt: now() + duration, createdAt: now(), finalized: false
    };
  }
  await db.ref('auctions/list').update(updates);
}

async function processAuctions(){
  const list = await dbGet('auctions/list') || {};
  const ids = Object.keys(list);
  const expired = ids.filter(id => list[id].endsAt < now() && !list[id].finalized);

  // Lock — sadece bir kullanıcı sonlandırsın
  if (expired.length){
    const r = await db.ref('auctions/_finLock').transaction(cur => {
      if (cur && (now() - cur) < 4000) return;
      return now();
    });
    if (r.committed){
      for (const id of expired){
        const a = list[id];
        await dbUpdate(`auctions/list/${id}`, { finalized: true });
        if (a.currentBidder){
          // Kazanan stok alır, parası daha önce çekildi (teklif ederken)
          await addStock(a.currentBidder, a.item, a.qty, 'mainWarehouse');
          await pushNotif(a.currentBidder, `🏆 İhaleyi kazandın: ${fmtInt(a.qty)} ${URUNLER[a.item].unit} ${URUNLER[a.item].name}`);
        }
        // Bittiğinde yenisini oluşturmak için sil
        await db.ref(`auctions/list/${id}`).remove();
      }
      // Yeni ihaleler ekle
      const remaining = Object.keys(list).filter(id=>!list[id].finalized).length;
      if (remaining < 5) await createAuctions();
    }
  }
  if (GZ.currentTab === 'ihale') renderIhale();
}

/* Teklif ver */
async function placeBid(auId, bidAmount){
  const a = await dbGet(`auctions/list/${auId}`);
  if (!a) return toast('İhale bulunamadı', 'error');
  if (a.finalized) return toast('İhale bitti', 'warn');
  if (a.endsAt < now()) return toast('İhale süresi doldu', 'warn');
  if (bidAmount <= a.currentBid) return toast(`En düşük teklif: ${cashFmt(a.currentBid + 0.01)}`, 'warn');

  const totalCost = bidAmount * a.qty;
  // Önceki teklifi iade et + yeni teklifi al — transactional bir flow yapalım
  const ok = await spendCash(GZ.uid, totalCost, 'auction-bid');
  if (!ok) return toast(`Yetersiz bakiye. Gerekli: ${cashFmt(totalCost)}`, 'error');

  // Önceki teklif sahibine iade
  if (a.currentBidder && a.currentBidder !== GZ.uid){
    await addCash(a.currentBidder, a.currentBid * a.qty, 'auction-refund');
    await pushNotif(a.currentBidder, `İhalede teklifin geçildi, paran iade edildi.`);
  } else if (a.currentBidder === GZ.uid){
    // Aynı kullanıcı yeniden teklif verdi: önceki tutarı iade et
    await addCash(GZ.uid, a.currentBid * a.qty, 'auction-self-refund');
  }

  await dbUpdate(`auctions/list/${auId}`, {
    currentBid: bidAmount,
    currentBidder: GZ.uid,
    currentBidderName: GZ.data?.username,
    endsAt: Math.max(a.endsAt, now() + 30000) // son 30 sn'de teklif gelirse uzat
  });
  toast('Teklif kaydedildi', 'success');
}
window.placeBid = placeBid;

/* ============================================================
   BANKA MOTORU
   ============================================================ */
async function initBankEngine(){
  // Her dakika kullanıcının bankasını kontrol et: yatırım faizi & ödeme tarihleri
  setInterval(processBankUser, 60000);
  setTimeout(processBankUser, 5000);
}

async function processBankUser(){
  if (!GZ.uid || !GZ.data) return;
  const bank = await dbGet(`bank/${GZ.uid}`);
  if (!bank) return;

  const t = now();

  // Yatırım hesabına faiz: günlük %0.3 (yıllık ~%109 ama oyun)
  if (bank.investment > 0){
    const elapsedMs = t - (bank.investmentDate || t);
    if (elapsedMs > 60000){
      const days = elapsedMs / (24*3600*1000);
      const interest = bank.investment * 0.003 * days; // birikmiş
      // SADECE her tam dakika için yaz
      await dbUpdate(`bank/${GZ.uid}`, {
        investment: +(bank.investment + interest).toFixed(2),
        investmentDate: t
      });
    }
  }

  // İşletme gideri (haftalık) — sadece dolduğunda bir kez
  if (t > (bank.nextBusinessExpense||t+1)){
    const businesses = await countBusinesses(GZ.uid);
    const expense = businesses * 200; // her işletme 200₺/hafta
    if (expense > 0){
      const ok = await spendCash(GZ.uid, expense, 'business-exp');
      if (ok){
        await pushNotif(GZ.uid, `🏢 İşletme gideri ödendi: ${cashFmt(expense)}`);
      } else {
        // Para yoksa — borç olarak ekle
        await dbUpdate(`bank/${GZ.uid}`, { loan: (bank.loan||0) + expense });
        await pushNotif(GZ.uid, `⚠️ İşletme gideri ödenemedi, ${cashFmt(expense)} kredi olarak eklendi.`);
      }
    }
    await dbUpdate(`bank/${GZ.uid}`, { nextBusinessExpense: t + 7*24*3600*1000 });
  }

  // Çalışan maaşları (haftalık)
  if (t > (bank.nextSalary||t+1)){
    const employees = await countEmployees(GZ.uid);
    const salary = employees * 350;
    if (salary > 0){
      const ok = await spendCash(GZ.uid, salary, 'salary');
      if (ok) await pushNotif(GZ.uid, `👥 Çalışan maaşları ödendi: ${cashFmt(salary)}`);
      else {
        await dbUpdate(`bank/${GZ.uid}`, { loan: (bank.loan||0) + salary });
        await pushNotif(GZ.uid, `⚠️ Maaşlar ödenemedi, ${cashFmt(salary)} krediye eklendi.`);
      }
    }
    await dbUpdate(`bank/${GZ.uid}`, { nextSalary: t + 7*24*3600*1000 });
  }
}

async function bankDeposit(amount){
  if (!amount || amount <= 0 || !isFinite(amount)) return toast('Geçersiz tutar','error');
  amount = Math.floor(amount * 100) / 100;
  const ok = await spendCash(GZ.uid, amount, 'bank-deposit');
  if (!ok) return toast('Yetersiz bakiye', 'error');
  await db.ref(`bank/${GZ.uid}/balance`).transaction(c => (c||0)+amount);
  toast(`✅ +${cashFmt(amount)} hesaba yatırıldı`, 'success');
  return true;
}
window.bankDeposit = bankDeposit;

async function bankWithdraw(amount){
  if (!amount || amount <= 0 || !isFinite(amount)) return toast('Geçersiz tutar','error');
  amount = Math.floor(amount * 100) / 100;
  const r = await db.ref(`bank/${GZ.uid}/balance`).transaction(c => {
    if ((c||0) < amount) return;
    return c - amount;
  });
  if (!r.committed) return toast('Yetersiz hesap bakiyesi','error');
  await addCash(GZ.uid, amount, 'bank-withdraw');
  toast(`✅ +${cashFmt(amount)} hesaptan çekildi`, 'success');
  return true;
}
window.bankWithdraw = bankWithdraw;

async function bankInvest(amount){
  if (!amount || amount <= 0 || !isFinite(amount)) return toast('Geçersiz tutar','error');
  amount = Math.floor(amount * 100) / 100;
  const ok = await spendCash(GZ.uid, amount, 'invest');
  if (!ok) return toast('Yetersiz bakiye', 'error');
  await db.ref(`bank/${GZ.uid}`).transaction(b => {
    b = b || { investment:0, investmentDate: now() };
    b.investment = (b.investment||0) + amount;
    b.investmentDate = now();
    return b;
  });
  toast(`✅ +${cashFmt(amount)} yatırım yapıldı (%0.3 günlük faiz)`, 'success');
  return true;
}
window.bankInvest = bankInvest;

async function bankInvestWithdraw(amount){
  if (!amount || amount <= 0 || !isFinite(amount)) return toast('Geçersiz tutar','error');
  amount = Math.floor(amount * 100) / 100;
  const r = await db.ref(`bank/${GZ.uid}/investment`).transaction(c => {
    if ((c||0) < amount) return;
    return +(c - amount).toFixed(2);
  });
  if (!r.committed) return toast('Yetersiz yatırım', 'error');
  await addCash(GZ.uid, amount, 'invest-withdraw');
  toast(`✅ +${cashFmt(amount)} yatırım çekildi`, 'success');
  return true;
}
window.bankInvestWithdraw = bankInvestWithdraw;

async function bankBorrow(amount){
  if (!amount || amount <= 0 || !isFinite(amount)) return toast('Geçersiz tutar','error');
  amount = Math.floor(amount);
  const lv = (GZ.data?.level||1);
  const max = lv * 5000;
  const cur = (await dbGet(`bank/${GZ.uid}/loan`))||0;
  if (cur + amount > max) return toast(`Kredi limitiniz: ${cashFmt(max)} (Mevcut: ${cashFmt(cur)})`, 'warn');
  await db.ref(`bank/${GZ.uid}/loan`).transaction(c => (c||0)+amount);
  await addCash(GZ.uid, amount, 'borrow');
  if (typeof logTx === 'function') logTx('bank-borrow', amount, { bank: 'default' });
  toast(`+${cashFmt(amount)} kredi cekıldi`, 'success');
  return true;
}
window.bankBorrow = bankBorrow;

async function bankRepay(amount){
  if (!amount || amount <= 0 || !isFinite(amount)) return toast('Geçersiz tutar','error');
  amount = Math.floor(amount);

  // Kredi var mı?
  const cur = (await dbGet(`bank/${GZ.uid}/loan`)) || 0;
  if (cur <= 0) return toast('Krediniz yok!', 'warn');

  // Fazla ödemeyi engelle
  if (amount > cur) {
    amount = cur;
    toast(`Kredi tutarı ₺${cur} - sadece bu kadarı ödendi`, 'info', 4000);
  }

  // Bakiye kontrolü
  const myMoney = GZ.data?.money || 0;
  if (amount > myMoney) {
    return toast(`Yetersiz bakiye! Mevcut: ${cashFmt(myMoney)}`, 'error');
  }

  const ok = await spendCash(GZ.uid, amount, 'repay');
  if (!ok) return toast('Yetersiz bakiye', 'error');

  await db.ref(`bank/${GZ.uid}/loan`).transaction(c => Math.max(0,(c||0)-amount));
  toast(`✅ -${cashFmt(amount)} kredi ödendi`, 'success');
  return true;
}
window.bankRepay = bankRepay;

/* ============================================================
   PAZAR — DÜKKAN OTOMATİK SATIŞ MOTORU
   YALNIZCA REYONA ÜRÜN EKLENMİŞSE SATIŞ OLUR (kafasına göre satış YOK)
   ============================================================ */
async function initMarketSalesEngine(){
  setInterval(processSales, 180000); // her 3 dakika (daha gerçekçi satış hızı)
  setTimeout(processSales, 7000);
  // Robot reyon doldurma: her 5 dakikada bir kontrol
  setInterval(async () => {
    if (!GZ.uid) return;
    const robotActive = (GZ.data?.robotUntil || 0) > Date.now();
    if (robotActive) await robotAutoFillShelves(GZ.uid);
  }, 300000);
}

async function processSales(){
  if (!GZ.uid) return;
  try {
  const shops = await dbGet(`businesses/${GZ.uid}/shops`) || {};

  for (const sid of Object.keys(shops)){
    const shop = shops[sid];
    const shelves = shop.shelves || {};
    let totalSale = 0;
    const updates = {};
    for (const item of Object.keys(shelves)){
      const sh = shelves[item];
      if (!sh || (sh.stock||0) <= 0) continue;
      if (!sh.price || sh.price <= 0) continue;
      const u = URUNLER[item];
      if (!u) continue;

      // Fiyat-talep eğrisi
      const ratio = sh.price / u.base;
      let demandFactor = 1;
      if      (ratio < 1)   demandFactor = 1.4; // ucuz → çok satar
      else if (ratio < 1.3) demandFactor = 1.0; // normal
      else if (ratio < 1.8) demandFactor = 0.6; // biraz pahalı
      else if (ratio < 2.5) demandFactor = 0.3; // pahalı
      else                  demandFactor = 0.08; // çok pahalı

      // Açılış bonusu: ilk 24 saatte 3x (eskisi 5x'ti, çok yüksekti)
      const since = Date.now() - (shop.createdAt || Date.now());
      const opening = since < 24*3600*1000 ? 3 : 1;

      // Satış hızı: normal fiyatta saatte ~20 ürün
      // 3dk tick = saatte 20 tick → 1.0 adet/tick = 20/saat
      const baseRate = 1.0 * demandFactor * opening * (shop.level||1);
      const sold = Math.min(sh.stock, Math.max(0, Math.floor(baseRate * (0.5 + Math.random()*1.0))));
      if (sold <= 0) continue;

      const revenue = +(sold * sh.price).toFixed(2);
      totalSale += revenue;

      updates[`${sid}/shelves/${item}/stock`] = Math.max(0, sh.stock - sold);
      updates[`${sid}/shelves/${item}/totalSold`] = (sh.totalSold||0) + sold;
      updates[`${sid}/shelves/${item}/totalRevenue`] = +((sh.totalRevenue||0) + revenue).toFixed(2);
    }

    if (totalSale > 0){
      // addCash haftalık geliri de takip ediyor (firebase-init.js içinde)
      await addCash(GZ.uid, totalSale, 'shop-sale');
      await addXP(GZ.uid, Math.floor(totalSale / 600));
      await db.ref(`businesses/${GZ.uid}/shops`).update(updates);
    }
  }
  // Bahçe / Çiftlik / Fabrika / Maden
  await processProductions();
  // Robot aktifse reyonları otomatik doldur
  if ((GZ.data?.robotUntil || 0) > Date.now()) {
    await robotAutoFillShelves(GZ.uid);
  }
  } catch(e) {
    console.warn('[processSales] Hata:', e);
  }
}

/* ============================================================
   ROBOT OTOMATİK REYON DOLDURMA
   Robot SADECE depodaki ürünleri boş reyona aktarır.
   Satış yapmaz, para işlemi yoktur.
   Satış zaten processSales() tarafından reyonda stok varsa yapılır.
   ============================================================ */
async function robotAutoFillShelves(uid) {
  try {
    if (!uid) return;
    const shops     = await dbGet(`businesses/${uid}/shops`) || {};
    // Depo: mainWarehouse + tüm depo birimleri
    const mainWarehouse = await dbGet(`businesses/${uid}/mainWarehouse`) || {};
    const warehouseUnits = await dbGet(`businesses/${uid}/warehouses`) || {};

    // Tüm depo stoklarını birleştir (mainWarehouse + diğer depolar)
    const combinedWarehouse = { ...mainWarehouse };
    for (const wh of Object.values(warehouseUnits)) {
      if (wh.stock && typeof wh.stock === 'object') {
        for (const [item, qty] of Object.entries(wh.stock)) {
          combinedWarehouse[item] = (combinedWarehouse[item] || 0) + (qty || 0);
        }
      }
    }

    const whLocal     = { ...combinedWarehouse }; // Yerel kopya
    const shopUpdates = {};
    let   totalFilled = 0;
    const filledItems = [];

    for (const [sid, shop] of Object.entries(shops)) {
      const shelves = shop.shelves || {};

      for (const [itemKey, sh] of Object.entries(shelves)) {
        if (!sh) continue;
        const cur   = sh.stock || 0;
        const max   = sh.max   || 100;
        const space = max - cur;

        // Reyon %60'ın altındaysa depudan doldur
        if (space <= 0 || cur >= max * 0.60) continue;

        const whQty = whLocal[itemKey] || 0;
        if (whQty <= 0) continue;

        const fill = Math.min(space, whQty);
        if (fill <= 0) continue;

        // Stok ekle — para işlemi yok, sadece fiziksel transfer
        shopUpdates[`${sid}/shelves/${itemKey}/stock`] = cur + fill;
        whLocal[itemKey] = whQty - fill;
        totalFilled      += fill;

        const itemName = (window.URUNLER || {})[itemKey]?.name || itemKey;
        if (!filledItems.includes(itemName)) filledItems.push(itemName);
      }
    }

    if (totalFilled > 0) {
      // Dükkan reyon stoklarını güncelle
      await db.ref(`businesses/${uid}/shops`).update(shopUpdates);

      // mainWarehouse'daki değişiklikleri yaz
      const mainWhUpdates = {};
      for (const [item, newQty] of Object.entries(whLocal)) {
        const oldQty = (mainWarehouse[item] || 0);
        if (oldQty !== newQty) {
          mainWhUpdates[item] = Math.max(0, newQty);
        }
      }
      if (Object.keys(mainWhUpdates).length > 0) {
        await db.ref(`businesses/${uid}/mainWarehouse`).update(mainWhUpdates);
      }

      // Depo birimlerinden de tüketim yapıldıysa güncelle (pro-rata azalt)
      // (Basit: mainWarehouse yeterli değilse diğer depoları da tüket)
      const remaining = {};
      for (const [item, localQty] of Object.entries(whLocal)) {
        const mainQty = mainWhUpdates[item] !== undefined ? mainWhUpdates[item] : (mainWarehouse[item] || 0);
        if (localQty < mainQty) remaining[item] = mainQty - localQty; // Hâlâ tüketilmesi gereken
      }

      const preview = filledItems.slice(0, 3).join(', ')
        + (filledItems.length > 3 ? ` +${filledItems.length - 3} ürün daha` : '');

      if (typeof window.pushNotif === 'function') {
        await window.pushNotif(uid,
          `🤖 Robot ${totalFilled} birim aktardı: ${preview}`,
          '🤖', 'robot'
        );
      }
    }
  } catch(e) {
    console.warn('[robotAutoFillShelves] Hata:', e);
  }
}
window.robotAutoFillShelves = robotAutoFillShelves;

async function processProductions(){
  try {
  const t = now();
  const kinds = ['gardens','farms','factories','mines'];
  // Depo kapasitesi: her lv icin 500 birim, max 5000
  const DEPO_CAP_PER_LV = 500;
  const DEPO_MAX = 5000;

  for (const kind of kinds){
    const list = await dbGet('businesses/'+GZ.uid+'/'+kind) || {};
    for (const id of Object.keys(list)){
      const it = list[id];
      if (!it.crop || !it.harvestAt) continue;
      if (t < it.harvestAt) continue;

      // Depo kapasitesi kontrolu
      const depoCap = Math.min(DEPO_MAX, (it.level||1) * DEPO_CAP_PER_LV);
      const mevcutStok = (await dbGet('businesses/'+GZ.uid+'/mainWarehouse/'+it.crop)) || 0;

      if (mevcutStok >= depoCap){
        // DEPO DOLU - uretim durdu
        if (!it.depoDolu){
          await dbUpdate('businesses/'+GZ.uid+'/'+kind+'/'+id, { depoDolu: true, ready: false });
          await pushNotif(GZ.uid, '\uD83D\uDCE6 Depo doldu! '+
            (URUNLER[it.crop]?.name||it.crop)+' uretimi durdu. Stoku bos alt.');
        }
        continue;
      }

      const robotAktif = (GZ.data?.robotUntil || 0) > t;

      if (robotAktif){
        // Robot aktifse otomatik hasat + yeniden ekim
        const yieldQty = Math.min((it.level||1) * 100, depoCap - mevcutStok);
        await addStock(GZ.uid, it.crop, yieldQty, 'mainWarehouse');
        await addXP(GZ.uid, Math.floor(yieldQty * (URUNLER[it.crop]?.base||1) / 50));
        const growTime = (kind==='gardens'?10:kind==='farms'?20:kind==='factories'?15:45)*60*1000;
        await dbUpdate('businesses/'+GZ.uid+'/'+kind+'/'+id, {
          harvestAt: t + growTime, ready: false, depoDolu: false
        });
        await pushNotif(GZ.uid, 
          '\uD83E\uDD16 Robot hasat: +'+yieldQty+' '+
          (URUNLER[it.crop]?.unit||'')+' '+(URUNLER[it.crop]?.name||it.crop));
      } else {
        // Robot yok: sadece hazir bayragi goster, kullanici el ile hasat eder
        if (!it.ready){
          await dbUpdate('businesses/'+GZ.uid+'/'+kind+'/'+id, { ready: true, depoDolu: false });
        }
      }
    }
  }
  } catch(e) {
    console.warn('[processProductions] Hata:', e);
  }
}



/* ============================================================
   TX LOG — Buyuk islemleri kaydet (hile avcisi)
   ============================================================ */
async function logTx(type, amount, details){
  if (!GZ.uid) return;
  details = details || {};
  const LIMIT = 10000;
  if (amount < LIMIT && type !== 'suspicious') return;
  try {
    await db.ref('txLog').push({
      uid: GZ.uid,
      username: GZ.data ? GZ.data?.username : '?',
      type: type,
      amount: amount,
      ts: firebase.database.ServerValue.TIMESTAMP,
      details: JSON.stringify(details).slice(0,300)
    });
    // 1M TL uzeri otomatik suphe kaydı
    if (amount >= 1000000){
      await db.ref('security/suspiciousActivity').push({
        uid: GZ.uid,
        username: GZ.data ? GZ.data?.username : '?',
        type: type,
        amount: amount,
        ts: firebase.database.ServerValue.TIMESTAMP,
        reason: 'Yuksek tutarli islem: '+amount+' TL ('+type+')'
      });
    }
  } catch(e){}
}
window.logTx = logTx;

/* ============================================================
   STOK / DEPO YARDIMCILARI
   ============================================================ */
// Tüm depolardaki + reyonlardaki + hammadde stoğu = toplam
async function getTotalStock(uid, item){
  let total = 0;
  const wh = await dbGet(`businesses/${uid}/warehouses`) || {};
  for (const city of Object.keys(wh)){
    total += (wh[city].items?.[item]) || 0;
  }
  // Ana depo
  const main = (await dbGet(`businesses/${uid}/mainWarehouse/${item}`)) || 0;
  total += main;
  return total;
}
window.getTotalStock = getTotalStock;

async function addStock(uid, item, qty, target='mainWarehouse'){
  if (qty <= 0) return;
  if (target === 'mainWarehouse'){
    await db.ref(`businesses/${uid}/mainWarehouse/${item}`).transaction(c => (c||0)+qty);
  } else {
    await db.ref(`businesses/${uid}/warehouses/${target}/items/${item}`).transaction(c => (c||0)+qty);
  }
}
window.addStock = addStock;

async function consumeStock(uid, item, qty){
  // Önce mainWarehouse'tan, sonra şehirlerden tüket
  let need = qty;
  const main = (await dbGet(`businesses/${uid}/mainWarehouse/${item}`)) || 0;
  if (main >= need){
    await db.ref(`businesses/${uid}/mainWarehouse/${item}`).set(main - need);
    return true;
  } else {
    if (main > 0){
      need -= main;
      await db.ref(`businesses/${uid}/mainWarehouse/${item}`).set(0);
    }
    const wh = await dbGet(`businesses/${uid}/warehouses`) || {};
    for (const city of Object.keys(wh)){
      const cur = (wh[city].items?.[item]) || 0;
      if (cur <= 0) continue;
      if (cur >= need){
        await db.ref(`businesses/${uid}/warehouses/${city}/items/${item}`).set(cur - need);
        return true;
      } else {
        need -= cur;
        await db.ref(`businesses/${uid}/warehouses/${city}/items/${item}`).set(0);
      }
    }
    if (need > 0) return false;
    return true;
  }
}
window.consumeStock = consumeStock;

async function countBusinesses(uid){
  const shops = await dbGet(`businesses/${uid}/shops`) || {};
  const gardens = await dbGet(`businesses/${uid}/gardens`) || {};
  const farms = await dbGet(`businesses/${uid}/farms`) || {};
  const factories = await dbGet(`businesses/${uid}/factories`) || {};
  const mines = await dbGet(`businesses/${uid}/mines`) || {};
  return Object.keys(shops).length + Object.keys(gardens).length + Object.keys(farms).length + Object.keys(factories).length + Object.keys(mines).length;
}

async function countEmployees(uid){
  const shops = await dbGet(`businesses/${uid}/shops`) || {};
  let total = 0;
  for (const id of Object.keys(shops)) total += (shops[id].employees||1);
  return total;
}

/* ============================================================
   REYON / DÜKKAN İŞLEMLERİ
   ============================================================ */
async function buyShop(type, city){
  // SHOP_CATALOG'dan maliyetleri çek, yoksa fallback
  const catalog = window.SHOP_CATALOG || {};
  const catEntry = catalog[type];
  const costs = { market: 5000, elektronik: 12000, mobilya: 18000, kuyumcu: 35000,
                  beyazesya: 22000, otomotiv: 60000, benzin: 45000,
                  kasap: 8000, manav: 4000, eczane: 15000, kitabevi: 10000,
                  spor: 20000, oyuncak: 12000, teknoloji: 25000, tekstil: 18000 };
  const lvReq = { market:1, elektronik:5, mobilya:8, kuyumcu:15, beyazesya:10,
                  otomotiv:18, benzin:12, kasap:2, manav:1, eczane:6,
                  kitabevi:3, spor:7, oyuncak:4, teknoloji:8, tekstil:5 };
  const cost = catEntry?.cost || costs[type] || 5000;
  const lv = GZ.data?.level || 1;
  const minLv = catEntry?.lv || lvReq[type] || 1;
  if (lv < minLv) return toast(`Bu dükkan ${minLv}. seviyede açılır`, 'warn');

  // ── TEKRAR AÇMA KONTROLÜ: Aynı türde dükkan var mı? ──
  const myShops = await dbGet(`businesses/${GZ.uid}/shops`) || {};
  const sameType = Object.values(myShops).filter(s => s.type === type);
  if (sameType.length >= 1) {
    return toast(`❌ Zaten bir ${catEntry?.name || type} dükkanın var! Her türden yalnız 1 adet açılabilir.`, 'error');
  }

  const ok = await spendCash(GZ.uid, cost, 'buy-shop');
  if (!ok) return toast('Yetersiz bakiye', 'error');
  const id = 'sh_' + Math.random().toString(36).slice(2,8);

  // Varsayılan reyonları bu dükkan türüne göre ekle
  const defaultShelves = {};
  if (catEntry && catEntry.cats) {
    const allowed = Object.entries(URUNLER)
      .filter(([k,v]) => catEntry.cats.includes(v.cat) && v.lv <= lv)
      .slice(0, 3); // İlk 3 ürünü varsayılan reyon olarak ekle
    for (const [itemKey, item] of allowed) {
      defaultShelves[itemKey] = {
        item: itemKey, stock: 0, max: 100,
        price: +(item.base * 1.2).toFixed(2),
        cost: item.base, totalSold: 0, totalRevenue: 0
      };
    }
  }

  await dbSet(`businesses/${GZ.uid}/shops/${id}`, {
    id, type, city, level:1, employees:1, createdAt: now(),
    shelves: defaultShelves
  });
  await checkAndGrantAchievement(GZ.uid, 'shop_5');
  toast(`✅ ${catEntry?.name || type} açıldı! ${Object.keys(defaultShelves).length} varsayılan reyon eklendi.`, 'success');
}
window.buyShop = buyShop;

async function addShelf(shopId, itemKey){
  const item = URUNLER[itemKey];
  if (!item) return toast('Geçersiz ürün','error');
  if ((GZ.data?.level||1) < item.lv) return toast(`${item.lv}. seviyede açılır`, 'warn');
  const exist = await dbGet(`businesses/${GZ.uid}/shops/${shopId}/shelves/${itemKey}`);
  if (exist) return toast('Bu reyon zaten var','warn');
  const shopLv = (await dbGet(`businesses/${GZ.uid}/shops/${shopId}/level`)) || 1;
  const maxStock = 50 * shopLv; // Dükkan seviyesine göre kapasite
  const cost = 500;
  const ok = await spendCash(GZ.uid, cost, 'add-shelf');
  if (!ok) return toast(`Reyon kurulum: ${cashFmt(cost)} gerekli`, 'error');
  await dbSet(`businesses/${GZ.uid}/shops/${shopId}/shelves/${itemKey}`, {
    item: itemKey, stock:0, max: maxStock, price: +(item.base * 1.2).toFixed(2),
    cost: item.base, totalSold:0, totalRevenue:0, addedAt: now()
  });
  toast(`✅ Reyon eklendi (Kapasite: ${maxStock} ${item.unit})`, 'success');
}
window.addShelf = addShelf;

async function buyShelfStock(shopId, itemKey, qty){
  if(!qty||qty<=0||!isFinite(qty)) return toast('Geçersiz miktar','error');
  qty=Math.floor(qty);
  const u=URUNLER?.[itemKey];
  if(!u) return toast('Ürün bulunamadı, sayfayı yenile.','error');
  let snap;
  try { snap=await db.ref('businesses/'+GZ.uid+'/shops/'+shopId+'/shelves/'+itemKey).once('value'); }
  catch(e){ return toast('Bağlantı hatası','error'); }
  const sh=snap.val();
  if(!sh) return toast('❌ Reyon bulunamadı. "+ Yeni Reyon" ile ekle.','error');
  const cur=sh.stock||0, max=sh.max||50, space=max-cur;
  if(space<=0) return toast('⚠️ Reyon dolu! ('+cur+'/'+max+') Önce sat.','warn');
  const aQty=Math.min(qty,space);
  const cost=+(aQty*u.base).toFixed(2);
  const money=(await dbGet('users/'+GZ.uid+'/money'))||0;
  if(money<cost) return toast('💸 Yetersiz bakiye! Gereken: '+cashFmt(cost)+' — Mevcut: '+cashFmt(money),'error');
  const ok=await spendCash(GZ.uid,cost,'shelf-stock');
  if(!ok) return toast('💸 Ödeme başarısız.','error');
  const newStock=cur+aQty;
  const newAvg=+((((sh.cost||u.base)*cur)+cost)/newStock).toFixed(2);
  try{
    await db.ref('businesses/'+GZ.uid+'/shops/'+shopId+'/shelves/'+itemKey).update({stock:newStock,cost:isFinite(newAvg)?newAvg:u.base});
  }catch(e){
    await db.ref('users/'+GZ.uid+'/money').transaction(m=>(m||0)+cost);
    return toast('Stok güncellenemedi, para iade edildi.','error');
  }
  toast(aQty<qty?'✅ '+aQty+' '+u.unit+' eklendi ('+cashFmt(cost)+') — Reyon doldu':'✅ +'+aQty+' '+u.unit+' reyona eklendi ('+cashFmt(cost)+')','success');
}
window.buyShelfStock=buyShelfStock;

async function setShelfPrice(shopId, itemKey, price){
  if (price <= 0) return toast('Geçersiz fiyat','error');
  const item = URUNLER[itemKey];
  if (item){
    const maxAllowed = +(item.base * 3).toFixed(2);
    if (price > maxAllowed){
      return toast(`❌ Maksimum fiyat: ${cashFmt(maxAllowed)} (taban × 3). Bu fiyatta hiç satış olmaz.`, 'error');
    }
    if (price < item.base * 0.5){
      return toast(`⚠️ Çok düşük fiyat! Tabanın yarısından az — zarar edersin.`, 'warn');
    }
  }
  await dbUpdate(`businesses/${GZ.uid}/shops/${shopId}/shelves/${itemKey}`, { price });
  toast('Fiyat güncellendi', 'success');
}
window.setShelfPrice = setShelfPrice;

async function deleteShelf(shopId, itemKey){
  await db.ref(`businesses/${GZ.uid}/shops/${shopId}/shelves/${itemKey}`).remove();
  toast('Reyon kapatıldı','success');
}
window.deleteShelf = deleteShelf;

async function upgradeShop(shopId){
  // ── BUG FIX: Transaction ile çift yükseltme önlemi ──
  let cost = 0;
  let newLevel = 0;
  let aborted = false;

  await db.ref(`businesses/${GZ.uid}/shops/${shopId}`).transaction(shop => {
    if (!shop) { aborted = true; return; }
    const next = (shop.level||1) + 1;
    cost = next * 5000;
    newLevel = next;
    return { ...shop, level: next, employees: (shop.employees||1) + 1 };
  });

  if (aborted) return toast('Dükkan bulunamadı', 'error');

  const ok = await spendCash(GZ.uid, cost, 'upgrade-shop');
  if (!ok) {
    // Para çekilemezse seviyeyi geri al
    await db.ref(`businesses/${GZ.uid}/shops/${shopId}`).transaction(shop => {
      if (!shop) return;
      return { ...shop, level: Math.max(1, (shop.level||1) - 1), employees: Math.max(1, (shop.employees||1) - 1) };
    });
    return toast(`Yetersiz bakiye (${cashFmt(cost)})`, 'error');
  }
  toast(`✅ Dükkan Lv ${newLevel} (-${cashFmt(cost)})`, 'success');
}
window.upgradeShop = upgradeShop;

/* ============================================================
   BAHÇE / ÇİFTLİK / FABRİKA / MADEN
   ============================================================ */
async function buyProductionUnit(kind){
  const map = {
    gardens:    { cost:3000, lv:2,  name:"Bahçe" },
    farms:     { cost:8000, lv:5,  name:"Çiftlik" },
    factories: { cost:25000,lv:8,  name:"Fabrika" },
    mines:     { cost:80000,lv:30, name:"Maden" }
  };
  const m = map[kind]; if (!m) return;
  if ((GZ.data?.level||1) < m.lv) return toast(`${m.lv}. seviyede açılır`, 'warn');
  const ok = await spendCash(GZ.uid, m.cost, 'buy-prod');
  if (!ok) return toast('Yetersiz bakiye', 'error');
  const id = kind.slice(0,2) + '_' + Math.random().toString(36).slice(2,8);
  await dbSet(`businesses/${GZ.uid}/${kind}/${id}`, {
    id, level:1, createdAt: now(), crop:null, harvestAt:null, ready:false
  });
  toast(`${m.name} açıldı`, 'success');
}
window.buyProductionUnit = buyProductionUnit;

async function plantCrop(kind, unitId, itemKey){
  const u = URUNLER[itemKey];
  if (!u) return toast('Geçersiz ürün','error');
  if ((GZ.data?.level||1) < u.lv) return toast(`${u.lv}. seviyede açılır`,'warn');
  const cropCost = +(u.base * 0.4 * 100).toFixed(2); // 100 birim ekim maliyeti
  const ok = await spendCash(GZ.uid, cropCost, 'plant');
  if (!ok) return toast(`Yetersiz bakiye (${cashFmt(cropCost)})`, 'error');
  const grow = (kind==='gardens'? 10 : kind==='farms'? 20 : kind==='factories'? 15 : 45) * 60 * 1000;
  await dbUpdate(`businesses/${GZ.uid}/${kind}/${unitId}`, {
    crop: itemKey,
    harvestAt: now() + grow,
    ready: false
  });
  toast(`${u.name} ekildi`, 'success');
}
window.plantCrop = plantCrop;

async function harvest(kind, unitId){
  let yieldQty = 0;
  let cropType = null;
  let unitLevel = 1;
  let success = false;

  await db.ref(`businesses/${GZ.uid}/${kind}/${unitId}`).transaction(u => {
    if (!u || !u.crop) return; // abort
    if (now() < u.harvestAt) return; // henüz hazır değil
    yieldQty   = (u.level||1) * 100;
    cropType   = u.crop;
    unitLevel  = u.level||1;
    success    = true;
    // Hasat et ve AYNI ürünle otomatik yeniden ekim başlat
    const growMs = (kind==='gardens'?10:kind==='farms'?20:kind==='factories'?15:45)*60*1000;
    return { ...u, harvestAt: now() + growMs, ready: false, depoDolu: false };
  });

  if (!success || !cropType) {
    return toast('Henüz hazır değil veya zaten hasat edildi', 'warn');
  }

  const urun = URUNLER[cropType];
  if (!urun) return;

  // ── Ürünü ANA DEPOYA ekle (robot sonra reyona aktarır) ──
  await db.ref(`businesses/${GZ.uid}/mainWarehouse/${cropType}`).transaction(cur => (cur||0) + yieldQty);
  await addXP(GZ.uid, Math.floor(yieldQty * urun.base / 50));

  // haftalık gelir için ön hesap (satılınca gerçek gelir sayılır)
  const tahminiGelir = +(yieldQty * urun.base * 1.2).toFixed(2);

  toast(`🌾 +${yieldQty} ${urun.unit} ${urun.name} depoya eklendi! Yeniden ekim başladı 🌱`, 'success', 4000);

  // TX log
  if (typeof logTx === 'function') logTx('harvest', 0, { crop: cropType, qty: yieldQty });

  // Günlük görev
  if (typeof updateDailyTask === 'function') await updateDailyTask('harvest_3', 1);
  if (typeof window.incrementGorev === 'function') window.incrementGorev('harvest_3', 1);
}
window.harvest = harvest;

async function upgradeProductionUnit(kind, unitId){
  // ── BUG FIX: Transaction ile çift yükseltme önlemi ──
  let cost = 0;
  let newLevel = 0;
  let aborted = false;

  await db.ref(`businesses/${GZ.uid}/${kind}/${unitId}`).transaction(u => {
    if (!u) { aborted = true; return; }
    cost = (u.level||1) * 2500;
    newLevel = (u.level||1) + 1;
    return { ...u, level: newLevel };
  });

  if (aborted) return toast('Birim bulunamadı', 'error');

  const ok = await spendCash(GZ.uid, cost, 'upgrade-prod');
  if (!ok) {
    // Geri al
    await db.ref(`businesses/${GZ.uid}/${kind}/${unitId}`).transaction(u => {
      if (!u) return;
      return { ...u, level: Math.max(1, (u.level||1) - 1) };
    });
    return toast(`Yetersiz bakiye (${cashFmt(cost)})`, 'error');
  }
  toast(`✅ Yükseltildi → Lv ${newLevel} (-${cashFmt(cost)})`, 'success');
}
window.upgradeProductionUnit = upgradeProductionUnit;

/* ============================================================
   LOJİSTİK — DEPO
   ============================================================ */
async function buyWarehouse(city, payment){
  const exist = await dbGet(`businesses/${GZ.uid}/warehouses/${city}`);
  if (exist) return toast('Bu şehirde deponuz zaten var','warn');
  if (payment === 'diamond'){
    const ok = await spendDiamonds(GZ.uid, 100);
    if (!ok) return toast('Yetersiz elmas (100 gerekli)','error');
  } else {
    const ok = await spendCash(GZ.uid, 25000, 'warehouse');
    if (!ok) return toast('Yetersiz bakiye (25.000 ₺ gerekli)','error');
  }
  await dbSet(`businesses/${GZ.uid}/warehouses/${city}`, {
    city, capacity: 100000, items: {}, createdAt: now()
  });
  toast(`${city} deposu açıldı`, 'success');
}
window.buyWarehouse = buyWarehouse;

async function transferStock(item, qty, fromCity, toCity){
  // basit transfer
  const f = await dbGet(`businesses/${GZ.uid}/warehouses/${fromCity}/items/${item}`) || 0;
  if (f < qty) return toast('Yetersiz stok','error');
  await db.ref(`businesses/${GZ.uid}/warehouses/${fromCity}/items/${item}`).set(f - qty);
  await db.ref(`businesses/${GZ.uid}/warehouses/${toCity}/items/${item}`).transaction(c => (c||0)+qty);
  toast('Transfer tamam', 'success');
}
window.transferStock = transferStock;

/* ============================================================
   KRİPTO ALIM-SATIM (v2 - bug fix + güvenli)
   ============================================================ */
async function buyCrypto(sym, tlAmount){
  if (!tlAmount || tlAmount <= 0 || !isFinite(tlAmount)) {
    toast('Geçersiz tutar','error');
    return false;
  }
  const price = GZ.prices[sym]?.current;
  if (!price || price <= 0) {
    toast('Fiyat alınamadı','error');
    return false;
  }
  // Min alım kontrolü
  if (tlAmount < 1) {
    toast('Min alım: ₺1','error');
    return false;
  }
  // Bakiye kontrolü
  const myMoney = GZ.data?.money || 0;
  if (tlAmount > myMoney) {
    toast(`Yetersiz bakiye! Mevcut: ${cashFmt(myMoney)}`,'error');
    return false;
  }

  const ok = await spendCash(GZ.uid, tlAmount, 'crypto-buy');
  if (!ok) {
    toast('Yetersiz bakiye','error');
    return false;
  }
  const fee = tlAmount * 0.005;  // %0.5 komisyon
  const qty = (tlAmount - fee) / price;

  await db.ref('crypto/holdings/'+GZ.uid+'/'+sym).transaction(c => (c||0) + qty);

  // Merkezi fiyat etkisi: alim fiyati %0.05-0.2 yukselttir (hacime gore)
  try {
    const impactPct = Math.min(0.002, tlAmount / 50000000) * (0.5 + Math.random()*0.5);
    await db.ref('crypto/prices/'+sym).transaction(p => {
      if (!p) return p;
      if (p.locked) return p; // admin kilitli
      const newPrice = p.current * (1 + impactPct);
      return { ...p, prev: p.current, current: newPrice, lastBuyImpact: impactPct, ts: Date.now() };
    });
  } catch(e){}

  // TX LOG
  if (typeof logTx === 'function') logTx('crypto-buy', tlAmount, { sym, qty });

  toast(`✅ Aldın: ${qty.toFixed(6)} ${sym} (Komisyon: ${cashFmt(fee)})`, 'success', 4000);

  // Günlük görev güncellemesi
  if (tlAmount >= 1000 && typeof updateDailyTask === 'function') {
    await updateDailyTask('crypto_1', 1);
  }

  return true;
}
window.buyCrypto = buyCrypto;

async function sellCrypto(sym, qty){
  if (!qty || qty <= 0 || !isFinite(qty)) {
    toast('Geçersiz miktar','error');
    return false;
  }
  const price = GZ.prices[sym]?.current;
  if (!price || price <= 0) {
    toast('Fiyat alınamadı','error');
    return false;
  }

  // Atomik kontrol + güncelleme (race condition fix)
  let success = false;
  let actualQty = 0;
  await db.ref(`crypto/holdings/${GZ.uid}/${sym}`).transaction(cur => {
    cur = cur || 0;
    if (cur < qty) {
      // Yetersiz - işlemi iptal et
      return cur;
    }
    success = true;
    actualQty = qty;
    const remaining = cur - qty;
    // Çok küçük artıkları sıfırla (floating-point hatası önlemi)
    return remaining < 0.000001 ? 0 : remaining;
  });

  if (!success) {
    toast('Yetersiz miktar','error');
    return false;
  }

  const grossTl = actualQty * price;
  const fee = grossTl * 0.005;  // %0.5 komisyon
  const netTl = grossTl - fee;

  await addCash(GZ.uid, netTl, 'crypto-sell');

  // Merkezi fiyat etkisi: satis fiyati dusursun
  try {
    const impactPct = Math.min(0.002, grossTl / 50000000) * (0.5 + Math.random()*0.5);
    await db.ref('crypto/prices/'+sym).transaction(p => {
      if (!p) return p;
      if (p.locked) return p;
      const newPrice = Math.max(p.current * (1 - impactPct), 0.000001);
      return { ...p, prev: p.current, current: newPrice, lastSellImpact: impactPct, ts: Date.now() };
    });
  } catch(e){}

  // TX LOG
  if (typeof logTx === 'function') logTx('crypto-sell', netTl, { sym, qty });

  toast(`✅ Sattın: ${actualQty.toFixed(6)} ${sym} → +${cashFmt(netTl)} (Komisyon: ${cashFmt(fee)})`, 'success', 4000);

  // Günlük görev
  if (netTl >= 1000 && typeof updateDailyTask === 'function') {
    await updateDailyTask('crypto_1', 1);
  }

  return true;
}
window.sellCrypto = sellCrypto;

/* ============================================================
   MARKA
   ============================================================ */
async function createBrand(name){
  if (!name || name.length<3 || name.length>20) return toast('İsim 3-20 karakter olmalı','error');
  if (!/^[a-zA-Z0-9_ ]+$/.test(name)) return toast('Sadece harf/rakam','error');
  const lv = GZ.data?.level||1;
  if (lv < 10) return toast('10. seviyede açılır','warn');
  const ok = await spendCash(GZ.uid, 25000, 'brand');
  if (!ok) return toast('25.000 ₺ gerekli','error');
  const id = 'br_' + Math.random().toString(36).slice(2,8);
  await dbSet(`brands/${id}`, {
    id, name, leader: GZ.uid, leaderName: GZ.data?.username,
    members: { [GZ.uid]: { joinedAt: now(), role:'leader' } },
    points: 100, power: 1, createdAt: now()
  });
  await dbUpdate(`users/${GZ.uid}`, { brand: id });
  toast(`Marka kuruldu: ${name}`, 'success');
}
window.createBrand = createBrand;

async function joinBrand(id){
  const b = await dbGet(`brands/${id}`);
  if (!b) return toast('Marka bulunamadı','error');
  if (Object.keys(b.members||{}).length >= 20) return toast('Marka dolu','warn');
  await dbSet(`brands/${id}/members/${GZ.uid}`, { joinedAt: now(), role:'member' });
  await dbUpdate(`users/${GZ.uid}`, { brand: id });
  toast('Markaya katıldın', 'success');
}
window.joinBrand = joinBrand;

async function leaveBrand(){
  const id = GZ.data?.brand;
  if (!id) return;
  const b = await dbGet(`brands/${id}`);
  if (b && b.leader === GZ.uid){
    // Lider çıkıyorsa marka dağılır
    await db.ref(`brands/${id}`).remove();
  } else {
    await db.ref(`brands/${id}/members/${GZ.uid}`).remove();
  }
  await dbUpdate(`users/${GZ.uid}`, { brand: null });
  toast('Markadan ayrıldın', 'success');
}
window.leaveBrand = leaveBrand;

/* ============================================================
   MAĞAZA — Elmas paketleri & robot
   ============================================================ */

// Elmas fiyatı: 1 elmas = kaç TL (admin panelinden ayarlanabilir)
async function getElmasFiyati(){
  const fiyat = await dbGet('system/elmasFiyati');
  return (fiyat && fiyat > 0) ? fiyat : 1500; // varsayılan 1500₺
}
window.getElmasFiyati = getElmasFiyati;

// Elmas → Nakit dönüştür (admin tarafından belirlenen fiyata göre)
async function elmasiNakiteVer(diaAmount){
  if (!diaAmount || diaAmount <= 0) return;
  const fiyat = await getElmasFiyati();
  const kazanc = diaAmount * fiyat;
  await addCash(GZ.uid, kazanc, 'diamond-convert');
  await pushNotif(GZ.uid, `💎 ${diaAmount} elmas → ${cashFmt(kazanc)} olarak hesabına eklendi (${cashFmt(fiyat)}/elmas)`);
  toast(`💎 +${diaAmount} elmas = +${cashFmt(kazanc)}`, 'success', 4000);
}
window.elmasiNakiteVer = elmasiNakiteVer;

const ELMAS_PAKETLERI = [
  { id:'p1', dia:50,    tl:60,   bonus:0   },
  { id:'p2', dia:200,   tl:300,  bonus:20  },
  { id:'p3', dia:500,   tl:600,  bonus:80  },
  { id:'p4', dia:1200,  tl:1200, bonus:300 },
  { id:'p5', dia:3000,  tl:2400, bonus:1000},
  { id:'p6', dia:10000, tl:6000, bonus:5000}
];
window.ELMAS_PAKETLERI = ELMAS_PAKETLERI;

const ROBOT_PAKETLERI = [
  { id:'r_h', name:'Saatlik Robot',   diamonds:30,   hours:1   },
  { id:'r_d', name:'Günlük Robot',    diamonds:200,  hours:24  },
  { id:'r_w', name:'Haftalık Robot',  diamonds:1000, hours:168 },
  { id:'r_m', name:'Aylık Robot',     diamonds:3500, hours:720 }
];
window.ROBOT_PAKETLERI = ROBOT_PAKETLERI;

async function buyRobot(rid){
  const r = ROBOT_PAKETLERI.find(x=>x.id===rid);
  if (!r) return;
  const ok = await spendDiamonds(GZ.uid, r.diamonds);
  if (!ok) return toast('Yetersiz elmas','error');
  const cur = await dbGet(`users/${GZ.uid}/robotUntil`) || 0;
  const start = Math.max(now(), cur);
  await dbUpdate(`users/${GZ.uid}`, { robotUntil: start + r.hours*3600*1000 });
  toast(`Robot aktif: ${r.hours} saat`, 'success');
}
window.buyRobot = buyRobot;

/* ============================================================
   BİLDİRİMLER
   ============================================================ */
async function pushNotif(uid, msg){
  // firebase-init.js'deki zengin versiyonu kullan (icon + type destekli)
  // Bu fonksiyon sadece geriye dönük uyumluluk için burada, window.pushNotif'i ezmez
  const id = await dbPush(`notifs/${uid}`, { msg, ts: now(), read:false, type:'system', icon:'🔔' });
  return id;
}
// NOT: window.pushNotif = pushNotif satırı KALDIRILDI
// firebase-init.js'deki zengin versiyon (icon, type destekli) geçerli kalır

/* ============================================================
   OYUNCU PAZARI — Gerçek Zamanlı Alışveriş Sistemi
   Oyuncular ürün satışa koyar, diğerleri satın alır
   ============================================================ */

// Oyuncu ürün satışa koyar (açık veya gizli)
async function listPlayerItem(itemKey, qty, price, isPublic = true){
  const item = URUNLER[itemKey];
  if (!item) return toast('Geçersiz ürün', 'error');

  // Fiyat limiti: tabanın %50'si ile 5 katı arası
  const minP = +(item.base * 0.5).toFixed(2);
  const maxP = +(item.base * 5).toFixed(2);
  if (price < minP || price > maxP){
    return toast(`Fiyat ${cashFmt(minP)} - ${cashFmt(maxP)} arasında olmalı`, 'error');
  }
  if (qty <= 0) return toast('Geçersiz miktar', 'error');

  // Stoktan düş
  const ok = await consumeStock(GZ.uid, itemKey, qty);
  if (!ok) return toast('Yeterli stok yok', 'error');

  const listingId = 'pl_' + Date.now().toString(36) + Math.random().toString(36).slice(2,5);
  await dbSet(`playerMarket/${listingId}`, {
    id: listingId,
    sellerUid: GZ.uid,
    sellerName: GZ.data?.username,
    item: itemKey,
    qty,
    remaining: qty,
    price,
    isPublic,
    createdAt: now(),
    sold: 0
  });
  toast(`${item.emo} ${item.name} satışa çıkarıldı!`, 'success');
  await pushNotif(GZ.uid, `📦 ${qty} ${item.unit} ${item.name} — ${cashFmt(price)}/${item.unit} fiyatıyla satışa çıktı`);
}
window.listPlayerItem = listPlayerItem;

// Oyuncu ilanı iptal eder — kalan stok geri döner
async function cancelPlayerListing(listingId){
  const listing = await dbGet(`playerMarket/${listingId}`);
  if (!listing) return toast('İlan bulunamadı', 'error');
  if (listing.sellerUid !== GZ.uid) return toast('Bu ilan sana ait değil', 'error');
  if (listing.remaining > 0){
    await addStock(GZ.uid, listing.item, listing.remaining, 'mainWarehouse');
  }
  await db.ref(`playerMarket/${listingId}`).remove();
  toast('İlan kaldırıldı, stok geri eklendi', 'success');
}
window.cancelPlayerListing = cancelPlayerListing;

// Oyuncu ilanından satın alır
async function buyFromPlayerMarket(listingId, qty){
  if (!qty || qty <= 0 || !isFinite(qty)) return toast('Geçersiz miktar', 'error');
  qty = Math.floor(qty);

  // ── BUG FIX: KRİTİK EXPLOIT — Atomic transaction ile pazar satışı ──
  // Eskiden: 2 oyuncu aynı listing'i aynı anda alabilirdi → para çift gidiyordu!
  let listingSnapshot = null;
  let actualQty = 0;
  let totalPrice = 0;
  let aborted = false;
  let abortReason = '';

  await db.ref(`playerMarket/${listingId}`).transaction(listing => {
    if (!listing) { aborted = true; abortReason = 'İlan artık mevcut değil'; return; }
    if (!listing.isPublic && listing.sellerUid !== GZ.uid) { aborted = true; abortReason = 'Bu ilan gizli'; return; }
    if (listing.sellerUid === GZ.uid) { aborted = true; abortReason = 'Kendi ilanını alamazsın'; return; }
    if (qty > listing.remaining) { aborted = true; abortReason = `Maksimum ${listing.remaining} alabilirsin`; return; }

    listingSnapshot = listing;
    actualQty = qty;
    totalPrice = +(qty * listing.price).toFixed(2);

    const newRemaining = listing.remaining - qty;
    if (newRemaining <= 0) {
      return null; // İlanı sil
    }
    return {
      ...listing,
      remaining: newRemaining,
      sold: (listing.sold || 0) + qty
    };
  });

  if (aborted) return toast(abortReason, 'error');
  if (!listingSnapshot) return toast('İlan işlenemedi', 'error');

  // Para öde (transaction başarılı, listing kilitlendi)
  const ok = await spendCash(GZ.uid, totalPrice, 'player-market-buy');
  if (!ok) {
    // Para çekilemediyse listing'i geri yükle
    await db.ref(`playerMarket/${listingId}`).transaction(cur => {
      if (!cur) return { ...listingSnapshot };
      return { ...cur, remaining: (cur.remaining || 0) + actualQty, sold: Math.max(0, (cur.sold || 0) - actualQty) };
    });
    return toast('Yetersiz bakiye', 'error');
  }

  // Stoğu alıcıya ver
  await addStock(GZ.uid, listingSnapshot.item, actualQty, 'mainWarehouse');

  // Komisyon ve satıcı ödemesi
  const commission = +(totalPrice * 0.02).toFixed(2);
  const sellerEarning = +(totalPrice - commission).toFixed(2);
  await addCash(listingSnapshot.sellerUid, sellerEarning, 'player-market-sale');
  await addXP(GZ.uid, Math.floor(actualQty * URUNLER[listingSnapshot.item].base / 100));

  toast(`✅ ${actualQty} ${URUNLER[listingSnapshot.item].unit} ${URUNLER[listingSnapshot.item].name} satın alındı (${cashFmt(totalPrice)})`, 'success');
  await pushNotif(listingSnapshot.sellerUid,
    `💰 ${GZ.data?.username}, ${actualQty} ${URUNLER[listingSnapshot.item].unit} ${URUNLER[listingSnapshot.item].name} aldı (+${cashFmt(sellerEarning)})`);

  // Günlük görev
  if (typeof updateDailyTask === 'function') await updateDailyTask('trade_1', 1);
}
window.buyFromPlayerMarket = buyFromPlayerMarket;

/* ============================================================
   VERGİ & MAAŞ — Pazar Günü Otomatik Kesinti
   Cumartesi günü geldiğinde sistem maaş ve vergiyi keser
   ============================================================ */
async function processTaxAndSalaryIfDue(){
  const bank=(await dbGet('bank/'+GZ.uid))||{};
  const t=now();
  const isSaturday=new Date(t).getDay()===6;
  if(!isSaturday||t<=(bank.nextSalary||0)) return;
  const merkez=await dbGet('system/authorityUid');
  const lv = GZ.data?.level || 1;

  // ── YENİ OYUNCU KORUMASI: İlk 7 gün (168 saat) ve Lv<5 ise vergi %80 indirimli ──
  const accountAge = t - (GZ.data?.createdAt || t);
  const isNewPlayer = accountAge < 7*24*3600*1000 || lv < 5;
  const newPlayerDiscount = isNewPlayer ? 0.20 : 1.0; // Yeni oyuncu sadece %20 öder

  const employees=await countEmployees(GZ.uid);
  const salary=employees*350*newPlayerDiscount;
  const shops=await dbGet('businesses/'+GZ.uid+'/shops')||{};
  const gardens=await dbGet('businesses/'+GZ.uid+'/gardens')||{};
  const farms=await dbGet('businesses/'+GZ.uid+'/farms')||{};
  const factories=await dbGet('businesses/'+GZ.uid+'/factories')||{};
  const mines=await dbGet('businesses/'+GZ.uid+'/mines')||{};
  const bizCount=Object.keys(shops).length+Object.keys(gardens).length+Object.keys(farms).length+Object.keys(factories).length+Object.keys(mines).length;

  // İşletme gideri: Lv'ye ve işletme sayısına göre ölçeklenir
  // Lv 1-10: 200₺/işletme, Lv 11-25: 500₺, Lv 26+: 1000₺
  const expensePerBiz = lv <= 10 ? 200 : lv <= 25 ? 500 : 1000;
  const expense=bizCount*expensePerBiz*newPlayerDiscount;

  // DB'den vergi oranlarını al (admin tarafından düzenlenebilir)
  const mbRates=(await dbGet('system/merkezBankasi'))||{};

  // Vergi tabanı: Lv'ye göre ölçeklenir
  const taxMultiplier = Math.max(0.1, Math.min(1.0, lv / 20)); // Lv 1=0.05x, Lv20=1.0x
  const shopTax=Object.keys(shops).length*(mbRates.rates_shopTax||500)*taxMultiplier*newPlayerDiscount;
  const gardenTax=Object.keys(gardens).length*(mbRates.rates_gardenTax||300)*taxMultiplier*newPlayerDiscount;
  const farmTax=Object.keys(farms).length*(mbRates.rates_farmTax||300)*taxMultiplier*newPlayerDiscount;
  const factoryTax=Object.keys(factories).length*(mbRates.rates_factoryTax||800)*taxMultiplier*newPlayerDiscount;
  const mineTax=Object.keys(mines).length*(mbRates.rates_mineTax||600)*taxMultiplier*newPlayerDiscount;

  // Gelir vergisi: haftalık gelirin %8'i — ama EN FAZLA haftalık gelirin %25'i kadar toplam ödeme
  const gelirOrani=(mbRates.gelirOrani||8)/100;
  const haftalikGelir = GZ.data?.weeklyRevenue || 0;
  const gelirVer=+(haftalikGelir*gelirOrani).toFixed(2);
  const toplamVergi=shopTax+gardenTax+farmTax+factoryTax+mineTax+gelirVer;

  const dbFaizler=(await dbGet('system/bankFaizler'))||{};
  const loanBankId=bank.loanBankId||'ziraat';
  const bankaFaiz=dbFaizler[loanBankId]||(window.BANKALAR_MAP?.[loanBankId]?.faiz||0.032);
  const weeklyFaiz=bank.loan>0?+(bank.loan*bankaFaiz/52).toFixed(2):0;
  let totalDue=+(salary+expense+toplamVergi+weeklyFaiz).toFixed(2);

  // GÜVENLİK: Toplam ödeme, haftalık gelirin %40'ını geçemesin (yeni oyunculara insaf)
  // GÜVENLİK: 0 gelirli oyuncudan minimum kesim, gelirliden makul oran
  const maxPayment = isNewPlayer
    ? Math.max(100, Math.min(totalDue, haftalikGelir > 0 ? haftalikGelir * 0.25 : 100))
    : Math.min(totalDue, haftalikGelir > 0 ? haftalikGelir * 0.35 : totalDue);
  if (totalDue > maxPayment) totalDue = +maxPayment.toFixed(2);

  if(totalDue>0){
    const ok=await spendCash(GZ.uid,totalDue,'weekly-payment');
    if(ok){
      if(merkez&&(toplamVergi+weeklyFaiz)>0){
        await db.ref('users/'+merkez+'/money').transaction(c=>(c||0)+toplamVergi+weeklyFaiz);
        await db.ref('system/merkezBankasi/totalVergi').transaction(c=>(c||0)+toplamVergi);
        await db.ref('system/merkezBankasi/totalFaiz').transaction(c=>(c||0)+weeklyFaiz);
        await db.ref('system/merkezBankasi/vergiLog').push({uid:GZ.uid,username:GZ.data?.username||GZ.uid,vergi:toplamVergi,faiz:weeklyFaiz,detay:{shopTax,gardenTax,farmTax,factoryTax,mineTax,gelirVer},ts:firebase.database.ServerValue.TIMESTAMP});
      }
      let msg='📅 Haftalık Kesinti'+(isNewPlayer?' (Yeni Oyuncu İndirimi ✨)':'')+' :\n';
      if(salary>0) msg+='👔 Maaş: '+cashFmt(salary)+'\n';
      if(expense>0) msg+='🏭 İşletme: '+cashFmt(expense)+'\n';
      if(toplamVergi>0) msg+='🏛️ Vergi: '+cashFmt(toplamVergi)+'\n';
      if(weeklyFaiz>0) msg+='💳 Faiz: '+cashFmt(weeklyFaiz)+'\n';
      msg+='💸 Toplam: '+cashFmt(totalDue);
      await pushNotif(GZ.uid,msg,'📅','weekly');
    } else {
      // Para yetmediyse daha küçük tutarı dene
      const half = Math.floor(totalDue * 0.5);
      const okHalf = half > 0 && await spendCash(GZ.uid, half, 'weekly-payment-partial');
      if (!okHalf) {
        const addedLoan = Math.min(totalDue, 5000); // En fazla 5000₺ kredi ekle
        await db.ref('bank/'+GZ.uid+'/loan').transaction(c=>(c||0)+addedLoan);
        if(typeof window.updateKrediNotu==='function') await window.updateKrediNotu(GZ.uid,-3,'Haftalık ödeme başarısız');
        await pushNotif(GZ.uid,'⚠️ Haftalık ödeme yapılamadı. '+cashFmt(addedLoan)+' kredi olarak eklendi. Kredi notun -3.','⚠️','weekly_fail');
      }
    }
    await dbUpdate('users/'+GZ.uid,{weeklyRevenue:0});
  }
  const nextSat=new Date(t);
  nextSat.setDate(nextSat.getDate()+(7-nextSat.getDay()+6)%7||7);
  nextSat.setHours(0,0,0,0);
  await dbUpdate('bank/'+GZ.uid,{nextSalary:nextSat.getTime(),nextBusinessExpense:nextSat.getTime()});
}
window.processTaxAndSalaryIfDue=processTaxAndSalaryIfDue;

/* ============================================================
   BAŞARIMLAR SİSTEMİ
   ============================================================ */
const ACHIEVEMENTS = [
  { id:'first_sale',     name:'İlk Satış',        emo:'🎉', desc:'İlk ürününü sat',                  xp:100 },
  { id:'merchant_1',    name:'Küçük Tüccar',      emo:'🛒', desc:'1.000 ₺ kazanç',                   xp:200 },
  { id:'merchant_2',    name:'Tüccar',            emo:'💼', desc:'100.000 ₺ kazanç',                 xp:500 },
  { id:'merchant_3',    name:'Büyük Tüccar',      emo:'💰', desc:'1.000.000 ₺ kazanç',               xp:1500 },
  { id:'shop_5',        name:'Dükkan Zinciri',    emo:'🏪', desc:'5 dükkan aç',                      xp:400 },
  { id:'crypto_win',    name:'Kripto Zengini',    emo:'📈', desc:'Kripto\'dan 50.000 ₺ kazan',       xp:300 },
  { id:'export_10',     name:'İhracatçı',         emo:'🚢', desc:'10 ihracat işlemi',                xp:350 },
  { id:'harvest_100',   name:'Çiftçi',            emo:'🌾', desc:'100 hasat yap',                    xp:250 },
  { id:'lv10',          name:'Deneyimli',         emo:'⭐', desc:'Seviye 10\'a ulaş',               xp:600 },
  { id:'lv25',          name:'Usta',              emo:'🌟', desc:'Seviye 25\'e ulaş',               xp:1000 },
  { id:'lv50',          name:'Efsane',            emo:'💫', desc:'Seviye 50\'ye ulaş',              xp:2500 },
  { id:'brand_leader',  name:'Marka Lideri',      emo:'🏢', desc:'Marka kur',                        xp:500 },
  { id:'market_seller', name:'Pazar Satıcısı',    emo:'🏬', desc:'Oyuncu pazarına 10 ilan koy',     xp:300 },
  { id:'rich_1',        name:'Milyoner',          emo:'💎', desc:'Net servet 1.000.000 ₺',           xp:1000 },
  { id:'rich_2',        name:'Milyarder',         emo:'👑', desc:'Net servet 1.000.000.000 ₺',       xp:5000 },
];
window.ACHIEVEMENTS = ACHIEVEMENTS;

async function checkAndGrantAchievement(uid, achievementId){
  const already = await dbGet(`users/${uid}/achievements/${achievementId}`);
  if (already) return;
  const ach = ACHIEVEMENTS.find(a => a.id === achievementId);
  if (!ach) return;
  await dbSet(`users/${uid}/achievements/${achievementId}`, { ts: now() });
  await addXP(uid, ach.xp);
  await pushNotif(uid, `🏅 Başarım kazandın: ${ach.emo} ${ach.name} — +${ach.xp} XP`);
  // Toast göster (eğer bu kullanıcıysa)
  if (uid === GZ.uid) toast(`🏅 ${ach.emo} ${ach.name}!`, 'success');
}
window.checkAndGrantAchievement = checkAndGrantAchievement;

/* ============================================================
   GÜNLÜK GÖREVLER
   ============================================================ */
const DAILY_TASKS = [
  { id:'sell_100', name:'Günlük Satış',       desc:'100 birim herhangi bir ürün sat',      reward:500,   xp:50  },
  { id:'harvest_3',name:'Hasat Ustası',       desc:'3 hasat yap',                          reward:1000,  xp:100 },
  { id:'trade_1',  name:'Tüccar Ruhu',        desc:'Oyuncu pazarından 1 satın al',         reward:750,   xp:75  },
  { id:'chat_5',   name:'Sosyal Kelebek',     desc:'Sohbette 5 mesaj gönder',              reward:200,   xp:30  },
  { id:'crypto_1', name:'Kripto Günü',        desc:'Kripto al veya sat (min 1000 ₺)',      reward:800,   xp:80  },
  { id:'login',    name:'Günlük Giriş',       desc:'Oyuna giriş yap',                      reward:100,   xp:20  },
];
window.DAILY_TASKS = DAILY_TASKS;

async function checkDailyLogin(){
  const today = new Date().toDateString();
  const lastLogin = await dbGet(`users/${GZ.uid}/lastDailyBonus`);
  if (lastLogin === today) return;
  await dbUpdate(`users/${GZ.uid}`, { lastDailyBonus: today });
  await addCash(GZ.uid, 100, 'daily-login');
  await addXP(GZ.uid, 20);
  toast('🎁 Günlük giriş bonusu: +100 ₺ +20 XP', 'success');
  await checkAndGrantAchievement(GZ.uid, 'login');
}
window.checkDailyLogin = checkDailyLogin;

async function updateDailyTask(taskId, increment = 1){
  const today = new Date().toDateString();
  const key = `users/${GZ.uid}/dailyTasks/${today}/${taskId}`;
  const task = DAILY_TASKS.find(t => t.id === taskId);
  if (!task) return;
  const cur = (await dbGet(key)) || { count: 0, done: false };
  if (cur.done) return;
  const newCount = (cur.count || 0) + increment;
  const targets = { sell_100:100, harvest_3:3, trade_1:1, chat_5:5, crypto_1:1, login:1 };
  const target = targets[taskId] || 1;
  if (newCount >= target){
    await dbSet(key, { count: newCount, done: true });
    await addCash(GZ.uid, task.reward, 'daily-task');
    await addXP(GZ.uid, task.xp);
    toast(`✅ Görev tamamlandı: ${task.name} → +${cashFmt(task.reward)} +${task.xp} XP`, 'success');
  } else {
    await dbSet(key, { count: newCount, done: false });
  }
}
window.updateDailyTask = updateDailyTask;


/* ╔══════════════════════════════════════════════════════════════════════════╗
   ║                                                                          ║
   ║   ███████  ██╗   ██╗ █████╗ ██╗  ██╗ ███████  ██╗   ██╗ ███████          ║
   ║      ██╔   ██║   ██║██╔══██╗██║ ██╔╝ ██╔════╝ ██║   ██║ ██╔════          ║
   ║      ██║   ██║   ██║███████║█████╔╝  █████╗   ██║   ██║ █████╗           ║
   ║      ██║   ╚██╗ ██╔╝██╔══██║██╔═██╗  ██╔══╝   ╚██╗ ██╔╝ ██╔══╝           ║
   ║      ██║    ╚████╔╝ ██║  ██║██║  ██╗ ███████╗  ╚████╔╝  ███████          ║
   ║      ╚═╝     ╚═══╝  ╚═╝  ╚═╝╚═╝  ╚═╝ ╚══════╝   ╚═══╝   ╚══════          ║
   ║                                                                          ║
   ║   GAMEZONE ERP — v2.0 EKONOMİ GENİŞLETMESİ                              ║
   ║   ─────────────────────────────────────────────────                     ║
   ║   • BORSA (Hisse Senedi & IPO)                                          ║
   ║   • EMLAK (Arazi/Bina)                                                  ║
   ║   • SİGORTA                                                             ║
   ║   • FRANCHISE                                                           ║
   ║   • ULUSLARARASI TİCARET                                                ║
   ║   • KARABORSA                                                           ║
   ║   • TAHVİL                                                              ║
   ║   • VADELİ İŞLEMLER (Futures)                                           ║
   ║   • HEDGE FONU                                                          ║
   ║   • HAVA DURUMU & MEVSİM & AFET                                         ║
   ║   • ÇALIŞAN YÖNETİMİ                                                    ║
   ║   • AR-GE / TEKNOLOJİ AĞACI                                             ║
   ║   • EĞİTİM MERKEZİ                                                      ║
   ║   • SÖZLEŞME                                                            ║
   ║   • BELEDİYE SEÇİM                                                      ║
   ║   • TİCARET SAVAŞLARI                                                   ║
   ║   • DÜELLO (1v1 ticaret)                                                ║
   ║   • SEFER / KAMPANYA                                                    ║
   ║   • PRESTİJ                                                             ║
   ║   • KOLEKSİYON KARTLARI                                                 ║
   ║   • TR HARİTASI BÖLGE KONTROLÜ                                          ║
   ║   • AVATAR / UNVAN / DEKORASYON                                         ║
   ║                                                                          ║
   ╚══════════════════════════════════════════════════════════════════════════╝ */


/* ════════════════════════════════════════════════════════════════════════════
   ████ 1. BORSA — HİSSE SENEDİ SİSTEMİ
   ──────────────────────────────────────────────────────────────────────────── */

const STOCKS_DATA = [
  { sym:'TKBNK', name:'Türk Bankası A.Ş.',       sector:'finans',  basePrice:142.50, vol:0.025, divRate:0.04, marketCap:8500000000  },
  { sym:'AYPRT', name:'Ayparti Holding',          sector:'sanayi',  basePrice:78.25,  vol:0.030, divRate:0.03, marketCap:5200000000  },
  { sym:'TCMRT', name:'TC Marketler',             sector:'gida',    basePrice:32.80,  vol:0.022, divRate:0.05, marketCap:3100000000  },
  { sym:'ANRJ',  name:'Anadolu Enerji',           sector:'enerji',  basePrice:215.00, vol:0.035, divRate:0.06, marketCap:12800000000 },
  { sym:'GMSAN', name:'Gemi Sanayi A.Ş.',         sector:'sanayi',  basePrice:96.40,  vol:0.040, divRate:0.02, marketCap:4500000000  },
  { sym:'IZAUT', name:'İzmir Otomotiv',           sector:'otomotiv',basePrice:188.75, vol:0.045, divRate:0.025,marketCap:9200000000  },
  { sym:'BURTKS',name:'Bursa Tekstil',            sector:'tekstil', basePrice:54.20,  vol:0.038, divRate:0.04, marketCap:2800000000  },
  { sym:'KSAYL', name:'Kayseri Yapı',             sector:'insaat',  basePrice:41.60,  vol:0.042, divRate:0.035,marketCap:1900000000  },
  { sym:'MRMRD', name:'Marmara Madencilik',       sector:'maden',   basePrice:312.00, vol:0.055, divRate:0.05, marketCap:15400000000 },
  { sym:'IGDTR', name:'IG Türk Telekom',          sector:'iletisim',basePrice:67.90,  vol:0.020, divRate:0.07, marketCap:7300000000  },
  { sym:'ANKLJ', name:'Ankara Lojistik',          sector:'lojistik',basePrice:23.45,  vol:0.028, divRate:0.04, marketCap:1200000000  },
  { sym:'TRGY',  name:'Turkogyat Gıda',           sector:'gida',    basePrice:18.90,  vol:0.025, divRate:0.05, marketCap:850000000   },
  { sym:'ISTHV', name:'İstanbul Havayolları',     sector:'ulasim',  basePrice:175.30, vol:0.060, divRate:0.02, marketCap:8800000000  },
  { sym:'ADNKM', name:'Adana Kimya',              sector:'kimya',   basePrice:89.50,  vol:0.034, divRate:0.045,marketCap:4200000000  },
  { sym:'TZBYL', name:'Trabzon Balık',            sector:'gida',    basePrice:12.75,  vol:0.030, divRate:0.06, marketCap:520000000   },
  { sym:'TKMD',  name:'Türk Medya Grubu',         sector:'medya',   basePrice:45.80,  vol:0.048, divRate:0.025,marketCap:2100000000  },
  { sym:'GZTRP', name:'GameZone Turizm Pazarl.',  sector:'turizm',  basePrice:28.65,  vol:0.052, divRate:0.03, marketCap:1100000000  },
  { sym:'SERKR', name:'Serkan Karakaş Holding',   sector:'holding', basePrice:520.00, vol:0.025, divRate:0.08, marketCap:25000000000 },
  { sym:'RESL',  name:'Resul Investments',        sector:'finans',  basePrice:485.50, vol:0.022, divRate:0.075,marketCap:22000000000 },
  { sym:'GZTECH',name:'GameZone Tech AŞ',         sector:'teknoloji',basePrice:1250.0,vol:0.065, divRate:0.015,marketCap:48000000000 }
];
window.STOCKS_DATA = STOCKS_DATA;

const STOCK_SECTORS = {
  finans:'💰 Finans', sanayi:'🏭 Sanayi', gida:'🍞 Gıda', enerji:'⚡ Enerji',
  otomotiv:'🚗 Otomotiv', tekstil:'🧵 Tekstil', insaat:'🏗️ İnşaat',
  maden:'⛏️ Madencilik', iletisim:'📡 İletişim', lojistik:'🚚 Lojistik',
  ulasim:'✈️ Ulaşım', kimya:'⚗️ Kimya', medya:'📺 Medya',
  turizm:'🏖️ Turizm', holding:'🏛️ Holding', teknoloji:'💻 Teknoloji'
};
window.STOCK_SECTORS = STOCK_SECTORS;

/* Hisse fiyat tick (1 dakikada bir) */
async function tickStockPrices() {
  const lockRef = db.ref('stocks/_tickLock');
  const lockResult = await lockRef.transaction(cur => {
    if (cur && (Date.now() - cur) < 50000) return;
    return Date.now();
  });
  if (!lockResult.committed) return;

  const updates = {};
  for (const stock of STOCKS_DATA) {
    const cur = await dbGet('stocks/prices/' + stock.sym + '/current') || stock.basePrice;
    const drift = (Math.random() - 0.5) * stock.vol * 2;
    const trend = Math.sin(Date.now() / 86400000) * 0.005; // günlük dalga
    const newPrice = Math.max(stock.basePrice * 0.3, Math.min(stock.basePrice * 5, cur * (1 + drift + trend)));

    updates['stocks/prices/' + stock.sym + '/current'] = newPrice;
    updates['stocks/prices/' + stock.sym + '/prev'] = cur;
    updates['stocks/prices/' + stock.sym + '/changePct'] = ((newPrice - cur) / cur) * 100;
    updates['stocks/prices/' + stock.sym + '/ts'] = firebase.database.ServerValue.TIMESTAMP;

    // Tarihçe (son 50 nokta)
    await db.ref('stocks/history/' + stock.sym).push({ p: newPrice, t: Date.now() });
  }
  await db.ref().update(updates);

  // History trim
  for (const stock of STOCKS_DATA) {
    const histRef = db.ref('stocks/history/' + stock.sym);
    const histSnap = await histRef.limitToLast(50).once('value');
    const keys = Object.keys(histSnap.val() || {});
    if (keys.length >= 50) {
      const allSnap = await histRef.once('value');
      const allKeys = Object.keys(allSnap.val() || {});
      if (allKeys.length > 50) {
        const removeUpdate = {};
        allKeys.slice(0, allKeys.length - 50).forEach(k => removeUpdate[k] = null);
        await histRef.update(removeUpdate);
      }
    }
  }
}
window.tickStockPrices = tickStockPrices;

/* Hisse al */
async function buyStock(sym, qty) {
  const stock = STOCKS_DATA.find(s => s.sym === sym);
  if (!stock) return { ok:false, msg:'Hisse bulunamadı' };
  if (qty <= 0) return { ok:false, msg:'Miktar pozitif olmalı' };

  const price = await dbGet('stocks/prices/' + sym + '/current') || stock.basePrice;
  const cost = price * qty;
  const commission = cost * 0.002; // %0.2 komisyon
  const total = cost + commission;

  const ok = await spendCash(GZ.uid, total, 'stock_buy');
  if (!ok) return { ok:false, msg:'Yetersiz bakiye' };

  await db.ref('stocks/holdings/' + GZ.uid + '/' + sym).transaction(cur => {
    cur = cur || { qty:0, avgPrice:0, totalCost:0 };
    const newTotalCost = cur.totalCost + cost;
    const newQty = cur.qty + qty;
    return { qty:newQty, avgPrice:newTotalCost/newQty, totalCost:newTotalCost };
  });

  // Merkezi fiyat etkisi: alim fiyati yukselttir
  try {
    const impact = Math.min(0.005, (total / 10000000));
    await db.ref('stocks/prices/' + sym).transaction(p => {
      if (!p || p.locked) return p;
      return { ...p, prev: p.current, current: p.current * (1 + impact), ts: Date.now() };
    });
  } catch(e){}
  // TX LOG
  if (typeof logTx === 'function') logTx('stock-buy', total, { sym, qty });
  return { ok:true, msg:'Alindi! Komisyon: ₺' + commission.toFixed(2), price, qty };
}
window.buyStock = buyStock;

/* Hisse sat */
async function sellStock(sym, qty) {
  const stock = STOCKS_DATA.find(s => s.sym === sym);
  if (!stock) return { ok:false, msg:'Hisse bulunamadı' };

  const holding = await dbGet('stocks/holdings/' + GZ.uid + '/' + sym);
  if (!holding || holding.qty < qty) return { ok:false, msg:'Yetersiz hisse' };

  const price = await dbGet('stocks/prices/' + sym + '/current') || stock.basePrice;
  const revenue = price * qty;
  const commission = revenue * 0.002;
  const tax = (price > holding.avgPrice) ? (revenue - holding.avgPrice * qty) * 0.10 : 0; // %10 sermaye kazancı vergisi
  const net = revenue - commission - tax;

  await addCash(GZ.uid, net, 'stock_sell');

  await db.ref('stocks/holdings/' + GZ.uid + '/' + sym).transaction(cur => {
    if (!cur) return null;
    const newQty = cur.qty - qty;
    if (newQty <= 0) return null;
    return { qty:newQty, avgPrice:cur.avgPrice, totalCost:cur.avgPrice * newQty };
  });

  // Merkezi fiyat etkisi: satis fiyati dussun
  try {
    const impact = Math.min(0.005, (revenue / 10000000));
    await db.ref('stocks/prices/' + sym).transaction(p => {
      if (!p || p.locked) return p;
      const newP = Math.max(p.current * (1 - impact), stock.basePrice * 0.05);
      return { ...p, prev: p.current, current: newP, ts: Date.now() };
    });
  } catch(e){}
  // TX LOG
  if (typeof logTx === 'function') logTx('stock-sell', net, { sym, qty });
  return { ok:true, msg:'Satildi! Net: ₺'+net.toFixed(2)+' (Komisyon: ₺'+commission.toFixed(2)+', Vergi: ₺'+tax.toFixed(2)+')', price, qty };
}
window.sellStock = sellStock;

/* Temettü dağıtımı (her hafta otomatik) */
async function distributeDividends() {
  const lastRef = db.ref('stocks/_lastDividend');
  const lastResult = await lastRef.transaction(cur => {
    if (cur && (Date.now() - cur) < 7 * 24 * 3600 * 1000 - 60000) return;
    return Date.now();
  });
  if (!lastResult.committed) return;

  const allHoldings = await dbGet('stocks/holdings') || {};
  for (const uid of Object.keys(allHoldings)) {
    let totalDiv = 0;
    for (const sym of Object.keys(allHoldings[uid])) {
      const stock = STOCKS_DATA.find(s => s.sym === sym);
      if (!stock) continue;
      const holding = allHoldings[uid][sym];
      const price = await dbGet('stocks/prices/' + sym + '/current') || stock.basePrice;
      const yearlyDiv = price * stock.divRate;
      const weeklyDiv = (yearlyDiv / 52) * holding.qty;
      totalDiv += weeklyDiv;
    }
    if (totalDiv > 0) {
      await addCash(uid, totalDiv, 'dividend');
      await db.ref('stocks/dividends/' + uid).push({
        amount: totalDiv,
        ts: firebase.database.ServerValue.TIMESTAMP
      });
      await db.ref('notifs/' + uid).push({
        type:'dividend', icon:'💰',
        msg:`📊 Temettü ödemesi: ₺${totalDiv.toFixed(2)}`,
        ts: firebase.database.ServerValue.TIMESTAMP, read:false
      });
    }
  }
}
window.distributeDividends = distributeDividends;

/* IPO oluşturma — Kullanıcı kendi şirketini halka açar */
async function createIPO(companyName, totalShares, sharePrice) {
  if (totalShares < 1000 || totalShares > 1000000) return { ok:false, msg:'Hisse: 1000-1.000.000 arası' };
  if (sharePrice < 1 || sharePrice > 1000) return { ok:false, msg:'Fiyat: 1-1000 ₺ arası' };

  const userData = GZ.data;
  if ((userData.level || 1) < 25) return { ok:false, msg:'Min. 25 seviye gerekli (IPO)' };
  if ((userData.netWorth || 0) < 500000) return { ok:false, msg:'Min. 500.000₺ servet gerekli' };

  const fee = totalShares * sharePrice * 0.05; // %5 listeleme ücreti
  const ok = await spendCash(GZ.uid, fee, 'ipo_fee');
  if (!ok) return { ok:false, msg:'Yetersiz bakiye (Listeleme ücreti: ₺' + fee.toFixed(0) + ')' };

  const sym = (userData.username || 'USR').slice(0, 5).toUpperCase();
  const ipoData = {
    sym, founderUid: GZ.uid, companyName,
    totalShares, sharePrice,
    sharesAvailable: totalShares,
    listedAt: firebase.database.ServerValue.TIMESTAMP,
    status: 'open',
    expiresAt: Date.now() + 7 * 24 * 3600 * 1000
  };
  const newRef = await db.ref('stocks/ipos').push(ipoData);
  return { ok:true, ipoId: newRef.key, sym };
}
window.createIPO = createIPO;


/* ════════════════════════════════════════════════════════════════════════════
   ████ 2. EMLAK SİSTEMİ
   ──────────────────────────────────────────────────────────────────────────── */

const EMLAK_TIPLERI = [
  { type:'arsa_kucuk',   name:'Küçük Arsa',           emo:'🟫', basePrice:50000,    rentMin:0,    rentMax:0,    growth:0.02,  buildable:true,  desc:'İmar izinli, küçük arsa' },
  { type:'arsa_orta',    name:'Orta Arsa',            emo:'🟫', basePrice:250000,   rentMin:0,    rentMax:0,    growth:0.025, buildable:true,  desc:'İmar izinli, orta arsa' },
  { type:'arsa_buyuk',   name:'Büyük Arsa',           emo:'🟫', basePrice:1500000,  rentMin:0,    rentMax:0,    growth:0.03,  buildable:true,  desc:'İmar izinli, büyük arsa' },
  { type:'tarla',        name:'Tarım Arazisi',        emo:'🌾', basePrice:120000,   rentMin:800,  rentMax:2000, growth:0.015, buildable:false, desc:'Bahçe/çiftlik kapasitesi +1' },
  { type:'daire_1',      name:'1+1 Daire',            emo:'🏠', basePrice:380000,   rentMin:2500, rentMax:5500, growth:0.04,  buildable:false, desc:'Aylık kira geliri' },
  { type:'daire_2',      name:'2+1 Daire',            emo:'🏠', basePrice:680000,   rentMin:4500, rentMax:9500, growth:0.04,  buildable:false, desc:'Aylık kira geliri' },
  { type:'daire_3',      name:'3+1 Daire',            emo:'🏘️', basePrice:1200000,  rentMin:7500, rentMax:14500,growth:0.045, buildable:false, desc:'Aylık kira geliri' },
  { type:'villa',        name:'Lüks Villa',           emo:'🏖️', basePrice:5500000,  rentMin:25000,rentMax:55000,growth:0.05,  buildable:false, desc:'Premium kira' },
  { type:'plaza',        name:'Ofis Plaza Katı',      emo:'🏢', basePrice:8500000,  rentMin:35000,rentMax:75000,growth:0.06,  buildable:false, desc:'Aylık ofis kira' },
  { type:'avm_dukkan',   name:'AVM Dükkanı',          emo:'🛍️', basePrice:3500000,  rentMin:15000,rentMax:38000,growth:0.05,  buildable:false, desc:'Reyon kapasitesi +2' },
  { type:'fabrika_arsa', name:'Sanayi Bölgesi Arsa',  emo:'🏭', basePrice:2500000,  rentMin:0,    rentMax:0,    growth:0.035, buildable:true,  desc:'Fabrika kapasitesi +1' },
  { type:'maden_sahasi', name:'Maden Sahası',         emo:'⛰️', basePrice:15000000, rentMin:0,    rentMax:0,    growth:0.08,  buildable:false, desc:'Maden kapasitesi +1 (Lv 30)' },
  { type:'sahil_arazi',  name:'Sahil Arazi',          emo:'🏝️', basePrice:25000000, rentMin:80000,rentMax:200000,growth:0.10, buildable:true,  desc:'Turizm yatırımı, çok değerli' },
];
window.EMLAK_TIPLERI = EMLAK_TIPLERI;

/* Emlak satın al */
async function buyProperty(typeId, cityName) {
  const tip = EMLAK_TIPLERI.find(t => t.type === typeId);
  if (!tip) return { ok:false, msg:'Emlak tipi bulunamadı' };

  // Şehir çarpanı: İstanbul %150, Ankara %120, İzmir %110, diğer %100
  let cityMult = 1.0;
  if (cityName === 'İstanbul') cityMult = 1.5;
  else if (cityName === 'Ankara' || cityName === 'İzmir') cityMult = 1.2;
  else if (['Bursa','Antalya','Adana','Gaziantep'].includes(cityName)) cityMult = 1.1;

  const price = Math.floor(tip.basePrice * cityMult);
  const ok = await spendCash(GZ.uid, price, 'realestate_buy');
  if (!ok) return { ok:false, msg:`Yetersiz bakiye (₺${price.toLocaleString('tr-TR')})` };

  const propId = 'p_' + Date.now() + '_' + Math.floor(Math.random()*9999);
  const property = {
    id: propId, type: typeId, city: cityName, owner: GZ.uid,
    purchasePrice: price, currentValue: price,
    rentMin: Math.floor(tip.rentMin * cityMult), rentMax: Math.floor(tip.rentMax * cityMult),
    rented: false, tenantName: null, monthlyRent: 0,
    purchasedAt: firebase.database.ServerValue.TIMESTAMP,
    nextRentDate: Date.now() + 30 * 24 * 3600 * 1000,
    buildings: []
  };
  await db.ref('realestate/owned/' + GZ.uid + '/' + propId).set(property);
  return { ok:true, propId, price };
}
window.buyProperty = buyProperty;

/* Emlak sat (mevcut değerin %95'iyle - %5 komisyon) */
async function sellProperty(propId) {
  const prop = await dbGet('realestate/owned/' + GZ.uid + '/' + propId);
  if (!prop) return { ok:false, msg:'Emlak bulunamadı' };
  const sellPrice = Math.floor(prop.currentValue * 0.95);
  await addCash(GZ.uid, sellPrice, 'realestate_sell');
  await db.ref('realestate/owned/' + GZ.uid + '/' + propId).remove();
  return { ok:true, sellPrice };
}
window.sellProperty = sellProperty;

/* Kiracı bul (NPC, otomatik) */
async function findTenant(propId) {
  const prop = await dbGet('realestate/owned/' + GZ.uid + '/' + propId);
  if (!prop) return { ok:false, msg:'Emlak bulunamadı' };
  if (prop.rented) return { ok:false, msg:'Zaten kiracı var' };
  if (prop.rentMax === 0) return { ok:false, msg:'Bu emlak kiraya verilemez (arsa)' };

  const rent = Math.floor(prop.rentMin + Math.random() * (prop.rentMax - prop.rentMin));
  const tenantNames = ['Mehmet Yılmaz','Ayşe Demir','Mustafa Kaya','Fatma Şahin','Ali Çelik','Zeynep Arslan',
                       'Hüseyin Öztürk','Hatice Yıldız','Ahmet Aydın','Emine Polat','İbrahim Doğan','Elif Çetin'];
  const tenant = tenantNames[Math.floor(Math.random() * tenantNames.length)];

  await db.ref('realestate/owned/' + GZ.uid + '/' + propId).update({
    rented: true, tenantName: tenant, monthlyRent: rent,
    rentStartDate: Date.now()
  });
  return { ok:true, rent, tenant };
}
window.findTenant = findTenant;

/* Bina inşa et */
const INSAAT_TIPLERI = [
  { code:'fabrika',  name:'Fabrika Binası',     cost:1500000, days:14, output:'fabrika kapasitesi +2' },
  { code:'depo',     name:'Depo Binası',        cost:800000,  days:7,  output:'lojistik depo +500m³' },
  { code:'avm',      name:'Mini AVM',           cost:5500000, days:30, output:'reyon kapasitesi +5' },
  { code:'apt',      name:'Apartman (10 daire)',cost:3500000, days:45, output:'10 kira birimi (her ay)' },
  { code:'otel',     name:'Otel (40 oda)',      cost:8500000, days:60, output:'turizm geliri günlük' }
];
window.INSAAT_TIPLERI = INSAAT_TIPLERI;

async function startConstruction(propId, buildCode) {
  const prop = await dbGet('realestate/owned/' + GZ.uid + '/' + propId);
  if (!prop) return { ok:false, msg:'Emlak yok' };
  const tip = EMLAK_TIPLERI.find(t => t.type === prop.type);
  if (!tip || !tip.buildable) return { ok:false, msg:'Bu emlağa inşaat yapılamaz' };
  const build = INSAAT_TIPLERI.find(b => b.code === buildCode);
  if (!build) return { ok:false, msg:'İnşaat tipi yok' };

  const ok = await spendCash(GZ.uid, build.cost, 'construction');
  if (!ok) return { ok:false, msg:'Yetersiz bakiye' };

  const construction = {
    id: 'c_' + Date.now(),
    propId, buildCode, buildName: build.name,
    startedAt: Date.now(),
    completesAt: Date.now() + build.days * 24 * 3600 * 1000,
    status: 'in_progress'
  };
  await db.ref('realestate/constructions/' + GZ.uid).push(construction);
  return { ok:true };
}
window.startConstruction = startConstruction;


/* ════════════════════════════════════════════════════════════════════════════
   ████ 3. SİGORTA SİSTEMİ
   ──────────────────────────────────────────────────────────────────────────── */

const INSURANCE_TYPES = {
  'tesis': {
    name:'🏭 Tesis Sigortası',
    coverPct: [0.5, 0.7, 0.9, 1.0],          // teminat oranı (kademeli)
    premiumPct:[0.005, 0.008, 0.012, 0.020], // aylık prim (varlık değerinin yüzdesi)
    risks:['yangın','sel','deprem','sabotaj']
  },
  'urun': {
    name:'📦 Ürün Stok Sigortası',
    coverPct: [0.4, 0.6, 0.8],
    premiumPct:[0.003, 0.006, 0.012],
    risks:['hasar','hırsızlık','bozulma']
  },
  'arac': {
    name:'🚛 Lojistik Araç Sigortası',
    coverPct: [0.5, 0.75, 1.0],
    premiumPct:[0.008, 0.014, 0.025],
    risks:['kaza','hırsızlık','arıza']
  },
  'emlak': {
    name:'🏘️ Emlak Sigortası',
    coverPct: [0.6, 0.85, 1.0],
    premiumPct:[0.004, 0.007, 0.012],
    risks:['deprem','yangın','sel']
  },
  'kasko': {
    name:'🚗 Kasko (Genel)',
    coverPct: [0.7, 0.9, 1.0],
    premiumPct:[0.010, 0.018, 0.030],
    risks:['her şey']
  }
};
window.INSURANCE_TYPES = INSURANCE_TYPES;

async function buyInsurance(typeKey, tier, assetValue, assetRef) {
  const cfg = INSURANCE_TYPES[typeKey];
  if (!cfg) return { ok:false, msg:'Sigorta tipi yok' };
  if (tier < 0 || tier >= cfg.coverPct.length) return { ok:false, msg:'Geçersiz kademe' };
  if (assetValue <= 0) return { ok:false, msg:'Varlık değeri pozitif olmalı' };

  const monthlyPremium = Math.floor(assetValue * cfg.premiumPct[tier]);
  const ok = await spendCash(GZ.uid, monthlyPremium, 'insurance_premium');
  if (!ok) return { ok:false, msg:'Yetersiz bakiye (Prim: ₺'+monthlyPremium.toLocaleString('tr-TR')+')' };

  const policy = {
    id: 'pol_' + Date.now(),
    typeKey, type: cfg.name, tier,
    coverPct: cfg.coverPct[tier],
    coverage: Math.floor(assetValue * cfg.coverPct[tier]),
    premium: monthlyPremium,
    assetValue, assetRef: assetRef || null,
    startDate: Date.now(),
    nextPremiumDate: Date.now() + 30 * 24 * 3600 * 1000,
    status: 'active',
    claims: 0
  };
  await db.ref('insurance/policies/' + GZ.uid).push(policy);
  return { ok:true, policy };
}
window.buyInsurance = buyInsurance;

async function fileInsuranceClaim(policyId, lossAmount, reason) {
  const policiesSnap = await db.ref('insurance/policies/' + GZ.uid).once('value');
  const policies = policiesSnap.val() || {};
  const polKey = Object.keys(policies).find(k => policies[k].id === policyId);
  if (!polKey) return { ok:false, msg:'Poliçe yok' };
  const pol = policies[polKey];
  if (pol.status !== 'active') return { ok:false, msg:'Poliçe pasif' };

  // Hasar / kapsam değerlendirmesi
  const payout = Math.min(lossAmount * pol.coverPct, pol.coverage);
  const deductible = payout * 0.10; // %10 muafiyet
  const finalPayout = Math.max(0, payout - deductible);

  // %15 ihtimalle red (gerçekçilik)
  if (Math.random() < 0.15) {
    await db.ref('insurance/claims/' + GZ.uid).push({
      policyId, lossAmount, reason, status:'denied',
      ts: firebase.database.ServerValue.TIMESTAMP
    });
    return { ok:false, msg:'❌ Talep reddedildi (sigorta uzmanı incelemesi)' };
  }

  await addCash(GZ.uid, finalPayout, 'insurance_claim');
  await db.ref('insurance/claims/' + GZ.uid).push({
    policyId, lossAmount, reason, status:'approved', payout: finalPayout,
    ts: firebase.database.ServerValue.TIMESTAMP
  });

  // Prim artırımı (claim sonrası %20 artış)
  await db.ref('insurance/policies/' + GZ.uid + '/' + polKey).update({
    premium: Math.floor(pol.premium * 1.2),
    claims: (pol.claims || 0) + 1
  });

  return { ok:true, payout: finalPayout };
}
window.fileInsuranceClaim = fileInsuranceClaim;


/* ════════════════════════════════════════════════════════════════════════════
   ████ 4. FRANCHISE SİSTEMİ
   ──────────────────────────────────────────────────────────────────────────── */

async function createFranchiseOffer(brandName, royaltyPct, initialFee, productType) {
  if (royaltyPct < 5 || royaltyPct > 30) return { ok:false, msg:'Royalty %5-30 arası' };
  if (initialFee < 10000) return { ok:false, msg:'Min başlangıç ücreti ₺10.000' };
  if ((GZ.data?.level||1) < 20) return { ok:false, msg:'Min Lv 20 gerekli' };

  const offer = {
    id: 'fr_' + Date.now(),
    ownerUid: GZ.uid,
    ownerName: GZ.data?.username,
    brandName, royaltyPct, initialFee, productType,
    description: '',
    createdAt: firebase.database.ServerValue.TIMESTAMP,
    activeFranchisees: 0,
    status: 'open'
  };
  await db.ref('franchise/offers').push(offer);
  return { ok:true, offer };
}
window.createFranchiseOffer = createFranchiseOffer;

async function buyFranchise(offerKey) {
  const offer = await dbGet('franchise/offers/' + offerKey);
  if (!offer) return { ok:false, msg:'Teklif yok' };
  if (offer.ownerUid === GZ.uid) return { ok:false, msg:'Kendi franchise\'ını alamazsın' };
  if (offer.status !== 'open') return { ok:false, msg:'Teklif kapalı' };

  const ok = await spendCash(GZ.uid, offer.initialFee, 'franchise_buy');
  if (!ok) return { ok:false, msg:'Yetersiz bakiye' };

  // Sahip kullanıcısı %50'sini alır
  await addCash(offer.ownerUid, Math.floor(offer.initialFee * 0.5), 'franchise_initial');

  const active = {
    id: 'fr_active_' + Date.now(),
    offerKey, offerOwnerUid: offer.ownerUid, offerOwnerName: offer.ownerName,
    franchiseeUid: GZ.uid, franchiseeName: GZ.data?.username,
    brandName: offer.brandName, royaltyPct: offer.royaltyPct,
    productType: offer.productType,
    startedAt: firebase.database.ServerValue.TIMESTAMP,
    totalRevenue: 0, totalRoyaltyPaid: 0
  };
  await db.ref('franchise/active').push(active);
  await db.ref('franchise/offers/' + offerKey + '/activeFranchisees').transaction(c => (c||0) + 1);

  return { ok:true };
}
window.buyFranchise = buyFranchise;


/* ════════════════════════════════════════════════════════════════════════════
   ████ 5. ULUSLARARASI TİCARET
   ──────────────────────────────────────────────────────────────────────────── */

const COUNTRIES = [
  { code:'DE', name:'Almanya',   flag:'🇩🇪', currency:'EUR', rateUsd:1.08, demandMult:1.4, distance:2400, tariff:0.05 },
  { code:'US', name:'ABD',       flag:'🇺🇸', currency:'USD', rateUsd:1.00, demandMult:1.6, distance:8500, tariff:0.08 },
  { code:'GB', name:'İngiltere', flag:'🇬🇧', currency:'GBP', rateUsd:1.27, demandMult:1.3, distance:2900, tariff:0.06 },
  { code:'FR', name:'Fransa',    flag:'🇫🇷', currency:'EUR', rateUsd:1.08, demandMult:1.2, distance:2700, tariff:0.05 },
  { code:'IT', name:'İtalya',    flag:'🇮🇹', currency:'EUR', rateUsd:1.08, demandMult:1.1, distance:1800, tariff:0.04 },
  { code:'NL', name:'Hollanda',  flag:'🇳🇱', currency:'EUR', rateUsd:1.08, demandMult:1.25,distance:2500, tariff:0.05 },
  { code:'CN', name:'Çin',       flag:'🇨🇳', currency:'CNY', rateUsd:0.14, demandMult:0.9, distance:7500, tariff:0.10 },
  { code:'JP', name:'Japonya',   flag:'🇯🇵', currency:'JPY', rateUsd:0.0067,demandMult:1.5,distance:9000, tariff:0.07 },
  { code:'RU', name:'Rusya',     flag:'🇷🇺', currency:'RUB', rateUsd:0.011, demandMult:1.0,distance:2000, tariff:0.12 },
  { code:'SA', name:'S.Arabistan',flag:'🇸🇦',currency:'SAR', rateUsd:0.27, demandMult:1.1, distance:2200, tariff:0.06 }
];
window.COUNTRIES = COUNTRIES;

async function exportInternational(countryCode, productKey, qty) {
  const country = COUNTRIES.find(c => c.code === countryCode);
  if (!country) return { ok:false, msg:'Ülke yok' };
  const product = URUNLER[productKey];
  if (!product) return { ok:false, msg:'Ürün yok' };

  // Stok kontrolü
  const warehouse = await dbGet(`businesses/${GZ.uid}/warehouse/${productKey}`) || 0;
  if (warehouse < qty) return { ok:false, msg:'Yetersiz stok' };

  // Fiyat hesapla
  const usdPrice = product.base / 30; // basit kur (1 USD ≈ 30 TL)
  const localPrice = usdPrice * country.demandMult / country.rateUsd;
  const tlRevenue = localPrice * country.rateUsd * 30 * qty;
  const tariffCost = tlRevenue * country.tariff;
  const shipping = country.distance * 0.5 * qty * (product.unit === 'Kilo' ? 1 : 0.3);
  const netRevenue = tlRevenue - tariffCost - shipping;

  if (netRevenue <= 0) return { ok:false, msg:'Maliyet > Gelir, kar yok!' };

  // Stok düş
  await db.ref(`businesses/${GZ.uid}/warehouse/${productKey}`).transaction(c => Math.max(0, (c||0) - qty));

  // Sevkiyat oluştur (teslimat süreli)
  const shipmentId = 'sh_' + Date.now();
  const days = Math.ceil(country.distance / 800); // 800km/gün
  const shipment = {
    id: shipmentId, country: countryCode, countryName: country.name,
    product: productKey, qty,
    departedAt: Date.now(),
    arrivesAt: Date.now() + days * 24 * 3600 * 1000,
    netRevenue: Math.floor(netRevenue),
    status: 'in_transit'
  };
  await db.ref(`intl_trade/shipments/${GZ.uid}`).push(shipment);

  return { ok:true, shipmentId, days, netRevenue: Math.floor(netRevenue) };
}
window.exportInternational = exportInternational;

async function processIntlShipments() {
  const shipsSnap = await db.ref(`intl_trade/shipments/${GZ.uid}`).once('value');
  const ships = shipsSnap.val() || {};
  for (const key of Object.keys(ships)) {
    const sh = ships[key];
    if (sh.status === 'in_transit' && Date.now() >= sh.arrivesAt) {
      await addCash(GZ.uid, sh.netRevenue, 'intl_export');
      await db.ref(`intl_trade/shipments/${GZ.uid}/${key}/status`).set('delivered');
      await addXP(GZ.uid, 50);
    }
  }
}
window.processIntlShipments = processIntlShipments;


/* ════════════════════════════════════════════════════════════════════════════
   ████ 6. KARABORSA — RİSKLİ TİCARET
   ──────────────────────────────────────────────────────────────────────────── */

const BLACKMARKET_ITEMS = [
  { code:'kacak_sigara', name:'Kaçak Sigara',         emo:'🚬', priceMin:50,    priceMax:120,    risk:0.18, profit:2.5 },
  { code:'sahte_marka',  name:'Sahte Marka Ürün',     emo:'👜', priceMin:300,   priceMax:1500,   risk:0.25, profit:3.0 },
  { code:'antika',       name:'Şüpheli Antika',       emo:'🏺', priceMin:5000,  priceMax:80000,  risk:0.30, profit:4.0 },
  { code:'nadir_para',   name:'Nadir Koleksiyon Para',emo:'🪙', priceMin:1000,  priceMax:25000,  risk:0.20, profit:3.5 },
  { code:'gizli_belge',  name:'Eski Gizli Belge',     emo:'📜', priceMin:2500,  priceMax:50000,  risk:0.35, profit:5.0 },
  { code:'kacak_kahve',  name:'Kaçak Kahve',          emo:'☕', priceMin:200,   priceMax:800,    risk:0.10, profit:2.0 },
  { code:'kayit_disi',   name:'Kayıt Dışı Mücevher',  emo:'💎', priceMin:10000, priceMax:200000, risk:0.40, profit:6.0 },
];
window.BLACKMARKET_ITEMS = BLACKMARKET_ITEMS;

async function blackmarketBuy(itemCode, qty) {
  if ((GZ.data?.level || 1) < 15) return { ok:false, msg:'Min Lv 15 gerekli (karaborsa)' };
  const item = BLACKMARKET_ITEMS.find(i => i.code === itemCode);
  if (!item) return { ok:false, msg:'Mal yok' };

  const price = item.priceMin + Math.random() * (item.priceMax - item.priceMin);
  const total = price * qty;
  const ok = await spendCash(GZ.uid, total, 'blackmarket_buy');
  if (!ok) return { ok:false, msg:'Yetersiz bakiye' };

  // Yakalanma riski (alış sırasında daha düşük)
  if (Math.random() < item.risk * 0.4) {
    // Para gitti, mal yok
    await db.ref(`blackmarket/history/${GZ.uid}`).push({
      action:'caught_buy', item:itemCode, qty, lostAmount:total,
      ts: firebase.database.ServerValue.TIMESTAMP
    });
    // Wanted listesine ekle (bir süre)
    await db.ref(`blackmarket/wanted/${GZ.uid}`).set({
      reason:'illegal_buy', until: Date.now() + 3 * 3600 * 1000,
      level: 1
    });
    return { ok:false, msg:'🚨 YAKALANDIN! Mallar el konuldu, ₺'+total.toFixed(0)+' kayıp.' };
  }

  await db.ref(`blackmarket/inventory/${GZ.uid}/${itemCode}`).transaction(c => (c||0) + qty);
  await db.ref(`blackmarket/history/${GZ.uid}`).push({
    action:'buy', item:itemCode, qty, price, total,
    ts: firebase.database.ServerValue.TIMESTAMP
  });

  return { ok:true, total };
}
window.blackmarketBuy = blackmarketBuy;

async function blackmarketSell(itemCode, qty) {
  const item = BLACKMARKET_ITEMS.find(i => i.code === itemCode);
  if (!item) return { ok:false, msg:'Mal yok' };
  const inv = await dbGet(`blackmarket/inventory/${GZ.uid}/${itemCode}`) || 0;
  if (inv < qty) return { ok:false, msg:'Yetersiz envanter' };

  const sellPrice = (item.priceMin + Math.random() * (item.priceMax - item.priceMin)) * item.profit;
  const total = sellPrice * qty;

  // Yakalanma riski (satışta daha yüksek)
  if (Math.random() < item.risk) {
    await db.ref(`blackmarket/inventory/${GZ.uid}/${itemCode}`).set(0);
    await db.ref(`blackmarket/history/${GZ.uid}`).push({
      action:'caught_sell', item:itemCode, qty,
      ts: firebase.database.ServerValue.TIMESTAMP
    });

    // Para cezası (satılacak değerin %50'si)
    const fine = Math.floor(total * 0.5);
    await spendCash(GZ.uid, fine, 'blackmarket_fine');

    await db.ref(`blackmarket/wanted/${GZ.uid}`).set({
      reason:'illegal_sell', until: Date.now() + 12 * 3600 * 1000,
      level: 2
    });

    return { ok:false, msg:`🚨 YAKALANDIN! ₺${fine.toLocaleString('tr-TR')} ceza, mallar el konuldu.` };
  }

  await db.ref(`blackmarket/inventory/${GZ.uid}/${itemCode}`).transaction(c => Math.max(0, (c||0) - qty));
  await addCash(GZ.uid, total, 'blackmarket_sell');
  await db.ref(`blackmarket/history/${GZ.uid}`).push({
    action:'sell', item:itemCode, qty, price:sellPrice, total,
    ts: firebase.database.ServerValue.TIMESTAMP
  });

  return { ok:true, total };
}
window.blackmarketSell = blackmarketSell;


/* ════════════════════════════════════════════════════════════════════════════
   ████ 7. TAHVİL (BONDS)
   ──────────────────────────────────────────────────────────────────────────── */

const BONDS = [
  { code:'TR_2YR',  name:'Devlet Tahvili 2 Yıl',  emo:'🇹🇷', face:1000,  yieldRate:0.18, term:730,  riskLevel:1, issuer:'Türkiye Hazinesi' },
  { code:'TR_5YR',  name:'Devlet Tahvili 5 Yıl',  emo:'🇹🇷', face:1000,  yieldRate:0.22, term:1825, riskLevel:1, issuer:'Türkiye Hazinesi' },
  { code:'TR_10YR', name:'Devlet Tahvili 10 Yıl', emo:'🇹🇷', face:1000,  yieldRate:0.28, term:3650, riskLevel:1, issuer:'Türkiye Hazinesi' },
  { code:'CORP_A',  name:'Akbank Tahvili',        emo:'🏦', face:5000,  yieldRate:0.32, term:1095, riskLevel:2, issuer:'Türkiye Bankaları' },
  { code:'CORP_B',  name:'Holding Tahvili',       emo:'🏛️', face:10000, yieldRate:0.40, term:730,  riskLevel:3, issuer:'Karakaş Holding' },
  { code:'CORP_C',  name:'Yüksek Getiri (junk)',  emo:'⚠️', face:5000,  yieldRate:0.65, term:365,  riskLevel:5, issuer:'Riskli Şirket A.Ş.' },
];
window.BONDS = BONDS;

async function buyBond(code, qty) {
  const bond = BONDS.find(b => b.code === code);
  if (!bond) return { ok:false, msg:'Tahvil yok' };
  const cost = bond.face * qty;
  const ok = await spendCash(GZ.uid, cost, 'bond_buy');
  if (!ok) return { ok:false, msg:'Yetersiz bakiye' };

  const holding = {
    code, qty, face:bond.face, totalCost:cost,
    purchaseDate: Date.now(),
    maturityDate: Date.now() + bond.term * 24 * 3600 * 1000,
    yieldRate:bond.yieldRate, riskLevel:bond.riskLevel,
    nextCouponDate: Date.now() + 90 * 24 * 3600 * 1000  // 3 ayda bir kupon
  };
  await db.ref(`bonds/holdings/${GZ.uid}`).push(holding);

  return { ok:true, cost };
}
window.buyBond = buyBond;

async function processBondCoupons() {
  const holdSnap = await db.ref(`bonds/holdings/${GZ.uid}`).once('value');
  const hs = holdSnap.val() || {};
  for (const k of Object.keys(hs)) {
    const h = hs[k];
    if (Date.now() >= h.nextCouponDate) {
      // Yıllık getirinin 1/4'ü (3 aylık kupon)
      const coupon = h.face * h.qty * h.yieldRate / 4;

      // Risk: junk bond %3 ihtimalle default
      if (h.riskLevel >= 5 && Math.random() < 0.03) {
        await db.ref(`bonds/holdings/${GZ.uid}/${k}/status`).set('defaulted');
        await db.ref('notifs/' + GZ.uid).push({
          type:'bond_default', icon:'⚠️',
          msg:`⚠️ Tahvil default! ${h.code} ödeme yapamadı.`,
          ts: firebase.database.ServerValue.TIMESTAMP, read:false
        });
        continue;
      }

      await addCash(GZ.uid, coupon, 'bond_coupon');
      await db.ref(`bonds/holdings/${GZ.uid}/${k}/nextCouponDate`).set(Date.now() + 90 * 24 * 3600 * 1000);

      // Vade dolduysa anaparayı geri ver
      if (Date.now() >= h.maturityDate) {
        await addCash(GZ.uid, h.totalCost, 'bond_principal');
        await db.ref(`bonds/holdings/${GZ.uid}/${k}/status`).set('matured');
      }
    }
  }
}
window.processBondCoupons = processBondCoupons;


/* ════════════════════════════════════════════════════════════════════════════
   ████ 8. VADELİ İŞLEMLER (FUTURES)
   ──────────────────────────────────────────────────────────────────────────── */

async function openFuturesPosition(symbol, direction, lotSize, leverage) {
  // direction: 'long' veya 'short'
  // leverage: 1, 2, 5, 10
  if (![1,2,5,10].includes(leverage)) return { ok:false, msg:'Kaldıraç 1/2/5/10' };
  const stock = STOCKS_DATA.find(s => s.sym === symbol);
  if (!stock) return { ok:false, msg:'Sembol yok' };

  const price = await dbGet('stocks/prices/' + symbol + '/current') || stock.basePrice;
  const notional = price * lotSize;
  const margin = notional / leverage;

  const ok = await spendCash(GZ.uid, margin, 'futures_margin');
  if (!ok) return { ok:false, msg:'Yetersiz teminat' };

  const position = {
    id: 'fut_' + Date.now(),
    symbol, direction, lotSize, leverage,
    entryPrice: price, notional, margin,
    openedAt: Date.now(),
    status: 'open',
    expiresAt: Date.now() + 30 * 24 * 3600 * 1000  // 1 ay vade
  };
  await db.ref(`futures/positions/${GZ.uid}`).push(position);
  return { ok:true, position };
}
window.openFuturesPosition = openFuturesPosition;

async function closeFuturesPosition(posKey) {
  const pos = await dbGet(`futures/positions/${GZ.uid}/${posKey}`);
  if (!pos || pos.status !== 'open') return { ok:false, msg:'Pozisyon yok/kapalı' };

  const curPrice = await dbGet('stocks/prices/' + pos.symbol + '/current') || pos.entryPrice;
  const priceDiff = pos.direction === 'long' ? (curPrice - pos.entryPrice) : (pos.entryPrice - curPrice);
  const pnl = priceDiff * pos.lotSize * pos.leverage;
  const finalAmount = pos.margin + pnl;

  // Liquidation: kayıp marginden büyükse pozisyon sıfırlanır
  if (finalAmount <= 0) {
    await db.ref(`futures/positions/${GZ.uid}/${posKey}/status`).set('liquidated');
    return { ok:true, liquidated:true, pnl: -pos.margin };
  }

  await addCash(GZ.uid, finalAmount, 'futures_close');
  await db.ref(`futures/positions/${GZ.uid}/${posKey}`).update({
    status:'closed', exitPrice:curPrice, pnl, closedAt:Date.now()
  });
  return { ok:true, pnl, finalAmount };
}
window.closeFuturesPosition = closeFuturesPosition;


/* ════════════════════════════════════════════════════════════════════════════
   ████ 9. HEDGE FONU
   ──────────────────────────────────────────────────────────────────────────── */

async function createHedgeFund(fundName, mgmtFee, perfFee, minInvest, strategy) {
  if (mgmtFee < 0.005 || mgmtFee > 0.05) return { ok:false, msg:'Yönetim ücreti %0.5-5' };
  if (perfFee < 0.05 || perfFee > 0.30) return { ok:false, msg:'Performans ücreti %5-30' };
  if ((GZ.data?.level||1) < 35) return { ok:false, msg:'Min Lv 35 gerekli' };
  if ((GZ.data?.netWorth||0) < 5000000) return { ok:false, msg:'Min ₺5M servet gerekli' };

  const fund = {
    id: 'hf_' + Date.now(),
    fundName, managerUid: GZ.uid, managerName: GZ.data?.username,
    mgmtFee, perfFee, minInvest,
    strategy: strategy || 'balanced',
    nav: 1.00,
    aum: 0,  // Assets Under Management
    investorCount: 0,
    createdAt: firebase.database.ServerValue.TIMESTAMP,
    status: 'open'
  };
  await db.ref('hedgefunds/list').push(fund);
  return { ok:true, fund };
}
window.createHedgeFund = createHedgeFund;

async function investInHedgeFund(fundKey, amount) {
  const fund = await dbGet('hedgefunds/list/' + fundKey);
  if (!fund) return { ok:false, msg:'Fon yok' };
  if (fund.managerUid === GZ.uid) return { ok:false, msg:'Kendi fonuna yatıramazsın' };
  if (amount < fund.minInvest) return { ok:false, msg:`Min yatırım ₺${fund.minInvest.toLocaleString('tr-TR')}` };

  const ok = await spendCash(GZ.uid, amount, 'hedgefund_invest');
  if (!ok) return { ok:false, msg:'Yetersiz bakiye' };

  // Manager'a anlık olarak yatırım miktarının %1'i ücret olarak akar
  await addCash(fund.managerUid, amount * 0.01, 'hedgefund_setup_fee');

  const shares = amount / fund.nav;
  await db.ref(`hedgefunds/investors/${fundKey}/${GZ.uid}`).transaction(cur => {
    cur = cur || { shares:0, totalInvested:0 };
    return { shares: cur.shares + shares, totalInvested: cur.totalInvested + amount };
  });
  await db.ref(`hedgefunds/list/${fundKey}/aum`).transaction(c => (c||0) + amount * 0.99);
  await db.ref(`hedgefunds/list/${fundKey}/investorCount`).transaction(c => (c||0) + 1);

  return { ok:true, shares };
}
window.investInHedgeFund = investInHedgeFund;


/* ════════════════════════════════════════════════════════════════════════════
   ████ 10. HAVA DURUMU + MEVSİM + AFET SİSTEMİ
   ──────────────────────────────────────────────────────────────────────────── */

const SEASONS = [
  { code:'ilkbahar', name:'İlkbahar', emo:'🌸', months:[3,4,5],   tarımMult:1.20, satışMult:1.05 },
  { code:'yaz',      name:'Yaz',      emo:'☀️', months:[6,7,8],   tarımMult:1.30, satışMult:1.15 },
  { code:'sonbahar', name:'Sonbahar', emo:'🍂', months:[9,10,11], tarımMult:1.10, satışMult:1.00 },
  { code:'kis',      name:'Kış',     emo:'❄️', months:[12,1,2],  tarımMult:0.60, satışMult:1.10 }
];
window.SEASONS = SEASONS;

const WEATHER_TYPES = [
  { code:'gunes',     emo:'☀️', name:'Güneşli',       prod:1.10, prob:0.40 },
  { code:'parcabulutlu',emo:'⛅', name:'Parçalı Bulutlu',prod:1.00, prob:0.20 },
  { code:'bulutlu',   emo:'☁️', name:'Bulutlu',       prod:0.95, prob:0.15 },
  { code:'yagmur',    emo:'🌧️', name:'Yağmurlu',      prod:0.90, prob:0.10 },
  { code:'firtina',   emo:'⛈️', name:'Fırtına',       prod:0.60, prob:0.05 },
  { code:'kar',       emo:'🌨️', name:'Kar',           prod:0.50, prob:0.05 },
  { code:'sicakHava', emo:'🥵', name:'Aşırı Sıcak',   prod:0.70, prob:0.03 },
  { code:'donus',     emo:'🥶', name:'Don Olayı',     prod:0.30, prob:0.02 }
];
window.WEATHER_TYPES = WEATHER_TYPES;

function getCurrentSeason() {
  const m = new Date().getMonth() + 1;
  return SEASONS.find(s => s.months.includes(m)) || SEASONS[0];
}
window.getCurrentSeason = getCurrentSeason;

async function tickWeather() {
  // 6 saatte bir hava değişir
  const lastTick = await dbGet('weather/_lastTick') || 0;
  if (Date.now() - lastTick < 6 * 3600 * 1000) return;

  const lockResult = await db.ref('weather/_lastTick').transaction(c => {
    if (c && Date.now() - c < 6 * 3600 * 1000) return;
    return Date.now();
  });
  if (!lockResult.committed) return;

  // 81 il için ayrı hava
  const cities = window.ILLER || [];
  const updates = {};
  for (const city of cities) {
    const r = Math.random();
    let acc = 0;
    let weather = WEATHER_TYPES[0];
    for (const w of WEATHER_TYPES) {
      acc += w.prob;
      if (r < acc) { weather = w; break; }
    }
    const baseTemp = getBaseTempForCity(city);
    const temp = Math.floor(baseTemp + (Math.random() - 0.5) * 8);

    updates['weather/current/' + city] = {
      code: weather.code, name: weather.name, emo: weather.emo,
      prod: weather.prod, temp, ts: Date.now()
    };
  }
  await db.ref().update(updates);
}
window.tickWeather = tickWeather;

function getBaseTempForCity(city) {
  const m = new Date().getMonth() + 1;
  const isWinter = [12,1,2].includes(m);
  const isSummer = [6,7,8].includes(m);
  // Akdeniz/Ege sıcak, İç/Doğu Anadolu serin
  const sicakIller = ['Antalya','Mersin','Adana','Hatay','Muğla','İzmir','Aydın'];
  const soguk = ['Erzurum','Kars','Ardahan','Ağrı','Bayburt','Sivas','Erzincan'];
  let base = 18;
  if (sicakIller.includes(city)) base = 25;
  else if (soguk.includes(city)) base = 8;
  if (isWinter) base -= 12;
  else if (isSummer) base += 8;
  return base;
}

const DISASTERS = [
  { code:'deprem',  name:'Deprem',  emo:'🌍', prob:0.0008, damage:0.30, regions:['Bolu','İstanbul','Kocaeli','Sakarya','Düzce','Yalova','Hatay','Kahramanmaraş','Malatya','Adıyaman','Elazığ','Van','Bingöl','Erzincan'] },
  { code:'sel',     name:'Sel',     emo:'🌊', prob:0.0015, damage:0.20, regions:['Rize','Trabzon','Giresun','Ordu','Samsun','Sinop','Kastamonu','Bartın','Zonguldak','Artvin'] },
  { code:'yangin',  name:'Orman Yangını',emo:'🔥',prob:0.0020, damage:0.25, regions:['Antalya','Muğla','İzmir','Manisa','Aydın','Çanakkale','Adana','Mersin','Hatay'] },
  { code:'kuraklik',name:'Kuraklık',emo:'🌵', prob:0.0010, damage:0.15, regions:['Konya','Karaman','Aksaray','Niğde','Nevşehir','Şanlıurfa','Diyarbakır','Mardin'] },
  { code:'firtina', name:'Şiddetli Fırtına',emo:'🌪️',prob:0.0025, damage:0.10, regions:[] },  // her yere
];
window.DISASTERS = DISASTERS;

async function checkDisasters() {
  // 1 saatte bir kontrol
  const lastTick = await dbGet('disasters/_lastTick') || 0;
  if (Date.now() - lastTick < 3600 * 1000) return;
  const lockResult = await db.ref('disasters/_lastTick').transaction(c => {
    if (c && Date.now() - c < 3600 * 1000) return;
    return Date.now();
  });
  if (!lockResult.committed) return;

  for (const d of DISASTERS) {
    if (Math.random() < d.prob) {
      // Afet patladı!
      const targetRegions = d.regions.length ? d.regions : (window.ILLER || []);
      const city = targetRegions[Math.floor(Math.random() * targetRegions.length)];
      const disaster = {
        code: d.code, name: d.name, emo: d.emo,
        damage: d.damage, city,
        startedAt: Date.now(),
        endsAt: Date.now() + (4 + Math.random() * 20) * 3600 * 1000,
        affected: 0
      };
      await db.ref('disasters/active').push(disaster);
      await db.ref('disasters/history').push(disaster);

      // Etkilenen kullanıcılara bildirim
      // (Production'da: o şehirde tesisi/emlağı olan kullanıcılara mesaj)
    }
  }
}
window.checkDisasters = checkDisasters;


/* ════════════════════════════════════════════════════════════════════════════
   ████ 11. ÇALIŞAN YÖNETİMİ
   ──────────────────────────────────────────────────────────────────────────── */

const EMPLOYEE_POSITIONS = [
  { code:'isci',         name:'İşçi',                 emo:'👷', minSalary:8500,   maxSalary:14000,  productivityBonus:0.05, skills:['gen'] },
  { code:'usta',         name:'Usta İşçi',           emo:'🛠️', minSalary:14000,  maxSalary:22000,  productivityBonus:0.10, skills:['gen','uretim'] },
  { code:'muhasebeci',   name:'Muhasebeci',          emo:'📊', minSalary:18000,  maxSalary:32000,  productivityBonus:0.08, skills:['finans'] },
  { code:'pazarlamaci',  name:'Pazarlamacı',         emo:'📢', minSalary:16000,  maxSalary:30000,  productivityBonus:0.12, skills:['satis'] },
  { code:'guvenlik',     name:'Güvenlik',            emo:'🛡️', minSalary:11000,  maxSalary:18000,  productivityBonus:0.0,  skills:['guv'], theftReduce:0.5 },
  { code:'muhendis',     name:'Mühendis',            emo:'🔧', minSalary:35000,  maxSalary:60000,  productivityBonus:0.20, skills:['teknik'] },
  { code:'avukat',       name:'Avukat',              emo:'⚖️', minSalary:45000,  maxSalary:90000,  productivityBonus:0.0,  skills:['yasal'], lawsuitReduce:0.7 },
  { code:'CEO_yardimci', name:'CEO Yardımcısı',      emo:'🎩', minSalary:80000,  maxSalary:200000, productivityBonus:0.30, skills:['yonetim'] }
];
window.EMPLOYEE_POSITIONS = EMPLOYEE_POSITIONS;

async function hireEmployee(positionCode, salary) {
  const pos = EMPLOYEE_POSITIONS.find(p => p.code === positionCode);
  if (!pos) return { ok:false, msg:'Pozisyon yok' };
  if (salary < pos.minSalary) return { ok:false, msg:`Min maaş ₺${pos.minSalary.toLocaleString('tr-TR')}` };
  if (salary > pos.maxSalary) return { ok:false, msg:`Max maaş ₺${pos.maxSalary.toLocaleString('tr-TR')}` };

  // İşe alma ücreti (1 maaş)
  const ok = await spendCash(GZ.uid, salary, 'employee_hire');
  if (!ok) return { ok:false, msg:'Yetersiz bakiye (1 maaş peşin)' };

  const names = ['Ahmet Yılmaz','Mehmet Demir','Ayşe Kaya','Fatma Şahin','Mustafa Çelik','Zeynep Arslan',
                 'Ali Öztürk','Hatice Yıldız','Hüseyin Aydın','Emine Polat','İbrahim Doğan','Elif Çetin',
                 'Hasan Kara','Selin Akın','Burak Erdem','Deniz Sözer','Yiğit Korkmaz','Ceren Türk'];
  const surname = ['(deneyimli)','(yetenekli)','(motiveli)','(çalışkan)','(profesyonel)'][Math.floor(Math.random()*5)];

  const employee = {
    id: 'emp_' + Date.now(),
    name: names[Math.floor(Math.random()*names.length)] + ' ' + surname,
    position: positionCode, positionName: pos.name,
    salary, productivityBonus: pos.productivityBonus,
    morale: 70 + Math.floor(Math.random() * 20),  // 70-90
    hiredAt: Date.now(),
    nextSalaryDate: Date.now() + 30 * 24 * 3600 * 1000,
    skills: pos.skills,
    onStrike: false
  };
  await db.ref(`employees/${GZ.uid}`).push(employee);
  return { ok:true, employee };
}
window.hireEmployee = hireEmployee;

async function fireEmployee(empKey) {
  const emp = await dbGet(`employees/${GZ.uid}/${empKey}`);
  if (!emp) return { ok:false, msg:'Çalışan yok' };

  // Tazminat: 2 maaş
  const severance = emp.salary * 2;
  const ok = await spendCash(GZ.uid, severance, 'severance');
  if (!ok) return { ok:false, msg:`Tazminat ₺${severance.toLocaleString('tr-TR')} gerekli` };

  await db.ref(`employees/${GZ.uid}/${empKey}`).remove();
  return { ok:true, severance };
}
window.fireEmployee = fireEmployee;

async function payEmployeeSalaries() {
  const empSnap = await db.ref(`employees/${GZ.uid}`).once('value');
  const emps = empSnap.val() || {};
  let totalPaid = 0;
  for (const k of Object.keys(emps)) {
    const emp = emps[k];
    if (Date.now() < emp.nextSalaryDate) continue;
    const ok = await spendCash(GZ.uid, emp.salary, 'salary');
    if (!ok) {
      // Maaş ödenemedi → moral düşer, grev riski
      await db.ref(`employees/${GZ.uid}/${k}/morale`).transaction(c => Math.max(0, (c||50) - 20));
      const newMorale = (await dbGet(`employees/${GZ.uid}/${k}/morale`)) || 0;
      if (newMorale < 30 && Math.random() < 0.4) {
        await db.ref(`employees/${GZ.uid}/${k}/onStrike`).set(true);
      }
      continue;
    }
    totalPaid += emp.salary;
    await db.ref(`employees/${GZ.uid}/${k}/nextSalaryDate`).set(Date.now() + 30 * 24 * 3600 * 1000);
    // Moral artışı (zamanında maaş)
    await db.ref(`employees/${GZ.uid}/${k}/morale`).transaction(c => Math.min(100, (c||80) + 3));
  }
  return totalPaid;
}
window.payEmployeeSalaries = payEmployeeSalaries;


/* ════════════════════════════════════════════════════════════════════════════
   ████ 12. AR-GE / TEKNOLOJİ AĞACI
   ──────────────────────────────────────────────────────────────────────────── */

const TECH_TREE = {
  'tarim_t1': { name:'Modern Tarım Aletleri',cost:50000,    days:3,  prereq:[],          effect:{tarimMult:1.10}, desc:'Bahçe üretiminde +%10' },
  'tarim_t2': { name:'Sera Teknolojisi',     cost:250000,   days:7,  prereq:['tarim_t1'],effect:{tarimMult:1.25}, desc:'Bahçe üretiminde +%25' },
  'tarim_t3': { name:'GMO Tohumlar',         cost:1500000,  days:15, prereq:['tarim_t2'],effect:{tarimMult:1.50}, desc:'Bahçe üretiminde +%50' },
  'hayvan_t1':{ name:'Otomatik Sağım',       cost:75000,    days:4,  prereq:[],          effect:{ciftlikMult:1.15}, desc:'Çiftlik üretiminde +%15' },
  'hayvan_t2':{ name:'Genetik Yem',          cost:400000,   days:8,  prereq:['hayvan_t1'],effect:{ciftlikMult:1.30}, desc:'Çiftlik üretiminde +%30' },
  'fab_t1':   { name:'Otomasyon Robotları',  cost:300000,   days:7,  prereq:[],          effect:{fabrikaMult:1.20}, desc:'Fabrika üretiminde +%20' },
  'fab_t2':   { name:'AI Yapılandırma',      cost:1800000,  days:14, prereq:['fab_t1'],  effect:{fabrikaMult:1.40}, desc:'Fabrika üretiminde +%40' },
  'fab_t3':   { name:'Kuantum Endüstri',     cost:8500000,  days:30, prereq:['fab_t2'],  effect:{fabrikaMult:1.80}, desc:'Fabrika üretiminde +%80' },
  'maden_t1': { name:'Sismik Tarama',        cost:600000,   days:10, prereq:[],          effect:{madenMult:1.20}, desc:'Maden üretiminde +%20' },
  'maden_t2': { name:'Derin Sondaj',         cost:3500000,  days:18, prereq:['maden_t1'],effect:{madenMult:1.50}, desc:'Maden üretiminde +%50' },
  'lojistik': { name:'Drone Teslimat',       cost:1200000,  days:12, prereq:[],          effect:{lojistikSpeed:1.5}, desc:'Sevkiyat hızı +%50' },
  'pazarlama':{ name:'Dijital Pazarlama',    cost:200000,   days:5,  prereq:[],          effect:{satisMult:1.15}, desc:'Tüm satışlar +%15' },
  'finans':   { name:'Algoritma Trade',      cost:5000000,  days:20, prereq:['pazarlama'],effect:{tradeProfit:1.25}, desc:'Hisse/kripto karı +%25' },
};
window.TECH_TREE = TECH_TREE;

async function startResearch(techCode) {
  const tech = TECH_TREE[techCode];
  if (!tech) return { ok:false, msg:'Teknoloji yok' };

  const research = await dbGet(`rd_tech/${GZ.uid}`) || {};
  if (research[techCode] && research[techCode].status === 'completed') return { ok:false, msg:'Zaten tamamlandı' };
  if (research[techCode] && research[techCode].status === 'in_progress') return { ok:false, msg:'Zaten araştırılıyor' };

  // Önkoşul kontrolü
  for (const pre of tech.prereq) {
    if (!research[pre] || research[pre].status !== 'completed') {
      return { ok:false, msg:`Önce gerekli: ${TECH_TREE[pre].name}` };
    }
  }

  const ok = await spendCash(GZ.uid, tech.cost, 'rd_research');
  if (!ok) return { ok:false, msg:`Yetersiz bakiye (₺${tech.cost.toLocaleString('tr-TR')})` };

  await db.ref(`rd_tech/${GZ.uid}/${techCode}`).set({
    code: techCode, name: tech.name,
    status: 'in_progress',
    startedAt: Date.now(),
    completesAt: Date.now() + tech.days * 24 * 3600 * 1000
  });
  return { ok:true };
}
window.startResearch = startResearch;

async function checkResearchCompletion() {
  const research = await dbGet(`rd_tech/${GZ.uid}`) || {};
  for (const code of Object.keys(research)) {
    if (research[code].status === 'in_progress' && Date.now() >= research[code].completesAt) {
      await db.ref(`rd_tech/${GZ.uid}/${code}/status`).set('completed');
      await db.ref(`rd_tech/${GZ.uid}/${code}/completedAt`).set(Date.now());
      await db.ref('notifs/' + GZ.uid).push({
        type:'research', icon:'🔬',
        msg:`🔬 Araştırma tamamlandı: ${research[code].name}`,
        ts: firebase.database.ServerValue.TIMESTAMP, read:false
      });
      await addXP(GZ.uid, 200);
    }
  }
}
window.checkResearchCompletion = checkResearchCompletion;


/* ════════════════════════════════════════════════════════════════════════════
   ████ 13. EĞİTİM MERKEZİ
   ──────────────────────────────────────────────────────────────────────────── */

const COURSES = [
  { code:'business_101', name:'İşletme Temelleri', cost:5000,  days:1, branch:'genel',   bonus:{xpRate:1.05}, desc:'XP +%5' },
  { code:'sales_pro',    name:'Satış Profesyonelliği',cost:25000,days:3, branch:'satis',  bonus:{satisMult:1.05}, desc:'Tüm satışlar +%5' },
  { code:'finance_adv',  name:'İleri Finans',     cost:75000, days:5, branch:'finans',   bonus:{tradeFee:0.8},  desc:'Komisyonlar -%20' },
  { code:'tech_lead',    name:'Tech Liderliği',   cost:150000,days:7, branch:'teknik',   bonus:{rdSpeed:1.3},   desc:'AR-GE %30 hızlı' },
  { code:'mba',          name:'MBA',              cost:500000,days:14,branch:'yonetim',  bonus:{empProd:1.10},  desc:'Çalışan verimliliği +%10' },
  { code:'crypto_master',name:'Kripto Uzmanı',    cost:200000,days:6, branch:'finans',   bonus:{cryptoFee:0.5}, desc:'Kripto komisyonu yarıya' },
  { code:'real_estate',  name:'Emlak Yatırımı',   cost:120000,days:5, branch:'finans',   bonus:{rentMult:1.15}, desc:'Kira gelirleri +%15' },
  { code:'logistics',    name:'Lojistik Optimizasyonu',cost:80000,days:4,branch:'teknik',bonus:{shipCost:0.85}, desc:'Nakliye %15 ucuz' },
  { code:'leadership',   name:'Liderlik',         cost:300000,days:10,branch:'yonetim',  bonus:{empMorale:1.15},desc:'Çalışan morali +%15' },
  { code:'marketing_adv',name:'İleri Pazarlama',  cost:100000,days:5, branch:'satis',    bonus:{ihaleAdv:1.10}, desc:'İhalelerde +%10 avantaj' }
];
window.COURSES = COURSES;

async function enrollCourse(code) {
  const course = COURSES.find(c => c.code === code);
  if (!course) return { ok:false, msg:'Kurs yok' };
  const edu = await dbGet(`education/${GZ.uid}`) || {};
  if (edu[code]) return { ok:false, msg:'Zaten kayıtlısın/tamamlandı' };

  const ok = await spendCash(GZ.uid, course.cost, 'education');
  if (!ok) return { ok:false, msg:`Yetersiz bakiye ₺${course.cost.toLocaleString('tr-TR')}` };

  await db.ref(`education/${GZ.uid}/${code}`).set({
    code, name: course.name,
    status: 'in_progress',
    startedAt: Date.now(),
    completesAt: Date.now() + course.days * 24 * 3600 * 1000
  });
  return { ok:true };
}
window.enrollCourse = enrollCourse;


/* ════════════════════════════════════════════════════════════════════════════
   ████ 14. SÖZLEŞME SİSTEMİ
   ──────────────────────────────────────────────────────────────────────────── */

async function createContract(targetUid, contractType, terms) {
  // contractType: 'tedarik', 'satis', 'ortak_yatirim', 'isbirligi'
  const contract = {
    id: 'ct_' + Date.now(),
    creator: GZ.uid, creatorName: GZ.data?.username,
    target: targetUid,
    type: contractType,
    terms,  // { product, qtyPerWeek, pricePerUnit, durationWeeks, ... }
    status: 'pending',
    createdAt: firebase.database.ServerValue.TIMESTAMP,
    expiresAt: Date.now() + 7 * 24 * 3600 * 1000  // 7 gün karar süresi
  };
  await db.ref('contracts').push(contract);

  // Hedef kullanıcıya bildirim
  await db.ref('notifs/' + targetUid).push({
    type:'contract_offer', icon:'📝',
    msg:`${GZ.data?.username} sana sözleşme önerdi: ${contractType}`,
    ts: firebase.database.ServerValue.TIMESTAMP, read:false
  });
  return { ok:true };
}
window.createContract = createContract;

async function acceptContract(contractKey) {
  const ct = await dbGet('contracts/' + contractKey);
  if (!ct) return { ok:false, msg:'Sözleşme yok' };
  if (ct.target !== GZ.uid) return { ok:false, msg:'Bu sözleşme sana değil' };
  if (ct.status !== 'pending') return { ok:false, msg:'Sözleşme zaten kapanmış' };
  if (Date.now() > ct.expiresAt) return { ok:false, msg:'Sözleşme süresi doldu' };

  await db.ref('contracts/' + contractKey + '/status').set('active');
  await db.ref('contracts/' + contractKey + '/acceptedAt').set(Date.now());
  return { ok:true };
}
window.acceptContract = acceptContract;


/* ════════════════════════════════════════════════════════════════════════════
   ████ 15. BELEDİYE SEÇİM SİSTEMİ
   ──────────────────────────────────────────────────────────────────────────── */

async function runForMayor(cityName, manifesto, taxPolicy) {
  // taxPolicy: 0.0-0.20 (vergi oranı)
  if (taxPolicy < 0 || taxPolicy > 0.20) return { ok:false, msg:'Vergi %0-20 arası' };
  if ((GZ.data?.level||1) < 30) return { ok:false, msg:'Min Lv 30 gerekli' };
  if ((GZ.data?.netWorth||0) < 1000000) return { ok:false, msg:'Min ₺1M servet gerekli' };

  // Kampanya ücreti: 50.000 ₺
  const ok = await spendCash(GZ.uid, 50000, 'mayor_campaign');
  if (!ok) return { ok:false, msg:'₺50.000 kampanya ücreti gerekli' };

  const election = await dbGet('city_mayor/elections/' + cityName) || { candidates: {}, votes: {}, endsAt: Date.now() + 7 * 24 * 3600 * 1000 };
  election.candidates[GZ.uid] = {
    uid: GZ.uid, name: GZ.data?.username,
    manifesto, taxPolicy,
    registeredAt: Date.now()
  };
  if (!election.endsAt) election.endsAt = Date.now() + 7 * 24 * 3600 * 1000;
  await db.ref('city_mayor/elections/' + cityName).set(election);
  return { ok:true };
}
window.runForMayor = runForMayor;

async function voteForMayor(cityName, candidateUid) {
  const voteRef = db.ref(`city_mayor/votes/${cityName}/${GZ.uid}`);
  const existingVote = await voteRef.once('value');
  if (existingVote.val()) return { ok:false, msg:'Zaten oy verdin' };

  await voteRef.set({ candidateUid, ts: Date.now() });
  await db.ref(`city_mayor/elections/${cityName}/votes/${candidateUid}`).transaction(c => (c||0) + 1);
  return { ok:true };
}
window.voteForMayor = voteForMayor;


/* ════════════════════════════════════════════════════════════════════════════
   ████ 16. TİCARET SAVAŞLARI
   ──────────────────────────────────────────────────────────────────────────── */

async function declareTradeWar(targetUid, durationDays, weaponType) {
  // weaponType: 'fiyat_dampingi', 'boykot', 'reklam_savasi', 'lobi'
  if ((GZ.data?.netWorth||0) < 500000) return { ok:false, msg:'Min ₺500K servet gerekli' };

  const cost = 100000;
  const ok = await spendCash(GZ.uid, cost, 'trade_war');
  if (!ok) return { ok:false, msg:'₺100K savaş ilanı ücreti gerekli' };

  const war = {
    id: 'tw_' + Date.now(),
    aggressor: GZ.uid, aggressorName: GZ.data?.username,
    target: targetUid,
    weapon: weaponType,
    declaredAt: Date.now(),
    endsAt: Date.now() + durationDays * 24 * 3600 * 1000,
    status: 'active',
    aggressorScore: 0, targetScore: 0
  };
  await db.ref('trade_war/active').push(war);

  await db.ref('notifs/' + targetUid).push({
    type:'trade_war', icon:'⚔️',
    msg:`⚔️ ${GZ.data?.username} sana ticaret savaşı ilan etti! (${weaponType})`,
    ts: firebase.database.ServerValue.TIMESTAMP, read:false
  });

  return { ok:true };
}
window.declareTradeWar = declareTradeWar;


/* ════════════════════════════════════════════════════════════════════════════
   ████ 17. DÜELLO (1v1 Ticaret)
   ──────────────────────────────────────────────────────────────────────────── */

async function createDuel(opponentUid, betAmount, durationMinutes) {
  if (betAmount < 10000) return { ok:false, msg:'Min bahis ₺10.000' };
  if (durationMinutes < 5 || durationMinutes > 60) return { ok:false, msg:'5-60 dk arası' };

  const ok = await spendCash(GZ.uid, betAmount, 'duel_bet');
  if (!ok) return { ok:false, msg:'Yetersiz bakiye' };

  const duel = {
    id: 'du_' + Date.now(),
    creator: GZ.uid, creatorName: GZ.data?.username,
    opponent: opponentUid,
    betAmount, escrow: betAmount,
    durationMinutes,
    status: 'pending',
    createdAt: Date.now(),
    expiresAt: Date.now() + 30 * 60 * 1000  // 30 dk kabul süresi
  };
  await db.ref('duels/active').push(duel);

  await db.ref('notifs/' + opponentUid).push({
    type:'duel_challenge', icon:'🤜',
    msg:`🤜 ${GZ.data?.username} seni düelloya çağırdı! Bahis: ₺${betAmount.toLocaleString('tr-TR')}`,
    ts: firebase.database.ServerValue.TIMESTAMP, read:false
  });
  return { ok:true };
}
window.createDuel = createDuel;

async function acceptDuel(duelKey) {
  const duel = await dbGet('duels/active/' + duelKey);
  if (!duel) return { ok:false, msg:'Düello yok' };
  if (duel.opponent !== GZ.uid) return { ok:false, msg:'Senin düellon değil' };
  if (duel.status !== 'pending') return { ok:false, msg:'Düello kabul edilemez' };

  const ok = await spendCash(GZ.uid, duel.betAmount, 'duel_bet');
  if (!ok) return { ok:false, msg:'Yetersiz bakiye' };

  await db.ref('duels/active/' + duelKey).update({
    status:'in_progress',
    startedAt: Date.now(),
    endsAt: Date.now() + duel.durationMinutes * 60 * 1000,
    escrow: duel.betAmount * 2,
    creatorScore: 0, opponentScore: 0
  });
  return { ok:true };
}
window.acceptDuel = acceptDuel;


/* ════════════════════════════════════════════════════════════════════════════
   ████ 24. TICK ORCHESTRATOR
   ──────────────────────────────────────────────────────────────────────────── */

let _v2Intervals = [];

function initV2Systems() {
  if (_v2Intervals.length > 0) return;
  _v2Intervals.push(setInterval(() => tickStockPrices().catch(()=>{}), 60000));
  _v2Intervals.push(setInterval(() => tickWeather().catch(()=>{}), 30 * 60 * 1000));
  _v2Intervals.push(setInterval(() => checkDisasters().catch(()=>{}), 60 * 60 * 1000));
  _v2Intervals.push(setInterval(() => distributeDividends().catch(()=>{}), 60 * 60 * 1000));
  _v2Intervals.push(setInterval(() => processBondCoupons().catch(()=>{}), 60 * 60 * 1000));
  _v2Intervals.push(setInterval(() => processIntlShipments().catch(()=>{}), 5 * 60 * 1000));
  _v2Intervals.push(setInterval(() => checkResearchCompletion().catch(()=>{}), 5 * 60 * 1000));
  _v2Intervals.push(setInterval(() => payEmployeeSalaries().catch(()=>{}), 60 * 60 * 1000));

  setTimeout(() => tickStockPrices().catch(()=>{}), 3000);
  setTimeout(() => tickWeather().catch(()=>{}), 5000);
  setTimeout(() => checkDisasters().catch(()=>{}), 8000);
}
window.initV2Systems = initV2Systems;

if (typeof auth !== 'undefined') {
  auth.onAuthStateChanged(u => { if (u) setTimeout(initV2Systems, 5000); });
}


/* ╔══════════════════════════════════════════════════════════════════════════╗
   ║                                                                          ║
   ║   🚀 GAMEZONE v3.0 — MEGA FEATURE UPDATE                                 ║
   ║                                                                          ║
   ║   ⚡ Opus 4.7 derin çalışma — 20 yeni özellik + bug fix paketi          ║
   ║                                                                          ║
   ║   1.  Para geçmişi (transaction log)                                     ║
   ║   2.  Hızlı arama (Cmd+K)                                                ║
   ║   3.  Dark mode toggle                                                   ║
   ║   4.  Animasyonlu para sayacı                                            ║
   ║   5.  Klavye kısayolları                                                 ║
   ║   6.  Para transfer (oyuncular arası)                                    ║
   ║   7.  Otomatik tasarruf                                                  ║
   ║   8.  Haftalık kazanç hedefi                                             ║
   ║   9.  Net değer takibi                                                   ║
   ║   10. Servet karşılaştırma                                               ║
   ║   11. Günlük çark (wheel of fortune)                                     ║
   ║   12. Pet sistemi (sevimli hayvan)                                       ║
   ║   13. Referans sistemi (arkadaş davet)                                   ║
   ║   14. Hediye gönderme                                                    ║
   ║   15. Cashback sistemi (%1 geri)                                         ║
   ║   16. Mevsimsel indirim                                                  ║
   ║   17. Anti-fraud (anti-bot) detection                                    ║
   ║   18. Achievement progress bar                                           ║
   ║   19. Profil özelleştirme (bio, banner)                                  ║
   ║   20. Mini istatistik dashboard                                          ║
   ║                                                                          ║
   ╚══════════════════════════════════════════════════════════════════════════╝ */


/* ════════════════════════════════════════════════════════════════════════════
   ▼ 1. PARA GEÇMİŞİ (TRANSACTION LOG)
   ──────────────────────────────────────────────────────────────────────────── */
async function logTransaction(uid, type, amount, reason, balance) {
  if (!uid || !isFinite(amount)) return;
  try {
    await db.ref(`txLog/${uid}`).push({
      ts: firebase.database.ServerValue.TIMESTAMP,
      type,        // 'in' (gelir) veya 'out' (gider)
      amount,
      reason,
      balance: balance || null
    });
    // Son 200 kaydı tut
    const snap = await db.ref(`txLog/${uid}`).once('value');
    const data = snap.val() || {};
    const keys = Object.keys(data);
    if (keys.length > 200) {
      const removeUpd = {};
      keys.slice(0, keys.length - 200).forEach(k => removeUpd[k] = null);
      await db.ref(`txLog/${uid}`).update(removeUpd);
    }
  } catch(e) {}
}
window.logTransaction = logTransaction;

async function getTxLog(uid, limit = 50) {
  const snap = await db.ref(`txLog/${uid || GZ.uid}`).limitToLast(limit).once('value');
  const data = snap.val() || {};
  return Object.values(data).sort((a, b) => (b.ts || 0) - (a.ts || 0));
}
window.getTxLog = getTxLog;


/* ════════════════════════════════════════════════════════════════════════════
   ▼ 2. HIZLI ARAMA (Cmd+K / Ctrl+K)
   ──────────────────────────────────────────────────────────────────────────── */
window.QUICK_SEARCH_INDEX = [
  // Tab'lar
  { type:'tab', name:'Dükkan',         icon:'🏪', tab:'dukkan' },
  { type:'tab', name:'Bahçe',          icon:'🌱', tab:'bahce' },
  { type:'tab', name:'Çiftlik',        icon:'🐄', tab:'ciftlik' },
  { type:'tab', name:'Fabrika',        icon:'🏭', tab:'fabrika' },
  { type:'tab', name:'Maden',          icon:'⛏️', tab:'maden' },
  { type:'tab', name:'Lojistik',       icon:'🚚', tab:'lojistik' },
  { type:'tab', name:'İhracat',        icon:'🚢', tab:'ihracat' },
  { type:'tab', name:'İhale',          icon:'⚖️', tab:'ihale' },
  { type:'tab', name:'Kripto',         icon:'📈', tab:'kripto' },
  { type:'tab', name:'Marka',          icon:'🏢', tab:'marka' },
  { type:'tab', name:'Pazar',          icon:'🛒', tab:'pazar' },
  { type:'tab', name:'Oyuncu Pazarı',  icon:'🏬', tab:'oyunpazari' },
  { type:'tab', name:'Görevler',       icon:'📋', tab:'gorevler' },
  { type:'tab', name:'Başarımlar',     icon:'🏅', tab:'basarimlar' },
  { type:'tab', name:'Liderlik',       icon:'🏆', tab:'liderlik' },
  { type:'tab', name:'Borsa',          icon:'📊', tab:'borsa' },
  { type:'tab', name:'Emlak',          icon:'🏘️', tab:'emlak' },
  { type:'tab', name:'Sigorta',        icon:'🛡️', tab:'sigorta' },
  { type:'tab', name:'Franchise',      icon:'🪧', tab:'franchise' },
  { type:'tab', name:'Tahvil',         icon:'📜', tab:'tahvil' },
  { type:'tab', name:'Vadeli',         icon:'📉', tab:'futures' },
  { type:'tab', name:'Hedge Fon',      icon:'💹', tab:'hedgefon' },
  { type:'tab', name:'Çalışan',        icon:'👷', tab:'calisan' },
  { type:'tab', name:'Ar-Ge',          icon:'🔬', tab:'arge' },
  { type:'tab', name:'Eğitim',         icon:'🎓', tab:'egitim' },
  { type:'tab', name:'Avatar',         icon:'🎭', tab:'avatar' },
  { type:'tab', name:'Unvan',          icon:'🎖️', tab:'unvan' },
  { type:'tab', name:'Mağaza',         icon:'💎', tab:'magaza' },
  { type:'tab', name:'Oyunlar',        icon:'🎮', tab:'oyunlar' },
  // Aksiyonlar
  { type:'action', name:'Banka',           icon:'🏦', action:'openBank()' },
  { type:'action', name:'Sohbet',          icon:'💬', action:'openChat()' },
  { type:'action', name:'Bildirimler',     icon:'🔔', action:'openNotif()' },
  { type:'action', name:'Profilim',        icon:'👤', action:'openMyProfile()' },
  { type:'action', name:'Çark Çevir',      icon:'🎡', action:'openWheel()' },
  { type:'action', name:'Para Transferi',  icon:'💸', action:'openMoneyTransfer()' },
  { type:'action', name:'Geçmiş İşlemler', icon:'📜', action:'openTxHistory()' }
];

window.openQuickSearch = function() {
  const existingModal = document.getElementById('quickSearchModal');
  if (existingModal) { existingModal.remove(); return; }

  const modal = document.createElement('div');
  modal.id = 'quickSearchModal';
  modal.className = 'qs-modal';
  modal.innerHTML = `
    <div class="qs-box" onclick="event.stopPropagation()">
      <div class="qs-input-wrap">
        <span class="qs-icon">🔍</span>
        <input type="text" id="qsInput" placeholder="Sayfa veya işlem ara..." autocomplete="off">
        <kbd class="qs-kbd">ESC</kbd>
      </div>
      <div class="qs-results" id="qsResults"></div>
      <div class="qs-foot">
        <span><kbd>↑</kbd><kbd>↓</kbd> Gez</span>
        <span><kbd>Enter</kbd> Aç</span>
        <span><kbd>Ctrl+K</kbd> Kapat</span>
      </div>
    </div>
  `;
  modal.addEventListener('click', () => modal.remove());
  document.body.appendChild(modal);

  const input = document.getElementById('qsInput');
  const results = document.getElementById('qsResults');
  let selectedIdx = 0;

  const renderResults = (query) => {
    const q = (query || '').toLowerCase().trim();
    let items = window.QUICK_SEARCH_INDEX;
    if (q) {
      items = items.filter(it => it.name.toLowerCase().includes(q));
    }
    items = items.slice(0, 10);
    selectedIdx = 0;
    results.innerHTML = items.length ? items.map((it, i) => `
      <div class="qs-item ${i===0?'selected':''}" data-idx="${i}">
        <span class="qsi-icon">${it.icon}</span>
        <span class="qsi-name">${it.name}</span>
        <span class="qsi-type">${it.type === 'tab' ? 'Sayfa' : 'İşlem'}</span>
      </div>
    `).join('') : '<div class="qs-empty">Sonuç bulunamadı</div>';

    // Item click handler
    results.querySelectorAll('.qs-item').forEach((el, i) => {
      el.addEventListener('click', () => executeSearch(items[i]));
    });
    return items;
  };

  const executeSearch = (item) => {
    if (!item) return;
    modal.remove();
    if (item.type === 'tab') {
      if (typeof setTab === 'function') setTab(item.tab);
      else if (typeof render === 'function') render(item.tab);
    } else if (item.type === 'action') {
      try { eval('window.' + item.action.replace(/\(.*$/, '') + '()'); }
      catch(e) { console.warn('Quick search action error:', e); }
    }
  };

  input.addEventListener('input', e => renderResults(e.target.value));
  input.addEventListener('keydown', e => {
    const items = window.QUICK_SEARCH_INDEX.filter(it =>
      !input.value || it.name.toLowerCase().includes(input.value.toLowerCase())
    ).slice(0, 10);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIdx = Math.min(items.length - 1, selectedIdx + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIdx = Math.max(0, selectedIdx - 1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      executeSearch(items[selectedIdx]);
      return;
    } else if (e.key === 'Escape') {
      modal.remove();
      return;
    }
    results.querySelectorAll('.qs-item').forEach((el, i) => {
      el.classList.toggle('selected', i === selectedIdx);
    });
  });

  renderResults('');
  setTimeout(() => input.focus(), 50);
};

// Klavye kısayolları
document.addEventListener('keydown', (e) => {
  // Cmd+K veya Ctrl+K → Quick Search
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault();
    window.openQuickSearch();
  }
  // Cmd+B veya Ctrl+B → Banka
  if ((e.metaKey || e.ctrlKey) && e.key === 'b' && typeof window.openBank === 'function') {
    e.preventDefault();
    window.openBank();
  }
  // Cmd+P veya Ctrl+P → Profil
  if ((e.metaKey || e.ctrlKey) && e.key === 'p' && typeof window.openMyProfile === 'function') {
    e.preventDefault();
    window.openMyProfile();
  }
});


/* ════════════════════════════════════════════════════════════════════════════
   ▼ 3. DARK MODE TOGGLE
   ──────────────────────────────────────────────────────────────────────────── */
window.toggleDarkMode = function() {
  const isDark = document.body.classList.toggle('dark-mode');
  try { localStorage.setItem('gz_dark_mode', isDark ? '1' : '0'); } catch(e) {}
  if (typeof toast === 'function') toast(isDark ? '🌙 Karanlık mod' : '☀️ Aydınlık mod', 'info', 2000);
};

// Sayfa yüklendiğinde tercihi uygula
(function initDarkMode() {
  try {
    const saved = localStorage.getItem('gz_dark_mode');
    if (saved === '1') document.body.classList.add('dark-mode');
  } catch(e) {}
})();


/* ════════════════════════════════════════════════════════════════════════════
   ▼ 4. ANIMASYONLU PARA SAYACI
   ──────────────────────────────────────────────────────────────────────────── */
window.animateNumber = function(element, start, end, duration = 800) {
  if (!element) return;
  const startTs = Date.now();
  const fmt = (n) => {
    const num = Math.floor(n);
    return new Intl.NumberFormat('tr-TR').format(num);
  };
  const step = () => {
    const elapsed = Date.now() - startTs;
    const progress = Math.min(1, elapsed / duration);
    // Easing: ease-out cubic
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = start + (end - start) * eased;
    element.textContent = fmt(current);
    if (progress < 1) requestAnimationFrame(step);
    else element.textContent = fmt(end);
  };
  requestAnimationFrame(step);
};


/* ════════════════════════════════════════════════════════════════════════════
   ▼ 5. PARA TRANSFERİ (oyuncular arası)
   ──────────────────────────────────────────────────────────────────────────── */
const TRANSFER_LIMITS = {
  daily_max: 100000,        // Günde max ₺100.000 transfer
  fee_pct: 0.03,            // %3 işlem ücreti
  min_level: 5              // Min 5. seviye
};

async function transferMoney(targetUid, amount, message) {
  if (!targetUid || targetUid === GZ.uid) return { ok: false, msg: 'Kendine transfer yapamazsın' };
  if (!isFinite(amount) || amount <= 0) return { ok: false, msg: 'Geçersiz tutar' };
  amount = Math.floor(amount * 100) / 100;

  if ((GZ.data?.level || 1) < TRANSFER_LIMITS.min_level) {
    return { ok: false, msg: `Min Lv ${TRANSFER_LIMITS.min_level} gerekli` };
  }

  // Günlük limit kontrolü
  const today = new Date().toISOString().slice(0,10);
  const dailyKey = `transferDaily/${GZ.uid}/${today}`;
  const todaySent = (await dbGet(dailyKey)) || 0;
  if (todaySent + amount > TRANSFER_LIMITS.daily_max) {
    return { ok: false, msg: `Günlük limit aşıldı (Max: ${cashFmt(TRANSFER_LIMITS.daily_max)}, Bugün: ${cashFmt(todaySent)})` };
  }

  // Hedef kullanıcı var mı?
  const target = await dbGet(`users/${targetUid}`);
  if (!target) return { ok: false, msg: 'Kullanıcı bulunamadı' };
  if (target.banned) return { ok: false, msg: 'Bu kullanıcı banlı' };

  // Komisyon hesapla
  const fee = +(amount * TRANSFER_LIMITS.fee_pct).toFixed(2);
  const totalCharge = amount + fee;

  // Para çek
  const ok = await spendCash(GZ.uid, totalCharge, 'transfer-out');
  if (!ok) return { ok: false, msg: `Yetersiz bakiye (Tutar: ${cashFmt(amount)} + Komisyon: ${cashFmt(fee)} = ${cashFmt(totalCharge)})` };

  // Hedefe ekle
  await addCash(targetUid, amount, 'transfer-in');

  // Log
  await db.ref(`transferDaily/${GZ.uid}/${today}`).transaction(c => (c||0) + amount);
  await db.ref(`transfers`).push({
    from: GZ.uid,
    fromName: GZ.data?.username,
    to: targetUid,
    toName: target.username,
    amount, fee,
    message: (message || '').slice(0, 100),
    ts: firebase.database.ServerValue.TIMESTAMP
  });

  // Bildirim
  await pushNotif(targetUid,
    `💸 ${GZ.data?.username} sana ${cashFmt(amount)} gönderdi${message ? ': "' + message.slice(0, 50) + '"' : ''}`);

  return { ok: true, fee, amount };
}
window.transferMoney = transferMoney;


/* ════════════════════════════════════════════════════════════════════════════
   ▼ 6. OTOMATIK TASARRUF
   ──────────────────────────────────────────────────────────────────────────── */
async function setAutoSavings(percentage) {
  if (percentage < 0 || percentage > 50) return { ok: false, msg: '0-50 arası olmalı' };
  await dbUpdate(`users/${GZ.uid}`, { autoSavingsPct: percentage });
  return { ok: true };
}
window.setAutoSavings = setAutoSavings;

// Para girişlerinde otomatik tasarruf yap (addCash wrapper)
const _origAddCash = window.addCash;
window.addCashWithSavings = async function(uid, amount, reason) {
  if (uid !== GZ.uid) return _origAddCash(uid, amount, reason);
  const settings = await dbGet(`users/${uid}/autoSavingsPct`);
  if (!settings || settings <= 0) return _origAddCash(uid, amount, reason);

  const savings = Math.floor(amount * settings / 100);
  const remaining = amount - savings;

  await _origAddCash(uid, remaining, reason);
  if (savings > 0) {
    await db.ref(`bank/${uid}/balance`).transaction(c => (c||0) + savings);
  }
  return true;
};


/* ════════════════════════════════════════════════════════════════════════════
   ▼ 7. HAFTALIK KAZANÇ HEDEFİ
   ──────────────────────────────────────────────────────────────────────────── */
function getCurrentWeekKey() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const diff = (now - start) / (1000 * 60 * 60 * 24);
  const weekNum = Math.ceil((diff + start.getDay() + 1) / 7);
  return `${now.getFullYear()}-W${weekNum}`;
}

async function setWeeklyGoal(targetAmount) {
  if (!isFinite(targetAmount) || targetAmount < 1000) return { ok: false, msg: 'Min ₺1.000' };
  const week = getCurrentWeekKey();
  await dbUpdate(`users/${GZ.uid}/weeklyGoal/${week}`, {
    target: targetAmount,
    progress: 0,
    setAt: Date.now()
  });
  return { ok: true };
}
window.setWeeklyGoal = setWeeklyGoal;

async function getWeeklyGoal() {
  const week = getCurrentWeekKey();
  return await dbGet(`users/${GZ.uid}/weeklyGoal/${week}`);
}
window.getWeeklyGoal = getWeeklyGoal;


/* ════════════════════════════════════════════════════════════════════════════
   ▼ 8. NET DEĞER TAKİBİ
   ──────────────────────────────────────────────────────────────────────────── */
async function calculateNetWorth(uid) {
  uid = uid || GZ.uid;
  const user = await dbGet(`users/${uid}`);
  if (!user) return 0;

  const cash = user.money || 0;
  const bank = await dbGet(`bank/${uid}`) || {};
  const bankTotal = (bank.balance || 0) + (bank.investment || 0);
  const debt = bank.loan || 0;

  // Kripto değeri
  let cryptoValue = 0;
  const holdings = await dbGet(`crypto/holdings/${uid}`) || {};
  const prices = (await dbGet('crypto/prices')) || {};
  for (const sym of Object.keys(holdings)) {
    const price = prices[sym]?.current || 0;
    cryptoValue += (holdings[sym] || 0) * price;
  }

  // Hisse değeri
  let stockValue = 0;
  const stocks = await dbGet(`stocks/holdings/${uid}`) || {};
  for (const sym of Object.keys(stocks)) {
    const stockPrice = await dbGet(`stocks/prices/${sym}/current`);
    if (stockPrice && stocks[sym]?.qty) stockValue += stocks[sym].qty * stockPrice;
  }

  // Emlak değeri
  let realEstateValue = 0;
  const properties = await dbGet(`realestate/owned/${uid}`) || {};
  for (const p of Object.values(properties)) {
    realEstateValue += p.currentValue || 0;
  }

  const total = cash + bankTotal + cryptoValue + stockValue + realEstateValue - debt;

  // Kaydet
  await dbUpdate(`users/${uid}`, {
    netWorth: Math.floor(total),
    lastNetWorthCalc: Date.now()
  });

  return {
    total: Math.floor(total),
    cash, bankTotal, cryptoValue, stockValue, realEstateValue, debt
  };
}
window.calculateNetWorth = calculateNetWorth;

// Her 30 dakikada bir net değer güncelle
setInterval(() => {
  if (window.GZ && GZ.uid) calculateNetWorth(GZ.uid).catch(()=>{});
}, 30 * 60 * 1000);


/* ════════════════════════════════════════════════════════════════════════════
   ▼ 9. GÜNLÜK ÇARK
   ──────────────────────────────────────────────────────────────────────────── */
const WHEEL_PRIZES = [
  { type:'money', amount:500,    label:'₺500',    weight:25, color:'#10b981' },
  { type:'money', amount:1500,   label:'₺1.500',  weight:18, color:'#3b82f6' },
  { type:'money', amount:5000,   label:'₺5.000',  weight:12, color:'#8b5cf6' },
  { type:'money', amount:15000,  label:'₺15.000', weight: 6, color:'#f59e0b' },
  { type:'money', amount:50000,  label:'₺50.000', weight: 2, color:'#ef4444' },
  { type:'diamond', amount:5,    label:'5💎',     weight:15, color:'#06b6d4' },
  { type:'diamond', amount:25,   label:'25💎',    weight: 7, color:'#0891b2' },
  { type:'diamond', amount:100,  label:'100💎',   weight: 1, color:'#0e7490' },
  { type:'xp', amount:500,       label:'500 XP',  weight:10, color:'#a855f7' },
  { type:'nothing', label:'😢 Boş', weight: 4, color:'#6b7280' }
];
window.WHEEL_PRIZES = WHEEL_PRIZES;

async function spinWheel() {
  // Günlük 1 ücretsiz çark hakkı
  const today = new Date().toISOString().slice(0,10);
  const lastSpin = await dbGet(`users/${GZ.uid}/wheelLastDate`);
  if (lastSpin === today) {
    return { ok: false, msg: 'Bugün çark çevirdin, yarın gel!' };
  }

  // Ağırlık toplamı
  const totalWeight = WHEEL_PRIZES.reduce((s, p) => s + p.weight, 0);
  let r = Math.random() * totalWeight;
  let prize = WHEEL_PRIZES[0];
  for (const p of WHEEL_PRIZES) {
    r -= p.weight;
    if (r <= 0) { prize = p; break; }
  }

  // Ödülü ver
  if (prize.type === 'money') {
    await addCash(GZ.uid, prize.amount, 'wheel');
  } else if (prize.type === 'diamond') {
    await addDiamonds(GZ.uid, prize.amount);
  } else if (prize.type === 'xp') {
    await addXP(GZ.uid, prize.amount);
  }

  await dbUpdate(`users/${GZ.uid}`, { wheelLastDate: today });

  return { ok: true, prize };
}
window.spinWheel = spinWheel;

async function canSpinWheel() {
  const today = new Date().toISOString().slice(0,10);
  const lastSpin = await dbGet(`users/${GZ.uid}/wheelLastDate`);
  return lastSpin !== today;
}
window.canSpinWheel = canSpinWheel;


/* ════════════════════════════════════════════════════════════════════════════
   ▼ 10. PET SİSTEMİ 🐾
   ──────────────────────────────────────────────────────────────────────────── */
const PETS = [
  { id:'cat',     name:'Kedi',          emo:'🐱', cost:50000,    bonus:{ shopRevenue:1.05 }, desc:'Dükkan kazancı +%5' },
  { id:'dog',     name:'Köpek',         emo:'🐶', cost:75000,    bonus:{ security:1.15 },    desc:'Hırsızlık koruması +%15' },
  { id:'parrot',  name:'Papağan',       emo:'🦜', cost:120000,   bonus:{ marketDiscount:0.95 }, desc:'Pazardan alımda -%5' },
  { id:'cow',     name:'İnek',          emo:'🐄', cost:200000,   bonus:{ farmYield:1.10 },   desc:'Çiftlik üretimi +%10' },
  { id:'hen',     name:'Tavuk',         emo:'🐔', cost:30000,    bonus:{ gardenYield:1.08 }, desc:'Bahçe üretimi +%8' },
  { id:'horse',   name:'At',            emo:'🐴', cost:500000,   bonus:{ shipSpeed:1.25 },   desc:'Lojistik %25 hızlı' },
  { id:'eagle',   name:'Kartal',        emo:'🦅', cost:1500000,  bonus:{ tradeView:true },   desc:'Tüm fiyatları erken gör' },
  { id:'dragon',  name:'Ejder',         emo:'🐲', cost:0, diamondCost:500, bonus:{ all:1.10 }, desc:'Tüm bonus +%10 (PREMIUM)' }
];
window.PETS = PETS;

async function buyPet(petId) {
  const pet = PETS.find(p => p.id === petId);
  if (!pet) return { ok: false, msg: 'Pet bulunamadı' };

  const owned = await dbGet(`users/${GZ.uid}/pets/${petId}`);
  if (owned) return { ok: false, msg: 'Bu pet zaten sende var' };

  if (pet.diamondCost) {
    const ok = await spendDiamonds(GZ.uid, pet.diamondCost);
    if (!ok) return { ok: false, msg: `${pet.diamondCost} 💎 gerekli` };
  } else {
    const ok = await spendCash(GZ.uid, pet.cost, 'pet-buy');
    if (!ok) return { ok: false, msg: 'Yetersiz bakiye' };
  }

  await dbSet(`users/${GZ.uid}/pets/${petId}`, {
    id: petId, name: pet.name, boughtAt: Date.now(), happiness: 100, hunger: 100
  });

  return { ok: true, pet };
}
window.buyPet = buyPet;

async function setActivePet(petId) {
  const owned = await dbGet(`users/${GZ.uid}/pets/${petId}`);
  if (!owned) return { ok: false, msg: 'Bu pet sende yok' };
  await dbUpdate(`users/${GZ.uid}`, { activePet: petId });
  return { ok: true };
}
window.setActivePet = setActivePet;

async function feedPet(petId) {
  const pet = await dbGet(`users/${GZ.uid}/pets/${petId}`);
  if (!pet) return { ok: false, msg: 'Pet yok' };
  const ok = await spendCash(GZ.uid, 100, 'pet-feed');
  if (!ok) return { ok: false, msg: 'Mama parası yetmedi (₺100)' };
  await dbUpdate(`users/${GZ.uid}/pets/${petId}`, {
    hunger: Math.min(100, (pet.hunger||0) + 30),
    happiness: Math.min(100, (pet.happiness||0) + 10)
  });
  return { ok: true };
}
window.feedPet = feedPet;


/* ════════════════════════════════════════════════════════════════════════════
   ▼ 11. REFERANS SİSTEMİ
   ──────────────────────────────────────────────────────────────────────────── */
async function generateReferralCode() {
  let code = await dbGet(`users/${GZ.uid}/referralCode`);
  if (code) return code;
  // Username + random 4 char
  const base = (GZ.data?.username || 'user').slice(0, 6).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  code = base + '-' + rand;
  await dbUpdate(`users/${GZ.uid}`, { referralCode: code });
  await dbSet(`refCodes/${code}`, GZ.uid);
  return code;
}
window.generateReferralCode = generateReferralCode;

async function useReferralCode(code) {
  if (!code) return { ok: false, msg: 'Kod boş' };
  code = code.trim().toUpperCase();

  const u = GZ.data;
  if (u.referredBy) return { ok: false, msg: 'Zaten bir referans kullandın' };
  if (u.createdAt && Date.now() - u.createdAt > 7 * 24 * 3600 * 1000) {
    return { ok: false, msg: 'Sadece ilk 7 günde kullanılabilir' };
  }

  const refUid = await dbGet(`refCodes/${code}`);
  if (!refUid) return { ok: false, msg: 'Geçersiz kod' };
  if (refUid === GZ.uid) return { ok: false, msg: 'Kendi kodunu kullanamazsın' };

  // İki taraf da bonus alır
  await addCash(GZ.uid, 5000, 'referral-used');
  await addCash(refUid, 10000, 'referral-bonus');
  await addDiamonds(GZ.uid, 10);
  await addDiamonds(refUid, 25);

  await dbUpdate(`users/${GZ.uid}`, { referredBy: refUid });
  await db.ref(`users/${refUid}/referralCount`).transaction(c => (c||0) + 1);

  await pushNotif(refUid, `🎁 ${GZ.data?.username} senin referansınla katıldı! +₺10.000 + 25💎`);

  return { ok: true };
}
window.useReferralCode = useReferralCode;


/* ════════════════════════════════════════════════════════════════════════════
   ▼ 12. CASHBACK SİSTEMİ (Premium üyelere)
   ──────────────────────────────────────────────────────────────────────────── */
window.CASHBACK_PCT = 0.01;  // %1 cashback

async function applyCashback(uid, originalAmount) {
  if (!isFinite(originalAmount) || originalAmount <= 0) return;
  const isVip = await dbGet(`users/${uid}/isVip`);
  if (!isVip) return;
  const cashback = Math.floor(originalAmount * window.CASHBACK_PCT);
  if (cashback > 0) {
    await addCash(uid, cashback, 'cashback');
  }
}
window.applyCashback = applyCashback;


/* ════════════════════════════════════════════════════════════════════════════
   ▼ 13. ANTI-FRAUD / BOT TESPİT
   ──────────────────────────────────────────────────────────────────────────── */
const ACTION_LOG = {};  // uid -> { lastActions: [...] }

window.trackAction = function(uid, actionType) {
  if (!uid || !actionType) return;
  if (!ACTION_LOG[uid]) ACTION_LOG[uid] = { actions: [] };
  ACTION_LOG[uid].actions.push({ type: actionType, ts: Date.now() });
  // Son 100 aksiyon
  if (ACTION_LOG[uid].actions.length > 100) {
    ACTION_LOG[uid].actions = ACTION_LOG[uid].actions.slice(-100);
  }

  // Bot tespiti: 1 saniyede 5+ aynı aksiyon
  const last5 = ACTION_LOG[uid].actions.slice(-5);
  if (last5.length === 5) {
    const sameType = last5.every(a => a.type === actionType);
    const totalTime = last5[4].ts - last5[0].ts;
    if (sameType && totalTime < 1000) {
      console.warn(`[Anti-bot] ${uid}: ${actionType} 5x in ${totalTime}ms`);
      return { suspicious: true };
    }
  }
  return { suspicious: false };
};


/* ════════════════════════════════════════════════════════════════════════════
   ▼ 14. PROFİL ÖZELLEŞTİRME (bio, banner)
   ──────────────────────────────────────────────────────────────────────────── */
async function updateProfile(updates) {
  const allowed = ['bio', 'bannerColor', 'showBank', 'showStats', 'socialLinks'];
  const safeUpdates = {};
  for (const key of Object.keys(updates)) {
    if (allowed.includes(key)) {
      let val = updates[key];
      if (typeof val === 'string') {
        val = val.slice(0, 200);
        // XSS koruması
        val = val.replace(/<script/gi, '').replace(/javascript:/gi, '');
      }
      safeUpdates[key] = val;
    }
  }
  await dbUpdate(`users/${GZ.uid}`, safeUpdates);
  return { ok: true };
}
window.updateProfile = updateProfile;


/* ════════════════════════════════════════════════════════════════════════════
   ▼ 15. MİNİ İSTATİSTİK DASHBOARD
   ──────────────────────────────────────────────────────────────────────────── */
async function getDashboardStats(uid) {
  uid = uid || GZ.uid;
  const user = await dbGet(`users/${uid}`);
  if (!user) return null;

  const bank = await dbGet(`bank/${uid}`) || {};
  const businesses = await dbGet(`businesses/${uid}`) || {};

  const shopCount = Object.keys(businesses.shops || {}).length;
  const gardenCount = Object.keys(businesses.gardens || {}).length;
  const farmCount = Object.keys(businesses.farms || {}).length;
  const factoryCount = Object.keys(businesses.factories || {}).length;
  const mineCount = Object.keys(businesses.mines || {}).length;

  // Son 7 gün gelir
  const last7Days = await dbGet(`txLog/${uid}`) || {};
  const sevenDaysAgo = Date.now() - 7 * 24 * 3600 * 1000;
  let weekIn = 0, weekOut = 0;
  Object.values(last7Days).forEach(tx => {
    if (tx.ts > sevenDaysAgo) {
      if (tx.type === 'in') weekIn += tx.amount || 0;
      else weekOut += tx.amount || 0;
    }
  });

  return {
    netWorth: user.netWorth || 0,
    cash: user.money || 0,
    bank: (bank.balance || 0) + (bank.investment || 0),
    debt: bank.loan || 0,
    level: user.level || 1,
    xp: user.xp || 0,
    diamonds: user.diamonds || 0,
    businesses: {
      shops: shopCount, gardens: gardenCount, farms: farmCount,
      factories: factoryCount, mines: mineCount,
      total: shopCount + gardenCount + farmCount + factoryCount + mineCount
    },
    weekIn, weekOut,
    weekProfit: weekIn - weekOut
  };
}
window.getDashboardStats = getDashboardStats;

/* ═══ 10 BANKA + KREDİ + MERKEZ BANKASI SİSTEMİ ═══ */
window.BANKALAR=[
  {id:'ziraat',name:'Ziraat Bankası',logo:'🏦',faiz:.025,maxKat:1.5,color:'#16a34a',info:'Devlet bankası. En düşük faiz.'},
  {id:'vakif',name:'VakıfBank',logo:'🏛️',faiz:.028,maxKat:1.6,color:'#1e40af',info:'Devlet güvenceli.'},
  {id:'halk',name:'Halkbank',logo:'🔵',faiz:.030,maxKat:1.7,color:'#1d4ed8',info:'Esnaf ve KOBİ dostu.'},
  {id:'is',name:'İş Bankası',logo:'⚫',faiz:.032,maxKat:2.0,color:'#111827',info:'Yüksek limit, esnek.'},
  {id:'garanti',name:'Garanti BBVA',logo:'🟢',faiz:.035,maxKat:2.2,color:'#15803d',info:'Hızlı onay.'},
  {id:'akbank',name:'Akbank',logo:'🔴',faiz:.033,maxKat:2.1,color:'#dc2626',info:'Premium avantajlar.'},
  {id:'ykb',name:'Yapı Kredi',logo:'💙',faiz:.038,maxKat:2.5,color:'#2563eb',info:'En yüksek limit.'},
  {id:'qnb',name:'QNB Finansbank',logo:'🟣',faiz:.036,maxKat:2.3,color:'#7c3aed',info:'Dijital başvuru.'},
  {id:'deniz',name:'Denizbank',logo:'🌊',faiz:.034,maxKat:2.0,color:'#0369a1',info:'DenizKredi esnek.'},
  {id:'teb',name:'TEB',logo:'🟡',faiz:.031,maxKat:1.9,color:'#ca8a04',info:'BNP Paribas güvencesi.'},
];
window.BANKALAR_MAP=Object.fromEntries(window.BANKALAR.map(b=>[b.id,b]));
window.KREDI_MIN_NOT=40; window.KREDI_MAX_LIMIT=1000; window.KREDI_VARSAYILAN=100;
window.getKrediLimit=n=>(!n||n<window.KREDI_MIN_NOT)?0:Math.min(window.KREDI_MAX_LIMIT,Math.floor(n*10));
window.getKrediNotu=async uid=>{const v=await dbGet('users/'+uid+'/krediNotu');return v!=null?v:100;};
window.updateKrediNotu=async(uid,d)=>{await db.ref('users/'+uid+'/krediNotu').transaction(c=>Math.max(0,Math.min(100,(c!=null?c:100)+d)));};

window.getVergiDetay=async function(uid){
  const shops=await dbGet('businesses/'+uid+'/shops')||{};
  const gardens=await dbGet('businesses/'+uid+'/gardens')||{};
  const farms=await dbGet('businesses/'+uid+'/farms')||{};
  const factories=await dbGet('businesses/'+uid+'/factories')||{};
  const mines=await dbGet('businesses/'+uid+'/mines')||{};
  const weeklyRev=(await dbGet('users/'+uid+'/weeklyRevenue'))||0;
  const loan=(await dbGet('bank/'+uid+'/loan'))||0;
  const loanBankId=(await dbGet('bank/'+uid+'/loanBankId'))||'ziraat';
  const dbFaizler=(await dbGet('system/bankFaizler'))||{};
  const mbRates=(await dbGet('system/merkezBankasi'))||{};
  const bankaFaiz=dbFaizler[loanBankId]||(window.BANKALAR_MAP?.[loanBankId]?.faiz||.032);
  const gelirOrani=((mbRates.gelirOrani||8))/100;
  const shopTax=Object.keys(shops).length*(mbRates.rates_shopTax||500);
  const gardenTax=Object.keys(gardens).length*(mbRates.rates_gardenTax||300);
  const farmTax=Object.keys(farms).length*(mbRates.rates_farmTax||300);
  const factoryTax=Object.keys(factories).length*(mbRates.rates_factoryTax||800);
  const mineTax=Object.keys(mines).length*(mbRates.rates_mineTax||600);
  const gelirVer=+(weeklyRev*gelirOrani).toFixed(2);
  const totalVergi=shopTax+gardenTax+farmTax+factoryTax+mineTax+gelirVer;
  const weeklyFaiz=loan>0?+(loan*bankaFaiz/52).toFixed(2):0;
  return{shopTax,gardenTax,farmTax,factoryTax,mineTax,gelirVer,totalVergi,weeklyFaiz,loan,bankaFaiz};
};

window.krediBasvuruYap=async function(bankaId,miktar){
  const b=window.BANKALAR_MAP?.[bankaId];
  if(!b) return toast('Geçersiz banka','error');
  miktar=Math.floor(+miktar);
  if(!miktar||miktar<=0) return toast('Geçersiz miktar','error');
  const not=await window.getKrediNotu(GZ.uid);
  if(not<window.KREDI_MIN_NOT) return toast('❌ Kredi notun düşük ('+not+'/100). Min: '+window.KREDI_MIN_NOT,'error',5000);
  const temel=window.getKrediLimit(not);
  // DB'den güncel faiz/limit al
  const dbFaizler=(await dbGet('system/bankFaizler'))||{};
  const curFaiz=dbFaizler[bankaId]||b.faiz;
  const bLimit=Math.floor(temel*b.maxKat);
  const borc=(await dbGet('bank/'+GZ.uid+'/loan'))||0;
  const kalan=bLimit-borc;
  if(miktar>kalan) return toast('❌ '+b.name+' kalan limitin: '+cashFmt(kalan),'error',5000);
  const mev=await dbGet('krediBasvurular/'+GZ.uid+'_'+bankaId);
  if(mev&&mev.durum==='beklemede') return toast('⏳ '+b.name+' başvurun zaten beklemede.','warn');
  await db.ref('krediBasvurular/'+GZ.uid+'_'+bankaId).set({
    uid:GZ.uid,username:GZ.data?.username||GZ.uid,
    bankaId,bankaAdi:b.name,miktar,krediNotu:not,mevcutBorc:borc,faizOrani:curFaiz,
    durum:'beklemede',ts:firebase.database.ServerValue.TIMESTAMP
  });
  toast('📋 '+b.name+' başvurusu gönderildi! Yetkili onaylayacak.','success',5000);
  const authUid=await dbGet('system/authorityUid');
  if(authUid){
    const lastSeen=(await dbGet('users/'+authUid+'/lastSeen'))||0;
    if(Date.now()-lastSeen>30*60*1000) setTimeout(()=>window._krediAI(GZ.uid,bankaId,miktar,not),8000);
    else pushNotif(authUid,'💳 YENİ: '+(GZ.data?.username||GZ.uid)+' → '+b.name+' '+cashFmt(miktar)+' (Not:'+not+')','💳','credit_request').catch(()=>{});
  }
};
window._krediAI=async function(uid,bankaId,miktar,not){
  const bas=await dbGet('krediBasvurular/'+uid+'_'+bankaId);
  if(!bas||bas.durum!=='beklemede') return;
  const b=window.BANKALAR_MAP?.[bankaId];
  const bLim=Math.floor(window.getKrediLimit(not)*(b?.maxKat||1));
  if(not>=50&&miktar<=bLim&&(bas.mevcutBorc||0)<bLim*.8) await window.krediOnayla(uid,bankaId,miktar,'🤖 AI Asistan');
  else await window.krediReddet(uid,bankaId,'🤖 AI: Yetersiz kredi notu veya limit aşımı');
};
window.krediOnayla=async function(uid,bankaId,miktar,not){
  await db.ref('bank/'+uid+'/loan').transaction(c=>(c||0)+miktar);
  await db.ref('bank/'+uid+'/loanBankId').set(bankaId);
  await addCash(uid,miktar,'kredi-onay');
  await window.updateKrediNotu(uid,-2);
  await db.ref('krediBasvurular/'+uid+'_'+bankaId).update({durum:'onaylandi',onaylayanNot:not||'Yetkili',onayTs:firebase.database.ServerValue.TIMESTAMP});
  pushNotif(uid,'✅ Kredin onaylandı! +'+cashFmt(miktar)+' hesabına yatırıldı.','✅','credit_ok').catch(()=>{});
};
window.krediReddet=async function(uid,bankaId,sebep){
  await db.ref('krediBasvurular/'+uid+'_'+bankaId).update({durum:'reddedildi',redSebebi:sebep||'Yetkili reddetti',redTs:firebase.database.ServerValue.TIMESTAMP});
  pushNotif(uid,'❌ Kredi başvurun reddedildi: '+(sebep||''),'❌','credit_red').catch(()=>{});
};
window.sendCommission=async(amt,type,uid)=>{if(!amt||amt<=0)return;const r=(window.KOMISYON?.[type]||.03);const cm=+(amt*r).toFixed(2);if(cm<.01)return;try{const a=(await db.ref('system/authorityUid').once('value')).val();if(a){await db.ref('users/'+a+'/money').transaction(c=>(c||0)+cm);}}catch(e){}};

/* ============================================================
   DİNAMİK ETKİNLİK SİSTEMİ — Kriz & Fırsat Mekanizması
   Rastgele zamanlarda tetiklenir, tüm oyunculara etkiler
   ============================================================ */

const ETKINLIKLER = [
  // KRİZLER
  { id:'maden_grevi',     tip:'kriz',    baslik:'⛏️ Madenlerde Grev!',
    mesaj:'İşçiler greve gitti! Maden üretimi %50 düştü, altın/gümüş fiyatları 2 katına çıktı.',
    ikon:'⛏️', sure:30,
    efektler:{ uretimCarpan:{ mines:0.5 }, fiyatCarpan:{ altin:2.0, gumus:1.8, demir:1.5 } }
  },
  { id:'kuraklık',        tip:'kriz',    baslik:'☀️ Büyük Kuraklık!',
    mesaj:'Tarım alanları kurudu! Sebze ve meyve üretimi %40 azaldı, fiyatlar yüzde 60 arttı.',
    ikon:'🌵', sure:20,
    efektler:{ uretimCarpan:{ gardens:0.6 }, fiyatCarpan:{ domates:1.6, patates:1.5, elma:1.7, sogan:1.4 } }
  },
  { id:'enflasyon',       tip:'kriz',    baslik:'📈 Enflasyon Dalgası!',
    mesaj:'Ülke genelinde ani enflasyon! Tüm ürün fiyatları %30 arttı.',
    ikon:'💸', sure:15,
    efektler:{ globalFiyatCarpan:1.3 }
  },
  { id:'borsa_cenahesi',  tip:'kriz',    baslik:'📉 Borsa Çöktü!',
    mesaj:'Küresel kriz! Tüm hisse senetleri %25 değer kaybetti.',
    ikon:'📉', sure:25,
    efektler:{ borsaCarpan:0.75 }
  },
  { id:'kripto_balonу',   tip:'kriz',    baslik:'💥 Kripto Balonu Patladı!',
    mesaj:'Büyük kripto satış dalgası! Tüm kriptolar %40 düştü.',
    ikon:'₿', sure:20,
    efektler:{ kriptoCarpan:0.60 }
  },
  { id:'fabrika_yangini', tip:'kriz',    baslik:'🔥 Büyük Fabrika Yangını!',
    mesaj:'Endüstriyel bölgede yangın! Fabrika üretimi yarıya indi.',
    ikon:'🔥', sure:20,
    efektler:{ uretimCarpan:{ factories:0.5 } }
  },

  // FIRSATLAR
  { id:'ihracat_talebi',  tip:'firsat',  baslik:'🚢 Büyük İhracat Talebi!',
    mesaj:'Yurtdışından büyük talep! Tüm ürünlerin ihracat fiyatı %80 arttı. Fırsat kaçırma!',
    ikon:'🚢', sure:15,
    efektler:{ ihracatCarpan:1.8 }
  },
  { id:'altin_ruzgari',   tip:'firsat',  baslik:'🥇 Altın Rüzgarı!',
    mesaj:'Dünya altın fiyatları rekor kırdı! Altın 3 kat değerlendi.',
    ikon:'🥇', sure:10,
    efektler:{ fiyatCarpan:{ altin:3.0, gumus:2.2 } }
  },
  { id:'kripto_bumu',     tip:'firsat',  baslik:'🚀 Kripto Bomu!',
    mesaj:'Kurumsal yatırımcılar kriptoya girdi! Tüm kriptolar %100 arttı.',
    ikon:'🚀', sure:12,
    efektler:{ kriptoCarpan:2.0 }
  },
  { id:'borsa_rallisi',   tip:'firsat',  baslik:'📈 Borsa Rallisi!',
    mesaj:'Ekonomik büyüme açıklandı! Tüm hisseler %30 yükseldi.',
    ikon:'📈', sure:20,
    efektler:{ borsaCarpan:1.30 }
  },
  { id:'festival_sezonu', tip:'firsat',  baslik:'🎪 Festival Sezonu!',
    mesaj:'Tatil sezonu başladı! Gıda ve içecek fiyatları %50 arttı, satışlar hızlandı.',
    ikon:'🎪', sure:25,
    efektler:{ globalFiyatCarpan:1.5, uretimCarpan:{ farms:1.5, gardens:1.4 } }
  },
  { id:'teknoloji_yatirimi', tip:'firsat', baslik:'💡 Teknoloji Yatırımı!',
    mesaj:'Devlet teşviki! Fabrika üretimi bu süre için %75 arttı.',
    ikon:'⚙️', sure:20,
    efektler:{ uretimCarpan:{ factories:1.75 } }
  },
];

window.ETKINLIKLER = ETKINLIKLER;

async function initEventSystem(){
  // Aktif etkinliği dinle
  db.ref('system/aktifEtkinlik').on('value', snap => {
    const etkinlik = snap.val();
    window._aktifEtkinlik = etkinlik;
    if (etkinlik && !etkinlik.bitti) {
      showEventBanner(etkinlik);
    } else {
      hideEventBanner();
    }
  });

  // Sadece 1 kişi tetiklesin (lock sistemi)
  scheduleNextEvent();
}
window.initEventSystem = initEventSystem;

function scheduleNextEvent(){
  // 15-45 dakika arası rastgele zamanda tetikle
  const delay = (15 + Math.random() * 30) * 60 * 1000;
  setTimeout(async () => {
    await triggerRandomEvent();
    scheduleNextEvent();
  }, delay);
}

async function triggerRandomEvent(){
  // Lock al — tek kişi tetiklesin
  const lockRef = db.ref('system/eventLock');
  const r = await lockRef.transaction(cur => {
    if (cur && (Date.now() - (cur.ts||0)) < 60000) return; // 1 dk lock
    return { uid: GZ.uid, ts: Date.now() };
  });
  if (!r.committed) return;

  // Aktif etkinlik varsa geç
  const aktif = await dbGet('system/aktifEtkinlik');
  if (aktif && !aktif.bitti && aktif.bitecegiZaman > Date.now()) return;

  // Rastgele etkinlik seç
  const etkinlik = ETKINLIKLER[Math.floor(Math.random() * ETKINLIKLER.length)];
  const bitecegiZaman = Date.now() + etkinlik.sure * 60 * 1000;

  const etkinlikVeri = {
    ...etkinlik,
    baslangic: Date.now(),
    bitecegiZaman,
    bitti: false
  };

  await db.ref('system/aktifEtkinlik').set(etkinlikVeri);

  // Haberler node'una yaz (tüm oyuncular görsün)
  const haberKey = db.ref('haberler').push().key;
  await db.ref('haberler/' + haberKey).set({
    tip: etkinlik.tip,
    baslik: etkinlik.baslik,
    mesaj: etkinlik.mesaj,
    ikon: etkinlik.ikon,
    sure: etkinlik.sure,
    ts: firebase.database.ServerValue.TIMESTAMP,
    bitecegiZaman: bitecegiZaman,
    bitti: false
  });

  // Tüm oyunculara bildir
  const users = await dbGet('users') || {};
  const batch = {};
  Object.keys(users).forEach(uid => {
    const key = db.ref().push().key;
    batch['notifs/' + uid + '/' + key] = {
      type: 'event_' + etkinlik.tip,
      icon: etkinlik.ikon,
      msg: etkinlik.baslik + ' — ' + etkinlik.mesaj + ' (' + etkinlik.sure + ' dk sürecek)',
      ts: firebase.database.ServerValue.TIMESTAMP,
      read: false
    };
  });
  await db.ref().update(batch);

  // Fiyat etkilerini uygula
  await applyEventEffects(etkinlikVeri, 'apply');

  // Süre sonunda bitir
  setTimeout(async () => {
    await db.ref('system/aktifEtkinlik').update({ bitti: true });
    // Haberler logunda bitti işaretle
    try {
      const hSnap = await db.ref('haberler').orderByChild('baslik').equalTo(etkinlikVeri.baslik).limitToLast(1).once('value');
      hSnap.forEach(s => { db.ref('haberler/' + s.key).update({ bitti: true }); });
    } catch(e){}
    await applyEventEffects(etkinlikVeri, 'revert');
    // Bitiş bildirimi
    const usersSnap = await dbGet('users') || {};
    const endBatch = {};
    Object.keys(usersSnap).forEach(uid => {
      const key = db.ref().push().key;
      endBatch['notifs/' + uid + '/' + key] = {
        type: 'event_end', icon: '✅',
        msg: etkinlik.baslik + ' sona erdi. Fiyatlar normale döndü.',
        ts: firebase.database.ServerValue.TIMESTAMP,
        read: false
      };
    });
    await db.ref().update(endBatch);
  }, etkinlik.sure * 60 * 1000);
}
window.triggerRandomEvent = triggerRandomEvent;

async function applyEventEffects(etkinlik, mod){
  const efekt = etkinlik.efektler || {};
  const carpan = mod === 'apply' ? 1 : -1; // revert için ters çevir

  // Global fiyat etkisi
  if (efekt.globalFiyatCarpan){
    const c = mod === 'apply' ? efekt.globalFiyatCarpan : (1 / efekt.globalFiyatCarpan);
    const prices = await dbGet('system/urunFiyatCarpanlari') || {};
    for (const key of Object.keys(URUNLER)){
      prices[key] = ((prices[key] || 1) * c);
    }
    await db.ref('system/urunFiyatCarpanlari').update(prices);
  }

  // Belirli ürün fiyat etkisi
  if (efekt.fiyatCarpan){
    const prices = (await dbGet('system/urunFiyatCarpanlari')) || {};
    for (const [urun, carpanVal] of Object.entries(efekt.fiyatCarpan)){
      const c = mod === 'apply' ? carpanVal : (1 / carpanVal);
      prices[urun] = ((prices[urun] || 1) * c);
    }
    await db.ref('system/urunFiyatCarpanlari').update(prices);
  }

  // Borsa etkisi
  if (efekt.borsaCarpan){
    const c = mod === 'apply' ? efekt.borsaCarpan : (1 / efekt.borsaCarpan);
    const stockPrices = await dbGet('stocks/prices') || {};
    const updates = {};
    for (const sym of Object.keys(stockPrices)){
      updates[sym + '/prev'] = stockPrices[sym].current;
      updates[sym + '/current'] = stockPrices[sym].current * c;
      updates[sym + '/eventCarpan'] = mod === 'apply' ? efekt.borsaCarpan : 1;
    }
    await db.ref('stocks/prices').update(updates);
  }

  // Kripto etkisi
  if (efekt.kriptoCarpan){
    const c = mod === 'apply' ? efekt.kriptoCarpan : (1 / efekt.kriptoCarpan);
    const cPrices = await dbGet('crypto/prices') || {};
    const updates = {};
    for (const sym of Object.keys(cPrices)){
      updates[sym + '/prev'] = cPrices[sym].current;
      updates[sym + '/current'] = Math.max(cPrices[sym].current * c, 0.000001);
    }
    await db.ref('crypto/prices').update(updates);
  }

  // Üretim çarpanı (Firebase'de sakla, processProductions okusun)
  if (efekt.uretimCarpan){
    for (const [kind, val] of Object.entries(efekt.uretimCarpan)){
      const c = mod === 'apply' ? val : 1;
      await db.ref('system/uretimCarpani/' + kind).set(c);
    }
  }
}

function showEventBanner(etkinlik){
  // Banner YOK — etkinlik haberler sayfasına yazılır
  // Sadece navbtn badge güncelle
  const haberBtn = document.querySelector('[data-tab="haberler"]');
  if (haberBtn && !haberBtn.querySelector('.ev-dot')){
    const dot = document.createElement('span');
    dot.className = 'ev-dot';
    dot.style.cssText = 'position:absolute;top:2px;right:2px;width:8px;height:8px;border-radius:50%;background:#ef4444;display:block';
    haberBtn.style.position = 'relative';
    haberBtn.appendChild(dot);
  }
}

function hideEventBanner(){
  const dot = document.querySelector('.ev-dot');
  if (dot) dot.remove();
}

window.applyEventEffects = applyEventEffects;


/* ─── urun-katalog.js ─── */
/* ==========================================================================
   urun-katalog.js — DÜKKAN-KATEGORİ EŞLEŞMESİ + GENİŞLETİLMİŞ ÜRÜN KATALOĞU
   ─────────────────────────────────────────────────────────────────────────
   PROBLEM: Önceden her dükkana her ürün konabiliyordu (markette et, vs.)
   ÇÖZÜM: Her dükkan TÜRÜ sadece kendi kategorisindeki ürünleri satabilir.
   ─────────────────────────────────────────────────────────────────────────
   Dükkan tipleri:
   ▸ market         (Lv 1)  → temel gıda + kahvaltı + kuru bakliyat
   ▸ manav          (Lv 1)  → meyve + sebze
   ▸ kasap          (Lv 3)  → et ürünleri
   ▸ firin          (Lv 2)  → ekmek, pasta, fırın ürünleri
   ▸ sutcu          (Lv 2)  → süt, peynir, yumurta, bal
   ▸ tuhafiye       (Lv 5)  → tekstil (yün, kumaş, eldiven)
   ▸ elektronik     (Lv 5)  → TV, telefon, laptop...
   ▸ beyazesya      (Lv 8)  → buzdolabı, çamaşır makinesi...
   ▸ mobilya        (Lv 8)  → koltuk, masa, dolap...
   ▸ kuyumcu        (Lv 12) → altın takı, gümüş, mücevher
   ▸ otomotiv       (Lv 15) → oto-parça, lastik, yağ
   ▸ benzin         (Lv 12) → akaryakıt, motor yağı
   ▸ yapi_market    (Lv 8)  → çimento, demir, hırdavat
   ▸ eczane         (Lv 6)  → ilaç, kozmetik
   ========================================================================== */

(function initKatalog() {
  // URUNLER henüz yüklenmediyse bekle, max 5 saniye
  if (!window.URUNLER) {
    let t = 0;
    const r = setInterval(function() {
      t++;
      if (window.URUNLER) { clearInterval(r); initKatalog(); }
      else if (t > 25) { clearInterval(r); console.warn('[urun-katalog] URUNLER yüklenemedi!'); }
    }, 200);
    return;
  }

  /* ══════════════════════════════════════════════════════════════════════
     YENİ ÜRÜNLER — Mevcut URUNLER objesine ekleniyor
     ══════════════════════════════════════════════════════════════════════ */

  const YENI_URUNLER = {
    /* ─── MANAV (sebze) ─── */
    salatalik:        { name:"Salatalık",        emo:"🥒", base:7.50,  cat:"sebze",   unit:"Kilo",  lv:1 },
    biber:            { name:"Yeşil Biber",      emo:"🫑", base:18.0,  cat:"sebze",   unit:"Kilo",  lv:1 },
    marul:            { name:"Marul",            emo:"🥬", base:12.0,  cat:"sebze",   unit:"Adet",  lv:1 },
    havuc:            { name:"Havuç",            emo:"🥕", base:9.50,  cat:"sebze",   unit:"Kilo",  lv:1 },
    karpuz:            { name:"Karpuz",          emo:"🍉", base:11.0,  cat:"sebze",   unit:"Kilo",  lv:2 },
    portakal:         { name:"Portakal",         emo:"🍊", base:13.5,  cat:"sebze",   unit:"Kilo",  lv:2 },
    muz:              { name:"Muz",              emo:"🍌", base:32.0,  cat:"sebze",   unit:"Kilo",  lv:3 },
    cilek:            { name:"Çilek",            emo:"🍓", base:35.0,  cat:"sebze",   unit:"Kilo",  lv:3 },

    /* ─── KASAP (et ürünleri) ─── */
    kiyma:            { name:"Kıyma",            emo:"🥩", base:240.0, cat:"et",      unit:"Kilo",  lv:3 },
    kanat:            { name:"Tavuk Kanat",      emo:"🍗", base:55.0,  cat:"et",      unit:"Kilo",  lv:3 },
    sucuk:            { name:"Sucuk",            emo:"🌭", base:280.0, cat:"et",      unit:"Kilo",  lv:5 },
    salam:            { name:"Salam",            emo:"🥓", base:150.0, cat:"et",      unit:"Kilo",  lv:4 },
    pasturma:         { name:"Pastırma",         emo:"🥩", base:520.0, cat:"et",      unit:"Kilo",  lv:7 },
    balik_levrek:     { name:"Levrek",           emo:"🐟", base:180.0, cat:"et",      unit:"Kilo",  lv:5 },

    /* ─── FIRIN (ek) ─── */
    simit:            { name:"Simit",            emo:"🥯", base:8.00,  cat:"firin",   unit:"Adet",  lv:2 },
    pogaca:           { name:"Poğaça",           emo:"🥐", base:10.0,  cat:"firin",   unit:"Adet",  lv:2 },
    kek:              { name:"Kek",              emo:"🧁", base:35.0,  cat:"firin",   unit:"Adet",  lv:3 },
    boregek:          { name:"Börek",            emo:"🥧", base:65.0,  cat:"firin",   unit:"Adet",  lv:4 },
    kurabiye:         { name:"Kurabiye",         emo:"🍪", base:42.0,  cat:"firin",   unit:"Kilo",  lv:3 },

    /* ─── ELEKTRONİK ─── */
    el_telefon_basit: { name:"Tuşlu Telefon",    emo:"📞", base:850.0,  cat:"elektronik", unit:"Adet", lv:5 },
    el_telefon_akilli:{ name:"Akıllı Telefon",   emo:"📱", base:18500.0,cat:"elektronik", unit:"Adet", lv:8 },
    el_tablet:        { name:"Tablet",           emo:"📲", base:9500.0, cat:"elektronik", unit:"Adet", lv:7 },
    el_laptop:        { name:"Laptop",           emo:"💻", base:32000.0,cat:"elektronik", unit:"Adet", lv:10 },
    el_tv_lcd:        { name:"LCD TV 43''",      emo:"📺", base:14500.0,cat:"elektronik", unit:"Adet", lv:8 },
    el_tv_oled:       { name:"OLED TV 65''",     emo:"📺", base:48000.0,cat:"elektronik", unit:"Adet", lv:14 },
    el_kulaklik:      { name:"Kulaklık",         emo:"🎧", base:680.0,  cat:"elektronik", unit:"Adet", lv:5 },
    el_oyun_konsol:   { name:"Oyun Konsolu",     emo:"🎮", base:24500.0,cat:"elektronik", unit:"Adet", lv:12 },
    el_kamera:        { name:"Fotoğraf Makinesi",emo:"📷", base:12500.0,cat:"elektronik", unit:"Adet", lv:9 },
    el_powerbank:     { name:"Powerbank",        emo:"🔋", base:380.0,  cat:"elektronik", unit:"Adet", lv:5 },

    /* ─── BEYAZ EŞYA ─── */
    be_buzdolabi:     { name:"Buzdolabı",        emo:"🧊", base:18500.0,cat:"beyazesya",  unit:"Adet", lv:10 },
    be_camasir:       { name:"Çamaşır Makinesi", emo:"🌀", base:14500.0,cat:"beyazesya",  unit:"Adet", lv:10 },
    be_bulasik:       { name:"Bulaşık Makinesi", emo:"🍽️", base:13500.0,cat:"beyazesya",  unit:"Adet", lv:10 },
    be_firin:         { name:"Ankastre Fırın",   emo:"♨️", base:11500.0,cat:"beyazesya",  unit:"Adet", lv:10 },
    be_klima:         { name:"Klima",            emo:"❄️", base:9500.0, cat:"beyazesya",  unit:"Adet", lv:10 },
    be_supurge:       { name:"Elektrik Süpürgesi",emo:"🧹", base:2800.0, cat:"beyazesya",  unit:"Adet", lv:10 },

    /* ─── MOBİLYA ─── */
    mb_koltuk:        { name:"Koltuk Takımı",    emo:"🛋️", base:24500.0,cat:"mobilya",  unit:"Set",  lv:8 },
    mb_yatak:         { name:"Yatak",            emo:"🛏️", base:8500.0, cat:"mobilya",  unit:"Adet", lv:8 },
    mb_masa:          { name:"Yemek Masası",     emo:"🪑", base:4500.0, cat:"mobilya",  unit:"Adet", lv:8 },
    mb_sandalye:      { name:"Sandalye",         emo:"🪑", base:680.0,  cat:"mobilya",  unit:"Adet", lv:8 },
    mb_dolap:         { name:"Gardırop",         emo:"🚪", base:9500.0, cat:"mobilya",  unit:"Adet", lv:9 },
    mb_kitaplik:      { name:"Kitaplık",         emo:"📚", base:3200.0, cat:"mobilya",  unit:"Adet", lv:8 },
    mb_hali:          { name:"Halı",             emo:"🪀", base:5500.0, cat:"mobilya",  unit:"Adet", lv:9 },

    /* ─── KUYUMCU (mevcut maden + takı) ─── */
    ku_alyans:        { name:"Alyans",           emo:"💍", base:18500.0,cat:"kuyumcu",  unit:"Çift", lv:12 },
    ku_kolye:         { name:"Altın Kolye",      emo:"📿", base:32500.0,cat:"kuyumcu",  unit:"Adet", lv:12 },
    ku_kupe:          { name:"Altın Küpe",       emo:"💎", base:15500.0,cat:"kuyumcu",  unit:"Çift", lv:12 },
    ku_bilezik:       { name:"Bilezik",          emo:"🔗", base:22500.0,cat:"kuyumcu",  unit:"Adet", lv:13 },
    ku_pirlanta:      { name:"Pırlanta Yüzük",   emo:"💎", base:85000.0,cat:"kuyumcu",  unit:"Adet", lv:18 },

    /* ─── OTOMOTİV ─── */
    ot_lastik:        { name:"Lastik",           emo:"🛞", base:3200.0, cat:"otomotiv", unit:"Adet", lv:15 },
    ot_motor_yagi:    { name:"Motor Yağı",       emo:"🛢️", base:850.0,  cat:"otomotiv", unit:"Litre",lv:15 },
    ot_far:           { name:"Far",              emo:"🚗", base:1850.0, cat:"otomotiv", unit:"Adet", lv:15 },
    ot_akü:           { name:"Akü",              emo:"🔋", base:4500.0, cat:"otomotiv", unit:"Adet", lv:15 },
    ot_silecek:       { name:"Silecek",          emo:"🌧️", base:280.0,  cat:"otomotiv", unit:"Çift", lv:15 },
    ot_jant:          { name:"Jant",             emo:"⚙️", base:5500.0, cat:"otomotiv", unit:"Adet", lv:16 },

    /* ─── BENZİN İSTASYONU ─── */
    bn_benzin:        { name:"Benzin",           emo:"⛽", base:42.50,  cat:"akaryakit",unit:"Litre",lv:12 },
    bn_motorin:       { name:"Motorin",          emo:"⛽", base:46.20,  cat:"akaryakit",unit:"Litre",lv:12 },
    bn_lpg:           { name:"LPG",              emo:"🔥", base:24.80,  cat:"akaryakit",unit:"Litre",lv:12 },
    bn_adblue:        { name:"AdBlue",           emo:"💧", base:38.00,  cat:"akaryakit",unit:"Litre",lv:12 },

    /* ─── YAPI MARKETİ ─── */
    ym_civi:          { name:"Çivi",             emo:"📍", base:25.00,  cat:"yapi",    unit:"Kilo", lv:8 },
    ym_vida:          { name:"Vida",             emo:"🔩", base:35.00,  cat:"yapi",    unit:"Kilo", lv:8 },
    ym_boya:          { name:"Plastik Boya",     emo:"🎨", base:480.0,  cat:"yapi",    unit:"Litre",lv:8 },
    ym_seramik:       { name:"Seramik",          emo:"🧱", base:185.0,  cat:"yapi",    unit:"m²",   lv:8 },
    ym_alci:          { name:"Alçı",             emo:"⬜", base:42.00,  cat:"yapi",    unit:"Kilo", lv:8 },
    ym_kablo:         { name:"Kablo",            emo:"🔌", base:18.00,  cat:"yapi",    unit:"Metre",lv:8 },

    /* ─── ECZANE ─── */
    ec_agrikesici:    { name:"Ağrı Kesici",      emo:"💊", base:48.00,  cat:"eczane",  unit:"Kutu", lv:6 },
    ec_vitamin:       { name:"Multivitamin",     emo:"💊", base:185.0,  cat:"eczane",  unit:"Kutu", lv:6 },
    ec_band:          { name:"Yara Bandı",       emo:"🩹", base:28.00,  cat:"eczane",  unit:"Kutu", lv:6 },
    ec_termometre:    { name:"Termometre",       emo:"🌡️", base:120.0,  cat:"eczane",  unit:"Adet", lv:6 },
    ec_sampuan:       { name:"Şampuan",          emo:"🧴", base:85.00,  cat:"eczane",  unit:"Adet", lv:6 },
    ec_dis_macunu:    { name:"Diş Macunu",       emo:"🪥", base:42.00,  cat:"eczane",  unit:"Adet", lv:6 },
    ec_makyaj:        { name:"Ruj",              emo:"💄", base:225.0,  cat:"eczane",  unit:"Adet", lv:7 },
  };

  // Mevcut URUNLER objesine ekle
  Object.assign(window.URUNLER, YENI_URUNLER);

  /* ══════════════════════════════════════════════════════════════════════
     KATEGORI → İSİM HARİTASI (UI için)
     ══════════════════════════════════════════════════════════════════════ */
  const NEW_KAT = {
    sebze:      "Meyve & Sebze",
    elektronik: "Elektronik",
    beyazesya:  "Beyaz Eşya",
    mobilya:    "Mobilya",
    kuyumcu:    "Kuyumcu / Takı",
    otomotiv:   "Oto-Parça",
    akaryakit:  "Akaryakıt",
    yapi:       "Yapı / Hırdavat",
    eczane:     "Eczane / Kozmetik",
  };
  if (window.URUN_KATEGORI) Object.assign(window.URUN_KATEGORI, NEW_KAT);
  window.URUN_KATEGORI_TUM = Object.assign({
    temel: "Temel Gıda",
    kahvalti: "Kahvaltılık & Süt",
    meyve: "Meyve & Sebze (eski)",
    et: "Et Ürünleri",
    firin: "Fırın",
    sanayi: "Tekstil / Sanayi",
    maden: "Madenler"
  }, NEW_KAT);

  /* ══════════════════════════════════════════════════════════════════════
     DÜKKAN TÜRÜ → İZİN VERİLEN ÜRÜN KATEGORİLERİ
     ══════════════════════════════════════════════════════════════════════ */

  const SHOP_CATALOG = {
    // (icon, isim, açılış-seviyesi, açılış-maliyeti, izin verilen kategoriler)
    market:     { icon:'🏪', name:'Market / Bakkal',      lv:1,  cost:5000,    cats:['temel', 'kahvalti'] },
    manav:      { icon:'🥬', name:'Manav (Meyve-Sebze)',  lv:1,  cost:4500,    cats:['meyve', 'sebze'] },
    kasap:      { icon:'🥩', name:'Kasap',                lv:3,  cost:8500,    cats:['et'] },
    firin:      { icon:'🥖', name:'Fırın / Pastane',      lv:2,  cost:6500,    cats:['firin'] },
    sutcu:      { icon:'🥛', name:'Sütçü / Mandıra',      lv:2,  cost:6000,    cats:['kahvalti'] },
    tuhafiye:   { icon:'🧵', name:'Tuhafiye / Manifatura',lv:5,  cost:12000,   cats:['sanayi'] },
    elektronik: { icon:'📱', name:'Elektronik Mağaza',    lv:5,  cost:25000,   cats:['elektronik'] },
    beyazesya:  { icon:'🧊', name:'Beyaz Eşya',           lv:8,  cost:55000,   cats:['beyazesya'] },
    mobilya:    { icon:'🛋️', name:'Mobilyacı',            lv:8,  cost:65000,   cats:['mobilya'] },
    kuyumcu:    { icon:'💍', name:'Kuyumcu',              lv:12, cost:120000,  cats:['kuyumcu','maden'] },
    otomotiv:   { icon:'🛞', name:'Oto-Yedek Parça',      lv:15, cost:95000,   cats:['otomotiv'] },
    benzin:     { icon:'⛽', name:'Akaryakıt İstasyonu',  lv:12, cost:180000,  cats:['akaryakit'] },
    yapi_market:{ icon:'🧱', name:'Yapı Marketi',         lv:8,  cost:48000,   cats:['yapi'] },
    eczane:     { icon:'💊', name:'Eczane / Kozmetik',    lv:6,  cost:32000,   cats:['eczane'] },
  };
  window.SHOP_CATALOG = SHOP_CATALOG;

  /* ══════════════════════════════════════════════════════════════════════
     YARDIMCI: Bu dükkan tipi şu ürünü satabilir mi?
     ══════════════════════════════════════════════════════════════════════ */

  window.canSellInShop = function (shopType, itemKey) {
    const def = SHOP_CATALOG[shopType];
    const item = window.URUNLER[itemKey];
    if (!def || !item) return false;
    return def.cats.includes(item.cat);
  };

  // Dükkan tipinin satabileceği tüm ürünleri listele
  window.getAllowedItems = function (shopType) {
    const def = SHOP_CATALOG[shopType];
    if (!def) return [];
    return Object.entries(window.URUNLER)
      .filter(([k, v]) => def.cats.includes(v.cat))
      .map(([k, v]) => Object.assign({ key: k }, v));
  };

  /* ══════════════════════════════════════════════════════════════════════
     ESKİ FONKSİYONLARI OVERRIDE ET
     ══════════════════════════════════════════════════════════════════════ */

  /* ─── buyShop: yeni dükkan tipleri + maliyet/seviye SHOP_CATALOG'tan ─── */
  const _origBuyShop = window.buyShop;
  window.buyShop = async function (type, city) {
    const def = SHOP_CATALOG[type];
    if (!def) return toast('Geçersiz dükkan türü', 'error');
    const lv = GZ.data?.level || 1;
    if (lv < def.lv) return toast(`${def.lv}. seviyede açılır`, 'warn');

    // ── TEKRAR AÇMA KONTROLÜ: Her türden sadece 1 ──
    const myShops = await dbGet(`businesses/${GZ.uid}/shops`) || {};
    const sameType = Object.values(myShops).filter(s => s.type === type);
    if (sameType.length >= 1) {
      return toast(`❌ ${def.name} zaten açık! Her türden yalnız 1 dükkan açılabilir.`, 'error');
    }

    const ok = await spendCash(GZ.uid, def.cost, 'buy-shop');
    if (!ok) return toast(`Yetersiz bakiye (${cashFmt(def.cost)})`, 'error');
    const id = 'sh_' + Math.random().toString(36).slice(2, 8);

    // Varsayılan 3 reyon + BAŞLANGIÇ STOKU ekle
    const defaultShelves = {};
    const allowedForShop = Object.entries(window.URUNLER)
      .filter(([k,v]) => def.cats.includes(v.cat) && v.lv <= lv)
      .slice(0, 3);
    for (const [itemKey, item] of allowedForShop) {
      const startStock = 300; // İlk 2 günü karşılar (~100 ürün/gün)
      defaultShelves[itemKey] = {
        item: itemKey, stock: startStock, max: 100 * 1,
        price: +(item.base * 1.2).toFixed(2),
        cost: item.base, totalSold: 0, totalRevenue: 0
      };
    }

    // Ayrıca ana depoya da başlangıç stoku koy (robot doldurmak için)
    const mainWHUpdates = {};
    for (const [itemKey] of allowedForShop) {
      mainWHUpdates[itemKey] = 500; // 500 birim depo stoku
    }
    if (Object.keys(mainWHUpdates).length > 0) {
      await db.ref(`businesses/${GZ.uid}/mainWarehouse`).update(mainWHUpdates);
    }

    await dbSet(`businesses/${GZ.uid}/shops/${id}`, {
      id, type, city, level: 1, employees: 1, createdAt: now(), shelves: defaultShelves
    });
    toast(`${def.icon} ${def.name} açıldı! ${Object.keys(defaultShelves).length} varsayılan reyon eklendi. (${city})`, 'success', 4000);
  };

  /* ─── addShelf: dükkan tipine uygun ürünü kontrol et ─── */
  const _origAddShelf = window.addShelf;
  window.addShelf = async function (shopId, itemKey) {
    const item = window.URUNLER[itemKey];
    if (!item) return toast('Geçersiz ürün', 'error');

    // Dükkan türünü çek
    const shop = await dbGet(`businesses/${GZ.uid}/shops/${shopId}`);
    if (!shop) return toast('Dükkan bulunamadı', 'error');
    const def = SHOP_CATALOG[shop.type];
    if (!def) return toast('Bilinmeyen dükkan türü', 'error');

    // ⛔ KATEGORİ KONTROLÜ
    if (!def.cats.includes(item.cat)) {
      const allowed = def.cats.map(c => window.URUN_KATEGORI_TUM[c] || c).join(', ');
      return toast(`❌ ${item.name} burada satılmaz! ${def.name} sadece şunları satabilir: ${allowed}`, 'error', 5000);
    }

    if ((GZ.data?.level || 1) < item.lv) return toast(`${item.lv}. seviyede açılır`, 'warn');
    const exist = await dbGet(`businesses/${GZ.uid}/shops/${shopId}/shelves/${itemKey}`);
    if (exist) return toast('Bu reyon zaten var', 'warn');

    const cost = 500;
    const ok = await spendCash(GZ.uid, cost, 'add-shelf');
    if (!ok) return toast(`Reyon kurulum: ${cashFmt(cost)} gerekli`, 'error');

    await dbSet(`businesses/${GZ.uid}/shops/${shopId}/shelves/${itemKey}`, {
      item: itemKey, stock: 0, max: 50,
      price: +(item.base * 1.2).toFixed(2),
      cost: 0, totalSold: 0, totalRevenue: 0
    });
    toast(`${item.emo} ${item.name} reyonu eklendi`, 'success');
  };

  /* ══════════════════════════════════════════════════════════════════════
     UI YARDIMCISI: Reyon seçici (ui-manager'ın eski seçicisini geçersiz kılar)
     ══════════════════════════════════════════════════════════════════════ */

  // Bu fonksiyon ui-manager.js'de "<select>" yerine kullanılır.
  // Sadece dükkan tipinin izin verdiği ürünleri gösterir, kategoriye gruplar.
  window.renderShelfPicker = function (shopType, currentlyShelvedKeys = []) {
    const def = SHOP_CATALOG[shopType];
    if (!def) return '<div class="empty-state">Bilinmeyen dükkan türü</div>';
    const lv = GZ.data?.level || 1;
    const items = window.getAllowedItems(shopType);
    if (!items.length) return '<div class="empty-state">Bu dükkan türü için ürün tanımlı değil</div>';

    // Kategoriye göre grupla
    const byCat = {};
    items.forEach(it => {
      const k = it.cat;
      if (!byCat[k]) byCat[k] = [];
      byCat[k].push(it);
    });

    let html = `<div class="shelf-picker-info">
      <b>${def.icon} ${def.name}</b> · Sadece şu kategorilerden ürün satılabilir:
      <span class="muted">${def.cats.map(c => window.URUN_KATEGORI_TUM[c] || c).join(', ')}</span>
    </div>`;

    for (const cat of Object.keys(byCat)) {
      html += `<div class="shelf-picker-cat-name">${window.URUN_KATEGORI_TUM[cat] || cat}</div>`;
      html += '<div class="shelf-picker-grid">';
      for (const item of byCat[cat]) {
        const locked = lv < item.lv;
        const exists = currentlyShelvedKeys.includes(item.key);
        const klass = locked ? 'locked' : exists ? 'exists' : '';
        const action = (locked || exists) ? '' : `onclick="addShelfFromPicker('${item.key}')"`;
        const status = exists ? '✓ Var' : locked ? `🔒 Lv ${item.lv}` : '500₺';
        html += `
          <div class="shelf-picker-item ${klass}" ${action}>
            <span class="spi-emo">${item.emo}</span>
            <div class="spi-info">
              <div class="spi-name">${item.name}</div>
              <div class="spi-base">Maliyet: ${cashFmt(item.base)}/${item.unit}</div>
            </div>
            <span class="spi-status">${status}</span>
          </div>`;
      }
      html += '</div>';
    }
    return html;
  };

  // Reyon seçicisinden ürün ekleme — açık olan dükkan id'sini global tutar
  window._shelfPickerShopId = null;
  window.openShelfPicker = async function (shopId) {
    const shop = await dbGet(`businesses/${GZ.uid}/shops/${shopId}`);
    if (!shop) return toast('Dükkan yok', 'error');
    window._shelfPickerShopId = shopId;
    const shelves = Object.keys(shop.shelves || {});
    showModal('Reyon Ekle', window.renderShelfPicker(shop.type, shelves));
  };
  window.addShelfFromPicker = async function (itemKey) {
    if (!window._shelfPickerShopId) return;
    await window.addShelf(window._shelfPickerShopId, itemKey);
    closeModal();
    // dükkan sayfasını yenile
    if (typeof window.refreshCurrentTab === 'function') window.refreshCurrentTab();
    else if (typeof window.switchTab === 'function') window.switchTab(GZ.currentTab || 'dukkan');
  };

  /* ══════════════════════════════════════════════════════════════════════
     YENİ DÜKKAN AÇMA SAYFASI (kategori-bazlı, görsel)
     ══════════════════════════════════════════════════════════════════════ */
  window.renderShopBuilder = function (city) {
    const lv = GZ.data?.level || 1;
    let html = `<div class="page-title">🏪 Yeni Dükkan Aç <span class="muted">${city}</span></div>
      <p class="small muted mb-12">Her dükkan türü <b>sadece kendi kategorisindeki ürünleri</b> satabilir. Et market'te değil kasapta, telefon manavda değil elektronikçide!</p>`;

    html += '<div class="shop-builder-grid">';
    Object.entries(SHOP_CATALOG).forEach(([type, def]) => {
      const locked = lv < def.lv;
      const cats = def.cats.map(c => window.URUN_KATEGORI_TUM[c] || c).join(' · ');
      html += `
        <div class="shop-build-card ${locked ? 'locked' : ''}">
          <div class="sbc-icon">${def.icon}</div>
          <div class="sbc-name">${def.name}</div>
          <div class="sbc-cats">${cats}</div>
          <div class="sbc-meta">
            <span>Lv ${def.lv}</span>
            <span class="green">${cashFmt(def.cost)}</span>
          </div>
          ${locked
            ? `<button class="btn-secondary" disabled>🔒 Lv ${def.lv}</button>`
            : `<button class="btn-primary" onclick="window.buyShop('${type}','${city}'); closeModal();">Aç</button>`
          }
        </div>`;
    });
    html += '</div>';
    return html;
  };

  console.log('[urun-katalog] Yüklendi: ' + Object.keys(SHOP_CATALOG).length + ' dükkan türü, ' + Object.keys(window.URUNLER).length + ' ürün');
})();

/* ============================================================
   EK ÜRÜNLER — Elektronik, Otomotiv, Yapı, Eczane kategorileri
   ============================================================ */
(function(){
  if (!window.URUNLER) return;
  const ek = {
    // Elektronik
    televizyon:   { name:'Televizyon',      emo:'📺', base:4500, cat:'elektronik', unit:'Adet', lv:5 },
    telefon:      { name:'Akıllı Telefon',  emo:'📱', base:8000, cat:'elektronik', unit:'Adet', lv:5 },
    laptop:       { name:'Laptop',          emo:'💻', base:12000,cat:'elektronik', unit:'Adet', lv:7 },
    tablet:       { name:'Tablet',          emo:'📱', base:6000, cat:'elektronik', unit:'Adet', lv:6 },
    kamera:       { name:'Fotoğraf Makinesi',emo:'📷',base:7500, cat:'elektronik', unit:'Adet', lv:8 },
    kulaklık:     { name:'Kulaklık',        emo:'🎧', base:800,  cat:'elektronik', unit:'Adet', lv:5 },
    // Beyaz eşya
    buzdolabi:    { name:'Buzdolabı',       emo:'🧊', base:9000, cat:'beyazesya',  unit:'Adet', lv:8 },
    camasir_mak:  { name:'Çamaşır Makinesi',emo:'🫧', base:7500, cat:'beyazesya',  unit:'Adet', lv:8 },
    klima:        { name:'Klima',           emo:'❄️', base:11000,cat:'beyazesya',  unit:'Adet', lv:9 },
    firin_ev:     { name:'Fırın (Ev)',      emo:'🔥', base:5000, cat:'beyazesya',  unit:'Adet', lv:8 },
    // Mobilya
    koltuk:       { name:'Koltuk Takımı',   emo:'🛋️', base:8500, cat:'mobilya',   unit:'Adet', lv:8 },
    masa:         { name:'Yemek Masası',    emo:'🪑', base:3500, cat:'mobilya',    unit:'Adet', lv:8 },
    dolap:        { name:'Gardırop',        emo:'🗄️', base:5000, cat:'mobilya',    unit:'Adet', lv:8 },
    yatak:        { name:'Yatak Takımı',    emo:'🛏️', base:6000, cat:'mobilya',    unit:'Adet', lv:9 },
    // Otomotiv
    lastik:       { name:'Lastik (4\'lü)',  emo:'🔧', base:2400, cat:'otomotiv',   unit:'Set',  lv:15 },
    motor_yagi:   { name:'Motor Yağı',      emo:'🛢️', base:350,  cat:'otomotiv',   unit:'Litre',lv:12 },
    akü:          { name:'Akü',            emo:'🔋', base:1200, cat:'otomotiv',   unit:'Adet', lv:12 },
    // Yapı market
    boya:         { name:'Dış Cephe Boya', emo:'🎨', base:320,  cat:'yapi',       unit:'Litre',lv:8 },
    boru:         { name:'Su Borusu',      emo:'🔩', base:45,   cat:'yapi',       unit:'Metre',lv:8 },
    cam:          { name:'Cam (m²)',       emo:'🪟', base:180,  cat:'yapi',       unit:'m²',   lv:8 },
    // Eczane
    agri_kesici:  { name:'Ağrı Kesici',    emo:'💊', base:45,   cat:'eczane',     unit:'Kutu', lv:6 },
    vitamin:      { name:'Vitamin C',      emo:'🍋', base:85,   cat:'eczane',     unit:'Kutu', lv:6 },
    sabun:        { name:'Sıvı Sabun',     emo:'🧴', base:25,   cat:'eczane',     unit:'Litre',lv:6 },
    sampuan:      { name:'Şampuan',        emo:'🧴', base:55,   cat:'eczane',     unit:'Şişe', lv:6 },
    // Benzin
    benzin95:     { name:'Benzin 95',      emo:'⛽', base:45,   cat:'akaryakit',  unit:'Litre',lv:12 },
    benzin98:     { name:'Benzin 98',      emo:'⛽', base:52,   cat:'akaryakit',  unit:'Litre',lv:12 },
    mazot:        { name:'Motorin',        emo:'⛽', base:42,   cat:'akaryakit',  unit:'Litre',lv:12 },
    // Kuyumcu
    altin_bilis:  { name:'Altın Bilezik',  emo:'💛', base:18000,cat:'kuyumcu',   unit:'Adet', lv:12 },
    gumus_kolye:  { name:'Gümüş Kolye',    emo:'🪙', base:850,  cat:'kuyumcu',   unit:'Adet', lv:12 },
    elmas_yuzuk:  { name:'Elmas Yüzük',    emo:'💍', base:45000,cat:'kuyumcu',   unit:'Adet', lv:15 },
  };
  Object.assign(window.URUNLER, ek);

  // Kategori adları güncelle
  if (window.URUN_KATEGORI){
    Object.assign(window.URUN_KATEGORI, {
      elektronik: 'Elektronik',
      beyazesya:  'Beyaz Eşya',
      mobilya:    'Mobilya',
      otomotiv:   'Otomotiv',
      yapi:       'Yapı Market',
      eczane:     'Eczane & Kozmetik',
      akaryakit:  'Akaryakıt',
      kuyumcu:    'Kuyumcu',
    });
  }
  if (window.URUN_KATEGORI_TUM){
    Object.assign(window.URUN_KATEGORI_TUM, window.URUN_KATEGORI);
  }
  console.log('[urun-katalog] Ek ürünler yüklendi:', Object.keys(ek).length, 'yeni ürün');
})();

/* ============================================================
   oyun-guncellemeler.js — v2.0 Oyun Güncellemeleri
   ============================================================ */
/* ============================================================
   oyun-guncellemeler.js — v2.0 Oyun Güncellemeleri
   ─────────────────────────────────────────────────────────
   index.html'e admin-panel.js'den SONRA ekle:
     <script src="oyun-guncellemeler.js"></script>

   İÇERİK:
   1. Dükkan Tekil Kilidi — Her tür dükkan sadece 1 kez açılabilir
   2. Market Fiyat Karşılaştırma — Reyona tıklayınca rakip fiyatlar
   3. Bahçe/Üretim Görsel Detayları — İsimli bahçeler, görseller
   4. Satış Geliri Toplama — Para otomatik eklenmiyor, tıklayarak toplanır
   5. Marka Detayları — Tıklanabilir, katıl/çık, ortaklaşa üretim
   6. Çalışan Otomatik Atama — Şubeye göre, tek tıklama maaş
   ============================================================ */

(function GameUpdates() {
  
  /* ════════════════════════════════════════════════════════
     1. DÜKKAN TEKİL KİLİDİ
     Her türden sadece 1 dükkan açılabilir.
     ════════════════════════════════════════════════════════ */
  const _origBuyShop = window.buyShop;
  window.buyShop = async function (type, city) {
    const shops = await dbGet(`businesses/${GZ.uid}/shops`) || {};
    const existing = Object.values(shops).find(s => s.type === type);
    if (existing) {
      const def = window.SHOP_CATALOG?.[type];
      const name = def ? def.name : type;
      toast(`❌ Zaten bir ${name} var! Her türden sadece 1 dükkan açılabilir.`, 'error', 4000);
      return;
    }
    if (typeof _origBuyShop === 'function') return _origBuyShop(type, city);
  };

  /* ════════════════════════════════════════════════════════
     2. MARKET FIYAT KARŞILAŞTIRMA
     Reyona tıklayınca: stok ekle + firma fiyatları göster
     ════════════════════════════════════════════════════════ */

  // Piyasadaki firmalar — gerçekçi Türk market zincirleri
  const MARKET_FIRMALARI = {
    temel: [
      { firma: 'BİM', logo: '🟦' },
      { firma: 'A101', logo: '🟥' },
      { firma: 'ŞOK', logo: '🟧' },
      { firma: 'MİGROS', logo: '🟩' },
      { firma: 'CarrefourSA', logo: '⬛' },
    ],
    kahvalti: [
      { firma: 'BİM', logo: '🟦' },
      { firma: 'A101', logo: '🟥' },
      { firma: 'ŞOK', logo: '🟧' },
      { firma: 'MİGROS', logo: '🟩' },
    ],
    sebze: [
      { firma: 'Semt Pazarı', logo: '🟫' },
      { firma: 'Manav Zinciri', logo: '🟢' },
      { firma: 'Yeşilçarşı', logo: '🌿' },
    ],
    et: [
      { firma: 'Güven Et', logo: '🥩' },
      { firma: 'Aşçıoğlu', logo: '🔴' },
      { firma: 'Halk Et', logo: '🟤' },
    ],
    elektronik: [
      { firma: 'Teknosa', logo: '🔵' },
      { firma: 'MediaMarkt', logo: '⭕' },
      { firma: 'Vatan', logo: '🟡' },
      { firma: 'D&R', logo: '🟣' },
    ],
    beyazesya: [
      { firma: 'Arçelik', logo: '🔵' },
      { firma: 'Beko', logo: '🟦' },
      { firma: 'Vestel', logo: '🔴' },
    ],
    mobilya: [
      { firma: 'İkea', logo: '💛' },
      { firma: 'Bellona', logo: '🟤' },
      { firma: 'İstikbal', logo: '🟥' },
    ],
    kuyumcu: [
      { firma: 'Altın Pazarı', logo: '🌟' },
      { firma: 'Kuyum Atölyesi', logo: '💛' },
    ],
    otomotiv: [
      { firma: 'Bosch Servis', logo: '🔴' },
      { firma: 'Oto Teknik', logo: '⚙️' },
    ],
    akaryakit: [
      { firma: 'Opet', logo: '🟠' },
      { firma: 'Shell', logo: '🐚' },
      { firma: 'BP', logo: '🟢' },
      { firma: 'Total', logo: '🔴' },
    ],
    yapi: [
      { firma: 'Bauhaus', logo: '🟡' },
      { firma: 'Koçtaş', logo: '🟠' },
    ],
    eczane: [
      { firma: 'Eczacıbaşı', logo: '💊' },
      { firma: 'Sağlıklı Yaşam', logo: '🌿' },
    ],
    firin: [
      { firma: 'Ekmek Fırını', logo: '🍞' },
      { firma: 'Lezzet Pastanesi', logo: '🎂' },
    ],
  };

  // Fiyat dalgalanması — gerçekçi günlük değişim simüle eder
  function _firmaFiyat(basePrice) {
    // -15% ile +25% arası rastgele değişim
    const delta = (Math.random() * 0.40) - 0.15;
    return Math.round(basePrice * (1 + delta) * 100) / 100;
  }

  // Reyona tıklayınca fiyat karşılaştırma + stok modalı aç
  window.openShelfDetail = async function (sid, itemKey) {
    const shop = await dbGet(`businesses/${GZ.uid}/shops/${sid}`);
    if (!shop) return;
    const shelves = shop.shelves || {};
    const sh = shelves[itemKey];
    if (!sh) return;
    const u = URUNLER?.[itemKey];
    if (!u) return;

    const cat = u.cat;
    const firmalar = MARKET_FIRMALARI[cat] || MARKET_FIRMALARI.temel;

    // Rastgele ama tutarlı (aynı gün hep aynı) fiyat
    const seed = new Date().toDateString() + itemKey;
    const seedNum = [...seed].reduce((a, c) => a + c.charCodeAt(0), 0);
    const rng = (i) => {
      const x = Math.sin(seedNum + i * 9301) * 9301;
      return x - Math.floor(x);
    };

    const firmaFiyatlari = firmalar.map((f, i) => ({
      ...f,
      fiyat: Math.round(u.base * (0.88 + rng(i) * 0.42) * 100) / 100,
    })).sort((a, b) => a.fiyat - b.fiyat);

    const enUcuz = firmaFiyatlari[0];
    const benimFiyat = sh.price || u.base;
    const stokPct = Math.min(100, ((sh.stock || 0) / (sh.max || 50)) * 100);
    const stokCls = stokPct < 20 ? 'color:#ef4444' : stokPct < 50 ? 'color:#f59e0b' : 'color:#22c55e';

    // Bekleyen gelir hesapla
    const bekleyenGelir = sh.pendingRevenue || 0;

    const body = `
      <div style="background:#1e293b;border-radius:12px;padding:14px;margin-bottom:12px;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
          <span style="font-size:32px">${u.emo}</span>
          <div>
            <div style="font-weight:700;color:#e2e8f0;font-size:15px">${u.name}</div>
            <div style="color:#64748b;font-size:12px">${u.unit} birimi</div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;">
          <div style="background:#0f172a;border-radius:8px;padding:10px;text-align:center;">
            <div style="color:#64748b;font-size:11px">Stok</div>
            <div style="font-weight:700;font-size:16px;${stokCls}">${sh.stock || 0}/${sh.max || 50}</div>
          </div>
          <div style="background:#0f172a;border-radius:8px;padding:10px;text-align:center;">
            <div style="color:#64748b;font-size:11px">Satış Fiyatın</div>
            <div style="font-weight:700;font-size:16px;color:#22c55e">${cashFmt(benimFiyat)}</div>
          </div>
        </div>
        ${bekleyenGelir > 0 ? `
        <div style="background:linear-gradient(135deg,#065f46,#047857);border-radius:10px;padding:12px;margin-bottom:10px;display:flex;align-items:center;justify-content:space-between;">
          <div>
            <div style="color:#a7f3d0;font-size:12px">💰 Toplanacak Gelir</div>
            <div style="color:#fff;font-weight:800;font-size:18px">${cashFmt(bekleyenGelir)}</div>
          </div>
          <button onclick="collectShelfRevenue('${sid}','${itemKey}',${bekleyenGelir})" style="background:#10b981;border:none;color:#fff;padding:10px 16px;border-radius:8px;cursor:pointer;font-weight:700;font-size:14px;">
            TOPLA 💰
          </button>
        </div>` : `
        <div style="background:#0f172a;border-radius:8px;padding:8px 12px;margin-bottom:10px;color:#475569;font-size:13px;">
          📭 Henüz toplanacak gelir yok
        </div>`}
        <div style="display:flex;gap:8px;">
          <button onclick="askBuyStock('${sid}','${itemKey}')" style="flex:1;padding:10px;background:#3b82f6;border:none;color:#fff;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;">+ Stok Al</button>
          <button onclick="askSetPrice('${sid}','${itemKey}',${benimFiyat})" style="flex:1;padding:10px;background:#7c3aed;border:none;color:#fff;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;">💰 Fiyat Ayarla</button>
          <button onclick="askDeleteShelf('${sid}','${itemKey}')" style="padding:10px 14px;background:#dc2626;border:none;color:#fff;border-radius:8px;cursor:pointer;font-size:13px;">🗑️</button>
        </div>
      </div>

      <div style="background:#1e293b;border-radius:12px;padding:14px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
          <h3 style="margin:0;color:#e2e8f0;font-size:14px;">📊 Piyasa Fiyat Karşılaştırması</h3>
          <span style="color:#64748b;font-size:11px">Bugünkü fiyatlar</span>
        </div>
        ${firmaFiyatlari.map((f, i) => {
          const isMin = i === 0;
          const isMax = i === firmaFiyatlari.length - 1;
          const isMine = Math.abs(benimFiyat - f.fiyat) < 1;
          const diff = ((benimFiyat - f.fiyat) / f.fiyat * 100).toFixed(1);
          return `
            <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;border-radius:8px;margin-bottom:6px;background:${isMin ? 'rgba(34,197,94,0.1)' : '#0f172a'};border:1px solid ${isMin ? 'rgba(34,197,94,0.3)' : '#1e293b'};">
              <div style="display:flex;align-items:center;gap:8px;">
                <span style="font-size:18px">${f.logo}</span>
                <div>
                  <div style="color:#e2e8f0;font-size:13px;font-weight:600">${f.firma}</div>
                  ${isMin ? '<div style="color:#22c55e;font-size:11px">✓ En ucuz</div>' : ''}
                  ${isMax ? '<div style="color:#ef4444;font-size:11px">En pahalı</div>' : ''}
                </div>
              </div>
              <div style="text-align:right;">
                <div style="font-weight:700;color:${isMin ? '#22c55e' : '#e2e8f0'};font-size:14px">${cashFmt(f.fiyat)}</div>
                <div style="font-size:11px;color:#64748b">/${u.unit}</div>
              </div>
            </div>
          `;
        }).join('')}
        <div style="margin-top:10px;padding:10px;background:#0f172a;border-radius:8px;text-align:center;">
          <span style="color:#94a3b8;font-size:12px">Senin fiyatın: </span>
          <span style="color:#22c55e;font-weight:700">${cashFmt(benimFiyat)}</span>
          <span style="color:#64748b;font-size:12px"> · En ucuz olan ${enUcuz.firma}'dan </span>
          <span style="color:${benimFiyat <= enUcuz.fiyat ? '#22c55e' : '#f59e0b'};font-weight:700">${benimFiyat <= enUcuz.fiyat ? '✓ Rekabetçi' : '⬆️ Daha pahalı'}</span>
        </div>
        <div style="margin-top:8px;padding:10px;background:#1e3a5f;border-radius:8px;font-size:12px;color:#93c5fd;">
          💡 <b>İpucu:</b> ${enUcuz.firma} en ucuz fiyatla ${cashFmt(enUcuz.fiyat)}/${u.unit} satıyor. ${benimFiyat > enUcuz.fiyat ? 'Fiyatını düşürmeyi düşün!' : 'Harika! En uygun fiyatla rekabet ediyorsun.'}
        </div>
      </div>
    `;

    showModal(`${u.emo} ${u.name}`, body);
  };

  // Gelir toplama fonksiyonu
  window.collectShelfRevenue = async function (sid, itemKey, amount) {
    closeModal();
    await dbUpdate(`businesses/${GZ.uid}/shops/${sid}/shelves/${itemKey}`, {
      pendingRevenue: 0
    });
    await addCash(GZ.uid, amount, 'shelf-revenue-collect');
    toast(`💰 ${cashFmt(amount)} hesabına eklendi!`, 'success', 3000);
    await addXP(GZ.uid, Math.floor(amount / 100));

    // Dükkan sayfasını yenile
    if (typeof openShop === 'function') openShop(sid);
  };
  window.collectShelfRevenue = window.collectShelfRevenue;

  /* ════════════════════════════════════════════════════════
     3. REYONA TIKLANDIĞINDA MODAL AÇ (openShop override)
     ════════════════════════════════════════════════════════ */
  const _origOpenShop = window.openShop;
  window.openShop = async function (sid) {
    const s = await dbGet(`businesses/${GZ.uid}/shops/${sid}`);
    if (!s) return;
    const shelves = s.shelves || {};
    const totalPendingRevenue = Object.values(shelves).reduce((a, sh) => a + (sh.pendingRevenue || 0), 0);

    let body = `
      <div class="stats-grid">
        <div class="stat-box"><div class="lbl">Seviye</div><div class="val">${s.level || 1}</div></div>
        <div class="stat-box"><div class="lbl">Çalışan</div><div class="val">${s.employees || 1}</div></div>
        <div class="stat-box"><div class="lbl">Şehir</div><div class="val" style="font-size:13px">${s.city}</div></div>
        <div class="stat-box"><div class="lbl">Reyonlar</div><div class="val">${Object.keys(shelves).length}</div></div>
      </div>
      ${totalPendingRevenue > 0 ? `
      <div onclick="collectAllRevenue('${sid}')" style="background:linear-gradient(135deg,#065f46,#047857);border-radius:12px;padding:14px;margin-bottom:12px;cursor:pointer;display:flex;align-items:center;justify-content:space-between;">
        <div>
          <div style="color:#a7f3d0;font-size:12px">💰 Toplam Bekleyen Gelir</div>
          <div style="color:#fff;font-weight:800;font-size:20px">${cashFmt(totalPendingRevenue)}</div>
        </div>
        <div style="background:#10b981;padding:10px 16px;border-radius:8px;color:#fff;font-weight:700;">TÜMÜNÜ TOPLA</div>
      </div>` : ''}
      <div class="flex gap-8 mb-12">
        <button class="btn-primary" style="flex:1" onclick="openShelfPicker('${sid}')">+ Yeni Reyon</button>
        <button class="btn-secondary" style="flex:1" onclick="upgradeShop('${sid}').then(()=>{closeModal();openShop('${sid}')})">⬆️ Yükselt</button>
      </div>
      <div class="section-title">REYONLAR (Detay için tıkla)</div>
    `;

    if (Object.keys(shelves).length === 0) {
      body += `<div class="empty-state"><div class="emoji">📦</div><h3>Boş reyon</h3><p>Reyona ürün eklemeden satış olmaz</p></div>`;
    } else {
      for (const k of Object.keys(shelves)) {
        const sh = shelves[k];
        const u = URUNLER?.[k]; if (!u) continue;
        const pct = Math.min(100, ((sh.stock || 0) / (sh.max || 1)) * 100);
        const cls = pct < 20 ? 'empty' : pct < 50 ? 'warn' : '';
        const pending = sh.pendingRevenue || 0;
        body += `
          <div class="shelf-item" onclick="openShelfDetail('${sid}','${k}')" style="cursor:pointer;position:relative;">
            ${pending > 0 ? `<div style="position:absolute;top:8px;right:8px;background:#10b981;color:#fff;padding:2px 8px;border-radius:99px;font-size:11px;font-weight:700;">💰 ${cashFmt(pending)}</div>` : ''}
            <div class="shelf-head">
              <div class="shelf-emoji">${u.emo}</div>
              <div class="shelf-name">
                ${u.name}
                <div class="shelf-stock">${sh.stock || 0} / ${sh.max || 50} ${u.unit}</div>
              </div>
            </div>
            <div class="shelf-prog"><div class="shelf-prog-fill ${cls}" style="width:${pct}%"></div></div>
            <div class="shelf-row">
              <span class="muted">Satış: ${fmtInt(sh.totalSold || 0)}</span>
              <span class="price">${cashFmt(sh.price || 0)}</span>
            </div>
          </div>
        `;
      }
    }
    showModal((window.SHOP_CATALOG?.[s.type]?.name || s.type) + ' • ' + s.city, body);
  };

  window.collectAllRevenue = async function (sid) {
    const shelves = await dbGet(`businesses/${GZ.uid}/shops/${sid}/shelves`) || {};
    let total = 0;
    const updates = {};
    Object.entries(shelves).forEach(([k, sh]) => {
      if ((sh.pendingRevenue || 0) > 0) {
        total += sh.pendingRevenue;
        updates[`businesses/${GZ.uid}/shops/${sid}/shelves/${k}/pendingRevenue`] = 0;
      }
    });
    if (total === 0) return toast('Toplanacak gelir yok', 'info');
    await firebase.database().ref().update(updates);
    await addCash(GZ.uid, total, 'collect-all-revenue');
    toast(`💰 ${cashFmt(total)} hesabına eklendi!`, 'success', 4000);
    closeModal();
    openShop(sid);
  };
  window.collectAllRevenue = window.collectAllRevenue;

  /* ════════════════════════════════════════════════════════
     4. BAHÇE GELİŞTİRME — İsimli bahçeler, görsel ikonlar
     ════════════════════════════════════════════════════════ */

  const BAHCE_TIPLERI = {
    domates:  { name: 'Domates Bahçesi',   emo: '🍅', bgColor: '#7f1d1d', items: ['domates'] },
    elma:     { name: 'Elma Bahçesi',      emo: '🍎', bgColor: '#14532d', items: ['elma','armut'] },
    bugday:   { name: 'Buğday Tarlası',    emo: '🌾', bgColor: '#713f12', items: ['bugday','misir'] },
    findik:   { name: 'Fındık Bahçesi',    emo: '🌰', bgColor: '#431407', items: ['findik'] },
    sebze:    { name: 'Sebze Bahçesi',     emo: '🥦', bgColor: '#14532d', items: ['salatalik','biber','havuc','marul'] },
    meyve:    { name: 'Meyve Bahçesi',     emo: '🍊', bgColor: '#7c2d12', items: ['portakal','muz','cilek','karpuz'] },
    zeytin:   { name: 'Zeytin Bahçesi',    emo: '🫒', bgColor: '#365314', items: ['zeytin'] },
    genel:    { name: 'Genel Tarla',       emo: '🌱', bgColor: '#1a2e05', items: [] },
  };
  window.BAHCE_TIPLERI = BAHCE_TIPLERI;

  // Bahçe render override — görsel isimli kartlar
  const _origRenderBahce = window.render;
  window._renderBahceDetayli = async function () {
    const main = document.getElementById('appMain');
    if (!main) return;
    const list = await dbGet(`businesses/${GZ.uid}/gardens`) || {};
    const lvl = GZ.data?.level || 1;

    let html = `<div class="page-title">🌱 Bahçelerim</div>
      <button class="btn-primary mb-12" onclick="buyNewBahce()" style="width:100%">+ Yeni Bahçe Aç</button>`;

    if (Object.keys(list).length === 0) {
      html += `<div class="empty-state"><div class="emoji">🌱</div><h3>Henüz bahçen yok</h3><p>İlk bahçeni aç, ürün yetiştir, para kazan!</p></div>`;
    } else {
      for (const id of Object.keys(list)) {
        const garden = list[id];
        const tip = garden.tipKey ? BAHCE_TIPLERI[garden.tipKey] : BAHCE_TIPLERI.genel;
        const isReady = garden.crop && garden.harvestAt && now() >= garden.harvestAt;
        const isGrowing = garden.crop && garden.harvestAt && now() < garden.harvestAt;
        const crop = URUNLER?.[garden.crop];

        let statusHtml = '';
        let actionHtml = '';

        if (isReady) {
          statusHtml = `<div style="color:#22c55e;font-weight:700;font-size:13px">✓ HASAT HAZIR: ${crop?.name || garden.crop}</div>`;
          actionHtml = `<button class="btn-primary" onclick="harvestAndOpenDetail('gardens','${id}')" style="width:100%">🌾 HASAT ET</button>`;
        } else if (isGrowing) {
          const rem = Math.max(0, garden.harvestAt - now());
          const m = Math.floor(rem / 60000), s = Math.floor((rem % 60000) / 1000);
          statusHtml = `
            <div style="color:#94a3b8;font-size:13px">${crop?.emo || '🌱'} ${crop?.name || garden.crop} büyüyor</div>
            <div style="color:#f59e0b;font-size:12px;margin-top:2px">⏱ ${m}d ${s}s kaldı</div>
            <div style="height:6px;background:#1e293b;border-radius:3px;margin-top:6px;overflow:hidden;">
              <div style="height:100%;background:linear-gradient(90deg,#22c55e,#86efac);border-radius:3px;width:${Math.min(100,100-(rem/(garden.growTime||3600000))*100)}%;transition:width 1s;"></div>
            </div>`;
          actionHtml = `<button class="btn-secondary" disabled style="width:100%;opacity:.5">⏳ Büyüyor...</button>`;
        } else {
          statusHtml = `<div style="color:#475569;font-size:13px">Boş — ekim yapılmadı</div>`;
          actionHtml = `<button class="btn-primary" onclick="openGardenDetail('${id}')" style="width:100%">🌱 Ekim Yap</button>`;
        }

        html += `
          <div style="background:linear-gradient(135deg,${tip.bgColor}44,#1e293b);border-radius:16px;border:1px solid ${tip.bgColor}66;margin-bottom:12px;overflow:hidden;">
            <div style="padding:14px;display:flex;align-items:center;gap:12px;border-bottom:1px solid rgba(255,255,255,0.05);">
              <div style="font-size:36px;line-height:1">${tip.emo}</div>
              <div style="flex:1">
                <div style="color:#e2e8f0;font-weight:700;font-size:15px">${garden.name || tip.name}</div>
                <div style="color:#64748b;font-size:12px">Lv ${garden.level || 1} · ID: ${id.slice(-4)}</div>
              </div>
              <button onclick="openGardenDetail('${id}')" style="background:rgba(255,255,255,0.1);border:none;color:#e2e8f0;padding:6px 10px;border-radius:8px;cursor:pointer;font-size:12px;">⚙️</button>
            </div>
            <div style="padding:12px 14px;">
              ${statusHtml}
              <div style="margin-top:10px">${actionHtml}</div>
            </div>
          </div>
        `;
      }
    }

    main.innerHTML = html;

    // Canlı geri sayım
    if (Object.values(list).some(g => g.crop && g.harvestAt && now() < g.harvestAt)) {
      setTimeout(() => {
        if (GZ.currentTab === 'bahce') window._renderBahceDetayli();
      }, 1000);
    }
  };

  // Bahçe detay modal
  window.openGardenDetail = async function (gardenId) {
    const garden = await dbGet(`businesses/${GZ.uid}/gardens/${gardenId}`);
    if (!garden) return;
    const tip = garden.tipKey ? BAHCE_TIPLERI[garden.tipKey] : BAHCE_TIPLERI.genel;

    // Ekim yapılabilecek ürünler
    const allItems = Object.entries(URUNLER || {}).filter(([k, u]) =>
      ['sebze', 'meyve', 'temel', 'kahvalti'].includes(u.cat)
    );

    let itemGrid = '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:10px;">';
    allItems.forEach(([k, u]) => {
      const locked = (GZ.data?.level || 1) < (u.lv || 1);
      itemGrid += `
        <div onclick="${locked ? '' : `plantCropAndRefresh('gardens','${gardenId}','${k}')`}" style="background:${locked ? '#0f172a' : '#1e293b'};border-radius:10px;padding:10px;text-align:center;cursor:${locked ? 'default' : 'pointer'};border:1px solid ${locked ? '#1e293b' : '#334155'};opacity:${locked ? '.4' : '1'};">
          <div style="font-size:24px">${u.emo}</div>
          <div style="color:#e2e8f0;font-size:11px;font-weight:600;margin-top:4px">${u.name}</div>
          ${locked ? `<div style="color:#64748b;font-size:10px">🔒 Lv${u.lv}</div>` : `<div style="color:#22c55e;font-size:10px">${cashFmt(u.base)}</div>`}
        </div>
      `;
    });
    itemGrid += '</div>';

    const body = `
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;background:#1e293b;padding:12px;border-radius:12px;">
        <span style="font-size:40px">${tip.emo}</span>
        <div>
          <div style="color:#e2e8f0;font-weight:700">${garden.name || tip.name}</div>
          <div style="color:#64748b;font-size:12px">Seviye ${garden.level || 1}</div>
        </div>
      </div>
      <div style="display:flex;gap:8px;margin-bottom:14px;">
        <button onclick="upgradeProductionUnit('gardens','${gardenId}').then(()=>{closeModal();openGardenDetail('${gardenId}')})" style="flex:1;padding:10px;background:#3b82f6;border:none;color:#fff;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;">⬆️ Seviye Yükselt (${cashFmt((garden.level||1)*2500)})</button>
        <button onclick="renameGarden('${gardenId}')" style="padding:10px 14px;background:#7c3aed;border:none;color:#fff;border-radius:8px;cursor:pointer;font-size:13px;">✏️ Yeniden Adlandır</button>
      </div>
      <div style="color:#94a3b8;font-size:14px;margin-bottom:8px;font-weight:600;">🌱 Ne Ekmek İstersin?</div>
      ${itemGrid}
    `;
    showModal(`${tip.emo} ${garden.name || tip.name}`, body);
  };

  window.plantCropAndRefresh = async function (kind, id, cropKey) {
    closeModal();
    if (typeof plantCrop === 'function') {
      await plantCrop(kind, id, cropKey);
    }
    window._renderBahceDetayli();
  };

  window.harvestAndOpenDetail = async function (kind, id) {
    if (typeof harvest === 'function') await harvest(kind, id);
    window._renderBahceDetayli();
  };

  window.renameGarden = async function (gardenId) {
    const yeniIsim = prompt('Bahçene yeni isim ver:');
    if (!yeniIsim || !yeniIsim.trim()) return;
    await dbUpdate(`businesses/${GZ.uid}/gardens/${gardenId}`, { name: yeniIsim.trim() });
    toast('✅ Bahçe adı güncellendi', 'success');
    openGardenDetail(gardenId);
  };

  window.buyNewBahce = function () {
    const tipleri = Object.entries(BAHCE_TIPLERI);
    const lv = GZ.data?.level || 1;
    const maliyet = 3500;
    let html = `<p style="color:#94a3b8;font-size:13px;margin-bottom:12px;">Bahçe türü seç — Maliyet: ${cashFmt(maliyet)}</p><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">`;
    tipleri.forEach(([key, tip]) => {
      html += `
        <div onclick="buyBahceTipi('${key}')" style="background:#1e293b;border-radius:12px;padding:14px;text-align:center;cursor:pointer;border:1px solid #334155;">
          <div style="font-size:30px">${tip.emo}</div>
          <div style="color:#e2e8f0;font-weight:600;font-size:13px;margin-top:6px">${tip.name}</div>
        </div>
      `;
    });
    html += '</div>';
    showModal('Yeni Bahçe Türü', html);
  };

  window.buyBahceTipi = async function (tipKey) {
    closeModal();
    const tip = BAHCE_TIPLERI[tipKey];
    const maliyet = 3500;
    const ok = await spendCash(GZ.uid, maliyet, 'buy-garden');
    if (!ok) return toast(`Yetersiz bakiye (${cashFmt(maliyet)})`, 'error');
    const id = 'grd_' + Math.random().toString(36).slice(2, 8);
    await dbSet(`businesses/${GZ.uid}/gardens/${id}`, {
      id, tipKey, name: tip.name, level: 1, createdAt: now()
    });
    toast(`${tip.emo} ${tip.name} açıldı!`, 'success', 3000);
    window._renderBahceDetayli();
  };

  /* ════════════════════════════════════════════════════════
     5. MARKA DETAYLARI — Katıl/Çık, Ortaklaşa Üretim
     ════════════════════════════════════════════════════════ */

  window.openBrandDetail = async function (brandId) {
    const brand = await dbGet(`brands/${brandId}`);
    if (!brand) return toast('Marka bulunamadı', 'error');
    const members = brand.members || {};
    const isMember = members[GZ.uid] !== undefined;
    const isOwner = brand.ownerId === GZ.uid;
    const memberCount = Object.keys(members).length;
    const myRole = members[GZ.uid]?.role || 'Üye';

    // Ortak üretim listesi
    const productions = brand.productions || {};
    const prodList = Object.entries(productions);

    const body = `
      <div style="background:linear-gradient(135deg,#1e3a5f,#1e293b);border-radius:12px;padding:16px;margin-bottom:12px;border:1px solid #3b82f6;">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
          <div style="font-size:40px">${brand.logo || '🏢'}</div>
          <div>
            <div style="color:#e2e8f0;font-weight:800;font-size:16px">${brand.name}</div>
            <div style="color:#93c5fd;font-size:12px">👥 ${memberCount} üye · ${isOwner ? '👑 Kurucu' : isMember ? `✅ ${myRole}` : '⬜ Üye değil'}</div>
          </div>
        </div>
        <div style="color:#94a3b8;font-size:13px;margin-bottom:12px">${brand.description || 'Açıklama yok'}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:12px;">
          <div style="background:#0f172a;border-radius:8px;padding:10px;text-align:center;">
            <div style="color:#64748b;font-size:11px">Seviye</div>
            <div style="color:#e2e8f0;font-weight:700">${brand.level || 1}</div>
          </div>
          <div style="background:#0f172a;border-radius:8px;padding:10px;text-align:center;">
            <div style="color:#64748b;font-size:11px">Üye</div>
            <div style="color:#e2e8f0;font-weight:700">${memberCount}</div>
          </div>
          <div style="background:#0f172a;border-radius:8px;padding:10px;text-align:center;">
            <div style="color:#64748b;font-size:11px">Gelir</div>
            <div style="color:#22c55e;font-weight:700">${cashFmt(brand.totalRevenue || 0)}</div>
          </div>
        </div>
        <div style="display:flex;gap:8px;">
          ${!isMember && !isOwner ? `<button onclick="joinBrand('${brandId}')" style="flex:1;padding:10px;background:#3b82f6;border:none;color:#fff;border-radius:8px;cursor:pointer;font-weight:700;">✅ Katıl</button>` : ''}
          ${isMember && !isOwner ? `<button onclick="leaveBrand('${brandId}')" style="flex:1;padding:10px;background:#dc2626;border:none;color:#fff;border-radius:8px;cursor:pointer;font-weight:700;">🚪 Ayrıl</button>` : ''}
          ${isOwner ? `<button onclick="openBrandManage('${brandId}')" style="flex:1;padding:10px;background:#7c3aed;border:none;color:#fff;border-radius:8px;cursor:pointer;font-weight:700;">⚙️ Yönet</button>` : ''}
          ${isMember || isOwner ? `<button onclick="openBrandProduction('${brandId}')" style="flex:1;padding:10px;background:#059669;border:none;color:#fff;border-radius:8px;cursor:pointer;font-weight:700;">🏭 Ortak Üretim</button>` : ''}
        </div>
      </div>

      <div style="background:#1e293b;border-radius:12px;padding:14px;margin-bottom:12px;">
        <h3 style="margin:0 0 10px;color:#e2e8f0;font-size:14px;">👥 Üyeler</h3>
        ${Object.entries(members).slice(0, 10).map(([uid, m]) => `
          <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid #0f172a;">
            <div>
              <span style="color:#e2e8f0;font-size:13px">${m.username || uid.slice(-6)}</span>
              <span style="color:#64748b;font-size:11px;margin-left:6px">${m.role || 'Üye'}</span>
            </div>
            ${isOwner && uid !== GZ.uid ? `<button onclick="grantBrandRole('${brandId}','${uid}')" style="padding:4px 8px;background:#334155;border:none;color:#e2e8f0;border-radius:6px;cursor:pointer;font-size:11px;">Rol Ver</button>` : ''}
          </div>
        `).join('')}
      </div>

      ${prodList.length > 0 ? `
      <div style="background:#1e293b;border-radius:12px;padding:14px;">
        <h3 style="margin:0 0 10px;color:#e2e8f0;font-size:14px;">🏭 Aktif Üretimler</h3>
        ${prodList.map(([pid, p]) => {
          const u = URUNLER?.[p.item];
          return `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #0f172a;">
            <span style="color:#e2e8f0;font-size:13px">${u?.emo || '📦'} ${u?.name || p.item}</span>
            <span style="color:#22c55e;font-size:13px">${fmtInt(p.amount || 0)} ${u?.unit || ''}</span>
          </div>`;
        }).join('')}
      </div>` : ''}
    `;

    showModal(`${brand.logo || '🏢'} ${brand.name}`, body);
  };

  window.joinBrand = async function (brandId) {
    const brand = await dbGet(`brands/${brandId}`);
    if (!brand) return;
    const userData = GZ.data || {};
    await dbUpdate(`brands/${brandId}/members/${GZ.uid}`, {
      username: userData.username || 'Anonim',
      joinedAt: now(),
      role: 'Üye',
      level: userData.level || 1,
    });
    toast(`✅ ${brand.name} markasına katıldın!`, 'success');
    openBrandDetail(brandId);
  };

  window.leaveBrand = async function (brandId) {
    if (!confirm('Markadan ayrılmak istiyor musun?')) return;
    await dbRemove(`brands/${brandId}/members/${GZ.uid}`);
    toast('🚪 Markadan ayrıldın', 'info');
    closeModal();
  };

  async function dbRemove(path) {
    try { await firebase.database().ref(path).remove(); return true; }
    catch (e) { return false; }
  }

  window.openBrandProduction = async function (brandId) {
    const allItems = Object.entries(URUNLER || {}).filter(([k, u]) =>
      ['temel', 'kahvalti', 'sebze', 'et', 'firin'].includes(u.cat)
    );
    let grid = '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:10px;">';
    allItems.slice(0, 18).forEach(([k, u]) => {
      grid += `<div onclick="startBrandProduction('${brandId}','${k}')" style="background:#1e293b;border-radius:10px;padding:10px;text-align:center;cursor:pointer;border:1px solid #334155;">
        <div style="font-size:24px">${u.emo}</div>
        <div style="color:#e2e8f0;font-size:11px;font-weight:600;margin-top:4px">${u.name}</div>
        <div style="color:#64748b;font-size:10px">${cashFmt(u.base)}</div>
      </div>`;
    });
    grid += '</div>';
    showModal('🏭 Ortak Üretim Başlat', `<p style="color:#94a3b8;font-size:13px;margin-bottom:8px;">Tüm üyeler katkıda bulunur, kazanç paylaşılır.</p>${grid}`);
  };

  window.startBrandProduction = async function (brandId, itemKey) {
    const amount = parseInt(prompt(`Kaç birim ${URUNLER?.[itemKey]?.name} üretelim?`) || '0');
    if (!amount || amount <= 0) return;
    const cost = (URUNLER?.[itemKey]?.base || 0) * amount * 0.7;
    const ok = await spendCash(GZ.uid, cost, 'brand-production');
    if (!ok) return toast(`Yetersiz bakiye (${cashFmt(cost)})`, 'error');
    const pid = 'prod_' + Math.random().toString(36).slice(2, 8);
    await dbSet(`brands/${brandId}/productions/${pid}`, {
      item: itemKey, amount, startedBy: GZ.uid, startedAt: now(), cost
    });
    toast(`🏭 Ortak üretim başlatıldı!`, 'success');
    closeModal();
  };

  window.grantBrandRole = async function (brandId, targetUid) {
    const role = prompt('Rol adı gir (örn: Müdür, Muhasebeci, Denetçi):');
    if (!role) return;
    await dbUpdate(`brands/${brandId}/members/${targetUid}`, { role: role.trim() });
    toast(`✅ Rol verildi: ${role}`, 'success');
  };

  window.openBrandManage = async function (brandId) {
    const brand = await dbGet(`brands/${brandId}`);
    showModal('⚙️ Marka Yönetimi', `
      <div style="display:flex;flex-direction:column;gap:10px;">
        <button onclick="upgradeBrand('${brandId}')" style="padding:12px;background:#3b82f6;border:none;color:#fff;border-radius:8px;cursor:pointer;font-weight:700;">⬆️ Marka Seviye Yükselt</button>
        <button onclick="sendBrandAnnouncement('${brandId}')" style="padding:12px;background:#7c3aed;border:none;color:#fff;border-radius:8px;cursor:pointer;font-weight:700;">📢 Üyelere Duyuru Gönder</button>
        <button onclick="openBrandProduction('${brandId}')" style="padding:12px;background:#059669;border:none;color:#fff;border-radius:8px;cursor:pointer;font-weight:700;">🏭 Ortak Üretim Başlat</button>
      </div>
    `);
  };

  window.sendBrandAnnouncement = async function (brandId) {
    const msg = prompt('Üyelere duyurmak istediğin mesaj:');
    if (!msg) return;
    const brand = await dbGet(`brands/${brandId}`);
    const members = brand?.members || {};
    const batch = {};
    Object.keys(members).forEach(uid => {
      const key = firebase.database().ref().push().key;
      batch[`users/${uid}/notifications/${key}`] = {
        text: `📢 [${brand.name}] ${msg}`, icon: '🏢', read: false, ts: now()
      };
    });
    await firebase.database().ref().update(batch);
    toast('📢 Duyuru gönderildi', 'success');
  };

  /* ════════════════════════════════════════════════════════
     6. ÇALIŞAN OTOMATİK ATAMA + TEK TIKLA MAAŞ
     ════════════════════════════════════════════════════════ */

  window.autoAssignEmployees = async function () {
    const shops = await dbGet(`businesses/${GZ.uid}/shops`) || {};
    const gardens = await dbGet(`businesses/${GZ.uid}/gardens`) || {};
    const factories = await dbGet(`businesses/${GZ.uid}/factories`) || {};
    const workers = await dbGet(`businesses/${GZ.uid}/workers`) || {};

    const totalWorkers = Object.keys(workers).length;
    const assignments = {};
    const allUnits = [
      ...Object.entries(shops).map(([id, s]) => ({ id, kind: 'shops', name: s.type, type: 'Dükkan' })),
      ...Object.entries(gardens).map(([id, g]) => ({ id, kind: 'gardens', name: g.name || 'Bahçe', type: 'Bahçe' })),
      ...Object.entries(factories).map(([id, f]) => ({ id, kind: 'factories', name: f.name || 'Fabrika', type: 'Fabrika' })),
    ];

    let assigned = 0;
    for (const unit of allUnits) {
      if (assigned >= totalWorkers) break;
      const needed = unit.kind === 'shops' ? 2 : 1;
      assignments[`businesses/${GZ.uid}/${unit.kind}/${unit.id}/employees`] = Math.min(needed, totalWorkers - assigned);
      assigned += needed;
    }

    if (Object.keys(assignments).length > 0) {
      await firebase.database().ref().update(assignments);
      toast(`✅ ${Object.keys(assignments).length} şubeye otomatik atama yapıldı!`, 'success', 3000);
    } else {
      toast('Atanacak çalışan veya şube yok', 'info');
    }
  };

  window.payAllSalaries = async function () {
    const workers = await dbGet(`businesses/${GZ.uid}/workers`) || {};
    const workerList = Object.entries(workers);
    if (workerList.length === 0) return toast('Çalışan yok', 'info');

    let totalSalary = 0;
    workerList.forEach(([wid, w]) => { totalSalary += (w.salary || 5000); });

    if (!confirm(`Toplam ${cashFmt(totalSalary)} maaş ödenecek. Devam?`)) return;

    const ok = await spendCash(GZ.uid, totalSalary, 'salary-payment');
    if (!ok) return toast(`Yetersiz bakiye (${cashFmt(totalSalary)})`, 'error');

    const now_ = now();
    const updates = {};
    workerList.forEach(([wid, w]) => {
      updates[`businesses/${GZ.uid}/workers/${wid}/lastPaid`] = now_;
    });
    await firebase.database().ref().update(updates);
    toast(`✅ ${workerList.length} çalışana toplam ${cashFmt(totalSalary)} maaş ödendi!`, 'success', 4000);
  };

  /* ════════════════════════════════════════════════════════
     7. RENDER TAB HOOK — Bahçe sekmesini yeni render ile değiştir
     ════════════════════════════════════════════════════════ */
  const _origRender = window.render;
  window.render = function (tab) {
    if (tab === 'bahce') {
      GZ.currentTab = 'bahce';
      window._renderBahceDetayli();
      return;
    }
    if (typeof _origRender === 'function') return _origRender(tab);
  };

  /* ════════════════════════════════════════════════════════
     8. MARKA LİSTESİ — Tıklanabilir markalar
     ════════════════════════════════════════════════════════ */
  const _origRenderMarka = window.renderMarka;
  window.renderMarka = async function () {
    const main = document.getElementById('appMain');
    if (!main) { if (typeof _origRenderMarka === 'function') return _origRenderMarka(); return; }

    const lv = GZ.data?.level || 1;
    if (lv < 10) {
      main.innerHTML = `<div class="locked-state"><div class="lock-icon">🔒</div><h3>10. Seviyede Açılacak</h3><p>Şu anki seviyen: ${lv}</p></div>`;
      return;
    }

    const brands = await dbGet('brands') || {};
    const myBrands = await dbGet(`users/${GZ.uid}/brands`) || {};

    let html = `<div class="page-title">🏢 Markalar</div>
      <button class="btn-primary mb-12" onclick="openCreateBrand()" style="width:100%">+ Yeni Marka Kur (10.000 ₺)</button>`;

    const brandList = Object.entries(brands);
    if (brandList.length === 0) {
      html += `<div class="empty-state"><div class="emoji">🏢</div><h3>Henüz marka yok</h3><p>İlk markayı sen kur!</p></div>`;
    } else {
      brandList.forEach(([bid, brand]) => {
        const members = brand.members || {};
        const isMember = members[GZ.uid] !== undefined;
        const isOwner = brand.ownerId === GZ.uid;
        html += `
          <div onclick="openBrandDetail('${bid}')" style="background:#1e293b;border-radius:14px;padding:14px;margin-bottom:10px;cursor:pointer;border:1px solid ${isMember || isOwner ? '#3b82f6' : '#334155'};">
            <div style="display:flex;align-items:center;gap:12px;">
              <span style="font-size:32px">${brand.logo || '🏢'}</span>
              <div style="flex:1">
                <div style="color:#e2e8f0;font-weight:700;font-size:15px">${brand.name} ${isOwner ? '👑' : isMember ? '✅' : ''}</div>
                <div style="color:#64748b;font-size:12px">👥 ${Object.keys(members).length} üye · Lv ${brand.level || 1}</div>
              </div>
              <span style="color:#64748b">›</span>
            </div>
            ${brand.description ? `<div style="color:#94a3b8;font-size:12px;margin-top:8px">${brand.description}</div>` : ''}
          </div>
        `;
      });
    }
    main.innerHTML = html;
  };

  window.openCreateBrand = function () {
    showModal('🏢 Yeni Marka Kur', `
      <p style="color:#94a3b8;font-size:13px;margin-bottom:12px;">Maliyet: 10.000 ₺. Markana üye toplayabilir, ortaklaşa üretim yapabilirsin.</p>
      <div class="input-group">
        <label>Marka Adı</label>
        <input type="text" id="newBrandName" placeholder="Örn: Karakaş Holding" maxlength="30">
      </div>
      <div class="input-group">
        <label>Logo (emoji)</label>
        <input type="text" id="newBrandLogo" placeholder="🏢" maxlength="5" value="🏢">
      </div>
      <div class="input-group">
        <label>Açıklama</label>
        <textarea id="newBrandDesc" placeholder="Marka hakkında kısa açıklama..." rows="2"></textarea>
      </div>
      <button class="btn-primary" style="width:100%" onclick="confirmCreateBrand()">Markayı Kur</button>
    `);
  };

  window.confirmCreateBrand = async function () {
    const name = document.getElementById('newBrandName')?.value.trim();
    const logo = document.getElementById('newBrandLogo')?.value.trim() || '🏢';
    const desc = document.getElementById('newBrandDesc')?.value.trim() || '';
    if (!name) return toast('Marka adı gerekli', 'error');

    const cost = 10000;
    const ok = await spendCash(GZ.uid, cost, 'create-brand');
    if (!ok) return toast(`Yetersiz bakiye (${cashFmt(cost)})`, 'error');

    const bid = 'brand_' + Math.random().toString(36).slice(2, 10);
    const userData = GZ.data || {};
    await dbSet(`brands/${bid}`, {
      id: bid, name, logo, description: desc,
      ownerId: GZ.uid, level: 1, createdAt: now(),
      members: {
        [GZ.uid]: { username: userData.username || 'Kurucu', role: 'Kurucu', joinedAt: now() }
      },
      totalRevenue: 0,
    });
    await dbUpdate(`users/${GZ.uid}/brands`, { [bid]: true });
    toast(`🏢 ${name} markası kuruldu!`, 'success', 4000);
    closeModal();
    window.renderMarka();
  };

  /* ════════════════════════════════════════════════════════
     9. BAŞLANGIÇ — Tüm özellikleri hazırla
     ════════════════════════════════════════════════════════ */
  console.log('%c[OyunGuncellemeler] ✅ v2.0 yüklendi', 'color:#22c55e;font-weight:bold');

})();


/* ─── ui-manager.js ─── */
/* ==========================================================================
   ui-manager.js — UI Render & Navigasyon & Modaller
   ========================================================================== */

function initUI(){
  // Her zaman dark tema zorla
  document.documentElement.setAttribute('data-theme', 'dark');
  localStorage.setItem('theme', 'dark');

  // Eski bottomNav'ı gizle (konsol-manager kendi nav'ını ekliyor)
  const oldNav = document.getElementById('bottomNav');
  if (oldNav) oldNav.style.display = 'none';

  // Eski navbtn event'lerini bağla (compat — konsol-manager override eder)
  $$('#bottomNav .navbtn').forEach(b => {
    b.addEventListener('click', () => switchTab(b.dataset.tab));
  });
  $$('[data-open]').forEach(b => {
    b.addEventListener('click', () => openTopbarModal(b.dataset.open));
  });

  // Bildirim sayısı
  db.ref(`notifs/${GZ.uid}`).on('value', s => {
    const list = s.val() || {};
    const unread = Object.values(list).filter(x=>!x.read).length;
    const el = $('#notifBadge');
    if (el) {
      if (unread > 0){ el.textContent = unread; el.hidden = false; }
      else el.hidden = true;
    }
  });

  // Sohbet rozeti
  db.ref('chat/global').limitToLast(1).on('value', s => {
    const lastSeen = parseInt(localStorage.getItem('chatLastSeen')||'0');
    const list = s.val() || {};
    const v = Object.values(list)[0];
    if (v && v.ts > lastSeen && v.uid !== GZ.uid){
      const el = $('#chatBadge');
      if (el) { el.textContent = '•'; el.hidden = false; }
    }
  });

  // Konsol başlat, sonra ilk sekmeyi yükle
  if (typeof initKonsol === 'function') {
    initKonsol();
    // Konsol hazır olduktan sonra dükkan sayfasını yükle
    setTimeout(() => switchTab('dukkan'), 50);
  } else {
    // initKonsol henüz yüklenmediyse bekle
    let tries = 0;
    const waitKonsol = setInterval(() => {
      tries++;
      if (typeof initKonsol === 'function') {
        clearInterval(waitKonsol);
        initKonsol();
        setTimeout(() => switchTab('dukkan'), 50);
      } else if (tries > 30) {
        clearInterval(waitKonsol);
        // Konsol yoksa direkt render et
        switchTab('dukkan');
      }
    }, 100);
  }
}
window.initUI = initUI;

function switchTab(tab){
  GZ.currentTab = tab;
  $$('#bottomNav .navbtn').forEach(b => b.classList.toggle('active', b.dataset.tab===tab));
  const active = $(`#bottomNav .navbtn.active`);
  if (active) active.scrollIntoView({ behavior:'smooth', inline:'center', block:'nearest' });
  render(tab);
}
window.switchTab = switchTab;

function render(tab){
  const main = $('#appMain');
  if (!main) return;
  main.innerHTML = `<div style="padding:40px;text-align:center"><div class="spinner" style="margin:0 auto"></div></div>`;
  switch(tab){
    case 'oyunpazari': renderOyunPazari(); break;
    case 'gorevler':   renderGorevler();   break;
    case 'basarimlar': renderBasarimlar(); break;
    case 'dukkan':   renderDukkan();   break;
    case 'bahce':    renderProduction('gardens',   'Bahçeler',    '🌱', ['domates','patates','sogan','elma','uzum','kiraz','kayisi','findik','zeytin']); break;
    case 'ciftlik':  renderProduction('farms',     'Çiftlikler',  '🐄', ['inek_sutu','keci_sutu','tavuk_yumurtasi','hindi_yumurtasi','kaz_yumurtasi','tavuk_eti','dana_eti','kuzu_eti','yun']); break;
    case 'fabrika':  renderProduction('factories', 'Fabrikalar',  '🏭', ['ekmek','pasta','dondurma','beyaz_peynir','kasar_peyniri','suzme_bal','petek_bal','polen','kimyasal_cozucu','cimento','keten_kumas','eldiven','siyah_cay','yesil_cay','bugday_unu','misir_unu','seker','ayicicek_yagi','zeytinyagi','findik_yagi']); break;
    case 'maden':    renderProduction('mines',     'Madenler',    '⛏️', ['altin','gumus','bakir','demir','kromit'], 30); break;
    case 'lojistik': renderLojistik(); break;
    case 'ihracat':  renderIhracat();  break;
    case 'ihale':    renderIhale();    break;
    case 'kripto':   renderKripto();   break;
    case 'banka':    renderBankaSekme(); break;
    case 'marka':    renderMarka();    break;
    case 'pazar':    renderPazar();    break;
    case 'liderlik': renderLiderlik(); break;
    case 'haberler': if(typeof renderHaberler==='function') renderHaberler(); else main.innerHTML=emptyState('📰','Haberler','Yükleniyor...'); break;
    case 'sehirler': renderSehirler(); break;
    case 'magaza':   if(typeof renderMagaza==='function') renderMagaza(); break;
    case 'oyunlar':  if (typeof renderOyunlar === 'function') renderOyunlar(); else $('#appMain').innerHTML = '<div class="empty-state"><h3>Mini Oyunlar yükleniyor...</h3></div>'; break;
    case 'hikaye':   if(typeof renderHikaye==='function') renderHikaye(); break;
    case 'sss':      if(typeof renderSSS==='function') renderSSS(); break;
    case 'kredi':       if(typeof renderKredi==='function') renderKredi(); break;
    case 'vergi':       if(typeof renderVergiOyuncu==='function') renderVergiOyuncu(); break;
    case 'muhtarlik':   if(typeof renderHaberler==='function') renderHaberler(); break;
    case 'sgk':         if(typeof renderSGK==='function') renderSGK(); else main.innerHTML=emptyState('🏥','SGK','Yakında aktif olacak'); break;
    case 'vergidairesi':if(typeof renderVergiOyuncu==='function') renderVergiOyuncu(); else main.innerHTML=emptyState('🏛️','Vergi Dairesi','Yakında aktif olacak'); break;
    case 'krediofisi':  if(typeof renderKredi==='function') renderKredi(); else main.innerHTML=emptyState('💳','Kredi Ofisi','Yakında aktif olacak'); break;
    case 'konkurato':   if(typeof renderKonkurato==='function') renderKonkurato(); else main.innerHTML=emptyState('📋','Borç Yapılandırma','Yükleniyor...'); break;
    case 'secim':       if(typeof renderSecim==='function') renderSecim(); else main.innerHTML=emptyState('🗳️','Seçim','Yakında aktif olacak'); break;
    case 'emniyet':     if(typeof renderPolis==='function') renderPolis(); else main.innerHTML=emptyState('👮','Emniyet','Yakında aktif olacak'); break;
    case 'askeriye':    if(typeof renderAskeriye==='function') renderAskeriye(); else main.innerHTML=emptyState('⚔️','Askeriye','Yakında aktif olacak'); break;
    case 'mahkeme':     if(typeof renderMahkeme==='function') renderMahkeme(); else main.innerHTML=emptyState('⚖️','Mahkeme','Yakında aktif olacak'); break;
    case 'noter':       if(typeof renderNoter==='function') renderNoter(); else main.innerHTML=emptyState('📋','Noterlik','Yakında aktif olacak'); break;
    case 'polis':       if(typeof renderPolis==='function') renderPolis(); else main.innerHTML=emptyState('🚔','Polis Merkezi','Yakında aktif olacak'); break;
    case 'jandarma':    if(typeof renderJandarma==='function') renderJandarma(); else main.innerHTML=emptyState('🪖','Jandarma','Yakında aktif olacak'); break;
    case 'itfaiye':     if(typeof renderItfaiye==='function') renderItfaiye(); else main.innerHTML=emptyState('🚒','İtfaiye','Yakında aktif olacak'); break;
    case 'sahilguz':    if(typeof renderSahilguz==='function') renderSahilguz(); else main.innerHTML=emptyState('⛵','Sahil Güvenlik','Yakında aktif olacak'); break;
    case 'cuzdan':      if(typeof renderCuzdan==='function') renderCuzdan(); else main.innerHTML=emptyState('👛','Dijital Cüzdan','Yakında aktif olacak'); break;
  }
}
window.render = render;
window.renderProduction = renderProduction;
window.renderBahce   = () => renderProduction('gardens',   'Bahçeler',   '🌱', ['domates','patates','sogan','elma','uzum','kiraz','kayisi','findik','zeytin']);
window.renderCiftlik = () => renderProduction('farms',     'Çiftlikler', '🐄', ['inek_sutu','keci_sutu','tavuk_yumurtasi','hindi_yumurtasi','kaz_yumurtasi','tavuk_eti','dana_eti','kuzu_eti','yun']);
window.renderFabrika = () => renderProduction('factories', 'Fabrikalar', '🏭', ['ekmek','pasta','dondurma','beyaz_peynir','kasar_peyniri','suzme_bal','petek_bal','polen','kimyasal_cozucu','cimento','keten_kumas','eldiven','siyah_cay','yesil_cay','bugday_unu','misir_unu','seker','ayicicek_yagi','zeytinyagi','findik_yagi']);
window.renderMaden   = () => renderProduction('mines',     'Madenler',   '⛏️', ['altin','gumus','bakir','demir','kromit'], 30);

function emptyState(emoji, title, sub){
  return `<div class="empty-state"><div class="emoji">${emoji}</div><h3>${title}</h3><p>${sub||''}</p></div>`;
}
function escapeHtml(s){
  return String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

/* ============================================================
   DÜKKANLAR
   ============================================================ */
async function renderDukkan(){
  const main = $('#appMain');
  if (!main) return;
  if (!window.GZ?.uid) {
    main.innerHTML = emptyState('🏪','Yükleniyor...','Lütfen bekleyin');
    return;
  }
  const shops = await dbGet(`businesses/${GZ.uid}/shops`) || {};
  const lvl = GZ.data?.level || 1;

  let html = `
    <div class="page-title">🏪 Dükkanlarım <span class="badge-info">Lv ${lvl}</span></div>
    <button class="btn-primary mb-12" onclick="modalNewShop()" style="width:100%">+ Yeni Dükkan</button>
  `;
  if (Object.keys(shops).length === 0){
    html += emptyState('🏪', 'Henüz dükkanın yok', 'İlk dükkanını aç ve para kazanmaya başla');
  } else {
    for (const sid of Object.keys(shops)){
      const s = shops[sid];
      const shelves = s.shelves || {};
      const shCount = Object.keys(shelves).length;
      const totalStock = Object.values(shelves).reduce((a,b)=>a+(b.stock||0),0);
      const totalRev = Object.values(shelves).reduce((a,b)=>a+(b.totalRevenue||0),0);
      html += `
        <div class="card" onclick="openShop('${sid}')">
          <div class="card-row">
            <div class="card-thumb">${shopEmoji(s.type)}</div>
            <div class="card-body">
              <div class="card-title">${shopTypeName(s.type)} <span class="small muted">Lv ${s.level||1}</span></div>
              <div class="card-sub">📍 ${s.city} • ${shCount} reyon • Stok: ${fmtInt(totalStock)}</div>
              <div class="card-sub green">Toplam ciro: ${cashFmt(totalRev)}</div>
            </div>
            <div class="muted">›</div>
          </div>
        </div>
      `;
    }
  }
  main.innerHTML = html;
}

function shopEmoji(t){
  if (window.SHOP_CATALOG && window.SHOP_CATALOG[t]) return window.SHOP_CATALOG[t].icon;
  return ({market:'🏪',elektronik:'📱',mobilya:'🛋️',kuyumcu:'💍',beyazesya:'🧊',otomotiv:'🚗',benzin:'⛽'})[t] || '🏪';
}
function shopTypeName(t){
  if (window.SHOP_CATALOG && window.SHOP_CATALOG[t]) return window.SHOP_CATALOG[t].name;
  return ({market:'Market',elektronik:'Elektronik',mobilya:'Mobilya',kuyumcu:'Kuyumcu',beyazesya:'Beyaz Eşya',otomotiv:'Otomotiv',benzin:'Benzin İstasyonu'})[t] || t;
}

async function modalNewShop(){
  const lv = GZ.data?.level||1;

  // Yeni: SHOP_CATALOG kullan (urun-katalog.js'den)
  if (window.SHOP_CATALOG){
    let html = `<p class="small muted mb-12">Her dükkan türü <b>sadece kendi kategorisindeki ürünleri</b> satabilir. Et market'te değil kasapta!</p>`;
    html += '<div class="shop-builder-grid">';
    Object.entries(window.SHOP_CATALOG).forEach(([type, def]) => {
      const locked = lv < def.lv;
      const cats = def.cats.map(c => (window.URUN_KATEGORI_TUM && window.URUN_KATEGORI_TUM[c]) || c).join(' · ');
      html += `<div class="shop-build-card ${locked ? 'locked' : ''}">
        <div class="sbc-icon">${def.icon}</div>
        <div class="sbc-name">${def.name}</div>
        <div class="sbc-cats">${cats}</div>
        <div class="sbc-meta"><span>Lv ${def.lv}</span><span class="green">${cashFmt(def.cost)}</span></div>
        ${locked
          ? `<button class="btn-secondary" disabled>🔒 Lv ${def.lv}</button>`
          : `<button class="btn-primary" onclick="pickCity('${type}')">Aç</button>`
        }
      </div>`;
    });
    html += '</div>';
    showModal('Yeni Dükkan Aç', html);
    return;
  }

  // Eski fallback (urun-katalog.js yüklenmediyse)
  const types = [
    { id:'market', name:'Market', emoji:'🏪', cost:5000, lv:1 },
    { id:'elektronik', name:'Elektronik', emoji:'📱', cost:12000, lv:5 },
    { id:'beyazesya', name:'Beyaz Eşya', emoji:'🧊', cost:22000, lv:10 },
    { id:'mobilya', name:'Mobilya', emoji:'🛋️', cost:18000, lv:8 },
    { id:'benzin', name:'Benzin İst.', emoji:'⛽', cost:45000, lv:12 },
    { id:'kuyumcu', name:'Kuyumcu', emoji:'💍', cost:35000, lv:15 },
    { id:'otomotiv', name:'Otomotiv', emoji:'🚗', cost:60000, lv:18 },
  ];
  const cards = types.map(t => `
    <div class="card" ${lv>=t.lv ? `onclick="pickCity('${t.id}')"` : ''} style="${lv<t.lv?'opacity:.5;':''}">
      <div class="card-row">
        <div class="card-thumb">${t.emoji}</div>
        <div class="card-body">
          <div class="card-title">${t.name}</div>
          <div class="card-sub">${cashFmt(t.cost)} • Lv ${t.lv}+ ${lv<t.lv?'🔒':''}</div>
        </div>
      </div>
    </div>
  `).join('');
  showModal('Yeni Dükkan', cards);
}
window.modalNewShop = modalNewShop;

function pickCity(type){
  closeModal();
  const opts = ILLER.map(c => `<option>${c}</option>`).join('');
  showModal('Şehir Seç', `
    <div class="input-group">
      <label>Şehir</label>
      <select id="newShopCity">${opts}</select>
    </div>
    <button class="btn-primary" onclick="confirmNewShop('${type}')">Aç</button>
  `);
}
window.pickCity = pickCity;

async function confirmNewShop(type){
  const city = $('#newShopCity').value;
  closeModal();
  await buyShop(type, city);
  render('dukkan');
}
window.confirmNewShop = confirmNewShop;

/* Dükkan detayı */
async function openShop(sid){
  const s = await dbGet(`businesses/${GZ.uid}/shops/${sid}`);
  if (!s) return;
  const shelves = s.shelves || {};
  let body = `
    <div class="stats-grid">
      <div class="stat-box"><div class="lbl">Seviye</div><div class="val">${s.level||1}</div></div>
      <div class="stat-box"><div class="lbl">Çalışan</div><div class="val">${s.employees||1}</div></div>
      <div class="stat-box"><div class="lbl">Şehir</div><div class="val" style="font-size:13px">${s.city}</div></div>
      <div class="stat-box"><div class="lbl">Reyonlar</div><div class="val">${Object.keys(shelves).length}</div></div>
    </div>
    <div class="flex gap-8 mb-12">
      <button class="btn-primary" style="flex:1" onclick="openShelfPicker('${sid}')">+ Yeni Reyon</button>
      <button class="btn-secondary" style="flex:1" onclick="upgradeShop('${sid}').then(()=>{closeModal();openShop('${sid}')})">⬆️ Yükselt</button>
    </div>
    <div class="section-title">REYONLAR</div>
  `;
  if (Object.keys(shelves).length === 0){
    body += `<div class="empty-state"><div class="emoji">📦</div><h3>Boş reyon</h3><p>Reyona ürün eklemeden satış olmaz</p></div>`;
  } else {
    for (const k of Object.keys(shelves)){
      const sh = shelves[k];
      const u = URUNLER[k]; if (!u) continue;
      const pct = Math.min(100, ((sh.stock||0)/(sh.max||1))*100);
      const cls = pct < 20 ? 'empty' : pct < 50 ? 'warn' : '';
      body += `
        <div class="shelf-item">
          <div class="shelf-head">
            <div class="shelf-emoji">${u.emo}</div>
            <div class="shelf-name">
              ${u.name}
              <div class="shelf-stock">${sh.stock||0} / ${sh.max||50} ${u.unit}</div>
            </div>
          </div>
          <div class="shelf-prog"><div class="shelf-prog-fill ${cls}" style="width:${pct}%"></div></div>
          <div class="shelf-row">
            <span class="muted">Maliyet: ${cashFmt(sh.cost||0)}</span>
            <span class="price">${cashFmt(sh.price||0)}</span>
          </div>
          <div class="shelf-row small muted">
            <span>Satış: ${fmtInt(sh.totalSold||0)} ${u.unit}</span>
            <span>Ciro: ${cashFmt(sh.totalRevenue||0)}</span>
          </div>
          <div class="shelf-actions">
            <button class="btn-mini primary" onclick="askBuyStock('${sid}','${k}')">+ Stok</button>
            <button class="btn-mini" onclick="askSetPrice('${sid}','${k}',${sh.price||u.base})">💰 Fiyat</button>
            <button class="btn-mini danger" onclick="askDeleteShelf('${sid}','${k}')">🗑️</button>
          </div>
        </div>
      `;
    }
  }
  showModal(shopTypeName(s.type) + ' • ' + s.city, body);
}
window.openShop = openShop;

async function openShelfPicker(sid){
  closeModal();
  // Yeni: dükkan türünü çek, sadece izin verilen kategorileri göster
  const shop = await dbGet(`businesses/${GZ.uid}/shops/${sid}`);
  if (!shop) return toast('Dükkan bulunamadı','error');

  // urun-katalog yüklü ise yeni filtreli picker'ı kullan
  if (window.SHOP_CATALOG && typeof window.renderShelfPicker === 'function') {
    const shelves = Object.keys(shop.shelves || {});
    const html = window.renderShelfPicker(shop.type, shelves);
    // Pickerdaki onclick → addShelfFromPicker — ama sid'i doğru ayarlamak için:
    window._shelfPickerShopId = sid;

    // Eski callback (closeModal+openShop) ile uyumlu olmasi için addShelfFromPicker'ı override et
    const _origAdd = window.addShelfFromPicker;
    window.addShelfFromPicker = async function(itemKey){
      if (!window._shelfPickerShopId) return;
      await window.addShelf(window._shelfPickerShopId, itemKey);
      closeModal();
      openShop(window._shelfPickerShopId);
    };
    showModal('Reyon Ekle', html);
    return;
  }

  // Eski fallback (urun-katalog yüklenmediyse — eski davranış)
  let body = '';
  for (const cat of Object.keys(URUN_KATEGORI)){
    const items = Object.entries(URUNLER).filter(([k,u])=>u.cat===cat);
    if (items.length === 0) continue;
    body += `<div class="section-title">${URUN_KATEGORI[cat]}</div><div class="grid-3">`;
    for (const [k,u] of items){
      const locked = (GZ.data?.level||1) < u.lv;
      body += `<div class="product-card" ${locked?'style="opacity:.4"':`onclick="addShelf('${sid}','${k}').then(()=>{closeModal();openShop('${sid}')})"`}>
        <div class="emoji">${u.emo}</div>
        <div class="name">${u.name}${locked?` 🔒Lv${u.lv}`:''}</div>
      </div>`;
    }
    body += '</div>';
  }
  showModal('Ürün Seç', body);
}
window.openShelfPicker = openShelfPicker;

function askBuyStock(sid, k){
  const u = URUNLER?.[k];
  if(!u) return toast('Ürün bulunamadı','error');
  const money = GZ.data?.money||0;
  const maxQty = Math.max(1,Math.floor(money/u.base));
  const defQty = Math.min(50,maxQty);
  showModal('📦 Stok Al — '+u.emo+' '+u.name, `
    <div style="background:var(--bg);border-radius:10px;padding:12px;margin-bottom:14px;display:flex;justify-content:space-between">
      <div><div style="font-size:12px;color:var(--text-muted)">Birim Fiyat</div><b>${cashFmt(u.base)}</b></div>
      <div><div style="font-size:12px;color:var(--text-muted)">Bakiyen</div><b style="color:#22c55e">${cashFmt(money)}</b></div>
    </div>
    <input type="number" id="stockQtyInp" min="1" value="${defQty}" oninput="document.getElementById('sqCost').textContent=cashFmt((parseInt(this.value)||0)*${u.base})"
      style="width:100%;box-sizing:border-box;padding:14px;font-size:22px;font-weight:700;text-align:center;border:2px solid var(--primary,#1e5cb8);border-radius:12px;background:var(--bg);color:var(--text);margin-bottom:10px">
    <div style="display:flex;gap:6px;margin-bottom:12px">
      <button style="flex:1;padding:10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);font-size:13px;font-weight:700;cursor:pointer" onclick="document.getElementById('stockQtyInp').value=10;document.getElementById('sqCost').textContent=cashFmt(10*${u.base})">10</button>
      <button style="flex:1;padding:10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);font-size:13px;font-weight:700;cursor:pointer" onclick="document.getElementById('stockQtyInp').value=25;document.getElementById('sqCost').textContent=cashFmt(25*${u.base})">25</button>
      <button style="flex:1;padding:10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);font-size:13px;font-weight:700;cursor:pointer" onclick="document.getElementById('stockQtyInp').value=50;document.getElementById('sqCost').textContent=cashFmt(50*${u.base})">50</button>
      <button style="flex:1;padding:10px;border:1px solid var(--primary,#1e5cb8);border-radius:8px;background:var(--primary,#1e5cb8);color:#fff;font-size:13px;font-weight:700;cursor:pointer" onclick="document.getElementById('stockQtyInp').value=${maxQty};document.getElementById('sqCost').textContent=cashFmt(${maxQty}*${u.base})">MAX</button>
    </div>
    <button class="btn-primary" style="width:100%;padding:16px;font-size:16px;font-weight:700" onclick="confirmBuyStock('${sid}','${k}')">
      🛒 Satın Al — <span id="sqCost">${cashFmt(defQty*u.base)}</span>
    </button>
  `);
}
window.askBuyStock = askBuyStock;
async function confirmBuyStock(sid,k){
  const q=parseInt(document.getElementById('stockQtyInp')?.value);
  if(!q||q<=0) return toast('Geçersiz miktar','error');
  closeModal();
  if(typeof window.buyShelfStock==='function') await window.buyShelfStock(sid,k,q);
  if(typeof openShop==='function') openShop(sid);
}
window.confirmBuyStock = confirmBuyStock;

function askSetPrice(sid, k, cur){
  const u = URUNLER[k];
  const maxP = +(u.base * 3).toFixed(2);
  showModal('Satış Fiyatı', `
    <div class="input-group">
      <label>${u.emo} ${u.name}</label>
      <p class="small muted mb-8">Taban: ${cashFmt(u.base)} • Önerilen: ${cashFmt(u.base*1.5)} • <span class="red">Maks: ${cashFmt(maxP)}</span></p>
      <p class="small muted mb-8">⚠️ Tabanın 3 katından fazlası girilirse kaydetmez!</p>
      <input type="number" id="newPrice" step="0.01" value="${cur}" max="${maxP}">
    </div>
    <button class="btn-primary" onclick="confirmSetPrice('${sid}','${k}')">Kaydet</button>
  `);
}
window.askSetPrice = askSetPrice;
async function confirmSetPrice(sid,k){
  const p = parseFloat($('#newPrice').value);
  closeModal();
  await setShelfPrice(sid, k, p);
  openShop(sid);
}
window.confirmSetPrice = confirmSetPrice;

function askDeleteShelf(sid,k){
  if (!confirm('Bu reyonu silmek istiyor musun? Mevcut stok kaybolur.')) return;
  deleteShelf(sid,k).then(()=>openShop(sid));
}
window.askDeleteShelf = askDeleteShelf;

/* ============================================================
   ÜRETİM SAYFALARI — Detaylı Bahçe/Çiftlik/Fabrika/Maden
   ============================================================ */

// Bahçe türleri: her bahçenin kendine özel ismi, görseli ve ürünü
const BAHCE_TURLERI = {
  domates:   { ad:'Domates Bahçesi',  emo:'🍅', bg:'#dc2626', key:'domates',  sure:5  },
  patates:   { ad:'Patates Tarlası',  emo:'🥔', bg:'#92400e', key:'patates',  sure:6  },
  sogan:     { ad:'Soğan Tarlası',    emo:'🧅', bg:'#d97706', key:'sogan',    sure:5  },
  elma:      { ad:'Elma Bahçesi',     emo:'🍎', bg:'#16a34a', key:'elma',     sure:8  },
  uzum:      { ad:'Üzüm Bağı',        emo:'🍇', bg:'#7c3aed', key:'uzum',     sure:10 },
  kiraz:     { ad:'Kiraz Bahçesi',    emo:'🍒', bg:'#be123c', key:'kiraz',    sure:12 },
  kayisi:    { ad:'Kayısı Bahçesi',   emo:'🍑', bg:'#f59e0b', key:'kayisi',   sure:8  },
  findik:    { ad:'Fındık Bahçesi',   emo:'🥜', bg:'#78350f', key:'findik',   sure:15 },
  zeytin:    { ad:'Zeytin Bahçesi',   emo:'🫒', bg:'#166534', key:'zeytin',   sure:10 },
};

const URETIM_BILGI = {
  gardens:   { maliyet:3000, lv:2,  sure:5,  verim:100, birim:'Kilo', renk:'#16a34a', tanim:'Meyve ve sebze yetiştirirsin. Her hasat 100×Lv ürün verir.' },
  farms:     { maliyet:8000, lv:5,  sure:8,  verim:100, birim:'Adet', renk:'#f59e0b', tanim:'Hayvan çiftliği. Süt, yumurta, et üretimi.' },
  factories: { maliyet:25000,lv:8,  sure:4,  verim:100, birim:'Adet', renk:'#3b82f6', tanim:'İşlenmiş ürünler üret. Ekmek, pasta, kumaş...' },
  mines:     { maliyet:80000,lv:30, sure:12, verim:100, birim:'Gram', renk:'#6366f1', tanim:'Değerli madenler çıkar. Altın, gümüş, demir...' },
};

async function renderProduction(kind, title, emoji, allowedItems, lvLock){
  const main = $('#appMain');
  if (lvLock && (GZ.data?.level||1) < lvLock){
    main.innerHTML = `<div class="locked-state">
      <div class="lock-icon">🔒</div>
      <h3>${lvLock}. Seviyede Açılacak</h3>
      <p>Şu anki seviyen: ${GZ.data?.level||1}</p>
    </div>`;
    return;
  }
  const list = await dbGet(`businesses/${GZ.uid}/${kind}`) || {};
  const bilgi = URETIM_BILGI[kind] || {};
  const units = Object.values(list);
  const hasReady = units.some(u=>u.ready);
  const totalUnits = units.length;
  const growing = units.filter(u=>u.crop && u.harvestAt && now()<u.harvestAt).length;
  const ready = units.filter(u=>u.ready || (u.crop && u.harvestAt && now()>=u.harvestAt)).length;
  const empty = units.filter(u=>!u.crop).length;

  let html = `
    <div class="prod-header" style="background:linear-gradient(135deg,${bilgi.renk}22,${bilgi.renk}08);border-bottom:2px solid ${bilgi.renk}33;padding:16px;margin-bottom:12px;border-radius:16px">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px">
        <div style="font-size:36px">${emoji}</div>
        <div>
          <div style="font-size:18px;font-weight:800;color:var(--text)">${title}</div>
          <div style="font-size:12px;color:var(--text-muted)">${bilgi.tanim||''}</div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:10px">
        <div style="background:var(--card);border-radius:10px;padding:8px;text-align:center">
          <div style="font-size:20px;font-weight:800;color:${bilgi.renk}">${totalUnits}</div>
          <div style="font-size:10px;color:var(--text-muted)">Toplam</div>
        </div>
        <div style="background:var(--card);border-radius:10px;padding:8px;text-align:center">
          <div style="font-size:20px;font-weight:800;color:#22c55e">${ready}</div>
          <div style="font-size:10px;color:var(--text-muted)">Hazır 🌾</div>
        </div>
        <div style="background:var(--card);border-radius:10px;padding:8px;text-align:center">
          <div style="font-size:20px;font-weight:800;color:#f59e0b">${growing}</div>
          <div style="font-size:10px;color:var(--text-muted)">Büyüyor 🌱</div>
        </div>
        <div style="background:var(--card);border-radius:10px;padding:8px;text-align:center">
          <div style="font-size:20px;font-weight:800;color:#94a3b8">${empty}</div>
          <div style="font-size:10px;color:var(--text-muted)">Boş</div>
        </div>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn-primary" onclick="buyProductionUnit('${kind}').then(()=>render('${GZ.currentTab}'))" style="flex:1;font-size:13px">+ Yeni ${title.slice(0,-1)} (${cashFmt(bilgi.maliyet)})</button>
        ${ready>0?`<button class="btn-success" onclick="harvestAll('${kind}')" style="font-size:13px;padding:0 14px">🌾 Tümünü Hasat Et</button>`:''}
      </div>
    </div>`;

  if (totalUnits === 0){
    html += `<div class="empty-state">
      <div class="emoji">${emoji}</div>
      <h3>Henüz ${title.toLowerCase()} yok</h3>
      <p>${bilgi.maliyet ? cashFmt(bilgi.maliyet)+' ile aç, üretmeye başla' : 'Satın al ve üret'}</p>
      <button class="btn-primary mt-12" onclick="buyProductionUnit('${kind}').then(()=>render('${GZ.currentTab}'))">+ İlk ${title.slice(0,-1)}i Aç</button>
    </div>`;
  } else {
    // Bahçe kartları — grid görünümü
    html += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">`;
    for (const id of Object.keys(list)){
      const it = list[id];
      const lv = it.level||1;
      const crop = it.crop ? URUNLER[it.crop] : null;
      const isReady = it.crop && it.harvestAt && now() >= it.harvestAt;
      const isGrowing = it.crop && it.harvestAt && now() < it.harvestAt;
      const isEmpty = !it.crop;

      // Büyüme ilerleme barı
      let progressBar = '';
      let timeLabel = '';
      let statusColor = '#94a3b8';
      let statusEmoji = '⬜';
      let cardBg = 'var(--card)';
      let actionBtn = '';

      if (isReady){
        const pct = 100;
        statusColor = '#22c55e';
        statusEmoji = '✅';
        cardBg = 'rgba(34,197,94,0.06)';
        timeLabel = '<span style="color:#22c55e;font-weight:700;font-size:11px">HASAT HAZIR!</span>';
        progressBar = `<div style="height:6px;background:#22c55e33;border-radius:3px;margin:6px 0"><div style="width:100%;height:100%;background:#22c55e;border-radius:3px"></div></div>`;
        actionBtn = `<button class="btn-success" style="width:100%;font-size:12px;padding:8px" onclick="harvest('${kind}','${id}').then(()=>render('${GZ.currentTab}'))">🌾 Hasat Et (+${lv*100} ${crop?.unit||''})</button>`;
      } else if (isGrowing){
        const elapsed = now() - (it.harvestAt - ((kind==='gardens'?5:kind==='farms'?8:kind==='factories'?4:12)*60*1000));
        const total = it.harvestAt - (it.harvestAt - ((kind==='gardens'?5:kind==='farms'?8:kind==='factories'?4:12)*60*1000));
        const pct = Math.min(100, Math.max(0, ((now()-(it.harvestAt-((kind==='gardens'?5:kind==='farms'?8:kind==='factories'?4:12)*60*1000)))/((kind==='gardens'?5:kind==='farms'?8:kind==='factories'?4:12)*60*1000))*100));
        const rem = Math.ceil((it.harvestAt-now())/1000);
        const h=Math.floor(rem/3600), m=Math.floor((rem%3600)/60), s=rem%60;
        const cdStr = h>0?`${h}s ${m}d ${s}s`:m>0?`${m}d ${s}s`:`${s}s`;
        statusColor = '#f59e0b';
        statusEmoji = '🌱';
        timeLabel = `<span data-cd="${id}" style="color:#f59e0b;font-size:11px;font-weight:600">⏱ ${cdStr} kaldı</span>`;
        progressBar = `<div style="height:6px;background:#f59e0b22;border-radius:3px;margin:6px 0"><div style="width:${pct}%;height:100%;background:linear-gradient(90deg,#f59e0b,#22c55e);border-radius:3px;transition:width 1s"></div></div>`;
        actionBtn = `<button class="btn-mini danger" style="width:100%;font-size:11px" onclick="cancelCrop('${kind}','${id}')">🗑️ İptal Et</button>`;
      } else {
        // Boş — ne ekelim seçici
        statusEmoji = '🟤';
        timeLabel = `<span style="color:var(--text-muted);font-size:11px">Boş — ekim bekleniyor</span>`;
        if (kind === 'gardens'){
          // Bahçe türü seçici — hızlı butonlar
          actionBtn = `<div style="display:flex;flex-wrap:wrap;gap:4px">
            ${allowedItems.slice(0,4).map(k=>{
              const u=URUNLER[k]; if(!u) return '';
              const locked=(GZ.data?.level||1)<u.lv;
              return `<button style="flex:1;min-width:40%;padding:5px;border-radius:8px;border:1px solid ${locked?'var(--border)':'var(--primary)'};background:${locked?'transparent':'rgba(30,92,184,0.08)'};color:${locked?'var(--text-muted)':'var(--primary)'};font-size:11px;cursor:${locked?'not-allowed':'pointer'};font-weight:600" ${locked?'disabled':
                `onclick="plantCrop('${kind}','${id}','${k}').then(()=>render('${GZ.currentTab}'))"`}>
                ${u.emo} ${u.name}${locked?` 🔒${u.lv}`:''}</button>`;
            }).join('')}
            ${allowedItems.length>4?`<button style="flex:1;padding:5px;border-radius:8px;border:1px solid var(--border);background:transparent;color:var(--text-muted);font-size:11px;cursor:pointer" onclick='openPlantPicker("${kind}","${id}",${JSON.stringify(allowedItems)})'>••• Tümü</button>`:''}
          </div>`;
        } else {
          actionBtn = `<button class="btn-primary" style="width:100%;font-size:12px;padding:8px" onclick='openPlantPicker("${kind}","${id}",${JSON.stringify(allowedItems)})'>🌱 Ekim Yap</button>`;
        }
      }

      // Bahçe adı — bahçe türüne göre özel (gardens ise ekin adına göre)
      let unitName = `${emoji} ${kind==='gardens'?'Bahçe':kind==='farms'?'Çiftlik':kind==='factories'?'Fabrika':'Maden'} #${id.slice(-3)}`;
      if (kind==='gardens' && crop){
        const bt = Object.values(BAHCE_TURLERI).find(b=>b.key===it.crop);
        if (bt) unitName = `${bt.emo} ${bt.ad}`;
      }

      html += `
        <div style="background:${cardBg};border:1.5px solid ${isReady?'#22c55e33':isGrowing?'#f59e0b22':'var(--border)'};border-radius:14px;padding:12px;transition:.3s">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
            <div style="font-size:12px;font-weight:700;color:var(--text)">${unitName}</div>
            <div style="font-size:18px">${statusEmoji}</div>
          </div>
          ${crop?`<div style="font-size:13px;color:var(--text-muted);margin-bottom:2px">${crop.emo} ${crop.name}</div>`:''}
          ${progressBar}
          <div style="margin-bottom:8px">${timeLabel}</div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <span style="font-size:10px;background:${bilgi.renk}22;color:${bilgi.renk};padding:2px 8px;border-radius:999px;font-weight:700">Lv ${lv}</span>
            <button style="font-size:10px;color:var(--text-muted);background:transparent;border:1px solid var(--border);border-radius:6px;padding:2px 7px;cursor:pointer" onclick="upgradeProductionUnit('${kind}','${id}').then(()=>render('${GZ.currentTab}'))">⬆️ ${cashFmt(lv*2500)}</button>
          </div>
          ${actionBtn}
        </div>`;
    }
    html += `</div>`;
  }

  main.innerHTML = html;

  // ── Canlı geri sayım: DOM güncelle, SAYFA YENİLEMEME (göz kırpmaz) ──
  const tabMap = {gardens:'bahce',farms:'ciftlik',factories:'fabrika',mines:'maden'};
  const allUnits = Object.values(list);
  const growingUnits = allUnits.filter(u => u.crop && u.harvestAt && now() < u.harvestAt);

  if (growingUnits.length > 0) {
    // Her saniye sadece countdown span'lerini güncelle
    let cdInterval = null;
    function tickCountdowns() {
      if (GZ.currentTab !== tabMap[kind]) { clearInterval(cdInterval); return; }
      let anyGrowing = false;
      for (const it of Object.values(list)) {
        if (!it.crop || !it.harvestAt) continue;
        const rem = it.harvestAt - now();
        if (rem <= 0) {
          // Bu birim olgunlaştı — sadece bu kartı güncelle
          const cdEl = document.querySelector(`[data-cd="${it.id || ''}"]`);
          if (cdEl) cdEl.closest?.('.production-card')?.querySelector('.btn-success')?.setAttribute('style','display:block');
          // 500ms sonra tam yenile (bir kez)
          setTimeout(() => {
            if (GZ.currentTab === tabMap[kind]) renderProduction(kind, title, emoji, allowedItems, lvLock);
          }, 500);
          clearInterval(cdInterval);
          return;
        }
        anyGrowing = true;
        const cdEl = document.querySelector(`[data-cd="${it.id || ''}"]`);
        if (cdEl) {
          const s = Math.ceil(rem / 1000);
          const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), sec = s%60;
          cdEl.textContent = h > 0 ? `${h}s ${m}d ${sec}s` : m > 0 ? `${m}d ${sec}s` : `${sec}s`;
        }
      }
      if (!anyGrowing) clearInterval(cdInterval);
    }
    cdInterval = setInterval(tickCountdowns, 1000);
  }
}

// Tüm hasatları tek seferde topla
async function harvestAll(kind){
  const list = await dbGet(`businesses/${GZ.uid}/${kind}`) || {};
  let count = 0;
  for (const id of Object.keys(list)){
    const it = list[id];
    if (it.crop && it.harvestAt && now() >= it.harvestAt){
      await harvest(kind, id).catch(()=>{});
      count++;
    }
  }
  if (count === 0) toast('Hasat edilecek bir şey yok', 'warn');
  else { toast(`✅ ${count} hasatlandı`, 'success'); render(GZ.currentTab); }
}
window.harvestAll = harvestAll;

// Ekim iptal et
async function cancelCrop(kind, unitId){
  if (!confirm('Ekim iptal edilsin mi? Maliyet iade edilmez.')) return;
  await dbUpdate(`businesses/${GZ.uid}/${kind}/${unitId}`, { crop:null, harvestAt:null, ready:false });
  toast('Ekim iptal edildi', 'warn');
  render(GZ.currentTab);
}
window.cancelCrop = cancelCrop;

function openPlantPicker(kind, id, allowed){
  let body = '<div class="grid-3">';
  for (const k of allowed){
    const u = URUNLER[k]; if (!u) continue;
    const locked = (GZ.data?.level||1) < u.lv;
    body += `<div class="product-card" ${locked?'style="opacity:.4"':`onclick="plantCrop('${kind}','${id}','${k}').then(()=>{closeModal();render(GZ.currentTab)})"`}>
      <div class="emoji">${u.emo}</div>
      <div class="name">${u.name}${locked?` 🔒Lv${u.lv}`:''}</div>
    </div>`;
  }
  body += '</div>';
  showModal('Ne Ekelim?', body);
}
window.openPlantPicker = openPlantPicker;

/* ============================================================
   LOJİSTİK
   ============================================================ */
async function renderLojistik(){
  const main = $('#appMain');
  const wh = await dbGet(`businesses/${GZ.uid}/warehouses`) || {};
  const main_ = await dbGet(`businesses/${GZ.uid}/mainWarehouse`) || {};
  let html = `<div class="page-title">🚚 Lojistik</div>`;

  // Ana depo
  const mainItems = Object.entries(main_).filter(([k,v])=>v>0);
  html += `<div class="card">
    <div class="card-row">
      <div class="card-thumb">📦</div>
      <div class="card-body">
        <div class="card-title">Ana Depo</div>
        <div class="card-sub">${mainItems.length} ürün çeşidi</div>
      </div>
    </div>`;
  if (mainItems.length){
    html += '<div class="divider"></div>';
    for (const [k,v] of mainItems){
      const u = URUNLER[k]; if (!u) continue;
      html += `<div class="row-between" style="padding:6px 0">
        <span>${u.emo} ${u.name}</span>
        <b>${fmtInt(v)} ${u.unit}</b>
      </div>`;
    }
  } else {
    html += '<p class="small muted mt-12">Boş — bahçe/çiftlik/fabrikadan hasat ile dolar</p>';
  }
  html += '</div>';

  html += `<div class="row-between mb-12 mt-12">
    <h3 style="font-size:15px">Şehir Depoları</h3>
    <button class="btn-primary" onclick="openWarehouseCity()">+ Depo Aç</button>
  </div>`;

  if (Object.keys(wh).length === 0){
    html += `<div class="empty-state"><div class="emoji">🚚</div><h3>Şehir deposu yok</h3><p>81 ilden istediğin yere depo açabilirsin</p></div>`;
  } else {
    for (const c of Object.keys(wh)){
      const w = wh[c];
      const items = w.items || {};
      const itemKeys = Object.entries(items).filter(([k,v])=>v>0);
      const used = itemKeys.reduce((a,b)=>a+b[1],0);
      html += `<div class="card" onclick="openWarehouseDetail('${c}')">
        <div class="card-row">
          <div class="card-thumb">🏭</div>
          <div class="card-body">
            <div class="card-title">${c} Depo</div>
            <div class="card-sub">${fmtInt(used)} / ${fmtInt(w.capacity)} kapasite • ${itemKeys.length} ürün</div>
          </div>
          <div class="muted">›</div>
        </div>
      </div>`;
    }
  }

  main.innerHTML = html;
}

function openWarehouseCity(){
  const opts = ILLER.map(c => `<option>${c}</option>`).join('');
  showModal('Yeni Depo Aç', `
    <div class="input-group">
      <label>Şehir</label>
      <select id="whCity">${opts}</select>
    </div>
    <p class="small muted mb-8">Maliyet: 25.000 ₺ veya 100 💎</p>
    <div class="flex gap-8">
      <button class="btn-primary" style="flex:1" onclick="buyWarehouse($('#whCity').value,'cash').then(()=>{closeModal();render('lojistik')})">25.000 ₺</button>
      <button class="btn-secondary" style="flex:1" onclick="buyWarehouse($('#whCity').value,'diamond').then(()=>{closeModal();render('lojistik')})">💎 100</button>
    </div>
  `);
}
window.openWarehouseCity = openWarehouseCity;

async function openWarehouseDetail(city){
  const w = await dbGet(`businesses/${GZ.uid}/warehouses/${city}`);
  if (!w) return;
  const items = w.items || {};
  let body = `<p class="small muted mb-8">Kapasite: ${fmtInt(w.capacity)}</p>`;
  const list = Object.entries(items).filter(([k,v])=>v>0);
  if (list.length === 0){
    body += '<div class="empty-state"><p>Bu depo boş</p></div>';
  } else {
    for (const [k,v] of list){
      const u = URUNLER[k]; if (!u) continue;
      body += `<div class="row-between" style="padding:8px 0;border-bottom:1px solid var(--border)">
        <span>${u.emo} ${u.name}</span>
        <b>${fmtInt(v)} ${u.unit}</b>
      </div>`;
    }
  }
  showModal(`${city} Depo`, body);
}
window.openWarehouseDetail = openWarehouseDetail;

/* ============================================================
   İHRACAT
   ============================================================ */
async function renderIhracat(){
  const main = $('#appMain');
  const list = await dbGet('exports/list') || {};
  let html = `<div class="page-title">🚢 İhracat <span class="badge-info">Stoğunu satabilirsin</span></div>`;
  const arr = Object.values(list).sort((a,b)=>b.pricePerUnit - a.pricePerUnit);
  if (arr.length === 0){
    html += '<div class="empty-state"><div class="emoji">🚢</div><h3>Talep listesi yenileniyor</h3></div>';
  } else {
    for (const ex of arr){
      const u = URUNLER[ex.item]; if (!u) continue;
      const remaining = ex.demand - (ex.fulfilled||0);
      const pct = ((ex.fulfilled||0)/ex.demand)*100;
      html += `
        <div class="card">
          <div class="card-row">
            <div class="card-thumb">${ex.flag}</div>
            <div class="card-body">
              <div class="card-title">${ex.sirket}</div>
              <div class="card-sub">${ex.country} • ${u.emo} ${u.name}</div>
            </div>
          </div>
          <div class="row-between mt-12">
            <span class="small">Fiyat: <b class="green">${cashFmt(ex.pricePerUnit)}</b> /${u.unit}</span>
            <span class="small">Kalan: ${fmtInt(remaining)}</span>
          </div>
          <div class="shelf-prog"><div class="shelf-prog-fill" style="width:${pct}%"></div></div>
          <div class="row-between small muted">
            <span>Min: ${fmtInt(ex.minOrder)}</span>
            <span>${fmtInt(ex.fulfilled||0)} / ${fmtInt(ex.demand)}</span>
          </div>
          <button class="btn-primary mt-12" style="width:100%" onclick="askExportShip('${ex.id}')">🚚 Gönder</button>
        </div>
      `;
    }
  }
  main.innerHTML = html;
}

async function askExportShip(exId){
  const ex = await dbGet(`exports/list/${exId}`);
  if (!ex) return;
  const u = URUNLER[ex.item];
  const myStock = await getTotalStock(GZ.uid, ex.item);
  showModal(`${u.emo} ${u.name} Gönder`, `
    <p class="small muted mb-8">Stoğunda: <b>${fmtInt(myStock)} ${u.unit}</b></p>
    <p class="small muted mb-8">Min sipariş: ${fmtInt(ex.minOrder)} • Birim: ${cashFmt(ex.pricePerUnit)}</p>
    <div class="input-group">
      <label>Miktar</label>
      <input type="number" id="exQty" value="${Math.min(myStock, ex.minOrder)}" min="${ex.minOrder}" max="${myStock}">
    </div>
    <button class="btn-primary" onclick="confirmExport('${exId}')">Gönder</button>
  `);
}
window.askExportShip = askExportShip;

async function confirmExport(exId){
  const q = parseInt($('#exQty').value);
  if (!q || q<=0) return toast('Geçersiz miktar','error');
  closeModal();
  await exportShip(exId, q);
  render('ihracat');
}
window.confirmExport = confirmExport;

/* ============================================================
   İHALE
   ============================================================ */
async function renderIhale(){
  const main = $('#appMain');
  const list = await dbGet('auctions/list') || {};
  let html = `<div class="page-title">⚖️ İhaleler</div>`;
  const arr = Object.values(list).filter(a=>!a.finalized).sort((a,b)=>a.endsAt-b.endsAt);
  if (arr.length === 0){
    html += '<div class="empty-state"><div class="emoji">⚖️</div><h3>Yenisi hazırlanıyor</h3></div>';
  } else {
    for (const a of arr){
      const u = URUNLER[a.item]; if (!u) continue;
      const remaining = Math.max(0, a.endsAt - now());
      const m = Math.floor(remaining/60000);
      const s = Math.floor((remaining%60000)/1000);
      html += `
        <div class="card">
          <div class="card-row">
            <div class="card-thumb">${a.flag}</div>
            <div class="card-body">
              <div class="card-title">${a.sirket}</div>
              <div class="card-sub">${a.country}</div>
            </div>
          </div>
          <div class="tac mt-12">
            <div style="font-size:42px">${u.emo}</div>
            <div class="bold">${fmtInt(a.qty)} ${u.unit} ${u.name}</div>
            <div class="small muted">Min teklif: ${cashFmt(a.minBid)}/${u.unit}</div>
          </div>
          <div class="tac mt-12">
            <span class="timer-pill ${remaining<60000?'warn':''}">⏱ ${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}</span>
          </div>
          <div class="row-between mt-12">
            <span>En yüksek teklif:</span>
            <b class="green">${cashFmt(a.currentBid)}/${u.unit}</b>
          </div>
          <div class="small muted">${a.currentBidderName ? `Lider: ${a.currentBidderName}` : 'Henüz teklif yok'}</div>
          <button class="btn-primary mt-12" style="width:100%" onclick="askBid('${a.id}')">💰 Teklif Ver</button>
        </div>
      `;
    }
  }
  main.innerHTML = html;
  if (GZ.currentTab === 'ihale'){
    setTimeout(()=>{ if (GZ.currentTab==='ihale') renderIhale(); }, 1000);
  }
}

async function askBid(auId){
  const a = await dbGet(`auctions/list/${auId}`);
  if (!a) return;
  const u = URUNLER[a.item];
  const minNext = +(a.currentBid + 0.01).toFixed(2);
  showModal('Teklif Ver', `
    <p class="small mb-8">Mevcut: <b>${cashFmt(a.currentBid)}/${u.unit}</b></p>
    <p class="small muted mb-8">${fmtInt(a.qty)} ${u.unit} → Toplam: ${cashFmt(minNext * a.qty)} (min)</p>
    <div class="input-group">
      <label>Birim Teklif (${u.unit} başına)</label>
      <input type="number" id="bidPrice" step="0.01" value="${minNext}" min="${minNext}">
    </div>
    <button class="btn-primary" onclick="confirmBid('${auId}')">Teklif Ver</button>
  `);
}
window.askBid = askBid;

async function confirmBid(auId){
  const p = parseFloat($('#bidPrice').value);
  closeModal();
  await placeBid(auId, p);
  renderIhale();
}
window.confirmBid = confirmBid;

/* ============================================================
   KRİPTO
   ============================================================ */
async function renderKripto(){
  const main = $('#appMain');
  main.innerHTML = `<div class="page-title">📈 Kripto Borsa
    <span class="badge-info" style="font-size:10px;animation:pulse 2s infinite">🔴 CANLI</span>
  </div>
    <div class="subtabs">
      <button class="subtab active" onclick="cryptoView('all',event)">🌐 Tümü</button>
      <button class="subtab" onclick="cryptoView('mine',event)">💼 Cüzdanım</button>
      <button class="subtab" onclick="cryptoView('toplist',event)">🏆 Top 5</button>
    </div>
    <div id="cryptoList"></div>`;
  drawCryptoList('all');

  // Canlı güncelleme: fiyat değişince otomatik yenile
  if (window._cryptoLiveUnsub) window._cryptoLiveUnsub();
  const ref = db.ref('crypto/prices');
  const handler = ref.on('value', () => {
    if (GZ.currentTab === 'kripto') drawCryptoList(window._cryptoView || 'all');
  });
  window._cryptoLiveUnsub = () => ref.off('value', handler);
}

function cryptoView(view, ev){
  $$('.subtab').forEach(b=>b.classList.remove('active'));
  if (ev && ev.target) ev.target.classList.add('active');
  window._cryptoView = view;
  drawCryptoList(view);
}
window.cryptoView = cryptoView;

async function drawCryptoList(view){
  const list = $('#cryptoList'); if (!list) return;
  const holdings = await dbGet(`crypto/holdings/${GZ.uid}`) || {};
  let coins = [...KRIPTO];

  if (view === 'mine') coins = coins.filter(k => (holdings[k.sym]||0) > 0);
  if (view === 'toplist') coins = [...coins].sort((a,b) => {
    const pa = GZ.prices[a.sym]?.current || a.base;
    const pb = GZ.prices[b.sym]?.current || b.base;
    const ca = ((pa - (GZ.prices[a.sym]?.prev||a.base)) / (GZ.prices[a.sym]?.prev||a.base)) * 100;
    const cb = ((pb - (GZ.prices[b.sym]?.prev||b.base)) / (GZ.prices[b.sym]?.prev||b.base)) * 100;
    return cb - ca;
  }).slice(0, 5);

  let html = '';
  for (const k of coins){
    const p = GZ.prices[k.sym] || { current: k.base, prev: k.base };
    const change = ((p.current - p.prev)/(p.prev||1))*100;
    const own = holdings[k.sym] || 0;
    const ownVal = own * p.current;
    html += `
      <div class="crypto-row" onclick="openCryptoDetail('${k.sym}')">
        <div class="crypto-icon" style="background:${k.color};font-weight:900;font-size:13px">${k.sym.slice(0,3)}</div>
        <div class="crypto-name">
          <div class="nm">${k.name} <span style="font-size:10px;color:#64748b">${k.sym}</span></div>
          <div class="sym" style="color:#64748b;font-size:10px">${own>0?`💼 ${own.toFixed(4)} ≈ ${cashFmt(ownVal)}`:'Sahip değilsin'}</div>
        </div>
        <div class="crypto-price">
          <div class="pr">${cashFmt(p.current)}</div>
          <div class="ch ${change>=0?'up':'down'}">${change>=0?'▲':'▼'} %${Math.abs(change).toFixed(2)}</div>
        </div>
      </div>
    `;
  }
  if (!html) html = '<div class="empty-state"><span class="emoji">💼</span><h3>Cüzdanın Boş</h3><p>Kripto al ve yatırım yap</p></div>';
  list.innerHTML = html;
}

async function openCryptoDetail(sym){
  const k = KRIPTO.find(x=>x.sym===sym); if (!k) return;
  const p = GZ.prices[sym] || { current: k.base };
  const own = (await dbGet(`crypto/holdings/${GZ.uid}/${sym}`)) || 0;
  GZ._curCryptoOwned = own;  // Sat butonları için cache
  const value = own * p.current;
  showModal(`${k.name} (${sym})`, `
    <div class="tac mb-12">
      <div style="font-size:32px;color:${k.color};font-weight:800">${cashFmt(p.current)}</div>
    </div>
    <div class="stats-grid">
      <div class="stat-box"><div class="lbl">Bakiye</div><div class="val">${own.toFixed(4)}</div></div>
      <div class="stat-box"><div class="lbl">Değer</div><div class="val green">${cashFmt(value)}</div></div>
      <div class="stat-box"><div class="lbl">Toplam Arz</div><div class="val" style="font-size:11px">${fmtInt(k.supply)}</div></div>
      <div class="stat-box"><div class="lbl">Piyasa Değeri</div><div class="val" style="font-size:11px">${cashFmt(p.current * k.supply)}</div></div>
    </div>
    <div class="subtabs mt-12">
      <button class="subtab active" onclick="cryptoOp('buy','${sym}',event)">AL</button>
      <button class="subtab" onclick="cryptoOp('sell','${sym}',event)">SAT</button>
    </div>
    <div id="cryptoOp"></div>
  `);
  cryptoOp('buy', sym);
}
window.openCryptoDetail = openCryptoDetail;

function cryptoOp(op, sym, ev){
  $$('.subtab').forEach(b=>b.classList.remove('active'));
  if (ev && ev.target) ev.target.classList.add('active');
  const div = $('#cryptoOp');
  if (!div) return;
  if (op === 'buy'){
    const myMoney = GZ.data?.money || 0;
    div.innerHTML = `
      <div class="input-group mt-12">
        <label>Tutar (₺) — Bakiye: <b style="color:#16a34a">${cashFmt(myMoney)}</b></label>
        <input type="number" id="cryptoTl" step="0.01" placeholder="Ne kadarlık alacaksın?">
      </div>
      <div class="quick-amount-row">
        <button class="btn-quick" onclick="cryptoQuickBuy(0.25)">%25</button>
        <button class="btn-quick" onclick="cryptoQuickBuy(0.50)">%50</button>
        <button class="btn-quick" onclick="cryptoQuickBuy(0.75)">%75</button>
        <button class="btn-quick btn-quick-max" onclick="cryptoQuickBuy(1.0)">💰 TÜMÜ</button>
      </div>
      <button class="btn-success" onclick="cryptoExecBuy('${sym}')" style="width:100%;margin-top:10px">SATIN AL</button>
      <div class="muted small tac" style="margin-top:6px">Komisyon: %0.5</div>
    `;
  } else {
    const own = GZ._curCryptoOwned || 0;
    const sym2 = sym;
    div.innerHTML = `
      <div class="input-group mt-12">
        <label>Miktar (${sym}) — Sahip: <b style="color:#3b82f6">${own.toFixed(6)}</b></label>
        <input type="number" id="cryptoQty" step="0.0001" placeholder="Satılacak miktar">
      </div>
      <div class="quick-amount-row">
        <button class="btn-quick" onclick="cryptoQuickSell('${sym2}',0.25)">%25</button>
        <button class="btn-quick" onclick="cryptoQuickSell('${sym2}',0.50)">%50</button>
        <button class="btn-quick" onclick="cryptoQuickSell('${sym2}',0.75)">%75</button>
        <button class="btn-quick btn-quick-max btn-quick-sell" onclick="cryptoQuickSell('${sym2}',1.0)">💸 TÜMÜNÜ SAT</button>
      </div>
      <button class="btn-danger" onclick="cryptoExecSell('${sym2}')" style="width:100%;margin-top:10px">SAT</button>
      <div class="muted small tac" style="margin-top:6px">Komisyon: %0.5</div>
    `;
  }
}
window.cryptoOp = cryptoOp;

// Hızlı al butonları - bakiyenin %X'ini doldur
window.cryptoQuickBuy = function(ratio) {
  const myMoney = GZ.data?.money || 0;
  if (myMoney <= 0) return toast('Bakiyen yok', 'warn');
  const amount = Math.floor(myMoney * ratio * 100) / 100;
  const inp = document.getElementById('cryptoTl');
  if (inp) {
    inp.value = amount.toFixed(2);
    if (ratio === 1.0) toast(`💰 Tüm bakiye: ${cashFmt(amount)}`, 'info', 2000);
  }
};

// Hızlı sat butonları - sahip olunan kriptonun %X'i
window.cryptoQuickSell = async function(sym, ratio) {
  const own = (await dbGet(`crypto/holdings/${GZ.uid}/${sym}`)) || 0;
  if (own <= 0) return toast('Bu kriptodan yok', 'warn');
  const qty = Math.floor(own * ratio * 1000000) / 1000000;
  const inp = document.getElementById('cryptoQty');
  if (inp) {
    inp.value = qty.toFixed(6);
    if (ratio === 1.0) toast(`💸 Tüm ${sym}: ${qty.toFixed(6)}`, 'info', 2000);
  }
};

// Al butonu yürüt
window.cryptoExecBuy = async function(sym) {
  const inp = document.getElementById('cryptoTl');
  if (!inp) return;
  const amount = parseFloat(inp.value);
  if (!amount || amount <= 0) return toast('Geçerli tutar gir', 'error');
  const r = await buyCrypto(sym, amount);
  if (r !== false) {
    closeModal();
    render('kripto');
  }
};

// Sat butonu yürüt
window.cryptoExecSell = async function(sym) {
  const inp = document.getElementById('cryptoQty');
  if (!inp) return;
  const qty = parseFloat(inp.value);
  if (!qty || qty <= 0) return toast('Geçerli miktar gir', 'error');
  const r = await sellCrypto(sym, qty);
  if (r !== false) {
    closeModal();
    render('kripto');
  }
};

/* ============================================================
   BANKALAR SEKMESİ — ekonomi.js BANKALAR ile uyumlu
   (Eski blok kaldırıldı. window.BANKALAR ekonomi.js'ten geliyor.)
   ============================================================ */

async function renderBankaSekme(activeTab) {
  activeTab = activeTab || 'hesaplar';
  const main = $('#appMain');
  if (!main) return;

  const uid     = GZ.uid;
  const lv      = GZ.data?.level || 1;
  const bank    = (await dbGet('bank/' + uid)) || {};
  const loanBankId = bank.loanBankId || null;
  const dbFaizler  = (await dbGet('system/bankFaizler')) || {};
  const BLIST   = window.BANKALAR || [];

  /* ── SEKMELER ── */
  const tabs = [
    { id: 'hesaplar', label: '🏦 Hesaplar'   },
    { id: 'kredi',    label: '💳 Kredi'       },
    { id: 'vadeli',   label: '📈 Vadeli'      },
    { id: 'transfer', label: '💸 Transfer'    },
  ];

  const tabBar = `<div class="tab-bar" style="display:flex;gap:6px;overflow-x:auto;padding:0 0 10px;margin-bottom:12px">
    ${tabs.map(t => `<button onclick="renderBankaSekme('${t.id}')"
      style="padding:8px 16px;border-radius:999px;border:none;cursor:pointer;font-weight:700;font-size:12px;
      background:${activeTab===t.id?'var(--primary)':'var(--bg2)'};
      color:${activeTab===t.id?'#fff':'var(--text-muted)'};white-space:nowrap">
      ${t.label}</button>`).join('')}
  </div>`;

  let content = '';

  /* ══════════════ HESAPLAR SEKMESİ ══════════════ */
  if (activeTab === 'hesaplar') {
    const money     = GZ.data?.money || GZ.data?.bakiye || 0;
    const diamonds  = GZ.data?.diamonds || 0;
    const krediNotu = typeof window.getKrediNotu === 'function' ? (await window.getKrediNotu(uid)) : 50;
    const notRenk   = krediNotu >= 80 ? '#22c55e' : krediNotu >= 60 ? '#f59e0b' : '#ef4444';

    content = `
      <!-- Ana bakiye kartı -->
      <div class="card" style="background:linear-gradient(135deg,#1e3a8a,#1e40af);color:#fff;margin-bottom:12px">
        <div style="font-size:11px;opacity:.7;margin-bottom:4px">TOPLAM BAKİYE</div>
        <div style="font-size:28px;font-weight:900">${cashFmt(money)}</div>
        <div style="display:flex;justify-content:space-between;margin-top:12px;font-size:12px;opacity:.8">
          <span>💎 ${diamonds} Elmas</span>
          <span>Lv ${lv}</span>
          <span>Kredi Notu: <b style="color:${notRenk}">${krediNotu}</b></span>
        </div>
      </div>

      <!-- Banka kartları -->
      <div style="font-size:13px;font-weight:700;color:var(--text-muted);margin-bottom:8px">Bankalar</div>
      ${BLIST.map(b => {
        const faiz   = dbFaizler[b.id] || b.faiz;
        const isMine = loanBankId === b.id;
        return `<div class="card mb-8" style="border-left:4px solid ${b.color}${isMine?'':'66'}">
          <div style="display:flex;align-items:center;gap:12px">
            <div style="width:42px;height:42px;border-radius:12px;background:${b.color}22;
              display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0">${b.logo}</div>
            <div style="flex:1">
              <div style="font-size:13px;font-weight:700;color:var(--text)">
                ${b.name}${isMine ? ` <span style="font-size:9px;background:${b.color};color:#fff;padding:1px 6px;border-radius:999px">AKTİF KREDİ</span>` : ''}
              </div>
              <div style="font-size:10px;color:var(--text-muted)">${b.info || ''}</div>
            </div>
            <div style="text-align:right">
              <div style="font-size:10px;color:var(--text-muted)">FAİZ</div>
              <div style="font-size:14px;font-weight:800;color:${b.color}">%${(faiz * 100).toFixed(1)}</div>
            </div>
          </div>
        </div>`;
      }).join('')}`;
  }

  /* ══════════════ KREDİ SEKMESİ ══════════════ */
  else if (activeTab === 'kredi') {
    if (typeof renderKredi === 'function') {
      if(typeof renderKredi==='function') renderKredi();
      return;
    }
  }

  /* ══════════════ VADELİ SEKMESİ ══════════════ */
  else if (activeTab === 'vadeli') {
    const vadeli = (await dbGet('vadeli/' + uid)) || {};
    const list   = Object.entries(vadeli);
    content = list.length === 0
      ? `<div class="card" style="text-align:center;padding:32px;color:var(--text-muted)">
           <div style="font-size:36px;margin-bottom:8px">📈</div>
           Aktif vadeli hesabınız yok<br>
           <button class="btn-primary" style="margin-top:16px" onclick="renderBankaSekme('kredi')">Vadeli Aç</button>
         </div>`
      : list.map(([k, v]) => `
          <div class="card mb-8">
            <div style="font-weight:700">${v.bankName || v.bankId} — Vadeli Hesap</div>
            <div style="font-size:12px;color:var(--text-muted)">
              Miktar: <b>${cashFmt(v.amount)}</b> · Faiz: <b>%${(v.rate * 100).toFixed(1)}</b>
            </div>
            <div style="font-size:11px;color:var(--text-muted)">
              Bitiş: ${new Date(v.maturesAt).toLocaleDateString('tr-TR')}
            </div>
          </div>`).join('');
  }

  /* ══════════════ TRANSFER SEKMESİ ══════════════ */
  else if (activeTab === 'transfer') {
    content = `
      <div class="card">
        <div style="font-size:14px;font-weight:700;margin-bottom:12px">💸 Oyuncu Transferi</div>
        <input id="tfUser" placeholder="Kullanıcı adı" style="width:100%;padding:10px;border-radius:8px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-size:13px;box-sizing:border-box;margin-bottom:8px">
        <input id="tfAmount" type="number" placeholder="Miktar (₺)" style="width:100%;padding:10px;border-radius:8px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-size:13px;box-sizing:border-box;margin-bottom:12px">
        <button onclick="(async()=>{
          const uname=document.getElementById('tfUser')?.value?.trim();
          const amt=parseInt(document.getElementById('tfAmount')?.value)||0;
          if(!uname||!amt) return toast('Kullanıcı adı ve miktar girin','warn');
          const users=await dbGet('users')||{};
          const found=Object.entries(users).find(([,u])=>u.username===uname);
          if(!found) return toast('Kullanıcı bulunamadı','error');
          await window.GZX_B09_transfer?.(GZ.uid,found[0],amt);
          renderBankaSekme('transfer');
        })()" class="btn-primary" style="width:100%">Transfer Gönder</button>
      </div>`;
  }

  main.innerHTML = `
    <div class="page-title">🏦 Bankacılık</div>
    ${tabBar}
    <div id="bankaContent">${content}</div>`;
}
window.renderBankaSekme = renderBankaSekme;




function getNextSaturday(){
  const d = new Date();
  const day = d.getDay();
  const diff = (6 - day + 7) % 7 || 7;
  d.setDate(d.getDate() + diff);
  return d.toLocaleDateString('tr-TR', {weekday:'long', day:'numeric', month:'long'});
}

async function askKrediCek(bankId, maxLimit){
  const b = BANKALAR_MAP[bankId];
  if (!b) return;
  if (maxLimit <= 0) return toast(`Kredi limitiniz dolu. Önce borcunuzu ödeyin.`, 'warn');
  showModal(`💳 ${b.name || (b.name || b.ad)} — Kredi Çek`, `
    <div style="background:${b.color || b.color || b.color || b.renk}11;border-radius:12px;padding:12px;margin-bottom:14px">
      <div style="display:flex;justify-content:space-between;margin-bottom:6px">
        <span style="font-size:12px;color:var(--text-muted)">Faiz Oranı (yıllık)</span>
        <b style="color:${b.color || b.color || b.color || b.renk}">%${(b.faiz*100).toFixed(1)}</b>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:6px">
        <span style="font-size:12px;color:var(--text-muted)">Haftalık faiz (1000₺ için)</span>
        <b>${cashFmt(+(1000*b.faiz/52).toFixed(2))}</b>
      </div>
      <div style="display:flex;justify-content:space-between">
        <span style="font-size:12px;color:var(--text-muted)">Kullanılabilir Limit</span>
        <b class="green">${cashFmt(maxLimit)}</b>
      </div>
    </div>
    <div class="input-group">
      <label>Kredi Miktarı (₺)</label>
      <input type="number" id="krediMiktar" min="100" max="${maxLimit}" placeholder="Min: 100₺" step="100">
    </div>
    <div class="quick-amount-row">
      <button class="btn-quick" onclick="bankQuickFill(${maxLimit},0.25)">%25</button>
      <button class="btn-quick" onclick="bankQuickFill(${maxLimit},0.50)">%50</button>
      <button class="btn-quick" onclick="bankQuickFill(${maxLimit},0.75)">%75</button>
      <button class="btn-quick btn-quick-max" onclick="bankQuickFill(${maxLimit},1.0)">💰 MAX</button>
    </div>
    <p style="font-size:11px;color:var(--text-muted);margin-bottom:12px">⚠️ Kredi, her Cumartesi faiz işler. Ödenmezse haciz başlatılır.</p>
    <button class="btn-primary" style="width:100%" onclick="confirmKrediCek('${bankId}')">💳 Krediyi Onayla</button>
  `);
  // bankQuickFill krediMiktar input'unu doldursun
  window._tempBankQuickTarget = 'krediMiktar';
}
window.askKrediCek = askKrediCek;

async function confirmKrediCek(bankId){
  const amt = parseFloat(document.getElementById('krediMiktar')?.value);
  if (!amt || amt < 100) return toast('En az 100₺ giriniz','error');
  closeModal();
  // bankBorrow'u bankId ile çağır
  await bankBorrowFromBank(bankId, Math.floor(amt));
  render('banka');
}
window.confirmKrediCek = confirmKrediCek;

async function bankBorrowFromBank(bankId, amount){
  if (!amount || amount <= 0) return toast('Geçersiz tutar','error');
  const b = BANKALAR_MAP[bankId];
  if (!b) return;
  const lv = (GZ.data?.level||1);
  const max = lv * Math.floor((b.maxKat || 2) * (window.getKrediLimit ? window.getKrediLimit(GZ.data?.krediNotu||50) : 5000));
  const cur = (await dbGet(`bank/${GZ.uid}/loan`))||0;
  const curBankId = (await dbGet(`bank/${GZ.uid}/loanBankId`));
  // Farklı bankadan borç alıyorsa önce eski borç ödenmeli
  if (curBankId && curBankId !== bankId && cur > 0){
    return toast(`Önce ${BANKALAR_MAP[curBankId]?.name || BANKALAR_MAP[curBankId]?.ad||curBankId} borcunuzu ödeyin!`, 'warn');
  }
  if (cur + amount > max) return toast(`Kredi limitiniz: ${cashFmt(max)} (Mevcut borç: ${cashFmt(cur)})`, 'warn');
  await db.ref(`bank/${GZ.uid}/loan`).transaction(c => (c||0)+amount);
  await db.ref(`bank/${GZ.uid}/loanBankId`).set(bankId);
  await addCash(GZ.uid, amount, 'borrow');
  await pushNotif(GZ.uid, `💳 ${b.name || b.name || b.ad}'dan ${cashFmt(amount)} kredi çekildi. Haftalık faiz: ${cashFmt(+(amount*b.faiz/52).toFixed(2))}`);
  toast(`+${cashFmt(amount)} kredi çekildi — ${b.name || b.ad}`, 'success');
}
window.bankBorrowFromBank = bankBorrowFromBank;

async function renderMarka(){
  const main = $('#appMain');
  const myBrand = GZ.data?.brand;
  let html = `<div class="page-title">🏢 Markalar</div>`;
  if (!myBrand){
    html += `<button class="btn-primary mb-12" onclick="askCreateBrand()" style="width:100%">+ Marka Kur (25.000 ₺ • Lv 10+)</button>`;
  } else {
    const b = await dbGet(`brands/${myBrand}`);
    if (b){
      html += `<div class="card">
        <div class="card-title">${b.name} <span class="small muted">${b.leader===GZ.uid?'(Lider)':''}</span></div>
        <div class="card-sub">Üye: ${Object.keys(b.members||{}).length} • Puan: ${b.points||0}</div>
        <button class="btn-mini danger mt-12" onclick="leaveBrand().then(()=>render('marka'))">Markadan Ayrıl</button>
      </div>`;
    }
  }
  // Tüm markalar (gerçek oyuncuların kurduğu)
  const allBrands = await dbGet('brands') || {};
  const arr = Object.values(allBrands).sort((a,b)=>(b.points||0)-(a.points||0));
  html += `<div class="section-title">Tüm Markalar (${arr.length})</div>`;
  if (arr.length === 0){
    html += emptyState('🏢','Henüz marka yok','İlk markayı sen kur');
  } else {
    for (let i=0;i<arr.length;i++){
      const b = arr[i];
      const memCount = Object.keys(b.members||{}).length;
      const isMine = b.id === myBrand;
      html += `<div class="card">
        <div class="card-row">
          <div class="card-thumb">🏢</div>
          <div class="card-body">
            <div class="card-title">#${i+1} ${b.name}</div>
            <div class="card-sub">Lider: ${b.leaderName} • ${memCount} üye • ${b.points||0} puan</div>
          </div>
          ${isMine ? '<span class="small green">✓</span>' : (myBrand ? '' : `<button class="btn-mini primary" onclick="joinBrand('${b.id}').then(()=>render('marka'))">Katıl</button>`)}
        </div>
      </div>`;
    }
  }
  main.innerHTML = html;
}

function askCreateBrand(){
  showModal('Marka Kur', `
    <p class="small muted mb-8">Maliyet: 25.000 ₺ • Min Lv 10</p>
    <div class="input-group">
      <label>Marka Adı (3-20 harf/rakam)</label>
      <input type="text" id="brandName" maxlength="20" placeholder="Örn: TURAN">
    </div>
    <button class="btn-primary" onclick="createBrand($('#brandName').value).then(()=>{closeModal();render('marka')})">Kur</button>
  `);
}
window.askCreateBrand = askCreateBrand;

/* ============================================================
   PAZAR
   ============================================================ */
async function renderPazar(){
  const main = $('#appMain');
  const shops = await dbGet(`businesses/${GZ.uid}/shops`) || {};
  let totalRev = 0, totalSold = 0, totalShelves = 0;
  for (const s of Object.values(shops)){
    const shelves = s.shelves || {};
    for (const k of Object.keys(shelves)){
      const sh = shelves[k];
      totalShelves++;
      totalRev += sh.totalRevenue || 0;
      totalSold += sh.totalSold || 0;
    }
  }
  let html = `<div class="page-title">🛒 Oyuncu Pazarı</div>
    <div class="stats-grid">
      <div class="stat-box"><div class="lbl">Toplam Reyon</div><div class="val">${totalShelves}</div></div>
      <div class="stat-box"><div class="lbl">Toplam Ciro</div><div class="val green">${cashFmt(totalRev)}</div></div>
      <div class="stat-box"><div class="lbl">Satış (adet)</div><div class="val">${fmtInt(totalSold)}</div></div>
      <div class="stat-box"><div class="lbl">Şehir</div><div class="val" style="font-size:13px">${GZ.data?.location||'İstanbul'}</div></div>
    </div>
    <div class="card">
      <div class="card-title">📊 Pazar Mantığı</div>
      <p class="small muted mt-12">• Pazar her 90 saniyede otomatik döner<br>• Reyona stok eklemediğin sürece <b>satış olmaz</b><br>• Fiyat tabanın 1.5x altındaysa: satış %50 artar<br>• 3x üzerindeyse satış %90 düşer<br>• Açılış 24 saatinde 5x bonus<br>• Yüksek seviye dükkan = daha hızlı satış</p>
    </div>
    <div class="card mt-12">
      <div class="card-title">💡 Para Kazanmak İçin</div>
      <p class="small mt-12">1. Dükkan aç → reyon ekle → stok yükle → fiyat ayarla<br>2. Bahçe/çiftlik/fabrika ile <b>kendi üretimini</b> yap<br>3. Üretim → ihracat (2-3 katı kâr)<br>4. İhalelerde kazan → ihracat olarak sat<br>5. Banka yatırımı %0,3/gün</p>
    </div>`;
  main.innerHTML = html;
}

/* ============================================================
   LİDERLİK
   ============================================================ */
async function renderLiderlik(){
  const main = $('#appMain');
  let html = `<div class="page-title">🏆 Liderlik</div>
    <div class="subtabs">
      <button class="subtab active" onclick="lbView('total',event)">Servet</button>
      <button class="subtab" onclick="lbView('level',event)">Seviye</button>
      <button class="subtab" onclick="lbView('online',event)">Çevrimiçi</button>
    </div>
    <div id="lbList"><div class="spinner" style="margin:20px auto"></div></div>`;
  main.innerHTML = html;
  lbView('total');
}

async function lbView(mode, ev){
  $$('.subtab').forEach(b=>b.classList.remove('active'));
  if (ev && ev.target) ev.target.classList.add('active');
  const list = $('#lbList'); if (!list) return;
  list.innerHTML = '<div class="spinner" style="margin:20px auto"></div>';

  // GERÇEK kullanıcılar — bot yok
  const usersRaw = await dbGet('users') || {};
  let users = Object.entries(usersRaw)
    .map(([uid,u]) => ({ uid, ...u }))
    .filter(u => !u.banned && u.username);

  if (mode === 'total'){
    users.sort((a,b) => (b.netWorth||b.money||0) - (a.netWorth||a.money||0));
  } else if (mode === 'level'){
    users.sort((a,b) => (b.level||1) - (a.level||1));
  } else if (mode === 'online'){
    users = users.filter(u=>u.online);
    users.sort((a,b) => (b.netWorth||b.money||0) - (a.netWorth||a.money||0));
  }
  users = users.slice(0, 100);

  if (users.length === 0){
    list.innerHTML = emptyState('🏆','Listede oyuncu yok','İlk sırada sen olabilirsin');
    return;
  }

  let html = '';
  for (let i=0;i<users.length;i++){
    const u = users[i];
    const rank = i+1;
    const cls = rank===1?'gold':rank===2?'silver':rank===3?'bronze':'';
    const val = mode==='level' ? `Lv ${u.level||1}` : cashFmt(u.netWorth||u.money||0);
    html += `<div class="list-row" onclick="openProfile('${u.uid}')">
      <div class="rank ${cls}">#${rank}</div>
      <div class="av">${(u.username||'?')[0].toUpperCase()}</div>
      <div class="name">${u.username||'?'} ${u.online?'<span class="green small">●</span>':''}</div>
      <div class="lv">Lv ${u.level||1}</div>
      <div class="val">${val}</div>
    </div>`;
  }
  list.innerHTML = html;
}
window.lbView = lbView;

async function openProfile(uid){
  const u = await dbGet(`users/${uid}`);
  if (!u) return;
  const shops = await dbGet(`businesses/${uid}/shops`) || {};
  const isMe = uid === GZ.uid;
  const isFriend = (await dbGet(`friends/${GZ.uid}/${uid}`)) ? true : false;
  const lastSeen = u.lastSeen ? new Date(u.lastSeen).toLocaleString('tr-TR') : 'Hiç';

  showModal('Oyuncu Profili', `
    <div class="tac mb-12">
      <div style="width:80px;height:80px;font-size:36px;margin:0 auto 8px;background:var(--blue-l);border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;color:var(--primary)">${(u.username||'?')[0].toUpperCase()}</div>
      <h3>${u.username} ${u.online?'<span class="green">●</span>':''}</h3>
      <p class="small muted">${u.location||''} • ${u.online?'Çevrimiçi':'Son: '+lastSeen}</p>
    </div>
    <div class="stats-grid">
      <div class="stat-box"><div class="lbl">Seviye</div><div class="val">${u.level||1}</div></div>
      <div class="stat-box"><div class="lbl">Servet</div><div class="val green" style="font-size:13px">${cashFmt(u.netWorth||u.money||0)}</div></div>
      <div class="stat-box"><div class="lbl">Dükkanları</div><div class="val">${Object.keys(shops).length}</div></div>
      <div class="stat-box"><div class="lbl">Üyelik</div><div class="val" style="font-size:11px">${u.createdAt?new Date(u.createdAt).toLocaleDateString('tr-TR'):'-'}</div></div>
    </div>
    ${u.bio ? `<div class="card mt-12"><div class="small muted">Hakkında</div><p class="mt-12">${escapeHtml(u.bio)}</p></div>` : ''}
    ${!isMe ? `
      <div class="flex gap-8 mt-12">
        ${isFriend ? `
          <button class="btn-secondary" style="flex:1" onclick="removeFriend('${uid}').then(()=>{closeModal();})">✓ Arkadaş</button>
          <button class="btn-primary" style="flex:1" onclick="askLend('${uid}','${u.username}')">💸 Borç Ver</button>
        ` : `
          <button class="btn-primary" style="flex:1" onclick="addFriend('${uid}').then(()=>{closeModal();openProfile('${uid}')})">+ Arkadaş Ekle</button>
        `}
      </div>
    ` : ''}
  `);
}
window.openProfile = openProfile;

async function addFriend(uid){
  await dbSet(`friends/${GZ.uid}/${uid}`, now());
  await dbSet(`friends/${uid}/${GZ.uid}`, now());
  toast('Arkadaş eklendi','success');
}
window.addFriend = addFriend;

async function removeFriend(uid){
  await db.ref(`friends/${GZ.uid}/${uid}`).remove();
  await db.ref(`friends/${uid}/${GZ.uid}`).remove();
  toast('Arkadaşlık kaldırıldı');
}
window.removeFriend = removeFriend;

function askLend(uid, username){
  showModal('Borç Ver', `
    <p class="mb-8">Kime: <b>${username}</b></p>
    <div class="input-group">
      <label>Tutar (₺)</label>
      <input type="number" id="lendAmount" step="0.01" min="1">
    </div>
    <button class="btn-primary" onclick="confirmLend('${uid}')">Gönder</button>
  `);
}
window.askLend = askLend;

async function confirmLend(uid){
  const amt = parseFloat($('#lendAmount').value);
  if (!amt || amt<=0) return toast('Geçersiz tutar','error');
  const ok = await spendCash(GZ.uid, amt, 'lend');
  if (!ok) return toast('Yetersiz bakiye','error');
  await addCash(uid, amt, 'borrow-from-friend');
  await pushNotif(uid, `💸 ${GZ.data?.username} sana ${cashFmt(amt)} gönderdi`);
  await dbPush(`loans`, { from:GZ.uid, to:uid, amount:amt, paid:0, createdAt:now() });
  toast('Gönderildi','success');
  closeModal();
}
window.confirmLend = confirmLend;

/* ============================================================
   HABERLER
   ============================================================ */
async function renderHaberler(){
  const main = $('#appMain');
  if (!main) return;

  /* Yükleniyor göster */
  main.innerHTML = `
    <div class="page-title">📰 Haberler</div>
    <div style="text-align:center;padding:40px;color:var(--text-muted)">
      <div style="font-size:30px;margin-bottom:8px">⏳</div>Yükleniyor...
    </div>`;

  /* Zaman etiketi */
  function _ago(ts) {
    if (!ts) return '';
    const d = Date.now() - ts;
    const m = Math.floor(d / 60000);
    if (m < 1)  return 'az önce';
    if (m < 60) return m + ' dk önce';
    const h = Math.floor(m / 60);
    if (h < 24) return h + ' sa önce';
    return Math.floor(h / 24) + ' gün önce';
  }

  /* XSS koruma */
  function _e(s) {
    return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  let html = '<div class="page-title">📰 Haberler</div>';

  try {
    /* 1. Aktif etkinlik */
    let aktifEtkinlik = null;
    try { aktifEtkinlik = await dbGet('system/aktifEtkinlik'); } catch(e){}

    if (aktifEtkinlik && !aktifEtkinlik.bitti && aktifEtkinlik.bitecegiZaman > Date.now()) {
      const e = aktifEtkinlik;
      const kalanDk = Math.max(0, Math.ceil((e.bitecegiZaman - Date.now()) / 60000));
      const renk = e.tip === 'kriz' ? '#dc2626' : '#16a34a';
      const bg   = e.tip === 'kriz' ? 'rgba(220,38,38,.08)' : 'rgba(22,163,74,.08)';
      html += `
        <div style="background:${bg};border:2px solid ${renk}55;border-radius:14px;padding:14px;margin-bottom:14px">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
            <span style="font-size:26px">${e.ikon||'⚡'}</span>
            <div style="flex:1">
              <div style="font-size:14px;font-weight:800;color:${renk}">${_e(e.baslik)}</div>
              <div style="font-size:9px;padding:1px 7px;border-radius:999px;background:${renk};color:#fff;font-weight:700;display:inline-block;margin-top:2px">
                ${e.tip==='kriz'?'⚠️ KRİZ':'🚀 FIRSAT'} — ${kalanDk} DK KALDI
              </div>
            </div>
          </div>
          <p style="font-size:12px;color:var(--text);line-height:1.6;margin:0">${_e(e.mesaj)}</p>
        </div>`;
      document.querySelectorAll('.ev-dot').forEach(d=>d.remove());
    }

    /* 2. Etkinlik / sistem haberleri */
    let haberler = [];
    try {
      const hSnap = await db.ref('haberler').orderByChild('ts').limitToLast(10).once('value');
      hSnap.forEach(s => haberler.unshift({ key: s.key, ...s.val() }));
    } catch(e){}

    if (haberler.length) {
      html += `<div style="font-size:11px;font-weight:700;color:var(--text-muted);margin-bottom:8px;letter-spacing:.5px">⚡ ETKİNLİK LOGU</div>`;
      for (const h of haberler) {
        const ts   = h.ts ? new Date(h.ts).toLocaleString('tr-TR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}) : '';
        const renk = h.tip==='kriz' ? '#dc2626' : h.bitti ? '#64748b' : '#16a34a';
        html += `
          <div class="card mb-6" style="border-left:3px solid ${renk};padding:10px 12px">
            <div style="display:flex;align-items:center;gap:8px">
              <span style="font-size:18px">${h.ikon||'📢'}</span>
              <div style="flex:1">
                <div style="font-size:13px;font-weight:700;color:var(--text)">${_e(h.baslik)}
                  ${h.bitti?'<span style="font-size:9px;color:#64748b;margin-left:4px">• Sona erdi</span>':''}
                </div>
                <div style="font-size:11px;color:var(--text-muted);margin-top:2px">${_e(h.mesaj)}</div>
                <div style="font-size:10px;color:var(--text-muted);margin-top:2px">${ts}</div>
              </div>
            </div>
          </div>`;
      }
    }

    /* 3. Piyasa özet şeridi */
    let topGain = null, topLoss = null;
    try {
      for (const k of (window.KRIPTO||[])) {
        const p = GZ.prices?.[k.sym];
        if (!p || !p.prev) continue;
        const ch = ((p.current - p.prev) / (p.prev||1)) * 100;
        if (!topGain || ch > topGain.change) topGain = { ...k, change:ch, price:p.current };
        if (!topLoss || ch < topLoss.change) topLoss = { ...k, change:ch, price:p.current };
      }
    } catch(e){}

    const piyasaBits = [];
    if (topGain && topGain.change > 0)
      piyasaBits.push(`<span style="color:#16a34a">📈 ${_e(topGain.name)} +%${Math.abs(topGain.change).toFixed(1)}</span>`);
    if (topLoss && topLoss.change < 0)
      piyasaBits.push(`<span style="color:#ef4444">📉 ${_e(topLoss.name)} -%${Math.abs(topLoss.change).toFixed(1)}</span>`);

    if (piyasaBits.length) {
      html += `
        <div style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:10px 14px;margin-bottom:14px">
          <div style="font-size:11px;font-weight:700;color:var(--text-muted);margin-bottom:6px;letter-spacing:.5px">📊 PİYASA</div>
          <div style="display:flex;gap:10px;flex-wrap:wrap;font-size:12px">
            ${piyasaBits.join('<span style="color:var(--border)"> · </span>')}
          </div>
        </div>`;
    }

    /* 4. OYUNCU PAYLAŞIMLARI — Instagram akışı */
    html += `<div style="font-size:11px;font-weight:700;color:var(--text-muted);margin:4px 0 10px;letter-spacing:.5px">👥 OYUNCU PAYLAŞIMLARI</div>`;

    /* Gönderi kutusu */
    const myAvatar  = GZ?.data?.avatar  || '😊';
    html += `
      <div class="card" style="margin-bottom:14px;padding:14px">
        <div style="display:flex;align-items:flex-start;gap:10px">
          <div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#ec4899);
                      display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0">${myAvatar}</div>
          <div style="flex:1">
            <textarea id="gz_postInput" maxlength="280"
              placeholder="Ne düşünüyorsun? Paylaş..."
              style="width:100%;box-sizing:border-box;background:var(--bg);border:1px solid var(--border);
                     border-radius:10px;padding:10px;font-size:14px;color:var(--text);
                     resize:none;min-height:68px;font-family:inherit;outline:none"
              oninput="document.getElementById('gz_postCC').textContent=this.value.length"></textarea>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px">
              <span style="font-size:11px;color:var(--text-muted)"><span id="gz_postCC">0</span>/280</span>
              <button onclick="gzPostPaylas()"
                style="padding:8px 18px;background:linear-gradient(135deg,#6366f1,#818cf8);
                       border:none;border-radius:8px;color:#fff;font-weight:700;font-size:13px;cursor:pointer">
                📤 Paylaş
              </button>
            </div>
          </div>
        </div>
      </div>`;

    /* Gönderileri çek */
    let posts = [];
    try {
      const pSnap = await db.ref('posts').orderByChild('ts').limitToLast(30).once('value');
      pSnap.forEach(s => posts.unshift({ key: s.key, ...s.val() }));
    } catch(e){}

    if (!posts.length) {
      html += `
        <div style="text-align:center;padding:30px;color:var(--text-muted)">
          <div style="font-size:36px;margin-bottom:8px">💬</div>
          <div style="font-size:14px">İlk paylaşımı sen yap!</div>
        </div>`;
    } else {
      for (const p of posts) {
        const likeCount = p.likes ? Object.keys(p.likes).length : 0;
        const liked     = !!(p.likes && GZ?.uid && p.likes[GZ.uid]);
        const lvBadge   = p.level
          ? `<span style="font-size:10px;background:rgba(99,102,241,.2);color:#818cf8;border-radius:999px;padding:1px 7px;font-weight:700;margin-left:4px">Lv ${p.level}</span>`
          : '';
        html += `
          <div class="card" style="margin-bottom:12px;padding:14px">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
              <div style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#ec4899);
                          display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0">
                ${p.avatar||'😊'}
              </div>
              <div style="flex:1">
                <div style="font-size:14px;font-weight:700;color:var(--text)">${_e(p.username||'Oyuncu')}${lvBadge}</div>
                <div style="display:flex;gap:6px;align-items:center;margin-top:2px;flex-wrap:wrap">
                  ${p.city ? `<span style="font-size:11px;color:var(--text-muted)">📍 ${_e(p.city)}</span>` : ''}
                  <span style="font-size:10px;color:var(--text-muted)">${_ago(p.ts)}</span>
                </div>
              </div>
            </div>
            <p style="font-size:14px;color:var(--text);line-height:1.6;margin:0 0 12px;word-break:break-word">${_e(p.text||'')}</p>
            <div style="display:flex;align-items:center;gap:16px;padding-top:10px;border-top:1px solid var(--border)">
              <div style="display:flex;align-items:center;gap:6px">
                <button data-pkey="${p.key}" onclick="gzPostBegen('${p.key}')"
                  style="background:none;border:none;font-size:20px;cursor:pointer;padding:0;line-height:1">
                  ${liked ? '❤️' : '🤍'}
                </button>
                <span id="gz_lc_${p.key}" style="font-size:13px;color:var(--text-muted);font-weight:600">${likeCount}</span>
              </div>
              <div style="font-size:13px;color:var(--text-muted)">💬 ${p.commentCount||0}</div>
            </div>
          </div>`;
      }
    }

  } catch(err) {
    html += `<div style="text-align:center;padding:30px;color:#ef4444">
      ❌ Hata: ${_e(err.message||String(err))}
      <br><br><button onclick="renderHaberler()"
        style="padding:8px 16px;background:#3b82f6;border:none;border-radius:8px;color:#fff;cursor:pointer">🔄 Tekrar dene</button>
    </div>`;
  }

  main.innerHTML = html;
}

/* ── Gönderi paylaş ── */
window.gzPostPaylas = async function() {
  const inp  = document.getElementById('gz_postInput');
  if (!inp) return;
  const text = inp.value.trim();
  if (!text) return toast('Bir şeyler yaz 😊', 'warn');
  if (text.length > 280) return toast('Maksimum 280 karakter', 'warn');
  if (!GZ?.uid) return toast('Giriş yapman gerekiyor', 'error');

  try {
    const d = GZ.data || {};
    await db.ref('posts').push({
      uid:          GZ.uid,
      username:     d.username || 'Oyuncu',
      avatar:       d.avatar   || '😊',
      city:         d.location || d.city || '',
      level:        d.level    || 1,
      text:         text,
      ts:           firebase.database.ServerValue.TIMESTAMP,
      likes:        {},
      commentCount: 0
    });
    inp.value = '';
    const cc = document.getElementById('gz_postCC');
    if (cc) cc.textContent = '0';
    toast('✅ Paylaşıldı!', 'success');
    renderHaberler();
  } catch(e) {
    toast('Hata: ' + e.message, 'error');
  }
};

/* ── Beğeni ── */
window.gzPostBegen = async function(postKey) {
  if (!GZ?.uid) return;
  try {
    const ref  = db.ref('posts/' + postKey + '/likes/' + GZ.uid);
    const snap = await ref.once('value');
    const liked = !!snap.val();
    if (liked) { await ref.remove(); }
    else        { await ref.set(true); }

    /* Optimistic UI */
    const btn = document.querySelector(`[data-pkey="${postKey}"]`);
    const cnt = document.getElementById('gz_lc_' + postKey);
    if (btn) btn.textContent = liked ? '🤍' : '❤️';
    if (cnt) cnt.textContent = Math.max(0, parseInt(cnt.textContent||'0') + (liked ? -1 : 1));
  } catch(e) {}
};

/* ============================================================
   ŞEHİRLER
   ============================================================ */
async function renderSehirler(){
  const main = $('#appMain');
  const my = GZ.data?.location || 'İstanbul';
  let html = `<div class="page-title">🏙️ Şehirler</div>
    <p class="small muted mb-12">Şehir seçimi dükkanların açıldığı yeri ve halk talebini etkiler.</p>`;
  for (const c of ILLER){
    const isMine = c === my;
    const pop = (Math.floor((c.charCodeAt(0)*7919) % 5)+1) * 100000; // sahte ama tutarlı
    html += `<div class="card" ${isMine?'':`onclick="moveCity('${c}')"`}>
      <div class="card-row">
        <div class="card-thumb">📍</div>
        <div class="card-body">
          <div class="card-title">${c} ${isMine?'<span class="small green">(Şehrin)</span>':''}</div>
          <div class="card-sub">Tahmini nüfus: ${fmtInt(pop)}</div>
        </div>
      </div>
    </div>`;
  }
  main.innerHTML = html;
}

async function moveCity(city){
  if (!confirm(`Ana şehrini ${city}'e taşımak ister misin? (Ücretsiz)`)) return;
  await dbUpdate(`users/${GZ.uid}`, { location: city });
  toast(`Ana şehrin: ${city}`, 'success');
  render('sehirler');
}
window.moveCity = moveCity;

/* ============================================================
   MAĞAZA
   ============================================================ */
async function renderMagaza(){
  const main = $('#appMain');
  let html = `<div class="page-title">💎 Mağaza</div>
    <p class="small muted mb-12">Para satın al butonu sadece simülasyondur — gerçek tahsilat için entegrasyon gerekir.</p>
    <div class="section-title">Elmas Paketleri</div>`;
  for (const p of ELMAS_PAKETLERI){
    const total = p.dia + p.bonus;
    html += `<div class="card">
      <div class="card-row">
        <div class="card-thumb">💎</div>
        <div class="card-body">
          <div class="card-title">${total} 💎 ${p.bonus?`<span class="small green">+${p.bonus} bonus</span>`:''}</div>
          <div class="card-sub">${cashFmt(p.tl)}</div>
        </div>
        <button class="btn-mini primary" onclick="buyDiamondPack('${p.id}')">Satın Al</button>
      </div>
    </div>`;
  }
  html += `<div class="section-title">Robotlar (Çevrimdışıyken otomatik yönetir)</div>`;
  for (const r of ROBOT_PAKETLERI){
    html += `<div class="card">
      <div class="card-row">
        <div class="card-thumb">🤖</div>
        <div class="card-body">
          <div class="card-title">${r.name}</div>
          <div class="card-sub">${r.hours} saat aktif</div>
        </div>
        <button class="btn-mini primary" onclick="buyRobot('${r.id}').then(()=>render('magaza'))">💎 ${r.diamonds}</button>
      </div>
    </div>`;
  }
  // Robot durumu
  const robotUntil = GZ.data?.robotUntil || 0;
  if (robotUntil > now()){
    const remaining = Math.ceil((robotUntil - now())/3600000);
    html += `<div class="card mt-12" style="border-color:var(--green)">
      <div class="card-title green">🤖 Robot aktif</div>
      <p class="small mt-12">Kalan süre: ~${remaining} saat</p>
    </div>`;
  }
  main.innerHTML = html;
}

async function buyDiamondPack(pid){
  const p = ELMAS_PAKETLERI.find(x=>x.id===pid);
  if (!p) return;
  const totalDia = p.dia + p.bonus;
  if (!confirm(`${cashFmt(p.tl)} karşılığında ${totalDia} 💎 satın almak istiyor musun?\nHesabından ${cashFmt(p.tl)} düşülecek.`)) return;
  // Önce parayı düş
  const ok = await spendCash(GZ.uid, p.tl, 'diamond-purchase');
  if (!ok) return toast('Yetersiz bakiye', 'error');
  // Sonra elması ekle
  await addDiamonds(GZ.uid, totalDia);
  // Satın alma logu (admin paneli için)
  try {
    await db.ref('diamondPurchases').push({
      uid: GZ.uid,
      username: GZ.data?.username || '',
      packId: p.id,
      diamonds: totalDia,
      tl: p.tl,
      ts: firebase.database.ServerValue.TIMESTAMP
    });
  } catch(e){}
  toast(`💎 +${totalDia} elmas eklendi!`, 'success', 4000);
  render('magaza');
}
window.buyDiamondPack = buyDiamondPack;

/* ============================================================
   HİKAYE
   ============================================================ */
function renderHikaye(){
  const main = $('#appMain');
  main.innerHTML = `
    <div class="page-title">📖 Hikaye</div>
    <div class="card">
      <div class="card-title">GameZone ERP</div>
      <p class="mt-12" style="line-height:1.7">
        GameZone ERP, gerçek zamanlı bir ticaret simülasyon oyunudur. Sıfırdan bir imparatorluk inşa edersin: dükkan açar, bahçe ekersin, çiftlik kurar, fabrika işletir ve madenler keşfedersin. Ürettiklerini ihracat eder, ihalelerde rekabet eder, kripto piyasasında pozisyon alırsın. Markalar kurar, takımlar oluşturur ve liderlik tablosunda en zengin oyuncu olmak için yarışırsın.
      </p>
    </div>
    <div class="card mt-12">
      <div class="card-title">👨‍💻 Geliştiriciler</div>
      <p class="mt-12">Bu oyun <b>Serkan Karakaş</b> ve <b>Resul Karakaş</b> tarafından <b>GameZone ERP</b> markası altında geliştirilmektedir. Düzenli olarak (haftada 1-2 defa) güncellenmektedir.</p>
    </div>
    <div class="card mt-12">
      <div class="card-title">🤝 Birlikte Geliştir</div>
      <p class="mt-12">Fikrin veya önerin varsa, bu oyunu birlikte geliştirmeyi düşünüyoruz. <b>Geri bildirim</b> kısmından düşüncelerini ilet — incelemeden geri çevirmeyiz.</p>
      <button class="btn-primary mt-12" style="width:100%" onclick="askFeedback()">📝 Geri Bildirim Gönder</button>
    </div>
    <div class="card mt-12">
      <div class="card-title">🛡️ Adil Oyun Politikası</div>
      <p class="mt-12">
        • Para hilesi <b>kesinlikle</b> kabul edilmez. Ben dahil hiç kimse bu kuralın üstünde değildir.<br>
        • Küfür, taciz, hakaret tespit edildiğinde <b>kalıcı ban</b> uygulanır.<br>
        • Tüm verileriniz Firebase'de saklanır — telefonunuza bağımlı değildir, başka cihazdan aynı hesapla giriş yapabilirsiniz.<br>
        • Anormal yüksek bakiyeli yeni hesaplar otomatik incelenir.<br>
        • Şifre sıfırlama, e-posta doğrulama gibi güvenlik akışları kuruluyor — şifrenizi kimseyle paylaşmayın.
      </p>
    </div>
    <div class="card mt-12">
      <div class="card-title">🚀 Gelecek Güncellemeler</div>
      <p class="mt-12">• Marka içi üretim tesisleri<br>• Şehirler arası lojistik araçları<br>• Borsa endeksleri<br>• Sezonluk etkinlikler<br>• Klan savaşları</p>
    </div>
  `;
}

function askFeedback(){
  showModal('Geri Bildirim', `
    <div class="input-group">
      <label>Görüşün, hatan veya öneriniz</label>
      <textarea id="fbText" rows="6" style="resize:vertical;width:100%;padding:12px;border:1px solid var(--border);border-radius:10px;font-family:inherit" placeholder="Şu özellik şöyle olsa daha iyi olur, şurda hata var, vs."></textarea>
    </div>
    <button class="btn-primary" onclick="sendFeedback()">Gönder</button>
  `);
}
window.askFeedback = askFeedback;

async function sendFeedback(){
  const txt = $('#fbText').value.trim();
  if (txt.length < 10) return toast('En az 10 karakter','warn');
  await dbPush('feedback', {
    uid: GZ.uid, username: GZ.data?.username, text: txt, ts: now(), read: false
  });
  closeModal();
  toast('Teşekkürler, ulaştı 🙏','success');
}
window.sendFeedback = sendFeedback;

/* ============================================================
   SSS
   ============================================================ */
function renderSSS(){
  const main = $('#appMain');
  main.innerHTML = `
    <div class="page-title">❓ Sıkça Sorulanlar</div>
    ${faqCard('Para nasıl kazanırım?',
      `1. <b>Dükkan aç</b> → reyon ekle → stok yükle → mantıklı fiyat belirle → otomatik satışlar başlar (her 90sn)<br>
       2. <b>Bahçe / Çiftlik / Fabrika kur</b> → ekim yap → hasat et → ihracat'tan sat (2-3 katı kâr)<br>
       3. <b>İhalelere katıl</b> → kazandığın ürünleri ihracatta sat<br>
       4. <b>Kripto al-sat</b> → düşükten al, tepede sat<br>
       5. <b>Banka yatırımı</b> → günlük %0,3 faiz`)}
    ${faqCard('Reyon nedir, nasıl açılır?',
      `Dükkanın içine girip "+ Yeni Reyon" butonuna bas. Açmak için 500₺. Sonra ürün stoku yüklemen ve fiyat belirlemen gerekir. <b>Reyona stok yüklemediğin sürece satış olmaz.</b>`)}
    ${faqCard('Üst seviye özellikler nasıl açılır?',
      `Her özellik belirli seviyede açılır:<br>
       • Bahçe: Lv 2<br>
       • Elektronik dükkan: Lv 5<br>
       • Çiftlik: Lv 5<br>
       • Fabrika: Lv 8<br>
       • Marka kurma: Lv 10<br>
       • Madenler: Lv 30<br>
       Erken seviyede para kazanmaya odaklan.`)}
    ${faqCard('Banka nasıl çalışır?',
      `<b>Hesap Bakiyesi:</b> Cebinden çekip yatırırsın, faizsiz korunur.<br>
       <b>Yatırım Hesabı:</b> Günlük %0,3 faiz biriktirir.<br>
       <b>Kredi:</b> Seviye × 5.000 ₺ kadar çekebilirsin.<br>
       <b>İşletme Gideri:</b> Haftalık her dükkan için 200₺.<br>
       <b>Çalışan Maaşları:</b> Haftalık her çalışan için 350₺.<br>
       Para yetmezse otomatik krediye eklenir.`)}
    ${faqCard('Seviye sistemi sınırlı mı?',
      `Hayır — sınırsız. Ama her seviye atlamak öncekinin ~1,6 katı XP gerektirir. XP, satışlardan ve hasattan kazanılır.`)}
    ${faqCard('Hile yaparsam ne olur?',
      `Anormal davranış (tek seferde milyonlarca kazanma, IP-VPN spam, ekran içi para hilesi) tespit edildiğinde <b>kalıcı ban</b>. Ben dahil hiç kimsenin istisnası yok.`)}
    ${faqCard('Şifremi unuttum, ne yapmalıyım?',
      `Giriş ekranındaki "Şifremi Unuttum" linkine bas, e-posta adresini gir. Firebase üzerinden sıfırlama bağlantısı gönderilir.`)}
    ${faqCard('Verilerim nerede saklanıyor?',
      `Tüm verilerin Google Firebase Realtime Database'de saklanır. Telefonunu değiştirsen bile aynı hesapla girince her şey yerinde olur.`)}
    ${faqCard('Robot ne işe yarar?',
      `Çevrimdışıyken otomatik olarak: hasatları toplar, ihracat fırsatlarını değerlendirir, fiyat ayarlar. Saatlik/günlük/haftalık/aylık paketler mağazada.`)}
  `;
}
function faqCard(q, a){
  return `<div class="card"><div class="card-title">${q}</div><p class="mt-12 small" style="line-height:1.7">${a}</p></div>`;
}

/* ============================================================
   TOPBAR MODALLERİ (Chat / Bildirim / Banka / Profil)
   ============================================================ */
function openTopbarModal(name){
  if (name==='chat') openChat();
  else if (name==='notif') openNotifs();
  else if (name==='bank') openBank();
  else if (name==='profile') openMyProfile();
}

/* ----- CHAT ----- */
let chatUnsub = null;
function openChat(){
  $('#chatBadge').hidden = true;
  localStorage.setItem('chatLastSeen', String(now()));

  showModal('💬 Sohbet', `
    <div class="chat-wrap" style="height:60vh">
      <div class="chat-list" id="chatList"></div>
      <div class="chat-input">
        <input type="text" id="chatInput" placeholder="Mesaj yaz..." maxlength="200">
        <button onclick="sendChat()">➤</button>
      </div>
    </div>
  `);

  $('#chatInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') sendChat();
  });

  // Önceki dinleyiciyi kapat
  if (chatUnsub) chatUnsub();
  const ref = db.ref('chat/global').limitToLast(50);
  const cb = ref.on('value', s => {
    const list = s.val() || {};
    const arr = Object.entries(list).sort((a,b)=>a[1].ts-b[1].ts);
    const out = arr.map(([id,m]) => {
      const me = m.uid === GZ.uid;
      return `<div class="chat-msg ${me?'me':''}">
        <div class="chat-meta">${me?'':`<b>${escapeHtml(m.username||'?')}</b> • `}${new Date(m.ts).toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'})}</div>
        <div class="chat-bubble">${escapeHtml(m.message||'')}</div>
      </div>`;
    }).join('');
    const cl = $('#chatList');
    if (cl){
      cl.innerHTML = out || '<p class="muted small tac" style="padding:20px">Sohbet boş, ilk mesajı sen at!</p>';
      cl.scrollTop = cl.scrollHeight;
    }
  });
  chatUnsub = () => ref.off();
}

async function sendChat(){
  const inp = $('#chatInput'); if (!inp) return;
  const msg = inp.value.trim();
  if (!msg) return;
  if (msg.length > 200) return toast('Çok uzun (max 200 karakter)','warn');
  if (!GZ.uid) return toast('Giriş yapman gerekiyor', 'error');

  // Username güvenli alım
  const username = GZ.data?.username
    || (await dbGet(`users/${GZ.uid}/username`).catch(()=>null))
    || 'Anonim';

  try {
    await dbPush('chat/global', {
      uid: GZ.uid,
      username: username,
      message: msg,
      ts: now()
    });
    inp.value = '';
    // Görev sayacı
    if (typeof window.incrementGorev === 'function') window.incrementGorev('chat_5', 1);
  } catch(e) {
    console.error('[sendChat] hata:', e);
    toast('Mesaj gönderilemedi, bağlantı hatası', 'error');
  }
}
window.sendChat = sendChat;

/* ----- BİLDİRİMLER ----- */
async function openNotifs(){
  const list = await dbGet(`notifs/${GZ.uid}`) || {};
  const arr = Object.entries(list).sort((a,b)=>b[1].ts-a[1].ts);
  let body = '';
  if (arr.length === 0){
    body = emptyState('🔔','Bildirim yok','İşlemlerin burada görünür');
  } else {
    for (const [id, n] of arr){
      body += `<div class="card ${n.read?'':'style="border-color:var(--primary)"'}">
        <p>${escapeHtml(n.msg)}</p>
        <p class="small muted mt-12">${new Date(n.ts).toLocaleString('tr-TR')}</p>
      </div>`;
    }
    body += `<button class="btn-secondary mt-12" style="width:100%" onclick="clearNotifs()">Tümünü Temizle</button>`;
  }
  showModal('🔔 Bildirimler', body);

  // Hepsini okundu işaretle
  const updates = {};
  for (const [id] of arr) updates[`${id}/read`] = true;
  if (Object.keys(updates).length) db.ref(`notifs/${GZ.uid}`).update(updates);
}

async function clearNotifs(){
  if (!confirm('Tüm bildirimler silinsin mi?')) return;
  await db.ref(`notifs/${GZ.uid}`).remove();
  closeModal();
  toast('Temizlendi');
}
window.clearNotifs = clearNotifs;

/* ----- BANKA ----- */
async function openBank(){
  const bank = await dbGet(`bank/${GZ.uid}`) || { balance:0, investment:0, loan:0 };
  const total = (GZ.data?.money||0) + (bank.balance||0) + (bank.investment||0) - (bank.loan||0);
  const lv = GZ.data?.level||1;
  const maxLoan = lv * 5000;

  showModal('🏦 Banka', `
    <div class="tac mb-12">
      <div class="small muted">Toplam Bakiye</div>
      <div style="font-size:24px;font-weight:800;color:var(--primary)">${cashFmt(total)}</div>
    </div>

    <div class="bank-acc">
      <div class="lbl">Hesap Bakiyesi</div>
      <div class="bal">${cashFmt(bank.balance||0)}</div>
      <div class="desc">Faizsiz korumalı hesap</div>
      <div class="acts">
        <button class="btn-primary" onclick="askBankOp('deposit')">Yatır</button>
        <button class="btn-secondary" onclick="askBankOp('withdraw')">Çek</button>
      </div>
    </div>

    <div class="bank-acc">
      <div class="lbl">Yatırım Hesabı <span class="small green">(%0,3 / gün)</span></div>
      <div class="bal">${cashFmt(bank.investment||0)}</div>
      <div class="desc">Günlük faiz birikir, istediğinde çek</div>
      <div class="acts">
        <button class="btn-primary" onclick="askBankOp('invest')">Yatır</button>
        <button class="btn-secondary" onclick="askBankOp('investWithdraw')">Çek</button>
      </div>
    </div>

    <div class="bank-acc">
      <div class="lbl">Kredi <span class="small muted">(Limit: ${cashFmt(maxLoan)})</span></div>
      <div class="bal red">${cashFmt(bank.loan||0)}</div>
      <div class="desc">Limit her seviyede artar</div>
      <div class="acts">
        <button class="btn-primary" onclick="askBankOp('borrow')">Çek</button>
        <button class="btn-success" onclick="askBankOp('repay')">Öde</button>
      </div>
    </div>

    <div class="card mt-12">
      <div class="row-between">
        <span>İşletme gideri (haftalık)</span>
        <b>${cashFmt(bank.nextBusinessExpense ? Math.max(0, bank.nextBusinessExpense - now())/(24*3600*1000) : 0)} gün</b>
      </div>
      <div class="row-between mt-12">
        <span>Çalışan maaşı (haftalık)</span>
        <b>${cashFmt(bank.nextSalary ? Math.max(0, bank.nextSalary - now())/(24*3600*1000) : 0)} gün</b>
      </div>
    </div>
  `);
}

async function askBankOp(op){
  const titles = {
    deposit:'💰 Hesaba Yatır', withdraw:'💸 Hesaptan Çek',
    invest:'📈 Yatırım Yap', investWithdraw:'📉 Yatırım Çek',
    borrow:'💳 Kredi Çek', repay:'✅ Kredi Öde'
  };
  // Max tutarı operasyona göre belirle
  const bank = await dbGet(`bank/${GZ.uid}`) || { balance:0, investment:0, loan:0 };
  const myMoney = GZ.data?.money || 0;
  const lv = GZ.data?.level || 1;
  const maxLoan = lv * 5000;

  let maxAmount = 0;
  let maxLabel = '';
  switch(op) {
    case 'deposit':         maxAmount = myMoney;                    maxLabel = 'Cüzdan'; break;
    case 'withdraw':        maxAmount = bank.balance || 0;          maxLabel = 'Hesap'; break;
    case 'invest':          maxAmount = myMoney;                    maxLabel = 'Cüzdan'; break;
    case 'investWithdraw':  maxAmount = bank.investment || 0;       maxLabel = 'Yatırım'; break;
    case 'borrow':          maxAmount = maxLoan - (bank.loan||0);   maxLabel = 'Kalan limit'; break;
    case 'repay':           maxAmount = Math.min(myMoney, bank.loan || 0); maxLabel = 'Borç/Bakiye'; break;
    case 'repayFull': {
      const fullAmt = bank.loan||0;
      if (fullAmt <= 0) return toast('Borcunuz yok','info');
      if (myMoney < fullAmt) return toast(`Yeterli para yok. Gerekli: ${cashFmt(fullAmt)}`,'warn');
      if (!confirm(`Tüm borcunuz (${cashFmt(fullAmt)}) ödensin mi?`)) return;
      await bankRepay(fullAmt);
      toast('✅ Tüm borç ödendi!','success');
      render('banka');
      return;
    }
    case 'payTaxNow': {
      // Vergiyi hemen hesapla ve öde
      const mbR = await dbGet('system/merkezBankasi') || {};
      const vOran = Math.min(0.9, (mbR.gelirOrani||40)/100);
      const sps = await dbGet('businesses/'+GZ.uid+'/shops') || {};
      const gds = await dbGet('businesses/'+GZ.uid+'/gardens') || {};
      const fms = await dbGet('businesses/'+GZ.uid+'/farms') || {};
      const fcs = await dbGet('businesses/'+GZ.uid+'/factories') || {};
      const mns = await dbGet('businesses/'+GZ.uid+'/mines') || {};
      const sabit = Object.keys(sps).length*(mbR.rates_shopTax||500)+
                    Object.keys(gds).length*(mbR.rates_gardenTax||300)+
                    Object.keys(fms).length*(mbR.rates_farmTax||300)+
                    Object.keys(fcs).length*(mbR.rates_factoryTax||800)+
                    Object.keys(mns).length*(mbR.rates_mineTax||600);
      const gelirV = +((GZ.data?.weeklyRevenue||0)*vOran).toFixed(2);
      const toplam = sabit + gelirV;
      if (toplam <= 0) return toast('Ödenecek vergi yok','info');
      if (!confirm(`Toplam ${cashFmt(toplam)} vergi ödensin mi?`)) return;
      const ok = await spendCash(GZ.uid, toplam, 'tax-manual');
      if (ok) {
        const merkez = await dbGet('system/authorityUid');
        if (merkez) await db.ref('users/'+merkez+'/money').transaction(c=>(c||0)+toplam);
        await db.ref('system/merkezBankasi/totalVergi').transaction(c=>(c||0)+toplam);
        await dbUpdate('users/'+GZ.uid, { weeklyRevenue: 0 });
        toast('✅ Vergi ödendi: '+cashFmt(toplam),'success');
        render('banka');
      } else {
        toast('Yeterli para yok','error');
      }
      return;
    }
  }
  maxAmount = Math.max(0, Math.floor(maxAmount * 100) / 100);

  showModal(titles[op], `
    <div class="input-group">
      <label>Tutar (₺) — <b style="color:var(--primary)">${maxLabel}: ${cashFmt(maxAmount)}</b></label>
      <input type="number" id="bankAmount" step="0.01" min="0.01" placeholder="Tutar gir">
    </div>
    <div class="quick-amount-row">
      <button class="btn-quick" onclick="bankQuickFill(${maxAmount},0.25)">%25</button>
      <button class="btn-quick" onclick="bankQuickFill(${maxAmount},0.50)">%50</button>
      <button class="btn-quick" onclick="bankQuickFill(${maxAmount},0.75)">%75</button>
      <button class="btn-quick btn-quick-max" onclick="bankQuickFill(${maxAmount},1.0)">💰 TÜMÜ</button>
    </div>
    <button class="btn-primary" onclick="confirmBankOp('${op}')" style="width:100%;margin-top:10px">Onayla</button>
  `);
}
window.askBankOp = askBankOp;

window.bankQuickFill = function(maxAmount, ratio) {
  const inp = document.getElementById('bankAmount');
  if (!inp) return;
  const v = Math.floor(maxAmount * ratio * 100) / 100;
  inp.value = v;
  if (ratio === 1.0) toast(`💰 Maksimum: ${cashFmt(v)}`, 'info', 2000);
};

async function confirmBankOp(op){
  const amt = parseFloat($('#bankAmount').value);
  if (!amt || amt<=0) return toast('Geçersiz tutar','error');
  closeModal();
  if (op==='deposit') await bankDeposit(amt);
  else if (op==='withdraw') await bankWithdraw(amt);
  else if (op==='invest') await bankInvest(amt);
  else if (op==='investWithdraw') await bankInvestWithdraw(amt);
  else if (op==='borrow') await bankBorrow(amt);
  else if (op==='repay') await bankRepay(amt);
  closeModal();
  setTimeout(()=>render('banka'), 300);
}
window.confirmBankOp = confirmBankOp;

/* ----- PROFİLİM ----- */
async function openMyProfile(){
  const u = GZ.data;
  const bank = await dbGet(`bank/${GZ.uid}`) || {};
  const friends = await dbGet(`friends/${GZ.uid}`) || {};
  const twoFA = u.twoFactorEnabled || false;

  // Güvenlik puanı hesapla
  let secScore = 0;
  if (u.verified) secScore += 25;
  if (twoFA) secScore += 40;
  if (u.email && u.email.includes('@')) secScore += 20;
  if (u.level > 1) secScore += 15;
  const secColor = secScore >= 80 ? '#16a34a' : secScore >= 50 ? '#f59e0b' : '#dc2626';
  const secLabel = secScore >= 80 ? 'Yüksek' : secScore >= 50 ? 'Orta' : 'Düşük';

  showModal('👤 Profilim', `
    <div class="tac mb-12">
      <div style="width:80px;height:80px;font-size:36px;margin:0 auto 8px;background:var(--blue-l);border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;color:var(--primary)">${(u.username||'?')[0].toUpperCase()}</div>
      <h3>${u.username}</h3>
      <p class="small muted">${u.email}</p>
    </div>

    <div class="stats-grid">
      <div class="stat-box"><div class="lbl">Seviye</div><div class="val">${u.level||1}</div></div>
      <div class="stat-box"><div class="lbl">Konum</div><div class="val" style="font-size:13px">${u.location||'-'}</div></div>
      <div class="stat-box"><div class="lbl">Nakit</div><div class="val green" style="font-size:13px">${cashFmt(u.money||0)}</div></div>
      <div class="stat-box"><div class="lbl">Banka</div><div class="val" style="font-size:13px">${cashFmt((bank.balance||0)+(bank.investment||0))}</div></div>
      <div class="stat-box"><div class="lbl">Elmas</div><div class="val">💎 ${u.diamonds||0}</div></div>
      <div class="stat-box"><div class="lbl">Arkadaş</div><div class="val">${Object.keys(friends).length}</div></div>
    </div>

    <!-- HESAP GÜVENLİĞİ BÖLÜMÜ -->
    <div class="section-title">🛡️ Hesap Güvenliği</div>
    <div class="sec-score-wrap">
      <div class="sec-score-bar"><div class="sec-score-fill" style="width:${secScore}%;background:${secColor}"></div></div>
      <div class="sec-score-lbl"><span>Güvenlik Puanı</span><span style="color:${secColor};font-weight:800">${secScore}/100 — ${secLabel}</span></div>
    </div>

    <!-- 2FA Kartı -->
    <div class="twofa-card ${twoFA ? 'active-2fa' : ''}">
      <div class="twofa-row">
        <div class="twofa-icon">📱</div>
        <div class="twofa-body">
          <div class="twofa-title">SMS İki Adımlı Doğrulama</div>
          <div class="twofa-sub">${twoFA ? (u.twoFactorPhone || 'Aktif') : 'Her girişte SMS kodu istenir'}</div>
        </div>
        <span class="twofa-badge ${twoFA ? '' : 'off'}">${twoFA ? '✓ AKTİF' : 'KAPALI'}</span>
      </div>
      <div class="flex gap-8 mt-12">
        ${twoFA
          ? `<button class="btn-danger" style="flex:1" onclick="disable2FA()">Devre Dışı Bırak</button>`
          : `<button class="btn-primary" style="flex:1" onclick="open2FASetup()">🔐 Aktifleştir</button>`
        }
      </div>
    </div>

    <!-- E-posta & Şifre Değiştir -->
    <div class="card">
      <div class="row-between mb-8">
        <span>✉️ E-posta Değiştir</span>
        <button class="btn-mini primary" onclick="changeEmail()">Değiştir</button>
      </div>
      <div class="row-between">
        <span>🔑 Şifre Değiştir</span>
        <button class="btn-mini primary" onclick="changePassword()">Değiştir</button>
      </div>
    </div>

    <div class="section-title">Hakkımda</div>
    <div class="input-group">
      <textarea id="bioText" rows="3" style="width:100%;padding:12px;border:1px solid var(--border);border-radius:10px" placeholder="Kısaca kendinden bahset...">${escapeHtml(u.bio||'')}</textarea>
    </div>
    <button class="btn-primary mb-12" onclick="saveBio()" style="width:100%">Kaydet</button>

    <div class="section-title">Ayarlar</div>
    <div class="card">
      <div class="row-between">
        <span>🌙 Karanlık Mod</span>
        <button class="btn-mini primary" onclick="toggleTheme()">Değiştir</button>
      </div>
      <div class="row-between mt-12">
        <span>🔔 Sesli Bildirim</span>
        <button class="btn-mini" onclick="toggleSound()">${localStorage.getItem('sound')==='off'?'Kapalı':'Açık'}</button>
      </div>
    </div>

    <div class="flex gap-8 mt-12">
      <button class="btn-secondary" style="flex:1" onclick="logout()">Çıkış Yap</button>
      <button class="btn-danger" style="flex:1" onclick="askResetAccount()">Hesap Sıfırla</button>
    </div>
  `);
}

async function saveBio(){
  const txt = $('#bioText').value.trim().slice(0, 500);
  await dbUpdate(`users/${GZ.uid}`, { bio: txt });
  toast('Kaydedildi','success');
}
window.saveBio = saveBio;

function toggleTheme(){
  const cur = document.documentElement.getAttribute('data-theme') || 'light';
  const next = cur === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  toast(next==='dark'?'Karanlık mod':'Aydınlık mod','success');
}
window.toggleTheme = toggleTheme;

function toggleSound(){
  const cur = localStorage.getItem('sound') || 'on';
  localStorage.setItem('sound', cur==='on'?'off':'on');
  toast(cur==='on'?'Ses kapalı':'Ses açık');
  closeModal(); openMyProfile();
}
window.toggleSound = toggleSound;

async function logout(){
  await auth.signOut();
  location.reload();
}
window.logout = logout;

function askResetAccount(){
  if (!confirm('TÜM verilerin silinecek (dükkanlar, para, kripto). Bunu yapmak istediğinden emin misin?')) return;
  if (!confirm('Son uyarı! Geri alınamaz. Devam?')) return;
  resetAccount();
}
window.askResetAccount = askResetAccount;

async function resetAccount(){
  await db.ref(`businesses/${GZ.uid}`).remove();
  await db.ref(`bank/${GZ.uid}`).remove();
  await db.ref(`crypto/holdings/${GZ.uid}`).remove();
  await db.ref(`friends/${GZ.uid}`).remove();
  await dbUpdate(`users/${GZ.uid}`, {
    money: 20000, diamonds: 10, level:1, xp:0, location:'İstanbul', netWorth: 20000
  });
  await dbSet(`bank/${GZ.uid}`, {
    balance:0, investment:0, investmentDate: now(), loan:0,
    nextBusinessExpense: now()+7*24*3600*1000, nextSalary: now()+7*24*3600*1000
  });
  toast('Hesap sıfırlandı','success');
  closeModal();
  setTimeout(()=>{ GZ.data = {}; switchTab('dukkan'); }, 1000);
}

/* ============================================================
   MODAL ALTYAPISI
   ============================================================ */
function showModal(title, bodyHtml, footHtml){
  closeModal();
  const root = $('#modalRoot');
  const bg = document.createElement('div');
  bg.className = 'modal-bg';
  bg.innerHTML = `
    <div class="modal" onclick="event.stopPropagation()">
      <div class="modal-grabber"></div>
      <div class="modal-head">
        <h3>${title}</h3>
        <button class="modal-close" onclick="closeModal()">✕</button>
      </div>
      <div class="modal-body">${bodyHtml}</div>
      ${footHtml ? `<div class="modal-foot">${footHtml}</div>` : ''}
    </div>
  `;
  bg.addEventListener('click', closeModal);
  root.appendChild(bg);
}
window.showModal = showModal;

function closeModal(){
  if (chatUnsub){ chatUnsub(); chatUnsub = null; }
  $('#modalRoot').innerHTML = '';
}
window.closeModal = closeModal;

/* ============================================================
   NET WORTH PERIODIC UPDATE — sıralama doğru olsun diye
   ============================================================ */
setInterval(async () => {
  if (!GZ.uid) return;
  const nw = await calcNetWorth(GZ.uid);
  await dbUpdate(`users/${GZ.uid}`, { netWorth: nw });
}, 30000);

/* ============================================================
   OYUNCU PAZARI — Render
   ============================================================ */
async function renderOyunPazari(){
  const main = $('#appMain');
  let html = `
    <div class="page-title">🏬 Oyuncu Pazarı</div>
    <div class="subtabs">
      <button class="subtab active" onclick="oyunPazariView('all',event)">Tüm İlanlar</button>
      <button class="subtab" onclick="oyunPazariView('mine',event)">İlanlarım</button>
      <button class="subtab" onclick="oyunPazariView('sell',event)">+ Sat</button>
    </div>
    <div id="oyunPazariList"><div class="spinner" style="margin:20px auto"></div></div>
  `;
  main.innerHTML = html;
  oyunPazariView('all');
}
window.renderOyunPazari = renderOyunPazari;

async function oyunPazariView(view, ev){
  if (ev){ $$('.subtab').forEach(b=>b.classList.remove('active')); ev.target.classList.add('active'); }
  const list = $('#oyunPazariList'); if (!list) return;

  if (view === 'sell'){
    // Stoktan satışa koy
    const mainWH = await dbGet(`businesses/${GZ.uid}/mainWarehouse`) || {};
    const stok = Object.entries(mainWH).filter(([k,v])=>v>0);
    if (stok.length === 0){
      list.innerHTML = emptyState('📦','Ana deponda ürün yok','Önce üretim yap, sonra sat');
      return;
    }
    let html = '<div class="section-title">Depodaki Ürünler</div>';
    for (const [k,v] of stok){
      const u = URUNLER[k]; if (!u) continue;
      html += `
        <div class="card">
          <div class="card-row">
            <div class="card-thumb">${u.emo}</div>
            <div class="card-body">
              <div class="card-title">${u.name}</div>
              <div class="card-sub">Stok: ${fmtInt(v)} ${u.unit} • Taban: ${cashFmt(u.base)}</div>
            </div>
            <button class="btn-mini primary" onclick="askListPlayerItem('${k}',${v})">Sat</button>
          </div>
        </div>
      `;
    }
    list.innerHTML = html;
    return;
  }

  if (view === 'mine'){
    const all = await dbGet('playerMarket') || {};
    const mine = Object.values(all).filter(l=>l.sellerUid===GZ.uid);
    if (mine.length === 0){ list.innerHTML = emptyState('🏬','Aktif ilanın yok','Depodaki ürünleri sat'); return; }
    let html = '';
    for (const l of mine){
      const u = URUNLER[l.item]; if (!u) continue;
      html += `
        <div class="card">
          <div class="card-row">
            <div class="card-thumb">${u.emo}</div>
            <div class="card-body">
              <div class="card-title">${u.name} <span class="small muted">${l.isPublic?'🌐 Açık':'🔒 Gizli'}</span></div>
              <div class="card-sub">${cashFmt(l.price)}/${u.unit} • Kalan: ${fmtInt(l.remaining)}/${fmtInt(l.qty)}</div>
              <div class="card-sub green">Satılan: ${fmtInt(l.sold||0)} • Kazanç: ${cashFmt((l.sold||0)*l.price*0.98)}</div>
            </div>
          </div>
          <button class="btn-mini danger mt-12" onclick="cancelPlayerListing('${l.id}').then(()=>oyunPazariView('mine'))">İptal Et</button>
        </div>
      `;
    }
    list.innerHTML = html;
    return;
  }

  // Tüm ilanlar
  const all = await dbGet('playerMarket') || {};
  const pub = Object.values(all).filter(l=>l.isPublic && l.remaining > 0).sort((a,b)=>a.price-b.price);
  if (pub.length === 0){ list.innerHTML = emptyState('🏬','Şu an ilan yok','İlk satıcı sen ol!'); return; }

  // Kategorilere grupla
  const grouped = {};
  for (const l of pub){
    const cat = URUNLER[l.item]?.cat || 'diger';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(l);
  }
  let html = '';
  for (const [cat, items] of Object.entries(grouped)){
    html += `<div class="section-title">${URUN_KATEGORI[cat]||cat.toUpperCase()}</div>`;
    for (const l of items){
      const u = URUNLER[l.item]; if (!u) continue;
      const cheaper = l.price < u.base * 1.2;
      html += `
        <div class="card">
          <div class="card-row">
            <div class="card-thumb">${u.emo}</div>
            <div class="card-body">
              <div class="card-title">${u.name} ${cheaper?'<span class="small green">🔥 Ucuz</span>':''}</div>
              <div class="card-sub">Satıcı: ${escapeHtml(l.sellerName)} • Kalan: ${fmtInt(l.remaining)} ${u.unit}</div>
              <div class="card-sub"><b class="green">${cashFmt(l.price)}</b> / ${u.unit} <span class="muted">(Taban: ${cashFmt(u.base)})</span></div>
            </div>
          </div>
          <button class="btn-primary mt-12" style="width:100%" onclick="askBuyFromMarket('${l.id}')">Satın Al</button>
        </div>
      `;
    }
  }
  list.innerHTML = html;
}
window.oyunPazariView = oyunPazariView;

function askListPlayerItem(itemKey, maxQty){
  const u = URUNLER[itemKey];
  showModal(`${u.emo} ${u.name} Satışa Koy`, `
    <p class="small muted mb-8">Depoda: ${fmtInt(maxQty)} ${u.unit} • Taban: ${cashFmt(u.base)}</p>
    <p class="small red mb-8">⚠️ Komisyon: %2 (platforma gider)</p>
    <div class="input-group">
      <label>Miktar</label>
      <input type="number" id="pmQty" value="${Math.min(50, maxQty)}" min="1" max="${maxQty}">
    </div>
    <div class="input-group">
      <label>Birim Fiyat (₺)</label>
      <input type="number" id="pmPrice" step="0.01" value="${+(u.base*1.3).toFixed(2)}">
    </div>
    <div class="input-group">
      <label>Görünürlük</label>
      <select id="pmPublic">
        <option value="1">🌐 Herkese Açık</option>
        <option value="0">🔒 Gizli (link ile)</option>
      </select>
    </div>
    <button class="btn-primary" onclick="confirmListItem('${itemKey}')">Satışa Çıkar</button>
  `);
}
window.askListPlayerItem = askListPlayerItem;

async function confirmListItem(itemKey){
  const qty = parseInt($('#pmQty').value);
  const price = parseFloat($('#pmPrice').value);
  const isPublic = $('#pmPublic').value === '1';
  closeModal();
  await listPlayerItem(itemKey, qty, price, isPublic);
  oyunPazariView('mine');
}
window.confirmListItem = confirmListItem;

async function askBuyFromMarket(listingId){
  const l = await dbGet(`playerMarket/${listingId}`);
  if (!l) return toast('İlan bulunamadı','error');
  const u = URUNLER[l.item];
  showModal(`${u.emo} Satın Al`, `
    <p class="small muted mb-8">Satıcı: ${escapeHtml(l.sellerName)} • Kalan: ${fmtInt(l.remaining)} ${u.unit}</p>
    <p class="small mb-8">Birim: <b class="green">${cashFmt(l.price)}</b></p>
    <div class="input-group">
      <label>Miktar</label>
      <input type="number" id="pmBuyQty" value="1" min="1" max="${l.remaining}">
    </div>
    <p class="small muted" id="pmBuyTotal">Toplam: ${cashFmt(l.price)}</p>
    <button class="btn-primary" onclick="confirmBuyMarket('${listingId}',${l.price})">Satın Al</button>
  `);
  $('#pmBuyQty').addEventListener('input', e => {
    const t = document.getElementById('pmBuyTotal');
    if (t) t.textContent = `Toplam: ${cashFmt(parseFloat(e.target.value||1)*l.price)}`;
  });
}
window.askBuyFromMarket = askBuyFromMarket;

async function confirmBuyMarket(listingId, price){
  const qty = parseInt($('#pmBuyQty').value);
  closeModal();
  await buyFromPlayerMarket(listingId, qty);
  await updateDailyTask('trade_1', 1);
  renderOyunPazari();
}
window.confirmBuyMarket = confirmBuyMarket;

/* ============================================================
   GÜNLÜK GÖREVLER — Render
   ============================================================ */
async function renderGorevler(){
  const main = $('#appMain');
  const today = new Date().toDateString();
  const taskData = await dbGet(`users/${GZ.uid}/dailyTasks/${today}`) || {};
  const targets = { sell_100:100, harvest_3:3, trade_1:1, chat_5:5, crypto_1:1, login:1 };

  let html = `<div class="page-title">📋 Günlük Görevler</div>
    <p class="small muted mb-12">Her gün sıfırlanır. Görev tamamla, ödül kazan!</p>`;

  for (const task of DAILY_TASKS){
    const td = taskData[task.id] || { count:0, done:false };
    const target = targets[task.id] || 1;
    const pct = Math.min(100, ((td.count||0)/target)*100);
    html += `
      <div class="card ${td.done?'style="border-color:var(--green)"':''}">
        <div class="card-row">
          <div class="card-thumb">${td.done?'✅':'🎯'}</div>
          <div class="card-body">
            <div class="card-title">${task.name} ${td.done?'<span class="small green">TAMAM</span>':''}</div>
            <div class="card-sub">${task.desc}</div>
            <div class="shelf-prog mt-8"><div class="shelf-prog-fill" style="width:${pct}%"></div></div>
            <div class="small muted">${td.count||0} / ${target}</div>
          </div>
          <div class="tac" style="min-width:70px">
            <div class="green bold">${cashFmt(task.reward)}</div>
            <div class="small muted">+${task.xp} XP</div>
          </div>
        </div>
      </div>
    `;
  }
  main.innerHTML = html;
}
window.renderGorevler = renderGorevler;

/* ============================================================
   BAŞARIMLAR — Render
   ============================================================ */
async function renderBasarimlar(){
  const main = $('#appMain');
  const earned = await dbGet(`users/${GZ.uid}/achievements`) || {};
  const total = ACHIEVEMENTS.length;
  const done = Object.keys(earned).length;

  let html = `<div class="page-title">🏅 Başarımlar</div>
    <div class="stats-grid">
      <div class="stat-box"><div class="lbl">Kazanılan</div><div class="val green">${done}</div></div>
      <div class="stat-box"><div class="lbl">Toplam</div><div class="val">${total}</div></div>
      <div class="stat-box"><div class="lbl">Tamamlama</div><div class="val">%${Math.floor(done/total*100)}</div></div>
    </div>`;

  for (const ach of ACHIEVEMENTS){
    const isEarned = !!earned[ach.id];
    html += `
      <div class="card ${isEarned?'':'opacity:.6'}">
        <div class="card-row">
          <div class="card-thumb" style="${isEarned?'':'filter:grayscale(1)'}">${ach.emo}</div>
          <div class="card-body">
            <div class="card-title">${ach.name} ${isEarned?'<span class="small green">✓</span>':''}</div>
            <div class="card-sub">${ach.desc}</div>
            ${isEarned?`<div class="small muted">${new Date(earned[ach.id].ts).toLocaleDateString('tr-TR')}</div>`:''}
          </div>
          <div class="small muted">+${ach.xp} XP</div>
        </div>
      </div>
    `;
  }
  main.innerHTML = html;
}
window.renderBasarimlar = renderBasarimlar;

/* ============================================================
   SES SİSTEMİ — Düzeltilmiş
   ============================================================ */
const SoundManager = (() => {
  const ctx = { ac: null };
  function getCtx(){
    if (!ctx.ac) ctx.ac = new (window.AudioContext || window.webkitAudioContext)();
    return ctx.ac;
  }
  function play(type){
    if (localStorage.getItem('sound') === 'off') return;
    try {
      const ac = getCtx();
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.connect(g); g.connect(ac.destination);
      const configs = {
        success:  { freq:[523,659,784], dur:0.08, vol:0.3, type:'sine' },
        error:    { freq:[400,300],     dur:0.15, vol:0.3, type:'sawtooth' },
        warn:     { freq:[440,440],     dur:0.1,  vol:0.2, type:'triangle' },
        cash:     { freq:[659,784,1047],dur:0.07, vol:0.4, type:'sine' },
        levelup:  { freq:[523,659,784,1047], dur:0.1, vol:0.4, type:'sine' },
        click:    { freq:[600],         dur:0.05, vol:0.15, type:'sine' },
      };
      const c = configs[type] || configs.click;
      o.type = c.type;
      g.gain.setValueAtTime(0, ac.currentTime);
      g.gain.linearRampToValueAtTime(c.vol, ac.currentTime + 0.01);
      let t = ac.currentTime;
      for (let i = 0; i < c.freq.length; i++){
        o.frequency.setValueAtTime(c.freq[i], t);
        t += c.dur;
      }
      g.gain.setValueAtTime(c.vol, t - 0.01);
      g.gain.linearRampToValueAtTime(0, t + 0.05);
      o.start(ac.currentTime);
      o.stop(t + 0.1);
    } catch(e) { /* Sessiz hata */ }
  }
  return { play };
})();
window.SoundManager = SoundManager;

// Toast'a ses entegrasyonu
const _origToast = window.toast;
window.toast = function(msg, type){
  if (typeof _origToast === 'function') _origToast(msg, type);
  if (type === 'success') SoundManager.play('success');
  else if (type === 'error') SoundManager.play('error');
  else if (type === 'warn') SoundManager.play('warn');
};

/* ============================================================
   PAZAR YERİ DETAYLI SİSTEM — Birden fazla pazar seviye kilidi
   ============================================================ */
async function renderPazar(){
  const main = $('#appMain');
  const lv = GZ.data?.level || 1;
  const shops = await dbGet(`businesses/${GZ.uid}/shops`) || {};

  // Pazar seviyeleri
  const pazarSeviyeleri = [
    { lv:1,  name:'Mahalle Pazarı',  emo:'🛒', desc:'Temel ürünler: gıda, meyve, sebze' },
    { lv:5,  name:'İlçe Pazarı',     emo:'🏪', desc:'Süt ürünleri, et, fırın' },
    { lv:10, name:'Şehir Pazarı',    emo:'🏬', desc:'Sanayi ürünleri, tekstil' },
    { lv:20, name:'Bölge Pazarı',    emo:'🏭', desc:'Madenler, kimyasallar' },
    { lv:30, name:'Ulusal Pazar',    emo:'🌍', desc:'Tüm ürünler, özel ihaleler' },
  ];

  let totalRev = 0, totalSold = 0, totalShelves = 0;
  for (const s of Object.values(shops)){
    const shelves = s.shelves || {};
    for (const k of Object.keys(shelves)){
      const sh = shelves[k];
      totalShelves++;
      totalRev += sh.totalRevenue || 0;
      totalSold += sh.totalSold || 0;
    }
  }

  let html = `<div class="page-title">🛒 Pazar Sistemi</div>
    <div class="stats-grid">
      <div class="stat-box"><div class="lbl">Reyon</div><div class="val">${totalShelves}</div></div>
      <div class="stat-box"><div class="lbl">Ciro</div><div class="val green" style="font-size:12px">${cashFmt(totalRev)}</div></div>
      <div class="stat-box"><div class="lbl">Satış</div><div class="val">${fmtInt(totalSold)}</div></div>
      <div class="stat-box"><div class="lbl">Seviye</div><div class="val">Lv ${lv}</div></div>
    </div>
    <div class="section-title">PAZAR KADEMELERİ</div>`;

  for (const p of pazarSeviyeleri){
    const unlocked = lv >= p.lv;
    html += `<div class="card ${unlocked?'':'opacity:.5'}">
      <div class="card-row">
        <div class="card-thumb">${unlocked?p.emo:'🔒'}</div>
        <div class="card-body">
          <div class="card-title">${p.name} ${unlocked?'<span class="small green">✓ Açık</span>':''}</div>
          <div class="card-sub">${p.desc}</div>
          <div class="small muted">Gerekli seviye: Lv ${p.lv}</div>
        </div>
      </div>
    </div>`;
  }

  // Oyuncu pazarına link
  html += `<button class="btn-primary mt-12" style="width:100%" onclick="switchTab('oyunpazari')">🏬 Oyuncu Pazarına Git</button>`;

  html += `<div class="card mt-12">
    <div class="card-title">📊 Pazar Kuralları</div>
    <p class="small muted mt-12">• Pazar her 90 saniyede otomatik döner<br>• Fiyat tabanın 3 katını geçemez<br>• Reyona stok yüklemeden satış olmaz<br>• %2 pazar komisyonu kesilir</p>
  </div>`;
  main.innerHTML = html;
}


/* ╔══════════════════════════════════════════════════════════════════════════╗
   ║                    UI MANAGER — v2.0 RENDER GENİŞLETMESİ                 ║
   ║   Borsa, Emlak, Sigorta, Franchise, Uluslararası, Karaborsa, Tahvil,   ║
   ║   Futures, Hedge, Çalışan, Ar-Ge, Eğitim, Sözleşme, Belediye,           ║
   ║   Tic.Savaş, Düello, Sefer, Prestij, Koleksiyon, TR Harita,             ║
   ║   Avatar, Unvan, Dekorasyon + KURUCU PANELİ                            ║
   ╚══════════════════════════════════════════════════════════════════════════╝ */

/* render() switch'ine yeni case'leri ekle */
const _origRender = window.render;
window.render = function(tab) {
  const main = $('#appMain');
  switch(tab) {
    // ── ANA SEKMELER (explicit) ──
    case 'dukkan':      return typeof renderDukkan==='function' ? renderDukkan() : (main.innerHTML=emptyState('🏪','Dükkanlar',''));
    case 'banka':       return typeof renderBankaSekme==='function' ? renderBankaSekme('hesap') : (main.innerHTML=emptyState('🏦','Banka',''));
    case 'pazar':       return typeof renderPazar==='function' ? renderPazar() : (main.innerHTML=emptyState('🛒','Pazar',''));
    case 'liderlik':    return typeof renderLiderlik==='function' ? renderLiderlik() : (main.innerHTML=emptyState('🏆','Liderlik',''));
    case 'kripto':      return typeof renderKripto==='function' ? renderKripto() : (main.innerHTML=emptyState('🪙','Kripto',''));
    case 'ihracat':     return typeof renderIhracat==='function' ? renderIhracat() : (main.innerHTML=emptyState('🚢','İhracat',''));
    case 'ihale':       return typeof renderIhale==='function' ? renderIhale() : (main.innerHTML=emptyState('⚖️','İhale',''));
    case 'lojistik':    return typeof renderLojistik==='function' ? renderLojistik() : (main.innerHTML=emptyState('🚚','Lojistik',''));
    case 'marka':       return typeof renderMarka==='function' ? renderMarka() : (main.innerHTML=emptyState('🏷️','Markalar',''));
    case 'sehirler':    return typeof renderSehirler==='function' ? renderSehirler() : (main.innerHTML=emptyState('🏙️','Şehirler',''));
    case 'haberler':    return typeof renderHaberler==='function' ? renderHaberler() : (main.innerHTML=emptyState('📰','Haberler',''));
    case 'magaza':      return typeof renderMagaza==='function' ? renderMagaza() : (main.innerHTML=emptyState('💎','Mağaza',''));
    case 'minioyun':    return typeof renderOyunlar==='function' ? renderOyunlar() : (main.innerHTML=emptyState('🎮','Mini Oyunlar',''));
    case 'gorevler':    return typeof renderGorevler==='function' ? renderGorevler() : (main.innerHTML=emptyState('📋','Görevler',''));
    case 'basarimlar':  return typeof renderBasarimlar==='function' ? renderBasarimlar() : (main.innerHTML=emptyState('🏅','Başarımlar',''));
    case 'bahce':       return renderProduction('gardens',   'Bahçeler',   '🌱', ['domates','patates','sogan','elma','uzum','kiraz','kayisi','findik','zeytin']);
    case 'ciftlik':     return renderProduction('farms',     'Çiftlikler', '🐄', ['inek_sutu','keci_sutu','tavuk_yumurtasi','hindi_yumurtasi','kaz_yumurtasi','tavuk_eti','dana_eti','kuzu_eti','yun']);
    case 'fabrika':     return renderProduction('factories', 'Fabrikalar', '🏭', ['ekmek','pasta','dondurma','beyaz_peynir','kasar_peyniri','suzme_bal','petek_bal','polen','kimyasal_cozucu','cimento','keten_kumas','eldiven','siyah_cay','yesil_cay','bugday_unu','misir_unu','seker','ayicicek_yagi','zeytinyagi','findik_yagi']);
    case 'maden':       return renderProduction('mines',     'Madenler',   '⛏️', ['altin','gumus','bakir','demir','kromit'], 30);
    case 'oyuncupazar': return typeof renderOyuncuPazar==='function' ? renderOyuncuPazar() : (main.innerHTML=emptyState('🤝','Oyuncu Pazarı',''));
    // ── BORSA ──
    case 'borsa':       return renderBorsa();
    case 'emlak':       return renderEmlak();
    case 'sigorta':     return renderSigorta();
    case 'franchise':   return renderFranchise();
    case 'uluslararasi':return renderUluslararasi();
    case 'karaborsa':   return typeof renderKaraborsa==='function' ? renderKaraborsa() : (main.innerHTML=emptyState('🕶️','Kara Borsa','Yükleniyor...'));
    case 'tahvil':      return renderTahvil();
    case 'futures':     return renderFutures();
    case 'hedgefon':    return renderHedgeFon();
    case 'calisan':     return renderCalisan();
    case 'arge':        return renderArge();
    case 'egitim':      return renderEgitim();
    case 'sozlesme':    return renderSozlesme();
    case 'belediye':    return renderBelediye();
    case 'ticsavas':    return renderTicsavas();
    case 'duello':      return renderDuello();
    case 'avatar':      return renderAvatar();
    case 'unvan':       return renderUnvan();
    case 'dekorasyon':  return renderDekorasyon();
    case 'sefer':       return renderSefer();
    case 'prestij':     return renderPrestij();
    case 'koleksiyon':  return renderKoleksiyon();
    case 'harita':      return renderHarita();
    case 'muhtarlik':   return typeof renderVergiOyuncu==='function' ? renderVergiOyuncu() : (main.innerHTML=emptyState('🏛️','Devlet & Kamu',''));
    case 'sgk':         return typeof renderSGK==='function' ? renderSGK() : (main.innerHTML=emptyState('🏥','SGK',''));
    case 'vergidairesi':return typeof renderVergiOyuncu==='function' ? renderVergiOyuncu() : (main.innerHTML=emptyState('🏛️','Vergi Dairesi',''));
    case 'krediofisi':  return typeof renderKredi==='function' ? renderKredi() : (main.innerHTML=emptyState('💳','Kredi Ofisi',''));
    case 'konkurato':   return typeof renderKonkurato==='function' ? renderKonkurato() : (main.innerHTML=emptyState('📋','Borç Yapılandırma',''));
    case 'secim':       return typeof renderSecim==='function' ? renderSecim() : (main.innerHTML=emptyState('🗳️','Seçim',''));
    case 'emniyet':     return typeof renderPolis==='function' ? renderPolis() : (main.innerHTML=emptyState('👮','Emniyet',''));
    case 'askeriye':    return typeof renderAskeriye==='function' ? renderAskeriye() : (main.innerHTML=emptyState('⚔️','Askeriye',''));
    case 'mahkeme':     return typeof renderMahkeme==='function' ? renderMahkeme() : (main.innerHTML=emptyState('⚖️','Mahkeme',''));
    case 'noter':       return typeof renderNoter==='function' ? renderNoter() : (main.innerHTML=emptyState('📋','Noterlik',''));
    case 'polis':       return typeof renderPolis==='function' ? renderPolis() : (main.innerHTML=emptyState('🚔','Polis',''));
    case 'jandarma':    return typeof renderJandarma==='function' ? renderJandarma() : (main.innerHTML=emptyState('🪖','Jandarma',''));
    case 'itfaiye':     return typeof renderItfaiye==='function' ? renderItfaiye() : (main.innerHTML=emptyState('🚒','İtfaiye',''));
    case 'sahilguz':    return typeof renderSahilguz==='function' ? renderSahilguz() : (main.innerHTML=emptyState('⛵','Sahil Güvenlik',''));
    case 'cuzdan':      return typeof renderCuzdan==='function' ? renderCuzdan() : (main.innerHTML=emptyState('👛','Dijital Cüzdan',''));
    default:            return _origRender ? _origRender(tab) : null;
  }
};

/* ─── Yardımcı kart şablonu ─── */
function _v2Card(title, body, footer) {
  return `<div class="v2-card">
    <div class="v2-card-head"><h3>${title}</h3></div>
    <div class="v2-card-body">${body}</div>
    ${footer ? `<div class="v2-card-foot">${footer}</div>` : ''}
  </div>`;
}

/* ============================================================
   📊 BORSA RENDER
   ============================================================ */
async function renderBorsa() {
  const main = $('#appMain');
  main.innerHTML = `<div class="page-head"><h2>📊 Borsa İstanbul (Sanal)</h2><p class="muted">Hisse senedi al-sat, temettü kazan, IPO yap.</p></div>
    <div class="v2-toolbar">
      <button class="btn-secondary" onclick="renderBorsaIPO()">🚀 Kendi Şirketini Halka Aç (IPO)</button>
      <button class="btn-secondary" onclick="renderBorsaPortfoy()">💼 Portföyüm</button>
    </div>
    <div id="borsaList" class="stocks-grid"></div>`;

  const list = $('#borsaList');
  let html = '';
  for (const s of STOCKS_DATA) {
    const price = await dbGet('stocks/prices/' + s.sym + '/current') || s.basePrice;
    const change = await dbGet('stocks/prices/' + s.sym + '/changePct') || 0;
    const cls = change > 0 ? 'up' : change < 0 ? 'down' : '';
    html += `<div class="stock-card ${cls}">
      <div class="sc-head">
        <span class="sc-sym">${s.sym}</span>
        <span class="sc-sector">${STOCK_SECTORS[s.sector]||s.sector}</span>
      </div>
      <div class="sc-name">${s.name}</div>
      <div class="sc-price">₺${price.toFixed(2)}</div>
      <div class="sc-change ${cls}">${change>0?'▲':change<0?'▼':'■'} ${change.toFixed(2)}%</div>
      <div class="sc-actions">
        <button class="btn-mini buy" onclick="borsaTradeModal('${s.sym}','buy')">AL</button>
        <button class="btn-mini sell" onclick="borsaTradeModal('${s.sym}','sell')">SAT</button>
      </div>
      <div class="sc-meta">Temettü: %${(s.divRate*100).toFixed(1)}/yıl</div>
    </div>`;
  }
  list.innerHTML = html;
}
window.renderBorsa = renderBorsa;

window.borsaTradeModal = async function(sym, action) {
  const stock = STOCKS_DATA.find(s => s.sym === sym);
  const price = await dbGet('stocks/prices/' + sym + '/current') || stock.basePrice;
  const owned = await dbGet('stocks/holdings/' + GZ.uid + '/' + sym) || { qty:0, avgPrice:0 };
  const myMoney = GZ.data?.money || 0;

  // Max alabileceği lot
  const maxBuyQty = Math.floor(myMoney / (price * 1.002));
  // Max satabileceği lot
  const maxSellQty = owned.qty || 0;
  const maxQty = action === 'buy' ? maxBuyQty : maxSellQty;
  const maxLabel = action === 'buy' ? `Alabileceğin: ${maxBuyQty} adet` : `Sahip: ${maxSellQty} adet`;

  showModal(`${action==='buy'?'📈 Al':'📉 Sat'} — ${sym}`, `
    <div class="trade-info">
      <div><b>Şirket:</b> ${stock.name}</div>
      <div><b>Anlık Fiyat:</b> ₺${price.toFixed(2)}</div>
      <div><b>Sahip Olunan:</b> ${owned.qty || 0} adet (Ort: ₺${owned.avgPrice?.toFixed(2)||'0'})</div>
      <div><b style="color:var(--primary)">${maxLabel}</b></div>
    </div>
    <input type="number" id="trdQty" placeholder="Adet" min="1">
    <div class="quick-amount-row">
      <button class="btn-quick" onclick="borsaQuickFill(${maxQty},0.25)">%25</button>
      <button class="btn-quick" onclick="borsaQuickFill(${maxQty},0.50)">%50</button>
      <button class="btn-quick" onclick="borsaQuickFill(${maxQty},0.75)">%75</button>
      <button class="btn-quick btn-quick-max ${action==='sell'?'btn-quick-sell':''}" onclick="borsaQuickFill(${maxQty},1.0)">${action==='sell'?'💸 TÜMÜNÜ SAT':'💰 MAX'}</button>
    </div>
    <div id="trdSummary" class="trade-summary"></div>
    <button class="btn-primary" onclick="borsaExecute('${sym}','${action}')" style="margin-top:10px">${action==='buy'?'Satın Al':'Sat'}</button>
  `);
  setTimeout(() => {
    const inp = document.getElementById('trdQty');
    if (!inp) return;
    const updateSummary = () => {
      const q = parseInt(inp.value) || 0;
      const total = q * price;
      const com = total * 0.002;
      const sumEl = document.getElementById('trdSummary');
      if (sumEl) sumEl.innerHTML = `
        Tutar: ₺${total.toFixed(2)}<br>
        Komisyon (%0.2): ₺${com.toFixed(2)}<br>
        <b>Toplam: ₺${(action==='buy'? total+com : total-com).toFixed(2)}</b>`;
    };
    inp.addEventListener('input', updateSummary);
    inp._updateSummary = updateSummary;
  }, 100);
};

window.borsaQuickFill = function(maxQty, ratio) {
  const inp = document.getElementById('trdQty');
  if (!inp) return;
  const v = Math.floor(maxQty * ratio);
  inp.value = v;
  if (inp._updateSummary) inp._updateSummary();
  if (ratio === 1.0) toast(`📊 ${v} adet`, 'info', 2000);
};

window.borsaExecute = async function(sym, action) {
  const qty = parseInt(document.getElementById('trdQty').value) || 0;
  if (qty <= 0) return toast('Geçerli adet girin', 'error');
  const result = action === 'buy' ? await buyStock(sym, qty) : await sellStock(sym, qty);
  if (result.ok) { toast(result.msg, 'success'); closeModal(); renderBorsa(); }
  else toast(result.msg, 'error');
};

window.renderBorsaPortfoy = async function() {
  const holdings = await dbGet('stocks/holdings/' + GZ.uid) || {};
  let html = '<h3>💼 Hisse Portföyüm</h3>';
  if (!Object.keys(holdings).length) html += '<p class="muted">Henüz hisseniz yok.</p>';
  else {
    html += '<div class="portfoy-list">';
    for (const sym of Object.keys(holdings)) {
      const h = holdings[sym];
      const stock = STOCKS_DATA.find(s => s.sym === sym);
      const price = await dbGet('stocks/prices/' + sym + '/current') || stock.basePrice;
      const value = price * h.qty;
      const profit = value - h.totalCost;
      html += `<div class="portfoy-row">
        <b>${sym}</b> ${h.qty} adet × ₺${price.toFixed(2)} = ₺${value.toFixed(2)}
        <span style="color:${profit>=0?'#16a34a':'#dc2626'}">${profit>=0?'+':''}${profit.toFixed(2)}</span>
      </div>`;
    }
    html += '</div>';
  }
  showModal('💼 Portföyüm', html);
};

window.renderBorsaIPO = async function() {
  showModal('🚀 IPO — Şirketini Halka Aç', `
    <p class="muted">Min. Lv 25 + ₺500K servet · Listeleme ücreti: hisse×fiyat×%5</p>
    <input type="text" id="ipoCompany" placeholder="Şirket adı (ör: GZ Tekstil A.Ş.)">
    <input type="number" id="ipoShares" placeholder="Toplam hisse (1000-1.000.000)">
    <input type="number" id="ipoPrice" placeholder="Hisse fiyatı (₺1-1000)">
    <button class="btn-primary" onclick="executeIPO()">Halka Aç</button>
  `);
};
window.executeIPO = async function() {
  const c = document.getElementById('ipoCompany').value.trim();
  const s = parseInt(document.getElementById('ipoShares').value);
  const p = parseFloat(document.getElementById('ipoPrice').value);
  if (!c) return toast('Şirket adı gerekli', 'error');
  const r = await createIPO(c, s, p);
  if (r.ok) { toast(`✅ IPO açıldı: ${r.sym}`, 'success'); closeModal(); }
  else toast(r.msg, 'error');
};

/* ============================================================
   🏘️ EMLAK RENDER
   ============================================================ */
async function renderEmlak() {
  const main = $('#appMain');
  main.innerHTML = `<div class="page-head"><h2>🏘️ Emlak Pazarı</h2><p class="muted">Arsa al, bina yap, kira topla, değer kazansın.</p></div>
    <div class="v2-toolbar">
      <button class="btn-secondary" onclick="renderEmlakOwned()">🏠 Emlaklarım</button>
    </div>
    <div class="emlak-grid" id="emlakGrid"></div>`;

  let html = '';
  for (const t of EMLAK_TIPLERI) {
    html += `<div class="emlak-card">
      <div class="ec-emo">${t.emo}</div>
      <div class="ec-name">${t.name}</div>
      <div class="ec-price">₺${t.basePrice.toLocaleString('tr-TR')}+</div>
      <div class="ec-desc">${t.desc}</div>
      <div class="ec-meta">${t.rentMax > 0 ? `Kira: ₺${t.rentMin}-${t.rentMax}/ay` : 'Kira: yok (arsa)'}</div>
      <button class="btn-mini buy" onclick="emlakBuyModal('${t.type}')">SATIN AL</button>
    </div>`;
  }
  $('#emlakGrid').innerHTML = html;
}
window.renderEmlak = renderEmlak;

window.emlakBuyModal = function(typeId) {
  const cities = (window.ILLER || []).slice(0, 30);
  showModal('🏘️ Emlak Satın Al', `
    <p class="muted">Şehir seç (İstanbul/Ankara/İzmir daha pahalı):</p>
    <select id="emlakCity">${cities.map(c => `<option>${c}</option>`).join('')}</select>
    <button class="btn-primary" onclick="emlakBuyExec('${typeId}')">Satın Al</button>
  `);
};

window.emlakBuyExec = async function(typeId) {
  const city = document.getElementById('emlakCity').value;
  const r = await buyProperty(typeId, city);
  if (r.ok) { toast(`✅ ${city}'da emlak alındı! ₺${r.price.toLocaleString('tr-TR')}`, 'success'); closeModal(); }
  else toast(r.msg, 'error');
};

window.renderEmlakOwned = async function() {
  const owned = await dbGet('realestate/owned/' + GZ.uid) || {};
  let html = '<h3>🏠 Emlak Portföyüm</h3>';
  if (!Object.keys(owned).length) html += '<p class="muted">Emlağınız yok.</p>';
  else {
    for (const k of Object.keys(owned)) {
      const p = owned[k];
      const t = EMLAK_TIPLERI.find(x => x.type === p.type);
      html += `<div class="owned-prop">
        <b>${t.emo} ${t.name}</b> · ${p.city}<br>
        <small>Değer: ₺${p.currentValue?.toLocaleString('tr-TR')} · ${p.rented ? `Kiracı: ${p.tenantName} (₺${p.monthlyRent}/ay)` : 'Boş'}</small><br>
        ${!p.rented && p.rentMax > 0 ? `<button class="btn-mini" onclick="findTenantUI('${k}')">Kiracı Bul</button>` : ''}
        <button class="btn-mini sell" onclick="sellPropertyUI('${k}')">Sat</button>
      </div>`;
    }
  }
  showModal('🏠 Emlaklarım', html);
};
window.findTenantUI = async function(k) {
  const r = await findTenant(k);
  if (r.ok) toast(`✅ Kiracı bulundu: ${r.tenant} · ₺${r.rent}/ay`, 'success');
  else toast(r.msg, 'error');
  renderEmlakOwned();
};
window.sellPropertyUI = async function(k) {
  if (!confirm('Bu emlağı %95 değerinde satmak istediğine emin misin?')) return;
  const r = await sellProperty(k);
  if (r.ok) { toast(`✅ Satıldı: ₺${r.sellPrice.toLocaleString('tr-TR')}`, 'success'); renderEmlakOwned(); }
  else toast(r.msg, 'error');
};

/* ============================================================
   🛡️ SİGORTA RENDER
   ============================================================ */
function renderSigorta() {
  const main = $('#appMain');
  let html = `<div class="page-head"><h2>🛡️ Sigorta Şirketi</h2><p class="muted">Tesislerini, ürünlerini, araçlarını sigortala. Afet halinde tazminat al.</p></div>
    <div class="sigorta-grid">`;
  for (const k of Object.keys(INSURANCE_TYPES)) {
    const c = INSURANCE_TYPES[k];
    html += `<div class="ins-card">
      <h3>${c.name}</h3>
      <div class="muted">Riskler: ${c.risks.join(', ')}</div>
      <div class="ins-tiers">
        ${c.coverPct.map((cv, i) => `
          <button class="btn-mini" onclick="sigortaBuyModal('${k}', ${i})">
            Kademe ${i+1} (Teminat %${cv*100}, Prim %${(c.premiumPct[i]*100).toFixed(2)}/ay)
          </button>
        `).join('')}
      </div>
    </div>`;
  }
  html += '</div><div style="margin-top:20px"><button class="btn-secondary" onclick="renderSigortaPolicies()">📋 Poliçelerim</button></div>';
  main.innerHTML = html;
}
window.renderSigorta = renderSigorta;

window.sigortaBuyModal = function(typeKey, tier) {
  showModal('🛡️ Sigorta Satın Al', `
    <p class="muted">Sigorta yapılacak varlığın değerini gir:</p>
    <input type="number" id="insAsset" placeholder="Varlık değeri (₺)">
    <button class="btn-primary" onclick="sigortaBuyExec('${typeKey}',${tier})">Poliçe Oluştur</button>
  `);
};
window.sigortaBuyExec = async function(typeKey, tier) {
  const v = parseFloat(document.getElementById('insAsset').value) || 0;
  const r = await buyInsurance(typeKey, tier, v);
  if (r.ok) { toast('✅ Poliçe oluşturuldu!', 'success'); closeModal(); }
  else toast(r.msg, 'error');
};
window.renderSigortaPolicies = async function() {
  const ps = await dbGet('insurance/policies/' + GZ.uid) || {};
  let html = '<h3>📋 Aktif Poliçelerim</h3>';
  if (!Object.keys(ps).length) html += '<p class="muted">Poliçeniz yok.</p>';
  else for (const k of Object.keys(ps)) {
    const p = ps[k];
    html += `<div class="policy-row">
      <b>${p.type}</b> · Teminat: ₺${p.coverage?.toLocaleString('tr-TR')}<br>
      <small>Prim: ₺${p.premium}/ay · ${p.claims||0} hasar talebi</small>
    </div>`;
  }
  showModal('📋 Poliçelerim', html);
};

/* ============================================================
   🪧 FRANCHISE RENDER
   ============================================================ */
async function renderFranchise() {
  const main = $('#appMain');
  const offers = await dbGet('franchise/offers') || {};
  let html = `<div class="page-head"><h2>🪧 Franchise Pazarı</h2><p class="muted">Hazır markalar al, kendi markanı ver. Royalty kazan.</p></div>
    <div class="v2-toolbar">
      <button class="btn-secondary" onclick="franchiseCreateModal()">🆕 Kendi Franchise'ını Aç</button>
      <button class="btn-secondary" onclick="renderMyFranchises()">🪪 Sahip Olduklarım</button>
    </div>
    <div class="franchise-list">`;
  for (const k of Object.keys(offers)) {
    const o = offers[k];
    if (o.status !== 'open' || o.ownerUid === GZ.uid) continue;
    html += `<div class="franchise-card">
      <h3>${o.brandName}</h3>
      <div class="muted">Sahip: ${o.ownerName}</div>
      <div>Royalty: %${o.royaltyPct} · Başlangıç: ₺${o.initialFee?.toLocaleString('tr-TR')}</div>
      <div class="muted">Aktif şube: ${o.activeFranchisees||0}</div>
      <button class="btn-mini buy" onclick="franchiseBuy('${k}')">Satın Al</button>
    </div>`;
  }
  html += '</div>';
  main.innerHTML = html;
}
window.renderFranchise = renderFranchise;

window.franchiseCreateModal = function() {
  showModal('🆕 Franchise Oluştur', `
    <input type="text" id="frBrand" placeholder="Marka adı">
    <input type="number" id="frRoyalty" placeholder="Royalty % (5-30)" min="5" max="30">
    <input type="number" id="frFee" placeholder="Başlangıç ücreti (min ₺10K)">
    <input type="text" id="frProduct" placeholder="Ürün tipi (kahve, kıyafet, vb)">
    <button class="btn-primary" onclick="franchiseCreateExec()">Oluştur</button>
  `);
};
window.franchiseCreateExec = async function() {
  const r = await createFranchiseOffer(
    $('#frBrand').value.trim(),
    parseFloat($('#frRoyalty').value),
    parseFloat($('#frFee').value),
    $('#frProduct').value.trim()
  );
  if (r.ok) { toast('✅ Franchise oluşturuldu!', 'success'); closeModal(); renderFranchise(); }
  else toast(r.msg, 'error');
};
window.franchiseBuy = async function(k) {
  const r = await buyFranchise(k);
  if (r.ok) { toast('✅ Franchise alındı!', 'success'); renderFranchise(); }
  else toast(r.msg, 'error');
};
window.renderMyFranchises = async function() {
  const all = await dbGet('franchise/active') || {};
  const mine = Object.values(all).filter(f => f.franchiseeUid === GZ.uid);
  let html = '<h3>🪪 Sahip Olduğum Franchise\'lar</h3>';
  if (!mine.length) html = '<p class="muted">Franchise yok.</p>';
  else for (const f of mine) {
    html += `<div class="my-fr"><b>${f.brandName}</b> · Royalty: %${f.royaltyPct} · Sahibi: ${f.offerOwnerName}</div>`;
  }
  showModal('🪪 Franchise\'larım', html);
};

/* ============================================================
   🌍 ULUSLARARASI TİCARET RENDER
   ============================================================ */
function renderUluslararasi() {
  const main = $('#appMain');
  let html = `<div class="page-head"><h2>🌍 Uluslararası Ticaret</h2><p class="muted">10 ülkeye ihracat yap. Mesafe = teslim süresi. Gümrük vergisi %4-12.</p></div>
    <div class="countries-grid">`;
  for (const c of COUNTRIES) {
    html += `<div class="country-card">
      <div class="cc-flag">${c.flag}</div>
      <h3>${c.name}</h3>
      <div class="muted">${c.currency} · 1 USD = ${(1/c.rateUsd).toFixed(2)} ${c.currency}</div>
      <div>Talep: ×${c.demandMult.toFixed(1)} · Gümrük: %${(c.tariff*100).toFixed(0)}</div>
      <div class="muted">Mesafe: ${c.distance} km · Teslim: ~${Math.ceil(c.distance/800)} gün</div>
      <button class="btn-mini buy" onclick="intlExportModal('${c.code}')">İhracat Yap</button>
    </div>`;
  }
  html += '</div><div style="margin-top:16px"><button class="btn-secondary" onclick="renderIntlShipments()">📦 Sevkiyatlarım</button></div>';
  main.innerHTML = html;
}
window.renderUluslararasi = renderUluslararasi;

window.intlExportModal = function(code) {
  const products = Object.keys(URUNLER).slice(0, 30);
  showModal('🌍 İhracat Yap', `
    <select id="intlProd">${products.map(p => `<option value="${p}">${URUNLER[p].emo} ${URUNLER[p].name}</option>`).join('')}</select>
    <input type="number" id="intlQty" placeholder="Adet">
    <button class="btn-primary" onclick="intlExportExec('${code}')">Gönder</button>
  `);
};
window.intlExportExec = async function(code) {
  const p = $('#intlProd').value;
  const q = parseInt($('#intlQty').value) || 0;
  const r = await exportInternational(code, p, q);
  if (r.ok) { toast(`✅ Sevk edildi! Net: ₺${r.netRevenue.toLocaleString('tr-TR')} (${r.days} gün)`, 'success'); closeModal(); }
  else toast(r.msg, 'error');
};
window.renderIntlShipments = async function() {
  const ships = await dbGet('intl_trade/shipments/' + GZ.uid) || {};
  let html = '<h3>📦 Sevkiyatlarım</h3>';
  for (const k of Object.keys(ships)) {
    const s = ships[k];
    const remaining = Math.max(0, s.arrivesAt - Date.now());
    const days = Math.ceil(remaining / (24*3600*1000));
    html += `<div class="ship-row"><b>${s.countryName}</b> ${s.product}×${s.qty} · ${s.status==='in_transit'?`${days} gün kaldı`:'✅ Teslim Edildi'} · ₺${s.netRevenue?.toLocaleString('tr-TR')}</div>`;
  }
  showModal('📦 Sevkiyatlarım', html || '<p class="muted">Yok</p>');
};

/* ============================================================
   🕶️ KARABORSA RENDER (oyun özelliği - illegal değil)
   ============================================================ */
function renderKaraborsa() {
  const main = $('#appMain');
  let html = `<div class="page-head"><h2>🕶️ Karaborsa</h2><p class="muted">⚠️ Yüksek risk, yüksek kazanç. Yakalanırsan ceza! Min Lv 15.</p></div>
    <div class="bm-grid">`;
  for (const it of BLACKMARKET_ITEMS) {
    html += `<div class="bm-card">
      <div class="bm-emo">${it.emo}</div>
      <h3>${it.name}</h3>
      <div>Alış: ₺${it.priceMin}-${it.priceMax}</div>
      <div class="risk-bar">Risk: ${'⚠️'.repeat(Math.ceil(it.risk*5))}</div>
      <div>Kar potansiyeli: ×${it.profit}</div>
      <button class="btn-mini buy" onclick="bmBuyModal('${it.code}')">AL</button>
      <button class="btn-mini sell" onclick="bmSellModal('${it.code}')">SAT</button>
    </div>`;
  }
  html += '</div>';
  main.innerHTML = html;
}
window.renderKaraborsa = renderKaraborsa;
window.bmBuyModal = function(c) {
  showModal('🕶️ Karaborsa Alış', `<input type="number" id="bmQ" placeholder="Adet"><button class="btn-primary" onclick="bmBuyExec('${c}')">Risk Al</button>`);
};
window.bmBuyExec = async function(c) {
  const q = parseInt($('#bmQ').value) || 0;
  const r = await blackmarketBuy(c, q);
  toast(r.msg || (r.ok ? 'Alındı' : 'Hata'), r.ok ? 'success' : 'error');
  if (r.ok) closeModal();
};
window.bmSellModal = function(c) {
  showModal('🕶️ Karaborsa Satış', `<input type="number" id="bmQ" placeholder="Adet"><button class="btn-primary" onclick="bmSellExec('${c}')">Risk Al</button>`);
};
window.bmSellExec = async function(c) {
  const q = parseInt($('#bmQ').value) || 0;
  const r = await blackmarketSell(c, q);
  toast(r.msg || (r.ok ? `Satıldı: ₺${r.total?.toFixed(0)}` : 'Hata'), r.ok ? 'success' : 'error');
  if (r.ok) closeModal();
};

/* ============================================================
   📜 TAHVİL RENDER
   ============================================================ */
function renderTahvil() {
  const main = $('#appMain');
  let html = `<div class="page-head"><h2>📜 Tahvil Piyasası</h2><p class="muted">Sabit getirili yatırım. 3 ayda bir kupon, vadede anapara.</p></div>
    <div class="bonds-grid">`;
  for (const b of BONDS) {
    html += `<div class="bond-card">
      <div class="bc-head"><span>${b.emo}</span><h3>${b.name}</h3></div>
      <div>Nominal: ₺${b.face.toLocaleString('tr-TR')}</div>
      <div>Yıllık Getiri: %${(b.yieldRate*100).toFixed(1)}</div>
      <div>Vade: ${Math.floor(b.term/365)} yıl</div>
      <div>İhraç: ${b.issuer}</div>
      <div class="risk">Risk: ${'⚠️'.repeat(b.riskLevel)}</div>
      <button class="btn-mini buy" onclick="bondBuyModal('${b.code}')">Satın Al</button>
    </div>`;
  }
  html += '</div>';
  main.innerHTML = html;
}
window.renderTahvil = renderTahvil;
window.bondBuyModal = function(c) {
  showModal('📜 Tahvil Al', `<input type="number" id="bndQ" placeholder="Adet"><button class="btn-primary" onclick="bondBuyExec('${c}')">Al</button>`);
};
window.bondBuyExec = async function(c) {
  const q = parseInt($('#bndQ').value) || 0;
  const r = await buyBond(c, q);
  if (r.ok) { toast(`✅ Alındı! ₺${r.cost.toLocaleString('tr-TR')}`, 'success'); closeModal(); }
  else toast(r.msg, 'error');
};

/* ============================================================
   📉 FUTURES RENDER
   ============================================================ */
async function renderFutures() {
  const main = $('#appMain');
  let html = `<div class="page-head"><h2>📉 Vadeli İşlemler (Futures)</h2><p class="muted">Kaldıraçlı al/sat. ⚠️ Liquidation riski!</p></div>
    <div class="futures-grid">`;
  for (const s of STOCKS_DATA.slice(0, 10)) {
    const price = await dbGet('stocks/prices/' + s.sym + '/current') || s.basePrice;
    html += `<div class="fut-card">
      <h3>${s.sym}</h3>
      <div>₺${price.toFixed(2)}</div>
      <button class="btn-mini buy" onclick="futOpenModal('${s.sym}','long')">📈 LONG</button>
      <button class="btn-mini sell" onclick="futOpenModal('${s.sym}','short')">📉 SHORT</button>
    </div>`;
  }
  html += '</div><div style="margin-top:16px"><button class="btn-secondary" onclick="renderFutPositions()">📊 Açık Pozisyonlarım</button></div>';
  main.innerHTML = html;
}
window.renderFutures = renderFutures;
window.futOpenModal = function(sym, dir) {
  showModal(`📊 Pozisyon Aç (${dir.toUpperCase()})`, `
    <input type="number" id="futLot" placeholder="Lot büyüklüğü">
    <select id="futLev"><option value="1">1x</option><option value="2">2x</option><option value="5">5x</option><option value="10">10x</option></select>
    <button class="btn-primary" onclick="futOpenExec('${sym}','${dir}')">Aç</button>
  `);
};
window.futOpenExec = async function(sym, dir) {
  const lot = parseInt($('#futLot').value) || 0;
  const lev = parseInt($('#futLev').value) || 1;
  const r = await openFuturesPosition(sym, dir, lot, lev);
  if (r.ok) { toast('✅ Pozisyon açıldı', 'success'); closeModal(); }
  else toast(r.msg, 'error');
};
window.renderFutPositions = async function() {
  const ps = await dbGet('futures/positions/' + GZ.uid) || {};
  let html = '<h3>📊 Pozisyonlarım</h3>';
  for (const k of Object.keys(ps)) {
    const p = ps[k];
    if (p.status !== 'open') continue;
    const cur = await dbGet('stocks/prices/' + p.symbol + '/current') || p.entryPrice;
    const diff = p.direction === 'long' ? (cur - p.entryPrice) : (p.entryPrice - cur);
    const pnl = diff * p.lotSize * p.leverage;
    html += `<div class="pos-row">
      <b>${p.symbol}</b> ${p.direction.toUpperCase()} ${p.leverage}x · 
      Giriş: ₺${p.entryPrice.toFixed(2)} · Şu an: ₺${cur.toFixed(2)} · 
      <span style="color:${pnl>=0?'#16a34a':'#dc2626'}">PnL: ₺${pnl.toFixed(2)}</span>
      <button class="btn-mini" onclick="futClose('${k}')">Kapat</button>
    </div>`;
  }
  showModal('📊 Pozisyonlarım', html);
};
window.futClose = async function(k) {
  const r = await closeFuturesPosition(k);
  if (r.liquidated) toast(`💥 LIQUIDATED! Kayıp: ₺${Math.abs(r.pnl).toFixed(2)}`, 'error');
  else if (r.ok) toast(`✅ Kapatıldı! PnL: ₺${r.pnl.toFixed(2)}`, 'success');
  else toast(r.msg, 'error');
  renderFutPositions();
};

/* ============================================================
   💹 HEDGE FON RENDER
   ============================================================ */
async function renderHedgeFon() {
  const main = $('#appMain');
  const funds = await dbGet('hedgefunds/list') || {};
  let html = `<div class="page-head"><h2>💹 Hedge Fonları</h2><p class="muted">Profesyonel yöneticilerin fonlarına yatırım yap. Min Lv 35 ile fon kur.</p></div>
    <button class="btn-secondary" onclick="hfCreateModal()">🆕 Hedge Fon Kur</button>
    <div class="funds-list">`;
  for (const k of Object.keys(funds)) {
    const f = funds[k];
    html += `<div class="fund-card">
      <h3>${f.fundName}</h3>
      <div>Yönetici: ${f.managerName}</div>
      <div>NAV: ₺${f.nav?.toFixed(4)} · AUM: ₺${(f.aum||0).toLocaleString('tr-TR')}</div>
      <div>Yönetim: %${(f.mgmtFee*100).toFixed(2)} · Performans: %${(f.perfFee*100).toFixed(0)}</div>
      <div>Yatırımcı: ${f.investorCount||0} · Min: ₺${f.minInvest?.toLocaleString('tr-TR')}</div>
      <button class="btn-mini buy" onclick="hfInvestModal('${k}',${f.minInvest||10000})">Yatırım Yap</button>
    </div>`;
  }
  html += '</div>';
  main.innerHTML = html;
}
window.renderHedgeFon = renderHedgeFon;
window.hfCreateModal = function() {
  showModal('🆕 Hedge Fon Kur', `
    <input type="text" id="hfName" placeholder="Fon adı">
    <input type="number" id="hfMgmt" placeholder="Yönetim ücreti (0.005-0.05)" step="0.005">
    <input type="number" id="hfPerf" placeholder="Performans ücreti (0.05-0.30)" step="0.01">
    <input type="number" id="hfMin" placeholder="Min yatırım (₺)">
    <button class="btn-primary" onclick="hfCreateExec()">Kur</button>
  `);
};
window.hfCreateExec = async function() {
  const r = await createHedgeFund($('#hfName').value, parseFloat($('#hfMgmt').value), parseFloat($('#hfPerf').value), parseFloat($('#hfMin').value), 'balanced');
  if (r.ok) { toast('✅ Fon kuruldu', 'success'); closeModal(); renderHedgeFon(); }
  else toast(r.msg, 'error');
};
window.hfInvestModal = function(k, min) {
  showModal('💹 Yatırım Yap', `<input type="number" id="hfAmt" placeholder="Tutar (min ₺${min})"><button class="btn-primary" onclick="hfInvestExec('${k}')">Yatır</button>`);
};
window.hfInvestExec = async function(k) {
  const a = parseFloat($('#hfAmt').value) || 0;
  const r = await investInHedgeFund(k, a);
  if (r.ok) { toast(`✅ ${r.shares.toFixed(4)} pay alındı`, 'success'); closeModal(); }
  else toast(r.msg, 'error');
};

/* ============================================================
   👷 ÇALIŞAN RENDER
   ============================================================ */
async function renderCalisan() {
  const main = $('#appMain');
  const emps = await dbGet('employees/' + GZ.uid) || {};
  let html = `<div class="page-head"><h2>👷 Çalışan Yönetimi</h2><p class="muted">Personel tut, maaş öde, verimliliği artır.</p></div>
    <div class="emp-positions">`;
  for (const p of EMPLOYEE_POSITIONS) {
    html += `<div class="empos-card">
      <div class="emp-emo">${p.emo}</div>
      <h3>${p.name}</h3>
      <div>Maaş: ₺${p.minSalary.toLocaleString('tr-TR')}-${p.maxSalary.toLocaleString('tr-TR')}</div>
      <div>Verim Bonus: +%${p.productivityBonus*100}</div>
      <button class="btn-mini buy" onclick="empHireModal('${p.code}', ${p.minSalary}, ${p.maxSalary})">İşe Al</button>
    </div>`;
  }
  html += '</div><h3 style="margin-top:20px">Çalışanlarım</h3><div class="emps-list">';
  for (const k of Object.keys(emps)) {
    const e = emps[k];
    html += `<div class="emp-row">
      <b>${e.name}</b> · ${e.positionName} · ₺${e.salary}/ay · Moral: ${e.morale}%
      ${e.onStrike ? ' 🚫 GREVDE' : ''}
      <button class="btn-mini sell" onclick="empFire('${k}')">Çıkar</button>
    </div>`;
  }
  html += '</div>';
  main.innerHTML = html;
}
window.renderCalisan = renderCalisan;
window.empHireModal = function(code, min, max) {
  showModal('👷 İşe Al', `<input type="number" id="empSal" placeholder="Maaş (₺${min}-${max})"><button class="btn-primary" onclick="empHireExec('${code}')">Al</button>`);
};
window.empHireExec = async function(code) {
  const s = parseFloat($('#empSal').value) || 0;
  const r = await hireEmployee(code, s);
  if (r.ok) { toast(`✅ İşe alındı: ${r.employee.name}`, 'success'); closeModal(); renderCalisan(); }
  else toast(r.msg, 'error');
};
window.empFire = async function(k) {
  if (!confirm('Tazminat (2 maaş) ödenecek. Onaylıyor musun?')) return;
  const r = await fireEmployee(k);
  if (r.ok) { toast(`✅ Çıkarıldı. Tazminat: ₺${r.severance.toLocaleString('tr-TR')}`, 'success'); renderCalisan(); }
  else toast(r.msg, 'error');
};

/* ============================================================
   🔬 AR-GE RENDER
   ============================================================ */
async function renderArge() {
  const main = $('#appMain');
  const research = await dbGet('rd_tech/' + GZ.uid) || {};
  let html = `<div class="page-head"><h2>🔬 Ar-Ge / Teknoloji Ağacı</h2><p class="muted">Yatırım yap, kalıcı bonus kazan.</p></div>
    <div class="tech-grid">`;
  for (const code of Object.keys(TECH_TREE)) {
    const t = TECH_TREE[code];
    const r = research[code];
    const status = r?.status || 'available';
    let badge = '';
    if (status === 'completed') badge = '<span class="badge ok">✅ Tamam</span>';
    else if (status === 'in_progress') {
      const remH = Math.max(0, Math.ceil((r.completesAt - Date.now()) / 3600000));
      badge = `<span class="badge prog">⏳ ${remH}sa</span>`;
    }
    html += `<div class="tech-card">
      <h3>${t.name} ${badge}</h3>
      <div class="muted">${t.desc}</div>
      <div>Maliyet: ₺${t.cost.toLocaleString('tr-TR')} · Süre: ${t.days} gün</div>
      ${t.prereq.length ? `<div class="muted">Önkoşul: ${t.prereq.map(p => TECH_TREE[p].name).join(', ')}</div>` : ''}
      ${status === 'available' ? `<button class="btn-mini buy" onclick="rdStart('${code}')">Başlat</button>` : ''}
    </div>`;
  }
  html += '</div>';
  main.innerHTML = html;
}
window.renderArge = renderArge;
window.rdStart = async function(c) {
  const r = await startResearch(c);
  if (r.ok) { toast('✅ Araştırma başlatıldı', 'success'); renderArge(); }
  else toast(r.msg, 'error');
};

/* ============================================================
   🎓 EĞİTİM RENDER
   ============================================================ */
async function renderEgitim() {
  const main = $('#appMain');
  const edu = await dbGet('education/' + GZ.uid) || {};
  let html = `<div class="page-head"><h2>🎓 Eğitim Merkezi</h2><p class="muted">Kurslar al, kalıcı yetenek bonusları kazan.</p></div>
    <div class="course-grid">`;
  for (const c of COURSES) {
    const e = edu[c.code];
    let badge = e?.status === 'completed' ? '✅' : e?.status === 'in_progress' ? '⏳' : '';
    html += `<div class="course-card">
      <h3>${badge} ${c.name}</h3>
      <div class="muted">${c.desc} · ${c.branch}</div>
      <div>₺${c.cost.toLocaleString('tr-TR')} · ${c.days} gün</div>
      ${!e ? `<button class="btn-mini buy" onclick="eduEnroll('${c.code}')">Kayıt Ol</button>` : ''}
    </div>`;
  }
  html += '</div>';
  main.innerHTML = html;
}
window.renderEgitim = renderEgitim;
window.eduEnroll = async function(c) {
  const r = await enrollCourse(c);
  if (r.ok) { toast('✅ Kayıt olundu', 'success'); renderEgitim(); }
  else toast(r.msg, 'error');
};

/* ============================================================
   📝 SÖZLEŞME RENDER
   ============================================================ */
async function renderSozlesme() {
  const main = $('#appMain');
  const cts = await dbGet('contracts') || {};
  const my = Object.entries(cts).filter(([k,c]) => c.creator === GZ.uid || c.target === GZ.uid);
  let html = `<div class="page-head"><h2>📝 Sözleşmeler</h2><p class="muted">Oyuncularla resmi ticaret anlaşmaları.</p></div>
    <button class="btn-secondary" onclick="contractCreateModal()">🆕 Yeni Sözleşme</button>
    <div class="contracts-list">`;
  for (const [k, c] of my) {
    html += `<div class="contract-row">
      <b>${c.type}</b> · ${c.creatorName||'?'} → ${c.target===GZ.uid?'SEN':'?'} · 
      <span class="badge ${c.status}">${c.status}</span>
      ${c.status === 'pending' && c.target === GZ.uid ? `<button class="btn-mini" onclick="ctAccept('${k}')">Kabul</button>` : ''}
    </div>`;
  }
  html += '</div>';
  main.innerHTML = html;
}
window.renderSozlesme = renderSozlesme;
window.contractCreateModal = function() {
  showModal('📝 Sözleşme Oluştur', `
    <input type="text" id="ctTarget" placeholder="Hedef oyuncu UID">
    <select id="ctType">
      <option value="tedarik">Tedarik</option>
      <option value="satis">Satış</option>
      <option value="ortak_yatirim">Ortak Yatırım</option>
    </select>
    <textarea id="ctTerms" placeholder="Şartlar (JSON veya açıklama)"></textarea>
    <button class="btn-primary" onclick="ctCreateExec()">Gönder</button>
  `);
};
window.ctCreateExec = async function() {
  await createContract($('#ctTarget').value, $('#ctType').value, { note: $('#ctTerms').value });
  toast('✅ Sözleşme önerildi', 'success'); closeModal();
};
window.ctAccept = async function(k) {
  const r = await acceptContract(k);
  if (r.ok) { toast('✅ Kabul edildi', 'success'); renderSozlesme(); }
  else toast(r.msg, 'error');
};

/* ============================================================
   🏛️ BELEDİYE RENDER
   ============================================================ */
async function renderBelediye() {
  const main = $('#appMain');
  const elections = await dbGet('city_mayor/elections') || {};
  let html = `<div class="page-head"><h2>🏛️ Belediye Seçimleri</h2><p class="muted">Şehirlerde belediye başkanı ol, vergi ayarla.</p></div>
    <div class="cities-list">`;
  const cities = (window.ILLER || []).slice(0, 15);
  for (const city of cities) {
    const el = elections[city];
    html += `<div class="city-row">
      <b>${city}</b>
      ${el ? `· Adaylar: ${Object.keys(el.candidates||{}).length}` : ''}
      <button class="btn-mini" onclick="mayorRunModal('${city}')">Aday Ol</button>
      ${el ? `<button class="btn-mini" onclick="mayorVoteModal('${city}')">Oy Ver</button>` : ''}
    </div>`;
  }
  html += '</div>';
  main.innerHTML = html;
}
window.renderBelediye = renderBelediye;
window.mayorRunModal = function(city) {
  showModal('🏛️ Aday Ol — ' + city, `
    <textarea id="mManif" placeholder="Vaadlerin (manifesto)"></textarea>
    <input type="number" id="mTax" placeholder="Vergi % (0-20)" step="0.5" max="20" min="0">
    <button class="btn-primary" onclick="mayorRunExec('${city}')">Aday Ol (₺50K)</button>
  `);
};
window.mayorRunExec = async function(city) {
  const r = await runForMayor(city, $('#mManif').value, parseFloat($('#mTax').value)/100);
  if (r.ok) { toast('✅ Aday oldun', 'success'); closeModal(); }
  else toast(r.msg, 'error');
};
window.mayorVoteModal = async function(city) {
  const el = await dbGet('city_mayor/elections/' + city);
  let html = `<h3>${city} - Adaylar</h3>`;
  for (const uid of Object.keys(el.candidates || {})) {
    const c = el.candidates[uid];
    html += `<div class="candidate"><b>${c.name}</b> · Vergi: %${(c.taxPolicy*100).toFixed(1)}<br>${c.manifesto}<br><button class="btn-mini" onclick="mayorVoteExec('${city}','${uid}')">Oy Ver</button></div>`;
  }
  showModal('🗳️ Oy Ver', html);
};
window.mayorVoteExec = async function(city, uid) {
  const r = await voteForMayor(city, uid);
  if (r.ok) { toast('✅ Oy verildi', 'success'); closeModal(); }
  else toast(r.msg, 'error');
};

/* ============================================================
   ⚔️ TİCARET SAVAŞI RENDER
   ============================================================ */
async function renderTicsavas() {
  const main = $('#appMain');
  const wars = await dbGet('trade_war/active') || {};
  let html = `<div class="page-head"><h2>⚔️ Ticaret Savaşları</h2><p class="muted">Rakiplere ekonomik baskı uygula.</p></div>
    <button class="btn-secondary" onclick="warDeclareModal()">⚔️ Savaş İlan Et</button>
    <div class="wars-list">`;
  for (const k of Object.keys(wars)) {
    const w = wars[k];
    html += `<div class="war-row"><b>${w.aggressorName}</b> ⚔️ → <b>${w.target}</b> · ${w.weapon} · ${w.status}</div>`;
  }
  html += '</div>';
  main.innerHTML = html;
}
window.renderTicsavas = renderTicsavas;
window.warDeclareModal = function() {
  showModal('⚔️ Ticaret Savaşı İlan Et', `
    <input type="text" id="warTarget" placeholder="Hedef UID">
    <select id="warWeapon">
      <option value="fiyat_dampingi">Fiyat Dampingi</option>
      <option value="boykot">Boykot</option>
      <option value="reklam_savasi">Reklam Savaşı</option>
      <option value="lobi">Lobi Faaliyeti</option>
    </select>
    <input type="number" id="warDays" placeholder="Süre (gün)" value="7">
    <button class="btn-primary" onclick="warDeclareExec()">İlan Et (₺100K)</button>
  `);
};
window.warDeclareExec = async function() {
  const r = await declareTradeWar($('#warTarget').value, parseInt($('#warDays').value), $('#warWeapon').value);
  if (r.ok) { toast('⚔️ Savaş ilan edildi', 'success'); closeModal(); renderTicsavas(); }
  else toast(r.msg, 'error');
};

/* ============================================================
   🤜 DÜELLO RENDER
   ============================================================ */
async function renderDuello() {
  const main = $('#appMain');
  const duels = await dbGet('duels/active') || {};
  let html = `<div class="page-head"><h2>🤜 Düello Arena</h2><p class="muted">1v1 ticaret düellosu. Bahis koyar, kim daha çok kar yapar.</p></div>
    <button class="btn-secondary" onclick="duelCreateModal()">🤜 Düello Çağrısı Yap</button>
    <div class="duels-list">`;
  for (const k of Object.keys(duels)) {
    const d = duels[k];
    html += `<div class="duel-row"><b>${d.creatorName}</b> 🤜 ${d.opponent===GZ.uid?'SEN':'?'} · Bahis: ₺${d.betAmount?.toLocaleString('tr-TR')} · ${d.status}
      ${d.status==='pending' && d.opponent===GZ.uid ? `<button class="btn-mini" onclick="duelAccept('${k}')">Kabul</button>` : ''}
    </div>`;
  }
  html += '</div>';
  main.innerHTML = html;
}
window.renderDuello = renderDuello;
window.duelCreateModal = function() {
  showModal('🤜 Düello', `
    <input type="text" id="duelOpp" placeholder="Rakip UID">
    <input type="number" id="duelBet" placeholder="Bahis (min ₺10K)">
    <input type="number" id="duelDur" placeholder="Süre dk (5-60)" value="15">
    <button class="btn-primary" onclick="duelCreateExec()">Çağrı Yap</button>
  `);
};
window.duelCreateExec = async function() {
  const r = await createDuel($('#duelOpp').value, parseFloat($('#duelBet').value), parseInt($('#duelDur').value));
  if (r.ok) { toast('🤜 Düello çağrısı gönderildi', 'success'); closeModal(); }
  else toast(r.msg, 'error');
};
window.duelAccept = async function(k) {
  const r = await acceptDuel(k);
  if (r.ok) { toast('🤜 Düello başladı!', 'success'); renderDuello(); }
  else toast(r.msg, 'error');
};

/* ============================================================
   🎭 AVATAR / 🎖️ UNVAN / 🎨 DEKORASYON
   ============================================================ */
async function renderAvatar() {
  const main = $('#appMain');
  const owned = await dbGet('users/' + GZ.uid + '/ownedAvatars') || {};
  let html = `<div class="page-head"><h2>🎭 Avatar Seç</h2><p class="muted">Karakterini seç, premium olanlar 💎 ile.</p></div><div class="avatar-grid">`;
  for (const a of AVATARS) {
    const has = owned[a.code] || a.cost === 0 && !a.premium;
    html += `<div class="av-card ${has?'owned':''}">
      <div class="av-emo">${a.emo}</div>
      <h3>${a.name}</h3>
      ${has ? `<button class="btn-mini" onclick="setAvatarUI('${a.code}')">Kullan</button>` :
        `<button class="btn-mini buy" onclick="buyAvatarUI('${a.code}')">${a.premium ? `${a.diamondCost} 💎` : `₺${a.cost.toLocaleString('tr-TR')}`}</button>`}
    </div>`;
  }
  html += '</div>';
  main.innerHTML = html;
}
window.renderAvatar = renderAvatar;
window.setAvatarUI = async function(c) { await setAvatar(c); toast('✅ Avatar değişti', 'success'); };
window.buyAvatarUI = async function(c) {
  const r = await buyAvatar(c);
  if (r.ok) { toast('✅ Alındı', 'success'); renderAvatar(); }
  else toast(r.msg, 'error');
};

async function renderUnvan() {
  const main = $('#appMain');
  let html = `<div class="page-head"><h2>🎖️ Unvanlar</h2><p class="muted">Şartları yerine getirdiğin unvanları kullan.</p></div><div class="title-grid">`;
  for (const t of TITLES) {
    html += `<div class="title-card" style="border-color:${t.color}">
      <h3 style="color:${t.color}">${t.name}</h3>
      <div class="muted">Şart: ${JSON.stringify(t.condition)}</div>
      <button class="btn-mini" onclick="setTitleUI('${t.code}')">Kullan</button>
    </div>`;
  }
  html += '</div>';
  main.innerHTML = html;
}
window.renderUnvan = renderUnvan;
window.setTitleUI = async function(c) { await setTitle(c); toast('✅ Unvan ayarlandı', 'success'); };

async function renderDekorasyon() {
  const main = $('#appMain');
  let html = `<div class="page-head"><h2>🎨 Dükkan Dekorasyonu</h2></div><div class="decor-grid">`;
  for (const d of DECORATIONS) {
    html += `<div class="decor-card">
      <h3>${d.name}</h3>
      <div class="muted">${d.desc}</div>
      <button class="btn-mini buy" onclick="buyDecorUI('${d.code}')">${d.diamondCost ? `${d.diamondCost} 💎` : `₺${d.cost.toLocaleString('tr-TR')}`}</button>
    </div>`;
  }
  html += '</div>';
  main.innerHTML = html;
}
window.renderDekorasyon = renderDekorasyon;
window.buyDecorUI = async function(c) {
  const r = await buyDecoration(c);
  if (r.ok) { toast('✅ Alındı', 'success'); renderDekorasyon(); }
  else toast(r.msg, 'error');
};

/* ============================================================
   🗺️ SEFER / ⭐ PRESTİJ / 🃏 KOLEKSİYON / 🗺️ HARİTA
   ============================================================ */
async function renderSefer() {
  const main = $('#appMain');
  const cur = await dbGet('expeditions/' + GZ.uid + '/current');
  let html = `<div class="page-head"><h2>🗺️ Seferler / Kampanyalar</h2><p class="muted">Uzun soluklu büyük görevler.</p></div>`;
  if (cur && cur.status === 'active') {
    const rem = Math.ceil((cur.endsAt - Date.now()) / 86400000);
    html += `<div class="expedition-active"><h3>${cur.emo} ${cur.name}</h3><div>Kalan: ${rem} gün</div></div>`;
  }
  html += '<div class="exp-grid">';
  for (const e of EXPEDITIONS) {
    html += `<div class="exp-card">
      <div class="exp-emo">${e.emo}</div>
      <h3>${e.name}</h3>
      <div>${e.days} gün · Ödül: ₺${e.reward.money.toLocaleString('tr-TR')} + ${e.reward.diamonds}💎 + ${e.reward.xp} XP</div>
      <ul>${e.goals.map(g => `<li>${g.desc}</li>`).join('')}</ul>
      <button class="btn-mini buy" onclick="seferStart('${e.code}')">Başlat</button>
    </div>`;
  }
  html += '</div>';
  main.innerHTML = html;
}
window.renderSefer = renderSefer;
window.seferStart = async function(c) {
  const r = await startExpedition(c);
  if (r.ok) { toast('🗺️ Sefer başladı', 'success'); renderSefer(); }
  else toast(r.msg, 'error');
};

async function renderPrestij() {
  const main = $('#appMain');
  const u = GZ.data;
  main.innerHTML = `<div class="page-head"><h2>⭐ Prestij Sistemi</h2><p class="muted">Lv 100 + ₺100M servete ulaştığında prestij kazan, kalıcı bonuslar al.</p></div>
    <div class="prestige-info">
      <h3>Mevcut Prestij: ${u?.prestige || 0}</h3>
      <div>Cash Çarpanı: ×${(1 + 0.05 * (u?.prestige || 0)).toFixed(2)}</div>
      <div>XP Çarpanı: ×${(1 + 0.10 * (u?.prestige || 0)).toFixed(2)}</div>
      ${(u?.level||1) >= 100 && (u?.netWorth||0) >= 100000000 ? 
        `<button class="btn-primary" onclick="prestijExec()">⭐ PRESTİJ AL</button>` : 
        `<div class="muted">Şartlar henüz yetersiz.</div>`}
    </div>`;
}
window.renderPrestij = renderPrestij;
window.prestijExec = async function() {
  if (!confirm('⚠️ Hesap sıfırlanacak (level, para, işletmeler) ama prestij + bonuslar kalır. Onaylıyor musun?')) return;
  const r = await attemptPrestige();
  if (r.ok) { toast(`⭐ Prestij ${r.newPrestige}!`, 'success', 6000); renderPrestij(); }
  else toast(r.msg, 'error');
};

async function renderKoleksiyon() {
  const main = $('#appMain');
  const owned = await dbGet('collectibles/owned/' + GZ.uid) || {};
  let html = `<div class="page-head"><h2>🃏 Koleksiyon Kartları</h2><p class="muted">Paket aç, nadir kart topla, takas et.</p></div>
    <div class="pack-buttons">
      <button class="btn-secondary" onclick="cardPackOpen('basic')">📦 Basic Paket (₺5K)</button>
      <button class="btn-secondary" onclick="cardPackOpen('premium')">💎 Premium Paket (₺25K)</button>
      <button class="btn-secondary" onclick="cardPackOpen('legendary')">👑 Legendary Paket (₺100K)</button>
    </div>
    <h3>Koleksiyonum (${Object.keys(owned).length} farklı kart)</h3>
    <div class="cards-grid">`;
  for (const c of COLLECTIBLE_CARDS) {
    const cnt = owned[c.id] || 0;
    if (cnt > 0) {
      html += `<div class="card-item ${c.rarity}" style="border-color:${RARITY_COLORS[c.rarity]}">
        <div class="ci-emo">${c.emo}</div>
        <h4>${c.name}</h4>
        <small>${c.rarity}</small>
        <div>Adet: ${cnt}</div>
      </div>`;
    }
  }
  html += '</div>';
  main.innerHTML = html;
}
window.renderKoleksiyon = renderKoleksiyon;
window.cardPackOpen = async function(type) {
  const r = await openCardPack(type);
  if (r.ok) {
    let txt = '🃏 Paket Açıldı:<br>';
    for (const c of r.drawn) txt += `<div style="color:${RARITY_COLORS[c.rarity]}">${c.emo} ${c.name} (${c.rarity})</div>`;
    showModal('🎉 Paket Açıldı', txt);
    setTimeout(renderKoleksiyon, 100);
  } else toast(r.msg, 'error');
};

async function renderHarita() {
  const main = $('#appMain');
  const regions = await dbGet('tr_map/regions') || {};
  let html = `<div class="page-head"><h2>🗺️ Türkiye Harita Modu</h2><p class="muted">Bölgelerin %50'sinde işletme = bölge sahipliği. Bölgede +%10 gelir bonus.</p></div>
    <div class="regions-grid">`;
  for (const r of TR_REGIONS) {
    const owned = regions[r.code];
    html += `<div class="region-card ${owned?'owned':''}">
      <h3>${r.name}</h3>
      <div class="muted">${r.cities.length} şehir</div>
      ${owned ? `<div>👑 Sahip: ${owned.ownerName}</div>` : 
        `<button class="btn-mini buy" onclick="regionClaim('${r.code}')">Bölgeyi Al (₺1M)</button>`}
    </div>`;
  }
  html += '</div>';
  main.innerHTML = html;
}
window.renderHarita = renderHarita;
window.regionClaim = async function(c) {
  const r = await claimRegion(c);
  if (r.ok) { toast('👑 Bölge alındı', 'success'); renderHarita(); }
  else toast(r.msg, 'error');
};

/* ============================================================
   ⚡ KURUCU PANELİ
   ============================================================ */
window.openFounderPanel = async function() {
  if (!window.GZ_IS_FOUNDER) { toast('Yetki yok', 'error'); return; }

  const statsR = await window.founderActions.getStats();
  const s = statsR.stats || {};

  showModal('⚡ KURUCU PANELİ', `
    <div class="founder-panel">
      <div class="fp-stats">
        <div class="fp-stat"><div class="fps-num">${s.totalUsers||0}</div><div class="fps-lbl">Oyuncu</div></div>
        <div class="fp-stat"><div class="fps-num">${s.onlineUsers||0}</div><div class="fps-lbl">Online</div></div>
        <div class="fp-stat"><div class="fps-num">₺${(s.totalMoney||0).toLocaleString('tr-TR')}</div><div class="fps-lbl">Toplam Para</div></div>
        <div class="fp-stat"><div class="fps-num">${s.bannedUsers||0}</div><div class="fps-lbl">Banlı</div></div>
        <div class="fp-stat"><div class="fps-num">${(s.avgLevel||0).toFixed(1)}</div><div class="fps-lbl">Ortalama Lv</div></div>
        <div class="fp-stat"><div class="fps-num">${s.founders||0}</div><div class="fps-lbl">Kurucular</div></div>
      </div>

      <div class="fp-section">
        <h3>📢 Global Duyuru</h3>
        <textarea id="fpBroadcast" placeholder="Tüm oyunculara bant olarak gözükecek mesaj"></textarea>
        <input type="number" id="fpBroadcastDur" placeholder="Süre (dakika)" value="30">
        <button class="btn-primary" onclick="fpDoBroadcast()">📢 Yayınla</button>
        <button class="btn-secondary" onclick="fpClearBroadcast()">🚫 Duyuruyu Kaldır</button>
      </div>

      <div class="fp-section">
        <h3>🔧 Bakım Modu</h3>
        <input type="text" id="fpMaintReason" placeholder="Sebep">
        <input type="text" id="fpMaintEta" placeholder="ETA (örn: 10 dk)">
        <button class="btn-primary" onclick="fpToggleMaint(true)">🔧 BAKIMA AL</button>
        <button class="btn-secondary" onclick="fpToggleMaint(false)">✅ Bakımdan Çıkar</button>
      </div>

      <div class="fp-section">
        <h3>👤 Kullanıcı İşlemleri</h3>
        <input type="text" id="fpUid" placeholder="Hedef Kullanıcı UID">
        <input type="number" id="fpAmount" placeholder="Miktar (₺ veya 💎 veya seviye)">
        <div class="fp-actions">
          <button class="btn-mini" onclick="fpGrantMoney()">💰 Para Ver</button>
          <button class="btn-mini" onclick="fpGrantDia()">💎 Elmas Ver</button>
          <button class="btn-mini" onclick="fpSetLv()">📊 Seviye Ayarla</button>
          <button class="btn-mini sell" onclick="fpBan()">🚫 Banla</button>
          <button class="btn-mini" onclick="fpUnban()">✅ Ban Kaldır</button>
        </div>
      </div>

      <div class="fp-section">
        <h3>📨 Tüm Oyunculara Bildirim</h3>
        <textarea id="fpNotif" placeholder="Bildirim mesajı"></textarea>
        <button class="btn-primary" onclick="fpSendNotif()">📨 Tüm Oyunculara Gönder</button>
      </div>
    </div>
  `);
};

window.fpDoBroadcast = async function() {
  const t = $('#fpBroadcast').value.trim();
  const d = parseInt($('#fpBroadcastDur').value) || 30;
  if (!t) return toast('Mesaj gerekli', 'error');
  const r = await window.founderActions.sendBroadcast(t, d);
  if (r.ok) toast('📢 Yayınlandı', 'success');
};
window.fpClearBroadcast = async function() { await window.founderActions.clearBroadcast(); toast('Kaldırıldı', 'success'); };
window.fpToggleMaint = async function(active) {
  await window.founderActions.toggleMaintenance(active, $('#fpMaintReason').value, $('#fpMaintEta').value);
  toast(active ? '🔧 Bakıma alındı' : '✅ Çıkarıldı', 'success');
};
window.fpGrantMoney = async function() {
  await window.founderActions.grantMoney($('#fpUid').value, parseFloat($('#fpAmount').value));
  toast('💰 Verildi', 'success');
};
window.fpGrantDia = async function() {
  await window.founderActions.grantDiamonds($('#fpUid').value, parseInt($('#fpAmount').value));
  toast('💎 Verildi', 'success');
};
window.fpSetLv = async function() {
  await window.founderActions.setLevel($('#fpUid').value, parseInt($('#fpAmount').value));
  toast('📊 Ayarlandı', 'success');
};
window.fpBan = async function() {
  if (!confirm('Banlamak istediğine emin misin?')) return;
  await window.founderActions.banUser($('#fpUid').value, 'Kurucu kararı');
  toast('🚫 Banlandı', 'success');
};
window.fpUnban = async function() {
  await window.founderActions.unbanUser($('#fpUid').value);
  toast('✅ Ban kaldırıldı', 'success');
};
window.fpSendNotif = async function() {
  const r = await window.founderActions.sendNotificationToAll($('#fpNotif').value, '📢');
  if (r.ok) toast(`📨 ${r.count} oyuncuya gönderildi`, 'success');
};


/* ╔══════════════════════════════════════════════════════════════════════════╗
   ║   🎨 v3.0 UI MODÜLÜ — Modaller, render fonksiyonları                     ║
   ╚══════════════════════════════════════════════════════════════════════════╝ */


/* ▼ 1. PARA TRANSFERİ MODAL'I */
window.openMoneyTransfer = function() {
  showModal('💸 Para Transferi', `
    <div class="muted small mb-12">
      Min Lv 5 · Komisyon %3 · Günlük Max ₺100.000
    </div>
    <div class="input-group">
      <label>👤 Hedef Kullanıcı UID</label>
      <input type="text" id="trUid" placeholder="Hedefin UID'si">
    </div>
    <div class="input-group">
      <label>💰 Tutar (₺)</label>
      <input type="number" id="trAmount" placeholder="Gönderilecek tutar">
    </div>
    <div class="input-group">
      <label>💬 Mesaj (Opsiyonel)</label>
      <input type="text" id="trMsg" maxlength="100" placeholder="Selamla...">
    </div>
    <div id="trPreview" class="trade-summary"></div>
    <button class="btn-primary" onclick="executeTransfer()" style="width:100%;margin-top:10px">💸 Gönder</button>
  `);

  setTimeout(() => {
    const a = document.getElementById('trAmount');
    if (a) a.addEventListener('input', () => {
      const amt = parseFloat(a.value) || 0;
      const fee = Math.floor(amt * 0.03);
      const total = amt + fee;
      const preview = document.getElementById('trPreview');
      if (preview) preview.innerHTML = amt > 0 ? `
        Gönderilecek: <b>${cashFmt(amt)}</b><br>
        Komisyon (%3): ${cashFmt(fee)}<br>
        <b>Toplam çekiliş: ${cashFmt(total)}</b>
      ` : '';
    });
  }, 100);
};

window.executeTransfer = async function() {
  const uid = document.getElementById('trUid').value.trim();
  const amt = parseFloat(document.getElementById('trAmount').value);
  const msg = document.getElementById('trMsg').value.trim();
  if (!uid) return toast('UID gir', 'error');
  if (!amt || amt <= 0) return toast('Geçerli tutar gir', 'error');

  const r = await transferMoney(uid, amt, msg);
  if (r.ok) {
    toast(`✅ ${cashFmt(amt)} gönderildi! (Komisyon: ${cashFmt(r.fee)})`, 'success', 5000);
    closeModal();
  } else {
    toast(r.msg, 'error');
  }
};


/* ▼ 2. İŞLEM GEÇMİŞİ MODAL'I */
window.openTxHistory = async function() {
  const log = await getTxLog(GZ.uid, 50);
  let html = '<h3>📜 Son İşlemler (50)</h3>';

  if (!log.length) {
    html += '<p class="muted">Henüz işlem yok</p>';
  } else {
    html += '<div class="tx-list">';
    for (const tx of log) {
      const date = new Date(tx.ts || 0).toLocaleString('tr-TR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' });
      const isIn = tx.type === 'in';
      html += `<div class="tx-row ${isIn?'tx-in':'tx-out'}">
        <div class="tx-date">${date}</div>
        <div class="tx-reason">${tx.reason || '—'}</div>
        <div class="tx-amount ${isIn?'green':'red'}">
          ${isIn?'+':'-'}${cashFmt(Math.abs(tx.amount||0))}
        </div>
      </div>`;
    }
    html += '</div>';
  }

  showModal('📜 İşlem Geçmişi', html);
};


/* ▼ 3. ÇARK ÇEVİRME MODAL'I */
window.openWheel = async function() {
  const canSpin = await canSpinWheel();
  showModal('🎡 Günlük Çark', `
    <div class="wheel-container">
      <div class="wheel-pointer">▼</div>
      <div class="wheel" id="wheelEl">
        ${WHEEL_PRIZES.map((p, i) => {
          const angle = (360 / WHEEL_PRIZES.length) * i;
          return `<div class="wheel-slice" style="background:${p.color};transform:rotate(${angle}deg)">
            <span>${p.label}</span>
          </div>`;
        }).join('')}
      </div>
    </div>
    <div class="tac mt-12 mb-8">
      ${canSpin ? '<p>Bugünkü ücretsiz çarkın hazır!</p>' : '<p class="red">Bugün çark çevirdin, yarın gel!</p>'}
    </div>
    <button class="btn-primary" id="wheelSpinBtn" onclick="executeWheelSpin()" style="width:100%" ${!canSpin?'disabled':''}>
      ${canSpin ? '🎡 ÇARKI ÇEVİR' : '⏳ Yarın Tekrar Gel'}
    </button>
    <div id="wheelResult" class="mg-result"></div>
  `);
};

window.executeWheelSpin = async function() {
  const btn = document.getElementById('wheelSpinBtn');
  const wheel = document.getElementById('wheelEl');
  const resultDiv = document.getElementById('wheelResult');
  if (!btn || !wheel) return;

  btn.disabled = true;
  btn.textContent = '🌀 Dönüyor...';

  // Sonuç al
  const r = await spinWheel();
  if (!r.ok) {
    btn.disabled = false;
    return toast(r.msg, 'warn');
  }

  // Animasyon
  const idx = WHEEL_PRIZES.findIndex(p => p.label === r.prize.label);
  const segmentAngle = 360 / WHEEL_PRIZES.length;
  const targetAngle = 360 * 5 + (360 - (idx * segmentAngle) - segmentAngle / 2);
  wheel.style.transition = 'transform 4s cubic-bezier(0.17, 0.67, 0.16, 1)';
  wheel.style.transform = `rotate(${targetAngle}deg)`;

  setTimeout(() => {
    let msg = '';
    if (r.prize.type === 'money') msg = `💰 +${cashFmt(r.prize.amount)} kazandın!`;
    else if (r.prize.type === 'diamond') msg = `💎 +${r.prize.amount} elmas kazandın!`;
    else if (r.prize.type === 'xp') msg = `⭐ +${r.prize.amount} XP kazandın!`;
    else msg = `😢 Bu sefer şanssızsın, yarın tekrar dene!`;

    resultDiv.innerHTML = `<div class="mg-win">${msg}</div>`;
    btn.textContent = '⏳ Yarın Tekrar Gel';
    if (r.prize.type !== 'nothing') toast(msg, 'success', 5000);
  }, 4200);
};


/* ▼ 4. PET MODAL'I */
window.openPetShop = async function() {
  const owned = await dbGet(`users/${GZ.uid}/pets`) || {};
  const active = await dbGet(`users/${GZ.uid}/activePet`);

  let html = '<h3>🐾 Pet Mağazası</h3><div class="pet-grid">';
  for (const p of PETS) {
    const isOwned = owned[p.id];
    const isActive = active === p.id;
    html += `<div class="pet-card ${isOwned?'owned':''} ${isActive?'active':''}">
      <div class="pet-emo">${p.emo}</div>
      <h4>${p.name}</h4>
      <div class="muted small">${p.desc}</div>
      ${isOwned ? `
        ${isActive
          ? '<div class="badge ok">✅ Aktif</div>'
          : `<button class="btn-mini" onclick="petActivate('${p.id}')">Aktifleştir</button>`}
        <button class="btn-mini" onclick="petFeed('${p.id}')">🍖 Besle (₺100)</button>
      ` : `
        <button class="btn-mini buy" onclick="petBuy('${p.id}')">
          ${p.diamondCost ? `${p.diamondCost}💎` : cashFmt(p.cost)}
        </button>
      `}
    </div>`;
  }
  html += '</div>';
  showModal('🐾 Pet Mağazası', html);
};

window.petBuy = async function(id) {
  const r = await buyPet(id);
  if (r.ok) { toast(`🎉 ${r.pet.name} satın aldın!`, 'success'); openPetShop(); }
  else toast(r.msg, 'error');
};

window.petActivate = async function(id) {
  const r = await setActivePet(id);
  if (r.ok) { toast('✅ Pet aktifleştirildi', 'success'); openPetShop(); }
  else toast(r.msg, 'error');
};

window.petFeed = async function(id) {
  const r = await feedPet(id);
  if (r.ok) toast('🍖 Pet beslendi', 'success');
  else toast(r.msg, 'error');
};


/* ▼ 5. REFERANS MODAL'I */
window.openReferral = async function() {
  const code = await generateReferralCode();
  const refCount = await dbGet(`users/${GZ.uid}/referralCount`) || 0;

  showModal('🎁 Referans Sistemi', `
    <div class="referral-banner">
      <h3>🎁 Arkadaşını Davet Et!</h3>
      <p>Sen: <b>+₺10.000 + 25💎</b> kazan</p>
      <p>Arkadaşın: <b>+₺5.000 + 10💎</b> kazansın</p>
    </div>

    <div class="ref-code-box">
      <div class="rc-label">Senin kodun:</div>
      <div class="rc-code" onclick="navigator.clipboard.writeText('${code}').then(()=>toast('📋 Kod kopyalandı','success'))">
        ${code}
      </div>
      <div class="muted small">Tıkla kopyala</div>
    </div>

    <div class="ref-stats">
      <div class="rs-num">${refCount}</div>
      <div class="rs-lbl">Davet edilen oyuncu</div>
    </div>

    <hr>
    <h4>Bir kod kullanmak ister misin?</h4>
    <p class="muted small">Sadece ilk 7 gün, tek kullanımlık</p>
    <input type="text" id="refUseCode" placeholder="Kod gir...">
    <button class="btn-secondary" onclick="useRefUI()" style="width:100%">Kodu Kullan</button>
  `);
};

window.useRefUI = async function() {
  const c = document.getElementById('refUseCode').value;
  const r = await useReferralCode(c);
  if (r.ok) { toast('🎁 Bonus alındı!', 'success', 5000); closeModal(); }
  else toast(r.msg, 'error');
};


/* ▼ 6. DASHBOARD MODAL'I */
window.openDashboard = async function() {
  const stats = await getDashboardStats();
  if (!stats) return toast('Veri alınamadı', 'error');

  showModal('📊 Genel Görünüm', `
    <div class="dash-grid">
      <div class="dash-card primary">
        <div class="dc-label">💎 Net Değer</div>
        <div class="dc-value">${cashFmt(stats.netWorth)}</div>
      </div>
      <div class="dash-card">
        <div class="dc-label">💰 Cüzdan</div>
        <div class="dc-value">${cashFmt(stats.cash)}</div>
      </div>
      <div class="dash-card">
        <div class="dc-label">🏦 Banka</div>
        <div class="dc-value">${cashFmt(stats.bank)}</div>
      </div>
      ${stats.debt > 0 ? `
      <div class="dash-card debt">
        <div class="dc-label">💳 Borç</div>
        <div class="dc-value red">${cashFmt(stats.debt)}</div>
      </div>` : ''}
      <div class="dash-card">
        <div class="dc-label">📈 Bu Hafta</div>
        <div class="dc-value ${stats.weekProfit>=0?'green':'red'}">
          ${stats.weekProfit>=0?'+':''}${cashFmt(stats.weekProfit)}
        </div>
        <div class="dc-sub">Gelir: ${cashFmt(stats.weekIn)}<br>Gider: ${cashFmt(stats.weekOut)}</div>
      </div>
      <div class="dash-card">
        <div class="dc-label">🏢 İşletmeler</div>
        <div class="dc-value">${stats.businesses.total}</div>
        <div class="dc-sub">
          🏪${stats.businesses.shops} 🌱${stats.businesses.gardens}
          🐄${stats.businesses.farms} 🏭${stats.businesses.factories}
          ⛏️${stats.businesses.mines}
        </div>
      </div>
    </div>
    <div style="display:flex;gap:8px;margin-top:12px">
      <button class="btn-secondary" onclick="openTxHistory()" style="flex:1">📜 İşlem Geçmişi</button>
      <button class="btn-secondary" onclick="openWeeklyGoal()" style="flex:1">🎯 Haftalık Hedef</button>
    </div>
  `);
};


/* ▼ 7. HAFTALIK HEDEF MODAL'I */
window.openWeeklyGoal = async function() {
  const goal = await getWeeklyGoal();

  if (!goal) {
    showModal('🎯 Haftalık Hedef Belirle', `
      <p class="muted">Bu hafta için bir kazanç hedefi belirle. Tamamlarsan bonus alırsın!</p>
      <div class="input-group">
        <label>Hedef tutar (Min ₺1.000)</label>
        <input type="number" id="goalAmount" placeholder="₺50000">
      </div>
      <button class="btn-primary" onclick="setWeeklyGoalUI()" style="width:100%">Hedef Belirle</button>
    `);
  } else {
    const progress = Math.min(100, ((goal.progress || 0) / goal.target) * 100);
    showModal('🎯 Haftalık Hedef', `
      <div class="weekly-goal">
        <div class="wg-target">Hedef: ${cashFmt(goal.target)}</div>
        <div class="wg-progress">${cashFmt(goal.progress || 0)} / ${cashFmt(goal.target)}</div>
        <div class="wg-bar">
          <div class="wg-bar-fill" style="width:${progress}%"></div>
        </div>
        <div class="wg-percent">${progress.toFixed(1)}%</div>
        ${progress >= 100 ? '<div class="wg-done">✅ TAMAMLANDI! Bonus kazanıldı.</div>' : ''}
      </div>
    `);
  }
};

window.setWeeklyGoalUI = async function() {
  const v = parseFloat(document.getElementById('goalAmount').value);
  const r = await setWeeklyGoal(v);
  if (r.ok) { toast('🎯 Hedef belirlendi!', 'success'); openWeeklyGoal(); }
  else toast(r.msg, 'error');
};


/* ▼ 8. PROFİL DÜZENLEME (gelişmiş) */
window.openEditProfile = async function() {
  const u = GZ.data;
  showModal('✏️ Profili Düzenle', `
    <div class="input-group">
      <label>📝 Bio (max 200 karakter)</label>
      <textarea id="pfBio" maxlength="200" rows="3" placeholder="Kendinden bahset...">${u.bio || ''}</textarea>
    </div>
    <div class="input-group">
      <label>🎨 Banner Rengi</label>
      <input type="color" id="pfBanner" value="${u.bannerColor || '#3b82f6'}">
    </div>
    <div class="input-group">
      <label><input type="checkbox" id="pfShowBank" ${u.showBank?'checked':''}> 🏦 Banka bakiyemi göster</label>
    </div>
    <div class="input-group">
      <label><input type="checkbox" id="pfShowStats" ${u.showStats!==false?'checked':''}> 📊 İstatistiklerimi göster</label>
    </div>
    <button class="btn-primary" onclick="saveProfile()" style="width:100%">💾 Kaydet</button>
  `);
};

window.saveProfile = async function() {
  await updateProfile({
    bio: document.getElementById('pfBio').value,
    bannerColor: document.getElementById('pfBanner').value,
    showBank: document.getElementById('pfShowBank').checked,
    showStats: document.getElementById('pfShowStats').checked
  });
  toast('✅ Profil kaydedildi', 'success');
  closeModal();
};

/* ═══ KREDİ SİSTEMİ — 10 Banka (Oyuncu Görünümü) ═══ */
async function renderKredi(){
  const main=$('#appMain');
  main.innerHTML='<div style="padding:40px;text-align:center"><div class="spinner" style="margin:0 auto"></div></div>';
  const not=typeof window.getKrediNotu==='function'?await window.getKrediNotu(GZ.uid):100;
  const limit=typeof window.getKrediLimit==='function'?window.getKrediLimit(not):1000;
  const borc=(await dbGet('bank/'+GZ.uid+'/loan'))||0;
  const kalan=Math.max(0,limit-borc);
  const renk=not>=80?'#22c55e':not>=60?'#f59e0b':not>=40?'#f97316':'#ef4444';
  const etiket=not>=80?'Mükemmel':not>=60?'İyi':not>=40?'Orta':'Düşük';
  const bankalar=window.BANKALAR||[];
  const minNot=window.KREDI_MIN_NOT||40;
  // DB'den güncel faiz oranlarını çek
  const dbFaizler=(await dbGet('system/bankFaizler'))||{};
  const basvurular={};
  for(const b of bankalar){const bas=await dbGet('krediBasvurular/'+GZ.uid+'_'+b.id);if(bas)basvurular[b.id]=bas;}

  const cards=bankalar.map(b=>{
    const curFaiz=dbFaizler[b.id]||b.faiz;
    const bas=basvurular[b.id];
    const bLimit=Math.floor(limit*(b.maxKat||2));
    const bKalan=Math.max(0,bLimit-borc);
    const canApp=(!bas||bas.durum==='reddedildi')&&bKalan>0&&not>=minNot;
    let badge='';
    if(bas){
      if(bas.durum==='beklemede') badge='<div style="color:#f59e0b;font-size:11px;margin-top:3px">⏳ Başvuru beklemede...</div>';
      else if(bas.durum==='onaylandi') badge='<div style="color:#22c55e;font-size:11px;margin-top:3px">✅ Onaylandı (+₺'+((bas.miktar||0).toLocaleString())+')</div>';
      else badge='<div style="color:#ef4444;font-size:11px;margin-top:3px">❌ Reddedildi</div>';
    }
    const btnHtml=canApp?'<div style="display:flex;gap:8px;margin-top:10px">'+
      '<input type="number" id="bas_'+b.id+'" placeholder="Miktar (₺)" min="100" max="'+bKalan+'" style="flex:1;padding:10px;border-radius:8px;border:1px solid var(--border,#e5e7eb);background:var(--bg,#fff);color:var(--text,#111);font-size:14px">'+
      '<button style="padding:10px 14px;background:'+b.color+';border:none;border-radius:8px;color:#fff;font-weight:700;cursor:pointer" onclick="window._uiBasvur(\''+b.id+'\')">📋 Başvur</button>'+
      '</div>':(!bas||bas.durum==='reddedildi')?'<div style="text-align:center;color:#ef4444;font-size:11px;padding:6px 0">'+(not<minNot?'❌ Kredi notun yetersiz (min '+minNot+')':'⚠️ Limit yok')+'</div>':'';
    return '<div class="card" style="border-left:4px solid '+b.color+';margin-bottom:10px">'+
      '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">'+
        '<span style="font-size:26px">'+b.logo+'</span>'+
        '<div style="flex:1"><div style="font-weight:700;font-size:14px">'+b.name+'</div>'+
        '<div style="font-size:11px;color:#64748b">'+b.info+'</div>'+badge+'</div>'+
        '<div style="text-align:right"><div style="font-size:10px;color:#64748b">FAİZ</div><div style="font-weight:700;color:'+b.color+'">%'+(curFaiz*100).toFixed(2)+'</div>'+
        '<div style="font-size:9px;color:#475569">yıllık</div></div>'+
      '</div>'+
      '<div style="display:flex;justify-content:space-between;font-size:12px;color:#64748b;margin-bottom:6px">'+
        '<span>Max limit: <b style="color:var(--text)">'+cashFmt(bLimit)+'</b></span>'+
        '<span>Haftalık: <b style="color:#f59e0b">₺'+(1000*curFaiz/52).toFixed(2)+'</b>/1000₺</span>'+
        '<span>Kalan: <b style="color:#3b82f6">'+cashFmt(bKalan)+'</b></span>'+
      '</div>'+
      btnHtml+'</div>';
  }).join('');

  main.innerHTML=
    '<div class="page-title">💳 Kredi Sistemi</div>'+
    // Kredi notu
    '<div class="card" style="background:linear-gradient(135deg,#0f172a,#1e293b);border:1px solid #334155;margin-bottom:12px">'+
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">'+
        '<div><div style="color:#94a3b8;font-size:11px;letter-spacing:1px">KREDİ NOTUN</div>'+
        '<div style="font-size:44px;font-weight:900;color:'+renk+';line-height:1">'+not+'</div>'+
        '<div style="font-size:12px;color:#64748b">/ 100 · <span style="color:'+renk+'">'+etiket+'</span></div></div>'+
        '<span style="font-size:42px">'+(not>=80?'⭐':not>=60?'✅':not>=40?'⚠️':'❌')+'</span>'+
      '</div>'+
      '<div style="background:#1e3a5f;border-radius:8px;padding:2px;margin-bottom:12px">'+
        '<div style="background:'+renk+';height:10px;border-radius:8px;width:'+not+'%"></div></div>'+
      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">'+
        '<div style="background:#0f172a;border-radius:8px;padding:10px;text-align:center"><div style="color:#64748b;font-size:10px">TEMEL LİMİT</div><div style="color:#e2e8f0;font-weight:700">'+cashFmt(limit)+'</div></div>'+
        '<div style="background:#0f172a;border-radius:8px;padding:10px;text-align:center"><div style="color:#64748b;font-size:10px">MEVCUT BORÇ</div><div style="color:'+(borc>0?'#ef4444':'#22c55e')+';font-weight:700">'+cashFmt(borc)+'</div></div>'+
        '<div style="background:#0f172a;border-radius:8px;padding:10px;text-align:center"><div style="color:#64748b;font-size:10px">KALAN</div><div style="color:#3b82f6;font-weight:700">'+cashFmt(kalan)+'</div></div>'+
      '</div></div>'+
    // Borç ödeme
    (borc>0?'<div class="card" style="background:#1c1917;border:1px solid #78350f;margin-bottom:12px">'+
      '<div class="card-title" style="color:#fbbf24">⚠️ Borcunu Öde — Her ödeme notu artırır!</div>'+
      '<div class="input-group"><input type="number" id="krediOdemeInp" placeholder="Miktar (₺)" max="'+borc+'"></div>'+
      '<div style="display:flex;gap:6px;margin-bottom:10px">'+
        '<button class="btn-primary" style="flex:1;background:#92400e;padding:8px;font-size:12px" onclick="document.getElementById(\'krediOdemeInp\').value='+Math.floor(borc*0.25)+'">%25</button>'+
        '<button class="btn-primary" style="flex:1;background:#92400e;padding:8px;font-size:12px" onclick="document.getElementById(\'krediOdemeInp\').value='+Math.floor(borc*0.5)+'">%50</button>'+
        '<button class="btn-primary" style="flex:1;background:#92400e;padding:8px;font-size:12px" onclick="document.getElementById(\'krediOdemeInp\').value='+borc+'">TÜMÜ</button>'+
      '</div>'+
      '<button class="btn-primary" style="width:100%;background:#d97706" onclick="window._uiKrediOde()">✅ Borç Öde</button></div>':'') +
    '<div style="font-size:12px;font-weight:700;color:var(--text-muted);margin:16px 0 8px;letter-spacing:.5px">🏦 10 BANKA — KREDİ BAŞVURUSU</div>'+
    cards+
    '<div class="card" style="background:#0c1a2e;border:1px solid #1e3a5f">'+
      '<div style="font-size:12px;color:#64748b">💡 Başvuruyu yetkili onaylar. Çevrimdışıysa AI asistan 8dk içinde değerlendirir. Ödedikçe notun artar → limit yükselir.</div></div>';
}
window.renderKredi=renderKredi;

window._uiBasvur=async function(bankaId){
  const inp=document.getElementById('bas_'+bankaId);
  const m=parseInt(inp?.value);
  if(!m||m<=0) return toast('Geçerli miktar gir','error');
  if(typeof window.krediBasvuruYap==='function'){await window.krediBasvuruYap(bankaId,m);renderKredi();}
  else toast('Kredi sistemi yüklenmedi','error');
};
window._uiKrediOde=async function(){
  const m=parseInt(document.getElementById('krediOdemeInp')?.value);
  if(!m||m<=0) return toast('Geçerli miktar gir','error');
  if(typeof bankRepay!=='function') return toast('bankRepay bulunamadı','error');
  const ok=await bankRepay(m);
  if(ok){
    if(typeof window.updateKrediNotu==='function') await window.updateKrediNotu(GZ.uid,Math.min(5,Math.floor(m/200)));
    renderKredi();
  }
};

/* Oyuncu vergi görünümü */
async function renderVergiOyuncu(){
  const main=$('#appMain');
  main.innerHTML='<div style="padding:40px;text-align:center"><div class="spinner" style="margin:0 auto"></div></div>';
  let v=null;
  if(typeof window.getVergiDetay==='function') v=await window.getVergiDetay(GZ.uid).catch(()=>null);
  if(!v){main.innerHTML='<div class="page-title">🏛️ Vergi Bilgisi</div><div class="card"><p>Vergi bilgisi yüklenemedi.</p></div>';return;}
  main.innerHTML='<div class="page-title">🏛️ Vergi & Faiz</div>'+
    '<div class="card" style="background:#1c1917;border:1px solid #78350f;margin-bottom:12px">'+
      '<div class="card-title" style="color:#fbbf24">🏛️ Haftalık Vergi (Cumartesi Tahsil)</div>'+
      '<div style="line-height:2;font-size:14px">'+
        (v.shopTax>0?'<div style="display:flex;justify-content:space-between"><span>🏪 Dükkan vergisi</span><b style="color:#f59e0b">'+cashFmt(v.shopTax)+'</b></div>':'')+
        (v.gardenTax>0?'<div style="display:flex;justify-content:space-between"><span>🌱 Bahçe vergisi</span><b style="color:#f59e0b">'+cashFmt(v.gardenTax)+'</b></div>':'')+
        (v.farmTax>0?'<div style="display:flex;justify-content:space-between"><span>🐄 Çiftlik vergisi</span><b style="color:#f59e0b">'+cashFmt(v.farmTax)+'</b></div>':'')+
        (v.factoryTax>0?'<div style="display:flex;justify-content:space-between"><span>🏭 Fabrika vergisi</span><b style="color:#f59e0b">'+cashFmt(v.factoryTax)+'</b></div>':'')+
        (v.mineTax>0?'<div style="display:flex;justify-content:space-between"><span>⛏️ Maden vergisi</span><b style="color:#f59e0b">'+cashFmt(v.mineTax)+'</b></div>':'')+
        (v.gelirVer>0?'<div style="display:flex;justify-content:space-between"><span>💰 Gelir vergisi</span><b style="color:#f59e0b">'+cashFmt(v.gelirVer)+'</b></div>':'')+
        '<div style="border-top:1px solid var(--border);margin-top:8px;padding-top:8px;display:flex;justify-content:space-between;font-weight:700"><span>TOPLAM</span><b style="color:#f59e0b">'+cashFmt(v.totalVergi)+'</b></div>'+
      '</div></div>'+
    (v.weeklyFaiz>0?'<div class="card" style="margin-bottom:12px">'+
      '<div class="card-title">💳 Kredi Faizi (Haftalık)</div>'+
      '<div style="display:flex;justify-content:space-between;font-size:14px"><span>Toplam borç: <b>'+cashFmt(v.loan)+'</b></span><span>Faiz: <b>%'+(v.bankaFaiz*100).toFixed(2)+'</b> yıllık</span></div>'+
      '<div style="display:flex;justify-content:space-between;font-size:14px;margin-top:8px;font-weight:700"><span>Haftalık faiz ödemesi</span><b style="color:#22c55e">'+cashFmt(v.weeklyFaiz)+'</b></div>'+
      '</div>':'') +
    '<div class="card" style="background:#0c1a2e;border:1px solid #1e3a5f">'+
      '<div style="font-size:12px;color:#64748b">🏦 Tüm vergiler ve faizler <b>Karakaş Merkez Bankası</b>\'na (yetkili hesabına) her cumartesi otomatik yatırılır.</div></div>';
}
window.renderVergiOyuncu=renderVergiOyuncu;

/* ═══════════════════════════════════════════
   GLOBAL YARDIMCILAR — eksik fonksiyonlar
   ═══════════════════════════════════════════ */

// Karanlık mod toggle (her zaman dark kalır ama butona basılırsa)
window.toggleDarkMode = function() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'light' ? 'dark' : 'dark'; // Her zaman dark
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
};

// emptyState helper (bazı yerlerde doğrudan çağrılıyor)
function emptyState(icon, title, desc) {
  return `<div class="empty-state">
    <span class="emoji">${icon}</span>
    <h3>${title}</h3>
    <p>${desc || ''}</p>
  </div>`;
}
window.emptyState = emptyState;

// showModal helper
window.showModal = function(title, bodyHtml, footHtml) {
  const existing = document.querySelector('.modal-bg');
  if (existing) existing.remove();
  const bg = document.createElement('div');
  bg.className = 'modal-bg';
  bg.innerHTML = `<div class="modal">
    <div class="modal-grabber"></div>
    <div class="modal-head">
      <h3>${title}</h3>
      <button class="modal-close" onclick="window.closeModal?.()">✕</button>
    </div>
    <div class="modal-body">${bodyHtml}</div>
    ${footHtml ? `<div class="modal-foot">${footHtml}</div>` : ''}
  </div>`;
  bg.addEventListener('click', e => { if (e.target === bg) window.closeModal?.(); });
  document.body.appendChild(bg);
};
window.closeModal = function() {
  document.querySelector('.modal-bg')?.remove();
};

// pickCity modal
window.pickCity = function(shopType) {
  if (!window.ILLER) return window.buyShop?.(shopType, 'İstanbul');
  const opts = window.ILLER.map(c => `<option value="${c}">${c}</option>`).join('');
  window.showModal('🏙️ Şehir Seç', `
    <div class="input-group">
      <label>Dükkanın kurulacağı şehir</label>
      <select id="pickCitySelect">${opts}</select>
    </div>
    <button class="btn-primary" style="width:100%;margin-top:12px"
      onclick="window.buyShop?.('${shopType}', document.getElementById('pickCitySelect').value); window.closeModal?.();">
      ✅ Dükkanı Kur
    </button>`);
};



/* ─── konsol-manager.js ─── */
/* ==========================================================================
   konsol-manager.js — GameZone ERP v3.0 — TAM MENÜ SİSTEMİ
   ─────────────────────────────────────────────────────────────────────────
   Tüm sekmeler kategorilere ayrılmış: Devlet, Kamu, Polis, Finans, vb.
   ========================================================================== */

(function () {

  /* ─── Sabit alt 5 sekme ─── */
  const PRIMARY_TABS = [
    { id: 'dukkan',    icon: '🏪', label: 'Dükkan'   },
    { id: 'bahce',     icon: '🌱', label: 'Üretim'   },
    { id: '__menu__',  icon: '◉',  label: 'Menü', isFab: true },
    { id: 'haberler',  icon: '📰', label: 'Haberler' },
    { id: 'cuzdan',    icon: '💰', label: 'Cüzdan'   },
  ];

  /* ─── TÜM KATEGORİLER — MENÜ FAB'da açılır ─── */
  const CATEGORIES = [

    /* ════════════ DEVLET & KAMU ════════════ */
    {
      id: 'devlet', name: 'DEVLET & KAMU', icon: '🏛️', color: '#1d4ed8',
      items: [
        { id: 'haberler',     icon: '📰', label: 'Piyasa Haberleri',  desc: 'Canlı ekonomi & piyasa haberleri',   highlight: true },
        { id: 'vergidairesi', icon: '🧾', label: 'Vergi Dairesi',     desc: 'Vergi borcun, beyanname, ödeme planı', highlight: true },
        { id: 'krediofisi',   icon: '💳', label: 'Kredi Ofisi',       desc: 'Banka kredisi, taksit & yapılandırma', highlight: true },
        { id: 'konkurato',    icon: '📋', label: 'Borç Yapılandırma', desc: 'Konkordato & özel ödeme düzenlemesi'                  },
      ]
    },

    /* ════════════ ÜRETİM ════════════ */
    {
      id: 'uretim', name: 'ÜRETİM', icon: '🏭', color: '#16a34a',
      items: [
        { id: 'bahce',   icon: '🌱', label: 'Bahçeler',    desc: 'Meyve & sebze yetiştir'                    },
        { id: 'ciftlik', icon: '🐄', label: 'Çiftlikler',  desc: 'Hayvancılık & et/süt'                      },
        { id: 'fabrika', icon: '🏭', label: 'Fabrikalar',  desc: 'İşlenmiş ürün üretimi'                     },
        { id: 'maden',   icon: '⛏️', label: 'Madenler',    desc: 'Altın, gümüş, demir... (Lv 30+)'           },
        { id: 'enerji',  icon: '⚡', label: 'Enerji San.', desc: 'Güneş, rüzgar, termik enerji üretimi'      },
      ]
    },

    /* ════════════ TİCARET ════════════ */
    {
      id: 'ticaret', name: 'TİCARET', icon: '💼', color: '#1e5cb8',
      items: [
        { id: 'pazar',      icon: '🛒', label: 'Pazar',          desc: 'Pazar kademeleri & satış'                         },
        { id: 'oyunpazari', icon: '🏬', label: 'Oyuncu Pazarı', desc: 'Diğer oyunculardan al-sat', highlight: true        },
        { id: 'lojistik',   icon: '🚚', label: 'Lojistik',       desc: '81 ilde depo ağı'                                 },
        { id: 'ihracat',    icon: '🚢', label: 'İhracat',        desc: 'Yabancı şirketlere sat'                           },
        { id: 'ihale',      icon: '📋', label: 'İhaleler',       desc: 'Devlet ihaleleri, teklif ver', highlight: true     },
        { id: 'karaborsa',  icon: '🕶️', label: 'Kara Borsa',    desc: 'Yüksek risk/ödül (Lv 15+)'                        },
      ]
    },

    /* ════════════ FİNANS & BANKACILIK ════════════ */
    {
      id: 'finans', name: 'FİNANS & BANKACILIK', icon: '🏦', color: '#0891b2',
      items: [
        { id: 'banka',   icon: '🏦', label: 'Banka',         desc: 'Kredi çek, mevduat aç, havale', highlight: true  },
        { id: 'borsa',   icon: '📊', label: 'Borsa',          desc: 'Hisse al-sat, IPO, temettü',    highlight: true  },
        { id: 'kripto',  icon: '₿',  label: 'Kripto Borsa',  desc: 'BTC, ETH, GZCoin al-sat'                         },
        { id: 'tahvil',  icon: '📜', label: 'Tahvil & Bono', desc: 'Sabit getirili yatırım'                           },
        { id: 'futures', icon: '📉', label: 'Vadeli İşlem',  desc: 'Kaldıraçlı pozisyon (riskli)'                     },
      ]
    },

    /* ════════════ VARLIK & EMLAK ════════════ */
    {
      id: 'varlik', name: 'VARLIK & EMLAK', icon: '🏘️', color: '#0d9488',
      items: [
        { id: 'sigorta', icon: '🛡️', label: 'Sigorta', desc: 'DASK, kasko, sağlık' },
      ]
    },

    /* ════════════ SOSYAL ════════════ */
    {
      id: 'sosyal', name: 'SOSYAL', icon: '👥', color: '#7c3aed',
      items: [
        { id: 'marka',    icon: '🏢', label: 'Markalar', desc: 'Klan kur veya katıl (Lv 10+)'  },
        { id: 'liderlik', icon: '🏆', label: 'Liderlik', desc: 'En zenginler tablosu'            },
        { id: 'sehirler', icon: '🏙️', label: 'Şehirler', desc: '81 il, taşın'                   },
        { id: 'haberler', icon: '📰', label: 'Haberler', desc: 'Güncel piyasa & ihaleler'        },
      ]
    },

    /* ════════════ EĞLENCE ════════════ */
    {
      id: 'eglence', name: 'EĞLENCE', icon: '🎮', color: '#f59e0b',
      items: [
        { id: 'gorevler',   icon: '📋', label: 'Günlük Görevler', desc: 'Her gün yeni görev, ödül kazan' },
        { id: 'basarimlar', icon: '🏅', label: 'Başarımlar',      desc: '15 başarım, XP ödüllü'          },
        { id: 'magaza',     icon: '💎', label: 'Elmas Mağaza',    desc: 'Elmas paketleri & robot'        },
      ]
    },

    /* ════════════ GLOBAL ════════════ */
    {
      id: 'global', name: 'GLOBAL', icon: '🌍', color: '#7c2d12',
      items: [
        { id: 'uluslararasi', icon: '🌍', label: 'Uluslararası', desc: '10 ülkeye ihracat'               },
        { id: 'ihracat',      icon: '🚢', label: 'İhracat Mer.', desc: 'İhracat belgeleri ve teşvikler'  },
      ]
    },

    /* ════════════ BİLGİ ════════════ */
    {
      id: 'bilgi', name: 'BİLGİ', icon: '📚', color: '#6b7280',
      items: [
        { id: 'hikaye', icon: '📖', label: 'Hikaye', desc: 'Oyun hakkında'         },
        { id: 'sss',    icon: '❓', label: 'SSS',    desc: 'Sıkça sorulan sorular' },
      ]
    },

  ];

  let konsol   = null;
  let menuSheet = null;

  /* ══════════════════════ ALT KONSOL ══════════════════════ */
  function buildKonsol() {
    const old = document.getElementById('mainKonsol');
    if (old) old.remove();
    const oldSheet = document.getElementById('konsolFabBackdrop');
    if (oldSheet) oldSheet.remove();

    const nav = document.createElement('nav');
    nav.id = 'mainKonsol';
    nav.className = 'main-konsol';
    nav.setAttribute('role', 'navigation');
    nav.style.zIndex = '500';

    nav.innerHTML = PRIMARY_TABS.map(t => {
      if (t.isFab) return `
        <button class="mk-fab" id="mkFab" title="Tüm Menü">
          <div class="mk-fab-inner"><span class="mk-fab-icon">${t.icon}</span></div>
          <span class="mk-fab-label">${t.label}</span>
        </button>`;
      return `
        <button class="mk-tab" data-tab="${t.id}" title="${t.label}">
          <span class="mk-icon">${t.icon}</span>
          <span class="mk-label">${t.label}</span>
        </button>`;
    }).join('');

    document.body.appendChild(nav);
    konsol = nav;

    nav.querySelectorAll('.mk-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.tab;
        if (typeof window.switchTab === 'function') window.switchTab(id);
        setActive(id);
        addToRecents(id);
      });
    });

    document.getElementById('mkFab').addEventListener('click', openMenuSheet);
  }

  /* ══════════════════════ AKTİF SEKME ══════════════════════ */
  function setActive(id) {
    if (!konsol) return;
    konsol.querySelectorAll('.mk-tab').forEach(b =>
      b.classList.toggle('active', b.dataset.tab === id));
    const inPrimary = PRIMARY_TABS.some(t => t.id === id);
    document.getElementById('mkFab')?.classList.toggle('has-active', !inPrimary);
  }
  window.renderKonsolActive = setActive;

  /* ══════════════════════ MENÜ SHEET ══════════════════════ */
  function openMenuSheet() {
    closeMenuSheet();
    const recents = loadRecents();

    const sheet = document.createElement('div');
    sheet.id    = 'konsolFabBackdrop';
    sheet.className = 'mk-sheet-bg';

    /* Kullanıcının rolüne göre kategori filtrele */
    const userRole    = window.GZ?.data?.role    || 'vatandas';
    const isFounder   = window.GZ?.data?.isFounder || false;
    const isMayor     = !!(window.GZ?.data?.mayorOf);
    const isPresident = window.GZ?.data?.isPresident || false;
    const isPolis     = userRole === 'police';
    const isAsker     = userRole === 'soldier';

    const recentItems = recents.length ? `
      <div class="mk-cat" style="background:linear-gradient(135deg,#fef3c722,#fde68a22);border-color:#f59e0b44">
        <div class="mk-cat-head" style="color:#f59e0b">
          <span class="mk-cat-icon">⭐</span>
          <span class="mk-cat-name">SON KULLANILAN</span>
        </div>
        <div class="mk-cat-grid">
          ${recents.map(id => { const f = findItem(id); return f ? renderMenuItem(f) : ''; }).join('')}
        </div>
      </div>` : '';

    const catsHtml = CATEGORIES.map(cat => `
      <div class="mk-cat" data-cat="${cat.id}">
        <div class="mk-cat-head">
          <span class="mk-cat-icon" style="color:${cat.color}">${cat.icon}</span>
          <span class="mk-cat-name">${cat.name}</span>
          <span class="mk-cat-count">${cat.items.length}</span>
        </div>
        <div class="mk-cat-grid">
          ${cat.items.map(it => renderMenuItem(it, cat.color)).join('')}
        </div>
      </div>`).join('');

    sheet.innerHTML = `
      <div class="mk-sheet" onclick="event.stopPropagation()">
        <div class="mk-sheet-grabber"></div>
        <div class="mk-sheet-head">
          <div style="display:flex;flex-direction:column">
            <h3 style="margin:0;font-size:16px;font-weight:800">📋 Tüm Bölümler</h3>
            <div style="font-size:11px;color:#64748b;margin-top:2px">
              ${isFounder ? '⚡ Kurucu' : isPresident ? '🇹🇷 Cumhurbaşkanı' : isMayor ? '🏙️ Belediye Başkanı' : isPolis ? '👮 Polis' : isAsker ? '🎖️ Asker' : '👤 Vatandaş'}
              — ${window.GZ?.data?.username || ''}
            </div>
          </div>
          <button class="mk-sheet-close" id="mkSheetClose">✕</button>
        </div>
        <div class="mk-sheet-body">
          ${recentItems}
          ${catsHtml}
        </div>
      </div>`;

    document.body.appendChild(sheet);
    menuSheet = sheet;
    requestAnimationFrame(() => sheet.classList.add('open'));

    sheet.addEventListener('click', closeMenuSheet);
    document.getElementById('mkSheetClose').addEventListener('click', closeMenuSheet);

    sheet.querySelectorAll('[data-tab]').forEach(el => {
      el.addEventListener('click', e => {
        e.stopPropagation();
        const id = el.dataset.tab;
        if (typeof window.switchTab === 'function') window.switchTab(id);
        setActive(id);
        addToRecents(id);
        closeMenuSheet();
      });
    });

    /* Swipe to close */
    let startY = null;
    const sheetEl = sheet.querySelector('.mk-sheet');
    const grabber = sheetEl.querySelector('.mk-sheet-grabber');
    grabber.addEventListener('touchstart', e => { startY = e.touches[0].clientY; }, { passive: true });
    grabber.addEventListener('touchmove', e => {
      if (startY === null) return;
      const dy = e.touches[0].clientY - startY;
      if (dy > 0) sheetEl.style.transform = `translateY(${dy}px)`;
    }, { passive: true });
    grabber.addEventListener('touchend', e => {
      if (startY === null) return;
      sheetEl.style.transform = '';
      const dy = e.changedTouches[0].clientY - startY;
      startY = null;
      if (dy > 100) closeMenuSheet();
    });
  }

  function closeMenuSheet() {
    if (!menuSheet) return;
    menuSheet.classList.remove('open');
    setTimeout(() => { menuSheet?.remove(); menuSheet = null; }, 250);
  }

  function renderMenuItem(item, catColor) {
    const hl   = item.highlight ? ' mk-item-highlight' : '';
    const desc = item.desc ? `<div class="mk-item-desc">${item.desc}</div>` : '';
    const color = catColor || '#3b82f6';
    return `
      <button class="mk-item${hl}" data-tab="${item.id}"
        style="${item.highlight ? `border-color:${color}44;` : ''}">
        <span class="mk-item-icon" style="background:${color}18;color:${color}">${item.icon}</span>
        <div class="mk-item-text">
          <div class="mk-item-label">${item.label}</div>
          ${desc}
        </div>
        <span class="mk-item-arrow" style="color:${color}88">›</span>
      </button>`;
  }

  function findItem(id) {
    for (const cat of CATEGORIES)
      for (const it of cat.items)
        if (it.id === id) return it;
    return null;
  }

  function loadRecents() {
    try {
      const arr = JSON.parse(localStorage.getItem('mk_recents') || '[]');
      return Array.isArray(arr) ? arr.filter(id => findItem(id)).slice(0, 4) : [];
    } catch { return []; }
  }
  function addToRecents(id) {
    if (!findItem(id)) return;
    let r = loadRecents().filter(x => x !== id);
    r.unshift(id); r = r.slice(0, 4);
    localStorage.setItem('mk_recents', JSON.stringify(r));
  }

  /* ══════════════════════ INIT ══════════════════════ */
  window.initKonsol = function () {
    const oldNav = document.getElementById('bottomNav');
    if (oldNav) oldNav.style.display = 'none';
    const oldDk  = document.getElementById('dynamicKonsol');
    if (oldDk)  oldDk.remove();
    const oldShow = document.getElementById('dkShowBtn');
    if (oldShow) oldShow.remove();

    buildKonsol();

    const orig = window.switchTab;
    window.switchTab = function (tab) {
      if (typeof orig === 'function') orig(tab);
      setActive(tab);
    };

    // Mevcut aktif sekmeyi highlight et
    setActive(window.GZ?.currentTab || 'dukkan');
  };

})();


/* ══════════════════════════════════════════════════════════════
   GÜVENLİK & ANTI-CHEAT SİSTEMİ
   ══════════════════════════════════════════════════════════════ */

(function AntiCheat() {

  // 1. Render fonksiyonlarını try-catch ile sar (sonsuz spinner önleme)
  const renderKeys = Object.keys(window).filter(k => k.startsWith('render') && typeof window[k] === 'function');
  renderKeys.forEach(key => {
    const orig = window[key];
    window[key] = async function(...args) {
      try {
        return await orig.apply(this, args);
      } catch(e) {
        console.warn(`[${key}] Hata:`, e?.message || e);
        const main = document.getElementById('appMain');
        if (main && main.innerHTML.includes('spinner')) {
          main.innerHTML = `<div class="empty-state">
            <span class="emoji">⚠️</span>
            <h3>Sayfa yüklenemedi</h3>
            <p style="font-size:12px;color:#64748b">${e?.message || 'Bir hata oluştu'}</p>
            <button class="btn-primary" style="margin-top:12px" onclick="switchTab('dukkan')">🏪 Ana Sayfaya Dön</button>
          </div>`;
        }
      }
    };
  });

  // 2. addCash / spendCash koruması - sunucu doğrulaması
  const _origAddCash = window.addCash;
  window.addCash = async function(uid, amount, reason) {
    // Tutar doğrulama
    if (typeof amount !== 'number' || isNaN(amount) || amount <= 0) return false;
    if (amount > 999_000_000) { // 999M üstü tek seferde şüpheli
      console.warn('[AntiCheat] Şüpheli addCash:', amount, reason);
      if (window.GZ?.data?.isFounder !== true) return false;
    }
    return _origAddCash ? _origAddCash(uid, amount, reason) : false;
  };

  // 3. addXP koruması - sadece internal
  const _origAddXP = window.addXP;
  window.addXP = async function(uid, amount) {
    amount = Math.floor(Math.abs(amount || 0));
    if (!uid || amount <= 0 || amount > 50000) return; // Max 50k XP/çağrı
    return _origAddXP ? _origAddXP(uid, amount) : null;
  };

  // 4. Para hilesi tespiti — bakiye aniden çok artarsa bildirim
  let lastKnownMoney = 0;
  setInterval(async () => {
    if (!window.GZ?.uid || !window.db) return;
    try {
      const money = window.GZ?.data?.money || 0;
      if (lastKnownMoney > 0 && money > lastKnownMoney * 5 && money - lastKnownMoney > 500000) {
        // 5 dakikada bakiye 5 katına çıktı ve fark 500k+ ise şüpheli
        console.warn('[AntiCheat] Şüpheli para artışı:', lastKnownMoney, '->', money);
        await window.db.ref(`security/${window.GZ.uid}/suspicious`).push({
          type: 'money_spike', from: lastKnownMoney, to: money, ts: Date.now()
        }).catch(() => {});
      }
      lastKnownMoney = money;
    } catch(e) {}
  }, 5 * 60 * 1000); // 5 dakikada bir kontrol

  // 5. Banlı kullanıcı kontrolü — her 10 dakikada bir
  setInterval(async () => {
    if (!window.GZ?.uid || !window.db) return;
    try {
      const banned = await window.db.ref(`users/${window.GZ.uid}/banned`).once('value').then(s => s.val());
      if (banned === true) {
        // Banlı kullanıcı tespit edildi
        window.GZ.uid = null;
        window.GZ.data = null;
        document.getElementById('gameScreen')?.classList.remove('active');
        document.getElementById('authScreen')?.classList.add('active');
        alert('❌ Hesabınız yasaklanmıştır. Detaylar için destek ekibiyle iletişime geçin.');
      }
    } catch(e) {}
  }, 10 * 60 * 1000);

  console.log('[AntiCheat] ✅ Güvenlik sistemi aktif — render koruması, para doğrulama, ban kontrolü');
})();


/* ══════════════════════════════════════════════════════════════
   GELİŞMİŞ ANTİ-CHEAT: İŞLETME BAZLI KAZANÇ TARAMASI
   ══════════════════════════════════════════════════════════════ */

(function AdvancedAntiCheat() {

  // Seviyeye göre günlük MAX kazanç eşikleri (%50 toleranslı)
  function getMaxDailyEarning(lv, shopCount, shopLevel) {
    const TICK_PER_HOUR  = 20;          // 3dk tick
    const basePrice      = 10 + lv * 0.5;
    const maxDemand      = 1.4;         // ucuz fiyatta max talep
    const reyonCount     = 3;           // ortalama reyon
    const hourlyMax = TICK_PER_HOUR * maxDemand * shopLevel * reyonCount * shopCount * basePrice;
    return hourlyMax * 24 * 1.5;        // 24 saat × %50 tolerans
  }

  // Oyuncunun işletmelerini analiz et
  async function analyzePlayerEarnings(uid) {
    try {
      const [userData, shops, bank] = await Promise.all([
        window.dbGet?.(`users/${uid}`).catch(()=>({})) || {},
        window.dbGet?.(`businesses/${uid}/shops`).catch(()=>({})) || {},
        window.dbGet?.(`bank/${uid}`).catch(()=>({})) || {},
      ]);

      const lv         = userData.level || 1;
      const shopList   = Object.values(shops || {});
      const shopCount  = shopList.length;
      const avgShopLv  = shopCount > 0
        ? shopList.reduce((s, sh) => s + (sh.level || 1), 0) / shopCount
        : 1;

      // Günlük kazanç takibi
      const dailyEarning = userData.dailyEarning || 0;
      const maxAllowed   = getMaxDailyEarning(lv, shopCount || 1, avgShopLv);

      const ratio = dailyEarning / maxAllowed;

      let suspicious = false;
      let reason = '';

      // Kural 1: Günlük kazanç limiti aşıldı mı?
      if (ratio > 1.0 && dailyEarning > 10000) {
        suspicious = true;
        reason = `Günlük kazanç (${Math.round(dailyEarning).toLocaleString('tr-TR')}₺) maksimum sınırı (${Math.round(maxAllowed).toLocaleString('tr-TR')}₺) aştı. Oran: ${ratio.toFixed(1)}x`;
      }

      // Kural 2: Para aniden çok arttı mı? (son 1 saatte)
      const moneyHistory = userData.moneyHistory || {};
      const historyArr   = Object.values(moneyHistory).sort((a,b) => b.ts - a.ts);
      if (historyArr.length >= 2) {
        const latest  = historyArr[0].money || 0;
        const hourAgo = historyArr.find(h => Date.now() - h.ts > 3600000)?.money || 0;
        if (hourAgo > 0 && latest - hourAgo > maxAllowed / 24 * 3) {
          suspicious = true;
          reason = `1 saatte ${(latest - hourAgo).toLocaleString('tr-TR')}₺ artış — normal limitin 3 katı`;
        }
      }

      // Kural 3: Dükkanı yokken çok para var mı?
      if (shopCount === 0 && lv < 5 && (userData.money || 0) > 500000) {
        suspicious = true;
        reason = `Dükkan yok, Lv${lv}, ancak ${(userData.money||0).toLocaleString('tr-TR')}₺ para var`;
      }

      if (suspicious) {
        // Şüpheli log yaz
        await window.db?.ref(`security/${uid}/suspicious`).push({
          type:   'earning_anomaly',
          reason,
          lv,
          shopCount,
          dailyEarning,
          maxAllowed,
          money: userData.money || 0,
          ts: Date.now(),
        }).catch(() => {});

        // Uyarı sayısını artır
        const warnRef  = window.db?.ref(`security/${uid}/warnCount`);
        const warnSnap = await warnRef?.once('value').catch(() => null);
        const warns    = (warnSnap?.val() || 0) + 1;
        await warnRef?.set(warns).catch(() => {});

        // 3 uyarı = otomatik ban (admin onayına gönder)
        if (warns >= 3) {
          await window.db?.ref(`users/${uid}/banned`).set(true).catch(() => {});
          await window.db?.ref(`users/${uid}/banReason`).set(
            `Otomatik ban: Hile şüphesi (${warns} uyarı). Sebep: ${reason}`
          ).catch(() => {});
          await window.db?.ref(`adminAlerts/autoBan_${uid}`).set({
            uid, reason, warns, ts: Date.now(), money: userData.money
          }).catch(() => {});
          console.warn('[AntiCheat] Otomatik ban:', uid, reason);
        }
      }

      return { suspicious, ratio, dailyEarning, maxAllowed };
    } catch(e) {
      console.warn('[AntiCheat] analyzePlayerEarnings hata:', e?.message);
    }
  }

  // Para günlük birikimini takip et (addCash her çağrıldığında)
  const _origAddCashAC = window.addCash;
  window.addCash = async function(uid, amount, reason) {
    const result = await (_origAddCashAC ? _origAddCashAC(uid, amount, reason) : false);
    if (result && uid && amount > 0 && uid === window.GZ?.uid) {
      // Günlük kazanç sayacını artır
      const todayKey = new Date().toISOString().slice(0, 10); // 2025-01-15
      window.db?.ref(`users/${uid}/dailyEarning`).transaction(c => (c || 0) + amount).catch(() => {});
      // Gece yarısı sıfırlama için son güncelleme gününü kaydet
      window.db?.ref(`users/${uid}/dailyEarningDate`).set(todayKey).catch(() => {});
    }
    return result;
  };

  // Günlük kazanç sıfırlama — her gece 00:00'da
  function scheduleDailyReset() {
    const now  = new Date();
    const next = new Date(now);
    next.setDate(next.getDate() + 1);
    next.setHours(0, 0, 0, 0);
    const msUntilMidnight = next - now;
    setTimeout(async () => {
      if (window.GZ?.uid) {
        await window.db?.ref(`users/${window.GZ.uid}/dailyEarning`).set(0).catch(() => {});
      }
      scheduleDailyReset(); // Sonraki gün için tekrar planla
    }, msUntilMidnight);
  }
  scheduleDailyReset();

  // Her 30 dakikada bir tarama yap
  setInterval(async () => {
    if (!window.GZ?.uid) return;
    const result = await analyzePlayerEarnings(window.GZ.uid);
    if (result?.suspicious) {
      console.warn('[AntiCheat] ⚠️ Şüpheli aktivite tespit edildi');
    }
  }, 30 * 60 * 1000);

  // İlk giriş taraması (5 saniye sonra)
  setTimeout(() => {
    if (window.GZ?.uid) analyzePlayerEarnings(window.GZ.uid).catch(() => {});
  }, 5000);

  console.log('[AntiCheat] ✅ Gelişmiş kazanç taraması aktif — 30dk aralıklı, seviye bazlı eşik');

})();
