import type { Metadata } from "next";

import { ProductDetailView } from "@/components/catalog/ProductDetailView";

export const metadata: Metadata = { title: "Productdetail" };

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = await params;
  return <ProductDetailView productId={productId} />;
}
