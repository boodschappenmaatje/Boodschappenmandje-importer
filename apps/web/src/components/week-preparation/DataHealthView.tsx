"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useWeekPreparation } from "@/features/week-preparation/WeekPreparationProvider";
import { createCatalogRepository } from "@/services/catalog/catalog-repository";
import { enrichIngredientsForMealMixes } from "@/services/week-preparation/meal-mix-profiles";
import {
  evaluateRecipeReadiness,
  type RecipeReadinessGateResult,
  type RecipeReadinessIssueOrigin,
  type RecipeReadinessReason,
} from "@/services/week-preparation/recipe-readiness";
import { createRecipeRepository } from "@/services/week-preparation/recipe-repository";
import { recipeCategories } from "@/services/week-preparation/recipe-selection";
import { MEAL_CATEGORY_LABELS } from "@/services/week-preparation/week-preparation";
import type { Recipe } from "@/types/catalog";
import type { RecipeMealCategory } from "@/types/week-preparation";

const CATEGORY_ORDER: RecipeMealCategory[] = [
  "dutch",
  "pasta",
  "rice",
  "quick",
  "healthy",
  "comfort",
  "vegetarian",
];

const REASON_LABELS: Record<RecipeReadinessReason, string> = {
  ingredient_invalid: "Ingrediëntdefinitie is ongeldig",
  no_catalog_product: "Nog geen geschikt catalogusproduct",
  matcher_failed: "Geschikt product gevonden, maar koppeling faalt",
  low_confidence_match: "Geen match met voldoende zekerheid",
  missing_price: "Bruikbare prijs ontbreekt",
  package_unknown: "Verpakkingsaantal is niet berekenbaar",
  quantity_conversion_failed: "Hoeveelheid kan niet worden omgerekend",
  product_reference_invalid: "Productreferentie is ongeldig",
  category_mismatch: "Productcategorie past niet bij het ingrediënt",
  alias_missing: "Zoekalias ontbreekt",
};

const ORIGIN_LABELS: Record<RecipeReadinessIssueOrigin, string> = {
  catalogCoverage: "Catalogusdekking",
  softwareOrMatching: "Software / matching",
  recipeData: "Receptdata",
};

interface DataHealthResult {
  gate: RecipeReadinessGateResult;
  recipes: Recipe[];
  checkedAt: string;
}

async function loadDataHealth(numberOfPeople: number): Promise<DataHealthResult> {
  const loaded = await createRecipeRepository().loadCatalog();
  const catalog = {
    ...loaded,
    ingredients: enrichIngredientsForMealMixes(loaded.ingredients),
  };
  const gate = await evaluateRecipeReadiness(
    catalog.recipes,
    numberOfPeople,
    catalog,
    createCatalogRepository(),
  );
  return { gate, recipes: catalog.recipes, checkedAt: new Date().toISOString() };
}

