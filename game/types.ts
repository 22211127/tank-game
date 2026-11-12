export const TILE = 32;
export const COLS = 15;
export const ROWS = 15;
export const WIDTH = TILE * COLS;
export const HEIGHT = TILE * ROWS;

export type Dir = 0 | 1 | 2 | 3; // up, right, down, left
export type TileType = number; // 0 empty, 1 brick, 2 steel, 3 water, 4 grass overlay

export const T_EMPTY = 0;
export const T_BRICK = 1;
export const T_STEEL = 2;
export const T_WATER = 3;
export const T_GRASS = 4;

export type Phase = "menu" | "playing" | "paused" | "levelclear" | "gameover" | "win";

export interface Bullet {
  x: number;
  y: number;
  dir: Dir;
  speed: number;
  fromPlayer: boolean;
  power: number;
  owner: number;
}

export interface Tank {
  id: number;
  x: number;
  y: number;
  dir: Dir;
  speed: number;
  size: number;
  isPlayer: boolean;
  alive: boolean;
  hp: number;
  cooldown: number;
  reload: number;
  shield: number;
  frozen: number;
  bonus: boolean; // flashing bonus enemy
  color: string;
  kind: "player" | "basic" | "fast" | "power" | "armor";
  flash: number; // hit flash timer
  aiMoveTimer: number;
  aiFireTimer: number;
  aiDir: Dir;
}

export interface PowerUp {
  x: number;
  y: number;
  type: "star" | "shield" | "life" | "bomb" | "clock";
  ttl: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

export interface Explosion {
  x: number;
  y: number;
  t: number;
  size: number;
}

export interface GameState {
  phase: Phase;
  level: number;
  score: number;
  lives: number;
  maxEnemies: number;
  enemiesRemaining: number; // still to spawn
  enemiesOnField: number;
  tanks: Tank[];
  bullets: Bullet[];
  map: TileType[][];
  player: Tank | null;
  powerUps: PowerUp[];
  particles: Particle[];
  explosions: Explosion[];
  playerLevel: number; // 0-3 upgrade
  shieldTimer: number;
  baseAlive: boolean;
  time: number;
}

export const BASE_COL = 7;
export const BASE_ROW = 14;
export const SPAWN_COLS = [0, 7, 14];
