// ══════════════════════════════════════════════
//  WAR ZONE v4 — DATA.JS
//  All configs, constants, game state
// ══════════════════════════════════════════════

const isAndroid = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

// ── RANK SYSTEM ──
const RANKS = [
  { name:'BRONZ',    icon:'🥉', color:'#cd7f32', xpReq:0     },
  { name:'DEMİR',    icon:'⚙',  color:'#aaaaaa', xpReq:500   },
  { name:'GÜMÜŞ',    icon:'🥈', color:'#c0c0c0', xpReq:1200  },
  { name:'ALTIN',    icon:'🥇', color:'#ffd700', xpReq:2500  },
  { name:'PLATİN',   icon:'💎', color:'#44eeff', xpReq:4500  },
  { name:'ELMAS',    icon:'💠', color:'#88aaff', xpReq:8000  },
  { name:'USTA',     icon:'👑', color:'#ff8800', xpReq:14000 },
  { name:'EFSANEVİ', icon:'🌟', color:'#ff44ff', xpReq:25000 },
];

// ── WEAPON CONFIGS ──
const WEAPON_CONFIGS = {
  pistol:  { name:'P226',    icon:'🔹', dmg:[18,28],  fireRate:280,  reload:1100, ammo:15, res:60,  spread:0.014, range:40 },
  m4a1:    { name:'M4A1',    icon:'🔫', dmg:[22,34],  fireRate:95,   reload:1900, ammo:30, res:120, spread:0.012, range:80 },
  ak47:    { name:'AK-47',   icon:'⚡', dmg:[30,44],  fireRate:130,  reload:2200, ammo:25, res:100, spread:0.022, range:75 },
  sniper:  { name:'AWM',     icon:'🎯', dmg:[95,120], fireRate:1500, reload:3000, ammo:5,  res:25,  spread:0.002, range:200},
  shotgun: { name:'SPAS-12', icon:'💥', dmg:[55,80],  fireRate:700,  reload:2500, ammo:8,  res:32,  spread:0.055, range:20 },
  mp5:     { name:'MP5',     icon:'🔧', dmg:[14,22],  fireRate:68,   reload:1600, ammo:35, res:140, spread:0.018, range:55 },
  m249:    { name:'M249',    icon:'🌀', dmg:[18,26],  fireRate:75,   reload:3800, ammo:100,res:200, spread:0.025, range:70 },
  smg:     { name:'UMP45',   icon:'🔩', dmg:[16,24],  fireRate:80,   reload:1700, ammo:30, res:120, spread:0.020, range:50 },
};

// ── LOOT TABLES ──
const LOOT_TABLES = {
  common:   ['pistol','pistol','smg','mp5'],
  uncommon: ['m4a1','ak47','shotgun','mp5','smg'],
  rare:     ['ak47','m4a1','sniper','shotgun','m249'],
  epic:     ['sniper','m249','ak47'],
};
const LOOT_ITEMS_MISC = ['medkit','medkit','armor','helmet','ammo','grenade'];

// ── CHARACTER CONFIGS ──
const CHAR_CONFIGS = {
  soldier:{ icon:'🪖', name:'ASKER',   maxHP:100, speed:0.072, bonus:'Dengeli' },
  ghost:  { icon:'👻', name:'GHOST',   maxHP:80,  speed:0.095, bonus:'Hızlı'  },
  tank:   { icon:'🦾', name:'TANK',    maxHP:140, speed:0.055, bonus:'Dayanıklı' },
  sniper: { icon:'🎯', name:'KESKİN',  maxHP:85,  speed:0.078, bonus:'Uzun menzil' },
};

// ── MAP ZONES ──
const MAP_ZONES = [
  { name:'MİLİTER ÜS',   x:-80,  z:-80,  loot:'epic'    },
  { name:'ÇARŞI',         x: 40,  z:-60,  loot:'uncommon'},
  { name:'HASTANE',        x:-20,  z: 50,  loot:'rare'    },
  { name:'OKUL',           x: 80,  z: 20,  loot:'uncommon'},
  { name:'FABRİKA',        x:-90,  z: 30,  loot:'rare'    },
  { name:'KÖPRÜ',          x: 10,  z:-90,  loot:'common'  },
  { name:'TAŞOCAĞI',       x:-50,  z: 90,  loot:'common'  },
  { name:'ÇÖLHANE',        x: 90,  z: 90,  loot:'uncommon'},
  { name:'GİZLİ ÜSSÜ',   x:-110, z:-20,  loot:'epic'    },
  { name:'KULE',           x: 0,   z: 0,   loot:'rare'    },
  { name:'LİMAN',          x: 110, z:-50,  loot:'uncommon'},
  { name:'YOL KESTİRME',  x: 60,  z:-120, loot:'common'  },
  { name:'MAĞARALAR',     x:-60,  z:-110, loot:'rare'    },
  { name:'ÇİFTLİK',       x: 120, z: 60,  loot:'common'  },
  { name:'BUNKER',         x:-130, z: 60,  loot:'epic'    },
  { name:'ENKAZ ALANI',   x: 30,  z: 120, loot:'uncommon'},
  { name:'KAR DAĞI',      x:-30,  z:-130, loot:'rare'    },
  { name:'TERK EDİLMİŞ',  x: 100, z:-100, loot:'common'  },
  { name:'KUMSAL',         x:-100, z: 100, loot:'uncommon'},
  { name:'MERKEZ KALE',   x: 0,   z:-140, loot:'epic'    },
];

