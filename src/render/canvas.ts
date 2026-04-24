import type { AudioStatus } from "../audio/sfx";
import type { GameState, Invader, Projectile, Shield } from "../game/state";
import { CONTROL_FOOTER, OVERLAY_PROMPTS } from "../input/bindings";
import {
  getSprite,
  type PreparedSprite
} from "./sprites";
import { applyViewport, computeViewport, type Viewport } from "./viewport";

export type RenderFlags = {
  bootstrapping: boolean;
  highScore: number;
  audioStatus: AudioStatus;
};

export type CanvasRenderer = {
  render: (state: GameState, flags: RenderFlags) => void;
};

const HUD_HEIGHT = 68;
const PLAYER_INVULNERABILITY_BLINK_PERIOD_MS = 120;
const PLAYER_INVULNERABILITY_HALO_COLOR = "rgba(123, 229, 255, 0.22)";
const PLAYER_INVULNERABILITY_HALO_MARGIN = 12;
const HUD_MONOSPACE_FONT =
  '600 18px ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace';

export function createCanvasRenderer(canvas: HTMLCanvasElement): CanvasRenderer {
  const context = canvas.getContext("2d");

  if (context === null) {
    throw new Error("Canvas 2D is unavailable.");
  }

  const viewportContext = {
    canvas: {
      height: canvas.height,
      width: canvas.width
    },
    setTransform: context.setTransform.bind(context)
  };

  return {
    render: (state, flags) => {
      const viewport = computeViewport(
        getViewportWindow(canvas, state.arena.width, state.arena.height),
        canvas,
        state.arena.width,
        state.arena.height
      );

      syncCanvasViewport(canvas, viewport);
      clearViewport(context, viewport);
      applyViewport(viewportContext, viewport);
      drawScene(context, state, flags);
    }
  };
}

function getViewportWindow(
  canvas: HTMLCanvasElement,
  logicalWidth: number,
  logicalHeight: number
): Parameters<typeof computeViewport>[0] {
  const fallbackWidth = canvas.clientWidth > 0 ? canvas.clientWidth : logicalWidth;
  const fallbackHeight =
    canvas.clientHeight > 0 ? canvas.clientHeight : logicalHeight;
  const viewportWindow =
    typeof globalThis.window === "undefined" ? undefined : globalThis.window;

  return {
    devicePixelRatio: viewportWindow?.devicePixelRatio,
    innerWidth: viewportWindow?.innerWidth ?? fallbackWidth,
    innerHeight: viewportWindow?.innerHeight ?? fallbackHeight
  };
}

function syncCanvasViewport(
  canvas: HTMLCanvasElement,
  viewport: Viewport
): void {
  if (
    canvas.width !== viewport.backingWidth ||
    canvas.height !== viewport.backingHeight
  ) {
    canvas.width = viewport.backingWidth;
    canvas.height = viewport.backingHeight;
  }

  const cssWidth = `${viewport.cssWidth}px`;
  const cssHeight = `${viewport.cssHeight}px`;

  if (canvas.style.width !== cssWidth) {
    canvas.style.width = cssWidth;
  }

  if (canvas.style.height !== cssHeight) {
    canvas.style.height = cssHeight;
  }
}

function clearViewport(
  context: CanvasRenderingContext2D,
  viewport: Viewport
): void {
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, viewport.backingWidth, viewport.backingHeight);
}

