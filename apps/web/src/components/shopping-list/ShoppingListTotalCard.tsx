import type { ShoppingListTotal } from "@/types/shopping-list";

const euroFormatter = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
});

export function ShoppingListTotalCard({ total }: { total: ShoppingListTotal }) {
  return (
    <section className="shopping-total" aria-labelledby="shopping-total-title">
      <div>
        <p id="shopping-total-title">
          {total.isPartial ? "Voorlopig totaal" : "Lijsttotaal"}
        </p>
        {total.availableTotal === null ? (
          <span>Nog geen betrouwbare prijzen beschikbaar</span>
        ) : total.missingPriceItemCount > 0 ? (
          <span>
            {total.missingPriceItemCount}{" "}
            {total.missingPriceItemCount === 1 ? "product" : "producten"} zonder
            prijs niet meegerekend
          </span>
        ) : (
          <span className="visually-hidden">Gebaseerd op de beschikbare actuele of laatst bekende prijzen</span>
        )}
      </div>
      {total.availableTotal === null ? null : (
        <strong>{euroFormatter.format(total.availableTotal)}</strong>
      )}
    </section>
  );
}
