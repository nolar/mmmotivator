import { readFileSync } from "fs";
import { resolve } from "path";

describe("vercel.json", () => {
  const config = JSON.parse(
    readFileSync(resolve(__dirname, "../../vercel.json"), "utf-8")
  );

  it("contains a rewrites array", () => {
    expect(Array.isArray(config.rewrites)).toBe(true);
    expect(config.rewrites.length).toBeGreaterThan(0);
  });

  it("has a catch-all SPA rewrite to index.html", () => {
    const spaRewrite = config.rewrites.find(
      (r: { destination: string }) => r.destination === "/index.html"
    );
    expect(spaRewrite).toBeDefined();
  });

  it("uses a negative lookahead to exclude assets/ paths", () => {
    const spaRewrite = config.rewrites.find(
      (r: { destination: string }) => r.destination === "/index.html"
    );
    // Vercel's source pattern uses a capture group with a negative lookahead
    // to avoid rewriting requests for static assets
    expect(spaRewrite.source).toContain("(?!assets/)");
  });
});
