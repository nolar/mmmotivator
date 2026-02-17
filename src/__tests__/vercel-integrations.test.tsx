import { render } from "@testing-library/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { Analytics } from "@vercel/analytics/react";

describe("Vercel SpeedInsights", () => {
  it("renders without crashing", () => {
    const { container } = render(<SpeedInsights />);
    expect(container).toBeDefined();
  });
});

describe("Vercel Analytics", () => {
  it("renders without crashing", () => {
    const { container } = render(<Analytics />);
    expect(container).toBeDefined();
  });
});
