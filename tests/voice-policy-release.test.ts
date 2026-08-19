import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const mapSource = readFileSync(resolve(process.cwd(), "app/(tabs)/map.tsx"), "utf8");
const feedbackSource = readFileSync(resolve(process.cwd(), "lib/feedback-service.ts"), "utf8");

describe("release voice policy", () => {
  it("keeps automatic pause, resume and ride completion silent", () => {
    expect(mapSource).not.toContain("speakAutoPause");
    expect(mapSource).not.toContain("speakAutoResume");
    expect(mapSource).not.toContain("EmotionalUXManager");
    expect(mapSource).not.toMatch(/\bspeak\(/);
  });

  it("keeps the production reminder vocabulary limited to the two supply prompts", () => {
    expect(feedbackSource).toContain('type === "calorie"');
    expect(feedbackSource).toContain('"請補給能量"');
    expect(feedbackSource).toContain('"請補給水分"');
    expect(feedbackSource).not.toContain("export async function speak(");
    expect(feedbackSource).not.toContain("speakRideUpdate");
    expect(feedbackSource).not.toContain("speakAutoPause");
    expect(feedbackSource).not.toContain("speakAutoResume");
  });
});
