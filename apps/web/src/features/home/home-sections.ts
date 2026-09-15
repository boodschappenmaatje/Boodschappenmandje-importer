export interface HomeSection {
  title: string;
  description: string;
  href: string;
  icon: "week" | "list" | "budget" | "products" | "prepare";
  emphasis?: "primary" | "regular";
  wide?: boolean;
}

export const homeSections: readonly HomeSection[] = [
  {
    title: "Producten",
    description: "Bekijk echte producten en actuele prijsinformatie.",
    href: "/producten",
    icon: "products",
    emphasis: "primary",
  },
  {
    title: "Budget",
    description: "Bereid je weekbudget voor en houd straks overzicht.",
    href: "/budget",
    icon: "budget",
  },
  {
    title: "Week voorbereiden",
    description: "Bereid je boodschappenweek rustig en slim voor.",
    href: "/week-voorbereiden",
    icon: "prepare",
    emphasis: "primary",
    wide: true,
  },
] as const;
