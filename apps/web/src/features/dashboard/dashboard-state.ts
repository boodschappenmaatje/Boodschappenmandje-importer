export interface WeekSummary {
  people?: number;
  days?: number;
  supermarket?: string;
  budget?: number;
  expectedTotal?: number;
}

export interface DashboardState {
  week: WeekSummary | null;
  suggestions: readonly string[];
}

/**
 * PWA 6 heeft nog geen persistente week of actieve lijst. Door ontbrekende
 * gegevens expliciet als leeg te modelleren, verschijnen er nooit demo-aantallen
 * of fictieve budgetbedragen op Home.
 */
export const emptyDashboardState: DashboardState = {
  week: null,
  suggestions: [],
};
