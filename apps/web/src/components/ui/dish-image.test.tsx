import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DishImage } from "@/components/ui/DishImage";

describe("DishImage", () => {
  it("toont een rustige placeholder zonder kapotte afbeeldingsbron", () => {
    const html = renderToStaticMarkup(
      createElement(DishImage, {
        asset: null,
        title: "Vrije keuze",
        className: "meal-day-image",
        sizes: "100px",
      }),
    );

    expect(html).toContain('data-image-source="placeholder"');
    expect(html).toContain('data-has-image="false"');
    expect(html).not.toContain("<img");
  });
});
