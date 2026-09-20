import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("questionnaire feedback RLS", () => {
  const sql = readFileSync(
    "supabase/migrations/20260920154500_restrict_questionnaire_feedback_reads.sql",
    "utf8",
  );
  const rollback = readFileSync(
    "supabase/rollbacks/20260920154500_restore_questionnaire_reads.sql",
    "utf8",
  );
  const starPreferencesSource = readFileSync("src/lib/star-preferences.functions.ts", "utf8");

  it("prevents an ordinary member from reading another participant questionnaire", () => {
    expect(sql).toContain('DROP POLICY IF EXISTS "Members can view trip answers"');
    expect(sql).toContain('DROP POLICY IF EXISTS "participant prefs select own or owner"');
    expect(sql).toContain('CREATE POLICY "participant prefs select own or admin"');

    const participantSelect = sql.slice(
      sql.indexOf('CREATE POLICY "participant prefs select own or admin"'),
      sql.indexOf('DROP POLICY IF EXISTS "star_prefs select members"'),
    );
    expect(participantSelect).toContain("user_id = (SELECT auth.uid())");
    expect(participantSelect).toContain("public.is_trip_admin(trip_id, (SELECT auth.uid()))");
    expect(participantSelect).not.toContain("public.is_trip_member");
  });

  it("lets only trip admins or the identified Star read and upsert Star preferences", () => {
    expect(sql).toContain('CREATE POLICY "star_prefs select admin or star"');
    expect(sql).toContain('CREATE POLICY "star_prefs insert admin or star"');
    expect(sql).toContain('CREATE POLICY "star_prefs update admin or star"');
    expect(sql.match(/trips\.star_user_id = \(SELECT auth\.uid\(\)\)/g)).toHaveLength(4);
    expect(sql.match(/public\.is_trip_admin\(trip_id, \(SELECT auth\.uid\(\)\)\)/g)?.length).toBeGreaterThanOrEqual(4);

    expect(starPreferencesSource).toContain(
      "const isActualStar = Boolean(trip.data.star_user_id && trip.data.star_user_id === userId);",
    );
    expect(starPreferencesSource).toContain(
      'if (starMode === "participant" && !isAdmin && !isActualStar)',
    );
    expect(starPreferencesSource).toContain(
      'if (starMode === "participant" && !isActualStar)',
    );
    expect(starPreferencesSource).not.toContain(
      'throw new Error("Le questionnaire Star est réservé au mode secret")',
    );
  });

  it("keeps aggregate reads behind an authenticated trip-access check before using supabaseAdmin", () => {
    const files = [
      "src/lib/availability-read.functions.ts",
      "src/lib/trips/queries.functions.ts",
      "src/lib/trips/recommendations.functions.ts",
      "src/lib/trips/recap.functions.ts",
      "src/lib/trips/itinerary.legacy.functions.ts",
      "src/lib/trips/logistics.legacy.functions.ts",
    ];

    for (const file of files) {
      const source = readFileSync(file, "utf8");
      expect(source, file).toContain('import("@/integrations/supabase/client.server")');
    }

    const availability = readFileSync("src/lib/availability-read.functions.ts", "utf8");
    expect(availability.indexOf('.from("trips")')).toBeLessThan(availability.indexOf("supabaseAdmin"));
    expect(availability).toContain(
      "getTripAvailabilityHelper(supabaseAdmin, context.userId, data.tripId)",
    );

    const queries = readFileSync("src/lib/trips/queries.functions.ts", "utf8");
    expect(queries).toContain('supabaseAdmin\n          .from("trip_participant_preferences")');
    expect(queries).toContain('supabaseAdmin\n          .from("trip_star_preferences")');
    expect(queries).toContain("aggregateParticipantPreferences(supabaseAdmin, data.tripId)");

    for (const file of [
      "src/lib/trips/recommendations.functions.ts",
      "src/lib/trips/recap.functions.ts",
      "src/lib/trips/itinerary.legacy.functions.ts",
      "src/lib/trips/logistics.legacy.functions.ts",
    ]) {
      const source = readFileSync(file, "utf8");
      expect(source, file).not.toContain("aggregateParticipantPreferences(supabase, data.tripId)");
    }
  });

  it("provides an explicit rollback to the previous member-wide read policies", () => {
    expect(rollback).toContain('CREATE POLICY "Members can view trip answers"');
    expect(rollback).toContain("public.is_trip_member(trip_id, (SELECT auth.uid()))");

    expect(rollback).toContain('CREATE POLICY "participant prefs select own or owner"');
    expect(rollback).toContain("user_id = (SELECT auth.uid())");
    expect(rollback).toContain("public.is_trip_owner(trip_id, (SELECT auth.uid()))");
    expect(rollback).toContain("OR public.is_trip_member(trip_id, (SELECT auth.uid()))");

    expect(rollback).toContain('CREATE POLICY "star_prefs select authorized"');
    expect(rollback).toContain(
      "public.can_access_trip_star_preferences(trip_id, (SELECT auth.uid()))",
    );
  });
});
