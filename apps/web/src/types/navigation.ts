export type NavigationIcon = "home" | "list" | "products" | "more";

export interface NavigationItem {
  href: string;
  label: string;
  icon: NavigationIcon;
}
