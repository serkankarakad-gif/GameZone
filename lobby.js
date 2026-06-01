// ══════════════════════════════════════════════
//  WAR ZONE v4 — LOBBY.JS  (PUBG Mobile Style)
// ══════════════════════════════════════════════

/* ────────────────────────────────────────────
   PUBG-STYLE LOBBY LAYOUT
   · Sky background with floating island
   · Big 3D character center
   · Vehicle (left side)
   · Pet/animal (right side)
   · Bottom nav bar (KLAN · TEMA · SEZON · ATÖLYe · KARTLAR · ENVANTER)
   · Right panel (events + shop)
   · Top bar (level, currency, squad)
   · BAŞLA button bottom-left
──────────────────────────────────────────────*/

let previewRenderer = null, previewScene, previewCamera;
let charMesh = null, vehicleMesh = null, petMesh = null;
let lobbyAnimating = false;

// ── OPEN LOBBY ──
function openLobby() {
  const _nm = document.getElementById('name-modal'); if(_nm) _nm.style.display = 'none';
  document.getElementById('lobby').style.display = 'block';
  document.getElementById('pnd-name').textContent  = LD.playerName;

  refreshLobbyStats();
  updateRankBadge();
  applySettingsToggles();
  buildRankTab();

  initPubgLobby();
  initLobbyBg3D();

  // default tab
  switchTab('play');
}

// ══════════════════════════════════════════════
//  PUBG-STYLE 3D LOBBY SCENE
// ══════════════════════════════════════════════
function initPubgLobby() {
  const canvas = document.getElementById('lobby-3d-canvas');
  if (!canvas || previewRenderer) return;

  // Renderer
  previewRenderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  previewRenderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  previewRenderer.setSize(canvas.clientWidth, canvas.clientHeight);
  previewRenderer.shadowMap.enabled = true;
  previewRenderer.shadowMap.type    = THREE.PCFSoftShadowMap;

  previewScene  = new THREE.Scene();
  previewCamera = new THREE.PerspectiveCamera(42, canvas.clientWidth / canvas.clientHeight, 0.1, 200);
  previewCamera.position.set(0, 2.2, 7.5);
  previewCamera.lookAt(0, 1.6, 0);

  // Lighting  
  const ambient = new THREE.AmbientLight(0xffffff, 0.55);
  previewScene.add(ambient);

  const sun = new THREE.DirectionalLight(0xfff8ee, 1.6);
  sun.position.set(5, 12, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.width = sun.shadow.mapSize.height = 1024;
  sun.shadow.camera.near = 0.5; sun.shadow.camera.far = 50;
  sun.shadow.camera.left = sun.shadow.camera.bottom = -12;
  sun.shadow.camera.right = sun.shadow.camera.top = 12;
  previewScene.add(sun);

  const rimLight = new THREE.DirectionalLight(0xaaddff, 0.6);
  rimLight.position.set(-4, 3, -5);
  previewScene.add(rimLight);

  const fill = new THREE.PointLight(0x88ccff, 0.5, 20);
  fill.position.set(0, 4, 4);
  previewScene.add(fill);

  // Ground (marble/tile plaza look)
  buildLobbyGround();

  // Build entities
  charMesh    = buildLobbyCharacter();
  vehicleMesh = buildLobbyVehicle();
  petMesh     = buildLobbyPet();

  previewScene.add(charMesh);
  previewScene.add(vehicleMesh);
  previewScene.add(petMesh);

  lobbyAnimating = true;
  animateLobby3D();

  // Resize
  window.addEventListener('resize', resizeLobbyCanvas);
}

function resizeLobbyCanvas() {
  const canvas = document.getElementById('lobby-3d-canvas');
  if (!canvas || !previewRenderer) return;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  previewRenderer.setSize(w, h);
  previewCamera.aspect = w / h;
  previewCamera.updateProjectionMatrix();
}

function buildLobbyGround() {
  // Tiled marble plaza
  const geo = new THREE.PlaneGeometry(22, 16, 8, 6);
  const mat = new THREE.MeshLambertMaterial({
    color: 0xdde8ee,
  });
  const ground = new THREE.Mesh(geo, mat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.01;
  ground.receiveShadow = true;
  previewScene.add(ground);

  // Tile lines
  for (let i = -5; i <= 5; i++) {
    const lineGeo = new THREE.PlaneGeometry(22, 0.03);
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xbbccd4 });
    const line = new THREE.Mesh(lineGeo, lineMat);
    line.rotation.x = -Math.PI / 2;
    line.position.set(0, 0.001, i * 1.6);
    previewScene.add(line);
  }
  for (let i = -6; i <= 6; i++) {
    const lineGeo = new THREE.PlaneGeometry(0.03, 16);
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xbbccd4 });
    const line = new THREE.Mesh(lineGeo, lineMat);
    line.rotation.x = -Math.PI / 2;
    line.position.set(i * 1.8, 0.001, 0);
    previewScene.add(line);
  }

  // Subtle shadow disc under character
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(0.9, 24),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.12 })
  );
  disc.rotation.x = -Math.PI / 2;
  disc.position.set(0, 0.002, 0);
  previewScene.add(disc);
}

