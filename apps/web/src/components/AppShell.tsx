import type { ReactNode } from "react";

import { AppHeader } from "@/components/AppHeader";
import { BottomNavigation } from "@/components/BottomNavigation";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <AppHeader />
      <main className="page-content">{children}</main>
      <BottomNavigation />
    </div>
  );
}
