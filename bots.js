// ══════════════════════════════════════════════
//  WAR ZONE v4 — BOTS.JS
//  Realistic humanoid bots with full AI
// ══════════════════════════════════════════════

function spawnBots(count) {
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const dist  = 55 + Math.random() * 120;
    spawnBot(Math.cos(angle)*dist, Math.sin(angle)*dist, i);
  }
}

function spawnBot(x, z, idx) {
  const diff    = diffSettings;
  const isPro   = Math.random() < (idx / 50) * 0.6;
  const botHp   = isPro ? 110 + Math.random()*40 : 55 + Math.random()*40;
  const wKey    = isPro
    ? ['ak47','sniper','m249','shotgun'][Math.floor(Math.random()*4)]
    : ['pistol','m4a1','smg','mp5'][Math.floor(Math.random()*4)];
  const wc   = WEAPON_CONFIGS[wKey];
  const name = BOT_NAMES[idx % BOT_NAMES.length];

  // ── Character Group ──
  const g = new THREE.Group();

  // Body colors (vary per isPro)
  const uniformCol = isPro
    ? new THREE.Color().setHSL(Math.random()*0.15+0.6, 0.6, 0.18)   // dark purple/blue
    : new THREE.Color().setHSL(Math.random()*0.12+0.28, 0.45, 0.28); // olive/khaki

  const skinCol    = new THREE.Color().setHSL(0.07+Math.random()*0.04, 0.5, 0.55+Math.random()*0.15);
  const pantsCol   = isPro
    ? new THREE.Color(0x111122)
    : new THREE.Color().setHSL(0.07, 0.2, 0.22);
  const bootCol    = new THREE.Color(0x1a1208);

  const bodyMat    = new THREE.MeshLambertMaterial({ color: uniformCol });
  const headMat    = new THREE.MeshLambertMaterial({ color: skinCol });
  const legMat     = new THREE.MeshLambertMaterial({ color: pantsCol });
  const armMat     = new THREE.MeshLambertMaterial({ color: uniformCol });
  const bootMat    = new THREE.MeshLambertMaterial({ color: bootCol });
  const helmetMat  = new THREE.MeshLambertMaterial({ color: isPro ? 0x220022 : 0x2a3a2a });
  const metalMat   = new THREE.MeshLambertMaterial({ color: 0x333333 });

  // ── TORSO ──
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.1, 0.4), bodyMat);
  torso.position.y = 0.95; torso.castShadow = true; g.add(torso);

  // Tactical vest
  const vest = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.75, 0.44), new THREE.MeshLambertMaterial({color:isPro?0x1a0a1a:0x2a2a1a}));
  vest.position.y = 0.95; g.add(vest);
  const vestFront = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.55, 0.38), bodyMat);
  vestFront.position.y = 0.95; g.add(vestFront);

  // Vest pouches
  for (let i = -1; i <= 1; i++) {
    const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.06), new THREE.MeshLambertMaterial({color:0x1a1a1a}));
    pouch.position.set(i*0.2, 0.72, 0.22); g.add(pouch);
  }

  // ── HEAD ──
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.52, 0.46), headMat);
  head.position.y = 1.78; head.castShadow = true;
  head.name = 'head';
  g.add(head);

  // Helmet
  const helmet = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.2, 0.52), helmetMat);
  helmet.position.y = 2.06; g.add(helmet);
  // Helmet brim
  const brim = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.04, 0.58), helmetMat);
  brim.position.y = 1.97; g.add(brim);

  // Eyes (slight glow for pro)
  if (isPro) {
    const eyeMat = new THREE.MeshBasicMaterial({ color:0xff2200 });
    [-0.1,0.1].forEach(ox=>{
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.03,6,4),eyeMat);
      eye.position.set(ox,1.8,0.24); g.add(eye);
    });
  }

  // Balaclava/face cover for pro
  if (isPro) {
    const bala = new THREE.Mesh(new THREE.BoxGeometry(0.52,0.3,0.48),new THREE.MeshLambertMaterial({color:0x110011}));
    bala.position.y = 1.65; g.add(bala);
  }

  // ── LEGS ──
  [-0.2, 0.2].forEach(ox => {
    const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.52, 0.28), legMat);
    thigh.position.set(ox, 0.42, 0); thigh.castShadow = true; g.add(thigh);
    const shin = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.5, 0.25), legMat);
    shin.position.set(ox, -0.1, 0); shin.castShadow = true; g.add(shin);
    // Boot
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.32), bootMat);
    boot.position.set(ox, -0.28, 0.02); g.add(boot);
    // Knee pad
    const kp = new THREE.Mesh(new THREE.BoxGeometry(0.22,0.12,0.06), new THREE.MeshLambertMaterial({color:0x111111}));
    kp.position.set(ox, 0.12, 0.14); g.add(kp);
  });

  // ── ARMS ──
  [-0.5, 0.5].forEach((ox, si) => {
    const uArm = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.5, 0.22), armMat);
    uArm.position.set(ox, 0.88, 0); uArm.castShadow = true; g.add(uArm);
    const lArm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.48, 0.2), armMat);
    lArm.position.set(ox, 0.44, 0.06); lArm.castShadow = true; g.add(lArm);
    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 0.14), new THREE.MeshLambertMaterial({color:0x1a1a1a}));
    hand.position.set(ox, 0.22, 0.06); g.add(hand);
  });

  // ── GUN (bot's weapon visible) ──
  const gunColor = isPro ? 0x1a1a2a : 0x1a1a1a;
  const botGunMat = new THREE.MeshLambertMaterial({ color: gunColor });
  const botGun = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.055, 0.38), botGunMat);
  botGun.position.set(0.38, 0.85, -0.22); g.add(botGun);
  const botBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.01,0.01,0.2,6),metalMat);
  botBarrel.rotation.z=Math.PI/2; botBarrel.position.set(0.38,0.84,-0.42); g.add(botBarrel);

  // Pro glow outline
  if (isPro) {
    const glowMat = new THREE.MeshBasicMaterial({ color:0xff2200, transparent:true, opacity:0.18, wireframe:true });
    const glow = new THREE.Mesh(new THREE.BoxGeometry(0.82,2.2,0.54), glowMat);
    glow.position.y = 0.9; g.add(glow);
  }

  // ── HP BAR ──
  const hpBg = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 0.1),
    new THREE.MeshBasicMaterial({ color:0x330000, depthTest:false })
  );
  hpBg.position.set(0, 2.55, 0); hpBg.renderOrder = 1; g.add(hpBg);

  const hpFillMat = new THREE.MeshBasicMaterial({ color: isPro ? 0xff8800 : 0x00cc44, depthTest:false });
  const hpFill = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.1), hpFillMat);
  hpFill.position.set(0, 2.55, 0.001); hpFill.renderOrder = 2; hpFill.name = 'hpfill'; g.add(hpFill);

  // Name tag
  // (Text via canvas sprite - lightweight)
  const nCanvas = document.createElement('canvas');
  nCanvas.width = 128; nCanvas.height = 32;
  const nCtx = nCanvas.getContext('2d');
  nCtx.fillStyle = isPro ? '#ff8800' : '#ffffff';
  nCtx.font = 'bold 14px monospace';
  nCtx.textAlign = 'center';
  nCtx.fillText(name, 64, 22);
  const nTex = new THREE.CanvasTexture(nCanvas);
  const nSprite = new THREE.Mesh(
    new THREE.PlaneGeometry(1.4, 0.35),
    new THREE.MeshBasicMaterial({ map:nTex, transparent:true, depthTest:false })
  );
  nSprite.position.set(0, 2.85, 0);
  nSprite.renderOrder = 3;
  g.add(nSprite);

  g.position.set(x, 0, z);
  scene.add(g);

  const bot = {
    g, head, hpFill, nSprite,
    name, isPro, wKey, wc,
    hp: botHp, maxHp: botHp, dead: false,
    state: 'wander',
    targetPos: new THREE.Vector3(x, 0, z),
    lastShot: 0,
    shootReact: diff.react + Math.random(),
    flankTimer: 0, coverTimer: 0,
    stateTimer: 2 + Math.random()*4,
    // Leg animation
    walkT: Math.random()*Math.PI*2,
  };
  bots.push(bot);
  return bot;
}