// ── CHARACTER (center, big) ──
function buildLobbyCharacter() {
  const g = new THREE.Group();
  const cc = CHAR_CONFIGS[LD.selectedChar] || CHAR_CONFIGS.soldier;

  const bodyColors = {
    soldier: { body: 0xf0f4ff, legs: 0x1a2444, boots: 0x0a0e22, trim: 0x44aaff },
    ghost:   { body: 0x111111, legs: 0x0a0a0a, boots: 0x050505, trim: 0xff2222 },
    tank:    { body: 0x6a3a18, legs: 0x2a1808, boots: 0x150c04, trim: 0xff8800 },
    sniper:  { body: 0x1a3a1a, legs: 0x0e1e0e, boots: 0x08100a, trim: 0x44ff88 },
  };
  const col = bodyColors[LD.selectedChar] || bodyColors.soldier;

  const bodyMat  = new THREE.MeshLambertMaterial({ color: col.body });
  const legMat   = new THREE.MeshLambertMaterial({ color: col.legs });
  const bootMat  = new THREE.MeshLambertMaterial({ color: col.boots });
  const trimMat  = new THREE.MeshLambertMaterial({ color: col.trim, emissive: col.trim, emissiveIntensity: 0.3 });
  const skinMat  = new THREE.MeshLambertMaterial({ color: 0xd4a87a });
  const hairMat  = new THREE.MeshLambertMaterial({ color: 0x222222 });
  const metalMat = new THREE.MeshLambertMaterial({ color: 0x888888 });

  // ── BOOTS ──
  [-0.22, 0.22].forEach(ox => {
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.22, 0.36), bootMat);
    boot.position.set(ox, 0.11, 0.02); boot.castShadow = true; g.add(boot);
    // Sole
    const sole = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.04, 0.38),
      new THREE.MeshLambertMaterial({ color: 0x111111 }));
    sole.position.set(ox, 0.02, 0.02); g.add(sole);
  });

  // ── LEGS ──
  [-0.22, 0.22].forEach(ox => {
    const shin = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.52, 0.28), legMat);
    shin.position.set(ox, 0.54, 0); shin.castShadow = true; g.add(shin);
    const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.56, 0.30), legMat);
    thigh.position.set(ox, 1.08, 0); thigh.castShadow = true; g.add(thigh);
    // Knee pad
    const kp = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.14, 0.08), trimMat);
    kp.position.set(ox, 0.72, 0.17); g.add(kp);
    // Thigh pouch
    const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.08),
      new THREE.MeshLambertMaterial({ color: 0x111111 }));
    pouch.position.set(ox > 0 ? ox + 0.1 : ox - 0.1, 1.0, 0.1); g.add(pouch);
  });

  // ── BELT ──
  const belt = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.1, 0.44),
    new THREE.MeshLambertMaterial({ color: 0x111111 }));
  belt.position.set(0, 1.37, 0); g.add(belt);
  const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 0.06), metalMat);
  buckle.position.set(0, 1.37, 0.22); g.add(buckle);

  // ── TORSO ──
  // Ghost: long coat; others: tactical vest
  const torsoH = LD.selectedChar === 'ghost' ? 1.4 : 1.2;
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.78, torsoH, 0.46), bodyMat);
  torso.position.set(0, 1.38 + torsoH * 0.5 - 0.6, 0); torso.castShadow = true; g.add(torso);

  if (LD.selectedChar !== 'ghost') {
    // Tactical vest
    const vest = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.9, 0.5),
      new THREE.MeshLambertMaterial({ color: 0x111111 }));
    vest.position.set(0, 1.6, 0); g.add(vest);
    const vestFront = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.75, 0.44), bodyMat);
    vestFront.position.set(0, 1.6, 0); g.add(vestFront);
    // Vest pouches
    for (let i = -1; i <= 1; i++) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.08),
        new THREE.MeshLambertMaterial({ color: 0x0a0a0a }));
      p.position.set(i * 0.22, 1.42, 0.24); g.add(p);
    }
    // Shoulder pads
    [-0.45, 0.45].forEach(ox => {
      const sp = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.14, 0.32), trimMat);
      sp.position.set(ox, 2.05, 0); g.add(sp);
    });
  } else {
    // Ghost: long coat tails
    const coatTail = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.9, 0.4), bodyMat);
    coatTail.position.set(0, 1.0, 0); g.add(coatTail);
    // Coat trim glowing
    const coatTrim = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.9, 0.04), trimMat);
    coatTrim.position.set(0, 1.0, 0.21); g.add(coatTrim);
  }

  // ── ARMS ──
  [-0.52, 0.52].forEach((ox, si) => {
    const uArm = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.52, 0.24), bodyMat);
    uArm.position.set(ox, 1.92, 0); uArm.castShadow = true; g.add(uArm);
    const lArm = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.48, 0.22), skinMat);
    lArm.position.set(ox, 1.46, 0.04); lArm.castShadow = true; g.add(lArm);
    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.2),
      new THREE.MeshLambertMaterial({ color: 0x111111 })); // glove
    hand.position.set(ox, 1.24, 0.06); g.add(hand);
    // Elbow pad
    const ep = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.1, 0.1), trimMat);
    ep.position.set(ox, 1.68, -0.1); g.add(ep);
  });

  // ── GUN (held in right hand position) ──
  const gunBody = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.07, 0.58),
    new THREE.MeshLambertMaterial({ color: 0x1a2a44, emissive: 0x0a1422 }));
  gunBody.position.set(0.35, 1.4, -0.25); gunBody.rotation.z = 0.15; g.add(gunBody);
  // Scope crystal
  const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.26, 10),
    new THREE.MeshLambertMaterial({ color: 0x88ddff, emissive: 0x44aaff, emissiveIntensity: 0.5 }));
  scope.rotation.z = Math.PI/2 + 0.15;
  scope.position.set(0.35, 1.48, -0.22); g.add(scope);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.28, 8),
    new THREE.MeshLambertMaterial({ color: 0x333333 }));
  barrel.rotation.z = Math.PI/2 + 0.15;
  barrel.position.set(0.35, 1.38, -0.54); g.add(barrel);

  // ── HEAD ──
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.56, 0.5), skinMat);
  head.position.y = 2.36; head.castShadow = true; g.add(head);

  // Face paint / mask for ghost
  if (LD.selectedChar === 'ghost') {
    const mask = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.38, 0.52),
      new THREE.MeshLambertMaterial({ color: 0x1a1a1a }));
    mask.position.set(0, 2.34, 0.01); g.add(mask);
    // Eerie eyes
    [-0.12, 0.12].forEach(ox => {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0xff2200 }));
      eye.position.set(ox, 2.38, 0.27); g.add(eye);
      const glow = new THREE.PointLight(0xff2200, 0.6, 0.8);
      glow.position.copy(eye.position); g.add(glow);
    });
    // Joker-style mouth
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.04, 0.02),
      new THREE.MeshBasicMaterial({ color: 0xff3333 }));
    mouth.position.set(0, 2.2, 0.27); g.add(mouth);
  }

  // Hair
  const hair = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.2, 0.52), hairMat);
  hair.position.set(0, 2.66, 0); g.add(hair);

  // ── HELMET / HEADGEAR ──
  if (LD.selectedChar !== 'ghost') {
    const helMat = new THREE.MeshLambertMaterial({ color: col.legs, emissive: col.trim, emissiveIntensity: 0.08 });
    const helm = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.26, 0.56), helMat);
    helm.position.set(0, 2.66, 0); g.add(helm);
    const brim2 = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.06, 0.62), helMat);
    brim2.position.set(0, 2.52, 0); g.add(brim2);
    // Visor glow
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.04),
      new THREE.MeshLambertMaterial({ color: col.trim, emissive: col.trim, emissiveIntensity: 0.6 }));
    visor.position.set(0, 2.6, 0.27); g.add(visor);
  } else {
    // Crown / jester hat
    const crownBase = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.34, 0.18, 8), trimMat);
    crownBase.position.set(0, 2.72, 0); g.add(crownBase);
    for (let i = 0; i < 5; i++) {
      const ang = (i / 5) * Math.PI * 2;
      const peak = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.22, 6),
        new THREE.MeshLambertMaterial({ color: col.trim, emissive: col.trim, emissiveIntensity: 0.4 }));
      peak.position.set(Math.cos(ang) * 0.24, 2.9, Math.sin(ang) * 0.24); g.add(peak);
    }
  }

  // Glow trim lines on suit
  const trimLine = new THREE.Mesh(new THREE.BoxGeometry(0.02, 1.1, 0.02),
    new THREE.MeshBasicMaterial({ color: col.trim }));
  trimLine.position.set(-0.38, 1.7, 0.23); g.add(trimLine);
  const trimLine2 = trimLine.clone();
  trimLine2.position.set(0.38, 1.7, 0.23); g.add(trimLine2);

  return g;
}

