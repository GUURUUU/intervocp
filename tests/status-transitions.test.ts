import { describe, expect, it } from "vitest";
import { STATUS_TRANSITIONS, canTransition } from "@/lib/status";
import type { Status } from "@prisma/client";

describe("status transitions", () => {
  it("allows the happy path: creation → planning → execution → done", () => {
    expect(canTransition("NOUVELLE", "PLANIFIEE")).toBe(true);
    expect(canTransition("PLANIFIEE", "EN_COURS")).toBe(true);
    expect(canTransition("EN_COURS", "TERMINEE")).toBe(true);
    expect(canTransition("TERMINEE", "CLOTUREE")).toBe(true);
  });

  it("allows waiting for parts and resuming", () => {
    expect(canTransition("EN_COURS", "EN_ATTENTE_PIECES")).toBe(true);
    expect(canTransition("EN_ATTENTE_PIECES", "EN_COURS")).toBe(true);
  });

  it("allows cancellation from any open status", () => {
    const open: Status[] = ["NOUVELLE", "PLANIFIEE", "EN_COURS", "EN_ATTENTE_PIECES"];
    for (const s of open) {
      expect(canTransition(s, "ANNULEE")).toBe(true);
    }
  });

  it("forbids skipping the lifecycle", () => {
    expect(canTransition("NOUVELLE", "EN_COURS")).toBe(false);
    expect(canTransition("NOUVELLE", "CLOTUREE")).toBe(false);
    expect(canTransition("PLANIFIEE", "TERMINEE")).toBe(false);
    expect(canTransition("EN_ATTENTE_PIECES", "TERMINEE")).toBe(false);
  });

  it("forbids going backwards", () => {
    expect(canTransition("EN_COURS", "PLANIFIEE")).toBe(false);
    expect(canTransition("TERMINEE", "EN_COURS")).toBe(false);
    expect(canTransition("CLOTUREE", "EN_COURS")).toBe(false);
    expect(canTransition("ANNULEE", "NOUVELLE")).toBe(false);
  });

  it("makes closed and cancelled statuses terminal", () => {
    for (const to of Object.keys(STATUS_TRANSITIONS) as Status[]) {
      expect(canTransition("CLOTUREE", to)).toBe(false);
      expect(canTransition("ANNULEE", to)).toBe(false);
    }
  });

  it("never allows a status to transition to itself", () => {
    for (const s of Object.keys(STATUS_TRANSITIONS) as Status[]) {
      expect(canTransition(s, s)).toBe(false);
    }
  });
});
