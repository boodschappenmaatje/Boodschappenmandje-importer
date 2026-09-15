import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import { AppShell } from "@/components/AppShell";
import { PwaRegistrar } from "@/components/PwaRegistrar";
import { appConfig } from "@/config/app";
import { BudgetProvider } from "@/features/budget/BudgetProvider";
import { ActiveShoppingListProvider } from "@/features/shopping-list/ActiveShoppingListProvider";

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
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
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
            <AppShell>{children}</AppShell>
          </BudgetProvider>
        </ActiveShoppingListProvider>
        <PwaRegistrar />
      </body>
    </html>
  );
}
