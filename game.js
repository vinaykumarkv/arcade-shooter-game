import * as THREE from "three";

// ── Constants ──────────────────────────────────────────────────────────────
const ARENA_SIZE = 40;
const WALL_HEIGHT = 6;
const PLAYER_SPEED = 12;
const PLAYER_TURN_SPEED = 2.2;
const MOUSE_SENSITIVITY = 0.002;
const NORMAL_FOV = 75;
const ZOOM_FOV = 28;
const PLAYER_HEIGHT = 1.7;
const PLAYER_MAX_HEALTH = 100;
const PLAYER_DAMAGE = 25;
const SHOOT_COOLDOWN = 0.35;

const ENEMY_MAX_HEALTH = 100;
const ENEMY_DAMAGE = 12;
const ENEMY_SPEED = 7;
const ENEMY_SHOOT_COOLDOWN = 1.1;
const ENEMY_SHOOT_RANGE = 28;
const ENEMY_CHASE_RANGE = 35;
const ENEMY_AIM_SPREAD = 0.08;

const BULLET_SPEED = 55;
const BULLET_MAX_DIST = 50;
const BULLET_RADIUS = 0.09;

// ── State ──────────────────────────────────────────────────────────────────
const keys = {};
const mouse = { locked: false, zooming: false };
let gameRunning = false;
let lastTime = performance.now();
const bullets = [];

const player = {
  health: PLAYER_MAX_HEALTH,
  shootTimer: 0,
  position: new THREE.Vector3(0, PLAYER_HEIGHT, 16),
  yaw: 0,
  pitch: 0,
};

const enemy = {
  health: ENEMY_MAX_HEALTH,
  shootTimer: 0,
  mesh: null,
  body: null,
  head: null,
  gunFlash: null,
  hitParts: [],
  position: new THREE.Vector3(0, 0, -16),
  yaw: Math.PI,
  state: "patrol",
  patrolTarget: new THREE.Vector3(),
  patrolTimer: 0,
};

// ── DOM ────────────────────────────────────────────────────────────────────
const overlay = document.getElementById("overlay");
const menu = document.getElementById("menu");
const gameOverEl = document.getElementById("game-over");
const hud = document.getElementById("hud");
const startBtn = document.getElementById("start-btn");
const restartBtn = document.getElementById("restart-btn");
const resultTitle = document.getElementById("result-title");
const resultMessage = document.getElementById("result-message");
const playerHealthFill = document.getElementById("player-health-fill");
const enemyHealthFill = document.getElementById("enemy-health-fill");
const playerHealthText = document.getElementById("player-health-text");
const enemyHealthText = document.getElementById("enemy-health-text");
const ammoEl = document.getElementById("ammo");
const crosshairEl = document.getElementById("crosshair");
const zoomIndicator = document.getElementById("zoom-indicator");

// ── Three.js setup ─────────────────────────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1f2e);
scene.fog = new THREE.Fog(0x1a1f2e, 20, 55);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.copy(player.position);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);
const canvas = renderer.domElement;

// Lighting
const ambient = new THREE.AmbientLight(0x445566, 0.6);
scene.add(ambient);

const sun = new THREE.DirectionalLight(0xffeedd, 1.2);
sun.position.set(15, 25, 10);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 60;
sun.shadow.camera.left = -25;
sun.shadow.camera.right = 25;
sun.shadow.camera.top = 25;
sun.shadow.camera.bottom = -25;
scene.add(sun);

const fillLight = new THREE.PointLight(0x4488ff, 0.4, 50);
fillLight.position.set(-10, 8, -10);
scene.add(fillLight);

// ── Arena geometry ─────────────────────────────────────────────────────────
function createMaterial(color, emissive = 0x000000) {
  return new THREE.MeshStandardMaterial({
    color,
    emissive,
    roughness: 0.75,
    metalness: 0.15,
  });
}

const floorGeo = new THREE.PlaneGeometry(ARENA_SIZE, ARENA_SIZE);
const floorMat = createMaterial(0x2a3344);
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

// Grid lines on floor
const gridHelper = new THREE.GridHelper(ARENA_SIZE, 20, 0x3a4a5a, 0x2a3545);
gridHelper.position.y = 0.01;
scene.add(gridHelper);

