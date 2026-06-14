// Firebase başlatma ve global yardımcılar
(function() {
  const cfg = window.FIREBASE_CONFIG;
  firebase.initializeApp(cfg);

  window.auth = firebase.auth();
  window.db   = firebase.database();

  // ── Yardımcı fonksiyonlar ────────────────────────────────────────────────
  window.dbGet = (path) => db.ref(path).once('value').then(s => s.val());

  window.dbSet = (path, val) => db.ref(path).set(val);

  window.dbUpdate = (path, val) => db.ref(path).update(val);

  window.dbPush = (path, val) => db.ref(path).push(val);

  window.dbTransaction = (path, fn) => db.ref(path).transaction(fn);

  window.serverTime = () => firebase.database.ServerValue.TIMESTAMP;

  // ── Toast bildirimi ──────────────────────────────────────────────────────
  window.toast = function(msg, type = 'info', duration = 3500) {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    const icons = { success:'✅', error:'❌', warning:'⚠️', info:'ℹ️' };
    el.innerHTML = `<span class="toast-icon">${icons[type]||'ℹ️'}</span><span>${msg}</span>`;
    container.appendChild(el);
    setTimeout(() => el.classList.add('show'), 10);
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 400);
    }, duration);
  };

  // ── Para işlemleri ───────────────────────────────────────────────────────
  window.addCash = async function(uid, amount, reason = '') {
    // Anti-hile: sayısal doğrulama
    if (!Number.isFinite(amount)) throw new Error('Geçersiz işlem miktarı');
    if (Math.abs(amount) > 1e9) {
      dbPush('admin/suspiciousLog', {
        type: 'limit_exceeded', uid, amount, reason, time: Date.now(),
        msg: '1 milyar üzeri işlem engellendi'
      });
      throw new Error('İşlem miktarı çok büyük');
    }
    // 500K üzeri işlemleri logluyoruz (admin işlemleri dahil)
    if (Math.abs(amount) > 500000) {
      dbPush('admin/suspiciousLog', {
        type: 'large_tx', uid, amount, reason, time: Date.now(),
        msg: '500K üzeri işlem'
      });
    }
    const ref = db.ref(`users/${uid}/cash`);
    await ref.transaction(cur => (cur || 0) + amount);
    if (reason) {
      await dbPush(`users/${uid}/transactions`, {
        type: amount >= 0 ? 'gelir' : 'gider',
        amount,
        reason,
        time: serverTime()
      });
    }
  };

  window.spendCash = async function(uid, amount, reason = '') {
    const snap = await dbGet(`users/${uid}/cash`);
    if ((snap || 0) < amount) throw new Error('Yetersiz bakiye');
    await addCash(uid, -amount, reason);
  };

  window.addDiamond = async function(uid, amount) {
    await db.ref(`users/${uid}/diamonds`).transaction(cur => (cur || 0) + amount);
  };

  // ── Envanter işlemleri ───────────────────────────────────────────────────
  window.addItem = async function(uid, itemId, qty = 1) {
    const ref = db.ref(`users/${uid}/inventory/${itemId}`);
    await ref.transaction(cur => (cur || 0) + qty);
  };

  window.removeItem = async function(uid, itemId, qty = 1) {
    const snap = await dbGet(`users/${uid}/inventory/${itemId}`);
    if ((snap || 0) < qty) throw new Error('Envanterde yeterli ürün yok');
    await db.ref(`users/${uid}/inventory/${itemId}`).transaction(cur => (cur || 0) - qty);
  };

  // ── XP & Seviye ──────────────────────────────────────────────────────────
  window.addXP = async function(uid, xp) {
    const ref = db.ref(`users/${uid}`);
    await ref.transaction(u => {
      if (!u) return u;
      u.xp = (u.xp || 0) + xp;
      while (u.xp >= levelThreshold(u.level || 1)) {
        u.xp -= levelThreshold(u.level || 1);
        u.level = (u.level || 1) + 1;
      }
      return u;
    });
  };

  window.levelThreshold = (lvl) => Math.floor(100 * Math.pow(1.15, lvl - 1));

  // ── Zaman biçimlendirme ──────────────────────────────────────────────────
  window.timeAgo = function(ts) {
    const diff = Date.now() - ts;
    if (diff < 60000) return 'Az önce';
    if (diff < 3600000) return `${Math.floor(diff/60000)} dk önce`;
    if (diff < 86400000) return `${Math.floor(diff/3600000)} sa önce`;
    return `${Math.floor(diff/86400000)} gün önce`;
  };

  window.formatMoney = function(n) {
    if (!n && n !== 0) return '0 ₺';
    if (Math.abs(n) >= 1e9) return (n/1e9).toFixed(1) + 'B ₺';
    if (Math.abs(n) >= 1e6) return (n/1e6).toFixed(1) + 'M ₺';
    if (Math.abs(n) >= 1e3) return (n/1e3).toFixed(1) + 'K ₺';
    return n.toLocaleString('tr-TR') + ' ₺';
  };

  window.formatNum = function(n) {
    if (!n && n !== 0) return '0';
    return Number(n).toLocaleString('tr-TR');
  };

  console.log('%c[GameZone ERP] 🔥 Firebase başlatıldı', 'color:#f97316;font-weight:bold');
})();
/* ═══════════════════════════════════════════════════════════
   GİRİŞ / KAYIT / ŞİFRE SIFIRLAMA
   ═══════════════════════════════════════════════════════════ */
