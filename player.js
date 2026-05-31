// ══════════════════════════════════════════════
//  WAR ZONE v4 — PLAYER.JS
//  FPS body (arms+legs visible), gun model,
//  movement, shooting, loot, HUD updates
// ══════════════════════════════════════════════

// ── BUILD FPS BODY (arms + lower body visible in first person) ──
function buildFPSBody() {
  if (fpsBody) { camera.remove(fpsBody); fpsBody = null; }
  fpsBody = new THREE.Group();

  const cc = CHAR_CONFIGS[LD.selectedChar] || CHAR_CONFIGS.soldier;

  // Body colors per character
  const skinColors = { soldier:0xd4a870, ghost:0x888888, tank:0xd4a870, sniper:0xd4a870 };
  const uniformColors = { soldier:0x4a6a4a, ghost:0x222222, tank:0x5a3a2a, sniper:0x2a4a2a };
  const pantsColors   = { soldier:0x3a4a3a, ghost:0x111111, tank:0x3a2a1a, sniper:0x1a2a1a };
  const bootColors    = { soldier:0x2a1a0a, ghost:0x111111, tank:0x1a0a00, sniper:0x1a2a0a };

  const skinMat    = new THREE.MeshLambertMaterial({ color: skinColors[LD.selectedChar]   || 0xd4a870 });
  const uniformMat = new THREE.MeshLambertMaterial({ color: uniformColors[LD.selectedChar]|| 0x4a6a4a });
  const pantsMat   = new THREE.MeshLambertMaterial({ color: pantsColors[LD.selectedChar]  || 0x3a4a3a });
  const bootMat    = new THREE.MeshLambertMaterial({ color: bootColors[LD.selectedChar]   || 0x2a1a0a });
  const glovesMat  = new THREE.MeshLambertMaterial({ color: 0x222222 });

  // ── LEFT ARM ──
  const leftArm = new THREE.Group();
  // Upper arm
  const lUpperArm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.26, 0.1), uniformMat);
  lUpperArm.position.set(0, 0, 0);
  leftArm.add(lUpperArm);
  // Forearm
  const lForeArm = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.25, 0.09), uniformMat);
  lForeArm.position.set(0, -0.24, 0.04);
  leftArm.add(lForeArm);
  // Hand/glove
  const lHand = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), glovesMat);
  lHand.position.set(0, -0.38, 0.06);
  leftArm.add(lHand);

  leftArm.position.set(-0.22, -0.22, -0.28);
  leftArm.rotation.set(-0.35, 0.08, 0.12);
  fpsBody.add(leftArm);

  // ── RIGHT ARM ──
  const rightArm = new THREE.Group();
  const rUpperArm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.26, 0.1), uniformMat);
  rUpperArm.position.set(0, 0, 0);
  rightArm.add(rUpperArm);
  const rForeArm = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.25, 0.09), uniformMat);
  rForeArm.position.set(0, -0.24, 0.04);
  rightArm.add(rForeArm);
  const rHand = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), glovesMat);
  rHand.position.set(0, -0.38, 0.06);
  rightArm.add(rHand);

  rightArm.position.set(0.22, -0.22, -0.28);
  rightArm.rotation.set(-0.35, -0.08, -0.12);
  fpsBody.add(rightArm);

  // ── TORSO (just the top visible near bottom of screen) ──
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.28, 0.32), uniformMat);
  torso.position.set(0, -0.46, -0.12);
  fpsBody.add(torso);

  // ── BELT ──
  const belt = new THREE.Mesh(new THREE.BoxGeometry(0.57, 0.06, 0.3), new THREE.MeshLambertMaterial({color:0x1a1a1a}));
  belt.position.set(0, -0.58, -0.1);
  fpsBody.add(belt);

  // ── LEGS (visible at bottom corners) ──
  [-0.14, 0.14].forEach((ox, i) => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.45, 0.22), pantsMat);
    leg.position.set(ox, -0.88, -0.06);
    fpsBody.add(leg);
    // Boot
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.16, 0.28), bootMat);
    boot.position.set(ox, -1.1, -0.02);
    fpsBody.add(boot);
  });

  // Store arm refs for animation
  fpsBody.userData.leftArm  = leftArm;
  fpsBody.userData.rightArm = rightArm;

  camera.add(fpsBody);
}

