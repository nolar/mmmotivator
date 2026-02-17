import html from "../../index.html?raw";

describe("index.html meta tags", () => {

  it("has the correct title", () => {
    expect(html).toMatch(/<title>Memento Mori Motivator<\/title>/);
  });

  it("has a meta description", () => {
    expect(html).toMatch(
      /<meta name="description" content="Visualize your life in weeks" \/>/
    );
  });

  it("has Open Graph title", () => {
    expect(html).toMatch(
      /<meta property="og:title" content="Memento Mori Motivator" \/>/
    );
  });

  it("has Open Graph description", () => {
    expect(html).toMatch(
      /<meta property="og:description" content="Visualize your life in weeks" \/>/
    );
  });

  it("has Open Graph type", () => {
    expect(html).toMatch(/<meta property="og:type" content="website" \/>/);
  });

  it("has Twitter card type", () => {
    expect(html).toMatch(/<meta name="twitter:card" content="summary" \/>/);
  });

  it("has Twitter title", () => {
    expect(html).toMatch(
      /<meta name="twitter:title" content="Memento Mori Motivator" \/>/
    );
  });

  it("has Twitter description", () => {
    expect(html).toMatch(
      /<meta name="twitter:description" content="Visualize your life in weeks" \/>/
    );
  });
});
