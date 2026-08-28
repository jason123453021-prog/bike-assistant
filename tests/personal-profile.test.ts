import { describe, expect, it } from "vitest";
import { calculateAgeFromBirthday, normalizeBirthday } from "../lib/personal-profile";

describe("personal profile birthday", () => {
  it("calculates age before and after the birthday without storing an annual update", () => {
    expect(calculateAgeFromBirthday("1990-08-15", new Date(2026, 7, 14))).toBe(35);
    expect(calculateAgeFromBirthday("1990-08-15", new Date(2026, 7, 15))).toBe(36);
  });

  it("rejects invalid calendar birthdays", () => {
    expect(normalizeBirthday("1990-02-30")).toBeUndefined();
    expect(normalizeBirthday("1990/08/15")).toBeUndefined();
  });
});
