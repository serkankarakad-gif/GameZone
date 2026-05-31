# ⚔ WAR ZONE v4 — Battle Royale

> Gerçek 3D FPS Battle Royale oyunu · Firebase kayıt · Uçak animasyonu · FPS görünümü

---

## 📁 Dosya Yapısı

```
warzone-v4/
├── index.html          ← Ana HTML (tüm UI elementleri)
├── style.css           ← Tüm stiller (lobby, HUD, kontroller)
├── firebase-config.js  ← Firebase Auth + Database + kayıt/yükle
├── data.js             ← Sabitler, configs, global state, ses
├── lobby.js            ← Lobby UI, 3D karakter önizleme, uçak animasyonu
├── map.js              ← Harita: arazi, binalar, ağaçlar, çimler, yollar
├── player.js           ← FPS gövde, silah modeli, hareket, ateş, loot
├── bots.js             ← 50 humanoid bot: AI, animasyon, ölüm sistemi
├── game.js             ← Ana game loop, FPS limiter, zone, kazanma/kaybetme
└── README.md           ← Bu dosya
```

---

## 🚀 GitHub'a Yayınlama

### Adım 1: GitHub Pages ile

```bash
# Yeni repo oluştur
git init
git add .
git commit -m "WAR ZONE v4 - Battle Royale"
git branch -M main
git remote add origin https://github.com/KULLANICIN/warzone-v4.git
git push -u origin main
```

Sonra GitHub → Settings → Pages → Source: **main** seç → Kaydet

Adres: `https://KULLANICIN.github.io/warzone-v4/`

### Adım 2: Firebase Rules (Güvenlik)

Firebase Console → Realtime Database → Rules:
```json
{
  "rules": {
    "players": {
      "$uid": {
        ".read":  "$uid === auth.uid",
        ".write": "$uid === auth.uid"
      }
    },
    "leaderboard": {
      ".read":  true,
      "$uid": {
        ".write": "$uid === auth.uid"
      }
    }
  }
}
```

---

## 🎮 Kontroller

| Tuş | Eylem |
|-----|-------|
| WASD | Hareket |
| Fare | Kamera |
| Sol Tık | Ateş |
| Sağ Tık / F | ADS |
| R | Şarj |
| E | Yağmala |
| Q | İlk Yardım |
| Tab / Scroll | Silah Değiştir |
| Boşluk | Zıpla |

---

## ✨ v4 Yenilikleri

- ✅ **Gerçek uçak animasyonu** — Three.js ile 3D uçak, bulutlar, arazi görünümü
- ✅ **FPS gövde görünümü** — Kollar, bacaklar, ekipman görünüyor
- ✅ **Firebase kayıt** — localStorage değil, UID bazlı cloud save
- ✅ **FPS limiter** — Sınırsız / 30 / 60 / 120 FPS seçeneği
- ✅ **Gerçekçi arazi** — Vertex-renkli terrain, yollar, çimler
- ✅ **Gerçek bina detayları** — Kapı, pencere, çerçeve, beton yol
- ✅ **Humanoid botlar** — Yelek, kask, çizme, silah görünümü
- ✅ **3D karakter önizleme** — Lobide dönen karakter modeli
- ✅ **FOV ayarı** — Ayarlar kısmında kamera açısı
- ✅ **Çim yoğunluğu ayarı** — Ortam detayı kontrolü
- ✅ **FPS sayacı** — HUD'da anlık FPS göstergesi

---

## ⚙ Performans İpuçları

| Cihaz | Önerilen Ayarlar |
|-------|-----------------|
| Eski telefon | Grafik: DÜŞÜK · FPS: 30 · Çim: DÜŞÜK |
| Orta telefon | Grafik: ORTA · FPS: 60 · Çim: ORTA |
| Güçlü cihaz | Grafik: YÜKSEK · FPS: SINIRSIZ · Çim: YÜKSEK |

---

## 🔧 Firebase Değiştirme

`firebase-config.js` dosyasında kendi Firebase projenizi kullanmak için:

```javascript
firebase.initializeApp({
  apiKey:            "SIZIN_API_KEY",
  authDomain:        "SIZIN_PROJE.firebaseapp.com",
  databaseURL:       "https://SIZIN_PROJE-default-rtdb.europe-west1.firebasedatabase.app",
  projectId:         "SIZIN_PROJE",
  storageBucket:     "SIZIN_PROJE.appspot.com",
  messagingSenderId: "SIZIN_ID",
  appId:             "SIZIN_APP_ID"
});
```

---

*WAR ZONE v4 — Tüm hakları saklıdır · Three.js r128 · Firebase 9 compat*