export function DataHealthView() {
  const week = useWeekPreparation();
  const numberOfPeople = week.preparation?.numberOfPeople ?? 4;
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [result, setResult] = useState<DataHealthResult | null>(null);

  const runCheck = useCallback(async () => {
    setStatus("loading");
    try {
      setResult(await loadDataHealth(numberOfPeople));
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, [numberOfPeople]);

  const retry = useCallback(() => {
    void runCheck();
  }, [runCheck]);

  useEffect(() => {
    let active = true;
    void loadDataHealth(numberOfPeople)
      .then((next) => {
        if (!active) return;
        setResult(next);
        setStatus("ready");
      })
      .catch(() => {
        if (active) setStatus("error");
      });
    return () => {
      active = false;
    };
  }, [numberOfPeople]);

  const summary = useMemo(() => {
    if (!result) return null;
    const recipeById = new Map(result.recipes.map((recipe) => [recipe.id, recipe]));
    const required = result.gate.recipes.reduce(
      (total, recipe) => total + recipe.requiredIngredientCount,
      0,
    );
    const readyRequired = result.gate.recipes.reduce(
      (total, recipe) => total + recipe.readyRequiredIngredientCount,
      0,
    );
    const origins = result.gate.recipes
      .flatMap((recipe) => recipe.ingredients)
      .reduce<Record<RecipeReadinessIssueOrigin, number>>(
        (counts, ingredient) => {
          if (ingredient.origin) counts[ingredient.origin] += 1;
          return counts;
        },
        { catalogCoverage: 0, softwareOrMatching: 0, recipeData: 0 },
      );
    const categories = CATEGORY_ORDER.map((category) => {
      const candidates = result.gate.recipes.filter((readiness) => {
        const recipe = recipeById.get(readiness.recipeId);
        return recipe ? recipeCategories(recipe).includes(category) : false;
      });
      return {
        category,
        candidates: candidates.length,
        ready: candidates.filter((candidate) => candidate.ready).length,
      };
    });
    return { required, readyRequired, origins, categories };
  }, [result]);

  if (status === "loading") {
    return (
      <section className="data-health-card" aria-busy="true">
        <h2>Actuele receptcontrole loopt…</h2>
        <p>We controleren recepten tegen de huidige Hoogvliet-catalogus voor {numberOfPeople} personen.</p>
      </section>
    );
  }

  if (status === "error" || !result || !summary) {
    return (
      <section className="data-health-card" role="alert">
        <h2>Data Health kon niet worden uitgevoerd</h2>
        <p>De bestaande week en boodschappenlijst zijn niet gewijzigd.</p>
        <button className="secondary-action" type="button" onClick={retry}>
          Opnieuw controleren
        </button>
      </section>
    );
  }

  return (
    <div className="data-health-stack">
      <section className="data-health-card data-health-summary">
        <div>
          <span>Recepten READY</span>
          <strong>{result.gate.recipes.filter((recipe) => recipe.ready).length} / {result.gate.recipes.length}</strong>
        </div>
        <div>
          <span>Verplichte ingrediënten READY</span>
          <strong>{summary.readyRequired} / {summary.required}</strong>
        </div>
        <div>
          <span>Personen</span>
          <strong>{numberOfPeople}</strong>
        </div>
        <button className="secondary-action" type="button" onClick={retry}>
          Opnieuw controleren
        </button>
      </section>

      <section className="data-health-card">
        <h2>Dekking per weekcategorie</h2>
        <ul className="data-health-coverage">
          {summary.categories.map((item) => (
            <li key={item.category} data-ready={item.ready > 0}>
              <span>{MEAL_CATEGORY_LABELS[item.category]}</span>
              <strong>{item.ready} / {item.candidates} READY</strong>
            </li>
          ))}
        </ul>
      </section>

      <section className="data-health-card">
        <h2>Probleemclassificatie</h2>
        <div className="data-health-origins">
          {(Object.entries(summary.origins) as [RecipeReadinessIssueOrigin, number][]).map(
            ([origin, count]) => (
              <div key={origin}>
                <span>{ORIGIN_LABELS[origin]}</span>
                <strong>{count}</strong>
              </div>
            ),
          )}
        </div>
      </section>

      <section className="data-health-recipes" aria-label="Readiness per recept">
        {result.gate.recipes.map((recipe) => (
          <details className="data-health-recipe" key={recipe.recipeId}>
            <summary>
              <span>
                <strong>{recipe.recipeName}</strong>
                <small>{recipe.readyRequiredIngredientCount} / {recipe.requiredIngredientCount} verplichte ingrediënten READY</small>
              </span>
              <b data-ready={recipe.ready}>{recipe.ready ? "READY" : "NOT READY"}</b>
            </summary>
            <ul>
              {recipe.ingredients.map((ingredient) => (
                <li key={`${recipe.recipeId}:${ingredient.ingredientId}:${ingredient.sourceKey}`} data-ready={ingredient.ready}>
                  <div>
                    <strong>{ingredient.name}</strong>
                    <span>{ingredient.required ? "Verplicht" : "Optioneel"} · {ingredient.requiredQuantity ?? "—"} {ingredient.unit ?? ""}</span>
                  </div>
                  <dl>
                    <div><dt>Catalogusproduct</dt><dd>{ingredient.catalogProductAvailable ? "ja" : "nee"}</dd></div>
                    <div><dt>Betrouwbare match</dt><dd>{ingredient.reliableProductMatch ? "ja" : "nee"}</dd></div>
                    <div><dt>Prijs</dt><dd>{ingredient.priceKnown ? "ja" : "nee"}</dd></div>
                    <div><dt>Verpakking</dt><dd>{ingredient.packageCalculable ? "ja" : "nee"}</dd></div>
                  </dl>
                  {ingredient.reason ? (
                    <p>
                      <strong>{ORIGIN_LABELS[ingredient.origin ?? "recipeData"]}:</strong>{" "}
                      {REASON_LABELS[ingredient.reason]} <code>{ingredient.reason}</code>
                    </p>
                  ) : (
                    <p>{ingredient.productName} · {ingredient.sku}</p>
                  )}
                </li>
              ))}
            </ul>
          </details>
        ))}
      </section>
      <p className="data-health-timestamp">
        Actueel gecontroleerd: {new Date(result.checkedAt).toLocaleString("nl-NL")}
      </p>
    </div>
  );
}
