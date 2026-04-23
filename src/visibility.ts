type VisibilityPauseControllerOptions = {
  target: Pick<Document, "addEventListener" | "removeEventListener">;
  isHidden: () => boolean;
  onHide: () => void;
};

type VisibilityPauseController = {
  dispose: () => void;
};

export function createVisibilityPauseController({
  target,
  isHidden,
  onHide
}: VisibilityPauseControllerOptions): VisibilityPauseController {
  const handleVisibilityChange = (): void => {
    if (isHidden()) {
      onHide();
    }
  };

  target.addEventListener("visibilitychange", handleVisibilityChange);

  return {
    dispose: () => {
      target.removeEventListener("visibilitychange", handleVisibilityChange);
    }
  };
}
