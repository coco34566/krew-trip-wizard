# KREW Technical Skill

## Purpose

This skill contains technical implementation rules for KREW. Product rules in `krew-product` have priority over generic technical preferences.

## Architecture

Before modifying an architectural component, inspect its dependencies, consumers and established boundaries. Avoid unnecessary rewrites.

## Application stack

Follow the existing Next.js/React architecture and conventions. Do not introduce framework changes unless required by the task.

## Supabase

Before modifying schema, queries, RPCs, authentication, storage or database functions, inspect existing dependencies and affected application flows.

Do not change database behavior without checking consumers and relevant tests.

## External APIs

Keep provider-specific logic behind appropriate integration boundaries. Normalize external data before it enters core KREW decision logic.

KREW should remain as provider-independent as practical. RapidAPI is an integration gateway where appropriate, not a business-rule authority.

Any pull request that adds or changes an external API or LLM call must explicitly verify its trigger, cache and in-flight deduplication strategy, bounded retries, server-side rate limiting, and the absence of unbounded loops. Expensive calls must be user-triggered or operationally necessary; a component mount, repeated invalidation, double click or frontend bug must not be able to exhaust provider quotas.

## Authentication and secrets

Treat Supabase Auth, sessions, JWTs, middleware, cookies and authenticated server functions as sensitive areas.

Keep secrets in environment configuration. Never hardcode credentials, API keys or tokens in code or Markdown.

## Dependencies

Before adding or upgrading a dependency, check current usage, compatibility, build impact and deployment impact. Do not add dependencies for problems already solved by the project.

## CI and deployment

Before changing GitHub Actions, inspect existing workflows and determine whether the target workflow is still necessary.

For application changes, validate the relevant build, tests and deployment/runtime behavior. Do not modify application code merely to satisfy an obsolete script or workflow.

## Data and normalization

External data should be normalized at integration boundaries. Preserve distinctions such as real API data versus estimated fallback data when they affect product behavior.

## Validation

For technical changes, run the relevant type checks, lint, tests and build. When applicable, verify Preview/runtime behavior and distinguish pre-existing failures from regressions.
