# KREW — Inventaire des traitements et sous-traitants

> Document de travail RGPD — état technique révisé le 23 août 2026.
> Ce document ne remplace pas la vérification contractuelle finale (DPA, sous-traitants, pays et mécanismes de transfert) avant mise en production commerciale.

## 1. Données et systèmes internes

| Système | Rôle | Données principales | Vigilance |
| --- | --- | --- | --- |
| Supabase | Base de données + Auth + Storage | comptes, voyages, participants, questionnaires, préférences, données applicatives, photos | Région/configuration, DPA, RLS, suppression et conservation à confirmer contractuellement |
| Vercel | Hébergement et exécution de l'application | requêtes nécessaires à l'exécution, logs et données techniques | Région, DPA, logs et transferts à documenter selon configuration réelle |

## 2. APIs externes de recherche voyage

KREW possède plusieurs connecteurs dans le dépôt. La présence d'un connecteur historique ne signifie pas qu'il est actif ou prioritaire en production.

### Transport

- SearchAPI / Google Flights peut fournir des données/offres de vol selon configuration ;
- Kiwi via Travelpayouts est le fallback/recherche affiliée principale actuelle pour l'avion lorsqu'aucune offre live exploitable n'est disponible ;
- Google Flights peut rester une comparaison/recherche secondaire ;
- SNCF Connect / Trainline sont utilisés comme options de recherche train selon le flux ;
- Google Maps / BlaBlaCar couvrent les parcours voiture/covoiturage selon le comportement existant ;
- Kayak et Omio ne doivent pas être décrits comme fallbacks principaux actifs à la date de cette révision.

### Activités

GetYourGuide est l'intégration affiliée actuelle pour les activités réservables lorsqu'un résultat pertinent existe. Des connecteurs historiques Klook/TripAdvisor/RapidAPI peuvent rester présents dans le code mais leur présence ne suffit pas à les qualifier de fournisseur actif en production.

### Hébergements

Le dépôt contient notamment des intégrations StayAPI et des connecteurs RapidAPI historiques. Les programmes Travelpayouts Booking.com / Trip.com sont en attente de validation/configuration tant qu'ils n'ont pas été approuvés et testés ; ils ne doivent pas être déclarés comme fournisseurs live avant cela.

Les paramètres transmis aux APIs voyage doivent être limités aux besoins de recherche : destination/ville, dates, nombre de voyageurs et critères techniques nécessaires. Éviter de transmettre identifiants directs, réponses de questionnaire ou textes libres lorsqu'ils ne sont pas nécessaires.

## 3. Données météo / géocodage

Open-Meteo est utilisé dans les flux de géocodage, prévisions et données climatiques. Les requêtes concernent des données géographiques/météorologiques nécessaires au calcul ; elles ne nécessitent pas l'identité du participant.

Principe de minimisation : ne jamais transmettre à un fournisseur météo/géocodage d'email, nom ou identifiant de compte lorsqu'il n'est pas nécessaire.

## 4. IA

Le code supporte plusieurs fournisseurs IA configurables selon les fonctions, notamment Gemini, AIMLAPI et OpenAI. L'ordre exact dépend du moteur concerné et de la configuration ; il doit être vérifié dans le code avant toute affirmation publique.

Les données envoyées doivent être normalisées et minimisées. Un profil de recherche peut comprendre budget, origine(s), nombre de participants, dates/mois, préférences, contraintes et signaux nécessaires au moteur. Ne pas transmettre les contenus bruts de base de données lorsque le même objectif peut être atteint avec un profil réduit.

Action requise avant commercialisation : identifier précisément les fournisseurs activés en production, vérifier DPA, sous-traitants, conservation, entraînement éventuel et transferts internationaux.

## 5. Affiliation

Intégrations actuellement pertinentes :
- **Travelpayouts / Kiwi** pour le flux avion affilié ;
- **GetYourGuide** pour les activités réservables ;
- **Booking.com / Trip.com via Travelpayouts** : programmes à considérer comme en attente tant que l'approbation et les tests ne sont pas terminés.

Les anciens placeholders/variables Kayak ou Omio ne prouvent pas qu'une attribution active est déployée. Toute nouvelle activation d'un partenaire doit déclencher une mise à jour de cet inventaire et de la documentation cookies/consentement si un traceur soumis à consentement est utilisé.

## 6. Fournisseurs futurs prévus par l'architecture de consentement

Le CMP KREW prévoit des catégories pour mesure d'audience, personnalisation, publicité/retargeting, réseaux sociaux et affiliation/partenaires. Aucun fournisseur non essentiel ne doit être chargé avant le consentement correspondant lorsqu'il est requis.

## 7. Règles de minimisation

1. Ne transmettre à un fournisseur externe que les données nécessaires à sa fonction.
2. Ne jamais envoyer d'email ou d'identifiant utilisateur à une API de recherche voyage si inutile.
3. Ne pas transmettre de texte libre lorsque le traitement peut être réalisé sans celui-ci.
4. Pour l'IA, utiliser un profil normalisé/minimisé plutôt que le contenu brut de la base.
5. Pour les APIs voyage, privilégier ville/origine, dates, voyageurs et critères techniques.
6. Maintenir le registre à jour à chaque ajout, suppression ou changement de priorité d'un fournisseur.

## 8. Transferts internationaux

Pour chaque fournisseur hors EEE ou susceptible d'impliquer un transfert, documenter pays, rôle, DPA, sous-traitants, mécanisme de transfert, mesures supplémentaires, catégories de données, finalité et durée. Ne pas déduire ces éléments de la seule présence d'un SDK ou d'une variable d'environnement.

## 9. État au 23/08/2026

Confirmé techniquement dans l'architecture : Supabase, Vercel, Open-Meteo, plusieurs fournisseurs IA configurables, intégrations voyage externes, Travelpayouts/Kiwi et GetYourGuide.

À finaliser avant lancement commercial : fournisseurs réellement activés en production, régions exactes, DPA, sous-traitants, politiques de conservation, mécanismes de transfert, statut des programmes Booking.com/Trip.com et liste finale des traceurs/partenaires dans les documents publics.