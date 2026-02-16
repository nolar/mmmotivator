import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ImpressumPage from "../pages/ImpressumPage";

describe("ImpressumPage", () => {
  it("renders the heading", () => {
    render(
      <MemoryRouter>
        <ImpressumPage />
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Impressum / Legal Notice");
  });

  it("renders the responsible person details", () => {
    render(
      <MemoryRouter>
        <ImpressumPage />
      </MemoryRouter>,
    );
    expect(screen.getByText(/Sergey Vasilyev/)).toBeInTheDocument();
    expect(screen.getByText(/Stettiner Straße 41/)).toBeInTheDocument();
    expect(screen.getByText(/35410 Hungen/)).toBeInTheDocument();
  });

  it("renders the email link", () => {
    render(
      <MemoryRouter>
        <ImpressumPage />
      </MemoryRouter>,
    );
    const email = screen.getByRole("link", { name: "nolar@nolar.info" });
    expect(email).toHaveAttribute("href", "mailto:nolar@nolar.info");
  });

  it("renders a back link to home", () => {
    render(
      <MemoryRouter>
        <ImpressumPage />
      </MemoryRouter>,
    );
    const back = screen.getByRole("link", { name: /Back/ });
    expect(back).toHaveAttribute("href", "/");
  });

  it("renders the site footer", () => {
    const { container } = render(
      <MemoryRouter>
        <ImpressumPage />
      </MemoryRouter>,
    );
    expect(container.querySelector("footer")).toBeInTheDocument();
  });
});
