import type { GameState, Invader, Projectile } from "../game/state";

export type RenderFlags = {
  bootstrapping: boolean;
  muted: boolean;
};

export type CanvasRenderer = {
  render: (state: GameState, flags: RenderFlags) => void;
};

const HUD_HEIGHT = 68;

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
  drawInvaders(context, state.invaders);
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
  context.fillStyle = "rgba(8, 14, 30, 0.78)";
  context.fillRect(22, 18, state.arena.width - 44, HUD_HEIGHT);

  context.strokeStyle = "rgba(140, 207, 255, 0.26)";
  context.lineWidth = 1.5;
  roundRect(context, 22, 18, state.arena.width - 44, HUD_HEIGHT, 20);
  context.stroke();

  context.font = '600 18px "Arial Narrow", "Avenir Next Condensed", sans-serif';
  context.fillStyle = "#d3f4ff";
  context.fillText(`SCORE ${padScore(state.hud.score)}`, 44, 60);
  context.fillText(`WAVE ${state.hud.wave}`, state.arena.width / 2 - 44, 60);
  context.fillText(`LIVES ${state.hud.lives}`, state.arena.width - 156, 60);
}

function drawInvaders(context: CanvasRenderingContext2D, invaders: Invader[]): void {
  for (const invader of invaders) {
    const hue = 190 + invader.row * 18;
    const bodyFill = `hsla(${hue}, 88%, 62%, 0.92)`;
    const shadowFill = `hsla(${hue}, 100%, 60%, 0.18)`;

    context.fillStyle = shadowFill;
    roundRect(context, invader.x - 4, invader.y - 4, invader.width + 8, invader.height + 10, 12);
    context.fill();

    context.fillStyle = bodyFill;
    roundRect(context, invader.x, invader.y, invader.width, invader.height, 10);
    context.fill();

    context.fillStyle = "rgba(10, 18, 34, 0.8)";
    context.fillRect(invader.x + 10, invader.y + 10, 8, 6);
    context.fillRect(invader.x + invader.width - 18, invader.y + 10, 8, 6);

    context.fillStyle = "rgba(255, 255, 255, 0.86)";
    context.fillRect(invader.x + 8, invader.y + invader.height - 6, 10, 4);
    context.fillRect(invader.x + invader.width - 18, invader.y + invader.height - 6, 10, 4);

    context.strokeStyle = "rgba(255, 255, 255, 0.42)";
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(invader.x + 12, invader.y + invader.height);
    context.lineTo(invader.x + 8, invader.y + invader.height + 6);
    context.moveTo(invader.x + invader.width - 12, invader.y + invader.height);
    context.lineTo(invader.x + invader.width - 8, invader.y + invader.height + 6);
    context.stroke();
  }
}

function drawProjectiles(
  context: CanvasRenderingContext2D,
  projectiles: Projectile[]
): void {
  for (const projectile of projectiles) {
    const gradient = context.createLinearGradient(
      projectile.x,
      projectile.y,
      projectile.x,
      projectile.y + projectile.height
    );
    gradient.addColorStop(0, "#e9fcff");
    gradient.addColorStop(1, "#43d3ff");

    context.fillStyle = "rgba(114, 226, 255, 0.25)";
    roundRect(context, projectile.x - 3, projectile.y - 6, projectile.width + 6, projectile.height + 12, 6);
    context.fill();

    context.fillStyle = gradient;
    roundRect(context, projectile.x, projectile.y, projectile.width, projectile.height, 4);
    context.fill();
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

  const hull = context.createLinearGradient(player.x, player.y, player.x, player.y + player.height);
  hull.addColorStop(0, "#f7fbff");
  hull.addColorStop(0.42, "#96ddff");
  hull.addColorStop(1, "#38b8ff");
  context.fillStyle = hull;
  context.beginPath();
  context.moveTo(player.x, player.y + player.height);
  context.lineTo(player.x + player.width / 2, player.y);
  context.lineTo(player.x + player.width, player.y + player.height);
  context.closePath();
  context.fill();

  context.fillStyle = "#05101e";
  context.beginPath();
  context.moveTo(player.x + 18, player.y + player.height);
  context.lineTo(player.x + player.width / 2, player.y + 10);
  context.lineTo(player.x + player.width - 18, player.y + player.height);
  context.closePath();
  context.fill();

  context.fillStyle = "#9df1ff";
  context.fillRect(player.x + player.width / 2 - 4, player.y + 8, 8, 12);
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
