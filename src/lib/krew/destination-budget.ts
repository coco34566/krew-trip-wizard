export type DestinationBudget = {
  transport?: number | null;
  accommodation?: number | null;
  activities?: number | null;
  food?: number | null;
  priceSource?: {
    transport?: string | null;
    accommodation?: string | null;
  } | null;
};

export function destinationBudgetTotal(budget: DestinationBudget): number {
  return (
    Number(budget.transport || 0) +
    Number(budget.accommodation || 0) +
    Number(budget.activities || 0) +
    Number(budget.food || 0)
  );
}

export function isDestinationBudgetEstimated(budget: DestinationBudget): boolean {
  const transportVerified = budget.priceSource?.transport === "provider";
  const accommodationVerified = ["provider", "web"].includes(
    budget.priceSource?.accommodation || "",
  );
  return !transportVerified || !accommodationVerified;
}
