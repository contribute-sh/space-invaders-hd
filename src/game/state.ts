export type GamePhase =
  | "start"
  | "playing"
  | "lifeLost"
  | "paused"
  | "waveClear"
  | "gameOver";

export type Input = {
  moveX: -1 | 0 | 1;
  firePressed: boolean;
  pausePressed: boolean;
  fireHeld?: boolean;
  pauseHeld?: boolean;
  mutePressed?: boolean;
};

export type Arena = {
  width: number;
  height: number;
  floorY: number;
  padding: number;
};

export type Player = {
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number;
  shootCooldownMs: number;
  invulnerableUntilMs: number;
};

export type Invader = {
  id: number;
  row: number;
  col: number;
  x: number;
  y: number;
  width: number;
  height: number;
  points: number;
};

export type Projectile = {
  id: number;
  owner: "player" | "invader";
  x: number;
  y: number;
  width: number;
  height: number;
  velocityY: number;
  active: boolean;
};

export type ShieldCell = {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  alive: boolean;
};

export type Shield = {
  id: number;
  cells: ShieldCell[];
};

export type Formation = {
  direction: -1 | 1;
  speed: number;
  descendStep: number;
  leftBound: number;
  rightBound: number;
};

export type HudState = {
  score: number;
  lives: number;
  wave: number;
};

export type GameState = {
  phase: GamePhase;
  arena: Arena;
  player: Player;
  invaders: Invader[];
  projectiles: Projectile[];
  shields: Shield[];
  formation: Formation;
  hud: HudState;
  frame: number;
  marchFrame: 0 | 1;
  playerShootFrame: number;
  nextProjectileId: number;
  invaderFireCooldownMs: number;
  transitionTimerMs: number;
  elapsedMs: number;
};

export type GameStateSeed = {
  wave?: number;
  score?: number;
  lives?: number;
  phase?: GamePhase;
  frame?: number;
  nextProjectileId?: number;
  invaderFireCooldownMs?: number;
  transitionTimerMs?: number;
  elapsedMs?: number;
};

export const ARENA_WIDTH = 960;
export const ARENA_HEIGHT = 720;
export const ARENA_PADDING = 56;
export const FLOOR_Y = 664;
export const PLAYER_WIDTH = 76;
export const PLAYER_HEIGHT = 30;
export const PLAYER_SPEED = 420;
export const PLAYER_SHOOT_COOLDOWN_MS = 240;
export const STARTING_LIVES = 3;
export const PROJECTILE_WIDTH = 6;
export const PROJECTILE_HEIGHT = 18;
export const PROJECTILE_SPEED = -720;
export const INVADER_PROJECTILE_WIDTH = 6;
export const INVADER_PROJECTILE_HEIGHT = 18;
export const INVADER_PROJECTILE_SPEED = 240;
export const INVADER_FIRE_INTERVAL_MS = 1_200;
export const SHIELD_COUNT = 4;
export const SHIELD_CELL_ROWS = 4;
export const SHIELD_CELL_COLS = 6;
export const SHIELD_CELL_WIDTH = 16;
export const SHIELD_CELL_HEIGHT = 12;
export const INVADER_ROWS = 5;
export const INVADER_COLS = 11;
export const INVADER_WIDTH = 48;
export const INVADER_HEIGHT = 30;
export const INVADER_GAP_X = 18;
export const INVADER_GAP_Y = 18;
export const INVADER_START_Y = 108;
export const FORMATION_SPEED_BASE = 72;
export const FORMATION_SPEED_PER_WAVE = 1 / 6;
export const FORMATION_SPEED_MAX = 288;
export const INVADER_BASE_SPEED = FORMATION_SPEED_BASE;
export const INVADER_WAVE_SPEED_STEP =
  FORMATION_SPEED_BASE * FORMATION_SPEED_PER_WAVE;
export const INVADER_DESCEND_STEP = 24;
export const LIFE_LOST_DURATION_MS = 900;
export const RESPAWN_INVULNERABILITY_MS = 1500;

