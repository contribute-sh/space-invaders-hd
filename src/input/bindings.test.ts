import { describe, expect, it } from "vitest";

import { CONTROL_BINDINGS, CONTROL_FOOTER, OVERLAY_PROMPTS } from "./bindings";

describe("CONTROL_BINDINGS", () => {
  it("defines a non-empty code and label for every action", () => {
    for (const binding of Object.values(CONTROL_BINDINGS)) {
      expect(binding.code).not.toHaveLength(0);
      expect(binding.label).not.toHaveLength(0);
    }
  });

  it("maps restart to Enter", () => {
    expect(CONTROL_BINDINGS.restart.code).toBe("Enter");
  });
});

describe("OVERLAY_PROMPTS", () => {
  it("uses Enter instead of Space for the game-over prompt", () => {
    expect(OVERLAY_PROMPTS.gameOver).toContain("Enter");
    expect(OVERLAY_PROMPTS.gameOver).not.toContain("Space");
  });
});

describe("CONTROL_FOOTER", () => {
  it("mentions Enter for restarting", () => {
    expect(CONTROL_FOOTER).toContain("Enter");
  });
});
