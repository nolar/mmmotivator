import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi, type Mock } from "vitest";
import { toPng } from "html-to-image";
import App from "../App";

vi.mock("html-to-image", () => ({
  toPng: vi.fn(),
}));

describe("App", () => {
  it("renders the Download PNG button", () => {
    render(<App />);
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

    render(<App />);
    const button = screen.getByRole("button", { name: "Download PNG" });
    fireEvent.click(button);

    await waitFor(() => {
      expect(toPng).toHaveBeenCalledWith(expect.any(HTMLElement), {
        backgroundColor: "#ffffff",
        skipFonts: true,
      });
      expect(clickSpy).toHaveBeenCalled();
    });

    Document.prototype.createElement = origCreateElement;
  });
});
