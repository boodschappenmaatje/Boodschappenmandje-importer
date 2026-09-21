import type { RecipeIngredientDefinition } from "@/services/week-preparation/recipe-repository";
import type { MealMixBrand, WeekIngredientUnit } from "@/types/week-preparation";

export const MEAL_MIX_BRANDS = ["Knorr", "Honig"] as const;

export interface MealMixSupplement {
  sourceKey: string;
  name: string;
  aliases: string[];
  category: string;
  quantity: number;
  unit: WeekIngredientUnit;
}

export interface MealMixProfile {
  productId?: string;
  recipeSourceKey: string;
  dishName: string;
  brand: MealMixBrand;
  productIngredientSourceKey: string;
  productName: string;
  productAliases: string[];
  servingsPerPackage: number;
  supplements: MealMixSupplement[];
  sourceUrl: string;
  verificationStatus: "verified";
  waterOnly?: boolean;
}

function supplement(
  sourceKey: string,
  name: string,
  category: string,
  quantity: number,
  unit: WeekIngredientUnit,
  aliases: string[] = [],
): MealMixSupplement {
  return { sourceKey, name, aliases: [name, ...aliases], category, quantity, unit };
}

const KNORR_PROFILES: MealMixProfile[] = [
  {
    recipeSourceKey: "knorr-burritos",
    dishName: "Mexicaanse burrito’s",
    brand: "Knorr",
    productIngredientSourceKey: "knorrBurritos",
    productName: "Knorr Wereldgerechten Mexicaanse Burrito’s",
    productAliases: ["Knorr Mexicaanse Burrito's", "Knorr Wereldgerechten Burrito's"],
    servingsPerPackage: 3,
    supplements: [
      supplement("chicken", "kipfilet", "Vlees", 225, "g"),
      supplement("champignons", "champignons", "Groente", 250, "g"),
      supplement("paprika", "paprika", "Groente", 2, "piece"),
      supplement("onion", "uien", "Groente", 1, "piece", ["ui"]),
      supplement("volleKwark", "volle kwark", "Zuivel & eieren", 125, "g", ["kwark"]),
      supplement("gratedCheese", "geraspte kaas", "Zuivel & eieren", 50, "g"),
    ],
    sourceUrl: "https://www.knorr.com/nl/p/mexicaanse-burritos.html/08710522848425",
    verificationStatus: "verified",
  },
  {
    recipeSourceKey: "knorr-griekse-kofta",
    dishName: "Griekse kofta",
    brand: "Knorr",
    productIngredientSourceKey: "knorrKofta",
    productName: "Knorr Wereldgerechten Griekse Kofta",
    productAliases: ["Knorr Griekse Kofta"],
    servingsPerPackage: 3,
    supplements: [
      supplement("groundBeef", "rundergehakt", "Vlees", 225, "g", ["gehakt"]),
      supplement("tomaten", "tomaten", "Groente", 5, "piece", ["tomaat"]),
      supplement("courgette", "courgette", "Groente", 1, "piece"),
    ],
    sourceUrl: "https://www.knorr.com/nl/p/wereldgerecht-griekse-kofta.html/08710522689141",
    verificationStatus: "verified",
  },
  {
    recipeSourceKey: "knorr-hokkien-mie",
    dishName: "Singaporese Hokkien noedels",
    brand: "Knorr",
    productIngredientSourceKey: "knorrHokkienMie",
    productName: "Knorr Wereldgerechten Singaporese Hokkien Noedels",
    productAliases: ["Knorr Hokkien Mie", "Knorr Hokkien Noedels"],
    servingsPerPackage: 3,
    supplements: [
      supplement("chicken", "kipfilet", "Vlees", 225, "g"),
      supplement("stirFryVegetables", "roerbakgroenten", "Groente", 400, "g"),
      supplement("champignons", "champignons", "Groente", 125, "g"),
      supplement("onion", "uien", "Groente", 1, "piece", ["ui"]),
    ],
    sourceUrl: "https://www.knorr.com/nl/p/singaporese-hokkien-mie.html/08710522736418",
    verificationStatus: "verified",
  },
  {
    recipeSourceKey: "knorr-japanse-teriyaki",
    dishName: "Japanse teriyaki",
    brand: "Knorr",
    productIngredientSourceKey: "knorrTeriyaki",
    productName: "Knorr Wereldgerechten Japanse Teriyaki",
    productAliases: ["Knorr Japanse Teriyaki"],
    servingsPerPackage: 3,
    supplements: [
      supplement("runderreepjes", "runderreepjes", "Vlees", 225, "g", ["biefstukreepjes"]),
      supplement("champignons", "champignons", "Groente", 250, "g"),
      supplement("peultjes", "peultjes", "Groente", 200, "g"),
      supplement("bosui", "bosui", "Groente", 3, "piece", ["bosuien", "lente-ui", "lente-uitjes"]),
      supplement("onion", "uien", "Groente", 2, "piece", ["rode ui", "rode uien"]),
    ],
    sourceUrl: "https://www.knorr.com/nl/p/japanse-teriyaki.html/08710522736715",
    verificationStatus: "verified",
  },
  {
    recipeSourceKey: "knorr-kip-madras",
    dishName: "Indiase kip Madras",
    brand: "Knorr",
    productIngredientSourceKey: "knorrMadras",
    productName: "Knorr Wereldgerechten Indiase Kip Madras",
    productAliases: ["Knorr Kip Madras"],
    servingsPerPackage: 3,
    supplements: [
      supplement("chicken", "kipfilet", "Vlees", 225, "g"),
      supplement("greenBeans", "sperziebonen", "Groente", 300, "g"),
      supplement("bosui", "bosui", "Groente", 3, "piece", ["bosuien", "lente-ui", "lente-uitjes"]),
      supplement("tomaten", "tomaten", "Groente", 2, "piece", ["tomaat"]),
      supplement("onion", "uien", "Groente", 1, "piece", ["ui"]),
      supplement("appel", "appel", "Fruit", 1, "piece"),
      supplement("cremeFraiche", "crème fraîche", "Zuivel & eieren", 125, "g"),
    ],
    sourceUrl: "https://www.knorr.com/nl/p/indiase-kip-madras.html/08710522735619",
    verificationStatus: "verified",
  },
  {
    recipeSourceKey: "knorr-kip-siam",
    dishName: "Thaise kip Siam",
    brand: "Knorr",
    productIngredientSourceKey: "knorrKipSiam",
    productName: "Knorr Wereldgerechten Thaise Kip Siam",
    productAliases: ["Knorr Kip Siam"],
    servingsPerPackage: 3,
    supplements: [
      supplement("chicken", "kipfilet", "Vlees", 225, "g"),
      supplement("stirFryVegetables", "oosterse wokgroenten", "Groente", 650, "g", ["wokgroenten", "roerbakgroenten"]),
    ],
    sourceUrl: "https://www.knorr.com/nl/p/thaise-kip-siam.html/08710522738498",
    verificationStatus: "verified",
  },
  {
    recipeSourceKey: "knorr-lasagne-bolognese",
    dishName: "Lasagne bolognese",
    brand: "Knorr",
    productIngredientSourceKey: "knorrLasagne",
    productName: "Knorr Wereldgerechten Italiaanse Lasagne Bolognese",
    productAliases: ["Knorr Lasagne Bolognese"],
    servingsPerPackage: 3,
    supplements: [
      supplement("groundBeef", "rundergehakt", "Vlees", 225, "g", ["gehakt"]),
      supplement("italiaanseGroente", "Italiaanse roerbakgroenten", "Groente", 400, "g"),
      supplement("tomaten", "tomaten", "Groente", 3, "piece", ["tomaat"]),
      supplement("magereMelk", "magere melk", "Zuivel & eieren", 400, "ml"),
      supplement("gratedCheese", "geraspte kaas", "Zuivel & eieren", 75, "g"),
    ],
    sourceUrl: "https://www.hoogvliet.com/product/knorr-wereldgerechten-maaltijdpakket-italiaanse-lasagne-bolognese",
    verificationStatus: "verified",
  },
  {
    recipeSourceKey: "knorr-surinaamse-roti",
    dishName: "Surinaamse roti",
    brand: "Knorr",
    productIngredientSourceKey: "knorrRoti",
    productName: "Knorr Wereldgerechten Surinaamse Roti",
    productAliases: ["Knorr Surinaamse Roti"],
    servingsPerPackage: 3,
    supplements: [
      supplement("chicken", "kipfilet", "Vlees", 225, "g"),
      supplement("greenBeans", "sperziebonen", "Groente", 300, "g"),
      supplement("tomaten", "tomaten", "Groente", 3, "piece", ["tomaat"]),
      supplement("onion", "uien", "Groente", 1, "piece", ["ui"]),
      supplement("krieltjes", "krieltjes", "Aardappel & zetmeel", 200, "g"),
    ],
    sourceUrl: "https://www.ah.nl/producten/product/wi112772/knorr-wereldgerechten-surinaamse-roti",
    verificationStatus: "verified",
  },
];

