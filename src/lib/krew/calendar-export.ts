export type TripLike = {
  id?: string;
  name: string;
  start_date?: string | null;
  startDate?: string | null;
  end_date?: string | null;
  endDate?: string | null;
  dates_locked?: boolean | null;
  datesLocked?: boolean | null;
  group_itinerary?: any;
};

/**
 * Formate une date YYYY-MM-DD et une heure HH:mm au format ICS (sans Z pour heure locale)
 */
function formatIcsDateTime(dateStr: string, timeStr: string): string {
  const cleanDate = dateStr.replace(/[-]/g, ""); // "2026-08-01" -> "20260801"
  const cleanTime = timeStr.replace(/[:]/g, ""); // "09:00" -> "0900"
  return `${cleanDate}T${cleanTime}00`;
}

/**
 * Formate une date YYYY-MM-DD pour un événement all-day
 */
function formatIcsDate(dateStr: string): string {
  return dateStr.replace(/[-]/g, "");
}

/**
 * Génère une date exclusive du lendemain pour DTEND d'un événement all-day
 */
function getNextDayStr(dateStr: string): string {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + 1);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}${mm}${dd}`;
}

/**
 * Génère un fichier .ics valide si les dates sont verrouillées.
 * Retourne null sinon.
 */
export function buildTripIcs(trip: TripLike, itineraryInput?: any): string | null {
  const datesLocked = trip.dates_locked === true || trip.datesLocked === true;
  if (!datesLocked) {
    return null;
  }

  const startDateStr = trip.start_date || trip.startDate;
  const endDateStr = trip.end_date || trip.endDate;

  if (!startDateStr || !endDateStr) {
    return null;
  }

  const name = trip.name || "Mon Voyage Krew";
  const itinerary = itineraryInput || trip.group_itinerary;

  let icsLines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Krew//Trip Wizard//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  const days = itinerary?.days;
  if (Array.isArray(days) && days.length > 0) {
    // Un événement par slot d'activité
    let currentDayIndex = 0;
    for (const d of days) {
      const dayNum = d.day || (currentDayIndex + 1);
      // Calcul de la date du jour si non spécifiée
      let dayDateStr = d.date;
      if (!dayDateStr) {
        const start = new Date(startDateStr);
        start.setDate(start.getDate() + (dayNum - 1));
        const yyyy = start.getFullYear();
        const mm = String(start.getMonth() + 1).padStart(2, "0");
        const dd = String(start.getDate()).padStart(2, "0");
        dayDateStr = `${yyyy}-${mm}-${dd}`;
      }

      const slots = d.slots;
      if (Array.isArray(slots)) {
        for (let sIdx = 0; sIdx < slots.length; sIdx++) {
          const slot = slots[sIdx];
          const label = slot.label || slot.title || "Activité Krew";
          const detail = slot.detail || slot.description || "";
          const moment = String(slot.moment || "").toLowerCase();

          // Détermination de l'heure selon le moment (ordre de priorité important, eg après-midi contient midi)
          let startHour = "10:00";
          let endHour = "12:00";

          if (moment.includes("matin")) {
            startHour = "09:00";
            endHour = "12:00";
          } else if (moment.includes("apres-midi") || moment.includes("après-midi") || moment.includes("apres_midi")) {
            startHour = "14:00";
            endHour = "17:00";
          } else if (moment.includes("midi") || moment.includes("dejeuner") || moment.includes("déjeuner")) {
            startHour = "12:00";
            endHour = "14:00";
          } else if (moment.includes("fin_de_journee") || moment.includes("fin de journée") || moment.includes("fin")) {
            startHour = "17:00";
            endHour = "19:00";
          } else if (moment.includes("soir")) {
            startHour = "19:00";
            endHour = "22:00";
          }

          const dtStart = formatIcsDateTime(dayDateStr, startHour);
          const dtEnd = formatIcsDateTime(dayDateStr, endHour);
          const uid = `krew-slot-${trip.id || "trip"}-${dayNum}-${sIdx}@krew.io`;

          icsLines.push("BEGIN:VEVENT");
          icsLines.push(`UID:${uid}`);
          icsLines.push(`SUMMARY:${label}`);
          if (detail) {
            // Éviter les retours à la ligne non échappés dans l'ICS
            const cleanDetail = detail.replace(/\r?\n/g, "\\n");
            icsLines.push(`DESCRIPTION:${cleanDetail}`);
          }
          icsLines.push(`DTSTART:${dtStart}`);
          icsLines.push(`DTEND:${dtEnd}`);
          icsLines.push("END:VEVENT");
        }
      }
      currentDayIndex++;
    }
  } else {
    // Événement all-day couvrant le séjour
    const dtStart = formatIcsDate(startDateStr);
    const dtEnd = getNextDayStr(endDateStr); // DTEND exclusif pour all-day
    const uid = `krew-all-day-${trip.id || "trip"}@krew.io`;

    icsLines.push("BEGIN:VEVENT");
    icsLines.push(`UID:${uid}`);
    icsLines.push(`SUMMARY:${name}`);
    icsLines.push(`DTSTART;VALUE=DATE:${dtStart}`);
    icsLines.push(`DTEND;VALUE=DATE:${dtEnd}`);
    icsLines.push("END:VEVENT");
  }

  icsLines.push("END:VCALENDAR");

  return icsLines.join("\r\n");
}
