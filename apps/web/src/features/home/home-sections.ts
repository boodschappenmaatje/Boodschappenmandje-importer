export interface HomeSection {
  title: string;
  description: string;
  href: string;
  icon: "week" | "list" | "budget" | "products" | "prepare";
  emphasis?: "primary" | "regular";
}

export const homeSections: readonly HomeSection[] = [
  {
    title: "Deze week",
    description: "De plek voor je actieve week en slimme suggesties.",
    href: "/lijst",
    icon: "week",
    emphasis: "primary",
  },
  {
    title: "Mijn boodschappen",
    description: "Je actieve lijst komt hier centraal te staan.",
    href: "/lijst",
    icon: "list",
  },
  {
    title: "Budget",
    description: "Ondersteunende budgetinformatie volgt later.",
    href: "/meer",
    icon: "budget",
  },
  {
    title: "Producten",
    description: "Zoeken in de bestaande Supabase-catalogus volgt later.",
    href: "/producten",
    icon: "products",
  },
  {
    title: "Weekvoorbereiding",
    description: "Menu en recepten blijven een bron voor je lijst.",
    href: "/meer",
    icon: "prepare",
  },
] as const;
