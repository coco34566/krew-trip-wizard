-- Evaluate auth.uid() once per statement instead of once per row.
-- Parenthesized SELECTs are semantically equivalent and preserve every policy's
-- command, role, USING expression, and WITH CHECK expression.

alter policy "destination candidate pool read member" on public.destination_candidate_pool
  using (is_trip_member(trip_id, (select auth.uid())));

alter policy "destination candidate pool write admin" on public.destination_candidate_pool
  using (exists (
    select 1 from public.trips t
    where t.id = destination_candidate_pool.trip_id
      and (t.owner_id = (select auth.uid()) or t.co_organizer_id = (select auth.uid()))
  ))
  with check (exists (
    select 1 from public.trips t
    where t.id = destination_candidate_pool.trip_id
      and (t.owner_id = (select auth.uid()) or t.co_organizer_id = (select auth.uid()))
  ));

alter policy "destination_feedback write own" on public.destination_feedback
  using (participant_id in (
    select tp.id from public.trip_participants tp
    where tp.trip_id = destination_feedback.trip_id
      and tp.user_id = (select auth.uid())
  ))
  with check (participant_id in (
    select tp.id from public.trip_participants tp
    where tp.trip_id = destination_feedback.trip_id
      and tp.user_id = (select auth.uid())
  ));

alter policy "members delete destination feedback" on public.destination_feedback
  using (is_trip_member(trip_id, (select auth.uid())));

alter policy "members read destination feedback" on public.destination_feedback
  using (is_trip_member(trip_id, (select auth.uid())));

alter policy "members update destination feedback" on public.destination_feedback
  using (is_trip_member(trip_id, (select auth.uid())))
  with check (is_trip_member(trip_id, (select auth.uid())));

alter policy "members write destination feedback" on public.destination_feedback
  with check (is_trip_member(trip_id, (select auth.uid())));

alter policy "Users can insert their own rate limits" on public.generation_rate_limits
  with check ((select auth.uid()) = user_id);

alter policy "Users can read their own rate limits" on public.generation_rate_limits
  using ((select auth.uid()) = user_id);

alter policy "Users manage their own price watches" on public.price_watch
  using ((select auth.uid()) = created_by)
  with check (
    (select auth.uid()) = created_by
    and is_trip_member(trip_id, (select auth.uid()))
  );

alter policy "price_watch delete own" on public.price_watch
  using (created_by = (select auth.uid()));

alter policy "price_watch insert own" on public.price_watch
  with check (
    created_by = (select auth.uid())
    and is_trip_member(trip_id, (select auth.uid()))
  );

alter policy "price_watch select own" on public.price_watch
  using (
    created_by = (select auth.uid())
    or is_trip_member(trip_id, (select auth.uid()))
  );

alter policy "price_watch update own" on public.price_watch
  using (created_by = (select auth.uid()))
  with check (created_by = (select auth.uid()));

alter policy "members insert scoring feedback" on public.scoring_feedback
  with check (is_trip_member(trip_id, (select auth.uid())));

alter policy "members read scoring feedback" on public.scoring_feedback
  using (is_trip_member(trip_id, (select auth.uid())));

alter policy "members update scoring feedback" on public.scoring_feedback
  using (is_trip_member(trip_id, (select auth.uid())))
  with check (is_trip_member(trip_id, (select auth.uid())));

alter policy "Users can insert their own payments" on public.trip_payments
  with check (exists (
    select 1 from public.trip_participants tp
    where tp.id = trip_payments.participant_id
      and tp.user_id = (select auth.uid())
  ));

alter policy "Users can view payments for their trips" on public.trip_payments
  using (exists (
    select 1 from public.trip_participants tp
    where tp.trip_id = trip_payments.trip_id
      and tp.user_id = (select auth.uid())
  ));

alter policy "members create own trip payments" on public.trip_payments
  with check (is_trip_member(trip_id, (select auth.uid())));

alter policy "members read trip payments" on public.trip_payments
  using (is_trip_member(trip_id, (select auth.uid())));

alter policy "Users can manage their own transport time preferences" on public.trip_transport_time_prefs
  using (exists (
    select 1 from public.trip_participants tp
    where tp.id = trip_transport_time_prefs.participant_id
      and tp.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.trip_participants tp
    where tp.id = trip_transport_time_prefs.participant_id
      and tp.user_id = (select auth.uid())
  ));

alter policy "Users can view transport time preferences for their trips" on public.trip_transport_time_prefs
  using (exists (
    select 1 from public.trip_participants tp
    where tp.trip_id = trip_transport_time_prefs.trip_id
      and tp.user_id = (select auth.uid())
  ));

alter policy "members delete transport time prefs" on public.trip_transport_time_prefs
  using (is_trip_member(trip_id, (select auth.uid())));

alter policy "members insert transport time prefs" on public.trip_transport_time_prefs
  with check (is_trip_member(trip_id, (select auth.uid())));

alter policy "members read transport time prefs" on public.trip_transport_time_prefs
  using (is_trip_member(trip_id, (select auth.uid())));

alter policy "members update transport time prefs" on public.trip_transport_time_prefs
  using (is_trip_member(trip_id, (select auth.uid())))
  with check (is_trip_member(trip_id, (select auth.uid())));
