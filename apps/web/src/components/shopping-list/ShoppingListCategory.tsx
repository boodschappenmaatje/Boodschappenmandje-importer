"use client";

import { useId, useState } from "react";
import type { ReactNode } from "react";
import { Icon } from "@/components/Icon";

const STORAGE_KEY = "boodschappenmaatje:collapsed-list-categories";

/** Presentation only: no list/provider mutation, also when filters hide a category. */
export function ShoppingListCategory({ category, count, children }: {
  category: string; count: number; children: ReactNode;
}) {
  const id = useId();
  const [collapsed, setCollapsed] = useState(false);
  const [restored, setRestored] = useState(false);
  // A ref callback runs after hydration; storage remains optional on this device.
  function restore(node: HTMLElement | null) {
    if (!node || restored) return;
    setRestored(true);
    try {
      const stored: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
      setCollapsed(Array.isArray(stored) && stored.includes(category));
    } catch { /* Start expanded if storage is unavailable. */ }
  }
  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    try {
      const stored: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
      const categories = new Set(Array.isArray(stored) ? stored.filter(value => typeof value === "string") : []);
      if (next) categories.add(category); else categories.delete(category);
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...categories]));
    } catch { /* In-memory disclosure still works. */ }
  }
  return <section ref={restore} className="ux-shopping-category" aria-label={category}>
    <h3><button className="shopping-category-toggle" type="button" aria-expanded={!collapsed} aria-controls={id} onClick={toggle}>
      <Icon name="products" size={17} /><span>{category}</span>
      <small aria-label={`${count} ${count === 1 ? "product" : "producten"}`}>{count}</small>
      <svg className="shopping-category-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
    </button></h3>
    <div id={id} hidden={collapsed}>{children}</div>
  </section>;
}
