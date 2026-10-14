import type { Metadata } from "next";

import { DiscoverProductsView } from "@/components/catalog/DiscoverProductsView";

export const metadata: Metadata = { title: "Ontdek & bespaar" };

export default function DiscoverPage() {
  return <DiscoverProductsView />;
}
