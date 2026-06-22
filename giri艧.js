/* ==========================================================================
   giriş.js — TAM PROFESYONEl GÜVENLİK PAKETİ
   ─────────────────────────────────────────────────────────────────────────
   KATMAN 1 : Cihaz Parmak İzi + Şüpheli Giriş E-posta Uyarısı
   KATMAN 2 : E-posta Değişikliği Re-Auth Koruması
   KATMAN 3 : Şüpheli Giriş Firebase Notification (anlık bildirim)
   KATMAN 4 : SMS 2FA (Firebase Phone Auth)
   EKSTRA   : Rate Limiting · Geçici Mail Engeli · Şifre Güç Göstergesi
              Oturum Zaman Aşımı · Şifre Göster/Gizle · reCAPTCHA
   ========================================================================== */

(function () {

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
  const LOGIN_WIN = 15 * 60 * 1000; // 15 dk

  function checkLoginRL(email) {
    const key = 'lr_' + btoa(email).slice(0, 20);
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
  function clearLoginRL(email) {
    localStorage.removeItem('lr_' + btoa(email).slice(0, 20));
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
     KATMAN 1 — CİHAZ KAYDI & ŞÜPHELİ GİRİŞ TESPİTİ
     ══════════════════════════════════════════════════════════════════════ */

  async function recordDevice(uid) {
    const fp = getDeviceFingerprint();
    const knownKey = 'kfp_' + uid;
    const known = JSON.parse(localStorage.getItem(knownKey) || '[]');
    const isNew = !known.includes(fp);
    const label = getDeviceLabel();
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';

    // Firebase'e giriş logu
    try {
      await db.ref('security/logins/' + uid).push({
        fp, label, tz,
        ua: navigator.userAgent.slice(0, 180),
        ts: firebase.database.ServerValue.TIMESTAMP,
        isNewDevice: isNew
      });

      if (isNew) {
        // ── KATMAN 3: Anlık güvenlik bildirimi (oyun içi) ──
        await db.ref('notifs/' + uid).push({
          type: 'security',
          icon: '🔐',
          title: 'Yeni Cihazdan Giriş Algılandı',
          body: label + ' adlı cihazdan hesabına giriş yapıldı. Sen değilsen şifreni hemen değiştir!',
          ts: firebase.database.ServerValue.TIMESTAMP,
          read: false
        });

        // ── KATMAN 3: E-posta bildirimi (Firebase Email Action) ──
        // Not: Şüpheli giriş e-postası Firebase Functions ile gönderilir.
        // Aşağıdaki flag Functions tarafından dinlenir ve tetikler.
        await db.ref('security/alerts/' + uid).push({
          type: 'new_device',
          label, tz,
          ts: firebase.database.ServerValue.TIMESTAMP,
          handled: false
        });

        // Bilinen cihazlara ekle
        known.push(fp);
        if (known.length > 15) known.shift();
        localStorage.setItem(knownKey, JSON.stringify(known));

        toast('🔐 Yeni cihazdan giriş! Bildirim e-postana gönderildi.', 'warn', 5000);
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
    const map = { login: 'loginPanel', register: 'registerPanel', verify: 'verifyPanel', forgot: 'forgotPanel' };
    const el = document.getElementById(map[name]);
    if (el) el.classList.add('active');
  }

  // Toggle butonları
  setTimeout(() => {
    addPassToggle('loginPass');
    addPassToggle('regPass');
    addPassToggle('regPass2');
  }, 400);

  // Şifre güç barı
  document.addEventListener('input', e => {
    if (e.target.id !== 'regPass') return;
    const s = passStrength(e.target.value);
    let bar = document.getElementById('psBar');
    let lbl = document.getElementById('psLbl');
    if (!bar) {
      bar = Object.assign(document.createElement('div'), { id: 'psBar' });
      bar.style.cssText = 'height:4px;border-radius:2px;transition:.3s;margin-top:4px;width:0%';
      e.target.parentElement.appendChild(bar);
      lbl = Object.assign(document.createElement('div'), { id: 'psLbl' });
      lbl.style.cssText = 'font-size:11px;margin-top:2px;font-weight:600';
      e.target.parentElement.appendChild(lbl);
    }
    const cols = ['#dc2626', '#ef4444', '#f59e0b', '#16a34a', '#15803d', '#0d5c32'];
    const labs = ['Çok Zayıf', 'Zayıf', 'Orta', 'İyi', 'Güçlü', 'Çok Güçlü'];
    bar.style.background = cols[s]; bar.style.width = (s * 20) + '%';
    lbl.textContent = labs[s]; lbl.style.color = cols[s];
  });

  /* ══════════════════════════════════════════════════════════════════════
     KAYIT
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
      const fp = getDeviceFingerprint();

      // 20.000 TL başlangıç
      await dbSet('users/' + uid, {
        username, usernameLower: username.toLowerCase(), email,
        level: 1, xp: 0, money: 20000, diamonds: 10,
        location: 'İstanbul', online: true,
        lastSeen: firebase.database.ServerValue.TIMESTAMP,
        createdAt: firebase.database.ServerValue.TIMESTAMP,
        banned: false, verified: false, bio: '', netWorth: 20000,
        twoFactorEnabled: false,    // SMS 2FA başlangıçta kapalı
        registrationFp: fp,
        registrationUa: navigator.userAgent.slice(0, 180)
      });
      await dbSet('usernames/' + username.toLowerCase(), uid);
      await dbSet('bank/' + uid, {
        balance: 0, investment: 0, investmentDate: now(), loan: 0,
        nextBusinessExpense: now() + 7 * 24 * 3600 * 1000,
        nextSalary: now() + 7 * 24 * 3600 * 1000
      });

      // İlk cihaz kaydı
      await db.ref('security/logins/' + uid).push({
        fp, label: getDeviceLabel(), ua: navigator.userAgent.slice(0, 180),
        ts: firebase.database.ServerValue.TIMESTAMP, type: 'register'
      });
      localStorage.setItem('kfp_' + uid, JSON.stringify([fp]));

      await cred.user.sendEmailVerification({
        url: window.location.origin + window.location.pathname + '?verified=1'
      });

      $('#verifyEmailText').textContent = email + ' adresine doğrulama bağlantısı gönderdik.';
      showPanel('verify');
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
     GİRİŞ (Rate Limit + Cihaz Kaydı)
     ══════════════════════════════════════════════════════════════════════ */

  $('#btnLogin').addEventListener('click', async () => {
    const email = $('#loginEmail').value.trim().toLowerCase();
    const pass = $('#loginPass').value;
    if (!email || !pass) return toast('E-posta ve şifre gir', 'error');

    const rl = checkLoginRL(email);
    if (rl.blocked) return toast('Hesap ' + rl.wait + ' dakika kilitli. Şifreni sıfırlamayı dene.', 'error');

    const btn = $('#btnLogin');
    btn.disabled = true; btn.textContent = 'Giriş yapılıyor...';

    try {
      const cred = await auth.signInWithEmailAndPassword(email, pass);
      clearLoginRL(email);

      // SMS 2FA aktif mi?
      const twoFA = await dbGet('users/' + cred.user.uid + '/twoFactorEnabled');
      if (twoFA) {
        // Giriş başarılı ama 2FA bekleniyor
        GZ._pendingUser = cred.user;
        await auth.signOut(); // geçici çıkış, 2FA onaylanınca tekrar girecek
        show2FAVerify(email, pass);
      } else {
        await recordDevice(cred.user.uid);
        updateActivity();
      }
    } catch (e) {
      const msgs = {
        'auth/wrong-password': 'Şifre yanlış (kalan deneme: ' + (rl.left - 1) + ')',
        'auth/invalid-credential': 'E-posta veya şifre yanlış (kalan: ' + (rl.left - 1) + ')',
        'auth/user-not-found': 'Bu e-posta kayıtlı değil',
        'auth/too-many-requests': 'Firebase hesabı geçici kilitlendi. Şifreni sıfırla.',
        'auth/user-disabled': 'Hesabınız devre dışı bırakılmıştır.'
      };
      toast(msgs[e.code] || 'Giriş başarısız', 'error');
    }
    btn.disabled = false; btn.textContent = 'Giriş Yap';
  });

  /* ══════════════════════════════════════════════════════════════════════
     KATMAN 4 — SMS 2FA (Firebase Phone Auth)
     ══════════════════════════════════════════════════════════════════════ */

  let recaptchaVerifier = null;
  let confirmationResult = null;

  // reCAPTCHA başlat (invisible)
  function initRecaptcha(containerId) {
    if (recaptchaVerifier) { try { recaptchaVerifier.clear(); } catch (e) {} }
    recaptchaVerifier = new firebase.auth.RecaptchaVerifier(containerId, {
      size: 'invisible',
      callback: () => {}
    });
  }

  // 2FA kurulum paneli — profil ayarlarından çağrılır
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
    `);

    setTimeout(() => {
      document.getElementById('btnSend2FA')?.addEventListener('click', async () => {
        const cc = document.getElementById('phoneCC').value;
        const num = document.getElementById('phoneNum').value.replace(/\D/g, '');
        if (num.length < 9) return toast('Geçerli bir telefon numarası gir', 'error');
        const phone = cc + num;

        try {
          initRecaptcha('recaptcha2fa');
          const btn = document.getElementById('btnSend2FA');
          btn.disabled = true; btn.textContent = 'Gönderiliyor...';

          confirmationResult = await firebase.auth().signInWithPhoneNumber(phone, recaptchaVerifier);

          // Kod giriş paneli
          const modal = document.querySelector('.modal-body');
          if (modal) modal.innerHTML = `
            <div class="security-notice">
              <div class="sec-icon">📨</div>
              <p>${phone} numarasına 6 haneli kod gönderdik.</p>
            </div>
            <div class="input-group">
              <label>SMS Kodu</label>
              <input type="number" id="smsCodeInput" placeholder="000000" maxlength="6" style="font-size:24px;text-align:center;letter-spacing:8px">
            </div>
            <button class="btn-primary" id="btnVerify2FA" style="width:100%">Kodu Doğrula & 2FA Aktifleştir</button>
          `;

          document.getElementById('btnVerify2FA')?.addEventListener('click', async () => {
            const code = document.getElementById('smsCodeInput').value.trim();
            if (code.length !== 6) return toast('6 haneli kodu gir', 'error');
            try {
              await confirmationResult.confirm(code);
              // 2FA başarıyla doğrulandı — Firebase kullanıcısına kaydet
              await dbUpdate('users/' + GZ.uid, {
                twoFactorEnabled: true,
                twoFactorPhone: phone.replace(/\d(?=\d{4})/g, '*'), // maskeli kayıt
                twoFactorPhoneRaw: phone // tam numara (2FA giriş akışı için)
              });
              toast('✅ SMS 2FA aktif! Hesabın artık çok daha güvende.', 'success', 5000);
              closeModal();
            } catch (e) {
              toast('Kod yanlış veya süresi dolmuş', 'error');
            }
          });

        } catch (e) {
          console.error(e);
          toast('SMS gönderilemedi: ' + (e.message || 'bilinmeyen hata'), 'error');
          const btn = document.getElementById('btnSend2FA');
          if (btn) { btn.disabled = false; btn.textContent = 'SMS Kodu Gönder'; }
        }
      });
    }, 100);
  };

  // 2FA devre dışı bırak
  window.disable2FA = async function () {
    if (!confirm('SMS 2FA\'yı devre dışı bırakmak istediğinden emin misin? Hesabın daha az güvende olacak.')) return;
    await dbUpdate('users/' + GZ.uid, { twoFactorEnabled: false, twoFactorPhone: null });
    toast('2FA devre dışı bırakıldı', 'warn');
  };

  // Giriş sırasında 2FA kodu sor
  function show2FAVerify(email, pass) {
    showModal('📱 SMS Doğrulama', `
      <div class="security-notice">
        <div class="sec-icon">🔐</div>
        <p>Hesabında iki adımlı doğrulama aktif. Telefon numarana gelen 6 haneli kodu gir.</p>
      </div>
      <div id="recaptchaLogin"></div>
      <div class="input-group">
        <label>Kayıtlı Telefona SMS Gönder</label>
        <button class="btn-secondary" id="btnSendLoginSMS" style="width:100%">📨 SMS Kodu Gönder</button>
      </div>
      <div class="input-group" id="smsInputWrap" style="display:none">
        <label>SMS Kodu (6 hane)</label>
        <input type="number" id="loginSmsCode" placeholder="000000" maxlength="6" style="font-size:22px;text-align:center;letter-spacing:6px">
      </div>
      <button class="btn-primary" id="btnConfirmLoginSMS" style="width:100%;display:none">Doğrula & Giriş Yap</button>
      <button class="btn-link" onclick="closeModal()" style="width:100%">İptal</button>
    `);

    setTimeout(async () => {
      // Kullanıcının maskeli telefonunu göster
      try {
        // Telefon numarasını çek (kayıtlı varsa)
        const cred2 = await auth.signInWithEmailAndPassword(email, pass);
        const phone = await dbGet('users/' + cred2.user.uid + '/twoFactorPhone') || 'kayıtlı numaran';
        await auth.signOut();
        const lbl = document.querySelector('#btnSendLoginSMS');
        if (lbl) lbl.textContent = '📨 ' + phone + ' numarasına SMS Gönder';

        document.getElementById('btnSendLoginSMS')?.addEventListener('click', async () => {
          try {
            initRecaptcha('recaptchaLogin');
            // Telefon numarasını al (geçici giriş ile)
            const cred3 = await auth.signInWithEmailAndPassword(email, pass);
            const fullPhone = await dbGet('users/' + cred3.user.uid + '/twoFactorPhoneRaw');
            await auth.signOut();

            if (!fullPhone) {
              await auth.signInWithEmailAndPassword(email, pass);
              toast('2FA kaydı bulunamadı, normal girişe geçildi.', 'warn');
              closeModal();
              return;
            }

            confirmationResult = await firebase.auth().signInWithPhoneNumber(fullPhone, recaptchaVerifier);
            document.getElementById('smsInputWrap').style.display = 'block';
            document.getElementById('btnConfirmLoginSMS').style.display = 'block';
            document.getElementById('btnSendLoginSMS').textContent = '✅ Gönderildi';
            document.getElementById('btnSendLoginSMS').disabled = true;
            toast('SMS gönderildi 📨', 'success');
          } catch (e) {
            toast('SMS gönderilemedi: ' + (e.message || ''), 'error');
          }
        });

        document.getElementById('btnConfirmLoginSMS')?.addEventListener('click', async () => {
          const code = document.getElementById('loginSmsCode').value.trim();
          if (code.length !== 6) return toast('6 haneli kodu gir', 'error');
          try {
            await confirmationResult.confirm(code);
            // SMS doğrulandı, şimdi e-posta ile tam giriş
            await auth.signInWithEmailAndPassword(email, pass);
            closeModal();
            toast('✅ İki adımlı doğrulama başarılı!', 'success');
          } catch (e) {
            toast('Kod yanlış veya süresi dolmuş', 'error');
          }
        });

      } catch (e) {
        toast('Hata: ' + (e.message || ''), 'error');
      }
    }, 150);
  }

  /* ══════════════════════════════════════════════════════════════════════
     ŞİFREMİ UNUTTUM
     ══════════════════════════════════════════════════════════════════════ */

  $('#btnForgot').addEventListener('click', () => {
    $('#forgotEmail').value = $('#loginEmail').value;
    showPanel('forgot');
  });
  $('#btnForgotBack').addEventListener('click', () => showPanel('login'));
  $('#btnForgotSend').addEventListener('click', async () => {
    const email = $('#forgotEmail').value.trim().toLowerCase();
    if (!email) return toast('E-posta gir', 'error');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return toast('Geçersiz e-posta', 'error');
    try {
      await auth.sendPasswordResetEmail(email, {
        url: window.location.origin + window.location.pathname + '?reset=1'
      });
      toast('✅ Şifre sıfırlama bağlantısı gönderildi.', 'success');
      setTimeout(() => showPanel('login'), 2000);
    } catch (e) {
      toast(e.code === 'auth/user-not-found' ? 'Bu e-posta kayıtlı değil' : 'Gönderim hatası', 'error');
    }
  });

  /* ══════════════════════════════════════════════════════════════════════
     KATMAN 2 — E-POSTA DEĞİŞİKLİĞİ RE-AUTH KORUMASI
     ══════════════════════════════════════════════════════════════════════ */

  window.changeEmail = async function () {
    showModal('✉️ E-posta Değiştir', `
      <div class="security-notice warn">
        <div class="sec-icon">⚠️</div>
        <p>E-posta değiştirmek yüksek güvenlik gerektiren bir işlemdir. Mevcut şifrenle kimliğini doğrulamalısın.</p>
      </div>
      <div class="input-group">
        <label>Mevcut Şifreni Gir</label>
        <input type="password" id="reAuthPass" placeholder="Mevcut şifren">
      </div>
      <div class="input-group">
        <label>Yeni E-posta Adresi</label>
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
        if (!isEmailAllowed(newEmail)) return toast('Geçici e-posta servisleri kabul edilmiyor', 'error');
        if (newEmail === auth.currentUser.email) return toast('Bu zaten mevcut e-posta adresin', 'warn');

        const btn = document.getElementById('btnChangeEmail');
        btn.disabled = true; btn.textContent = 'Doğrulanıyor...';

        try {
          // RE-AUTH: Şifre ile kimlik doğrula
          const credential = firebase.auth.EmailAuthProvider.credential(
            auth.currentUser.email, pass
          );
          await auth.currentUser.reauthenticateWithCredential(credential);

          // Kimlik doğrulandı — e-postayı güncelle
          await auth.currentUser.updateEmail(newEmail);
          await auth.currentUser.sendEmailVerification({
            url: window.location.origin + window.location.pathname + '?verified=1'
          });

          // DB'yi güncelle
          await dbUpdate('users/' + GZ.uid, { email: newEmail, verified: false });

          // Güvenlik logu
          await db.ref('security/emailChanges/' + GZ.uid).push({
            oldEmail: auth.currentUser.email,
            newEmail,
            ts: firebase.database.ServerValue.TIMESTAMP
          });

          toast('✅ E-posta güncellendi! Yeni adresini doğrula.', 'success', 5000);
          closeModal();
          setTimeout(() => auth.signOut(), 2000);
        } catch (e) {
          if (e.code === 'auth/wrong-password') toast('Şifre yanlış', 'error');
          else if (e.code === 'auth/requires-recent-login') toast('Oturumun süresi dolmuş. Tekrar giriş yap.', 'error');
          else if (e.code === 'auth/email-already-in-use') toast('Bu e-posta başka hesapta kullanılıyor', 'error');
          else toast('Hata: ' + (e.message || ''), 'error');
        }
        btn.disabled = false; btn.textContent = 'E-postayı Değiştir';
      });
    }, 100);
  };

  /* Şifre Değiştir — Re-Auth ile */
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
          toast('✅ Şifre başarıyla değiştirildi!', 'success');
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
     DOĞRULAMA PANELİ
     ══════════════════════════════════════════════════════════════════════ */

  $('#btnVerifyCheck').addEventListener('click', async () => {
    if (!auth.currentUser) return showPanel('login');
    await auth.currentUser.reload();
    if (auth.currentUser.emailVerified) {
      await dbUpdate('users/' + auth.currentUser.uid, { verified: true });
      toast('✅ Hesabın doğrulandı! Hoş geldin.', 'success');
      enterGame();
    } else {
      toast('E-posta henüz doğrulanmamış. Gelen kutusunu ve spam klasörünü kontrol et.', 'warn');
    }
  });

  $('#btnVerifyResend').addEventListener('click', async () => {
    if (!auth.currentUser) return;
    try {
      await auth.currentUser.sendEmailVerification({
        url: window.location.origin + window.location.pathname + '?verified=1'
      });
      toast('📧 Doğrulama e-postası tekrar gönderildi.', 'success');
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
    if (!user) {
      authScreen.classList.add('active');
      gameScreen.classList.remove('active');
      banScreen.classList.remove('active');
      splash.classList.add('hidden');
      GZ.user = null; GZ.uid = null;
      return;
    }

    GZ.user = user; GZ.uid = user.uid;
    checkSessionTimeout();

    if (!user.emailVerified) {
      $('#verifyEmailText').textContent = user.email + ' adresine doğrulama bağlantısı gönderildi.';
      authScreen.classList.add('active');
      gameScreen.classList.remove('active');
      showPanel('verify');
      splash.classList.add('hidden');
      return;
    }

    let userData = await dbGet('users/' + user.uid);
    if (!userData) {
      const username = user.email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '').slice(0, 16) || 'Oyuncu';
      userData = {
        username, usernameLower: username.toLowerCase(), email: user.email,
        level: 1, xp: 0, money: 20000, diamonds: 10,
        location: 'İstanbul', online: true,
        lastSeen: firebase.database.ServerValue.TIMESTAMP,
        createdAt: firebase.database.ServerValue.TIMESTAMP,
        banned: false, verified: true, bio: '', netWorth: 20000,
        twoFactorEnabled: false
      };
      await dbSet('users/' + user.uid, userData);
    }

    if (await dbGet('users/' + user.uid + '/banned')) {
      authScreen.classList.remove('active');
      gameScreen.classList.remove('active');
      banScreen.classList.add('active');
      splash.classList.add('hidden');
      const reason = await dbGet('users/' + user.uid + '/banReason');
      if (reason) $('#banReason').textContent = reason;
      return;
    }

    if (!userData?.verified) await dbUpdate('users/' + user.uid, { verified: true });
    enterGame();
  });

  async function enterGame() {
    authScreen.classList.remove('active');
    banScreen.classList.remove('active');
    gameScreen.classList.add('active');
    setupPresence(GZ.uid);
    updateActivity();

    const userRef = db.ref('users/' + GZ.uid);
    const cb = userRef.on('value', s => {
      GZ.data = s.val() || {};
      renderTopbar();
      if (GZ.data.banned) location.reload();
    });
    GZ.listeners.push({ ref: userRef, cb });

    if (typeof initEkonomi === 'function') initEkonomi();
    if (typeof initUI === 'function') initUI();
    splash.classList.add('hidden');
  }

  function renderTopbar() {
    const d = GZ.data || {};
    $('#cashTxt').textContent = cashFmt(d.money || 0);
    $('#diaTxt').textContent = fmtInt(d.diamonds || 0);
    $('#lvlPill').textContent = 'Lv ' + (d.level || 1);
    const need = xpForLevel(d.level || 1);
    const pct = Math.min(100, Math.floor(((d.xp || 0) / need) * 100));
    $('#xpFill').style.width = pct + '%';
    $('#xpText').textContent = (d.xp || 0) + '/' + need;
  }

  setTimeout(() => { if (!auth.currentUser) splash.classList.add('hidden'); }, 1500);

})();
