import {
  EMPTY_INPUT,
  LIFE_LOST_DURATION_MS,
  PLAYER_SHOOT_COOLDOWN_MS,
  RESPAWN_INVULNERABILITY_MS,
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
  type Projectile
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
  const remaining = state.transitionTimerMs - dtMs;

  if (remaining > 0) {
    return {
      ...state,
      transitionTimerMs: remaining,
      elapsedMs: state.elapsedMs + dtMs
    };
  }

  const resolvedElapsedMs = state.elapsedMs + state.transitionTimerMs;

  if (state.hud.lives > 0) {
    const respawnedState = createGameState({
      phase: "playing",
      wave: state.hud.wave,
      score: state.hud.score,
      lives: state.hud.lives,
      frame: state.frame + 1,
      nextProjectileId: state.nextProjectileId,
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
    playerShootFrame: 0,
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

  const projectileBundle = maybeSpawnProjectile(
    state,
    movedPlayer,
    input.firePressed,
    playerShootFrame
  );
  const movedProjectiles = moveProjectiles(projectileBundle.projectiles, dtSeconds, state.arena.height);
  const formationBundle = moveInvaders(state, dtSeconds);
  const collisionBundle = resolveProjectileHits(movedProjectiles, formationBundle.invaders);
  const score = state.hud.score + collisionBundle.scoreDelta;
  const marchFrame = formationBundle.didAdvance
    ? toggleMarchFrame(state.marchFrame)
    : state.marchFrame;
  const playerIsInvulnerable =
    movedPlayer.invulnerableUntilMs > nextElapsedMs;

  if (!playerIsInvulnerable && hasInvaderBreached(collisionBundle.invaders, movedPlayer)) {
    return {
      ...state,
      phase: "lifeLost",
      marchFrame,
      playerShootFrame: 0,
      player: {
        ...movedPlayer,
        shootCooldownMs: 0
      },
      projectiles: [],
      invaders: collisionBundle.invaders,
      formation: formationBundle.formation,
      hud: {
        ...state.hud,
        score,
        lives: Math.max(0, state.hud.lives - 1)
      },
      transitionTimerMs: LIFE_LOST_DURATION_MS,
      frame: nextFrame,
      nextProjectileId: projectileBundle.nextProjectileId,
      elapsedMs: nextElapsedMs
    };
  }

  if (collisionBundle.invaders.length === 0) {
    return {
      ...state,
      phase: "waveClear",
      marchFrame,
      playerShootFrame: projectileBundle.playerShootFrame,
      player: {
        ...movedPlayer,
        shootCooldownMs: projectileBundle.playerShootCooldownMs
      },
      projectiles: [],
      invaders: [],
      formation: formationBundle.formation,
      hud: {
        ...state.hud,
        score
      },
      transitionTimerMs: 0,
      frame: nextFrame,
      nextProjectileId: projectileBundle.nextProjectileId,
      elapsedMs: nextElapsedMs
    };
  }

  return {
    ...state,
    marchFrame,
    playerShootFrame: projectileBundle.playerShootFrame,
    player: {
      ...movedPlayer,
      shootCooldownMs: projectileBundle.playerShootCooldownMs
    },
    projectiles: collisionBundle.projectiles,
    invaders: collisionBundle.invaders,
    formation: formationBundle.formation,
    hud: {
      ...state.hud,
      score
    },
    frame: nextFrame,
    transitionTimerMs: 0,
    nextProjectileId: projectileBundle.nextProjectileId,
    elapsedMs: nextElapsedMs
  };
}

function maybeSpawnProjectile(
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

function moveProjectiles(
  projectiles: Projectile[],
  dtSeconds: number,
  arenaHeight: number
): Projectile[] {
  return projectiles
    .map((projectile) => ({
      ...projectile,
      y: projectile.y + projectile.velocityY * dtSeconds
    }))
    .filter(
      (projectile) =>
        projectile.active &&
        projectile.y + projectile.height >= 0 &&
        projectile.y <= arenaHeight
    );
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
      if (consumedProjectileIds.has(projectile.id)) {
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
