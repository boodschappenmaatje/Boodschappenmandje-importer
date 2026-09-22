"use client";

import Image from "next/image";
import { useState } from "react";
import { Icon } from "@/components/Icon";
import { safeProductImageUrl } from "@/services/catalog/catalog-presentation";

/** Use the stored product photo; a missing or failed source keeps a calm placeholder. */
export function ProductThumbnail({ imageUrl, name, className }: {
  imageUrl: string | null;
  name: string;
  className: string;
}) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const source = safeProductImageUrl(imageUrl);
  const visibleSource = source && source !== failedSource ? source : null;
  return (
    <span className={`${className} product-thumbnail`} data-has-image={Boolean(visibleSource)}>
      {visibleSource ? (
        <Image src={visibleSource} alt={`Afbeelding van ${name}`} width={64} height={64}
          unoptimized loading="lazy" onError={() => setFailedSource(visibleSource)} />
      ) : (
        <span role="img" aria-label={`Geen productafbeelding: ${name}`}><Icon name="products" size={24} /></span>
      )}
    </span>
  );
}