const HONIG_PROFILES: MealMixProfile[] = [
  {
    recipeSourceKey: "honig-macaroni",
    dishName: "Macaroni met gehakt en groente",
    brand: "Honig",
    productIngredientSourceKey: "honigMacaroniMix",
    productName: "Honig Basis voor macaroni en spaghetti",
    productAliases: ["Honig Maaltijdmix voor Macaroni en Spaghetti"],
    servingsPerPackage: 4,
    supplements: [
      supplement("macaroni", "macaroni", "Pasta, rijst & granen", 300, "g"),
      supplement("groundBeef", "rundergehakt", "Vlees", 300, "g", ["gehakt"]),
      supplement("italiaanseGroente", "Italiaanse roerbakgroenten", "Groente", 600, "g"),
      supplement("cherrytomaten", "cherrytomaten", "Groente", 250, "g"),
    ],
    sourceUrl: "https://www.hoogvliet.com/product/honig-basis-voor-macaroni-en-spaghetti",
    verificationStatus: "verified",
  },
  {
    recipeSourceKey: "honig-nasi-speciaal",
    dishName: "Nasi speciaal met kip",
    brand: "Honig",
    productIngredientSourceKey: "honigNasiMix",
    productName: "Honig Basis voor nasi speciaal",
    productAliases: ["Honig Mix voor Nasi Speciaal"],
    servingsPerPackage: 4,
    supplements: [
      supplement("rice", "basmatirijst", "Pasta, rijst & granen", 300, "g", ["rijst"]),
      supplement("chicken", "kipfilet", "Vlees", 400, "g"),
      supplement("stirFryVegetables", "nasi-/bamigroenten", "Groente", 450, "g", ["nasigroenten", "bamigroenten", "roerbakgroenten"]),
      supplement("paprika", "paprika", "Groente", 1, "piece", ["rode paprika"]),
    ],
    sourceUrl: "https://www.kraftheinz.com/honig/products/08715700024733-nasi-speciaal-dubbelpak-2-x-39g-78g-x-12",
    verificationStatus: "verified",
  },
];

