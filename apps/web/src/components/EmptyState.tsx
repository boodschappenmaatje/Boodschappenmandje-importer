import type { ReactNode } from "react";

import { Icon } from "@/components/Icon";

interface EmptyStateProps {
  icon: "week" | "list" | "budget" | "prepare";
  title: string;
  children: ReactNode;
}

export function EmptyState({ icon, title, children }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <span className="empty-state-icon"><Icon name={icon} size={24} /></span>
      <div>
        <h2>{title}</h2>
        <p>{children}</p>
      </div>
    </div>
  );
}
