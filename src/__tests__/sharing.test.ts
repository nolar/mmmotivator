import { encodeConfig, decodeConfig } from "../sharing";
import type { LifeConfig } from "../types";

const validConfig: LifeConfig = {
  birthdate: "1990-06-15",
  totalYears: 90,
  periods: [
    { label: "Childhood", start: "1990-06-15", end: "1997-08-31" },
    { label: "School", start: "1997-09-01", end: "2008-06-30" },
  ],
  dates: [
    { date: "1990-06-15", title: "Born" },
  ],
};

describe("encodeConfig / decodeConfig", () => {
  it("round-trips a valid config", () => {
    const encoded = encodeConfig(validConfig);
    const decoded = decodeConfig(encoded);
    expect(decoded).toEqual(validConfig);
  });

  it("round-trips config with optional color fields", () => {
    const config: LifeConfig = {
      ...validConfig,
      periods: [{ label: "A", start: "2000-01-01", end: "2005-12-31", color: "bg-rose-400" }],
      dates: [{ date: "2000-01-01", title: "Event", color: "bg-sky-400" }],
    };
    const decoded = decodeConfig(encodeConfig(config));
    expect(decoded).toEqual(config);
  });

  it("round-trips config with showToday", () => {
    const config: LifeConfig = { ...validConfig, showToday: false };
    const decoded = decodeConfig(encodeConfig(config));
    expect(decoded).toEqual(config);
  });

  it("returns null for garbage input", () => {
    expect(decodeConfig("!!!garbage!!!")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(decodeConfig("")).toBeNull();
  });

  it("returns null for valid base64url but invalid JSON", () => {
    // Encode some arbitrary bytes that aren't valid deflate data
    expect(decodeConfig("AAAA")).toBeNull();
  });

  it("encoded output contains only URL-safe characters", () => {
    const encoded = encodeConfig(validConfig);
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});
