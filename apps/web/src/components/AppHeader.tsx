"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
export function AppHeader() {
  const pathname = usePathname();
  if (pathname !== "/") return null;
  return <header className="app-header home-c-header"><Link className="home-c-brand" href="/" aria-label="BoodschappenMaatje home"><Image src="/icons/maatje-v1-192.png" alt="" width={35} height={35} /><span>BoodschappenMaatje</span></Link></header>;
}
