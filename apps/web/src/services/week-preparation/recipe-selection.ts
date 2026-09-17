import type { Recipe } from "@/types/catalog";
import type {
  PreparedDay,
  RecipeMealCategory,
  WeekPreferences,
} from "@/types/week-preparation";

const PASTA_WORDS = [
  "pasta",
  "spaghetti",
  "macaroni",
  "lasagne",
  "penne",
  "tagliatelle",
  "tortellini",
  "ravioli",
  "orzo",
];

const RICE_WORDS = [
  "rijst",
  "nasi",
  "risotto",
  "curry",
  "poké",
  "poke",
  "biryani",
];

const DUTCH_WORDS = [
  "aardappel",
  "stamppot",
  "hutspot",
  "boerenkool",
  "zuurkool",
  "andijvie",
  "rookworst",
  "gehaktbal",
  "sperziebonen",
  "bloemkool",
  "doperwten",
  "ovenschotel",
];

const COMFORT_WORDS = [
  "friet",
  "patat",
  "pizza",
  "burger",
  "kapsalon",
  "shoarma",
  "hotdog",
  "pannenkoek",
  "tosti",
  "nacho",
  "nugget",
  "snack",
];

function normalizedRecipeText(recipe: Recipe): string {
  return `${recipe.sourceKey} ${recipe.normalizedName} ${recipe.name}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("nl-NL");
}

function includesAny(text: string, words: string[]): boolean {
  return words.some((word) => text.includes(word));
}

export function recipeCategories(recipe: Recipe): RecipeMealCategory[] {
  const text = normalizedRecipeText(recipe);
  const categories = new Set<RecipeMealCategory>();

  if (includesAny(text, PASTA_WORDS)) categories.add("pasta");
  if (includesAny(text, RICE_WORDS)) categories.add("rice");
  if (includesAny(text, DUTCH_WORDS)) categories.add("dutch");
  if (recipe.preparationMinutes <= 25) categories.add("quick");
  if (recipe.healthy) categories.add("healthy");
  if (!recipe.healthy || includesAny(text, COMFORT_WORDS)) categories.add("comfort");
  if (recipe.vegetarian) categories.add("vegetarian");

  return [...categories];
}

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function recipePreferenceScore(recipe: Recipe, preferences: WeekPreferences): number {
  let score = 0;
  if (preferences.quickImportant && recipe.preparationMinutes <= 25) score += 80;
  if (preferences.healthyImportant && recipe.healthy) score += 70;
  if (preferences.budgetImportant) {
    score += recipe.budgetTier === "economical" ? 60 : recipe.budgetTier === "standard" ? 20 : 0;
  }
  if (recipe.kidFriendly) score += 10;
  return score;
}

export function rankedReadyRecipesForDay(
  day: PreparedDay,
  recipes: Recipe[],
  preferences: WeekPreferences,
  seed: string,
  readyRecipes: ReadonlySet<string>,
): Recipe[] {
  if (day.freeChoice || day.category === "freeChoice") return [];
  return suitableRecipes(recipes, day.category, preferences)
    .filter((recipe) => readyRecipes.has(recipe.id))
    .toSorted((left, right) => {
      const preferenceDifference =
        recipePreferenceScore(right, preferences) -
        recipePreferenceScore(left, preferences);
      if (preferenceDifference) return preferenceDifference;
      const leftHash = stableHash(`${seed}:${day.dayIndex}:${left.sourceKey}`);
      const rightHash = stableHash(`${seed}:${day.dayIndex}:${right.sourceKey}`);
      return leftHash - rightHash || left.sourceKey.localeCompare(right.sourceKey);
    });
}

export function suitableRecipes(
  recipes: Recipe[],
  category: RecipeMealCategory,
  preferences: WeekPreferences,
): Recipe[] {
  return recipes.filter((recipe) => {
    if (!recipeCategories(recipe).includes(category)) return false;
    if (
      preferences.noVegetarian &&
      category !== "vegetarian" &&
      recipe.vegetarian
    ) {
      return false;
    }
    return true;
  });
}

export function candidateRecipesForDays(
  days: PreparedDay[],
  recipes: Recipe[],
  preferences: WeekPreferences,
): Recipe[] {
  const candidates = new Map<string, Recipe>();
  for (const day of days) {
    if (day.freeChoice || day.category === "freeChoice") continue;
    for (const recipe of suitableRecipes(recipes, day.category, preferences)) {
      candidates.set(recipe.id, recipe);
    }
  }
  return [...candidates.values()];
}

export function selectRecipesForDays(
  days: PreparedDay[],
  recipes: Recipe[],
  preferences: WeekPreferences,
  seed: string,
  readyRecipes: ReadonlySet<string>,
): PreparedDay[] {
  const usedRecipeIds = new Set<string>();

  return days.map((day) => {
    if (day.freeChoice || day.category === "freeChoice") {
      return {
        ...day,
        freeChoice: true,
        recipeId: null,
        recipe: null,
        status: "freeChoice",
      };
    }

    const candidates = rankedReadyRecipesForDay(
      day,
      recipes,
      preferences,
      seed,
      readyRecipes,
    );
    const recipe =
      candidates.find((candidate) => !usedRecipeIds.has(candidate.id)) ??
      candidates[0];

    if (!recipe) {
      return {
        ...day,
        recipeId: null,
        recipe: null,
        status: "categoryAssigned",
      };
    }

    usedRecipeIds.add(recipe.id);
    return {
      ...day,
      recipeId: recipe.id,
      recipe: {
        id: recipe.id,
        sourceKey: recipe.sourceKey,
        name: recipe.name,
      },
      status: "recipeSelected",
    };
  });
}
