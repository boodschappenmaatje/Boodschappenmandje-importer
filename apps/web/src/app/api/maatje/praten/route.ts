import { getSupabasePublicServerClient } from "@/lib/supabase/server";
import { geminiCaller, parseAssistantRequest, runMaatjeAssistant } from "@/server/maatje-assistant";
import { isSameOriginPlannerRequest } from "@/server/planner-cache-auth";
import { SupabaseCatalogRepository } from "@/services/catalog/catalog-repository";

export const runtime = "nodejs";
export const maxDuration = 60;

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 20;
const recent = new Map<string, number[]>();

/** Eenvoudige rem per toestel, zodat niemand de gratis Gemini-laag leeg trekt. */
function rateLimited(request: Request): boolean {
  const key = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "onbekend";
  const now = Date.now();
  const hits = (recent.get(key) ?? []).filter(time => now - time < WINDOW_MS);
  hits.push(now);
  recent.set(key, hits);
  if (recent.size > 500) recent.clear();
  return hits.length > MAX_PER_WINDOW;
}

export async function POST(request: Request): Promise<Response> {
  if (!isSameOriginPlannerRequest(request)) return Response.json({ error: "forbidden" }, { status: 403 });
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  const client = getSupabasePublicServerClient();
  if (!apiKey || !client) {
    console.error("maatje-praten", !apiKey ? "gemini-key-missing" : "supabase-missing");
    return Response.json({ error: "not-configured" }, { status: 503 });
  }
  if (rateLimited(request)) return Response.json({ error: "too-many-requests" }, { status: 429 });

  let input: ReturnType<typeof parseAssistantRequest>;
  try {
    input = parseAssistantRequest(await request.json());
  } catch {
    input = null;
  }
  if (!input) return Response.json({ error: "invalid-request" }, { status: 400 });

  try {
    // Zonder GEMINI_MODEL kiest Maatje zelf het snelste beschikbare model.
    const model = process.env.GEMINI_MODEL?.trim() || null;
    const started = Date.now();
    const callGemini = geminiCaller(apiKey, model);
    let geminiMs = 0;
    const timedGemini = async (body: unknown) => {
      const begin = Date.now();
      try {
        return await callGemini(body);
      } finally {
        geminiMs = Date.now() - begin;
      }
    };
    const result = await runMaatjeAssistant(input, timedGemini, new SupabaseCatalogRepository(client));
    const totalMs = Date.now() - started;
    console.info("maatje-praten", `klaar in ${totalMs} ms (Gemini ${geminiMs} ms, catalogus ${totalMs - geminiMs} ms), ${result.items.length} producten`);
    return Response.json(result);
  } catch (error) {
    console.error("maatje-praten", error instanceof Error ? error.message : "unknown");
    return Response.json({ error: "assistant-failed" }, { status: 502 });
  }
}
