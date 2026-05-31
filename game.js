// ══════════════════════════════════════════════
//  WAR ZONE v4 — GAME.JS
//  Main loop, Three.js init, zone, plane,
//  win/death screens, FPS limiter
// ══════════════════════════════════════════════

// ── INIT THREE.JS ──
function init() {
  scene    = new THREE.Scene();
  camera   = new THREE.PerspectiveCamera(LD.settings.fov||80, innerWidth/innerHeight, 0.08, 800);
  camera.position.set(0, 1.7, 10);
  camera._vy = 0; // vertical velocity

  renderer = new THREE.WebGLRenderer({ antialias: LD.settings.gfx > 1, powerPreference:'high-performance' });
  renderer.setPixelRatio(LD.settings.gfx === 3 ? window.devicePixelRatio : Math.min(window.devicePixelRatio, 1.5));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled  = LD.settings.gfx === 3;
  renderer.shadowMap.type     = THREE.PCFSoftShadowMap;
  renderer.outputEncoding     = THREE.sRGBEncoding || 3001;
  document.body.appendChild(renderer.domElement);
  renderer.domElement.style.position = 'fixed';
  renderer.domElement.style.top = '0';
  renderer.domElement.style.left= '0';
  renderer.domElement.style.zIndex = '1';

  clock = new THREE.Clock();

  setupControls();
  if (isAndroid) setupTouchControls();

  window.addEventListener('resize', onResize);
  onResize();

  // Start background render loop (renders lobby backdrop)
  requestAnimationFrame(gameLoop);
}

function onResize() {
  if (!renderer || !camera) return;
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}

