import type { NavigationItem } from "@/types/navigation";

export const primaryNavigation: readonly NavigationItem[] = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/week-voorbereiden", label: "Menu", icon: "menu" },
  { href: "/lijst", label: "Lijst", icon: "list" },
  { href: "/producten", label: "Producten", icon: "products" },
  { href: "/meer", label: "Meer", icon: "more" },
] as const;
