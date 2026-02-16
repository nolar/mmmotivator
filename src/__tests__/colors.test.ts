import { assignColors, PALETTE } from "../colors";
import type { LifePeriod } from "../types";

describe("assignColors", () => {
  const periods: LifePeriod[] = [
    { label: "Childhood", start: "1990-06-15", end: "1997-08-31" },
    { label: "School", start: "1997-09-01", end: "2008-06-30" },
    { label: "University", start: "2008-09-01", end: "2013-06-30" },
  ];

  it("assigns a color to every period", () => {
    const map = assignColors(periods);
    expect(map.size).toBe(periods.length);
    for (const period of periods) {
      expect(map.has(period)).toBe(true);
    }
  });

  it("assigns colors from the palette", () => {
    const map = assignColors(periods);
    for (const color of map.values()) {
      expect(PALETTE).toContain(color);
    }
  });

  it("does not assign the same color to adjacent periods", () => {
    const map = assignColors(periods);
    const sorted = [...periods].sort(
      (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
    );
    for (let i = 1; i < sorted.length; i++) {
      expect(map.get(sorted[i])).not.toBe(map.get(sorted[i - 1]));
    }
  });

  it("respects a manual color field", () => {
    const customPeriods: LifePeriod[] = [
      { label: "A", start: "2000-01-01", end: "2005-12-31", color: "bg-pink-400" },
      { label: "B", start: "2006-01-01", end: "2010-12-31" },
    ];
    const map = assignColors(customPeriods);
    expect(map.get(customPeriods[0])).toBe("bg-pink-400");
  });

  it("avoids duplicating a manual color for the next auto-assigned period", () => {
    const customPeriods: LifePeriod[] = [
      { label: "A", start: "2000-01-01", end: "2005-12-31", color: PALETTE[0] },
      { label: "B", start: "2006-01-01", end: "2010-12-31" },
    ];
    const map = assignColors(customPeriods);
    expect(map.get(customPeriods[1])).not.toBe(PALETTE[0]);
  });
});
