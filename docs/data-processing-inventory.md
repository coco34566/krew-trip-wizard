# KREW — Inventaire des traitements et sous-traitants

> Document de travail RGPD — état technique vérifié le 15 août 2026.
> Ce document ne remplace pas la vérification contractuelle finale (DPA, sous-traitants, pays et mécanismes de transfert) avant mise en production commerciale.

## 1. Données et systèmes internes

| Système | Rôle | Données principales | Localisation / transfert | Statut |
| --- | --- | --- | --- | --- |
| Supabase | Base de données + Auth + Storage | comptes, voyages, participants, questionnaires, préférences, données applicatives | Région du projet à confirmer contractuellement ; Supabase permet un traitement régionalisé selon configuration | À contractualiser / vérifier |
| Vercel | Hébergement et exécution de l'application | données de requêtes nécessaires à l'exécution, logs et données techniques | Vercel indique que ses installations principales de traitement sont aux États-Unis et prévoit des transferts internationaux encadrés par son DPA | À documenter dans la politique |

## 2. APIs externes de recherche voyage

KREW utilise RapidAPI comme passerelle pour plusieurs APIs externes de voyage et d'hébergement. Les connecteurs actuellement documentés sont :

- Hotels.com / Expedia via `hotels4` ;
- Booking.com via `booking-com15` ;
- Kayak via `kayak-hotel-search` ;
- TripAdvisor via `tripadvisor16` ;
- Klook via `klook-api` ;
- Kayak / Kiwi pour certains besoins transport selon les connecteurs actifs.

Les paramètres transmis sont principalement des paramètres de recherche : destination/ville, dates, nombre de voyageurs et critères nécessaires à la recherche. KREW doit éviter de transmettre aux APIs de recherche des identifiants directs, réponses de questionnaire ou textes libres lorsqu'ils ne sont pas nécessaires.

**Point à vérifier avant commercialisation :** identité juridique exacte de RapidAPI comme intermédiaire, liste des sous-traitants/API providers, pays de traitement, DPA et mécanismes de transfert applicables.

## 3. Données météo / géocodage

Open-Meteo est utilisé pour le géocodage, les prévisions et les données climatiques. Les requêtes concernent des données géographiques et météorologiques nécessaires au calcul des destinations ; elles ne nécessitent pas l'identité du participant.

**Principe de minimisation :** ne jamais transmettre à Open-Meteo d'email, nom, identifiant de compte ou réponse de questionnaire.

## 4. IA

Le moteur de découverte IA peut utiliser :

- AIMLAPI en priorité ;
- OpenAI en fallback lorsque la clé correspondante est configurée.

Le code transmet au moteur IA un profil de recherche comprenant notamment budget, ville de départ, nombre de participants, dates/mois, préférences, contraintes, préférences de la Star et certains signaux de scoring. Le moteur IA reçoit donc potentiellement des données personnelles ou pseudonymisées lorsqu'elles permettent d'identifier indirectement un participant ou un groupe.

**Action requise avant commercialisation :** finaliser la minimisation des données envoyées à l'IA, identifier précisément le fournisseur effectivement activé en production, vérifier son DPA, ses sous-traitants, la conservation, l'utilisation éventuelle des données pour entraînement et les transferts internationaux.

## 5. Affiliation

Le dépôt de codes d'affiliation est prévu pour :

- Kayak ;
- Booking ;
- Omio ;
- GetYourGuide.

La présence de ces variables ne signifie pas qu'un traceur d'affiliation est actuellement déployé côté navigateur. Lorsqu'un système de suivi/attribution sera activé, il devra être relié à la catégorie de consentement « Partenaires & affiliation » et documenté avec le fournisseur exact et les finalités.

## 6. Fournisseurs futurs prévus par l'architecture de consentement

Le CMP KREW prévoit des catégories pour :

- mesure d'audience ;
- personnalisation ;
- publicité ;
- retargeting ;
- réseaux sociaux ;
- affiliation / partenaires.

Aucun fournisseur futur ne doit être chargé avant le consentement correspondant lorsqu'il est requis.

## 7. Règles de minimisation

1. Ne transmettre à un fournisseur externe que les données nécessaires à sa fonction.
2. Ne jamais envoyer d'email ou d'identifiant utilisateur à une API de recherche voyage si celui-ci n'est pas nécessaire.
3. Ne pas transmettre de texte libre aux fournisseurs externes lorsque le traitement peut être réalisé sans celui-ci.
4. Pour l'IA, utiliser un profil normalisé et minimisé plutôt que le contenu brut de la base de données.
5. Pour les APIs voyage, privilégier des paramètres de recherche techniques (ville, dates, voyageurs, critères) plutôt que des données de profil.
6. Maintenir un registre des sous-traitants et réévaluer ce registre à chaque ajout de fournisseur.

## 8. Transferts internationaux

Un transfert hors EEE n'est pas interdit par le RGPD, mais doit être encadré conformément au chapitre V du RGPD. Pour chaque fournisseur hors EEE, KREW doit documenter :

- pays de destination ;
- rôle du fournisseur (sous-traitant ou responsable distinct) ;
- DPA ;
- sous-traitants ;
- mécanisme de transfert (décision d'adéquation, SCC, autre mécanisme valide) ;
- mesures supplémentaires lorsque nécessaires ;
- catégories de données transférées ;
- finalité et durée.

## 9. État au 15/08/2026

### Confirmé techniquement

- Supabase ;
- Vercel ;
- RapidAPI et ses connecteurs voyage documentés ;
- Open-Meteo ;
- AIMLAPI / OpenAI comme fournisseurs IA configurables ;
- variables d'affiliation prévues.

### À finaliser avant lancement commercial

- vérifier les régions exactes configurées chez chaque fournisseur ;
- récupérer/valider les DPA applicables au compte KREW ;
- documenter les sous-traitants de RapidAPI et des fournisseurs IA ;
- confirmer les politiques de conservation des fournisseurs IA ;
- confirmer les mécanismes de transfert pour chaque fournisseur hors EEE ;
- mettre à jour la politique de confidentialité avec la liste finale des fournisseurs réellement actifs.