function drawScene(
  context: CanvasRenderingContext2D,
  state: GameState,
  flags: RenderFlags
): void {
  context.clearRect(0, 0, state.arena.width, state.arena.height);
  drawBackground(context, state);
  drawHud(context, state, flags);
  drawInvaders(context, state.invaders, state.marchFrame);
  drawShields(context, state.shields);
  drawProjectiles(context, state.projectiles);
  drawPlayer(context, state);
  drawFloor(context, state);
  drawControlHints(context, state);

  drawMutedBadge(context, state, flags.audioStatus);

  if (flags.bootstrapping) {
    drawOverlay(context, state, "Initializing canvas...", "Preparing the first frame");
    return;
  }

  switch (state.phase) {
    case "start":
      drawOverlay(
        context,
        state,
        "Space Invaders MVP",
        "Arrow keys move  |  Space fires  |  P pauses",
        OVERLAY_PROMPTS.start
      );
      break;
    case "paused":
      drawOverlay(
        context,
        state,
        "Paused",
        "Simulation is frozen",
        OVERLAY_PROMPTS.pause
      );
      break;
    case "waveClear":
      drawOverlay(
        context,
        state,
        "Wave Clear",
        `Score ${padScore(state.hud.score)}  |  Lives ${state.hud.lives}`,
        OVERLAY_PROMPTS.waveClear
      );
      break;
    case "gameOver":
      drawOverlay(
        context,
        state,
        "Game Over",
        `Final Score ${padScore(state.hud.score)}  |  Wave ${state.hud.wave}`,
        OVERLAY_PROMPTS.gameOver
      );
      break;
    case "lifeLost":
      drawOverlay(
        context,
        state,
        "Ship Destroyed",
        `Lives Remaining ${state.hud.lives}`,
        "Hold the line"
      );
      break;
    case "playing":
      break;
  }
}

function drawBackground(
  context: CanvasRenderingContext2D,
  state: GameState
): void {
  const gradient = context.createLinearGradient(0, 0, 0, state.arena.height);
  gradient.addColorStop(0, "#081020");
  gradient.addColorStop(0.55, "#081727");
  gradient.addColorStop(1, "#02050e");
  context.fillStyle = gradient;
  context.fillRect(0, 0, state.arena.width, state.arena.height);

  const glow = context.createRadialGradient(
    state.arena.width / 2,
    96,
    80,
    state.arena.width / 2,
    96,
    420
  );
  glow.addColorStop(0, "rgba(41, 121, 255, 0.26)");
  glow.addColorStop(1, "rgba(41, 121, 255, 0)");
  context.fillStyle = glow;
  context.fillRect(0, 0, state.arena.width, state.arena.height);

  for (let index = 0; index < 80; index += 1) {
    const x = (index * 97) % state.arena.width;
    const speed = 0.18 + (index % 5) * 0.06;
    const y =
      ((index * 53 + state.frame * speed * 10) % (state.arena.height + 40)) -
      20;
    const radius = index % 3 === 0 ? 1.8 : 1.1;
    context.fillStyle = index % 4 === 0 ? "rgba(166, 226, 255, 0.82)" : "rgba(255, 255, 255, 0.56)";
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }

  context.fillStyle = "rgba(255, 255, 255, 0.03)";
  for (let y = 0; y < state.arena.height; y += 8) {
    context.fillRect(0, y, state.arena.width, 1);
  }
}

function drawHud(
  context: CanvasRenderingContext2D,
  state: GameState,
  flags: RenderFlags
): void {
  const hudX = 22;
  const hudY = 18;
  const hudWidth = state.arena.width - 44;
  const hudRight = hudX + hudWidth;

  context.fillStyle = "rgba(8, 14, 30, 0.78)";
  context.fillRect(hudX, hudY, hudWidth, HUD_HEIGHT);

  context.strokeStyle = "rgba(140, 207, 255, 0.26)";
  context.lineWidth = 1.5;
  roundRect(context, hudX, hudY, hudWidth, HUD_HEIGHT, 20);
  context.stroke();

  context.font = HUD_MONOSPACE_FONT;
  context.fillStyle = "#d3f4ff";
  context.fillText(`SCORE ${padHudScore(state.hud.score)}`, hudX + 22, hudY + 42);

  context.textAlign = "center";
  context.fillText(`HIGH ${padHudScore(flags.highScore)}`, state.arena.width / 2, hudY + 26);
  context.fillText(`WAVE ${state.hud.wave}`, state.arena.width / 2, hudY + 42);

  context.textAlign = "right";
  context.fillText("LIVES", hudRight - 22, hudY + 26);
  context.textAlign = "start";

  drawHudLives(context, state, hudRight);
}

