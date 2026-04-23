import {
  EMPTY_INPUT,
  INVADER_FIRE_INTERVAL_MS,
  LIFE_LOST_DURATION_MS,
  PLAYER_SHOOT_COOLDOWN_MS,
  RESPAWN_INVULNERABILITY_MS,
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

export function step(state: GameState, dtMs: number, input: Input = EMPTY_INPUT): GameState {
  const dt = Math.max(0, dtMs);

  switch (state.phase) {
    case "start":
      return input.firePressed
        ? createGameState({ phase: "playing" })
        : advanceFrame(state);
    case "waveClear":
      return input.firePressed
        ? createGameState({
            phase: "playing",
            wave: state.hud.wave + 1,
            score: state.hud.score,
            lives: state.hud.lives,
            elapsedMs: state.elapsedMs
          })
        : advanceFrame(state);
    case "gameOver":
      return input.firePressed
        ? createGameState({ phase: "playing" })
        : advanceFrame(state);
    case "paused":
      return input.pausePressed
        ? {
            ...state,
            phase: "playing"
          }
        : state;
    case "lifeLost":
      return advanceLifeLost(state, dt);
    case "playing":
      return advancePlaying(state, dt, input);
  }
}

function advanceFrame(state: GameState): GameState {
  return {
    ...state,
    frame: state.frame + 1
  };
}

function advanceLifeLost(state: GameState, dtMs: number): GameState {
  const appliedDtMs = Math.min(dtMs, state.transitionTimerMs);
  const remaining = state.transitionTimerMs - dtMs;
  const projectileShieldBundle = moveProjectilesThroughShields(
    state.projectiles,
    appliedDtMs / 1000,
    state.arena.floorY,
    state.shields
  );
  const invaderFireCooldownMs = Math.max(
    0,
    state.invaderFireCooldownMs - appliedDtMs
  );

  if (remaining > 0) {
    return {
      ...state,
      projectiles: projectileShieldBundle.projectiles,
      shields: projectileShieldBundle.shields,
      invaderFireCooldownMs,
      transitionTimerMs: remaining,
      elapsedMs: state.elapsedMs + appliedDtMs
    };
  }

  const resolvedElapsedMs = state.elapsedMs + appliedDtMs;

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

function advancePlaying(state: GameState, dtMs: number, input: Input): GameState {
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
  const invaderFireCooldownMs = Math.max(0, state.invaderFireCooldownMs - dtMs);
  const playerShootFrame = Math.max(0, state.playerShootFrame - dtMs);
  const movedPlayer = {
    ...state.player,
    x: clamp(
      state.player.x + input.moveX * state.player.speed * dtSeconds,
      getPlayerMinX(state.arena),
      getPlayerMaxX(state.arena, state.player)
    ),
    shootCooldownMs: cooldown
  };

  const playerProjectileBundle = maybeSpawnPlayerProjectile(
    state,
    movedPlayer,
    input.firePressed,
    playerShootFrame
  );
  const projectileShieldBundle = moveProjectilesThroughShields(
    playerProjectileBundle.projectiles,
    dtSeconds,
    state.arena.floorY,
    state.shields
  );
  const formationBundle = moveInvaders(state, dtSeconds);
  const collisionBundle = resolveProjectileHits(
    projectileShieldBundle.projectiles,
    formationBundle.invaders
  );
  const score = state.hud.score + collisionBundle.scoreDelta;
  const marchFrame = formationBundle.didAdvance
    ? toggleMarchFrame(state.marchFrame)
    : state.marchFrame;
  const playerIsInvulnerable =
    movedPlayer.invulnerableUntilMs > nextElapsedMs;
  const hitProjectile = playerIsInvulnerable
    ? undefined
    : collisionBundle.projectiles.find(
        (projectile) =>
          projectile.owner === "invader" &&
          intersects(projectile, movedPlayer)
      );
  const survivingProjectiles =
    hitProjectile === undefined
      ? collisionBundle.projectiles
      : collisionBundle.projectiles.filter(
          (projectile) => projectile.id !== hitProjectile.id
        );

  if (
    !playerIsInvulnerable &&
    (hitProjectile !== undefined ||
      hasInvaderBreached(collisionBundle.invaders, movedPlayer))
  ) {
    return {
      ...state,
      phase: "lifeLost",
      marchFrame,
      playerShootFrame: 0,
      player: {
        ...movedPlayer,
        shootCooldownMs: 0
      },
      projectiles: hitProjectile === undefined
        ? []
        : survivingProjectiles.filter(
            (projectile) => projectile.owner === "invader"
          ),
      shields: projectileShieldBundle.shields,
      invaders: collisionBundle.invaders,
      formation: formationBundle.formation,
      hud: {
        ...state.hud,
        score,
        lives: Math.max(0, state.hud.lives - 1)
      },
      transitionTimerMs: LIFE_LOST_DURATION_MS,
      frame: nextFrame,
      nextProjectileId: playerProjectileBundle.nextProjectileId,
      invaderFireCooldownMs,
      elapsedMs: nextElapsedMs
    };
  }

  if (collisionBundle.invaders.length === 0) {
    return {
      ...state,
      phase: "waveClear",
      marchFrame,
      playerShootFrame: playerProjectileBundle.playerShootFrame,
      player: {
        ...movedPlayer,
        shootCooldownMs: playerProjectileBundle.playerShootCooldownMs
      },
      projectiles: [],
      shields: projectileShieldBundle.shields,
      invaders: [],
      formation: formationBundle.formation,
      hud: {
        ...state.hud,
        score
      },
      transitionTimerMs: 0,
      frame: nextFrame,
      nextProjectileId: playerProjectileBundle.nextProjectileId,
      invaderFireCooldownMs,
      elapsedMs: nextElapsedMs
    };
  }

  const invaderProjectileBundle = maybeSpawnInvaderProjectile(
    {
      ...state,
      nextProjectileId: playerProjectileBundle.nextProjectileId
    },
    survivingProjectiles,
    invaderFireCooldownMs
  );

  return {
    ...state,
    marchFrame,
    playerShootFrame: playerProjectileBundle.playerShootFrame,
    player: {
      ...movedPlayer,
      shootCooldownMs: playerProjectileBundle.playerShootCooldownMs
    },
    projectiles: invaderProjectileBundle.projectiles,
    shields: projectileShieldBundle.shields,
    invaders: collisionBundle.invaders,
    formation: formationBundle.formation,
    hud: {
      ...state.hud,
      score
    },
    frame: nextFrame,
    transitionTimerMs: 0,
    nextProjectileId: invaderProjectileBundle.nextProjectileId,
    invaderFireCooldownMs: invaderProjectileBundle.invaderFireCooldownMs,
    elapsedMs: nextElapsedMs
  };
}

function maybeSpawnPlayerProjectile(
  state: GameState,
  player: GameState["player"],
  firePressed: boolean,
  playerShootFrame: number
): {
  nextProjectileId: number;
  playerShootCooldownMs: number;
  playerShootFrame: number;
  projectiles: Projectile[];
} {
  if (!firePressed || player.shootCooldownMs > 0) {
    return {
      nextProjectileId: state.nextProjectileId,
      playerShootCooldownMs: player.shootCooldownMs,
      playerShootFrame,
      projectiles: state.projectiles
    };
  }

  const projectile = createPlayerProjectile(
    state,
    getProjectileSpawnX(player),
    getProjectileSpawnY(player)
  );

  return {
    nextProjectileId: state.nextProjectileId + 1,
    playerShootCooldownMs: PLAYER_SHOOT_COOLDOWN_MS,
    playerShootFrame: PLAYER_SHOOT_FRAME_DURATION_MS,
    projectiles: [...state.projectiles, projectile]
  };
}

function maybeSpawnInvaderProjectile(
  state: GameState,
  projectiles: Projectile[],
  invaderFireCooldownMs: number
): {
  invaderFireCooldownMs: number;
  nextProjectileId: number;
  projectiles: Projectile[];
} {
  const idleBundle = {
    invaderFireCooldownMs,
    nextProjectileId: state.nextProjectileId,
    projectiles
  };

  if (invaderFireCooldownMs > 0) {
    return idleBundle;
  }

  const firingTarget = getFiringInvader(state.invaders);

  if (firingTarget === undefined) {
    return idleBundle;
  }

  return {
    invaderFireCooldownMs: INVADER_FIRE_INTERVAL_MS,
    nextProjectileId: state.nextProjectileId + 1,
    projectiles: [...projectiles, createInvaderProjectile(state, firingTarget)]
  };
}

function moveProjectilesThroughShields(
  projectiles: Projectile[],
  dtSeconds: number,
  arenaFloorY: number,
  shields: Shield[]
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
  didAdvance: boolean;
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
    didAdvance: dtSeconds > 0 && state.invaders.length > 0,
    formation: {
      ...state.formation,
      direction
    },
    invaders
  };
}

function resolveProjectileHits(
  projectiles: Projectile[],
  invaders: Invader[]
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

function getFiringInvader(invaders: Invader[]): Invader | undefined {
  let firingInvader: Invader | undefined;

  for (const invader of invaders) {
    if (
      firingInvader === undefined ||
      invader.col < firingInvader.col ||
      (invader.col === firingInvader.col &&
        (invader.y > firingInvader.y ||
          (invader.y === firingInvader.y &&
            invader.row > firingInvader.row)))
    ) {
      firingInvader = invader;
    }
  }

  return firingInvader;
}

function findShieldCollision(
  projectile: Projectile,
  movedProjectile: Projectile,
  shields: Shield[]
):
  | {
      shieldId: number;
      cellId: number;
    }
  | undefined {
  const path = getProjectilePath(projectile, movedProjectile);
  const movingDown = movedProjectile.velocityY > 0;
  let collision:
    | {
        shieldId: number;
        cellId: number;
        edge: number;
      }
    | undefined;

  for (const shield of shields) {
    for (const cell of shield.cells) {
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
          cellId: cell.id,
          edge
        };
      }
    }
  }

  return collision === undefined
    ? undefined
    : { shieldId: collision.shieldId, cellId: collision.cellId };
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
