---
name: krew-code-review
description: Review KREW changes for correctness, scope, regressions, architecture consistency, and compliance with project rules. Use when reviewing a branch, PR, significant change, or before declaring a fix complete.
---

# KREW Code Review

Before reviewing, consult AGENTS.md and the relevant KREW project documentation.

## Method
1. Inspect the actual diff and surrounding implementation before forming conclusions.
2. Identify the root cause addressed by the change.
3. Check whether the implementation is broader than necessary.
4. Check data flow across UI, business logic, persistence, authentication, external APIs, normalization, scoring, and generation where applicable.
5. Check edge cases, loading/error states, stale data, race conditions, and missing data.
6. Verify that existing validated behavior has not been silently changed.
7. Check tests and whether they exercise the changed behavior.
8. Check build, type, lint, and test status when available.

## KREW invariants
- An explicit trip duration remains authoritative when one exists.
- Do not confuse nights with calendar days.
- Provider integrations should remain normalized and as provider-independent as practical.
- Minimize external API calls and verify final price/availability when relevant.
- Scoring changes must be checked for ranking regressions and missing-data behavior.
- Authentication and middleware changes are sensitive.
- Secrets stay in environment variables.

## Output
Report findings by severity: blocker, high, medium, low. For each actionable finding, give the exact path and location, concrete impact, and smallest safe fix. Do not invent problems merely because another implementation would be preferable.
