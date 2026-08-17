import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const feedbackSource = readFileSync(resolve(process.cwd(), "lib/feedback-service.ts"), "utf8");
const mapSource = readFileSync(resolve(process.cwd(), "app/(tabs)/map.tsx"), "utf8");

describe("smart supply speech reminders", () => {
  it("uses only the two fixed energy and hydration announcements without exposing calculated amounts", () => {
    expect(feedbackSource).toContain("speakSupplyReminder");
    expect(mapSource).not.toContain("speakSmartSupplyReminder");
    expect(mapSource).toContain("void speakSupplyReminder(type, true)");
    expect(feedbackSource).toContain('? "請補給能量"');
    expect(feedbackSource).toContain(': "請補給水分"');
    expect(feedbackSource).not.toContain("補給提醒，請補充能量棒或食物");
    expect(feedbackSource).not.toContain("補給提醒，請補充水分");
  });

  it("uses generic speech for initial and repeated pending reminders while respecting ttsEnabled", () => {
    expect(mapSource).toContain("if (!settings.ttsEnabled) return");
    expect(mapSource).toContain("speakPlannedSupplyReminder(type)");
    expect(mapSource).toContain("pendingSupplyPlansRef.current[type] = recommendation");
    expect(mapSource).toContain('speakPlannedSupplyReminder("calorie")');
    expect(mapSource).toContain('speakPlannedSupplyReminder("water")');
  });

  it("does not defer supply speech or reminders according to downhill state", () => {
    expect(mapSource).not.toContain("isDownhillRef");
    expect(mapSource).not.toContain("deferredSupplySpeechPlansRef");
    expect(mapSource).not.toContain("resumeDeferredSupplySpeech");
    expect(mapSource).not.toContain("PauseOnDownhill");
  });

  it("passes through the centralized speech guard so a system call interruption suppresses supply speech", () => {
    expect(mapSource).toContain("setRideSpeechSuppressed(shouldSuppressAudio)");
    expect(feedbackSource).toContain("rideSpeechSuppressed");
  });

  it("does not read custom supply names, confirmation text, smart-plan reasons, quantities, or interval details aloud", () => {
    expect(mapSource).toContain('speakPlannedSupplyReminder("calorie")');
    expect(mapSource).not.toContain("speak(`請補給 ${supplyItem.name}`)");
    expect(mapSource).not.toContain('speak("已確認補給")');
    expect(feedbackSource).toContain('return type === "calorie" ? "請補給能量" : "請補給水分"');
  });
});
