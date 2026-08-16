const ENDPOINT = "https://api.stayapi.com/v1/booking/destinations/lookup";

function pickArray(payload: any): any[] {
  const candidates = [payload?.data, payload?.data?.results, payload?.data?.destinations, payload?.results, payload?.destinations];
  return candidates.find(Array.isArray) ?? [];
}

export async function lookupStayApiDestination(query: string, language = "fr") {
  const key = process.env["STAYAPI_API_KEY"];
  if (!key) throw new Error("STAYAPI_API_KEY is not configured");
  const qs = new URLSearchParams({ query, language });
  const response = await fetch(`${ENDPOINT}?${qs}`, {
    method: "GET",
    headers: { "x-api-key": key, Accept: "application/json" },
  });
  const text = await response.text();
  let body: any;
  try { body = JSON.parse(text); } catch { body = { raw: text }; }
  if (!response.ok || body?.success === false) {
    throw new Error(`StayAPI /v1/booking/destinations/lookup → ${response.status}: ${JSON.stringify(body).slice(0, 500)}`);
  }
  const candidates = pickArray(body);
  const norm = query.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const exact = candidates.find((d: any) => String(d?.name ?? d?.label ?? d?.city_name ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim() === norm);
  const city = candidates.find((d: any) => String(d?.dest_type ?? d?.type ?? "").toLowerCase() === "city");
  const d = exact ?? city ?? candidates[0];
  const id = d?.dest_id ?? d?.destination_id ?? d?.id;
  if (!id) throw new Error(`StayAPI: destination ID introuvable pour "${query}"`);
  return { id: String(id), type: String(d?.dest_type ?? d?.type ?? "CITY").toUpperCase() };
}
