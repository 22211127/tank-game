import { Game } from "./engine";
import {
  TILE,
  WIDTH,
  HEIGHT,
  Dir,
  T_BRICK,
  T_STEEL,
  T_WATER,
  T_GRASS,
  T_EMPTY,
  BASE_COL,
  BASE_ROW,
  Tank,
} from "./types";

const DIR_ANGLE: Record<Dir, number> = { 0: 0, 1: Math.PI / 2, 2: Math.PI, 3: -Math.PI / 2 };

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawBrick(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "#8a4a24";
  ctx.fillRect(x, y, TILE, TILE);
  ctx.fillStyle = "#c97a3d";
  const bw = TILE / 2;
  const bh = TILE / 4;
  for (let r = 0; r < 4; r++) {
    const off = r % 2 === 0 ? 0 : bw / 2;
    for (let c = -1; c < 3; c++) {
      ctx.fillRect(x + c * bw + off + 1, y + r * bh + 1, bw - 2, bh - 2);
    }
  }
}

function drawSteel(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "#7d8a99";
  ctx.fillRect(x, y, TILE, TILE);
  ctx.fillStyle = "#b9c6d4";
  ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
  ctx.fillStyle = "#5c6878";
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      ctx.fillRect(x + 4 + i * 8, y + 4 + j * 8, 3, 3);
    }
  }
  ctx.strokeStyle = "rgba(30,40,50,0.5)";
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
}

function drawWater(ctx: CanvasRenderingContext2D, x: number, y: number, time: number) {
  ctx.fillStyle = "#123a6b";
  ctx.fillRect(x, y, TILE, TILE);
  const t = time / 500;
  ctx.strokeStyle = "rgba(90,170,255,0.55)";
  ctx.lineWidth = 2;
  for (let i = 0; i < 2; i++) {
    const yy = y + 10 + i * 12;
    ctx.beginPath();
    for (let k = 0; k <= TILE; k += 4) {
      const off = Math.sin(t + k / 6 + i) * 2;
      if (k === 0) ctx.moveTo(x + k, yy + off);
      else ctx.lineTo(x + k, yy + off);
    }
    ctx.stroke();
  }
}

