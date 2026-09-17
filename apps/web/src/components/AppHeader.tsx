"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { MaatjeMascot } from "@/components/MaatjeMascot";

export function AppHeader() {
  const pathname = usePathname();
  if (pathname !== "/") return null;

  return (
    <header className="app-header">
      <Link className="brand" href="/" aria-label="BoodschappenMaatje home">
        <span>
          <span className="brand-name">Boodschappen<span>Maatje</span></span>
          <span className="brand-subtitle">Slimmer boodschappen doen</span>
        </span>
      </Link>
      <div className="brand-mascot">
        <span className="brand-speech">Samen<br />binnen budget!</span>
        <MaatjeMascot size="medium" />
      </div>
    </header>
  );
}
