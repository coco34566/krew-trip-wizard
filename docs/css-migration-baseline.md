# KREW — CSS migration baseline

> Contrat de sécurité avant simplification du CSS KREW.
>
> Cette phase ne redessine pas KREW. Elle documente ce qui doit être préservé, ce qui doit être déplacé vers un propriétaire explicite et ce qui peut être supprimé seulement après preuve de non-régression.

## 1. Principe directeur

**Architecture plus propre, rendu identique par défaut.**

La migration CSS ne doit pas servir de prétexte à une refonte visuelle opportuniste.

Toute modification de rendu qui n'est pas strictement nécessaire au retrait d'une dette CSS doit être traitée séparément, après validation visuelle explicite.

## 2. Baseline de référence

La baseline est le `main` courant au démarrage de l'audit :

- commit `57ba68fda3f95b7cac5a440cfc12c88c77352c2d` ;
- les travaux récents sur les headers Journey, la géométrie des boutons/form controls, les vagues et espacements de summary ainsi que les avatars sont donc considérés comme faisant partie du rendu de référence ;
- aucune PR n'était ouverte au moment du verrouillage de la baseline.

### Surfaces visuelles de référence

Le test `tests/e2e/reference-surfaces-visual-audit.spec.ts` couvre désormais :

- landing ;
- FAQ ;
- tarifs ;
- à propos ;
- auth ;
- Mes voyages ;
- Nouveau voyage ;
- TripHub / dashboard d'un voyage ;
- compte ;
- recap ;
- memories.

Viewports contrôlés :

- 320 × 568 ;
- 390 × 844 ;
- 844 × 390 ;
- 834 × 1112 ;
- 1112 × 834 ;
- 1440 × 1000 ;
- 1728 × 1100.

Les screenshots de référence sont capturés sur 390 × 844, 834 × 1112 et 1440 × 1000. Tous les viewports vérifient aussi l'absence d'overflow horizontal.

Les pages Journey restent couvertes par `journey-visual-audit.spec.ts`.

## 3. Décisions visuelles à préserver pendant la migration

Les choix suivants sont considérés comme intentionnels et ne doivent pas disparaître à cause d'un nettoyage CSS :

- identité éditoriale KREW et hiérarchie Instrument Serif / Plus Jakarta Sans / Space Mono ;
- esprit actuel de Mes voyages, dont la composition polaroid et ses animations d'entrée ;
- logique actuelle des KrewMarks : usage sémantique, pas décoratif gratuit ;
- vagues sous les titres lorsqu'elles ont été harmonisées et validées ;
- post-its légers, lisibles, peu nombreux, proches de l'information qu'ils commentent ;
- loutres sémantiques correctement dimensionnées, sans chevauchement accidentel avec textes ou contrôles ;
- marges et absence d'overflow sur mobile et tablette ;
- boutons robustes, texte optiquement centré, labels non coupés et états stateful lisibles ;
- animations du parcours et du dashboard lorsqu'elles servent la compréhension ;
- différences de composition légitimes entre une page formulaire, une page Journey et un dashboard riche.

## 4. Règles d'arbitrage

### Conserver

Une règle peut rester locale lorsqu'elle décrit réellement un composant : géométrie propre d'un widget, animation interne, image, dataviz ou composition qui n'est pas une règle de page générique.

### Déplacer

Une règle visuellement correcte mais portée par un fichier global de review/baseline doit migrer vers son propriétaire naturel avant suppression de l'ancienne règle.

### Tokeniser

Une valeur devient token uniquement lorsqu'elle représente une décision réutilisable de système : largeur de page, rythme vertical, taille de titre, slot de loutre, espace commun, etc.

Les dimensions intrinsèques d'un composant ne doivent pas devenir des tokens globaux uniquement pour supprimer des valeurs arbitraires.

### Supprimer

Une règle peut être supprimée seulement si l'une des conditions suivantes est démontrée :

1. elle est morte ;
2. son comportement est reproduit explicitement par le nouveau propriétaire ;
3. elle contredit une décision visuelle plus récente validée ;
4. elle est un doublon sans effet supplémentaire.

Si aucune de ces conditions n'est démontrée, la règle reste en place pendant la migration.

## 5. Anti-patterns à retirer progressivement

### Page reconnue par sa largeur

À retirer : sélecteurs du type :

```css
main[class*="max-w-[820px]"] ...
main[class*="max-w-[1020px]"] ...
main[class*="max-w-[1180px]"] ...
```

La largeur d'un conteneur ne doit jamais servir d'identifiant caché pour appliquer le design d'une page.

### Page reconnue par sa structure DOM

À retirer lorsque cela sert à reconnaître une surface :

```css
main:has(#availability-notes) ...
main:has(> section[class~="bg-sage/8"]) ...
```

Une page ou un composant doit déclarer explicitement son rôle par un composant, une classe sémantique, un `data-*` ou une prop de variante.

` :has()` reste autorisé lorsqu'il décrit proprement un état interne local d'un composant, par exemple une animation révélée ou une cellule contenant un checkbox.

### Correctifs globaux dépendant de classes Tailwind internes

Les sélecteurs qui traversent plusieurs niveaux du DOM ou dépendent de classes utilitaires générées dans un autre composant doivent être remplacés par une responsabilité explicite.

### Guerre de cascade

Les `!important` des couches de review/alignment/baseline sont considérés comme un signal à investiguer. Ils ne sont pas supprimés automatiquement : ils disparaissent lorsque la propriété retrouve un propriétaire unique.

## 6. Matrice initiale des propriétaires

