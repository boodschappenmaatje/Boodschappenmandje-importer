"use client";
import { useLayoutEffect, useRef } from "react";
import { safeProductImageUrl } from "@/services/catalog/catalog-presentation";
import type { Product } from "@/types/catalog";

/** Het karretje staat rechtsonder naast Maatje, net onder zijn tover-hand. */
export function cartRect(target: DOMRect): DOMRect {
  const size = target.width * 0.5;
  const left = Math.min(target.right - size * 0.3, window.innerWidth - size - 4);
  return new DOMRect(left, target.bottom - size * 0.72, size, size);
}

/** Maatje heft eerst zijn hand; pas op de knip verschijnt het product (zie SNAP in maatje-scene). */
const SNAP_CLICK_MS = 300;
const FLIGHT_MS = 1100;

function fly(element: HTMLDivElement, snap: HTMLDivElement, start: { x: number; y: number }, to: DOMRect, onLanded: () => void): Animation {
  snap.style.transform = `translate(${start.x}px, ${start.y}px)`;
  snap.dataset.on = "true";
  element.dataset.on = "true";
  const end = { x: to.left + to.width * 0.5, y: to.top + to.height * 0.38 };
  const peak = { x: (start.x + end.x) / 2, y: Math.min(start.y, end.y) - 70 };
  const at = (point: { x: number; y: number }, scale: number, rotate = 0) =>
    `translate(${point.x}px, ${point.y}px) translate(-50%, -50%) scale(${scale}) rotate(${rotate}deg)`;
  const animation = element.animate([
    { transform: at(start, 0.2), opacity: 0, offset: 0 },
    { transform: at(start, 1.25, -8), opacity: 1, offset: 0.14, easing: "ease-out" },
    { transform: at(start, 1, 0), opacity: 1, offset: 0.3, easing: "ease-in-out" },
    { transform: at(peak, 0.85, 14), opacity: 1, offset: 0.62, easing: "ease-in" },
    { transform: at(end, 0.55, 24), opacity: 1, offset: 0.9 },
    { transform: at({ x: end.x, y: end.y + 14 }, 0.3, 30), opacity: 0, offset: 1 },
  ], { duration: FLIGHT_MS, fill: "forwards" });
  animation.onfinish = onLanded;
  return animation;
}

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
  const snapRef = useRef<HTMLDivElement>(null);
  const landedRef = useRef(onLanded);
  useLayoutEffect(() => {
    landedRef.current = onLanded;
  });

  useLayoutEffect(() => {
    const element = ref.current;
    const snap = snapRef.current;
    if (!element || !snap) return;
    let animation: Animation | null = null;
    // Wacht tot Maatjes hand omhoog is en hij knipt; begin dan vanaf die hand.
    const timer = window.setTimeout(() => {
      const start = from() ?? { x: to.left - to.width * 0.4, y: to.top - to.height * 0.4 };
      animation = fly(element, snap, start, to, () => landedRef.current());
    }, SNAP_CLICK_MS);
    return () => {
      window.clearTimeout(timer);
      animation?.cancel();
    };
    // Eén vlucht per product: start- en eindpunt liggen vast bij het verschijnen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const image = safeProductImageUrl(product.imageUrl);
  return <>
    {/* Het knipje zelf: een witte flits met streepjes bij zijn vingers. */}
    <div ref={snapRef} className="maatje-snap" aria-hidden="true"><i /><i /><i /><i /><i /><i /></div>
    <div ref={ref} className="maatje-fly" aria-hidden="true">
      <span className="maatje-fly-card">
        {/* eslint-disable-next-line @next/next/no-img-element -- korte animatie, geen optimalisatie nodig */}
        {image ? <img src={image} alt="" /> : <span className="maatje-fly-initial">{product.name.charAt(0)}</span>}
      </span>
      <span className="maatje-fly-sparks"><i /><i /><i /><i /><i /></span>
    </div>
  </>;
}
