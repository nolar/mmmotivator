import { vi } from "vitest";
import { loadConfig, saveConfig, importConfigFile } from "../storage";
import type { LifeConfig } from "../types";

const validConfig: LifeConfig = {
  birthdate: "1990-06-15",
  totalYears: 90,
  periods: [
    { label: "Childhood", start: "1990-06-15", end: "1997-08-31" },
    { label: "School", start: "1997-09-01", end: "2008-06-30" },
  ],
};

function createMockStorage(): Storage {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
    get length() { return Object.keys(store).length; },
    key: vi.fn((i: number) => Object.keys(store)[i] ?? null),
  };
}

describe("saveConfig / loadConfig round-trip", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", createMockStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns null when nothing is stored", () => {
    expect(loadConfig()).toBeNull();
  });

  it("round-trips a valid config", () => {
    saveConfig(validConfig);
    const loaded = loadConfig();
    expect(loaded).not.toBeNull();
    expect(loaded!.birthdate).toBe(validConfig.birthdate);
    expect(loaded!.totalYears).toBe(validConfig.totalYears);
    expect(loaded!.periods).toHaveLength(validConfig.periods.length);
    expect(loaded!.periods[0].label).toBe("Childhood");
  });

  it("preserves optional color field", () => {
    const configWithColor: LifeConfig = {
      ...validConfig,
      periods: [
        { label: "A", start: "2000-01-01", end: "2005-12-31", color: "bg-rose-400" },
      ],
    };
    saveConfig(configWithColor);
    const loaded = loadConfig();
    expect(loaded!.periods[0].color).toBe("bg-rose-400");
  });
});

describe("loadConfig with invalid data", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", createMockStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns null for invalid JSON", () => {
    localStorage.setItem("life-in-weeks-config", "not json");
    expect(loadConfig()).toBeNull();
  });

  it("returns null for wrong shape", () => {
    localStorage.setItem("life-in-weeks-config", JSON.stringify({ foo: "bar" }));
    expect(loadConfig()).toBeNull();
  });

  it("returns null when periods have wrong types", () => {
    localStorage.setItem(
      "life-in-weeks-config",
      JSON.stringify({
        birthdate: "1990-06-15",
        totalYears: 90,
        periods: [{ label: 123, start: "x", end: "y" }],
      })
    );
    expect(loadConfig()).toBeNull();
  });
});

describe("importConfigFile", () => {
  it("parses a valid config file", async () => {
    const json = JSON.stringify({ ...validConfig, version: 1 });
    const file = new File([json], "config.json", { type: "application/json" });
    const result = await importConfigFile(file);
    expect(result.birthdate).toBe(validConfig.birthdate);
    expect(result.periods).toHaveLength(validConfig.periods.length);
  });

  it("throws on invalid JSON", async () => {
    const file = new File(["not json"], "bad.json", { type: "application/json" });
    await expect(importConfigFile(file)).rejects.toThrow();
  });

  it("throws on invalid shape", async () => {
    const file = new File([JSON.stringify({ foo: 1 })], "bad.json", {
      type: "application/json",
    });
    await expect(importConfigFile(file)).rejects.toThrow("Invalid configuration file");
  });
});
