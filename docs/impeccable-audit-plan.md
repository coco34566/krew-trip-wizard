# KREW — Impeccable audit protocol

This protocol defines how Impeccable must be used on KREW. It is an audit and decision framework, not permission to redesign or change product behavior automatically.

## 1. Sources of truth

Before any design review or visual change:

1. read `AGENTS.md`;
2. read `DESIGN.md`;
3. read `PRODUCT.md`;
4. inspect the actual implementation and relevant shared components;
5. treat current product behavior and tests as the source of truth for implemented behavior.

Impeccable recommendations never override KREW product rules, permissions, recommendation logic, data semantics or provider behavior.

## 2. Audit-first rule

The first KREW-wide pass is read-only.

Do not run an autonomous redesign or polish pass across the application before the audit has been reviewed and prioritized.

Recommended sequence:

1. `/impeccable critique` for UX, hierarchy, clarity, visual coherence and emotional quality;
2. `/impeccable audit` for accessibility, responsive robustness, implementation quality and design-system drift;
3. consolidate findings across all routes and states;
4. classify each finding as mandatory correction, consistency correction, simplification opportunity, polish/wow opportunity, intentional exception or false positive;
5. only then implement approved changes page by page or shared-component by shared-component;
6. use `/impeccable polish`, `/impeccable distill`, `/impeccable typeset`, `/impeccable layout` or other refine commands only on an explicitly approved scope.

## 3. Exhaustive product coverage

The audit covers the complete user-facing KREW product, not only the main trip journey.

### Public and marketing surfaces

- landing/home;
- pricing;
- FAQ;
- about;
- legal/privacy/cookie surfaces when they have user-facing UI;
- public error/not-found states.

### Authentication and entry surfaces

- sign in / sign up / authentication flows;
- join-trip and invitation entry points;
- loading, invalid-link, expired-link and error states where implemented.

### Trip creation and trip library

- new-trip flow;
- confirmation/transition states;
- trip list / "Mes voyages";
- organizer vs participant presentation;
- archived trips and empty states.

### Trip dashboard and global trip shell

- trip dashboard/overview;
- trip navigation and responsive navigation;
- members/group blocks;
- budget/cost summaries;
- next-action states;
- archive/delete controls;
- any organizer/co-organizer/participant variants.

### Main trip journey

Review every implemented state and role variant for:

- invitation/participants;
- availability;
- preferences/questionnaires;
- trip profile;
- destinations;
- accommodation;
- transport;
- planning;
- tasks;
- packing / preparation;
- recap/progress/journey surfaces;
- memories or locked future states when implemented.

### Account and secondary authenticated surfaces

- account/profile/settings;
- any notification, preference or personal-data surfaces;
- confirmation dialogs and destructive-action states;
- secondary modals, drawers, popovers, menus and toast patterns.

### Shared system surfaces

- header/navigation/footer variants;
- buttons and button states;
- inputs, selects, radios, checkboxes, sliders, date/calendar controls;
- cards only where they are semantically appropriate;
- tabs, badges, chips and filters;
- dialogs, sheets, popovers, menus and tooltips;
- loading, skeleton, empty, disabled, error, success, selected and completed states;
- KrewIcons, KrewMarks, KrewNotes, KrewHighlights and otter states;
- photography, image crops and media containers.

## 4. Breakpoint and viewport coverage

Every user-facing surface must be checked at multiple viewport classes. Do not approve a fix based on one preview only.

Minimum coverage:

- narrow mobile portrait;
- larger mobile portrait;
- mobile landscape where the layout materially changes;
- tablet portrait;
- tablet landscape / compact desktop;
- standard desktop;
- wide desktop when content width or composition can drift.

For each viewport, explicitly check:

- horizontal overflow;
- clipped or hidden text;
- title/otter/KrewMark collisions;
- buttons with cropped or off-center labels;
- unexpected wrapping;
- unsafe absolute positioning;
- inconsistent page margins;
- broken sticky/fixed elements;
- modal and popover clipping;
- image crop quality;
- touch-target sizing;
- content becoming too sparse or too dense.

## 5. Within-page review

For each page, verify:

