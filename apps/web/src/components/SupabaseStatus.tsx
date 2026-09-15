"use client";

import { useState } from "react";

import { Icon } from "@/components/Icon";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { getPublicSupabaseConfig } from "@/lib/supabase/config";
import { checkSupabaseConnectivity } from "@/services/supabase/connectivity";

type Status = "idle" | "checking" | "connected" | "error";

export function SupabaseStatus() {
  const config = getPublicSupabaseConfig();
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState(
    config.configured
      ? "Publieke clientconfiguratie is aanwezig."
      : "Nog niet lokaal geconfigureerd.",
  );

  async function checkConnection() {
    const client = getSupabaseBrowserClient();
    if (!client) {
      setStatus("error");
      setMessage("Vul eerst de twee publieke Supabase-variabelen in.");
      return;
    }

    setStatus("checking");
    setMessage("Read-only verbinding wordt gecontroleerd…");
    const result = await checkSupabaseConnectivity(client);

    if (result.ok) {
      setStatus("connected");
      setMessage("Read-only verbinding met Supabase werkt.");
      return;
    }

    setStatus("error");
    setMessage("Verbinding niet bevestigd. Controleer configuratie en RLS.");
  }

  return (
    <section className="status-card" data-status={status}>
      <span className="status-icon"><Icon name="cloud" /></span>
      <div>
        <h2>Supabase-connectiviteit</h2>
        <p>{message}</p>
      </div>
      <button
        type="button"
        onClick={checkConnection}
        disabled={status === "checking"}
      >
        {status === "checking" ? "Controleren…" : "Controleer veilig"}
      </button>
    </section>
  );
}