// ── VEHICLE (left side - armored sports car) ──
function buildLobbyVehicle() {
  const g = new THREE.Group();
  g.position.set(-3.2, 0, 0.8);
  g.rotation.y = 0.45;

  const bodyMat   = new THREE.MeshLambertMaterial({ color: 0x222233 });
  const glassMat  = new THREE.MeshLambertMaterial({ color: 0x88ccff, transparent: true, opacity: 0.55, emissive: 0x2244aa, emissiveIntensity: 0.2 });
  const wheelMat  = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const rimMat    = new THREE.MeshLambertMaterial({ color: 0x8888aa });
  const accentMat = new THREE.MeshLambertMaterial({ color: 0x6633cc, emissive: 0x4422aa, emissiveIntensity: 0.4 });
  const chromeMat = new THREE.MeshLambertMaterial({ color: 0xaaaacc });

  // Main body — low, wide sports car
  const mainBody = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.5, 1.6), bodyMat);
  mainBody.position.y = 0.55; mainBody.castShadow = true; g.add(mainBody);

  // Cabin
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.55, 1.45), bodyMat);
  cabin.position.set(-0.1, 1.04, 0); cabin.castShadow = true; g.add(cabin);

  // Hood slant
  const hood = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.3, 1.55), bodyMat);
  hood.position.set(1.05, 0.7, 0); hood.rotation.z = -0.28; g.add(hood);

  // Trunk slant
  const trunk = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.25, 1.55), bodyMat);
  trunk.position.set(-1.1, 0.7, 0); trunk.rotation.z = 0.22; g.add(trunk);

  // Windshield
  const windshield = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 1.3), glassMat);
  windshield.position.set(0.62, 1.02, 0); windshield.rotation.z = -0.5; g.add(windshield);

  // Rear window
  const rearWin = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.42, 1.3), glassMat);
  rearWin.position.set(-0.8, 1.0, 0); rearWin.rotation.z = 0.55; g.add(rearWin);

  // Side windows
  const sideWinGeo = new THREE.BoxGeometry(1.3, 0.4, 0.06);
  const sw1 = new THREE.Mesh(sideWinGeo, glassMat);
  sw1.position.set(-0.1, 1.06, 0.73); g.add(sw1);
  const sw2 = sw1.clone(); sw2.position.z = -0.73; g.add(sw2);

  // Purple glow accent strips
  const accentGeo = new THREE.BoxGeometry(3.0, 0.04, 0.04);
  [0.75, -0.75].forEach(oz => {
    const strip = new THREE.Mesh(accentGeo, accentMat);
    strip.position.set(0, 0.32, oz); g.add(strip);
    const glow = new THREE.PointLight(0x6633cc, 0.6, 3);
    glow.position.set(0, 0.32, oz); g.add(glow);
  });

  // Headlights
  const hlMat = new THREE.MeshBasicMaterial({ color: 0xaaddff });
  [-0.55, 0.55].forEach(oz => {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.36), hlMat);
    hl.position.set(1.57, 0.6, oz); g.add(hl);
    const hlGlow = new THREE.PointLight(0x88ccff, 0.8, 4);
    hlGlow.position.set(1.65, 0.6, oz); g.add(hlGlow);
  });

  // Taillights
  const tlMat = new THREE.MeshBasicMaterial({ color: 0xff2200 });
  [-0.55, 0.55].forEach(oz => {
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.3), tlMat);
    tl.position.set(-1.57, 0.6, oz); g.add(tl);
  });

  // Wheels x4
  [[1.0, -0.92], [1.0, 0.92], [-1.0, -0.92], [-1.0, 0.92]].forEach(([wx, wz]) => {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.28, 16), wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.38, wz); wheel.castShadow = true; g.add(wheel);
    // Rim
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.3, 8), rimMat);
    rim.rotation.z = Math.PI / 2;
    rim.position.set(wx, 0.38, wz); g.add(rim);
    // Spokes
    for (let s = 0; s < 5; s++) {
      const ang = (s / 5) * Math.PI * 2;
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.3, 0.04), rimMat);
      spoke.position.set(wx, 0.38 + Math.cos(ang) * 0.16, wz + Math.sin(ang) * 0.16);
      spoke.rotation.z = Math.PI / 2; g.add(spoke);
    }
    // Tire bulge
    const tireEdge = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.07, 8, 16), wheelMat);
    tireEdge.position.set(wx, 0.38, wz);
    tireEdge.rotation.z = Math.PI / 2; g.add(tireEdge);
  });

  // Undercarriage glow
  const underglow = new THREE.PointLight(0x6633cc, 1.2, 2.5);
  underglow.position.set(0, 0.05, 0); g.add(underglow);

  // Shadow disc
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(3.4, 2.0),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.18 })
  );
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.005; g.add(shadow);

  return g;
}

