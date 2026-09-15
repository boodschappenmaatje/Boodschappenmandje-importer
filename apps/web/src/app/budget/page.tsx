import type { Metadata } from "next";

import { BudgetDetailView } from "@/components/budget/BudgetDetailView";

export const metadata: Metadata = { title: "Budget" };

export default function BudgetPage() {
  return <BudgetDetailView />;
}