// ── BUILD GUN MODEL ──
function buildGun() {
  if (gunGroup) { camera.remove(gunGroup); gunGroup = null; }
  gunGroup = new THREE.Group();
  const wc = currentWeaponConfig || WEAPON_CONFIGS.m4a1;

  const bodyMat  = new THREE.MeshLambertMaterial({ color:0x1a1a1a });
  const bodyMat2 = new THREE.MeshLambertMaterial({ color:0x2d2018 });
  const metalMat = new THREE.MeshLambertMaterial({ color:0x444444 });
  const gripMat  = new THREE.MeshLambertMaterial({ color:0x3a2a18 });
  const railMat  = new THREE.MeshLambertMaterial({ color:0x555555 });

  if (wc === WEAPON_CONFIGS.sniper) {
    // AWM
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.072, 0.72), bodyMat);
    gunGroup.add(body);
    // Bolt handle
    const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.012,0.012,0.08,6), metalMat);
    bolt.rotation.z=Math.PI/2; bolt.position.set(-0.05,0.02,0.12); gunGroup.add(bolt);
    // Scope (large)
    const scopeBody = new THREE.Mesh(new THREE.CylinderGeometry(0.028,0.028,0.26,10), metalMat);
    scopeBody.rotation.z=Math.PI/2; scopeBody.position.set(0,0.08,0); gunGroup.add(scopeBody);
    // Scope lens rings
    [-0.12,0.12].forEach(ox=>{
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.028,0.006,6,10),metalMat);
      ring.rotation.y=Math.PI/2; ring.position.set(ox,0.08,0); gunGroup.add(ring);
    });
    // Barrel
    const barrel=new THREE.Mesh(new THREE.CylinderGeometry(0.014,0.014,0.42,8),metalMat);
    barrel.rotation.z=Math.PI/2; barrel.position.set(0,-0.008,-0.55); gunGroup.add(barrel);
    // Muzzle brake
    const mb=new THREE.Mesh(new THREE.CylinderGeometry(0.02,0.018,0.06,8),metalMat);
    mb.rotation.z=Math.PI/2; mb.position.set(0,-0.008,-0.78); gunGroup.add(mb);
    // Bipod
    [-0.03,0.03].forEach(oz=>{
      const bp=new THREE.Mesh(new THREE.BoxGeometry(0.008,0.1,0.008),metalMat);
      bp.position.set(0,-0.08,-0.3); bp.rotation.z=oz>0?0.3:-0.3; gunGroup.add(bp);
    });

  } else if (wc === WEAPON_CONFIGS.shotgun) {
    // SPAS-12
    const body=new THREE.Mesh(new THREE.BoxGeometry(0.1,0.075,0.52),bodyMat2); gunGroup.add(body);
    [-0.022,0.022].forEach(oy=>{
      const tube=new THREE.Mesh(new THREE.CylinderGeometry(0.024,0.024,0.52,8),metalMat);
      tube.rotation.z=Math.PI/2; tube.position.set(0,oy,-0.26); gunGroup.add(tube);
    });
    // Stock
    const stock=new THREE.Mesh(new THREE.BoxGeometry(0.045,0.055,0.22),bodyMat2);
    stock.position.set(0,-0.02,0.34); gunGroup.add(stock);
    // Heat shield
    const shield=new THREE.Mesh(new THREE.BoxGeometry(0.08,0.032,0.28),metalMat);
    shield.position.set(0,0.04,-0.12); gunGroup.add(shield);

  } else if (wc === WEAPON_CONFIGS.pistol) {
    // P226
    const body=new THREE.Mesh(new THREE.BoxGeometry(0.055,0.065,0.22),bodyMat); gunGroup.add(body);
    const mag=new THREE.Mesh(new THREE.BoxGeometry(0.038,0.095,0.04),bodyMat);
    mag.position.set(0,-0.08,0.06); gunGroup.add(mag);
    const grip=new THREE.Mesh(new THREE.BoxGeometry(0.045,0.09,0.055),gripMat);
    grip.position.set(0,-0.09,0.1); gunGroup.add(grip);
    const barrel=new THREE.Mesh(new THREE.CylinderGeometry(0.01,0.01,0.16,6),metalMat);
    barrel.rotation.z=Math.PI/2; barrel.position.set(0,-0.005,-0.17); gunGroup.add(barrel);
    // Slide serrations
    for(let i=0;i<4;i++){
      const s=new THREE.Mesh(new THREE.BoxGeometry(0.004,0.02,0.032),metalMat);
      s.position.set(0.028,0.015,-0.02+i*0.04); gunGroup.add(s);
    }

  } else if (wc === WEAPON_CONFIGS.m249) {
    // M249 LMG - bigger, heavier looking
    const body=new THREE.Mesh(new THREE.BoxGeometry(0.09,0.075,0.6),bodyMat); gunGroup.add(body);
    // Box mag
    const boxMag=new THREE.Mesh(new THREE.BoxGeometry(0.085,0.12,0.12),bodyMat);
    boxMag.position.set(0,-0.11,-0.1); gunGroup.add(boxMag);
    // Barrel (long+thick)
    const barrel=new THREE.Mesh(new THREE.CylinderGeometry(0.018,0.018,0.48,8),metalMat);
    barrel.rotation.z=Math.PI/2; barrel.position.set(0,-0.006,-0.52); gunGroup.add(barrel);
    // Bipod
    [-0.035,0.035].forEach(oz=>{
      const leg=new THREE.Mesh(new THREE.BoxGeometry(0.007,0.14,0.007),metalMat);
      leg.position.set(0,-0.11,-0.3); leg.rotation.z=oz>0?0.25:-0.25; gunGroup.add(leg);
    });
    // Heat guard
    const hg=new THREE.Mesh(new THREE.CylinderGeometry(0.028,0.028,0.36,6),metalMat);
    hg.rotation.z=Math.PI/2; hg.position.set(0,-0.006,-0.35); gunGroup.add(hg);

  } else {
    // Default: AR/SMG (M4A1, AK-47, MP5, UMP45)
    const isAK = wc === WEAPON_CONFIGS.ak47;
    const isMp5= wc === WEAPON_CONFIGS.mp5;

    const body=new THREE.Mesh(new THREE.BoxGeometry(0.072,0.062,0.44),bodyMat); gunGroup.add(body);

    // AK wooden parts
    if (isAK) {
      const stock=new THREE.Mesh(new THREE.BoxGeometry(0.048,0.048,0.26),bodyMat2);
      stock.position.set(0,0.005,0.32); gunGroup.add(stock);
      const hGuard=new THREE.Mesh(new THREE.BoxGeometry(0.058,0.04,0.18),bodyMat2);
      hGuard.position.set(0,-0.04,-0.14); gunGroup.add(hGuard);
      // Curved mag
      const mag=new THREE.Mesh(new THREE.BoxGeometry(0.04,0.16,0.06),bodyMat2);
      mag.position.set(0,-0.11,0.02); mag.rotation.z=0.12; gunGroup.add(mag);
    } else {
      // Standard mag + grip
      const mag=new THREE.Mesh(new THREE.BoxGeometry(0.04,0.14,0.055),bodyMat);
      mag.position.set(0,-0.1,0.04); gunGroup.add(mag);
      const grip=new THREE.Mesh(new THREE.BoxGeometry(0.036,0.08,0.054),gripMat);
      grip.position.set(0,-0.09,0.17); gunGroup.add(grip);
      // Stock
      const stock=new THREE.Mesh(new THREE.BoxGeometry(0.042,0.046,0.22),bodyMat);
      stock.position.set(0,0.004,0.3); gunGroup.add(stock);
      // Buffer tube
      const tube=new THREE.Mesh(new THREE.CylinderGeometry(0.016,0.016,0.14,8),metalMat);
      tube.rotation.z=Math.PI/2; tube.position.set(0,0.02,0.44); gunGroup.add(tube);
    }

    // Barrel
    const barrelLen = isMp5 ? 0.26 : 0.32;
    const barrel=new THREE.Mesh(new THREE.CylinderGeometry(0.012,0.012,barrelLen,8),metalMat);
    barrel.rotation.z=Math.PI/2; barrel.position.set(0,-0.007,-(0.22+barrelLen/2)); gunGroup.add(barrel);

    // Muzzle device
    const muzzleDev=new THREE.Mesh(new THREE.CylinderGeometry(0.018,0.014,0.06,8),metalMat);
    muzzleDev.rotation.z=Math.PI/2; muzzleDev.position.set(0,-0.007,-(0.22+barrelLen+0.03)); gunGroup.add(muzzleDev);

    // Top rail
    const rail=new THREE.Mesh(new THREE.BoxGeometry(0.032,0.016,0.3),railMat);
    rail.position.set(0,0.04,0.02); gunGroup.add(rail);
    for(let i=0;i<6;i++){
      const rs=new THREE.Mesh(new THREE.BoxGeometry(0.034,0.008,0.004),metalMat);
      rs.position.set(0,0.048,0.14-i*0.05); gunGroup.add(rs);
    }

    // Iron sight front
    const sf=new THREE.Mesh(new THREE.BoxGeometry(0.007,0.02,0.007),metalMat);
    sf.position.set(0,0.05,-(0.22+barrelLen-0.04)); gunGroup.add(sf);
    // Iron sight rear (aperture)
    const sr=new THREE.Mesh(new THREE.BoxGeometry(0.022,0.018,0.007),metalMat);
    sr.position.set(0,0.048,0.14); gunGroup.add(sr);
    const srHole=new THREE.Mesh(new THREE.BoxGeometry(0.006,0.006,0.009),new THREE.MeshBasicMaterial({color:0x000000}));
    srHole.position.set(0,0.048,0.14); gunGroup.add(srHole);
  }

  // ── MUZZLE FLASH ──
  const muzzleGeo = new THREE.SphereGeometry(0.065, 7, 5);
  const muzzleMt  = new THREE.MeshBasicMaterial({ color:0xffdd44, transparent:true, opacity:0, depthWrite:false });
  muzzleMesh = new THREE.Mesh(muzzleGeo, muzzleMt);
  const bLen = wc===WEAPON_CONFIGS.sniper ? 0.82 : wc===WEAPON_CONFIGS.shotgun ? 0.56 : wc===WEAPON_CONFIGS.pistol ? 0.3 : wc===WEAPON_CONFIGS.m249 ? 0.76 : 0.56;
  muzzleMesh.position.set(0, -0.007, -bLen);
  gunGroup.add(muzzleMesh);
  muzzleLight = new THREE.PointLight(0xff8800, 0, 5);
  muzzleLight.position.copy(muzzleMesh.position);
  gunGroup.add(muzzleLight);

  // Position gun (right hand side, lower right of view)
  gunGroup.position.set(0.16, -0.16, -0.36);
  camera.add(gunGroup);

  // Also rebuild FPS body
  buildFPSBody();
}

