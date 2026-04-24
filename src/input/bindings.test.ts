import { describe, expect, it } from "vitest";

import { CONTROL_BINDINGS, CONTROL_FOOTER, OVERLAY_PROMPTS } from "./bindings";

describe("bindings", () => {
  it("defines a code and label for every control binding", () => {
    for (const binding of Object.values(CONTROL_BINDINGS)) {
      expect(binding.code.length).toBeGreaterThan(0);
      expect(binding.label.length).toBeGreaterThan(0);
    }
  });

  it("binds restart to Enter", () => {
    expect(CONTROL_BINDINGS.restart.code).toBe("Enter");
  });

  it("uses Enter instead of Space in the game-over prompt", () => {
    expect(OVERLAY_PROMPTS.gameOver).toContain("Enter");
    expect(OVERLAY_PROMPTS.gameOver).not.toContain("Space");
  });

  it("mentions Enter in the control footer", () => {
    expect(CONTROL_FOOTER).toContain("Enter");
  });
});
