// ══════════════════════════════════════════════
//  WAR ZONE v4 — MAP.JS
//  Realistic terrain, grass, buildings, roads
// ══════════════════════════════════════════════

const lootGeoWeapon = new THREE.BoxGeometry(0.5, 0.12, 0.14);
const lootGeoItem   = new THREE.SphereGeometry(0.22, 6, 4);
const lootColors    = {
  epic:0x8800ff, rare:0x0044ff, uncommon:0x00aa44, common:0xaaaaaa,
  medkit:0xff4466, armor:0x2244ff, helmet:0x888800, ammo:0xffcc44, grenade:0xff8800
};

function buildMap() {
  // Clear previous map objects (but keep camera etc.)
  const toRemove = [];
  scene.traverse(obj => {
    if (obj.name && (obj.name.startsWith('map_') || obj.name.startsWith('loot_'))) {
      toRemove.push(obj);
    }
  });
  toRemove.forEach(o => scene.remove(o));
  buildings   = [];
  foliageObjects = [];

  // ── SKY / FOG ──
  scene.background = new THREE.Color(0x87CEEB); // daylight sky blue
  scene.fog = new THREE.FogExp2(0xc8e8ff, LD.settings.gfx === 1 ? 0.006 : 0.0038);

  // ── SUN LIGHT ──
  const sun = new THREE.DirectionalLight(0xfff0d0, 1.4);
  sun.position.set(120, 200, 80);
  sun.castShadow = LD.settings.gfx === 3;
  if (sun.castShadow) {
    sun.shadow.mapSize.width = sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far  = 600;
    sun.shadow.camera.left = sun.shadow.camera.bottom = -250;
    sun.shadow.camera.right= sun.shadow.camera.top    =  250;
  }
  sun.name = 'map_sun';
  scene.add(sun);

  const ambient = new THREE.AmbientLight(0x88aacc, 0.55);
  ambient.name = 'map_ambient';
  scene.add(ambient);

  const hemi = new THREE.HemisphereLight(0x87ceeb, 0x4a7c30, 0.4);
  hemi.name = 'map_hemi';
  scene.add(hemi);

  // ── TERRAIN ──
  buildTerrain();

  // ── ROAD NETWORK ──
  buildRoads();

  // ── GRASS PATCHES ──
  buildGrass();

  // ── MAP ZONES (buildings) ──
  MAP_ZONES.forEach(zone => buildZone(zone));

  // ── TREES ──
  const treeCount = LD.settings.foliage === 1 ? 80 : LD.settings.foliage === 2 ? 200 : 400;
  for (let i = 0; i < treeCount; i++) {
    const tx = (Math.random()-0.5)*540;
    const tz = (Math.random()-0.5)*540;
    if (!collidesBuilding(tx, tz)) spawnTree(tx, tz);
  }

  // ── ROCKS ──
  for (let i = 0; i < 80; i++) {
    const rx = (Math.random()-0.5)*520, rz = (Math.random()-0.5)*520;
    const rh = 0.3 + Math.random()*1.2;
    const rock = new THREE.Mesh(
      new THREE.DodecahedronGeometry(rh, 0),
      new THREE.MeshLambertMaterial({ color: new THREE.Color().setHSL(0, 0, 0.35+Math.random()*0.2) })
    );
    rock.position.set(rx, rh*0.5, rz);
    rock.rotation.set(Math.random(), Math.random(), Math.random());
    rock.castShadow = true;
    rock.name = 'map_rock';
    scene.add(rock);
  }

  // ── WATER BODIES ──
  for (let i = 0; i < 8; i++) {
    const ww = 25+Math.random()*35, wd = 20+Math.random()*30;
    const waterGeo = new THREE.PlaneGeometry(ww, wd);
    const waterMat = new THREE.MeshLambertMaterial({ color:0x1a6688, transparent:true, opacity:0.78 });
    const water = new THREE.Mesh(waterGeo, waterMat);
    water.rotation.x = -Math.PI/2;
    water.position.set((Math.random()-0.5)*400, 0.04, (Math.random()-0.5)*400);
    water.name = 'map_water';
    scene.add(water);
  }

  // ── ZONE CIRCLE ──
  const circleGeo = new THREE.RingGeometry(zoneRadius-0.6, zoneRadius+0.6, 96);
  const circleMat = new THREE.MeshBasicMaterial({ color:0x0088ff, transparent:true, opacity:0.5, side:THREE.DoubleSide });
  const zoneCircle = new THREE.Mesh(circleGeo, circleMat);
  zoneCircle.rotation.x = -Math.PI/2;
  zoneCircle.position.y = 0.12;
  zoneCircle.name = 'zoneCircle';
  scene.add(zoneCircle);
}

