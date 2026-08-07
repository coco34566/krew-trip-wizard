# Krew

Krew is a React and TanStack Start group-trip planner backed by Supabase. The app includes trip creation, participant questionnaires, recommendation generation, voting, and trip detail views.

## Development

- Install dependencies with `bun install --frozen-lockfile`
- Start the app with `bun run dev`
- Validate with `npx tsc --noEmit` and `npm run build`

The existing `.env` file provides the Supabase connection variables required for local development. Keep the existing React, TanStack, Supabase, and Tailwind structure when making changes.

## User preferences

- Keep user-facing copy in French.
- Prefer small, targeted changes over restructuring or migrations.