(function() {

  let currentAuthTab = 'login';

  // ── Tab geçişi ───────────────────────────────────────────────
  window.switchAuthTab = function(tab) {
    currentAuthTab = tab;
    document.querySelectorAll('.auth-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    document.querySelectorAll('.auth-panel').forEach(p => p.classList.toggle('active', p.id === `panel-${tab}`));
    clearErrors();
  };

  function clearErrors() {
    document.querySelectorAll('.form-error').forEach(e => { e.textContent = ''; e.classList.remove('show'); });
  }

  function showError(id, msg) {
    const el = document.getElementById(id);
    if (el) { el.textContent = msg; el.classList.add('show'); }
  }

  function setLoading(btn, loading) {
    btn.disabled = loading;
    btn.dataset.orig = btn.dataset.orig || btn.textContent;
    btn.textContent = loading ? '⏳ Lütfen bekle...' : btn.dataset.orig;
  }

  // ── Şifre göster/gizle ──────────────────────────────────────
  window.togglePassword = function(inputId, btn) {
    const inp = document.getElementById(inputId);
    if (!inp) return;
    if (inp.type === 'password') { inp.type = 'text'; btn.textContent = '🙈'; }
    else { inp.type = 'password'; btn.textContent = '👁️'; }
  };

  // ── GİRİŞ ───────────────────────────────────────────────────
  window.doLogin = async function() {
    clearErrors();
    const emailOrUser = document.getElementById('loginEmail').value.trim();
    const password    = document.getElementById('loginPassword').value;

    if (!emailOrUser) return showError('loginEmailErr', 'E-posta veya kullanıcı adı girin');
    if (!password)    return showError('loginPasswordErr', 'Şifre girin');

    const btn = document.getElementById('loginBtn');
    setLoading(btn, true);

    try {
      let email = emailOrUser;
      // Kullanıcı adı ile giriş desteği
      if (!email.includes('@')) {
        const snap = await dbGet(`usernames/${emailOrUser.toLowerCase()}`);
        if (!snap) { showError('loginEmailErr', 'Kullanıcı bulunamadı'); setLoading(btn, false); return; }
        email = snap;
      }
      await auth.signInWithEmailAndPassword(email, password);
      // onAuthStateChanged handle eder
    } catch(e) {
      const msgs = {
        'auth/wrong-password': 'Şifre yanlış',
        'auth/user-not-found': 'Bu e-posta kayıtlı değil',
        'auth/too-many-requests': 'Çok fazla başarısız deneme. Daha sonra tekrar deneyin',
        'auth/invalid-email': 'Geçersiz e-posta adresi',
        'auth/invalid-credential': 'E-posta veya şifre hatalı',
      };
      showError('loginEmailErr', msgs[e.code] || e.message);
      setLoading(btn, false);
    }
  };

  // ── KAYIT ────────────────────────────────────────────────────
  window.doRegister = async function() {
    clearErrors();
    const username = document.getElementById('regUsername').value.trim();
    const email    = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPassword').value;
    const confirm  = document.getElementById('regConfirm').value;

    if (!username || username.length < 3) return showError('regUsernameErr', 'Kullanıcı adı en az 3 karakter olmalı');
    if (!/^[a-zA-Z0-9_]+$/.test(username)) return showError('regUsernameErr', 'Sadece harf, rakam ve _ kullanılabilir');
    if (!email || !email.includes('@')) return showError('regEmailErr', 'Geçerli bir e-posta girin');
    if (!password || password.length < 6) return showError('regPasswordErr', 'Şifre en az 6 karakter olmalı');
    if (password !== confirm) return showError('regConfirmErr', 'Şifreler eşleşmiyor');

    const btn = document.getElementById('registerBtn');
    setLoading(btn, true);

    try {
      // Kullanıcı adı müsaitlik kontrolü
      const taken = await dbGet(`usernames/${username.toLowerCase()}`);
      if (taken) { showError('regUsernameErr', 'Bu kullanıcı adı alınmış'); setLoading(btn, false); return; }

      const cred = await auth.createUserWithEmailAndPassword(email, password);
      const uid  = cred.user.uid;

      // Profil oluştur
      const now = Date.now();
      await dbSet(`users/${uid}`, {
        uid,
        username,
        usernameLower: username.toLowerCase(),
        email,
        cash: 5000,
        bank: 0,
        diamonds: 10,
        xp: 0,
        level: 1,
        avatar: username[0].toUpperCase(),
        createdAt: now,
        lastLogin: now,
        role: 'user',
        shop: { name: `${username}'ın Mağazası`, open: false },
        stats: { trades: 0, sales: 0, purchases: 0 },
        notifications: 0
      });

      // Kullanıcı adı index
      await dbSet(`usernames/${username.toLowerCase()}`, email);

      // Hoş geldin bildirimi
      await dbPush(`users/${uid}/notifs`, {
        title: '🎉 Hoş Geldin!',
        body: `GameZone ERP'ye hoş geldin ${username}! Başlangıç bonusu olarak 5.000 ₺ ve 10 💎 verildi.`,
        time: now, read: false
      });

      toast('Kayıt başarılı! Hoş geldin 🎉', 'success');
    } catch(e) {
      const msgs = {
        'auth/email-already-in-use': 'Bu e-posta zaten kullanılıyor',
        'auth/invalid-email': 'Geçersiz e-posta',
        'auth/weak-password': 'Şifre çok zayıf',
      };
      showError('regEmailErr', msgs[e.code] || e.message);
      setLoading(btn, false);
    }
  };

  // ── ANONİM GİRİŞ ────────────────────────────────────────────
  window.doAnonymous = async function() {
    const btn = document.getElementById('anonBtn');
    setLoading(btn, true);
    try {
      const cred = await auth.signInAnonymously();
      const uid  = cred.user.uid;
      const existing = await dbGet(`users/${uid}/uid`);
      if (!existing) {
        const guestName = 'Misafir' + Math.floor(Math.random() * 9999);
        await dbSet(`users/${uid}`, {
          uid, username: guestName, usernameLower: guestName.toLowerCase(),
          email: '', cash: 1000, bank: 0, diamonds: 0, xp: 0, level: 1,
          avatar: '👤', createdAt: Date.now(), lastLogin: Date.now(),
          role: 'guest', isAnonymous: true,
          shop: { name: `${guestName}'ın Mağazası`, open: false },
          stats: { trades: 0, sales: 0, purchases: 0 }
        });
      }
      toast('Misafir olarak giriş yapıldı', 'info');
    } catch(e) {
      toast('Giriş başarısız: ' + e.message, 'error');
      setLoading(btn, false);
    }
  };

  // ── ŞİFREMİ UNUTTUM ─────────────────────────────────────────
  window.doForgotPassword = async function() {
    clearErrors();
    const email = document.getElementById('forgotEmail').value.trim();
    if (!email || !email.includes('@')) return showError('forgotEmailErr', 'Geçerli bir e-posta girin');

    const btn = document.getElementById('forgotBtn');
    setLoading(btn, true);
    try {
      await auth.sendPasswordResetEmail(email);
      document.getElementById('forgotSuccess').style.display = 'block';
      toast('Şifre sıfırlama bağlantısı gönderildi', 'success');
    } catch(e) {
      const msgs = {
        'auth/user-not-found': 'Bu e-posta kayıtlı değil',
        'auth/invalid-email': 'Geçersiz e-posta',
      };
      showError('forgotEmailErr', msgs[e.code] || e.message);
    } finally {
      setLoading(btn, false);
    }
  };

  // ── AUTH STATE ───────────────────────────────────────────────
  auth.onAuthStateChanged(async (user) => {
    const loader = document.getElementById('appLoader');
    if (!user) {
      loader && (loader.style.display = 'none');
      document.getElementById('authScreen').classList.add('active');
      document.getElementById('appScreen').classList.remove('active');
      return;
    }
    // Kullanıcı verisini yükle
    const userData = await dbGet(`users/${user.uid}`);
    if (!userData) { auth.signOut(); return; }

    // ── BAN KONTROLÜ ─────────────────────────────────────────────
    if (userData.banned) {
      loader && (loader.style.display = 'none');
      const banScreen = document.getElementById('banScreen');
      if (banScreen) {
        banScreen.style.display = 'flex';
        const banMsg = document.getElementById('banMessage');
        if (banMsg) banMsg.textContent = userData.banReason
          ? `Yasak sebebi: ${userData.banReason}`
          : 'Hesabın yönetici tarafından askıya alınmıştır.';
      } else {
        alert('Hesabın banlıdır: ' + (userData.banReason || 'Belirtilmedi'));
      }
      auth.signOut();
      return;
    }

    window.ME = { ...userData, uid: user.uid, firebaseUser: user };

    // Son giriş güncelle
    dbUpdate(`users/${user.uid}`, { lastLogin: Date.now() });

    // Uygulama başlat
    loader && (loader.style.display = 'none');
    document.getElementById('authScreen').classList.remove('active');
    document.getElementById('appScreen').classList.add('active');

    if (typeof window.initApp === 'function') window.initApp();

    // login1 görevi
    if (typeof window.updateMissionProgress === 'function') {
      window.updateMissionProgress(user.uid, 'login1', 1);
    }
  });

  // ── ÇIKIŞ ────────────────────────────────────────────────────
  window.doLogout = async function() {
    if (!confirm('Çıkış yapmak istediğine emin misin?')) return;
    await auth.signOut();
    window.ME = null;
    toast('Çıkış yapıldı', 'info');
  };

  // Enter tuşu
  document.addEventListener('keydown', function(e) {
    if (e.key !== 'Enter') return;
    if (currentAuthTab === 'login')   doLogin();
    if (currentAuthTab === 'register') doRegister();
    if (currentAuthTab === 'forgot')   doForgotPassword();
  });

  console.log('%c[Giriş] ✅ Auth modülü yüklendi', 'color:#22c55e;font-weight:bold');
})();
