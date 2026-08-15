# Audit du moteur de recommandations Krew

## Diagnostic avant refonte

- Les réponses questionnaires participants sont stockées dans `trip_participant_preferences`; le questionnaire Star est stocké dans `trip_star_preferences`; les fenêtres horaires transport dans `trip_transport_time_prefs`; les dates validées sont lues via le voyage et les disponibilités.
- Le moteur utilisait déjà une agrégation dans `aggregateParticipantPreferences`: ambiances, activités, budgets, départs, hébergement, accessibilité, dates, âge, exclusions et préférences Star sont fusionnés avant scoring.
- Le scoring déterministe existant se trouve dans `buildProposals`: sous-scores ambiance, activités, budget, distance, saison, qualité, consensus, satisfaction minimale, environnement et historique.
- Les mêmes destinations revenaient surtout parce que la découverte locale reposait sur `CITY_PROFILES`, une base de connaissance d'environ 40 villes, puis `loadTravelCatalog` pouvait recharger le catalogue SQL historique si la shortlist dynamique était vide.
- La liste historique SQL est dans la migration initiale `INSERT INTO public.destinations`; elle sert de catalogue seed/fallback, mais ne doit plus être source principale.
- Les APIs existantes sont Kayak/Kiwi via RapidAPI pour le transport, Booking/Expedia/Hotels.com et activités via RapidAPI pour l'enrichissement, Open-Meteo pour climat, et Lovable/OpenAI/Groq/xAI pour la découverte/rationale LLM.
- Les pertes principales identifiées étaient: absence de profil normalisé explicite exposable, prompt LLM trop simple, contrainte de temps de trajet estimée globalement au lieu d'être vérifiée par mode accepté, et mapping questionnaire → usage moteur non matérialisé dans le code.

## Architecture cible implémentée

Questionnaires → `GroupTravelProfile` normalisé → contraintes dures/soft preferences → découverte IA + règles → matérialisation candidates hors seed → enrichissement APIs → compatibilité transport par mode → scoring déterministe multidimensionnel → rationale LLM contrôlée.

## Mapping questionnaire → moteur

Le mapping exécutable est `QUESTIONNAIRE_SIGNAL_MAPPING`. Chaque champ y déclare s'il agit comme contrainte dure, facteur de scoring, entrée API, tie-breaker et/ou explication.

## Contraintes transport

La compatibilité temps de trajet est évaluée en OR sur les modes acceptés: une destination reste compatible si au moins un mode accepté respecte `max_travel_duration_hours`. Les estimations par mode servent de fallback lorsque les APIs live ne fournissent pas encore de durée exhaustive par train/voiture/avion.

## IA contrôlée

Le prompt de rationale impose un JSON exploitable et interdit au LLM d'inventer prix, disponibilités, temps de trajet ou caractéristiques factuelles. Le LLM reformule et départage les candidates déjà filtrées/scorées; il ne peut pas annuler une contrainte dure.

## KNOWN GAP — Star deal-breaker (écart historique)

Le mapping questionnaire déclarait les deal-breakers de la Star comme des contraintes dures, alors que l'application réelle de cette contrainte n'était pas correctement matérialisée dans le pipeline d'application des contraintes. Cette divergence entre **statut déclaré dans `QUESTIONNAIRE_SIGNAL_MAPPING`** et **application effective** a été identifiée lors du reverse-engineering.

Le correctif est désormais prévu comme faisant partie de l'implémentation cible et doit être validé par les tests associés. Une fois le correctif testé, cette section doit rester comme trace historique de l'écart initial, et non comme description du comportement cible.

## Référence de comportement actuel

La documentation détaillée du moteur doit être maintenue à partir du code et des tests réels. Les règles produit relatives à la Star, aux contraintes, au scoring, à la satisfaction, à la diversification et au rôle du LLM sont synthétisées dans `.agents/skills/krew-product/SKILL.md`; ce fichier reste la référence détaillée du reverse-engineering et de la correspondance code ↔ comportement.
