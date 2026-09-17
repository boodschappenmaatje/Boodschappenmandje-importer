import type { Recipe } from "@/types/catalog";
import type { RecipeCatalog } from "@/services/week-preparation/recipe-repository";
import type { RecipeMealCategory } from "@/types/week-preparation";

export const DISH_IMAGE_KEYS = [
  "pasta-spaghetti-bolognese",
  "pasta-macaroni",
  "pasta-chicken-pesto",
  "pasta-mushroom-cream",
  "pasta-carbonara",
  "pasta-lasagne-bolognese",
  "pasta-vegetable-lasagne",
  "pasta-tortellini-tomato",
  "pasta-oven-mozzarella",
  "pasta-lentil-spinach-pesto",
  "pasta-tuna-tomato",
  "pasta-salmon-broccoli",
  "pasta-courgette",
  "pasta-arrabbiata",
  "pasta-gnocchi-spinach",
  "pasta-meatballs-tomato",
  "pasta-caprese-pesto",
  "pasta-tuna-salad",
  "dutch-hutspot-meatball",
  "dutch-boerenkool-sausage",
  "dutch-andijvie-bacon",
  "dutch-potatoes-broccoli-meatball",
  "dutch-potatoes-beans-chicken",
  "dutch-cauliflower-potatoes-egg",
  "dutch-red-cabbage-stew",
  "dutch-peas-chicken-schnitzel",
  "dutch-baby-potatoes-beans-chicken",
  "dutch-sweet-potato-spinach",
  "dutch-leek-stamppot-meatball",
  "oven-potato-leek-beef",
  "oven-fish-broccoli",
  "oven-shepherds-pie",
  "oven-cauliflower-beef",
  "oven-broccoli-chicken",
  "oven-sauerkraut-beef",
  "oven-potato-gratin-vegburger",
  "comfort-fishsticks-fries",
  "comfort-hamburger-fries",
  "comfort-cheeseburger-fries",
  "comfort-chicken-nuggets-fries",
  "comfort-chicken-shawarma-pita",
  "comfort-kapsalon",
  "comfort-hotdogs",
  "comfort-pancakes",
  "comfort-toasties",
  "comfort-pizza",
  "comfort-vegetable-pizza",
  "comfort-nachos",
  "comfort-chicken-quesadilla",
  "comfort-chicken-satay-fries",
  "comfort-loaded-fries",
  "world-chicken-curry-rice",
  "world-nasi-chicken",
  "world-bami-chicken",
  "world-beef-burrito",
  "world-beef-tacos",
  "world-surinamese-roti",
  "world-greek-kofta",
  "world-sweet-sour-chicken",
  "world-teriyaki-chicken",
  "world-tikka-masala",
  "vegetarian-chickpea-curry",
  "vegetarian-chili-rice",
  "vegetarian-falafel-pita",
  "vegetarian-noodles-egg",
  "vegetarian-couscous",
  "vegetarian-shakshuka",
  "vegetable-quinoa-feta",
  "healthy-chicken-stirfry-rice",
  "healthy-salmon-rice-bowl",
  "healthy-vegetable-soup",
  "healthy-salmon-traybake",
] as const;

export type DishImageKey = (typeof DISH_IMAGE_KEYS)[number];

/**
 * Explicit recipe mapping. Similar visual variants may intentionally share an
 * image, but no recipe name or loose keyword is used as a runtime lookup.
 */
