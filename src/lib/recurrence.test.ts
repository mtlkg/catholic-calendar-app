import { describe, expect, it } from "vitest";
import { generateRecurrenceOccurrences, shiftRecurringLocal } from "./recurrence";

describe("recurrence dates", () => {
  it("keeps a Wednesday-Friday span on the same ordinal weekdays monthly", () => {
    const dates = generateRecurrenceOccurrences("2026-08-19T13:41", "2026-08-21T13:41", "monthly", 2);
    expect(dates[1]).toEqual({ start: "2026-09-16T13:41", end: "2026-09-18T13:41" });
  });

  it("uses the last matching weekday when a fifth weekday is missing", () => {
    expect(shiftRecurringLocal("2024-01-31T19:00", "monthly", 1)).toBe("2024-02-28T19:00");
  });

  it("handles leap-year February without changing weekday", () => {
    expect(shiftRecurringLocal("2024-02-29T08:30", "yearly", 1)).toBe("2025-02-27T08:30");
  });

  it("keeps exact local times across daylight-saving boundaries", () => {
    expect(shiftRecurringLocal("2026-03-01T19:00", "weekly", 2)).toBe("2026-03-15T19:00");
  });

  it("crosses month and year boundaries for weekly schedules", () => {
    expect(shiftRecurringLocal("2026-12-25T09:00", "weekly", 2)).toBe("2027-01-08T09:00");
  });
});