function buildTerrain() {
  // Main large terrain with simple height variation
  const size = 600, segs = LD.settings.gfx === 1 ? 40 : 80;
  const terrGeo = new THREE.PlaneGeometry(size, size, segs, segs);
  const pos = terrGeo.attributes.position;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i);
    // Multi-octave noise approximation using trig
    const h = Math.sin(x*0.018)*Math.cos(y*0.018)*3
            + Math.sin(x*0.042+1.2)*Math.cos(y*0.038)*1.5
            + Math.sin(x*0.09)*Math.cos(y*0.11)*0.6;
    pos.setZ(i, h);
  }
  terrGeo.computeVertexNormals();

  // Vertex colors for realistic terrain
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const h = pos.getZ(i);
    let r, g, b;
    if (h < -1.5) { r=0.35; g=0.55; b=0.25; }      // low: dark grass
    else if (h < 0) { r=0.40; g=0.62; b=0.28; }     // normal grass
    else if (h < 1.5) { r=0.45; g=0.68; b=0.30; }   // gentle slope
    else if (h < 2.5) { r=0.52; g=0.44; b=0.30; }   // dirt/rock mix
    else { r=0.58; g=0.55; b=0.50; }                  // rocky top
    colors[i*3]=r; colors[i*3+1]=g; colors[i*3+2]=b;
  }
  terrGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const terrMat = new THREE.MeshLambertMaterial({ vertexColors:true });
  const terrain = new THREE.Mesh(terrGeo, terrMat);
  terrain.rotation.x = -Math.PI/2;
  terrain.receiveShadow = true;
  terrain.name = 'map_terrain';
  scene.add(terrain);
}

function buildRoads() {
  // Main cross roads
  const roadMat = new THREE.MeshLambertMaterial({ color:0x4a4a4a });
  const linesMat= new THREE.MeshLambertMaterial({ color:0xffee44 });

  [[600,6,0, 0, 0,0,0],     // E-W road
   [6,600,0, 0, 0,0,0]].forEach(([w,d,h, rx,ry,rz,  px,pz]) => {
    const road = new THREE.Mesh(new THREE.PlaneGeometry(w, d), roadMat);
    road.rotation.x = -Math.PI/2; road.position.y = 0.06;
    road.name = 'map_road'; scene.add(road);
    // Center line
    const line = new THREE.Mesh(new THREE.PlaneGeometry(w, 0.25), linesMat);
    line.rotation.x = -Math.PI/2; line.position.y = 0.07;
    line.name = 'map_road'; scene.add(line);
  });
}

function buildGrass() {
  if (LD.settings.gfx === 1) return; // Skip grass on low quality

  const bladeGeo = new THREE.PlaneGeometry(0.12, 0.45);
  const bladeMat = new THREE.MeshLambertMaterial({
    color:0x4a8c28,
    side: THREE.DoubleSide,
    transparent:true, opacity:0.92,
  });

  const count = LD.settings.foliage === 3 ? 3000 : 1200;
  for (let i = 0; i < count; i++) {
    const bx = (Math.random()-0.5)*500;
    const bz = (Math.random()-0.5)*500;
    if (collidesBuilding(bx, bz)) continue;

    const blade = new THREE.Mesh(bladeGeo, bladeMat);
    blade.position.set(bx, 0.22, bz);
    blade.rotation.y = Math.random()*Math.PI;
    blade.name = 'map_grass';
    scene.add(blade);
    foliageObjects.push(blade);
  }
}

