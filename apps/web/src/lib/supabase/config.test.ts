import { describe, expect, it } from "vitest";

import { parsePublicSupabaseConfig } from "./config";

describe("parsePublicSupabaseConfig", () => {
  it("accepteert een HTTPS URL met een publishable key", () => {
    expect(
      parsePublicSupabaseConfig({
        url: "https://voorbeeld.supabase.co",
        publishableKey: "sb_publishable_voorbeeld",
      }),
    ).toEqual({
      configured: true,
      value: {
        url: "https://voorbeeld.supabase.co",
        publishableKey: "sb_publishable_voorbeeld",
      },
    });
  });

  it("blijft veilig ongeconfigureerd als waarden ontbreken", () => {
    expect(parsePublicSupabaseConfig({})).toEqual({
      configured: false,
      reason: "missing",
    });
  });

  it("weigert een server-side Supabase secret key", () => {
    expect(
      parsePublicSupabaseConfig({
        url: "https://voorbeeld.supabase.co",
        publishableKey: "sb_secret_nooit_in_de_browser",
      }),
    ).toEqual({ configured: false, reason: "secret-key" });
  });

  it("weigert ook een service-role JWT", () => {
    const encode = (value: object) =>
      Buffer.from(JSON.stringify(value)).toString("base64url");
    const serviceRoleJwt = `${encode({ alg: "HS256" })}.${encode({
      role: "service_role",
    })}.handtekening`;

    expect(
      parsePublicSupabaseConfig({
        url: "https://voorbeeld.supabase.co",
        publishableKey: serviceRoleJwt,
      }),
    ).toEqual({ configured: false, reason: "secret-key" });
  });

  it("weigert een niet-HTTPS URL", () => {
    expect(
      parsePublicSupabaseConfig({
        url: "http://voorbeeld.supabase.co",
        publishableKey: "sb_publishable_voorbeeld",
      }),
    ).toEqual({ configured: false, reason: "invalid-url" });
  });

  it("normaliseert een bestaande REST-basis naar de project-URL", () => {
    expect(
      parsePublicSupabaseConfig({
        url: "https://voorbeeld.supabase.co/rest/v1/",
        publishableKey: "sb_publishable_voorbeeld",
      }),
    ).toEqual({
      configured: true,
      value: {
        url: "https://voorbeeld.supabase.co",
        publishableKey: "sb_publishable_voorbeeld",
      },
    });
  });
});