export const EMPTY_INPUT: Input = {
  moveX: 0,
  firePressed: false,
  pausePressed: false,
  fireHeld: false,
  pauseHeld: false,
  mutePressed: false
};

const ROW_POINTS = [50, 40, 30, 20, 10] as const;
const FORMATION_SPEED_KILL_MULTIPLIER = 2.7;

export function createInitialGameState(): GameState {
  return createGameState({ phase: "start" });
}

export function createPlayingState(
  seed: Omit<GameStateSeed, "phase"> = {}
): GameState {
  return createGameState({ ...seed, phase: "playing" });
}

export function createGameState(seed: GameStateSeed = {}): GameState {
  const arena = createArena();
  const wave = seed.wave ?? 1;
  const score = seed.score ?? 0;
  const lives = seed.lives ?? STARTING_LIVES;
  const invaders = createInvaders(arena, wave);
  const shields = createShields(arena);
  const nextProjectileId = seed.nextProjectileId ?? 1;
  const invaderFireCooldownMs =
    seed.invaderFireCooldownMs ?? INVADER_FIRE_INTERVAL_MS;

  return {
    phase: seed.phase ?? "start",
    arena,
    player: createPlayer(arena),
    invaders,
    projectiles: [],
    shields,
    formation: createFormation(arena, wave),
    hud: {
      score,
      lives,
      wave
    },
    frame: seed.frame ?? 0,
    marchFrame: 0,
    playerShootFrame: 0,
    nextProjectileId,
    invaderFireCooldownMs,
    transitionTimerMs: seed.transitionTimerMs ?? 0,
    elapsedMs: seed.elapsedMs ?? 0
  };
}

export function createArena(): Arena {
  return {
    width: ARENA_WIDTH,
    height: ARENA_HEIGHT,
    floorY: FLOOR_Y,
    padding: ARENA_PADDING
  };
}

export function createPlayer(arena: Arena): Player {
  return {
    x: (arena.width - PLAYER_WIDTH) / 2,
    y: arena.floorY - PLAYER_HEIGHT,
    width: PLAYER_WIDTH,
    height: PLAYER_HEIGHT,
    speed: PLAYER_SPEED,
    shootCooldownMs: 0,
    invulnerableUntilMs: 0
  };
}

export function createFormation(arena: Arena, wave: number): Formation {
  return {
    direction: 1,
    speed: getFormationStartSpeed(wave),
    descendStep: INVADER_DESCEND_STEP,
    leftBound: arena.padding,
    rightBound: arena.width - arena.padding
  };
}

export function createInvaders(arena: Arena, wave: number): Invader[] {
  const invaders: Invader[] = [];
  const totalWidth =
    INVADER_COLS * INVADER_WIDTH + (INVADER_COLS - 1) * INVADER_GAP_X;
  const startX = (arena.width - totalWidth) / 2;
  const startY = INVADER_START_Y + Math.min(wave - 1, 4) * 8;
  let id = 1;

  for (let row = 0; row < INVADER_ROWS; row += 1) {
    for (let col = 0; col < INVADER_COLS; col += 1) {
      invaders.push({
        id,
        row,
        col,
        x: startX + col * (INVADER_WIDTH + INVADER_GAP_X),
        y: startY + row * (INVADER_HEIGHT + INVADER_GAP_Y),
        width: INVADER_WIDTH,
        height: INVADER_HEIGHT,
        points: ROW_POINTS[row] ?? 10
      });
      id += 1;
    }
  }

  return invaders;
}