// ── PET (right side - lion) ──
function buildLobbyPet() {
  const g = new THREE.Group();
  g.position.set(2.6, 0, 0.5);
  g.rotation.y = -0.5;

  const furMat  = new THREE.MeshLambertMaterial({ color: 0xc8882a });
  const maneMat = new THREE.MeshLambertMaterial({ color: 0x7a4410 });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x8a5c18 });
  const noseMat = new THREE.MeshLambertMaterial({ color: 0xcc7755 });
  const eyeMat  = new THREE.MeshBasicMaterial({ color: 0xddaa22 });
  const collarMat = new THREE.MeshLambertMaterial({ color: 0xcc1111, emissive: 0x880000, emissiveIntensity: 0.3 });

  // ── BODY ──
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.7, 10, 8), furMat);
  body.scale.set(1.3, 0.9, 1.0); body.position.y = 0.65; body.castShadow = true; g.add(body);

  // ── LEGS ──
  [[-0.38,-0.5],[-0.18,-0.5],[0.18,-0.5],[0.38,-0.5]].forEach(([lx, lz], i) => {
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.12, 0.4, 8), furMat);
    upper.position.set(lx, 0.38, lz); upper.castShadow = true; g.add(upper);
    const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.08, 0.35, 8), darkMat);
    lower.position.set(lx, 0.1, lz); g.add(lower);
    // Paw
    const paw = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), furMat);
    paw.scale.set(1.2, 0.6, 1.3); paw.position.set(lx, -0.02, lz + (i >= 2 ? 0.04 : -0.04));
    paw.castShadow = true; g.add(paw);
  });

  // ── NECK ──
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.35, 8), furMat);
  neck.position.set(0, 1.05, 0.35); neck.rotation.x = -0.3; g.add(neck);

  // ── MANE (big fluffy sphere cluster) ──
  const manePositions = [
    [0,0,0],[0.2,0.1,0],[-0.2,0.1,0],[0,0.2,0],
    [0.15,-0.1,0],[-0.15,-0.1,0],[0.25,0,0],[-0.25,0,0]
  ];
  manePositions.forEach(([mx,my,mz]) => {
    const mane = new THREE.Mesh(new THREE.SphereGeometry(0.38+Math.random()*0.08, 8, 6), maneMat);
    mane.position.set(mx * 0.7, 1.28 + my * 0.5, 0.48 + mz);
    mane.castShadow = true; g.add(mane);
  });

  // ── HEAD ──
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.4, 10, 8), furMat);
  head.scale.set(1.1, 1.0, 1.05); head.position.set(0, 1.28, 0.58); head.castShadow = true; g.add(head);

  // Snout
  const snout = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), noseMat);
  snout.scale.set(1.0, 0.75, 0.9); snout.position.set(0, 1.18, 0.94); g.add(snout);
  // Nose
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), new THREE.MeshLambertMaterial({ color: 0x4a2010 }));
  nose.position.set(0, 1.25, 1.1); g.add(nose);

  // Eyes
  [-0.16, 0.16].forEach(ox => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), eyeMat);
    eye.position.set(ox, 1.38, 0.9); g.add(eye);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 4),
      new THREE.MeshBasicMaterial({ color: 0x111111 }));
    pupil.position.set(ox, 1.38, 0.97); g.add(pupil);
  });

  // Ears
  [-0.28, 0.28].forEach(ox => {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.18, 6), furMat);
    ear.position.set(ox, 1.65, 0.55); g.add(ear);
  });

  // Whiskers
  [[-0.35, 1.18, 0.96, -0.1], [0.35, 1.18, 0.96, 0.1],
   [-0.32, 1.14, 0.95, -0.05],[0.32, 1.14, 0.95, 0.05]].forEach(([wx,wy,wz,wr]) => {
    const w = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.015, 0.015),
      new THREE.MeshBasicMaterial({ color: 0xffffff }));
    w.position.set(wx, wy, wz); w.rotation.y = wr; g.add(w);
  });

  // Tail
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.8, 8), furMat);
  tail.position.set(0, 0.72, -0.7); tail.rotation.x = -0.5; g.add(tail);
  const tailTuft = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), maneMat);
  tailTuft.position.set(0, 0.75, -1.12); g.add(tailTuft);

  // Collar (red with gold tag)
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.04, 6, 16), collarMat);
  collar.position.set(0, 1.05, 0.55); collar.rotation.x = -0.3; g.add(collar);
  const tag = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.02),
    new THREE.MeshLambertMaterial({ color: 0xffcc00, emissive: 0xaa8800, emissiveIntensity: 0.4 }));
  tag.position.set(0, 0.98, 0.74); g.add(tag);

  return g;
}