// ── BOT AI UPDATE ──
function updateBots(dt) {
  bots.forEach(bot => {
    if (bot.dead) return;
    const dist = camera.position.distanceTo(bot.g.position);
    const diff = diffSettings;
    bot.stateTimer -= dt;
    bot.walkT       += dt * 3.5;

    // HP bar update
    if (bot.hpFill) bot.hpFill.scale.x = Math.max(0.001, bot.hp / bot.maxHp);

    // Billboard HP bar and name toward camera
    [bot.hpFill.parent?.children].flat().forEach(c => {
      if (c && (c.name==='hpfill' || c.geometry?.type==='PlaneGeometry')) {
        c.lookAt(camera.position);
      }
    });
    if (bot.nSprite) bot.nSprite.lookAt(camera.position);

    // ── STATE MACHINE ──
    if (bot.stateTimer <= 0) {
      if (dist < diff.aggro) {
        bot.state = Math.random() < 0.55 ? 'combat' : 'cover';
      } else if (dist < diff.aggro * 1.8) {
        bot.state = 'chase';
      } else {
        bot.state = 'wander';
        bot.targetPos.set(
          bot.g.position.x + (Math.random()-0.5)*45,
          0,
          bot.g.position.z + (Math.random()-0.5)*45
        );
        bot.targetPos.x = Math.max(-280, Math.min(280, bot.targetPos.x));
        bot.targetPos.z = Math.max(-280, Math.min(280, bot.targetPos.z));
      }
      bot.stateTimer = 1.2 + Math.random()*2.5;
    }

    // ── MOVEMENT ──
    const moveSpd = bot.isPro ? 0.062 : 0.045;
    let moved = false;

    if (bot.state === 'wander') {
      const toT = new THREE.Vector3().subVectors(bot.targetPos, bot.g.position);
      if (toT.length() > 1.5) {
        toT.normalize();
        const nx = bot.g.position.x + toT.x * moveSpd * 60 * dt;
        const nz = bot.g.position.z + toT.z * moveSpd * 60 * dt;
        if (!collidesBuilding(nx, bot.g.position.z)) bot.g.position.x = nx;
        if (!collidesBuilding(bot.g.position.x, nz)) bot.g.position.z = nz;
        bot.g.rotation.y = Math.atan2(toT.x, toT.z);
        moved = true;
      }

    } else if (bot.state === 'chase' || bot.state === 'combat') {
      const toPlayer = new THREE.Vector3().subVectors(camera.position, bot.g.position);
      toPlayer.y = 0; toPlayer.normalize();

      // Flanking for pro bots
      if (diff.flank && bot.isPro) {
        bot.flankTimer -= dt;
        if (bot.flankTimer <= 0) bot.flankTimer = 1.5 + Math.random()*2;
        if (bot.flankTimer > 0.75) {
          const flank = new THREE.Vector3(-toPlayer.z, 0, toPlayer.x);
          toPlayer.add(flank.multiplyScalar(0.6)).normalize();
        }
      }

      const optDist = bot.wKey==='sniper'?48 : bot.wKey==='shotgun'?9 : 24;
      if (dist > optDist + 3) {
        const nx = bot.g.position.x + toPlayer.x * moveSpd * 52 * dt;
        const nz = bot.g.position.z + toPlayer.z * moveSpd * 52 * dt;
        if (!collidesBuilding(nx, bot.g.position.z)) bot.g.position.x = nx;
        if (!collidesBuilding(bot.g.position.x, nz)) bot.g.position.z = nz;
        moved = true;
      } else if (dist < optDist - 4 && bot.wKey !== 'shotgun') {
        bot.g.position.x -= toPlayer.x * moveSpd * 28 * dt;
        bot.g.position.z -= toPlayer.z * moveSpd * 28 * dt;
        moved = true;
      }
      bot.g.rotation.y = Math.atan2(camera.position.x-bot.g.position.x, camera.position.z-bot.g.position.z);

    } else if (bot.state === 'cover') {
      bot.coverTimer -= dt;
      if (bot.coverTimer <= 0) {
        bot.coverTimer = 1 + Math.random()*1.2;
        const ang = Math.random()*Math.PI*2;
        const cd  = 5 + Math.random()*10;
        bot.targetPos.set(bot.g.position.x + Math.cos(ang)*cd, 0, bot.g.position.z + Math.sin(ang)*cd);
      }
      const toT = new THREE.Vector3().subVectors(bot.targetPos, bot.g.position).normalize();
      bot.g.position.x += toT.x * moveSpd * 38 * dt;
      bot.g.position.z += toT.z * moveSpd * 38 * dt;
      moved = true;
    }

    // ── LEG WALK ANIMATION ──
    if (moved) {
      // Swing legs
      const leftThigh  = bot.g.children[0]; // approximate - swing torso slightly
      bot.g.children.forEach((c, ci) => {
        if (c.geometry?.parameters?.width === 0.24) { // thigh width
          c.rotation.x = Math.sin(bot.walkT + (ci%2===0?0:Math.PI)) * 0.35;
        }
      });
      // Body bob
      bot.g.position.y = Math.abs(Math.sin(bot.walkT)) * 0.04;
    } else {
      bot.g.position.y = 0;
    }

    // ── SHOOTING ──
    const shootRange = (bot.wc.range || 60) * 1.1;
    if (dist < shootRange && (bot.state==='combat'||bot.state==='cover'||bot.state==='chase')) {
      const now = Date.now();
      const interval = bot.wc.fireRate / diff.aim;
      if (now - bot.lastShot > interval * (0.85 + Math.random()*0.3)) {
        bot.lastShot = now;
        const aimErr = (1 - diff.aim) * 0.35;
        if (Math.random() > aimErr) {
          let dmg = bot.wc.dmg[0] + Math.random()*(bot.wc.dmg[1]-bot.wc.dmg[0]);
          dmg *= bot.isPro ? 1.2 : 0.72;
          takeDamage(dmg, bot.name);
        }
        // Bot tracer
        const dir = new THREE.Vector3().subVectors(camera.position, bot.g.position).normalize();
        dir.x += (Math.random()-0.5)*aimErr*0.4;
        dir.z += (Math.random()-0.5)*aimErr*0.4;
        const from = bot.g.position.clone().add(new THREE.Vector3(0, 1.4, 0));
        tracerLine(from, from.clone().add(dir.multiplyScalar(55)));
        spawnParticles(from, 0xddddaa, 1);
      }
    }

    // ── BOT vs BOT (simulate BR) ──
    if (Math.random() < 0.0025 * dt * 60) {
      const alive = bots.filter(ob => ob !== bot && !ob.dead);
      if (alive.length > 0) {
        const target = alive[Math.floor(Math.random()*alive.length)];
        target.hp -= 6 + Math.random()*22;
        if (target.hp <= 0) killBot(target);
      }
    }
  });
}