export const MEAL_MIX_PROFILES = [...KNORR_PROFILES, ...HONIG_PROFILES] as const;

const profileByRecipe = new Map(
  MEAL_MIX_PROFILES.map((profile) => [profile.recipeSourceKey, profile]),
);
const profileByIngredient = new Map(
  MEAL_MIX_PROFILES.map((profile) => [profile.productIngredientSourceKey, profile]),
);

export function mealMixProfileForRecipe(sourceKey: string, profiles?: readonly MealMixProfile[]): MealMixProfile | null {
  return profiles?.find((profile) => profile.recipeSourceKey === sourceKey) ?? profileByRecipe.get(sourceKey) ?? null;
}

export function mealMixProfileForIngredient(sourceKey: string): MealMixProfile | null {
  return profileByIngredient.get(sourceKey) ?? null;
}

export function inferMealMixBrand(
  ingredient: Pick<RecipeIngredientDefinition, "name" | "category">,
): MealMixBrand | null {
  if (ingredient.category !== "Maaltijdcomponenten") return null;
  const value = ingredient.name.trim().toLocaleLowerCase("nl-NL");
  if (value.startsWith("knorr ")) return "Knorr";
  if (value.startsWith("honig ")) return "Honig";
  return null;
}

export function enrichIngredientsForMealMixes(
  ingredients: RecipeIngredientDefinition[],
  profiles: readonly MealMixProfile[] = MEAL_MIX_PROFILES,
): RecipeIngredientDefinition[] {
  const bySourceKey = new Map(ingredients.map((ingredient) => [ingredient.sourceKey, ingredient]));

  for (const profile of [...MEAL_MIX_PROFILES, ...profiles]) {
    const mealMix = bySourceKey.get(profile.productIngredientSourceKey);
    if (mealMix) {
      bySourceKey.set(profile.productIngredientSourceKey, {
        ...mealMix,
        productId: profile.productId,
        aliases: [...new Set([...mealMix.aliases, profile.productName, ...profile.productAliases])],
      });
    } else if (profile.productId) {
      bySourceKey.set(profile.productIngredientSourceKey, {
        id: `meal-mix-ingredient:${profile.productIngredientSourceKey}`, sourceKey: profile.productIngredientSourceKey,
        name: profile.productName, normalizedName: profile.productName.toLowerCase(), defaultUnit: "piece",
        category: "Maaltijdcomponenten", aliases: profile.productAliases, productId: profile.productId,
      });
    }
    for (const item of profile.supplements) {
      // Hoogvliet labels these fresh vegetable mixes "Italiaanse roerbak".
      // Keep the package ingredient unchanged; the regular matcher still checks
      // product category, preparation form, price and purchasable quantity.
      const aliases = [...new Set([...item.aliases,
        ...(item.category === "Groente" && /^italiaans[e]? (?:groentepakket|groentemix|roerbakmix|roerbakgroenten|wokgroenten)$/i.test(item.name.trim())
          ? ["Italiaanse roerbak"] : []),
      ])];
      const existing = bySourceKey.get(item.sourceKey);
      if (existing) {
        bySourceKey.set(item.sourceKey, {
          ...existing,
          aliases: [...new Set([...existing.aliases, ...aliases])],
        });
      } else {
        bySourceKey.set(item.sourceKey, {
          id: `meal-mix-ingredient:${item.sourceKey}`,
          sourceKey: item.sourceKey,
          name: item.name,
          normalizedName: item.name.toLocaleLowerCase("nl-NL"),
          defaultUnit: item.unit,
          category: item.category,
          aliases,
        });
      }
    }
  }

  return [...bySourceKey.values()];
}
