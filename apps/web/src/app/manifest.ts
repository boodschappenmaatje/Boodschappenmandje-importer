import type { MetadataRoute } from "next";

import { appConfig } from "@/config/app";
import { appIconUrl } from "@/config/app-icons";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: appConfig.name,
    short_name: appConfig.shortName,
    description: appConfig.description,
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: appConfig.backgroundColor,
    theme_color: appConfig.themeColor,
    orientation: "portrait-primary",
    lang: "nl-NL",
    categories: ["shopping", "lifestyle", "productivity"],
    icons: [
      {
        src: appIconUrl("maatje-v1-192.png"),
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: appIconUrl("maatje-v1-512.png"),
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: appIconUrl("maatje-v1-maskable-512.png"),
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
