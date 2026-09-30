"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
export function AppHeader() {
  const pathname = usePathname();
  if (pathname !== "/") return null;
  return <header className="app-header home-c-header"><Link className="home-c-brand" href="/" aria-label="BoodschappenMaatje home"><span>BoodschappenMaatje</span><small>Samen makkelijker eten <span aria-hidden="true">♥</span></small></Link></header>;
}
