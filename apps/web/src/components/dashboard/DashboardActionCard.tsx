import Link from "next/link";

import { Icon } from "@/components/Icon";
import type { HomeSection } from "@/features/home/home-sections";

export function DashboardActionCard({ section }: { section: HomeSection }) {
  return (
    <Link
      className="dashboard-action-card"
      data-wide={section.wide ?? false}
      href={section.href}
    >
      <span className="dashboard-action-icon"><Icon name={section.icon} size={23} /></span>
      <span className="dashboard-action-copy">
        <strong>{section.title}</strong>
        <span>{section.description}</span>
      </span>
      <span className="dashboard-action-arrow"><Icon name="arrow" size={18} /></span>
    </Link>
  );
}
