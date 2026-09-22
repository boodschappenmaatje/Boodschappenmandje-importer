import type { NavigationItem } from "@/types/navigation";

export const primaryNavigation: readonly NavigationItem[] = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/week-voorbereiden", label: "Menu", icon: "menu" },
  { href: "/lijst", label: "Lijst", icon: "list" },
  { href: "/budget", label: "Budget", icon: "budget" },
  { href: "/meer", label: "Meer", icon: "more" },
] as const;
