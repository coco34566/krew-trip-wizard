import nodemailer from "nodemailer";
import { createClient } from "@supabase/supabase-js";
import { listUnansweredParticipants } from "@/lib/participant-preferences.functions";

const SUPABASE_URL = process.env.SUPABASE_URL as string;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string; // needs service role for certain reads if required
const SMTP_HOST = process.env.SMTP_HOST as string;
const SMTP_PORT = Number(process.env.SMTP_PORT ?? 587);
const SMTP_USER = process.env.SMTP_USER as string;
const SMTP_PASS = process.env.SMTP_PASS as string;
const EMAIL_FROM = process.env.EMAIL_FROM as string;
const APP_URL = process.env.APP_URL ?? "https://example.com";
const REMINDER_DAYS = Number(process.env.REMINDER_DAYS ?? 7);

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error("Supabase configuration missing (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)");
}
if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !EMAIL_FROM) {
  throw new Error("SMTP configuration missing (SMTP_HOST / SMTP_USER / SMTP_PASS / EMAIL_FROM)");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function sendEmail(to: string, subject: string, html: string) {
  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });

  return transporter.sendMail({
    from: EMAIL_FROM,
    to,
    subject,
    html,
  });
}

async function run() {
  console.log("Reminder job starting — looking for unanswered participants older than", REMINDER_DAYS, "days");

  // Fetch all trips (or restrict to recent ones if desired) — here we fetch trips created in the last 90 days to limit scope
  const { data: trips, error: tripsErr } = await supabase.from("trips").select("id, name, owner_id, created_at").gte("created_at", new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString());
  if (tripsErr) throw tripsErr;

  for (const trip of trips ?? []) {
    const unanswered = await listUnansweredParticipants(supabase, trip.id);
    // filter by created_at older than REMINDER_DAYS
    const toRemind = (unanswered ?? []).filter((p: any) => {
      if (!p.created_at) return false;
      return new Date(p.created_at) <= new Date(Date.now() - REMINDER_DAYS * 24 * 60 * 60 * 1000);
    });

    for (const participant of toRemind) {
      if (!participant.email) continue;
      const subject = `Rappel: merci de remplir ton questionnaire pour ${trip.name}`;
      const link = `${APP_URL}/trips/${trip.id}/questionnaire`;
      const html = `
        <p>Bonjour ${participant.display_name ?? ""},</p>
        <p>Tu as été invité·e au voyage <strong>${trip.name}</strong>. Nous n'avons pas encore reçu tes réponses au questionnaire. Peux-tu prendre 2 minutes pour le remplir ?</p>
        <p><a href="${link}">Remplir le questionnaire</a></p>
        <p>Merci !</p>
      `;

      try {
        await sendEmail(participant.email, subject, html);
        console.log("Sent reminder to", participant.email, "for trip", trip.id);
      } catch (e) {
        console.error("Failed to send reminder to", participant.email, e);
      }
    }
  }
}

if (require.main === module) {
  run()
    .then(() => console.log("Done"))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

export default run;
