# KREW Technical Skill

## Purpose

This skill contains technical implementation rules for KREW. Product rules in `krew-product` have priority over generic technical preferences.

## Architecture

Before modifying an architectural component, inspect its dependencies, consumers and established boundaries. Avoid unnecessary rewrites.

## Application stack

KREW currently uses React 19 with TanStack Start / TanStack Router, Vite, TypeScript, Tailwind CSS and Supabase, deployed through Vercel. Follow the existing architecture and conventions. Do not introduce Next.js, Remix or another framework convention into the application unless an explicit migration is requested.

Routing is file-based under `src/routes/`; `src/routeTree.gen.ts` is generated and must not be edited manually. See `src/routes/README.md` when routing is in scope.

## Supabase

Before modifying schema, queries, RPCs, authentication, storage or database functions, inspect existing dependencies and affected application flows.

Do not change database behavior without checking consumers and relevant tests. Do not read the complete migration history when a targeted schema/query inspection is sufficient.

## External APIs and providers

Keep provider-specific logic behind appropriate integration boundaries. Normalize external data before it enters core KREW decision logic.

KREW should remain provider-independent where practical. RapidAPI, Travelpayouts, SearchAPI, GetYourGuide and other providers are integration mechanisms, not business-rule authorities.

Preserve provenance: distinguish live provider offers, external search/deep links and KREW estimates. Never turn an estimate into an apparently verified price, duration or availability.

Provider priorities and current fallbacks are documented in `docs/external_search.md`; inspect that document and the actual integration code before changing a travel provider.

## Authentication and secrets

Treat Supabase Auth, sessions, JWTs, middleware, cookies and authenticated server functions as sensitive areas.

Keep secrets in environment configuration. Never hardcode credentials, API keys or tokens in code or Markdown.

## Dependencies

Before adding or upgrading a dependency, check current usage, compatibility, build impact and deployment impact. Do not add dependencies for problems already solved by the project. Prefer the committed lockfile and existing package manager workflow.

## CI and deployment

Before changing GitHub Actions, inspect existing workflows and determine whether the target workflow is still necessary.

For application changes, validate the relevant build, tests and deployment/runtime behavior. Do not modify application code merely to satisfy an obsolete script or workflow.

## Data and normalization

External data should be normalized at integration boundaries. Preserve distinctions such as real API data versus estimated fallback data when they affect product behavior.

## Validation

For technical changes, run the relevant type checks, lint, tests and build. When applicable, verify Preview/runtime behavior and distinguish pre-existing failures from regressions.