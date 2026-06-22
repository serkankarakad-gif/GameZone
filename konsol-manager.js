/* ==========================================================================
   konsol-manager.js — Değiştirilebilir / Sürüklenebilir Alt Konsol
   Özellikler:
   - Sekmeler: Ana Menü | Üretim | Finans | Ticaret | Sosyal | Ayarlar
   - Yukarı/Aşağı sürükleme (yarı ekran / tam gizle)
   - Sekme sırası sürükle-bırak ile değiştirilebilir
   - Her sekme içeriği özelleştirilebilir
   - Konsolun yüksekliği ayarlanabilir (tutamak ile)
   ========================================================================== */

(function(){

  /* -------- SEKME TANIMI -------- */
  const DEFAULT_TABS = [
    { id:'dukkan',   icon:'🏪', label:'Dükkan'   },
    { id:'bahce',    icon:'🌱', label:'Bahçe'    },
    { id:'ciftlik',  icon:'🐄', label:'Çiftlik'  },
    { id:'fabrika',  icon:'🏭', label:'Fabrika'  },
    { id:'maden',    icon:'⛏️', label:'Maden'    },
    { id:'lojistik', icon:'🚚', label:'Lojistik' },
    { id:'ihracat',  icon:'🚢', label:'İhracat'  },
    { id:'ihale',    icon:'⚖️', label:'İhale'    },
    { id:'kripto',   icon:'📈', label:'Kripto'   },
    { id:'marka',    icon:'🏢', label:'Marka'    },
    { id:'pazar',    icon:'🛒', label:'Pazar'    },
    { id:'liderlik', icon:'🏆', label:'Liderlik' },
    { id:'haberler', icon:'📰', label:'Haberler' },
    { id:'sehirler', icon:'🏙️', label:'Şehirler' },
    { id:'magaza',   icon:'💎', label:'Mağaza'   },
    { id:'hikaye',   icon:'📖', label:'Hikaye'   },
    { id:'sss',      icon:'❓', label:'SSS'      },
  ];

  let tabs = loadTabOrder();
  let dragSrcIndex = null;
  let konsol = null;
  let konsol_strip = null;
  let isEditing = false;

  function loadTabOrder(){
    try {
      const saved = JSON.parse(localStorage.getItem('konsol_tab_order') || 'null');
      if (saved && Array.isArray(saved) && saved.length > 0){
        // Kaydedilmiş sırayı kullan, yeni eklenen tabları sona ekle
        const existing = saved.filter(s => DEFAULT_TABS.find(d=>d.id===s.id));
        const newTabs = DEFAULT_TABS.filter(d => !existing.find(e=>e.id===d.id));
        return [...existing, ...newTabs];
      }
    } catch(e){}
    return [...DEFAULT_TABS];
  }
  function saveTabOrder(){
    localStorage.setItem('konsol_tab_order', JSON.stringify(tabs));
  }

  /* -------- KONSOL OLUŞTUR -------- */
  function buildKonsol(){
    const existing = document.getElementById('dynamicKonsol');
    if (existing) existing.remove();

    const el = document.createElement('nav');
    el.id = 'dynamicKonsol';
    el.className = 'dynamic-konsol';
    el.setAttribute('role','navigation');

    el.innerHTML = `
      <div class="dk-handle" id="dkHandle" title="Sürükle veya tıkla">
        <div class="dk-handle-bar"></div>
        <button class="dk-edit-btn" id="dkEditBtn" title="Sekmeleri Düzenle">✏️</button>
        <button class="dk-hide-btn" id="dkHideBtn" title="Konsolu Gizle">▼</button>
      </div>
      <div class="dk-strip" id="dkStrip"></div>
      <div class="dk-edit-panel" id="dkEditPanel" style="display:none">
        <div class="dk-edit-info">⬆️ Sekmeleri sürükleyerek sırasını değiştir</div>
        <div class="dk-edit-strip" id="dkEditStrip"></div>
        <button class="dk-done-btn" id="dkDoneBtn">✅ Tamam</button>
      </div>
    `;

    document.body.appendChild(el);
    konsol = el;
    konsol_strip = el.querySelector('#dkStrip');

    renderStrip();
    bindHandleEvents();
    bindButtons();

    // Kaydedilmiş yüksekliği uygula
    const savedH = localStorage.getItem('konsol_height');
    if (savedH) el.style.setProperty('--dk-h', savedH + 'px');
  }

  /* -------- STRIP RENDER -------- */
  function renderStrip(){
    if (!konsol_strip) return;
    const activeTab = (typeof GZ !== 'undefined' && GZ.currentTab) ? GZ.currentTab : 'dukkan';
    konsol_strip.innerHTML = tabs.map(t => `
      <button class="dk-btn ${t.id === activeTab ? 'active' : ''}"
        data-tab="${t.id}"
        onclick="switchTab('${t.id}');renderKonsolActive('${t.id}')"
        title="${t.label}">
        <span class="dk-icon">${t.icon}</span>
        <span class="dk-label">${t.label}</span>
      </button>
    `).join('');
  }

  window.renderKonsolActive = function(tabId){
    if (!konsol_strip) return;
    konsol_strip.querySelectorAll('.dk-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.tab === tabId);
    });
    // Aktif sekmeye scroll
    const active = konsol_strip.querySelector('.dk-btn.active');
    if (active) active.scrollIntoView({ behavior:'smooth', inline:'center', block:'nearest' });
  };

  /* -------- DÜZENLEME PANELİ -------- */
  function renderEditStrip(){
    const strip = document.getElementById('dkEditStrip');
    if (!strip) return;
    strip.innerHTML = tabs.map((t,i) => `
      <div class="dk-edit-item" draggable="true" data-index="${i}" data-id="${t.id}">
        <span class="dk-drag-handle">⠿</span>
        <span class="dk-edit-icon">${t.icon}</span>
        <span class="dk-edit-lbl">${t.label}</span>
      </div>
    `).join('');

    // Sürükle-bırak
    strip.querySelectorAll('.dk-edit-item').forEach(item => {
      item.addEventListener('dragstart', e => {
        dragSrcIndex = parseInt(item.dataset.index);
        e.dataTransfer.effectAllowed = 'move';
        item.classList.add('dragging');
      });
      item.addEventListener('dragend', () => {
        item.classList.remove('dragging');
        strip.querySelectorAll('.dk-edit-item').forEach(i=>i.classList.remove('drag-over'));
      });
      item.addEventListener('dragover', e => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        strip.querySelectorAll('.dk-edit-item').forEach(i=>i.classList.remove('drag-over'));
        item.classList.add('drag-over');
      });
      item.addEventListener('drop', e => {
        e.preventDefault();
        const destIndex = parseInt(item.dataset.index);
        if (dragSrcIndex === null || dragSrcIndex === destIndex) return;
        const moved = tabs.splice(dragSrcIndex, 1)[0];
        tabs.splice(destIndex, 0, moved);
        saveTabOrder();
        renderEditStrip();
      });
    });
  }

  /* -------- HANDLE — SÜRÜKLEME & YÜKSEKLIK -------- */
  function bindHandleEvents(){
    const handle = document.getElementById('dkHandle');
    if (!handle) return;

    let startY = null;
    let startH = null;
    let mode = null; // 'resize' ya da null

    handle.addEventListener('touchstart', e => {
      if (e.target.classList.contains('dk-edit-btn') || e.target.classList.contains('dk-hide-btn')) return;
      const t = e.touches[0];
      startY = t.clientY;
      startH = konsol.offsetHeight;
      mode = 'resize';
    }, { passive:true });

    document.addEventListener('touchmove', e => {
      if (mode !== 'resize' || startY === null) return;
      const dy = startY - e.touches[0].clientY; // yukarı sürükleme = yükselt
      const newH = Math.min(Math.max(startH + dy, 56), window.innerHeight * 0.75);
      konsol.style.height = newH + 'px';
      localStorage.setItem('konsol_height', Math.round(newH));
    }, { passive:true });

    document.addEventListener('touchend', () => {
      if (mode === 'resize'){
        const h = konsol.offsetHeight;
        if (h < 80){ hideKonsol(); }
        mode = null; startY = null;
      }
    });

    // Mouse desteği (desktop)
    handle.addEventListener('mousedown', e => {
      if (e.target.classList.contains('dk-edit-btn') || e.target.classList.contains('dk-hide-btn')) return;
      startY = e.clientY;
      startH = konsol.offsetHeight;
      mode = 'resize';
      document.body.style.userSelect = 'none';
    });
    document.addEventListener('mousemove', e => {
      if (mode !== 'resize') return;
      const dy = startY - e.clientY;
      const newH = Math.min(Math.max(startH + dy, 56), window.innerHeight * 0.75);
      konsol.style.height = newH + 'px';
      localStorage.setItem('konsol_height', Math.round(newH));
    });
    document.addEventListener('mouseup', () => {
      if (mode === 'resize'){
        document.body.style.userSelect = '';
        if (konsol.offsetHeight < 80) hideKonsol();
        mode = null;
      }
    });
  }

  function bindButtons(){
    document.addEventListener('click', e => {
      if (e.target.id === 'dkEditBtn' || e.target.closest('#dkEditBtn')){
        isEditing = !isEditing;
        const panel = document.getElementById('dkEditPanel');
        if (panel){
          panel.style.display = isEditing ? 'flex' : 'none';
          if (isEditing) renderEditStrip();
        }
      }
      if (e.target.id === 'dkHideBtn' || e.target.closest('#dkHideBtn')){ hideKonsol(); }
      if (e.target.id === 'dkDoneBtn' || e.target.closest('#dkDoneBtn')){
        isEditing = false;
        const panel = document.getElementById('dkEditPanel');
        if (panel) panel.style.display = 'none';
        renderStrip();
        saveTabOrder();
      }
      if (e.target.id === 'dkShowBtn'){ showKonsol(); }
    });
  }

  /* -------- GİZLE / GÖSTER -------- */
  function hideKonsol(){
    if (!konsol) return;
    konsol.classList.add('hidden-konsol');
    let showBtn = document.getElementById('dkShowBtn');
    if (!showBtn){
      showBtn = document.createElement('button');
      showBtn.id = 'dkShowBtn';
      showBtn.className = 'dk-show-btn';
      showBtn.innerHTML = '▲ Menü';
      showBtn.title = 'Alt Menüyü Göster';
      document.body.appendChild(showBtn);
    }
    showBtn.style.display = 'flex';
  }

  function showKonsol(){
    if (!konsol) return;
    konsol.classList.remove('hidden-konsol');
    const showBtn = document.getElementById('dkShowBtn');
    if (showBtn) showBtn.style.display = 'none';
    // Minimum yüksekliği geri ver
    if (konsol.offsetHeight < 56){ konsol.style.height = '64px'; }
  }

  /* -------- INIT -------- */
  window.initKonsol = function(){
    // Eski bottomnav'ı sakla (geri uyumluluk)
    const oldNav = document.getElementById('bottomNav');
    if (oldNav) oldNav.style.display = 'none';

    buildKonsol();

    // switchTab hook: aktif sekmeyi konsola yansıt
    const origSwitch = window.switchTab;
    window.switchTab = function(tab){
      if (typeof origSwitch === 'function') origSwitch(tab);
      renderKonsolActive(tab);
    };
  };

})();
