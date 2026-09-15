import Link from "next/link";

import { Icon } from "@/components/Icon";
import type { HomeSection } from "@/features/home/home-sections";

export function FeatureCard({ section }: { section: HomeSection }) {
  return (
    <Link
      className="feature-card"
      data-emphasis={section.emphasis ?? "regular"}
      href={section.href}
    >
      <span className="feature-icon"><Icon name={section.icon} /></span>
      <span className="feature-copy">
        <strong>{section.title}</strong>
        <span>{section.description}</span>
      </span>
      <span className="feature-arrow"><Icon name="arrow" size={19} /></span>
    </Link>
  );
}
