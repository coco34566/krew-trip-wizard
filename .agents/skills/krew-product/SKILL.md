# KREW Product Skill

## Purpose

This skill defines durable KREW product rules. It is provider-independent and must not be changed merely to accommodate a technical tool or integration.

## Group-first recommendation

KREW recommends trips for a group, while preserving individual preferences so the engine can evaluate individual satisfaction rather than reducing everyone to a single undifferentiated profile.

## The Star

The Star is the person being celebrated and has a higher product priority than other participants.

The engine applies the Star priority through the configured Star weighting and preserves Star-specific preferences in the individual preference model.

### Star deal-breakers

An explicit Star deal-breaker is a hard constraint.

The Star deal-breaker correction is part of the current target implementation and must be preserved by future changes: a candidate violating an explicit Star deal-breaker must not remain a valid recommendation merely because its global score is high.

Normal Star preferences are not automatically hard constraints.

## Other participants

Preferences of non-Star participants generally influence scoring and group satisfaction. They must not automatically become hard filters simply because they are important preferences.

## Hard constraints vs preferences

A hard constraint eliminates an incompatible option. A preference influences ranking.

This distinction must remain consistent across questionnaire mapping, normalized profile, scoring context, filtering and scoring.

## Accessibility

Accessibility is a product-level requirement intended to be blocking when a required accessibility need cannot be met. The current implementation should be treated according to the actual tested code; do not silently broaden or narrow accessibility behavior during unrelated work.

## Food constraints

Food preferences and dietary constraints are not destination-level hard constraints by default. They may influence downstream planning without automatically eliminating a destination.

## Transport

An explicitly incompatible transport option is blocking. Examples include refusing air travel or exceeding a required maximum travel duration. Normal transport preferences can influence scoring.

When multiple departure cities exist, transport evaluation must account for the different origins rather than optimizing for only one participant.

## Budget

Budget is both a product constraint and a scoring dimension. The engine may use median group budget, minimum participant budget, must-have/veto budget, transport, accommodation, activities, food, total per person and total group cost.

A hard budget veto must be respected as a blocking constraint. Do not reduce the budget model to a single average.

## Accommodation

Accommodation preferences can include lodging type, room type, shared-room acceptance, required amenities, minimum rating, capacity, accessibility, price, distance and source.

Document and implement only behavior that actually exists. Future accommodation concepts must not be presented as current functionality.

## Dates

The group date model includes start date, end date, month, flexibility and blackout dates. Group flexibility is conservative and blackout dates are aggregated across participants according to the current engine behavior.

## Scoring

KREW uses multi-dimensional deterministic scoring. Current dimensions include ambiance, activities, budget, distance, transport, season, weather, quality, consensus, minimum satisfaction, history and environment.

Scoring weights vary by event type and may be overridden through the supported scoring-weight configuration. Do not replace event-specific weighting with a universal weight set without an explicit product decision.

## Group satisfaction

KREW evaluates individual fit, not only a group average. The engine exposes consensus score, minimum satisfaction, satisfied participant count and evaluated participant count. The current satisfaction threshold is part of the engine implementation and must be preserved unless explicitly changed.

## Diversification

The final recommendation list is not necessarily the raw score ranking. KREW can diversify the top results to avoid presenting several overly similar destinations.

## History

Travel history influences ranking and is not automatically a destination exclusion rule. The current deterministic logic considers factors such as country and dominant ambiance.

## Environment

Environment is a scoring dimension. Canonical categories include urban/city center, lively neighborhood, seaside, nature, charming village, mountain and lake/river. The engine may use explicit tags and deterministic fallback heuristics.

## Age

Participant age can influence budget scoring through the engine's age-based budget multiplier. Do not remove or bypass this behavior unintentionally.

## Discovery

Discovery and scoring are separate stages:

group profile → candidate discovery → enrichment → hard constraints → scoring → ranking → diversification.

Do not confuse discovery candidates with final recommendations.

## Real vs estimated data

Real API data and estimated fallback data must remain distinguishable. Never present an estimate as a verified real price, duration or availability.

## LLM role

The deterministic engine is the source of truth for recommendation decisions. The LLM may explain, summarize, present or generate rationale, but must not override hard constraints or invent factual recommendation data.
