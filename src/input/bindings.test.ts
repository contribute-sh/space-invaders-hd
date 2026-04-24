import { describe, expect, it } from "vitest";

import {
  CONTROL_BINDINGS,
  CONTROL_FOOTER,
  OVERLAY_PROMPTS
} from "./bindings";

describe("CONTROL_BINDINGS", () => {
  it("defines non-empty codes and labels for every action", () => {
    for (const binding of Object.values(CONTROL_BINDINGS)) {
      expect(binding.code).not.toHaveLength(0);
      expect(binding.label).not.toHaveLength(0);
    }
  });

  it("uses Enter as the restart binding contract", () => {
    expect(CONTROL_BINDINGS.restart.code).toBe("Enter");
  });
});

describe("OVERLAY_PROMPTS", () => {
  it("exports the expected gameplay prompts", () => {
    expect(OVERLAY_PROMPTS.start).toBe("Press Space to Start");
    expect(OVERLAY_PROMPTS.pause).toBe("Press P to Resume");
    expect(OVERLAY_PROMPTS.waveClear).toBe("Press Space to Continue");
  });

  it("uses Enter for the game-over restart prompt", () => {
    expect(OVERLAY_PROMPTS.gameOver).toContain("Enter");
    expect(OVERLAY_PROMPTS.gameOver).not.toContain("Space");
  });
});

describe("CONTROL_FOOTER", () => {
  it("mentions Enter for restart instructions", () => {
    expect(CONTROL_FOOTER).toContain("Enter");
  });
});
