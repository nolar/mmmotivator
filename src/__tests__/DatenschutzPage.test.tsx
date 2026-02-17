import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import DatenschutzPage from "../pages/DatenschutzPage";

describe("DatenschutzPage", () => {
  it("renders the heading", () => {
    render(
      <MemoryRouter>
        <DatenschutzPage />
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Datenschutz");
  });

  it("renders the privacy policy content with prose styling", () => {
    const { container } = render(
      <MemoryRouter>
        <DatenschutzPage />
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { name: /Präambel/ })).toBeInTheDocument();
    expect(container.querySelector("article.prose")).toBeInTheDocument();
  });

  it("renders a back link to home", () => {
    render(
      <MemoryRouter>
        <DatenschutzPage />
      </MemoryRouter>,
    );
    const back = screen.getByRole("link", { name: /Back/ });
    expect(back).toHaveAttribute("href", "/");
  });

  it("renders the site footer", () => {
    const { container } = render(
      <MemoryRouter>
        <DatenschutzPage />
      </MemoryRouter>,
    );
    expect(container.querySelector("footer")).toBeInTheDocument();
  });
});
