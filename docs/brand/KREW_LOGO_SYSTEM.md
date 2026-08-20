# KREW — Logo system

Status: **LOCKED visual direction — integration pending final vector master**

This document freezes the KREW logo system approved on 2026-08-20. It is intentionally isolated from application code while the global redesign is in progress.

## Official palette

- Deep plum: `#6B3A5D`
- Sage green: `#8FA89B`
- White: `#FFFFFF`
- Plum ink: `#1C151B`
- Neutral grey: `#F7F8F7`

No gradients, shadows, glow, texture or alternate brand colours may be introduced in production logo assets.

## Locked visual master

The approved mark consists of:

1. the otter symbol;
2. the custom `KREW` wordmark;
3. the sage accent in the final `W`;
4. optional tagline: `LA TEAM. LE PLAN. LE MOMENT.`

The otter drawing, line-weight variations, wordmark proportions, spacing and colour split must not be redrawn or reinterpreted during implementation.

## Required variants

| ID | Variant | Content | Light background | Plum background |
|---|---|---|---|---|
| 1 | Full | Otter + KREW + tagline | plum + sage | white + sage |
| 2 | Compact | Otter + KREW | plum + sage | white + sage |
| 3 | Wordmark | KREW | plum + sage | white + sage |
| 4 | Symbol | Otter | plum | white |

The sage accent remains sage in both themes.

## Planned production filenames

```text
public/brand/
  krew-logo-full-light.svg
  krew-logo-full-dark.svg
  krew-logo-compact-light.svg
  krew-logo-compact-dark.svg
  krew-wordmark-light.svg
  krew-wordmark-dark.svg
  krew-otter-light.svg
  krew-otter-dark.svg
```

Favicon/PWA exports are derived from the locked otter master after the SVG master has been validated.

## Intended application usage

- Landing / institutional hero: full logo where space allows.
- Main product header: compact logo.
- Narrow horizontal areas: wordmark.
- Favicon / app icon / avatar: otter symbol.
- Plum surfaces: dark/inverted variant.
- White/light surfaces: light variant.

A single future `KrewLogo` component should own variant/theme selection. Pages must not recreate, recolour or manipulate the SVG independently.

Suggested API:

```tsx
<KrewLogo variant="full | compact | wordmark | icon" theme="light | dark" />
```

## Protection rules

- Preserve aspect ratio.
- Do not stretch, rotate or crop the mark.
- Do not change the otter line work or line-weight hierarchy.
- Do not recolour individual parts outside the defined theme variants.
- Do not add gradients, shadows, outlines, embossing or effects.
- Keep sufficient clear space around the logo.
- Never use a generated raster mockup as the production logo.

## Merge strategy

This branch deliberately contains brand documentation only. It must not modify the current landing page, authenticated layout, dashboard, navigation, product components, business logic or user copy.

After the active Jules redesign PR is merged:

1. update this branch from the new `main` if necessary;
2. validate the final SVG masters against the approved visual reference;
3. add SVG/PNG/favicon/PWA assets under `public/brand/`;
4. merge the asset-only change;
5. create a separate integration branch for `KrewLogo` and replacement of existing logo placements;
6. visually verify desktop + mobile before merging integration.

This separation is intentional to minimize merge conflicts and make rollback trivial.
