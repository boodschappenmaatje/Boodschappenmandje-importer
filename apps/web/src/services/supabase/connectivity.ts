import type { SupabaseClient } from "@supabase/supabase-js";

export type ConnectivityResult =
  | { ok: true }
  | { ok: false; message: string };

/**
 * Niet-destructieve controle tegen een tabel die al read-only RLS-beleid heeft.
 * Deze service voert bewust geen insert/update/delete/upsert of RPC uit.
 */
export async function checkSupabaseConnectivity(
  client: SupabaseClient,
): Promise<ConnectivityResult> {
  const { error } = await client.from("recipes").select("id").limit(1);

  if (error) {
    return { ok: false, message: error.message };
  }

  return { ok: true };
}
