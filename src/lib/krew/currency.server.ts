type FxRate = {
  rate: number;
  date: string | null;
  source: string;
};

const eurRateCache = new Map<string, FxRate>();

function normalizeCurrency(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const code = value.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(code) ? code : null;
}

export async function getRateToEur(currencyInput: unknown): Promise<FxRate | null> {
  const currency = normalizeCurrency(currencyInput);
  if (!currency) return null;
  if (currency === "EUR") return { rate: 1, date: null, source: "native_eur" };
  const cached = eurRateCache.get(currency);
  if (cached) return cached;
  try {
    const response = await fetch(`https://api.frankfurter.dev/v2/rate/${currency}/EUR`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(3500),
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as any;
    const rate = Number(payload?.rate);
    if (!Number.isFinite(rate) || rate <= 0) return null;
    const result = {
      rate,
      date: typeof payload?.date === "string" ? payload.date : null,
      source: "frankfurter",
    } satisfies FxRate;
    eurRateCache.set(currency, result);
    return result;
  } catch {
    return null;
  }
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

async function normalizeSlotPriceToEur(slot: any): Promise<any> {
  if (!slot || typeof slot !== "object") return slot;
  const next = { ...slot };

  const estimatedCurrency = normalizeCurrency(next.estimatedPriceCurrency);
  const estimatedMin = Number(next.estimatedPriceMinPerPerson);
  const estimatedMax = Number(next.estimatedPriceMaxPerPerson);
  if (
    estimatedCurrency &&
    estimatedCurrency !== "EUR" &&
    Number.isFinite(estimatedMin) &&
    Number.isFinite(estimatedMax)
  ) {
    const fx = await getRateToEur(estimatedCurrency);
    if (fx) {
      next.estimatedPriceOriginalCurrency = estimatedCurrency;
      next.estimatedPriceOriginalMinPerPerson = estimatedMin;
      next.estimatedPriceOriginalMaxPerPerson = estimatedMax;
      next.estimatedPriceFxRate = fx.rate;
      next.estimatedPriceFxDate = fx.date;
      next.estimatedPriceFxSource = fx.source;
      next.estimatedPriceMinPerPerson = roundMoney(estimatedMin * fx.rate);
      next.estimatedPriceMaxPerPerson = roundMoney(estimatedMax * fx.rate);
      next.estimatedPriceCurrency = "EUR";
    }
  }

  const directCurrency = normalizeCurrency(next.currency);
  const directPrice = next.pricePerPerson ?? next.priceHint ?? next.price;
  const numericDirect = Number(directPrice);
  if (directCurrency && directCurrency !== "EUR" && Number.isFinite(numericDirect)) {
    const fx = await getRateToEur(directCurrency);
    if (fx) {
      next.originalCurrency = directCurrency;
      next.originalPricePerPerson = numericDirect;
      next.fxRateToEur = fx.rate;
      next.fxDate = fx.date;
      next.fxSource = fx.source;
      const converted = roundMoney(numericDirect * fx.rate);
      if (next.pricePerPerson != null) next.pricePerPerson = converted;
      else if (next.priceHint != null) next.priceHint = converted;
      else if (next.price != null) next.price = converted;
      next.currency = "EUR";
    }
  }

  return next;
}

export async function normalizeItineraryPricesToEur<T extends { days?: any[]; backups?: any[] }>(
  itinerary: T,
): Promise<T> {
  const days = await Promise.all(
    (Array.isArray(itinerary?.days) ? itinerary.days : []).map(async (day: any) => ({
      ...day,
      slots: await Promise.all(
        (Array.isArray(day?.slots) ? day.slots : []).map((slot: any) => normalizeSlotPriceToEur(slot)),
      ),
    })),
  );
  const backups = Array.isArray(itinerary?.backups)
    ? await Promise.all(itinerary.backups.map((slot: any) => normalizeSlotPriceToEur(slot)))
    : itinerary?.backups;
  return { ...itinerary, days, ...(backups ? { backups } : {}) } as T;
}