// ── SHOOT ──
function shoot() {
  if (!gameActive || reloading || parachuteActive) return;
  const now = Date.now();
  const wc  = currentWeaponConfig || WEAPON_CONFIGS.m4a1;
  if (now - lastShot < wc.fireRate) return;
  if (ammo <= 0) { if (ammoRes > 0) reload(); return; }

  lastShot = now; ammo--; shotsFired++;
  updateInventoryBar();

  // Muzzle flash
  muzzleMesh.material.opacity = 1;
  muzzleLight.intensity = 4;
  setTimeout(() => {
    if (muzzleMesh) muzzleMesh.material.opacity = 0;
    if (muzzleLight) muzzleLight.intensity = 0;
  }, 50);

  recoilZ = 0.055;
  pitch  -= wc.spread * (0.4 + Math.random());
  pitch   = Math.max(-1.2, Math.min(1.2, pitch));

  // Arm kick animation
  if (fpsBody && fpsBody.userData.rightArm) {
    fpsBody.userData.rightArm.rotation.x -= 0.04;
  }

  playSound('shoot');
  if (LD.settings.vib && navigator.vibrate) navigator.vibrate(10);

  const shots = wc === WEAPON_CONFIGS.shotgun ? 7 : 1;
  for (let s = 0; s < shots; s++) {
    const sx = (Math.random()-0.5) * wc.spread * (s===0?0:3);
    const sy = (Math.random()-0.5) * wc.spread * (s===0?0:2);
    doRaycast(sx, sy);
  }

  // Spawn bullet tracer
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  const from = camera.position.clone();
  tracerLine(from, from.clone().add(dir.multiplyScalar(120)));
  const mwp = new THREE.Vector3();
  if (muzzleMesh) muzzleMesh.getWorldPosition(mwp);
  spawnParticles(mwp, 0xddddbb, 2);
}

