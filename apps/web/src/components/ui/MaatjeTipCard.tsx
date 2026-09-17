import { Icon } from "@/components/Icon";
import type { ReactNode } from "react";

export function MaatjeTipCard({ children }: { children: ReactNode }) {
  return (
    <aside className="maatje-tip-card">
      <span className="maatje-tip-icon"><Icon name="lightbulb" size={25} /></span>
      <div>
        <strong>Tip van Maatje</strong>
        <p>{children}</p>
      </div>
    </aside>
  );
}
