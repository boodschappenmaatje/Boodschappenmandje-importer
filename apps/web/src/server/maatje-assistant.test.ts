import { describe, expect, it, vi } from "vitest";
import type { CatalogRepository } from "@/services/catalog/catalog-repository";
import type { Product } from "@/types/catalog";
import { buildGeminiBody, geminiCaller, parseAssistantRequest, parseGeminiPlan, flashModels, pickFlashModel, runMaatjeAssistant, withQuickThinking } from "./maatje-assistant";

const NOW = new Date("2026-10-15T12:00:00Z");

function product(id: string, name: string, price: number | null = 1.29, isAvailable: boolean | null = true): Product {
  return {
    id, supermarket: "Hoogvliet", sku: `sku-${id}`, name, brand: null, category: null, productType: null,
    packageText: "1 liter", weightGrams: null, imageUrl: null, sourceUrl: "https://www.hoogvliet.com", isAvailable,
    updatedAt: "2026-10-14T00:00:00Z",
    currentPrice: price === null ? null : {
      productId: id, price, oldPrice: null, isOffer: false, offerText: null, validFrom: null, validUntil: null,
      fetchedAt: "2026-10-14T00:00:00Z", updatedAt: "2026-10-14T00:00:00Z",
    },
  };
}

function catalogWith(results: Record<string, Product[]>): CatalogRepository {
  return {
    query: vi.fn(async (request: { term?: string } = {}) => ({
      products: results[request.term ?? ""] ?? [], priceStatus: "complete", page: 1, pageSize: 12, hasMore: false,
      query: { term: request.term ?? "", category: null, brand: null, offersOnly: false, maxPrice: null, sort: "relevance" },
    })),
  } as unknown as CatalogRepository;
}

const gemini = (plan: unknown) => vi.fn(async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(plan) }] } }] }));

const baseRequest = { text: "melk", history: [], context: {} };

describe("parseAssistantRequest", () => {
  it("accepts text and cleans up the context", () => {
    const request = parseAssistantRequest({
      text: "  ik heb   melk nodig ",
      history: [{ role: "user", text: "hoi" }, { role: "hacker", text: "x" }],
      context: { list: [{ name: "Brood", quantity: 2, priceCents: 249 }, { quantity: 1 }], budget: { budgetCents: 5000, plannedCents: 1200 } },
    });
    expect(request?.text).toBe("ik heb melk nodig");
    expect(request?.history).toEqual([{ role: "user", text: "hoi" }]);
    expect(request?.context.list).toEqual([{ name: "Brood", packageText: null, quantity: 2, priceCents: 249 }]);
    expect(request?.context.budget.budgetCents).toBe(5000);
  });

  it("rejects requests without text or audio, and unknown audio types", () => {
    expect(parseAssistantRequest({ text: "   " })).toBeNull();
    expect(parseAssistantRequest({ audio: { data: "AAAA", mimeType: "video/mp4" } })).toBeNull();
    expect(parseAssistantRequest({ audio: { data: "not base64!", mimeType: "audio/mp4" } })).toBeNull();
  });

  it("accepts iPhone audio and strips codec parameters", () => {
    const request = parseAssistantRequest({ audio: { data: "AAAA", mimeType: "audio/mp4;codecs=mp4a" } });
    expect(request?.audio).toEqual({ data: "AAAA", mimeType: "audio/mp4" });
  });
});

describe("buildGeminiBody", () => {
  it("sends audio inline with the context and asks for JSON", () => {
    const request = parseAssistantRequest({ audio: { data: "AAAA", mimeType: "audio/webm" }, history: [{ role: "maatje", text: "Hoi" }] })!;
    const body = buildGeminiBody(request) as { contents: { role: string; parts: Record<string, unknown>[] }[]; generationConfig: { responseMimeType: string } };
    expect(body.generationConfig.responseMimeType).toBe("application/json");
    expect(body.contents[0].role).toBe("model");
    expect(body.contents[1].parts.some(part => "inlineData" in part)).toBe(true);
  });
});

describe("parseGeminiPlan", () => {
  it("returns null for anything that is not the agreed JSON", () => {
    expect(parseGeminiPlan({})).toBeNull();
    expect(parseGeminiPlan({ candidates: [{ content: { parts: [{ text: "geen json" }] } }] })).toBeNull();
  });

  it("caps items and quantities", () => {
    const items = Array.from({ length: 12 }, (_, index) => ({ label: `ding ${index}`, quantity: 99, terms: ["a"] }));
    const plan = parseGeminiPlan({ candidates: [{ content: { parts: [{ text: JSON.stringify({ heard: "x", reply: "y", items }) }] } }] });
    expect(plan?.items).toHaveLength(10);
    expect(plan?.items[0].quantity).toBe(20);
  });
});