function doRaycast(spreadX=0, spreadY=0) {
  const wc  = currentWeaponConfig || WEAPON_CONFIGS.m4a1;
  const ray = new THREE.Raycaster();
  ray.setFromCamera(new THREE.Vector2(spreadX, spreadY), camera);
  const dir = ray.ray.direction.clone();

  let closest = null, minD = Infinity, isHeadshot = false;

  for (const bot of bots) {
    if (bot.dead) continue;
    const dist = camera.position.distanceTo(bot.g.position);
    if (dist > (wc.range||80)*1.2) continue;

    // Head hitbox
    const headPos = bot.g.position.clone(); headPos.y += 1.82;
    const toHead  = new THREE.Vector3().subVectors(headPos, camera.position);
    const projH   = toHead.dot(dir);
    if (projH > 0) {
      const nearH = camera.position.clone().add(dir.clone().multiplyScalar(projH));
      if (nearH.distanceTo(headPos) < 0.28 && projH < minD) {
        minD = projH; closest = bot; isHeadshot = true; continue;
      }
    }

    // Body hitbox
    const bodyPos = bot.g.position.clone(); bodyPos.y += 0.9;
    const toBody  = new THREE.Vector3().subVectors(bodyPos, camera.position);
    const projB   = toBody.dot(dir);
    if (projB < 0) continue;
    const nearB = camera.position.clone().add(dir.clone().multiplyScalar(projB));
    if (nearB.distanceTo(bodyPos) < 0.65 && projB < minD) {
      minD = projB; closest = bot; isHeadshot = false;
    }
  }

  if (closest) {
    shotsHit++;
    let dmg = wc.dmg[0] + Math.random()*(wc.dmg[1]-wc.dmg[0]);
    if (isHeadshot) { dmg *= 2.2; headshotCount++; showHeadshot(); playSound('headshot'); }
    showHit();
    hitBot(closest, dmg);
    if (LD.settings.vib && navigator.vibrate) navigator.vibrate(16);
  }
}

