import type { LifeConfig } from "./types";

const STORAGE_KEY = "life-in-weeks-config";
const CURRENT_VERSION = 1;

interface StoredConfig extends LifeConfig {
  version: number;
}

export function loadConfig(): LifeConfig | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!validateConfig(data)) return null;
    return {
      birthdate: data.birthdate,
      totalYears: data.totalYears,
      periods: data.periods.map((p: { label: string; start: string; end: string; color?: string }) => ({
        label: p.label,
        start: p.start,
        end: p.end,
        ...(p.color ? { color: p.color } : {}),
      })),
      dates: Array.isArray(data.dates)
        ? data.dates.map((d: { date: string; title: string; color?: string }) => ({
            date: d.date,
            title: d.title,
            ...(d.color ? { color: d.color } : {}),
          }))
        : [],
      ...(typeof data.showToday === "boolean" ? { showToday: data.showToday } : {}),
    };
  } catch {
    return null;
  }
}

export function saveConfig(config: LifeConfig): void {
  const stored: StoredConfig = { ...config, version: CURRENT_VERSION };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
}

export function exportConfigFile(config: LifeConfig): void {
  const stored: StoredConfig = { ...config, version: CURRENT_VERSION };
  const json = JSON.stringify(stored, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "life-in-weeks.json";
  a.click();
  URL.revokeObjectURL(url);
}

export async function importConfigFile(file: File): Promise<LifeConfig> {
  const text = await file.text();
  const data = JSON.parse(text);
  if (!validateConfig(data)) {
    throw new Error("Invalid configuration file");
  }
  return {
    birthdate: data.birthdate,
    totalYears: data.totalYears,
    periods: data.periods.map((p: { label: string; start: string; end: string; color?: string }) => ({
      label: p.label,
      start: p.start,
      end: p.end,
      ...(p.color ? { color: p.color } : {}),
    })),
    dates: Array.isArray(data.dates)
      ? data.dates.map((d: { date: string; title: string; color?: string }) => ({
          date: d.date,
          title: d.title,
          ...(d.color ? { color: d.color } : {}),
        }))
      : [],
    ...(typeof data.showToday === "boolean" ? { showToday: data.showToday } : {}),
  };
}

export function validateConfig(data: unknown): data is LifeConfig {
  if (typeof data !== "object" || data === null) return false;
  const obj = data as Record<string, unknown>;
  if (typeof obj.birthdate !== "string") return false;
  if (typeof obj.totalYears !== "number") return false;
  if (!Array.isArray(obj.periods)) return false;
  for (const p of obj.periods) {
    if (typeof p !== "object" || p === null) return false;
    if (typeof p.label !== "string") return false;
    if (typeof p.start !== "string") return false;
    if (typeof p.end !== "string") return false;
    if (p.color !== undefined && typeof p.color !== "string") return false;
  }
  if (obj.dates !== undefined) {
    if (!Array.isArray(obj.dates)) return false;
    for (const d of obj.dates) {
      if (typeof d !== "object" || d === null) return false;
      if (typeof d.date !== "string") return false;
      if (typeof d.title !== "string") return false;
      if (d.color !== undefined && typeof d.color !== "string") return false;
    }
  }
  if (obj.showToday !== undefined && typeof obj.showToday !== "boolean") return false;
  return true;
}
