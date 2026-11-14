import { describe, expect, it } from "vitest";
import {
  formatDate,
  formatDateTime,
  formatDuration,
  formatMad,
} from "@/lib/format";

describe("formatMad", () => {
  it("formats amounts in Moroccan dirham", () => {
    // Separators are locale-dependent: dot or space grouping, NBSP before MAD.
    expect(formatMad(1234.5)).toMatch(/1[.,\u00a0\u202f ]?234,50\sMAD/);
    expect(formatMad(0)).toMatch(/0,00\sMAD/);
  });
});

describe("formatDuration", () => {
  const start = new Date("2026-01-15T08:00:00Z");

  it("formats hours and minutes", () => {
    expect(formatDuration(start, new Date("2026-01-15T09:30:00Z"))).toBe("1 h 30");
    expect(formatDuration(start, new Date("2026-01-15T10:00:00Z"))).toBe("2 h 00");
  });

  it("formats sub-hour durations in minutes only", () => {
    expect(formatDuration(start, new Date("2026-01-15T08:45:00Z"))).toBe("45 min");
  });

  it("returns — for inverted ranges", () => {
    expect(formatDuration(start, new Date("2026-01-15T07:00:00Z"))).toBe("—");
  });
});

describe("formatDate / formatDateTime", () => {
  it("returns — for nullish values", () => {
    expect(formatDate(null)).toBe("—");
    expect(formatDateTime(undefined)).toBe("—");
  });

  it("formats dates in French", () => {
    expect(formatDate("2026-11-13T10:00:00Z")).toMatch(/13 nov/);
    // Local timezone-aware construction so the assertion is TZ-independent.
    expect(formatDateTime(new Date(2026, 10, 13, 10, 30))).toMatch(/10:30/);
  });
});
