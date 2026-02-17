import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi, type Mock } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { toPng } from "html-to-image";
import App from "../App";

vi.mock("html-to-image", () => ({
  toPng: vi.fn(),
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
    expect(screen.getByText(/support the author with bread & beer/)).toBeInTheDocument();
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
