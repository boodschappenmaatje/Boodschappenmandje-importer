import { FeatureCard } from "@/components/FeatureCard";
import { homeSections } from "@/features/home/home-sections";

export default function HomePage() {
  return (
    <>
      <section className="hero">
        <p className="eyebrow">PWA-fundament</p>
        <h1>Je boodschappen, straks altijd bij de hand.</h1>
        <p>
          De nieuwe mobiele basis staat klaar. In volgende stappen worden de
          bestaande Supabase-data en bewezen Stap-6-logica gecontroleerd aangesloten.
        </p>
      </section>

      <div className="section-heading">
        <h2>Jouw BoodschappenMaatje</h2>
        <span>mobiele testbasis</span>
      </div>

      <section className="feature-grid" aria-label="Onderdelen">
        {homeSections.map((section) => (
          <FeatureCard key={section.title} section={section} />
        ))}
      </section>
    </>
  );
}
