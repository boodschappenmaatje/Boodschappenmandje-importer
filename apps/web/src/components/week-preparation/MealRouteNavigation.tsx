import Link from "next/link";
export function MealRouteNavigation({ current }: { current: "menu" | "free" }) {
  return <nav className="meal-route-navigation" aria-label="Maaltijden">
    <Link href="/week-voorbereiden" aria-current={current === "menu" ? "page" : undefined}>Menu</Link>
    <Link href="/vrije-keuze" aria-current={current === "free" ? "page" : undefined}>Vrije keuze</Link>
  </nav>;
}