// ── ANIMATE LOBBY 3D ──
function animateLobby3D() {
  if (!lobbyAnimating) return;
  requestAnimationFrame(animateLobby3D);

  const t = performance.now() * 0.001;

  // Character subtle idle: weight shift + breathe
  if (charMesh) {
    charMesh.position.y = Math.sin(t * 1.2) * 0.022;
    charMesh.rotation.y = Math.sin(t * 0.18) * 0.06; // slight sway
  }

  // Vehicle: very gentle rock
  if (vehicleMesh) {
    vehicleMesh.position.y = Math.sin(t * 0.8) * 0.008;
    vehicleMesh.rotation.z = Math.sin(t * 0.8) * 0.003;
  }

  // Pet: breathing + occasional tail wag
  if (petMesh) {
    petMesh.position.y = Math.abs(Math.sin(t * 1.0)) * 0.015;
    petMesh.rotation.y = -0.5 + Math.sin(t * 0.22) * 0.05;
  }

  // Camera very gentle dolly
  previewCamera.position.x = Math.sin(t * 0.09) * 0.25;
  previewCamera.position.y = 2.2 + Math.sin(t * 0.12) * 0.1;
  previewCamera.lookAt(0, 1.6, 0);

  previewRenderer.render(previewScene, previewCamera);
}

// ── REBUILD CHAR PREVIEW ──
window._rebuildPreviewChar = () => {
  if (!previewScene || !charMesh) return;
  previewScene.remove(charMesh);
  charMesh = buildLobbyCharacter();
  previewScene.add(charMesh);
};

