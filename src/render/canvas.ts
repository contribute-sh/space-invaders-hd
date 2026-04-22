import type { GameState, Invader, Projectile } from "../game/state";
import {
  INVADER_ROW_DESCRIPTORS,
  PLAYER_PROJECTILE_DESCRIPTOR,
  PLAYER_SHIP_DESCRIPTOR,
  createSpriteSheet,
  type SpriteDescriptor,
  type SpriteSheet
} from "./sprites";

export type RenderFlags = {
  bootstrapping: boolean;
  muted: boolean;
};

export type CanvasRenderer = {
  render: (state: GameState, flags: RenderFlags) => void;
};

const HUD_HEIGHT = 68;
const HUD_MONOSPACE_FONT =
  '600 18px ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace';

type PreparedSprite = {
  frameCount: number;
  height: number;
  sheet: SpriteSheet;
  width: number;
};

const PLAYER_SHIP_SPRITE = prepareSprite(PLAYER_SHIP_DESCRIPTOR);
const HUD_PLAYER_SHIP_SPRITE = prepareSprite({
  ...PLAYER_SHIP_DESCRIPTOR,
  id: "hud-player-ship",
  pixelSize: 2
});
const INVADER_ROW_SPRITES = INVADER_ROW_DESCRIPTORS.map(prepareSprite);
const PLAYER_PROJECTILE_SPRITE = prepareSprite(PLAYER_PROJECTILE_DESCRIPTOR);

export function createCanvasRenderer(canvas: HTMLCanvasElement): CanvasRenderer {
  const context = canvas.getContext("2d");

  if (context === null) {
    throw new Error("Canvas 2D is unavailable.");
  }

  return {
    render: (state, flags) => {
      syncCanvasSize(canvas, context, state.arena.width, state.arena.height);
      drawScene(context, state, flags);
    }
  };
}

function syncCanvasSize(
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D,
  logicalWidth: number,
  logicalHeight: number
): void {
  const dpr = window.devicePixelRatio || 1;
  const renderWidth = Math.round(logicalWidth * dpr);
  const renderHeight = Math.round(logicalHeight * dpr);

  if (canvas.width !== renderWidth || canvas.height !== renderHeight) {
    canvas.width = renderWidth;
    canvas.height = renderHeight;
  }

  context.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function drawScene(
  context: CanvasRenderingContext2D,
  state: GameState,
  flags: RenderFlags
): void {
  context.clearRect(0, 0, state.arena.width, state.arena.height);
  drawBackground(context, state);
  drawHud(context, state);
  drawInvaders(context, state.invaders, state.marchFrame);
  drawProjectiles(context, state.projectiles);
  drawPlayer(context, state);
  drawFloor(context, state);
  drawControlHints(context, state);

  if (flags.muted) {
    drawMutedBadge(context, state);
  }

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
        "Press Space to Start"
      );
      break;
    case "paused":
      drawOverlay(
        context,
        state,
        "Paused",
        "Simulation is frozen",
        "Press P to Resume"
      );
      break;
    case "waveClear":
      drawOverlay(
        context,
        state,
        "Wave Clear",
        `Score ${padScore(state.hud.score)}  |  Lives ${state.hud.lives}`,
        "Press Space for Next Wave"
      );
      break;
    case "gameOver":
      drawOverlay(
        context,
        state,
        "Game Over",
        `Final Score ${padScore(state.hud.score)}  |  Wave ${state.hud.wave}`,
        "Press Space to Restart"
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

function drawHud(context: CanvasRenderingContext2D, state: GameState): void {
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
    const sprite = INVADER_ROW_SPRITES[invader.row];

    if (sprite === undefined) {
      continue;
    }

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
  for (const projectile of projectiles) {
    context.fillStyle = "rgba(114, 226, 255, 0.25)";
    roundRect(context, projectile.x - 3, projectile.y - 6, projectile.width + 6, projectile.height + 12, 6);
    context.fill();
    drawSpriteInBounds(
      context,
      PLAYER_PROJECTILE_SPRITE,
      0,
      projectile.x,
      projectile.y,
      projectile.width,
      projectile.height
    );
  }
}

function drawPlayer(context: CanvasRenderingContext2D, state: GameState): void {
  const { player } = state;

  context.fillStyle = "rgba(56, 184, 255, 0.18)";
  context.beginPath();
  context.moveTo(player.x - 16, player.y + player.height + 10);
  context.lineTo(player.x + player.width / 2, player.y - 12);
  context.lineTo(player.x + player.width + 16, player.y + player.height + 10);
  context.closePath();
  context.fill();
  drawSpriteInBounds(
    context,
    PLAYER_SHIP_SPRITE,
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
  context.fillText(
    "Controls: Arrow keys move  |  Space fires / confirms  |  P pauses",
    44,
    state.arena.height - 24
  );
}

function drawMutedBadge(
  context: CanvasRenderingContext2D,
  state: GameState
): void {
  const label = "Sound unavailable";
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

  if (lifeCount === 0) {
    return;
  }

  const gap = 10;
  const totalWidth =
    lifeCount * HUD_PLAYER_SHIP_SPRITE.width + (lifeCount - 1) * gap;
  let x = hudRight - 22 - totalWidth;
  const y = 56;

  for (let index = 0; index < lifeCount; index += 1) {
    HUD_PLAYER_SHIP_SPRITE.sheet.drawFrame(context, 0, x, y);
    x += HUD_PLAYER_SHIP_SPRITE.width + gap;
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

function prepareSprite(descriptor: SpriteDescriptor): PreparedSprite {
  const firstFrame = descriptor.frames[0];
  const firstRow = firstFrame?.[0];

  if (firstFrame === undefined || firstRow === undefined) {
    throw new Error(`Sprite "${descriptor.id}" must include a non-empty frame.`);
  }

  return {
    frameCount: descriptor.frames.length,
    height: firstFrame.length * descriptor.pixelSize,
    sheet: createSpriteSheet(descriptor),
    width: firstRow.length * descriptor.pixelSize
  };
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
