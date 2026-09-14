import Link from "next/link";

export function AppHeader() {
  return (
    <header className="app-header">
      <Link className="brand" href="/" aria-label="BoodschappenMaatje home">
        <span className="brand-mark" aria-hidden="true">B</span>
        <span className="brand-name">Boodschappen<span>Maatje</span></span>
      </Link>
      <p className="brand-promise">Je lijst denkt met je mee</p>
    </header>
  );
}
