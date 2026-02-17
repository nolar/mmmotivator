import { deflate, inflate } from "pako";
import { validateConfig } from "./storage";
import type { LifeConfig } from "./types";

const BASE64URL_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

function toBase64Url(bytes: Uint8Array): string {
  let result = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
    result += BASE64URL_CHARS[(b0 >> 2) & 0x3f];
    result += BASE64URL_CHARS[((b0 << 4) | (b1 >> 4)) & 0x3f];
    if (i + 1 < bytes.length) result += BASE64URL_CHARS[((b1 << 2) | (b2 >> 6)) & 0x3f];
    if (i + 2 < bytes.length) result += BASE64URL_CHARS[b2 & 0x3f];
  }
  return result;
}

function fromBase64Url(str: string): Uint8Array {
  const lookup = new Uint8Array(128);
  for (let i = 0; i < BASE64URL_CHARS.length; i++) {
    lookup[BASE64URL_CHARS.charCodeAt(i)] = i;
  }
  const len = str.length;
  const outLen = Math.floor((len * 3) / 4);
  const out = new Uint8Array(outLen);
  let j = 0;
  for (let i = 0; i < len; i += 4) {
    const c0 = lookup[str.charCodeAt(i)];
    const c1 = i + 1 < len ? lookup[str.charCodeAt(i + 1)] : 0;
    const c2 = i + 2 < len ? lookup[str.charCodeAt(i + 2)] : 0;
    const c3 = i + 3 < len ? lookup[str.charCodeAt(i + 3)] : 0;
    out[j++] = (c0 << 2) | (c1 >> 4);
    if (i + 2 < len) out[j++] = ((c1 << 4) | (c2 >> 2)) & 0xff;
    if (i + 3 < len) out[j++] = ((c2 << 6) | c3) & 0xff;
  }
  return out.slice(0, j);
}

export function encodeConfig(config: LifeConfig): string {
  const json = JSON.stringify(config);
  const compressed = deflate(json, { level: 9 });
  return toBase64Url(compressed);
}

export function decodeConfig(encoded: string): LifeConfig | null {
  try {
    if (!encoded) return null;
    const bytes = fromBase64Url(encoded);
    const json = inflate(bytes, { to: "string" });
    const data = JSON.parse(json);
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
