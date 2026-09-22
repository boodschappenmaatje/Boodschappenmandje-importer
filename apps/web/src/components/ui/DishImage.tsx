"use client";

import Image from "next/image";
import { useState } from "react";

import { Icon } from "@/components/Icon";
import type { DishImageAsset } from "@/services/week-preparation/recipe-images";

export function DishImage({
  asset,
  title,
  className,
  sizes,
  priority = false,
}: {
  asset: DishImageAsset | null;
  title: string;
  className: string;
  sizes: string;
  priority?: boolean;
}) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const visibleAsset = asset && asset.src !== failedSource ? asset : null;
  return (
    <span
      className={className}
      data-has-image={Boolean(visibleAsset)}
      data-image-source={visibleAsset?.source ?? "placeholder"}
    >
      {visibleAsset ? (
        <Image
          alt={`Gerecht: ${title}`}
          fill
          sizes={sizes}
          src={visibleAsset.src}
          onError={() => setFailedSource(visibleAsset.src)}
          priority={priority}
        />
      ) : (
        <Icon name="prepare" size={25} />
      )}
    </span>
  );
}
