import { render, screen } from "@testing-library/react";
import WeekGrid from "../components/WeekGrid";
import type { LifePeriod } from "../types";
import { assignColors } from "../colors";

const periods: LifePeriod[] = [
  { label: "Childhood", start: "1990-06-15", end: "1997-08-31" },
  { label: "School", start: "1997-09-01", end: "2008-06-30" },
];

const birthdate = new Date("1990-06-15");
const colorMap = assignColors(periods);

describe("WeekGrid", () => {
  it("renders the title", () => {
    render(
      <WeekGrid
        birthdate={birthdate}
        totalYears={3}
        periods={periods}
        colorMap={colorMap}
      />
    );
    expect(screen.getByText("Memento mori")).toBeInTheDocument();
  });

  it("renders grid cells with period color classes", () => {
    const { container } = render(
      <WeekGrid
        birthdate={birthdate}
        totalYears={2}
        periods={periods}
        colorMap={colorMap}
      />
    );
    // Each row has 52 cells + 1 label div + 1 year div = 54 children per data row,
    // plus the title row (2 divs) and header row (53 divs).
    // Just check that period-colored cells exist
    const childColor = colorMap.get(periods[0])!;
    const coloredCells = container.querySelectorAll(`.${childColor}`);
    expect(coloredCells.length).toBeGreaterThan(0);
  });

  it("renders correct number of data cells (rows * 52)", () => {
    const totalYears = 3;
    const { container } = render(
      <WeekGrid
        birthdate={birthdate}
        totalYears={totalYears}
        periods={periods}
        colorMap={colorMap}
      />
    );
    // Each cell has w-2.5 h-2.5 classes
    const cells = container.querySelectorAll(".w-2\\.5.h-2\\.5");
    expect(cells).toHaveLength(totalYears * 52);
  });
});