// ── HIT BOT ──
function hitBot(bot, dmg) {
  bot.hp -= dmg;
  spawnParticles(bot.g.position.clone().add(new THREE.Vector3(0, 1.1, 0)), 0xff2200, 5);
  if (bot.hp <= 0) {
    kills++;
    score += 100 * (bot.isPro ? 3 : 1);
    const scoreEl = document.getElementById('s-score');
    const killsEl = document.getElementById('s-kills');
    if (scoreEl) scoreEl.textContent = score;
    if (killsEl) killsEl.textContent = kills;
    addKillFeed(bot.name, bot.isPro);
    playSound('death');
    killBot(bot);
    if (LD.settings.vib && navigator.vibrate) navigator.vibrate([28,15,55]);
  }
}

// ── KILL BOT ──
function killBot(bot) {
  if (bot.dead) return;
  bot.dead = true;
  // Death pose: fall sideways
  bot.g.rotation.z = Math.PI/2;
  bot.g.position.y = 0.18;
  aliveCount--;
  const aliveEl = document.getElementById('s-alive');
  if (aliveEl) aliveEl.textContent = aliveCount;

  // Loot drop
  if (Math.random() < 0.72) spawnLootAt(bot.g.position.x, bot.g.position.z, bot.isPro?'rare':'common');
  if (Math.random() < 0.55) spawnMiscLootAt(bot.g.position.x+1, bot.g.position.z);

  // Remove corpse after 8 seconds
  setTimeout(() => {
    scene.remove(bot.g);
    const i = bots.indexOf(bot);
    if (i > -1) bots.splice(i, 1);
  }, 8000);

  if (aliveCount <= 1 && gameActive) {
    setTimeout(winGame, 900);
  }
}
