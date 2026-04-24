import {
  EMPTY_INPUT,
  FORMATION_SPEED_BASE,
  INVADER_FIRE_INTERVAL_MS,
  LIFE_LOST_DURATION_MS,
  MARCH_FRAME_INTERVAL_MS,
  PLAYER_SHOOT_COOLDOWN_MS,
  RESPAWN_INVULNERABILITY_MS,
  SHIELD_CELL_COLS,
  createInvaderProjectile,
  createGameState,
  createPlayerProjectile,
  getFormationSpeed,
  getPlayerMaxX,
  getPlayerMinX,
  getProjectileSpawnX,
  getProjectileSpawnY,
  type GameState,
  type Input,
  type Invader,
  type Projectile,
  type Shield
} from "./state";

type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const PLAYER_SHOOT_FRAME_DURATION_MS = 120;

export type StepEvent =
  | {
      type: "playerShot";
    }
  | {
      type: "invaderHit";
      invaderId: number;
      points: number;
    }
  | {
      type: "shieldHit";
      shieldIndex: number;
      row: number;
      col: number;
    }
  | {
      type: "lifeLost";
    }
  | {
      type: "waveClear";
    };

export type StepResult = GameState & {
  state: GameState;
  events: StepEvent[];
};

export function step(
  inputState: GameState | StepResult,
  dtMs: number,
  input: Input = EMPTY_INPUT
): StepResult {
  const state = isStepResult(inputState) ? inputState.state : inputState;
  const dt = Math.max(0, dtMs);
  const events: StepEvent[] = [];

  switch (state.phase) {
    case "start":
      return createStepResult(
        input.firePressed
          ? createGameState({ phase: "playing" })
          : advanceFrame(state)
      );
    case "waveClear":
      return createStepResult(
        input.firePressed
          ? createGameState({
              phase: "playing",
              wave: state.hud.wave + 1,
              score: state.hud.score,
              lives: state.hud.lives,
              elapsedMs: state.elapsedMs
            })
          : advanceFrame(state)
      );
    case "gameOver":
      return createStepResult(
        input.firePressed
          ? createGameState({ phase: "playing" })
          : advanceFrame(state)
      );
    case "paused":
      return createStepResult(
        input.pausePressed
          ? {
              ...state,
              phase: "playing"
            }
          : state
      );
    case "lifeLost":
      return createStepResult(advanceLifeLost(state, dt, events), events);
    case "playing":
      return createStepResult(advancePlaying(state, dt, input, events), events);
  }
}

function advanceFrame(state: GameState): GameState {
  return {
    ...state,
    frame: state.frame + 1
  };
}

function advanceLifeLost(
  state: GameState,
  dtMs: number,
  events: StepEvent[]
): GameState {
  const simulatedDtMs = Math.min(dtMs, state.transitionTimerMs);
  const projectileShieldBundle = moveProjectilesThroughShields(
    state.projectiles,
    simulatedDtMs / 1000,
    state.arena.floorY,
    state.shields,
    events
  );
  const invaderFireCooldownMs = Math.max(
    0,
    state.invaderFireCooldownMs - simulatedDtMs
  );
  const remaining = state.transitionTimerMs - dtMs;

  if (remaining > 0) {
    return {
      ...state,
      projectiles: projectileShieldBundle.projectiles,
      shields: projectileShieldBundle.shields,
      invaderFireCooldownMs,
      transitionTimerMs: remaining,
      elapsedMs: state.elapsedMs + simulatedDtMs
    };
  }

  const resolvedElapsedMs = state.elapsedMs + simulatedDtMs;

  if (state.hud.lives > 0) {
    const respawnedState = createGameState({
      phase: "playing",
      wave: state.hud.wave,
      score: state.hud.score,
      lives: state.hud.lives,
      frame: state.frame + 1,
      nextProjectileId: state.nextProjectileId,
      invaderFireCooldownMs,
      elapsedMs: resolvedElapsedMs
    });

    return {
      ...respawnedState,
      shields: projectileShieldBundle.shields,
      player: {
        ...respawnedState.player,
        invulnerableUntilMs:
          resolvedElapsedMs + RESPAWN_INVULNERABILITY_MS
      }
    };
  }

  return {
    ...state,
    phase: "gameOver",
    projectiles: [],
    shields: projectileShieldBundle.shields,
    playerShootFrame: 0,
    invaderFireCooldownMs,
    transitionTimerMs: 0,
    player: {
      ...state.player,
      shootCooldownMs: 0
    },
    frame: state.frame + 1,
    elapsedMs: resolvedElapsedMs
  };
}