export const RECIPE_IMAGE_KEYS = {
  "spaghetti-bolognese": "pasta-spaghetti-bolognese",
  "chicken-rice": "healthy-chicken-stirfry-rice",
  "beef-wraps": "world-beef-burrito",
  "tartare-potatoes": "dutch-potatoes-broccoli-meatball",
  "fish-fries": "comfort-fishsticks-fries",
  macaroni: "pasta-macaroni",
  "chickpea-curry": "vegetarian-chickpea-curry",
  "vegetarian-chili": "vegetarian-chili-rice",
  "vegetarian-wraps": "world-beef-burrito",
  "noodles-egg": "vegetarian-noodles-egg",
  "soup-bread": "healthy-vegetable-soup",
  "pizza-night": "comfort-pizza",
  "cauliflower-potatoes": "dutch-cauliflower-potatoes-egg",
  "lentil-pasta": "pasta-lentil-spinach-pesto",
  "sausage-potatoes": "dutch-potatoes-beans-chicken",
  "hutspot-gehaktbal": "dutch-hutspot-meatball",
  "boerenkool-rookworst": "dutch-boerenkool-sausage",
  "zuurkool-rookworst": "oven-sauerkraut-beef",
  "andijvie-spekjes": "dutch-andijvie-bacon",
  "broccoli-gehaktbal": "dutch-potatoes-broccoli-meatball",
  "worteltjes-kip": "dutch-potatoes-beans-chicken",
  "spinazie-ei-aardappel": "dutch-cauliflower-potatoes-egg",
  "rode-kool-hachee": "dutch-red-cabbage-stew",
  "doperwten-kipschnitzel": "dutch-peas-chicken-schnitzel",
  "krieltjes-bonen-kip": "dutch-baby-potatoes-beans-chicken",
  "zoete-aardappel-stamppot": "dutch-sweet-potato-spinach",
  "preistamppot-gehaktbal": "dutch-leek-stamppot-meatball",
  "prei-gehakt-ovenschotel": "oven-potato-leek-beef",
  "bloemkool-gehakt-ovenschotel": "oven-cauliflower-beef",
  "broccoli-kip-ovenschotel": "oven-broccoli-chicken",
  "zuurkool-gehakt-ovenschotel": "oven-sauerkraut-beef",
  "shepherds-pie": "oven-shepherds-pie",
  "vis-broccoli-ovenschotel": "oven-fish-broccoli",
  "kip-pesto-ovenschotel": "pasta-oven-mozzarella",
  "vegetarische-aardappelschotel": "oven-potato-gratin-vegburger",
  "aardappelgratin-bonen-vegburger": "oven-potato-gratin-vegburger",
  "andijvie-aardappel-kaas": "oven-potato-gratin-vegburger",
  "penne-kip-pesto": "pasta-chicken-pesto",
  "tagliatelle-champignon-room": "pasta-mushroom-cream",
  "fusilli-tonijn-tomaat": "pasta-tuna-tomato",
  "spaghetti-carbonara": "pasta-carbonara",
  "pasta-kip-spinazie": "pasta-chicken-pesto",
  "pasta-zalm-broccoli": "pasta-salmon-broccoli",
  "vegetarische-courgettepasta": "pasta-courgette",
  "penne-arrabbiata": "pasta-arrabbiata",
  "lasagne-bolognese": "pasta-lasagne-bolognese",
  groentelasagne: "pasta-vegetable-lasagne",
  "tortellini-tomatensaus": "pasta-tortellini-tomato",
  "gnocchi-spinazie": "pasta-gnocchi-spinach",
  "pasta-gehaktballetjes": "pasta-meatballs-tomato",
  "pasta-caprese": "pasta-caprese-pesto",
  "tonijn-pastasalade": "pasta-tuna-salad",
  "ovenpasta-kip": "pasta-oven-mozzarella",
  "honig-macaroni": "pasta-macaroni",
  "friet-snack-keuze": "comfort-chicken-nuggets-fries",
  "broodje-kipshoarma": "comfort-chicken-shawarma-pita",
  "kapsalon-kipshoarma": "comfort-kapsalon",
  "broodje-hamburger": "comfort-hamburger-fries",
  "cheeseburger-friet": "comfort-cheeseburger-fries",
  "kipnuggets-friet": "comfort-chicken-nuggets-fries",
  hotdogs: "comfort-hotdogs",
  "pannenkoeken-avond": "comfort-pancakes",
  "luxe-tosti-avond": "comfort-toasties",
  "nachos-oven": "comfort-nachos",
  "tacos-rundergehakt": "world-beef-tacos",
  "quesadillas-kip": "comfort-chicken-quesadilla",
  "kipsate-friet": "comfort-chicken-satay-fries",
  "vissticks-friet": "comfort-fishsticks-fries",
  "loaded-fries-kip": "comfort-loaded-fries",
  "zelfgemaakte-groentepizza": "comfort-vegetable-pizza",
  "honig-nasi-speciaal": "world-nasi-chicken",
  "bami-goreng-kip": "world-bami-chicken",
  "zoetzure-kip-rijst": "world-sweet-sour-chicken",
  "kip-curry-rijst": "world-chicken-curry-rice",
  "teriyaki-kip-rijst": "world-teriyaki-chicken",
  "tikka-masala-kip": "world-tikka-masala",
  "mexicaanse-rijst-bonen": "vegetarian-chili-rice",
  "gebakken-rijst-ei": "world-nasi-chicken",
  "runderreepjes-broccoli-rijst": "healthy-chicken-stirfry-rice",
  "zalm-rijstbowl": "healthy-salmon-rice-bowl",
  "gehaktballen-zoetzuur-rijst": "world-sweet-sour-chicken",
  "chili-con-carne-rijst": "vegetarian-chili-rice",
  "mango-kipcurry": "world-chicken-curry-rice",
  "tofu-rijst-groente": "vegetarian-couscous",
  "knorr-burritos": "world-beef-burrito",
  "knorr-kip-siam": "healthy-chicken-stirfry-rice",
  "knorr-hokkien-mie": "world-bami-chicken",
  "knorr-surinaamse-roti": "world-surinamese-roti",
  "knorr-griekse-kofta": "world-greek-kofta",
  "knorr-kip-madras": "world-chicken-curry-rice",
  "knorr-japanse-teriyaki": "world-teriyaki-chicken",
  "knorr-lasagne-bolognese": "pasta-lasagne-bolognese",
  "couscous-kikkererwten": "vegetarian-couscous",
  "quinoa-feta-groente": "vegetable-quinoa-feta",
  "veggieburger-zoete-friet": "oven-potato-gratin-vegburger",
  "shakshuka-brood": "vegetarian-shakshuka",
  "linzencurry-rijst": "vegetarian-chickpea-curry",
  "falafel-pita": "vegetarian-falafel-pita",
  "vegetarische-noedelbowl": "vegetarian-noodles-egg",
  "zalm-traybake": "healthy-salmon-traybake",
} as const satisfies Record<string, DishImageKey>;