function drawInvaders(
  context: CanvasRenderingContext2D,
  invaders: Invader[],
  marchFrame: GameState["marchFrame"]
): void {
  for (const invader of invaders) {
    const sprite = getSprite(`invader-row-${invader.row}`);

    const hue = 190 + invader.row * 18;
    const shadowFill = `hsla(${hue}, 100%, 60%, 0.18)`;

    context.fillStyle = shadowFill;
    roundRect(context, invader.x - 4, invader.y - 4, invader.width + 8, invader.height + 10, 12);
    context.fill();
    drawSpriteInBounds(
      context,
      sprite,
      marchFrame,
      invader.x,
      invader.y,
      invader.width,
      invader.height
    );
  }
}

function drawProjectiles(
  context: CanvasRenderingContext2D,
  projectiles: Projectile[]
): void {
  const playerProjectileSprite = getSprite("player-projectile");
  const invaderProjectileSprite = getSprite("invader-projectile");

  for (const projectile of projectiles) {
    const projectileSprite =
      projectile.owner === "invader"
        ? invaderProjectileSprite
        : playerProjectileSprite;

    context.fillStyle = "rgba(114, 226, 255, 0.25)";
    roundRect(context, projectile.x - 3, projectile.y - 6, projectile.width + 6, projectile.height + 12, 6);
    context.fill();
    drawSpriteInBounds(
      context,
      projectileSprite,
      0,
      projectile.x,
      projectile.y,
      projectile.width,
      projectile.height
    );
  }
}

function drawShields(
  context: CanvasRenderingContext2D,
  shields: Shield[]
): void {
  const shieldCellSprite = getSprite("shield-cell");

  for (const shield of shields) {
    for (const cell of shield.cells) {
      if (!cell.alive) {
        continue;
      }

      drawSpriteInBounds(
        context,
        shieldCellSprite,
        0,
        cell.x,
        cell.y,
        cell.width,
        cell.height
      );
    }
  }
}

function drawPlayer(context: CanvasRenderingContext2D, state: GameState): void {
  const { player } = state;
  const playerIsInvulnerable = state.elapsedMs < player.invulnerableUntilMs;
  const playerSprite = getSprite("player-ship");

  if (playerIsInvulnerable) {
    context.fillStyle = PLAYER_INVULNERABILITY_HALO_COLOR;
    context.fillRect(
      player.x - PLAYER_INVULNERABILITY_HALO_MARGIN,
      player.y - PLAYER_INVULNERABILITY_HALO_MARGIN,
      player.width + PLAYER_INVULNERABILITY_HALO_MARGIN * 2,
      player.height + PLAYER_INVULNERABILITY_HALO_MARGIN * 2
    );

    if (!isInvulnerabilityBlinkVisible(state.elapsedMs, player.invulnerableUntilMs)) {
      return;
    }
  }

  context.fillStyle = "rgba(56, 184, 255, 0.18)";
  context.beginPath();
  context.moveTo(player.x - 16, player.y + player.height + 10);
  context.lineTo(player.x + player.width / 2, player.y - 12);
  context.lineTo(player.x + player.width + 16, player.y + player.height + 10);
  context.closePath();
  context.fill();
  drawSpriteInBounds(
    context,
    playerSprite,
    state.playerShootFrame > 0 ? 1 : 0,
    player.x,
    player.y,
    player.width,
    player.height
  );
}

function drawFloor(context: CanvasRenderingContext2D, state: GameState): void {
  const floorGradient = context.createLinearGradient(
    0,
    state.arena.floorY - 2,
    0,
    state.arena.floorY + 26
  );
  floorGradient.addColorStop(0, "rgba(112, 223, 255, 0.9)");
  floorGradient.addColorStop(1, "rgba(112, 223, 255, 0)");
  context.fillStyle = floorGradient;
  context.fillRect(36, state.arena.floorY - 2, state.arena.width - 72, 28);
}

function drawControlHints(
  context: CanvasRenderingContext2D,
  state: GameState
): void {
  context.font = '500 14px "Arial Narrow", "Avenir Next Condensed", sans-serif';
  context.fillStyle = "rgba(215, 239, 255, 0.64)";
  context.fillText(CONTROL_FOOTER, 44, state.arena.height - 24);
}

