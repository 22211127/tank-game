import {
  TILE,
  COLS,
  ROWS,
  WIDTH,
  HEIGHT,
  Dir,
  TileType,
  T_EMPTY,
  T_BRICK,
  T_STEEL,
  T_WATER,
  T_GRASS,
  GameState,
  Tank,
  Bullet,
  BASE_COL,
  BASE_ROW,
  SPAWN_COLS,
  PowerUp,
} from "./types";

const DIRS: Record<Dir, { x: number; y: number }> = {
  0: { x: 0, y: -1 },
  1: { x: 1, y: 0 },
  2: { x: 0, y: 1 },
  3: { x: -1, y: 0 },
};

const rand = (n: number) => Math.floor(Math.random() * n);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export interface LevelConfig {
  bricks: number;
  steels: number;
  waters: number;
  grass: number;
  enemies: number;
  fastChance: number;
  powerChance: number;
  armorChance: number;
}

export function levelConfig(level: number): LevelConfig {
  return {
    bricks: 34 + level * 5,
    steels: clamp(4 + level * 3, 0, 44),
    waters: clamp(level > 1 ? 2 + level : 0, 0, 12),
    grass: clamp(3 + level * 2, 0, 16),
    enemies: 8 + Math.min(level * 2, 12),
    fastChance: clamp(0.2 + level * 0.05, 0, 0.5),
    powerChance: clamp(0.12 + level * 0.04, 0, 0.4),
    armorChance: clamp(0.08 + level * 0.04, 0, 0.4),
  };
}

export function createEmptyMap(): TileType[][] {
  return Array.from({ length: ROWS }, () => Array<TileType>(COLS).fill(T_EMPTY));
}

export function generateMap(level: number): TileType[][] {
  const map = createEmptyMap();
  const cfg = levelConfig(level);
  const occupied = new Set<string>();

  // protect base area (bottom middle 5x4) and spawn zones (top corners/middle)
  const isProtected = (r: number, c: number) => {
    if (r >= ROWS - 4 && c >= BASE_COL - 2 && c <= BASE_COL + 2) return true;
    if (r <= 1 && [0, 1, COLS - 2, COLS - 1, BASE_COL].includes(c)) return true;
    return false;
  };

  const place = (type: TileType, count: number) => {
    let placed = 0;
    let guard = 0;
    while (placed < count && guard++ < 4000) {
      const r = rand(ROWS);
      const c = rand(COLS);
      const key = `${r},${c}`;
      if (occupied.has(key) || isProtected(r, c)) continue;
      // keep some road space: avoid fully filling
      map[r][c] = type;
      occupied.add(key);
      placed++;
    }
  };

  // symmetric-ish structures: brick clusters
  place(T_BRICK, cfg.bricks);
  place(T_STEEL, cfg.steels);
  place(T_WATER, cfg.waters);
  place(T_GRASS, cfg.grass);

  // Mirror for nicer layout
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS / 2; c++) {
      if (occupied.has(`${r},${c}`) && !isProtected(r, COLS - 1 - c)) {
        map[r][COLS - 1 - c] = map[r][c];
      }
    }
  }

  // Base protection: brick wall around base
  for (let c = BASE_COL - 1; c <= BASE_COL + 1; c++) {
    if (c >= 0 && c < COLS && map[ROWS - 2][c] === T_EMPTY) map[ROWS - 2][c] = T_BRICK;
  }
  if (map[ROWS - 1]?.[BASE_COL - 1] !== undefined) map[ROWS - 1][BASE_COL - 1] = T_BRICK;
  if (map[ROWS - 1]?.[BASE_COL + 1] !== undefined) map[ROWS - 1][BASE_COL + 1] = T_BRICK;

  return map;
}

let TANK_ID = 1;

function makeTank(kind: Tank["kind"], x: number, y: number, isPlayer: boolean): Tank {
  const base: Record<string, { speed: number; hp: number; color: string }> = {
    player: { speed: 2.6, hp: 1, color: "#7ee787" },
    basic: { speed: 1.1, hp: 1, color: "#c8c8c8" },
    fast: { speed: 1.9, hp: 1, color: "#8ec7ff" },
    power: { speed: 1.2, hp: 1, color: "#ffd23f" },
    armor: { speed: 1.0, hp: 3, color: "#ff8a5c" },
  };
  const spec = base[kind];
  return {
    id: TANK_ID++,
    x,
    y,
    dir: isPlayer ? 0 : 2,
    speed: spec.speed,
    size: TILE - 6,
    isPlayer,
    alive: true,
    hp: spec.hp,
    cooldown: 0,
    reload: isPlayer ? 380 : 700,
    shield: 0,
    frozen: 0,
    bonus: false,
    color: spec.color,
    kind,
    flash: 0,
    aiMoveTimer: 0,
    aiFireTimer: rand(60),
    aiDir: rand(4) as Dir,
  };
}

