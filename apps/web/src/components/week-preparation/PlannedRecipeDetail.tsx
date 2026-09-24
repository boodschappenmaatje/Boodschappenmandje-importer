"use client";
import { PackageMutationFeedback, usePackageMutation } from "@/features/week-preparation/usePackageMutation";
import type { WeekPreparation } from "@/types/week-preparation";
import { CompactRecipeDetail } from "./CompactRecipeDetail";

export function PlannedRecipeDetail({ preparation, dayIndex }: { preparation: WeekPreparation; dayIndex: number }) {
  const mutation = usePackageMutation();
  return <>
    <CompactRecipeDetail preparation={mutation.pending?.preparation ?? preparation} dayIndex={dayIndex}
      onQuantityChange={(ingredientId, quantity) => void mutation.change(dayIndex, ingredientId, quantity)} quantityBusy={mutation.blocked} />
    <PackageMutationFeedback mutation={mutation} />
  </>;
}
