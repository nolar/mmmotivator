import { getCellDate, findPeriod, buildGridRows } from "../grid";
import type { LifePeriod } from "../types";

describe("getCellDate", () => {
  const birthdate = new Date("1990-06-15");

  it("returns the birthdate for year 0, week 0", () => {
    const result = getCellDate(birthdate, 0, 0);
    expect(result.toISOString().slice(0, 10)).toBe("1990-06-15");
  });

  it("advances by 7 days per week", () => {
    const result = getCellDate(birthdate, 0, 1);
    expect(result.toISOString().slice(0, 10)).toBe("1990-06-22");
  });

  it("advances roughly one year for year=1, week=0", () => {
    const result = getCellDate(birthdate, 1, 0);
    // 365.25 days = 365 days (floor), so June 15 + 365 = June 15 next year
    const diffDays = Math.round(
      (result.getTime() - birthdate.getTime()) / (1000 * 60 * 60 * 24)
    );
    expect(diffDays).toBe(365);
  });

  it("handles week 51 (last week of the year)", () => {
    const result = getCellDate(birthdate, 0, 51);
    const diffDays = Math.round(
      (result.getTime() - birthdate.getTime()) / (1000 * 60 * 60 * 24)
    );
    expect(diffDays).toBe(51 * 7);
  });

  it("does not mutate the birthdate argument", () => {
    const original = new Date("1990-06-15");
    const originalTime = original.getTime();
    getCellDate(original, 5, 10);
    expect(original.getTime()).toBe(originalTime);
  });
});

describe("findPeriod", () => {
  const periods: LifePeriod[] = [
    { label: "Childhood", start: "1990-06-15", end: "1997-08-31" },
    { label: "School", start: "1997-09-01", end: "2008-06-30" },
  ];

  it("returns the matching period for a date within range", () => {
    const result = findPeriod(new Date("1995-01-01"), periods);
    expect(result).not.toBeNull();
    expect(result!.label).toBe("Childhood");
  });

  it("returns null when no period matches", () => {
    const result = findPeriod(new Date("2020-01-01"), periods);
    expect(result).toBeNull();
  });

  it("matches on the start boundary", () => {
    const result = findPeriod(new Date("1997-09-01"), periods);
    expect(result).not.toBeNull();
    expect(result!.label).toBe("School");
  });

  it("matches on the end boundary", () => {
    const result = findPeriod(new Date("1997-08-31"), periods);
    expect(result).not.toBeNull();
    expect(result!.label).toBe("Childhood");
  });
});

describe("buildGridRows", () => {
  const birthdate = new Date("1990-06-15");
  const periods: LifePeriod[] = [
    { label: "Childhood", start: "1990-06-15", end: "1997-08-31" },
  ];

  it("returns the correct number of rows", () => {
    const rows = buildGridRows(birthdate, 10, periods);
    expect(rows).toHaveLength(10);
  });

  it("each row has exactly 52 cells", () => {
    const rows = buildGridRows(birthdate, 5, periods);
    for (const row of rows) {
      expect(row.cells).toHaveLength(52);
    }
  });

  it("each row has the correct year index", () => {
    const rows = buildGridRows(birthdate, 3, periods);
    expect(rows.map((r) => r.year)).toEqual([0, 1, 2]);
  });

  it("assigns periods to cells within range", () => {
    const rows = buildGridRows(birthdate, 1, periods);
    // First cell should be childhood (birthdate is within the period)
    expect(rows[0].cells[0].period).not.toBeNull();
    expect(rows[0].cells[0].period!.label).toBe("Childhood");
  });
});
