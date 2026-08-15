# KREW Core Skill

## Purpose

This skill defines repository-wide rules and the working method for AI agents working on KREW. It absorbs the durable, cross-cutting parts of the former development and AI-workflow documents.

## Source of truth

The current code and tests are the source of truth for implemented behavior.

Documentation may describe intended or observed behavior, but must not be assumed to be perfectly synchronized with the implementation.

When code and documentation disagree:
1. inspect the implementation and tests;
2. identify the discrepancy;
3. do not invent behavior;
4. do not silently reinterpret a product rule.

## Before modifying code

1. Reformulate the problem precisely.
2. Identify the affected user flow.
3. Locate the responsible code.
4. Search related functions, components and consumers.
5. Inspect recent changes when relevant.
6. Check dependencies, workflows and environment configuration when relevant.
7. Determine the root cause before changing code.

Never assume the repository matches an older known version.

## Change discipline

Prefer the smallest change that correctly solves the requested problem.

Preserve:
- existing interfaces where possible;
- validated behavior outside the requested scope;
- relevant data flows;
- established architectural boundaries.

Do not perform opportunistic refactors, unrelated cleanup or rewrites merely because another implementation looks simpler.

## Sensitive areas

Treat authentication, database schema/RLS, scoring, travel duration, questionnaires, external APIs, prices/availability, deployment configuration and CI workflows as potentially transversal areas.

Before modifying a sensitive area, inspect its consumers and test the directly affected flow plus relevant dependent flows.

## Validation

Distinguish four different validations:
1. code/type/lint/build validation;
2. automated tests;
3. deployment/runtime validation;
4. real functional/user-flow validation.

A build passing does not prove that the feature works.

A change is complete only when the relevant levels have been performed or any unperformed level is explicitly reported.

Pre-existing failures must be distinguished from regressions introduced by the change.

## GitHub and CI

Before creating or modifying a GitHub Actions workflow, inspect existing workflows and determine whether an existing workflow already covers the need.

Temporary workflows must be removed once their purpose is complete.

Never modify application code merely to satisfy an obsolete or overly fragile script. Investigate the workflow first.

Before a pull request is considered ready, inspect the diff, changed files and relevant checks. A red check must be understood rather than simply ignored.

## Deployment

For application changes, when applicable:
- verify the build;
- verify Preview deployment;
- test the affected flow on Preview;
- verify production after merge when production is affected.

## Security and secrets

Never hardcode, commit or expose secrets, tokens or credentials.

Environment variable names may be documented; secret values must not be.

## Provider independence

KREW must remain independent from any specific development tool or AI coding environment.

Lovable, Jules, ChatGPT, Vercel, Supabase, RapidAPI and external providers are implementation tools or integrations, not product authorities.

A technical provider must never redefine a KREW business rule.

## Communication

When a task is completed, report clearly:
- what changed;
- why it changed;
- affected files;
- tests/checks performed;
- deployment/runtime verification when applicable;
- anything that remains unverified.

## Documentation

Keep each rule in one authoritative place whenever possible.

Do not duplicate entire documents into skills. Detailed domain documentation belongs in `docs/` or the relevant specialized reference.
