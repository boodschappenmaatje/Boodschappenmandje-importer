export type NavigationIcon = "home" | "menu" | "list" | "products" | "more";

export interface NavigationItem {
  href: string;
  label: string;
  icon: NavigationIcon;
}