// ── RELOAD ──
function reload() {
  if (reloading || ammoRes <= 0 || ammo >= (currentWeaponConfig?.ammo||30)) return;
  reloading = true;
  playSound('reload');
  document.getElementById('reload-txt').style.opacity = '1';
  setTimeout(() => {
    if (!gameActive) return;
    reloading = false;
    const wc   = currentWeaponConfig || WEAPON_CONFIGS.m4a1;
    const need = wc.ammo - ammo;
    const take = Math.min(need, ammoRes);
    ammo    += take;
    ammoRes -= take;
    if (inventory.weapons[inventory.active]) {
      inventory.weapons[inventory.active].ammo = ammo;
      inventory.weapons[inventory.active].res  = ammoRes;
    }
    document.getElementById('reload-txt').style.opacity = '0';
    updateInventoryBar();
  }, currentWeaponConfig?.reload || 1800);
}

// ── TOGGLE ADS ──
function toggleADS() {
  adsActive = !adsActive;
  const btn = document.getElementById('btn-ads');
  if (btn) btn.classList.toggle('active', adsActive);

  if (adsActive && currentWeaponConfig === WEAPON_CONFIGS.sniper) {
    document.getElementById('scope-overlay').style.display = 'block';
    document.getElementById('xhair').style.display = 'none';
    if (camera) { camera.fov = 18; camera.updateProjectionMatrix(); }
    if (gunGroup) gunGroup.visible = false;
  } else {
    document.getElementById('scope-overlay').style.display = 'none';
    document.getElementById('xhair').style.display = 'block';
    if (camera) { camera.fov = LD.settings.fov||80; camera.updateProjectionMatrix(); }
    if (gunGroup) gunGroup.visible = true;
    if (adsActive && camera) { camera.fov = (LD.settings.fov||80)*0.65; camera.updateProjectionMatrix(); }
  }
}

// ── LOOT ──
function checkNearbyLoot() {
  nearbyLoot = null;
  for (const l of lootItems) {
    if (l.taken) continue;
    const d = Math.sqrt((camera.position.x-l.x)**2 + (camera.position.z-l.z)**2);
    if (d < 3.5) {
      nearbyLoot = l;
      const hint = document.getElementById('pickup-hint');
      hint.classList.add('show');
      const desc = l.type==='weapon' ? (WEAPON_CONFIGS[l.wKey]?.name||l.wKey) : l.item?.toUpperCase();
      hint.textContent = isAndroid ? '📦 YAĞMALA' : `[ E ] ${desc}`;
      return;
    }
  }
  document.getElementById('pickup-hint').classList.remove('show');
}

function pickupLoot() {
  if (!nearbyLoot || nearbyLoot.taken || !gameActive) return;
  const l = nearbyLoot;
  l.taken = true;
  scene.remove(l.mesh);
  if (l.gl) scene.remove(l.gl);
  playSound('loot');
  if (LD.settings.vib && navigator.vibrate) navigator.vibrate(28);

  if (l.type === 'weapon') {
    const wk = l.wKey;
    const wc = WEAPON_CONFIGS[wk];
    const slot = inventory.weapons[1] === null ? 1 : inventory.active === 0 ? 1 : 0;
    inventory.weapons[slot] = { ...wc, ammo:wc.ammo, res:wc.res, key:wk };
    showLootPopup(`🔫 ${wc.name} ALINDI!`, l.rarity);
    updateInventoryBar();
  } else {
    const item = l.item;
    if (item==='medkit')  { inventory.medkits = Math.min(5, inventory.medkits+1); showLootPopup('💊 İLK YARDIM ALINDI'); }
    if (item==='armor')   { armor = Math.min(maxArmor, armor+25); updateHP(); showLootPopup('🛡 ZIRH +25'); }
    if (item==='helmet')  { inventory.hasHelmet = true; showLootPopup('⛑ KASK ALINDI!'); }
    if (item==='ammo')    { ammoRes = Math.min(ammoRes+60, 300); showLootPopup('🔋 CEPHANe +60'); updateInventoryBar(); }
    if (item==='grenade') { inventory.grenades = Math.min(3, inventory.grenades+1); showLootPopup('💣 EL BOMBASI'); }
    updateInventoryBar();
  }
}