// ── ZONE PHASES ──
const ZONE_PHASES = [
  { duration:90,  shrinkTo:160, dmg:2  },
  { duration:60,  shrinkTo:100, dmg:4  },
  { duration:50,  shrinkTo:60,  dmg:7  },
  { duration:40,  shrinkTo:30,  dmg:12 },
  { duration:30,  shrinkTo:10,  dmg:20 },
];

// ── BOT AI LEVELS ──
const BOT_LEVELS = {
  easy:    { react:2.2, aim:0.55, aggro:20, flank:false },
  normal:  { react:1.4, aim:0.75, aggro:35, flank:true  },
  hard:    { react:0.8, aim:0.88, aggro:50, flank:true  },
  extreme: { react:0.4, aim:0.96, aggro:70, flank:true  },
};

// ── BOT NAMES ──
const BOT_NAMES = [
  'xXGhostXx','ProSniperTR','KARA_ŞAHIN','WarMachine','BombaTepe','Avcı47',
  'NightStalker','IronFist99','DeltaForce','RedWolf_TR','SilentBullet','BattleBorn',
  'ShadowStriker','IceBlood','FireStorm99','DeathMark','ThunderWolf','RapidFire_TR',
  'NinjaKiller','BloodRaven','CombatKing','TacticalAce','VenomShot','AlphaWolf',
  'GhostRider_TR','SteelEagle','SerpentFang','Demolisher','HunterX','WarHawk_TR',
  'StormBreaker','IronSight','NightHunter','CrimsonBlade','DesertFox','MidnightRifle',
  'SilverBullet','ThunderStrike','ViperUnit','ColdBlood_TR','NightFury','TigerPaw',
  'BattleAxe','CyberSoldier','RapidStrike','SharpEye','IronClaw','StealthOps',
  'FireHawk','TacticalGhost'
];

// ── FPS LIMIT OPTIONS ──
const FPS_LIMITS = [0, 30, 60, 120]; // 0 = unlimited
const FPS_LIMIT_LABELS = ['SINIRSIZ', '30 FPS', '60 FPS', '120 FPS'];

// ── LOBBY DATA ──
let LD = {
  playerName:'KOMUTAN', selectedMode:'br', selectedDiff:'normal',
  selectedWeapon:'m4a1', selectedChar:'soldier', selectedCharIcon:'🪖',
  bestScore:0, totalKills:0, gamesPlayed:0, wins:0, xp:0,
  unlockedWeapons:['pistol','m4a1','ak47','shotgun','mp5','smg','shotgun','m249'],
  settings:{
    sound:true, gyro:false, vib:true, auto:false,
    sens:5, gfx:2, fpsLimit:0, fov:80, foliage:2
  },
};

// ── THREE.JS GLOBALS ──
let scene, camera, renderer, clock;
let gameActive    = false;
let playerHP, maxHP, armor = 0, maxArmor = 75;
let ammo, ammoRes, reloading = false;
let kills = 0, score = 0;
let bots = [], lootItems = [], bullets = [], particles = [];
let buildings = [];
let keys       = {};
let yaw = 0, pitch = 0;
let gunGroup, muzzleMesh, muzzleLight;
// ── FPS BODY (player's own legs/arms in first person) ──
let fpsBody; // group added to camera
let bobT = 0, recoilZ = 0;
let lastShot  = 0;
let adsActive = false;
let gyroEnabled = false;
let lastGyro  = null;
// ── INVENTORY ──
let inventory = { weapons:[null, null], active:0, medkits:0, grenades:0, hasHelmet:false };
let currentWeaponConfig = null;
// ── STATS ──
let shotsFired = 0, shotsHit = 0, headshotCount = 0, gameStartTime = 0;
// ── BATTLE ROYALE STATE ──
let aliveCount = 50;
let zonePhase = 0, zoneTimer = 180, zoneDamageTimer = 0;
let playerInZone = true;
let planeProgress = 0, planePhase = 'idle';
let parachuteActive = false;
// ── NEARBY LOOT ──
let nearbyLoot = null;
let diffSettings = BOT_LEVELS.normal;
// ── FPS tracking ──
let fpsCounter = 0, fpsTime = 0, fpsDisplay = 60;
// ── FPS limiter ──
let lastFrameTime = 0;
// ── FOLIAGE objects for quality adjustment ──
let foliageObjects = [];

