"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import {
  CatalogPriceBlock,
} from "@/components/catalog/CatalogProductCard";
import { ProductThumbnail } from "@/components/ui/ProductThumbnail";
import { Icon } from "@/components/Icon";
import { useActiveShoppingList } from "@/features/shopping-list/ActiveShoppingListProvider";
import { createCatalogRepository } from "@/services/catalog/catalog-repository";
import { catalogReadErrorMessage } from "@/services/catalog/catalog-presentation";
import type { Product } from "@/types/catalog";

type ProductDetailState =
  | { status: "loading" }
  | { status: "loaded"; product: Product }
  | { status: "not-found" }
  | { status: "error"; message: string };

export function ProductDetailView({ productId }: { productId: string }) {
  const router = useRouter();
  const shoppingList = useActiveShoppingList();
  const [state, setState] = useState<ProductDetailState>({ status: "loading" });
  const [isAdding, setIsAdding] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadProduct() {
      try {
        const result = await createCatalogRepository(shoppingList.supermarketId).getByIds(
          [productId],
          controller.signal,
        );
        if (controller.signal.aborted) return;
        const product = result.products.find((item) => item.id === productId);
        setState(product ? { status: "loaded", product } : { status: "not-found" });
      } catch (error) {
        if (!controller.signal.aborted) {
          setState({ status: "error", message: catalogReadErrorMessage(error) });
        }
      }
    }

    void loadProduct();
    return () => controller.abort();
  }, [productId, shoppingList.supermarketId]);

  async function addProduct(product: Product) {
    if (shoppingList.status !== "ready" || isAdding) return;
    const previousQuantity = shoppingList.quantityFor(product.id);
    setIsAdding(true);
    setFeedback(null);
    try {
      await shoppingList.addProduct(product);
      setFeedback(
        previousQuantity > 0
          ? `Toegevoegd — aantal nu ${previousQuantity + 1}`
          : `${product.name} staat op je lijst`,
      );
    } catch {
      setFeedback("Dit product kon niet veilig aan je lijst worden toegevoegd.");
    } finally {
      setIsAdding(false);
    }
  }

  async function adjustQuantity(productId: string, direction: "up" | "down") {
    if (shoppingList.status !== "ready" || isAdding) return;
    setIsAdding(true);
    try {
      if (direction === "up") await shoppingList.increase(productId);
      else await shoppingList.decrease(productId);
    } catch {
      setFeedback("Je hoeveelheid kon niet veilig worden aangepast.");
    } finally {
      setIsAdding(false);
    }
  }

  return (
    <section className="product-detail-view">
      <button className="product-detail-back" type="button" onClick={() => router.back()}>
        <span aria-hidden="true">←</span> Terug naar producten
      </button>

      {state.status === "loading" ? (
        <div className="catalog-state" role="status" aria-busy="true">
          <span className="catalog-spinner" aria-hidden="true" />
          <div><h2>Product laden</h2><p>Even geduld…</p></div>
        </div>
      ) : null}

      {state.status === "not-found" ? (
        <div className="catalog-state" role="status">
          <span className="status-icon"><Icon name="products" /></span>
          <div><h2>Product niet gevonden</h2><p>Dit product is niet meer beschikbaar in de catalogus.</p></div>
        </div>
      ) : null}

      {state.status === "error" ? (
        <div className="catalog-state" data-kind="error" role="status">
          <span className="status-icon"><Icon name="cloud" /></span>
          <div><h2>Product tijdelijk niet beschikbaar</h2><p>{state.message}</p></div>
        </div>
      ) : null}

      {state.status === "loaded" ? (
        <article className="product-detail-card">
          <ProductThumbnail className="product-detail-image" imageUrl={state.product.imageUrl} name={state.product.name} />
          <div className="product-detail-copy">
            <p className="product-category">
              {state.product.category ?? state.product.productType ?? "Hoogvliet"}
            </p>
            <h1>{state.product.name}</h1>
            {[state.product.brand, state.product.packageText].filter(Boolean).length ? (
              <p className="product-detail-description">
                {[state.product.brand, state.product.packageText].filter(Boolean).join(" · ")}
              </p>
            ) : null}
            <CatalogPriceBlock product={state.product} detail />
            <p className="product-price-source">Prijsbron: Hoogvliet</p>
            {shoppingList.quantityFor(state.product.id) > 0 && shoppingList.list?.items.find(item => item.productId === state.product.id)?.quantityContributions.mealPlans.length === 0 ? (
              <div className="detail-quantity" aria-label={`Aantal ${shoppingList.quantityFor(state.product.id)}`}>
                <button type="button" disabled={isAdding || shoppingList.quantityFor(state.product.id) <= 1} aria-label={`Minder ${state.product.name}`} onClick={() => void adjustQuantity(state.product.id, "down")}>−</button>
                <output aria-live="polite">{shoppingList.quantityFor(state.product.id)}</output>
                <button type="button" disabled={isAdding} aria-label={`Meer ${state.product.name}`} onClick={() => void adjustQuantity(state.product.id, "up")}>+</button>
              </div>
            ) : <button
              className="product-detail-add"
              type="button"
              disabled={shoppingList.status !== "ready" || isAdding}
              onClick={() => void addProduct(state.product)}
            >
              <Icon name="plus" size={20} />
              {isAdding
                ? "Toevoegen…"
                : shoppingList.quantityFor(state.product.id) > 0
                  ? "Nog één toevoegen"
                  : "Toevoegen aan lijst"}
            </button>}
            {shoppingList.quantityFor(state.product.id) > 0 ? (
              <p className="product-detail-list-status">
                Op je lijst · {shoppingList.quantityFor(state.product.id)}
              </p>
            ) : null}
            {feedback ? <p className="product-add-feedback" role="status">{feedback}</p> : null}
          </div>
        </article>
      ) : null}
    </section>
  );
}