export function createShields(arena: Arena): Shield[] {
  const shieldWidth = SHIELD_CELL_COLS * SHIELD_CELL_WIDTH;
  const shieldHeight = SHIELD_CELL_ROWS * SHIELD_CELL_HEIGHT;
  const availableWidth = arena.width - arena.padding * 2;
  const gapX = Math.max(
    0,
    (availableWidth - SHIELD_COUNT * shieldWidth) / (SHIELD_COUNT + 1)
  );
  const invaderBottom =
    INVADER_START_Y +
    INVADER_ROWS * INVADER_HEIGHT +
    (INVADER_ROWS - 1) * INVADER_GAP_Y;
  const playerTop = arena.floorY - PLAYER_HEIGHT;
  const desiredY =
    invaderBottom + (playerTop - invaderBottom - shieldHeight) / 2;
  const startY = Math.min(
    playerTop - shieldHeight,
    Math.max(invaderBottom, desiredY)
  );

  let cellId = 1;

  return Array.from({ length: SHIELD_COUNT }, (_, shieldIndex) => {
    const startX =
      arena.padding + gapX * (shieldIndex + 1) + shieldWidth * shieldIndex;
    const cells = Array.from(
      { length: SHIELD_CELL_ROWS * SHIELD_CELL_COLS },
      (_, cellIndex) => {
        const row = Math.floor(cellIndex / SHIELD_CELL_COLS);
        const col = cellIndex % SHIELD_CELL_COLS;

        const cell: ShieldCell = {
          id: cellId,
          x: startX + col * SHIELD_CELL_WIDTH,
          y: startY + row * SHIELD_CELL_HEIGHT,
          width: SHIELD_CELL_WIDTH,
          height: SHIELD_CELL_HEIGHT,
          alive: true
        };

        cellId += 1;
        return cell;
      }
    );

    return {
      id: shieldIndex + 1,
      cells
    };
  });
}

export function createPlayerProjectile(
  state: GameState,
  x: number,
  y: number
): Projectile {
  return {
    id: state.nextProjectileId,
    owner: "player",
    x,
    y,
    width: PROJECTILE_WIDTH,
    height: PROJECTILE_HEIGHT,
    velocityY: PROJECTILE_SPEED,
    active: true
  };
}

export function createInvaderProjectile(
  state: GameState,
  invader: Invader
): Projectile {
  return {
    id: state.nextProjectileId,
    owner: "invader",
    x: invader.x + invader.width / 2 - INVADER_PROJECTILE_WIDTH / 2,
    y: invader.y + invader.height,
    width: INVADER_PROJECTILE_WIDTH,
    height: INVADER_PROJECTILE_HEIGHT,
    velocityY: INVADER_PROJECTILE_SPEED,
    active: true
  };
}

export function getPlayerMinX(arena: Arena): number {
  return arena.padding;
}

export function getPlayerMaxX(arena: Arena, player: Player): number {
  return arena.width - arena.padding - player.width;
}

function getFormationStartSpeed(wave: number): number {
  return Math.min(
    FORMATION_SPEED_MAX,
    FORMATION_SPEED_BASE *
      (1 + Math.max(0, wave - 1) * FORMATION_SPEED_PER_WAVE)
  );
}

export function getFormationSpeed(
  invaderCount: number,
  waveStartSpeed: number,
  totalInvaders = INVADER_ROWS * INVADER_COLS
): number {
  const clampedTotalInvaders = Math.max(1, totalInvaders);
  const clampedInvaderCount = Math.max(
    0,
    Math.min(invaderCount, clampedTotalInvaders)
  );
  const killedRatio =
    (clampedTotalInvaders - clampedInvaderCount) / clampedTotalInvaders;
  const cappedWaveStartSpeed = Math.min(waveStartSpeed, FORMATION_SPEED_MAX);
  const waveMaxSpeed = Math.min(
    FORMATION_SPEED_MAX,
    cappedWaveStartSpeed * FORMATION_SPEED_KILL_MULTIPLIER
  );

  // Interpolate between the wave's opening pace and its cap as the formation thins out.
  return (
    cappedWaveStartSpeed +
    (waveMaxSpeed - cappedWaveStartSpeed) * killedRatio
  );
}

export function getProjectileSpawnX(player: Player): number {
  return player.x + player.width / 2 - PROJECTILE_WIDTH / 2;
}

export function getProjectileSpawnY(player: Player): number {
  return player.y - PROJECTILE_HEIGHT;
}