function advancePlaying(
  state: GameState,
  dtMs: number,
  input: Input,
  events: StepEvent[]
): GameState {
  if (input.pausePressed) {
    return {
      ...state,
      phase: "paused"
    };
  }

  const dtSeconds = dtMs / 1000;
  const nextFrame = state.frame + 1;
  const nextElapsedMs = state.elapsedMs + dtMs;
  const cooldown = Math.max(0, state.player.shootCooldownMs - dtMs);
  const playerShootFrame = Math.max(0, state.playerShootFrame - dtMs);
  const invaderFireCooldownMs = Math.max(
    0,
    state.invaderFireCooldownMs - dtMs
  );
  const movedPlayer = {
    ...state.player,
    x: clamp(
      state.player.x + input.moveX * state.player.speed * dtSeconds,
      getPlayerMinX(state.arena),
      getPlayerMaxX(state.arena, state.player)
    ),
    shootCooldownMs: cooldown
  };

  const projectileBundle = maybeSpawnProjectiles(
    state,
    movedPlayer,
    input.firePressed,
    playerShootFrame,
    invaderFireCooldownMs,
    events
  );
  const projectileShieldBundle = moveProjectilesThroughShields(
    projectileBundle.projectiles,
    dtSeconds,
    state.arena.floorY,
    state.shields,
    events
  );
  const formationBundle = moveInvaders(state, dtSeconds);
  const marchAnimation = advanceMarchAnimation(state, dtMs);
  const collisionBundle = resolveProjectileHits(
    projectileShieldBundle.projectiles,
    formationBundle.invaders,
    events
  );
  const score = state.hud.score + collisionBundle.scoreDelta;
  const playerIsInvulnerable =
    movedPlayer.invulnerableUntilMs > nextElapsedMs;
  const playerHitProjectile = playerIsInvulnerable
    ? undefined
    : collisionBundle.projectiles.find(
        (projectile) =>
          projectile.owner === "invader" && intersects(projectile, movedPlayer)
      );
  const remainingProjectiles =
    playerHitProjectile === undefined
      ? collisionBundle.projectiles
      : collisionBundle.projectiles.filter(
          (projectile) => projectile.id !== playerHitProjectile.id
        );

  if (
    !playerIsInvulnerable &&
    (playerHitProjectile !== undefined ||
      hasInvaderBreached(collisionBundle.invaders, movedPlayer))
  ) {
    events.push({ type: "lifeLost" });
    return {
      ...state,
      phase: "lifeLost",
      marchAnimTimerMs: marchAnimation.marchAnimTimerMs,
      marchFrame: marchAnimation.marchFrame,
      playerShootFrame: 0,
      player: {
        ...movedPlayer,
        shootCooldownMs: 0
      },
      projectiles: remainingProjectiles,
      shields: projectileShieldBundle.shields,
      invaders: collisionBundle.invaders,
      formation: formationBundle.formation,
      hud: {
        ...state.hud,
        score,
        lives: Math.max(0, state.hud.lives - 1)
      },
      invaderFireCooldownMs: projectileBundle.invaderFireCooldownMs,
      transitionTimerMs: LIFE_LOST_DURATION_MS,
      frame: nextFrame,
      nextProjectileId: projectileBundle.nextProjectileId,
      elapsedMs: nextElapsedMs
    };
  }

  if (collisionBundle.invaders.length === 0) {
    events.push({ type: "waveClear" });
    return {
      ...state,
      phase: "waveClear",
      marchAnimTimerMs: marchAnimation.marchAnimTimerMs,
      marchFrame: marchAnimation.marchFrame,
      playerShootFrame: projectileBundle.playerShootFrame,
      player: {
        ...movedPlayer,
        shootCooldownMs: projectileBundle.playerShootCooldownMs
      },
      projectiles: [],
      shields: projectileShieldBundle.shields,
      invaders: [],
      formation: formationBundle.formation,
      hud: {
        ...state.hud,
        score
      },
      invaderFireCooldownMs: projectileBundle.invaderFireCooldownMs,
      transitionTimerMs: 0,
      frame: nextFrame,
      nextProjectileId: projectileBundle.nextProjectileId,
      elapsedMs: nextElapsedMs
    };
  }

  return {
    ...state,
    marchAnimTimerMs: marchAnimation.marchAnimTimerMs,
    marchFrame: marchAnimation.marchFrame,
    playerShootFrame: projectileBundle.playerShootFrame,
    player: {
      ...movedPlayer,
      shootCooldownMs: projectileBundle.playerShootCooldownMs
    },
    projectiles: collisionBundle.projectiles,
    shields: projectileShieldBundle.shields,
    invaders: collisionBundle.invaders,
    formation: formationBundle.formation,
    hud: {
      ...state.hud,
      score
    },
    frame: nextFrame,
    invaderFireCooldownMs: projectileBundle.invaderFireCooldownMs,
    transitionTimerMs: 0,
    nextProjectileId: projectileBundle.nextProjectileId,
    elapsedMs: nextElapsedMs
  };
}