export const RECIPE_IMAGE_STATUSES = [
  "verified",
  "likely_match",
  "mismatch",
  "missing",
  "needs_review",
] as const;

export type RecipeImageStatus = (typeof RECIPE_IMAGE_STATUSES)[number];

export type RecipeImageIssue =
  | "image_missing"
  | "dish_type_conflict"
  | "primary_ingredient_conflict"
  | "insufficient_image_metadata"
  | "weak_semantic_match";

const SEMANTIC_TAGS = [
  "potato", "sweetPotato", "fries", "spinach", "cauliflower", "broccoli",
  "carrot", "greenBeans", "peas", "leek", "andijvie", "boerenkool",
  "sauerkraut", "redCabbage", "courgette", "mushroom", "tomato", "vegetable",
  "pasta", "spaghetti", "macaroni", "tagliatelle", "fusilli", "lasagne",
  "tortellini", "gnocchi", "rice", "noodles", "couscous", "quinoa",
  "wrap", "taco", "bread", "pizza", "soup", "pancake", "toastie", "nachos",
  "chicken", "beef", "fish", "salmon", "tuna", "egg", "sausage", "tartare",
  "meatball", "burger", "hotdog", "nuggets", "shawarma", "satay", "kofta",
  "tofu", "falafel", "chickpea", "lentil", "beans", "cheese", "ham", "bacon",
  "curry", "chili", "shakshuka",
] as const;

type RecipeImageSemanticTag = (typeof SEMANTIC_TAGS)[number];

