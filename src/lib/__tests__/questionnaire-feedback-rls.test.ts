import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("questionnaire feedback RLS", () => {
  const sql = readFileSync(
    "supabase/migrations/20260920154500_restrict_questionnaire_feedback_reads.sql",
    "utf8",
  );

  it("removes member-wide participant answer reads", () => {
    expect(sql).toContain('DROP POLICY IF EXISTS "Members can view trip answers"');
    expect(sql).toContain('DROP POLICY IF EXISTS "participant prefs select own or owner"');
    expect(sql).toContain('CREATE POLICY "participant prefs select own or admin"');
    expect(sql).toContain("user_id = (SELECT auth.uid())");
    expect(sql).toContain("public.is_trip_admin(trip_id, (SELECT auth.uid()))");
  });

  it("restricts Star preference reads to trip admins", () => {
    expect(sql).toContain('DROP POLICY IF EXISTS "star_prefs select members"');
    expect(sql).toContain('DROP POLICY IF EXISTS "star_prefs select authorized"');
    expect(sql).toContain('CREATE POLICY "star_prefs select admins"');
    expect(sql).toContain("public.is_trip_admin(trip_id, (SELECT auth.uid()))");
  });
});