function useMedkit() {
  if (inventory.medkits <= 0 || playerHP >= maxHP) return;
  inventory.medkits--;
  playerHP = Math.min(maxHP, playerHP + 50);
  updateHP();
  updateInventoryBar();
  showLootPopup('💊 +50 SAĞLIK');
  playSound('loot');
}

function switchWeaponSlot(slot) {
  const idx = slot - 1;
  if (!inventory.weapons[idx]) return;
  inventory.active = idx;
  currentWeaponConfig = inventory.weapons[idx];
  ammo    = inventory.weapons[idx].ammo;
  ammoRes = inventory.weapons[idx].res;
  buildGun();
  updateInventoryBar();
  if (adsActive) { adsActive = false; toggleADS(); }
}

// ── HUD UPDATES ──
function updateInventoryBar() {
  [0,1].forEach(i => {
    const slot = document.getElementById('ws'+(i+1));
    if (!slot) return;
    const w = inventory.weapons[i];
    if (w) {
      slot.classList.remove('empty');
      slot.classList.toggle('active', inventory.active===i);
      document.getElementById(`ws${i+1}-icon`).textContent = WEAPON_CONFIGS[w.key]?.icon || '🔫';
      document.getElementById(`ws${i+1}-name`).textContent = WEAPON_CONFIGS[w.key]?.name || w.key;
      document.getElementById(`ws${i+1}-ammo`).textContent =
        `${inventory.active===i ? ammo : w.ammo}/${inventory.active===i ? ammoRes : w.res}`;
    } else {
      slot.classList.add('empty');
      document.getElementById(`ws${i+1}-icon`).textContent = '⬜';
      document.getElementById(`ws${i+1}-name`).textContent = 'BOŞ';
      document.getElementById(`ws${i+1}-ammo`).textContent = '—';
    }
  });
  const med = document.getElementById('inv-medkits');
  const hel = document.getElementById('inv-helmet');
  if (med) med.textContent = inventory.medkits;
  if (hel) hel.textContent = inventory.hasHelmet ? '✓' : 'YOK';
}

function updateHP() {
  const hpFill = document.getElementById('hp-fill-br');
  const hpVal  = document.getElementById('hp-val');
  const arFill = document.getElementById('armor-fill');
  const arVal  = document.getElementById('armor-val');
  if (hpFill) hpFill.style.width  = (playerHP / maxHP * 100) + '%';
  if (hpVal)  hpVal.textContent   = Math.ceil(playerHP);
  if (arFill) arFill.style.width  = (armor / maxArmor * 100) + '%';
  if (arVal)  arVal.textContent   = Math.ceil(armor);
}

function takeDamage(dmg, src) {
  // Armor absorbs
  if (armor > 0) {
    const ab = Math.min(armor, dmg * 0.6);
    armor    -= ab;
    dmg      -= ab;
  }
  if (inventory.hasHelmet && Math.random() < 0.15) dmg *= 0.5;
  playerHP -= dmg;
  updateHP();

  // Screen flash
  const dmgEl = document.getElementById('dmg');
  if (dmgEl) { dmgEl.style.opacity = '1'; setTimeout(() => { dmgEl.style.opacity='0'; }, 120); }
  if (LD.settings.vib && navigator.vibrate) navigator.vibrate(25);

  if (playerHP <= 0) die(src);
}

// ── PARTICLES ──
function spawnParticles(pos, color, count=4) {
  for (let i = 0; i < count; i++) {
    const p = new THREE.Mesh(
      new THREE.SphereGeometry(0.05, 4, 3),
      new THREE.MeshBasicMaterial({ color })
    );
    p.position.copy(pos);
    const v = new THREE.Vector3((Math.random()-0.5)*8,(Math.random()-0.5)*8,(Math.random()-0.5)*8);
    scene.add(p);
    particles.push({ mesh:p, vel:v, life:0.4 });
  }
}

function updateParticles(dt) {
  particles = particles.filter(p => {
    p.life -= dt;
    p.mesh.position.addScaledVector(p.vel, dt);
    p.vel.y -= 12*dt;
    p.mesh.material.opacity = p.life / 0.4;
    if (p.life <= 0) { scene.remove(p.mesh); return false; }
    return true;
  });
}