const half = ARENA_SIZE / 2;
const wallMat = createMaterial(0x3d4f66);
const wallThickness = 0.5;

function addWall(x, z, w, d) {
  const geo = new THREE.BoxGeometry(w, WALL_HEIGHT, d);
  const mesh = new THREE.Mesh(geo, wallMat);
  mesh.position.set(x, WALL_HEIGHT / 2, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

const walls = [
  addWall(0, -half, ARENA_SIZE, wallThickness),
  addWall(0, half, ARENA_SIZE, wallThickness),
  addWall(-half, 0, wallThickness, ARENA_SIZE),
  addWall(half, 0, wallThickness, ARENA_SIZE),
];

// Obstacles (cover)
const obstacles = [];
const obstacleData = [
  { x: -8, z: -5, w: 3, h: 2.5, d: 3 },
  { x: 8, z: -8, w: 4, h: 2, d: 2 },
  { x: -6, z: 8, w: 2.5, h: 3, d: 2.5 },
  { x: 10, z: 6, w: 3, h: 2, d: 4 },
  { x: 0, z: 0, w: 5, h: 2.5, d: 2 },
  { x: -12, z: -12, w: 2, h: 2, d: 2 },
  { x: 12, z: -10, w: 2, h: 2.5, d: 2 },
];

const obstacleMat = createMaterial(0x4a5a6e, 0x111822);
obstacleData.forEach(({ x, z, w, h, d }) => {
  const geo = new THREE.BoxGeometry(w, h, d);
  const mesh = new THREE.Mesh(geo, obstacleMat);
  mesh.position.set(x, h / 2, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  obstacles.push({ mesh, w, h, d });
});

// Decorative pillars
const pillarMat = createMaterial(0x556677);
for (let i = 0; i < 4; i++) {
  const angle = (i / 4) * Math.PI * 2;
  const r = 14;
  const geo = new THREE.CylinderGeometry(0.6, 0.8, WALL_HEIGHT, 8);
  const pillar = new THREE.Mesh(geo, pillarMat);
  pillar.position.set(Math.cos(angle) * r, WALL_HEIGHT / 2, Math.sin(angle) * r);
  pillar.castShadow = true;
  scene.add(pillar);
}

// ── Enemy bot ──────────────────────────────────────────────────────────────
function createEnemy() {
  const group = new THREE.Group();
  const hitParts = [];

  const darkMetal = createMaterial(0x1a1a22, 0x050508);
  const armorMat = createMaterial(0x2a1818, 0x110000);
  const redArmor = createMaterial(0x661818, 0x220000);
  const blackMat = createMaterial(0x111111);

  // Legs
  [-0.22, 0.22].forEach((x) => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.85, 8), darkMetal);
    leg.position.set(x, 0.45, 0);
    leg.castShadow = true;
    group.add(leg);

    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.32), blackMat);
    boot.position.set(x, 0.09, 0.06);
    boot.castShadow = true;
    group.add(boot);
  });

  // Pelvis / waist
  const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.25, 0.4), darkMetal);
  pelvis.position.y = 0.95;
  pelvis.castShadow = true;
  group.add(pelvis);

  // Torso armor
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.75, 0.45), armorMat);
  torso.position.y = 1.45;
  torso.castShadow = true;
  group.add(torso);
  hitParts.push(torso);

  // Chest plate with hazard stripes
  const chestPlate = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.45, 0.12), redArmor);
  chestPlate.position.set(0, 1.5, 0.24);
  group.add(chestPlate);

  const stripeMat = new THREE.MeshBasicMaterial({ color: 0xffcc00 });
  for (let i = -1; i <= 1; i += 2) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.35, 0.02), stripeMat);
    stripe.position.set(i * 0.12, 1.5, 0.31);
    group.add(stripe);
  }

  // Skull emblem
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  skull.position.set(0, 1.62, 0.32);
  group.add(skull);

  // Shoulder pauldrons
  [-0.55, 0.55].forEach((x) => {
    const pauldron = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.18, 0.35), redArmor);
    pauldron.position.set(x, 1.72, 0);
    pauldron.castShadow = true;
    group.add(pauldron);

    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.2, 6), darkMetal);
    spike.position.set(x, 1.88, 0);
    group.add(spike);
  });

  // Neck
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.15, 8), darkMetal);
  neck.position.y = 1.92;
  group.add(neck);

  // Helmet
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.38, 0.42), darkMetal);
  head.position.y = 2.18;
  head.castShadow = true;
  group.add(head);
  hitParts.push(head);

  const helmetTop = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.12, 0.44), redArmor);
  helmetTop.position.y = 2.42;
  group.add(helmetTop);

  // Glowing red eyes
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
  [-0.1, 0.1].forEach((x) => {
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.04, 0.04), eyeMat);
    eye.position.set(x, 2.16, 0.22);
    group.add(eye);

    const eyeGlow = new THREE.PointLight(0xff0000, 0.3, 2);
    eyeGlow.position.set(x, 2.16, 0.25);
    group.add(eyeGlow);
  });

  // Face grille
  const grille = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.12, 0.04), blackMat);
  grille.position.set(0, 2.05, 0.22);
  group.add(grille);

  // Backpack reactor
  const backpack = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.55, 0.25), darkMetal);
  backpack.position.set(0, 1.45, -0.32);
  backpack.castShadow = true;
  group.add(backpack);

  const reactor = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.08, 12), new THREE.MeshStandardMaterial({
    color: 0xff2200,
    emissive: 0x440000,
    roughness: 0.3,
    metalness: 0.6,
  }));
  reactor.rotation.x = Math.PI / 2;
  reactor.position.set(0, 1.45, -0.46);
  group.add(reactor);

  // Antenna
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 6), darkMetal);
  antenna.position.set(0.15, 2.55, -0.1);
  group.add(antenna);
  const antennaTip = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6), new THREE.MeshBasicMaterial({ color: 0xff0000 }));
  antennaTip.position.set(0.15, 2.82, -0.1);
  group.add(antennaTip);

  // Rifle arm + weapon
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.45, 8), darkMetal);
  arm.rotation.z = -Math.PI / 2;
  arm.position.set(0.5, 1.35, 0.15);
  group.add(arm);

  const rifleBody = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.55), blackMat);
  rifleBody.position.set(0.55, 1.35, 0.55);
  group.add(rifleBody);

  const rifleBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.45, 8), darkMetal);
  rifleBarrel.rotation.x = Math.PI / 2;
  rifleBarrel.position.set(0.55, 1.38, 0.95);
  group.add(rifleBarrel);

  const rifleScope = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.18, 8), redArmor);
  rifleScope.rotation.x = Math.PI / 2;
  rifleScope.position.set(0.55, 1.48, 0.6);
  group.add(rifleScope);

  const flashGeo = new THREE.SphereGeometry(0.15, 8, 8);
  const flashMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
  const gunFlash = new THREE.Mesh(flashGeo, flashMat);
  gunFlash.position.set(0.55, 1.38, 1.18);
  gunFlash.visible = false;
  group.add(gunFlash);

  group.position.copy(enemy.position);
  scene.add(group);

  enemy.mesh = group;
  enemy.body = torso;
  enemy.head = head;
  enemy.gunFlash = gunFlash;
  enemy.hitParts = hitParts;
}

