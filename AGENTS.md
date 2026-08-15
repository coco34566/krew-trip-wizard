# KREW — Agent Instructions

Before modifying the project, read the relevant KREW Skill.

## Core

Read `.agents/skills/krew-core/SKILL.md` for repository-wide agent rules, source-of-truth rules, change safety and validation.

## Product

Read `.agents/skills/krew-product/SKILL.md` when a change affects KREW product behavior, participant preferences, Star logic, constraints, recommendations, scoring, travel, accommodation, dates or user-facing product behavior.

## Technical

Read `.agents/skills/krew-technical/SKILL.md` when a change affects architecture, Next.js/React, Supabase, Vercel, APIs, external integrations, database or infrastructure.

## Source of truth

The actual implementation is the source of truth for current behavior. Documentation must not be treated as proof that the code already behaves differently.

When product documentation and implementation differ:
1. inspect the code and tests;
2. identify the discrepancy;
3. do not invent behavior;
4. do not silently change a product rule.

## Change discipline

Before modifying code:
- inspect the relevant implementation;
- identify the root cause;
- define the scope;
- modify only what is necessary;
- validate the affected behavior and relevant regressions.

Do not perform unrelated refactors.

## Documentation

Keep detailed rules in the appropriate Skill or documentation file. Do not duplicate entire documents in `AGENTS.md`.
