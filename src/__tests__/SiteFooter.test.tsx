import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import SiteFooter from "../components/SiteFooter";

describe("SiteFooter", () => {
  it("renders Impressum and Datenschutz links", () => {
    render(
      <MemoryRouter>
        <SiteFooter />
      </MemoryRouter>,
    );
    const impressum = screen.getByRole("link", { name: "Impressum" });
    expect(impressum).toHaveAttribute("href", "/impressum");

    const datenschutz = screen.getByRole("link", { name: "Datenschutz" });
    expect(datenschutz).toHaveAttribute("href", "/datenschutz");
  });

  it("has print:hidden on the footer element", () => {
    const { container } = render(
      <MemoryRouter>
        <SiteFooter />
      </MemoryRouter>,
    );
    expect(container.querySelector("footer")!.className).toContain("print:hidden");
  });
});