const SEMANTIC_TERMS: Record<RecipeImageSemanticTag, readonly string[]> = {
  potato: ["aardappel", "aardappelen", "potato", "potatoes", "krieltjes", "gratin"],
  sweetPotato: ["zoete aardappel", "zoete aardappelen", "sweet potato"],
  fries: ["friet", "frites", "patat", "fries", "loaded fries"],
  spinach: ["spinazie", "spinach"],
  cauliflower: ["bloemkool", "cauliflower"],
  broccoli: ["broccoli"],
  carrot: ["wortel", "worteltjes", "winterpeen", "carrot", "hutspot"],
  greenBeans: ["sperziebonen", "green beans", "beans"],
  peas: ["doperwten", "peas"],
  leek: ["prei", "leek"],
  andijvie: ["andijvie", "endive"],
  boerenkool: ["boerenkool", "kale"],
  sauerkraut: ["zuurkool", "sauerkraut"],
  redCabbage: ["rode kool", "red cabbage"],
  courgette: ["courgette", "zucchini"],
  mushroom: ["champignon", "champignons", "mushroom"],
  tomato: ["tomaat", "tomaten", "tomato", "bolognese", "arrabbiata"],
  vegetable: ["groente", "groenten", "vegetable", "vegetables", "stir fry"],
  pasta: ["pasta", "penne", "spaghetti", "macaroni", "tagliatelle", "fusilli", "lasagne", "tortellini", "gnocchi"],
  spaghetti: ["spaghetti"],
  macaroni: ["macaroni"],
  tagliatelle: ["tagliatelle"],
  fusilli: ["fusilli"],
  lasagne: ["lasagne", "lasagna"],
  tortellini: ["tortellini"],
  gnocchi: ["gnocchi"],
  rice: ["rijst", "rice", "nasi"],
  noodles: ["noedels", "noodles", "bami", "mie", "hokkien"],
  couscous: ["couscous"],
  quinoa: ["quinoa"],
  wrap: ["wrap", "wraps", "burrito", "burritos", "quesadilla", "quesadillas", "roti"],
  taco: ["taco", "tacos"],
  bread: ["brood", "broodje", "broodjes", "bread", "pita"],
  pizza: ["pizza"],
  soup: ["soep", "soup"],
  pancake: ["pannenkoek", "pannenkoeken", "pancake", "pancakes"],
  toastie: ["tosti", "tostis", "toastie", "toasties"],
  nachos: ["nacho", "nachos"],
  chicken: ["kip", "chicken", "nugget", "nuggets", "shoarma", "saté", "sate"],
  beef: ["rund", "runder", "beef", "gehakt", "bolognese", "hachee", "kofta"],
  fish: ["vis", "fish", "zalm", "salmon", "tonijn", "tuna"],
  salmon: ["zalm", "salmon"],
  tuna: ["tonijn", "tuna"],
  egg: ["ei", "eieren", "egg", "eggs"],
  sausage: ["worst", "rookworst", "braadworst", "sausage", "hotdog", "hotdogs"],
  tartare: ["tartaar", "tartare"],
  meatball: ["gehaktbal", "gehaktballen", "gehaktballetjes", "meatball", "meatballs", "kofta"],
  burger: ["burger", "burgers", "hamburger", "hamburgers", "vegburger", "cheeseburger"],
  hotdog: ["hotdog", "hotdogs"],
  nuggets: ["nugget", "nuggets"],
  shawarma: ["shoarma", "shawarma", "kapsalon"],
  satay: ["saté", "sate", "satay"],
  kofta: ["kofta"],
  tofu: ["tofu"],
  falafel: ["falafel"],
  chickpea: ["kikkererwt", "kikkererwten", "chickpea", "chickpeas"],
  lentil: ["linzen", "lentil", "lentils"],
  beans: ["bonen", "kidneybonen", "zwarte bonen", "beans", "chili"],
  cheese: ["kaas", "cheese", "cheddar", "mozzarella", "feta", "caprese"],
  ham: ["ham"],
  bacon: ["spek", "spekjes", "bacon", "carbonara"],
  curry: ["curry", "madras", "tikka masala"],
  chili: ["chili"],
  shakshuka: ["shakshuka"],
};

