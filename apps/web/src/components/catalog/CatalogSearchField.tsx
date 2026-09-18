"use client";

import type { ChangeEventHandler, Ref } from "react";

import { Icon } from "@/components/Icon";

interface CatalogSearchFieldProps {
  value: string;
  placeholder: string;
  ariaLabel: string;
  onChange: ChangeEventHandler<HTMLInputElement>;
  onClear?: () => void;
  className?: string;
  inputRef?: Ref<HTMLInputElement>;
  autoFocus?: boolean;
}

export function CatalogSearchField({
  value,
  placeholder,
  ariaLabel,
  onChange,
  onClear,
  className,
  inputRef,
  autoFocus = false,
}: CatalogSearchFieldProps) {
  return (
    <label className={["catalog-search-field", className].filter(Boolean).join(" ")}>
      <Icon name="products" size={20} />
      <span className="visually-hidden">{ariaLabel}</span>
      <input
        ref={inputRef}
        type="search"
        value={value}
        placeholder={placeholder}
        aria-label={ariaLabel}
        autoComplete="off"
        enterKeyHint="search"
        spellCheck={false}
        autoFocus={autoFocus}
        onChange={onChange}
      />
      {onClear && value ? (
        <button
          className="catalog-search-clear"
          type="button"
          aria-label="Wis zoekterm"
          onClick={onClear}
        >
          ×
        </button>
      ) : null}
    </label>
  );
}
