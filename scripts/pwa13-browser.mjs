// Isolated browser integration test; all Supabase requests use explicit fixtures.
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const baseUrl = process.env.PWA13_BASE_URL ?? "http://localhost:3013";
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
const output = new URL("../apps/web/test-results/pwa13/", import.meta.url);
await mkdir(output, { recursive: true });
const timestamp = new Date().toISOString();
const fixtures = {
  recipes: [{ id: "recipe-pasta", source_key: "spaghetti-bolognese", name: "Zelfgemaakte spaghetti", normalized_name: "spaghetti", symbol: "fork.knife", preparation_minutes: 20, vegetarian: true, contains_pork: false, kid_friendly: true, healthy: false, budget_tier: "economical" }],
  ingredients: [{ id: "ingredient-pasta", source_key: "spaghetti", name: "spaghetti", normalized_name: "spaghetti", default_unit: "g", category: "Pasta, rijst & granen" }],
  ingredient_aliases: [{ ingredient_id: "ingredient-pasta", alias: "pasta", normalized_alias: "pasta" }],
  recipe_ingredients: [{ id: "relation-pasta", recipe_id: "recipe-pasta", ingredient_id: "ingredient-pasta", amount_per_person: 100, unit: "g", position: 0 }],
  products: [{ id: "product-pasta", sku: "pasta", name: "Spaghetti", supermarket: "Hoogvliet", brand: "G'woon", category: "Pasta, rijst & granen/Pasta", product_type: "Pasta", package_text: "500 g", weight_grams: 500, image_url: null, source_url: "https://www.hoogvliet.com/product/spaghetti", is_available: true, updated_at: timestamp }],
  product_prices: [{ product_id: "product-pasta", price: 2, old_price: null, is_offer: false, offer_text: null, valid_from: null, valid_until: null, fetched_at: timestamp, updated_at: timestamp }],
};
fixtures.search_catalog_products_v2 = [{ product_data: fixtures.products[0], current_price: fixtures.product_prices[0] }];
try {
  for (const width of [375, 390, 430]) {
    const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true });
    const errors = [];
    const requests = [];
    await context.route("https://pwa13-test.supabase.co/**", async (route) => {
      const table = new URL(route.request().url()).pathname.split("/").pop();
      requests.push(table);
      await route.fulfill({ json: fixtures[table] ?? [] });
    });
    await context.route("**/api/planner-readiness/refresh", (route) => route.fulfill({ json: { status: "unavailable" } }));
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(baseUrl);
    await page.evaluate(async ({ timestamp }) => {
      localStorage.setItem("boodschappenmaatje:budget-settings", JSON.stringify({ schemaVersion: 1, people: 6, days: 2, budgetCents: 10000 }));
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open("boodschappenmaatje", 2);
        request.onupgradeneeded = () => { for (const name of ["week-preparations", "shopping-lists"]) if (!request.result.objectStoreNames.contains(name)) request.result.createObjectStore(name, { keyPath: "key" }); };
        request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
      });
      const preparation = {
        schemaVersion: 6, id: "browser-pwa13", createdAt: timestamp, updatedAt: timestamp, numberOfPeople: 6, numberOfDays: 2, budgetCents: 10000, mealBudgetCents: 8000,
        existingListKnownSubtotalCents: 0, existingListUnpricedCount: 0,
        categoryDistribution: { dutch: 0, pasta: 0, rice: 0, quick: 0, healthy: 0, comfort: 0, vegetarian: 0, freeChoice: 2 },
        preferences: { noVegetarian: false, quickImportant: false, healthyImportant: false, budgetImportant: true },
        days: [0, 1].map((dayIndex) => ({ dayIndex, category: "freeChoice", freeChoice: true, recipeId: null, recipe: null, status: "freeChoice" })),
        ingredients: [], generation: null, customizations: [], status: "generated", listStrategy: "preserveAndComplete",
      };
      await new Promise((resolve, reject) => {
        const tx = db.transaction(["week-preparations", "shopping-lists"], "readwrite");
        tx.objectStore("week-preparations").put({ key: "active", schemaVersion: 6, preparation });
        tx.objectStore("shopping-lists").put({ key: "active", schemaVersion: 2, list: { schemaVersion: 2, startedAt: timestamp, updatedAt: timestamp, items: [] } });
        tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
      }); db.close();
    }, { timestamp });
    await page.goto(`${baseUrl}/week-voorbereiden`);
    const day = page.getByRole("region", { name: "Vrije keuze dag 1", exact: true });
    await day.getByRole("button", { name: "Maak zelf een gerecht", exact: true }).click();
    await day.getByLabel("Naam van je gerecht", { exact: true }).fill("Pasta van mij");
    await day.getByRole("button", { name: "Ingrediënt toevoegen", exact: true }).click();
    await day.getByRole("group", { name: "Ingrediënt", exact: true }).getByLabel("Naam", { exact: true }).fill("pasta");
    await day.getByLabel("Hoeveelheid", { exact: true }).fill("600");
    await day.getByLabel("Eenheid", { exact: true }).selectOption("g").catch(async (error) => { console.error(await page.locator("body").innerText(), errors); throw error; });
    await day.getByRole("button", { name: "Ingrediënt toevoegen", exact: true }).click();
    await day.getByRole("group", { name: "Ingrediënt", exact: true }).last().getByRole("button", { name: "Ingrediënt verwijderen" }).click();
    assert.equal(await day.getByRole("group", { name: "Ingrediënt", exact: true }).count(), 1);
    await day.getByRole("button", { name: "Controleer producten en prijs" }).click();
    await day.getByRole("button", { name: "Gerecht opslaan voor deze dag" }).waitFor().catch(async (error) => { console.error(await day.innerText(), errors, requests); throw error; });
    const budget = day.locator(".dish-budget-summary").last();
    const budgetBox = await budget.boundingBox();
    assert.ok(budgetBox && budgetBox.y >= 0 && budgetBox.y < 700, "budget directly visible after choice");
    await budget.getByRole("button", { name: "Bekijk ingrediënten" }).click();
    assert.match(await budget.locator(".recipe-ingredients").innerText(), /600 g nodig/);
    assert.match(await budget.locator(".recipe-ingredients").innerText(), /500 g/);
    assert.match(await day.innerText(), /2 verpakking/);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: new URL(`custom-${width}.png`, output).pathname.replace(/^\/(\w:)/, "$1"), fullPage: true });
    await day.getByRole("button", { name: "Gerecht opslaan voor deze dag" }).click();
    await page.getByText("Pasta van mij", { exact: true }).first().waitFor();
    await page.reload();
    await page.getByText("Pasta van mij", { exact: true }).first().waitFor();
    await page.locator(".recipe-detail > summary").first().click();
    await day.getByRole("button", { name: "Zoek gerecht of maaltijdmix", exact: true }).click();
    await day.getByRole("searchbox").fill("spaghetti");
    await day.getByRole("button", { name: "Gebruik dit gerecht", exact: true }).first().waitFor();
    await page.screenshot({ path: new URL(`search-${width}.png`, output).pathname.replace(/^\/(\w:)/, "$1"), fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await day.getByRole("button", { name: "Gebruik dit gerecht", exact: true }).first().click();
    await day.locator(".dish-budget-summary").last().getByRole("button", { name: "Bekijk ingrediënten" }).click();
    const chosenCards = await day.locator(".dish-budget-summary .recipe-ingredients").innerText();
    await day.getByRole("button", { name: "Gerecht opslaan voor deze dag" }).click();
    await page.getByText("Zelfgemaakte spaghetti", { exact: true }).first().waitFor();
    await page.reload();
    await page.getByText("Zelfgemaakte spaghetti", { exact: true }).first().waitFor();
    await page.locator(".recipe-detail > summary").first().click();
    const activeCards = await page.locator(".recipe-detail .recipe-ingredients").first().innerText();
    for (const text of ["600 g nodig", "500 g", "2 verpakkingen"]) { assert.ok(chosenCards.includes(text)); assert.ok(activeCards.includes(text)); }
    const imageState = await page.locator(".recipe-detail .recipe-summary-image").first().getAttribute("data-image-source");
    await page.goto(baseUrl);
    const homeImage = page.locator(".meal-day-card").filter({ hasText: "Zelfgemaakte spaghetti" }).locator(".meal-day-image");
    await homeImage.waitFor();
    assert.equal(await homeImage.getAttribute("data-image-source"), imageState);
    assert.equal(await homeImage.getAttribute("data-has-image"), "true");
    await page.reload();
    await homeImage.waitFor();
    assert.equal(await homeImage.getAttribute("data-image-source"), imageState);
    await page.screenshot({ path: new URL(`home-${width}.png`, output).pathname.replace(/^\/(\w:)/, "$1"), fullPage: true });
    await homeImage.locator("img").dispatchEvent("error");
    assert.equal(await homeImage.getAttribute("data-has-image"), "false");
    assert.equal(await homeImage.locator("svg").count(), 1);
    await page.goto(`${baseUrl}/lijst`);
    await page.getByText("Spaghetti", { exact: true }).first().waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ width, editor: "pass", search: "pass", persistence: "pass", homeImage: "pass", brokenImageFallback: "pass", budgetAtTop: "pass", sharedIngredientCards: "pass", replacement: "pass", shoppingList: "pass", overflow: false, pageErrors: errors }));
    await context.close();
  }
} finally { await browser.close(); }
