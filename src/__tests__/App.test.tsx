import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi, type Mock } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { toPng } from "html-to-image";
import App from "../App";

vi.mock("html-to-image", () => ({
  toPng: vi.fn(),
}));

vi.mock("../storage", () => ({
  loadConfig: vi.fn(() => null),
  saveConfig: vi.fn(),
  exportConfigFile: vi.fn(),
  importConfigFile: vi.fn(),
}));

describe("App", () => {
  it("renders the Download PNG button", () => {
    render(<MemoryRouter><App /></MemoryRouter>);
    expect(screen.getByRole("button", { name: "Download PNG" })).toBeInTheDocument();
  });

  it("calls toPng and triggers download on click", async () => {
    const fakeDataUrl = "data:image/png;base64,fake";
    (toPng as Mock).mockResolvedValue(fakeDataUrl);

    const clickSpy = vi.fn();
    const origCreateElement = Document.prototype.createElement;
    Document.prototype.createElement = function (this: Document, tag: string) {
      const el = origCreateElement.call(this, tag);
      if (tag === "a") {
        el.click = clickSpy;
      }
      return el;
    } as typeof origCreateElement;

    render(<MemoryRouter><App /></MemoryRouter>);
    const button = screen.getByRole("button", { name: "Download PNG" });
    fireEvent.click(button);

    await waitFor(() => {
      expect(toPng).toHaveBeenCalledWith(expect.any(HTMLElement), {
        backgroundColor: "#ffffff",
        skipFonts: true,
        pixelRatio: 2,
      });
      expect(clickSpy).toHaveBeenCalled();
    });

    Document.prototype.createElement = origCreateElement;
  });

  it("applies print:hidden to sidebars and action buttons", () => {
    const { container } = render(<MemoryRouter><App /></MemoryRouter>);

    // Both aside elements (config form + date form) should have print:hidden
    const asides = container.querySelectorAll("aside");
    for (const aside of asides) {
      expect(aside.className).toContain("print:hidden");
    }

    // The button bar container should have print:hidden
    const downloadBtn = screen.getByRole("button", { name: "Download PNG" });
    expect(downloadBtn.parentElement!.className).toContain("print:hidden");
  });

  it("renders sponsor links with correct hrefs", () => {
    render(<MemoryRouter><App /></MemoryRouter>);

    const github = screen.getByRole("link", { name: "Sponsor via GitHub" });
    expect(github).toHaveAttribute("href", "https://github.com/sponsors/nolar/");
    expect(github).toHaveAttribute("target", "_blank");

    const paypal = screen.getByRole("link", { name: "Sponsor via PayPal" });
    expect(paypal).toHaveAttribute("href", "https://paypal.me/nolarinfo");
    expect(paypal).toHaveAttribute("target", "_blank");

    const coffee = screen.getByRole("link", { name: "Buy Me a Coffee" });
    expect(coffee).toHaveAttribute("href", "https://buymeacoffee.com/nolar");
    expect(coffee).toHaveAttribute("target", "_blank");
  });

  it("renders sponsor intro text", () => {
    render(<MemoryRouter><App /></MemoryRouter>);
    expect(screen.getByText(/support the author with cakes & coffee/)).toBeInTheDocument();
  });

  it("renders Show today checkbox checked by default", () => {
    render(<MemoryRouter><App /></MemoryRouter>);
    const checkbox = screen.getByRole("checkbox", { name: "Show today" });
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).toBeChecked();
  });

  it("adds a star for today when Show today is checked", () => {
    const { container } = render(<MemoryRouter><App /></MemoryRouter>);
    const starsWithToday = container.querySelectorAll("svg").length;
    const checkbox = screen.getByRole("checkbox", { name: "Show today" });
    fireEvent.click(checkbox);
    const starsWithout = container.querySelectorAll("svg").length;
    expect(starsWithToday).toBe(starsWithout + 1);
  });

  it("unchecks Show today checkbox on click", () => {
    render(<MemoryRouter><App /></MemoryRouter>);
    const checkbox = screen.getByRole("checkbox", { name: "Show today" });
    fireEvent.click(checkbox);
    expect(checkbox).not.toBeChecked();
  });

  it("renders the Copy link button", () => {
    render(<MemoryRouter><App /></MemoryRouter>);
    expect(screen.getByRole("button", { name: "Copy link" })).toBeInTheDocument();
  });

  it("applies print layout classes to root containers", () => {
    const { container } = render(<MemoryRouter><App /></MemoryRouter>);
    const root = container.firstElementChild!;
    expect(root.className).toContain("print:p-0");
    expect(root.className).toContain("print:min-w-0");

    const main = container.querySelector("main")!;
    expect(main.className).toContain("print:w-full");
    expect(main.className).toContain("print:mx-auto");
  });
});
