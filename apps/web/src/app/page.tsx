import { DashboardActionCard } from "@/components/dashboard/DashboardActionCard";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { ShoppingListCard } from "@/components/dashboard/ShoppingListCard";
import { WeekSummaryCard } from "@/components/dashboard/WeekSummaryCard";
import { emptyDashboardState } from "@/features/dashboard/dashboard-state";
import { homeSections } from "@/features/home/home-sections";

export default function HomePage() {
  return (
    <>
      <DashboardHeader />
      <WeekSummaryCard week={emptyDashboardState.week} />
      <ShoppingListCard shoppingList={emptyDashboardState.shoppingList} />

      <div className="section-heading compact-heading">
        <h2>Verder met je week</h2>
      </div>

      <section className="dashboard-actions" aria-label="Snelkoppelingen">
        {homeSections.map((section) => (
          <DashboardActionCard key={section.title} section={section} />
        ))}
      </section>
    </>
  );
}
