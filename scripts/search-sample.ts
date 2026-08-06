// scripts/search-sample.ts
// Simple script to test the hotels RapidAPI provider locally (ts-node or compiled)
import { searchHotelsRapidAPI } from "@/integrations/external/hotels.rapidapi";

async function main() {
  const destination = process.env.TEST_DEST || process.env.TEST_DESTINATION || "Barcelona";
  const checkin = process.env.TEST_CHECKIN || "2026-09-10";
  const checkout = process.env.TEST_CHECKOUT || "2026-09-12";
  try {
    const list = await searchHotelsRapidAPI({ destination, checkin, checkout, adults: 2, pageSize: 10 });
    console.log("Found hotels:", (list || []).slice(0, 5));
  } catch (err) {
    console.error("Search failed:", err);
    process.exit(1);
  }
}

main();
