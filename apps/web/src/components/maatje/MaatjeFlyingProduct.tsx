"use client";
import { useLayoutEffect, useRef } from "react";
import { safeProductImageUrl } from "@/services/catalog/catalog-presentation";
import type { Product } from "@/types/catalog";

/** Het mandje staat rechtsonder naast Maatje, bij zijn tover-hand. */
export function cartRect(target: DOMRect): DOMRect {
  const size = target.width * 0.46;
  const left = Math.min(target.right - size * 0.5, window.innerWidth - size - 6);
  return new DOMRect(left, target.bottom - size * 0.82, size, size);
}

const FLIGHT_MS = 1150;

/**
 * Een getoverd product: het verschijnt met glinsters in Maatjes hand en
 * zweeft in een boogje zijn mandje in. Het is een gewone foto boven de
 * 3D-scène, zodat elke productfoto werkt.
 */
export function MaatjeFlyingProduct({ product, from, to, onLanded }: {
  product: Product;
  from: () => { x: number; y: number } | null;
  to: DOMRect;
  onLanded: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const landedRef = useRef(onLanded);
  useLayoutEffect(() => {
    landedRef.current = onLanded;
  });

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const start = from() ?? { x: to.left - to.width * 0.4, y: to.top - to.height * 0.4 };
    const end = { x: to.left + to.width * 0.5, y: to.top + to.height * 0.38 };
    const peak = { x: (start.x + end.x) / 2, y: Math.min(start.y, end.y) - 70 };
    const at = (point: { x: number; y: number }, scale: number, rotate = 0) =>
      `translate(${point.x}px, ${point.y}px) translate(-50%, -50%) scale(${scale}) rotate(${rotate}deg)`;
    const animation = element.animate([
      { transform: at(start, 0.01), opacity: 0, offset: 0 },
      { transform: at(start, 0.01), opacity: 0, offset: 0.12 },
      { transform: at(start, 1.2, -8), opacity: 1, offset: 0.26, easing: "ease-out" },
      { transform: at(start, 1, 0), opacity: 1, offset: 0.4, easing: "ease-in-out" },
      { transform: at(peak, 0.85, 14), opacity: 1, offset: 0.66, easing: "ease-in" },
      { transform: at(end, 0.55, 24), opacity: 1, offset: 0.9 },
      { transform: at({ x: end.x, y: end.y + 14 }, 0.3, 30), opacity: 0, offset: 1 },
    ], { duration: FLIGHT_MS, fill: "forwards" });
    animation.onfinish = () => landedRef.current();
    return () => animation.cancel();
    // Eén vlucht per product: start- en eindpunt liggen vast bij het verschijnen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const image = safeProductImageUrl(product.imageUrl);
  return <div ref={ref} className="maatje-fly" aria-hidden="true">
    <span className="maatje-fly-card">
      {/* eslint-disable-next-line @next/next/no-img-element -- korte animatie, geen optimalisatie nodig */}
      {image ? <img src={image} alt="" /> : <span className="maatje-fly-initial">{product.name.charAt(0)}</span>}
    </span>
    <span className="maatje-fly-sparks"><i /><i /><i /><i /><i /></span>
  </div>;
}