function drawMutedBadge(
  context: CanvasRenderingContext2D,
  state: GameState,
  status: AudioStatus
): void {
  if (status === "idle" || status === "ready") {
    return;
  }

  const label = status === "muted" ? "Muted" : "Sound unavailable";
  const width = 168;
  const x = state.arena.width - width - 28;
  const y = 96;

  context.fillStyle = "rgba(121, 44, 44, 0.76)";
  roundRect(context, x, y, width, 34, 17);
  context.fill();

  context.font = '600 14px "Arial Narrow", "Avenir Next Condensed", sans-serif';
  context.fillStyle = "#ffe0e0";
  context.fillText(label, x + 16, y + 22);
}

function drawOverlay(
  context: CanvasRenderingContext2D,
  state: GameState,
  title: string,
  subtitle: string,
  prompt?: string
): void {
  context.fillStyle = "rgba(2, 5, 14, 0.54)";
  context.fillRect(0, 0, state.arena.width, state.arena.height);

  const panelWidth = Math.min(640, state.arena.width - 96);
  const panelHeight = 208;
  const x = (state.arena.width - panelWidth) / 2;
  const y = state.arena.height / 2 - panelHeight / 2 + 16;

  const panelGradient = context.createLinearGradient(x, y, x, y + panelHeight);
  panelGradient.addColorStop(0, "rgba(9, 18, 37, 0.94)");
  panelGradient.addColorStop(1, "rgba(5, 10, 24, 0.92)");
  context.fillStyle = panelGradient;
  roundRect(context, x, y, panelWidth, panelHeight, 28);
  context.fill();

  context.strokeStyle = "rgba(146, 210, 255, 0.32)";
  context.lineWidth = 1.5;
  roundRect(context, x, y, panelWidth, panelHeight, 28);
  context.stroke();

  context.textAlign = "center";
  context.fillStyle = "#f7fbff";
  context.font = '700 34px "Arial Narrow", "Avenir Next Condensed", sans-serif';
  context.fillText(title, state.arena.width / 2, y + 72);

  context.fillStyle = "rgba(205, 231, 255, 0.82)";
  context.font = '500 18px "Arial Narrow", "Avenir Next Condensed", sans-serif';
  context.fillText(subtitle, state.arena.width / 2, y + 112);

  if (prompt !== undefined) {
    context.fillStyle = "#7be5ff";
    context.font = '600 20px "Arial Narrow", "Avenir Next Condensed", sans-serif';
    context.fillText(prompt, state.arena.width / 2, y + 160);
  }

  context.textAlign = "start";
}

function padScore(score: number): string {
  return score.toString().padStart(4, "0");
}

function padHudScore(score: number): string {
  return score.toString().padStart(6, "0");
}

function drawHudLives(
  context: CanvasRenderingContext2D,
  state: GameState,
  hudRight: number
): void {
  const lifeCount = Math.max(0, state.hud.lives);
  const hudPlayerShipSprite = getSprite("hud-player-ship");

  if (lifeCount === 0) {
    return;
  }

  const gap = 10;
  const totalWidth =
    lifeCount * hudPlayerShipSprite.width + (lifeCount - 1) * gap;
  let x = hudRight - 22 - totalWidth;
  const y = 56;

  for (let index = 0; index < lifeCount; index += 1) {
    hudPlayerShipSprite.sheet.drawFrame(context, 0, x, y);
    x += hudPlayerShipSprite.width + gap;
  }
}

function roundRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
}

function drawSpriteInBounds(
  context: CanvasRenderingContext2D,
  sprite: PreparedSprite,
  frameIndex: number,
  x: number,
  y: number,
  width: number,
  height: number
): void {
  sprite.sheet.drawFrame(
    context,
    getFrameIndex(sprite, frameIndex),
    x + (width - sprite.width) / 2,
    y + (height - sprite.height) / 2
  );
}

function getFrameIndex(sprite: PreparedSprite, frameIndex: number): number {
  return Math.max(0, Math.min(frameIndex, sprite.frameCount - 1));
}

function isInvulnerabilityBlinkVisible(
  elapsedMs: number,
  invulnerableUntilMs: number
): boolean {
  const remainingInvulnerabilityMs = Math.max(0, invulnerableUntilMs - elapsedMs);

  return Math.floor(remainingInvulnerabilityMs / PLAYER_INVULNERABILITY_BLINK_PERIOD_MS) % 2 === 0;
}
