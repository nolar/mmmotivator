import { render, screen } from "@testing-library/react";
import Legend from "../components/Legend";
import type { LifePeriod } from "../types";
import { assignColors } from "../colors";

const periods: LifePeriod[] = [
  { label: "Childhood", start: "1990-06-15", end: "1997-08-31" },
  { label: "School", start: "1997-09-01", end: "2008-06-30" },
];

const colorMap = assignColors(periods);

describe("Legend", () => {
  it("renders all period labels", () => {
    render(<Legend periods={periods} colorMap={colorMap} />);
    expect(screen.getByText("Childhood")).toBeInTheDocument();
    expect(screen.getByText("School")).toBeInTheDocument();
  });

  it("renders the Unassigned label", () => {
    render(<Legend periods={periods} colorMap={colorMap} />);
    expect(screen.getByText("Unassigned")).toBeInTheDocument();
  });

  it("renders color indicators with correct classes", () => {
    const { container } = render(<Legend periods={periods} colorMap={colorMap} />);
    const childColor = colorMap.get(periods[0])!;
    const indicator = container.querySelector(`.${childColor}`);
    expect(indicator).toBeInTheDocument();
  });
});