export class Game {
  state: GameState;
  keys: Set<string> = new Set();
  private firePressed = false;
  private spawnTimer = 0;
  private lastTime = 0;
  private raf = 0;
  onEnd?: (win: boolean) => void;

  constructor() {
    this.state = this.freshState();
  }

  private freshState(): GameState {
    return {
      phase: "menu",
      level: 1,
      score: 0,
      lives: 3,
      maxEnemies: 0,
      enemiesRemaining: 0,
      enemiesOnField: 0,
      tanks: [],
      bullets: [],
      map: createEmptyMap(),
      player: null,
      powerUps: [],
      particles: [],
      explosions: [],
      playerLevel: 0,
      shieldTimer: 0,
      baseAlive: true,
      time: 0,
    };
  }

  start(level = 1) {
    this.state = this.freshState();
    this.state.level = level;
    this.loadLevel(level);
    this.state.phase = "playing";
    this.lastTime = performance.now();
  }

  nextLevel() {
    this.loadLevel(this.state.level + 1);
    this.state.phase = "playing";
    this.lastTime = performance.now();
  }

  private loadLevel(level: number) {
    const s = this.state;
    s.map = generateMap(level);
    s.bullets = [];
    s.tanks = [];
    s.powerUps = [];
    s.particles = [];
    s.explosions = [];
    s.baseAlive = true;
    s.level = level;
    const cfg = levelConfig(level);
    s.maxEnemies = cfg.enemies;
    s.enemiesRemaining = cfg.enemies;
    s.enemiesOnField = 0;
    this.spawnTimer = 0;

    const px = BASE_COL * TILE + 3;
    const py = (ROWS - 2) * TILE + 3;
    const player = makeTank("player", px, py, true);
    player.speed = 2.6;
    player.reload = Math.max(200, 380 - s.playerLevel * 55);
    player.shield = 2200;
    s.player = player;
    s.tanks.push(player);
  }

  private spawnEnemy() {
    const s = this.state;
    if (s.enemiesRemaining <= 0) return;
    if (s.enemiesOnField >= Math.min(4 + Math.floor(s.level / 2), 6)) return;

    const cfg = levelConfig(s.level);
    let kind: Tank["kind"] = "basic";
    const roll = Math.random();
    if (roll < cfg.armorChance) kind = "armor";
    else if (roll < cfg.armorChance + cfg.powerChance) kind = "power";
    else if (roll < cfg.armorChance + cfg.powerChance + cfg.fastChance) kind = "fast";

    const col = SPAWN_COLS[rand(SPAWN_COLS.length)];
    // avoid overlap with existing tanks at spawn
    const x = col * TILE + 3;
    const y = 3;
    if (this.tanksOverlap(x, y, TILE - 6)) return;

    const t = makeTank(kind, x, y, false);
    t.aiFireTimer = 40 + rand(80);
    // bonus enemy appears occasionally
    if (s.enemiesRemaining === s.maxEnemies && Math.random() < 0.6) {
      t.bonus = true;
      t.kind = "fast";
      t.color = "#ff5d8f";
    }
    s.tanks.push(t);
    s.enemiesRemaining--;
    s.enemiesOnField++;
  }

  private tanksOverlap(x: number, y: number, size: number, ignoreId?: number) {
    return this.state.tanks.some(
      (t) =>
        t.alive &&
        t.id !== ignoreId &&
        x < t.x + t.size &&
        x + size > t.x &&
        y < t.y + t.size &&
        y + size > t.y,
    );
  }

