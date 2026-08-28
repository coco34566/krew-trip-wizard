# KREW — Product context

## Platform

web

## Register

KREW is primarily a product UI. Marketing surfaces such as the landing page, FAQ, pricing and about pages may use a brand/editorial register, but authenticated trip organization surfaces must remain product-first.

## Audience

KREW is for groups of friends and relatives organizing short trips, weekends, celebrations and group getaways. People may be organizers, co-organizers or participants, and the product must remain understandable even for participants who open it only occasionally on a phone.

## Purpose

KREW turns a messy group-trip organization process into one coherent journey: collect availability and preferences, establish the trip profile, help the group choose a destination and accommodation, organize transport, build the plan, distribute tasks and prepare the trip.

The interface must make a complex coordination engine feel simple, progressive and enjoyable.

## Distinctive product claim

KREW is not a generic travel search engine, booking marketplace or project-management dashboard. It combines the group's constraints and preferences into one guided trip-organizing experience and keeps the resulting decisions understandable to the whole group.

## Experience principles

1. The complexity stays in the engine; simplicity belongs to the interface.
2. Each page may have its own composition, while typography, spacing, controls, states and visual language remain coherent across the product.
3. The main journey must feel easy to follow and should always make the next meaningful action understandable.
4. Mobile, tablet and desktop are first-class surfaces. Portrait and landscape layouts must not overflow, collide or hide essential actions.
5. Organizer, co-organizer and participant views can differ according to product permissions; design work must never invent or silently change those permissions.
6. Empty, loading, success, disabled, selected, error and completed states are part of the product experience and must be reviewed explicitly.
7. KREW should feel like a contemporary European travel brand turned into a digital product, not like a generic SaaS, AI-generated dashboard or booking marketplace.

## Product boundaries

- Do not change business rules, recommendation logic, permissions, scoring, provider logic or data semantics during a visual audit unless explicitly requested.
- Do not invent data, statuses, recommendations, participant counts or progress messages for decorative purposes.
- Do not replace existing KREW assets or visual-language components with generic component-library equivalents when a correct KREW primitive already exists.
- Do not introduce a second design system.
- Do not optimize one breakpoint by degrading another.
- Do not treat all content as cards. Progressive disclosure, editorial composition, photography and open layouts are preferred when they fit the task.

## Brand commitments

The authoritative visual rules live in `DESIGN.md`. Impeccable and any other design tool must treat that file as the source of truth for palette, typography, layout grammar, KrewIcons, KrewMarks, KrewNotes, KrewHighlights, otter usage, density, responsive behavior and anti-patterns.

Core brand intent:

- sober + editorial + contemporary + human + fun;
- white and photography carry most of the visual surface;
- prune and sage are controlled accents, not generic AI gradients;
- Instrument Serif carries emotion, Plus Jakarta Sans carries interface/action, Space Mono carries precision/data, Caveat is restricted to handwritten KREW annotations;
- otters are semantic brand characters, not filler;
- KrewMarks and post-its must point to real information;
- visual interest should come from composition, photography, meaningful illustration, hierarchy and rhythm rather than decorative chrome.

## Audit expectation

A KREW-wide design audit is exhaustive. It includes the landing and public pages, authentication and join/invitation surfaces, trip creation, trip lists, dashboard, every page and state of the trip journey, account/settings surfaces, archived/empty/error/loading states, shared components and navigation. It must review coherence within each page and across pages at mobile, tablet and desktop breakpoints before proposing implementation changes.
