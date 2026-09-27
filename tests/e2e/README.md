# KREW E2E data convention

Playwright tests that create real Supabase trips must use one of the reserved prefixes exported by `test-trip-constants.ts`:

- `E2E-KREW-`
- `E2E-FULL-`
- `VISUAL-AUDIT-`
- `JOIN-VISUAL-AUDIT-`

Use `testTripName(prefix)` (or the existing `disposableTripName` wrapper) instead of writing a prefix inline.

The first Playwright invocation in a GitHub run authenticates once with `KREW_E2E_EMAIL`, caches that authenticated REST session in the runner temp directory, and removes only test-prefixed trips owned by that account that are older than 24 hours. Later Playwright invocations reuse the cached cleanup session instead of signing in again. Global teardown removes only test-prefixed trips tagged with the current run token and never re-authenticates if the cached session is unavailable. Every delete is additionally constrained by trip id, exact owner id and exact trip name, and relies on the authenticated Supabase session/RLS rather than a service-role key. Cleanup failures are warnings and never change the test result.

If more than 10 test-prefixed trips remain for the E2E account after teardown, the run emits a warning.

Longer term, use a dedicated Supabase project for automated tests so E2E data and production-like user data are physically isolated.