// ══════════════════════════════════════════════
//  MAIN GAME LOOP
// ══════════════════════════════════════════════
function gameLoop(timestamp) {
  requestAnimationFrame(gameLoop);

  // ── FPS LIMITER ──
  const limit = LD.settings.fpsLimit;
  if (limit > 0) {
    const interval = 1000 / limit;
    if (timestamp - lastFrameTime < interval) return;
  }
  lastFrameTime = timestamp;

  // ── FPS COUNTER ──
  fpsCounter++;
  fpsTime += clock.getDelta();
  if (fpsTime >= 1.0) {
    fpsDisplay = fpsCounter;
    fpsCounter = 0; fpsTime = 0;
    const fpsel = document.getElementById('fps-counter');
    if (fpsel) fpsel.textContent = fpsDisplay + ' FPS';
    const lobbyFps = document.getElementById('lobby-fps-display');
    if (lobbyFps) lobbyFps.textContent = 'FPS: ' + fpsDisplay;
  }
  // Re-get dt after getDelta above consumed it
  const rawDt = clock.getDelta ? 0 : 0; // clock.getDelta was already called
  const dt = Math.min(0.05, 1/Math.max(fpsDisplay, 20));

  if (!gameActive && planePhase !== 'chuting') {
    renderer.render(scene, camera);
    return;
  }

  // ── PARACHUTE DESCENT ──
  if (parachuteActive) {
    const descentSpd = 14 + (keys['s']||joyY>0.2 ? 8 : 0) - (keys[' ']||keys['w']||joyY<-0.2 ? 4 : 0);
    camera.position.y -= descentSpd * dt;

    // Horizontal drift
    const fwd   = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
    const right = new THREE.Vector3(-Math.sin(yaw+Math.PI/2), 0, -Math.cos(yaw+Math.PI/2));
    if (keys['w']||joyY<-0.2) camera.position.addScaledVector(fwd,   8*dt);
    if (keys['s']||joyY>0.2)  camera.position.addScaledVector(fwd,  -4*dt);
    if (keys['a']||joyX<-0.2) camera.position.addScaledVector(right,-6*dt);
    if (keys['d']||joyX>0.2)  camera.position.addScaledVector(right, 6*dt);

    // Update altitude display
    const chuteEl = document.getElementById('chute-hint');
    if (chuteEl && camera.position.y > 2) {
      chuteEl.textContent = `🪂 PARAŞÜT · ${Math.floor(camera.position.y)}m · İniş için bekle...`;
    }

    if (camera.position.y <= 1.72) {
      camera.position.y = 1.72;
      parachuteActive   = false;
      planePhase        = 'landed';
      if (chuteEl) chuteEl.style.display = 'none';
      camera._vy = 0;
    }
    camera.rotation.set(pitch, yaw, 0, 'YXZ');
    renderer.render(scene, camera);
    updateMinimap();
    return;
  }

  const spd = CHAR_CONFIGS[LD.selectedChar]?.speed || 0.072;
  const speedMult = adsActive ? 0.55 : 1.0;

  // ── HORIZONTAL MOVEMENT ──
  const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
  const right   = new THREE.Vector3(-Math.sin(yaw+Math.PI/2), 0, -Math.cos(yaw+Math.PI/2));
  let dx = 0, dz = 0;

  if (keys['w']||keys['W']||joyY<-0.25) { dx+=forward.x; dz+=forward.z; }
  if (keys['s']||keys['S']||joyY>0.25)  { dx-=forward.x; dz-=forward.z; }
  if (keys['a']||keys['A']||joyX<-0.25) { dx-=right.x;   dz-=right.z;   }
  if (keys['d']||keys['D']||joyX>0.25)  { dx+=right.x;   dz+=right.z;   }

  const len = Math.sqrt(dx*dx+dz*dz);
  if (len > 0) {
    dx /= len; dz /= len;
    const step = spd * speedMult * 60 * dt;
    const nx   = camera.position.x + dx * step;
    const nz   = camera.position.z + dz * step;
    // Collision
    if (!collidesBuilding(nx, camera.position.z)) camera.position.x = nx;
    if (!collidesBuilding(camera.position.x, nz)) camera.position.z = nz;
    // Keep in bounds
    camera.position.x = Math.max(-290, Math.min(290, camera.position.x));
    camera.position.z = Math.max(-290, Math.min(290, camera.position.z));
  }

  // ── GRAVITY / JUMP ──
  camera._vy -= 22 * dt;
  camera.position.y += camera._vy * dt;
  if (camera.position.y <= 1.72) {
    camera.position.y = 1.72;
    camera._vy = 0;
  }

  // ── BOB ──
  if (len > 0) {
    bobT += dt * (adsActive ? 4 : 7);
    const bobAmt = adsActive ? 0.006 : 0.018;
    if (gunGroup) {
      gunGroup.position.y = -0.16 + Math.sin(bobT)*bobAmt;
      gunGroup.rotation.z  = Math.sin(bobT*0.5)*0.01;
    }
    if (fpsBody) {
      fpsBody.position.y = Math.sin(bobT)*bobAmt*0.7;
    }
  } else {
    if (gunGroup) { gunGroup.position.y += (-0.16-gunGroup.position.y)*0.12; }
  }

  // ── RECOIL RECOVERY ──
  if (recoilZ > 0) {
    recoilZ = Math.max(0, recoilZ - 0.25*dt*60);
    if (gunGroup) gunGroup.position.z = -0.36 + recoilZ;
  }

  // ── ARM RECOVERY ──
  if (fpsBody?.userData.rightArm) {
    fpsBody.userData.rightArm.rotation.x += (-0.35 - fpsBody.userData.rightArm.rotation.x) * 0.18;
  }

  // ── GYRO ──
  if (gyroEnabled && lastGyro) {
    yaw   -= lastGyro.z * LD.settings.sens * 0.012;
    pitch -= lastGyro.x * LD.settings.sens * 0.010;
    pitch  = Math.max(-1.2, Math.min(1.2, pitch));
  }

  camera.rotation.set(pitch, yaw, 0, 'YXZ');

  // ── AUTO FIRE ──
  if (LD.settings.auto && (keys[' ']||false)) shoot();

  // ── ZONE ──
  updateZone(dt);

  // ── BOT AI ──
  updateBots(dt);

  // ── BULLETS (unused - direct raycast) ──
  // updateBullets(dt);

  // ── PARTICLES ──
  updateParticles(dt);

  // ── LOOT CHECK ──
  checkNearbyLoot();

  // ── LOOT ANIMATION ──
  const lT = performance.now() * 0.001;
  lootItems.forEach(l => {
    if (!l.taken) {
      l.mesh.position.y = 0.22 + Math.sin(lT*2.2 + l.x*0.1)*0.08;
      l.mesh.rotation.y += dt * 1.4;
    }
  });

  // ── GRASS SWAY (high quality only) ──
  if (LD.settings.gfx === 3 && LD.settings.foliage > 1) {
    foliageObjects.forEach((f, fi) => {
      f.rotation.z = Math.sin(lT*1.5 + fi*0.12)*0.06;
    });
  }

  renderer.render(scene, camera);
  updateMinimap();
}