createEnemy();
pickPatrolTarget();

function pickPatrolTarget() {
  const margin = 4;
  enemy.patrolTarget.set(
    THREE.MathUtils.randFloat(-half + margin, half - margin),
    0,
    THREE.MathUtils.randFloat(-half + margin, half - margin)
  );
  enemy.patrolTimer = THREE.MathUtils.randFloat(3, 6);
}

// ── Collision helpers ──────────────────────────────────────────────────────
function getColliders() {
  const colliders = [];
  const hw = ARENA_SIZE / 2 - 0.6;

  colliders.push({ type: "box", x: 0, z: 0, hw, hd: hw });

  obstacles.forEach(({ mesh, w, d }) => {
    colliders.push({
      type: "box",
      x: mesh.position.x,
      z: mesh.position.z,
      hw: w / 2 + 0.5,
      hd: d / 2 + 0.5,
    });
  });

  return colliders;
}

const colliders = getColliders();

function resolveCollision(pos, radius = 0.5) {
  for (const c of colliders) {
    const dx = pos.x - c.x;
    const dz = pos.z - c.z;
    const clampX = THREE.MathUtils.clamp(dx, -c.hw, c.hw);
    const clampZ = THREE.MathUtils.clamp(dz, -c.hd, c.hd);
    const nearestX = c.x + clampX;
    const nearestZ = c.z + clampZ;
    const distX = pos.x - nearestX;
    const distZ = pos.z - nearestZ;
    const distSq = distX * distX + distZ * distZ;

    if (distSq < radius * radius && distSq > 0.0001) {
      const dist = Math.sqrt(distSq);
      const push = (radius - dist) / dist;
      pos.x += distX * push;
      pos.z += distZ * push;
    }
  }
}

