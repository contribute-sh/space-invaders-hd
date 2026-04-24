import { describe, expect, it } from "vitest";

import { CONTROL_BINDINGS, CONTROL_FOOTER, OVERLAY_PROMPTS } from "./bindings";

describe("CONTROL_BINDINGS", () => {
  it("defines non-empty codes and labels for each action", () => {
    for (const binding of Object.values(CONTROL_BINDINGS)) {
      expect(binding.code.length).toBeGreaterThan(0);
      expect(binding.label.length).toBeGreaterThan(0);
    }
  });

  it("maps restart to Enter", () => {
    expect(CONTROL_BINDINGS.restart.code).toBe("Enter");
  });
});

describe("OVERLAY_PROMPTS", () => {
  it("uses Enter for the game over restart prompt", () => {
    expect(OVERLAY_PROMPTS.gameOver).toContain("Enter");
    expect(OVERLAY_PROMPTS.gameOver).not.toContain("Space");
  });
});

describe("CONTROL_FOOTER", () => {
  it("mentions Enter", () => {
    expect(CONTROL_FOOTER).toContain("Enter");
  });
});