describe("runMaatjeAssistant", () => {
  it("only shows real catalog products, at most five, skipping unavailable ones", async () => {
    const products = [
      product("1", "Halfvolle melk"), product("2", "Volle melk", 1.49), product("3", "Uitverkocht", 1, false),
      product("4", "Magere melk"), product("5", "Karnemelk"), product("6", "Chocolademelk"), product("7", "Lactosevrije melk"),
    ];
    const result = await runMaatjeAssistant(
      parseAssistantRequest(baseRequest)!,
      gemini({ heard: "Melk", reply: "Een Hoogvliet halfvolle melk van € 0,99!", items: [{ label: "melk", quantity: 2, terms: ["melk"] }] }),
      catalogWith({ melk: products }),
      NOW,
    );
    expect(result.items[0].choices.map(choice => choice.product.id)).toEqual(["1", "2", "4", "5", "6"]);
    expect(result.items[0].choices[1].priceCents).toBe(149);
    expect(result.items[0].quantity).toBe(2);
    // Gemini's eigen productzin wordt vervangen: Maatje noemt geen verzonnen prijzen.
    expect(result.reply).not.toContain("€");
  });

  it("falls back to a broader term when the precise one finds too little", async () => {
    const catalog = catalogWith({ "biologische halfvolle melk": [product("1", "Bio halfvolle melk")], melk: [product("2", "Halfvolle melk")] });
    const result = await runMaatjeAssistant(
      parseAssistantRequest(baseRequest)!,
      gemini({ heard: "x", reply: "y", items: [{ label: "bio melk", quantity: 1, terms: ["biologische halfvolle melk", "melk"] }] }),
      catalog,
      NOW,
    );
    expect(result.items[0].choices.map(choice => choice.product.id)).toEqual(["1", "2"]);
  });

  it("says honestly when nothing was found", async () => {
    const result = await runMaatjeAssistant(
      parseAssistantRequest(baseRequest)!,
      gemini({ heard: "x", reply: "y", items: [{ label: "draak", quantity: 1, terms: ["draak"] }] }),
      catalogWith({}),
      NOW,
    );
    expect(result.items[0].choices).toEqual([]);
    expect(result.reply).toContain("draak niet vinden");
  });

  it("helps with a recipe: all ingredients as real choices", async () => {
    const result = await runMaatjeAssistant(
      parseAssistantRequest({ text: "ik maak lasagne" })!,
      gemini({ heard: "Ik maak lasagne", reply: "x", recipe: "lasagne", items: [
        { label: "lasagnebladen", quantity: 1, terms: ["lasagnebladen"] },
        { label: "rundergehakt", quantity: 1, terms: ["rundergehakt"] },
      ] }),
      catalogWith({ lasagnebladen: [product("1", "Lasagnebladen"), product("2", "Verse lasagne")], rundergehakt: [product("3", "Rundergehakt"), product("4", "Biologisch rundergehakt")] }),
      NOW,
    );
    expect(result.items.map(item => item.label)).toEqual(["lasagnebladen", "rundergehakt"]);
    expect(result.reply).toBe("Voor lasagne heb je dit nodig. Tik aan wat je nog niet in huis hebt!");
  });

  it("keeps Gemini's answer for questions without products", async () => {
    const result = await runMaatjeAssistant(
      parseAssistantRequest({ text: "wat eten we woensdag?" })!,
      gemini({ heard: "Wat eten we woensdag?", reply: "Woensdag eten jullie macaroni.", items: [] }),
      catalogWith({}),
      NOW,
    );
    expect(result).toEqual({ heard: "Wat eten we woensdag?", reply: "Woensdag eten jullie macaroni.", items: [] });
  });

  it("fails when Gemini answers in the wrong format", async () => {
    await expect(runMaatjeAssistant(parseAssistantRequest(baseRequest)!, vi.fn(async () => ({})), catalogWith({}), NOW)).rejects.toThrow();
  });
});

describe("Gemini model", () => {
  const models = { models: [
    { name: "models/gemini-3.5-flash", supportedGenerationMethods: ["generateContent"] },
    { name: "models/gemini-3.8-flash", supportedGenerationMethods: ["generateContent"] },
    { name: "models/gemini-3.8-flash-live", supportedGenerationMethods: ["bidiGenerateContent"] },
    { name: "models/gemini-4.0-flash-preview-tts", supportedGenerationMethods: ["generateContent"] },
    { name: "models/text-embedding-004", supportedGenerationMethods: ["embedContent"] },
  ] };

  it("picks the newest plain flash model", () => {
    expect(pickFlashModel(models)).toBe("gemini-3.8-flash");
    expect(pickFlashModel({})).toBeNull();
  });

  it("puts the fast lite models first", () => {
    const withLite = { models: [...models.models, { name: "models/gemini-3.5-flash-lite", supportedGenerationMethods: ["generateContent"] }] };
    expect(flashModels(withLite)).toEqual(["gemini-3.5-flash-lite", "gemini-3.8-flash", "gemini-3.5-flash"]);
  });

  it("asks for short thinking so Maatje answers quickly", () => {
    const body = { generationConfig: { temperature: 0.3 } };
    expect(withQuickThinking("gemini-3.8-flash", body)).toEqual({ generationConfig: { temperature: 0.3, thinkingConfig: { thinkingLevel: "minimal" } } });
    expect(withQuickThinking("gemini-2.5-flash", body)).toEqual({ generationConfig: { temperature: 0.3, thinkingConfig: { thinkingBudget: 0 } } });
  });

  it("tries another model when Google is too busy", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.includes("gemini-3.8-flash:")) return new Response("overloaded", { status: 503 });
      if (url.endsWith("/models?pageSize=200")) return Response.json(models);
      return Response.json({ model: url.includes("gemini-3.5-flash:") ? "3.5" : "?" });
    });
    const call = geminiCaller("sleutel", "gemini-3.8-flash", fetchImpl as unknown as typeof fetch);
    await expect(call({})).resolves.toEqual({ model: "3.5" });
  });

  it("switches to an existing model when the configured one is gone", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.includes("oud-model")) return new Response("", { status: 404 });
      if (url.endsWith("/models?pageSize=200")) return Response.json(models);
      return Response.json({ ok: url.includes(":generateContent") });
    });
    const call = geminiCaller("sleutel", "oud-model", fetchImpl as unknown as typeof fetch);
    await expect(call({})).resolves.toEqual({ ok: true });
  });
});