// ── Shooting & effects ─────────────────────────────────────────────────────
const raycaster = new THREE.Raycaster();
const obstacleTargets = () => [...obstacles.map((o) => o.mesh), ...walls];

function getAimDirection() {
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  return dir;
}

function getShootOrigin() {
  const origin = player.position.clone();
  origin.y -= 0.15;
  return origin;
}

function createBulletMesh(color, isPlayer) {
  const group = new THREE.Group();

  const coreGeo = new THREE.SphereGeometry(BULLET_RADIUS, 8, 8);
  const coreMat = new THREE.MeshBasicMaterial({ color });
  const core = new THREE.Mesh(coreGeo, coreMat);
  group.add(core);

  const trailGeo = new THREE.CylinderGeometry(BULLET_RADIUS * 0.6, BULLET_RADIUS, 0.35, 6);
  const trailMat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.65,
  });
  const trail = new THREE.Mesh(trailGeo, trailMat);
  trail.rotation.x = Math.PI / 2;
  trail.position.z = -0.2;
  group.add(trail);

  const glow = new THREE.PointLight(color, isPlayer ? 1.2 : 0.8, 3);
  group.add(glow);

  return group;
}

function spawnBullet(origin, direction, damage, fromPlayer) {
  const color = fromPlayer ? 0xffdd44 : 0xff5533;
  const mesh = createBulletMesh(color, fromPlayer);
  mesh.position.copy(origin);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction.clone().normalize());
  scene.add(mesh);

  bullets.push({
    mesh,
    direction: direction.clone().normalize(),
    speed: BULLET_SPEED,
    damage,
    fromPlayer,
    traveled: 0,
    maxDist: BULLET_MAX_DIST,
  });
}

function removeBullet(index) {
  const bullet = bullets[index];
  scene.remove(bullet.mesh);
  bullet.mesh.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) child.material.dispose();
  });
  bullets.splice(index, 1);
}

function clearBullets() {
  while (bullets.length > 0) removeBullet(0);
}

function getEnemyGunOrigin() {
  const local = new THREE.Vector3(0.55, 1.38, 1.05);
  local.applyAxisAngle(new THREE.Vector3(0, 1, 0), enemy.yaw);
  return local.add(enemy.position);
}

function updateBullets(dt) {
  const envTargets = obstacleTargets();

  for (let i = bullets.length - 1; i >= 0; i--) {
    const bullet = bullets[i];
    const step = bullet.speed * dt;
    const prevPos = bullet.mesh.position.clone();
    bullet.mesh.position.addScaledVector(bullet.direction, step);
    bullet.traveled += step;

    let hit = false;

    if (bullet.fromPlayer) {
      raycaster.set(prevPos, bullet.direction);
      const hits = raycaster.intersectObject(enemy.mesh, true);
      if (hits.length > 0 && hits[0].distance <= step + 0.2) {
        damageEnemy(bullet.damage);
        spawnHitMarker(hits[0].point, 0xff4444);
        hit = true;
      }
    } else {
      const distToPlayer = bullet.mesh.position.distanceTo(player.position);
      if (distToPlayer < 0.65) {
        damagePlayer(bullet.damage);
        spawnHitMarker(bullet.mesh.position.clone(), 0x44aaff);
        hit = true;
      }
    }

    if (!hit) {
      raycaster.set(prevPos, bullet.direction);
      const envHits = raycaster.intersectObjects(envTargets, true);
      if (envHits.length > 0 && envHits[0].distance <= step + 0.2) {
        spawnHitMarker(envHits[0].point, bullet.fromPlayer ? 0xffaa44 : 0xff6644);
        hit = true;
      }
    }

    if (hit || bullet.traveled >= bullet.maxDist) {
      removeBullet(i);
    }
  }
}

