/**
 * Fournisseurs hôtels + activités.
 *
 * StayAPI est désormais le provider hôtel principal.
 * RapidAPI reste disponible comme fallback pour les hôtels et pour les activités.
 *
 * Clés :
 * - STAYAPI_API_KEY pour StayAPI
 * - HOTELS_RAPIDAPI_KEY pour RapidAPI fallback / activités
 */

import { reportServerError } from "@/lib/server-error-report