// ── ZONE SYSTEM ──
function updateZone(dt) {
  if (zonePhase >= ZONE_PHASES.length) return;
  const phase = ZONE_PHASES[zonePhase];
  zoneTimer -= dt;

  const ztEl = document.getElementById('s-zone-timer');
  if (ztEl) ztEl.textContent = Math.ceil(Math.max(0,zoneTimer)) + 's';

  // Shrink ring
  if (zoneRadius > phase.shrinkTo) {
    const spd = (zoneRadius - phase.shrinkTo) / Math.max(zoneTimer, 1);
    zoneRadius = Math.max(phase.shrinkTo, zoneRadius - spd*dt*0.85);
    updateZoneCircle();
  }

  // Outside zone damage
  const dx   = camera.position.x - zoneCenter.x;
  const dz   = camera.position.z - zoneCenter.z;
  const dist = Math.sqrt(dx*dx + dz*dz);
  playerInZone = dist <= zoneRadius;
  const warn = document.getElementById('zone-warning');
  if (!playerInZone) {
    if (warn) warn.classList.add('show');
    zoneDamageTimer += dt;
    if (zoneDamageTimer >= 0.5) {
      zoneDamageTimer = 0;
      takeDamage(phase.dmg, 'BÖLGE');
      playSound('zone');
    }
  } else {
    if (warn) warn.classList.remove('show');
    zoneDamageTimer = 0;
  }

  if (zoneTimer <= 0) {
    zonePhase++;
    if (zonePhase < ZONE_PHASES.length) zoneTimer = ZONE_PHASES[zonePhase].duration;
  }

  // Nearest zone name
  let best = null, bestD = Infinity;
  MAP_ZONES.forEach(z => {
    const d = Math.sqrt((camera.position.x-z.x)**2 + (camera.position.z-z.z)**2);
    if (d < bestD) { bestD=d; best=z; }
  });
  if (best) {
    const znEl = document.getElementById('s-zone-name');
    const mmzn = document.getElementById('mm-zone-name');
    if (znEl) znEl.textContent = best.name;
    if (mmzn) mmzn.textContent = best.name;
  }
}

