# Audit du moteur de recommandations KREW

> Document de reverse-engineering et d'architecture. Pour les invariants produit durables, voir `.agents/skills/krew-product/SKILL.md`. Le code et les tests restent la source de vérité de l'implémentation actuelle.

## Architecture actuelle

Les réponses participants, préférences Star, disponibilités, fenêtres horaires transport et données du voyage sont agrégées dans un profil exploitable par le moteur.

Chaîne générale :

questionnaires/disponibilités → profil de groupe et profil de séjour → découverte de candidats → enrichissement externe → contraintes dures → scoring déterministe multidimensionnel → ranking/diversification → rationale/présentation.

Le catalogue seed historique peut servir de secours technique dans certains chemins, mais ne doit pas redevenir la source principale de découverte par défaut.

## Profil du séjour et routes de découverte

KREW ne se limite plus aux city trips. Le profil du séjour peut orienter la découverte vers des branches urbaines, régionales, outdoor ou property-led. La mobilité locale et le rôle attendu de l'hébergement font partie des signaux utilisés par les flux correspondants.

La validation du profil est un gate produit : ne pas forcer artificiellement la readiness lorsqu'un prérequis n'est pas satisfait.

## Mapping questionnaire → moteur

Le mapping exécutable du moteur détermine quels signaux agissent comme contraintes dures, facteurs de scoring, entrées d'enrichissement/API, tie-breakers ou explications. Toute modification d'un champ questionnaire doit vérifier son parcours complet jusqu'au moteur et ses consommateurs.

## Contraintes dures

Une contrainte dure élimine une candidate incompatible avant qu'un score élevé puisse la sauver. Les points particulièrement sensibles sont :
- refus explicite d'un mode de transport ;
- durée maximale impérative ;
- budget veto lorsqu'il est configuré comme bloquant ;
- deal-breaker explicite de la Star ;
- exigences d'accessibilité selon le comportement implémenté/testé ;
- prérequis de disponibilité/vérification lorsqu'une offre est présentée comme réelle.

Les fallbacks externes ne doivent jamais contourner ces contraintes.

## Transport

La compatibilité doit tenir compte des modes acceptés et des origines multiples. Une destination n'est pas rendue compatible simplement parce qu'un fallback générique peut fabriquer un lien.

Le flux externe actuel est documenté dans `docs/external_search.md`. Point sentinelle : lorsque seule l'option avion est pertinente (par exemple Paris → Budapest sous les contraintes correspondantes), KREW ne doit pas inventer d'autres modes ; le fallback externe avion principal utilise Kiwi/Travelpayouts, pas Kayak/Omio.

## Hébergement

La découverte urbaine et property-led doit préserver la différence entre données vérifiées et données estimées/inférées. Prix, disponibilité, capacité, équipements et activités sur place ne doivent être présentés comme vérifiés que lorsque la provenance le permet.

Les futures intégrations affiliées Booking.com / Trip.com ne sont pas considérées comme actives avant approbation/configuration et test réel.

## Activités et planning

Les propositions doivent tendre vers de vrais lieux/activités identifiables. GetYourGuide fournit le chemin affilié pour les activités réservables correspondantes. Les activités sans réservation naturelle doivent recevoir une description utile plutôt qu'un faux lien.

Le planning respecte les arrivées/départs, la durée des activités et la cohérence géographique. Les données du planning alimentent ensuite les tâches et la préparation/packing lorsque le flux le prévoit.

## Scoring déterministe

Le moteur utilise plusieurs dimensions, notamment ambiance, activités, budget, distance/transport, saison/météo, qualité, consensus, satisfaction minimale, historique et environnement. Les pondérations peuvent varier selon le type d'événement et la configuration supportée.

Le classement final peut inclure une diversification ; il ne faut donc pas supposer que l'ordre affiché est toujours le tri brut du score total.

## IA contrôlée

Les providers LLM configurés peuvent contribuer à la découverte ou à la rationale. Ils ne sont pas la source d'autorité pour les contraintes dures, le scoring final, les prix, disponibilités, durées ou autres faits vérifiables.

Une valeur générée/inférée doit rester identifiable comme telle et ne doit pas être stockée/affichée comme donnée provider vérifiée.

## Tests de protection

Avant de modifier le moteur, cibler les tests correspondant au sous-système touché : hard constraints, transport filter/compatibility, destination discovery/pool, stay profiles/gating, property discovery, accommodation verification, GetYourGuide/activity discovery, planning engine, packing list, data reliability et cohérence E2E.

Ne pas lancer une lecture exhaustive de tous les tests pour une modification locale ; sélectionner ceux qui protègent directement l'invariant modifié.

## Historique

Les anciens diagnostics présents dans l'historique Git ou les plans Lovable décrivent des états antérieurs. Ils sont utiles pour comprendre l'origine d'une règle, mais ne doivent pas être utilisés pour réintroduire un ancien provider, une ancienne architecture ou un ancien comportement sans vérification du code actuel.