| Zone / règle actuelle | Rendu à préserver | Problème d'architecture | Propriétaire cible | Risque |
| --- | --- | --- | --- | --- |
| Tokens `--krew-journey-*` | Oui | trop spécifiques au Journey pour certaines décisions globales | tokens KREW de layout/type, avec compatibilité transitoire | Moyen |
| Header Journey / vague / intro / loutre | Oui | plusieurs couches historiques peuvent encore intervenir | `KrewJourneyPageHeader` puis primitive générique si nécessaire | Élevé |
| Availability / Preferences density | Oui | page reconnue par largeur/DOM | composants de questionnaire / contrôles explicites | Très élevé |
| Cellules calendrier Availability/Star | Oui | `button.aspect-square` ciblé via largeur 820 | composant/variant de cellule calendrier | Élevé |
| Invite composition | Oui | ciblage via `:has()` et classes de section | page/composants Invite | Élevé |
| Nouveau voyage spacing / sélection | Oui | règles globales ciblées via largeur et structure de formulaire | route + composants du formulaire de création | Élevé |
| Mes voyages animations | Oui | animation déclenchée via largeur 1180 | attribut/classe sémantique Dashboard | Moyen |
| Mes voyages title waves | Oui | correction dans fichiers de review/mobile via largeur | header/section explicitement propriétaire | Moyen |
| TripHub hero/layout | Oui | hardcodes locaux + règles globales transverses possibles | `TripHubDashboard` + futur page shell | Élevé |
| Recap / Memories header scale | Oui par défaut | taille de H1 déduite de largeur 1020 | header explicite de surface | Moyen |
| Journey map / detail polish | Oui | sélecteurs DOM profonds dans review-details | composant Journey map / section concernée | Très élevé |
| Post-its | Oui, selon dernière validation visuelle | plusieurs sources de vérité typographiques | `KrewNote` / `KrewCallout` / note concept | Élevé |
| Motion locale du parcours | Oui | `:has()` présent mais sémantique localement | `krew-motion.css` ou composant motion | Faible |
| `styles.css` theme/base | Oui | contient aussi quelques règles page-spécifiques | garder le global, sortir les règles de page | Moyen |

## 7. Fichiers historiques à vider par migration, jamais par suppression en bloc

Les fichiers suivants sont des sources de dette à résorber progressivement :

- `src/krew-journey-alignment.css` ;
- `src/krew-journey-pages.css` ;
- `src/krew-journey-pages-refinement-wavefix.css` ;
- `src/krew-ux-review.css` ;
- `src/krew-ux-review-details.css` ;
- `src/krew-visual-baseline.css`.

La suppression finale n'est autorisée que lorsque chaque règle restante a été classée et qu'aucun comportement nécessaire n'en dépend encore.

`src/styles.css` reste la feuille globale, mais ses règles page-spécifiques doivent elles aussi être réattribuées à leurs propriétaires.

Les feuilles de motion ou de composants réellement spécialisées peuvent rester séparées lorsque cette séparation correspond à une responsabilité claire.

## 8. Incohérences de documentation à résoudre avant migration visuelle

### Police manuscrite des post-its

`DESIGN.md` contient actuellement une contradiction :

- une phrase impose Kalam 700 ;
- la liste de style indique Caveat ;
- d'autres règles CSS actuelles utilisent Shantell Sans.

Aucune migration typographique des post-its ne doit être faite tant que cette décision n'est pas explicitement résolue. Le rendu actuellement validé reste la baseline jusque-là.

### Échelle des titres Journey

`DESIGN.md` décrit encore les grands chapitres produit autour de 28–34 px alors que le système Journey récent utilise une échelle différente. La migration ne doit pas forcer l'ancienne documentation sur le rendu actuel : il faut d'abord documenter la valeur actuelle validée, puis décider séparément d'une éventuelle évolution visuelle.

## 9. Ordre de migration sécurisé

1. verrouiller baseline, tests et matrice ;
2. introduire des tokens de compatibilité sans changement visuel ;
3. migrer TripHub uniquement ;
4. vérifier TypeScript, build et audit visuel ;
5. migrer Mes voyages ;
6. vérifier ;
7. migrer Nouveau voyage ;
8. vérifier ;
9. migrer progressivement les pages Journey, en touchant le moins possible au rendu récent ;
10. migrer Recap, Memories, Account et autres surfaces restantes ;
11. retirer les règles legacy devenues réellement mortes ;
12. supprimer un fichier historique uniquement lorsqu'il ne porte plus aucune responsabilité ;
13. comparaison visuelle globale finale avant merge.

## 10. Contrat de validation par famille

Après chaque famille migrée :

- `npx tsc --noEmit` ;
- `npm run build` ;
- `npm run test:e2e:visual` ;
- comparaison des screenshots mobile / tablette / desktop avec la baseline ;
- vérification de l'absence d'overflow horizontal aux sept viewports ;
- contrôle ciblé des états loading / empty / locked / completed / selected lorsque la surface migrée les possède.

Une différence visuelle inattendue bloque la migration de la famille suivante.

## 11. Définition de fini

La migration est terminée lorsque :

- une page ne peut plus être reconnue implicitement par sa largeur ou sa structure DOM ;
- les règles communes ont un propriétaire unique ;
- les exceptions visuelles légitimes restent locales et explicites ;
- les six couches historiques peuvent être supprimées sans changement de rendu ;
- `styles.css` ne contient plus de logique de page cachée ;
- la baseline visuelle et les tests passent ;
- les décisions visuelles validées restent reconnaissables dans le produit final.
