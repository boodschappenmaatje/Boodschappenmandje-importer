"use client";

import { useSyncExternalStore } from "react";

import { greetingForHour, type Greeting } from "@/features/dashboard/greeting";

const subscribeToLocalTime = () => () => undefined;
const readLocalGreeting = (): Greeting => greetingForHour(new Date().getHours());
const readServerGreeting = (): Greeting | null => null;

export function DashboardHeader() {
  const greeting = useSyncExternalStore<Greeting | null>(
    subscribeToLocalTime,
    readLocalGreeting,
    readServerGreeting,
  );

  return (
    <header className="dashboard-header">
      <p className="dashboard-kicker">Jouw boodschappenweek</p>
      <h1 aria-live="polite">{greeting ?? "Welkom"}</h1>
      <p className="dashboard-lead">
        Alles wat je deze week nodig hebt, straks overzichtelijk bij elkaar.
      </p>
    </header>
  );
}
