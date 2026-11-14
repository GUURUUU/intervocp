import { describe, expect, it } from "vitest";
import { haversineKm } from "@/lib/geo";

const SITE = { latitude: 32.8866, longitude: -6.9063 }; // OCP Khouribga

describe("haversineKm", () => {
  it("returns 0 for the same point", () => {
    expect(haversineKm(SITE, SITE)).toBe(0);
  });

  it("is symmetric", () => {
    const other = { latitude: 32.5, longitude: -6.5 };
    const ab = haversineKm(SITE, other);
    const ba = haversineKm(other, SITE);
    expect(ab).toBeCloseTo(ba, 9);
  });

  it("measures ~111 km per degree of latitude", () => {
    const d = haversineKm(SITE, { latitude: 33.8866, longitude: -6.9063 });
    expect(d).toBeGreaterThan(109);
    expect(d).toBeLessThan(112);
  });

  it("grows monotonically with distance", () => {
    const near = haversineKm(SITE, { latitude: 32.9, longitude: -6.9 });
    const mid = haversineKm(SITE, { latitude: 33.3, longitude: -7.3 });
    const far = haversineKm(SITE, { latitude: 34.0, longitude: -8.0 });
    expect(near).toBeLessThan(mid);
    expect(mid).toBeLessThan(far);
  });

  it("handles antipodal-scale distances without exploding", () => {
    const d = haversineKm(SITE, { latitude: -32.8866, longitude: 173.0937 });
    expect(d).toBeLessThan(20016); // half of the earth circumference
    expect(d).toBeGreaterThan(10000);
  });
});
