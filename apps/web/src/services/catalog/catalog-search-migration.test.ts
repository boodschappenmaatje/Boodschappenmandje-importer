import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../../../../../supabase/migrations/20260915173523_catalog_search_relevance_v2.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("centrale cataloguszoekfunctie", () => {
  it("rangschikt server-side vóór begrensde paginering", () => {
    expect(migration).toMatch(/create or replace function public\.search_catalog_products_v2/i);
    expect(migration).toMatch(/relevance_score integer/i);
    expect(migration).toMatch(/order by[\s\S]*s\.score[\s\S]*limit/i);
    expect(migration).toMatch(/p_page_size integer default 20/i);
  });

  it("gebruikt generieke token-, veld- en contextsignalen", () => {
    expect(migration).toContain("name_match_count");
    expect(migration).toContain("product_type_match_count");
    expect(migration).toContain("category_match_count");
    expect(migration).toContain("brand_match_count");
    expect(migration).toContain("value_token like query_token || '%'");
  });

  it("bevat geen zoekwoordspecifieke productie-uitzonderingen", () => {
    expect(migration).not.toMatch(/\b(cola|gehakt|kip|honig)\b/i);
  });

  it("is read-only, RLS-respecterend en alleen uitvoerbaar voor browserrollen", () => {
    expect(migration).toMatch(/security invoker/i);
    expect(migration).toMatch(/grant execute[\s\S]*to anon, authenticated/i);
    expect(migration).not.toMatch(/\b(insert into|update public\.|delete from)\b/i);
  });
});