function drawGrass(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "#1d5c2a";
  ctx.fillRect(x, y, TILE, TILE);
  ctx.fillStyle = "#2f8f43";
  for (let i = 0; i < 6; i++) {
    const gx = x + 4 + ((i * 11) % (TILE - 8));
    const gy = y + 5 + ((i * 17) % (TILE - 10));
    ctx.beginPath();
    ctx.arc(gx, gy, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawBase(ctx: CanvasRenderingContext2D, x: number, y: number, alive: boolean) {
  if (!alive) {
    ctx.fillStyle = "#3a2020";
    ctx.fillRect(x + 3, y + 3, TILE - 6, TILE - 6);
    ctx.strokeStyle = "#7a2d2d";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x + 7, y + 7);
    ctx.lineTo(x + TILE - 7, y + TILE - 7);
    ctx.moveTo(x + TILE - 7, y + 7);
    ctx.lineTo(x + 7, y + TILE - 7);
    ctx.stroke();
    return;
  }
  // eagle base
  ctx.fillStyle = "#f0c02a";
  roundRect(ctx, x + 2, y + 2, TILE - 4, TILE - 4, 6);
  ctx.fill();
  ctx.fillStyle = "#8a5a00";
  ctx.fillRect(x + TILE / 2 - 2, y + 6, 4, TILE - 12);
  ctx.beginPath();
  ctx.moveTo(x + TILE / 2, y + 8);
  ctx.lineTo(x + TILE - 8, y + 14);
  ctx.lineTo(x + TILE / 2, y + 22);
  ctx.lineTo(x + 8, y + 14);
  ctx.closePath();
  ctx.fillStyle = "#5b3a00";
  ctx.fill();
}

function drawTank(ctx: CanvasRenderingContext2D, t: Tank, time: number) {
  const size = t.size;
  const cx = t.x + size / 2;
  const cy = t.y + size / 2;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(DIR_ANGLE[t.dir]);

  // bonus flashing
  let bodyColor = t.color;
  if (t.bonus) {
    bodyColor = Math.floor(time / 150) % 2 === 0 ? "#ff5d8f" : "#ffd23f";
  } else if (t.flash > 0) {
    bodyColor = "#ffffff";
  }

  // shadow
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  roundRect(ctx, -size / 2 + 2, -size / 2 + 3, size, size, 5);
  ctx.fill();

  // treads
  ctx.fillStyle = "#2b333d";
  ctx.fillRect(-size / 2, -size / 2, size * 0.22, size);
  ctx.fillRect(size / 2 - size * 0.22, -size / 2, size * 0.22, size);
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  const treadPhase = Math.floor(time / 90) % 3;
  for (let i = 0; i < 4; i++) {
    ctx.fillRect(-size / 2 + 1, -size / 2 + i * (size / 4) + treadPhase, size * 0.18, 2);
    ctx.fillRect(size / 2 - size * 0.22 + 1, -size / 2 + i * (size / 4) + 2 - treadPhase, size * 0.18, 2);
  }

  // body
  const grad = ctx.createLinearGradient(0, -size / 2, 0, size / 2);
  grad.addColorStop(0, bodyColor);
  grad.addColorStop(1, shade(bodyColor, -35));
  ctx.fillStyle = grad;
  roundRect(ctx, -size / 2 + size * 0.2, -size / 2 + 2, size * 0.6, size - 4, 4);
  ctx.fill();

  // turret
  ctx.fillStyle = shade(bodyColor, -15);
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.22, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = shade(bodyColor, 30);
  ctx.beginPath();
  ctx.arc(-1, -1, size * 0.13, 0, Math.PI * 2);
  ctx.fill();

  // barrel
  ctx.fillStyle = "#1a2029";
  ctx.fillRect(-2.5, -size / 2 - 3, 5, size / 2 + size * 0.2);

  ctx.restore();

  // shield ring
  if (t.shield > 0) {
    const alpha = 0.4 + 0.3 * Math.sin(time / 80);
    ctx.strokeStyle = `rgba(126,231,135,${alpha})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(cx, cy, size / 2 + 4, 0, Math.PI * 2);
    ctx.stroke();
  }

  // frozen tint
  if (t.frozen > 0) {
    ctx.fillStyle = "rgba(120,200,255,0.35)";
    roundRect(ctx, t.x, t.y, size, size, 5);
    ctx.fill();
  }
}

function shade(hex: string, amt: number): string {
  const n = parseInt(hex.replace("#", ""), 16);
  let r = (n >> 16) + amt;
  let g = ((n >> 8) & 0xff) + amt;
  let b = (n & 0xff) + amt;
  r = Math.max(0, Math.min(255, r));
  g = Math.max(0, Math.min(255, g));
  b = Math.max(0, Math.min(255, b));
  return `rgb(${r},${g},${b})`;
}

const POWER_ICONS: Record<string, { icon: string; color: string }> = {
  star: { icon: "★", color: "#ffd23f" },
  shield: { icon: "◈", color: "#7ee787" },
  life: { icon: "♥", color: "#ff5d8f" },
  bomb: { icon: "✸", color: "#ff8a3d" },
  clock: { icon: "◷", color: "#8ec7ff" },
};

export function render(ctx: CanvasRenderingContext2D, game: Game) {
  const s = game.state;
  const time = performance.now();

  // background
  ctx.fillStyle = "#0b0f14";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // subtle grid
  ctx.strokeStyle = "rgba(255,255,255,0.025)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= WIDTH; i += TILE) {
    ctx.beginPath();
    ctx.moveTo(i + 0.5, 0);
    ctx.lineTo(i + 0.5, HEIGHT);
    ctx.stroke();
  }
  for (let i = 0; i <= HEIGHT; i += TILE) {
    ctx.beginPath();
    ctx.moveTo(0, i + 0.5);
    ctx.lineTo(WIDTH, i + 0.5);
    ctx.stroke();
  }

  // map (grass drawn after tanks for overlay effect)
  const grassCells: [number, number][] = [];
  for (let r = 0; r < s.map.length; r++) {
    for (let c = 0; c < s.map[r].length; c++) {
      const tile = s.map[r][c];
      const x = c * TILE;
      const y = r * TILE;
      if (tile === T_BRICK) drawBrick(ctx, x, y);
      else if (tile === T_STEEL) drawSteel(ctx, x, y);
      else if (tile === T_WATER) drawWater(ctx, x, y, time);
      else if (tile === T_GRASS) grassCells.push([x, y]);
    }
  }

  // base
  drawBase(ctx, BASE_COL * TILE, BASE_ROW * TILE, s.baseAlive);

  // power-ups
  for (const p of s.powerUps) {
    const info = POWER_ICONS[p.type];
    const pulse = 1 + Math.sin(time / 200) * 0.08;
    const flicker = p.ttl < 3000 && Math.floor(time / 150) % 2 === 0;
    ctx.save();
    ctx.globalAlpha = flicker ? 0.35 : 1;
    ctx.translate(p.x + 12, p.y + 12);
    ctx.scale(pulse, pulse);
    ctx.fillStyle = "rgba(10,14,18,0.85)";
    roundRect(ctx, -12, -12, 24, 24, 6);
    ctx.fill();
    ctx.strokeStyle = info.color;
    ctx.lineWidth = 2;
    roundRect(ctx, -12, -12, 24, 24, 6);
    ctx.stroke();
    ctx.fillStyle = info.color;
    ctx.font = "bold 16px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(info.icon, 0, 1);
    ctx.restore();
  }

  // tanks
  for (const t of s.tanks) {
    if (t.alive) drawTank(ctx, t, time);
  }

  // bullets
  for (const b of s.bullets) {
    ctx.save();
    ctx.shadowColor = b.fromPlayer ? "#7ee787" : "#ff5d5d";
    ctx.shadowBlur = 8;
    ctx.fillStyle = b.fromPlayer ? "#d6ffd9" : "#ffd0d0";
    roundRect(ctx, b.x, b.y, 5, 5, 2.5);
    ctx.fill();
    ctx.restore();
  }

  // grass overlay
  for (const [x, y] of grassCells) drawGrass(ctx, x, y);

  // particles
  for (const p of s.particles) {
    const a = Math.max(0, p.life / p.maxLife);
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // explosions
  for (const e of s.explosions) {
    const prog = 1 - e.t / 380;
    const r = e.size * (0.3 + prog * 0.7);
    const a = Math.max(0, 1 - prog);
    const g = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, r);
    g.addColorStop(0, `rgba(255,255,220,${a})`);
    g.addColorStop(0.4, `rgba(255,170,60,${a * 0.9})`);
    g.addColorStop(1, `rgba(255,80,20,0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(e.x, e.y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // HUD (top overlay strip)
  drawHud(ctx, game);

  // base danger vignette
  if (s.baseAlive === false) {
    ctx.fillStyle = "rgba(120,0,0,0.12)";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }
}

function drawHud(ctx: CanvasRenderingContext2D, game: Game) {
  const s = game.state;
  ctx.save();
  ctx.fillStyle = "rgba(8,12,16,0.72)";
  roundRect(ctx, 8, 8, 168, 64, 8);
  ctx.fill();

  ctx.font = "600 12px 'Segoe UI', sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#9fb0c2";
  ctx.fillText("分数", 20, 26);
  ctx.fillText("关卡", 110, 26);
  ctx.fillStyle = "#ffd23f";
  ctx.font = "700 16px 'Segoe UI', sans-serif";
  ctx.fillText(String(s.score).padStart(5, "0"), 20, 46);
  ctx.fillText(String(s.level).padStart(2, "0"), 110, 46);

  // lives
  ctx.fillStyle = "#9fb0c2";
  ctx.font = "600 12px 'Segoe UI', sans-serif";
  ctx.fillText("生命", 20, 63);
  ctx.fillStyle = "#ff5d8f";
  const lives = Math.max(0, s.lives);
  for (let i = 0; i < Math.min(lives, 5); i++) {
    ctx.fillText("♥", 56 + i * 14, 63);
  }

  // player level stars
  ctx.fillStyle = "#ffd23f";
  for (let i = 0; i < s.playerLevel; i++) {
    ctx.fillText("★", 110 + i * 13, 63);
  }

  // enemies remaining indicator (right)
  const total = game.enemiesLeftCount;
  ctx.fillStyle = "rgba(8,12,16,0.72)";
  roundRect(ctx, WIDTH - 92, 8, 84, 40, 8);
  ctx.fill();
  ctx.fillStyle = "#9fb0c2";
  ctx.font = "600 12px 'Segoe UI', sans-serif";
  ctx.fillText("剩余敌人", WIDTH - 80, 22);
  ctx.fillStyle = "#ff6b6b";
  ctx.font = "700 15px 'Segoe UI', sans-serif";
  ctx.fillText(String(total).padStart(2, "0"), WIDTH - 80, 38);

  // draw small enemy icons count
  ctx.restore();
}
