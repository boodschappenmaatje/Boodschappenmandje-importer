import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ProductThumbnail } from "./ProductThumbnail";

describe("productfoto zonder extra catalogusverzoek", () => {
  it("toont de opgeslagen HTTPS-foto met vaste afmetingen en lazy loading", () => {
    const html = renderToStaticMarkup(createElement(ProductThumbnail, {
      imageUrl: "https://cdn.hoogvliet.com/Images/Product/XL/047977000.jpg",
      name: "Champignons", className: "shopping-item-image",
    }));
    expect(html).toContain('src="https://cdn.hoogvliet.com/Images/Product/XL/047977000.jpg"');
    expect(html).toContain('alt="Afbeelding van Champignons"');
    expect(html).toContain('loading="lazy"');
    expect(html).toContain('width="64"');
    expect(html).not.toContain("/_next/image");
  });
  it.each([null, "http://example.com/photo.jpg", "ongeldige-url"])("toont een herkenbare fallback voor %s", (imageUrl) => {
    const html = renderToStaticMarkup(createElement(ProductThumbnail, { imageUrl, name: "Paprika", className: "search-result-image" }));
    expect(html).toContain("Geen productafbeelding: Paprika");
    expect(html).not.toContain("<img");
  });
});