function maybeSpawnProjectiles(
  state: GameState,
  player: GameState["player"],
  firePressed: boolean,
  playerShootFrame: number,
  invaderFireCooldownMs: number,
  events: StepEvent[]
): {
  nextProjectileId: number;
  invaderFireCooldownMs: number;
  playerShootCooldownMs: number;
  playerShootFrame: number;
  projectiles: Projectile[];
} {
  let nextProjectileId = state.nextProjectileId;
  let nextPlayerShootCooldownMs = player.shootCooldownMs;
  let nextPlayerShootFrame = playerShootFrame;
  let nextProjectiles = state.projectiles;
  let nextInvaderFireCooldownMs = invaderFireCooldownMs;
  let firingInvader: Invader | undefined;

  if (firePressed && player.shootCooldownMs <= 0) {
    const playerProjectile = createPlayerProjectile(
      {
        ...state,
        nextProjectileId
      },
      getProjectileSpawnX(player),
      getProjectileSpawnY(player)
    );

    nextProjectiles = [...nextProjectiles, playerProjectile];
    nextProjectileId += 1;
    nextPlayerShootCooldownMs = PLAYER_SHOOT_COOLDOWN_MS;
    nextPlayerShootFrame = PLAYER_SHOOT_FRAME_DURATION_MS;
    events.push({ type: "playerShot" });
  }

  if (nextInvaderFireCooldownMs <= 0) {
    for (const invader of state.invaders) {
      if (
        firingInvader === undefined ||
        invader.col < firingInvader.col ||
        (invader.col === firingInvader.col && invader.row > firingInvader.row)
      ) {
        firingInvader = invader;
      }
    }

    if (firingInvader !== undefined) {
      const invaderProjectile = createInvaderProjectile(
        {
          ...state,
          nextProjectileId
        },
        firingInvader
      );

      nextProjectiles = [...nextProjectiles, invaderProjectile];
      nextProjectileId += 1;
      nextInvaderFireCooldownMs = INVADER_FIRE_INTERVAL_MS;
    }
  }

  return {
    nextProjectileId,
    invaderFireCooldownMs: nextInvaderFireCooldownMs,
    playerShootCooldownMs: nextPlayerShootCooldownMs,
    playerShootFrame: nextPlayerShootFrame,
    projectiles: nextProjectiles
  };
}