const CONFLICT_GROUPS: ReadonlyArray<{
  issue: RecipeImageIssue;
  tags: ReadonlySet<RecipeImageSemanticTag>;
}> = [
  {
    issue: "dish_type_conflict",
    tags: new Set([
      "spaghetti", "macaroni", "tagliatelle", "fusilli", "lasagne", "tortellini",
      "gnocchi", "rice", "noodles", "couscous", "quinoa", "wrap", "taco",
      "pizza", "soup", "pancake", "toastie", "nachos", "burger", "hotdog",
    ]),
  },
  {
    issue: "primary_ingredient_conflict",
    tags: new Set(["chicken", "beef", "fish", "egg", "sausage", "tofu", "falafel", "chickpea", "lentil"]),
  },
  {
    issue: "primary_ingredient_conflict",
    tags: new Set(["tartare", "meatball", "burger", "hotdog", "nuggets", "shawarma", "satay", "kofta"]),
  },
  {
    issue: "primary_ingredient_conflict",
    tags: new Set([
      "spinach", "cauliflower", "broccoli", "carrot", "greenBeans", "peas", "leek",
      "andijvie", "boerenkool", "sauerkraut", "redCabbage", "courgette", "mushroom",
    ]),
  },
];

const CATEGORY_HINTS: Record<string, readonly RecipeMealCategory[]> = {
  pasta: ["pasta"],
  dutch: ["dutch"],
  oven: ["dutch", "comfort", "healthy"],
  comfort: ["comfort", "quick"],
  world: ["rice", "comfort", "healthy"],
  vegetarian: ["vegetarian", "healthy"],
  vegetable: ["vegetarian", "healthy"],
  healthy: ["healthy"],
};

const IMAGE_TAG_OVERRIDES: Partial<
  Record<DishImageKey, readonly RecipeImageSemanticTag[]>
> = {
  "oven-shepherds-pie": ["potato", "beef", "carrot", "peas"],
  "world-sweet-sour-chicken": ["chicken", "rice", "tomato"],
  "world-teriyaki-chicken": ["chicken", "rice", "vegetable"],
};

export interface RecipeImageIngredientContext {
  sourceKey: string;
  name: string;
  category?: string | null;
  position?: number | null;
  optional?: boolean;
}

export interface RecipeImageContext {
  recipeSourceKey: string;
  recipeName: string;
  categories: readonly RecipeMealCategory[];
  ingredients: readonly RecipeImageIngredientContext[];
}

export interface RecipeImageQualityResult {
  recipeSourceKey: string;
  imageKey: DishImageKey | null;
  imagePresent: boolean;
  provenance: "controlled-generated" | null;
  status: RecipeImageStatus;
  accepted: boolean;
  recipeNameMatch: boolean;
  categoryMatch: boolean;
  primaryIngredientNames: string[];
  primaryIngredientMatchCount: number;
  primaryIngredientCount: number;
  issues: RecipeImageIssue[];
  fallbackNeeded: boolean;
}

export interface RecipeImageHealthScan {
  recipes: RecipeImageQualityResult[];
  summary: {
    total: number;
    imagePresent: number;
    verified: number;
    likelyMatch: number;
    needsReview: number;
    mismatch: number;
    missing: number;
    fallbackNeeded: number;
  };
}

export interface DishImageAsset {
  key: DishImageKey;
  src: `/images/dishes/${DishImageKey}.webp`;
  source: "recipe";
}

interface DishImageProfile {
  key: DishImageKey;
  tags: ReadonlySet<RecipeImageSemanticTag>;
  categoryHints: readonly RecipeMealCategory[];
  provenance: "controlled-generated";
}

function imageAsset(key: DishImageKey): DishImageAsset {
  return {
    key,
    src: `/images/dishes/${key}.webp`,
    source: "recipe",
  };
}