function showMuzzleFlash(origin, direction, color = 0xffaa44) {
  const flash = new THREE.PointLight(color, 3, 4);
  flash.position.copy(origin);
  scene.add(flash);
  setTimeout(() => scene.remove(flash), 60);
}

function shootFromPlayer() {
  if (player.shootTimer > 0 || !gameRunning) return;
  player.shootTimer = SHOOT_COOLDOWN;

  const origin = getShootOrigin();
  const direction = getAimDirection();

  showMuzzleFlash(origin, direction);
  spawnBullet(origin, direction, PLAYER_DAMAGE, true);

  ammoEl.textContent = "FIRING";
  ammoEl.style.color = "#ffaa44";
  setTimeout(() => {
    ammoEl.textContent = "READY";
    ammoEl.style.color = "";
  }, 150);
}

function shootFromEnemy() {
  if (enemy.shootTimer > 0 || enemy.health <= 0) return;

  const dist = enemy.position.distanceTo(player.position);
  if (dist > ENEMY_SHOOT_RANGE) return;

  enemy.shootTimer = ENEMY_SHOOT_COOLDOWN;

  const origin = getEnemyGunOrigin();

  const target = player.position.clone();
  target.y -= 0.1;
  const direction = target.sub(origin).normalize();

  direction.x += (Math.random() - 0.5) * ENEMY_AIM_SPREAD;
  direction.y += (Math.random() - 0.5) * ENEMY_AIM_SPREAD * 0.5;
  direction.z += (Math.random() - 0.5) * ENEMY_AIM_SPREAD;
  direction.normalize();

  enemy.gunFlash.visible = true;
  setTimeout(() => { enemy.gunFlash.visible = false; }, 80);

  showMuzzleFlash(origin, direction, 0xff6644);
  spawnBullet(origin, direction, ENEMY_DAMAGE, false);
}

function spawnHitMarker(point, color) {
  const geo = new THREE.RingGeometry(0.1, 0.25, 8);
  const mat = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: 0.9 });
  const ring = new THREE.Mesh(geo, mat);
  ring.position.copy(point);
  ring.lookAt(camera.position);
  scene.add(ring);

  let scale = 1;
  const animate = () => {
    scale += 0.08;
    ring.scale.set(scale, scale, scale);
    mat.opacity -= 0.06;
    if (mat.opacity > 0) {
      requestAnimationFrame(animate);
    } else {
      scene.remove(ring);
      geo.dispose();
      mat.dispose();
    }
  };
  animate();
}

// ── Damage & HUD ───────────────────────────────────────────────────────────
function updateHealthBars() {
  const pPct = Math.max(0, (player.health / PLAYER_MAX_HEALTH) * 100);
  const ePct = Math.max(0, (enemy.health / ENEMY_MAX_HEALTH) * 100);
  playerHealthFill.style.width = `${pPct}%`;
  enemyHealthFill.style.width = `${ePct}%`;
  playerHealthText.textContent = Math.ceil(player.health);
  enemyHealthText.textContent = Math.ceil(enemy.health);
}

function damagePlayer(amount) {
  player.health = Math.max(0, player.health - amount);
  updateHealthBars();
  flashScreen(0x0044aa, 0.15);
  if (player.health <= 0) endGame(false);
}

function damageEnemy(amount) {
  enemy.health = Math.max(0, enemy.health - amount);
  updateHealthBars();
  enemy.hitParts.forEach((part) => {
    if (part.material?.emissive) {
      part.material.emissive.setHex(0x660000);
      setTimeout(() => part.material.emissive.setHex(part === enemy.body ? 0x110000 : 0x050508), 120);
    }
  });
  if (enemy.health <= 0) endGame(true);
}

function flashScreen(color, intensity) {
  const flash = document.createElement("div");
  flash.style.cssText = `
    position:fixed;inset:0;pointer-events:none;z-index:20;
    background:rgba(${(color >> 16) & 255},${(color >> 8) & 255},${color & 255},${intensity});
  `;
  document.body.appendChild(flash);
  setTimeout(() => flash.remove(), 100);
}

