import { Icon } from "@/components/Icon";

/** Presentation only. Both row and details receive the same existing mutation callbacks. */
export function ShoppingListQuantity({ quantity, onDecrease, onIncrease, decreaseLabel, increaseLabel, decreaseDisabled, increaseDisabled, label, output, onRemove, removeLabel }: {
  quantity: number; onDecrease: () => void; onIncrease: () => void;
  decreaseLabel: string; increaseLabel: string; decreaseDisabled?: boolean; increaseDisabled?: boolean; label: string; output?: string;
  onRemove?: () => void; removeLabel?: string;
}) {
  const remove = quantity === 1 && Boolean(onRemove);
  return <div className="quantity-control" role="group" aria-label={label}>
    <button type="button" className={remove ? "quantity-remove" : undefined} aria-label={remove ? removeLabel : decreaseLabel} disabled={decreaseDisabled} onClick={event => { event.stopPropagation(); if (remove) onRemove?.(); else onDecrease(); }}><Icon name={remove ? "trash" : "minus"} size={17} /></button>
    <output aria-live="polite" aria-label={output ?? `${quantity} stuks`}>{output ?? quantity}</output>
    <button type="button" aria-label={increaseLabel} disabled={increaseDisabled} onClick={event => { event.stopPropagation(); onIncrease(); }}><Icon name="plus" size={17} /></button>
  </div>;
}
