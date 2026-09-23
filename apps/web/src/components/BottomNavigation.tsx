"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Icon } from "@/components/Icon";
import { primaryNavigation } from "@/config/navigation";

function isCurrentPath(pathname: string, href: string): boolean {
  if (href === "/week-voorbereiden" && pathname.startsWith("/vrije-keuze")) return true;
  return href === "/" ? pathname === href : pathname.startsWith(href);
}

export function BottomNavigation() {
  const pathname = usePathname();

  return (
    <nav className="bottom-navigation" aria-label="Hoofdnavigatie">
      <div className="bottom-navigation-inner">
        {primaryNavigation.map((item) => {
          const active = isCurrentPath(pathname, item.href);
          return (
            <Link
              key={item.href}
              className="navigation-item"
              data-active={active}
              href={item.href}
              aria-current={active ? "page" : undefined}
            >
              <Icon name={item.icon} size={23} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
