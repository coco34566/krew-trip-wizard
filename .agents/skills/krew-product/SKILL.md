# KREW Product Skill

## Purpose

This skill defines durable KREW product rules. It is provider-independent except where a currently validated provider priority is explicitly documented as an implementation invariant. It must not be changed merely to accommodate a technical tool or integration.

## Product experience

KREW should provide a simple, fluid and premium-feeling group trip planning experience. This is a product direction, not a reason to introduce unrelated UI rewrites during technical fixes.

## Group-first recommendation

KREW recommends trips for a group, while preserving individual preferences so the engine can evaluate individual satisfaction rather than reducing everyone to a single undifferentiated profile.

## The Star

The Star is the person being celebrated and has a higher product priority than other participants.

The engine applies the Star priority through the configured Star weighting and preserves Star-specific preferences in the individual preference model.

An explicit Star deal-breaker is a hard constraint. A candidate violating one must not remain valid merely because its global score is high. Normal Star preferences are not automatically hard constraints.

## Roles

Organizer and co-organizer are decision-making roles. A co-organizer has the same operational rights as the organizer except for actions explicitly reserved to the creator, such as deleting the trip. Participants provide availability/preferences, vote and manage their own transport choices according to the implemented flow.

## Hard constraints vs preferences

A hard constraint eliminates an incompatible option. A preference influences ranking. This distinction must remain consistent across questionnaire mapping, normalized profile, discovery, filtering, scoring and downstream planning.

## Accessibility and food constraints

Accessibility is intended to be blocking when a required accessibility need cannot be met. Food preferences and dietary constraints are not destination-level hard constraints by default; they influence downstream choices such as activities/restaurants/planning.

## Dates and trip duration

The trip duration is an explicit business datum when defined at trip/group level and must remain the reference for dependent calculations. Do not silently replace it with an average of participant preferences.

Always distinguish calendar days, nights and dates. A duration of N nights generally corresponds to N+1 calendar days, but calculations must use the unit appropriate to the specific business context.

Locked dates gate calendar export. Planning must respect real arrival/departure boundaries: no activity may be scheduled before arrival or after the relevant departure window.

## Stay profile and discovery gating

The group stay profile is determined before destination discovery. Validated profile choices gate destination generation according to the current readiness rules. Organizer/co-organizer validation must preserve the implemented minimum/maximum selection rules; do not bypass gating with a fallback that marks unavailable prerequisites as ready.

Discovery and scoring are separate stages:

group profile → candidate discovery → enrichment → hard constraints → scoring → ranking → diversification.

Do not confuse discovery candidates with final recommendations. Urban, regional, outdoor and property-led routes may coexist; do not collapse KREW back into a city-only recommender.

## Transport

An explicitly incompatible transport option is blocking. Refusing air travel, refusing another mode or exceeding an imperative maximum travel duration must not be undone by a fallback.

When multiple departure cities exist, transport evaluation must account for the different origins rather than optimizing for only one participant.

Transport results should only expose relevant modes. Do not add train, flight, car or rideshare merely to fill the interface when the route/constraints make that mode irrelevant.

Current validated flight-link priority when no live bookable offer is available: **Kiwi via Travelpayouts is the primary external flight search**, preserving origin, destination and dates and the KREW affiliate SubID. Google Flights may remain a secondary comparison/fallback. Kayak and Omio are not current primary KREW flight/transport fallbacks and must not be silently reintroduced. Trainline/SNCF Connect remain train search options; car/Google Maps and BlaBlaCar behavior must not be altered by unrelated flight changes.

Sentinel regression case: for a route such as Paris → Budapest where only flight is compatible, KREW must not fabricate train/car alternatives, and the primary external flight action must resolve to the configured Kiwi/Travelpayouts flow.

## Budget

Budget is both a product constraint and a scoring dimension. The engine may use median group budget, minimum participant budget, must-have/veto budget, transport, accommodation, activities, food, total per person and total group cost.

A hard budget veto must be respected as a blocking constraint. Do not reduce the budget model to a single average.

KREW does not act as a group-payment intermediary. Budget/cost features track estimates, reservations and allocation; do not reintroduce payment collection without an explicit product decision.

## Accommodation

Accommodation preferences can include lodging type, room type, shared-room acceptance, required amenities, minimum rating, capacity, accessibility, price, distance, local mobility and the role of the accommodation in the stay.

Property-led discovery must not present an unverified property as if availability or price were confirmed. Keep verified/provider data separate from estimated or inferred data. Booking/Trip.com affiliate integrations may be added when approved/configured, but their future availability must not be documented as current live behavior before validation.

## Activities and planning

Activity generation should prefer real, identifiable places/activities where appropriate. Bookable activity links use the current GetYourGuide integration when a matching affiliate result is available. Do not replace a specific verified/bookable URL with a generic search URL merely for consistency.

For activities that naturally have no booking page (for example a neighborhood walk), provide useful descriptive context rather than inventing a reservation URL. For idea-based activities such as party/wedding games, a relevant inspiration/resource link may be used when supported by the current engine.

Planning must respect arrival/return constraints, geographic coherence, activity duration and the selected destination/accommodation context. Regeneration must not casually discard validated user choices or reservations.

## Packing / trip preparation

The packing list is contextual: trip type, duration, season/weather context and selected/planned activities can affect suggestions. Preserve the distinction between personal items, group items, groceries and actions/tasks. Group items can be routed toward task assignment when appropriate.

## Scoring

KREW uses multi-dimensional deterministic scoring. Current dimensions include ambiance, activities, budget, distance, transport, season, weather, quality, consensus, minimum satisfaction, history and environment.

A change to a scoring input must be checked for its effect on existing scores, ranking, extreme results and missing-data cases. Scoring weights vary by event type and may be overridden through supported configuration; do not replace event-specific weighting with a universal set without an explicit product decision.

## Group satisfaction, diversification and history

KREW evaluates individual fit, not only a group average. The engine exposes consensus/minimum-satisfaction concepts and participant-level evaluation. The final recommendation list is not necessarily raw score order because diversification may avoid overly similar destinations. Travel history influences ranking and is not automatically a hard destination exclusion.

## Environment and age

Environment is a scoring dimension. Canonical categories include urban/city center, lively neighborhood, seaside, nature, charming village, mountain and lake/river. Participant age can influence budget scoring through the current engine logic; do not remove or bypass this unintentionally.

## Real vs estimated data

Real API/provider data, external search links and KREW estimates must remain distinguishable. Never present an estimate as a verified real price, duration or availability. Never allow an LLM-generated factual field to masquerade as verified provider data.

## LLM role

The deterministic engine is the source of truth for recommendation decisions. LLMs may discover candidates, explain, summarize, present or generate rationale within the implemented pipeline, but must not override hard constraints or invent factual recommendation data.