// ── AI ─────────────────────────────────────────────────────────────────────
function updateEnemyAI(dt) {
  if (enemy.health <= 0) return;

  const toPlayer = player.position.clone().sub(enemy.position);
  const dist = toPlayer.length();
  toPlayer.y = 0;

  const targetYaw = Math.atan2(toPlayer.x, toPlayer.z);

  if (dist < ENEMY_CHASE_RANGE) {
    enemy.state = "combat";
  } else {
    enemy.state = "patrol";
  }

  if (enemy.state === "combat") {
    let angleDiff = targetYaw - enemy.yaw;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    enemy.yaw += THREE.MathUtils.clamp(angleDiff, -ENEMY_SPEED * 0.5 * dt, ENEMY_SPEED * 0.5 * dt);

    if (dist > 6) {
      const moveDir = toPlayer.normalize();
      enemy.position.x += moveDir.x * ENEMY_SPEED * dt;
      enemy.position.z += moveDir.z * ENEMY_SPEED * dt;
      resolveCollision(enemy.position, 0.55);
    }

    if (Math.abs(angleDiff) < 0.4) {
      shootFromEnemy();
    }
  } else {
    enemy.patrolTimer -= dt;
    const toTarget = enemy.patrolTarget.clone().sub(enemy.position);
    toTarget.y = 0;

    if (enemy.patrolTimer <= 0 || toTarget.length() < 2) {
      pickPatrolTarget();
    }

    if (toTarget.length() > 1) {
      toTarget.normalize();
      enemy.yaw = Math.atan2(toTarget.x, toTarget.z);
      enemy.position.x += toTarget.x * ENEMY_SPEED * 0.5 * dt;
      enemy.position.z += toTarget.z * ENEMY_SPEED * 0.5 * dt;
      resolveCollision(enemy.position, 0.55);
    }
  }

  enemy.mesh.position.copy(enemy.position);
  enemy.mesh.rotation.y = enemy.yaw;
}

// ── Player movement & camera ───────────────────────────────────────────────
function updatePlayer(dt) {
  if (mouse.locked && !mouse.zooming) {
    // Mouse look handled in mousemove
  } else if (!mouse.locked) {
    if (keys.ArrowLeft) player.yaw += PLAYER_TURN_SPEED * dt;
    if (keys.ArrowRight) player.yaw -= PLAYER_TURN_SPEED * dt;
  }

  const forward = new THREE.Vector3(
    Math.sin(player.yaw) * Math.cos(player.pitch),
    0,
    Math.cos(player.yaw) * Math.cos(player.pitch)
  ).normalize();
  const move = new THREE.Vector3();

  if (keys.ArrowUp) move.add(forward);
  if (keys.ArrowDown) move.sub(forward);

  if (move.lengthSq() > 0) {
    move.normalize().multiplyScalar(PLAYER_SPEED * dt);
    player.position.add(move);
    resolveCollision(player.position, 0.5);
  }

  camera.position.copy(player.position);
  camera.rotation.order = "YXZ";
  camera.rotation.y = player.yaw;
  camera.rotation.x = player.pitch;
}

function updateEnemyZoom(dt) {
  if (mouse.zooming && enemy.health > 0 && gameRunning) {
    camera.fov = THREE.MathUtils.lerp(camera.fov, ZOOM_FOV, dt * 10);
    crosshairEl.classList.add("zoomed");
    zoomIndicator.classList.remove("hidden");

    const enemyTarget = enemy.position.clone();
    enemyTarget.y = 1.6;
    const lookDir = enemyTarget.sub(player.position).normalize();

    const targetYaw = Math.atan2(lookDir.x, lookDir.z);
    const targetPitch = -Math.asin(THREE.MathUtils.clamp(lookDir.y, -1, 1));

    let yawDiff = targetYaw - player.yaw;
    while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
    while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;

    player.yaw += yawDiff * Math.min(1, dt * 8);
    player.pitch += (targetPitch - player.pitch) * Math.min(1, dt * 8);
    player.pitch = THREE.MathUtils.clamp(player.pitch, -Math.PI / 2 + 0.05, Math.PI / 2 - 0.05);
  } else {
    camera.fov = THREE.MathUtils.lerp(camera.fov, NORMAL_FOV, dt * 10);
    crosshairEl.classList.remove("zoomed");
    zoomIndicator.classList.add("hidden");
  }
  camera.updateProjectionMatrix();
}

