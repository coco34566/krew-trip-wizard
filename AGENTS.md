# KREW — Agent Instructions

Before modifying the project, read only the KREW references relevant to the requested scope. Do not scan every document or large generated file by default.

## Core

Read `.agents/skills/krew-core/SKILL.md` for repository-wide agent rules, source-of-truth rules, change safety and validation.

## Product

Read `.agents/skills/krew-product/SKILL.md` when a change affects KREW product behavior, participant preferences, Star logic, constraints, recommendations, scoring, destination discovery, accommodation, transport, activities, planning, packing, dates or user-facing product behavior.

For detailed implementation history of recommendation/discovery behavior, consult `docs/recommendation-engine-audit.md` only when that engine is in scope.

## Technical

Read `.agents/skills/krew-technical/SKILL.md` when a change affects architecture, React/TanStack Start/Vite, Supabase, Vercel, APIs, external integrations, database or infrastructure.

For external travel providers, deep links, affiliation or data provenance, also consult `docs/external_search.md`.

For route conventions, consult `src/routes/README.md` only when routing is in scope.

## Design

Read `DESIGN.md` when a change affects KREW visual language, layout, branding, responsive behavior, icons, KrewMarks, stickers or the otter mascot.

For a repository-wide UX/UI audit or an Impeccable-driven review, also read `PRODUCT.md` and `docs/impeccable-audit-plan.md` before evaluating or changing any user-facing surface.

## Legal / privacy

Read `README_LEGAL.md` and the relevant `docs/data-*` / `docs/legal-*` reference only when the change affects personal data, cookies, retention, external processors, affiliation tracking or legal copy.

## Archives

Files under `archive/`, `docs/archive/` and `.lovable/plan/` are historical material. They are **not** current product or technical sources of truth and must not override current code, tests, active skills or active docs.

## Source of truth

The actual implementation and relevant tests are the source of truth for current implemented behavior. Documentation describes intended invariants and architecture, but must not be treated as proof that the code already behaves differently.

When product documentation and implementation differ:
1. inspect the code and tests;
2. identify the discrepancy;
3. do not invent behavior;
4. do not silently change a product rule.

## Change discipline

Before modifying code:
- inspect the relevant implementation and direct consumers;
- identify the root cause;
- define the scope;
- modify only what is necessary;
- validate the affected behavior and relevant regressions.

Do not perform unrelated refactors. Do not read large JSON, generated files, migrations or unrelated documentation unless the task requires them.

## Documentation

Keep each durable rule in one authoritative place whenever possible. Update documentation when a stabilized engine behavior, provider priority or invariant changes. Do not duplicate entire documents in `AGENTS.md`.