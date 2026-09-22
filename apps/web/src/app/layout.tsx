import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import { AppShell } from "@/components/AppShell";
import { PwaRegistrar } from "@/components/PwaRegistrar";
import { appConfig } from "@/config/app";
import { appIconUrl } from "@/config/app-icons";
import { BudgetProvider } from "@/features/budget/BudgetProvider";
import { ActiveShoppingListProvider } from "@/features/shopping-list/ActiveShoppingListProvider";
import { WeekPreparationProvider } from "@/features/week-preparation/WeekPreparationProvider";

import "./globals.css";

export const metadata: Metadata = {
  applicationName: appConfig.name,
  title: {
    default: appConfig.name,
    template: `%s · ${appConfig.name}`,
  },
  description: appConfig.description,
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: appConfig.shortName,
  },
  icons: {
    icon: [
      { url: appIconUrl("maatje-v1-favicon.ico"), sizes: "16x16 32x32 48x48", type: "image/x-icon" },
      { url: appIconUrl("maatje-v1-favicon-16.png"), sizes: "16x16", type: "image/png" },
      { url: appIconUrl("maatje-v1-favicon-32.png"), sizes: "32x32", type: "image/png" },
      { url: appIconUrl("maatje-v1-192.png"), sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: appIconUrl("maatje-v1-apple-touch.png"), sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: appConfig.themeColor,
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="nl">
      <body>
        <ActiveShoppingListProvider>
          <BudgetProvider>
            <WeekPreparationProvider>
              <AppShell>{children}</AppShell>
            </WeekPreparationProvider>
          </BudgetProvider>
        </ActiveShoppingListProvider>
        <PwaRegistrar />
      </body>
    </html>
  );
}
