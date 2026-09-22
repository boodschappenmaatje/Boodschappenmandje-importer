export type NavigationIcon = "home" | "menu" | "list" | "products" | "budget" | "more";

export interface NavigationItem {
  href: string;
  label: string;
  icon: NavigationIcon;
}