function buildZone(zone) {
  const lootRarity = zone.loot;
  const cx = zone.x, cz = zone.z;
  const houseCount = 2 + Math.floor(Math.random()*4);

  for (let i = 0; i < houseCount; i++) {
    const hw = 5 + Math.random()*8;
    const hd = 5 + Math.random()*8;
    const hh = 4 + Math.random()*5;
    const bx = cx + (Math.random()-0.5)*36;
    const bz = cz + (Math.random()-0.5)*36;
    buildHouse(bx, bz, hw, hd, hh, lootRarity);
    buildings.push({ cx:bx, cz:bz, hw, hd });
  }

  // Zone sign (pole)
  const pole = new THREE.Mesh(
    new THREE.BoxGeometry(0.15, 2, 0.15),
    new THREE.MeshLambertMaterial({ color:0xddcc66 })
  );
  pole.position.set(cx, 1, cz);
  pole.name = 'map_sign';
  scene.add(pole);
}

function buildHouse(cx, cz, hw, hd, hh, lootRarity) {
  // Wall color varies by zone type
  const wallH = Math.random();
  const wallMat = new THREE.MeshLambertMaterial({
    color: new THREE.Color().setHSL(0.07, 0.22, 0.42 + wallH*0.12)
  });
  const roofMat   = new THREE.MeshLambertMaterial({ color: new THREE.Color().setHSL(0.03, 0.45, 0.26) });
  const windowMat = new THREE.MeshBasicMaterial({ color:0x88ccff, transparent:true, opacity:0.55 });
  const doorMat   = new THREE.MeshLambertMaterial({ color:0x5a3a1a });
  const curbMat   = new THREE.MeshLambertMaterial({ color:0x888888 });
  const concreteMat=new THREE.MeshLambertMaterial({ color:0xccccbb });

  // Foundation
  const found = new THREE.Mesh(new THREE.BoxGeometry(hw+0.6, 0.3, hd+0.6), curbMat);
  found.position.set(cx, 0.15, cz);
  found.receiveShadow = true;
  found.name = 'map_building';
  scene.add(found);

  // Walls
  [
    [hw,  hh,  0.3,  0,      hh/2,  hd/2],
    [hw,  hh,  0.3,  0,      hh/2, -hd/2],
    [0.3, hh,  hd,   hw/2,   hh/2,  0   ],
    [0.3, hh,  hd,  -hw/2,   hh/2,  0   ],
    [hw,  0.25,hd,   0,       0,     0   ], // floor
  ].forEach(([w,h,d,x,y,z]) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), wallMat);
    m.position.set(cx+x, y, cz+z);
    m.castShadow  = LD.settings.gfx > 1;
    m.receiveShadow = true;
    m.name = 'map_building';
    scene.add(m);
  });

  // Roof
  const roofMesh = new THREE.Mesh(
    new THREE.ConeGeometry(Math.sqrt(hw*hw+hd*hd)*0.65, 2.6, 4),
    roofMat
  );
  roofMesh.position.set(cx, hh+1.25, cz);
  roofMesh.rotation.y = Math.PI/4;
  roofMesh.castShadow = true;
  roofMesh.name = 'map_building';
  scene.add(roofMesh);

  // Windows
  for (let i = 0; i < 3; i++) {
    const wg = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.1), windowMat);
    const side = i < 2 ? 0 : 1;
    wg.position.set(
      cx + (side===0?hw/2+0.02:-hw/2-0.02),
      hh*0.55 + (i===2?0.1:0),
      cz + (i===0?-hd*0.25:i===1?hd*0.25:0)
    );
    wg.rotation.y = side===0?Math.PI/2:-Math.PI/2;
    wg.name = 'map_building';
    scene.add(wg);

    // Window frame
    const frame = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.2), new THREE.MeshLambertMaterial({color:0x4a3a2a}));
    frame.position.copy(wg.position);
    frame.position.x += side===0?0.01:-0.01;
    frame.rotation.y = wg.rotation.y;
    frame.name = 'map_building';
    scene.add(frame);
  }

  // Door
  const door = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 2.2), doorMat);
  door.position.set(cx, 1.1, cz - hd/2 - 0.02);
  door.name = 'map_building';
  scene.add(door);

  // Concrete path to door
  const path = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 4), concreteMat);
  path.rotation.x = -Math.PI/2;
  path.position.set(cx, 0.07, cz - hd/2 - 2);
  path.name = 'map_building';
  scene.add(path);

  // Loot inside
  const lootCount = lootRarity === 'epic' ? 4 : lootRarity === 'rare' ? 3 : lootRarity === 'uncommon' ? 2 : 1;
  for (let i = 0; i < lootCount; i++) {
    spawnLootAt(cx + (Math.random()-0.5)*(hw-1.5), cz + (Math.random()-0.5)*(hd-1.5), lootRarity);
  }
  for (let i = 0; i < 2; i++) {
    spawnMiscLootAt(cx + (Math.random()-0.5)*(hw*2.2), cz + (Math.random()-0.5)*(hd*2.2));
  }
}