// ── RANK HELPERS ──
function getRank(xp) {
  let r = RANKS[0];
  for (const rank of RANKS) { if (xp >= rank.xpReq) r = rank; else break; }
  return r;
}
function getNextRank(xp) {
  for (let i = 0; i < RANKS.length - 1; i++) {
    if (xp < RANKS[i+1].xpReq) return RANKS[i+1];
  }
  return null;
}
function calcXpGain(kills, position, mode) {
  let xp = kills * 30;
  if (position <= 10) xp += 200;
  if (position <= 5)  xp += 300;
  if (position === 1) xp += 500;
  if (mode === 'ranked') xp = Math.floor(xp * 1.5);
  return xp;
}

// ── AUDIO ──
let audioCtx = null;
function ensureAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
}
function playSound(type) {
  if (!LD.settings.sound) return;
  try { ensureAudio(); } catch(e) { return; }
  const t = audioCtx.currentTime;
  if (type === 'shoot') {
    const wc = currentWeaponConfig || WEAPON_CONFIGS.m4a1;
    const dur = wc.fireRate > 1000 ? 0.22 : 0.1;
    const buf = audioCtx.createBuffer(1, (audioCtx.sampleRate*dur)|0, audioCtx.sampleRate);
    const d = buf.getChannelData(0);
    const pw = wc.fireRate > 1000 ? 5 : 3;
    for (let i=0;i<d.length;i++) d[i] = (Math.random()*2-1)*Math.pow(1-i/d.length,pw)*0.7;
    const s = audioCtx.createBufferSource(); s.buffer = buf;
    const g = audioCtx.createGain(); g.gain.value = 0.22;
    s.connect(g); g.connect(audioCtx.destination); s.start();
  } else if (type === 'reload') {
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type='square'; o.frequency.setValueAtTime(700,t); o.frequency.exponentialRampToValueAtTime(180,t+0.12);
    g.gain.setValueAtTime(0.1,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.3);
    o.connect(g); g.connect(audioCtx.destination); o.start(); o.stop(t+0.3);
  } else if (type === 'headshot') {
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type='sine'; o.frequency.setValueAtTime(1600,t); o.frequency.exponentialRampToValueAtTime(900,t+0.12);
    g.gain.setValueAtTime(0.13,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.14);
    o.connect(g); g.connect(audioCtx.destination); o.start(); o.stop(t+0.14);
  } else if (type === 'loot') {
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type='sine'; o.frequency.setValueAtTime(880,t); o.frequency.setValueAtTime(1100,t+0.06);
    g.gain.setValueAtTime(0.08,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.18);
    o.connect(g); g.connect(audioCtx.destination); o.start(); o.stop(t+0.18);
  } else if (type === 'death') {
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type='sawtooth'; o.frequency.setValueAtTime(140,t); o.frequency.exponentialRampToValueAtTime(55,t+0.8);
    g.gain.setValueAtTime(0.22,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.9);
    o.connect(g); g.connect(audioCtx.destination); o.start(); o.stop(t+0.9);
  } else if (type === 'win') {
    [660,880,1100,1320].forEach((f,i)=>{
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type='sine'; o.frequency.value=f;
      g.gain.setValueAtTime(0,t+i*0.12); g.gain.linearRampToValueAtTime(0.12,t+i*0.12+0.06);
      g.gain.exponentialRampToValueAtTime(0.001,t+i*0.12+0.4);
      o.connect(g); g.connect(audioCtx.destination); o.start(t+i*0.12); o.stop(t+i*0.12+0.4);
    });
  } else if (type === 'zone') {
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type='sine'; o.frequency.setValueAtTime(220,t); o.frequency.setValueAtTime(180,t+0.1);
    g.gain.setValueAtTime(0.06,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.22);
    o.connect(g); g.connect(audioCtx.destination); o.start(); o.stop(t+0.22);
  } else if (type === 'jump') {
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type='sine'; o.frequency.setValueAtTime(300,t); o.frequency.exponentialRampToValueAtTime(500,t+0.08);
    g.gain.setValueAtTime(0.05,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.15);
    o.connect(g); g.connect(audioCtx.destination); o.start(); o.stop(t+0.15);
  }
}
