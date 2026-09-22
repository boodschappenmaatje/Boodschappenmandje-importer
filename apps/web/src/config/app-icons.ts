// These exact, versioned logo files are already public on the app's stable domain.
// iOS icon requests may not carry the Vercel Preview authentication cookie.
const PUBLIC_ICON_ORIGIN = "https://boodschappenmaatje-pwa.vercel.app";
export const APP_ICON_REVISION = "ios-2026-09-22";

export function appIconUrl(filename: string): string {
  const path = `/icons/${filename}?v=${APP_ICON_REVISION}`;
  return process.env.VERCEL_ENV === "preview" ? `${PUBLIC_ICON_ORIGIN}${path}` : path;
}