- the page job is immediately understandable;
- title hierarchy and typography are correct;
- the introduction is short and useful;
- visual priority matches product priority;
- primary action is obvious without competing CTAs;
- secondary actions are appropriately quieter;
- content order matches the user's mental model;
- spacing creates rhythm rather than uniform gaps;
- information is not needlessly boxed into cards;
- borders, shadows and radii are used consistently and sparingly;
- imagery and brand elements support the content rather than fill empty space;
- KrewMarks point to something real;
- post-its communicate real data/status and remain close to their target;
- otters use the correct semantic state and never overlap content;
- icons are semantically correct and use KrewIcon when available;
- wording is concise, human, consistent and free of technical jargon;
- no information is duplicated unnecessarily;
- all interactive states are visually understandable.

## 6. Cross-page coherence review

After individual pages, review the product as one experience.

Verify consistency of:

- page gutters and maximum widths;
- title positioning and title-wave treatment;
- typography scale and font usage;
- section spacing;
- button height, padding, radius, alignment and state behavior;
- form control dimensions and selected states;
- active/inactive/disabled treatment;
- destructive actions;
- success and completion feedback;
- navigation behavior;
- KrewIcon sizing and alignment;
- otter sizing and placement;
- KrewNote/post-it density;
- KrewMark density and semantics;
- photography treatment;
- border/shadow/radius usage;
- mobile/tablet/desktop transitions.

Pages should belong to the same product without becoming identical templates.

## 7. KREW-specific anti-patterns

Flag and challenge:

- generic SaaS/dashboard appearance;
- AI-looking gradients, glow, glassmorphism or decorative effects;
- repeated identical card grids;
- cards nested inside cards;
- large framed containers wrapping whole page sections without a strong reason;
- excessive rounded rectangles;
- tiny gray text used to appear premium;
- arbitrary KrewMarks or floating doodles;
- post-its used as decoration rather than information;
- otters used only to fill whitespace;
- Lucide icons when an appropriate KrewIcon exists;
- invented statuses or fake progress;
- decorative animation without interaction or meaning;
- copy that sounds like an AI assistant rather than KREW;
- pages becoming excessively empty under the label of minimalism;
- page-specific button styles that drift from the shared system;
- fixes that improve mobile while degrading tablet/desktop, or vice versa.

## 8. Severity and disposition

Every finding should be assigned one disposition.

### P0 — Blocking

Broken interaction, unreadable content, serious collision/overflow, inaccessible critical action, or state that prevents task completion.

### P1 — High

Strong inconsistency, misleading hierarchy, incorrect state treatment, major responsive defect, unclear primary action, or obvious design-system violation.

### P2 — Medium

Noticeable polish, density, alignment, copy, component-consistency or visual-rhythm problem that harms perceived quality but not task completion.

### P3 — Opportunity

Optional delight, motion, progressive disclosure or distinctive KREW enhancement. These must not be implemented until P0/P1/P2 coherence issues are understood.

### Intentional exception / false positive

Record why the current treatment should remain. Do not mechanically satisfy a detector rule when the KREW design system or product context justifies the exception.

## 9. Output of the first exhaustive audit

The first audit must produce one consolidated report rather than immediately editing pages.

For each finding include:

- affected page(s) / component(s);
- breakpoint(s) and role/state where relevant;
- precise problem;
- why it matters;
- severity;
- whether the root cause is local or shared/transversal;
- recommended target behavior;
- risk of regression;
- whether Aceternity or another external pattern is actually useful, if applicable.

Finish with a prioritized implementation plan of no more than 10 coherent work packages. Shared/transversal root causes should be fixed before duplicating local patches page by page.

## 10. Aceternity usage rule

Aceternity is an inspiration/mechanics library, not KREW's design system.

Only consider an Aceternity pattern after the audit identifies a real interaction or presentation need. Reuse the interaction concept, not the visual identity.

Current candidate mechanics to evaluate where relevant:

- timeline / tracing progression for the trip journey;
- stateful action feedback for buttons;
- multi-step loading storytelling for genuine long-running generation states;
- expandable disclosure for dense destination/accommodation details;
- carousel/swipe behavior for naturally sequential visual proposals;
- subtle animated selection indicator for a small number of tab/filter contexts.

Reject effects that make KREW look like an AI demo, generic startup template or motion showcase.

## 11. Implementation discipline after approval

When corrections begin:

- inspect the relevant page, shared primitive and direct consumers first;
- fix shared root causes before local patches when safe;
- keep each PR coherent and reviewable;
- do not refactor unrelated code;
- preserve product rules;
- test every affected breakpoint and role/state;
- verify no overflow, collision or regression;
- run the Impeccable detector as a signal, not as an unquestioned authority;
- re-run visual review after implementation rather than assuming detector success equals a good interface.