function spawnTree(x, z) {
  const trunkMat = new THREE.MeshLambertMaterial({ color:0x5a3e1b });
  // Random leaf color (multiple green shades, some autumn)
  const h = 0.25 + Math.random()*0.12;
  const s = 0.55 + Math.random()*0.25;
  const l = 0.22 + Math.random()*0.14;
  const leafMat = new THREE.MeshLambertMaterial({ color: new THREE.Color().setHSL(h, s, l) });

  const treeH = 2.5 + Math.random()*5;
  const trunk  = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.28, treeH, 6), trunkMat);
  trunk.position.set(x, treeH/2, z);
  trunk.castShadow = true;
  trunk.name = 'map_tree';
  scene.add(trunk);

  // Layered leaves
  const layers = 2 + Math.floor(Math.random()*2);
  for (let i = 0; i < layers; i++) {
    const lr = 1.2 + Math.random()*1.4 - i*0.3;
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(lr, 6, 5), leafMat);
    leaf.position.set(x + (Math.random()-0.5)*0.5, treeH + 0.8 + i*0.7, z + (Math.random()-0.5)*0.5);
    leaf.castShadow = true;
    leaf.name = 'map_tree';
    scene.add(leaf);
    foliageObjects.push(leaf);
  }
}

function spawnLootAt(x, z, rarity) {
  const table = LOOT_TABLES[rarity] || LOOT_TABLES.common;
  const wKey  = table[Math.floor(Math.random()*table.length)];
  const wc    = WEAPON_CONFIGS[wKey];
  if (!wc) return;

  const mat = new THREE.MeshLambertMaterial({
    color: lootColors[rarity] || 0xffffff,
    emissive: lootColors[rarity] || 0x333333,
    emissiveIntensity: 0.3
  });
  const mesh = new THREE.Mesh(lootGeoWeapon, mat);
  mesh.position.set(x, 0.22, z);
  mesh.castShadow = true;
  mesh.name = 'loot_weapon';
  scene.add(mesh);

  const gl = new THREE.PointLight(lootColors[rarity] || 0xffffff, 0.7, 5);
  gl.position.set(x, 0.6, z);
  scene.add(gl);

  lootItems.push({ mesh, gl, type:'weapon', wKey, rarity, x, z, taken:false });
}

function spawnMiscLootAt(x, z) {
  const type = LOOT_ITEMS_MISC[Math.floor(Math.random()*LOOT_ITEMS_MISC.length)];
  const col  = lootColors[type] || 0xffffff;
  const mat  = new THREE.MeshLambertMaterial({ color:col, emissive:col, emissiveIntensity:0.4 });
  const mesh = new THREE.Mesh(lootGeoItem, mat);
  mesh.position.set(x, 0.28, z);
  mesh.name = 'loot_misc';
  scene.add(mesh);
  lootItems.push({ mesh, type:'misc', item:type, x, z, taken:false });
}

function collidesBuilding(x, z) {
  for (const b of buildings) {
    if (Math.abs(x-b.cx) < b.hw*0.5+0.5 && Math.abs(z-b.cz) < b.hd*0.5+0.5) return true;
  }
  return false;
}

function updateZoneCircle() {
  const zc = scene.getObjectByName('zoneCircle');
  if (zc) {
    zc.geometry.dispose();
    zc.geometry = new THREE.RingGeometry(Math.max(0.5, zoneRadius-0.8), zoneRadius+0.8, 96);
  }
}
