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
        dates={[]}
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
        dates={[]}
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
        dates={[]}
      />
    );
    // Each cell has w-2.5 h-2.5 classes
    const cells = container.querySelectorAll(".w-2\\.5.h-2\\.5");
    expect(cells).toHaveLength(totalYears * 52);
  });

  it("renders a star SVG in the cell matching a date marker", () => {
    const { container } = render(
      <WeekGrid
        birthdate={birthdate}
        totalYears={3}
        periods={periods}
        colorMap={colorMap}
        dates={[{ date: "1990-06-15", title: "Born" }]}
      />
    );
    const stars = container.querySelectorAll("svg");
    expect(stars.length).toBeGreaterThan(0);
  });

  it("renders date marker title in the annotation column", () => {
    render(
      <WeekGrid
        birthdate={birthdate}
        totalYears={3}
        periods={periods}
        colorMap={colorMap}
        dates={[{ date: "1990-06-15", title: "Born" }]}
      />
    );
    expect(screen.getByText("Born")).toBeInTheDocument();
  });

  it("uses compact grid template columns", () => {
    const { container } = render(
      <WeekGrid
        birthdate={birthdate}
        totalYears={2}
        periods={periods}
        colorMap={colorMap}
        dates={[]}
      />
    );
    const grid = container.querySelector(".inline-grid") as HTMLElement;
    expect(grid.style.gridTemplateColumns).toBe("5ch 1ch repeat(52, 1fr) 5ch");
  });

  it("constrains label column width and year column width", () => {
    const { container } = render(
      <WeekGrid
        birthdate={birthdate}
        totalYears={10}
        periods={periods}
        colorMap={colorMap}
        dates={[]}
      />
    );
    // Label cells should have max-w-[5ch]
    const labelCells = container.querySelectorAll('[class*="max-w-[5ch]"]');
    expect(labelCells.length).toBeGreaterThan(0);

    // Year number cells should have w-[2em]
    const yearCells = container.querySelectorAll('[class*="w-[2em]"]');
    expect(yearCells.length).toBeGreaterThan(0);
  });

  it("renders the footer with a link to mmmotivator.com", () => {
    render(
      <WeekGrid
        birthdate={birthdate}
        totalYears={2}
        periods={periods}
        colorMap={colorMap}
        dates={[]}
      />
    );
    const link = screen.getByRole("link", { name: "mmmotivator.com" });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "https://mmmotivator.com");
    expect(link).toHaveClass("text-black", "underline");
  });

  it("does not render stars when dates array is empty", () => {
    const { container } = render(
      <WeekGrid
        birthdate={birthdate}
        totalYears={3}
        periods={periods}
        colorMap={colorMap}
        dates={[]}
      />
    );
    const stars = container.querySelectorAll("svg");
    expect(stars).toHaveLength(0);
  });
});