function requestPointerLock() {
  canvas.requestPointerLock?.();
}

// ── Game flow ──────────────────────────────────────────────────────────────
function resetGame() {
  player.health = PLAYER_MAX_HEALTH;
  player.shootTimer = 0;
  player.position.set(0, PLAYER_HEIGHT, 16);
  player.yaw = 0;
  player.pitch = 0;

  enemy.health = ENEMY_MAX_HEALTH;
  enemy.shootTimer = 0;
  enemy.position.set(0, 0, -16);
  enemy.yaw = Math.PI;
  enemy.state = "patrol";
  pickPatrolTarget();

  enemy.mesh.position.copy(enemy.position);
  enemy.mesh.rotation.y = enemy.yaw;
  enemy.mesh.visible = true;

  clearBullets();
  camera.fov = NORMAL_FOV;
  camera.updateProjectionMatrix();
  mouse.zooming = false;

  updateHealthBars();
}

function startGame() {
  resetGame();
  gameRunning = true;
  overlay.classList.add("hidden");
  hud.classList.remove("hidden");
  menu.classList.add("hidden");
  gameOverEl.classList.add("hidden");
  lastTime = performance.now();
  requestPointerLock();
}

function endGame(victory) {
  gameRunning = false;
  mouse.zooming = false;
  document.exitPointerLock?.();
  overlay.classList.remove("hidden");
  menu.classList.add("hidden");
  gameOverEl.classList.remove("hidden");
  hud.classList.add("hidden");

  if (victory) {
    resultTitle.textContent = "VICTORY";
    resultTitle.className = "victory";
    resultMessage.textContent = "Enemy bot destroyed. Arena cleared.";
  } else {
    resultTitle.textContent = "DEFEATED";
    resultTitle.className = "defeat";
    resultMessage.textContent = "The enemy bot got you. Try again.";
  }

  if (!victory) {
    enemy.mesh.visible = true;
  } else {
    enemy.mesh.visible = false;
  }
}

// ── Input ──────────────────────────────────────────────────────────────────
window.addEventListener("keydown", (e) => {
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) {
    e.preventDefault();
  }
  keys[e.code] = true;
});

window.addEventListener("keyup", (e) => {
  keys[e.code] = false;
});

document.addEventListener("mousemove", (e) => {
  if (!gameRunning || !mouse.locked || mouse.zooming) return;

  player.yaw -= e.movementX * MOUSE_SENSITIVITY;
  player.pitch -= e.movementY * MOUSE_SENSITIVITY;
  player.pitch = THREE.MathUtils.clamp(player.pitch, -Math.PI / 2 + 0.05, Math.PI / 2 - 0.05);
});

document.addEventListener("pointerlockchange", () => {
  mouse.locked = document.pointerLockElement === canvas;
});

canvas.addEventListener("click", () => {
  if (gameRunning && !mouse.locked) requestPointerLock();
});

canvas.addEventListener("mousedown", (e) => {
  if (!gameRunning) return;

  if (e.button === 0) {
    if (!mouse.locked) requestPointerLock();
    shootFromPlayer();
  } else if (e.button === 2) {
    e.preventDefault();
    mouse.zooming = true;
  }
});

canvas.addEventListener("mouseup", (e) => {
  if (e.button === 2) mouse.zooming = false;
});

canvas.addEventListener("contextmenu", (e) => e.preventDefault());

startBtn.addEventListener("click", startGame);
restartBtn.addEventListener("click", startGame);

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ── Main loop ──────────────────────────────────────────────────────────────
function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;

  if (gameRunning) {
    if (player.shootTimer > 0) player.shootTimer -= dt;
    if (enemy.shootTimer > 0) enemy.shootTimer -= dt;

    updateEnemyZoom(dt);
    updatePlayer(dt);
    updateEnemyAI(dt);
    updateBullets(dt);
  }

  renderer.render(scene, camera);
}

requestAnimationFrame(animate);