function moveProjectilesThroughShields(
  projectiles: Projectile[],
  dtSeconds: number,
  arenaFloorY: number,
  shields: Shield[],
  events: StepEvent[]
): {
  projectiles: Projectile[];
  shields: Shield[];
} {
  let nextShields = shields;
  const nextProjectiles: Projectile[] = [];

  for (const projectile of projectiles) {
    const movedProjectile = {
      ...projectile,
      y: projectile.y + projectile.velocityY * dtSeconds
    };
    const collision = findShieldCollision(projectile, movedProjectile, nextShields);

    if (collision !== undefined) {
      nextShields = nextShields.map((shield) =>
        shield.id !== collision.shieldId
          ? shield
          : {
              ...shield,
              cells: shield.cells.map((cell) =>
                cell.id !== collision.cellId
                  ? cell
                  : {
                      ...cell,
                      alive: false
                    }
              )
            }
      );
      events.push({
        type: "shieldHit",
        shieldIndex: collision.shieldIndex,
        row: collision.row,
        col: collision.col
      });
      continue;
    }

    if (
      movedProjectile.active &&
      movedProjectile.y >= 0 &&
      movedProjectile.y <= arenaFloorY
    ) {
      nextProjectiles.push(movedProjectile);
    }
  }

  return {
    projectiles: nextProjectiles,
    shields: nextShields
  };
}

function moveInvaders(
  state: GameState,
  dtSeconds: number
): {
  formation: GameState["formation"];
  invaders: Invader[];
} {
  const stepX =
    getFormationSpeed(state.invaders.length, state.formation.speed) *
    dtSeconds *
    state.formation.direction;

  let invaders = state.invaders.map((invader) => ({
    ...invader,
    x: invader.x + stepX
  }));
  let direction = state.formation.direction;

  let overshoot = 0;
  for (const invader of invaders) {
    if (invader.x < state.formation.leftBound) {
      overshoot = Math.max(overshoot, state.formation.leftBound - invader.x);
    }
    const rightEdge = invader.x + invader.width;
    if (rightEdge > state.formation.rightBound) {
      overshoot = Math.max(overshoot, rightEdge - state.formation.rightBound);
    }
  }

  if (overshoot > 0) {
    const correction = direction === 1 ? -overshoot : overshoot;
    invaders = invaders.map((invader) => ({
      ...invader,
      x: invader.x + correction,
      y: invader.y + state.formation.descendStep
    }));
    direction = direction === 1 ? -1 : 1;
  }

  return {
    formation: {
      ...state.formation,
      direction
    },
    invaders
  };
}

function advanceMarchAnimation(
  state: GameState,
  dtMs: number
): {
  marchAnimTimerMs: number;
  marchFrame: GameState["marchFrame"];
} {
  if (dtMs <= 0 || state.invaders.length === 0) {
    return {
      marchAnimTimerMs: state.marchAnimTimerMs,
      marchFrame: state.marchFrame
    };
  }

  const intervalMs = getMarchFrameIntervalMs(
    state.invaders.length,
    state.formation.speed
  );
  let marchAnimTimerMs = state.marchAnimTimerMs + dtMs;
  let marchFrame = state.marchFrame;

  while (marchAnimTimerMs >= intervalMs) {
    marchAnimTimerMs -= intervalMs;
    marchFrame = toggleMarchFrame(marchFrame);
  }

  return {
    marchAnimTimerMs,
    marchFrame
  };
}

function getMarchFrameIntervalMs(
  invaderCount: number,
  waveStartSpeed: number
): number {
  const currentSpeed = getFormationSpeed(invaderCount, waveStartSpeed);

  // Keep the sprite flip cadence proportional to the formation's live speed.
  return MARCH_FRAME_INTERVAL_MS * (FORMATION_SPEED_BASE / currentSpeed);
}