// ══════════════════════════════════════════════
//  LOBBY BACKGROUND (sky + floating island)
// ══════════════════════════════════════════════
function initLobbyBg() { /* overridden by initLobbyBg3D */ }

function initLobbyBg3D() {
  const cv = document.getElementById('lobby-bg');
  if (!cv) return;
  cv.width = innerWidth; cv.height = innerHeight;
  const ctx = cv.getContext('2d');

  function drawBg() {
    if (document.getElementById('lobby').style.display === 'none') return;
    requestAnimationFrame(drawBg);
    const t = performance.now() * 0.001;
    const W = cv.width, H = cv.height;

    // Sky gradient (light blue → white → warm horizon)
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0,    '#5ba3d4');
    sky.addColorStop(0.35, '#8ec8e8');
    sky.addColorStop(0.7,  '#c8e8f4');
    sky.addColorStop(1.0,  '#e8f4fc');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);

    // Distant misty mountains
    ctx.fillStyle = 'rgba(140,180,210,0.35)';
    ctx.beginPath();
    ctx.moveTo(0, H * 0.72);
    for (let x = 0; x <= W; x += 18) {
      const y = H * 0.72 - (Math.sin(x * 0.008 + 1) * 60 + Math.sin(x * 0.016 + 3) * 30);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();

    ctx.fillStyle = 'rgba(160,195,220,0.28)';
    ctx.beginPath();
    ctx.moveTo(0, H * 0.78);
    for (let x = 0; x <= W; x += 14) {
      const y = H * 0.78 - (Math.sin(x * 0.011 + 2) * 40 + Math.sin(x * 0.022 + 5) * 20);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();

    // Floating island top-center
    const ix = W * 0.5 + Math.sin(t * 0.2) * 4;
    const iy = H * 0.12 + Math.sin(t * 0.15) * 3;
    ctx.save();
    ctx.translate(ix, iy);

    // Island rock base
    const islandGrad = ctx.createRadialGradient(0, 40, 10, 0, 40, 90);
    islandGrad.addColorStop(0, '#a8b890');
    islandGrad.addColorStop(0.5, '#8a9a70');
    islandGrad.addColorStop(1, 'rgba(80,95,60,0)');
    ctx.fillStyle = islandGrad;
    ctx.beginPath();
    ctx.ellipse(0, 45, 88, 38, 0, 0, Math.PI * 2);
    ctx.fill();

    // Island top green
    ctx.fillStyle = '#6aaa44';
    ctx.beginPath();
    ctx.ellipse(0, 30, 80, 25, 0, 0, Math.PI * 2);
    ctx.fill();

    // Mini buildings on island
    [[−20,10,10,28],[0,5,12,32],[18,8,9,26],[-38,18,6,18],[30,15,7,20]].forEach(([bx,bz,bw,bh]) => {
      ctx.fillStyle = `rgba(220,225,240,${0.7 + Math.random() * 0.0})`; // stable
      ctx.fillRect(bx - bw/2, 10 - bh, bw, bh);
      ctx.fillStyle = 'rgba(180,190,210,0.8)';
      ctx.fillRect(bx - bw/2, 10 - bh, bw, 4);
    });

    // Trees on island
    [-50,-30,10,40,55].forEach((tx, ti) => {
      ctx.fillStyle = '#3a7a28';
      ctx.beginPath();
      ctx.arc(tx, 20 - ti * 0.5, 7 + Math.sin(ti) * 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2a5a18';
      ctx.fillRect(tx - 2, 22, 4, 8);
    });

    // Island glow
    const iglow = ctx.createRadialGradient(0, 40, 0, 0, 40, 100);
    iglow.addColorStop(0, 'rgba(180,220,255,0.15)');
    iglow.addColorStop(1, 'rgba(180,220,255,0)');
    ctx.fillStyle = iglow;
    ctx.beginPath();
    ctx.ellipse(0, 40, 100, 60, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Clouds
    const cloudData = [
      { x: 0.08, y: 0.22, w: 110, h: 28, spd: 0.012, op: 0.82 },
      { x: 0.28, y: 0.14, w: 85,  h: 22, spd: 0.008, op: 0.65 },
      { x: 0.58, y: 0.28, w: 130, h: 32, spd: 0.015, op: 0.75 },
      { x: 0.78, y: 0.18, w: 90,  h: 24, spd: 0.01,  op: 0.6  },
      { x: 0.92, y: 0.32, w: 70,  h: 20, spd: 0.018, op: 0.7  },
    ];
    cloudData.forEach(c => {
      const cx = ((c.x * W + t * c.spd * 60) % (W + 200)) - 100;
      const cy = c.y * H;
      drawCloud(ctx, cx, cy, c.w, c.h, c.op);
    });

    // Ground/plaza gradient at bottom
    const ground = ctx.createLinearGradient(0, H * 0.72, 0, H);
    ground.addColorStop(0, 'rgba(200,215,225,0.95)');
    ground.addColorStop(1, 'rgba(185,200,215,0.98)');
    ctx.fillStyle = ground;
    ctx.fillRect(0, H * 0.72, W, H * 0.28);

    // Tile grid on ground
    ctx.strokeStyle = 'rgba(180,195,210,0.5)';
    ctx.lineWidth = 0.8;
    const tileW = W / 14, tileH = H * 0.07;
    for (let xi = 0; xi <= 14; xi++) {
      ctx.beginPath(); ctx.moveTo(xi * tileW, H * 0.72); ctx.lineTo(xi * tileW, H); ctx.stroke();
    }
    for (let yi = 0; yi <= 4; yi++) {
      ctx.beginPath(); ctx.moveTo(0, H * 0.72 + yi * tileH); ctx.lineTo(W, H * 0.72 + yi * tileH); ctx.stroke();
    }

    // Ambient light beam from top
    const beam = ctx.createLinearGradient(W*0.5, 0, W*0.5, H*0.7);
    beam.addColorStop(0, 'rgba(255,255,255,0.06)');
    beam.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(W*0.38, 0); ctx.lineTo(W*0.62, 0); ctx.lineTo(W*0.7, H*0.7); ctx.lineTo(W*0.3, H*0.7);
    ctx.closePath(); ctx.fill();
  }
  drawBg();
}

function drawCloud(ctx, x, y, w, h, opacity) {
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.fillStyle = '#ffffff';
  const puffs = [[0,0,h],[w*0.25,-h*0.3,h*0.85],[w*0.5,-h*0.1,h*0.9],[w*0.75,-h*0.2,h*0.8],[w,-h*0.05,h*0.7]];
  puffs.forEach(([px,py,r]) => {
    ctx.beginPath();
    ctx.ellipse(x + px - w*0.5, y + py, r * 0.9, r * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

// ══════════════════════════════════════════════
//  LOBBY UI FUNCTIONS
// ══════════════════════════════════════════════
function confirmName() {
  // name-modal kaldırıldı — kayıt formundan isim alınıyor
  if (typeof openLobby === 'function') openLobby();
}

function returnToLobby() {
  gameActive = false;
  document.getElementById('overlay').style.display    = 'none';
  document.getElementById('win-screen').style.display = 'none';
  document.getElementById('lobby').style.display = 'block';
  lobbyAnimating = true;
  initLobbyBg3D();
  if (!previewRenderer) initPubgLobby();
  else animateLobby3D();
  refreshLobbyStats();
  updateRankBadge();
  buildRankTab();
  buildLeaderboard();
}

function refreshLobbyStats() {
  const s = e => document.getElementById(e);
  if (s('ls-best'))  s('ls-best').textContent  = LD.bestScore.toLocaleString();
  if (s('ls-kills')) s('ls-kills').textContent = LD.totalKills;
  if (s('ls-wins'))  s('ls-wins').textContent  = LD.wins;
  if (s('ls-games')) s('ls-games').textContent = LD.gamesPlayed;
}

function updateRankBadge() {
  const r = getRank(LD.xp);
  const rb = document.getElementById('rank-badge');
  if (rb) { rb.textContent = r.icon + ' ' + r.name; rb.style.color = r.color; rb.style.borderColor = r.color; }
  const av = document.getElementById('player-avatar');
  if (av) av.textContent = CHAR_CONFIGS[LD.selectedChar]?.icon || '🪖';
  const charNameEl = document.getElementById('lobby-char-name');
  if (charNameEl) charNameEl.textContent = (CHAR_CONFIGS[LD.selectedChar]?.name || 'ASKER');
}

function switchTab(id) {
  document.querySelectorAll('.ltab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  const tabEl = document.querySelector(`.ltab[data-tab="${id}"]`);
  if (tabEl) tabEl.classList.add('active');
  const panelEl = document.getElementById('tab-' + id);
  if (panelEl) panelEl.classList.add('active');
  if (id === 'lb')       buildLeaderboard();
  if (id === 'rank')     buildRankTab();
  // Hide/show right panel
  const rp = document.getElementById('right-panel');
  if (rp) rp.style.display = ['play','weapons','chars'].includes(id) ? 'flex' : 'none';
}

function selectMode(mode, el) {
  LD.selectedMode = mode;
  document.querySelectorAll('.mode-card').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
}
function selectDiff(diff, el) {
  LD.selectedDiff = diff;
  document.querySelectorAll('.diff-btn').forEach(b => { b.className = 'diff-btn'; });
  el.className = `diff-btn sel-${diff}`;
}
function selectWeapon(wKey, el) {
  LD.selectedWeapon = wKey;
  document.querySelectorAll('.weapon-card').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
}
function selectChar(key, el, icon, name) {
  LD.selectedChar = key;
  document.querySelectorAll('.char-card').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  updateRankBadge();
  if (window._rebuildPreviewChar) window._rebuildPreviewChar();
}
function toggleSetting(el, key) { LD.settings[key] = !LD.settings[key]; el.classList.toggle('on', LD.settings[key]); saveData(); }
function updateSens(el)     { LD.settings.sens     = parseInt(el.value); document.getElementById('sl-sens-val').textContent     = el.value; saveData(); }
function updateGfx(el)      { LD.settings.gfx      = parseInt(el.value); const n={1:'DÜŞÜK',2:'ORTA',3:'YÜKSEK'}; document.getElementById('sl-gfx-val').textContent = n[el.value]||el.value; saveData(); }
function updateFpsLimit(el) { const i=parseInt(el.value); LD.settings.fpsLimit=FPS_LIMITS[i]; document.getElementById('sl-fps-val').textContent=FPS_LIMIT_LABELS[i]; saveData(); }
function updateFov(el)      { LD.settings.fov      = parseInt(el.value); document.getElementById('sl-fov-val').textContent       = el.value+'°'; if(camera){camera.fov=LD.settings.fov;camera.updateProjectionMatrix();} saveData(); }
function updateFoliage(el)  { LD.settings.foliage  = parseInt(el.value); const n={1:'DÜŞÜK',2:'ORTA',3:'YÜKSEK'}; document.getElementById('sl-foliage-val').textContent=n[el.value]||el.value; saveData(); }

function buildRankTab() {
  const r = getRank(LD.xp), next = getNextRank(LD.xp);
  const icon = document.getElementById('rank-icon-big'), name = document.getElementById('rank-name-big');
  if (icon) icon.textContent = r.icon;
  if (name) { name.textContent = r.name; name.style.color = r.color; }
  const fill = document.getElementById('rank-xp-bar-fill'), txt = document.getElementById('rank-xp-text');
  if (fill && next) fill.style.width = ((LD.xp-r.xpReq)/(next.xpReq-r.xpReq)*100)+'%';
  if (txt && next)  txt.textContent  = `${LD.xp-r.xpReq} / ${next.xpReq-r.xpReq} XP`;
  const list = document.getElementById('rank-list');
  if (list) list.innerHTML = RANKS.map(rk => {
    const cur = getRank(LD.xp).name === rk.name;
    return `<div class="rank-item${cur?' current':''}"><div class="ri-icon">${rk.icon}</div><div><div class="ri-name" style="color:${rk.color}">${rk.name}</div><div class="ri-req">${rk.xpReq===0?'Başlangıç':rk.xpReq.toLocaleString()+' XP'}${cur?' ← ŞU AN':''}</div></div></div>`;
  }).join('');
}

function buildLeaderboard() {
  const list = document.getElementById('lb-list');
  if (!list) return;
  list.innerHTML = '<li style="color:#444;font-size:11px;padding:12px;text-align:center">Yükleniyor...</li>';
  try {
    const db = fbDB();
    if (!db) { list.innerHTML = '<li style="color:#444;padding:12px">Firebase yok.</li>'; return; }
    db.ref('leaderboard').orderByChild('score').limitToLast(15).once('value', snap => {
      const rows = []; snap.forEach(c => rows.push(c.val())); rows.sort((a,b)=>b.score-a.score);
      if (!rows.length) { list.innerHTML = '<li style="color:#444;padding:12px;text-align:center">İlk kaydı sen yap!</li>'; return; }
      list.innerHTML = rows.map((p,i)=>{
        const isYou=p.name===LD.playerName, rc=i===0?'top1':i===1?'top2':i===2?'top3':'';
        return `<li class="lb-row${isYou?' lb-you':''}"><div class="lb-rank ${rc}">${i+1}</div><div class="lb-info"><div class="lb-name">${p.name||'?'}</div><div class="lb-detail">💀${p.kills||0}</div></div><div class="lb-score">${(p.score||0).toLocaleString()}</div></li>`;
      }).join('');
    });
  } catch(e) { list.innerHTML = '<li style="color:#444;padding:12px">Yükleniyor...</li>'; }
}

function applySettingsToggles() {
  const s = LD.settings;
  ['sound','vib','gyro','auto'].forEach(k => { const el=document.getElementById('tog-'+k); if(el) el.classList.toggle('on',!!s[k]); });
  const pairs = [['sl-sens','sl-sens-val',s.sens,v=>v],['sl-gfx','sl-gfx-val',s.gfx,v=>({1:'DÜŞÜK',2:'ORTA',3:'YÜKSEK'})[v]||v],['sl-fov','sl-fov-val',s.fov||80,v=>v+'°'],['sl-foliage','sl-foliage-val',s.foliage||2,v=>({1:'DÜŞÜK',2:'ORTA',3:'YÜKSEK'})[v]||v]];
  pairs.forEach(([sid,vid,val,fmt])=>{ const el=document.getElementById(sid); if(el){el.value=val; document.getElementById(vid).textContent=fmt(val);} });
  const fps=document.getElementById('sl-fps'); if(fps){const i=FPS_LIMITS.indexOf(s.fpsLimit);fps.value=i>=0?i:0;document.getElementById('sl-fps-val').textContent=FPS_LIMIT_LABELS[i>=0?i:0];}
}

document.addEventListener('DOMContentLoaded', () => {
  // Oyun motoru başlat (Three.js, ses vb.)
  if (typeof init === 'function') init();
  // Ekran yönetimi (auth→lobby) firebase-config.js'de yapılıyor
});
