import Image from "next/image";

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
  return (
    <span
      className={className}
      data-has-image={Boolean(asset)}
      data-image-source={asset?.source ?? "placeholder"}
    >
      {asset ? (
        <Image
          alt={`Gerecht: ${title}`}
          fill
          sizes={sizes}
          src={asset.src}
          priority={priority}
        />
      ) : (
        <Icon name="prepare" size={25} />
      )}
    </span>
  );
}