function normalizeSemanticText(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("nl-NL")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function containsSemanticTerm(text: string, term: string): boolean {
  const normalizedTerm = normalizeSemanticText(term);
  if (` ${text} `.includes(` ${normalizedTerm} `)) return true;
  if (normalizedTerm.includes(" ") || normalizedTerm.length < 5) return false;
  return text
    .split(" ")
    .some(
      (token) =>
        token.startsWith(normalizedTerm) || token.endsWith(normalizedTerm),
    );
}

function semanticTagsForText(value: string): Set<RecipeImageSemanticTag> {
  const normalized = normalizeSemanticText(value);
  const tags = new Set<RecipeImageSemanticTag>();
  for (const tag of SEMANTIC_TAGS) {
    if (SEMANTIC_TERMS[tag].some((term) => containsSemanticTerm(normalized, term))) {
      tags.add(tag);
    }
  }
  return tags;
}

function imageTags(key: DishImageKey): Set<RecipeImageSemanticTag> {
  return new Set([
    ...semanticTagsForText(key.replaceAll("-", " ")),
    ...(IMAGE_TAG_OVERRIDES[key] ?? []),
  ]);
}

function imageCategoryHints(key: DishImageKey): readonly RecipeMealCategory[] {
  return CATEGORY_HINTS[key.split("-")[0]] ?? [];
}

function imageProfile(key: DishImageKey): DishImageProfile {
  return {
    key,
    tags: imageTags(key),
    categoryHints: imageCategoryHints(key),
    provenance: "controlled-generated",
  };
}

function ingredientTags(ingredient: RecipeImageIngredientContext): Set<RecipeImageSemanticTag> {
  return semanticTagsForText(`${ingredient.sourceKey} ${ingredient.name}`);
}

function primaryIngredients(context: RecipeImageContext): RecipeImageIngredientContext[] {
  const recipeNameTags = semanticTagsForText(context.recipeName);
  const required = context.ingredients
    .map((ingredient, inputIndex) => ({ ingredient, inputIndex }))
    .filter(({ ingredient }) => ingredient.optional !== true)
    .toSorted(
      (left, right) =>
        (left.ingredient.position ?? left.inputIndex) -
        (right.ingredient.position ?? right.inputIndex),
    )
    .map(({ ingredient }) => ingredient);
  const named = required.filter((ingredient) =>
    [...ingredientTags(ingredient)].some((tag) => recipeNameTags.has(tag)),
  );
  const visuallySignificant = required.filter(
    (ingredient) =>
      !named.includes(ingredient) &&
      ingredient.category !== "Sauzen & smaakmakers" &&
      ingredient.category !== "Maaltijdcomponenten",
  );
  return [...named, ...visuallySignificant].slice(0, 3);
}

function conflictIssues(
  expected: ReadonlySet<RecipeImageSemanticTag>,
  actual: ReadonlySet<RecipeImageSemanticTag>,
): RecipeImageIssue[] {
  const issues = new Set<RecipeImageIssue>();
  for (const group of CONFLICT_GROUPS) {
    const expectedInGroup = [...expected].filter((tag) => group.tags.has(tag));
    const actualInGroup = [...actual].filter((tag) => group.tags.has(tag));
    if (
      expectedInGroup.length > 0 &&
      actualInGroup.length > 0 &&
      !expectedInGroup.some((tag) => actualInGroup.includes(tag))
    ) {
      issues.add(group.issue);
    }
  }
  return [...issues];
}

export function evaluateRecipeImageQuality(
  context: RecipeImageContext,
): RecipeImageQualityResult {
  const imageKey = (RECIPE_IMAGE_KEYS as Record<string, DishImageKey | undefined>)[
    context.recipeSourceKey
  ] ?? null;
  const primary = primaryIngredients(context);
  const primaryTags = new Set(primary.flatMap((ingredient) => [...ingredientTags(ingredient)]));
  const recipeNameTags = semanticTagsForText(context.recipeName);

  if (!imageKey) {
    return {
      recipeSourceKey: context.recipeSourceKey,
      imageKey: null,
      imagePresent: false,
      provenance: null,
      status: "missing",
      accepted: false,
      recipeNameMatch: false,
      categoryMatch: false,
      primaryIngredientNames: primary.map((ingredient) => ingredient.name),
      primaryIngredientMatchCount: 0,
      primaryIngredientCount: primary.length,
      issues: ["image_missing"],
      fallbackNeeded: true,
    };
  }

  const profile = imageProfile(imageKey);
  const actualTags = profile.tags;
  const issues = conflictIssues(
    new Set([...recipeNameTags, ...primaryTags]),
    actualTags,
  );
  const matchingPrimary = primary.filter((ingredient) =>
    [...ingredientTags(ingredient)].some((tag) => actualTags.has(tag)),
  );
  const recipeNameMatch = [...recipeNameTags].some((tag) => actualTags.has(tag));
  const categoryMatch = context.categories.some((category) =>
    profile.categoryHints.includes(category),
  );

  let status: RecipeImageStatus;
  if (actualTags.size === 0) {
    status = "needs_review";
    issues.push("insufficient_image_metadata");
  } else if (issues.length > 0) {
    status = "mismatch";
  } else if (
    matchingPrimary.length >= 2 ||
    (recipeNameMatch && matchingPrimary.length >= 1)
  ) {
    status = "verified";
  } else if (matchingPrimary.length >= 1 || recipeNameMatch) {
    status = "likely_match";
  } else {
    status = "needs_review";
    issues.push("weak_semantic_match");
  }
  const accepted = status === "verified" || status === "likely_match";

  return {
    recipeSourceKey: context.recipeSourceKey,
    imageKey,
    imagePresent: true,
    provenance: profile.provenance,
    status,
    accepted,
    recipeNameMatch,
    categoryMatch,
    primaryIngredientNames: primary.map((ingredient) => ingredient.name),
    primaryIngredientMatchCount: matchingPrimary.length,
    primaryIngredientCount: primary.length,
    issues: [...new Set(issues)],
    fallbackNeeded: !accepted,
  };
}

export function evaluateRecipeImageHealth(
  contexts: readonly RecipeImageContext[],
): RecipeImageHealthScan {
  const recipes = contexts.map(evaluateRecipeImageQuality);
  return {
    recipes,
    summary: {
      total: recipes.length,
      imagePresent: recipes.filter((item) => item.imagePresent).length,
      verified: recipes.filter((item) => item.status === "verified").length,
      likelyMatch: recipes.filter((item) => item.status === "likely_match").length,
      needsReview: recipes.filter((item) => item.status === "needs_review").length,
      mismatch: recipes.filter((item) => item.status === "mismatch").length,
      missing: recipes.filter((item) => item.status === "missing").length,
      fallbackNeeded: recipes.filter((item) => item.fallbackNeeded).length,
    },
  };
}

export function recipeImageContextFromCatalog(
  recipe: Recipe,
  categories: readonly RecipeMealCategory[],
  catalog: RecipeCatalog,
): RecipeImageContext {
  const ingredientsById = new Map(
    catalog.ingredients.map((ingredient) => [ingredient.id, ingredient]),
  );
  return {
    recipeSourceKey: recipe.sourceKey,
    recipeName: recipe.name,
    categories,
    ingredients: catalog.relations
      .filter((relation) => relation.recipeId === recipe.id)
      .map((relation) => {
        const ingredient = ingredientsById.get(relation.ingredientId);
        return {
          sourceKey: ingredient?.sourceKey ?? relation.ingredientId,
          name: ingredient?.name ?? relation.ingredientId,
          category: ingredient?.category ?? null,
          position: relation.position,
          optional: relation.optional === true,
        };
      }),
  };
}

export function recipeImageFor(
  context: RecipeImageContext | null | undefined,
): DishImageAsset | null {
  if (!context) return null;
  const result = evaluateRecipeImageQuality(context);
  return result.accepted && result.imageKey ? imageAsset(result.imageKey) : null;
}

export const SPECIFIC_RECIPE_IMAGE_COUNT = Object.keys(RECIPE_IMAGE_KEYS).length;
export const CATEGORY_FALLBACK_IMAGE_COUNT = 0;