// ── LAUNCH GAME (from lobby play button) ──
function launchGame() {
  ensureAudio();
  document.getElementById('lobby').style.display = 'none';
  document.getElementById('plane-ui').style.display = 'flex';

  planePhase    = 'flying';
  planeProgress = 0;

  // Setup character/weapon
  const wc = WEAPON_CONFIGS[LD.selectedWeapon] || WEAPON_CONFIGS.m4a1;
  currentWeaponConfig = wc;
  const cc = CHAR_CONFIGS[LD.selectedChar] || CHAR_CONFIGS.soldier;
  maxHP    = cc.maxHP;
  playerHP = maxHP;
  armor    = 0;

  inventory.weapons   = [{ ...wc, ammo:wc.ammo, res:wc.res, key:LD.selectedWeapon }, null];
  inventory.active    = 0;
  inventory.medkits   = 0;
  inventory.grenades  = 0;
  inventory.hasHelmet = false;
  ammo    = wc.ammo;
  ammoRes = wc.res;

  kills = 0; score = 0;
  shotsFired = 0; shotsHit = 0; headshotCount = 0;
  gameStartTime = Date.now();

  aliveCount       = 50;
  zonePhase        = 0;
  zoneTimer        = ZONE_PHASES[0].duration;
  zoneDamageTimer  = 0;
  zoneRadius       = 220;
  zoneTargetRadius = 220;
  zoneCenter       = { x:0, z:0 };

  diffSettings = BOT_LEVELS[LD.selectedDiff] || BOT_LEVELS.normal;

  // Start plane canvas animation
  initPlaneCanvas();

  // Animate progress bar + altitude display
  const pf     = document.getElementById('plane-prog-fill');
  const altEl  = document.getElementById('plane-alt-val');
  const spdEl  = document.getElementById('plane-speed-val');
  const pctEl  = document.getElementById('plane-pct');
  let prog = 0;
  const planeInt = setInterval(() => {
    prog += 1.2;
    if (pf) pf.style.width = Math.min(prog, 100) + '%';
    planeProgress = prog / 100;
    if (pctEl) pctEl.textContent = Math.floor(prog);
    const alt = Math.round(3500 - prog * 8);
    if (altEl) altEl.textContent = Math.max(1800, alt) + 'm';
    if (spdEl) spdEl.textContent = Math.round(320 - prog*0.5) + ' km/s';
    if (prog >= 100) clearInterval(planeInt);
  }, 80);
  window.planeInterval = planeInt;
}

// ── JUMP FROM PLANE ──
function jumpFromPlane() {
  clearInterval(window.planeInterval);
  document.getElementById('plane-ui').style.display = 'none';
  const chuteEl = document.getElementById('chute-hint');
  if (chuteEl) { chuteEl.style.display = 'block'; chuteEl.textContent = '🪂 PARAŞÜT AÇIK · Aşağı iniyor...'; }
  parachuteActive = true;
  planePhase = 'chuting';

  // Spawn player high above random map position
  camera.position.set((Math.random()-0.5)*120, 185, (Math.random()-0.5)*120);
  camera._vy = 0;
  yaw   = Math.random()*Math.PI*2;
  pitch = 0.25;

  beginGame();
}

// ── BEGIN GAME ──
function beginGame() {
  gameActive = true;

  // Clear old scene objects
  bots.forEach(b => scene.remove(b.g));
  bots = [];
  lootItems.forEach(l => { scene.remove(l.mesh); if(l.gl) scene.remove(l.gl); });
  lootItems = [];
  particles.forEach(p => scene.remove(p.mesh));
  particles = [];
  buildings = [];
  foliageObjects = [];

  buildMap();
  buildGun();
  spawnBots(49);

  // Update HUD
  document.getElementById('hud').style.display = 'block';
  updateInventoryBar();
  updateHP();
  updateZoneCircle();
  const aliveEl = document.getElementById('s-alive');
  const scoreEl = document.getElementById('s-score');
  const killsEl = document.getElementById('s-kills');
  if (aliveEl) aliveEl.textContent = 50;
  if (scoreEl) scoreEl.textContent = 0;
  if (killsEl) killsEl.textContent = 0;

  // Show touch controls on mobile
  if (isAndroid) {
    ['joy-zone','look-zone','btn-fire','btn-ads','btn-reload','btn-jump','btn-loot','btn-swap']
      .forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'flex';
      });
    const gyroEl = document.getElementById('btn-gyro');
    if (gyroEl) gyroEl.style.display = 'block';
  } else {
    renderer.domElement.requestPointerLock();
  }
}