function resolveProjectileHits(
  projectiles: Projectile[],
  invaders: Invader[],
  events: StepEvent[]
): {
  invaders: Invader[];
  projectiles: Projectile[];
  scoreDelta: number;
} {
  const consumedProjectileIds = new Set<number>();
  const remainingInvaders: Invader[] = [];
  let scoreDelta = 0;

  for (const invader of invaders) {
    let hit = false;
    for (const projectile of projectiles) {
      if (
        projectile.owner !== "player" ||
        consumedProjectileIds.has(projectile.id)
      ) {
        continue;
      }
      if (intersects(invader, projectile)) {
        consumedProjectileIds.add(projectile.id);
        scoreDelta += invader.points;
        events.push({
          type: "invaderHit",
          invaderId: invader.id,
          points: invader.points
        });
        hit = true;
        break;
      }
    }
    if (!hit) {
      remainingInvaders.push(invader);
    }
  }

  return {
    invaders: remainingInvaders,
    projectiles: projectiles.filter(
      (projectile) => !consumedProjectileIds.has(projectile.id)
    ),
    scoreDelta
  };
}

function findShieldCollision(
  projectile: Projectile,
  movedProjectile: Projectile,
  shields: Shield[]
):
  | {
      shieldId: number;
      shieldIndex: number;
      cellId: number;
      row: number;
      col: number;
    }
  | undefined {
  const path = getProjectilePath(projectile, movedProjectile);
  const movingDown = movedProjectile.velocityY > 0;
  let collision:
    | {
        shieldId: number;
        shieldIndex: number;
        cellId: number;
        row: number;
        col: number;
        edge: number;
      }
    | undefined;

  for (const [shieldIndex, shield] of shields.entries()) {
    for (const [cellIndex, cell] of shield.cells.entries()) {
      if (!cell.alive || !intersects(cell, path)) {
        continue;
      }

      const edge = movingDown ? cell.y : cell.y + cell.height;
      if (
        collision === undefined ||
        (movingDown ? edge < collision.edge : edge > collision.edge) ||
        (edge === collision.edge && cell.id < collision.cellId)
      ) {
        collision = {
          shieldId: shield.id,
          shieldIndex,
          cellId: cell.id,
          row: Math.floor(cellIndex / SHIELD_CELL_COLS),
          col: cellIndex % SHIELD_CELL_COLS,
          edge
        };
      }
    }
  }

  return collision === undefined
    ? undefined
    : {
        shieldId: collision.shieldId,
        shieldIndex: collision.shieldIndex,
        cellId: collision.cellId,
        row: collision.row,
        col: collision.col
      };
}

function getProjectilePath(
  projectile: Projectile,
  movedProjectile: Projectile
): Rect {
  const left = Math.min(projectile.x, movedProjectile.x);
  const right = Math.max(
    projectile.x + projectile.width,
    movedProjectile.x + movedProjectile.width
  );
  const top = Math.min(projectile.y, movedProjectile.y);
  const bottom = Math.max(
    projectile.y + projectile.height,
    movedProjectile.y + movedProjectile.height
  );

  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top
  };
}

function hasInvaderBreached(invaders: Invader[], player: GameState["player"]): boolean {
  for (const invader of invaders) {
    const invaderBottom = invader.y + invader.height;
    if (invaderBottom >= player.y || intersects(invader, player)) {
      return true;
    }
  }

  return false;
}

function intersects(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function toggleMarchFrame(marchFrame: GameState["marchFrame"]): GameState["marchFrame"] {
  return marchFrame === 0 ? 1 : 0;
}

function createStepResult(
  state: GameState,
  events: StepEvent[] = []
): StepResult {
  return {
    ...state,
    state,
    events
  };
}

function isStepResult(state: GameState | StepResult): state is StepResult {
  return "state" in state && "events" in state;
}
