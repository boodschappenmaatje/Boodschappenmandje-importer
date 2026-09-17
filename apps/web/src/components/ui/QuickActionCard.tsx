import Link from "next/link";

import { Icon } from "@/components/Icon";

export function QuickActionCard({
  href,
  icon,
  label,
  detail,
}: {
  href: string;
  icon: "list" | "history";
  label: string;
  detail?: string;
}) {
  return (
    <Link className="quick-action-card" href={href}>
      <Icon name={icon} size={25} />
      <span>
        <strong>{label}</strong>
        {detail ? <small>{detail}</small> : null}
      </span>
    </Link>
  );
}