function tracerLine(from, to) {
  const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
  const mat = new THREE.LineBasicMaterial({ color:0xffee88, transparent:true, opacity:0.55 });
  const line= new THREE.Line(geo, mat);
  scene.add(line);
  setTimeout(() => scene.remove(line), 55);
}

// ── HUD FX ──
function showHit() {
  const h = document.getElementById('hit');
  if (!h) return;
  h.style.opacity = '1';
  setTimeout(() => { h.style.opacity='0'; }, 80);
}
function showHeadshot() {
  const h = document.getElementById('headshot-txt');
  if (!h) return;
  h.classList.remove('show');
  void h.offsetWidth;
  h.classList.add('show');
}
function showLootPopup(msg, rarity='') {
  const el = document.getElementById('loot-popup');
  if (!el) return;
  el.textContent = msg;
  const cols = { epic:'#cc44ff', rare:'#4488ff', uncommon:'#44cc88', common:'#aaa' };
  el.style.borderColor = cols[rarity] || '#ffcc44';
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 1800);
}
function addKillFeed(name, isPro) {
  const kf = document.getElementById('kfeed');
  if (!kf) return;
  const item = document.createElement('div');
  item.className = 'kf-item';
  item.textContent = `${LD.playerName} → ${name}${isPro?' ⭐':''}`;
  kf.appendChild(item);
  setTimeout(() => item.remove(), 2500);
}
function updateMinimap() {
  const cv = document.getElementById('minimap');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  const scale = W / (zoneRadius * 2 + 30);
  const ox = W/2 - camera.position.x * scale;
  const oz = H/2 - camera.position.z * scale;

  ctx.clearRect(0,0,W,H);

  // Background
  ctx.fillStyle = 'rgba(0,10,0,0.85)';
  ctx.fillRect(0,0,W,H);

  // Safe zone circle
  ctx.beginPath();
  ctx.arc(W/2, H/2, zoneRadius*scale, 0, Math.PI*2);
  ctx.strokeStyle = 'rgba(0,150,255,0.7)';
  ctx.lineWidth   = 1.5;
  ctx.stroke();

  // Buildings
  ctx.fillStyle = 'rgba(100,80,50,0.7)';
  buildings.forEach(b => {
    const bx = b.cx*scale + ox;
    const bz = b.cz*scale + oz;
    ctx.fillRect(bx-3, bz-3, 6, 6);
  });

  // Bots
  bots.forEach(bot => {
    if (bot.dead) return;
    const bx = bot.g.position.x*scale + ox;
    const bz = bot.g.position.z*scale + oz;
    ctx.beginPath();
    ctx.arc(bx, bz, 2, 0, Math.PI*2);
    ctx.fillStyle = bot.isPro ? '#ff8800' : '#ff4444';
    ctx.fill();
  });

  // Loot
  lootItems.forEach(l => {
    if (l.taken) return;
    const lx = l.x*scale + ox;
    const lz = l.z*scale + oz;
    ctx.beginPath();
    ctx.arc(lx, lz, 1.5, 0, Math.PI*2);
    ctx.fillStyle = '#ffcc44';
    ctx.fill();
  });

  // Player (center with direction indicator)
  ctx.beginPath();
  ctx.arc(W/2, H/2, 4, 0, Math.PI*2);
  ctx.fillStyle = '#44ff88';
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(W/2, H/2);
  ctx.lineTo(W/2 + Math.sin(-yaw)*10, H/2 + Math.cos(-yaw)*10);
  ctx.strokeStyle = '#44ff88';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

// ── CONTROLS ──
function setupControls() {
  document.addEventListener('keydown', e => {
    keys[e.key] = true;
    if (e.key==='e'||e.key==='E') { pickupLoot(); }
    if (e.key==='r'||e.key==='R') reload();
    if (e.key===' ') {
      if (camera._vy===0) { camera._vy = 8; playSound('jump'); }
      e.preventDefault();
    }
    if (e.key==='q'||e.key==='Q') useMedkit();
    if (e.key==='Tab') {
      const other = (inventory.active+1)%2;
      if (inventory.weapons[other]) switchWeaponSlot(other+1);
      e.preventDefault();
    }
    if (e.key==='f'||e.key==='F') toggleADS();
  });
  document.addEventListener('keyup', e => { keys[e.key] = false; });
  document.addEventListener('mousemove', e => {
    if (!document.pointerLockElement || !gameActive) return;
    const sens = LD.settings.sens * 0.0014;
    yaw   -= e.movementX * sens;
    pitch -= e.movementY * sens * 0.85;
    pitch  = Math.max(-1.2, Math.min(1.2, pitch));
  });
  document.addEventListener('mousedown', e => {
    if (e.button===0 && gameActive) shoot();
    if (e.button===2 && gameActive) toggleADS();
  });
  document.addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('click', () => {
    if (gameActive && !document.pointerLockElement) renderer.domElement.requestPointerLock();
  });
  document.addEventListener('wheel', e => {
    if (!gameActive) return;
    const other = (inventory.active+1)%2;
    if (inventory.weapons[other]) switchWeaponSlot(other+1);
  });
  window.addEventListener('deviceorientation', e => {
    if (!gyroEnabled) return;
    lastGyro = { x:(e.beta||0)*0.017, z:(e.gamma||0)*0.017 };
  });
}

// ── TOUCH CONTROLS ──
let joyX=0, joyY=0, joyActive=false, joyStartX=0, joyStartY=0;
let lookStartX=0, lookStartY=0, lookId=null;
let autoFireInterval=null;

function setupTouchControls() {
  const jz = document.getElementById('joy-zone');
  const jt = document.getElementById('joy-thumb');

  jz.addEventListener('touchstart', e=>{
    const t=e.changedTouches[0];
    joyActive=true; joyStartX=t.clientX; joyStartY=t.clientY; e.preventDefault();
  },{passive:false});
  jz.addEventListener('touchmove', e=>{
    const t=e.changedTouches[0];
    const dx=t.clientX-joyStartX, dy=t.clientY-joyStartY;
    const r=Math.min(Math.sqrt(dx*dx+dy*dy),55);
    const ang=Math.atan2(dy,dx);
    jt.style.transform=`translate(calc(-50% + ${Math.cos(ang)*r}px),calc(-50% + ${Math.sin(ang)*r}px))`;
    joyX=Math.cos(ang)*(r/55); joyY=Math.sin(ang)*(r/55); e.preventDefault();
  },{passive:false});
  jz.addEventListener('touchend',()=>{
    joyX=0; joyY=0; jt.style.transform='translate(-50%,-50%)';
  },{passive:true});

  const lz = document.getElementById('look-zone');
  lz.addEventListener('touchstart',e=>{const t=e.changedTouches[0];lookId=t.identifier;lookStartX=t.clientX;lookStartY=t.clientY;},{passive:true});
  lz.addEventListener('touchmove',e=>{
    for(const t of e.changedTouches){
      if(t.identifier!==lookId)continue;
      const dx=t.clientX-lookStartX, dy=t.clientY-lookStartY;
      lookStartX=t.clientX; lookStartY=t.clientY;
      if(!gameActive&&!parachuteActive)return;
      const s=LD.settings.sens*0.003;
      yaw-=dx*s; pitch-=dy*s*0.85;
      pitch=Math.max(-1.2,Math.min(1.2,pitch));
    }
  },{passive:true});

  const btnFire = document.getElementById('btn-fire');
  btnFire.addEventListener('touchstart',e=>{e.preventDefault();if(gameActive)shoot();},{passive:false});
  if (LD.settings.auto) {
    btnFire.addEventListener('touchmove', e=>{e.preventDefault();if(gameActive)shoot();},{passive:false});
  }
  document.getElementById('btn-ads').addEventListener('touchstart',e=>{e.preventDefault();toggleADS();},{passive:false});
  document.getElementById('btn-reload').addEventListener('touchstart',e=>{e.preventDefault();reload();},{passive:false});
  document.getElementById('btn-jump').addEventListener('touchstart',e=>{
    e.preventDefault();
    if(camera._vy===0){camera._vy=8;playSound('jump');}
  },{passive:false});
  document.getElementById('btn-loot').addEventListener('touchstart',e=>{e.preventDefault();pickupLoot();useMedkit();},{passive:false});
  document.getElementById('btn-swap').addEventListener('touchstart',e=>{
    e.preventDefault();
    const o=(inventory.active+1)%2;
    if(inventory.weapons[o])switchWeaponSlot(o+1);
  },{passive:false});
  document.getElementById('btn-gyro').addEventListener('click',()=>{
    gyroEnabled=!gyroEnabled;
    document.getElementById('btn-gyro').classList.toggle('on',gyroEnabled);
    if(gyroEnabled&&typeof DeviceOrientationEvent.requestPermission==='function'){
      DeviceOrientationEvent.requestPermission().catch(()=>{gyroEnabled=false;});
    }
  });
}
