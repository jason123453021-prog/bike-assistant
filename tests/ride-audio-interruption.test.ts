import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { shouldSuppressRideAudioForSystemInterruption } from "../lib/ride-audio-interruption";

const feedbackSource = readFileSync(resolve(process.cwd(), "lib/feedback-service.ts"), "utf8");
const mapSource = readFileSync(resolve(process.cwd(), "app/(tabs)/map.tsx"), "utf8");

describe("騎乘通話優先音訊", () => {
  it("僅在 App 處於前景時允許騎乘語音，讓 inactive 或 background 狀態讓出系統音訊焦點", () => {
    expect(shouldSuppressRideAudioForSystemInterruption("active")).toBe(false);
    expect(shouldSuppressRideAudioForSystemInterruption("inactive")).toBe(true);
    expect(shouldSuppressRideAudioForSystemInterruption("background")).toBe(true);
  });

  it("集中式語音服務會在系統中斷時直接略過播報，不建立補播佇列", () => {
    expect(feedbackSource).toContain("let rideSpeechSuppressed = false");
    expect(feedbackSource).toContain("export function setRideSpeechSuppressed");
    expect(feedbackSource).toContain("if (!enabled || rideSpeechSuppressed || Platform.OS === \"web\") return;");
  });

  it("騎乘頁會停止既有 TTS 與提示音，且電話／中斷結束後只解除抑制而不呼叫任何補播函式", () => {
    expect(mapSource).toContain('interruptionMode: "doNotMix"');
    expect(mapSource).toContain('interruptionModeAndroid: "doNotMix"');
    expect(mapSource).toContain("setRideSpeechSuppressed(shouldSuppressAudio)");
    expect(mapSource).toContain("void stopSpeech();");
    expect(mapSource).toContain("alertPlayer.pause()");
    expect(mapSource).not.toContain("resumeRideSpeechAfterSystemInterruption");
  });
});