// ── DIE ──
function die(killedBy) {
  if (!gameActive) return;
  gameActive = false;
  document.exitPointerLock && document.exitPointerLock();
  document.getElementById('hud').style.display = 'none';
  ['joy-zone','look-zone','btn-fire','btn-ads','btn-reload','btn-jump','btn-loot','btn-swap','btn-gyro']
    .forEach(id => { const el=document.getElementById(id); if(el) el.style.display='none'; });

  LD.gamesPlayed++;
  if (score > LD.bestScore) LD.bestScore = score;
  LD.totalKills += kills;
  const xpGain = calcXpGain(kills, aliveCount+1, LD.selectedMode);
  LD.xp += xpGain;
  saveData();

  const elapsed  = Math.floor((Date.now()-gameStartTime)/1000);
  const accuracy = shotsFired > 0 ? ((shotsHit/shotsFired)*100).toFixed(1) : '0.0';
  const place    = aliveCount + 1;

  document.getElementById('ov-stats').innerHTML = `
    Öldüren: <strong style="color:#ff4444">${killedBy}</strong><br>
    Sıralama: <strong style="color:#ffcc44">#${place}</strong><br>
    Öldürme: <strong style="color:#ffcc44">${kills}</strong><br>
    İsabet: <strong style="color:#44ffcc">${accuracy}%</strong><br>
    Süre: <strong style="color:#44aaff">${Math.floor(elapsed/60)}:${(elapsed%60).toString().padStart(2,'0')}</strong><br>
    XP: <strong style="color:#ffcc44">+${xpGain}</strong>
  `;

  const rg = document.getElementById('rank-gained');
  if (rg) {
    const r = getRank(LD.xp);
    rg.textContent = `${r.icon} ${r.name}`;
    rg.style.color = r.color;
    rg.style.display = 'block';
  }

  playSound('death');
  document.getElementById('overlay').style.display = 'flex';
  saveScoreFirebase(LD.playerName, score, kills, place);
}

// ── WIN ──
function winGame() {
  if (!gameActive) return;
  gameActive = false;
  document.exitPointerLock && document.exitPointerLock();
  document.getElementById('hud').style.display = 'none';
  ['joy-zone','look-zone','btn-fire','btn-ads','btn-reload','btn-jump','btn-loot','btn-swap','btn-gyro']
    .forEach(id => { const el=document.getElementById(id); if(el) el.style.display='none'; });

  LD.gamesPlayed++; LD.wins++;
  if (score > LD.bestScore) LD.bestScore = score;
  LD.totalKills += kills;
  const xpGain = calcXpGain(kills, 1, LD.selectedMode);
  LD.xp += xpGain;
  saveData();

  const elapsed  = Math.floor((Date.now()-gameStartTime)/1000);
  const accuracy = shotsFired>0 ? ((shotsHit/shotsFired)*100).toFixed(1) : '0.0';

  document.getElementById('win-stats').innerHTML = `
    <div style="font-size:13px;line-height:2.2;color:#ccc">
      ⚡ SKOR: <strong style="color:#ffcc44">${score.toLocaleString()}</strong><br>
      💀 ÖLDÜRME: <strong style="color:#ffcc44">${kills}</strong><br>
      🎯 KAFA İSABETİ: <strong style="color:#ff8800">${headshotCount}</strong><br>
      📍 İSABET: <strong style="color:#44ffcc">${accuracy}%</strong><br>
      ⏱ SÜRE: <strong style="color:#44aaff">${Math.floor(elapsed/60)}:${(elapsed%60).toString().padStart(2,'0')}</strong><br>
      👑 XP: <strong style="color:#ffcc44">+${xpGain}</strong>
    </div>`;

  playSound('win');
  if (LD.settings.vib && navigator.vibrate) navigator.vibrate([100,50,100,50,200]);
  document.getElementById('win-screen').style.display = 'flex';
  saveScoreFirebase(LD.playerName, score, kills, 1);

  // Fireworks effect
  for (let i = 0; i < 20; i++) {
    setTimeout(() => {
      const pos = new THREE.Vector3(
        camera.position.x + (Math.random()-0.5)*15,
        camera.position.y + Math.random()*5,
        camera.position.z - 3 - Math.random()*5
      );
      spawnParticles(pos, [0xffcc00,0xff4400,0x44ffcc,0xff44ff][Math.floor(Math.random()*4)], 12);
    }, i*150);
  }
}
