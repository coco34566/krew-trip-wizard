# KREW Core Skill

## Purpose

This skill defines repository-wide rules for AI agents working on KREW. It replaces the need to duplicate generic agent rules across multiple project documents.

## Source of truth

The current code is the source of truth for implemented behavior.

Documentation may describe intended or observed behavior, but must not be assumed to be perfectly synchronized with the implementation.

When code and documentation disagree:
1. inspect the implementation;
2. identify the discrepancy;
3. do not invent behavior;
4. do not silently reinterpret a product rule.

## Work before modification

Before changing code:
- inspect the relevant implementation;
- identify the root cause, not only the symptom;
- inspect consumers and dependencies;
- inspect relevant tests;
- define the smallest safe scope.

Do not make opportunistic refactors.

## Change discipline

Prefer changes that:
- modify the smallest necessary surface;
- preserve existing interfaces where possible;
- preserve validated behavior outside the requested scope;
- are easy to test and revert.

Never modify unrelated files merely because they could be improved.

## Validation

A change is not considered complete merely because the code compiles.

When relevant, distinguish:
- code validation;
- tests;
- build;
- deployment;
- real functional verification.

Pre-existing failures must be distinguished from regressions introduced by the change.

## Provider independence

KREW must remain independent from any specific development tool or AI coding environment.

Lovable, Jules, ChatGPT, Vercel, Supabase, RapidAPI and external providers are implementation tools or integrations, not product authorities.

A technical provider must never redefine a KREW business rule.

## Documentation

Keep rules in one authoritative place whenever possible.

Do not duplicate entire documents into skills. Link or reference detailed documentation when necessary.
