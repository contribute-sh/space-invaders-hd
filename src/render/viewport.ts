type ViewportWindow = {
  devicePixelRatio?: number;
  innerHeight: number;
  innerWidth: number;
};

type ViewportCanvas = {
  clientHeight: number;
  clientWidth: number;
};

type ViewportContext = {
  canvas: {
    height: number;
    width: number;
  };
  setTransform: (
    a: number,
    b: number,
    c: number,
    d: number,
    e: number,
    f: number
  ) => void;
};

export type Viewport = {
  backingHeight: number;
  backingWidth: number;
  cssHeight: number;
  cssWidth: number;
  offsetX: number;
  offsetY: number;
  scale: number;
};

export function computeViewport(
  window: ViewportWindow,
  canvas: ViewportCanvas,
  logicalW: number,
  logicalH: number
): Viewport {
  const dpr = window.devicePixelRatio ?? 1;
  const hasCanvasSize = canvas.clientWidth > 0 && canvas.clientHeight > 0;
  const cssWidth = Math.round(hasCanvasSize ? canvas.clientWidth : window.innerWidth);
  const cssHeight = Math.round(hasCanvasSize ? canvas.clientHeight : window.innerHeight);
  const scale = Math.min(cssWidth / logicalW, cssHeight / logicalH);
  const offsetX = (cssWidth - scale * logicalW) / 2;
  const offsetY = (cssHeight - scale * logicalH) / 2;

  return {
    cssWidth,
    cssHeight,
    backingWidth: Math.round(cssWidth * dpr),
    backingHeight: Math.round(cssHeight * dpr),
    scale,
    offsetX,
    offsetY
  };
}

export function applyViewport(
  context: ViewportContext,
  viewport: Viewport
): void {
  const dpr =
    viewport.cssWidth === 0 ? 1 : viewport.backingWidth / viewport.cssWidth;

  context.canvas.width = viewport.backingWidth;
  context.canvas.height = viewport.backingHeight;
  context.setTransform(
    viewport.scale * dpr,
    0,
    0,
    viewport.scale * dpr,
    viewport.offsetX * dpr,
    viewport.offsetY * dpr
  );
}
