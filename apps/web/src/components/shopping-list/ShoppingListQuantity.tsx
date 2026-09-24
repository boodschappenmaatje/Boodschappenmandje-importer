import { Icon } from "@/components/Icon";

/** Presentation only. Both row and details receive the same existing mutation callbacks. */
export function ShoppingListQuantity({ quantity, onDecrease, onIncrease, decreaseLabel, increaseLabel, decreaseDisabled, increaseDisabled, label, output }: {
  quantity: number; onDecrease: () => void; onIncrease: () => void;
  decreaseLabel: string; increaseLabel: string; decreaseDisabled?: boolean; increaseDisabled?: boolean; label: string; output?: string;
}) {
  return <div className="quantity-control" role="group" aria-label={label}>
    <button type="button" aria-label={decreaseLabel} disabled={decreaseDisabled} onClick={onDecrease}><Icon name="minus" size={17} /></button>
    <output aria-live="polite" aria-label={output ?? `${quantity} stuks`}>{output ?? quantity}</output>
    <button type="button" aria-label={increaseLabel} disabled={increaseDisabled} onClick={onIncrease}><Icon name="plus" size={17} /></button>
  </div>;
}