  private collidesMap(x: number, y: number, size: number): boolean {
    const { map } = this.state;
    const c0 = Math.floor(x / TILE);
    const c1 = Math.floor((x + size - 1) / TILE);
    const r0 = Math.floor(y / TILE);
    const r1 = Math.floor((y + size - 1) / TILE);
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        if (r < 0 || c < 0 || r >= ROWS || c >= COLS) return true;
        const tile = map[r][c];
        if (tile === T_BRICK || tile === T_STEEL || tile === T_WATER) return true;
        // base blocks tanks
        if (r === BASE_ROW && c === BASE_COL) return true;
      }
    }
    return false;
  }

  private moveTank(t: Tank, dir: Dir, dt: number): boolean {
    if (t.frozen > 0) return false;
    t.dir = dir;
    const step = t.speed * (dt / 16.67);
    const d = DIRS[dir];
    const nx = t.x + d.x * step;
    const ny = t.y + d.y * step;
    if (this.collidesMap(nx, ny, t.size) || this.tanksOverlap(nx, ny, t.size, t.id)) {
      return false;
    }
    t.x = nx;
    t.y = ny;
    return true;
  }

  private fire(t: Tank) {
    const s = this.state;
    if (t.cooldown > 0) return;
    if (t.frozen > 0) return;
    // limit player bullets by playerLevel
    const maxBullets = t.isPlayer ? (s.playerLevel >= 2 ? 2 : 1) : 1;
    const ownerBullets = s.bullets.filter((b) => b.owner === t.id).length;
    if (ownerBullets >= maxBullets) return;

    t.cooldown = t.reload;
    const cx = t.x + t.size / 2;
    const cy = t.y + t.size / 2;
    const d = DIRS[t.dir];
    const power = t.isPlayer ? (s.playerLevel >= 3 ? 2 : 1) : t.kind === "power" ? 2 : 1;
    const speed = t.isPlayer ? 6.2 : 4.2;
    s.bullets.push({
      x: cx + d.x * (t.size / 2) - 2,
      y: cy + d.y * (t.size / 2) - 2,
      dir: t.dir,
      speed,
      fromPlayer: t.isPlayer,
      power,
      owner: t.id,
    });
  }

  update(dt: number) {
    const s = this.state;
    s.time += dt;
    if (s.phase !== "playing") return;

    // spawn logic
    if (s.enemiesRemaining > 0) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnEnemy();
        this.spawnTimer = 1400;
      }
    }

    s.particles = s.particles.filter((p) => (p.life -= dt) > 0);
    s.particles.forEach((p) => {
      p.x += p.vx * (dt / 16.67);
      p.y += p.vy * (dt / 16.67);
      p.vy += 0.04;
    });
    s.explosions = s.explosions.filter((e) => (e.t -= dt) > 0);
    s.powerUps = s.powerUps.filter((p) => (p.ttl -= dt) > 0);

    // bullets
    for (const b of s.bullets) {
      const steps = Math.ceil(b.speed * (dt / 16.67) / 6);
      for (let i = 0; i < Math.max(1, steps); i++) {
        const d = DIRS[b.dir];
        b.x += (d.x * b.speed * (dt / 16.67)) / Math.max(1, steps);
        b.y += (d.y * b.speed * (dt / 16.67)) / Math.max(1, steps);
        if (this.bulletHit(b)) break;
      }
    }
    s.bullets = s.bullets.filter((b) => !(b as Bullet & { dead?: boolean }).dead && b.x > -10 && b.y > -10 && b.x < WIDTH + 10 && b.y < HEIGHT + 10);

    // tanks
    for (const t of s.tanks) {
      if (!t.alive) continue;
      t.cooldown = Math.max(0, t.cooldown - dt);
      t.shield = Math.max(0, t.shield - dt);
      t.frozen = Math.max(0, t.frozen - dt);
      t.flash = Math.max(0, t.flash - dt);
      if (t.isPlayer) this.updatePlayer(t, dt);
      else this.updateAI(t, dt);
    }

    s.tanks = s.tanks.filter((t) => t.alive || t.isPlayer);

    // win / lose
    if (!s.baseAlive) {
      this.gameOver(false);
      return;
    }
    if (s.enemiesRemaining <= 0 && s.enemiesOnField <= 0 && s.tanks.every((t) => t.isPlayer)) {
      s.phase = "levelclear";
    }
  }

  private updatePlayer(t: Tank, dt: number) {
    const s = this.state;
    let moved = false;
    if (this.keys.has("ArrowUp") || this.keys.has("w") || this.keys.has("W")) moved = this.moveTank(t, 0, dt);
    else if (this.keys.has("ArrowDown") || this.keys.has("s") || this.keys.has("S")) moved = this.moveTank(t, 2, dt);
    else if (this.keys.has("ArrowLeft") || this.keys.has("a") || this.keys.has("A")) moved = this.moveTank(t, 3, dt);
    else if (this.keys.has("ArrowRight") || this.keys.has("d") || this.keys.has("D")) moved = this.moveTank(t, 1, dt);

    if (moved) this.emitDust(t);

    if (this.firePressed || this.keys.has(" ") || this.keys.has("j") || this.keys.has("J")) {
      this.fire(t);
    }

    // pickup powerups
    for (const p of s.powerUps) {
      if (t.x < p.x + 24 && t.x + t.size > p.x && t.y < p.y + 24 && t.y + t.size > p.y) {
        this.applyPowerUp(p.type);
        p.ttl = 0;
        this.burst(p.x + 12, p.y + 12, "#ffd23f", 18);
      }
    }
    s.powerUps = s.powerUps.filter((p) => p.ttl > 0);
  }

  private updateAI(t: Tank, dt: number) {
    const s = this.state;
    const player = s.player;
    t.aiMoveTimer -= dt;
    t.aiFireTimer -= dt;

    if (t.aiMoveTimer <= 0) {
      t.aiMoveTimer = 500 + rand(900);
      // choose direction, favor toward base/player
      const target = player && player.alive && Math.random() < 0.55 ? player : { x: BASE_COL * TILE, y: BASE_ROW * TILE };
      const dx = target.x - t.x;
      const dy = target.y - t.y;
      const opts: Dir[] = [];
      if (Math.abs(dx) > Math.abs(dy)) {
        opts.push(dx > 0 ? 1 : 3, dy > 0 ? 2 : 0);
      } else {
        opts.push(dy > 0 ? 2 : 0, dx > 0 ? 1 : 3);
      }
      opts.push(rand(4) as Dir);
      t.aiDir = Math.random() < 0.7 ? opts[0] : opts[rand(opts.length)];
    }

    if (t.frozen <= 0) {
      const ok = this.moveTank(t, t.aiDir, dt);
      if (!ok) {
        t.aiDir = rand(4) as Dir;
        t.aiMoveTimer = Math.min(t.aiMoveTimer, 200);
      }
    }

    // fire
    if (t.aiFireTimer <= 0) {
      t.aiFireTimer = 700 + rand(900) - Math.min(s.level * 40, 400);
      // fire along current dir
      this.fire(t);
    }
  }

  private emitDust(t: Tank) {
    if (Math.random() > 0.35) return;
    this.state.particles.push({
      x: t.x + t.size / 2 + (Math.random() - 0.5) * t.size,
      y: t.y + t.size / 2 + (Math.random() - 0.5) * t.size,
      vx: (Math.random() - 0.5) * 0.6,
      vy: (Math.random() - 0.5) * 0.6,
      life: 260,
      maxLife: 260,
      size: 2 + Math.random() * 2,
      color: "rgba(150,160,170,0.5)",
    });
  }

  private bulletHit(b: Bullet): boolean {
    const s = this.state;
    const bd = b as Bullet & { dead?: boolean };
    const bx = b.x;
    const by = b.y;
    const size = 4;

    // out of bounds
    if (bx < 0 || by < 0 || bx + size > WIDTH || by + size > HEIGHT) {
      this.burst(bx, by, "#fff", 6);
      bd.dead = true;
      return true;
    }

    // map
    const c0 = Math.floor(bx / TILE);
    const c1 = Math.floor((bx + size) / TILE);
    const r0 = Math.floor(by / TILE);
    const r1 = Math.floor((by + size) / TILE);
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        if (r < 0 || c < 0 || r >= ROWS || c >= COLS) continue;
        const tile = s.map[r][c];
        if (r === BASE_ROW && c === BASE_COL) {
          // base hit
          if (b.fromPlayer) continue;
          s.baseAlive = false;
          this.bigExplosion(c * TILE + TILE / 2, r * TILE + TILE / 2);
          bd.dead = true;
          return true;
        }
        if (tile === T_BRICK) {
          s.map[r][c] = T_EMPTY;
          // widen hole for power bullets
          if (b.power >= 2) {
            const d = DIRS[b.dir];
            const nc = c + (d.x !== 0 ? d.x : 0);
            const nr = r + (d.y !== 0 ? d.y : 0);
            if (nc >= 0 && nc < COLS && nr >= 0 && nr < ROWS && s.map[nr][nc] === T_BRICK) s.map[nr][nc] = T_EMPTY;
          }
          this.burst(bx, by, "#b06a3b", 10);
          bd.dead = true;
          return true;
        }
        if (tile === T_STEEL) {
          if (b.power >= 2) {
            s.map[r][c] = T_EMPTY;
            this.burst(bx, by, "#cfd8e3", 12);
          } else {
            this.burst(bx, by, "#cfd8e3", 6);
          }
          bd.dead = true;
          return true;
        }
      }
    }

    // tanks
    for (const t of s.tanks) {
      if (!t.alive) continue;
      if (t.isPlayer === b.fromPlayer) continue;
      if (bx + size < t.x || bx > t.x + t.size || by + size < t.y || by > t.y + t.size) continue;

      bd.dead = true;
      if (t.isPlayer) {
        if (t.shield > 0) {
          this.burst(bx, by, "#7ee787", 12);
          return true;
        }
        this.killPlayer(t);
      } else {
        t.hp -= 1;
        t.flash = 120;
        if (t.hp <= 0) {
          this.killEnemy(t);
        } else {
          this.burst(bx, by, "#fff", 8);
        }
      }
      return true;
    }
    return false;
  }

  private killPlayer(t: Tank) {
    const s = this.state;
    t.alive = false;
    this.bigExplosion(t.x + t.size / 2, t.y + t.size / 2);
    s.lives -= 1;
    s.playerLevel = Math.max(0, s.playerLevel - 1);
    if (s.lives < 0) {
      s.baseAlive = s.baseAlive; // keep
      this.gameOver(false);
      return;
    }
    // respawn
    const px = BASE_COL * TILE + 3;
    const py = (ROWS - 2) * TILE + 3;
    const p = makeTank("player", px, py, true);
    p.shield = 2500;
    p.reload = Math.max(200, 380 - s.playerLevel * 55);
    if (s.player) s.player.alive = false;
    s.player = p;
    s.tanks = s.tanks.filter((x) => x.isPlayer === false || x.alive);
    s.tanks.push(p);
  }

  private killEnemy(t: Tank) {
    const s = this.state;
    t.alive = false;
    s.enemiesOnField--;
    const pts = t.bonus ? 500 : t.kind === "armor" ? 300 : t.kind === "power" ? 200 : t.kind === "fast" ? 150 : 100;
    s.score += pts;
    this.bigExplosion(t.x + t.size / 2, t.y + t.size / 2);

    // chance to drop power-up
    const dropChance = t.bonus ? 1 : 0.18;
    if (Math.random() < dropChance) {
      const types: PowerUp["type"][] = ["star", "shield", "life", "bomb", "clock"];
      const type = t.bonus ? "star" : types[rand(types.length)];
      s.powerUps.push({ x: t.x, y: t.y, type, ttl: 14000 });
    }
  }

  private applyPowerUp(type: PowerUp["type"]) {
    const s = this.state;
    switch (type) {
      case "star":
        s.playerLevel = Math.min(3, s.playerLevel + 1);
        if (s.player) s.player.reload = Math.max(190, 380 - s.playerLevel * 55);
        break;
      case "shield":
        s.shieldTimer = 8000;
        if (s.player) s.player.shield = 8000;
        break;
      case "life":
        s.lives += 1;
        break;
      case "bomb":
        for (const t of s.tanks) {
          if (!t.isPlayer && t.alive) this.killEnemy(t);
        }
        break;
      case "clock":
        for (const t of s.tanks) if (!t.isPlayer) t.frozen = 6000;
        break;
    }
    s.score += 50;
  }

  private bigExplosion(x: number, y: number) {
    this.state.explosions.push({ x, y, t: 380, size: 46 });
    this.burst(x, y, "#ff9d3f", 24);
    this.burst(x, y, "#ffe066", 16);
  }

  private burst(x: number, y: number, color: string, n: number) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 0.5 + Math.random() * 3;
      this.state.particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 300 + Math.random() * 400,
        maxLife: 700,
        size: 1.5 + Math.random() * 2.5,
        color,
      });
    }
  }

  private gameOver(win: boolean) {
    this.state.phase = win ? "win" : "gameover";
    this.onEnd?.(win);
  }

  // input handlers
  keyDown(code: string) {
    this.keys.add(code);
  }
  keyUp(code: string) {
    this.keys.delete(code);
  }
  pressFire() {
    this.firePressed = true;
    setTimeout(() => (this.firePressed = false), 60);
  }
  releaseFire() {
    this.firePressed = false;
  }

  get enemiesLeftCount() {
    const s = this.state;
    return s.enemiesRemaining + s.enemiesOnField;
  }
}
