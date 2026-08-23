# KREW — Legal & Compliance Roadmap

> **Document de pilotage interne — révisé le 23 août 2026**
>
> Ce document centralise les décisions de travail juridiques KREW et leur traduction technique. Il ne constitue pas un avis juridique. Les points nécessitant une validation professionnelle devront être revus avant le lancement commercial.

## 1. Statut et principes

KREW est encore en phase de projet. Les informations légales de la structure devront être complétées lors de sa création.

Principes de conception : minimisation, limitation des finalités et de la conservation, sécurité/cloisonnement, transparence, droits des personnes et séparation des données lorsque les finalités diffèrent.

## 2. Cookies et traceurs

Expérience retenue : **Tout accepter | Tout refuser | Personnaliser**.

Catégories préparées :
1. traceurs nécessaires ;
2. mesure & amélioration ;
3. personnalisation & publicité ;
4. partenaires & affiliation.

L'ajout d'un fournisseur n'est jamais automatiquement couvert par un ancien consentement. Le fournisseur, la finalité et le mécanisme technique doivent être documentés avant activation lorsque le consentement est requis.

## 3. Fournisseurs et traitements externes

La référence technique détaillée est `docs/data-processing-inventory.md`.

À la date de révision, l'architecture comprend notamment :
- Supabase — base, Auth, Storage ;
- Vercel — hébergement/exécution ;
- Open-Meteo — géocodage/météo/climat ;
- plusieurs fournisseurs IA configurables selon les moteurs (notamment Gemini, AIMLAPI, OpenAI) ;
- SearchAPI / recherches externes transport selon configuration ;
- Travelpayouts / Kiwi pour le flux avion affilié actuel ;
- GetYourGuide pour les activités réservables affiliées ;
- des connecteurs voyage/hébergement historiques ou optionnels, dont RapidAPI/StayAPI ;
- Booking.com / Trip.com via Travelpayouts à considérer comme en attente tant que les programmes ne sont pas approuvés/configurés/testés.

Kayak et Omio ne doivent pas être décrits comme partenaires d'affiliation actifs simplement parce que des variables ou anciens connecteurs existent encore dans le dépôt.

Pour chaque fournisseur réellement activé avant commercialisation : documenter rôle, données transmises, finalité, conservation, sous-traitants, pays, DPA, transfert international et modalités d'effacement.

## 4. Transferts internationaux

Lorsqu'un transfert international existe, identifier le pays, le fournisseur, le mécanisme juridique applicable et les mesures nécessaires. Aucun pays/DPA/mécanisme ne doit être affirmé dans les documents publics sans vérification de la configuration et du contrat effectivement utilisés.

## 5. Conservation des données

Règle de travail actuelle pour un compte inactif : **2 ans depuis la dernière action**, avec avertissement préalable, sous réserve des finalités/obligations particulières.

À la suppression volontaire d'un compte, les données personnelles sans finalité restante doivent être supprimées sans délai indu ; les exceptions légales/contentieuses relèvent d'un archivage intermédiaire restreint.

Les données collectives d'un voyage peuvent devoir être préservées pour les autres participants tout en retirant/désidentifiant les informations de la personne supprimée lorsque possible.

Voir `docs/data-retention-policy.md` pour le détail.

## 6. IA KREW

L'utilisation de données pour développer, tester, entraîner, maintenir ou améliorer une IA est une finalité distincte à documenter. Les données envoyées aux fournisseurs externes doivent être minimisées et normalisées ; les identifiants directs doivent être retirés lorsqu'ils ne sont pas nécessaires.

KREW ne doit pas promettre un effacement absolu d'une information déjà apprise par un modèle tant que cette capacité n'est pas techniquement garantie.

## 7. Monétisation et affiliation

KREW peut monétiser certains clics/réservations via des partenaires d'affiliation. Cela ne constitue pas une autorisation générale de partager ou vendre des données personnelles.

Les liens d'affiliation actuels/futurs doivent être distingués des traitements nécessitant un traceur. Lorsqu'un mécanisme d'attribution utilise un traceur soumis à consentement, le chargement et la documentation doivent respecter le choix utilisateur.

La monétisation future de données personnelles pour une finalité propre d'un partenaire nécessite une analyse juridique spécifique ; elle n'est pas couverte par le consentement cookies général.

## 8. Paiement et budget

Décision produit actuelle : KREW n'est pas un intermédiaire de paiement. Les fonctions de budget, dépenses/répartition et coût estimé peuvent exister, mais aucun encaissement de fonds du groupe ne doit être déduit de ces fonctionnalités sans nouvelle décision produit/juridique.

## 9. Suppression de compte

Un mécanisme backend de suppression existe dans Supabase. Les points restant à maintenir/vérifier incluent l'interface et confirmation utilisateur, déconnexion/redirection, archivage intermédiaire, automatisation de l'inactivité, datasets IA, sauvegardes/copies externes et journalisation minimale.

## 10. Documents associés

- `docs/data-processing-inventory.md` — fournisseurs et traitements techniques ;
- `docs/data-retention-policy.md` — conservation/cycle de vie ;
- `docs/legal-bases-matrix.md` — matrice de travail des bases légales ;
- politique de confidentialité / cookies / CGU / mentions légales — à finaliser selon structure et fournisseurs réellement actifs.

## 11. Statuts de conformité

**Implémenté / préparé :** architecture CMP, inventaire technique, politique de conservation, mécanismes backend existants à vérifier lors des évolutions.

**À implémenter/finaliser :** automatisation de conservation, cycle de vie complet des datasets IA et sauvegardes, centre de préférences et procédures opérationnelles selon l'état réel du produit.

**À vérifier fournisseur :** DPA, sous-traitants, pays, transferts, conservation, réutilisation IA et traceurs pour chaque fournisseur effectivement activé.

**Validation juridique avant commercialisation :** identité du responsable de traitement, bases légales définitives, politique de confidentialité, CGU, mentions légales et traitements/monétisations à risque.

## 12. Règle de maintenance

Toute activation, suppression ou changement de priorité d'un fournisseur externe — notamment affiliation, IA, hébergement, transport ou activité — doit déclencher une revue de `docs/data-processing-inventory.md` et, si le traitement ou le traceur change, de cette roadmap et des documents publics concernés.