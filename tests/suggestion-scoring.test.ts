import { describe, expect, it } from "vitest";
import {
  ACTIVE_STATUSES,
  WEIGHTS,
  availabilityScore,
  distanceScore,
  overlaps,
  skillScore,
  totalScore,
  workloadScore,
  type AvailabilityWindow,
} from "@/server/services/suggestion-scoring";

const T = (h: number) => new Date(Date.UTC(2026, 0, 15, 8 + h, 0));

describe("overlaps", () => {
  it("detects partially overlapping ranges", () => {
    expect(overlaps(T(0), T(2), T(1), T(3))).toBe(true);
    expect(overlaps(T(1), T(3), T(0), T(2))).toBe(true);
  });

  it("detects containment in both directions", () => {
    expect(overlaps(T(0), T(4), T(1), T(2))).toBe(true);
    expect(overlaps(T(1), T(2), T(0), T(4))).toBe(true);
  });

  it("rejects touching bounds (no double-booking on edge)", () => {
    expect(overlaps(T(0), T(2), T(2), T(4))).toBe(false);
    expect(overlaps(T(2), T(4), T(0), T(2))).toBe(false);
  });

  it("rejects disjoint ranges", () => {
    expect(overlaps(T(0), T(1), T(3), T(4))).toBe(false);
  });
});

describe("skillScore", () => {
  it("maps levels 1..5 to 0.2..1.0", () => {
    expect(skillScore(1)).toBe(0.2);
    expect(skillScore(2)).toBe(0.4);
    expect(skillScore(3)).toBe(0.6);
    expect(skillScore(4)).toBe(0.8);
    expect(skillScore(5)).toBe(1);
  });

  it("returns 0 when the skill is unknown", () => {
    expect(skillScore(null)).toBe(0);
    expect(skillScore(0)).toBe(0);
  });
});

describe("availabilityScore", () => {
  const win = (
    type: AvailabilityWindow["type"],
    from: number,
    to: number
  ): AvailabilityWindow => ({ type, start: T(from), end: T(to) });

  it("scores 1 when a WORK block fully covers the slot", () => {
    const r = availabilityScore(T(1), T(3), [win("WORK", 0, 8)]);
    expect(r.score).toBe(1);
    expect(r.blocked).toBe(false);
  });

  it("is blocked when a LEAVE/BUSY block overlaps, even with WORK", () => {
    const r = availabilityScore(T(1), T(3), [
      win("WORK", 0, 8),
      win("LEAVE", 2, 4),
    ]);
    expect(r.score).toBe(0);
    expect(r.blocked).toBe(true);
  });

  it("scores 0 when windows exist but none covers the slot", () => {
    const r = availabilityScore(T(5), T(6), [win("WORK", 0, 2)]);
    expect(r.score).toBe(0);
    expect(r.blocked).toBe(false);
  });

  it("scores 0.5 when no availability data exists that day", () => {
    const r = availabilityScore(T(1), T(3), []);
    expect(r.score).toBe(0.5);
    expect(r.blocked).toBe(false);
  });
});

describe("workloadScore", () => {
  it("is 1 for a free technician", () => {
    expect(workloadScore(0, 0)).toBe(1);
  });

  it("penalizes double-booking overlaps by 0.5 each", () => {
    expect(workloadScore(1, 0)).toBe(0.5);
    expect(workloadScore(2, 0)).toBe(0);
  });

  it("penalizes week load by 0.1 each", () => {
    expect(workloadScore(0, 5)).toBe(0.5);
    expect(workloadScore(0, 10)).toBe(0);
  });

  it("never goes below 0", () => {
    expect(workloadScore(5, 5)).toBe(0);
  });
});

describe("distanceScore", () => {
  it("uses 0.5 when distance is unknown", () => {
    expect(distanceScore(null)).toBe(0.5);
  });

  it("is 1 within 2 km and 0 beyond 20 km", () => {
    expect(distanceScore(0)).toBe(1);
    expect(distanceScore(2)).toBe(1);
    expect(distanceScore(20)).toBe(0);
    expect(distanceScore(60)).toBe(0);
  });

  it("degrades linearly between 2 and 20 km", () => {
    expect(distanceScore(11)).toBeCloseTo(0.5, 10);
    expect(distanceScore(6.5)).toBeCloseTo(0.75, 10);
  });
});

describe("totalScore", () => {
  it("weights sum to 1", () => {
    const sum =
      WEIGHTS.skill + WEIGHTS.availability + WEIGHTS.workload + WEIGHTS.distance;
    expect(sum).toBeCloseTo(1, 10);
  });

  it("is 1 for a perfect candidate and 0 for a blocked one", () => {
    expect(
      totalScore({ skillMatch: 1, availability: 1, workload: 1, distance: 1 })
    ).toBe(1);
    expect(
      totalScore({ skillMatch: 0, availability: 0, workload: 0, distance: 0 })
    ).toBe(0);
  });

  it("ranks a perfect candidate above a mediocre one", () => {
    const perfect = totalScore({
      skillMatch: 1,
      availability: 1,
      workload: 1,
      distance: 1,
    });
    const mediocre = totalScore({
      skillMatch: 0.4,
      availability: 0.5,
      workload: 0.5,
      distance: 0.5,
    });
    expect(perfect).toBeGreaterThan(mediocre);
  });

  it("respects the component weights", () => {
    // skill dominates: level-5 mastery alone gives 0.40
    expect(
      totalScore({ skillMatch: 1, availability: 0, workload: 0, distance: 0 })
    ).toBe(0.4);
  });

  it("lists the three active statuses", () => {
    expect(ACTIVE_STATUSES).toEqual([
      "PLANIFIEE",
      "EN_COURS",
      "EN_ATTENTE_PIECES",
    ]);
  });
});
