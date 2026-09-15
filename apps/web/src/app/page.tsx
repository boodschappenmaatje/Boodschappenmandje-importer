import { DashboardActionCard } from "@/components/dashboard/DashboardActionCard";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { ShoppingListCard } from "@/components/dashboard/ShoppingListCard";
import { HomeBudgetCard } from "@/components/budget/HomeBudgetCard";
import { HomeWeekPreparationCard } from "@/components/week-preparation/HomeWeekPreparationCard";
import { HomeWeekSummaryCard } from "@/components/week-preparation/HomeWeekSummaryCard";
import { homeSections } from "@/features/home/home-sections";

export default function HomePage() {
  return (
    <>
      <DashboardHeader />
      <HomeWeekSummaryCard />
      <ShoppingListCard />

      <div className="section-heading compact-heading">
        <h2>Verder met je week</h2>
      </div>

      <section className="dashboard-actions" aria-label="Snelkoppelingen">
        {homeSections.map((section) => (
          section.icon === "budget" ? (
            <HomeBudgetCard key={section.title} />
          ) : section.icon === "prepare" ? (
            <HomeWeekPreparationCard key={section.title} />
          ) : (
            <DashboardActionCard key={section.title} section={section} />
          )
        ))}
      </section>
    </>
  );
}
